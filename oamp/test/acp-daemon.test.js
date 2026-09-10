// test/acp-daemon.test.js — 跨进程端到端契约测试（本迭代末位收口：E-1~E-5 + F08-1/F08-2）
// 载体：harness 起真实 Router + agent 子进程（fake ACP 经 OAMP_OMP_BIN 注入）+ `oamp web start` 子进程
//       （随机端口 + 临时 OAMP_DB）；fetch 断言 REST、fetch/reader 手工解析 SSE、
//       node:sqlite 直连库文件断言落盘（不经 web 的读口，证历史真源在库）。
// 不依赖真实 omp / 真实 LLM / 外网；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。
// 依据：architecture §17（端到端层）、§4.2/§4.7（真源与两类记录）、§5.2~§5.4（事件与 E-4）、
//       §6.1/§6.4（上下文键与释放）、§9.1（三形态路由）、§12 AR-09/AR-11/AR-15；prs/pr-005-tasks.md T2。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

// —— fake omp：同一脚本两种形态（`acp` 常驻 JSON-RPC / `-p` 一次式）——
// acp 形态实现 initialize / session/new / set_config_option / session/prompt：
//   · per-session 记忆（「记住数字 N」→ 后续「数字是多少」答 N）——E-1/E-2 的判定面；
//   · 回答切 ≥2 片流式回（agent_message_chunk）——E-4 判定面（终态前 ≥2 个过程增量）。
// 观测面：FAKE_ACP_ARGS_LOG（启动参数集，证 `acp` 常驻与 `-p` 一次性两形态都真的被走到）。
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

// 一次性形态（F08-1：显式 one_shot → omp -p）：回答回显 prompt 即为可判定输出
if (argv.includes('-p')) {
  console.log('one-shot answer: ' + argv[argv.length - 1]);
  process.exit(0);
}

const modelIdx = argv.indexOf('--model');
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'openai/gpt-5.6-luna';

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
    sessions.set(sessionId, { model: spawnModel, remembered: null });
    reply(msg.id, { sessionId, configOptions: configOptions(spawnModel) });
    // omp 启动期会灌初始化通知（architecture §6.6）：静默窗口应在其后收敛
    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'available_commands_update', availableCommands: [] } } });
    }, 20);
    return;
  }
  if (msg.method === 'session/set_config_option') {
    const session = sessions.get(msg.params.sessionId);
    if (session) session.model = msg.params.value;
    reply(msg.id, { configOptions: configOptions(msg.params.value) });
    return;
  }
  if (msg.method === 'session/prompt') {
    const sessionId = msg.params.sessionId;
    const session = sessions.get(sessionId);
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
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
    // 首 token 延迟（真实模型不会在 prompt 当拍吐字；同时避开 web 侧派发登记的调度窗口）
    await delay(50);
    // 切两片（首字 + 余下）→ 该轮终态前必然 ≥2 个过程增量（E-4）
    const parts = [answer.slice(0, 1), answer.slice(1)].filter((p) => p !== '');
    for (const part of parts) {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } } });
      await delay(10);
    }
    await delay(10);
    reply(msg.id, { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } });
    return;
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-e2e-fake-'));
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
  return 47000 + Math.floor(Math.random() * 2000);
}
// 租约：web 是常驻发送方，按既有下限心跳（≥500ms）；harness 的 300ms 租约会让它被判 offline，
// Router 便对 task.update/task.result 只记录不投递（收到不 web）。本文件统一放长租约。
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

/** **直连库文件**读回（不 import src/persist.js，不经 web 读口）：证历史真源在库。 */
function readDb(dbPath, chatId) {
  const db = new DatabaseSync(dbPath);
  try {
    const chat = db.prepare('SELECT * FROM chats WHERE chat_id = ?').get(chatId);
    const messages = db
      .prepare('SELECT id, direction, agent_id, text, model, duration_ms, error, created_at, meta FROM messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC')
      .all(chatId);
    const total = db.prepare('SELECT COUNT(*) AS n FROM chats').get().n;
    return { chat: chat === undefined ? null : { ...chat }, messages: messages.map((m) => ({ ...m })), total };
  } finally {
    db.close();
  }
}

function tempDbDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-e2e-db-'));
  t.after(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  return path.join(dir, 'sql.db');
}

/** 每个用例：独立 Router + agent（fake ACP）+ `oamp web` + 独立临时 OAMP_DB。 */
async function setup(t, { env = {} } = {}) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: FAKE_BIN, ...env } });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);
  const dbPath = tempDbDir(t);
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath });
  t.after(() => web.stop());
  return { router, agent, web, dbPath };
}

const detailOf = async (web, chatId) => (await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`)).body;

/** 发一条消息并等该 chat 第 rounds 轮的 in/out 记录齐备且离开 working，返回 { chatId, taskId, detail }。 */
async function sendAndWait(web, payload, { rounds = 1, timeoutMs = 10000 } = {}) {
  const sent = await jpost(web.base, '/api/messages', payload);
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);
  const chatId = sent.body.chat_id;
  const detail = await waitFor(
    async () => {
      const d = await detailOf(web, chatId);
      if (!d || !d.messages || d.chat.state === 'working') return null;
      const ins = d.messages.filter((m) => m.direction === 'in').length;
      const outs = d.messages.filter((m) => m.direction === 'out').length;
      return ins >= rounds && outs >= rounds ? d : null;
    },
    { timeoutMs, what: `chat ${chatId} 第 ${rounds} 轮落 out 记录` },
  );
  return { chatId, taskId: sent.body.task_id, sent, detail };
}

const outOf = (detail, round) => detail.messages.filter((m) => m.direction === 'out')[round - 1];

// ────────────────────────── E-1 / E-5：同 chat 记忆 + 实例标识 + 落盘两类 ──────────────────────────
test('E2E：E-1 同 chat 两轮上下文累积（第二轮记得 42 且 context_id/pid 相同）+ E-5 落盘恰两类', async (t) => {
  const { web, dbPath } = await setup(t);

  const turn1 = await sendAndWait(web, { agent_id: 'dev-1', text: '请记住数字 42' });
  assert.match(outOf(turn1.detail, 1).text, /记住/, '首轮应收到 agent 回答');

  // E-5：该轮（回答被切成 ≥2 段增量）在库中恰 2 行且 direction ∈ {in,out}——过程零行
  const rows1 = readDb(dbPath, turn1.chatId);
  assert.equal(rows1.messages.length, 2, '一次问答恰 2 条记录（E-5）');
  assert.deepEqual([...new Set(rows1.messages.map((m) => m.direction))], ['in', 'out'], '库中只有 in/out 两类');
  assert.equal(rows1.messages[0].meta && JSON.parse(rows1.messages[0].meta).task_id, turn1.taskId, 'in.meta.task_id = 响应 task_id');

  const turn2 = await sendAndWait(web, { chat_id: turn1.chatId, agent_id: 'dev-1', text: '数字是多少' }, { rounds: 2 });
  const out1 = outOf(turn2.detail, 1);
  const out2 = outOf(turn2.detail, 2);
  assert.match(out2.text, /42/, `第二轮应记得 42（实得: ${out2.text}）`);
  assert.ok(out1.meta && out2.meta, '两轮 out 记录都应带 meta');
  assert.ok(out1.meta.context_id, 'out.meta.context_id 应存在');
  assert.equal(out1.meta.context_id, out2.meta.context_id, 'E-1：两轮应为同一上下文实例');
  assert.ok(out1.meta.pid, 'out.meta.pid 应存在');
  assert.equal(out1.meta.pid, out2.meta.pid, 'E-1：两轮应为同一进程');
  assert.equal(readDb(dbPath, turn1.chatId).messages.length, 4, '两轮 = 4 条（2 in + 2 out），过程仍不入库');
});

// ────────────────────────── E-2：新 chat 隔离 ──────────────────────────
test('E2E：E-2 同 agent 的新 chat 与旧 chat 上下文隔离（答不出 42，自己仍可累积）', async (t) => {
  const { web } = await setup(t);

  const old = await sendAndWait(web, { agent_id: 'dev-1', text: '请记住数字 42' });
  assert.match(outOf(old.detail, 1).text, /记住/);

  // 新 chat（不传 chat_id → web 预生成新 chat）：不得看见旧 chat 的设定值
  const fresh = await sendAndWait(web, { agent_id: 'dev-1', text: '数字是多少' });
  assert.notEqual(fresh.chatId, old.chatId);
  assert.ok(!outOf(fresh.detail, 1).text.includes('42'), 'E-2：新 chat 不应含 42');
  assert.match(outOf(fresh.detail, 1).text, /我不知道/, '新 chat 无上下文应如实作答');

  // 加固：新 chat 自己可累积（隔离 ≠ 永远失忆）
  await sendAndWait(web, { chat_id: fresh.chatId, agent_id: 'dev-1', text: '请记住数字 7' }, { rounds: 2 });
  const again = await sendAndWait(web, { chat_id: fresh.chatId, agent_id: 'dev-1', text: '数字是多少' }, { rounds: 3 });
  assert.match(outOf(again.detail, 3).text, /7/, '新 chat 自己的上下文应累积');
});

// ────────────────────────── E-3：重启 web 后历史可查（库为真源） ──────────────────────────
test('E2E：E-3 重启 web 后历史 chat 与消息可查（REST 读回一致 + 直连库一致）', async (t) => {
  const { router, web, dbPath } = await setup(t);

  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '重启前建立的会话' });
  await sendAndWait(web, { chat_id: first.chatId, agent_id: 'dev-1', text: '重启前的第二轮' }, { rounds: 2 });

  const beforeList = await jget(web.base, '/api/chats');
  const beforeDetail = await jget(web.base, `/api/chats/${encodeURIComponent(first.chatId)}`);
  assert.equal(beforeDetail.body.messages.length, 4);

  // 重启 web（同 OAMP_DB，新端口）；Router/agent 不动
  await web.stop();
  const restarted = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath });
  t.after(() => restarted.stop());

  const afterList = await jget(restarted.base, '/api/chats');
  const afterDetail = await jget(restarted.base, `/api/chats/${encodeURIComponent(first.chatId)}`);
  assert.equal(afterList.status, 200);
  assert.equal(afterDetail.status, 200);

  const project = (c) => ({ chat_id: c.chat_id, title: c.title, agent_id: c.agent_id, state: c.state, created_at: c.created_at, updated_at: c.updated_at, message_count: c.message_count });
  assert.deepEqual(project(afterList.body.chats.find((c) => c.chat_id === first.chatId)), project(beforeList.body.chats.find((c) => c.chat_id === first.chatId)), 'E-3：列表项重启前后一致');
  assert.deepEqual(afterDetail.body.chat, beforeDetail.body.chat, 'E-3：chat 行重启前后一致');
  assert.deepEqual(afterDetail.body.messages, beforeDetail.body.messages, 'E-3：消息流重启前后一致');

  // 直连库文件读回（不经 web）：内容与 REST 一致 → 真源在库，不在进程内存
  const rows = readDb(dbPath, first.chatId);
  assert.equal(rows.messages.length, 4);
  assert.deepEqual(rows.messages.map((m) => m.text), afterDetail.body.messages.map((m) => m.text));
  assert.deepEqual(rows.messages.map((m) => m.direction), ['in', 'out', 'in', 'out']);

  // 重启后仍可继续追加（历史可写回读）
  const cont = await sendAndWait(restarted, { chat_id: first.chatId, agent_id: 'dev-1', text: '重启后的第三轮' }, { rounds: 3 });
  assert.equal(cont.detail.messages.length, 6, '重启后追加仍落到同一 chat');
});

// ────────────────────────── E-4：终态前的过程增量 ──────────────────────────
test('E2E：E-4 SSE——终态 message(out) 之前收到 ≥2 个 task_update 且文本递增', async (t) => {
  const { web } = await setup(t);

  const first = await sendAndWait(web, { agent_id: 'dev-1', text: '请记住数字 42' });
  const chatId = first.chatId;

  const sse = await openSse(web.base, chatId);
  t.after(() => sse.close());

  const sent = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: '数字是多少' });
  assert.equal(sent.status, 200);
  await waitFor(() => sse.events.some((e) => e.type === 'message' && e.data.message.direction === 'out'), {
    timeoutMs: 10000,
    what: 'SSE message(out)',
  });

  const events = sse.events;
  const idxOut = events.findIndex((e) => e.type === 'message' && e.data.message.direction === 'out');
  const idxIn = events.findIndex((e) => e.type === 'message' && e.data.message.direction === 'in');
  const updates = events.filter((e) => e.type === 'task_update');
  const idxLastUpdate = events.map((e) => e.type).lastIndexOf('task_update');

  assert.ok(idxIn >= 0 && idxIn < events.findIndex((e) => e.type === 'task_update'), 'message(in) 应先于过程增量');
  assert.ok(updates.length >= 2, `E-4：终态前应有 ≥2 个 task_update（实得 ${updates.length}）`);
  assert.ok(idxLastUpdate < idxOut, 'E-4：全部 task_update 必须早于该轮 message(out)');
  assert.ok(updates.every((u) => u.data.chat_id === chatId && u.data.task_id === sent.body.task_id));
  assert.ok(updates.every((u) => u.data.kind === 'chunk' && typeof u.data.text === 'string'), '过程增量应为 kind=chunk + text');

  let acc = '';
  for (const u of updates) {
    const next = acc + u.data.text;
    assert.ok(next.length > acc.length, 'E-4：过程文本应递增');
    acc = next;
  }
  const finalMsg = events[idxOut].data.message;
  assert.equal(acc, finalMsg.text, 'E-4：增量拼接应等于终态落盘文本');
  assert.match(finalMsg.text, /42/, '该轮终态文本应为记忆结果');
  const detail = await detailOf(web, chatId);
  assert.equal(detail.messages.length, 4, '过程增量不入库（该轮仍恰 2 行）');
});

// ────────────────────────── F08-1/F08-2：两形态不回归 + 不累积/不复用 ──────────────────────────
test('E2E：F08-1/2 `!` shell 与显式 one_shot 两形态不回归，且不进入/不复用常驻上下文', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-e2e-args-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const argsLog = path.join(dir, 'argv.jsonl');
  const { web } = await setup(t, { env: { FAKE_ACP_ARGS_LOG: argsLog } });

  // 常驻路径建立上下文（记住 42）
  const daemon = await sendAndWait(web, { agent_id: 'dev-1', text: '请记住数字 42' });
  const chatId = daemon.chatId;
  assert.match(outOf(daemon.detail, 1).text, /记住/);

  // 显式一次性（one_shot:true）→ `omp -p` 路径，输出为一次性回答
  const oneShot = await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '请记住数字 7', one_shot: true }, { rounds: 2 });
  assert.match(outOf(oneShot.detail, 2).text, /one-shot answer: 请记住数字 7/, 'one_shot 应走 omp -p 一次性路径');

  // `!` 前缀 → shell 路径（0010 原样）
  const shell = await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '!echo shell-path-ok' }, { rounds: 3 });
  assert.match(outOf(shell.detail, 3).text, /shell-path-ok/, '! 前缀应走 shell 执行器');

  // 常驻上下文不受两形态影响：再问仍答 42（不复用一次性/shell 的执行态，也不被其重置）
  const back = await sendAndWait(web, { chat_id: chatId, agent_id: 'dev-1', text: '数字是多少' }, { rounds: 4 });
  const finalOut = outOf(back.detail, 4);
  assert.match(finalOut.text, /42/, '常驻上下文应仍在（一次性/shell 路径不累积也不复用）');
  assert.ok(!finalOut.text.includes('7'), '一次性轮的内容不得进入常驻上下文');
  assert.equal(finalOut.meta.context_id, outOf(daemon.detail, 1).meta.context_id, '常驻实例标识应保持（未被一次性/shell 轮重建）');

  // 两形态确实各自被走到（启动参数可观测）
  const argvs = fs
    .readFileSync(argsLog, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l));
  assert.ok(argvs.some((a) => a[0] === 'acp'), '默认路径应起 acp 常驻进程');
  assert.ok(argvs.some((a) => a.includes('-p') && !a.includes('acp')), '一次性路径应走 -p');
});
