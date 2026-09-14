# 阶段 4 澄清记录（pr-planner · 第 2 轮）— 0023-yolo-approval-and-question-inbox

**角色**: pr-planner（阶段 4 · PR 规划）·第 2 轮（**Gate FAIL 返工**：消解 D-1 在 PR 文件上的残留）
**日期**: 2026-09-14
**迭代**: 0023-yolo-approval-and-question-inbox
**阶段**: 4（PR 规划）
**工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0023-yolo-approval-and-question-inbox`（本轮一切写入均以该地址为根的**绝对路径**）
**本轮性质**: **定点同步**——只做「信封类别字段改名」的字段名同步 + `pr-002:51` 的独立性论证**整段重写** + 三张功能卡**架构段** T-02 行的一次性例外同步。**不改** PR 编号 / 文件名 / 功能点归属 / 七字段结构 / 验收标准语义 / `depends_on` 声明 / `batch` 值；**不做**任务拆解、**不写**实现代码、**不做** git 写操作
**主输入**: `clarifications/2026-09-14-architect-round3.md`（§1 D-1 处置与选向理由、§3 逐 key 不相交证明、**§5.3 阶段 4 最小改写集**）
**辅输入**: `architecture.md` **v0.3.0**（§5.2 `:396-419`、§5.2.1 `:420-478`、§5.3 `:462-482`、§5.5 `:514`、§8 C15 `:593`、§12.4 `:714-741`）、`clarifications/verify-stage4-gate-20260914.md`（D-1 / D-2 / D-3 全文）、`prs/pr-001~003*.md`（改前只读）
**产出**: 更新后的 `prs/pr-001-approval-resolution-and-question-channel.md`、`prs/pr-002-web-envelope-and-decision-routing.md`、`prs/pr-003-inbox-question-item-frontend.md`、`prd/F04-question-surfacing.md` / `F05-question-shape.md` / `F10-permission-channel-preserved.md`（**仅架构段 T-02 行**）+ 本记录
**会话限制**: 运行在**无实时对话通道**的子 agent ⇒ **零自问自答**；本轮**未产生新问点**（转呈件为空，§7）。

---

## §1 改写依据（字段名、语义边界与改写集来源）

| 事项 | 结论 | 依据 |
|---|---|---|
| 信封类别字段新名 | **`request_kind`**（旧名 `kind`） | `architecture.md:396`（§5.2「新增 2 个（`request_kind` / `multiple`）」）、`:401`（字段表 `request_kind` 行）、`architect-round3.md:§2.1` |
| 取值域 | `'permission' | 'question'`（**逐字不变**） | `architecture.md:401`；`architect-round3.md:§2.3` |
| 缺失兜底 | `'permission'`（**逐字不变**） | `architecture.md:401`、`:451-458`（消费面「非字符串 ⇒ 按 `'permission'` 兜底」） |
| 钩子入参同名风格 | `requestKind`（JS 侧 camelCase，与 `chatId` / `agentId` 同风格；一对一写入 `request_kind`，无映射层） | `architect-round3.md:§2.1`；`architecture.md:739`（§12.4 解耦口径） |
| 逐行改写集 | 见 §2~§4（架构 round3 §5.3 的最小改写集 + 本轮按「旧名零残留」判据补齐的同一根因处） | `architect-round3.md:§5.3`；`architecture.md:733-735`（§12.4 需同步清单） |
| **通知类型 `kind`**（`confirmation_request` / `confirmation_cancelled` / `confirmation_decision` / `context_release` / `context_reset`） | **逐字不改** | `architecture.md:422-449`（`kind` = 通知类型判别键的角色表）、`:480`、`:482`（方向区分注） |
| 产品维度中「以 `kind` 指代两类条目」的用语 | **不改**（不属本轮授权面） | `architecture.md:737`（§12.4 明示）；本文档 §5 |
| 门禁 **D-2 / D-3** | **无需改产物**（D-2 按各清单自身作用域「本 PR 不修改」阅读即正确且修改面交集为空；D-3 由 `pr-002:20` 的内联条件性表述承载，登记即满足） | `verify-stage4-gate-20260914.md` 偏差记录 D-2 / D-3 两行的「建议处理」栏（均标「无需改产物 / 登记即满足」） |

---

## §2 `pr-001` 逐行改写（8 处，行号 = 改前文件行号）

| 行 | 改前 | 改后 | 依据（证据） |
|---|---|---|---|
| `:5`（上下文摘要） | 上浮为 `` `kind:'question'` `` | 上浮为 `` `request_kind:'question'` `` | `architect-round3.md:§5.3`（`pr-001` 行首项）；`architecture.md:396` |
| `:34`⑤（**2 处**） | ⑤ `raiseConfirmation` 支持 `` `kind:'question'` `` 字段集（`` `kind` `` + `multiple`） | ⑤ `raiseConfirmation` 支持 `` `request_kind:'question'` `` 字段集（`` `request_kind` `` + `multiple`） | `verify-stage4-gate-20260914.md:698`（D-1 原文引用该行⑤）；`architecture.md:401`（字段表）、`:739` |
| `:48`③（**1 处 — 详见 §6.2**） | rpc：`host_tool_call` → `` `notice{kind:'question'}` `` → 作答 | rpc：`host_tool_call` → `` `notice{request_kind:'question'}` `` → 作答 | §6 残留审计判据：`'question'` **不是**通知类型取值（类型表见 `architecture.md:422-449`）⇒ 该处 `kind` 是类别字段旧名而非通知判别键 |
| `:62`（**2 处**） | 恰一条 `` `kind:'permission'` `` 条目 …… `` `kind:'permission'` `` 的形状与交互 | 恰一条 `` `request_kind:'permission'` `` 条目 …… `` `request_kind:'permission'` `` 的形状与交互 | `architect-round3.md:§5.3`；`architecture.md:514`（§5.5 条目类别条）、`:480` |
| `:63`（**半句 1 处**） | 各产生 `` `notice{kind:'confirmation_request'}` ``，其 body 含 `` `kind:'question'` `` | 各产生 `` `notice{kind:'confirmation_request'}` ``（**不改**），其 body 含 `` `request_kind:'question'` `` | `architect-round3.md:§5.3`（明示 `:63` 的 `notice{kind:'confirmation_request'}` 是通知类型、只改半句）；`architecture.md:396` |
| `:72`②（择一判定声明） | 本 PR 只判 `notice` 信封面：`` `kind:'question'` `` + 字段集合 | 本 PR 只判 `notice` 信封面：`` `request_kind:'question'` `` + 字段集合 | `architect-round3.md:§5.3`（`:72`② 在最小改写集内） |

> **验收面收益（方向①的落点）**：改后 `:63` 的两个键**同体并存、各占一键**——通知 `kind` 恒为 `'confirmation_request'`、类别 `request_kind:'question'` ⇒ 该条验收标准**按字面可构造、可判定**（原「同一扁平 key 载两值」的不可判定性消失；门禁 A3·pr-001 的 fail 根因即此）。

---

## §3 `pr-002` 逐行改写（字段名 16 处 + `:51` 整段重写）

### 3.1 字段名同步（16 处）

| 行 | 处数 | 改前 → 改后 | 依据 |
|---|---|---|---|
| `:5`（上下文摘要） | 3 | 白名单增 `` `kind` ``／缺 `` `kind` `` 兜底／裁决路由按 `` `kind` `` 分化 → **均** `` `request_kind` `` | `architect-round3.md:§5.3`；`architecture.md:396`、`:451-458` |
| `:18`①（web.js 变更点） | 1 | 白名单 +`` `kind` ``（`'permission' \| 'question'`，缺失/非字符串 ⇒ 兜底 `'permission'`）→ +`` `request_kind` ``（值域与兜底逐字不变） | `verify-stage4-gate-20260914.md` D-1 原文引用 `:18`①；`architecture.md:401` |
| `:18`②（**超出架构最小集**） | 2 | 「裁决路由按 `` `kind` `` 分化」与「（`:1313-1340` 分支按 `` `kind` `` 排除）」→ `` `request_kind` `` | 同一根因；`architecture.md:480`（§5.3 旁路分化：既有分支**按 `request_kind` 排除**） |
| `:18`③（**超出架构最小集**） | 1 | `response` 的条目字段 +`` `kind` ``/`multiple` → +`` `request_kind` ``/`multiple` | `architecture.md:636`（§9.5：`GET /api/confirmations` 条目字段增 `request_kind`/`multiple`） |
| `:19`（API.md 变更点） | 1 | §3.20 的条目字段补 `` `kind` `` / `multiple` → `` `request_kind` `` / `multiple` | `architecture.md:636`（§9.5 文档面）；`:734`（§12.4 该行在需同步清单内） |
| `:21`①（测试新增断言） | 2 | 断言①的 `` `kind:'question'` `` 信封与条目含 `` `kind:'question'` `` → `` `request_kind:'question'` `` | `architecture.md:420-458`（§5.2.1 消费面读 `body.request_kind`）；`:734` |
| `:21`⑤（**超出架构最小集**） | 1 | 「缺 `` `kind` `` 的信封仍走 permission 类路径」→ 缺 `` `request_kind` `` | `architecture.md:401`（缺失兜底 `'permission'`）、`:451-458`（消费面兜底即惰性分支） |
| `:27`（验收：信封字段白名单） | 3 | 投递含 `` `kind:'question'` ``／`` `kind` `` 缺失 ⇒ 条目 `` `kind` `` 为 `'permission'` → 三处 `` `request_kind` `` | `verify-stage4-gate-20260914.md` D-1 原文引用 `:27`；`architecture.md:401` |
| `:28`（验收：全局帧形状） | 1 | 其 `data` 与列表元素同形状（含 `` `kind` ``）→ 含 `` `request_kind` `` | `architecture.md:451-458`（条目字段面） |
| `:29`（验收：回传载荷分化） | 1 | 回传载荷按 `` `kind` `` 分化 → 按 `` `request_kind` `` 分化（同行的 `` `notice{kind:'confirmation_decision'}` `` **不改**） | `architect-round3.md:§5.3`（明示 `notice{kind:'confirmation_decision'}` 处不改）；`architecture.md:480`、`:482` |

### 3.2 `:51` 依赖核实结论（**整段重写**）

| 项 | 内容 |
|---|---|
| 改前立论 | 以「**同一 key 双语义**」为前提之一（①「白名单（写 `kind`/`multiple`）与裁决路由（读 `entry.kind`）同处一文件，且对缺 `kind` 的投递按 `'permission'` 兜底」）——该前提已随 D-1 消解而**消失**，原文表述会让读者以为耦合仍被绕开 |
| 改后结构 | **① 契约面拆分**（生产面只增字段 / 消费面只读并兜底）＋**② 三条解耦论证**（通知类型判据零改动、兜底是既有设计、两侧判定面互不重叠）＋**③ 反向不成立**（`pr-001` 不读 `web.js` 白名单） |
| `depends_on` 声明 | **仍为「（无）」**——解耦成立（`architect-round3.md:§5.2` 三条论证 + `architecture.md:739`），不需改依赖声明 |
| 依据 | `architecture.md:420-478`（§5.2.1：改名根因表 + 逐 key 对照 + **字段面 = 生产面 / 消费面的边界**）、`:739`（§12.4 两 PR 解耦口径）、`:593`（C15 交集 = ∅）、`oamp/test/helpers/fake-node.js:26`（`startFakeNode`）、`oamp/test/confirmation-inbox.test.js:175-183`（`ENVELOPE` 工厂，实测首字段 `kind: 'confirmation_request'` = 通知类型） |

**重写后的三条论证（与 `architecture.md` §5.2.1 逐条对应）**：

1. **通知类型判据零改动**——`oamp/src/web.js:1597` 的 `body.kind === 'confirmation_request'` 逐字保留且**恒成立**（生产面不改通知 `kind` 的写法；类别值另置 `request_kind`，两值各占一键）⇒ 不再存在「生产面必须与消费面同批改判据」的耦合；D-1 的耦合**根因（同一扁平 key 承载两个值）已被消除**，不是被绕开。
2. **消费面对缺字段的兜底是既有的设计而非新加**——缺 `request_kind` ⇒ `'permission'`（与 v0.2.0 §5.2 口径同源，仅字段名变）⇒ 生产面未合入时新分支为**惰性**：既有投递照常走 permission 类路径，无条目丢失、无构建失败、无测试失败。
3. **两侧的判定面互不重叠**——本 PR 的新增断言可用**既有测试注入面**独立构造（`startFakeNode` + `ENVELOPE` 工厂直接合成 `request_kind:'question'` 的 `confirmation_request` 投给 web）；**反向亦然**：`pr-001` 的断言面是 agent 进程的 `notice` 信封面（`confirmation-roundtrip.test.js` / `protocol-layer.test.js`），不读 `web.js` 的白名单。

---

## §4 `pr-003` 逐行改写（10 处）

| 行 | 处数 | 改前 → 改后 | 依据 |
|---|---|---|---|
| `:5`（上下文摘要） | 1 | 前端第三栏按 `` `kind` `` 分化 → 按 `` `request_kind` `` 分化 | `architect-round3.md:§5.3`；`architecture.md:420-458` |
| `:17`①（app.js 变更点） | 1 | `renderInboxItem` 按 `` `entry.kind` `` 分化 → `` `entry.request_kind` ``（同行 `entry.multiple === true` 不变） | `architecture.md:553`（§6 F05 行）、`:566-570`（§9.2 前端变更点）；`architect-round3.md:§5.3` |
| `:19`③（测试 fixture） | 2 | 给定 `` `kind:'question'` `` ／ 给定 `` `kind` `` 缺失 → 两处 `` `request_kind` `` | `architect-round3.md:§5.3`（「测试 fixture 的 `kind`」）；`architecture.md:401` |
| `:25`（验收：条目形状 fixture） | 1 | 给定条目 `` `kind:'question'` `` → `` `request_kind:'question'` `` | 同上；`verify-stage4-gate-20260914.md` A3·pr-003 证据①（`web.js:1599-1607` 白名单今日不写该字段） |
| `:29`（验收：permission 零退化） | 1 | `` `kind` `` 缺失 / `'permission'` 的条目 → `` `request_kind` `` 缺失 | `architecture.md:401`（缺失兜底） |
| `:31`（验收：数据来源与载体不变） | 1 | **不区分条目类型**地统一消费 `` `kind` `` → 统一消费 `` `request_kind` `` | `architect-round3.md:§5.3`（`:31` 在最小改写集内） |
| `:40`（参考资料） | 1 | §5.2 信封（`` `kind` `` / `multiple` 的展示位）→ （`` `request_kind` `` / `multiple` 的展示位） | `architecture.md:396`（§5.2 新名） |
| `:47`①（depends_on → `pr-002` 的证据栏） | 2 | 「将按 `` `entry.kind` `` / `entry.multiple` 分化 …… 条目恒无 `` `kind` ``」→ `` `entry.request_kind` `` / `entry.multiple` …… 条目恒无 `` `request_kind` `` | `architecture.md:566-570` + `:739`（消费面只读 `body.request_kind`）；本行**其余内容与依赖结论不变** |

> `pr-003` 的 `depends_on`（→ `pr-002`）与三条证据**不变**——依赖的真实性不因字段改名而变（唯一产出点仍是 `pr-002` 的 `oamp/src/web.js:1597-1610`）；`batch` 仍为 `2`。

---

## §5 一次性例外的 PRD 同步（**仅架构段 T-02 行**，3 文件 × 3 处 = 9）

主 agent 本轮授权的一次性例外：把三张卡**架构段**（「架构待填（阶段 3 · 已回填）」表）T-02 行中指向信封类别字段名的旧名同步为新名。三行**逐字同文**（改前实读确认）。

| 文件:行 | 处数 | 改前 → 改后 | 依据 |
|---|---|---|---|
| `prd/F04-question-surfacing.md:42` | 3 | ①「（`` `kind` `` 取值表达 + 问题文本 ……）」→ `` `request_kind` ``；②「**新增 `` `kind` ``（`'permission' \| 'question'`，两类条目都带）」→ `` `request_kind` ``；③「**是否允许自由文本由 `` `kind:'question'` `` 蕴含**」→ `` `request_kind:'question'` `` | `architecture.md:736`（§12.4：**仅架构段字段名追溯标注** → `request_kind`；同卡的验收标准 / 边界**不动**）、`:396` |
| `prd/F05-question-shape.md:42` | 3 | 同上（逐字同文行） | 同上 |
| `prd/F10-permission-channel-preserved.md:43` | 3 | 同上（逐字同文行；该卡 T-02 行号为 43） | 同上 |

**产品维度零改动（逐段声明）**：三张卡的 `**功能 ID**` / `**来源**` / `**迭代**` / `**产品对象**` / `功能描述` / `验收标准`（含判定方式与逐字来源）/ `边界（不包含）` / ``口径更替落点`（对 `demand.md` 登记⑧ 的处置）/ `越界自查` **全部原样未动**；`demand.md`、`prd.md`、`prd/F01~F03`、`F06~F09`、`F11~F16` 与 `prd/F07` 的 T-04 行（**不属授权面**）**未触碰**。

