// test/task.test.js — demo 任务功能契约测试（主 agent 指派 → agent shell 执行 → 进度/明细 → 终态）
// 载体：harness 拉起的真实 Router + 真实 CLI agent 子进程（oamp agent start，含 shell 任务执行器）
//       + 进程内 'main' 客户端（createClient，等同 oamp task send 的库形态）。
// 语义准绳：Router 任务表（registry createTask/recordTaskUpdate/finishTask）+ task 消息类型
//           （task.request/update/result）+ router.task_get/router.task_list 查询。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { startRouter, startAgent, waitFor, stopAll } from './helpers/harness.js';
import { RpcPeer } from '../src/rpc.js';
import { createClient } from '../src/node-client.js';

const NODE = process.execPath;

async function queryTask(socketPath, taskId) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'q' });
  try {
    const r = await peer.request('router.task_get', { task_id: taskId }, { timeoutMs: 3000 });
    return r.task;
  } finally {
    peer.close();
  }
}

async function sendTask(client, to, spec) {
  const resp = await client.send(to, {
    protocol: 'oamp/1',
    message_id: `tsk-${randomUUID()}`,
    type: 'task.request',
    payload: { content_type: 'application/json', body: JSON.stringify(spec) },
  });
  return resp.task_id;
}

async function waitTaskFinal(socketPath, taskId, timeoutMs = 8000) {
  return waitFor(async () => {
    const task = await queryTask(socketPath, taskId);
    return task && (task.state === 'completed' || task.state === 'failed') ? task : null;
  }, { timeoutMs, what: `task ${taskId} 终态`, intervalMs: 50 });
}

function makeMain(socketPath) {
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

test('任务 happy path：指派 echo 任务 → agent 执行 → working 明细（stdout 行）→ completed exit_code 0', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-1/);

  const main = makeMain(router.socketPath);
  await main.start();
  t.after(() => main.stop());

  const taskId = await sendTask(main.client, 'dev-1', {
    command: NODE,
    args: ['-e', 'console.log("hello from task"); console.error("warn line")'],
    label: 'demo echo',
  });
  assert.match(taskId, /^task-/);

  const task = await waitTaskFinal(router.socketPath, taskId);
  assert.equal(task.state, 'completed');
  assert.equal(task.from, 'main');
  assert.equal(task.to, 'dev-1');
  assert.equal(task.label, 'demo echo');
  assert.equal(task.result.exit_code, 0);
  assert.ok(task.result.duration_ms >= 0);

  // 明细含 started 事件与 stdout/stderr 行
  const details = task.updates.map((u) => u.detail);
  assert.ok(details.some((d) => d.event === 'started'), '应有 started 事件');
  assert.ok(details.some((d) => d.kind === 'stdout' && d.line.includes('hello from task')), 'stdout 行应入库');
  assert.ok(details.some((d) => d.kind === 'stderr' && d.line.includes('warn line')), 'stderr 行应入库');
  // 任务期间出现 working 状态
  assert.ok(task.updates.some((u) => u.state === 'working'), '任务期间应出现 working 状态');

  // Router 事件可观察
  await router.waitRouterLine(new RegExp(`TASK_CREATED task_id=${taskId} from=main to=dev-1`));
  await router.waitRouterLine(new RegExp(`TASK_RESULT task_id=${taskId} from=dev-1 state=completed`));
});

test('失败路径：命令 exit 非 0 → failed + exit_code 透传', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-2', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-2/);

  const main = makeMain(router.socketPath);
  await main.start();
  t.after(() => main.stop());

  const taskId = await sendTask(main.client, 'dev-2', {
    command: NODE,
    args: ['-e', 'process.exit(3)'],
  });
  const task = await waitTaskFinal(router.socketPath, taskId);
  assert.equal(task.state, 'failed');
  assert.equal(task.result.exit_code, 3);
});

test('超时路径：超时 → kill → failed（timeout 错误）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-3', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-3/);

  const main = makeMain(router.socketPath);
  await main.start();
  t.after(() => main.stop());

  const taskId = await sendTask(main.client, 'dev-3', {
    command: NODE,
    args: ['-e', 'setTimeout(() => {}, 60000)'],
    timeout_ms: 250,
  });
  const task = await waitTaskFinal(router.socketPath, taskId, 8000);
  assert.equal(task.state, 'failed');
  assert.equal(task.result.timed_out, true);
  assert.match(String(task.result.error), /timeout/);
});

test('发起者离线：task send 后发起者注销 → 任务仍全程记录并可查（recorded 语义）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-4', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-4/);

  const main = makeMain(router.socketPath);
  await main.start();
  const taskId = await sendTask(main.client, 'dev-4', {
    command: NODE,
    args: ['-e', 'console.log("offline origin task")'],
  });
  await main.stop(); // 发起者立即注销（模拟 oamp task send 一次性 CLI）

  const task = await waitTaskFinal(router.socketPath, taskId);
  assert.equal(task.state, 'completed');
  assert.equal(task.result.exit_code, 0);
  assert.ok(task.updates.some((u) => u.detail.kind === 'stdout' && u.detail.line.includes('offline origin task')));
});

test('非法任务 payload → agent ack rejected（不受理不执行）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-5', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-5/);

  const main = makeMain(router.socketPath);
  await main.start();
  t.after(() => main.stop());

  // content_type 非 application/json → 执行器校验失败
  const bad = await main.client.send('dev-5', {
    protocol: 'oamp/1',
    message_id: `tsk-bad-${randomUUID()}`,
    type: 'task.request',
    payload: { content_type: 'text/plain', body: 'not a task spec' },
  });
  assert.equal(bad.status, 'delivered'); // 传输/受理链仍成功（deliver 送达）
  // agent 回 rejected ack（Router 事件行带 status=rejected）→ 任务终态 failed(rejected_by_agent)，不悬挂
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${bad.message_id} instance=dev-5 status=rejected`));
  await agent.waitAgentLine(/TASK_REJECTED/);
  await router.waitRouterLine(new RegExp(`TASK_RESULT task_id=.* state=failed error=rejected_by_agent`));
  const task = await queryTask(router.socketPath, bad.task_id);
  assert.ok(task, 'send 已返回 task_id，任务应可查（终态 failed 而非消失）');
  assert.equal(task.state, 'failed');
  assert.match(task.result.error, /rejected_by_agent/);
});

test('task list 过滤与状态推进：submitted/working → completed 全程可查', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('dev-6', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await agent.waitAgentLine(/REGISTERED instance=dev-6/);

  const main = makeMain(router.socketPath);
  await main.start();
  t.after(() => main.stop());

  const taskId = await sendTask(main.client, 'dev-6', {
    command: NODE,
    args: ['-e', 'console.log("listed")'],
    label: 'for-list',
  });

  // 轮询期间至少一次能被 list 查到（状态非终态或终态均应在表内）
  const task = await waitTaskFinal(router.socketPath, taskId);
  assert.equal(task.state, 'completed');

  // 终态过滤
  const socket = net.connect(router.socketPath);
  await new Promise((res, rej) => {
    socket.once('connect', res);
    socket.once('error', rej);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'l2' });
  try {
    const completed = await peer.request('router.task_list', { state: 'completed' }, { timeoutMs: 3000 });
    assert.ok(completed.tasks.some((x) => x.task_id === taskId && x.to === 'dev-6' && x.label === 'for-list'));
    const running = await peer.request('router.task_list', { state: 'submitted' }, { timeoutMs: 3000 });
    assert.ok(!running.tasks.some((x) => x.task_id === taskId));
  } finally {
    peer.close();
  }
});
