// test/inbox-console.test.js — 0021 pr-004：控制台第三栏（待确认 inbox）与浏览器通知
// 载体：① `oamp/web/**` 源码的文本级静态契约（体例同既有 api-pages.test.js / project-workspace.test.js）；
//       ② `oamp/web/notify.js` 的运行期行为——node:vm 起沙箱 + 桩全局 Notification（投递 / 降级 / 加载期零权限请求）；
//       ③ harness 真实 Router + `oamp web start` 子进程（随机非默认端口 + 临时 OAMP_DB）+ fetch 的静态面 HTTP 断言。
// 覆盖：pr-004 验收 1 / 2 / 10 与任务图 T1 / T2 / T5 的静态与运行期判据。**免刷新入栏 / 点选即裁决 / 刷新重建 /
//       窄屏折叠 / 三类通知各一次 / 降级静默 / 通知 onclick 不可用时仍可裁决**等运行期行为面由阶段 5 的浏览器实测
//       承接（任务图 T5 验收 6），不在本文件重复承载。
// 零新依赖；不写真实 oamp/data/sql.db（OAMP_DB 一律指到临时目录）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { startRouter, waitFor, stopAll, buildEnv } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'oamp.js');

const read = (name) => fs.readFileSync(path.join(ROOT, 'web', name), 'utf8');

// 租约：web 作为常驻发送方按既有下限心跳（≥500ms），harness SHORT_ENV 的 300ms 租约会把它判 offline
// ⇒ 与 api-pages.test.js 同款放长租约（仍远短于用例时长）。
const LEASE_ENV = { OAMP_HEARTBEAT_TIMEOUT_MS: '3000' };

function pickPort() {
  return 48000 + Math.floor(Math.random() * 1500);
}

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

