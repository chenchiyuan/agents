// test/confirmation-roundtrip.test.js — 0021 pr-002：agent 进程侧确认链（上浮 / 裁决结算 / 作用域 / 未知 id / 失效 / 档位）
// 载体：① 进程内 `ContextPool`（fake ACP 经 bin 注入 + spy 钩子）——T1 的透传 / 档位门 / 冻结判据；
//      ② harness 真实 Router + 带 flag 的 agent 子进程（照 acp-daemon.test.js 的 startFlaggedAgent 先例就地自建，**
//         不改 harness 公共面**，Q6）+ 脚本级假 web 节点（helpers/fake-node.js 的 NodeClient，协议零漂移）。
// 观测面：FAKE_ACP_FRAMES_LOG（本子进程收到的请求 / 客户端应答 / session/cancel）/ FAKE_ACP_ARGS_LOG（argv）/
//        agent stdout 事件行（CONTEXT_NOTICE / CONFIRMATION_DECISION / DEREGISTERED）/ 假节点 received（信封 1/3 + 终态）。
// 不依赖真实 omp / 真实 LLM / 外网；不写真实 oamp/data/sql.db。依据：architecture §5.3 信封 1/2/3、§7 T-05/T-06/T-16、
// §4.2 M-3/M-13、§6.2 失效路径 A；prs/pr-002-tasks.md T1~T5；clarifications/pr002-round-1-verdicts.md MI-1~MI-4 / Q1~Q4。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startRouter, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { ContextPool } from '../src/context-pool.js';
import { createProtocolLayer } from '../src/protocol.js';
import { PROFILES } from '../src/launcher.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');
// 租约：agent 与假 web 节点都是常驻发送方（harness SHORT_ENV 的 300ms 租约够用，但长租约避免心跳抖动误判 offline）
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 真实 omp 的 ACP 权限门选项集合（M2 实测 4 项）；test 进程与 fake 子进程共用同一份字面量 ⇒ 可逐字比对。
const PERMISSION_OPTIONS = [
  { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' },
  { optionId: 'allow_always', name: 'Allow always', kind: 'allow_always' },
  { optionId: 'reject_once', name: 'Reject once', kind: 'reject_once' },
  { optionId: 'reject_always', name: 'Reject always', kind: 'reject_always' },
];

// —— fake omp（acp 形态）：initialize / session/new / session/prompt + 每轮按 MODE 开一或两道门 ——
//   permission            第一道门 = session/request_permission（带 toolName 'edit' + M2 的 4 项 options）
//   permission_notool     同上门但**不带 toolName**（真实 omp 权限门帧形：ACP 桥只序列化 toolCallId/title/kind/…）
//   approval              第二道门 = elicitation/create（Approve|Deny，message 首行 `Allow tool: <tool>`）
//   plain                 无门（对照：零确认项）
// 环境面：FAKE_ACP_GATES（同一轮内的门数，顺序开）/ FAKE_ACP_TOOL_TITLE（超长 title 的截断面）/
//        FAKE_ACP_APPROVAL_MESSAGE（审批门 message 原样透传面）/ FAKE_ACP_CRASH_ON_PROMPT（第 N 轮崩）/
//        FAKE_ACP_CRASH_AFTER_GATE（开门后崩：失效路径 A 的崩溃面）。
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
const MODE = process.env.FAKE_ACP_MODE || 'permission';
const GATES = Number(process.env.FAKE_ACP_GATES || 1);
const CRASH_ON_PROMPT = Number(process.env.FAKE_ACP_CRASH_ON_PROMPT || 0);
const CRASH_AFTER_GATE = process.env.FAKE_ACP_CRASH_AFTER_GATE === '1';
const TOOL_TITLE = process.env.FAKE_ACP_TOOL_TITLE || null;
const APPROVAL_MESSAGE = process.env.FAKE_ACP_APPROVAL_MESSAGE || null;
const OPTIONS = ${JSON.stringify(PERMISSION_OPTIONS)};

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\\n'); }
function log(entry) {
  const file = process.env.FAKE_ACP_FRAMES_LOG;
  if (!file) return;
  try { fs.appendFileSync(file, JSON.stringify(entry) + '\\n'); } catch {}
}
try {
  if (process.env.FAKE_ACP_ARGS_LOG) fs.appendFileSync(process.env.FAKE_ACP_ARGS_LOG, JSON.stringify(argv) + '\\n');
} catch {}

// 一次性形态（PR 验收 7：\`omp -p\` 路径零改动，argv 仍含 --approval-mode yolo）
if (argv.includes('-p')) {
  console.log('one-shot answer: ' + argv[argv.length - 1]);
  process.exit(0);
}

const modelIdx = argv.indexOf('--model');
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'deepseek/deepseek-v4-flash';
let sessionSeq = 0;
let promptSeq = 0;
let gateSeq = 0;
let serverSeq = 9000;
let lastSession = 'sess-1';
const awaiting = new Map(); // 本子进程服务端请求 id -> { promptId, gatesLeft, kind, index }

function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function chunk(text) {
  send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: lastSession, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } } });
}

