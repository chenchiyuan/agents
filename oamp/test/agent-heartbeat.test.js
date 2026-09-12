// test/agent-heartbeat.test.js — F03（真实 agent 子进程生命周期）+ F04（kill→offline 租约判定）
// PR-002 验收第 2/3 条。真实 CLI agent 子进程 `node bin/oamp.js agent start <id>` + 缩短 env；
// 断言锚点：Router 事件行（AGENT_REGISTERED/AGENT_DEREGISTERED/AGENT_OFFLINE）+ router.status 快照 last_heartbeat。
// PR-001 追加段（F03 心跳两档，architecture §3 硬契约①）：heartbeatPlan 纯函数三边界 / registry 阈值公式唯一落点 /
// 端到端档位（SHORT_ENV 50→300ms）/ 旧 Router 降级（缺 lease_follows_interval）。既有用例零改写。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { startRouter, startAgent, queryStatus, waitFor, stopAll, makeTempSocketDir } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { RpcPeer } from '../src/rpc.js';
import { createRegistry } from '../src/registry.js';
import { heartbeatPlan } from '../src/agent.js';

async function statusOf(socketPath, instanceId) {
  const snap = await queryStatus(socketPath);
  const nodes = (snap && snap.nodes) || [];
  return nodes.find((n) => n.instance_id === instanceId) || null;
}

/** 经 UDS 调 router.task_get（任务终态判定用）。 */
async function queryTask(socketPath, taskId) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'hbq' });
  try {
    const r = await peer.request('router.task_get', { task_id: taskId }, { timeoutMs: 3000 });
    return r.task;
  } finally {
    peer.close();
  }
}

/** 从 from 起统计匹配行数（不节流的 HEARTBEAT_SENT = 验收 1/2/3 的直接计数源，§3.6）。 */
function countMatching(lines, re, from = 0) {
  let n = 0;
  for (let i = from; i < lines.length; i += 1) {
    if (re.test(lines[i])) n += 1;
  }
  return n;
}

