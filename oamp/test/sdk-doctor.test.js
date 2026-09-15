// test/sdk-doctor.test.js — pr-010：doctor 契约自检用例（F11 / G01 / F08）
// 载体：① 顶层 fixture = 真 Router（临时 socket）+ 真 `oamp web start`（本文件局部 startWeb；端口在段内运行
//   时探测）+ 临时 OAMP_DB；② 库面 `hub.doctor.check()`（经 sdk/index.js 的 createHub 装配）；③ CLI 面
//   `hub doctor`（经 test/helpers/hub-harness.js 的 runHub）。层 C 常驻命令不走 runHub（K3：显式收口）。
// 口径（architecture §5.5 / §10 T5）：R1 清单双向比对 / R2 只读可达性 / R3 方法存在性 —— 判据全部**现算**：
//   端点清单的唯一来源 = `API.md` §3 的解析结果（本文件不存第二份清单；末位守门用例机械核对）。
// 跨 PR 约束（pr-004 独立验收 §6 偏差 #1 / #2）：库面 doctor 的 R3 段只认**调用方进程 env** 的 socket 路径
//   （`createHub` 无 env 选项，其 connect 会话不给 socketPath / env）⇒ fixture 在进程 env 里设 OAMP_SOCKET、
//   after 原值还原；CLI 面则经 `runHub` 的 `env` 同时传 socket 与端口（doctor 不走 CLI 的端口选项面）。
// 零仓库运行态（§10 测试基建约束）：socket / 数据库 / 漂移副本一律落系统临时目录；仓库内 `API.md` 零触碰，
//   运行态目录（`.runtime` / `data`）的存在性与模块加载基线比较（末位守门用例）。
// 边界（非缺陷）：CLI 面不接受漂移注入口 ⇒ 漂移态只在库面以 check({ apiDocPath }) 闭合（主 agent 裁决）。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

import { startRouter, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { runHub } from './helpers/hub-harness.js';
import { createHub } from '../sdk/index.js';
import { ENTRIES } from '../sdk/surface.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根按本文件位置推导（不依赖 cwd）
const SELF_FILE = fileURLToPath(import.meta.url);
const API_DOC = path.join(OAMP_ROOT, 'API.md'); // 文档侧真源（只读；漂移只写临时副本）
const OAMP_BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');
const WEB_READY = 'WEB_READY';

// 端口段（主 agent 冻结：pr-010 独占 54000–54999；段是约束上界，实际值一律运行时探测）。
const PORT_MIN = 54000;
const PORT_MAX = 54999;
const USED_PORTS = new Set(); // 本文件取用过的全部端口（末位守门用例断言全部落在段内）

// 租约放长（harness 的 SHORT_ENV 把租约压到 300ms，会把按既有下限心跳的 web 判 offline ⇒ 快照抖动）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '5000' };

// 仓库运行态基线：模块加载时求值，早于任何子进程（末位守门用例比较；对"环境本来就有"不产生假失败）。
const RUNTIME_BASELINE = {
  runtime: existsSync(path.join(OAMP_ROOT, '.runtime')),
  data: existsSync(path.join(OAMP_ROOT, 'data')),
};

const FIXED_REPO_URL = 'https://example.com/oamp-sdk-doctor-fixture.git'; // 基线读数用的输入（不是端点面数据）
const DRIFT_SUFFIX = '__drift__'; // 漂移注入的固定后缀常量（靶点与断言值全部由解析结果 + 本常量现算）

const FIXTURE = { router: null, web: null, port: 0, dbDir: null, projectId: null };
let savedSocket; // 进程 env 的 OAMP_SOCKET 原值（可能为 undefined）

// ────────────────────────── 共享原语 ──────────────────────────

const memo = new Map();
/** 惰性一次（同一次运行内复用：一份报告 / 一个装配，不退化成"每次调用都起一遍"）。 */
function once(key, build) {
  if (!memo.has(key)) memo.set(key, build());
  return memo.get(key);
}

// ────────────────────────── 口径：端口段内探测（C11） ──────────────────────────

/** 端口是否空闲：临时监听成功即可用（连接失败即占用）。 */
function isFreePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => resolve(true)));
  });
}

/** 段内候选 → 探测空闲 → 记录并返回（**本文件唯一的取端口入口**：其余处一律消费其返回值）。 */
async function probeFreePort() {
  const span = PORT_MAX - PORT_MIN + 1;
  const start = PORT_MIN + Math.floor(Math.random() * span);
  for (let i = 0; i < span; i += 1) {
    const candidate = PORT_MIN + ((start - PORT_MIN + i) % span); // 段内回卷，不放宽到段外
    if (USED_PORTS.has(candidate)) continue;
    if (await isFreePort(candidate)) {
      USED_PORTS.add(candidate);
      return candidate;
    }
  }
  assert.fail(`端口段 ${PORT_MIN}-${PORT_MAX} 内无空闲端口（候选耗尽；不放宽到段外、不退回 listen(0)）`);
}

// ────────────────────────── 口径：hub fixture（真 Router + 真 web） ──────────────────────────

