// oamp Web Console — 前端逻辑（原生 JS，无构建）
// 数据流（0011 迭代）：历史真源 = 服务端 SQLite —— GET /api/chats（列表）+ GET /api/chats/<id>（详情）；
//   实时经 SSE：GET /api/stream?chat_id=<id> 四类事件（message / task_update / chat_state / notice）；
//   发送 POST /api/messages（默认 omp-daemon 常驻上下文；勾选「一次性」→ omp 一次性；! 开头 → shell）。
// 断线/刷新兜底：EventSource 自动重连（服务端 retry: 1000），onopen 与打开会话时全量拉取详情。
// 归档（0013）：GET /api/chats?archived=1（归档视图：limit=200 + offset 续页）+ POST /api/chats/archive（批量）
//   + POST /api/chats/<chat_id>/activate；激活后的「上下文不延续」说明条由 chats.context_released 驱动（F05-6）。
'use strict';

const RETRY_HINT = '连接已断开，正在重连…';
// 0013 归档（§5.2 / §6.2）：归档视图首屏 = 续页 = API 上限；确认文案 A-9 逐字（不显示条数 D-8）
const ARCHIVE_PAGE_SIZE = 200;
const ARCHIVE_CONFIRM_TEXT = '将归档全部非进行中的对话，是否继续？';

const state = {
  agents: [],
  chats: [],
  archive: { chats: [], total: 0, loading: false }, // 归档视图的独立状态（与 state.chats 互不污染；AR-12）
  chat: null, // 当前会话详情（读库：{chat, messages[]} 的 chat + messages）
  messages: [],
  filter: 'all',
  mention: { open: false, items: [], index: 0, start: -1 },
  routerOk: false,
  stream: { chatId: null, text: '' }, // 流式占位文本（task_update 累积；终态 message 到达即清空）
  titleEdit: null, // ★ 标题行内编辑态：null = 未编辑；{ chatId } = 正在编辑该对话的标题
  notices: [], // 会话内系统提示条（SSE notice，运行时事件不入库；仅本次页面会话保留，刷新即不重现）
};

let source = null; // 当前会话的 EventSource
let subscribedChatId = null;

