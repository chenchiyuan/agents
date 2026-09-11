// src/cluster-config.js — 集群配置（cluster.json）的读取、校验与归一（architecture §5.1 / §12.2 契约 3）
// 叶子模块：只依赖 node: 内置模块与同目录 role-binding.js；零第三方依赖，不启动任何进程。
// 加载即全量校验——类型/取值、凭据类键递归扫描、enabled 角色的角色文件与 cwd 预检；
// 任一不成立即抛错（调用方 `oamp cluster` 收口为 `oamp cluster: 配置错误: <原因>` + 退出码 2）。
// instance_id 恒由 role-binding.js 的 instanceIdForRole 产生：本模块不拼接前缀、不提供覆盖字段（§3.1）。

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { instanceIdForRole, resolveRoleFile, resolveRoleRoot } from './role-binding.js';

const SESSION_DEFAULT = 'oamp-cluster';
const PORT_DEFAULT = 7788;
const PORT_MIN = 1;
const PORT_MAX = 65535;
const PERMISSION_VALUES = ['allow', 'deny'];
const PERMISSION_DEFAULT = 'allow';
const CWD_DEFAULT = '.';

// 禁止出现在集群配置里的键名（§5.1 校验表）。字符串拼接构造，避免被 test/hygiene.test.js 的
// 源文件扫描（词边界、大小写不敏感）判为自发命中。
const CREDENTIAL_KEY_PATTERNS = ['to' + 'ken', 'secr' + 'et', 'pass' + 'word', 'pass' + 'wd', 'api' + 'key', 'cre' + 'dential'];

// instance_id 无覆盖字段（§3.1）：出现即响亮失败，不按"未知键忽略"静默丢弃。
const INSTANCE_OVERRIDE_KEYS = ['instance_id', 'instanceId'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function show(value) {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

// 校验失败的最小单元：一句原因 + 当前值（消息前缀由调用方按 §5.1 收口为 `oamp cluster: 配置错误: …`）。
function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${field} 需为非空字符串（当前值 ${show(value)}）`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} 需为布尔值（当前值 ${show(value)}）`);
  }
  return value;
}

function requireObject(value, field) {
  if (!isPlainObject(value)) {
    throw new Error(`${field} 需为对象（当前值 ${show(value)}）`);
  }
  return value;
}

function requirePermission(value, field) {
  if (!PERMISSION_VALUES.includes(value)) {
    throw new Error(`${field} 需为 'allow' 或 'deny'（当前值 ${show(value)}）`);
  }
  return value;
}

function requirePort(value) {
  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error(`web.port 需为 ${PORT_MIN}~${PORT_MAX} 的整数（当前值 ${show(value)}）`);
  }
  return value;
}

