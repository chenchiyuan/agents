// test/sdk-uds.test.js — 层 B（Router UDS 通道）行为用例：库面 + CLI 面（F03 / F08 / F09 / G02；迭代 0025 pr-008）
// 四卡归属：F03 = 8 方法覆盖与透传对照 / 注册闭环；F08 = 不可达降级 + 2000ms 连接上限；
//   F09 = shell 面零状态与无跨调用状态；G02 = 无自动性（无自动重试 / 无自动心跳 / 无自动 ack）。
// 载体纪律（§10 测试基建约束 / PR 验收 8·9）：hub 入口一律经 `helpers/hub-harness.js` 的 `runHub()` 起子进程；
//   库面一律经 `sdk/index.js` 的 `createHub()`（不建第二套子进程辅助）；唯一的子进程直起只在文件局部
//   `startWeb`（web 服务端，同 web.test.js 体例）。临时状态一律落系统临时目录的绝对路径
//   （socket 目录 + web 的 `OAMP_DB`）——**不写仓库内 `.runtime/` 与 `data/`**（用例末尾做目录快照比对）。
// 零真实依赖：不注入假 omp、不派发任务请求、零外网（静态守门见文末两条用例）。
// 判据一律现算：透传判据与 `src/rpc.js` 的 `RpcPeer` 直连结果**逐键对比**（不手抄字段表）；
//   拓扑判据取 Router stdout 的事件行（A11）与 SDK 面的 `router.status`（不引第二份真源）。
// 连接上限（2000ms）取"注入桩 + 上限值观测 + 清零点"三面（UDS 黑洞不可确定性构造，不以真实等待为判据）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, stopAll, waitFor, buildEnv } from './helpers/harness.js';
import { runHub } from './helpers/hub-harness.js';
import { createHub } from '../sdk/index.js';
import { RpcPeer } from '../src/rpc.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根 = oamp/
const SELF_FILE = fileURLToPath(import.meta.url);
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');

// C6 / A20：端口段（主 agent 冻结分配）——本 PR 独占 [52000, 52999]；下列对照区间只用于"零交集"判定。
const PORT_SEGMENT = { min: 52000, max: 52999 };
const SIBLING_SEGMENTS = [
  [51000, 51999], // pr-007
  [53000, 53999], // pr-009
  [54000, 54999], // pr-010
];
const LEGACY_MAX_PORT = 49999; // 既有套件占用段止于该值

const LONG_LEASE_MS = 3000; // C4：库面会话用例的放长租约（先例 web.test.js 的 LEASE_ENV）
const SHORT_LEASE_MS = 300; // C4 的唯一例外：T6 的"无自动心跳"墓碑用例
const CONNECT_LIMIT_MS = 2000; // §5.4：连接建立上限（本 PR 只观测上限值 / 清零点，不以真实等待为判据）
const OBSERVE_WINDOW_MS = 600; // C9：无自动性的观察窗
const SELF_CLOSE_WINDOW_MS = 200; // T3 验收 5：close() 后的静默观察窗

const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ────────────────────────────── 共享原语（T1 验收 3） ──────────────────────────────

/** 临时 socket 目录（C5：绝对路径，落系统临时目录）。 */
function tempSocketDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-uds-'));
}

/** web 子进程的临时库目录（C5 / A17：绝对路径；不落仓库 `data/`）。 */
function tempDbDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-uds-db-'));
}

