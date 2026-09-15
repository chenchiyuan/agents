// test/sdk-cli-contract.test.js — pr-009：统一调用契约的**进程面**用例（F04 / F05 / F06 / F07 / F08 / F09 / F10 / G01 / G02）
// 判据面（architecture §10 T4）：退出码四类（`0`/`1`/`2`/`3`）+ 用法错误样本集（零连接零副作用）+ 默认 JSON / `--human`
//   两态 + stdout / stderr 分离 + `--wait` 超时（`WAIT_TIMEOUT`）与其上限支配响应头预算 + P-1 口径的 background 取回
//   + 订阅管道截断（`| head -1`）+ 层 C 逐字节透传 + 跨进程无状态。
// 三宿主（F05-1 / F07-1 / E4）：①shell 与 ③"另一 agent 经 shell 调用"同形（同一 `bin/hub.js` 入口，见全部用例）；
//   ②Node import 面 = T1 的 `createHub()` 对照组的对照侧（库面读**调用方进程 env** ⇒ 该组在组内设、用后还原 —— A18）。
// 载体：一切 hub 调用经 pr-004 的 `runHub()` 起 `bin/hub.js` 子进程（例外 = T6 的 shell 管道（理由见该用例）+ T1 的 `createHub()` 库面对照组）；
//   容器 = harness 的 `startRouter` + 本地 `startWeb`（临时 `OAMP_DB` / 临时 socket / 运行时探测的空闲端口）。
// 临时态：一律 `fs.mkdtempSync(os.tmpdir())` 下的绝对路径 —— 零仓库写（T8 以 `oamp/` 路径集合快照闭合）。
// 端口：本 PR 独占 `53000-53999`（与其余三个测试 PR 的段零交集）；取值一律 `pickFreePort()` 运行时探测空闲。
// 零第三方依赖 / 零新框架：`node:test` + `node:assert/strict` + `node:` 内置 + 既有三个 helper（只 import 不改）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHub } from './helpers/hub-harness.js';
import { startRouter, buildEnv, waitFor, stopAll, SHORT_ENV, startAgent, queryStatus } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(THIS_FILE), '..'); // 包根 = oamp/
const HUB_BIN = path.join(ROOT, 'bin', 'hub.js');
const OAMP_BIN = path.join(ROOT, 'bin', 'oamp.js');

/** 本 PR 独占端口段（主 agent 冻结：四个测试 PR 各自独占一段，互不重叠）。 */
const PORT_SEGMENT = [53000, 53999];
/** 其余三个测试 PR 的段（仅用于「零交集」的机械断言 —— 段端点比较，不是端口取值）。 */
const OTHER_SEGMENTS = [
  [51000, 51999], // pr-007
  [52000, 52999], // pr-008
  [54000, 54999], // pr-010
];
/** 长租约（与 web.test.js / api-routes.test.js 同口径）：web 是常驻发送方，SHORT_ENV 的 300ms 租约会把它判 offline。 */
const LEASE_ENV = { ...SHORT_ENV, OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };
/** 拓扑轮询周期（T6 需要 ≥2 次拓扑事件）：短周期 ⇒ 事件在用例时限内到达。 */
const TOPOLOGY_POLL_MS = '100';

// ────────────────────────────── 端口（运行时探测空闲，段内取值） ──────────────────────────────

/** 单次探测：段内候选端口能否 bind（成功即空闲）。 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

/** 段内取一个**运行时探测的空闲端口**（EADDRINUSE ⇒ 换候选重试；全失败 ⇒ 点名段与尝试次数）。 */
async function pickFreePort() {
  const [lo, hi] = PORT_SEGMENT;
  const attempts = 40;
  for (let i = 0; i < attempts; i += 1) {
    const port = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (await isPortFree(port)) return port;
  }
  assert.fail(`端口段 ${lo}-${hi} 内 ${attempts} 次探测均未取到空闲端口`);
}

/** 绝对临时路径下的不存在 socket（不可达态样本的构造面）。 */
function ghostSocketPath(tag) {
  return path.join(os.tmpdir(), `oamp-sdk-cli-contract-ghost-${tag}-${process.pid}-${Date.now()}.sock`);
}

/** 拓扑快照的可比投影：注册集合 + 状态（`last_heartbeat` / `session_id` 随心跳天然变化，不参与"零变化"判定）。 */
function topologyShape(status) {
  return status.nodes
    .map((node) => ({ instance_id: node.instance_id, state: node.state }))
    .sort((a, b) => (a.instance_id < b.instance_id ? -1 : a.instance_id > b.instance_id ? 1 : 0));
}

// ────────────────────────────── 断言消息体例（失败可定位） ──────────────────────────────

/** 逐字节差异：首个差异 **字节** 偏移 + 两侧该处上下文（沿用 api-routes.test.js 的 describeSnapshotDiff 手法）。 */
function describeByteDiff(label, expected, actual) {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  const n = Math.min(a.length, b.length);
  let offset = 0;
  while (offset < n && a[offset] === b[offset]) offset += 1;
  const ctx = (buf) => JSON.stringify(buf.subarray(Math.max(0, offset - 24), offset + 24).toString('utf8'));
  return [
    `${label}：逐字节不一致（首处差异 byte ${offset}）`,
    `  期望（${a.length} 字节）: ${ctx(a)}`,
    `  实际（${b.length} 字节）: ${ctx(b)}`,
  ].join('\n');
}

function assertSameBytes(label, expected, actual) {
  assert.equal(
    Buffer.compare(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8')),
    0,
    describeByteDiff(label, expected, actual),
  );
}

/** stderr 单行 JSON 的解析与形状断言（`{code, error, exit_code}`，层 A 另带 `http_status`；无 `stack`）。 */
function parseErrorLine(label, stderr, expectedKeys) {
  assert.equal(stderr.split('\n').filter((line) => line !== '').length, 1, `${label}：stderr 必须恰一行，实际 ${JSON.stringify(stderr)}`);
  assert.ok(!stderr.includes('\n    at '), `${label}：stderr 不得含堆栈，实际 ${JSON.stringify(stderr)}`);
  assert.ok(!stderr.startsWith('Error:'), `${label}：stderr 不得以 "Error:" 开头，实际 ${JSON.stringify(stderr)}`);
  let parsed;
  try {
    parsed = JSON.parse(stderr);
  } catch (err) {
    assert.fail(`${label}：stderr 不是单行 JSON（${err.message}）：${JSON.stringify(stderr)}`);
  }
  assert.deepEqual(Object.keys(parsed).sort(), [...expectedKeys].sort(), `${label}：错误对象键集合不符，实际 ${JSON.stringify(parsed)}`);
  assert.equal(typeof parsed.error, 'string', `${label}：error 需为非空字符串`);
  assert.ok(parsed.error.length > 0, `${label}：error 不得为空`);
  return parsed;
}

// ────────────────────────────── 设备面原语（Router / web / 本地桩服务） ──────────────────────────────

/** 起 `oamp web start --port <p>` 子进程并等 `WEB_READY`（逐字沿用 web.test.js / api-routes.test.js 的既有体例）。 */
async function startWeb(socketPath, port, envExtra = {}) {
  const child = spawn(process.execPath, [OAMP_BIN, 'web', 'start', '--port', String(port)], {
    cwd: ROOT,
    env: buildEnv(socketPath, { ...LEASE_ENV, ...envExtra }),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // 自成进程组：异常路径也能整组收口，不留持有端口的孤儿
  });
  let out = '';
  let err = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  let exit = null;
  child.once('exit', (code, signal) => {
    exit = { code, signal };
  });
  const killGroup = () => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* 进程组已不存在 */
    }
  };
  await waitFor(() => out.includes('WEB_READY') || exit, { timeoutMs: 5000, what: `web WEB_READY（port ${port}）` });
  if (exit) {
    killGroup();
    throw new Error(`web 提前退出: ${JSON.stringify(exit)} stderr=${err}`);
  }
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      try {
        await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web SIGINT 后退出' });
      } catch {
        killGroup();
      }
    },
  };
}

/** 起真实 Router + web（临时 `OAMP_DB`、段内空闲端口），并建一个项目（`chats list` 的 `--project-id` 必填）。 */
async function setupHub(t, envExtra = {}) {
  // 收口顺序按 C4：web.stop → stopAll(router) → 删临时目录（单钩子内按序执行，与创建顺序无关）
  const owned = { web: null, router: null, dbDir: null };
  t.after(async () => {
    if (owned.web) await owned.web.stop();
    if (owned.router) await stopAll([owned.router]);
    if (owned.dbDir) {
      try {
        fs.rmSync(owned.dbDir, { recursive: true, force: true });
      } catch {
        /* 忽略 */
      }
    }
  });
  owned.router = await startRouter({ envExtra: LEASE_ENV });
  owned.dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-cli-contract-db-'));
  const router = owned.router;
  const dbPath = path.join(owned.dbDir, 'sql.db');
  const web = await startWeb(router.socketPath, await pickFreePort(), {
    OAMP_DB: dbPath,
    OAMP_WEB_TOPOLOGY_POLL_MS: TOPOLOGY_POLL_MS,
    ...envExtra,
  });
  owned.web = web;
  const created = await httpJson(web.base, 'POST', '/api/projects', { repo_url: 'https://example.com/oamp-sdk-cli-contract.git' });
  assert.equal(created.status, 200, `建项目失败: ${created.text}`);
  return {
    socketPath: router.socketPath,
    dbPath,
    port: web.port,
    base: web.base,
    projectId: created.body.project.project_id,
    web,
    router,
  };
}

/** 极简 JSON 请求（node:http，零依赖）：用于建项目等设备面准备动作。 */
function httpJson(base, method, p, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, base);
    const body = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request(
      {
        host: url.hostname,
        port: Number(url.port),
        method,
        path: `${url.pathname}${url.search}`,
        headers: body === null ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* 非 JSON：body 保持 null */
          }
          resolve({ status: res.statusCode, body: parsed, text });
        });
      },
    );
    req.on('error', reject);
    req.end(body === null ? undefined : body);
  });
}

