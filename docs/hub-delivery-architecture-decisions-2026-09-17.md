---
title: hub 通讯架构优化方案 —— 五项决策定案
status: 已决策（讨论定稿,待转入 workflow-pb 需求阶段）
version: 1.0.0
created: 2026-09-17
depends_on:
  - docs/hub-vs-subagent-protocol-comparison-2026-09-17.md（本方案的问题根据）
  - docs/hub-issues-and-fixes-2026-09-17.md（本方案要解决的 HB-01/02/03）
  - docs/hub-bidirectional-delivery-proposal.md（v4 提案,本方案是其收窄与定案版本）
supersedes: docs/hub-bidirectional-delivery-proposal.md 中与本文件冲突的部分（见"与 v4 提案的关系"）
---

# hub 通讯架构优化方案：五项决策定案

## 一、这份文档解决什么问题

`docs/hub-vs-subagent-protocol-comparison-2026-09-17.md` 用 13 个维度对比了 hub 协议与 subagent 机制,归纳出核心分歧：

> subagent 的通知模型是"投递给一个身份"（身份先于事件存在,不要求在线）；hub 的通知模型是"广播给当前在线的连接"（事件发生时必须有人正在监听,否则丢弃）。

这个分歧是 `docs/hub-issues-and-fixes-2026-09-17.md` 里 HB-01（30 分钟固定上限,与完成脱钩）、HB-02（完成信号不可送达）、HB-03（终态不可信）三个 P0 问题的共同根因。本文档记录围绕这个分歧,经过五轮讨论后定下的架构方案。

**本文档只记录"决定了什么"和"为什么",不是实现细节的完整设计**——下一步应转入 `workflow-pb` 走需求收敛（demand.md）阶段,把这里的决策作为已确认的架构前提，逐条转成可验证的需求条目。

---

## 二、五项决策总览

| # | 议题 | 决策 | 一句话理由 |
|---|---|---|---|
| 1 | 推送模型要不要从"广播"改成"投递" | **方案 C**：收件箱升格为唯一权威送达路径，SSE 广播降级为 best-effort 体感优化,两者并行不互相依赖 | 与已有用户裁决（"实时流可丢,结果不可丢"）一致,复用现有 pickup 框架,不需要调用方保活连接 |
| 2 | `requester`（principal_id）要不要强制 | **方案 2-B**：不传时按 `chat_id` 自动生成缺省身份兜底,收件箱照常生效 | 默认路径就该是正确路径；"可选项没人记得用"这个模式已经在 0028/0029 复发三次 |
| 3 | 持久化范围 | **方案 3-B**：只把收件箱（inbox）落一张 SQLite 表,Router 任务表继续纯内存 | 消除"必达"承诺对"hub 进程没重启"这个隐藏前提的依赖,同时不牵动 Router/web.js 现有内存结构、不需要重新设计整张调用生命周期的 schema |
| 4 | 终态语义要不要结构化 | **方案 4-B**：`state` 不变,新增封闭枚举 `reason`（`agent_error`/`cancelled_by_client`/`infra_error`/`timeout`/`rejected`）,旧 `error` 字段保留作 `detail` | 向后兼容,解决"取消"和"崩溃"在 state 层同形的问题,且直接决定 inbox 表 `envelope` 列的存储格式 |
| 5 | 隔离边界（worktree/UDS 路径）要不要入协议 | **搁置**，维持现状（方案 5-A） | 与身份/推送/持久化/终态语义无耦合,不属于本轮 P0 范围,留作独立后续项 |

---

## 三、决策详述

### 决策 1：收件箱升格为权威送达路径（方案 C）

**变更前**：`pickup` 是选择性兜底——只有传了 `requester` 的调用才会写入,`GET /api/pickup` 只对配置正确的调用方有效。SSE 广播是唯一的"默认"通知手段,而广播对无订阅者的事件直接丢弃、不缓存、不补发。

**变更后**：
- 所有 `mode=background` 调用,只要能确定一个身份（含决策 2 的缺省兜底）,终态发布时**必然**写入收件箱。
- SSE 广播机制不改动，继续保持 best-effort，作为"实时感"的加成，不再是唯一送达路径。
- 调用方的标准使用方式变为：派发 → (可选)订阅实时流 → 随时调用 `GET /api/pickup?principal=<id>` 取终态 → `POST /api/pickup/:call_id/ack` 确认取件。

**架构图**（详见议题讨论中的完整版本，此处摘要核心结构）：