---

## §6 残留审计（旧字段名零残留）

### 6.1 检索方法与结果

检索式 = `[^_0-9a-zA-Z]kind[^_0-9a-zA-Z]`（case-sensitive；排除 `request_kind` / `requestKind` 内部命中，要求 `kind` 前后均为非词字符）。

| 文件 | 残留命中行 | 命中内容 | 判定 |
|---|---|---|---|
| `pr-001` | `:63`（1） | `` `notice{kind:'confirmation_request'}` `` | **通知类型判别键 ⇒ 按 §1 规则保留** |
| `pr-002` | `:18`（1）、`:21`（1）、`:29`（1） | `` `notice{kind:'confirmation_decision', …}` `` | 同上（web→agent **回传向**通知类型） |
| `pr-002` | `:51`（3） | `body.kind === 'confirmation_request'`、「通知 `kind` 恒为 `'confirmation_request'`」、「类别值另置 `request_kind`」 | 同上——**重写段刻意保留 `kind`** 以逐字描述既有判据（`architecture.md:482` 的方向区分注同法） |
| `pr-003` | **0 行** | — | 该文件已无任何裸 `kind` |

- 三份 PR 文件中**不存在**残留的「类别字段旧名」⇒ 门禁 D-1 在 PR 文件上的表述已清零。
- `prd` 三张卡的剩余命中（`F04:30`、`F05:4` / `:32` / `:46` / `:47` / `:48`、`F10:1` / `:16` / `:50`）**全部落在产品维度段**（边界 / 来源 / 验收标准 / 口径更替落点 / 标题）——按 `architecture.md:737`（§12.4：产品维度用语**不改**，其 `kind` 与 `request_kind` 一一对应、无语义漂移）**有意保留**；三卡的**架构段 T-02 行已无裸 `kind`**。

