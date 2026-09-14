// test/context-pool.test.js — omp-daemon（常驻上下文）路径契约测试（fake ACP 注入，不依赖真实 omp/外网）
// 覆盖：E-1 同 chat 累积 + 实例标识复用 / E-2 新 chat 隔离 / 同 chat 多 agent 隔离 /
//      同键 FIFO 串行 + 队列上限 8（context_busy）+ 异键并发 / LRU 淘汰 + notice{context_reset} /
//      崩溃 → context_crashed + 重建 / 未知模型 → model_unavailable（不回退）+ 模型切换不丢上下文 /
//      释放（context_release → context_released + kill）/ SIGINT → pool.dispose() /
//      受理面拒收 / 一次性 omp 与 shell 路径不回归。
// 范式：test/omp-executor.test.js（fake bin 经 OAMP_OMP_BIN 注入）+ test/helpers/harness.js（真实 Router/agent 子进程）。
// 架构依据：architecture §6.1~§6.6 / §7 / §9.1 / §10.1~§10.3 / §12 AR-11/AR-12/AR-16；prs/pr-003-tasks.md T6。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startRouter, startAgent, waitFor, stopAll } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { PROFILES, buildArgv } from '../src/launcher.js';
import { ContextPool } from '../src/context-pool.js';

// 协议与 argv 真源（pr-002 验收 2）：模式记号与固定 flag 段取自 src/launcher.js 的 profile 表（flag 段经同模块的
// buildArgv 推导）——本文件不复写期望数组、也不内置「默认就是 acp」的假设。协议注入见各启动点的 env 载体
// （setup 与 dev-2 两处）——注入键由 pr-001 的 src/config.js 交付。
const ACP_MODE = PROFILES['omp:acp'].modeArgs[0]; // 常驻链路模式记号
const ONESHOT_MODE = PROFILES['omp:oneshot'].modeArgs[0]; // 一次性路径模式记号

// —— fake omp：同一脚本两种形态（`acp` 常驻 JSON-RPC / `-p` 一次式）——
// acp 形态实现 initialize / session/new / set_config_option / session/prompt（流式 chunk + per-session 记忆），
// 配置面按**真实形态**回（`configOptions` = 数组 `[{id,category,currentValue,options}]`，实测 omp 18.0.11）；
// 失败模式经 env 编排：FAKE_ACP_SLEEP_MS（每轮耗时）/ FAKE_ACP_HANG（不响应）/ FAKE_ACP_CRASH_ON_PROMPT（第 N 轮退出）/
// FAKE_ACP_UNKNOWN_MODEL（set_config_option 返回 JSON-RPC error，模拟 V-7）/ FAKE_ACP_STICKY_MODEL（接受但未生效，锁审计面）。
// 观测面：FAKE_ACP_EVENTS_LOG（prompt_start/prompt_end + pid，供串行/并发断言）、FAKE_ACP_ARGS_LOG（启动参数集）。
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
function log(entry) {
  if (!process.env.FAKE_ACP_EVENTS_LOG) return;
  try {
    fs.appendFileSync(process.env.FAKE_ACP_EVENTS_LOG, JSON.stringify(entry) + '\\n');
  } catch {}
}
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\\n');
}
try {
  if (process.env.FAKE_ACP_ARGS_LOG) fs.appendFileSync(process.env.FAKE_ACP_ARGS_LOG, JSON.stringify(argv) + '\\n');
} catch {}

if (argv.includes('-p')) {
  console.log('one-shot answer: ' + argv[argv.length - 1]);
  process.exit(0);
}

const modelIdx = argv.indexOf('--model');
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'deepseek/deepseek-v4-flash';
const UNKNOWN_MODEL = process.env.FAKE_ACP_UNKNOWN_MODEL || 'ghost/model-x';
const sleepMs = Number(process.env.FAKE_ACP_SLEEP_MS || 0);
const hang = process.env.FAKE_ACP_HANG === '1';
const crashOnPrompt = Number(process.env.FAKE_ACP_CRASH_ON_PROMPT || 0);

