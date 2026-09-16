# 提案：hub 双向通路协议化（P-1 ~ P-6）

**状态**: 讨论稿（Phase 0，未定稿、未落地）
**来源**: 迭代 0028 复盘 `roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`
**目标**: 把"主 agent ↔ hub ↔ 任务 agent"的双向通路**在协议层**一次性打通——**结果必达 + 等待有界 + 反向可取消**，使 watchdog / `task watch` 这类调用方自建等待**不再必要**
**约束**: 只依据**已核实的当前实现**（每条附代码位置），不设计无法落地的机制

---

## 一、问题的形式化

当前实现里，调用链是**单向可达、反向靠挂住连接**：

```
CLI/浏览器 --HTTP POST /api/calls--> web（无调用方身份通道；from 由 Router 代填为 'web'）
  --> Router（from=ident.instance_id='web'，落内存任务表）
  --> 执行 agent（origin='web'）
  --> task.update / task.result（to='web'）
  --> Router finishTask + 尽力 deliver 到 origin='web'
  --> web：① 落库 messages(out) ② 发 chat:<id> SSE ③ 发 call:<id> / chat-calls:<id> SSE ④ 解 block 等待句柄
```

**形式化结论**：链路里存在"**投递到活连接**"与"**按 id 查询**"两种语义，**缺少第三种："投递到一个可持久寻址的身份"**。因此：

- 只有把连接挂住的人（`--mode block`，句柄在 web 进程内）或事后按 id 查询的人（`calls get`）能拿到结果；
- 其余调用方**结构上收不到任何推送**（两次独立侦察一致结论）；
- 且 `publishTo` 在无订阅者时**直接丢弃、不补发**（`src/transport.js:84-90`）⇒ 晚订阅者永久静默。

---

## 二、设计原则（本提案的元决策）

> **把"身份"与"连接"解耦。**
> 身份（principal）**长期存在、可寻址、有收件箱**；连接（link/SSE/HTTP 响应）**短期、可断、可重连**。
> 结果投递给**身份**，而非投递给"当时恰好挂着的连接"。

这条原则直接消掉现存的全部症状：离线发送方有了地址、晚订阅不再丢、等待不必绑定进程寿命。

---

## 三、现状硬约束（已核实，方案必须绕开或补齐）

| # | 事实 | 位置 | 对方案的含义 |
|---|---|---|---|
| C1 | **唯一的常驻发送方是 web**；`from` 由 Router 用**投递连接的** `ident.instance_id` 代填，**禁止自报** | `src/web.js:45`、`src/router.js` | 身份不能在请求体里"自报"了事，必须走 **register 面**（层 B 已有该能力） |
| C2 | 层 A 全部条目 `acceptsAs: false`；只有层 B（uds）有身份载体 | `sdk/surface.js`、`sdk/uds.js:127-142` | 要在 `api calls create` 上支持 `--as`，需**打开层 A 的身份通道**（一条命令表改动） |
| C3 | `agent.register` 是**租约制**（返回 `lease_timeout_ms`，靠 heartbeat 续） | `sdk/uds.js:141`、协议 §4.4 | **principal 不能复用 agent instance 语义**，否则"离线即失效"（`task send --as main` 发完即注销正是这条死路） |
| C4 | `transport.close()/closeKey` **存在但全仓 0 个调用点** | `src/transport.js:120-127` | "终态关流"是**补一根线**，不是新造机制 |
| C5 | `--mode block` = web 侧挂起 HTTP 响应；服务端声明"不设人为上限"，客户端却限 30 分钟 | `src/web.js:962`、`sdk/surface.js:88-94` | 两处语义不一致，需在协议里统一"超时 = 放弃等待，≠ 失败" |
| C6 | 结果正文**已被持久化**（`messages` out 行）；但任务表在**内存**（重启即丢，G-15） | `src/web.js` finishTask、`src/registry.js` | 收件箱可做成"**指针 + 未投递标记**"，不必复制正文 |
| C7 | harness **未导出会话身份**（`env` 实测仅 `AGENT=1`/`OMPCODE=1`） | 现场 `env` 实测 | 身份**必须显式声明**（`--as`）或**扩 harness 导出**；二者是 D1 的分叉点 |

