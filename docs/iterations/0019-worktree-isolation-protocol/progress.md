# 进度快照（独立观测）

**迭代**: 0019-worktree-isolation-protocol
**观测者**: progress-observer（独立角色；不采信 `status.md` 或任何角色自我声明）
**观测时刻**: 2026-09-12 18:16:47 +0800
**观测基线**: 迭代分支 `iteration/0019-worktree-isolation-protocol` @ `27f280bcbb97371329b1669eb63183b2d0958de3`（= 工作区 HEAD）
**核实手段**: 只读 git 命令（`status` / `log` / `show` / `ls-files` / `ls-tree` / `diff` / `merge-base` / `for-each-ref` / `rev-parse` / `reflog` / `worktree` / `stash`）+ 文件存在性与内容读取；**未执行任何写入性 git 命令**
**快照性质**: 整体覆盖写入，不保留历史版本（历史归 git commit history）

---

## 1. 阶段完成状态

### 1.0 待核实声明清单（来源：`docs/iterations/0019-worktree-isolation-protocol/status.md`）

| # | status.md 声称 | 声称标记 |
|---|---|---|
| S-1 | 阶段 1（需求收敛）完成 | ✅ |
| S-2 | demand.md 为 v1.3.0；P-1~P-16 + D-2 共 17 项全部经用户裁决；`model_inferred` 归零；C-1~C-8 全部已决 | 备注列 |
| S-3 | 阶段 1 产物分三次提交（`0a89a4d` / `c3b5152` / `27f280b`） | 更新日志 + 偏离记录 |
| S-4 | 阶段 2（功能规格）已派发 prd，输入 = demand.md v1.3.0 | ⏸ |
| S-5 | 阶段 3 / 4 / 5 / 6 未开始 | ⬜ |
| S-6 | 迭代分支 base = main @ `9ede9ea`（含 0017 全部产出） | 抬头 |
| S-7 | 0018 已暂停在阶段 2 已收敛处 | 前置 |
| S-8 | D-2 已在 0017 / 0018 / 0019 三处留痕 | 待确认项 |
| S-9 | D-4：0017 `verify-stage6-20260912-173934.md` 提交版自相矛盾（第 77 行 `695-698` / 第 160 行 `695-699`），源真值 `oamp/src/web.js` 696-697 | 待确认项 |
| S-10 | D-1 第二个写入方「已停」；主 agent 采取「落盘即提交 + 切分支前核对」 | 待确认项 / 偏离记录 |

### 1.1 逐条核实

**S-1 / S-2（阶段 1 完成）→ 一致（产物层）**
- `git show --stat 27f280b` → `…/demand.md | 302 ++++++++++`（该提交引入 demand.md）；`git ls-files docs/iterations/0019-worktree-isolation-protocol` → demand.md 已被追踪。
- `git diff --quiet HEAD -- docs/iterations/0019-worktree-isolation-protocol/demand.md` → **CLEAN**（无未提交改动）。
- demand.md 第 6 行：`**版本**: v1.3.0（**第四轮归零收口版…`；第 179 行 §6 统计表：`| model_inferred | 0 项（归零） |`。
- 结论：**产物存在且已提交，与声称一致**。status.md「已验证」列为 ⬜（自称未经独立验证）；`git ls-files … | grep -c "verify-\|progress"` = **0** → 迭代目录内无阶段 1 的独立验证产物，与该 ⬜ 自述一致。裁决行为本身的核实边界见 §6 U-1。

**S-3（三次提交）→ 一致**
- `git log --oneline main..iteration/0019-worktree-isolation-protocol` → 恰好 3 条：`27f280b` / `c3b5152` / `0a89a4d`（hash 与声称逐一对应）。
- `git log --oneline -- docs/iterations/0019-worktree-isolation-protocol` → 同上 3 条，无第四条。
- 逐提交文件归属（`git show --stat`）：`0a89a4d` = status.md + history.md + clarifications/incident-20260912.md（3 文件）；`c3b5152` = round-1.md + demand-round-1/2-proposals.md + retro-0017-phase1.md（4 文件）；`27f280b` = demand.md + round-3.md + round-4.md + demand-round-3-proposals.md + history.md + status.md（6 文件）。
- 提交计数本身一致；status.md 正文措辞差异见 §5 F-2。

