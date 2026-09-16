# 提案：hub 服务面与双向通路（P-A ~ P-F）

**状态**: 讨论稿 v4（2026-09-16；按用户需求口径重写：**实时流可丢、续接必须可靠、控制面与结果不可丢**）
**来源**: 迭代 0028 复盘 `roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`

---

## 〇、用户需求（原文，本节是全文的判据）

> "管道内的实时信息是允许丢的，但是**必须能让我续接**；不能丢的是：**我不能丢掉 hub，以及 hub 与 agent 的连接和控制**；也就是我断掉之后是能拉起继续任务的，也能通过**一轮实时查看**知道当前的进度和状态。"

### 需求形式化：两张清单

| **可丢（best-effort）** | **不可丢（must）** |
|---|---|
| 流式增量帧（`chunk` / 中间 `call_update` / 心跳） | **hub 本身**（活着、可控、状态可解释） |
| 断开窗口内的实时事件（不承诺回放） | **hub ↔ agent 的连接与控制**（派发 / 取消 / 队列 / 状态） |
| 订阅期间的重复与乱序（可去重、可重排） | **任务结果**（终态信封：完成了什么、成功与否） |
| —— | **续接能力**：客户端断线后可**拉起**并**继续任务** |
| —— | **一轮可见性**：**一次**查看即知全局进度与状态 |

⇒ **"续接"的定义被显著简化**：不是"回放断线期间的每一条事件"，而是"**回来之后一轮快照即可重建视图并继续调度**"。因此**不需要持久事件日志**；需要的是**权威状态 + 可一次取全的进度投影 + 持续可用的控制面**。

---

## 一、组织原则

> **原则一（身份 ≠ 连接）**：身份长期可寻址；连接短期可断、可重连。**结果投递给身份**，连接只是取件窗口。
> **原则二（服务化）**：每条能力都按既有路由元数据体例（`summary/params/response/errors/docLink`）声明 ⇒ 自动进入 `GET /api/docs` 与 `llms.txt`，接入方无需读源码即可发现与调用。
> **原则三（快照优先于增量）**：**正确性由快照与终态结果保证，实时流只提供"实时感"**。任何"靠流不丢来保证正确"的设计都违背本需求。

---

## 二、现状服务盘点（附代码位置）

| 能力 | 现有入口 | 与服务化/需求的差距 |
|---|---|---|
| 纳管 agent 信息 | `GET /api/agents`（快照） | ⚠ 无 `busy/current_call_id/queued/since` ⇒ **"一轮看清进度"做不到** |
| 调用（派发） | `POST /api/calls`（background / block） | ⚠ **无调用方身份**（`from` 恒 `'web'`，`src/web.js:45`） |
| 调用查询 | `GET /api/calls` / `<id>` / `/transcript` | ⚠ 无 `last_event_at`；`transcript` 进程内不持久 |
| hub↔agent 双向消息 | Router `message.send/deliver/ack` | ✅ 已实现；重连已有（`OAMP_RECONNECT` + `agent.replaced` latest-wins） |
| 事件推送 | 4 条 SSE | ⚠ 无订阅者即丢（**符合"可丢"**）、终态不关流（`closeKey` 全仓 0 调用点） |
| 确认（反向问答） | `notice{confirmation_request}` + `/api/confirmations/.../decision` | ✅ 已跑通（"请求方挂起 + 推给可寻址面"的现成范式） |
| 身份 | 层 B `agent.register`（**租约制**）、层 C `--as`（发完即注销） | ❌ 无客户端身份；层 A `acceptsAs:false`；harness 未导出会话 id |
| 等待 | `--mode block`（句柄在 web）/ `task watch`（500ms 轮询） | ⚠ 语义未统一（`web.js:962` 称"不设人为上限"） |

---

## 三、方案

### P-A · 客户端会话（身份服务）· 最小实现 + 开放扩展

```
POST /api/principals {principal_id, kind} → {principal_id, created_at}   // 幂等、无租约、无心跳要求
GET  /api/principals/<id>                                                // 含 last_seen_at
hub api calls create --as <principal_id>                                 // 层 A 仅对 calls 相关条目开
```
身份来源做成**可替换的一层**（今天：显式声明 = mock 身份；将来：harness 导出会话 id / 令牌）。不传 `--as` ⇒ 行为与今天逐字一致。

