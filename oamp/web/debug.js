// web/debug.js — 可交互调试台（0016 / F04 / F07 / architecture §6.3~§6.6）
// 接口清单、表单控件与请求形态全部来自 GET /api/docs 的投影：零硬编码路径、零快捷操作入口（F04 验收 6）。
// 写防护统一挂在发送函数一处（未确认即直接返回、不发出请求），danger 由投影按 `method !== 'GET'` 派生
// ⇒ 新增写接口自动获得「发送前确认 + 危险标识」，不需改动本文件（F07 验收 6 / AR-07-d）。

// 与既有 app.js 的订阅名单同源（transport.js 的 event.type 全集；README「SSE 事件（共六类）」）：
// 事件名在 SSE 的 event: 行 ⇒ 逐名注册；未带 event: 名的帧由 onmessage 兜底。
const EVENT_TYPES = ['message', 'task_update', 'chat_state', 'notice', 'agent_online', 'agent_offline'];

const $ = (id) => document.getElementById(id);

let routes = []; // 当前投影（加载时取一次；刷新重新取，无缓存、无历史留存）
let selected = -1; // 选中的表项下标
let source = null; // 当前 SSE 订阅（停止 = source.close()）

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** 控件取值（空值策略 §6.3）：未填且非必填 → 不发该字段；未填但必填 → 照发，让服务端给出真实 400/404。 */
function readFields() {
  const values = {};
  for (const el of $('route-panel').querySelectorAll('[data-name]')) {
    const name = el.dataset.name;
    const required = el.dataset.required === '1';
    if (el.type === 'checkbox') {
      if (el.checked) values[name] = true;
      else if (required) values[name] = false;
      continue;
    }
    const raw = el.value;
    if (raw === '') {
      if (required) values[name] = '';
      continue;
    }
    if (el.dataset.type === 'number') values[name] = Number(raw);
    else if (el.dataset.type === 'json') {
      try {
        values[name] = JSON.parse(raw);
      } catch {
        values[name] = raw; // 解析失败 → 原样发送（服务端返回真实 400），不在前端拦截
      }
    } else values[name] = raw;
  }
  return values;
}

