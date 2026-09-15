// test/sdk-api.test.js — 0025 pr-007：层 A（`hub api …` ↔ Web 接口面 21 条）行为用例（F02 / F05 / F06 / F09）
// 载体（architecture §10 T2）：真实 Router 子进程 + `oamp web start` 子进程（段内随机端口 + 临时 OAMP_DB）
//   + 本文件局部 fake ACP 桩（OAMP_OMP_BIN 注入）。层 A 的**一切**调用经 pr-004 的
//   `test/helpers/hub-harness.js` 的 `runHub()` 起子进程（跨 PR 接口契约，不另建第二套子进程辅助）；
//   直连对照侧用测试进程自身的 fetch。
// 归属：F02（接口面逐条覆盖）／F05（默认 JSON 与 `--human` 两态）／F06（订阅 NDJSON）／F09（零状态）。
// 零真实依赖：零真实 omp（OAMP_OMP_BIN 恒指向本文件桩）／零真实 LLM／零外网；OAMP_DB 与 socket 一律在
//   os.tmpdir()，绝不触碰仓库内运行态目录（§10 测试基建约束）。
// 端口：本 PR 独占段 51000~51999（与 pr-008 / pr-009 / pr-010 的段零交集）。段只是**约束上界**：
//   候选端口一律经 node:net 运行时空闲探测，且**绝不**走缺省端口链 —— 缺省端口被主工作区的活 web 进程实占，
//   走缺省链会连到外部 hub，制造假绿（本文件的 hub 包装恒注入 OAMP_WEB_PORT）。
// 局部复制体例（不抽公共 helper）：fake ACP 桩／startWeb／端口取用／NDJSON 与错误面断言原语，体例沿用
//   test/call-protocol.test.js 与 test/web.test.js；既有 helpers 与 sdk/** 零字节改动（只 import 的也不改）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { runHub } from './helpers/hub-harness.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根 = oamp/
const BIN = path.join(PKG_ROOT, 'bin', 'oamp.js');
const SELF = fileURLToPath(import.meta.url); // 本文件自身（收口静态守门用例的扫描对象）

// ============================== 常量（口径单一落点） ==============================

// 端口段（主 agent 冻结）：段界只此两处字面量；段只是约束上界，端口仍须运行时探测为空闲。
const PORT_MIN = 51000;
const PORT_MAX = 51999;

// 租约：web 是常驻发送方（心跳下限 500ms），harness SHORT_ENV 的 300ms 租约会让它被判 offline
// ⇒ Router 对 task.update/result 只记录不投递。本文件统一放长租约（与 web.test.js / call-protocol.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

// 事件名白名单（API.md §4.1 / §4.2 / §4.4）：订阅输出的事件名必须落在对应作用域的表内。
const CHAT_EVENTS = ['message', 'task_update', 'chat_state', 'notice'];
const GLOBAL_EVENTS = ['agent_online', 'agent_offline', 'confirmation', 'chat_state'];
const CALL_EVENTS = ['call_state', 'call_update', 'call_result'];

// 调用信封的封闭 10 键（API.md §3.19；`calls create` 的 `calls[]` 元素与 `calls get` 同一形状）。
const ENVELOPE_KEYS = [
  'call_id',
  'agent',
  'state',
  'duration_ms',
  'model',
  'truncated',
  'text',
  'structured_output',
  'error',
  'exit_code',
];

// 易变键白名单（[model_inferred]，口径见 pr-007-tasks.md §5-2）：时间戳 / 会话 id / 时长每次观测都可能不同
// ⇒ 只要求**存在且类型相同**，取值不强等（API.md §5 开头即声明"看结构即可"）。
const VOLATILE_KEYS = new Set([
  'session_id',
  'last_heartbeat',
  'created_at',
  'updated_at',
  'closed_at',
  'archived_at',
  'started_at',
  'ended_at',
  'duration_ms',
  'at',
]);

// ============================== 局部 fake ACP 桩 ==============================

// 常驻 JSON-RPC 形态的 ACP 桩（零真实 LLM）：方法面覆盖 web/agent 实际调用（initialize / session/new /
//   session/set_config_option / session/prompt），prompt 内指令 `#chunks=<n>` / `#sleep=<ms>`（体例沿用
//   call-protocol.test.js）。`#chunks=1001` 是 `truncated === true` 的既有可达路径（Router 任务表 1000 条封顶）。
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\\n'); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv.slice(2).includes('-p')) {
  console.log('one-shot answer: ' + process.argv[process.argv.length - 1]);
  process.exit(0);
}

let sessionSeq = 0;
const sessions = new Map();
const configOptions = (model) => [{ id: 'model', category: 'model', currentValue: model, options: [] }];
const directive = (text, key) => {
  const m = new RegExp('#' + key + '=([0-9]+)').exec(text);
  return m === null ? null : Number(m[1]);
};
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
  try { msg = JSON.parse(raw); } catch { return; }
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    return;
  }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    const sessionId = 'sess-' + process.pid + '-' + sessionSeq;
    sessions.set(sessionId, { model: 'fake/model' });
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
    const chunks = directive(text, 'chunks') ?? 3;
    const sleepMs = directive(text, 'sleep') ?? 0;
    const pieces = splitEvenly('收到：' + text, chunks);
    const gapMs = pieces.length <= 20 ? 5 : 0; // 大 N（超上限用例）取 0 以免用例超时
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

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-api-fake-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

// ============================== 端口取用（段 + 运行时探测 + 去重） ==============================

const USED_PORTS = new Set();

/** 运行时空闲探测：候选端口在 127.0.0.1 上 listen 成功即空闲（临时 server 随即 close）。 */
function probeFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/** 段内随机候选 → 文件内去重 → 运行时空闲探测 → 断言落在段内（段是上界，不是硬编码列表）。 */
async function pickPort() {
  for (;;) {
    const port = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1));
    if (USED_PORTS.has(port)) continue;
    if (!(await probeFree(port))) continue;
    assert.ok(port >= PORT_MIN && port <= PORT_MAX, `端口 ${port} 越出本 PR 段（${PORT_MIN}~${PORT_MAX}）`);
    USED_PORTS.add(port);
    return port;
  }
}

// ============================== 通用断言原语 ==============================

/** 失败消息里的原始片段（截断到可读长度；订阅 / 解析类失败必须带上原文）。 */
const snippet = (text, max = 240) => JSON.stringify(String(text).slice(0, max));

const kindOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);

/** stdout → 单个 JSON 文档（层 A 结果面：恰一行、可解析；失败消息点名原文片段）。 */
function jsonDoc(stdout) {
  const trimmed = stdout.replace(/\n+$/, '');
  const lines = trimmed.split('\n');
  assert.equal(lines.length, 1, `stdout 应为单个 JSON 文档（实际 ${lines.length} 行）: ${snippet(stdout)}`);
  try {
    return JSON.parse(lines[0]);
  } catch {
    assert.fail(`stdout 不是可解析的 JSON: ${snippet(stdout)}`);
  }
}