/** 开一道门（permission / approval 两型），登记等待中的应答。 */
function openGate(promptId, gatesLeft) {
  const id = ++serverSeq;
  const index = ++gateSeq;
  if (MODE === 'approval') {
    awaiting.set(id, { promptId, gatesLeft: 0, kind: 'tool_approval', index });
    send({ jsonrpc: '2.0', id, method: 'elicitation/create', params: {
      mode: 'form',
      sessionId: lastSession,
      message: APPROVAL_MESSAGE || ('Allow tool: write\\nPath: /tmp/x-' + index + '\\nReason: 审批门'),
      requestedSchema: { type: 'object', properties: { value: { type: 'string', enum: ['Approve', 'Deny'] } }, required: ['value'] },
    } });
    return;
  }
  const toolCall = {
    toolCallId: 'call-' + index,
    title: TOOL_TITLE || ('Edit /tmp/x-' + index),
    status: 'pending',
    rawInput: { path: '/tmp/x-' + index },
  };
  if (MODE !== 'permission_notool') toolCall.toolName = 'edit';
  awaiting.set(id, { promptId, gatesLeft, kind: 'permission', index });
  log({ frame: 'permission_request', index, at: Date.now(), toolCall, options: OPTIONS });
  send({ jsonrpc: '2.0', id, method: 'session/request_permission', params: { sessionId: lastSession, toolCall, options: OPTIONS } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.method === 'initialize') { reply(msg.id, { protocolVersion: 1, agentCapabilities: {} }); return; }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    lastSession = 'sess-' + sessionSeq;
    reply(msg.id, { sessionId: lastSession, configOptions: [{ id: 'model', category: 'model', currentValue: spawnModel, options: [] }] });
    // omp 启动期会灌初始化通知（§6.6）：静默窗口应在其后收敛
    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: lastSession, update: { sessionUpdate: 'available_commands_update', availableCommands: [] } } });
    }, 20);
    return;
  }
  if (msg.method === 'session/cancel') { log({ frame: 'session/cancel', at: Date.now(), params: msg.params }); return; }
  if (msg.method === 'session/prompt') {
    promptSeq += 1;
    if (CRASH_ON_PROMPT && promptSeq === CRASH_ON_PROMPT) { setTimeout(() => process.exit(3), 30); return; }
    if (MODE === 'plain') {
      chunk('done');
      reply(msg.id, { stopReason: 'end_turn', usage: {} });
      return;
    }
    openGate(msg.id, MODE === 'approval' ? 0 : GATES - 1);
    if (CRASH_AFTER_GATE) setTimeout(() => process.exit(3), 120);
    return;
  }
  // 客户端对本子进程服务端请求的应答（上浮链路的末梢观测面：回包值逐字落此）
  if (msg.id !== undefined && awaiting.has(msg.id)) {
    const entry = awaiting.get(msg.id);
    awaiting.delete(msg.id);
    log({ frame: 'server_request_reply', kind: entry.kind, index: entry.index, at: Date.now(), reply: msg.result || null, error: msg.error || null });
    if (entry.gatesLeft > 0) { openGate(entry.promptId, entry.gatesLeft - 1); return; }
    chunk('done');
    reply(entry.promptId, { stopReason: 'end_turn', usage: {} });
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-cfm-fake-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

/** 读 JSONL 观测面（容忍并发写入的半行）。 */
function readJsonl(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line) => {
        if (line.trim() === '') return [];
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function tmpDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  return dir;
}

/**
 * 带 flag 的 agent 子进程。`harness.startAgent` 不接受附加 flag（harness 无 flag 面），故就地实现——
 * 体例照 acp-daemon.test.js 的 startFlaggedAgent（不改 harness 公共面，Q6）。
 */
function startFlaggedAgent(instanceId, flags, { socketPath, cwd = ROOT, envExtra = {} } = {}) {
  const child = spawn(process.execPath, [BIN, 'agent', 'start', instanceId, ...flags], {
    cwd,
    env: buildEnv(socketPath, envExtra),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stderr.resume(); // 只消费 stdout（事件行观测面）；stderr 排空防背压
  child.stdout.on('data', (d) => (out += d));
  let exit = null;
  child.once('exit', (code, signal) => (exit = { code, signal }));
  const matched = (re) => out.split('\n').filter((l) => re.test(l));
  return {
    child,
    stdout: () => out,
    lines: matched,
    getExitInfo: () => exit,
    waitLine: (re, n = 1, opts = {}) => waitFor(() => (matched(re).length >= n ? out : null), { what: `第 ${n} 条 ${re}`, timeoutMs: 8000, ...opts }),
    signal: (sig) => child.kill(sig),
    stop: async () => {
      if (exit) return exit;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: `agent ${instanceId} 退出` }).catch(() => child.kill('SIGKILL'));
      return exit;
    },
  };
}

/** 假 web 节点：信封收发面（惯例同 helpers/fake-node.js；心跳保活，否则租约到期后 Router 只记录不投递）。 */
async function startWeb(socketPath, instanceId = 'web-1') {
  const node = await startFakeNode({ socketPath, instanceId, heartbeatMs: 50 });
  const body = (m) => JSON.parse(m.payload.body);
  const envelope = (type, payload) => ({
    protocol: 'oamp/1',
    message_id: `msg-${randomUUID()}`,
    type,
    payload: { content_type: 'application/json', body: JSON.stringify(payload) },
  });
  return {
    node,
    received: node.received,
    sendTask: (to, payload) => node.send(to, envelope('task.request', payload)),
    sendNotice: (to, payload) => node.send(to, envelope('notice', payload)),
    /** §5.3 信封 2：裁决回传（option_id 由 web 侧校验必属该条 options）。 */
    decide: (to, confirmationId, optionId) =>
      node.send(to, envelope('notice', { kind: 'confirmation_decision', confirmation_id: confirmationId, option_id: optionId })),
    results: (taskId) => node.received.filter((m) => m.type === 'task.result' && m.task_id === taskId).map(body),
    notices: (kind) => node.received.filter((m) => m.type === 'notice').map(body).filter((b) => !kind || b.kind === kind),
    stop: () => node.stop(),
  };
}

/** 每个端到端用例：独立 Router + 带 flag 的 agent 子进程（fake ACP 注入）+ 假 web 节点 + 临时观测目录。 */
async function setup(t, { instanceId = 'pb-dev', flags = ['--tools', 'on', '--permission', 'allow'], env = {} } = {}) {
  const dir = tmpDir(t, 'oamp-cfm-');
  const frames = path.join(dir, 'frames.jsonl');
  const argsLog = path.join(dir, 'args.jsonl');
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const agent = startFlaggedAgent(instanceId, flags, {
    socketPath: router.socketPath,
    envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN, FAKE_ACP_FRAMES_LOG: frames, FAKE_ACP_ARGS_LOG: argsLog, ...env },
  });
  t.after(() => agent.stop());
  await agent.waitLine(new RegExp(`REGISTERED instance=${instanceId}`));
  const web = await startWeb(router.socketPath);
  t.after(() => web.stop());
  const readFrames = () => readJsonl(frames);
  return {
    router,
    agent,
    web,
    frames,
    argsLog,
    readFrames,
    readArgs: () => readJsonl(argsLog),
    /** 本子进程收到的客户端应答帧（挂起/结算的帧级判据）。 */
    replyFrames: () => readFrames().filter((f) => f.frame === 'server_request_reply'),
    cancels: () => readFrames().filter((f) => f.frame === 'session/cancel'),
    /** 第 n 条信封 1（`confirmation_request`）。 */
    waitRequest: (n = 1) =>
      waitFor(() => {
        const list = web.notices('confirmation_request');
        return list.length >= n ? list[n - 1] : null;
      }, { timeoutMs: 8000, what: `第 ${n} 条 confirmation_request` }),
    waitResult: (taskId, timeoutMs = 20000) => waitFor(() => web.results(taskId)[0] || null, { timeoutMs, what: `task ${taskId} 终态` }),
    waitCancelled: (n = 1) =>
      waitFor(() => {
        const list = web.notices('confirmation_cancelled');
        return list.length >= n ? list[n - 1] : null;
      }, { timeoutMs: 8000, what: `第 ${n} 条 confirmation_cancelled` }),
  };
}

