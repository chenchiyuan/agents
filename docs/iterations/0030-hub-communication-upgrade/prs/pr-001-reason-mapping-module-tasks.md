# pr-001-tasks.md — pr-001 内部任务列表（reason 映射叶子模块）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-001-reason-mapping-module.md`
**PR worktree（绝对路径，唯一代码写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-001-reason-mapping-module`
**PR worktree 分支**: `feat/0030-pr-001-reason-mapping-module`（落盘时 HEAD = `9f071b8`，`git status --short` 为空；与迭代分支 tip `e01e2a4` 的 merge-base = `9f071b8`）
**任务总数**: **3**（T1~T3）｜ **依赖图**: **无环**（链式，见 §2）｜ **关键路径**: `T1 → T2 → T3`
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（4 条验收标准 + F04）+ `architecture.md`（§4 A-03、§4 A-04、§5 变更面、§8 奥卡姆检验、§1.3 硬约束 3/7）+ `prd/F04-terminal-reason-enum.md`（验收 1/2/3/4/5）+ 代码库实读（§0.3 逐条带 `文件:行号`）

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（唯一）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/reason.js` | **新建**（唯一代码文件） | `reasonOf(state, error)`：五值闭集映射（**T1** 骨架 + 全函数性；**T2** 三段式匹配表） |

