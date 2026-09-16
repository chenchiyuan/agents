// src/web.js — `oamp web start [--port N]` 内建 Web 控制台
// 形态：Node 内置 http 服务（零新依赖）serve 静态单页 + JSON API；进程内以 'web' 身份
//       经 NodeClient/RpcPeer 连 Router（UDS）——浏览器不直连 UDS；历史真源 = SQLite（src/persist.js）。
// API：
//   GET  /api/agents                 → Router 拓扑快照（活跃 agent 列表；?state=online 只返回在线实例，与网页列表同一口径）
//   GET  /api/chats                  → chat 列表（读库；q/agent/state/from/to/archived/limit/offset；archived 缺省 0 = 排除已归档，1 = 只看已归档）
//   GET  /api/chats/<chat_id>        → chat 详情（读库；消息 created_at ASC, id ASC）
//   POST /api/messages               → {chat_id?, agent_id, text, model?, one_shot?} 落库 + 派发任务（归档 / 已关闭 → 409）
//   POST /api/chats/archive          → 批量归档（服务端算范围、逐条提交）→ {archived, failed, failed_ids}；不发 SSE
//   POST /api/chats/<chat_id>/close  → 关闭 chat（幂等）+ 通知 agent 释放该 chat 上下文
//   POST /api/chats/<chat_id>/activate → 激活归档 chat（清标记 + closed→completed + 置顶）+ 推送 chat_state
//   POST /api/chats/<chat_id>/rename → 改名（只写 title 一列，不动 updated_at；只读对话 → 409；非法标题 → 400）
//   GET  /api/stream?chat_id=<id>    → SSE（message / task_update / chat_state / notice 四类事件；chat_id 仍强制）
//   GET  /api/events                 → 全局 SSE（agent_online / agent_offline / confirmation / chat_state 四类事件；无参数，不依赖对话）
//   GET  /api/docs                   → 接口元数据投影（文档页 / 调试台 / 索引文件的数据源；请求时从路由表生成）
//   POST /api/calls                  → 发起一次或一批调用（阻塞取终态 / 后台执行）
//   GET  /api/calls                  → 调用 roster（每次调用一行；无过滤 / 无分页 / 无编排）
//   GET  /api/calls/stream?chat_id=<id> → 对话作用域的调用事件流（SSE：call_state / call_update / call_result）
//   GET  /api/calls/<call_id>/stream → 按调用订阅事件流（SSE）
//   GET  /api/calls/<call_id>/transcript → 按调用取转录（进程内，不持久；重启即丢）
//   GET  /api/calls/<call_id>        → 按调用取终态（进行中给状态）
//   GET  /api/confirmations          → 在途确认项列表（跨对话；进程内、不持久；空态为空数组）
//   POST /api/confirmations/<id>/decision → 提交确认项裁决（permission 类 option_id 必填；question 类 option_ids 与 text 至少一个非空；随即移出在途表并回传请求方）
// 错误契约（0015 / F06，architecture §5）：全部 4xx/5xx 响应体 = {error: <人类可读字符串>, code: <ERR_CODE 之一>}，
//   code 与状态码一一映射；成功响应不含 code；既有 error 文案逐字不变（既有前端 api() 零改动）。
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
import * as inbox from './inbox.js'; // 0021 确认面（architecture §6）：在途确认表（进程内、不持久）
import * as principals from './principals.js';
import * as pickup from './pickup.js';
import { instanceIdForRole, roleFromInstanceId } from './role-binding.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根（静态面白名单的基准：URL → 包根相对文件）
const SENDER_ID = 'web'; // web 服务作为常驻发送方身份（R2：客户端节点）
const WEB_BOOT_ID = randomUUID();
const FILTERED_EVENT_KINDS = ['agent_online', 'agent_offline', 'agent_state', 'call_state', 'call_update', 'call_result', 'confirmation'];
const ROSTER_FILE = path.join(PKG_ROOT, '.runtime', 'roster.json');
const DEFAULT_PORT = 7788;
const QUERY_TIMEOUT_MS = 3000;
const MODEL_RE = /^[A-Za-z0-9._/-]{1,128}$/; // §7.2 模型标识形态（web 侧校验，非法 → 400）
const LABEL_MAX = 60; // task label 截断（沿用 0010 web 既有值）
// 0017 pr-002（architecture §4.3）：项目工作约定文本 —— **唯一真源**（不复制进 agent.js）。
// 相对约定：零绝对路径 / 零盘符 / 零主机名、零"自动 clone / 已对齐目录"一类超能力表述；
// 派发装配点在此处取原文注入 payload.body.project.agreement（agent 侧只渲染，不产出文本）。
const PROJECT_AGREEMENT =
  '本项目的工作约定（相对约定，不涉及任何本机路径）：① 若本地尚无该仓库，请先 clone 到自选落点；② 在该仓库根目录下工作；③ 迭代产物（docs 文档、PR、commit、分支）均写入该仓库。';
// 0018 调用面（architecture §2.2 / §2.5 / §4.1）：入参枚举 / 期望结构的受限子集白名单 / 三类调用事件名。
// 受限子集只认 SCHEMA_KEYS 三个键——$ref / oneOf / anyOf / allOf / items / format / pattern / 嵌套 properties
// 一律 400（明确拒绝，不静默忽略）；7 种 type 与 §2.5 逐字一致。
const CALL_MODES = ['background', 'block'];
const SCHEMA_MODES = ['permissive', 'strict'];
const SCHEMA_TYPES = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
const SCHEMA_KEYS = ['type', 'properties', 'required'];
const CALL_EVENTS = { state: 'call_state', update: 'call_update', result: 'call_result' };
const CALL_CONTEXT_TITLE = '【调用共享说明】';
const CALL_SCHEMA_TITLE = '【返回格式要求】';
const CALL_SCHEMA_LINE = '请仅输出一个 JSON 对象，满足以下结构（不要输出 JSON 以外的内容）：';
// pr-007 对账补拉：task.result 的投递可能丢失（发起者离线窗口/投递竞态）——此时 agent 已执行完、
// Router 任务表已终态，而 web 未落 out（对话缺回复）；Router 任务表是权威运行态，故 web 侧轮询兜底补落。
const RECONCILE_DEFAULT_MS = 5000; // 快速对账首查与间隔同值（默认 5s）
const RECONCILE_MAX_ATTEMPTS = 6; // 快速预算：快速频率下 6 次（默认约 30s）用尽后转低频续查
const RECONCILE_SLOW_DEFAULT_MS = 30000; // 低频续查间隔（默认 30s，持续到终态或 shutdown）
const RECONCILE_TTL_DEFAULT_MS = 30 * 60 * 1000; // 登记软 TTL（默认 30 分钟；2026-09-13 起 agent 侧 omp 超时上限亦为 30 分钟 ⇒ 覆盖关系由「有余」变为「持平」，待优化）
// pr-002（F05 / architecture §4.2）：全局拓扑轮询间隔（仅存在全局订阅者时运行）；测试用 env 压缩时间轴。
const TOPOLOGY_POLL_DEFAULT_MS = 2000;
// ★ 0021 pr-004 第 2 轮（F07 验收 3 / N5，主 agent 裁决 Q6）：调用面驱动的 chat 状态变化**不进**全局
// `chat_state` 链路——全局 chat_state 的唯一消费者是前端「对话完成 / 失败」通知派生，而调用面完成明确不
// 产生通知（N5：事件集合不含 `call_completed`）。传此选项 ⇒ 只发定向 `chat:<id>` 帧（形态与时机逐字不变，
// 调用面板照常更新）；不传 = 既有两键行为。
const LOCAL_ONLY = { global: false };

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
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** 只读面单一真源（0013 §4.4 既有口径，0014 提取为具名谓词）：已归档 或 已关闭。
 *  `/api/messages` 的 409 与 `/api/chats/<id>/rename` 的 409 共用本函数（C-3 / D-7：「不分叉」）；
 *  persist 层的 renameChat 语句带同值 SQL 守卫作为结构性兜底（不是第二套口径）。
 *  改这个谓词 ⇒ 必须同时改 renameChat 的 WHERE 与 app.js 的同名函数（三处同值）。 */
function isReadonly(chat) {
  return chat.archived_at !== null || chat.state === 'closed';
}

function sendJson(res, status, body, headers = null) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(headers || {}) });
  res.end(text);
}

/** HTTP 错误机器码（0015 / F06，architecture §5.2）：封闭枚举，每个码只有一个状态码（一一映射）。
 *  与 rpc.js 的 ERR（UDS 协议层机器码）**不同层**，不合并（§5.4）。
 *  具名导出：漂移锁① 以它的取值集合为 `errors` 的白名单（0016 / F06，architecture §3.1 / §7.2）。 */
export const ERR_CODE = Object.freeze({
  INVALID_PARAM: 'INVALID_PARAM', // 400 参数非法 / 缺失 / 请求体格式错误
  NOT_FOUND: 'NOT_FOUND', // 404 未知对象 / 未知路径或方法不匹配
  CONFLICT: 'CONFLICT', // 409 只读对象被写 / 对象当前状态不允许该操作
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE', // 413 请求体超限
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE', // 502 Router 不可达 / 内部故障兜底
  STALE_EPOCH: 'STALE_EPOCH', // 409 客户端持有的易失会话代次已过期
});

/** 错误响应唯一构造点（architecture §5.3）：`error` 仍是人类可读字符串（既有文案逐字不变 ⇒ 既有调用方零改动），
 *  `code` 为新增机器码。全部 4xx/5xx 出口必须过这里（"同类错误跨接口一致"由唯一构造点保证）。 */
