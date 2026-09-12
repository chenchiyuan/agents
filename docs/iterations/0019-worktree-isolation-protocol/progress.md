# 进度快照（独立观测）

**迭代**: 0019-worktree-isolation-protocol
**观测者**: progress-observer（独立角色；不采信 `status.md` 或任何角色自我声明）
**观测时刻**: 2026-09-12 19:54:21 +0800（工作区状态分两次取样：19:53:45 与 19:54:21；期间出现第二个未提交文件，见 F-7）
**观测基线**: 迭代分支 `iteration/0019-worktree-isolation-protocol` @ `1ca983d4c478f512a06378006d423ced47f34750`（= 工作区 HEAD）；主工作区工作树在同一时刻存在 2 处未提交改动（`status.md`、`prs/pr-001-tasks.md`），详见 §5 F-7
**核实手段**: 只读 git 命令（`status` / `log` / `show` / `ls-tree` / `ls-files` / `diff` / `rev-list --parents` / `rev-list --count` / `merge-base`（含 `--is-ancestor`）/ `for-each-ref` / `reflog` / `worktree list` / `stash list` / `rev-parse`）+ 文件存在性与内容读取
**本次未执行**: 任何写入性 git 命令（无 `commit` / `merge` / `rebase` / `checkout` / `branch -d` / `stash` / `worktree add|remove`）；唯一写入目标为本文件
**快照性质**: 整体覆盖写入，不保留历史版本（历史归 git commit history）；本次为第二次观测（首次基线 `27f280b`）

---

## 1. 阶段完成状态

### 1.0 待核实声明清单（来源：`docs/iterations/0019-worktree-isolation-protocol/status.md` 工作区版）

| # | status.md 声称 | 声称标记 |
|---|---|---|
| S-1 | 阶段 1（需求收敛）完成；demand.md v1.3.0 | ✅ |
| S-2 | 阶段 2（功能规格）完成；prd.md v0.2.0、15 张卡 | ✅ |
| S-3 | 阶段 3（技术架构）完成；备注写 `architecture.md v1.1.0` | ✅ |
| S-4 | 阶段 4（PR 规划）= ⏸（进行中）；已验证 = ⬜ | ⏸ / ⬜ |
| S-5 | 阶段 5（PR 实现）= ⬜ | ⬜ |
| S-6 | 阶段 6（独立验证）= —（按需触发） | — |
| S-7 | 抬头：迭代分支 base = main @ `9ede9ea`（含 0017 全部产出） | 抬头 |
| S-8 | 抬头：**当前阶段 = PR 规划（阶段 4）** | 抬头 |
| S-9 | 抬头：工作流版本 = workflow-pb v0.8.0 | 抬头 |
| S-10 | PR 子状态表：pr-002 = ✅ / worktree 分支 `(已清理)` / 已合并 `1ca983d` / 槛位「已释放」 | 表格 |
| S-11 | 并发配置：起始 3 / 硬上限 5 / 当前有效上限 5 / 累计释放 1 / 已派发 2 | 区块 |
| S-12 | 更新日志：阶段 5 首波并发 → pr-002 已合并（`1ca983d`）、pr-001 FAIL-1partial、dev001 跨工作区写入事故「已自行修复、主工作区零损失」 | 更新日志 |
| S-13 | 阶段 4 备注：输入 = `architecture.md v1.1.0` | 表格备注 |

### 1.1 逐条核实

**S-1（阶段 1 完成 / demand v1.3.0）→ 一致（产物层）**
- `git ls-tree -r --name-only iteration/0019-… -- docs/iterations/0019-…` 含 `demand.md`；引入提交 = `27f280b`（`git log --diff-filter=A --name-only`）。
- `docs/iterations/0019-worktree-isolation-protocol/demand.md:6` = `**版本**: v1.3.0（**第四轮归零收口版：model_inferred 归零，阶段 1 三项推进条件全部满足**）`。
- 「经用户裁决」「归零」属裁决行为声称 → §6 U-1。

**S-2（阶段 2 完成 / prd v0.2.0 / 15 卡）→ 一致**
- `prd.md:3` = `**版本**: 0.2.0（第二轮修订版：9 项 MI 经用户裁决全部按推荐…）`；引入提交 = `10318b9`。
- `prd/` 下被追踪文件 = `F01-session-workspace-form.md` … `F15-d2-registration-trace.md`，逐号连续，计数 **15**（`git ls-tree`）。

