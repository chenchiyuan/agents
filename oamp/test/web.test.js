// test/web.test.js — Web 控制台契约测试（0011 迭代：读库 API + SSE 实时 + 落盘口径 + 基线等价）
// 载体：harness 真实 Router + agent 子进程（fake ACP 经 OAMP_OMP_BIN 注入）+ `oamp web start` 子进程
//       （随机端口 + 临时 OAMP_DB）+ fetch 断言 REST、fetch/reader 手工解析 SSE。
// 不依赖真实 omp/真实 LLM/外网；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。
// 覆盖：F01~F06 的 web 侧可观察面 + F08-a~d 的等价断言（F08 卡片裁定口径，architecture §9.3）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

// —— fake omp：同一脚本两种形态（`acp` 常驻 JSON-RPC / `-p` 一次式）——
// 失败模式经 env 编排：FAKE_ACP_HANG（不响应，测启动扫尾）/ FAKE_ACP_STICKY_MODEL（接受但未生效，锁审计面）；
// 观测面：FAKE_ACP_ARGS_LOG（启动参数集，证 web 透传的 model 与执行路径判定）。
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

const modelIdx = argv.indexOf('--model');
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'openai/gpt-5.6-luna';
const hang = process.env.FAKE_ACP_HANG === '1';
const sticky = process.env.FAKE_ACP_STICKY_MODEL === '1';

let sessionSeq = 0;
const sessions = new Map();
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function configOptions(model) {
  return [{ id: 'model', category: 'model', currentValue: model, options: [] }];
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
    sessions.set(sessionId, { model: spawnModel });
    reply(msg.id, { sessionId, configOptions: configOptions(spawnModel) });
    // omp 启动期会灌初始化通知（§6.6）：静默窗口应在其后收敛
    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'available_commands_update', availableCommands: [] } } });
    }, 20);
    return;
  }
  if (msg.method === 'session/set_config_option') {
    const session = sessions.get(msg.params.sessionId);
    if (session && !sticky) session.model = msg.params.value;
    reply(msg.id, { configOptions: configOptions(sticky ? spawnModel : msg.params.value) });
    return;
  }
  if (msg.method === 'session/prompt') {
    const session = sessions.get(msg.params.sessionId);
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
    if (hang) return; // 永不响应 → chat 停在 working（启动扫尾用例）
    const answer = '收到：' + text;
    const parts = [answer.slice(0, 1), answer.slice(1, 2), answer.slice(2)];
    for (const part of parts) {
      if (part === '') continue;
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: session.sessionId || msg.params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } } });
      await delay(10);
    }
    await delay(10);
    reply(msg.id, { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } });
    return;
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-web-fake-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

function pickPort() {
  return 41000 + Math.floor(Math.random() * 2000);
}
// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），而 harness SHORT_ENV 的 300ms 租约会让它被判 offline
// → Router 对 task.update/result 只记录不投递。本文件统一放长租约（仍远短于用例时长）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

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
    getExit: () => exit,
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
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function jpost(base, p, payload) {
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** SSE 客户端：fetch + reader 手工解析（零依赖；headers 返回即视为订阅已注册）。 */
async function openSse(base, chatId) {
  const ac = new AbortController();
  const res = await fetch(`${base}/api/stream?chat_id=${encodeURIComponent(chatId)}`, { signal: ac.signal });
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
  return { events, close: () => ac.abort(), pump };
}

async function setup(t, { env = {}, agentId = 'dev-1', withAgent = true } = {}) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  if (withAgent) {
    const agent = await startAgent(agentId, { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: FAKE_BIN, ...env } });

    t.after(() => agent.stop());
    await agent.waitAgentLine(new RegExp(`REGISTERED instance=${agentId}`));
  }
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-web-db-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const dbPath = path.join(dbDir, 'sql.db');
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath });
  t.after(() => web.stop());
  return { router, web, dbPath };
}

/** 发一条消息并等该 chat 落终态（第 rounds 轮的 in/out 记录齐备），返回 { chatId, taskId, sent, detail }。 */
async function sendAndWait(web, payload, { rounds = 1, timeoutMs = 8000 } = {}) {
  const sent = await jpost(web.base, '/api/messages', payload);
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);
  const chatId = sent.body.chat_id;
  const detail = await waitFor(
    async () => {
      const { body } = await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`);
      if (!body || !body.messages || body.chat.state === 'working') return null;
      const ins = body.messages.filter((m) => m.direction === 'in').length;
      const outs = body.messages.filter((m) => m.direction === 'out').length;
      return ins >= rounds && outs >= rounds ? body : null;
    },
    { timeoutMs, what: `chat ${chatId} 第 ${rounds} 轮落 out 记录` },
  );
  return { chatId, taskId: sent.body.task_id, sent, detail };
}

const detailOf = async (web, chatId) => (await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`)).body;