/** 成功面断言：退出码 `0` + stderr 干净 + stdout 是单个 JSON 文档 ⇒ 返回该文档。 */
function readDoc(res, label) {
  assert.equal(res.code, 0, `${label}: 应退出 0（实际 ${res.code}）stderr=${snippet(res.stderr)} stdout=${snippet(res.stdout)}`);
  assert.equal(res.stderr, '', `${label}: stderr 应为空: ${snippet(res.stderr)}`);
  return jsonDoc(res.stdout);
}

/** 一次层 A 调用 + 成功面断言。 */
async function expectDoc(hub, argv, opts) {
  return readDoc(await hub(argv, opts), `hub ${argv.join(' ')}`);
}

/** 失败面断言：stderr 恰一行 JSON ⇒ 返回该错误对象。 */
function errorDoc(stderr, label) {
  const trimmed = stderr.replace(/\n+$/, '');
  const lines = trimmed.split('\n');
  assert.equal(lines.length, 1, `${label}: stderr 应恰一行 JSON: ${snippet(stderr)}`);
  try {
    return JSON.parse(lines[0]);
  } catch {
    assert.fail(`${label}: stderr 不是可解析 JSON: ${snippet(stderr)}`);
  }
}

/**
 * 「SDK 面 ↔ 直连 HTTP」逐层比对：递归键集合相等 + 稳定字段取值相等 + 易变键存在且同型。
 * 数组按序逐元素比对（同端点两次观察，元素序应一致）。
 */
function compareShape(endpoint, sdk, direct, at) {
  const label = `${endpoint} @ ${at}`;
  if (Array.isArray(sdk) || Array.isArray(direct)) {
    assert.ok(Array.isArray(sdk) && Array.isArray(direct), `${label}: 一侧非数组（SDK=${kindOf(sdk)} 直连=${kindOf(direct)}）`);
    assert.equal(sdk.length, direct.length, `${label}: 数组长度不一致（SDK=${sdk.length} 直连=${direct.length}）`);
    for (let i = 0; i < sdk.length; i += 1) compareShape(endpoint, sdk[i], direct[i], `${at}[${i}]`);
    return;
  }
  if (sdk !== null && typeof sdk === 'object') {
    assert.ok(direct !== null && typeof direct === 'object' && !Array.isArray(direct), `${label}: 一侧非对象（SDK=${kindOf(sdk)} 直连=${kindOf(direct)}）`);
    assert.deepEqual(Object.keys(sdk).sort(), Object.keys(direct).sort(), `${label}: 键集合不一致`);
    for (const key of Object.keys(sdk)) compareShape(endpoint, sdk[key], direct[key], `${at}.${key}`);
    return;
  }
  const leaf = at.slice(at.lastIndexOf('.') + 1).replace(/\[[0-9]+\]$/, '');
  if (VOLATILE_KEYS.has(leaf)) {
    assert.equal(typeof sdk, typeof direct, `${label}: 易变键类型不一致（SDK=${kindOf(sdk)} 直连=${kindOf(direct)}）`);
    return;
  }
  assert.deepEqual(sdk, direct, `${label}: 取值不一致（SDK=${JSON.stringify(sdk)} 直连=${JSON.stringify(direct)}）`);
}

/** NDJSON（F06 验收 2 / T-04）：逐行独立解析、行分隔、键集合恰 `['event','data']`、无半截行。 */
function parseNdjson(stdout, label) {
  assert.ok(stdout.length > 0, `${label}: stdout 应至少有一行 NDJSON（原文 ${snippet(stdout)}）`);
  assert.equal(stdout[0], '{', `${label}: 首行首字符应为 {（不是一整份 JSON 数组）: ${snippet(stdout)}`);
  assert.ok(stdout.endsWith('\n'), `${label}: 末行应是完整行（无半截行）: 尾部 ${snippet(stdout.slice(-120))}`);
  const frames = [];
  const lines = stdout.slice(0, -1).split('\n');
  for (const [index, line] of lines.entries()) {
    if (line === '') continue; // 尾部之外的意外空行：跳过（上面已保证无半截行）
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      assert.fail(`${label}: 第 ${index + 1} 行不可独立解析: ${snippet(line, 160)}（全文 ${snippet(stdout)}）`);
    }
    assert.deepEqual(Object.keys(frame).sort(), ['data', 'event'], `${label}: 第 ${index + 1} 行的键集合应恰为 ['event','data']: ${snippet(line, 160)}`);
    assert.equal(typeof frame.event, 'string', `${label}: 第 ${index + 1} 行的 event 应为字符串`);
    assert.ok(frame.data !== null && typeof frame.data === 'object', `${label}: 第 ${index + 1} 行的 data 应为对象`);
    frames.push(frame);
  }
  return frames;
}

/** 负向断言的有界观察窗（等待的是「不发生」，waitFor 不适用）。 */
const settleMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** 唯一标记：同一进程内的 fixture / 文案区分（零依赖，不引 node:crypto）。 */
let seq = 0;
function uniq(prefix) {
  seq += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${seq}`;
}

// ============================== 栈 fixture ==============================

/** 起 `oamp web start` 子进程（段内端口 + 临时 OAMP_DB）；等 WEB_READY，提前退出抛错并带 stderr。 */
async function startWeb(socketPath, port, envExtra = {}) {
  const child = spawn(process.execPath, [BIN, 'web', 'start', '--port', String(port)], {
    cwd: PKG_ROOT,
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
    port,
    stdout: () => out,
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

/** 层 A 调用的唯一出口：恒经 pr-004 的 runHub 起子进程，并注入本用例栈的 socket 与端口（禁走缺省链）。 */
function makeHub({ router, port }) {
  return (argv, { env = {}, input, timeoutMs } = {}) =>
    runHub(argv, { env: { OAMP_SOCKET: router.socketPath, OAMP_WEB_PORT: String(port), ...env }, input, timeoutMs });
}

/** 直连 HTTP 对照（测试进程自身 fetch）：返回 `{ status, text, body }`。 */
function makeDirect({ base }) {
  return async (method, endpoint, payload) => {
    const res = await fetch(`${base}${endpoint}`, {
      method,
      ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload ?? {}) }),
    });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* 非 JSON 面（静态 / SSE） */
    }
    return { status: res.status, text, body };
  };
}

/** 从 `hub api docs` 的运行侧登记现算集合（A8：`/api/docs` 是唯一的集合真源，不手抄路径清单当权威）。 */
async function routeSet(hub, selector) {
  const routes = (await expectDoc(hub, ['api', 'docs'])).routes;
  assert.ok(Array.isArray(routes), '`api docs` 的 routes 应为数组');
  return routes.filter(selector).map((route) => `${route.method} ${route.path}`);
}

/** 裸 SSE 客户端（fetch + reader 手工切帧，零依赖）：headers 到达即视为订阅已注册。 */
async function openSse(base, url) {
  const ac = new AbortController();
  const res = await fetch(`${base}${url}`, { signal: ac.signal });
  const frames = [];
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
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = null;
          let data = null;
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (event && data) {
            try {
              frames.push({ event, data: JSON.parse(data) });
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
  return { status: res.status, contentType: res.headers.get('content-type'), frames, close: () => ac.abort(), pump };
}

const detailAt = (direct, chatId) => direct('GET', `/api/chats/${encodeURIComponent(chatId)}`);

/** 等一次调用进终态（返回终态信封）。 */
async function waitTerminal({ direct }, callId, timeoutMs = 20000) {
  return waitFor(
    async () => {
      const r = await direct('GET', `/api/calls/${encodeURIComponent(callId)}`);
      if (r.status !== 200 || r.body === null) return null;
      return r.body.state === 'completed' || r.body.state === 'failed' ? r.body : null;
    },
    { timeoutMs, what: `call ${callId} 终态` },
  );
}

/** 栈 + fixture（真实 Router + 真实 agent `pb-dev` + web；可选预热项目 / 对话 / 一次已终态调用）。 */
async function setup(t, { warm = true } = {}) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const agent = await startAgent('pb-dev', {
    socketPath: router.socketPath,
    envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN, OAMP_OMP_MODEL: 'fake/model' },
  });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=pb-dev/);

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-api-db-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const port = await pickPort();
  const web = await startWeb(router.socketPath, port, {
    OAMP_DB: path.join(dbDir, 'sql.db'),
    OAMP_WEB_TOPOLOGY_POLL_MS: '200',
  });
  t.after(() => web.stop());

  const hub = makeHub({ router, port });
  const direct = makeDirect({ base: web.base });
  const fx = { router, agent, web, port, dbDir, hub, direct, projectId: null, chatId: null, callId: null };

  if (warm) {
    const project = await expectDoc(hub, ['api', 'projects', 'create', '--repo-url', `https://example.com/${uniq('sdk-api')}.git`]);
    fx.projectId = project.project.project_id;
    const sent = await expectDoc(hub, ['api', 'messages', 'send', '--project-id', fx.projectId, '--agent-id', 'pb-dev', '--text', `预热 ${uniq('warm')}`]);
    fx.chatId = sent.chat_id;
    await waitFor(
      async () => {
        const r = await detailAt(direct, fx.chatId);
        return r.body !== null && Array.isArray(r.body.messages) && r.body.messages.some((m) => m.direction === 'out') ? true : false;
      },
      { timeoutMs: 15000, what: '预热对话首轮落 out' },
    );
    const call = await expectDoc(hub, ['api', 'calls', 'create', '--chat-id', fx.chatId, '--agent', 'dev', '--task', `预热调用 ${uniq('warm-call')}`]);
    fx.callId = call.calls[0].call_id;
    await waitTerminal(fx, fx.callId); // 只读面（transcript / get）与归档范围都要求 fixture 已静止
  }
  return fx;
}

