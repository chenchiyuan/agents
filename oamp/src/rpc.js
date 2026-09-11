// src/rpc.js — NDJSON 帧 + JSON-RPC 2.0 对端（architecture §4.1~4.3 / D13）
// 一条 UDS 连接 = 一个 RpcPeer：双向逐行 NDJSON，请求/通知/响应/错误。
// 零第三方依赖；Router 服务端（每连接一个 peer）与 NodeClient/status 客户端共用。

export const MAX_FRAME_BYTES = 1024 * 1024; // §4.1 单帧上限 1 MiB

// §4.3 应用错误机器码（应用错误统一 JSON-RPC error.code=-32000，机器码放 data.code）
export const ERR = Object.freeze({
  UNREGISTERED: 'UNREGISTERED',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_OFFLINE: 'AGENT_OFFLINE',
  STALE_SESSION: 'STALE_SESSION',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_SENDER: 'INVALID_SENDER',
  UNKNOWN_MESSAGE: 'UNKNOWN_MESSAGE',
  INVALID_ACK_STATUS: 'INVALID_ACK_STATUS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  ROUTER_ALREADY_RUNNING: 'ROUTER_ALREADY_RUNNING',
  INVALID_PARAMS: 'INVALID_PARAMS',
});

// §4.2 JSON-RPC 标准错误码 + 应用错误统一码
export const JSONRPC_CODE = Object.freeze({
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  APP_ERROR: -32000,
});

const ID_EXTRACT_RE = /"id"\s*:\s*"([^"]+)"/;

export class RpcError extends Error {
  constructor(message, code = JSONRPC_CODE.APP_ERROR, dataCode) {
    super(message);
    this.name = 'RpcError';
    this.code = code; // JSON-RPC 数值码
    this.dataCode = dataCode; // §4.3 机器码（data.code）
  }
}

function makeErrorBody(err) {
  const body = { code: JSONRPC_CODE.APP_ERROR, message: err.message || String(err) };
  const dataCode = err.dataCode;
  if (dataCode) body.data = { code: dataCode };
  else if (err.data) body.data = err.data;
  return body;
}

/**
 * RpcPeer — 包住一个已连接 duplex（UDS socket）的 JSON-RPC 对端。
 * 传入 onRequest 时作为服务端/接收方使用；不传则纯客户端（仅发请求/收响应）。
 * 请求：this.request(method, params, {timeoutMs}) → Promise<result>
 * 通知：this.notify(method, params)
 * 服务端收到请求时回调 onRequest(method, params, respond)，respond.ok(result)/respond.error(code,message,dataCode)
 */
