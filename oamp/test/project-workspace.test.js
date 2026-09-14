// test/project-workspace.test.js — 0017 pr-004：项目工作区（F01~F08 / F10）新能力验收断言
// 载体：真实 Router + `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）+ 本文件局部 fake ACP 桩
//       （OAMP_OMP_BIN 注入；FAKE_ACP_ARGS_LOG 记录 argv）+ startFakeNode 载荷捕获 + node:sqlite 直读。
// 归属：本文件是 0017 新能力断言的唯一落点——既有 22 个 test/*.test.js 零字节改动（architecture §8.1），
//       故此处自带同款 startWeb / fake ACP 辅助（不抽公共 helper、不改既有文件）。
// 前端断言是**文本级静态契约**（读 oamp/web/** 源码），不做运行期 DOM 断言。
// 不依赖真实 omp / 真实 LLM / 外网；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, waitFor, stopAll, buildEnv } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js';
import { PROFILES, buildArgv } from '../src/launcher.js';

// 协议与 argv 真源（pr-002 验收 2）：一次性路径的模式记号取自 src/launcher.js 的 profile 表，末位 argv 的口径经
// 同模块的 buildArgv 推导——本文件不复写期望数组、也不内置「默认就是 acp」的假设。协议注入见 setup 的 env 载体
// 注入键由 pr-001 的 src/config.js 交付。
const ACP_MODE = PROFILES['omp:acp'].modeArgs[0]; // 常驻链路模式记号
const ONESHOT_MODE = PROFILES['omp:oneshot'].modeArgs[0]; // 一次性路径模式记号

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');
const WEB_SRC = path.join(ROOT, 'src', 'web.js');
const PERSIST_SRC = path.join(ROOT, 'src', 'persist.js');
const INDEX_HTML = path.join(ROOT, 'web', 'index.html');
const APP_JS = path.join(ROOT, 'web', 'app.js');
const STYLE_CSS = path.join(ROOT, 'web', 'style.css');
const LLMS_SNAPSHOT = path.join(ROOT, 'llms.txt');
const API_MD = path.join(ROOT, 'API.md');

// —— fake omp：同一脚本两种形态（`acp` 常驻 JSON-RPC / `-p` 一次式），零真实 LLM ——
// 观测面：FAKE_ACP_ARGS_LOG（启动参数集，含一次性路径的末位 prompt）+ 常驻形态的 `收到：<prompt>` 回显。
// 方法面覆盖 web/agent 实际调用：initialize / session/new / session/set_config_option / session/prompt
// （set_config_option 与 per-session 记忆是 model 审计链与「首轮注入一次」用例的观测前提）。
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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let sessionSeq = 0;
const sessions = new Map(); // sessionId -> { model, texts }（per-session 记忆）
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
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    return;
  }
  if (msg.method === 'session/new') {
    sessionSeq += 1;
    const sessionId = 'sess-' + sessionSeq;
    sessions.set(sessionId, { model: 'fake/model', texts: [] });
    send({ jsonrpc: '2.0', id: msg.id, result: { sessionId, configOptions: configOptions('fake/model') } });
    return;
  }
  if (msg.method === 'session/set_config_option') {
    const session = sessions.get(msg.params.sessionId);
    if (session) session.model = msg.params.value;
    send({ jsonrpc: '2.0', id: msg.id, result: { configOptions: configOptions(msg.params.value) } });
    return;
  }
  if (msg.method === 'session/prompt') {
    const session = sessions.get(msg.params.sessionId);
    if (!session) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'unknown session' } });
      return;
    }
    const text = (msg.params.prompt && msg.params.prompt[0] && msg.params.prompt[0].text) || '';
    session.texts.push(text);
    const answer = '收到：' + text;
    for (const part of [answer.slice(0, 1), answer.slice(1, 2), answer.slice(2)]) {
      if (part === '') continue;
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: { sessionId: msg.params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } },
      });
      await delay(5);
    }
    send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } } });
    return;
  }
});
`;

const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-project-ws-fake-'));
const FAKE_BIN = path.join(FAKE_DIR, 'fake-acp.cjs');
fs.writeFileSync(FAKE_BIN, FAKE_ACP_SOURCE, { mode: 0o755 });
process.on('exit', () => {
  try {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

function pickPort() {
  return 41000 + Math.floor(Math.random() * 2000);
}

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），而 harness SHORT_ENV 的 300ms 租约会让它被判 offline
// → Router 对 task.update/result 只记录不投递。本文件统一放长租约（与 web.test.js 同口径）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

/** 起 `oamp web start` 子进程；句柄暴露 stdout()（`DB_REBUILT path=…` 告知行落在 stdout，architecture §10.3 D-02）。 */
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
    socketPath,
    getExit: () => exit,
    stdout: () => out,
    stderr: () => err,
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

async function jget(base, p) {
  const res = await fetch(`${base}${p}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function jpost(base, p, payload) {
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** 原文请求体（不经 JSON.stringify）：用于 readBody 的畸形 JSON 400 路径。 */
async function jraw(base, p, text) {
  const res = await fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const detailOf = async (web, chatId) => (await jget(web.base, `/api/chats/${encodeURIComponent(chatId)}`)).body;

/** SSE 客户端：fetch + reader 手工解析 `data:` 帧（零依赖；headers 返回即视为订阅已注册）。 */
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
  return { events, close: () => ac.abort(), pump };
}

/** 起真实 Router + （可选）真实 agent 子进程 + web（临时 OAMP_DB）；不预建项目（各断言块按需经 projectFixture 建）。 */
async function setup(t, { withAgent = true, agentId = 'dev-1', env = {}, webEnv = {} } = {}) {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  if (withAgent) {
    const agent = await startAgent(agentId, { socketPath: router.socketPath, envExtra: { OAMP_PROTOCOL: 'acp', OAMP_OMP_BIN: FAKE_BIN, ...env } });
    t.after(() => agent.stop());
    await agent.waitAgentLine(new RegExp(`REGISTERED instance=${agentId}`));
  }
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-project-ws-'));
  t.after(() => {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });
  const dbPath = path.join(dbDir, 'sql.db');
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath, ...webEnv });
  t.after(() => web.stop());
  return { router, web, dbPath, dbDir };
}

/** 建项目 fixture（经真实 HTTP 往返）；返回 project_id。 */
async function projectFixture(web, repoUrl, name) {
  const sent = await jpost(web.base, '/api/projects', name === undefined ? { repo_url: repoUrl } : { repo_url: repoUrl, name });
  assert.equal(sent.status, 200, `建项目应成功: ${JSON.stringify(sent.body)}`);
  return sent.body.project.project_id;
}

/** 发一条消息并等该 chat 落终态（第 rounds 轮的 in/out 记录齐备），返回 { chatId, taskId, detail }。 */
async function sendAndWait(web, payload, { rounds = 1, timeoutMs = 8000 } = {}) {
  const sent = await jpost(web.base, '/api/messages', payload);
  assert.equal(sent.status, 200, `发送应成功: ${JSON.stringify(sent.body)}`);
  const chatId = sent.body.chat_id;
  const detail = await waitFor(
    async () => {
      const body = await detailOf(web, chatId);
      if (!body || !body.messages || body.chat.state === 'working') return null;
      const ins = body.messages.filter((m) => m.direction === 'in').length;
      const outs = body.messages.filter((m) => m.direction === 'out').length;
      return ins >= rounds && outs >= rounds ? body : null;
    },
    { timeoutMs, what: `chat ${chatId} 第 ${rounds} 轮落 out 记录` },
  );
  return { chatId, taskId: sent.body.task_id, detail };
}

/** 注册一个假目标 agent 并投一条消息，返回捕获到的 `task.request` 信封（取自 node.received）。 */
async function captureTask(web, payload, { agentId = 'dev-1' } = {}) {
  const node = await startFakeNode({ socketPath: web.socketPath, instanceId: agentId, heartbeatMs: 500 });
  try {
    const sent = await jpost(web.base, '/api/messages', { agent_id: agentId, ...payload });
    assert.equal(sent.status, 200, `派发应成功: ${JSON.stringify(sent.body)}`);
    return await waitFor(() => node.received.find((m) => m.type === 'task.request') || null, {
      timeoutMs: 5000,
      what: '假目标 agent 收到 task.request',
    });
  } finally {
    await node.stop();
  }
}

