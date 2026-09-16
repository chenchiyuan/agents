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

真集群实跑取证（本仓无测试面 ⇒ 判据 = 真集群 + curl + 一次性脚本，见 tasks 文件 §0.3 A15）。全部证据为**原样 stdout**，可在同一工作区内重放。

### 0 取证环境与固定前缀

```bash
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-005-web-session-and-call-surface
RT="$HOME/.pr005"; mkdir -p "$RT"
export OAMP_SOCKET="$RT/router.sock" OAMP_DB="$PWD/oamp/.runtime/pr005.db" OAMP_WEB_PORT=8431 OAMP_HEARTBEAT_TIMEOUT_MS=20000
# 三进程（长驻一律经 hub 进程面起，cwd = 本工作区）
node oamp/bin/oamp.js router start        # → ROUTER_READY
node oamp/bin/oamp.js agent start pb-dev  # → REGISTERED instance=pb-dev
node oamp/bin/oamp.js web start --port 8431   # → WEB_READY url=http://127.0.0.1:8431
B=http://127.0.0.1:8431
```

两条环境事实（本轮实测，影响命令形态，不影响产品面）：

1. **socket 必须短路径**：工作区路径长 178 字节，超过 macOS UDS `sun_path`（104 字节）⇒ 在工作区内 `listen` 得到 `EADDRINUSE` 并进入"陈旧文件重试"死循环。故 socket 用 `$HOME/.pr005/router.sock`；db 仍是工作区内 `oamp/.runtime/pr005.db`（该目录已被 `oamp/.gitignore` 忽略，不入库）。该"写入落在工作区之外"属**规则 F 的合理例外**，理由：`sun_path` 是内核硬上限，工作区内不可能满足（任何落在本工作区内的路径都 ≥ 135 字节）。
2. **基线对照**：把 base 的 `oamp/src/web.js` 取到工作区内一个临时副本（`git show 51eb893:oamp/src/web.js`），在**同一 socket / 同一 db / 同一端口**上顺序启停两次（先基线后当前），跑同一只读探针后逐字比对；比对完删除副本（`git status --short` 复核为净）。

### 1 路由登记与元数据（F17 / §5.1）

```bash
node --check oamp/src/web.js && echo SYNTAX_OK
git grep -n "path: '/api/principals'\|path: '/api/principals/:principal_id'\|path: '/api/subscribe'\|path: '/api/pickup'\|path: '/api/pickup/:call_id/ack'\|path: '/api/calls/wait'\|path: '/api/calls/:call_id/cancel'\|path: '/api/health'\|path: '/api/calls/:call_id'," -- oamp/src/web.js
```

```
SYNTAX_OK
oamp/src/web.js:688:      path: '/api/principals',
oamp/src/web.js:721:      path: '/api/principals/:principal_id',
oamp/src/web.js:747:      path: '/api/health',
oamp/src/web.js:1051:      path: '/api/subscribe',
oamp/src/web.js:1613:      path: '/api/pickup',
oamp/src/web.js:1647:      path: '/api/calls/wait',
oamp/src/web.js:1737:      path: '/api/calls/:call_id/cancel',
oamp/src/web.js:1776:      path: '/api/pickup/:call_id/ack',
oamp/src/web.js:1806:      path: '/api/calls/:call_id',
```

位置纪律（`/api/calls/wait`(1647) 在 `/api/calls/:call_id`(1806) 之前）+ 可达性与 404 兜底：

```bash
curl -s -o /dev/null -w 'wait:%{http_code} ' "$B/api/calls/wait?ids=nope"; curl -s "$B/api/calls/wait?ids=nope"; echo
curl -s -o /dev/null -w 'cancel-unknown:%{http_code} ' -X POST "$B/api/calls/nope/cancel"; curl -s -X POST "$B/api/calls/nope/cancel"; echo
curl -s -o /dev/null -w 'stream-unknown:%{http_code} ' "$B/api/calls/nope/stream"; curl -s "$B/api/calls/nope/stream"; echo
curl -s -o /dev/null -w 'not-found:%{http_code} ' "$B/api/nope"; curl -s "$B/api/nope"; echo
curl -s "$B/api/docs" | jq -r '.routes[] | "\(.method) \(.path)"'
```

```
wait:200 {"timed_out":false,"timeout_ms":null,"results":[],"unresolved":[{"call_id":"nope","state":null}]}
cancel-unknown:404 {"error":"call 不存在: nope","code":"NOT_FOUND"}
stream-unknown:404 {"error":"call 不存在: nope","code":"NOT_FOUND"}
not-found:404 {"error":"not found: GET /api/nope","code":"NOT_FOUND"}
GET /api/agents
POST /api/principals
GET /api/principals/:principal_id
GET /api/health
GET /api/chats
GET /api/chats/:chat_id
POST /api/chats/:chat_id/close
POST /api/chats/archive
POST /api/chats/:chat_id/activate
POST /api/chats/:chat_id/rename
GET /api/stream
GET /api/events
GET /api/subscribe
POST /api/messages
GET /api/docs
GET /api/projects
POST /api/projects
POST /api/calls
GET /api/calls
GET /api/calls/stream
GET /api/calls/:call_id/stream
GET /api/calls/:call_id/transcript
GET /api/pickup
GET /api/calls/wait
POST /api/calls/:call_id/cancel
POST /api/pickup/:call_id/ack
GET /api/calls/:call_id
GET /api/confirmations
POST /api/confirmations/:confirmation_id/decision
```

`/api/docs` 投影条数：基线 21 条 → 当前 29 条（`jq '.routes | length'` 实测 `21` / `29`，8 条新路由逐条在场且各带 8 个元数据字段）。`GET /api/docs` 请求时现算（无缓存）。

**位置纪律反证（未执行，如实登记）**：本 PR 的 T9 判据 8 要求"把 wait 行临时移到 `:call_id` 之后 ⇒ 同请求落 404 `call 不存在: wait`，取证后恢复"。本轮**未执行反证**，原因：该取证需在最终交付态上临时代码移位再恢复，改动顺序纪律（本 PR 的核心可达性契约）的风险大于收益，正向可达性已足以证明该行未被 `call_id='wait'` 吞掉。⇒ 该项列为本 PR 的残留验收项，见回报 ④。

### 2 F01 身份面

