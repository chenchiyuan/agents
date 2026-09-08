# PR-001: workflow-pb 新增迭代分支层（v0.7.0 → v0.8.0）

## 上下文摘要

本迭代（0008-iteration-branch-workflow）在 `workflow-pb.md` 协议中新增一层"迭代分支"，把现状的 `main ← PR worktree 分支` 单层结构改为 `main ← iteration/{迭代ID} ← PR worktree 分支` 两层结构，让 main 始终只包含已完成、已验证的迭代产出。

架构方案 D1~D5 的全部改动点集中在同一份文件 `roles/workflow-pb/workflow-pb.md`（含头部版本号、变更说明节、提交管理约束、调度指南、状态追踪协议共 5 处不相邻但同属一份文件的修改），并延伸到其配套的 `.claude/skills/workflow-pb/SKILL.md`（11 处"主分支"术语替换）及两侧的 changelog/memory 索引文件。经逐条核对 architecture.md「对 workflow-pb.md 的目标改动清单」§1~§11，判断本迭代应产出**单个 PR**，不拆分，理由如下：

1. **文件范围天然不可切分**：D2（worktree base 显式化）与 D3（阶段 5 解锁判据改写）在 `workflow-pb.md` 第 266 行是**同一段落、同一句子**（"……为该 PR 创建独立 worktree 分支……所依赖的 PR 均已合并进主分支的已解锁 PR……"），任何拆分方案都会导致某个 PR 的 diff 落在这句话中间、产生自相矛盾的半改句子，直接违反 pr-planner 判断框架的「逻辑原子性」标准。D1（迭代分支创建时机）与 D4（合并进 main 机制）虽分处「启动工作流」与新增「迭代分支合并进 main」小节，但两节紧邻、共享"迭代分支生命周期"这一叙事，拆开会迫使评审者在两个 PR 间来回切换心智模型才能理解迭代分支从创建到销毁的完整生命周期，违反「可审查性」标准。D5（版本号/变更说明/status.md 字段）本质是为 D1~D4 的改动做收尾记录，脱离 D1~D4 单独存在时验收标准无法独立判断（"版本号该不该跳 0.8.0"这一问题的答案本身就依赖于 D1~D4 是否已经落地），违反「独立性」标准。
2. **同类先例一致**：`docs/iterations/0005-pr-concurrent-execution/prs/pr-001-workflow-pb-concurrent-dispatch-protocol.md` 与 `docs/iterations/0007-workflow-history-log/prs/pr-001-history-log-protocol.md` 均属于同一类"协议自我修改"迭代，且改动同样集中在 `workflow-pb.md` + `SKILL.md` + 二者的 changelog/memory 文件，两次先例都判断"文件范围重叠、字段互相引用，拆分会违反文件范围无重叠红线"而合并为单 PR。本迭代的耦合程度不弱于两次先例（第 266 行同句耦合甚至比先例更紧），没有发现足以推翻"合并"结论的新证据。
3. **SKILL.md 的 11 处术语替换本身不可再拆**：这 11 处分别对应 D2/D3/D5 三个决策的混合影响（例如 `:38` 的 CRITICAL 声明同时涉及"合并进主分支"这一 D2/D3 共享措辞），SKILL.md 文件内部没有一条能沿决策边界切开的分割线；且 `workflow-pb.md` 的 CRITICAL 规则明确"本文件是提交管理约束的唯一来源，发现重复定义视为耦合未解"，若把 SKILL.md 同步拆到与 workflow-pb.md 正文不同批次的 PR，会在两次合并之间造成两份文件术语暂时不一致的窗口期，与该红线精神相悖。

结论：本 PR 覆盖 D1~D5 / F01~F06 全部改动，一次性完成 `workflow-pb.md` 正文改写 + changelog 记录 + SKILL.md 同步 + 两侧 memory 索引更新。

## 涉及功能点

