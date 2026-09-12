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
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { diffTopology, createTopologyWatch } from '../src/web.js'; // 0015 pr-002：全局事件判定源与轮询器（直接单测，不起进程）

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
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'deepseek/deepseek-v4-flash';
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

/** 全局事件订阅客户端（0015 pr-002）：/api/events 无参数，与 openSse 同款 fetch + reader 手工解析。 */
async function openEvents(base) {
  const ac = new AbortController();
  const res = await fetch(`${base}/api/events`, { signal: ac.signal });
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
  return { res, events, close: () => ac.abort(), pump };
}

async function setup(t, { env = {}, agentId = 'dev-1', withAgent = true, webEnv = {} } = {}) {
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
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath, ...webEnv });
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

  // 畸形 JSON → 400（客户端错误，不是 502）
  const badJson = await fetch(`${web.base}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
  assert.ok((await badJson.json()).error);

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
  assert.equal(updates[0].data.text, '收', '首片（第一个 chunk）必须到达——少一帧增量即在此暴露');
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

// ────────────────────────── pr-006：首片竞态（登记先于派发） ──────────────────────────
test('Web：派发响应与首个 task.update 同批到达时首片不丢（登记先于派发）', async (t) => {
  // 最坏交错（pr-006 记录的首片竞态）：假节点把 deliver 受理应答与首个 task.update 凑进**同一次写出**
  // （cork/uncork → 单次 writev）→ Router 的帧循环先处理 task.update（同步写出给 web 的 deliver）、
  // 后处理受理应答（其续段是 microtask，send 响应因此晚于 deliver 写出）→ web 侧同一 socket read 内
  // deliver 先于 send 响应到达。修复前：handleDeliver 查不到登记 → 首片被丢弃（SSE 无该 task_update）；
  // 修复后：登记已在派发前完成 → 首片照常上推。后续增量/终态走常规时点，终态落盘两种情况下都成立。
  const { router, web } = await setup(t, { withAgent: false });
  const envelope = (taskId, type, body) => ({
    protocol: 'oamp/1',
    message_id: `tup-${randomUUID()}`,
    type,
    task_id: taskId,
    payload: { content_type: 'application/json', body: JSON.stringify(body) },
  });
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'race-dev',
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      const origin = msg.from.instance_id;
      const taskId = msg.task_id;
      // 首片与受理应答同批 flush（同一次 socket read 到达 Router）
      node.client.send(origin, envelope(taskId, 'task.update', { state: 'working', kind: 'chunk', text: '首片' })).catch(() => {});
      process.nextTick(() => node.client.peer.socket.uncork());
      // 尾片与终态：常规时点（首片是否上推不影响终态落盘）
      setTimeout(() => {
        node.client.send(origin, envelope(taskId, 'task.update', { state: 'working', kind: 'chunk', text: '尾片' })).catch(() => {});
        setTimeout(() => {
          node.client.send(origin, envelope(taskId, 'task.result', { state: 'completed', text: '首片尾片' })).catch(() => {});
        }, 30);
      }, 30);
      return undefined;
    },
  });
  t.after(() => node.stop());

  // 先建 chat（新 chat 的 chat_id 只在 POST 响应中可得），再订阅 SSE 打第二轮
  const first = await sendAndWait(web, { agent_id: 'race-dev', text: '第一轮建 chat' });
  const chatId = first.chatId;

  const sse = await openSse(web.base, chatId);
  t.after(() => sse.close());

  node.client.peer.socket.cork(); // 第二轮：本节点写入先进同批缓冲，受理应答与首片一起 flush
  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'race-dev', text: '竞态第二轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  await waitFor(() => sse.events.some((e) => e.type === 'message' && e.data.message.direction === 'out'), {
    timeoutMs: 8000,
    what: 'SSE message(out)',
  });

  const events = sse.events;
  const updates = events.filter((e) => e.type === 'task_update');
  const idxOut = events.findIndex((e) => e.type === 'message' && e.data.message.direction === 'out');
  assert.ok(updates.length >= 1, `首个 task.update 不应被丢弃（实得 ${updates.length} 条）`);
  assert.equal(updates[0].data.text, '首片', '同批到达的首片必须是第一个 task_update');
  assert.equal(updates[0].data.kind, 'chunk');
  assert.ok(events.map((e) => e.type).lastIndexOf('task_update') < idxOut, '全部 task_update 仍在 message(out) 之前');
  assert.ok(updates.every((u) => u.data.chat_id === chatId && u.data.task_id === sent.body.task_id));
  assert.equal(updates.map((u) => u.data.text).join(''), '首片尾片', '全部增量到达且顺序拼接完整');

  const detail = await detailOf(web, chatId);
  assert.equal(detail.messages.length, 4, '过程增量不入库（该轮仍恰 2 行）');
  assert.equal(detail.messages[3].text, '首片尾片', '增量拼接 = 落盘文本');
});

// ────────────────────────── pr-007：task.result 投递丢失 → web 侧对账补拉 ──────────────────────────
/** task.update / task.result 信封（pr-007 用例自用，与 pr-006 用例同形）。 */
const envelope = (taskId, type, body) => ({
  protocol: 'oamp/1',
  message_id: `${type === 'task.result' ? 'trs' : 'tup'}-${randomUUID()}`,
  type,
  task_id: taskId,
  payload: { content_type: 'application/json', body: JSON.stringify(body) },
});

test('Web：task.result 投递丢失（Router 已终态而 web 未收）→ 对账补落 out + SSE', async (t) => {
  // 复现 pr-007 的间歇缺陷：agent 执行完 + Router 任务表已 completed（recorded），但 result 投递未达 web
  // → 对话缺回复。此处用假节点把终态发给**未注册**的 ghost（Router「recorded」语义：只记任务表、不投递
  // web），从而确定性地构造「web 收不到投递」；修复后由 web 侧对账定时器 queryOnce(router.task_get) 补落。
  const { router, web } = await setup(t, { withAgent: false, webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '200' } });
  const chatId = 'chat-reconcile-lost';
  const sse = await openSse(web.base, chatId);
  t.after(() => sse.close());

  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'lossy-dev',
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      setTimeout(() => {
        node.client
          .send(
            'ghost-node', // 未注册：Router 只记任务表（status=recorded），web 永远收不到这条投递
            envelope(msg.task_id, 'task.result', {
              state: 'completed',
              text: '对账补拉的回复',
              model: 'openai/gpt-5.6-luna',
              duration_ms: 321,
              context_id: 'ctx-reconcile',
              pid: 4242,
            }),
          )
          .catch(() => {});
      }, 30);
      return undefined;
    },
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'lossy-dev', text: '投递丢失轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.messages.some((m) => m.direction === 'out') ? d : null;
    },
    { timeoutMs: 6000, what: '对账定时器补落 out' },
  );

  const detail = await detailOf(web, chatId);
  assert.equal(detail.messages.length, 2, '恰一条 in + 一条 out');
  const out = detail.messages[1];
  assert.equal(out.direction, 'out');
  assert.equal(out.text, '对账补拉的回复', '终态 body 的 text 落盘');
  assert.equal(out.model, 'openai/gpt-5.6-luna');
  assert.equal(out.duration_ms, 321);
  assert.equal(out.error, null);
  assert.deepEqual(out.meta, { context_id: 'ctx-reconcile', pid: 4242 });
  assert.equal(detail.chat.state, 'completed');

  await waitFor(() => sse.events.some((e) => e.type === 'message' && e.data.message.direction === 'out'), {
    timeoutMs: 3000,
    what: 'SSE message(out)',
  });
  await waitFor(() => sse.events.some((e) => e.type === 'chat_state' && e.data.state === 'completed'), {
    timeoutMs: 3000,
    what: 'SSE chat_state(completed)',
  });

  // 幂等：越过多个对账间隔仍恰一条 out（落库后定时器已清、登记已删）
  await new Promise((r) => setTimeout(r, 701));
  assert.equal((await detailOf(web, chatId)).messages.length, 2, '对账不得重复落行');
});

test('Web：对账顺延 + 重复投递都不重复落行（幂等）', async (t) => {
  // 对账首个 tick 落在任务非终态（working）时只顺延重查（不落行）；随后正常投递 + 同一终态被重复投递
  // → 全程仍恰一条 out。
  const { router, web } = await setup(t, { withAgent: false, webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '200' } });
  const chatId = 'chat-reconcile-race';
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'echo-dev',
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      const origin = msg.from.instance_id;
      setTimeout(() => {
        node.client.send(origin, envelope(msg.task_id, 'task.update', { state: 'working', kind: 'stdout', line: '第1片' })).catch(() => {});
        // 终态晚于首个对账 tick（该 tick 读到 working → 顺延，不落行）
        setTimeout(() => {
          node.client.send(origin, envelope(msg.task_id, 'task.result', { state: 'completed' })).catch(() => {});
          setTimeout(() => {
            node.client.send(origin, envelope(msg.task_id, 'task.result', { state: 'completed' })).catch(() => {}); // 重复投递
          }, 60);
        }, 260);
      }, 20);
      return undefined;
    },
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'echo-dev', text: '竞态轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  const detail = await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.messages.some((m) => m.direction === 'out') ? d : null;
    },
    { timeoutMs: 6000, what: '终态落 out' },
  );
  assert.equal(detail.messages[1].text, '第1片', '终态 body 无 text → 用 stdout 增量组装');

  await new Promise((r) => setTimeout(r, 700));
  const after = await detailOf(web, chatId);
  assert.equal(after.messages.length, 2, '对账顺延与重复投递都不得重复落行');
  assert.equal(after.chat.state, 'completed');
});

test('Web：任务时长超过快速预算后，晚到的 task.result 仍能落 out（降频不夺走投递凭据）', async (t) => {
  // 回归：对账快速预算用尽只能降频续查、不能删登记——登记同时是投递入口的认领凭据（handleDeliver 靠它认出
  // task.result），删掉会让长任务（时长 > 上限）的合法终态被静默丢弃、chat 永久 working。
  // 时间轴压缩：间隔 100ms → 6 次上限 ≈ 600ms；任务在 ~1.5s 才回终态（远晚于上限）。
  const { router, web } = await setup(t, { withAgent: false, webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '100', OAMP_WEB_RECONCILE_SLOW_MS: '4000' } });
  const chatId = 'chat-reconcile-overrun';
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'slow-dev',
    heartbeatMs: 500, // 假节点须在 Router 租约（LEASE_ENV 3000ms）内保活，否则 1.5s 的终态 send 会被判 UNREGISTERED
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      const origin = msg.from.instance_id;
      setTimeout(() => {
        node.client.send(origin, envelope(msg.task_id, 'task.result', { state: 'completed', text: '长任务回复' })).catch(() => {});
      }, 1500);
      return undefined;
    },
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'slow-dev', text: '超上限轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  const detail = await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.messages.some((m) => m.direction === 'out') ? d : null;
    },
    { timeoutMs: 3000, what: '超上限任务仍落 out' },
  );
  assert.equal(detail.messages.length, 2, '恰一条 in + 一条 out');
  assert.equal(detail.messages[1].text, '长任务回复', '该 out 来自晚到的投递');
  assert.equal(detail.chat.state, 'completed');
  // slow 间隔 4000ms > 本用例 3s 观察窗 → 断言通过即证明落库来自投递路径（低频续查还在等待中）
  assert.match(web.stderr(), /转入低频续查/, '对账确已转低频续查 → 本用例走的必须是投递路径');
});

test('Web：跨快速预算 + 投递丢失双故障 → 低频续查补落 out（chat 不永久 working）', async (t) => {
  // D-1 回归：快速预算用尽后必须转低频续查而非放弃——任务时长跨预算（> 6×interval）且投递丢失时，
  // 唯一能救回这条 out 的就是低频续查（登记保留 + 继续 query）。修复前（达上限即停）：本用例必红。
  // 时间轴压缩：interval 100ms（预算 ≈600ms）+ slow 300ms；任务 ~1.2s 才在 Router 终态，且终态只发给 ghost。
  const { router, web } = await setup(t, { withAgent: false, webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '100', OAMP_WEB_RECONCILE_SLOW_MS: '300' } });
  const chatId = 'chat-reconcile-slow';
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'slow-lossy-dev',
    heartbeatMs: 500,
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      setTimeout(() => {
        // 终态只发给未注册 ghost：web 收不到投递（双故障的第二重）
        node.client.send('ghost-node', envelope(msg.task_id, 'task.result', { state: 'completed', text: '低频续查补落' })).catch(() => {});
      }, 1200);
      return undefined;
    },
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'slow-lossy-dev', text: '双故障轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  const detail = await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.messages.some((m) => m.direction === 'out') ? d : null;
    },
    { timeoutMs: 6000, what: '低频续查补落 out' },
  );
  assert.equal(detail.messages.length, 2, '恰一条 in + 一条 out');
  assert.equal(detail.messages[1].text, '低频续查补落');
  assert.equal(detail.chat.state, 'completed');
  assert.match(web.stderr(), /转入低频续查/, '必然发生过"转低频续查"（快速预算已用尽）');
  assert.match(web.stderr(), /转 1s\/次/, '间隔文案下限 1s（slow=300ms 也不得显示成 "0s/次"）');
  assert.doesNotMatch(web.stderr(), /对账放弃/, '"放弃"语义已取消');
});

test('Web：登记软 TTL 到期清理 + 恰一条 warn（防孤儿条目常驻）', async (t) => {
  // D-2：任务永不终态 + 投递丢失（最坏孤儿场景）时，登记须在软 TTL 后清理且只 warn 一条（不刷屏）。
  const { router, web } = await setup(t, {
    withAgent: false,
    webEnv: { OAMP_WEB_RECONCILE_INTERVAL_MS: '100', OAMP_WEB_RECONCILE_SLOW_MS: '200', OAMP_WEB_RECONCILE_TTL_MS: '700' },
  });
  const chatId = 'chat-reconcile-ttl';
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'dead-dev',
    heartbeatMs: 500,
    onDeliver: () => undefined, // 永不回终态
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dead-dev', text: '孤儿登记轮' });
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);

  await waitFor(() => /对账登记超时清理/.test(web.stderr()), { timeoutMs: 5000, what: 'TTL 清理 warn' });
  await new Promise((r) => setTimeout(r, 600)); // 再等数个（低频）轮询间隔
  assert.equal((web.stderr().match(/对账登记超时清理/g) || []).length, 1, 'TTL 清理 warn 只一条（不刷屏）');
  const detail = await detailOf(web, chatId);
  assert.equal(detail.messages.filter((m) => m.direction === 'out').length, 0, '未终态不得落 out');
  assert.equal(detail.chat.state, 'working', '未终态保持 working');
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
  assert.match(appJs, /source\.onopen\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,200}refreshChat\(\)/, 'onopen 应触发全量拉取');
  assert.match(appJs, /\/api\/chats\//, '详情应读 /api/chats/:id');
  assert.match(appJs, /notice-bar/, '系统提示条渲染应存在');

  assert.match(html, /id="btn-close"/, '应有关闭按钮');
  assert.match(html, /id="model-input"/, '应有模型输入框');
  assert.match(html, /id="one-shot"/, '应有一次开关');
  assert.match(html, /id="mention"/, '@ 补全容器应保留');

  assert.match(css, /\.notice-bar/, '提示条样式应存在');
  assert.match(css, /\.model-input/, '模型输入框样式应存在');

  assert.match(appJs, /currentMentionQuery/, '@ 补全逻辑应保留');

  // 0014（pr-002）：详情头标题行内编辑的静态契约（AR-01 / AR-07 / AR-08）
  assert.match(html, /id="detail-title-input"/, '详情头应有静态孪生编辑框');
  assert.match(html, /maxlength="100"/, '编辑框应有声明式长度上限 100（AR-07）');
  assert.match(appJs, /isReadonly/, '前端应提取具名只读谓词（AR-08 不分叉）');
  assert.match(appJs, /titleEdit/, '前端应有标题编辑态（AR-01）');
  assert.match(css, /\.detail-title-input/, '编辑框样式应存在');
  assert.match(css, /\.detail-head h1\.hidden\s*\{[^}]*display:\s*none/, '编辑态 h1 应真正隐藏（.hidden 对 h1 无既有规则，须独立规则）');
});

// ────────────────────────── pr-008：working 等待计时（静态契约） ──────────────────────────
// 背景：reasoning 模型静默思考期无 task_update（实测首 token 242s），UI 只有 working → 用户误判卡死。
test('Web：前端契约——working 等待计时 + 慢模型提示（pr-008）', async (t) => {
  const appJs = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'style.css'), 'utf8');

  assert.match(appJs, /const SLOW_HINT_MS = 30000;/, '慢模型提示阈值应为 30000ms 常量');
  assert.match(appJs, /思考中 · 已等待/, '状态行应显示「思考中 · 已等待 Ns」');
  assert.match(appJs, /id="wait-elapsed"/, '计时文本应有稳定锚点（每秒只改它）');
  assert.match(appJs, /setInterval\(tickWait, WAIT_TICK_MS\)/, '应以 1s 定时器刷新计时');
  assert.match(appJs, /clearInterval\(waitTimer\)/, '停表应 clearInterval（不留常驻定时器）');
  assert.match(appJs, /chat\.state === 'working'/, '计时仅在 working 期间');
  assert.match(appJs, /当前模型首 token 可能较慢/, '应提示慢模型可换更快模型');
  assert.match(appJs, /created_at/, '起点应优先取消息落库时刻');

  assert.match(css, /\.status-line \.waiting/, '等待计时样式应存在');
  assert.match(css, /\.slow-hint/, '慢模型提示样式应存在');
});

// ────────────────────────── 0013：批量归档 / 归档视图 / 激活（F01~F05） ──────────────────────────
test('Web：批量归档——三键响应 / 范围与幂等 / 归档视图查询与 400 / 只读双路径（F01-2/4/6/8、F02-1/2/3/4、F03-2/3）', async (t) => {
  const { web } = await setup(t);

  const done = await sendAndWait(web, { agent_id: 'dev-1', text: '归档用例 已完成' });
  const closed = await sendAndWait(web, { agent_id: 'dev-1', text: '归档用例 已关闭' });
  const closeResp = await jpost(web.base, `/api/chats/${encodeURIComponent(closed.chatId)}/close`, {});
  assert.equal(closeResp.status, 200);

  // 只读双路径·既有 closed 分支：未归档时文案与状态码逐字不变（AR-17）
  const closedRej = await jpost(web.base, '/api/messages', { chat_id: closed.chatId, agent_id: 'dev-1', text: '关闭后提交' });
  assert.equal(closedRej.status, 409);
  assert.equal(closedRej.body.error, 'chat 已关闭，不接受新输入');

  const first = await jpost(web.base, '/api/chats/archive', {});
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.body).sort(), ['archived', 'failed', 'failed_ids'], '三键恒存在');
  assert.deepEqual(first.body, { archived: 2, failed: 0, failed_ids: [] }, 'completed 与 closed 两条都落入范围');

  // 归档不改变原状态（F02-1）；置位 context_released（F02-7 / F05-6 驱动源）
  const doneDetail = await detailOf(web, done.chatId);
  const closedDetail = await detailOf(web, closed.chatId);
  assert.ok(Number.isInteger(doneDetail.chat.archived_at) && Number.isInteger(closedDetail.chat.archived_at));
  assert.equal(doneDetail.chat.state, 'completed');
  assert.equal(closedDetail.chat.state, 'closed');
  assert.equal(doneDetail.chat.context_released, 1);
  assert.equal(closedDetail.chat.context_released, 1);

  // 视图互斥：主列表不含已归档，归档视图只含已归档（F03-2）
  const main = await jget(web.base, '/api/chats');
  assert.equal(main.body.total, 0);
  assert.deepEqual(main.body.chats, []);
  const view = await jget(web.base, '/api/chats?archived=1&limit=200&offset=0');
  assert.equal(view.body.total, 2);
  assert.deepEqual(view.body.chats.map((c) => c.chat_id).sort(), [closed.chatId, done.chatId].sort());
  const times = view.body.chats.map((c) => c.archived_at);
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i - 1] >= times[i], '归档视图按归档时间倒序（F03-3）');
  assert.ok(view.body.chats.every((c) => Number.isInteger(c.archived_at)), '列表项含可读的归档时间（F03-4/7）');

  // 续页：同一 total、无重复（F04-1/4）
  const page = await jget(web.base, '/api/chats?archived=1&limit=1&offset=1');
  assert.equal(page.body.total, 2);
  assert.equal(page.body.chats.length, 1);
  assert.notEqual(page.body.chats[0].chat_id, view.body.chats[0].chat_id);

  // 幂等：已归档项不进候选，归档时间不被改动（F01-4 / F02-2 后半）
  const again = await jpost(web.base, '/api/chats/archive', {});
  assert.deepEqual(again.body, { archived: 0, failed: 0, failed_ids: [] });
  assert.equal((await detailOf(web, done.chatId)).chat.archived_at, doneDetail.chat.archived_at);
  assert.equal((await detailOf(web, closed.chatId)).chat.archived_at, closedDetail.chat.archived_at);

  // 非法 archived → 400（§5.2）
  const bad = await jget(web.base, '/api/chats?archived=2');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /archived/);

  // 只读双路径·归档分支：completed 与 closed 来源都拒收，且归档分支优先；被拒不落 in 记录（F02-3/4）
  const rej = await jpost(web.base, '/api/messages', { chat_id: done.chatId, agent_id: 'dev-1', text: '归档后提交' });
  assert.equal(rej.status, 409);
  assert.equal(rej.body.error, 'chat 已归档（只读），不接受新输入');
  const rejBoth = await jpost(web.base, '/api/messages', { chat_id: closed.chatId, agent_id: 'dev-1', text: '归档后提交' });
  assert.equal(rejBoth.status, 409);
  assert.equal(rejBoth.body.error, 'chat 已归档（只读），不接受新输入', '同时命中时归档分支优先');
  assert.equal((await detailOf(web, done.chatId)).messages.length, 2, '被拒提交不产生新记录');
});

test('Web：批量归档——进行中对话不动 / 零可归档项仍有反馈（F01-2/8、M-01、E-5）', async (t) => {
  const { web } = await setup(t, { env: { FAKE_ACP_HANG: '1' } }); // 挂起 agent：该轮停在 working

  const sent = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '进行中的对话' });
  assert.equal(sent.status, 200);
  const chatId = sent.body.chat_id;
  await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.chat.state === 'working' ? d : null;
    },
    { timeoutMs: 5000, what: 'chat 停在 working' },
  );

  const r = await jpost(web.base, '/api/chats/archive', {});
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { archived: 0, failed: 0, failed_ids: [] }, '零可归档项仍给出反馈（不静默）');

  const detail = await detailOf(web, chatId);
  assert.equal(detail.chat.state, 'working', '进行中对话状态不变');
  assert.equal(detail.chat.archived_at, null);
  const main = await jget(web.base, '/api/chats');
  assert.equal(main.body.total, 1, '进行中对话仍留在主列表');
});

test('Web：批量归档——逐条向该 chat 涉及 agent 发 context_release（F02-7 / AR-07）', async (t) => {
  // 判定面 = 假节点侧观察到 notice{kind:'context_release', chat_id}（不依赖 agent 的 SSE 回发）
  const { router, web } = await setup(t, { withAgent: false });
  const node = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'dev-1',
    heartbeatMs: 500,
    onDeliver: (msg) => {
      if (msg.type !== 'task.request') return undefined;
      node.client.send(msg.from.instance_id, envelope(msg.task_id, 'task.result', { state: 'completed', text: '完成', duration_ms: 1 })).catch(() => {});
      return undefined;
    },
  });
  t.after(() => node.stop());

  const sent = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '释放观察轮' });
  assert.equal(sent.status, 200);
  const chatId = sent.body.chat_id;
  await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      return d && d.chat.state === 'completed' ? d : null;
    },
    { timeoutMs: 5000, what: 'chat 落 completed' },
  );

  const r = await jpost(web.base, '/api/chats/archive', {});
  assert.equal(r.body.archived, 1);

  const notice = await waitFor(
    () => node.received.find((m) => m.type === 'notice' && JSON.parse(m.payload.body).kind === 'context_release') || null,
    { timeoutMs: 5000, what: '假 agent 收到 context_release' },
  );
  assert.equal(JSON.parse(notice.payload.body).chat_id, chatId);
});

test('Web：激活——200 / 置顶 / 归档视图移除 / closed 还原 / 409 / 404（F05-1/3/4/5/7/8）', async (t) => {
  const { web } = await setup(t);

  const a = await sendAndWait(web, { agent_id: 'dev-1', text: '激活用例 A 已完成' });
  const b = await sendAndWait(web, { agent_id: 'dev-1', text: '激活用例 B 已关闭' });
  await jpost(web.base, `/api/chats/${encodeURIComponent(b.chatId)}/close`, {});

  // 非归档的 closed 不可重开（N-5 / F05-8）
  const notArchived = await jpost(web.base, `/api/chats/${encodeURIComponent(b.chatId)}/activate`, {});
  assert.equal(notArchived.status, 409);
  assert.equal(notArchived.body.error, 'chat 未归档，无法激活');

  await jpost(web.base, '/api/chats/archive', {});
  const archA = (await detailOf(web, a.chatId)).chat.archived_at;
  assert.ok(Number.isInteger((await detailOf(web, b.chatId)).chat.archived_at), '激活前该条已归档');

  const act = await jpost(web.base, `/api/chats/${encodeURIComponent(b.chatId)}/activate`, {});
  assert.equal(act.status, 200);
  assert.deepEqual(act.body, { chat_id: b.chatId, state: 'completed' });

  const detail = await detailOf(web, b.chatId);
  assert.equal(detail.chat.archived_at, null, '标记被移除');
  assert.equal(detail.chat.state, 'completed', 'closed 来源 → completed（F05-4）');
  assert.equal(detail.chat.closed_at, null, '关闭时间被清除');
  assert.equal(detail.chat.context_released, 1, '激活不改该列（提示判据仍成立；F05-5/N-4）');

  const main = await jget(web.base, '/api/chats');
  assert.equal(main.body.chats[0].chat_id, b.chatId, '激活后立即置顶（F05-3 / D-9）');
  const view = await jget(web.base, '/api/chats?archived=1');
  assert.equal(view.body.total, 1, '归档视图不再含它（F05-1）');
  assert.deepEqual(view.body.chats.map((c) => c.chat_id), [a.chatId]);
  assert.equal((await detailOf(web, a.chatId)).chat.archived_at, archA, '单条激活不波及其他归档项（F05-7）');

  // 重复激活 → 409；未知 chat → 404
  const again = await jpost(web.base, `/api/chats/${encodeURIComponent(b.chatId)}/activate`, {});
  assert.equal(again.status, 409);
  const unknown = await jpost(web.base, '/api/chats/chat-does-not-exist/activate', {});
  assert.equal(unknown.status, 404);

  // 激活后可继续对话（F05-2）；产生新回答即复位 context_released（F05-6 提示条的消失时机）
  const round2 = await sendAndWait(web, { chat_id: b.chatId, agent_id: 'dev-1', text: '激活后继续' }, { rounds: 2 });
  assert.equal(round2.detail.chat.context_released, 0, '新回答落库即复位');
  assert.equal(round2.detail.chat.archived_at, null);
});

test('Web：前端静态契约——归档标签 / 归档全部 / 归档视图分页 / 激活按钮 / 提示条（F01-1/5、F03-1/4/5/6、F04-3/5、F05-6）', async (t) => {
  const appJs = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'style.css'), 'utf8');

  assert.match(html, /data-filter="archived">归档</, '过滤栏应有第 4 颗「归档」标签');
  assert.match(html, /id="btn-archive-all"[^>]*>归档全部</, '「归档全部」按钮文案固定');
  assert.match(html, /id="chat-list"[\s\S]*id="load-more-slot"/, '「加载更多」槽应位于 #chat-list 之后');

  assert.match(appJs, /const ARCHIVE_PAGE_SIZE = 200;/, '归档首屏 = 续页 = API 上限 200');
  assert.match(appJs, /\/api\/chats\?archived=1&limit=\$\{ARCHIVE_PAGE_SIZE\}&offset=\$\{offset\}/, '归档视图走 archived=1 + offset 续页');
  assert.match(appJs, /const ARCHIVE_CONFIRM_TEXT = '将归档全部非进行中的对话，是否继续？';/, '确认文案逐字（A-9）');
  assert.match(appJs, /window\.confirm\(ARCHIVE_CONFIRM_TEXT\)/, '批量归档前应有一次轻确认');
  assert.match(appJs, /\.activate'\)\.onclick = \(e\) => \{\s*e\.stopPropagation\(\)/, '激活按钮点击不得触发行打开');
  assert.match(appJs, /state\.archive\.chats\.length < state\.archive\.total/, '「加载更多」仅在确有更多时渲染');
  assert.match(appJs, /chat\.archived_at === null && chat\.context_released === 1/, '提示条判据 = 非归档 ∧ 上下文已释放未产生新回答');
  assert.match(appJs, /激活后上下文已重置，本对话后续回复不再记得此前内容/, '提示文案');
  assert.match(appJs, /chat\.state === 'closed' \|\| chat\.archived_at !== null/, '归档对话的关闭按钮禁用');

  assert.match(css, /\.archive-all/, '「归档全部」样式应存在');
  assert.match(css, /\.load-more/, '「加载更多」样式应存在');
  assert.match(css, /\.chat-item \.activate/, '归档行「激活」按钮样式应存在');
});

// ────────────────────────── 0014：改名 API（pr-002 / F01~F05、AR-02/06/08） ──────────────────────────
test('Web：改名——200 权威标题 / 详情与列表同步 / 不置顶（updated_at 与列表顺序不变）（F01、F04-4/5）', async (t) => {
  const { web } = await setup(t);

  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '改名用例 甲' });
  const second = await sendAndWait(web, { agent_id: 'dev-1', text: '改名用例 乙' });
  const before = (await jget(web.base, '/api/chats')).body;
  const beforeOrder = before.chats.map((c) => c.chat_id);
  const beforeRow = before.chats.find((c) => c.chat_id === first.chatId);
  assert.ok(beforeRow, '改名前该条应在主列表');

  const renamed = await jpost(web.base, `/api/chats/${encodeURIComponent(first.chatId)}/rename`, { title: '  季度复盘  ' });
  assert.equal(renamed.status, 200);
  assert.deepEqual(renamed.body, { chat_id: first.chatId, title: '季度复盘' }, '响应 = trim 后的权威标题');

  const detail = await detailOf(web, first.chatId);
  assert.equal(detail.chat.title, '季度复盘', 'GET /api/chats/<id> 与库值一致（权威值）');
  assert.equal(detail.chat.updated_at, beforeRow.updated_at, 'updated_at 逐字不变（不置顶，F04-5）');
  assert.equal(detail.chat.agent_id, beforeRow.agent_id, '所属 agent 不变');
  assert.equal(detail.chat.state, beforeRow.state, '状态不变');
  assert.equal(detail.chat.archived_at, null, '归档标记不变');

  const after = (await jget(web.base, '/api/chats')).body;
  assert.deepEqual(after.chats.map((c) => c.chat_id), beforeOrder, '改名不改变列表 chat_id 顺序（F04-4）');
  assert.equal(after.chats.find((c) => c.chat_id === first.chatId).title, '季度复盘');
  assert.equal(after.chats.find((c) => c.chat_id === second.chatId).title, '改名用例 乙', '其他条目不受影响');
});

test('Web：改名——校验 400 全表（非字符串 / 空体 / 空 / 全空白 / 101 单位）且读回标题不变（F02-6）', async (t) => {
  const { web } = await setup(t);

  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '校验用例 原标题' });
  const url = `/api/chats/${encodeURIComponent(chatId)}/rename`;

  const cases = [
    [{ title: 123 }, /需为字符串/],
    [{}, /需为字符串/],
    [{ title: null }, /需为字符串/],
    [{ title: '' }, /不能为空或全为空白/],
    [{ title: '   ' }, /不能为空或全为空白/],
    [{ title: 'x'.repeat(101) }, /长度需 <= 100（当前 101）/],
  ];
  for (const [payload, re] of cases) {
    const r = await jpost(web.base, url, payload);
    assert.equal(r.status, 400, `${JSON.stringify(payload)} 应 400`);
    assert.match(r.body.error, re);
    assert.equal((await detailOf(web, chatId)).chat.title, '校验用例 原标题', '被拒后读回标题不变（不落库）');
  }
});

test('Web：改名——404 / 409 双路径（关闭优先于归档时点 / 归档后）且库值不变（F03-1/2）', async (t) => {
  const { web } = await setup(t);

  const closed = await sendAndWait(web, { agent_id: 'dev-1', text: '改名只读 关闭' });
  const arch = await sendAndWait(web, { agent_id: 'dev-1', text: '改名只读 归档' });
  assert.equal((await jpost(web.base, `/api/chats/${encodeURIComponent(closed.chatId)}/close`, {})).status, 200);

  // 未归档的 closed → 409「已关闭」（D-7：closed 不可改）
  const cls = await jpost(web.base, `/api/chats/${encodeURIComponent(closed.chatId)}/rename`, { title: '关闭后改名' });
  assert.equal(cls.status, 409);
  assert.match(cls.body.error, /已关闭/);
  assert.equal((await detailOf(web, closed.chatId)).chat.title, '改名只读 关闭', '被拒后库值不变');

  const unknown = await jpost(web.base, '/api/chats/chat-does-not-exist/rename', { title: '任意' });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error, 'chat 不存在: chat-does-not-exist', '与 /close、/activate 逐字同形');

  // 归档 → 409「已归档」（归档分支优先出文案）
  assert.equal((await jpost(web.base, '/api/chats/archive', {})).status, 200);
  const arc = await jpost(web.base, `/api/chats/${encodeURIComponent(arch.chatId)}/rename`, { title: '归档后改名' });
  assert.equal(arc.status, 409);
  assert.match(arc.body.error, /已归档/);
  assert.equal((await detailOf(web, arch.chatId)).chat.title, '改名只读 归档', '被拒后库值不变');
});

test('Web：改名——只读不分叉（改名 409 与发消息 409 同真）+ 畸形 JSON 400 / 超限 413（F03-3）', async (t) => {
  const { web } = await setup(t);

  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '不分叉 用例' });
  await jpost(web.base, '/api/chats/archive', {});

  const renameRej = await jpost(web.base, `/api/chats/${encodeURIComponent(chatId)}/rename`, { title: 'X' });
  const sendRej = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: 'X' });
  assert.equal(renameRej.status, 409);
  assert.equal(sendRej.status, 409);

  // 读体先于预检（§5.2 固定处理顺序）：畸形 JSON → 400
  const badJson = await fetch(`${web.base}/api/chats/${encodeURIComponent(chatId)}/rename`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
  assert.match((await badJson.json()).error, /请求体非法 JSON/);

  const tooLarge = await fetch(`${web.base}/api/chats/${encodeURIComponent(chatId)}/rename`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.headers.get('connection'), 'close', '超限应答应关闭连接（逐字同形）');
  assert.match((await tooLarge.json()).error, /请求体过大/);
});

test('Web：改名——改名后再发消息标题保持手动值（F05-4 / E-10）', async (t) => {
  const { web } = await setup(t);

  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '手动标题 原始首条输入' });
  const renamed = await jpost(web.base, `/api/chats/${encodeURIComponent(chatId)}/rename`, { title: '手动标题 固定值' });
  assert.equal(renamed.status, 200);

  const round2 = await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '第二条完全不同的输入' }, { rounds: 2 });
  assert.equal(round2.detail.chat.title, '手动标题 固定值', '后续输入不改手动标题（ensureChat DO NOTHING，C-4）');
});

// ────────────────────────── 0015 pr-002：全局事件流（F05 / 硬契约 ②） ──────────────────────────
test('Web：diffTopology——新增带 last_heartbeat / 消失只带 instance_id / 墓碑不进基线（F05-2）', () => {
  const prev = new Map([['dev-1', 1000]]);
  const nodes = [
    { instance_id: 'dev-1', session_id: 's1', state: 'online', last_heartbeat: 2000 },
    { instance_id: 'dev-2', session_id: 's2', state: 'online', last_heartbeat: 3000 },
    { instance_id: 'dev-3', session_id: 's3', state: 'offline', last_heartbeat: 500 }, // offline 墓碑
  ];
  const { online, offline, next } = diffTopology(prev, nodes);
  assert.deepEqual(online, [{ instance_id: 'dev-2', last_heartbeat: 3000 }]);
  assert.deepEqual(offline, []);
  assert.deepEqual([...next.entries()], [['dev-1', 2000], ['dev-2', 3000]], '基线只含 online 实例（墓碑不进入）');

  // 心跳刷新（同一实例仍在基线）不产生任何事件
  const steady = diffTopology(next, [
    { instance_id: 'dev-1', session_id: 's1', state: 'online', last_heartbeat: 2000 },
    { instance_id: 'dev-2', session_id: 's2', state: 'online', last_heartbeat: 9999 },
  ]);
  assert.deepEqual(steady.online, []);
  assert.deepEqual(steady.offline, []);

  const gone = diffTopology(steady.next, [{ instance_id: 'dev-2', session_id: 's2', state: 'online', last_heartbeat: 9999 }]);
  assert.deepEqual(gone.offline, [{ instance_id: 'dev-1' }], '消失项只带 instance_id');
  assert.deepEqual(gone.online, []);
});

test('Web：createTopologyWatch——无订阅者零轮询 / 播种不发事件 / 订阅者归零后 tick 自停（F05-1/2）', async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const published = [];
  let globalCount = 0;
  let nodes = [];
  let queries = 0;
  const transport = { globalCount: () => globalCount, publishGlobal: (e) => published.push(e) };
  const watch = createTopologyWatch({
    transport,
    queryNodes: async () => {
      queries += 1;
      return nodes;
    },
    pollMs: 20,
  });
  try {
    // 无订阅者：不起表、零查询（"无订阅者时零开销"）
    watch.ensureRunning();
    await delay(120);
    assert.equal(queries, 0, '无全局订阅者时零轮询');

    // 首个订阅者：播种基线（只记 prev，不发事件）
    globalCount = 1;
    nodes = [{ instance_id: 'dev-1', session_id: 's1', state: 'online', last_heartbeat: 1 }];
    watch.ensureRunning();
    await waitFor(() => queries >= 1, { timeoutMs: 2000, what: '播种查询' });
    await delay(100);
    assert.deepEqual(published, [], '首个订阅者播种基线不得发事件');

    // 真实变化 ⇒ 上下线事件
    nodes = [
      { instance_id: 'dev-1', session_id: 's1', state: 'online', last_heartbeat: 1 },
      { instance_id: 'dev-2', session_id: 's2', state: 'online', last_heartbeat: 2 },
    ];
    await waitFor(() => published.some((e) => e.type === 'agent_online' && e.data.instance_id === 'dev-2'), {
      timeoutMs: 2000,
      what: 'agent_online',
    });
    nodes = [{ instance_id: 'dev-2', session_id: 's2', state: 'online', last_heartbeat: 2 }];
    await waitFor(() => published.some((e) => e.type === 'agent_offline' && e.data.instance_id === 'dev-1'), {
      timeoutMs: 2000,
      what: 'agent_offline',
    });

    // 订阅者归零：下一个 tick 自停（此后查询数不再增长）
    globalCount = 0;
    await waitFor(() => queries > 0, { timeoutMs: 1000, what: '至少一次查询' });
    await delay(120); // 保证 tick 已观察到 globalCount === 0 并停表
    const settled = queries;
    await delay(200);
    assert.equal(queries, settled, '订阅者归零后 tick 自停（不再拉 router.status）');
  } finally {
    watch.stop();
  }
});

test('Web：全局事件流 /api/events——播种不发事件 / 起 agent 收 agent_online / 停 agent 收 agent_offline（F05-1/2/4）', async (t) => {
  // 无 agent 起送：首个订阅者播种基线 ⇒ 基线为空；随后起停 dev-2 观察两个方向的事件
  const { router, web } = await setup(t, { withAgent: false, webEnv: { OAMP_WEB_TOPOLOGY_POLL_MS: '50' } });
  const stream = await openEvents(web.base);
  t.after(() => stream.close());

  assert.equal(stream.res.status, 200, '无参数订阅应成功（不因缺少对话标识被拒）');
  assert.match(stream.res.headers.get('content-type'), /text\/event-stream/, '应为 SSE');
  await new Promise((r) => setTimeout(r, 200)); // 数个 tick（50ms/次）：播种基线不得产生"虚报上线"
  assert.equal(stream.events.length, 0, '首个订阅者播种基线不得发事件');

  const agent = await startAgent('dev-2', { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: FAKE_BIN } });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-2/);
  const online = await waitFor(() => stream.events.find((e) => e.type === 'agent_online' && e.data.instance_id === 'dev-2'), {
    timeoutMs: 5000,
    what: 'agent_online（5s 判定界内，轮询 50ms）',
  });
  assert.equal(typeof online.data.last_heartbeat, 'number', '载荷含 last_heartbeat');

  await agent.stop();
  const offline = await waitFor(() => stream.events.find((e) => e.type === 'agent_offline' && e.data.instance_id === 'dev-2'), {
    timeoutMs: 5000,
    what: 'agent_offline',
  });
  assert.deepEqual(Object.keys(offline.data), ['instance_id'], '下线载荷只需 instance_id');
  assert.ok(
    !stream.events.some((e) => ['message', 'task_update', 'chat_state', 'notice'].includes(e.type)),
    '全局订阅不得收到对话类事件（键隔离）',
  );
  assert.ok(agent.getExitInfo() !== null, 'agent 已退出（下线方向确实由真实注销触发）');
});

// ────────────────────────── 0015 pr-002：GET /api/agents?state=online（F04-1/2/4） ──────────────────────────
test('Web：GET /api/agents?state=online——同形状 / 逐项 online / 无参逐字透传 / 非法值 400（F04-1/2/4）', async (t) => {
  const { web } = await setup(t);

  const all = await jget(web.base, '/api/agents');
  const only = await jget(web.base, '/api/agents?state=online');
  assert.equal(all.status, 200);
  assert.equal(only.status, 200);
  assert.deepEqual(Object.keys(only.body), Object.keys(all.body), '与无参响应同形状');
  for (const a of all.body.agents) {
    assert.deepEqual(Object.keys(a).sort(), ['instance_id', 'last_heartbeat', 'session_id', 'state'], '无参仍逐字透传 4 字段');
  }
  assert.ok(only.body.agents.every((a) => a.state === 'online'), '过滤结果逐项 online');
  assert.deepEqual(
    only.body.agents.map((a) => a.instance_id),
    all.body.agents.filter((a) => a.state === 'online').map((a) => a.instance_id),
    '与前端同一口径（同源同谓词）',
  );

  const bad = await jget(web.base, '/api/agents?state=offline');
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body).sort(), ['code', 'error']);
  assert.equal(bad.body.code, 'INVALID_PARAM');
  assert.equal(typeof bad.body.error, 'string');

  const emptyValue = await jget(web.base, '/api/agents?state=');
  assert.equal(emptyValue.status, 200, '空值视为无参（不 400）');
});

// ────────────────────────── 0015 pr-002：统一错误契约（F06 / 硬契约 ③） ──────────────────────────
test('Web：统一错误契约——5 码一一映射 / 键集合恰为 {error,code} / 文案逐字不变 / 成功无 code（F06-1/2/3/4）', async (t) => {
  const { router, web } = await setup(t);
  const { chatId } = await sendAndWait(web, { agent_id: 'dev-1', text: '错误契约用例' });

  const keysOf = (body) => Object.keys(body).sort();
  const errKeys = ['code', 'error'];

  // INVALID_PARAM 400：两个不同接口
  const badParam = await jget(web.base, '/api/chats?limit=0');
  const noAgent = await jpost(web.base, '/api/messages', { text: 'echo 缺 agent' });
  for (const r of [badParam, noAgent]) {
    assert.equal(r.status, 400);
    assert.deepEqual(keysOf(r.body), errKeys, '错误体键集合恰为 {error, code}');
    assert.equal(r.body.code, 'INVALID_PARAM');
    assert.equal(typeof r.body.error, 'string');
    assert.ok(r.body.error.length > 0, 'error 可读非空');
  }

  // NOT_FOUND 404：两个不同接口（详情 / 改名），文案逐字
  const missingChat = await jget(web.base, '/api/chats/chat-nope');
  const missingRename = await jpost(web.base, '/api/chats/chat-nope/rename', { title: 'x' });
  for (const r of [missingChat, missingRename]) {
    assert.equal(r.status, 404);
    assert.deepEqual(keysOf(r.body), errKeys);
    assert.equal(r.body.code, 'NOT_FOUND');
  }
  assert.equal(missingChat.body.error, 'chat 不存在: chat-nope', '既有文案逐字不变');

  // CONFLICT 409：同一只读真源的两个接口（改名 / 发消息），文案各自逐字
  await jpost(web.base, '/api/chats/archive', {});
  const renameRej = await jpost(web.base, `/api/chats/${encodeURIComponent(chatId)}/rename`, { title: 'x' });
  const sendRej = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: 'x' });
  for (const r of [renameRej, sendRej]) {
    assert.equal(r.status, 409);
    assert.deepEqual(keysOf(r.body), errKeys);
    assert.equal(r.body.code, 'CONFLICT');
  }
  assert.equal(renameRej.body.error, 'chat 已归档（只读），不可改名', '既有文案逐字不变');
  assert.equal(sendRej.body.error, 'chat 已归档（只读），不接受新输入', '既有文案逐字不变');

  // PAYLOAD_TOO_LARGE 413：仍带 connection: close
  const tooLarge = await fetch(`${web.base}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent_id: 'dev-1', text: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.headers.get('connection'), 'close', '超限应答应关闭连接（逐字同形）');
  const tooLargeBody = await tooLarge.json();
  assert.deepEqual(keysOf(tooLargeBody), errKeys);
  assert.equal(tooLargeBody.code, 'PAYLOAD_TOO_LARGE');
  assert.match(tooLargeBody.error, /请求体过大/);

  // UPSTREAM_UNAVAILABLE 502：Router 不可达
  await router.stop();
  const down = await jget(web.base, '/api/agents');
  assert.equal(down.status, 502);
  assert.deepEqual(keysOf(down.body), errKeys);
  assert.equal(down.body.code, 'UPSTREAM_UNAVAILABLE');
  assert.match(down.body.error, /router 不可达或请求失败/, '既有兜底文案逐字不变');

  // 成功响应不含 code
  const ok = await jget(web.base, '/api/chats');
  assert.equal(ok.status, 200);
  assert.ok(!('code' in ok.body), '成功响应不加 code');
});

