# pr-planner 第 3 轮记录 — 0022 阶段 4（Gate 第二轮 PASS 后的偏差定点修正）

**角色**: pr-planner（`roles/pr-planner/pr-planner.md` v0.1.0）
**日期**: 2026-09-14
**轮次性质**: 阶段 4 收口·第 3 轮（**文本级定点修正**——不重划边界、不改结构、不动依赖图）
**主输入**: `clarifications/verify-stage4-gate-r2-20260914.md`（PASS 30/30；偏差 D-1~D-8 + 1 条核实结论；其中 **D-2 / D-3 被标记为「阶段 5 首次派发前修正」**）
**其余输入**: `prs/pr-001~pr-005*.md`（待修）、`architecture.md` v0.2.0（只读）、`prd/*.md`（13 卡，只读）、代码库 `<工作区地址>/oamp/**`（本轮**实读**，逐条带 `文件:行号`）
**产出**: 修订后的 `prs/pr-002` / `prs/pr-003` / `prs/pr-004` / `prs/pr-005`（`pr-001` 本轮零改动）+ 本文件
**未改动**: `architecture.md` / `prd.md` / `prd/*.md` / `demand.md` / `status.md` / `history.md` / `progress.md`（只读）

---

## 0. 本轮定位与不变式承诺

Gate 第二轮 **30/30 全部 pass**（fail 0 / partial 0 / blocked 0），Gate 自己把 8 条偏差分为两类：**文本级、不改变划分与依赖图**的 6 条（D-1 / D-2 / D-3 / D-4 / D-6 / D-7），与**属主 agent 维护面**的 2 条（D-5 = `status.md` 的 PR 数、D-8 = Gate 的 A1 口径澄清请求）。本轮只做前 6 条。

**五条不变式（本轮后实测复核，见 §3）**：PR 数量 = 5、文件名与编号、文件范围集合、依赖边集合、功能点覆盖（F01~F13）——全部与 Gate 第二轮的文件范围矩阵 **逐项一致**。

**未做的事**（明确登记，非遗漏）：
- 未改 `status.md`（D-5 属主 agent 维护面）；
- 未改 `architecture.md`（D-7 的回填与 §9.4.1 清单派生方式属主 agent 维护面；本简报亦明令不得改）；
- 未对 D-8（A1 口径：pr-001 的「同层同一数据面单元可含多文件」是否算一个主题）表态——该口径澄清归主 agent，**两种口径下依赖图与可合并性结论一致**（Gate 已证）。

---

## 1. 逐条修正（偏差编号 → 修订内容 → 代码锚点）

### 1.1 D-3（**高优先**）· pr-005 验收第 1 条的 import 白名单字面判定必假

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-3） | pr-005 验收第 1 条原写「三个新文件的 import 集合 ⊆ `node:*` ∪ `{./protocol.js, ./launcher.js}`」。对 `protocol.js` 字面判定**必假**——它是装配方，import 必含三个实现模块；且该写法与同 PR 文件范围「`protocol.js` = 全仓唯一 import 三个实现模块的文件」及 architecture §3.3 的判据行互相矛盾。 |
| **修订内容** | `prs/pr-005-…md:33` 改为**两分口径 + 机械复核式**：① **白名单只挂 `rpc-client.js` / `oneshot-client.js`**（两文件 import 集合 ⊆ `node:*` ∪ `{./protocol.js, ./launcher.js}`）；② **`protocol.js` 是装配方、不在被限制方内**——判据 = 只 import `node:*` + 三个实现模块（`./rpc-client.js` / `./oneshot-client.js` / `./acp-client.js`，可含 `./launcher.js`），并写明「因其 import 必含三实现模块，若一并套白名单则字面判定必假」；③ 三文件均无第三方裸包名 + `dependencies === {}` 保留。附加两条 `grep -nE "^import"` 复核式，使判据**自洽且可机械复核**。 |
| **代码 / 文档锚点** | `architecture.md:310`（§3.3 `rpc-client.js` 行 =「文件的 import 只有 `node:*` / `protocol.js` / `launcher.js`」——白名单判据**只挂在 rpc-client 行**）；`architecture.md:309`（§3.3 `protocol.js` 行 =「全仓 `grep`：只有本文件 import 三个实现模块」）；pr-005 文件范围 `protocol.js` 行（同口径的「全仓唯一 import 三个实现模块的文件」）。 |
| **自洽性结果** | 修订后三处（pr-005 验收 / pr-005 文件范围 / architecture §3.3）**逐字同向**，且每个文件各自可机械复核；原「三者互相矛盾」消除。**依赖边、文件范围、功能点覆盖零变化。** |