### P-B · 实时事件流（**明示 best-effort**）

```
GET /api/events?principal=<id>&kinds=…&agents=…        (SSE，第一形态)
Router events.subscribe                                 (UDS，第二形态)
```
事件类：`agent_online/agent_offline/agent_state` / `call_state/call_update/call_result` / `notice`。

- **契约条文**：本流**不保证不丢、不保证不重、不承诺回放**；其价值是"实时感"。
- **契约条文**：**重连后必须先做一次快照**（`GET /api/agents` + `GET /api/calls`）再继续订阅；**正确性以快照为准**。
- agent 投影："包装好"为 `{instance_id, role, state, model, busy, current_call_id, queued, since}`（后四项为新增，正是"一轮看清进度"的字段）。

### P-C · 终态结果取件（**不承诺事件不丢，但承诺结果可拿**）

```
POST /api/calls (增 requester)                      // 声明请求方身份
GET  /api/inbox?principal=<id>&since=<cursor>       // 未取件的终态结果
POST /api/inbox/ack {principal, cursor}
```
- **语义收窄（按新需求）**：收件箱**只承载"终态结果"**（完成了什么、成功与否），**不承载事件回放**；因此它**不需要持久事件日志**，实现只是"未取件指针 + 正文按 `call_id` 从既有 `messages(out)` 读"。
- **权威源仍是调用登记**：`GET /api/calls/<id>` 永远能拿到终态信封；收件箱解决的是"**我不用猜哪个调用完成了**"这件告知问题。
- 持久化 = 内存（与状态表同寿命），**协议写明"重启即丢"**（用户裁决 D2）。

### P-C′ · 续接契约（**"断线后拉起继续"的正式做法**）

**定义**：续接 = **重建视图 → 继续调度**，**不是**补事件。

1. **一轮快照（主路径）**：`GET /api/agents` + `GET /api/calls` **两次查询即得全局**（谁在跑、跑什么、到哪一步、有没有卡住）；需要细节时 `GET /api/calls/<id>/transcript`。
2. **`epoch` 语义**：hub 每次存储代次生成 `epoch`；客户端持 `{epoch, cursor}`。重连时 `epoch` 不匹配 ⇒ **`409 STALE_EPOCH`**（明确告知"你漏了一段且不可续"），客户端按第 1 条做快照重建即可；**绝不给假连续**。
3. **快照之后恢复订阅**：实时流照常接入；**其间丢掉的增量不补**（符合"可丢"）。
4. **续接的验收**：客户端断开 N 分钟 → 拉起 → **两次查询**准确说出：哪些实例在线、哪些调用在跑、各自进行到哪、有没有停滞、有无未取结果。**这条即用户点名的"一轮实时查看知道当前进度和状态"。**

### P-D · 等待语义统一 + 终态关流（**让"等"正确**）

- **终态关流**：唯一终态发布点（`publishCallResult`）之后对 `call:<callId>` 调 `closeKey`（**复用既有原语**——即那根全仓 0 调用点的线）；**晚订阅补发**：`handleCallStream` 先 `task_get`，已终态则补发一帧后关流。**不动** `chat-calls:<chatId>`。
- **`GET /api/calls/wait?ids=…&timeout_ms=…`**：全部终态才返回。
- **条文**：**等待的退出条件必须是终态；超时只表示放弃等待，不改变任务状态、不产生失败结论**；协议**禁止**把"轮询 + 超时"当作等待实现。

### P-E · 控制面不可丢（**用户点名的"不能丢"**）

1. **hub ↔ agent 的连接与控制**
   - 连接：已有 `OAMP_RECONNECT` 自动重连 + `agent.replaced`（latest-wins）；**要补"重连后对账"**——重连的 agent 需与服务端收敛任务状态（在跑什么、队列是否保留）。
   - 控制：`POST /api/calls/<id>/cancel`（转 `state=failed, error="cancelled"`，**不新增终态**）+ `GET /api/agents` 增 `{busy, current_call_id, queued, since}` + 自派发**告警**（`warnings[]`）。
2. **客户端断线期间，控制面必须照常工作**（hub 与其 agent 不受客户端影响）——**当前已满足**，需写成条文并纳入验收。
3. **hub 自身的可用性**（→ 待决 D7，见 §五）：当前任务表在内存，hub 重启即丢调用面；"不能丢 hub" 意味着**要么约定不重启、要么把状态持久化**。