// ────────────────────────── T1：ContextPool 接线（进程内单元） ──────────────────────────

/** 进程内 fake bin 的环境面（子进程继承 test 进程 env；用例结束还原）。 */
function withFakeEnv(t, env) {
  const prev = new Map();
  for (const [key, value] of Object.entries(env)) {
    prev.set(key, process.env[key]);
    process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('T1①/PR-6：allow 档透传钩子并附加会话身份；toolCall/options 与 ACP 请求帧逐字相同', async (t) => {
  const dir = tmpDir(t, 'oamp-cfm-unit-');
  const frames = path.join(dir, 'frames.jsonl');
  withFakeEnv(t, { FAKE_ACP_MODE: 'permission', FAKE_ACP_FRAMES_LOG: frames });

  const calls = [];
  // §5.3：池只消费**注入的会话工厂**（门面按 resident 装配）；本文件的 fake 是 ACP-only ⇒ 显式指定 acp 档
  const layer = createProtocolLayer({ resident: { protocol: 'acp', permission: 'allow' }, bin: FAKE_BIN, cwd: ROOT });
  const pool = new ContextPool({
    permission: 'allow',
    createResident: layer.createResident,
    onPermissionRequest: (info) => {
      calls.push(info);
      return 'allow';
    },
  });
  t.after(() => pool.dispose());

  const session = pool.getOrCreate('chat-unit', 'pb-dev', { origin: 'web-1' });
  const result = await session.prompt('单元轮', { timeoutMs: 5000, origin: 'web-1' });

  assert.equal(result.text, 'done');
  assert.equal(calls.length, 1, '任一 ACP 权限门触发即调用钩子恰一次');
  const [info] = calls;
  const frame = readJsonl(frames).find((f) => f.frame === 'permission_request');
  assert.deepEqual(info.toolCall, frame.toolCall, 'toolCall 与 ACP 请求帧逐字相同');
  assert.deepEqual(info.options, frame.options, 'options 与 ACP 请求帧逐字相同（不筛选、不重排、不增补）');
  assert.equal(info.sessionId, 'sess-1');
  // MI-1：会话身份由 ContextPool 注入（chatId/agentId = getOrCreate 实参；origin = 该轮 origin）
  assert.equal(info.chatId, 'chat-unit');
  assert.equal(info.agentId, 'pb-dev');
  assert.equal(info.origin, 'web-1');
  const reply = readJsonl(frames).find((f) => f.frame === 'server_request_reply');
  assert.deepEqual(reply.reply, { outcome: { outcome: 'selected', optionId: 'allow_once' } }, '同步 allow ⇒ 既有默认放行项');
});

test('T1②/PR-6：deny 档不注入钩子（零调用）且既有自动拒绝三步逐字不变', async (t) => {
  const dir = tmpDir(t, 'oamp-cfm-unit-');
  const frames = path.join(dir, 'frames.jsonl');
  withFakeEnv(t, { FAKE_ACP_MODE: 'permission', FAKE_ACP_FRAMES_LOG: frames });

  const calls = [];
  // deny 档：档位门在池侧（仅 allow 档注入钩子），协议档位同样显式指定（fake 为 ACP-only）
  const layer = createProtocolLayer({ resident: { protocol: 'acp', permission: 'deny' }, bin: FAKE_BIN, cwd: ROOT });
  const pool = new ContextPool({
    permission: 'deny',
    createResident: layer.createResident,
    onPermissionRequest: (info) => {
      calls.push(info);
      return 'allow';
    },
  });
  t.after(() => pool.dispose());

  const session = pool.getOrCreate('chat-deny', 'pb-dev', { origin: 'web-1' });
  await assert.rejects(
    () => session.prompt('单元轮', { timeoutMs: 5000, origin: 'web-1' }),
    (err) => err.code === 'permission_denied',
  );
  assert.equal(calls.length, 0, 'deny 档不得注入钩子');
  const logged = readJsonl(frames);
  const reply = logged.find((f) => f.frame === 'server_request_reply');
  assert.equal(reply.reply.outcome.optionId, 'reject_once', '① 回 reject_once');
  assert.equal(logged.filter((f) => f.frame === 'session/cancel').length, 1, '② 立即 session/cancel');
});

test('T1③/PR-2：钩子返回未结算 Promise ⇒ 无应答帧（挂起）且超过轮次预算不被 kill；结算值逐字回包', async (t) => {
  const dir = tmpDir(t, 'oamp-cfm-unit-');
  const frames = path.join(dir, 'frames.jsonl');
  withFakeEnv(t, { FAKE_ACP_MODE: 'permission', FAKE_ACP_FRAMES_LOG: frames });

  let release = null;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const layer = createProtocolLayer({ resident: { protocol: 'acp', permission: 'allow' }, bin: FAKE_BIN, cwd: ROOT });
  const pool = new ContextPool({ permission: 'allow', createResident: layer.createResident, onPermissionRequest: () => gate });
  t.after(() => pool.dispose());

  const session = pool.getOrCreate('chat-hold', 'pb-dev', { origin: 'web-1' });
  const round = session.prompt('挂起轮', { timeoutMs: 300, origin: 'web-1' });
  await waitFor(() => readJsonl(frames).some((f) => f.frame === 'permission_request'), { what: '权限门到达' });

  await delay(700); // 远超 300ms 轮次预算
  const held = readJsonl(frames);
  assert.equal(held.filter((f) => f.frame === 'server_request_reply').length, 0, '挂起期间不得应答（轮次阻塞在 ACP 层）');
  assert.equal(held.filter((f) => f.frame === 'session/cancel').length, 0, '挂起期间不得 cancel（计时冻结）');

  release({ optionId: 'allow_always' });
  const result = await round;
  assert.equal(result.text, 'done');
  const replies = readJsonl(frames).filter((f) => f.frame === 'server_request_reply');
  assert.equal(replies.length, 1, '结算后恰一帧应答');
  assert.deepEqual(replies[0].reply, { outcome: { outcome: 'selected', optionId: 'allow_always' } }, '回包值逐字等于钩子值');
});

// ────────────────────────── T2：上浮信封 1 ──────────────────────────

test('T2①/PR-1：权限门上浮信封 1（8 字段齐备 + options 逐字）+ 挂起期无应答帧/无终态', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-1', prompt: '跑一个受门禁工具' });
  const env1 = await s.waitRequest(1);

  assert.match(env1.confirmation_id, /^cfm-/);
  assert.equal(env1.chat_id, 'chat-1');
  assert.equal(env1.agent_id, 'pb-dev');
  assert.equal(env1.tool, 'edit');
  assert.equal(env1.title, 'Edit /tmp/x-1');
  assert.equal(Number.isFinite(env1.created_at), true, 'created_at 必须是数字，不得依赖 web 侧兜底');
  assert.deepEqual(Object.keys(env1).sort(), ['agent_id', 'chat_id', 'confirmation_id', 'created_at', 'kind', 'options', 'title', 'tool']);
  // options 逐字等于 ACP 请求帧（同顺序、同数量、option_id 逐字；label 取自 ACP 的 name）
  const frame = s.readFrames().find((f) => f.frame === 'permission_request');
  assert.deepEqual(
    env1.options.map((o) => o.option_id),
    frame.options.map((o) => o.optionId),
  );
  assert.deepEqual(
    env1.options,
    PERMISSION_OPTIONS.map((o) => ({ option_id: o.optionId, label: o.name })),
  );

  await delay(250);
  assert.equal(s.replyFrames().length, 0, '挂起期间该 server request 无应答帧');
  assert.equal(s.web.results(task.task_id).length, 0, '挂起期间该轮无终态');
});

test('T2①/PR-1：超长 title 截断 120 字符', async (t) => {
  const long = `Edit /tmp/${'y'.repeat(200)}.txt`;
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission', FAKE_ACP_TOOL_TITLE: long } });
  await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-long', prompt: '长标题' });
  const env1 = await s.waitRequest(1);
  assert.equal(env1.title.length, 120);
  assert.equal(env1.title, long.slice(0, 120));
});

test('T2①/PR-1：权限门不带 toolName（真实 omp 帧形）⇒ tool=null，不得用 title 猜测', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission_notool' } });
  await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-nt', prompt: '无 toolName' });
  const env1 = await s.waitRequest(1);
  assert.equal(env1.tool, null);
  assert.equal(env1.title, 'Edit /tmp/x-1');
});

