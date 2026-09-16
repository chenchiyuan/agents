# 提案：hub 服务面与双向通路（P-A ~ P-F）

**状态**: 讨论稿 v3（2026-09-16；已按用户两轮框架重写：① "任何地方接入 hub 即可获取全部纳管 agent 信息、调用、双向信息" ② "**hub 与 agent 的派发、信息获取都是接口和服务化的，可直接供调用**"）
**来源**: 迭代 0028 复盘 `roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`

---

## 〇、组织原则：**一切能力 = 可发现、可调用的服务**

- 本仓已有服务化地基：`src/web.js` 的每条路由带元数据 `{method, path, summary, params, response, errors, docLink, danger}`，由 `GET /api/docs` 暴露、由 `renderLlmsTxt()` 生成 `llms.txt`（`src/web.js:443`、`projectRoutes`）。⇒ **新增能力只要按同一体例声明，就自动进入服务目录**，"任何地方接入"即可自行发现并调用，不需读源码。
- 因此本提案的全部新增项都写成**服务端点/服务方法**（含元数据与文档位），而不是内部机制；且**下行（事件）与上行（命令）都服务化**，二者共同构成"双向"。

---

## 一、现状服务盘点（地基；附代码位置与服务化状态）

| 能力 | 现有入口 | 服务化状态 |
|---|---|---|
| **纳管 agent 的信息** | `GET /api/agents`（快照）/ Router `router.status` | ⚠ 仅**快照**，无订阅；无 busy/queue 等运行态 |
| **调用（派发）** | `POST /api/calls`（background / block） | ⚠ 可用，但**无调用方身份**（`from` 恒 `'web'`，`src/web.js:45`）；block 的等待语义两处不一致 |
| **调用查询** | `GET /api/calls` / `/api/calls/<id>` / `/transcript` | ⚠ 仅**快照**；无 `last_event_at` |
| **双向消息（agent 侧）** | Router `message.send` / `message.deliver` / `message.ack`（`src/router.js:201/348`） | ✅ **已实现**（用户所指"hub 侧与 agent 的双向机制"）——但依赖**租约实例身份** |
| **事件推送** | 4 条 SSE（`/api/stream`、`/api/events`、`/api/calls/stream`、`/api/calls/<id>/stream`） | ⚠ 无订阅者即丢、**不补发**（`src/transport.js:84-90`）；调用流**终态不关流**（`closeKey` 全仓 0 调用点） |
| **确认（反向问答）** | `notice{kind:'confirmation_request'}` + `POST /api/confirmations/:id/decision` | ✅ 已跑通（`src/agent.js:283-299`、`src/web.js`）——**"请求方挂起 + 事件推给可寻址面"** 的现成范式 |
| **身份** | 层 B `agent.register`（**租约制**）；层 C `task send --as`（**发完即注销**） | ❌ 无"客户端身份"；层 A `acceptsAs:false`；harness 未导出会话 id（`env` 实测） |
| **等待** | `--mode block`（句柄在 web，客户端 30 分钟预算）/ `hub cli task watch`（500ms 轮询） | ⚠ 能力存在但**语义未统一**（`web.js:962` 称"不设人为上限"） |

**结论**：**缺三样**——① 不靠心跳续命的**客户端身份**；② **实时事件订阅**（把快照变推送）；③ **结果投递给身份**（而非投递给"当时挂着的连接"）。**缺的全部可以做成服务端点。**

---

## 二、设计原则

> **原则一（身份 ≠ 连接）**：身份长期存在、可寻址、有收件箱、**不需要心跳续命**；连接短期、可断、可重连。**结果与事件投递给身份**，连接只是身份当下的取件窗口。
> **原则二（服务化）**：每条能力 = 一个**声明了元数据**的服务端点；新增项自动进入 `/api/docs` 与 `llms.txt` ⇒ 接入方无需读源码即可发现与调用。

---

## 三、方案（每个 P 都是一组服务端点）

