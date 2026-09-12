# progress.md — 0018-chat-agent-subagent-protocol

**观测者**: progress-observer（独立观测；不采信 status.md 与任何角色报告，结论一律回溯 git 一手记录）
**观测时点**: 2026-09-12 23:22:18 +0800（`date "+NOW=%F %T %z"` 实测）；窗口内首末两次 `git status --porcelain -uall` 均干净（末次 23:22:52 +0800）
**核实基准**: 迭代分支 `iteration/0018-chat-agent-subagent-protocol`（合并/解锁一律以该分支为准，不以 main 为准）
**会话工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol`
**本次观测的 git 现场锚点**:

| 项 | 值 | 核实命令 |
|---|---|---|
| 会话工作区 HEAD 分支 | `iteration/0018-chat-agent-subagent-protocol` | `git worktree list` → `d180728 [iteration/0018-chat-agent-subagent-protocol]`；`git branch` 中该行为当前行（`*`） |
| 迭代分支 tip（观测终点） | `d180728`「docs(0018): 首波验收结论 + 合并解锁 + 第二波派发记录」（committer 2026-09-12 23:21:35 +0800） | `git log --format="%h \| %ci \| %s" -1` |
| 迭代分支 tip（观测起点） | `bfe214f`「docs(0018): status 补齐 PR 子状态表并清除过期占位块」（23:21:11）→ 窗口内前进 1 个提交 | 首次 `git log --oneline -15` 与末次对照；`git reflog show iteration/0018-...` → `d180728@{0}` 紧接 `bfe214f@{1}` |
| `main` tip | `f7bf41e`；`main` **是**迭代分支 HEAD 的祖先 | `git merge-base --is-ancestor main HEAD` → 0（YES） |
| `main` 与 `origin/main` | `main` 领先 71 / 落后 0（未推送） | `git rev-list --left-right --count origin/main...main` → `0	71` |
| worktree 数量 | 3（仓库主工作区 `main`@`f7bf41e` / 会话工作区 / pr-003 子工作区） | `git worktree list` |
| PR worktree 存在性 | 仅 pr-003 子工作区存在 | `git worktree list`；`ls /Users/chenchiyuan/projects/agents/.git/worktrees/` → 仅 `0018-chat-agent-subagent-protocol`、`0018-pr-003-call-http-surface-and-contract-docs` 两项（pr-001/pr-002 的管理目录不存在） |

---

## 1. 阶段完成状态

status.md「## 阶段状态」表逐条核实。**本迭代产物现已全部被 git 跟踪**（`git ls-files docs/iterations/0018-chat-agent-subagent-protocol | wc -l` → **39**；`git status --porcelain -uall` 在会话工作区为空输出 ⇒ 无未跟踪/未提交产物），因此本节依据为「文件系统实测 + git 跟踪记录」，比上一版 progress.md（当时全部未跟踪）更强。

| 阶段 | status.md 声称 | 核实结果 | 依据 |
|---|---|---|---|
| 1 需求收敛 | ✅ / 已验证 ⬜ | **一致（产物存在且已提交）** | `demand.md`（63704 B）存在且被跟踪；`clarifications/` 下 `demand-round-1-proposals.md`、`recon-20260912.md`、`round-1.md`、`round-2.md`、`round-3.md` 5 份均存在且被跟踪。内容级声称（v1.2.0、P-1~P-11/Q-1 已裁决、`model_inferred` 归零）见第 6 部分 |
| 2 功能规格 | ✅ / ⬜ | **一致** | `prd.md`（238 行）存在；`prd/` 下 **16** 份卡文件 F01~F16 齐备（与声称「16 张卡（F01~F13 + 保证项 F14~F16）」一致）；`clarifications/prd-round-1.md`、`prd-round-2.md` 存在 |
| 3 技术架构 | ✅ / ⬜ | **一致（产物存在）**；但该行备注与「完成=✅」自相矛盾（见第 5 部分 4） | `architecture.md` 存在，**686 行**（`wc -l` → 686），与 status.md 更新日志「686 行」逐字一致 |
| 4 PR 规划 | ✅ / 已验证 ✅ | **一致** | `prs/` 下 5 份 PR 文件（pr-001~pr-005）+ 2 份 tasks 文件存在且被跟踪；阶段 4 Gate 报告 `clarifications/verify-stage4-gate-20260912-231000.md`（22434 B）存在且被跟踪 |
| 5 PR 实现 | ⏸ / ⬜ | **一致（进行中）** | 见第 3 部分：pr-001/pr-002 已合并进迭代分支，pr-003 已建 worktree/分支且零提交，pr-004/pr-005 无 worktree/分支 |
| 6 独立验证 | —（自注「按需触发」） | **已有 2 份 PR 级验证报告，非本阶段表口径** | `clarifications/verify-pr-001-20260912-232019.md`（14830 B）、`verify-pr-002-20260912-231911.md`（13222 B）；两者由 git 跟踪（提交 `06e6eef`）。阶段 6 报告（迭代级）未见 |

**「已验证」列**：阶段 1~3 均标 ⬜，与实测一致（无对应阶段级独立验证报告）：`clarifications/` 下仅 3 份 `verify-*`（阶段 4 Gate、pr-001、pr-002），无阶段 1/2/3 的验证报告。

---

## 2. PR 依赖核实

逐条对 `prs/pr-*.md` 的 `## depends_on` 声明做核实（声明原文见各 PR 文件；判定基准 = 依赖 PR 是否**已合并进迭代分支**）。

