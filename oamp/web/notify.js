// web/notify.js — 通知面（0021 / F07 · F08 · F09；architecture §5.5、§7 T-09 ~ T-14）
// 两层分离（T-12）：service 决定「什么事件要通知」（产出 intent），channel 决定「怎么投递」（只消费 intent）。
//   service 段内零投递实现标识符；channel 段内零事件类型字符串 ⇒ 两侧零命中，可静态切片检查（T-12 的可验证形状）。
//   ⇒ 扩展 / 替换通道 = 往通道面加一个 deliver，事件类型契约与 service 零改动（F09 验收 2）。
// 零构建 ⇒ 经典脚本（零模块语法），经全局入口 window.oampNotify 供 app.js 消费（MI-1）。
// 不引入 Service Worker / Web Push / VAPID / WebSocket（§2.4）；加载期不请求权限（T-11）。

// ══════════ service 层：事件类型契约 + 文案表 + 是否通知的判定（零投递实现） ══════════

/** 事件类型契约（T-14 的唯一真源）：封闭 3 类，不含调用完成类事件（N5）。
 *  调用面事件走 call: / chat-calls: 键，本模块不在那些键上派生 ⇒ 第 4 类结构上不可能产生。 */
const EVENT_TYPES = Object.freeze(['chat_completed', 'chat_failed', 'confirmation_required']);

const BODY_MAX = 80; // 正文截断字符数（T-09）

/** 截断：超长取前 80 字符 + 省略号；非字符串 / 空值 → 空串（不造值）。 */
function clip(text) {
  const s = typeof text === 'string' ? text.trim() : '';
  return s.length > BODY_MAX ? `${s.slice(0, BODY_MAX)}…` : s;
}

/** 来源标识（MI-02）：调用方给了对话标题就用标题，取不到回落 chat_id —— 本层不拉取任何数据。 */
function labelOf(p) {
  return p.label ? String(p.label) : String(p.chat_id || '');
}

/** 「标识：正文」一行（正文缺失时退化为标识本身，不留悬空分隔符）。 */
function lineOf(p) {
  const detail = clip(p.text);
  return detail === '' ? labelOf(p) : `${labelOf(p)}：${detail}`;
}

/** 文案表（T-09 的三行）：一行一个事件类型，`title` 逐字 + `body` / `target` 由载荷派生。
 *  表查不到 = 不通知 —— 这是 service 层唯一的分派点。 */
const TEMPLATES = Object.freeze({
  chat_completed: { title: '对话已完成', body: lineOf, target: (p) => ({ chat_id: p.chat_id }) },
  chat_failed: { title: '对话失败', body: lineOf, target: (p) => ({ chat_id: p.chat_id }) },
  confirmation_required: {
    title: '需要你确认',
    body: (p) => `${p.agent_id} 请求执行 ${p.tool}：${clip(p.title)}`,
    target: (p) => ({ confirmation_id: p.confirmation_id }),
  },
});

/** 判定 + 组稿：onEvent(eventType, payload) → intent = {type, title, body, target}；非 3 类 ⇒ null（不通知）。 */
function service_onEvent(eventType, payload) {
  const tpl = TEMPLATES[eventType];
  if (!tpl) return null;
  const p = payload || {};
  return { type: eventType, title: tpl.title, body: tpl.body(p), target: tpl.target(p) };
}

// ══════════ channel 层：intent → 具体投递（不认识事件类型，不 switch） ══════════

const CHANNEL = 'notification-api'; // 通道标识（T-13）

/** 投递一次，返回是否投出。降级（T-11 / N4）：环境缺失或权限未授予 ⇒ 静默返回 false
 *  （不弹横幅、不提示、不重试、不抛错）——降级只影响本层，不影响事件类型契约与第三栏（F09 验收 1）。 */
function deliver(intent) {
  if (!intent) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const shown = new Notification(intent.title, { body: intent.body });
    // 点击去向（T-09）：只透传 intent.target（本层不认识事件类型）；关键动作恒在第三栏，通知不承载唯一入口。
    shown.onclick = () => {
      window.focus();
      if (typeof entry.onTarget === 'function') entry.onTarget(intent.target || null);
    };
    return true;
  } catch {
    return false; // 构造被平台拒绝同样静默
  }
}

let permissionAsked = false; // 至多请求一次（T-11）

/** 手势入口（T-11）：**只能**从用户手势回调里调用（第三栏的首次交互）——模块求值期与加载路径均不调用。
 *  已授予 / 已拒绝不再询问；'default' 期间按未授权处理（由 deliver 自行判定）。 */
function requestPermission() {
  if (permissionAsked) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  permissionAsked = true;
  try {
    const asked = Notification.requestPermission();
    if (asked && typeof asked.catch === 'function') asked.catch(() => {});
  } catch {
    /* 静默：不弹页面内提示 */
  }
}

// ══════════ 全局入口（MI-1：零构建 ⇒ 经典脚本经 window 暴露给 app.js；零模块语法） ══════════

/** app.js 的调用面：`dispatch`（派发事件）/ `requestPermission`（手势入口）/ `onTarget`（点击去向，app.js 注入）；
 *  `service` / `channel` 是两层本体（对外只读引用，不改变契约）。 */
const entry = {
  EVENT_TYPES,
  service: { onEvent: service_onEvent },
  channel: { id: CHANNEL, deliver },
  onTarget: null,
  dispatch(eventType, payload) {
    const intent = service_onEvent(eventType, payload);
    if (intent) deliver(intent);
    return intent;
  },
  requestPermission,
};

window.oampNotify = entry;
