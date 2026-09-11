// src/agent.js — `oamp agent start <instance-id>` 生命周期编排（architecture §6.2/§6.3 / D6/D16/D17 + F03）
// 入口 = default 导出函数（cli.js 调用约定）：restArgs[0] = instance-id（O-1 收敛，2026-09-09 主 agent 裁决 A）。
// 流程：AGENT_START → connect（失败 stderr 报错含 socket 路径 + router 未运行提示，退出 1）
//   → register（请求，2s 上限；失败退出 1）→ REGISTERED（含授予 lease_timeout_ms）
//   → 周期心跳（通知）→ SIGINT：停心跳 → deregister（best-effort ≤1s）→ DEREGISTERED → 退出 0；二次 SIGINT → 130。
// 运行中断线（Router 死/连接被关）→ CONNECTION_LOST → 退出 1（不重连、不挂起）。
// 任务执行面（D6/D16/D17 + F03/F05/F06/F08）：executor='omp-daemon'（默认，同 chat 上下文累积）/
//   'omp'（一次性 `omp -p`）/ 缺省（shell 命令）三条路径互不干扰（architecture §9.1）。

import { loadConfig } from './config.js';
import { NodeClient } from './node-client.js';
import { createEventLog } from './log.js';
import { ContextPool } from './context-pool.js';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// —— demo 任务执行器：接收 task.request（application/json body: {command, args?, timeout_ms?, label?}）——
// 安全边界（demo）：命令来自任务 payload，任何可向本 agent 发消息的注册节点都能驱动执行；
// 鉴权/白名单属后续迭代（迭代 0010 N6 已把鉴权划出）。执行约束：无 shell（spawn 直启）、
// 超时上限、cwd=agent 进程 cwd、stdout/stderr 逐行上报（行数上限防明细爆炸）。
const MAX_STREAM_LINES = 200;
const DEFAULT_TASK_TIMEOUT_MS = 30000; // shell 任务默认
const DEFAULT_OMP_TIMEOUT_MS = 300000; // omp（LLM）任务默认：给足推理时间
const MAX_TIMEOUT_MS = 600000;
const OMP_BIN = () => process.env.OAMP_OMP_BIN || 'omp';
// §7.2 模型标识校验（daemon 路径；风格同 0010 payload 校验）
const MODEL_RE = /^[A-Za-z0-9._/-]{1,128}$/;

/** 去掉 ANSI 转义（omp/子进程输出可能带色码，回流与存储都应是干净文本）。 */
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

/**
 * 解析任务 payload（executor 路由）。返回 { ok:true, task } 或 { ok:false, reason }。
 *   executor='omp'（真实 LLM 处理）：{ executor:'omp', prompt, model?, tools?, timeout_ms? }
 *   executor='omp-daemon'（常驻上下文，默认路径）：{ executor:'omp-daemon', chat_id, prompt, model?, timeout_ms? }
 *   缺省（shell）：{ command, args?, timeout_ms?, label? }（向后兼容）
 */
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
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'payload.body 需为 JSON 对象' };
  }
  const label = typeof body.label === 'string' ? body.label : null;

  if (body.executor === 'omp') {
    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return { ok: false, reason: 'omp 任务需要非空 prompt' };
    }
    const timeoutMs = body.timeout_ms === undefined ? DEFAULT_OMP_TIMEOUT_MS : body.timeout_ms;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      return { ok: false, reason: 'timeout_ms 需为 1~600000 正整数' };
    }
    const model = typeof body.model === 'string' && body.model.length > 0 ? body.model : null;
    // 默认关闭工具（纯问答安全；需要 agent 干活时显式 tools:true）
    const tools = body.tools === true;
    return {
      ok: true,
      task: { executor: 'omp', prompt: body.prompt, model, tools, timeoutMs, label: label || body.prompt.slice(0, 60) },
    };
  }

  if (body.executor === 'omp-daemon') {
    // §9.1：默认路径（同 chat 上下文累积）；缺 chat_id → 拒收（web 侧落失败 out 记录）
    if (typeof body.chat_id !== 'string' || body.chat_id.trim().length === 0) {
      return { ok: false, reason: 'omp-daemon 任务需要非空 chat_id' };
    }
    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return { ok: false, reason: 'omp-daemon 任务需要非空 prompt' };
    }
    if (body.model !== undefined && (typeof body.model !== 'string' || !MODEL_RE.test(body.model))) {
      return { ok: false, reason: 'model 需为 1~128 位 [A-Za-z0-9._/-] 字符' };
    }
    const timeoutMs = body.timeout_ms === undefined ? DEFAULT_OMP_TIMEOUT_MS : body.timeout_ms;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      return { ok: false, reason: 'timeout_ms 需为 1~600000 正整数' };
    }
    return {
      ok: true,
      task: {
        executor: 'omp-daemon',
        chatId: body.chat_id,
        prompt: body.prompt,
        model: typeof body.model === 'string' ? body.model : null,
        timeoutMs,
        label: label || body.prompt.slice(0, 60),
      },
    };
  }

  if (typeof body.command !== 'string' || body.command.length === 0) {
    return { ok: false, reason: '缺少非空 command（或使用 executor:"omp" 提交 prompt）' };
  }
  const args = body.args === undefined ? [] : body.args;
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    return { ok: false, reason: 'args 必须为字符串数组' };
  }
  const timeoutMs = body.timeout_ms === undefined ? DEFAULT_TASK_TIMEOUT_MS : body.timeout_ms;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    return { ok: false, reason: 'timeout_ms 需为 1~600000 正整数' };
  }
  return { ok: true, task: { executor: 'shell', command: body.command, args, timeoutMs, label } };
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

