# pr-005 会话面清理 + 端到端契约验收 + 文档同步

## 上下文摘要

迭代收尾：删除被本迭代替代的 Router 内存会话面（`router.chat_message`/`chat_get`/`chat_list` 三个 case；registry 的 `chats`/`tasksByMessage` 与 `createChat`/`appendChatMessage`/`getChat`/`chatDetail`/`listChats`），新增跨进程端到端契约测试 `test/acp-daemon.test.js`（真实 Router + agent + web 子进程 + fake ACP，覆盖 E-1~E-5 与 F08 的两形态区分），并同步 `oamp/README.md` 中已失效的"会话存于 Router 内存"描述。删除与 e2e 共享同一解锁集（pr-004 合并后才可做），故同一个 PR 交付。

## 涉及功能点

- F01（chat 容器与生命周期：真源迁库后删除旧内存承载）
- F02（对话持久化：库为唯一真源；E-3/E-5 端到端可查）
- F03（历史查询：查询不再经 Router，端到端可查）
- F04（实时展示：E-4 端到端判定）
- F05（上下文：E-1/E-2 端到端判定）
- F08（基线兼容与回归：一次性/ shell 路径不回归、既有测试回归口径）

## 文件范围

- oamp/src/router.js（删除 `router.chat_message`/`router.chat_get`/`router.chat_list` 三个 case）
- oamp/src/registry.js（删除 `chats`/`tasksByMessage` 会话表与 `createChat`/`appendChatMessage`/`getChat`/`chatDetail`/`listChats` 及其导出）
- oamp/test/acp-daemon.test.js（新建）
- oamp/README.md（更新：移除 Router 内存会话/轮询描述，补 web API / SSE / 配置面 / 上下文行为）

## 验收标准

- [ ] `oamp/src/router.js` 中 `chat_message`/`chat_get`/`chat_list` 三个 case 删除；`oamp/src/registry.js` 中 `chats`/`tasksByMessage` 与 5 个会话函数及其 export 删除；全仓（`src/`、`test/`、`web/`）grep 无残留引用
- [ ] `messageId` 死参数归属**显式声明为保留不删**：只删 `tasksByMessage` 映射（`oamp/src/registry.js:198`）与两张会话表，`createTask` 的 `messageId` 形参、`oamp/src/router.js:296` 的实参、registry 任务条目的 `message_id` 字段（`oamp/src/registry.js:190`）保持原样。理由：架构 §9.3「不动（回归边界）」明列「Router 任务表与 `oamp task` CLI」不动、§16.4 把「Router 任务表改造」排除在本迭代范围外，而删除该字段会改变 `router.task_get` 的输出形状（协议可见面，被 `oamp task` CLI 消费）。残留事实如实记录：该字段在本迭代后失去唯一读者（原仅 `tasksByMessage` 会话 join 读取）
- [ ] 其余 10 个既有测试文件（`agent-heartbeat`/`cli`/`delivery-contract`/`event-log`/`hygiene`/`omp-executor`/`reconnect`/`router-registry`/`status`/`task`）**文件未被修改**且原样全绿（F08-3）
- [ ] `oamp/test/acp-daemon.test.js`（真实 Router + agent + `oamp web` 子进程、临时 `OAMP_DB`、fake ACP 经 `OAMP_OMP_BIN` 注入）断言通过：E-1（同 chat 两轮记忆 42 且两轮 out 记录 `meta.context_id`/`pid` 相等）、E-2（新 chat 不含 42）、E-3（重启 web 后列表与详情读回一致）、E-4（`message(out)` 前收到 ≥2 个 `task_update` 且文本递增）、E-5（一次含多段增量的问答后该 chat 恰 2 条记录且 `direction ∈ {in,out}`）
- [ ] 两形态不回归：`!命令` 走 shell、显式 `one_shot` 走 `omp -p` 一次性路径，两者行为与 0010 一致且不累积/不复用上下文（F08-1/F08-2）
- [ ] `npm test`（`node --test test/*.test.js`）全量通过
- [ ] `oamp/README.md` 不再含"会话与消息存于 Router 内存（重启即清空）"之类失效描述，且新增能力（配置面 `oamp/config.json` / web API 与 SSE / 上下文键与上限）有对应说明（R-14）

## 参考资料

- docs/iterations/0011-chat-context-protocol/architecture.md §9.3（删除清单与理由）、§16.1（PR-4 收尾面）、§17（端到端测试层与回归口径）、§18 R-13/R-14、§19 裁决 2（F08-3 口径）
- docs/iterations/0011-chat-context-protocol/prd/F08-baseline-compatibility-regression.md（等价覆盖 a~d 与既有测试口径）、F01/F02/F03/F05
- oamp/src/router.js:23（`VALID_TYPES` 已含 `notice`，删除面不涉及信封协议）、:392/425/435（三个待删 case）、:296（`createTask` 的 `messageId` 实参：失去唯一读者但按「验收标准」的归属声明保留）
- oamp/src/registry.js:39-42（会话表注释与 `chats` :40 / `tasksByMessage` :42 待删）、:198（`tasksByMessage.set`，随表删除）、:262-335（会话表区块：`createChat` :265 → `listChats` 止于 :335）、:356-360（`listTasks` 之后的 6 个会话导出待删）、:337（导出对象起始）；`:182` 的 `createTask({…, messageId = null})` 形参与 `:190` 的任务条目 `message_id` 字段**保留**（归属声明见「验收标准」）
- oamp/README.md:115（"会话与消息存于 Router 内存"）、oamp/test/helpers/harness.js（进程级测试范式）

## depends_on

- pr-004-web-api-and-console.md（理由：删除面依赖 web 已不再调用 Router 会话 RPC。证据：现行 `oamp/src/web.js:174` 调 `router.chat_list`、:180 调 `router.chat_get`、:209 调 `router.chat_message`；在 pr-004 的路由重写合入前删除 `oamp/src/router.js:392/425/435` 的三个 case 会让 web 的 chats/detail/发消息路径直接失败）
- pr-001-config-surface-and-persistence.md（理由：端到端测试以临时 `OAMP_DB` 起 web 并读回落盘记录，依赖 `persist.js` 与 `config.dbPath`——pr-001 产出；E-3/E-5 断言无它不可成立）
- pr-002-sse-transport-abstraction.md（理由：E-4 断言通过 `/api/stream` 的 SSE 事件序列判定，端点由 web 调用 `createSseTransport()`（pr-002 产出）实现；无 transport 则无事件流可断言）
- pr-003-context-pool-acp-daemon.md（理由：E-1/E-2 需要 agent 侧 daemon 执行器 + 上下文池（`omp-daemon` 分支与 out 记录 `meta.context_id`/`pid`）；证据：现行 `oamp/src/agent.js:35-78` 无 `omp-daemon` 分支，:35-78 只有 `omp`/`command` 两条路径，daemon 轮次在 pr-003 前会被拒收）

## batch

4