> `pr-001-reason-mapping-module-tasks.md`（本文件）是阶段 5 增量产物，落在迭代工作区 `docs/.../prs/` 下，**不计入** PR 的代码改动面。
> 取证产物一律落 `/tmp/0030-pr-001/`，**不入库**（§4）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/src/` 下全部 25 个既有文件（含失败串产生点 `agent.js`、`acp-client.js`、`rpc-client.js`、`oneshot-client.js`、`context-pool.js`、`router.js`、`web.js`，以及体例参照 `role-binding.js`）；`oamp/sdk/**`、`oamp/web/**`、`oamp/bin/**`、`oamp/scripts/**`、`oamp/package.json`、`oamp/API.md`、`oamp/README.md`、`oamp/llms.txt`、`oamp/skill/hub.md`、`roles/**`、`cluster.json`、`tests/**`、`tools/**`。
  追溯：PR 文件「上下文摘要」（"既有失败产生点……零改动"）+ 文件范围（只列 `oamp/src/reason.js`）+ architecture §1.3 硬约束 3（`error` 键位/拼写/取值形态含既有文案不变）。
- **不新增**：任何 HTTP 路由（既有 **29 条**不变，本迭代不新增）、任何协议方法、任何配置键/env 键、任何第三方依赖、任何测试文件、任何目录。
- **不接线（本 PR 最易越界项）**：`oamp/src/reason.js` 不得被任何既有文件 import；`composeCallEnvelope` 的 `reason` 追加在 **pr-005**，本 PR 不预置调用点、不留 TODO 挂钩、不改 `web.js`。
  追溯：PR 文件「上下文摘要」（"本 PR 只交付模块本体与其自证，**不接线**"）。
- **不做（属其他 PR）**：`inbox` 表与持久化（pr-003）、turn timer 双计时（pr-004）、池内路由（pr-002）、文档面同步 `reason` 字段说明与 `llms.txt` 重生成（pr-006）、既有面冻结核查（pr-008）。
- **做错的形态（明确排除）**：在失败**产生点**改写 `error` 串以配合映射（PR 上下文摘要明文排除）；引入关键字启发式匹配（architecture §4 A-04 裁决 1 说明 2，HB-10 结论）；把映射散落在多个模块（architecture §8 奥卡姆检验：`reason.js` 的存在理由 = 归类唯一落点）。

### 0.3 读码事实锚点（2026-09-17 实读，PR worktree HEAD `9f071b8`）

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **F1** | `oamp/src/reason.js` **不存在**（`ls` 失败）⇒ 本 PR 是纯新建，无既有实现可改 | 实测 |
| **F2** | 既有失败串产生点（本 PR **全部零改动**，仅作映射对象）：`cancelled` = `router.js:405`、`web.js:2199`；`rejected_by_agent` = `router.js:370`；`structured_output_invalid` = `web.js:555`；`timeout` = `agent.js:233`；`timeout_after_${ms}ms` = `agent.js:221`、`agent.js:485`；`spawn_failed: ${msg}` = `agent.js:433`；`spawn_error: ${msg}` = `agent.js:476`；`context_crashed` / `context_busy` / `model_unavailable` / `permission_denied` 见 `acp-client.js:297,303,320,321,354,358,378,425,426,449,456,850`、`rpc-client.js:116,161,251,280,347,535,542,585`、`context-pool.js:138,140,155,165,178,234,249`、`oneshot-client.js:108,110,125,183,190` | 逐条实测（架构 §4 A-04 表同源） |
| **F3** | `executor:'omp'` 非超时失败**直接透传** `err.message`，兜底文案为 `'一次性执行失败'` ⇒ 自由文本形态**不可穷举** | `agent.js:224` |
| **F4** | 体例参照：`role-binding.js` 头注 3 行（含"公式只此一处"、零 `src` 内 import 的声明）、零第三方依赖、纯函数、常量模块级不导出 | `oamp/src/role-binding.js:1-4,12-14` |
| **F5** | `oamp/package.json`：`"type": "module"`、`"dependencies": {}`、`engines.node >= 22` ⇒ ESM 具名导入可直接用；"零依赖"可机械核对 | `oamp/package.json` |
| **F6** | `oamp/` 下**无任何测试文件**（无 `*.test.js`）；仓库根 `tests/` 仅两个 shell 静态检查脚本，均不涉 oamp 单模块 ⇒ 本 PR 自证载体 = **一次性脚本**，且 PR 文件范围不含测试面 | 实测 |
| **F7** | PR worktree 干净；`oamp/**` 在 base `9f071b8` 与迭代分支 tip `e01e2a4` 之间**零差异**（差异只在 `docs/**` 与一个 `roles/verifier/data/**` 文件）⇒ 代码面基准无歧义 | `git diff --name-only HEAD iteration/0030-hub-communication-upgrade` |

### 0.4 本 PR 冻结契约（跨 PR 接缝，一次定死；下游 pr-005 按此编码）

1. **落点与形态**：新文件 `oamp/src/reason.js`，ESM；**唯一导出** `reasonOf`（**具名导出**，**无 default export**，**无其它导出**；模块级常量不导出）。
   〔追溯：architecture §4 A-03 第 1 条"导出唯一函数"；PR 验收 1〕
2. **签名**：`reasonOf(state, error)` —— 参数名与顺序照 architecture §4 A-03 原文；**纯函数、不抛异常**（任意入参——含 `null`/`undefined`/非字符串/对象——都必须返回五值之一或 `null`，不得抛出）。
   〔追溯：architecture §4 A-03 第 1 条（"纯函数"）；F04 验收 1〕
3. **返回值域**：严格二分 —— `state === 'failed'`（**严格相等，不做归一/裁剪/大小写换算**）⇒ 返回 ∈ {`agent_error`, `cancelled_by_client`, `infra_error`, `timeout`, `rejected`} 且**恒非 `null`**；否则 ⇒ 严格 `null`。
   〔追溯：architecture §4 A-03 第 2 条；F04 验收 1〕
4. **三段式匹配**：① 精确匹配 → ② 三条前缀规则 → ③ 兜底 `agent_error`；完整表 = architecture §4 A-04 裁决 1 的 15 行（本文件 §4.2 逐行展开为可执行探针）。
   〔追溯：architecture §4 A-04 裁决 1 / 裁决 3；PR 验收 3〕
5. **前缀口径（不解析参数、无启发式）**：`timeout_after_` 开头**且** `ms` 结尾 ⇒ `timeout`（`N` 不参与归类、不解析数值）；`spawn_failed:` / `spawn_error:` 开头 ⇒ `infra_error`（**冒号是前缀的组成部分**，冒号后任意文本含空串）；**不做任何关键字启发式**，未匹配一律走兜底。
   〔追溯：architecture §4 A-04 裁决 1 说明 2（含 HB-10 结论）；PR 验收 4〕
6. **零依赖面**：文件内 **0 条 `import` 语句**（含 `node:` 内置）；无文件/网络 I/O、无定时器、无 `process.env` 读取、无时间读取（`Date.now()` 一类）；不 import 任何 `src/**` 模块。
   〔追溯：PR 验收 1 + PR「上下文摘要」"零依赖、纯函数、无 I/O、无定时器"；architecture §1.3 硬约束 7（零第三方依赖）〕
7. **唯一消费点（本 PR 不实现，仅冻结）**：pr-005 在 `composeCallEnvelope`（`oamp/src/web.js:539`，本仓唯一信封构造点）内 `import { reasonOf } from './reason.js'`，仅当 `state === 'failed'` 时把结果作为第 12 键 `reason` 追加在既有 11 键之后。⇒ 本 PR 冻结的签名与返回值**不得**在后续 PR 中被改写。
   〔追溯：architecture §4 A-03 第 2 条（信封落点）+ §5 变更面对 `web.js` 的第 ② 项；pr-005 `depends_on` 记录〕
8. **序列化形态**：返回值是**字符串字面量**；`timeout` 不分子层级（不出现 `timeout.idle` 一类）。
   〔追溯：architecture §4 A-03（"序列化形态"条）；D-29 经 F04 验收 3 转述〕

### 0.5 PR 验收标准 → 任务映射（4 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC（PR 文件原文摘要） | 服务任务 |
|---|---|
| **AC1** 文件存在、导出唯一函数 `reasonOf(state, error)`；无其它导出、无对其它 `src/**` 模块的 import | **T1**（落点/导出面/零依赖面）+ T3（静态核查取证） |
| **AC2** `state !== 'failed'` ⇒ `null`；`state === 'failed'` ⇒ 五值之一且恒非 `null`（含 `error` 为 `null`/缺失/非字符串/空串） | **T1** |
| **AC3** 已知形态逐条命中（`cancelled`；5 个 → `rejected`；`timeout` / `timeout_after_<N>ms`；`context_crashed` / `spawn_failed:` / `spawn_error:` / `dispatch_failed`；未匹配自由文本 → `agent_error`） | **T2** |
| **AC4** 参数化串按前缀口径归类、不解析参数；无关键字启发式分支 | **T2** + T3（探针取证） |
| （PR「上下文摘要」：本 PR 只交付模块本体与**其自证**） | **T3** |

---

## 1. 任务列表

### T1: `oamp/src/reason.js` —— 模块落点、唯一导出与全函数骨架（含兜底）

- **服务哪条 AC**: PR AC1（导出面/零依赖面）、AC2（全函数性与边界）；F04 验收 1（失败侧恒有值、取值 ∈ 闭集）
- **描述**: 新建 `oamp/src/reason.js`：按 `role-binding.js` 体例写文件头注；实现 `reasonOf(state, error)` 的**骨架与全函数保证** —— `state !== 'failed'` ⇒ `null`；`state === 'failed'` ⇒ 走三段式匹配器；**本任务只需保证"匹配器未命中时兜底 `agent_error`"这一条结构成立**（表内容由 T2 落地，T1 阶段未匹配串一律落兜底即可）。
- **文件/锚点**:
  - 新建 `oamp/src/reason.js`（唯一写入文件）
  - 体例参照 `oamp/src/role-binding.js:1-4`（头注）、`:12-14`（常量模块级、不导出）
  - 结构建议（L3 细节）：模块级冻结映射表常量（不导出）→ 模块级前缀规则数组（不导出）→ `export function reasonOf(state, error)`。
- **步骤**:
  1. 写头注：说明"失败终态源串 → `reason` 五值闭集的**唯一**公式只此一处"、引用 `architecture.md §4 A-03 / A-04`、声明唯一消费点 = pr-005 的 `composeCallEnvelope`、声明零依赖/无 I/O/无定时器。
  2. 定义模块级被查表常量（**不导出**）。
  3. 写 `export function reasonOf(state, error)`：先判 `state === 'failed'`，非则 `return null`；是则依次走 ①精确 ②前缀 ③兜底（T1 阶段兜底分支即可返回 `agent_error`）。
  4. 确认文件内**没有**任何 `import` 语句、没有 I/O 与定时器调用、没有 `Date.now()`/`process.env`。
- **验收判据（可执行；脚本形态见 §4.1，产物落 `/tmp/0030-pr-001/`）**:
  1. **落点与导出面**：`oamp/src/reason.js` 存在；动态 import 其绝对路径成功；`Object.keys(ns)` **恰为** `['reasonOf']`（无 default、无常量导出）；`typeof ns.reasonOf === 'function'`；`ns.reasonOf.length === 2`。
  2. **非失败侧**：对 `state ∈ {submitted, working, completed, '', 'FAILED', 'failed ', null, undefined, 123}`（`error` 任取）⇒ 返回值**严格 `=== null`**（每个 state 至少一个探针）。
  3. **失败侧全函数性**：对 `state='failed'` × `error ∈ {null, undefined, '', 123, {}, [], '任意未匹配自由文本', 'cancelled', 'timeout_after_1800000ms'}` ⇒ 返回值 **∈ 五值闭集且非 `null`**（其中未匹配串在本任务阶段允许为 `agent_error`）。
  4. **不抛异常**：上述全部调用在 `try/catch` 包裹下零异常（含 `error` 为对象/数组/`undefined` 三种畸形入参）。
  5. **零依赖面（静态）**：`grep -c "^[[:space:]]*import" oamp/src/reason.js` = **0**；文件内无 `setTimeout|setInterval|process\.env|Date\.now|require\(` 命中；`git diff --stat` 中除 `oamp/src/reason.js` 外**无第二个路径**。
  6. **体例**：文件头注含字符串 `A-03` 与 `A-04`（可机械核对）；头注声明"唯一消费点"指向 pr-005。
- **追溯**:
  - 导出唯一性 / 零 `src` import → **PR 验收 1**；architecture **§4 A-03 第 1 条**（"导出唯一函数 `reasonOf(state, error)`…体例逐条照 `role-binding.js`"）。
  - `state !== 'failed'` ⇒ `null` → **architecture §4 A-03 第 2 条** + **prd/F04 架构维度**（"`state !== 'failed'` 时返回 `null`"）。
  - 失败侧恒非 `null` / 五值闭集 → **F04 验收 1**（"不存在缺 `reason`、取空值或取枚举外取值的失败终态"）+ **architecture §4 A-04 裁决 3**（全函数由三段式构造性保证）。
  - 零 I/O / 无定时器 / 纯函数 → **PR 上下文摘要**原文 + **architecture §4 A-03 第 1 条**（"纯函数（可独立验收）"）。
- **前置依赖**: 无
- **优先级**: P0

---

### T2: `oamp/src/reason.js` —— 三段式匹配表落地（精确 8 串 + 三条前缀规则 + 兜底）

- **服务哪条 AC**: PR AC3（已知形态逐条命中）、AC4（前缀口径、不解析参数、无启发式）；F04 验收 2（五值各自可达且调用方单向可区分）、验收 3（`timeout` 无子枚举）
- **描述**: 在 T1 的骨架内填入 architecture §4 A-04 裁决 1 的完整映射表：① 8 条精确匹配；② 3 条前缀规则；③ 兜底 `agent_error`（含 `task_failed` 与"缺失/`null`/非字符串"归口）。
- **文件/锚点**: `oamp/src/reason.js`（`reasonOf` 函数体与其上方被查表常量）；表的**唯一真源** = `architecture.md` §4 A-04 表第 1~15 行（本文件 §4.2 已逐行转写为探针）。
- **步骤**:
  1. 精确表：`cancelled` → `cancelled_by_client`；`rejected_by_agent` / `structured_output_invalid` / `permission_denied` / `model_unavailable` / `context_busy` → `rejected`；`timeout` → `timeout`；`context_crashed` → `infra_error`。**注意 `cancelled_by_client` 与 `rejected` 的边界：`cancelled` 是唯一 `cancelled_by_client` 源串**。
  2. 前缀规则 3 条（按 §0.4 契约 5）：`timeout_after_` 且 `ms` 结尾 ⇒ `timeout`；`spawn_failed:` 开头 ⇒ `infra_error`；`spawn_error:` 开头 ⇒ `infra_error`。**不解析 `N`、不解析冒号后文本**。
  3. 兜底：`error` 非字符串 / 缺失 / `null` / 空串 / `task_failed` / 任意未匹配自由文本 ⇒ `agent_error`。
  4. 自检：**无**任何 `includes(...)` / 正则关键字启发式分支（如"含 `timeout` 就归 `timeout`"）。
- **验收判据（可执行；逐行探针表见 §4.2，**全部行**必须通过）**:
  1. **精确 8 行**逐条命中，返回值与期望**严格相等**（`===`，非真值判断）。
  2. **前缀 4 行**（`timeout_after_1800000ms` / `timeout_after_30000ms` / `spawn_failed: spawn bash ENOENT` / `spawn_error: EACCES`）逐条命中。
  3. **兜底 8 行**（`task_failed`、`一次性执行失败`、`connect ECONNREFUSED 127.0.0.1:1`、`null`、`undefined`、`123`、`''`、`{}`）逐条返回 `agent_error`。
  4. **五值可达**：探针集合的返回值集合 **恰为** 五值全集（`new Set(实际值)` 大小为 5）——对应 F04 验收 2 的五种情形分别可构造。
  5. **不解析参数**：`timeout_after_1ms` 与 `timeout_after_999999999999ms` 同值；`spawn_failed:`（冒号后空串）与 `spawn_failed: ENOENT` 同值；`spawn_error:` 与 `spawn_error: x` 同值。
  6. **无关键字启发式（负例）**：`prompt timeout in model` / `spawn failed` / `cancel` / `Cancelled` / `timeout_after_5000`（无 `ms` 尾）/ `spawn_failed`（无冒号）⇒ 全部 `agent_error`（**`[model_inferred]` 见 §5 MI-P1**）。
  7. **纯函数**：同一 `(state, error)` 连续两次调用返回值严格相等；模块内无可变模块级状态（`let` 仅出现在函数体内或不存在）。
  8. **无子枚举**：全探针返回值中不含 `.` 或对象（`typeof 值 === 'string'` 且 ∈ 五值）。
- **追溯**:
  - 精确 8 行 → **architecture §4 A-04 裁决 1 表第 1~7、9 行**（含产生点：`router.js:405` / `router.js:370` / `web.js:555` / `acp-client.js:354,358` / `acp-client.js:378` / `context-pool.js:140` / `agent.js:233` / `context-crashed` 一族）；**PR 验收 3**。
  - 前缀 3 条 → **architecture §4 A-04 裁决 1 表第 8、10、11 行 + 说明 2**；**PR 验收 3 / 4**。
  - 兜底与 `task_failed` → **architecture §4 A-04 表第 13、14、15 行 + 裁决 3**（`agent_error` 是兜底类，两条可达来源）；**PR 验收 2 / 3**。
  - 五值可达/单向可区分 → **prd/F04 验收 2**（"五种情形 ⇒ 终态分别落 …，且调用方只读 `reason` 即可区分"）。
  - `timeout` 无子枚举 → **prd/F04 验收 3**（"空闲触发与安全网触发只在人类可读文本里区分，不新增枚举值或子层级"）+ **architecture §4 A-03**（序列化形态条）。
- **前置依赖**: T1
- **优先级**: P0

---

### T3: 自证与零影响核查（一次性脚本 + 全探针取证 + 改动面封闭性）

- **服务哪条 AC**: PR「上下文摘要」的"自证"交付物；AC1（零改动面/零依赖面的机械证据）、AC2/AC3/AC4（逐行探针证据）；G01 验收 3（既有 `error` 文案与产生点零改动）在本 PR 的落点
- **描述**: 把 §4 的探针脚本跑成一次完整取证：① 全探针表逐行 `(state, error) → 实际 / 期望` 输出；② 静态面核查（导入数、导出数、I/O/定时器/时间/环境读取、被引用面）；③ 改动面封闭性核查（`git status --short` / `git diff --stat`）。**全部产物落 `/tmp/0030-pr-001/`，不入库、不新增测试文件**（F6：`oamp/` 无测试先例且 PR 文件范围不含测试面）。
- **文件/锚点**: 零源码改动（T3 只读 `oamp/src/reason.js` 与 git 状态）；产出 `/tmp/0030-pr-001/reason-probe.mjs`、`/tmp/0030-pr-001/probe.out`、`/tmp/0030-pr-001/static.out`、`/tmp/0030-pr-001/diff.out`。
- **步骤**:
  1. 在 `/tmp/0030-pr-001/` 写探针脚本（对 PR worktree 的 `oamp/src/reason.js` 做绝对路径动态 import），覆盖 §4.2 全部行 + T1 判据 2 的非失败侧行。
  2. 跑脚本，原始 stdout 存 `probe.out`；失败行必须为 0（有失败行 ⇒ 回 T1/T2 修，不得改期望）。
  3. 跑 §4.3 静态核查命令族，存 `static.out`。
  4. 跑 §4.4 改动面核查命令族，存 `diff.out`。
- **验收判据（可执行）**:
  1. `probe.out` 含 §4.2 全部行的逐行记录（每行含 `state`、`error` 入参、期望、实际、`PASS|FAIL`），且 `FAIL` 行数 = **0**，末尾汇总 `合计 N 行 / 通过 N 行`。
  2. `static.out` 证明：`oamp/src/reason.js` 的 `import` 语句数 = 0、`export` 语句数 = 1、I/O/定时器/时间/`process.env` 命中数 = 0。
  3. `diff.out` 证明：`git status --short` 只出现 `?? oamp/src/reason.js` 一条（**不得**出现任何 `M ` 开头的既有文件）；`git diff --stat`（对 base `9f071b8`）为空——既有 25 个 `oamp/src/**` 文件零改动。
  4. **未接线证明**：在 PR worktree 内 `grep -rn "reasonOf\|reason\.js" oamp/src oamp/sdk oamp/web oamp/bin oamp/scripts` 的命中**只来自 `oamp/src/reason.js` 自身**（0 个外部命中）。
  5. 证据原文（四份输出）在 dev 的阶段报告内**原文引用**；**不写入** PR 文件、不写入任何仓库文件。
- **追溯**:
  - "自证"为 PR 交付物之一 → **PR 上下文摘要**（"本 PR 只交付模块本体与其自证"）。
  - 改动面封闭性 → **PR 文件范围**（只列 `oamp/src/reason.js`）+ **architecture §1.3 硬约束 3**（既有 `error` 文案/产生点零改动 ⇒ 产生点文件必须零 diff）+ **G01 验收 3**。
  - 零依赖/零新增 → **architecture §1.3 硬约束 7**（`oamp/package.json` `dependencies: {}`）+ **§5 变更面**（新增只有 2 个叶子模块中的本 PR 1 个）。
  - 未接线 → **PR 上下文摘要**（"不接线（唯一消费点 `composeCallEnvelope` 的追加动作在 pr-005）"）。
- **前置依赖**: T2
- **优先级**: P1

---

## 2. 依赖图

```
T1 ──> T2 ──> T3
```

边（逐条，均为真实约束；共 2 条）：
- `T1 → T2`：T2 在 T1 建立的唯一函数体内填入匹配表；函数体不存在则 T2 无写入面。
- `T2 → T3`：自证脚本的期望值即 T2 落地的映射表；表未落地则探针无法判定。

**无环**：边集合为链式，拓扑序 `T1 < T2 < T3` 满足全部边的方向，不存在回到已访问节点的路径。

**最长依赖链（本 PR 内部关键路径）**：`T1 → T2 → T3`（3 节点）。
**关键路径任务**：**T1**（唯一导出与全函数骨架的唯一生产者，T2/T3 的前置）→ **T2**（映射表的唯一生产者）→ **T3**（证据的唯一生产者）。

---

## 3. 执行顺序与增量策略

**顺序**：`T1 → T2 → T3`（与拓扑序一致；T1/T2 同文件连续施工，避免半成品文件跨调用留存）。

| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | `oamp/src/reason.js`：骨架 + 唯一导出 + 兜底 | §T1 判据 1~6（判据 3 只要求"五值/非 null"，不要求分类正确） |
| 2 | 同一文件的匹配表（精确 + 前缀） | §T2 判据 1~8（§4.2 全探针表） |
| 3 | `/tmp/0030-pr-001/*.out` 四份证据 + 封闭性核查 | §T3 判据 1~5 |

**若单次调用未跑完**：在**任务边界**停下（不得把半填的匹配表留给下一次）；已完成任务的判据输出即为本次调用的增量产物。

---

## 4. 验证配方（**禁止新增测试文件**；全部为一次性脚本与只读命令，F6）

### 4.1 探针脚本骨架（落 `/tmp/0030-pr-001/reason-probe.mjs`，**不入库**）

```bash
mkdir -p /tmp/0030-pr-001
WT=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-001-reason-mapping-module
cat > /tmp/0030-pr-001/reason-probe.mjs <<'EOF'
const WT = process.env.WT;
const { pathToFileURL } = await import('node:url');
const ns = await import(pathToFileURL(`${WT}/oamp/src/reason.js`).href);
const { reasonOf } = ns;
// 导出面（T1 判据 1）
const keys = Object.keys(ns);
if (keys.length !== 1 || keys[0] !== 'reasonOf') throw new Error(`导出面异常: ${keys}`);
// 行表：[state, error 入参, 期望]（§4.2）
const rows = [ /* … §4.2 全表 … */ ];
let fail = 0;
for (const [state, err, want] of rows) {
  let got; try { got = reasonOf(state, err); } catch (e) { got = `THROW:${e.message}`; }
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} state=${JSON.stringify(state)} error=${JSON.stringify(err) ?? String(err)} want=${String(want)} got=${String(got)}`);
}
console.log(`合计 ${rows.length} 行 / 通过 ${rows.length - fail} 行 / 失败 ${fail} 行`);
process.exit(fail === 0 ? 0 : 1);
EOF
WT=$WT node /tmp/0030-pr-001/reason-probe.mjs | tee /tmp/0030-pr-001/probe.out
```