test('T2③/PR-1：工具审批门同样上浮（MI-2：title=原样 message 截断 120；tool 取首行；options=[Approve,Deny]）', async (t) => {
  const message = `Allow tool: write\nPath: /tmp/x\nReason: ${'r'.repeat(160)}`;
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'approval', FAKE_ACP_APPROVAL_MESSAGE: message } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-ap', prompt: '写一个文件' });
  const env1 = await s.waitRequest(1);

  assert.equal(env1.tool, 'write', 'tool 从 message 首行 `Allow tool: <tool>` 解析');
  assert.equal(env1.title.length, 120);
  assert.equal(env1.title, message.slice(0, 120), 'title = elicitation message 原样（截断 120）');
  assert.deepEqual(env1.options, [{ option_id: 'Approve' }, { option_id: 'Deny' }]);
  assert.equal(env1.chat_id, 'chat-ap');
  assert.equal(env1.agent_id, 'pb-dev');

  // 两型共用同一 pending 表与同一结算路径：option_id 原样回显（审批门上只有 Approve 视为放行）
  await s.web.decide('pb-dev', env1.confirmation_id, 'Approve');
  const reply = await waitFor(() => s.replyFrames()[0] || null, { timeoutMs: 8000, what: '审批门应答帧' });
  assert.equal(reply.kind, 'tool_approval');
  assert.deepEqual(reply.reply, { action: 'accept', content: { value: 'Approve' } });
  assert.equal((await s.waitResult(task.task_id)).state, 'completed');

  // Deny 分支：同样结算（回包 value=Deny），且不得产生 cancelled
  await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-ap', prompt: '再写一个' });
  const env2 = await s.waitRequest(2);
  await s.web.decide('pb-dev', env2.confirmation_id, 'Deny');
  const denyReply = await waitFor(() => s.replyFrames()[1] || null, { timeoutMs: 8000, what: '审批门 Deny 应答帧' });
  assert.deepEqual(denyReply.reply, { action: 'accept', content: { value: 'Deny' } });
  assert.equal(s.web.notices('confirmation_cancelled').length, 0);
});