**S-3（阶段 3 完成）→ 阶段完成一致；备注版本号与产物不符（见 §5 F-4）**
- `architecture.md` 存在且被追踪，引入提交 = `dc9eb36`（提交信息自称「architecture.md v1.1.0 + 15 卡架构落地」）。
- 实测产物版本：`architecture.md:3` = `**版本**：1.2.2（… v1.2.1 = Gate 第一轮 4 项偏差闭合，v1.2.2 = Gate 第二轮复验偏差 D1~D6 闭合）`；该变更由 `15d5eaf`（「Gate 两轮返工与修正（architecture v1.2.2 + PR 引用同步 + 两份验证报告）」）带入。

**S-4（阶段 4 = ⏸ / 已验证 ⬜）→ 与实测不符（见 §5 F-2）**
- 阶段 4 产物已全部落盘并提交：`prs/pr-001-workflow-pb-workspace-isolation-protocol.md`、`prs/pr-002-cross-iteration-d2-registration.md`（引入提交 `7e000d6`，「阶段 4 收口（2 个 PR + architecture v1.2.0 台账修正）」）；`prs/pr-001-tasks.md`、`prs/pr-002-tasks.md`（引入提交 `81a7aed`）。
- 阶段 4 的独立验证产物存在且声称 PASS：`clarifications/verify-gate-stage4-r3-20260912-193332.md`（引入提交 `08d7ce1`，提交信息「Gate r3 验证报告…」）；status.md 自称 r3 = PASS（6/6）。r1/r2 报告亦被追踪（`15d5eaf`）。

**S-5（阶段 5 = ⬜）→ 与实测不符（见 §5 F-3）**
- 阶段 5 的执行证据在 git 中可见：pr-002 worktree 分支曾创建（提交 `d038e3c`）并已合并（`1ca983d`）；pr-001 的 PR worktree 当前存在（`.pb-agents/worktrees/pr-001`，HEAD `c034dab`）；两份 PR 级验收报告被追踪（`c9c4927`）。

**S-6（阶段 6 = —）→ 一致**
- `git ls-tree -r --name-only` 的 0019 目录清单内无任何阶段 6 产物（无 `verify-stage6-*`、无 stage6 报告）；与「未到、按需触发」不矛盾。

**S-7（base = main @ 9ede9ea）→ 一致**
- `git merge-base main iteration/0019-…` = `9ede9ead2a5bdcfe79c20e0b3bb7b3fdcb3aebeb`；`git log -1 main` = `9ede9ea`；`git merge-base --is-ancestor iteration/0019-… main` → **否**（迭代分支尚未合并进 main）。

**S-8（当前阶段 = 阶段 4）→ 与同文件其它区块不符（见 §5 F-1）**

**S-9（工作流 = workflow-pb v0.8.0）→ 一致**
- `roles/workflow-pb/workflow-pb.md:25` = `**版本**: 0.8.0`；`.claude/skills/workflow-pb/SKILL.md:30` = `**版本**: 1.11.0（对应规范 workflow-pb v0.8.0）`。
- 而 pr-001 分支（未合并）内为 `0.9.0` / `1.12.0`（`c034dab` 改动面）⇒ 迭代分支上写 v0.8.0 与「pr-001 未合并」相符。

**S-10（pr-002 ✅ / 已合并 1ca983d / worktree 已清理 / 槛位已释放）→ 一致**（逐项证据见 §3.2）

**S-11（并发配置数值）→ 一致（含一处台账滞后，见 §5 F-7）**
- 公式核对：规范 `roles/workflow-pb/workflow-pb.md:289-291` = 起始并发数 3（默认）、硬上限 `2×起始-1` = 5、爬升公式 `min(起始 + 累计释放次数 × 起始, 硬上限)`；代入 `min(3 + 1×3, 5)` = **5**，与工作区版 status.md 一致。
- 「已派发总数 2」「累计释放 1」与实测相符：pr-001 worktree 存在（在飞）；pr-002 曾有 worktree（见 §3.2）且已合并一次（`1ca983d`），释放次数 1。
- 注意：迭代分支 HEAD 内的 `status.md` 仍为合并前数值（有效上限 3 / 释放 0），见 F-7。

