// src/transport.js — 面向浏览器的推送抽象（本版 = HTTP/SSE 实现，architecture §5.1~§5.4）
// 接口即 F04-6 的替换点：换用另一种实时传输 = 实现同一形状（kind/handle/publish/close/closeAll），
// 在 web.js 里换一行构造（不引入 transport 配置项——只有一种实现时的配置项是纯负债）。
// 本模块零 import（HTTP 服务由消费方提供）；订阅集合与心跳定时器是本模块持有的全部状态。
// 消费方 = pr-004 接线：GET /api/stream?chat_id=<id> 解析后调 handle；onDeliver 收 task.update/result/notice 后调 publish。
// pr-003 新面：独立 filteredSubscribers 注册表与显式 publishFiltered 投递钩子；不占用既有键空间。
// 0015（F05 / architecture §4.1）：chatId 槽位接受 null = 全局订阅键（字符串 chat_id 不可能与之相等 ⇒ 零冲突）；
//   `publishGlobal` 只写全局键、`publish` 只写 chat 键 ⇒ 消息事件与上下线事件结构性隔离（不靠过滤）。
// 0018（F07 / F08 / architecture §4.2）：键构造具名化 + 三个互不为前缀的命名空间（chat: / call: / chat-calls:）——
//   调用方自带任意非空 chat_id（API.md:110）也不会与调用键串键；新增按调用 / 按对话的调用两对 handle/publish。

const DEFAULT_HEARTBEAT_MS = 15000;
const RETRY_MS = 1000;

// 三个键空间（§4.2）：前缀互不为前缀 ⇒ 任意两个字符串键永不相等；全局键仍为 null，不进任何前缀空间。
const chatKey = (chatId) => `chat:${chatId}`;
const callKey = (callId) => `call:${callId}`;
const chatCallsKey = (chatId) => `chat-calls:${chatId}`;

