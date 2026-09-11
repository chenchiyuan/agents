// src/web.js — `oamp web start [--port N]` 内建 Web 控制台
// 形态：Node 内置 http 服务（零新依赖）serve 静态单页 + JSON API；进程内以 'web' 身份
//       经 NodeClient/RpcPeer 连 Router（UDS）——浏览器不直连 UDS；历史真源 = SQLite（src/persist.js）。
// API：
//   GET  /api/agents                 → Router 拓扑快照（活跃 agent 列表）
//   GET  /api/chats                  → chat 列表（读库；q/agent/state/from/to/archived/limit/offset；archived 缺省 0 = 排除已归档，1 = 只看已归档）
//   GET  /api/chats/<chat_id>        → chat 详情（读库；消息 created_at ASC, id ASC）
//   POST /api/messages               → {chat_id?, agent_id, text, model?, one_shot?} 落库 + 派发任务（归档 / 已关闭 → 409）
//   POST /api/chats/archive          → 批量归档（服务端算范围、逐条提交）→ {archived, failed, failed_ids}；不发 SSE
//   POST /api/chats/<chat_id>/close  → 关闭 chat（幂等）+ 通知 agent 释放该 chat 上下文
//   POST /api/chats/<chat_id>/activate → 激活归档 chat（清标记 + closed→completed + 置顶）+ 推送 chat_state
//   GET  /api/stream?chat_id=<id>    → SSE（message / task_update / chat_state / notice 四类事件）
// 语义（0011 迭代，architecture §4/§5/§9.1）：一次提问 = 恰一条 in + 一条 out（过程不入库）；
//   执行路径判定顺序：`!` → shell（0010 原样）｜one_shot:true → omp 一次性（0010 原样）｜默认 → omp-daemon 常驻上下文。
// 安全边界（demo）：监听 127.0.0.1；无鉴权（迭代 0010 N6 边界）；命令由输入文本决定。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { RpcPeer } from './rpc.js';
import { NodeClient } from './node-client.js';
import { openDb } from './persist.js';
import { createSseTransport } from './transport.js';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const SENDER_ID = 'web'; // web 服务作为常驻发送方身份（R2：客户端节点）
const DEFAULT_PORT = 7788;
const QUERY_TIMEOUT_MS = 3000;
const MODEL_RE = /^[A-Za-z0-9._/-]{1,128}$/; // §7.2 模型标识形态（web 侧校验，非法 → 400）
const LABEL_MAX = 60; // task label 截断（沿用 0010 web 既有值）
// pr-007 对账补拉：task.result 的投递可能丢失（发起者离线窗口/投递竞态）——此时 agent 已执行完、
// Router 任务表已终态，而 web 未落 out（对话缺回复）；Router 任务表是权威运行态，故 web 侧轮询兜底补落。
const RECONCILE_DEFAULT_MS = 5000; // 快速对账首查与间隔同值（默认 5s）
const RECONCILE_MAX_ATTEMPTS = 6; // 快速预算：快速频率下 6 次（默认约 30s）用尽后转低频续查
const RECONCILE_SLOW_DEFAULT_MS = 30000; // 低频续查间隔（默认 30s，持续到终态或 shutdown）
const RECONCILE_TTL_DEFAULT_MS = 30 * 60 * 1000; // 登记软 TTL（默认 30 分钟，覆盖 agent 侧 300s 超时上限有余）

/** 读正数毫秒环境变量（`OAMP_WEB_RECONCILE_*` 供测试压缩时间轴）；缺省/非法回退 fallback。 */
function readPositiveMs(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** 毫秒 → 日志展示用秒（下限 1，低压/测试用的亚秒配置不该显示成 "0s"）。 */
const toSec = (ms) => Math.max(1, Math.round(ms / 1000));

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, status, body, headers = null) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(headers || {}) });
  res.end(text);
}

/** 读请求体（≤limit）。失败错误带 `status`：畸形 JSON → 400、超限 → 413（调用方据此响应，不落 502）。 */
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const fail = (status, message) => {
      if (settled) return;
      settled = true;
      const err = new Error(message);
      err.status = status;
      reject(err);
    };
    req.on('data', (c) => {
      if (settled) return; // 已判错：丢弃后续数据（不缓冲，防内存膨胀）
      size += c.length;
      if (size > limit) {
        fail(413, `请求体过大（上限 ${limit} 字节）`);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        const e = new Error(`请求体非法 JSON: ${err.message}`);
        e.status = 400;
        reject(e);
      }
    });
    req.on('error', (err) => fail(err.status || 400, err.message));
  });
}

