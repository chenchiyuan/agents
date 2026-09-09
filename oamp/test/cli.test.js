// test/cli.test.js — F01 可测子集：误用/缺参退出码与文案、--help、npm test 载体、零运行时依赖声明
// 一律以子进程 node bin/oamp.js 方式运行（不依赖 PATH）；超时即视为"挂起"失败（M-01/F01-4/5）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');
const RUN_TIMEOUT_MS = 5000;

function runCli(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
  });
  assert.equal(result.error, undefined, `进程挂起/启动失败（args=${JSON.stringify(args)}）`);
  assert.notEqual(result.status, null, `进程未正常退出（args=${JSON.stringify(args)}）`);
  return result;
}

function assertUsageError(result) {
  assert.equal(result.status, 2, '应退出码 2');
  assert.ok(result.stdout.length === 0, '报错应走 stderr，stdout 应为空');
  assert.match(result.stderr, /用法:/, 'stderr 应包含用法');
  assert.match(result.stderr, /router/, '用法应列出 router');
  assert.match(result.stderr, /agent/, '用法应列出 agent');
  assert.match(result.stderr, /status/, '用法应列出 status');
}

test('空参数 → 退出码 2 + stderr 用法，不挂起（M-01/F01-4）', () => {
  const result = runCli([]);
  assertUsageError(result);
});

test('未知子命令 → 退出码 2 + stderr 用法，不挂起（M-01/F01-4）', () => {
  const result = runCli(['bogus']);
  assertUsageError(result);
  assert.match(result.stderr, /未知命令: bogus/, 'stderr 应含明确报错');
});

test('非法形态：router 缺子命令 → 退出码 2 + stderr 用法（§7.1 router <其他>）', () => {
  const result = runCli(['router']);
  assertUsageError(result);
  assert.match(result.stderr, /router 子命令/, 'stderr 应含明确报错');
});

test('非法形态：agent 未知子命令 → 退出码 2 + stderr 用法（§7.1 agent <其他>）', () => {
  const result = runCli(['agent', 'foo']);
  assertUsageError(result);
  assert.match(result.stderr, /agent 子命令: foo/, 'stderr 应含明确报错');
});

test('agent start 缺 instance-id → 退出码 2 + stderr 指明 instance-id，不挂起（F01-5/M-01）', () => {
  const result = runCli(['agent', 'start']);
  assertUsageError(result);
  assert.match(result.stderr, /missing required argument: instance-id/, '报错应明确指出缺失 instance-id');
});

test('-h → 退出码 0 + stdout 用法', () => {
  const result = runCli(['-h']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /用法:/);
  assert.match(result.stdout, /agent start <instance-id>/);
});

test('--help → 退出码 0 + stdout 用法', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /用法:/);
  assert.match(result.stdout, /router start/);
  assert.match(result.stdout, /status/);
});

test('package.json 载体：npm test 入口 + 零运行时依赖声明（F01-1/2，§10.2）', () => {
  const pkg = JSON.parse(readFileSync(path.join(OAMP_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'oamp');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin && pkg.bin.oamp, './bin/oamp.js');
  assert.equal(pkg.engines && pkg.engines.node, '>=22');
  assert.equal(pkg.scripts && pkg.scripts.test, 'node --test test/*.test.js');
  assert.deepEqual(pkg.dependencies === undefined ? {} : pkg.dependencies, {}, '不得声明第三方运行时依赖');
});