function firstMatching(lines, re, from = 0) {
  for (let i = from; i < lines.length; i += 1) {
    if (re.test(lines[i])) return lines[i];
  }
  return null;
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

// ─────────────────────── PR-001：F03 心跳两档（§3 硬契约①） ───────────────────────

test('F03-8/§3.4：heartbeatPlan 只有两个形状（三边界：< idleMs / === idleMs / idleMs === null）', () => {
  const active = heartbeatPlan({ idleForMs: 59_999, activeMs: 10_000, idleMs: 60_000 });
  assert.deepEqual(active, { tier: 'active', intervalMs: 10_000 });
  const idle = heartbeatPlan({ idleForMs: 60_000, activeMs: 10_000, idleMs: 60_000 });
  assert.deepEqual(idle, { tier: 'idle', intervalMs: 60_000 });
  const noIdle = heartbeatPlan({ idleForMs: Number.MAX_SAFE_INTEGER, activeMs: 10_000, idleMs: null });
  assert.deepEqual(noIdle, { tier: 'active', intervalMs: 10_000 });
  for (const plan of [active, idle, noIdle]) {
    assert.deepEqual(Object.keys(plan).sort(), ['intervalMs', 'tier'], '档位返回值只有 {tier, intervalMs}（不存在第三档）');
  }
});

/** 建一条已 heartbeat 的条目并返回其在 now+deltaMs 的到期判定（基准 baseMs）。 */
function announceAndExpire({ announce, baseMs, deltaMs }) {
  const registry = createRegistry();
  const now = 1_000_000;
  registry.register({ instanceId: 'x', sessionId: 's-x', connId: 1, now });
  const hb = { instanceId: 'x', sessionId: 's-x', now };
  if (announce !== undefined) hb.nextIntervalMs = announce;
  assert.equal(registry.heartbeat(hb), true);
  return { entry: registry.getEntry('x'), expired: registry.findExpired(now + deltaMs, baseMs) };
}

test('F03-7/§3.3：阈值公式唯一落点 findExpired —— 未通告 ⇒ 基准；已通告 ⇒ max(基准, 2 × 通告)', () => {
  // 未通告：与迭代前逐字一致（严格大于才到期）
  assert.deepEqual(announceAndExpire({ baseMs: 300, deltaMs: 300 }).expired, []);
  assert.deepEqual(announceAndExpire({ baseMs: 300, deltaMs: 301 }).expired, ['x']);
  assert.equal(announceAndExpire({ baseMs: 300, deltaMs: 301 }).entry.next_interval_ms, null, '建条目即未通告');
  // 已通告但 2× 低于基准 ⇒ 基准下限兜底（通告不得缩小阈值）
  assert.deepEqual(announceAndExpire({ announce: 100, baseMs: 300, deltaMs: 301 }).expired, ['x']);
  // 通告 300 ⇒ 阈值 600 = 2 × 通告（不变式：阈值 ≥ 2 × 间隔）
  assert.deepEqual(announceAndExpire({ announce: 300, baseMs: 300, deltaMs: 600 }).expired, []);
  assert.deepEqual(announceAndExpire({ announce: 300, baseMs: 300, deltaMs: 601 }).expired, ['x']);
  // 通告上界 600000 ⇒ 阈值 1200000
  assert.deepEqual(announceAndExpire({ announce: 600_000, baseMs: 300, deltaMs: 1_200_000 }).expired, []);
  assert.deepEqual(announceAndExpire({ announce: 600_000, baseMs: 300, deltaMs: 1_200_001 }).expired, ['x']);
  // 非法通告 ⇒ 视为未通告（fail-closed），但不影响 last_heartbeat（心跳仍然算数）
  for (const bad of [0, -1, 1.5, '300', 600_001, null]) {
    const { entry, expired } = announceAndExpire({ announce: bad, baseMs: 300, deltaMs: 301 });
    assert.equal(entry.next_interval_ms, null, `非法通告 ${String(bad)} 应视为未通告`);
    assert.equal(entry.last_heartbeat, 1_000_000, '非法通告不得影响 last_heartbeat 更新');
    assert.deepEqual(expired, ['x']);
  }
});

test('S-3/§9.1：条目新增 next_interval_ms 不外泄 —— snapshot() 仍只投影 4 字段', () => {
  const registry = createRegistry();
  registry.register({ instanceId: 'x', sessionId: 's-x', connId: 1, now: 1 });
  registry.heartbeat({ instanceId: 'x', sessionId: 's-x', nextIntervalMs: 60_000, now: 2 });
  assert.deepEqual(registry.snapshot(), [{ instance_id: 'x', session_id: 's-x', state: 'online', last_heartbeat: 2 }]);
});

test('F03-2/5/6/7：空闲档降频 + 阈值联动 + 不判离线 + 身份不变（SHORT_ENV 50→300ms）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  const regLine = await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  const session = regLine.match(/session=([0-9a-f-]+)/)[1];

  // 活跃档：心跳通告 50 ⇒ 阈值 max(300, 2×50) = 300（= 基准，与迭代前一致）
  await router.waitRouterLine(/LEASE_ADJUSTED instance=dev-1 next_interval_ms=50 threshold_ms=300/);
  await agent.waitAgentLine(/HEARTBEAT_SENT instance=dev-1 tier=active interval_ms=50/);

  // 连续 300ms（= 空闲档）无交互 ⇒ 进入空闲档（§3.6 实现契约：该跳的 SENT 仍记 tier=active）
  const tierLine = await agent.waitAgentLine(/HEARTBEAT_TIER instance=dev-1 session=\S+ tier=idle interval_ms=300/, { timeoutMs: 3000 });
  assert.match(tierLine, new RegExp(`session=${session}`), '档位切换必须携带同一 session（身份不变，F03 验收 6）');
  await router.waitRouterLine(/LEASE_ADJUSTED instance=dev-1 next_interval_ms=300 threshold_ms=600/);

  const windowStart = agent.stdout.lines.indexOf(tierLine);
  assert.match(
    agent.stdout.lines[windowStart + 1] ?? '',
    /HEARTBEAT_SENT instance=dev-1 tier=active interval_ms=300/,
    '进入空闲档的那一跳记为 tier=active，其 interval_ms 指向新的 300ms 节奏',
  );

  // 3 × 空闲档（900ms）窗口：state 恒 online、零 AGENT_OFFLINE、零重注册、零 LEASE_ALARM、tier=idle 跳数 ≤3
  const deadline = Date.now() + 900;
  while (Date.now() < deadline) {
    const node = await statusOf(router.socketPath, 'dev-1');
    assert.equal(node.state, 'online', '空闲期间不得被判 offline（F03 验收 5）');
    await new Promise((r) => setTimeout(r, 100));
  }
  const idleBeats = countMatching(agent.stdout.lines, /HEARTBEAT_SENT instance=dev-1 tier=idle interval_ms=300/, windowStart + 1);
  assert.ok(idleBeats >= 2 && idleBeats <= 3, `3 × 空闲档窗口内 tier=idle 跳数应 ≤3（实测 ${idleBeats}）`);
  assert.equal(countMatching(router.stdout.lines, /AGENT_OFFLINE instance=dev-1/), 0, '空闲期间不得判离线');
  assert.equal(countMatching(router.stdout.lines, /AGENT_REGISTERED instance=dev-1/), 1, '空闲期间不得重注册（零换 session）');
  assert.equal(countMatching(router.stdout.lines, /LEASE_ALARM/), 0, '空闲期间不得触发租约不变式告警（F03 验收 7）');

  // 空闲档下交付一条任务（900ms > 空闲档 300ms）⇒ 立即恢复活跃档，且处理中恒活跃
  const sender = await startFakeNode({ socketPath: router.socketPath, instanceId: 'hb-sender', heartbeatMs: 50 });
  t.after(() => sender.stop());
  const idx = agent.stdout.lines.length;
  const t0 = Date.now();
  const resp = await sender.send('dev-1', {
    protocol: 'oamp/1',
    message_id: 'hb-resume-1',
    type: 'task.request',
    payload: {
      content_type: 'application/json',
      body: JSON.stringify({ command: process.execPath, args: ['-e', 'setTimeout(() => {}, 900)'] }),
    },
  });
  const resumed = await waitFor(() => firstMatching(agent.stdout.lines, /HEARTBEAT_SENT instance=dev-1 .*interval_ms=50/, idx), {
    timeoutMs: 2000,
    what: '空闲档下交付任务后恢复活跃档',
  });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 300, `恢复必须立即（不等下一个空闲周期；实测 ${elapsed}ms）`);
  assert.match(resumed, /interval_ms=50$/, '恢复后的通告值即活跃档 50ms');
  await waitFor(() => countMatching(agent.stdout.lines, /HEARTBEAT_SENT instance=dev-1 .*interval_ms=50/, idx) >= 4, {
    timeoutMs: 2000,
    what: '恢复活跃档后 50ms 心跳 ≥4（F03 验收 1/3）',
  });

  // 任务在飞（900ms > 空闲档 300ms）⇒ 不得跌回空闲档（"含处理中"，MI-01）
  await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - t0))));
  assert.equal(
    agent.stdout.lines.slice(idx).some((l) => l.includes('HEARTBEAT_TIER') && l.includes('tier=idle')),
    false,
    '任务处理中不得跌回空闲档（F03 验收 2 口径：无任务才降频）',
  );

  // 任务真实执行完毕（shell 900ms）+ settle 后 idleMs 宽限 ⇒ 回到空闲档（两档循环持续）
  const task = await waitFor(async () => {
    const got = await queryTask(router.socketPath, resp.task_id);
    return got && (got.state === 'completed' || got.state === 'failed') ? got : null;
  }, { timeoutMs: 5000, what: '任务终态' });
  assert.equal(task.state, 'completed');
  await agent.waitAgentLine(/HEARTBEAT_TIER instance=dev-1 session=\S+ tier=idle interval_ms=300/, 2, { timeoutMs: 3000 });
  assert.equal(countMatching(router.stdout.lines, /AGENT_REGISTERED instance=dev-1/), 1, '全程零重注册（身份不变）');
});

