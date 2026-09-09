// src/agent.js — `oamp agent start <instance-id>` 生命周期编排（architecture §6.2/§6.3 / D6/D16/D17 + F03）
// 入口 = default 导出函数（cli.js 调用约定）：restArgs[0] = instance-id（O-1 收敛，2026-09-09 主 agent 裁决 A）。
// 流程：AGENT_START → connect（失败 stderr 报错含 socket 路径 + router 未运行提示，退出 1）
//   → register（请求，2s 上限；失败退出 1）→ REGISTERED（含授予 lease_timeout_ms）
//   → 周期心跳（通知）→ SIGINT：停心跳 → deregister（best-effort ≤1s）→ DEREGISTERED → 退出 0；二次 SIGINT → 130。
// 运行中断线（Router 死/连接被关）→ CONNECTION_LOST → 退出 1（不重连、不挂起）。

import { loadConfig } from './config.js';
import { NodeClient } from './node-client.js';
import { createEventLog } from './log.js';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// —— demo 任务执行器：接收 task.request（application/json body: {command, args?, timeout_ms?, label?}）——
// 安全边界（demo）：命令来自任务 payload，任何可向本 agent 发消息的注册节点都能驱动执行；
// 鉴权/白名单属后续迭代（迭代 0010 N6 已把鉴权划出）。执行约束：无 shell（spawn 直启）、
// 超时上限、cwd=agent 进程 cwd、stdout/stderr 逐行上报（行数上限防明细爆炸）。
const MAX_STREAM_LINES = 200;
const DEFAULT_TASK_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 600000;

/** 解析任务 payload。返回 { ok:true, task } 或 { ok:false, reason }。 */
function parseTaskBody(payload) {
  if (!payload || payload.content_type !== 'application/json') {
    return { ok: false, reason: 'payload.content_type 必须为 application/json' };
  }
  let body;
  try {
    body = JSON.parse(payload.body);
  } catch {
    return { ok: false, reason: 'payload.body 非合法 JSON' };
  }
  if (!body || typeof body.command !== 'string' || body.command.length === 0) {
    return { ok: false, reason: '缺少非空 command' };
  }
  const args = body.args === undefined ? [] : body.args;
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    return { ok: false, reason: 'args 必须为字符串数组' };
  }
  const timeoutMs = body.timeout_ms === undefined ? DEFAULT_TASK_TIMEOUT_MS : body.timeout_ms;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    return { ok: false, reason: 'timeout_ms 需为 1~600000 正整数' };
  }
  return { ok: true, task: { command: body.command, args, timeoutMs, label: typeof body.label === 'string' ? body.label : null } };
}

function makeLineReader(stream, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, i).replace(/\r$/, ''));
      buf = buf.slice(i + 1);
    }
  });
  stream.on('end', () => {
    if (buf.length > 0) onLine(buf);
  });
}

/** 发 task.update/task.result 给发起者；失败（发起者离线等）静默——Router 已按 recorded 语义入库。 */
async function sendTaskMessage(client, origin, messageId, type, taskId, body) {
  try {
    await client.send(origin, {
      protocol: 'oamp/1',
      message_id: messageId,
      type,
      task_id: taskId,
      payload: { content_type: 'application/json', body: JSON.stringify(body) },
    });
  } catch {
    /* 发起者离线/不可达：Router 侧任务表已记录（task.update/result 的 recorded 语义），忽略 */
  }
}

/** 执行一条 shell 任务并逐行上报进度，终态发 task.result。resolve 于命令结束（不阻塞 agent 心跳）。 */
function runShellTask(client, logger, message, task) {
  const taskId = message.task_id;
  const origin = message.from.instance_id;
  const startedAt = Date.now();
  const sendUpdate = (state, detail) =>
    sendTaskMessage(client, origin, `tup-${randomUUID()}`, 'task.update', taskId, { state, ...detail });

  logger.event('TASK_STARTED', { task_id: taskId, command: task.command, from: origin, label: task.label || '' });
  sendUpdate('working', { event: 'started', command: task.command, args: task.args }).catch(() => {});

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(task.command, task.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      // command 非法（如含 NUL）同步抛错
      const body = { state: 'failed', error: `spawn_failed: ${err && err.message ? err.message : String(err)}`, duration_ms: Date.now() - startedAt };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: 'spawn_failed' });
      resolve();
      return;
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* 已退出 */
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* 已退出 */
        }
      }, 500).unref();
    }, task.timeoutMs);
    timer.unref?.();

    let linesSent = 0;
    let truncated = false;
    const makeLineSender = (kind) => (line) => {
      if (line === '') return;
      if (linesSent >= MAX_STREAM_LINES) {
        if (!truncated) {
          truncated = true;
          sendUpdate('working', { event: 'truncated', note: `明细行数超上限（${MAX_STREAM_LINES}），后续行不再逐条上报` }).catch(() => {});
        }
        return;
      }
      linesSent += 1;
      sendUpdate('working', { kind, line }).catch(() => {});
    };
    makeLineReader(child.stdout, makeLineSender('stdout'));
    makeLineReader(child.stderr, makeLineSender('stderr'));

    child.on('error', (err) => {
      // spawn 失败（ENOENT 等异步 error）
      const body = { state: 'failed', error: `spawn_error: ${err && err.message ? err.message : String(err)}`, duration_ms: Date.now() - startedAt };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: 'spawn_error' });
      resolve();
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        const body = { state: 'failed', error: `timeout_after_${task.timeoutMs}ms`, timed_out: true, duration_ms: Date.now() - startedAt };
        sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
        logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: 'timeout' });
        resolve();
        return;
      }
      const state = code === 0 ? 'completed' : 'failed';
      const body = {
        state,
        exit_code: code === null ? (signal || 'killed') : code,
        duration_ms: Date.now() - startedAt,
      };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state, exit_code: code });
      resolve();
    });
  });
}