test('T2⑤/PR-1：同一轮内两次门请求 ⇒ 两个不同 confirmation_id 且分别命中', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission', FAKE_ACP_GATES: '2' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-multi', prompt: '两次工具调用' });
  const first = await s.waitRequest(1);
  await s.web.decide('pb-dev', first.confirmation_id, 'allow_once');
  const second = await s.waitRequest(2);
  assert.notEqual(second.confirmation_id, first.confirmation_id);
  await s.web.decide('pb-dev', second.confirmation_id, 'allow_once');

  assert.equal((await s.waitResult(task.task_id)).state, 'completed');
  assert.deepEqual(
    s.replyFrames().map((f) => f.reply.outcome.optionId),
    ['allow_once', 'allow_once'],
  );
});

// ────────────────────────── T3：裁决结算 / 作用域 / 未知 id ──────────────────────────

test('T3①/PR-2：裁决结算（allow* 继续 / reject* 走既有拒绝路径且会话仍可用）', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });

  const allowTask = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-dec', prompt: '第一轮' });
  const env1 = await s.waitRequest(1);
  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  const allowReply = await waitFor(() => s.replyFrames()[0] || null, { timeoutMs: 8000, what: 'allow 应答帧' });
  assert.deepEqual(allowReply.reply, { outcome: { outcome: 'selected', optionId: 'allow_once' } }, '回包 optionId 逐字等于 option_id');
  const allowed = await s.waitResult(allowTask.task_id);
  assert.equal(allowed.state, 'completed');
  assert.equal(allowed.text, 'done');
  assert.equal(s.replyFrames().length, 1, '该 request 恰一帧应答');

  // 拒绝路径：② 既有拒绝三步（reject_once + session/cancel + permission_denied）
  const rejectTask = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-dec', prompt: '第二轮' });
  const env2 = await s.waitRequest(2);
  await s.web.decide('pb-dev', env2.confirmation_id, 'reject_once');
  await waitFor(() => s.cancels().length >= 1, { timeoutMs: 8000, what: 'session/cancel 帧' });
  const denied = await s.waitResult(rejectTask.task_id);
  assert.equal(denied.state, 'failed');
  assert.equal(denied.error, 'permission_denied');
  assert.deepEqual(s.replyFrames()[1].reply, { outcome: { outcome: 'selected', optionId: 'reject_once' } });

  // 会话仍可用：同 chat 下一轮正常跑（同一 pid）
  const third = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-dec', prompt: '第三轮' });
  const env3 = await s.waitRequest(3);
  await s.web.decide('pb-dev', env3.confirmation_id, 'allow_once');
  const again = await s.waitResult(third.task_id);
  assert.equal(again.state, 'completed');
  assert.equal(again.pid, allowed.pid, '拒绝轮不重建实例（轮次级错误）');
});

