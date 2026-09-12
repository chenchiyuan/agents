// test/status.test.js — F05 status 只读查询验收（PR-003 验收 4 条 + prd F05 1-5 + M-02 + §7.3）
// 以真实 Router + 真实 agent 子进程驱动 `node bin/oamp.js status`（临时 socket + 缩短 env，§10.2）。
// 断言面：stdout 对齐表格字段/排序/格式、Router 不可达失败三面（退出码/stderr/stdout）、
// 只读无副作用（连续两次查询一致）、kill 后 offline 反映、零节点合法空态。
// 每用例独立临时 socket + teardown 清理；时序断言统一 waitFor 轮询（§10.2）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  startRouter,
  startAgent,
  queryStatus,
  waitFor,
  stopAll,
  makeTempSocketDir,
  buildEnv,
} from './helpers/harness.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');
const RUN_TIMEOUT_MS = 5000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HEADER_RE = /^instance_id\s{2,}session_id\s{2,}state\s{2,}last_heartbeat$/;

/** 子进程运行 `node bin/oamp.js status`（OAMP_SOCKET=临时路径 + 缩短 env），返回 {code, stdout, stderr}。 */
function runStatusCli(socketPath) {
  const env = buildEnv(socketPath);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, 'status'], { cwd: OAMP_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('status 子进程挂起（超时未退出）'));
    }, RUN_TIMEOUT_MS);
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** 解析 status stdout：首行须为四列表头；返回数据行（每行 4 字段数组）。 */
function parseStatus(stdout) {
  const nonEmpty = stdout.split('\n').filter((l) => l.length > 0);
  assert.ok(nonEmpty.length >= 1, 'stdout 应含表头行');
  assert.match(nonEmpty[0], HEADER_RE, '首行应为四列表头');
  const rows = nonEmpty.slice(1).map((l) => l.split(/\s{2,}/).filter(Boolean));
  for (const row of rows) {
    assert.equal(row.length, 4, `数据行应恰 4 字段，实际 ${row.length}`);
  }
  return rows;
}

async function statusOf(socketPath, instanceId) {
  const snap = await queryStatus(socketPath);
  const nodes = (snap && snap.nodes) || [];
  return nodes.find((n) => n.instance_id === instanceId) || null;
}

test('F05-1/2 + §7.3/D8：多节点表格——四字段齐全、按 instance_id 排序、字段与注册快照一致', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  // 乱序启动（dev-2 先于 dev-1）以证明输出按 instance_id 排序而非注册序
  const a2 = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => a2.stop());
  const a1 = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => a1.stop());
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-2 session=/);
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => statusOf(router.socketPath, 'dev-1') && statusOf(router.socketPath, 'dev-2'), {
    what: '两节点均 online',
  });

  // 竞态消除（V1 偏差）：基准快照 base 须在 runStatusCli 之前取得（T_base < T_cli），
  // 以其 last_heartbeat 作 CLI 输出时间戳的下限——注册表 last_heartbeat 单调不减，断言必然成立。
  // 不得用更晚的 queryStatus 快照作下限去比较更早的 CLI 输出（晚快照心跳可能已推进越过 CLI 时点）。
  const base = await queryStatus(router.socketPath);

  const res = await runStatusCli(router.socketPath);
  assert.equal(res.code, 0, 'status 成功应退出 0');
  assert.equal(res.stderr, '', '成功路径 stderr 应为空');

  const rows = parseStatus(res.stdout);
  assert.equal(rows.length, 2, '应恰 2 个节点数据行');
  assert.equal(rows[0][0], 'dev-1', '首行应为 instance_id 最小的节点');
  assert.equal(rows[1][0], 'dev-2', '次行应为 instance_id 较大的节点');

  for (const [instanceId, row] of [
    ['dev-1', rows[0]],
    ['dev-2', rows[1]],
  ]) {
    const node = (base.nodes || []).find((n) => n.instance_id === instanceId);
    assert.ok(node, `基准快照应含 ${instanceId}`);
    assert.match(row[1], UUID_RE, 'session_id 应为 36 字符 UUID 形态');
    assert.equal(row[1], node.session_id, '输出 session_id 应与注册快照一致（测试期间无同 id 重注册，会话稳定）');
    assert.equal(row[2], node.state, '输出 state 应与注册快照一致');
    assert.equal(row[2], 'online');
    assert.match(row[3], ISO_RE, 'last_heartbeat 应为 UTC ISO-8601（毫秒 Z 后缀）');
    assert.ok(
      Date.parse(row[3]) >= node.last_heartbeat,
      '输出 last_heartbeat 不应早于 CLI 前的基准快照时点（注册表单调不减）',
    );
  }
});