/**
 * 生成 deliver 受理钩子（挂 client.onDeliver）：
 * task.request → 校验（失败 ack rejected）→ 执行（fire-and-forget，受理 = node-client 自动 ack accepted）；
 * 其他类型消息 → 默认自动受理（返回 undefined）。
 */
function createTaskDeliverHandler(client, logger) {
  return function handleDeliver(message) {
    if (message.type !== 'task.request') return undefined;
    const parsed = parseTaskBody(message.payload);
    if (!parsed.ok) {
      client.ack(message.message_id, { status: 'rejected' }).catch(() => {});
      logger.event('TASK_REJECTED', { task_id: message.task_id || '', reason: parsed.reason, from: message.from.instance_id });
      return false; // 阻止 node-client 自动 ack accepted（已回 rejected）
    }
    runShellTask(client, logger, message, parsed.task).catch(() => {});
    return undefined; // 自动 ack accepted = 受理
  };
}

// §4.6 instance_id 校验（非空、≤64、可打印 ASCII）
const INSTANCE_ID_RE = /^[\x21-\x7E]{1,64}$/;

export default async function startAgent(restArgs) {
  const instanceId = restArgs && restArgs[0];

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp: agent start 失败: ${err.message}\n`);
    return 1;
  }

  if (typeof instanceId !== 'string' || !INSTANCE_ID_RE.test(instanceId)) {
    process.stderr.write(
      `oamp: agent start 失败: instance-id 非法（需 1~64 个可打印 ASCII 字符；当前值: ${JSON.stringify(instanceId)}）\n`,
    );
    return 1;
  }

  const logger = createEventLog({ role: 'agent' });
  logger.event('AGENT_START', { instance: instanceId });

  const client = new NodeClient({
    socketPath: config.socketPath,
    logger,
    registerTimeoutMs: 2000, // D17：agent.register 响应上限 2s
    deregisterTimeoutMs: 1000, // D17：agent.deregister 响应上限 1s
  });

  // —— 连接（§6.2 步骤 1）——
  try {
    await client.connect();
  } catch {
    process.stderr.write(
      `oamp: agent start 失败: 无法连接 oamp router（socket=${config.socketPath}；router 未运行？先执行 oamp router start）\n`,
    );
    return 1;
  }

  // —— 注册（§6.2 步骤 2）——
  let registered;
  try {
    registered = await client.register(instanceId);
  } catch (err) {
    const dataCode = err && err.dataCode ? err.dataCode : 'register-failed';
    process.stderr.write(`oamp: agent start 失败: 注册被拒（${dataCode}）: ${err && err.message ? err.message : err}\n`);
    client.close();
    return 1;
  }
  const leaseTimeoutMs = registered.lease_timeout_ms;
  logger.event('REGISTERED', { instance: instanceId, session: registered.session_id, lease_timeout_ms: leaseTimeoutMs });

  // §6.2 步骤 3：授予 lease < 2×interval → 启动打一条告警事件（建议 timeout ≥ 2×interval 防跳空误判）
  if (leaseTimeoutMs < 2 * config.heartbeatIntervalMs) {
    logger.event('LEASE_ALARM', {
      instance: instanceId,
      note: 'lease_timeout_ms < 2 x heartbeat_interval_ms（建议 timeout >= 2 x interval）',
    });
  }

  // —— 周期心跳 ——
  client.startHeartbeat(config.heartbeatIntervalMs);
  // —— 任务执行器（demo 扩展：接收 task.request → 校验/受理 → shell 执行 → 进度上报）——
  client.onDeliver = createTaskDeliverHandler(client, logger);

  // —— 信号与退出 ——
  return await new Promise((resolve) => {
    let settled = false;
    let shuttingDown = false;
    let sigintCount = 0;

    const finish = (code) => {
      if (settled) return;
      settled = true;
      client.onClose = null;
      process.removeListener('SIGINT', onSigint);
      resolve(code);
    };

    const onSigint = () => {
      sigintCount += 1;
      if (sigintCount >= 2) {
        // 二次 SIGINT → 立即退出 130（D16）
        process.exit(130);
      }
      if (shuttingDown || settled) return;
      shuttingDown = true;
      // §6.3：停心跳 → deregister（请求语义，等响应 ≤1s，best-effort）→ 退出 0
      client.stopHeartbeat();
      client
        .deregister()
        .then(() => {
          logger.event('DEREGISTERED', { instance: instanceId });
          client.close();
          finish(0);
        })
        .catch(() => {
          // Router 已不在等情况：跳过事件（§6.3），仍优雅退出 0
          client.close();
          finish(0);
        });
    };

    // 运行中断线（非关闭流程中）→ CONNECTION_LOST → 退出 1
    client.onClose = () => {
      if (shuttingDown || settled) return;
      logger.event('CONNECTION_LOST', { instance: instanceId });
      finish(1);
    };

    process.on('SIGINT', onSigint);
  });
}
