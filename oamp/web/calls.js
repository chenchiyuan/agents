// web/calls.js — 控制台调用面（0018 / F13 / architecture §6）
// 数据流：roster = 加载时取一次 GET /api/calls（服务端按 created_at 倒序，页面不重排）+ 随后 5 s 轮询刷新
//   （沿用既有顶栏 agent panel 的 5 s 轮询体例，不引入新推送机制）；
//   进度 = 点击某行 ⇒ 按调用订阅 GET /api/calls/<call_id>/stream，渲染 call_state / call_update / call_result；
//   切换选中项 ⇒ 先关闭旧订阅再开新订阅（体例同 app.js 的 subscribe/unsubscribe，任一时刻至多一个订阅）。
// 零客户端排序 / 过滤 / 分页 / 编排入口；不呈现无数据源字段与取消类控件（F13 验收 4）。

const ROSTER_REFRESH_MS = 5000; // roster 刷新间隔（与 app.js 的 AGENT_PANEL_REFRESH_MS 同值同体例：只承担新鲜度）
const CALL_EVENT_TYPES = ['call_state', 'call_update', 'call_result']; // 按调用订阅的事件名全集（事件名逐字取自服务端发布名）
const PLACEHOLDER = '—'; // 空值占位（沿用既有字形，不造值、不推测）

const BADGE_CLASS = { submitted: 'badge-submitted', working: 'badge-working', completed: 'badge-completed', failed: 'badge-failed' };

const $ = (id) => document.getElementById(id);

let calls = []; // 最近一次 roster（整表重绘，不做 DOM diff）
let selectedId = null; // 当前选中行的 call_id（null = 未选中）
let source = null; // 当前按调用订阅（切换选中项前先 close）

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 状态徽标（复用既有 .badge-* 规则，零新样式）。 */
function badge(stateName) {
  return `<span class="badge ${BADGE_CLASS[stateName] || 'badge-idle'}">${escapeHtml(stateName || 'idle')}</span>`;
}

/** 毫秒时间戳 → 本地可读时间（仅展示格式化，不重算口径）；空值 / 非法值 → 占位符。 */
function fmtTime(ms) {
  if (ms === null || ms === undefined) return PLACEHOLDER;
  const at = Number(ms);
  return Number.isFinite(at) ? new Date(at).toLocaleString('zh-CN', { hour12: false }) : PLACEHOLDER;
}

/** 字符串字段展示：空串 / 非字符串 → 占位符（进行中调用无 agent / model）。 */
function fmtText(v) {
  return typeof v === 'string' && v !== '' ? v : PLACEHOLDER;
}

// ── 块 3：空态与错误提示条（roster 侧与订阅侧各存一条，同时展示、不互相遮盖）──
let rosterHint = null; // { text, error }
let streamHint = null; // { text, error }

function renderHint() {
  const parts = [];
  if (rosterHint !== null) parts.push(rosterHint.text);
  if (streamHint !== null) parts.push(streamHint.text);
  const el = $('call-hint');
  el.textContent = parts.join(' ');
  el.className = rosterHint?.error || streamHint?.error ? 'hint error' : 'hint';
}

function setRosterHint(text, error = false) {
  rosterHint = text === '' ? null : { text, error };
  renderHint();
}

function setStreamHint(text, error = false) {
  streamHint = text === '' ? null : { text, error };
  renderHint();
}

// ── 块 1：roster 表（六列逐字取自响应键，不新增派生列）──
function renderRoster() {
  $('call-rows').innerHTML = calls
    .map(
      (c) =>
        `<tr data-call-id="${escapeHtml(c.call_id)}"><td><code>${escapeHtml(c.call_id)}</code></td><td>${escapeHtml(fmtText(c.agent))}</td><td>${badge(c.state)}</td><td>${escapeHtml(fmtTime(c.started_at))}</td><td>${escapeHtml(fmtTime(c.ended_at))}</td><td>${escapeHtml(fmtText(c.model))}</td></tr>`,
    )
    .join('');
}

/** 加载时取一次 + 5 s 轮询；失败不白屏（既有行保留，错误落块 3）。 */
async function loadCalls() {
  let data = null;
  try {
    const res = await fetch('/api/calls');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    setRosterHint(`调用列表加载失败：${err.message}`, true);
    return;
  }
  calls = Array.isArray(data.calls) ? data.calls : [];
  renderRoster();
  setRosterHint(calls.length === 0 ? '暂无调用——发起一次调用后出现在此。' : '');
}

// ── 块 2：选中行的进度区 ──
function renderProgress() {
  const box = $('call-progress');
  if (selectedId === null) {
    box.innerHTML = '<p class="muted">点击上方任一行，查看该调用的进度。</p>';
    return;
  }
  box.innerHTML =
    `<h2>调用进度：<code class="route-path">${escapeHtml(selectedId)}</code> <span id="call-state" class="badge badge-idle">—</span></h2>` +
    '<div class="sse-log" id="call-log"></div>';
}

function setCallState(state) {
  const el = $('call-state');
  if (el === null) return;
  el.className = `badge ${BADGE_CLASS[state] || 'badge-idle'}`;
  el.textContent = state || 'idle';
}

function appendLog(text) {
  const log = $('call-log');
  if (log === null || text === '') return;
  const entry = document.createElement('div');
  entry.className = 'sse-entry';
  entry.textContent = text;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ── 按调用订阅（SSE）──
function unsubscribe() {
  if (source !== null) {
    source.close();
    source = null;
  }
}

/** 选中某行：先关闭旧订阅、再开新订阅（不订阅对话作用域与全局流）。 */
function selectCall(callId) {
  selectedId = callId;
  unsubscribe();
  setStreamHint('');
  renderProgress();
  source = new EventSource(`/api/calls/${encodeURIComponent(callId)}/stream`);
  source.onopen = () => setStreamHint('');
  source.onerror = () => {
    // 含按调用流的 404（调用不存在 / web 重启后条目已丢）；不自行实现重连，沿用 EventSource 自动重连 + 服务端 retry: 1000
    setStreamHint('订阅中断（该调用可能已不存在）——浏览器将自动重试。', true);
  };
  for (const type of CALL_EVENT_TYPES) {
    source.addEventListener(type, (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleCallEvent(type, data);
    });
  }
}

function handleCallEvent(type, data) {
  if (!data || typeof data.call_id !== 'string') return;
  if (type === 'call_state') {
    setCallState(data.state);
    return;
  }
  if (type === 'call_update') {
    // 增量尾部：text 优先，否则取 line + 换行（体例同 app.js 的 task_update 分支）
    appendLog(typeof data.text === 'string' ? data.text : typeof data.line === 'string' ? `${data.line}\n` : '');
    return;
  }
  if (type === 'call_result') {
    setCallState(data.state);
    appendLog(typeof data.text === 'string' ? data.text : '');
    if (typeof data.error === 'string' && data.error !== '') appendLog(`错误：${data.error}`);
    unsubscribe();
  }
}

// ── 初始化 ──
$('call-rows').addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-call-id]');
  if (row !== null) selectCall(row.dataset.callId);
});

renderProgress();
loadCalls();
setInterval(loadCalls, ROSTER_REFRESH_MS);