### 4.2 全探针表（**逐行必须通过**；`state='failed'` 除末组外）

| # | `state` | `error` 入参 | 期望返回 | 追溯 |
|---|---|---|---|---|
| 1 | `'failed'` | `'cancelled'` | `cancelled_by_client` | A-04 表第 1 行；PR AC3 |
| 2 | `'failed'` | `'rejected_by_agent'` | `rejected` | A-04 表第 2 行；PR AC3 |
| 3 | `'failed'` | `'structured_output_invalid'` | `rejected` | A-04 表第 3 行；PR AC3 |
| 4 | `'failed'` | `'permission_denied'` | `rejected` | A-04 表第 4 行；PR AC3 |
| 5 | `'failed'` | `'model_unavailable'` | `rejected` | A-04 表第 5 行；PR AC3 |
| 6 | `'failed'` | `'context_busy'` | `rejected` | A-04 表第 6 行；PR AC3 |
| 7 | `'failed'` | `'timeout'` | `timeout` | A-04 表第 7 行；PR AC3 |
| 8 | `'failed'` | `'context_crashed'` | `infra_error` | A-04 表第 9 行；PR AC3 |
| 9 | `'failed'` | `'dispatch_failed'` | `infra_error` | A-04 表第 12 行（防御性归属；**该串不进终态信封**，仍须可归类） |
| 10 | `'failed'` | `'timeout_after_1800000ms'` | `timeout` | A-04 表第 8 行 + 说明 2；PR AC3/AC4 |
| 11 | `'failed'` | `'timeout_after_30000ms'` | `timeout` | 同上（`N` 不参与归类） |
| 12 | `'failed'` | `'timeout_after_1ms'` | `timeout` | 同上（参数无关） |
| 13 | `'failed'` | `'spawn_failed: spawn bash ENOENT'` | `infra_error` | A-04 表第 10 行；PR AC3 |
| 14 | `'failed'` | `'spawn_failed:'` | `infra_error` | A-04 说明 2（冒号后含空串） |
| 15 | `'failed'` | `'spawn_error: EACCES'` | `infra_error` | A-04 表第 11 行；PR AC3 |
| 16 | `'failed'` | `'spawn_error:'` | `infra_error` | A-04 说明 2 |
| 17 | `'failed'` | `'task_failed'` | `agent_error` | A-04 表第 14 行（`out` 记录兜底串） |
| 18 | `'failed'` | `'一次性执行失败'` | `agent_error` | A-04 表第 13 行（`agent.js:224` 兜底文案） |
| 19 | `'failed'` | `'connect ECONNREFUSED 127.0.0.1:1'` | `agent_error` | A-04 表第 13 行（`err.message` 透传） |
| 20 | `'failed'` | `null` | `agent_error` | A-04 表第 14 行；PR AC2 |
| 21 | `'failed'` | `undefined` | `agent_error` | 同上（缺失） |
| 22 | `'failed'` | `''` | `agent_error` | 同上（空串）；PR AC2 |
| 23 | `'failed'` | `123` | `agent_error` | 同上（非字符串）；PR AC2 |
| 24 | `'failed'` | `{}` | `agent_error` | 同上（非字符串）；PR AC2 |
| 25 | `'failed'` | `'prompt timeout in model'` | `agent_error` | PR AC4（无启发式）`[model_inferred]` MI-P1 |
| 26 | `'failed'` | `'spawn failed'` | `agent_error` | 同上（非 `spawn_failed:` 前缀）`[model_inferred]` MI-P1 |
| 27 | `'failed'` | `'cancel'` | `agent_error` | 同上（`cancelled` 的近似非精确）`[model_inferred]` MI-P1 |
| 28 | `'failed'` | `'Cancelled'` | `agent_error` | 同上（严格相等 ⇒ 大小写不归一）`[model_inferred]` MI-P1 |
| 29 | `'failed'` | `'timeout_after_5000'` | `agent_error` | A-04 说明 2 的"且 `ms` 结尾"反面；`[model_inferred]` MI-P1 |
| 30 | `'failed'` | `'spawn_failed'` | `agent_error` | A-04 说明 2 的"冒号是前缀组成部分"反面；`[model_inferred]` MI-P1 |
| 31 | `'submitted'` | `'cancelled'` | `null` | A-03 第 2 条；F04 架构维度 |
| 32 | `'working'` | `'timeout'` | `null` | 同上 |
| 33 | `'completed'` | `null` | `null` | 同上 + F04 验收 7（成功侧不新增语义） |
| 34 | `''` | `'x'` | `null` | 同上（严格相等，非 failed） |
| 35 | `'failed '`（尾空格） | `'cancelled'` | `null` | 同上（不做裁剪）`[model_inferred]` MI-P1 |
| 36 | `null` | `'cancelled'` | `null` | 同上（state 非字符串） |
| 37 | `undefined` | `'cancelled'` | `null` | 同上 |

