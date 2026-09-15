// sdk/doctor.js — 契约自检（F11 / F08；architecture §2.1 DOC、§4.1 N-7、§5.5）
// 三段（§5.5）：R1 文档侧（`API.md` §3 的 21 行，`<param>` → `:param` 归一）↔ 运行侧（`GET /api/docs` 的
//   `routes[]`，每次现算的登记投影）**双向**比对；R2 9 条非流式 GET 的**只读可达性**探测（判定 = 响应不是
//   路由兜底）；R3 8 个 Router 方法的**存在性**探测（判定 = 响应不是 `-32601 METHOD_NOT_FOUND`）。
// 复用而非重建（§2.3）：HTTP 全经 ./http.js、UDS 会话全经 ./uds.js（不写第二套客户端 / 帧编解码）；
//   SDK 内**不存端点表**用于比对（运行侧真源 = `GET /api/docs`，文档侧真源 = `API.md`）。
// 零写副作用（MI-02 / F11 验收 3）：R1 只发 1 次只读 GET；R2 只发 GET；R3 的探针全落在
//   "参数校验先于副作用"或只读方法上（`agent.register` 用缺参、心跳未注册、其余未注册、`router.*` 只读）。
// 零状态（F09 / §0.4 契约 12）：模块级只有 const；每探针一连接一关闭（`finally`），不注册身份、不缓存响应。
// 不可达即降级（F08 验收 1/2 / §5.5）：web 面 / UDS 面任一不可达 ⇒ 抛 `HubError`（`exitCode: 3`），
//   **不返回部分 items**（不半跑、不把"跑不完"伪装成"跑完了"）。
// 零自动性（L2-9 / G02 验收 3）：探针不重试、不重连、不补发、不改 hub 状态。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from './http.js';
import { connect } from './uds.js';
import { HubError } from './errors.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根 = oamp/
const API_DOC_PATH = path.join(PKG_ROOT, 'API.md'); // 文档侧基准（DEFAULT；可被调用方注入副本制造漂移）
const API_DOCS_PATH = '/api/docs'; // 运行侧清单来源（§2.3 接缝表：既有登记投影）
const PROBE_PLACEHOLDER = 'probe'; // R2 的路径参占位（固定字面量；不新增任何选项 / 参数 —— MI-7）
const NOTIFY_WINDOW_MS = 1000; // R3 通知型方法的存在性窗口（§5.5：不回帧，窗口内无响应计存在）
const METHOD_NOT_FOUND = '-32601'; // JSON-RPC 数值码经 uds.js 落 .code 的形态（A13：SDK 不建第二份协议码表）

/** 归一化：截断 `?`/`#`、`<param>` 与 `:name` 一律归一（全模块仅此一处，逐字参照 A16 的手法）。 */
function shapePath(p) {
  return p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');
}

