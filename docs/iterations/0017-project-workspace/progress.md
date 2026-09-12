# progress.md — 0017-project-workspace（进度观测快照）

**观测时刻**: 2026-09-12 17:08–17:11 +0800
**观测对象**: 迭代分支 `iteration/0017-project-workspace`（HEAD `0d726f2`）
**观测方式**: 只读 git 命令 + 产物文件存在性核对；**不采信** status.md / 任何角色报告的自我声明
**观测角色**: progress-observer（独立观测，不做质量判断、不做调度决策）

> 合并目标 = 迭代分支（非 main）；解锁判据 = 合并进迭代分支。
> 本次为整体覆盖写入（上一版 progress.md 提交于 `fc76fcd`，其内容不予保留；历史以 git commit history 为准）。
> 上一版快照的基线为 HEAD `a9fef01`（2/4 合并、pr-002 在跑）；本版基线为 HEAD `0d726f2`（3/4 合并、pr-004 在跑）。

---

## 1. 阶段完成状态

核实对象为产物文件的真实存在性，不照抄 status.md 勾选。

| # | 阶段 | status.md 声称 | 核实结果 | 依据 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅（demand.md v1.1.0，P-1~P-11 全部经用户裁决） | **产物存在，与声称一致** | `docs/iterations/0017-project-workspace/demand.md` 存在（395 行，提交于 `2af9f3d`）；`demand.md:5` = `**本版：v1.1.0（第二轮收敛，**已收敛**；P-1~P-11 已由用户裁决全部落定；model_inferred 归零；可进入阶段 2）**`；`clarifications/round-1.md`、`round-2.md` 存在 |
| 2 | 功能规格 | ✅（prd.md + 10 张卡；MI-01~MI-08 经用户裁决） | **产物存在，数量与声称一致** | `prd.md` 存在（`prd.md:3` `**版本**: 0.1.0`）；`ls prd/` = **10** 个文件（F01…F10 连续无缺）；`clarifications/prd-round-1.md`、`prd-round-2.md` 存在 |
| 3 | 技术架构 | ✅（architecture.md；L1 决策 0 条；T-01~T-15 全填；D-01~D-04 由主 agent 裁定） | **产物存在；产物自身状态行仍为「待确认」→ 见 §5 第 1 条** | `architecture.md` 存在（669 行）；`architecture.md:5` 仍为 `**状态**：**待主 agent 确认 §10 的 4 条口径点**（L1 决策 0 条）`；`architecture.md:582` 小节名「### 10.3 待主 agent 转呈确认的口径点」；`architecture.md:669` 结论行仍写「**待主 agent 确认 §10.3 的 4 条口径点**」；`git log -- architecture.md` 仅 `2af9f3d` 一次提交（未被后续回填） |
| 4 | PR 规划 | ✅ / 已验证 ✅（4 份 PR 文件；Gate 独立验证 PASS） | **PR 文件数量与声称一致；验证报告文件存在；报告结论不可由 git 核实（见 §6）** | `ls prs/` = 7 个文件，其中 4 份为 PR 卡（pr-001/002/003/004）+ 3 份 tasks；`clarifications/verify-gate-stage4-20260912-160841.md` 存在（存在性可核实，内容结论未采信） |
| 5 | PR 实现 | ⏸（3/4 已合并：pr-001、pr-003、pr-002；pr-004 执行中） | **3/4 已合并与 git 一手记录一致；pr-004「执行中」仅有"现场已建"一手证据，进展不可核实 → 见 §5 第 3 条** | `git log --merges --oneline main..iteration/0017-project-workspace` 输出恰 3 条：`9e1f4d4`(pr-001)、`a9fef01`(pr-003)、`0d726f2`(pr-002)，父提交逐一核实（§3）；`git worktree list` 显示 `.pb-agents/worktrees/pr-004` 挂 `feat/pr-004` @ `0d726f2` |
| 6 | 独立验证 | — / ⏸（Gate 已验证；阶段 5 全部合并后需再跑一轮最终验证） | **无阶段 6 产物，与"未开展"一致** | `ls docs/iterations/0017-project-workspace/` 无 stage6 类文件；`clarifications/` 下 4 份 verify 报告分别为 `verify-gate-stage4-…`、`verify-pr-001-…`、`verify-pr-002-…`、`verify-pr-003-…`，**无阶段 6 最终验证报告** |