**S-4（阶段 2 已派发、进行中）→ 一致**
- 阶段 2 产物：`prd.md`、`prd/`、`feature-spec-index.md` 均 **ABSENT**（文件存在性判定）；`git ls-files` 0019 目录共 11 个文件，全部属阶段 1（见 1.2）。
- 工作区唯一未提交改动：` M docs/iterations/0019-worktree-isolation-protocol/history.md`（`git status --porcelain=v1`），diff 内容 = 新增 `### 2026-09-12 18:16:00 · 派发 · prd` 段（4 行）。
- 运行中的 worker：`Prd019`（roster 显示 running）——与派发记录同向，但**不构成产物证据**。
- 结论：与「已派发、进行中、产物未落盘」一致。

**S-5（阶段 3/4/5/6 未开始）→ 一致**
- `architecture.md`、`tasks.md`、`prs/` 均 ABSENT；`git ls-files docs/iterations/0019-worktree-isolation-protocol` 无 `architecture.md` / `tasks.md` / `prs/*` 条目。

**S-6（base = main @ 9ede9ea）→ 一致**
- `git merge-base main iteration/0019-…` = `9ede9ead2a5bdcfe79c20e0b3bb7b3fdcb3aebeb`；`git merge-base --is-ancestor main iteration/0019-…` → **YES**（main 是迭代分支祖先）。
- `git log --oneline main` HEAD = `9ede9ea`。
- `git merge-base --is-ancestor iteration/0019-… main` → **NOT MERGED**（迭代分支尚未合并进 main）。
- `git ls-tree -r --name-only main | grep -c docs/iterations/0017-project-workspace` = **35**，与 0019 分支上的 0017 文件数 **35** 相同 → 0017 全部产出在 base 中。

**S-7（0018 已暂停）→ 一致（git 层）**
- `git log -1 --pretty='%h %ad %s' --date=iso iteration/0018-chat-agent-subagent-protocol` → `a905848 2026-09-12 17:52:46 …阶段 2 收敛与暂停记录`；`git log --oneline -3 iteration/0018-…` 无更晚提交。
- 0018 HEAD 时间（17:52:46）早于 0019 分支首个提交 `0a89a4d`（17:53:53）→ 0019 启动后 0018 分支零新提交。

**S-8（D-2 三处留痕）→ 一致；附一条位置事实**
- 0017：`docs/iterations/0017-project-workspace/status.md:44` `## 下一迭代候选（阶段 6 独立验证提出，按优先级）`，`:46` 列 D-2 为第一优先；该文件在 main 中存在（`git ls-tree -r --name-only main | grep -c "…/status.md"` = 1）。
- 0018：`git show iteration/0018-…:docs/iterations/0018-chat-agent-subagent-protocol/status.md` 第 34 行 `C-3（0017 遗留缺陷 D-2，用户裁决：不纳入）`（读取自 `a905848` 版本）。
- 0019：`status.md` §待确认项 `D-2（跨迭代承接项，用户裁决 ①）`。
- **位置事实**（非不一致）：`docs/iterations/0018-*/` 仅存在于分支 `iteration/0018-chat-agent-subagent-protocol`；`git ls-tree -r --name-only main | grep -c docs/iterations/0018` = **0**，0019 工作区亦无该目录 → 三处留痕中的 0018 一处当前在 main / 本工作区不可见。