### P-A · 客户端会话（身份服务）· 最小实现 + 开放扩展

| 服务 | 语义 | 元数据要点 |
|---|---|---|
| `POST /api/principals` | 幂等 upsert 一个 `principal{principal_id, kind, created_at, last_seen_at}`；**无租约、无心跳要求** | `summary`："声明一个客户端身份（幂等；不参与租约淘汰）"；`errors`: INVALID_PARAM |
| `GET /api/principals/<id>` | 查询身份与 `last_seen_at` | 同上 |

- **最小实现（按用户裁决：mock 身份、协议开放可扩展）**：先**不鉴权**（本机边界内），`principal_id` 自报即登记；**"身份来源"做成可替换的一层**（今天：显式声明；将来：harness 导出会话 id / 令牌），写进协议条文而非写死实现。
- **调用面接入身份**：`hub api calls create --as <principal_id>`（**只对 calls 相关条目开** `acceptsAs`，面上收口）；`task.from` 由 Router 代填**该 principal**（沿用"禁止自报、由连接身份代填"的既有安全模型）。

### P-B · 实时事件订阅（把"实时"服务化）

| 服务 | 语义 | 元数据要点 |
|---|---|---|
| `GET /api/events?principal=<id>&kinds=…&agents=…`（SSE） | 面向**客户端**的事件流；`kinds` 过滤；`agent_*` 事件携带**投影对象** | `response`: `text/event-stream`；事件类 = `agent_online/agent_offline/agent_state/call_state/call_update/call_result/notice` |
| Router 侧 `events.subscribe`（UDS，第二形态） | 与上同语义，供需要单连接/底层的接入方 | 层 B 新增第 9 个方法 |

- **agent 投影（"包装好"）**：`{instance_id, role, state, model, busy, current_call_id, queued, since}`（其中 `busy/current_call_id/queued/since` 为**新增字段**，正是 G-19/G-20 所需）。
- **边界（写进条文）**：订阅语义 = "**订阅之后**的实时流"；**错过的历史由收件箱（P-C）兜底**。二者分工明确，不靠"补发历史"。

### P-C · 结果必达（收件箱服务）

| 服务 | 语义 |
|---|---|
| `GET /api/inbox?principal=<id>&since=<cursor>&kinds=…` | 返回未取件条目 JSONL `{cursor, kind, message_id, payload}` |
| `POST /api/inbox/ack {principal, cursor}` | 推进游标 |
| `POST /api/calls`（增 `requester`） | 声明 requester；终态时把 `call_result` **投递到该 principal 的收件箱一次**（幂等键 `message_id`，沿用协议 §4.4） |

- 实现：只存**指针**（`{principal, call_id, cursor, delivered}`），正文按 `call_id` 从既有 `messages(out)` 读，不复制。
- **持久化 = 内存**（与 Router 任务表同寿命），**协议显式写明"重启即丢"**（用户裁决 D2）。
- 兼容：不传 `requester` ⇒ 行为与今天逐字一致。

### P-C′ · 断线续传契约（**"链接断开能续上"** 的正式回答）

**现状（已核实）**：**不能续，且三处原因独立**——
1. SSE 帧**无 `id:` 游标**（`src/transport.js:88` 帧格式仅 `event:`/`data:`；`retry: 1000` 只指示"重连"，不携带进度）⇒ 标准 `Last-Event-ID` 无值可带。
2. 服务端**无回放源**：`publishTo` 无订阅者即丢、**不缓存不排队不补发**（`src/transport.js:84-90`）⇒ 断开窗口内事件永久消失。
3. 客户端**明确不做**自动重连 / 断点续订（`sdk/http.js:176` 的 N9/G02 设计取舍）；且下游数据源（Router 任务表）在内存，进程重启即丢。

**设计立场**：
> **能续的不是 socket，而是"我还没取走的东西"。**
> socket 断了就是断了；可以续上的是**投递给身份、带单调游标的投递记录**。因此续传的载体是**收件箱（P-C）**，而不是连接本身。