/** 计数服务器（T2 的「零连接零副作用」观测面）：记录 connections / requests；若被连则计数并回 `200 {}`。 */
async function startCountingServer(t) {
  const state = { connections: 0, requests: 0 };
  const server = http.createServer((req, res) => {
    state.requests += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  server.on('connection', () => {
    state.connections += 1;
  });
  const port = await pickFreePort();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { port, counts: () => ({ ...state }) };
}

/** 黑障 / 延迟 / 指定状态码的本地 HTTP 桩（T4 的驱动面：零真实 hub、零真实 omp）。 */
async function startStubServer(t, { delayMs = null, status = 200, body = {} } = {}) {
  const state = { connections: 0, requests: 0 };
  const server = http.createServer((req, res) => {
    state.requests += 1;
    req.resume(); // 读完请求体（不读会让 keep-alive 面挂住），但**永不**自行结束
    if (delayMs === null) return; // 黑障：永不写响应头
    setTimeout(() => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    }, delayMs);
  });
  server.on('connection', () => {
    state.connections += 1;
  });
  const port = await pickFreePort();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { port, counts: () => ({ ...state }) };
}

/** 直跑既有 CLI（T7 的对照侧）：cwd / env / stdio / 进程组口径与 `runHub` 逐字对齐（可逐字节比较）。 */
function runOampDirect(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [OAMP_BIN, ...args], {
      cwd: os.tmpdir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    const killGroup = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* 进程组已不存在 */
      }
    };
    child.once('close', (code) => {
      killGroup();
      resolve({ code, stdout, stderr });
    });
  });
}

/** 跑一次 hub 并把 stdout 解析为对象（成功样本的薄封装：`code === 0` + `stderr === ''` + 可解析 JSON）。 */
async function runHubJson(args, opts = {}) {
  const r = await runHub(args, opts);
  const shown = `命令 = hub ${args.join(' ')}`;
  assert.equal(r.code, 0, `${shown}：期望退出码 0，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
  assert.equal(r.stderr, '', `${shown}：成功样本的 stderr 必须为空，实际 ${JSON.stringify(r.stderr)}`);
  let body;
  try {
    body = JSON.parse(r.stdout);
  } catch (err) {
    assert.fail(`${shown}：stdout 不是单个可解析 JSON 文档（${err.message}）：${JSON.stringify(r.stdout)}`);
  }
  return { ...r, body };
}

/** 有界等待一次 hub 调用完成并返回结果（不裸 sleep）。 */
async function hubCall(args, opts) {
  const started = Date.now();
  const r = await runHub(args, opts);
  return { ...r, elapsedMs: Date.now() - started };
}
/**
 * 库面调用的统一形态（`bin/hub.js` 进程面的对位：CLI 面 = 进程退出码，库面 = `HubError.exitCode` —— errors.js 的双面落点）。
 * 成功 ⇒ `{ exitCode: 0, body }`；失败 ⇒ `{ exitCode, errorCode, httpStatus, errorText }`。
 */
async function callLibrary(label, fn) {
  try {
    return { exitCode: 0, body: await fn() };
  } catch (err) {
    assert.ok(
      typeof err.exitCode === 'number',
      `${label}：库面失败应抛带归类结果的 HubError（exitCode），实际 ${err && err.message}`,
    );
    return { exitCode: err.exitCode, errorCode: err.code, httpStatus: err.httpStatus, errorText: err.message };
  }
}

// ────────────────────────────── T1 · 基础设施 ──────────────────────────────

test('T1 · 端口段：本 PR 段与其余三段零交集，取值恒为段内运行时探测的空闲端口', async () => {
  const [lo, hi] = PORT_SEGMENT;
  for (const [a, b] of OTHER_SEGMENTS) {
    assert.ok(hi < a || lo > b, `端口段重叠：本 PR ${lo}-${hi} vs 其它 PR ${a}-${b}`);
  }
  const picked = [];
  for (let i = 0; i < 3; i += 1) picked.push(await pickFreePort());
  for (const port of picked) {
    assert.ok(port >= lo && port <= hi, `端口 ${port} 越出本 PR 段 ${lo}-${hi}`);
  }
  assert.ok(picked.every(Number.isInteger), `端口必须是整数：${JSON.stringify(picked)}`);
});

// ────────────────────────────── T1 · 退出码四类矩阵 ──────────────────────────────

test('T1 · 退出码四类矩阵：0/1/2/3 各一例、固定落码且仅凭退出码即可区分', async (t) => {
  const hub = await setupHub(t);
  const releasedPort = await pickFreePort(); // 已释放（无监听）⇒ 连接失败样本的构造面
  const ghostSocket = ghostSocketPath('matrix');

  const rows = [
    {
      label: '类 0 · 成功（api docs）',
      expectClass: 0,
      args: ['api', 'docs', '--port', String(hub.port)],
      env: {},
      stderrKeys: [],
    },
    {
      label: '类 1 · 上游业务失败（api chats get 不存在）',
      expectClass: 1,
      args: ['api', 'chats', 'get', 'chat-does-not-exist', '--port', String(hub.port)],
      env: {},
      stderrKeys: ['code', 'error', 'exit_code', 'http_status'],
      expectCode: 'NOT_FOUND',
      expectHttpStatus: 404,
    },
    {
      label: '类 2 · 本地用法错误（api nope）',
      expectClass: 2,
      args: ['api', 'nope'],
      env: { OAMP_WEB_PORT: String(releasedPort) },
      stderrKeys: ['code', 'error', 'exit_code'],
      expectCode: 'USAGE',
    },
    {
      label: '类 3 · 连接失败（Web 面：已释放端口）',
      expectClass: 3,
      args: ['api', 'agents', '--port', String(releasedPort)],
      env: {},
      stderrKeys: ['code', 'error', 'exit_code'],
      expectCode: 'HUB_UNREACHABLE',
      maxElapsedMs: 3000,
      target: `127.0.0.1:${releasedPort}`,
    },
    {
      label: '类 3 · 连接失败（UDS 面：不存在的 socket）',
      expectClass: 3,
      args: ['uds', 'router.status'],
      env: { OAMP_SOCKET: ghostSocket },
      stderrKeys: ['code', 'error', 'exit_code'],
      expectCode: 'HUB_UNREACHABLE',
      maxElapsedMs: 3000,
      target: ghostSocket,
    },
  ];

  const codes = new Set();
  for (const row of rows) {
    // 同一样本连跑两次：落码必须固定（"每类固定落同一码"）
    const first = await hubCall(row.args, { env: row.env });
    const second = await hubCall(row.args, { env: row.env });
    assert.equal(
      second.code,
      first.code,
      `${row.label}：同一样本两次落码不同（${first.code} vs ${second.code}）`,
    );
    for (const [tag, r] of [['第一次', first], ['第二次', second]]) {
      assert.equal(r.code, row.expectClass, `${row.label}（${tag}）：期望退出码 ${row.expectClass}，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
      if (row.maxElapsedMs !== undefined) {
        assert.ok(r.elapsedMs <= row.maxElapsedMs, `${row.label}（${tag}）：耗时 ${r.elapsedMs}ms 超过 ${row.maxElapsedMs}ms（不可达态不得挂起）`);
      }
    }
    const r = second;
    codes.add(r.code);

    if (row.expectClass === 0) {
      let parsed;
      try {
        parsed = JSON.parse(r.stdout);
      } catch (err) {
        assert.fail(`${row.label}：stdout 不是 JSON（${err.message}）：${JSON.stringify(r.stdout)}`);
      }
      assert.deepEqual(Object.keys(parsed), ['routes'], `${row.label}：顶层键应为 {routes}，实际 ${JSON.stringify(Object.keys(parsed))}`);
      assert.equal(r.stderr, '', `${row.label}：成功样本 stderr 必须为空，实际 ${JSON.stringify(r.stderr)}`);
      continue;
    }

    assert.equal(r.stdout, '', `${row.label}：失败样本 stdout 必须为空，实际 ${JSON.stringify(r.stdout)}`);
    const error = parseErrorLine(row.label, r.stderr, row.stderrKeys);
    assert.equal(error.exit_code, row.expectClass, `${row.label}：错误对象 exit_code 与进程退出码不一致`);
    if (row.expectCode !== undefined) {
      assert.equal(error.code, row.expectCode, `${row.label}：期望 code=${row.expectCode}，实际 ${error.code}`);
    }
    if (row.expectHttpStatus !== undefined) {
      assert.equal(error.http_status, row.expectHttpStatus, `${row.label}：期望 http_status=${row.expectHttpStatus}，实际 ${error.http_status}`);
    } else {
      assert.equal(error.http_status, undefined, `${row.label}：非层 A 错误不得带 http_status，实际 ${JSON.stringify(error)}`);
    }
    if (row.target !== undefined) {
      assert.ok(error.error.includes(row.target), `${row.label}：error 应含目标地址 ${row.target}，实际 ${JSON.stringify(error.error)}`);
    }
  }

  // 仅凭退出码即可区分四类：四值齐全（丢弃 stdout / stderr 后仍是这四个数）
  assert.deepEqual([...codes].sort(), [0, 1, 2, 3], `退出码集合应为 {0,1,2,3}，实际 ${JSON.stringify([...codes])}`);

  // 「不存在一码两义」：上一循环的逐行 `r.code === row.expectClass` 已把"每个样本只落它那一类的码"钉死（`1` 只由业务失败样本命中、
  // `2` 只由本地解析命中、`3` 只由连接失败命中），上面那条四值齐全的断言据此闭合"仅凭退出码即可区分四类"。
  // 原先此处另有一段 `classOf[x].includes(x)` 的核对循环 —— 它是恒真断言（零判别力），已删除而非保留。
});