/** 起真 Router（C4：租约放长）并按用例收口（停 Router → 删临时 socket 目录，顺序不可颠倒）。 */
async function startRouterFor(t, { leaseMs = LONG_LEASE_MS } = {}) {
  const dir = tempSocketDir();
  const router = await startRouter({
    socketPath: path.join(dir, 'router.sock'),
    envExtra: { OAMP_HEARTBEAT_TIMEOUT_MS: String(leaseMs) },
  });
  t.after(async () => {
    await stopAll([router]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return router;
}

/** 库面 env 纪律（C3 / A23②）：`createHub` 无 env 选项 ⇒ 缺省链读调用方进程 env；在此设 / 复原。 */
function useProcessSocket(t, socketPath) {
  const saved = process.env.OAMP_SOCKET;
  process.env.OAMP_SOCKET = socketPath;
  t.after(() => {
    if (saved === undefined) delete process.env.OAMP_SOCKET;
    else process.env.OAMP_SOCKET = saved;
  });
}

/**
 * 对照组 oracle / 假对端（C2：本文件**唯一**的 socket 直连落点）——经 `RpcPeer` 直连取得 JSON-RPC `result`。
 * `message.deliver` 恒回传输应答 `{received:true, message_id}` 并记入 `deliveries`（**不**自动 ack）。
 */
async function rawPeer(socketPath, idPrefix = 'oracle') {
  const socket = await new Promise((resolve, reject) => {
    const connecting = net.connect(socketPath);
    connecting.once('connect', () => resolve(connecting));
    connecting.once('error', reject);
  });
  const deliveries = [];
  const peer = new RpcPeer(socket, {
    idPrefix,
    onRequest: (method, params, respond) => {
      if (method === 'message.deliver') {
        const message = params && params.message;
        deliveries.push(message);
        if (respond) respond.ok({ received: true, message_id: message ? message.message_id : null });
        return;
      }
      if (respond) respond.error(-32601, `method not found: ${method}`);
    },
  });
  return { peer, deliveries, close: () => peer.close() };
}

/** 端口段内**运行时探测**空闲端口（C6：候选随机 → bind 探测 → 有限重试 → 全忙点名失败）。 */
async function pickFreePortInSegment(attempts = 24) {
  for (let i = 0; i < attempts; i += 1) {
    const port = PORT_SEGMENT.min + Math.floor(Math.random() * (PORT_SEGMENT.max - PORT_SEGMENT.min + 1));
    const free = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error(`端口段内无可探测空闲端口：${PORT_SEGMENT.min}-${PORT_SEGMENT.max}（尝试 ${attempts} 次，实测全忙）`);
}

/**
 * web 服务端子进程（MI-5 / A19：文件局部辅助，同 web.test.js 体例）。
 * 端口由调用方经 `pickFreePortInSegment()` 探测（C6）；`OAMP_DB` 一律绝对临时路径（A17）。
 */
async function startWeb(t, { socketPath, port, dbPath }) {
  const child = spawn(process.execPath, [BIN, 'web', 'start', '--port', String(port)], {
    cwd: OAMP_ROOT,
    env: buildEnv(socketPath, { OAMP_HEARTBEAT_TIMEOUT_MS: String(LONG_LEASE_MS * 2), OAMP_DB: dbPath }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    out += chunk;
  });
  child.stderr.on('data', (chunk) => {
    err += chunk;
  });
  let exitInfo = null;
  child.once('exit', (code, signal) => {
    exitInfo = { code, signal };
  });
  t.after(async () => {
    if (exitInfo) return;
    child.kill('SIGINT');
    await waitFor(() => exitInfo !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
  });
  await waitFor(() => out.includes('WEB_READY') || exitInfo !== null, {
    timeoutMs: 8000,
    what: `web WEB_READY（port=${port}，OAMP_DB=${dbPath}）`,
  });
  if (exitInfo) {
    throw new Error(`web 未就绪即退出（port=${port}，OAMP_DB=${dbPath}，实测 exit=${JSON.stringify(exitInfo)}，stderr=${err}）`);
  }
}

// ────────────────────────────── 断言与对照原语（C8） ──────────────────────────────

/** 易变字段的形态核验清单（MI-1）：身份 / 时间类字段只核形态，不比值。 */
const VOLATILE_KEY_SHAPES = {
  instance_id: (v) => typeof v === 'string' && v.length > 0,
  session_id: (v) => typeof v === 'string' && v.length > 0,
  last_heartbeat: (v) => Number.isInteger(v) && v > 0,
  created_at: (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
  message_id: (v) => typeof v === 'string' && v.length > 0,
  task_id: (v) => typeof v === 'string' && v.length > 0,
};
/** 身份绑定面：两条路径各有自己的身份 / 时间 ⇒ 这些键只核形态。 */
const IDENTITY_VOLATILE = new Set(Object.keys(VOLATILE_KEY_SHAPES));
/** 可同参数面：唯一豁免 `last_heartbeat`（其余字段值级一致，MI-1）。 */
const SHARED_PARAM_VOLATILE = new Set(['last_heartbeat']);
/** SDK 返回值不得含信封键（"不加信封"的否定断言；拼接构造避免扫描器命中自身）。 */
const ENVELOPE_KEYS = ['result', 'json' + 'rpc', 'id'];

const fmt = (value) => JSON.stringify(value) ?? String(value);
const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 键集（排序）——供 8 行对照清单机械产出（MI-2）。 */
function keysOf(value) {
  if (value === undefined) return [];
  if (!isObj(value)) return [typeof value];
  return Object.keys(value).sort();
}

/**
 * 递归逐键差异（C8 / T7 验收 5）：缺键 / 多键 / 取值不符逐条可点名，空数组 = 一致。
 * `volatile` = 只核形态的键名集合（形态不符也逐条列出）。
 */
function collectDiff(actual, expected, { at = '$', volatile = IDENTITY_VOLATILE } = {}) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return [`${at}: 一方不是数组（actual=${fmt(actual)}，expected=${fmt(expected)}）`];
    }
    const diffs = [];
    if (actual.length !== expected.length) diffs.push(`${at}: 长度不符（actual=${actual.length}，expected=${expected.length}）`);
    for (let i = 0; i < Math.min(actual.length, expected.length); i += 1) {
      diffs.push(...collectDiff(actual[i], expected[i], { at: `${at}[${i}]`, volatile }));
    }
    return diffs;
  }
  if (isObj(actual) && isObj(expected)) {
    const diffs = [];
    for (const key of Object.keys(expected)) {
      const where = `${at}.${key}`;
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        diffs.push(`${where}: 缺键（expected=${fmt(expected[key])}）`);
        continue;
      }
      if (volatile.has(key)) {
        const check = VOLATILE_KEY_SHAPES[key];
        if (check && !check(actual[key])) diffs.push(`${where}: 易变字段形态不符（actual=${fmt(actual[key])}）`);
        continue;
      }
      diffs.push(...collectDiff(actual[key], expected[key], { at: where, volatile }));
    }
    for (const key of Object.keys(actual)) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) {
        diffs.push(`${at}.${key}: 多键（actual=${fmt(actual[key])}）`);
      }
    }
    return diffs;
  }
  if (Object.is(actual, expected)) return [];
  return [`${at}: 取值不符（actual=${fmt(actual)}，expected=${fmt(expected)}）`];
}

/** 信封键（`result` / `jsonrpc` / `id`）的递归出现位置。 */
function envelopeHits(value, at = '$') {
  if (Array.isArray(value)) return value.flatMap((item, index) => envelopeHits(item, `${at}[${index}]`));
  if (!isObj(value)) return [];
  const hits = [];
  for (const [key, item] of Object.entries(value)) {
    if (ENVELOPE_KEYS.includes(key)) hits.push(`${at}.${key}`);
    hits.push(...envelopeHits(item, `${at}.${key}`));
  }
  return hits;
}

/** 透传判据（C8）：逐键差异为空 + 无信封键。 */
function assertPassthrough(label, sdkResult, rawResult, volatile = IDENTITY_VOLATILE) {
  const diffs = collectDiff(sdkResult, rawResult, { volatile });
  assert.deepEqual(diffs, [], `${label}: SDK 返回值与 RpcPeer 直连 result 不一致\n - ${diffs.join('\n - ')}`);
  const hits = envelopeHits(sdkResult);
  assert.deepEqual(hits, [], `${label}: SDK 返回值含信封键（加了信封）：${hits.join(', ')}`);
}

/** HubError 的三字段核验（库面）。 */
function assertHubError(err, code, exitCode) {
  assert.equal(err.name, 'HubError', `应为 HubError：实测 ${err.name} / ${err.message}`);
  assert.equal(err.code, code, `错误码应为 ${code}：实测 ${err.code} / ${err.message}`);
  assert.equal(err.exitCode, exitCode, `退出码归类应为 ${exitCode}：实测 ${err.exitCode} / ${err.message}`);
}

/** 取拒绝值（成功即点名失败）。 */
async function captureReject(run) {
  try {
    await run();
  } catch (err) {
    return err;
  }
  assert.fail('预期调用被拒绝，实际成功返回');
}

/** 目录条目快照（不存在 → null；用于"零仓库运行态"的前后一致判定）。 */
function entriesOf(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null;
}

/** 层 B 的 `send` 入参：params = `{ message: <信封> }`（A6；信封的 `from` 不得自报，由 Router 代填）。 */
function envelope({ messageId, to }) {
  return {
    protocol: 'oamp/1',
    message_id: messageId,
    type: 'notice',
    to: { instance_id: to },
    payload: { content_type: 'text/plain', body: `ping ${to}` },
  };
}

// ────────────────────────────── T1 · 库面冒烟 ──────────────────────────────

test('库面冒烟：createHub() 经进程 env 的 OAMP_SOCKET 可达 Router（F03 验收 1 的可达性面）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  assert.deepEqual(Object.keys(hub).sort(), ['api', 'cli', 'doctor', 'uds'], 'createHub 应恰四个命名空间');
  const session = await hub.uds.connect();
  t.after(() => session.close());
  const snapshot = await session.status();
  assert.ok(Array.isArray(snapshot.nodes), `router.status 应返回 {nodes:[…]}：实测 ${fmt(snapshot)}`);
});

// ────────────────────────────── T2 · 8 方法 + 透传对照（F03 验收 1/2） ──────────────────────────────