// ────────────────────────── F08-d 等价：静态页 + 在线 agent ──────────────────────────
test('Web：静态页可访问 + /api/agents 返回在线 agent（F08-d 等价）', async (t) => {
  const { web } = await setup(t);

  const page = await fetch(`${web.base}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /oamp/);
  assert.match(html, /Web Console/);

  const { status, body } = await jget(web.base, '/api/agents');
  assert.equal(status, 200);
  const dev1 = body.agents.find((a) => a.instance_id === 'dev-1');
  assert.ok(dev1, '应列出 dev-1');
  assert.equal(dev1.state, 'online');
});

// ────────────────────────── F01/F03：列表、过滤、分页、400 面 ──────────────────────────
test('Web：GET /api/chats 列表（字段齐 / 默认排序 / 含已关闭）', async (t) => {
  const { web } = await setup(t);

  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '苹果 主题的对话' });
  const second = await sendAndWait(web, { agent_id: 'dev-1', text: '香蕉 主题的对话' });
  const closed = await jpost(web.base, `/api/chats/${encodeURIComponent(second.chatId)}/close`, {});
  assert.equal(closed.status, 200);

  const { status, body } = await jget(web.base, '/api/chats');
  assert.equal(status, 200);
  assert.equal(body.limit, 50);
  assert.equal(body.offset, 0);
  assert.equal(body.total, 2);
  for (const c of body.chats) {
    for (const key of ['chat_id', 'title', 'agent_id', 'state', 'created_at', 'updated_at', 'message_count']) {
      assert.ok(key in c, `列表项应含 ${key}`);
    }
  }
  const item = body.chats.find((c) => c.chat_id === first.chatId);
  assert.equal(item.state, 'completed');
  assert.equal(item.agent_id, 'dev-1');
  assert.equal(item.message_count, 2);
  const closedItem = body.chats.find((c) => c.chat_id === second.chatId);
  assert.equal(closedItem.state, 'closed', '列表必须包含已关闭 chat');
  // 默认排序 updated_at DESC（关闭使 second 的 updated_at 前移 → 它应排在前面）
  assert.ok(body.chats[0].updated_at >= body.chats[1].updated_at, '默认应按 updated_at 倒序');
});

test('Web：GET /api/chats 过滤 / 时间范围 / 分页 / 非法参数 400', async (t) => {
  const { web } = await setup(t);

  const a = await sendAndWait(web, { agent_id: 'dev-1', text: '苹果 主题的对话' });
  const b = await sendAndWait(web, { agent_id: 'dev-1', text: '香蕉 主题的对话' });
  // 关键词命中"消息文本"（标题取首条输入，第二条消息里的词不在标题里）
  await sendAndWait(web, { chat_id: b.chatId, agent_id: 'dev-1', text: '追加一句 橙子 相关' });
  const closed = await jpost(web.base, `/api/chats/${encodeURIComponent(b.chatId)}/close`, {});
  assert.equal(closed.status, 200);

  const byTitle = await jget(web.base, '/api/chats?q=%E8%8B%B9%E6%9E%9C'); // 苹果
  assert.equal(byTitle.body.total, 1);
  assert.equal(byTitle.body.chats[0].chat_id, a.chatId);

  const byMessage = await jget(web.base, '/api/chats?q=%E6%A9%99%E5%AD%90'); // 橙子（仅出现在消息文本）
  assert.equal(byMessage.body.total, 1);
  assert.equal(byMessage.body.chats[0].chat_id, b.chatId);

  const escaped = await jget(web.base, '/api/chats?q=%25'); // 单个 % 不应命中全部（转义生效）
  assert.equal(escaped.body.total, 0);

  const byAgent = await jget(web.base, '/api/chats?agent=dev-1');
  assert.equal(byAgent.body.total, 2);
  const byGhost = await jget(web.base, '/api/chats?agent=ghost');
  assert.equal(byGhost.body.total, 0);

  const byState = await jget(web.base, '/api/chats?state=closed');
  assert.equal(byState.body.total, 1);
  assert.equal(byState.body.chats[0].chat_id, b.chatId);
  const byWorking = await jget(web.base, '/api/chats?state=working');
  assert.equal(byWorking.body.total, 0);
  // 组合（state + q）需同时满足
  const combined = await jget(web.base, '/api/chats?state=closed&q=%E6%A9%99%E5%AD%90');
  assert.equal(combined.body.total, 1);
  const combinedMiss = await jget(web.base, '/api/chats?state=closed&q=%E8%8B%B9%E6%9E%9C');
  assert.equal(combinedMiss.body.total, 0);

  const all = await jget(web.base, '/api/chats');
  const maxUpdated = Math.max(...all.body.chats.map((c) => c.updated_at));
  const range = await jget(web.base, `/api/chats?from=0&to=${maxUpdated}`);
  assert.equal(range.body.total, 2);
  assert.ok(range.body.chats.every((c) => c.updated_at <= maxUpdated), '闭区间过滤结果应全部落在范围内');
  const empty = await jget(web.base, `/api/chats?from=${maxUpdated + 1}`);
  assert.equal(empty.body.total, 0);

  const page1 = await jget(web.base, '/api/chats?limit=1');
  assert.equal(page1.body.chats.length, 1);
  assert.equal(page1.body.total, 2);
  assert.equal(page1.body.limit, 1);
  const page2 = await jget(web.base, '/api/chats?limit=1&offset=1');
  assert.equal(page2.body.chats.length, 1);
  assert.notEqual(page2.body.chats[0].chat_id, page1.body.chats[0].chat_id);

  for (const q of ['limit=0', 'limit=abc', 'limit=201', 'offset=-1', 'state=bogus', 'from=10&to=5']) {
    const { status } = await jget(web.base, `/api/chats?${q}`);
    assert.equal(status, 400, `${q} 应 400`);
  }
});

test('Web：GET /api/chats/:id 详情（升序 + 字段 + 未知 chat 明确 404）', async (t) => {
  const { web } = await setup(t);

  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '详情检查 第一条' });
  await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '详情检查 第二条' }, { rounds: 2 });

  const { status, body } = await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`);
  assert.equal(status, 200);
  assert.equal(body.chat.chat_id, chatId);
  assert.equal(body.chat.agent_id, 'dev-1');
  assert.equal(body.chat.state, 'completed');
  assert.equal(body.messages.length, 4, '两轮 = 2 in + 2 out');
  assert.deepEqual(body.messages.map((m) => m.direction), ['in', 'out', 'in', 'out']);
  for (let i = 1; i < body.messages.length; i += 1) {
    const prev = body.messages[i - 1];
    const cur = body.messages[i];
    assert.ok(cur.created_at > prev.created_at || cur.id > prev.id, '消息应为 created_at ASC, id ASC');
  }
  const firstIn = body.messages[0];
  assert.equal(typeof firstIn.meta, 'object');
  assert.ok(firstIn.meta.task_id, 'in 记录 meta.task_id 应与预生成 task_id 同值');
  const firstOut = body.messages[1];
  assert.equal(firstOut.meta === null || typeof firstOut.meta === 'object', true);
  assert.equal(typeof firstOut.model, 'string');

  const missing = await jget(web.base, '/api/chats/chat-does-not-exist');
  assert.equal(missing.status, 404);
  assert.ok(missing.body && typeof missing.body.error === 'string' && missing.body.error.length > 0, '未知 chat 应返回明确的"不存在"错误');
});