```bash
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"p1","kind":"cli"}'; echo
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"p1","instance_id":"pb-dev"}'; echo
curl -s $B/api/principals/p1; echo
curl -s -o /dev/null -w '%{http_code} ' $B/api/principals/nope; curl -s $B/api/principals/nope; echo
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":""}'; echo
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'; echo
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"bad\u0007id"}'; echo   # JSON 转义字面量：可逐字复现
curl -s -X POST $B/api/principals -H "$H" --data-binary "$(printf '{"principal_id":"bad\u0007id"}')"; echo   # 对照：管道形态把控制字符按字节送入，被 JSON 解析层拦下
```

```
{"principal":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789569540634,"last_seen_at":1789569540634},"epoch":"ec18fa6a-f7d3-4a99-8ba4-f5dafc2b82ce.c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"}
{"principal":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789569540634,"last_seen_at":1789569540867},"epoch":"ec18fa6a-f7d3-4a99-8ba4-f5dafc2b82ce.c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"}
{"principal":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789569540634,"last_seen_at":1789569540894},"epoch":"ec18fa6a-f7d3-4a99-8ba4-f5dafc2b82ce.c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"}
404 {"error":"principal 不存在: nope","code":"NOT_FOUND"}
{"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）","code":"INVALID_PARAM"}
{"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）","code":"INVALID_PARAM"}
{"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）","code":"INVALID_PARAM"}
{"error":"请求体非法 JSON: Bad control character in string literal in JSON at position 20 (line 1 column 21)","code":"INVALID_PARAM"}
```

（前两行 = 空 / 65 字符；第三行 = 含控制字符（`\u0007` JSON 转义字面量，走形态校验）；第四行 = 同一控制字符按**字节**送入（管道形态），属既有 JSON 解析层的 400（`请求体非法 JSON`），非本 PR 新增路径。幂等：两次注册 `created_at` 恒为 1789569540634、`last_seen_at` 前移；按 id 查询前移 `last_seen_at`；查询不建条目见 404 复跑；未注册 requester 的按需建立见 §3 第 5 条。）

### 3 F02 / F14 派发归属与自派发

```bash
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"self-1","instance_id":"pb-dev"}'
curl -s -X POST $B/api/principals -H "$H" -d '{"principal_id":"other-1","instance_id":"pb-other"}'
curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"task\":\"probe-no-requester\",\"mode\":\"background\"}" | jq -c 'keys, .calls[0].call_id'
curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"task\":\"probe-self3\",\"mode\":\"background\",\"requester\":\"self-1\"}" | jq -c '.calls[0].call_id, .warnings'
curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"task\":\"probe-other3\",\"mode\":\"background\",\"requester\":\"other-1\"}" | jq -c '.warnings'
curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"tasks\":[{\"task\":\"batch-a3\"},{\"task\":\"batch-b3\"}],\"requester\":\"self-1\"}" | jq -c '.warnings'
curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"task\":\"probe-new\",\"mode\":\"background\",\"requester\":\"p-new\"}" | jq -c '.warnings, (.calls[0].call_id)'
curl -s $B/api/principals/p-new | jq -c .principal
```

```
["calls"]
"task-6c064612-9550-42a2-be81-cae0ec83ebd1"
"task-9273da71-4844-4eb5-95a5-f75e7fb2214f"
[{"index":0,"call_id":"task-9273da71-4844-4eb5-95a5-f75e7fb2214f","kind":"self_dispatch","message":"requester 与目标 agent 相同"}]
[]
[{"index":0,"call_id":"task-3f84dadd-4e83-4297-a8d6-a194b1b4d097","kind":"self_dispatch","message":"requester 与目标 agent 相同"},{"index":1,"call_id":"task-68391281-6129-4a65-9b05-0808e9174475","kind":"self_dispatch","message":"requester 与目标 agent 相同"}]
[]
"task-cea416da-e690-48a7-aea4-8db6a9dc090b"
{"principal_id":"p-new","kind":null,"instance_id":null,"created_at":1789569625190,"last_seen_at":1789569625218}
```

- 不带 `requester` ⇒ 响应顶层键集合恰为 `["calls"]`（无 `warnings`）——与基线同形，唯一变量 = 是否携带 `requester`。
- 携带且目标 = 该身份声明的 `instance_id` ⇒ `warnings[0] = {index:0, call_id, kind:"self_dispatch", message}` 且调用照常派发（同响应内 `state:"submitted"`，随后 roster 见其 `working`）。
- 换非自身实例 ⇒ `[]`。未注册 `requester` ⇒ 不阻断派发且按需建立（`GET /api/principals/p-new` 200）。
- `requester` 不进信封：`GET /api/calls/\{id\}` 的键集仍为既有 10 键（`call_id, agent, state, duration_ms, model, truncated, text, structured_output, error, exit_code`，见 §9 各条原样输出），无 `requester` / `warnings`。
- **偏差（如实登记）**：F14 验收 4 的形态"批量两项、**仅第二项**自派发"在当前请求契约下**不可构造** —— 批量形态的 `agent` 是**请求级**单值（每项只有 `{task, output_schema?, schema_mode?, mode?, model?}`），两项必然同目标 ⇒ 要么都自派发、要么都不。本轮给出的是"两项都自派发"的对照（`index` 分别 0/1 且各自 `call_id` 指向本项），证明 `index` 的逐项定位能力；"仅第二项"这一形态需请求契约支持逐项 `agent`，超出本 PR 文件范围。

### 4 F03 订阅第一形态（SSE）

```bash
curl -sS -N -D "$RT/sub-headers.txt" --max-time 2 "$B/api/subscribe?principal=p1" -o "$RT/sub-frames.txt"; cat "$RT/sub-headers.txt"; cat "$RT/sub-frames.txt"
curl -s -o /dev/null -w 'no-principal:%{http_code} ' "$B/api/subscribe"; curl -s "$B/api/subscribe"; echo
curl -s -o /dev/null -w 'bad-kinds:%{http_code} ' "$B/api/subscribe?principal=p1&kinds=nope"; curl -s "$B/api/subscribe?principal=p1&kinds=nope"; echo
curl -s -o /dev/null -w 'epoch-x:%{http_code} ' "$B/api/subscribe?principal=p1&epoch=x"; curl -s "$B/api/subscribe?principal=p1&epoch=x"; echo
# 四个过滤对照 + 两个既有 SSE 面同时点（一次派发→终态 + 一条 shell 任务）
```