/** 起 `oamp web start` 子进程并等就绪行（harness 无 startWeb，本文件局部实现；常驻命令不走 runHub）。 */
function startWeb(socketPath, port, envExtra = {}) {
  const child = spawn(process.execPath, [OAMP_BIN, 'web', 'start', '--port', String(port)], {
    cwd: OAMP_ROOT,
    env: buildEnv(socketPath, { ...LEASE_ENV, ...envExtra }), // 临时 socket + 临时库 + 放长租约
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  let exit = null;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (err += chunk));
  child.once('exit', (code, signal) => {
    exit = { code, signal };
  });
  return waitFor(() => out.includes(WEB_READY) || exit !== null, { timeoutMs: 5000, what: 'web 就绪行' }).then(() => {
    if (exit !== null) throw new Error(`web 提前退出：${JSON.stringify(exit)}；stderr=${err}`);
    return {
      port,
      stderr: () => err,
      /** 收口：SIGINT → 限时等退出 → 超时 SIGKILL（不留后台进程 / 不占端口）。 */
      stop: async () => {
        if (exit !== null) return;
        child.kill('SIGINT');
        try {
          await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web SIGINT 后退出' });
        } catch {
          child.kill('SIGKILL');
          await waitFor(() => exit !== null, { timeoutMs: 2000, what: 'web SIGKILL 后退出' });
        }
      },
    };
  });
}

/** 一整套独立 fixture（真 Router + 真 web + 临时数据库目录）；起不来时自收口，不留后台进程。 */
async function startHubFixture() {
  const router = await startRouter({ envExtra: LEASE_ENV }); // 临时 socket 目录由 harness 管理
  const dbDir = mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-doctor-db-'));
  let web = null;
  try {
    const port = await probeFreePort();
    web = await startWeb(router.socketPath, port, { OAMP_DB: path.join(dbDir, 'sql.db') });
    return { router, web, port, dbDir };
  } catch (err) {
    if (web !== null) await web.stop();
    await stopAll([router]);
    rmSync(dbDir, { recursive: true, force: true });
    throw err;
  }
}

async function stopHubFixture(fixture) {
  if (fixture.web !== null && fixture.web !== undefined) await fixture.web.stop();
  if (fixture.router !== null && fixture.router !== undefined) await stopAll([fixture.router]); // stop + 删临时 socket 目录
  if (fixture.dbDir !== null && fixture.dbDir !== undefined) rmSync(fixture.dbDir, { recursive: true, force: true });
}

// ────────────────────────── 口径：文档侧解析（唯一清单来源） ──────────────────────────

// 区段限定（C7）：标题起、下一章标题止 —— 全文另有大量反引号签名，不限定区段会得到远超 21 条的结果。
const SECTION_START = '## 3. 接口清单（21 条）';
const SECTION_END_RE = /^## 4\. /;
// 行形态与 doctor 的文档侧解析同口径：编号表格行的「方法 + 反引号路径」单元格（路径含 /api/ 前缀）。
const ROW_RE = /^\|\s*(\d+)\s*\|\s*`(GET|POST)\s+(\/api\/[^`]*)`\s*\|\s*(.*?)\s*\|\s*$/;

/** 唯一文本读取入口（读不到即点名路径失败，不静默跳过）。 */
function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    assert.fail(`期望可读的 ${file}（未命中或不可读：${err.code || err.message}）`);
  }
}

/** 首个形态可疑行（行数异常时点名：行号 + 原文），供失败消息定位。 */
function firstSuspectLine(lines, start, end) {
  for (let i = start + 1; i < end; i += 1) {
    if (/^\|\s*\d+\s*\|/.test(lines[i]) && !ROW_RE.test(lines[i])) return `${i + 1}: ${lines[i].trim()}`;
  }
  return '（区段内无编号行形态的可疑行）';
}

/** 解析 §3 表区段 → [{ no, method, path, signature, usage }]（path / signature 均为文档侧原文）。 */
function parseApiSection(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === SECTION_START);
  assert.ok(start !== -1, `API.md 未命中 §3 标题字面量「${SECTION_START}」`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (SECTION_END_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  assert.ok(end < lines.length, 'API.md 未命中 §3 区段的终点字面量「## 4. 」');

  const rows = [];
  for (const line of lines.slice(start + 1, end)) {
    const m = ROW_RE.exec(line);
    if (m) rows.push({ no: Number(m[1]), method: m[2], path: m[3], signature: `${m[2]} ${m[3]}`, usage: m[4] });
  }
  assert.equal(rows.length, 21, `API.md §3 表区段应解析出 21 行，实际 ${rows.length} 行；首个可疑行 = ${firstSuspectLine(lines, start, end)}`);
  rows.forEach((row, i) => {
    assert.equal(row.no, i + 1, `API.md §3 的编号应 1..21 连续，第 ${i + 1} 项实际编号 ${row.no}`);
  });
  return rows;
}

const docRows = () => once('docRows', () => parseApiSection(readText(API_DOC)));

// ────────────────────────── 口径：库面 / CLI 面调用 ──────────────────────────

const hub = () => once('hub', () => createHub({ port: FIXTURE.port })); // 库面孔：端口显式给出（socket 走进程 env）
const baseReport = () => once('baseReport', () => hub().doctor.check()); // 共享 fixture 上的首次自检（未漂移态）

/** CLI 面的 env 增量：socket 与端口都只能经 env 传（doctor 不接受端口选项）。 */
function cliEnv(overrides = {}) {
  return { OAMP_SOCKET: FIXTURE.router.socketPath, OAMP_WEB_PORT: String(FIXTURE.port), ...overrides };
}

const cliDoctor = () => runHub(['doctor'], { env: cliEnv() });

/** hub 可观察状态的 5 元读数（零写副作用的行为证据面）。 */
async function hubReads(instance, projectId) {
  return {
    projects: await instance.api.projects.list(),
    chats: await instance.api.chats.list({ 'project-id': projectId }),
    agents: await instance.api.agents(),
    calls: await instance.api.calls.list(),
    confirmations: await instance.api.confirmations.list(),
  };
}

/** 注册表 / 任务表的**投影**（排除 last_heartbeat 等时序字段 —— web 常驻心跳会让它们抖动）。 */
async function registryProjection(instance, socketPath) {
  const session = await instance.uds.connect({ socketPath });
  try {
    const status = await session.status();
    const tasks = await session.taskList({});
    return {
      nodes: (status.nodes ?? []).map((n) => [n.instance_id, n.state]),
      tasks: (tasks.tasks ?? []).map((t) => [t.task_id, t.state]),
    };
  } finally {
    session.close();
  }
}

/** 逐项结论面（以 id 为键的 { ok, skipped, reason }；不对顺序做断言）。 */
function conclusionMap(items) {
  const map = new Map();
  for (const item of items) map.set(item.id, { ok: item.ok, skipped: item.skipped === true, reason: item.reason ?? null });
  return map;
}

function compareConclusions(a, b, what) {
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), `${what}：两次的 item id 集合应相同`);
  for (const key of a.keys()) assert.deepEqual(a.get(key), b.get(key), `${what}：${key} 的结论应逐项一致`);
}

/** stderr / stdout 的单行 JSON（F08 验收 1 的形态判据）。 */
function parseSingleLineJson(text, what) {
  const trimmed = text.trim();
  const lineCount = trimmed.split('\n').length;
  assert.equal(lineCount, 1, `${what} 应恰一行 JSON，实际 ${lineCount} 行：${trimmed.slice(0, 200)}`);
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    assert.fail(`${what} 应为可解析 JSON，实际 ${trimmed.slice(0, 200)}`);
  }
}

/** stdout 面可解析出的 items（不半跑判据：降级态不得留下半份清单）。 */
function parsedItems(text) {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed === null || typeof parsed !== 'object' ? undefined : parsed.items;
  } catch {
    return undefined;
  }
}

// ────────────────────────── fixture：顶层 before / after ──────────────────────────

before(async () => {
  savedSocket = process.env.OAMP_SOCKET; // 原值（含"原本不存在"的情形）
  const fixture = await startHubFixture();
  FIXTURE.router = fixture.router;
  FIXTURE.web = fixture.web;
  FIXTURE.port = fixture.port;
  FIXTURE.dbDir = fixture.dbDir;
  // 库面 doctor 的 R3 段只认调用方进程 env（createHub 无 env 选项）⇒ 在此设，after 原值还原。
  process.env.OAMP_SOCKET = fixture.router.socketPath;
  const created = await hub().api.projects.create({ 'repo-url': FIXED_REPO_URL }); // 非空基线（读数通道有效性）
  FIXTURE.projectId = created.project.project_id;
});

after(async () => {
  await stopHubFixture(FIXTURE);
  if (savedSocket === undefined) delete process.env.OAMP_SOCKET;
  else process.env.OAMP_SOCKET = savedSocket;
});

// ────────────────────────── T1 · 解析口径 + 正常态逐项依据 + 端点分类 ──────────────────────────

test('T1 · 文档侧解析：API.md §3 恰 21 行、编号连续（端点清单的唯一来源；C7）', () => {
  const rows = docRows();
  assert.equal(rows.length, 21, `§3 应恰 21 行，实际 ${rows.length} 行`);
  assert.equal(new Set(rows.map((row) => row.signature)).size, 21, '§3 的 21 条签名应互不相同');
  assert.equal(rows.filter((row) => row.method === 'POST').length, 8, '§3 的 POST 行数应为 8');
  assert.equal(rows.filter((row) => row.usage.includes('SSE')).length, 4, '§3 用途列含 SSE 的行数应为 4');
  assert.equal(rows.filter((row) => row.method === 'GET' && !row.usage.includes('SSE')).length, 9, '§3 的非流式 GET 行数应为 9');
});

test('T1 · 正常态（库面）：pass=true、items=50、每项含 id 与依据、无静默跳过（PR 验收 1）', async () => {
  const report = await baseReport();
  assert.equal(report.pass, true, `未漂移态应 pass，实际 ${report.pass}`);
  assert.equal(report.items.length, 50, `items 应为 21 + 21 + 8 = 50，实际 ${report.items.length}`);
  assert.ok(report.items.length > 0, 'items 不得为空');

  const findings = [];
  for (const item of report.items) {
    if (!/^R[123] /.test(String(item.id))) findings.push(`${item.id} → id 不是 R1/R2/R3 形态`);
    const empty = (v) => v === null || v === undefined || v === '';
    if (empty(item.expected) && empty(item.actual)) findings.push(`${item.id} → expected / actual 不得双双为空（只报总结果）`);
    if (item.skipped === true && empty(item.reason)) findings.push(`${item.id} → skipped 项必带非空 reason（无静默跳过）`);
    if (item.ok === false) findings.push(`${item.id} → 未漂移态不应有 fail 项`);
  }
  assert.deepEqual(findings, [], `逐项依据面应齐备：${findings.join('；')}`);
});

test('T1 · 21 条 R1 逐条对位 + 三段计数（对照清单输出，供与 API.md 逐行核对；PR 验收 1、6）', async (t) => {
  const report = await baseReport();
  const rows = docRows();
  const r1 = report.items.filter((item) => item.id.startsWith('R1 '));
  const r2 = report.items.filter((item) => item.id.startsWith('R2 '));
  const r3 = report.items.filter((item) => item.id.startsWith('R3 '));
  assert.equal(r1.length, 21, `R1 应恰 21 项，实际 ${r1.length} 项`);

  // 对位走 expected（文档侧原文），测试侧不复制 doctor 的路径归一化。
  const byExpected = new Map(r1.filter((item) => item.expected !== null).map((item) => [item.expected, item]));
  assert.equal(byExpected.size, 21, `R1 的 expected 应两两不同，实际 ${byExpected.size} 个`);
  const missing = rows.filter((row) => !byExpected.has(row.signature)).map((row) => row.signature);
  assert.deepEqual(missing, [], `R1 应逐条覆盖 §3 的每条签名（缺项即"登记缺失"被掩盖）：${missing.join(', ')}`);

  const findings = [];
  for (const row of rows) {
    const item = byExpected.get(row.signature);
    if (item.ok !== true) findings.push(`${row.signature} → ok=${item.ok}（actual=${item.actual}）`);
    if (typeof item.actual !== 'string' || item.actual.length === 0) findings.push(`${row.signature} → actual 为空`);
  }
  assert.deepEqual(findings, [], `21 条应逐条 pass 且给出实际值：${findings.join('；')}`);

  t.diagnostic(`R1（文档侧 ↔ 运行侧）逐条对照 —— 共 ${rows.length} 行`);
  for (const row of rows) {
    const item = byExpected.get(row.signature);
    t.diagnostic(`${item.id} | expected=${item.expected} | actual=${item.actual}`);
  }
  t.diagnostic(`三段计数：R1=${r1.length} R2=${r2.length} R3=${r3.length}；items=${report.items.length}`);
});

test('T1 · CLI 面正常态：单行 JSON 且逐项给依据；端口选项不在接受面（PR 验收 1）', async () => {
  const res = await cliDoctor();
  assert.equal(res.code, 0, `hub doctor 应退出 0（含结论由 stdout 承载），实际 ${res.code}；stderr=${res.stderr}`);
  const report = parseSingleLineJson(res.stdout, 'stdout');
  assert.equal(report.pass, true, `未漂移态应 pass，实际 ${report.pass}`);
  assert.equal(report.items.length, 50, `items 应为 50，实际 ${report.items.length}`);
  const noBasis = report.items.filter((item) => (item.expected ?? null) === null && (item.actual ?? null) === null);
  assert.deepEqual(noBasis, [], `CLI 面同样逐项给出依据（不出现只报总结果的形态）`);

  // 反例（钉住接受面）：端口只能经 env 传，多给一个 token 即用法错误 2。
  const bad = await runHub(['doctor', '--port', String(FIXTURE.port)], { env: cliEnv() });
  assert.equal(bad.code, 2, `doctor 不接受端口选项（应为用法错误 2），实际 ${bad.code}`);
  assert.equal(parseSingleLineJson(bad.stderr, 'stderr').code, 'USAGE', 'stderr 错误码应为 USAGE');
});

test('T1 · 端点分类全覆盖：R2 9 探 / 4 流式 skip / 8 写 skip，R3 恰 8 方法（PR 验收 6）', async () => {
  const report = await baseReport();
  const rows = docRows();
  const r2 = report.items.filter((item) => item.id.startsWith('R2 '));
  const r3 = report.items.filter((item) => item.id.startsWith('R3 '));

  // R2 与文档侧同数 ⇒ 双向零多出 / 零缺项。
  assert.equal(r2.length, rows.length, `R2 项数 ${r2.length} 应等于 §3 行数 ${rows.length}`);
  const writeSkip = r2.filter((item) => item.skipped === true && String(item.reason).includes('写端点'));
  const streamSkip = r2.filter((item) => item.skipped === true && String(item.reason).includes('流式'));
  const probed = r2.filter((item) => item.skipped !== true);
  assert.equal(writeSkip.length, rows.filter((row) => row.method === 'POST').length, `写端点 skip 数应为 ${rows.filter((row) => row.method === 'POST').length}`);
  assert.equal(streamSkip.length, rows.filter((row) => row.usage.includes('SSE')).length, `流式 skip 数应为 ${rows.filter((row) => row.usage.includes('SSE')).length}`);
  assert.equal(probed.length, 9, `实际探测的非流式 GET 项数应为 9，实际 ${probed.length}`);
  const silent = report.items.filter((item) => item.skipped === true && (item.reason === null || item.reason === undefined || item.reason === ''));
  assert.deepEqual(silent.map((item) => item.id), [], '凡 skip 必带非空理由（无静默跳过）');

  // R3 覆盖锁：8 个方法名取自已合并的入口表（层 B），不是第二份定义。
  const udsMethods = ENTRIES.filter((entry) => entry.layer === 'uds').map((entry) => `R3 ${entry.method}`);
  assert.deepEqual(r3.map((item) => item.id).sort(), [...udsMethods].sort(), `R3 应恰覆盖层 B 的 ${udsMethods.length} 个方法`);
});

// ────────────────────────── T2 · 漂移注入（临时副本） ──────────────────────────

test('T2 · 漂移注入（临时副本）：由 pass 转 fail、点名端点、R1 双向两方向（PR 验收 2、6、8）', async (t) => {
  const rows = docRows();
  const target = rows[0]; // 靶 = §3 首行（其路径无参数 ⇒ 归一前后同形，两向可逐字对位）
  assert.ok(!target.path.includes('<') && !target.path.includes('?'), `靶行应无路径参数，实际 ${target.signature}`);

  const docBefore = readText(API_DOC);
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'oamp-sdk-doctor-drift-'));
  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));
  const cleanCopy = path.join(tmpDir, 'API.md');
  writeFileSync(cleanCopy, docBefore); // 原文逐字副本（对照臂）
  assert.ok(path.resolve(cleanCopy).startsWith(path.resolve(os.tmpdir())), `副本应落系统临时目录，实际 ${cleanCopy}`);

  const injectedSignature = `${target.signature}${DRIFT_SUFFIX}`;
  const injectedText = docBefore.replace(`\`${target.signature}\``, `\`${injectedSignature}\``);
  assert.notEqual(injectedText, docBefore, '注入应改变副本文本（未命中靶行签名）');
  const injectedRows = parseApiSection(injectedText);
  assert.equal(injectedRows.length, rows.length, `注入不得增删行（应仍为 ${rows.length} 行，实际 ${injectedRows.length}）`);
  const changed = injectedRows.filter((row, i) => row.signature !== rows[i].signature).map((row) => row.signature);
  assert.deepEqual(changed, [injectedSignature], `注入应只改变靶行一个签名，实际改变：${changed.join(', ')}`);
  const injectedCopy = path.join(tmpDir, 'API-injected.md');
  writeFileSync(injectedCopy, injectedText);

  const clean = await hub().doctor.check({ apiDocPath: cleanCopy });
  assert.equal(clean.pass, true, '对照臂（原文副本）应仍 pass ⇒ 结论确实归因于注入本身');
  assert.equal(clean.items.length, 50, `对照臂的 items 应为 50，实际 ${clean.items.length}`);

  const drifted = await hub().doctor.check({ apiDocPath: injectedCopy });
  t.diagnostic(`注入后 pass=${drifted.pass} items=${drifted.items.length}`);
  assert.equal(drifted.pass, false, '注入路径漂移后应转 fail');

  const badR1 = drifted.items.filter((item) => item.id.startsWith('R1 ') && item.ok !== true);
  assert.equal(badR1.length, 2, `一次路径注入应同时命中两个方向（各恰一条），实际 ${badR1.length} 条：${JSON.stringify(badR1)}`);
  const missing = badR1.find((item) => item.expected === injectedSignature);
  const uncovered = badR1.find((item) => item.expected === null);
  assert.ok(missing !== undefined, `应有点名"文档有、运行无"的项（expected=${injectedSignature}）`);
  assert.equal(missing.id, `R1 ${injectedSignature}`, '登记缺失项的 id 应逐字对位注入后的签名');
  assert.equal(missing.actual, null, '登记缺失项的 actual 应为 null');
  assert.equal(missing.reason, '登记缺失', '登记缺失项的 reason 应为 登记缺失');
  assert.ok(uncovered !== undefined, '应有点名"运行有、文档无"的项（expected=null）');
  assert.equal(uncovered.id, `R1 ${target.signature}`, '文档未覆盖项的 id 应逐字对位靶的原始签名');
  assert.equal(uncovered.actual, target.signature, '文档未覆盖项的 actual 应为靶的运行侧原文');
  assert.equal(uncovered.reason, '文档未覆盖', '文档未覆盖项的 reason 应为 文档未覆盖');
  t.diagnostic(`${missing.id} | expected=${missing.expected} | actual=${missing.actual} | reason=${missing.reason}`);
  t.diagnostic(`${uncovered.id} | expected=${uncovered.expected} | actual=${uncovered.actual} | reason=${uncovered.reason}`);

  assert.equal(drifted.items.filter((item) => item.id.startsWith('R1 ') && item.ok === true).length, 20, '其余 20 条 R1 应仍 pass');
  const driftR2 = drifted.items.filter((item) => item.id.startsWith('R2 '));
  assert.equal(driftR2.length, 21, `R2 段不受清单漂移影响（应仍 21 项，实际 ${driftR2.length}）`);
  assert.equal(driftR2.filter((item) => item.skipped === true && String(item.reason).includes('写端点')).length, 8, 'R2 的 8 条写端点应仍 skip');
  assert.equal(driftR2.filter((item) => item.skipped === true && String(item.reason).includes('流式')).length, 4, 'R2 的 4 条流式应仍 skip');
  assert.equal(driftR2.filter((item) => item.skipped !== true).length, 9, 'R2 的 9 条应仍实际探测');

  assert.equal(readText(API_DOC), docBefore, '注入前后仓库内 API.md 应逐字不变（漂移只落临时副本）');
});

