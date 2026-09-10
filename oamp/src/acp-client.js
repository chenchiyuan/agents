// src/acp-client.js — 一个常驻 `omp acp` 子进程的按行 JSON-RPC 2.0 封装（architecture §6.5/§6.6 / AR-16）
// 职责：spawn/初始化序列（initialize → session/new → 等静默）/多轮 session/prompt 流式/model 切换/cancel/kill。
// 不持有键与队列（那是 context-pool 的职责）；上下文真源 = 该子进程内存中的 ACP session（V-1/V-8）：
// 同 session 多轮累积，进程消亡即上下文消失。
// 错误码（AcpError.code，供池层/agent 映射为 task.result.error）：
//   context_crashed（spawn/初始化失败、子进程异常退出、被主动 kill）、model_unavailable（set_config_option 被拒）、
//   timeout（prompt 超时：cancel → 宽限 → kill）。

import { spawn } from 'node:child_process';

const PROTOCOL_VERSION = 1;
const INIT_QUIET_MS = 300; // §6.6：初始化等待静默窗口（无通知 ≥300ms 视为稳定）
const INIT_MAX_MS = 5000; // §6.6：初始化等待硬上限
const REQUEST_TIMEOUT_MS = 10000; // initialize/session/new/set_config_option 的请求上限
const CANCEL_GRACE_MS = 2000; // §6.5：session/cancel 后等 stopReason 的宽限
const KILL_GRACE_MS = 500; // §6.5：SIGTERM → SIGKILL 宽限（沿用 0010 kill 模式）

/** 等待 ms 毫秒（超时宽限等场景）；计时器 unref，不阻滞进程退出。 */
const delay = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
export class AcpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AcpError';
    this.code = code;
  }
}

/**
 * 读 ACP session 配置里的模型生效值（§7.4 审计面：model 取自 `currentValue`，不是请求回显）。
 * 实测 omp 18.0.11 的 `session/new` / `session/set_config_option` 返回 **数组**形态
 * （`configOptions: [{id, category, currentValue, options}]`）；对象形态 `{model:{currentValue}}` 一并兼容。
 * 读不到 → null（调用方不得用请求参数冒充生效模型）。
 */
function readCurrentModel(result) {
  const options = result && result.configOptions;
  const value = Array.isArray(options)
    ? options.find((option) => option && option.id === 'model')?.currentValue
    : options && options.model && options.model.currentValue;
  return typeof value === 'string' && value !== '' ? value : null;
}

export class AcpClient {
  /**
   * @param {object} opts
   * @param {string} opts.bin            omp 可执行（OAMP_OMP_BIN || 'omp'）
   * @param {string|null} [opts.model]   首轮模型（随进程 --model；空则不传，由 omp 自身默认决定）
   * @param {string} [opts.cwd]          子进程 cwd（= session/new 的 cwd）
   * @param {object|null} [opts.logger]  createEventLog 实例（可选）
   * @param {function|null} [opts.onExit] 异常退出回调（主动 kill/dispose 不触发）
   */
  constructor({ bin, model = null, cwd = process.cwd(), logger = null, onExit = null }) {
    this.bin = bin;
    this.modelArg = model;
    this.cwd = cwd;
    this.logger = logger;
    this.onExit = onExit;

    this.child = null;
    this.pid = null;
    this.sessionId = null;
    this.currentModel = null;
    this.dead = false; // 子进程已消失（异常或主动）
    this.disposed = false; // 主动 kill/dispose

    this._nextId = 0;
    this._pending = new Map(); // id -> { resolve, reject, timer, errorCode }
    this._buf = '';
    this._onAnyMessage = null;
    this._chunkHandler = null;
    this._killTimer = null;
  }