function sendError(res, status, code, message, headers = null) {
  sendJson(res, status, { error: message, code }, headers);
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
function parseCsv(value) {
  return value === null || value === '' ? [] : value.split(',').map((item) => item.trim()).filter(Boolean);
}

function validPrincipalId(value) {
  return principals.requesterOf({ principal_id: value }) !== null &&
    principals.requesterOf({ principal_id: value }).principal_id.length <= 64 &&
    /^[\x21-\x7e]+$/.test(value);
}

function principalEpoch(webBootId, routerGeneration) {
  return `${webBootId}.${routerGeneration || '0'}`;
}

function deriveAgentWork(taskRows) {
  const work = new Map();
  for (const task of taskRows || []) {
    if (!task || typeof task.to !== 'string') continue;
    let row = work.get(task.to);
    if (!row) {
      row = { busy: false, current_call_id: null, queued: 0, since: null, started: -Infinity };
      work.set(task.to, row);
    }
    if (task.state === 'submitted') row.queued += 1;
    if (task.state === 'working' && (task.started_at ?? -Infinity) >= row.started) {
      row.busy = true;
      row.current_call_id = task.task_id;
      row.since = task.started_at ?? null;
      row.started = task.started_at ?? -Infinity;
    }
  }
  return work;
}

/** 实例状态投影（F05 / F16 / architecture §4 A-04）：节点快照 + 任务表 ⇒ 每实例五字段（`connected` + 四字段）。
 *  快照面（`GET /api/agents`）与推送面（`agent_state` 帧）**共用本函数** ⇒ 两处同源、不各算一份；
 *  四字段是**追加的投影列**，不参与 `?state=` 过滤（既有在线口径仍是 `state === 'online'`）。 */
export function projectAgentState(nodes, taskRows) {
  const work = deriveAgentWork(taskRows);
  const rows = new Map();
  for (const node of nodes || []) {
    const w = work.get(node.instance_id);
    rows.set(node.instance_id, {
      connected: node.connected === true,
      busy: w ? w.busy : false,
      current_call_id: w ? w.current_call_id : null,
      queued: w ? w.queued : 0,
      since: w ? w.since : null,
    });
  }
  return rows;
}

/** agent 状态投影轮询器（F05 验收 5 / A-04）：与拓扑轮询同间隔、**独立键控** —— 仅当存在 `agent_state` 订阅者
 *  时运行（零订阅者 ⇒ 零新增 UDS 流量）；每 tick 拉 `router.status` + `router.task_list` 投影五字段，
 *  与上一 tick **有变化才发**一帧 `agent_state`（播种基线不发事件、订阅建立不发初始帧：当前值走快照面）。 */
export function createAgentStateWatch({ transport, subscribers, queryNodes, queryTasks, pollMs }) {
  let timer = null;
  let prev = null; // Map<instance_id, 五字段>；null = 尚未播种
  const same = (a, b) => a.connected === b.connected && a.busy === b.busy &&
    a.current_call_id === b.current_call_id && a.queued === b.queued && a.since === b.since;

  function stop() {
    clearInterval(timer);
    timer = null;
    prev = null; // 丢弃基线：下次订阅重新播种，不补发订阅空窗期的变化
  }

  async function tick() {
    if (subscribers.size === 0) {
      stop();
      return;
    }
    let nodes;
    let taskRows;
    try {
      nodes = await queryNodes();
      taskRows = await queryTasks();
    } catch {
      return; // Router 暂不可达：本轮不更新基线（不产生虚假状态帧）
    }
    if (subscribers.size === 0) {
      stop(); // 查询在途期间订阅者全部断开
      return;
    }
    const rows = projectAgentState(nodes, taskRows);
    const seeded = prev !== null;
    const changed = [];
    if (seeded) {
      for (const [instanceId, row] of rows) {
        const before = prev.get(instanceId);
        if (before === undefined || !same(before, row)) changed.push({ instance_id: instanceId, ...row });
      }
    }
    prev = rows;
    for (const data of changed) transport.publishFiltered({ type: 'agent_state', data });
  }

  /** 订阅建立后调用：有 `agent_state` 订阅者而轮询未运行 ⇒ 起表并立即播种一次（重复调用不起第二个表）。 */
  function ensureRunning() {
    if (subscribers.size === 0 || timer !== null) return;
    prev = null;
    timer = setInterval(() => {
      tick().catch(() => {});
    }, pollMs);
    timer.unref(); // 不阻滞进程退出
    tick().catch(() => {});
  }

  return { ensureRunning, stop };
}

/** 全局事件差值（F05 / architecture §4.2「纯函数边界」）：prev = 上一 tick 的在线集合
 *  （Map<instance_id, last_heartbeat>），nodes = `router.status` 的 4 字段节点数组。
 *  返回 {online, offline, next}：online = 新增（带 last_heartbeat，订阅端无需回查即可插入列表项）；
 *  offline = 消失（只需 instance_id）。非 online 状态（含 offline 墓碑）不进入 next。 */
export function diffTopology(prev, nodes) {
  const next = new Map();
  for (const n of nodes || []) {
    if (n && n.state === 'online') next.set(n.instance_id, n.last_heartbeat);
  }
  const online = [];
  const offline = [];
  for (const [instanceId, lastHeartbeat] of next) {
    if (!prev.has(instanceId)) online.push({ instance_id: instanceId, last_heartbeat: lastHeartbeat });
  }
  for (const instanceId of prev.keys()) {
    if (!next.has(instanceId)) offline.push({ instance_id: instanceId });
  }
  return { online, offline, next };
}

/** 拓扑轮询器（F05 / architecture §4.2）：判定源 = `router.status` 的 online 集合（注册表为唯一真源，
 *  不是日志、不是新通道）。仅在存在全局订阅者时每 pollMs 拉一次并差分成 agent_online / agent_offline；
 *  首个订阅者到达时**播种基线且不发事件**（杜绝"虚报上线"）；无订阅者 ⇒ tick 自停并丢弃基线（零常驻轮询）；
 *  查询失败（Router 暂不可达）⇒ 该 tick 跳过、不更新基线（§16 R-4，不产生虚假上下线）。 */
export function createTopologyWatch({ transport, queryNodes, pollMs }) {
  let timer = null;
  let prev = null; // Map<instance_id, last_heartbeat>；null = 尚未播种

  function stop() {
    clearInterval(timer); // 无表时 no-op
    timer = null;
    prev = null; // 丢弃基线：下次订阅重新播种，不补发订阅空窗期的变化（§4.4）
  }

  async function tick() {
    if (transport.globalCount() === 0) {
      stop();
      return;
    }
    let nodes;
    try {
      nodes = await queryNodes();
    } catch {
      return; // Router 暂不可达：本轮不更新基线（不产生虚假上下线）
    }
    if (transport.globalCount() === 0) {
      stop(); // 查询在途期间订阅者全部断开
      return;
    }
    const seeded = prev !== null;
    const { online, offline, next } = diffTopology(prev === null ? new Map() : prev, nodes);
    prev = next;
    if (!seeded) return; // 首个订阅者：播种基线，不发事件
    for (const data of online) {
      const event = { type: 'agent_online', data };
      transport.publishGlobal(event);
      transport.publishFiltered(event);
    }
    for (const data of offline) {
      const event = { type: 'agent_offline', data };
      transport.publishGlobal(event);
      transport.publishFiltered(event);
    }
  }

  /** 订阅建立后调用：已有全局订阅者但轮询未运行 ⇒ 起表并立即播种一次（重复调用不起第二个表）。 */
  function ensureRunning() {
    if (transport.globalCount() === 0 || timer !== null) return;
    prev = null;
    timer = setInterval(() => {
      tick().catch(() => {});
    }, pollMs);
    timer.unref(); // 不阻滞进程退出
    tick().catch(() => {});
  }

  return { ensureRunning, stop };
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

// ────────────────────────── 0018 调用面纯函数（architecture §2.2 / §2.5 / §3.1 / §3.3 / §5） ──────────────────────────

/** 实例名 → 角色名（§5）：薄封装——推导规则（前缀拼接 + 角色文件存在性）只在 src/role-binding.js 一处，此处不复制。 */
function roleOfInstance(instanceId) {
  return roleFromInstanceId(instanceId);
}

/** 截断标记（MI-06，单一真源、OR 口径）：过程记录 1000 条封顶 或 增量行控制条目（`event:'truncated'`）已下发。 */
function callTruncated(task) {
  return task.updatesTruncated === true || task.updates.some((u) => u.detail?.event === 'truncated');
}

/** 期望返回结构的受限子集校验（§2.5）：合法 ⇒ 规范化结构（type 缺省 object）；非法 ⇒ null（调用方 400，不静默忽略）。 */
function validateOutputSchema(schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return null;
  // 只认 SCHEMA_KEYS 三个键：$ref / oneOf / anyOf / allOf / items / format / pattern 等一律判非法
  if (Object.keys(schema).some((key) => !SCHEMA_KEYS.includes(key))) return null;
  const type = schema.type === undefined ? 'object' : schema.type;
  if (!SCHEMA_TYPES.includes(type)) return null;
  const properties = schema.properties;
  if (properties !== undefined) {
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return null;
    for (const prop of Object.values(properties)) {
      // 每个属性只允许 {type: <7 种之一>}：出现第二个键（含嵌套 properties）即非法
      if (prop === null || typeof prop !== 'object' || Array.isArray(prop)) return null;
      const keys = Object.keys(prop);
      if (keys.length !== 1 || keys[0] !== 'type' || !SCHEMA_TYPES.includes(prop.type)) return null;
    }
  }
  const required = schema.required;
  if (required !== undefined) {
    if (!Array.isArray(required)) return null;
    // required 的每个名字必须出现在 properties 中
    for (const name of required) {
      if (typeof name !== 'string' || properties === undefined || !Object.hasOwn(properties, name)) return null;
    }
  }
  return {
    type,
    ...(properties === undefined ? {} : { properties }),
    ...(required === undefined ? {} : { required }),
  };
}

/** 从终态文本提取结构化输出（§2.5）：① 裸 JSON；② 失败则剥离一层 ``` 围栏（含 ```json 标注）后重试；③ 仍失败 null。 */
function extractStructuredOutput(text) {
  if (typeof text !== 'string') return null;
  const raw = text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // 继续剥围栏
  }
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(raw);
  if (fenced === null) return null;
  try {
    return JSON.parse(fenced[1].trim());
  } catch {
    return null;
  }
}

/** 受限子集三层校验（§2.5）：`type` / `required` / `properties.<名>.type`；未声明键**不**判错。 */
function validateAgainstSchema(value, schema) {
  /** 7 种类型词表 ↔ JS 运行时形态。 */
  const isType = (v, t) => {
    if (t === 'null') return v === null;
    if (t === 'array') return Array.isArray(v);
    if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
    return typeof v === t; // string / boolean
  };
  const type = schema.type === undefined ? 'object' : schema.type;
  if (!isType(value, type)) return false;
  if (type !== 'object') return true; // 非对象形态没有 required / properties 两层
  const properties = schema.properties === undefined ? {} : schema.properties;
  for (const name of schema.required === undefined ? [] : schema.required) {
    if (value[name] === undefined) return false; // 缺 required 键
  }
  for (const [name, prop] of Object.entries(properties)) {
    if (value[name] === undefined) continue; // 可选键缺席不判错
    if (!isType(value[name], prop.type)) return false;
  }
  return true;
}

/** 调用 prompt 装配（§2.2，web 侧唯一装配点）：共享说明（前置）→ task 原文（逐字，零前缀污染）→ 返回格式要求（后置），以空行连接。 */
function composeCallPrompt({ context, task, outputSchema }) {
  const blocks = [];
  if (typeof context === 'string' && context.trim() !== '') blocks.push(`${CALL_CONTEXT_TITLE}\n${context}`);
  blocks.push(task);
  if (outputSchema !== null) blocks.push(`${CALL_SCHEMA_TITLE}\n${CALL_SCHEMA_LINE}\n${JSON.stringify(outputSchema)}`);
  return blocks.join('\n\n');
}

/** 调用信封（§3.1，唯一形状）：受理 / 进行中 / 终态三态共用同一 11 键与键序。
 *  `call` = 调用面登记（提供 output_schema / schema_mode；无登记 ⇒ structured_output 恒 null）。 */
function composeCallEnvelope(task, call = null) {
  const result = task.result ?? null;
  const schema = call === null ? null : call.outputSchema;
  const extracted = schema === null ? null : extractStructuredOutput(result?.text ?? null);
  const structured = extracted !== null && validateAgainstSchema(extracted, schema) ? extracted : null;
  // strict 且终态成功但结构未通过 ⇒ 终态词仍是闭集内的 failed + 机器可读原因（§2.5，不新增终态词）
  const invalid = schema !== null && call.schemaMode === 'strict' && task.state === 'completed' && structured === null;
  return {
    call_id: task.task_id,
    agent: roleOfInstance(task.to),
    state: invalid ? 'failed' : task.state,
    duration_ms: result?.duration_ms ?? null,
    model: result?.model ?? null,
    truncated: callTruncated(task),
    text: result?.text ?? null,
    structured_output: structured,
    error: invalid ? 'structured_output_invalid' : (result?.error ?? null),
    exit_code: result?.exit_code ?? null,
  };
}

/** 调用状态单一读法（★ pr-003 修复轮 FIX-1，§2.5 的 strict 覆写落到终态写入处）：终态在 `publishCallResult`
 *  一次记入调用登记（`call.terminal`）⇒ 信封 / roster / 转录三面读**同一记录**——F09 验收 3 的「状态与事实
 *  一致」由单一写点保证，不靠约定；无登记 / 未终态 ⇒ 任务记录原值（既有无 schema 面零变化）。 */
function callState(task, call) {
  return call?.terminal?.state ?? task.state;
}

function serveStatic(res, file) {
  const full = path.join(PKG_ROOT, file);
  if (!full.startsWith(PKG_ROOT)) {
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

/** 静态面显式白名单（URL 路径 → 包根相对文件；不在接口登记内，architecture §3.7）：
 *  两个登记面互相独立——接口面（路由表）供文档页 / 调试台 / 索引文件消费，静态面只按固定文件名提供（不做通配、不做目录索引）。 */
const STATIC_FILES = {
  '/': 'web/index.html',
  '/index.html': 'web/index.html',
  '/app.js': 'web/app.js',
  '/style.css': 'web/style.css',
  '/docs': 'web/docs.html',
  '/docs.js': 'web/docs.js',
  '/debug': 'web/debug.html',
  '/debug.js': 'web/debug.js',
  '/api-pages.css': 'web/api-pages.css',
  '/llms.txt': 'llms.txt',
  '/API.md': 'API.md',
  '/README.md': 'README.md',
  // ★ 0018（F13 / architecture §6）：控制台调用面独立静态页（页面本体属 pr-004；本 PR 内 serveStatic 走 ENOENT → 404）
  '/calls': 'web/calls.html',
  '/calls.js': 'web/calls.js',
  // ★ 0021 pr-003（architecture §5.5 / §7 T-12）：通知模块（页面本体属 pr-004；本 PR 内 serveStatic 走 ENOENT → 404）
  '/notify.js': 'web/notify.js',
};

/** 路由表字段清单（0016 / F06）：登记、投影与三条漂移锁共用同一份，锁与实现不各抄一份。 */
export const ROUTE_META_FIELDS = ['method', 'path', 'summary', 'params', 'response', 'errors', 'kind', 'docLink'];
export const PARAM_FIELDS = ['name', 'in', 'type', 'required', 'desc'];
export const PARAM_IN = ['path', 'query', 'body'];
export const PARAM_TYPES = ['string', 'number', 'boolean', 'json'];
export const ROUTE_KINDS = ['json', 'sse'];

/** 路径模式 → 匹配描述（architecture §3.3 的等价实现，两种形态，不引入正则）：
 *  ① 无参数段 ⇒ exact：`pathname === path`（复刻今日 `p === '…'`）；
 *  ② 单参数段 ⇒ prefixSuffix：`startsWith(前缀) && endsWith(后缀)` + `slice(前缀长度, -后缀长度)` 双侧截取——
 *     原样复刻今日 `p.startsWith('/api/chats/') && p.endsWith('/close')` 的语义（**后缀可与前缀尾斜杠重叠**：
 *     `POST /api/chats/close` 的参数是空串，而不是"不命中"）；
 *  不做大小写 / 尾斜杠 / 路径归一（复刻 `URL.pathname` 原文比较）。多参数段不在本轮登记内，构造期直接报错。 */
function compileRouteMatcher(pathPattern) {
  const segments = pathPattern.split('/');
  const paramIndexes = segments.flatMap((seg, i) => (seg.startsWith(':') ? [i] : []));
  if (paramIndexes.length === 0) {
    return { extract: (pathname) => (pathname === pathPattern ? {} : null) };
  }
  if (paramIndexes.length > 1) throw new Error(`路由路径不支持多参数段: ${pathPattern}`);
  const [paramIndex] = paramIndexes;
  const paramName = segments[paramIndex].slice(1);
  const prefix = `${segments.slice(0, paramIndex).join('/')}/`;
  const suffix = paramIndex + 1 < segments.length ? `/${segments.slice(paramIndex + 1).join('/')}` : '';
  return {
    extract: (pathname) => {
      if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
      return { [paramName]: pathname.slice(prefix.length, pathname.length - suffix.length) };
    },
  };
}

/** 有序路由表（0016 / F01，architecture §3.1 / §3.2）：一项 = 8 个元数据字段 + handler（登记只有这一处）。
 *  表顺序 = 匹配优先级 = 改造前 `if` 链顺序；新增表项默认追加末位——任何 `GET /api/chats/<字面量>` 形态的
 *  新接口必须登记在 `GET /api/chats/:chat_id` 之前（可达性断言会点名被吞掉的那一项）。
 *  handler 体逐字沿用改造前的分支实现，只把闭包引用改为入参解构（`query: qs` / `num` / `params`）。
 *  纯构造：不调用依赖、不读磁盘、不起定时器 ⇒ 漂移锁可直接 `createApiRoutes({})` 取真实表项。 */
export function createApiRoutes({
  db, transport, config, topologyWatch, tasks, callSchemas, publishMessage, publishState, sendTask, sendControlNotice, scheduleReconcile,
  getEpoch = async () => 'unknown', checkEpoch = async () => null, getAgentProjection = async (nodes) => nodes,
  onFilteredSubscription = () => {}, agentStateSubscribers = new Set(), waiters = new Map(), settleCancelledCall = () => {},
}) {
  const routes = [
    {
      method: 'GET',
      path: '/api/agents',
      summary: '在线 agent 列表（Router 拓扑快照；?state=online 只返回在线实例）',
      params: [
        { name: 'state', in: 'query', type: 'string', required: false, enum: ['online'], desc: '只接受 online：只返回在线实例；省略或传空 = 返回全部（含 offline 墓碑）' },
      ],
      response: '对象 { agents: [{ instance_id, session_id, state, last_heartbeat, role }] }（0029 pr-005：每行追加 connected / busy / current_call_id / queued / since）',
      errors: ['INVALID_PARAM'],
      kind: 'json',
      docLink: 'API.md#31-get-apiagents',
      handler: async ({ res, query: qs }) => {
        const r = await queryOnce(config.socketPath, 'router.status', {});
        // ?state=online（F04 验收 2 / §6.2）：服务端过滤，响应形态与无参**同形状**；无参路径逐字透传
        // router.status（含 offline 墓碑）。在线口径 = `state === 'online'`（§16 R-10）。
        const projected = await getAgentProjection(r.nodes);
        // ★ 0029 pr-005（F05 / F16 / A-04）：每行**追加** `connected` + 四字段（`busy / current_call_id / queued / since`）
        // —— 服务端推导，来源 = 节点快照（`connected`）与 `router.task_list`（四字段）；四字段**不参与** `?state=` 过滤。
        // 快照按请求现拉任务表 ⇒ 取值与当刻事实同源（与 `calls get` 不漂移）；后台投影 tick 只在有订阅者时运行。
        const work = projectAgentState(projected, (await queryOnce(config.socketPath, 'router.task_list', {})).tasks);
        const agentState = qs.get('state');
        // ★ 0018（F03 / architecture §5）：每个节点**追加** role = 角色名（实例名可反解且角色文件存在时）或 null；
        // 其余 4 字段名 / 值 / 顺序逐字不变（role 追加在末位）。
        // ★ 0029 pr-005：五字段投影追加在 role 之后；推导只走 roleOfInstance 与 projectAgentState，不复制公式。
        const withRole = (nodes) => nodes.map((n) => ({ ...n, role: roleFromInstanceId(n.instance_id), ...work.get(n.instance_id) }));
        if (agentState === null || agentState === '') {
          sendJson(res, 200, { agents: withRole(projected) });
          return;
        }
        if (agentState !== 'online') {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, `查询参数非法: state 需为 online（当前值 ${JSON.stringify(agentState)}）`);
          return;
        }
        sendJson(res, 200, { agents: withRole(projected.filter((n) => n.state === 'online')) });
        return;
      },
    },
    {
      method: 'POST',
      path: '/api/principals',
      summary: '注册客户端身份（幂等）',
      params: [
        { name: 'principal_id', in: 'body', type: 'string', required: true, desc: '身份 id：非空、长度 <= 64、仅可打印 ASCII' },
        { name: 'kind', in: 'body', type: 'string', required: false, desc: '调用方自述类别' },
        { name: 'instance_id', in: 'body', type: 'string', required: false, desc: '调用方自述实例 id' },
      ],
      response: '对象 { principal, epoch }',
      errors: ['INVALID_PARAM'],
      kind: 'json',
      docLink: 'API.md#322-post-apiprincipals',
      handler: async ({ req, res }) => {
        let body;
        try { body = await readBody(req); } catch (err) {
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message);
          return;
        }
        const decl = principals.requesterOf(body);
        if (decl === null) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'principal_id 非法（需为非空、<=64 字符的可打印 ASCII）');
          return;
        }
        const result = principals.upsert(decl);
        if (result.error) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'principal_id 非法（需为非空、<=64 字符的可打印 ASCII）');
          return;
        }
        sendJson(res, 200, { principal: result.principal, epoch: await getEpoch() });
      },
    },
    {
      method: 'GET',
      path: '/api/principals/:principal_id',
      summary: '查询客户端身份',
      params: [{ name: 'principal_id', in: 'path', type: 'string', required: true, desc: '身份 id' }],
      response: '对象 { principal, epoch }',
      errors: ['NOT_FOUND', 'INVALID_PARAM'],
      kind: 'json',
      docLink: 'API.md#323-get-apiprincipalsprincipal_id',
      handler: async ({ res, params }) => {
        const id = params.principal_id;
        if (!validPrincipalId(id)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'principal_id 非法（需为非空、<=64 字符的可打印 ASCII）');
          return;
        }
        const principal = principals.touch(id);
        if (!principal) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `principal 不存在: ${id}`);
          return;
        }
        sendJson(res, 200, { principal, epoch: await getEpoch() });
      },
    },
    {
      method: 'GET',
      path: '/api/chats',
      summary: '对话列表（搜索 / 过滤 / 分页；默认排除已归档）',
      params: [
        { name: 'q', in: 'query', type: 'string', required: false, desc: '关键词：匹配标题或任意消息正文（子串匹配，% / _ / \\ 按字面量转义）' },
        { name: 'agent', in: 'query', type: 'string', required: false, desc: '只列该 agent 相关（对话的 agent_id 命中，或对话中存在该 agent 的消息）' },
        { name: 'state', in: 'query', type: 'string', required: false, enum: ['working', 'completed', 'failed', 'closed'], desc: '对话状态过滤；非法枚举值 → 400 INVALID_PARAM' },
        { name: 'from', in: 'query', type: 'number', required: false, desc: 'updated_at >= from（epoch ms）；与 to 同为毫秒整数，from > to → 400' },
        { name: 'to', in: 'query', type: 'number', required: false, desc: 'updated_at <= to（epoch ms）' },
        { name: 'archived', in: 'query', type: 'number', required: false, enum: ['0', '1'], desc: '0 = 排除已归档（默认，主列表）；1 = 只看已归档（按归档时间倒序）' },
        { name: 'limit', in: 'query', type: 'number', required: false, desc: '每页条数，取值 1..200（默认 50）；非整数或越界 → 400' },
        { name: 'offset', in: 'query', type: 'number', required: false, desc: '偏移，非负整数（默认 0）' },
      ],
      response: '对象 { chats: [{ chat_id, title, agent_id, state, created_at, updated_at, archived_at, message_count }], total, limit, offset }',
      errors: ['INVALID_PARAM'],
      kind: 'json',
      docLink: 'API.md#32-get-apichats',
      handler: async ({ res, query: qs, num }) => {
        let r;
        try {
          r = db.listChats({
            project: qs.get('project_id') ?? undefined, // 必填（§3.2）；缺参与空值都由 persist 抛错 → 既有 catch 转 400
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
          sendError(res, 400, ERR_CODE.INVALID_PARAM, err && err.message ? err.message : String(err));
          return;
        }
        sendJson(res, 200, r);
        return;
      },
    },
    {
      method: 'GET',
      path: '/api/chats/:chat_id',
      summary: '对话详情（含消息，按 created_at ASC, id ASC）',
      params: [
        { name: 'chat_id', in: 'path', type: 'string', required: true, desc: '目标对话 id（按 URI 解码）；不存在 → 404 NOT_FOUND' },
      ],
      response: '对象 { chat: { chat_id, title, agent_id, state, created_at, updated_at, closed_at, archived_at, context_released }, messages: [{ id, direction, agent_id, text, model, duration_ms, error, created_at, meta }] }',
      errors: ['NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#33-get-apichatschat_id',
      handler: async ({ res, params }) => {
        const chatId = params.chat_id;
        const r = db.getChat(chatId);
        if (!r) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `chat 不存在: ${chatId}`);
          return;
        }
        sendJson(res, 200, r);
        return;
      },
    },
    {
      method: 'POST',
      path: '/api/chats/:chat_id/close',
      summary: '关闭对话（置 closed、只读；幂等）+ 通知相关 agent 释放上下文',
      params: [
        { name: 'chat_id', in: 'path', type: 'string', required: true, desc: '目标对话 id（按 URI 解码）；不存在 → 404 NOT_FOUND' },
      ],
      response: '对象 { chat_id, state }（幂等：已 closed 的对话返回同形状且不重复发释放通知）',
      errors: ['NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#34-post-apichatschat_idclose',
      handler: async ({ res, params }) => {
        const chatId = params.chat_id;
        const found = db.getChat(chatId);
        if (!found) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `chat 不存在: ${chatId}`);
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
      },
    },
    {
      method: 'POST',
      path: '/api/chats/archive',
      summary: '批量归档（服务端算范围、逐条提交；不发 SSE）',
      params: [],
      response: '对象 { archived, failed, failed_ids }',
      errors: [],
      kind: 'json',
      docLink: 'API.md#35-post-apichatsarchive',
      handler: async ({ res }) => {
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
      },
    },
    {
      method: 'POST',
      path: '/api/chats/:chat_id/activate',
      summary: '激活归档对话（清标记 + 状态还原 + 置顶）',
      params: [
        { name: 'chat_id', in: 'path', type: 'string', required: true, desc: '目标对话 id（按 URI 解码）；不存在 → 404 NOT_FOUND' },
      ],
      response: '对象 { chat_id, state }（同时向该对话订阅者推送 chat_state）',
      errors: ['NOT_FOUND', 'CONFLICT'],
      kind: 'json',
      docLink: 'API.md#36-post-apichatschat_idactivate',
      handler: async ({ res, params }) => {
        const chatId = params.chat_id;
        const found = db.getChat(chatId);
        if (!found) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `chat 不存在: ${chatId}`);
          return;
        }
        if (found.chat.archived_at === null) {
          sendError(res, 409, ERR_CODE.CONFLICT, 'chat 未归档，无法激活'); // N-5：非归档的 closed 在此被挡住
          return;
        }
        if (!db.activateChat(chatId)) {
          sendError(res, 409, ERR_CODE.CONFLICT, 'chat 未归档，无法激活'); // 防御性：② 之后已非归档（单进程下不可达）
          return;
        }
        const after = db.getChat(chatId);
        publishState(chatId, after.chat.state); // §5.3 ④：状态读库值，不在 JS 里复刻 SQL 的 CASE
        sendJson(res, 200, { chat_id: chatId, state: after.chat.state });
        return;
      },
    },
    {
      method: 'POST',
      path: '/api/chats/:chat_id/rename',
      summary: '重命名对话（只写 title，不动 updated_at）',
      params: [
        { name: 'chat_id', in: 'path', type: 'string', required: true, desc: '目标对话 id（按 URI 解码）；不存在 → 404 NOT_FOUND' },
        { name: 'title', in: 'body', type: 'string', required: true, desc: '新标题：trim 后非空且长度 <= 100（UTF-16 code unit）' },
      ],
      response: '对象 { chat_id, title }',
      errors: ['INVALID_PARAM', 'PAYLOAD_TOO_LARGE', 'NOT_FOUND', 'CONFLICT'],
      kind: 'json',
      docLink: 'API.md#37-post-apichatschat_idrename',
      handler: async ({ req, res, params }) => {
        const chatId = params.chat_id;
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message, status === 413 ? { connection: 'close' } : null);
          return;
        }
        // 处理顺序固定（§5.2）：读体（400/413）→ getChat 预检（404）→ isReadonly 预检（409）→ 写口（400/409）→ 200
        const found = db.getChat(chatId);
        if (!found) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `chat 不存在: ${chatId}`);
          return;
        }
        if (isReadonly(found.chat)) {
          sendError(
            res,
            409,
            ERR_CODE.CONFLICT,
            found.chat.archived_at !== null ? 'chat 已归档（只读），不可改名' : 'chat 已关闭（只读），不可改名',
          );
          return;
        }
        let title;
        try {
          // `?? {}`：非对象请求体统一落到 readTitle 的"需为字符串" → 400（不抛 TypeError 被外层 catch 转 502）
          title = db.renameChat({ chatId, title: (body ?? {}).title });
        } catch (err) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, err && err.message ? err.message : String(err)); // 非法标题（唯一入参错误类）
          return;
        }
        if (title === null) {
          // 防御性：预检通过后行被置为只读（单进程 + 同步语句下不可达）——不得静默返回成功
          sendError(res, 409, ERR_CODE.CONFLICT, 'chat 只读（已归档或已关闭），不可改名');
          return;
        }
        sendJson(res, 200, { chat_id: chatId, title });
        return;
      },
    },
    {
      method: 'GET',
      path: '/api/stream',
      summary: '按对话订阅实时事件（SSE：message / task_update / chat_state / notice）',
      params: [
        { name: 'chat_id', in: 'query', type: 'string', required: true, desc: '目标对话；缺参或传空 → 400 INVALID_PARAM（本路径不做全局订阅）' },
      ],
      response: 'SSE 事件流（text/event-stream）：message / task_update / chat_state / notice',
      errors: ['INVALID_PARAM'],
      kind: 'sse',
      docLink: 'API.md#39-get-apistreamchat_idid',
      handler: async ({ req, res, query: qs }) => {
        const chatId = qs.get('chat_id');
        if (!chatId) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 chat_id（不做全局订阅）'); // 文案逐字不变（F05 验收 3）
          return;
        }
        transport.handle(req, res, { chatId });
        return;
      },
    },
    {
      method: 'GET',
      path: '/api/events',
      summary: '全局事件订阅（SSE：agent_online / agent_offline / confirmation / chat_state）',
      params: [],
      response: 'SSE 事件流（text/event-stream）：agent_online / agent_offline / confirmation / chat_state',
      errors: [],
      kind: 'sse',
      docLink: 'API.md#310-get-apievents',
      handler: async ({ req, res }) => {
        // 全局订阅（F05 / §4.1）：无参数、键 = null；先注册订阅者再启动轮询（确保 globalCount ≥ 1）
        transport.handle(req, res, { chatId: null });
        topologyWatch.ensureRunning();
        return;
      },
    },
    {
      method: 'GET',
      path: '/api/subscribe',
      summary: '按事件类型和 agent 过滤的事件订阅（SSE）',
      params: [
        { name: 'principal', in: 'query', type: 'string', required: true, desc: '订阅方 principal_id' },
        { name: 'epoch', in: 'query', type: 'string', required: false, desc: '会话代次；过期返回 409 STALE_EPOCH' },
        { name: 'kinds', in: 'query', type: 'string', required: false, desc: '逗号分隔：agent_online,agent_offline,agent_state,call_state,call_update,call_result,confirmation' },
        { name: 'agents', in: 'query', type: 'string', required: false, desc: '逗号分隔 agent role 或 instance_id；省略表示全部' },
      ],
      response: 'SSE 事件流（text/event-stream）；仅推送匹配的过滤事件，不发送初始快照',
      errors: ['INVALID_PARAM', 'STALE_EPOCH'],
      kind: 'sse',
      docLink: 'API.md#311-get-apisubscribe',
      handler: async ({ req, res, query: qs }) => {
        const principalId = qs.get('principal');
        if (!validPrincipalId(principalId)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要合法 principal');
          return;
        }
        const stale = await checkEpoch(qs.get('epoch'));
        if (stale !== null) {
          sendError(res, 409, ERR_CODE.STALE_EPOCH, stale);
          return;
        }
        const kinds = parseCsv(qs.get('kinds'));
        const agents = parseCsv(qs.get('agents'));
        if (kinds.some((kind) => !FILTERED_EVENT_KINDS.includes(kind))) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'kinds 含非法事件类型');
          return;
        }
        const principal = principals.upsert({ principal_id: principalId });
        if (principal.error) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, principal.error);
          return;
        }
        principals.touch(principalId);
        const matchesAgent = (event) => {
          if (agents.length === 0) return true;
          const data = event && event.data && typeof event.data === 'object' ? event.data : {};
          const candidates = new Set();
          for (const key of ['agent', 'agent_id', 'instance_id', 'to']) {
            if (typeof data[key] !== 'string') continue;
            candidates.add(data[key]);
            candidates.add(roleFromInstanceId(data[key]));
            try { candidates.add(instanceIdForRole(data[key])); } catch {}
          }
          return agents.some((agent) => candidates.has(agent));
        };
        const predicate = (event) => (
          (kinds.length === 0 || kinds.includes(event.type)) &&
          matchesAgent(event)
        );
        transport.handleSubscribe(req, res, { predicate });
        if (kinds.length === 0 || kinds.includes('agent_state')) {
          agentStateSubscribers.add(res);
          req.once('close', () => agentStateSubscribers.delete(res));
        }
        // 订阅者**已登记**后才起投影 tick（`ensureRunning` 以订阅者数为前提）。
        onFilteredSubscription({ principal: principal.principal, kinds, agents });
        return;
      },
    },
    {
      method: 'POST',
      path: '/api/messages',
      summary: '发送消息（落库 + 派发任务；归档 / 已关闭 → 409）',
      params: [
        { name: 'chat_id', in: 'body', type: 'string', required: false, desc: '目标对话；不存在则新建（title 取正文前 40 字符），缺省自动生成 chat-<uuid>' },
        { name: 'agent_id', in: 'body', type: 'string', required: false, desc: '目标 agent 实例 id；省略时从 text 的 @agent 前缀解析（两者皆无 → 400）' },
        { name: 'text', in: 'body', type: 'string', required: true, desc: '消息正文（trim 后不得为空）；以 ! 开头 ⇒ 走 shell 执行' },
        { name: 'model', in: 'body', type: 'string', required: false, desc: '模型标识，须匹配 ^[A-Za-z0-9._/-]{1,128}$；缺省用默认模型链' },
        { name: 'one_shot', in: 'body', type: 'boolean', required: false, desc: 'true = 一次性执行（不累积上下文）；缺省 false = 常驻上下文' },
      ],
      response: '对象 { chat_id, task_id, message_id, warning }（warning 非 null = 派发失败但已落库，状态码仍 200）',
      errors: ['INVALID_PARAM', 'PAYLOAD_TOO_LARGE', 'CONFLICT'],
      kind: 'json',
      docLink: 'API.md#38-post-apimessages',
      handler: async ({ req, res }) => {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          // 客户端错误（畸形 JSON → 400 / 超限 → 413）：明确响应；超限时关闭连接，不留悬挂
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message, status === 413 ? { connection: 'close' } : null);
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
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要指定目标 agent（输入 @agent 或提供 agent_id）');
          return;
        }
        if (!text) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '消息不能为空');
          return;
        }
        const model = typeof body.model === 'string' && body.model !== '' ? body.model : null;
        if (model !== null && !MODEL_RE.test(model)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, `model 非法（需匹配 ${MODEL_RE}）`);
          return;
        }
        const chatId = typeof body.chat_id === 'string' && body.chat_id ? body.chat_id : `chat-${randomUUID()}`;
        // §4.4：只读面（已归档 或 已关闭）——判定与 /rename 共用 isReadonly（C-3 不分叉）；归档分支优先出文案
        const existing = db.getChat(chatId);
        if (existing && isReadonly(existing.chat)) {
          sendError(
            res,
            409,
            ERR_CODE.CONFLICT,
            existing.chat.archived_at !== null ? 'chat 已归档（只读），不接受新输入' : 'chat 已关闭，不接受新输入',
          );
          return;
        }
        // ★ 0017 pr-002（architecture §3.3 硬契约④）：项目归属判定插在**既有全部校验之后、写库之前**
        //   （C-7 顺序契约）⇒ 既有 400/413/409 的触发条件与顺序逐字不变，新 400 只出现在"既有路径不可能
        //   报错的场景"（那是全新对话）。本次会创建对话 ⇒ project_id 必填且必须指向存在项目；
        //   既有对话 ⇒ 归属不可变（ensureChat 的 DO NOTHING 结构性保证），读库取值、不校验一致性（L2-8）。
        let projectRow = existing ? db.projectByChat(chatId) : null;
        if (!existing) {
          const requested = typeof body.project_id === 'string' && body.project_id !== '' ? body.project_id : null;
          if (requested === null) {
            sendError(res, 400, ERR_CODE.INVALID_PARAM, '新对话需要 project_id（对话必须归属一个项目）');
            return;
          }
          projectRow = db.getProject(requested);
          if (projectRow === null) {
            sendError(res, 400, ERR_CODE.INVALID_PARAM, `项目不存在: ${requested}`);
            return;
          }
        }
        // 消息文本 = 去掉 @agent 前缀后的剩余内容（入库 text 仍为原文，§4.3）
        const messageText = text.replace(/^@[^\s@]+\s+/, '') || text;
        const taskId = `task-${randomUUID()}`;
        const messageId = `msg-${randomUUID()}`;
        // 1) 先落输入（§4.3：校验通过后、派发之前）+ 推 message(in)/chat_state(working)
        const inAt = Date.now();
        const input = db.insertInput({ chatId, projectId: projectRow === null ? null : projectRow.project_id, text, agentId, meta: { task_id: taskId }, nowMs: inAt });
        publishMessage(chatId, { id: input.message_id, direction: 'in', agent_id: agentId, text, model: null, duration_ms: null, error: null, created_at: inAt });
        publishState(chatId, 'working');
        // 2) 派发（§9.1 判定顺序：`!` → shell；one_shot → omp 一次性；否则 omp-daemon 常驻上下文）
        const label = messageText.slice(0, LABEL_MAX);
        // 载荷 project 三要素（§4.1 / F06）：name + repo_url + agreement；**不带** project_id、不带本地路径。
        // 只加在两条 LLM 分支上——shell 分支载荷逐字不变（N13）；解析不到项目行 ⇒ 不带该键（可选字段语义）。
        const project = projectRow === null ? null : { name: projectRow.name, repo_url: projectRow.repo_url, agreement: PROJECT_AGREEMENT };
        const payloadBody = messageText.startsWith('!')
          ? { command: '/bin/sh', args: ['-c', messageText.slice(1).trim()], label }
          : body.one_shot === true
            ? { executor: 'omp', prompt: messageText, label, ...(model === null ? {} : { model }), ...(project === null ? {} : { project }) }
            : { executor: 'omp-daemon', chat_id: chatId, prompt: messageText, label, ...(model === null ? {} : { model }), ...(project === null ? {} : { project }) };
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
      },
    },
    {
      method: 'GET',
      path: '/api/docs',
      summary: '接口元数据（文档页 / 调试台 / 索引文件的数据源）',
      params: [],
      response: '对象 { routes: [{ method, path, kind, summary, params, response, errors, danger, docLink }] }',
      errors: [],
      kind: 'json',
      docLink: 'API.md#311-get-apidocs',
      handler: async ({ res }) => {
        sendJson(res, 200, { routes: projectRoutes(routes) }); // 请求时投影：不缓存、不预快照（F01 验收 2）
      },
    },
    {
      // ★ 0017 pr-002（architecture §3.1 / §6.1）：项目列表——无参数、无分页；派生列由 §7.3 单条聚合 SQL 产出
      method: 'GET',
      path: '/api/projects',
      summary: '项目列表（含对话数与最近活动时间）',
      params: [],
      response: '对象 { projects: [{ project_id, name, repo_url, created_at, chat_count, last_activity_at }] }',
      errors: [],
      kind: 'json',
      docLink: 'API.md#312-get-apiprojects',
      handler: async ({ res }) => {
        sendJson(res, 200, { projects: db.listProjects() });
      },
    },
    {
      // ★ 0017 pr-002：创建项目——name 缺省 / 空 / 非字符串都交 persist 派生（web 不复制派生逻辑，M2）
      method: 'POST',
      path: '/api/projects',
      summary: '创建项目（最小输入 = 仓库地址；重复地址 → 409）',
      params: [
        { name: 'repo_url', in: 'body', type: 'string', required: true, desc: '仓库地址；trim 后非空即合法（不校验形态 / 域名 / 可达性）；唯一键 = trim 后原样字符串（不归一化 .git / 尾斜杠 / 大小写）' },
        { name: 'name', in: 'body', type: 'string', required: false, desc: '展示名；缺省 / 空 / 非字符串 ⇒ 派生 = 地址去尾部斜杠取尾段、再去尾部 .git（派生为空 ⇒ 用地址原文）' },
      ],
      response: '对象 { project: { project_id, name, repo_url, created_at } }',
      errors: ['INVALID_PARAM', 'CONFLICT'],
      kind: 'json',
      docLink: 'API.md#313-post-apiprojects',
      handler: async ({ req, res }) => {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message, status === 413 ? { connection: 'close' } : null);
          return;
        }
        const repoUrl = typeof body.repo_url === 'string' ? body.repo_url : '';
        let project;
        try {
          // 校验（trim 后非空）与落库都在 persist（M2）；非法入参经既有 sendError 出口转 400（不新增错误分支体系）
          project = db.createProject({ repoUrl, name: typeof body.name === 'string' ? body.name : undefined });
        } catch (err) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, err && err.message ? err.message : String(err));
          return;
        }
        if (project === null) {
          sendError(res, 409, ERR_CODE.CONFLICT, `项目已存在: ${repoUrl.trim()}`); // 重复地址由 UNIQUE(repo_url) + changes===0 判定
          return;
        }
        sendJson(res, 200, { project });
      },
    },
    {
      // ★ 0018（architecture §2.1 行 14）：调用面入口（独立路由；不扩既有 POST /api/messages ⇒ 既有响应契约零改写）。
      method: 'POST',
      path: '/api/calls',
      summary: '发起一次或一批调用（阻塞取终态 / 后台执行）',
      params: [
        { name: 'chat_id', in: 'body', type: 'string', required: true, desc: '调用归属：目标对话 id（必须**已存在**，调用面不新建对话）；未提供 / 空 / 非字符串 → 400' },
        { name: 'agent', in: 'body', type: 'string', required: true, desc: '角色名（如 dev）——不是实例名；解析 = 角色规则推导出的实例名且可反解回该角色，不可解析 / 离线 → 404' },
        { name: 'task', in: 'body', type: 'string', required: true, desc: '任务文本（trim 后不得为空）；与 tasks 互斥；`!` 前缀在本面**不**被解释为 shell；label 取前 60 字符' },
        { name: 'tasks', in: 'body', type: 'json', required: true, desc: '批量形态：数组，每项 {task, output_schema?, schema_mode?, mode?, model?}；**每项 = 一个独立调用**；与 task 互斥；空数组 → 400' },
        { name: 'context', in: 'body', type: 'string', required: false, desc: '本次调用的共享说明（trim 后非空才生效）：作为独立区块前置装配，**不污染**任务文本；批量时对各项共享生效' },
        { name: 'output_schema', in: 'body', type: 'json', required: false, desc: '期望的返回结构（受限子集 {type?, properties?: {<名>: {type}}, required?}）；超出子集（$ref / oneOf / items / 嵌套 properties …）→ 400' },
        { name: 'schema_mode', in: 'body', type: 'string', required: false, enum: ['permissive', 'strict'], desc: '结构校验模式（默认 permissive）；strict 且终态结构未通过 ⇒ state=failed / error=structured_output_invalid' },
        { name: 'mode', in: 'body', type: 'string', required: false, enum: ['background', 'block'], desc: '执行模式（默认 background）；block = 响应挂起至终态（不设人为上限）' },
        { name: 'model', in: 'body', type: 'string', required: false, desc: '模型标识，须匹配 ^[A-Za-z0-9._/-]{1,128}$；缺省用既有默认模型链（终态 model 只报执行侧实报值）' },
      ],
      response: '对象 { calls: [ { call_id, agent, state, duration_ms, model, truncated, text, structured_output, error, exit_code } ] }（顺序 = 请求顺序；后台项 state=submitted，阻塞项 = 终态信封）',
      errors: ['INVALID_PARAM', 'NOT_FOUND', 'PAYLOAD_TOO_LARGE', 'UPSTREAM_UNAVAILABLE'],
      kind: 'json',
      docLink: 'API.md#314-post-apicalls',
      handler: async ({ req, res }) => {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message, status === 413 ? { connection: 'close' } : null);
          return;
        }
        // ── 判定顺序（§2.3 的 1~4 步；任一步失败即返回 ⇒ 零副作用：无 messages 行、无 tasks 登记、无派发）──
        // ② 归属：未提供 / null / '' / 非字符串同判（MI-04），且必须是已存在的对话（调用面不建对话）
        const chatId = typeof body.chat_id === 'string' && body.chat_id !== '' ? body.chat_id : null;
        if (chatId === null) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 chat_id（调用必须归属一个已存在的对话）');
          return;
        }
        if (!db.getChat(chatId)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, `chat 不存在: ${chatId}`);
          return;
        }
        // ③ 目标：角色名 → 实例名；「不存在 / 不可按角色名寻址」与⑤的「离线」同码同文案（MI-01 三情形不区分）
        const role = typeof body.agent === 'string' ? body.agent.trim() : '';
        if (role === '') {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 agent（角色名，如 dev）');
          return;
        }
        const agentId = instanceIdForRole(role);
        if (roleOfInstance(agentId) !== role) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `agent 不可用: ${role}（无对应在线实例）`);
          return;
        }
        const requester = body.requester === undefined || body.requester === null || body.requester === '' ? null : body.requester;
        if (requester !== null && !validPrincipalId(requester)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'requester 非法（需为非空、<=64 字符的可打印 ASCII）');
          return;
        }
        const requesterDecl = requester === null ? null : principals.requesterOf({ principal_id: requester });
        if (requesterDecl !== null) principals.upsert(requesterDecl);
        const warnings = [];
        // ④ 入参形态：上下文类型 / 单批互斥 / 逐项枚举与子集校验（全部先于任何写库与登记）
        if (body.context !== undefined && body.context !== null && typeof body.context !== 'string') {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'context 需为字符串（本次调用的共享说明）');
          return;
        }
        const shared = typeof body.context === 'string' ? body.context : '';
        const batchMode = body.tasks !== undefined && body.tasks !== null;
        if (batchMode && body.task !== undefined) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'task 与 tasks 互斥（一次提交只用一种形态）');
          return;
        }
        if (!batchMode && (typeof body.task !== 'string' || body.task.trim() === '')) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 task（任务文本，trim 后不得为空）或 tasks（非空数组）');
          return;
        }
        if (batchMode && (!Array.isArray(body.tasks) || body.tasks.length === 0)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'tasks 需为非空数组（每项 = 一个独立调用）');
          return;
        }
        const items = [];
        for (const raw of batchMode ? body.tasks : [body]) {
          if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            sendError(res, 400, ERR_CODE.INVALID_PARAM, 'tasks 每项需为对象（{task, output_schema?, schema_mode?, mode?, model?}）');
            return;
          }
          if (typeof raw.task !== 'string' || raw.task.trim() === '') {
            sendError(res, 400, ERR_CODE.INVALID_PARAM, batchMode ? 'tasks 每项需要 task（任务文本，trim 后不得为空）' : '需要 task（任务文本，trim 后不得为空）');
            return;
          }
          const item = { task: raw.task, outputSchema: null, schemaMode: SCHEMA_MODES[0], mode: CALL_MODES[0], model: null };
          if (raw.mode !== undefined && raw.mode !== null && raw.mode !== '') {
            if (!CALL_MODES.includes(raw.mode)) {
              sendError(res, 400, ERR_CODE.INVALID_PARAM, `mode 非法（需为 ${CALL_MODES.join(' / ')}）`);
              return;
            }
            item.mode = raw.mode;
          }
          if (raw.schema_mode !== undefined && raw.schema_mode !== null && raw.schema_mode !== '') {
            if (!SCHEMA_MODES.includes(raw.schema_mode)) {
              sendError(res, 400, ERR_CODE.INVALID_PARAM, `schema_mode 非法（需为 ${SCHEMA_MODES.join(' / ')}）`);
              return;
            }
            item.schemaMode = raw.schema_mode;
          }
          if (raw.output_schema !== undefined && raw.output_schema !== null) {
            const schema = validateOutputSchema(raw.output_schema);
            if (schema === null) {
              sendError(res, 400, ERR_CODE.INVALID_PARAM, 'output_schema 非法（仅支持受限子集：type / properties / required，且 type 取 7 种之一）');
              return;
            }
            item.outputSchema = schema;
          }
          if (raw.model !== undefined && raw.model !== null && raw.model !== '') {
            if (typeof raw.model !== 'string' || !MODEL_RE.test(raw.model)) {
              sendError(res, 400, ERR_CODE.INVALID_PARAM, `model 非法（需匹配 ${MODEL_RE}）`);
              return;
            }
            item.model = raw.model;
          }
          items.push(item);
        }
        // ── ⑤ 逐项派发（判定已全部完成；每项 = 一个独立调用，互不相同的 call_id）──
        const projectRow = db.projectByChat(chatId);
        const project = projectRow === null ? null : { name: projectRow.name, repo_url: projectRow.repo_url, agreement: PROJECT_AGREEMENT };
        const waits = [];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          const callId = `task-${randomUUID()}`; // M-5 / L2-2：调用 id = 既有 task_id 体系，不新造第二套标识
          const messageId = `msg-${randomUUID()}`;
          const payloadBody = {
            executor: 'omp-daemon',
            chat_id: chatId,
            // prompt 由 web 侧装配（§2.2）：`!` 前缀在本面不解释为 shell；不提供 one_shot；不新增 payload 字段
            prompt: composeCallPrompt({ context: shared, task: item.task, outputSchema: item.outputSchema }),
            label: item.task.slice(0, LABEL_MAX),
            ...(item.model === null ? {} : { model: item.model }),
            ...(project === null ? {} : { project }),
          };
          const inAt = Date.now();
          const input = db.insertInput({ chatId, projectId: projectRow === null ? null : projectRow.project_id, text: item.task, agentId, meta: { task_id: callId }, nowMs: inAt });
          publishMessage(chatId, { id: input.message_id, direction: 'in', agent_id: agentId, text: item.task, model: null, duration_ms: null, error: null, created_at: inAt });
          publishState(chatId, 'working', LOCAL_ONLY);
          let resolve = null;
          const done = item.mode === CALL_MODES[1] ? new Promise((r) => { resolve = r; }) : null; // 阻塞等待句柄（释放点 = 终态单一发布点）
          const call = { callId, role, chatId, requester, outputSchema: item.outputSchema, schemaMode: item.schemaMode, done, resolve, published: false, working: false, terminal: null };
          if (requesterDecl !== null && requesterDecl.instance_id === agentId) {
            warnings.push({ index: i, call_id: callId, kind: 'self_dispatch', message: 'requester 与目标 agent 相同' });
          }
          const entry = { chatId, agentId, lines: [], landed: false, attempts: 0, slow: false, registeredAt: Date.now(), timer: null, call };
          tasks.set(callId, entry); // 登记先于 await（首个增量可能与 send 响应同 chunk 到达）
          if (item.outputSchema !== null) callSchemas.set(callId, call); // 终态后仍可按同一 schema 复算 structured_output
          try {
            await sendTask(agentId, messageId, callId, payloadBody);
          } catch (err) {
            tasks.delete(callId);
            callSchemas.delete(callId);
            const reason = (err && err.dataCode) || (err && err.message) || String(err);
            if (i > 0) {
              // 首项成功、后续项失败（同目标，仅竞态窗口）：已派出的项保留，响应仍是既有 {error, code} 契约
              sendError(res, 502, ERR_CODE.UPSTREAM_UNAVAILABLE, `调用派发失败: ${reason}`);
              return;
            }
            // 首项失败：对话侧行为与既有 /api/messages 逐字一致（补一条 out + 推 chat_state 读库值）
            const outAt = Date.now();
            const outText = `派发失败：${reason}`;
            const out = db.insertOutput({ chatId, text: outText, agentId, error: 'dispatch_failed', nowMs: outAt });
            publishMessage(chatId, { id: out.message_id, direction: 'out', agent_id: agentId, text: outText, model: null, duration_ms: null, error: 'dispatch_failed', created_at: outAt });
            const chat = db.getChat(chatId);
            if (chat) publishState(chatId, chat.chat.state, LOCAL_ONLY);
            const unavailable = err && (err.dataCode === 'AGENT_OFFLINE' || err.dataCode === 'AGENT_NOT_FOUND');
            if (unavailable) {
              sendError(res, 404, ERR_CODE.NOT_FOUND, `agent 不可用: ${role}（无对应在线实例）`);
              return;
            }
            sendError(res, 502, ERR_CODE.UPSTREAM_UNAVAILABLE, `调用派发失败: ${reason}`);
            return;
          }
          scheduleReconcile(callId, entry); // 派发成功即挂对账（收到投递则随之清除）
          const submittedEvent = { type: CALL_EVENTS.state, data: { chat_id: chatId, call_id: callId, agent: role, state: 'submitted' } };
          transport.publishCall(callId, submittedEvent);
          transport.publishFiltered(submittedEvent);
          // 后台项 = 受理态信封（与终态项同一形状）；阻塞项 = 等待终态单一发布点释放（后台/终态混合时逐项各自处理）
          waits.push(done === null
            ? composeCallEnvelope({ task_id: callId, to: agentId, state: 'submitted', updates: [], updatesTruncated: false, result: null }, call)
            : done);
        }
        const calls = await Promise.all(waits);
        if (!res.writableEnded && !res.destroyed) sendJson(res, 200, { calls, ...(requester === null ? {} : { warnings }) }); // 客户端断连 ⇒ 写入是 no-op，调用仍在后台完成（MI-05）
        return;
      },
    },
    {
      // ★ 0018（architecture §2.1 行 15 / §3.4）：调用 roster —— 单次 task_list、范围收口 from==='web'、6 列、无过滤无编排。
      method: 'GET',
      path: '/api/calls',
      summary: '调用 roster（每次调用一行；无过滤 / 无分页 / 无编排）',
      params: [],
      response: '对象 { calls: [{ call_id, agent, state, started_at, ended_at, model }] }（按 created_at 倒序；进行中 ended_at=null）（0029 pr-005：每行追加 last_event_at）',
      errors: [],
      kind: 'json',
      docLink: 'API.md#315-get-apicalls',
      handler: async ({ res }) => {
        const r = await queryOnce(config.socketPath, 'router.task_list', {});
        // 范围 = 本 hub 派发的调用（SENDER_ID='web'）；CLI（from='main'）派发的任务无 chat 归属，不进调用面（§3.4）
        const rows = (r.tasks || []).filter((t) => t.from === SENDER_ID);
        sendJson(res, 200, {
          calls: rows.map((t) => {
            // ★ FIX-1：state 与 §3.19 同读法（终态真源 = 调用登记）——strict 覆写下 roster 与按 id 不再漂移
            const state = callState(t, callSchemas.get(t.task_id) ?? null);
            return {
              call_id: t.task_id,
              agent: roleOfInstance(t.to),
              state,
              started_at: t.created_at,
              ended_at: state === 'completed' || state === 'failed' ? t.updated_at : null,
              model: t.model ?? null, // listTasks 投影的 model = task.result?.model ?? null（进行中恒 null，不显示推测值）
              // ★ 0029 pr-005（F06 / A-05）：追加"最后一次事件时刻" = 任务条目 `updated_at`；**不**由服务端给出
              // `idle_ms`（停滞派生留给消费方，避免服务端口径漂移）。既有 6 列名 / 顺序 / 取值不变。
              last_event_at: t.updated_at,
            };
          }),
        });
      },
    },
    {
      // ★ 0018（architecture §2.1 行 16 / §4.1）：对话作用域的调用事件流（先订阅、再发起的载体）。
      method: 'GET',
      path: '/api/calls/stream',
      summary: '按对话订阅调用事件（SSE：call_state / call_update / call_result）',
      params: [
        { name: 'chat_id', in: 'query', type: 'string', required: true, desc: '目标对话（含尚未发起的调用）；缺参或传空 → 400 INVALID_PARAM' },
      ],
      response: 'SSE 事件流（text/event-stream）：call_state / call_update / call_result',
      errors: ['INVALID_PARAM'],
      kind: 'sse',
      docLink: 'API.md#316-get-apicallsstream',
      handler: async ({ req, res, query: qs }) => {
        const chatId = qs.get('chat_id');
        if (!chatId) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 chat_id（不做全局调用订阅）');
          return;
        }
        transport.handleChatCallStream(req, res, { chatId });
        return;
      },
    },
    {
      // ★ 0018（architecture §2.1 行 17 / §4.1）：按调用订阅（两次并发只订阅其一）；不存在 ⇒ 404 且不建立订阅。
      method: 'GET',
      path: '/api/calls/:call_id/stream',
      summary: '按调用订阅事件（SSE：call_state / call_update / call_result）',
      params: [
        { name: 'call_id', in: 'path', type: 'string', required: true, desc: '目标调用 id（= task_id）；不存在 → 404 NOT_FOUND（不建立订阅）' },
      ],
      response: 'SSE 事件流（text/event-stream）：call_state / call_update / call_result',
      errors: ['NOT_FOUND'],
      kind: 'sse',
      docLink: 'API.md#317-get-apicallscall_idstream',
      handler: async ({ req, res, params }) => {
        const callId = params.call_id;
        const initial = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
        if (!initial || !initial.task) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `call 不存在: ${callId}`);
          return;
        }
        transport.handleCallStream(req, res, { callId });
        const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
        const task = r && r.task ? r.task : null;
        if (!task) {
          transport.closeCallSubscriptions(callId);
          return;
        }
        const state = callState(task, callSchemas.get(callId) ?? null);
        if (state === 'completed' || state === 'failed') {
          const envelope = composeCallEnvelope(task, callSchemas.get(callId) ?? null);
          res.write(`event: ${CALL_EVENTS.result}\ndata: ${JSON.stringify({ chat_id: task.chat_id ?? null, ...envelope })}\n\n`);
          transport.closeCallSubscriptions(callId);
        }
        return;
      },
    },
    {
      // ★ 0018（architecture §2.1 行 18 / §3.5）：转录 = 任务表 updates[] 原样 + 终态追加一条 event='result'；进程内、不持久。
      method: 'GET',
      path: '/api/calls/:call_id/transcript',
      summary: '按调用取转录（进程内、不持久；含终态条目）',
      params: [
        { name: 'call_id', in: 'path', type: 'string', required: true, desc: '目标调用 id（= task_id）；不存在（含重启后）→ 404 NOT_FOUND' },
      ],
      response: '对象 { call_id, agent, state, truncated, entries: [{ at, from, state, detail }] }（终态时末尾追加 detail.event="result" 一条）',
      errors: ['NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#318-get-apicallscall_idtranscript',
      handler: async ({ res, params }) => {
        const callId = params.call_id;
        const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
        const task = r && r.task ? r.task : null;
        if (!task) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `call 不存在: ${callId}`);
          return;
        }
        const state = callState(task, callSchemas.get(callId) ?? null); // ★ FIX-1：与信封 / roster 同读法（终态真源 = 调用登记）
        const entries = [...task.updates]; // 原样透出（不裁剪 detail）
        if (state === 'completed' || state === 'failed') {
          entries.push({ at: task.updated_at, from: task.to, state, detail: { event: 'result', ...(task.result || {}) } });
        }
        sendJson(res, 200, { call_id: task.task_id, agent: roleOfInstance(task.to), state, truncated: callTruncated(task), entries });
        return;
      },
    },
    {
      method: 'GET',
      path: '/api/pickup',
      summary: '查询身份未取件的终态调用',
      params: [
        { name: 'principal', in: 'query', type: 'string', required: true, desc: '取件身份 principal_id' },
        { name: 'epoch', in: 'query', type: 'string', required: false, desc: '会话代次；过期返回 409 STALE_EPOCH' },
      ],
      response: '对象 { pickup: [{ call_id, requester, agent, chat_id, terminal_at, acked, envelope }] }',
      errors: ['INVALID_PARAM', 'STALE_EPOCH'],
      kind: 'json',
      docLink: 'API.md#312-get-apipickup',
      handler: async ({ res, query: qs }) => {
        const principalId = qs.get('principal');
        if (!validPrincipalId(principalId)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要合法 principal');
          return;
        }
        const stale = await checkEpoch(qs.get('epoch'));
        if (stale !== null) {
          sendError(res, 409, ERR_CODE.STALE_EPOCH, stale);
          return;
        }
        const principal = principals.get(principalId);
        if (principal) principals.touch(principalId);
        const result = [];
        for (const entry of pickup.listByRequester(principalId)) {
          const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: entry.call_id });
          const task = r && r.task ? r.task : null;
          result.push({ ...entry, envelope: task ? composeCallEnvelope(task, callSchemas.get(entry.call_id) ?? null) : null });
        }
        sendJson(res, 200, { pickup: result });
      },
    },
    {
      method: 'GET',
      path: '/api/calls/wait',
      summary: '等待一组调用达到终态',
      params: [
        { name: 'ids', in: 'query', type: 'string', required: true, desc: '逗号分隔调用 id；至少一个' },
        { name: 'timeout_ms', in: 'query', type: 'number', required: false, desc: '正整数超时；省略表示不设上限' },
      ],
      response: '对象 { timed_out, timeout_ms, results, unresolved }',
      errors: ['INVALID_PARAM'],
      kind: 'json',
      docLink: 'API.md#318-get-apicallswait',
      handler: async ({ res, query: qs }) => {
        const ids = [...new Set(parseCsv(qs.get('ids')))];
        if (ids.length === 0) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要 ids（至少一个调用 id）');
          return;
        }
        const timeoutRaw = qs.get('timeout_ms');
        let timeoutMs;
        if (timeoutRaw !== null && (timeoutRaw === '' || !/^\d+$/.test(timeoutRaw) || Number(timeoutRaw) <= 0)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, 'timeout_ms 需为正整数');
          return;
        }
        if (timeoutRaw !== null) timeoutMs = Number(timeoutRaw);
        const results = [];
        const unresolved = [];
        const pending = [];
        for (const callId of ids) {
          const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
          const task = r && r.task ? r.task : null;
          if (!task) {
            unresolved.push({ call_id: callId, state: null });
            continue;
          }
          const state = callState(task, callSchemas.get(callId) ?? null);
          if (state === 'completed' || state === 'failed') {
            results.push(composeCallEnvelope(task, callSchemas.get(callId) ?? null));
            continue;
          }
          pending.push({ callId, state: task.state });
        }
        const outcome = new Map(); // callId → 终态信封（本请求等待到的结果；超时路径据此区分"已得结论"与"仍未终态"）
        const registered = []; // 本请求登记的句柄（[callId, waiter]）——超时只摘自己登记的，不误删他人句柄
        const waiting = pending.map(({ callId, state }) => new Promise((resolve) => {
          let set = waiters.get(callId);
          if (!set) {
            set = new Set();
            waiters.set(callId, set);
          }
          const waiter = (envelope) => {
            outcome.set(callId, envelope);
            resolve({ callId, state });
          };
          set.add(waiter);
          registered.push([callId, waiter]);
        }));
        let timedOut = false;
        if (timeoutMs !== undefined) {
          const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
          timedOut = (await Promise.race([Promise.all(waiting), timeout])) === null;
          if (timedOut) {
            // 超时：撤下本请求登记的句柄（不误删其他等待者），随后按"当刻状态"回报——超时不产生结论、不改调用状态。
            for (const [callId, waiter] of registered) {
              const set = waiters.get(callId);
              if (!set) continue;
              set.delete(waiter);
              if (set.size === 0) waiters.delete(callId);
            }
          }
        } else {
          await Promise.all(waiting);
        }
        for (const { callId } of pending) {
          const envelope = outcome.get(callId);
          if (envelope !== undefined) {
            results.push(envelope);
            continue;
          }
          const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
          const task = r && r.task ? r.task : null;
          unresolved.push({ call_id: callId, state: task ? callState(task, callSchemas.get(callId) ?? null) : null });
        }
        sendJson(res, 200, { timed_out: timedOut, timeout_ms: timeoutMs ?? null, results, unresolved });
      },
    },
    {
      // ★ 0029 pr-005（F13 / architecture §4 A-10）：取消 —— 终态真源仍是 Router 任务表（web 侧不覆盖状态）：
      //   成功 ⇒ Router 以既有唯一终态写点置 `failed` + `result.error='cancelled'`，web 再经**既有唯一终态发布点**
      //   收口（发布 call_result + 关流 + 解等待句柄）+ 落**恰一条** `out` + 推 `chat_state`（对话不停在 working）。
      //   重复取消 / 对已终态调用取消 ⇒ 200 `cancelled:false` + 原 `state`/`error` 原样（不改已定终态）。
      method: 'POST',
      path: '/api/calls/:call_id/cancel',
      summary: '取消调用（幂等；已终态调用不改状态）',
      params: [{ name: 'call_id', in: 'path', type: 'string', required: true, desc: '目标调用 id（= task_id）；不存在 → 404 NOT_FOUND' }],
      response: '对象 { call_id, cancelled, state, error }（本次生效 ⇒ cancelled:true / state:"failed" / error:"cancelled"；已终态 ⇒ cancelled:false + 原 state/error）',
      errors: ['NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#3110-post-apicallscall_idcancel',
      handler: async ({ res, params }) => {
        const callId = params.call_id;
        let task = null;
        try {
          const r = await queryOnce(config.socketPath, 'router.task_cancel', { task_id: callId });
          task = r && r.task ? r.task : null;
        } catch (err) {
          // 机器码在 JSON-RPC `data.code`（不是 HTTP 码）：按 dataCode 分支，其余错误照旧抛给分发层转 502。
          if (err && err.dataCode === 'TASK_NOT_FOUND') {
            sendError(res, 404, ERR_CODE.NOT_FOUND, `call 不存在: ${callId}`);
            return;
          }
          if (err && err.dataCode === 'TASK_ALREADY_FINAL') {
            const cur = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
            const existing = cur && cur.task ? cur.task : null;
            if (!existing) {
              sendError(res, 404, ERR_CODE.NOT_FOUND, `call 不存在: ${callId}`);
              return;
            }
            const envelope = composeCallEnvelope(existing, callSchemas.get(callId) ?? null);
            sendJson(res, 200, { call_id: callId, cancelled: false, state: envelope.state, error: envelope.error });
            return;
          }
          throw err;
        }
        const envelope = task === null ? null : composeCallEnvelope(task, callSchemas.get(callId) ?? null);
        settleCancelledCall(callId, task, envelope); // 终态收口（out + chat_state + 发布 + 关流 + 解等待句柄）
        sendJson(res, 200, { call_id: callId, cancelled: true, state: envelope.state, error: envelope.error });
      },
    },
    {
      method: 'POST',
      path: '/api/pickup/:call_id/ack',
      summary: '确认取件终态调用（幂等）',
      params: [
        { name: 'call_id', in: 'path', type: 'string', required: true, desc: '目标调用 id' },
        { name: 'principal', in: 'query', type: 'string', required: true, desc: '确认身份 principal_id' },
        { name: 'epoch', in: 'query', type: 'string', required: false, desc: '会话代次；过期返回 409 STALE_EPOCH' },
      ],
      response: '对象 { call_id, acked: true }',
      errors: ['INVALID_PARAM', 'STALE_EPOCH'],
      kind: 'json',
      docLink: 'API.md#313-post-apipickupcall_idack',
      handler: async ({ res, params, query: qs }) => {
        const principalId = qs.get('principal');
        if (!validPrincipalId(principalId)) {
          sendError(res, 400, ERR_CODE.INVALID_PARAM, '需要合法 principal');
          return;
        }
        const stale = await checkEpoch(qs.get('epoch'));
        if (stale !== null) {
          sendError(res, 409, ERR_CODE.STALE_EPOCH, stale);
          return;
        }
        if (principals.get(principalId)) principals.touch(principalId);
        pickup.ack(params.call_id);
        sendJson(res, 200, { call_id: params.call_id, acked: true });
      },
    },
    {
      // ★ 0018（architecture §2.1 行 19，**全表末位**）：按调用 id 取终态 / 进行中状态（必须排在全部 :call_id/… 形态之后）。
      method: 'GET',
      path: '/api/calls/:call_id',
      summary: '按调用取终态（进行中给状态）',
      params: [
        { name: 'call_id', in: 'path', type: 'string', required: true, desc: '目标调用 id（= task_id）；不存在（含重启后）→ 404 NOT_FOUND' },
      ],
      response: '调用信封对象 { call_id, agent, state, duration_ms, model, truncated, text, structured_output, error, exit_code }',
      errors: ['NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#319-get-apicallscall_id',
      handler: async ({ res, params }) => {
        const callId = params.call_id;
        const r = await queryOnce(config.socketPath, 'router.task_get', { task_id: callId });
        const task = r && r.task ? r.task : null;
        if (!task) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `call 不存在: ${callId}`);
          return;
        }
        sendJson(res, 200, composeCallEnvelope(task, callSchemas.get(callId) ?? null));
        return;
      },
    },
    {
      // ★ 0021 pr-003（architecture §5.1 R-1 / §7 T-07）：在途确认项列表（重建入口）——唯一数据源 = 进程内
      //   inbox，不查 Router、不读库；空态 = []，不 404。**不发任何帧**（刷新 / 重连重建不重复通知，MI-01）。
      method: 'GET',
      path: '/api/confirmations',
      summary: '待确认项列表（跨对话的在途确认项；进程内，不持久）',
      params: [],
      response: '对象 { confirmations: [{ confirmation_id, request_kind, chat_id, agent_id, tool, title, options, multiple, created_at }] }（空 = []）',
      errors: [],
      kind: 'json',
      docLink: 'API.md#320-get-apiconfirmations',
      handler: async ({ res }) => {
        sendJson(res, 200, { confirmations: inbox.list() });
        return;
      },
    },
    {
      // ★ 0021 pr-003（architecture §5.1 R-2 / §5.3 信封 2）：提交一次裁决——`take()` 原子取出并移除（⇒ 第二次
      //   提交同一 id 得 404；无历史台账由结构保证）+ 回传发出方（信封 2）+ permission 类文本非空白时按既有原语追加一条 chat 输入（question 类不追加）。
      //   路径参为**后缀段**（L2-10）：不做 `POST /api/confirmations/:id` 形态。
      method: 'POST',
      path: '/api/confirmations/:confirmation_id/decision',
      summary: '提交确认项裁决（permission 类 option_id 必填；question 类 option_ids 与 text 至少一个非空；条目随即移出在途表并回传请求方）',
      params: [
        { name: 'confirmation_id', in: 'path', type: 'string', required: true, desc: '目标确认项 id；不在在途表（已裁决 / 已失效 / 从未存在）→ 404 NOT_FOUND（同一码，不区分）' },
        { name: 'option_id', in: 'body', type: 'string', required: false, desc: 'permission 类必填：用户选中的选项 id；缺失 / 非字符串 / 不在该条 options 内 → 400 INVALID_PARAM 且条目保留在途' },
        { name: 'option_ids', in: 'body', type: 'json', required: false, desc: 'question 类：用户选中的选项 id 数组；须为字符串数组且 ⊆ 该条 options，与 text 至少一个非空 → 否则 400 INVALID_PARAM 且条目保留在途' },
        { name: 'text', in: 'body', type: 'string', required: false, desc: '可选文本（拒绝理由 / 补充说明）；trim 后为空则视为未填；permission 类下非空时另追加一条 chat 输入并派发' },
      ],
      response: '对象 { confirmation_id, accepted: true }',
      errors: ['INVALID_PARAM', 'NOT_FOUND'],
      kind: 'json',
      docLink: 'API.md#321-post-apiconfirmationsconfirmation_iddecision',
      handler: async ({ req, res, params }) => {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          const status = err.status || 400;
          sendError(res, status, status === 413 ? ERR_CODE.PAYLOAD_TOO_LARGE : ERR_CODE.INVALID_PARAM, err.message, status === 413 ? { connection: 'close' } : null);
          return;
        }
        const confirmationId = params.confirmation_id;
        const entry = inbox.take(confirmationId); // 原子取出并移除：不存在 → 404（已裁决 / 已失效 / 从未存在同一码）
        if (entry === null) {
          sendError(res, 404, ERR_CODE.NOT_FOUND, `确认项不存在: ${confirmationId}`);
          return;
        }
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        // 服务端校验（§5.3，L2-7）：按 `request_kind` 分化——question 类提交 `option_ids`，permission 类提交 `option_id`。
        // 两类都遵循同一体例：非法 ⇒ 400 且条目**保留在途**（take 后回填；中间无 await ⇒ 仍是原子）。
        const inOptions = (id) => typeof id === 'string' && entry.options.some((o) => o && o.option_id === id);
        const question = entry.request_kind === 'question';
        let decision;
        if (question) {
          // MI-b：`option_ids` 缺失 ⇒ 空集；键出现但非字符串数组（含 null / 含非字符串元素）⇒ 非法。
          // MI-a：成立条件 = `option_ids` 非空 **或** `text` 非空白（全空不构成作答）。
          const optionIds = body.option_ids === undefined ? [] : body.option_ids;
          if (!Array.isArray(optionIds) || !optionIds.every(inOptions) || (optionIds.length === 0 && text === '')) {
            inbox.add(entry);
            sendError(res, 400, ERR_CODE.INVALID_PARAM, 'option_ids 须为字符串数组、⊆ 该条的选项集合，且与 text 至少一个非空');
            return;
          }
          decision = { kind: 'confirmation_decision', confirmation_id: confirmationId, option_ids: optionIds, text, chat_id: entry.chat_id };
        } else {
          const optionId = typeof body.option_id === 'string' ? body.option_id : null;
          if (!inOptions(optionId)) {
            inbox.add(entry);
            sendError(res, 400, ERR_CODE.INVALID_PARAM, 'option_id 缺失 / 非字符串 / 不在该条的选项集合内');
            return;
          }
          decision = { kind: 'confirmation_decision', confirmation_id: confirmationId, option_id: optionId, text, chat_id: entry.chat_id };
        }
        // 回传裁决（§5.3 信封 2）：best-effort（既有 sendControlNotice 同款）——agent 离线时静默忽略，
        // 浏览器侧的裁决已受理，不把回传失败伪装成裁决失败。
        sendControlNotice(entry.agent_id, decision).catch(() => {});
        // 文本落地（§5.3「为什么 text 不参与 ACP 应答」）：permission 类且非空白 ⇒ 追加一条 chat 输入并派发（question 类旁路停掉：提问的作答不落成对话消息）——复用既有原语
        // （落库 / 落 message 帧 / chat_state / 派发 / 对账登记），不抽取既有 POST /api/messages 的内核。
        // 对话不在库里（读不到项目行）⇒ 文本无处追加，跳过（裁决本身已受理，不因此变成失败）。
        const projectRow = !question && text !== '' && entry.chat_id !== null ? db.projectByChat(entry.chat_id) : null;
        if (projectRow !== null) {
          const taskId = `task-${randomUUID()}`;
          const messageId = `msg-${randomUUID()}`;
          const inAt = Date.now();
          const input = db.insertInput({ chatId: entry.chat_id, projectId: projectRow.project_id, text, agentId: entry.agent_id, meta: { task_id: taskId }, nowMs: inAt });
          publishMessage(entry.chat_id, { id: input.message_id, direction: 'in', agent_id: entry.agent_id, text, model: null, duration_ms: null, error: null, created_at: inAt });
          publishState(entry.chat_id, 'working');
          const project = { name: projectRow.name, repo_url: projectRow.repo_url, agreement: PROJECT_AGREEMENT };
          const payloadBody = { executor: 'omp-daemon', chat_id: entry.chat_id, prompt: text, label: text.slice(0, LABEL_MAX), project };
          const taskEntry = { chatId: entry.chat_id, agentId: entry.agent_id, lines: [], landed: false, attempts: 0, slow: false, registeredAt: Date.now(), timer: null };
          tasks.set(taskId, taskEntry); // 登记先于派发（与 /api/messages 同口径：首个增量可能与 send 响应同 chunk 到达）
          try {
            await sendTask(entry.agent_id, messageId, taskId, payloadBody);
            scheduleReconcile(taskId, taskEntry);
          } catch (err) {
            tasks.delete(taskId);
            const reason = (err && err.dataCode) || (err && err.message) || String(err);
            const outAt = Date.now();
            const outText = `派发失败：${reason}`;
            const out = db.insertOutput({ chatId: entry.chat_id, text: outText, agentId: entry.agent_id, error: 'dispatch_failed', nowMs: outAt });
            publishMessage(entry.chat_id, { id: out.message_id, direction: 'out', agent_id: entry.agent_id, text: outText, model: null, duration_ms: null, error: 'dispatch_failed', created_at: outAt });
            const chat = db.getChat(entry.chat_id);
            if (chat) publishState(entry.chat_id, chat.chat.state);
          }
        }
        sendJson(res, 200, { confirmation_id: confirmationId, accepted: true });
        return;
      },
    },
  ];
  for (const route of routes) Object.assign(route, compileRouteMatcher(route.path));
  return routes;
}

