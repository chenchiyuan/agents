# pr-002-cross-iteration-d2-registration

## 上下文摘要

按 architecture §8.7 的三段式落地 F15 的跨迭代登记义务：把 0017 遗留缺陷 `0017/D-2`（`GET /api/chats`、`POST /api/messages` 的登记元数据 `params` 缺必填 `project_id`）在 **0017 与 0019 两处** `status.md` 写成互相引用、同一承接方（**单独的小迭代，0019 完成后起**）的登记，并写入编号口径规则（跨迭代引用一律 `<迭代号>/D-<n>`；0019 自身台账项自 `D-3` 起编号）。**0018 一侧不再由本 PR 写入**：该处已由既有提交完成（外部证据），本 PR 只把它登记为可核对的证据条目（主 agent 裁定 Q-3 = ②）。本 PR **不含**该缺陷的任何修复或相关条款（F15 验收 1），只改状态文件的登记文本。

## 涉及功能点

- F15（D-2 承接登记与跨迭代留痕：三处互相引用、编号无两义、承接方与起始条件写明、本迭代不承接）

## 文件范围

- `docs/iterations/0017-project-workspace/status.md`（修改：**仅** §下一迭代候选 第 1 条 → §8.7 三段式 + 编号口径行）
- `docs/iterations/0019-worktree-isolation-protocol/status.md`（修改：**仅** §待确认项 中 D-2 那一段 → 同一格式 + 编号口径行；其余段落一律不触碰，见验收标准第 6 条）

**不涉及（已完成的外部证据，非本 PR 文件范围）**：`docs/iterations/0018-chat-agent-subagent-protocol/status.md` ——（a）该文件**不在本迭代分支上**（`docs/iterations/` 下无 0018 目录；`0019/progress.md:66` 记录其仅存在于分支 `iteration/0018-chat-agent-subagent-protocol`）；（b）其 C-3 行**已由既有提交 `89182b7` 完成**（主 agent 提供并可在该分支核对的证据：提交 `89182b7`（`docs(0018): 台账修正……`）的 `## 待确认项` C-3 行已写明"由 0019 完成后起的单独小迭代承接，三处 status（0017/0018/0019）互相引用留痕"）。按主 agent 裁定 Q-3 = ②：该处**不写入**，只作为验收条目中的外部证据核对；**不得**为写该文件开任何跨工作区写入例外（规则 F 的例外是**闭集两项**——会话工作区的创建动作、收口三步及其前置游离动作，不得扩大）。

**其余不涉及（零改动面）**：`roles/**`、`.claude/**`、`oamp/**`、`tools/**`、任何规范 / skill / 代码文件；也不涉及 0017 / 0019 除 `status.md` 外的其它产物。

## 验收标准