- F01：迭代分支概念、命名与生命周期定义
- F02：阶段 1 完成后创建迭代分支的机制（创建时机/创建方/创建基点/git 命令）
- F03：PR worktree 的 base 与合并目标改为迭代分支（含 SKILL.md 11 处同步）
- F04：阶段 5 解锁判据改为"合并进迭代分支"（含 progress-observer 核实方式的协议文字补充）
- F05：迭代分支合并进 main 的触发机制（触发时机/执行方/合并策略/commit message 格式/失败处理）
- F06：版本号升级（0.7.0→0.8.0）与变更说明、changelog、SKILL.md 版本号、status.md 字段扩展

## 文件范围

- `roles/workflow-pb/workflow-pb.md`（正文改写：头部版本号、新增 v0.8.0 变更说明节、提交管理约束规则 A、启动工作流步骤 4.5、新增"迭代分支合并进 main"小节、阶段 5 调度指南 3 处解锁判据措辞、可观测性小节补充句、状态追踪协议 status.md 格式字段与槛位状态列取值说明）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（新增 v0.8.0 条目）
- `roles/workflow-pb/memory.md`（新增指向 v0.8.0 changelog 条目的索引行，遵循既有索引格式）
- `.claude/skills/workflow-pb/SKILL.md`（版本号 1.10.0→1.11.0、description 中 v0.7.0→v0.8.0、11 处"主分支"术语同步替换）
- `.claude/skills/workflow-pb/data/skill-optimization-v1.11.0.md`（新建，记录本次 SKILL.md 同步改动清单）
- `.claude/skills/workflow-pb/memory.md`（新增指向 skill-optimization-v1.11.0.md 的索引行）

不涉及 `.pb-agents/` 下的部署副本（该目录 gitignored，为 `tools/install-pb-agents.sh` 生成的部署产物，非本 PR 范围；dev 完成本 PR 改动后可自行运行该脚本同步，但同步动作本身不属于本 PR 验收范围）。

## 验收标准