/** 顶层函数体（同 project-workspace.test.js 的提取体例）。 */
function fnBody(src, name) {
  const found = new RegExp(`\\n(?:async )?function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(src);
  assert.ok(found, `web/app.js 应含顶层函数 ${name}`);
  return found[1];
}

/** notify.js 的段落切片（靠稳定标记，不靠行号——T1 验收 8 的可静态切片形状）。 */
const section = (src, from, to) =>
  src.slice(src.indexOf(`// ══════════ ${from}`), src.indexOf(`// ══════════ ${to}`));

/** 沙箱产出的对象带另一 realm 的原型 ⇒ 断言前归一为本地普通值。 */
const plain = (v) => JSON.parse(JSON.stringify(v));

/** 在隔离沙箱里执行 notify.js：经典脚本（零 import / export），只依赖 window 与可选的全局通知构造器。 */
function loadNotify({ notification } = {}) {
  const sandbox = { window: { focus() {} }, console };
  if (notification) sandbox.Notification = notification;
  vm.runInNewContext(read('notify.js'), sandbox, { filename: 'web/notify.js' });
  return sandbox.window.oampNotify;
}

/** 桩通知构造器：`permission` 可控，记录每次投递（含实例，供点击去向断言）与每次权限请求。 */
function notificationStub(permission, log) {
  const stub = function (title, options) {
    const shown = { title, body: options && options.body };
    log.push(shown);
    return shown;
  };
  stub.permission = permission;
  stub.requestPermission = () => {
    log.push({ ask: true });
    return Promise.resolve(permission);
  };
  return stub;
}

// ────────────────────────── T2 / T5：index.html 结构契约 ──────────────────────────

test('T2：index.html——第三栏是 main.layout 内 .sidebar 与 .detail 之间的兄弟节点 + 独立脚本（PR 验收 1 / 6）', () => {
  const html = read('index.html');

  const mainStart = html.indexOf('<main class="layout');
  const mainEnd = html.indexOf('</main>');
  const sidebar = html.indexOf('<aside class="sidebar">');
  const inbox = html.indexOf('<section id="inbox"');
  const detail = html.indexOf('<section class="detail">');
  assert.ok(mainStart >= 0 && mainEnd > mainStart, 'index.html 应仍含 <main class="layout">…</main>');
  assert.ok(sidebar > mainStart && sidebar < mainEnd, '.sidebar 应在 main.layout 内（既有两栏语义不变）');
  assert.ok(inbox > sidebar, '第三栏应在对话列表之后');
  assert.ok(detail > inbox && detail < mainEnd, '第三栏应在对话详情之前（DOM 顺序 = .sidebar → 第三栏 → .detail）');

  // 静态骨架：标题（显示在途条数）+ 列表容器（条目由 app.js 渲染，不动态造容器）
  assert.match(html, /id="btn-inbox-toggle"/, '开合入口应是静态节点');
  assert.match(html, /id="inbox-count"/, '折叠态标题显示在途条数');
  assert.match(html, /id="inbox-list"/, '列表容器应是静态节点');

  // 独立脚本（不并入 app.js、不内联），且先于 app.js（零构建下的全局入口顺序）
  assert.match(html, /<script src="\/notify\.js"><\/script>/, '通知模块应以独立 <script> 引入');
  assert.match(html, /<script src="\/app\.js"><\/script>/, '既有 app.js 标签应逐字未变');
  assert.ok(html.indexOf('<script src="/notify.js"></script>') < html.indexOf('<script src="/app.js"></script>'), '通知模块应先于 app.js 加载');

  // 不新增入口载体（N7 / §4.3 Z-6）：零新页面 / 新顶栏入口 / 左栏第 5 个过滤器 tab
  assert.equal((html.match(/<a class="nav-item"/g) || []).length, 3, '顶栏真实入口仍是既有 3 个');
  assert.equal((html.match(/<button class="filter/g) || []).length, 4, '左栏过滤器仍是既有 4 项（含归档）');
  assert.equal((html.match(/<section id="projects-view"/g) || []).length, 1, '不新增页面');
});

// ────────────────────────── T1：notify.js 静态契约（两层分离可静态判定） ──────────────────────────

test('T1：notify.js 静态契约——事件类型封闭 3 类 + service / channel 两层零命中（PR 验收 2）', () => {
  const src = read('notify.js');

  // ① 事件类型常量：恰 3 类，冻结，无 call_completed
  const listed = /const EVENT_TYPES = Object\.freeze\(\[([^\]]*)\]\)/.exec(src);
  assert.ok(listed, 'notify.js 应有冻结的事件类型常量数组');
  assert.deepEqual(
    listed[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')),
    ['chat_completed', 'chat_failed', 'confirmation_required'],
  );
  assert.doesNotMatch(src, /call_completed/, '不得含第 4 类（调用完成，N5）');

  // ② 段落切片：service 段零投递实现标识符；channel 段零事件类型字符串（不 switch）
  const svc = section(src, 'service 层', 'channel 层');
  const chan = section(src, 'channel 层', '全局入口');
  assert.ok(svc.length > 0 && chan.length > 0, '两段应以稳定标记分隔（可静态切片）');
  assert.doesNotMatch(svc, /Notification/, 'service 段内零投递实现标识符');
  assert.doesNotMatch(chan, /chat_completed|chat_failed|confirmation_required/, 'channel 段内零事件类型字符串');
  assert.doesNotMatch(chan, /switch\s*\(/, 'channel 不做事件类型分派');

  // ③ service 只产出 intent（四字段），投递标识符只在通道段出现
  assert.match(svc, /\{ type: eventType, title: tpl\.title, body: tpl\.body\(p\), target: tpl\.target\(p\) \}/, 'service 产出的 intent 恰四字段');
  assert.match(chan, /new Notification\(intent\.title, \{ body: intent\.body \}\)/, '通道只消费 intent');

  // ④ 零构建形态：经典脚本 + 全局入口（无 import / export / module）
  assert.doesNotMatch(src, /\bimport\b|\bexport\b/, '零构建 ⇒ 不得用模块语法');
  assert.match(src, /window\.oampNotify = entry;/, '对外以全局入口暴露（MI-1）');

  // ⑤ 不引入 Service Worker / Web Push / VAPID / WebSocket（§2.4）
  assert.doesNotMatch(src, /navigator\.serviceWorker|new WebSocket\(|PushManager|applicationServerKey/, '只经页面内通知 API 投递');
});

// ────────────────────────── T1：notify.js 运行期（service 产出 + 通道投递 / 降级） ──────────────────────────

test('T1：notify.js 运行期——service 产出 intent（第 4 类不通知、正文截断 80）', () => {
  const notify = loadNotify({});
  assert.deepEqual([...notify.EVENT_TYPES], ['chat_completed', 'chat_failed', 'confirmation_required']);
  assert.deepEqual(Object.keys(notify.service), ['onEvent']);
  assert.deepEqual(Object.keys(notify.channel), ['id', 'deliver']);

  assert.equal(notify.service.onEvent('call_completed', { chat_id: 'c1' }), null, '调用完成不产生通知（N5）');
  assert.equal(notify.service.onEvent('message', { chat_id: 'c1' }), null, '非契约事件一律不通知');

  assert.deepEqual(plain(notify.service.onEvent('chat_completed', { chat_id: 'c1', label: '修复登录', text: 'ok' })), {
    type: 'chat_completed',
    title: '对话已完成',
    body: '修复登录：ok',
    target: { chat_id: 'c1' },
  });
  const failed = notify.service.onEvent('chat_failed', { chat_id: 'c1' });
  assert.equal(failed.title, '对话失败');
  assert.equal(failed.body, 'c1', '标题取不到 ⇒ 回落 chat_id（正文不留悬空分隔符）');
  assert.deepEqual(plain(failed.target), { chat_id: 'c1' });

  const long = notify.service.onEvent('confirmation_required', {
    confirmation_id: 'cfm-1',
    agent_id: 'pb-dev',
    tool: 'bash',
    title: 'x'.repeat(120),
  });
  assert.equal(long.title, '需要你确认');
  assert.equal(long.body, `pb-dev 请求执行 bash：${'x'.repeat(80)}…`, '正文截断 80 字符');
  assert.deepEqual(plain(long.target), { confirmation_id: 'cfm-1' }, '确认类的点击去向是栏内条目，不切对话');
});

test('T1：notify.js 运行期——通道投递 / 静默降级 / 加载期零权限请求（PR 验收 8）', () => {
  // granted：dispatch 经 service → channel 投递一次，点击只透传 target
  const grantedLog = [];
  const granted = loadNotify({ notification: notificationStub('granted', grantedLog) });
  assert.equal(grantedLog.length, 0, '加载期零投递');
  assert.equal(granted.channel.id, 'notification-api');
  const intent = granted.dispatch('confirmation_required', { confirmation_id: 'cfm-1', agent_id: 'pb-dev', tool: 'bash', title: 'echo hi' });
  assert.equal(intent.type, 'confirmation_required', 'dispatch 返回 service 产出的 intent');
  assert.equal(grantedLog.length, 1, '权限已授予 ⇒ 投递一次');
  assert.equal(grantedLog[0].title, '需要你确认');
  assert.equal(grantedLog[0].body, 'pb-dev 请求执行 bash：echo hi');
  let target = null;
  granted.onTarget = (t) => (target = t);
  grantedLog[0].onclick();
  assert.deepEqual(plain(target), { confirmation_id: 'cfm-1' }, '点击去向只透传 intent.target（通道不认识事件类型）');

  assert.equal(granted.dispatch('call_completed', { chat_id: 'c1' }), null, '非 3 类 ⇒ 不产出 intent、不投递');
  assert.equal(grantedLog.length, 1);
  assert.equal(granted.channel.deliver(null), false);

  // denied / default：静默不投递，且不抛错、不影响 service 产出
  for (const permission of ['denied', 'default']) {
    const log = [];
    const notify = loadNotify({ notification: notificationStub(permission, log) });
    assert.equal(notify.dispatch('chat_failed', { chat_id: 'c1' }).type, 'chat_failed', `${permission}：service 照常产出`);
    assert.equal(log.length, 0, `${permission}：静默不投递（不提示、不重试）`);
  }

  // 环境无 Notification（旧浏览器 / 非安全上下文）：同样静默
  const none = loadNotify({});
  assert.equal(none.dispatch('chat_completed', { chat_id: 'c1' }).type, 'chat_completed');
  assert.equal(none.channel.deliver({ title: 't', body: 'b' }), false);

  // 权限请求只发生在手势入口内、且至多一次（T-11）
  const askLog = [];
  const askable = loadNotify({ notification: notificationStub('default', askLog) });
  assert.equal(askLog.filter((e) => e.ask).length, 0, '模块求值期零权限请求（加载不弹窗）');
  askable.requestPermission();
  askable.requestPermission();
  assert.equal(askLog.filter((e) => e.ask).length, 1, '同一页面至多请求一次');
});

// ────────────────────────── T2：style.css 三列 + 窄屏折叠（只追加） ──────────────────────────

test('T2：style.css——第三栏规则 + 窄屏断点，既有三栏规则逐字在场（PR 验收 6）', () => {
  const css = read('style.css');

  // 只追加的直接判据：既有声明文本原样在场
  assert.ok(
    css.includes('.layout { display: flex; height: calc(100% - 48px); min-height: 0; }'),
    '既有 .layout 规则应逐字在场',
  );
  assert.ok(
    css.includes('.detail { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-sub); }'),
    '既有 .detail 规则应逐字在场（主体仍最宽）',
  );
  assert.match(css, /\.sidebar \{\n  width: 320px;\n  flex: 0 0 320px;/, '既有 .sidebar 定宽声明应逐字在场');
  for (const rule of ['\\.layout\\.hidden', '\\.projects-view\\.hidden', '\\.project-bar\\.hidden']) {
    assert.match(css, new RegExp(`^${rule} \\{ display: none; \\}$`, 'm'), `既有真隐藏规则 ${rule} 应仍在`);
  }

  // 第三栏：定宽 320px（与 .sidebar 同口径）+ 折叠态自成一条规则（不复用别组件）
  assert.match(css, /\.inbox \{\n  flex: 0 0 320px;/, '第三栏定宽 320px');
  assert.match(css, /\.inbox \.inbox-list \{ display: none; \}/, '窄屏默认收起（自己的真隐藏规则）');

  // 窄屏断点：折叠为可开合面板（默认收起 → 一次点击展开），不做横向滚动
  const media = css.slice(css.indexOf('@media (max-width: 1100px)'));
  assert.ok(media.startsWith('@media (max-width: 1100px)'), '应含 1100px 断点');
  assert.match(media, /\.inbox\.open \{ bottom: 6px; width: 320px; max-width: none; \}/, '展开态：面板铺开');
  assert.match(media, /\.inbox\.open \.inbox-list \{ display: block; \}/, '展开后条目可见（一个点击可达）');
  assert.match(media, /\.inbox \{\n    position: absolute;/, '窄屏以浮层承载（不撑破横向布局 ⇒ 无横向滚动）');
});

// ────────────────────────── T3 / T4：app.js 静态契约 ──────────────────────────

test('T3：app.js 静态契约——confirmation 分支 / onopen 重建 / 点选即提交（PR 验收 3 / 4 / 5）', () => {
  const appJs = read('app.js');

  // 全局 SSE 的 confirmation 分支（首次入栏 ⇒ 入列 + 通知一次）
  assert.match(appJs, /es\.addEventListener\('confirmation',/, '全局链路应有 confirmation 分支');
  assert.match(appJs, /state\.inbox\.items = \[\.\.\.state\.inbox\.items, entry\];/, '增量帧按 id 去重后追加');

  // 重建 = 纯拉取、零缓存；调用点 = boot 与全局 SSE 的每次 open（含重连）
  assert.match(appJs, /es\.addEventListener\('open', loadConfirmations\)/, '每次 onopen（含自动重连）重建在途列表');
  assert.match(appJs, /api\('\/api\/confirmations'\)/, '重建面 = GET /api/confirmations');
  assert.match(appJs, /loadConfirmations\(\); \/\/ 0021 \/ F06/, 'boot 首屏拉取一次');
  assert.doesNotMatch(fnBody(appJs, 'loadConfirmations'), /oampNotify/, '重建函数体内零通知派发（重建不算「进入」）');
  assert.doesNotMatch(appJs, /localStorage|sessionStorage/, '前端零持久化（T-07）');
  assert.doesNotMatch(fnBody(appJs, 'inboxSource'), /api\(/, '栏内不额外拉取对话详情（取不到标题回落 chat_id）');

  // 条目三行 + 控件（T-02 / T-03）
  const item = fnBody(appJs, 'renderInboxItem');
  assert.match(item, /inbox-source/, '① 来源对话标识');
  assert.match(item, /inbox-request/, '② 工具名 + 动作描述');
  assert.match(item, /class="inbox-option"/, '③ 每个选项一个按钮');
  assert.match(item, /label \|\| o\.option_id/, 'label 缺失时显示 option_id');
  assert.match(item, /placeholder="拒绝理由 \/ 补充说明（可不填）"/, '③ 一个单行文本输入框');

  // 点选即裁决：POST + {option_id, text}；提交中 disabled；200 即移出（不等 SSE）；404 移出、其余保留
  const decide = fnBody(appJs, 'decide');
  assert.match(decide, /\/api\/confirmations\/\$\{encodeURIComponent\(entry\.confirmation_id\)\}\/decision/, '提交到裁决路由');
  assert.match(decide, /method: 'POST'/);
  assert.match(decide, /body: \{ option_id: button\.dataset\.option, text: textInput\.value \}/, 'body = {option_id, text}（文本前端不校验）');
  assert.match(decide, /btn\.disabled = true;/, '提交中按钮 disabled');
  assert.match(decide, /提交中…/);
  assert.match(decide, /dropInboxItem\(entry\.confirmation_id\)/, '成功即整条移出（不等 SSE）');
  assert.match(decide, /err\.status === 404/, '404 已裁决 / 已失效：同样移出、不重放');
  assert.doesNotMatch(decide, /alert\(|confirm\(/, '400 等失败不新增弹窗（Q2：保留条目）');

  // 窄屏开合不切换主视图（不调 openChat、不改 state.chat）
  const toggle = appJs.slice(appJs.indexOf("$('btn-inbox-toggle').onclick"), appJs.indexOf('oampNotify.onTarget'));
  assert.match(toggle, /state\.inbox\.open = !state\.inbox\.open;/, '一次点击开合');
  assert.doesNotMatch(toggle, /openChat|state\.chat/, '开合不切换主视图');
  assert.match(toggle, /oampNotify\.requestPermission\(\)/, '手势入口（T-11）');

  // 既有面零回归：会话订阅 4 类事件 + 全局上下线分支逐字在场
  assert.match(appJs, /for \(const type of \['message', 'task_update', 'chat_state', 'notice'\]\)/, '会话订阅 4 类事件不变');
  assert.match(appJs, /es\.addEventListener\('agent_online',/, '全局上线分支不变');
  assert.match(appJs, /es\.addEventListener\('agent_offline',/, '全局下线分支不变');
  assert.match(appJs, /es\.onopen = \(\) => loadAgents\(\);/, '既有 onopen 对齐逐字不变（MI-05）');
});

test('T4：app.js 静态契约——三类事件派发 / 调用面零通知 / 零投递实现（PR 验收 7 / 9）', () => {
  const appJs = read('app.js');

  // 派发点恰 2 处：全局 chat_state 分支（终态派生）+ confirmation 分支（首次入栏）
  assert.equal((appJs.match(/oampNotify\.dispatch\(/g) || []).length, 2, 'notify 派发点恰 2 处');
  const states = fnBody(appJs, 'connectAgentEvents');
  assert.match(states, /oampNotify\.dispatch\('confirmation_required', entry\);/, '确认项首次入栏 ⇒ 通知一次');
  assert.match(states, /oampNotify\.dispatch\(data\.state === 'completed' \? 'chat_completed' : 'chat_failed'/, '终态派生两类事件');
  assert.match(states, /if \(data\.state !== 'completed' && data\.state !== 'failed'\) return;/, '非终态不通知');
  assert.match(states, /if \(prev === data\.state\) return;/, '同一终态重复广播不重复派发（MI-2）');
  assert.match(states, /const chatStates = new Map\(\)/, '派生状态表按 chat_id 维护（不依赖左栏列表）');
  assert.doesNotMatch(states, /call_result|call_state|chat-calls:/, 'hub 调用面不产生通知（N5）');

  // 零投递实现：投递与权限全在 notify.js
  assert.doesNotMatch(appJs, /new Notification|Notification\.requestPermission/, 'app.js 不得直接投递 / 请求权限');
  assert.match(appJs, /oampNotify\.onTarget = focusFromNotify;/, '点击去向处理器由 app.js 注入');
  assert.match(fnBody(appJs, 'focusFromNotify'), /openChat\(target\.chat_id\)/, '终态类点击 ⇒ 切到该对话');
  assert.equal((appJs.match(/oampNotify\.requestPermission\(\)/g) || []).length, 2, '手势入口只在第三栏交互回调内（开合 / 点选）');
  assert.match(fnBody(appJs, 'decide'), /oampNotify\.requestPermission\(\)/, '点选选项同样触发手势入口');
});

// ────────────────────────── T5：静态面 HTTP（PR 验收 1 / 10） ──────────────────────────

test('T5：静态面 HTTP——/notify.js 200 且与仓库文件逐字节相等；/、/app.js、/style.css 仍 200', async (t) => {
  const router = await startRouter({ envExtra: LEASE_ENV });
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-inbox-console-'));
  const web = await startWeb(router.socketPath, pickPort(), { OAMP_DB: path.join(dbDir, 'sql.db') });
  t.after(async () => {
    await stopAll([web, router]);
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  const cases = [
    ['/notify.js', 'text/javascript; charset=utf-8', 'notify.js'],
    ['/', 'text/html; charset=utf-8', 'index.html'],
    ['/app.js', 'text/javascript; charset=utf-8', 'app.js'],
    ['/style.css', 'text/css; charset=utf-8', 'style.css'],
  ];
  for (const [p, type, file] of cases) {
    const res = await fetch(`${web.base}${p}`);
    assert.equal(res.status, 200, `${p} 应可直达（200；/notify.js 由 STATIC_FILES 白名单登记）`);
    assert.equal(res.headers.get('content-type'), type, `${p} 的响应类型应为 ${type}`);
    const served = Buffer.from(await res.arrayBuffer());
    assert.equal(Buffer.compare(served, fs.readFileSync(path.join(ROOT, 'web', file))), 0, `${p} 应与仓库文件逐字节相等`);
  }

  // 第三栏与通知模块都落在既有单页内（不新增页面 / 路由）：/ 的 HTML 同时含两处静态面
  const index = await (await fetch(`${web.base}/`)).text();
  assert.match(index, /<section id="inbox"/);
  assert.match(index, /<script src="\/notify\.js"><\/script>/);
});