test('T3③/PR-3：作用域精确——同时挂起两条，裁决其一不结算另一条', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const taskA = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-a', prompt: 'A 轮' });
  const taskB = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-b', prompt: 'B 轮' });
  const both = await waitFor(() => {
    const list = s.web.notices('confirmation_request');
    return list.length >= 2 ? list : null;
  }, { timeoutMs: 8000, what: '两条并列挂起' });
  assert.notEqual(both[0].confirmation_id, both[1].confirmation_id);
  const byChat = new Map(both.map((e) => [e.chat_id, e]));

  await s.web.decide('pb-dev', byChat.get('chat-a').confirmation_id, 'allow_once');
  assert.equal((await s.waitResult(taskA.task_id)).state, 'completed');
  await delay(250);
  assert.equal(s.replyFrames().length, 1, '另一条不得出现应答帧');
  assert.equal(s.web.results(taskB.task_id).length, 0, '另一条轮次仍挂起（未推进、未中止）');

  await s.web.decide('pb-dev', byChat.get('chat-b').confirmation_id, 'allow_once');
  assert.equal((await s.waitResult(taskB.task_id)).state, 'completed');
  assert.equal(s.replyFrames().length, 2);
});

test('T3④/PR-4：未知 confirmation_id 静默丢弃 + 恰一行审计；其它挂起不受影响', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-unknown', prompt: '挂起轮' });
  const env1 = await s.waitRequest(1);

  const ghost = `cfm-${randomUUID()}`;
  await s.web.decide('pb-dev', ghost, 'allow_once');
  const audits = await waitFor(() => {
    const hit = s.agent.lines(new RegExp(`CONFIRMATION_DECISION confirmation_id=${ghost}`));
    return hit.length >= 1 ? hit : null;
  }, { timeoutMs: 8000, what: '未知 id 审计行' });

  await delay(250);
  assert.equal(audits.length, 1, '恰一行审计');
  assert.match(audits[0], /matched=false/, '可区分命中/未命中');
  assert.equal(s.replyFrames().length, 0, '不得产生任何 ACP 应答帧');
  assert.equal(s.web.notices().length, 1, '不得向发起方回任何消息');
  assert.equal(s.web.results(task.task_id).length, 0, '另一挂起仍在（无终态）');

  // 命中路径的审计同样是恰一行（matched=true），且不影响上面的挂起
  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  const hit = await waitFor(() => {
    const line = s.agent.lines(new RegExp(`CONFIRMATION_DECISION confirmation_id=${env1.confirmation_id}`));
    return line.length >= 1 ? line : null;
  }, { timeoutMs: 8000, what: '命中审计行' });
  assert.equal(hit.length, 1);
  assert.match(hit[0], /matched=true/);
  assert.equal((await s.waitResult(task.task_id)).state, 'completed');
});