  /** 启动子进程并完成初始化（initialize → session/new → 等静默）。失败即 kill 并抛 AcpError。 */
  async start() {
    const args = ['acp', '--no-skills', '--no-rules', '--no-tools', '--no-session'];
    if (this.modelArg) args.push('--model', this.modelArg);
    const child = spawn(this.bin, args, { cwd: this.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    this.pid = child.pid;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => this._onData(d));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => {
      if (this.logger) this.logger.event('ACP_STDERR', { pid: this.pid, line: String(d).trim().slice(0, 500) });
    });
    child.on('error', (err) => this._onProcessGone(`子进程错误: ${err && err.message ? err.message : err}`));
    child.on('close', (code, signal) => this._onProcessGone(`子进程退出 code=${code} signal=${signal || ''}`));

    try {
      await this._request('initialize', { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
      const created = await this._request('session/new', { cwd: this.cwd, mcpServers: [] });
      this.sessionId = created && typeof created.sessionId === 'string' ? created.sessionId : null;
      if (!this.sessionId) throw new AcpError('context_crashed', 'session/new 未返回 sessionId');
      this.currentModel = readCurrentModel(created);
      await this._waitQuiescence();
    } catch (err) {
      this.kill();
      throw err instanceof AcpError
        ? new AcpError('context_crashed', `ACP 初始化失败: ${err.message}`)
        : new AcpError('context_crashed', `ACP 初始化失败: ${err && err.message ? err.message : err}`);
    }
    if (this.logger) this.logger.event('ACP_READY', { pid: this.pid, session: this.sessionId, model: this.currentModel || '' });
    return this;
  }

  /**
   * 一轮提示：模型对齐（不同则 set_config_option，失败即 model_unavailable，不回退）→ session/prompt 流式。
   * @param {string} text
   * @param {object} opts
   * @param {string|null} [opts.model]     本轮目标模型（未给则沿用启动/当前模型）
   * @param {number} [opts.timeoutMs]      本轮上限，超时即 cancel → 宽限 → kill
   * @param {function|null} [opts.onChunk] 增量文本回调（逐块）
   * @returns {Promise<{text:string, model:string|null, stop_reason:*, usage:*, pid:number}>}
   */
  async prompt(text, { model = null, timeoutMs = 300000, onChunk = null } = {}) {
    if (this.dead) throw new AcpError('context_crashed', '子进程已退出');
    if (!this.sessionId) throw new AcpError('context_crashed', 'session 未建立');
    const target = model || this.modelArg || this.currentModel;
    if (target && this.currentModel !== target) {
      await this.setModel(target); // 失败 → model_unavailable（§7.3，绝不静默回退）
    }

    let acc = '';
    this._chunkHandler = (params) => {
      const update = params && params.update;
      if (!update || update.sessionUpdate !== 'agent_message_chunk') return;
      const content = update.content;
      if (!content || content.type !== 'text' || typeof content.text !== 'string') return;
      acc += content.text;
      if (onChunk) onChunk(content.text);
    };
    try {
      const result = await this._request(
        'session/prompt',
        { sessionId: this.sessionId, prompt: [{ type: 'text', text }] },
        {
          timeoutMs,
          // §6.5 prompt 超时：① session/cancel → ② 等 ≤2s 收 stopReason → ③ 仍未收尾则 kill 进程
          onTimeout: async () => {
            this.cancel();
            await delay(CANCEL_GRACE_MS);
            this.kill();
          },
        },
      );
      return {
        text: acc,
        model: this.currentModel,
        stop_reason: result && result.stopReason,
        usage: result && result.usage,
        pid: this.pid,
      };
    } finally {
      this._chunkHandler = null;
    }
  }

  /** session/set_config_option（模型是 session 级设置：切换不重建进程、不清空上下文，V-6/V-8）。 */
  async setModel(value) {
    const result = await this._request(
      'session/set_config_option',
      { sessionId: this.sessionId, configId: 'model', value },
      { errorCode: 'model_unavailable' },
    );
    const next = readCurrentModel(result);
    if (next) this.currentModel = next;
    return this.currentModel;
  }

  /** session/cancel 通知（无响应）。 */
  cancel() {
    try {
      this._write({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sessionId } });
    } catch {
      /* 子进程已不可写：忽略 */
    }
  }

  /** 主动终止：SIGTERM → 500ms 未退则 SIGKILL（§6.5 释放/关闭）。幂等；不触发 onExit。 */
  kill() {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.child || this.dead) return;
    try {
      this.child.stdin.end();
    } catch {
      /* 已关闭 */
    }
    try {
      this.child.kill('SIGTERM');
    } catch {
      /* 已退出 */
    }
    this._killTimer = setTimeout(() => {
      try {
        this.child.kill('SIGKILL');
      } catch {
        /* 已退出 */
      }
    }, KILL_GRACE_MS);
    this._killTimer.unref?.();
  }

