// src/context-pool.js — 按 chat 维度持有的常驻上下文池（architecture §6.1~§6.5 / AR-11 / AR-12）
// 键 = (chat_id, agent_id)：一个键 = 一个常驻 `omp acp` 子进程 + 一个 ACP session（agent_id 由进程身份隐含）。
// 同键 FIFO 串行（单 in-flight + 队列上限 8，超出 context_busy）；异键完全并发；
// 全局上限 max（config.contextMax）→ LRU 淘汰；release(chatId) 释放该 chat 全部键；dispose() 全部回收。
// 上下文只是运行期状态：进程消亡（崩溃/淘汰/释放）即失忆，向发起者发 notice 告知（§6.3，不入库）。

import { AcpClient, AcpError } from './acp-client.js';

const QUEUE_LIMIT = 8; // §6.2：同键队列上限（等待中的轮次数），超出立即 context_busy

const RESET_TEXT = '上下文已重置，本对话后续回复不再记得此前内容';
const RELEASED_TEXT = '对话已关闭，上下文已释放';

export class ContextPool {
  /**
   * @param {object} opts
   * @param {number} [opts.max]            全局键上限（config.contextMax）
   * @param {string} opts.bin              omp 可执行（OAMP_OMP_BIN || 'omp'）
   * @param {string} [opts.cwd]            子进程 cwd
   * @param {object|null} [opts.logger]    createEventLog 实例（可选）
   * @param {function|null} [opts.onNotice] ({chatId, kind, text, origin}) => void；上下文事件提示出口
   */
  constructor({ max = 8, bin, cwd = process.cwd(), logger = null, onNotice = null }) {
    this.max = max;
    this.bin = bin;
    this.cwd = cwd;
    this.logger = logger;
    this.onNotice = onNotice;
    this.sessions = new Map(); // key -> ContextSession；Map 迭代序 = LRU 序（取用后重新 set 置尾）
    this._generation = 0;
  }

  /** 取键（不存在则懒创建）；同键命中即标记为最近使用（LRU 尾部）。 */
  getOrCreate(chatId, agentId, { origin = null } = {}) {
    const key = `${chatId}::${agentId}`;
    let session = this.sessions.get(key);
    if (!session) {
      this._evictIfNeeded();
      session = new ContextSession({ key, chatId, agentId, generation: ++this._generation, pool: this });
      this.sessions.set(key, session);
    } else {
      this.sessions.delete(key);
      this.sessions.set(key, session);
    }
    if (origin) session.lastOrigin = origin;
    return session;
  }

  /** 释放某 chat 的全部键（chat 关闭，§6.4）：kill 子进程并向上报告 context_released。 */
  release(chatId, { origin = null } = {}) {
    let released = 0;
    for (const [key, session] of [...this.sessions]) {
      if (session.chatId !== chatId) continue;
      this.sessions.delete(key);
      session.dispose();
      released += 1;
      this._notice(chatId, 'context_released', RELEASED_TEXT, origin || session.lastOrigin);
    }
    return released;
  }

  /** 全部回收（agent 优雅退出，§6.4）：不发提示（进程即将退出，无收件人语义）。 */
  dispose() {
    for (const [key, session] of [...this.sessions]) {
      this.sessions.delete(key);
      session.dispose();
    }
  }

  /** 仅当键仍指向该会话时移除（淘汰/崩溃/释放共用；返回是否真的移除）。 */
  _remove(key, session) {
    if (this.sessions.get(key) !== session) return false;
    this.sessions.delete(key);
    return true;
  }

  _evictIfNeeded() {
    while (this.sessions.size >= this.max) {
      const [key, victim] = this.sessions.entries().next().value; // Map 首项 = 最久未使用
      this.sessions.delete(key);
      victim.dispose();
      this.logger?.event('CONTEXT_EVICTED', { chat_id: victim.chatId, agent_id: victim.agentId, generation: victim.generation });
      this._notice(victim.chatId, 'context_reset', RESET_TEXT, victim.lastOrigin);
    }
  }

  _notice(chatId, kind, text, origin) {
    if (!this.onNotice || !origin) return;
    this.onNotice({ chatId, kind, text, origin });
  }
}

/** 一个键的运行态：常驻客户端 + FIFO 队列 + LRU/实例标识数据。 */
class ContextSession {
  constructor({ key, chatId, agentId, generation, pool }) {
    this.key = key;
    this.chatId = chatId;
    this.agentId = agentId;
    this.generation = generation;
    this.pool = pool;
    this.client = null;
    this.queue = [];
    this.inFlight = false;
    this.lastOrigin = null;
    this.closed = false; // 已从池中移除（淘汰/释放/崩溃）
  }

