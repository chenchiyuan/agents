// test/helpers/fake-node.js — 脚本级假节点（architecture §10.1 / prd F07 / D12）
// = 复用 pr-002 src/node-client.js 的通用 NodeClient（与真实 CLI agent 同一协议实现，
//   杜绝"测试验证的协议 ≠ 产品用的协议"漂移）+ 脚本能力：
//     - onDeliver(msg) 断言钩子：记录 deliver + 返回 false 可跳过自动 ack
//       （deliver 受理与 ack 分离语义，§10.1"延迟 ack 以证明 deliver 与 ack 分离"）
//     - deliver 记录面（完整信封副本、顺序保真）供测试断言
//     - 可编程心跳间隔（省略则不心跳）
//     - 进程内直接运行（非子进程，快且确定）
// 不新建协议实现——一切协议行为委托 NodeClient（deliver 自动受理/自动 ack 在其内部）。

import { createClient } from '../../src/node-client.js';

/**
 * startFakeNode — 建一个假节点：connect → register → （可选）启动周期心跳。
 *
 * @param {object} opts
 * @param {string} opts.socketPath   Router UDS 路径（harness 每用例独立临时 socket）
 * @param {string} opts.instanceId   注册 instance_id
 * @param {number} [opts.heartbeatMs] 周期心跳间隔；省略/0 → 不启动心跳
 * @param {(msg: object) => (boolean | void | Promise<boolean | void>)} [opts.onDeliver]
 *   deliver 断言钩子（先于自动 ack 执行）：返回 false → 跳过自动 ack；返回其他/undefined → 默认自动受理。
 * @returns {Promise<object>} 句柄：
 *   { client, instanceId, sessionId, registered, received[], deliverCount, closeCount,
 *     send(to, message, opts), ack(messageId, opts), stop() }
 */
export async function startFakeNode({ socketPath, instanceId, heartbeatMs = null, onDeliver = null }) {
  const client = createClient({ socketPath });
  const node = {
    client,
    instanceId,
    sessionId: null,
    registered: null, // register 响应原样（instance_id/session_id/state/lease_timeout_ms/last_heartbeat）
    received: [], // deliver 完整信封记录（顺序保真）
    deliverCount: 0,
    closeCount: 0,
    stopped: false,
  };

  // deliver 受理钩子：记录 + 用户断言钩子（返回 false → 不自动 ack）
  client.onDeliver = (msg) => {
    node.received.push(msg);
    node.deliverCount += 1;
    if (typeof onDeliver === 'function') return onDeliver(msg);
    return undefined; // 默认 → NodeClient 自动 ack(accepted)
  };
  client.onClose = () => {
    node.closeCount += 1;
  };

  await client.connect();
  node.registered = await client.register(instanceId);
  node.sessionId = node.registered.session_id;
  if (heartbeatMs && heartbeatMs > 0) client.startHeartbeat(heartbeatMs);

  node.send = (toInstanceId, message, opts = {}) => client.send(toInstanceId, message, opts);
  node.ack = (messageId, opts = {}) => client.ack(messageId, opts);

  /** 优雅停：best-effort deregister（请求语义 ≤1s，D17）→ 关闭连接。不悬挂、幂等。 */
  node.stop = async () => {
    if (node.stopped) return;
    node.stopped = true;
    try {
      if (client.sessionId) await client.deregister();
    } catch {
      /* Router 已不在等 best-effort 场景：忽略 */
    }
    try {
      client.close();
    } catch {
      /* 忽略 */
    }
  };

  return node;
}
