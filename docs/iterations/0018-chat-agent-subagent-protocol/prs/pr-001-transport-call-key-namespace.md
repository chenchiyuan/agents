# pr-001-transport-call-key-namespace

> 迭代：0018-chat-agent-subagent-protocol · 阶段 4（PR 规划）产物
> 真源：`docs/iterations/0018-chat-agent-subagent-protocol/architecture.md` §4.2（transport 键空间扩展）+ L2-16

## 上下文摘要

为调用面事件流准备推送底座：SSE 键构造收进三个具名函数并加互不为前缀的命名空间（`chat:` / `call:` / `chat-calls:`），新增「按调用」「按对话的调用」两对 handle/publish 方法；既有对外方法名与语义逐字不变，零新依赖。**不含既有测试断言改写**（`oamp/test/transport.test.js` 零改写通过）。

## 涉及功能点

- F07
- F08

## 文件范围

- oamp/src/transport.js（修改）

## 验收标准

- [ ] `oamp/src/transport.js` 的 `createSseTransport` 返回对象新增 `handleCallStream` / `publishCall` / `handleChatCallStream` / `publishChatCall` 四个方法（检索式 `grep -n 'handleCallStream\|publishCall\|handleChatCallStream\|publishChatCall' oamp/src/transport.js`，可见 4 处定义与末尾返回对象的键）。
- [ ] 三个命名空间的键两两不相等：前缀 `chat:` / `call:` / `chat-calls:` 互不为前缀；全局键仍为 `null`（与任意字符串键不相等）。
- [ ] `publishCall` 一次发布同时写入该调用的键与该调用所属对话的调用键（两个作用域各取所需，调用方只需发布一次）。
- [ ] 既有对外面逐字不变：`createSseTransport` 仍返回 `kind: 'sse'` 与 `handle` / `publish` / `publishGlobal` / `globalCount` / `close` / `closeAll`；`retry: 1000` 首帧、15 s keepalive、订阅建立与断开清理沿用同一内核。
- [ ] `node --test oamp/test/transport.test.js` 全绿，且该文件内容 `git diff` 为空。
- [ ] `oamp/package.json` 的 `dependencies` 仍为空对象（零新依赖）。

## 参考资料

- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §4.2（键空间扩展：`chatKey` / `callKey` / `chatCallsKey` + 2 对方法）与 §9.2 L2-16
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F07-terminal-delivery.md（T-05）
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F08-call-level-progress.md（T-05）

## depends_on

（无）

## batch

1
