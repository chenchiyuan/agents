# 阶段 3 澄清记录（architect · 第 3 轮）— 0023-yolo-approval-and-question-inbox

**角色**: architect（阶段 3 · 技术架构）·第 3 轮
**日期**: 2026-09-14
**迭代**: 0023-yolo-approval-and-question-inbox
**工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0023-yolo-approval-and-question-inbox`（本轮一切写入均以该地址为根的**绝对路径**）
**本轮性质**: **定点修正（消解门禁 D-1，高·阻塞）** —— 只改**字段命名与受影响表述**，**不新增架构决策、不改 L1-1~L1-7 的语义、不增删组件、不改产品维度、不改需求合同、不做任务拆解、不写实现代码**
**主输入**: `clarifications/verify-stage4-gate-20260914.md`（阶段 4 门禁报告的 D-1 / D-2 / D-3 全文）
**辅输入（只读）**: `architecture.md` v0.2.0（683 行）、涉事代码实读 `oamp/src/agent.js:220-330`、`oamp/src/web.js:1285-1320 / 1570-1620 / 1693-1704`、`oamp/src/inbox.js`、`oamp/src/context-pool.js:93-96`、`prs/pr-001~003*.md`（只读，用于产出受影响清单）
**产出**: `architecture.md` **v0.3.0** + 本记录
**会话限制**: 本阶段仍运行在**无实时对话通道**的子 agent 中 ⇒ **零自问自答**；本轮**未产生新问点**（转呈件为空，§6）。

---

## §1 问题原文（D-1）与本轮处置

### 1.1 问题（原样摘录要点）

> **D-1（高，阻塞）** `architecture.md:392-407`（§5.2）「信封沿用既有 7 字段，**新增 2 个**（`kind` / `multiple`）」，`kind` = `'permission' | 'question'`；`pr-001:63`「各产生 `notice{kind:'confirmation_request'}`，其 body 含 `kind:'question'`」。
> 通知 body 是扁平结构且 `kind` 已是**通知类型**判别键（`oamp/src/agent.js:245` `{ kind, ...fields }`、`:291` `kind:'confirmation_request'`；`oamp/src/web.js:1597` 判据、`:1599-1607` 白名单重建）。`pr-001:34`⑤ 把 `kind` 放进 `fields` ⇒ 展开后覆盖通知类型：**保持 pr-002 现有判据则提问请求在 `web.js:1597` 判否后被丢弃**（无条目）；若改判据，则 `pr-001:63` 的「通知 `kind = confirmation_request`」半句不成立。**同一扁平 key 无法同时承载两值**。
> ⇒ 两 PR（阶段 5 计划**并发派发**的一对）独立性 fail。

### 1.2 处置：**方向 ① —— 信封类别字段改名**（不改通知判别口径）

| 方向 | 内容 | 判定 |
|---|---|---|
| **① 信封类别字段改名** | 改名为与既有通知 body key 集**不相交**的名字 | ✅ **本轮采纳** |
| ② 改通知判别口径 | 让 `web.js` 不再依赖 `body.kind` 判类（改由 `confirmation_id` 等识别） | ❌ **否决** |

### 1.3 选 ① 的理由（对被否方向 ② 的逐项对比）

1. **改动面最小 ⇒ 零既有回归**。方向 ② 要动的是**既有提示通路**：`web.js:1597`（`confirmation_request`）、`:1613`（`confirmation_cancelled`）、`:1618`（`context_released` / `context_reset`）三个判读点 + `agent.js:536` / `:540` 的回传向判读 + `web.js:1311` / `:598` / `:632` 的生产面，且既有通知**四型**的同 key 语义必须整体更换，其全部既有测试（0021 的 `confirmation-inbox` / `inbox-console` 面）需同步迁移。方向 ① 只改**本迭代新增字段**的名字 ⇒ **`web.js:1597` 判据逐字保留**、四条通知类型逐字保留、`sendControlNotice` 面逐字保留、permission 类 `{option_id, text}` 与 `settleConfirmation` 逐字保留（奥卡姆剃刀 + 外科手术式精准：只触碰必须修改的部分）。
2. **不相交可机械核验**（本轮硬约束 1）：`request_kind` / `multiple` 与既有 notice body 的 key 并集**交集为空**（§3 逐 key 带 `文件:行号`）。
3. **语义零变化**（本轮硬约束 3）：取值域 `'permission' | 'question'`、缺失兜底 `'permission'`、两类分化面（§5.3 回传载荷 / §5.3 旁路分化 / §5.5 映射）**逐字不变**；`permission` 类既有逐字行为（`option_id` / `text`）不受影响；L1-1~L1-7 的语义**逐字未变**（§2）。

---

## §2 改名结果与"只改名"证明

### 2.1 改名后的字段名

| 项 | 值 |
|---|---|
| **新字段名** | **`request_kind`** |
| 旧名（v0.2.0） | `kind` |
| 取值域 | `'permission' | 'question'`（两值，**不变**） |
| 缺失兜底 | `'permission'`（**不变**，兼容既有投递） |
| 出现位置 | 信封（agent→web `notice{kind:'confirmation_request'}` 的扁平 body）→ `web.js` 白名单重建的条目 → `GET /api/confirmations` 的条目 → `web/app.js` 的 `renderInboxItem` → `oamp/API.md` 的条目字段 |
| 同源内部名 | 钩子入参 `requestKind`（JS 侧 camelCase，与 `chatId` / `agentId` 同风格）⇒ `raiseConfirmation` **一对一**写入信封的 `request_kind`（**无映射层**） |
| 是否新增"别名" | **无**。全链路**单名到底**（信封字段 = 条目字段 = 前端字段 = 文档字段） |

### 2.2 命名选择（在 `request_kind` / `entry_kind` / `item_kind` 中取前者）

1. **语义自洽**：信封描述的对象是"一次上浮的**请求**"，两个取值描述的正是"哪一类请求"；与同体上的通知类型 `'confirmation_request'` 合成一句可读的陈述——`{ kind: 'confirmation_request', request_kind: 'question', … }`。
2. **不混层**：`entry` / `item` 是 **web 侧容器**词汇（`renderInboxItem` / `.inbox-item` / 在途表条目）。把容器名写进**跨进程信封**会让"信封字段"与"前端容器"概念混层；`request` 是信封自身描述的对象。
3. **单名覆盖全链路**（见 2.1 末行）：若取 `entry_kind`，则信封上叫 `entry_*`、条目上叫 `entry_*` —— 名字锚在容器而非对象；若取 `item_kind`，同类问题。取 `request_kind` 后无需"信封叫 X、条目叫 Y"的双名，也无需映射层。
4. **与通知判别键的视觉区分度**：`kind`（通知类型）与 `request_kind`（信封类别）在**同一扁平体**上并置时，前者是 3 字符的通名、后者带限定词，读到 `fields` 展开处不会误认。

### 2.3 "只改名、语义不动"的逐条证明（本轮硬约束 3）

| 被保护的既有/已确认结论 | 本轮动作 | 证据 |
|---|---|---|
| **L1-1~L1-7 的语义** | 逐字未改（仅 L1-3 推荐①内**类别字段名**以本版为准，且只在 §4.1 表头加注、**表内候选/理由原文留档**） | `architecture.md:338`（L1-3 行逐字保留）、`:332`（表头注） |
| **L1-3 的字段形状结论**（+2 字段、文本用 `title`、选项用 `options`、自由文本由类别蕴含、无选项 = `options: []`） | 语义逐字不变，仅第一个字段名替换 | `architecture.md:396-416`（§5.2 表 + M3 对照） |
| **L1-4 的按类分化** | 语义逐字不变（仅指向类别的字段名替换） | `architecture.md:480`（旁路分化）、`:567`（T-04） |
| **`permission` 类既有逐字行为**（`option_id` / `text` / 点选即裁决 / `web.js:1308-1324` 旁路） | **零改动** | `architecture.md:401`（字段表 permission 列 `'permission'` 不变）、`:480`（"既有路径逐字不变"）、`:548`（F10 验收 3 不变） |
| **既有通知四型与判据** | **零改动** | `architecture.md:427` / `:429` / `:438`（§5.2.1 明示通知类型处不改）、`:458`（`web.js:1597` 判据零改动） |
| **`multiple` 字段** | 名字与语义均未动（既有 body key 并集不含它，无需改） | §3 对照表 |

---

## §3 与既有通知 `kind` 的共存证明（本轮硬约束 1）

### 3.1 结论

- **既有通知 body 的 key 并集（两方向，10 个）** = {`kind`, `chat_id`, `text`, `confirmation_id`, `agent_id`, `tool`, `title`, `options`, `created_at`, `option_id`}
- **本次新增字段名** = {`request_kind`, `multiple`}
- ⇒ **交集 = ∅**（同一扁平体上两个 key 各载一值，"同一扁平 key 双语义"**不复存在**）

### 3.2 逐 key 对照证据（全部 2026-09-14 实读 `oamp/**`）

| # | key | 实读出处（`文件:行号`） | 语义 | 与本轮新增字段相交 |
|---|---|---|---|---|
| 1 | `kind` | `agent.js:245`（`const body = fields === null ? { chat_id: chatId, kind, text } : { kind, ...fields };`）、`:291`（`kind: 'confirmation_request'`）、`:319`（`kind: 'confirmation_cancelled'`）、`:536` / `:540`（回传向判读）；`web.js:1597` / `:1613` / `:1618`（三处判读）、`:1311`（`kind: 'confirmation_decision'`）、`:598` / `:632`（`kind: 'context_release'`） | **通知类型判别键** | **不相交** |
| 2 | `chat_id` | `agent.js:245` / `:282`；`web.js:1601` / `:1311` / `:598` | 归属对话 | **不相交** |
| 3 | `text` | `agent.js:245`；`web.js:1311` | 提示正文 / 裁决附文 | **不相交** |
| 4 | `confirmation_id` | `agent.js:281` / `:319`；`web.js:1600` / `:1614` / `:1311` | 在途项 id | **不相交** |
| 5 | `agent_id` | `agent.js:283`；`web.js:1602` | 发起 agent | **不相交** |
| 6 | `tool` | `agent.js:284`；`web.js:1603` | 工具名 / 承载名 | **不相交** |
| 7 | `title` | `agent.js:285`；`web.js:1604` | 请求正文 / 问题文本 | **不相交** |
| 8 | `options` | `agent.js:286`；`web.js:1605` | 选项集合 | **不相交** |
| 9 | `created_at` | `agent.js:287`；`web.js:1606` | 登记时刻 | **不相交** |
| 10 | `option_id` | `web.js:1311`（web→agent 裁决回传） | permission 类选中项 | **不相交** |

**并集完备性说明**：agent→web 方向的通知由**唯一生产者** `agent.js::sendNotice`（`:243-259`）写出，其 body 只有两种形态——无信封 `{ chat_id, kind, text }`（调用侧实参来源 `context-pool.js:95` `this.onNotice({ chatId, kind, text, origin })`，经 `:245` 映射为 snake_case）与带信封 `{ kind, ...fields }`（`fields` 的两个调用点：`raiseConfirmation:280-288` 的 7 字段、`cancelPending:319` 的 `{ confirmation_id }`）；web→agent 方向由 `web.js::sendControlNotice`（`:1695-1703`）写出，body 只有两条形态（`:1311` 裁决回传、`:598` / `:632` 上下文释放）。**上表 10 个 key 即这两个方向、四类通知形态的 key 全并集**，无第五种形态。

### 3.3 为什么必须改名（根因复现）

`agent.js:245` 的展开次序是 `{ kind, ...fields }` —— **`fields` 在 `kind` 之后展开** ⇒ 若类别字段也叫 `kind`，`fields.kind`（值 `'question'`）会**覆盖**通知类型 `'confirmation_request'` ⇒ 该通知在消费侧 `web.js:1597`（`body.kind === 'confirmation_request'`）判否后被丢弃（条目不入表）。改名后该覆盖只作用于 `request_kind`，通知类型 `kind` 恒为 `'confirmation_request'`。

---

## §4 受影响章节清单（本轮硬约束：只改字段命名与受影响表述）

### 4.1 `architecture.md` 内（**本轮已全部同步**）

| 章节 | 同步内容 |
|---|---|
| 文首（版本行 / 本轮收口 / 前轮收口） | 版本 → **0.3.0**；新增第 3 轮收口行；前轮收口保留 |
| §0 状态表 | 新增一行「§5.2 / §5.3 / §5.5 信封类别字段改名（第 3 轮 · 门禁 D-1 定点修正）」；§12 行补记 §12.4 |
| §1.3（G6 / G7） | 末列"`kind` 与提问形状的扩展依据" → `request_kind`；G7"旁路须按 `kind` 分化" → `request_kind` |
| §2.6 | "①`kind:'permission'` 通路不可删" → `request_kind:'permission'` |
| §3.2（`src/agent.js`） | "信封扩展与 `kind` 分化" → `request_kind` |
| §3.2（`web/app.js`） | "条目按 `kind` 分化渲染" → `request_kind` |
| §3.2（`src/web.js`） | "① 信封白名单补 `kind`/`multiple` ② 裁决路由按 `kind` 分化" → `request_kind` ×2 |
| §3.3（流 2） | 钩子入参 `kind:'question'` → `requestKind:'question'`；"信封（`kind:'question'`）" → `request_kind:'question'` |
| §4.1（表头注） | 新增定点修正说明：**只改名、七条语义逐字不变、表内原文留档** |
| §4.1（L1-3 行） | **表内候选/理由原文按留档体例保留**（不清洗），以表头注消歧 |
| §4.2（L2-3） | 理由列追加"**类别标记**：钩子入参 `requestKind` → 信封 `request_kind`，一对一、无映射层，缺省 `'permission'`" |
| §5.1（并存形态条） | "由 `kind` 区分" → `request_kind` |
| §5.2（字段表 + M3 对照） | 新增字段名 → `request_kind`（4 处）；字段说明补"**不与通知判别键 `kind` 同 key**" |
| §5.2（**新增 §5.2.1**） | 「与既有通知 `kind` 的共存证明」：根因表 + **逐 key 对照表** + key 并集/交集结论 + **生产面 / 消费面字段面边界表** |
| §5.3（旁路分化） | `kind:'question'` / `kind:'permission'` → `request_kind:…`；"既有分支按 `kind` 排除" → `request_kind` |
| §5.3（新增方向区分注） | 明示本节回传载荷的 `kind` 是**回传向通知判别键**，与信封类别字段不同 key、不同方向 |
| §5.5（新增条目类别条） | 本表除「审批门」外五行产出的条目**一律 `request_kind:'question'`**；审批门为 `'permission'` |
| §6（F09） | "同栏同 `kind`" → `request_kind` |
| §7（T-02 / T-04） | 落定文本内的字段名 → `request_kind` |
| §8（C7 / C9） | 分化依据字段名 → `request_kind` |
| §8（**新增 C15**） | **机械自查项**："信封新增字段名与既有通知 body 的 key 集不相交"，附本轮核验结果 |
| §9.1（`agent.js` / `web.js`）/ §9.2（`web/app.js`） | 变更点文本内的字段名 → `request_kind` |
| §9.5 文档面 | `GET /api/confirmations` 条目字段增 `request_kind`/`multiple` |
| §10 奥卡姆表 | "新信封字段"行 → `request_kind` |
| §12.4（**新增**） | 定点修正登记：问题、处置与理由、L3 分级、本文件内同步清单、**本文件之外需同步清单**、两 PR 解耦口径 |
| §13 | 新增第 3 轮写入条目；"未触碰功能卡产品维度"条补第 3 轮说明 |

### 4.2 `architecture.md` 之外（本轮**未改**，逐条登记，供相应阶段同步）

> 本轮写入约束 = "唯一写入 = `architecture.md` + 本轮记录"（派发约束）；且产品维度**禁止修改**（角色红线：`prd/*.md` 的产品维度不动）。下表把需同步的位置落到 `文件:行号`。

| 位置 | `kind` 命中行号（2026-09-14 实读） | 需同步内容 | 归属阶段 |
|---|---|---|---|
| `prs/pr-001-approval-resolution-and-question-channel.md` | `:5`、`:34`⑤、`:62`（2 处）、`:63`（"其 body 含 `kind:'question'`"半句）、`:72`② | 信封类别字段 → `request_kind`；`:48` 的 `notices('confirmation_request')` 与 `:63` 的 `notice{kind:'confirmation_request'}` 是**通知类型**，**不改**。`:64~:67` 的"信封 9 字段"表述本身不需改（字段数不变） | **阶段 4 返工** |
| `prs/pr-002-web-envelope-and-decision-routing.md` | `:5`、`:18`①、`:19`、`:21`①、`:27`、`:28`、`:29`、`:51`（依赖核实结论全文） | 同上；`:18` 中 `notice{kind:'confirmation_decision'}` 处不改；**`:51` 的解耦论证须按 §5 重写**（原文以"同一 key 双语义"立论，现该前提已消失） | **阶段 4 返工** |
| `prs/pr-003-inbox-question-item-frontend.md` | `:5`、`:17`①（`entry.kind`）、`:19`②、`:25`（测试 fixture）、`:29`、`:31`、`:40`、`:47`①（`entry.kind` / `entry.multiple`） | 条目字段名与测试 fixture 的 `kind` → `request_kind`（pr-003 依赖已声明的 pr-002 交付物，随字段名同步） | **阶段 4 返工** |
| `prd/F04-question-surfacing.md:42`、`prd/F05-question-shape.md:42`、`prd/F10-permission-channel-preserved.md:43`（三处**架构段** T-02 行，逐字同文） | — | **仅架构段字段名追溯标注** → `request_kind`；同卡的验收标准 / 边界 / 来源等**产品维度不动** | 阶段 2 或由主 agent 派发（**本阶段不越界**） |
| `prd.md` 与 `prd/F04` / `F05` / `F07` / `F08` / `F09` / `F10` 中以 `kind:'permission'` / `kind:'question'` 指代"两类条目"的**产品维度用语**（7 个文件有命中） | — | **不改**。其文以 `kind` 指代类别，与 §5.2 的 `request_kind` **一一对应**、无语义漂移（卡的验收标准说的是"哪一类条目"，不是"哪个 key"）；如需消歧，属产品阶段的表述修订，不在本阶段范围 | — |

---

## §5 两 PR 契约解耦说明（本轮硬约束 2 —— 供阶段 4 更新 `pr-001` / `pr-002` / `pr-003`）

### 5.1 同一信封上的字段面分工

| 面 | 归属 | 本轮确定的字段面 | 缺失 / 未合入时的行为 |
|---|---|---|---|
| **生产面**（agent 进程） | `pr-001`（`agent.js::raiseConfirmation` + 钩子接线） | 在既有 7 字段上**追加** `request_kind`（由钩子入参 `requestKind` 一对一透传；入参缺省 ⇒ `'permission'`）与 `multiple`；通知类型 `kind` 恒为 `'confirmation_request'`（**既有写法 `agent.js:291` 逐字不变**） | 生产面未合入 ⇒ 信封仍是既有的 7 字段 + 通知 `kind`（**既有形态**），消费侧走兜底路径 |
| **消费面**（web 进程 + 前端） | `pr-002`（`web.js` 白名单 + 裁决路由）／`pr-003`（`web/app.js` 渲染 + 提交） | `web.js` 的 `confirmation_request` 分支白名单**增读** `body.request_kind`（**非字符串 ⇒ 兜底 `'permission'`**）与 `multiple`（非布尔 ⇒ `false`）；裁决路由按 `entry.request_kind` 分化；前端按 `entry.request_kind` 分化 | 消费面未合入 ⇒ 生产面新增的两个字段被**忽略**（`web.js` 白名单不取），既有 permission 类路径逐字照旧 |

### 5.2 解耦成立的三条论证（替换 `pr-002:51` 的原文论证）

1. **`web.js:1597` 的通知类型判据零改动**：`body.kind === 'confirmation_request'` 仍然成立且**恒成立**（生产面不改 `kind` 的写法；类别值另置 `request_kind`）⇒ 不再存在"生产面必须与消费面同批改判据"的耦合。D-1 的耦合**根因（同 key 双语义）已被消除**，不是被绕开。
2. **消费面对缺字段的兜底是既有的设计而非新加**：缺 `request_kind` ⇒ `'permission'`（这与 v0.2.0 §5.2 的兜底口径同源，只是字段名变了）⇒ **生产面未合入时新分支为惰性**：既有投递照常走 permission 类路径，无条目丢失、无构建失败、无测试失败。
3. **两侧的判定面互不重叠**：`pr-001` 的断言面是 agent 进程的 `notice` 信封面（`test/confirmation-roundtrip.test.js` / `test/protocol-layer.test.js`）；`pr-002` 的断言面可用**既有测试注入面独立构造**（`oamp/test/helpers/fake-node.js:26` 的 `startFakeNode` + `oamp/test/confirmation-inbox.test.js:175` 的 `ENVELOPE` 工厂，直接把 `request_kind:'question'` 投给 web）⇒ 不需要 `pr-001` 的任何代码。**反向亦然**：`pr-001` 不读 `web.js` 的白名单。

### 5.3 阶段 4 更新 PR 文件时的最小改写集

| PR | 最小改写 | 备注 |
|---|---|---|
| `pr-001` | `:5` / `:34`⑤ / `:62`（2 处）/ `:63`（半句）/ `:72`② 的 `kind` → `request_kind` | 验收条"其 body 含 `request_kind:'question'`"由此**按字面可构造、可判定**（通知 `kind` 恒为 `'confirmation_request'`，两值各占一键） |
| `pr-002` | `:5` / `:18`① / `:19` / `:21`① / `:27` / `:28` / `:29` 的字段名；**`:51` 整段按 §5.2 重写** | `depends_on` **仍为（无）** —— 解耦成立（§5.2），不需改依赖声明 |
| `pr-003` | `:5` / `:17`① / `:19`② / `:25` / `:29` / `:31` / `:40` / `:47`① 的字段名与 fixture | `depends_on`（→ `pr-002`）**不变**（依赖的真实性不因改名而变） |

---

## §6 转呈件、收敛自检与越界声明

**转呈件：空。** 本轮是门禁 D-1 的定点修正，全部依据可由 `architecture.md` + 实读代码复核 ⇒ **无新的 `[model_inferred]`、无新的 `[待裁决]`、无新增 L1**（字段命名属 L3，本 agent 自主决定并说明理由）。

**收敛自检**：

| # | 完成定义 | 结论 | 依据 |
|---|---|---|---|
| V1 | 改名后的字段与既有通知 body 的**所有 key 不相交** | ✅ | §3.2 逐 key 对照（10 key，全部带 `文件:行号`）；§5.2.1 同名表已落 `architecture.md` |
| V2 | 「两 PR 在同一信封上的契约如何解耦」已给出 | ✅ | §5（生产面 / 消费面字段面 + 缺失行为 + 三条论证 + 阶段 4 最小改写集）；`architecture.md` §5.2.1 与 §12.4 各落一份契约面口径 |
| V3 | `permission` 类既有逐字行为不变 | ✅ | §2.3 逐条；`architecture.md:401` / `:480` / `:548` |
| V4 | L1-1~L1-7 语义不变（只改名） | ✅ | §2.3；`architecture.md:332`（表头注）/ `:338`（L1-3 原文留档） |
| V5 | `architecture.md` 版本 → v0.3.0（文首状态行 + §0 状态表） | ✅ | `architecture.md:3`（版本行）/ `:7`（本轮收口）/ `:34`（§0 新增行） |
| V6 | 全文无遗留的"信封类别字段 = `kind`"表述 | ✅ | 逐行审计：修正后 `architecture.md` 共 758 行，`kind` 命中 **66 行 / 112 处**、`request_kind` 命中 **44 行**；除 §4.1 留档的候选/理由原文（表头注已消歧）与 §5.2.1 的证据表（有意引用 `kind` 作反例）外，其余 `kind` **全部是通知类型判别键**，类别字段一律以 `request_kind` 表达 |
| V7 | 未越界（不改产品维度 / 不改需求合同 / 不做任务拆解 / 不写实现） | ✅ | §4.2（`prd/**`、`prs/**` 均**未写入**）；下文越界声明 |

**越界声明**：

- 本轮写入（均为 `<工作区地址>` 下的**绝对路径**，且**仅此两个文件**）：
  - `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`（→ **v0.3.0**）
  - `docs/iterations/0023-yolo-approval-and-question-inbox/clarifications/2026-09-14-architect-round3.md`（本记录）
- **未修改**：`prd.md` 与 `prd/F01~F16*.md`（含产品维度与架构段，均保持原样）、`demand.md`（只读）、`prs/pr-001~003*.md`（只读，仅产出受影响清单）、`status.md`、`history.md`、`clarifications/` 下的既有文件（`verify-stage4-gate-20260914.md`、`2026-09-14-architect-round1/round1-verdicts/round2.md`、`pr-planner-*`、`prd-*`、`demand-*`、`probes/**` 全程只读）。
- **未修改**任何产品代码（`oamp/**` 全程只读，仅为关键行号实读）；**未运行**测试套件 / 构建 / 格式化 / 探针。
- **未执行**任何 git 写命令（无 add / commit / checkout / branch 等）。
- **未新增**架构决策与组件：本轮全部改动可回指本记录 §1~§5 与门禁报告 D-1；新增实体 = **0**（未增删组件、未增删依赖、未增删计时器/审计面）。
