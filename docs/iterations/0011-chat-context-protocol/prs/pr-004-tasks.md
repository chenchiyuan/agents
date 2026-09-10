# PR-004 任务图：web HTTP 层 + 控制台前端

**来源输入**：`prs/pr-004-web-api-and-console.md`（文件范围 5 文件 / 验收 10 条 / batch 3 / depends_on pr-001+pr-002+pr-003）、`architecture.md` §4.3~§4.6（落盘时机/失败形态/查询接口/时间与关键词/仅两类保障）、§5.1~§5.4（Transport 接口、四类事件与命名、推送链与 E-4、断线兜底）、§6.4（释放与 `context_release` 控制消息）、§7.2/§7.4（模型传递与审计形态）、§9.1（执行路径路由表）、§9.2（既有交互保留）、§9.3（改造影响面）、§10.1/§10.2（一次提问与关闭的数据流）、§12（AR-01/02/03/05/06/07/08/09/10/13/15/16）、§16.1 pr-004 行、§17（测试策略）、§19 裁决 2~5、`prd/F01`~`F08`（重点 F01/F02/F03/F04/F05/F06/F08）
**生成角色**：planner（阶段 5）
**日期**：2026-09-10
**修订记录**：初版

## 范围声明

- 任务图覆盖 PR-004 文件范围 **5 个文件**：`oamp/src/web.js`（改造）、`oamp/web/index.html`（改造）、`oamp/web/style.css`（改造）、`oamp/web/app.js`（改造）、`oamp/test/web.test.js`（重写）。
- **web.js 是唯一承载者**：T1~T4 同落 `src/web.js`，按编号单线落笔（不并行编辑同一文件；范式同 pr-003 的 T1/T2 同文件处置）。T5 落 `web/*` 三文件（与 web.js 不重叠），T6 落测试文件。
- **clean cutover（本 PR 侧）**：`web.js` 删除对 `router.chat_list` / `router.chat_get` / `router.chat_message` 的三处调用（架构 §9.3「旧 `web.js` 对 `router.chat_*` 的 3 处调用（随路由重写消失）」）；`router.js` / `registry.js` 侧 `chat_*` 与会话表**不在本 PR 删除**（归 pr-005，见 `pr-005-cleanup-e2e-and-docs.md`），本 PR 期间允许并存但 web 不再依赖。
- **零新依赖**：SSE 复用 pr-002 的 `src/transport.js`（`node:http`）；测试的 fake ACP 源码**内联**在 `test/web.test.js` 内（不新增 `test/helpers/` 文件——文件范围只有 5 文件；范式 = `test/context-pool.test.js:19-142`）；`package.json` 不变（既有 `test/hygiene.test.js` 静态断言 `dependencies:{}`）。
- **其余测试文件零修改**：`test/` 下现有 15 个 `*.test.js` 中本 PR 只重写 `web.test.js`，其余 14 个（`agent-heartbeat`/`cli`/`config-file`/`context-pool`/`delivery-contract`/`event-log`/`hygiene`/`omp-executor`/`persist`/`reconnect`/`router-registry`/`status`/`task`/`transport`）原样保持（F08-3 口径，§19 裁决 2）。
- **不做**：`GET /api/search`（架构 §4.5 明文删除）、模型清单接口/下拉（F06-5 边界）、chat 重开/删除/重命名、工具/权限应答、过程落库、鉴权（0010 N6 边界）、WebSocket。
- **不可在本 PR 验收的判据**：真实 LLM 端到端的 E-1/E-2（同 chat 记忆 42 / 新 chat 隔离，属 pr-003 模块级已验证 + pr-005 端到端）、单 chunk 端到端 ≤200ms 时延预算（§5.3，pr-005 端到端体感）——本 PR 以"fake ACP 注入下的 SSE 事件序列与落盘事实"为其前置保证。

## 依赖图

```mermaid
flowchart LR
    T1[<b>T1</b> web.js<br/>库接线 + 启动扫尾 + 查询路由] --> T2[<b>T2</b> web.js<br/>POST /api/messages 落盘/路由/派发]
    T2 --> T3[<b>T3</b> web.js<br/>POST /api/chats/:id/close]
    T3 --> T4[<b>T4</b> web.js<br/>/api/stream + onDeliver 映射]
    T4 --> T5[<b>T5</b> web/* 三文件<br/>SSE + 关闭/模型/一次性/提示条]
    T5 --> T6[<b>T6</b> test/web.test.js<br/>fake ACP + 等价重写 + 新增用例]
    T6 --> T7[<b>T7</b> PR-004 集成验收]
```

- **关键路径（最长依赖链）**：`T1 → T2 → T3 → T4 → T5 → T6 → T7`（7 个任务、6 条边）；关键任务 = **T2**（一次问答的落盘与派发是 F01/F02/F06/F08 的共同载体）、**T4**（SSE + 终态落盘，唯一把推送链接通的点，E-4/落库/审计三条判据全在此）、**T6**（本 PR 全部判据的取证载体）。
- **同文件串行**：T1~T4 同落 `src/web.js`，故按编号单线落笔；T5 落 `web/*`（文件不相交，理论可并行——本图按单线编号执行，避免前端对着未完成的 API 面做 smoke）。
- **无环确认**：全部依赖边从被依赖任务指向依赖任务；T7 为唯一汇点，无回边、无环。

