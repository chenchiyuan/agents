# pr-005-tasks.md — pr-005 内部任务列表（web 面接线：收件箱必达 + 池内路由 + `reason` + 对账 TTL 联动 + 退役 pickup.js）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-005-web-inbox-and-pool-wiring.md`（10 条验收标准）
**PR worktree（绝对路径，唯一代码写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-005-web-inbox-and-pool-wiring`
**PR worktree 分支**: `feat/0030-pr-005-web-inbox-and-pool-wiring`（落盘时 HEAD = `1b02689` = 迭代分支 tip ⇒ 本文件全程以 `1b02689` 为 diff 基准；`git status --short` 为空，`oamp/.runtime` 不存在）
**任务总数**: **8**（T1~T8）｜ **依赖图**: **无环**（见 §2）｜ **关键路径**: `T2 → T3 → T6 → T8`（4 节点）
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（10 条 AC）+ `architecture.md`（§3.1~§3.4、§4 A-01/A-02/A-03/A-06/A-07、§5 变更面、§7 L2 清单、§8 奥卡姆检验、§9 已知局限）+ `clarifications/cross-pr-contracts-2026-09-17.md`（**与 tasks 冲突时以它为准**）+ `prd/F01…F07` 相关验收项 + **代码实读与实跑**（§0.3，逐条带 `文件:行号` / 原始输出）

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（唯一，逐字取自 PR 文件「文件范围」）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/web.js` | 修改 | ① `/api/calls` 目标改池内选择 + 项级 `new_session` + `call.principal` 派生（**T1/T2**）；② `composeCallEnvelope` 失败侧追加 `reason`（**T4**）；③ `publishCallResult` 无条件写 `insertInbox`（**T2**）；④ `GET /api/pickup` 改读 `listInbox`（**T3**）；⑤ ack 改 `deleteInbox`（**T3**）；⑥ `RECONCILE_TTL` 默认值与 `config.taskNetMs` 联动（**T5**）；⑦ deps 注入 `pickInstance`（**T1**）；⑧ `/api/agents` 的 `role` 列与池成员判定同源（**T7**） |
| 2 | `oamp/src/pickup.js` | **删除** | 三消费点迁移完成后删除（**T6**）；无 re-export、无兼容层 |

