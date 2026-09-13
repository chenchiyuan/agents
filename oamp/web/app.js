// oamp Web Console — 前端逻辑（原生 JS，无构建）
// 数据流（0011 迭代）：历史真源 = 服务端 SQLite —— GET /api/chats（列表）+ GET /api/chats/<id>（详情）；
//   实时经 SSE：GET /api/stream?chat_id=<id> 四类事件（message / task_update / chat_state / notice）；
//   发送 POST /api/messages（默认 omp-daemon 常驻上下文；勾选「一次性」→ omp 一次性；! 开头 → shell）。
// 断线/刷新兜底：EventSource 自动重连（服务端 retry: 1000），onopen 与打开会话时全量拉取详情。
// 归档（0013）：GET /api/chats?archived=1（归档视图：limit=200 + offset 续页）+ POST /api/chats/archive（批量）
//   + POST /api/chats/<chat_id>/activate；激活后的「上下文不延续」说明条由 chats.context_released 驱动（F05-6）。
// 顶栏 agent 列表（0015 / F01 / F02）：点击 #conn-status 开合 #agent-panel（静态浮层）；数据 = 既有
//   GET /api/agents（全量，前端按 state==='online' 过滤）；变化由全局 SSE GET /api/events 驱动，展开期 5s 刷新兜底。
// 待确认 inbox（0021 / F01 · F03 · F06）：第三栏 = 全局 `confirmation` 帧 + GET /api/confirmations 重建（每次 open
//   再对齐一次）；点选即 POST 裁决（200 / 404 移出栏内，不等 SSE）。通知面在独立脚本 notify.js（本文件零投递实现）。
'use strict';

const RETRY_HINT = '连接已断开，正在重连…';
// 0013 归档（§5.2 / §6.2）：归档视图首屏 = 续页 = API 上限；确认文案 A-9 逐字（不显示条数 D-8）
const ARCHIVE_PAGE_SIZE = 200;
const ARCHIVE_CONFIRM_TEXT = '将归档全部非进行中的对话，是否继续？';

const state = {
  agents: [],
  projectId: null, // 当前项目（唯一载体 = URL 的 ?project=<project_id>；boot 时解析写入）
  project: null, // 当前项目对象（顶栏项目名的唯一来源）
  projects: [], // 项目列表（GET /api/projects 全量，不分页）
  agentPanel: { open: false }, // 顶栏 agent 列表开合态（0015 / AR-01；与 state.mention 同款对象形态）
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
  // 0021 / F01（architecture §7 T-02 / T-07）：第三栏（待确认 inbox）——在途项 + 窄屏开合态。
  // 唯一来源 = 重建面 GET /api/confirmations 与全局 `confirmation` 帧；零前端存储（刷新后靠重建面对齐）。
  inbox: { items: [], open: false },
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
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status; // 0021 / F03：裁决提交按码分流（404 已裁决 / 400 选项非法）；既有调用方只读 message
    throw err;
  }
  return data;
}

// ── 顶栏 / 状态 ──
function setConn(ok, detail) {
  state.routerOk = ok;
  const el = $('conn-status');
  el.className = `conn ${ok ? 'conn-ok' : 'conn-bad'}`;
  el.textContent = ok ? `已连接 · ${state.agents.filter((a) => a.state === 'online').length} agents online` : detail || 'Router 不可达';
  if (!ok) closeAgentPanel(); // 断连自动收起，避免展示失真列表（R-6）
}

function badge(stateName) {
  const map = {
    online: 'badge-online', // 0015：顶栏列表的在线徽标（复用既有渲染器，不新写行渲染函数）
    idle: 'badge-idle',
    submitted: 'badge-submitted',
    working: 'badge-working',
    completed: 'badge-completed',
    failed: 'badge-failed',
    closed: 'badge-closed',
  };
  return `<span class="badge ${map[stateName] || 'badge-idle'}">${stateName || 'idle'}</span>`;
}

// ── 顶栏 agent 只读列表（0015 / F01 / F02 / AR-01 / AR-02）──
const AGENT_PANEL_REFRESH_MS = 5000; // 展开期刷新间隔：只承担 last_heartbeat 的新鲜度（变化即时可见由全局事件承担）
let agentPanelTimer = null; // 面板展开期间才有，收起即清（与 waitTimer 同款"状态内定时器"）