/** 位置映射（§6.3）：路径参数 encodeURIComponent 代入 `:name` 段；查询参数交 URLSearchParams。 */
function urlFor(route, values) {
  let path = route.path;
  const query = new URLSearchParams();
  for (const p of route.params) {
    const v = values[p.name];
    if (v === undefined) continue;
    if (p.in === 'path') path = path.replace(`:${p.name}`, encodeURIComponent(String(v)));
    else if (p.in === 'query') query.set(p.name, String(v));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

function bodyFor(route, values) {
  const body = {};
  for (const p of route.params) if (p.in === 'body' && values[p.name] !== undefined) body[p.name] = values[p.name];
  return body;
}

/** 真实发送（F04 验收 4）：耗时 = performance.now() 两次差值（发出前 / 读完响应体后），墙钟毫秒、含传输与处理。 */
async function send() {
  const route = routes[selected];
  if (!route) return;
  // 写防护唯一挂载点（F07 / AR-07-d）：写标记由投影派生，不逐接口手写；未确认 → 不发出任何请求
  if (route.danger && !window.confirm(`该请求会真实生效：\n${route.method} ${route.path}\n\n确定发送？`)) return;
  const values = readFields();
  const init = { method: route.method };
  if (route.params.some((p) => p.in === 'body')) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(bodyFor(route, values));
  }
  const box = $('result');
  box.textContent = '请求中…';
  const t0 = performance.now();
  try {
    const res = await fetch(urlFor(route, values), init);
    const text = await res.text();
    const elapsedMs = Math.round(performance.now() - t0);
    box.textContent = `${res.status} · ${elapsedMs} ms\n\n${pretty(text)}`;
  } catch (err) {
    box.textContent = `请求失败 · ${Math.round(performance.now() - t0)} ms\n\n${err.message}`;
  }
}

function appendEntry(name, data) {
  const log = $('sse-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = 'sse-entry';
  entry.innerHTML = `<code>${escapeHtml(name)}</code> ${escapeHtml(pretty(String(data)))}`;
  log.appendChild(entry); // 按到达顺序追加，不覆盖（§6.5）
  log.scrollTop = log.scrollHeight;
}

function syncButtons() {
  const sub = $('btn-subscribe');
  const st = $('btn-stop');
  if (!sub || !st) return;
  sub.disabled = source !== null;
  st.disabled = source === null;
}

function subscribe() {
  const route = routes[selected];
  if (!route || source) return;
  // 订阅地址同样从投影拼：带参订阅路由的查询参数由输入框拼进 URL，无参订阅路由直连；
  // 缺参 → 服务端真实 400，不在前端拦截
  const url = urlFor(route, readFields());
  source = new EventSource(url);
  appendEntry('（已连接）', url);
  source.onerror = () => appendEntry('（连接中断）', 'EventSource 将按服务端 retry 自动重连');
  source.onmessage = (ev) => appendEntry('message', ev.data);
  for (const type of EVENT_TYPES) source.addEventListener(type, (ev) => appendEntry(type, ev.data));
  syncButtons();
}

/** 停止订阅（MI-03）：close 后不再自动重连、不再追加事件；已收到的事件保留不清屏（§6.5）。 */
function stop() {
  if (!source) return;
  source.close();
  source = null;
  appendEntry('（已停止）', '订阅已关闭，不再接收事件');
  syncButtons();
}

function select(index) {
  if (source) stop(); // 切换接口即停止当前订阅（不做并存双发，§6.5）
  selected = index;
  renderList();
  renderPanel();
}

function renderList() {
  const list = $('route-list');
  list.innerHTML = routes
    .map(
      (r, i) =>
        `<button type="button" class="route-card${i === selected ? ' active' : ''}" data-index="${i}">
          <span class="method-badge method-${r.method.toLowerCase()}">${escapeHtml(r.method)}</span>
          <code class="route-path">${escapeHtml(r.path)}</code>
          ${r.danger ? '<span class="danger-badge">会改变状态</span>' : ''}
          <span class="muted">${escapeHtml(r.summary)}</span>
        </button>`,
    )
    .join('');
  for (const el of list.querySelectorAll('button.route-card')) el.onclick = () => select(Number(el.dataset.index));
}

/** 控件映射（§6.3）：enum → 下拉（含「（不传）」）；boolean → 复选框；number → 数字输入；json → 文本域。 */
function fieldHtml(p) {
  const where = p.in === 'path' ? '路径' : p.in === 'query' ? '查询' : '请求体';
  const label = `${p.name}（${where} · ${p.type}${p.required ? ' · 必填' : ''}）`;
  const attrs = `data-name="${escapeHtml(p.name)}" data-type="${p.type}" data-required="${p.required ? '1' : '0'}"`;
  let control;
  if (Array.isArray(p.enum)) {
    control = `<select ${attrs}><option value="">（不传）</option>${p.enum.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select>`;
  } else if (p.type === 'boolean') control = `<input type="checkbox" ${attrs} />`;
  else if (p.type === 'number') control = `<input type="number" ${attrs} />`;
  else if (p.type === 'json') control = `<textarea rows="4" ${attrs}></textarea>`;
  else control = `<input type="text" ${attrs} />`;
  return `<label class="debug-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

function renderPanel() {
  const route = routes[selected];
  const panel = $('route-panel');
  if (!route) {
    panel.innerHTML = '<p class="prose">从上方列表选择一个接口。</p>';
    return;
  }
  // 危险标识第二处：选中接口的表单顶部（第一处在接口列表项；F07 验收 4）
  const head = `<h2><span class="method-badge method-${route.method.toLowerCase()}">${escapeHtml(route.method)}</span><code class="route-path">${escapeHtml(
    route.path,
  )}</code>${route.danger ? '<span class="danger-badge">会改变状态</span>' : ''}</h2><p class="prose">${escapeHtml(route.summary)}</p>`;
  if (route.kind === 'sse') {
    panel.innerHTML = `<div class="route-card active">${head}<div class="debug-form">${route.params.map(fieldHtml).join('')}<button type="button" id="btn-subscribe">订阅</button> <button type="button" id="btn-stop" disabled>停止</button></div><div class="sse-log" id="sse-log"></div></div>`;
    $('btn-subscribe').onclick = subscribe;
    $('btn-stop').onclick = stop;
    return;
  }
  panel.innerHTML = `<div class="route-card active">${head}<form class="debug-form" id="send-form">${route.params.map(fieldHtml).join('')}<button type="submit">发送</button></form><div class="result-box" id="result">（未发送）</div></div>`;
  $('send-form').onsubmit = (e) => {
    e.preventDefault();
    send();
  };
}

(async () => {
  try {
    const res = await fetch('/api/docs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    routes = data.routes;
    renderList();
    renderPanel();
  } catch (err) {
    $('route-panel').innerHTML = `<p class="prose">接口元数据加载失败：${escapeHtml(err.message)}</p>`;
  }
})();
