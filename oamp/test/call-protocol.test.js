// test/call-protocol.test.js — 0018 pr-005：调用面端到端验收断言（architecture §12.2 组 A~J + M）
// 载体：真实 Router（子进程）+ `oamp web start`（子进程，随机端口 + 临时 OAMP_DB）+ 本文件局部 fake ACP 桩
//       （OAMP_OMP_BIN 注入桩；FAKE_ACP_ARGS_LOG 记录 argv）+ 既有 `startFakeNode` 载荷/投递观测 + node:sqlite 直读。
// 归属：本文件是 0018 调用面（POST /api/calls · GET /api/calls · /stream · /:call_id/stream · /:call_id/transcript ·
//       /:call_id）断言的唯一落点——既有 22 个 test/*.test.js 与 test/helpers/** 零字节改动，
//       故 startWeb / FAKE_ACP_SOURCE / jget / jpost / jreq / openSse / setup 等按既有体例在**文件内局部复制**
//       （不抽公共 helper；既有 helpers/harness.js 与 helpers/fake-node.js 属既有文件，直接 import 零改动）。
//       控制台页面（web/calls.html、web/calls.js）属 pr-004，本文件不做任何控制台断言。
// 零真实依赖：零真实 omp（OAMP_OMP_BIN 一律指向本文件桩）/ 零真实 LLM / 零外网 / 零 tmux；
//             OAMP_DB 一律指向 fs.mkdtempSync(os.tmpdir()) 下的 sql.db，绝不触碰仓库 oamp/data/sql.db 与 .runtime/。
// 端口：本文件独占 49500~49999（既有测试已占 41000/43000/45000/47000 各 2000 段；pr-004 占 49000~49499）。
//
// 桩的可控面（T1 验收 4）：
//   env 旋钮（进程级）：FAKE_ACP_ARGS_LOG / FAKE_ACP_FAIL=1 / FAKE_ACP_CHUNKS=N / FAKE_ACP_SLEEP_MS=N /
//                       FAKE_ACP_SESSION_ECHO=1 / FAKE_ACP_MEMORY=1。
//   另支持 **prompt 内指令**（轮次级覆盖，供同一 agent 进程服务混合场景——env 旋钮是进程级的，
//   而同一用例内既有「成功轮」也有「失败轮」/「超上限轮」，进程级旋钮无法同时表达）：
//                       `#fail` / `#sleep=<ms>` / `#chunks=<n>` / `#echo-session` / `#memory`。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');
// 仓库主工作区的同名文件是 0018 之前的旧版 ⇒ 一律相对**本测试文件**解析（绝不 cwd 相对）
const API_MD = fileURLToPath(new URL('../API.md', import.meta.url));
const LLMS_TXT = fileURLToPath(new URL('../llms.txt', import.meta.url));

// —— fake omp：常驻 JSON-RPC 形态的 ACP 桩（零真实 LLM）——
// 方法面覆盖 web/agent 实际调用：initialize / session/new / session/set_config_option / session/prompt。
// 观测面 = `收到：<prompt 原文>` 回显（分片下发 agent_message_chunk）+ 可选 sessionId 回显 / 同会话记忆。
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let sessionSeq = 0;
const sessions = new Map(); // sessionId -> { model, notes[] }
const configOptions = (model) => [{ id: 'model', category: 'model', currentValue: model, options: [] }];

const envNum = (name) => (process.env[name] === undefined ? null : Number(process.env[name]));
function directive(text, key) {
  const m = new RegExp('#' + key + '=([0-9]+)').exec(text);
  return m === null ? null : Number(m[1]);
}
function splitEvenly(text, n) {
  if (text.length === 0) return [''];
  if (n >= text.length) return Array.from({ length: n }, (_, i) => text[i % text.length]);
  const out = [];
  let idx = 0;
  for (let i = 0; i < n; i += 1) {
    const size = Math.floor(text.length / n) + (i < text.length % n ? 1 : 0);
    out.push(text.slice(idx, idx + size));
    idx += size;
  }
  return out;
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
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    return;
  }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    const sessionId = 'sess-' + process.pid + '-' + sessionSeq; // 含 pid：每个会话各自一个 ACP 进程 ⇒ 单进程内序号不足以区分会话

    sessions.set(sessionId, { model: 'fake/model', notes: [] });
    send({ jsonrpc: '2.0', id: msg.id, result: { sessionId, configOptions: configOptions('fake/model') } });
    return;
  }
  if (msg.method === 'session/set_config_option') {
    const session = sessions.get(msg.params.sessionId);
    if (session) session.model = msg.params.value;
    send({ jsonrpc: '2.0', id: msg.id, result: { configOptions: configOptions(msg.params.value) } });
    return;
  }
  if (msg.method === 'session/prompt') {
    const session = sessions.get(msg.params.sessionId);
    if (!session) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'unknown session' } });
      return;
    }
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
    const memory = process.env.FAKE_ACP_MEMORY === '1' || text.includes('#memory');
    if (memory) {
      const note = /记住\\s+(\\S+)/.exec(text);
      if (note) session.notes.push(note[1]);
    }
    if (process.env.FAKE_ACP_FAIL === '1' || text.includes('#fail')) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'fake prompt failure' } });
      return;
    }
    const sleepMs = directive(text, 'sleep') ?? envNum('FAKE_ACP_SLEEP_MS') ?? 0;
    const chunks = directive(text, 'chunks') ?? envNum('FAKE_ACP_CHUNKS') ?? 3;
    let answer = '收到：' + text;
    if (process.env.FAKE_ACP_SESSION_ECHO === '1' || text.includes('#echo-session')) answer += '\\n[session] ' + msg.params.sessionId;
    if (memory && session.notes.length > 0) answer += '\\n记忆：' + session.notes.join(',');
    const pieces = splitEvenly(answer, chunks);
    const gapMs = pieces.length <= 20 ? 5 : 0; // 片间 0~5ms；大 N（超上限用例）取 0 以免用例超时
    for (const piece of pieces) {
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: { sessionId: msg.params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: piece } } },
      });
      if (gapMs > 0) await delay(gapMs);
    }
    if (sleepMs > 0) await delay(sleepMs);
    send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } } });
    return;
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-call-fake-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

// 端口段独占 49500~49999：文件内顺序执行，登记后不复用 ⇒ 同文件内零撞端口。
const USED_PORTS = new Set();
function pickPort() {
  for (;;) {
    const port = 49500 + Math.floor(Math.random() * 500);
    if (!USED_PORTS.has(port)) {
      USED_PORTS.add(port);
      return port;
    }
  }
}

// 租约：web 是常驻发送方（心跳下限 500ms），harness SHORT_ENV 的 300ms 租约会让它被判 offline
// ⇒ Router 对 task.update/result 只记录不投递。本文件统一放长租约（与 web.test.js / project-workspace.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

