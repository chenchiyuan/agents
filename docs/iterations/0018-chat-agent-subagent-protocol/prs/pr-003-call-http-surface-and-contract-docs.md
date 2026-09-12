# pr-003-call-http-surface-and-contract-docs

> 迭代：0018-chat-agent-subagent-protocol · 阶段 4（PR 规划）产物
> 真源：`docs/iterations/0018-chat-agent-subagent-protocol/architecture.md` §2、§3、§4、§5、§7、§8.1~§8.3、§11

## 上下文摘要

调用面主体：`web.js` 末位追加 6 条调用面路由与 7 个纯函数，`GET /api/agents` 追加 `role`，终态发布挂进既有终态与对账路径，静态白名单 +`/calls`、`/calls.js`；同步 `API.md` 并重生成 `llms.txt`。**含既有测试断言改写**（§11 第 1~10 条 + 快照）。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F12
- F14
- F15
- F16

## 文件范围

- oamp/src/web.js（修改）
- oamp/API.md（修改）
- oamp/llms.txt（修改，重生成）
- oamp/test/api-routes.test.js（修改）
- oamp/test/project-workspace.test.js（修改）
- oamp/test/web.test.js（修改）

## 验收标准

- [ ] `createApiRoutes({})` 表尾出现 6 条新表项，签名依次为 `POST /api/calls`、`GET /api/calls`、`GET /api/calls/stream`、`GET /api/calls/:call_id/stream`、`GET /api/calls/:call_id/transcript`、`GET /api/calls/:call_id`；字面量 `GET /api/calls/stream` 与两条 `:call_id/…` 形态排在 `GET /api/calls/:call_id` 之前（检索式 `grep -n "path: '/api/calls" oamp/src/web.js`）。
- [ ] 6 条表项的登记元数据 8 字段齐备（`method` / `path` / `summary` / `params` / `response` / `errors` / `kind` / `docLink`）；`params` 项含 5 字段；`errors[]` 取值 ⊆ 既有 `ERR_CODE` 五码；`kind ∈ {json, sse}`；两条 SSE 路由的 `response` 字段逐名列出 `call_state` / `call_update` / `call_result` 三类事件。
- [ ] `POST /api/calls` 的 handler 具备架构 §2.2 的入参面（`chat_id` / `agent` / `task` 与互斥的 `tasks[]` / `context` / `output_schema` / `schema_mode` / `mode` / `model`），并只经既有 `sendError` 出口用既有 5 码返回错误（检索式 `grep -n 'ERR_CODE' oamp/src/web.js`，无新增码）。
- [ ] 终态信封由单一构造点产出：阻塞响应、`GET /api/calls/:call_id`、SSE `call_result` 三处共用同一形状（`call_id` / `agent` / `state` / `duration_ms` / `model` / `truncated` / `text` / `structured_output` / `error` / `exit_code`），且键集合不含 usage / tokens / 成本 / `aborted`（检索式 `grep -nE 'usage|tokens|cost|aborted' oamp/src/web.js` 零命中）。
- [ ] 终态发布单一发布点同时覆盖投递路径与对账路径，且既有 `finishTask` 的「写 out → 推 `message` → 推 `chat_state`」顺序零改动（检索式 `grep -n 'publishCallResult' oamp/src/web.js`，命中投递与对账两处调用）。
- [ ] `oamp/API.md` 的反引号 `METHOD /api/…` 签名集合 = 登记表集合（19 条，双向覆盖）；§3 标题为 `## 3. 接口清单（19 条）`；新增 §3.14~§3.19 六节与 §3.1 的 `role` 字段说明（含 `null` 语义）；新增 §4.4 调用面订阅事件表、§5.12~§5.16 五组可粘贴示例、§6 调用面不做项、文末 §7（7.1 判定口径 / 7.2 三面对照表 25 行 / 7.3 差异清单①~⑲ / 7.4 覆盖关系核对 / 7.5 `one_shot` 例外地位）。
- [ ] `oamp/src/web.js` 的 `STATIC_FILES` 白名单新增 `/calls` → `web/calls.html` 与 `/calls.js` → `web/calls.js` 两项（检索式 `grep -n 'STATIC_FILES' oamp/src/web.js`）；`GET /api/agents` 的每个节点追加 `role: string | null`，既有 4 字段名 / 值 / 顺序逐字不变。
- [ ] `oamp/test/api-routes.test.js` 四处必然变更齐备（§11-1~4）：`EXPECTED_SIGNATURES` 表 13→19（检索式 `grep -n 'EXPECTED_SIGNATURES' oamp/test/api-routes.test.js`）、写接口计数 `danger).length, 6` → `7`（检索式 `grep -n 'danger).length, 6' oamp/test/api-routes.test.js`）、llms 表头 `接口（13 条）` → `19 条`、`API.md` 同步用例（表头 19 条 + §3.14~§3.19 小节与清单行断言）。
- [ ] `oamp/test/project-workspace.test.js` 五处必然变更齐备（§11-5~9）：`EXPECTED_ROUTE_SIGNATURES` 13→19、`assert.equal(routes.length, 13)` → 19、`routes.slice(-2)` 末位断言改为末位 6 条调用面、llms 表头 19 条、写接口计数 7。
- [ ] `oamp/test/web.test.js` 一处必然变更齐备（§11-10）：`/api/agents` 元素的键集合断言（`['instance_id', 'last_heartbeat', 'session_id', 'state']`）追加 `role`。
- [ ] `oamp/llms.txt` 已重生成（§11-11）：`node oamp/scripts/gen-llms-txt.mjs` 的输出与仓库文件逐字节相等，表头为 `## 接口（19 条）`。
- [ ] `npm test`（`node --test test/*.test.js`，在 `oamp/` 下）全绿；`oamp/test/**` 的 diff 仅落在上列三个文件，其余既有测试文件 diff 为空。
- [ ] 零改动路径：`oamp/src/router.js` / `oamp/src/agent.js` / `oamp/src/persist.js` / `oamp/src/context-pool.js` / `oamp/src/role-binding.js`（`git diff --name-only` 不含），协议方法面仍 7 个。
- [ ] 端到端 smoke（真起 `oamp web start`）：`POST /api/calls` 缺 `chat_id` → 400 + `code: 'INVALID_PARAM'`；`agent` 指向不存在的角色 → 404 + `code: 'NOT_FOUND'`；两种情形下 `GET /api/calls` 均无新增行。
- [ ] 既有 `/api/messages` 的响应形态与失败兜底逐字不变：派发失败仍 `200` + `warning`，对话侧仍补一条 `out`（`error: 'dispatch_failed'`）。

