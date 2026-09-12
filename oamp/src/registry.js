// src/registry.js — 注册表 + 连接身份反查 + 投递等待集 + 租约扫描纯逻辑（architecture §5.2~5.6 / D3/D4/D5/D7）
// 全内存、单事件循环串行访问（无锁）。Router 驱动本模块：连接生命周期/扫描定时器在 router.js，
// 本模块只做状态与判定（纯函数优先，便于直接单元验收）。

import { randomUUID } from 'node:crypto';

export function isValidInstanceId(value) {
  // §4.6 register 校验：非空、≤64、可打印 ASCII（无控制字符）
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && /^[\x21-\x7E]+$/.test(value);
}

export function isValidMessageId(value) {
  // §4.5 message_id：非空、≤64、可打印 ASCII（防日志注入）
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && /^[\x21-\x7E]+$/.test(value);
}
// F03/§3.3 通告值上界（与 agent.js 的 MAX_TIMEOUT_MS 同量级）：最坏 20 分钟僵尸窗口
export const MAX_ANNOUNCED_INTERVAL_MS = 600000;

/** F03/§3.3 心跳通告校验：正整数毫秒且 ≤ 上界；非法或缺失 ⇒ 视为未通告（fail-closed）。 */
export function isValidAnnouncedInterval(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_ANNOUNCED_INTERVAL_MS;
}

export function newSessionId() {
  // D5：crypto.randomUUID()
  return randomUUID();
}

/**
 * createRegistry — 注册表工厂。
 * 条目 schema（§5.2）：
 *   { instance_id, session_id, state:'online'|'offline', last_heartbeat:epochMs, connId:number|null,
 *     next_interval_ms:number|null }
 * `next_interval_ms`（F03/§3.3）= 该实例最近一次心跳通告的"距下一跳间隔"；null = 未通告（阈值回退基准）。
 * 连接身份反查 connIdent: Map<connId, {instance_id, session_id}>
 * 投递等待集 pendingDeliveries: Map<message_id, {toInstance, toSession}>（§5.5，行为验收载体=pr-004）
 */
