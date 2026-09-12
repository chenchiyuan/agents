# pr-002-cross-iteration-d2-registration

## 上下文摘要

F15 登记义务：0017 遗留缺陷 `0017/D-2`（`/api/chats`、`/api/messages` 登记元数据缺 `project_id`）在 0017 与 0019 两处 `status.md` 写成互指登记，承接方 = 单独的小迭代、0019 完成后起；并写入编号口径（跨迭代引用带迭代号）。0018 一侧已由既有提交承载（ADR-3），只登记为外部证据、不写入；不含修复。

## 涉及功能点

- F15（D-2 承接登记与跨迭代留痕：三处互相引用、编号无两义、承接方与起始条件写明、本迭代不承接）

## 文件范围

- `docs/iterations/0017-project-workspace/status.md`（修改：**仅** §下一迭代候选 第 1 条 → §8.7 三段式 + 编号口径行）
- `docs/iterations/0019-worktree-isolation-protocol/status.md`（修改：**仅** §待确认项 中 D-2 那一段 → 同一格式 + 编号口径行；其余段落一律不触碰，见验收标准"单段改动约束"条）

**不涉及（ADR-3 的外部证据，非本 PR 文件范围）**：`docs/iterations/0018-chat-agent-subagent-protocol/status.md` ——（a）该文件**不在本迭代分支上**（`docs/iterations/` 下无 0018 目录；`0019/progress.md:66` 记录其仅存在于分支 `iteration/0018-chat-agent-subagent-protocol`）；（b）其 C-3 行**已由既有提交 `89182b7` 完成**（证据：提交 `89182b7`（`docs(0018): 台账修正`）的 `## 待确认项` C-3 行已写明"由 0019 完成后起的单独小迭代承接，三处 status（0017/0018/0019）互相引用留痕"）。按 **ADR-3**：该处**不写入、不验证该分支的文件本身，只登记该事实**（登记为验收条目，见下）；**不得**为写该文件开任何跨工作区写入例外（规则 F 的例外是**闭集两项**——会话工作区的创建动作、收口三步及其前置游离动作，不得扩大）。ADR-3 原文见 `docs/iterations/0019-worktree-isolation-protocol/history.md` 的 2026-09-12 19:05:00 条目。

**其余不涉及（零改动面）**：`roles/**`、`.claude/**`、`oamp/**`、`tools/**`、任何规范 / skill / 代码文件；也不涉及 0017 / 0019 除 `status.md` 外的其它产物。

## 验收标准

- [ ] **0017 落点**：`docs/iterations/0017-project-workspace/status.md` §下一迭代候选 第 1 条（现为"**D-2（中·用户可见缺陷·第一优先）**"起的单段叙述）改写为 §8.7 三段式（① 缺陷描述：`GET /api/chats` 与 `POST /api/messages` 的路由登记元数据 `params` 未包含必填参数 `project_id`；② 承接方：**单独的小迭代**（`0019-worktree-isolation-protocol` 完成之后启动，本迭代不承接）；③ 引用链：`0017/status.md` → `0018/status.md`（C-3 显式不纳入）→ `0019/status.md`（N2 显式排除并登记承接条件））+ 编号口径行；该节其余条目与全文其余部分**逐字不动**
- [ ] **0019 落点**：`docs/iterations/0019-worktree-isolation-protocol/status.md` §待确认项 的 D-2 段改写为同一格式 + 编号口径行（承接方与起始条件写明、引用链补全）；该段之外的任何段落（阶段状态 / PR 实现子状态 / 并发配置 / 用户确认记录 / 更新日志 / D-1 与 D-3~D-6 各段）**零改动**
- [ ] **ADR-3 外部证据条目（0018 一侧；本 PR 不写入、不验证该分支的文件本身，只登记该事实）**（F15 验收 2）：登记内容 = 分支 `iteration/0018-chat-agent-subagent-protocol` 的提交 `89182b7` 的 `## 待确认项` C-3 行写明"由 0019 完成后起的单独小迭代承接"与"三处 status（0017/0018/0019）互相引用留痕"；本 PR 对它的义务仅限**登记该事实**（写入本 PR 的验收文本），**不**读取 / 校验该分支文件的其它内容，**不**在该分支或该文件上做任何写入
- [ ] **三处互相引用链成立**（F15 验收 2）：① 0017 与 0019 两处文本互指、且共同指向同一承接方；② 0018 一侧按上一条以外部证据（`89182b7` 的 C-3 行）登记；三处**指向同一承接方与同一起始条件**（"单独的小迭代，0019 完成后起"，不写"下一迭代"这类未绑定指代）
- [ ] **编号口径无两义（判据收窄，与 F15 验收 3 同读；Gate r2 偏差 D3 的闭合项）**：**本次改动的 D-2 段落内**，凡跨迭代引用一律带迭代号（如写作 `0017 的 D-2`、`<迭代号>/D-<n>`），且该段内不出现两义；**其余既有裸 `D-2` 出现位置不属于本 PR 的判据范围**——实测位于 `docs/iterations/0019-worktree-isolation-protocol/status.md:15`（阶段状态表·阶段 1 行）/ `:32`（§待确认项"无用户待确认项"条）/ `:52`（用户确认记录 `**D-2 = ①**`）/ `:60`（更新日志），本 PR **不改动它们**（见"单段改动约束"条），故对它们不设"必须带迭代号"的要求
- [ ] **不含修复**（F15 验收 1）：本 PR 的 diff 中不出现 `project_id` 相关的代码 / 规范条款改动，不新增任何"登记元数据完备性"条款
- [ ] **单段改动约束（ADR-4）**：本 PR 对 `docs/iterations/0019-worktree-isolation-protocol/status.md` 的 diff **只落在 §待确认项 的 D-2 段内**——该文件由主 agent 主线持续维护（阶段状态 / PR 子状态 / 并发配置 / 更新日志都在其中更新）；判定方式：取本 PR 的 diff，除 §待确认项 D-2 段之外的 `docs/iterations/0019-worktree-isolation-protocol/status.md` hunk 数必须为 **0**
- [ ] **合并前置（重基线，ADR-4；Gate r2 偏差 D9 的闭合项）**：合并前以**当时的迭代分支**重基线（rebase）；一旦 `docs/iterations/0019-worktree-isolation-protocol/status.md` 发生冲突，**以主线版该文件为基础**，只**重放本 PR 对 `## 待确认项` D-2 单段的改动**（不得凭旧副本覆盖主线在该文件其它位置的更新，也不得把该单段之外的任何内容带入合并结果）