// ────────────────────────── T4：失效路径（信封 3） ──────────────────────────

test('T4①/PR-5：轮次异常终结（ACP 崩溃）⇒ cancelled + 不残留（再裁决 ⇒ 静默丢弃）', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission', FAKE_ACP_CRASH_AFTER_GATE: '1' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-crash', prompt: '崩给我看' });
  const env1 = await s.waitRequest(1);

  const cancelled = await s.waitCancelled(1);
  assert.equal(cancelled.confirmation_id, env1.confirmation_id);
  assert.deepEqual(Object.keys(cancelled).sort(), ['confirmation_id', 'kind'], '信封 3 = {kind, confirmation_id}');
  const result = await s.waitResult(task.task_id);
  assert.equal(result.state, 'failed');

  // 不残留：同 id 再裁决 ⇒ 零新帧 + 恰一行 matched=false 审计；且 cancelled 不重复
  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  const audits = await waitFor(() => {
    const hit = s.agent.lines(new RegExp(`CONFIRMATION_DECISION confirmation_id=${env1.confirmation_id}`));
    return hit.length >= 1 ? hit : null;
  }, { timeoutMs: 8000, what: '失效后裁决审计行' });
  await delay(250);
  assert.equal(audits.length, 1);
  assert.match(audits[0], /matched=false/);
  assert.equal(s.web.notices('confirmation_cancelled').length, 1, 'pending 不残留（不重复发 cancelled）');
  assert.equal(s.replyFrames().length, 0, '失效后不得产生任何 ACP 应答帧');
});

test('T4②/PR-5：上下文淘汰（LRU）⇒ cancelled + 不残留', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission', OAMP_CTX_MAX: '1' } });
  const taskA = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-evict-a', prompt: 'A' });
  const envA = await s.waitRequest(1);
  const taskB = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-evict-b', prompt: 'B' });

  const cancelled = await s.waitCancelled(1);
  assert.equal(cancelled.confirmation_id, envA.confirmation_id);
  assert.deepEqual(Object.keys(cancelled).sort(), ['confirmation_id', 'kind'], '信封 3 = {kind, confirmation_id}');
  assert.equal((await s.waitResult(taskA.task_id)).state, 'failed');

  // 不残留：A 的 id 再裁决 ⇒ 静默丢弃；B 的挂起不受影响
  const envB = await s.waitRequest(2);
  await s.web.decide('pb-dev', envA.confirmation_id, 'allow_once');
  const audit = await waitFor(() => {
    const hit = s.agent.lines(new RegExp(`CONFIRMATION_DECISION confirmation_id=${envA.confirmation_id}`));
    return hit.length >= 1 ? hit : null;
  }, { timeoutMs: 8000, what: '失效后裁决审计行' });
  assert.equal(audit.length, 1);
  assert.match(audit[0], /matched=false/);
  assert.equal(s.web.notices('confirmation_cancelled').length, 1);

  await s.web.decide('pb-dev', envB.confirmation_id, 'allow_once');
  assert.equal((await s.waitResult(taskB.task_id)).state, 'completed');
});

test('T4③/PR-5：context_release ⇒ cancelled + 不残留', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-rel', prompt: '释放我' });
  const env1 = await s.waitRequest(1);

  await s.web.sendNotice('pb-dev', { kind: 'context_release', chat_id: 'chat-rel' });
  const cancelled = await s.waitCancelled(1);
  assert.equal(cancelled.confirmation_id, env1.confirmation_id);
  assert.deepEqual(Object.keys(cancelled).sort(), ['confirmation_id', 'kind'], '信封 3 = {kind, confirmation_id}');
  assert.equal((await s.waitResult(task.task_id)).state, 'failed');

  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  const audit = await waitFor(() => {
    const hit = s.agent.lines(new RegExp(`CONFIRMATION_DECISION confirmation_id=${env1.confirmation_id}`));
    return hit.length >= 1 ? hit : null;
  }, { timeoutMs: 8000, what: '失效后裁决审计行' });
  assert.equal(audit.length, 1);
  assert.match(audit[0], /matched=false/);
  await delay(200);
  assert.equal(s.web.notices('confirmation_cancelled').length, 1);
  assert.equal(s.replyFrames().length, 0);
});