### 6.2 超出架构最小改写集的两类处（登记，理由 = 同一根因 + 本轮判据）

架构 round3 §5.3 / `architecture.md:733-735` 的逐行清单是**最小集**；本轮按主 agent 的「**旧字段名零残留**」判据，对**同一根因**的其余命中一并同步：

| # | 位置 | 架构清单是否列出 | 本轮处置与理由 |
|---|---|---|---|
| 1 | `pr-001:48`③ 的 `` `notice{kind:'question'}` `` | ❌（`:733` 只点名该行的 `notices('confirmation_request')` 是通知类型、不改） | **改**。`'question'` **不在通知类型取值域内**（类型表 = `confirmation_request` / `confirmation_cancelled` / `confirmation_decision` / `context_release` / `context_reset`，`architecture.md:422-449`）⇒ 该处 `kind` 描述的是**类别**，属旧名残留；不改则与同行 `:63` 改后的写法自相矛盾（`:48` 是 `:63` 的测试面复述） |
| 2 | `pr-002:18`② / ③、`pr-002:21`⑤ | ❌（`:734` 只列 `:18`①、`:21`①） | **改**。三处均为**同一行内**的同类引用（「按 `kind` 排除」「条目字段 +`kind`」「缺 `kind` 的信封」），且 `architecture.md:480` / `:636` 已给出新名；只改①会造成**同一行内新旧混用** |

