// test/api-pages.test.js — 在线接口文档页（/docs）与可交互调试台（/debug）的静态契约 + 新页面 HTTP 可达性（0016 / PR-002）
// 断言归属（architecture §4.4，2026-09-12 主 agent 裁决）：本文件只负责 /docs、/debug、/docs.js、/debug.js、/api-pages.css
//   的可达性 / 响应类型、两个新页面的静态契约与控制台顶栏入口；GET /llms.txt 的**全部**断言归 pr-001 的 test/api-routes.test.js。
// 载体：harness 真实 Router + `oamp web start` 子进程（随机端口 + 临时 OAMP_DB）+ fetch；不依赖外网与真实 omp。
// startWeb 为文件局部辅助（同 web.test.js 体例）：既有 web.test.js 内的同名辅助不可导出、且该文件禁止任何字节改动（§4.4）。

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

function pickPort() {
  return 43000 + Math.floor(Math.random() * 2000);
}

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会让它被判 offline
// ⇒ 与 web.test.js 同款放长租约（仍远短于用例时长）。
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

/** 登记中的 10 条既有接口路径（含参数占位形态）——用于「页面不硬编码接口清单」的反向断言。 */
const REGISTERED_PATHS = /\/api\/(agents|chats|messages|stream|events)\b/;

// ────────────────────────── 控制台顶栏（F03-1/2、F04-1） ──────────────────────────
test('接口页静态契约：控制台顶栏 +2 真实入口（/docs、/debug），既有 3 个占位项逐字未变（F03-1/2、F04-1）', () => {
  const html = read('index.html');
  assert.match(html, /<a class="nav-item" href="\/docs">文档<\/a>/, '顶栏应有指向 /docs 的「文档」入口');
  assert.match(html, /<a class="nav-item" href="\/debug">调试<\/a>/, '顶栏应有指向 /debug 的「调试」入口');
  assert.match(html, /<span class="nav-item active">Workspace<\/span>/, '既有占位项 Workspace 应逐字未变');
  assert.match(html, /<span class="nav-item">Agents<\/span>/, '既有占位项 Agents 应逐字未变');
  assert.match(html, /<span class="nav-item">Tasks<\/span>/, '既有占位项 Tasks 应逐字未变');

  const css = read('style.css');
  assert.match(
    css,
    /a\.nav-item\s*\{\s*text-decoration:\s*none;\s*cursor:\s*pointer;\s*\}/,
    'style.css 应追加锚点形态的 .nav-item 规则（顶栏新入口是 <a>）',
  );
});