test('M-02/F05-3：Router 未运行 → 退出码 1 + stderr 含 socket 路径与提示 + stdout 空（不冒充成功）', async (t) => {
  const tmpDir = makeTempSocketDir();
  const sock = path.join(tmpDir, 'nope.sock');
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const res = await runStatusCli(sock);
  assert.equal(res.code, 1, 'Router 不可达应退出码 1');
  assert.equal(res.stdout, '', '失败路径不得输出表头/空表格冒充成功');
  assert.match(res.stderr, /无法连接 oamp router/, 'stderr 应含 router 不可达错误');
  assert.ok(res.stderr.includes(sock), 'stderr 应含 socket 路径');
  assert.match(res.stderr, /router 未运行/, 'stderr 应含 router 未运行提示');
});

test('F05-4：只读无副作用——连续两次 status 仅 last_heartbeat 自然推进、注册表不变', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });

  const before = await queryStatus(router.socketPath);
  const run1 = await runStatusCli(router.socketPath);
  const run2 = await runStatusCli(router.socketPath);
  assert.equal(run1.code, 0);
  assert.equal(run2.code, 0);
  const rows1 = parseStatus(run1.stdout);
  const rows2 = parseStatus(run2.stdout);
  assert.equal(rows1.length, 1);
  assert.equal(rows2.length, 1);
  const r1 = rows1[0];
  const r2 = rows2[0];

  // 两轮输出：instance/session/state 完全一致；last_heartbeat 仅随心跳推进（第二轮 ≥ 第一轮）
  assert.equal(r1[0], 'dev-1');
  assert.deepEqual([r1[0], r1[1], r1[2]], [r2[0], r2[1], r2[2]], '两轮查询的 id/session/state 应一致');
  assert.equal(r1[2], 'online');
  assert.ok(Date.parse(r2[3]) > Date.parse(r1[3]), 'last_heartbeat 第二轮应严格推进（仅自然推进）');

  // 注册表内容不变：两次查询后快照的条目集合/session/state 与查询前一致
  const after = await queryStatus(router.socketPath);
  const beforeNodes = before.nodes || [];
  const afterNodes = after.nodes || [];
  assert.deepEqual(
    afterNodes.map((n) => [n.instance_id, n.session_id, n.state]),
    beforeNodes.map((n) => [n.instance_id, n.session_id, n.state]),
    '查询不得改变注册表条目集合/session/state',
  );

  // 查询未扰动节点：agent 仍存活且心跳继续推进
  assert.equal(agent.getExitInfo(), null, 'status 查询不应导致 agent 退出');
  const t2 = Date.parse(r2[3]);
  await waitFor(async () => (await statusOf(router.socketPath, 'dev-1')).last_heartbeat > t2, {
    what: 'status 查询后心跳继续推进（节点未被扰动）',
  });
});

test('F05-5/E2：kill 节点（无 deregister）后 status 显示 offline（墓碑保留）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  const regLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const session = regLine.match(/session=([0-9a-f-]{36})/)[1];
  await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });

  // 强杀（无 deregister）→ Router 租约扫描判 offline
  agent.kill('SIGKILL');
  await router.waitRouterLine(/AGENT_OFFLINE instance=dev-1/);
  await waitFor(async () => (await statusOf(router.socketPath, 'dev-1')).state === 'offline', {
    what: '快照中 dev-1 offline',
  });

  const res = await runStatusCli(router.socketPath);
  assert.equal(res.code, 0, 'offline 是合法状态，status 仍应退出 0');
  const rows = parseStatus(res.stdout);
  assert.equal(rows.length, 1);
  const [instanceId, sess, state, hb] = rows[0];
  assert.equal(instanceId, 'dev-1');
  assert.equal(sess, session, 'offline 墓碑保留原 session_id');
  assert.equal(state, 'offline', 'kill 后 status 应显示 offline（E2）');
  assert.match(hb, ISO_RE);
});

test('§7.3：Router 运行但零节点 → 表头 + 无数据行，退出 0（合法空态，与 M-02 失败空态可区分）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));

  const res = await runStatusCli(router.socketPath);
  assert.equal(res.code, 0, '零节点是合法状态，应退出 0');
  assert.equal(res.stderr, '');
  const nonEmpty = res.stdout.split('\n').filter((l) => l.length > 0);
  assert.equal(nonEmpty.length, 1, '零节点应仅输出表头一行');
  assert.match(nonEmpty[0], HEADER_RE);
});