test('层 B 8 方法各一例 + 与 RpcPeer 直连 result 的透传对照（F03 验收 1/2）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const oracle = await rawPeer(router.socketPath, 'oracle');
  t.after(() => oracle.close());
  const session = await hub.uds.connect();
  t.after(() => session.close());

  const rows = [];
  const record = (method, sdkResult, rawResult) => {
    rows.push({ method, sdk: keysOf(sdkResult), raw: keysOf(rawResult) });
  };

  // ① agent.register（身份绑定面：两条路径不共享实例 id）
  const sdkReg = await session.register('sdk-8-1');
  const rawReg = await oracle.peer.request('agent.register', { instance_id: 'raw-8-1' });
  assert.equal(sdkReg.state, 'online', `register 后应为 online：实测 ${fmt(sdkReg)}`);
  assertPassthrough('agent.register', sdkReg, rawReg);
  record('agent.register', sdkReg, rawReg);

  // ② agent.heartbeat（通知语义：两条路径均无 result）
  const sdkHeartbeat = session.heartbeat({ next_interval_ms: 10000 });
  const rawHeartbeat = oracle.peer.notify('agent.heartbeat', {
    instance_id: 'raw-8-1',
    session_id: rawReg.session_id,
    next_interval_ms: 10000,
  });
  assert.equal(sdkHeartbeat, undefined, 'heartbeat 应为通知语义（无 result）');
  assert.equal(rawHeartbeat, undefined, 'RpcPeer 直连的 heartbeat 同为通知（无 result）');
  await router.waitRouterLine(/HEARTBEAT instance=sdk-8-1\b/);
  await router.waitRouterLine(/HEARTBEAT instance=raw-8-1\b/);
  rows.push({ method: 'agent.heartbeat', notify: true });

  // ③ message.send（两条路径互为目标的投递；身份与 message_id 各自持有）
  const sdkSend = await session.send({ message: envelope({ messageId: 'msg-sdk-8-1', to: 'raw-8-1' }) });
  const rawSend = await oracle.peer.request('message.send', {
    message: envelope({ messageId: 'msg-raw-8-1', to: 'sdk-8-1' }),
  });
  assert.equal(sdkSend.status, 'delivered', `send 应投递成功：实测 ${fmt(sdkSend)}`);
  assert.equal(oracle.deliveries.length, 1, '假对端应收到一条投递（传输应答 ≠ 应用受理）');
  assert.equal(oracle.deliveries[0].message_id, 'msg-sdk-8-1');
  assertPassthrough('message.send', sdkSend, rawSend);
  record('message.send', sdkSend, rawSend);

  // ④ message.ack（各自受理自己收到的投递；`status` 为受理结论，Router 只接受 accepted / rejected）
  const sdkAck = await session.ack({ message_id: 'msg-raw-8-1', status: 'accepted' });
  const rawAck = await oracle.peer.request('message.ack', {
    message_id: 'msg-sdk-8-1',
    instance_id: 'raw-8-1',
    session_id: rawReg.session_id,
    status: 'accepted',
  });
  assert.equal(sdkAck.acked, true, `ack 应受理：实测 ${fmt(sdkAck)}`);
  assertPassthrough('message.ack', sdkAck, rawAck);
  record('message.ack', sdkAck, rawAck);

  // ⑤ router.status（可同参数面：除 last_heartbeat 外值级一致）
  const sdkStatus = await session.status();
  const rawStatus = await oracle.peer.request('router.status', {});
  assert.ok(
    sdkStatus.nodes.some((node) => node.instance_id === 'sdk-8-1'),
    `快照应含已注册实例：实测 ${fmt(sdkStatus)}`,
  );
  assertPassthrough('router.status', sdkStatus, rawStatus, SHARED_PARAM_VOLATILE);
  record('router.status', sdkStatus, rawStatus);

  // ⑥ router.task_get（可同参数面：未知 id → {task: null}）
  const sdkTask = await session.taskGet('task-absent-8-1');
  const rawTask = await oracle.peer.request('router.task_get', { task_id: 'task-absent-8-1' });
  assert.deepEqual(sdkTask, { task: null }, `未知任务应返回 {task:null}：实测 ${fmt(sdkTask)}`);
  assertPassthrough('router.task_get', sdkTask, rawTask, SHARED_PARAM_VOLATILE);
  record('router.task_get', sdkTask, rawTask);

  // ⑦ router.task_list（可同参数面：空查询 → {tasks: []}）
  const sdkTasks = await session.taskList({});
  const rawTasks = await oracle.peer.request('router.task_list', {});
  assert.deepEqual(sdkTasks, { tasks: [] }, `空任务表应返回 {tasks:[]}：实测 ${fmt(sdkTasks)}`);
  assertPassthrough('router.task_list', sdkTasks, rawTasks, SHARED_PARAM_VOLATILE);
  record('router.task_list', sdkTasks, rawTasks);

  // ⑧ agent.deregister
  const sdkDereg = await session.deregister();
  const rawDereg = await oracle.peer.request('agent.deregister', {
    instance_id: 'raw-8-1',
    session_id: rawReg.session_id,
  });
  assert.equal(sdkDereg.removed, true, `deregister 应删除条目：实测 ${fmt(sdkDereg)}`);
  assertPassthrough('agent.deregister', sdkDereg, rawDereg);
  record('agent.deregister', sdkDereg, rawDereg);

  // 8 行对照清单（MI-2）：由现算结果逐行输出（不手抄方法常量）
  assert.equal(rows.length, 8, `对照清单应恰 8 行（每方法一行）：实测 ${rows.length} 行 → ${rows.map((row) => row.method).join(', ')}`);
  for (const row of rows) {
    const shape = row.notify ? '无 result（notify 语义）' : `键集 [${row.sdk.join(', ')}] ⇄ 直连 [${row.raw.join(', ')}]`;
    t.diagnostic(`uds ${row.method}\t↔\tRpcPeer 直连 result ${shape}`);
  }
});

test('信封形态对照：send 的 params 嵌套（顶层信封 → INVALID_MESSAGE，两条路径同形）（A6）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const oracle = await rawPeer(router.socketPath, 'oracle');
  t.after(() => oracle.close());
  await oracle.peer.request('agent.register', { instance_id: 'shape-target' });
  const session = await hub.uds.connect();
  t.after(() => session.close());
  await session.register('shape-sender');

  // 正确形态：信封嵌在 params.message 下 → 投递成功
  const okSend = await session.send({ message: envelope({ messageId: 'msg-shape-ok', to: 'shape-target' }) });
  assert.equal(okSend.status, 'delivered', `嵌套形态应投递成功：实测 ${fmt(okSend)}`);

  // 错误形态：信封放在 params 顶层 → 两条路径同形失败（证 SDK 未做字段搬运 / 字段级"修正"）
  const sdkErr = await captureReject(() => session.send(envelope({ messageId: 'msg-shape-sdk', to: 'shape-target' })));
  const rawErr = await captureReject(() =>
    oracle.peer.request('message.send', envelope({ messageId: 'msg-shape-raw', to: 'shape-target' })),
  );
  assertHubError(sdkErr, 'INVALID_MESSAGE', 1);
  assert.equal(rawErr.dataCode, 'INVALID_MESSAGE', `直连顶层信封应得 INVALID_MESSAGE：实测 ${rawErr.dataCode} / ${rawErr.message}`);
});

test('层 B 边界样本：task_get / task_list / 二次 ack 的确定性错误面（A7）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const session = await hub.uds.connect();
  t.after(() => session.close());
  await session.register('edge-1');

  const badTask = await captureReject(() => session.taskGet('bad id with spaces'));
  assertHubError(badTask, 'INVALID_PARAMS', 1);
  assert.ok(badTask.upstream && Object.prototype.hasOwnProperty.call(badTask.upstream, 'error'), `upstream 应带 error 键：实测 ${fmt(badTask.upstream)}`);

  const badState = await captureReject(() => session.taskList({ state: '__probe__' }));
  assertHubError(badState, 'INVALID_PARAMS', 1);

  // 自投递 + 二次 ack：首次受理成功，第二次 UNKNOWN_MESSAGE（前一次受理是唯一一次）
  const sent = await session.send({ message: envelope({ messageId: 'msg-edge-1', to: 'edge-1' }) });
  assert.equal(sent.status, 'delivered', `自投递应成功：实测 ${fmt(sent)}`);
  const firstAck = await session.ack({ message_id: 'msg-edge-1', status: 'accepted' });
  assert.deepEqual(firstAck, { acked: true, status: 'accepted' });
  const secondAck = await captureReject(() => session.ack({ message_id: 'msg-edge-1' }));
  assertHubError(secondAck, 'UNKNOWN_MESSAGE', 1);
});