/** 按 §5.3 信封 1 的形状，从假节点向 web 投递一条 `notice`（体例同 confirmation-inbox.test.js）。 */
function sendNotice(node, body) {
  return node.send('web', {
    protocol: 'oamp/1',
    message_id: `ntc-${uniq('notice')}`,
    type: 'notice',
    payload: { content_type: 'application/json', body: JSON.stringify(body) },
  });
}

// ============================== 收口守门用的文件/仓库快照 ==============================

// 运行态目录名拼接构造（规避本文件自身静态扫描的误命中，体例同 hygiene.test.js 的凭据词构造）。
const REPO_STATE_DIRS = ['da' + 'ta', '.run' + 'time'].map((name) => ({ name, path: path.join(PKG_ROOT, name) }));

function dirSnapshot(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null;
}

// 基线 = 本测试文件开跑前的仓库运行态快照（收口用例在文件末尾复述比对）。
const REPO_STATE_BASELINE = new Map(REPO_STATE_DIRS.map((dir) => [dir.name, dirSnapshot(dir.path)]));

// ============================== T1：骨架 / fixture / 端口段冒烟 ==============================

test('T1 地基：栈可用 + `api docs` 经 hub-harness 的 runHub 起子进程（F06/F09 前置面、PR 验收 9/10）', async (t) => {
  const fx = await setup(t, { warm: false });
  assert.ok(fx.port >= PORT_MIN && fx.port <= PORT_MAX, `web 端口应落在本 PR 段内（实际 ${fx.port}）`);
  const res = await fx.hub(['api', 'docs']);
  const doc = readDoc(res, 'hub api docs');
  assert.ok(Array.isArray(doc.routes), '`api docs` 的 routes 应为数组');
  assert.ok(doc.routes.length >= 21, `运行侧登记应覆盖 21 条接口（实际 ${doc.routes.length}）`);
  // 层 A 的调用面结构：web 常驻发送方未注册时亦可读（本用例刻意不预热）
  const directDocs = await fx.direct('GET', '/api/docs');
  assert.equal(directDocs.status, 200, `直连 /api/docs 应 200: ${snippet(directDocs.text)}`);
});

// ============================== T2：只读端点逐条（9 条） ==============================