/** 顺序匹配（architecture §3.3 C5）：方法不匹配 = 不进入候选（**无 405**）；首个命中即返回；
 *  参数解码在匹配层统一做（畸形百分号编码抛 `URIError`，由分发层的单 try/catch 转 502）。 */
export function matchRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const raw = route.extract(pathname);
    if (raw === null) continue;
    const params = {};
    for (const [name, value] of Object.entries(raw)) params[name] = decodeURIComponent(value);
    return { route, params };
  }
  return null;
}

/** 登记 → 投影（F01 验收 2 / architecture §5.1）：只输出元数据 + 派生写标记 `danger`（`method !== 'GET'`），
 *  `handler` 不入投影；每次调用重新投影（不缓存、不预快照）⇒ 三个派生面共用同一份形状。 */
export function projectRoutes(routes) {
  return routes.map((r) => ({
    method: r.method,
    path: r.path,
    kind: r.kind,
    summary: r.summary,
    params: r.params,
    response: r.response,
    errors: r.errors,
    danger: r.method !== 'GET',
    docLink: r.docLink,
  }));
}

/** llms.txt 生成（F05 / architecture §5.3）：纯函数——只依赖入参（`projectRoutes` 的投影结果），
 *  不读磁盘、不看时间、不看 env、不看运行端口 ⇒ 同输入逐字节相同（漂移锁②的前提）。
 *  单产物结构：本函数产出即 `llms.txt`（包根快照；HTTP 产物与仓库快照是同一份字节）；
 *  内容仅 HTTP 接口面（项目说明 / 接入方式 / 接口清单 / 深入链接），不复制 API.md / README.md 正文。 */