两类合计 4 处，均**不改变任何验收标准的语义或数量**（仅字段名替换），亦**不改变依赖声明 / 文件范围 / 功能点归属**。

### 6.3 本轮改写量

| 面 | 改写处数 |
|---|---|
| `pr-001` | 8（`:5` 1、`:34` 2、`:48` 1、`:62` 2、`:63` 1、`:72` 1） |
| `pr-002` | 16（`:5` 3、`:18` 4、`:19` 1、`:21` 3、`:27` 3、`:28` 1、`:29` 1）+ `:51` **整段重写 1 行** |
| `pr-003` | 10（`:5` 1、`:17` 1、`:19` 2、`:25` 1、`:29` 1、`:31` 1、`:40` 1、`:47` 2） |
| `prd/F04`、`F05`、`F10` | 9（3 × 3，各卡 T-02 行） |
| **合计** | **43 处字段名替换 + 1 行整段重写** |

---

## §7 复核与声明（阶段 4 完成定义四项 + 转呈件）

### 7.1 完成定义复核（判据均以**脚本从改后文件机械提取**，非人工目测）

| # | 完成定义 | 结论 | 依据（机械提取结果） |
|---|---|---|---|
| **V1** | 三份 PR **七字段齐备** | ✅ | 逐文件提取 `## 上下文摘要` / `## 涉及功能点` / `## 文件范围` / `## 验收标准` / `## 参考资料` / `## depends_on` / `## batch` = **7/7 × 3 份**，无缺项、无重项 |
| **V2** | **F01~F16 覆盖不变** | ✅ | `pr-001` = {F01,F02,F03,F04,F05,F06,F07,F08,F09,F10,F11,F12,F13,F16}（14）；`pr-002` = {F04,F05,F07,F10,F14,F15}（6）；`pr-003` = {F05,F06,F07,F10,F15}（5）；**并集 = F01~F16（16/16），缺失 ∅、越界 ∅**（与门禁 B3 的 pass 结论一致） |
| **V3** | 文件范围**两两交集为空** | ✅ | 修改面提取（去 `:行号` 后缀归一化）：`pr-001` **18 个**（8 生产 + `oamp/README.md` + 9 测试，含新建 `oamp/test/approval-resolution.test.js`）、`pr-002` **3 个**（`oamp/src/web.js`、`oamp/API.md`、`oamp/test/confirmation-inbox.test.js`；`oamp/llms.txt` 为**条件性**、在文件范围栏内联声明）、`pr-003` **3 个**（`oamp/web/app.js`、`oamp/web/style.css`、`oamp/test/inbox-console.test.js`）；**pr-001∩pr-002 = ∅、pr-001∩pr-003 = ∅、pr-002∩pr-003 = ∅**，并集 24（与门禁 B3 逐字一致） |
| **V4** | 依赖图**仍无环** 且 **`pr-001` ↔ `pr-002` 的契约耦合已消除** | ✅ | ① **无环**：`pr-001` = （无）、`pr-002` = （无）、`pr-003` → `pr-002`（单向）；依赖图 = 三节点一条边，无环（`batch` = 1 / 1 / 2，未作栅栏用）。② **耦合已消除**：`request_kind` / `multiple` 与既有 notice body 的 **key 并集（10 个）交集 = ∅**（`architecture.md:420-478` 逐 key 带 `文件:行号` 对照 + `:593` C15 自查项 ✅）；`web.js:1597` 的通知类型判据**零改动且恒成立** ⇒ D-1 的耦合根因（同一扁平 key 承载两个值）消失，而非被绕开；两侧判定面互不重叠（生产面断言面在 agent 进程 / 消费面可用 `startFakeNode` + `ENVELOPE` 独立构造）⇒ 两 PR **各自可独立合入、可同波并发**（该结论已写入 `pr-002:51` 与 `pr-003:47`③） |