// ────────────────────────── F01/F02/F08-a~c：发送 → 落盘 → 终态 → 回流 ──────────────────────────
test('Web：发送消息 → 落 in/out 两行 → 终态回流（F08-a 等价）', async (t) => {
  const { web } = await setup(t);

  const sent = await jpost(web.base, '/api/messages', { text: '@dev-1 web-contract-check' });
  assert.equal(sent.status, 200);
  assert.match(sent.body.chat_id, /^chat-[0-9a-f-]{36}$/, 'chat_id 应为预生成 chat-<uuid>');
  assert.match(sent.body.task_id, /^task-[0-9a-f-]{36}$/, 'task_id 应为预生成 task-<uuid>');
  assert.equal(sent.body.warning, null);

  const chatId = sent.body.chat_id;
  const detail = await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.chat.state === 'completed' ? d : null;
    },
    { timeoutMs: 8000, what: 'chat 完成' },
  );

  assert.equal(detail.chat.agent_id, 'dev-1');
  assert.match(detail.chat.title, /web-contract-check/, '标题应含首条输入文本');
  assert.ok(detail.chat.title.length <= 40, '标题应 ≤ 40 字符');
  assert.equal(detail.messages.length, 2, '一次问答恰 2 行（E-5）');
  assert.deepEqual([...new Set(detail.messages.map((m) => m.direction))], ['in', 'out']);
  assert.equal(detail.messages[0].meta.task_id, sent.body.task_id, 'in 的 meta.task_id = 响应 task_id');
  assert.match(detail.messages[1].text, /收到：web-contract-check/, 'out 文本应为 agent 回答');

  const list = await jget(web.base, '/api/chats');
  const item = list.body.chats.find((c) => c.chat_id === chatId);
  assert.ok(item, '列表应包含该会话');
  assert.equal(item.state, 'completed');
  assert.equal(item.message_count, 2);
});