test('T2 只读端点逐条（9 条）：与运行侧集合双射 + 与直连 HTTP 一致（F02 验收 1/2）', async (t) => {
  const fx = await setup(t);

  // 只读面零写副作用（验收 5）：前后各取一次计数
  const beforeChats = (await expectDoc(fx.hub, ['api', 'chats', 'list', '--project-id', fx.projectId])).total;
  const beforeCalls = (await expectDoc(fx.hub, ['api', 'calls', 'list'])).calls.length;

  // 9 条只读入口（集合定义 = architecture §5.5 的「9 条非流式 GET」）：`path` 是运行侧登记形态（比对集合），
  //   `directPath` 是直连对照的实际路径（路径参数已替换）——本表只回答「要调哪些入口」，权威集合来自 `/api/docs`。
  const rows = [
    { argv: ['api', 'agents'], method: 'GET', path: '/api/agents', directPath: '/api/agents', arrayKey: 'agents' },
    {
      argv: ['api', 'chats', 'list', '--project-id', fx.projectId],
      method: 'GET',
      path: '/api/chats',
      directPath: `/api/chats?project_id=${encodeURIComponent(fx.projectId)}`,
      arrayKey: 'chats',
    },
    { argv: ['api', 'chats', 'get', fx.chatId], method: 'GET', path: '/api/chats/:chat_id', directPath: `/api/chats/${encodeURIComponent(fx.chatId)}`, arrayKey: 'messages' },
    { argv: ['api', 'docs'], method: 'GET', path: '/api/docs', directPath: '/api/docs', arrayKey: 'routes' },
    { argv: ['api', 'projects', 'list'], method: 'GET', path: '/api/projects', directPath: '/api/projects', arrayKey: 'projects' },
    { argv: ['api', 'calls', 'list'], method: 'GET', path: '/api/calls', directPath: '/api/calls', arrayKey: 'calls' },
    {
      argv: ['api', 'calls', 'transcript', fx.callId],
      method: 'GET',
      path: '/api/calls/:call_id/transcript',
      directPath: `/api/calls/${encodeURIComponent(fx.callId)}/transcript`,
      arrayKey: 'entries',
    },
    { argv: ['api', 'calls', 'get', fx.callId], method: 'GET', path: '/api/calls/:call_id', directPath: `/api/calls/${encodeURIComponent(fx.callId)}`, arrayKey: null },
    { argv: ['api', 'confirmations', 'list'], method: 'GET', path: '/api/confirmations', directPath: '/api/confirmations', arrayKey: 'confirmations' },
  ];

  for (const [index, row] of rows.entries()) {
    const n = index + 1;
    const label = `#${n} ${row.method} ${row.path}`;
    const res = await fx.hub(row.argv);
    const doc = readDoc(res, `hub ${row.argv.join(' ')}`);
    assert.ok(doc !== null && typeof doc === 'object' && !Array.isArray(doc), `${label}: stdout 应是 JSON 对象（单文档）`);
    if (row.arrayKey !== null) {
      assert.ok(Array.isArray(doc[row.arrayKey]), `${label}: ${row.arrayKey} 应为数组（实际 ${kindOf(doc[row.arrayKey])}）`);
    }
    const dr = await fx.direct('GET', row.directPath);
    assert.equal(dr.status, 200, `${label}: 直连应 200（实际 ${dr.status}）: ${snippet(dr.text)}`);
    compareShape(label, doc, dr.body, '$');
    // 对照清单机械产出（验收 6）：行与实测结果同源，不是手写常量
    t.diagnostic(`#${n}\t${row.method} ${row.path}\t↔\t${['hub', ...row.argv].join(' ')}\texit=${res.code}`);
  }

  // 集合双向核对（验收 2）：条数 9 ↔ 9 + 每行 ∈ 运行侧 + 行间两两不同 ⇒ 双射
  const runtime = await routeSet(fx.hub, (route) => route.method === 'GET' && route.kind === 'json');
  const declared = rows.map((row) => `${row.method} ${row.path}`);
  const missing = runtime.filter((sig) => !declared.includes(sig));
  const extra = declared.filter((sig) => !runtime.includes(sig));
  assert.deepEqual(missing, [], `运行侧只读集合有 fixture 未覆盖的缺项: ${missing.join(' | ')}`);
  assert.deepEqual(extra, [], `fixture 多出运行侧不存在的签名: ${extra.join(' | ')}`);
  assert.equal(new Set(declared).size, declared.length, 'fixture 行签名应两两不同');
  assert.equal(rows.length, runtime.length, `只读端点条数应为 9（fixture=${rows.length} 运行侧=${runtime.length}）`);

  // `api agents` 的无参与 `--state online` 各一次（验收 1）
  const allAgents = (await expectDoc(fx.hub, ['api', 'agents'])).agents;
  const onlineAgents = (await expectDoc(fx.hub, ['api', 'agents', '--state', 'online'])).agents;
  assert.ok(onlineAgents.length >= 1, '`--state online` 应至少含本用例的在线实例');
  assert.ok(onlineAgents.every((a) => a.state === 'online'), `--state online 应只含在线实例: ${JSON.stringify(onlineAgents)}`);
  assert.ok(onlineAgents.length <= allAgents.length, '在线子集不应大于无参全集');

  // 只读面零写副作用（验收 5）
  const afterChats = (await expectDoc(fx.hub, ['api', 'chats', 'list', '--project-id', fx.projectId])).total;
  const afterCalls = (await expectDoc(fx.hub, ['api', 'calls', 'list'])).calls.length;
  assert.equal(afterChats, beforeChats, `只读调用前后对话数应不变（前 ${beforeChats} / 后 ${afterChats}）`);
  assert.equal(afterCalls, beforeCalls, `只读调用前后调用行数应不变（前 ${beforeCalls} / 后 ${afterCalls}）`);
});

// ============================== T3：写端点各一例（8 条 POST） ==============================