/** 直读临时库（独立连接；打开外键以核对结构面约束真实生效）。 */
function openRaw(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

const countOf = (db, sql, ...params) => db.prepare(sql).get(...params).n;

/** 工作约定文本唯一真源（architecture §4.3）：`src/web.js` 的模块级常量 `PROJECT_AGREEMENT`。
 *  该常量未具名导出 ⇒ 从源码抽取其字面量（不复制第二份文本；抽取失败即红）。 */
function readProjectAgreement() {
  const found = /const PROJECT_AGREEMENT =\s*'([^']*)'/.exec(fs.readFileSync(WEB_SRC, 'utf8'));
  assert.ok(found, 'src/web.js 应含 `const PROJECT_AGREEMENT = \'…\'`（约定文本唯一真源）');
  return found[1];
}

const AGREEMENT = readProjectAgreement();

/** 注入块期望值（与 src/agent.js 的 renderProjectContext 同模板）：逐字拼接，不做子串匹配。 */
const renderExpected = (project) =>
  `【项目上下文】\n- 项目名：${project.name}\n- 仓库地址：${project.repo_url}\n- 工作约定：${AGREEMENT}`;

/** 抽取顶层函数体（app.js 顶层函数以列 0 的 `}` 收尾）；函数不在场即红。 */
function functionBody(src, name) {
  const found = new RegExp(`\\n(?:async )?function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(src);
  assert.ok(found, `web/app.js 应含顶层函数 ${name}`);
  return found[1];
}
// ────────────────────────── F01 项目实体：创建 / 列出 / 派生 / 四要素 ──────────────────────────

test('F01：创建 → 列出往返 + 四要素 + 派生名（省略 / 空 / 空白 / 非字符串 / 派生为空）', async (t) => {
  const { web, dbPath } = await setup(t, { withAgent: false });

  const repo = 'https://github.com/acme/demo.git';
  const created = await jpost(web.base, '/api/projects', { repo_url: repo });
  assert.equal(created.status, 200);
  assert.deepEqual(Object.keys(created.body), ['project']);
  const project = created.body.project;
  assert.match(project.project_id, /^prj-[0-9a-f-]{36}$/, 'project_id 应为 prj-<uuid>');
  assert.equal(project.name, 'demo', '派生 = 地址去尾部斜杠取尾段、再去尾部 .git');
  assert.equal(project.repo_url, repo, '地址逐字回显');
  assert.ok(Number.isInteger(project.created_at) && project.created_at > 0, 'created_at 为整数 epoch ms');
  assert.deepEqual(Object.keys(project).sort(), ['created_at', 'name', 'project_id', 'repo_url'], '创建响应恰四要素');

  // 派生边界：四种形态（省略 / '' / 空白 / 非字符串）都走同一派生规则；repo_url 各不相同以避开 UNIQUE(repo_url)
  const deriveCases = [
    ['https://github.com/acme2/demo.git', undefined],
    ['https://github.com/acme3/demo.git', ''],
    ['https://github.com/acme4/demo.git', '   '],
    ['https://github.com/acme5/demo.git', 123],
  ];
  for (const [url, name] of deriveCases) {
    const r = await jpost(web.base, '/api/projects', name === undefined ? { repo_url: url } : { repo_url: url, name });
    assert.equal(r.status, 200, `name=${JSON.stringify(name)} 应可创建: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.project.name, 'demo', `name=${JSON.stringify(name)} 应派生为 demo`);
  }

  // 派生结果为空 ⇒ 兜底用地址原文（NOT NULL 列非空）
  const emptyDerived = await jpost(web.base, '/api/projects', { repo_url: '.git' });
  assert.equal(emptyDerived.status, 200);
  assert.equal(emptyDerived.body.project.name, '.git', '派生为空 ⇒ 用地址原文兜底');

  // 列出往返：响应键集合恰 {projects}；行内四要素 + 两个派生列（新项目无对话 ⇒ 0 / null）
  const list = await jget(web.base, '/api/projects');
  assert.equal(list.status, 200);
  assert.deepEqual(Object.keys(list.body), ['projects']);
  const row = list.body.projects.find((p) => p.project_id === project.project_id);
  assert.ok(row, '新建项目应出现在列表里');
  assert.deepEqual(Object.keys(row).sort(), ['chat_count', 'created_at', 'last_activity_at', 'name', 'project_id', 'repo_url']);
  assert.equal(row.chat_count, 0);
  assert.equal(row.last_activity_at, null, '无对话 ⇒ null（不是 0、不是缺键）');

  // 库面无路径类字段（也不被推断或存储）
  const db = openRaw(dbPath);
  try {
    const cols = db.prepare("SELECT name FROM pragma_table_info('projects')").all().map((r) => r.name);
    assert.deepEqual(cols, ['project_id', 'name', 'repo_url', 'created_at'], '库面无路径类字段');
    assert.deepEqual({ ...db.prepare('SELECT name, repo_url FROM projects WHERE project_id = ?').get(project.project_id) }, {
      name: 'demo',
      repo_url: repo,
    });
  } finally {
    db.close();
  }
});

test('F01：不归一化 / 不校验形态与可达性 / 必填 400 / 重复 409 / 排序 / 无分页参数', async (t) => {
  const { web, dbPath } = await setup(t, { withAgent: false });

  // 不归一化：尾 `.git` 与无 `.git` 是两个不同项目；库内值 = 入参 trim 后原样
  const pair = ['https://github.com/acme/demo', 'https://github.com/acme/demo.git'];
  for (const url of pair) {
    const r = await jpost(web.base, '/api/projects', { repo_url: url });
    assert.equal(r.status, 200, `${url} 应可创建`);
  }
  assert.equal((await jget(web.base, '/api/projects')).body.projects.length, 2, '两种地址形态不被判等价');

  // 不校验形态 / 域名 / 可达性（本桩环境零外网，成功即证无网络依赖）
  for (const url of ['not-a-url', 'git@example.internal:x.git']) {
    const r = await jpost(web.base, '/api/projects', { repo_url: url });
    assert.equal(r.status, 200, `${url} 应可创建（不校验形态 / 域名 / 可达性）`);
  }
  const db = openRaw(dbPath);
  try {
    assert.deepEqual(
      db.prepare('SELECT repo_url FROM projects ORDER BY repo_url').all().map((r) => r.repo_url),
      [...pair, 'git@example.internal:x.git', 'not-a-url'].sort(),
      '库内地址与入参逐字相等（不归一化 .git / 尾斜杠 / 大小写 / SSH↔HTTPS）',
    );
  } finally {
    db.close();
  }

  // 必填：缺失 / '' / 空白 / 非字符串 → 400 + 文案逐字 + 项目条数不变
  const before = (await jget(web.base, '/api/projects')).body.projects.length;
  for (const body of [{}, { repo_url: '' }, { repo_url: '   ' }, { repo_url: 123 }]) {
    const r = await jpost(web.base, '/api/projects', body);
    assert.equal(r.status, 400, `${JSON.stringify(body)} 应 400`);
    assert.equal(r.body.code, 'INVALID_PARAM');
    assert.equal(r.body.error, '需要 repo_url（非空字符串）');
  }
  assert.equal((await jget(web.base, '/api/projects')).body.projects.length, before, '非法入参不产生项目');

  // 去重：唯一键 = trim 后原样地址；重复 → 409 CONFLICT（不解析 SQLite 错误文案）
  const dupe = await jpost(web.base, '/api/projects', { repo_url: '  https://github.com/acme/dupe.git  ' });
  assert.equal(dupe.status, 200, '地址两侧空白被 trim 后原样入库');
  const again = await jpost(web.base, '/api/projects', { repo_url: 'https://github.com/acme/dupe.git' });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'CONFLICT');
  assert.equal(again.body.error, '项目已存在: https://github.com/acme/dupe.git');

  // 排序：created_at DESC, project_id DESC
  const rows = (await jget(web.base, '/api/projects')).body.projects;
  assert.equal(rows.length, before + 1, '重复创建不新增项目');
  for (let i = 1; i < rows.length; i += 1) {
    const a = rows[i - 1];
    const b = rows[i];
    assert.ok(
      a.created_at > b.created_at || (a.created_at === b.created_at && a.project_id > b.project_id),
      `排序应为 created_at DESC, project_id DESC：${a.project_id} → ${b.project_id}`,
    );
  }

  // 无分页参数：带 ?limit=1 仍全量返回，响应不含 total / limit / offset
  const limited = await jget(web.base, '/api/projects?limit=1');
  assert.equal(limited.body.projects.length, rows.length, '不新增分页能力');
  assert.deepEqual(Object.keys(limited.body), ['projects']);
});