// ────────────────────────── T3 · 稳定性（同一状态连跑两次） ──────────────────────────

test('T3 · 稳定性：CLI 面连跑两次逐项结论一致（PR 验收 3）', async () => {
  const first = await cliDoctor();
  const second = await cliDoctor();
  assert.equal(first.code, 0, `第一次应退出 0，实际 ${first.code}；stderr=${first.stderr}`);
  assert.equal(second.code, 0, `第二次应退出 0，实际 ${second.code}；stderr=${second.stderr}`);
  const a = parseSingleLineJson(first.stdout, 'stdout');
  const b = parseSingleLineJson(second.stdout, 'stdout');
  assert.equal(a.pass, true, '未漂移态两次都应 pass');
  assert.equal(b.pass, true, '未漂移态两次都应 pass');
  assert.equal(a.items.length, b.items.length, `两次的 items 条数应相同（${a.items.length} vs ${b.items.length}）`);
  compareConclusions(conclusionMap(a.items), conclusionMap(b.items), 'CLI 面两次');
});

test('T3 · 稳定性：库面连跑两次逐项结论一致且无跨调用缓存（PR 验收 3）', async () => {
  const instance = hub();
  const a = await instance.doctor.check();
  const b = await instance.doctor.check();
  assert.equal(a.pass, true, '未漂移态两次都应 pass');
  assert.equal(b.pass, true, '未漂移态两次都应 pass');
  assert.equal(a.items.length, b.items.length, `两次的 items 条数应相同（${a.items.length} vs ${b.items.length}）`);
  compareConclusions(conclusionMap(a.items), conclusionMap(b.items), '库面两次');
  assert.notEqual(a.items, b.items, '两次 check 的 items 不应是同一引用（无跨调用状态）');
  assert.notEqual(a.items[0], b.items[0], '两次 check 的 item 不应是同一引用（无缓存）');
});

