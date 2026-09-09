# 04 OAMP 协议规格（OMP Agent Messaging Protocol / 1）

**版本**：0.2.0　**日期**：2026-09-09　**状态**：方案建议（协议名与草案一致：OAMP v1，`router_protocol: "oamp/1"`）

## 0. 规格声明

- 外层：**JSON-RPC 2.0**（请求/响应/通知、`id`、`error`），传输本机为 **Unix Domain Socket**。
- 语义参照：**A2A v1.0 词汇**（Agent 能力元数据、Message/Part、Task 状态方向、context_id 逻辑分组）；**OAMP 是 A2A 语义的本地受限方言，不声明为 A2A v1.0 实现**（DS-04）。互操作由未来 northbound adapter 翻译（§11）。
- 约定：所有时间戳 UTC ISO-8601；所有 id 为字符串（推荐 ULID/随机短 id），协议不限定格式但必须全局唯一。
- 方法与事件名命名空间：`agent.*`（生命周期）、`message.*`（投递）、`task.*`（工作单元，agent 间业务面）、`control.*`（控制面）。

## 1. RPC 方法清单

| 方法 | 方向 | 类型 | 用途 |
|---|---|---|---|
| `agent.register` | 实例→Router | 请求 | 注册身份/能力/租约请求（03 §5.1） |
| `agent.heartbeat` | 实例→Router | 通知 | 续租 + 上报 state/inflight |
| `agent.deregister` | 实例→Router | 通知 | 正常下线（draining 完成） |
| `agent.announce` | Router→实例 | 通知 | 拓扑变更推送（可选：新成员/离线），白名单内 |
| `message.send` | 实例→Router | 请求 | 提交一条消息投递（同步响应=已受理入队） |
| `message.deliver` | Router→实例 | 请求 | 投递给目标；目标必须回 `message.ack` |
| `message.ack` | 实例→Router | 请求 | 对 deliver 的确认（accepted/started/completed/rejected/expired） |
| `message.status` | 实例→Router | 请求 | 发送方查询某 message_id 的投递状态 |
| `message.cancel` | 实例→Router | 请求 | 撤回 queued 消息（delivered 后不可撤回） |
| `task.request` | 实例→实例 | 消息 | （消息类型，见 §4）请求执行工作 |
| `task.update` | 实例→实例 | 消息 | 进度/阻塞更新（携带 task_id/correlation_id） |
| `task.result` | 实例→实例 | 消息 | 结果/失败回报（终态语义见 §8 映射） |
| `event.notice` | 实例→实例 | 消息 | 无结果要求的通知/广播 |
| `control.cancel` | 实例→实例 | 消息 | 取消一个 task.request，要求回执 |
| `control.reload_prompt` | 实例→Router/实例 | 消息 | 重新加载初始化规则，须生成新 session_id 并记录原因 |

> 划分说明：`task.*` 与 `control.cancel` 在信封的 `type` 字段表达（§4），不是独立 RPC——RPC 面只有 `message.*`/`agent.*`；这避免 Router 理解业务语义，Router 只按信封转发。

## 2. 消息信封（Envelope）

所有经 Router 流转的消息统一封套：