test('F01：派生列（chat_count 含全部 / last_activity_at = MAX(updated_at)，sqlite 对拍）', async (t) => {
  const { web, dbPath } = await setup(t);
  const projectA = await projectFixture(web, 'https://example.com/f01-derived-a.git');
  const projectB = await projectFixture(web, 'https://example.com/f01-derived-b.git');

  const first = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '派生列一号' });
  const second = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '派生列二号' });
  await jpost(web.base, `/api/chats/${encodeURIComponent(second.chatId)}/close`, {});
  const archived = await jpost(web.base, '/api/chats/archive', {});
  assert.equal(archived.body.archived, 2, '已完成与已关闭两条都可归档');
  assert.ok(Number.isInteger((await detailOf(web, second.chatId)).chat.archived_at), '已关闭 → 已归档');

  const rows = (await jget(web.base, '/api/projects')).body.projects;
  const rowA = rows.find((p) => p.project_id === projectA);
  const rowB = rows.find((p) => p.project_id === projectB);
  const db = openRaw(dbPath);
  try {
    assert.equal(rowA.chat_count, 2, 'chat_count 含已归档 / 已关闭');
    assert.equal(rowA.chat_count, countOf(db, 'SELECT COUNT(*) AS n FROM chats WHERE project_id = ?', projectA));
    assert.equal(
      rowA.last_activity_at,
      db.prepare('SELECT MAX(updated_at) AS m FROM chats WHERE project_id = ?').get(projectA).m,
      'last_activity_at 与直读 MAX(updated_at) 逐位相等',
    );
    assert.equal(rowB.chat_count, 0, '不串项目');
    assert.equal(rowB.last_activity_at, null);
    assert.deepEqual({ ...db.prepare('SELECT name, repo_url FROM projects WHERE project_id = ?').get(projectB) }, {
      name: 'f01-derived-b',
      repo_url: 'https://example.com/f01-derived-b.git',
    });
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM chats WHERE project_id = ?', projectB), 0);
    assert.ok(first.chatId, '第一条对话仍在库内（不因归档消失）');
  } finally {
    db.close();
  }
});
// ────────────────────────── F02 新建对话必须归属项目（API 层强制 + 数据层结构面） ──────────────────────────

