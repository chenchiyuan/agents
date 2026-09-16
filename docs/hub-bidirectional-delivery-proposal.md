# 提案：hub 客户端会话与双向通路（P-A ~ P-F）

**状态**: 讨论稿 v2（2026-09-16；已按用户框架重写，Phase 0 未定稿、未落地）
**来源**: 迭代 0028 复盘 `roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`
**用户目标（原文）**:
> "我是希望能与 hub 建立稳定的双向通讯渠道，然后呢，hub 侧与 agent 也有双向机制（已经实现）。也就是本 agent 与 hub 建立机制之后，可以通过 hub 的机制获取所有 agent 的情况（实时），hub 对外提供 agent 的信息（包装好）。**任何地方接入 hub 之后，理论上可以获取到 hub 纳管的所有 agent 信息，调用，双向信息**"

**一句话目标**: 把"**连接到 hub**"变成一等公民入口 —— 接入即可：**① 实时看到全部纳管 agent ② 发起调用 ③ 双向收发消息与结果**；且**结果必达**（不因离线/晚订阅而丢）。

---

## 一、现状能力盘点（地基；每条附代码位置）

### 1.1 Router（UDS，JSON-RPC）—— 双向消息**已通**，缺订阅

| 方法 | 语义 | 与目标的关系 |
|---|---|---|
| `agent.register` / `heartbeat` / `deregister` | 实例注册与**租约**续期（返回 `lease_timeout_ms`） | **租约制**：离线即失效 ⇒ 不适合当"客户端身份"载体 |
| `message.send` / `message.deliver` / `message.ack` | 双向消息（至少一次 + `message_id` 幂等去重） | **已实现**（用户所指的"hub 侧与 agent 的双向机制"就是它） |
| `router.status` / `router.task_get` / `router.task_list` | 拓扑与任务**快照**查询 | 只有快照 ⇒ "实时"得靠**轮询** |

`src/router.js:109-395` 共 8 个方法；`sdk/uds.js` 层 B 与之一一对应。

### 1.2 web（HTTP + SSE）—— 4 条推送面，但有三个结构性缺口

| 路由 | 事件 | 缺口 |
|---|---|---|
| `GET /api/stream?chat_id=` | `message / task_update / chat_state / notice` | 无订阅者即丢（`src/transport.js:84-90`） |
| `GET /api/events` | `agent_online / agent_offline / confirmation / chat_state` | 同上；且 `oamp/web/notify.js` 的 `EVENT_TYPES` 仅 3 类，**调用面事件结构上不产生通知** |
| `GET /api/calls/stream?chat_id=` | `call_state / call_update / call_result` | 同上 + **终态不关流** |
| `GET /api/calls/<id>/stream` | 同上 | **终态不关流**：`transport.closeKey` 存在但**全仓 0 调用点**（`src/transport.js:120-127`）⇒ `stream call` 永不退出 |

### 1.3 调用方身份 —— 唯一的常驻发送方是 web

- `src/web.js:45`：`const SENDER_ID = 'web'; // web 服务作为常驻发送方身份`
- `task.from` 由 Router 用**投递连接的** `ident.instance_id` 代填（**禁止自报**）⇒ 调用面调用的 `from` 恒为 `'web'`。
- 层 A 全部条目 `acceptsAs: false`（`sdk/surface.js`）；层 C `oamp task send --as main` **发完即注销**（第二条死路）。
- **harness 未导出会话身份**（现场 `env` 实测仅 `AGENT=1` / `OMPCODE=1`；无 `OMP_SESSION_ID`）。

### 1.4 结论：缺的不是传输，是三样

① **不靠心跳续命的客户端身份**；② **实时事件订阅**（把快照变推送）；③ **结果投递给身份**（而非投递给"当时挂着的连接"）。

---

## 二、设计原则

> **身份 ≠ 连接。**
> **身份（principal）**：长期存在、可寻址、有收件箱、**不需要心跳续命**；
> **连接（link / SSE / HTTP 响应 / UDS socket）**：短期、可断、可重连、可多路。
> **结果与事件投递给身份；连接只是身份当下的取件窗口。**

