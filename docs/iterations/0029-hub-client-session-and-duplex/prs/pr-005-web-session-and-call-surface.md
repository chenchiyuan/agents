# pr-005：HTTP 会话面与调用面（`oamp/src/web.js`）

## 上下文摘要

本迭代 HTTP 面的**全部**改动都落在 `oamp/src/web.js`（路由表是"登记只有一处"的单点，`createApiRoutes` 是唯一登记面 ⇒ 该文件只能由一个 PR 拥有，文件范围不可再分）。内容：8 条新路由、`POST /api/calls` 的 `requester` 解析与自派发 `warnings`、`publishCallResult` 补"写取件指针 + 关流 + 解等待句柄"、投影轮询扩展（`task_list` → `agent_state`）、`GET /api/agents` / `GET /api/calls` 追加字段、`ERR_CODE` +`STALE_EPOCH`、`epoch` 观测、软重启名册提示（`.runtime/roster.json`，L1-01 已确认）。

硬约束：**路由登记位置** —— `GET /api/calls/wait` 必须登记在 `GET /api/calls/:call_id`（现表末位）之前，否则被当成 `call_id='wait'` 吞掉；既有 21 条端点的参数语义、校验顺序、错误文案与既有 4 条推送面逐字不变（§6.1 Z-1~Z-7）。

## 涉及功能点

- F01
- F02
- F03
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F13
- F14
- F15
- F16
- F17
- G01

## 文件范围