test('F02：新建路径缺 / 空 / 非字符串 / 未知项目 → 400 + 对话总数不变（空项目库）', async (t) => {
  const { web, dbPath } = await setup(t, { withAgent: false });
  const db = openRaw(dbPath);
  const counts = () => ({
    chats: countOf(db, 'SELECT COUNT(*) AS n FROM chats'),
    messages: countOf(db, 'SELECT COUNT(*) AS n FROM messages'),
  });
  const chatId = 'chat-f02-rejected';
  const sse = await openSse(web.base, chatId);
  try {
    assert.deepEqual(counts(), { chats: 0, messages: 0 }, '前置：空项目库');

    // ① 缺 project_id（不带 chat_id 的新建式请求）→ 400 + 文案逐字 + 不产生任何对话
    const missing = await jpost(web.base, '/api/messages', { chat_id: chatId, agent_id: 'dev-1', text: '缺归属' });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, 'INVALID_PARAM');
    assert.equal(missing.body.error, '新对话需要 project_id（对话必须归属一个项目）');

    // ② '' 与非字符串（'空值即无参' 的旧语义不得沿用）
    for (const projectId of ['', 123]) {
      const r = await jpost(web.base, '/api/messages', { chat_id: chatId, project_id: projectId, agent_id: 'dev-1', text: '空归属' });
      assert.equal(r.status, 400, `project_id=${JSON.stringify(projectId)} 应 400`);
      assert.equal(r.body.error, '新对话需要 project_id（对话必须归属一个项目）');
    }

    // ③ 指向不存在的项目 → 400（不是 404）+ 逐字含 id
    const unknown = await jpost(web.base, '/api/messages', { chat_id: chatId, project_id: 'prj-does-not-exist', agent_id: 'dev-1', text: '未知项目' });
    assert.equal(unknown.status, 400, '未知项目一律 400（不采用 404）');
    assert.equal(unknown.body.code, 'INVALID_PARAM');
    assert.equal(unknown.body.error, '项目不存在: prj-does-not-exist');

    // 校验在写库之前 ⇒ 对话 / 消息两表计数均不变（不产生任何对话）
    assert.deepEqual(counts(), { chats: 0, messages: 0 });
    await new Promise((r) => setTimeout(r, 200)); // SSE 静默观察窗
    assert.deepEqual(sse.events, [], '被拒的新建请求不产生 message / chat_state 帧');
  } finally {
    sse.close();
  }

  // 双口径核对（HTTP 列表 total 与 sqlite 直读 COUNT）：有项目时再次被拒仍不落任何对话
  const projectA = await projectFixture(web, 'https://example.com/f02-empty-a.git');
  const rejected = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '仍缺归属' });
  assert.equal(rejected.status, 400);
  const listed = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectA)}`);
  assert.equal(listed.body.total, 0, 'HTTP 口径：项目内对话总数不变');
  assert.deepEqual(counts(), { chats: 0, messages: 0 }, 'sqlite 口径：两表计数不变');
  assert.equal(listed.status, 200);
  db.close();
});

test('F02：带合法项目归属可新建并落库；既有对话路径零追加语义；范围可见性', async (t) => {
  const { web, dbPath } = await setup(t);
  const projectA = await projectFixture(web, 'https://example.com/f02-scope-a.git');
  const projectB = await projectFixture(web, 'https://example.com/f02-scope-b.git');

  // 带项目归属即可新建：响应含 chat_id / task_id / message_id，库内归属 = 请求的 project_id
  const created = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '归属检查一号' });
  const oneMore = await jpost(web.base, '/api/messages', { project_id: projectA, agent_id: 'dev-1', text: '归属检查二号' });
  assert.equal(oneMore.status, 200);
  assert.match(oneMore.body.chat_id, /^chat-[0-9a-f-]{36}$/);
  assert.match(oneMore.body.task_id, /^task-[0-9a-f-]{36}$/);
  assert.match(oneMore.body.message_id, /^msg-[0-9a-f-]{36}$/);

  const db = openRaw(dbPath);
  try {
    assert.equal(db.prepare('SELECT project_id FROM chats WHERE chat_id = ?').get(created.chatId).project_id, projectA, '新建即落归属');
  } finally {
    db.close();
  }

  // 范围可见性：出现在 A 的列表，不出现于 B 的列表
  const listA = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectA)}`);
  const listB = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectB)}`);
  assert.deepEqual(listA.body.chats.map((c) => c.chat_id).sort(), [created.chatId, oneMore.body.chat_id].sort());
  assert.deepEqual(listB.body.chats, [], 'B 项目内看不到 A 的对话');

  // 既有对话路径零追加语义：不带 project_id 仍 200；带一个不同归属仍 200 且归属不被改写
  const noProject = await jpost(web.base, '/api/messages', { chat_id: created.chatId, agent_id: 'dev-1', text: '既有对话不带归属' });
  assert.equal(noProject.status, 200, '既有对话路径不新增 project_id 必填语义');
  const otherProject = await jpost(web.base, '/api/messages', { chat_id: created.chatId, project_id: projectB, agent_id: 'dev-1', text: '既有对话带另一个归属' });
  assert.equal(otherProject.status, 200, '不引入归属一致性校验分支');
  const db2 = openRaw(dbPath);
  try {
    assert.equal(db2.prepare('SELECT project_id FROM chats WHERE chat_id = ?').get(created.chatId).project_id, projectA, '归属不可变（ensureChat DO NOTHING）');
  } finally {
    db2.close();
  }
});

test('F02：顺序契约——既有错误路径触发条件与顺序不变（新校验未抢先）', async (t) => {
  const { web, dbPath } = await setup(t, { withAgent: false });
  const projectA = await projectFixture(web, 'https://example.com/f02-order-a.git');

  // ① 读体优先：畸形 JSON → 400（先于一切字段校验）
  const malformed = await jraw(web.base, '/api/messages', '{bad');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, 'INVALID_PARAM');
  assert.match(malformed.body.error, /请求体非法 JSON/);

  // ② 缺 agent_id 且无 @ 前缀 → 400（既有文案）
  const noAgent = await jpost(web.base, '/api/messages', { text: '没有目标 agent' });
  assert.equal(noAgent.status, 400);
  assert.equal(noAgent.body.error, '需要指定目标 agent（输入 @agent 或提供 agent_id）');

  // ③ 正文 trim 后为空 → 400（既有文案）
  const emptyText = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '   ' });
  assert.equal(emptyText.status, 400);
  assert.equal(emptyText.body.error, '消息不能为空');

  // ④ model 不匹配 MODEL_RE → 400（既有文案）
  const badModel = await jpost(web.base, '/api/messages', { agent_id: 'dev-1', text: '合法正文', model: 'bad model!' });
  assert.equal(badModel.status, 400);
  assert.match(badModel.body.error, /^model 非法（需匹配 \/\^\[A-Za-z0-9\._\/-\]\{1,128\}\$\//);

  // ⑤ 只读预检优先于新建校验：已关闭 / 已归档 → 409（带 chat_id、不带 project_id）
  const closed = await sendAndWait(web, { project_id: projectA, agent_id: 'ghost-1', text: '顺序契约-已关闭' });
  await jpost(web.base, `/api/chats/${encodeURIComponent(closed.chatId)}/close`, {});
  const closedRej = await jpost(web.base, '/api/messages', { chat_id: closed.chatId, agent_id: 'dev-1', text: '关闭后提交' });
  assert.equal(closedRej.status, 409);
  assert.equal(closedRej.body.code, 'CONFLICT');
  assert.equal(closedRej.body.error, 'chat 已关闭，不接受新输入');

  const archivable = await sendAndWait(web, { project_id: projectA, agent_id: 'ghost-2', text: '顺序契约-已归档' });
  const archived = await jpost(web.base, '/api/chats/archive', {});
  assert.equal(archived.body.archived, 2, '已 failed 与已 closed 两条均非进行中 ⇒ 都可归档');
  const archivedRej = await jpost(web.base, '/api/messages', { chat_id: archivable.chatId, agent_id: 'dev-1', text: '归档后提交' });
  assert.equal(archivedRej.status, 409);
  assert.equal(archivedRej.body.error, 'chat 已归档（只读），不接受新输入');

  // 被拒请求不产生新对话：库内仍只有上面显式创建的两条
  const db = openRaw(dbPath);
  try {
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM chats'), 2);
  } finally {
    db.close();
  }
});

test('F02：数据层结构面（NOT NULL + 外键）与结构性拒收', async (t) => {
  const { web, dbPath } = await setup(t, { withAgent: false });
  const projectA = await projectFixture(web, 'https://example.com/f02-schema-a.git');
  await sendAndWait(web, { project_id: projectA, agent_id: 'ghost-1', text: '结构面占位' });

  const db = openRaw(dbPath);
  try {
    // 列序契约：既有 9 列相对顺序不变，project_id 插在第 2 位且 NOT NULL
    const cols = db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name);
    assert.deepEqual(cols, [
      'chat_id',
      'project_id',
      'title',
      'agent_id',
      'state',
      'created_at',
      'updated_at',
      'closed_at',
      'archived_at',
      'context_released',
    ]);
    const projectCol = db.prepare("SELECT * FROM pragma_table_info('chats') WHERE name = 'project_id'").get();
    assert.equal(projectCol.cid, 1, 'project_id 在第 2 位（紧跟 chat_id）');
    assert.equal(projectCol.notnull, 1, 'project_id 声明为 NOT NULL');

    // 外键指向 projects.project_id（PRAGMA foreign_keys = ON 已由 openDb 打开 ⇒ 引用真实生效）
    const fks = db.prepare("SELECT * FROM pragma_foreign_key_list('chats')").all();
    assert.ok(
      fks.some((f) => f.table === 'projects' && f.from === 'project_id' && f.to === 'project_id'),
      `应存在指向 projects.project_id 的引用：${JSON.stringify(fks)}`,
    );

    // 结构性拒收：缺 project_id → NOT NULL；未知 project_id → 外键
    assert.throws(
      () => db.prepare("INSERT INTO chats (chat_id, title, state, created_at, updated_at) VALUES ('chat-no-project', 't', 'working', 1, 1)").run(),
      /constraint failed/,
      '缺 project_id 应被 NOT NULL 拒绝',
    );
    assert.throws(
      () =>
        db
          .prepare("INSERT INTO chats (chat_id, project_id, title, state, created_at, updated_at) VALUES ('chat-bad-project', 'prj-nope', 't', 'working', 1, 1)")
          .run(),
      /constraint failed/,
      '未知 project_id 应被外键拒绝',
    );
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM chats'), 1, '两次被拒的 INSERT 不落行');
  } finally {
    db.close();
  }
});
// ────────────────────────── F03 对话列表以项目为范围（含既有过滤在范围内语义不变） ──────────────────────────

test('F03：缺参 / 空值 400 + 文案；范围过滤与 total 同源；未知项目空列表', async (t) => {
  const { web, dbPath } = await setup(t);
  const projectA = await projectFixture(web, 'https://example.com/f03-scope-a.git');
  const projectB = await projectFixture(web, 'https://example.com/f03-scope-b.git');

  // 缺参 / 空值都判非法（不沿用「空值 = 无参」语义），且不返回跨项目全量列表
  for (const p of ['/api/chats', '/api/chats?project_id=']) {
    const r = await jget(web.base, p);
    assert.equal(r.status, 400, `${p} 应 400`);
    assert.equal(r.body.code, 'INVALID_PARAM');
    assert.equal(r.body.error, '查询参数非法: project_id 不能为空（对话列表以项目为范围）');
  }

  const a1 = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '苹果 一号' });
  const a2 = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '橙子 二号' });
  const b1 = await sendAndWait(web, { project_id: projectB, agent_id: 'ghost-9', text: '苹果 三号' });

  // 范围过滤：HTTP 集合与 sqlite 直读集合相等（互不包含对方的行）
  const listA = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectA)}`);
  const listB = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectB)}`);
  assert.equal(listA.status, 200);
  const db = openRaw(dbPath);
  try {
    const direct = (pid) => db.prepare('SELECT chat_id FROM chats WHERE project_id = ? ORDER BY chat_id').all(pid).map((r) => r.chat_id);
    assert.deepEqual(listA.body.chats.map((c) => c.chat_id).sort(), direct(projectA));
    assert.deepEqual(listA.body.chats.map((c) => c.chat_id).sort(), [a1.chatId, a2.chatId].sort());
    assert.deepEqual(listB.body.chats.map((c) => c.chat_id).sort(), direct(projectB));
    assert.deepEqual(listB.body.chats.map((c) => c.chat_id), [b1.chatId]);
  } finally {
    db.close();
  }

  // total 与集合同源：分页两次的 total 恒等于 A 内总数（不是跨项目总数），两页不重复
  assert.equal(listA.body.total, listA.body.chats.length);
  const page1 = await jget(web.base, `/api/chats?limit=1&offset=0&project_id=${encodeURIComponent(projectA)}`);
  const page2 = await jget(web.base, `/api/chats?limit=1&offset=1&project_id=${encodeURIComponent(projectA)}`);
  assert.equal(page1.body.total, 2);
  assert.equal(page2.body.total, 2);
  assert.notEqual(page1.body.chats[0].chat_id, page2.body.chats[0].chat_id, '分页不重复');
  assert.deepEqual([page1.body.chats[0].chat_id, page2.body.chats[0].chat_id].sort(), [a1.chatId, a2.chatId].sort());

  // 未知项目：不做存在性判定 ⇒ 空列表 + limit/offset 仍在（不报错）
  const unknown = await jget(web.base, '/api/chats?project_id=prj-nope');
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.body.chats, []);
  assert.equal(unknown.body.total, 0);
  assert.equal(unknown.body.limit, 50);
  assert.equal(unknown.body.offset, 0);
});

test('F03：既有 8 类过滤 / 分页在项目范围内语义不变（400 归因不串）', async (t) => {
  const { web, dbPath } = await setup(t);
  const projectA = await projectFixture(web, 'https://example.com/f03-filters-a.git');
  const scope = `project_id=${encodeURIComponent(projectA)}`;

  const a1 = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '苹果 一号' });
  const a2 = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '橙子 二号' });
  // 第二轮：仅消息正文命中（标题仍是首条输入）
  await sendAndWait(web, { chat_id: a2.chatId, agent_id: 'dev-1', text: '柚子追加正文' }, { rounds: 2 });
  await jpost(web.base, `/api/chats/${encodeURIComponent(a2.chatId)}/close`, {});

  const inScope = (body) => {
    assert.ok(body.chats.every((c) => [a1.chatId, a2.chatId].includes(c.chat_id)), '结果必须全部属于该项目');
    return body;
  };

  // q：标题命中 / 仅消息正文命中 / % 转义
  assert.deepEqual(inScope((await jget(web.base, `/api/chats?q=%E8%8B%B9%E6%9E%9C&${scope}`)).body).chats.map((c) => c.chat_id), [a1.chatId]);
  assert.deepEqual(inScope((await jget(web.base, `/api/chats?q=%E6%9F%9A%E5%AD%90&${scope}`)).body).chats.map((c) => c.chat_id), [a2.chatId]);
  assert.equal((await jget(web.base, `/api/chats?q=%25&${scope}`)).body.total, 0, '% 应被转义（不命中全部）');

  // agent：命中该 agent 相关对话数；不存在的 agent 名 → 0
  assert.equal(inScope((await jget(web.base, `/api/chats?agent=dev-1&${scope}`)).body).total, 2);
  assert.equal((await jget(web.base, `/api/chats?agent=nobody-x&${scope}`)).body.total, 0);

  // state：四态计数与库内一致（含 working 的 0 值，避免只测有值的分支）
  const db = openRaw(dbPath);
  try {
    for (const state of ['working', 'completed', 'failed', 'closed']) {
      const http = (await jget(web.base, `/api/chats?state=${state}&${scope}`)).body.total;
      const direct = countOf(db, 'SELECT COUNT(*) AS n FROM chats WHERE project_id = ? AND state = ?', projectA, state);
      assert.equal(http, direct, `state=${state} 计数应与库内一致`);
    }
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM chats WHERE project_id = ? AND state = ?', projectA, 'closed'), 1);
  } finally {
    db.close();
  }

  // from / to：闭区间；from > to → 400（带合法 project_id ⇒ 归因不串到缺参）
  const all = (await jget(web.base, `/api/chats?${scope}`)).body.chats;
  const maxUpdated = Math.max(...all.map((c) => c.updated_at));
  const range = await jget(web.base, `/api/chats?from=0&to=${maxUpdated}&${scope}`);
  assert.equal(range.body.total, 2);
  assert.ok(range.body.chats.every((c) => c.updated_at <= maxUpdated), '闭区间');
  assert.equal((await jget(web.base, `/api/chats?from=${maxUpdated + 1}&${scope}`)).body.total, 0);
  const badRange = await jget(web.base, `/api/chats?from=10&to=5&${scope}`);
  assert.equal(badRange.status, 400);
  assert.match(badRange.body.error, /from 需 <= to/);

  // 构造「已归档 / 未归档」混合态：批量归档把两条都纳入，再激活一条
  await jpost(web.base, '/api/chats/archive', {});
  const reactivated = await jpost(web.base, `/api/chats/${encodeURIComponent(a1.chatId)}/activate`, {});
  assert.equal(reactivated.status, 200, '激活一条以构造混合态');
  const archView = await jget(web.base, `/api/chats?archived=1&${scope}`);
  assert.deepEqual(archView.body.chats.map((c) => c.chat_id), [a2.chatId], 'archived=1 只含已归档');
  assert.ok(archView.body.chats.every((c) => c.archived_at !== null));
  const mainView = await jget(web.base, `/api/chats?archived=0&${scope}`);
  assert.deepEqual(mainView.body.chats.map((c) => c.chat_id), [a1.chatId], '缺省主列表排除已归档');
  const badArchived = await jget(web.base, `/api/chats?archived=2&${scope}`);
  assert.equal(badArchived.status, 400);
  assert.match(badArchived.body.error, /archived/);

  // limit / offset：非法值各 400（同样带合法 project_id）
  for (const q of ['limit=0', 'limit=201', 'limit=abc', 'offset=-1']) {
    const r = await jget(web.base, `/api/chats?${q}&${scope}`);
    assert.equal(r.status, 400, `${q} 应 400`);
    assert.equal(r.body.code, 'INVALID_PARAM');
    assert.match(r.body.error, /limit|offset/, '归因应指向该参数自身');
  }
});

test('F03：响应形状零变化（键集合 + 行内字段面无 project_id）', async (t) => {
  const { web } = await setup(t);
  const projectA = await projectFixture(web, 'https://example.com/f03-shape-a.git');
  await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: '形状检查' });

  const listed = await jget(web.base, `/api/chats?project_id=${encodeURIComponent(projectA)}`);
  assert.equal(listed.status, 200);
  assert.deepEqual(Object.keys(listed.body).sort(), ['chats', 'limit', 'offset', 'total']);
  const row = listed.body.chats[0];
  assert.deepEqual(Object.keys(row).sort(), [
    'agent_id',
    'archived_at',
    'chat_id',
    'created_at',
    'message_count',
    'state',
    'title',
    'updated_at',
  ]);
  assert.equal('project_id' in row, false, 'CHAT_COLUMNS 逐字未变（归属不进响应形状）');
});
// ────────────────────────── F04 / F05 前端静态契约（读源码的文本级契约，不做运行期 DOM 断言） ──────────────────────────

const PROJECT_VIEW_NODES = [
  'projects-view',
  'project-repo',
  'project-name',
  'btn-create-project',
  'project-list',
  'project-hint',
  'project-bar',
  'btn-back-projects',
  'current-project-name',
];

test('F04：index.html 九个静态节点 + 结构契约（projects-view 先于主布局 / project-bar 在顶栏内 / 返回入口 href="/"）', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');

  for (const id of PROJECT_VIEW_NODES) {
    assert.match(html, new RegExp(`id="${id}"`), `index.html 应含静态节点 #${id}`);
  }

  // 首屏项目列表视图先于 main.layout（未选项目时主体是项目列表）
  const mainIdx = html.indexOf('<main class="layout');
  assert.ok(mainIdx > 0, 'index.html 应仍含 <main class="layout">');
  assert.ok(html.indexOf('id="projects-view"') < mainIdx, '#projects-view 应出现在 <main class="layout"> 之前');

  // 顶栏项目栏在 .topnav 之后、同一 .topbar 内
  const topbarStart = html.indexOf('<header class="topbar">');
  const topbarEnd = html.indexOf('</header>');
  const navIdx = html.indexOf('<nav class="topnav">');
  const barIdx = html.indexOf('id="project-bar"');
  assert.ok(topbarStart >= 0 && navIdx > topbarStart, '顶栏与 nav 应在场');
  assert.ok(navIdx < barIdx && barIdx < topbarEnd, '#project-bar 应在 .topnav 之后、同一 .topbar 内');

  // 返回项目列表 = 浏览器整页导航
  assert.match(html, /<a id="btn-back-projects" href="\/">/, '#btn-back-projects 应指向 /');
});