**S-9（D-4 一字符差异）→ 一致（自相矛盾成立）**
- 真实路径 = `docs/iterations/0017-project-workspace/clarifications/verify-stage6-20260912-173934.md`（`git ls-files | grep verify-stage6`），全文 278 行。
- `sed -n '77p;160p'` → 第 77 行含 `（`:695-698`）`，第 160 行含 `` `:695-699` `` → **提交版内部自相矛盾成立**。
- 源真值抽查：`sed -n '692p;695,699p' oamp/src/web.js` → 692 = `const project = projectRow === null ? null : {name, repo_url, agreement}`；695 = `: body.one_shot === true`；696/697 = 两条 LLM 分支 payload（各含 `...(project === null ? {} : { project })`）；698/699 = `let dispatched` / `let warning`。→ status.md D-4 所称「源真值 696-697」精确落到两条 payload 行；`695-698` 多含 698、`695-699` 多含 698/699。
- 路径写法差异见 §5 F-4。

**S-10（D-1 已停 / 工作区）→ 部分一致（工作区非干净）**
- `git worktree list --porcelain` → **仅 1 条**：`/Users/chenchiyuan/projects/agents` + `branch refs/heads/iteration/0019-…`；`git worktree prune --dry-run -v` → 无输出（无残留/可清理 worktree 元数据）。
- `git stash list` → **空**；`git rev-parse --verify refs/stash` → `fatal: Needed a single revision`（stash ref 不存在）。
- `git for-each-ref` → 全部 ref 共 4 条：`iteration/0019-…`(27f280b, 18:15:19)、`iteration/0018-…`(a905848, 17:52:46)、`main`(9ede9ea, 17:46:02)、`origin/main`(1c37e80, 14:59:04)。`git log --all` 最新提交 = `27f280b`（18:15:19）→ **无任何分支出现晚于 0019 HEAD 的提交**。
- `git status --porcelain=v1 --untracked-files=all` → 仅 ` M docs/iterations/0019-worktree-isolation-protocol/history.md`，**无未跟踪文件**。
- 结论：无第二个写入方在 refs / 工作区层面的痕迹（截至观测时刻）；但工作区**并非干净**（1 处未提交改动，见 §5 F-1），「已停」作为状态声明 git 无法证明（见 §6 U-2）。

### 1.2 迭代目录产物清单（`git ls-files` 11 项 + 引入提交）

| 文件 | 引入提交 |
|---|---|
| `clarifications/incident-20260912.md` | `0a89a4d` |
| `history.md` | `27f280b`（`0a89a4d` 创建、`27f280b` 改写） |
| `status.md` | `27f280b`（`0a89a4d` 创建、`27f280b` 改写） |
| `clarifications/round-1.md` | `c3b5152` |
| `clarifications/demand-round-1-proposals.md` | `c3b5152` |
| `clarifications/demand-round-2-proposals.md` | `c3b5152` |
| `clarifications/retro-0017-phase1.md` | `c3b5152` |
| `clarifications/round-3.md` | `27f280b` |
| `clarifications/round-4.md` | `27f280b` |
| `clarifications/demand-round-3-proposals.md` | `27f280b` |
| `demand.md` | `27f280b` |

（`git log -1 --format=%h -- <path>` 逐文件取值；`progress.md` 本次快照为本目录第 12 个文件，尚未被提交。）

---

## 2. PR 依赖核实

**不适用（阶段 4 未到）。**

依据：
- `docs/iterations/0019-worktree-isolation-protocol/prs/` **不存在**（`find`/`[ -d ]` 判定 ABSENT）；`git ls-files docs/iterations/0019-worktree-isolation-protocol | grep prs` 无输出。
- 因此 `prs/pr-{NNN}.md` 的 `depends_on` 声明集合为**空集**——**无任何依赖声明可供核实**。
- status.md 自身亦写「PR 实现子状态（阶段 5 展开）：待阶段 4 产出 `prs/` 后初始化」→ 与本快照一致。
- 待核实条目：**（无）**。

---

## 3. PR 实现状态核实

