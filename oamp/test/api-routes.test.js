// test/api-routes.test.js — 0016 PR-1：路由登记 + 派生面 + 漂移锁（F01 / F02 / F05 / F06）
// 载体：① 进程内直接调用登记构造器 / 投影 / 生成函数（三条漂移锁 + 匹配器单测；不起服务、不占端口）；
//       ② 真实 Router + `oamp web start` 子进程（L2 探针：既有 10 条 API 的行为等价 + 两个派生产物）。
// 归属：本文件是 PR-1 新增断言的唯一落点——既有 `test/web.test.js` 零字节改动（architecture §4.4 / L2-10），
//       故此处自带同款 startWeb 启动辅助（不抽公共 helper、不改既有文件）。
// 期望值口径：L2 的期望值 = 改造前对未改造实现实测固化的值（architecture §4.2 / §4.5）；不照抄上游报告。
// 不依赖真实 omp / 真实 LLM / 外网；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import {
  createApiRoutes,
  matchRoute,
  projectRoutes,
  renderLlmsTxt,
  ROUTE_META_FIELDS,
  PARAM_FIELDS,
  PARAM_IN,
  PARAM_TYPES,
  ROUTE_KINDS,
  ERR_CODE,
} from '../src/web.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');
const LLMS_SNAPSHOT = path.join(ROOT, 'llms.txt');
const API_MD = path.join(ROOT, 'API.md');

/** 接口面签名（表顺序 = 匹配优先级 = 改造前 if 链顺序 + 末位新增 GET /api/docs，architecture §3.3 对照表）。 */
const EXPECTED_SIGNATURES = [
  'GET /api/agents',
  'GET /api/chats',
  'GET /api/chats/:chat_id',
  'POST /api/chats/:chat_id/close',
  'POST /api/chats/archive',
  'POST /api/chats/:chat_id/activate',
  'POST /api/chats/:chat_id/rename',
  'GET /api/stream',
  'GET /api/events',
  'POST /api/messages',
  'GET /api/docs',
];

function pickPort() {
  return 45000 + Math.floor(Math.random() * 2000);
}

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会把它判 offline
// → Router 对 task.update/result 只记录不投递。本文件统一放长租约（与 web.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

async function startWeb(socketPath, port, envExtra = {}) {
  const child = spawn(process.execPath, [BIN, 'web', 'start', '--port', String(port)], {
    cwd: ROOT,
    env: buildEnv(socketPath, { ...LEASE_ENV, ...envExtra }),
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
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

/** 起真实 Router + web（含临时 OAMP_DB）；返回 web 句柄。 */
async function setupWeb(t) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-api-routes-db-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const web = await startWeb(router.socketPath, pickPort(), {
    OAMP_DB: path.join(dbDir, 'sql.db'),
    OAMP_WEB_TOPOLOGY_POLL_MS: '200',
  });
  t.after(() => web.stop());
  return web;
}

/** 裸请求：返回 status / content-type / connection / 原文 / 可解析 JSON 体。 */
async function jreq(base, method, p, init = {}) {
  const res = await fetch(`${base}${p}`, { method, ...init });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 静态面 / SSE：非 JSON */
  }
  return { status: res.status, ct: res.headers.get('content-type'), conn: res.headers.get('connection'), text, body };
}

const json = (payload) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
/** 畸形请求体（原文发送，不经 JSON.stringify）：用于 readBody 的 400 路径）。 */
const rawJson = (text) => ({ headers: { 'content-type': 'application/json' }, body: text });

/** 读 SSE 首帧（只取第一帧后即断开）——用于断言"分发层未把它当 JSON 包装"。 */
async function readSseHead(base, p) {
  const ac = new AbortController();
  const res = await fetch(`${base}${p}`, { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const timer = setTimeout(() => ac.abort(), 1500);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.includes('\n\n')) break;
    }
  } catch {
    /* abort */
  }
  clearTimeout(timer);
  ac.abort();
  return { status: res.status, ct: res.headers.get('content-type'), head: buf };
}