export function createRegistry() {
  /** @type {Map<string, object>} */
  const entries = new Map();
  /** @type {Map<number, {instance_id:string, session_id:string}>} */
  const connIdent = new Map();
  /** @type {Map<string, {toInstance:string, toSession:string, taskId:string|null}>} */
  const pendingDeliveries = new Map();
  /** @type {Map<string, object>} 任务表（demo 扩展：task.request/update/result 状态与明细，纯内存） */
  const tasks = new Map();
  const MAX_TASK_UPDATES = 1000; // 防明细无限膨胀；超出置 updatesTruncated
  function getEntry(instanceId) {
    return entries.get(instanceId) || null;
  }

  function identityOf(connId) {
    return connIdent.get(connId) || null;
  }

  /**
   * register — 新注册 / 幂等续期 / live 冲突替换 / offline 覆盖复活。
   * 返回 { entry, replaced }：replaced 非空表示存在同 id 的 live 旧会话被替换（D4 latest-wins），
   * 含旧 session_id 与旧 connId（由 Router 负责关闭旧连接）。
   * 幂等：同一连接同一 session 重复 register → 刷新 last_heartbeat 续期，不重建条目（§4.6）。
   */
  function register({ instanceId, sessionId, connId, now }) {
    const prev = entries.get(instanceId);
    if (prev && prev.connId !== connId && prev.connId !== null && prev.state === 'online' && prev.session_id !== sessionId) {
      // 同 id 不同连接 live 冲突 → 替换（latest-wins）
      const replaced = { session_id: prev.session_id, connId: prev.connId };
      const entry = { instance_id: instanceId, session_id: sessionId, state: 'online', last_heartbeat: now, connId, next_interval_ms: null };
      entries.set(instanceId, entry);
      connIdent.delete(prev.connId);
      connIdent.set(connId, { instance_id: instanceId, session_id: sessionId });
      return { entry, replaced };
    }
    const entry = { instance_id: instanceId, session_id: sessionId, state: 'online', last_heartbeat: now, connId, next_interval_ms: null };
    entries.set(instanceId, entry);
    connIdent.set(connId, { instance_id: instanceId, session_id: sessionId });
    return { entry, replaced: null };
  }

  /**
   * heartbeat — 仅当 entry.session_id===上报 session 且 state=online 才更新 last_heartbeat（§4.6）。
   * F03/§3.3：可选 nextIntervalMs 校验后落条目（非法/缺省 ⇒ null＝未通告）；**不影响** last_heartbeat 更新。
   * 返回是否更新；offline/未知/旧会话 → false（忽略，不产生状态变更）。
   */
  function heartbeat({ instanceId, sessionId, nextIntervalMs, now }) {
    const entry = entries.get(instanceId);
    if (!entry || entry.state !== 'online' || entry.session_id !== sessionId) return false;
    entry.last_heartbeat = now;
    entry.next_interval_ms = isValidAnnouncedInterval(nextIntervalMs) ? nextIntervalMs : null;
    return true;
  }

  /**
   * deregister — 优雅离开 = 删除条目（§5.4），并清该节点投递等待集。
   * 返回 { removed:true } 或 { error:'AGENT_NOT_FOUND'|'STALE_SESSION' }（§4.6）。
   */
  function deregister({ instanceId, sessionId }) {
    const entry = entries.get(instanceId);
    if (!entry) return { error: 'AGENT_NOT_FOUND' };
    if (entry.session_id !== sessionId) return { error: 'STALE_SESSION' };
    entries.delete(instanceId);
    if (entry.connId !== null) connIdent.delete(entry.connId);
    clearPendingForInstance(instanceId);
    return { removed: true };
  }

  /**
   * onConnClosed — 连接断开：若该连接正是条目的当前 live 连接，置 connId=null；
   * 条目保持 online 至租约到期（§5.2 连接管理节：offline 判定交给租约超时）。返回受影响的身份（若有）。
   */
  function onConnClosed(connId) {
    const ident = connIdent.get(connId);
    if (!ident) return null;
    connIdent.delete(connId);
    const entry = entries.get(ident.instance_id);
    if (entry && entry.connId === connId) {
      entry.connId = null;
    }
    return ident;
  }

  /**
   * 租约到期判定（纯逻辑）：遍历 online 条目，返回超期的实例。
   * F03/§3.3 阈值推导（唯一落点）：timeoutMs 为**基准**；已通告实例按其通告值抬到 max(基准, 2 × 通告值)
   * ⇒ 不变式"判活阈值 ≥ 2 × 心跳间隔"由构造保证（未通告 ⇒ 逐字沿用基准＝迭代前行为）。
   */
  function findExpired(now, baseTimeoutMs) {
    const expired = [];
    for (const entry of entries.values()) {
      if (entry.state !== 'online') continue;
      const timeoutMs = entry.next_interval_ms == null
        ? baseTimeoutMs
        : Math.max(baseTimeoutMs, 2 * entry.next_interval_ms);
      if (now - entry.last_heartbeat > timeoutMs) {
        expired.push(entry.instance_id);
      }
    }
    return expired;
  }

  /** 判定为 offline：state=offline、connId=null（保留墓碑；§5.4）。返回旧 connId 供 Router 关连接。 */
  function markOffline(instanceId, now) {
    const entry = entries.get(instanceId);
    if (!entry || entry.state !== 'online') return { changed: false, connId: null };
    const oldConnId = entry.connId;
    if (oldConnId !== null) connIdent.delete(oldConnId);
    entry.state = 'offline';
    entry.connId = null;
    clearPendingForInstance(instanceId);
    return { changed: true, connId: oldConnId };
  }

  /** §4.4 router.status：按 instance_id 排序的 4 字段快照投影（不暴露连接句柄）。 */
  function snapshot() {
    const nodes = [];
    for (const entry of entries.values()) {
      nodes.push({
        instance_id: entry.instance_id,
        session_id: entry.session_id,
        state: entry.state,
        last_heartbeat: entry.last_heartbeat,
      });
    }
    nodes.sort((a, b) => (a.instance_id < b.instance_id ? -1 : a.instance_id > b.instance_id ? 1 : 0));
    return nodes;
  }

  // ---- 投递等待集（§5.5；行为验收载体 = pr-004，本 PR 只随注册表完整落盘）----

  function recordPendingDelivery({ messageId, toInstance, toSession, taskId = null }) {
    pendingDeliveries.set(messageId, { toInstance, toSession, taskId });
  }
  /** 定向清理单条 pending——投递失败回滚用（Q-1 裁决 pr-004：recordPending 前置后失败分支不留脏）。 */
  function clearPendingDelivery(messageId) {
    pendingDeliveries.delete(messageId);
  }
  /** ack 校验：返回 {acked:true, status, taskId} 或 { error:'UNKNOWN_MESSAGE'|'STALE_SESSION'|'INVALID_ACK_STATUS' }。
   *  支持 status='accepted'|'rejected'（demo 扩展：执行器校验失败回 rejected）；校验通过才清 pending；
   *  taskId 供 Router 在 rejected 时终结对应任务。 */
  function resolvePendingAck({ messageId, instanceId, sessionId, status }) {
    const pend = pendingDeliveries.get(messageId);
    if (!pend) return { error: 'UNKNOWN_MESSAGE' };
    if (pend.toInstance !== instanceId || pend.toSession !== sessionId) return { error: 'STALE_SESSION' };
    if (status !== 'accepted' && status !== 'rejected') return { error: 'INVALID_ACK_STATUS' };
    pendingDeliveries.delete(messageId);
    return { acked: true, status, taskId: pend.taskId };
  }
  function clearPendingForInstance(instanceId) {
    for (const [messageId, pend] of pendingDeliveries) {
      if (pend.toInstance === instanceId) pendingDeliveries.delete(messageId);
    }
  }

  // ---- 任务表（demo 扩展：主 agent 指派任务 → agent 执行 → 进度/明细跟踪）----

  /** 任务条目 schema：{ task_id, from, to, state, label, created_at, updated_at, updates[], result|null } */
  function createTask({ taskId, from, to, now, label, messageId = null }) {
    if (tasks.has(taskId)) return { task: tasks.get(taskId), created: false };
    const task = {
      task_id: taskId,
      from,
      to,
      state: 'submitted',
      label: label || null,
      message_id: messageId,
      created_at: now,
      updated_at: now,
      updates: [],
      updatesTruncated: false,
      result: null,
    };
    tasks.set(taskId, task);
    return { task, created: true };
  }

  /**
   * 追加任务明细（task.update / task.result 经 Router 记录）。detail 为结构化对象（原样存，不解析）。
   * 返回 { task } 或 { error:'TASK_NOT_FOUND' }。
   */
  function recordTaskUpdate({ taskId, from, at, state, detail }) {
    const task = tasks.get(taskId);
    if (!task) return { error: 'TASK_NOT_FOUND' };
    if (task.updates.length >= MAX_TASK_UPDATES) {
      task.updatesTruncated = true;
    } else {
      task.updates.push({ at, from, state: state || null, detail });
    }
    task.updated_at = at;
    if (state === 'working' && task.state !== 'completed' && task.state !== 'failed') {
      task.state = 'working';
    }
    return { task };
  }

  /**
   * 置任务终态（task.result：state ∈ completed|failed）。已终态幂等返回现有（不覆盖）。
   * 返回 { task } 或 { error:'TASK_NOT_FOUND'|'TASK_ALREADY_FINAL' }。
   */
  function finishTask({ taskId, from, at, state, result }) {
    const task = tasks.get(taskId);
    if (!task) return { error: 'TASK_NOT_FOUND' };
    if (task.state === 'completed' || task.state === 'failed') {
      return { task, error: 'TASK_ALREADY_FINAL' };
    }
    task.state = state;
    task.result = { ...(result || {}), at };
    task.updated_at = at;
    return { task };
  }

  function getTask(taskId) {
    return tasks.get(taskId) || null;
  }

  /** 任务列表投影（按 created_at 倒序）；state 过滤（submitted/working/completed/failed/全部）。 */
  function listTasks({ state } = {}) {
    const out = [];
    for (const task of tasks.values()) {
      if (state && task.state !== state) continue;
      out.push({
        task_id: task.task_id,
        from: task.from,
        to: task.to,
        state: task.state,
        label: task.label,
        created_at: task.created_at,
        updated_at: task.updated_at,
        updates: task.updates.length,
        updatesTruncated: task.updatesTruncated,
      });
    }
    out.sort((a, b) => b.created_at - a.created_at);
    return out;
  }

  return {
    getEntry,
    identityOf,
    register,
    heartbeat,
    deregister,
    onConnClosed,
    findExpired,
    markOffline,
    snapshot,
    recordPendingDelivery,
    clearPendingDelivery,
    resolvePendingAck,
    clearPendingForInstance,
    createTask,
    recordTaskUpdate,
    finishTask,
    getTask,
    listTasks,
  };
}