test('T4④/PR-5：SIGINT 前全量清扫——对端实际收到 cancelled，且发送先于 deregister', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-exit', prompt: '退出前告知' });
  const env1 = await s.waitRequest(1);

  s.agent.signal('SIGINT');
  const cancelled = await s.waitCancelled(1); // 判据①（优先）：对端实际收到该 notice
  assert.equal(cancelled.confirmation_id, env1.confirmation_id);
  const exit = await waitFor(() => s.agent.getExitInfo(), { timeoutMs: 5000, what: 'agent 退出' });
  assert.equal(exit.code, 0, 'SIGINT 应优雅退出 0');

  // 判据②（退路）：发送顺序先于 deregister（帧级顺序证据）
  const ordered = s.agent.lines(/CONTEXT_NOTICE|DEREGISTERED/);
  const atCancelled = ordered.findIndex((l) => l.includes('confirmation_cancelled'));
  const atDeregister = ordered.findIndex((l) => l.includes('DEREGISTERED'));
  assert.ok(atCancelled >= 0, `应打出 cancelled 的 notice 行: ${ordered.join(' | ')}`);
  assert.ok(atDeregister > atCancelled, `发送序应先于 deregister: ${ordered.join(' | ')}`);
});

test('T4⑥/PR-5：正常完成的轮次零 cancelled（无误报）', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-clean', prompt: '正常轮' });
  const env1 = await s.waitRequest(1);
  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  assert.equal((await s.waitResult(task.task_id)).state, 'completed');
  await delay(200);
  assert.equal(s.web.notices('confirmation_cancelled').length, 0);
});

// ────────────────────────── T5：档位与路径护栏 + 冻结语义 ──────────────────────────

test('T5①/PR-6：deny 档端到端零确认项，既有自动拒绝语义不变', async (t) => {
  const s = await setup(t, { flags: ['--tools', 'on', '--permission', 'deny'], env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-deny-e2e', prompt: '受门禁调用' });
  const result = await s.waitResult(task.task_id);

  assert.equal(result.state, 'failed');
  assert.equal(result.error, 'permission_denied');
  assert.equal(s.web.notices('confirmation_request').length, 0, 'deny 档不得产生任何确认项');
  const logged = s.readFrames();
  assert.equal(logged.find((f) => f.frame === 'server_request_reply').reply.outcome.optionId, 'reject_once');
  assert.equal(logged.filter((f) => f.frame === 'session/cancel').length, 1);
});

test('T5②/PR-7：一次性路径零改动（argv 仍含 --approval-mode yolo）+ 零确认项', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp', prompt: '推荐一部动漫' });
  assert.equal((await s.waitResult(task.task_id)).state, 'completed');

  const oneShot = s.readArgs().find((a) => a.includes('-p'));
  assert.ok(oneShot, '一次性路径应 spawn `omp -p`');
  assert.ok(!oneShot.includes('acp'));
  assert.equal(oneShot[oneShot.indexOf('--approval-mode') + 1], PROFILES['omp:oneshot'].approval.mode, '§4.4/W2-A：档位值取自 omp:oneshot profile 的 approval.mode（逐字 yolo）');
  assert.equal(s.web.notices('confirmation_request').length, 0);
});

test('T5③/PR-7：`!` shell 路径零改动、零确认项', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { command: process.execPath, args: ['-e', 'console.log("shell-ok")'] });
  const result = await s.waitResult(task.task_id);
  assert.equal(result.state, 'completed');
  const stdout = s.web.received
    .filter((m) => m.type === 'task.update' && m.task_id === task.task_id)
    .map((m) => JSON.parse(m.payload.body))
    .filter((b) => b.kind === 'stdout')
    .map((b) => b.line);
  assert.ok(stdout.some((l) => l.includes('shell-ok')));
  assert.equal(s.web.notices('confirmation_request').length, 0);
});

test('T5⑤/PR-6：挂起时长超过轮次预算（timeout_ms=300）不被 cancel/kill，裁决后正常结算', async (t) => {
  const s = await setup(t, { env: { FAKE_ACP_MODE: 'permission' } });
  const task = await s.web.sendTask('pb-dev', { executor: 'omp-daemon', chat_id: 'chat-freeze', prompt: '慢裁决', timeout_ms: 300 });
  const env1 = await s.waitRequest(1);

  await delay(700); // 远超该轮预算
  assert.equal(s.cancels().length, 0, '挂起期不得 cancel');
  assert.equal(s.web.results(task.task_id).length, 0, '挂起期该轮不得出现终态');

  await s.web.decide('pb-dev', env1.confirmation_id, 'allow_once');
  assert.equal((await s.waitResult(task.task_id)).state, 'completed', '裁决到达后按剩余预算续跑并结算');
  assert.equal(s.web.notices('confirmation_cancelled').length, 0);
});