### 1.2 D-2（**高优先**）· pr-005 固定 `AcpClient` 入参面 8 键 → 实测 **10 键** + 装配归属闭合

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-2） | pr-005「边界稳定约束」称现状 `new AcpClient` 的入参集合 = 8 键（漏 `auditContext` 四键与 `onExit`），并据以写定固定面；而 pr-003 要求注入的会话工厂「含 `auditContext` 四键」⇒ **一侧的固定面与另一侧的承载要求不闭合**（阶段 5 装配可能丢审计面 / 退出回调）。 |
| **修订内容** | ① `prs/pr-005-…md:29`：更正为 **实测 10 键**（逐键带行号），并新增「**装配归属（与 pr-003 双侧闭合）**」三支：`auditContext` 四键由 pr-005 的注入工厂承载（会话身份三键取自 `createResident({chatId, agentId, role})`，`context_id` 惰性 getter 经 `hooks` 转发回调用方会话 `contextId`）、`onExit` 由 pr-005 的注入工厂接到会话空闲崩溃收尾、`onPermissionRequest` 的档位注入语义归 pr-003。② `prs/pr-003-…md:26`（`context-pool.js` 改动项）：补写「本 PR 经调用面提供 `auditContext` 四键的取值来源与 `onExit` 回调实体，装配落点见 pr-005 的注入工厂的 10 键集合」。③ `prs/pr-003-…md:25`（`acp-client.js` 改动项 ⑤）：由 8 键更正为 **10 键并逐项列出**（含 `auditContext` / `onExit`），并写明该集合由 pr-005 的注入工厂装配面一次性写定。 |
| **代码锚点（实测逐键）** | `oamp/src/context-pool.js:203`（`const client = new AcpClient({`）、`:204` `bin`、`:205` `model`、`:206` `cwd`、`:207` `tools`、`:208` `roleFile`、`:209` `permission`、`:211-218` `auditContext`（`instance` `:212` / `role` `:213` / `chat_id` `:214` / `get context_id()` `:215-217`）、`:219` `logger`、`:220` `onExit`、`:223-226` `onPermissionRequest`；`onExit` 的委派目标 `_onClientExit` 在 `oamp/src/context-pool.js:239-243`。 |
| **闭合结论** | **装配面**（把 10 键落到实现构造函数）= pr-005 的 `protocol.js` 注入工厂；**取值来源面**（会话身份三键、惰性 `context_id`、退出回调实体）= pr-003 的 `context-pool.js` 调用面；**档位注入语义**（仅 `allow` 档注入 + 附加会话身份后透传）= pr-003。两侧各自写明、无遗漏面。**依赖边、文件范围零变化。** |

