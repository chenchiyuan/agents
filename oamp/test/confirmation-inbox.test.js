// test/confirmation-inbox.test.js — 0021 pr-003：确认面（在途表 / 两条新路由 / 信封消费 / 全局帧 / 静态面登记）
// 载体：① 进程内直调 `src/inbox.js`（5 函数行为）与 `src/web.js` 的登记面（表项 / 投影 / 匹配器，纯构造不依赖）；
//       ② harness 真实 Router + `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）+ 脚本级假节点（收发 notice 信封）。
// 覆盖：pr-003 验收 1~8、11 与任务图 T1~T4、T6 的判据。**M4 答复链路（pr-001 的成果）不在本 PR 范围内**，
//       本文件不触碰真实 omp：确认请求由假节点按 §5.3 信封 1 直接投递到 web。
// 不依赖真实 omp / 真实 LLM / 外网；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。

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
import { createApiRoutes, matchRoute, projectRoutes, ROUTE_META_FIELDS } from '../src/web.js';
import * as inbox from '../src/inbox.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会把它判 offline
// → Router 对投递只记录不投递。本文件统一放长租约（与 web.test.js / api-routes.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function pickPort() {
  return 47000 + Math.floor(Math.random() * 2000);
}

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
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

/** 起真实 Router + web（含临时 OAMP_DB），并建一个项目（对话必归属项目）；返回值透传 projectId。 */
async function setup(t) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-cfm-db-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const web = await startWeb(router.socketPath, pickPort(), {
    OAMP_DB: path.join(dbDir, 'sql.db'),
    OAMP_WEB_TOPOLOGY_POLL_MS: '200',
  });
  t.after(() => web.stop());
  const project = await jreq(web.base, 'POST', '/api/projects', json({ repo_url: 'https://example.com/oamp-cfm-fixture.git' }));
  assert.equal(project.status, 200, `项目 fixture 应建成：${project.text}`);
  return { router, web, projectId: project.body.project.project_id };
}

/** 裸请求：返回 status / content-type / 原文 / 可解析 JSON 体。 */
async function jreq(base, method, p, init = {}) {
  const res = await fetch(`${base}${p}`, { method, ...init });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 静态面 / SSE：非 JSON */
  }
  return { status: res.status, ct: res.headers.get('content-type'), text, body };
}

const json = (payload) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

/** SSE 订阅客户端（fetch + reader 手工解析，零依赖）。 */
function openSse(base, url) {
  const ac = new AbortController();
  const events = [];
  const ready = fetch(`${base}${url}`, { signal: ac.signal });
  const pump = (async () => {
    const res = await ready;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
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
  return { events, close: () => ac.abort(), pump };
}

const openGlobal = (base) => openSse(base, '/api/events');
const openChat = (base, chatId) => openSse(base, `/api/stream?chat_id=${encodeURIComponent(chatId)}`);

/** 按 §5.3 信封 1 / 信封 3 的形状，从假节点向 web 投递一条 `notice`。 */
function sendNotice(node, body) {
  return node.send('web', {
    protocol: 'oamp/1',
    message_id: `ntc-${randomUUID()}`,
    type: 'notice',
    payload: { content_type: 'application/json', body: JSON.stringify(body) },
  });
}

/** 假 agent 节点：收到 task.request 即回一条 task.result（state=completed）——用于「对话终态」的可观测面。 */
async function startEchoAgent(router, instanceId) {
  let node = null;
  node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId,
    onDeliver: async (msg) => {
      if (msg.type !== 'task.request') return;
      const body = JSON.parse(msg.payload.body);
      await node.send('web', {
        protocol: 'oamp/1',
        message_id: `tsk-${randomUUID()}`,
        task_id: msg.task_id,
        type: 'task.result',
        payload: { content_type: 'application/json', body: JSON.stringify({ state: 'completed', text: `ok:${body.prompt}` }) },
      });
    },
  });
  return node;
}

