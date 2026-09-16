// sdk/uds.js — Router UDS 通道（层 B；F03 / F08 / F09 / G02；architecture §2.2 流 2、§4.1 N-5、§5.1 层 B 表）
// 会话形态：connect(opts) → { register, heartbeat, send, ack, status, taskGet, taskList, taskCancel, deregister, close }
//   （9 个 Router 方法 1:1 + close()）；返回值 = JSON-RPC result 原对象（不加信封、不改字段名、不裁剪）。
// 复用而非重建（§2.3）：帧编解码全经 src/rpc.js 的 RpcPeer；socket 路径全经 src/config.js 的
//   loadConfig(env).socketPath —— SDK 内无第二份帧编解码、无第二处默认路径。
// 失败统一为 pr-001 的 HubError（errors.js 归类表）：连接建立失败 / 超时 → 3；上游 JSON-RPC 错误 → 1。
// 零自动性（L2-9 / G02 验收 3）：无自动心跳循环、无自动重连、无重试、无失败重派、无自动 ack；
//   心跳是单次方法（调度归调用方），受理由调用方显式 ack()；连接与会话不跨调用复用。
// 零状态（F09）：模块级无可变值；除调用方显式持有的会话（socket + peer）外无句柄、无定时器、不写文件。

import net from 'node:net';
import { RpcPeer, RpcError, ERR } from '../src/rpc.js';
import { HubError, classify } from './errors.js';

const CONNECT_TIMEOUT_MS = 2000; // §5.4 `3` 类 ①：连接建立上限（与 src/status.js / src/node-client.js 同值）
const REQUEST_TIMEOUT_MS = 5000; // §5.4 `3` 类 ②：请求响应上限（F08 落定：两个上限都在 SDK 侧）
const EXIT_BUSINESS = 1; // §5.4 `1` 类 ①：上游业务错误（errors.js 未导出该常量，取值按归类表）

/** 连接不可达（§5.4 序 2）：单一文案，含目标 socket 路径与"未运行"提示（src/status.js 的既有体例）。 */
function unreachableError(socketPath, reason) {
  const { code, exitCode } = classify({ kind: 'connect' });
  return new HubError({
    code,
    error: `无法连接 oamp router（socket=${socketPath}，${reason}；router 未运行？先执行 oamp router start）`,
    exitCode,
  });
}

/**
 * socket 路径解析（§2.3：与 src/status.js / src/task.js 同一条链，不在 SDK 内重建默认值）。
 * src/config.js 顶层有 `export default loadConfig()`（:166）⇒ 静态 import 该模块即执行一次 loadConfig，
 * 坏配置会在 import 期抛裸异常、绕过归类表 ⇒ 此处**惰性动态 import**，把 import / 解析失败一并归为 CONFIG_ERROR。
 */
async function resolveSocketPath(opts) {
  if (typeof opts.socketPath === 'string' && opts.socketPath !== '') return opts.socketPath;
  try {
    const { loadConfig } = await import('../src/config.js');
    return loadConfig(opts.env || process.env).socketPath;
  } catch (err) {
    const { code, exitCode } = classify({ kind: 'config' });
    throw new HubError({ code, error: err instanceof Error ? err.message : String(err), exitCode });
  }
}

/**
 * 建立 UDS 连接（成功 resolve socket；失败 / 超时 reject；**只尝试一次**，无重试无退避）。
 * 上限用 socket 自身的 `timeout` 选项（Node ≥18：连接建立**前**装载，不引入 JS 定时器）；
 * 连通后立刻 socket.setTimeout(0) 清零 —— 否则空闲超 2000ms 会误杀长会话（§5.4 `3` 类 ①只约束建立阶段）。
 */