export class RpcPeer {
  constructor(socket, { onRequest = null, idPrefix = 'rpc' } = {}) {
    this.socket = socket;
    this.onRequest = onRequest;
    this.idPrefix = idPrefix;
    this._seq = 0;
    this._buf = '';
    this._pending = new Map(); // id -> {resolve, reject, timer}
    this._closed = false;

    socket.setEncoding('utf8');
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', () => {
      // 连接级错误统一由 close 收敛处理（拒掉全部 pending、通知上层）
    });
  }

  get closed() {
    return this._closed;
  }

  _nextId() {
    this._seq += 1;
    return `${this.idPrefix}-${this._seq}`;
  }

  _onData(chunk) {
    this._buf += chunk;
    let nl;
    while ((nl = this._buf.indexOf('\n')) >= 0) {
      const line = this._buf.slice(0, nl);
      this._buf = this._buf.slice(nl + 1);
      if (line.length === 0) continue;
      this._handleLine(line);
    }
    if (this._buf.length > MAX_FRAME_BYTES) {
      // 无换行的超长残帧：按帧上限处置（丢弃，若可提取 id 则回 LIMIT_EXCEEDED）
      const oversized = this._buf;
      this._buf = '';
      const m = ID_EXTRACT_RE.exec(oversized);
      if (m) {
        this._sendRaw({
          jsonrpc: '2.0',
          id: m[1],
          error: { code: JSONRPC_CODE.APP_ERROR, message: 'frame exceeds limit', data: { code: ERR.LIMIT_EXCEEDED } },
        });
      }
    }
  }

  _handleLine(line) {
    if (line.length > MAX_FRAME_BYTES) {
      // §4.1 单帧超限：丢弃并回错误（能解析到 id 才回）
      const m = ID_EXTRACT_RE.exec(line.slice(0, MAX_FRAME_BYTES + 64));
      if (m) {
        this._sendRaw({
          jsonrpc: '2.0',
          id: m[1],
          error: { code: JSONRPC_CODE.APP_ERROR, message: 'frame exceeds limit', data: { code: ERR.LIMIT_EXCEEDED } },
        });
      }
      return;
    }
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      // §4.1 解析失败：-32700 PARSE_ERROR；无 id 的坏帧静默丢弃
      const m = ID_EXTRACT_RE.exec(line);
      if (m) {
        this._sendRaw({ jsonrpc: '2.0', id: m[1], error: { code: JSONRPC_CODE.PARSE_ERROR, message: 'parse error' } });
      }
      return;
    }
    if (msg === null || typeof msg !== 'object') {
      if (msg !== null && typeof msg.id !== 'undefined') {
        this._sendRaw({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: JSONRPC_CODE.INVALID_REQUEST, message: 'invalid request' },
        });
      }
      return;
    }
    if (typeof msg.method === 'string') {
      // 请求（有 id）或通知（无 id）
      const params = msg.params === undefined ? {} : msg.params;
      const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
      if (hasId) {
        if (typeof this.onRequest !== 'function') {
          // 纯客户端收到服务器反向请求：不支持 → METHOD_NOT_FOUND
          this._sendRaw({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: JSONRPC_CODE.METHOD_NOT_FOUND, message: 'method not found' },
          });
          return;
        }
        const respond = {
          ok: (result) => this._sendRaw({ jsonrpc: '2.0', id: msg.id, result }),
          error: (code, message, dataCode) => {
            const errBody = { code, message };
            if (dataCode) errBody.data = { code: dataCode };
            this._sendRaw({ jsonrpc: '2.0', id: msg.id, error: errBody });
          },
        };
        try {
          const maybe = this.onRequest(msg.method, params, respond);
          if (maybe && typeof maybe.catch === 'function') {
            maybe.catch((err) => {
              const body = makeErrorBody(err);
              this._sendRaw({ jsonrpc: '2.0', id: msg.id, error: body });
            });
          }
        } catch (err) {
          const body = makeErrorBody(err);
          this._sendRaw({ jsonrpc: '2.0', id: msg.id, error: body });
        }
      } else {
        // 通知
        if (typeof this.onRequest === 'function') {
          try {
            const maybe = this.onRequest(msg.method, params, null);
            if (maybe && typeof maybe.catch === 'function') maybe.catch(() => {});
          } catch {
            /* 通知无响应通道，处理异常仅吞掉 */
          }
        }
      }
      return;
    }
    // 响应（有 id、无 method）——匹配请求方 pending
    if (Object.prototype.hasOwnProperty.call(msg, 'id')) {
      const p = this._pending.get(msg.id);
      if (p) {
        this._pending.delete(msg.id);
        if (p.timer) clearTimeout(p.timer);
        if (msg.error !== undefined && msg.error !== null) {
          const err = new RpcError(
            (msg.error.message) || 'rpc error',
            typeof msg.error.code === 'number' ? msg.error.code : JSONRPC_CODE.APP_ERROR,
            msg.error.data && msg.error.data.code,
          );
          p.reject(err);
        } else {
          p.resolve(msg.result);
        }
      }
      return;
    }
    // 无法归类且无 id：静默忽略（§4.2 非法请求但无关联对象）
  }

  _sendRaw(obj) {
    if (this._closed) return false;
    try {
      this.socket.write(`${JSON.stringify(obj)}\n`);
      return true;
    } catch {
      return false;
    }
  }

  request(method, params, { timeoutMs = 0 } = {}) {
    if (this._closed) {
      return Promise.reject(new RpcError('connection closed', JSONRPC_CODE.APP_ERROR, ERR.AGENT_OFFLINE));
    }
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this._pending.delete(id);
          reject(new RpcError(`request timeout (${method})`, JSONRPC_CODE.APP_ERROR, 'REQUEST_TIMEOUT'));
        }, timeoutMs);
      }
      this._pending.set(id, { resolve, reject, timer });
      if (!this._sendRaw({ jsonrpc: '2.0', id, method, params: params === undefined ? {} : params })) {
        this._pending.delete(id);
        if (timer) clearTimeout(timer);
        reject(new RpcError('connection closed', JSONRPC_CODE.APP_ERROR, ERR.AGENT_OFFLINE));
      }
    });
  }

  notify(method, params) {
    this._sendRaw({ jsonrpc: '2.0', method, params: params === undefined ? {} : params });
  }

  _onClose() {
    if (this._closed) return;
    this._closed = true;
    for (const p of this._pending.values()) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(new RpcError('connection closed', JSONRPC_CODE.APP_ERROR, ERR.AGENT_OFFLINE));
    }
    this._pending.clear();
  }

  close() {
    if (this._closed) return;
    this._onClose();
    this.socket.destroy();
  }
}
