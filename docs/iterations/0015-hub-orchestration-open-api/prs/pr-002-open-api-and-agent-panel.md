# pr-002-open-api-and-agent-panel

## 上下文摘要

交付 hub 的对外可观测面：`GET /api/events` 全局 SSE（事件 `agent_online` / `agent_offline`，判定源 = web 侧 2s 拉 `router.status` 差值，仅存在全局订阅者时运行）、`GET /api/agents?state=online`（响应形态零变更，非法值 400）、统一错误契约（`{error, code}`，`error` 文案逐字不变，`ERR_CODE` 5 码与状态码一一映射，12 处出口过 `sendError()`），以及顶栏只读 agent 列表（`#agent-panel` 静态兄弟节点浮层：点击开合、三项字段、只列在线、零写操作、空态），自动更新 = 全局事件为主 + 展开期 5s 刷新为辅 + `onopen` 全量对齐。

## 涉及功能点

- F01
- F02
- F04
- F05
- F06

## 文件范围

- oamp/src/transport.js（修改：`chatId=null` 全局键语义、`+publishGlobal`、`+globalCount`）
- oamp/src/web.js（修改：`+GET /api/events`、`+createTopologyWatch` / 具名导出 `+diffTopology`、`+OAMP_WEB_TOPOLOGY_POLL_MS`、`GET /api/agents` 的 `?state=online`、`+ERR_CODE` / `+sendError()` 与 12 处出口改道）
- oamp/web/index.html（修改：`.topright` 内、`#conn-status` 之后 `+<div id="agent-panel" class="agent-panel hidden">`）
- oamp/web/app.js（修改：`state.agentPanel`、`+renderAgentPanel` / `+toggleAgentPanel` / `+closeAgentPanel` / `+fmtAgo` / `+connectAgentEvents`、`+AGENT_PANEL_REFRESH_MS` / `+agentPanelTimer`、`badge()` 映射 `+online`、`bind()` 绑定、`init()` 调用）
- oamp/web/style.css（修改：`.topright{position:relative}`、`.agent-panel`（+`.hidden`）、`.agent-row` / `.agent-id` / `.agent-hb`、`.badge-online`、`#conn-status.conn-ok{cursor:pointer}`）
- oamp/test/transport.test.js（修改：新增全局键段）
- oamp/test/web.test.js（修改：新增 `GET /api/events` 段、`?state=online` 段、统一错误契约段、前端静态契约段；**既有断言零改写**）

## 验收标准

- [ ] `cd oamp && node --test test/transport.test.js test/web.test.js` 全绿，且 `oamp/test/web.test.js` 既有断言逐字未改（`git diff` 可查；含 `:911-917` 的 `/api/stream` 缺 `chat_id` → 400、`:1000-1012` 与 `:1226` 的前端静态契约段、`:1300` / `:1325` 的只读 409 文案断言）
- [ ] 全局键隔离：`publishGlobal` 只到 `chatId=null` 订阅者、chat 订阅者收不到全局事件；`globalCount()` 随订阅 / 断开变化；`closeAll` 覆盖全局键（F05 验收 1、3、4）
- [ ] `GET /api/events`（无参数）返回 200 + `text/event-stream`，连接保持；`curl -N` 建立后用 `OAMP_WEB_TOPOLOGY_POLL_MS=50` 起一个 agent ⇒ 收到 `agent_online` 且载荷含 `instance_id` / `last_heartbeat`；停掉 ⇒ 收到 `agent_offline` 含 `instance_id`；首个订阅者播种基线**不发事件**；无订阅者时轮询 tick 自停（F05 验收 1、2）
- [ ] `GET /api/agents?state=online` 与无参响应**同形状**且逐项 `state === 'online'`；非法 `state` 值 → 400 `INVALID_PARAM`；无参响应仍逐字透传 `router.status`（含 offline 墓碑、4 字段）（F04 验收 1、2、4）
- [ ] 统一错误契约：任取两个接口触发同类错误，响应键集合恰为 `{error, code}`、`code` 与状态码一致；`INVALID_PARAM`=400 / `NOT_FOUND`=404 / `CONFLICT`=409 / `PAYLOAD_TOO_LARGE`=413（响应仍带 `connection: close`）/ `UPSTREAM_UNAVAILABLE`=502；成功响应不含 `code`；既有 `error` 文案逐字不变（含 `chat 已归档（只读），不接受新输入`）（F06 验收 1~4）
- [ ] 接口面零缺口、零启停路径：对照表逐行实调通过，且 `oamp/src/web.js` 的路由集合中不存在启动 / 关闭 agent 的路径（E9 接口面反向检索零命中）（F04 验收 1、3、5）
- [ ] 前端面板：点击 `#conn-status` 展开 `#agent-panel`，条目数 = 顶栏计数 = 在线实例数；每行三项字段（`instance_id` 原文 / 在线徽标 / `fmtAgo(last_heartbeat)` 相对时间）；空集渲染 `暂无在线 agent` 且顶栏为 `已连接 · 0 agents online`；面板内无任何按钮或启停入口（F01 验收 1~5）
- [ ] 前端自动更新：起停 agent 后不作任何手动操作，列表与计数在 5s 内变化（面板保持展开时同样可见；面板关闭时计数也变）；其余条目 `instance_id` 不变；`EventSource.onopen ⇒ loadAgents()` 全量对齐（F02 验收 1~5）
- [ ] 既有前端契约不破：`oamp/web/app.js` 不引入 `POLL_MS` 标识符与 `setTimeout(tick` 形态；既有 `#conn-status` 文案口径与 `showMention` 的离线灰显行为不变（`loadAgents()` 仍取全量）（F04 验收 4 / N13）