// ────────────────────────── 0015 pr-002：前端静态契约（F01 / F02 / AR-01 / AR-02） ──────────────────────────
test('Web：前端静态契约——顶栏 agent 列表（#agent-panel / 全局事件订阅 / 展开期刷新 / 零启停入口）（F01-1~5、F02-1~5）', async (t) => {
  const appJs = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'style.css'), 'utf8');

  assert.match(html, /id="conn-status"[\s\S]*id="agent-panel"/, '#agent-panel 应是 #conn-status 之后的静态兄弟节点');
  assert.match(html, /<div id="agent-panel" class="agent-panel hidden"><\/div>/, '面板应为静态空节点（不动态创建）');

  assert.match(appJs, /state\.agentPanel/, '面板开合态');
  assert.match(appJs, /function renderAgentPanel\(\)/, '面板渲染函数');
  assert.match(appJs, /function fmtAgo\(ms\)/, '相对时间函数');
  assert.match(appJs, /\$\('conn-status'\)\.onclick = toggleAgentPanel/, '顶栏计数绑定开合');
  assert.match(appJs, /e\.key === 'Escape' && state\.agentPanel\.open/, 'Esc 收起');
  assert.match(appJs, /e\.target\.closest\('#agent-panel, #conn-status'\)/, '点外收起（带触发器守卫）');
  assert.match(appJs, /if \(!ok\) closeAgentPanel\(\);/, '断连自动收起');
  assert.match(appJs, /暂无在线 agent/, '空态文案');
  assert.match(appJs, /const AGENT_PANEL_REFRESH_MS = 5000;/, '展开期刷新间隔 = 5000ms');
  assert.match(appJs, /agentPanelTimer = setInterval\(/, '展开期挂刷新表');
  assert.match(appJs, /clearInterval\(agentPanelTimer\)/, '收起即清表（不留常驻定时器）');
  assert.match(appJs, /state\.agents\.filter\(\(a\) => a\.state === 'online'\)/, '只列在线实例');
  assert.match(appJs, /new EventSource\('\/api\/events'\)/, '页面打开即订阅全局事件流');
  assert.match(appJs, /addEventListener\('agent_online'/, '消费上线事件（增量 upsert）');
  assert.match(appJs, /addEventListener\('agent_offline'/, '消费下线事件（增量移除）');
  assert.match(appJs, /es\.onopen = \(\) => loadAgents\(\)/, 'onopen 全量重新对齐（MI-05）');
  assert.match(appJs, /const \{ agents \} = await api\('\/api\/agents'\)/, 'loadAgents 仍取全量（@ 补全离线可见性不变）');

  assert.match(css, /\.topright\s*\{[^}]*position:\s*relative/, '.topright 应作定位锚点');
  assert.match(css, /\.agent-panel\s*\{/, '面板样式');
  assert.match(css, /\.agent-panel\.hidden\s*\{[^}]*display:\s*none/, '.hidden 应真正隐藏（本仓 .hidden 只对 .mention 生效）');
  assert.match(css, /\.agent-row/, '行样式');
  assert.match(css, /\.agent-id/, '实例标识样式');
  assert.match(css, /\.agent-hb/, '最后心跳样式');
  assert.match(css, /\.badge-online/, '在线徽标样式');
  assert.match(css, /#conn-status\.conn-ok\s*\{[^}]*cursor:\s*pointer/, '可点击信号');
});