> 行 1~30 的返回值集合 `new Set(...)` 大小必须 = **5**（五值可达，F04 验收 2）。

### 4.3 静态核查命令族（→ `/tmp/0030-pr-001/static.out`）

```bash
cd $WT
{
  echo "== import 语句数（须为 0）=="; grep -cE "^[[:space:]]*import" oamp/src/reason.js || true
  echo "== export 语句数（须为 1）=="; grep -cE "^[[:space:]]*export" oamp/src/reason.js || true
  echo "== 导出符号名（须只有 reasonOf）=="; grep -oE "export +function +[A-Za-z0-9_]+" oamp/src/reason.js; grep -cE "export +default" oamp/src/reason.js || true
  echo "== I/O / 定时器 / 时间 / env 命中（须为 0）=="
  grep -cE "setTimeout|setInterval|process\.env|Date\.now|require\(|node:fs|node:http" oamp/src/reason.js || true
  echo "== 关键字启发式嫌疑（includes/正则，须为 0）=="; grep -cE "\.includes\(|new RegExp|/\\\\w.*timeout" oamp/src/reason.js || true
  echo "== 未接线证明（命中须只来自 reason.js 自身）=="
} > /tmp/0030-pr-001/static.out
grep -rn "reasonOf\|reason\.js" oamp/src oamp/sdk oamp/web oamp/bin oamp/scripts | tee -a /tmp/0030-pr-001/static.out
```