**S-12（事故处置「已自行修复、主工作区零损失」）→ 可核实部分一致**
- history.md 自述修复动作 = 把 4 个文件对齐后还原主工作区；可核实证据：`git diff --stat 81a7aed 15d5eaf -- roles/workflow-pb/workflow-pb.md .claude/skills/workflow-pb/SKILL.md roles/workflow-pb/data/workflow-pb-changelog.md .claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` → **空输出**（两提交对这 4 文件内容一致）。
- 主工作区当前无该事故残留：`git diff HEAD -- roles .claude tools oamp` 干净；未提交改动仅落在 0019 目录（见 F-7）。
- 修复过程本身无 git 记录 → §6 U-6。

**S-13（阶段 4 备注「输入 = architecture.md v1.1.0」）→ 与产物不符（同 F-4）**

### 1.2 阶段产物清单（被追踪文件 + 引入提交）

`git log --diff-filter=A --name-only`（挂 `-- docs/iterations/0019-…/`）逐提交取值：

| 引入提交 | 提交信息（截断） | 新增文件（0019 目录内） |
|---|---|---|
| `0a89a4d` | 迭代启动脚手架 | `status.md`、`history.md`、`clarifications/incident-20260912.md` |
| `c3b5152` | 阶段 1 输入与澄清 | `clarifications/round-1.md`、`demand-round-1-proposals.md`、`demand-round-2-proposals.md`、`retro-0017-phase1.md` |
| `27f280b` | 阶段 1 收口 | `demand.md`、`clarifications/round-3.md`、`round-4.md`、`demand-round-3-proposals.md` |
| `d1d9460` | 阶段 2 派发记录 + 首次观测 | `progress.md`（首次快照） |
| `10318b9` | 阶段 2 收口 | `prd.md` + `prd/F01~F15`（15 卡）+ `clarifications/prd-round-1.md`、`prd-round-2.md` |
| `dc9eb36` | 阶段 3 收口 | `architecture.md` |
| `7e000d6` | 阶段 4 收口 | `prs/pr-001-workflow-pb-workspace-isolation-protocol.md`、`prs/pr-002-cross-iteration-d2-registration.md` |
| `15d5eaf` | Gate 两轮返工与修正 | `clarifications/verify-gate-stage4-20260912-191730.md`、`verify-gate-stage4-r2-20260912-192704.md` |
| `81a7aed` | 阶段 5 首波 planner 产出 | `prs/pr-001-tasks.md`、`prs/pr-002-tasks.md` |
| `08d7ce1` | Gate r3 验证报告 | `clarifications/verify-gate-stage4-r3-20260912-193332.md` |
| `c9c4927` | PR 级验收报告 | `clarifications/verify-pr-001-20260912-195010.md`、`verify-pr-002-20260912-194959.md` |

- 0019 目录被追踪文件总数 = **38**（`git ls-tree -r` 计数）；本文件（`progress.md`）为覆盖写入，其版本历史由 git 承载。

---

## 2. PR 依赖核实

### 2.1 `depends_on` 声明（逐文件取值）

| PR 文件 | 声明位置 | 声明内容 |
|---|---|---|
| `prs/pr-001-workflow-pb-workspace-isolation-protocol.md` | `:83` `## depends_on`，`:85` | **（无）** |
| `prs/pr-002-cross-iteration-d2-registration.md` | `:43` `## depends_on`，`:45` | **（无）** |

（`prs/` 目录实测恰 4 个文件：2 个 PR 文件 + 2 个 tasks 文件；无第三个 PR 文件。）

### 2.2 核实结论

- **跨 PR 依赖声明集合 = 空集** ⇒ 不存在「某 PR 声称依赖另一 PR」的条目，故**无任何依赖声明需要到 `git log` 中核对合并记录**。
- 与 status.md 抬头注「两者 `depends_on` 均为空 ⇒ 首波即可并发（预期并发度 = 2）」一致。
- 独立性旁证（支持「无依赖」的实质判断）：两 PR 的实际变更文件集合**交集为空** —
  - `git show --stat c034dab` → 6 文件，全部位于 `roles/workflow-pb/**` 与 `.claude/skills/workflow-pb/**`；
  - `git show --stat d038e3c` → 2 文件，`docs/iterations/0017-project-workspace/status.md`、`docs/iterations/0019-worktree-isolation-protocol/status.md`；
  - 两集合无共同路径。

### 2.3 交叉核对（PR 内任务级依赖，非 PR 级 `depends_on`）