test('T3 写端点各一例（8 条 POST）：字段集与 API.md §5 一致 + 效果可见（F02 验收 2/3）', async (t) => {
  const fx = await setup(t);
  const rows = [];
  const step = async (argv, method, seriesPath, keys) => {
    const res = await fx.hub(argv);
    const label = `hub ${argv.join(' ')}`;
    const doc = readDoc(res, label);
    assert.deepEqual(Object.keys(doc).sort(), [...keys].sort(), `${label}: 顶层键集合应与 API.md §5 示例一致`);
    rows.push({ argv, method, path: seriesPath, code: res.code });
    return doc;
  };

  // ① `api projects create --repo-url <唯一地址>` ⇒ {project}
  const project = await step(['api', 'projects', 'create', '--repo-url', `https://example.com/${uniq('w')}.git`], 'POST', '/api/projects', ['project']);
  assert.deepEqual(Object.keys(project.project).sort(), ['created_at', 'name', 'project_id', 'repo_url'], 'project 的字段集应与 §5.2 示例一致');
  const projectId = project.project.project_id;

  // ② `api messages send …`（新建对话）⇒ {chat_id, task_id, message_id, warning}
  const sent = await step(
    ['api', 'messages', 'send', '--project-id', projectId, '--agent-id', 'pb-dev', '--text', `写端点发消息 ${uniq('m')}`],
    'POST',
    '/api/messages',
    ['chat_id', 'task_id', 'message_id', 'warning'],
  );
  assert.equal(sent.warning, null, `派发应成功（warning 应为 null）: ${JSON.stringify(sent)}`);
  const chatId = sent.chat_id;

  // ③ `api calls create …`（缺省 background）⇒ {calls: [信封]}
  const created = await step(['api', 'calls', 'create', '--chat-id', chatId, '--agent', 'dev', '--task', `写端点调用 ${uniq('c')}`], 'POST', '/api/calls', ['calls']);
  assert.equal(created.calls.length, 1, '单项提交应恰返回一个信封');
  assert.deepEqual(Object.keys(created.calls[0]).sort(), [...ENVELOPE_KEYS].sort(), '调用信封应是封闭的 10 键');
  const callId = created.calls[0].call_id;
  await waitTerminal(fx, callId); // 归档范围 = 未归档且非进行中 ⇒ 归档前先让调用静止

  // ④ `api chats rename …` ⇒ {chat_id, title}
  const title = `写端点改名 ${uniq('t')}`;
  const renamed = await step(['api', 'chats', 'rename', chatId, '--title', title], 'POST', '/api/chats/:chat_id/rename', ['chat_id', 'title']);
  assert.equal(renamed.title, title, 'rename 应回显新标题');
  assert.equal((await expectDoc(fx.hub, ['api', 'chats', 'get', chatId])).chat.title, title, 'rename 后 `chats get` 的 title 应为新标题');

  // ⑤ `api chats close <chat_id>` ⇒ {chat_id, state}
  const closed = await step(['api', 'chats', 'close', chatId], 'POST', '/api/chats/:chat_id/close', ['chat_id', 'state']);
  assert.equal(closed.state, 'closed', '关闭后 state 应为 closed');
  assert.equal((await expectDoc(fx.hub, ['api', 'chats', 'get', chatId])).chat.state, 'closed', 'close 后 `chats get` 的 state 应为 closed');

  // ⑥ `api chats archive`（无参；服务端算范围）⇒ {archived, failed, failed_ids}
  const archived = await step(['api', 'chats', 'archive'], 'POST', '/api/chats/archive', ['archived', 'failed', 'failed_ids']);
  assert.ok(archived.archived >= 1, `归档应至少覆盖本用例的对话（实际 ${archived.archived}）`);
  assert.equal(archived.failed, 0, `归档失败数应为 0: ${JSON.stringify(archived.failed_ids)}`);
  const archivedList = await expectDoc(fx.hub, ['api', 'chats', 'list', '--project-id', projectId, '--archived', '1']);
  assert.ok(archivedList.total >= 1, `归档视图应至少含 1 条（实际 ${archivedList.total}）`);

  // ⑦ `api chats activate <已归档 chat_id>` ⇒ {chat_id, state}（需已归档；归档 → 激活是唯一重开路径）
  const activated = await step(['api', 'chats', 'activate', chatId], 'POST', '/api/chats/:chat_id/activate', ['chat_id', 'state']);
  assert.equal(activated.state, 'completed', '激活已关闭的归档对话应还原为 completed（API.md §3.6）');
  const afterActivate = await detailAt(fx.direct, chatId);
  assert.equal(afterActivate.body.chat.archived_at, null, '激活后归档标记应被移除');

  // ⑧ `api confirmations decide <id> --option-id allow_once` ⇒ {confirmation_id, accepted}
  //    在途项由假节点向 web 投递 `notice{kind:'confirmation_request'}` 建立（A9⑦）
  const node = await startFakeNode({ socketPath: fx.router.socketPath, instanceId: 'pb-pr007-cfm' });
  t.after(() => node.stop());
  const confirmationId = `cfm-${uniq('decide')}`;
  await sendNotice(node, {
    kind: 'confirmation_request',
    confirmation_id: confirmationId,
    chat_id: chatId,
    agent_id: 'pb-dev',
    tool: 'bash',
    title: `sdk-api 确认项 ${uniq('cfm')}`,
    options: [
      { option_id: 'allow_once', label: '允许一次' },
      { option_id: 'reject_once', label: '拒绝一次' },
    ],
    created_at: Date.now(),
  });
  await waitFor(
    async () => {
      const r = await fx.direct('GET', '/api/confirmations');
      return (r.body?.confirmations ?? []).some((item) => item.confirmation_id === confirmationId);
    },
    { timeoutMs: 8000, what: '确认项入在途表' },
  );
  const decided = await step(['api', 'confirmations', 'decide', confirmationId, '--option-id', 'allow_once'], 'POST', '/api/confirmations/:confirmation_id/decision', [
    'confirmation_id',
    'accepted',
  ]);
  assert.equal(decided.confirmation_id, confirmationId, '裁决应回显同一 confirmation_id');
  assert.equal(decided.accepted, true, '裁决应被受理');
  const listAfter = (await expectDoc(fx.hub, ['api', 'confirmations', 'list'])).confirmations;
  assert.ok(!listAfter.some((item) => item.confirmation_id === confirmationId), '裁决后该确认项应移出在途表');

  // 集合双向核对（验收 2）：8 行写 fixture 与运行侧 `{method === 'POST'}` 双向比对
  const runtime = await routeSet(fx.hub, (route) => route.method === 'POST');
  const declared = rows.map((row) => `${row.method} ${row.path}`);
  const missing = runtime.filter((sig) => !declared.includes(sig));
  const extra = declared.filter((sig) => !runtime.includes(sig));
  assert.deepEqual(missing, [], `运行侧写集合有 fixture 未覆盖的缺项: ${missing.join(' | ')}`);
  assert.deepEqual(extra, [], `fixture 多出运行侧不存在的签名: ${extra.join(' | ')}`);
  assert.equal(new Set(declared).size, declared.length, 'fixture 行签名应两两不同');
  assert.equal(rows.length, runtime.length, `写端点条数应为 8（fixture=${rows.length} 运行侧=${runtime.length}）`);
  for (const [index, row] of rows.entries()) {
    t.diagnostic(`#${index + 1}\t${row.method} ${row.path}\t↔\t${['hub', ...row.argv].join(' ')}\texit=${row.code}`);
  }
});

test('T3b truncated 原样透传：SDK 侧仍是标记为截断的那份结果，未做正文重建（F02 验收 2 / C-A）', async (t) => {
  const fx = await setup(t);
  // 既有可达路径（A10）：桩推 1001 片 ⇒ Router 任务表 1000 条封顶 ⇒ updatesTruncated
  const created = await expectDoc(fx.hub, ['api', 'calls', 'create', '--chat-id', fx.chatId, '--agent', 'dev', '--task', `超上限更新轮 ${uniq('cap')} #chunks=1001`]);
  const callId = created.calls[0].call_id;
  const envelope = await waitTerminal(fx, callId, 90000);
  assert.equal(envelope.truncated, true, `超上限调用的终态信封 truncated 应为 true: ${JSON.stringify(envelope)}`);
  assert.ok(['completed', 'failed'].includes(envelope.state), `终态 state 应 ∈ {completed, failed}（实际 ${envelope.state}）`);

  // ② `api calls get` 与单次直连同形同值（含 text 逐字相同 ⇒ 未做正文重建）
  const sdkGet = await expectDoc(fx.hub, ['api', 'calls', 'get', callId]);
  const directGet = await fx.direct('GET', `/api/calls/${encodeURIComponent(callId)}`);
  assert.equal(directGet.status, 200, `直连 calls get 应 200: ${snippet(directGet.text)}`);
  assert.deepEqual(Object.keys(sdkGet).sort(), [...ENVELOPE_KEYS].sort(), '信封应是封闭的 10 键');
  compareShape('api calls get (truncated)', sdkGet, directGet.body, '$');
  assert.equal(sdkGet.truncated, true, 'SDK 侧信封应同为 truncated');
  assert.equal(typeof sdkGet.text, 'string', `终态 text 应为字符串（实际 ${kindOf(sdkGet.text)}）`);
  assert.equal(sdkGet.text, directGet.body.text, 'SDK 的 text 应与单次直连逐字相同（重建正文会在此分叉）');

  // ③ `api calls transcript` 同样只是「那份被截断的记录」
  const sdkTranscript = await expectDoc(fx.hub, ['api', 'calls', 'transcript', callId]);
  const directTranscript = await fx.direct('GET', `/api/calls/${encodeURIComponent(callId)}/transcript`);
  assert.equal(sdkTranscript.truncated, true, 'SDK 侧转录的 truncated 应为 true');
  // 上限 = 既有 1000 条过程记录封顶 + 终态时 web 追加的那 1 条终态条目（web.js 的 entries.push）
  assert.ok(
    sdkTranscript.entries.length <= 1001,
    `转录条目数应受既有上限约束（实际 ${sdkTranscript.entries.length}）`,
  );
  assert.equal(sdkTranscript.entries.length, directTranscript.body.entries.length, 'SDK 与直连的条目数应一致（未追加第二次请求）');
  compareShape('api calls transcript (truncated)', sdkTranscript, directTranscript.body, '$');
  t.diagnostic(`truncated\tstate=${envelope.state}\tentries=${sdkTranscript.entries.length}\ttext_len=${sdkGet.text.length}`);
});

// ============================== T4：4 条 SSE 起流即得帧 + NDJSON ==============================

