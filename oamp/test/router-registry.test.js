// test/router-registry.test.js — F02 进程级/注册表验收（PR-002 验收第 1 条部分 + prd F02）
// 以真实 Router 子进程 + 真实 agent 子进程驱动；Router 事件行 / router.status 快照为断言锚点。
// 每个用例独立临时 socket + 缩短 env；teardown 清理进程与临时目录（§10.2）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, queryStatus, waitFor, stopAll } from './helpers/harness.js';

async function statusOf(socketPath, instanceId) {
  const snap = await queryStatus(socketPath);
  const nodes = (snap && snap.nodes) || [];
  return nodes.find((n) => n.instance_id === instanceId) || null;
}

test('F02-1/2：注册成功——AGENT_REGISTERED 事件 + status 快照含四字段条目（state=online, session=UUID）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  const regLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const node = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'status 快照出现 dev-1' });

  assert.match(regLine, /\[.+\] router AGENT_REGISTERED instance=dev-1 session=[0-9a-f-]{36} state=online/);
  assert.equal(node.state, 'online');
  assert.match(node.session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(typeof node.last_heartbeat, 'number');
  assert.ok(node.last_heartbeat > 0);
});

test('F02-3：两个不同 instance_id 同时 online，互不影响（E3）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a1 = await startAgent('dev-1', { socketPath: router.socketPath });
  const a2 = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => a1.stop());
  t.after(() => a2.stop());

  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-2 session=/);

  const n1 = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });
  const n2 = await waitFor(() => statusOf(router.socketPath, 'dev-2'), { what: 'dev-2 online' });
  assert.equal(n1.state, 'online');
  assert.equal(n2.state, 'online');
  assert.notEqual(n1.session_id, n2.session_id);
  // 各自心跳推进不互相影响
  const hb1a = (await statusOf(router.socketPath, 'dev-1')).last_heartbeat;
  const hb2a = (await statusOf(router.socketPath, 'dev-2')).last_heartbeat;
  await waitFor(async () => {
    const n1b = await statusOf(router.socketPath, 'dev-1');
    const n2b = await statusOf(router.socketPath, 'dev-2');
    return n1b && n2b && n1b.last_heartbeat > hb1a && n2b.last_heartbeat > hb2a;
  }, { what: '两个节点 last_heartbeat 各自推进' });
});

test('F02-4/D4：同 id live 冲突——AGENT_REPLACED + 替换后仅一个 live session（latest-wins）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a1 = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => a1.stop());
  const firstLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const firstSession = firstLine.match(/session=([0-9a-f-]{36})/)[1];

  // 第二进程同 id 注册 → 替换
  const a2 = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => a2.stop());
  const replacedLine = await router.waitRouterLine(/AGENT_REPLACED instance=dev-1 /);
  const newSession = replacedLine.match(/new_session=([0-9a-f-]{36})/)[1];
  assert.equal(replacedLine.match(/old_session=([0-9a-f-]{36})/)[1], firstSession);

  // 旧进程被 Router 顶替：收到 agent.replaced 通知 → 打 REPLACED 并退出 1（不重连，防同 id 互踢）
  await a1.waitAgentLine(/REPLACED instance=dev-1/);
  const oldExit = await waitFor(() => a1.getExitInfo(), { what: '旧 agent 退出' });
  assert.equal(oldExit.code, 1);

  // 快照中 dev-1 恰一条、state=online、session=new
  const snap = await queryStatus(router.socketPath);
  const dev1s = snap.nodes.filter((n) => n.instance_id === 'dev-1');
  assert.equal(dev1s.length, 1, '同 id 至多一个 live 条目');
  assert.equal(dev1s[0].state, 'online');
  assert.equal(dev1s[0].session_id, newSession);
});

test('F02-5/E1：offline 条目同 id 重注册复活（kill → offline → 重启同 id → online 新 session）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a1 = await startAgent('dev-1', { socketPath: router.socketPath });
  const regLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const session1 = regLine.match(/session=([0-9a-f-]{36})/)[1];

  // 强杀（无 deregister）→ Router 租约判定 offline
  a1.kill('SIGKILL');
  await router.waitRouterLine(/AGENT_OFFLINE instance=dev-1/);
  const off = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'offline 条目出现' });
  assert.equal(off.state, 'offline');

  // 同 id 重注册 → 复活为新 online session
  const a2 = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => a2.stop());
  const reg2 = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/, 2);
  const session2 = reg2.match(/session=([0-9a-f-]{36})/)[1];
  assert.notEqual(session2, session1);
  const back = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 复活 online' });
  assert.equal(back.state, 'online');
  assert.equal(back.session_id, session2);
});

test('F02-6/§5.4：deregister（优雅 SIGINT）后条目删除，不再 online', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });

  const exit = await agent.stop(); // SIGINT → deregister → 退出 0
  assert.equal(exit.code, 0);
  await router.waitRouterLine(/AGENT_DEREGISTERED instance=dev-1/);
  // deregister = 删除条目：快照不再含 dev-1
  await waitFor(async () => (await statusOf(router.socketPath, 'dev-1')) === null, { what: 'dev-1 条目被删除' });
});

test('F02-7/§5.1：socket 文件权限位 stat 为 0600', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const st = fs.statSync(router.socketPath);
  assert.equal(st.mode & 0o777, 0o600, `socket 权限应为 0600，实际 ${(st.mode & 0o777).toString(8)}`);
});

test('F02-8/D16：Router SIGINT 干净退出 0、不悬挂、socket 文件被删', async (t) => {
  const router = await startRouter();
  t.after(() => router.cleanup());
  const sockPath = router.socketPath;
  const exit = await router.stop();
  assert.equal(exit.code, 0);
  assert.equal(fs.existsSync(sockPath), false, '退出后 socket 文件应被删除');
});

test('F02（进程级）：agent connect 失败（Router 未运行）+ OAMP_RECONNECT=0 → stderr 含 socket 路径提示 + 退出 1', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-test-'));
  const sock = path.join(tmpDir, 'nope.sock');
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(process.execPath, [path.join(root, 'bin', 'oamp.js'), 'agent', 'start', 'dev-x'], {
    cwd: root,
    // OAMP_RECONNECT=0：本用例固定"旧行为"（断线/连接失败即退）——默认自愈行为由 reconnect.test.js 覆盖
    env: { ...process.env, OAMP_SOCKET: sock, OAMP_RECONNECT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => (err += d));
  const code = await new Promise((res) => child.once('exit', (c) => res(c)));
  assert.equal(code, 1);
  assert.match(err, /无法连接\/注册 oamp router/);
  assert.ok(err.includes(sock), 'stderr 应含 socket 路径');
});