  /** 实例标识（F05-2/E-1 判据）：context_id = ctx-<pid>-<generation>，与 pid 一并随每轮结果上报。 */
  get contextId() {
    return this.client ? `ctx-${this.client.pid}-${this.generation}` : null;
  }

  get pid() {
    return this.client ? this.client.pid : null;
  }

  /** ACP 侧回读的实际生效模型（§7.4 审计面）；未建实例 / 未回读时为 null（不以请求参数冒充）。 */
  get model() {
    return this.client ? this.client.currentModel : null;
  }

  /**
   * 入队一轮（同键串行）。立即回绝的场景：键已释放（context_crashed）、队列已满（context_busy）。
   * 排队轮次的 timeoutMs 从实际开始执行时计时（§6.2）。
   */
  prompt(text, { model = null, timeoutMs, onChunk = null, origin = null } = {}) {
    if (this.closed) return Promise.reject(new AcpError('context_crashed', '上下文已释放'));
    if (this.queue.length >= QUEUE_LIMIT) {
      return Promise.reject(new AcpError('context_busy', `同键排队轮次已达上限（${QUEUE_LIMIT}）`));
    }
    if (origin) this.lastOrigin = origin;
    return new Promise((resolve, reject) => {
      this.queue.push({ text, model, timeoutMs, onChunk, resolve, reject });
      this._pump();
    });
  }

  /** 释放本键（淘汰/释放/dispose）：在飞轮次由客户端回绝（context_crashed），排队轮次一并失败。 */
  dispose() {
    if (this.closed) return;
    this.closed = true;
    const queued = this.queue.splice(0);
    this.client?.dispose();
    for (const turn of queued) turn.reject(new AcpError('context_crashed', '上下文已释放，排队轮次未执行'));
  }

  async _pump() {
    if (this.inFlight || this.closed) return;
    const turn = this.queue.shift();
    if (!turn) return;
    this.inFlight = true;
    try {
      const client = await this._ensureClient(turn.model);
      if (this.closed) throw new AcpError('context_crashed', '上下文在轮次开始前已释放');
      const result = await client.prompt(turn.text, {
        model: turn.model,
        timeoutMs: turn.timeoutMs,
        onChunk: turn.onChunk,
      });
      turn.resolve({ ...result, context_id: this.contextId, pid: this.pid });
    } catch (err) {
      turn.reject(err instanceof AcpError ? err : new AcpError('context_crashed', String(err && err.message ? err.message : err)));
      this._failSession(err);
    } finally {
      this.inFlight = false;
      if (!this.closed && this.queue.length > 0) queueMicrotask(() => this._pump());
    }
  }

  /** 懒创建常驻客户端（首轮建键：spawn + initialize + session/new + 等静默）。 */
  async _ensureClient(model) {
    if (this.client && !this.client.dead && !this.client.disposed) return this.client;
    const client = new AcpClient({
      bin: this.pool.bin,
      model,
      cwd: this.pool.cwd,
      logger: this.pool.logger,
      onExit: () => this._onClientExit(),
    });
    this.client = client;
    await client.start();
    this.pool.logger?.event('CONTEXT_READY', {
      chat_id: this.chatId,
      agent_id: this.agentId,
      context_id: this.contextId,
      pid: this.pid,
    });
    return client;
  }

  /** 子进程异常退出且当前无在飞轮次（空闲崩溃）：本键收尾并向发起者报告重置。 */
  _onClientExit() {
    if (this.closed || this.inFlight) return; // 在飞轮次的失败路径负责收尾
    this._failSession(new AcpError('context_crashed', '上下文子进程异常退出'));
  }

  /**
   * 会话级失败收尾（§6.5）：崩溃 / 超时 → 移除键 + 排队轮次一并失败 + notice{context_reset}。
   * 进程回收：崩溃路径子进程已不在；超时路径的 cancel → 宽限 → kill 由客户端自行完成（§6.5 ①②③）。
   * 模型不可用 / 队列满属轮次级错误：会话保持可用，不做收尾。
   */
  _failSession(err) {
    const code = err instanceof AcpError ? err.code : 'context_crashed';
    if (code === 'model_unavailable' || code === 'context_busy') return;
    const removed = this.pool._remove(this.key, this);
    if (this.closed && !removed) return; // 已被淘汰/释放：提示已由该路径发出，不重复
    this.closed = true;
    const queued = this.queue.splice(0);
    for (const turn of queued) turn.reject(new AcpError('context_crashed', '上下文实例已不可用，排队轮次未执行'));
    this.pool.logger?.event('CONTEXT_RESET', { chat_id: this.chatId, agent_id: this.agentId, error: code });
    this.pool._notice(this.chatId, 'context_reset', RESET_TEXT, this.lastOrigin);
  }
}