  /** 池层释放语义别名（§6.4 SIGINT → pool.dispose()）。 */
  dispose() {
    this.kill();
  }

  /** 发一行 JSON-RPC 请求；超时（可选 onTimeout 收尾）或以 errorCode 回绝。 */
  _request(method, params, { timeoutMs = REQUEST_TIMEOUT_MS, onTimeout = null, errorCode = 'context_crashed' } = {}) {
    if (this.dead) return Promise.reject(new AcpError('context_crashed', '子进程已退出'));
    return new Promise((resolve, reject) => {
      const id = ++this._nextId;
      const timer = setTimeout(() => {
        if (!this._pending.has(id)) return;
        this._pending.delete(id);
        reject(new AcpError('timeout', `${method} 超时（${timeoutMs}ms）`));
        if (onTimeout) Promise.resolve(onTimeout()).catch(() => {});
      }, timeoutMs);
      timer.unref?.();
      this._pending.set(id, { resolve, reject, timer, errorCode });
      try {
        this._write({ jsonrpc: '2.0', id, method, params });
      } catch (err) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(err instanceof AcpError ? err : new AcpError('context_crashed', String(err && err.message ? err.message : err)));
      }
    });
  }

  _write(message) {
    if (!this.child || this.dead || !this.child.stdin || this.child.stdin.destroyed) {
      throw new AcpError('context_crashed', 'ACP stdin 不可写');
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  _onData(chunk) {
    this._buf += chunk;
    let idx;
    while ((idx = this._buf.indexOf('\n')) >= 0) {
      const line = this._buf.slice(0, idx).trim();
      this._buf = this._buf.slice(idx + 1);
      if (line === '') continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        if (this.logger) this.logger.event('ACP_BAD_FRAME', { pid: this.pid, line: line.slice(0, 200) });
        continue;
      }
      this._handleMessage(message);
    }
  }

  _handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (this._onAnyMessage) this._onAnyMessage(); // 初始化静默窗口：任何消息都重置计时
    if (message.id !== undefined && message.id !== null) {
      const entry = this._pending.get(message.id);
      if (!entry) return;
      this._pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) {
        const detail = message.error.message || JSON.stringify(message.error);
        entry.reject(new AcpError(entry.errorCode, `ACP error: ${detail}`));
      } else {
        entry.resolve(message.result);
      }
      return;
    }
    if (typeof message.method === 'string' && this._chunkHandler) this._chunkHandler(message.params);
  }

  /** §6.6：session/new 后等静默——无任何通知 ≥300ms 即稳定，硬上限 5s。 */
  _waitQuiescence() {
    return new Promise((resolve) => {
      let quiet = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(quiet);
        clearTimeout(hard);
        this._onAnyMessage = null;
        resolve();
      };
      const hard = setTimeout(finish, INIT_MAX_MS);
      hard.unref?.();
      this._onAnyMessage = () => {
        clearTimeout(quiet);
        quiet = setTimeout(finish, INIT_QUIET_MS);
        quiet.unref?.();
      };
      quiet = setTimeout(finish, INIT_QUIET_MS);
    });
  }

  /** 子进程消失（异常或主动）：回绝在飞请求；非主动场景通知池层。 */
  _onProcessGone(reason) {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this._killTimer);
    const err = new AcpError('context_crashed', reason);
    for (const [, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this._pending.clear();
    if (!this.disposed && typeof this.onExit === 'function') this.onExit(err);
  }
}
