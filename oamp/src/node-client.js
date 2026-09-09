// src/node-client.js — 通用节点客户端（architecture §6.1/§6.2/§6.4 / D12）
// 唯一协议客户端实现，同时服务：真实 CLI agent（oamp agent start）、pr-004 契约测试假节点。
// register（请求，2s 上限）/ heartbeat（周期通知）/ deregister（请求，1s 上限）/
// send/ack + deliver 自动受理（默认：校验 → 回传输应答 {received:true} → 自动 ack accepted）。
// 断线即退不重连（N1/N7）：socket 关闭/错误 → onClose 回调，由 agent 层打 CONNECTION_LOST 退出。

import net from 'node:net';
import { RpcPeer, RpcError, ERR } from './rpc.js';

const DEFAULT_CONNECT_TIMEOUT_MS = 2000;

export class NodeClient {
  /**
   * @param {object} opts
   * @param {string} opts.socketPath   UDS 路径
   * @param {object} [opts.logger]     createEventLog 实例（agent 侧事件输出；缺省静默）
   * @param {number} [opts.connectTimeoutMs]
   * @param {number} [opts.registerTimeoutMs=2000]  register 响应上限（D17）
   * @param {number} [opts.deregisterTimeoutMs=1000] deregister 响应上限（D17）
   */
  constructor({ socketPath, logger = null, connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS, registerTimeoutMs = 2000, deregisterTimeoutMs = 1000 }) {
    this.socketPath = socketPath;
    this.logger = logger;
    this.connectTimeoutMs = connectTimeoutMs;
    this.registerTimeoutMs = registerTimeoutMs;
    this.deregisterTimeoutMs = deregisterTimeoutMs;

    this.socket = null;
    this.peer = null;
    this.instanceId = null;
    this.sessionId = null;
    this._hbTimer = null;
    this._closed = false;
    this.onClose = null; // (err) => void；断线通知（agent 层据此退出）
    this.onDeliver = null; // (message) => Promise|false|void；deliver 受理钩子
  }

  /** 建立 UDS 连接并初始化 peer。失败 reject（ECONNREFUSED/ENOENT 等由调用方呈现）。 */
  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.connect(this.socketPath);
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new RpcError(`connect timeout: ${this.socketPath}`, -32000, 'CONNECT_TIMEOUT'));
        }
      }, this.connectTimeoutMs);
      socket.once('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.socket = socket;
        this.peer = new RpcPeer(socket, {
          onRequest: (method, params, respond) => this._handleIncoming(method, params, respond),
          idPrefix: 'cli',
        });
        socket.on('close', () => this._handleClose());
        socket.on('error', () => {
          /* close 收敛 */
        });
        resolve(this);
      });
      socket.once('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  _handleIncoming(method, params, respond) {
    if (method === 'message.deliver') {
      // §6.4 deliver 自动受理：校验 → 回 {received:true} → 随即自动 ack(accepted)
      const message = params && params.message;
      if (!message || typeof message !== 'object' || typeof message.message_id !== 'string') {
        if (respond) respond.error(-32602, 'invalid deliver params', ERR.INVALID_MESSAGE);
        return;
      }
      this._log('MSG_RECEIVED', {
        message_id: message.message_id,
        from: (message.from && message.from.instance_id) ?? '',
        size: message.payload && message.payload.body !== undefined ? String(message.payload.body).length : 0,
      });
      // 传输应答先行（Router send 同步代理依赖它完成，§4.4）
      if (respond) respond.ok({ received: true, message_id: message.message_id });
      // 自动受理：默认立即 ack(accepted)；onDeliver 钩子（pr-004 假节点）可记录/校验/延迟，
      // 钩子返回 false 时跳过自动 ack（证明 deliver 与 ack 分离，D12）。
      const run = async () => {
        let proceed = true;
        if (typeof this.onDeliver === 'function') {
          const r = this.onDeliver(message);
          const out = r && typeof r.then === 'function' ? await r : r;
          proceed = out !== false;
        }
        if (proceed) {
          try {
            await this.ack(message.message_id, { status: 'accepted' });
          } catch {
            /* ack 失败（连接已断等）静默：best-effort 受理 */
          }
        }
      };
      run().catch(() => {});
      return;
    }
    if (respond) respond.error(-32601, `method not found: ${method}`);
  }

  _log(eventName, fields) {
    if (this.logger && typeof this.logger.event === 'function') {
      this.logger.event(eventName, fields);
    }
  }

  _handleClose() {
    if (this._closed) return;
    this._closed = true;
    this._stopHeartbeat();
    if (typeof this.onClose === 'function') {
      this.onClose(new RpcError('connection lost', -32000, ERR.AGENT_OFFLINE));
    }
  }

  _assertPeer() {
    if (!this.peer || this._closed) {
      throw new RpcError('not connected', -32000, ERR.AGENT_OFFLINE);
    }
  }

  /** agent.register（请求）。成功返回 Router result {instance_id, session_id, state, lease_timeout_ms, last_heartbeat}。 */
  async register(instanceId) {
    this._assertPeer();
    const result = await this.peer.request('agent.register', { instance_id: instanceId }, { timeoutMs: this.registerTimeoutMs });
    this.instanceId = result.instance_id;
    this.sessionId = result.session_id;
    return result;
  }

  /** 周期心跳（通知，无响应）。 */
  startHeartbeat(intervalMs) {
    this._stopHeartbeat();
    const tick = () => {
      try {
        this._assertPeer();
        this.peer.notify('agent.heartbeat', { instance_id: this.instanceId, session_id: this.sessionId });
      } catch {
        this._stopHeartbeat();
      }
    };
    tick(); // 注册后立即一跳，推进 last_heartbeat
    this._hbTimer = setInterval(tick, intervalMs);
    if (this._hbTimer.unref) this._hbTimer.unref();
  }

  _stopHeartbeat() {
    if (this._hbTimer) {
      clearInterval(this._hbTimer);
      this._hbTimer = null;
    }
  }

  /** 停周期心跳（agent 优雅退出路径调用）。 */
  stopHeartbeat() {
    this._stopHeartbeat();
  }

  /** agent.deregister（请求，best-effort ≤1s）。 */
  async deregister() {
    this._assertPeer();
    const result = await this.peer.request(
      'agent.deregister',
      { instance_id: this.instanceId, session_id: this.sessionId },
      { timeoutMs: this.deregisterTimeoutMs },
    );
    return result;
  }

  /** message.send（请求）— 客户端库保留方法（真实 agent 无 CLI 入口；pr-004 假节点测试驱动）。 */
  async send(toInstanceId, message, opts = {}) {
    this._assertPeer();
    return this.peer.request(
      'message.send',
      { message: { ...message, to: { instance_id: toInstanceId } } },
      { timeoutMs: opts.timeoutMs || 5000 },
    );
  }

  /** message.ack（请求）— 自动受理/假节点断言用。 */
  async ack(messageId, { status = 'accepted', receivedAt } = {}) {
    this._assertPeer();
    return this.peer.request(
      'message.ack',
      {
        message_id: messageId,
        instance_id: this.instanceId,
        session_id: this.sessionId,
        status,
        received_at: receivedAt || new Date().toISOString(),
      },
      { timeoutMs: this.deregisterTimeoutMs },
    );
  }

  /** 主动关闭（agent 优雅退出路径调用；不触发 onClose 语义）。 */
  close() {
    this._closed = true;
    this._stopHeartbeat();
    if (this.peer) this.peer.close();
    this.peer = null;
  }
}

export function createClient(opts) {
  return new NodeClient(opts);
}
