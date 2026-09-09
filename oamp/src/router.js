// src/router.js — Router 进程：监听 / 方法分发 / 租约扫描 / 优雅退出（architecture §5 + §4.4 / D2/D7/D16）
// 职责：net.Server UDS 监听（mkdir .runtime → listen → chmod 0600 → ROUTER_READY 就绪行）；
// 每连接一个 RpcPeer，方法分发 7 方法（agent.* + message.* + router.status）；
// 连接身份反查/注册表/租约判定委托 registry.js；事件输出委托 log.js；
// SIGINT：打 ROUTER_STOPPING → 停扫描 → close 监听 → 断全部节点连接 → unlink socket → 退出 0；二次 SIGINT → 130。
// 入口 = default 导出函数（cli.js 调用约定：default(restArgs)，router start 无位置参数）。

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { RpcPeer, RpcError, ERR, JSONRPC_CODE } from './rpc.js';
import { createRegistry, isValidInstanceId, isValidMessageId, newSessionId } from './registry.js';
import { createEventLog } from './log.js';

function clampSweepPeriod(timeoutMs) {
  // D7：sweepPeriod = clamp(timeout/4, 20, 1000) ms
  return Math.max(20, Math.min(1000, Math.floor(timeoutMs / 4)));
}

const VALID_CONTENT_TYPES = new Set(['text/plain', 'text/markdown', 'application/json']);

/** §4.5 信封校验（send 侧子集，不含 from/created_at——Router 代填）。返回 null 或错误机器码。 */
function validateSendMessage(m) {
  if (!m || typeof m !== 'object') return ERR.INVALID_MESSAGE;
  if (m.protocol !== 'oamp/1') return ERR.INVALID_MESSAGE;
  if (!isValidMessageId(m.message_id)) return ERR.INVALID_MESSAGE;
  if (!m.to || typeof m.to !== 'object' || !isValidInstanceId(m.to.instance_id)) return ERR.INVALID_MESSAGE;
  const p = m.payload;
  if (!p || typeof p !== 'object' || !VALID_CONTENT_TYPES.has(p.content_type) || typeof p.body !== 'string') {
    return ERR.INVALID_MESSAGE;
  }
  return null;
}