test('T4-1 `api stream chat <chat_id>`：起流即得帧 + NDJSON 逐行可解析 + 与直连 SSE 同形（F02 验收 4/5、F06）', async (t) => {
  const fx = await setup(t);
  const sse = await openSse(fx.web.base, `/api/stream?chat_id=${encodeURIComponent(fx.chatId)}`);
  t.after(() => sse.close());
  const pending = fx.hub(['api', 'stream', 'chat', fx.chatId], { timeoutMs: 6000 });
  await settleMs(500); // SSE 无缓存、不补发 ⇒ 触发必须发生在订阅建立之后
  for (let i = 0; i < 3; i += 1) {
    const sent = await expectDoc(fx.hub, ['api', 'messages', 'send', '--chat-id', fx.chatId, '--project-id', fx.projectId, '--agent-id', 'pb-dev', '--text', `订阅触发 ${i} ${uniq('sse')}`]);
    assert.equal(sent.warning, null, `订阅触发消息应派发成功: ${JSON.stringify(sent)}`);
    await settleMs(300);
  }
  const res = await pending;
  assert.equal(res.code, null, `订阅进程应到限被整组收口（实际 exit=${res.code}）: stderr=${snippet(res.stderr)} stdout=${snippet(res.stdout)}`);
  assert.equal(res.stderr, '', `订阅不应写 stderr（不出现用法错误 / 未实现）: ${snippet(res.stderr)}`);
  const frames = parseNdjson(res.stdout, 'api stream chat');
  assert.ok(frames.length >= 1, `起流后应至少收到 1 帧: ${snippet(res.stdout)}`);
  for (const frame of frames) {
    assert.ok(CHAT_EVENTS.includes(frame.event), `chat 作用域事件名应在文档白名单内（实际 ${frame.event}）: ${snippet(res.stdout)}`);
  }
  t.diagnostic(`stream chat\tframes=${frames.length}\tevents=${[...new Set(frames.map((f) => f.event))].join(',')}`);
  // 流的内容不加工（F06 边界 / C-1）：SDK 侧帧形态应能在直连 SSE 的同名帧里逐一找到
  const signature = (list) => new Set(list.map((frame) => `${frame.event}|${Object.keys(frame.data).sort().join(',')}`));
  const directSignatures = signature(sse.frames);
  for (const sig of signature(frames)) {
    assert.ok(directSignatures.has(sig), `SDK 帧形态应能在直连 SSE 侧找到同名同形帧（不聚合、不改字段）: ${sig}（SDK 原文 ${snippet(res.stdout)}）`);
  }
});

test('T4-2 `api stream events`：全局作用域起流即得帧（F02 验收 4）', async (t) => {
  const fx = await setup(t);
  const pending = fx.hub(['api', 'stream', 'events'], { timeoutMs: 6000 });
  await settleMs(500);
  for (let i = 0; i < 3; i += 1) {
    const node = await startFakeNode({ socketPath: fx.router.socketPath, instanceId: 'pb-pr007-stream' });
    await settleMs(400); // 拓扑轮询 200ms ⇒ 每个等待窗至少两次采样
    await node.stop();
    await settleMs(400);
  }
  const res = await pending;
  assert.equal(res.code, null, `订阅进程应到限被整组收口（实际 exit=${res.code}）: stderr=${snippet(res.stderr)} stdout=${snippet(res.stdout)}`);
  assert.equal(res.stderr, '', `订阅不应写 stderr: ${snippet(res.stderr)}`);
  const frames = parseNdjson(res.stdout, 'api stream events');
  assert.ok(frames.length >= 1, `起流后应至少收到 1 帧: ${snippet(res.stdout)}`);
  t.diagnostic(`stream events\tframes=${frames.length}\tevents=${[...new Set(frames.map((f) => f.event))].join(',')}`);
  for (const frame of frames) {
    assert.ok(GLOBAL_EVENTS.includes(frame.event), `全局作用域事件名应在文档白名单内（实际 ${frame.event}）: ${snippet(res.stdout)}`);
  }
});

test('T4-3 `api stream calls --chat-id <id>`：调用面（对话作用域）起流即得帧（F02 验收 4）', async (t) => {
  const fx = await setup(t);
  const pending = fx.hub(['api', 'stream', 'calls', '--chat-id', fx.chatId], { timeoutMs: 6000 });
  await settleMs(500);
  const created = await expectDoc(fx.hub, ['api', 'calls', 'create', '--chat-id', fx.chatId, '--agent', 'dev', '--task', `订阅调用 ${uniq('calls')} #sleep=1500`]);
  assert.equal(created.calls.length, 1, '触发应恰受理一次调用');
  const res = await pending;
  assert.equal(res.code, null, `订阅进程应到限被整组收口（实际 exit=${res.code}）: stderr=${snippet(res.stderr)} stdout=${snippet(res.stdout)}`);
  assert.equal(res.stderr, '', `订阅不应写 stderr: ${snippet(res.stderr)}`);
  const frames = parseNdjson(res.stdout, 'api stream calls');
  assert.ok(frames.length >= 1, `起流后应至少收到 1 帧: ${snippet(res.stdout)}`);
  t.diagnostic(`stream calls\tframes=${frames.length}\tevents=${[...new Set(frames.map((f) => f.event))].join(',')}`);
  for (const frame of frames) {
    assert.ok(CALL_EVENTS.includes(frame.event), `调用面事件名应在文档白名单内（实际 ${frame.event}）: ${snippet(res.stdout)}`);
  }
});

test('T4-4 `api stream call <call_id>`：单次调用作用域起流即得帧（F02 验收 4）', async (t) => {
  const fx = await setup(t);
  // 该入口要求调用**已存在**（A11）；先受理（#sleep 拉长在飞窗口），再订阅，再等它推进到终态
  const created = await expectDoc(fx.hub, ['api', 'calls', 'create', '--chat-id', fx.chatId, '--agent', 'dev', '--task', `单调用订阅 ${uniq('call')} #sleep=2000`]);
  const callId = created.calls[0].call_id;
  const pending = fx.hub(['api', 'stream', 'call', callId], { timeoutMs: 6000 });
  await waitTerminal(fx, callId, 20000);
  const res = await pending;
  assert.equal(res.code, null, `订阅进程应到限被整组收口（实际 exit=${res.code}）: stderr=${snippet(res.stderr)} stdout=${snippet(res.stdout)}`);
  assert.equal(res.stderr, '', `订阅不应写 stderr: ${snippet(res.stderr)}`);
  const frames = parseNdjson(res.stdout, 'api stream call');
  assert.ok(frames.length >= 1, `起流后应至少收到 1 帧: ${snippet(res.stdout)}`);
  t.diagnostic(`stream call <call_id>\tframes=${frames.length}\tevents=${[...new Set(frames.map((f) => f.event))].join(',')}`);
  for (const frame of frames) {
    assert.ok(CALL_EVENTS.includes(frame.event), `调用面事件名应在文档白名单内（实际 ${frame.event}）: ${snippet(res.stdout)}`);
    assert.equal(frame.data.call_id, callId, `单次调用作用域的帧应属该 call_id: ${snippet(res.stdout)}`);
  }
});

