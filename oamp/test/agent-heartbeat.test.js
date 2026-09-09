// test/agent-heartbeat.test.js — F03（真实 agent 子进程生命周期）+ F04（kill→offline 租约判定）
// PR-002 验收第 2/3 条。真实 CLI agent 子进程 `node bin/oamp.js agent start <id>` + 缩短 env；
// 断言锚点：Router 事件行（AGENT_REGISTERED/AGENT_DEREGISTERED/AGENT_OFFLINE）+ router.status 快照 last_heartbeat。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRouter, startAgent, queryStatus, waitFor, stopAll } from './helpers/harness.js';

async function statusOf(socketPath, instanceId) {
  const snap = await queryStatus(socketPath);
  const nodes = (snap && snap.nodes) || [];
  return nodes.find((n) => n.instance_id === instanceId) || null;
}

test('F03-1：真实 agent 子进程注册成功——Router 侧 AGENT_REGISTERED + agent 侧 REGISTERED', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  const routerLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const agentLine = await agent.waitAgentLine(/\[.+\] agent REGISTERED instance=dev-1 session=/);
  assert.match(routerLine, /state=online/);
  assert.match(agentLine, /lease_timeout_ms=300/);

  const node = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });
  assert.equal(node.state, 'online');
  assert.equal(node.last_heartbeat > 0, true);
});

test('F03-2/F04-1：last_heartbeat 随周期心跳推进（两次 status 快照对比）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);

  const first = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: '首次快照' });
  const t0 = first.last_heartbeat;
  // 心跳 interval=50ms：等数个周期后 last_heartbeat 单调增长
  const second = await waitFor(async () => {
    const n = await statusOf(router.socketPath, 'dev-1');
    return n && n.last_heartbeat > t0 ? n : null;
  }, { what: 'last_heartbeat 推进', timeoutMs: 3000 });
  assert.ok(second.last_heartbeat > t0, 'last_heartbeat 应随心跳单调增长');
});

test('F03-3/D16：SIGINT → 先 deregister 再退出码 0，不悬挂；Router 侧 AGENT_DEREGISTERED', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);

  const exit = await agent.stop(); // SIGINT
  assert.equal(exit.code, 0);
  assert.equal(exit.signal, null);
  await router.waitRouterLine(/AGENT_DEREGISTERED instance=dev-1/);
  await agent.waitAgentLine(/DEREGISTERED instance=dev-1/);
  await waitFor(async () => (await statusOf(router.socketPath, 'dev-1')) === null, { what: 'deregister 后条目删除' });
});

test('F03-4/E3：两个不同 instance_id agent 同时存活、各自心跳互不影响', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a1 = await startAgent('dev-1', { socketPath: router.socketPath });
  const a2 = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => a1.stop());
  t.after(() => a2.stop());

  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-2 session=/);

  const n1a = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online' });
  const n2a = await waitFor(() => statusOf(router.socketPath, 'dev-2'), { what: 'dev-2 online' });
  const h1 = n1a.last_heartbeat;
  const h2 = n2a.last_heartbeat;

  // 双 agent 同时推进（心跳彼此独立，Router 单表双条目）
  await waitFor(async () => {
    const b1 = await statusOf(router.socketPath, 'dev-1');
    const b2 = await statusOf(router.socketPath, 'dev-2');
    return b1 && b2 && b1.last_heartbeat > h1 && b2.last_heartbeat > h2 ? true : null;
  }, { what: '双 agent last_heartbeat 同步推进', timeoutMs: 3000 });

  const snap = await queryStatus(router.socketPath);
  assert.equal(snap.nodes.filter((n) => n.state === 'online').length, 2);
});

test('F04-2/§5.6：强杀 agent（无 deregister）→ Router 在 timeout+sweep 上界内自动判 offline 并打 AGENT_OFFLINE', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'dev-1 online 基线' });

  // 强杀（无机会 deregister）
  agent.kill('SIGKILL');
  const t0 = Date.now();
  // 判定上界 ≈ timeout(300ms) + sweep(clamp(300/4)=75ms) + 余量；waitFor 兜底宽裕
  const offlineLine = await router.waitRouterLine(/AGENT_OFFLINE instance=dev-1/, { timeoutMs: 3000 });
  const elapsed = Date.now() - t0;
  assert.match(offlineLine, /\[.+\] router AGENT_OFFLINE instance=dev-1/);
  assert.ok(elapsed < 2500, `offline 判定应在宽松上界内完成（实测 ${elapsed}ms）`);

  const node = await waitFor(() => statusOf(router.socketPath, 'dev-1'), { what: 'offline 状态' });
  assert.equal(node.state, 'offline');
});

test('F04-4/§5.6：正常周期心跳期间不误判 offline（持续 >2×timeout 仍 online、无 AGENT_OFFLINE）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);

  // 缩短 env：timeout=300ms；观察 900ms（3×timeout），正常心跳不应判 offline
  const end = Date.now() + 900;
  let sawOffline = false;
  let last = 0;
  while (Date.now() < end) {
    if (router.stdout.lines.some((l) => l.includes('AGENT_OFFLINE instance=dev-1'))) {
      sawOffline = true;
      break;
    }
    const n = await statusOf(router.socketPath, 'dev-1');
    if (n) {
      assert.equal(n.state, 'online', '心跳存活期间不得 offline');
      last = n.last_heartbeat;
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  assert.equal(sawOffline, false, '心跳正常期间不得出现 AGENT_OFFLINE');
  assert.ok(last > 0, '期间应观测到心跳快照');
});