test('F04 / F05：app.js boot 分派 + 六个函数在场 + 三处带 project_id 的调用点 + 零新增轮询', () => {
  const appJs = fs.readFileSync(APP_JS, 'utf8');

  // boot 顺序：loadAgents → connectAgentEvents → await resolveCurrentProject，再按真假分派
  const init = /\n\(async function init\(\) \{([\s\S]*?)\n\}\)\(\);/.exec(appJs);
  assert.ok(init, 'app.js 应含 init 自执行入口');
  const boot = init[1];
  const atAgents = boot.indexOf('await loadAgents()');
  const atEvents = boot.indexOf('connectAgentEvents()');
  const atProject = boot.indexOf('await resolveCurrentProject()');
  assert.ok(atAgents >= 0 && atAgents < atEvents && atEvents < atProject, 'boot 顺序应为 loadAgents → connectAgentEvents → resolveCurrentProject');
  assert.match(boot, /if \(!project\) \{\s*showProjectList\(\);/, 'falsy ⇒ 项目列表视图');
  assert.match(boot, /showWorkspace\(project\)/, 'truthy ⇒ 工作台');

  // 列表态不请求 /api/chats（三态分派的「未选项目」分支不触达对话列表）
  const showProjectListBody = functionBody(appJs, 'showProjectList');
  assert.match(showProjectListBody, /loadProjects\(\)/);
  assert.doesNotMatch(showProjectListBody, /\/api\/chats/, '列表态不请求 /api/chats');

  for (const name of ['loadProjects', 'renderProjects', 'createProject', 'resolveCurrentProject', 'showProjectList', 'showWorkspace']) {
    assert.match(appJs, new RegExp(`\\n(?:async )?function ${name}\\(`), `app.js 应含函数 ${name}`);
  }

  // 三处带 project_id 的调用点（工作台内新建自动归属 + 归档页仍在项目范围内）
  assert.match(
    functionBody(appJs, 'loadChats'),
    /\/api\/chats\?project_id=\$\{encodeURIComponent\(state\.projectId\)\}/,
    'loadChats 应带 project_id',
  );
  const archivedBody = functionBody(appJs, 'loadArchived');
  assert.match(archivedBody, /archived=1&limit=\$\{ARCHIVE_PAGE_SIZE\}&offset=\$\{offset\}/, '既有三参数逐字保留（否则归档页 400）');
  assert.match(archivedBody, /project_id=\$\{encodeURIComponent\(state\.projectId\)\}/, 'loadArchived 应带 project_id');
  assert.match(functionBody(appJs, 'send'), /project_id: state\.projectId/, 'send 请求体应带 project_id');

  // 零新增轮询（既有前端静态契约继续成立）
  assert.doesNotMatch(appJs, /POLL_MS/);
  assert.doesNotMatch(appJs, /setTimeout\(tick/);
});

test('F04：style.css 三条真隐藏规则 + 首屏信息量四项 + 创建后原地出现（错误文案落列表视图提示条）', () => {
  const appJs = fs.readFileSync(APP_JS, 'utf8');
  const css = fs.readFileSync(STYLE_CSS, 'utf8');

  // 本仓 .hidden 逐组件定义、无全局规则 ⇒ 三条规则缺一即「视图切换静默失效」
  for (const rule of ['\\.layout\\.hidden', '\\.projects-view\\.hidden', '\\.project-bar\\.hidden']) {
    assert.match(css, new RegExp(`^${rule} \\{ display: none; \\}$`, 'm'), `style.css 应含真隐藏规则 ${rule}`);
  }

  // 首屏信息量四项：项目名 + 仓库地址 + 对话数 + 最近活动时间（null 走既有 fmtAgo 的 '—' 占位）
  const renderBody = functionBody(appJs, 'renderProjects');
  assert.match(renderBody, /escapeHtml\(p\.name\)/, '项目名');
  assert.match(renderBody, /escapeHtml\(p\.repo_url\)/, '仓库地址');
  assert.match(renderBody, /\$\{p\.chat_count\}/, '对话数');
  assert.match(renderBody, /fmtAgo\(p\.last_activity_at \?\? undefined\)/, '最近活动时间（null → 非有限值）');
  assert.match(functionBody(appJs, 'fmtAgo'), /if \(!Number\.isFinite\(at\)\) return '—';/, '既有占位语义：非有限值 → —');

  // 创建后原地出现：成功 ⇒ 重取列表且不跳进工作台；失败 ⇒ 服务端 error 文案落列表视图自己的提示条
  const createBody = functionBody(appJs, 'createProject');
  assert.match(createBody, /await loadProjects\(\)/, '创建成功后原地重渲染');
  assert.doesNotMatch(createBody, /location/, '不跳进工作台');
  assert.match(createBody, /\$\('project-hint'\)/, '提示条 = 列表视图自己的 #project-hint');
  assert.match(createBody, /hint\.textContent = err\.message/, '失败文案取自服务端 error');

  // 创建入口绑定在场
  assert.match(appJs, /\$\('btn-create-project'\)\.onclick = createProject;/, '#btn-create-project 应绑定创建入口');
});
// ────────────────────────── F06 派发载荷 project（两条 LLM 路径携带 / shell 不携带 / 内容层落位） ──────────────────────────

test('F06：两条 LLM 分支载荷带齐三要素；shell 分支逐字不变；project 只在 payload.body 内容层', async (t) => {
  const { web } = await setup(t, { withAgent: false });
  const repo = 'https://example.com/f06-payload.git';
  const projectA = await projectFixture(web, repo);
  const project = (await jget(web.base, '/api/projects')).body.projects.find((p) => p.project_id === projectA);

  // ① 常驻分支：三要素逐字来自库内项目行 + 约定文本（逐字 ===，不做子串匹配）
  const daemonText = '常驻分支原文';
  const daemon = await captureTask(web, { project_id: projectA, text: daemonText });
  const daemonBody = JSON.parse(daemon.payload.body);
  assert.equal(daemonBody.executor, 'omp-daemon');
  assert.match(daemonBody.chat_id, /^chat-[0-9a-f-]{36}$/, '常驻分支带 chat_id');
  assert.deepEqual(Object.keys(daemonBody.project).sort(), ['agreement', 'name', 'repo_url']);
  assert.equal(daemonBody.project.name, project.name);
  assert.equal(daemonBody.project.repo_url, project.repo_url);
  assert.equal(daemonBody.project.repo_url, repo);
  assert.equal(daemonBody.project.agreement, AGREEMENT, 'agreement 应逐字等于派发装配点的约定文本');
  assert.equal(daemonBody.prompt, daemonText, 'web 只产出结构化数据（prompt = 原文）');

  // ② 一次性分支：同一载荷面（executor='omp'，chat_id 可缺）
  const oneShotText = '一次性分支原文';
  const oneShot = await captureTask(web, { project_id: projectA, text: oneShotText, one_shot: true });
  const oneShotBody = JSON.parse(oneShot.payload.body);
  assert.equal(oneShotBody.executor, 'omp');
  assert.deepEqual(Object.keys(oneShotBody.project).sort(), ['agreement', 'name', 'repo_url']);
  assert.equal(oneShotBody.project.repo_url, repo);
  assert.equal(oneShotBody.project.agreement, AGREEMENT);
  assert.equal(oneShotBody.prompt, oneShotText);

  // ③ 载荷不带 project_id、不带本地路径（本仓自身绝对路径不得出现在载荷里）
  assert.equal('project_id' in daemonBody.project, false);
  assert.equal('project_id' in oneShotBody.project, false);
  for (const value of Object.values(daemonBody.project)) {
    assert.equal(typeof value, 'string');
  }
  assert.doesNotMatch(daemonBody.project.name, /^\/|[A-Za-z]:\\/);
  assert.doesNotMatch(daemonBody.project.agreement, /^\/|[A-Za-z]:\\/m);
  assert.equal(daemon.payload.body.includes(ROOT), false, '载荷不含任何本地目录串');

  // ④ shell 分支：载荷逐字不变（无 project 键）
  const shell = await captureTask(web, { project_id: projectA, text: '!echo hi' });
  const shellBody = JSON.parse(shell.payload.body);
  assert.equal('project' in shellBody, false);
  assert.deepEqual(Object.keys(shellBody).sort(), ['args', 'command', 'label']);
  assert.equal(shellBody.command, '/bin/sh');
  assert.equal(shellBody.args[0], '-c');

  // ⑤ 内容层落位：信封顶层零新增键；project 只进 payload.body
  assert.deepEqual(Object.keys(daemon).sort(), ['created_at', 'from', 'message_id', 'payload', 'protocol', 'task_id', 'to', 'type']);
  assert.equal('project' in daemon, false);
  assert.deepEqual(Object.keys(daemon.payload).sort(), ['body', 'content_type']);
  assert.equal(daemon.payload.content_type, 'application/json');
  assert.equal(daemon.type, 'task.request');
});

test('F06：协议方法面仍 7 个（README §协议速览 逐字列 7 项，无新增无删除）', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const section = /## 协议速览([\s\S]*?)\n## /.exec(readme);
  assert.ok(section, 'README 应含 ## 协议速览 小节');
  const methodLine = /- 方法面：([\s\S]*?)。/.exec(section[1]);
  assert.ok(methodLine, 'README §协议速览 应含「方法面」行');
  const methods = [...methodLine[1].matchAll(/`([a-z]+\.[a-z_]+)`/g)].map((m) => m[1]);
  assert.deepEqual(methods, [
    'agent.register',
    'agent.heartbeat',
    'agent.deregister',
    'message.send',
    'message.deliver',
    'message.ack',
    'router.status',
  ]);
});
// ────────────────────────── F07 项目上下文的内容与 agent 侧注入（含 E9 原文不被污染） ──────────────────────────

test('F07：一次性路径每次注入（末位 argv 逐字）/ 常驻路径首轮一次 / E9 原文逐字未变', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-project-ws-argv-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const argsLog = path.join(dir, 'argv.jsonl');
  const { web, dbPath } = await setup(t, { env: { FAKE_ACP_ARGS_LOG: argsLog } });
  const repo = 'https://example.com/f07-injection.git';
  const projectA = await projectFixture(web, repo);
  const project = (await jget(web.base, '/api/projects')).body.projects.find((p) => p.project_id === projectA);
  const rendered = renderExpected(project);

  // ① 一次性路径：每次派发都注入，且末位 argv = 渲染块 + '\n\n' + 原文（逐字 ===）
  const oneShotText = '一次性注入原文';
  await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: oneShotText, one_shot: true });
  const argvs = fs
    .readFileSync(argsLog, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const oneShots = argvs.filter((a) => a.includes(ONESHOT_MODE) && !a.includes(ACP_MODE));
  assert.equal(oneShots.length, 1, '一次性路径应恰好起一次 -p 进程');
  // 末位 argv：内容仍逐字 = 项目块渲染 + '\n\n' + 原文（业务内容，比较强度不变）；另固定 omp:oneshot profile 的 input:'positional' 口径
  const expectedTail = buildArgv('omp:oneshot', { prompt: `${rendered}\n\n${oneShotText}` }).at(-1);
  assert.equal(oneShots[0][oneShots[0].length - 1], `${rendered}\n\n${oneShotText}`, '末位 argv 逐字 = 项目块 + \\n\\n + 原文');
  assert.equal(oneShots[0][oneShots[0].length - 1], expectedTail, '末位 argv = launcher.js omp:oneshot profile 的 input:positional 推导值');

  // ② 常驻路径：同一 (chat×agent) 首轮注入一次，次轮不注入
  const firstText = '常驻首轮原文';
  const secondText = '常驻次轮原文';
  const first = await sendAndWait(web, { project_id: projectA, agent_id: 'dev-1', text: firstText });
  assert.equal(first.detail.messages[1].text, `收到：${rendered}\n\n${firstText}`, '首轮注入项目上下文（回显可核对）');
  assert.ok(first.detail.messages[1].text.startsWith('收到：【项目上下文】'));
  assert.ok(first.detail.messages[1].text.includes(project.repo_url), '仓库地址在 agent 侧可见文本中出现即真');

  const second = await sendAndWait(web, { chat_id: first.chatId, agent_id: 'dev-1', text: secondText }, { rounds: 2 });
  assert.equal(second.detail.messages[3].text, `收到：${secondText}`, '次轮不再注入');
  assert.doesNotMatch(second.detail.messages[3].text, /【项目上下文】/);

  // ④ E9：用户原文逐字未变（HTTP 与 sqlite 双口径，不 trim、不含前缀）
  const inbound = second.detail.messages.filter((m) => m.direction === 'in').map((m) => m.text);
  assert.deepEqual(inbound, [firstText, secondText]);
  const db = openRaw(dbPath);
  try {
    assert.deepEqual(
      db.prepare("SELECT text FROM messages WHERE chat_id = ? AND direction = 'in' ORDER BY id").all(first.chatId).map((r) => r.text),
      [firstText, secondText],
    );
  } finally {
    db.close();
  }
});