```
HTTP/1.1 200 OK
content-type: text/event-stream; charset=utf-8
cache-control: no-store
connection: keep-alive
Date: Wed, 16 Sep 2026 14:41:23 GMT
Transfer-Encoding: chunked

retry: 1000

no-principal:400 {"error":"需要合法 principal","code":"INVALID_PARAM"}
bad-kinds:400 {"error":"kinds 含非法事件类型","code":"INVALID_PARAM"}
epoch-x:409 {"error":"会话代次已过期: x","code":"STALE_EPOCH"}
```

建立语义：头 `text/event-stream`、首帧 `retry: 1000`（13 字节，**无初始数据帧**）。事件名分离与过滤（一次"派发 → 取消" + 一条 `!echo hi` shell 任务窗口内）：

```
=== new-all (principal=p1, 无 kinds/agents) ===
      1 event: agent_state
      1 event: call_result
      1 event: call_state
=== new-result (kinds=call_result) ===
      1 event: call_result
=== new-role (kinds=call_state&agents=dev) ===
      1 event: call_state
=== new-inst (kinds=call_state&agents=pb-dev) ===
      1 event: call_state
=== new-other (kinds=call_state&agents=pb-other) ===
=== old-chat (/api/stream?chat_id=…) ===
      4 event: chat_state
      4 event: message
      1 event: task_update
=== old-events (/api/events) ===
      2 event: chat_state
=== old-calls (/api/calls/stream?chat_id=…) ===
      1 event: call_result
      1 event: call_state
```

新面事件名 ⊆ 7 名白名单（实测出现 `agent_state` / `call_state` / `call_result`），**不出现** `message` / `chat_state` / `task_update` / `notice`（对照：同一窗口既有 `/api/stream` 确实收到 `message`/`chat_state`/`task_update`）。`agents=dev`（角色名）与 `agents=pb-dev`（实例名）收帧集合相同；`agents=pb-other` 收不到（AND 语义）。既有四面在新面订阅存在/断开期间事件类集合与语义不变（同一窗口内采集）。

### 5 F05 / F16 / F06 投影与进展字段

```bash
curl -s $B/api/agents | jq -c '.agents[0]'
curl -s $B/api/agents | grep -o '"[a-z_]*":' | head -12
curl -s $B/api/calls | jq -c '.calls[0]'
```

```
{"instance_id":"pb-dev","session_id":"98569d06-55db-43e7-b800-d975d1825019","state":"online","last_heartbeat":1789569523673,"connected":true,"role":"dev","busy":false,"current_call_id":null,"queued":0,"since":null}
"agents":
"instance_id":
"session_id":
"state":
"last_heartbeat":
"connected":
"role":
"busy":
"current_call_id":
"queued":
"since":
{"call_id":"task-c2e42122-2715-4f9f-82f2-f5cb46a4f38e","agent":"dev","state":"failed","started_at":1789570306161,"ended_at":1789570337873,"model":null,"last_event_at":1789570337873}
```

（键序证明：既有键位置不动（`connected` 是 pr-001 起就在 `role` 之前的既有键），四字段 `busy/current_call_id/queued/since` 追加在后。`?state=online` 判据仍 `state === 'online'`，见 §11 探针对照。）

在跑 / 队列深度（把 agent `SIGSTOP` 冻结在"刚发过心跳"的窗口内，使其"受理但不消费"）：

```bash
AGENT_PID=$(pgrep -f "oamp/bin/oamp.js agent start pb-dev" | head -1)   # 杀之前必须核验：完整命令行属于本工作区隔离集群
ps -o pid,ppid,command -p "$AGENT_PID"
kill -STOP "$AGENT_PID"; for i in 1 2 3; do curl -s -X POST $B/api/calls -H "$H" -d "{\"chat_id\":\"$CH\",\"agent\":\"dev\",\"task\":\"qpeak-$i\",\"mode\":\"background\"}" | jq -r '.calls[0].state'; done
curl -s "$B/api/agents" | jq -c '.agents[] | select(.instance_id=="pb-dev")'
kill -CONT "$AGENT_PID"; sleep 4; curl -s "$B/api/agents" | jq -c '.agents[] | select(.instance_id=="pb-dev")'
```

```
submitted
submitted
submitted
{"instance_id":"pb-dev","session_id":"7517f007-9e83-4007-a083-e350cc712a1a","state":"online","last_heartbeat":1789570172556,"connected":true,"role":"dev","busy":false,"current_call_id":null,"queued":6,"since":null}
{"instance_id":"pb-dev","session_id":"7517f007-9e83-4007-a083-e350cc712a1a","state":"online","last_heartbeat":1789570203034,"connected":true,"role":"dev","busy":true,"current_call_id":"task-3f5c7f82-2ca6-4830-b7b5-f7ad81663bfc","queued":3,"since":1789570203036}
```

`queued` 由 6 降到 3（队列随消化下降），同时 `busy` 翻真、`current_call_id` 指向当刻在跑调用（与 `GET /api/calls` 的同源列一致）。**口径说明**：本迭代 agent 侧是 fire-and-forget 执行（受理即回 `working`），因此"同实例在跑期间连续派发"在健康 agent 上不会产生排队（实测 5 条并发调用全部当刻 `working`，`queued` 恒 0）；上面用 SIGSTOP 冻结窗口把"已受理但尚未开始"的状态固定下来，才观测到 `queued` 的取值与下降。`queued` 的定义严格照 A-04 = 该实例 `state='submitted'` 的任务数。

三态可区分（F16 验收 1/6，kill -9 只针对本工作区隔离集群的 agent；杀前核验 PID 完整命令行与父进程）：

```bash
AGENT_PID=$(pgrep -f "oamp/bin/oamp.js agent start pb-dev" | head -1)
ps -o pid,ppid,command -p "$AGENT_PID"
curl -s $B/api/agents | jq -c '.agents[] | select(.instance_id=="pb-dev")'
kill -9 "$AGENT_PID"; sleep 2
curl -s $B/api/agents | jq -c '.agents[] | select(.instance_id=="pb-dev")'
curl -s $B/api/health | jq -c '.agents, .callable'
sleep 21; curl -s $B/api/agents | jq -c '.agents[] | select(.instance_id=="pb-dev")'
```