// ────────────────────────── T4 · 零写副作用 ──────────────────────────

test('T4 · 零写副作用（库面）：自检前后 5 元读数零新增（PR 验收 4 / MI-02）', async (t) => {
  const instance = hub();
  const before = await hubReads(instance, FIXTURE.projectId);
  assert.ok(before.projects.projects.length >= 1, '读数通道有效性：基线项目数应 ≥ 1（不是空对空的等价）');
  const report = await instance.doctor.check();
  assert.equal(report.pass, true, '自检应 pass（零副作用判据在健康态上取）');
  const after = await hubReads(instance, FIXTURE.projectId);
  t.diagnostic(
    `读数：projects=${before.projects.projects.length} chats=${before.chats.chats.length} agents=${before.agents.agents.length} calls=${before.calls.calls.length} confirmations=${before.confirmations.confirmations.length}`,
  );
  assert.deepEqual(after, before, '自检前后 hub 可观察状态应零新增（对话 / 调用 / 在途确认 / 拓扑 / 项目）');
});

test('T4 · 零写副作用（CLI 面）：自检前后 5 元读数零新增（PR 验收 4）', async () => {
  const instance = hub();
  const before = await hubReads(instance, FIXTURE.projectId);
  const res = await cliDoctor();
  assert.equal(res.code, 0, `CLI 自检应退出 0，实际 ${res.code}；stderr=${res.stderr}`);
  assert.equal(parseSingleLineJson(res.stdout, 'stdout').pass, true, 'CLI 自检应 pass');
  const after = await hubReads(instance, FIXTURE.projectId);
  assert.deepEqual(after, before, 'CLI 面自检前后 hub 可观察状态应零新增');
});