| PR | 声称 depends_on | 依赖是否已在迭代分支落地 | 判定 |
|---|---|---|---|
| pr-001-transport-call-key-namespace.md | （无） | 不适用（无依赖） | **一致**（声明为空，无需核实） |
| pr-002-registry-task-list-model.md | （无） | 不适用（无依赖） | **一致**（声明为空，无需核实） |
| pr-003-call-http-surface-and-contract-docs.md | pr-001, pr-002 | **两条均已合并** | **一致（2/2 满足）** |
| pr-004-console-call-page.md | pr-003 | **未满足**（pr-003 未合并） | **一致**（与 status.md「未解锁」一致） |
| pr-005-call-protocol-acceptance-tests.md | pr-003 | **未满足**（pr-003 未合并） | **一致**（同上） |

**pr-003 依赖的两条实证**（迭代分支基准）：

- `git log iteration/0018-chat-agent-subagent-protocol --grep="pr-001" --oneline` → `b92ad82 Merge branch 'feat/0018-pr-001-transport-call-key-namespace' into iteration/0018-chat-agent-subagent-protocol`（分支名见提交标题）。
- `git log iteration/0018-chat-agent-subagent-protocol --grep="pr-002" --oneline` → `95051b0 Merge branch 'feat/0018-pr-002-registry-task-list-model' into iteration/0018-chat-agent-subagent-protocol`。
- `git merge-base --is-ancestor b92ad82 HEAD` → **YES**；`git merge-base --is-ancestor 95051b0 HEAD` → **YES**。
- 内容级佐证（代码产物确实在迭代分支上）：`oamp/src/transport.js:140` 含 `handleCallStream, publishCall, handleChatCallStream, publishChatCall`（行 75/80/103/109 为四方法定义）；`oamp/src/registry.js:269` 含 `model: task.result?.model ?? null,`。
- 实现提交亦均为 HEAD 祖先：`cb1bdc8`（pr-001）YES、`a827f4e`（pr-002）YES。
- **分支分叉点与合并父提交已核实**：`git show -s --format=%p b92ad82` → `06e6eef cb1bdc8`、`git show -s --format=%p 95051b0` → `b92ad82 a827f4e`；`git merge-base cb1bdc8 b92ad82^1` → `97ee9ac`、`git merge-base a827f4e 95051b0^1` → `97ee9ac` ⇒ pr-001/pr-002 两分支的 base 均为阶段 4 Gate 提交 `97ee9ac`（23:11:23）。