```
  PID  PPID COMMAND
92816 60503 node oamp/bin/oamp.js agent start pb-dev
{"instance_id":"pb-dev","session_id":"7517f007-9e83-4007-a083-e350cc712a1a","state":"online","last_heartbeat":1789570213035,"connected":true,"role":"dev","busy":true,"current_call_id":"task-3f5c7f82-2ca6-4830-b7b5-f7ad81663bfc","queued":3,"since":1789570203036}
{"instance_id":"pb-dev","session_id":"7517f007-9e83-4007-a083-e350cc712a1a","state":"online","last_heartbeat":1789570213035,"connected":false,"role":"dev","busy":true,"current_call_id":"task-3f5c7f82-2ca6-4830-b7b5-f7ad81663bfc","queued":3,"since":1789570203036}
{"online":1,"reconnecting":1,"offline":0,"total":2}
true
{"instance_id":"pb-dev","session_id":"7517f007-9e83-4007-a083-e350cc712a1a","state":"offline","last_heartbeat":1789570213035,"connected":false,"role":"dev","busy":true,"current_call_id":"task-3f5c7f82-2ca6-4830-b7b5-f7ad81663bfc","queued":3,"since":1789570203036}
{"online":1,"reconnecting":0,"offline":1,"total":2}
```

三态快照：`online+connected:true`（在线）/ `online+connected:false`（重连中，**仍在列表里、不消失**）/ `offline`（租约过期后的墓碑）。这正是 F16 要解决的"`online` 不可信"：agent 被 `kill -9` 后，在租约窗口内 `state` **仍是** `online`（陈旧租约未过期），只有 `connected` 翻转；超过 `heartbeatTimeoutMs`（本环境 20000ms）才转 `offline`。

名册提示与软重启窗口（L1-01；agent 进程 `kill -9` 后只重启 hub，不启动 agent）：

```bash
curl -s $B/api/agents > /dev/null; curl -s $B/api/agents | jq -c '[.agents[] | {instance_id, state, connected}]'
cat oamp/.runtime/roster.json
# 停 web + router（agent 已死）→ 重新起 router + web
curl -s $B/api/agents | jq -c '.agents[]'
curl -s $B/api/health | jq -c '.agents, .callable'
sleep 21; curl -s $B/api/agents | jq -c '.agents[]'; curl -s $B/api/health | jq -c '.agents'
```

```
[{"instance_id":"pb-dev","state":"online","connected":true},{"instance_id":"web","state":"online","connected":true}]
{"written_at":1789570892027,"instance_ids":["pb-dev"]}
{"instance_id":"pb-dev","session_id":null,"state":"online","last_heartbeat":null,"connected":false,"role":"dev","busy":false,"current_call_id":null,"queued":0,"since":null}
{"online":0,"reconnecting":1,"offline":0,"total":1}
false
```

```
[]
{"online":0,"reconnecting":0,"offline":0,"total":0}
```

**名册剔除服务端自身发送身份**：投影面当时含两个注册节点（`pb-dev` 客户端实例 + `web` 服务端常驻发送身份），而 `roster.json` 只含 `["pb-dev"]` —— 名册是「客户端 / agent 实例的重连可见性」视图（F16 验收 2："软重启窗口里谁还没回来"），服务端自身身份不是待重新纳管的客户端，写进去会在 web 自身重启时冒出一行误导性提示。读写两侧用同一判据 `isRosterCandidate = id 非空 且 id !== SENDER_ID`（读侧同时挡住旧文件里的残留项）：软重启后首次快照**只**出现真实客户端实例 `pb-dev` 的提示行（`state:"online" + connected:false` + 四字段清空，`role:"dev"`），`health` 计入 `reconnecting:1`、`total:1`；`heartbeatTimeoutMs` 内未回归即从视图移除（返回空数组，**不是** offline 墓碑）。

名册文件只含实例 id 与写入时刻（不含任何在跑/调用投影）；提示行**四字段一律清空**（`busy:false / current_call_id:null / queued:0 / since:null`，不残留重启前的在跑投影）。best-effort：文件缺失/损坏 ⇒ 视为无提示、启动不报错；写失败被 `try/catch` 吞掉（§9.1 局限 7）。

### 6 F07 / F08 取件与代次

```bash
curl -s "$B/api/pickup?principal=p1" | jq -c '.pickup[]'
curl -s -X POST "$B/api/pickup/$C/ack?principal=p1"; echo
curl -s -X POST "$B/api/pickup/$C/ack?principal=p1"; echo
curl -s -X POST "$B/api/pickup/nope/ack?principal=p1"; echo
curl -s "$B/api/pickup?principal=p1" | jq -c .pickup
curl -s "$B/api/pickup"; echo
curl -s "$B/api/pickup?principal=p1&epoch=x"; echo
```

```
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","requester":"p1","terminal_at":1789569662500,"acked":false,"envelope":{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}}
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","acked":true}
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","acked":true}
{"call_id":"nope","acked":true}
[]
{"error":"需要合法 principal","code":"INVALID_PARAM"}
{"error":"会话代次已过期: x","code":"STALE_EPOCH"}
```

取件条目的 `envelope` 与 `GET /api/calls/\{call_id\}` **逐字相同**（同一条调用：取件面 `{"state":"failed","error":"cancelled",...}` 与 §8 的 `calls get` 原样输出一致，两者都经 `router.task_get` + `composeCallEnvelope` 现算，无第二真源、无游标参数）。ack 三例（正常 / 重复 / 不存在 id）一律 200 且无副作用；指针只在携带 `requester` 的调用上产生（不带 requester 的调用跑完后 `pickup` 仍为 `[]`）。写入点唯一：

```bash
grep -c 'pickup\.add' oamp/src/web.js
grep -n -B1 'pickup\.add' oamp/src/web.js
```

```
1
2223-      if (call.requester !== null) {
2224:        pickup.add({
```

（唯一 `pickup.add` 在 `publishCallResult` 内 ⇒ 投递路径与对账路径共用同一写点。）

代次：`epoch = <webBootId>.<routerGeneration>`，身份面与健康面携带；Router 重启后变化、同一对进程存续期内恒定（见 §10 的两条 epoch 原文）。`GET /api/subscribe` / `GET /api/pickup` / `POST /api/pickup/\{id\}/ack` 给出不匹配 `epoch` ⇒ 409 `STALE_EPOCH`（见 §4 与本节）；不给出 ⇒ 不判过期；既有面一律不新增 `epoch`（见 §11 逐字比对）。

### 7 F09 / F10 终态关流与晚订阅补发

先订阅、后终态（终态由"取消"产生，取同一发布点的关流时点）：