export default async function startRouter(restArgs) {
  // config 校验失败 → 快速失败（§7.2 配置面：非法值 → 启动即报错退出）
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp: router start 失败: ${err.message}\n`);
    return 1;
  }

  const logger = createEventLog({ role: 'router', hbLogWindowMs: config.hbLogWindowMs });
  const registry = createRegistry();
  const socketPath = config.socketPath;

  // 建 .runtime 目录（产物唯一落点，§5.1/D2）；失败也交由 listen 报错
  try {
    fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  } catch {
    /* 忽略——listen 会给出真实错误 */
  }

  let server = null;
  let sweepTimer = null;
  let shuttingDown = false;

  const peersByConnId = new Map(); // connId -> { peer, socket }
  let connSeq = 0;

  function closeAllNodeConnections() {
    for (const { socket } of peersByConnId.values()) {
      try {
        socket.destroy();
      } catch {
        /* 忽略 */
      }
    }
    peersByConnId.clear();
  }

  function handleConnection(socket) {
    const connId = ++connSeq;
    const peer = new RpcPeer(socket, {
      onRequest: (method, params, respond) => dispatch(method, params, connId, respond),
      idPrefix: 'dlv',
    });
    peersByConnId.set(connId, { peer, socket });
    socket.on('close', () => {
      peersByConnId.delete(connId);
      registry.onConnClosed(connId);
    });
    socket.on('error', () => {
      /* close 收敛 */
    });
  }

  function sendError(respond, code, message) {
    if (respond) respond.error(JSONRPC_CODE.APP_ERROR, message, code);
  }

  /** 向目标连接发 deliver（同步代理，§4.4）——目标恒为自有 NodeClient，必应答。 */
  async function deliverTo(connId, message) {
    const holder = peersByConnId.get(connId);
    if (!holder) throw new RpcError('target offline', JSONRPC_CODE.APP_ERROR, ERR.AGENT_OFFLINE);
    return holder.peer.request('message.deliver', { message }, { timeoutMs: 5000 });
  }

  async function dispatch(method, params, connId, respond) {
    params = params || {};
    const ident = registry.identityOf(connId);

    switch (method) {
      case 'agent.register': {
        const instanceId = params.instance_id;
        if (!isValidInstanceId(instanceId)) {
          sendError(respond, ERR.INVALID_PARAMS, `invalid instance_id: ${String(instanceId).slice(0, 80)}`);
          return;
        }
        const now = Date.now();
        const sessionId = newSessionId();
        const { entry, replaced } = registry.register({ instanceId, sessionId, connId, now });
        if (replaced) {
          // D4/latest-wins：关旧连接（旧节点进程随即走 CONNECTION_LOST 退出路径）
          logger.event('AGENT_REPLACED', { instance: instanceId, old_session: replaced.session_id, new_session: sessionId });
          const oldHolder = peersByConnId.get(replaced.connId);
          if (oldHolder) {
            peersByConnId.delete(replaced.connId);
            try {
              oldHolder.socket.destroy();
            } catch {
              /* 忽略 */
            }
          }
        }
        logger.event('AGENT_REGISTERED', { instance: instanceId, session: sessionId, state: entry.state });
        if (respond) {
          respond.ok({
            instance_id: entry.instance_id,
            session_id: entry.session_id,
            state: entry.state,
            lease_timeout_ms: config.heartbeatTimeoutMs,
            last_heartbeat: entry.last_heartbeat,
          });
        }
        return;
      }

      case 'agent.heartbeat': {
        // 通知语义（无响应）；会话不匹配 live → 静默忽略（§4.6），事件日志不记录被忽略的旧会话心跳
        const updated = registry.heartbeat({
          instanceId: params.instance_id,
          sessionId: params.session_id,
          now: Date.now(),
        });
        if (updated) {
          // 心跳节流事件（§8.2：只节流 HEARTBEAT，每节点滑窗；registry 状态更新与日志节流解耦）
          logger.heartbeat({ instance: params.instance_id, session: params.session_id });
        }
        return;
      }

      case 'agent.deregister': {
        if (!ident) {
          sendError(respond, ERR.UNREGISTERED, 'connection not registered');
          return;
        }
        const { removed, error } = registry.deregister({ instanceId: params.instance_id, sessionId: params.session_id });
        if (error) {
          sendError(respond, error, `deregister failed: ${String(error).toLowerCase()}`);
          return;
        }
        logger.event('AGENT_DEREGISTERED', { instance: params.instance_id });
        if (respond) respond.ok({ removed: true });
        return;
      }

      case 'message.send': {
        // §4.4/§4.5 发送：同步单次代理
        if (!ident) {
          sendError(respond, ERR.UNREGISTERED, 'sender not registered');
          return;
        }
        const m = params.message || {};
        const invalid = validateSendMessage(m);
        if (invalid) {
          sendError(respond, ERR.INVALID_MESSAGE, 'invalid message envelope');
          return;
        }
        // from 不得自报（Router 代填；§4.5）
        if (m.from !== undefined && m.from !== null) {
          sendError(respond, ERR.INVALID_SENDER, 'sender must not set from');
          return;
        }
        const targetId = m.to.instance_id;
        const target = registry.getEntry(targetId);
        if (!target) {
          sendError(respond, ERR.AGENT_NOT_FOUND, `target not found: ${targetId}`);
          return;
        }
        if (target.state !== 'online' || target.connId === null) {
          sendError(respond, ERR.AGENT_OFFLINE, `target offline: ${targetId}`);
          return;
        }
        const full = {
          protocol: 'oamp/1',
          message_id: m.message_id,
          ...(m.type !== undefined ? { type: m.type } : {}),
          from: { instance_id: ident.instance_id, session_id: ident.session_id },
          to: { instance_id: targetId },
          payload: m.payload,
          created_at: new Date().toISOString(),
        };
        // Q-1 裁决（pr-004 跨 PR 修复）：pending 在投递前先记录——目标自动受理的 ack 可能与 deliver
        // 响应同 chunk 到达 Router，若 await deliverTo 后才记 pending，ack 会先于 pending 被处理 →
        // UNKNOWN_MESSAGE（ack 校验锚点缺失，§5.5）；前置记录保证 ack 恒可关联。
        // 重复 message_id 仍按 Map 覆盖（D11 无去重状态机语义不变）。
        registry.recordPendingDelivery({
          messageId: full.message_id,
          toInstance: targetId,
          toSession: target.session_id,
        });
        try {
          await deliverTo(target.connId, full);
        } catch (err) {
          // 投递失败：回滚本次刚记录的 pending（不留脏）；发送方收 AGENT_OFFLINE（§4.6 send）
          registry.clearPendingDelivery(full.message_id);
          sendError(respond, ERR.AGENT_OFFLINE, `deliver failed: target offline (${targetId})`);
          return;
        }
        logger.event('MESSAGE_DELIVERED', { message_id: full.message_id, from: ident.instance_id, to: targetId });
        if (respond) respond.ok({ accepted: true, message_id: full.message_id, status: 'delivered' });
        return;
      }

      case 'message.ack': {
        if (!ident) {
          sendError(respond, ERR.UNREGISTERED, 'acker not registered');
          return;
        }
        const { acked, error } = registry.resolvePendingAck({
          messageId: params.message_id,
          instanceId: params.instance_id,
          sessionId: params.session_id,
          status: params.status,
        });
        if (error) {
          sendError(respond, error, `ack failed: ${String(error).toLowerCase()}`);
          return;
        }
        logger.event('MESSAGE_ACKED', { message_id: params.message_id, instance: ident.instance_id });
        if (respond) respond.ok({ acked: true, status: 'accepted' });
        return;
      }

      case 'router.status': {
        // §4.4：任意连接可用（无需注册身份），4 字段快照按 instance_id 排序
        if (respond) respond.ok({ nodes: registry.snapshot() });
        return;
      }

      default: {
        if (respond) respond.error(JSONRPC_CODE.METHOD_NOT_FOUND, `method not found: ${method}`);
        return;
      }
    }
  }

  // —— 就绪/启动（§5.1） ——
  let readyResolve = null;
  let readyReject = null;
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function createServer() {
    const srv = net.createServer(handleConnection);
    srv.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        readyReject(err);
        return;
      }
      // EADDRINUSE：connect 探测区分活 Router 与陈旧文件（§5.1）
      const probe = net.connect(socketPath);
      let done = false;
      const finish = (alive) => {
        if (done) return;
        done = true;
        clearTimeout(probeTimer);
        probe.destroy();
        if (alive) {
          readyReject(new Error('ROUTER_ALREADY_RUNNING'));
        } else {
          // 陈旧文件 → unlink 后重试一次
          try {
            fs.unlinkSync(socketPath);
          } catch {
            /* ENOENT 忽略 */
          }
          server = createServer();
          server.listen(socketPath, () => readyResolve());
        }
      };
      const probeTimer = setTimeout(() => finish(false), 200);
      probe.once('connect', () => finish(true));
      probe.once('error', () => finish(false));
    });
    return srv;
  }

  server = createServer();
  server.listen(socketPath, () => readyResolve());

  try {
    await readyPromise;
  } catch (err) {
    const msg = err && err.message;
    if (msg && msg === 'ROUTER_ALREADY_RUNNING') {
      process.stderr.write(`oamp: router start 失败: ${socketPath} 已被活 Router 占用（ROUTER_ALREADY_RUNNING）\n`);
    } else {
      process.stderr.write(`oamp: router start 失败: ${msg || err}\n`);
    }
    return 1;
  }

  try {
    fs.chmodSync(socketPath, 0o600);
  } catch (err) {
    process.stderr.write(`oamp: router start 失败: chmod 0600 失败: ${err.message}\n`);
    try {
      server.close();
      fs.unlinkSync(socketPath);
    } catch {
      /* 忽略 */
    }
    return 1;
  }

  logger.event('ROUTER_READY', { socket: socketPath });

  // 租约主动扫描（D7）——判定逻辑在 registry（纯函数），此处只做时钟、断连与事件
  const sweepPeriodMs = clampSweepPeriod(config.heartbeatTimeoutMs);
  sweepTimer = setInterval(() => {
    if (shuttingDown) return;
    const now = Date.now();
    const expired = registry.findExpired(now, config.heartbeatTimeoutMs);
    for (const instanceId of expired) {
      const { changed, connId } = registry.markOffline(instanceId, now);
      if (!changed) continue;
      if (connId !== null) {
        const holder = peersByConnId.get(connId);
        if (holder) {
          peersByConnId.delete(connId);
          try {
            holder.socket.destroy();
          } catch {
            /* 忽略 */
          }
        }
      }
      logger.event('AGENT_OFFLINE', { instance: instanceId });
    }
  }, sweepPeriodMs);

  // 优雅退出（D16）：二次 SIGINT → 130
  function shutdown() {
    if (shuttingDown) {
      process.exit(130);
    }
    shuttingDown = true;
    logger.event('ROUTER_STOPPING');
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
    try {
      server.close();
    } catch {
      /* 忽略 */
    }
    closeAllNodeConnections();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* ENOENT 忽略 */
    }
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Router 长驻前台：挂起直至退出（退出路径走 process.exit/信号）
  return await new Promise(() => {});
}