// ────────────────────────────── T3 · 库面注册闭环 + 拓扑侧可见（F03 验收 3） ──────────────────────────────

test('库面注册闭环：connect → register → heartbeat → send → ack → deregister → close（F03 验收 3）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const deliveries = [];
  const session = await hub.uds.connect({ onDeliver: (message) => deliveries.push(message) });
  t.after(() => session.close());

  // ① connect → register：拓扑侧可见上线
  const reg = await session.register('loop-1');
  assert.equal(reg.state, 'online');
  await router.waitRouterLine(/AGENT_REGISTERED instance=loop-1\b/);

  // ② heartbeat（单次方法；调度归调用方）
  assert.equal(session.heartbeat({ next_interval_ms: 10000 }), undefined);
  await router.waitRouterLine(/HEARTBEAT instance=loop-1\b/);

  // ③ send（自投递）：拓扑侧可见消息到达
  const sent = await session.send({ message: envelope({ messageId: 'msg-loop-1', to: 'loop-1' }) });
  assert.equal(sent.status, 'delivered');
  await router.waitRouterLine(/MESSAGE_DELIVERED message_id=msg-loop-1\b/);
  await waitFor(() => deliveries.length === 1, { what: `消息到达会话（socket=${router.socketPath}）` });
  assert.equal(deliveries[0].to.instance_id, 'loop-1', `to 应由 Router 代填为自身：实测 ${fmt(deliveries[0].to)}`);
  assert.equal(deliveries[0].from.instance_id, 'loop-1', `from 应由 Router 代填为发送者：实测 ${fmt(deliveries[0].from)}`);

  // 闭环中快照显示该实例在线
  const online = (await session.status()).nodes.find((node) => node.instance_id === 'loop-1');
  assert.ok(online && online.state === 'online', `闭环中快照应含 {loop-1: online}：实测 ${fmt(online)}`);

  // ④ ack：受理自己的投递
  const acked = await session.ack({ message_id: 'msg-loop-1', status: 'accepted' });
  assert.deepEqual(acked, { acked: true, status: 'accepted' });
  await router.waitRouterLine(/MESSAGE_ACKED message_id=msg-loop-1\b.*status=accepted/);

  // ⑤ deregister：拓扑侧可见下线，且快照不再含该实例
  const dereg = await session.deregister();
  assert.deepEqual(dereg, { removed: true });
  await router.waitRouterLine(/AGENT_DEREGISTERED instance=loop-1\b/);
  assert.equal(
    (await session.status()).nodes.some((node) => node.instance_id === 'loop-1'),
    false,
    '注销后快照不应含该实例',
  );

  // 顺序可核：四类事件行的行序单调（闭环结束前未出现 connection closed ⇒ 无提前断连）
  const eventLines = router.stdout.all();
  const lineIndex = (re) => eventLines.findIndex((line) => re.test(line));
  const at = {
    registered: lineIndex(/AGENT_REGISTERED instance=loop-1\b/),
    delivered: lineIndex(/MESSAGE_DELIVERED message_id=msg-loop-1\b/),
    acked: lineIndex(/MESSAGE_ACKED message_id=msg-loop-1\b/),
    deregistered: lineIndex(/AGENT_DEREGISTERED instance=loop-1\b/),
  };
  assert.ok(
    at.registered >= 0 && at.registered < at.delivered && at.delivered < at.acked && at.acked < at.deregistered,
    `拓扑事件行序应为 上线 → 到达 → 受理 → 下线：实测 ${fmt(at)}`,
  );

  // ⑥ close() 后观察窗内零新增事件行（无自动重连 / 自动重注册 / 自动心跳）
  const before = router.stdout.all().length;
  session.close();
  await SLEEP(SELF_CLOSE_WINDOW_MS);
  assert.equal(
    router.stdout.all().length,
    before,
    `close() 后 ${SELF_CLOSE_WINDOW_MS}ms 内出现新增事件行：${router.stdout.all().slice(before).join(' | ')}`,
  );
});

test('库面双方向投递 + 传输应答 ≠ 应用受理（无自动 ack）（F03 验收 3 / G02 验收 3）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const received = [];
  const session = await hub.uds.connect({ onDeliver: (message) => received.push(message) });
  t.after(() => session.close());
  await session.register('recv-1');

  const fake = await rawPeer(router.socketPath, 'fake');
  t.after(() => fake.close());
  await fake.peer.request('agent.register', { instance_id: 'fake-1' });

  const sent = await fake.peer.request('message.send', { message: envelope({ messageId: 'msg-fake-1', to: 'recv-1' }) });
  assert.equal(sent.status, 'delivered', '投递成功 = 传输应答已回（不是应用层受理）');
  await waitFor(() => received.length === 1, { what: '假对端投递到达会话' });
  assert.equal(received[0].to.instance_id, 'recv-1');
  assert.equal(received[0].from.instance_id, 'fake-1');

  // 未显式 ack 前 pending 仍在：显式 ack 成功（若 Router 自动 ack，此处必得 UNKNOWN_MESSAGE）
  const acked = await session.ack({ message_id: 'msg-fake-1', status: 'accepted' });
  assert.deepEqual(acked, { acked: true, status: 'accepted' }, '显式 ack 应受理（证 pending 未被自动受理）');
  // 二次 ack → UNKNOWN_MESSAGE：前一次受理是唯一一次
  const again = await captureReject(() => session.ack({ message_id: 'msg-fake-1' }));
  assertHubError(again, 'UNKNOWN_MESSAGE', 1);
});

// ────────────────────────────── T4 · shell 面闭环 + 双盘点面（F03 验收 3/4） ──────────────────────────────

