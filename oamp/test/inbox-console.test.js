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

/** app.js 栏内第二行文本函数：提取顶层函数体在沙箱内执行（断言跑产出，不做源码文本匹配）。 */
function loadInboxRequest() {
  const src = read('app.js');
  const code = `function escapeHtml(s) {${fnBody(src, 'escapeHtml')}\n}\nfunction inboxRequest(entry) {${fnBody(src, 'inboxRequest')}\n}\ninboxRequest;`;
  return vm.runInNewContext(code, {}, { filename: 'web/app.js#inboxRequest' });
}

/** app.js 条目渲染（0023 / F05）：提取顶层函数体在沙箱内执行——纯字符串产出 ⇒ 零 DOM 桩（`state.chats` 为空
 *  ⇒ 来源标识回落 chat_id）。断言跑产出字符串，不做源码文本匹配。 */
function loadRenderInboxItem() {
  const src = read('app.js');
  const code = [
    `function escapeHtml(s) {${fnBody(src, 'escapeHtml')}\n}`,
    `function inboxSource(entry) {${fnBody(src, 'inboxSource')}\n}`,
    `function inboxRequest(entry) {${fnBody(src, 'inboxRequest')}\n}`,
    `function renderInboxChoice(entry, o, multiple) {${fnBody(src, 'renderInboxChoice')}\n}`,
    `function renderInboxItem(entry) {${fnBody(src, 'renderInboxItem')}\n}`,
    'renderInboxItem;',
  ].join('\n');
  return vm.runInNewContext(code, { state: { chats: [] } }, { filename: 'web/app.js#renderInboxItem' });
}

/** 栏内条目最小桩（无 DOM 仿真）：只实现 question 提交路径读到的三个查询面，勾选/未勾选由 `picks` 给定。 */
function itemStub({ picks = [], text = '' } = {}) {
  const boxes = picks.map(({ option, checked }) => ({ dataset: { option }, checked, disabled: false }));
  const textInput = { value: text, disabled: false };
  const submitBtn = { disabled: false, textContent: '提交' };
  return {
    boxes,
    textInput,
    submitBtn,
    querySelector: (sel) => (sel === '.inbox-text' ? textInput : submitBtn),
    querySelectorAll: (sel) => (sel.endsWith(':checked') ? boxes.filter((b) => b.checked) : boxes),
  };
}

/** app.js question 提交路径（0023 / F05 验收 3）：提取顶层函数体在沙箱内执行，桩掉 api / oampNotify /
 *  dropInboxItem / renderInbox 并记录每次请求、移出与重绘（`fail` 注入失败响应）。 */
function loadSubmitQuestion({ fail = null } = {}) {
  const log = { posts: [], asks: 0, drops: [], redraws: 0 };
  const sandbox = {
    oampNotify: { requestPermission: () => { log.asks += 1; } },
    api: async (path, opts) => {
      log.posts.push({ path, ...opts });
      if (fail) throw fail;
      return {};
    },
    dropInboxItem: (confirmationId) => log.drops.push(confirmationId),
    renderInbox: () => { log.redraws += 1; },
  };
  const code = `async function submitQuestion(entry, item) {${fnBody(read('app.js'), 'submitQuestion')}\n}\nsubmitQuestion;`;
  return { fn: vm.runInNewContext(code, sandbox, { filename: 'web/app.js#submitQuestion' }), log };
}

/** 栏内移出路径（0023 / F06 验收 2）：提取 `dropInboxItem` 在沙箱内执行（`state.inbox.items` 给定 N 条，
 *  `renderInbox` 以桩替代 ⇒ 只判「谁被移出」）。 */