test('T4-5 SSE 集合核对：运行侧 `kind === "sse"` 与四条订阅用例 fixture 4↔4（F02 验收 2/4、F06）', async (t) => {
  // 与 T2（`kind === 'json'`）/ T3（写端点）同形的双向核对：运行侧**现算**（`api docs` 的 routes）↔ 逐字 fixture。
  // fixture 逐字给出、不从运行侧反推（否则断言自我满足）：四条订阅入口与 T4-1~T4-4 四条用例一一对位。
  const fx = await setup(t, { warm: false });
  const rows = [
    { no: 1, cmd: 'hub api stream chat <chat_id>', sig: 'GET /api/stream' },
    { no: 2, cmd: 'hub api stream events', sig: 'GET /api/events' },
    { no: 3, cmd: 'hub api stream calls --chat-id <id>', sig: 'GET /api/calls/stream' },
    { no: 4, cmd: 'hub api stream call <call_id>', sig: 'GET /api/calls/:call_id/stream' },
  ];
  const runtime = await routeSet(fx.hub, (route) => route.method === 'GET' && route.kind === 'sse');
  const declared = rows.map((row) => row.sig);
  const missing = runtime.filter((sig) => !declared.includes(sig));
  const extra = declared.filter((sig) => !runtime.includes(sig));
  assert.deepEqual(missing, [], `运行侧订阅集合有 fixture 未覆盖的缺项: ${missing.join(' | ')}`);
  assert.deepEqual(extra, [], `fixture 多出运行侧不存在的签名: ${extra.join(' | ')}`);
  assert.equal(new Set(declared).size, declared.length, 'fixture 行签名应两两不同');
  assert.equal(declared.length, runtime.length, `订阅端点条数应为 4（fixture=${declared.length} 运行侧=${runtime.length}）`);
  assert.equal(runtime.length, 4, `运行侧 SSE 端点应为 4 条（实际 ${runtime.length}: ${runtime.join(' | ')}）`);
  for (const row of rows) {
    t.diagnostic(`T4-${row.no}\t${row.cmd}\t↔\t${row.sig}`);
  }
});

// ============================== T5：错误面 + --human 两态 ==============================

test('T5 服务端错误可见：上游 code 原样 / 退出码 1 / stdout 干净 + 用法错误 2 可区分（F02 验收 3、F05 验收 4）', async (t) => {
  const fx = await setup(t);

  // ① 未知对话（上游 404 NOT_FOUND）
  const missingChatId = `chat-${uniq('nope')}`;
  const res1 = await fx.hub(['api', 'chats', 'get', missingChatId]);
  assert.equal(res1.code, 1, `上游 404 应落业务失败 1（实际 ${res1.code}）: stderr=${snippet(res1.stderr)}`);
  assert.equal(res1.stdout.trim(), '', `失败路径的 stdout 应无残片: ${snippet(res1.stdout)}`);
  const err1 = errorDoc(res1.stderr, 'api chats get 未知对话');
  assert.deepEqual(Object.keys(err1).sort(), ['code', 'error', 'exit_code', 'http_status'], '层 A 的 stderr 错误对象应恰为 {code, error, exit_code, http_status}');
  const up1 = await fx.direct('GET', `/api/chats/${encodeURIComponent(missingChatId)}`);
  assert.equal(up1.status, 404, `直连上游应 404（实际 ${up1.status}）: ${snippet(up1.text)}`);
  assert.equal(err1.code, up1.body.code, `code 应与上游原文逐字相同（SDK=${err1.code} 上游=${up1.body.code}）`);
  assert.equal(err1.error, up1.body.error, `error 文本应与上游原文逐字相同（SDK=${err1.error} 上游=${up1.body.error}）`);
  assert.equal(err1.http_status, up1.status, 'http_status 应是上游 HTTP 状态码');
  assert.equal(err1.exit_code, 1, 'stderr 的 exit_code 应为 1');

  // ② 未知对话归属的调用（上游 400 INVALID_PARAM）
  const task = `错误面调用 ${uniq('badcall')}`;
  const res2 = await fx.hub(['api', 'calls', 'create', '--chat-id', missingChatId, '--agent', 'dev', '--task', task]);
  assert.equal(res2.code, 1, `上游 400 应落业务失败 1（实际 ${res2.code}）: stderr=${snippet(res2.stderr)}`);
  assert.equal(res2.stdout.trim(), '', `失败路径的 stdout 应无残片: ${snippet(res2.stdout)}`);
  const err2 = errorDoc(res2.stderr, 'api calls create 未知对话');
  assert.deepEqual(Object.keys(err2).sort(), ['code', 'error', 'exit_code', 'http_status'], '层 A 的 stderr 错误对象应恰为 {code, error, exit_code, http_status}');
  const up2 = await fx.direct('POST', '/api/calls', { chat_id: missingChatId, agent: 'dev', task });
  assert.equal(up2.status, 400, `直连上游应 400（实际 ${up2.status}）: ${snippet(up2.text)}`);
  assert.equal(err2.code, up2.body.code, `code 应与上游原文逐字相同（SDK=${err2.code} 上游=${up2.body.code}）`);
  assert.equal(err2.error, up2.body.error, `error 文本应与上游原文逐字相同（SDK=${err2.error} 上游=${up2.body.error}）`);
  assert.equal(err2.http_status, up2.status, 'http_status 应是上游 HTTP 状态码');
  assert.equal(err2.exit_code, 1, 'stderr 的 exit_code 应为 1');

  // ③ 本地用法错误 ⇒ 2（本地校验先于任何连接；与业务失败 1 可区分）
  const res3 = await fx.hub(['api', 'chats', 'get']);
  assert.equal(res3.code, 2, `缺位置参数应落用法错误 2（实际 ${res3.code}）: stderr=${snippet(res3.stderr)}`);
  assert.equal(res3.stdout.trim(), '', `用法错误的 stdout 应无残片: ${snippet(res3.stdout)}`);
  const err3 = errorDoc(res3.stderr, 'api chats get 缺参');
  assert.equal(err3.exit_code, 2, 'stderr 的 exit_code 应为 2（与业务失败 1 不同）');
  assert.equal(typeof err3.code, 'string', 'stderr 应带错误标识');
  assert.equal(typeof err3.error, 'string', 'stderr 应带人类可读文案');
});