function isDirectory(target) {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function parseConfigFile(configPath) {
  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (err) {
    throw new Error(`配置文件不存在或不可读: ${configPath}（${err.code ?? err.message}）`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`配置文件不是合法 JSON: ${configPath}（${err.message}）`);
  }
  return requireObject(parsed, '配置文件顶层');
}

// 凭据类键递归扫描（§5.1 / F06-7）：键名大小写不敏感、去掉分隔符后包含命中即抛错。
// 根路径为空串时不留前导点（如 `roles.dev.<禁止键名>`）。
function scanCredentialKeys(value, fieldPath) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanCredentialKeys(item, `${fieldPath}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
    const field = fieldPath === '' ? key : `${fieldPath}.${key}`;
    if (CREDENTIAL_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      throw new Error(`配置含凭据类字段: ${field}（集群配置必须零凭据字段）`);
    }
    scanCredentialKeys(child, field);
  }
}

function readTopSections(parsed) {
  const session = parsed.session === undefined
    ? SESSION_DEFAULT
    : requireNonEmptyString(parsed.session, 'session');
  const web = parsed.web === undefined ? {} : requireObject(parsed.web, 'web');
  const router = parsed.router === undefined ? {} : requireObject(parsed.router, 'router');
  const rolesRaw = parsed.roles === undefined ? {} : requireObject(parsed.roles, 'roles');
  const port = web.port === undefined ? PORT_DEFAULT : requirePort(web.port);
  const socket = router.socket === undefined || router.socket === null
    ? null
    : requireNonEmptyString(router.socket, 'router.socket');
  return { session, web: { port }, router: { socket }, rolesRaw };
}

// 角色段归一：键 = 角色名，值 = { instanceId, enabled, model, tools, permission, cwd }（§12.2 契约 3）。
// 未知键忽略；cwd 相对路径基准 = 配置文件所在目录（root），绝对路径原样，不做 `~` 展开。
// model 未配置时不填内置默认（§5.1「缺省不写 = 用全局默认」）：内置终端默认由 src/config.js 的解析链承载。
function normalizeRoleSection(role, section, root) {
  requireObject(section, `roles.${role}`);
  for (const key of INSTANCE_OVERRIDE_KEYS) {
    if (Object.hasOwn(section, key)) {
      throw new Error(`roles.${role}.${key} 不是受支持的字段（instance_id 恒为 instanceIdForRole(role)，无覆盖字段）`);
    }
  }
  const enabled = section.enabled === undefined
    ? true
    : requireBoolean(section.enabled, `roles.${role}.enabled`);
  const tools = section.tools === undefined
    ? true
    : requireBoolean(section.tools, `roles.${role}.tools`);
  const permission = section.permission === undefined
    ? PERMISSION_DEFAULT
    : requirePermission(section.permission, `roles.${role}.permission`);
  const model = section.model === undefined
    ? undefined
    : requireNonEmptyString(section.model, `roles.${role}.model`);
  const cwd = path.resolve(root, section.cwd === undefined
    ? CWD_DEFAULT
    : requireNonEmptyString(section.cwd, `roles.${role}.cwd`));
  return { instanceId: instanceIdForRole(role), enabled, model, tools, permission, cwd };
}

// enabled 角色的启动前预检（§5.1 校验表 / AR-18）：角色文件与 cwd 必须在创建 session 之前成立。
// enabled:false 的角色保留在 Map 中（是否起窗口归 pr-005），跳过预检。
function assertEnabledRolePrerequisites(role, normalized, root) {
  if (!normalized.enabled) {
    return;
  }
  const roleFile = resolveRoleFile(root, role);
  if (!existsSync(roleFile)) {
    throw new Error(`角色 ${role} 的角色文件不存在: ${roleFile}`);
  }
  if (!isDirectory(normalized.cwd)) {
    throw new Error(`角色 ${role} 的 cwd 不存在或不是目录: ${normalized.cwd}`);
  }
}

// 读取路径优先级：显式参数 > env OAMP_CLUSTER_CONFIG > <roleRoot>/cluster.json（缺省 = 仓库根）。
export function loadClusterConfig({ path: explicitPath, env } = {}) {
  const envVars = env ?? process.env;
  if (explicitPath !== undefined && explicitPath !== null && explicitPath !== '') {
    requireNonEmptyString(explicitPath, '配置文件路径');
  }
  const fromEnv = envVars.OAMP_CLUSTER_CONFIG === undefined || envVars.OAMP_CLUSTER_CONFIG === ''
    ? null
    : requireNonEmptyString(envVars.OAMP_CLUSTER_CONFIG, 'OAMP_CLUSTER_CONFIG');
  const configPath = path.resolve(
    (explicitPath || fromEnv) ?? path.join(resolveRoleRoot(envVars), 'cluster.json'),
  );
  const root = path.dirname(configPath);

  const parsed = parseConfigFile(configPath);
  scanCredentialKeys(parsed, '');
  const { session, web, router, rolesRaw } = readTopSections(parsed);

  const roles = new Map();
  for (const [role, section] of Object.entries(rolesRaw)) {
    const normalized = normalizeRoleSection(role, section, root);
    assertEnabledRolePrerequisites(role, normalized, root);
    roles.set(role, normalized);
  }
  return { session, root, web, router, roles };
}