/**
 * 执行一条 omp（真实 LLM）任务：spawn `omp -p --no-session [--no-tools] [--model X] <prompt>`，
 * 输出逐行回流为 task.update（stdout），结束发 task.result。默认关闭工具（纯问答）。
 */
function runOmpTask(client, logger, message, task) {
  const taskId = message.task_id;
  const origin = message.from.instance_id;
  const startedAt = Date.now();
  const sendUpdate = (state, detail) =>
    sendTaskMessage(client, origin, `tup-${randomUUID()}`, 'task.update', taskId, { state, ...detail });

  const bin = OMP_BIN();
  const args = ['-p', '--no-session'];
  if (!task.tools) args.push('--no-tools');
  if (task.model) args.push('--model', task.model);
  args.push(task.prompt);

  logger.event('TASK_STARTED', { task_id: taskId, executor: 'omp', from: origin, label: task.label || '' });
  sendUpdate('working', { event: 'started', executor: 'omp', prompt: task.prompt.slice(0, 500) }).catch(() => {});

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
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
    const sendLine = (kind) => (rawLine) => {
      const line = stripAnsi(rawLine);
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
    makeLineReader(child.stdout, sendLine('stdout'));
    makeLineReader(child.stderr, sendLine('stderr'));

    child.on('error', (err) => {
      const body = { state: 'failed', error: `spawn_error: ${err && err.message ? err.message : String(err)}`, duration_ms: Date.now() - startedAt };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: 'spawn_error' });
      resolve();
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        const body = { state: 'failed', error: `timeout_after_${task.timeoutMs}ms`, timed_out: true, executor: 'omp', duration_ms: Date.now() - startedAt };
        sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
        logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: 'timeout' });
        resolve();
        return;
      }
      const state = code === 0 ? 'completed' : 'failed';
      const body = {
        state,
        executor: 'omp',
        exit_code: code === null ? (signal || 'killed') : code,
        duration_ms: Date.now() - startedAt,
      };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state, exit_code: code });
      resolve();
    });
  });
}

/** 发 notice（上下文释放/重置提示，§5.2/§6.3；不入库）给发起者；失败静默（同 task.update 语义）。 */
function sendNotice(client, logger, { chatId, kind, text, origin }) {
  if (!client || !client.peer || !origin) return;
  client
    .send(origin, {
      protocol: 'oamp/1',
      message_id: `ntc-${randomUUID()}`,
      type: 'notice',
      payload: { content_type: 'application/json', body: JSON.stringify({ chat_id: chatId, kind, text }) },
    })
    .catch(() => {});
  logger.event('CONTEXT_NOTICE', { chat_id: chatId, kind, to: origin });
}

/**
 * 执行一条常驻上下文（omp-daemon）任务：池内键复用 → ACP 多轮 prompt（流式回流）→ 终态上报。
 * 模型解析链（§7.1，每轮独立）：payload.model > OAMP_OMP_MODEL > config.defaults.model > 内置默认
 * ——后三者已由 loadConfig() 折叠进 defaultModel。
 */