test('Web：标题取首条输入 40 字符且后续输入不改标题（F01-2）', async (t) => {
  const { web } = await setup(t);

  const longText = `@dev-1 ${'长'.repeat(60)}`;
  const sent = await jpost(web.base, '/api/messages', { text: longText });
  const chatId = sent.body.chat_id;
  const first = await waitFor(async () => {
    const d = await detailOf(web, chatId);
    return d && d.chat.state === 'completed' ? d : null;
  }, { timeoutMs: 8000, what: '首轮完成' });
  const title = first.chat.title;
  assert.equal(title.length, 40, '标题应为去空白后截断 40 字符');
  assert.equal(title, longText.trim().slice(0, 40));

  await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '另一条完全不同的输入' }, { rounds: 2 });
  const after = await detailOf(web, chatId);
  assert.equal(after.chat.title, title, '后续输入不改标题（AR-02）');
});

test('Web：追加消息到既有 chat（F08-b 等价）', async (t) => {
  const { web } = await setup(t);

  const first = await jpost(web.base, '/api/messages', { text: '@dev-1 echo first' });
  assert.ok(first.body.chat_id);
  const chatId = first.body.chat_id;
  await waitFor(async () => {
    const d = await detailOf(web, chatId);
    return d && d.chat.state === 'completed' ? d : null;
  }, { timeoutMs: 8000, what: '首轮完成' });

  const second = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: '@dev-1 echo second' });
  assert.equal(second.status, 200);
  assert.equal(second.body.chat_id, chatId, '应追加到同一 chat');

  const chat = await waitFor(async () => {
    const d = await detailOf(web, chatId);
    return d && d.chat.state === 'completed' && d.messages.length === 4 ? d : null;
  }, { timeoutMs: 8000, what: '两轮四条记录' });
  assert.equal(chat.messages.length, 4, '两轮 = 2 in + 2 out');
  assert.deepEqual(chat.messages.map((m) => m.direction), ['in', 'out', 'in', 'out']);
  assert.match(chat.messages[3].text, /echo second/, '第二条回答应回落到可见结果');
});

test('Web：错误面——缺 agent / 空消息 / 非法 model（F08-c 等价）', async (t) => {
  const { web } = await setup(t);

  const noAgent = await jpost(web.base, '/api/messages', { text: 'echo no-agent' });
  assert.equal(noAgent.status, 400);
  assert.ok(noAgent.body.error, '应返回明确错误');

  const empty = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '   ' });
  assert.equal(empty.status, 400);
  assert.ok(empty.body.error);

  const badModel = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: 'hi', model: 'bad model!' });
  assert.equal(badModel.status, 400);
  assert.ok(badModel.body.error);

  const missing = await jget(web.base, '/api/chats/chat-does-not-exist');
  assert.equal(missing.status, 404);
  assert.ok(missing.body.error);

  // 畸形 JSON → 400（客户端错误，不是 502）；请求体超限 → 413 + 明确错误（连接正常结束，不留悬挂）
  const badJson = await fetch(`${web.base}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
  assert.ok((await badJson.json()).error);

  const tooLarge = await fetch(`${web.base}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent_id: 'dev-1', text: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(tooLarge.status, 413);
  assert.ok((await tooLarge.json()).error);

  const after = await jget(web.base, '/api/chats');
  assert.equal(after.status, 200, '错误请求后服务仍可正常响应');
});

