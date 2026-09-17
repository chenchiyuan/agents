// src/principals.js — 客户端身份登记表（0029 pr-002 / architecture §3.1 / §4 A-01）
// 形态：进程内 Map（web 进程持有）；寿命：进程内、不持久、重启即丢——不落库、无文件写入、无 TTL、无定时器、无事件面。
// 为什么在服务端：请求登记与取件接缝需要稳定的身份记录与最近声明时间。
// 为什么不是持久层：本表只服务当前进程会话，不承担跨重启身份历史。
// 形态先例 = src/inbox.js 的进程内表；身份值只接受显式声明，不从运行环境推断。
// 导出面恰好 4 个函数（upsert / get / touch / requesterOf）——不提供 clear / delete / history / export。

/** principal_id → { principal_id, kind, instance_id, created_at, last_seen_at }。 */
const entries = new Map();

/** 与 registry.isValidInstanceId 逐例同判：非空、≤64、每个码元均为可打印 ASCII。 */
function isValidPrincipalShape(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x21 || code > 0x7e) return false;
  }
  return true;
}

/** 登记或刷新身份（幂等）：命中只前移 last_seen_at，不覆盖创建时的声明。 */
export function upsert(decl) {
  const source = decl && typeof decl === 'object' ? decl : null;
  const principalId = source?.principal_id;
  if (!isValidPrincipalShape(principalId)) return { error: 'INVALID_PRINCIPAL_ID' };

  const now = Date.now();
  const existing = entries.get(principalId);
  if (existing) {
    existing.last_seen_at = now;
    return { principal: existing };
  }

  const principal = {
    principal_id: principalId,
    kind: source.kind ?? null,
    instance_id: source.instance_id ?? null,
    created_at: now,
    last_seen_at: now,
  };
  entries.set(principalId, principal);
  return { principal };
}

/** 查询身份；不存在或键不匹配时返回 null。 */
export function get(principalId) {
  return entries.get(principalId) || null;
}

/** 显式刷新身份声明时间；未登记身份不自动创建。 */
export function touch(principalId) {
  const principal = entries.get(principalId);
  if (!principal) return null;
  principal.last_seen_at = Date.now();
  return principal;
}

/** 读取请求来源中的显式身份声明；不产生登记、不刷新时间、不推断缺失字段。 */
export function requesterOf(source) {
  if (!source || typeof source !== 'object' || typeof source.principal_id !== 'string' || source.principal_id === '') {
    return null;
  }
  return {
    principal_id: source.principal_id,
    kind: source.kind ?? null,
    instance_id: source.instance_id ?? null,
  };
}
