// src/task.js — `oamp task …` 主进程视角任务命令（demo 扩展）
// 入口 = default 导出 async 函数（cli.js 调用约定：task 分支透传 argv.slice(2)）。
// 子命令：
//   oamp task send <instance-id> '<json>'|@file [--as <id>]  指派任务（发送方临时注册默认 'main'）
//   oamp task status <task_id>                                查单任务状态与明细
//   oamp task list [--state submitted|working|completed|failed]  列任务
//   oamp task watch <task_id> [--interval <ms>]               轮询到终态并增量打印明细
// 语义：任务经 Router 全内存任务表记录（router.task_get/router.task_list），发送方无需常驻即可随时查询。
// 安全边界（demo）：任务命令由 payload 指定（agent 端 shell 执行）；查询与指派无鉴权（迭代 0010 N6 边界）。

import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { RpcPeer } from './rpc.js';
import { NodeClient } from './node-client.js';
import net from 'node:net';

const QUERY_TIMEOUT_MS = 3000;
const WATCH_INTERVAL_MS = 500;
const MAIN_SENDER_ID = 'main'; // 主进程（omp 主 agent）固定发送身份（R2：主 agent 同为注册节点）

function fail(message) {
  process.stderr.write(`oamp task: ${message}\n`);
  return 1;
}

function taskUsage() {
  process.stderr.write(
    '用法:\n' +
      '  oamp task send <instance-id> \'<json>\'|@file [--as <id>]   指派任务给 agent\n' +
      '  oamp task status <task_id>                                  查看任务状态与明细\n' +
      '  oamp task list [--state <state>]                            列出任务（state: submitted/working/completed/failed）\n' +
      '  oamp task watch <task_id> [--interval <ms>]                 轮询任务直到终态\n' +
      '任务 JSON: {"command":"echo","args":["hi"],"timeout_ms":30000,"label":"可选说明"}\n',
  );
  return 2;
}

/** 连接 UDS 并执行一次查询 RPC（无需注册身份，同 router.status 语义）。 */
async function queryOnce(socketPath, method, params) {
  const socket = await netConnect(socketPath);
  const peer = new RpcPeer(socket, { idPrefix: 'task' });
  try {
    return await peer.request(method, params, { timeoutMs: QUERY_TIMEOUT_MS });
  } finally {
    peer.close();
  }
}