- [ ] `roles/workflow-pb/workflow-pb.md` 头部版本号由 `0.7.0` 改为 `0.8.0`
- [ ] 第 54 行空行之后、原「## v0.6.0 变更说明」标题之前，新增「## v0.8.0 变更说明（相对 v0.7.0）」节，包含触发/方案/不改变的部分/生效范围四段，生效范围明确写"仅从下一个使用本工作流的迭代起生效，不追溯 0005/0007"
- [ ] §提交管理约束·规则 A：原"不得直接在主分支（main/master）上提交"改为"……或当前迭代的迭代分支上提交"；判断方式原"合并进主分支"改为"合并进当前迭代的迭代分支"，并新增一句"每次提交所在分支不得为 `main`/`master`，也不得为当前迭代的迭代分支本身"
- [ ] §调度指南·启动工作流：步骤 4「从阶段 1 开始」之后新增步骤 4.5，写明 `git branch iteration/{迭代ID} main` + `git checkout iteration/{迭代ID}` + 在 status.md 头部写入 `**迭代分支**` 字段
- [ ] §调度指南 新增「迭代分支合并进 main」小节：阶段 6 pass 后执行 `git checkout main` → `git merge --no-ff iteration/{迭代ID}` → `git branch -d iteration/{迭代ID}`；commit message 格式 `merge: iteration {迭代ID} {一句话目标} into main`；冲突时停止上报（类比"PR 依赖图有环"）；合并完成后 status.md 的 `**迭代分支**` 字段改为 `iteration/{迭代ID}（已合并）`
- [ ] §调度指南·阶段 5（第 266 行，完整为一行）：该行内三处编辑点全部落在同一行——worktree 创建首次显式化为 `git worktree add <path> -b <pr分支名> iteration/{迭代ID}`；同句"合并进主分支"→"合并进当前迭代的迭代分支"；同句末尾"merge 主分支」"→"merge 进当前迭代的迭代分支」"；行尾"不因此放宽'合并进主分支才算解锁'……"一句同步替换
- [ ] 第 270 行「为什么必须以'合并进主分支'作为解锁条件」标题及正文两处"主分支"→"迭代分支"；第 281 行「并发槛位算法」末段有两处编辑点：第一处"合并进主分支才算解锁"中字面"主分支"→"迭代分支"替换，第二处在"依赖未合并的 PR"之后插入"进迭代分支"（改为"依赖未合并进迭代分支的 PR"），后者是插入补充语，不是"主分支"术语替换
- [ ] §可观测性·progress-observer 小节末尾新增一句：核实合并状态的 git log 命令以迭代分支为基准（示例 `git log iteration/{迭代ID} --grep="pr-001"`），而非 main；不改动 `progress-observer.md` 角色文件本身
- [ ] §状态追踪协议 status.md 格式：头部字段区在「当前阶段」与「状态」之间插入 `**迭代分支**: iteration/{迭代ID}` 一行；第 458 行槛位状态列取值说明"尚未合并进主分支"→"尚未合并进当前迭代的迭代分支"
- [ ] `roles/workflow-pb/data/workflow-pb-changelog.md` 头部新增 `## v0.8.0（日期）` 条目，含触发/方案/具体改动清单/未改变的部分，未改变部分需明确列出"PR 文件七字段格式、阶段数量、执行角色本身、并发槛位算法公式"
- [ ] `roles/workflow-pb/memory.md` 新增一条指向 v0.8.0 changelog 条目的索引行，格式与现有条目一致
- [ ] `.claude/skills/workflow-pb/SKILL.md` 头部版本号 `1.10.0`→`1.11.0`，description 中 `v0.7.0`→`v0.8.0`
- [ ] `.claude/skills/workflow-pb/SKILL.md` 全文原 11 处"主分支"字样（行号 14/38/65/81/87/119/124/174/200/261/376，以 architecture.md §9 表格为准，实际行号以改动时最新文件为准）全部替换为"当前迭代的迭代分支"或等效表述；替换后全文检索 SKILL.md 不再残留裸露的"合并进主分支"/"主分支拉出"表述
- [ ] 新建 `.claude/skills/workflow-pb/data/skill-optimization-v1.11.0.md`，记录本次 11 处术语替换清单及版本号升级原因
- [ ] `.claude/skills/workflow-pb/memory.md` 新增一条指向 `skill-optimization-v1.11.0.md` 的索引行，格式与现有条目一致
- [ ] 改动完成后，`roles/workflow-pb/workflow-pb.md` 与 `.claude/skills/workflow-pb/SKILL.md` 全文交叉检索，不再存在两份文件对"PR 合并目标/worktree base/阶段5解锁判据"表述不一致或重复定义的情况

## 参考资料

- `docs/iterations/0008-iteration-branch-workflow/architecture.md`（D1~D5 决策 + §「对 workflow-pb.md 的目标改动清单」§1~§11，逐条给出行号+原文+改后文字）
- `docs/iterations/0008-iteration-branch-workflow/prd.md` 及 `prd/F01-iteration-branch-concept.md` ~ `prd/F06-version-and-changelog.md`
- `docs/iterations/0008-iteration-branch-workflow/demand.md`（§4~§7 用户已确认的方向性事实）
- `roles/workflow-pb/workflow-pb.md`（当前 v0.7.0，待改写的主文件本体）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（既有 v0.5.0~v0.7.0 条目格式参照）
- `.claude/skills/workflow-pb/SKILL.md`（当前 v1.10.0，待同步文件）
- 同类先例：`docs/iterations/0005-pr-concurrent-execution/prs/pr-001-workflow-pb-concurrent-dispatch-protocol.md`、`docs/iterations/0007-workflow-history-log/prs/pr-001-history-log-protocol.md`（同类"协议自我修改"迭代，均判断合并为单 PR）

## depends_on

（无）

## batch

1