## 参考资料

- docs/iterations/0015-hub-orchestration-open-api/architecture.md（§4 全节「硬契约 ②」/ §5 全节「硬契约 ③」/ §6 全节 / §7 全节 / §8 / §9.1 测试同步 / §9.2 回归锁 / §9.3 README 同步范围 / §15.1 / §15.2 跨组契约 4~6 / §15.3 G2+G3）
- docs/iterations/0015-hub-orchestration-open-api/prd/F01-agent-list-panel.md
- docs/iterations/0015-hub-orchestration-open-api/prd/F02-agent-list-auto-update.md
- docs/iterations/0015-hub-orchestration-open-api/prd/F04-open-api-surface.md
- docs/iterations/0015-hub-orchestration-open-api/prd/F05-global-event-stream.md
- docs/iterations/0015-hub-orchestration-open-api/prd/F06-unified-error-contract.md

## depends_on

（无）

> 代码级核实（含"为何 G2 与 G3 合并为一个 PR"的判断依据）：
> 1. **与 pr-001 无消费关系**：本 PR 只用 `queryOnce(config.socketPath, 'router.status')`（`oamp/src/web.js:112-134` 与 `:378-381` 既有函数）取拓扑，数据形状 = `registry.snapshot()` 的 4 字段投影（`oamp/src/registry.js:134-146`），而该函数在 pr-001 中**逐字未变**；`oamp/src/web.js:324` 的常驻发送方以固定数字调 `startHeartbeat`，pr-001 契约保证固定数字入参行为逐字不变。故无需等待 pr-001。
> 2. **G2 与 G3 必须同一 PR（架构 §15.3 委派给阶段 4 的裁决）**：`oamp/test/web.test.js` 既承载后端用例段（`/api/events`、`?state=online`、错误契约），也承载前端静态契约段——现文件已在前端侧读取三份前端产物（`:1001-1003`、`:1035-1036`、`:1227-1229` 读 `web/app.js` / `web/index.html` / `web/style.css`），架构 §9.1 的四段新增全部落在**同一文件**。若前端独立成 PR，则其静态契约段只能留在 `web.test.js`，而该文件同时被后端 PR 声明 ⇒ 违反"文件范围互斥"；若把前端静态契约段放到后端 PR，则后端 PR 的用例要断言前端产物（`#agent-panel` / `connectAgentEvents`），后端 PR 将依赖前端 PR，而前端的 F02 又依赖后端的 `/api/events` ⇒ **成环**。故二者合一为同一 owner（本 PR），与架构 §15.3「必须串行或由同一 owner 合并」的硬约束一致，且不产生环。
> 3. **`oamp/src/web.js` 三件事同文件不拆**（架构 §15.3 明示）：事件流 / `?state=online` / 错误契约全在本文件，任何拆分都会使本文件被多个 PR 声明。
> 4. 本 PR 的验收全部可在本 PR 的 worktree 分支内独立判定（HTTP 实调 + `node --test` 两个既有测试文件），不以 pr-001 / pr-003 的合并为前置。

## batch

1