const parseBody = (msg) => JSON.parse(msg.payload.body);
const detailOf = async (web, chatId) => (await jreq(web.base, 'GET', `/api/chats/${encodeURIComponent(chatId)}`)).body;
const listOf = async (web) => (await jreq(web.base, 'GET', '/api/confirmations')).body;

const ENVELOPE = (over = {}) => ({
  kind: 'confirmation_request',
  confirmation_id: 'cfm-1',
  chat_id: 'chat-cfm-1',
  agent_id: 'pb-dev',
  tool: 'bash',
  title: 'echo L1-2-PROBE',
  options: [
    { option_id: 'allow_once', label: '允许一次' },
    { option_id: 'allow_always', label: '总是允许' },
    { option_id: 'reject_once', label: '拒绝一次' },
    { option_id: 'reject_always', label: '总是拒绝' },
  ],
  created_at: 1757750400000,
  ...over,
});

/** 信封 1 的 7 个字段（重建面元素与全局帧 data 共用的形状）。 */
const entryOf = (env) => ({
  confirmation_id: env.confirmation_id,
  chat_id: env.chat_id,
  agent_id: env.agent_id,
  tool: env.tool,
  title: env.title,
  options: env.options,
  created_at: env.created_at,
});

// ────────────────────────── T1：inbox 5 函数（进程内） ──────────────────────────

test('T1：inbox 5 函数——幂等登记 / 原子取出即删 / 移除无副作用 / 计数一致 / 导出面封闭', () => {
  // 导出面恰好 5 个函数：无 history / export / decided 类入口（「无历史台账」由结构保证）
  assert.deepEqual(Object.keys(inbox).sort(), ['add', 'list', 'remove', 'size', 'take']);

  const first = { confirmation_id: 'cfm-a', chat_id: 'chat-1', agent_id: 'pb-dev', tool: 'bash', title: 'echo A', options: [{ option_id: 'allow_once' }], created_at: 1 };
  const second = { ...first, confirmation_id: 'cfm-b', created_at: 2 };

  assert.equal(inbox.add(first), true, '首次登记返回 true');
  assert.equal(inbox.add({ ...first, title: '覆盖尝试' }), false, '同一 id 重复登记返回 false（幂等丢弃）');
  assert.equal(inbox.add(second), true);
  assert.equal(inbox.add({}), false, '无 confirmation_id 的登记被拒（不入表）');
  assert.equal(inbox.add(null), false);
  assert.equal(inbox.size(), 2);
  assert.deepEqual(inbox.list().map((e) => e.confirmation_id), ['cfm-a', 'cfm-b'], 'list() 顺序 = 登记顺序');
  assert.equal(inbox.list()[0].title, 'echo A', '重复登记不覆盖首条');

  assert.deepEqual(inbox.take('cfm-a'), first, 'take() 返回该条');
  assert.deepEqual(inbox.list().map((e) => e.confirmation_id), ['cfm-b'], 'take() 使其从 list() 消失');
  assert.equal(inbox.take('cfm-a'), null, '同一 id 再次 take → null（R-2 回 404 的判据来源）');
  assert.equal(inbox.list().length, inbox.size(), 'size() 与 list().length 恒一致');

  inbox.remove('cfm-b');
  assert.equal(inbox.size(), 0, 'remove() 使该条消失');
  assert.equal(inbox.remove('cfm-not-there'), undefined, '对不存在的 id 无副作用、不抛错');
  assert.equal(inbox.size(), 0);
});

// ────────────────────────── T2：登记形态（进程内，纯构造） ──────────────────────────