### 4.4 改动面封闭性（→ `/tmp/0030-pr-001/diff.out`）

```bash
cd $WT
{
  echo "== git status --short（须只有 ?? oamp/src/reason.js）=="; git status --short
  echo "== git diff --stat vs base 9f071b8（须为空）=="; git diff --stat 9f071b8961a65a2d9f258259788be4e0dff4e41a -- oamp roles tests tools cluster.json
  echo "== 既有 25 个 src 文件零改动核对 =="; git diff --name-only 9f071b8961a65a2d9f258259788be4e0dff4e41a -- oamp/src | grep -v "^$" || echo "(空)"
} | tee /tmp/0030-pr-001/diff.out
```

> T3 只做**只读** git 命令；本 PR 的提交动作不在本任务列表内（由阶段 5 的 merge 环节承担）。

---

## 5. 边界、已知风险与 `[model_inferred]` 清单

### 5.1 `[model_inferred]`（**留待主 agent 确认，本文件不自行生效**）

- **MI-P1 · 负例边界行（§4.2 第 25~30、35 行）**：这些串**没有任何生产点会产出**，是从"① 精确匹配 + ② 前缀口径 + ③ 不做关键字启发式 + 严格相等"四条已定规则**反面推出**的边界断言。逐条来源：
  - 行 25/26/27：PR 验收 4 明文"无关键字启发式分支" ⇒ 「含 `timeout`/`spawn`/`cancel` 子串但不满足精确或前缀」必须落兜底（architecture §4 A-04 说明 2 引 HB-10 结论）。
  - 行 28/35：A-04 的"**精确**匹配"隐含大小写敏感与不裁剪。
  - 行 29/30：A-04 说明 2 写作"`timeout_after_` 开头**且 `ms` 结尾**"、"`spawn_failed:` / `spawn_error:` 开头"⇒ 反面（无 `ms` 尾 / 无冒号）落兜底；而 PR 验收 4 只写了"前缀口径"未写 `ms` 尾，**两处输入的措辞差已按 architecture 更严口径统一**（生产点 `agent.js:221,433,476,485` 全部满足该更严口径，无行为差）。