```json
{
  "protocol": "oamp/1",
  "message_id": "msg-01JXXXX",
  "conversation_id": "conv-01JXXXX",
  "correlation_id": "req-01JXXXX",
  "type": "task.request",
  "from": {"agent_id": "architect-gpt", "session_id": "sess-a01J"},
  "to": {"agent_id": "dev-deepseek"},
  "reply_to": "architect-gpt",
  "created_at": "2026-09-09T12:00:00Z",
  "expires_at": "2026-09-09T12:10:00Z",
  "delivery": {
    "mode": "at_least_once",
    "ack_required": true,
    "ack_deadline_ms": 5000,
    "max_attempts": 3
  },
  "payload": {
    "content_type": "text/markdown",
    "body": "请实现 brief 中的后端变更。"
  },
  "trace": {"trace_id": "trace-01J", "forward_path": []}
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `protocol` | 是 | `oamp/1` |
| `message_id` | 是 | 全局限一；**幂等键**（§7） |
| `conversation_id` | 否 | 逻辑会话分组（对齐 A2A `context_id` 思想；续作/多任务共享） |
| `correlation_id` | 条件 | 请求-响应链必填，与 `reply_to` 成对使用（§8.1） |
| `type` | 是 | §4 枚举 |
| `from` | 是 | Router 代填/校验；实例不可自报他人 |
| `to` | 是 | 目标表达，§8 三种形式之一 |
| `reply_to` | 条件 | 需要响应时填 from.agent_id |
| `created_at` / `expires_at` | 是/否 | TTL 控 |
| `delivery` | 是 | 投递策略（Router 校验，实例不可提权） |
| `payload` | 是 | `content_type` + `body`；对齐 A2A Part 思想：MVP 支持 `text/*`、`application/json`，未来扩展 file/data part |
| `trace` | 否 | `trace_id`；Router 在每次转发时追加 `forward_path` 一跳 |

## 3. Part / 内容扩展（对齐 A2A Part 的说明）

A2A 的 Part 允许 `text | raw | url | data` 联合。OAMP v1 信封 MVP 只承诺 `text/*` 与 `application/json` 两种 content_type；`file`/`raw` 传输（大文件、图片、日志）在跨机/northbound 阶段引入 Part 结构，不在 MVP 伪造支持。`prompt`、工具输出等一律走 payload，不引入协议级附件。

## 4. 消息类型集合

| type | 要求结果 | ack_required 建议 | 语义 |
|---|---|---|---|
| `task.request` | 是（task.result） | true | 委派工作；带 `correlation_id` |
| `task.update` | 否 | false | 进度/阻塞/需澄清（对齐 A2A `INPUT_REQUIRED` 思路） |
| `task.result` | 否 | false | 终态回报：`completed` / `failed`（错误在 payload 结构化字段） |
| `event.notice` | 否 | false | 事实通知（如"PR 已合并"），可广播 |
| `control.cancel` | 是（回执） | true | 请求取消 task |
| `control.reload_prompt` | 是（新 session） | true | 规则热更入口（§10 安全） |

## 5. 请求/响应与投递流

### 5.1 message.send（发送方视角）

```json
{"jsonrpc":"2.0","id":"rpc-100","method":"message.send","params":{
  "message": {"message_id":"msg-…","type":"task.request","to":{"agent_id":"dev-deepseek"},
              "correlation_id":"req-…","reply_to":"architect-gpt",
              "payload":{"content_type":"text/plain","body":"…"},
              "delivery":{"ack_required":true,"max_attempts":3}}}}
```

同步响应**只表示受理**：

```json
{"jsonrpc":"2.0","id":"rpc-100","result":{"accepted":true,"message_id":"msg-…","status":"queued"}}
```

### 5.2 message.deliver（目标视角）+ ack

Router 投递（JSON-RPC 请求，目标必须应答）：

```json
{"jsonrpc":"2.0","id":"dlv-7","method":"message.deliver","params":{
  "message": {"message_id":"msg-…","type":"task.request",
              "from":{"agent_id":"architect-gpt","session_id":"sess-a01J"},
              "to":{"agent_id":"dev-deepseek"},
              "payload":{"content_type":"text/plain","body":"…"}}}}
```

目标处理后的确认通过 `message.ack`：

```json
{"jsonrpc":"2.0","id":"ack-1","method":"message.ack","params":{
  "message_id":"msg-…","agent_id":"dev-deepseek","session_id":"sess-b01J",
  "status":"accepted","received_at":"…"}}
```

Router 对 `message.deliver` 的 JSON-RPC 层应答与业务 Ack **分离**：目标先回 JSON-RPC 响应表示"已收到 deliver 请求"（防重传），随后（可异步、可分期）上报 `message.ack` 表示投递语义确认。推荐最小实现：目标收到 deliver 后立即回 JSON-RPC 响应 + 马上发 `accepted` ack；`started`/`completed` 可选。

## 6. Ack / 心跳 / 任务更新的严格区分（对用户"Ack 保活"的精确化）

| 机制 | 证明 | 不证明 | 谁产生 | 频率 |
|---|---|---|---|---|
| `message.ack` | 某 session 收到并接受某条消息（`accepted`…`completed`/`rejected`/`expired`） | 进程仍在线、LLM 可用 | 实例（对每条 deliver） | 每条消息一次或分期 |
| `agent.heartbeat` | 某 session 在租约内仍在线（含 busy + inflight） | 消息是否已收、任务是否有进展 | 实例 | 周期（默认 10s） |
| `task.update` | 任务主动报告了状态/进度 | 进程仍在线 | 实例 | 按业务 |

**设计意图**："Ack 可以保活"在 OAMP 中被拆开实现——若只靠消息 Ack 判活，空闲 agent（无消息）会被误判死；若只靠心跳判投递，会出现"心跳在、消息丢了"。二者必须并存且互不推导（见 03 §4.3 判定表）。

### 6.1 Ack 状态机

```
delivered → accepted → started → completed
              │
              ├─ rejected（带 error_code，终）
              └─ expired（超过 expires_at，终）
```

Router 侧驱动重试：`ack_deadline_ms` 内无 `accepted` → 重投（相同 message_id）至 `max_attempts` → `failed`。`expired` 可在任意阶段由 Router 或接收方宣布。

## 7. 幂等与去重（DS-06）

- **幂等键 = `message_id`**（全局唯一）。接收方必须记录已处理/处理中的 message_id；重复 deliver 返回已有状态（`DUPLICATE_MESSAGE` 语义，不重复执行）。
- 重试**不得改变** message_id；业务去重以 message_id 为准，不信任 attempt 计数。
- `task.result` 等回报消息同样携带原 `correlation_id`，让请求方把结果对回原请求，不依赖消息顺序。

## 8. 路由与寻址（DS-07）

### 8.1 三种目标表达

```json
{"agent_id": "dev-deepseek"}                     // 点对点（唯一接收者）
{"topic": "verification"}                        // 显式广播（订阅该 topic 的全部实例）
{"selector": {"role": "verifier", "labels": ["backend"]}}  // 白名单内按元数据选择
```

规则：

1. `agent_id` 点对点**绝不**扩展为广播；目标不存在 → `AGENT_NOT_FOUND`。
2. `topic` / `selector` 是显式广播；每个接收者独立投递状态（各自 queued→acked），共享父 `message_id` + 各自的 `delivery_instance_id`（Router 生成）。
3. 广播 fan-out 有上限（配置 `max_fanout`）；无订阅者 → 返回成功但 `delivered_count: 0`，不报错。
4. **不支持**从消息正文推断下一跳。转发必须显式 `to`（或经业务方重发新消息），Router 只认信封 `to`。
5. `forward_path` 由 Router 追加，重复 agent 出现 → 拒绝（防环）；`max_hops` 默认 8。
6. 请求-响应：`reply_to` + `correlation_id` 寻址回包；响应方把原 `to` 作为新消息的 `to`，不靠"最近一条消息"猜。
7. 路由白名单：仅允许配置声明过的 agent/label 组合；生产不允许任意发现 + 全量广播（03 §7）。

### 8.2 广播与业务语义

`task.request` 默认**不允许**广播（一个任务只有一个执行者）；广播仅限 `event.notice` 类，或 selector 命中后由 Router 逐一点对点复制为独立任务请求（由发送方显式选择，Router 不做隐式展开）。

## 9. 版本协商与兼容

- 连接层：注册时客户端上报 `router_protocol: "oamp/1"` + `capabilities`；Router 拒绝不兼容版本（`PROTOCOL_MISMATCH`，03 §8）。
- 信封层：`protocol` 字段保证未来 `oamp/2` 可共存（Router 按版本走不同校验）。
- northbound：未来 A2A adapter 是**翻译层**（§11），不得要求内部实例升级到 A2A 会话——OAMP 版本演进独立于 A2A 版本演进。

## 10. 安全与初始化规则不可变性

1. 初始化规则（prompt_profile 内容）在启动时固化并计算 `prompt_hash`；普通消息（含 `task.request`、`control.cancel`）**不得**替换/删除/注入规则内容。规则只能经 `control.reload_prompt` 变更，且变更 = 新 session_id + 审计原因（05 §4）。
2. 实例回报中带 `instance_id`、`session_id`、`prompt_hash`，消息接收方与审计可确认"这条消息由哪套规则执行"。
3. 凭据禁止项：配置/消息/日志/Router 内存不得出现 `api_key`、`token`、`password`、`authorization` 等值（字段名也不允许出现在配置 schema 内，配置校验快速失败）。
4. 本地身份：注册 token 由 Launcher 生成并经进程环境传入，Router 校验 token ↔ agent_id 绑定；不信任注册包自报身份。
5. 不可信输入：prompt、消息正文、任务结果对接收方均为不可信输入；实例不得因消息内容执行提权操作。

## 11. A2A v1.0 映射表（northbound adapter 与词汇对齐用）

| OAMP | A2A v1.0 | 方向 |
|---|---|---|
| `agent.register` 上报的能力/元数据 | Agent Card（skills/capabilities/endpoint） | OAMP 是 Agent Card 的本地会话化变体 |
| `conversation_id` | `contextId` | 同构：逻辑分组续作 |
| 信封 `payload` | `Message.parts[].text/data` | 语义对齐，结构不同（OAMP 平铺） |
| `task.request` / `task.result` | `SendMessage` → `Task`（`SUBMITTED→WORKING→COMPLETED/FAILED`…） | adapter 双向翻译 |
| `task.update` | `TaskStatusUpdateEvent` / `INPUT_REQUIRED` | 翻译 |
| `message.ack`（accepted） | 无直接对应（A2A push 通知收讫=HTTP 2xx；`SendMessage` 同步响应） | OAMP 增量，不进翻译面 |
| `agent.heartbeat`/租约 | 无（A2A 无 liveness） | OAMP 增量，不进翻译面 |
| 点对点 `agent_id` 寻址 | Client→A2A Server 端点 | 跨机时：adapter 把 agent_id 解析为 A2A endpoint/Agent Card |
| 广播/selector | 无（编排方职责） | OAMP 增量 |

## 12. 明确不在 OAMP v1 内

- 不做 gRPC/HTTP 绑定、多租户、签名 Agent Card、OAuth 流（A2A v1 企业面留给 northbound adapter）。
- 不做 provider 切换、模型 fallback 触发（属 model-dispatch-protocol）。
- 不做跨项目广播、跨机器路由（06 §1 待决）。
- 不做业务级记忆/知识沉淀（first-tree Context Tree 形态是未来应用层）。