test('T2：两条新表项追加末位 + 8 元数据字段 + danger 派生 + 不被贪婪参数吞并', () => {
  const routes = createApiRoutes({});
  assert.deepEqual(
    routes.slice(-2).map((r) => `${r.method} ${r.path}`),
    ['GET /api/confirmations', 'POST /api/confirmations/:confirmation_id/decision'],
    '两条新表项追加在路由表末位',
  );
  for (const route of routes.slice(-2)) {
    for (const field of ROUTE_META_FIELDS) assert.ok(field in route, `元数据缺项：${route.path} ${field}`);
    assert.equal(typeof route.handler, 'function');
  }
  assert.deepEqual(projectRoutes(routes.slice(-2)).map((r) => r.danger), [false, true], 'danger 由 method 派生');

  // 可达性：`GET /api/confirmations` 不被 `GET /api/chats/:chat_id` 这类贪婪参数吞并；后缀参数形态正确切分
  assert.equal(matchRoute(routes, 'GET', '/api/confirmations').route.path, '/api/confirmations');
  assert.deepEqual(matchRoute(routes, 'POST', '/api/confirmations/cfm-9/decision').params, { confirmation_id: 'cfm-9' });
  assert.equal(matchRoute(routes, 'POST', '/api/confirmations/cfm-9/decision').route.path, '/api/confirmations/:confirmation_id/decision');
  assert.equal(matchRoute(routes, 'GET', '/api/confirmations/cfm-9/decision'), null, '裁决路由只认 POST');
});

// ────────────────────────── T2 / T3：投递、重建、幂等、取消（HTTP + 进程级） ──────────────────────────

test('T3：confirmation_request → 入表 + 全局恰一帧（同形状）+ 重复投递不重发 + 重建零帧 + 取消零帧 + 无定向帧', async (t) => {
  const { router, web, projectId } = await setup(t);
  const node = await startFakeNode({ socketPath: router.socketPath, instanceId: 'pb-dev' });
  t.after(() => node.stop());
  // web 以 'web' 身份**懒注册**（首个发送才握手）：先触发一次发送，Router 才有本用例的投递目标
  const warm = await jreq(web.base, 'POST', '/api/messages', json({ project_id: projectId, agent_id: 'ghost-warm', text: '预热发送方注册' }));
  assert.equal(warm.status, 200, `预热发送应返回 200（warning 允许非空）：${warm.text}`);
  const global = await openGlobal(web.base);
  t.after(() => global.close());
  const chat = await openChat(web.base, 'chat-cfm-1');
  t.after(() => chat.close());

  // 空态：200 + [] + 不 404（纯内存读，不查 Router、不读库）
  const empty = await jreq(web.base, 'GET', '/api/confirmations');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { confirmations: [] });

  const env = ENVELOPE();
  await sendNotice(node, env);
  await waitFor(() => global.events.some((e) => e.type === 'confirmation'), { timeoutMs: 5000, what: '全局 confirmation 帧' });

  // ① 出现在 GET /api/confirmations；② 全局恰一帧且 data 与列表元素同形状
  assert.deepEqual(await listOf(web), { confirmations: [entryOf(env)] });
  const frames = global.events.filter((e) => e.type === 'confirmation');
  assert.equal(frames.length, 1, '首次入表恰一帧');
  assert.deepEqual(frames[0].data, entryOf(env), '全局帧 data 与列表元素同形状（7 字段）');
  assert.deepEqual(Object.keys(frames[0].data).sort(), ['agent_id', 'chat_id', 'confirmation_id', 'created_at', 'options', 'title', 'tool']);

  // ③ 幂等：重复投递同一 confirmation_id → 不再入表、不再发帧
  await sendNotice(node, env);
  await sendNotice(node, { ...env, title: '覆盖尝试' });
  await delay(300);
  assert.equal(global.events.filter((e) => e.type === 'confirmation').length, 1, '重复投递不再发帧');
  assert.deepEqual((await listOf(web)).confirmations, [entryOf(env)], '重复投递不覆盖首条');

  // 重建面不发任何帧（刷新 / 重连重建不重复通知）
  const before = global.events.filter((e) => e.type === 'confirmation').length;
  for (let i = 0; i < 3; i += 1) await jreq(web.base, 'GET', '/api/confirmations');
  await delay(200);
  assert.equal(global.events.filter((e) => e.type === 'confirmation').length, before, 'GET /api/confirmations 零帧');

  // 取消路径：移出在途表且不产生任何广播
  const framesBeforeCancel = global.events.length;
  await sendNotice(node, { kind: 'confirmation_cancelled', confirmation_id: 'cfm-1' });
  await waitFor(async () => (await listOf(web)).confirmations.length === 0, { timeoutMs: 5000, what: '取消后移出在途表' });
  await delay(200);
  assert.equal(global.events.length, framesBeforeCancel, 'confirmation_cancelled 不产生任何帧');

  // 全程零 chat:<id> 定向帧（确认面走全局键）
  await delay(200);
  assert.deepEqual(chat.events, [], '确认请求上浮 / 失效移除不发 chat:<id> 定向帧');

  // 同形不可达：取消一个从未存在的 id 无副作用
  await sendNotice(node, { kind: 'confirmation_cancelled', confirmation_id: 'cfm-never' });
  await delay(200);
  assert.deepEqual((await listOf(web)).confirmations, []);

  // 无历史台账：已失效 / 已裁决项没有任何读取入口（含查询参数形态）
  const probed = await jreq(web.base, 'GET', '/api/confirmations?confirmation_id=cfm-1');
  assert.deepEqual(probed.body, { confirmations: [] }, '查询参数不得成为已处置项的读取入口');

  // 重建面不依赖 Router / 库：在途项唯一数据源 = web 进程内的 inbox（Router 停掉后仍可读）
  const alive = ENVELOPE({ confirmation_id: 'cfm-2', title: 'echo ALIVE' });
  await sendNotice(node, alive);
  await waitFor(async () => (await listOf(web)).confirmations.length === 1, { timeoutMs: 5000, what: '第二条确认项入表' });
  await router.stop();
  const noRouter = await jreq(web.base, 'GET', '/api/confirmations');
  assert.equal(noRouter.status, 200, 'Router 不可达不影响重建面（不查 Router、不读库）');
  assert.deepEqual(noRouter.body, { confirmations: [entryOf(alive)] });
});