const $ = (id) => document.getElementById(id);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(
    path,
    method === 'GET' ? undefined : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── 顶栏 / 状态 ──
function setConn(ok, detail) {
  state.routerOk = ok;
  const el = $('conn-status');
  el.className = `conn ${ok ? 'conn-ok' : 'conn-bad'}`;
  el.textContent = ok ? `已连接 · ${state.agents.filter((a) => a.state === 'online').length} agents online` : detail || 'Router 不可达';
}

function badge(stateName) {
  const map = {
    idle: 'badge-idle',
    submitted: 'badge-submitted',
    working: 'badge-working',
    completed: 'badge-completed',
    failed: 'badge-failed',
    closed: 'badge-closed',
  };
  return `<span class="badge ${map[stateName] || 'badge-idle'}">${stateName || 'idle'}</span>`;
}

/** 只读面单一真源（前端侧，与 src/web.js 的 isReadonly 同形同值）：已归档 或 已关闭。
 *  标题编辑门（F03 验收 3）与「关闭对话」按钮禁用条件共用本函数（AR-08 不分叉）。 */
function isReadonly(chat) {
  return chat.state === 'closed' || chat.archived_at !== null;
}

function fmtTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dayGroup(ms) {
  const d = new Date(ms);
  const now = new Date();
  return d.toDateString() === now.toDateString() ? 'TODAY' : 'OLDER';
}

// ── 左栏：会话列表 ──
/** 归档视图的「加载更多」：仅在确有更多时渲染（F04-3/5；无更多时清空槽 ⇒ 末尾不留死控件）。 */
function renderLoadMore() {
  const slot = $('load-more-slot');
  const hasMore = state.filter === 'archived' && state.archive.chats.length < state.archive.total;
  slot.innerHTML = hasMore ? '<button id="btn-load-more" class="load-more">加载更多</button>' : '';
  const btn = $('btn-load-more');
  if (btn) btn.onclick = () => loadArchived({ append: true });
}

/** 归档行：既有行 + 归档时间 + 归档时的原状态 badge + 独立「激活」按钮（F03-4/5/7）。 */
function renderArchiveItem(c) {
  const active = state.chat && state.chat.chat_id === c.chat_id ? ' active' : '';
  return `<div class="chat-item${active}" data-chat="${c.chat_id}">
    <div class="title">${escapeHtml(c.title)}</div>
    <div class="meta">${badge(c.state)}<span class="agent">@${escapeHtml(c.agent_id || '-')}</span><span>${fmtTime(c.archived_at)}</span><button class="activate" data-activate="${c.chat_id}">激活</button></div>
  </div>`;
}

function renderChats() {
  const list = $('chat-list');
  const viewingArchive = state.filter === 'archived';
  // 视图来源二选一：归档视图 = 服务端排好序的归档页（不分组）；主列表 = 既有内存过滤（§6.3 逐字保留）
  const chats = viewingArchive
    ? state.archive.chats
    : state.chats.filter((c) => state.filter === 'all' || c.state === state.filter);
  if (chats.length === 0) {
    list.innerHTML = `<div class="empty-hint">${
      viewingArchive
        ? '还没有归档的对话'
        : state.filter === 'all'
          ? '还没有对话——点击 New chat 或在下方输入 @agent 问题'
          : `没有 ${state.filter} 状态的对话`
    }</div>`;
    renderLoadMore();
    return;
  }
  if (viewingArchive) {
    list.innerHTML = chats.map(renderArchiveItem).join('');
    for (const el of list.querySelectorAll('.chat-item')) {
      el.onclick = () => openChat(el.dataset.chat);
      el.querySelector('.activate').onclick = (e) => {
        e.stopPropagation(); // 点按钮不打开详情（F03-5 / M-4）
        activate(el.dataset.chat);
      };
    }
    renderLoadMore();
    return;
  }
  const groups = new Map();
  for (const c of chats) {
    const g = dayGroup(c.updated_at);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const order = ['TODAY', 'OLDER'];
  let html = '';
  for (const g of order) {
    const items = groups.get(g);
    if (!items || items.length === 0) continue;
    html += `<div class="group-title">${g} ${items.length}</div>`;
    for (const c of items) {
      const active = state.chat && state.chat.chat_id === c.chat_id ? ' active' : '';
      html += `<div class="chat-item${active}" data-chat="${c.chat_id}">
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="meta">${badge(c.state)}<span class="agent">@${escapeHtml(c.agent_id || '-')}</span><span>${fmtTime(c.updated_at)}</span></div>
      </div>`;
    }
  }
  list.innerHTML = html;
  for (const el of list.querySelectorAll('.chat-item')) {
    el.onclick = () => openChat(el.dataset.chat);
  }
  renderLoadMore();
}

// ── 右栏：会话详情 ──
/** 标题区唯一渲染落点（AR-01 / AR-05 / AR-09）：统一处理 空态 / 只读 / 可编辑 / 编辑中 四态。
 *  - 编辑中（同一 chat）：early-return ⇒ 任何 SSE 触发的 renderChat() 都不会覆盖用户正在输入的内容，也不会关闭编辑态；
 *  - 其它形态：清掉残余编辑态，h1 显示库值，input 隐藏；
 *  - .editable 只在"可编辑"时挂上（AR-09：只读与空态没有可编辑的视觉/交互暗示）。 */
function renderTitle(chat) {
  const titleEl = $('detail-title');
  const input = $('detail-title-input');
  if (chat && state.titleEdit !== null && state.titleEdit.chatId === chat.chat_id) return;
  state.titleEdit = null; // 空态 / 只读 / 已切换对话：不留残余编辑态
  if (!chat) {
    titleEl.textContent = '选择或新建一个对话'; // 空态文案（F03 验收 5 / D-15：不是任何对话的标题）
    titleEl.classList.remove('editable');
  } else {
    titleEl.textContent = chat.title;
    titleEl.classList.toggle('editable', !isReadonly(chat));
  }
  titleEl.classList.remove('hidden');
  input.classList.add('hidden');
}

/** 进入标题编辑（F01 验收 1 / D-1）：空态与只读面点击无响应（F03 验收 1/2/5 / D-15），重复点击不重置。 */
function beginTitleEdit() {
  const chat = state.chat;
  if (!chat || isReadonly(chat) || state.titleEdit !== null) return;
  state.titleEdit = { chatId: chat.chat_id };
  const input = $('detail-title-input');
  input.value = chat.title; // 预填当前标题全文
  $('detail-title').classList.add('hidden');
  input.classList.remove('hidden');
  input.focus();
  input.select(); // 全部预选：直接输入即整体替换（focus 之后再 select，顺序不可颠倒）
}

/** 退出编辑态（幂等）：清 state → 复位 DOM（h1 文本回到库值）。取消与失败恢复共用本函数。 */
function exitTitleEdit() {
  state.titleEdit = null;
  const chat = state.chat;
  if (chat) {
    renderTitle(chat); // state 已清 ⇒ renderTitle 不 early-return，h1 回到 chat.title
  } else {
    $('detail-title-input').classList.add('hidden');
    $('detail-title').classList.remove('hidden');
  }
}

/** 提交一次改名（F01 验收 2/4/5；F02 验收 1/4/5；AR-04 / AR-05 / AR-10 / AR-11）。
 *  触发路径只有 Enter 与失焦两条，二者共用本函数；首行的 state 检查是唯一门：
 *  Esc 先清 state 再复位 DOM ⇒ 随后必然发生的失焦与 Enter 都在首行被挡（D-11「Esc 优先于失焦」）。 */
async function commitTitle() {
  const edit = state.titleEdit;
  if (edit === null) return; // 已取消 / 非编辑态（含 Esc 后的失焦）：不提交
  const chat = state.chat;
  const raw = $('detail-title-input').value;
  exitTitleEdit(); // 先退出编辑态 ⇒ Enter 之后的失焦不会二次提交
  if (!chat || chat.chat_id !== edit.chatId) return; // 已切换对话：不提交
  const next = raw.trim();
  if (next === '' || next === chat.title) return; // 拒空 / 未改动：不提交，界面已回到原值（F01 验收 4、F02 验收 4/5）
  try {
    const r = await api(`/api/chats/${encodeURIComponent(chat.chat_id)}/rename`, { method: 'POST', body: { title: raw } });
    chat.title = r.title; // AR-05：以服务端权威值就地回填（权威 = trim 后文本）
    const item = state.chats.find((c) => c.chat_id === chat.chat_id);
    if (item) item.title = r.title; // AR-10：左栏同步范围 = 主列表内存数据中的对应项（D-16）
    renderChats(); // 就地重绘左栏（位置不变：updated_at 未被写入）
    renderChat(); // 详情头显示新值（F04 验收 1、2）
    $('hint').className = 'hint';
    $('hint').textContent = '';
  } catch (err) {
    renderChat(); // F01 验收 5 / D-12：失败恢复原值（exitTitleEdit 已把 h1 还原）
    $('hint').className = 'hint error';
    $('hint').textContent = `改名失败：${err.message}`; // AR-04：复用既有提示位
  }
}

function renderChat() {
  const chat = state.chat;
  const box = $('messages');
  if (!chat) {
    renderTitle(null);
    $('detail-meta').textContent = '';
    $('btn-close').disabled = true;
    box.innerHTML = `<div class="empty">左侧选择对话，或在下方输入框以 <code>@agent 问题</code> 开始<br /><span class="muted">默认走常驻上下文（同对话多轮记得前文）；勾选「一次性」则不累积；以 ! 开头按 shell 命令执行</span></div>`;
    renderStatusLine();
    return;
  }
  renderTitle(chat);
  $('detail-meta').innerHTML = `@${escapeHtml(chat.agent_id || '-')} ${badge(chat.state)}${chat.state === 'closed' ? '<span class="muted"> · 已关闭（只读）</span>' : ''}`;
  $('btn-close').disabled = isReadonly(chat); // AR-08：与标题编辑门共用同一谓词（行为同值）
  const body = state.messages.length === 0 ? '<div class="empty">会话已创建，发送第一条消息开始。</div>' : state.messages.map(renderMessage).join('');
  box.innerHTML = `${freshBar(chat)}${body}${renderStreamSlot(chat)}${renderNotices(chat.chat_id)}`;
  box.scrollTop = box.scrollHeight;
  renderStatusLine();
}

/** 一条落盘记录（in = 用户气泡；out = agent 气泡，带模型/耗时/错误元信息行）。 */
function renderMessage(m) {
  const time = fmtTime(m.created_at);
  if (m.direction === 'in') {
    const mentionMatch = /^(@[^\s@]+)\s*([\s\S]*)$/.exec(m.text);
    const mention = mentionMatch ? `<span class="mention-chip">${escapeHtml(mentionMatch[1])}</span>` : '';
    const bodyText = mentionMatch ? mentionMatch[2] : m.text;
    return `<div class="msg"><div class="msg-head"><span class="avatar avatar-user">陈</span>
        <span class="msg-role">我</span><span class="msg-time">${time}</span></div>
      <div class="msg-body"><div class="msg-text">${mention} ${escapeHtml(bodyText)}</div></div></div>`;
  }
  const meta = [];
  if (m.model) meta.push(`<span class="model-chip">${escapeHtml(m.model)}</span>`);
  if (m.duration_ms !== null && m.duration_ms !== undefined) meta.push(`${(m.duration_ms / 1000).toFixed(2)}s`);
  if (m.error) meta.push(`<span class="err-chip">${escapeHtml(String(m.error))}</span>`);
  return `<div class="msg"><div class="msg-head"><span class="avatar avatar-agent">@</span>
      <span class="msg-role">${escapeHtml(m.agent_id || 'agent')}</span>${m.error ? badge('failed') : ''}<span class="msg-time">${time}</span></div>
    <div class="msg-body">${m.text ? `<div class="answer"><div class="answer-line">${escapeHtml(m.text)}</div></div>` : ''}
    ${meta.length > 0 ? `<div class="msg-meta">${meta.join(' · ')}</div>` : ''}</div></div>`;
}

/** 流式占位气泡（首个 task_update 出现时创建，后续 chunk 原地追加）。 */
function renderStreamSlot(chat) {
  if (state.stream.chatId !== chat.chat_id || state.stream.text === '') return '';
  return `<div class="msg"><div class="msg-head"><span class="avatar avatar-agent">@</span>
      <span class="msg-role">${escapeHtml(chat.agent_id || 'agent')}</span>${badge('working')}</div>
    <div class="msg-body"><div class="answer"><div class="answer-line" id="stream-text">${escapeHtml(state.stream.text)}</div></div></div></div>`;
}

/** 系统提示条（上下文释放/重置；运行时事件，不入库，刷新后不重现——§6.3/§19 裁决 3）。
 *  存于 state 而非直接插 DOM：任何一次全量重渲染（message/chat_state/refreshChat）都必须保留它。 */
function renderNotices(chatId) {
  return state.notices
    .filter((n) => n.chat_id === chatId)
    .map((n) => `<div class="notice-bar">${escapeHtml(n.text)}</div>`)
    .join('');
}
/** 「上下文不延续」说明条（F05-6 / AR-16 / D2 时序契约）：判据 = 非归档 ∧ 上下文已释放且尚未产生新回答。
 *  驱动源是服务端状态位 chats.context_released（落库而非前端内存）⇒ 刷新/重开页面后仍可见；
 *  该对话产生新回答时 insertOutput 复位该位 ⇒ 该轮 message(out) 触发 refreshChat 后本条自动消失。
 *  与既有 SSE state.notices 两通道独立、允许并存、不去重（D6 契约）。 */
function freshBar(chat) {
  return chat.archived_at === null && chat.context_released === 1
    ? '<div class="notice-bar">激活后上下文已重置，本对话后续回复不再记得此前内容</div>'
    : '';
}

function renderStatusLine() {
  const el = $('status-line');
  const chat = state.chat;
  if (!chat) {
    stopWaitTimer();
    el.innerHTML = '';
    return;
  }
  const streaming = state.stream.chatId === chat.chat_id && state.stream.text !== '';
  syncWaitTimer(chat);
  const waiting = chat.state === 'working';
  const slow = waiting && Date.now() - waitSince >= SLOW_HINT_MS;
  el.innerHTML = `<span class="agent">@${escapeHtml(chat.agent_id || '-')}</span> · ${chat.state}${
    waiting
      ? ` · <span class="waiting">思考中 · 已等待 <span id="wait-elapsed">${fmtWait(Date.now() - waitSince)}</span></span>`
      : streaming
        ? ' · 处理中…'
        : ''
  }${slow ? `<div id="wait-slow-hint" class="slow-hint">${SLOW_HINT_TEXT}</div>` : ''}`;
}

// ── working 等待计时（pr-008）──
// 背景：reasoning 模型静默思考期没有 task_update，状态行只剩 working → 用户误判卡死（实测首 token 242s）。
// 设计：working 期间每秒只改 #wait-elapsed 文本（不触发 renderChat）；非 working 立即 clearInterval（不留常驻定时器）。
const WAIT_TICK_MS = 1000;
const SLOW_HINT_MS = 30000;
const SLOW_HINT_TEXT = '当前模型首 token 可能较慢（实测可达数分钟）——可在模型框切换更快模型';

let waitTimer = null; // 1s 定时器；仅 working 期间存在
let waitKey = null; // 计时归属（chat_id + 起点）：变化即新一轮，重新起算
let waitSince = 0; // 本轮起点（epoch ms）

function fmtWait(ms) {
  return `${Math.max(0, Math.floor(ms / 1000))}s`;
}

/** 本轮 working 起点：优先触发该轮 in 消息的落库时刻（≈ task.created_at），其次 chat.updated_at（派发时置 working）；
 *  都取不到则 null，由调用方以「首次观察到 working 的本地时刻」兜底。 */
function workingStartAt(chat) {
  const last = state.messages[state.messages.length - 1];
  const at = last && last.direction === 'in' ? Number(last.created_at) : NaN;
  if (Number.isFinite(at)) return at;
  const updated = Number(chat.updated_at);
  return Number.isFinite(updated) ? updated : null;
}

function stopWaitTimer() {
  clearInterval(waitTimer);
  waitTimer = null;
  waitKey = null;
}

/** 每秒只改状态行内的计时文本；跨过阈值时补一行慢模型提示（消息区不动）。 */
function tickWait() {
  const elapsed = Date.now() - waitSince;
  const back = $('wait-elapsed');
  if (back) back.textContent = fmtWait(elapsed);
  if (elapsed >= SLOW_HINT_MS && !$('wait-slow-hint')) {
    const line = $('status-line');
    if (!line) return;
    const hint = document.createElement('div');
    hint.id = 'wait-slow-hint';
    hint.className = 'slow-hint';
    hint.textContent = SLOW_HINT_TEXT;
    line.appendChild(hint);
  }
}

/** working → 建 1s 定时器（同一轮次不重建）；非 working → 立即停表。 */
function syncWaitTimer(chat) {
  if (!chat || chat.state !== 'working') {
    stopWaitTimer();
    return;
  }
  const start = workingStartAt(chat);
  const key = `${chat.chat_id}:${start === null ? 'local' : start}`;
  if (waitKey !== key) {
    stopWaitTimer();
    waitKey = key;
    waitSince = start === null ? Date.now() : start;
  }
  if (waitTimer === null) waitTimer = setInterval(tickWait, WAIT_TICK_MS);
}

// ── 实时订阅（SSE）──
function unsubscribe() {
  if (source) {
    source.close();
    source = null;
  }
  subscribedChatId = null;
  state.stream = { chatId: null, text: '' };
}

/** 订阅某 chat 的四类事件；同一 chat 重复调用不重连（避免丢增量）。 */
function subscribe(chatId) {
  if (subscribedChatId === chatId && source) return;
  unsubscribe();
  subscribedChatId = chatId;
  source = new EventSource(`/api/stream?chat_id=${encodeURIComponent(chatId)}`);
  source.onopen = () => {
    const el = $('hint');
    if (el.textContent === RETRY_HINT) el.textContent = '';
    refreshChat(); // §5.4：重连/建立时全量拉取（断线期间的增量不补发）
  };
  source.onerror = () => {
    $('hint').textContent = RETRY_HINT; // EventSource 自动重连（服务端 retry: 1000）
  };
  for (const type of ['message', 'task_update', 'chat_state', 'notice']) {
    source.addEventListener(type, (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleEvent(type, data);
    });
  }
}

function handleEvent(type, data) {
  if (!data || typeof data.chat_id !== 'string') return;
  const current = state.chat && state.chat.chat_id === data.chat_id;
  if (type === 'task_update') {
    if (!current) return;
    const chunk = typeof data.text === 'string' ? data.text : typeof data.line === 'string' ? `${data.line}\n` : '';
    if (chunk !== '') appendChunk(data.chat_id, chunk);
    return;
  }
  if (type === 'message') {
    if (data.message && data.message.direction === 'out' && state.stream.chatId === data.chat_id) {
      state.stream = { chatId: data.chat_id, text: '' }; // 终态以落盘文本为准（§5.3）
    }
    loadChats();
    if (current) refreshChat();
    return;
  }
  if (type === 'chat_state') {
    const item = state.chats.find((c) => c.chat_id === data.chat_id);
    if (item) {
      item.state = data.state;
      renderChats();
    }
    if (current) {
      state.chat.state = data.state;
      renderChat();
    }
    return;
  }
  if (type === 'notice' && current) {
    state.notices.push({
      chat_id: data.chat_id,
      text: data.text || (data.kind === 'context_released' ? '上下文已释放，本对话后续回复不再记得此前内容' : '上下文已重置，本对话后续回复不再记得此前内容'),
    });
    renderChat();
  }
}

function appendChunk(chatId, chunk) {
  if (state.stream.chatId !== chatId) state.stream = { chatId, text: '' };
  state.stream.text += chunk;
  let el = document.getElementById('stream-text');
  if (!el) {
    renderChat();
    el = document.getElementById('stream-text');
  }
  if (el) el.textContent = state.stream.text;
  const box = $('messages');
  box.scrollTop = box.scrollHeight;
}

// ── 数据加载 ──
async function loadAgents() {
  try {
    const { agents } = await api('/api/agents');
    state.agents = agents || [];
    setConn(true);
  } catch (err) {
    setConn(false, `Router 不可达：${err.message}`);
  }
}

async function loadChats() {
  try {
    const { chats } = await api('/api/chats');
    state.chats = chats || [];
    renderChats();
  } catch {
    /* 顶栏已提示 */
  }
}

/** 归档视图加载（首屏 / 续页共用一个函数；AR-11 / AR-12）：
 *  首屏 limit=200（API 上限），续页 offset = 已持有条数；「是否还有更多」由 total 判定（服务端同源计数）。 */
async function loadArchived({ append = false } = {}) {
  if (state.archive.loading) return;
  state.archive.loading = true;
  try {
    const offset = append ? state.archive.chats.length : 0;
    const { chats, total } = await api(`/api/chats?archived=1&limit=${ARCHIVE_PAGE_SIZE}&offset=${offset}`);
    state.archive = { chats: append ? [...state.archive.chats, ...(chats || [])] : chats || [], total: total || 0, loading: false };
  } catch {
    state.archive.loading = false;
  }
  renderChats();
}

async function openChat(chatId) {
  try {
    const { chat, messages } = await api(`/api/chats/${encodeURIComponent(chatId)}`);
    if (!chat) throw new Error('会话不存在');
    state.chat = chat;
    state.messages = messages || [];
    subscribe(chat.chat_id);
    renderChats();
    renderChat();
    $('input').focus();
  } catch (err) {
    $('hint').textContent = `打开会话失败：${err.message}`;
    $('hint').className = 'hint error';
  }
}

/** 全量拉取当前会话（onopen / 落盘事件后以库文本为准）。 */
async function refreshChat() {
  const chatId = state.chat && state.chat.chat_id;
  if (!chatId) return;
  try {
    const { chat, messages } = await api(`/api/chats/${encodeURIComponent(chatId)}`);
    if (!chat || !state.chat || state.chat.chat_id !== chat.chat_id) return; // 已切换会话
    state.chat = chat;
    state.messages = messages || [];
    renderChats();
    renderChat();
  } catch {
    /* 忽略瞬时错误 */
  }
}

// ── 发送 / 关闭 ──
async function send() {
  const input = $('input');
  const text = input.value.trim();
  if (!text) return;
  const hint = $('hint');
  hint.className = 'hint';
  hint.textContent = '';
  // 解析目标 agent：@agent 前缀，或沿用当前会话绑定的 agent
  const m = /^@([^\s@]+)\s+([\s\S]+)$/.exec(text);
  const agentId = m ? m[1] : state.chat ? state.chat.agent_id : '';
  if (!agentId) {
    hint.textContent = '请用 @agent 指定目标（输入 @ 会列出所有 agent）';
    hint.className = 'hint error';
    return;
  }
  if (!m && !state.chat) {
    hint.textContent = '请输入 "@agent 问题" 形式';
    hint.className = 'hint error';
    return;
  }
  const online = state.agents.some((a) => a.instance_id === agentId && a.state === 'online');
  if (!online) {
    hint.textContent = `@${agentId} 不在线（当前在线：${state.agents.filter((a) => a.state === 'online').map((a) => a.instance_id).join(', ') || '无'}）`;
    hint.className = 'hint error';
  }
  const payload = { chat_id: state.chat ? state.chat.chat_id : undefined, agent_id: agentId, text };
  const model = $('model-input').value.trim();
  if (model !== '') payload.model = model; // 未填写则不携带：默认链由 agent 侧解析（§7.2，web 不注入默认值）
  if ($('one-shot').checked) payload.one_shot = true;
  try {
    $('btn-send').disabled = true;
    const resp = await api('/api/messages', { method: 'POST', body: payload });
    input.value = '';
    hideMention();
    if (resp.warning) {
      hint.textContent = resp.warning;
      hint.className = 'hint error';
    }
    await loadChats();
    await openChat(resp.chat_id);
  } catch (err) {
    hint.textContent = `发送失败：${err.message}`;
    hint.className = 'hint error';
  } finally {
    $('btn-send').disabled = false;
  }
}

async function closeCurrentChat() {
  const chat = state.chat;
  if (!chat || chat.state === 'closed') return;
  const hint = $('hint');
  try {
    await api(`/api/chats/${encodeURIComponent(chat.chat_id)}/close`, { method: 'POST' });
    hint.className = 'hint';
    hint.textContent = '对话已关闭（历史仍可读，不再接受新输入）';
    await loadChats();
    await refreshChat();
  } catch (err) {
    hint.textContent = `关闭失败：${err.message}`;
    hint.className = 'hint error';
  }
}

// ── 归档 / 激活（0013）──
/** 批量归档（F01 / AR-01 / AR-02）：一次轻确认 → 服务端算范围 → 结果落在既有 #hint 行。
 *  不发 SSE（§5.1）：结果可见性由响应 + 本函数的重载承载（无需手动刷新页面 M-05）。 */
async function archiveAll() {
  if (!window.confirm(ARCHIVE_CONFIRM_TEXT)) return; // 取消 ⇒ 不发请求（A-9）
  const hint = $('hint');
  try {
    const r = await api('/api/chats/archive', { method: 'POST' });
    hint.className = r.failed > 0 ? 'hint error' : 'hint';
    hint.textContent =
      r.failed > 0
        ? `已归档 ${r.archived} 条，${r.failed} 条失败——失败项仍留在主列表，可再次点击「归档全部」重试`
        : `已归档 ${r.archived} 条`; // archived === 0 时即 F01-8 的反馈（不静默）
    await loadChats();
    if (state.filter === 'archived') await loadArchived();
    if (state.chat && state.chat.archived_at !== null) await refreshChat();
  } catch (err) {
    hint.className = 'hint error';
    hint.textContent = `归档失败：${err.message}`;
  }
}

/** 单条激活（F05 / AR-13）：归档视图的「激活」按钮入口；成功后主列表置顶、归档视图移除该条。 */
async function activate(chatId) {
  const hint = $('hint');
  try {
    const r = await api(`/api/chats/${encodeURIComponent(chatId)}/activate`, { method: 'POST' });
    hint.className = 'hint';
    hint.textContent = `已激活（状态：${r.state}）——已回到 All 列表顶部，可继续对话`;
    await loadChats();
    await loadArchived();
    if (state.chat && state.chat.chat_id === chatId) await refreshChat();
  } catch (err) {
    hint.className = 'hint error';
    hint.textContent = `激活失败：${err.message}`;
  }
}

// ── @ 提及补全 ──
function currentMentionQuery() {
  const input = $('input');
  const value = input.value;
  const caret = input.selectionStart;
  const before = value.slice(0, caret);
  const m = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1, end: caret };
}

function showMention(query) {
  const pop = $('mention');
  const items = state.agents.filter((a) => a.instance_id.toLowerCase().startsWith(query.toLowerCase()));
  if (items.length === 0) {
    hideMention();
    return;
  }
  state.mention = { open: true, items, index: 0, start: currentMentionQuery()?.start ?? -1 };
  pop.innerHTML = items
    .map(
      (a, i) =>
        `<div class="mention-item${i === 0 ? ' active' : ''}${a.state !== 'online' ? ' offline' : ''}" data-id="${escapeHtml(a.instance_id)}">
           <span class="name">@${escapeHtml(a.instance_id)}</span><span class="state">${a.state}</span></div>`,
    )
    .join('');
  pop.classList.remove('hidden');
  for (const el of pop.querySelectorAll('.mention-item')) {
    el.onclick = () => insertMention(el.dataset.id);
  }
}

function hideMention() {
  state.mention.open = false;
  $('mention').classList.add('hidden');
}

function moveMention(delta) {
  const { items } = state.mention;
  if (!state.mention.open || items.length === 0) return;
  state.mention.index = (state.mention.index + delta + items.length) % items.length;
  const pop = $('mention');
  pop.querySelectorAll('.mention-item').forEach((el, i) => el.classList.toggle('active', i === state.mention.index));
}

function insertMention(agentId) {
  const input = $('input');
  const q = currentMentionQuery();
  if (!q) return;
  const value = input.value;
  const before = value.slice(0, q.start);
  const after = value.slice(q.end);
  const inserted = `@${agentId} `;
  input.value = `${before}${inserted}${after}`;
  const caret = before.length + inserted.length;
  input.setSelectionRange(caret, caret);
  hideMention();
  input.focus();
}

// ── 工具 ──
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ── 事件绑定 ──
function bind() {
  $('btn-new').onclick = () => {
    unsubscribe();
    state.chat = null;
    state.messages = [];
    renderChats();
    renderChat();
    $('input').value = '';
    $('input').focus();
  };
  $('btn-send').onclick = send;
  $('btn-close').onclick = closeCurrentChat;
  // 标题行内编辑（F01 / AR-01 / AR-03）：点击 h1 进入编辑；Enter / 失焦提交；Esc 取消（优先于失焦）
  $('detail-title').onclick = beginTitleEdit;
  const titleInput = $('detail-title-input');
  titleInput.onblur = () => commitTitle();
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 单行输入框无换行语义，Enter 只作提交
      commitTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitTitleEdit(); // 先清 state 再复位 DOM ⇒ 随后的 blur 在 commitTitle 首行被挡
    }
  });
  $('btn-archive-all').onclick = archiveAll;
  const input = $('input');
  input.addEventListener('input', () => {
    const q = currentMentionQuery();
    if (q) showMention(q.query);
    else hideMention();
  });
  input.addEventListener('keydown', (e) => {
    if (state.mention.open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveMention(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveMention(-1);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(state.mention.items[state.mention.index].instance_id);
        return;
      }
      if (e.key === 'Escape') {
        hideMention();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  for (const btn of document.querySelectorAll('.filter')) {
    btn.onclick = () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('active', b === btn));
      if (state.filter === 'archived') loadArchived(); // 归档视图按缺省视图加载一次（AR-12）
      else renderChats(); // 主列表已在内存，零请求
    };
  }
  // 实时通道已不再轮询：agent 列表在窗口重新聚焦时刷新一次（@ 补全与连接指示不长期失真）
  window.addEventListener('focus', loadAgents);
}

bind();
(async function init() {
  await loadAgents();
  await loadChats();
  renderChat();
})();