/** 文档侧：`API.md` §3 的表格行 `| n | \`METHOD /path\` | … |` → `{method, path}`（原样，未归一）。 */
async function readDocumented(apiDocPath) {
  const text = await fs.readFile(apiDocPath, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    const matched = /^\|\s*\d+\s*\|\s*`(GET|POST)\s+(\/api\/[^`]*)`/.exec(line.trim());
    if (matched) rows.push({ method: matched[1], path: matched[2] });
  }
  return rows;
}

/** R1 双向清单比对：文档有运行无 ⇒ 登记缺失；运行有文档无 ⇒ 文档未覆盖；两侧都有 ⇒ pass。 */
function compareSignatures(documented, routes) {
  const docMap = new Map(documented.map((row) => [`${row.method} ${shapePath(row.path)}`, row]));
  const runMap = new Map(routes.map((row) => [`${row.method} ${shapePath(row.path)}`, row]));
  const items = [];
  for (const [signature, doc] of docMap) {
    const run = runMap.get(signature);
    items.push({
      id: `R1 ${signature}`,
      ok: run !== undefined,
      expected: `${doc.method} ${doc.path}`,
      actual: run === undefined ? null : `${run.method} ${run.path}`,
      ...(run === undefined ? { reason: '登记缺失' } : {}),
    });
  }
  for (const [signature, run] of runMap) {
    if (docMap.has(signature)) continue;
    items.push({
      id: `R1 ${signature}`,
      ok: false,
      expected: null,
      actual: `${run.method} ${run.path}`,
      reason: '文档未覆盖',
    });
  }
  return items;
}

/** 路由兜底形态（A9 / `src/web.js` 的 404 出口）：`404` + `error` 逐字等于 `not found: <方法> <路径>`。 */
function isRouteFallback(err, method, requestPath) {
  return err instanceof HubError && err.httpStatus === 404 && err.upstream !== null && err.upstream.error === `not found: ${method} ${requestPath}`;
}

/** 观测摘要（`actual` 面）：成功记状态码，失败记 `<状态码> <code>`。 */
function observed(err) {
  if (err instanceof HubError) {
    return `${err.httpStatus === null ? '' : `${err.httpStatus} `}${err.code}`;
  }
  return err && err.message ? err.message : String(err);
}

/** 基础设施不可达（连接失败 / 响应超时 / 订阅被服务端终止 / 上游 502）⇒ 3：不半跑，向上抛。 */
function isUnreachable(err) {
  return err instanceof HubError && err.exitCode === 3;
}

/** R2 只读可达性：非流式 GET 各发一次空参 GET（路径参用占位字面量）；4 条 SSE 与 8 条 POST 不探并说明理由。 */
async function probeHttpGet(routes, port) {
  const items = [];
  for (const route of routes) {
    const id = `R2 ${route.method} ${route.path}`;
    const expected = '非路由兜底';
    if (route.method !== 'GET') {
      items.push({ id, ok: true, skipped: true, expected, actual: null, reason: '写端点不探，零写副作用' });
      continue;
    }
    if (route.kind !== 'json') {
      items.push({ id, ok: true, skipped: true, expected, actual: null, reason: '流式端点，不探（存在性由 R1 覆盖）' });
      continue;
    }
    const target = route.path.replace(/:[^/]+/g, PROBE_PLACEHOLDER);
    try {
      await request({ port, method: 'GET', path: target, query: null, body: null });
      items.push({ id, ok: true, expected, actual: '200' });
    } catch (err) {
      if (isUnreachable(err)) throw err;
      if (isRouteFallback(err, route.method, target)) {
        items.push({ id, ok: false, expected, actual: '404 路由兜底', reason: '端点未登记（响应是路由兜底）' });
      } else {
        items.push({ id, ok: true, expected, actual: observed(err) }); // 400 / 404（对象不存在）等 = 端点在场
      }
    }
  }
  return items;
}

/** R3 探针集（§5.1 层 B 表「探测面」列）：每探针一连接一关闭，零身份合成、零写副作用。 */
const R3_PROBES = [
  { method: 'agent.register', params: {} }, // 缺 instance_id 校验先于副作用 ⇒ INVALID_PARAMS
  { method: 'agent.heartbeat', params: {}, notification: true }, // 通知语义（不回帧）⇒ 窗口内静默计存在
  { method: 'agent.deregister', params: {} }, // 未注册 ⇒ UNREGISTERED
  { method: 'message.send', params: {} }, // 未注册 ⇒ UNREGISTERED
  { method: 'message.ack', params: {} }, // 未注册 ⇒ UNREGISTERED
  { method: 'router.status', params: {} }, // 只读 ⇒ ok
  { method: 'router.task_get', params: {} }, // 缺 task_id ⇒ INVALID_PARAMS
  { method: 'router.task_list', params: { state: '__probe__' } }, // 非法 state ⇒ INVALID_PARAMS
];

// A13 的会话 API 适配（本模块不 import surface.js：§2.1 无 DOC --> SUR 边 ⇒ 探针表与适配各自成对，
//   不是第二份"命令表"—— doctor 不参与 CLI 分派，也不复制 40 条入口名面）。
const R3_CALLS = {
  'agent.register': (session, params) => session.register(params.instance_id),
  'agent.heartbeat': (session, params) => session.heartbeat(params),
  'agent.deregister': (session) => session.deregister(),
  'message.send': (session, params) => session.send(params),
  'message.ack': (session, params) => session.ack(params),
  'router.status': (session) => session.status(),
  'router.task_get': (session, params) => session.taskGet(params.task_id),
  'router.task_list': (session, params) => session.taskList(params),
};

/** 通知型方法的存在性窗口（无响应 = 存在；有响应但为 -32601 才是 fail）。 */
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** R3 方法存在性：逐探针 connect → 单方法 → close；判定 = 响应不是 `-32601`。 */
async function probeUdsMethods() {
  const items = [];
  for (const probe of R3_PROBES) {
    const id = `R3 ${probe.method}`;
    const expected = `响应不是 ${METHOD_NOT_FOUND} METHOD_NOT_FOUND`;
    let session = null;
    try {
      session = await connect({}); // 每探针一连接；不 register（零身份合成）
      if (probe.notification === true) {
        await R3_CALLS[probe.method](session, probe.params); // notify：不等待响应
        await wait(NOTIFY_WINDOW_MS);
        items.push({ id, ok: true, expected, actual: `静默（通知型，${NOTIFY_WINDOW_MS}ms 内无响应）` });
      } else {
        await R3_CALLS[probe.method](session, probe.params);
        items.push({ id, ok: true, expected, actual: 'ok' });
      }
    } catch (err) {
      if (isUnreachable(err)) throw err; // UDS 不可达 ⇒ 统一错误，不半跑
      const code = err instanceof HubError ? err.code : observed(err);
      items.push({
        id,
        ok: code !== METHOD_NOT_FOUND,
        expected,
        actual: `code ${code}`,
        ...(code === METHOD_NOT_FOUND ? { reason: '方法未登记（-32601）' } : {}),
      });
    } finally {
      if (session !== null) session.close();
    }
  }
  return items;
}

/**
 * 契约自检（§5.5；跨 PR 接口契约，签名不得改名）。
 * @param {{apiDocPath?: string, port?: number}} [opts] `apiDocPath` 缺省 = `<包根>/API.md`（可注入副本制造漂移）；
 *   `port` 由调用方提供（CLI 面 = cli.js 的 ctx；库面 = createHub 绑定）
 * @returns {Promise<{pass: boolean, items: Array<{id: string, ok: boolean, expected: *, actual: *, reason?: string, skipped?: boolean}>}>}
 * @throws {HubError} hub 不可达（`exitCode: 3`）—— 不返回部分 items
 */
export async function check({ apiDocPath = API_DOC_PATH, port } = {}) {
  const documented = await readDocumented(apiDocPath);
  const docs = await request({ port, method: 'GET', path: API_DOCS_PATH, query: null, body: null }); // 只读一次（R1/R2 共用）
  const routes = Array.isArray(docs?.routes) ? docs.routes : [];
  const items = [
    ...compareSignatures(documented, routes), // R1 清单双向比对
    ...(await probeHttpGet(routes, port)), // R2 只读可达性
    ...(await probeUdsMethods()), // R3 方法存在性
  ];
  return { pass: items.every((item) => item.ok !== false), items };
}