- **MI-P2 · "0 条 import 语句"的收紧**：PR 验收 1 字面只要求"无对其它 `src/**` 模块的 import"，architecture §1.3-7 要求"零第三方依赖"。本任务列表收紧为**全文件 0 条 import（含 `node:` 内置）** —— 依据是该模块按构造不需要任何外部符号（纯映射 + 字符串方法）；若 dev 认为需要内置模块，须回报而不自行放宽。
- **MI-P3 · 文件头注内容要求（T1 步骤 1 / 判据 6）**：PR 与 architecture 都只要求"体例照 `role-binding.js`"，未逐字规定头注文本；本任务列表把"引用 `§4 A-03 / A-04`、声明唯一消费点 = pr-005"作为可机械核对的体例项。
- **MI-P4 · 模块级常量不导出**：由 PR 验收 1"无其它导出"直接推得（映射表/前缀规则须为模块级私有常量）；architecture 未逐字说明。

### 5.2 已知风险（不阻塞，供 dev/verifier 知情）

1. **PR worktree 的 `docs/**` 副本滞后于迭代分支 tip**：PR worktree HEAD = `9f071b8`，迭代分支 tip = `e01e2a4`（阶段 4 返工 + status 更新）。**`oamp/**` 在两者间零差异**（F7）⇒ 代码面基准无歧义；但若 dev 在 PR worktree 内读 `docs/.../prs/*.md`，可能读到返工前版本。**本 PR 的唯一真源以迭代工作区路径下的文件为准**（本文件与 PR 文件的路径即工作区路径）。
2. **`dispatch_failed` 不在终态信封域**（architecture §4 A-04 更正 + §9-2）：§4.2 行 9 仍要求它可归类（防御性归属 `infra_error`），但**没有**端到端可观测路径可验；其取证形态只能是"函数级探针"，不得声称"信封实测"。
3. **`agent_error` 与 `infra_error` 是消费侧近似划分**（architecture §9-1）：`context_crashed` 一族混装会话崩溃与命令级失败，整体归 `infra_error`。本 PR 不改（那需产生点分码，跨迭代项）；dev **不得**为"更精确"而拆分该族。
4. **`reason` 的端到端面（信封/持久化/取件）在本 PR 不可观测**：本 PR 不接线 ⇒ 一切验收都在**函数级**完成；"信封多一个键""取件与调用面同源"属 pr-005 的验收面，本 PR 不得越界声称。