export function renderLlmsTxt(routes) {
  const lines = [
    '# oamp —— 本机多智能体运行时（HTTP 接口索引）',
    '',
    '> oamp 是零依赖的 Node.js 本机多智能体运行时：单一 CLI 拉起 Router 与 agent 节点，HTTP/SSE 面提供对话持久化与实时推送。',
    '',
    '## 接入',
    '',
    '- 启动：`oamp router start`（终端 1）+ `oamp web start`（终端 2）',
    '- 服务地址：http://127.0.0.1:7788（默认端口；`--port` / `OAMP_WEB_PORT` 可改；仅本机监听，无鉴权）',
    '- 全量字段元数据（机器可读）：GET /api/docs',
    '',
    `## 接口（${routes.length} 条）`,
    '',
    ...routes.map((r) => `- ${r.method} ${r.path} — ${r.summary}`),
    '',
    '## 深入',
    '',
    '- 字段级文档页：http://127.0.0.1:7788/docs',
    '- 完整文档（叙述 / 使用场景 / 可粘贴示例）：http://127.0.0.1:7788/API.md（仓库内：API.md）',
    '- 项目说明：http://127.0.0.1:7788/README.md（仓库内：README.md）',
    '',
  ];
  return lines.join('\n');
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
  let routerGeneration = '0';
  const getEpoch = async () => {
    try {
      const status = await queryOnce(config.socketPath, 'router.status', {});
      if (status && status.generation !== undefined && status.generation !== null) routerGeneration = String(status.generation);
    } catch {
      // Router 不可达时保留最近一次 generation；epoch 仍由 webBootId 保证本次进程唯一。
    }
    return principalEpoch(WEB_BOOT_ID, routerGeneration);
  };
  const checkEpoch = async (requested) => {
    if (requested === null || requested === '') return null;
    const current = await getEpoch();
    return requested === current ? null : `会话代次已过期: ${requested}`;
  };

  let rosterHints = new Map();
  let lastRosterNodes = [];
  try {
    const saved = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
    const writtenAt = Number(saved?.written_at);
    const ids = Array.isArray(saved?.instance_ids) ? saved.instance_ids : [];
    if (Number.isFinite(writtenAt)) {
      rosterHints = new Map(ids.filter((id) => typeof id === 'string' && id !== '').map((id) => [id, writtenAt]));
    }
  } catch {
    rosterHints = new Map();
  }
  const writeRoster = (nodes) => {
    const instanceIds = [...new Set((nodes || []).map((node) => node?.instance_id).filter((id) => typeof id === 'string' && id !== ''))];
    lastRosterNodes = nodes || [];
    try {
      fs.mkdirSync(path.dirname(ROSTER_FILE), { recursive: true });
      fs.writeFileSync(ROSTER_FILE, `${JSON.stringify({ written_at: Date.now(), instance_ids: instanceIds })}\n`);
    } catch {
      // 运行态提示是 best-effort，不影响 API。
    }
  };
  const getAgentProjection = async (nodes) => {
    writeRoster(nodes);
    const present = new Set((nodes || []).map((node) => node?.instance_id));
    const now = Date.now();
    const reconnecting = [];
    for (const [instanceId, writtenAt] of rosterHints) {
      if (!present.has(instanceId) && now - writtenAt <= config.heartbeatTimeoutMs) {
        reconnecting.push({
          instance_id: instanceId,
          session_id: null,
          state: 'online',
          last_heartbeat: null,
          connected: false,
        });
      }
    }
    return [...(nodes || []), ...reconnecting];
  };


  // §5.1 替换点：换另一种实时传输 = 换这一行构造（不引入 transport 配置项）
  const transport = createSseTransport();

  // 全局事件源（F05 / §4.2）：仅在存在全局订阅者时运行；每 tick 拉一次 router.status 差值成上下线事件。
  const topologyPollMs = readPositiveMs('OAMP_WEB_TOPOLOGY_POLL_MS', TOPOLOGY_POLL_DEFAULT_MS);
  const topologyWatch = createTopologyWatch({
    transport,
    queryNodes: async () => (await queryOnce(config.socketPath, 'router.status', {})).nodes,
    pollMs: topologyPollMs,
  });

  // ★ 0029 pr-005（F05 验收 5 / A-04）：`agent_state` 订阅者登记表 + 第二个投影 tick —— 只在**存在订阅者**时运行
  //   （零常驻 UDS 流量）；订阅建立时经 `onFilteredSubscription` 起表。快照面（GET /api/agents）按请求现拉，
  //   与本 tick 共用 `projectAgentState` ⇒ 两处同源。
  const agentStateSubscribers = new Set();
  const agentStateWatch = createAgentStateWatch({
    transport,
    subscribers: agentStateSubscribers,
    queryNodes: async () => {
      const nodes = (await queryOnce(config.socketPath, 'router.status', {})).nodes;
      writeRoster(nodes); // 投影计算即刷新运行态名册（best-effort，L1-01）；失败已由 writeRoster 吞掉
      return nodes;
    },
    queryTasks: async () => (await queryOnce(config.socketPath, 'router.task_list', {})).tasks,
    pollMs: topologyPollMs,
  });
  const onFilteredSubscription = ({ kinds }) => {
    if (kinds.length === 0 || kinds.includes('agent_state')) agentStateWatch.ensureRunning();
  };

  // task_id → { chatId, agentId, lines, landed, attempts, slow, registeredAt, timer }：agent 侧的
  // task.update/task.result body 不带 chat_id，派发前登记；lines 供一次性 / shell 路径组装 out 文本（其终态 body 无 text）。
  // landed = 该 task 已落过 out（投递路径与对账路径共用，保证恰一条 out）；attempts / slow = 对账进度（快速预算
  // 用尽转低频续查）；registeredAt / timer = 登记时刻与对账定时器（软 TTL 判据）。pr-007。
  // 登记只在落库（landed）或软 TTL 到期后删除：转低频续查时保留登记，晚到的投递仍能认领。
  const tasks = new Map();
  // ★ 0018（architecture §4.3）：调用面登记（call_id → entry.call）——带 output_schema 的调用在终态后仍需按同一
  // schema 复算 structured_output（GET /api/calls/:call_id 的 structured_output），而任务表条目不存该 schema
  // （既有 UDS 面零改动）。与任务表同为进程内内存态（差异 ⑩ 同一生命周期口径）；只登记带 output_schema 的
  // 调用 ⇒ 常驻开销可忽略。
  // ★ FIX-1：该登记同时是调用**终态的单一写点/读点**（`publishCallResult` 写 `terminal`，信封 / roster / 转录读它）——
  // 覆写只可能发生在带 output_schema 的调用上，故与登记范围天然一致，既有面不受影响。
  const callSchemas = new Map();
  const waiters = new Map();
  const reconcileIntervalMs = readPositiveMs('OAMP_WEB_RECONCILE_INTERVAL_MS', RECONCILE_DEFAULT_MS);
  const reconcileSlowMs = readPositiveMs('OAMP_WEB_RECONCILE_SLOW_MS', RECONCILE_SLOW_DEFAULT_MS);
  const reconcileTtlMs = readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', RECONCILE_TTL_DEFAULT_MS);

  const publishMessage = (chatId, message) =>
    transport.publish(chatId, { type: 'message', data: { chat_id: chatId, message } });
  // ★ 0021 pr-003（architecture §3.2 L2-8 / §7 T-13、T-14）：状态发布点**追加**一次全局广播——帧形态与既有
  //   chat:<id> 帧逐字相同，只多走全局键（既有订阅者行为零变化）；对话终态因此在全局链路上可观测（F07 / E3：
  //   不停留在该对话也能收到）。「这算不算一类通知」由前端从 chat_state 派生，服务端零事件类型常量、不判通知。
  // ★ 0021 pr-004 第 2 轮（Q6）：`opts` 默认等价——不传 = 上述行为逐字不变；传 LOCAL_ONLY ⇒ 定向帧照发、
  //   全局广播关闭（调用面驱动的状态变化）。
  const publishState = (chatId, state, opts = {}) => {
    transport.publish(chatId, { type: 'chat_state', data: { chat_id: chatId, state } });
    if (opts.global === false) return;
    transport.publishGlobal({ type: 'chat_state', data: { chat_id: chatId, state } });
  };

  /** 等待句柄释放（A-09 / L2-09）：**唯一释放点 = 终态发布点** —— 句柄只在此被解，不在别处；本进程无登记的 id
   *  由既有对账兜底（`scheduleReconcile` / `reconcileTask`）复查覆盖 ⇒ 等待的退出判据恒为"终态"。 */
  const releaseWaiters = (callId, envelope) => {
    const set = waiters.get(callId);
    if (!set) return;
    waiters.delete(callId);
    for (const resolve of set) resolve(envelope);
  };

  /** 取消收口（F13 / A-10）：终态真源仍是 Router 任务表 —— 本进程有登记的调用 ⇒ 落**恰一条** out
   *  （`error='cancelled'`，与既有"派发失败"分支同款）+ 推 `chat_state`（对话不停在 `working`）+ 经唯一终态
   *  发布点收口（发布 → 关流 → 解等待句柄），并即刻撤下登记（迟到的 `task.update` / `task.result` 在状态面被忽略）；
   *  本进程无登记（另一进程派发 / web 重启后）⇒ 无 out 可落（对话归属不在本进程），仍按同一终态语义收口本进程的
   *  订阅与等待句柄；内容一律取自任务表，不伪造、不做 web 侧状态覆盖。 */
  const settleCancelledCall = (callId, task, envelope) => {
    const entry = tasks.get(callId);
    if (entry && !entry.landed) {
      entry.landed = true;
      clearTimeout(entry.timer);
      tasks.delete(callId);
      finishTask(entry, { state: 'failed', error: 'cancelled' });
      publishCallResult(task, entry); // 同一 tick 内收口（与投递路径共用同一发布点，不出现第二个终态源）
      return;
    }
    if (task === null) return;
    transport.publishCall(callId, { type: CALL_EVENTS.result, data: { chat_id: task.chat_id ?? null, ...envelope } });
    transport.closeCallSubscriptions(callId);
    releaseWaiters(callId, envelope);
  };

  /** 调用面终态单一发布点（★ 0018，architecture §4.3）：投递路径与对账路径**共用**——① 解阻塞（释放等待句柄，
   *  阻塞中的 POST /api/calls 写 200 终态信封）② 按 call:<callId> 与 chat-calls:<chatId> 两键发布 call_result。
   *  `call.published` 幂等：对账分支另有一次调用（已自带条目），不重复发布、不重复解阻塞。
   *  task = null（Router 已重启，条目不可得）⇒ 不发布、按「不存在」解阻塞（调用方得明确的 404，不伪造内容）。 */
  const publishCallResult = (task, entry) => {
    const call = entry.call;
    if (!call || call.published) return;
    call.published = true;
    const envelope = task === null ? null : composeCallEnvelope(task, call);
    if (envelope !== null) {
      // ★ FIX-1：终态在此**写入**调用登记——strict 覆写随信封一并落到真源，roster / 转录读同一记录，零漂移
      call.terminal = { state: envelope.state, error: envelope.error };
      if (call.requester !== null) {
        pickup.add({
          call_id: call.callId,
          requester: call.requester,
          agent: call.role,
          chat_id: call.chatId,
          terminal_at: Date.now(),
          acked: false,
        });
      }
      transport.publishCall(call.callId, { type: CALL_EVENTS.result, data: { chat_id: call.chatId, ...envelope } });
      transport.closeCallSubscriptions(call.callId);
    }
    if (call.resolve !== null) call.resolve(envelope);
    releaseWaiters(call.callId, envelope);
  };

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
    // ★ 0021 pr-004 第 2 轮（Q6）：调用面条目（entry.call）的终态同样只走定向键
    if (chat) publishState(entry.chatId, chat.chat.state, entry.call ? LOCAL_ONLY : undefined);
    // ★ 0018（architecture §4.3）：调用面终态分发是**追加**发布（既有三行顺序零改动）；仅调用面登记条目参与
    // ⇒ 既有 /api/messages 派发的任务零额外 UDS 查询（E9）。Router 任务表是权威运行态且投递发生在记表之后，
    // 故经既有 task_get 取回条目交给单一发布点。
    if (entry.call) {
      queryOnce(config.socketPath, 'router.task_get', { task_id: entry.call.callId })
        .then((r) => publishCallResult(r && r.task ? r.task : null, entry))
        .catch(() => {});
    }
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
      publishCallResult(task, current); // ★ 0018：对账路径同样经单一发布点（条目已在手，不必再查）
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

  /** agent 回传消费（§5.3 推送链）：task.update → SSE task_update（不入库）；task.result → 落盘 + 推送；
   *  notice → 上下文提示转发（context_released / context_reset）／确认请求上浮（confirmation_request）／失效移出（confirmation_cancelled）。 */
  const handleDeliver = (message) => {
    if (message.type === 'notice') {
      // SSE 侧提示 kind（§5.2）：context_released = chat 关闭释放；context_reset = 崩溃/超时/淘汰。
      // agent 负责产出提示，web 只转发（不自行 publish，避免双条）。
      const body = parseMessageBody(message.payload);
      if (!body) return;
      // ★ 0021 pr-003（architecture §5.2 / §5.3 信封 1）：确认请求上浮——**首次**登记成功才发一帧全局 `confirmation`
      //   （重复投递同一 confirmation_id 不再入表、不再发帧：通知「恰一次」由单一发布点保证，不靠前端记忆）；
      //   定向帧一发不发（该事件与对话无关，走全局键）。条目 = 信封 1 的 9 个字段（重建面与实时帧同形状）。
      if (body.kind === 'confirmation_request') {
        if (typeof body.confirmation_id !== 'string' || body.confirmation_id === '') return;
        const entry = {
          confirmation_id: body.confirmation_id,
          request_kind: body.request_kind === 'question' ? 'question' : 'permission', // 缺字段 / 非字符串 / 域外值 ⇒ 兜底 'permission'（§5.2.1）
          chat_id: typeof body.chat_id === 'string' ? body.chat_id : null,
          agent_id: typeof body.agent_id === 'string' ? body.agent_id : null,
          tool: typeof body.tool === 'string' ? body.tool : null,
          title: typeof body.title === 'string' ? body.title : null,
          options: Array.isArray(body.options) ? body.options : [],
          multiple: body.multiple === true,
          created_at: Number.isFinite(body.created_at) ? body.created_at : Date.now(),
        };
        if (inbox.add(entry)) transport.publishGlobal({ type: 'confirmation', data: entry });
        return;
      }
      // ★ 0021 pr-003（architecture §5.3 信封 3）：失效路径（agent 侧轮次已死 / 上下文已淘汰）——只移出在途表，
      //   **不发任何帧**（未裁决项的消失不是通知事件；栏内移除以 R-2 的 200 为依据）。
      if (body.kind === 'confirmation_cancelled') {
        if (typeof body.confirmation_id === 'string') inbox.remove(body.confirmation_id);
        return;
      }
      const chatId = typeof body.chat_id === 'string' ? body.chat_id : null;
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
      // ★ 0018（architecture §4.1）：调用面条目**追加**发布调用面增量（既有帧逐字不变）。首个增量到达即状态
      // 迁移 ⇒ call_state: working 每调用只发一次；控制条目 started/truncated 上面已被 kind 过滤挡住，不下发。
      if (entry.call) {
        const call = entry.call;
        if (!call.working && body.state === 'working') {
          call.working = true;
          transport.publishCall(call.callId, { type: CALL_EVENTS.state, data: { chat_id: call.chatId, call_id: call.callId, agent: call.role, state: 'working' } });
        }
        transport.publishCall(call.callId, {
          type: CALL_EVENTS.update,
          data: { chat_id: call.chatId, call_id: call.callId, agent: call.role, kind: body.kind, text: body.text, line: body.line },
        });
      }
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

  // 路由表（F01）：表顺序 = 匹配优先级 = 改造前 if 链顺序；在依赖构造完成之后、createServer 之前构造，
  // handler 直接闭包引用本作用域局部名（handler 体零改写）。
  // getEpoch / checkEpoch / getAgentProjection / agentStateSubscribers 都是本作用域的真实实现（默认值只服务
  // 「纯构造」调用方）⇒ 必须在接线处显式传入，否则 epoch 恒为占位值、代次校验失效、名册提示不进视图。
  const routes = createApiRoutes({
    db, transport, config, topologyWatch, tasks, callSchemas, publishMessage, publishState, sendTask, sendControlNotice, scheduleReconcile,
    waiters, getEpoch, checkEpoch, getAgentProjection, agentStateSubscribers, onFilteredSubscription, settleCancelledCall,
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    const qs = url.searchParams;
    const num = (key) => {
      const raw = qs.get(key);
      return raw === null || raw === '' ? undefined : Number(raw);
    };
    try {
      const hit = matchRoute(routes, req.method, p);
      if (hit) {
        // handler 无返回契约：await 后只 return——不检查返回值、不自动 sendJson（SSE 路由独占 res，§3.4 契约 2）
        await hit.route.handler({ req, res, query: qs, num, params: hit.params });
        return;
      }
      const file = STATIC_FILES[p];
      if (req.method === 'GET' && file) {
        serveStatic(res, file);
        return;
      }
      sendError(res, 404, ERR_CODE.NOT_FOUND, `not found: ${req.method} ${p}`);
    } catch (err) {
      sendError(res, 502, ERR_CODE.UPSTREAM_UNAVAILABLE, `router 不可达或请求失败: ${err && err.message ? err.message : err}`);
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
      callSchemas.clear(); // 退出不留调用面登记（与任务表同生命周期）
      topologyWatch.stop(); // 退出不留拓扑轮询表
      agentStateWatch.stop(); // 退出不留投影轮询表
      writeRoster(lastRosterNodes); // 正常退出前刷新运行态名册（best-effort，L1-01：软重启窗口的提示来源）
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
