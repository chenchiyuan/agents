// src/role-binding.js — 角色标识与角色文件定位的唯一映射规则（architecture §3.1 / §12.2 契约 2）
// 叶子模块：只依赖 node: 内置模块，不 import src 内任何模块，零第三方依赖。
// 「instance_id = 'pb-' + role」公式只此一处；集群脚本（pr-005）与单起推断（pr-004）必须 import 本模块，
// 不得自行拼接前缀。角色真源 = <roleRoot>/roles/<role>/<role>.md（不读 .pb-agents/ 副本）。

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 路径基准 = 包根（按本模块位置推导，与 cwd 无关），与 src/config.js 的 PKG_ROOT 同口径。
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTANCE_PREFIX = 'pb-';
const INSTANCE_ID_RE = new RegExp(`^${INSTANCE_PREFIX}(.+)$`);

// 角色根：env OAMP_ROLE_ROOT 非空时取该值（已绝对化），否则包根上级目录 = 仓库根。
export function resolveRoleRoot(env = process.env) {
  const override = env?.OAMP_ROLE_ROOT;
  if (typeof override === 'string' && override !== '') {
    return path.resolve(override);
  }
  return path.resolve(PKG_ROOT, '..');
}

// 角色文件路径：<root>/roles/<role>/<role>.md（绝对路径）。只解析路径，存在性判定归调用方。
export function resolveRoleFile(root, role) {
  return path.resolve(root, 'roles', role, `${role}.md`);
}

// 正向映射：role → instance_id（'pb-' + role，无后缀）。
export function instanceIdForRole(role) {
  return INSTANCE_PREFIX + role;
}

// 反向映射：'pb-<role>' 且角色文件存在 → role；否则 null（不绑定，供单起路径推断消费）。
export function roleFromInstanceId(instanceId, env = process.env) {
  if (typeof instanceId !== 'string') {
    return null;
  }
  const match = INSTANCE_ID_RE.exec(instanceId);
  if (!match) {
    return null;
  }
  const role = match[1];
  return existsSync(resolveRoleFile(resolveRoleRoot(env), role)) ? role : null;
}