## 参考资料

- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §2.1（六条路由与顺序约束）、§2.2~§2.5、§3.1~§3.5、§4.1~§4.3、§5、§7.1~§7.5、§8.1~§8.3、§9.2、§10-1/§10-2、§11（必然变更点清单）
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F01~F12、F14~F16（卡内「架构（阶段 3 已填）」段）
- docs/iterations/0018-chat-agent-subagent-protocol/prd.md（W1~W8 / N15~N19 / E9~E10 / MI-01~MI-08 口径）

## depends_on

- pr-001-transport-call-key-namespace.md（理由：本 PR 的两条 SSE 调用订阅路由必须调用 transport 新增的 `handleCallStream` / `publishCall` / `handleChatCallStream` / `publishChatCall`；证据：`oamp/src/web.js` 已 `import { createSseTransport } from './transport.js'`（检索式 `grep -n "from './transport.js'" oamp/src/web.js`），而 `oamp/src/transport.js` 的 `createSseTransport` 返回对象在 pr-001 前只有 `handle` / `publish` / `publishGlobal` / `globalCount` / `close` / `closeAll` 六个键）
- pr-002-registry-task-list-model.md（理由：`GET /api/calls` 的「模型」列取自 `router.task_list` 行；证据：`oamp/src/router.js` 的 `case 'router.task_list'` 直接返回 `registry.listTasks(...)`（检索式 `grep -n 'router.task_list' oamp/src/router.js`），而 `oamp/src/registry.js` 的 `listTasks` 投影字段清单在 pr-002 前不含 `model` —— 缺 pr-002 时 F09 验收 1 的「模型」列恒为 `null`）

## batch

2
