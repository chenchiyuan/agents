# pr-002 SSE 传输抽象

## 上下文摘要

落地面向浏览器的推送抽象 `transport.js`：`createSseTransport()` 返回 `{kind, handle, publish, closeAll}`，本版以 HTTP/SSE 实现（订阅集合 + 事件序列化 + `retry` 与 15s 心跳 + 连接关闭清理），不引入 WebSocket/额外依赖。本 PR 只交付模块与其单测，不接线 web（`/api/stream` 路由与 `onDeliver` → `publish` 的接线在 pr-004）；F04-6 要求"替换实时传输实现时外部行为不变"，接口本身即被要求的产品物，因此本模块可独立合并验收。

## 涉及功能点

- F04（一次调用与过程实时展示：传输抽象与事件推送通道；端点接线与前端归 pr-004）

## 文件范围

- oamp/src/transport.js（新建）
- oamp/test/transport.test.js（新建）

## 验收标准

- [ ] `createSseTransport()` 返回对象含 `kind === 'sse'`、`handle(req, res, { chatId })`、`publish(chatId, event)`、`closeAll()`（接口形状即 F04-6 的替换点，单测直接断言）
- [ ] `handle` 建立订阅：写出 `content-type: text/event-stream` 且携带 `retry: 1000`；`publish` 的事件按 `event: <type>\ndata: <json>\n\n` 帧格式写出，同一连接多次 `publish` 保持 FIFO 顺序
- [ ] 无订阅者的 `chatId` 上 `publish` 不抛错、不缓存（随后新建订阅者收不到此前事件）
- [ ] 连接 `close` 后订阅被移除（订阅集合归零；再 `publish` 不向已关闭连接写入），`closeAll()` 结束所有连接
- [ ] 心跳：按可注入的 `heartbeatMs` 周期写出 `: keepalive` 注释行（测试用短周期断言，生产默认 15000）
- [ ] `node --test test/transport.test.js` 全绿；测试不依赖真实浏览器（直接以 `http` 起服务 + `fetch`/裸 socket 读流断言）

## 参考资料

- docs/iterations/0011-chat-context-protocol/architecture.md §5.1（Transport 接口与替换方式）、§5.2（事件模型、`retry`/心跳/顺序）、§5.4（关闭清理与无订阅者丢弃）、§14（transport 为何必需）、§17（单元测试层）
- docs/iterations/0011-chat-context-protocol/prd/F04-invocation-realtime-streaming-transport.md

## depends_on

（无）

## batch

1
