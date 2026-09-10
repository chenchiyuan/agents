// test/web.test.js — Web 控制台契约测试（API + 消息→任务→明细回流全链路）
// 载体：harness 真实 Router + agent 子进程 + `oamp web start` 子进程（随机端口）+ fetch 断言。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

async function startWeb(socketPath, port) {
  const child = spawn(process.execPath, [BIN, 'web', 'start', '--port', String(port)], {
    cwd: ROOT,
    env: buildEnv(socketPath, {}),
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
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

function pickPort() {
  return 41000 + Math.floor(Math.random() * 2000);
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

test('Web：静态页可访问 + /api/agents 返回在线 agent', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);

  const web = await startWeb(router.socketPath, pickPort());
  t.after(() => web.stop());

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

test('Web：发送消息（消息即命令）→ 会话入库 → 任务完成 → 明细回流可查', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);

  const web = await startWeb(router.socketPath, pickPort());
  t.after(() => web.stop());

  // 发送：@agent 前缀形式（文本含 @dev-1，服务端兜底解析）
  const sent = await jpost(web.base, '/api/messages', { text: '@dev-1 echo web-contract-check' });
  assert.equal(sent.status, 200);
  assert.ok(sent.body.chat_id, '应返回 chat_id');
  assert.ok(sent.body.task_id, '应返回 task_id');
  assert.equal(sent.body.warning, null);

  const chatId = sent.body.chat_id;

  // 轮询会话详情直到任务 completed 且明细回流
  const chat = await waitFor(async () => {
    const { body } = await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`);
    const msg = body.chat && body.chat.messages[0];
    return msg && msg.task && msg.task.state === 'completed' ? body.chat : null;
  }, { timeoutMs: 8000, what: '任务完成并回流' });

  assert.equal(chat.agent_id, 'dev-1');
  assert.match(chat.title, /web-contract-check/);
  const task = chat.messages[0].task;
  assert.equal(task.result.exit_code, 0);
  const stdout = task.updates.filter((u) => u.detail && u.detail.kind === 'stdout').map((u) => u.detail.line);
  assert.ok(stdout.some((l) => l.includes('web-contract-check')), 'stdout 应回流到明细');

  // 会话列表：包含该会话且 state=completed
  const list = await jget(web.base, '/api/chats');
  assert.equal(list.status, 200);
  const item = list.body.chats.find((c) => c.chat_id === chatId);
  assert.ok(item, '列表应包含该会话');
  assert.equal(item.state, 'completed');
});

test('Web：追加消息到既有会话（同一 chat_id）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-2/);

  const web = await startWeb(router.socketPath, pickPort());
  t.after(() => web.stop());

  const first = await jpost(web.base, '/api/messages', { text: '@dev-2 echo first' });
  assert.ok(first.body.chat_id);
  const chatId = first.body.chat_id;

  const second = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-2', text: '@dev-2 echo second' });
  assert.equal(second.body.chat_id, chatId, '应追加到同一会话');

  const chat = await waitFor(async () => {
    const { body } = await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`);
    const msgs = body.chat && body.chat.messages;
    return msgs && msgs.length === 2 && msgs[1].task && msgs[1].task.state === 'completed' ? body.chat : null;
  }, { timeoutMs: 8000, what: '两条消息且第二条完成' });
  assert.equal(chat.messages.length, 2);
});

test('Web：错误面——缺 agent / 空消息 / 未知会话', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const web = await startWeb(router.socketPath, pickPort());
  t.after(() => web.stop());

  const noAgent = await jpost(web.base, '/api/messages', { text: 'echo no-agent' });
  assert.equal(noAgent.status, 400);

  const empty = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '   ' });
  assert.equal(empty.status, 400);

  const missing = await jget(web.base, '/api/chats/chat-does-not-exist');
  assert.equal(missing.status, 200);
  assert.equal(missing.body.chat, null);
});