test('shell 面零手写协议闭环 + 双拓扑盘点（F03 验收 3/4）', async (t) => {
  const router = await startRouterFor(t, { leaseMs: 20000 });
  const env = { OAMP_SOCKET: router.socketPath };
  const run = (args) => runHub(args, { env });
  const dbDir = tempDbDir();
  t.after(() => fs.rmSync(dbDir, { recursive: true, force: true }));
  const port = await pickFreePortInSegment();
  assert.ok(port >= PORT_SEGMENT.min && port <= PORT_SEGMENT.max, `web 端口须落在本 PR 段内：实测 ${port}`);
  await startWeb(t, { socketPath: router.socketPath, port, dbPath: path.join(dbDir, 'sql.db') });
  t.diagnostic(`本 PR 起 web 子进程的端口（段内运行时探测）= ${port}（本段 [${PORT_SEGMENT.min}, ${PORT_SEGMENT.max}]）`);

  const fake = await rawPeer(router.socketPath, 'fake');
  t.after(() => fake.close());
  await fake.peer.request('agent.register', { instance_id: 'fake-cli-1' });

  // ① agent.register（无 --as：条目在租约内保持 online）
  const reg = await run(['uds', 'agent.register', '--params', JSON.stringify({ instance_id: 'cli-reg-1' })]);
  assert.equal(reg.code, 0, `agent.register 应退出 0：实测 code=${reg.code}，stderr=${reg.stderr}`);
  assert.equal(JSON.parse(reg.stdout).state, 'online');
  await router.waitRouterLine(/AGENT_REGISTERED instance=cli-reg-1\b/);

  // ② 盘点面 1：hub uds router.status 含在线实例
  const statusCli = await run(['uds', 'router.status']);
  assert.equal(statusCli.code, 0, `router.status 应退出 0：实测 code=${statusCli.code}，stderr=${statusCli.stderr}`);
  const cliNode = JSON.parse(statusCli.stdout).nodes.find((node) => node.instance_id === 'cli-reg-1');
  assert.ok(cliNode && cliNode.state === 'online', `router.status 应含 {cli-reg-1: online}：实测 ${statusCli.stdout.trim()}`);

  // ③ 盘点面 2：hub api agents（web 子进程；端口取自段内探测）
  const agentsCli = await run(['api', 'agents', '--port', String(port), '--state', 'online']);
  assert.equal(agentsCli.code, 0, `api agents 应退出 0：实测 code=${agentsCli.code}，stderr=${agentsCli.stderr}，port=${port}`);
  assert.ok(
    JSON.parse(agentsCli.stdout).agents.some((agent) => agent.instance_id === 'cli-reg-1'),
    `api agents 应含 cli-reg-1：实测 ${agentsCli.stdout.trim()}`,
  );

  // ④ agent.heartbeat（--as：通知语义 ⇒ stdout null）
  const heartbeat = await run(['uds', 'agent.heartbeat', '--as', 'cli-hb-1', '--params', JSON.stringify({ next_interval_ms: 10000 })]);
  assert.equal(heartbeat.code, 0, `agent.heartbeat 应退出 0：实测 code=${heartbeat.code}，stderr=${heartbeat.stderr}`);
  assert.equal(heartbeat.stdout, 'null\n', `通知型方法应渲染 null：实测 ${fmt(heartbeat.stdout)}`);
  await router.waitRouterLine(/HEARTBEAT instance=cli-hb-1\b/);

  // ⑤ message.send（--as）→ 假对端 live 实例
  const messageId = 'msg-cli-1';
  const send = await run([
    'uds',
    'message.send',
    '--as',
    'cli-send-1',
    '--params',
    JSON.stringify({ message: envelope({ messageId, to: 'fake-cli-1' }) }),
  ]);
  assert.equal(send.code, 0, `message.send 应退出 0：实测 code=${send.code}，stderr=${send.stderr}`);
  assert.equal(JSON.parse(send.stdout).status, 'delivered', `shell 面投递应成功：实测 ${send.stdout.trim()}`);
  await waitFor(() => fake.deliveries.length === 1, { what: '假对端收到 shell 面投递' });

  // ⑥ message.ack（--as）样本 ①：对属另一会话的 pending → STALE_SESSION（A8 的结构性限制）
  // 登记（MI-8）：shell 面每次调用都是新会话，而 Router 的受理校验锚 `toSession` ⇒ shell 面的 ack
  //   成功路径结构性不可达；成功路径由库面用例（层 B 注册闭环 / 双方向投递两条）闭合。
  const stale = await run(['uds', 'message.ack', '--as', 'cli-ack-1', '--params', JSON.stringify({ message_id: messageId })]);
  assert.equal(stale.code, 1, `ack 失败应退出 1：实测 code=${stale.code}，stderr=${stale.stderr}`);
  const staleLines = stale.stderr.split('\n').filter((line) => line !== '');
  assert.equal(staleLines.length, 1, `失败面 stderr 应恰一行：实测 ${fmt(stale.stderr)}`);
  const staleBody = JSON.parse(staleLines[0]);
  assert.equal(staleBody.code, 'STALE_SESSION', `应归类为 STALE_SESSION：实测 ${fmt(staleBody)}`);
  assert.equal(staleBody.exit_code, 1);

  // 与 RpcPeer 直连同参数调用逐字一致（透传判据）
  const oracle = await rawPeer(router.socketPath, 'oracle');
  t.after(() => oracle.close());
  const oracleReg = await oracle.peer.request('agent.register', { instance_id: 'oracle-cli-1' });
  const rawStale = await captureReject(() =>
    oracle.peer.request('message.ack', { message_id: messageId, instance_id: 'oracle-cli-1', session_id: oracleReg.session_id }),
  );
  assert.equal(rawStale.dataCode, staleBody.code, `错误码应与直连一致：直连 ${rawStale.dataCode}，CLI ${staleBody.code}`);
  assert.equal(rawStale.message, staleBody.error, `错误文案应与直连一致：直连 ${rawStale.message}，CLI ${staleBody.error}`);

  // ⑦ message.ack（--as）样本 ②：从未投递过的 message_id → UNKNOWN_MESSAGE
  const unknown = await run(['uds', 'message.ack', '--as', 'cli-ack-1', '--params', JSON.stringify({ message_id: 'never-delivered-1' })]);
  assert.equal(unknown.code, 1, `未见过的 message_id 应退出 1：实测 code=${unknown.code}，stderr=${unknown.stderr}`);
  assert.equal(JSON.parse(unknown.stderr.trim()).code, 'UNKNOWN_MESSAGE');

  // ⑧ agent.deregister（--as）：先令实例在线，再注销 → 两面均不含
  const reg2 = await run(['uds', 'agent.register', '--params', JSON.stringify({ instance_id: 'cli-dereg-1' })]);
  assert.equal(reg2.code, 0, `agent.register 应退出 0：实测 code=${reg2.code}，stderr=${reg2.stderr}`);
  const beforeDereg = await run(['uds', 'router.status']);
  assert.ok(
    JSON.parse(beforeDereg.stdout).nodes.some((node) => node.instance_id === 'cli-dereg-1'),
    '注销前快照应含 cli-dereg-1',
  );
  const dereg = await run(['uds', 'agent.deregister', '--as', 'cli-dereg-1', '--params', '{}']);
  assert.equal(dereg.code, 0, `agent.deregister 应退出 0：实测 code=${dereg.code}，stderr=${dereg.stderr}`);
  assert.equal(JSON.parse(dereg.stdout).removed, true, `deregister 应回 {removed:true}：实测 ${dereg.stdout.trim()}`);

  const afterCli = await run(['uds', 'router.status']);
  assert.equal(
    JSON.parse(afterCli.stdout).nodes.some((node) => node.instance_id === 'cli-dereg-1'),
    false,
    `注销后 router.status 不应含 cli-dereg-1：实测 ${afterCli.stdout.trim()}`,
  );
  const afterAgents = await run(['api', 'agents', '--port', String(port), '--state', 'online']);
  assert.equal(
    JSON.parse(afterAgents.stdout).agents.some((agent) => agent.instance_id === 'cli-dereg-1'),
    false,
    `注销后 api agents 不应含 cli-dereg-1：实测 ${afterAgents.stdout.trim()}`,
  );
});

// ────────────────────────────── T5 · 不可达降级 + 连接上限的对照面（F08） ──────────────────────────────