test('T4 · 零写副作用（结构证据）：8 条写端点与 4 条流式端点未被探测（PR 验收 4 / §5.5）', async () => {
  const report = await baseReport();
  const rows = docRows();
  const r2 = report.items.filter((item) => item.id.startsWith('R2 '));
  assert.equal(r2.filter((item) => item.skipped === true).length, rows.filter((row) => row.method === 'POST' || row.usage.includes('SSE')).length, 'skip 项数应等于写端点 + 流式端点之和');
  const writeSkip = r2.filter((item) => item.skipped === true && item.reason === '写端点不探，零写副作用');
  const streamSkip = r2.filter((item) => item.skipped === true && item.reason === '流式端点，不探（存在性由 R1 覆盖）');
  assert.equal(writeSkip.length, 8, `写端点 skip 应恰 8 条且理由逐字一致，实际 ${writeSkip.length} 条`);
  assert.equal(streamSkip.length, 4, `流式端点 skip 应恰 4 条且理由逐字一致，实际 ${streamSkip.length} 条`);
  assert.deepEqual(r2.filter((item) => item.skipped !== true).map((item) => item.ok), Array(9).fill(true), '其余 9 条应为实际探测且通过');
});

test('T4 · R3 探针零状态改变：注册表 / 任务表投影不变（PR 验收 5 / §9.3 A4）', async (t) => {
  const instance = hub();
  const before = await registryProjection(instance, FIXTURE.router.socketPath);
  const report = await instance.doctor.check();
  assert.equal(report.pass, true, '自检应 pass（探针零状态改变的判据在健康态上取）');
  const after = await registryProjection(instance, FIXTURE.router.socketPath);
  t.diagnostic(`投影：nodes ${before.nodes.length} → ${after.nodes.length}；tasks ${before.tasks.length} → ${after.tasks.length}`);
  assert.deepEqual(after, before, '8 个存在性探针执行前后，注册表 / 任务表投影应逐条一致（零新增节点 / 零新增任务）');
});