test('F03-8/§3.7：旧 Router（回包缺 lease_follows_interval）⇒ HEARTBEAT_IDLE_DISABLED + 保持活跃档', async (t) => {
  // 进程内 legacy Router：register 回包只有既有 5 字段（缺 lease_follows_interval）
  const tmpDir = makeTempSocketDir();
  const socketPath = path.join(tmpDir, 'router.sock');
  const legacy = net.createServer((socket) => {
    new RpcPeer(socket, {
      idPrefix: 'legacy',
      onRequest: (method, params, respond) => {
        if (method === 'agent.register') {
          respond.ok({
            instance_id: params.instance_id,
            session_id: 'legacy-session-0001',
            state: 'online',
            lease_timeout_ms: 300,
            last_heartbeat: Date.now(),
          });
          return;
        }
        if (method === 'agent.deregister') {
          respond.ok({ removed: true });
          return;
        }
        if (method === 'agent.heartbeat') return; // 通知：无响应通道
        if (respond) respond.error(-32601, `method not found: ${method}`);
      },
    });
  });
  await new Promise((resolve, reject) => {
    legacy.once('error', reject);
    legacy.listen(socketPath, resolve);
  });
  t.after(() => {
    legacy.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const agent = await startAgent('dev-1', { socketPath, envExtra: { OAMP_RECONNECT: '0' } });
  t.after(() => agent.stop());

  await agent.waitAgentLine(/HEARTBEAT_IDLE_DISABLED instance=dev-1 /);
  await agent.waitAgentLine(/HEARTBEAT_SENT instance=dev-1 tier=active interval_ms=50/);
  // 观察 3 × 空闲档（900ms）：旧 Router 下不得进入空闲档，全程 50ms 活跃档
  await new Promise((r) => setTimeout(r, 900));
  const sent = agent.stdout.lines.filter((l) => l.includes('HEARTBEAT_SENT instance=dev-1'));
  assert.ok(sent.length >= 8, `旧 Router 下应持续活跃档心跳（实测 ${sent.length} 条）`);
  assert.equal(sent.every((l) => l.endsWith('interval_ms=50')), true, '旧 Router 下通告值恒为活跃档');
  assert.equal(countMatching(agent.stdout.lines, /HEARTBEAT_TIER/), 0, '旧 Router 下不得发生档位切换');
});

test('F08-2/6：既有客户端（心跳无 next_interval_ms）⇒ 阈值回退基准、不产生 LEASE_ADJUSTED', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const connectRaw = async () => {
    const socket = net.connect(router.socketPath);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    return new RpcPeer(socket, { idPrefix: 'rawhb' });
  };

  // A = 迭代前形态（心跳体无通告字段）；B = 同一时刻通告 60000（阈值抬到 120000）
  const peerA = await connectRaw();
  const peerB = await connectRaw();
  t.after(() => {
    peerA.close();
    peerB.close();
  });
  const regA = await peerA.request('agent.register', { instance_id: 'legacy-a' }, { timeoutMs: 3000 });
  const regB = await peerB.request('agent.register', { instance_id: 'legacy-b' }, { timeoutMs: 3000 });
  assert.equal(regA.lease_timeout_ms, 300);
  assert.equal(regB.lease_follows_interval, true);
  peerA.notify('agent.heartbeat', { instance_id: 'legacy-a', session_id: regA.session_id });
  peerB.notify('agent.heartbeat', { instance_id: 'legacy-b', session_id: regB.session_id, next_interval_ms: 60000 });
  await waitFor(async () => (await statusOf(router.socketPath, 'legacy-a')) && (await statusOf(router.socketPath, 'legacy-b')), {
    what: 'A/B 均在线基线',
  });

  // A 两跳都不发 ⇒ 基准 300ms 判离线；同一时刻 B 必须仍在线（阈值 120000）
  await router.waitRouterLine(/AGENT_OFFLINE instance=legacy-a/);
  const nodeB = await statusOf(router.socketPath, 'legacy-b');
  assert.equal(nodeB.state, 'online', '未通告实例按基准判活，通告实例按 2 × 通告值放宽');
  assert.equal(countMatching(router.stdout.lines, /LEASE_ADJUSTED instance=legacy-a/), 0, '未通告 ⇒ 零阈值联动事件（逐字与迭代前一致）');
  await router.waitRouterLine(/LEASE_ADJUSTED instance=legacy-b next_interval_ms=60000 threshold_ms=120000/);
});
