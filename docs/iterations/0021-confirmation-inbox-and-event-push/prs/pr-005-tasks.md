# pr-005-tasks.md — pr-005 内部任务图（确认项 `tool` 为 `null` 的用户可见缺陷修复 · 消费侧最小面）

**迭代**: 0021-confirmation-inbox-and-event-push ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-005-null-tool-name-fix.md`
**worktree 分支**: `feat/0021-pr-005-null-tool-name-fix`（base = 迭代分支 `697176f`，已含 pr-002 / pr-004 的合并）｜ **任务总数**: **3**（T1~T3）｜ **依赖图**: 无环（见 §2）

---

## 0. 范围、文件面与事实锚点

**本 PR 文件范围（唯一可写面，3 条）**

| 文件 | 动作 | 内容 |
|---|---|---|
| `oamp/web/app.js` | 修改 | `renderInboxItem` 内 `inbox-request` 行的拼装（`:641`）——改为「存在的段才拼、逐段 `escapeHtml`」；`tool` 可得时逐字同现状 |
| `oamp/web/notify.js` | 修改 | `TEMPLATES.confirmation_required.body`（`:40`）的 `请求执行 <tool>：` 段——`tool` 为空 / 缺失时整段省略；可得时逐字同现状 |
| `oamp/test/inbox-console.test.js` | 修改 | **仅新增** `tool` 三态（`null` / 键缺失 / 非空）的**行为**断言（体例 = 本文件既有 `fnBody` / `loadNotify`）；**既有断言原文零改写** |

**非目标（明确不写）**：`oamp/src/**`（**尤其 `agent.js`**——信封取值口径已被既有契约钉死，见 A4/A5）、`oamp/test/confirmation-roundtrip.test.js`（**零改动**，充当回归面）、`oamp/web/index.html` / `style.css` / `debug.js`、其它 `oamp/test/*.js`、`oamp/API.md` / `oamp/llms.txt`、`architecture.md` / `prd/**` / `status.md` / `history.md`、其它 `prs/*.md`。

**读码事实锚点（判据基础；行号为 worktree `638d068` / base `697176f` 实测）**

| # | 事实 | 位置 |
|---|---|---|
| A1 | `escapeHtml(s) { return String(s).replace(…) }` ⇒ 入参 `null` 产出字面量 `"null"`（`String(null)`）——伪值的**唯一产生机制** | `oamp/web/app.js:1041-1043` |
| A2 | 栏内第三行的**唯一拼装点**在 `renderInboxItem`（`:635-645`）内，行文本字面量在 `:641`：`${escapeHtml(entry.tool)} · ${escapeHtml(entry.title)}` | `oamp/web/app.js:641` |
| A3 | 通知正文的**唯一模板** = `TEMPLATES.confirmation_required.body`：``body: (p) => `${p.agent_id} 请求执行 ${p.tool}：${clip(p.title)}` ``；整表位于 `service 层` 标记之后、`channel 层` 标记之前 | `oamp/web/notify.js:34-43`（`:40`） |
| A4 | 信封 `tool` 的**唯一赋值点**已把非字符串 / 空串折叠为 `null`：`typeof toolCall.toolName === 'string' && toolCall.toolName !== '' ? … : null` ⇒ 消费侧**不存在**「空串」第三态 | `oamp/src/agent.js:328` |
| A5 | 钉死 `tool=null` 的既有契约用例（**本 PR 零改动**）：用例名即契约「权限门不带 toolName（真实 omp 帧形）⇒ tool=null，**不得用 title 猜测**」，断言 `assert.equal(env1.tool, null)`；fixture `FAKE_ACP_MODE:'permission_notool'` 在同用例内 | `oamp/test/confirmation-roundtrip.test.js:445-451`（断言 `:449`、fixture `:446`） |
| A6 | 同文件另两条既有断言同在回归面内：信封键集合含 `tool`；审批门来源 `tool='write'` | `oamp/test/confirmation-roundtrip.test.js:419`、`:459` |
| A7 | 「函数体」提取体例：`fnBody(src,name)` 用 `\n(?:async )?function NAME\([^)]*\) \{([\s\S]*?)\n\}`——**只取该函数体**（非贪心到第一个行首 `}`），不取文件其余部分 | `oamp/test/inbox-console.test.js:57-62`（正则 `:59`） |
| A8 | `renderInboxItem` 函数体内有 5 条既有断言，其中 `assert.match(item, /inbox-request/)` 要求字面量 `inbox-request` **出现在该函数体内** | `oamp/test/inbox-console.test.js:283-288`（`:285`） |
| A9 | 通知正文的既有断言（`tool='bash'` 两档，**原文零改写即通过**，构成「非空逐字不变」的回归面）：80 字符截断档、granted 投递档 | `oamp/test/inbox-console.test.js:188`、`:202` |
| A10 | `notify.js` 的**运行期体例已在场**：零模块语法沙箱 `loadNotify`（`:72-77`）+ 桩通知构造器 `notificationStub`（`:80-90`） | `oamp/test/inbox-console.test.js:72-90` |
| A11 | `notify.js` 的段落 / 形状既有断言：`service 层→channel 层` 段零 `Notification`；`channel 层→全局入口` 段零事件类型字符串；`service_onEvent` 返回的四字段形状被逐字断言 | `oamp/test/inbox-console.test.js:140-149`（四字段 `:148`） |
| A12 | 本 PR 分支 base = `697176f`（已含 pr-002 / pr-004 合并），当前 HEAD = `638d068`（仅含 PR 契约文件；`git diff --name-only 697176f -- oamp/` 为空） | `git -C <worktree> …` |

---

## 1. 任务列表

### T1: 消费侧空值语义落地——`tool` 缺失不产伪值（`app.js` 栏内行 + `notify.js` 通知正文），可得时逐字不变

- **验收标准**:
  1. **通知正文：`tool` 缺失不产伪值**（PR 验收 4）：`service.onEvent('confirmation_required', { agent_id: 'pb-dev', tool: null, title: 'echo hi' }).body` 恰为 `'pb-dev 请求执行 echo hi'`；**无 `tool` 键**时同值；二者均不含子串 `null` / `undefined`，且 `：` 前必有内容（无悬空分隔符）。判据：以既有体例（A10 的 `loadNotify`：`node:vm` 零模块语法沙箱）执行 `oamp/web/notify.js`，观察 `intent.body`。
  2. **通知正文：`tool` 可得时逐字不变**（PR 验收 5）：`{ agent_id: 'pb-dev', tool: 'bash', title: 'echo hi' }` ⇒ `'pb-dev 请求执行 bash：echo hi'`；`title` 超 80 字符仍取前 80 字符 + `…`。判据：既有断言 `oamp/test/inbox-console.test.js:188` / `:202` **原文零改写**且通过。
  3. **栏内行：`tool` 缺失不产伪值**（PR 验收 1）：对 `{ tool: null, title: 'echo E2E-1' }`、`{ title: 'echo E2E-1' }`（无 `tool` 键）、`{ tool: null, title: null }` 三态，行文本分别恰为 `echo E2E-1` / `echo E2E-1` / `''`；三者均不含子串 `null` / `undefined`，且无悬空前导 `·`。判据：直接执行该行文本段的产出（T1 验收 6 的可执行形态），断言三态期望值。
  4. **栏内行：`tool` 可得时逐字不变**（PR 验收 2）：`{ tool: 'bash', title: 'echo E2E-1' }` ⇒ 行文本恰为 `bash · echo E2E-1`。
  5. **转义面不变**（PR 验收 3）：`title` 为 `<img src=x onerror=1>` 时行文本含 `&lt;img`、不含 `<img`（每段先 `escapeHtml` 再拼；判据是输出，实现形式自由）。
  6. **两处的产出均可被「执行」而非「文本匹配」**（PR 验收 6 的前置）：`notify.js` 侧保持零模块语法经典脚本（A10 沙箱可直接执行）；`app.js` 侧把**行文本段的拼装**抽为**顶层纯函数**（单参、参数表无嵌套括号 ⇒ `fnBody` 可提取，A7），**且 `<div class="inbox-request">…</div>` 包装仍留在 `renderInboxItem` 函数体内**（字面量 `inbox-request` 必须仍出现在该函数体内，见 §4-C4 / A8）。`[model_inferred]`（A7+A8 推得；PR 文件只写「形状 / 命名不限」，未提及该相容性约束）。
  7. **两处同一口径**：`tool` 缺失 = `null` 或 `undefined`（键缺失）；非空则逐字照旧；空串不单独特判（信封层已折叠，A4）。`[model_inferred]`（由 PR 验收 1 / 4 的三态 + A4 推得）。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: PR 文件 验收 1~5 + 文件范围（`oamp/web/app.js`、`oamp/web/notify.js`）与「最小面取舍」1~3；`prd/F01-confirmation-inbox-column.md:40`（架构落定 T-02：② 工具名 + `title`）；`prd/F08-notification-delivery.md:36`（架构落定 T-09：正文含对话标识 + 截断 80 字符）；`architecture.md:500-510`（§7 T-02）、`architecture.md:564-566`（§7 T-09）；`clarifications/verify-stage6-20260913-213704.md` 偏差 D-1 处置口径 ② + ① 括注；代码事实 A1 / A2 / A3 / A4

### T2: `oamp/test/inbox-console.test.js` 新增 `tool` 三态**行为**断言（既有断言原文零改写）

- **验收标准**:
  1. **新增断言实际执行被测路径**（PR 验收 6）：通知侧经既有 `loadNotify` 沙箱取得 `intent.body`（A10）；栏内行侧以 `node:vm` / 等价沙箱执行 T1 落盘的顶层纯函数（配套提供 `escapeHtml` 同形实现）。**不得仅对源码做文本匹配**；判定方式：三条输入给出**可区分的期望值**（若被测值未参与逻辑，三态无法区分 ⇒ fail）。
  2. **断言点覆盖两处 × 三态 + 两处逐字不变 + 转义面**：即 T1 验收 1~5 的六个断言点全部在新断言中落定（通知正文：`null` / 无键 ⇒ `pb-dev 请求执行 echo hi`；栏内行：三态 ⇒ `echo E2E-1` / `echo E2E-1` / `''`；两处 `tool='bash'` 档逐字；`title` 含 `<img` 的转义档）。
  3. **既有断言原文零改写**：`oamp/test/inbox-console.test.js` 既有 8 条用例的断言行**文本零删改**（含 `:188` / `:202` 的 `bash` 档正文断言、`:285` 的 `inbox-request` 断言、`:140-149` 的段落 / 形状断言）；新增只以追加 `test(...)` 或并入同 section 的形式落地。判据：`git diff` 中既有断言行为**纯新增**（无删除行）。
  4. **落盘形态对齐后再定稿**（先例教训）：断言中出现的函数名 / 检索式必须先 `grep` 校验命中（体例参考 pr-004 任务图 §5 疑问 5 的教训），不得凭 PR 文件的示意形态直接写断言——本 PR 允许 T1 自由命名抽取函数。
  5. `node --test oamp/test/inbox-console.test.js` 全绿（既有 8 条 + 新增全过）。
- **前置依赖**: T1（断言须对齐 T1 落盘的实际形态）
- **优先级**: P0
- **追溯**: PR 文件 验收 6、1~5、7；文件范围（`oamp/test/inbox-console.test.js` 仅新增）；A7 / A8 / A9 / A10；`architecture.md:564-566`（§7 T-09）

### T3: 收口回归与边界审计（改动面恰三条路径 / 契约零改动 / 无新增失败 / 消费侧成立的反证）

- **验收标准**:
  1. **改动面恰三条代码路径**（PR 验收 8）：`git diff --name-only 697176f -- oamp/` 恰为 `oamp/test/inbox-console.test.js`、`oamp/web/app.js`、`oamp/web/notify.js`；`oamp/src/**` 与其余 `oamp/web/**` 不在其中。判据面限定为**代码面**（`-- oamp/`）：`docs/**`（PR 契约文件 + 本任务图）是工作流产物，不参与该条判定。`[model_inferred]`（PR 验收 8 写「改动面恰为本 PR 文件范围的三条路径」，未区分代码面与工作流产物面，此处按「可独立判定的信封零改动」的语义收敛到 `oamp/`）。
  2. **契约测试零改动且全绿**：`oamp/test/confirmation-roundtrip.test.js` 零改动（含 A5 的 `tool=null` 钉死、A6 的信封键集合与审批门 `tool='write'`）且通过。判据：`git diff --name-only 697176f -- oamp/test/confirmation-roundtrip.test.js` 为空 + 该文件全绿。
  3. **回归无新增失败**（PR 验收 7）：`node --test oamp/test/confirmation-roundtrip.test.js oamp/test/inbox-console.test.js oamp/test/confirmation-inbox.test.js` 全绿；`node --test oamp/test/*.test.js` **无新增失败用例**。判定须扣除已登记的既有 flake：`status.test.js` 心跳时序（偏差 D-5：9 次实测中 1 次 2 条失败、此后 8 次不可复现，且未改动的对照树同样复现）——本 PR 改动面相关文件（`inbox-console` / `confirmation-roundtrip` / `confirmation-inbox`）的**任何**失败一律视为真失败，不得归因 flake。`[model_inferred]`（flake 扣除口径由 D-5 证据推得，非 PR 验收原文）。
  4. **「修在消费侧」的反证**：`git diff --name-only 697176f -- oamp/src/` 为空（信封零改动，A5 的契约未被松动）——本 PR 的修复不是声明而是可判定事实。
  5. **PR 八条验收逐条对位**（见 §3）并有可复现证据（命令 + 输出摘要），逐条 pass。
- **前置依赖**: T1、T2
- **优先级**: P0
- **追溯**: PR 文件 验收 7、8 与「最小面取舍」1 / 3；A5 / A6 / A12；`prd/F01-confirmation-inbox-column.md:40`；`clarifications/verify-stage6-20260913-213704.md` 偏差 D-5 行

---

## 2. 依赖图（无环）

```mermaid
graph LR
  T1["T1 消费侧空值语义<br/>app.js 行 + notify.js 模板"] --> T2["T2 inbox-console.test.js<br/>三态行为断言"]
  T2 --> T3["T3 收口回归与边界审计"]
```

拓扑序（合法执行序）：`T1 → T2 → T3`（单链，无并行支路；理由见 §5 疑问 1）

- **最长依赖链**：`T1 → T2 → T3`（2 跳）。
- **关键路径任务**：**T1、T2、T3**（三者全在关键路径上）。
- **无环**：边方向单调（T1 → T2 → T3），无回边、无自环；无跨任务的隐式反向依赖（T1 不消费 T2/T3 的任何产物）。

**同文件串行约束（必须）**

| 文件 | 修改任务 | 串行要求 |
|---|---|---|
| `oamp/web/app.js` | T1（唯一） | — |
| `oamp/web/notify.js` | T1（唯一） | — |
| `oamp/test/inbox-console.test.js` | **T2（唯一）** | T2 须待 T1 两文件落盘后定稿断言（检索式 / 函数名对齐，验收 4）；T3 的回归命令须待 T2 定稿后执行 |
| `oamp/test/confirmation-roundtrip.test.js` | **无**（零改动） | 只读：T3 验收 2 以「零 diff + 全绿」为判据 |
| `oamp/src/**` | **无**（零改动） | 只读：T3 验收 4 以「零 diff」为判据 |

---

## 3. 与 pr-005 验收标准逐条对位表

| PR 验收 # | 验收摘要 | 承接任务 | 对位说明 / 判据面 |
|---|---|---|---|
| 1 | 缺 `tool` 不产伪值（栏内行）：`null` / 无键 ⇒ `echo E2E-1`；`{tool:null,title:null}` ⇒ 空串；均不含 `null`/`undefined`、无悬空 `·` | **T1**（验收 3）+ **T2**（验收 2） | 判据 = 行文本三态期望值（执行产出，非文本匹配） |
| 2 | `tool` 可得时栏内逐字不变：`bash · echo E2E-1` | **T1**（验收 4）+ **T2**（验收 2） | 逐字相等断言 |
| 3 | 转义面不变：`<img src=x onerror=1>` ⇒ 含 `&lt;img`、不含 `<img` | **T1**（验收 5）+ **T2**（验收 2） | 每段先 `escapeHtml` 再拼；判据是输出 |
| 4 | 缺 `tool` 不产伪值（通知正文）：`null` / 无键 ⇒ `pb-dev 请求执行 echo hi`；不含 `null`/`undefined`、无悬空 `：` | **T1**（验收 1）+ **T2**（验收 2） | 判据 = `intent.body`（`loadNotify` 沙箱） |
| 5 | `tool` 可得时通知正文逐字不变（含 80 字符截断 + `…`） | **T1**（验收 2）+ **T2**（验收 3） | 既有断言 `:188` / `:202` **原文零改写**即通过 |
| 6 | 新增断言是**行为**断言（执行被测路径而非源码文本匹配） | **T1**（验收 6 的可执行形态）+ **T2**（验收 1） | 三态期望值必须可区分 |
| 7 | 零回归：`inbox-console` 全绿；`confirmation-roundtrip` **零改动**且全绿；`node --test oamp/test/*.test.js` 无新增失败 | **T2**（验收 5）+ **T3**（验收 2、3） | flake 扣除口径 = §4-C9 |
| 8 | 信封零改动（可独立判定）：改动面恰为本 PR 文件范围三条路径 | **T1**（文件面）+ **T3**（验收 1、4） | 判据面 = `git diff --name-only 697176f -- oamp/` |

**覆盖检查**：PR 8 条验收标准 → 全部有任务承接，无遗漏、无扩范围；T1~T3 均可追溯到 PR 文件 / `prd/F01`·`F08` / `architecture` §7 / 代码事实锚点（见 §6）。

---

## 4. 关键实现约束（C 系列，全部为硬约束）

1. **C1 修在消费侧（红线）**：`oamp/src/**` 零改动，尤其 `oamp/src/agent.js:328`（A4）。既有契约 A5（`confirmation-roundtrip.test.js:445-451`：权限门来源 `tool=null`、**不得用 `title` 猜测**）证明 `tool=null` 是**协议如实**（omp 的 `session/request_permission` 报文不带 `toolName`）。在生产侧派生「可读工具名」= 改写 pr-002 信封契约与 `prd/F01` T-02 口径，属契约变更，超出本 PR（PR 文件「最小面取舍」1）。
2. **C2 非空逐字不变是回归面，不是可调项**：`tool` 可得时的既有输出由 A9（`:188` / `:202`）与栏内 `bash · echo E2E-1` 形态钉死；本次改动**不得**改变任何非空路径的输出字节。
3. **C3 既有断言原文零改写、不得削弱**：`oamp/test/inbox-console.test.js` 既有 8 条用例的断言行文本零删改；`oamp/test/confirmation-roundtrip.test.js` 零改动（A5 / A6）。
4. **C4 `app.js` 侧抽取形态与既有断言相容（关键陷阱）**：A7 的 `fnBody` **只取函数体**（非贪心到第一个行首 `}`），A8 的 `:285` 要求字面量 `inbox-request` 仍出现在 `renderInboxItem` 函数体内。⇒ **只能**把行文本段的**拼装逻辑**抽为顶层纯函数、把 `<div class="inbox-request">…</div>` 包装留在 `renderInboxItem`；**不得**把整行（含 `class="inbox-request"`）搬到新函数里（否则 `:285` 挂，而 C3 禁止改写该断言 ⇒ 该路径被排除在方案空间外）。
5. **C5 `notify.js` 侧段落与形状约束**：新增辅助必须落在 `service 层 … channel 层` 标记之间，且该段**不得出现 `Notification` 字样（含注释）**（A11 的段落切片断言）；`channel 层 … 全局入口` 段的既有约束不受影响；`service_onEvent` 的四字段返回形状逐字不动（A11 `:148`）；`TEMPLATES` 的 `body: (p) => …` 调用形状保留（模板函数仍收 `p`）。
6. **C6 判定以输出为准**：全部验收点是对**产出文本**的断言（三态期望值可区分）；实现形式（条件数组 / `join(' · ')` / 三元）自由。唯一被钉死的实现形式是「逐段 `escapeHtml`」（PR 文件 文件范围），其可判定投影 = C3 的转义档（含 `&lt;img`、不含 `<img`）。
7. **C7 分隔符与空值**：`tool` 缺失 ⇒ 不产出前导 `·`（栏内行）、不产出悬空 `：`（通知正文）；`{tool:null,title:null}` ⇒ 行文本为空串。`''` 已被信封层折叠为 `null`（A4）⇒ 消费侧不必特判（特判亦无害，不进验收面）。
8. **C8 改动面边界**：`oamp/**` 恰 3 条路径；`docs/**`（PR 契约 + 本任务图）为工作流产物，不参与 PR 验收 8 的判定（该条判据面 = 代码面）。
9. **C9 回归判定须扣除已登记 flake**（D-5）：`node --test oamp/test/*.test.js` 的既有环境性失败（`status.test.js` 心跳时序，1/9 次复现、未改动对照树同样复现）不计入「新增失败」；**本 PR 改动面相关文件**（`inbox-console` / `confirmation-roundtrip` / `confirmation-inbox`）的任何失败均为真失败。
10. **C10 零新增依赖 / 零构建**：两处修复只用既有能力（`escapeHtml`、模板字面量）；测试侧沿用既有 `node:vm` + `node:test` 体例（A10），不引入测试替身库、不新增 npm 依赖。

---

## 5. 边界与疑问（提请主 agent）

1. **两处消费点为何同任务（粒度决策，非并行度取舍）**：PR 验收 1~5 是**同一条语义规则**（「缺失的 `tool` 不产出伪值；可得则逐字照旧」）在两个消费点的投影，两处改动合计约 5 行；按粒度判据「明显低于 1-2 天 ⇒ 考虑合并」合为一个任务。依赖图因此为单链（无并行支路）——这是本 PR 体量的实情，不为凑并行度而拆。
2. **文档回填的余量（D-1 的文档面，本 PR 不便承载）**：本 PR 后，`architecture.md:564-566`（§7 T-09 的模板原文 `${agent_id} 请求执行 ${tool}：${title}`）与 `prd/F01:40`（T-02「② 工具名 + `title`」）仍按「工具名恒在场」描述，与实现（缺失即省略）存在一处口径差。PR 文件已把回填列为非目标（交给「随后」的文档同步）。**提请主 agent**：阶段 6 复审时 verifier 是否会因此再次判 D-1 未闭合？若会，应在收口后补一条文档同步——不在本 PR 文件面，本任务图**不**产生该任务。
3. **`oamp/test/inbox-console.test.js` 文件头覆盖声明**（`:4-8`「覆盖：pr-004 验收 1 / 2 / 10 …」）是否追加 pr-005 行：**非验收面**，由实现者自定；追加不改变任何既有断言文本，不违反「仅新增」。
4. **既有断言 `:285` 的相容性**（C4）已按「实现约束」处理而非架构缺口：若实现者选择整行抽取，则必须改写 `:285`，而 C3 禁止 ⇒ 该方案在方案空间内被排除（不是疑问，是已闭合的边界）。
5. **flake 判定口径**（C9 / T3 验收 3）依据 = `clarifications/verify-stage6-20260913-213704.md` 的 D-5 行；该行同时建议「停止在台账中写『无 flake』」——本任务图不主张绝对全绿，只主张**无本 PR 相关的新增失败**。
6. **工作区路径**：实际 worktree = `…/0021-confirmation-inbox-and-event-push/.pb-agents/worktrees/0021-pr-005-null-tool-name-fix`（分支 `feat/0021-pr-005-null-tool-name-fix`，HEAD `638d068`，base `697176f`），与简报一致，无偏差。
7. **`[model_inferred]` 项共 4 条**（需主 agent 确认，均不引入架构之外的技术决策）：① T1 验收 6——`inbox-request` 字面量须留在 `renderInboxItem` 体内（由 A7 + A8 推得，PR 文件未提及该相容性陷阱）；② T1 验收 7——缺失判定 = `null` | `undefined`、空串不特判（由 PR 验收 1 / 4 的三态 + A4 推得）；③ T3 验收 1——PR 验收 8 的判据面收敛为代码面 `-- oamp/`（工作流产物 `docs/**` 不参与）；④ T3 验收 3——flake 扣除口径（由 D-5 证据推得）。

---

## 6. 追溯总表（任务 → 输入）

| 任务 | PR 文件追溯 | prd 追溯 | architecture 追溯 | 代码事实锚点 |
|---|---|---|---|---|
| T1 | 验收 1~5；文件范围（`oamp/web/app.js`、`oamp/web/notify.js`）；「最小面取舍」1~3；非目标 | F01 `:40`（T-02 落定）；F08 `:36`（T-09 落定） | §7 T-02（`:500-510`）、§7 T-09（`:564-566`） | A1 / A2 / A3 / A4；D-1 处置口径 ② + ① 括注 |
| T2 | 验收 6、1~5、7；文件范围（`oamp/test/inbox-console.test.js` 仅新增） | — | §7 T-09（`:564-566`） | A7 / A8 / A9 / A10 |
| T3 | 验收 7、8；「最小面取舍」1 / 3 | F01 `:40` | — | A5 / A6 / A12；D-5 行（flake 口径） |
