# F04：一次调用与过程实时展示（协议层可替换）

**功能 ID**: F04
**来源**: `demand.md` C-4（一次聊天 = 一次调用；B 的处理过程实时展示；协议层可替换）、D-1（通道抽象 + 本版实现）、N-1、N-3、N-4；裸判定 E-4
**迭代**: 0011-chat-context-protocol

---

## 用户价值

用户不必盯着空白界面等结果——B 的处理过程实时可见；同时保持"一次聊天 = 一次调用"的清晰语义，且实时通道将来可换而不改行为。

## 验收标准

1. **一次调用**：用户提交一次输入 → 恰好触发一次对指定 agent 的调用，并产生一个最终答复文本；调用经统一协议承载，输入/输出与持久化记录一一对应（C-4；与 F02-1 同一事实的两个视角）。
2. **流式可见（裸判定 E-4）**：在 B 完成之前，浏览器即可看到增量输出（分段到达、内容逐步增长），而不是等最终答复一次性出现（E-4，非等终态）。
3. **过程事件可观察**：实时通道对外至少可观察三类事件——过程增量、消息落列（输入/输出）、chat 状态变更（事件模型与负载见「架构维度」：四类命名事件 `message` / `task_update` / `chat_state` / `notice`）`[model_inferred]`。
4. **多轮不失序**：同一 chat 内多次调用的实时展示按发生顺序呈现，先后不颠倒。
5. **过程不落盘**：实时展示的过程内容不进入持久化——本卡只锁"实时可见"侧，落盘口径见 F02-2（N-1）。
6. **协议层可替换**：实时展示由一个可替换的传输抽象承载——以另一种实时传输实现替换它时，本卡验收 1~5 的外部行为不变（判定方式：同一组端到端用例在替换实现后仍通过）；本版只实现一种 HTTP 原生的单向流式传输，不引入双向长连接协议与额外依赖（D-1/N-3）。
7. **断线不丢内容**：推送连接中断后，页面在重连或刷新时仍能呈现该 chat 的完整输入/输出，不因断线导致内容缺失（恢复策略 = 浏览器自动重连 + 重连/刷新时全量拉取该 chat 的落盘记录；断线期间的**过程增量**不补发）`[model_inferred]`。

## 边界（不包含）

- 不做 WebSocket / 双向长连接（N-3：只留替换接口，不引入相应依赖）。
- 不做过程持久化、回放、导出（N-1）。
- 不承诺推送的"恰好一次"投递，也不承诺补发断线期间的增量（demand 未要求）。
- 不做多客户端协同（同一 chat 多浏览器同步）（demand 外）。
- 不做鉴权 / 多用户（N-4）。
- B 需要工具/权限交互的形态不在本卡（默认问答形态；工具模式归 `executor:'omp'` 一次性路径，本迭代 daemon 不做工具/权限应答——见「架构维度」AR-16）。

## 架构维度（阶段 3 已填，2026-09-10；详见 `architecture.md` §5.1~§5.4）

- **传输抽象接口**：`src/transport.js` 导出 `createSseTransport()` → `{ kind:'sse', handle(req,res,{chatId}), publish(chatId,event), closeAll() }`。替换另一种实时传输 = 实现同一接口并替换 web.js 中的一行构造（**不引入 transport 配置项**——只有一种实现时的配置项是纯负债）（对应验收 6）。
- **事件模型**：四类带名事件——`message`（`{chat_id, message:{id,direction,agent_id,text,model,duration_ms,error,created_at}}`，输入/输出落盘后各一次）、`task_update`（`{chat_id,task_id,kind:'chunk'|'stdout'|'stderr',text?,line?}`，过程增量，不入库）、`chat_state`（`{chat_id,state}`）、`notice`（`{chat_id,kind:'context_released'|'context_reset',text}`，上下文事件，不入库）。保活 = 响应头 `retry: 1000` + 每 15s 一条 `: keepalive` 注释行；顺序由单连接 FIFO 保证，不引入 seq 字段（对应验收 3/4）。
- **本版实现与端点**：`GET /api/stream?chat_id=<id>` → `text/event-stream`（必带 `chat_id`，无全局订阅）；连接 `close` 时从订阅集合移除；无订阅者时 `publish` 丢弃（不缓存）。
- **过程增量来源与时效**：来源 = `omp acp` 的 `session/update.agent_message_chunk`，逐块由 agent 转成 `task.update`；**复用 0010 既有投递语义**（Router 记录任务表后把 `task.update` 投递给发起者 = web），web 在 `onDeliver` 中直接 `publish` → **无轮询、无 sleep**，单 chunk 端到端预算 ≤200ms。验收 2（E-4）判据 = 收到该轮 `message`(out) 事件**之前**已收到 ≥2 个 `task_update` 且文本长度递增；不做节流（刷屏再议）。
- **断线兜底**：服务端 `retry: 1000` + 浏览器 `EventSource` 自动重连；重连或刷新时前端**全量拉取 `GET /api/chats/:id`**（读库），因此已落盘的输入/输出永不缺失（对应验收 7）；断线期间的过程增量**不补发**（本卡边界明文不承诺）。
