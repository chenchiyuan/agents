// src/context-pool.js — 按 chat 维度持有的常驻上下文池（architecture §6.1~§6.5 / AR-11 / AR-12）
// 键 = (chat_id, agent_id)：一个键 = 一个常驻会话（§5.1 标准面对象）+ 该会话承载的上下文（agent_id 由进程身份隐含）。
// 本模块只认识标准面与**注入的**会话工厂 ⇒ 协议实现的选择与装配全在唯一注入点（§3.3 判据 1/2：消费层零协议分支）。
// 同键 FIFO 串行（单 in-flight + 队列上限 8，超出 context_busy）；异键完全并发；
// 全局上限 max（config.contextMax）→ LRU 淘汰；release(chatId) 释放该 chat 全部键；dispose() 全部回收。
// 上下文只是运行期状态：进程消亡（崩溃/淘汰/释放）即失忆，向发起者发 notice 告知（§6.3，不入库）。

import { ProtocolError } from './protocol.js';

const QUEUE_LIMIT = 8; // §6.2：同键队列上限（等待中的轮次数），超出立即 context_busy

const RESET_TEXT = '上下文已重置，本对话后续回复不再记得此前内容';
const RELEASED_TEXT = '对话已关闭，上下文已释放';

export class ContextPool {
  /**
   * @param {object} opts
   * @param {number} [opts.max]            全局键上限（config.contextMax）
   * @param {function} opts.createResident 注入的会话工厂（= 唯一注入点门面的同名成员，§5.1）：`({chatId, agentId, role, hooks}) => Promise<session>`
   * @param {object|null} [opts.logger]    createEventLog 实例（可选）
   * @param {function|null} [opts.onNotice] ({chatId, kind, text, origin}) => void；上下文事件提示出口
   * @param {function|null} [opts.onPermissionRequest] (info) => 'allow'|'deny'|{optionId}|Promise<…>；确认面上浮钩子
   *   （§5.3 信封 1，pr-002）；**仅 `permission === 'allow'` 档**注入（`deny` 档恒不注入）
   * @param {string|null} [opts.role]      绑定角色（会话身份字段，§4.5）；null = 匿名实例
   * @param {'allow'|'deny'} [opts.permission] permission 档（§4.4）；缺省 allow
   */
  constructor({ max = 8, createResident, logger = null, onNotice = null, onPermissionRequest = null, role = null, permission = 'allow' }) {
    this.max = max;
    this.createResident = createResident;
    this.logger = logger;
    this.onNotice = onNotice;
    this.onPermissionRequest = onPermissionRequest;
    this.role = role;
    this.permission = permission;
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
    // §4.2：本会话已「成功送达」的轮次数（只增不减，不参与任何调度判定）——首轮项目上下文名额的判据
    this.sentTurns = 0;
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
  prompt(text, { model = null, timeoutMs, onDelta = null, origin = null, projectContext = null } = {}) {
    if (this.closed) return Promise.reject(new ProtocolError('context_crashed', '上下文已释放'));
    if (this.queue.length >= QUEUE_LIMIT) {
      return Promise.reject(new ProtocolError('context_busy', `同键排队轮次已达上限（${QUEUE_LIMIT}）`));
    }
    if (origin) this.lastOrigin = origin;
    return new Promise((resolve, reject) => {
      this.queue.push({ text, model, timeoutMs, onDelta, projectContext, resolve, reject });
      this._pump();
    });
  }

  /** 释放本键（淘汰/释放/dispose）：在飞轮次由客户端回绝（context_crashed），排队轮次一并失败。 */
  dispose() {
    if (this.closed) return;
    this.closed = true;
    const queued = this.queue.splice(0);
    this.client?.close();
    for (const turn of queued) turn.reject(new ProtocolError('context_crashed', '上下文已释放，排队轮次未执行'));
  }

  async _pump() {
    if (this.inFlight || this.closed) return;
    const turn = this.queue.shift();
    if (!turn) return;
    this.inFlight = true;
    try {
      const client = await this._ensureClient();
      if (this.closed) throw new ProtocolError('context_crashed', '上下文在轮次开始前已释放');
      // §4.2：会话「首个成功送达轮次」注入一次项目上下文（块 + \n\n + 原文；未携带即原文）。
      // sentTurns 只在成功返回后自增 ⇒ context_busy（入队即拒）/ model_unavailable（session/prompt 前失败）/
      // 崩溃（context_crashed）都不消费首轮名额；permission_denied 已送达故会重复一次（无害 → 不加状态机）。
      const text = this.sentTurns === 0 && turn.projectContext ? `${turn.projectContext}\n\n${turn.text}` : turn.text;
      const result = await client.prompt(text, {
        model: turn.model,
        timeoutMs: turn.timeoutMs,
        onDelta: turn.onDelta,
      });
      this.sentTurns += 1;
      turn.resolve({ ...result, context_id: this.contextId, pid: this.pid });
    } catch (err) {
      turn.reject(err instanceof ProtocolError ? err : new ProtocolError('context_crashed', String(err && err.message ? err.message : err)));
      this._failSession(err);
    } finally {
      this.inFlight = false;
      if (!this.closed && this.queue.length > 0) queueMicrotask(() => this._pump());
    }
  }

  /**
   * 懒创建常驻会话（首轮建键：装配 + 开会话，过程面全归注入的会话工厂）。
   * 可用性按**池自身状态**判定（标准面无 `dead` / `disposed` 成员）：会话失效一律由失败路径 `_failSession` 收尾。
   */
  async _ensureClient() {
    if (this.client && !this.closed) return this.client;
    const session = this;
    // §5.3/§4.2 M-13（pr-002）：上浮钩子的**唯一注入点**——会话身份（chatId/agentId/该轮 origin）只有本层持有，
    // 在此附加后透传；档位判定点同样唯一：仅 allow 档注入，deny 档恒 null（既有自动拒绝三步逐字不变）。
    // §5.6：两型反向请求（权限门 / 审批门）共用同一出口 ⇒ 判定与身份附加只有这一处（消费层零协议分支）。
    const onRequest =
      this.pool.permission === 'allow' && typeof this.pool.onPermissionRequest === 'function'
        ? (info) => this.pool.onPermissionRequest({ ...info, chatId: this.chatId, agentId: this.agentId, origin: this.lastOrigin })
        : null;
    const client = await this.pool.createResident({
      chatId: this.chatId,
      agentId: this.agentId,
      role: this.pool.role,
      hooks: {
        onPermissionRequest: onRequest,
        onApproval: onRequest,
        onExit: () => this._onClientExit(),
        // §4.5/§12.2 契约 1：context_id = ctx-<pid>-<generation> 依赖 spawn 后的 pid ⇒ 取值器惰性解析
        get contextId() {
          return session.contextId;
        },
      },
    });
    this.client = client;
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
    this._failSession(new ProtocolError('context_crashed', '上下文子进程异常退出'));
  }

  /**
   * 会话级失败收尾（§6.5）：崩溃 / 超时 → 移除键 + 排队轮次一并失败 + notice{context_reset}。
   * 进程回收：崩溃路径子进程已不在；超时路径的 cancel → 宽限 → kill 由客户端自行完成（§6.5 ①②③）。
   * 模型不可用 / 队列满 / permission 拒绝（permission_denied）属轮次级错误：会话保持可用，不做收尾。
   */
  _failSession(err) {
    const code = err instanceof ProtocolError ? err.code : 'context_crashed';
    if (code === 'model_unavailable' || code === 'context_busy' || code === 'permission_denied') return;
    const removed = this.pool._remove(this.key, this);
    if (this.closed && !removed) return; // 已被淘汰/释放：提示已由该路径发出，不重复
    this.closed = true;
    const queued = this.queue.splice(0);
    for (const turn of queued) turn.reject(new ProtocolError('context_crashed', '上下文实例已不可用，排队轮次未执行'));
    this.pool.logger?.event('CONTEXT_RESET', { chat_id: this.chatId, agent_id: this.agentId, error: code });
    this.pool._notice(this.chatId, 'context_reset', RESET_TEXT, this.lastOrigin);
  }
}