/** SSE 订阅客户端（fetch + reader 手工解析；与 web.test.js 同款，只取需要的帧）。 */
async function openSse(base, chatId) {
  const ac = new AbortController();
  const res = await fetch(`${base}/api/stream?chat_id=${encodeURIComponent(chatId)}`, { signal: ac.signal });
  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let type = null;
          let data = null;
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) type = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (type && data) {
            try {
              events.push({ type, data: JSON.parse(data) });
            } catch {
              /* 忽略坏帧 */
            }
          }
        }
      }
    } catch {
      /* abort */
    }
  })();
  return { res, events, close: () => ac.abort(), pump };
}

// ────────────────────────── 漂移锁①：元数据必填（真实表项，不读源码） ──────────────────────────

test('漂移锁①：登记元数据必填（createApiRoutes 的真实表项）', () => {
  const routes = createApiRoutes({}); // 纯构造：传空依赖即可（不调用依赖、不读磁盘、不起定时器）
  const errCodes = new Set(Object.values(ERR_CODE));
  const findings = [];

  assert.deepEqual(
    routes.map((r) => `${r.method} ${r.path}`),
    EXPECTED_SIGNATURES,
    '登记集合 / 顺序应与改造前 if 链顺序 + 新增 GET /api/docs 一致（architecture §3.3）',
  );

  for (const route of routes) {
    const tag = `[${route.method} ${route.path}]`;
    for (const field of ROUTE_META_FIELDS) {
      const value = route[field];
      if (field === 'params' || field === 'errors') {
        if (!Array.isArray(value)) findings.push(`元数据缺项: ${tag} ${field}`);
        continue;
      }
      if (typeof value !== 'string' || value === '') findings.push(`元数据缺项: ${tag} ${field}`);
    }
    if (!ROUTE_KINDS.includes(route.kind)) findings.push(`元数据非法: ${tag} kind=${JSON.stringify(route.kind)} 不在 ROUTE_KINDS 内`);
    if (Array.isArray(route.errors)) {
      for (const [i, code] of route.errors.entries()) {
        if (!errCodes.has(code)) findings.push(`元数据非法: ${tag} errors[${i}]=${JSON.stringify(code)} 不在 ERR_CODE 值集合内`);
      }
    }
    if (typeof route.handler !== 'function') findings.push(`元数据缺项: ${tag} handler`);

    for (const [i, param] of (Array.isArray(route.params) ? route.params : []).entries()) {
      for (const field of PARAM_FIELDS) {
        const value = param[field];
        if (field === 'required') {
          if (typeof value !== 'boolean') findings.push(`元数据缺项: ${tag} params[${i}].required`);
          continue;
        }
        if (typeof value !== 'string' || value === '') findings.push(`元数据缺项: ${tag} params[${i}].${field}`);
      }
      if (!PARAM_IN.includes(param.in)) findings.push(`元数据非法: ${tag} params[${i}].in=${JSON.stringify(param.in)} 不在 PARAM_IN 内`);
      if (!PARAM_TYPES.includes(param.type)) findings.push(`元数据非法: ${tag} params[${i}].type=${JSON.stringify(param.type)} 不在 PARAM_TYPES 内`);
      if (param.in === 'path' && !route.path.includes(`:${param.name}`)) {
        findings.push(`元数据非法: ${tag} params[${i}].name=${param.name} 与路径模式中的 :name 不一致`);
      }
    }
  }

  assert.deepEqual(findings, [], findings.join('\n'));
});

// ────────────────────────── 漂移锁②：索引快照逐字节 ──────────────────────────

/** 首处差异定位（行 / 列 / 字节偏移）+ 期望与实际行 + 修复命令（architecture §7.2 锁②）。 */
function describeSnapshotDiff(expected, actual) {
  const e = Buffer.from(expected, 'utf8');
  const a = Buffer.from(actual, 'utf8');
  const n = Math.min(e.length, a.length);
  let offset = 0;
  while (offset < n && e[offset] === a[offset]) offset += 1;
  // 字节偏移 → 行 / 列：按 UTF-8 码点累计（多字节字符不能按 UTF-16 下标直接切）
  let bytes = 0;
  let line = 1;
  let col = 1;
  for (const ch of expected) {
    if (bytes >= offset) break;
    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    bytes += Buffer.byteLength(ch, 'utf8');
  }
  const expectedLine = expected.split('\n')[line - 1] ?? '（缺失）';
  const actualLine = actual.split('\n')[line - 1] ?? '（缺失）';
  return [
    `llms.txt 与生成结果不一致：首处差异 line ${line} col ${col}（byte ${offset}）`,
    `  期望: ${expectedLine}`,
    `  实际: ${actualLine}`,
    `  行数: 期望 ${expected.split('\n').length} / 实际 ${actual.split('\n').length}`,
    '  修复：node oamp/scripts/gen-llms-txt.mjs',
  ].join('\n');
}