---

## 四、方案

### P1 · 持久化 principal 身份（**身份面**）

**协议新增实体**（与 agent instance **并列**，不复用其租约）：

```
principal {
  principal_id   : string     // 调用方自声明，如 "main" / "main-<session>" / "it-0028"
  kind           : "session" | "program"
  created_at     : number
  last_seen_at   : number     // 由任何一次携带该身份的请求刷新；不参与租约淘汰
}
```

**接口**（幂等 upsert，不要求心跳）：
- `POST /api/principals {principal_id, kind}` → `{principal_id, created_at}`
- 层 A 打开身份通道：`hub api calls create --as <principal_id>`（其余 `api` 条目先不开，避免面过大）

**兼容性**：不传 `--as` ⇒ 行为与今天**逐字一致**（`from='web'`）。

**验收判据**：同一 principal_id 由两个不同进程先后声明，第二次不报错、`created_at` 不变、`last_seen_at` 刷新。

---

### P2 · 收件箱（**投递面**）—— 补齐"第三态"

**协议新增**：结果可投递给**身份**；身份离线时留在收件箱，等待拉取（**至少一次投递 + `message_id` 幂等去重**，沿用协议 §4.4 既有约定）。

```
GET  /api/inbox?principal=<id>&since=<cursor>&kinds=call_result,notice
     → 200 JSONL：{cursor, kind, message_id, payload}
POST /api/inbox/ack {principal, cursor}
```

**实现取向（最小改动，依据 C6）**：收件箱**不复制结果正文**，只存 `{principal, call_id, cursor, delivered_at}` 指针 + 未投递标记；正文按 `call_id` 从既有 `messages(out)` / 任务表读。

**保留期与重启语义**（→ 待决 D2）：建议"收件箱条目与任务表同寿命"（内存），并把"重启后丢"**写进协议显式条文**，而不是让调用方以为它会持久。

---

### P3 · 调用终态路由到 requester + 终态关流（**正向闭环**）

1. `POST /api/calls` 增可选 `requester`（来自 P1 的身份；缺省 = 现状）。
2. **终态发布点**（`publishCallResult`，全仓唯一）之后依次：
   - ① 现有两种 SSE 帧照发（不改控制台行为）；
   - ② requester ≠ `web` 时，**投递一条 `call_result` 到其收件箱**；
   - ③ **对 `call:<callId>` 调 `closeKey`**（复用 C4 的现成原语）⇒ `stream call` **在终态当刻退出**；
   - ④ `handleCallStream` 订阅时先 `task_get`：**若已终态则补发一帧后关流**（修"晚订阅永久静默"）。
3. **不改** `chat-calls:<chatId>` 的关闭策略（那是控制台的长订阅）。

**协议条文草案**：
> **结果必达**：声明了 requester 的调用，其终态信封必须在该 requester 的收件箱中**恰好出现一次**（幂等键 = `message_id`）；未声明 requester 的调用维持既有语义（投递到发起连接的活订阅者 + 可按 id 查询）。

**验收判据**：调用终态后，requester 用 `GET /api/inbox` 一次拉取即可拿到信封；`stream call` 在终态后 **≤1 次心跳周期**内退出；晚订阅者在订阅当刻收到终态帧并正常退出。

---

### P4 · 等待原语语义统一（**等待面**）

**协议条文草案**：
> **任何等待的退出条件必须是终态**；超时只表示**放弃等待**，不改变任务状态、不产生"失败"结论（依据 C5：block 的 `不设人为上限` 与客户端 30 分钟预算的语义分歧必须收敃）。

**新增**：`hub api calls wait <call_id…> [--timeout <ms>]` → 全部终态才返回，输出各信封（内部即 P3 的流 + 多 id 并发订阅）。

**归位**：既有的 `hub cli task watch`（可用、已实测）与 `--mode block` 在本条文下都是**同一语义族的合法形态**（短调用用 block；长调用用 wait/watch）；**协议明确禁止**把"轮询 + 超时"当作等待实现（这正是 watchdog 的形态）。