test('CLI 面不可达降级：单一明确错误（无堆栈）+ 退出码 3 + 立即结束（F08 验收 1/2/3）', async (t) => {
  const deadDir = tempSocketDir();
  t.after(() => fs.rmSync(deadDir, { recursive: true, force: true }));
  const deadPath = path.join(deadDir, 'router.sock');
  assert.equal(fs.existsSync(deadPath), false, `死路径不应存在：${deadPath}`);

  const startedAt = Date.now();
  const result = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: deadPath } });
  const elapsedMs = Date.now() - startedAt;

  assert.notEqual(result.code, null, `hub 进程应自行结束（code=null 表示被超时强杀；socket=${deadPath}）`);
  assert.equal(result.code, 3, `不可达应退出 3：实测 code=${result.code}，stderr=${result.stderr}`);
  assert.equal(result.stdout, '', `失败面 stdout 应为空：实测 ${fmt(result.stdout)}`);
  const lines = result.stderr.split('\n').filter((line) => line !== '');
  assert.equal(lines.length, 1, `stderr 应恰一行 JSON：实测 ${lines.length} 行 → ${fmt(result.stderr)}`);
  const body = JSON.parse(lines[0]);
  assert.equal(body.code, 'HUB_UNREACHABLE', `应归类为 HUB_UNREACHABLE：实测 ${fmt(body)}`);
  assert.equal(body.exit_code, 3);
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.includes(deadPath), `错误文案应含目标 socket 路径（${deadPath}）：实测 ${body.error}`);
  assert.ok(body.error.includes('ENOENT'), `错误文案应含 ENOENT：实测 ${body.error}`);
  // 无堆栈只判渲染面（A13：库面 HubError 的 .stack 是设计属性）
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'stack'), false, `渲染结果不应含 stack 键：实测 ${fmt(body)}`);
  assert.equal(/\n\s+at\s/.test(result.stderr), false, `stderr 不应含栈帧行：实测 ${fmt(result.stderr)}`);
  assert.ok(elapsedMs < 1500, `不可达应"立即结束"：实测 ${elapsedMs}ms（socket=${deadPath}）`);
});

test('库面不可达：HubError HUB_UNREACHABLE / exitCode 3 / upstream null（F08 验收 4 的 UDS 面）', async (t) => {
  const deadDir = tempSocketDir();
  t.after(() => fs.rmSync(deadDir, { recursive: true, force: true }));
  const deadPath = path.join(deadDir, 'router.sock');
  useProcessSocket(t, deadPath);
  const hub = createHub();
  const err = await captureReject(() => hub.uds.connect());
  assertHubError(err, 'HUB_UNREACHABLE', 3);
  assert.equal(err.upstream, null, `连接层失败无上游对象：实测 ${fmt(err.upstream)}`);
  assert.ok(err.message.includes(deadPath), `文案应含目标 socket 路径（${deadPath}）：实测 ${err.message}`);
  // A13：库面错误对象**有** stack —— 不得断言其不存在
  assert.equal(typeof err.stack, 'string', '库面 HubError 应保留 stack（渲染面的"无堆栈"不作用于库面对象）');
});

test('连接上限 2000ms 的注入桩对照面（MI-4：不以真实等待为判据）', async (t) => {
  const observed = { calls: 0, opts: null, destroyed: 0 };
  const realConnect = net.connect;
  net.connect = (options) => {
    observed.calls += 1;
    observed.opts = options;
    const socket = new net.Socket();
    const realDestroy = socket.destroy.bind(socket);
    socket.destroy = (...args) => {
      observed.destroyed += 1;
      return realDestroy(...args);
    };
    setTimeout(() => socket.emit('timeout'), 20);
    return socket;
  };
  t.after(() => {
    net.connect = realConnect;
  });

  const hub = createHub({ socketPath: path.join(os.tmpdir(), 'oamp-sdk-uds-stub-never.sock') });
  const startedAt = Date.now();
  const err = await captureReject(() => hub.uds.connect());
  const elapsedMs = Date.now() - startedAt;

  assert.equal(observed.calls, 1, `连接尝试应恰一次：实测 ${observed.calls}`);
  assert.equal(observed.opts.timeout, CONNECT_LIMIT_MS, `net.connect 的 timeout 上限应为 ${CONNECT_LIMIT_MS}：实测 ${observed.opts.timeout}`);
  assertHubError(err, 'HUB_UNREACHABLE', 3);
  assert.ok(
    err.message.includes(`connect timeout (>${CONNECT_LIMIT_MS}ms)`),
    `超时文案应含 connect timeout (>${CONNECT_LIMIT_MS}ms)：实测 ${err.message}`,
  );
  assert.ok(observed.destroyed >= 1, '超时后应销毁 socket（无残留句柄）');
  assert.ok(elapsedMs < CONNECT_LIMIT_MS, `注入桩应即刻收敛（不依赖真实等待）：实测 ${elapsedMs}ms`);
});

test('连接上限只约束建立阶段：清零点可观测 + 空闲超上限后仍可调用（MI-4 / A15）', async (t) => {
  const router = await startRouterFor(t);
  useProcessSocket(t, router.socketPath);
  const recordedSetTimeouts = [];
  const realConnect = net.connect;
  net.connect = (...args) => {
    const socket = realConnect(...args);
    const realSetTimeout = socket.setTimeout.bind(socket);
    socket.setTimeout = (ms, ...rest) => {
      recordedSetTimeouts.push(ms);
      return realSetTimeout(ms, ...rest);
    };
    return socket;
  };
  t.after(() => {
    net.connect = realConnect;
  });

  const hub = createHub();
  const session = await hub.uds.connect();
  t.after(() => session.close());
  assert.ok(recordedSetTimeouts.length >= 1, `连通后应观察到 socket.setTimeout 调用：实测 ${fmt(recordedSetTimeouts)}`);
  assert.equal(
    recordedSetTimeouts[recordedSetTimeouts.length - 1],
    0,
    `连通后应清零超时（setTimeout(0)）：实测 ${fmt(recordedSetTimeouts)}`,
  );

  await SLEEP(CONNECT_LIMIT_MS + 400); // 空闲 2400ms > 2000ms 上限
  const snapshot = await session.status();
  assert.ok(
    Array.isArray(snapshot.nodes),
    `空闲 ${CONNECT_LIMIT_MS + 400}ms（> ${CONNECT_LIMIT_MS}ms）后调用仍应成功：实测 ${fmt(snapshot)}`,
  );
});

test('恢复后无需额外动作：死路径失败（3）→ 同一 Router 活 socket 成功（0）（F08 验收 5 的 UDS 面）', async (t) => {
  const router = await startRouterFor(t);
  const deadDir = tempSocketDir();
  t.after(() => fs.rmSync(deadDir, { recursive: true, force: true }));
  const deadPath = path.join(deadDir, 'router.sock');

  const failed = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: deadPath } });
  assert.equal(failed.code, 3, `死路径应退出 3：实测 code=${failed.code}，stderr=${failed.stderr}`);

  const recovered = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: router.socketPath } });
  assert.equal(recovered.code, 0, `同一 Router 的活 socket 应退出 0：实测 code=${recovered.code}，stderr=${recovered.stderr}`);
  assert.ok(Array.isArray(JSON.parse(recovered.stdout).nodes), `应取得完整快照：实测 ${recovered.stdout.trim()}`);
});

// ────────────────────────────── T6 · 无自动性 + 无跨调用状态 + 零运行态（G02 / F09） ──────────────────────────────