test('T4 · R3 探针集完整：层 B 的 8 个方法全覆盖且存在性判定全通过（PR 验收 5）', async () => {
  const report = await baseReport();
  const r3 = report.items.filter((item) => item.id.startsWith('R3 '));
  const udsMethods = ENTRIES.filter((entry) => entry.layer === 'uds').map((entry) => `R3 ${entry.method}`);
  assert.deepEqual(r3.map((item) => item.id).sort(), [...udsMethods].sort(), `R3 项集应等于层 B 的 8 个方法，实际 ${JSON.stringify(r3.map((item) => item.id))}`);
  const failed = r3.filter((item) => item.ok !== true).map((item) => `${item.id}（${item.actual}）`);
  assert.deepEqual(failed, [], `存在性判定应全部通过：${failed.join('；')}`);
});

// ────────────────────────── T5 · 不可达降级（F08） ──────────────────────────

test('T5 · 全不可达（CLI 面）：退出码 3 + 统一错误单行 JSON + 不半跑（PR 验收 7 / F08 验收 1、2）', async () => {
  const deadSocket = path.join(os.tmpdir(), `oamp-sdk-doctor-absent-${process.pid}`, 'router.sock'); // 系统临时目录下不存在
  const deadPort = await probeFreePort(); // 段内探测所得但不起任何服务 ⇒ 连接被拒是确定性事实
  const res = await runHub(['doctor'], { env: { OAMP_SOCKET: deadSocket, OAMP_WEB_PORT: String(deadPort) } });
  assert.equal(res.code, 3, `hub 不可达应退出 3，实际 ${res.code}；stderr=${res.stderr}`);
  const body = parseSingleLineJson(res.stderr, 'stderr');
  assert.equal(body.code, 'HUB_UNREACHABLE', `stderr 错误码应为 HUB_UNREACHABLE，实际 ${body.code}`);
  assert.equal(body.exit_code, 3, 'stderr 的 exit_code 应为 3');
  assert.equal(typeof body.error, 'string', 'error 应为字符串文案');
  assert.ok(body.error.trim().length > 0, 'error 应为非空文案');
  assert.ok(!body.error.includes('\n'), 'error 应为单行文案（不夹带换行）');
  assert.ok(!res.stderr.includes('\n    at '), 'stderr 不得输出堆栈');
  assert.equal(parsedItems(res.stdout), undefined, '不半跑：stdout 不得含可解析的 items');
});

