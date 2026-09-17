# 跨 PR 接缝冻结记录 — 0030-hub-communication-upgrade

**性质**: 阶段 5 执行期间由主 agent（调度方）冻结的跨 PR 接口记录。用途：供接线 PR（pr-005）、文档同步 PR（pr-006）与阶段 6 独立验证核对；**不是**规范真源（规范真源 = `architecture.md` + `prs/pr-*.md`），本文件只固化"已被下游消费的具体形态"，避免各 PR 各写一版。

**维护规则**: 每条只在**提供方 PR 合并**后标 ✅；形态一经冻结，后续 PR 不得改写（要改须回阶段 4 重规划）。

---

## 1. `reasonOf(state, error)` —— 提供方 pr-001 ✅（合并 `f81d5c6`，文件 `oamp/src/reason.js`）

| 项 | 冻结形态 |
|---|---|
| 导出面 | **唯一具名导出** `reasonOf`（无 default、无第二个导出名） |
| 签名 | `reasonOf(state, error)`，参数名与顺序固定；纯函数、不抛异常（任意入参含 `null`/非字符串/对象） |
| 返回值域 | 严格二分：`state !== 'failed'` ⇒ **严格 `null`**；`state === 'failed'` ⇒ ∈ {`agent_error`, `cancelled_by_client`, `infra_error`, `timeout`, `rejected`} 且**恒非 `null`** |
| 匹配口径 | 三段式：精确（8 串）→ 前缀（`timeout_after_` 且 `ms` 结尾 / `spawn_failed:` / `spawn_error:`）→ 兜底 `agent_error`；**不做关键字启发式** |
| 零面 | 文件内 0 条 `import`（含 `node:` 内置）、无 I/O / 定时器 / 时间 / `process.env` 读取 |
| **消费方（pr-005）要求** | 在**唯一信封构造点** `composeCallEnvelope`（`web.js:539`）内 `import { reasonOf } from './reason.js'`，仅当 `state === 'failed'` 时把结果作为**第 12 键** `reason` **追加在既有 11 键之后** |

## 2. `createPoolRouting({ roleFromInstanceId })` —— 提供方 pr-002 ✅（合并 `4bcfbc3`，文件 `oamp/src/pool-routing.js`）

| 项 | 冻结形态 |
|---|---|
| 导出面 | 工厂 `createPoolRouting`，入参 `{ roleFromInstanceId }`（**注入**，模块不 import `role-binding.js`） |
| 返回面 | 恰 4 个方法：`choose` / `release` / `bindingOf` / `inflightOf` |
| `choose` 签名 | `choose(role, { chatId, noReuse, snapshot })` |
| `snapshot` 形状 | `{ nodes, work }`：`nodes` = `router.status` 的 `nodes` 数组；`work` = **由调用方算出注入**（`deriveAgentWork(taskRows)` 的 Map）——故模块零 import 且负载公式仍只在 `web.js` 一处 |
| 选择口径 | 次序键 `(queued, busy, inflight, instance_id)` 取字典序最小；`instance_id` 升序做**确定性** tie-break；在飞预留：选中 +1、`release` −1（下界 0，未计数实例为 no-op） |
| 粘性 | 键 `(chatId, role)`；`noReuse` ⇒ 忽略绑定、按最空闲重选**并重绑**；绑定实例不在池 ⇒ 重选重绑且**不抛错**；`chatId` 非非空字符串 ⇒ 跳过粘性读写、选择照常、不抛错 |
| 空池 | `choose` 返回 `null`（模块自身不造错误面、不静默排队） |
| 零面 | 0 import、无 I/O / 定时器 |

## 3. `roleOfPoolInstance(instanceId, baseResolve)` —— 提供方 pr-002 ✅（同上）

| 项 | 冻结形态 |
|---|---|
| 语义 | ① `baseResolve(instanceId)` 非 `null` ⇒ 返回（**精确优先**，角色 `dev-2` 真实存在时 `pb-dev-2` 就是 `dev-2`）；② 未命中且 id 形如 `pb-<role>-<n>`（`n` **正整数**）⇒ 剥尾段后用**同一个** `baseResolve` 解析；③ 仍 `null` ⇒ `null` |
| 边界 | `pb-dev` → `dev`；`pb-dev-2` → `dev`；`pb-dev-1` 与 `pb-dev` 是**两个独立实例**（不做别名等价）；`pb-dev-0` / `pb-dev-x` / `pb-dev-` **不**归一；非字符串入参 ⇒ `null` 不抛错 |
| 约束 | `baseResolve` 是**参数**（不 import `role-binding.js`）；纯函数、不抛错 |
| **消费方（pr-005）要求** | 池成员判定与 `GET /api/agents` 的 `role` 列**必须消费同一函数**（两处 `baseResolve` 实参均为 `roleFromInstanceId`）；`pb-<role>-<n>` 的 role 列由 `null` → 角色名属 **A-06 补定已登记的取值变化**，其余列与取值域不变 |