/** 相对时间（MI-03）：<60s → "Ns 前"、<60min → "Nm 前"、否则 "Nh 前"；每次渲染重算，不要求每秒跳动。 */
function fmtAgo(ms) {
  const at = Number(ms);
  if (!Number.isFinite(at)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  return `${Math.floor(sec / 3600)}h 前`;
}

/** 面板重绘（AR-02-b）：整体重绘、不做 DOM diff；只列在线实例、沿用服务端 instance_id 排序（零客户端排序）。 */
function renderAgentPanel() {
  if (!state.agentPanel.open) return;
  const rows = state.agents.filter((a) => a.state === 'online');
  $('agent-panel').innerHTML =
    rows.length === 0
      ? '<div class="agent-row muted">暂无在线 agent</div>'
      : rows
          .map(
            (a) =>
              `<div class="agent-row"><span class="agent-id">${escapeHtml(a.instance_id)}</span>${badge('online')}<span class="agent-hb">${fmtAgo(a.last_heartbeat)}</span></div>`,
          )
          .join('');
}

function closeAgentPanel() {
  state.agentPanel.open = false;
  $('agent-panel').classList.add('hidden');
  clearInterval(agentPanelTimer); // 无表时 no-op
  agentPanelTimer = null;
}

/** 开合（AR-01-a）：仅已连接时可展开；展开即以全量取数对齐（§8.1：零新请求路径）并挂 5s 刷新表。 */
async function toggleAgentPanel() {
  if (state.agentPanel.open) {
    closeAgentPanel();
    return;
  }
  if (!state.routerOk) return; // Router 不可达时不展开（避免展示旧列表）
  state.agentPanel.open = true;
  $('agent-panel').classList.remove('hidden');
  renderAgentPanel();
  await loadAgents();
  renderAgentPanel();
  if (state.agentPanel.open && agentPanelTimer === null) {
    agentPanelTimer = setInterval(async () => {
      await loadAgents();
      renderAgentPanel();
    }, AGENT_PANEL_REFRESH_MS);
  }
}

/** 全局事件订阅（F05 的界面消费方 / AR-02-a）：上下线增量改 state.agents ⇒ 顶栏计数与面板即时可见；
 *  onopen（含断线重连）⇒ 全量重新对齐（MI-05：不补发断线期间的每一条变化）。 */
function connectAgentEvents() {
  const es = new EventSource('/api/events');
  const read = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      return data && typeof data.instance_id === 'string' ? data : null;
    } catch {
      return null;
    }
  };
  es.addEventListener('agent_online', (ev) => {
    const data = read(ev);
    if (!data) return;
    const i = state.agents.findIndex((a) => a.instance_id === data.instance_id);
    if (i >= 0) state.agents[i] = { ...state.agents[i], state: 'online', last_heartbeat: data.last_heartbeat };
    else state.agents = [...state.agents, { instance_id: data.instance_id, session_id: null, state: 'online', last_heartbeat: data.last_heartbeat }];
    setConn(true);
    renderAgentPanel();
  });
  es.addEventListener('agent_offline', (ev) => {
    const data = read(ev);
    if (!data) return;
    state.agents = state.agents.filter((a) => a.instance_id !== data.instance_id);
    setConn(true);
    renderAgentPanel();
  });
  // 0021 / F01 · F06（§7 T-07）：在途确认项重建——挂全局 open（含首次与每次自动重连），纯拉取、零缓存、
  //   零通知派发（MI-01：重建不算「进入」）。既有 es.onopen（agent 列表对齐）逐字不变，两者互不依赖。
  es.addEventListener('open', loadConfirmations);
  // 0021 / F01 · F03（§7 T-02 / T-03）：确认请求首次入栏 ⇒ 追加条目 + 通知一次。服务端单一发布点已保证
  //   「首次入表恰一帧」（重复投递不发帧）⇒ 前端不再去重；重建路径不经过本分支。
  es.addEventListener('confirmation', (ev) => {
    let entry = null;
    try {
      entry = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!entry || typeof entry.confirmation_id !== 'string') return;
    if (state.inbox.items.some((e) => e.confirmation_id === entry.confirmation_id)) return;
    state.inbox.items = [...state.inbox.items, entry];
    renderInbox();
    oampNotify.dispatch('confirmation_required', entry);
  });
  // 0021 / F07（§2.2 流 3 / §7 T-13）：对话终态派生——停在其他对话甚至项目列表视图同样收到（全局键）。
  //   判据 = 「状态转变」（MI-2）：同一 chat 的同一终态重复广播不重复派发；冷启动首帧即终态仍派发一次。
  const chatStates = new Map(); // chat_id → 上一次观测到的状态（仅本页生命周期；零持久化）
  es.addEventListener('chat_state', (ev) => {
    let data = null;
    try {
      data = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!data || typeof data.chat_id !== 'string') return;
    const prev = chatStates.get(data.chat_id);
    chatStates.set(data.chat_id, data.state);
    if (data.state !== 'completed' && data.state !== 'failed') return;
    if (prev === data.state) return;
    const item = state.chats.find((c) => c.chat_id === data.chat_id);
    oampNotify.dispatch(data.state === 'completed' ? 'chat_completed' : 'chat_failed', {
      chat_id: data.chat_id,
      label: item ? item.title : null, // 左栏已加载则带标题，取不到回落 chat_id（不额外拉取）
    });
  });
  es.onopen = () => loadAgents();
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