/** 无状态查询：UDS 直连 Router 发一次 RPC（无需注册身份；Router 不可达 → 抛错）。 */
async function queryOnce(socketPath, method, params) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connect timeout: ${socketPath}`));
    }, 2000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  const peer = new RpcPeer(socket, { idPrefix: 'web' });
  try {
    return await peer.request(method, params, { timeoutMs: QUERY_TIMEOUT_MS });
  } finally {
    peer.close();
  }
}

/** 解 agent 回传信封（task.update / task.result / notice）的 JSON body；坏帧 → null（忽略，不抛）。 */
function parseMessageBody(payload) {
  if (!payload || payload.content_type !== 'application/json') return null;
  try {
    const body = JSON.parse(payload.body);
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

function serveStatic(res, file) {
  const full = path.join(WEB_ROOT, file);
  if (!full.startsWith(WEB_ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': STATIC_TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}

export default async function startWeb(restArgs) {
  const args = restArgs || [];
  let port = Number(process.env.OAMP_WEB_PORT || DEFAULT_PORT);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--port') {
      port = Number(args[i + 1]);
      i += 1;
    }
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    process.stderr.write(`oamp web: 非法端口 "${process.env.OAMP_WEB_PORT ?? ''}"\n`);
    return 2;
  }

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp web: 配置错误: ${err && err.message ? err.message : err}\n`);
    return 1;
  }

  // 持久层 = 历史真源（§4.2）：启动时打开，打不开 → 打错误并退出非 0（不静默降级）；
  // 启动扫尾把本次启动前遗留的 working 置 failed（§4.3「进程中断」行，不补记录）。
  let db;
  try {
    db = openDb(config.dbPath);
  } catch (err) {
    process.stderr.write(`oamp web: 无法打开数据库 ${config.dbPath}: ${err && err.message ? err.message : err}\n`);
    return 1;
  }
  db.startupSweep();

  // §5.1 替换点：换另一种实时传输 = 换这一行构造（不引入 transport 配置项）
  const transport = createSseTransport();

  // task_id → { chatId, agentId, lines, landed, attempts, slow, registeredAt, timer }：agent 侧的
  // task.update/task.result body 不带 chat_id，派发前登记；lines 供一次性 / shell 路径组装 out 文本（其终态 body 无 text）。
  // landed = 该 task 已落过 out（投递路径与对账路径共用，保证恰一条 out）；attempts / slow = 对账进度（快速预算
  // 用尽转低频续查）；registeredAt / timer = 登记时刻与对账定时器（软 TTL 判据）。pr-007。
  // 登记只在落库（landed）或软 TTL 到期后删除：转低频续查时保留登记，晚到的投递仍能认领。
  const tasks = new Map();
  const reconcileIntervalMs = readPositiveMs('OAMP_WEB_RECONCILE_INTERVAL_MS', RECONCILE_DEFAULT_MS);
  const reconcileSlowMs = readPositiveMs('OAMP_WEB_RECONCILE_SLOW_MS', RECONCILE_SLOW_DEFAULT_MS);
  const reconcileTtlMs = readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', RECONCILE_TTL_DEFAULT_MS);

  const publishMessage = (chatId, message) =>
    transport.publish(chatId, { type: 'message', data: { chat_id: chatId, message } });
  const publishState = (chatId, state) =>
    transport.publish(chatId, { type: 'chat_state', data: { chat_id: chatId, state } });

  /** 终态落盘：恰一条 out 记录 + `message`(out) + `chat_state`（状态取库值，closed 哨兵不被迟到结果覆盖）。 */
  const finishTask = (entry, body) => {
    const failed = !body || body.state === 'failed';
    const nowMs = Date.now();
    const model = body && typeof body.model === 'string' ? body.model : null; // §7.4：ACP 实报生效值
    const error = failed ? (body && typeof body.error === 'string' ? body.error : 'task_failed') : null;
    const durationMs = body && Number.isFinite(body.duration_ms) ? body.duration_ms : null;
    const text =
      body && typeof body.text === 'string' && body.text !== ''
        ? body.text
        : entry.lines.length > 0
          ? entry.lines.join('\n')
          : failed
            ? `执行失败：${error}`
            : '';
    const meta =
      body && (body.context_id !== undefined || body.pid !== undefined)
        ? { context_id: body.context_id ?? null, pid: body.pid ?? null }
        : null;
    const { message_id } = db.insertOutput({ chatId: entry.chatId, text, agentId: entry.agentId, model, durationMs, error, meta, nowMs });
    publishMessage(entry.chatId, { id: message_id, direction: 'out', agent_id: entry.agentId, text, model, duration_ms: durationMs, error, created_at: nowMs });
    const chat = db.getChat(entry.chatId);
    if (chat) publishState(entry.chatId, chat.chat.state);
  };

  /**
   * 对账补拉（pr-007）：Router 任务表是权威运行态，但 task.result 的投递可能丢失（发起者离线窗口/
   * 投递竞态）→ 终态已 recorded 而 web 未落 out。定时 queryOnce(router.task_get) 兜底补落。
   * 幂等：`entry.landed` 同步检查+置位（Node 单线程，无 await 间隙），投递路径与对账路径竞争时恰落一条 out。
   */
  const reconcileTask = async (taskId) => {
    const entry = tasks.get(taskId);
    if (!entry || entry.landed) return;
    entry.timer = null;
    // 软 TTL（D-2）：登记久未终态 → 清理（防孤儿条目常驻内存），一条 warn
    if (Date.now() - entry.registeredAt >= reconcileTtlMs) {
      tasks.delete(taskId);
      process.stderr.write(`oamp web: 对账登记超时清理 task=${taskId}（${toSec(reconcileTtlMs)}s 未终态）\n`);
      return;
    }
    let task = null;
    try {
      const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: taskId });
      task = r && r.task ? r.task : null;
    } catch {
      task = null; // Router 暂不可达（重启/瞬时）：本轮不计终态，顺延重试
    }
    const current = tasks.get(taskId);
    if (!current || current.landed) return; // 查询在途期间投递路径已落库 → 不重复写
    if (task && (task.state === 'completed' || task.state === 'failed')) {
      current.landed = true;
      tasks.delete(taskId);
      // 状态以任务表为准（result.state 仅执行 agent 自报），文本/模型/耗时等沿用终态 body
      finishTask(current, { ...(task.result || {}), state: task.state });
      return;
    }
    current.attempts += 1;
    if (current.attempts === RECONCILE_MAX_ATTEMPTS) {
      // 快速预算用尽 → 转低频续查（不放弃、不删登记）：登记同时是投递入口的认领凭据，删掉会让长任务
      // 晚到的终态被静默丢弃（chat 永久 working）；低频续查持续到终态 / 软 TTL / shutdown。warn 只此一条。
      current.slow = true;
      process.stderr.write(`oamp web: 对账转入低频续查 task=${taskId}（${RECONCILE_MAX_ATTEMPTS} 次未终态，转 ${toSec(reconcileSlowMs)}s/次）\n`);
    }
    scheduleReconcile(taskId, current);
  };

  /** 挂/续对账定时器（快速频率；转低频续查后按 slow 间隔）；重复调用只保留一个。 */
  const scheduleReconcile = (taskId, entry) => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      reconcileTask(taskId).catch(() => {});
    }, entry.slow ? reconcileSlowMs : reconcileIntervalMs);
  };

  /** agent 回传消费（§5.3 推送链）：task.update → SSE task_update（不入库）；task.result → 落盘 + 推送；notice → 转发。 */
  const handleDeliver = (message) => {
    if (message.type === 'notice') {
      // SSE 侧提示 kind（§5.2）：context_released = chat 关闭释放；context_reset = 崩溃/超时/淘汰。
      // agent 负责产出提示，web 只转发（不自行 publish，避免双条）。
      const body = parseMessageBody(message.payload);
      const chatId = body && typeof body.chat_id === 'string' ? body.chat_id : null;
      if (!chatId || (body.kind !== 'context_released' && body.kind !== 'context_reset')) return;
      transport.publish(chatId, { type: 'notice', data: { chat_id: chatId, kind: body.kind, text: typeof body.text === 'string' ? body.text : '' } });
      return;
    }
    const entry = tasks.get(message.task_id);
    if (!entry) return;
    const body = parseMessageBody(message.payload);
    if (!body) return;
    if (message.type === 'task.update') {
      if (typeof body.kind !== 'string') return; // started/truncated 等非过程增量条目（§5.2 只定义 chunk/stdout/stderr）
      if (body.kind === 'stdout' && typeof body.line === 'string') entry.lines.push(body.line);
      transport.publish(entry.chatId, {
        type: 'task_update',
        data: { chat_id: entry.chatId, task_id: message.task_id, kind: body.kind, text: body.text, line: body.line },
      });
      return;
    }
    if (message.type === 'task.result') {
      if (entry.landed) return; // 对账已补落：迟到/重复投递不再写（恰一条 out）
      entry.landed = true;
      clearTimeout(entry.timer);
      tasks.delete(message.task_id);
      finishTask(entry, body);
    }
  };

  // 常驻发送方（懒连接：Router 尚未就绪/断开时，发送路径报错但查询路径仍可用）。
  // 注册后必须维持心跳：否则租约超时被判 offline，后续 send 得 UNREGISTERED。
  let sender = null;
  const heartbeatMs = Math.max(500, Math.min(config.heartbeatIntervalMs, Math.floor(config.heartbeatTimeoutMs / 3)));
  const ensureSender = async () => {
    if (sender && !sender.closed) return sender;
    const client = new NodeClient({ socketPath: config.socketPath });
    client.onDeliver = handleDeliver; // agent 回传的过程增量/终态/提示经此转 SSE
    await client.connect();
    await client.register(SENDER_ID);
    client.startHeartbeat(heartbeatMs);
    client.onClose = () => {
      if (sender === client) sender = null; // 断线失效，下次发送时重连
    };
    sender = client;
    return sender;
  };
  /** 发送任务（task_id 由 web 预生成并透传，§4.3 meta.task_id 与之同值）；失败重试一次。 */
  const sendTask = async (agentId, messageId, taskId, payloadBody) => {
    let lastErr = null;
    for (let i = 0; i < 2; i += 1) {
      try {
        const client = await ensureSender();
        return await client.send(agentId, {
          protocol: 'oamp/1',
          message_id: messageId,
          task_id: taskId,
          type: 'task.request',
          payload: { content_type: 'application/json', body: JSON.stringify(payloadBody) },
        });
      } catch (err) {
        lastErr = err;
        sender = null;
      }
    }
    throw lastErr;
  };
  /** web → agent 控制消息：`notice{kind:'context_release', chat_id}`（§6.4；best-effort，失败忽略）。 */
  const sendControlNotice = async (agentId, body) => {
    const client = await ensureSender();
    return client.send(agentId, {
      protocol: 'oamp/1',
      message_id: `ntc-${randomUUID()}`,
      type: 'notice',
      payload: { content_type: 'application/json', body: JSON.stringify(body) },
    });
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    const qs = url.searchParams;
    const num = (key) => {
      const raw = qs.get(key);
      return raw === null || raw === '' ? undefined : Number(raw);
    };
    try {
      if (req.method === 'GET' && p === '/api/agents') {
        const r = await queryOnce(config.socketPath, 'router.status', {});
        sendJson(res, 200, { agents: r.nodes });
        return;
      }
      if (req.method === 'GET' && p === '/api/chats') {
        let r;
        try {
          r = db.listChats({
            q: qs.get('q') ?? undefined,
            agent: qs.get('agent') ?? undefined,
            state: qs.get('state') ?? undefined,
            from: num('from'),
            to: num('to'),
            archived: num('archived'),
            limit: num('limit'),
            offset: num('offset'),
          });
        } catch (err) {
          sendJson(res, 400, { error: err && err.message ? err.message : String(err) });
          return;
        }
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'GET' && p.startsWith('/api/chats/')) {
        const chatId = decodeURIComponent(p.slice('/api/chats/'.length));
        const r = db.getChat(chatId);
        if (!r) {
          sendJson(res, 404, { error: `chat 不存在: ${chatId}` });
          return;
        }
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'POST' && p.startsWith('/api/chats/') && p.endsWith('/close')) {
        const chatId = decodeURIComponent(p.slice('/api/chats/'.length, -'/close'.length));
        const found = db.getChat(chatId);
        if (!found) {
          sendJson(res, 404, { error: `chat 不存在: ${chatId}` });
          return;
        }
        if (found.chat.state === 'closed') {
          sendJson(res, 200, { chat_id: chatId, state: 'closed' }); // 幂等：不再重复发控制消息
          return;
        }
        db.closeChat(chatId);
        publishState(chatId, 'closed');
        // §10.2：向该 chat 出现过的各 DISTINCT agent 发 context_release（agent 离线忽略）
        const agents = new Set();
        if (found.chat.agent_id) agents.add(found.chat.agent_id);
        for (const m of found.messages) if (m.agent_id) agents.add(m.agent_id);
        for (const agentId of agents) sendControlNotice(agentId, { kind: 'context_release', chat_id: chatId }).catch(() => {});
        sendJson(res, 200, { chat_id: chatId, state: 'closed' });
        return;
      }
      if (req.method === 'POST' && p === '/api/chats/archive') {
        // §5.1：后端一次编排——候选集由服务端计算（一条 SELECT，不受分页限制），逐条独立提交
        // （单语句 autocommit ⇒ 成功项不回滚）；失败项 archived_at 仍为 NULL ⇒ 仍在主列表可重试。
        const archivedIds = [];
        const failedIds = [];
        for (const chatId of db.listArchivable()) {
          try {
            if (db.archiveChat(chatId)) archivedIds.push(chatId);
          } catch {
            failedIds.push(chatId);
          }
        }
        // §4.3 / AR-07：对每个成功归档的 chat 逐条释放上下文（best-effort，与 /close 同口径）
        for (const chatId of archivedIds) {
          try {
            const found = db.getChat(chatId);
            if (!found) continue;
            const agents = new Set();
            if (found.chat.agent_id) agents.add(found.chat.agent_id);
            for (const m of found.messages) if (m.agent_id) agents.add(m.agent_id);
            for (const agentId of agents) sendControlNotice(agentId, { kind: 'context_release', chat_id: chatId }).catch(() => {});
          } catch {
            /* 释放失败不影响归档结果计数 */
          }
        }
        // 不发 SSE（§5.1）：归档不改 state、主列表不由 SSE 驱动；可见性由响应 + 前端重载承载。
        sendJson(res, 200, { archived: archivedIds.length, failed: failedIds.length, failed_ids: failedIds });
        return;
      }
      if (req.method === 'POST' && p.startsWith('/api/chats/') && p.endsWith('/activate')) {
        const chatId = decodeURIComponent(p.slice('/api/chats/'.length, -'/activate'.length));
        const found = db.getChat(chatId);
        if (!found) {
          sendJson(res, 404, { error: `chat 不存在: ${chatId}` });
          return;
        }
        if (found.chat.archived_at === null) {
          sendJson(res, 409, { error: 'chat 未归档，无法激活' }); // N-5：非归档的 closed 在此被挡住
          return;
        }
        if (!db.activateChat(chatId)) {
          sendJson(res, 409, { error: 'chat 未归档，无法激活' }); // 防御性：② 之后已非归档（单进程下不可达）
          return;
        }
        const after = db.getChat(chatId);
        publishState(chatId, after.chat.state); // §5.3 ④：状态读库值，不在 JS 里复刻 SQL 的 CASE
        sendJson(res, 200, { chat_id: chatId, state: after.chat.state });
        return;
      }
      if (req.method === 'GET' && p === '/api/stream') {
        const chatId = qs.get('chat_id');
        if (!chatId) {
          sendJson(res, 400, { error: '需要 chat_id（不做全局订阅）' });
          return;
        }
        transport.handle(req, res, { chatId });
        return;
      }
      if (req.method === 'POST' && p === '/api/messages') {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          // 客户端错误（畸形 JSON → 400 / 超限 → 413）：明确响应；超限时关闭连接，不留悬挂
          const status = err.status || 400;
          sendJson(res, status, { error: err.message }, status === 413 ? { connection: 'close' } : null);
          return;
        }
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        let agentId = typeof body.agent_id === 'string' ? body.agent_id : '';
        // 兜底解析 "@agent 剩余文本"（前端已解析时 agent_id 直接给出）
        if (!agentId) {
          const m = /^@([^\s@]+)\s+([\s\S]+)$/.exec(text);
          if (m) agentId = m[1];
        }
        if (!agentId) {
          sendJson(res, 400, { error: '需要指定目标 agent（输入 @agent 或提供 agent_id）' });
          return;
        }
        if (!text) {
          sendJson(res, 400, { error: '消息不能为空' });
          return;
        }
        const model = typeof body.model === 'string' && body.model !== '' ? body.model : null;
        if (model !== null && !MODEL_RE.test(model)) {
          sendJson(res, 400, { error: `model 非法（需匹配 ${MODEL_RE}）` });
          return;
        }
        const chatId = typeof body.chat_id === 'string' && body.chat_id ? body.chat_id : `chat-${randomUUID()}`;
        // §4.4：两条独立判定路径，任一条命中即拒收（归档优先；closed 文案与状态码逐字不变）
        const existing = db.getChat(chatId);
        if (existing && (existing.chat.archived_at !== null || existing.chat.state === 'closed')) {
          sendJson(res, 409, {
            error:
              existing.chat.archived_at !== null ? 'chat 已归档（只读），不接受新输入' : 'chat 已关闭，不接受新输入',
          });
          return;
        }
        // 消息文本 = 去掉 @agent 前缀后的剩余内容（入库 text 仍为原文，§4.3）
        const messageText = text.replace(/^@[^\s@]+\s+/, '') || text;
        const taskId = `task-${randomUUID()}`;
        const messageId = `msg-${randomUUID()}`;
        // 1) 先落输入（§4.3：校验通过后、派发之前）+ 推 message(in)/chat_state(working)
        const inAt = Date.now();
        const input = db.insertInput({ chatId, text, agentId, meta: { task_id: taskId }, nowMs: inAt });
        publishMessage(chatId, { id: input.message_id, direction: 'in', agent_id: agentId, text, model: null, duration_ms: null, error: null, created_at: inAt });
        publishState(chatId, 'working');
        // 2) 派发（§9.1 判定顺序：`!` → shell；one_shot → omp 一次性；否则 omp-daemon 常驻上下文）
        const label = messageText.slice(0, LABEL_MAX);
        const payloadBody = messageText.startsWith('!')
          ? { command: '/bin/sh', args: ['-c', messageText.slice(1).trim()], label }
          : body.one_shot === true
            ? { executor: 'omp', prompt: messageText, label, ...(model === null ? {} : { model }) }
            : { executor: 'omp-daemon', chat_id: chatId, prompt: messageText, label, ...(model === null ? {} : { model }) };
        let dispatched = null;
        let warning = null;
        // 登记先于派发（task_id 由 web 预生成并随信封透传，§4.3）：agent 的首个 task.update 可能与
        // send 响应落在同一 socket read（同一次帧循环里 deliver 先被处理）→ 若登记晚于 await，
        // handleDeliver 查不到登记而丢弃首片（终态落盘不受影响，仅实时增量少首片）；失败分支定向清理。
        const entry = { chatId, agentId, lines: [], landed: false, attempts: 0, slow: false, registeredAt: Date.now(), timer: null };
        tasks.set(taskId, entry);
        try {
          const resp = await sendTask(agentId, messageId, taskId, payloadBody);
          dispatched = resp.task_id;
          scheduleReconcile(taskId, entry); // 派发成功即挂对账（收到投递则随之清除）
        } catch (err) {
          tasks.delete(taskId);
          const reason = (err && err.dataCode) || (err && err.message) || String(err);
          warning = `派发失败（${reason}）——消息已记录，agent 恢复后可重发`;
          const outAt = Date.now();
          const outText = `派发失败：${reason}`;
          const out = db.insertOutput({ chatId, text: outText, agentId, error: 'dispatch_failed', nowMs: outAt });
          publishMessage(chatId, { id: out.message_id, direction: 'out', agent_id: agentId, text: outText, model: null, duration_ms: null, error: 'dispatch_failed', created_at: outAt });
          const chat = db.getChat(chatId);
          if (chat) publishState(chatId, chat.chat.state);
        }
        sendJson(res, 200, { chat_id: chatId, task_id: dispatched, message_id: messageId, warning });
        return;
      }
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        serveStatic(res, 'index.html');
        return;
      }
      if (req.method === 'GET' && (p === '/app.js' || p === '/style.css')) {
        serveStatic(res, p.slice(1));
        return;
      }
      sendJson(res, 404, { error: `not found: ${req.method} ${p}` });
    } catch (err) {
      sendJson(res, 502, { error: `router 不可达或请求失败: ${err && err.message ? err.message : err}` });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  process.stdout.write(`WEB_READY url=http://127.0.0.1:${port}\n`);

  return await new Promise((resolve) => {
    let sigint = 0;
    const onSigint = () => {
      sigint += 1;
      if (sigint >= 2) process.exit(130);
      for (const entry of tasks.values()) clearTimeout(entry.timer); // 退出不留悬挂对账定时器
      tasks.clear();
      server.close(() => {
        transport.closeAll();
        db.close();
        if (sender) sender.close();
        resolve(0);
      });
    };
    process.on('SIGINT', onSigint);
  });
}