let sessionSeq = 0;
let promptSeq = 0;
const sessions = new Map();
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function replyError(id, message) {
  send({ jsonrpc: '2.0', id, error: { code: -32602, message } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.method === 'initialize') {
    reply(msg.id, { protocolVersion: 1, agentCapabilities: {} });
    return;
  }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    const sessionId = 'sess-' + sessionSeq;
    sessions.set(sessionId, { model: spawnModel, remembered: null });
    reply(msg.id, { sessionId, configOptions: [{ id: 'model', category: 'model', currentValue: spawnModel, options: [] }] });
    // omp 启动期会灌初始化通知（§6.6/V-11）：静默窗口应在其后收敛
    setTimeout(() => {
      for (let i = 0; i < 2; i += 1) {
        send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'available_commands_update', availableCommands: [] } } });
      }
    }, 20);
    return;
  }
  if (msg.method === 'session/set_config_option') {
    if (msg.params.value === UNKNOWN_MODEL) {
      replyError(msg.id, 'Unknown ACP model: ' + msg.params.value);
      return;
    }
    const session = sessions.get(msg.params.sessionId);
    // sticky：回 ok 但不改 currentValue（锁"审计值 = ACP 实报值，不是请求回显"）
    const sticky = process.env.FAKE_ACP_STICKY_MODEL === '1';
    if (session && !sticky) session.model = msg.params.value;
    reply(msg.id, { configOptions: [{ id: 'model', category: 'model', currentValue: sticky ? spawnModel : msg.params.value, options: [] }] });
    return;
  }
  if (msg.method === 'session/prompt') {
    promptSeq += 1;
    const sessionId = msg.params.sessionId;
    const session = sessions.get(sessionId);
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
    log({ event: 'prompt_start', pid: process.pid, at: Date.now(), sessionId, text });
    if (crashOnPrompt && promptSeq === crashOnPrompt) {
      await delay(30);
      process.exit(3);
    }
    if (hang) return; // 永不响应 → 客户端超时路径
    if (sleepMs) await delay(sleepMs);
    const remembered = /记住\\D*(\\d+)/.exec(text);
    let answer;
    if (remembered) {
      if (session) session.remembered = remembered[1];
      answer = '记住';
    } else if (session && session.remembered) {
      answer = '数字是 ' + session.remembered;
    } else {
      answer = '我不知道';
    }
    const parts = [answer.slice(0, 1), answer.slice(1)].filter((p) => p !== '');
    for (const part of parts) {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } } });
      if (sleepMs) await delay(20);
    }
    log({ event: 'prompt_end', pid: process.pid, at: Date.now(), sessionId, text });
    reply(msg.id, { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } });
    return;
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-fake-acp-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

// —— fake web 节点（惯例同 helpers/fake-node.js：心跳保活，否则租约到期后 Router 只记录不再投递）——
async function startWeb(socketPath) {
  const node = await startFakeNode({ socketPath, instanceId: 'web', heartbeatMs: 50 });
  const body = (m) => JSON.parse(m.payload.body);
  const envelope = (type, payload) => ({
    protocol: 'oamp/1',
    message_id: `${type === 'notice' ? 'ntc' : 'tsk'}-${randomUUID()}`,
    type,
    payload: { content_type: 'application/json', body: JSON.stringify(payload) },
  });
  return {
    node,
    received: node.received,
    sendTask: (to, payload) => node.send(to, envelope('task.request', payload)),
    sendNotice: (to, payload) => node.send(to, envelope('notice', payload)),
    results: (taskId) => node.received.filter((m) => m.type === 'task.result' && m.task_id === taskId).map(body),
    updates: (taskId) => node.received.filter((m) => m.type === 'task.update' && m.task_id === taskId).map(body),
    notices: (kind) => node.received.filter((m) => m.type === 'notice').map(body).filter((b) => !kind || b.kind === kind),
    stop: () => node.stop(),
  };
}