```
POST /api/calls (含 requester 或缺省兜底身份)
        │
        ▼
     Router ──▶ agent 执行 ──▶ task.result
        │
        ▼
  publishCallResult()  ← 唯一终态发布点
        │
        ├──────────────────┬──────────────────
        ▼                  ▼
  【权威路径,必达】      【体感路径,best-effort】
  写入 inbox(SQLite)     SSE 广播
  按 principal_id 索引    (在线才收到,不补发)
        │
        ▼
  调用方任意时间用同一 principal_id：
  GET /api/pickup?principal=xxx → 永远有答案
```

**依赖强度变化**：结果的可达性从"依赖连接此刻是否存活 + 订阅是否已建立 + 时间窗口是否重叠"（三者缺一即丢，脆弱）收窄为"依赖 principal_id 是否一致 + inbox 条目未被 ack"（与连接状态、时间窗口无关，健壮）。

---

### 决策 2：缺省身份兜底（方案 2-B）

**变更前**：`requester` 是可选字段，不传就完全退化到广播模型，决策 1 的必达保证形同没有。

**变更后**：`POST /api/calls` 缺失 `requester` 时，服务端按 `chat_id` 自动派生一个缺省 `principal_id`（例如 `chat:<chat_id>`），收件箱照常生效——**调用方不需要多做任何事就能获得必达保证**。

**兜底粒度**：按 `chat_id`，不细分到 `agent`。理由：收件箱条目本身已经带 `agent`/`call_id` 字段（复用现有 `pickup.js` 的 `add()` 结构），取件时按需过滤不构成额外负担；按 `chat_id` 兜底是覆盖"忘了传 requester"这个最常见疏忽场景的最简单方式。

**与决策 1 的关系**：这条决策把决策 1 的"必达"从"需要主动选择的特性"变成"默认行为"——这正是本方案对齐 subagent 模型（"什么都不做，通知也会自动送达"）的关键一步。

---

### 决策 3：收件箱轻量持久化（方案 3-B，收窄自方案 3-C）

**讨论过程记录**：最初提出方案 3-C（Router 任务表全面持久化），因为"持久化是后续必须做的事"。但进一步分析发现，全面持久化会牵动 Router 和 web.js 两层现有内存结构，且会把技术债（决策 4 要解决的自由字符串终态语义）原样焊死进数据库 schema，需要与决策 4 一起做才不用二次迁移，范围和成本都显著放大。收窄为方案 3-B 后，只解决"决策 1 的必达保证不应依赖 hub 进程没重启"这一个具体缺口。

**变更内容**：新增一张 SQLite 表 `inbox`，字段对应现有 `pickup.js` 的内存结构（`call_id, principal_id, agent, chat_id, terminal_at, envelope, acked`），仅在终态发布时写入一次。Router 任务表（`registry.js` 的 `tasks` Map）**不变**，继续纯内存，重启即丢，继续依赖既有的 D-14（"产物为权威"）兜底。

**架构图**：

```
┌─────────────────────────────────────┐
│         SQLite（持久层，已有）           │
│  已有表：projects / chats / messages    │
│  新增表：inbox（principal_id → 终态信封）│
│    call_id, principal_id, agent,        │
│    chat_id, terminal_at, envelope,      │
│    acked                                │
└───────────────┬─────────────────────┘
                │ 写入（仅终态发布时，一次）
                ▼
┌─────────────────────────────────────┐
│     Router 任务表（仍纯内存，不变）        │
│  重启即丢，继续靠 D-14（产物/DB 为权威）兜底│
└─────────────────────────────────────┘
```

**明确不做的事**（对齐"不做什么"边界，避免范围蔓延）：不改 Router 任务表存储方式；不做高频 `update` 增量的持久化（写入只发生在终态那一个时间点，不涉及流式进度的落盘节流问题）；不解决 transcript 1000 条前缀截断问题（HB-07，那是另一个独立缺陷，留给后续单独修）。

**留作独立后续项**：方案 3-C（全面持久化）不是被否决，是被延后——待真正因为"hub 频繁重启导致产物对账成本变高"这一具体痛点出现时，结合届时已经落地的决策 4 终态语义，一次性设计完整 schema，避免现在赶工焊死技术债。

---

### 决策 4：终态语义结构化（方案 4-B）

**变更前**：Router 任务表 `state` 是闭集 `{submitted, working, completed, failed}`；所有失败原因（`cancelled`/`context_crashed`/`timeout`/`rejected_by_agent`/`dispatch_failed`/`structured_output_invalid`/`spawn_failed`/`model_unavailable`/`permission_denied`/`context_busy`）全部塞进自由字符串 `error` 字段，导致"主动取消"和"意外崩溃"在 `state` 层完全同形。