// ── 第三栏：待确认 inbox（0021 / F01 · F03 · F06；architecture §4.2 M-8、§7 T-02 / T-03 / T-07）──

/** 来源对话标识（MI-02）：左栏已加载则用标题，取不到回落 chat_id —— 栏内**不额外拉取**对话详情。 */
function inboxSource(entry) {
  const chat = state.chats.find((c) => c.chat_id === entry.chat_id);
  return `${entry.agent_id} · ${(chat && chat.title) || entry.chat_id}`;
}

/** 在途项列表重建（T-07）：纯拉取、零缓存、整栏覆盖重绘，**零通知派发**（重建不算「进入」）。
 *  调用点 = boot 与全局 SSE 的每次 open（含首次与每次自动重连）⇒ 刷新 / 断线重连后仍在栏内（F06）。 */
async function loadConfirmations() {
  try {
    const { confirmations } = await api('/api/confirmations');
    state.inbox.items = confirmations || [];
    renderInbox();
  } catch {
    /* 忽略瞬时错误（与既有 loadChats 同口径） */
  }
}

/** 一条（T-02 三行 + T-03 控件）：① 来源对话 ② 工具名 + 动作描述 ③ 每个选项一个按钮 + 一个单行文本框。 */
function renderInboxItem(entry) {
  const options = (Array.isArray(entry.options) ? entry.options : [])
    .map((o) => `<button class="inbox-option" data-option="${escapeHtml(o.option_id)}">${escapeHtml(o.label || o.option_id)}</button>`)
    .join('');
  return `<div class="inbox-item" data-confirmation="${escapeHtml(entry.confirmation_id)}">
      <div class="inbox-source">${escapeHtml(inboxSource(entry))}</div>
      <div class="inbox-request">${escapeHtml(entry.tool)} · ${escapeHtml(entry.title)}</div>
      <div class="inbox-actions">${options}</div>
      <input class="inbox-text" type="text" autocomplete="off" placeholder="拒绝理由 / 补充说明（可不填）" />
    </div>`;
}

/** 整栏重绘（唯一渲染路径：重建面与增量帧共用；体量小 ⇒ 不做 DOM diff）。 */
function renderInbox() {
  $('inbox-count').textContent = String(state.inbox.items.length);
  $('inbox').classList.toggle('open', state.inbox.open); // 折叠态只在窄屏断点内生效（宽屏恒三栏同屏）
  const list = $('inbox-list');
  list.innerHTML =
    state.inbox.items.length === 0
      ? '<div class="inbox-empty">暂无待确认项</div>'
      : state.inbox.items.map(renderInboxItem).join('');
  for (const el of list.querySelectorAll('.inbox-item')) {
    const entry = state.inbox.items.find((i) => i.confirmation_id === el.dataset.confirmation);
    const text = el.querySelector('.inbox-text');
    for (const btn of el.querySelectorAll('.inbox-option')) btn.onclick = () => decide(entry, btn, text);
  }
}

/** 来源标签同步（T-02 的标题回落口径）：左栏列表变更后只改写文本、不重建条目 DOM ⇒ 不打断正在输入的文本。
 *  栏内条目与重建面同形，标题取不到时回落 chat_id；本函数让「列表后到」不会把标签永久留在回落值。 */
