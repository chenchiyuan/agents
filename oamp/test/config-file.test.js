// test/config-file.test.js — F07 配置面：JSON 配置文件 + 三新键 + 逐键优先级 + 非法快速失败
// （architecture §8.1~§8.3 / AR-14；pr-001 验收 1~3）。
// 库路径基准 = 包根（与 cwd 无关），故断言绝对路径；配置文件一律放临时目录，不写 oamp/。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = path.join(OAMP_ROOT, 'data', 'sql.db');
const DEFAULT_MODEL = 'openai/gpt-5.6-luna';

// 每个用例独立临时目录：写文件用 writeConfig，缺失场景用 missingConfig
function configDir() {
  return mkdtempSync(path.join(tmpdir(), 'oamp-config-'));
}

function writeConfig(content) {
  const file = path.join(configDir(), 'config.json');
  writeFileSync(file, content);
  return file;
}

function missingConfig() {
  return path.join(configDir(), 'config.json');
}

test('无配置文件：新增三键取内置默认，既有六键取值逐字不变（验收 1 / §8.2~§8.3）', () => {
  const config = loadConfig({ OAMP_CONFIG: missingConfig() });
  assert.deepEqual(config, {
    socketPath: path.join(OAMP_ROOT, '.runtime', 'router.sock'),
    heartbeatIntervalMs: 10000,
    heartbeatTimeoutMs: 30000,
    hbLogWindowMs: 60000,
    reconnect: true,
    reconnectMaxMs: 10000,
    dbPath: DEFAULT_DB,
    defaultModel: DEFAULT_MODEL,
    contextMax: 8,
  });
  assert.ok(path.isAbsolute(config.dbPath), 'dbPath 应为绝对路径（与 cwd 无关）');
});

test('配置文件指定三键：缺失项才回落默认（验收 2 / F07-2 / §8.2）', () => {
  const file = writeConfig(JSON.stringify({ data: { db: 'var/custom/sql.db' }, defaults: { model: 'x/y' }, context: { max: 3 } }));
  const config = loadConfig({ OAMP_CONFIG: file });
  assert.equal(config.dbPath, path.join(OAMP_ROOT, 'var', 'custom', 'sql.db'));
  assert.equal(config.defaultModel, 'x/y');
  assert.equal(config.contextMax, 3);
});

test('env 三键优先于配置文件（验收 2 / F07-5 / §8.2）', () => {
  const file = writeConfig(JSON.stringify({ data: { db: 'file.db' }, defaults: { model: 'file/model' }, context: { max: 3 } }));
  const config = loadConfig({
    OAMP_CONFIG: file,
    OAMP_DB: 'env.db',
    OAMP_OMP_MODEL: 'env/model',
    OAMP_CTX_MAX: '5',
  });
  assert.equal(config.dbPath, path.join(OAMP_ROOT, 'env.db'));
  assert.equal(config.defaultModel, 'env/model');
  assert.equal(config.contextMax, 5);
});

test('优先级逐键独立：只覆盖 db 时其余键取文件值（验收 2 / §8.2）', () => {
  const file = writeConfig(JSON.stringify({ data: { db: 'file.db' }, defaults: { model: 'file/model' }, context: { max: 3 } }));
  const config = loadConfig({ OAMP_CONFIG: file, OAMP_DB: 'env.db' });
  assert.equal(config.dbPath, path.join(OAMP_ROOT, 'env.db'));
  assert.equal(config.defaultModel, 'file/model');
  assert.equal(config.contextMax, 3);
});

test('dbPath 相对路径按包根解析、绝对路径原样保留（F07-1 / §8.3）', () => {
  const absolute = path.join(configDir(), 'abs.db');
  assert.equal(loadConfig({ OAMP_CONFIG: missingConfig(), OAMP_DB: absolute }).dbPath, absolute);
  assert.equal(loadConfig({ OAMP_CONFIG: missingConfig(), OAMP_DB: 'rel/sql.db' }).dbPath, path.join(OAMP_ROOT, 'rel', 'sql.db'));
});

test('空串 env 视为未提供，继续向下一级取值（I-1 / §8.2）', () => {
  const file = writeConfig(JSON.stringify({ data: { db: 'file.db' }, defaults: { model: 'file/model' } }));
  const config = loadConfig({ OAMP_CONFIG: file, OAMP_DB: '  ', OAMP_OMP_MODEL: '' });
  assert.equal(config.dbPath, path.join(OAMP_ROOT, 'file.db'));
  assert.equal(config.defaultModel, 'file/model');
});

test('配置文件非法 → 抛「OAMP 配置错误」（验收 3 / F07-4 / §8.3）', () => {
  const cases = [
    ['JSON 语法错', '{ "data": '],
    ['顶层为数组', '[]'],
    ['顶层为字符串', '"nope"'],
    ['顶层为 null', 'null'],
    ['data 非对象', '{"data": 1}'],
    ['data.db 非字符串', '{"data": {"db": 1}}'],
    ['data.db 空串', '{"data": {"db": "  "}}'],
    ['defaults.model 非字符串', '{"defaults": {"model": 8}}'],
    ['defaults.model 空串', '{"defaults": {"model": ""}}'],
    ['context 非对象', '{"context": []}'],
    ['context.max 为 0', '{"context": {"max": 0}}'],
    ['context.max 为负数', '{"context": {"max": -1}}'],
    ['context.max 为小数', '{"context": {"max": 1.5}}'],
    ['context.max 为字符串', '{"context": {"max": "8"}}'],
  ];
  for (const [name, content] of cases) {
    const file = writeConfig(content);
    assert.throws(() => loadConfig({ OAMP_CONFIG: file }), /OAMP 配置错误/, `应快速失败: ${name}`);
  }
});

test('未知键忽略，不报错（§8.3）', () => {
  const file = writeConfig(JSON.stringify({ unknown: { a: 1 }, data: { db: 'file.db', other: 2 } }));
  const config = loadConfig({ OAMP_CONFIG: file });
  assert.equal(config.dbPath, path.join(OAMP_ROOT, 'file.db'));
  assert.equal(config.contextMax, 8);
});

test('既有键回归：env 覆盖与校验行为不变（验收 1）', () => {
  const env = { OAMP_CONFIG: missingConfig(), OAMP_SOCKET: '/tmp/x.sock', OAMP_HEARTBEAT_INTERVAL_MS: '1234', OAMP_RECONNECT: '0' };
  const config = loadConfig(env);
  assert.equal(config.socketPath, '/tmp/x.sock');
  assert.equal(config.heartbeatIntervalMs, 1234);
  assert.equal(config.reconnect, false);

  assert.throws(() => loadConfig({ OAMP_CONFIG: missingConfig(), OAMP_HEARTBEAT_INTERVAL_MS: '0' }), /OAMP 配置错误/);
  assert.throws(() => loadConfig({ OAMP_CONFIG: missingConfig(), OAMP_HEARTBEAT_TIMEOUT_MS: 'abc' }), /OAMP 配置错误/);
  assert.throws(() => loadConfig({ OAMP_CONFIG: missingConfig(), OAMP_RECONNECT: '2' }), /OAMP 配置错误/);
});
