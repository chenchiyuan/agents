// test/notification-scope.test.js — 0021 pr-004 第 2 轮（主 agent 裁决 Q6；契约源头 = prd/F07 验收 3 / 边界 N5）
// 载体：真实 Router + `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）+ 脚本级假节点（收到 task.request 即回终态）。
// 断言面 = 两条链路上的 `chat_state` 帧：全局 `GET /api/events`（前端「对话完成 / 失败」通知的唯一派生源）
//   vs 定向 `GET /api/stream?chat_id=`（对话面板）。三条断言：
//   ① 调用面（POST /api/calls，background）派发并等其终态 ⇒ 该对话在全局链路上**零** chat_state 帧（N5：
//      调用面完成不产生通知——服务端不判通知，唯一抑制点就是这个广播开关）；
//   ② 同一场景下定向链路**仍**出现既有 chat_state 帧（形态 {chat_id, state}，含终态）——对话面板行为不变；
//   ③ 对照：消息驱动（POST /api/messages）的对话终态**仍**全局可观测（防修复过头）。
// 两处都先订阅、后派发；每条断言都先证明「该轮次真的走完终态」，避免空断言。
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会把它判 offline
// → Router 对投递只记录不投递。本文件统一放长租约（与 web.test.js / confirmation-inbox.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function pickPort() {
  return 49000 + Math.floor(Math.random() * 2000);
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
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-ntf-db-'));
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
  const project = await jreq(web.base, 'POST', '/api/projects', json({ repo_url: 'https://example.com/oamp-notification-scope.git' }));
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

/** 假 agent 节点（instance_id `pb-dev` ⇒ 角色 `dev`）：收到 task.request 即回一条 task.result（completed）。 */
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

const detailOf = async (web, chatId) => (await jreq(web.base, 'GET', `/api/chats/${encodeURIComponent(chatId)}`)).body;

/** 某观测面上的某对话的全部 `chat_state` 帧（两条链路的判据都是这两条轴：type + chat_id）。 */
const chatStatesOf = (events, chatId) => events.filter((e) => e.type === 'chat_state' && e.data.chat_id === chatId);

// ────────────────────────── ① / ②：调用面驱动的 chat 状态 ──────────────────────────

test('① ②：调用面（POST /api/calls，background）的对话状态不进全局链路；同一场景的定向 chat:<id> 帧仍逐字在场', async (t) => {
  const { router, web, projectId } = await setup(t);
  const node = await startEchoAgent(router, 'pb-dev');
  t.after(() => node.stop());

  // 订阅先于建对话：全局链路在该对话上的**既有**（消息驱动）行为就是本用例的活性对照——链路上确实看得到它
  const global = await openGlobal(web.base);
  t.after(() => global.close());

  // 对话只能由消息驱动创建（调用面不建对话，只接收已有 chat_id）——顺带给出全局链路的活性证据
  const created = await jreq(web.base, 'POST', '/api/messages', json({ project_id: projectId, agent_id: 'pb-dev', text: '建对话（消息驱动，作为调用面的归属）' }));
  assert.equal(created.status, 200, `建对话应成功：${created.text}`);
  const chatId = created.body.chat_id;
  await waitFor(() => chatStatesOf(global.events, chatId).some((e) => e.data.state === 'completed'), { timeoutMs: 8000, what: '消息驱动轮次的全局终态帧（活性对照）' });

  // 定向链路（② 的观测面）：订阅之后，链路上只会有调用面轮次的帧
  const chat = await openChat(web.base, chatId);
  t.after(() => chat.close());
  await delay(300);

  // ★ Q6 场景：hub 调用面派发一次后台调用（调用面 = 经 POST /api/calls，判据 = 任务条目带 entry.call）
  const baseline = global.events.length;
  const sent = await jreq(web.base, 'POST', '/api/calls', json({ chat_id: chatId, agent: 'dev', task: 'Q6-PROBE：后台调用完成' }));
  assert.equal(sent.status, 200, `调用应受理：${sent.text}`);
  const callId = sent.body.calls[0].call_id;
  assert.equal(sent.body.calls[0].state, 'submitted', 'background 应立即可得受理态');

  // 前置事实：该调用**真的**走完终态（否则①的「无终态帧」是空断言）
  const terminal = await waitFor(
    async () => {
      const r = await jreq(web.base, 'GET', `/api/calls/${encodeURIComponent(callId)}`);
      return r.status === 200 && (r.body.state === 'completed' || r.body.state === 'failed') ? r.body : null;
    },
    { timeoutMs: 10000, what: `call ${callId} 终态` },
  );
  assert.equal(terminal.state, 'completed', `调用应 completed：${JSON.stringify(terminal)}`);
  assert.equal((await detailOf(web, chatId)).chat.state, 'completed', '调用驱动的对话状态应落库为 completed');
  await delay(300); // SSE 写入落定

  // ① 全局链路：该对话在调用面轮次里**零** chat_state 帧（终态帧不得出现——F07 验收 3 / N5 的判据）
  const globalAfter = chatStatesOf(global.events.slice(baseline), chatId);
  assert.deepEqual(globalAfter, [], `调用驱动的 chat 不得进全局 chat_state 链路：${JSON.stringify(globalAfter)}`);

  // ② 定向链路：既有 chat_state 帧仍逐字在场（形态 {chat_id, state}，含终态）——对话面板照常更新
  const chatStates = chatStatesOf(chat.events, chatId);
  assert.ok(chatStates.length >= 2, `定向链路应收到 working + 终态：${JSON.stringify(chat.events)}`);
  for (const e of chatStates) assert.deepEqual(Object.keys(e.data).sort(), ['chat_id', 'state'], '既有帧形态逐字不变');
  assert.equal(chatStates[0].data.state, 'working', 'working 帧先于终态帧');
  assert.equal(chatStates[chatStates.length - 1].data.state, 'completed', '定向链路仍含终态帧');
});

// ────────────────────────── ③：消息驱动终态仍全局可观测（对照） ──────────────────────────

test('③ 对照：消息驱动（POST /api/messages）的对话终态仍在全局链路上可观测（防修复过头）', async (t) => {
  const { router, web, projectId } = await setup(t);
  const node = await startEchoAgent(router, 'pb-dev');
  t.after(() => node.stop());

  const global = await openGlobal(web.base);
  t.after(() => global.close());
  await delay(300);

  const sent = await jreq(web.base, 'POST', '/api/messages', json({ project_id: projectId, agent_id: 'pb-dev', text: 'Q6-CONTROL：消息驱动' }));
  assert.equal(sent.status, 200, `派发应成功：${sent.text}`);
  const chatId = sent.body.chat_id;

  const states = await waitFor(
    () => {
      const seen = new Set(chatStatesOf(global.events, chatId).map((e) => e.data.state));
      return seen.has('completed') ? seen : null;
    },
    { timeoutMs: 8000, what: '消息驱动的全局终态帧' },
  );
  assert.ok(states.has('working'), `全局链路应含 working：${JSON.stringify([...states])}`);
  assert.ok(states.has('completed'), `全局链路应含终态 completed：${JSON.stringify([...states])}`);
  for (const e of chatStatesOf(global.events, chatId)) assert.deepEqual(Object.keys(e.data).sort(), ['chat_id', 'state'], '全局帧形态 = {chat_id, state}');
  assert.equal((await detailOf(web, chatId)).chat.state, 'completed', '对话状态应落库为 completed');
});