### P-F · 观测投影（**"一轮看清进度"的字段面**）

- `GET /api/calls` 每行增 `last_event_at` ⇒ 客户端可导出 `idle_ms`（**区分"卡死"与"正常长跑"**）。
- `GET /api/agents` 增 `busy / current_call_id / queued / since`。
- 二者合起来 = **"当前进度与状态"的一轮快照**（P-C′ 第 1 条的载体）。

---

## 四、不做什么（YAGNI 边界）

- **不做事件回放 / 不做持久事件日志**（用户裁决：实时信息可丢）。
- 不做跨机 / 多 hub 联邦；不做鉴权体系（本机无鉴权边界不变）。
- **不改** §3.19 信封键集（D4：取消复用 `failed + error`）。
- 不动控制台既有订阅行为；全部改动为**加法 + 一处补线**。

---

## 五、已裁决与待决

**已裁决（用户 2026-09-16）**：D1 客户端会话 ✓ | D2 收件箱内存实现 + 写明重启即丢 ✓ | D4 取消复用 `failed+error` ✓ | D6 最小 mock 身份、协议留扩展点 ✓ | Q1 **SSE 优先** ✓ | Q2 **服务化** ✓ | Q3 **直接做完整闭环** ✓ | **新需求口径：实时流可丢 ✓ / 续接必须可靠 ✓ / hub 与 hub↔agent 控制面不可丢 ✓ / 一轮快照可见 ✓**

**待决 D7（新，需你拍板）**：**"不能丢 hub" 落到实现上是哪一种？**
- (a) **约定不重启**：把"hub 与 agent 进程在任务期间不得重启"写成运行约束（廉价；但 G-18 那类"静默不启"的风险要靠运维纪律兜）。
- (b) **状态持久化**：把调用登记（当前在内存）落到 web 既有 SQLite ⇒ 重启可恢复调用面与收件箱（更贵；但"hub 丢了也能拉起"才成立）。
- (c) **agent 侧留底 + 重连对账**：任务状态由 agent 侧持有并在重连时上报 ⇒ hub 重启后可重建（折中）。

**待确认的默认值**：D3 收件箱保留期 = 跟随状态寿命；D5 自派发 = 先告警不硬拒。

---

## 六、落地（一个迭代，完整闭环）

| 步 | 内容 | 服务新增 |
|---|---|---|
| 1 | P-A 身份服务 + 调用面 `--as` | `POST/GET /api/principals` |
| 2 | P-B 实时流（best-effort）+ agent 投影扩展 | `GET /api/events`（principal 版）、Router `events.subscribe` |
| 3 | P-C 终态结果取件 + `requester` | `GET /api/inbox`、`POST /api/inbox/ack` |
| 4 | P-C′ 续接契约（快照重建 + `epoch`） | 快照面即 P-F 的字段；`epoch` 出现在订阅响应与收件箱 |
| 5 | P-D 终态关流 + 晚订阅补发 + `calls wait` | `GET /api/calls/wait` |
| 6 | P-E 控制面（取消 / 队列 / 自派发告警 / 重连对账）+ P-F | `POST /api/calls/<id>/cancel`、`agents`/`calls` 字段 |

---

## 七、验收总纲（**按用户口径重写**）

1. **续接**：客户端断开任意时长 → 拉起后**两次查询**即准确重建视图（在线实例 / 在跑调用 / 各自进度 / 是否停滞 / 未取结果）。
2. **实时可丢但不要紧**：人为切断实时流，不产生任何"结论性错误"；重连后以快照为准，无需回放。
3. **结果不丢**：任一调用的终态信封，客户端**未取件时不会消失**（在保留窗内）；`calls get` 永远可查。
4. **控制面不丢**：客户端断线期间派发/取消/队列照常工作；agent 断线重连后状态收敛一致。
5. **等待正确**：所有等待以终态为退出条件；`stream call` 终态退出、晚订阅不静默。
6. **一轮可见**：`agents + calls` 快照即可回答"当前进度与状态"（含 `idle_ms` 与队列深度）。
7. **服务化**：以上全部按元数据体例声明，自动出现在 `/api/docs` 与 `llms.txt`。