**不适用（阶段 4 未到，尚无 PR worktree / PR 分支）。**

依据：
- `git worktree list --porcelain` → 仅 1 个工作树（主仓 `/Users/chenchiyuan/projects/agents`，`branch refs/heads/iteration/0019-worktree-isolation-protocol`，HEAD `27f280b`）→ **PR worktree 数 = 0**。
- `git branch -a -v` → 仅 4 个 ref（见 §1.1 S-10）→ **无 `feat/pr-*`、`pr-*` 等 PR 分支**。
- 无 `prs/` 目录 → 无「HEAD 相对依赖基线位置」可计算、无「是否已合并」可判定。
- PR 级待核实条目：**（无）**。

**当前唯一的 ref 层事实（供主 agent 对齐基线）**：

| ref | HEAD | 时间 | 相对 main | 合并状态 |
|---|---|---|---|---|
| `iteration/0019-worktree-isolation-protocol` | `27f280b` | 2026-09-12 18:15:19 | ahead 3（`0a89a4d`/`c3b5152`/`27f280b`） | 未合并（`--is-ancestor` → NOT MERGED） |
| `iteration/0018-chat-agent-subagent-protocol` | `a905848` | 2026-09-12 17:52:46 | ahead 2（`028ca8a`/`a905848`） | 未合并 |
| `main` | `9ede9ea` | 2026-09-12 17:46:02 | — | — |
| `origin/main` | `1c37e80` | 2026-09-12 14:59:04 | main ahead 16 | 本地未推送 |

附（ref 层事实，不构成与任何 0019 声称的矛盾）：`028ca8a` 仅从 0018 分支可达、不在 main（`--is-ancestor 028ca8a main` → NO）；`git diff --stat 028ca8a 9ede9ea` 全树仅 1 文件差（`0017-project-workspace/history.md`，9ede9ea 多 6 行），且 `git diff --stat 028ca8a 9ede9ea -- …/0017-project-workspace/status.md` 为空 → 内容已被 main 的 `9ede9ea` 覆盖（status.md 逐字相同，history.md 为超集）。

---

## 4. 并发度分析

**不适用（阶段 4/5 未到，PR 集合为空）。**

- **满足依赖但未被派发的 PR 数 = 0**：不存在任何 PR 声明（无 `prs/`）→ 不存在「依赖已满足」的 PR，故也不存在闲置 PR（空集不计为闲置）。
- **可并发度 = 0（PR 维度）**：`git worktree list` 仅 1 条 = 0 个 PR worktree；无 PR 分支（`git branch -a`）。
- 迭代级并发现状：本分支独享唯一工作区，工作区 HEAD = 分支 HEAD = `27f280b`，无并行的分支写入痕迹（§1.1 S-10）。
- status.md「并发配置（阶段 5）：待阶段 4→5 入口初始化」→ 与本快照一致。
- 说明（事实，不含建议）：本迭代主题即「并行会话各用独立工作区」，但其自身的 PR 层工作区尚未产生——这是阶段 4 未到的**预期状态**，非缺失。

---

## 5. 发现的不一致

### F-1 工作区非干净：`history.md` 存在未提交改动，status.md 未记载该状态
- 声称：status.md 更新日志末条「2026-09-12: 用户裁决 P-16 ① → … → 进入阶段 2（功能规格），派发 prd」，其提交动作表述为「本轮补交」已完成；status.md 无任何「存在未提交改动」的记载。
- 实测：`git status --porcelain=v1` → ` M docs/iterations/0019-worktree-isolation-protocol/history.md`；`git diff --stat HEAD -- docs/iterations/0019-worktree-isolation-protocol/` → `1 file changed, 4 insertions(+)`；`git show HEAD:…/history.md | wc -l` = **106**，工作区 `wc -l` = **110**。
- 改动内容（`git diff` 全文）：新增 `### 2026-09-12 18:16:00 · 派发 · prd` + 3 行（阶段 = 阶段 2；任务 = 功能卡原子化，只做产品维度）。
- 归属判定（事实层）：改动落在 0019 目录内、内容为阶段 2 派发记录 → **属本迭代进行中的写入，不是「非本迭代的他人未提交改动」**；工作区其余部分（含 status.md、demand.md）逐文件 CLEAN（`git diff --quiet HEAD -- <path>`）。