**契约（四条）**：
1. **游标**：每次投递带**每 principal 单调递增的 `cursor`**，并沿用既有 `message_id` 幂等去重（协议 §4.4）。收件箱即"按 principal 的**有界可回放日志**"。
2. **续传 = 一次拉取**：`GET /api/inbox?principal=X&since=<cursor>` 返回断线期间全部未取件；`ack` 推进游标。**与传输无关**——SSE 断、UDS 断、客户端进程重启都不影响，因为状态在 hub 侧的身份收件箱里，不在连接里。
3. **SSE 侧补 `id:`**（推荐）：每帧写 `id: <cursor>`，服务端接受标准 `Last-Event-ID` 或查询参数 `?since=`；**流的角色 = 实时尾巴，收件箱 = 按游标补拉**，同一份数据两用。**服务端仍需回放源**——即 P-C 的日志，不另造缓冲。
4. **`epoch` 与失效语义（必须有）**：hub 每次"存储代次"生成一个 `epoch`（进程启动即一代）。客户端持 `{epoch, cursor}`；重连时 `epoch` 不匹配 ⇒ 服务端返回 **`409 STALE_EPOCH` + 新 epoch**，**不得假装续上**。客户端据此走 **"快照重同步"**：`GET /api/agents` + `GET /api/calls` 各拉一次重建本地视图，再用新游标继续订阅。
   - 这条是**刻意反"静默失真"**的：宁可让调用方知道"你漏了一段，请重同步"，也不给一个看起来连续、实际有洞的流（本轮 G-14/G-20 的教训即此类）。

**保留窗口（写进条文）**：内存实现下**双限**（条数上限 + 时间上限，默认值待定）；超窗即丢，客户端须快照重同步。⇒ 与 D2（内存实现、写明重启即丢）一致。

**反向平面同样适用**：agent↔Router 侧已有 `OAMP_RECONNECT` 自动重连与 `agent.replaced`（latest-wins），但**重连后同样需要"按游标补拉"**，不得让 agent 侧自行猜测补齐——复用同一套 cursor/epoch 语义。

**验收判据**：
- 客户端订阅中断 N 秒后重连（携带 `{epoch, cursor}`）⇒ **断线期间的 `call_result`/`notice` 一条不漏**（条数一致、顺序一致、`message_id` 去重后无重复）。
- hub 重启后重连 ⇒ 明确收到 `STALE_EPOCH`，且按契约完成快照重同步（客户端本地视图与新快照一致）。
- 断开窗口超出保留窗 ⇒ 明确收到"超出保留窗"信号（而非静默空洞）。

---

### P-D · 等待语义统一 + 终态关流（把"等"做对）

- **终态关流**：唯一终态发布点（`publishCallResult`）之后对 `call:<callId>` 调 `closeKey`（**复用既有原语**，即那根全仓 0 调用点的线）；**晚订阅补发**：`handleCallStream` 先 `task_get`，已终态则补发一帧后关流。**不动** `chat-calls:<chatId>`（控制台长订阅）。
- **服务**：`GET /api/calls/wait?ids=a,b&timeout_ms=…`（或 CLI `hub api calls wait <id…>`）⇒ 全部终态才返回，输出各信封。
- **条文草案**：**等待的退出条件必须是终态；超时只表示放弃等待，不改变任务状态、不产生失败结论**（消除 `web.js:962` 与客户端预算的语义分歧）。
- **归位**：`--mode block`、`calls wait`、`task watch` 在本条文下是**同一语义族的三种形态**（短/中/长），协议**禁止**把"轮询 + 超时"当作等待实现。

### P-E · 反向服务（可控）