- `oamp/src/web.js`
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md`（本 PR 文件）

不触碰：`oamp/API.md` / `oamp/llms.txt`（文档面归 pr-006）、`oamp/sdk/surface.js` / `oamp/skill/hub.md`（入口面归 pr-007）、`oamp/web/**`（控制台归 pr-004）、`oamp/src/transport.js` / `src/registry.js` / `src/router.js` / `sdk/uds.js`（归 pr-001 / pr-003）、`oamp/src/persist.js` / `oamp/README.md` / `oamp/sdk/doctor.js` / `oamp/scripts/gen-llms-txt.mjs`（零改动）。

消费面（依赖已保证顺序，按合并后的实际导出面接线）：`oamp/src/principals.js` / `oamp/src/pickup.js`（pr-002）、`oamp/src/transport.js` 的过滤订阅注册表与 `closeCallSubscriptions`（pr-003）、`router.task_cancel` / `router.status.generation` / 节点 `connected` / 任务 `started_at`（pr-001）。

## 验收标准

**路由登记与元数据（F17 / §5.1）**

- [ ] 8 条路由登记在 `createApiRoutes` 表内（`oamp/src/web.js:475`），每条按既有 8 个元数据字段声明：`POST /api/principals`、`GET /api/principals/:principal_id`、`GET /api/subscribe`（`kind:'sse'`）、`GET /api/pickup`、`POST /api/pickup/:call_id/ack`、`GET /api/calls/wait`、`POST /api/calls/:call_id/cancel`、`GET /api/health`
- [ ] **可达性**：`GET /api/calls/wait` 的实际匹配优先于 `GET /api/calls/:call_id`（表中位置在其之前）；`GET /api/calls/wait` 不被解析为 `call_id='wait'`。反证：把该行临时移动到表末位 ⇒ 请求落 404 `call 不存在: wait`（F11 / §5.1 位置纪律）
- [ ] `GET /api/docs` 投影含上述 8 条（请求时现算）；既有 21 条的 summary 与既有字段说明**逐字未改**（`params` / `response` / `errors` 只做追加）（F17 验收 1/5）
- [ ] `ERR_CODE` 追加 `STALE_EPOCH`（↔ 409）一项，既有 5 码与文案逐字不变；全部 4xx/5xx 仍经 `sendError` 唯一构造点（F08 验收 1 / Z-4）

**F01 身份面**

- [ ] `POST /api/principals {principal_id, kind?, instance_id?}` ⇒ 200 `{principal:{principal_id,kind,instance_id,created_at,last_seen_at}, epoch}`；同一 id 连续两次注册 ⇒ 两次 200 且 `created_at` 一致（幂等，不返回冲突）
- [ ] `GET /api/principals/<id>`：存在 ⇒ 200 同形并前移 `last_seen_at`；不存在 ⇒ 404 `NOT_FOUND`（既有体例）；两响应均含 `epoch`
- [ ] 形态非法（空 / >64 / 含控制字符）⇒ 400 `INVALID_PARAM`（校验规则与 `registry.isValidInstanceId` 同源）
- [ ] "任一被受理的请求前移 `last_seen_at`"一条规则覆盖注册 / 按 id 查询 / 订阅 / 派发 / 取件 / 取件确认（逐面各做一次前后对比）
- [ ] 重启 web 后用同一 `principal_id` 再注册 ⇒ 200、`created_at` 取新进程的首次交互时刻（新身份，但**调用方不改任何身份**即可继续派发与查询：F01 验收 4 的落地形态）

**F02 / F14 派发归属与自派发告警**

- [ ] 不携带 `requester` 的 `POST /api/calls`：响应字段集与取值域与迭代前逐字相同（对照实验：同入参两组，唯一变量 = 是否携带 `requester`）（F02 验收 2 / F14 验收 6）
- [ ] 携带 `requester` 且目标 = 该身份声明的 `instance_id` ⇒ 响应顶层含 `warnings[{index, call_id, kind:'self_dispatch', message}]`，且调用照常派发（不硬拒、不返回业务失败）（F14 验收 1）
- [ ] 对照实验：同入参仅把目标换成非自身实例 ⇒ `warnings` 为 `[]`（唯一变量 = 目标是否自身实例）（F14 验收 2）
- [ ] 批量两项、仅第二项自派发 ⇒ `warnings[0].index === 1` 且 `call_id` 指向该项（可逐项定位）（F14 验收 4）
- [ ] `requester` 不进信封：`GET /api/calls/<id>` 的键集仍为既有 11 键（`call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code` + 既有键序），无 `requester` / `warnings`（F02 验收 5 / Z-2）
- [ ] 未注册的 `requester` ⇒ 按需幂等 upsert、**不阻断派发**（MI-3）；既有校验顺序（模式枚举 / schema / 批量上限 / 角色可寻址）逐字未动（Z-5）

**F03 订阅第一形态（SSE）**

- [ ] `GET /api/subscribe?principal=&kinds=&agents=&epoch=` 建立 SSE（沿用既有头 / `retry: 1000` / 15s keepalive 内核）；`principal` 缺失或空 ⇒ 400 `INVALID_PARAM`
- [ ] 事件名集合恰为 7 名：`agent_online / agent_offline / agent_state / call_state / call_update / call_result / confirmation`（`notice` 不出现，其语义由既有 `confirmation` 承载）；`kinds` 域外值 ⇒ 400
- [ ] 过滤：`kinds=['agent_online']` 的订阅者收不到 `call_state`；`agents` 给角色名与给实例名**等价**（实例↔角色归一，复用 `role-binding`）；`kinds` 与 `agents` 同时给出为 AND
- [ ] 订阅建立**不发初始帧**；无订阅者时事件被丢弃且零错误；断开再连**不要求补发**（F03 验收 3/4）
- [ ] 隔离：该订阅的存在与断开不影响既有 4 条推送面的订阅者及其事件到达（同一次会话内四面对照）（F03 验收 5 / Z-1）
- [ ] 既有 `GET /api/events` 与 `GET /api/stream`、`GET /api/calls/stream`、`GET /api/calls/<id>/stream` 的事件类集合与语义**逐字不变**（G01 验收 1）

**F05 / F16 / F06 投影与进展字段**

- [ ] `GET /api/agents` 每行**追加** `connected / busy / current_call_id / queued / since`，既有 5 键（`instance_id / session_id / state / last_heartbeat / role`）名与值域不变；`?state=online` 的判据仍为 `state === 'online'`（不加第三取值）（F05 验收 6 / F16 验收 6 / Z-5）
- [ ] 空闲实例 ⇒ `busy:false / current_call_id:null / queued:0 / since:null`（F05 验收 2）；在跑 ⇒ `busy:true` 且 `current_call_id` 与 `GET /api/calls/<id>` 查回的同一调用 id 一致（同源不漂移，F05 验收 3）
- [ ] 对同一实例在跑期间连续派发 N 次 ⇒ `queued ≥ 1` 且随队列消化下降（F05 验收 4）
- [ ] 订阅面：新面订有 `agent_state` 时，某实例"空闲 → 在跑 → 空闲"的跳变**不轮询**即可看到；无 `agent_state` 订阅者时**不拉** `router.task_list`（零新增 UDS 流量）（F05 验收 5 / A-04 代价控制）
- [ ] 三态：`state:'online' + connected:true`（在线）/ `state:'online' + connected:false`（重连中）/ `state:'offline'`（墓碑）在快照与订阅面上均可区分，且"重连中"的实例**不消失**（F16 验收 1）
- [ ] 软重启窗口（只重启 hub、保留 agent 进程）：快照中该实例**先呈** `online + connected:false`，随后回到 `connected:true`；名册提示只带实例 id，重启后**不残留**在跑投影（`busy:false / current_call_id:null`）；`heartbeatTimeoutMs` 内未回归的提示项从视图移除（F16 验收 2/5，L1-01）
- [ ] 名册提示是 best-effort：文件缺失 / 损坏 ⇒ 视为无提示、启动不报错；写失败被忽略（§9.1 局限 7）
- [ ] `GET /api/calls` 每行**追加** `last_event_at`（= 任务条目 `updated_at`），既有 6 列名与取值不变；`idle_ms` **不由服务端给出**（仅有该时刻）（F06 验收 1/5 / A-05）
- [ ] 停滞对照实验：同一时点查 roster，持续推进型调用与无新事件型调用的 `last_event_at` 呈现可区分差异；终态后该值时不再前进（F06 验收 3/4）
- [ ] 被取消 / 终态的调用不产生虚假的在跑投影（与 §9.1 局限 2 一致）

**F07 / F08 取件与代次**

- [ ] `GET /api/pickup?principal=`：只列该身份 `acked=false` 的条目；每条经 `router.task_get` + 既有 `composeCallEnvelope` **现算**正文 ⇒ 与 `GET /api/calls/<id>` 同形同取值（无第二真源）；非终态调用不出现在集合中；**无游标参数**
- [ ] 离线取件：派发后断开全部订阅 ⇒ 终态后重新接入，取件面取到该次调用的终态结果（F07 验收 1）；保留窗内重复查询结果稳定（F07 验收 2）
- [ ] `POST /api/pickup/<call_id>/ack?principal=`：200 `{call_id, acked:true}`，条目移出未取件集合；重复 ack / 不存在 id 一律 200 且无副作用（F07 验收 3）
- [ ] 只有携带 `requester` 的调用才产生取件指针（不用身份能力的调用零新增内存与行为）（F02 验收 2）
- [ ] 指针写入点为 `publishCallResult`（`oamp/src/web.js:1507`）——投递路径与对账路径**共用同一写点**，不出现第二个终态源（A-06 / Z-11）
- [ ] `epoch` 语义：`POST /api/principals` / `GET /api/principals/<id>` / `GET /api/health` 响应携带 `epoch`；web 或 Router 任一重启后 `epoch` 变化；同一对进程存续期内恒定
- [ ] `GET /api/subscribe` / `GET /api/pickup` / `POST /api/pickup/<id>/ack` 的可选 `epoch` 与当刻值不等 ⇒ 409 `STALE_EPOCH`；不给 `epoch` ⇒ 不判过期；既有面**一律不新增** `epoch`（F08 验收 1 / Z-4）
- [ ] `epoch` 观测失败（Router 不可达）⇒ 沿用最后一次已知值；从未观测到 ⇒ `0`，不因此报错

**F09 / F10 终态关流与晚订阅补发**

- [ ] 先订阅后终态：订阅在**终态当刻**结束（连接关闭），退出时刻不由任何超时值决定；把客户端侧超时调大/调小不改变该时刻（F09 验收 1/2）
- [ ] 不吞最后一帧：订阅者**先收到**终态帧、再收到关闭（同一 tick 内顺序写）（F09 验收 4）
- [ ] 关流范围只到 `call:<call_id>`：同一 hub 的对话作用域调用订阅（`chat-calls:<id>`）在该调用终态后**继续存活**并照常收后续事件（F09 验收 3）
- [ ] 晚订阅补发：对**已终态**的调用建立 `GET /api/calls/<id>/stream` ⇒ 立即收到**一帧当刻终态信封**（与 `calls get` 同形）并随即结束；不补发中间过程事件（F10 验收 1/3）
- [ ] 不存在的调用 id ⇒ 既有 404 `NOT_FOUND` 且**不建立订阅**（F10 验收 4）
- [ ] 不变量：每个调用订阅**至多一帧终态帧、至多关闭一次**（先终态后订阅与先订阅后终态两路幂等）（F10 验收 2）
- [ ] 既有"订阅者断开 ⇒ 清理订阅"路径不变（F09 验收 5）

**F11 / F12 等待入口**

- [ ] `GET /api/calls/wait?ids=<csv>&timeout_ms=` 返回 `{timed_out, timeout_ms, results[], unresolved[]}`：`results` 每条含 `call_id`、与该调用 `calls get` 信封同形状；`unresolved` 的 `state` = 当刻状态，不存在 ⇒ `null`
- [ ] 退出条件 = 全部终态：一项先终态、另一项在跑 ⇒ **不提前返回**；两者都终态当刻返回（秒级）（F11 验收 2）
- [ ] 请求含已终态 / 不存在的 id ⇒ 其结论**立即**可得（不因等待其它项而推迟，也不等到超时）（F11 验收 4）
- [ ] `timed_out` 是唯一退出原因字段：全部终态 / 全部有确定结论 ⇒ `false`；到上限返回 ⇒ `true` 且未终态项留在 `unresolved`（F11 验收 6 / MI-6）
- [ ] `timeout_ms` 可选正整数、缺省**不设上限**；非法（0 / 负数 / 非整数）⇒ 400 `INVALID_PARAM`
- [ ] 超时不产生结论、不改变调用状态：等待到超时后该调用的 `calls get` 仍非终态、`error` 为空、`exit_code` 未变（F12 验收 2）
- [ ] 三条等待路径口径一致：订阅式（F09/F10）与一次调用式（F11）的退出时刻都不由超时值决定（对照：调大/调小超时，退出时刻不变）（F12 验收 3）
- [ ] 等待句柄由**既有唯一终态发布点**释放；本进程无登记的 id 走既有对账兜底（`scheduleReconcile`）复查覆盖，退出判据恒为终态（A-09）

**F13 取消**

- [ ] `POST /api/calls/<id>/cancel`（无请求体）⇒ 200 `{call_id, cancelled, state, error}`；本次生效 ⇒ `cancelled:true`、`state:'failed'`、`error:'cancelled'`；随后 `calls get` **当刻**即为终态（F13 验收 1/3）
- [ ] 重复取消 / 对已终态调用取消 ⇒ 200 `cancelled:false` + 原 `state` / `error` **原样**（不改已定终态，无第二个终态）（F13 验收 4/5）
- [ ] 不存在的 id ⇒ 404 `NOT_FOUND`（不静默成功）（F13 验收 6）
- [ ] 与关流协同：被取消调用的 `call:<id>` 订阅在取消生效当刻结束（与 F09 同一时点语义）；等待句柄同刻释放（F13 验收 7）
- [ ] 不新增终态取值；既有信封 / roster / 转录的读法零漂移（取消不产生 web 侧状态覆盖，终态真源仍是 Router 任务表）（F13 验收 2 / Z-3）
- [ ] 取消生效后：该对话落**恰一条** `out`（`error='cancelled'`，与既有"派发失败"分支同款）+ `chat_state` 推送（对话不停在 `working`）；被取消调用的后续 `task.update` / `task.result` 在状态面被忽略（不出现"取消后又 completed"）（F13 边界 / MI-7）

**F15 恢复判据**

- [ ] `GET /api/health` 一次调用返回 `{router:{ok,detail,generation}, web:{ok,detail}, agents:{online,reconnecting,offline,total}, callable, epoch}`；`callable = router.ok && web.ok && agents.online >= 1`
- [ ] `agents` 三项**分别可读**（`online` / `reconnecting` / `offline`），不是一个合成数（F15 验收 2）
- [ ] `router` 不可达 ⇒ `router.ok:false` + `detail` 含原始原因（含 socket 路径），**响应仍 200**（唯一特例）；`web` 项含"监听 + 持久层一次轻查询可读"两个判据；任一项失败都不出现"调用成功但事实没做"的静默结论（F15 验收 3）
- [ ] 判据零副作用：不发起真实调用、不写任何状态、不改调用 / 实例状态（A-12）
- [ ] hub 重启后三问转绿，且调用方不改身份即可继续派发与查询（F15 验收 4）

**既有面零影响（G01）**

- [ ] 一次典型会话（订阅 → 派发 → 增量 → 终态）在既有 4 条推送面上的事件类集合与语义与迭代前逐字一致（迭代前后各跑一次同形态会话比对）（G01 验收 1）
- [ ] 既有端点的既有参数语义与校验顺序未变（含 `?state=online`、`?archived`、`limit/offset`、调用面全部枚举）：以迭代前后同入参的响应体逐字比对取证（G01 验收 3）
- [ ] `STATIC_FILES` 白名单零新增键；`/llms.txt` 仍是包根快照字节（Z-6）
- [ ] 零新增第三方依赖 / 零新 env / 零新配置键；DB 三表结构与既有读写下语义不变；名册提示的宽限值复用既有 `heartbeatTimeoutMs`（G01 验收 6 / Z-15）
- [ ] 既有 `POST /api/calls` 的 `mode:block`、对账补拉、`entry.landed` 幂等闸门语义不变（Z-11）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F01`、`F02`、`F03`、`F05`、`F06`、`F07`、`F08`、`F09`、`F10`、`F11`、`F13`、`F14`、`F15`、`F16`、`F17`、`G01`（`prd/` 下同名卡）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §0（方案总表）、§3.1~§3.10（十条数据流）、§4 A-01~A-14 逐项契约、§5.1（8 条新路由表 + 位置纪律）、§5.2（追加字段表）、§5.5（既有文件改动面）、§6.1 Z-1~Z-15、§7 L1-01/L1-02/L2-01~L2-13、§9.1（明文局限）、§10 R-2/R-5/R-7
- 代码锚点：`oamp/src/web.js:475`（`createApiRoutes` 路由表 = 唯一登记面）、`oamp/src/web.js:114-128`（`ERR_CODE` / `sendError`）、`oamp/src/web.js:216-262`（`createTopologyWatch` = 投影 tick 的复用点）、`oamp/src/web.js:1507-1520`（`publishCallResult` = 唯一终态发布点）、`oamp/src/web.js:1597-1604`（`scheduleReconcile` = 等待兜底路径）、`oamp/src/web.js:1655-1670`（`handleDeliver` 的调用面分支）、`oamp/src/web.js:1727`（`createApiRoutes` 接线点）、`oamp/src/registry.js:153`、`oamp/src/router.js:379`

## depends_on

- pr-001-router-status-primitives.md（理由：本 PR 的路由 handler 消费 pr-001 新增的四项 Router 侧产出 —— 证据：`queryOnce(config.socketPath,'router.task_cancel',…)` 依赖 `oamp/src/router.js:104` 的 `dispatch` 新增分支；`epoch` 取 `router.status` 的 `generation`；`/api/agents` 行的 `connected` 与 `since` 分别取节点快照的 `connected` 与任务条目的 `started_at`（`oamp/src/registry.js:153` 的 `snapshot()` 投影））
- pr-002-session-registries.md（理由：本 PR 直接 import 并接线两个新模块 —— 证据：`oamp/src/web.js:41` 既有的同名体例 `import * as inbox from './inbox.js'`，本 PR 追加 `import * as principals from './principals.js'` / `import * as pickup from './pickup.js'`，并调用其 `upsert/get/touch/requesterOf` 与 `add/listByRequester/ack`；身份面与取件面的幂等语义由该模块提供）
- pr-003-sse-transport-additions.md（理由：`GET /api/subscribe` 的订阅建立与过滤投递、`publishCallResult` 的终态关流都调用 pr-003 在 `oamp/src/transport.js` 新增的能力 —— 证据：`closeCallSubscriptions(callId)` 由 A-08 指定落在 `transport.js`，本 PR 是它的**唯一调用点**（`oamp/src/web.js:1507` 的发布点内）；过滤订阅注册表同理由本 PR 的三个既有发布点（`publishMessage` / `publishState` / `publishCall`）投喂）

## batch

2

## 验收证据

（本 PR 执行时填写：逐条验收的原始命令与输出（`hub api …` / `curl` / `node -e` 一次性脚本 / `git stash` 前后的响应体比对）+ 8 条新路由的可达性与 404 兜底对照 + 四推送面迭代前后事件类集合比对 + `/api/docs` 投影摘录。真集群 smoke 的起停记录按本迭代 `status.md` 体例留存；证据载体见 `architecture.md` §10 R-5。）

## 建议的内部拆分点（实现阶段用 · 非 PR 边界）

本 PR 体量最大（`oamp/src/web.js` 100 KB / 1779 行，改动含 8 条路由 + 6 处既有函数的追加 + 2 个新助手）。文件范围不可再分（`createApiRoutes` 是唯一登记面），故**不拆 PR**；若单次实现超出时长上限，按下述顺序分两段产出增量（每段结束都应能跑通 `api docs` 与既有面回归）：

1. **段一 · 会话面**：`ERR_CODE` +`STALE_EPOCH` → `epoch` 观测助手 + 名册提示读写 → 身份两条路由（F01）→ `POST /api/calls` 的 `requester`/`warnings`（F02/F14）→ 订阅路由 + 投递钩子（F03）。
2. **段二 · 调用面**：`publishCallResult` 补"指针 + 关流 + 解等待"→ 取件两条路由（F07）→ 流补发（F10）→ `calls/wait`（F11，注意登记位置）→ `calls/<id>/cancel`（F13）→ `health`（F15）→ 投影轮询扩展与 `agent_state`（F05/F06/F16）。