### 1.3 D-1 · pr-003 把 8 处 `AcpError` 引用统称 `instanceof` → 精确化

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-1） | pr-003 三处称 `oamp/src/context-pool.js` 的 8 处 `AcpError` 引用「判 `instanceof AcpError`」（`prs/pr-003-…md:7` 摘要、`:26` 文件范围、`:79` depends_on）。实测仅 **2 处**是 `instanceof`。 |
| **修订内容** | 三处统一改为精确表述：8 处**引用**（`:151`、`:153`、`:168`、`:178`、`:191`、`:242`、`:251`、`:257`）中 **`instanceof` 判定仅 `:191` / `:251`**，其余 6 处为 `new AcpError(...)` 构造 / 抛出；`depends_on` 处（`:79`）的行号由 `:151 / :251` 更正为 `:191 / :251`。另在 `prs/pr-003-…md:25`（`acp-client.js` 改动项 ④）补列**该文件自身**的 `AcpError` 引用性质，使两类文件各自的替换面都逐行可指。 |
| **代码锚点（逐行实测）** | `oamp/src/context-pool.js`：`:151` `new AcpError('context_crashed','上下文已释放')`、`:153` `new AcpError('context_busy',…)`、`:168` `new AcpError('context_crashed','上下文已释放，排队轮次未执行')`、`:178` `throw new AcpError('context_crashed',…)`、`:191` `err instanceof AcpError ? err : new AcpError(…)`（**instanceof**）、`:242` `new AcpError('context_crashed','上下文子进程异常退出')`、`:251` `err instanceof AcpError ? err.code : …`（**instanceof**）、`:257` `new AcpError('context_crashed','上下文实例已不可用，排队轮次未执行')`。`oamp/src/acp-client.js`：`:42-48` 本地 `AcpError` 类定义、`:174` / `:321`（`instanceof`）、`:169` / `:175` / `:176` / `:192` / `:193` / `:226` / `:230` / `:298` / `:305` / `:328` / `:366` / `:674`（构造 / 抛出）。 |
| **性质说明** | 两类引用**都需改类型**（`AcpError` → `ProtocolError`），故「替换面」判定不变；修订只纠正**性质与行号**，**零判定变化、零依赖边变化**。 |

### 1.4 D-4 · pr-004 的 `app.js:556` → `:550`

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-4） | pr-004 两处（`prs/pr-004-…md:13` 文件范围 ③、`:33` 参考资料）把 4 类事件订阅循环引作 `oamp/web/app.js:556`，实测为 `:550`（偏移 6 行；r1 已指出，第二轮未修）。 |
| **修订内容** | 两处行号更正为 `:550`，与同文件中 `:563`（`handleEvent`）/ `:566-572`（`task_update` 分支）/ `:601-611`（`appendChunk`）/ `:421`（`id="stream-text"`）的引用保持自洽。 |
| **代码锚点** | `oamp/web/app.js:550`（`for (const type of ['message', 'task_update', 'chat_state', 'notice']) {`）、`:563`（`function handleEvent(type, data) {`）、`:566`（`if (type === 'task_update') {`）、`:601`（`function appendChunk(chatId, chunk) {`）、`:421`（流式气泡 `id="stream-text"`）。 |
| **性质说明** | 纯行号更正，**零结构 / 零判定变化**。 |

### 1.5 D-6 · 跨 PR 验收「择一判定声明」（3 组双主张）

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-6） | 三组「同一验收条目被两个 PR 各自主张」，各自限定了观测面但**无一处写明择一判定 / 两层各判一次**：① F02 验收 1/2 在 pr-003 与 pr-005；② F08 验收 1/2 在 pr-003 与 pr-004；③ F06 验收 1 在 pr-002 与 pr-003。 |
| **修订内容** | 在 4 个 PR 的**验收段**各补一句「**择一判定声明（D-6 · 跨 PR 验收归属）**」，明写主面 / 辅面归属与不互推口径：**pr-005**（`:48`）F02 验收 1/2 = **主面**（注入点的「选择与进程面」）；**pr-003**（`:57`）F02 验收 1/2 = **辅面（端到端回归面）**、F06 验收 1 = **主面（行为回归面）**、F08 验收 1/2 = **辅面（管道面）**；**pr-004**（`:27`）F08 验收 1/2 = **主面（界面面）**；**pr-002**（`:32`）F06 验收 1 = **辅面（测试面前置）**。 |
| **归属依据（卡面原文，非自定）** | `prd/F02-…md` 验收 2 判定 =「观察进程 **argv**（或既有 argv 日志）」；`prd/F02-…md` 验收 1 的判定面含解析链四档 ⇒ 主面落在交付**注入点与标准面**的 pr-005，pr-003 的辅面 = 消费层接线后真实子进程 argv。`prd/F08-…md` 验收 1 的 `[user_confirmed MI-01]` 明定「**本卡判据面 = 界面面**」（判据面由用户确认，非本角色选择）⇒ 主面 = pr-004，pr-003 的管道面为辅（且卡面自陈用途：界面上看不到时区分「管道丢了」与「管道有、界面没接」）。`prd/F06-…md` 验收 1 判定 =「按 0021 既有验收**同法复核**」（行为回归）⇒ 主面 = pr-003（改 acp 实现的那一步），pr-002 的测试面固定为辅（使回归判据在默认 rpc 后仍可判）。 |
| **性质说明** | 只加「判定归属」声明，**不改任何验收条目内容、不改文件范围、不改依赖边**；阶段 5 / 6 的逐条判定清单可直接引用该声明，消除双判 / 互推。 |