### 7.2 报告契约四项（本轮交付摘要）

| PR | 涉及功能点 | 文件范围 | `depends_on` + 证据 | batch |
|---|---|---|---|---|
| `pr-001-approval-resolution-and-question-channel.md` | F01~F13、F16（14） | 18 个文件（8 生产：`src/{protocol,config,launcher,oneshot-client,acp-client,rpc-client,agent,context-pool}.js` ＋ `oamp/README.md` ＋ 9 测试含新建 `test/approval-resolution.test.js`） | **（无）**——档位真源与三实现消费由 `buildArgv` 签名收窄**必然同批**（`launcher.js:109-132` + 三调用点 `rpc-client.js:122` / `acp-client.js:165-169` / `oneshot-client.js:93-121`），提问通路层 1+层 2 同批（`context-pool.js:201-206` 为唯一钩子入口）；非两个 PR 间的关系 | 1 |
| `pr-002-web-envelope-and-decision-routing.md` | F04、F05、F07、F10、F14、F15（6） | 3 个文件（`oamp/src/web.js`、`oamp/API.md`、`oamp/test/confirmation-inbox.test.js`；`oamp/llms.txt` 条件性） | **（无）**（**重写后的依据**：`architecture.md` §5.2.1「字段面 = 生产面 / 消费面的边界」＋ §12.4「两 PR 的解耦口径」——通知类型判据零改动、消费面对缺字段兜底是既有设计、两侧判定面互不重叠） | 1 |
| `pr-003-inbox-question-item-frontend.md` | F05、F06、F07、F10、F15（5） | 3 个文件（`oamp/web/app.js`、`oamp/web/style.css`、`oamp/test/inbox-console.test.js`） | **→ `pr-002`**，证据不变（① `oamp/web/app.js:671-681` 的 `renderInboxItem` 按 `entry.request_kind` / `entry.multiple` 分化，**唯一产出点** = `oamp/src/web.js:1597-1610`；② question 提交 body 由 `oamp/src/web.js:1301-1311` 校验（今日只认 `option_id`）⇒ 未合入必 400；③ 反向不成立，`pr-002` 不读 `web/app.js` ⇒ 单向、无环） | 2 |