function syncInboxLabels() {
  for (const el of $('inbox-list').querySelectorAll('.inbox-item')) {
    const entry = state.inbox.items.find((i) => i.confirmation_id === el.dataset.confirmation);
    if (entry) el.querySelector('.inbox-source').textContent = inboxSource(entry);
  }
}

/** 移出栏内条目（裁决成功 / 404 已失效共用）；重建面下次拉取自然不含已裁决项。 */
function dropInboxItem(confirmationId) {
  state.inbox.items = state.inbox.items.filter((e) => e.confirmation_id !== confirmationId);
  renderInbox();
}

/** 点选即裁决（T-03 / §5.1 R-2）：提交 {option_id, text}（文本原样提交，前端不校验）；提交中该条按钮 disabled。
 *  200 ⇒ 立即整条移出（不等 SSE）；404（已裁决 / 已失效 / 从未存在同一码）⇒ 同样移出、不重放；
 *  其余失败 ⇒ 保留条目、不重放（Q2：不新增弹窗 / 横幅 / 组件；重绘即复位控件）。 */
async function decide(entry, button, textInput) {
  oampNotify.requestPermission(); // 手势入口（T-11）：至多一次
  const item = button.closest('.inbox-item');
  for (const btn of item.querySelectorAll('.inbox-option')) btn.disabled = true;
  button.textContent = '提交中…';
  try {
    await api(`/api/confirmations/${encodeURIComponent(entry.confirmation_id)}/decision`, {
      method: 'POST',
      body: { option_id: button.dataset.option, text: textInput.value },
    });
    dropInboxItem(entry.confirmation_id);
  } catch (err) {
    if (err.status === 404) dropInboxItem(entry.confirmation_id);
    else renderInbox(); // 条目保留（重绘同时复位按钮 disabled / 文案）
  }
}

