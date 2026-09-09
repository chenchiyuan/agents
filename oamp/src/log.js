// src/log.js — 终端事件行格式化 + 心跳节流（architecture §8 / D9）
// 事件行 = `[<UTC ISO-8601>] <role> <事件名> <key=value …>`，值含空格时引号包裹。
// 只节流 HEARTBEAT 事件（每节点滑动窗口至多 1 条，惰性判断）；状态变迁/消息事件永不节流。
// 输出到 stdout（错误/用法走 stderr）；不落盘、不轮转（N2：审计 = 终端事件）。

export function formatTime(tsMs) {
  return new Date(tsMs).toISOString(); // UTC ISO-8601 毫秒（§5.7/D17 外显时间戳）
}

function formatValue(value) {
  const s = String(value);
  return /\s/.test(s) ? `"${s.replaceAll('"', '\\"')}"` : s;
}

/**
 * formatEventLine — 纯函数：组事件行。fields 为有序 key=value 对象。
 * [2026-09-09T04:12:33.123Z] router AGENT_REGISTERED instance=dev-1 session=…
 */
export function formatEventLine(role, eventName, fields = {}, nowMs = Date.now()) {
  const parts = [`[${formatTime(nowMs)}]`, role, eventName];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${formatValue(value)}`);
  }
  return parts.join(' ');
}

/**
 * createEventLog — 每个角色（router/agent）持有实例写自己的 stdout。
 * 返回 { event(eventName, fields) 永不节流, heartbeat(fields) 每节点滑窗节流, flush? }
 */
export function createEventLog({ role = 'router', stream = process.stdout, hbLogWindowMs = 60000 } = {}) {
  const lastHbLogTs = new Map(); // instance -> 上次心跳日志时间（§8.2 每节点滑窗）

  function event(eventName, fields = {}, nowMs = Date.now()) {
    stream.write(`${formatEventLine(role, eventName, fields, nowMs)}\n`);
  }

  /** 只节流 HEARTBEAT：now - lastHbLogTs >= W 才打并更新；返回是否输出。 */
  function heartbeat(fields = {}, nowMs = Date.now()) {
    const key = fields.instance_id ?? fields.instance ?? fields.session_id ?? '__peer__';
    const last = lastHbLogTs.get(key);
    if (last !== undefined && nowMs - last < hbLogWindowMs) return false;
    lastHbLogTs.set(key, nowMs);
    event('HEARTBEAT', fields, nowMs);
    return true;
  }

  return { event, heartbeat };
}