**阶段产物存在性一览（`ls` + git 全量核对）**：`demand.md`、`prd.md`、`prd/`(10)、`architecture.md`、`prs/`(7)、`clarifications/`(9)、`status.md`、`history.md`、`progress.md` 均存在；阶段 1~4 产物全部提交于 `2af9f3d`（`git show --stat 2af9f3d` = 25 files, 2821 insertions）。

---

## 2. PR 依赖核实

对 `prs/*.md` 的 `## depends_on` 字段逐条核实（读取 PR 文件原文 + `git merge-base --is-ancestor` + `git rev-list --parents`）。

| PR | depends_on 声明（文件原文） | 实际合并状态 | 核实依据 |
|---|---|---|---|
| pr-001-project-context-injection.md | `（无）` | 不适用（无依赖）；**自身已合并** | `pr-001-…md` 的 `## depends_on` 段仅一行 `（无）`；`git rev-list --parents -n 1 9e1f4d4` = `9e1f4d4… b3f5a82… 2e9a950…`（合并提交，第二父 = pr-001 特性提交）；`git merge-base --is-ancestor 2e9a950 iteration/0017-project-workspace` 退出码 0 |
| pr-002-project-data-and-http.md | `pr-001-project-context-injection.md` | **依赖已满足（已合并进迭代分支）；自身已合并** | 同上：`2e9a950` 为迭代分支祖先；`git rev-list --parents -n 1 0d726f2` = `0d726f2… 8d8f0c7… f97cff3…`（第二父 = pr-002 特性提交）；`git merge-base --is-ancestor f97cff3 iteration/…` 退出码 0 |
| pr-003-project-layer-ui.md | `（无）` | 不适用（无依赖）；**自身已合并** | `pr-003-…md` 的 `## depends_on` 段仅一行 `（无）`（另有"与 pr-002 互不构成测试失败前提"的说明，非依赖）；`git rev-list --parents -n 1 a9fef01` = `a9fef01… 9e1f4d4… 40151ff…`；`git merge-base --is-ancestor 40151ff iteration/…` 退出码 0 |
| pr-004-project-workspace-acceptance.md | `pr-001-project-context-injection.md`、`pr-002-project-data-and-http.md`、`pr-003-project-layer-ui.md`（三条，各附理由段） | **依赖 3/3 全部满足（三份产物均已在迭代分支上）** | `git merge-base --is-ancestor` 对 `2e9a950` / `f97cff3` / `40151ff` 三次调用均退出码 0；三个合并提交 `9e1f4d4` / `0d726f2` / `a9fef01` 均在 `iteration/0017-project-workspace` 的 first-parent 链上（`git log --first-parent --oneline`） |

**结论**：依赖图状态 = `pr-001 ✅`、`pr-002 ✅`、`pr-003 ✅`、`pr-004 已解锁（依赖 3/3 满足）`。**无幽灵依赖**：每条被声明为依赖的 PR 都能在 git 找到真实合并 commit（第二父 = 对应特性提交），且对应特性提交均为迭代分支祖先。

---

## 3. PR 实现状态核实

独立于 status.md 的"PR 实现子状态"表，从 ref / worktree / commit 重新核实。