**汇总**：`depends_on` 声明 5 条（2 条空、3 条非空）；核实**一致 5 条 / 不一致 0 条**。

---

## 3. PR 实现状态核实

| PR | worktree | 分支 | HEAD | 是否已合并进迭代分支 | 与 status.md 声明对照 |
|---|---|---|---|---|---|
| pr-001 | **不存在**（`git worktree list` 无；`/Users/chenchiyuan/projects/agents/.git/worktrees/` 无对应管理目录） | `feat/0018-pr-001-transport-call-key-namespace` **已删除**（`git branch -a` 无匹配） | 实现提交 `cb1bdc8`（23:17:31）：`oamp/src/transport.js  +68 -19` | **已合并**=`b92ad82`（祖先=YES）；合并 diff：`transport.js 87 行变更` + `prs/pr-001-tasks.md +105` | status.md 记「✅ 已合并 / 分支已删除 / `b92ad82`」→ **一致** |
| pr-002 | **不存在**（同上） | `feat/0018-pr-002-registry-task-list-model` **已删除** | 实现提交 `a827f4e`（23:15:23）：`oamp/src/registry.js +1` | **已合并**=`95051b0`（祖先=YES）；合并 diff：`registry.js +1` + `prs/pr-002-tasks.md +71` | status.md 记「✅ 已合并 / 分支已删除 / `95051b0`」→ **一致** |
| pr-003 | **存在**：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol/.pb-agents/worktrees/0018-pr-003-call-http-surface-and-contract-docs`（目录 mtime 23:21:04） | `feat/0018-pr-003-call-http-surface-and-contract-docs` **存在** | `95051b0`（= pr-002 合并提交，**非**当前迭代 tip）；相对迭代 HEAD：`git rev-list --left-right --count HEAD...该分支` → `3	0`，`git log HEAD..该分支` → 空 ⇒ **零自有提交**；工作区 `git status --porcelain -uall` → 空 ⇒ 无未提交实现改动；`prs/pr-003-tasks.md` **不存在**（会话工作区与 pr-003 子工作区均无） | **未合并** | status.md 记「⏸ 进行中（**尚未派发**）」→ **不一致**（worktree+分支已建），见第 5 部分 1 |
| pr-004 | 不存在 | 不存在 | — | 未合并（依赖 pr-003 未满足） | status.md 记「⬜ 未解锁」→ **一致** |
| pr-005 | 不存在 | 不存在 | — | 未合并（同上） | status.md 记「⬜ 未解锁」→ **一致** |

补充事实：pr-003 分支 base = `95051b0`，落后当前迭代 tip `d180728` **3 个提交**（`161ad36` 台账 / `bfe214f` status 补齐 / `d180728` 波次记录，均为 docs 台账提交）；两个依赖合并均在 `95051b0` 内 ⇒ 依赖满足性不受影响。

---

## 4. 并发度分析

**status.md「## 并发配置（阶段 5）」五字段核实**：

| 字段 | 声称 | 实测/推导 | 判定 |
|---|---|---|---|
| 起始并发数 | 3 | 规范默认值 3（`roles/workflow-pb/workflow-pb.md` 规则：默认 3）；无相反 git 记录 | **一致** |
| 硬上限 | 5（`2×起始-1`） | `2×3-1 = 5`；与公式一致 | **一致** |
| 当前有效上限 | 5（`min(3+2×3,5)`） | 迭代分支上 pr 合并提交恰 **2** 个（`b92ad82`、`95051b0`）⇒ 释放次数 2 ⇒ `min(3+2×3,5)=5` | **一致**（爬升公式真实触发，已触硬上限） |
| 累计槛位释放次数 | 2（pr-001 合并 +1；pr-002 合并 +1） | `git log iteration/... --merges --oneline` 在 0018 迭代内可见 2 条 PR 合并提交（`b92ad82`/`95051b0`），二者提交标题即分支名 | **一致** |
| 已派发总数 | 2 | **实测 worktree 创建次数 ≥ 3**（pr-001 / pr-002 已删、pr-003 现存；`d180728` 提交信息含「第二波派发记录」） | **不一致**（见第 5 部分 1） |

**并发度现状**：

- **在飞行中（占用槛位）的 PR**：1 个 —— pr-003（已建 worktree/分支，planner 产物 `prs/pr-003-tasks.md` 在观测时点尚未落盘，分支零提交）。
- **可并发但闲置的 PR**：**0 个**。判定依据：依赖已满足（= 全部 `depends_on` 均已合并进迭代分支）且未派发的 PR 集合为空 —— pr-003 依赖已满足但**已派发**；pr-004/pr-005 依赖 pr-003 未合并 ⇒ 属**正常阻塞**，不是闲置。
- **正常阻塞的 PR**：2 个 —— pr-004、pr-005（共同依赖 pr-003）。
- **槛位空置事实**：当前有效上限 5，实际在飞 1 ⇒ 空置 4 个槛位；规范明文「没有已解锁且排队中的 PR 时，释放出的槛位保持空置，不触发任何派发」，故该空置**不构成不一致项**，此处仅记录事实。
- **已合并 PR 的现场清理**：pr-001/pr-002 的 worktree 与分支均已不存在（`git worktree list` 仅 3 条；`/Users/.../.git/worktrees/` 仅 2 项；`git branch -a` 仅 `feat/0018-pr-003-*`、`iteration/0018-*`、`main`、`origin/main`）⇒ 与 history.md 23:49「两 PR worktree `remove` + 两 `feat/*` 分支 `-d`」声称**一致**。

---

## 5. 发现的不一致

以下均为「文件声称」vs「git 一手记录/文件系统实测」的差异，逐条列出，**不做严重性判断、不给处理建议**。

1. **status.md 声称 pr-003「尚未派发」且「已派发总数 = 2」，实测 pr-003 的 worktree 与分支均已存在（= 派发动作已发生）。**
   - 声称：status.md 第 45 行 `| **已派发总数** | 2 |`；第 55 行 `| pr-003-… | pr-001, pr-002 | ⏸ 进行中（尚未派发） | feat/0018-pr-003-… | — | — |`。
   - 实测：`git worktree list` 第 3 条 = `.pb-agents/worktrees/0018-pr-003-call-http-surface-and-contract-docs  95051b0 [feat/0018-pr-003-call-http-surface-and-contract-docs]`；`git branch` 列出 `feat/0018-pr-003-call-http-surface-and-contract-docs`；该 worktree 目录 mtime = 2026-09-12 23:21:04（`stat -f "%Sm"`）。
   - 旁证：`d180728` 提交主题「…+ 第二波派发记录」（23:21:35）；history.md 末条「2026-09-12 23:51:00 · 派发 · planner（pr-003）+ progress-observer（同批并发）」。
   - 时间锚点说明（非结论，仅记录）：status.md mtime = 23:21:11，早于 `d180728`（23:21:35）；worktree 目录 mtime 23:21:04 与 `161ad36`（23:21:04）同秒。截至观测终点，声称与实际不符。

2. **history.md 记录的时标系统性超前于 git 提交的 committer 时间，且超前于系统时钟当前时刻。**
   - 实测对照（左侧 history.md 条目标称时间 → 右侧 git 一手时间）：
     - 「23:26:00 · 收到报告 · planner（pr-001）」→ 任务图提交 `48b056e`（pr-001）/`2630395`（pr-002）committer 时间 = **23:14:20**；
     - 「23:34:00 · 收到报告 · dev（pr-002）」→ 实现提交 `a827f4e` = **23:15:23**；
     - 「23:41:00 · 收到报告 · dev（pr-001）」→ 实现提交 `cb1bdc8` = **23:17:31**；
     - 「23:42:00 · 派发 · verifier」→ 验收报告归档提交 `06e6eef` = **23:20:58**；
     - 「23:49:00 · 调度决策 · 槛位释放（合并）」→ 合并提交 `b92ad82` / `95051b0` = **23:20:58**。
   - 文件级证据：`history.md` mtime = **23:21:34**（285 行），但其内已含标注至 23:49 / 23:50 / 23:51 的条目；系统时钟在观测时点 = **23:22:18**（`date`）⇒ 那些条目标称的时刻在写入时尚未到达。
   - 结论（事实层）：history.md 的时标不是事件在 git 中的真实时刻，而是人工/逻辑时标；事件**实质**（提交、合并、worktree 清理、第二波派发）与 git 记录可一一对上，但**时刻**对不上。

3. **status.md 同文件内对「当前阶段/阶段 4 状态」自相矛盾。**
   - 第 5 行：`**当前阶段**: 阶段 5（PR 实现，进行中；阶段 1~4 已完成）`；第 26~35 行阶段状态表：阶段 4 完成 ✅ / 已验证 ✅、阶段 5 ⏸。
   - 第 8 行：`**状态**: **进行中**（阶段 3 已完成；阶段 4 进行中）` ⇒ 该行仍停留在阶段 4 进行中，与第 5 行及阶段表冲突。

4. **status.md 阶段状态表「阶段 3」同一格内「完成=✅」与「备注=待启动」自相矛盾。**
   - 第 32 行：`| 3 | 技术架构 | ✅ | ⬜ | 待启动（输入 = prd.md v0.2.0 + prd/F01~F16；按 workflow-pb v0.9.0 在会话工作区内执行） |`。实测该阶段产物 `architecture.md` 686 行已存在且被提交（更新日志中另有「阶段 3 完成并推进…686 行」记载）⇒ 备注文本为阶段 3 未启动时的旧值。

5. **status.md 工作流版本声明不一致：头部 v0.10.0 vs §恢复设置 内三处 v0.9.0。**
   - 第 3 行：`**工作流**: workflow-pb **v0.10.0**（自本迭代恢复起适用…）`；第 21 行：`| 生效协议版本 | **workflow-pb v0.9.0**（本迭代恢复后的阶段 3~6 按新规范执行…）|`；第 16、18 行「依据」列亦写 `workflow-pb v0.9.0 规则 C` / `规则 A/B`。

6. **status.md §恢复设置「检出分支 … tip `deeb1b7`」已过期。**
   - `deeb1b7` 存在（`git rev-parse --verify deeb1b7` → `deeb1b7563da51dcbdd7e87c36945fee423bb837`），提交主题「Merge branch 'main' into iteration/0018-chat-agent-subagent-protocol」，committer 2026-09-12 20:15:40；`git merge-base --is-ancestor deeb1b7 HEAD` → YES（确为祖先），但 `git rev-list --count deeb1b7..HEAD` → **59** ⇒ 它是 59 个提交之前的旧 tip，非当前 tip（当前 `d180728`）。

**「status.md 与 git 一致项」（同表列出，供对照）**：pr-001/pr-002 的「已合并 + 合并 commit 号 + 分支已删除」三格；阶段表阶段 1/2/4/5 的完成列；并发配置前四字段（起始 3 / 硬上限 5 / 有效上限 5 / 累计释放 2）；PR 子状态表 pr-004/pr-005「未解锁」。

---

## 6. 无法核实项

1. **pr-001 / pr-002 worktree 的「创建时刻」与「删除时刻」无法核实**。现状可核实（`git worktree list` 无、`/Users/chenchiyuan/projects/agents/.git/worktrees/` 仅剩 2 项、`git branch -a` 无对应分支），但 git 不保留已删除 worktree 的痕迹，`branch -d` 同时清掉了分支 reflog ⇒ 「创建时刻 / 删除时刻」仅有 history.md 自述（23:22 创建、23:49 删除）。**其 base 已核实**：`git merge-base cb1bdc8 b92ad82^1` → `97ee9ac`、`git merge-base a827f4e 95051b0^1` → `97ee9ac` ⇒ 两 PR 分支均自 `97ee9ac`（阶段 4 Gate 提交，23:11:23）分出，与 history.md「两者 base = 迭代分支 tip `97ee9ac`」一致。
2. **history.md 时标的生成依据无法核实**。各条目自称「23:26 / 23:34 / 23:41 / 23:49 …」，与 git committer 时间不一致（第 5 部分 2），但不存在可指向其真实时刻的任何 ref/日志。
3. **status.md/history.md 的内容级声称无法用 git 核实**（本角色不做内容级质量判定）：例如「pr-001 验收 PASS 32 项 / fail 0 / partial 0」「pr-002 PASS 19 项」「阶段 4 Gate PASS 9/9」「L1 = 0 条」「§11 必然变更点 10 条」「模型/卡内 `[model_inferred]` 归零」「P-1~P-11 与 Q-1 经用户逐条裁决」等。可核实的仅是**报告文件存在且被提交**：`clarifications/verify-stage4-gate-20260912-231000.md`（22434 B）、`verify-pr-001-20260912-232019.md`（14830 B）、`verify-pr-002-20260912-231911.md`（13222 B）三份均存在，其中前两份的归档提交可从 history 的「23:42 派发 verifier」→ 提交 `06e6eef`（23:20:58）对应上。报告内部结论真伪不在本角色核实范围。
4. **「用户裁决真实发生」无 git 一手记录**（人机交互不落 commit）；status.md「用户确认记录（Gate）」与 history.md 的相关自述均属声明。
5. **pr-003 planner 的实际作业进度只反映观测时点**：观测时点 `prs/pr-003-tasks.md` 不存在、pr-003 分支零提交、子工作区 `git status` 干净 ⇒ 不能推断「未开工」也不能推断「已完成」；且迭代分支 tip 在观测窗口内仍在前移（`bfe214f`→`d180728`），本报告结论以第 1 段锚点为界，不追认此后变更。
6. **main 与迭代分支的「整合态」完整性未做内容级核实**：可核实的是 `main` 是迭代 HEAD 的祖先、`main` 上存在 `docs/worktrees/README.md`（`git cat-file -e main:docs/worktrees/README.md` → 存在），与 status.md「含 0020 的…协议产物」相符；但「0017/0019/0020 全部产出零丢失」属内容级判断，未核实。

---

**本次观测的写入边界**：唯一写入 = 本文件（整体覆盖）。未修改 `status.md`、`history.md`、`prs/*.md`、任何代码或任何 git ref；全部 git 命令为只读（`log / show / branch / worktree list / status / rev-list / merge-base / rev-parse / reflog show / cat-file -e / ls-files`）。**未执行任何写入性 git 命令**（无 `commit`/`merge`/`branch -d`/`worktree remove`/`checkout`/`stash`）。

**三处 `git status --porcelain -uall` 交付**（末次 2026-09-12 23:22:52 +0800）：

- 会话工作区 `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol`：**空输出**（干净；含本文件在内 39 个迭代产物均已被跟踪且无改动 —— 本文件在本次观测为「被跟踪且内容已提交版本」，观测结束时的覆盖写入见本次提交）。
- 仓库主工作区 `/Users/chenchiyuan/projects/agents`：**空输出**（干净；无跨工作区写入痕迹）。
- 第三处（PR 子工作区）`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol/.pb-agents/worktrees/0018-pr-003-call-http-surface-and-contract-docs`：**空输出**（干净；无未提交实现改动）。无「其他」工作区。