// ────────────────────────── 文档页（F03-3~8、F08-5） ──────────────────────────
test('文档页静态契约：字段级七要素 + 人工撰写标注 + 零示例报文 + 独立资产引入（F03-3~8、F08-5）', () => {
  const html = read('docs.html');
  const js = read('docs.js');

  // 承载：静态文件 + 客户端渲染；两页同时 <link> 既有 style.css 与本迭代新增的 api-pages.css（§6.8）
  assert.match(html, /<link rel="stylesheet" href="\/style\.css" \/>/, '应复用既有 style.css 的 :root token');
  assert.match(html, /<link rel="stylesheet" href="\/api-pages\.css" \/>/, '应引入共享的 api-pages.css');
  assert.match(html, /<script src="\/docs\.js"><\/script>/, '脚本应是独立文件（不并入 app.js，N12）');

  // 反射边界标注（验收 7）：逐字
  assert.match(html, /参数语义说明为人工撰写，结构与分发来自路由表/, '页面应标注人工撰写边界');

  // 数据源唯一：加载时取投影；页面不硬编码登记中的接口路径（验收 6）
  assert.match(js, /fetch\('\/api\/docs'\)/, '内容应来自 GET /api/docs 的投影');
  assert.doesNotMatch(js, REGISTERED_PATHS, '页面不得硬编码登记中的接口路径');

  // 七要素逐个渲染（验收 3）：方法 / 路径 / 说明 / 参数 / 请求体字段 / 响应形态 / 错误码 —— 全部取自投影字段
  for (const field of ['route.method', 'route.path', 'route.summary', 'route.response', 'route.errors', 'route.docLink']) {
    assert.ok(js.includes(field), `文档页应逐接口渲染 ${field}`);
  }
  assert.match(js, /route\.params\.filter\(/, '参数与请求体字段应来自 params（按 in 分流）');
  assert.match(js, /class="api-table"/, '参数 / 请求体字段应以表格呈现（名称·位置·类型·必填·说明）');
  for (const col of ['名称', '位置', '类型', '必填', '说明']) assert.ok(js.includes(col), `参数表应含「${col}」列`);
  assert.match(js, /<a href="\$\{escapeHtml\(route\.docLink\)\}">API\.md<\/a>/, '逐接口应有 API.md 链接（验收 8 / F08-4）');

  // 零响应示例：页面只渲染 response 的形态说明文本，不含可复制的示例报文与 curl 片段（验收 4 / F08-5）
  assert.doesNotMatch(js, /curl/, '文档页不得出现可复制的请求示例');
  assert.doesNotMatch(html, /curl/);
  assert.doesNotMatch(js, /<pre/, '文档页不渲染示例报文块');
});

// ────────────────────────── 调试台（F04、F07） ──────────────────────────
test('调试台静态契约：风险提示 + 写防护唯一挂载点 + 两处危险标识 + 订阅可停 + 零历史留存（F04-2~7、F07-1~6）', () => {
  const html = read('debug.html');
  const js = read('debug.js');

  // 页面级风险提示（F07 验收 1）：静态段落，不依赖取数成功
  assert.match(html, /该页面直接作用于本机正在运行的应用，请求真实生效/, '顶部应有静态风险提示');
  assert.match(html, /<link rel="stylesheet" href="\/style\.css" \/>/);
  assert.match(html, /<link rel="stylesheet" href="\/api-pages\.css" \/>/);
  assert.match(html, /<script src="\/debug\.js"><\/script>/, '脚本应是独立文件（不并入 app.js，N12）');

  // 接口清单与表单完全来自投影（验收 2 / 6）：不硬编码登记中的接口路径
  assert.match(js, /fetch\('\/api\/docs'\)/);
  assert.doesNotMatch(js, REGISTERED_PATHS, '页面不得硬编码登记中的接口路径');

  // 写防护唯一挂载点（F07 验收 6 / AR-07-d）：danger 由投影派生，确认前不发请求
  assert.equal(js.match(/window\.confirm\(/g).length, 1, '发送前确认只应有一处挂载点（不逐接口手写）');
  assert.match(js, /if \(route\.danger && !window\.confirm\(/, '挂载点形态：danger 且未确认 → 直接返回（不发出请求）');
  // 危险标识两处（F07 验收 4）：接口列表项 + 选中接口的表单顶部 —— 只读接口无标识（danger 派生）
  assert.equal(js.match(/danger-badge/g).length, 2, '危险标识应渲染在列表与表单两处');
  assert.equal(js.match(/route\.danger \?|r\.danger \?/g).length, 2, '两处标识都应由投影的 danger 派生（不逐接口手写）');

  // 真实响应与墙钟耗时（F04 验收 4 / MI-02）：performance.now() 两次差值取整
  assert.match(js, /const t0 = performance\.now\(\);/);
  assert.match(js, /Math\.round\(performance\.now\(\) - t0\)/, '耗时 = 读完响应体后的墙钟毫秒（取整）');
  assert.match(js, /await res\.text\(\)/, '耗时口径含读体（完整响应到达）');
  assert.match(js, /\$\{res\.status\} · \$\{elapsedMs\} ms/, '应展示真实状态码 · 毫秒耗时');
  assert.match(js, /method: route\.method/, '请求方法取自投影');

  // 订阅面板（F04 验收 5 / MI-03）：建立 / 查看 / 主动停止
  assert.match(js, /new EventSource\(/, '应以 EventSource 建立订阅');
  assert.match(js, /source\.close\(\)/, '停止 = close（停止后不再接收事件）');
  assert.match(js, /route\.kind === 'sse'/, '订阅面板只对 sse 表项渲染（与发送区互斥）');

  // 零历史留存（F04 验收 7）：无任何跨刷新留存
  assert.doesNotMatch(js, /localStorage|sessionStorage/, '不得有任何持久化留存');
});

// ────────────────────────── 独立脚本 + 零启停入口（N12 / F04-6 / F07-5） ──────────────────────────
test('新页面脚本独立且零 agent 启停入口：禁用 POLL_MS / setTimeout(tick) 形态、零启停路径（N12、F04-6、F07-5）', () => {
  const appJs = read('app.js');
  for (const name of ['docs.js', 'debug.js']) {
    const js = read(name);
    assert.notEqual(js, appJs, `${name} 应是独立文件（不并入 app.js）`);
    assert.doesNotMatch(js, /POLL_MS/, `${name} 不得出现 POLL_MS 标识符（既有 app.js 的禁用形态）`);
    assert.doesNotMatch(js, /setTimeout\(tick/, `${name} 不得出现 setTimeout(tick 轮询形态`);
    // 零 agent 启停入口（F04 验收 6 / N9；E9 反向硬断言）：既无按钮也无路径
    assert.doesNotMatch(js, /oamp\s+agent/i, `${name} 不得含 agent 启停命令`);
    assert.doesNotMatch(js, /(启动|停止)\s*agent|agent\s*(start|stop)|(start|stop)[-_ ]?agent/i, `${name} 不得含 agent 启停入口`);
  }
  for (const name of ['docs.html', 'debug.html']) {
    const html = read(name);
    assert.doesNotMatch(html, /(启动|停止)\s*agent/i, `${name} 不得含 agent 启停入口`);
    assert.doesNotMatch(html, /<button[^>]*>[^<]*(启动|停止)[^<]*agent/i, `${name} 不得含 agent 启停按钮`);
  }
});

// ────────────────────────── HTTP 可达性与响应类型（PR-002 验收 1） ──────────────────────────
test('新页面 HTTP 可达性与响应类型：/docs、/debug、/docs.js、/debug.js、/api-pages.css（PR-002 验收 1）', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-api-pages-'));
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: path.join(dbDir, 'sql.db') });
  t.after(async () => {
    await stopAll([web, router]);
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  const cases = [
    ['/docs', 'text/html; charset=utf-8'],
    ['/debug', 'text/html; charset=utf-8'],
    ['/docs.js', 'text/javascript; charset=utf-8'],
    ['/debug.js', 'text/javascript; charset=utf-8'],
    ['/api-pages.css', 'text/css; charset=utf-8'],
  ];
  for (const [p, type] of cases) {
    const res = await fetch(`${web.base}${p}`);
    assert.equal(res.status, 200, `${p} 应可直达（200）`);
    assert.equal(res.headers.get('content-type'), type, `${p} 的响应类型应为 ${type}`);
    assert.ok((await res.text()).length > 0, `${p} 应有内容`);
  }

  // 顶栏两条入口的 href 目标即上面两条路径（直接输入地址与顶栏点击两条路径同一目标）
  const index = await (await fetch(`${web.base}/`)).text();
  assert.match(index, /href="\/docs"/);
  assert.match(index, /href="\/debug"/);
});