| PR | worktree 是否存在 | 分支 | HEAD 相对依赖基线的位置 | 是否已合并 | 核实依据 |
|---|---|---|---|---|---|
| pr-001 | **不存在** | `feat/pr-001` 不存在 | 特性提交 `2e9a950`，父提交 = `2af9f3d`（阶段 1~4 文档提交） | **已合并**：`9e1f4d4` | `git worktree list` 仅 2 项（根 + pr-004）；`git show-ref` 仅 4 个 ref（`feat/pr-004`、`iteration/…`、`main`、`origin/main`）；`git rev-list --parents -n 1 2e9a950` |
| pr-002 | **不存在**（已清理） | `feat/pr-002` 不存在 | 特性提交 `f97cff3`，父提交 = **`a9fef01`**（即派发时迭代分支 HEAD，含 pr-001 + pr-003） | **已合并**：`0d726f2` | 同上 ref/worktree 枚举；`git rev-list --parents -n 1 f97cff3`；`git rev-list --parents -n 1 0d726f2` |
| pr-003 | **不存在** | `feat/pr-003` 不存在 | 特性提交 `40151ff`，父提交 = `2af9f3d` | **已合并**：`a9fef01` | 同上 ref/worktree 枚举；`git rev-list --parents -n 1 40151ff` |
| pr-004 | **存在**：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/pr-004` | `feat/pr-004` = `0d726f2` | **与依赖基线同点**：`git rev-parse feat/pr-004` = `git rev-parse iteration/0017-project-workspace` = `0d726f2…`；领先基线 **0 个 commit**（`git log --oneline 0d726f2..HEAD` 空） | **未合并**（无 pr-004 合并 commit） | `git worktree list`；`git reflog show feat/pr-004` = `0d726f2 feat/pr-004@{0}: branch: Created from iteration/0017-project-workspace`；worktree mtime = `2026-09-12 17:06:25` |

**pr-004 三次采样（同点不可观测进展）**：

| 采样时刻 | HEAD | 工作树 | `oamp/test/project-workspace.test.js` | 距派发 |
|---|---|---|---|---|
| 17:08:09 | `0d726f2` | clean（`git status --porcelain` 无输出，0 行） | 不存在 | ≈ 1.7 分钟 |
| 17:09:53 | `0d726f2` | clean（0 行） | 不存在 | ≈ 3.5 分钟 |
| 17:11（本节复核） | `0d726f2` | clean（0 行） | 不存在 | ≈ 5 分钟 |

**补充事实（非不一致，记录以备核对）**：

- 三个特性提交的父提交可核实：`2e9a950` 与 `40151ff` 的父**同为 `2af9f3d`**（互不包含，两条独立分支）；`f97cff3` 的父为 `a9fef01`（派发时的迭代分支 HEAD）。三次派发均符合 `workflow-pb.md:277` 的 `git worktree add <path> -b <pr分支名> iteration/{迭代ID}`（base = 迭代分支，且该基点已包含各自声明的依赖）。
- 迭代分支 reflog（`git reflog show --date=iso`）完整可读：`…@{7}: branch: Created from main` → `2af9f3d` → `b3f5a82` → `9e1f4d4 merge feat/pr-001` → `a9fef01 merge feat/pr-003` → `fc76fcd` → `8d8f0c7` → `0d726f2 merge feat/pr-002`。
- 三次 merge 的第一父依次为 `b3f5a82` → `9e1f4d4` → `8d8f0c7`，构成单一 first-parent 主链（`git log --first-parent`），**不存在** 未合并的旁支特性提交。
- 现存 worktree 仅 pr-004 一个，与 status.md 标注「pr-001/pr-002/pr-003 = (已清理)」一致。

---

## 4. 并发度分析（重点）

| 类别 | 数量 | PR 明细 | 依据 |
|---|---|---|---|
| 已合并（槛位已释放） | 3 | pr-001、pr-002、pr-003 | §3 的三次 merge commit（第二父 = 对应特性提交） |
| **可并发但闲置（依赖已满足、未派发/无现场）** | **0** | （无） | 见下方逐条论证 |
| 正常并发中（已派发、占用槛位） | 1 | pr-004 | `git worktree list` + `feat/pr-004` ref 存在，创建于 17:06:25 |
| 正常阻塞（依赖未满足） | 0 | （无） | 四个 PR 的依赖全部满足（§2） |

**「可并发但闲置 = 0」的逐条论证**（4 个 PR 全量枚举，不留白）：

1. pr-001：已合并（`9e1f4d4`），无需再派发。
2. pr-002：已合并（`0d726f2`），无需再派发。
3. pr-003：已合并（`a9fef01`），无需再派发。
4. pr-004：**已派发**——worktree 与分支均存在（`.pb-agents/worktrees/pr-004` / `refs/heads/feat/pr-004`），不构成"未派发"。

**解锁时延核实（"依赖满足后是否被立即派发"）**：pr-004 的三个依赖中最后满足者是 pr-002 —— `0d726f2` 的 commit 时间 = `2026-09-12 17:06:24 +0800`，pr-004 worktree 目录 mtime = `2026-09-12 17:06:25`（`stat -f '%Sm'`）⇒ 解锁到建现场约 **1 秒**，不存在"依赖已满足但迟迟未派发"的窗口。

**并发上限与槛位核对**（仅记录算术与规则一致性，不做调度判断）：

- status.md 声明：起始并发数 3、硬上限 5、累计槛位释放次数 3、当前有效上限 5、已派发总数 4。
- 一手可核实的部分：已合并 PR 数 = 3（§3 三次 merge）⇒ 与「累计槛位释放次数 3」相容；现存分支 `feat/pr-004` + 3 个已合并特性提交 ⇒ 与「已派发总数 4」相容。
- 算术：`硬上限 = 2×起始-1 = 5` ✅；`min(3 + 3×3, 5) = 5` ✅（与 status.md 工作区版本所写公式一致；**已提交版本** `fc76fcd` 写的是 `min(3 + 2×3, 5)`，该处修正仅存在于未提交的工作区，见 §5 第 2 条）。
- 实际执行中 PR 数 = 1，空置槛位 4 个。按 `workflow-pb.md:292`「没有已解锁且排队中的 PR 时，释放出的槛位保持空置，不触发任何派发」：本迭代已解锁 PR 只剩 pr-004（已在跑），**无可补位对象** ⇒ 空置不构成不一致，也**不构成"可并发但闲置"**。

**真实并发执行证据核对**（status.md 声明「本迭代存在真实并发分支：首波 pr-001 ∥ pr-003 同时执行」）：

- **拓扑证据（一手，支持该声明）**：`git rev-list --parents -n 1 2e9a950` = `2e9a950… 2af9f3d…`，`git rev-list --parents -n 1 40151ff` = `40151ff… 2af9f3d…` ⇒ 两条分支**同基点、互不包含**，均非对方的后代，排除"串行派生"。
- **时间戳证据（一手）**：`40151ff` commit 时间 `2026-09-12 16:19:28 +0800`、`2e9a950` 为 `16:21:41 +0800`，两者均早于第一次 merge（`9e1f4d4` / `a9fef01` 均 `16:35:51 +0800`）⇒ 在首个合并发生前，两条分支的提交已各自存在。
- **不可核实部分**：提交时间戳只能证明提交先后，**不能证明两个子 agent 曾真正并行运行**（同一 agent 先后写两个分支也会留下同样拓扑）。故「同时执行」一词在本报告中只成立为"两条并发分支同时开放"，不成立为"进程级并行"（见 §6 第 10 条）。

---

## 5. 发现的不一致

逐条列出，不做严重性判断。

1. **architecture.md 未回填 D-01~D-04 的裁定结论，与 status.md 声称的「D-01~D-04 由主 agent 裁定」不一致。**（上一版快照已记录，本次核实**仍存在、未被修复**）
   - 声称（status.md 阶段 3 行 + Gate 记录）：`D-01~D-04 由主 agent 裁定`。
   - 实际（一手文件证据）：`architecture.md:5` 仍为 `**状态**：**待主 agent 确认 §10 的 4 条口径点**`；`architecture.md:582` 小节名为「### 10.3 待主 agent 转呈确认的口径点」；`architecture.md:669` 结论行仍写「**待主 agent 确认 §10.3 的 4 条口径点**」；`git log --oneline -- architecture.md` 输出仅 `2af9f3d` 一条 ⇒ 自创建以来从未被修改。
   - 差异：裁定已落在 status.md / history.md，但未落回 architecture.md 的状态行与 §10.3。

2. **status.md 与 history.md 的当前内容仍处于未提交状态；其中"3/4 已合并 + pr-004 已派发"等全部声明在 git 中没有对应 commit。**（上一版快照已记录，本次核实**仍存在**）
   - `git status --porcelain`（根 worktree）= ` M docs/iterations/0017-project-workspace/history.md`、` M docs/iterations/0017-project-workspace/status.md`；`git diff --stat` = history.md +34 / status.md 17 insertions(+), 13 deletions(-)；另有本文件 `progress.md` 被本次观测覆盖写入（同属未提交）。
   - HEAD（`0d726f2`）中 status.md 的旧内容 vs 工作区内容：阶段 5 备注 `2/4 PR 已合并（pr-001、pr-003）；pr-002 执行中` → `3/4 PR 已合并（pr-001、pr-003、pr-002）；pr-004 执行中`；pr-002 行 `⏸ / feat/pr-002 / ⬜ / 占用` → `✅ / (已清理) / ✅ 0d726f2 / 已释放`；pr-004 行 `⬜ / (空) / 排队(依赖未满足)` → `⏸ / feat/pr-004 / ⬜ / 占用`；有效上限公式 `min(3 + 2×3, 5)` → `min(3 + 3×3, 5)`。
   - 差异：本次观测读到的状态声明的**唯一载体是工作区文件**；若以 HEAD 为准，声明与实际 git 状态（3/4 已合并）不符。

3. **status.md 声称 pr-004「执行中 / 占用」，git 侧只能证明"已建现场"，无法证明有进展。**
   - 可核实：`feat/pr-004` 分支存在、worktree `.pb-agents/worktrees/pr-004` 存在、创建于 `2026-09-12 17:06:25`（reflog + `stat -f %Sm`）。
   - 不可核实：领先依赖基线 **0 个 commit**、工作树 **clean（0 行 porcelain）**、PR 声明的唯一交付物 `oamp/test/project-workspace.test.js` **在 worktree 与主 worktree 中均不存在**；三次采样（17:08:09 / 17:09:53 / 17:11）结果完全相同。
   - 差异：声明的是进行时状态（"执行中"），一手记录只能证明"提交为空、工作区为空"；派发后约 5 分钟内未观察到任何可留痕产物。

4. **pr-004 派发缺少 workflow 规定的 `tasks` 产物；pr-001/pr-002/pr-003 均有。**
   - 规则（一手规范）：`workflow-pb.md:114`（阶段 5 产出物列）= `prs/pr-{NNN}-tasks.md`（该 PR 内部任务列表，供 dev 消费）；`workflow-pb.md:277`（派发流程）= 在子 agent 里依次完成「派发 planner 产出该 PR 的 `prs/pr-{NNN}-tasks.md`」→「派发 dev 实现」→「验收」→「merge」。
   - 实际：`ls docs/iterations/0017-project-workspace/prs/` = `pr-001-…-tasks.md`、`pr-001-….md`、`pr-002-…-tasks.md`、`pr-002-….md`、`pr-003-…-tasks.md`、`pr-003-….md`、`pr-004-….md` ⇒ **不存在 `pr-004-project-workspace-acceptance-tasks.md`**。
   - 差异：pr-004 已派发约 5 分钟，其 planner 产物在仓库中不可见。**同类缺口在上一版快照中针对 pr-002 记录过，该缺口已被 `fc76fcd` 补齐（现存在 `pr-002-…-tasks.md`）；本次缺口为 pr-004。**

5. **`git branch --merged` 会把 `feat/pr-004` 列为"已合并进迭代分支"，该输出不可读作"pr-004 已完成"。**
   - 一手输出：`git branch --merged iteration/0017-project-workspace` = `feat/pr-004`、`iteration/0017-project-workspace`、`main`。
   - 成因：`git rev-parse feat/pr-004` = `git rev-parse iteration/0017-project-workspace` = `0d726f2…`（分支刚从迭代分支创建、尚无自有 commit，指针同点 ⇒ 平凡地互为祖先），且**不存在** pr-004 的 merge commit（`git log --merges --oneline main..iteration/…` 恰 3 条，均属 pr-001/002/003）。
   - 差异：这是一条容易被误读的一手输出，故记录在此（非 status.md 声明错误）。

6. **status.md 的「已验证」列口径在阶段 6 行与其余行之间不自洽（仅记录事实）。**
   - 实际：阶段 1~3、5、6 行的「已验证」列均为 `⬜`/`⏸`；stage-6 备注写「Gate 已验证；阶段 5 全部合并后需再跑一轮最终验证」。而 `clarifications/verify-gate-stage4-20260912-160841.md` 的**存在**可核实（阶段 4 的独立验证报告），阶段 6 自身无任何产物（§1 第 6 行）。
   - 差异：备注中的"已验证"指向的是阶段 4 的 Gate 报告，与阶段 6 行本身的 `⏸` 标记并列出现，字面易被读成"阶段 6 已验证"。

7. **（已消解项）上一版快照记录的 pr-002 缺 `-tasks.md`、以及「2/4 已合并」声明，本次已不存在差异。**
   - pr-002 的 tasks 由 `fc76fcd` 补齐（`git show --stat fc76fcd` 含 `pr-002-project-data-and-http-tasks.md | 386 +`）；「3/4 已合并」经 §3 三次 merge 核实为真。记录在此仅为对照上一版，不构成新差异。

---

## 6. 无法核实项

以下状态无法通过 git 一手记录核实，如实列出，不给结论。

1. **各 PR 的验收结论（pr-001/pr-002/pr-003「PR 级验收 PASS」）**：结论载体为 `clarifications/verify-pr-001-20260912-163434.md`、`verify-pr-002-20260912-170519.md`、`verify-pr-003-20260912-162639.md`（三份文件的存在性可核实，其中 pr-002 的报告由 `8d8f0c7` 单独提交），但"PASS"属角色自我声明，本角色不采信；独立核实需重跑验证，超出只读状态核查范围。
2. **阶段 4「Gate 独立验证 PASS（fail 0 / partial 2 / 偏差 7）」的三个计数**：报告文件 `clarifications/verify-gate-stage4-20260912-160841.md` 存在，计数属报告内容，git 无对应记录（且该数值在未提交的 status.md 中已被删去，工作区版本只写「Gate 独立验证 PASS」）。
3. **「全量 251/251 测试全绿」**（status.md 更新日志出现两次）：运行时结论，git 无记录；本次观测未重跑测试（重跑属质量验证范畴，不在本角色职责内）。可核实的仅有 `oamp/test/*.test.js` 文件数 = 22（不含 pr-004 计划新增的 `project-workspace.test.js`）。
4. **pr-003「3 项 partial（服务端依赖面）须在 pr-002 落地后补验」的实际补验状态**：该待办的状态载体只有验证报告与 status.md，git 无记录；pr-002 已合并（`0d726f2`）使补验条件成立，但**是否已补验不可核实**。
5. **pr-004 的实际执行进展**：0 commit + clean worktree ⇒ 是否已在编辑文件、是否已跑测试、进行到哪个内部步骤，git 不可观测（三次采样一致，见 §3）。
6. **pr-004 的 tasks 文件是"尚未生成"还是"正在生成"**：仓库内不存在（§5 第 4 条），git 无法区分二者。
7. **pr-004 交付物是否会落在声明文件 `oamp/test/project-workspace.test.js`**：该文件在迭代分支与 pr-004 worktree 中均不存在；未来落点不可预核。
8. **demand.md「P-1~P-11 全部经用户裁决」、prd.md「MI-01~MI-08 全部经用户裁决」的用户交互本身**：只能核实文档内存在裁决落定记录（`demand.md:5` 状态行、`prd.md` 内 MI 引用、`clarifications/round-*.md`）与 status.md 的 Gate 记录，无法核实交互是否真实发生。
9. **槛位状态语义（`占用` / `已释放`）与「累计槛位释放次数 3」的记账**：属工作流内部记账字段，git 无对应 ref；「已释放」只能通过 worktree/branch 不存在间接旁证（pr-001/002/003 符合）。
10. **「首波 pr-001 ∥ pr-003 同时执行」中的"同时"**：可核实的是两条分支同基点、互不包含、两个特性提交均早于首个 merge（§4）；**不可核实**两个子 agent 是否真的并行运行（拓扑与时间戳均不能排除串行交替写入）。
11. **三次 merge 的操作先后**：`9e1f4d4` 与 `a9fef01` 的 reflog 时间戳同为 `2026-09-12 16:35:51 +0800`，不足以判定先后；可核实的仅是父子关系（`9e1f4d4` 是 `a9fef01` 的第一父）。
12. **pr-002 合并（`0d726f2`）与 pr-004 派发（17:06:25）之间是否存在过调度延迟或人工干预**：一手记录只能给出 1 秒的时延差（§4），不反映决策过程。

---

## 附：本次使用的核实命令清单（可复现）

```
git rev-parse --abbrev-ref HEAD / HEAD / feat/pr-004 / iteration/0017-project-workspace
git branch -a -v ; git show-ref ; git branch --merged <iter> ; git branch --no-merged <iter>
git worktree list                                        # 根 worktree + .pb-agents/worktrees/pr-004
git log --first-parent --oneline <iter> ; git log --oneline --graph -25 <iter>
git log --merges --oneline main..iteration/0017-project-workspace     # 恰 3 条
git log --all --oneline --grep='pr-0'
git rev-list --parents -n 1 9e1f4d4 / a9fef01 / 0d726f2 / 2e9a950 / 40151ff / f97cff3
git merge-base --is-ancestor <commit> iteration/0017-project-workspace   # 2e9a950 / 40151ff / f97cff3 / b3f5a82 / 8d8f0c7 / fc76fcd / 2af9f3d
git merge-base main iteration/0017-project-workspace     # 1c37e80
git reflog show --date=iso feat/pr-004 ; git reflog show --date=iso iteration/0017-project-workspace
git show -s --format='%H%n parents=%P%n subject=%s%n date=%ci' <commit>
git show --stat --oneline 2af9f3d / b3f5a82 / fc76fcd / 8d8f0c7
git log --oneline -- docs/iterations/0017-project-workspace/architecture.md / progress.md
git status --short ; git status --porcelain=v1 ; git diff --stat / git diff <status.md>
git -C .pb-agents/worktrees/pr-004 status --porcelain ; git -C ... rev-parse HEAD ; git -C ... log --oneline -3
stat -f '%Sm %N' .pb-agents/worktrees/pr-004
ls docs/iterations/0017-project-workspace/ ; ls .../prs/ ; ls .../prd/ ; ls .../clarifications/
ls oamp/test/*.test.js | wc -l
```

（全部为只读命令；本次观测未执行任何写入性 git 命令 —— 无 `add`/`commit`/`merge`/`switch`/`worktree add|remove`/`branch -d`/`rm`；未修改 status.md / prs/*.md / prd/*.md / architecture.md / 任何代码与测试；唯一写入目标为本文件。）