test('T1 · 不可达态的形状与恢复：单行 JSON / 无堆栈 / 恢复后无需额外动作', async (t) => {
  const hub = await setupHub(t);
  const releasedPort = await pickFreePort();
  const ghostSocket = ghostSocketPath('recovery');

  const samples = [
    { label: 'Web 面', args: ['api', 'agents', '--port', String(releasedPort)], env: {}, target: `127.0.0.1:${releasedPort}` },
    { label: 'UDS 面', args: ['uds', 'router.status'], env: { OAMP_SOCKET: ghostSocket }, target: ghostSocket },
  ];
  for (const sample of samples) {
    const r = await hubCall(sample.args, { env: sample.env });
    assert.equal(r.code, 3, `${sample.label}：期望退出码 3，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
    assert.equal(r.stdout, '', `${sample.label}：stdout 必须为空`);
    const error = parseErrorLine(sample.label, r.stderr, ['code', 'error', 'exit_code']);
    assert.equal(error.code, 'HUB_UNREACHABLE', `${sample.label}：期望 HUB_UNREACHABLE，实际 ${error.code}`);
    assert.ok(error.error.includes(sample.target), `${sample.label}：error 应含目标地址，实际 ${JSON.stringify(error.error)}`);
  }

  // 恢复后无需额外动作：同一命令（Web 面）在 hub 起来后重跑即得 0
  const recovered = await runHubJson(['api', 'agents', '--port', String(hub.port)]);
  assert.equal(recovered.code, 0, 'Router + web 已运行：同一命令应直接恢复为 0');
  assert.ok(Array.isArray(recovered.body.agents), `恢复后 stdout 应为 {agents: [...]}，实际 ${JSON.stringify(recovered.body)}`);
});

// 三宿主②（Node import 面）：同一命令在 `bin/hub.js` 进程面与 `createHub()` 库面各跑一次，比对退出码与 JSON 结构。
// 库面读**调用方进程 env**（`createHub()` 没有 env 选项 ⇒ A18 约束）：本组在组内设、用后逐键还原。
test('T1 · 三宿主②Node import 面：createHub() 库面与进程面对同一命令的退出码与 JSON 结构一致', async (t) => {
  const hub = await setupHub(t);
  const releasedPort = await pickFreePort();

  const savedEnv = { OAMP_SOCKET: process.env.OAMP_SOCKET, OAMP_WEB_PORT: process.env.OAMP_WEB_PORT };
  process.env.OAMP_SOCKET = hub.socketPath;
  process.env.OAMP_WEB_PORT = String(hub.port); // 两面同环境：进程面同样经该 env 取值（跨宿主一致的观测条件）
  t.after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const { createHub } = await import('../sdk/index.js');

  // ① 成功面：`api docs` ⇒ 两面退出码 0，且 JSON 结构深等（同一份 ENTRIES 表的同一份投影）
  const cliOk = await runHubJson(['api', 'docs'], {});
  const libOk = await callLibrary('库面 api.docs()', () => createHub().api.docs());
  assert.equal(libOk.exitCode, cliOk.code, `api docs：库面退出码 ${libOk.exitCode} 与进程面 ${cliOk.code} 不一致`);
  assert.deepEqual(
    libOk.body,
    cliOk.body,
    `api docs：两面 JSON 结构应一致（库面 ${JSON.stringify(libOk.body).slice(0, 160)} vs 进程 ${cliOk.stdout.slice(0, 160)}）`,
  );
  t.diagnostic(
    `① api docs ｜ 进程面（bin/hub.js）code=${cliOk.code}、顶层键=[${Object.keys(cliOk.body)}]、routes=${cliOk.body.routes.length} ｜ ` +
      `库面（createHub）exitCode=${libOk.exitCode}、顶层键=[${Object.keys(libOk.body)}]、routes=${libOk.body.routes.length} ｜ deepEqual 通过（字节数 ${Buffer.byteLength(libOk.body === null ? '' : JSON.stringify(libOk.body))}）`,
  );

  // ② 上游业务失败面：`api chats get` 不存在 ⇒ 同退出码 / 同 code / 同 http_status / 同 error 文案
  const cliMissing = await runHub(['api', 'chats', 'get', 'chat-does-not-exist'], {});
  const libMissing = await callLibrary('库面 api.chats.get()', () => createHub().api.chats.get('chat-does-not-exist'));
  const cliMissingError = parseErrorLine('api chats get（进程面）', cliMissing.stderr, ['code', 'error', 'exit_code', 'http_status']);
  assert.equal(cliMissing.code, 1, `api chats get（进程面）：期望退出码 1，实际 ${cliMissing.code}`);
  assert.equal(libMissing.exitCode, cliMissing.code, `api chats get：库面退出码 ${libMissing.exitCode} 与进程面 ${cliMissing.code} 不一致`);
  assert.equal(libMissing.errorCode, cliMissingError.code, `api chats get：code 不一致（库面 ${libMissing.errorCode} vs 进程 ${cliMissingError.code}）`);
  assert.equal(libMissing.httpStatus, cliMissingError.http_status, `api chats get：http_status 不一致（库面 ${libMissing.httpStatus} vs 进程 ${cliMissingError.http_status}）`);
  assert.equal(
    libMissing.errorText,
    cliMissingError.error,
    `api chats get：error 文案不一致（库面 ${JSON.stringify(libMissing.errorText)} vs 进程 ${JSON.stringify(cliMissingError.error)}）`,
  );
  t.diagnostic(
    `② api chats get（不存在）｜ 进程面 code=${cliMissing.code}、code字段=${cliMissingError.code}、http_status=${cliMissingError.http_status} ｜ ` +
      `库面 exitCode=${libMissing.exitCode}、code字段=${libMissing.errorCode}、http_status=${libMissing.httpStatus} ｜ error=「${cliMissingError.error}」两侧逐字相同`,
  );

  // ③ 连接失败面：`api agents` 指向已释放端口 ⇒ 同退出码 / 同 code / 同 error 文案
  const cliDown = await runHub(['api', 'agents', '--port', String(releasedPort)], {});
  const libDown = await callLibrary('库面 api.agents()', () => createHub({ port: releasedPort }).api.agents());
  const cliDownError = parseErrorLine('api agents（进程面）', cliDown.stderr, ['code', 'error', 'exit_code']);
  assert.equal(cliDown.code, 3, `api agents（进程面）：期望退出码 3，实际 ${cliDown.code}`);
  assert.equal(libDown.exitCode, cliDown.code, `api agents：库面退出码 ${libDown.exitCode} 与进程面 ${cliDown.code} 不一致`);
  assert.equal(libDown.errorCode, cliDownError.code, `api agents：code 不一致（库面 ${libDown.errorCode} vs 进程 ${cliDownError.code}）`);
  assert.equal(
    libDown.errorText,
    cliDownError.error,
    `api agents：error 文案不一致（库面 ${JSON.stringify(libDown.errorText)} vs 进程 ${JSON.stringify(cliDownError.error)}）`,
  );
  t.diagnostic(
    `③ api agents（已释放端口 ${releasedPort}）｜ 进程面 code=${cliDown.code}、code字段=${cliDownError.code} ｜ ` +
      `库面 exitCode=${libDown.exitCode}、code字段=${libDown.errorCode} ｜ error=「${cliDownError.error}」两侧逐字相同`,
  );

  // ④ 层 C 的库面（`hub.cli.run`，capture 形态）：同命令、同 stdout 逐字节、同退出码
  const cliStatus = await runHub(['cli', 'status'], {});
  const libCli = await callLibrary('库面 cli.run()', () => createHub().cli.run(['status']));
  assert.equal(cliStatus.code, 0, `hub cli status（进程面）：期望退出码 0，实际 ${cliStatus.code}（stderr=${JSON.stringify(cliStatus.stderr)}）`);
  assert.equal(libCli.body.exit_code, cliStatus.code, `层 C：库面 exit_code ${libCli.body.exit_code} 与进程面 ${cliStatus.code} 不一致`);
  assert.equal(libCli.body.stderr, '', `层 C：库面 stderr 应为空，实际 ${JSON.stringify(libCli.body.stderr)}`);
  assert.ok(libCli.body.stdout.length > 0, '层 C：库面 stdout 不得为空（防空 vs 空的虚假相等）');
  assertSameBytes('层 C：库面 stdout 与进程面', cliStatus.stdout, libCli.body.stdout);
  t.diagnostic(
    `④ hub cli status ｜ 进程面 code=${cliStatus.code}、stdout=${JSON.stringify(cliStatus.stdout)} ｜ ` +
      `库面 exit_code=${libCli.body.exit_code}、stdout=${JSON.stringify(libCli.body.stdout)} ｜ 逐字节一致`,
  );
});

// ────────────────────────────── T2 · 用法错误样本集（零连接零副作用） ──────────────────────────────

test('T2 · 用法错误样本集（九例）：均落 2、零连接零副作用、失败面 stdout/stderr 分离', async (t) => {
  const hub = await setupHub(t);
  const counting = await startCountingServer(t);
  const releasedPort = await pickFreePort();
  const ghostSocket = ghostSocketPath('usage');

  const samples = [
    { no: 1, what: '未知层', args: ['bogus'], expect: '未知层: bogus' },
    { no: 2, what: '未知子命令（层 A）', args: ['api', 'nope'], expect: '未知子命令: api nope' },
    { no: 2, what: '未知子命令（层 B）', args: ['uds', 'nope'], expect: '未知子命令: uds nope' },
    { no: 3, what: '缺必填位置参数', args: ['api', 'chats', 'get'], expect: '缺少位置参数: chat_id' },
    { no: 4, what: '位置参数多余', args: ['api', 'agents', 'extra'], expect: '位置参数多余: extra' },
    { no: 5, what: '缺必填选项', args: ['api', 'chats', 'list'], expect: '缺少必填选项: --project-id' },
    { no: 6, what: '选项缺值', args: ['api', 'messages', 'send', '--agent-id', 'a', '--text'], expect: '选项缺值: --text' },
    { no: 7, what: '取值非法（整数）', args: ['api', 'agents', '--port', 'abc'], expect: '选项取值非法: --port' },
    { no: 7, what: '取值非法（JSON）', args: ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--tasks', 'not-json'], expect: '选项取值非法: --tasks 不是合法 JSON' },
    { no: 7, what: '取值非法（JSON 对象）', args: ['uds', 'router.status', '--params', '[]'], expect: '选项取值非法: --params 需为 JSON 对象' },
    { no: 8, what: '该条目不接受选项（--wait 给非阻塞条目）', args: ['api', 'agents', '--wait', '100'], expect: '该条目不接受选项: --wait' },
    { no: 8, what: '该条目不接受选项（--as 给非身份方法）', args: ['uds', 'router.status', '--as', 'x-1'], expect: '该条目不接受选项: --as' },
    { no: 9, what: '层 C 缺命令', args: ['cli'], expect: 'hub cli 后缺少既有命令' },
  ];

  // 全部样本的落地环境：Web 面指向计数服务器、UDS 面指向不存在的 socket ⇒ 任何真实连接都会留下计数痕迹。
  const env = { OAMP_WEB_PORT: String(counting.port), OAMP_SOCKET: ghostSocket };

  for (const sample of samples) {
    const r = await hubCall(sample.args, { env });
    const where = `样本 #${sample.no}（${sample.what}）· hub ${sample.args.join(' ')}`;
    assert.equal(r.code, 2, `${where}：期望退出码 2，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
    assert.equal(r.stdout, '', `${where}：stdout 必须为空，实际 ${JSON.stringify(r.stdout)}`);
    const error = parseErrorLine(where, r.stderr, ['code', 'error', 'exit_code']);
    assert.equal(error.code, 'USAGE', `${where}：期望 code=USAGE，实际 ${error.code}`);
    assert.equal(error.exit_code, 2, `${where}：期望 exit_code=2，实际 ${error.exit_code}`);
    assert.ok(error.error.includes(sample.expect), `${where}：期望 error 含 ${JSON.stringify(sample.expect)}，实际 ${JSON.stringify(error.error)}`);
    if (sample.no === 9) {
      // 层 C 缺命令：不起子进程的可观测替代 —— 快速返回
      assert.ok(r.elapsedMs < 1000, `${where}：应快速返回（<1000ms），实际 ${r.elapsedMs}ms`);
    }
  }

  const counts = counting.counts();
  assert.deepEqual(counts, { connections: 0, requests: 0 }, `用法错误必须零连接零请求，实际 ${JSON.stringify(counts)}`);

  // 对照：同一 argv 形态去掉用法错误成分 ⇒ 3（证明 `2` 只由本地解析命中，不是"因不可达而成"）
  const unreachable = await hubCall(['api', 'docs', '--port', String(releasedPort)], { env: {} });
  assert.equal(unreachable.code, 3, `对照样本：期望退出码 3，实际 ${unreachable.code}`);
  assert.equal(unreachable.stdout, '', '对照样本：stdout 必须为空');

  // 分离写入的双向断言：成功样本 stderr === ''（另一侧见上方全部失败样本的 stdout === ''）
  const ok = await hubCall(['api', 'docs', '--port', String(hub.port)], { env: {} });
  assert.equal(ok.code, 0, `成功样本：期望退出码 0，实际 ${ok.code}`);
  assert.equal(ok.stderr, '', `成功样本：stderr 必须为空，实际 ${JSON.stringify(ok.stderr)}`);
  assert.ok(ok.stdout.length > 0, '成功样本：stdout 不得为空（防空 vs 空的虚假相等）');

  // 层 A 的业务失败样本：stdout 空 + stderr 单行 JSON（带 http_status）
  const business = await hubCall(['api', 'chats', 'get', 'ghost-chat', '--port', String(hub.port)], { env: {} });
  assert.equal(business.code, 1, `业务失败样本：期望退出码 1，实际 ${business.code}`);
  assert.equal(business.stdout, '', '业务失败样本：stdout 必须为空（不含可解析残片）');
  const businessError = parseErrorLine('业务失败样本', business.stderr, ['code', 'error', 'exit_code', 'http_status']);
  assert.equal(businessError.code, 'NOT_FOUND', `业务失败样本：期望 NOT_FOUND，实际 ${businessError.code}`);
});

// ────────────────────────────── T3 · 输出契约两态 ──────────────────────────────

test('T3 · 输出契约两态：默认 JSON 单文档 + --human 形态切换 + 事实逐项一致', async (t) => {
  const hub = await setupHub(t);
  const P = String(hub.port);

  // 1) 默认输出 = 单个可解析 JSON 文档 + 单个尾换行，只走 stdout
  const readOnly = [
    { args: ['api', 'docs', '--port', P], keys: ['routes'] },
    { args: ['api', 'agents', '--port', P], keys: ['agents'] },
    { args: ['api', 'chats', 'list', '--project-id', hub.projectId, '--port', P], keys: ['chats', 'total', 'limit', 'offset'] },
  ];
  for (const item of readOnly) {
    const r = await runHubJson(item.args, {});
    const where = `hub ${item.args.join(' ')}`;
    assert.ok(r.stdout.endsWith('\n'), `${where}：stdout 应以单个换行结尾`);
    assert.equal(r.stdout.trim().split('\n').length, 1, `${where}：stdout 应是单个 JSON 文档（无多余行），实际 ${JSON.stringify(r.stdout)}`);
    assert.deepEqual(Object.keys(r.body), item.keys, `${where}：顶层键应为 ${JSON.stringify(item.keys)}，实际 ${JSON.stringify(Object.keys(r.body))}`);
    assert.ok(!r.stdout.includes('用法:') && !r.stdout.includes('hub —'), `${where}：stdout 不得混入用法文案`);
  }

  // 2) + 3) + 4) --human：形态不同、非 JSON、行数与表头合规、事实逐项一致
  const plain = await runHubJson(['api', 'docs', '--port', P], {});
  const human = await hubCall(['api', 'docs', '--human', '--port', P], {});
  assert.equal(human.code, 0, `--human：期望退出码 0，实际 ${human.code}（stderr=${JSON.stringify(human.stderr)}）`);
  assert.equal(human.stderr, '', `--human：stderr 必须为空，实际 ${JSON.stringify(human.stderr)}`);
  assert.notEqual(human.stdout, plain.stdout, '--human 与默认输出的形态必须不同');
  assert.throws(() => JSON.parse(human.stdout), '--human 的 stdout 不应是可解析 JSON');

  const routes = plain.body.routes;
  const humanLines = human.stdout.replace(/\n$/, '').split('\n');
  assert.equal(humanLines.length, routes.length + 1, `--human（api docs）应为表头 + ${routes.length} 行，实际 ${humanLines.length} 行`);
  const header = humanLines[0];
  assert.ok(header.includes('method') && header.includes('path'), `--human 表头应含 routes 的键名（method / path），实际 ${JSON.stringify(header)}`);
  for (const route of routes) {
    assert.ok(human.stdout.includes(route.method), `--human 应含 method=${route.method}`);
    assert.ok(human.stdout.includes(route.path), `--human 应含 path=${route.path}`);
  }
  assert.equal(routes.length, plain.body.routes.length, '两态承载的事实条数必须一致');

  // 4) + 2③) 渲染分支：单一数组载荷（api docs / api agents）⇒ 表头 + N 行，不出现 `键: 值` 段
  const arrayPayloads = [
    { label: 'api docs', args: ['api', 'docs', '--human', '--port', P], rows: plain.body.routes.length },
    { label: 'api agents', args: ['api', 'agents', '--human', '--port', P], rows: (await runHubJson(['api', 'agents', '--port', P], {})).body.agents.length },
  ];
  for (const item of arrayPayloads) {
    const r = await hubCall(item.args, {});
    assert.equal(r.code, 0, `hub ${item.args.join(' ')}：期望退出码 0，实际 ${r.code}`);
    const lines = r.stdout.replace(/\n$/, '').split('\n');
    assert.equal(lines.length, item.rows + 1, `${item.label}（--human）：应为表头 + ${item.rows} 行，实际 ${lines.length} 行`);
    for (const line of lines) {
      assert.ok(!/^\S+\s*:\s/.test(line), `${item.label}（--human）：单一数组载荷分支不应出现「键: 值」段，实际行 ${JSON.stringify(line)}`);
    }
  }

  // 4) 渲染分支：含额外标量键（chats list 的分页元数据）⇒ 标量键名逐字出现
  const humanChats = await hubCall(['api', 'chats', 'list', '--human', '--project-id', hub.projectId, '--port', P], {});
  assert.equal(humanChats.code, 0, `--human（chats list）：期望退出码 0，实际 ${humanChats.code}`);
  const chatsBody = (await runHubJson(['api', 'chats', 'list', '--project-id', hub.projectId, '--port', P], {})).body;
  for (const key of ['total', 'limit', 'offset']) {
    assert.ok(humanChats.stdout.includes(key), `--human（chats list）应含标量键 ${key}`);
    assert.ok(Object.hasOwn(chatsBody, key), `默认 JSON（chats list）应含键 ${key}`);
  }
  assert.ok(/^\S+\s*:\s/m.test(humanChats.stdout), `--human（chats list）应含「键: 值」段，实际 ${JSON.stringify(humanChats.stdout)}`);
});

// ────────────────────────────── T4 · --wait 超时语义 ──────────────────────────────

test('T4 · --wait 超时：WAIT_TIMEOUT/1、上限有序、上限内成功、与其它三类可区分', async (t) => {
  const blackhole = await startStubServer(t, {}); // 永不写响应头
  const delayed = await startStubServer(t, { delayMs: 300, status: 200, body: { ok: true } });
  const notFound = await startStubServer(t, { delayMs: 0, status: 404, body: { error: 'chat 不存在: ghost', code: 'NOT_FOUND' } });
  const releasedPort = await pickFreePort();

  const callArgs = (port, waitMs, mode = 'block') => {
    const args = ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', '--mode', mode, '--port', String(port)];
    return waitMs === null ? args : [...args, '--wait', String(waitMs)];
  };

  // 2) WAIT_TIMEOUT 形态：`--wait` 到限 ⇒ 本地中止本次等待
  const timeout1 = await hubCall(callArgs(blackhole.port, 1000), {});
  assert.equal(timeout1.code, 1, `--wait 1000：期望退出码 1，实际 ${timeout1.code}（stderr=${JSON.stringify(timeout1.stderr)}）`);
  assert.equal(timeout1.stdout, '', '--wait 1000：stdout 必须为空');
  const timeoutError = parseErrorLine('--wait 1000', timeout1.stderr, ['code', 'error', 'exit_code']);
  assert.equal(timeoutError.code, 'WAIT_TIMEOUT', `--wait 1000：期望 WAIT_TIMEOUT，实际 ${timeoutError.code}`);
  assert.equal(timeoutError.exit_code, 1, '--wait 1000：期望 exit_code=1');
  assert.ok(timeoutError.error.includes('1000'), `--wait 1000：error 应含上限值，实际 ${JSON.stringify(timeoutError.error)}`);
  assert.ok(timeoutError.error.includes('调用仍在进行'), `--wait 1000：error 应含「调用仍在进行」，实际 ${JSON.stringify(timeoutError.error)}`);
  assert.ok(timeout1.elapsedMs > 1000 && timeout1.elapsedMs < 1800, `--wait 1000：耗时应落在 (1000, 1800)ms，实际 ${timeout1.elapsedMs}ms`);
  assert.equal(blackhole.counts().requests, 1, `--wait 1000：服务端应恰收到 1 次请求（本地中止、不重发、不轮询），实际 ${JSON.stringify(blackhole.counts())}`);

  // 3) 上限由调用方给出且有序：较小上限先返回
  const short = await hubCall(callArgs(blackhole.port, 600), {});
  const long = await hubCall(callArgs(blackhole.port, 1500), {});
  assert.equal(short.code, 1, `--wait 600：期望退出码 1，实际 ${short.code}`);
  assert.equal(long.code, 1, `--wait 1500：期望退出码 1，实际 ${long.code}`);
  assert.ok(short.elapsedMs > 600 && short.elapsedMs < 1400, `--wait 600：耗时应落在 (600, 1400)ms，实际 ${short.elapsedMs}ms`);
  assert.ok(long.elapsedMs > 1500 && long.elapsedMs < 2300, `--wait 1500：耗时应落在 (1500, 2300)ms，实际 ${long.elapsedMs}ms`);
  assert.ok(short.elapsedMs < long.elapsedMs, `较小上限应先返回（600ms: ${short.elapsedMs}ms vs 1500ms: ${long.elapsedMs}ms）`);

  // 4) 上限内拿到响应即返回（响应头到达即清除两道定时器）
  const within = await hubCall(callArgs(delayed.port, 8000), {});
  assert.equal(within.code, 0, `上限内成功：期望退出码 0，实际 ${within.code}（stderr=${JSON.stringify(within.stderr)}）`);
  assert.deepEqual(JSON.parse(within.stdout), { ok: true }, `上限内成功：stdout 应为服务端响应体原样，实际 ${JSON.stringify(within.stdout)}`);
  assert.ok(within.elapsedMs > 300 && within.elapsedMs < 1500, `上限内成功：耗时应落在 (300, 1500)ms，实际 ${within.elapsedMs}ms`);
  // 7) 缺省上限的界内观察：不给 `--wait` 也应在界内返回；缺省值 `1800000` ms **不可实测**（登记为不可实测项，
  //    由 `oamp/sdk/cli.js` 的常量面 + 本条界内观察共同闭合）。
  const defaultWait = await hubCall(callArgs(delayed.port, null), {});
  assert.equal(defaultWait.code, 0, `缺省上限：期望退出码 0，实际 ${defaultWait.code}`);
  assert.ok(defaultWait.elapsedMs < 2000, `缺省上限：应在 2000ms 内返回（不无限等待），实际 ${defaultWait.elapsedMs}ms`);

  // 5) 与其它三类可区分：`1` 同码不同 `code`；`3` / `2` 与两者码、`code` 皆互异
  const business = await hubCall(['api', 'docs', '--port', String(notFound.port)], {});
  assert.equal(business.code, 1, `业务失败样本：期望退出码 1，实际 ${business.code}`);
  const businessError = parseErrorLine('业务失败样本', business.stderr, ['code', 'error', 'exit_code', 'http_status']);
  assert.equal(businessError.code, 'NOT_FOUND', `业务失败样本：期望 NOT_FOUND，实际 ${businessError.code}`);
  assert.notEqual(businessError.code, timeoutError.code, 'WAIT_TIMEOUT 与上游业务失败应同码不同 code');

  const unreachable = await hubCall(['api', 'agents', '--port', String(releasedPort)], {});
  assert.equal(unreachable.code, 3, `连接失败样本：期望退出码 3，实际 ${unreachable.code}`);
  const unreachableError = parseErrorLine('连接失败样本', unreachable.stderr, ['code', 'error', 'exit_code']);
  assert.equal(unreachableError.code, 'HUB_UNREACHABLE', `连接失败样本：期望 HUB_UNREACHABLE，实际 ${unreachableError.code}`);

  const usage = await hubCall(['api', 'nope'], { env: { OAMP_WEB_PORT: String(releasedPort) } });
  assert.equal(usage.code, 2, `用法错误样本：期望退出码 2，实际 ${usage.code}`);
  const usageError = parseErrorLine('用法错误样本', usage.stderr, ['code', 'error', 'exit_code']);
  assert.equal(usageError.code, 'USAGE', `用法错误样本：期望 USAGE，实际 ${usageError.code}`);

  const codes = [timeoutError.code, businessError.code, unreachableError.code, usageError.code];
  assert.equal(new Set(codes).size, codes.length, `四类的 code 必须互异，实际 ${JSON.stringify(codes)}`);
  assert.deepEqual([timeout1.code, unreachable.code, usage.code].sort(), [1, 2, 3], '三类退出码应为 {1,2,3}');
  // 四者 error 文案互异（`等待超时（…）：调用仍在进行` ≠ `等待响应超时（5000ms；…）` ≠ …）
  const errorTexts = [timeoutError.error, businessError.error, unreachableError.error, usageError.error];
  assert.equal(new Set(errorTexts).size, errorTexts.length, `四类的 error 文案必须互异，实际 ${JSON.stringify(errorTexts)}`);
});

test('T4 · --wait 8000 对黑障：`--wait` 上限先到（WAIT_TIMEOUT/1、耗时 ≈ 上限、恰 1 次请求）', async (t) => {
  // 规格期望（F10 验收 3/5；§5.4 `1` 类 ②）：可阻塞形态（`--mode block`）的响应头预算由 `--wait` 上限支配
  //   ⇒ 8000ms 上限先到 = `WAIT_TIMEOUT` / 退出码 1、error 含 `8000`、本地中止在途请求（不重发、不换端口）。
  // 修复点 = `oamp/sdk/http.js` 的响应头上限按 `spec.headerTimeoutMs` 生效（缺省仍 5000ms）
  //   ＋ `oamp/sdk/surface.js` 的 `runApi` 单点派生（仅 `mode === 'block'`）。
  const blackhole = await startStubServer(t, {});
  const args = ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', '--mode', 'block', '--wait', '8000', '--port', String(blackhole.port)];
  const r = await hubCall(args, { timeoutMs: 15000 });
  const where = '--wait 8000 + 黑障';
  assert.equal(r.code, 1, `${where}：期望退出码 1，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
  assert.equal(r.stdout, '', `${where}：stdout 必须为空`);
  const error = parseErrorLine(where, r.stderr, ['code', 'error', 'exit_code']);
  assert.equal(error.code, 'WAIT_TIMEOUT', `${where}：期望 WAIT_TIMEOUT，实际 ${error.code}`);
  assert.equal(error.exit_code, 1, `${where}：期望 exit_code 1，实际 ${error.exit_code}`);
  assert.ok(error.error.includes('8000'), `${where}：error 应含「--wait」上限 8000，实际 ${JSON.stringify(error.error)}`);
  assert.ok(error.error.includes('调用仍在进行'), `${where}：error 应含「调用仍在进行」，实际 ${JSON.stringify(error.error)}`);
  assert.ok(r.elapsedMs > 7600 && r.elapsedMs < 9000, `${where}：耗时应落在 (7600, 9000)ms（响应头上限不得先行），实际 ${r.elapsedMs}ms`);
  assert.equal(blackhole.counts().requests, 1, `${where}：服务端应恰收到 1 次请求（本地中止、不重发），实际 ${JSON.stringify(blackhole.counts())}`);
});

test('T4 · >5000ms 段：6000ms 响应在 `--wait 8000` 与缺省上限内均可达 ⇒ 退出码 0 + 响应体原样', async (t) => {
  // F10 验收 2（显式上限）/ 验收 1（缺省 1800000）的可实测面：响应头到达晚于 5000ms ⇒ 旧实现（响应头上限
  //   恒 5000ms）会在此退化为 `REQUEST_TIMEOUT`/3。缺省上限的**完全可达性不可实测**（30 分钟），由
  //   `oamp/sdk/cli.js` 的 `DEFAULT_WAIT_MS` 常量面 + 本条「6000ms > 5000ms 仍走等待上限」共同闭合。
  const body = { calls: [{ call_id: 'stub-call-6000', state: 'completed', text: '' }] };
  const slow = await startStubServer(t, { delayMs: 6000, status: 200, body });
  const callArgs = (waitMs) => {
    const args = ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', '--mode', 'block', '--port', String(slow.port)];
    return waitMs === null ? args : [...args, '--wait', String(waitMs)];
  };

  // ① 显式 `--wait 8000`：6000ms 后响应头到达 ⇒ 上限内成功（不加信封、不改字段名、不裁剪）
  const explicit = await hubCall(callArgs(8000), { timeoutMs: 12000 });
  assert.equal(explicit.code, 0, `6000ms 桩 + --wait 8000：期望退出码 0，实际 ${explicit.code}（stderr=${JSON.stringify(explicit.stderr)}）`);
  assert.equal(explicit.stderr, '', `6000ms 桩 + --wait 8000：stderr 必须为空，实际 ${JSON.stringify(explicit.stderr)}`);
  assert.deepEqual(JSON.parse(explicit.stdout), body, `6000ms 桩 + --wait 8000：stdout 应为桩响应体原样，实际 ${JSON.stringify(explicit.stdout)}`);
  assert.ok(explicit.elapsedMs > 6000 && explicit.elapsedMs < 7000, `6000ms 桩 + --wait 8000：耗时应落在 (6000, 7000)ms，实际 ${explicit.elapsedMs}ms`);

  // ② 不给 `--wait`（缺省 1800000 ms）：同一 6000ms 桩仍在上限内返回
  const defaultWait = await hubCall(callArgs(null), { timeoutMs: 12000 });
  assert.equal(defaultWait.code, 0, `6000ms 桩 + 缺省上限：期望退出码 0，实际 ${defaultWait.code}（stderr=${JSON.stringify(defaultWait.stderr)}）`);
  assert.deepEqual(JSON.parse(defaultWait.stdout), body, `6000ms 桩 + 缺省上限：stdout 应为桩响应体原样，实际 ${JSON.stringify(defaultWait.stdout)}`);
  assert.ok(defaultWait.elapsedMs > 6000 && defaultWait.elapsedMs < 7000, `6000ms 桩 + 缺省上限：耗时应落在 (6000, 7000)ms，实际 ${defaultWait.elapsedMs}ms`);
  assert.equal(slow.counts().requests, 2, `6000ms 桩：两形态各应恰收到 1 次请求，实际 ${JSON.stringify(slow.counts())}`);
});

test('T4 · 非 block 形态不放大：`--mode background`（含 `mode` 缺省、非可阻塞条目）遇挂起服务端仍是 5000ms 级失败', async (t) => {
  // 裁决 D1 的判据面（架构 §5.4：可阻塞条目恒有上限、**非可阻塞条目走 5000ms**）：`--wait` 的缺省 1800000
  //   只在 `--mode block` 下支配响应头预算；其余形态沿用 5000ms 缺省，不随 `--wait` 放大。
  const blackhole = await startStubServer(t, {});
  const P = String(blackhole.port);
  const create = (extra) => ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', ...extra, '--port', P];
  const forms = [
    { label: '(i) `--mode background --wait 8000`', args: create(['--mode', 'background', '--wait', '8000']), what: '按 `mode` 分支，而非按「`--wait` 是否显式给出」分支' },
    { label: '(ii) `mode` 缺省（flag 不出现）+ 不给 `--wait`', args: create([]), what: '`waitMs` 被授予 1800000 但不得放大响应头预算（0021 事故的最常见形态）' },
    { label: '(iii) 不带 `wait` 声明的条目（api docs）', args: ['api', 'docs', '--port', P], what: '非可阻塞条目的 5000ms 缺省未被放大' },
  ];
  for (const form of forms) {
    const before = blackhole.counts().requests;
    const r = await hubCall(form.args, {});
    const where = `非 block 形态 ${form.label}（判别：${form.what}）`;
    assert.equal(r.code, 3, `${where}：期望退出码 3，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
    assert.equal(r.stdout, '', `${where}：stdout 必须为空`);
    const error = parseErrorLine(where, r.stderr, ['code', 'error', 'exit_code']);
    assert.equal(error.code, 'REQUEST_TIMEOUT', `${where}：期望 REQUEST_TIMEOUT，实际 ${error.code}`);
    assert.equal(error.exit_code, 3, `${where}：期望 exit_code 3，实际 ${error.exit_code}`);
    assert.ok(error.error.includes('5000'), `${where}：error 应含 5000（响应头缺省上限未被放大），实际 ${JSON.stringify(error.error)}`);
    assert.ok(r.elapsedMs > 4900 && r.elapsedMs < 5400, `${where}：耗时应落在 (4900, 5400)ms，实际 ${r.elapsedMs}ms`);
    assert.equal(blackhole.counts().requests - before, 1, `${where}：服务端应恰收到 1 次请求，实际 ${JSON.stringify(blackhole.counts())}`);
  }
});

test('T4 · 单点派生的两宿主同码：CLI 面与库面对同一黑障桩同 code（WAIT_TIMEOUT）同退出码（1）', async (t) => {
  // 派生点恰 1（`surface.js` 的 `runApi`）⇒ 库面（`params.waitMs` 走第二槽）与 CLI 面对同一黑障桩同归类。
  const blackhole = await startStubServer(t, {});
  const { createHub } = await import('../sdk/index.js');
  const args = ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', '--mode', 'block', '--wait', '8000', '--port', String(blackhole.port)];

  const cli = await hubCall(args, { timeoutMs: 15000 });
  const cliError = parseErrorLine('两宿主同码（进程面）', cli.stderr, ['code', 'error', 'exit_code']);
  assert.equal(cli.code, 1, `两宿主同码（进程面）：期望退出码 1，实际 ${cli.code}（stderr=${JSON.stringify(cli.stderr)}）`);
  assert.equal(cliError.code, 'WAIT_TIMEOUT', `两宿主同码（进程面）：期望 WAIT_TIMEOUT，实际 ${cliError.code}`);

  const started = Date.now();
  const lib = await callLibrary('两宿主同码（库面 api.calls.create）', () =>
    createHub({ port: blackhole.port }).api.calls.create({ 'chat-id': 'c', agent: 'a', task: 't', mode: 'block' }, { waitMs: 8000 }),
  );
  const libElapsedMs = Date.now() - started;
  assert.equal(lib.exitCode, cli.code, `两宿主同码：库面退出码 ${lib.exitCode} 与进程面 ${cli.code} 不一致`);
  assert.equal(lib.errorCode, cliError.code, `两宿主同码：库面 code ${lib.errorCode} 与进程面 ${cliError.code} 不一致`);
  assert.ok(lib.errorText.includes('8000'), `两宿主同码：库面 error 应含「--wait」上限 8000，实际 ${JSON.stringify(lib.errorText)}`);
  assert.ok(libElapsedMs > 7600 && libElapsedMs < 9000, `两宿主同码：库面耗时应落在 (7600, 9000)ms，实际 ${libElapsedMs}ms`);
  assert.equal(blackhole.counts().requests, 2, `两宿主同码：两宿主各应恰收到 1 次请求，实际 ${JSON.stringify(blackhole.counts())}`);
});

test('T4 · 上游业务错误优先于本地超时：`--mode block --wait 8000` 下 404 / 400 仍即时归类', async (t) => {
  // 放宽响应头预算不改变「上游错误即时归类」的次序：上游 4xx 在 `--wait` 上限内到达 ⇒ 仍按上游 `code` 归类。
  const notFound = await startStubServer(t, { delayMs: 0, status: 404, body: { error: 'chat 不存在: ghost', code: 'NOT_FOUND' } });
  const badRequest = await startStubServer(t, { delayMs: 0, status: 400, body: { error: '缺少 agent 字段', code: 'INVALID_PARAM' } });
  const samples = [
    { label: '上游 404', stub: notFound, code: 'NOT_FOUND', status: 404, error: 'chat 不存在: ghost' },
    { label: '上游 400', stub: badRequest, code: 'INVALID_PARAM', status: 400, error: '缺少 agent 字段' },
  ];
  for (const sample of samples) {
    const r = await hubCall(
      ['api', 'calls', 'create', '--chat-id', 'c', '--agent', 'a', '--task', 't', '--mode', 'block', '--wait', '8000', '--port', String(sample.stub.port)],
      {},
    );
    const where = `${sample.label}（--mode block --wait 8000）`;
    assert.equal(r.code, 1, `${where}：期望退出码 1，实际 ${r.code}（stderr=${JSON.stringify(r.stderr)}）`);
    assert.equal(r.stdout, '', `${where}：失败面 stdout 不得有残片，实际 ${JSON.stringify(r.stdout)}`);
    const error = parseErrorLine(where, r.stderr, ['code', 'error', 'exit_code', 'http_status']);
    assert.equal(error.code, sample.code, `${where}：期望 ${sample.code}，实际 ${error.code}`);
    assert.equal(error.exit_code, 1, `${where}：期望 exit_code 1，实际 ${error.exit_code}`);
    assert.equal(error.http_status, sample.status, `${where}：http_status 应为上游真实状态码，实际 ${error.http_status}`);
    assert.equal(error.error, sample.error, `${where}：error 应为上游原文，实际 ${JSON.stringify(error.error)}`);
    assert.ok(r.elapsedMs < 4900, `${where}：上游错误应即时归类（未被本地超时抢先），实际 ${r.elapsedMs}ms`);
  }
});

// ────────────────────────────── T5 · P-1 口径的 background 取回终态 ──────────────────────────────

test('T5 · P-1 口径：background 受理即返回标识，新进程取回终态，无自动重派', async (t) => {
  const hub = await setupHub(t);
  const P = String(hub.port);
  const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-cli-contract-fake-'));
  t.after(() => {
    try {
      fs.rmSync(fakeDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const FAKE_BIN = path.join(fakeDir, 'fake-acp.cjs');
  fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });

  // 夹具：不依赖真实 omp / 外网（`OAMP_OMP_BIN` 注入）；实例名 = `pb-dev` ⇒ `/api/calls` 的角色名 `dev` 可寻址
  // （角色反解的唯一真源 = `pb-` + 角色名，见 src/role-binding.js）。
  const AGENT_ID = 'pb-dev';
  const agent = await startAgent(AGENT_ID, {
    socketPath: hub.socketPath,
    envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN, ...LEASE_ENV },
  });
  t.after(() => agent.stop());
  await agent.waitAgentLine(new RegExp(`REGISTERED instance=${AGENT_ID}`));

  // 2) 备好一个已存在的 chat（调用面不新建对话），再以 background 形态发起调用
  const sent = await runHubJson(['api', 'messages', 'send', '--agent-id', AGENT_ID, '--project-id', hub.projectId, '--text', `唯一标记 ${Date.now()}`, '--port', P], {});
  const chatId = sent.body.chat_id;
  assert.ok(typeof chatId === 'string' && chatId.length > 0, `messages send 应返回 chat_id，实际 ${JSON.stringify(sent.body)}`);

  const created = await hubCall(['api', 'calls', 'create', '--chat-id', chatId, '--agent', 'dev', '--task', 'ok', '--mode', 'background', '--port', P], {});
  assert.equal(created.code, 0, `background 受理：期望退出码 0，实际 ${created.code}（stderr=${JSON.stringify(created.stderr)}）`);
  assert.ok(created.elapsedMs < 3000, `background 受理应立即返回（<3000ms），实际 ${created.elapsedMs}ms`);
  const createdBody = JSON.parse(created.stdout);
  assert.ok(Array.isArray(createdBody.calls) && createdBody.calls.length === 1, `受理响应应为 {calls: [一封]}，实际 ${JSON.stringify(createdBody)}`);
  const callId = createdBody.calls[0].call_id;
  assert.ok(typeof callId === 'string' && callId.length > 0, `受理响应应含非空 call_id，实际 ${JSON.stringify(createdBody.calls[0])}`);
  assert.equal(createdBody.calls[0].state, 'submitted', `受理态应为 submitted，实际 ${JSON.stringify(createdBody.calls[0].state)}`);

  // 3) 新进程取回（首次即不 NOT_FOUND），随后有界轮询直至终态（每次轮询 = 一次独立新进程调用）
  const first = await runHubJson(['api', 'calls', 'get', callId, '--port', P], {});
  assert.equal(first.body.call_id, callId, `新进程取回：call_id 应与创建时逐字相同，实际 ${JSON.stringify(first.body.call_id)}`);
  const terminal = await waitFor(
    async () => {
      const polled = await runHubJson(['api', 'calls', 'get', callId, '--port', P], {});
      return polled.body.state === 'completed' || polled.body.state === 'failed' ? polled.body : null;
    },
    { timeoutMs: 10000, intervalMs: 200, what: `调用 ${callId} 的终态` },
  );
  assert.equal(terminal.state, 'completed', `fake ACP 夹具应产出 completed，实际 ${JSON.stringify(terminal)}`);
  assert.ok(typeof terminal.text === 'string' && terminal.text.length > 0, `completed 时 text 应非空，实际 ${JSON.stringify(terminal.text)}`);
  assert.ok(terminal.duration_ms === null || typeof terminal.duration_ms === 'number', `duration_ms 应为数字或 null，实际 ${JSON.stringify(terminal.duration_ms)}`);
  assert.equal(typeof terminal.truncated, 'boolean', `truncated 应为布尔，实际 ${JSON.stringify(terminal.truncated)}`);

  // 4) 超时只结束本次等待（P-1）：`--mode block` 超时后**不保证**标识可见（服务端 block 语义使然），
  //    可取回性落在 background 形态；不做 roster 反查（跨端点语义）。恢复取回靠**重新调用**（本用例第二轮 `calls get` 即此）。
  // 5) 无自动重派 / 无自动重试：调用面相关行数 = 派发行数（messages send 一行 + calls create 一行）
  const roster = await runHubJson(['api', 'calls', 'list', '--port', P], {});
  const ids = roster.body.calls.map((row) => row.call_id);
  assert.equal(ids.filter((id) => id === callId).length, 1, `本次调用在 roster 中应恰一行，实际 ${JSON.stringify(ids)}`);
  assert.equal(roster.body.calls.length, 2, `roster 应恰有 2 行（messages send 派发行 + calls create 行，无自动重派），实际 ${JSON.stringify(roster.body.calls)}`);

  // 5) 第二取回面：转录
  const transcript = await runHubJson(['api', 'calls', 'transcript', callId, '--port', P], {});
  assert.equal(transcript.body.call_id, callId, `转录面 call_id 应与创建时一致，实际 ${JSON.stringify(transcript.body.call_id)}`);
});

/** minimal fake omp：同一脚本两种形态（`acp` 常驻 JSON-RPC / `-p` 一次式）——逐字沿用既有 web.test.js 的体例。 */
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\\n');
}
try {
  if (process.env.FAKE_ACP_ARGS_LOG) fs.appendFileSync(process.env.FAKE_ACP_ARGS_LOG, JSON.stringify(argv) + '\\n');
} catch {}

if (argv.includes('-p')) {
  console.log('one-shot answer: ' + argv[argv.length - 1]);
  process.exit(0);
}

const modelIdx = argv.indexOf('--model');
const spawnModel = modelIdx >= 0 ? argv[modelIdx + 1] : 'deepseek/deepseek-v4-flash';
const hang = process.env.FAKE_ACP_HANG === '1';
const sticky = process.env.FAKE_ACP_STICKY_MODEL === '1';

let sessionSeq = 0;
const sessions = new Map();
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function configOptions(model) {
  return [{ id: 'model', category: 'model', currentValue: model, options: [] }];
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.method === 'initialize') {
    reply(msg.id, { protocolVersion: 1, agentCapabilities: {} });
    return;
  }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    const sessionId = 'sess-' + sessionSeq;
    sessions.set(sessionId, { model: spawnModel });
    reply(msg.id, { sessionId, configOptions: configOptions(spawnModel) });
    // omp 启动期会灌初始化通知（§6.6）：静默窗口应在其后收敛
    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'available_commands_update', availableCommands: [] } } });
    }, 20);
    return;
  }
  if (msg.method === 'session/set_config_option') {
    const session = sessions.get(msg.params.sessionId);
    if (session && !sticky) session.model = msg.params.value;
    reply(msg.id, { configOptions: configOptions(sticky ? spawnModel : msg.params.value) });
    return;
  }
  if (msg.method === 'session/prompt') {
    const session = sessions.get(msg.params.sessionId);
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
    if (hang) return; // 永不响应 → chat 停在 working（启动扫尾用例）
    const answer = '收到：' + text;
    const parts = [answer.slice(0, 1), answer.slice(1, 2), answer.slice(2)];
    for (const part of parts) {
      if (part === '') continue;
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: session.sessionId || msg.params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } } });
      await delay(10);
    }
    await delay(10);
    reply(msg.id, { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } });
    return;
  }
});
`;

// ────────────────────────────── T6 · 订阅管道截断 ──────────────────────────────

test('T6 · 订阅管道截断：| head -1 自行退出、退出码 0、NDJSON 单行、无残留进程', async (t) => {
  const hub = await setupHub(t);
  // 管道形态：`hub api stream events --port <p> | head -1` —— runHub 的 spawn 无 shell ⇒ 本用例自建 bash + 进程组。
  // `set -o pipefail` ⇒ 管道退出码即 hub 的退出码（`0` = EPIPE 分支的 `process.exit(0)`，而非被 SIGPIPE 杀死）。
  const script = `set -o pipefail; exec ${JSON.stringify(process.execPath)} ${JSON.stringify(HUB_BIN)} api stream events --port ${hub.port} | head -1`;
  const child = spawn('bash', ['-c', script], {
    cwd: os.tmpdir(),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // 自成进程组：可整体收口，并据 pgid 判"无残留进程"
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  let exit = null;
  child.once('exit', (code, signal) => {
    exit = { code, signal };
  });
  const killGroup = () => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* 进程组已不存在 */
    }
  };
  t.after(async () => {
    killGroup();
    await hub.web.stop();
  });

  // 1) 事件驱动：订阅建立时首帧只播种基线（不发事件）⇒ 之后注册的节点才会产生拓扑事件；
  //    有界重试：每轮注册一个唯一实例，直到管道捕获到首帧（基线播种若晚于注册，该节点不入基线、仍会触发事件）。
  const nodes = [];
  let seq = 0;
  await waitFor(
    async () => {
      if (stdout !== '') return true;
      seq += 1;
      nodes.push(await startFakeNode({ socketPath: hub.socketPath, instanceId: `probe-node-${seq}` }));
      return false;
    },
    { timeoutMs: 15000, intervalMs: 250, what: '订阅管道首帧（拓扑事件）' },
  );
  assert.ok(nodes.length >= 1, '应至少注册过一个假节点以产生拓扑事件');

  // 2) 事件 ≥2 帧：停掉所有探针节点 ⇒ 基线内的节点产生 agent_offline（head 已关闭管道 ⇒ hub 下一次写入收尾）
  await Promise.all(nodes.map((node) => node.stop()));

  // 2) 管道**自行**退出（有界等待；超时即判失败，不得靠超时强杀代替）
  await waitFor(() => exit !== null, { timeoutMs: 15000, intervalMs: 50, what: '管道自行退出' });
  assert.equal(exit.code, 0, `管道应以 0 自行退出（EPIPE 分支的 process.exit(0)），实际 ${JSON.stringify(exit)} stderr=${JSON.stringify(stderr)}`);

  // 3) NDJSON 单行形态
  assert.equal(stdout.split('\n').filter((line) => line !== '').length, 1, `管道 stdout 应恰 1 行，实际 ${JSON.stringify(stdout)}`);
  assert.ok(stdout.endsWith('\n'), `管道 stdout 应以换行结尾，实际 ${JSON.stringify(stdout)}`);
  const frame = JSON.parse(stdout);
  assert.deepEqual(Object.keys(frame).sort(), ['data', 'event'], `帧顶层键应为 {event, data}，实际 ${JSON.stringify(Object.keys(frame))}`);
  assert.equal(typeof frame.event, 'string', `帧 event 应为字符串，实际 ${JSON.stringify(frame.event)}`);
  assert.equal(typeof frame.data, 'object', `帧 data 应为对象，实际 ${JSON.stringify(frame.data)}`);

  // 4) 无残留进程：管道进程组已不存在
  let groupAlive = true;
  try {
    process.kill(-child.pid, 0);
  } catch (err) {
    groupAlive = err.code !== 'ESRCH';
  }
  assert.equal(groupAlive, false, `管道退出后不应有残留进程（pgid ${child.pid} 仍存活）`);

  // 4) 端口释放：hub 是客户端（不监听端口）⇒ 可判形态 = hub 端点（web）显式停止后 ≤1s 内不可连（持有它的残留进程必为 hub / web 子进程）
  await hub.web.stop();
  await waitFor(() => isPortFree(hub.port), { timeoutMs: 1000, intervalMs: 50, what: `端口 ${hub.port} 释放` });
});

// ────────────────────────────── T7 · 层 C 零语义变更（逐字节） ──────────────────────────────

test('T7 · 层 C 逐字节：hub cli ↔ 直跑 oamp 一致、零现场变化、无自动拉起', async (t) => {
  const hub = await setupHub(t);
  const ghostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-cli-contract-ghost-'));
  t.after(() => {
    try {
      fs.rmSync(ghostDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const env = buildEnv(hub.socketPath, LEASE_ENV);
  const unreachableEnv = buildEnv(path.join(ghostDir, 'nonexistent.sock'), LEASE_ENV);

  /** 一组对照：两侧同 bin / 同 env / 同 cwd ⇒ stdout / stderr / 退出码逐字节比较，并核对现场零变化。 */
  const compare = async ({ label, tokens, runEnv }) => {
    const before = await queryStatus(hub.socketPath);
    const viaHub = await runHub(['cli', ...tokens], { env: runEnv });
    const direct = await runOampDirect(tokens, runEnv);
    const after = await queryStatus(hub.socketPath);
    const where = `${label}（hub cli ${tokens.join(' ')}）`;
    assert.equal(viaHub.code, direct.code, `${where}：退出码不一致（hub ${viaHub.code} vs 直跑 ${direct.code}）`);
    assertSameBytes(`${where}：stdout`, direct.stdout, viaHub.stdout);
    assertSameBytes(`${where}：stderr`, direct.stderr, viaHub.stderr);
    assert.deepEqual(topologyShape(after), topologyShape(before), `${where}：Router 拓扑在对照前后应不变（注册集合 + 状态；心跳时间戳除外）`);
    return { viaHub, direct };
  };

  // 2) 只读类对照：live Router **零节点** ⇒ 表头单行（非空，防"空 vs 空"的虚假相等）
  const statusRead = await compare({ label: '只读组 · status', tokens: ['status'], runEnv: env });
  assert.equal(statusRead.viaHub.code, 0, `status（零节点）：期望退出码 0，实际 ${statusRead.viaHub.code}`);
  assert.ok(statusRead.viaHub.stdout.trim().length > 0, 'status（零节点）：stdout trim 后应为表头单行（非空，防"空 vs 空"的虚假相等）');
  assert.equal(statusRead.viaHub.stderr, '', 'status（零节点）：stderr 必须为空');
  const tasksBefore = await runHub(['api', 'calls', 'list', '--port', String(hub.port)], { env });
  const taskList = await compare({ label: '只读组 · task list', tokens: ['task', 'list'], runEnv: env });
  assert.equal(taskList.viaHub.code, 0, `task list：期望退出码 0，实际 ${taskList.viaHub.code}`);
  assert.ok(taskList.viaHub.stdout.trim().length > 0, 'task list（零任务）：stdout trim 后应为「（无任务）」单行（非空，防"空 vs 空"的虚假相等）');
  assert.equal(taskList.viaHub.stderr, '', 'task list（零任务）：stderr 必须为空');
  const tasksAfter = await runHub(['api', 'calls', 'list', '--port', String(hub.port)], { env });
  assertSameBytes('task list 前后（任务面）', tasksBefore.stdout, tasksAfter.stdout);

  // 3) 不可达态对照：既有 `1` 不被重分类为 `3`
  const unreachable = await compare({ label: '不可达态 · status', tokens: ['status'], runEnv: unreachableEnv });
  assert.equal(unreachable.viaHub.code, 1, `不可达态 status：期望退出码 1，实际 ${unreachable.viaHub.code}`);
  assert.equal(unreachable.viaHub.stdout, '', '不可达态 status：stdout 必须为空');
  assert.ok(unreachable.viaHub.stderr.trim().length > 0, '不可达态 status：stderr trim 后应明确报错（不静默空结果）');

  // 4) 启停类命令的**用法面**对照（零现场副作用）
  const usage = await compare({ label: '启停类用法面 · agent start', tokens: ['agent', 'start'], runEnv: env });
  assert.equal(usage.viaHub.code, 2, `agent start（缺 instance-id）：期望退出码 2，实际 ${usage.viaHub.code}`);
  assert.equal(usage.viaHub.stdout, '', 'agent start（缺 instance-id）：stdout 必须为空');

  // 6①) 无自动拉起：固定观察窗内拓扑零新增注册
  const beforeWindow = await queryStatus(hub.socketPath);
  await new Promise((resolve) => setTimeout(resolve, 500)); // 固定 500ms 观察窗（负向判据的构造面）
  const afterWindow = await queryStatus(hub.socketPath);
  assert.deepEqual(topologyShape(afterWindow), topologyShape(beforeWindow), '启停类样本后 500ms 观察窗内拓扑应零新增注册（无守护 / 无自动拉起）');

  // 6②) agent 不在线时的调用面：明确失败（不重试、不拉起），同窗内拓扑零新增
  const chat = await runHubJson(['api', 'messages', 'send', '--agent-id', 'pb-dev', '--project-id', hub.projectId, '--text', '无 agent 在线', '--port', String(hub.port)], { env });
  const beforeCall = await queryStatus(hub.socketPath);
  const failed = await runHub(['api', 'calls', 'create', '--chat-id', chat.body.chat_id, '--agent', 'dev', '--task', 't', '--port', String(hub.port)], { env });
  assert.equal(failed.code, 1, `agent 不在线：期望退出码 1，实际 ${failed.code}（stderr=${JSON.stringify(failed.stderr)}）`);
  const failedError = parseErrorLine('agent 不在线', failed.stderr, ['code', 'error', 'exit_code', 'http_status']);
  assert.equal(failedError.code, 'NOT_FOUND', `agent 不在线：期望 NOT_FOUND，实际 ${failedError.code}`);
  await new Promise((resolve) => setTimeout(resolve, 500)); // 同窗观察
  const afterCall = await queryStatus(hub.socketPath);
  assert.deepEqual(topologyShape(afterCall), topologyShape(beforeCall), '调用失败后 500ms 观察窗内拓扑应零新增（不重试、不拉起）');
});

// ────────────────────────────── T8 · 跨进程无状态 ──────────────────────────────

test('T8 · 跨进程无状态：并发两进程互不影响、新进程续查、仓库零新增状态文件', async (t) => {
  const repoRoot = ROOT;
  const snapshotBefore = repoSnapshot(repoRoot);
  const dirsBefore = [fs.existsSync(path.join(repoRoot, '.runtime')), fs.existsSync(path.join(repoRoot, 'data'))];

  const hub = await setupHub(t);
  const P = String(hub.port);

  // 4) 临时状态结构性保证：OAMP_DB / OAMP_SOCKET 均为 os.tmpdir() 下的绝对路径（与"零仓库写"互为结构面与观测面）
  for (const [name, value] of [['OAMP_DB', hub.dbPath], ['OAMP_SOCKET', hub.socketPath]]) {
    assert.ok(path.isAbsolute(value), `${name} 必须是绝对路径，实际 ${value}`);
    assert.ok(value.startsWith(os.tmpdir()), `${name} 应位于系统临时目录，实际 ${value}`);
    assert.ok(!value.startsWith(repoRoot), `${name} 不得落在仓库内，实际 ${value}`);
  }

  // 1) 并发执行互不影响：两跑 stdout 逐字节相等（无半截、无互相污染、无内容串台）
  const concurrentGroups = [
    { label: 'api docs', args: ['api', 'docs', '--port', P] },
    { label: 'api chats list', args: ['api', 'chats', 'list', '--project-id', hub.projectId, '--port', P] },
  ];
  for (const group of concurrentGroups) {
    const [a, b] = await Promise.all([runHub(group.args, {}), runHub(group.args, {})]);
    const shown = (r) => `code=${r.code} stdout=${JSON.stringify(r.stdout.slice(0, 200))}`;
    assert.equal(a.code, 0, `并发组 ${group.label}：第一跑期望退出码 0，实际 ${shown(a)}`);
    assert.equal(b.code, 0, `并发组 ${group.label}：第二跑期望退出码 0，实际 ${shown(b)}`);
    assert.ok(JSON.parse(a.stdout) !== null && JSON.parse(b.stdout) !== null, `并发组 ${group.label}：两跑 stdout 均应可解析`);
    assertSameBytes(`并发组 ${group.label}：两跑 stdout`, a.stdout, b.stdout);
  }

  // 2) 续查靠新进程而非本地记忆（两次不同间隔的重复观察）
  const markers = [`标记-A-${Date.now()}`, `标记-B-${Date.now()}`];
  const gaps = [0, 300];
  for (let i = 0; i < markers.length; i += 1) {
    const sent = await runHubJson(['api', 'messages', 'send', '--agent-id', 'pb-dev', '--project-id', hub.projectId, '--text', markers[i], '--port', P], {});
    const chatId = sent.body.chat_id;
    if (gaps[i] > 0) await new Promise((resolve) => setTimeout(resolve, gaps[i])); // 不同间隔（非关键路径等待）
    const fetched = await runHubJson(['api', 'chats', 'get', chatId, '--port', P], {});
    assert.equal(fetched.body.chat.chat_id, chatId, `续查（间隔 ${gaps[i]}ms）：chat_id 应与发送侧逐字相同，实际 ${JSON.stringify(fetched.body.chat.chat_id)}`);
  }

  // 3) 仓库零新增状态文件：递归路径集合前后完全相等 + `.runtime` / `data` 存在性不变
  const snapshotAfter = repoSnapshot(repoRoot);
  assert.deepEqual(snapshotAfter, snapshotBefore, `oamp/ 递归路径集合在调用前后必须完全相等（零新增、零删除）`);
  const dirsAfter = [fs.existsSync(path.join(repoRoot, '.runtime')), fs.existsSync(path.join(repoRoot, 'data'))];
  assert.deepEqual(dirsAfter, dirsBefore, '`oamp/.runtime` 与 `oamp/data` 的存在性在调用前后必须一致');
});

/** `oamp/` 的递归文件路径集合（排除 `node_modules`），用于「仓库零新增状态文件」的前后比较。 */
function repoSnapshot(dir) {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((rel) => !String(rel).split(path.sep).includes('node_modules'))
    .map((rel) => String(rel))
    .sort();
}

// ────────────────────────────── T9 · 收口 ──────────────────────────────

test('T9 · 拾取性：本文件落在 `node --test test/*.test.js` 的拾取面内且零新增依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test test/*.test.js', '测试拾取面不得被改动');
  assert.deepEqual(pkg.dependencies, {}, '本 PR 零新依赖（只用 node 内置）');
  assert.equal(path.dirname(THIS_FILE), path.join(ROOT, 'test'), '用例必须落在 test/ 平铺面内');
  assert.ok(path.basename(THIS_FILE).endsWith('.test.js'), '文件名必须匹配 `test/*.test.js`');
});