// T6 验收 3 的承接登记：无自动 ack 的判据面 = 上方库面双方向投递用例（未显式 ack 前 pending 仍在 + 二次 ack
//   得 UNKNOWN_MESSAGE），本任务不新增第二套观测。
test('无自动重试 / 自动重连：失败后调用计数不增长 + 进程已收口（G02 验收 3 / L2-9）', async (t) => {
  const observed = { calls: 0 };
  const realConnect = net.connect;
  net.connect = () => {
    observed.calls += 1;
    const socket = new net.Socket();
    setTimeout(() => socket.emit('timeout'), 20);
    return socket;
  };
  t.after(() => {
    net.connect = realConnect;
  });

  const hub = createHub({ socketPath: path.join(os.tmpdir(), 'oamp-sdk-uds-retry-never.sock') });
  const err = await captureReject(() => hub.uds.connect());
  assertHubError(err, 'HUB_UNREACHABLE', 3);
  assert.equal(observed.calls, 1, `拒绝前连接尝试应恰一次：实测 ${observed.calls}`);
  await SLEEP(OBSERVE_WINDOW_MS);
  assert.equal(observed.calls, 1, `观察窗 ${OBSERVE_WINDOW_MS}ms 内连接尝试应恒为 1（无自动重试 / 重连）：实测 ${observed.calls}`);

  const deadDir = tempSocketDir();
  t.after(() => fs.rmSync(deadDir, { recursive: true, force: true }));
  const result = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: path.join(deadDir, 'router.sock') } });
  assert.equal(result.code, 3, `不可达应退出 3：实测 code=${result.code}，stderr=${result.stderr}`);
  assert.equal(result.stdout, '', `失败面 stdout 应为空：实测 ${fmt(result.stdout)}`);
  assert.equal(result.stderr.split('\n').filter((line) => line !== '').length, 1, `失败面 stderr 应恰一行：实测 ${fmt(result.stderr)}`);
  assert.equal(/重试|重连/.test(result.stderr), false, `失败面不应出现重试 / 重连文案：实测 ${fmt(result.stderr)}`);
});

test('无自动心跳循环：短租约下 register 后不心跳 → offline 墓碑且不回到 online（A10）', async (t) => {
  const router = await startRouterFor(t, { leaseMs: SHORT_LEASE_MS });
  useProcessSocket(t, router.socketPath);
  const hub = createHub();
  const session = await hub.uds.connect();
  t.after(() => session.close());
  await session.register('nogone-1');

  // 租约到期：Router 判 offline（墓碑）并销毁该连接（无自动心跳 ⇒ 无续期）
  await router.waitRouterLine(new RegExp('AGENT_OFFLINE instance=nogone-1\\b'), { timeoutMs: 5000 });
  const tombstone = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: router.socketPath } });
  assert.equal(tombstone.code, 0, `router.status 应退出 0：实测 code=${tombstone.code}，stderr=${tombstone.stderr}`);
  const offline = JSON.parse(tombstone.stdout).nodes.find((node) => node.instance_id === 'nogone-1');
  assert.ok(offline, `墓碑应保留在快照中：实测 ${tombstone.stdout.trim()}`);
  assert.equal(offline.state, 'offline', `无心跳应被判 offline：实测 ${fmt(offline)}`);

  // 观察窗内不得回到 online（无自动重连 / 自动重注册）
  await SLEEP(OBSERVE_WINDOW_MS);
  const after = await runHub(['uds', 'router.status'], { env: { OAMP_SOCKET: router.socketPath } });
  const still = JSON.parse(after.stdout).nodes.find((node) => node.instance_id === 'nogone-1');
  assert.ok(still && still.state === 'offline', `观察窗内不应回到 online：实测 ${fmt(still)}`);

  // 连接已被 Router 销毁且未被自动重建：该会话后续调用失败
  const deadSession = await captureReject(() => session.status());
  assert.equal(deadSession.code, 'AGENT_OFFLINE', `连接销毁后调用应归类为 AGENT_OFFLINE：实测 ${deadSession.code} / ${deadSession.message}`);
});

test('无跨调用状态：四个互不相干进程的观测 + 两次独立只读调用（F09 验收 1/2/4）', async (t) => {
  const router = await startRouterFor(t, { leaseMs: 20000 });
  const env = { OAMP_SOCKET: router.socketPath };
  const run = (args) => runHub(args, { env });

  // ① 进程 A 注册 → 进程 B（互不相干）读到该实例
  const reg = await run(['uds', 'agent.register', '--params', JSON.stringify({ instance_id: 'xp-1' })]);
  assert.equal(reg.code, 0, `register 应退出 0：实测 code=${reg.code}，stderr=${reg.stderr}`);
  const seen = await run(['uds', 'router.status']);
  assert.ok(
    JSON.parse(seen.stdout).nodes.some((node) => node.instance_id === 'xp-1'),
    `另一进程应读到 xp-1（续查靠重调，不靠本地记忆）：实测 ${seen.stdout.trim()}`,
  );

  // ② 进程 C 注销 → 进程 D 读不到该实例（无本地快照复用）
  const dereg = await run(['uds', 'agent.deregister', '--as', 'xp-1', '--params', '{}']);
  assert.equal(dereg.code, 0, `deregister 应退出 0：实测 code=${dereg.code}，stderr=${dereg.stderr}`);
  const gone = await run(['uds', 'router.status']);
  assert.equal(
    JSON.parse(gone.stdout).nodes.some((node) => node.instance_id === 'xp-1'),
    false,
    `注销后另一进程不应读到 xp-1：实测 ${gone.stdout.trim()}`,
  );

  // ③ 注销后新会话 send（无身份）→ UNREGISTERED / 退出 1（服务端事实，无本地态伪装）
  const send = await run([
    'uds',
    'message.send',
    '--params',
    JSON.stringify({ message: envelope({ messageId: 'msg-xp-1', to: 'xp-1' }) }),
  ]);
  assert.equal(send.code, 1, `无身份 send 应退出 1：实测 code=${send.code}，stderr=${send.stderr}`);
  assert.equal(JSON.parse(send.stderr.trim()).code, 'UNREGISTERED');

  // ④ 同一只读命令在两个独立进程各跑一次 → 两次均为完整 JSON（各自独立取得结果）
  const first = await run(['uds', 'router.status']);
  const second = await run(['uds', 'router.status']);
  assert.equal(first.code, 0, `第一次只读调用应退出 0：实测 code=${first.code}，stderr=${first.stderr}`);
  assert.equal(second.code, 0, `第二次只读调用应退出 0：实测 code=${second.code}，stderr=${second.stderr}`);
  assert.deepEqual(JSON.parse(second.stdout), JSON.parse(first.stdout), '两次独立进程的只读输出应一致');
});

test('零仓库运行态：临时 socket 目录与包根 .runtime / data 前后一致（§10 测试基建约束）', async (t) => {
  const runtimeDir = path.join(OAMP_ROOT, '.runtime');
  const dataDir = path.join(OAMP_ROOT, 'data');
  const before = { runtime: entriesOf(runtimeDir), data: entriesOf(dataDir) };

  const router = await startRouterFor(t);
  const reg = await runHub(['uds', 'agent.register', '--params', JSON.stringify({ instance_id: 'temp-1' })], {
    env: { OAMP_SOCKET: router.socketPath },
  });
  assert.equal(reg.code, 0, `register 应退出 0：实测 code=${reg.code}，stderr=${reg.stderr}`);

  const socketDir = path.dirname(router.socketPath);
  assert.deepEqual(
    entriesOf(socketDir),
    ['router.sock'],
    `临时 socket 目录应只含 router.sock（无状态文件）：实测 ${fmt(entriesOf(socketDir))}（${socketDir}）`,
  );
  const after = { runtime: entriesOf(runtimeDir), data: entriesOf(dataDir) };
  assert.deepEqual(after, before, `仓库运行态目录在用例前后应一致：before=${fmt(before)}，after=${fmt(after)}`);
});