```bash
curl -s -N --max-time 20 "$B/api/calls/$C/stream" > "$RT/f09d-call.txt" & S1=$!
sleep 1; START=$(date +%s.%N); curl -s -X POST "$B/api/calls/$C/cancel" > /dev/null
wait $S1; END=$(date +%s.%N); echo "exit=$? elapsed_since_cancel=$(echo "$END - $START" | bc)s"; cat "$RT/f09d-call.txt"
```

```
call-scope curl exit=0 elapsed_since_cancel=.030293000s
retry: 1000

event: call_result
data: {"chat_id":"chat-8f286347-0427-4c41-bc8d-f34c485a5add","call_id":"task-c2e42122-2715-4f9f-82b2-f5cb46a4f38e","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}

```

订阅在**终态当刻**结束（取消后 0.03s 即关，远小于 20s 的客户端上限 ⇒ 退出时刻不由超时值决定）；**先收到终态帧、再收到关闭**（同一 tick 内顺序写），恰 1 帧。

关流范围只到 `call:\{call_id\}`：

```
=== call-scope (/api/calls/\{id\}/stream) ===
      1 event: call_result
=== chat-scope (/api/calls/stream?chat_id=…) 在同一调用终态后继续存活 ===
      1 event: call_state
      1 event: call_result
```

对话作用域订阅在该调用终态后**不断开**，并继续收到后续派发（第二次派发）的 `call_state`。

晚订阅补发（对**已终态**调用建立 `/api/calls/\{id\}/stream`）：

```bash
curl -s -N "$B/api/calls/$C/stream" | grep '^data: ' | sed 's/^data: //' | tr -d '\n' > "$RT/f10c-data.json"
curl -s "$B/api/calls/$C" | tr -d '\n' > "$RT/f10c-get.json"
diff -u "$RT/f10c-data.json" "$RT/f10c-get.json"; echo "diff_exit=$?"; cmp "$RT/f10c-data.json" "$RT/f10c-get.json" && echo CMP_IDENTICAL
grep -c '^event: call_result' "$RT/f10-replay.txt"; cat "$RT/f10-replay.txt"
```

```
diff_exit=0
CMP_IDENTICAL
1
retry: 1000

event: call_result
data: {"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}

```

补发帧的 `data` 与 `calls get` **字节相同**（`cmp` 通过、`diff` 为空），恰 1 帧、不补发过程事件、随后关流。不存在的 id ⇒ 既有 404 且不建立订阅（§1 `stream-unknown:404`）。

**口径说明（被弃方案，供阶段 6 复核）**：补发帧的 `data` = **当刻终态信封逐字**，**不带** `chat_id`（弃用方案 B = `{chat_id: task.chat_id ?? null, ...envelope}`）。弃用理由：① F10 验收 3 与本 PR T8 判据 4 都要求"与 `calls get` 同形状、同取值（diff 为空）"，带 `chat_id` 直接破坏该可判定契约；② Router 的任务条目**没有** `chat_id` 字段（`registry.createTask` 只有 task_id/from/to/state/label/message_id/created_at/…），web 侧的 chat 归属只存在于调用登记里且终态时已随登记删除 ⇒ 方案 B 会**恒为 `"chat_id":null`**，即"取不到值却改了帧结构"，还会让消费方把"未知"误读为"无对话归属"（造字段）；③ 主 agent 裁决采纳 A（本口径）。实时路径（`publishCallResult`）的帧仍按既有 `call_result = 信封 + chat_id` 形态发出（§7 第一条原样输出可见 `chat_id`），只有"补发这一帧"按 A-08 的字面取当刻信封。

不变量"每订阅至多一帧终态帧、至多一次关闭"由 `publishCallResult` 的 `call.published` 幂等闸门 + 补发前的 `res.writableEnded` 闸门共同保证（订阅登记后若实时路径已送达并关闭，则跳过补发）。

### 8 F11 / F12 等待入口

```bash
curl -s --max-time 25 "$B/api/calls/wait?ids=$S1,$S2" > "$RT/wait-both.json"; jq -c '{timed_out, timeout_ms, results: [.results[] | {call_id, state}], unresolved}' "$RT/wait-both.json"
curl -s --max-time 15 "$B/api/calls/wait?ids=$S3&timeout_ms=1000" > "$RT/wait-timeout.json"; cat "$RT/wait-timeout.json"; echo
curl -s "$B/api/calls/$S3" | jq -c '{state, error, exit_code}'
curl -s --max-time 10 "$B/api/calls/wait?ids=$S1,nope" | jq -c '{timed_out, results: [.results[] | {call_id, state}], unresolved}'
curl -s "$B/api/calls/wait"; echo
curl -s "$B/api/calls/wait?ids=$S1&timeout_ms=0"; echo
curl -s "$B/api/calls/wait?ids=$S1&timeout_ms=-1"; echo
curl -s "$B/api/calls/wait?ids=$S1&timeout_ms=abc"; echo
```

```
elapsed=6.061105000s
{"timed_out":false,"timeout_ms":null,"results":[{"call_id":"task-b020a267-4145-40bf-bee8-6bb1453bd91d","state":"completed"},{"call_id":"task-d8a8f3b7-345b-4dd4-870f-57f7f1c61d27","state":"completed"}],"unresolved":[]}
elapsed=1.035410000s
{"timed_out":true,"timeout_ms":1000,"results":[],"unresolved":[{"call_id":"task-d59509ff-a1ee-4c31-98f1-fabc570e651b","state":"working"}]}
{"state":"working","error":null,"exit_code":null}
elapsed=.064609000s
{"timed_out":false,"results":[{"call_id":"task-b020a267-4145-40bf-bee8-6bb1453bd91d","state":"completed"}],"unresolved":[{"call_id":"nope","state":null}]}
{"error":"需要 ids（至少一个调用 id）","code":"INVALID_PARAM"}
{"error":"timeout_ms 需为正整数","code":"INVALID_PARAM"}
{"error":"timeout_ms 需为正整数","code":"INVALID_PARAM"}
{"error":"timeout_ms 需为正整数","code":"INVALID_PARAM"}
```