function netConnect(socketPath) {
  const socket = net.connect(socketPath);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connect timeout: ${socketPath}`));
    }, 2000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function loadSpec(raw) {
  let text;
  if (typeof raw === 'string' && raw.startsWith('@')) {
    text = fs.readFileSync(raw.slice(1), 'utf8');
  } else {
    text = raw;
  }
  return JSON.parse(text);
}

/** 渲染单任务详情（状态 + 明细流 + 结果）。 */
function renderTask(task) {
  const out = [];
  const pad = (k, v) => out.push(`${k.padEnd(12)}: ${v}`);
  pad('task_id', task.task_id);
  pad('state', task.state);
  pad('label', task.label || '-');
  pad('from', task.from);
  pad('to', task.to);
  pad('created_at', new Date(task.created_at).toISOString());
  pad('updated_at', new Date(task.updated_at).toISOString());
  pad('updates', `${task.updates.length}${task.updatesTruncated ? ' (truncated)' : ''}`);
  if (task.updates.length > 0) {
    out.push('明细:');
    for (const u of task.updates) {
      const ts = new Date(u.at).toISOString().slice(11, 23);
      const d = u.detail || {};
      let line;
      if (d.kind === 'stdout') line = `│ ${d.line}`;
      else if (d.kind === 'stderr') line = `│ stderr: ${d.line}`;
      else if (d.event === 'started') line = `▶ started: ${d.command} ${(d.args || []).join(' ')}`.trim();
      else if (d.event === 'truncated') line = `… ${d.note || '明细截断'}`;
      else line = JSON.stringify(d);
      out.push(`  [${ts}] ${u.state ? `${u.state} ` : ''}${line}`);
    }
  }
  if (task.result) {
    const r = task.result;
    out.push(
      `结果: state=${r.state} exit_code=${r.exit_code ?? '-'} duration_ms=${r.duration_ms ?? '-'}${r.error ? ` error=${r.error}` : ''}`,
    );
  }
  return out.join('\n');
}

function renderList(tasks) {
  if (tasks.length === 0) return '（无任务）';
  const header = ['task_id', 'state', 'to', 'label', 'created_at'];
  const cell = (t, k) => (k === 'created_at' ? new Date(t.created_at).toISOString() : String(t[k] ?? '-'));
  const widths = header.map((k) => Math.max(k.length, ...tasks.map((t) => cell(t, k).length)));
  const lineOf = (cells) => cells.map((c, i) => (i < cells.length - 1 ? c.padEnd(widths[i]) : c)).join('  ');
  return [lineOf(header), ...tasks.map((t) => lineOf(header.map((k) => cell(t, k))))].join('\n');
}

async function cmdSend(config, args) {
  const pos = [];
  let asId = MAIN_SENDER_ID;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--as') {
      asId = args[i + 1];
      i += 1;
    } else {
      pos.push(args[i]);
    }
  }
  if (pos.length < 2) return taskUsage();
  const [targetId, specRaw] = pos;

  let spec;
  try {
    spec = loadSpec(specRaw);
  } catch (err) {
    return fail(`任务 JSON 解析失败（支持内联 JSON 或 @文件路径）: ${err && err.message ? err.message : err}`);
  }

  // 发送方注册（主进程身份，R2）→ task.request → 打印 task_id → 注销
  const client = new NodeClient({ socketPath: config.socketPath });
  try {
    await client.connect();
  } catch (err) {
    return fail(`无法连接 oamp router（socket=${config.socketPath}；router 未运行？先执行 oamp router start）: ${err && err.message ? err.message : err}`);
  }
  try {
    await client.register(asId);
    const resp = await client.send(targetId, {
      protocol: 'oamp/1',
      message_id: `tsk-${randomUUID()}`,
      type: 'task.request',
      payload: { content_type: 'application/json', body: JSON.stringify(spec) },
    });
    process.stdout.write(`task_id: ${resp.task_id}\n`);
    process.stdout.write(`已指派: ${targetId}（${spec.label ? `${spec.label}；` : ''}查看进度: oamp task watch ${resp.task_id} / oamp task status ${resp.task_id}）\n`);
    return 0;
  } catch (err) {
    const dataCode = err && err.dataCode ? err.dataCode : '';
    return fail(`任务指派失败${dataCode ? `（${dataCode}）` : ''}: ${err && err.message ? err.message : err}`);
  } finally {
    try {
      await client.deregister();
    } catch {
      /* best-effort */
    }
    client.close();
  }
}

async function cmdStatus(config, args) {
  const taskId = args[0];
  if (!taskId) return taskUsage();
  try {
    const { task } = await queryOnce(config.socketPath, 'router.task_get', { task_id: taskId });
    if (!task) return fail(`task not found: ${taskId}`);
    process.stdout.write(`${renderTask(task)}\n`);
    return 0;
  } catch (err) {
    return fail(`查询失败: ${err && err.message ? err.message : err}`);
  }
}

async function cmdList(config, args) {
  let state;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--state') {
      state = args[i + 1];
      i += 1;
    }
  }
  try {
    const { tasks } = await queryOnce(config.socketPath, 'router.task_list', state ? { state } : {});
    process.stdout.write(`${renderList(tasks)}\n`);
    return 0;
  } catch (err) {
    return fail(`查询失败: ${err && err.message ? err.message : err}`);
  }
}

async function cmdWatch(config, args) {
  const pos = [];
  let intervalMs = WATCH_INTERVAL_MS;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--interval') {
      intervalMs = Number(args[i + 1]);
      i += 1;
    } else {
      pos.push(args[i]);
    }
  }
  const taskId = pos[0];
  if (!taskId) return taskUsage();
  if (!Number.isFinite(intervalMs) || intervalMs < 100) intervalMs = WATCH_INTERVAL_MS;

  let lastIdx = 0;
  let lastState = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let task;
    try {
      const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: taskId });
      task = r.task;
    } catch (err) {
      return fail(`watch 失败（Router 不可达？）: ${err && err.message ? err.message : err}`);
    }
    if (!task) return fail(`task not found: ${taskId}`);

    // 增量打印明细
    const newOnes = task.updates.slice(lastIdx);
    for (const u of newOnes) {
      const ts = new Date(u.at).toISOString().slice(11, 23);
      const d = u.detail || {};
      if (d.kind === 'stdout') process.stdout.write(`  [${ts}] │ ${d.line}\n`);
      else if (d.kind === 'stderr') process.stdout.write(`  [${ts}] │ stderr: ${d.line}\n`);
      else if (d.event === 'started') process.stdout.write(`  [${ts}] ▶ ${d.command} ${(d.args || []).join(' ')}`.trimEnd() + '\n');
      else if (d.event === 'truncated') process.stdout.write(`  [${ts}] … ${d.note || ''}\n`);
      else process.stdout.write(`  [${ts}] ${JSON.stringify(d)}\n`);
    }
    lastIdx = task.updates.length;

    const isFinal = task.state === 'completed' || task.state === 'failed';
    if (isFinal) {
      if (lastState !== task.state) {
        process.stdout.write(`任务终态: ${task.state}\n`);
        if (task.result) {
          const r = task.result;
          process.stdout.write(`结果: exit_code=${r.exit_code ?? '-'} duration_ms=${r.duration_ms ?? '-'}${r.error ? ` error=${r.error}` : ''}\n`);
        }
      }
      return 0;
    }
    if (lastState !== task.state) {
      process.stdout.write(`任务状态: ${task.state}\n`);
      lastState = task.state;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export default async function taskMain(restArgs) {
  const [sub, ...args] = restArgs || [];

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    return fail(`配置错误: ${err && err.message ? err.message : err}`);
  }

  switch (sub) {
    case 'send':
      return cmdSend(config, args);
    case 'status':
      return cmdStatus(config, args);
    case 'list':
      return cmdList(config, args);
    case 'watch':
      return cmdWatch(config, args);
    default:
      return taskUsage();
  }
}