function loadDropInboxItem(items) {
  const sandbox = { state: { inbox: { items } }, renderInbox() {} };
  const code = `function dropInboxItem(confirmationId) {${fnBody(read('app.js'), 'dropInboxItem')}\n}\ndropInboxItem;`;
  return { fn: vm.runInNewContext(code, sandbox, { filename: 'web/app.js#dropInboxItem' }), sandbox };
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

// ────────────────────────── pr-005：消费侧 tool 空值语义（栏内行 + 通知正文） ──────────────────────────

test('T1：消费侧空值语义——tool 缺失不产伪值（栏内行 + 通知正文，PR 验收 1~6）', () => {
  const inboxRequest = loadInboxRequest();

  // 栏内第二行：tool 可得 ⇒ 逐字同现状（PR 验收 2）；缺失（null / 无键）⇒ 整段省略（PR 验收 1）
  assert.equal(inboxRequest({ tool: 'bash', title: 'echo E2E-1' }), 'bash · echo E2E-1');
  assert.equal(inboxRequest({ tool: null, title: 'echo E2E-1' }), 'echo E2E-1', 'tool=null ⇒ 省略该段');
  assert.equal(inboxRequest({ title: 'echo E2E-1' }), 'echo E2E-1', '无 tool 键 ⇒ 同值');
  assert.equal(inboxRequest({ tool: null, title: null }), '', '两段皆空 ⇒ 空串（不留悬空 ·）');
  const rows = [
    inboxRequest({ tool: null, title: 'echo E2E-1' }),
    inboxRequest({ title: 'echo E2E-1' }),
    inboxRequest({ tool: null, title: null }),
  ];
  for (const row of rows) {
    assert.doesNotMatch(row, /null|undefined/, '不得出现字面量 null / undefined（也不得以 title 猜工具名）');
    assert.doesNotMatch(row, /^\s*·|·\s*$/, '不得留下悬空 ·');
  }
  assert.notEqual(rows[0], inboxRequest({ tool: 'bash', title: 'echo E2E-1' }), '可得 / 缺失两态产出可区分（被测值确实参与逻辑）');

  // 转义面不变（PR 验收 3）：每段先 escapeHtml 再拼
  const escaped = inboxRequest({ tool: null, title: '<img src=x onerror=1>' });
  assert.match(escaped, /&lt;img/);
  assert.doesNotMatch(escaped, /<img/);
  assert.equal(inboxRequest({ tool: '<b>', title: 'x' }), '&lt;b&gt; · x', '工具名同样逐段转义');

  // 通知正文：同一口径（PR 验收 4 / 5；tool='bash' 的逐字档由本文件既有断言原文钉死）
  const notify = loadNotify({});
  const base = { confirmation_id: 'cfm-1', agent_id: 'pb-dev', title: 'echo hi' };
  const bodyOf = (payload) => notify.service.onEvent('confirmation_required', payload).body;
  assert.equal(bodyOf({ ...base, tool: null }), 'pb-dev 请求执行 echo hi', 'tool=null ⇒ 省略该段');
  assert.equal(bodyOf(base), 'pb-dev 请求执行 echo hi', '无 tool 键 ⇒ 同值');
  assert.equal(bodyOf({ ...base, tool: 'bash' }), 'pb-dev 请求执行 bash：echo hi', 'tool 可得 ⇒ 逐字同现状');
  for (const body of [bodyOf({ ...base, tool: null }), bodyOf(base)]) {
    assert.doesNotMatch(body, /null|undefined/, '不得出现字面量 null / undefined');
    assert.doesNotMatch(body, /：/, '不留悬空 ：');
  }
  assert.notEqual(bodyOf({ ...base, tool: 'bash' }), bodyOf(base), '可得 / 缺失两态产出可区分');
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

// ────────────────────────── 0023 pr-003：question 控件样式（只追加） ──────────────────────────

test('T3：style.css——question 控件样式只追加且逐名命中控件类名（0023 PR 验收 9 / F16）', () => {
  const css = read('style.css');

  // 新增选择器逐名命中 T1 产出的控件类名（可勾选控件 / 勾选文本 / 「提交」按钮）
  for (const sel of ['.inbox-choice', '.inbox-choice-box', '.inbox-choice-text', '.inbox-submit']) {
    assert.match(css, new RegExp(`${sel.replace('.', '\\.')}[\\s,:{]`), `新增规则应命中 ${sel}（T1 交付的控件类名）`);
  }
  assert.match(css, /\.inbox-choice-box:checked \+ \.inbox-choice-text \{/, '选中态有可见样式（:checked 兄弟选择器，MI-1 可见判据）');
  assert.match(css, /\.inbox-submit:disabled \{/, '提交按钮的禁用态有可见样式');

  // 只追加：既有 inbox 族规则逐字仍在（question 分支相邻面的既有声明零改写）
  for (const rule of [
    '.inbox-option:hover:not(:disabled) { border-color: var(--green); color: var(--green); }',
    '.inbox-option:disabled { opacity: 0.5; cursor: default; }',
    '.inbox-text:focus { outline: none; border-color: var(--green); }',
  ]) {
    assert.ok(css.includes(rule), `既有声明应逐字在场：${rule}`);
  }

  // 零新框架 / 零外链（F16）
  assert.doesNotMatch(css, /@import|@font-face|url\(/, '零 @import / 零外链字体（零框架、零构建）');
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

  // 0023 / F05（PR 验收 1 / 2 / 5）：question 类渲染分化——原生勾选控件两态 + 自由文本 + 一个「提交」按钮
  const choice = fnBody(appJs, 'renderInboxChoice');
  assert.match(choice, /type="checkbox"/, '多值 = 原生 checkbox');
  assert.match(choice, /type="radio"/, '单值 = 同名原生 radio（单选即取舍：第二次选择替换第一次）');
  assert.match(choice, /name="inbox-choice-/, '同组同名 ⇒ 每条各自成组、组内至多单值（全名逐字锁在运行期断言）');
  assert.match(choice, /data-option=/, '勾选值 = 该选项的 option_id');
  assert.match(item, /entry\.request_kind === 'question'/, 'question 类走独立渲染分支（A8 口径：非 question 即 permission）');
  assert.match(item, /entry\.multiple === true/, 'multiple 非 true（false / 缺失 / 非布尔）一律单选');
  assert.match(item, /class="inbox-submit"/, 'question 类一个「提交」按钮');

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
  // 0023 / T-11（PR 验收 5 / MI-6）：question 提交入口新增第三处手势点 ⇒ 计数由 2 变 3，且三处全部落在第三栏
  //   交互回调内（开合块 / decide / submitQuestion）——零落在加载期、事件派发面或其他视图。
  assert.equal((appJs.match(/oampNotify\.requestPermission\(\)/g) || []).length, 3, '手势入口只在第三栏交互回调内（开合 / 点选 / question 提交）');
  const toggle = appJs.slice(appJs.indexOf("$('btn-inbox-toggle').onclick"), appJs.indexOf('oampNotify.onTarget'));
  const gestureOwners = [toggle, fnBody(appJs, 'decide'), fnBody(appJs, 'submitQuestion')];
  const owned = gestureOwners.reduce((n, scope) => n + (scope.match(/oampNotify\.requestPermission\(\)/g) || []).length, 0);
  assert.equal(owned, 3, '三处手势点全部落在第三栏交互回调内（落点判据，MI-6）');
  assert.match(fnBody(appJs, 'decide'), /oampNotify\.requestPermission\(\)/, '点选选项同样触发手势入口');
  assert.match(fnBody(appJs, 'submitQuestion'), /oampNotify\.requestPermission\(\)/, 'question 提交同样触发手势入口');

  // 0023 / F05 验收 3（PR 验收 3 / MI-5）：两类提交体各有逐字锁，强度不降
  const submitQuestion = fnBody(appJs, 'submitQuestion');
  assert.match(submitQuestion, /body: \{ option_ids: optionIds, text \}/, 'question 类 body 逐字锁 = {option_ids, text}');
  assert.doesNotMatch(submitQuestion, /option_id:/, 'question 类不回落 permission 形态');
  assert.match(submitQuestion, /method: 'POST'/);
  assert.match(submitQuestion, /\/api\/confirmations\/\$\{encodeURIComponent\(entry\.confirmation_id\)\}\/decision/);
  assert.match(submitQuestion, /dropInboxItem\(entry\.confirmation_id\)/, '成功即整条移出（不等 SSE）');
  assert.match(submitQuestion, /err\.status === 404/, '404 已裁决 / 已失效：同样移出、不重放');
  assert.doesNotMatch(submitQuestion, /alert\(|confirm\(/, '失败不新增弹窗（Q2 / Q3：保留条目）');
  assert.doesNotMatch(fnBody(appJs, 'decide'), /option_ids/, 'permission 类 body 不得混入 question 形态（逐字不变）');
});

// ────────────────────────── 0023 pr-003：question 类渲染与提交载荷分化（运行期，vm 沙箱内） ──────────────────────────
// 运行期判据一律跑「函数产出」（渲染字符串 / 请求 body / 移出集合），不做源码文本匹配；无 DOM 仿真
//   （渲染函数纯字符串产出；提交路径以最小条目桩注入查询面）。真实交互链归阶段 6 端到端验收。

test('T1：question 类条目渲染——原生勾选控件两态 + 自由文本 + 提交按钮（0023 PR 验收 1 / 2 / F05 验收 1~4）', () => {
  const renderInboxItem = loadRenderInboxItem();
  const base = {
    confirmation_id: 'cfm-q1',
    request_kind: 'question',
    chat_id: 'chat-1',
    agent_id: 'pb-dev',
    tool: 'ask_user',
    title: '优先保证哪一点？',
    options: [{ option_id: '思考过程可见' }, { option_id: '工具调用可审批' }],
    created_at: 1,
  };

  // ① 来源对话标识 + ② 问题文本（既有三行前两行）+ ③ 每个选项一个可勾选控件 + ④ 自由文本 + ⑤ 「提交」
  const single = renderInboxItem({ ...base, multiple: false });
  assert.match(single, /<div class="inbox-source">pb-dev · chat-1<\/div>/, '① 来源对话标识（既有首行）');
  assert.match(single, /<div class="inbox-request">ask_user · 优先保证哪一点？<\/div>/, '② tool · title（title = 问题文本）');
  assert.match(single, />思考过程可见<\/span>/, '选项文本在场');
  assert.match(single, /data-option="工具调用可审批"/, '勾选值 = 该选项的 option_id');
  assert.match(single, /placeholder="补充说明或作答（可不填）"/, '④ 自由文本输入恒在（question 类蕴含）');
  assert.match(single, /<button class="inbox-submit">提交<\/button>/, '⑤ 一个「提交」按钮');
  assert.doesNotMatch(single, /class="inbox-option"/, 'question 类不再渲染「点选即裁决」按钮');
  assert.equal((single.match(/type="checkbox"/g) || []).length, 0, 'multiple:false ⇒ 不得出现多选控件');
  assert.equal((single.match(/type="radio"/g) || []).length, 2, '③ 每个选项一个可勾选控件');
  assert.deepEqual(
    [...single.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]),
    ['inbox-choice-cfm-q1', 'inbox-choice-cfm-q1'],
    '单值语义可判：同组同名（同一条各自成组）⇒ 第二次选择替换第一次',
  );

  // multiple:true ⇒ 允许同时选中多项；两态产物可区分（MI-1）
  const multi = renderInboxItem({ ...base, multiple: true });
  assert.equal((multi.match(/type="checkbox"/g) || []).length, 2, 'multiple:true ⇒ 多选');
  assert.doesNotMatch(multi, /type="radio"/, '多选态不得出现单值控件');
  assert.notEqual(multi, single, '两态产物可区分（单选提问不得允许双选）');

  // multiple 非 true（缺失 / 非布尔）⇒ 一律单选（A8 兜底）
  for (const multiple of [undefined, null, 'true', 1]) {
    const html = renderInboxItem({ ...base, multiple });
    assert.equal((html.match(/type="radio"/g) || []).length, 2, `multiple=${String(multiple)} ⇒ 单选`);
    assert.doesNotMatch(html, /type="checkbox"/, `multiple=${String(multiple)} ⇒ 非多选`);
  }

  // 选项文本 / option_id 都先 escapeHtml（既有体例）
  const escaped = renderInboxItem({ ...base, multiple: true, options: [{ option_id: '<img>', label: '"><b>x</b>' }] });
  assert.doesNotMatch(escaped, /<img|"><b>/, '选项文本 / option_id 均经 escapeHtml');
});

test('T1：无选项纯自由文本 + permission 类逐字零退化（0023 PR 验收 2 / 5 · F05 验收 4 · F10 验收 3）', () => {
  const renderInboxItem = loadRenderInboxItem();
  const base = {
    confirmation_id: 'cfm-q1',
    request_kind: 'question',
    chat_id: 'chat-1',
    agent_id: 'pb-dev',
    tool: 'ask',
    title: '请补充说明',
    created_at: 1,
  };

  // options: []（question 类）⇒ 条目仍完整渲染：零勾选控件、无空容器残渣、文本 + 提交按钮在场（无「选项必选」阻塞）
  for (const options of [[], undefined]) {
    const empty = renderInboxItem({ ...base, options, multiple: false });
    assert.equal((empty.match(/<input type="(checkbox|radio)"/g) || []).length, 0, '选项区为空');
    assert.doesNotMatch(empty, /class="inbox-actions"/, '不留空容器残渣');
    assert.match(empty, /class="inbox-text"/, '文本仍可提交');
    assert.match(empty, /<button class="inbox-submit">提交<\/button>/, '提交入口仍在');
    assert.match(empty, /<div class="inbox-item" data-confirmation="cfm-q1">/, '条目容器仍在');
  }

  // permission 类：request_kind 缺失 / 'permission' / 域外值 ⇒ 与 0021 逐字一致的同一产物
  const entry = {
    confirmation_id: 'cfm-p1',
    chat_id: 'chat-1',
    agent_id: 'pb-dev',
    tool: 'bash',
    title: 'echo hi',
    options: [{ option_id: 'allow', label: '允许' }, { option_id: 'deny', label: '拒绝' }, { option_id: 'other' }],
    created_at: 1,
  };
  const expected = [
    '<div class="inbox-item" data-confirmation="cfm-p1">',
    '      <div class="inbox-source">pb-dev · chat-1</div>',
    '      <div class="inbox-request">bash · echo hi</div>',
    '      <div class="inbox-actions"><button class="inbox-option" data-option="allow">允许</button>' +
      '<button class="inbox-option" data-option="deny">拒绝</button>' +
      '<button class="inbox-option" data-option="other">other</button></div>',
    '      <input class="inbox-text" type="text" autocomplete="off" placeholder="拒绝理由 / 补充说明（可不填）" />',
    '    </div>',
  ].join('\n');
  assert.equal(renderInboxItem({ ...entry, request_kind: 'permission' }), expected, 'permission 类逐字 = 0021 形态');
  assert.equal(renderInboxItem(entry), expected, 'request_kind 缺失 ⇒ 同一产物（A8 兜底）');
  assert.equal(renderInboxItem({ ...entry, request_kind: 'PENDING' }), expected, '域外值 ⇒ 同一产物');
  assert.ok(expected.includes('placeholder="拒绝理由 / 补充说明（可不填）"'), 'permission 类 placeholder 文案逐字保留（MI-2）');
  assert.doesNotMatch(expected, /inbox-submit|type="(checkbox|radio)"/, 'permission 类零 question 控件');
});

test('T1：公共面零改动——inboxSource / inboxRequest 函数体逐字不变（0023 PR 验收 5 / N11）', () => {
  const src = read('app.js');
  assert.equal(
    fnBody(src, 'inboxSource'),
    "\n  const chat = state.chats.find((c) => c.chat_id === entry.chat_id);\n  return `${entry.agent_id} · ${(chat && chat.title) || entry.chat_id}`;",
    '来源标识函数体逐字不变（本 PR 不出现在该函数体内）',
  );
  assert.equal(
    fnBody(src, 'inboxRequest'),
    "\n  const segs = [entry.tool, entry.title].filter((s) => s !== null && s !== undefined);\n  return segs.map(escapeHtml).join(' · ');",
    '栏内第二行函数体逐字不变（question 类第二行仍是 tool · title）',
  );
});

test('T2：question 提交体 {option_ids, text}——同值同序 / 空勾选空数组 / 三态同路径（0023 PR 验收 3 · F05 验收 3 · F07 验收 1）', async () => {
  const entry = { confirmation_id: 'cfm-q1', request_kind: 'question' };
  const run = async (item, opts) => {
    const { fn, log } = loadSubmitQuestion(opts);
    await fn(entry, item);
    return log;
  };

  // 勾选项 + 文本：option_ids 与勾选集同值同序（不排序 / 不去重），文本原样（前端不 trim）
  const both = await run(itemStub({
    picks: [{ option: 'A', checked: true }, { option: 'B', checked: false }, { option: 'C', checked: true }],
    text: '  都要  ',
  }));
  assert.equal(both.posts.length, 1, '一次提交恰一次请求');
  assert.equal(both.posts[0].path, '/api/confirmations/cfm-q1/decision');
  assert.equal(both.posts[0].method, 'POST');
  assert.deepEqual(plain(both.posts[0].body), { option_ids: ['A', 'C'], text: '  都要  ' }, 'option_ids 同值同序 + 文本原样');

  // 仅文本（无勾选）⇒ option_ids 为空数组（不是缺键）
  const textOnly = await run(itemStub({ text: '优先保证工具调用可审批' }));
  assert.deepEqual(plain(textOnly.posts[0].body), { option_ids: [], text: '优先保证工具调用可审批' });
  assert.ok('option_ids' in plain(textOnly.posts[0].body), '未勾选 ⇒ 空数组，不是缺键');

  // 仅勾选（文本空）⇒ 同一路径，不回落 {option_id, text}
  const pickOnly = await run(itemStub({ picks: [{ option: 'A', checked: true }] }));
  assert.deepEqual(plain(pickOnly.posts[0].body), { option_ids: ['A'], text: '' });
  for (const log of [both, textOnly, pickOnly]) {
    assert.ok(!('option_id' in plain(log.posts[0].body)), 'question 类不得回落 permission 形态');
  }

  // 全空提交：前端不短路（Q3）⇒ 仍发请求；服务端 400 ⇒ 条目保留 + 重绘复位
  const failed = await run(itemStub({}), { fail: Object.assign(new Error('400'), { status: 400 }) });
  assert.equal(failed.posts.length, 1, '全空提交仍发请求（权威判定在服务端，L2-7）');
  assert.deepEqual(plain(failed.posts[0].body), { option_ids: [], text: '' });
  assert.deepEqual(failed.drops, [], '400 ⇒ 条目保留在途');
  assert.equal(failed.redraws, 1, '其余失败 ⇒ 重绘复位控件');
});

test('T2：一次提交即一次裁决——控件 disabled / 200 移出 / 404 移出 / 其余保留（0023 PR 验收 4 · F06 验收 1）', async () => {
  const entry = { confirmation_id: 'cfm-q1', request_kind: 'question' };

  // 200 ⇒ 立即整条移出（不等 SSE）；提交中该条相关控件全 disabled
  const item = itemStub({ picks: [{ option: 'A', checked: true }, { option: 'B', checked: false }], text: 'x' });
  const { fn, log } = loadSubmitQuestion();
  await fn(entry, item);
  assert.equal(log.asks, 1, '提交入口 = 手势入口（至多一次）');
  assert.deepEqual(item.boxes.map((b) => b.disabled), [true, true], '提交中勾选控件全 disabled');
  assert.equal(item.textInput.disabled, true, '提交中文本输入 disabled');
  assert.equal(item.submitBtn.disabled, true, '提交中「提交」按钮 disabled');
  assert.equal(item.submitBtn.textContent, '提交中…');
  assert.deepEqual(log.drops, ['cfm-q1'], '200 ⇒ 立即移出');
  assert.equal(log.redraws, 0, '成功不移出以外不重绘');

  // 404（已裁决 / 已失效）⇒ 同样移出、不重放
  const gone = itemStub({});
  const g = loadSubmitQuestion({ fail: Object.assign(new Error('404'), { status: 404 }) });
  await g.fn(entry, gone);
  assert.deepEqual(g.log.drops, ['cfm-q1'], '404 ⇒ 同样移出');
  assert.equal(g.log.redraws, 0, '404 不重绘（条目已移出）');

  // 其余失败 ⇒ 条目保留（重绘复位控件），零新增弹窗
  const kept = itemStub({});
  const f = loadSubmitQuestion({ fail: Object.assign(new Error('500'), { status: 500 }) });
  await f.fn(entry, kept);
  assert.deepEqual(f.log.drops, [], '其余失败 ⇒ 不移出');
  assert.equal(f.log.redraws, 1, '其余失败 ⇒ 重绘保留条目');
});

test('T2：栏内接线按类型分派 + 多问题独立移出（0023 PR 验收 6 · F06 验收 1/2）', () => {
  const appJs = read('app.js');
  const render = fnBody(appJs, 'renderInbox');
  assert.match(render, /entry\.request_kind === 'question'/, '接线按 A8 口径分派');
  assert.match(render, /querySelector\('\.inbox-submit'\)\.onclick = \(\) => submitQuestion\(entry, el\)/, 'question 条目绑提交路径');
  assert.match(
    render,
    /for \(const btn of el\.querySelectorAll\('\.inbox-option'\)\) btn\.onclick = \(\) => decide\(entry, btn, text\);/,
    'permission 条目仍绑既有「点选即裁决」',
  );
  assert.match(
    appJs.slice(appJs.indexOf('const state = {'), appJs.indexOf('};', appJs.indexOf('const state = {'))),
    /inbox: \{ items: \[\], open: false \}/,
    'state.inbox 形状零改动（无「正在提交」等跨条目共享状态）',
  );

  // 两条 question：只作答一条 ⇒ 该条移出、其余仍在（按 id 独立移出，各自 confirmation_id）
  const items = [
    { confirmation_id: 'cfm-q1', request_kind: 'question' },
    { confirmation_id: 'cfm-q2', request_kind: 'question' },
  ];
  const { fn, sandbox } = loadDropInboxItem(items);
  fn('cfm-q1');
  assert.deepEqual(sandbox.state.inbox.items.map((i) => i.confirmation_id), ['cfm-q2'], '只提交的那条移出，其余仍在');
  assert.equal(sandbox.state.inbox.items.length, 1, '未被提交的条目未被连带移除');
  assert.equal(sandbox.state.inbox.items[0].request_kind, 'question', '其余条目形态未变（仍可独立提交）');
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
