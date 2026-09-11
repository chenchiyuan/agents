// test/reconnect.test.js — D22 agent 自愈契约测试：断线/连接失败 → 退避重连重注册
// 场景：Router 崩溃后重启 → agent 自动恢复；启动时 Router 未就绪 → 等待并自动接入；
//       OAMP_RECONNECT=0 保留旧行为（断线即退）；被顶替（agent.replaced）不重连。
// 载体：harness 真实 Router + 真实 CLI agent 子进程（复用 socketPath 以模拟 Router 重启）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { startRouter, startAgent, waitFor, stopAll } from './helpers/harness.js';
import { RpcPeer } from '../src/rpc.js';

const FAST_RECONNECT = { OAMP_RECONNECT_MAX_MS: '500' }; // 测试用短退避上限

async function fetchStatus(socketPath) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'rc' });
  try {
    return await peer.request('router.status', {}, { timeoutMs: 3000 });
  } finally {
    peer.close();
  }
}

test('自愈：Router 崩溃（SIGKILL）→ agent 不退出并等待 → 同路径重启 Router → 自动重注册 online', async (t) => {
  const router = await startRouter();
  const sock = router.socketPath;
  const a1 = await startAgent('dev-1', { socketPath: sock, envExtra: FAST_RECONNECT });
  t.after(() => a1.stop());

  const reg1 = await a1.waitAgentLine(/REGISTERED instance=dev-1 session=/);
  const session1 = reg1.match(/session=([0-9a-f-]{36})/)[1];

  // Router 模拟崩溃（SIGKILL：不留优雅退出路径，socket 文件残留）
  router.kill('SIGKILL');
  await waitFor(() => router.getExitInfo(), { what: 'Router 进程退出' });

  // agent 感知断线 → 不退出，进入重连等待
  await a1.waitAgentLine(/CONNECTION_LOST instance=dev-1/);
  await a1.waitAgentLine(/RECONNECT_WAIT instance=dev-1 /);
  assert.equal(a1.getExitInfo(), null, 'agent 不应因断线退出（自愈模式）');

  // 同路径重启 Router（陈旧 socket 由 Router 启动清理逻辑处理）
  const router2 = await startRouter({ socketPath: sock, envExtra: FAST_RECONNECT });
  t.after(() => stopAll([router2]));

  // agent 自动重注册（第 2 条 REGISTERED = 重连后的新会话）
  const reg2 = await a1.waitAgentLine(/REGISTERED instance=dev-1 session=/, 2);
  const session2 = reg2.match(/session=([0-9a-f-]{36})/)[1];
  assert.notEqual(session2, session1, '重连应为新 session');

  const snap = await waitFor(async () => {
    const res = await fetchStatus(sock);
    const node = res.nodes.find((n) => n.instance_id === 'dev-1');
    return node && node.state === 'online' ? node : null;
  }, { what: 'dev-1 重连后 online' });
  assert.equal(snap.session_id, session2);

  // 重连后心跳继续推进
  await waitFor(async () => {
    const res = await fetchStatus(sock);
    const node = res.nodes.find((n) => n.instance_id === 'dev-1');
    return node && node.last_heartbeat >= snap.last_heartbeat;
  }, { what: '重连后心跳继续' });
});

test('自愈：启动时 Router 未运行 → agent 等待重试（不退出）→ Router 起来后自动注册', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-rc-'));
  const sock = path.join(tmpDir, 'router.sock');
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const a1 = await startAgent('dev-late', { socketPath: sock, envExtra: FAST_RECONNECT });
  t.after(() => a1.stop());

  // 连接失败 → 进入重连等待且进程存活
  await a1.waitAgentLine(/RECONNECT_WAIT instance=dev-late /);
  assert.equal(a1.getExitInfo(), null, '启动期连接失败不应退出（自愈模式）');

  // Router 就绪 → agent 自动注册
  const router = await startRouter({ socketPath: sock, envExtra: FAST_RECONNECT });
  t.after(() => stopAll([router]));
  await a1.waitAgentLine(/REGISTERED instance=dev-late session=/);
});

test('旧行为保留：OAMP_RECONNECT=0 时断线即退出 1（不重连）', async (t) => {
  const router = await startRouter();
  const a1 = await startAgent('dev-old', { socketPath: router.socketPath, envExtra: { OAMP_RECONNECT: '0' } });
  await a1.waitAgentLine(/REGISTERED instance=dev-old/);

  router.kill('SIGKILL');
  await a1.waitAgentLine(/CONNECTION_LOST instance=dev-old/);
  const exit = await waitFor(() => a1.getExitInfo(), { what: 'agent 退出（旧行为）' });
  assert.equal(exit.code, 1);
});

test('被顶替不重连：同 id 第二进程注册 → 旧进程 REPLACED 退出 1', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a1 = await startAgent('dev-dup', { socketPath: router.socketPath, envExtra: FAST_RECONNECT });
  await a1.waitAgentLine(/REGISTERED instance=dev-dup/);

  const a2 = await startAgent('dev-dup', { socketPath: router.socketPath, envExtra: FAST_RECONNECT });
  t.after(() => a2.stop());

  await a1.waitAgentLine(/REPLACED instance=dev-dup/);
  const exit = await waitFor(() => a1.getExitInfo(), { what: '旧进程退出' });
  assert.equal(exit.code, 1);
  assert.equal(a1.stdout.matching(/RECONNECT_WAIT/).length, 0, '被顶替不应重连');
});