test('Web：派发失败 → 落 out(error=dispatch_failed) + failed 状态', async (t) => {
  const { web } = await setup(t, { withAgent: false }); // 无 agent 注册 → 派发必然失败

  const sent = await jpost(web.base, '/api/messages', { agent_id: 'ghost-1', text: '派发失败用例' });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.task_id, null);
  assert.ok(sent.body.warning, '应返回派发失败提示');

  const detail = await detailOf(web, sent.body.chat_id);
  assert.equal(detail.chat.state, 'failed');
  assert.equal(detail.messages.length, 2, '失败轮同样恰 2 行（in + out）');
  assert.equal(detail.messages[1].direction, 'out');
  assert.equal(detail.messages[1].error, 'dispatch_failed');
});

// ────────────────────────── §9.1 执行路径判定（F08-1/2） ──────────────────────────
test('Web：执行路径判定——默认 daemon / one_shot / ! shell', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-web-args-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const argsLog = path.join(dir, 'argv.jsonl');
  const { web } = await setup(t, { env: { FAKE_ACP_ARGS_LOG: argsLog } });

  const daemon = await sendAndWait(web, { agent_id: 'dev-1', text: '默认路径问题' });
  assert.match(daemon.detail.messages[1].text, /收到：默认路径问题/);

  const oneShot = await sendAndWait(web, { agent_id: 'dev-1', text: '一次性问题', one_shot: true });
  assert.match(oneShot.detail.messages[1].text, /one-shot answer: 一次性问题/, 'one_shot 应走 omp -p 一次性路径');

  const shell = await sendAndWait(web, { agent_id: 'dev-1', text: '!echo shell-path-ok' });
  assert.match(shell.detail.messages[1].text, /shell-path-ok/, '! 前缀应走 shell 执行器');

  const argvs = fs.readFileSync(argsLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(argvs.some((a) => a[0] === 'acp'), '默认路径应起 acp 常驻进程');
  assert.ok(argvs.some((a) => a.includes('-p') && !a.includes('acp')), '一次性路径应走 -p');
  assert.ok(argvs.some((a) => a[a.length - 1] === '一次性问题'), '一次性路径应带 prompt');
});

// ────────────────────────── F06：模型透传与每轮审计 ──────────────────────────
test('Web：model 透传与审计（payload 含该值 / out.model = ACP 实报值）', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-web-model-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const argsLog = path.join(dir, 'argv.jsonl');
  const { web } = await setup(t, { env: { FAKE_ACP_ARGS_LOG: argsLog, OAMP_OMP_MODEL: 'beta/model-b' } });

  // ① 请求带 model → 派发 payload 含该值（经 agent 侧首轮启动参数可观察），out.model = ACP 实报值
  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '第一轮', model: 'alpha/model-a' });
  assert.equal(first.detail.messages[1].model, 'alpha/model-a');
  const argvs = fs.readFileSync(argsLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const acpArgv = argvs.find((a) => a[0] === 'acp');
  assert.ok(acpArgv.includes('--model') && acpArgv[acpArgv.indexOf('--model') + 1] === 'alpha/model-a', '首轮应以请求 model 起进程');

  // ② 同 chat 未带 model → 默认链在 agent 侧解析（web 不注入默认值）；切换不重建进程
  const second = await sendAndWait(web, { chat_id: first.chatId, agent_id: 'dev-1', text: '第二轮' }, { rounds: 2 });
  assert.equal(second.detail.messages[3].model, 'beta/model-b', '未指定时应回到 OAMP_OMP_MODEL 默认链');
  assert.deepEqual(second.detail.messages[1].meta, first.detail.messages[1].meta, '同一 chat 应复用常驻实例（context_id/pid 不变）');

  // ③ 审计不得用请求回显冒充：ACP 接受但未生效（sticky）时，out.model 必须是 ACP 实报值
  // sticky：set_config_option 回 ok 但不改 currentValue（模拟"接受但未生效"）
  const sticky = await setup(t, { env: { FAKE_ACP_STICKY_MODEL: '1' } });
  const stickyFirst = await sendAndWait(sticky.web, { agent_id: 'dev-1', text: 'sticky 审计第一轮', model: 'alpha/model-a' });
  assert.equal(stickyFirst.detail.messages[1].model, 'alpha/model-a', '首轮生效模型 = 启动参数（ACP 回读）');
  const stickySecond = await sendAndWait(
    sticky.web,
    { chat_id: stickyFirst.chatId, agent_id: 'dev-1', text: 'sticky 审计第二轮', model: 'beta/model-b' },
    { rounds: 2 },
  );
  assert.equal(stickySecond.detail.messages[3].model, 'alpha/model-a', 'ACP 未生效时审计值必须是实报 currentValue');
  assert.notEqual(stickySecond.detail.messages[3].model, 'beta/model-b', '不得以请求参数回显冒充实际生效模型');
});