test('T5 · 半可达（Router 停、web 在）：降级前可用，降级后退 3 且不输出半份（PR 验收 7）', async () => {
  const fixture = await startHubFixture(); // 独立 fixture，不污染共享 fixture
  try {
    const env = { OAMP_SOCKET: fixture.router.socketPath, OAMP_WEB_PORT: String(fixture.port) };
    const healthy = await runHub(['doctor'], { env });
    assert.equal(healthy.code, 0, `降级前应可用（对照臂），实际 ${healthy.code}；stderr=${healthy.stderr}`);
    assert.equal(parseSingleLineJson(healthy.stdout, 'stdout').pass, true, '降级前的对照臂应 pass');

    await stopAll([fixture.router]); // Router 停，web 仍在
    const degraded = await runHub(['doctor'], { env });
    assert.equal(degraded.code, 3, `半可达应降级为退出码 3，实际 ${degraded.code}；stderr=${degraded.stderr}`);
    const body = parseSingleLineJson(degraded.stderr, 'stderr');
    assert.equal(body.exit_code, 3, 'stderr 的 exit_code 应为 3（具体错误码不锁死：上游 502 与连接失败同属 3 类）');
    assert.equal(parsedItems(degraded.stdout), undefined, '不半跑：跑了一半也不输出半份清单');
  } finally {
    await stopHubFixture(fixture);
  }
});