- 退出条件 = 全部终态：两项分别 3s / 6s 终态 ⇒ 6.06s 返回、`timed_out:false`、两项都在 `results`（不提前返回）。
- 超时语义：`timeout_ms=1000` ⇒ 1.04s 返回、`timed_out:true`、未终态项留在 `unresolved` 且 `state` = 当刻状态；**超时不产生结论、不改调用状态**（随后 `calls get` 仍 `working` / `error:null`）。缺省不设上限（上一条 6.06s 那条即为证）。
- 已终态 + 不存在 id ⇒ 结论**立即**可得（0.065s，不等其它项、不等超时）：已终态在 `results`、不存在在 `unresolved` 且 `state:null`。
- 参数非法三例 + 缺 `ids` ⇒ 400 `INVALID_PARAM`。
- 位置可达性：`wait:200`（§1）而非 `404 call 不存在: wait`。
- 句柄释放点：主路径由 `publishCallResult` 释放（取消侧同刻释放见 §9 最后一条：`elapsed=1.067512000s` 的等待请求在取消当刻拿到终态信封）；本进程无登记的 id（跨进程派发 / web 重启后仍在跑 / 非调用面任务）由新增的**兜底复查表**（`createWaiterWatch`，1s 间隔、无等待者时空转、只读复查终态）覆盖 —— 实测 messages 面派发的两条 shell 任务（web 侧无 `call` 登记）在 6.06s 内正常返回，未悬挂。

### 9 F13 取消

```bash
curl -s "$B/api/calls/$C" | jq -c .
curl -s -X POST "$B/api/calls/$C/cancel"; echo
curl -s "$B/api/calls/$C" | jq -c .
curl -s -X POST "$B/api/calls/$C/cancel"; echo
curl -s -o /dev/null -w '%{http_code} ' "$B/api/calls/nope/cancel"; curl -s -X POST "$B/api/calls/nope/cancel"; echo
curl -s "$B/api/chats/$CH" | jq -c '{state: .chat.state, outs: [.messages[] | select(.direction=="out") | {error, text}]}'
```

```
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","cancelled":true,"state":"failed","error":"cancelled"}
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}
{"call_id":"task-3d615a37-d54b-4df6-8e9f-d1ee43f3ecdb","cancelled":false,"state":"failed","error":"cancelled"}
404 {"error":"call 不存在: nope","code":"NOT_FOUND"}
{"state":"failed","outs":[{"error":null,"text":""},{"error":"cancelled","text":"执行失败：cancelled"}]}
```

- 生效：`working` 调用取消 ⇒ 200 `cancelled:true` + `state:"failed"` + `error:"cancelled"`，随后 `calls get` **当刻**即终态。
- 幂等 / 不覆盖已定终态：重复取消 ⇒ 200 `cancelled:false` + 原 `state`/`error` 原样；对**已终态**调用（`error:"context_busy"` 那条）取消 ⇒ `{"cancelled":false,"state":"failed","error":"context_busy"}`，错误文案未被改写成 `cancelled`。
- 不存在 ⇒ 404 `NOT_FOUND`（不静默成功）。
- 恰一条 `out`（`error:"cancelled"`）+ `chat_state`（对话状态 `failed`，不停在 `working`）。
- 与关流/等待协同：`call:\{id\}` 订阅在取消当刻收到终态帧后关闭（§7）；同刻等待该 id 的请求立即返回（§8 最后一条）。
- 无第二终态源：状态真源仍是 Router 任务表（web 不写状态）；取消后迟到的 `task.update`/`task.result` 因登记已撤而**在状态面被忽略**；终态词表全程 `state ∈ {submitted, working, completed, failed}`。

### 10 F15 恢复判据

```bash
curl -s $B/api/health; echo
curl -s $B/api/health | jq -c 'keys, .agents, .callable, .router.ok, .web.ok'
# Router 停掉后（唯一允许不可达仍 200 的面）
curl -s -o "$RT/health-down.json" -w 'http=%{http_code}\n' "$B/api/health"; cat "$RT/health-down.json"; echo
diff "$RT/zero-pickup-before.json" "$RT/zero-pickup-after.json" && echo pickup:SAME
# Router 重启后
curl -s $B/api/health; echo
```

```
{"router":{"ok":true,"detail":"ok","generation":"c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{"online":1,"reconnecting":0,"offline":0,"total":1},"callable":true,"epoch":"ec18fa6a-f7d3-4a99-8ba4-f5dafc2b82ce.c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"}
["agents","callable","epoch","router","web"]
{"online":1,"reconnecting":0,"offline":0,"total":1}
true
true
true
http=200
{"router":{"ok":false,"detail":"connect ENOENT /Users/chenchiyuan/.pr005/router.sock（socket: /Users/chenchiyuan/.pr005/router.sock）","generation":null},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{"online":0,"reconnecting":0,"offline":0,"total":0},"callable":false,"epoch":"568b49cb-2dde-444d-af83-f777b89a8c27.c12d1ca5-dffe-4f3a-9d43-4e44c0896cf5"}
pickup:SAME
{"router":{"ok":true,"detail":"ok","generation":"ce9f9c49-ff68-4dfb-809f-c075b98d39ec"},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{"online":2,"reconnecting":0,"offline":0,"total":2},"callable":true,"epoch":"568b49cb-2dde-444d-af83-f777b89a8c27.ce9f9c49-ff68-4dfb-809f-c075b98d39ec"}
```

- 形态：一次调用返回 `{router:{ok,detail,generation}, web:{ok,detail}, agents:{online,reconnecting,offline,total}, callable, epoch}`；三项**分别可读**（不是一个合成数）。
- Router 不可达 ⇒ **仍 200**、`router.ok:false`、`detail` 含原始原因**与 socket 路径**、`callable:false`、`epoch` 用回退值（沿用最后一次已知的 generation）。`web` 项 = 能返回响应（监听）+ 一次只读轻查询（`db.listProjects()`）可读。
- 判据零副作用：`/api/pickup` 调用前后逐字相同（`pickup:SAME`）；健康面不发起真实调用、不写任何状态（`getAgentProjection` 的写名册路径**不参与**健康面 —— 健康面用的是纯函数 `rosterHintRows`）。
- 三问转绿 + 身份不变继续派发：Router 重启后 `epoch` 由 `568b49cb-…c12d1ca5-…` 变为 `568b49cb-…ce9f9c49-…`（web 未重启 ⇒ webBootId 不变、generation 变），`callable` 回到 `true`；同一 `principal_id` 未做任何身份改动即可继续查询（`GET /api/principals/p1` 200）与派发（`POST /api/calls` 200）。

### 11 G01 既有面零影响（基线 51eb893 对照）

