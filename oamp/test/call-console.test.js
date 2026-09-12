// test/call-console.test.js — 控制台调用面（/calls）的静态契约 + 新页面 HTTP 可达性（0018 / PR-004 / architecture §12.2 组 K）
// 断言归属：本文件只负责 /calls、/calls.js 的可达性与响应类型、calls.html 的静态契约、控制台顶栏第 3 个真实入口。
//   GET /api/calls 与 /api/calls/:call_id/stream 的数据面契约归 pr-005 的 test/call-protocol.test.js（不在本文件重复）；
//   面内 roster 行与进行中增量属人工 / 浏览器核对项（§12.2 组 K 明写不设自动化断言），本文件无 DOM / CDP 依赖。
// 载体：harness 真实 Router + `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）+ fetch；零外网、零真实 omp、零 tmux。
// startWeb 为文件局部辅助（同 api-pages.test.js 体例）：既有文件内的同名辅助不可导出、且该文件禁止任何字节改动（§12.1）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, waitFor, stopAll, buildEnv } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

const read = (name) => fs.readFileSync(path.join(ROOT, 'web', name), 'utf8');

// 端口段 49000~49499：避开既有测试占用的 41000 / 43000 / 45000 / 47000 各段、默认端口 7788 与并行的 pr-005 段（49500~49999）。
function pickPort() {
  return 49000 + Math.floor(Math.random() * 500);
}

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会让它被判 offline
// ⇒ 与 api-pages.test.js 同款放长租约（仍远短于用例时长）。
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
    stop: async () => {
      if (exit) return;
      child.kill('SIGINT');
      await waitFor(() => exit !== null, { timeoutMs: 3000, what: 'web 退出' }).catch(() => child.kill('SIGKILL'));
    },
  };
}

// ────────────────────────── 静态契约（F13 验收 1/2/4/5） ──────────────────────────
test('调用页静态契约：独立资产引入 + roster 六列表头 + 顶栏「调用」入口 + 既有 3 个占位项逐字未变 + 零无数据源列（F13-1/2/4/5）', () => {
  const html = read('calls.html');
  const js = read('calls.js');

  assert.ok(html.length > 0, 'calls.html 应存在且非空');
  // 复用既有 CSS 的 :root token 与 0016 的表格规则 ⇒ 零新 CSS 文件、零构建、零依赖（§6「页面划分」）
  assert.match(html, /<link rel="stylesheet" href="\/style\.css" \/>/, '应复用既有 style.css 的 :root token');
  assert.match(html, /<link rel="stylesheet" href="\/api-pages\.css" \/>/, '应复用 api-pages.css 的表格规则');
  assert.match(html, /<script src="\/calls\.js"><\/script>/, '脚本应是独立文件（不并入 app.js，N12）');

  // roster 表头恰六列（§3.4 的行字段：call_id / agent / state / started_at / ended_at / model）
  for (const col of ['调用 id', 'agent', '状态', '开始时间', '结束时间', '模型']) {
    assert.ok(html.includes(`<th>${col}</th>`), `roster 表头应含「${col}」列`);
  }

  // 取数与订阅形态：roster = GET /api/calls + 5 s 轮询；进度 = 按调用订阅（不订阅对话作用域与全局流）
  assert.match(js, /fetch\('\/api\/calls'\)/, 'roster 应取自 GET /api/calls');
  assert.match(js, /const ROSTER_REFRESH_MS = 5000;/, '刷新间隔应是单一常量 5000（既有 5 s 轮询体例）');
  assert.match(js, /setInterval\(loadCalls, ROSTER_REFRESH_MS\)/, '应只有一个 roster 轮询定时器');
  assert.match(js, /new EventSource\(`\/api\/calls\/\$\{encodeURIComponent\(callId\)\}\/stream`\)/, '应按调用订阅该调用的事件流');
  assert.doesNotMatch(js, /chat_id=|'\/api\/stream'|'\/api\/events'/, '不得订阅对话作用域流与全局流');
  for (const type of ['call_state', 'call_update', 'call_result']) {
    assert.ok(js.includes(`'${type}'`), `应逐名监听 ${type}`);
  }

  // 页面与脚本不呈现无数据源项（验收 4 / N12 / 差异 ⑬⑭⑯⑮）
  assert.doesNotMatch(html + js, /token|cost|steer|cancel|isolated|effort|usage/i, '页面与脚本不得出现 token / 成本 / 工具级详情 / 取消 / steer 字段');

  // 顶栏第 3 个真实入口（验收 1）：既有两条实入口与 3 个占位项逐字未变
  const index = read('index.html');
  assert.match(index, /<a class="nav-item" href="\/calls">调用<\/a>/, '顶栏应有指向 /calls 的「调用」入口');
  assert.match(index, /<a class="nav-item" href="\/docs">文档<\/a>/, '既有 /docs 入口应逐字未变');
  assert.match(index, /<a class="nav-item" href="\/debug">调试<\/a>/, '既有 /debug 入口应逐字未变');
  assert.match(index, /<span class="nav-item active">Workspace<\/span>/, '既有占位项 Workspace 应逐字未变');
  assert.match(index, /<span class="nav-item">Agents<\/span>/, '既有占位项 Agents 应逐字未变');
  assert.match(index, /<span class="nav-item">Tasks<\/span>/, '既有占位项 Tasks 应逐字未变');
});

// ────────────────────────── HTTP 可达性与响应类型（PR-004 验收 1） ──────────────────────────
test('新页面 HTTP 可达性与响应类型：/calls、/calls.js（PR-004 验收 1）', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-call-console-'));
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: path.join(dbDir, 'sql.db') });
  t.after(async () => {
    await stopAll([web, router]);
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  const cases = [
    ['/calls', 'text/html; charset=utf-8'],
    ['/calls.js', 'text/javascript; charset=utf-8'],
  ];
  for (const [p, type] of cases) {
    const res = await fetch(`${web.base}${p}`);
    assert.equal(res.status, 200, `${p} 应可直达（200）`);
    assert.equal(res.headers.get('content-type'), type, `${p} 的响应类型应为 ${type}`);
    assert.ok((await res.text()).length > 0, `${p} 应有内容`);
  }

  // 顶栏入口的 href 目标即上面两条路径（直接输入地址与顶栏点击同一目标）
  const index = await (await fetch(`${web.base}/`)).text();
  assert.match(index, /href="\/calls"/);
});
