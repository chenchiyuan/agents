// src/transport.js — 面向浏览器的推送抽象（本版 = HTTP/SSE 实现，architecture §5.1~§5.4）
// 接口即 F04-6 的替换点：换用另一种实时传输 = 实现同一形状（kind/handle/publish/close/closeAll），
// 在 web.js 里换一行构造（不引入 transport 配置项——只有一种实现时的配置项是纯负债）。
// 本模块零 import（HTTP 服务由消费方提供）；订阅集合与心跳定时器是本模块持有的全部状态。
// 消费方 = pr-004 接线：GET /api/stream?chat_id=<id> 解析后调 handle；onDeliver 收 task.update/result/notice 后调 publish。

const DEFAULT_HEARTBEAT_MS = 15000;
const RETRY_MS = 1000;

export function createSseTransport({ heartbeatMs = DEFAULT_HEARTBEAT_MS } = {}) {
  // chatId → Set<res>（Set 迭代顺序 = 订阅注册顺序，多订阅者按此顺序各写一份）
  const subscribers = new Map();
  let heartbeatTimer = null;

  function startHeartbeat() {
    if (heartbeatTimer !== null) return;
    heartbeatTimer = setInterval(() => {
      for (const set of subscribers.values()) {
        for (const res of set) res.write(': keepalive\n\n');
      }
    }, heartbeatMs);
    heartbeatTimer.unref(); // 不阻滞进程退出（§5.1 closeAll 供进程退出用）
  }

  function stopHeartbeatIfIdle() {
    if (heartbeatTimer === null || subscribers.size > 0) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  /** 建立该 chat 的订阅：写 SSE 头 + retry 首帧，注册 res；客户端断开时自动移除（§5.4 防泄漏）。 */
  function handle(req, res, { chatId }) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    let set = subscribers.get(chatId);
    if (set === undefined) {
      set = new Set();
      subscribers.set(chatId, set);
    }
    set.add(res);
    res.write(`retry: ${RETRY_MS}\n\n`);
    res.on('close', () => {
      set.delete(res);
      // 只清"仍是本 set"的登记：close() 会先删登记再 end，连接上的 'close' 可能晚于新订阅建立
      if (set.size === 0 && subscribers.get(chatId) === set) {
        subscribers.delete(chatId);
        stopHeartbeatIfIdle();
      }
    });
    startHeartbeat();
  }

  /** 写一帧 event/data；无订阅者 → 直接丢弃（不缓存、不排队、不补发，§5.4）。 */
  function publish(chatId, event) {
    const set = subscribers.get(chatId);
    if (set === undefined) return;
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const res of set) res.write(frame);
  }

  /** 移除该 chat 的全部订阅并结束其连接（避免 chat 关闭后浏览器挂着空闲 SSE 连接）。 */
  function close(chatId) {
    const set = subscribers.get(chatId);
    if (set === undefined) return;
    subscribers.delete(chatId);
    for (const res of [...set]) res.end();
    stopHeartbeatIfIdle();
  }

  /** 移除全部订阅并结束所有连接（进程退出/测试用，§5.1）。 */
  function closeAll() {
    for (const chatId of [...subscribers.keys()]) close(chatId);
  }

  return { kind: 'sse', handle, publish, close, closeAll };
}