/** 起 `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）；等 WEB_READY，提前退出抛错。 */
async function startWeb(socketPath, port, envExtra = {}) {
  const child = spawn(process.execPath, [BIN, 'web', 'start', '--port', String(port)], {
    cwd: ROOT,
    env: buildEnv(socketPath, { ...LEASE_ENV, ...envExtra }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  let exit = null;
  child.once('exit', (code, signal) => (exit = { code, signal }));
  await waitFor(() => out.includes('WEB_READY') || exit, { timeoutMs: 5000, what: 'web WEB_READY' });
  if (exit) throw new Error(`web 提前退出: ${JSON.stringify(exit)} stderr=${err}`);
  return {
    base: `http://127.0.0.1:${port}`,
    socketPath,
    getExit: () => exit,
    stdout: () => out,
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

async function jget(base, p) {
  const res = await fetch(`${base}${p}`);
  return { status: res.status, ct: res.headers.get('content-type'), body: await res.json().catch(() => null) };
}

async function jpost(base, p, payload) {
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, ct: res.headers.get('content-type'), body: await res.json().catch(() => null) };
}

/** 裸请求：返回 status / content-type / connection / 原文 / 可解析 JSON 体（需断言 ct 或非 JSON 面时用）。 */
async function jreq(base, method, p, init = {}) {
  const res = await fetch(`${base}${p}`, { method, ...init });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 静态面 / SSE：非 JSON */
  }
  return { status: res.status, ct: res.headers.get('content-type'), conn: res.headers.get('connection'), text, body };
}

/** SSE 客户端：fetch + reader 手工解析 `data:` 帧（零依赖；路径参数化，headers 到达即视为订阅已注册）。 */
async function openSse(base, p) {
  const ac = new AbortController();
  const res = await fetch(`${base}${p}`, { signal: ac.signal });
  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let type = null;
          let data = null;
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) type = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (type && data) {
            try {
              events.push({ type, data: JSON.parse(data) });
            } catch {
              /* 忽略坏帧 */
            }
          }
        }
      }
    } catch {
      /* abort */
    }
  })();
  return { status: res.status, ct: res.headers.get('content-type'), events, close: () => ac.abort(), pump };
}

