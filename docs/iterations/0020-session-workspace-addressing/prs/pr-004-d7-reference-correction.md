# pr-004-d7-reference-correction

## 上下文摘要

承接 0019 阶段 6 的偏差 D-7：`.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` 两处把 `architecture.md` 的章节号误写作「规范 §8.4」，就地显式化为 `architecture.md §8.4`，不留旁注、不另起段落。

## 涉及功能点

- F18（D-7 承接：两处引用**就地更正**为 `architecture.md §8.4`，范围限于这两处；留痕面在 `pr-003` 的新记录）

## 文件范围

- `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**修改，仅两处**）：`:13`「`:42` CRITICAL 语义反转（槽位保留，措辞见**规范 §8.4**）」→「…措辞见 **`architecture.md §8.4`**」；`:40` 的缩略 `§8.4` → 显式 `architecture.md §8.4`（该行其余引用 `§5.1-W10` / `§5.2-S1~S10` 不动，同处其余文本不动）

**不涉及（零改动面）**：`.claude/skills/workflow-pb/data/` 下其余文件（含本迭代新建的 `skill-optimization-v1.13.0.md`，属 `pr-003`）；`roles/workflow-pb/data/workflow-pb-changelog.md`、两侧 `memory.md`（属 `pr-003`）；`roles/workflow-pb/workflow-pb.md` 与 `.claude/skills/workflow-pb/SKILL.md`（属 `pr-001`）；`docs/worktrees/README.md`（属 `pr-002`）；`docs/iterations/0019-*/**`（只读引用，不写入）；其他任何历史文件（**不做批量引用体例统一**）。

## 验收标准

- [ ] **两处引用就地更正（F18 验收 1~2）**：`skill-optimization-v1.12.0.md` 的**两处待更正引用**（位置见 `architecture.md` v1.1.4 §3.4-O-03，**本 PR 不复述行号**）改为显式指向 `architecture.md §8.4`（含路径前缀）；判据 = ① 两处读作显式 `architecture.md §8.4`；② 检索该文件不再存在指向**不存在的规范章节**的「规范 §8.4」（裸判据：`grep -n '规范 §8\.4'` = 0 命中）
- [ ] **更正后的指向真实存在**：所指向的 `architecture.md §8.4`（= `docs/iterations/0019-worktree-isolation-protocol/architecture.md:568` 的 `### 8.4 角色定义来源与部署`）确实存在，且语义与该记录 `:13` 所要引的 S1 措辞（来源契约）一致——即"改完之后引用指向的内容真的在那里"（若阶段 5 施工时发现 0019 架构 §8.4 的语义与 `:13` 所指不符，**不自行改指向其它章节**，按本文件 `depends_on` 的说明上报主 agent）
- [ ] **就地更正，不新增旁注（F18 验收 2）**：取该文件 diff → 改动**只落在这两处引用句内**；不新增更正说明段、不改叙述结构、不改标题与其余条目（`git diff --stat` 该文件行为 2 处修改、无新增段落）
- [ ] **范围限于这两处（F18 验收 4）**：取本 PR 的改动文件清单 → **只有** `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`；不出现其他历史文件的引用改写、不批量统一引用体例；不含 `.sh`、`tools/**`、`.gitignore`、`oamp/**`、任何执行角色文件

> **独立性读法（阶段 4 主 agent 裁定，2026-09-12）**：本节全部验收条目的独立判定时点 = 本 PR 的 `depends_on` **全部合并之后**——本 PR 的 `depends_on` 为「（无）」，故其验收条目自落地时刻起即可独立判定，不依赖任何外部条件。依据：`roles/workflow-pb/workflow-pb.md:514-519` 的「依赖正确性验证·通过条件」只要求 `depends_on` 每条有证据 + 依赖图无环 + PR 间文件范围无重叠 + 无遗漏功能点。

## 参考资料

- `docs/iterations/0020-session-workspace-addressing/architecture.md` **v1.1.4**（v1.1.4 未落盘时以 v1.1.3 为准）：§3.4（`O-03` 的两处待更正引用，含"本迭代按两处均就地显式化处理"的实测说明）、§9.2（D-7 纳入面：**就地**更正、不新增旁注、不改叙述结构、不另起更正段；范围限于这两处；留痕落在 `O-04`）、§3.6（检索式判据）
- `docs/iterations/0020-session-workspace-addressing/prd/F18-d7-reference-correction.md`（验收标准 1~4 与「架构落地」段）
- `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（改动基线；**两处待更正引用的位置见 `architecture.md` v1.1.4 §3.4-O-03**；实测 `grep -n '8\.4'` 命中恰为两行）
- `docs/iterations/0019-worktree-isolation-protocol/architecture.md:568`（`### 8.4 角色定义来源与部署`——更正后引用的真实落点）
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-stage6-20260912-200521.md`（偏差 D-7 原文要点：两处写作「措辞见**规范 §8.4**」，而 `§8.4` 实为 `architecture.md` 的章节号）
- `docs/iterations/0020-session-workspace-addressing/prs/pr-003-version-records-and-d7-trace.md`（本更正的留痕落点：`.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md` 的「更正登记」段）

## depends_on

（无）

> **说明（为何零依赖，逐条排除）**：① 更正后的指向对象是 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 的 `§8.4`——该文件在本迭代**只读且已存在**（实测 `:568`），不经由任何其他 PR 产生或改写；② 本 PR 的改动文本**不含**任何本迭代新增的章节名（不引用 `§规则 H` / `§规则 D`（更名后）/ `### 协议产物`）、不含任何版本标识（不出现 `v0.10.0` / `v1.13.0`）、不复制 `pr-001` / `pr-002` / `pr-003` 的任何文本 ⇒ 与三者**无文本耦合**；③ 唯一的方向性文本关系是 `pr-003` 的「更正登记」段陈述本 PR 的更正结果（**登记方 → 被登记方**），故边为 `pr-004 → pr-003`，本 PR 自身不依赖任何 PR。**这使本 PR 与 `pr-001` 构成依赖图中的真实并发分支**（两者互不依赖，可同波次并发）。
> **反向无边**：本 PR 不产生 `pr-003` 的输入（其「更正登记」段的正确性依赖于本 PR，反之不成立）。**独立性读法**：本 PR 的 `depends_on` 为「（无）」，验收条目自落地即可独立判定（见「验收标准」段末注记）。

## batch

2

> **备注**：① 本 PR 与 `pr-001` / `pr-002` / `pr-003` 的文件范围**零交集**；② `batch` 仅作人工速览分组——本迭代的 `batch 1` = 寻址契约交付（`pr-001` / `pr-002` / `pr-003`）、`batch 2` = 0019 遗留偏差承接（本 PR），分组只供人工扫读，**调度依据仍是 `depends_on`**（本 PR 因 `depends_on` 为空而与 `pr-001` 同波次派发）；③ **上下文摘要字数口径**：全字符（Unicode，含标点与空格）≤ 200（沿用 0019 阶段 4 的裁定口径）。