### 7.3 转呈件与疑问

**转呈件：空。** 本轮为字段名同步 + 论证重写，全部依据可由 `architecture.md` v0.3.0（§5.2 / §5.2.1 / §5.3 / §5.5 / §8 C15 / §12.4）与 `clarifications/2026-09-14-architect-round3.md` §5 复核 ⇒ **无新的 `[model_inferred]`、无 `[待裁决]`、无新增疑问**；第 1 轮登记的 5 条疑问（`2026-09-14-pr-planner-round1.md:§7.2`）性质与本轮无关，**原样留档**，本轮不新增、不改动其结论。

---

## §8 未越界声明

本阶段（阶段 4 · 第 2 轮）**唯一写入**为**本工作区内**的绝对路径文件：

- `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0023-yolo-approval-and-question-inbox/docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-001-approval-resolution-and-question-channel.md`（改写 8 处）
- `…/prs/pr-002-web-envelope-and-decision-routing.md`（改写 16 处 + `:51` 整段重写）
- `…/prs/pr-003-inbox-question-item-frontend.md`（改写 10 处）
- `…/prd/F04-question-surfacing.md`、`…/prd/F05-question-shape.md`、`…/prd/F10-permission-channel-preserved.md`（**仅架构段 T-02 行，各 3 处 = 一次性例外授权面**）
- `…/clarifications/2026-09-14-pr-planner-round2.md`（本文件，新建）

