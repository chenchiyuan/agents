// test/omp-executor.test.js — executor='omp' 任务路由契约测试（fake omp 注入，不依赖真实 LLM/外网）
// 覆盖：omp 任务经 OAMP_OMP_BIN 调用 → 输出逐行回流 → completed；缺 prompt → rejected；超时 → failed。
// 真实 omp（LLM）由手工端到端验证覆盖（见 README / architecture §15.8）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startRouter, startAgent, waitFor, stopAll } from './helpers/harness.js';
import { createClient } from '../src/node-client.js';
import { randomUUID } from 'node:crypto';

/** 造一个 fake omp 可执行脚本（支持 FAKE_OMP_SLEEP 模拟慢响应）。 */
function makeFakeOmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-fake-omp-'));
  const bin = path.join(dir, 'fake-omp.js');
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const prompt = args[args.length - 1] || '';
if (process.env.FAKE_OMP_SLEEP_MS) {
  setTimeout(() => { console.log('late answer'); }, Number(process.env.FAKE_OMP_SLEEP_MS));
} else {
  console.log('推荐《白箱》（SHIROBAKO）。');
  console.log('');
  console.log('理由：以动画制作现场为舞台，把"作品怎么被做出来"讲成职场群像。');
  console.log('prompt-echo: ' + prompt);
}
`,
    { mode: 0o755 },
  );
  return { dir, bin };
}

function main(socketPath) {
  const client = createClient({ socketPath });
  return {
    client,
    start: async (id = 'main') => {
      await client.connect();
      await client.register(id);
    },
    stop: async () => {
      try {
        await client.deregister();
      } catch {
        /* best-effort */
      }
      client.close();
    },
  };
}

async function sendOmp(client, to, body) {
  return client.send(to, {
    protocol: 'oamp/1',
    message_id: `tsk-${randomUUID()}`,
    type: 'task.request',
    payload: { content_type: 'application/json', body: JSON.stringify(body) },
  });
}

async function waitTaskFinal(socketPath, taskId, timeoutMs = 10000) {
  return waitFor(async () => {
    const r = await queryTask(socketPath, taskId);
    return r && (r.state === 'completed' || r.state === 'failed') ? r : null;
  }, { timeoutMs, intervalMs: 50, what: `task ${taskId} 终态` });
}

async function queryTask(socketPath, taskId) {
  const net = await import('node:net');
  const { RpcPeer } = await import('../src/rpc.js');
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'omp' });
  try {
    const r = await peer.request('router.task_get', { task_id: taskId }, { timeoutMs: 3000 });
    return r.task;
  } finally {
    peer.close();
  }
}

test('executor=omp：任务经 OAMP_OMP_BIN 执行 → 回答逐行回流 → completed', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const fake = makeFakeOmp();
  t.after(() => fs.rmSync(fake.dir, { recursive: true, force: true }));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath, envExtra: { OAMP_OMP_BIN: fake.bin } });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);

  const m = main(router.socketPath);
  await m.start();
  t.after(() => m.stop());

  const prompt = '推荐一部日本动漫，并给出理由';
  const resp = await sendOmp(m.client, 'dev-1', { executor: 'omp', prompt, label: '动漫问答' });
  assert.match(resp.task_id, /^task-/);

  const task = await waitTaskFinal(router.socketPath, resp.task_id);
  assert.equal(task.state, 'completed');
  assert.equal(task.result.exit_code, 0);
  assert.equal(task.result.executor, 'omp');

  const started = task.updates.find((u) => u.detail && u.detail.event === 'started');
  assert.ok(started, '应有 started 事件');
  assert.equal(started.detail.executor, 'omp');
  assert.equal(started.detail.prompt, prompt, 'started 事件应携带原始 prompt');

  const stdout = task.updates.filter((u) => u.detail && u.detail.kind === 'stdout').map((u) => u.detail.line);
  assert.ok(stdout.some((l) => l.includes('白箱')), '回答应回流到明细');
  assert.ok(stdout.some((l) => l.includes(prompt)), 'prompt 应原样传给 omp');

  // agent 事件行标注 executor
  await agent.waitAgentLine(/TASK_STARTED .*executor=omp/);
});

test('executor=omp：缺 prompt → agent 拒收（ack rejected，不执行）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-2/);

  const m = main(router.socketPath);
  await m.start();
  t.after(() => m.stop());

  const bad = await sendOmp(m.client, 'dev-2', { executor: 'omp' });
  assert.equal(bad.status, 'delivered');
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${bad.message_id} instance=dev-2 status=rejected`));
  await agent.waitAgentLine(/TASK_REJECTED/);
});

test('executor=omp：超时 → kill → failed(timed_out)', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const fake = makeFakeOmp();
  t.after(() => fs.rmSync(fake.dir, { recursive: true, force: true }));
  const agent = await startAgent('dev-3', {
    socketPath: router.socketPath,
    envExtra: { OAMP_OMP_BIN: fake.bin, FAKE_OMP_SLEEP_MS: '60000' },
  });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-3/);

  const m = main(router.socketPath);
  await m.start();
  t.after(() => m.stop());

  const resp = await sendOmp(m.client, 'dev-3', { executor: 'omp', prompt: '慢问题', timeout_ms: 400 });
  const task = await waitTaskFinal(router.socketPath, resp.task_id, 8000);
  assert.equal(task.state, 'failed');
  assert.equal(task.result.timed_out, true);
  assert.match(String(task.result.error), /timeout/);
});

test('shell 兼容：不带 executor 的任务仍按 shell 执行（回归）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-4', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-4/);

  const m = main(router.socketPath);
  await m.start();
  t.after(() => m.stop());

  const resp = await sendOmp(m.client, 'dev-4', { command: process.execPath, args: ['-e', 'console.log("shell-ok")'] });
  const task = await waitTaskFinal(router.socketPath, resp.task_id);
  assert.equal(task.state, 'completed');
  const stdout = task.updates.filter((u) => u.detail && u.detail.kind === 'stdout').map((u) => u.detail.line);
  assert.ok(stdout.some((l) => l.includes('shell-ok')));
});