- `prs/pr-001-tasks.md:50-52` 声明拓扑序 `T1 → {T2,T3,T5,T6} → T4 → T7 → T8 → T9`，各任务「前置依赖」行逐条读为：T1 无、T2/T3/T5/T6 ← T1、T4 ← T2、T7 ← T1~T6、T8 ← T1/T2/T5、T9 ← T1~T8 ⇒ **每条边均由小编号指向大编号，无回边，声明与 DAG 自洽**。
- `prs/pr-002-tasks.md:50` 声明拓扑序 `{T-01,T-02,T-03} → {T-04,T-05} → T-06`，前置依赖行读为：T-01/T-02/T-03 无、T-04 ← T-01/T-02/T-03、T-05 ← T-01/T-02、T-06 ← T-01/T-02/T-04/T-05 ⇒ 同为前向边，无环。
- 两份 tasks 文件的依赖均为 **PR 内**任务顺序，不构成跨 PR 依赖边，也不改变 §4 的并发判定。

---

## 3. PR 实现状态核实

### 3.1 pr-001（`pr-001-workflow-pb-workspace-isolation-protocol.md`）

| 核实项 | 命令 | 实测 | 与声称一致？ |
|---|---|---|---|
| worktree 存在 | `git worktree list --porcelain` | `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/pr-001`（注册于 `.git/worktrees/pr-001`） | ✅ 一致（status.md 写「占用」） |
| 分支 | 同上 | `feat/0019-pr-001-workflow-pb-protocol` @ `c034dab` | ✅ 一致 |
| 落点惯例 | `git rev-parse --show-toplevel` | `.pb-agents/worktrees/pr-001`（**旧惯例**，非 pr-001 自身引入的 `{迭代编号}-pr-{NNN}-{slug}` 形态） | 事实记录（本迭代自身不迁移，F14 验收 6；见 §5 尾注） |
| HEAD 相对依赖基线 | `git merge-base iteration/0019-… feat/0019-pr-001-…` → `15d5eaf`；`git rev-list --count HEAD..iteration/…` | base = `15d5eaf`；HEAD = `c034dab`；**领先基线 1 个提交、落后迭代分支 5 个提交** | ✅ 有实质进展 |
| 工作区干净度 | `git -C .pb-agents/worktrees/pr-001 status --porcelain=v1 -uall` | 空（无未提交、无未跟踪） | ✅ |
| 改动规模 | `git diff --stat 15d5eaf c034dab` | 6 files changed, **+243 / −59**（SKILL.md、skill-optimization-v1.12.0.md（新建）、skills/memory.md、workflow-pb-changelog.md、roles/memory.md、workflow-pb.md） | ✅ 与 PR 文件「文件范围」6 文件逐条对应 |
| 是否已合并 | `git branch -a --contains c034dab` | 仅 `feat/0019-pr-001-workflow-pb-protocol` | ✅ **未合并**（status.md 写 ⬜） |
| 迭代分支是否含其改动 | `git diff --stat 1ca983d feat/0019-pr-001-…`；`grep '^\*\*版本\*\*' roles/workflow-pb/workflow-pb.md` | 迭代分支对 6 个文件无 pr-001 内容；迭代分支上规范版本仍 `0.8.0`、SKILL `1.11.0` | ✅ 未合并 |
| 无第二处承载 | `git branch -a --contains c034dab` | 恰 1 条 ref | ✅ 工作区纪律成立 |

**观测时刻状态**：`c034dab` 提交时间 2026-09-12 19:46:01；此后 worktree 无新提交、无未提交改动；同期间迭代分支前进 5 个提交（`81a7aed` → `08d7ce1` → `c9c4927` → `d038e3c`（PR 侧）→ `1ca983d`）。

### 3.2 pr-002（`pr-002-cross-iteration-d2-registration.md`）