function readEvents(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 每个用例：独立 Router + agent（fake ACP 注入）+ fake web 节点 + 临时观测目录。 */
async function setup(t, { env = {}, instanceId = 'dev-1' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-ctx-'));
  const events = path.join(dir, 'events.jsonl');
  const argsLog = path.join(dir, 'argv.jsonl');
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent(instanceId, {
    socketPath: router.socketPath,
    envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN, FAKE_ACP_EVENTS_LOG: events, FAKE_ACP_ARGS_LOG: argsLog, ...env },
  });
  t.after(() => agent.stop());
  await agent.waitAgentLine(new RegExp(`REGISTERED instance=${instanceId}`));
  const web = await startWeb(router.socketPath);
  t.after(() => web.stop());
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { router, agent, web, events, argsLog, readEvents: () => readEvents(events) };
}

/** 发一轮任务并等终态（daemon=true 时补 executor 默认值；shell 路径显式 daemon=false）。 */
async function turn(web, to, payload, { timeoutMs = 20000, daemon = true } = {}) {
  const resp = await web.sendTask(to, daemon ? { executor: 'omp-daemon', ...payload } : payload);
  const result = await waitFor(() => web.results(resp.task_id)[0] || null, {
    timeoutMs,
    intervalMs: 25,
    what: `task ${resp.task_id} 终态`,
  });
  return { taskId: resp.task_id, resp, result, updates: web.updates(resp.task_id) };
}

test('E-1/F05-1/2：同 chat 两轮上下文累积，第二轮记得 42 且 context_id/pid 相同', async (t) => {
  const { web } = await setup(t);

  const first = await turn(web, 'dev-1', { chat_id: 'chat-e1', prompt: '请记住数字 42，只回复记住' });
  assert.equal(first.result.state, 'completed');
  assert.equal(first.result.executor, 'omp-daemon');
  assert.equal(first.result.text, '记住');
  assert.match(first.result.context_id, /^ctx-\d+-\d+$/);
  assert.equal(first.result.pid, Number(first.result.pid));

  const second = await turn(web, 'dev-1', { chat_id: 'chat-e1', prompt: '数字是多少' });
  assert.equal(second.result.state, 'completed');
  assert.ok(second.result.text.includes('42'), `第二轮应记得 42，实际: ${second.result.text}`);
  assert.equal(second.result.context_id, first.result.context_id, '两轮应为同一常驻实例');
  assert.equal(second.result.pid, first.result.pid, '两轮应为同一 pid');

  // 流式：增量以 kind='chunk' 逐块回流，拼起来等于终态文本
  const chunks = second.updates.filter((u) => u.kind === 'chunk').map((u) => u.text);
  assert.ok(chunks.length >= 2, `应有 ≥2 个增量块，实际 ${chunks.length}`);
  assert.equal(chunks.join(''), second.result.text);
  assert.equal(second.result.model, 'deepseek/deepseek-v4-flash', 'model 取自 ACP currentValue');
});

test('E-2/F05-3：新 chat → 新键新进程，答不出旧 chat 的设定值', async (t) => {
  const { web } = await setup(t);
  const a = await turn(web, 'dev-1', { chat_id: 'chat-a', prompt: '请记住数字 42，只回复记住' });
  assert.equal(a.result.text, '记住');

  const b1 = await turn(web, 'dev-1', { chat_id: 'chat-b', prompt: '数字是多少' });
  assert.equal(b1.result.state, 'completed');
  assert.ok(!b1.result.text.includes('42'), `新 chat 不应含 42，实际: ${b1.result.text}`);
  assert.notEqual(b1.result.context_id, a.result.context_id);
  assert.notEqual(b1.result.pid, a.result.pid);

  // 新 chat 自己累积（证明隔离不是"永远失忆"）
  await turn(web, 'dev-1', { chat_id: 'chat-b', prompt: '请记住数字 7' });
  const b2 = await turn(web, 'dev-1', { chat_id: 'chat-b', prompt: '数字是多少' });
  assert.ok(b2.result.text.includes('7'));
  assert.ok(!b2.result.text.includes('42'));
});

test('F05-4：同 chat 两个不同 agent 上下文互不串扰', async (t) => {
  const { router, web } = await setup(t, { instanceId: 'dev-1' });
  const agent2 = await startAgent('dev-2', { socketPath: router.socketPath, envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN } });
  t.after(() => agent2.stop());
  await agent2.waitAgentLine(/REGISTERED instance=dev-2/);

  const one = await turn(web, 'dev-1', { chat_id: 'chat-shared', prompt: '请记住数字 42' });
  assert.equal(one.result.text, '记住');
  const two = await turn(web, 'dev-2', { chat_id: 'chat-shared', prompt: '数字是多少' });
  assert.ok(!two.result.text.includes('42'), `另一 agent 不应串扰，实际: ${two.result.text}`);
  assert.notEqual(two.result.pid, one.result.pid);
});