// ────────────────────────── T2：R-2 裁决契约（合法 / 错误契约 / 回传 / 文本落地） ──────────────────────────

test('T2：R-2 合法裁决 200 + 立即移出 + 二次 404；错误契约 400 保留在途 / 404 同码；回传信封与文本落地', async (t) => {
  const { router, web, projectId } = await setup(t);
  const node = await startFakeNode({ socketPath: router.socketPath, instanceId: 'pb-dev' });
  t.after(() => node.stop());

  // 造一个真实对话（归属项目）——确认项的 chat_id 指向它，裁决文本才有落点
  const created = await jreq(web.base, 'POST', '/api/messages', json({ project_id: projectId, agent_id: 'pb-dev', text: '建对话' }));
  assert.equal(created.status, 200, `建对话应成功：${created.text}`);
  const chatId = created.body.chat_id;
  const before = await detailOf(web, chatId);
  const tasksBefore = node.received.filter((m) => m.type === 'task.request').length;

  const env = ENVELOPE({ confirmation_id: 'cfm-1', chat_id: chatId });
  await sendNotice(node, env);
  await waitFor(async () => (await listOf(web)).confirmations.length === 1, { timeoutMs: 5000, what: '确认项入表' });

  const decide = (id, payload) => jreq(web.base, 'POST', `/api/confirmations/${id}/decision`, json(payload));

  // 错误契约：option_id 缺失 / 非字符串 / 不在该条 options 内 → 400 且条目保留在途
  for (const bad of [{}, { option_id: 42 }, { option_id: 'not_in_options' }]) {
    const res = await decide('cfm-1', bad);
    assert.equal(res.status, 400, `非法 option_id 应 400：${JSON.stringify(bad)}`);
    assert.equal(res.body.code, 'INVALID_PARAM');
    assert.deepEqual((await listOf(web)).confirmations, [entryOf(env)], `400 后条目保留在途：${JSON.stringify(bad)}`);
  }

  // confirmation_id 不在表内（从未存在）→ 404 NOT_FOUND（同一码，不区分）
  const missing = await decide('cfm-never', { option_id: 'allow_once' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');

  // 合法裁决：200 {confirmation_id, accepted:true}；条目立即移出在途表
  const ok = await decide('cfm-1', { option_id: 'allow_once', text: '  需要理由  ' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { confirmation_id: 'cfm-1', accepted: true });
  assert.deepEqual((await listOf(web)).confirmations, [], '裁决即刻移出在途表');

  // 第二次提交同一 id → 404（非幂等、不重放；无历史台账）
  const again = await decide('cfm-1', { option_id: 'allow_once' });
  assert.equal(again.status, 404);
  assert.equal(again.body.code, 'NOT_FOUND');

  // 回传：向该条的发出方发 notice{kind:'confirmation_decision', 同值 id, 用户所选 option_id, 文本}
  await waitFor(() => node.received.some((m) => m.type === 'notice' && parseBody(m).kind === 'confirmation_decision'), { timeoutMs: 5000, what: 'confirmation_decision 回传' });
  const decisions = node.received.filter((m) => m.type === 'notice').map(parseBody).filter((b) => b.kind === 'confirmation_decision');
  assert.equal(decisions.length, 1, '回传恰一条');
  assert.equal(decisions[0].confirmation_id, 'cfm-1');
  assert.equal(decisions[0].option_id, 'allow_once');
  assert.equal(decisions[0].text, '需要理由', '回传文本为 trim 后的值');
  assert.equal(decisions[0].chat_id, chatId);

  // 文本落地：非空白 ⇒ 追加一条 direction='in' 输入 + 派发（假节点收到带该文本的 task.request）
  await waitFor(() => node.received.filter((m) => m.type === 'task.request').length > tasksBefore, { timeoutMs: 5000, what: '裁决文本派发' });
  const after = await detailOf(web, chatId);
  const ins = after.messages.filter((m) => m.direction === 'in');
  assert.equal(ins.length, before.messages.filter((m) => m.direction === 'in').length + 1, '恰追加一条输入');
  assert.equal(ins[ins.length - 1].text, '需要理由');
  const dispatched = node.received.filter((m) => m.type === 'task.request').map(parseBody);
  assert.equal(dispatched[dispatched.length - 1].prompt, '需要理由', '派发的 prompt = 裁决文本');
  assert.equal(dispatched[dispatched.length - 1].executor, 'omp-daemon');
  assert.equal(dispatched[dispatched.length - 1].chat_id, chatId);

  // 空白文本：裁决仍成功，但**不**追加输入、**不**派发
  const blankEnv = ENVELOPE({ confirmation_id: 'cfm-2', chat_id: chatId, title: 'echo BLANK' });
  await sendNotice(node, blankEnv);
  await waitFor(async () => (await listOf(web)).confirmations.length === 1, { timeoutMs: 5000, what: '第二条确认项入表' });
  const insBefore = (await detailOf(web, chatId)).messages.filter((m) => m.direction === 'in').length;
  const reqBefore = node.received.filter((m) => m.type === 'task.request').length;
  const blank = await decide('cfm-2', { option_id: 'reject_once', text: '   ' });
  assert.equal(blank.status, 200);
  assert.deepEqual(blank.body, { confirmation_id: 'cfm-2', accepted: true });
  await delay(300);
  assert.equal((await detailOf(web, chatId)).messages.filter((m) => m.direction === 'in').length, insBefore, '空白文本不追加输入');
  assert.equal(node.received.filter((m) => m.type === 'task.request').length, reqBefore, '空白文本不派发');
  assert.deepEqual((await listOf(web)).confirmations, [], '空白文本的裁决同样移出在途表');
});

// ────────────────────────── T4：publishState 的全局广播与键隔离 ──────────────────────────

test('T4：publishState 既有 chat:<id> 帧逐字不变 + 全局链路可观测终态 + 仍不含 message / task_update / notice', async (t) => {
  const { router, web, projectId } = await setup(t);
  const agent = await startEchoAgent(router, 'dev-1');
  t.after(() => agent.stop());
  const global = await openGlobal(web.base);
  t.after(() => global.close());

  const first = await jreq(web.base, 'POST', '/api/messages', json({ project_id: projectId, agent_id: 'dev-1', text: '第一轮' }));
  assert.equal(first.status, 200, `派发应成功：${first.text}`);
  const chatId = first.body.chat_id;
  await waitFor(async () => (await detailOf(web, chatId)).chat.state === 'completed', { timeoutMs: 8000, what: '第一轮终态' });

  // 第二轮：同时观察 chat:<id> 与全局两条链路上的 chat_state
  const chat = await openChat(web.base, chatId);
  t.after(() => chat.close());
  const second = await jreq(web.base, 'POST', '/api/messages', json({ chat_id: chatId, agent_id: 'dev-1', text: '第二轮' }));
  assert.equal(second.status, 200);
  await waitFor(
    () => chat.events.some((e) => e.type === 'chat_state' && e.data.state === 'completed'),
    { timeoutMs: 8000, what: '第二轮终态帧' },
  );
  await delay(300);

  // 既有 chat:<id> 帧：形态 = {chat_id, state}，时机 = working（派发前）→ completed（终态）
  const chatStates = chat.events.filter((e) => e.type === 'chat_state');
  assert.ok(chatStates.every((e) => e.data.chat_id === chatId));
  assert.ok(chatStates.every((e) => JSON.stringify(Object.keys(e.data).sort()) === JSON.stringify(['chat_id', 'state'])), '既有帧形态逐字不变');
  assert.equal(chatStates[0].data.state, 'working', 'working 帧先于终态帧');
  assert.equal(chatStates[chatStates.length - 1].data.state, 'completed');

  // 全局链路：同一状态可观测（对话终态不依赖停留在该对话）
  const globalStates = global.events.filter((e) => e.type === 'chat_state' && e.data.chat_id === chatId);
  const states = new Set(globalStates.map((e) => e.data.state));
  assert.ok(states.has('working'), `全局链路应含 working：${JSON.stringify([...states])}`);
  assert.ok(states.has('completed'), `全局链路应含终态 completed：${JSON.stringify([...states])}`);
  for (const e of globalStates) {
    assert.deepEqual(e.data, chatStates.find((c) => c.data.state === e.data.state).data, '全局帧与定向帧同形状（只多走全局键）');
  }

  // 键隔离：message / task_update / notice 仍只走 chat:<id>
  assert.ok(
    !global.events.some((e) => ['message', 'task_update', 'notice'].includes(e.type)),
    `全局订阅不得收到对话类事件：${JSON.stringify(global.events.map((e) => e.type))}`,
  );
});

// ────────────────────────── T6：静态面登记与回归 ──────────────────────────

test('T6：STATIC_FILES 登记 /notify.js（缺席 ⇒ ENOENT → 404，无通配）+ 既有静态面逐字不变', async (t) => {
  const { web } = await setup(t);

  // 登记面（白名单为包内私有常量，不导出）：以源码登记行 + 可达行为两面锁定
  const src = fs.readFileSync(path.join(ROOT, 'src', 'web.js'), 'utf8');
  assert.match(src, /'\/notify\.js': 'web\/notify\.js',/, 'STATIC_FILES 应登记 /notify.js → web/notify.js');
  const notifyAbs = path.join(ROOT, 'web', 'notify.js');
  const notify = await fetch(`${web.base}/notify.js`);
  assert.equal(notify.status, fs.existsSync(notifyAbs) ? 200 : 404, '登记生效：文件在场则 200，缺席则 ENOENT → 404');

  // 无通配 / 无目录枚举 / 无路径拼接：白名单之外的路径一律 404
  for (const p of ['/web/notify.js', '/web/index.html', '/notify.js.map']) {
    assert.equal((await fetch(`${web.base}${p}`)).status, 404, `${p} 不在白名单 ⇒ 404`);
  }

  // 既有静态面逐字不变（抽查两条：与仓库文件字节相等）
  for (const [p, file] of [['/', 'web/index.html'], ['/app.js', 'web/app.js'], ['/llms.txt', 'llms.txt']]) {
    const res = await fetch(`${web.base}${p}`);
    assert.equal(res.status, 200, `${p} 应 200`);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(Buffer.compare(bytes, fs.readFileSync(path.join(ROOT, file))), 0, `${p} 与仓库文件逐字节相等`);
  }
});