/** 通知点击去向（T-09）：终态类 → 切到该对话；确认类 → 展开并高亮栏内条目（裁决仍在栏内完成，不切对话）。 */
function focusFromNotify(target) {
  if (!target) return;
  if (target.chat_id) {
    openChat(target.chat_id);
    return;
  }
  if (!target.confirmation_id) return;
  state.inbox.open = true;
  renderInbox();
  const el = Array.from($('inbox-list').querySelectorAll('.inbox-item')).find(
    (n) => n.dataset.confirmation === target.confirmation_id,
  );
  if (el) {
    el.classList.add('highlight');
    el.scrollIntoView({ block: 'nearest' });
  }
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

// ── 项目层（0017 / F04 + F05）──
/** 项目列表取数（F04）：全量、零分页；失败沿用既有取数体例静默（顶栏已提示）。 */
async function loadProjects() {
  try {
    const { projects } = await api('/api/projects');
    state.projects = projects || [];
    renderProjects();
  } catch {
    /* 顶栏已提示 */
  }
}

/** 项目行渲染（F04 验收 5）：项目名 + 仓库地址 + 对话数 + 最近活动时间。
 *  无对话 ⇒ last_activity_at = null；Number(null) = 0 会被既有 fmtAgo 当成 epoch 0，故先归一到 undefined，
 *  走既有「非有限值 → '—'」语义（不另写占位分支）。 */
function renderProjects() {
  const box = $('project-list');
  if (state.projects.length === 0) {
    box.innerHTML = '<div class="project-empty">还没有项目，填入仓库地址新建一个</div>';
    return;
  }
  box.innerHTML = state.projects
    .map(
      (p) =>
        `<button class="project-item" data-project="${escapeHtml(p.project_id)}"><div class="title">${escapeHtml(p.name)}</div><div class="meta"><span class="repo">${escapeHtml(p.repo_url)}</span><span>${p.chat_count} 个对话</span><span>${fmtAgo(p.last_activity_at ?? undefined)}</span></div></button>`,
    )
    .join('');
  // 进入项目 = 整页导航（架构 §5.2）：上一个项目的内存态（chats / chat / SSE / 归档页）天然清空
  for (const el of box.querySelectorAll('.project-item')) {
    const projectId = el.dataset.project;
    el.onclick = () => {
      location.href = '/?project=' + encodeURIComponent(projectId);
    };
  }
}

/** 新建项目（F04）：repo_url = 输入框 trim 后原样字符串（前端不做形态 / 域名 / 可达性校验）；
 *  成功 ⇒ 停留项目列表视图，重取一次原地出现（零轮询、不跳进工作台）；失败文案落列表视图自己的提示条。 */
async function createProject() {
  const hint = $('project-hint');
  hint.className = 'project-hint';
  hint.textContent = '';
  const repo = $('project-repo').value.trim();
  if (!repo) {
    hint.textContent = '请填写仓库地址';
    hint.className = 'project-hint error';
    return;
  }
  const body = { repo_url: repo };
  const name = $('project-name').value.trim();
  if (name !== '') body.name = name;
  try {
    await api('/api/projects', { method: 'POST', body });
    $('project-repo').value = '';
    $('project-name').value = '';
    await loadProjects();
  } catch (err) {
    hint.textContent = err.message;
    hint.className = 'project-hint error';
  }
}

/** 当前项目解析（架构 §5.2 T-13）：`?project=` 是唯一载体；项目名经现有 GET /api/projects 全量列表内定位。
 *  返回 falsy ⇒ 无参数 / 未知 id ⇒ boot 回落项目列表视图（不报错、不渲染空工作台）。 */
async function resolveCurrentProject() {
  const projectId = new URLSearchParams(location.search).get('project');
  if (!projectId) return null;
  state.projectId = projectId;
  await loadProjects();
  state.project = state.projects.find((p) => p.project_id === projectId) || null;
  return state.project;
}

/** 项目列表视图：主布局整块隐藏（含 composer ⇒ 看不到对话、不能发消息）。 */
function showProjectList() {
  document.querySelector('main.layout').classList.add('hidden');
  $('project-bar').classList.add('hidden');
  $('projects-view').classList.remove('hidden');
  loadProjects();
}

/** 工作台视图：顶栏项目栏可见（返回入口 + 当前项目名）+ 主布局可见。 */
function showWorkspace(project) {
  $('projects-view').classList.add('hidden');
  $('project-bar').classList.remove('hidden');
  $('current-project-name').textContent = project.name;
  document.querySelector('main.layout').classList.remove('hidden');
}

async function loadChats() {
  try {
    const { chats } = await api(`/api/chats?project_id=${encodeURIComponent(state.projectId)}`);
    state.chats = chats || [];
    renderChats();
    syncInboxLabels(); // 0021 / F01：栏内来源标签依赖左栏标题，列表到达后同步一次（不重建条目 DOM）
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
    const { chats, total } = await api(
      `/api/chats?archived=1&limit=${ARCHIVE_PAGE_SIZE}&offset=${offset}&project_id=${encodeURIComponent(state.projectId)}`,
    );
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
  const payload = { chat_id: state.chat ? state.chat.chat_id : undefined, agent_id: agentId, text, project_id: state.projectId };
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
  $('btn-create-project').onclick = createProject; // 项目列表视图的新建入口（F04）
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
  // 第三栏（0021 / F01）：标题按钮 = 窄屏开合（宽屏该态不生效）+ 手势入口（T-11：至多一次权限请求）
  $('btn-inbox-toggle').onclick = () => {
    state.inbox.open = !state.inbox.open;
    renderInbox();
    oampNotify.requestPermission();
  };
  oampNotify.onTarget = focusFromNotify; // 通知点击去向（T-09）：通道只透传 intent.target，不认识事件类型
  // 顶栏 agent 只读列表（0015 / F01 / AR-01）：点击计数开合；点外 / Esc 收起（与标题编辑的 Esc 各自监听，互不干扰）
  $('conn-status').onclick = toggleAgentPanel;
  document.addEventListener('click', (e) => {
    if (!state.agentPanel.open) return;
    if (e.target.closest('#agent-panel, #conn-status')) return;
    closeAgentPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.agentPanel.open) closeAgentPanel();
  });
}

bind();
(async function init() {
  await loadAgents();
  connectAgentEvents(); // 全局事件流（F05 的界面消费方 / F02）：页面打开即建立，全程 1 条
  loadConfirmations(); // 0021 / F06：首屏拉取在途确认项（跨对话；不等 SSE 首帧，每次 open 会再对齐一次）
  const project = await resolveCurrentProject();
  if (!project) {
    showProjectList(); // `/` 与未知 id：项目列表视图（不请求 /api/chats）
    return;
  }
  showWorkspace(project);
  await loadChats();
  renderChat();
})();