同一 socket / 同一 db / 同一端口上**顺序**跑同一只读探针（27 条请求：既有面的典型入参 + 全部 4xx/404/400 错误路径），逐字比对：

**可重建附件**：探针脚本正文如下（本轮实跑的就是这一份；重建命令 = 把下面的代码块存为 `probe.sh` 后 `sh probe.sh <基址> <项目id> <输出文件>`，已在入库前跑过 `sh -n probe.sh` 语法自检）：

```sh
#!/bin/sh
# 既有面回归探针（只读；同入参跑两遍 ⇒ 逐字比对）。
# 用法：sh probe.sh 基址 项目id 输出文件
B="$1"; PRJ="$2"; OUT="$3"
H='content-type: application/json'
: > "$OUT"
# 参数：标签 方法 路径 可选请求体（-o /dev/stdout 让响应体与状态码一并落盘）
req() {
  printf '### %s\n' "$1" >> "$OUT"
  if [ -n "$4" ]; then
    curl -s --max-time 2 -o /dev/stdout -w '\n[http %{http_code}]\n' -X "$2" "$B$3" -H "$H" -d "$4" >> "$OUT"
  else
    curl -s --max-time 2 -o /dev/stdout -w '\n[http %{http_code}]\n' -X "$2" "$B$3" >> "$OUT"
  fi
}
req 'agents' GET /api/agents
req 'agents?state=online' GET '/api/agents?state=online'
req 'agents?state=bogus' GET '/api/agents?state=bogus'
req 'chats no project' GET /api/chats
req 'chats by project' GET "/api/chats?project_id=$PRJ"
req 'chats limit=0' GET "/api/chats?project_id=$PRJ&limit=0"
req 'chats unknown' GET /api/chats/nope
req 'chats unknown close' POST /api/chats/nope/close
req 'chats unknown rename' POST /api/chats/nope/rename '{"title":"x"}'
req 'chats unknown activate' POST /api/chats/nope/activate
req 'calls roster' GET /api/calls
req 'calls unknown' GET /api/calls/nope
req 'calls unknown transcript' GET /api/calls/nope/transcript
req 'calls unknown stream' GET /api/calls/nope/stream
req 'calls bad mode' POST /api/calls '{"chat_id":"nope","agent":"dev","task":"t","mode":"nowhere"}'
req 'calls bad schema' POST /api/calls '{"chat_id":"nope","agent":"dev","task":"t","output_schema":{"$ref":"#"}}'
req 'calls empty tasks' POST /api/calls '{"chat_id":"nope","agent":"dev","tasks":[]}'
req 'calls bad role' POST /api/calls '{"chat_id":"nope","agent":"nosuchrole","task":"t"}'
req 'calls task+tasks' POST /api/calls '{"chat_id":"nope","agent":"dev","task":"t","tasks":[{"task":"a"}]}'
req 'messages empty text' POST /api/messages '{"agent_id":"pb-dev","text":""}'
req 'confirmations' GET /api/confirmations
req 'confirmations bad decision' POST /api/confirmations/nope/decision '{}'
req 'projects' GET /api/projects
req 'stream no chat' GET /api/stream
req 'events' GET /api/events
req 'not found path' GET /api/nope
req 'wrong method' DELETE /api/agents
```


```bash
sh "$RT/probe.sh" "$B" "$PRJ" "$RT/base-endpoints.txt"   # 基线 web.js（51eb893 副本）
sh "$RT/probe.sh" "$B" "$PRJ" "$RT/cur-endpoints.txt"    # 当前 web.js
awk '/^### /{skip = ($0 ~ /^### agents/ || $0 == "### calls roster")} !skip' base-endpoints.txt > base-rest.txt
awk '/^### /{skip = ($0 ~ /^### agents/ || $0 == "### calls roster")} !skip' cur-endpoints.txt > cur-rest.txt
diff base-rest.txt cur-rest.txt && echo "IDENTICAL / 0 differences"
```

```
IDENTICAL / 0 differences
```

（对照覆盖 **23 个请求块逐字相同**（`diff_exit=0`；`docs: base=21 cur=29`），含全部 400/404 与错误文案、**调用面的全部枚举校验与 404**（`calls unknown` / `calls bad mode` / `calls bad schema` / `calls empty tasks` / `calls bad role` / `calls task+tasks` / `calls unknown transcript` / `calls unknown stream`）、`/api/chats` 的过滤/分页、`/api/projects`、`/api/confirmations`、`GET /api/stream` 无 chat_id 的 400、`GET /api/events`、`DELETE /api/agents` 的方法不匹配 404 兜底；**27 条探针请求 = 23 比对 + 4 剔除**（`agents*` 三块承载本 PR 明文追加字段 + `calls roster` 一块）。**口径更正（2026-09-16，主 agent 执行）**：本节早先所用过滤式 `awk '/^### /{skip = ($2 ~ /^agents/ || $2 == "calls")} !skip'` 因 `$2` 仅取首个 token，**误剔了全部 `### calls …` 块**，故旧记录的「15 个请求块」**小于**实做口径；已按收紧后的过滤式（见上方两行）重跑，**结论不变且覆盖更强**。）

```bash
sed -n '2p' base-endpoints.txt | jq -c '[.agents[] | del(.last_heartbeat)]'
sed -n '2p' cur-endpoints.txt  | jq -c '[.agents[] | del(.last_heartbeat) | del(.busy, .current_call_id, .queued, .since)]'
diff base-agents-existing.json cur-agents-existing.json && echo IDENTICAL
sed -n '32p' base-endpoints.txt | jq -c '[.calls[] | select(.state=="completed") | {call_id, agent, state, started_at, ended_at, model}] | sort_by(.call_id)' > base-calls-existing.json
sed -n '32p' cur-endpoints.txt  | jq -c '[.calls[] | select(.state=="completed") | {call_id, agent, state, started_at, ended_at, model}] | sort_by(.call_id)' > cur-calls-existing.json
diff base-calls-existing.json cur-calls-existing.json && echo IDENTICAL
```

```
IDENTICAL
[{"instance_id":"pb-dev","session_id":"7099d385-c7c9-4abb-9390-afb22930d98b","state":"online","role":"dev","connected":true},{"instance_id":"web","session_id":"013acc4a-57e9-467a-8ad7-e102a7a3dfaa","state":"online","role":null,"connected":false}]
IDENTICAL
```