- **未修改**：`architecture.md`（v0.3.0 只读）、`prd/F01~F03` / `F06~F09` / `F11~F16*.md`、`prd.md`、`demand.md`、`status.md`、`history.md`、既有 `clarifications/*.md`（含门禁报告与 architect 三轮记录，全程只读）、`clarifications/probes/**`；
- **未修改**三份 PR 的**七字段结构 / PR 编号 / 文件名 / 涉及功能点清单 / 文件范围清单 / 验收标准条数与语义 / 零改动清单 / `depends_on` 声明 / `batch` 值**（`pr-002:51` 的重写仅替换**论证文本**，`depends_on` 仍为「（无）」）；
- **未触碰** `oamp/**`（只读实读 `test/helpers/fake-node.js:26`、`test/confirmation-inbox.test.js:175-183` 两处锚点核对）、`omp/**`、`roles/**`、`docs/iterations/0021-*` 与 `0022-*`（只读体例参照）；
- **未做** git 写操作（无 add / commit / checkout / branch / worktree）；**未运行**任何测试、构建、格式化或服务（阶段 5/6 职责；本轮的机械提取为**只读脚本**，不落盘、不改文件）；
- **未做**架构或产品决策：字段命名与语义边界一律照 `architecture.md` v0.3.0 与 architect round3 记录落盘，**未新增**架构决策 / 组件 / 依赖边（新增实体 = 0）；**未做**单 PR 内部任务拆解、**未产出**全局 `tasks.md`。
