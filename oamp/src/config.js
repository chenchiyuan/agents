// src/config.js — 运行参数：默认值 + env 覆盖 + 数值校验（architecture §7.2 配置面）
// 叶子模块：只依赖 node: 内置模块，不 import src 内任何模块。
// 被 router/agent/status 进程入口消费（本 PR 交付模块本体，消费随 pr-002/003 接入）。
// socket 默认路径按本模块位置推导包根（与 cwd 无关），产物落点 oamp/.runtime/（§5.1/D2）。

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NUMERIC_DEFAULTS = {
  OAMP_HEARTBEAT_INTERVAL_MS: 10000,
  OAMP_HEARTBEAT_TIMEOUT_MS: 30000,
  OAMP_HB_LOG_WINDOW_MS: 60000,
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

export function loadConfig(env = process.env) {
  return {
    socketPath: env.OAMP_SOCKET || path.join(PKG_ROOT, '.runtime', 'router.sock'),
    heartbeatIntervalMs: readPositiveInt('OAMP_HEARTBEAT_INTERVAL_MS', env),
    heartbeatTimeoutMs: readPositiveInt('OAMP_HEARTBEAT_TIMEOUT_MS', env),
    hbLogWindowMs: readPositiveInt('OAMP_HB_LOG_WINDOW_MS', env),
  };
}

export default loadConfig();