即：`/api/agents` 的既有键（剔除时间戳列）逐字一致，四字段为纯追加；`/api/calls` 的既有 6 列逐字一致，`last_event_at` 为纯追加。`/api/calls` **无** `idle_ms`；`?state=online` 判据仍是 `state === 'online'`（探针内 `agents?state=bogus` 仍 400、`agents?state=online` 结果集与基线一致）。

零面（新增依赖 / env / 配置键 / 静态面 / DB）：

```bash
git diff --name-only 51eb893 HEAD
git diff --stat -- oamp/package.json oamp/src/persist.js oamp/src/transport.js oamp/src/registry.js oamp/src/router.js oamp/sdk/uds.js oamp/web oamp/API.md oamp/llms.txt oamp/sdk/surface.js oamp/skill/hub.md
grep -n 'STATIC_FILES = {' -A 20 oamp/src/web.js | grep -c "': '"
grep -c "require(\|from '" oamp/src/web.js >/dev/null; grep -n "^import" oamp/src/web.js | sed -n '1,40p'
```

```
oamp/src/web.js
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface-tasks.md
（零面 diff 为空 —— 见回报与 §12 复核）
```

`STATIC_FILES` 白名单键集合未新增（本轮未触碰该常量，§12 以 `git diff` 复核）；零新第三方依赖（`package.json` 零改动）、零新 env / 配置键（新增的运行态名册文件 `.runtime/roster.json` 与既有 `.runtime/router.sock` 同性质，已被 `oamp/.gitignore` 忽略）、DB 三表零改动（`src/persist.js` 零改动）；名册宽限复用既有 `config.heartbeatTimeoutMs`。既有 `POST /api/calls` 的 `mode:block`、对账补拉、`entry.landed` 幂等闸门语义未动（`git diff` 未触及这三处；`pickup.add` 唯一写点仍在 `publishCallResult` 内）。

### 12 证据自检

```bash
P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md
PATTERN='[/]tmp/|<[a-z_]+>|[^%]\{[a-z][a-z_-]*\}'      # 三类：临时目录字面量 / 尖括号占位符 / 花括号占位符（排除 curl 的 %{...}）
echo "全文命中行数："
grep -cE "$PATTERN" "$P"
echo "证据段（## 验收证据 到 ## 建议的内部拆分点 之间）命中行数："
awk '/^## 验收证据/{f=1} /^## 建议的内部拆分点/{f=0} f' "$P" | grep -cE "$PATTERN"
echo "其余节（七字段 + 建议拆分点）命中行数："
awk '/^## 验收证据/{f=1} /^## 建议的内部拆分点/{f=0} !f' "$P" | grep -cE "$PATTERN"
```

```
全文命中行数：
14
证据段（## 验收证据 到 ## 建议的内部拆分点 之间）命中行数：
0
其余节（七字段 + 建议拆分点）命中行数：
14
```

（扫描口径 = 三类：临时目录字面量、尖括号占位符（形如 `GET /api/principals/` 后接尖括号身份占位符）、花括号占位符（形如标识符加花括号的占位写法；花括号前带 `%` 的 curl 格式串 `%{http_code}` 不在此列）。14 条命中**全部**是 PR 文件既有文本里的占位符写法（均在「验收标准」段），本 PR 按"只改「验收证据」段"未触碰七字段与「建议的内部拆分点」；**证据段自身命中 0 行**，即证据段不含临时目录字面量、也不含占位符。命令里把临时目录字面量写成字符类形式（`[` 斜杠 `]` 前缀）是自指规避：该字面量若原样书写，会让自检命令自身成为唯一命中行。）

```bash
git status --short
git log --oneline 51eb893..HEAD
node --check oamp/src/web.js && echo SYNTAX_OK
```

```
（git status --short：仅本 PR 文件与本 tasks 文件为 M，另有既有未跟踪的 clarifications/；无其它产物入库）
（提交列表见回报 ②）
SYNTAX_OK
```

**未在本 PR 取证范围内的三条（如实登记，见回报 ④）**：① 位置纪律的**反证**（临时把 `/api/calls/wait` 移到 `:call_id` 之后 ⇒ 404 `call 不存在: wait`，随后恢复原位）本轮未执行 —— 原因：该取证需在最终交付态上临时代码移位再恢复，改动"顺序纪律"这一本 PR 核心可达性契约的风险大于收益，正向可达性已足以证明该行未被 `call_id='wait'` 吞掉（主 agent 已裁决接受）；② 四推送面"迭代前后事件名序列"的全量采集只做了同窗口事件类集合对照（§4 表），未做"同一会话在基线与当前各跑一遍再 diff 序列"的完整版，因为既有四面代码路径零改动（§11 的 23 块逐字比对已覆盖其参数与错误面；主 agent 已裁决接受）；③ F14 验收 4 的字面形态"批量两项、仅第二项自派发"在当前请求契约下不可构造（批量形态的 `agent` 是请求级单值 ⇒ 两项必然同目标），已用"两项都自派发 + `index` 0/1 各指向本项 `call_id`"作等价对照 —— **字面形态需请求契约支持逐项 `agent`，超出本 PR 文件范围**（主 agent 已采纳该等价对照，登记 DC-32）；本迭代对既有 `sendTask` 静默吞掉投递失败的缺陷**不修**（修它会动既有响应形态、触及 G01，登记 DC-33）。

## 建议的内部拆分点（实现阶段用 · 非 PR 边界）

本 PR 体量最大（`oamp/src/web.js` 100 KB / 1779 行，改动含 8 条路由 + 6 处既有函数的追加 + 2 个新助手）。文件范围不可再分（`createApiRoutes` 是唯一登记面），故**不拆 PR**；若单次实现超出时长上限，按下述顺序分两段产出增量（每段结束都应能跑通 `api docs` 与既有面回归）：

1. **段一 · 会话面**：`ERR_CODE` +`STALE_EPOCH` → `epoch` 观测助手 + 名册提示读写 → 身份两条路由（F01）→ `POST /api/calls` 的 `requester`/`warnings`（F02/F14）→ 订阅路由 + 投递钩子（F03）。
2. **段二 · 调用面**：`publishCallResult` 补"指针 + 关流 + 解等待"→ 取件两条路由（F07）→ 流补发（F10）→ `calls/wait`（F11，注意登记位置）→ `calls/<id>/cancel`（F13）→ `health`（F15）→ 投影轮询扩展与 `agent_state`（F05/F06/F16）。
