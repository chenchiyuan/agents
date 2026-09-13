# pr-005：确认项 `tool` 为 `null` 的用户可见缺陷修复（栏内行 + 通知正文）

## 上下文摘要

阶段 6 偏差 D-1 的用户可见面修复：ACP 权限门来源的确认项 `tool` 恒为 `null`（该帧不带 `toolName`，既有断言把此值钉为 `null`、不得用 `title` 猜测），消费侧仍把 `null` 插进模板 ⇒ 第三栏出现字面量 `null · <title>`、通知正文出现「请求执行 null：`<title>`」。本 PR 只在**消费侧**（渲染 + 文案）让缺失的 `tool` 不产出伪值：可得则逐字照旧，缺失则整段省略。**信封零改动**（`agent.js` 不在文件面）、既有断言零改写、其它偏差（D-2 等）不在本 PR。

## 涉及功能点

- F01
- F08

## 文件范围

- `oamp/web/app.js`（修改：`renderInboxItem` 内 `inbox-request` 行的拼装〔检索式 `class="inbox-request"`、`renderInboxItem`〕——改为「存在的段才拼、逐段 `escapeHtml`」，`tool` 可得时逐字同现状）
- `oamp/web/notify.js`（修改：`TEMPLATES.confirmation_required.body` 的 `<tool>：` 段〔检索式 `请求执行`〕——`tool` 为空 / 缺失时整段省略，可得时逐字同现状）
- `oamp/test/inbox-console.test.js`（修改：**仅新增** `tool` 三态（`null` / 键缺失 / 非空）的行为断言，体例同本文件既有的 `fnBody` 提取 + `node:vm` 沙箱；**既有断言原文零改写**）

**最小面取舍——修在消费侧，不动生产侧**（三条代码级理由）：

1. **信封取值口径已被既有契约钉死**：`oamp/test/confirmation-roundtrip.test.js:445-451`（用例名即契约：「权限门不带 toolName（真实 omp 帧形）⇒ tool=null，**不得用 title 猜测**」，断言在 `:449`）断言 `env1.tool === null`，其帧形 fixture 在 `oamp/test/confirmation-roundtrip.test.js:107`。在生产侧派生一个「可读工具名」（无论是取 `title` 还是把 `kind` 映射成词）＝改写 pr-002 的信封契约与 `prd/F01` T-02 口径，属**契约变更**而非修缺陷，且引入 `kind` → 人话的映射词表（词表 / 语言面决策），超出本 PR。
2. **根因在显示路径**：`oamp/web/app.js:1041` 的 `escapeHtml(s) { return String(s).replace(…) }` 对 `null` 产出 `"null"`（`String(null)`），`oamp/web/notify.js:40` 的模板字面量对 `${p.tool}` 同此。`tool` 为 `null` 是**协议如实**（`session/request_permission` 报文只有 `title` / `kind`，无 `toolName`）；伪值由渲染产生 ⇒ 修渲染。
3. **风险面最小**：`oamp/src/**` 零改动 ⇒ 对挂起 / 裁决链路（F02 · F04 · F05）与信封形状零风险，可独立回滚；文件面 = 2 个消费文件 + 1 个测试文件。

**与既有 4 个 PR 的文件面关系**：本 PR 触碰的 `app.js` / `notify.js` / `inbox-console.test.js` 均落在 **pr-004 的已合并文件面**内 —— 这是**同一接缝上的追加改动**（1 处行拼装 + 1 处模板段 + 新增断言），**不是**与在途 PR 的范围冲突：pr-004 已合并（merge `017961a`），本分支 base = 迭代分支 `697176f` 已含之，本 PR 是本分支上唯一的在途变更者。**不选 `oamp/src/agent.js`** ⇒ 与 pr-002 文件面（`context-pool.js` / `agent.js` / `confirmation-roundtrip.test.js` / `context-pool.test.js`）**零交集**；与 pr-001 / pr-003 文件面亦零交集。

**非目标（不在本 PR）**：

- 不改 `tool` 的取值口径（`agent.js` 零改动）。若将来要把 `kind` 映射为可读工具名，属契约变更，须先回填 `prd/F01` T-02 与 `architecture` §7 T-02 / T-09。
- 不修 D-1 之外的任何偏差（D-2 跨标签页陈旧条目 = `architecture` §5.2 的明示代价；D-5 flake 等）。
- 不改写既有测试断言（`oamp/test/confirmation-roundtrip.test.js` 零改动，充当回归面）。
- 不改上游文档（`architecture.md` / `prd/*.md` 的工具名口径回填按 D-1 建议「随后」由文档同步承接，不在实现 PR 内）。

## 验收标准