---

## 三、方案

### P-A · 客户端会话（**入口**）· 最小实现 + 开放扩展

**协议新增**（与 `agent.register` **并列**、不复用其租约）：

```
principal { principal_id, kind: "session"|"program", created_at, last_seen_at }   // 无租约、无心跳要求
POST /api/principals { principal_id, kind }   → { principal_id, created_at }        // 幂等 upsert
hub api calls create --as <principal_id>      // 层 A 打开身份通道（仅 calls 相关条目，面上收口）
```

- **最小实现（按用户裁决 D6）**：身份先**不鉴权**（本机边界内），`principal_id` 由调用方自报、幂等登记即可 —— 相当于"**mock 一个身份**"，但**协议位留好**：将来 harness 导出会话 id、或引入令牌，只在"身份来源"一处扩展，不动其余。
- **扩展点**：身份来源（显式 / env / harness / 令牌）、租约策略（无 / 长租约）都做成**可替换的一层**，写进协议条文而不是写死在实现里。

**验收**：同一 `principal_id` 由两个不同进程先后声明 ⇒ 第二次不报错、`created_at` 不变、`last_seen_at` 刷新；不传 `--as` 时行为与今天逐字一致。

### P-B · 实时事件订阅（**"获取所有 agent 情况（实时）"的机制**）

**协议新增**：`events.subscribe { filter?: { kinds: [...], agents: [...] } }` → 下行事件流；事件种类**可扩展**：

```
agent_online / agent_offline / agent_state        // 纳管 agent 的实时状态（用户点名的能力）
call_state / call_update / call_result            // 调用生命周期
notice                                            // 通知（含 confirmation_request 等既有类）
```

- **传输**：web 侧 SSE（复用现成 `transport`）为第一形态；Router 侧 UDS 长连接为第二形态（协议只约束**语义**，不绑定传输）。
- **"包装好"**：事件里的 agent 信息按**投影对象**给（`instance_id / role / state / model / busy / since`），不让客户端自己拼。
- **不补发的边界**：**订阅语义**仍是"订阅之后的实时流"；**错过的事件由收件箱（P-C）兜底**，二者分工写进条文。

**验收**：客户端接入后，任一 agent 上下线、任一调用状态变化，**无需轮询**即在流上可见（≤1 个心跳周期延迟）。

### P-C · 结果必达（收件箱；内存 + 明文条款，按用户裁决 D2）

```
GET  /api/inbox?principal=<id>&since=<cursor>&kinds=...   → JSONL { cursor, kind, message_id, payload }
POST /api/inbox/ack { principal, cursor }
```

- **实现取向**：收件箱**不复制正文**，只存 `{principal, call_id, cursor, delivered}` 指针；正文按 `call_id` 从既有 `messages(out)` 读。
- **持久化 = 内存**（与 Router 任务表同寿命）；**协议显式写明"重启即丢"**，不让调用方误以为持久。
- **投递语义**：`call_result` 在声明了 requester 的调用终态时，**投递到该 principal 的收件箱一次**（幂等键 `message_id`，沿用协议 §4.4 既有约定）；未声明 requester 的调用维持现行为（**逐字兼容**）。
- **分工**：在线 → 走 P-B 的实时流；离线/晚订阅 → 走收件箱。两条路都到，才叫"必达"。

### P-D · 终态路由与关流、等待语义统一（**把"等"做对**）

1. **终态关流**：在唯一终态发布点（`publishCallResult`）之后，对 `call:<callId>` 调 `closeKey`（**复用现成原语**，即全仓那 0 个调用点的补线）⇒ `stream call` 终态即退出。
2. **晚订阅补发**：`handleCallStream` 订阅时先 `task_get`；已终态则**补发一帧后关流**。
3. **不改** `chat-calls:<chatId>` 的关闭策略（控制台长订阅）。
4. **`hub api calls wait <call_id…> [--timeout]`**：全部终态才返回（内部即上面的流 + 多 id 并发订阅）。