### F-2 status.md 的提交计数用词与列举不符
- 声称：status.md 第 37 行「0019 的产物在阶段 1 期间即**分两次提交**进本分支（`0a89a4d`、`c3b5152`）」；第 59 行「阶段 1 产物**分两次提交**（`0a89a4d`、`c3b5152`、本轮补交）」。
- 实测：`git log --oneline main..iteration/0019-…` → **3 条**提交；第 59 行列举了 3 个元素却写「两次」。
- 差异性质：**数量词与列举对象不符的表述级不一致**；git 事实（3 条提交、hash 全部对得上）与 status.md 提交清单本身不矛盾。

### F-3 澄清记录序列缺 `round-2.md`
- 声称：status.md / history.md 未声称 `round-2.md` 存在（history.md 仅有 18:05:30「收到报告 · demand」对应第二轮收报）。
- 实测：目录内存在 `clarifications/round-1.md`、`round-3.md`、`round-4.md`，**不存在 `round-2.md`**（`find` + `git ls-files` 双查一致）；第二轮仅留提案正本 `clarifications/demand-round-2-proposals.md`，其正文自述「以下 2 项全部保持 `[model_inferred]`，用户裁决前不得写入结论、不得推进阶段 2」（即第二轮确有 2 项待裁决）。
- 差异性质：**澄清记录序列不连续（round-2 记录缺位）**；第二轮的实际裁决落点在 demand.md §1.2 / §7 与 round-3.md。

### F-4 D-4 引用路径未写全子目录
- 声称：status.md 第 36 行引用「0017 `verify-stage6-20260912-173934.md`」。
- 实测：文件真实路径为 `docs/iterations/0017-project-workspace/clarifications/verify-stage6-20260912-173934.md`（`git ls-files | grep verify-stage6` 仅此一条，位于 `clarifications/` 子目录）。
- 差异性质：引用路径缺子目录（D-4 所述行号差异本身已核实为真，见 §1.1 S-9）。

### F-5 提交版 `history.md` 存在时间倒序条目
- 实测（`grep -n "^### " history.md` + `sed -n '35,70p'`）：第 39 行 `### 2026-09-12 18:07:30 · 收到报告 · retrospective` 位于第 48 行 `### 2026-09-12 18:05:30 · 收到报告 · demand` **之前**（同一提交 `27f280b` 内）。
- 差异性质：同一文件内条目未按时间单调排列（retrospective 收报记于 18:07:30、demand 收报记于 18:05:30，但后者排在前面）。无对应状态声明 → 不构成对任何声称的反证。

### F-6（跨迭代，超出 0019 status 声称范围，仅记工作区实测）0018 status 声称的具名 stash 在 git 中不存在
- 声称（来源：分支 `iteration/0018-chat-agent-subagent-protocol` 的 `status.md` 第 33 行 C-2）：「两者已 `git stash push` 具名为 `0017 收口残留（外部会话未提交）…`」「恢复 0018 时在同一分支 `git stash pop` 即可」；第 54 行亦称「0017 两处残留具名 stash 保存」。
- 实测：`git stash list` → **空**；`git rev-parse --verify refs/stash` → `fatal: Needed a single revision`（**stash ref 不存在**）→ 该具名 stash 当前不在本仓库任何 ref 中。
- 同一声称的另一半为真：其所述备份目录 `/tmp/pb-0017-residual/` **存在**（3 文件：`history.worktree.md` 44715B、`verify-stage6.moved.md` 39571B、`verify-stage6.worktree.md` 39571B，mtime 17:42~17:44）。
- 附带实测：工作区 `clarifications/verify-stage6-20260912-173934.md` 与提交版一致（`git status` 中该文件无改动），第 160 行仍为 `:695-699` → C-2 所述「工作区版本修正为 `:695-698`」的版本当前不在工作区、也不在 git 中。