**变更后**：
- `state` 字段**不改动**（不新增值，不影响任何现有下游判断逻辑）。
- 新增封闭枚举字段 `reason`，把现有 10 个自由字符串归为 5 类：

| `reason` 值 | 归类的现有 `error` 字符串 |
|---|---|
| `agent_error` | agent 自身执行失败的通用情形 |
| `cancelled_by_client` | `cancelled` |
| `infra_error` | `context_crashed`、`spawn_failed`、`spawn_error`、`dispatch_failed` |
| `timeout` | `timeout` |
| `rejected` | `permission_denied`、`model_unavailable`、`context_busy`、`structured_output_invalid`、`rejected_by_agent` |

- 原 `error` 字段**保留**，改名语义为 `detail`（人类可读的补充信息），不参与程序判断，不删除、不破坏现有依赖该字段拼写做判断的代码路径。

**与决策 3 的耦合点**：`reason`/`detail` 的结构直接决定 inbox 表 `envelope` 列存储的信封格式——两者需要在具体实现时对齐同一份 schema，不需要事后迁移。

**明确不做的事**：不废弃 `error` 字段本身（方案 4-C 的做法），避免破坏性变更；不新增 `state` 枚举值。

---

### 决策 5：隔离边界（搁置）

**决策**：本轮不处理。HB-08（UDS 路径超限、模糊 `pgrep` 误杀）继续依赖执行纪律（禁止模糊进程匹配、注意路径长度）规避，不纳入协议层设计。

**理由**：与决策 1~4 无架构耦合，不属于本轮要解决的三个 P0（HB-01/02/03）范围。若后续因取证成本问题重新浮出水面，可独立立项处理（候选方向是给 agent 注册时携带显式 `cwd`/`worktree_path` 字段，纳入 `/api/agents` 投影，方案 5-B），不影响本方案已定的架构。

---

## 四、决策之间的依赖关系

```
决策 1（收件箱=权威路径）
   │  依赖："有身份"才能有收件箱条目
   ▼
决策 2（缺省身份兜底）── 使决策 1 的保证变成默认行为，不需要调用方主动配置
   │
   ▼
决策 3（收件箱持久化）── 补齐决策 1 的"必达"承诺，使其不依赖 hub 进程存活
   │  Schema 设计需要知道 envelope 长什么样
   ▼
决策 4（终态语义结构化）── 决定 envelope 里 reason/detail 的具体格式

决策 5（隔离边界）── 无耦合，独立搁置
```

决策 1/2/3/4 是一条单向递进的链：**先确定"投递给谁"（1+2），再确定"投递的东西存不存得住"（3），再确定"投递的东西里装的是什么格式"（4）**。这也是为什么之前的讨论顺序不能颠倒——如果先做决策 4 再做决策 3，schema 需要返工；如果先做决策 3 再做决策 1/2，不知道该给谁建收件箱。

---

## 五、与 `hub-bidirectional-delivery-proposal.md`（v4 提案）的关系

v4 提案里已经确认的方向（P-A 身份服务、P-C 终态取件、P-D 等待语义统一）与本方案的决策 1/2 是同一条思路的延续和收窄，不冲突。

本方案与 v4 提案的差异点：
- v4 提案的 P-C′（epoch + 快照重建）和 P-G（重启恢复协议）设想的范围比本方案决策 3 更大——本方案明确把"Router 任务表持久化"（对应 P-G 里"重启前的调用登记可恢复"这部分）**延后**，只做收件箱这一小块的持久化。v4 提案里这部分尚待落地的内容，视为决策 3 里提到的"独立后续项"（未来的 3-C）。
- v4 提案没有涉及终态语义结构化（决策 4）——这是本轮对比调研（`hub-vs-subagent-protocol-comparison-2026-09-17.md`）新发现的问题，是对 v4 提案的补充，不是替换。

---

## 六、下一步

本文档记录的是架构层面的决策，尚未转化为可验收的需求条目。建议下一步：

1. 用 `workflow-pb` 起一个新迭代，阶段 1（需求收敛）直接以本文档的五项决策作为 `demand.md` 的架构前提（不需要重新讨论已经定案的部分），聚焦把决策 1~4 拆解成具体的 PRD 卡片。
2. 需求收敛阶段仍需要确认的细节（本文档未覆盖的实现层问题，留给 PRD 阶段）：
   - inbox 表的清理策略（ack 后何时删除，避免无限增长）。
   - 缺省身份（`chat:<chat_id>`）与显式传入的 `requester` 同时存在时的优先级/合并规则。
   - `reason` 枚举值的最终命名是否需要与现有 `error` 字符串做一次全仓引用点排查（避免遗漏未覆盖的失败来源）。