function openSocket(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ path: socketPath, timeout: CONNECT_TIMEOUT_MS });
    let settled = false;
    socket.once('timeout', () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`connect timeout (>${CONNECT_TIMEOUT_MS}ms)`));
    });
    socket.once('connect', () => {
      if (settled) return;
      settled = true;
      socket.setTimeout(0);
      resolve(socket);
    });
    socket.once('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * 层 B 的 JSON-RPC 错误 → HubError（§5.4 `1` 类 ①：data.code 原样进 .code）。
 * 无 data.code 的数值码（-32601 等）按数值字符串落 .code —— SDK 内不建第二份协议码表（单一真源）。
 * .upstream 必带 error 键：上游 error 体是 {code,message,data}（无 error 键），而 serializeError 取 upstream.error。
 */
function toHubError(err) {
  if (!(err instanceof RpcError)) throw err; // 非协议错误（内部缺陷）原样抛出，不伪装成协议归类
  if (err.dataCode === 'REQUEST_TIMEOUT') {
    const { code, exitCode } = classify({ kind: 'response-timeout' });
    return new HubError({ code, error: err.message, exitCode });
  }
  const code = err.dataCode ?? String(err.code);
  return new HubError({ code, error: err.message, exitCode: EXIT_BUSINESS, upstream: { error: err.message, code } });
}

/**
 * 打开一个 Router UDS 会话（层 B 的库面入口，§5.2）。
 * @param {object} [opts]
 * @param {string} [opts.socketPath] 显式 socket 路径（优先；给出即不读 env、不解析配置）
 * @param {object} [opts.env]        缺省路径时交给 loadConfig 的环境（默认 process.env）
 * @param {(message: object) => void} [opts.onDeliver] 收到 message.deliver 时取消息的钩子（受理由调用方显式 ack()）
 * @returns {Promise<object>} 会话：9 个方法 + close()
 */
export async function connect(opts = {}) {
  const socketPath = await resolveSocketPath(opts);
  let socket;
  try {
    socket = await openSocket(socketPath);
  } catch (err) {
    throw unreachableError(socketPath, typeof err.code === 'string' ? err.code : err.message);
  }

  const onDeliver = typeof opts.onDeliver === 'function' ? opts.onDeliver : null;
  // 接收面（§2.2 流 2）：投递是**服务端→客户端的请求**，必须回传输应答，否则 Router 判投递失败
  // （回滚 pending、发件方收 AGENT_OFFLINE）。该应答是协议前提，不是生命周期自动性；受理（message.ack）
  // 一律由调用方在钩子里显式发出（零自动性不变）。
  const peer = new RpcPeer(socket, {
    idPrefix: 'hub',
    onRequest: (method, params, respond) => {
      if (method === 'message.deliver') {
        const message = params && params.message;
        if (!message || typeof message !== 'object' || typeof message.message_id !== 'string') {
          if (respond) respond.error(-32602, 'invalid deliver params', ERR.INVALID_MESSAGE);
          return;
        }
        if (respond) respond.ok({ received: true, message_id: message.message_id });
        if (onDeliver) onDeliver(message);
        return;
      }
      if (respond) respond.error(-32601, `method not found: ${method}`);
    },
  });

  // 身份载体：register 成功后由会话持有（registry 的身份校验取自 params，§4.4）；heartbeat / ack /
  // deregister 的 params 由会话合成（**会话身份值优先**，调用方自报的同名字段被覆盖）；send 与 router.* 不加身份。
  let identity = null;

  const request = async (method, params) => {
    try {
      return await peer.request(method, params, { timeoutMs: REQUEST_TIMEOUT_MS });
    } catch (err) {
      throw toHubError(err);
    }
  };

  return {
    /** agent.register → result 原对象（{instance_id, session_id, state, lease_timeout_ms, last_heartbeat, lease_follows_interval}）。 */
    async register(instanceId) {
      const result = await request('agent.register', { instance_id: instanceId });
      identity = { instance_id: result.instance_id, session_id: result.session_id };
      return result;
    },
    /** agent.heartbeat（通知语义：Router 不回帧 ⇒ 发无 id 的帧、不建 pending；单次方法，调度归调用方）。 */
    heartbeat(params) {
      peer.notify('agent.heartbeat', { ...params, ...identity });
    },
    /** message.send → result 原对象；params（含 message 信封）原样入帧。 */
    send(params) {
      return request('message.send', params);
    },
    /** message.ack → result 原对象；身份由会话合成。 */
    ack(params) {
      return request('message.ack', { ...params, ...identity });
    },
    /** router.status → {nodes:[…]}（任意连接可用，无需注册身份）。 */
    status() {
      return request('router.status', {});
    },
    /** router.task_get → {task}。 */
    taskGet(taskId) {
      return request('router.task_get', { task_id: taskId });
    },
    /** router.task_list → {tasks}；查询对象原样透传。 */
    taskList(query) {
      return request('router.task_list', query);
    },

    /** router.task_cancel → {task}；不校验调用方身份。 */
    taskCancel(taskId) {
      return request('router.task_cancel', { task_id: taskId });
    },
    /** agent.deregister → {removed:true}；身份由会话合成。 */
    deregister() {
      return request('agent.deregister', { ...identity });
    },
    /** 关闭连接（幂等）：RpcPeer.close() = 收敛 pending + socket.destroy()；关闭后无残留句柄。 */
    close() {
      peer.close();
    },
  };
}
