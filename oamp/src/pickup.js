// src/pickup.js — 终端结果未取件指针表（0029 pr-002 / architecture §3.7 / §4 A-06）
// 形态：进程内 Map（web 进程持有）；寿命：进程内、不持久、重启即丢——不落库、无文件写入、无 TTL、无定时器、无事件面。
// 为什么在服务端：会话重连后需要按 requester 重建当前未取件指针集合。
// 为什么不是持久层：本表只存当前进程的取件指针，不保存正文、信封或历史台账。
// 形态先例 = src/inbox.js 的进程内表；条目只保留白名单指针字段。
// 导出面恰好 3 个函数（add / listByRequester / ack）——不提供 history / export / clear 类入口。

/** call_id → { call_id, requester, agent, chat_id, terminal_at, acked }。 */
const entries = new Map();

/** 登记指针（幂等）：只校验 call_id；首次插入 true，重复或非法 false 且不覆盖首条。 */
export function add(source) {
  const callId = source && typeof source === 'object' ? source.call_id : null;
  if (typeof callId !== 'string' || callId === '') return false;
  if (entries.has(callId)) return false;

  entries.set(callId, {
    call_id: callId,
    requester: source.requester ?? null,
    agent: source.agent ?? null,
    chat_id: source.chat_id ?? null,
    terminal_at: source.terminal_at ?? null,
    acked: false,
  });
  return true;
}

/** 返回指定 requester 的未确认条目引用，保持 Map 登记顺序。 */
export function listByRequester(requester) {
  return [...entries.values()].filter((entry) => entry.requester === requester && entry.acked === false);
}

/** 确认取件：保留条目并标记 acked；不存在或重复确认均无副作用、不抛错。 */
export function ack(callId) {
  const entry = entries.get(callId);
  if (entry) entry.acked = true;
}