function runDaemonTask(client, logger, message, task, ctx) {
  const taskId = message.task_id;
  const origin = message.from.instance_id;
  const startedAt = Date.now();
  const model = task.model || ctx.defaultModel;
  const sendUpdate = (state, detail) =>
    sendTaskMessage(client, origin, `tup-${randomUUID()}`, 'task.update', taskId, { state, ...detail });

  logger.event('TASK_STARTED', {
    task_id: taskId,
    executor: 'omp-daemon',
    from: origin,
    chat_id: task.chatId,
    model,
    label: task.label || '',
  });
  sendUpdate('working', { event: 'started', executor: 'omp-daemon', chat_id: task.chatId, model }).catch(() => {});

  const session = ctx.pool.getOrCreate(task.chatId, ctx.instanceId, { origin });
  return session
    .prompt(task.prompt, {
      model,
      timeoutMs: task.timeoutMs,
      origin,
      onChunk: (text) => sendUpdate('working', { kind: 'chunk', text }).catch(() => {}),
    })
    .then((result) => {
      const body = {
        state: 'completed',
        executor: 'omp-daemon',
        text: result.text,
        model: result.model, // §7.4：审计值 = ACP currentValue（实际生效模型）；读不到即 null，不用请求参数冒充
        context_id: result.context_id,
        pid: result.pid,
        stop_reason: result.stop_reason,
        duration_ms: Date.now() - startedAt,
        exit_code: 0,
      };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state: 'completed', context_id: body.context_id, model: body.model });
    })
    .catch((err) => {
      const code = err && err.code ? err.code : 'context_crashed';
      const body = {
        state: 'failed',
        executor: 'omp-daemon',
        error: code,
        text: code === 'model_unavailable' ? `模型不可用：${model}` : err && err.message ? err.message : '上下文执行失败',
        model: session.model, // §7.4：失败轮同样只报 ACP 实报的生效模型（不可用模型只出现在 text 里）
        context_id: session.contextId,
        pid: session.pid,
        duration_ms: Date.now() - startedAt,
      };
      sendTaskMessage(client, origin, `trs-${randomUUID()}`, 'task.result', taskId, body).catch(() => {});
      logger.event('TASK_RESULT', { task_id: taskId, state: 'failed', error: code });
    });
}