test('T5 · 库面同判：不可达时 check() 拒绝且无部分 items（PR 验收 7）', async () => {
  const deadPort = await probeFreePort(); // 段内探测所得、未监听
  const instance = createHub({ port: deadPort });
  await assert.rejects(
    () => instance.doctor.check(),
    (err) => {
      assert.equal(err.code, 'HUB_UNREACHABLE', `错误码应为 HUB_UNREACHABLE，实际 ${err.code}`);
      assert.equal(err.exitCode, 3, 'exitCode 应与 CLI 面的进程码同源同值（3）');
      assert.equal(err.httpStatus, null, '库面本地错误不得带 http_status');
      assert.equal(err.upstream, null, '库面本地错误不得带 upstream');
      assert.ok(!('items' in err), '不半跑：错误对象上不得挂部分 items');
      return true;
    },
  );
});

// ────────────────────────── T6 · 收口守门 ──────────────────────────

const ALLOWED_IMPORTS = new Set([
  'node:test',
  'node:assert/strict',
  'node:fs',
  'node:os',
  'node:path',
  'node:url',
  'node:child_process',
  'node:net',
  './helpers/harness.js',
  './helpers/hub-harness.js',
  '../sdk/index.js',
  '../sdk/surface.js',
]);
// import 说明符的行形态：行首锚定，故不会命中本文件里写出的同一个正则字面量。
const IMPORT_LINE_RE = /^import\s.*'([^']+)';$/m;

/** 本用例自身的源文本（守门扫描对象；读不到即点名失败）。 */
function readSelfSource() {
  try {
    return readFileSync(SELF_FILE, 'utf8');
  } catch (err) {
    assert.fail(`期望可读的本用例文件 ${path.relative(OAMP_ROOT, SELF_FILE)}（不可读：${err.code || err.message}）`);
  }
}

/** 逐行剔除 `//` 之后的注释段（守门扫描口径）。 */
function stripLineComments(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

test('T6 · 零依赖守门：import 说明符仅落在白名单内（零 node:http/https/tls、零 src、零裸包名）', () => {
  const self = stripLineComments(readSelfSource());
  const specifiers = [...self.matchAll(new RegExp(IMPORT_LINE_RE.source, 'gm'))].map((m) => m[1]);
  assert.ok(specifiers.length > 0, '应能扫出 import 说明符（扫描口径失效即失败，不静默通过）');
  const offenders = specifiers.filter((specifier) => !ALLOWED_IMPORTS.has(specifier));
  assert.deepEqual(offenders, [], `import 说明符应仅落在白名单内，越界：${offenders.join(', ')}`);
});

test('T6 · 不引入第二份接口定义：§3 的每条签名路径在本用例源文本零命中（PR 验收 8 / G01 验收 5）', () => {
  // 主 agent 裁决：验收 2 的自扫描以"21 条签名零命中"为准（不引入零 `/api/` 字面量这一收紧形态）——
  // 本文件的行形态正则与 doctor 同口径地写出该前缀段，收紧形态会与"解析口径忠实于真源"冲突。
  const self = readSelfSource();
  const hits = docRows().filter((row) => self.includes(row.path)).map((row) => row.path);
  assert.deepEqual(hits, [], `本用例源文本不得出现任何 §3 端点路径（第二份清单），命中：${hits.join(', ')}`);
});

test('T6 · 仓库运行态零新增：.runtime / data 存在性与模块加载基线一致（§10 测试基建约束）', () => {
  const runtime = path.join(OAMP_ROOT, '.runtime');
  const data = path.join(OAMP_ROOT, 'data');
  assert.equal(existsSync(runtime), RUNTIME_BASELINE.runtime, `仓库内 ${runtime} 的存在性应与基线一致（本文件不写仓库运行态）`);
  assert.equal(existsSync(data), RUNTIME_BASELINE.data, `仓库内 ${data} 的存在性应与基线一致（本文件不写仓库运行态）`);
});

test('T6 · 端口段自证：本文件取用的端口全部落在段内且经探测取得（A18）', () => {
  const ports = [...USED_PORTS];
  assert.ok(ports.length >= 4, `本文件应记录每个用过的端口（共享 fixture + 独立 fixture + 两个未监听端口），实际 ${ports.length} 个`);
  const outside = ports.filter((port) => !(port >= PORT_MIN && port <= PORT_MAX));
  assert.deepEqual(outside, [], `端口应全部落在 ${PORT_MIN}-${PORT_MAX} 段内，越界：${outside.join(', ')}`);
  // 探测函数是唯一的取端口入口：本文件的监听动作恰一处（余下端口一律消费其返回值）。
  const listeners = (readSelfSource().match(/net\.createServer\(/g) ?? []).length;
  assert.equal(listeners, 1, `端口探测应是本文件唯一的监听入口（net.createServer 恰一处），实际 ${listeners} 处`);
});

test('T6 · 拾取性：本用例落在既有 scripts.test 的 test/*.test.js 内（PR 验收 10）', () => {
  const rel = path.relative(OAMP_ROOT, SELF_FILE).split(path.sep).join('/');
  assert.equal(rel, 'test/sdk-doctor.test.js', `本用例应位于 oamp/test/sdk-doctor.test.js，实际 ${rel}`);
  assert.ok(/^test\/[^/]+\.test\.js$/.test(rel), `本用例路径应落在既有 scripts.test 的 test/*.test.js glob 内，实际 ${rel}`);
});