| 服务 | 语义 |
|---|---|
| `POST /api/calls/<id>/cancel` | 通知执行实例中断 → 调用转 `state=failed, error="cancelled"`（**不新增终态**，用户裁决 D4） |
| `GET /api/agents`（增字段） | 每实例增 `{busy, current_call_id, queued, since}`（队列可见） |
| `POST /api/calls`（自派发拦截） | `to` 实例若正处在本次调用链的执行中 ⇒ 默认**告警放行**（响应带 `warnings[]`），观察一轮后再定硬拒（用户裁决 D5 倾向） |

### P-F · 观测服务

- `GET /api/calls` 每行增 `last_event_at`（任务表 `updates[]` 尾条）⇒ 客户端可导出 `idle_ms`，把"卡死"与"正常长跑"在观测上分开。

---

## 四、不做什么（YAGNI 边界）

- 不做跨机 / 多 hub 联邦；不做鉴权体系（本机无鉴权边界不变）。
- 不做长期事件重放（P-B 只保证"订阅之后"；历史靠 P-C 兜底）。
- **不改** §3.19 信封键集（D4 已裁决复用 `failed + error`）。
- 不动控制台既有订阅行为；全部改动为**加法 + 一处补线**。

---

## 五、已裁决事项（用户 2026-09-16）

| # | 决策 |
|---|---|
| D1 | 目标是**客户端会话**：接入 hub 即可实时获取全部纳管 agent 信息、发起调用、双向收发 |
| D2 | 收件箱**内存实现**，协议**写明"重启即丢"** |
| D4 | 取消**复用 `failed + error`**，不新增终态 |
| D6 | 身份用**最小实现（mock 身份，协议开放可扩展）**，专注先实现通讯 |
| Q1 | **传输 = SSE 优先**（下行 SSE + 上行 HTTP POST；协议只约束语义，UDS 为第二形态） |
| Q2 | **服务化**：hub 与 agent 的派发、信息获取都必须是**可直接调用的接口/服务**（本提案的组织原则，见 §〇） |
| Q3 | **落地 = 直接做完整闭环**（P-A → P-F 一个迭代内完成；跳过"先补两根线"的单点修复） |

**待确认的默认值**：D3 收件箱保留期 = 跟随任务表寿命；D5 自派发 = 先告警不硬拒。

---

## 六、落地（一个迭代，完整闭环）

| 步 | 内容 | 服务新增 |
|---|---|---|
| 1 | P-A 身份服务 + 调用面 `--as` | `POST/GET /api/principals` |
| 2 | P-B 事件订阅 + agent 投影扩展 | `GET /api/events`（principal 版）+ Router `events.subscribe` |
| 3 | P-C 收件箱 + `requester` 投递 + **P-C′ 游标/epoch 续传** | `GET /api/inbox`、`POST /api/inbox/ack`（`epoch`+`since`+`ack`） |
| 4 | P-D 终态关流 + 晚订阅补发 + `calls wait` | `GET /api/calls/wait`（+ `closeKey` 补线） |
| 5 | P-E 取消 + 队列可见 + 自派发告警 | `POST /api/calls/<id>/cancel`、`agents` 字段 |
| 6 | P-F `last_event_at` | `GET /api/calls` 字段 |

全部新增项按 §〇 的元数据体例声明 ⇒ 自动进入 `/api/docs` 与 `llms.txt`。

---

## 七、落地后的预期（验收总纲）

1. 任意客户端**接入即实时**看到全部纳管 agent 状态与调用生命周期（无需轮询）。
2. 长任务派发后**不必自建 watchdog**：在线走实时流、离线走收件箱，一回合一次取件即达。
3. `stream call` 终态退出、晚订阅不再静默 ⇒ **G-14 消失**。
4. 派发到执行者自身实例会**当场告警** ⇒ **G-19 消失**；调用可被**取消**。
5. `calls` 行带 `last_event_at` ⇒ **G-20 消失**。
6. **断线可续**：客户端携 `{epoch, cursor}` 重连 ⇒ 断线期间的投递一条不漏；跨 hub 重启则以 `STALE_EPOCH` 明确告知并走快照重同步（**不静默失真**）。