| 核实项 | 命令 | 实测 | 与声称一致？ |
|---|---|---|---|
| worktree 已清理 | `git worktree list --porcelain`；`ls -1 .git/worktrees` | 仅主工作区 + pr-001 worktree；`.git/worktrees` 下仅 `pr-001`；磁盘 `.pb-agents/worktrees/` 仅 `pr-001` | ✅ 一致（status.md 写「(已清理)」） |
| 分支已清理 | `git branch -a -v`；`git reflog show feat/0019-pr-002-d2-registration` | refs 共 5 条，无 pr-002 分支；reflog 查询 = `fatal: unknown revision`（分支已删除） | ✅ 一致 |
| PR 源提交 | `git rev-list --parents -n1 d038e3c` | `d038e3c` ← 父 `15d5eaf`（**未重写、未 rebase**，见 F-5） | 事实记录 |
| 是否已合并 | `git rev-list --parents -n1 1ca983d`；`git branch -a --contains d038e3c` | `1ca983d` 双父 = `c9c4927` + `d038e3c`；`d038e3c` 现仅由 `iteration/0019-…` 持有 | ✅ **已合并**（status.md 写 ✅ `1ca983d`） |
| 合并动作证据 | `git reflog show iteration/0019-… --date=iso` | `1ca983d …{19:52:32}: merge feat/0019-pr-002-d2-registration: Merge made by the 'ort' strategy.` | ✅ 合并发生在**主工作区**（符合「合并固定在仓库主工作区」） |
| 改动规模 | `git show --stat d038e3c` | 2 files changed, +8 / −2（两个 `status.md`） | ✅ 与 PR 文件「文件范围」一致 |
| ADR-4 实质（主线版为基 + 仅重放 D-2 段） | `git diff --numstat c9c4927 1ca983d -- …/0019-…/status.md` | 4 / 1，且 diff 逐行落在 §待确认项 D-2 段（`:51-54`） | ✅ 成立 |
| 0017 侧落点已改写 | 工作区 `docs/iterations/0017-project-workspace/status.md:44-49` | §下一迭代候选 第 1 条 = `**0017/D-2（跨迭代承接项）**` 三段式（缺陷描述 / 承接方 / 引用链）+ 编号口径行 | ✅ 一致 |
| 0019 侧落点已改写 | 工作区 `status.md` §待确认项 | 同构四行（`0017/D-2` 标签 + 承接方 + 引用链 + 编号口径行），段外未改（`c9c4927` ↔ `1ca983d` 差异仅此段） | ✅ 一致 |
| 0018 侧外部证据 | `git show 89182b7:docs/iterations/0018-chat-agent-subagent-protocol/status.md \| grep -n C-3` | `:34` C-3 行含「用户裁决由 **0019 完成后起的单独小迭代承接**，三处 status（0017 / 0018 / 0019）互相引用留痕」；`89182b7` stat = 仅该文件 2 行改动 | ✅ 证据存在（本 PR 零写入该路径） |
| PR 分支提交后是否被再次触碰 | `git branch -a --contains d038e3c` | 仅迭代分支 | ✅ |

### 3.3 ref 层事实表（观测时刻）

| ref | HEAD | 提交时间 | 相对 main | 合并状态 |
|---|---|---|---|---|
| `iteration/0019-worktree-isolation-protocol` | `1ca983d` | 2026-09-12 19:52:32 | ahead 8（`0a89a4d`…`c9c4927` + 合并带入 `d038e3c`） | 未合并（`--is-ancestor` → 否） |
| `feat/0019-pr-001-workflow-pb-protocol` | `c034dab` | 2026-09-12 19:46:01 | 未合并；相对迭代分支落后 5 | 未合并 |
| `iteration/0018-chat-agent-subagent-protocol` | `89182b7` | 2026-09-12 18:18:56 | 未合并 | 暂停中，无新提交 |
| `main` | `9ede9ea` | 2026-09-12 17:46:02 | — | — |
| `origin/main` | `1c37e80` | 2026-09-12 14:59:04 | 本地 `main` 领先 16 | 未推送 |

附：`git stash list` 空、`git rev-parse --verify refs/stash` = `fatal: Needed a single revision`（无 stash ref，与首次观测同）；002 号 worktree 元数据无残留。

---

## 4. 并发度分析

**PR 集合与派发事实（全部来自 ref / worktree / 提交层）**

| 项 | 数值 | 证据 |
|---|---|---|
| PR 文件总数 | **2** | `git ls-tree` / `prs/` 目录清单 |
| PR 级 `depends_on` 非空者 | **0** | §2.1 两处声明均为「（无）」 |
| 已派发（有 worktree/分支记录） | **2** | pr-001：worktree 现存；pr-002：`d038e3c` 提交 + history 记录其 worktree 路径（现目录/分支均已不存在） |
| 已合并 | **1**（pr-002） | `1ca983d` |
| 在飞（未合并且已派发） | **1**（pr-001） | worktree `c034dab`、未合并 |
| **满足依赖但未被派发的闲置 PR 数** | **0** | PR 集合已穷尽（仅 2 个），且两者均已派发；不存在第三个 PR 文件 |
| 当前有效上限（声称） | 5 | 工作区版 `status.md`；规范公式 `min(3+1×3,5)`（`workflow-pb.md:291`）复算一致 |
| 空置槛位 | **4**（= 5 − 在飞 1） | 规范 `workflow-pb.md:292`：无「已解锁且排队中」的 PR 时槛位**保持空置、不触发派发** |

