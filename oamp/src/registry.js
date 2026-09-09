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

export function newSessionId() {
  // D5：crypto.randomUUID()
  return randomUUID();
}

/**
 * createRegistry — 注册表工厂。
 * 条目 schema（§5.2）：
 *   { instance_id, session_id, state:'online'|'offline', last_heartbeat:epochMs, connId:number|null }
 * 连接身份反查 connIdent: Map<connId, {instance_id, session_id}>
 * 投递等待集 pendingDeliveries: Map<message_id, {toInstance, toSession}>（§5.5，行为验收载体=pr-004）
 */
export function createRegistry() {
  /** @type {Map<string, object>} */
  const entries = new Map();
  /** @type {Map<number, {instance_id:string, session_id:string}>} */
  const connIdent = new Map();
  /** @type {Map<string, {toInstance:string, toSession:string}>} */
  const pendingDeliveries = new Map();

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
      const entry = { instance_id: instanceId, session_id: sessionId, state: 'online', last_heartbeat: now, connId };
      entries.set(instanceId, entry);
      connIdent.delete(prev.connId);
      connIdent.set(connId, { instance_id: instanceId, session_id: sessionId });
      return { entry, replaced };
    }
    const entry = { instance_id: instanceId, session_id: sessionId, state: 'online', last_heartbeat: now, connId };
    entries.set(instanceId, entry);
    connIdent.set(connId, { instance_id: instanceId, session_id: sessionId });
    return { entry, replaced: null };
  }

  /**
   * heartbeat — 仅当 entry.session_id===上报 session 且 state=online 才更新 last_heartbeat（§4.6）。
   * 返回是否更新；offline/未知/旧会话 → false（忽略，不产生状态变更）。
   */
  function heartbeat({ instanceId, sessionId, now }) {
    const entry = entries.get(instanceId);
    if (!entry || entry.state !== 'online' || entry.session_id !== sessionId) return false;
    entry.last_heartbeat = now;
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

  /** 租约到期判定（纯逻辑）：遍历 online 条目，返回 now-last_heartbeat > timeoutMs 的实例。 */
  function findExpired(now, timeoutMs) {
    const expired = [];
    for (const entry of entries.values()) {
      if (entry.state === 'online' && now - entry.last_heartbeat > timeoutMs) {
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

  function recordPendingDelivery({ messageId, toInstance, toSession }) {
    pendingDeliveries.set(messageId, { toInstance, toSession });
  }
  /** 定向清理单条 pending——投递失败回滚用（Q-1 裁决 pr-004：recordPending 前置后失败分支不留脏）。 */
  function clearPendingDelivery(messageId) {
    pendingDeliveries.delete(messageId);
  }
  /** ack 校验：返回 {acked:true} 或 { error:'UNKNOWN_MESSAGE'|'STALE_SESSION'|'INVALID_ACK_STATUS' }。
   *  本轮仅支持 status='accepted'（§4.3 INVALID_ACK_STATUS）；校验通过才清 pending。 */
  function resolvePendingAck({ messageId, instanceId, sessionId, status }) {
    const pend = pendingDeliveries.get(messageId);
    if (!pend) return { error: 'UNKNOWN_MESSAGE' };
    if (pend.toInstance !== instanceId || pend.toSession !== sessionId) return { error: 'STALE_SESSION' };
    if (status !== 'accepted') return { error: 'INVALID_ACK_STATUS' };
    pendingDeliveries.delete(messageId);
    return { acked: true };
  }
  function clearPendingForInstance(instanceId) {
    for (const [messageId, pend] of pendingDeliveries) {
      if (pend.toInstance === instanceId) pendingDeliveries.delete(messageId);
    }
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
  };
}