test('F05-3/§6.2：同键 FIFO 串行（轮次区间不重叠）', async (t) => {
  const { web, readEvents } = await setup(t, { env: { FAKE_ACP_SLEEP_MS: '120' } });

  const rounds = await Promise.all(
    [1, 2, 3].map((n) => turn(web, 'dev-1', { chat_id: 'chat-serial', prompt: `第 ${n} 轮：请记住数字 ${n}` })),
  );
  for (const round of rounds) assert.equal(round.result.state, 'completed');

  const spans = readEvents().filter((e) => e.event === 'prompt_start' || e.event === 'prompt_end');
  assert.equal(spans.length, 6, '同键三轮应有 3 组 start/end');
  const pids = new Set(spans.map((e) => e.pid));
  assert.equal(pids.size, 1, '同键应复用同一子进程');
  const sorted = [...spans].sort((x, y) => x.at - y.at);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.notEqual(sorted[i].event, sorted[i - 1].event, '串行：start/end 必须交替出现');
  }
  assert.equal(sorted[0].event, 'prompt_start');
  assert.equal(sorted[sorted.length - 1].event, 'prompt_end');
});

test('§6.2：队列上限 8 —— 第 10 轮立即 context_busy，失败轮不进 ACP', async (t) => {
  const { web, readEvents } = await setup(t, { env: { FAKE_ACP_SLEEP_MS: '120' } });

  const all = await Promise.all(
    Array.from({ length: 10 }, (unused, i) => turn(web, 'dev-1', { chat_id: 'chat-queue', prompt: `排队第 ${i} 轮` })),
  );
  const completed = all.filter((r) => r.result.state === 'completed');
  const failed = all.filter((r) => r.result.state === 'failed');
  assert.equal(completed.length, 9, '1 在飞 + 8 排队应被受理');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].result.error, 'context_busy');
  const busyUpdates = failed[0].updates.filter((u) => u.error);
  assert.equal(busyUpdates.length, 0, '被拒轮次不应产生过程增量');
  const starts = readEvents().filter((e) => e.event === 'prompt_start');
  assert.equal(starts.length, 9, '仅 9 轮进入 ACP');
});

test('§6.2：异键并发（不同 chat 的轮次同时在飞）', async (t) => {
  const { web, readEvents } = await setup(t, { env: { FAKE_ACP_SLEEP_MS: '300' } });

  const started = Date.now();
  const both = await Promise.all([
    turn(web, 'dev-1', { chat_id: 'chat-c1', prompt: 'chat-c1 记住 11' }),
    turn(web, 'dev-1', { chat_id: 'chat-c2', prompt: 'chat-c2 记住 22' }),
  ]);
  const elapsed = Date.now() - started;
  for (const r of both) assert.equal(r.result.state, 'completed');
  assert.notEqual(both[0].result.pid, both[1].result.pid, '异键应各自独立进程');
  assert.ok(elapsed < 900, `异键应并发（耗时 ${elapsed}ms 应显著小于串行的 1200ms）`);

  const spans = readEvents().filter((e) => e.event === 'prompt_start' || e.event === 'prompt_end');
  const byPid = new Map();
  for (const s of spans) {
    const list = byPid.get(s.pid) || [];
    list.push(s);
    byPid.set(s.pid, list);
  }
  assert.equal(byPid.size, 2);
  const [p1, p2] = [...byPid.values()];
  const start1 = p1.find((e) => e.event === 'prompt_start').at;
  const end1 = p1.find((e) => e.event === 'prompt_end').at;
  const start2 = p2.find((e) => e.event === 'prompt_start').at;
  const end2 = p2.find((e) => e.event === 'prompt_end').at;
  assert.ok(start1 < end2 && start2 < end1, '两个键的轮次区间应重叠');
});