### 1.6 D-7 · architecture §9.4.1 清单 6 vs 实测 7 —— **登记已落，本轮零改动**

| 项 | 内容 |
|---|---|
| **偏差**（Gate D-7） | `architecture.md` §9.4.1「既有测试面 · 最小更新」列 **6 文件**（`architecture.md:704-712`：B-11 acp-daemon、B-12 context-pool、B-13 tool-permission、B-14 web、B-15 project-workspace + confirmation-roundtrip），实测 ACP-only 桩文件 = **7**（第 7 个 = `oamp/test/call-protocol.test.js`）。 |
| **本轮动作** | **零改动**——正确口径的登记已在 pr-002 与 pr-003 落字（Gate 亦判定「pr-002 / pr-003 的处置已正确，无需改 PR」）。本轮复读确认：`prs/pr-002-…md:18` 的「**D-1 登记（测试面归属口径）**」子条（明写「实测应为 7 个」并给出 7 文件全体）；`prs/pr-003-…md:36` 的「**测试面口径登记（D-1；不改 `architecture.md` 本体）**」段（同口径 + 逐文件归属）。 |
| **复核证据（本轮实跑）** | `oamp/test/*.test.js` 中同时命中 `FAKE_ACP_SOURCE` 或 `msg.method ===` 的文件**恰 7 个**：`acp-daemon` / `call-protocol` / `confirmation-roundtrip` / `context-pool` / `project-workspace` / `tool-permission` / `web`（与 Gate E-2 一致）。 |
| **约束遵守** | **未触碰 `architecture.md`**（回填与「清单按桩分布派生」的改写属主 agent 处置）。 |

---

## 2. 一处指派文本的更正登记（诚实登记，便于复核对齐）

本简报「逐条修正清单」第 3 项在括号里把 D-1 的 `instanceof` 行号写作 `oamp/src/acp-client.js:191 / :251`。**实读不符**，已按代码真值执行：

- `oamp/src/acp-client.js:191` 是 `async prompt(text, { model = null, … })` 的**形参行**（该文件内 `onChunk` 形参，`prs/pr-003-…md:25` 的 ③ 项引用它），**不含 `AcpError`**；`acp-client.js` 无 `:251`（其 `AcpError` 引用分布见 §1.3 锚点）。
- D-1 所指的 8 处引用与 2 处 `instanceof` **都在 `oamp/src/context-pool.js`**（`:191` / `:251` 为 `instanceof`，`:151` / `:153` / `:168` / `:178` / `:242` / `:257` 为构造 / 抛出）——与 Gate 报告 D-1 / E-6 一致。
- 处置：pr-003 三处按 **context-pool.js** 更正（§1.3）；同时在 pr-003 的 `acp-client.js` ④ 项**补列该文件自身的引用性质**（`:174` / `:321` 为 `instanceof`），使两个文件的面都被精确覆盖，任一口径下判据都自洽。

---

## 3. 不变式复核（本轮修订后机械跑，逐项对照 Gate 第二轮矩阵）