## 4. `persist.openDb(dbPath)` 的 inbox 三方法 —— 提供方 pr-003 ✅（合并 `9fc962a`，文件 `oamp/src/persist.js`）

| 项 | 冻结形态 |
|---|---|
| 写入 | `insertInbox({ callId, principal, agent, chatId, terminalAt, envelope })` ⇒ **camelCase 对象入参**（同文件既有写口体例）、返回 **boolean**；`INSERT OR IGNORE` 幂等（同一 `call_id` 二次插入不覆盖首条） |
| 读取 | `listInbox(principal)` ⇒ 该 principal 的行数组，按 `terminal_at` **升序** |
| 删除 | `deleteInbox(callId)` ⇒ 就地 `DELETE`，返回 **boolean**；对不存在/已删的 `call_id` 影响 0 行且**不抛错**（幂等） |
| 表结构 | `inbox(call_id TEXT PRIMARY KEY, principal TEXT NOT NULL, agent TEXT, chat_id TEXT, terminal_at INTEGER NOT NULL, envelope TEXT NOT NULL)` + `idx_inbox_principal(principal, terminal_at)` |
| 语义 | `envelope` 存**整份终态信封 JSON**（重启前后逐字节一致）；只在**终态发布那一刻写一次**（非终态无记录）；ack = 删行（不保留 `acked` 列）；**未取件不设 TTL**；无归档/导出/`VACUUM` 类维护动作 |
| **消费方（pr-005）要求** | 唯一写入点 = `publishCallResult`（改为**无条件**写入，身份取 `call.principal`）；`GET /api/pickup` 改读 `listInbox`（不再逐条 `task_get`）；`POST /api/pickup/:call_id/ack` 改调 `deleteInbox`；取件响应形状**逐字不变**（键集/键序不变，`acked` 恒 `false`）。**`envelope` 实参必须是已序列化的 JSON 字符串**——`insertInbox` 把传入值**原样**写入 TEXT 列，模块内**不做** `JSON.stringify`（实测偏差记录：pr-003 验收偏差 ①），故 pr-005 需自行 `JSON.stringify(composeCallEnvelope(...))`，否则落库的是 `[object Object]` |

## 5. 环境阈值键与透传 —— 提供方 pr-004（**在飞**）

| 项 | 冻结形态 |
|---|---|
| 配置面 | `src/config.js` 的 `loadConfig()` 返回 `taskIdleMs`（默认 `600000`）/ `taskNetMs`（默认 `14400000`）；env `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS`；非法值启动即报错（`readPositiveInt` 体例，不静默回落） |
| 透传 | `agent.js` 两路 LLM 任务改传 `{ idleMs, netMs }`；**`context-pool.js` 两键透传**（形参 → 队列项 → `client.prompt` 实参；键语义/同键串行/LRU 零改动） |
| **消费方（pr-005）要求** | `RECONCILE_TTL_DEFAULT_MS` 默认值与 `config.taskNetMs` **联动**（不联动即破 F01 必达：登记被清后长任务终态在 `handleDeliver` 查不到 `entry` 被丢弃）；`OAMP_WEB_RECONCILE_TTL_MS` 覆盖仍生效 |

## 6. pr-005 需**提供**给下游的接缝（尚未实现，登记备查）

| 接缝 | 消费方 |
|---|---|
| `pickInstance(role, { chatId, noReuse, snapshot })` 经 `createApiRoutes` 的 deps 注入 `startWeb` | 阶段 6 验证（F06/F07 端到端） |
| `call.principal` 派生（显式 `requester` ?? `chat:<chatId>`）与池内选择、`new_session` 项级可选字段 | pr-006（文档面）/ 阶段 6 |
| `composeCallEnvelope` 失败侧追加 `reason`、`publishCallResult` 无条件写 inbox、取件两端点改读写 | pr-006 / pr-008（G01 零回归对照面） |
| `pickup.js` 退役（三消费点同 PR 迁移，无 re-export、无兼容层） | pr-008（G01 验收：全仓 `pickup.js` 零命中） |

---

**冻结时间**: 2026-09-17（阶段 5 执行中）。**冻结依据**: 各 PR 的 `tasks` 文件、PR 文件验收标准、`architecture.md` §4 A-01/A-03/A-04/A-06/A-07/A-08/A-09，以及已合并提交的实测行为。
