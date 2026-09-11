// test/event-log.test.js — F06 终端事件日志验收（PR-002 验收第 4 条 + prd F06）
// 事件行格式 `[<UTC ISO-8601>] <role> <TOKEN> <key=value …>`（§8.1）；
// 心跳节流：观察窗口 T 内单节点 HEARTBEAT 行数 ≤ ⌈T/W⌉+1（M-03 数值化，W=缩短 env 300ms）；
// 节流不吞状态变迁事件（AGENT_REGISTERED/AGENT_OFFLINE 等在窗口内逐条可见）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRouter, startAgent, waitFor } from './helpers/harness.js';

// §8.1 行格式： [2026-09-09T04:12:33.123Z] router AGENT_REGISTERED instance=dev-1 session=…
const EVENT_LINE_RE = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] (router|agent) ([A-Z_]+)((?: [a-z_]+=[^ ]+)*)$/;
const TS_RE = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/;

function tsOf(line) {
  const m = TS_RE.exec(line);
  return m ? Date.parse(m[1]) : NaN;
}

function countLinesMatching(lines, re) {
  return lines.filter((l) => re.test(l));
}

function heartbeatLines(router) {
  return router.stdout.all().filter((l) => l.includes(' HEARTBEAT instance=dev-1 '));
}

test('F06-1/§8.1：Router 事件行格式符合 [UTC ISO] router TOKEN key=value（ROUTER_READY/AGENT_REGISTERED/HEARTBEAT）', async (t) => {
  const router = await startRouter();
  t.after(() => router.stop().catch(() => {}).then(() => router.cleanup()));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => heartbeatLines(router).length >= 1, { what: '至少一条 HEARTBEAT 日志' });

  for (const line of router.stdout.all()) {
    if (!line.includes(' ROUTER_READY ') && !line.includes(' AGENT_REGISTERED ') && !line.includes(' HEARTBEAT ')) continue;
    assert.match(line, EVENT_LINE_RE, `事件行格式不符: ${line}`);
  }
});

test('F06-2/§8.1：agent 事件行格式符合 [UTC ISO] agent TOKEN key=value（AGENT_START/REGISTERED）', async (t) => {
  const router = await startRouter();
  t.after(() => router.stop().catch(() => {}).then(() => router.cleanup()));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  await agent.waitAgentLine(/AGENT_START instance=dev-1/);
  await agent.waitAgentLine(/REGISTERED instance=dev-1 session=/);
  for (const line of agent.stdout.all()) {
    assert.match(line, EVENT_LINE_RE, `agent 事件行格式不符: ${line}`);
  }
});

test('F06-3/M-03：观察窗口 T 内单节点 HEARTBEAT 行数 ≤ ⌈T/W⌉+1（显著小于实际心跳数）', async (t) => {
  const router = await startRouter();
  t.after(() => router.stop().catch(() => {}).then(() => router.cleanup()));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());

  await agent.waitAgentLine(/REGISTERED instance=dev-1 session=/);
  // 等首条心跳日志出现作为窗口起点
  const first = await waitFor(() => heartbeatLines(router)[0], { what: '首条 HEARTBEAT 日志' });
  const t0 = tsOf(first);
  const W = 300; // 缩短 env：OAMP_HB_LOG_WINDOW_MS=300（harness SHORT_ENV）
  const T = 1200; // 观察窗口 1200ms

  await new Promise((r) => setTimeout(r, T));
  const windowLines = heartbeatLines(router).filter((l) => {
    const ts = tsOf(l);
    return ts >= t0 && ts <= t0 + T;
  });
  const bound = Math.ceil(T / W) + 1;
  assert.ok(windowLines.length <= bound, `HEARTBEAT ${windowLines.length} 条应 ≤ ⌈${T}/${W}⌉+1=${bound}`);

  // 显著小于实际心跳次数：interval=50ms → 窗口内实际约 T/50=24 跳
  const actualApprox = T / 50;
  assert.ok(windowLines.length < actualApprox / 2, `日志 ${windowLines.length} 条应显著小于实际 ${actualApprox} 跳`);
});

test('F06-4/§8.2：节流不吞状态变迁事件——注册/offline 在节流窗口内逐条可见', async (t) => {
  const router = await startRouter();
  t.after(() => router.stop().catch(() => {}).then(() => router.cleanup()));
  const agent1 = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent1.stop());

  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-1 session=/);
  await waitFor(() => heartbeatLines(router).length >= 1, { what: 'dev-1 心跳日志出现（进入节流）' });

  // 心跳节流进行中注册第二节点：状态事件不受节流器影响
  const agent2 = await startAgent('dev-2', { socketPath: router.socketPath });
  await router.waitRouterLine(/AGENT_REGISTERED instance=dev-2 session=/);
  assert.ok(
    router.stdout.all().some((l) => / AGENT_REGISTERED instance=dev-2 session=/.test(l)),
    '节流期间 dev-2 注册事件应逐条输出',
  );

  // 强杀 dev-1 → AGENT_OFFLINE 状态事件不被节流吞（窗口内心跳节流仍生效）
  agent1.kill('SIGKILL');
  await router.waitRouterLine(/AGENT_OFFLINE instance=dev-1/);
  assert.ok(
    router.stdout.all().some((l) => / AGENT_OFFLINE instance=dev-1/.test(l)),
    'AGENT_OFFLINE 事件应输出（不被心跳节流吞）',
  );
  await agent2.stop();
});