| 不变式 | 实测结果 | 与 Gate 第二轮矩阵对比 |
|---|---|---|
| PR 数量 | `prs/*.md` = **5** | 一致（5） |
| 文件名与编号 | pr-001~pr-005，文件名逐字未改 | 一致 |
| 七字段齐备 | 每文件 `^## ` 计数 = **7**（上下文摘要 / 涉及功能点 / 文件范围 / 验收标准 / 参考资料 / depends_on / batch） | 一致（5×7=35） |
| 文件范围集合 | pr-001 `{launcher, config, config-file.test}`；pr-002 `{acp-daemon, context-pool, project-workspace, call-protocol}.test`；pr-003 `{acp-client, context-pool, agent, web.test, confirmation-roundtrip.test, tool-permission.test, zero-intrusion.test（新）, README}`；pr-004 `{web/app.js, web/style.css（条件）}`；pr-005 `{protocol（新）, rpc-client（新）, oneshot-client（新）, protocol-layer.test（新）}` | **逐项一致**（零增删；两两交集仍为 ∅） |
| 依赖边集合 | `{pr-002→pr-001, pr-003→pr-005, pr-003→pr-002, pr-003→pr-001, pr-005→pr-001}`，`pr-001` / `pr-004` 仍为空 | **逐项一致**（5 边、无环；pr-003 的 depends_on 仅更正了理由段内的行号性质，边本身未变） |
| 功能点覆盖 | pr-001 F01 F10 F12 F13；pr-002 F03 F06；pr-003 F01 F02 F03 F05 F06 F07 F08 F09 F10 F11 F12；pr-004 F08；pr-005 F01 F02 F04 F07 F09 F11 F12 ⇒ 并集 F01~F13 | **一致（13/13）** |
| 本轮写入面 | 仅 `prs/pr-002` / `prs/pr-003` / `prs/pr-004` / `prs/pr-005` + 本文件（`pr-001` 零改动） | 符合简报约束 |

> 复核方式：对 5 个 PR 文件解析「涉及功能点 / 文件范围（自有项，取 `^- \`oamp/…` 行）/ depends_on」三段并与 Gate 第二轮矩阵逐项集合比对；文件范围自有项集合 5/5 相等、功能点列表 5/5 相等、依赖边 5/5 相等。

---

## 4. 未处理项（明确归主 agent，非本轮遗漏）

1. **D-5 · `status.md` 的 PR 数（4 → 5）**：属主 agent 维护面，本简报亦未列入修正清单。建议在阶段 4 收口时更新为 5 个 PR（pr-001~005）并登记第二轮重划事实。
2. **D-7 的 architecture 回填**：`architecture.md` §9.4.1 的 6 → 7 回填、或把该清单改为「按桩分布派生」的书写方式，归主 agent（本轮明令不得改 `architecture.md`）。
3. **D-8 · A1 口径澄清**：pr-001 的 A1 子项②（`launcher.js` 与 `config.js` 第 4 键是否构成「只做一件可描述的事」）需要主 agent 明确口径（「单个模块内的一个主题」vs「同层同一数据面单元可含多文件」）。Gate 已证两种口径下依赖图与可合并性结论一致，故**不阻塞阶段 5 派发**。
4. **`deferred-demand-changes.md`**：Gate 核实「不存在，本迭代至今无搭置项」；本轮复核同结论（未新增）。

---

## 5. 越界声明

- 本轮**只写入**两处面：`docs/iterations/0022-agent-launcher-and-protocol-layer/prs/` 下的 **pr-002 / pr-003 / pr-004 / pr-005**（逐条文本修正）与 `docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/2026-09-14-pr-planner-round3.md`（本文件）；一切写入以**工作区地址**为根、按**绝对路径**寻址。
- **未修改** `architecture.md` / `prd.md` / `prd/*.md` / `demand.md` / `status.md` / `history.md` / `progress.md` 与既有 `clarifications/` 文件（只读）。
- **未改变**：PR 数量、文件名与编号、文件范围集合、依赖边集合、功能点覆盖（§3 逐项复核）。
- **未执行任何 git 写操作**（无 commit / branch / worktree / checkout / add / stash）；**未创建** PR worktree 或分支。
- **未触碰** `oamp/**` 与 `omp/**`（代码库只读，仅实读锚点用于逐条证据）。
- **未产出**全局 `tasks.md`；**未做**单 PR 内部的任务拆解。