test('T5b --human 两态：形态明显不同且承载的事实逐项一致（F05 验收 2/3）', async (t) => {
  const fx = await setup(t);
  const cases = [
    { argv: ['api', 'agents'], key: 'agents', name: 'instance_id', withState: true },
    { argv: ['api', 'projects', 'list'], key: 'projects', name: 'project_id', withState: false },
  ];
  for (const item of cases) {
    const label = `hub ${item.argv.join(' ')}`;
    const jsonRes = await fx.hub(item.argv);
    const doc = readDoc(jsonRes, label);
    const rows = doc[item.key];
    assert.ok(Array.isArray(rows), `${label}: ${item.key} 应为数组`);

    const humanRes = await fx.hub([...item.argv, '--human']);
    assert.equal(humanRes.code, 0, `${label} --human: 应退出 0（实际 ${humanRes.code}）stderr=${snippet(humanRes.stderr)}`);
    assert.equal(humanRes.stderr, '', `${label} --human: stderr 应为空`);
    let parsed = true;
    try {
      JSON.parse(humanRes.stdout);
    } catch {
      parsed = false;
    }
    assert.equal(parsed, false, `${label} --human: 文本形态不应整份可解析为 JSON: ${snippet(humanRes.stdout)}`);

    // 事实一致（验收 5）：行数 / 标识 / 状态
    const humanLines = humanRes.stdout.replace(/\n+$/, '').split('\n');
    assert.equal(humanLines.length - 1, rows.length, `${label} --human: 表体数据行数应等于 JSON 数组长度（human=${humanLines.length - 1} json=${rows.length}）`);
    for (const row of rows) {
      assert.ok(humanRes.stdout.includes(row[item.name]), `${label} --human: 应含 ${item.name}=${row[item.name]}`);
      if (item.withState) {
        assert.ok(humanRes.stdout.includes(row.state), `${label} --human: 应含 state=${row.state}`);
      }
    }
    if (item.key === 'projects') {
      for (const row of rows) {
        assert.ok(humanRes.stdout.includes(row.name), `${label} --human: 应含项目名 ${row.name}`);
      }
    }
  }
});

// ============================== T6：跨进程无状态 ==============================

test('T6 跨进程无状态：并发互不影响 + 新进程续查 + 零本地状态载体（F09 验收 1~4）', async (t) => {
  const fx = await setup(t);
  const before = REPO_STATE_DIRS.map((dir) => ({ name: dir.name, snapshot: dirSnapshot(dir.path) }));
  const signatures = (doc) => doc.routes.map((route) => `${route.method} ${route.path}`).sort();

  // ① 同一命令并发执行互不影响（MI-03(b)）
  const solo = signatures(await expectDoc(fx.hub, ['api', 'docs']));
  const [a, b] = await Promise.all([fx.hub(['api', 'docs']), fx.hub(['api', 'docs'])]);
  const docA = readDoc(a, '并发 api docs #1');
  const docB = readDoc(b, '并发 api docs #2');
  assert.deepEqual(signatures(docA), solo, '并发第 1 份的 routes 签名应与非并发单跑逐字相同');
  assert.deepEqual(signatures(docB), solo, '并发第 2 份的 routes 签名应与非并发单跑逐字相同');

  // ② 互不相干的新进程可直接续查（MI-03(a)）
  const sent = await expectDoc(fx.hub, ['api', 'messages', 'send', '--project-id', fx.projectId, '--agent-id', 'pb-dev', '--text', `续查 ${uniq('s')}`]);
  const chatDoc = await expectDoc(fx.hub, ['api', 'chats', 'get', sent.chat_id]); // 新进程（不携带上一条调用任何上下文）
  assert.equal(chatDoc.chat.chat_id, sent.chat_id, '新进程应能按标识直接取到同一对话');
  assert.ok(chatDoc.messages.length >= 1, `新进程应能读到该对话的消息（实际 ${chatDoc.messages.length}）`);

  const callCreated = await expectDoc(fx.hub, ['api', 'calls', 'create', '--chat-id', sent.chat_id, '--agent', 'dev', '--task', `续查调用 ${uniq('s2')}`, '--mode', 'background']);
  const callId = callCreated.calls[0].call_id;
  const envelope = await expectDoc(fx.hub, ['api', 'calls', 'get', callId]); // 又一个新进程
  assert.equal(envelope.call_id, callId, '新进程应能按 call_id 直接取到同一调用');
  assert.deepEqual(Object.keys(envelope).sort(), [...ENVELOPE_KEYS].sort(), '信封应是封闭的 10 键');
  assert.ok(['submitted', 'working', 'completed', 'failed'].includes(envelope.state), `state 应 ∈ 状态词表（实际 ${envelope.state}）`);

  // ③ 无跨调用本地记忆：连跑两次一致；中间插入一次写操作，第二次只反映服务端真实状态
  const readA = await expectDoc(fx.hub, ['api', 'chats', 'get', sent.chat_id]);
  const readB = await expectDoc(fx.hub, ['api', 'chats', 'get', sent.chat_id]);
  compareShape('连跑两次 chats get', readA, readB, '$');
  const newTitle = `续查改名 ${uniq('t')}`;
  await expectDoc(fx.hub, ['api', 'chats', 'rename', sent.chat_id, '--title', newTitle]);
  const readC = await expectDoc(fx.hub, ['api', 'chats', 'get', sent.chat_id]);
  assert.equal(readC.chat.title, newTitle, '第二次读应反映服务端真实状态（不被本地快照影响）');

  // ④ 不产生可复用的本地状态载体（§10 测试基建约束）：仓库运行态目录逐项不变
  for (const dir of REPO_STATE_DIRS) {
    const baseline = before.find((item) => item.name === dir.name).snapshot;
    assert.deepEqual(dirSnapshot(dir.path), baseline, `用例期间仓库运行态目录不应变化: ${dir.name}`);
  }
});

// ============================== T7：收口守门 ==============================

test('T7-1 端口段守门：本文件只出现段界字面量 + 层 A 调用恒经单一 hub 包装（A16/A20）', () => {
  const source = fs.readFileSync(SELF, 'utf8');
  const hits = [...new Set(source.match(/\b5[0-9]{4}\b/g) ?? [])].sort();
  assert.deepEqual(hits, [String(PORT_MIN), String(PORT_MAX)], '本文件出现的 5xxxx 字面量应恰为段的两个界值');
  assert.ok(PORT_MIN < PORT_MAX, '段界应满足 PORT_MIN < PORT_MAX');
  // 与 pr-008 / pr-009 / pr-010 的段（PORT_MAX 之后每段一千宽）零交集
  assert.equal(PORT_MAX, PORT_MIN + 999, '本段宽度应为一千');
  assert.ok(!source.includes('77' + '88'), '本文件不得出现缺省端口字面量（禁走缺省链，A20）');
  assert.equal(
    (source.match(/runHub\(argv, \{ env: \{ OAMP_SOCKET/g) ?? []).length,
    1,
    '层 A 调用应恰经一处 hub 薄包装调 runHub（无第二套子进程辅助）',
  );
  assert.ok(source.includes('OAMP_WEB_PORT: String(port)'), 'hub 薄包装应恒注入段内端口（每一处调用都带端口）');
});

test('T7-2 零仓库内运行态写入：文件内零运行态目录字面量 + 仓库快照与文件开跑前一致（§10 测试基建约束）', () => {
  const source = fs.readFileSync(SELF, 'utf8');
  for (const dir of REPO_STATE_DIRS) {
    assert.ok(!source.includes(`${dir.name}/`), `本文件不得出现运行态目录字面量: ${dir.name}/`);
    assert.deepEqual(dirSnapshot(dir.path), REPO_STATE_BASELINE.get(dir.name), `本文件跑完后仓库运行态目录应与开跑前逐项相同: ${dir.name}`);
  }
  // 临时状态一律落在系统临时目录（OAMP_DB / socket / 桩目录）
  assert.ok(source.includes('os.tmpdir()'), '临时状态应落在 os.tmpdir()');
});
