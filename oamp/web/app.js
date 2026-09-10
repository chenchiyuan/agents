// oamp Web Console — 前端逻辑（原生 JS，无构建）
// 数据流：轮询 /api/chats + /api/agents；打开会话轮询 /api/chats/<id>；
// 发送消息 POST /api/messages（消息即命令；@agent 选择目标）。
'use strict';

const POLL_MS = 1500;
const COLLAPSE_LINES = 8; // 输出行折叠阈值（超出显示 "N steps" 可展开）

const state = {
  agents: [],
  chats: [],
  chat: null, // 当前会话详情
  filter: 'all',
  expanded: new Set(), // 已展开的消息键（chat_id:message_id）
  mention: { open: false, items: [], index: 0, start: -1 },
  routerOk: false,
};

const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const res = await fetch(path, options ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── 顶栏 / 状态 ──
function setConn(ok, detail) {
  state.routerOk = ok;
  const el = $('conn-status');
  el.className = `conn ${ok ? 'conn-ok' : 'conn-bad'}`;
  el.textContent = ok ? `已连接 · ${state.agents.filter((a) => a.state === 'online').length} agents online` : (detail || 'Router 不可达');
}

function badge(stateName) {
  const map = { idle: 'badge-idle', submitted: 'badge-submitted', working: 'badge-working', completed: 'badge-completed', failed: 'badge-failed' };
  return `<span class="badge ${map[stateName] || 'badge-idle'}">${stateName || 'idle'}</span>`;
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
function renderChats() {
  const list = $('chat-list');
  const chats = state.chats.filter((c) => state.filter === 'all' || c.state === state.filter);
  if (chats.length === 0) {
    list.innerHTML = `<div class="empty-hint">${state.filter === 'all' ? '还没有对话——点击 New chat 或在下方输入 @agent 命令' : `没有 ${state.filter} 状态的对话`}</div>`;
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
        <div class="meta">${badge(c.state)}<span class="agent">@${escapeHtml(c.agent_id)}</span><span>${fmtTime(c.updated_at)}</span></div>
      </div>`;
    }
  }
  list.innerHTML = html;
  for (const el of list.querySelectorAll('.chat-item')) {
    el.onclick = () => openChat(el.dataset.chat);
  }
}

// ── 右栏：会话详情 ──
function renderChat() {
  const chat = state.chat;
  const messages = $('messages');
  if (!chat) {
    $('detail-title').textContent = '选择或新建一个对话';
    $('detail-meta').textContent = '';
    messages.innerHTML = `<div class="empty">左侧选择对话，或在下方输入框以 <code>@agent 命令</code> 开始<br /><span class="muted">消息即命令：内容将以 /bin/sh -c 在目标 agent 上执行（demo）</span></div>`;
    renderStatusLine();
    return;
  }
  $('detail-title').textContent = chat.title;
  const lastTask = [...chat.messages].reverse().map((m) => m.task).find(Boolean);
  $('detail-meta').innerHTML = `@${escapeHtml(chat.agent_id)} ${lastTask ? badge(lastTask.state) : ''}`;
  if (chat.messages.length === 0) {
    messages.innerHTML = '<div class="empty">会话已创建，发送第一条消息开始。</div>';
  } else {
    messages.innerHTML = chat.messages.map((m) => renderMessage(chat.chat_id, m)).join('');
  }
  for (const el of messages.querySelectorAll('.output-toggle')) {
    el.onclick = () => {
      const key = el.dataset.key;
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      renderChat();
    };
  }
  // 自动滚到底部（仅当接近底部或首次渲染）
  messages.scrollTop = messages.scrollHeight;
  renderStatusLine();
}

function renderMessage(chatId, m) {
  const role = m.role === 'system' ? 'system' : 'user';
  const head = `<div class="msg-head"><span class="avatar avatar-${role === 'user' ? 'user' : 'agent'}">${role === 'user' ? '陈' : '@'}</span>
      <span class="msg-role">${role === 'user' ? '我' : '系统'}</span>
      <span class="msg-time">${fmtTime(m.at)}</span>${m.task ? ` ${badge(m.task.state)}` : ''}</div>`;
  if (role === 'system') {
    return `<div class="msg"><div class="msg-body"><div class="msg-system">${escapeHtml(m.text)}</div></div></div>`;
  }
  // 用户消息：@agent + 文本
  const mentionMatch = /^(@[^\s@]+)\s*([\s\S]*)$/.exec(m.text);
  const mention = mentionMatch ? `<span class="mention-chip">${escapeHtml(mentionMatch[1])}</span>` : '';
  const bodyText = mentionMatch ? mentionMatch[2] : m.text;
  let html = `<div class="msg">${head}<div class="msg-body">
      <div class="msg-text">${mention} ${escapeHtml(bodyText)}</div>`;

  const task = m.task;
  if (task) {
    const result = task.result || null;
    const duration = result && result.duration_ms !== undefined ? ` · ${(result.duration_ms / 1000).toFixed(2)}s` : '';
    // agent 执行头部：角色 + working/completed + 耗时
    html += `<div class="msg-head" style="margin-top:8px"><span class="avatar avatar-agent">@</span>
        <span class="msg-role">${escapeHtml(task.to)}</span>${badge(task.state)}<span class="msg-time">${duration}</span></div>`;
    // 命令
    html += `<div class="cmd-line"><span class="prompt">$ </span>${escapeHtml(stripSh(bodyText))}</div>`;
    // 输出明细
    const lines = task.updates.filter((u) => u.detail && (u.detail.kind === 'stdout' || u.detail.kind === 'stderr'));
    const key = `${chatId}:${m.message_id}`;
    const expanded = state.expanded.has(key);
    const shown = expanded || lines.length <= COLLAPSE_LINES ? lines : lines.slice(-COLLAPSE_LINES);
    if (shown.length > 0) {
      html += `<div class="output">${shown.map((u) => `<div class="output-line${u.detail.kind === 'stderr' ? ' stderr' : ''}">${escapeHtml(u.detail.line)}</div>`).join('')}</div>`;
      if (lines.length > COLLAPSE_LINES) {
        html += `<div class="output-toggle" data-key="${key}">${expanded ? '▴ 收起' : `▾ 展开全部 ${lines.length} 行输出`}</div>`;
      }
    }
    if (result) {
      const ok = task.state === 'completed';
      html += `<div class="result-line ${ok ? 'ok' : 'bad'}">${ok ? '✓ 完成' : '✗ 失败'} · exit_code=${result.exit_code ?? '-'}${result.error ? ` · ${escapeHtml(String(result.error))}` : ''}</div>`;
    } else {
      html += `<div class="result-line muted">执行中…（${task.updates.length} 条明细）</div>`;
    }
  } else {
    html += `<div class="result-line muted">消息已记录（未关联任务）</div>`;
  }
  return `${html}</div></div>`;
}

function stripSh(text) {
  return text;
}

function renderStatusLine() {
  const el = $('status-line');
  const chat = state.chat;
  if (!chat) {
    el.innerHTML = '';
    $('hint').textContent = '消息即命令：内容将以 /bin/sh -c 在目标 agent 上执行（demo）';
    return;
  }
  const task = [...chat.messages].reverse().map((m) => m.task).find(Boolean);
  const agent = `<span class="agent">@${escapeHtml(chat.agent_id)}</span>`;
  el.innerHTML = task ? `${agent} · ${task.state}${task.state === 'working' ? ' · 执行中…' : ''}` : `${agent} · 等待消息`;
  $('hint').textContent = '';
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

async function openChat(chatId) {
  try {
    const { chat } = await api(`/api/chats/${encodeURIComponent(chatId)}`);
    state.chat = chat || null;
    renderChats();
    renderChat();
    $('input').focus();
  } catch (err) {
    $('hint').textContent = `打开会话失败：${err.message}`;
    $('hint').className = 'hint error';
  }
}

async function refreshCurrent() {
  if (!state.chat) return;
  try {
    const { chat } = await api(`/api/chats/${encodeURIComponent(state.chat.chat_id)}`);
    if (!chat) return;
    const changed = JSON.stringify(chat) !== JSON.stringify(state.chat);
    state.chat = chat;
    if (changed) {
      renderChat();
      renderChats();
    }
  } catch {
    /* 忽略瞬时错误 */
  }
}

// ── 发送 ──
async function send() {
  const input = $('input');
  const text = input.value.trim();
  if (!text) return;
  const hint = $('hint');
  hint.className = 'hint';
  // 解析目标 agent：@agent 前缀，或沿用当前会话绑定的 agent
  const m = /^@([^\s@]+)\s+([\s\S]+)$/.exec(text);
  let agentId = m ? m[1] : state.chat ? state.chat.agent_id : '';
  if (!agentId) {
    hint.textContent = '请用 @agent 指定目标（输入 @ 会列出所有 agent）';
    hint.className = 'hint error';
    return;
  }
  if (!m && !state.chat) {
    hint.textContent = '请输入 "@agent 命令" 形式';
    hint.className = 'hint error';
    return;
  }
  const online = state.agents.some((a) => a.instance_id === agentId && a.state === 'online');
  if (!online) {
    hint.textContent = `@${agentId} 不在线（当前在线：${state.agents.filter((a) => a.state === 'online').map((a) => a.instance_id).join(', ') || '无'}）`;
    hint.className = 'hint error';
  }
  try {
    $('btn-send').disabled = true;
    const resp = await api('/api/messages', {
      chat_id: state.chat ? state.chat.chat_id : undefined,
      agent_id: agentId,
      text,
    });
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
    state.chat = null;
    renderChats();
    renderChat();
    $('input').value = '';
    $('input').focus();
  };
  $('btn-send').onclick = send;
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
      renderChats();
    };
  }
}

bind();
(async function tick() {
  await loadAgents();
  await loadChats();
  await refreshCurrent();
  setTimeout(tick, POLL_MS);
})();