- [ ] **缺 `tool` 不产伪值（栏内第三栏行）**：`inbox-request` 行在 `{tool: null, title: 'echo E2E-1'}` 下恰为 `echo E2E-1`；在 `{title: 'echo E2E-1'}`（**无 `tool` 键**）下同为 `echo E2E-1`；在 `{tool: null, title: null}` 下为空串。三种输入的行文本均**不含子串 `null` / `undefined`**，也无悬空前导 `·`。
- [ ] **`tool` 可得时栏内逐字不变**：`{tool: 'bash', title: 'echo E2E-1'}` ⇒ 行文本恰为 `bash · echo E2E-1`（与现状逐字一致）。
- [ ] **转义面不变**：行内每段仍先 `escapeHtml` 再拼——`title` 为 `<img src=x onerror=1>` 时行文本含 `&lt;img`、不含 `<img`。
- [ ] **缺 `tool` 不产伪值（通知正文）**：`service.onEvent('confirmation_required', { agent_id: 'pb-dev', tool: null, title: 'echo hi' })` 的 `body` = `pb-dev 请求执行 echo hi`；**无 `tool` 键**时同为该值；二者均不含 `null` / `undefined`，且无悬空 `：`（`：` 前必有内容）。
- [ ] **`tool` 可得时通知正文逐字不变**：`{ agent_id: 'pb-dev', tool: 'bash', title: 'echo hi' }` ⇒ `pb-dev 请求执行 bash：echo hi`；`title` 超 80 字符仍按既有 80 字符截断 + `…`（既有断言 `oamp/test/inbox-console.test.js:188` / `:202` **原文零改写**即通过）。
- [ ] **新增断言是行为断言**：`oamp/test/inbox-console.test.js` 的新断言实际**执行**被测路径（通知侧用既有 `loadNotify` 的 `node:vm` 沙箱；栏内行侧以沙箱执行提取出的渲染函数——为便于提取可把行拼装抽为顶层纯函数，形状 / 命名不限），**不得仅对源码做文本匹配**。判定方式：断言对上述三态给出可区分的期望值（若被测值未参与逻辑，三态无法区分 ⇒ fail）。
- [ ] **零回归**：`node --test oamp/test/inbox-console.test.js` 全绿；`oamp/test/confirmation-roundtrip.test.js`（含 `:445-451` 的 `tool=null` 钉死、`:459` 的审批门 `tool='write'`、`:419` 的信封键集合含 `tool`）**零改动**且全绿；`node --test oamp/test/*.test.js` 无新增失败用例。
- [ ] **信封零改动（可独立判定）**：相对本分支 base `697176f`，`git diff --name-only` 的改动面**恰为本 PR 文件范围的三条路径**（`oamp/src/**` 与其余 `oamp/web/**` 不在 diff 内）。

## 参考资料

- docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/verify-stage6-20260913-213704.md（偏差 D-1 的原始证据：第三栏 DOM 实测 `null · echo E2E-…`、`window.__notes[0].body` = `e2e-dev 请求执行 null：echo …`；处置口径 ②「模板不再引用 `tool`」+ ① 括注「或省略该字段」的渲染侧落地）
- docs/iterations/0021-confirmation-inbox-and-event-push/architecture.md（§7 T-02 栏内三行、§7 T-09 文案表「`<agent_id> 请求执行 <tool>：<title，截断 80 字符>`」、§5.5 通知面）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F01-confirmation-inbox-column.md（架构落定 T-02：② 工具名 + `title`）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F08-notification-delivery.md（架构落定 T-09：正文含对话标识 + 截断 80 字符的内容）
- docs/iterations/0021-confirmation-inbox-and-event-push/prs/pr-002-agent-confirmation-wiring.md（信封 1 的 `tool` 字段来源与 `tool=null` 的来源契约）
- docs/iterations/0021-confirmation-inbox-and-event-push/prs/pr-004-console-inbox-column-and-notify.md（两处修复点的引入者：第三栏渲染与通知文案表）

## depends_on

- pr-004-console-inbox-column-and-notify.md（理由：本 PR 的两个修复点**都是 pr-004 的产物**——pr-004 未合并时二者在代码库中不存在，本 PR 的验收 1~7 全部无法判断。代码级证据：① `oamp/web/app.js:641` 的 `<div class="inbox-request">${escapeHtml(entry.tool)} · ${escapeHtml(entry.title)}</div>` 是栏内行的唯一拼装点，其首父基线反证 `git show 1f7eceb:oamp/web/app.js | grep -c 'inbox-request'` = **0**（pr-004 的 base = `1f7eceb`）；② `oamp/web/notify.js:40` 的 ``body: (p) => `${p.agent_id} 请求执行 ${p.tool}：${clip(p.title)}` `` 是通知正文的唯一模板，反证 `git show 1f7eceb:oamp/web/notify.js` → `fatal: path 'oamp/web/notify.js' exists on disk, but not in '1f7eceb'`（该文件由 pr-004 新建）；③ 本 PR 的测试承载文件 `oamp/test/inbox-console.test.js` 同为 pr-004 新建。**依赖已满足**：pr-004 已合并（merge `017961a`），本分支 base `697176f` 已含之。）
- pr-002-agent-confirmation-wiring.md（理由：缺陷的**触发源与判定口径**均由 pr-002 定义——本 PR 只让缺失值不被渲染成伪值，`tool` 的值仍由 pr-002 的信封产出；pr-002 未合并则信封里没有 `tool` 字段，本缺陷无从谈起。代码级证据：① `oamp/src/agent.js:328` 的 `tool: typeof toolCall.toolName === 'string' && toolCall.toolName !== '' ? toolCall.toolName : null` 是信封 1 `tool` 字段的唯一赋值点，反证 `git show c84233a:oamp/src/agent.js | grep -c 'confirmation_id'` = **0**（pr-002 的 base = `c84233a`）；② 钉死该值的既有断言 `oamp/test/confirmation-roundtrip.test.js:445-451`（配合 `:107` 的帧形 fixture）同为 pr-002 产物，本 PR 的「零回归」验收以它为前提。**依赖已满足**：pr-002 已合并（merge `697176f` = 本分支 base）。）
- 传递性说明（**不**列为直接依赖）：确认面 `oamp/src/inbox.js` / `oamp/src/web.js` 由 pr-003 引入，但该链路经 `pr-004 → pr-003` 已在本分支 base 内满足，且与本 PR 的文件面、验收点零交集 —— 按「依赖须为直接消费关系」不列。

## batch

5