test('漂移锁②：llms.txt 快照逐字节（生成结果 vs 仓库文件字节）', () => {
  const expected = renderLlmsTxt(projectRoutes(createApiRoutes({})));
  const actual = fs.readFileSync(LLMS_SNAPSHOT, 'utf8');
  assert.ok(
    Buffer.compare(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8')) === 0,
    describeSnapshotDiff(expected, actual),
  );
});

// ────────────────────────── 漂移锁③：契约文档路径级双向覆盖 ──────────────────────────

/** 归一化：截断 `?`/`#` 之后的部分；`<…>` 占位与 `:name` 一律归一为 `:`（architecture §7.2 锁③）。 */
function shapePath(p) {
  return p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');
}

/** 从 API.md 抽取反引号包裹的 `METHOD /api/…` 签名（唯一可识别形态，architecture §6.7）。 */
function docSignatures(text) {
  const map = new Map();
  for (const m of text.matchAll(/`(GET|POST) (\/api\/[^`]*)`/g)) {
    map.set(`${m[1]} ${shapePath(m[2])}`, `${m[1]} ${m[2]}`);
  }
  return map;
}

test('漂移锁③：API.md 路径级双向覆盖（登记集合 vs 文档集合）', () => {
  const routes = createApiRoutes({});
  const registered = new Map(routes.map((r) => [`${r.method} ${shapePath(r.path)}`, `${r.method} ${r.path}`]));
  const documented = docSignatures(fs.readFileSync(API_MD, 'utf8'));
  const findings = [];
  for (const [sig, raw] of registered) {
    if (!documented.has(sig)) findings.push(`API.md 缺登记: ${raw}`);
  }
  for (const [sig, raw] of documented) {
    if (!registered.has(sig)) findings.push(`API.md 多出未登记路径: ${raw}`);
  }
  assert.deepEqual(findings, [], findings.join('\n'));
});

// ────────────────────────── 匹配器单测（L3） ──────────────────────────

test('匹配器 L3：顺序 / 贪婪与空尾 / 锚定 / 方法不匹配 / 参数解码 / 可达性', () => {
  const routes = createApiRoutes({});
  const pathOf = (hit) => (hit ? hit.route.path : null);

  // 表顺序 = 匹配优先级（首个命中即返回）
  assert.equal(pathOf(matchRoute(routes, 'GET', '/api/agents')), '/api/agents');
  assert.equal(pathOf(matchRoute(routes, 'GET', '/api/chats')), '/api/chats');

  // 贪婪参数：可含 `/`、可空；后缀路由回溯到正确切点；精确串优先于 `:id` 家族
  assert.deepEqual(matchRoute(routes, 'GET', '/api/chats/archive').params, { chat_id: 'archive' });
  assert.deepEqual(matchRoute(routes, 'GET', '/api/chats/').params, { chat_id: '' });
  assert.deepEqual(matchRoute(routes, 'GET', '/api/chats/a/b').params, { chat_id: 'a/b' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/a/b/close').params, { chat_id: 'a/b' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/archive/rename').params, { chat_id: 'archive' });
  assert.equal(pathOf(matchRoute(routes, 'POST', '/api/chats/archive')), '/api/chats/archive');

  // 后缀与前缀尾斜杠重叠：`POST /api/chats/<后缀>` 仍命中的是后缀路由（参数 = 空串），
  // 这是今日 `slice(前缀长度, -后缀长度)` 双侧截取的语义（architecture §3.3 的等价实现，不引入正则）
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/close').params, { chat_id: '' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/activate').params, { chat_id: '' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/rename').params, { chat_id: '' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/close/close').params, { chat_id: 'close' });
  assert.deepEqual(matchRoute(routes, 'POST', '/api/chats/x/rename/rename').params, { chat_id: 'x/rename' });
  assert.equal(pathOf(matchRoute(routes, 'POST', '/api/chats/close/rename')), '/api/chats/:chat_id/rename');

  // 方法不匹配 = 不进入候选（无 405 状态）；精确形态整串比较（不做尾斜杠归一）
  assert.equal(matchRoute(routes, 'PUT', '/api/agents'), null);
  assert.equal(matchRoute(routes, 'GET', '/api/agents/'), null);
  assert.equal(matchRoute(routes, 'GET', '/api/agents/extra'), null);
  assert.equal(matchRoute(routes, 'GET', '/api/nope'), null);

  // 匹配层统一解码：正常编码可解，畸形编码抛 URIError（由分发层单 try/catch 转 502）
  assert.equal(matchRoute(routes, 'GET', '/api/chats/chat%2Fx').params.chat_id, 'chat/x');
  assert.throws(() => matchRoute(routes, 'GET', '/api/chats/%E0%A4%A'), (err) => err instanceof URIError);

  // 可达性：每个表项的探针路径（`:name` → 哨兵值）必须命中它自己，被更靠前的表项吞掉即点名
  const findings = [];
  routes.forEach((route, i) => {
    const probe = route.path.replace(/:[^/]+/g, 'sentinel');
    const hit = matchRoute(routes, route.method, probe);
    if (!hit || hit.route !== route) {
      const by = hit ? `[${hit.route.method} ${hit.route.path}]` : '未命中（404）';
      findings.push(`表项 ${i + 1} [${route.method} ${route.path}] 被 ${by} 吞掉（探针 ${probe}）`);
    }
  });
  assert.deepEqual(findings, [], findings.join('\n'));
});

// ────────────────────────── L2 探针：既有 10 条 API 的行为等价（C-5 七条 + Q-1~Q-8） ──────────────────────────

test('L2 探针：既有 API 行为等价（怪癖 Q-1~Q-5b / 无 405 / 单 try-catch / readBody 顺序 / 空值语义 / SSE 独占 res）', async (t) => {
  const web = await setupWeb(t);

  // ② 路径匹配优先级 + 今日怪癖（改造前实测固化）
  for (const [method, p, expected] of [
    ['GET', '/api/chats/archive', { error: 'chat 不存在: archive', code: 'NOT_FOUND' }],
    ['GET', '/api/chats/', { error: 'chat 不存在: ', code: 'NOT_FOUND' }],
    ['GET', '/api/chats/a/b', { error: 'chat 不存在: a/b', code: 'NOT_FOUND' }],
    ['POST', '/api/chats/a/b/close', { error: 'chat 不存在: a/b', code: 'NOT_FOUND' }],
    ['POST', '/api/chats/archive/rename', { error: 'chat 不存在: archive', code: 'NOT_FOUND' }],
    ['GET', '/api/agents/', { error: 'not found: GET /api/agents/', code: 'NOT_FOUND' }],
  ]) {
    const r = await jreq(web.base, method, p);
    assert.deepEqual({ status: r.status, body: r.body }, { status: 404, body: expected }, `${method} ${p}`);
  }

  // ① 不引入 405：已知路径用错动词 → 走既有 404 兜底（文案逐字不变）
  for (const [method, p] of [['PUT', '/api/agents'], ['DELETE', '/api/chats/archive']]) {
    const r = await jreq(web.base, method, p);
    assert.deepEqual({ status: r.status, body: r.body }, { status: 404, body: { error: `not found: ${method} ${p}`, code: 'NOT_FOUND' } });
  }

  // ⑤ 单 try/catch 覆盖面：匹配期的 decodeURIComponent 抛错同样落 502（不是 400/404）
  const malformedPath = await jreq(web.base, 'GET', '/api/chats/%E0%A4%A');
  assert.deepEqual(
    { status: malformedPath.status, body: malformedPath.body },
    { status: 502, body: { error: 'router 不可达或请求失败: URI malformed', code: 'UPSTREAM_UNAVAILABLE' } },
  );

  // ②（续）后缀与前缀尾斜杠重叠：`POST /api/chats/<后缀>` 命中后缀路由（参数 = 空串）而不是落 404 兜底；
  // 且 rename 的"读体（400）→ 预检（404）"顺序对重叠形态同样成立
  for (const [method, p, expected] of [
    ['POST', '/api/chats/close', { error: 'chat 不存在: ', code: 'NOT_FOUND' }],
    ['POST', '/api/chats/activate', { error: 'chat 不存在: ', code: 'NOT_FOUND' }],
    ['POST', '/api/chats/rename', { error: 'chat 不存在: ', code: 'NOT_FOUND' }],
  ]) {
    const r = await jreq(web.base, method, p);
    assert.deepEqual({ status: r.status, body: r.body }, { status: 404, body: expected }, `${method} ${p}`);
  }
  const renameOverlapMalformed = await jreq(web.base, 'POST', '/api/chats/rename', rawJson('{bad'));
  assert.deepEqual({ status: renameOverlapMalformed.status, code: renameOverlapMalformed.body.code }, { status: 400, code: 'INVALID_PARAM' });

  // ⑥ 既有参数空值语义原样保留（Q-6）：空值一律等价于"不传"（200），无任何"空值 → 400"路径
  for (const p of ['/api/agents?state=', '/api/chats?state=', '/api/chats?archived=', '/api/chats?limit=']) {
    const r = await jreq(web.base, 'GET', p);
    assert.equal(r.status, 200, `${p} 应 200（空值 = 无参），实得 ${r.status} ${r.text}`);
  }

  // Q-7 真正产生 400 的输入 / Q-8 缺参订阅
  for (const p of ['/api/chats?limit=0', '/api/chats?archived=2', '/api/chats?state=bogus']) {
    const r = await jreq(web.base, 'GET', p);
    assert.deepEqual({ status: r.status, code: r.body && r.body.code }, { status: 400, code: 'INVALID_PARAM' }, p);
  }
  const streamMissing = await jreq(web.base, 'GET', '/api/stream');
  assert.deepEqual(
    { status: streamMissing.status, body: streamMissing.body },
    { status: 400, body: { error: '需要 chat_id（不做全局订阅）', code: 'INVALID_PARAM' } },
  );

  // ③ readBody 留在 handler 体内：改名路由"读体（400/413）→ 404"顺序不变
  const renameMalformed = await jreq(web.base, 'POST', '/api/chats/chat-nope/rename', rawJson('{bad'));
  assert.deepEqual({ status: renameMalformed.status, code: renameMalformed.body.code }, { status: 400, code: 'INVALID_PARAM' });
  const renameOversize = await jreq(web.base, 'POST', '/api/chats/chat-nope/rename', json({ title: 'x'.repeat(70 * 1024) }));
  assert.deepEqual(
    { status: renameOversize.status, conn: renameOversize.conn, code: renameOversize.body.code },
    { status: 413, conn: 'close', code: 'PAYLOAD_TOO_LARGE' },
  );
  const messageMalformed = await jreq(web.base, 'POST', '/api/messages', rawJson('{bad'));
  assert.deepEqual({ status: messageMalformed.status, code: messageMalformed.body.code }, { status: 400, code: 'INVALID_PARAM' });

  // ④ SSE 路由独占 res：/api/events 首帧是 SSE（不是 JSON 兜底/包装）
  const eventsHead = await readSseHead(web.base, '/api/events');
  assert.deepEqual(
    { status: eventsHead.status, ct: eventsHead.ct, head: eventsHead.head },
    { status: 200, ct: 'text/event-stream; charset=utf-8', head: 'retry: 1000\n\n' },
  );

  // ④（续）真实事件不被包装：离线 agent 的派发失败路径仍会先发 message(in) + chat_state(working) 帧
  const sse = await openSse(web.base, 'chat-api-routes-probe');
  try {
    const sent = await jreq(web.base, 'POST', '/api/messages', json({ chat_id: 'chat-api-routes-probe', agent_id: 'ghost-1', text: 'hi' }));
    assert.equal(sent.status, 200, `离线 agent 派发失败仍是 200 + warning：${sent.text}`);
    assert.equal(typeof sent.body.warning, 'string');
    await waitFor(() => sse.events.some((e) => e.type === 'chat_state'), { timeoutMs: 5000, what: 'SSE chat_state 帧' });
    const state = sse.events.find((e) => e.type === 'chat_state');
    const message = sse.events.find((e) => e.type === 'message');
    assert.deepEqual(state.data, { chat_id: 'chat-api-routes-probe', state: 'working' });
    assert.ok(message && message.data.chat_id === 'chat-api-routes-probe' && message.data.message.direction === 'in', `SSE message 帧应携带原样 payload：${JSON.stringify(sse.events)}`);
    assert.equal(sse.res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  } finally {
    sse.close();
  }
});

// ────────────────────────── 派生面 HTTP：GET /api/docs + GET /llms.txt ──────────────────────────

test('派生面 HTTP：/api/docs 的 11 条投影（danger 派生 / docLink）与 /llms.txt（200 + text/plain + 与快照逐字节相等）', async (t) => {
  const web = await setupWeb(t);

  const docs = await jreq(web.base, 'GET', '/api/docs');
  assert.equal(docs.status, 200);
  assert.equal(docs.ct, 'application/json; charset=utf-8');
  assert.ok(Array.isArray(docs.body.routes), `响应应为 { routes: [...] }：${docs.text}`);
  assert.deepEqual(docs.body.routes.map((r) => `${r.method} ${r.path}`), EXPECTED_SIGNATURES);
  for (const route of docs.body.routes) {
    assert.equal(route.danger, route.method !== 'GET', `danger 应由 method 派生：${route.path}`);
    assert.ok(typeof route.docLink === 'string' && route.docLink.startsWith('API.md#'), `docLink 应指向 API.md 章节：${route.path}`);
    assert.equal('handler' in route, false, `投影不含 handler：${route.path}`);
  }
  assert.equal(docs.body.routes.filter((r) => r.danger).length, 5, '写接口（POST）= 5 条');

  const llms = await jreq(web.base, 'GET', '/llms.txt');
  assert.equal(llms.status, 200);
  assert.equal(llms.ct, 'text/plain; charset=utf-8');
  assert.ok(
    Buffer.compare(Buffer.from(llms.text, 'utf8'), fs.readFileSync(LLMS_SNAPSHOT)) === 0,
    'HTTP 响应应与仓库快照 llms.txt（包根）逐字节相等（单产物结构）',
  );
  assert.match(llms.text, /^# oamp /m);
  assert.match(llms.text, /^## 接口（11 条）$/m);
  for (const sig of EXPECTED_SIGNATURES) {
    assert.ok(llms.text.includes(`- ${sig} — `), `索引应含一行摘要：${sig}`);
  }
  assert.match(llms.text, /http:\/\/127\.0\.0\.1:7788\/docs/);
  assert.match(llms.text, /API\.md（仓库内：API\.md）/);
  assert.match(llms.text, /README\.md（仓库内：README\.md）/);
  assert.doesNotMatch(llms.text, /src\/|UDS|SQLite|node:/, '索引只覆盖 HTTP 接口面（不含仓库结构 / 内部协议）');
});

// ────────────────────────── API.md 同步（PR-1 交付的三处） ──────────────────────────

test('API.md 同步：顶部引用块指向 /docs + §3 标题 11 条 + 3.11 小节与登记行', () => {
  const text = fs.readFileSync(API_MD, 'utf8');
  const head = text.split('\n').slice(0, 16).join('\n');
  assert.match(head, /^> 在线接口文档页：<http:\/\/127\.0\.0\.1:7788\/docs>/m, '顶部引用块应指向 /docs（F08 验收 3）');
  assert.match(text, /^## 3\. 接口清单（11 条）$/m);
  assert.match(text, /^### 3\.11 `GET \/api\/docs`$/m);
  assert.match(text, /^\| 11 \| `GET \/api\/docs` \|/m);
});
