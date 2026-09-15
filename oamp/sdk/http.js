// sdk/http.js — 层 A（Web 面）请求原语（F02 / F06 / F09 / F10；architecture §2.2 流 1·流 3、§4.1 N-4）
// 一次调用 = 恰好一次请求：method / path（路径参数已由调用方替换）/ query / body 原样下行，
// 响应体与上游错误体原样上行（§5.2 规则 2 / W3）——不加信封、不改字段名、不裁剪、不补默认值，
// 不做跨端点组合（截断正文重建 / 节点清单反查 / 分页续取 / 批量编排）——跨端点语义不属本条目的薄封装。
// 三条上限语义不同、不混淆（§5.4 要点）：连接建立 2000ms ｜ 响应头 5000ms ｜ `--wait` 显式上限。
// 零状态（F09 / §8 C8）：零本地写、零模块级可变状态、每请求一连接（agent: false）且结束即关、无重试。
// 端口只接受显式入参——`OAMP_WEB_PORT` 缺省链的唯一落点在 createHub()（§5.2，归 pr-003 / pr-004）。

import http from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { HubError, classify } from './errors.js';

const HOST = '127.0.0.1';
const CONNECT_TIMEOUT_MS = 2000; // 连接建立上限（沿用 src/node-client.js / src/status.js 同值先例）
const RESPONSE_TIMEOUT_MS = 5000; // 非阻塞条目的响应上限，计到响应头到达为止（§5.4 序 ②）
const FRAME_SEPARATOR = '\n\n'; // SSE 帧界（transport.js 逐帧写 `…\n\n`）

/** 目标地址（错误文案与归类共用一处构造）。 */
function addressOf({ port }) {
  return `${HOST}:${port}`;
}

/** 归类表唯一落点 = errors.js；本模块只提供观测与文案。 */
function hubError(observation, error) {
  const { code, exitCode } = classify(observation);
  return new HubError({ code, error, exitCode });
}

/** 连接失败（§5.4 `3` 类 ①②）：文案逐字沿用 §5.4 的不可达形态。 */
function unreachable(target) {
  return hubError({ kind: 'connect' }, `无法连接 hub（${target}；服务未运行？）`);
}

/** 非阻塞条目响应超时（§5.4 `3` 类 ②）——与 `WAIT_TIMEOUT` 文案不同类、不混淆。 */
function responseTimeout(target) {
  return hubError({ kind: 'response-timeout' }, `等待响应超时（${RESPONSE_TIMEOUT_MS}ms；${target}）`);
}

/** 已建立的订阅被服务端异常终止（§5.4 `3` 类 ③）。 */
function streamEnded(target) {
  return hubError({ kind: 'stream-ended' }, `与 hub 的连接被服务端终止（${target}）；订阅已结束`);
}

/** 可阻塞条目在 `--wait` 内未见终态（§5.4 `1` 类 ②）：文案含上限与"调用仍在进行"这一事实。 */
function waitTimeout(waitMs) {
  return hubError({ kind: 'wait-timeout' }, `等待超时（${waitMs}ms）：调用仍在进行`);
}

/** query 原样序列化（MI-5）：键名与值不改写、不增删、不排序、不发明默认值；`undefined` / `null` 值的键不发出。 */
function queryString(query) {
  if (query === null) return '';
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/** 请求行路径 = path 原样（`:param` 已由调用方替换）+ 查询串（无 query ⇒ 逐字原样）。 */
function requestPath(path, query) {
  const search = queryString(query);
  return search === '' ? path : `${path}?${search}`;
}

/**
 * 建连 + 写请求，并施加两道上限（§5.4 `3` 类 ①②）：连接建立 2000ms、响应头 5000ms。
 * 响应头到达即两道定时器都清除（MI-3）——长响应体与 SSE 长流因此不会被误判超时。
 * @returns {{req: import('node:http').ClientRequest, response: Promise<import('node:http').IncomingMessage>}}
 */
function open(spec, headers, payload) {
  const target = addressOf(spec);
  const req = http.request({
    host: HOST,
    port: spec.port,
    method: spec.method,
    path: requestPath(spec.path, spec.query ?? null),
    agent: false, // 每请求一连接，不复用 socket（F09）
    headers,
  });
  let settled = false;
  const response = new Promise((resolve, reject) => {
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(responseTimer);
      fn(value);
    };
    const connectTimer = setTimeout(() => {
      req.destroy();
      settle(reject, unreachable(target));
    }, CONNECT_TIMEOUT_MS);
    const responseTimer = setTimeout(() => {
      req.destroy();
      settle(reject, responseTimeout(target));
    }, RESPONSE_TIMEOUT_MS);
    req.on('socket', (socket) => {
      if (socket.connecting) socket.once('connect', () => clearTimeout(connectTimer));
      else clearTimeout(connectTimer);
    });
    req.on('response', (res) => settle(resolve, res));
    req.on('error', () => settle(reject, unreachable(target))); // ECONNREFUSED / ENOENT / ECONNRESET / EPIPE
    // 请求被销毁（`--wait` 本地中止）或连接被掐后不再有 response ⇒ 在此兜住，由调用方按观测归类。
    req.on('close', () => settle(reject, unreachable(target)));
  });
  req.end(payload === null ? undefined : payload);
  return { req, response };
}