export function createSseTransport({ heartbeatMs = DEFAULT_HEARTBEAT_MS } = {}) {
  // 订阅键 → Set<res>（三个键空间键之一，或 null=全局键；Set 迭代顺序 = 订阅注册顺序，多订阅者按此顺序各写一份）
  const subscribers = new Map();
  const filteredSubscribers = new Set();
  const alwaysTrue = () => true;
  let heartbeatTimer = null;

  /** 既有 chat 作用域键：chatId=null ⇒ 全局键 null（不进任何前缀空间）。 */
  const chatKeyOrGlobal = (chatId) => (chatId === null ? null : chatKey(chatId));

  function startHeartbeat() {
    if (heartbeatTimer !== null) return;
    heartbeatTimer = setInterval(() => {
      for (const set of subscribers.values()) {
        for (const res of set) res.write(': keepalive\n\n');
      }
      for (const { res } of filteredSubscribers) res.write(': keepalive\n\n');
    }, heartbeatMs);
    heartbeatTimer.unref(); // 不阻滞进程退出（§5.1 closeAll 供进程退出用）
  }

  function stopHeartbeatIfIdle() {
    if (heartbeatTimer === null || (subscribers.size > 0 || filteredSubscribers.size > 0)) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  /** 建立 key 上的订阅：写 SSE 头 + retry 首帧，注册 res；
   *  客户端断开时自动移除（§5.4 防泄漏）——三个键空间共用此内核（§4.2）。 */
  function subscribe(req, res, key) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    let set = subscribers.get(key);
    if (set === undefined) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(res);
    res.write(`retry: ${RETRY_MS}\n\n`);
    res.on('close', () => {
      set.delete(res);
      // 只清"仍是本 set"的登记：close() 会先删登记再 end，连接上的 'close' 可能晚于新订阅建立
      if (set.size === 0 && subscribers.get(key) === set) {
        subscribers.delete(key);
        stopHeartbeatIfIdle();
      }
    });
    startHeartbeat();
  }

  /** 建立过滤订阅：沿用既有 SSE 头、retry 首帧与 close 清理，但不进入 subscribers 键空间。 */
  function handleSubscribe(req, res, { predicate } = {}) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    const subscription = {
      res,
      predicate: typeof predicate === 'function' ? predicate : alwaysTrue,
    };
    filteredSubscribers.add(subscription);
    res.write(`retry: ${RETRY_MS}\n\n`);
    res.on('close', () => {
      filteredSubscribers.delete(subscription);
      stopHeartbeatIfIdle();
    });
    startHeartbeat();
  }

  /** 按订阅者谓词投递同形 SSE 帧；无订阅者或无匹配时直接丢弃。 */
  function publishFiltered(event) {
    for (const { res, predicate } of filteredSubscribers) {
      if (predicate(event)) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }
    }
  }

  /** 建立该 chat 的订阅（chatId=null ⇒ 全局订阅）。 */
  function handle(req, res, { chatId }) {
    subscribe(req, res, chatKeyOrGlobal(chatId));
  }

  /** 建立单次调用的订阅（§4.2：call:<callId> 键）——两次并发调用只订阅其一。 */
  function handleCallStream(req, res, { callId }) {
    subscribe(req, res, callKey(callId));
  }

  /** 建立该对话的调用订阅（§4.2：chat-calls:<chatId> 键）——含尚未发起的调用（可「先订阅、再发起」）。 */
  function handleChatCallStream(req, res, { chatId }) {
    subscribe(req, res, chatCallsKey(chatId));
  }

  /** 写一帧 event/data 到 key；无订阅者 → 直接丢弃（不缓存、不排队、不补发，§5.4）。 */
  function publishTo(key, event) {
    const set = subscribers.get(key);
    if (set === undefined) return;
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const res of set) res.write(frame);
  }

  /** 写一帧该 chat 作用域的事件（chatId=null ⇒ 全局键）。 */
  function publish(chatId, event) {
    publishTo(chatKeyOrGlobal(chatId), event);
  }

  /** 写一帧全局事件（§4.1：全局键 = null；只到全局订阅者，chat 订阅者收不到）。 */
  function publishGlobal(event) {
    publishTo(null, event);
  }

  /** 写一帧调用事件（§4.2）：一次发布同时到 call:<callId> 与 chat-calls:<event.data.chat_id> 两个键。 */
  function publishCall(callId, event) {
    publishTo(callKey(callId), event);
    publishTo(chatCallsKey(event.data.chat_id), event);
  }

  /** 写一帧对话作用域的调用事件（§4.2）：只到 chat-calls:<chatId>。 */
  function publishChatCall(chatId, event) {
    publishTo(chatCallsKey(chatId), event);
  }

  /** 当前全局订阅者数（§4.2：拓扑轮询"仅在存在全局订阅者时运行"的唯一判据）。 */
  function globalCount() {
    const set = subscribers.get(null);
    return set === undefined ? 0 : set.size;
  }

  /** 移除 key 上的全部订阅并结束其连接。 */
  function closeKey(key) {
    const set = subscribers.get(key);
    if (set === undefined) return;
    subscribers.delete(key);
    for (const res of [...set]) res.end();
    stopHeartbeatIfIdle();
  }

  /** 移除该 chat 的全部订阅并结束其连接（避免 chat 关闭后浏览器挂着空闲 SSE 连接）。 */
  function close(chatId) {
    closeKey(chatKeyOrGlobal(chatId));
  }

  /** 终态关闭单次调用订阅；唯一关闭实现仍为既有 closeKey。 */
  function closeCallSubscriptions(callId) {
    closeKey(callKey(callId));
  }

  /** 移除全部订阅并结束所有连接（进程退出/测试用，§5.1）——覆盖三个键空间（含 call: / chat-calls:）。 */
  function closeAll() {
    for (const key of [...subscribers.keys()]) closeKey(key);
  }

  return {
    kind: 'sse', handle, publish, publishGlobal, globalCount, close, closeAll,
    handleCallStream, publishCall, handleChatCallStream, publishChatCall,
    handleSubscribe, publishFiltered, closeCallSubscriptions,
  };
}