// ────────────────────────────── T7 · 收口：端口段 / 静态守门 / 拾取性 ──────────────────────────────

test('端口段可判：本 PR 段与兄弟段 / 既有占用段零交集，段内探测落在段内（C6 / A20）', async () => {
  assert.equal(PORT_SEGMENT.min, 52000, '本 PR 段下界应为 52000');
  assert.equal(PORT_SEGMENT.max, 52999, '本 PR 段上界应为 52999');
  const reservedRanges = [...SIBLING_SEGMENTS, [0, LEGACY_MAX_PORT]];
  for (const [low, high] of reservedRanges) {
    assert.ok(
      PORT_SEGMENT.max < low || PORT_SEGMENT.min > high,
      `本 PR 段 [${PORT_SEGMENT.min}, ${PORT_SEGMENT.max}] 与对照区间 [${low}, ${high}] 相交`,
    );
  }
  const probed = new Set();
  for (let i = 0; i < 3; i += 1) {
    const port = await pickFreePortInSegment();
    assert.ok(port >= PORT_SEGMENT.min && port <= PORT_SEGMENT.max, `段内探测结果须落在段内：实测 ${port}`);
    probed.add(port);
  }
  assert.ok(probed.size >= 1, `段内探测应产出可用端口：实测 ${fmt([...probed])}`);
});

test('零手写协议守门（静态，只扫本文件自身）+ hub 入口一律 runHub（T4 验收 4 / T1 验收 2）', () => {
  const source = fs.readFileSync(SELF_FILE, 'utf8');
  const lines = source.split('\n');
  const count = (needle) => source.split(needle).length - 1;
  // 被扫字面量一律拼接构造，规避扫描器命中自身的常量声明。
  const netConnect = 'net.' + 'connect(';
  const newPeer = 'new ' + 'RpcPeer(';
  const spawnCall = 'spawn' + '(';
  const createServerCall = 'net.' + 'createServer(';
  const frameReaderNeedle = 'read' + 'line';
  const socketWrite = 'socket.' + 'write(';
  const socketOn = 'socket.' + 'on(';
  const runHubCall = 'runHub' + '(';
  const directQueryHelper = 'query' + 'Status'; // 拓扑读取一律走 SDK 面 / 事件行（T1 验收 5）

  assert.equal(count(netConnect), 1, `net.connect 应恰 1 处（rawPeer 内）：实测 ${count(netConnect)}`);
  assert.equal(count(newPeer), 1, `new RpcPeer 应恰 1 处（rawPeer 内）：实测 ${count(newPeer)}`);
  assert.equal(count(frameReaderNeedle), 0, `不得引逐行读取器自建帧解码：实测 ${count(frameReaderNeedle)}`);
  assert.equal(count(socketWrite), 0, `不得手写帧编码：实测 ${count(socketWrite)}`);
  assert.equal(count(socketOn), 0, `不得自建 socket 数据监听：实测 ${count(socketOn)}`);
  assert.equal(count(directQueryHelper), 0, `拓扑读取不得用 harness 的直连查询辅助：实测 ${count(directQueryHelper)}`);
  assert.equal(count(createServerCall), 1, `net.createServer 只允许出现在端口探测内：实测 ${count(createServerCall)}`);

  const peerSpan = functionSpan(source, 'rawPeer');
  assert.ok(peerSpan, '未找到 rawPeer 辅助（socket 直连的唯一落点）');
  const portSpan = functionSpan(source, 'pickFreePortInSegment');
  assert.ok(portSpan, '未找到 pickFreePortInSegment 辅助（端口探测的唯一落点）');
  const webSpan = functionSpan(source, 'startWeb');
  assert.ok(webSpan, '未找到 startWeb 辅助（web 服务端子进程的唯一落点）');
  const inside = (span) => (needle) =>
    lines
      .map((line, index) => [line, index])
      .filter(([line]) => line.includes(needle))
      .every(([, index]) => index >= span.start && index <= span.end);

  assert.ok(inside(peerSpan)(netConnect) && inside(peerSpan)(newPeer), 'net.connect / new RpcPeer 都必须落在 rawPeer 内');
  assert.ok(inside(portSpan)(createServerCall), 'net.createServer 必须落在 pickFreePortInSegment 内');

  const spawnLines = lines.map((line, index) => [line, index]).filter(([line]) => line.includes(spawnCall)).map(([, index]) => index);
  assert.equal(spawnLines.length, 1, `子进程直起应恰 1 处：实测 ${spawnLines.length} 处（行 ${spawnLines.map((i) => i + 1).join(', ')}）`);
  assert.ok(inside(webSpan)(spawnCall), `直起子进程只允许出现在 startWeb 内：实测行 ${spawnLines.map((i) => i + 1).join(', ')}`);
  assert.equal(
    lines.slice(webSpan.start, webSpan.end + 1).join('\n').includes(runHubCall),
    false,
    'startWeb 内不得出现 hub 入口 runHub（hub 入口与 web 服务端不共函数）',
  );
  assert.ok(count(runHubCall) >= 5, `shell 面闭环应经 runHub：实测 ${count(runHubCall)} 处`);
});

test('零真实 omp / 零外网（静态）+ 拾取性：本文件落在 oamp/test/*.test.js（T7 验收 1/6）', () => {
  const source = fs.readFileSync(SELF_FILE, 'utf8');
  const count = (needle) => source.split(needle).length - 1;
  assert.equal(count('OAMP_OMP_' + 'BIN'), 0, '不得注入假 omp（用例不设该环境变量）');
  assert.equal(count('task.' + 'request'), 0, '不得派发任务请求');
  assert.equal(count('api/' + 'calls'), 0, '不得调用调用面端点');
  assert.equal(count('http' + '://'), 0, '零外部 host 字面量');
  assert.equal(count('https' + '://'), 0, '零外部 host 字面量');
  assert.equal(count('fetch' + '('), 0, '零外网请求');

  const relative = path.relative(OAMP_ROOT, SELF_FILE).split(path.sep).join('/');
  assert.equal(path.basename(SELF_FILE), 'sdk-uds.test.js', `文件名应为 sdk-uds.test.js：实测 ${path.basename(SELF_FILE)}`);
  assert.equal(path.dirname(SELF_FILE), path.join(OAMP_ROOT, 'test'), `应落在包内 test/ 目录：实测 ${path.dirname(SELF_FILE)}`);
  assert.ok(/^test\/[^/]+\.test\.js$/.test(relative), `应匹配既有拾取 glob test/*.test.js：实测 ${relative}`);
});

// ────────────────────────────── 静态守门的支撑原语 ──────────────────────────────

/**
 * 顶层函数块的扫掠区间（列 0 的 `function` 声明行 → 其后第一行列 0 的 `}`）。
 * 只用于"某字面量落在哪个函数内"的静态判定；判定对象是行区间，不锚行号（C7）。
 */
function functionSpan(source, name) {
  const lines = source.split('\n');
  const declaration = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = lines.findIndex((line) => declaration.test(line));
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') return { start, end: i };
  }
  return { start, end: lines.length - 1 };
}