/** 收响应体（UTF-8）。中途连接被掐（ECONNRESET / EPIPE）同属连接失败（§5.4 `3` 类 ②）。 */
function readBody(res, target) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', () => reject(unreachable(target)));
  });
}

/**
 * 层 A 一次请求（F02 / §2.2 流 1）。
 * @param {{port: number, method: string, path: string, query?: object|null, body?: object|null, waitMs?: number|null}} spec
 * @returns {Promise<object|null>} 成功 → 服务端响应体原对象（不加信封）；失败 → 抛 `HubError`
 */
export async function request(spec) {
  const { body = null, waitMs = null } = spec;
  const target = addressOf(spec);
  const payload = body === null ? null : JSON.stringify(body);
  const { req, response } = open(spec, payload === null ? {} : { 'content-type': 'application/json' }, payload);

  // 上限③（§5.4 `1` 类 ② / F10）：覆盖整次调用（含响应体）——到上限只结束本次等待并中止在途请求，
  // 不发第二个请求、不做调用标识反查（P-1）；服务端调用不受影响（API.md §5.13）。
  let waited = false;
  const waitTimer =
    waitMs === null
      ? null
      : setTimeout(() => {
          waited = true;
          req.destroy();
        }, waitMs);

  try {
    const res = await response;
    const text = await readBody(res, target);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const upstream = JSON.parse(text); // §2.2：4xx/5xx 响应体恒为 {error, code}
      const { code, exitCode } = classify({ kind: 'response', status: res.statusCode, body: upstream });
      throw new HubError({ code, error: upstream.error, exitCode, httpStatus: res.statusCode, upstream });
    }
    return text === '' ? null : JSON.parse(text); // §2.1：成功响应就是资源对象本身
  } catch (err) {
    throw waited ? waitTimeout(waitMs) : err;
  } finally {
    if (waitTimer !== null) clearTimeout(waitTimer);
  }
}

/** 解析一个 SSE 帧块：取 `event:` / `data:` 行；`:` 注释行（15s keepalive）与不带这两行的帧不产出条目。 */
function parseFrame(block) {
  let event = null;
  let data = null;
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) data = line.slice('data:'.length).trim();
  }
  if (event === null || data === null) return null;
  return { event, data: JSON.parse(data) }; // data = 帧 data 的 JSON 解析值（服务端恒单行 JSON.stringify）
}

/**
 * 层 A 订阅（F06 / §2.2 流 3）：GET SSE，按空行切帧、逐帧产出 `{event, data}`。
 * 不做聚合 / 去重 / 进度换算 / 自动重连 / 断点续订（N9 / G02）；帧 data 原样下行。
 * 服务端终止 ⇒ `HUB_UNREACHABLE` / `3`；消费者主动停止（`break`）⇒ 正常收尾（连接关闭、不抛错）。
 * @param {{port: number, method: string, path: string, query?: object|null, body?: object|null, waitMs?: number|null}} spec
 */
export async function* stream(spec) {
  const target = addressOf(spec);
  const { req, response } = open(spec, { accept: 'text/event-stream' }, null);
  const res = await response;
  const decoder = new StringDecoder('utf8'); // 帧可能在任何位置被切断，含多字节字符的半个码元
  let buffer = '';
  try {
    for await (const chunk of res) {
      buffer += decoder.write(chunk);
      let end = buffer.indexOf(FRAME_SEPARATOR);
      while (end !== -1) {
        const frame = parseFrame(buffer.slice(0, end));
        buffer = buffer.slice(end + FRAME_SEPARATOR.length);
        if (frame !== null) yield frame;
        end = buffer.indexOf(FRAME_SEPARATOR);
      }
    }
  } catch {
    // 读到一半被重置（ECONNRESET / EPIPE）：与服务端终止同类，统一在下方抛出（§5.4 `3` 类 ③）
  } finally {
    req.destroy(); // 消费者 break（return()）或流结束：结束本次连接，不留句柄
  }
  throw streamEnded(target); // 循环自然结束 = 已建立的订阅被服务端终止
}