## 参考资料

- `docs/iterations/0019-worktree-isolation-protocol/architecture.md`（§5.3 零改动清单 / §5.4 惯例文件同步（收窄为"0017 / 0019 两处由 pr-002 承担，0018 只引用不写入"）/ §6.1 ADR-1~ADR-4 登记 / §7 顶部编号空间声明 / §8.7 D-2 登记写法与编号歧义规避规则（收窄版）/ §10 R-6）；**v1.2.2 的同步范围**：§5.3 末行由"三处"收窄为两处 + `prd/F15` 卡的架构落地段（Gate r2 偏差 D5 / D6，属 architect 侧）——本 PR 的验收基准以 v1.2.2 为准；**若 v1.2.2 尚未落盘，以 v1.2.1 的 §5.4 / §8.7 收窄版为准**
- `docs/iterations/0019-worktree-isolation-protocol/history.md` 的 **2026-09-12 19:05:00 · 调度决策 · Gate确认** 条目（ADR-3 / ADR-4 的原文；对外引用一律用 ADR 编号）
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-gate-stage4-r2-20260912-192704.md`（Gate r2 报告；与 PR 文件相关的返工面 = **D3** 编号判据需与单段/零改动约束对齐、**D9** 合并前置表述自相、**D10** 0018 侧不在本迭代核实）
- `docs/iterations/0019-worktree-isolation-protocol/prd/F15-d2-registration-trace.md`（完整验收标准 1~4；其「架构落地」段的三处写法属 architect 侧同步项 = Gate r2 偏差 D6）
- `docs/iterations/0019-worktree-isolation-protocol/demand.md`（N2 裁决原文：D-2 由单独小迭代承接、三处 status 互相引用留痕、本迭代不承接）
- `docs/iterations/0017-project-workspace/status.md:44-49`（§下一迭代候选 第 1 条 = 0017 侧的改写落点）
- `docs/iterations/0019-worktree-isolation-protocol/status.md:30-40`（§待确认项 D-2 / D-3 = 0019 侧的改写落点与既有编号冲突记录）
- **外部证据（0018 侧；ADR-3；本 PR 不写入、不验证该分支文件本身）**：分支 `iteration/0018-chat-agent-subagent-protocol` 的提交 `89182b7`（`docs(0018): 台账修正`）→ `docs/iterations/0018-chat-agent-subagent-protocol/status.md` §待确认项 C-3 行；（本迭代工作区不含该目录，见 `docs/iterations/0019-worktree-isolation-protocol/progress.md:66`）
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/retro-0017-phase1.md`（Q-c C-4：D-2 有登记无承接 + 编号歧义）

## depends_on

（无）

> 说明：本 PR 只改两处 `status.md` 的登记文本，与 pr-001 的规范 / SKILL 改动**无文本耦合**（不引用任何新增章节名、不改任何条款）；两个 `status.md` 与 pr-001 的 6 个文件**无交集** ⇒ 可独立合并、独立验收，与 pr-001 可同波次并发。

## batch

1

> **备注（裁定登记、字数口径与例外边界，不改变依赖判定）**：① 本 PR 涉及的两项裁定登记为 **ADR-3**（0018 侧由既有提交 `89182b7` 承载，本 PR 不写入、不开跨工作区例外）与 **ADR-4**（只改 0019 `status.md` 的 D-2 单段 + 合并前重基线），原文见 `docs/iterations/0019-worktree-isolation-protocol/history.md` 的 2026-09-12 19:05:00 条目。② **上下文摘要字数口径**：按主 agent 裁定的**全字符（Unicode，含标点与空格，不分中英文）≤ 200** 计——本 PR 的摘要实测 **198 字符**（Gate r2 偏差 D7）。③ `docs/iterations/0019-worktree-isolation-protocol/status.md` 是主 agent 持续维护的视图文件，本 PR 在独立 worktree 内改它 ⇒ 按 ADR-4 只改 §待确认项 的 D-2 单段、并在合并前以当时迭代分支重基线（见"单段改动约束"与"合并前置"两条）。④ 0018 一侧按 ADR-3 不写入、不验证该分支文件本身，只登记该事实，**不开跨工作区写入例外**——规则 F 的例外是闭集两项，扩大例外会与 F09 验收 1 直接冲突；该行的内容复核纳入 0018 恢复执行时的核对清单（Gate r2 偏差 D10）。