---

### P5 · 反向平面：取消 / 队列可见 / 自派发拦截（**反向闭环**）

1. **`POST /api/calls/<id>/cancel`**：Router 向执行实例发中断 → 调用转"已取消"。
   - 表示法二选一（→ 待决 D4）：新增终态 `cancelled`（触及 §3.19 信封与 F11 等价性判据）**或** 复用 `failed + error="cancelled"`（改动小、语义略糊）。
2. **队列可见性**：`GET /api/agents` 增 `{busy, current_call_id, queued, since}`（依据：每实例单 daemon、队列当前完全不可见）。
3. **自派发拦截**：`to` 的实例若正处在**本次调用链**的执行中 ⇒ 拒绝或告警（G-19 的 24 分钟死锁由此一次性消失）。
   - 强度二选一（→ 待决 D5）：硬拒（400）vs 默认告警放行（返回 `warnings[]`）。

---

### P6 · 观测投影（**可观测面**）

`GET /api/calls` 每行增 `last_event_at`（取自任务表 `updates[]` 尾条）⇒ 调用方可导出 `idle_ms`，把"卡死"与"正常长跑"在观测上分开（G-20 的根治），监控不必再靠翻磁盘日志。

---

## 五、不做什么（YAGNI 边界）

- 不做跨机 / 多 hub 联邦、不做鉴权体系（沿用本机无鉴权边界）。
- 不做长期事件重放（只保"收件箱窗口"内的未投递项）。
- **不改** `§3.19` 信封键集——除非 D4 选择新增 `cancelled` 终态。
- 不动控制台（web UI）既有订阅行为；改动全部**加法 + 一处补线（C4）**。

---

## 六、待决问题（请拍板）

| # | 问题 | 选项 | 我的倾向 |
|---|---|---|---|
| **D1** | principal 身份的**粒度与分配者** | (a) 会话级、由**扩 harness 导出**（`OMP_SESSION_ID`）(b) 迭代/任务级、由**工作流显式传**（`--as main-0028`）(c) 二者并存 | **(b) 先行**（C7：harness 现状不给身份，且工作流自己最清楚"谁在等"）；(a) 作为后续增强 |
| **D2** | 收件箱**持久化程度** | (a) 内存（与任务表同寿命，重启即丢，但**明确写进条文**）(b) SQLite 指针（重启后可续拉，需 schema + 保留期） | **(a) 先行**（最小改动、与现状一致、不制造"看起来持久其实不持久"的错觉）；(b) 作为第二阶段 |
| **D3** | requester **长期离线**时结果保留多久 | (a) 跟随任务表寿命 (b) 固定窗口（如 24h）(c) 由调用方指定 | **(a)** |
| **D4** | 取消的**表示法** | (a) 新增终态 `cancelled` (b) 复用 `failed + error="cancelled"` | **(a) 更正确但触及信封/F11**；(b) 更省——请你在"语义纯度"与"改动面"之间拍板 |
| **D5** | 自派发**拦截强度** | (a) 硬拒 400 (b) 告警放行 | **(b) 先行**（不破坏既有合法用法），观察一轮后再收紧 |
| **D6** | **落地切分** | (a) 先 P1+P2+P3（身份→收件箱→路由：正向闭环，watchdog 从此不必要）(b) 先 P3 的"终态关流"单点补线（1 行级）再谈其余 | **(b) → (a)**：先补 C4 那根线（立刻消除 G-14），再按 P1→P2→P3 完成协议闭环 |

---

## 七、落地后的预期（验收总纲）

1. `stream call` 在终态退出；晚订阅者不再静默 —— **G-14 消失**。
2. 主 agent 派发长任务后**不必再自建 watchdog**：结果进收件箱，一回合一次 `GET /api/inbox` 即达 —— **G-20 / watchdog 消失**。
3. 派发到执行者自身实例会被告警/拒绝 —— **G-19 消失**。
4. `calls list` 带 `last_event_at` ⇒ 卡死可被观测 —— 监控从"猜"变"看"。