**结论（不含调度建议，仅事实）**

1. **不存在「依赖已满足但未被派发」的闲置 PR**：全部 PR（2 个）均已被派发过，且没有第三个 PR 可供派发。空置的 4 个槛位对应「无待派 PR」，而非「有 PR 被搁置」。
2. **实际在飞并发度 = 1**（pr-001），已回落到首波 2 中的 1 个；pr-002 已合并退出（`1ca983d`）。
3. **pr-001 相对迭代分支已落后 5 个提交**（`git rev-list --count HEAD..iteration/…` = 5），其分支基点 `15d5eaf` 之后的迭代分支新增：`81a7aed`（首波 planner 产出 + 派发记录）、`08d7ce1`（Gate r3 + 事故登记）、`c9c4927`（两份 PR 级验收报告 + merge 决策）、`d038e3c`（pr-002 实现）、`1ca983d`（pr-002 合并）。
4. **pr-001 的判定返工载体不在其 worktree 内**：观测时刻 `c034dab` 之后该 worktree 无新提交、工作区干净；同一时刻主工作区出现未提交的 `prs/pr-001-tasks.md` 修订（r2，15+/14−，内容 = 判据口径修正 + 计数口径定版 + 零改动清单范围排除），见 F-7 与 §6 U-3。
5. **无第二 worktree、无第二分支承载 pr-001 的改动**：`git branch -a --contains c034dab` 恰 1 条 ⇒ 工作区纪律（PR 改动只存在于自己的 worktree 分支）在 ref 层成立。

---

## 5. 发现的不一致

### F-1 status.md 抬头「当前阶段 = PR 规划（阶段 4）」与同文件的主体内容不符
- 声称（`:4`）：`**当前阶段**: PR 规划（阶段 4）`；阶段状态表阶段 4 = ⏸、阶段 5 = ⬜。
- 实测（同文件其它区块 + git）：`## PR 实现子状态（阶段 5 展开）` 表已有行（pr-002 ✅ / 已合并 `1ca983d` / 已释放）；`## 并发配置（阶段 5）` 已初始化并记录槛位释放；更新日志含「阶段 5 首波并发」「**pr-002 合并进迭代分支**」两条；git 层 `1ca983d` 为真实 merge commit。
- 差异性质：**同一文件内的状态漂移（抬头/阶段表滞后于子状态表与更新日志）**。

### F-2 阶段 4 标记「⏸ 进行中 / 已验证 ⬜」与其产物已提交、Gate r3 已 PASS 不符
- 声称：阶段状态表阶段 4 完成列 = ⏸、已验证列 = ⬜；备注「已派发 pr-planner」。
- 实测：`prs/` 2 个 PR 文件（`7e000d6`）、2 个 tasks 文件（`81a7aed`）均已提交；Gate r3 验证报告 `clarifications/verify-gate-stage4-r3-20260912-193332.md` 已提交（`08d7ce1`），status.md 自身 `## PR 验证` 表亦记 r3 = PASS（6/6）。
- 差异性质：**阶段级台账与阶段产物/验证产物不一致**（阶段 4 的实际收口点为 `7e000d6`/`15d5eaf`）。

### F-3 阶段 5 标记「⬜（未开始）」与其已有执行产物与合并记录不符
- 声称：阶段状态表阶段 5 完成列 = ⬜，备注「逐 PR 状态见下」。
- 实测：两 PR 的 worktree 均已创建（pr-001 现存、pr-002 现存证据 = `d038e3c` 提交 + history 记录）；两次 PR 级验收报告已提交（`c9c4927`）；pr-002 已合并（`1ca983d`）。
- 差异性质：**阶段级台账滞后于阶段 5 的真实执行进度**。

### F-4 阶段 3 备注与阶段 4 备注引用的 architecture 版本号低于产物实际版本
- 声称：阶段 3 备注「architecture.md **v1.1.0**」；阶段 4 备注「输入 = architecture.md **v1.1.0** + prd/F01~F15 + 代码库现状」。
- 实测：产物 `architecture.md:3` = `**版本**：1.2.2`；版本演进由 `15d5eaf` 的提交信息（「architecture v1.2.2 + PR 引用同步 + 两份验证报告」）与 `7e000d6`（「architecture v1.2.0 台账修正」）承载；且 `7e000d6`/`15d5eaf` 均在阶段 4 之内。
- 差异性质：**台账中的版本号落后于被引用产物的实际版本**（阶段 4 的实际输入已是 v1.2.x）。