test('§6.3：超 contextMax → LRU 淘汰最久未用键 + notice{context_reset} + 下轮重建', async (t) => {
  const { web, readEvents } = await setup(t, { env: { FAKE_ACP_SLEEP_MS: '60', OAMP_CTX_MAX: '2' } });

  const c1 = await turn(web, 'dev-1', { chat_id: 'chat-1', prompt: 'chat-1 记住 42' });
  const c2 = await turn(web, 'dev-1', { chat_id: 'chat-2', prompt: 'chat-2 记住 42' });
  assert.equal(web.notices('context_reset').length, 0, '未超上限不淘汰');

  // 第 3 个键 → 淘汰最久未用的 chat-1
  const c3 = await turn(web, 'dev-1', { chat_id: 'chat-3', prompt: 'chat-3 记住 42' });
  const notices = await waitFor(() => (web.notices('context_reset').length > 0 ? web.notices('context_reset') : null), {
    timeoutMs: 5000,
    what: 'LRU 淘汰 notice',
  });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].chat_id, 'chat-1');
  assert.ok(typeof notices[0].text === 'string' && notices[0].text.length > 0);
  await waitFor(() => !isAlive(c1.result.pid), { timeoutMs: 5000, what: '被淘汰子进程消亡' });
  assert.ok(isAlive(c2.result.pid), '较近使用的 chat-2 不应被淘汰');
  assert.ok(isAlive(c3.result.pid));

  // 未超上限不回收：chat-2/chat-3 仍在池中（再问只复用，不新建）
  const c3again = await turn(web, 'dev-1', { chat_id: 'chat-3', prompt: '数字是多少' });
  assert.equal(c3again.result.pid, c3.result.pid, '未超上限应复用');
  assert.ok(c3again.result.text.includes('42'));

  // 被淘汰的 chat-1 下轮重建：新 context_id/pid，旧上下文丢失
  const rebuilt = await turn(web, 'dev-1', { chat_id: 'chat-1', prompt: '数字是多少' });
  assert.notEqual(rebuilt.result.context_id, c1.result.context_id);
  assert.notEqual(rebuilt.result.pid, c1.result.pid);
  assert.ok(!rebuilt.result.text.includes('42'), '淘汰即失忆');
  assert.ok(readEvents().some((e) => e.event === 'prompt_start'));
});

test('§6.5：ACP 子进程异常退出 → context_crashed + notice{context_reset} + 下轮重建', async (t) => {
  const { web } = await setup(t, { env: { FAKE_ACP_CRASH_ON_PROMPT: '2' } });

  const first = await turn(web, 'dev-1', { chat_id: 'chat-crash', prompt: '请记住数字 42' });
  assert.equal(first.result.text, '记住');

  const second = await turn(web, 'dev-1', { chat_id: 'chat-crash', prompt: '数字是多少' });
  assert.equal(second.result.state, 'failed');
  assert.equal(second.result.error, 'context_crashed');
  const notices = await waitFor(() => (web.notices('context_reset').length > 0 ? web.notices('context_reset') : null), {
    timeoutMs: 5000,
    what: '崩溃 notice',
  });
  assert.equal(notices[0].chat_id, 'chat-crash');

  const rebuilt = await turn(web, 'dev-1', { chat_id: 'chat-crash', prompt: '数字是多少' });
  assert.equal(rebuilt.result.state, 'completed');
  assert.notEqual(rebuilt.result.pid, first.result.pid, '重建 → 新 pid');
  assert.notEqual(rebuilt.result.context_id, first.result.context_id, '重建 → 新 context_id');
  assert.ok(!rebuilt.result.text.includes('42'), '崩溃即失忆');
});

test('§6.5：prompt 超时 → cancel → kill → failed(timeout) + notice{context_reset}', async (t) => {
  const { web } = await setup(t, { env: { FAKE_ACP_HANG: '1' } });

  const started = Date.now();
  const round = await turn(web, 'dev-1', { chat_id: 'chat-timeout', prompt: '慢问题', timeout_ms: 400 });
  assert.equal(round.result.state, 'failed');
  assert.equal(round.result.error, 'timeout');
  assert.ok(Date.now() - started < 8000, '超时轮不应无限等待');
  await waitFor(() => web.notices('context_reset').length > 0, { timeoutMs: 5000, what: '超时 notice' });
  assert.equal(web.notices('context_reset')[0].chat_id, 'chat-timeout');
  await waitFor(() => !isAlive(round.result.pid), { timeoutMs: 5000, what: '超时后子进程被 kill' });
});