> `pr-005-web-inbox-and-pool-wiring-tasks.md`（本文件）是阶段 5 增量产物，**不计入** PR 的代码改动面（`tools/check-pr-gates.py` 已把 `-tasks.md` 排除在 PR 文件之外）。
> 取证产物一律落 `/tmp/0030-pr-005/`，**不入库**（§5）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/src/` 下其余 **25** 个既有/上游 `.js`（`oamp/src/*.js` 实测 27 个 − 本 PR 的 `web.js`（改）与 `pickup.js`（删）），含已合并的 `reason.js` / `pool-routing.js` / `persist.js` / `config.js` / `agent.js` / `acp-client.js` / `rpc-client.js` / `oneshot-client.js` / `context-pool.js`，以及 `role-binding.js` / `principals.js` / `inbox.js` / `router.js` / `registry.js` / `cluster-config.js`；`oamp/package.json`、`oamp/API.md`、`oamp/README.md`、`oamp/llms.txt`、`oamp/skill/hub.md`（= pr-006 文件范围）、`oamp/sdk/**`、`oamp/web/**`、`oamp/bin/**`、`oamp/scripts/**`、`cluster.json`、`roles/**`、`tools/**`。
  追溯：PR 文件「文件范围」+ architecture §5「明确不改（零改动）」列。
- **不新增**：任何 HTTP 路由（既有 **29 条**不变，实跑 `/api/docs` = 29）、任何协议方法、任何配置键 / env 键、任何第三方依赖（`dependencies: {}`）、任何测试文件、任何目录。
- **不动既有文案**：`/api/calls` 的既有 400/404 文案、`/api/docs` 的既有 `params[].desc`（含 `tasks` 项形状说明与 `（{task, output_schema?, schema_mode?, mode?, model?}）` 文案）、`ERR_CODE` 五码与 `sendError` 构造点，逐字不动。
  追溯：G01 验收 3/10 + PR AC9「逐字不变」；`/api/docs` 的参数表更新归 pr-006（其文件范围不含 `web.js`，见 §5 MI-P9）。
- **不做（属其他 PR）**：`reason.js` 本体（pr-001）、`pool-routing.js` 本体与 `roleOfPoolInstance`（pr-002）、`inbox` 表与三方法（pr-003）、双计时与配置键（pr-004）、文档面（pr-006）、G01 零回归证据文档（pr-008）。
- **做错的形态（明确排除，每条都有上游依据）**：
  1. 在 `web.js` 内**复制** `reasonOf` 的映射表 —— A-03「唯一公式只此一处」；本 PR 只 import。
  2. 在 `web.js` 内**复制** `roleOfPoolInstance` / 角色↔实例公式 —— A-06 补定「复用，不复制公式」。
  3. 把 `envelope` 对象**直接**传给 `insertInbox` —— 契约 §4 实测偏差 ①：`insertInbox` 原样写 TEXT 列，必须先 `JSON.stringify`（否则落库 `[object Object]`）。
  4. 为"池内无在线实例"新造 404/503/静默排队 —— MI-9；空池 ⇒ 回落 `instanceIdForRole(role)`（既有路径）。
  5. 让快照查询失败把 `/api/calls` 变成 502 —— 实测基线 = 200 + submitted（§0.3 A9），新造 502 即 AC9 回归。
  6. 给 `new_session` 加 400 校验分支 —— 实测基线：未知项级字段**静默忽略**（§0.3 A8），新增拒绝面 = AC9 回归（§5 MI-P6）。
  7. 给取件面加归属校验（只允许条目 principal 自己 ack） —— 既有 `pickup.ack(call_id)` 不校验归属，A-09 的 `deleteInbox(call_id)` 同口径。
  8. 给未取件条目加 TTL / 归档 / 清理定时器 —— A-09 结论 3（F03 边界）。
  9. 顺手改 `ContextPool` 键语义 / `sdk/surface.js` / `API.md` —— 各自的文件范围不属于本 PR。

### 0.3 读码 + 实跑事实锚点（2026-09-17，PR worktree HEAD `1b02689`；「实跑」= 在 `/tmp` 副本上起 Router + web + 假节点实测）

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **A1** | `composeCallEnvelope` 的**既有信封恰 10 键**、键序 `call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code`；`invalid`（strict 且结构未过）⇒ `state='failed' + error='structured_output_invalid'` | `oamp/src/web.js:539-558`；**实跑**：`["call_id","agent","state","duration_ms","model","truncated","text","structured_output","error","exit_code"]` ⇒ 文档/注释里的「11 键」是**笔误**（§5 事实更正 F-1） |
| **A2** | `import` 区：`pickup`（`:43`）、`role-binding` 两函数（`:44`）、`openDb`（`:39`）、`loadConfig`（`:36`）；**无** `reason.js` / `pool-routing.js` 引用 | `oamp/src/web.js:36-44`（实测 `grep -n "reason.js\|pool-routing" oamp/src/web.js` 零命中） |
| **A3** | `/api/calls` 目标解析**唯一调用点** = `const agentId = instanceIdForRole(role)`（`:1342`）+ 紧随的 `if (roleOfInstance(agentId) !== role) → 404`（`:1343-1346`）；此后逐项装配（`:1443` `call` 对象）→ `tasks.set`（`:1469`）→ `await sendTask`（`:1474`）→ `scheduleReconcile`（`:1476`） | `oamp/src/web.js:1342-1486` |
| **A4** | `sendTask` 两次重试后**吞掉异常**（`lastErr` 赋值后无 `throw`）⇒ `/api/calls` 与 `/api/messages` 的派发失败 `catch` 分支**不可达**；"settle" 判定 = `await sendTask(...)` 返回 | `oamp/src/web.js:2424-2441`（`grep -n lastErr` 仅 `:2425/:2437`）；**实跑**：角色可解析但无在线实例 ⇒ **200 + submitted 信封**（非 404） |
| **A5** | `deriveAgentWork(taskRows)` 是 `web.js` 内**未导出**函数，产出 `Map<instance_id, {busy, current_call_id, queued, since}>`（`state==='submitted'` ⇒ `queued += 1`；`working` ⇒ `busy`）；`projectAgentState`（已导出）复用它 | `oamp/src/web.js:214-233`、`:237-251` |
| **A6** | `/api/agents` 行键序 = `["instance_id","session_id","state","last_heartbeat","connected","role","busy","current_call_id","queued","since"]`；`role` 由 `roleFromInstanceId(n.instance_id)` 现算（`:673`）；`?state=online` 过滤口径 = `n.state === 'online'` | `oamp/src/web.js:668-686`；**实跑**：`pb-dev` ⇒ `dev`，`pb-dev-2` ⇒ **`null`**（A-06 已登记取值变化的基线） |
| **A7** | 取件面现状：`pickup.listByRequester(principalId)`（`:1637`）→ 逐条 `queryOnce(router.task_get)`（`:1638`）→ `envelope: task ? composeCallEnvelope(...) : null`（`:1640`）；ack = `pickup.ack(params.call_id)`（`:1799`）；`pickup.add` 仅在 `call.requester !== null` 时写（`:2223-2231`） | `oamp/src/web.js:1612-1644 / 1775-1801 / 2215-2240`；条目键序**实跑** = `["call_id","requester","agent","chat_id","terminal_at","acked","envelope"]` |
| **A8** | `/api/calls` 项校验：未知项级字段**静默忽略**（实跑 `new_session: true` 与 `new_session: "yes"` 均 200）；已知字段取非法值 ⇒ 400（`mode` 非法 ⇒ `{"error":"mode 非法（需为 background / block）"}`）；项模板 = `{task, outputSchema, schemaMode, mode, model}` | `oamp/src/web.js:1380-1425`；**实跑**基线 |
| **A9** | **Router 不可达时**：`POST /api/calls` = **200 + submitted**（handler 不查 Router）；`GET /api/pickup`（有未取件条目时）= **502 UPSTREAM_UNAVAILABLE**（逐条 `task_get` 抛错）；`GET /api/agents` = 502 | **实跑**基线（停 Router 后取证） |
| **A10** | 对账软 TTL：常量 `RECONCILE_TTL_DEFAULT_MS = 30*60*1000`（`:76`，全仓唯一引用点 `:2164`）；`reconcileTtlMs = readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', RECONCILE_TTL_DEFAULT_MS)`（`:2164`）；清理点 `:2286-2289`，warn 行含 `（${toSec(reconcileTtlMs)}s 未终态）`；`toSec = max(1, round(ms/1000))`（`:92`） | `oamp/src/web.js:76 / 2164 / 2286-2289`；**实跑**：`OAMP_TASK_NET_MS=1000` + 不设 `OAMP_WEB_RECONCILE_TTL_MS` + 间隔压到 200ms ⇒ 38s 后**无**清理行（基线 TTL 仍 1800s）⇒ 判据可判定 |
| **A11** | `config.taskNetMs` 已由 pr-004 提供（`loadConfig()` 返回，默认 `14400000`，env `OAMP_TASK_NET_MS`）；`startWeb` 在 `:2018` 调 `loadConfig(process.env)`；`db = openDb(config.dbPath)`（`:2030`） | `oamp/src/config.js:29-30 / 155-156`、`oamp/src/web.js:2018 / 2030` |
| **A12** | deps 注入体例 = `createApiRoutes({ db, transport, config, …, sendTask, sendControlNotice, scheduleReconcile, waiters, … })`（`:2457-2460`），签名默认值在 `:642-647` | `oamp/src/web.js:642-647 / 2457-2460` |
| **A13** | `call.requester` 的全仓读者**只有两处**：装配点 `:1443` 与发布点 `:2223-2226`（`grep -rn "\.requester" oamp/` 其余命中全在 `pickup.js` 内）⇒ 改名 `principal` 的爆炸半径受控 | **实测** |
| **A14** | 实现面对 `pickup.js` 的引用**恰 3 处** + 模块自身：`web.js:43`（import）、`:1799`（ack）、`:2224`（add）⇒ 迁移后全仓实现面零命中；`oamp/API.md` / `llms.txt` / `skill/hub.md` / `sdk/surface.js` 只提**端点名** `/api/pickup`（非模块），不在退役范围 | **实测**（`grep -rn "pickup\.js\|pickup\.add\|pickup\.ack"`，排除 `docs/`、`roles/`） |
| **A15** | 仓内**无任何 `*.test.js`**；本 PR 自证载体 = 一次性脚本 + 只读命令（§4）。`oamp/sdk/surface.js` 的 `calls create` flags 为**硬编码白名单**（无 `requester`、无 `new-session`），本迭代 `sdk/**` 零改动 ⇒ `new_session` 的调用方途径 = 裸 HTTP 项级字段 | **实测**；§5 事实更正 F-7 |
| **A16** | PR worktree 干净、无 `oamp/.runtime`；`git status --short` 为空（本文件落盘前复核） | **实测** |

### 0.4 本 PR 冻结契约（跨 PR 接缝 / 本 PR 内部一次定死；dev 按此编码，不再自行取舍）

1. **`reason` 键位与取值（T4）**：`composeCallEnvelope` 的返回对象在 `state === 'failed'` 时把 `reason` **追加为最后一个键**（既有 10 键的键名与键序前置不变）；`state !== 'failed'` ⇒ **不带该键**；取值 = `reasonOf(state, envelope.error)`（失败时恒非 `null`）。
   〔追溯：契约 §1「作为第 12 键追加在既有 11 键之后」的**键位意图**（末位）+ A1 的键数更正；architecture §4 A-03；prd/F04 验收 1/7〕
2. **`reason` 唯一来源 = `import { reasonOf } from './reason.js'`**；`web.js` 内不出现映射表（`cancelled` / `context_crashed` / `timeout_after_` 等字面量不得出现在 web.js 的归类逻辑里）。
   〔追溯：A-03「唯一公式」、契约 §1 消费方要求〕
3. **`call.principal` 派生（唯一点）**：`const principal = requester === null ? \`chat:${chatId}\` : requester;`（`requester` 已把空串归 `null`，`:1347` 逐字不动）；`call` 对象的字段由 `requester` **改名**为 `principal`（值 = 派生结果）；`warnings` 的出现条件仍只看出否**显式**给出身份（`:1486` 的 `requester === null` 判断不动）。
   〔追溯：A-02；契约 §4 消费方要求；prd/F02 验收 4/5；MI-1〕
4. **`insertInbox` 实参（T2）**：`db.insertInbox({ callId: call.callId, principal: call.principal, agent: call.role, chatId: call.chatId, terminalAt: Date.now(), envelope: JSON.stringify(envelope) })` —— **`envelope` 必须先序列化**；调用**无条件**（删掉 `if (call.requester !== null)` 守卫）；位置 = `envelope !== null` 分支内、`call.terminal` 写入之后（即替换现 `pickup.add` 的位置）。
   〔追溯：契约 §4（含实测偏差 ①）+ A-01「无效条件」条；prd/F01 验收 3/4、F03 验收 3〕
5. **取件条目映射与键序（T3）**：`db.listInbox(principalId)` ⇒ 逐条
   `{ call_id: row.call_id, requester: row.principal, agent: row.agent, chat_id: row.chat_id, terminal_at: row.terminal_at, acked: false, envelope: JSON.parse(row.envelope) }`
   —— 键名/键序与迭代前**逐字一致**（`requester` 列名保留）；**不再**在 handler 内 `queryOnce(router.task_get)`、**不再**现算信封。多条按 `terminal_at` 升序（`listInbox` 的 SQL 已定）。`principal`/`epoch` 校验与 `principals.touch` 逐字不动。
   〔追溯：A-09「响应形状零变化」+ 契约 §4 消费方要求 + architecture §3.1 第 3 条〕
6. **ack（T3）**：`pickup.ack(params.call_id)` ⇒ `db.deleteInbox(params.call_id)`；响应恒 `{call_id, acked:true}`（0 行影响同样如此）；**不校验归属**（既有语义）。
   〔追溯：A-09 结论 (a) + 契约 §4；prd/F03 验收 2、F01 验收 6〕
7. **池快照（T1）**：每个 `/api/calls` 请求**恰取一次**（无论 1 项还是 N 项），内容 = `{ nodes: (await queryOnce(config.socketPath,'router.status',{})).nodes, work: deriveAgentWork((await queryOnce(config.socketPath,'router.task_list',{})).tasks) }`；**取数失败（Router 不可达等）⇒ 视作空池**（不抛错、不新造 502）。
   〔追溯：A-06 第 1~2 条 + 「成本」条；契约 §2 的 `snapshot` 形状 + §0.3 实测偏差 F-5〕
8. **选择与回落（T1）**：逐项 `const target = pickInstance(role, { chatId, noReuse: item.newSession === true, snapshot }) ?? agentId;`（`agentId` = 既有 `instanceIdForRole(role)`，`:1342` 的既有 404 前置校验**逐字保留、位置不动**）；选中后 `tasks.set(callId, entry)` 的 `entry.agentId`、`db.insertInput({agentId})`、`publishMessage({agent_id})`、`composeCallEnvelope({to})`、自派发告警比较、`sendTask(target, …)` 全部改用 `target`。
   〔追溯：A-06 第 4~5 条（调用形状与替换落点）+ `pickInstance(role, {chatId, noReuse, snapshot})`；pr-002 契约 12〕
9. **在飞预留释放（T1）**：`try { await sendTask(target, …) } finally { poolRouting.release(target) }`（release 在 settle 处，成功/吞错两路都释放；未计数实例 release 为 no-op）。
   〔追溯：A-06 第 3 条 + 契约 §2 第 9 条；A4〕
10. **`new_session` 处置（T1）**：项模板加 `newSession: false`；仅 `raw.new_session === true` ⇒ `item.newSession = true`；其余取值（缺省 / `null` / `false` / 非布尔）**与缺省等价**，**不新增 400 分支**。单任务形态（`{task:…}` 顶层）与批量形态同层同语义。
    〔追溯：A-07「项级可选布尔字段」+ G01 验收 10 + §0.3 A8 实测基线；§5 MI-P6〕
11. **对账 TTL（T5）**：删除模块常量 `RECONCILE_TTL_DEFAULT_MS`（唯一引用点 `:2164`）；改为
    `const reconcileTtlMs = readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS);`
    不变式：**缺省 TTL ≥ `config.taskNetMs`**；env 覆盖优先级不变（`readPositiveMs` 语义不动）。
    〔追溯：A-05「生效位置清单」第 6 条（逐字算式）/ L2-05；contract 契约 §5 消费方要求〕
12. **role 列同源（T7）**：`/api/agents` 的 `role` 列改用 `roleOfPoolInstance(n.instance_id, roleFromInstanceId)`（`:673`）；其余列与取值域不变；`?state=online` 过滤口径不动。
    〔追溯：A-06 补定「必须消费同一函数」+ §9-10 已登记取值变化；PR AC9 末句〕
13. **文件面封闭（全任务）**：改动 = `oamp/src/web.js`（M）+ `oamp/src/pickup.js`（D）；零新增路由（`/api/docs` ⇒ 29）/零新增配置键/零新依赖/零新文件。

### 0.5 PR 验收标准 → 任务映射（10 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | 退役闭合：`pickup.js` 已删除、实现面 grep 零命中；两端点仍注册且行为可达 | **T6**（+ T2/T3 的三消费点迁移） |
| AC2 | 必达（不声明身份）+ 显式优先不双写 | **T2**（写入面）+ **T3**（读取面） |
| AC3 | 只写终态、同一 `call_id` 至多一条 | **T2** |
| AC4 | `reason` 落点：五值闭集、键追加在既有键之后、成功侧不带、三面同值同源 | **T4** |
| AC5 | 取件契约不变（键集键序、`acked` 恒 `false`、ack 幂等） | **T3** |
| AC6 | 跨重启：未 ack 终态重启后仍可查、信封一致 | **T3**（+ T2 的写入） |
| AC7 | 池化分流与粘性（含 `new_session`） | **T1** |
| AC8 | 空池与单实例（既有错误面逐字复用、不额外排队） | **T1**（判据按 §5 F-2 更正后的可判定形态） |
| AC9 | 既有面不回归（`new_session` 缺省、`/api/calls` 响应键集、`/api/agents` 投影与 role 列同源） | **T1**（`new_session` 面）+ **T3**（取件键序）+ **T7**（role 列同源）+ **T8**（集成对照） |
| AC10 | 对账联动：`RECONCILE_TTL` ≥ `config.taskNetMs`、env 覆盖仍生效 | **T5**（+ T8 动态核对） |

---

## 1. 任务列表

### T1: `web.js` —— `/api/calls` 池内选择接线（快照注入 + `new_session` + 在飞释放 + 空池回落）

- **服务哪条 AC**: AC7（主）、AC8（主）、AC9（`new_session` 缺省面）
- **描述**: 把 `/api/calls` 的目标解析从"角色↔实例 1:1 硬解析"改为"池内最空闲 + 同会话粘性"，并接入 pr-002 的工厂与 pr-001..004 之外的既有读数面（`router.status` + `router.task_list` + `deriveAgentWork`）。实现 §0.4 契约 7~10；**既有 404 前置校验（`:1342-1346`）逐字保留**，空池回落既有目标 ⇒ 既有投递路径与既有结论不变。
- **文件/锚点**: `oamp/src/web.js` —— import 区 `:43-44`；handler `:1342-1346`（不动）/ `:1380-1425`（项校验，加 `new_session`）/ `:1450-1486`（派发循环）；`startWeb` 局部量区 `:2098-2164`（新工厂与 `pickInstance`）；deps 注入 `:2457-2460`；`deriveAgentWork` `:214-233`（**同模块内调用，不需要导出**）。
- **步骤**:
  ① `import { createPoolRouting } from './pool-routing.js';`（`roleFromInstanceId` 已在 `:44` 引入）；
  ② `startWeb` 内（建议紧邻 `tasks` / `callSchemas` 声明处）`const poolRouting = createPoolRouting({ roleFromInstanceId });` 与 `const pickInstance = (role, opts) => poolRouting.choose(role, opts);`
  ③ `createApiRoutes({ …, pickInstance, poolRouting, … })`；`createApiRoutes` 形参表加同名两项（无默认值也可，见 A12 体例）；
  ④ handler 的项模板加 `newSession: false`；项校验里加 `if (raw.new_session === true) item.newSession = true;`（**不加 400 分支**）；
  ⑤ 全部校验通过后、派发循环前取一次快照（契约 7；`try/catch` ⇒ 失败置空 `{nodes: [], work: new Map()}`）；
  ⑥ 循环内按契约 8 算 `target` 并以 `target` 替换循环体内全部 `agentId` 用法（含 `entry.agentId`、`insertInput`、`publishMessage`、`composeCallEnvelope` 的受理态信封 `to`、自派发告警比较、`sendTask`）；
  ⑦ `try { await sendTask(target, …) … } catch (err) { … } finally { poolRouting.release(target); }`（既有 `catch` 体逐字保留）。
- **验收判据（可执行；脚本与构造见 §4，全部已用 `/tmp` 基线与桩**演练**过可判定性）**:
  1. **AC7.2 新会话选最空闲**：A（`pb-dev`）被加载（`queued ≥ 1`）后派发新 `chat_id` ⇒ 目标实例 = B（`pb-dev-2`）（观测：`GET /api/calls/<id>/transcript` 的 `from`）。
  2. **AC7.1 同会话粘性**：A/B 负载并列（tie）后，同一 `chat_id` 连派两轮 ⇒ 两轮目标**均为 B**（粘性优先于最空闲；若走最空闲会 tie-break 到 `pb-dev`）。
  3. **AC7.3 `new_session` 重选重绑**：tie 前提下对同一 `chat_id` 带 `new_session: true` ⇒ 目标 = A；紧随一次**不带**声明 ⇒ 仍 A（重绑生效）。
  4. **AC7.6 并发分流**：同一角色两实例 + 两个不同 `chat_id` 并发派发 ⇒ 两条落在**不同**实例（`queued` 增量分别落在 A 与 B）。
  5. **AC8（更正后口径）**：角色可解析但池内无在线实例 ⇒ 响应与迭代前**逐字一致**（200 + `submitted` 信封），不新造错误面、不排队；角色**不可解析**（`nosuch-role`）⇒ 404 `agent 不可用: nosuch-role（无对应在线实例）` 逐字（§4 形状指纹覆盖）；同角色**只有一个**在线实例 ⇒ 目标恒为该实例、不额外排队。
  6. **AC9（`new_session` 面）**：不传 `new_session` 时请求被接受且响应与基线逐字一致；`new_session: "yes"` 亦不报错（与基线同）。
  7. **快照成本与容错**：设备仅 1 项与 N 项请求时均只查 Router 两次（`router.status` + `router.task_list`）；停 Router 后 `POST /api/calls` 仍 200 + `submitted`（不得 502）。
- **前置依赖**: 无（pr-002 `pool-routing.js` 已合并于 `1b02689`）
- **优先级**: P0
- **追溯**: architecture §3.4 第 1~4 条 + §4 A-06（池成员/负载/次序键/调用形状/替换落点/空池行为）+ §4 A-07（`new_session` 承载）；prd/F06 验收 1/2/3/5、prd/F07 验收 1/2/3/5；PR AC7、AC8、AC9（`new_session` 面）；pr-002 契约 12。

---

### T2: `web.js` —— `call.principal` 派生 + 无条件写 `inbox`（唯一写点）

- **服务哪条 AC**: AC2、AC3
- **描述**: 在唯一派生点算出归属身份并落到 `call.principal`；把唯一终态发布点 `publishCallResult` 的取件写入从"仅显式 `requester`"改为**无条件**写 `inbox` 表（身份 = `call.principal`），`envelope` 预先序列化。
- **文件/锚点**: `oamp/src/web.js` —— `:1347-1357`（既有 `requester` 校验/登记，**不动**）、`:1443`（`call` 对象字段改名 + 新增 `principal` 局部量）、`:1486`（`warnings` 条件，**不动**）、`:2215-2240`（发布点）。
- **步骤**:
  ① 在 `requester` 校验之后加 `const principal = requester === null ? \`chat:${chatId}\` : requester;`（契约 3）；
  ② `:1443` 的 `call = { callId, role, chatId, requester, … }` ⇒ `principal`（值 = 上式）；确认全仓无第三处读 `call.requester`（A13）；
  ③ `publishCallResult`：删除 `if (call.requester !== null) { pickup.add({…}) }`，替换为契约 4 的 `db.insertInbox({…})`（无条件、`envelope` 已 `JSON.stringify`、位置在 `call.terminal` 之后）。
- **验收判据（可直接用 sqlite 只读查询判定，不依赖 T3）**:
  1. **AC2.1/2.3**：`mode=background` 且**不传** `requester` 的调用到达终态后，`SELECT COUNT(*) FROM inbox WHERE call_id=?` = **1** 且 `principal` = `chat:<chat_id>`。
  2. **AC2.1**：`GET /api/pickup?principal=chat:<chat_id>` 能取到该 `call_id`（HTTP 面判定，T3 落地后成立）。
  3. **AC2.2/2.4**：显式 `requester` ⇒ 行 `principal` = 该显式值；同一 `call_id` 在两张身份面上**合计恰一条**（不双写、不合并）。
  4. **AC3.1**：`submitted` / `working` 阶段（静默目标构造）⇒ `COUNT(*)` = **0**，且取件面为空。
  5. **AC3.2/3.3**：终态后 `COUNT(*)` = 1；随后触发同一调用的再次收口（`POST /api/calls/<id>/cancel`）⇒ 仍 = 1（`INSERT OR IGNORE` + `call.published` 幂等）。
  6. **落库形态**：`SELECT envelope FROM inbox WHERE call_id=?` 是**合法 JSON 字符串**（`JSON.parse` 成功、键序 = 契约 1 的键序），**不是** `[object Object]`（契约 §4 实测偏差 ① 的守门判据）。
- **前置依赖**: 无（pr-003 的 `insertInbox` 已合并；判据 2 在 T3 落地后复跑）
- **优先级**: P0
- **追溯**: architecture §3.1 第 1~2 条 + §4 A-01（写入点/写入时机/按身份过滤）+ A-02（派生点/承载/合流）；契约 §4（含 envelope 预序列化义务）；prd/F01 验收 1/3/4/5、F02 验收 1/2/3/4；PR AC2、AC3。

---

### T3: `web.js` —— 取件两端点改读写 `inbox`（不再依赖 Router 任务表）

- **服务哪条 AC**: AC5、AC6（+ AC1 的读/删侧 + AC9 的取件键序面）
- **描述**: `GET /api/pickup` 改为 `db.listInbox(principal)` 并映射成**逐字不变**的条目形状（不再逐条 `router.task_get`、不再现算信封）；ack 改为 `db.deleteInbox(call_id)`。副作用（**预期改进，登记备查**）：取件面不再因 Router 不可达而 502（§0.3 A9 基线 = 502）。
- **文件/锚点**: `oamp/src/web.js` —— GET handler `:1626-1643`（`pickup.listByRequester` `:1637` / `task_get` `:1638` / `envelope` 现算 `:1640`）；ack handler `:1793-1800`（`pickup.ack` `:1799`）；两处的 `principal`/`epoch` 校验与 `principals.touch` **逐字不动**。
- **步骤**: ① GET：`const rows = db.listInbox(principalId);` → `const result = rows.map((row) => ({ …契约 5 的 7 键映射… }))` → `sendJson(res, 200, { pickup: result })`；② 删除该 handler 内的 `queryOnce(...)` 与 `composeCallEnvelope(...)` 调用（若 `callSchemas` 在本 handler 不再使用，**不要**顺手删全局声明——其它 handler 仍在用）；③ ack：`db.deleteInbox(params.call_id)`。
- **验收判据（可执行）**:
  1. **AC5.0/5.1**：未 ack 终态调用 ⇒ `GET /api/pickup?principal=<p>` 返回 1 条；`Object.keys(entry)` **逐字等于** `["call_id","requester","agent","chat_id","terminal_at","acked","envelope"]`；`acked === false`。
  2. **AC5.2**：`POST /api/pickup/<call_id>/ack?principal=<p>` ⇒ `{"call_id":…,"acked":true}`；二次同响应（幂等）；ack 后该条目不在未取件集合；ack 未知 id ⇒ 同样 200 `{…,acked:true}`。
  3. **AC2.1/F01 验收 5 同源**：同一条目的 `envelope` 与 `GET /api/calls/<id>` 的信封 `JSON.stringify` 相等。
  4. **AC6 跨重启**：终态后**不 ack** ⇒ 重启 web 进程 ⇒ 同一身份再取件仍取到同一条 `call_id` 且信封**逐字一致**（含 `envelope` 内 `reason`）。
  5. **Router 不可达**：停 Router 后 `GET /api/pickup?principal=<有未取件条目的身份>` ⇒ **200** 且返回 DB 中的条目（基线 502 ⇒ 本判据是"预期变化"的正向断言，见 §5 事实更正 F-4）。
  6. **AC1 端点存活**：`/api/docs` 仍含 `GET /api/pickup` 与 `POST /api/pickup/:call_id/ack`（路由数 29）。
- **前置依赖**: **T2**（判据 1/3/4 需要写入面先成立；代码上无 import 依赖）
- **优先级**: P0
- **追溯**: architecture §3.1 第 3~4 条 + §4 A-01「响应形状零变化」/ A-09（ack = 就地删除）；契约 §4 消费方要求；prd/F03 验收 1/2/4/5、F01 验收 6、F02 验收 1；PR AC5、AC6、AC1。

---

### T4: `web.js` —— `composeCallEnvelope` 失败侧追加 `reason`

- **服务哪条 AC**: AC4
- **描述**: 在既有唯一信封构造点内，`state === 'failed'` 时把 `reasonOf(state, error)` 作为**最后一个键**追加；成功/受理侧键集不变。
- **文件/锚点**: `oamp/src/web.js:539-558`（函数体；`return {…}` 为 10 键字面量）；import 区 `:36-44`。
- **步骤**: ① `import { reasonOf } from './reason.js';`；② 把 `state` 提到局部量 `const state = invalid ? 'failed' : task.state;`（`return` 内引用同一量）；③ 构造 10 键对象为 `const envelope = { … }`；④ `if (state === 'failed') envelope.reason = reasonOf(state, envelope.error);`（**用 `envelope.error`**，即 strict 覆写后的值）；⑤ `return envelope;`。
- **验收判据（可执行；六种源串 + 覆写路径 + 键位 + 三面同源，全部已演练可判定）**:
  1. **AC4.1/4.2 五值可达**：`error='cancelled'` ⇒ `cancelled_by_client`；`error='context_crashed'` ⇒ `infra_error`；`state='failed'` 且 `error` 缺失 ⇒ `agent_error`；`error='timeout'` / `error='timeout_after_1200ms'` ⇒ `timeout`；`error='permission_denied'` ⇒ `rejected`；**strict 覆写**（`state=completed` 但结构未过 ⇒ `failed` + `structured_output_invalid`）⇒ `rejected`。
  2. **AC4.1 闭集**：任何 `failed` 信封的 `reason` ∈ 五值闭集且非空（不存在缺键/空值/枚举外值）。
  3. **AC4.6 键序**：`failed` ⇒ `Object.keys(envelope)` **逐字等于** 既有 10 键 + `"reason"`（末位）；`completed` / `submitted` ⇒ **逐字等于**既有 10 键（无 `reason` 键，`Object.hasOwn` 为 false）。
  4. **AC4.3 三面同值同源**：同一终态调用的 `GET /api/calls/<id>` 信封、`GET /api/pickup` 条目内 `envelope`、SSE `call_result` 帧 `data`（= `{chat_id, ...envelope}`）三处 `reason` 相等且帧内 `reason` 为末键。
  5. **既有面**：`error` 键位/拼写/取值形态逐字不变（`cancelled` / `context_crashed` / `timeout` 原文保留）；`call.terminal` 仍为 `{state, error}`（不加字段）。
- **前置依赖**: 无（pr-001 `reason.js` 已合并）
- **优先级**: P0
- **追溯**: architecture §3.1、§4 A-03/A-04 + §5（web.js 第 ② 项）+ §9-9；契约 §1（键位意图 + 唯一消费点）；prd/F04 验收 1/2/3/5/7、F05 验收 6；PR AC4。

---

### T5: `web.js` —— 对账登记软 TTL 默认值与 `config.taskNetMs` 联动

- **服务哪条 AC**: AC10
- **描述**: 消除"登记 30 分钟被清理 ⇒ 4 小时长任务终态在 `handleDeliver` 查不到 `entry` 被丢弃 ⇒ 永不发布"（F01 必达的隐性破坏）。缺省 TTL 改为 `config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS`；env 覆盖语义不变。
- **文件/锚点**: `oamp/src/web.js:76`（常量）、`:2162-2164`（三个 `readPositiveMs`）、`:2286-2289`（清理与日志行）。
- **步骤**: ① 删除 `RECONCILE_TTL_DEFAULT_MS` 常量（A10：唯一引用点 `:2164`；删后 `grep -n RECONCILE_TTL_DEFAULT_MS` 零命中）；② `:2164` 改为 `readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS)`；③ 注释按 A-05 清单第 6 条改写（`taskNetMs + 30s`，取代"与 agent 侧 30 分钟持平，待优化"）。
- **验收判据（可执行）**:
  1. **AC10 静态**：`grep -c RECONCILE_TTL_DEFAULT_MS oamp/src/web.js` = 0；`:2164` 的 fallback 表达式含 `config.taskNetMs` 与 `RECONCILE_SLOW_DEFAULT_MS`。
  2. **AC10 动态（压缩取证，已演练）**：`OAMP_TASK_NET_MS=1000` + **不设** `OAMP_WEB_RECONCILE_TTL_MS` + `OAMP_WEB_RECONCILE_INTERVAL_MS=200` / `OAMP_WEB_RECONCILE_SLOW_MS=200`，对一个**静默**目标派发调用 ⇒ 约 31s 后 stderr 出现 `对账登记超时清理 task=<id>（31s 未终态）`（= `toSec(1000 + 30000)`）。基线实测：同名场景 38s 后**无**该行（TTL 仍 1800s）⇒ 判据可判定。
  3. **AC10 覆盖仍生效**：另设 `OAMP_WEB_RECONCILE_TTL_MS=5000` ⇒ 清理行的秒数随之变（≈5s）；`OAMP_WEB_RECONCILE_TTL_MS=0/-1/abc` ⇒ 回落算式值（`readPositiveMs` 既有语义，不改）。
  4. **不变式**：缺省 TTL ≥ `config.taskNetMs`（构造性：算式含 `taskNetMs` 且 `RECONCILE_SLOW_DEFAULT_MS > 0`）。
- **前置依赖**: 无（pr-004 `config.taskNetMs` 已合并）
- **优先级**: P0
- **追溯**: architecture §4 A-05「生效位置清单」第 6 条（逐字算式）+ §7 L2-05 + §9 一致性检查（F05 × F03）+ §5（web.js 第 ⑥ 项）；契约 §5 消费方要求；prd/F05 验收 7、F01 验收 1/3；PR AC10。

---

### T6: 退役 `oamp/src/pickup.js`（三消费点迁移闭合 + 删文件）

- **服务哪条 AC**: AC1
- **描述**: 三个消费点（`publishCallResult` / `GET /api/pickup` / ack）在 T2/T3 迁完后，删除模块与 import，闭合退役。
- **文件/锚点**: `oamp/src/web.js:43`（import）；`oamp/src/pickup.js`（删除）；消费点 `:1637 / :1799 / :2224`（T2/T3 已替换）。
- **步骤**: ① 删除 `import * as pickup from './pickup.js';`；② 删除文件 `oamp/src/pickup.js`（无 re-export、无兼容层）；③ 停 Router 后取件仍 200（T3 判据 5）—— 佐证"不再依赖任务表**且**不再依赖进程内表"。
- **验收判据（可执行）**:
  1. **AC1 grep 零命中**：`grep -rn "pickup\.js\|pickup\.add\|pickup\.ack" . --exclude-dir={docs,roles,.pb-agents,node_modules}` = **0 行**（实测基线 = 4 行：`web.js:43/1799/2224` + 模块头注；口径与残留见 §5 事实更正 F-8）。
  2. **AC1 端点仍在**：`/api/docs` 含 `GET /api/pickup` 与 `POST /api/pickup/:call_id/ack`，路由总数 **29**（不新增不减少）。
  3. **AC1 行为可达**：T3 的判据 1~3 全 PASS（读取/确认两端点在无 `pickup.js` 的树上工作）。
  4. **改动面封闭**：`git diff --name-status 1b02689 -- oamp/` ⇒ 恰 `M oamp/src/web.js` + `D oamp/src/pickup.js`。
- **前置依赖**: **T2**、**T3**（两处的 `pickup.*` 调用必须先迁走，否则中间态不可构建）
- **优先级**: P0
- **追溯**: architecture §4 A-01「退役 `src/pickup.js`」+ §5「退役（1 个文件）」+ §7 L2-01 + §8（拒绝保留二层包装的理由）；契约 §6 第 4 行（消费方 = pr-008 G01 验收）；PR AC1。

---

### T7: `web.js` —— `/api/agents` 的 `role` 列与池成员判定同源（含 `roleOfInstance` 口径裁决）

- **服务哪条 AC**: AC9（role 列同源 + 已登记取值变化）
- **描述**: 池成员判定（`pool-routing.js` 内部）与 `/api/agents` 的 `role` 列**必须**消费同一 `roleOfPoolInstance`（A-06 补定的硬要求）；否则出现"能进池但 role 列显示 `null`"的自相矛盾，直接损害 F06 验收 5 的可观测性。
- **文件/锚点**: `oamp/src/web.js:673`（`withRole` 的 `role:`）；`:444-446`（`roleOfInstance`，见判据 3）；`:44`（`roleFromInstanceId` 已引入）。
- **步骤**: ① `:673` ⇒ `role: roleOfPoolInstance(n.instance_id, roleFromInstanceId)`（`roleOfPoolInstance` 从 `./pool-routing.js` 具名 import，与 T1 同一行 import 可合并）；② 判据 3 的口径按主 agent 对 §5 MI-P7 的裁决落（裁决前**不**改 `:444-446`）。
- **验收判据（可执行）**:
  1. **AC9 role 列**：`GET /api/agents` 中 `pb-dev-2` 的 `role` = `"dev"`（基线 `null`）；`pb-dev` 仍 `"dev"`；`web` 行仍 `null`（不可解析者仍为 `null`）。
  2. **AC9 其余列不变**：行键序逐字 = `["instance_id","session_id","state","last_heartbeat","connected","role","busy","current_call_id","queued","since"]`；`?state=online` 过滤计数与口径不变；非 `pb-*` 节点取值域不变。
  3. **（MI-P7，待裁决）`roleOfInstance` 是否同源**：若采纳"`:444-446` 体亦改用 `roleOfPoolInstance(instanceId, roleFromInstanceId)`"，则**池内命中 `pb-<role>-<n>`** 的调用其信封 `agent` 字段为角色名（非 `null`），且对既有 `pb-<role>` 形态**零取值变化**（精确公式优先，实测可判定：`roleOfPoolInstance('pb-dev', roleFromInstanceId) === 'dev'`、`roleOfPoolInstance('pb-dev-2', …) === 'dev'`）。裁决前本判据**不生效**（判据 1/2 无条件生效）。
- **前置依赖**: 无（pr-002 已合并）
- **优先级**: P0
- **追溯**: architecture §4 A-06 补定（「落点与同源要求」条 + §9-10 已登记取值变化）+ §3.4 第 6 条（可观测性）；prd/F06 验收 5、F07 验收 5；PR AC9 末句。

---

### T8: 集成自证（既有面不回归对照 + 六处接线闭合 + 路由数 + TTL 动态核对）

- **服务哪条 AC**: AC9（整体）、AC10（动态）、AC1（端点存活）＋ PR「已知代价」的可审查性补偿
- **描述**: 用一次性脚本与只读命令，对**已完成**的改动做四类机械判定：① **形状指纹对照**（基线 `git archive HEAD oamp` 副本 vs 改造后，同一脚本、同一输入 ⇒ diff 只允许 3 处已登记差异）；② 全量 e2e 断言复跑（AC2~AC8）；③ 跨重启（AC6）；④ 改动面封闭性 + 路由数 + `pickup.js` 退役 grep + TTL 日志动态核对。
- **文件/锚点**: 零源码改动（只读）；脚本与原始输出落 `/tmp/0030-pr-005/`。
- **步骤**: 见 §4 的 §4.1~§4.6（逐条命令可直接复制的配方）。
- **验收判据（可执行）**:
  1. **AC9 形状指纹**：`diff shape-baseline.out shape-post.out` 的差异**恰为**下面 3 行块（其余逐字相同）：
     `agents.roles`（`pb-dev-2=null` → `pb-dev-2=dev`）；`calls.terminal.failed.keys`（10 键 → 10 键 + `reason`）；`calls.terminal.failed.json`（多 `reason`）。
     ⇒ 其余全部面（`routes.count`/`routes.methods+paths`/`calls.noRequester.*`/`calls.explicitRequester.*`/`agents.row.keys`/`agents.online.filter.count`/`agents.badState`/`pickup.*` 形状与 `ack.*`/`calls.*.text` 各既有错误文案）**逐字不变**。
     （**已演练**：指纹脚本两次运行 diff 为空 ⇒ 该 diff 有意义；基线指纹全文见 §4.4 摘录。）
  2. **AC2~AC8 e2e**：§4.3 脚本在改造后的树上**全 PASS**（基线运行结果 = 19 PASS / 26 FAIL，FAIL 集合恰为 PR 应翻转的面，见 §4.3 末）。
  3. **AC6 跨重启**：`restart-check.mjs` 两阶段 ⇒ PASS（基线 FAIL）。
  4. **AC1/AC9 封闭性**：§4.1 的静态核查全绿（路由 29、`pickup.*` 零命中、`RECONCILE_TTL_DEFAULT_MS` 零命中、`reason.js`/`pool-routing.js` 已 import、diff 恰 2 个文件）。
  5. **AC10 动态**：§4.5 的 TTL 日志核对按预期出现（≈31s 清理行）且 env 覆盖可控。
- **前置依赖**: T1、T2、T3、T4、T5、T6、T7（任一未完成则该类判据必失败）
- **优先级**: P1（**P1 ≠ 可选**：本 PR 的"自证"与既有面零回归对照是 dev 的交付物）
- **追溯**: PR AC9/AC10 + PR「已知代价（可审查性）」（单文件七卡接线无法再拆 ⇒ 以机械对照面补偿）；architecture §6（零影响声明逐条对 G01 验收 1~12）；契约 §6（pr-005 需提供给下游的接缝）；A15（无测试先例 ⇒ 自证 = 一次性脚本 + 只读命令）。

---

## 2. 依赖图

```
T1 ─────────────────────────────┐
T4 ─────────────────────────────┤
T5 ─────────────────────────────┤
T7 ─────────────────────────────┼──> T8
T2 ──> T3 ──> T6 ───────────────┘
```

边（逐条，均为真实约束；共 8 条）：
- `T2 → T3`：AC3 的写入面（`insertInbox`）是 AC6「跨重启仍可查」与 AC5 判据 1/3 的前提（无写入 ⇒ 无条目可读）；且 T3 的 handler 改写删除对 `task_get` 的依赖，须与写入面同源（同一 `envelope`/`principal` 口径）。
- `T3 → T6`：`pickup.*` 的读/删两个调用点必须在 T3 迁走后才能删模块（PR 文件明文"退役与三个消费点在同一 PR，否则中间态不可构建"）。
- `T2 → T6`：`pickup.add` 的写入点必须在 T2 迁走后才能删模块。
- `T1 → T8`、`T4 → T8`、`T5 → T8`、`T7 → T8`、`T6 → T8`：T8 的四类判据分别覆盖池化/信封/对账/role 列/退役面，任一未完成则对应判据必失败。

**无环**：全部边方向均为"小号 → 大号"（`T2<T3<T6<T8`、`T1<T4<T5<T7<T8`）⇒ 拓扑序 `T1, T2, T3, T4, T5, T6, T7, T8` 满足全部边，不存在回到已访问节点的路径。

**最长依赖链（= 本 PR 内部关键路径，4 节点）**：`T2 → T3 → T6 → T8`。
**关键路径任务**：**T2**（`call.principal` + 唯一写点 = 必达/持久化的唯一生产者）→ **T3**（取件读写面 = AC5/AC6 的唯一判据面）→ **T6**（退役闭合 = AC1 的唯一判据面）→ **T8**（形状指纹对照 + 全量复跑 = 阶段 6 verifier 的输入）。

**并行友好性**：T1 / T4 / T5 / T7 四条与关键路径**无相互依赖**，可与 T2/T3 并行推进（同一文件的不同区域；若单人执行则按 §3 顺序）。

---

## 3. 执行顺序与增量策略

**顺序**：`T1 → T4 → T5 → T7 → T2 → T3 → T6 → T8`（同文件连续施工；先做"低耦合、判据可立即观测"的四条，再做"写入→读取→退役"的关键链，最后集成自证）。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立留证）：

| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | T1：池内选择接线（工厂 + 快照 + `new_session` + release + 回落） | §4.3 的 AC7/AC8 段 + §4.4 指纹的 `agents`/`calls` 面（`new_session` 缺省） |
| 2 | T4：`reason` 追加 | §4.3 的 AC4 段（含三面同源） |
| 3 | T5：TTL 联动 | §4.5 的 TTL 日志核对 |
| 4 | T7：role 列同源 | §4.3 的 AC9.2 段 + §4.4 指纹 `agents.roles` 行 |
| 5 | T2：`principal` + 无条件写 inbox | §4.3 的 AC2/AC3 段（DB 面判据） |
| 6 | T3：取件读写面 | §4.3 的 AC5 段 + §4.6 跨重启 |
| 7 | T6：退役 | §4.1 的 grep 族 + 改动面封闭性 |
| 8 | T8：形状指纹对照 + 全量复跑 | §4.2~§4.6 全部 |

**若单次调用未跑完**：按**任务边界**停下（不得交付"写了 inbox 但取件仍读内存表"却声称完成；T6 必须在 T2/T3 之后，中间态不视为完成态）。已完成任务的判据输出即为本次调用的增量产物。

---

## 4. 验证配方（**禁止新增仓库内测试文件**，A15；全部为一次性脚本 + 只读命令，落 `/tmp/0030-pr-005/`）

> **本配方已用一份 `/tmp` 的**基线副本（`1b02689` 的 `oamp/`）**完整演练**：`fake-agent.mjs` + `verify.mjs` + `shape.mjs` + `restart-check.mjs` + `driver.sh` 均实跑通过，基线判定为 **19 PASS / 26 FAIL**（FAIL 集合恰为 PR 应翻转的面），指纹脚本两次运行 diff 为空 ⇒ **判据的可判定性已前置证明**。dev 只需让**改造后的树**通过同一批脚本。

### 4.0 环境与前置（冻结，避免"跑法不同导致结论不同"）

```bash
PRWT=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-005-web-inbox-and-pool-wiring
BASE=/tmp/0030-pr-005                      # 取证根（不入库）
PORT=17911
# ① 基线副本（用 git 取 HEAD 版本，避免手工拷贝被"改造后"污染）：
rm -rf "$BASE/base" && mkdir -p "$BASE/base"
git -C "$PRWT" archive HEAD oamp | tar -x -C "$BASE/base"        # ⇒ $BASE/base/oamp（= 1b02689 的代码）
# ② 改造后副本（e2e 一律在副本上跑，保证 PR worktree 只留源码改动、不留 .runtime/roster.json）：
rm -rf "$BASE/post" && mkdir -p "$BASE/post" && cp -R "$PRWT/oamp" "$BASE/post/oamp"
# ③ 脚本（§4.2/§4.3/§4.4/§4.6 原文）放 "$BASE/base/"（宿主目录，与两份副本解耦）；脚本内 OAMP 路径按 OAMP_COPY 环境变量取
```

> **为何在 `/tmp` 副本上跑**：web 进程会把 `roster.json` 写到 `PKG_ROOT/.runtime/`（`web.js:ROSTER_FILE`，**不在 `.gitignore` 内**）；在 PR worktree 内直跑会留下未跟踪文件，污染 §4.1 的改动面封闭性核查。用 `OAMP_ROLE_ROOT="$PRWT"` 让角色文件解析仍指向真 worktree（只读）。
> `driver.sh` 每次 `reset` 会重建 DB 并重启进程 —— AC7 的"负载并列（tie）"决定性用例依赖初始任务表为空，**必须**从 reset 态开始跑。

### 4.1 静态核查（T6 / T5 / T1 / T7 / T8 判据）

```bash
cd "$PRWT"
{
  echo "== 路由数（须 29）=="; awk '/function createApiRoutes/,0' oamp/src/web.js | grep -cE "method: '(GET|POST|PUT|DELETE)'"
  echo "== pickup 退役（实现面须 0 行）=="; grep -rn "pickup\.js\|pickup\.add\|pickup\.ack" . --exclude-dir=docs --exclude-dir=roles --exclude-dir=.pb-agents --exclude-dir=node_modules || echo "(无)"
  echo "== 取件两端点仍在（须各 1 命中）=="; grep -c "path: '/api/pickup'" oamp/src/web.js; grep -c "path: '/api/pickup/:call_id/ack'" oamp/src/web.js
  echo "== TTL 常量已删（须 0）与算式（须 1）=="; grep -c "RECONCILE_TTL_DEFAULT_MS" oamp/src/web.js; grep -n "readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS'" oamp/src/web.js
  echo "== 新 import（须各 1）=="; grep -n "from './reason.js'\|from './pool-routing.js'" oamp/src/web.js
  echo "== reason 的唯一来源（web.js 内不得出现归类字面量）=="; grep -n "cancelled_by_client\|infra_error\|'rejected'\|structured_output_invalid" oamp/src/web.js
  echo "== 改动面（须 恰 M web.js + D pickup.js）=="; git diff --name-status HEAD -- oamp/
  echo "== 未跟踪面（须空）=="; git status --short
} | tee "$BASE/R1-static.out"
```
**期望**：29；0 行；各 1；0 / 1 行；各 1；只命中既有文案（`structured_output_invalid` 出现在 `composeCallEnvelope` 的覆写与既有注释里，**不得**出现 `cancelled_by_client` / `infra_error` / `'rejected'`）；`M oamp/src/web.js` + `D oamp/src/pickup.js`；`(空)`。

### 4.2 一次性假节点（`$BASE/base/fake-agent.mjs` 原文；供多次驱动复用）

```js
// 按 task.request 的 prompt 里的 MODE=<x> 决定回什么终态（真 Router + 真 web，无 LLM）。
// 用法：node fake-agent.mjs <instance_id> <socketPath>
const { NodeClient } = await import(`file://${process.env.OAMP_COPY}/src/node-client.js`); // 实际原文：动态 import，OAMP_COPY = $BASE/base/oamp 或 $BASE/post/oamp
const id = process.argv[2], socketPath = process.argv[3];
const c = new NodeClient({ socketPath });
const RESULT = {
  completed: () => ({ state: 'completed', text: '{"a":1}', duration_ms: 7, model: 'probe/model', exit_code: 0 }),
  cancelled: () => ({ state: 'failed', error: 'cancelled', duration_ms: 7 }),
  infra: () => ({ state: 'failed', error: 'context_crashed', duration_ms: 7 }),
  nokey: () => ({ state: 'failed', duration_ms: 7 }),
  timeout: () => ({ state: 'failed', error: 'timeout', duration_ms: 7 }),
  timeout_param: () => ({ state: 'failed', error: 'timeout_after_1200ms', duration_ms: 7 }),
  rejected: () => ({ state: 'failed', error: 'permission_denied', duration_ms: 7 }),
  badjson: () => ({ state: 'completed', text: 'not json at all', duration_ms: 7, model: 'probe/model', exit_code: 0 }),
};
c.onDeliver = async (m) => {
  if (m.type !== 'task.request') return true;
  const body = JSON.parse(m.payload.body);
  const mode = (/MODE=([a-z_]+)/.exec(body.prompt || '') || [])[1] || 'completed';
  console.log(`GOT task_id=${m.task_id} mode=${mode}`);
  if (mode === 'silent') return true;                       // 永不回终态 ⇒ 用于"加载实例"与"非终态不写 inbox"构造
  const result = (RESULT[mode] || RESULT.completed)();
  await c.send('web', { protocol: 'oamp/1', message_id: `m-${crypto.randomUUID()}`, task_id: m.task_id,
    type: 'task.result', payload: { content_type: 'application/json', body: JSON.stringify(result) } });
  console.log(`SENT task_id=${m.task_id} state=${result.state} error=${result.error ?? 'null'}`);
  return true;
};
await c.connect();
console.log(`REGISTERED ${id}`, (await c.register(id)).session_id);
c.startHeartbeat(3000);
```
（实测原文：`/tmp/0030-pr-005/base/fake-agent.mjs`，42 行；`import` 行用 `file://${process.env.OAMP_COPY}/src/node-client.js` 动态解析，`OAMP_COPY` ∈ {`$BASE/base/oamp`, `$BASE/post/oamp`}。）

**驱动**（`$BASE/base/driver.sh`，33 行；`reset|start|stop`）：`reset` = `stop` + 删 DB + 建库造 11 个判定用对话（`chat-verify-1..5` / `chat-load` / `chat-load2` / `chat-sticky` / `chat-conc-1..2` / `chat-restart`）；`start` = 起 Router（`OAMP_SOCKET=$BASE/runtime/router.sock`）→ 起 web（`OAMP_DB=$BASE/hub.db`、`OAMP_WEB_PORT=17911`、`OAMP_ROLE_ROOT=$PRWT`）→ 起两个假节点 `pb-dev` / `pb-dev-2`；`stop` = 按 pid 文件逐个 kill。脚本把 `OAMP_COPY` **导出**给子进程（假节点用它解析 `node-client.js` 的 `file://` 路径）⇒ 调用形态 `OAMP_COPY=$BASE/post/oamp OAMP_ROLE_ROOT=$PRWT sh driver.sh start`。**原始脚本已实跑验证**（见 §4.3/§4.6 的基线输出）。

### 4.3 e2e 判据脚本（`$BASE/base/verify.mjs`，219 行；判据编号与 §1 各任务一一对应）

结构（原文见 `/tmp/0030-pr-005/base/verify.mjs`，dev 可直接复用；下文给出各段判定式，逐条可复制执行）：

| 段 | 断言（节选） | 判定式 |
|---|---|---|
| AC9.1 | 响应键集 | `Object.keys(noRequesterBody) === ["calls"]`；`Object.keys(explicitBody) === ["calls","warnings"]`；受理态信封 `Object.keys(...) === 既有 10 键` |
| AC9.2 | `/api/agents` | 行键序逐字；`pb-dev.role === 'dev'`；`pb-dev-2.role === 'dev'`（基线 `null`） |
| AC9.4 | 路由数 | `(await GET /api/docs).routes.length === 29` |
| AC8.1 | 角色不可解析 | 响应文本逐字 `{"error":"agent 不可用: nosuch-role（无对应在线实例）","code":"NOT_FOUND"}` |
| AC3.1 | 非终态不写 | 静默目标派发后 `COUNT(*) FROM inbox` = 0 且取件面空 |
| AC2.1/2.2/2.3/2.4 | 必达 + 显式优先 | 缺省身份面含该 `call_id`；显式面含、缺省面**不含**（不双写）；条目 `envelope` === `/api/calls/<id>` 信封 |
| AC3.2/3.3 | 至多一条 | 终态后 `COUNT(*)` = 1；再 `POST /api/calls/<id>/cancel` ⇒ 仍 = 1 |
| AC5.0~5.3 | 取件契约 | 条目键序逐字 7 键；`acked === false`；ack 响应/幂等/移出未取件集合；ack 未知 id ⇒ `{acked:true}` |
| AC4.1/4.2/4.6 | 五值 + 键序 | 六种源串 ⇒ 期望枚举；`Object.keys(failed) === [...既有10键, 'reason']`；`Object.keys(completed)` = 既有 10 键且 `!hasOwn('reason')` |
| AC4.2 | strict 覆写 | `badjson` + `schema_mode:'strict'` ⇒ `state='failed'` / `error='structured_output_invalid'` / `reason='rejected'` |
| AC4.3 | 三面同源 | 先开 `GET /api/calls/stream?chat_id=…`，派发后抓 `event: call_result` 帧 ⇒ `frame.reason === /api/calls/<id>.reason === pickup.envelope.reason` |
| AC7.1/7.2/7.3/7.6 | 池化 | 目标识别：`transcript.from`（有终态条目）或 `/api/agents` 的 `queued` 增量（静默目标）；构造与期望见 §1 T1 判据 1~4 |
| 相位 | 装载构造 | `MODE=silent` 的调用让目标实例 `queued ≥ 1`（经既有 `deriveAgentWork` 投影可见），用作"两实例负载并列/不并列"的唯一可控旋钮 |

**基线运行结果（实测，`/tmp/0030-pr-005/base/verify-baseline.out`，共 45 条断言）**：

```
PASS=19  FAIL=26   RESULT: FAIL (26)
PASS 集合 = AC9.1(3) / AC9.4(1) / AC9.2(2：行键序 + pb-dev role=dev) / AC8.1(1) / AC3.1(2) /
           AC2.2(2) / AC5.1(2) / AC5.2(3) / AC5.3(1) / AC4.6 completed 无 reason(1)
FAIL 集合 = AC2.1(1) / AC2.4(1) / AC3.2(1) / AC3.3(1) / AC5.0(1) / AC4.1+4.6(12) / AC4.2 strict(1) /
           AC4.3(2) / AC7(6) / AC9.2 pb-dev-2 role(1)
```
⇒ **FAIL 集合恰为 PR 应翻转的面**（必达/持久化/reason/池化/role 列），**PASS 集合恰为必须保持不变的既有面**（响应键集、行键序、既有错误文案、取件条目键序与 ack 语义、成功侧无 `reason`）。

### 4.4 形状指纹对照（AC9 的整体判据；`$BASE/base/shape.mjs`，58 行）

```bash
cd "$BASE/base"
# 基线（用 base 副本）：driver.sh reset/start（OAMP_COPY=$BASE/base/oamp）→ 跑指纹
node shape.mjs --base http://127.0.0.1:$PORT > "$BASE/shape-baseline.out"
# 改造后（用 post 副本）：driver.sh reset/start（OAMP_COPY=$BASE/post/oamp）→ 跑指纹
node shape.mjs --base http://127.0.0.1:$PORT > "$BASE/shape-post.out"
diff "$BASE/shape-baseline.out" "$BASE/shape-post.out" | tee "$BASE/R4-shape.diff"
```
**期望 diff（恰这 3 行块，其余逐字相同）**：
```
<   ["pb-dev-2=null","pb-dev=dev","web=null"]          # agents.roles
>   ["pb-dev-2=dev","pb-dev=dev","web=null"]
<   ["call_id",…,"error","exit_code"]                  # calls.terminal.failed.keys（10 键）
>   ["call_id",…,"error","exit_code","reason"]         # + reason（末位）
<   {…"error":"cancelled","exit_code":null}            # calls.terminal.failed.json
>   {…"error":"cancelled","exit_code":null,"reason":"cancelled_by_client"}
```
**已演练**：基线指纹连续两次运行 `diff` **为空** ⇒ 指纹对时间戳/`call_id` 已归一化、可 diff（本项即"判据可判定"的直接证据）。指纹覆盖面：`routes.count`(29) / `routes.methods+paths` / `routes.calls.params` / `calls.noRequester.body.keys+envelope` / `calls.explicitRequester.body.keys+warnings` / 终态信封 / `agents.row.keys` / `agents.roles` / `agents.online.filter.count` / `agents.badState` 文案 / `pickup.*`（status/body 键/条目键序/空态/参数校验文案/epoch 文案）/ `ack.*`（三态）/ 既有 4 条错误文案。
**注意**：`pickup` 在 Router 不可达时由 502 变 200 属**预期变化**（§5 F-4），**不在**本指纹内（指纹在 Router 正常时取样），单独按 T3 判据 5 断言。

### 4.5 TTL 联动动态核对（AC10；T5 判据 2/3）

```bash
BASE=/tmp/0030-pr-005; PORT=17911
# 用 post 副本 + 压缩 env 起一套（不设 OAMP_WEB_RECONCILE_TTL_MS）：
OAMP_COPY=$BASE/post/oamp OAMP_TASK_NET_MS=1000 OAMP_WEB_RECONCILE_INTERVAL_MS=200 OAMP_WEB_RECONCILE_SLOW_MS=200 sh "$BASE/base/driver.sh" reset
# （driver 的 start 需把这三个 env 透传给 web；实操时直接在 start 前 export）
curl -s -X POST http://127.0.0.1:$PORT/api/calls -H 'content-type: application/json' \
  -d '{"chat_id":"chat-load","agent":"dev","tasks":[{"task":"probe MODE=silent"}]}'
sleep 38; grep -n "对账登记超时清理" "$BASE/logs/web.log" | tee "$BASE/R5-ttl.out"
```
**期望**：出现 `oamp web: 对账登记超时清理 task=<id>（31s 未终态）`（`toSec(1000 + 30000)`）。
**基线实测**：同样压缩（`OAMP_TASK_NET_MS=1000` + 间隔 200ms）、38s 后**无**该行（TTL 仍 1800s）⇒ 该判据能区分"未联动/已联动"。
**反例门（必须显式核对）**：设 `OAMP_WEB_RECONCILE_TTL_MS=5000` ⇒ 清理行秒数随之变（≈5s）⇒ 证明 env 覆盖仍生效。

### 4.6 跨重启（AC6；T3 判据 4）

```bash
BASE=/tmp/0030-pr-005; PORT=17911
node "$BASE/base/restart-check.mjs" --phase save    --base http://127.0.0.1:$PORT --chat chat-restart --mode explicit
kill "$(cat "$BASE/logs/web.pid")"; sleep 1        # 只重启 web（Router 存活；Router 重启会清任务表，属另一场景）
# 重新起 web（同 OAMP_* env）后：
node "$BASE/base/restart-check.mjs" --phase compare --base http://127.0.0.1:$PORT --chat chat-restart
# 追加覆盖缺省身份面（AC2 × AC6 的交叉）：--mode default
```
**期望**：`PASS AC6 跨重启（mode=explicit）` 与 `PASS AC6 跨重启（mode=default）`，且两行 `saved=…` 与 `after=…` 的信封**逐字相同**（含 `reason`）。
**基线实测**：`mode=explicit` 重启前 `pickup 条目数=1`，重启后 `after=undefined` ⇒ **FAIL**（F03 的动机面）。

### 4.7 禁止项（取证卫生）

- **不得**新增 `*.test.js`、不得新增任何仓库内文件（§0.1 文件面）；证据一律落 `/tmp/0030-pr-005/`。
- **不得**为让判据通过而放宽断言（如把 `reason` 键位从"末位"放宽成"存在即可"、把 `agent 不可用` 文案改写成别的文案）。
- **不得**用"改后能跑"替代"既有面逐字不变"：AC9 的判定载体是 §4.4 的 `diff`，不是主观判断。
- **不得**在 PR worktree 内直跑 web/agent（会留 `oamp/.runtime/roster.json`）；若确需直跑，跑前 `cp -R` 到 `/tmp` 或跑后删除并复核 `git status --short`。

---

## 5. 事实更正、边界、已知风险与 `[model_inferred]` 清单

### 5.1 事实更正（planner 实读 + 实跑发现，逐条附证据；**不改 PR 文件/架构文件，只在此上报**）

- **F-1（文档笔误）「既有 11 键」实为 10 键**：`call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code` ⇒ 10 个。契约 §1 的"作为第 12 键追加在既有 11 键之后"**键位意图**（末位）成立，**计数**不成立；本文件按"既有 10 键 + `reason` 末位"落判据（§0.4 契约 1）。证据：`web.js:539-558` + 实跑 `Object.keys(envelope)`。
- **F-2（AC8 前提错误）「池内无在线实例 ⇒ 既有 404」不成立**：实跑证明"角色文件存在但无在线实例"⇒ **200 + `submitted` 信封**（`sendTask` 吞错、handler 的失败分支不可达，A4）；404 只在"角色不可解析"（`roleOfInstance(instanceIdForRole(role)) !== role`）时出现。本文件把 AC8 拆成**两个可判定断言**：① 角色不可解析 ⇒ 404 文案逐字（回归面）；② 空池 ⇒ 目标回落既有 `instanceIdForRole(role)`、响应与基线逐字一致、不新造错误面（不排队/不新增错误码）。**AC8 的"错误码与文案逐字复用"要求照旧满足**（既有 404 未改），只是"触发条件"被如实更正。
- **F-3（算式与括注不一致）`taskNetMs + RECONCILE_SLOW_DEFAULT_MS` = 4h00m30s ≠ "4h30m"**：A-05 清单第 6 条与其括注、PR AC10 的"约 4h30m 量级"三者不一致。本文件按**算式**（`+ 30000`）落契约 11，判据取不变式"缺省 TTL ≥ `config.taskNetMs`"（AC10 的字面要求），并把 4h30m 视为量级描述。
- **F-4（预期变化，非回归）取件面在 Router 不可达时由 502 变 200**：基线实跑 `GET /api/pickup`（有未取件条目、Router 停）= 502 `UPSTREAM_UNAVAILABLE`；改造后只读 DB ⇒ 200。这是 F03（不再依赖 Router 任务表现算）的**必然结果**，需在阶段 6 与 G01 对照面一并知会（不在 AC9 的三条冻结面内）。
- **F-5（防新造回归）`POST /api/calls` 在 Router 不可达时基线 = 200 + `submitted`**：池快照是新增的 Router 读取 ⇒ 若不吞错，会把该既有输入变成 502（新回归）。契约 7 已冻结"取数失败 ⇒ 视作空池"。
- **F-6（可观测性缺口，待裁决）** 池内命中 `pb-<role>-<n>` 时，信封/转录/`GET /api/calls` roster 的 `agent` 字段仍走 `roleOfInstance`（精确公式）⇒ **`null`**，而 `/api/agents` 的 `role` 列显示角色名 ⇒ 同一实例在两个面上自相矛盾（A-06 补定明确要避免的那类矛盾，但其落点清单只列了 role 列）。见 MI-P7。
- **F-7（途径面）SDK/CLI 无 `--new-session`**：`oamp/sdk/surface.js` 的 `calls create` flags 为**硬编码白名单**（连 `requester` 也没有），本迭代 `sdk/**` 零改动 ⇒ `new_session` 的调用方途径 = 裸 HTTP 项级字段（与 0029 `requester` 的先例同形）。若验收要求"经 CLI 也可声明"，需扩 pr-006 或新增文件范围（**本 PR 不扩**）。
- **F-8（退役 grep 口径）**：`docs/**`（需求/分析/决策输入文档）与 `roles/**`（决策记录、历次验证报告）中保留 `pickup.js` 的**历史文字提及**，不在任何 PR 的可写面内 ⇒ T6 判据 1 的口径 = **实现面零命中**（排除 `docs` / `roles` / `.pb-agents` / `node_modules`）。若阶段 6 的 G01 核查按"全仓"口径 grep，需以同一排除口径记账。

### 5.2 `[model_inferred]`（**留待主 agent 确认，本文件不自行生效**）

- **[model_inferred] MI-P1（AC4 的键位数）**：把契约 §1 的"既有 11 键之后"落到**实况 10 键之后（末位）** ⇒ 断言 `Object.keys(failed) === [...既有10键, 'reason']`。依据 = F-1 实跑；若主 agent 认为应保持"11 键"的字面（即现有 10 键中还有一键被漏数、需补齐某键），则 T4 判据 3 与 §4.4 指纹的期望 diff 需同步改写（**本文件按"既有键集不动、末位追加"落，不补齐任何键**）。
- **[model_inferred] MI-P6（`new_session` 的非布尔处置）**：只认 `=== true`，其余取值按缺省处理，**不加 400 分支**。依据 = §0.3 A8 实测（基线对未知项级字段静默忽略；加 400 会为今天成功的请求新造拒绝面，与 AC9 冲突）。替代形态 = 按既有枚举体例严格拒绝（`new_session 非法（需为布尔）` ⇒ 400）；若主 agent 选定替代形态，T1 判据 6 需改写（并把该 400 纳入 §4.4 指纹的**预期差异**）。
- **[model_inferred] MI-P7（`roleOfInstance` 是否与池解析器同源，F-6）**：本文件**冻结为"仅在 `/api/agents` 的 role 列（`:673`）同源"**（= A-06 补定字面），并要求主 agent 裁决是否把 `:444-446` 的 `roleOfInstance` 也改为 `roleOfPoolInstance(instanceId, roleFromInstanceId)`。**推荐采纳**（理由：① 对既有 `pb-<role>` 形态零取值变化（精确公式优先，实测）；② 消除"role 列显示 `dev` 但信封 `agent: null`"的自相矛盾；③ F07 验收 5「路由结果对调用方可见（沿用既有实例标识面）」—— 信封 `agent` 正是既有标识面之一）。不采纳的后果：`pb-<role>-<n>` 目标的 `agent` 字段恒 `null`（新增的不一致面，需在阶段 6 登记）。裁决后 T7 判据 3 生效/删除。
- **[model_inferred] MI-P8（快照取数失败的处置，F-5）**：视作空池并回落（保 200 基线）。依据 = MI-9「不新造错误面」+ AC9 既有面不回归。替代形态 = 让 `queryOnce` 的错误冒泡成 502（**会新造回归**，不推荐）。若主 agent 选定替代形态，T1 判据 7 与 T8 的对照面需改写。
- **[model_inferred] MI-P9（`/api/docs` 参数表残留）**：`POST /api/calls` 的登记元数据 `params[].desc`（含 `tasks` 项形状说明）**不更新**，因此 `/api/docs` 不列 `new_session`；`API.md` §3.9 的参数表同步属 **pr-006**（其文件范围不含 `web.js`）。⇒ 本 PR 结束时存在"路由元数据未列 `new_session`"的文档面残留，请主 agent 裁决是否在收口时补（补则需动 `web.js` 的 `desc` 文案，会把 §4.4 指纹的 `routes.calls.params` 行变成**预期差异**）。
- **[model_inferred] MI-P10（`warnings` 自派发判定的比较基准）**：T1 把自派发告警的比较基准从"硬编码 `pb-<role>`"改为"本次实际选中的目标"。后果：显式身份声明 `instance_id:'pb-dev'` 而池内选中 `pb-dev-2` 时，告警**不再出现**（目标不是该身份声明的实例，语义上更正确）；单实例情形（池成员恒为 `pb-<role>`）**逐字不变**。依据 = F02 验收 5 只约束"不传身份"的响应面（不受影响）+ §0.3 A4；若主 agent 认为应保持与 `pb-<role>` 比较，则 T1 步骤 ⑥ 需保留原比较式（后果 = 多实例下可能出现"误报自派发"）。

### 5.3 已知风险（不阻塞，供 dev/verifier 知情）

1. **单文件六处接线 = 已登记的可审查性代价**（PR 文件「已知代价」明文）：本 PR 无法再拆文件范围；补偿面 = §4.4 的机械形状对照 + §4.3 全量断言 + §0.4 的 13 条冻结契约。
2. **AC7 判定的状态前提**：AC7 的"粘性优先于最空闲""`new_session` 重选"两条判定式依赖**两实例负载并列（tie）**的构造（`queued` 相等时 tie-break 到 `pb-dev`）；每次跑前必须 `driver.sh reset`（重建 DB + 重启 Router ⇒ 任务表清空），否则残留 `queued` 会让"最空闲"与"粘性"给出相同答案 ⇒ 判据失去区分力（假 PASS）。
3. **静默目标的观测面**：目标落在静默实例时无终态 ⇒ 不能用 `transcript.from` 观测，只能用 `/api/agents` 的 `queued`/`busy` 增量（既有 `deriveAgentWork` 投影，A5）⇒ 脚本已实现该回退（§4.3 的 `targetOf`）。
4. **`e2e 时间轴`**：AC10 的清理行最快 ≈31s（`taskNetMs` 压低到 1000 也无法低于常量 30000）；AC7/AC4 的每步等待 ~0.1~0.5s ⇒ 整轮 e2e（含重启）实测 < 20s，TTL 核对另加 38s。
5. **`roster.json` 污染面**：见 §4.0 的"为何在 `/tmp` 副本上跑"；dev 若在 worktree 直跑，必须在 T8 的封闭性核查前清理 `oamp/.runtime/`。
6. **`envelope` 反序列化的健壮性**：`GET /api/pickup` 将 `JSON.parse(row.envelope)`；单一写点（T2）保证格式自洽，本 PR **不新增** try/catch（既有体例零防御）。若某行被外部工具写坏，`JSON.parse` 抛错会冒泡成该请求的 502 —— 属既有"单写点自洽"假设的范围，不在本 PR 加固。

---

## 6. 粒度决策说明（非显然决策，记录依据）

- **六处接线拆成 T1~T7（而非"一次改完 web.js"）**：七片各有**互不重叠的 AC 归属**与**互不相同的判据载体** —— T1 池化（目标实例可观测面：`transcript.from` / `queued` 增量）、T2 写入面（sqlite 行）、T3 读取面（HTTP 形状 + 跨重启）、T4 信封（键序 + 三面同源）、T5 对账（日志秒数）、T6 退役（grep + 端点存活）、T7 role 列（`/api/agents` 投影）。合并会让失败面无法定位（例如"必达失败"可能是写入没做、也可能是读取没改）。
- **T2/T3 分列（而非"收件箱面一次改完"）**：两者的判据载体不同（DB 行 vs HTTP 形状/跨重启），且 T2 的判据**不需要** T3 落地即可判定（sqlite 只读查询）；拆分后"写入对不对"与"读取形状对不对"可分别定位。代价 = T2 与 T3 之间存在 `pickup` 面的瞬时窗口（写入已迁、读取未迁），但**同一 PR 原子落盘**，不构成中间态问题（PR 文件明文只要求"退役与三消费点同 PR"）。
- **T6（删文件）独立成任务**：它的判据（实现面 grep 零命中 + 两端点仍注册 + 改动面恰 2 文件）**不是** T2/T3 判据的子集；且它是 AC1 的唯一边界，独立成任务使"是否真的退役"有单独判据面。
- **T7 独立成任务**：与 T1 同属"池化"，但改变的是**另一个路由**（`/api/agents`）、判据面是**投影列**（而非派发目标），且携带一个待裁决口径（MI-P7）⇒ 独立成任务可分别验收。
- **T8 单独成任务的依据**：PR 的 AC9 是**跨面**要求（响应键集 / 投影 / 缺省形状），其判据载体（基线 vs 改造后的**形状指纹 diff**）与 T1~T7 的任一断言都不同；且"改动面封闭性""路由数""退役 grep""TTL 日志"四项只在集成层可得。
- **不设"文档同步"任务**：`API.md` / `README.md` / `llms.txt` / `skill/hub.md` 属 pr-006（其文件范围逐字列四者），本 PR 写文档即越界；`/api/docs` 的路由元数据残留已登记为 MI-P9。
- **不设"改动前基线"任务**：基线由 `git archive HEAD oamp` **随时可重现**（§4.0），再做基线快照属重复劳动；基线数值（19 PASS/26 FAIL、指纹）已在本文件 §4.3/§4.4 固定。

---

## 7. 执行证据（dev 回填）

> 本段由 pr-005 的 dev 在执行过程中**原文回填**（原始命令、原始 stdout/stderr、退出码；逐任务对齐 §1 的判据编号）。**不得**改写判据、不得只写结论。
> 建议分段：`T1 / T2 / T3 / T4 / T5 / T6 / T7 / T8`，每段含：命令原文 → 原始输出 → 对照判据编号的 PASS/FAIL 判定 → 偏差说明（若有）。
> 证据落盘约定：`/tmp/0030-pr-005/`（脚本、out 文件、日志）；**不新建仓库内证据文档**、不写入 `status.md` / `history.md` / `deferred-demand-changes.md` / `architecture.md` / PR 文件。
> verifier 的独立报告落 `clarifications/verify-<ts>-pr-005.md` + `roles/verifier/data/`，**不回填**本段。

（待回填）