## 任务清单

### T1 — src/web.js：库接线 + 启动扫尾 + 查询路由（列表/详情）

**描述**：`startWeb` 启动序列改为「`loadConfig()` → `openDb(config.dbPath)` → `startupSweep()` → 构造 `transport = createSseTransport()` → 监听端口」（打开失败 → 打错误并退出非 0，不静默降级）；`GET /api/chats` 改调 `persist.listChats({q,agent,state,from,to,limit,offset})` 并原样返回 `{chats,total,limit,offset}`（非法参数 persist 抛错 → 400）；`GET /api/chats/:id` 改调 `persist.getChat`（未找到 → 404 + 明确错误体）；`/api/agents` 与静态页服务保持逐字不变；进程退出（SIGINT）时顺带 `db.close()` / `transport.closeAll()`。

**涉及文件**：`oamp/src/web.js`（改造；import 由 `net`+`RpcPeer` 保留用于 `/api/agents` 代理，新增 `./persist.js`、`./transport.js`）
**优先级**：P0（T2~T4 的共同前置）
**前置依赖**：无
**验收标准**（可测试 / 可追溯）：
1. 启动即开库并建目录：`openDb(config.dbPath)` 在 `server.listen` 之前调用；`OAMP_DB` 指向不存在目录时自动 `mkdir -p` 后成功启动（§4.2 建库路径 + 打开时机；载体 = 用例 1/2 的 web 子进程能起 + 临时 DB 落盘）。
2. 启动扫尾：启动时执行一次 `startupSweep()`，把本次启动前遗留的 `working` chat 置 `failed`，**不补记录**（§4.3「进程中断」行 + F02-6；载体 = 用例 15）；打不开库 → 非 0 退出且 stderr 有错误（§4.2「不静默降级」；静态核查 + 代码路径）。
3. `GET /api/chats` 返回 `{chats:[{chat_id,title,agent_id,state,created_at,updated_at,message_count}],total,limit,offset}`，默认 `limit=50`、`offset=0`，默认排序 `updated_at DESC, chat_id DESC`，**含已关闭 chat**（§4.5 + AR-06 + F03-1/2；载体 = 用例 2）。
4. `q`（标题 OR 消息文本，`%`/`_`/`\` 转义）、`agent`（`chats.agent_id` OR 参与过的 `messages.agent_id`）、`state`（四态之一）、`from`/`to`（闭区间作用于 `updated_at`，缺省不限）、`limit`/`offset` 可任意组合，条件间 AND（§4.6 + AR-07 + F03-3~7；载体 = 用例 3）。
5. 非法参数 → **400**（非 502）：`limit` 非正整数或 >200、`state` 非法、`from > to`（`persist` 抛错 → 捕获并 400 返回 `{error}`）；`/api/chats` 全链路不经 Router（§4.5/§4.6 + PR 卡验收 1；载体 = 用例 3）。
6. `GET /api/chats/:id` 返回 `{chat,messages[]}`，messages 为 `created_at ASC, id ASC` 升序，字段含 `{id,direction,agent_id,text,model,duration_ms,error,created_at,meta}`（`meta` 已解析为对象）；未知 chat → **404** + 明确"不存在"错误体（非 200 空体）（§4.5 + F03-8 + PR 卡验收 2 + F08-c「未知会话返回明确错误」；载体 = 用例 4）。
7. `GET /api/agents` 与静态页路由（`/`、`/index.html`、`/app.js`、`/style.css`）行为与本 PR 前逐字一致（§9.2「数据源与路由都不动」；载体 = 用例 1）。
8. `web.js` 全文不再出现 `router.chat_list` / `router.chat_get` / `router.chat_message`（clean cutover，§9.3 删除面；静态核查 = 全仓 grep `chat_list\|chat_get\|chat_message` 只在 `router.js`/`registry.js` 命中）。
9. SIGINT 退出流程：`transport.closeAll()` + `db.close()` 后 `resolve(0)`；既有"二次 SIGINT 直接 exit(130)"语义不变（§5.1 closeAll 用途；静态核查 + 用例 14 的 web 正常退出）。

### T2 — src/web.js：POST /api/messages（预生成 id / 路由判定 / 先落 in / 派发 / 失败面）

**描述**：重写 `POST /api/messages`：校验（agent 标识、非空文本、`model` 形态）→ `chat_id = body.chat_id || 'chat-'+randomUUID()`、`task_id = 'task-'+randomUUID()` → 已关闭 chat → 409 → `insertInput({chatId,text,agentId,meta:{task_id}})`（标题在 persist 内取 `text.trim().slice(0,40)`）→ 推 SSE `message`(in) + `chat_state`(working) → 按 `!` / `one_shot` / 默认 构造 payload 并 `message.send` → 成功返回 `{chat_id,task_id}`，失败落 `insertOutput({error:'dispatch_failed', text:'派发失败：<原因>'})` 并返回 `{chat_id,task_id:null,warning}`。

**涉及文件**：`oamp/src/web.js`（同一文件，承接 T1 的持久层与 transport 实例）
**优先级**：P0（F01/F02/F06/F08 的共同载体）
**前置依赖**：T1
**验收标准**（可测试 / 可追溯）：
1. 新 chat 预生成标识：`chat_id` 形如 `chat-<uuid>`、`task_id` 形如 `task-<uuid>`，响应 `{chat_id,task_id}` 均非空；`title = text.trim().slice(0,40)`（>40 字符输入被截断）且**首轮之后的追加输入不改标题**（§4.1/§10.1 + AR-01/AR-02 + F01-2 + PR 卡验收 3；载体 = 用例 5/6）。
2. **输入先落盘**：`insertInput` 在 `message.send` **之前**同步 await 完成，且 `meta={task_id}` 与响应中的 `task_id` 同值；落盘后立即推 `message`（`direction:'in'`）与 `chat_state`（`working`）两个 SSE 事件，且这两个事件早于终态事件（§4.3 输入行 + §10.1 ③ + F02-3 + PR 卡验收 3；载体 = 用例 5/12 的事件序列）。
3. 已关闭 chat 提交 → **409** `{error:...}`，且不产生任何新记录、不派发（§4.3/§6.4 + AR-03 + F01-5 + PR 卡验收 4；载体 = 用例 8）。
4. 校验面 → **400**：缺 `agent_id`（且 `@agent 文本` 兜底解析也拿不到）→ `{error:'需要指定目标 agent…'}`；`text` 去空白后为空 → 400；`model` 存在但不匹配 `^[A-Za-z0-9._/-]{1,128}$` → 400（§7.2 校验行「非法 → 400/拒收」，取 web 侧 400 以杜绝 agent 拒收导致的 chat 悬挂；载体 = 用例 7）。
5. `@agent 文本` 服务端兜底解析保留：`text` 形如 `@dev-1 正文` 且未给 `agent_id` 时，目标 = `dev-1`，派发 prompt 为去掉 `@agent ` 前缀后的正文（§9.2 + F08-4 + PR 卡验收 4；载体 = 用例 5）。
6. 执行路径判定顺序（§9.1 + AR-15 + F08-1/2 + PR 卡验收；载体 = 用例 10）：
   - `!` 前缀 → `{command:'/bin/sh', args:['-c', <去前缀正文>], label}`（0010 原样）；
   - `one_shot:true` → `{executor:'omp', prompt, model?, label}`；
   - 否则（默认）→ `{executor:'omp-daemon', chat_id, prompt, model?, label}`（`chat_id` 非空）。
7. `model` 透传：请求携带 `model` → payload **含**该值；未携带 → payload **不带** `model` 键（web **不做**二次解析、**不注入**默认值——默认链由 agent 侧解析）（§7.1/§7.2 + F06-2/3 + PR 卡验收 6；载体 = 用例 11 的 fake ACP argv 与默认链断言）。
8. 派发失败：`message.send` 抛错（目标离线/UNREGISTERED）→ 落**一条** `direction='out'` 记录（`error='dispatch_failed'`、`text='派发失败：<原因>'`）、chat → `failed`、响应 `{chat_id,task_id:null,warning}`（200）；该 chat 记录数**恰 2 行**（in+out）（§4.3「派发失败」行 + §4.4 + F02-1/4 + PR 卡验收 4；载体 = 用例 9）。
9. 终态落盘：T4 把 `task.result` 落到 `insertOutput` 后，该 chat 一次问答**恰 2 行**（1 in + 1 out），`SELECT DISTINCT direction` = `{in,out}`，过程零行（§4.3/§4.7 + F02-1/2/5 + E-5；载体 = 用例 5/12 的库行数与 direction 断言）。
10. chat 状态机：新建即 `working` → 终态 `completed`（成功）或 `failed`（失败轮/派发失败）；`updated_at` 在 in/out 落盘时前移（§4.3 + AR-01 + F01-3/4；载体 = 用例 5/6/9）。

### T3 — src/web.js：POST /api/chats/:id/close（幂等 + 释放上下文控制消息）

**描述**：新增 close 路由：`getChat` 未找到 → 404；已 `closed` → 直接返回 `{chat_id,state:'closed'}`（幂等，不再重复发控制消息）；否则 `persist.closeChat(chatId)` → 推 SSE `chat_state`(closed) → 取该 chat 的 `DISTINCT agent_id`（由 `getChat().chat.agent_id` 与 `messages[].agent_id` 归并，persist 无独立查询接口）→ 逐个 best-effort 发控制消息 `notice{kind:'context_release', chat_id}` 给对应 agent（离线/失败忽略）→ 200 `{chat_id,state:'closed'}`。

**涉及文件**：`oamp/src/web.js`（同一文件）
**优先级**：P0
**前置依赖**：T2
**验收标准**（可测试 / 可追溯）：
1. `POST /api/chats/:id/close` → 200 `{chat_id,state:'closed'}`；库中 `chats.state='closed'`、`closed_at`/`updated_at` 前移；**数据不删**（messages 行数与关闭前一致，`GET /api/chats/:id` 仍返回完整消息流）（§4.5 + §10.2 + F01-5/6 + PR 卡验收 5；载体 = 用例 14）。
2. **幂等**：对已关闭 chat 再次 close → 仍 200 `{chat_id,state:'closed'}`，且**不重复**发送控制消息（不产生第二条 `context_released` 提示）（§4.5「幂等：已关闭再关仍返回 closed」+ PR 卡验收 5；载体 = 用例 14 的 notice 恰 1 条断言）。
3. 控制消息 kind 与寻址：web → agent 的**控制消息** kind = `context_release`（`payload(body) = {kind:'context_release', chat_id}`），发给该 chat 出现过的各 **DISTINCT** `agent_id`（含 `chats.agent_id` 与 `messages.agent_id`），agent 离线 → 忽略不报错（§6.4 释放行 + §5.2 命名区分 + §10.2 + F05 架构维度 + PR 卡验收 5；载体 = 用例 14 —— agent 侧收到控制消息后 kill 该 chat 子进程并**回发** `notice{kind:'context_released'}`）。
4. **提示归属**：web 的 close 路由**不自行 publish** `notice`；SSE 上的 `notice{kind:'context_released'}` 只能来自 agent 回发的转发（否则双条提示）。据此，若该 chat 无任何已注册 agent（无回发）→ SSE 上**没有** notice（§5.2 命名区分 + 本 PR 对接契约「notice 归属裁定」；载体 = 用例 14：有 agent 时恰 1 条、notice 断言与"web 不 publish"静态核查双证）。
5. 关闭后该 chat 仍在 `GET /api/chats` 列表中（state=closed，可被 `state=closed` 过滤命中）（F03-1 + AR-07「含已关闭」；载体 = 用例 2/14）。
6. 未知 chat → 404 + 明确错误体（与 T1-6 同口径；载体 = 用例 14）。
7. `context_release` 送出后，agent 若回发 `notice`，由 T4 的 `onDeliver` 转发为 SSE `notice{kind:'context_released', text}`（本任务只负责发起控制消息与 SSE `chat_state`）（§5.2 + F05-7；载体 = 用例 14）。

### T4 — src/web.js：GET /api/stream + onDeliver 三类映射 + 终态落盘

**描述**：新增 `GET /api/stream?chat_id=` → `transport.handle(req,res,{chatId})`（缺 `chat_id` → 400）；给常驻 `NodeClient` 装配 `onDeliver`：`task.update` → 推 SSE `task_update`（**不入库**）；`task.result` → `insertOutput({text,model,durationMs,error,meta:{context_id,pid}})` → 推 SSE `message`(out) + `chat_state`；`notice` → 推 SSE `notice`（**不入库**）；维护 `task_id → chat_id` 关联表（派发时登记、终态时清除），使三类消息都能定位到 chat。

**涉及文件**：`oamp/src/web.js`（同一文件）
**优先级**：P0（E-4 / 落库 / 审计三条判据的唯一承载点）
**前置依赖**：T3
**验收标准**（可测试 / 可追溯）：
1. `GET /api/stream?chat_id=<id>` 建立 `text/event-stream` 连接（`retry: 1000` + 15s `: keepalive`，由 transport 提供）；缺 `chat_id` → 400；连接 `close` → 订阅移除（§5.2 端点行 + §5.4 + AR-08/AR-10；载体 = 用例 12/13）。
2. `onDeliver` 收 `task.update`：payload body `{state:'working', kind:'chunk', text}` → 推 SSE `task_update{chat_id,task_id,kind:'chunk',text}`；`kind:'stdout'|'stderr'` + `line` → 同形转发（一次性/shell 路径）；**无 `kind` 的条目（如各路径的 `event:'started'`）不推**；全部 `task.update` **永不入库**（§5.2 事件表 + §5.3 推送链 + §4.7 + F04-3/5；载体 = 用例 12/16 的"行数恰 2"与事件断言）。
3. `onDeliver` 收 `task.result`（终态）：以 `task.result.model`（ACP 实报生效值，**可能 ≠ 请求值**，读不到即 `null`）写 out 记录的 `model`；`duration_ms` 取 payload；`error` 有则写；`meta={context_id,pid}`；`text` = 成功轮 `result.text`、失败轮可见错误摘要；随后推 SSE `message`(out) + `chat_state`（§4.3 输出行 + §7.4 审计 + §10.1 ⑦ + F02/F06-3 + PR 卡验收 6；载体 = 用例 11/12）。
4. **E-4**：该轮 SSE `message`(out) 事件**之前**已收到 **≥2 个** `task_update`（`kind:'chunk'`）且文本长度**递增**；终态到达前内容已增长（§5.2/§5.3 + E-4 + PR 卡验收 8；载体 = 用例 12）。
5. `onDeliver` 收 `notice`（agent 侧 kind ∈ `{context_released, context_reset}`）：转发 SSE `notice{chat_id,kind,text}`，**不入库**（§5.2 + §6.3 + F05-7 + PR 卡验收 7；载体 = 用例 14）。
6. 无订阅者时 `publish` 直接丢弃、不缓存、不抛错（发送与落盘照常完成）（§5.4 + AR-10；载体 = 用例 13）。
7. chat 定位：`task.update`/`task.result` 的 body **不含 `chat_id`**（仅 daemon 的 `started` 条目含）——web 用派发时登记的 `task_id → chat_id` 关联表解析目标 chat；终态后清除该登记（依据 = agent 侧 `sendTaskMessage` 的 daemon 成功/失败 body 字段集 + §5.3「web.onDeliver → transport.publish(chat_id,…)」；载体 = 用例 12 断言事件带正确 `chat_id`；见 MI-5）。
8. `chat_state` 事件与库中状态一致：迟到的 `task.result` 不得把已关闭 chat 显示为 `completed`（§4.3 `WHERE state!='closed'` 哨兵 + §6.4「在飞轮次走崩溃路径收尾，chat 状态仍为 `closed`」；载体 = 用例 14/12 的 closed 场景；见 MI-7）。
9. 终态成功后该 chat 一次问答在库中**恰 2 行**且 `direction ∈ {in,out}`（与 T2-9 同一事实的终态侧）（§4.7 + E-5；载体 = 用例 5/12）。

### T5 — oamp/web/{index.html,style.css,app.js}：SSE 订阅 + 关闭/模型/一次性/提示条

**描述**：删掉 1.5s 轮询；打开 chat 时建立 `new EventSource('/api/stream?chat_id=…')`，`onopen` 与页面加载时全量拉取 `GET /api/chats/:id`（列表拉 `GET /api/chats`）；按四类事件增量渲染（`task_update` 追加到当前轮输出气泡、`message` 以落盘文本替换、`chat_state` 更新角标与列表、`notice` 插入系统提示条，不入库不持久）；新增关闭按钮、模型输入框、一次性开关；提交 payload 带上 `model`（**不预填默认值**）与 `one_shot`；保留 0010 视觉与 `@` 补全 / `!` 命令提交形态。

**涉及文件**：`oamp/web/index.html`、`oamp/web/style.css`、`oamp/web/app.js`（改造）
**优先级**：P0
**前置依赖**：T4
**验收标准**（可测试 / 可追溯）：
1. **轮询消失**：`app.js` 中 `POLL_MS` / `setTimeout(tick` 形态的轮询代码不存在；`EventSource('/api/stream?chat_id=')` 订阅存在且按当前打开 chat 建立（§9.2「1.5s 轮询移除，改 SSE」+ F04-2 + PR 卡验收 10；载体 = 用例 16 静态断言）。
2. **onopen 全量拉取**：`EventSource.onopen` 与页面加载路径均调用 `GET /api/chats/:id` 全量拉取当前 chat；`message` 事件以落盘文本为准替换流式拼接结果（§5.4 断线兜底 + §5.3 前端渲染行 + F04-7 + PR 卡验收 9；载体 = 用例 16 静态断言 + 用例 12 行为侧）。
3. 增量渲染：`task_update` 在输出气泡上追加（首条创建占位、后续追加）；`chat_state` 更新列表项角标与详情元信息；`notice` 在对话流内插入系统提示条（§5.2/§5.3 + F04-3 + F05-7；载体 = 用例 16 静态断言）。
4. 新增控件可用（§9.2「新增最小控件」+ PR 卡验收 10）：`index.html` 含关闭按钮（调 `POST /api/chats/:id/close`）、模型输入框（值随提交透传为 `model`，**不带默认值预填**）、一次性开关（勾选时 `one_shot:true`）、系统提示条容器；`style.css` 含上述控件与提示条样式（沿用 0010 视觉变量）。
5. 提交契约：`POST /api/messages` body 为 `{chat_id?, agent_id, text, model?, one_shot?}`；已关闭 chat 时前端呈现 409 的明确提示（不静默）（§4.5 + F01-5；载体 = 用例 16 + 手工 smoke）。
6. `@` 补全与 `!` 命令提交保留：`/api/agents` 驱动的补全、`@` 插入、`!` 异常路径照旧（§9.2 + F08-4；载体 = 用例 16 静态断言 + 用例 10 服务端行为）。
7. 新 chat 发送成功（POST 返回 `chat_id`）后，前端立即对该 `chat_id` 建立/切换 SSE 订阅（PR 卡「EventSource 订阅生效」；见 MI-8）。

### T6 — oamp/test/web.test.js：fake ACP 注入 + F08-a~d 等价重写 + 新增能力用例

**描述**：重写 `test/web.test.js`：内联 fake ACP 脚本（`OAMP_OMP_BIN` 注入 agent 子进程；范式 = `context-pool.test.js:19-142` 的 `acp` 常驻 + `-p` 一次性双形态 + 可编排 `FAKE_ACP_HANG` / `FAKE_ACP_STICKY_MODEL` / 模型回读 + per-session 记忆 + ≥2 chunk 分片），harness 起真实 Router/agent + `oamp web start` 子进程（随机端口 + **临时 `OAMP_DB`**），以 fetch 断言 REST、以 fetch+reader 手工解析断言 SSE。逐条覆盖 F08-a~d 等价项 + F01~F06 新增判据；**不依赖真实 omp/真实 LLM/外网**，不写真实 `oamp/data/sql.db`。

**涉及文件**：`oamp/test/web.test.js`（重写；fake ACP 源码内联本文件，不新增 helpers 文件）
**优先级**：P0（T1~T5 全部判据的取证载体）
**前置依赖**：T5
**验收标准**（可测试 / 可追溯，`node --test test/web.test.js` 单独全绿）：
1. **F08-d 等价 —— 静态页 + 在线 agent**：`GET /` 200 且含 `oamp`/`Web Console` 标识；`GET /api/agents` 返回 `dev-1` 且 `state==='online'`（断言强度不低于原用例；载体 = 用例 1）。
2. **列表面（T1-3/5）**：`GET /api/chats` 返回 `{chats,total,limit,offset}`，项字段齐 `{chat_id,title,agent_id,state,created_at,updated_at,message_count}`；默认 `updated_at DESC`；**含已关闭 chat**（关闭一个后仍在列表中）（载体 = 用例 2）。
3. **过滤/分页/400 面（T1-4/5）**：`q` 命中标题与命中消息文本各一例、`%` 输入不命中全部（转义生效）、`agent` 相关性（默认 agent 或参与过）、`state` 过滤、`from`/`to` 闭区间；`limit` 非正整数 / `limit>200` / `state` 非法 / `from>to` → 400；`limit`+`offset` 分页取到子集（载体 = 用例 3）。
4. **详情面（T1-6）**：`GET /api/chats/:id` 消息 `created_at ASC, id ASC` 升序、`meta` 为对象、字段集齐；未知 chat → **404** 且 body 含明确错误（原用例断言 `chat===null`，重写后为 404 + error，属"明确的『不存在』错误"口径提升）（载体 = 用例 4）。
5. **F08-a 等价 —— 发送 → 落盘 → 终态 → 回流**：提交一条消息 → 返回 `chat_id`/`task_id` 非空且形态为 `chat-<uuid>`/`task-<uuid>`；`title` 含首条输入文本且 ≤40 字符；终态后 `messages.length===2`（1 in + 1 out）、out 文本含 fake ACP 回答、in 的 `meta.task_id === 响应 task_id`；列表项 `state==='completed'`（对应原断言：chat_id/task_id 非空、标题含文本、`exit_code===0`、stdout 含发送内容、列表 completed；`exit_code` 语义由"任务明细 exit_code"迁移为"终态 out 记录存在"）（载体 = 用例 5）。
6. **F08-b 等价 —— 追加到既有 chat**：同一 `chat_id` 追加第二条 → 返回同一 `chat_id`、消息序列 2 轮共 4 行（2 in + 2 out）、第二轮终态 `completed`（载体 = 用例 6）。
7. **F08-c 等价 —— 错误面**：缺 agent 标识 → 400 + 明确错误；空白输入 → 400 + 明确错误；未知 chat 详情 → 明确"不存在"错误（400/404，非 200 空体）；另加 `model` 非法 → 400（载体 = 用例 7 + 4）。
8. **已关闭 409（T2-3）**：close 后 `POST /api/messages` → 409，且该 chat 记录数不变（载体 = 用例 8）。
9. **派发失败（T2-8）**：目标 agent 未注册 → 200 + `warning`、库中恰 2 行且 out `error==='dispatch_failed'`、chat `state==='failed'`（载体 = 用例 9）。
10. **执行路径（T2-6）**：默认路径 fake ACP argv 含 `acp`；`one_shot:true` 走 `-p` 且 out 含一次性输出；`!` 前缀走 shell 且 out 含命令回显——三形态互不干扰（F08-1/2）（载体 = 用例 10）。
11. **model 审计（F06-3 / §7.4）**：① 请求带 `model=alpha/model-a` → fake ACP argv 含 `--model alpha/model-a` 且 out 记录 `model==='alpha/model-a'`；② `FAKE_ACP_STICKY_MODEL=1` 下请求 `model=alpha/model-x`（ACP 接受但未生效）→ out 记录 `model` = ACP 实报值（**≠ 请求值**，杜绝回显冒充）；③ 未带 `model` + agent 侧 `OAMP_OMP_MODEL=beta/model-b` → argv 含 `--model beta/model-b`（证明 web 未注入默认、默认链在 agent 侧）；且 `GET /api/chats/:id` 可读回 out 的 `model`（PR 卡验收 6；载体 = 用例 11）。
12. **SSE 事件序列 + E-4（T4-2/3/4）**：先对既有 chat 订阅 SSE，再提交该 chat 的第二轮——事件序列为 `message(in)` → `chat_state(working)` → **≥2 个 `task_update`（`kind:'chunk'`，text 长度递增）** → `message(out)` → `chat_state(completed)`；所有 `task_update` 早于该轮 `message(out)`；该轮结束后该 chat 行数仍为 4（过程不入库）（PR 卡验收 8；载体 = 用例 12）。
13. **SSE 端点面（T4-1/6）**：缺 `chat_id` → 400；无订阅者时发送照常成功（不因无订阅者报错）（载体 = 用例 13）。
14. **close 幂等 + 释放提示（T3-1~4）**：首次 close → 200 `{chat_id,state:'closed'}`、列表仍含该 chat、消息不删；二次 close → 200 closed 且 SSE 上 `notice{kind:'context_released'}` **恰 1 条**（agent 回发经 web 转发，web 不自行 publish）；未知 chat → 404（PR 卡验收 5；载体 = 用例 14）。
15. **启动扫尾（T1-2）**：`FAKE_ACP_HANG=1` 下发送一条（chat 停在 `working`，库中 1 行 in）→ 停 web → 以**同一 `OAMP_DB`** 重启 web → 该 chat `state==='failed'` 且消息仍为 1 行（不补记录）（§4.3；载体 = 用例 15）。
16. **前端契约（T5）**：静态读 `web/app.js` 断言无轮询常量/`setTimeout(tick`、含 `EventSource('/api/stream?chat_id=` 与 `GET /api/chats/` 全量拉取调用；`web/index.html` 含关闭按钮/模型输入框/一次性开关/提示条容器；`web/style.css` 含对应选择器；`@` 补全与 `!` 提交流程代码路径保留（载体 = 用例 16）。
17. 用例之间独立启停（每测试独立 router/agent/web 子进程 + 独立临时 socket 目录 + 独立临时 `OAMP_DB`），无端口/文件/进程/数据库残留；`node --test test/web.test.js` 独立全绿且不依赖外网（§17 测试策略）。
18. `[model_inferred→待主 agent 确认 MI-6]`：E-4 用**既有 chat 的第二轮**取证——新 chat 的 `chat_id` 在 `POST` 响应中才可得，订阅必然晚于首轮派发；首轮早期 chunk 无法被订阅者观察属 §5.4「断线期间的过程增量不补发」的既有边界；且该用法完全满足 E-4「该轮 message(out) 之前 ≥2 个 task_update」的字面判据。

### T7 — PR-004 集成验收

**描述**：PR 级收口——`node --test test/web.test.js` 与 `npm test` 一次同跑全绿，逐条对照 PR 卡 10 条验收标准取证，核查文件范围、`router/registry` 未被修改、其余测试文件未被修改。

**涉及文件**：无新增（核查面：`oamp/src/web.js` 的改动 diff、`oamp/web/*` 三文件 diff、`oamp/test/web.test.js` 重写 diff、`oamp/test/` 其余 14 个文件的"未改动"事实、`package.json` 无依赖变更）
**优先级**：P0
**前置依赖**：T6
**验收标准**（可测试 / 可追溯，逐条对应 PR 卡「验收标准」10 条）：
1. `oamp/` 下 `node --test test/web.test.js` 全绿；`npm test`（`node --test test/*.test.js`）全绿——含其余 14 个既有测试文件原样通过（PR 卡验收 10 + F08-3 + §19 裁决 2；运行核查）。
2. 逐条对照 PR 卡验收 1~10（列表/详情/`POST /api/messages` 落盘与状态/409 与派发失败/close 幂等与释放/模型透传与审计/SSE 四类映射与不入库/E-4/断线全量拉取/F08-a~d 等价+前端轮询移除）——每条给出用例编号与断言证据（运行核查 + T6 记录）。
3. 文件范围核查：本次改动仅 `oamp/src/web.js`、`oamp/web/{app.js,index.html,style.css}`、`oamp/test/web.test.js` 与本任务图文档；`git status` 无其他改动；`package.json` 无依赖变更（PR 卡「文件范围」；git 核查）。
4. 边界核查：`router.js` / `registry.js` 的 `chat_*` 与会话表**未被修改**（删除归 pr-005）；`web.js` 内 `router.chat_*` 调用已清零（clean cutover）；其余 14 个测试文件零修改（§9.3 边界 + 多 PR 契约；git diff 静态核查）。
5. 注：真实 LLM 的端到端记忆/隔离（E-1/E-2）与单 chunk ≤200ms 时延预算**不在本 PR 验收**（前者 pr-003 模块级已验、端到端归 pr-005；后者 §5.3 为设计预算），本 PR 以 fake ACP 下的 SSE 序列与落盘事实为其前置保证（§17 测试策略）。

## model_inferred 汇总（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | `POST /api/messages` 收到**未知** `chat_id` 时按"取/建"语义新建该 id 的 chat（`persist.insertInput` 的 `ensureChat` 行为），**不** 404 —— §4.5/§10.1 只写"取/建 chat"，未定义"给了一个不存在的 chat_id"的语义；该路径从 UI 不可达（chat_id 只由 web 生成）。若主 agent 倾向 404，需在 T2-1 增加分支 | §10.1 ②「web: 取/建 chat」+ persist `ensureChat` 的 ON CONFLICT DO NOTHING |
| MI-2 | T3 | "幂等"口径 = 重复 close 仍 200 `{state:'closed'}` 且**不再重复**发 `context_release`（避免重复提示）；简报措辞「close 幂等 409 语义」中 409 指"已关闭 chat 再次提交输入"（T2-3），非重复 close | §4.5 明文「幂等：已关闭再关仍返回 closed」+ §6.4 + F01-5 |
| MI-3 | T4 | 只有带 `kind` 的 `task.update`（`chunk`/`stdout`/`stderr`）转 SSE `task_update`；无 `kind` 的条目（各路径的 `event:'started'`）**不推** | §5.2 事件表 `task_update` 负载字段集 `{chat_id,task_id,kind,text?,line?}` |
| MI-4 | T2 | `model` 形态校验（`^[A-Za-z0-9._/-]{1,128}$`）取 web 侧 **400** 分支（而非交 agent 拒收）——否则 agent ack rejected 会让 chat 永久停在 `working`（web 侧无拒绝回执通道） | §7.2「校验 `^[A-Za-z0-9._/-]{1,128}$`，非法 → 400/拒收」（二选一，取 400）+ §4.3 无"拒收"落盘行 |
| MI-5 | T4 | `task_id → chat_id` 关联表由 **web 在派发时登记**（终态清除）：agent 侧 daemon 的 `task.update`（chunk）与 `task.result` body **不含 `chat_id`**，仅 `started` 条目含；§5.3 要求 publish 到 `chat_id` | §5.3 推送链 `web.onDeliver → transport.publish(chat_id, …)` + `src/agent.js:263-320` 的 body 字段集 |
| MI-6 | T6 | E-4 的取证轮次 = **既有 chat 的第二轮**（见 T6-18 理由）；新 chat 首轮的早期 chunk 不可被订阅者观察属 §5.4 已接受的边界 | §5.4「断线期间的过程增量不补发」+ E-4 字面判据 |
| MI-7 | T4 | `chat_state` 事件必须与库中状态一致：已关闭 chat 的迟到 `task.result` 只落 out 记录、不改状态、SSE 不得显示 `completed`（实现可取库回读或进程内关闭集合） | §4.3 `WHERE state!='closed'` 哨兵 + §6.4「chat 状态仍为 `closed`」 |
| MI-8 | T5 | 新 chat 首次发送后，前端对该新 `chat_id` 建立/切换 SSE 订阅（PR 卡只写"EventSource 订阅生效"，未定义 chat 切换时机） | §5.4 断线/刷新全量拉取 + PR 卡验收 10 |

## 开放项（不阻断本 PR，报告主 agent）

- **O-1（同文件多任务）**：T1~T4 同落 `src/web.js`。任务图按"可独立验收的行为切片"拆分，实现按编号单线落笔，不并行编辑同一文件。
- **O-2（`message` 事件负载组装）**：`persist.insertInput/insertOutput` 返回 `{chat_id,message_id}`，不含 §5.2 负载所需的 `text/model/duration_ms/error/created_at` 全字段；web 需在落盘处用已知值 + `nowMs`（persist 入参）+ 返回的 `message_id` 组装 SSE 负载（或落盘后回读该行）。属实现选择，不改变 §5.2 的负载契约。
- **O-3（`persist` 只读不改）**：本 PR 不得修改 `src/persist.js`——close 路由所需的 `DISTINCT agent_id` 由 `getChat()` 返回的 `chat.agent_id` + `messages[].agent_id` 归并，不新增 persist 查询函数（文件范围约束）。
- **O-4（不可在本 PR 验收的判据）**：E-1/E-2 的真实 LLM 端到端（pr-003 已模块级验证、pr-005 端到端）、单 chunk ≤200ms 时延预算（§5.3）、F04-7 的真实浏览器断线重连体感（本 PR 以 `onopen` 全量拉取的静态/行为断言覆盖）。
- **O-5（前端无自动化浏览器断言）**：T5 的验收以 `web.test.js` 的静态契约断言（用例 16）+ 服务端行为用例承载；真实浏览器渲染与交互（关闭按钮点击、模型输入框提交、提示条可见）由 pr-005 端到端/手工验证兜底（§17 手工层）。