### 不一致计数
- **6 条**（F-1 ~ F-6，其中 F-6 为跨迭代/超出 0019 status 声称范围的工作区实测项；F-2/F-4 为表述级差异，F-3/F-5 为记录层差异，F-1/F-6 为工作区/ref 层差异）。

---

## 6. 无法核实项

- **U-1 「17 项全部经用户裁决、C-1~C-8 全部已决」这一裁决行为本身无法用 git 一手记录核实。** 可核实到的只是落盘文本：demand.md §1.1~§1.4 摘录的「用户原文」、`clarifications/round-1.md`/`round-3.md`/`round-4.md`、`demand-round-1/2/3-proposals.md`。这些文件均为角色产出物，不构成「裁决真实发生」的独立证据（无 git 层可验证的用户输入记录）。可核实的替代事实：demand.md 内 `model_inferred` 仅作为术语出现（9 处，全文无未裁决条目标记）、§7 自检表三项自述全 ✅。
- **U-2 D-1「第二个写入方已停」无法证明。** git 可证明的只是观测时刻的状态：无残留 worktree（`worktree list` 1 条 / `prune --dry-run` 无输出）、无 stash、无未跟踪文件、无晚于 `27f280b` 的提交、无其它分支新增提交。「已停」是行为状态，非 ref 状态。
- **U-3 阶段 2 的实际推进程度无法核实。** 无阶段 2 产物文件、无相关提交；仅能看到派发记录（未提交的 history.md 片段）与 worker roster 中的 `Prd019`（running）。产出进度、是否内部收敛，均无一手证据。
- **U-4 status.md「主 agent 偏离记录」中的主观理由无法核实**（如「须立即离开 0018 工作区」）。可核实的部分仅为时间序事实：`git reflog` 中 `HEAD@{3}: checkout: moving from main to iteration/0019-…`（停在 `9ede9ea`，早于 `0a89a4d` 17:53:53）→ 分支创建确实早于阶段 1 产物提交与阶段 1 收口（`27f280b`）。「规范要求阶段 1 通过后创建」这一规范条款本身不在本快照核实范围（属角色/工作流文档，非 git 状态）。
- **U-5 阶段 1「已验证」列的自述状态无对应产物可双向核实。** `git ls-files docs/iterations/0019-… | grep -c "verify-\|progress"` = 0 → 0019 目录内无验证产物；「未验证」是缺失状态，只能核实到缺失，无法核实到验证过程未发生。

---

## 附：本次观测的命令清单（全部只读）

`git status --porcelain=v1 -b`、`--untracked-files=all`、`git rev-parse HEAD`、`git branch -a -v`、`git worktree list --porcelain`、`git worktree prune --dry-run -v`、`git stash list`、`git rev-parse --verify refs/stash`、`git for-each-ref --sort=-committerdate`、`git log --all`、`git log --oneline main..<ref>`、`git log --oneline -- <path>`、`git log -1 --format=%h -- <path>`、`git show --stat <commit>`、`git show <ref>:<path>`、`git ls-files`、`git ls-tree -r --name-only`、`git diff --stat A B -- <path>`、`git diff HEAD -- <path>`、`git diff --quiet HEAD -- <path>`、`git merge-base`、`git merge-base --is-ancestor`、`git reflog --date=iso`、`wc -l`、`sed -n`、`grep -n`、`find`、`ls -la /tmp/pb-0017-residual/`。
未执行：任何 `commit` / `merge` / `push` / `branch -d|-D` / `stash` 写入 / `worktree add|remove` / `checkout`。