// ────────────────────────── F04：SSE 事件序列与 E-4 ──────────────────────────
test('Web：SSE 事件序列 + E-4（终态前 ≥2 个 task_update 且文本递增）+ 过程不入库', async (t) => {
  const { web } = await setup(t);

  // 先建 chat（新 chat 的 chat_id 只在 POST 响应中可得，故 E-4 取既有 chat 的第二轮）
  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '第一轮建 chat' });
  const chatId = first.chatId;

  const sse = await openSse(web.base, chatId);
  t.after(() => sse.close());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: '流式检查第二轮' });
  assert.equal(sent.status, 200);

  await waitFor(() => sse.events.some((e) => e.type === 'message' && e.data.message.direction === 'out'), {
    timeoutMs: 8000,
    what: 'SSE message(out)',
  });

  const events = sse.events;
  const idxIn = events.findIndex((e) => e.type === 'message' && e.data.message.direction === 'in');
  const idxOut = events.findIndex((e) => e.type === 'message' && e.data.message.direction === 'out');
  const updates = events.filter((e) => e.type === 'task_update');
  const idxFirstUpdate = events.findIndex((e) => e.type === 'task_update');
  const idxLastUpdate = events.map((e) => e.type).lastIndexOf('task_update');
  const states = events.filter((e) => e.type === 'chat_state');

  assert.ok(idxIn >= 0 && idxIn < idxFirstUpdate, 'message(in) 应先于过程增量');
  assert.ok(idxLastUpdate < idxOut, 'E-4：全部 task_update 必须在 message(out) 之前');
  assert.ok(updates.length >= 2, `E-4：终态前应有 ≥2 个 task_update（实得 ${updates.length}）`);
  assert.ok(updates.every((u) => u.data.chat_id === chatId && u.data.task_id === sent.body.task_id));
  assert.ok(updates.every((u) => u.data.kind === 'chunk' && typeof u.data.text === 'string'), 'task_update 应为 kind=chunk + text');
  let acc = 0;
  for (const u of updates) {
    const next = acc + u.data.text.length;
    assert.ok(next > acc, 'E-4：过程文本应递增');
    acc = next;
  }
  assert.equal(acc, '收到：流式检查第二轮'.length, '增量拼接应等于完整回答长度');
  assert.ok(states.some((s) => s.data.state === 'working'), '应有 chat_state(working)');
  assert.ok(states.some((s) => s.data.state === 'completed'), '应有 chat_state(completed)');

  const detail = await detailOf(web, chatId);
  assert.equal(detail.messages.length, 4, '过程增量不入库（该轮仍恰 2 行）');
  assert.match(detail.messages[3].text, /收到：流式检查第二轮/, '终态以落盘文本为准');
});

test('Web：/api/stream 缺 chat_id → 400；无订阅者时发送不受影响', async (t) => {
  const { web } = await setup(t);

  const missing = await fetch(`${web.base}/api/stream`);
  assert.equal(missing.status, 400);

  const sent = await sendAndWait(web, { agent_id: 'dev-1', text: '无订阅者' });
  assert.match(sent.detail.messages[1].text, /收到：无订阅者/);
});