test('§7.3/§7.4：未知模型 → model_unavailable（不回退）；指定切换不丢上下文', async (t) => {
  const { web } = await setup(t);

  const first = await turn(web, 'dev-1', { chat_id: 'chat-model', prompt: '请记住数字 42' });
  assert.equal(first.result.text, '记住');
  assert.equal(first.result.model, 'deepseek/deepseek-v4-flash');

  const unknown = await turn(web, 'dev-1', { chat_id: 'chat-model', prompt: '数字是多少', model: 'ghost/model-x' });
  assert.equal(unknown.result.state, 'failed');
  assert.equal(unknown.result.error, 'model_unavailable');
  assert.ok(unknown.result.text.includes('ghost/model-x'), '错误面应点名不可用模型');
  assert.equal(unknown.result.model, 'deepseek/deepseek-v4-flash', '失败轮的 model 亦只报 ACP 实报生效值');
  assert.notEqual(unknown.result.model, 'ghost/model-x', '不得以请求参数回显冒充');
  assert.equal(web.notices('context_reset').length, 0, '模型不可用不应重置上下文');

  const switched = await turn(web, 'dev-1', { chat_id: 'chat-model', prompt: '数字是多少', model: 'alpha/model-a' });
  assert.equal(switched.result.state, 'completed');
  assert.equal(switched.result.model, 'alpha/model-a', 'model 回读自 ACP currentValue');
  assert.equal(switched.result.pid, first.result.pid, '切换模型不重建进程');
  assert.ok(switched.result.text.includes('42'), '切换模型不丢上下文');

  const backToDefault = await turn(web, 'dev-1', { chat_id: 'chat-model', prompt: '数字是多少' });
  assert.equal(backToDefault.result.model, 'deepseek/deepseek-v4-flash', '未指定轮次回到默认模型');
  assert.ok(backToDefault.result.text.includes('42'));
});

test('§7.4：task.result.model 取自 ACP currentValue（不得用请求回显冒充）', async (t) => {
  // sticky 模式：ACP 对 set_config_option 回 ok 但不改 currentValue（模拟"接受但未生效"）
  const { web } = await setup(t, { env: { FAKE_ACP_STICKY_MODEL: '1' } });

  const first = await turn(web, 'dev-1', { chat_id: 'chat-audit', prompt: '请记住数字 42', model: 'alpha/model-a' });
  assert.equal(first.result.state, 'completed');
  assert.equal(first.result.model, 'alpha/model-a', '首轮生效模型来自 ACP 回读（--model 生效值）');

  const second = await turn(web, 'dev-1', { chat_id: 'chat-audit', prompt: '数字是多少', model: 'beta/model-b' });
  assert.equal(second.result.state, 'completed');
  assert.equal(second.result.model, 'alpha/model-a', 'ACP 未生效时，审计值必须是 ACP 实报 currentValue');
  assert.notEqual(second.result.model, 'beta/model-b', '不得以请求参数回显冒充实际生效模型');
  assert.equal(second.result.pid, first.result.pid);
  assert.ok(second.result.text.includes('42'));
});