### F-5 pr-002 的「合并前置」要求写「重基线（rebase）」，实测为 merge 合并、源提交未重写
- 声称（`prs/pr-002-…md` 验收「合并前置（重基线，ADR-4）」）：「合并前以**当时的迭代分支**重基线（rebase）」。
- 实测：PR 源提交 `d038e3c` 的父提交仍为 `15d5eaf`（`git rev-list --parents -n1 d038e3c`）⇒ **未被重写**；迭代分支以其为第二父生成合并提交 `1ca983d`，reflog 显示 `merge feat/0019-pr-002-d2-registration: Merge made by the 'ort' strategy`；PR 分支已删除 ⇒ **ref 层不存在 rebase 发生的证据**。
- 同一声称的实质要求（以主线版该文件为基础、只重放 D-2 单段、不带入段外内容）经 `git diff --numstat c9c4927 1ca983d -- …/0019-…/status.md` = `4 / 1` 且全部落在 D-2 段核实**成立**；status.md 更新日志写「ADR-4 处置生效：`0019/status.md` 自动合并、主线段落完整保留」，与实测的合并路径（而非 rebase 路径）措辞相符。
- 差异性质：**要求文字（rebase）与实际执行动作（merge）不一致；实质约束成立**。

### F-6 「已验证」列阶段 1~4 全 ⬜，但阶段 4 存在独立验证产物
- 声称：阶段状态表「已验证」列 = 1 ⬜ / 2 ⬜ / 3 ⬜ / 4 ⬜。
- 实测：`clarifications/verify-gate-stage4-20260912-191730.md`、`…-r2-…`、`…-r3-…` 三份验证报告均被追踪（`15d5eaf`、`08d7ce1`），其中 r3 声称 PASS（6/6）；阶段 1~3 确无对应验证产物（与 ⬜ 相符）。
- 差异性质：**阶段 4 的验证状态标记与其验证产物存在性不符**（阶段 1~3 部分一致）。

### F-7 迭代分支 HEAD 内的台账视图落后于工作区视图；工作区另有第二处未提交改动（出现于本次观测过程中）
- 实测：
  - `git status --porcelain=v1 -uall`（19:53:45）= 仅 ` M docs/iterations/0019-…/status.md`（7+/3−：pr-002 行改 ✅/已清理/`1ca983d`/已释放、并发配置 3→5 + 释放 0→1、更新日志新增 3 行）；
  - 19:54:21 再取样 = 新增 ` M docs/iterations/0019-…/prs/pr-001-tasks.md`（15+/14−，含「**修订 r2（2026-09-12）**」说明：T4 判据口径修正、计数口径定版、SKILL 零改动清单补范围排除）；
  - `git show HEAD:…/status.md`（即 `1ca983d` 版本）仍是合并前视图：pr-002 行 = ⏸ / `feat/0019-pr-002-d2-registration` / ⬜ / 占用；`当前有效上限 3` / `累计槛位释放次数 0`。
- 归属判定（事实层）：两处改动均落在 0019 迭代目录内、内容为本次合并后的台账维护与 pr-001 判据口径返工，**属主线维护中的进行中改动**，不属外来改动；工作区其余部分（`roles/`、`.claude/`、`tools/`、`oamp/`、0017 目录）`git diff HEAD` 干净。
- 差异性质：**committed 台账（`1ca983d`）滞后于工作区台账**；未见与任何文字声称的正面矛盾，但按「每条结论须以 git 一手记录为准」的口径，该滞后本身是需记录的状态差异。

**不一致计数：7 条**（F-1 ~ F-7；其中 F-1/F-2/F-3/F-6 为台账标记与产物/执行事实不一致，F-4 为版本号引用滞后，F-5 为要求文字与执行动作不一致，F-7 为 committed 视图与工作区视图滞后）。

---

## 6. 无法核实项