---

## 6. 粒度决策说明（非显然决策，记录依据）

- **T1 / T2 拆分的独立验收价值**：两者的失败模式不同 —— T1 的失败面是"非失败态漏出值""畸形入参抛异常""意外导出/意外依赖"；T2 的失败面是"某条已知形态归错类""前缀规则被写成启发式"。拆开后可分别判定，且 T1 的探针（判据 2/3/4）在 T2 未落地时**即可通过**（不要求分类正确），T2 的探针在 T1 未落地时**无法执行**（无函数可调）⇒ 依赖是真实的、非顺序偏好。
- **T2 不再细分**（例如"精确表"与"前缀规则"各一任务）：拆开后两者共用同一个函数体与同一份探针脚本，第二者的验收必须重跑第一者的全部行 ⇒ 独立验收价值不成立，故合并。
- **T3 单独成任务的依据**：PR 文件把"自证"列为交付物原文（"只交付模块本体与其自证"），且证据面（探针原文 + 静态面 + 改动面封闭性）是阶段 6 verifier 的输入；它不是 T1/T2 判据的重跑，而是**跨任务的一次性汇总 + 零影响核查**（其中"未接线证明""diff 封闭性""25 文件零改动"是 T1/T2 判据中均不包含的项）。
- **不设"改动前基线"任务**：与 0029 pr-001 的先例不同，本 PR 是**纯新建且不接线**，没有既有 API/输出需要逐字前后比对；既有面的零影响由 `git diff`（T3 判据 3）直接判定，不需要动前快照。