test('F07：约定三件事齐备 + 零绝对路径 / 零盘符 / 零主机名（限定 agreement 与工作约定行）+ 零超能力承诺', () => {
  const sample = { name: 'demo', repo_url: 'https://example.com/acme/demo.git' };
  const rendered = renderExpected(sample);
  const agreementLine = rendered.split('\n').find((line) => line.startsWith('- 工作约定：'));
  assert.equal(agreementLine, `- 工作约定：${AGREEMENT}`, '渲染块的约定行 = 约定原文');
  assert.ok(rendered.includes(`- 项目名：${sample.name}`));
  assert.ok(rendered.includes(`- 仓库地址：${sample.repo_url}`));

  // 三件事齐备：clone 语义（本地尚无该仓库）/ 在仓库根目录工作 / 产物写入该仓库
  assert.match(AGREEMENT, /clone/);
  assert.match(AGREEMENT, /本地尚无该仓库/);
  assert.match(AGREEMENT, /根目录/);
  for (const kw of ['docs', 'PR', 'commit', '分支', '写入该仓库']) {
    assert.ok(AGREEMENT.includes(kw), `约定应覆盖产物写入该仓库：缺 ${kw}`);
  }

  // 零绝对路径 / 零盘符 / 零主机名：断言面限定在 agreement 与工作约定行（repo_url 行合法含 :// 与主机名）
  for (const text of [AGREEMENT, agreementLine]) {
    assert.doesNotMatch(text, /^\//m, '不应出现 / 开头的目录串');
    assert.doesNotMatch(text, /[A-Za-z]:\\/, '不应出现盘符');
    assert.doesNotMatch(text, /\/\//, '不应出现主机名面');
  }

  // 零超能力承诺（约定 / 渲染块 / 页面源码都不得越能力边界）
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const appJs = fs.readFileSync(APP_JS, 'utf8');
  for (const text of [AGREEMENT, rendered, html, appJs]) {
    assert.doesNotMatch(text, /已 ?clone|已对齐目录|已进入项目根目录|系统会自动/);
  }
});
// ────────────────────────── F08 旧结构对话库启动即重建（E6） ──────────────────────────

const NEW_CHAT_COLUMNS = [
  'chat_id',
  'project_id',
  'title',
  'agent_id',
  'state',
  'created_at',
  'updated_at',
  'closed_at',
  'archived_at',
  'context_released',
];

/** 造一份不含 project_id 的旧结构库（7 列 chats + messages + 各 1 条旧行）；返回旧列集供前置断言。 */
function writeLegacyDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE chats (
    chat_id    TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    agent_id   TEXT,
    state      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    closed_at  INTEGER
  )`);
  db.exec(`CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id     TEXT NOT NULL,
    direction   TEXT NOT NULL,
    agent_id    TEXT,
    text        TEXT NOT NULL,
    model       TEXT,
    duration_ms INTEGER,
    error       TEXT,
    created_at  INTEGER NOT NULL,
    meta        TEXT
  )`);
  db.exec("INSERT INTO chats (chat_id, title, agent_id, state, created_at, updated_at, closed_at) VALUES ('chat-old', '旧结构对话', 'dev-1', 'completed', 1, 2, NULL)");
  db.exec("INSERT INTO messages (chat_id, direction, agent_id, text, created_at) VALUES ('chat-old', 'in', 'dev-1', '旧消息', 1)");
  const cols = db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name);
  db.close();
  return cols;
}

async function startWebWithTempDb(t, router, dbPath) {
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: dbPath });
  t.after(() => web.stop());
  return web;
}

const makeTempDbDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-project-ws-legacy-'));

test('F08：旧结构库启动即重建（列集 / 表空 / 无兜底 / 告知行 / 无迁移残留）', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const dbDir = makeTempDbDir();
  t.after(() => fs.rmSync(dbDir, { recursive: true, force: true }));
  const dbPath = path.join(dbDir, 'sql.db');

  const legacyCols = writeLegacyDb(dbPath);
  assert.deepEqual(legacyCols, ['chat_id', 'title', 'agent_id', 'state', 'created_at', 'updated_at', 'closed_at'], '前置：旧结构 7 列且无 project_id');

  const web = await startWebWithTempDb(t, router, dbPath);
  assert.doesNotMatch(web.stderr(), /Error|未捕获|unhandled/i, '重建过程不报错');

  const db = openRaw(dbPath);
  try {
    assert.deepEqual(db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name), NEW_CHAT_COLUMNS, '重建后列集 = 新 schema');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
    assert.ok(tables.includes('projects'), 'projects 表应存在');
    assert.deepEqual(
      [...tables].sort(),
      ['chats', 'messages', 'projects', 'sqlite_sequence'],
      '无迁移表 / 无备份表（sqlite_sequence 为 AUTOINCREMENT 的内建伴随表）',
    );
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM chats'), 0, '旧对话行清零');
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM messages'), 0, '旧消息行清零');
    assert.equal(db.prepare("SELECT 1 AS found FROM chats WHERE chat_id = 'chat-old'").get(), undefined, '旧 chat 行不存在');
    assert.equal(countOf(db, 'SELECT COUNT(*) AS n FROM projects'), 0, '不留兜底归属项目行');

    const projectCol = db.prepare("SELECT * FROM pragma_table_info('chats') WHERE name = 'project_id'").get();
    assert.equal(projectCol.cid, 1);
    assert.equal(projectCol.notnull, 1);
    const fks = db.prepare("SELECT * FROM pragma_foreign_key_list('chats')").all();
    assert.ok(
      fks.some((f) => f.table === 'projects' && f.from === 'project_id' && f.to === 'project_id'),
      `应存在指向 projects.project_id 的引用：${JSON.stringify(fks)}`,
    );
  } finally {
    db.close();
  }

  // 重建告知行（stdout，D-02）：path= 后的值与 OAMP_DB 指向的库路径逐字相等
  assert.ok(web.stdout().includes(`DB_REBUILT path=${dbPath}\n`), `stdout 应含重建告知行：${web.stdout()}`);

  // 无兼容路径 / 无迁移残留（源码面）
  const persistSrc = fs.readFileSync(PERSIST_SRC, 'utf8');
  assert.doesNotMatch(persistSrc, /MIGRATIONS|migrate\(/, '补列迁移机制应已删除');
  assert.doesNotMatch(persistSrc, /ALTER TABLE chats/, '不应保留按列存在性的补列路径');
});

test('F08：新结构不重建且数据保留；删库重启 = 新建空库可用', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  t.after(() => stopAll([router]));
  const dbDir = makeTempDbDir();
  t.after(() => fs.rmSync(dbDir, { recursive: true, force: true }));
  const dbPath = path.join(dbDir, 'sql.db');

  writeLegacyDb(dbPath);
  const web1 = await startWebWithTempDb(t, router, dbPath);
  assert.ok(web1.stdout().includes('DB_REBUILT path='), '首次启动（旧库）应重建');
  const projectA = await projectFixture(web1, 'https://example.com/f08-persist.git');
  const chat = await sendAndWait(web1, { project_id: projectA, agent_id: 'ghost-1', text: '重建后写入' });
  await web1.stop();

  // 二次启动（新结构）：不重建、数据保留、列集不变
  const web2 = await startWebWithTempDb(t, router, dbPath);
  assert.equal(web2.stdout().includes('DB_REBUILT'), false, '新结构不重建（CREATE TABLE IF NOT EXISTS 幂等）');
  assert.deepEqual((await jget(web2.base, '/api/projects')).body.projects.map((p) => p.project_id), [projectA]);
  assert.deepEqual((await jget(web2.base, `/api/chats?project_id=${encodeURIComponent(projectA)}`)).body.chats.map((c) => c.chat_id), [chat.chatId]);
  const db = openRaw(dbPath);
  try {
    assert.deepEqual(db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name), NEW_CHAT_COLUMNS);
  } finally {
    db.close();
  }
  await web2.stop();

  // 删库文件后重启：chats 不存在 ⇒ 非旧结构 ⇒ 正常建新库，且可立即创建项目 / 对话
  fs.rmSync(dbPath, { force: true });
  const web3 = await startWebWithTempDb(t, router, dbPath);
  assert.equal(web3.stdout().includes('DB_REBUILT'), false, '空库不触发重建');
  assert.deepEqual((await jget(web3.base, '/api/projects')).body.projects, [], '新建空库可用（项目列表为空）');
  const created = await jpost(web3.base, '/api/projects', { repo_url: 'https://example.com/f08-fresh.git' });
  assert.equal(created.status, 200);
  const sent = await jpost(web3.base, '/api/messages', { project_id: created.body.project.project_id, agent_id: 'ghost-1', text: '空库可用' });
  assert.equal(sent.status, 200, `新建空库可用: ${JSON.stringify(sent.body)}`);
});
// ────────────────────────── F10 登记义务与三条漂移锁 + 零依赖锁（本文件独立重验） ──────────────────────────

/** 接口面签名（本文件独立声明；真源 = createApiRoutes({}) 的真实表项：既有 11 条 + 末位两条项目面）。 */
const EXPECTED_ROUTE_SIGNATURES = [
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
  'GET /api/projects',
  'POST /api/projects',
  'POST /api/calls',
  'GET /api/calls',
  'GET /api/calls/stream',
  'GET /api/calls/:call_id/stream',
  'GET /api/calls/:call_id/transcript',
  'GET /api/calls/:call_id',
  'GET /api/confirmations',
  'POST /api/confirmations/:confirmation_id/decision',
];

const ROUTE_META_KEYS = ['method', 'path', 'summary', 'params', 'response', 'errors', 'kind', 'docLink'];

/** 路径归一化（与漂移锁③同口径）：截断 `?`/`#` 之后的部分；`<…>` 占位与 `:name` 一律归一为 `:`。 */
const shapePath = (p) => p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');

test('F10：登记面（进程内）两条新表项元数据逐字 + 追加末位 + 三条锁的静默真源', () => {
  const routes = createApiRoutes({});
  assert.deepEqual(routes.map((r) => `${r.method} ${r.path}`), EXPECTED_ROUTE_SIGNATURES);
  assert.equal(routes.length, 21);
  assert.deepEqual(
    routes.slice(-6).map((r) => `${r.method} ${r.path}`),
    ['GET /api/calls/stream', 'GET /api/calls/:call_id/stream', 'GET /api/calls/:call_id/transcript', 'GET /api/calls/:call_id', 'GET /api/confirmations', 'POST /api/confirmations/:confirmation_id/decision'],
    '新面追加末位',
  );

  const bySig = new Map(routes.map((r) => [`${r.method} ${r.path}`, r]));
  for (const r of [bySig.get('GET /api/projects'), bySig.get('POST /api/projects')]) {
    for (const key of ROUTE_META_KEYS) {
      assert.ok(key in r, `登记元数据必填：缺 ${key}`);
    }
    assert.equal(typeof r.handler, 'function');
  }

  const list = bySig.get('GET /api/projects');
  assert.equal(list.summary, '项目列表（含对话数与最近活动时间）');
  assert.deepEqual(list.params, []);
  assert.deepEqual(list.errors, []);
  assert.equal(list.kind, 'json');
  assert.equal(list.docLink, 'API.md#312-get-apiprojects');

  const create = bySig.get('POST /api/projects');
  assert.equal(create.summary, '创建项目（最小输入 = 仓库地址；重复地址 → 409）');
  assert.deepEqual(
    create.params.map((p) => ({ name: p.name, in: p.in, type: p.type, required: p.required })),
    [
      { name: 'repo_url', in: 'body', type: 'string', required: true },
      { name: 'name', in: 'body', type: 'string', required: false },
    ],
  );
  assert.deepEqual(create.errors, ['INVALID_PARAM', 'CONFLICT']);
  assert.equal(create.kind, 'json');
  assert.equal(create.docLink, 'API.md#313-post-apiprojects');

  // 锁②：llms.txt 快照逐字节（生成结果 = 仓库文件；不手改快照）
  const expected = renderLlmsTxt(projectRoutes(createApiRoutes({})));
  const snapshot = fs.readFileSync(LLMS_SNAPSHOT, 'utf8');
  assert.equal(Buffer.compare(Buffer.from(snapshot, 'utf8'), Buffer.from(expected, 'utf8')), 0, '快照与生成结果逐字节相等');
  assert.match(snapshot, /^## 接口（21 条）$/m);
  for (const sig of ['GET /api/projects', 'POST /api/projects']) {
    assert.ok(snapshot.includes(`- ${sig} — `), `索引应含清单行：${sig}`);
  }

  // 锁③：API.md 路径级双向覆盖（正向 = 两条新面签名与登记行在场；反向 = 文档签名 ⊆ 登记集合）
  const apiMd = fs.readFileSync(API_MD, 'utf8');
  for (const sig of ['`GET /api/projects`', '`POST /api/projects`']) {
    assert.ok(apiMd.includes(sig), `API.md 应含签名 ${sig}`);
  }
  assert.match(apiMd, /^### 3\.12 `GET \/api\/projects`$/m);
  assert.match(apiMd, /^### 3\.13 `POST \/api\/projects`$/m);
  assert.match(apiMd, /^\| 12 \| `GET \/api\/projects` \|/m);
  assert.match(apiMd, /^\| 13 \| `POST \/api\/projects` \|/m);
  const registered = new Set(routes.map((r) => `${r.method} ${shapePath(r.path)}`));
  const documented = new Set([...apiMd.matchAll(/`(GET|POST) (\/api\/[^`]*)`/g)].map((m) => `${m[1]} ${shapePath(m[2])}`));
  const undocumented = [...documented].filter((sig) => !registered.has(sig));
  assert.deepEqual(undocumented, [], `API.md 出现未登记路径：${undocumented.join(', ')}`);

  // 零依赖锁（与 hygiene.test.js 同源，此处独立重验）
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies === undefined ? {} : pkg.dependencies, {});
});

test('F10：/api/docs 投影 21 条（写接口 8 条）；/docs 与 /debug 自动出现且零硬编码路径', async (t) => {
  const { web } = await setup(t, { withAgent: false });

  const docs = await jget(web.base, '/api/docs');
  assert.equal(docs.status, 200);
  assert.ok(Array.isArray(docs.body.routes));
  assert.deepEqual(docs.body.routes.map((r) => `${r.method} ${r.path}`), EXPECTED_ROUTE_SIGNATURES);
  for (const route of docs.body.routes) {
    assert.equal(route.danger, route.method !== 'GET', `danger 由 method 派生：${route.path}`);
    assert.ok(route.docLink.startsWith('API.md#'), `docLink 应指向 API.md 章节：${route.path}`);
    assert.equal('handler' in route, false, `投影不含 handler：${route.path}`);
  }
  assert.equal(docs.body.routes.filter((r) => r.danger).length, 8, '写接口（POST）= 8 条');

  // 两个派生面自动出现（不新增静态面条目、不需手改页面）
  for (const p of ['/docs', '/debug']) {
    const res = await fetch(`${web.base}${p}`);
    assert.equal(res.status, 200, `${p} 应 200`);
    assert.match(res.headers.get('content-type'), /^text\/html/, `${p} 应为 HTML`);
  }

  // 两页零硬编码路径：唯一取数入口是 fetch('/api/docs')，源码内 /api/ 字面量去重后恰一项
  for (const file of ['docs.js', 'debug.js']) {
    const src = fs.readFileSync(path.join(ROOT, 'web', file), 'utf8');
    assert.match(src, /fetch\('\/api\/docs'\)/, `${file} 应从投影取数`);
    const literals = [...src.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(literals)], ['/api/docs'], `${file} 不应硬编码登记之外的接口路径`);
  }
});