- **U-1 「P-1~P-16 + D-2 全部经用户裁决」「MI-01~MI-09 全部按推荐」「L1 三条经用户确认」等裁决行为本身无法用 git 一手记录核实。** 可核实到的只是落盘文本（`demand.md` §用户确认记录、`clarifications/round-*.md`、`*-proposals.md`、`architecture.md` L1 段），它们均为角色产出物，不构成「用户输入真实发生」的独立证据（仓库内无被追踪的用户输入原始记录）。
- **U-2 各阶段「已收敛 / `model_inferred` 归零」的质量状态无法核实。** 属产物内部一致性判定，不在本观测的核实范围（verifier 职责）；本次仅核实文件存在性、版本行与引入提交。
- **U-3 pr-001 的「判据口径修正 + 复验」是否已完成，观测时刻无法核实。** git 侧可见：`c034dab` 之后 pr-001 分支与 worktree 无新提交；迭代分支无新的验证报告提交；主工作区存在未提交的 `pr-001-tasks.md` r2 修订（内容与 `history.md` 19:52:00 裁决条目一致）。该修订的落盘/提交以及复验结论在观测时刻均**不存在于任何 ref**，故「是否已完成修正」「复验结论为何」无一手证据。
- **U-4 执行主体的活跃性（哪个会话/子 agent 正在做什么、是否空闲）无法核实。** git 只能证明 ref / worktree 层的事实（无新提交、worktree 干净）；角色 roster 属会话层信息，不构成 git 一手记录。
- **U-5 pr-002 worktree 与分支的清理动作（执行者、时点、方式）无法核实。** 可证明的仅是「观测时刻不存在」（`git worktree list`、`.git/worktrees` 清单、`git branch -a`、磁盘目录清单）；分支删除后 `git reflog show feat/0019-pr-002-d2-registration` 返回 `unknown revision`，清理时点与方式在 ref 层无痕迹。
- **U-6 dev001 跨工作区写入事故的「自行修复」过程无法核实。** 可核实的是终态（`81a7aed` 与 `15d5eaf` 对 4 个文件内容一致；主工作区无该范围残留改动；`git status` 无未跟踪文件），修复动作序列本身无 git 记录。
- **U-7 「分层/隔离协议在本迭代自身落地」的实际效果（如 pr worktree 落点命名是否按新规范执行）在本迭代内无独立证据面。** 实测 pr-001 worktree 路径为旧的 `.pb-agents/worktrees/pr-001`（非新规范的 `{迭代编号}-pr-{NNN}-{slug}`），而本迭代按 F14 验收 6「不追溯、不要求自身迁移」执行 ⇒ 该差异属**声明过的预期状态**，新落点的真实使用只能在下一次多 PR 迭代中核实（规范 `workflow-pb.md:419` 亦将并发执行证据列为下个多 PR 迭代的阶段 6 强制核查项）。
- **U-8 阶段 6 的验证结论不存在（阶段未到）**，无产物可核；本项在本次观测记为「不适用」而非「未通过」。

---

## 附：本次观测命令清单（全部只读）

`git status --porcelain=v1 -b`、`--untracked-files=all`、`git log --oneline --graph --all`、`git log --oneline --diff-filter=A --name-only`、`git log -1 --format=… -- <path>`、`git show --stat <commit>`、`git show <ref>:<path>`、`git show HEAD:<path>`、`git ls-tree -r --name-only <ref> -- <path>`、`git ls-files`、`git diff --stat <A> <B> -- <paths>`、`git diff --numstat <A> <B> -- <path>`、`git diff -U1 <A> <B> -- <path>`、`git diff --quiet HEAD -- <paths>`、`git worktree list --porcelain`、`git branch -a -v`、`git branch -a --contains <commit>`、`git rev-list --parents -n1 <commit>`、`git rev-list --count <A>..<B>`、`git merge-base <A> <B>`、`git merge-base --is-ancestor <A> <B>`、`git for-each-ref --sort=-committerdate`、`git reflog show <ref> --date=iso`、`git stash list`、`git rev-parse --verify refs/stash`、`git rev-parse --show-toplevel --git-dir --git-common-dir`（在 pr-001 worktree 内）、`git -C .pb-agents/worktrees/pr-001 status --porcelain=v1 -uall`、`git -C .pb-agents/worktrees/pr-001 log --oneline`、`ls`（`.git/worktrees`、`.pb-agents/worktrees`）、`grep -n` / `sed -n` / `stat`（产物内容与目录项）。
未执行：`commit` / `merge` / `rebase` / `push` / `checkout` / `branch -d|-D` / `stash` 写入 / `worktree add|remove|prune` / `restore` 等一切写入性 git 命令；未修改本迭代除 `progress.md` 外的任何文件。