/** 任务执行分派：executor='omp' → 一次性 LLM；'omp-daemon' → 常驻上下文（默认）；缺省 → shell。 */
function runTask(client, logger, message, task, ctx) {
  if (task.executor === 'omp') return runOmpTask(client, logger, message, task);
  if (task.executor === 'omp-daemon') return runDaemonTask(client, logger, message, task, ctx);
  return runShellTask(client, logger, message, task);
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
 * notice（web → agent 控制消息，kind='context_release'）→ 释放该 chat 常驻上下文（§6.4）；
 * 其他类型消息 → 默认自动受理（返回 undefined）。
 */
function createTaskDeliverHandler(client, logger, ctx) {
  return function handleDeliver(message) {
    if (message.type === 'notice') {
      handleNotice(logger, message, ctx.pool);
      return undefined; // 自动 ack accepted = 受理
    }
    if (message.type !== 'task.request') return undefined;
    const parsed = parseTaskBody(message.payload);
    if (!parsed.ok) {
      client.ack(message.message_id, { status: 'rejected' }).catch(() => {});
      logger.event('TASK_REJECTED', { task_id: message.task_id || '', reason: parsed.reason, from: message.from.instance_id });
      return false; // 阻止 node-client 自动 ack accepted（已回 rejected）
    }
    runTask(client, logger, message, parsed.task, ctx).catch(() => {});
    return undefined; // 自动 ack accepted = 受理
  };
}

/**
 * web → agent 控制消息：`notice{kind:'context_release', chat_id}` → 释放该 chat 的全部常驻上下文。
 * 命名区分（§5.2）：控制消息 kind = `context_release`；SSE 侧提示 kind = `context_released`（由本侧回发 notice）。
 */
function handleNotice(logger, message, pool) {
  let body = null;
  try {
    body = JSON.parse(message.payload && message.payload.body);
  } catch {
    body = null;
  }
  if (!body || body.kind !== 'context_release' || typeof body.chat_id !== 'string' || body.chat_id === '') return;
  const released = pool.release(body.chat_id, { origin: message.from.instance_id });
  logger.event('CONTEXT_RELEASE', { chat_id: body.chat_id, released, from: message.from.instance_id });
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

  // —— 常驻主循环（D22 自愈）：连接/注册/运行；断线或连接失败 → 退避重连重注册 ——
  // OAMP_RECONNECT=0 恢复旧行为（断线即退 1）。被 Router 通知 agent.replaced（同 id 新会话顶替）
  // 时退出而非重连，避免同 id 互踢。
  let activeClient = null;
  // §6.1~§6.4：chat 维度常驻上下文池（omp-daemon 路径）；提示出口 = 当前连接（重连后自动指向新 client）
  const pool = new ContextPool({
    max: config.contextMax,
    bin: OMP_BIN(),
    cwd: process.cwd(),
    logger,
    onNotice: (notice) => sendNotice(activeClient, logger, notice),
  });
  const taskCtx = { pool, instanceId, defaultModel: config.defaultModel };
  let shuttingDown = false;
  let sigintCount = 0;
  let shutdownResolve;
  const shutdownPromise = new Promise((resolve) => {
    shutdownResolve = resolve;
  });

  const onSigint = () => {
    sigintCount += 1;
    if (sigintCount >= 2) {
      pool.dispose(); // 二次 SIGINT 硬退出：同样不留常驻子进程
      process.exit(130); // 二次 SIGINT → 立即退出（D16）
    }
    if (shuttingDown) return;
    shuttingDown = true;
    const c = activeClient;
    if (!c || c.closed) {
      shutdownResolve(0);
      return;
    }
    // §6.3：停心跳 → deregister（请求语义，等响应 ≤1s，best-effort）→ 退出 0
    c.stopHeartbeat();
    c.deregister()
      .then(() => {
        logger.event('DEREGISTERED', { instance: instanceId });
      })
      .catch(() => {
        // Router 已不在：跳过事件，仍优雅退出 0
      })
      .finally(() => {
        c.close();
        shutdownResolve(0);
      });
  };
  process.on('SIGINT', onSigint);

  const sleepInterruptible = (ms) => Promise.race([new Promise((r) => setTimeout(r, ms)), shutdownPromise]);
  const backoffMs = (attempt) => Math.min(500 * 2 ** Math.max(0, attempt - 1), config.reconnectMaxMs);

  let attempt = 0;
  try {
    while (!shuttingDown) {
      const client = new NodeClient({
        socketPath: config.socketPath,
        logger,
        registerTimeoutMs: 2000, // D17：agent.register 响应上限 2s
        deregisterTimeoutMs: 1000, // D17：agent.deregister 响应上限 1s
      });
      client.onDeliver = createTaskDeliverHandler(client, logger, taskCtx);
      activeClient = client;

      // —— 连接 + 注册（§6.2 步骤 1/2）——
      let registered;
      try {
        await client.connect();
        registered = await client.register(instanceId);
      } catch (err) {
        client.close();
        const dataCode = err && err.dataCode ? err.dataCode : 'CONNECT_FAILED';
        if (!config.reconnect) {
          process.stderr.write(
            `oamp: agent start 失败: 无法连接/注册 oamp router（socket=${config.socketPath}；router 未运行？先执行 oamp router start）: ${dataCode}\n`,
          );
          return 1;
        }
        attempt += 1;
        const delay = backoffMs(attempt);
        logger.event('RECONNECT_WAIT', { instance: instanceId, attempt, delay_ms: delay, error: dataCode });
        await sleepInterruptible(delay);
        continue;
      }

      // —— 会话运行 ——
      attempt = 0; // 注册成功：下次断线从短退避重来
      const leaseTimeoutMs = registered.lease_timeout_ms;
      logger.event('REGISTERED', { instance: instanceId, session: registered.session_id, lease_timeout_ms: leaseTimeoutMs });
      if (leaseTimeoutMs < 2 * config.heartbeatIntervalMs) {
        logger.event('LEASE_ALARM', {
          instance: instanceId,
          note: 'lease_timeout_ms < 2 x heartbeat_interval_ms（建议 timeout >= 2 x interval）',
        });
      }
      client.startHeartbeat(config.heartbeatIntervalMs);

      const outcome = await new Promise((resolve) => {
        client.onClose = () => resolve(shuttingDown ? 'shutdown' : client.replaced ? 'replaced' : 'lost');
        shutdownPromise.then(() => resolve('shutdown'));
      });

      if (outcome === 'shutdown') break;

      if (outcome === 'replaced') {
        // 被同 id 新会话顶替（Router 已通知 agent.replaced）：退出而非重连
        logger.event('REPLACED', { instance: instanceId });
        return 1;
      }

      // outcome === 'lost'：断线（Router 重启/崩溃/连接被关/系统休眠后判 offline）
      logger.event('CONNECTION_LOST', { instance: instanceId });
      if (!config.reconnect) return 1;
      attempt += 1;
      const delay = backoffMs(attempt);
      logger.event('RECONNECT_WAIT', { instance: instanceId, attempt, delay_ms: delay, error: 'CONNECTION_LOST' });
      await sleepInterruptible(delay);
    }
    return await shutdownPromise;
  } finally {
    process.removeListener('SIGINT', onSigint);
    pool.dispose(); // §6.4：优雅退出（SIGINT/断线退 1/被顶替）→ 全部常驻上下文回收
  }
}