- [ ] **0017 落点**：`docs/iterations/0017-project-workspace/status.md` §下一迭代候选 第 1 条（现为"**D-2（中·用户可见缺陷·第一优先）**…"单段叙述）改写为 §8.7 三段式（① 缺陷描述：`GET /api/chats` 与 `POST /api/messages` 的路由登记元数据 `params` 未包含必填参数 `project_id`；② 承接方：**单独的小迭代**（`0019-worktree-isolation-protocol` 完成之后启动，本迭代不承接）；③ 引用链：`0017/status.md` → `0018/status.md`（C-3 显式不纳入）→ `0019/status.md`（N2 显式排除并登记承接条件））+ 编号口径行；该节其余条目与全文其余部分**逐字不动**
- [ ] **0019 落点**：`docs/iterations/0019-worktree-isolation-protocol/status.md` §待确认项 的 D-2 段改写为同一格式 + 编号口径行（承接方与起始条件写明、引用链补全、`D-2` 一律写作 `0017/D-2`）；该段之外的任何段落（阶段状态 / PR 实现子状态 / 并发配置 / 用户确认记录 / 更新日志 / D-1 与 D-3~D-6 各段）**零改动**
- [ ] **三处互相引用链成立（含外部证据核对）**（F15 验收 2）：① 0017 与 0019 两处文本互指、且共同指向同一承接方；② 0018 一侧以外部证据核对——在分支 `iteration/0018-chat-agent-subagent-protocol` 的提交 `89182b7` 中，`docs/iterations/0018-chat-agent-subagent-protocol/status.md` 的 C-3 行写明"由 0019 完成后起的单独小迭代承接"与"三处 status（0017/0018/0019）互相引用留痕"；三处**指向同一承接方与同一起始条件**（"单独的小迭代，0019 完成后起"，不写"下一迭代"这类未绑定指代）
- [ ] **编号口径无两义**（F15 验收 3）：0017 与 0019 两处的登记段内出现编号口径规则——跨迭代引用一律 `<迭代号>/D-<n>`（如 `0017/D-2`）；`D-*` 在 0019 自身台账内不与 `0017/D-2` 复用同一编号（0019 自身台账项自 `D-3` 起编号）；改后 0019 `status.md` 中 `D-2` 的每一次出现均带迭代号
- [ ] **不含修复**（F15 验收 1）：本 PR 的 diff 中不出现 `project_id` 相关的代码 / 规范条款改动，不新增任何"登记元数据完备性"条款
- [ ] **单段改动约束（主 agent 裁定 Q-4 = (a)）**：本 PR 对 `docs/iterations/0019-worktree-isolation-protocol/status.md` 的 diff **只落在 §待确认项 的 D-2 段内**——该文件由主 agent 主线持续维护（阶段状态 / PR 子状态 / 并发配置 / 更新日志都在其中更新）；判定方式：取本 PR 的 diff，除 §待确认项 D-2 段之外的 `docs/iterations/0019-worktree-isolation-protocol/status.md` hunk 数必须为 **0**
- [ ] **合并前置（重基线）**：合并前必须以**当时的迭代分支**重基线（rebase / 重放），且只重放该单段改动；若重基线时该段与主线写入冲突，以主线内容为基、仅重放本 PR 的登记文本（不得凭旧副本覆盖主线在该文件其它位置的更新）

## 参考资料

- `docs/iterations/0019-worktree-isolation-protocol/architecture.md`（§8.7 D-2 三处登记写法与编号歧义规避规则 / §5.4 惯例文件同步 / §5.3 零改动清单 / §10 R-6）
- `docs/iterations/0019-worktree-isolation-protocol/prd/F15-d2-registration-trace.md`（完整验收标准 1~4）
- `docs/iterations/0019-worktree-isolation-protocol/demand.md`（N2 裁决原文：D-2 由单独小迭代承接、三处 status 互相引用留痕、本迭代不承接）
- `docs/iterations/0017-project-workspace/status.md:44-49`（§下一迭代候选 第 1 条 = 0017 侧的改写落点）
- `docs/iterations/0019-worktree-isolation-protocol/status.md:30-40`（§待确认项 D-2 / D-3 = 0019 侧的改写落点与既有编号冲突记录）
- **外部证据（0018 侧，本 PR 不写入）**：分支 `iteration/0018-chat-agent-subagent-protocol` 的提交 `89182b7`（`docs(0018): 台账修正……`）→ `docs/iterations/0018-chat-agent-subagent-protocol/status.md` §待确认项 C-3 行；核对方式 = 在该分支读取该 commit 的文件版本（本迭代工作区不含该目录，见 `docs/iterations/0019-worktree-isolation-protocol/progress.md:66`）
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/retro-0017-phase1.md`（Q-c C-4：D-2 有登记无承接 + 编号歧义）

## depends_on

（无）

> 说明：本 PR 只改两处 `status.md` 的登记文本，与 pr-001 的规范 / SKILL 改动**无文本耦合**（不引用任何新增章节名、不改任何条款）；两个 `status.md` 与 pr-001 的 6 个文件**无交集** ⇒ 可独立合并、独立验收，与 pr-001 可同波次并发。

## batch

1

> **备注（文件所有权与例外边界，不改变依赖判定）**：① `docs/iterations/0019-worktree-isolation-protocol/status.md` 是主 agent 持续维护的视图文件，本 PR 在独立 worktree 内改它 ⇒ 按主 agent 裁定 Q-4 = (a) 只改 §待确认项 的 D-2 单段、并在合并前以当时迭代分支重基线（见验收标准第 6、7 条）；② 0018 一侧按 Q-3 = ② 不写入、只作外部证据核对，**不开跨工作区写入例外**——规则 F 的例外是闭集两项，扩大例外会与 F09 验收 1 直接冲突。