**协议条文草案**：
> **等待的退出条件必须是终态**；超时只表示**放弃等待**，不改变任务状态、不产生失败结论。（消除 `web.js:962`"不设人为上限" 与客户端 30 分钟预算的语义分歧。）

### P-E · 反向面（**可控**；按用户裁决 D4：复用 `failed + error`）

1. `POST /api/calls/<id>/cancel` → Router 通知执行实例中断 → 调用转 `state=failed, error="cancelled"`（**不新增终态**，不碰 §3.19 信封键集与 F11 判据）。
2. **队列可见性**：`GET /api/agents` 增 `{busy, current_call_id, queued, since}`。
3. **自派发拦截**：`to` 的实例若正处在**本次调用链**的执行中 ⇒ 默认**告警放行**（返回 `warnings[]`），观察一轮后再定是否硬拒（用户裁决 D5 倾向）。

### P-F · 观测投影（**卡死可见**）

`GET /api/calls` 每行增 `last_event_at`（任务表 `updates[]` 尾条）⇒ 客户端可导出 `idle_ms`，"卡死"与"正常长跑"在观测上分开。

---

## 四、不做什么（YAGNI 边界）

- 不做跨机 / 多 hub 联邦；不做鉴权体系（本机无鉴权边界不变）。
- 不做长期事件重放（P-B 只保证"订阅之后"；历史靠 P-C 收件箱窗口）。
- **不改** §3.19 信封键集（D4 已裁决复用 `failed + error`）。
- 不动控制台既有订阅行为；全部改动为**加法 + 一处补线**。

---

## 五、已裁决事项（用户 2026-09-16）

| # | 决策 | 采纳 |
|---|---|---|
| D1 | 目标是"**客户端会话**"：接入 hub 即可实时获取全部纳管 agent 信息、发起调用、双向收发 | ⇒ 本提案按此重构（P-A/P-B 为核心） |
| D2 | 收件箱**内存实现**，并**写明"重启即丢"** | ⇒ P-C |
| D4 | 取消**复用 `failed + error`**，不新增终态 | ⇒ P-E.1 |
| D6 | 身份用**最小实现（mock 身份，协议开放可扩展）**，**专注先实现通讯** | ⇒ P-A 最小版 + 扩展点；落地顺序见 §六 |

**仍待你拍板的默认值**（我先按倾向写进提案，可否请一并确认）：D3 收件箱保留期 = **跟随任务表寿命**；D5 自派发 = **先告警不硬拒**；传输 = **SSE 优先、UDS 并存（协议只约束语义）**。

---

## 六、落地顺序（按 D6"先实现通讯"）

1. **第 1 步（最小闭环，立刻消除症状）**：P-D.1 + P-D.2（终态关流 + 晚订阅补发）——**两根线级**改动，直接消掉 G-14 与 watchdog 的存在理由。
2. **第 2 步（客户端会话 + 实时）**：P-A（最小身份）+ P-B（事件订阅，含 agent 实时状态）+ P-C（收件箱）⇒ 用户目标达成："接入即可实时拿全局信息 + 双向"。
3. **第 3 步（可控与可观测）**：P-E（取消 / 队列可见 / 自派发拦截）+ P-F（`last_event_at`）。

---

## 七、落地后的预期（验收总纲）

1. 任意客户端**接入即实时**看到全部纳管 agent 状态与调用生命周期（无需轮询）。
2. 长任务派发后**不必自建 watchdog**：在线走实时流、离线走收件箱，一回合一次取件即达。
3. `stream call` 终态退出、晚订阅不再静默 ⇒ **G-14 消失**。
4. 派发到执行者自身实例会**当场告警** ⇒ **G-19 消失**；调用可被**取消**。
5. `calls` 行带 `last_event_at` ⇒ **G-20 消失**（卡死可观测）。
