// src/inbox.js — 确认项在途表（0021 pr-003 / architecture §6.1 / §6.2 / §7 T-08）
// 形态：进程内 Map（web 进程持有）——不落库、无 TTL、无定时器、无事件面；`take()` 即删。
// 为什么在服务端：页面刷新 / 断线重连后要重建在途列表（F06 / W6），而前端内存随刷新清零。
// 为什么不是持久层：F11 / N2「不做历史台账」——本表**只装未裁决项**，裁决即删除 ⇒
//   已裁决项**无任何读取入口**（无列表、无查询参数、无导出），由结构保证而非由约定保证。
// 形态先例 = web.js 的进程内任务表 `tasks` / 调用登记 `callSchemas`（同「进程内、不持久、重启即丢」）。
// 导出面恰好 5 个函数（add / list / take / remove / size）——不提供 history / export / decided 类入口。

/** confirmation_id → entry（entry = agent 侧信封 1 的 7 个字段原样；Map 迭代顺序 = 登记顺序）。 */
const entries = new Map();

/** 登记（幂等）：首次插入返回 true；同一 confirmation_id 重复登记返回 false 且不覆盖首条、不改计数。 */
export function add(entry) {
  const id = entry ? entry.confirmation_id : null;
  if (typeof id !== 'string' || id === '') return false;
  if (entries.has(id)) return false;
  entries.set(id, entry);
  return true;
}

/** 快照数组（重建面 R-1 的数据源）；顺序 = 登记顺序，**不承诺**排序（MI-04）。 */
export function list() {
  return [...entries.values()];
}

/** 原子取出并移除（裁决用）；不存在 → null（R-2 据此回 404，不区分「已裁决 / 已失效 / 从未存在」）。 */
export function take(confirmationId) {
  const entry = entries.get(confirmationId);
  if (entry === undefined) return null;
  entries.delete(confirmationId);
  return entry;
}

/** 移除（失效路径用：agent 侧轮次已终结 / 上下文已淘汰）；不存在 → 无副作用、不抛错。 */
export function remove(confirmationId) {
  entries.delete(confirmationId);
}

/** 在途计数（诊断）。 */
export function size() {
  return entries.size;
}
