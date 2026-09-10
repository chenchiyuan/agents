// src/config.js — 运行参数：内置默认 + 配置文件（config.json）+ env 覆盖 + 数值校验（architecture §8 配置面）
// 叶子模块：只依赖 node: 内置模块，不 import src 内任何模块。
// 被 router/agent/status/web 进程入口消费；库路径/默认模型/池上限三键由 pr-003/pr-004 接线。
// 路径基准 = 包根（按本模块位置推导，与 cwd 无关）：socket → .runtime/，库 → data/sql.db（§8.1~§8.3）。

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(PKG_ROOT, 'config.json');

// 配置文件三键的内置默认（§8.2）：data.db → F07、defaults.model → F06、context.max → F05
const DB_DEFAULT = 'data/sql.db';
const MODEL_DEFAULT = 'openai/gpt-5.6-luna';
const CONTEXT_MAX_DEFAULT = 8;

const NUMERIC_DEFAULTS = {
  OAMP_HEARTBEAT_INTERVAL_MS: 10000,
  OAMP_HEARTBEAT_TIMEOUT_MS: 30000,
  OAMP_HB_LOG_WINDOW_MS: 60000,
  OAMP_RECONNECT_MAX_MS: 10000,
};

function readPositiveInt(name, env) {
  const raw = env[name];
  if (raw === undefined) {
    return NUMERIC_DEFAULTS[name];
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`OAMP 配置错误: ${name} 需为正整数（当前值 "${raw}"）`);
  }
  return n;
}

function readNonEmptyString(value) {
  // env 空串/纯空白视为未提供（§8.2 未定义该情形，沿用既有 `env.X || 默认` 的"空即未设"风格）
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSection(config, key, filePath) {
  const value = config[key];
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw new Error(`OAMP 配置错误: ${key} 需为对象（${filePath}）`);
  }
  return value;
}

function readStringField(section, key, sectionName, filePath) {
  const value = section[key];
  if (value === undefined) {
    return undefined;
  }
  const text = readNonEmptyString(value);
  if (text === undefined) {
    throw new Error(`OAMP 配置错误: ${sectionName}.${key} 需为非空字符串（${filePath}）`);
  }
  return text;
}

// 读配置文件（§8.3）：不存在 → {}（F07-3 不失败）；非法 → 抛 OAMP 配置错误（F07-4）；未知键忽略。
function readConfigFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {};
    }
    throw new Error(`OAMP 配置错误: 配置文件读取失败 ${filePath}（${err && err.message}）`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`OAMP 配置错误: 配置文件非合法 JSON ${filePath}（${err && err.message}）`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`OAMP 配置错误: 配置文件顶层需为对象（${filePath}）`);
  }
  const data = readSection(parsed, 'data', filePath);
  const defaults = readSection(parsed, 'defaults', filePath);
  const context = readSection(parsed, 'context', filePath);
  const max = context.max;
  if (max !== undefined && (!Number.isInteger(max) || max <= 0)) {
    throw new Error(`OAMP 配置错误: context.max 需为正整数（当前值 ${JSON.stringify(max)}）`);
  }
  return {
    db: readStringField(data, 'db', 'data', filePath),
    model: readStringField(defaults, 'model', 'defaults', filePath),
    contextMax: max,
  };
}

export function loadConfig(env = process.env) {
  const file = readConfigFile(readNonEmptyString(env.OAMP_CONFIG) || CONFIG_FILE);
  const reconnectRaw = env.OAMP_RECONNECT === undefined ? '1' : String(env.OAMP_RECONNECT);
  if (reconnectRaw !== '0' && reconnectRaw !== '1') {
    throw new Error(`OAMP 配置错误: OAMP_RECONNECT 仅支持 0/1（当前值 "${env.OAMP_RECONNECT}"）`);
  }
  return {
    socketPath: env.OAMP_SOCKET || path.join(PKG_ROOT, '.runtime', 'router.sock'),
    heartbeatIntervalMs: readPositiveInt('OAMP_HEARTBEAT_INTERVAL_MS', env),
    heartbeatTimeoutMs: readPositiveInt('OAMP_HEARTBEAT_TIMEOUT_MS', env),
    hbLogWindowMs: readPositiveInt('OAMP_HB_LOG_WINDOW_MS', env),
    // D22（demo 自愈）：断线/连接失败后自动重连重注册（0 = 旧行为：断线即退）；退避上限
    reconnect: reconnectRaw === '1',
    reconnectMaxMs: readPositiveInt('OAMP_RECONNECT_MAX_MS', env),
    // §8.2 逐键优先级：env > 配置文件 > 内置默认；相对路径基准 = 包根（与 cwd 无关），绝对路径原样
    dbPath: path.resolve(PKG_ROOT, readNonEmptyString(env.OAMP_DB) || file.db || DB_DEFAULT),
    defaultModel: readNonEmptyString(env.OAMP_OMP_MODEL) || file.model || MODEL_DEFAULT,
    contextMax: env.OAMP_CTX_MAX === undefined
      ? (file.contextMax ?? CONTEXT_MAX_DEFAULT)
      : readPositiveInt('OAMP_CTX_MAX', env),
  };
}

export default loadConfig();