const detailOf = async (web, chatId) => (await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`)).body;

/** 建一条对话并等首轮落 out（该轮消耗会话「首轮」名额 ⇒ 后续调用面的 prompt 不含项目上下文块）。 */
async function createChat(web, projectId, agentId, text) {
  const sent = await jpost(web.base, '/api/messages', { project_id: projectId, agent_id: agentId, text });
  assert.equal(sent.status, 200, `建对话应成功: ${JSON.stringify(sent.body)}`);
  assert.equal(sent.body.warning, null, `建对话不应有派发告警: ${JSON.stringify(sent.body)}`);
  const chatId = sent.body.chat_id;
  await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.messages.some((m) => m.direction === 'out') ? d : null;
    },
    { timeoutMs: 8000, what: `chat ${chatId} 首轮落 out` },
  );
  return chatId;
}

/** 起 Router + 真实 agent（实例名 = 角色公式 `pb-<role>`）+ 项目 / 对话 fixture；全部句柄 t.after 回收。 */
async function setup(t, { withAgent = true, agentId = 'pb-dev', agentEnv = {}, webEnv = {}, warm = true } = {}) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  let agent = null;
  if (withAgent) {
    // OAMP_OMP_MODEL 折到桩的会话默认值（'fake/model'）⇒ 未显式指定 model 时终态 model = 'fake/model'
    agent = await startAgent(agentId, { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: FAKE_BIN, OAMP_OMP_MODEL: 'fake/model', ...agentEnv } });
    t.after(() => agent.stop());
    await agent.waitAgentLine(new RegExp(`REGISTERED instance=${agentId}`));
  }
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-call-db-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const dbPath = path.join(dbDir, 'sql.db');
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath, ...webEnv });
  t.after(() => web.stop());
  const project = await jpost(web.base, '/api/projects', { repo_url: 'https://example.com/oamp-call-protocol.git' });
  assert.equal(project.status, 200, `建项目应成功: ${JSON.stringify(project.body)}`);
  const projectId = project.body.project.project_id;
  const chatId = warm ? await createChat(web, projectId, agentId, '预热') : null;
  return { router, agent, web, dbPath, dbDir, projectId, chatId };
}

/** 发起调用（受理面）。 */
const callOnce = (web, payload) => jpost(web.base, '/api/calls', payload);

/** 按调用 id 取信封。 */
const callGet = (web, callId) => jget(web.base, `/api/calls/${encodeURIComponent(callId)}`);

/** 等该调用终态（返回终态信封）。 */
async function waitTerminal(web, callId, timeoutMs = 10000) {
  return await waitFor(
    async () => {
      const r = await callGet(web, callId);
      if (r.status !== 200) return null;
      return r.body.state === 'completed' || r.body.state === 'failed' ? r.body : null;
    },
    { timeoutMs, what: `call ${callId} 终态` },
  );
}

/** 超上限更新调用（registry 1000 条封顶 ⇒ updatesTruncated）：桩推 1001 片；供 T4 验收 7 / T8 验收 4 复用。 */
async function overCapCall(web, chatId) {
  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: '超上限更新轮 #chunks=1001' });
  assert.equal(sent.status, 200, `超上限调用应受理: ${JSON.stringify(sent.body)}`);
  const callId = sent.body.calls[0].call_id;
  const env = await waitTerminal(web, callId, 90000);
  assert.equal(env.truncated, true, '超上限调用终态 truncated 应为 true');
  return callId;
}

/** 负向断言的有界观察窗（等待的是「不发生」，waitFor 不适用）。 */
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** task.update / task.result 信封（假节点用）。 */
const envelope = (taskId, type, body) => ({
  protocol: 'oamp/1',
  message_id: `${type === 'task.result' ? 'trs' : 'tup'}-${randomUUID()}`,
  type,
  task_id: taskId,
  payload: { content_type: 'application/json', body: JSON.stringify(body) },
});

/** 调用面 6 条路由签名（§2.1 行 14~19，表末位连续 6 条）。 */
const CALL_ROUTE_SIGNATURES = [
  'POST /api/calls',
  'GET /api/calls',
  'GET /api/calls/stream',
  'GET /api/calls/:call_id/stream',
  'GET /api/calls/:call_id/transcript',
  'GET /api/calls/:call_id',
];

/** 信封 10 键与键序（§3.1 唯一形状）。 */
const ENVELOPE_KEYS = ['call_id', 'agent', 'state', 'duration_ms', 'model', 'truncated', 'text', 'structured_output', 'error', 'exit_code'];

// ────────────────────────── T1：骨架 + 局部 harness + 冒烟 ──────────────────────────

test('0018 调用面骨架冒烟：/api/docs 六条调用面路由 + GET /api/calls roster + 首调用受理', async (t) => {
  const { web, chatId } = await setup(t);

  const docs = await jget(web.base, '/api/docs');
  assert.equal(docs.status, 200, '/api/docs 应 200');
  const sigs = docs.body.routes.map((r) => `${r.method} ${r.path}`);
  for (const sig of CALL_ROUTE_SIGNATURES) assert.ok(sigs.includes(sig), `路由表应含 ${sig}`);

  const roster = await jget(web.base, '/api/calls');
  assert.equal(roster.status, 200, 'GET /api/calls 应 200');
  assert.ok(Array.isArray(roster.body.calls), 'GET /api/calls 应返回 calls 数组');

  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: '冒烟：0018-CALL-SMOKE' });
  assert.equal(sent.status, 200, `POST /api/calls 应 200: ${JSON.stringify(sent.body)}`);
  assert.match(sent.body.calls[0].call_id, /^task-[0-9a-f-]{36}$/, '受理响应应含 task-<uuid> 形态的 call_id');

  const env = await waitTerminal(web, sent.body.calls[0].call_id);
  assert.equal(env.state, 'completed');
  assert.match(env.text, /收到：.*0018-CALL-SMOKE/s, '终态 text 应为桩回显');
});

// ────────────────────────── T2：组 A —— 按角色名寻址与角色可发现性（F03） ──────────────────────────

test('0018 组 A（F03）：按角色名寻址命中 / 三种不可用同码同文案 / 失败不拉起 agent / role 与 null 可读', async (t) => {
  const { web, agent, chatId } = await setup(t);

  // 验收 1：按角色名发起命中该角色（终态回显证明任务确实落在注册为 pb-dev 的实例上）
  const marker = 'F03-ROLE-HIT';
  const ok = await callOnce(web, { chat_id: chatId, agent: 'dev', task: `任务标记 ${marker}` });
  assert.equal(ok.status, 200, `按角色名发起应 200: ${JSON.stringify(ok.body)}`);
  assert.equal(ok.body.calls[0].agent, 'dev', '受理响应 agent = 角色名');
  const okEnv = await waitTerminal(web, ok.body.calls[0].call_id);
  assert.equal(okEnv.state, 'completed');
  assert.match(okEnv.text, new RegExp(`收到：.*${marker}`, 's'), '终态 text 应含桩回显与唯一标记');

  // 验收 4（前哨）：role 与 null 形态
  const agents = await jget(web.base, '/api/agents');
  assert.equal(agents.status, 200);
  const devNode = agents.body.agents.find((a) => a.instance_id === 'pb-dev');
  assert.ok(devNode, '应存在注册为 pb-dev 的实例');
  assert.equal(devNode.role, 'dev', 'pb-dev 的 role 应可反解为 dev');
  const webNode = agents.body.agents.find((a) => a.instance_id === 'web');
  assert.ok(webNode, '控制台自身应注册为 web 实例');
  assert.equal(webNode.role, null, '非 pb-<role> 公式的实例 role 应为 null');
  const online = await jget(web.base, '/api/agents?state=online');
  assert.deepEqual(online.body.agents.map((a) => Object.keys(a)), agents.body.agents.map((a) => Object.keys(a)).slice(0, online.body.agents.length), '?state=online 与无参同形状');
  assert.ok(online.body.agents.every((a) => a.state === 'online'), '?state=online 只返回在线实例');
  assert.ok(online.body.agents.every((a) => agents.body.agents.some((b) => b.instance_id === a.instance_id)), 'online 集合 ⊆ 全量集合');

  // 验收 2/3：停掉该 agent → 与「不存在角色」同码同文案；两次失败前后零新注册
  await agent.stop();
  await waitFor(async () => {
    const r = await jget(web.base, '/api/agents');
    const node = r.body.agents.find((a) => a.instance_id === 'pb-dev');
    return !node || node.state === 'offline' ? true : null; // 优雅停 = deregister（条目移除）；租约到期路径为 offline 墓碑
  }, { timeoutMs: 5000, what: 'pb-dev 不再在线' });
  const before = (await jget(web.base, '/api/agents')).body.agents.map((a) => a.instance_id).slice().sort();

  const offlineCall = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F03-OFFLINE' });
  const missingCall = await callOnce(web, { chat_id: chatId, agent: 'no-such-role-0018', task: 'F03-MISSING' });
  assert.equal(offlineCall.status, 404, `角色离线应 404: ${JSON.stringify(offlineCall.body)}`);
  assert.equal(missingCall.status, 404, `角色不存在应 404: ${JSON.stringify(missingCall.body)}`);
  for (const r of [offlineCall, missingCall]) {
    assert.equal(r.body.code, 'NOT_FOUND', '两种不可用应同码 NOT_FOUND（零新错误码）');
    assert.match(r.body.error, /^agent 不可用: .+（无对应在线实例）$/, '两种不可用应同文案模板');
  }

  const after = (await jget(web.base, '/api/agents')).body.agents.map((a) => a.instance_id).slice().sort();
  assert.deepEqual(after, before, '失败路径不得拉起 / 注册任何 agent（含 offline 墓碑口径）');
});

// ────────────────────────── T3：组 B —— 调用入参契约（F04） ──────────────────────────

test('0018 组 B（F04）：context 可见且 task 无污染 / output_schema 超子集 400 / 批量两项 / block 与 background / model 优先级 / 被排除维度零出现', async (t) => {
  const { web, chatId } = await setup(t);

  // 验收 3（先做，roster 干净）：批量两项 = 两个独立调用
  const batch = await callOnce(web, { chat_id: chatId, agent: 'dev', tasks: [{ task: '批量甲 F04-BATCH-A' }, { task: '批量乙 F04-BATCH-B' }] });
  assert.equal(batch.status, 200, `批量应 200: ${JSON.stringify(batch.body)}`);
  assert.equal(batch.body.calls.length, 2, '一次提交两项应得两个独立调用');
  const [idA, idB] = batch.body.calls.map((c) => c.call_id);
  assert.notEqual(idA, idB, '两个 call_id 互不相同');
  for (const id of [idA, idB]) {
    assert.equal((await callGet(web, id)).status, 200, `按 id 可查 ${id}`);
  }
  const roster = (await jget(web.base, '/api/calls')).body.calls;
  const batchRows = roster.filter((r) => r.call_id === idA || r.call_id === idB);
  assert.equal(batchRows.length, 2, 'roster 应出现这两行');
  await waitTerminal(web, idA);
  await waitTerminal(web, idB);

  // 验收 1：context 可见且 task 原文无前缀污染
  const ctx = '共享说明：F04-CONTEXT-原文';
  const taskText = 'F04-TASK-原文';
  const withCtx = await callOnce(web, { chat_id: chatId, agent: 'dev', task: taskText, context: ctx });
  assert.equal(withCtx.status, 200);
  const ctxEnv = await waitTerminal(web, withCtx.body.calls[0].call_id);
  assert.equal(ctxEnv.text, `收到：【调用共享说明】\n${ctx}\n\n${taskText}`, '共享说明应是独立区块，task 原文无污染');

  const noCtx = await callOnce(web, { chat_id: chatId, agent: 'dev', task: taskText });
  assert.equal(noCtx.status, 200);
  const noCtxEnv = await waitTerminal(web, noCtx.body.calls[0].call_id);
  assert.equal(noCtxEnv.text, `收到：${taskText}`, '不带 context 时 task 原文逐字（零添加）');

  // 验收 2：output_schema 超出受限子集 → 400；合法受限子集 → 200
  const illegal = [
    { type: 'object', $ref: '#' },
    { type: 'object', items: {} },
    { type: 'object', properties: { nested: { type: 'object', properties: { a: { type: 'string' } } } } },
    { format: 'date' },
    { oneOf: [] },
  ];
  for (const schema of illegal) {
    const r = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-SCHEMA-ILLEGAL', output_schema: schema });
    assert.equal(r.status, 400, `非法 output_schema 应 400: ${JSON.stringify(schema)}`);
    assert.equal(r.body.code, 'INVALID_PARAM');
  }
  const legalSchema = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };
  const legal = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-SCHEMA-LEGAL', output_schema: legalSchema });
  assert.equal(legal.status, 200, `合法受限子集应受理: ${JSON.stringify(legal.body)}`);
  await waitTerminal(web, legal.body.calls[0].call_id);

  // 验收 4：mode='block' 返回即终态；缺省（background）立即受理
  const blocked = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-BLOCK', mode: 'block' });
  assert.equal(blocked.status, 200);
  const blockedEnv = blocked.body.calls[0];
  assert.ok(blockedEnv.state === 'completed' || blockedEnv.state === 'failed', `block 返回应即终态（实得 ${blockedEnv.state}）`);
  assert.notEqual(blockedEnv.state, 'submitted', 'block 不得返回受理态');
  assert.notEqual(blockedEnv.text, null, 'block 终态 text 应可用');

  const background = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-BACKGROUND' });
  assert.equal(background.status, 200);
  assert.equal(background.body.calls[0].state, 'submitted', 'background 应立即可得受理态');
  await waitTerminal(web, background.body.calls[0].call_id);

  // 验收 5：显式 model 优先级；不指定 → 桩默认生效值
  const explicit = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-MODEL', model: 'openai/gpt-5.6-luna' });
  assert.equal(explicit.status, 200, `显式 model 应受理: ${JSON.stringify(explicit.body)}`);
  const explicitEnv = await waitTerminal(web, explicit.body.calls[0].call_id);
  assert.equal(explicitEnv.model, 'openai/gpt-5.6-luna', '显式 model 应优先并如实上报');
  const defaulted = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F04-MODEL-DEFAULT' });
  const defaultedEnv = await waitTerminal(web, defaulted.body.calls[0].call_id);
  assert.equal(defaultedEnv.model, 'fake/model', '未指定 model 时终态 = 桩的默认生效值');

  // 验收 6：被排除维度零出现（运行期路由投影 + 调用 prompt 文本；不检索 src/**）
  const docs = await jget(web.base, '/api/docs');
  const callRoute = docs.body.routes.find((r) => r.method === 'POST' && r.path === '/api/calls');
  const projected = [callRoute.summary, callRoute.response, ...callRoute.params.map((p) => p.name), ...callRoute.params.map((p) => p.desc)].join('\n');
  for (const word of ['isolated', 'effort', 'local://', 'agent://', 'protocol', 'role', 'executor', 'fallback', 'brief', 'working_directory']) {
    assert.equal(projected.includes(word), false, `调用面投影不得出现被排除维度 ${word}`);
  }
  for (const word of ['isolated', 'effort', 'local://', 'agent://', 'protocol', 'role', 'executor', 'fallback', 'brief', 'working_directory']) {
    assert.equal(noCtxEnv.text.includes(word), false, `调用 prompt 文本不得出现被排除维度 ${word}`);
  }
});

// ────────────────────────── T4：组 C/D —— 调用身份、按 id 查询与结构化终态字段（F05/F06） ──────────────────────────

test('0018 组 C/D（F05/F06）：受理含 call_id+agent / 进行中与终态字段 / 结构化输出 / 成败词表 / 零 usage·token·成本 / 截断 / 同一标识无血缘 / 无第二入口', { timeout: 180000 }, async (t) => {
  const { web, chatId } = await setup(t);

  // 验收 1：受理含 call_id + agent，且可按 id 查回同一次调用
  const accepted = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F05-IDENT' });
  assert.equal(accepted.status, 200);
  const callId = accepted.body.calls[0].call_id;
  assert.match(callId, /^task-[0-9a-f-]{36}$/, 'call_id 形态 = task-<uuid>');
  assert.equal(accepted.body.calls[0].agent, 'dev');
  const roundTrip = await callGet(web, callId);
  assert.equal(roundTrip.status, 200, '受理返回的 call_id 应可查回同一次调用');
  assert.equal(roundTrip.body.call_id, callId);

  // 验收 2：进行中窗口（桩结算前延迟）→ 状态明确、原值字段为 null
  const running = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F05-IN-PROGRESS #sleep=1200' });
  assert.equal(running.status, 200);
  const runningId = running.body.calls[0].call_id;
  const mid = await waitFor(
    async () => {
      const r = await callGet(web, runningId);
      if (r.status !== 200) return null;
      return r.body.state === 'submitted' || r.body.state === 'working' ? r.body : null;
    },
    { timeoutMs: 5000, what: '进行中窗口内可查' },
  );
  assert.ok(mid.state === 'submitted' || mid.state === 'working', `进行中 state 应明确（实得 ${mid.state}）`);
  assert.equal(mid.duration_ms, null, '进行中 duration_ms 应为 null');
  assert.equal(mid.model, null, '进行中 model 应为 null（不显示推测值）');
  assert.equal(mid.text, null, '进行中 text 应为 null');
  assert.equal(mid.exit_code, null, '进行中 exit_code 应为 null');

  // 验收 3：终态字段逐项齐备 + 键序与按 id 查询完全一致
  const block = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F06-TERMINAL', mode: 'block' });
  const blockedEnv = block.body.calls[0];
  const gotEnv = (await callGet(web, blockedEnv.call_id)).body;
  assert.deepEqual(Object.keys(blockedEnv), ENVELOPE_KEYS, 'block 终态信封键序 = §3.1 十键');
  assert.deepEqual(Object.keys(gotEnv), ENVELOPE_KEYS, '按 id 取回的终态信封键序应完全一致');
  assert.ok(Number.isInteger(blockedEnv.duration_ms) && blockedEnv.duration_ms > 0, 'duration_ms 应为正整数');
  assert.equal(blockedEnv.model, 'fake/model');
  assert.equal(blockedEnv.state, 'completed');
  assert.equal(blockedEnv.error, null);
  assert.ok(typeof blockedEnv.text === 'string' && blockedEnv.text !== '', '终态 text 应为非空');

  // 验收 4：结构化输出按期望结构返回；不带 schema 时为 null 且 text 可用
  const schema = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };
  const structured = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F06-STRUCTURED', output_schema: schema, mode: 'block' });
  const sEnv = structured.body.calls[0];
  assert.equal(sEnv.state, 'completed', `带 schema 的调用应成功: ${JSON.stringify(sEnv)}`);
  assert.ok(sEnv.structured_output === null || typeof sEnv.structured_output === 'object', 'structured_output 应为对象或 null');
  if (sEnv.structured_output !== null) {
    for (const [name, prop] of Object.entries(schema.properties)) {
      assert.ok(Object.hasOwn(sEnv.structured_output, name), `structured_output 应含声明键 ${name}`);
      assert.equal(typeof sEnv.structured_output[name], prop.type, `键 ${name} 类型应相符`);
    }
  }
  const noSchema = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F06-NO-SCHEMA' });
  const nEnv = await waitTerminal(web, noSchema.body.calls[0].call_id);
  assert.equal(nEnv.structured_output, null, '不带 output_schema 时 structured_output = null');
  assert.ok(typeof nEnv.text === 'string' && nEnv.text !== '', '不带 output_schema 时 text 仍可用');

  // 验收 6：响应键集合零 usage / tokens / cost / aborted（受理信封 + 按 id 信封）
  const acceptedEnv = await waitTerminal(web, callId);
  for (const env of [blockedEnv, gotEnv, acceptedEnv]) {
    for (const key of ['usage', 'tokens', 'cost', 'aborted']) {
      assert.equal(Object.hasOwn(env, key), false, `信封不得含 ${key} 键`);
    }
  }

  // 验收 7：截断标记可信（helper 供 T8 复用）
  const overCapId = await overCapCall(web, chatId);
  assert.equal((await callGet(web, overCapId)).body.truncated, true, '超上限调用 truncated = true');
  assert.equal(blockedEnv.truncated, false, '常规调用 truncated = false');

  // 验收 8：同一标识、无血缘命名、无第二套 id 体系
  const rosterRow = (await jget(web.base, '/api/calls')).body.calls.find((r) => r.call_id === callId);
  assert.ok(rosterRow, 'roster 应出现该调用');
  assert.equal(rosterRow.call_id, callId, '受理响应 / roster / 按 id 查询三处 call_id 逐字同值');
  assert.equal((await callGet(web, callId)).body.call_id, callId);
  assert.equal(callId.includes('.'), false, 'call_id 不得含血缘后缀分隔符');
  for (const env of [blockedEnv, gotEnv]) {
    for (const key of ['parent', 'child', 'lineage']) assert.equal(Object.hasOwn(env, key), false, `信封不得含血缘字段 ${key}`);
  }
  // 验收 5（放最后：失败轮会让会话崩溃重建）：词表可区分成功 / 失败
  const failed = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F06-FAIL #fail' });
  assert.equal(failed.status, 200, `失败轮仍应受理: ${JSON.stringify(failed.body)}`);
  const failedEnv = await waitTerminal(web, failed.body.calls[0].call_id);
  assert.equal(failedEnv.state, 'failed', '桩注入失败应产出 failed 终态');
  assert.ok(typeof failedEnv.error === 'string' && failedEnv.error !== '', 'failed 时 error 应为非空字符串');
  assert.equal(blockedEnv.error, null, 'completed 时 error 应为 null（成败由终态词表区分）');

  // 验收 9：调用面不存在「全量任务列表 / 按状态过滤」的第二入口
  const docs = await jget(web.base, '/api/docs');
  const callRoutes = docs.body.routes.filter((r) => `${r.method} ${r.path}`.includes('/api/calls'));
  for (const route of callRoutes) {
    assert.equal(/\b(state|filter|limit|offset|sort)\b/.test(route.path), false, `调用面路径不得含过滤编排面: ${route.path}`);
    for (const p of route.params) {
      assert.equal(['state', 'filter', 'limit', 'offset', 'sort'].includes(p.name), false, `调用面参数不得含过滤编排面: ${route.path} ${p.name}`);
    }
  }
});

// ────────────────────────── T5：组 E —— 终态异步投递（F07） ──────────────────────────

test('0018 组 E（F07）：先订阅再发起收到 call_result / 只订阅不查询 / 并发只订阅其一 / 连续多次无静默丢失（含对账补投）', async (t) => {
  const { router, web, projectId } = await setup(t, { withAgent: false, warm: false, webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '200' } });

  // 假节点充当 pb-dev：终态发给**未注册** ghost（Router「recorded」语义：只记任务表、不投递 web）
  // ⇒ 确定性构造「投递被丢弃」，由 web 对账定时器补投（构造法同 test/web.test.js:721-789）。
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'pb-dev',
    heartbeatMs: 400,
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      setTimeout(() => {
        node.client
          .send('ghost-node', envelope(msg.task_id, 'task.result', { state: 'completed', text: '对账补投的回复', model: 'fake/model', duration_ms: 42 }))
          .catch(() => {});
      }, 20);
      return undefined;
    },
  });
  t.after(() => node.stop());
  const chatId = await createChat(web, projectId, 'pb-dev', '预热（投递丢失）');

  // 验收 1/2：先订阅再发起；全程不查询该调用
  const sse = await openSse(web.base, `/api/calls/stream?chat_id=${encodeURIComponent(chatId)}`);
  t.after(() => sse.close());
  assert.equal(sse.status, 200);
  assert.match(sse.ct, /^text\/event-stream/, '调用事件流应为 SSE');

  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F07-异步投递' });
  assert.equal(sent.status, 200, `调用应受理: ${JSON.stringify(sent.body)}`);
  const firstId = sent.body.calls[0].call_id;
  const firstFrame = await waitFor(() => sse.events.find((e) => e.type === 'call_result' && e.data.call_id === firstId) || null, {
    timeoutMs: 8000,
    what: 'call_result 从流中到达（未经任何查询）',
  });
  assert.ok(firstFrame, 'call_result 应带该调用的 call_id');

  // 验收 5：帧形态 = chat_id + 信封 10 键（平铺，无嵌套 call 键）
  assert.deepEqual(Object.keys(firstFrame.data), ['chat_id', ...ENVELOPE_KEYS], 'call_result data 键集合 = chat_id + 信封十键');
  assert.equal(firstFrame.data.chat_id, chatId);
  assert.equal(Object.hasOwn(firstFrame.data, 'call'), false, 'call_result 不得嵌套 call 键');

  // 验收 3：两次并发只订阅其一（本次改订阅按调用 id 的单调用流）
  const a = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F07-CONCURRENT-A' });
  const b = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F07-CONCURRENT-B' });
  const idA = a.body.calls[0].call_id;
  const idB = b.body.calls[0].call_id;
  const sseA = await openSse(web.base, `/api/calls/${encodeURIComponent(idA)}/stream`);
  t.after(() => sseA.close());
  await waitFor(() => sseA.events.find((e) => e.type === 'call_result' && e.data.call_id === idA) || null, {
    timeoutMs: 8000,
    what: 'A 的单调用流收到 call_result',
  });
  assert.equal(sseA.events.some((e) => e.data.call_id === idB), false, '只订阅其一不得混入另一次调用');
  assert.equal(sseA.events.some((e) => e.data.call_id !== idA), false, '单调用流只见该调用');

  // 验收 4：连续 ≥3 次调用（本假节点一律把终态发给 ghost ⇒ 一律经对账路径补投）每次终态均可达
  const sse2 = await openSse(web.base, `/api/calls/stream?chat_id=${encodeURIComponent(chatId)}`);
  t.after(() => sse2.close());
  for (let i = 0; i < 3; i += 1) {
    const r = await callOnce(web, { chat_id: chatId, agent: 'dev', task: `F07-连续-${i}` });
    assert.equal(r.status, 200, `第 ${i + 1} 次调用应受理`);
    const id = r.body.calls[0].call_id;
    await waitFor(() => sse2.events.find((e) => e.type === 'call_result' && e.data.call_id === id) || null, {
      timeoutMs: 8000,
      what: `第 ${i + 1} 次连续调用的终态经流到达（投递丢弃 → 对账补投）`,
    });
  }
});

// ────────────────────────── T6：组 F —— 调用级进度可见（F08） ──────────────────────────

test('0018 组 F（F08）：submitted→working→call_update*→call_result 闭合 / ≥2 增量 / 与转录一致 / 帧内无工具级字段 / 不重放', async (t) => {
  const { web, chatId } = await setup(t);

  const sse = await openSse(web.base, `/api/calls/stream?chat_id=${encodeURIComponent(chatId)}`);
  t.after(() => sse.close());

  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F08-进度 #chunks=3' });
  assert.equal(sent.status, 200);
  const callId = sent.body.calls[0].call_id;
  await waitFor(() => sse.events.find((e) => e.type === 'call_result' && e.data.call_id === callId) || null, { timeoutMs: 8000, what: 'call_result' });

  const frames = sse.events.filter((e) => e.data.call_id === callId);
  const kinds = frames.map((f) => (f.type === 'call_state' ? `call_state:${f.data.state}` : f.type));
  assert.equal(kinds[0], 'call_state:submitted', `序列应以受理态起（实得 ${kinds.join(',')}）`);
  assert.equal(kinds[1], 'call_state:working', '首个增量到达即迁移 working');
  assert.equal(kinds.filter((k) => k === 'call_state:working').length, 1, 'call_state(working) 每调用恰一次');
  assert.equal(kinds.at(-1), 'call_result', '序列应闭合于该调用的终态');

  // 验收 2：≥2 次增量，且每帧 kind ∈ {chunk, stdout, stderr} 且 text/line 至少其一在场
  const updates = frames.filter((f) => f.type === 'call_update');
  assert.ok(updates.length >= 2, `增量帧应 ≥2（实得 ${updates.length}）`);
  for (const u of updates) {
    assert.ok(['chunk', 'stdout', 'stderr'].includes(u.data.kind), `call_update.kind 应在词表内（实得 ${u.data.kind}）`);
    assert.ok(typeof u.data.text === 'string' || typeof u.data.line === 'string', 'call_update 应至少带 text 或 line');
  }
  assert.equal(kinds.slice(2, -1).every((k) => k === 'call_update'), true, '中间帧应全为 call_update（无悬空 / 无乱序）');

  // 验收 3：增量与随后取的转录一致（同源）
  const transcript = await jget(web.base, `/api/calls/${encodeURIComponent(callId)}/transcript`);
  assert.equal(transcript.status, 200);
  const chunkTexts = transcript.body.entries.map((e) => e.detail?.text).filter((t) => typeof t === 'string' && t !== '');
  assert.deepEqual(updates.map((u) => u.data.text), chunkTexts.slice(0, updates.length), '流中增量文本应按序出现在转录条目中');

  // 验收 4：帧内无工具级字段与 token / 成本；控制条目不下发为 call_update
  const allowed = {
    call_state: ['chat_id', 'call_id', 'agent', 'state'],
    call_update: ['chat_id', 'call_id', 'agent', 'kind', 'text', 'line'],
    call_result: ['chat_id', ...ENVELOPE_KEYS],
  };
  for (const f of frames) {
    for (const key of Object.keys(f.data)) {
      assert.ok(allowed[f.type].includes(key), `${f.type} 帧不得含键 ${key}`);
    }
    for (const key of ['usage', 'tokens', 'cost', 'aborted', 'tool', 'tool_name', 'args', 'intent', 'retry']) {
      assert.equal(Object.hasOwn(f.data, key), false, `${f.type} 帧不得含 ${key}`);
    }
  }
  assert.equal(frames.some((f) => ['started', 'truncated'].includes(f.data.detail?.event)), false, '控制条目不作为 call_update 下发');

  // 验收 5：不重放（订阅之前发生的调用事件不补发）
  const before = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F08-不重放' });
  const beforeId = before.body.calls[0].call_id;
  await waitTerminal(web, beforeId);
  const sse2 = await openSse(web.base, `/api/calls/stream?chat_id=${encodeURIComponent(chatId)}`);
  t.after(() => sse2.close());
  await settle(300);
  assert.equal(sse2.events.some((e) => e.data.call_id === beforeId), false, '订阅之前的事件不得补发');
});

// ────────────────────────── T7：组 G —— 调用 roster（F09） ──────────────────────────

test('0018 组 G（F09）：两行六列 / started_at·ended_at 口径 / 状态与按 id 一致 / 无成本 token / 无过滤分页编排入口', async (t) => {
  const { web, chatId } = await setup(t);

  // 验收 1：批量两项 → 两行、六列齐备、键序同 §3.4
  const batch = await callOnce(web, { chat_id: chatId, agent: 'dev', tasks: [{ task: 'F09-ROW-A' }, { task: 'F09-ROW-B' }] });
  assert.equal(batch.status, 200);
  const ids = batch.body.calls.map((c) => c.call_id);
  await waitTerminal(web, ids[0]);
  await waitTerminal(web, ids[1]);
  const rows = (await jget(web.base, '/api/calls')).body.calls.filter((r) => ids.includes(r.call_id));
  assert.equal(rows.length, 2, '批量两项应对应两行');
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), ['call_id', 'agent', 'state', 'started_at', 'ended_at', 'model'], '行键集合与键序 = §3.4 六列');
    assert.equal(row.agent, 'dev');
    assert.ok(Number.isInteger(row.started_at) && row.started_at > 0, 'started_at 应为 epoch ms');
    assert.equal(row.model, 'fake/model', '终态行的 model = 执行侧实报值');
    for (const key of ['usage', 'tokens', 'cost', 'aborted', 'actions', 'cancel_url', 'steer_url']) {
      assert.equal(Object.hasOwn(row, key), false, `行内不得含 ${key}`);
    }
  }

  // 验收 2：进行中 ended_at = null；终态后 ended_at ≥ started_at；started_at 与受理时刻同量级
  const t0 = Date.now();
  const running = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F09-IN-PROGRESS #sleep=1200' });
  const runningId = running.body.calls[0].call_id;
  const liveRow = await waitFor(
    async () => {
      const r = await jget(web.base, '/api/calls');
      const row = r.body.calls.find((x) => x.call_id === runningId);
      return row && (row.state === 'submitted' || row.state === 'working') ? row : null;
    },
    { timeoutMs: 5000, what: '进行中 roster 行' },
  );
  assert.equal(liveRow.ended_at, null, '进行中行的 ended_at 应为 null');
  assert.equal(liveRow.model, null, '进行中行的 model 应为 null');
  assert.ok(liveRow.started_at >= t0 && liveRow.started_at <= Date.now(), 'started_at 应与受理时刻同量级');
  await waitTerminal(web, runningId);
  const doneRow = (await jget(web.base, '/api/calls')).body.calls.find((x) => x.call_id === runningId);
  assert.ok(doneRow.ended_at >= doneRow.started_at, '终态行 ended_at 应 ≥ started_at');

  // 验收 3：同一时刻 roster 行 state === 按 id 查询的 state（两个读取面同真源）
  const env = await callGet(web, runningId);
  const rosterRow = (await jget(web.base, '/api/calls')).body.calls.find((x) => x.call_id === runningId);
  assert.equal(rosterRow.state, env.body.state, 'roster 与按 id 的 state 应一致');

  // 验收 5：无过滤 / 分页 / 排序入口（参数元数据为空数组；带查询参数的请求与不带逐行相同）
  const docs = await jget(web.base, '/api/docs');
  const rosterRoute = docs.body.routes.find((r) => r.method === 'GET' && r.path === '/api/calls');
  assert.deepEqual(rosterRoute.params, [], 'GET /api/calls 参数元数据应为空数组');
  const plain = (await jget(web.base, '/api/calls')).body.calls;
  const filtered = (await jget(web.base, '/api/calls?state=completed&limit=1&sort=state')).body.calls;
  assert.deepEqual(filtered, plain, '未实现过滤 / 分页 / 排序：带参请求应与不带参逐行相同');
});

// ────────────────────────── T8：组 H —— 调用转录（F10） ──────────────────────────

test('0018 组 H（F10）：转录含终态条目 / 进程内直接可读 / 重启后 404 / 超上限 truncated / messages 表零转录内容', { timeout: 180000 }, async (t) => {
  const { router, web, dbPath, projectId, chatId } = await setup(t);

  // 验收 1/2：终态调用 → 转录含末尾终态条目；不带 output_schema 的调用直接可读（无登记开关）
  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F10-转录 #chunks=2', mode: 'block' });
  const callId = sent.body.calls[0].call_id;
  const res = await jget(web.base, `/api/calls/${encodeURIComponent(callId)}/transcript`);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body), ['call_id', 'agent', 'state', 'truncated', 'entries'], '转录键集合 = §3.5');
  assert.equal(res.body.call_id, callId);
  assert.equal(res.body.agent, 'dev');
  assert.ok(Array.isArray(res.body.entries) && res.body.entries.length > 0, '转录条目应非空');
  for (const e of res.body.entries) {
    assert.deepEqual(Object.keys(e).sort(), ['at', 'detail', 'from', 'state'], '条目应保留 {at, from, state, detail}');
  }
  const last = res.body.entries.at(-1);
  assert.equal(last.detail.event, 'result', '末条应为终态条目');
  assert.equal(last.state, res.body.state, '终态条目 state 应为该调用终态');
  assert.equal(res.body.entries.length, res.body.entries.filter((e) => e.detail.event !== 'result').length + 1, '终态恰追加一条');
  const docs = await jget(web.base, '/api/docs');
  const transcriptRoute = docs.body.routes.find((r) => r.path === '/api/calls/:call_id/transcript');
  assert.deepEqual(transcriptRoute.params.map((p) => p.name), ['call_id'], '转录面零「登记」开关（仅 call_id 参数）');

  // 验收 4：超上限 truncated = true，且与信封同值；常规调用为 false
  const overCapId = await overCapCall(web, chatId);
  const overTranscript = await jget(web.base, `/api/calls/${encodeURIComponent(overCapId)}/transcript`);
  assert.equal(overTranscript.body.truncated, true, '超上限转录 truncated 应为 true');
  assert.equal((await callGet(web, overCapId)).body.truncated, true, '转录与信封应同值（同一 callTruncated）');
  assert.equal(res.body.truncated, false, '常规调用转录 truncated = false');
  assert.equal(res.body.truncated, (await callGet(web, callId)).body.truncated, '常规调用转录与信封同值');

  // 验收 5：messages 表零转录内容（node:sqlite 直读临时库；用专用 chat 使行数归因确定：
  // 预热轮 1 in + 1 out，该次调用再贡献 1 in + 1 out）
  const chatF10 = await createChat(web, projectId, 'pb-dev', '预热 F10');
  const callF10 = await callOnce(web, { chat_id: chatF10, agent: 'dev', task: 'F10-落库归属', mode: 'block' });
  const callF10Id = callF10.body.calls[0].call_id;
  const db = new DatabaseSync(dbPath);
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
    assert.equal(tables.some((n) => n.includes('transcript') || n.startsWith('call_')), false, '不应出现转录类新表');
    const rows = db.prepare('SELECT direction, text, meta FROM messages WHERE chat_id = ?').all(chatF10);
    assert.equal(rows.length, 4, `专用 chat 应恰 4 行（预热轮 2 行 + 该次调用 2 行），实得 ${rows.length}`);
    assert.deepEqual(rows.map((r) => r.direction).sort(), ['in', 'in', 'out', 'out'], 'in / out 各 2 行 ⇒ 该次调用贡献 1 in + 1 out');
    const byTaskId = rows.filter((r) => typeof r.meta === 'string' && r.meta.includes(callF10Id));
    assert.equal(byTaskId.length, 1, '该次调用应恰 1 条带 meta.task_id 的 in 行');
    assert.equal(byTaskId[0].direction, 'in');
    for (const r of rows) {
      for (const shape of ['"event":"', '"kind":"', '"at":']) {
        assert.equal(r.text.includes(shape), false, `入库正文不得含转录条目形态 ${shape}`);
      }
    }
  } finally {
    db.close();
  }

  // 验收 3：重启（新 Router + 新 web，新临时 socket）→ 同 id → 404 且非 5xx、非伪造内容
  await web.stop();
  await router.stop();
  const router2 = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router2]));
  const web2 = await startWeb(router2.socketPath, pickPort(), { OAMP_DB: dbPath });
  t.after(() => web2.stop());
  const restarted = await jreq(web2.base, 'GET', `/api/calls/${encodeURIComponent(callId)}/transcript`);
  assert.equal(restarted.status, 404, `重启后同 id 应 404（实得 ${restarted.status}）`);
  assert.ok(restarted.status < 500, '不得为 5xx');
  assert.equal(restarted.body.code, 'NOT_FOUND');
  assert.ok(typeof restarted.body.error === 'string' && restarted.body.error !== '', '应为既有 {error, code} 契约');
  assert.equal(Object.hasOwn(restarted.body, 'entries'), false, '404 不得伪造转录内容');
});

// ────────────────────────── T9：组 I —— 调用归属 chat 与项目（F11） ──────────────────────────

test('0018 组 I（F11）：带归属成功且可经 messages[].meta.task_id 核对 / 未提供与空值 400 零新增 / 项目继承 / project 与 context 并存不合并', async (t) => {
  // 角色实例统一由假节点 pb-dev 承担（不另起真实 agent），既提供 task.request 载荷观测面，也避免同名实例重复注册
  const { router, web, projectId } = await setup(t, { withAgent: false, warm: false });
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'pb-dev',
    heartbeatMs: 400,
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      const origin = msg.from.instance_id;
      setTimeout(() => {
        node.client
          .send(origin, envelope(msg.task_id, 'task.result', { state: 'completed', text: '假节点应答', model: 'fake/model', duration_ms: 12, context_id: 'ctx-fake', pid: 4242 }))
          .catch(() => {});
      }, 10);
      return undefined;
    },
  });
  t.after(() => node.stop());
  const chatId = await createChat(web, projectId, 'pb-dev', '预热');

  // 验收 1：带归属成功，且可经 messages[].meta.task_id 关联核对
  const sent = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F11-归属' });
  assert.equal(sent.status, 200, `带归属调用应 200: ${JSON.stringify(sent.body)}`);
  const callId = sent.body.calls[0].call_id;
  await waitFor(() => (node.received.some((m) => m.task_id === callId) ? true : null), { timeoutMs: 5000, what: '假节点收到 task.request' });
  await waitTerminal(web, callId);
  const detail = await detailOf(web, chatId);
  const inRow = detail.messages.find((m) => m.direction === 'in' && m.meta?.task_id === callId);
  assert.ok(inRow, 'messages 中应有 direction=in 且 meta.task_id = call_id 的行');
  const lastOut = detail.messages.filter((m) => m.direction === 'out').at(-1);
  assert.ok(lastOut, '终态后同 chat 应另有 direction=out 行');

  // 验收 2/5：未提供与空值一律 400 且零调用（roster 行数不变、目标 chat messages 不变）
  const rosterBefore = (await jget(web.base, '/api/calls')).body.calls.length;
  const msgsBefore = (await detailOf(web, chatId)).messages.length;
  for (const payload of [{}, { chat_id: null }, { chat_id: '' }, { chat_id: 123 }]) {
    const r = await callOnce(web, { agent: 'dev', task: 'F11-NO-CHAT', ...payload });
    assert.equal(r.status, 400, `缺 / 空 / 非字符串 chat_id 应 400: ${JSON.stringify(payload)}`);
    assert.equal(r.body.code, 'INVALID_PARAM');
  }
  assert.equal((await jget(web.base, '/api/calls')).body.calls.length, rosterBefore, '失败路径不得新增 roster 行');
  assert.equal((await detailOf(web, chatId)).messages.length, msgsBefore, '失败路径不得写入 messages');

  // 验收 3：项目上下文继承（经派发载荷观测——agent 侧只在会话首轮渲染，不能拿 prompt 回显当判据）
  const inherit = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F11-PROJECT' });
  assert.equal(inherit.status, 200);
  const inheritId = inherit.body.calls[0].call_id;
  const inheritMsg = await waitFor(() => node.received.find((m) => m.task_id === inheritId) || null, { timeoutMs: 5000, what: '继承轮的 task.request' });
  const inheritBody = JSON.parse(inheritMsg.payload.body);
  assert.deepEqual(Object.keys(inheritBody.project).sort(), ['agreement', 'name', 'repo_url'], '载荷 project 应三要素齐备');
  const project = (await jget(web.base, '/api/projects')).body.projects.find((p) => p.project_id === projectId);
  assert.equal(inheritBody.project.name, project.name);
  assert.equal(inheritBody.project.repo_url, project.repo_url);
  await waitTerminal(web, inheritId);

  // 验收 4：project 与 context 并存不合并
  const ctx = '共享说明：F11-CONTEXT-原文';
  const taskText = 'F11-CTX-TASK-原文';
  const both = await callOnce(web, { chat_id: chatId, agent: 'dev', task: taskText, context: ctx });
  const bothId = both.body.calls[0].call_id;
  const bothMsg = await waitFor(() => node.received.find((m) => m.task_id === bothId) || null, { timeoutMs: 5000, what: '并存轮的 task.request' });
  const bothBody = JSON.parse(bothMsg.payload.body);
  assert.deepEqual(Object.keys(bothBody.project).sort(), ['agreement', 'name', 'repo_url'], 'context 不得覆盖 project 字段');
  assert.equal(bothBody.prompt.includes(`【调用共享说明】\n${ctx}\n\n${taskText}`), true, 'context 应是 prompt 内的独立区块');
  await waitTerminal(web, bothId);

  const only = await callOnce(web, { chat_id: chatId, agent: 'dev', task: 'F11-NO-CTX' });
  const onlyId = only.body.calls[0].call_id;
  const onlyMsg = await waitFor(() => node.received.find((m) => m.task_id === onlyId) || null, { timeoutMs: 5000, what: '无 context 轮的 task.request' });
  const onlyBody = JSON.parse(onlyMsg.payload.body);
  assert.equal(onlyBody.prompt.includes('【调用共享说明】'), false, '不给 context 时不得伪造该区块');
  assert.deepEqual(Object.keys(onlyBody.project).sort(), ['agreement', 'name', 'repo_url'], 'project 不应被替代');
  await waitTerminal(web, onlyId);
});

// ────────────────────────── T10：组 J —— agent 身份规则 (chat, agent 名)（F12） ──────────────────────────

test('0018 组 J（F12）：同 chat 同角色两轮共享上下文 / 跨 chat 隔离 / 无 one_shot 开关', async (t) => {
  const { web, projectId, chatId } = await setup(t, { agentEnv: { FAKE_ACP_MEMORY: '1', FAKE_ACP_SESSION_ECHO: '1' } });
  const chatB = await createChat(web, projectId, 'pb-dev', '预热 B');

  const token = 'F12-TOKEN-7f3a';
  const remember = await callOnce(web, { chat_id: chatId, agent: 'dev', task: `记住 ${token}`, mode: 'block' });
  const r1 = remember.body.calls[0];
  assert.equal(r1.state, 'completed');
  const askA = await callOnce(web, { chat_id: chatId, agent: 'dev', task: `${token} 是什么`, mode: 'block' });
  const a2 = askA.body.calls[0];
  assert.equal(a2.state, 'completed');
  assert.equal(a2.text.includes(`记忆：${token}`), true, '同 chat 同角色第二轮应复用同一会话（第 1 轮交代的信息可见）');

  // 验收 3（辅助判据）：同 chat 两轮 sessionId 相同
  const sessOf = (text) => (/\[session\] (sess-\d+)/.exec(text) || [])[1];
  assert.equal(sessOf(r1.text), sessOf(a2.text), '同 chat 同角色的两轮应落在同一会话');

  // 验收 2：跨 chat 隔离（chat B 向同名角色问同一问题，答复不含 chat A 交代的信息）
  const askB = await callOnce(web, { chat_id: chatB, agent: 'dev', task: `${token} 是什么`, mode: 'block' });
  const b1 = askB.body.calls[0];
  assert.equal(b1.state, 'completed');
  assert.equal(b1.text.includes(`记忆：${token}`), false, '跨 chat 不得渗漏另一会话的记忆');
  assert.notEqual(sessOf(b1.text), sessOf(a2.text), '不同 chat 应使用不同会话（上下文池键 = (chat_id, agent_id)）');

  // 交替多轮仍互不渗漏
  const a3 = (await callOnce(web, { chat_id: chatId, agent: 'dev', task: `${token} 再说一次`, mode: 'block' })).body.calls[0];
  const b2 = (await callOnce(web, { chat_id: chatB, agent: 'dev', task: `${token} 再说一次`, mode: 'block' })).body.calls[0];
  assert.equal(a3.text.includes(`记忆：${token}`), true, 'chat A 后续轮仍共享');
  assert.equal(b2.text.includes(`记忆：${token}`), false, 'chat B 后续轮仍隔离');

  // 验收 4：默认路径无 one_shot 开关（例外入口仍是既有 POST /api/messages，本文件不断言其内部行为）
  const docs = await jget(web.base, '/api/docs');
  const callRoute = docs.body.routes.find((r) => r.method === 'POST' && r.path === '/api/calls');
  assert.equal(callRoute.params.some((p) => p.name === 'one_shot'), false, '调用面不得暴露 one_shot 开关');
});

// ────────────────────────── T11：组 M —— 不做项零半成品检索（F15） ──────────────────────────

test('0018 组 M（F15）：路由表零禁用词 / API.md 调用面章节命中 ⊆ 允许集合 / llms.txt 零命中 / 调用面正文零禁用面', async (t) => {
  const { web } = await setup(t);
  const BANNED = ['cancel', 'terminate', 'steer', 'isolated', 'effort', 'local://', 'agent://'];

  // 验收 1：运行期路由投影（19 条 = 既有 13 + 调用面 6）的 path 与 params[].name 零命中
  const docs = await jget(web.base, '/api/docs');
  assert.equal(docs.body.routes.length, 19, `路由表应为 19 条（实得 ${docs.body.routes.length}）`);
  for (const route of docs.body.routes) {
    for (const word of BANNED) {
      assert.equal(route.path.includes(word), false, `路由路径不得含禁用词 ${word}: ${route.path}`);
      for (const p of route.params) assert.equal(p.name.includes(word), false, `路由参数不得含禁用词 ${word}: ${route.path} ${p.name}`);
    }
  }

  // 验收 4：调用面路由正文（summary / response / desc）零命中（含 one_shot）
  const callRoutes = docs.body.routes.filter((r) => `${r.method} ${r.path}`.includes('/api/calls'));
  assert.equal(callRoutes.length, 6, '调用面应有 6 条');
  for (const route of callRoutes) {
    const text = [route.summary, route.response, ...route.params.map((p) => p.desc)].join('\n');
    for (const word of [...BANNED, 'one_shot']) {
      assert.equal(text.includes(word), false, `调用面正文不得含禁用词 ${word}: ${route.method} ${route.path}`);
    }
  }

  // 验收 2：API.md 调用面章节的命中行 ⊆ 允许区间（§6 不做声明 ∪ §7 全章）
  const lines = fs.readFileSync(API_MD, 'utf8').split('\n');
  const SCOPE = [
    [628, 898],
    [937, 962],
    [1279, 1386],
    [1387, 1412],
    [1415, 1534],
  ];
  const ALLOWED = [
    [1387, 1412],
    [1415, 1534],
  ];
  const inRanges = (n, ranges) => ranges.some(([a, b]) => n >= a && n <= b);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    if (!inRanges(lineNo, SCOPE)) continue;
    if (BANNED.some((w) => lines[i].includes(w))) hits.push(lineNo);
  }
  assert.ok(hits.length > 0, '调用面章节应含合法命中（§6 不做声明 / §7 差异清单）');
  for (const lineNo of hits) {
    assert.ok(inRanges(lineNo, ALLOWED), `API.md 调用面章节第 ${lineNo} 行的命中落在允许集合之外`);
  }

  // 验收 3：llms.txt（生成物面）零命中
  const llms = fs.readFileSync(LLMS_TXT, 'utf8');
  for (const word of BANNED) assert.equal(llms.includes(word), false, `llms.txt 不得含禁用词 ${word}`);
});