test('§6.4/§5.2：notice{context_release} → 释放该 chat + 回发 context_released', async (t) => {
  const { web } = await setup(t);
  const first = await turn(web, 'dev-1', { chat_id: 'chat-close', prompt: '请记住数字 42' });

  const ack = await web.sendNotice('dev-1', { kind: 'context_release', chat_id: 'chat-close' });
  assert.equal(ack.status, 'delivered');
  const released = await waitFor(() => web.notices('context_released')[0] || null, { timeoutMs: 5000, what: 'context_released 提示' });
  assert.equal(released.chat_id, 'chat-close');
  await waitFor(() => !isAlive(first.result.pid), { timeoutMs: 5000, what: '释放后子进程消亡' });

  // 释放后同键可重建（web 侧对已关闭 chat 的提问由 pr-004 以 409 拒绝，此处只验池行为）
  const rebuilt = await turn(web, 'dev-1', { chat_id: 'chat-close', prompt: '数字是多少' });
  assert.equal(rebuilt.result.state, 'completed');
  assert.notEqual(rebuilt.result.pid, first.result.pid);
  assert.ok(!rebuilt.result.text.includes('42'));

  // 残缺/无关 notice 不误伤
  await web.sendNotice('dev-1', { kind: 'other' });
  await web.sendNotice('dev-1', { kind: 'context_release' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(web.notices('context_released').length, 1, '仅合法的 context_release 触发释放');
  assert.ok(isAlive(rebuilt.result.pid));
});

test('§6.4：SIGINT → pool.dispose() 回收全部常驻子进程，agent 优雅退出 0', async (t) => {
  const { agent, web } = await setup(t);
  const first = await turn(web, 'dev-1', { chat_id: 'chat-sigint', prompt: '请记住数字 42' });
  const pid = first.result.pid;
  assert.ok(isAlive(pid));

  const exit = await agent.stop();
  assert.equal(exit.code, 0, 'SIGINT 应优雅退出 0');
  await waitFor(() => !isAlive(pid), { timeoutMs: 5000, what: 'SIGINT 后常驻子进程消亡' });
});

test('§9.1/§7.2：受理面拒收（缺 chat_id / 空 prompt / 非法 model）', async (t) => {
  const { router, web, agent } = await setup(t);
  const bad = [
    { executor: 'omp-daemon', prompt: '缺 chat_id' },
    { executor: 'omp-daemon', chat_id: 'chat-x', prompt: '   ' },
    { executor: 'omp-daemon', chat_id: 'chat-x', prompt: '非法模型', model: 'bad model!' },
  ];
  for (const payload of bad) {
    const resp = await web.sendTask('dev-1', payload);
    await router.waitRouterLine(
      new RegExp(`MESSAGE_ACKED message_id=${resp.message_id} instance=dev-1 status=rejected`),
    );
  }
  await agent.waitAgentLine(/TASK_REJECTED/, 3);
  assert.equal(web.notices('context_reset').length, 0, '拒收不应触发上下文事件');
});

test('F08/§9.1：一次性 executor=omp（-p）与 shell 路径不回归', async (t) => {
  const { web, argsLog } = await setup(t);

  const oneShot = await turn(web, 'dev-1', { executor: 'omp', prompt: '推荐一部动漫' });
  assert.equal(oneShot.result.state, 'completed');
  assert.equal(oneShot.result.exit_code, 0);
  const stdout = oneShot.updates.filter((u) => u.kind === 'stdout').map((u) => u.line);
  assert.ok(stdout.some((l) => l.includes('one-shot answer')), '一次性路径应走 omp -p');
  const argvs = fs.readFileSync(argsLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(argvs.some((a) => a.includes(ONESHOT_MODE) && !a.includes(ACP_MODE)), '一次性路径参数集含 -p 且不含 acp');

  const shell = await turn(web, 'dev-1', { command: process.execPath, args: ['-e', 'console.log("shell-ok")'] }, { daemon: false });
  assert.equal(shell.result.state, 'completed');
  const shellOut = shell.updates.filter((u) => u.kind === 'stdout').map((u) => u.line);
  assert.ok(shellOut.some((l) => l.includes('shell-ok')));

  assert.equal(web.notices('context_reset').length, 0);
});

test('§6.6：daemon 启动参数含 acp 固定集（--no-skills/--no-rules/--no-tools/--no-session + --model）', async (t) => {
  const { web, argsLog } = await setup(t);
  const round = await turn(web, 'dev-1', { chat_id: 'chat-args', prompt: '你好' });
  assert.equal(round.result.state, 'completed');

  const argvs = fs.readFileSync(argsLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const acp = argvs.find((a) => a[0] === ACP_MODE);
  assert.ok(acp, 'daemon 路径应 spawn `acp` 子进程');
  // 期望值真源 = L1（profile 固定段）；档位段由唯一汇聚点给出（本实例工具关 ⇒ 不追加）
  for (const flag of buildArgv('omp:acp', { approval: null }).filter((f) => f.startsWith('--no-'))) {
    assert.ok(acp.includes(flag), `启动参数应含 ${flag}`);
  }
  assert.ok(acp.includes('--model'));
  assert.equal(acp[acp.indexOf('--model') + 1], 'deepseek/deepseek-v4-flash');
});

// ─────────── §5.1（T-03）：两型钩子的注入面分开——提问恒注入 / 工具门仅 allow 档注入 ───────────

test('§5.1（T-03）：deny 实例的提问钩子仍注入且被调用（提问上浮），同一实例的工具门零注入', async (t) => {
  // 观测面 = 注入给会话工厂的 hooks（池侧的唯一注入点）；会话工厂以最小可用外观替身，不 spawn 任何进程
  const makeStub = () => ({
    prompt: async () => ({ text: '', model: null, stop_reason: 'stop', usage: null, pid: 1 }),
    close() {},
    pid: 1,
    currentModel: null,
    contextId: null,
  });
  const fakeSession = () => ({ hooksSeen: [], session: null });

  const denyProbe = fakeSession();
  const denyPool = new ContextPool({
    permission: 'deny', // 工具门自动拒绝的档位
    createResident: async ({ hooks }) => {
      denyProbe.hooksSeen.push(hooks);
      return makeStub();
    },
    onPermissionRequest: () => 'allow', // 门钩子在场：是否注入须由池侧档位判定决定（deny ⇒ 丢弃）
    onQuestionRequest: (info) => {
      denyProbe.questions = denyProbe.questions || [];
      denyProbe.questions.push(info);
      return Promise.resolve({ optionIds: [], text: '好的' });
    },
  });
  t.after(() => denyPool.dispose());

  const session = denyPool.getOrCreate('chat-q', 'dev-1', { origin: 'web-1' });
  await session.prompt('一轮', { timeoutMs: 5000, origin: 'web-1' });
  assert.equal(denyProbe.hooksSeen.length, 1, '会话工厂被调用一次');
  const hooks = denyProbe.hooksSeen[0];
  assert.equal(hooks.onPermissionRequest, null, 'deny 档：工具门（permission 型）零注入');
  assert.equal(hooks.onApproval, null, 'deny 档：工具门（approval 型）零注入');
  assert.equal(typeof hooks.onQuestionRequest, 'function', '提问钩子恒注入（与 permission 档解耦）');

  // 被注入的提问钩子可调用，且会话身份（chatId/agentId/该轮 origin）与门钩子同法附加
  const answer = await hooks.onQuestionRequest({ requestKind: 'question', question: '优先级？', options: [], multiple: false });
  assert.deepEqual(answer, { optionIds: [], text: '好的' }, '注入的钩子即生产钩子（返回其结算值）');
  assert.deepEqual(
    denyProbe.questions,
    [{ requestKind: 'question', question: '优先级？', options: [], multiple: false, chatId: 'chat-q', agentId: 'dev-1', origin: 'web-1' }],
    '身份附加体例与门钩子一致',
  );

  // 对照：allow 档 ⇒ 两型钩子同时在位（证明上方断言不是「恒 null」的空判据）
  const allowProbe = fakeSession();
  const allowPool = new ContextPool({
    permission: 'allow',
    createResident: async ({ hooks }) => {
      allowProbe.hooksSeen.push(hooks);
      return makeStub();
    },
    onPermissionRequest: () => 'allow',
    onQuestionRequest: () => Promise.resolve({ optionIds: [], text: '' }),
  });
  t.after(() => allowPool.dispose());
  await allowPool.getOrCreate('chat-a', 'dev-1', { origin: 'web-1' }).prompt('一轮', { timeoutMs: 5000, origin: 'web-1' });
  const allowHooks = allowProbe.hooksSeen[0];
  assert.equal(typeof allowHooks.onPermissionRequest, 'function', 'allow 档：工具门钩子注入（既有判定逐字保留）');
  assert.equal(allowHooks.onApproval, allowHooks.onPermissionRequest, 'allow 档：两型门钩子同点透传');
  assert.equal(typeof allowHooks.onQuestionRequest, 'function', 'allow 档：提问钩子在位');
});