// ────────────────────────── F01-5/F05：关闭幂等 + 释放提示转发 ──────────────────────────
test('Web：关闭 chat——幂等 / 不删数据 / 转发 context_released / 后续提交 409', async (t) => {
  const { web } = await setup(t);

  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '关闭用例' });
  const sse = await openSse(web.base, chatId);
  t.after(() => sse.close());

  const closed = await jpost(web.base, `/api/chats/${encodeURIComponent(chatId)}/close`, {});
  assert.equal(closed.status, 200);
  assert.equal(closed.body.chat_id, chatId);
  assert.equal(closed.body.state, 'closed');

  await waitFor(() => sse.events.some((e) => e.type === 'notice'), { timeoutMs: 5000, what: 'SSE notice' });
  const notices = sse.events.filter((e) => e.type === 'notice');
  assert.equal(notices.length, 1, '上下文释放提示恰 1 条（agent 回发，web 不自行 publish）');
  assert.equal(notices[0].data.kind, 'context_released');
  assert.equal(notices[0].data.chat_id, chatId);
  assert.ok(sse.events.some((e) => e.type === 'chat_state' && e.data.state === 'closed'));

  const detail = await detailOf(web, chatId);
  assert.equal(detail.chat.state, 'closed');
  assert.equal(detail.messages.length, 2, '关闭不删数据');

  const list = await jget(web.base, '/api/chats?state=closed');
  assert.equal(list.body.total, 1);

  // 幂等：再次关闭仍 200 closed，且不重复发控制消息（无第二条提示）
  const again = await jpost(web.base, `/api/chats/${encodeURIComponent(chatId)}/close`, {});
  assert.equal(again.status, 200);
  assert.equal(again.body.state, 'closed');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(sse.events.filter((e) => e.type === 'notice').length, 1, '重复关闭不应重复提示');

  const rejected = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: '关闭后提交' });
  assert.equal(rejected.status, 409);
  const after = await detailOf(web, chatId);
  assert.equal(after.messages.length, 2, '被拒提交不产生新记录');

  const unknown = await jpost(web.base, '/api/chats/chat-does-not-exist/close', {});
  assert.equal(unknown.status, 404);
});

// ────────────────────────── F02-6/F01-3：启动扫尾 ──────────────────────────
test('Web：启动扫尾——遗留 working 重启后置 failed 且不补记录', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: FAKE_BIN, FAKE_ACP_HANG: '1' } });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);

  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-web-db-'));
  t.after(() => fs.rmSync(dbDir, { recursive: true, force: true }));
  const dbPath = path.join(dbDir, 'sql.db');
  const port = pickPort();
  const web = await startWeb(router.socketPath, port, { OAMP_DB: dbPath });
  t.after(() => web.stop());

  const sent = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '挂起用例' });
  assert.equal(sent.status, 200);
  const chatId = sent.body.chat_id;
  await waitFor(async () => {
    const d = await detailOf(web, chatId);
    return d && d.chat.state === 'working' ? d : null;
  }, { timeoutMs: 5000, what: 'chat 停在 working' });

  await web.stop(); // 轮次仍在飞 → 库中遗留 working

  const restarted = await startWeb(router.socketPath, port, { OAMP_DB: dbPath });
  t.after(() => restarted.stop());
  const detail = await waitFor(async () => {
    const d = await detailOf(restarted, chatId);
    return d && d.chat.state === 'failed' ? d : null;
  }, { timeoutMs: 5000, what: '重启后扫尾置 failed' });
  assert.equal(detail.messages.length, 1, '扫尾不补记录（该轮输出确实缺失）');
  assert.equal(detail.messages[0].direction, 'in');
});

// ────────────────────────── 前端契约（轮询移除 / SSE / 新增控件保留） ──────────────────────────
test('Web：前端契约——轮询消失、SSE 订阅、新控件、@ 与 ! 保留（F08-4）', async (t) => {
  const appJs = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'style.css'), 'utf8');

  assert.doesNotMatch(appJs, /POLL_MS/, '1.5s 轮询代码应消失');
  assert.doesNotMatch(appJs, /setTimeout\(tick/, '轮询 tick 应消失');
  assert.match(appJs, /new EventSource\(`\/api\/stream\?chat_id=/, '应以 EventSource 订阅 SSE');
  assert.match(appJs, /onopen/, '应有 onopen 全量拉取兜底');
  assert.match(appJs, /刷新|refreshChat/, 'onopen 应触发全量拉取');
  assert.match(appJs, /\/api\/chats\//, '详情应读 /api/chats/:id');
  assert.match(appJs, /notice-bar/, '系统提示条渲染应存在');

  assert.match(html, /id="btn-close"/, '应有关闭按钮');
  assert.match(html, /id="model-input"/, '应有模型输入框');
  assert.match(html, /id="one-shot"/, '应有一次开关');
  assert.match(html, /id="mention"/, '@ 补全容器应保留');

  assert.match(css, /\.notice-bar/, '提示条样式应存在');
  assert.match(css, /\.model-input/, '模型输入框样式应存在');

  assert.match(appJs, /currentMentionQuery/, '@ 补全逻辑应保留');
});
