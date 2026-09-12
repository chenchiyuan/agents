# pr-004 任务图（D-7 两处 `§8.4` 引用就地更正）

**来源 PR**：`prs/pr-004-d7-reference-correction.md`（`batch` = 2；`depends_on` = 「（无）」）
**架构依据**：`docs/iterations/0020-session-workspace-addressing/architecture.md` **v1.1.4** —— §3.4-`O-03`、§3.4 末注「D-7 实测如实报告」、§9.2 的 `D-7` 行、§3.5（零改动清单）、§3.6「检索式判据（可裸判定）」行
**功能卡**：`prd/F18-d7-reference-correction.md`（本 PR 覆盖验收 1 / 2 / 4；验收 3「新记录留痕」的落点属 `pr-003`）
**唯一改动文件**：`.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`

---

## 1. 任务列表

### T1 — 将两处 `§8.4` 引用**就地**显式化为 `architecture.md §8.4`

| 项 | 内容 |
|---|---|
| **目标文件** | `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**唯一**改动文件） |
| **改动点 ①** | **含「措辞见规范 §8.4」的那一行**（引文式定位；检索式实测 `grep -n '规范 §8\.4' <file>` 恰 1 行）：`措辞见规范 §8.4` → `措辞见 architecture.md §8.4` |
| **改动点 ②** | **含缩略 `§8.4` 的那一行**（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行）：缩略 `§8.4` → 显式 `architecture.md §8.4`；**该行其余引用 `§5.1-W10` / `§5.2-S1~S10` 与同处其余文本不动** |
| **追溯来源** | ① architecture v1.1.4 §3.4-`O-03` 原句（权威条目）：<code>\| **O-03** \| `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` \| **就地更正 2 处** \| `:13`「措辞见规范 §8.4」→「措辞见 `architecture.md §8.4`」；`:40` 的缩略 `§8.4` → 显式 `architecture.md §8.4`（同处其余引用不动） \| F18 \|</code>；② §3.4 末注原句：「**本迭代按"两处均就地显式化为 `architecture.md §8.4`"处理**（范围仍限于这两处，F18 验收 4 成立）」；③ §9.2-`D-7` 行原句：「**纳入（P-12① 已裁决）**：**就地**更正为 `architecture.md §8.4`（**不新增旁注、不改叙述结构、不另起更正段**）…**范围限于这两处**（不做其他历史文件引用核查、不批量统一引用体例）」；④ F18 验收 1（W22 / E17） |
| **前置依赖** | **无** |
| **优先级** | P0（本 PR 唯一任务；`depends_on` 为空 ⇒ 与 `pr-001` 同波次派发） |

**验收标准**（全部可裸判定；`<file>` = `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`）

| # | 验收标准（可测试） | 追溯来源 |
|---|---|---|
| **A1** | 检索式命中数符合预期：`grep -n '8\.4' <file>` 输出**恰 2 行**（改前实测见 §3.4 末注：「实测命中 **2 行**」） | §3.4-`O-03` + §3.4 末注；F18 验收 1 |
| **A2** | 错引清零：`grep -n '规范 §8\.4' <file>` = **0 命中**（不再存在指向不存在的规范章节的引用） | F18 验收 1 判定；§9.2-`D-7` 行 |
| **A3** | 两处均带路径前缀：逐行判定 A1 的 2 行 —— 每行 `§8.4` 左侧均出现 `architecture.md`；等价裸判据 `grep -c 'architecture\.md[^0-9]*§8\.4' <file>` = **2** | §3.4-`O-03`；`prs/pr-004-*.md`「验收标准」第 1 条判据① |
| **A4** | **更正后的指向真实存在且语义一致**：`grep -n '^### 8\.4' docs/iterations/0019-worktree-isolation-protocol/architecture.md` = **1 命中**，节名原句 `### 8.4 角色定义来源与部署（T-04 / T-11，F08）`；语义核对：该节内含块标题原句「SKILL 侧 `:42` CRITICAL 改写措辞（L1-1，已确认 = 按推荐；2026-09-12）」（`grep -n 'CRITICAL 改写措辞' <该文件>` = 1 命中），与改动点 ① 所引的 `:42` CRITICAL 措辞同一指向 ⇒「改完之后引用指向的内容真的在那里」 | `prs/pr-004-*.md`「验收标准」第 2 条；`docs/iterations/0019-worktree-isolation-protocol/architecture.md` §8.4 |
| **A5** | **就地更正、不新增旁注**：`git diff --name-only` 仅 `<file>` 一个文件；`git diff -U0 -- <file>` 恰 **2 个 hunk**，每个 hunk 仅含 1 对 `-`/`+` 行（**无新增段落 / 无更正说明段 / 无旁注**）；`git diff --numstat -- <file>` = `2	2	<file>` | §9.2-`D-7` 行；F18 验收 2 |
| **A6** | **范围限于这两处**：改动文件清单不含 `.claude/skills/workflow-pb/data/` 下其他文件（含 `skill-optimization-v1.13.0.md`）、`roles/workflow-pb/**`、`.claude/skills/workflow-pb/SKILL.md`、`docs/worktrees/README.md`、`docs/iterations/0019-*/**`、`prs/*.md`，亦不含 `.sh` / `tools/**` / `.gitignore` / `oamp/**`（§3.5 零改动清单各面 0 hunk）；且**不批量统一引用体例** | §9.2-`D-7` 行；§3.5；F18 验收 4；P-12① |

**停手上报条件（不自行决断）**：若施工中 A4 的语义核对发现该节语义与改动点 ① 所指不符 ⇒ **不自行改指向其它章节**、不改本任务图，按 `prs/pr-004-d7-reference-correction.md` 的 `depends_on` 说明上报主 agent。（PR 明文要求）

**明确不做（越界即 A5 / A6 不通过）**：不改该文件其余任何内容（不统一引用体例、不批量格式化、不补旁注或脚注、不动标题与其余条目）；不写入 `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md` 与两侧 `memory.md`（属 `pr-003`）；不写入 `roles/workflow-pb/workflow-pb.md`、`.claude/skills/workflow-pb/SKILL.md`（属 `pr-001`）；不写入 `docs/worktrees/README.md`（属 `pr-002`）；不写入 `docs/iterations/0019-*/**`（只读引用）。

---

## 2. 依赖图摘要

```mermaid
graph LR
  T1["T1 两处 §8.4 引用就地显式化"]
```

- 任务总数：**1**；依赖边：**0**；**无环**（单节点，不存在环的构造可能）。
- 最长链 / 关键路径：**T1**（链长 1，即本 PR 的全部工作量）。
- 与 PR 依赖图的关系：`pr-004` 的 `depends_on` = 「（无）」⇒ 本任务图**无跨 PR 前置**；PR 层的 `pr-004 → pr-003` 是**登记方向**（`pr-003` 的「更正登记」段陈述本 PR 的更正结果），**不构成 T1 的前置**。

---

## 3. `[model_inferred]` 清单

| # | 内容 | 需主 agent 确认的理由 |
|---|---|---|
| 1 | 改动点 ② 的**反引号包裹形态**：architecture §3.4-`O-03` 仅给出「缩略 `§8.4` → 显式 `architecture.md §8.4`」，未规定该行的反引号落法。本任务图因此把 A3 写成**子串级**判据（`§8.4` 左侧出现 `architecture.md` 即通过；已实测该正则对「路径加反引号」「整体加反引号」「无引号」三种形态均命中） | 属对架构未规定细节的处置口径：未新增架构决策，但决定了验收判定粒度，按 planner 边界纪律上报 |

（F18 验收 3 的留痕形态/落点见 `T-12` 与 `O-04`，属 `pr-003`，不在本 PR 的 `[model_inferred]` 范围。）

---

## 4. 粒度与覆盖说明

- **为何是 1 个任务**：单文件、同一验收面。两个改动点属**同一次原子 diff**（A5 要求「diff 只落这两行」）：拆成两个任务后，任一任务都无法独立判定 A1 / A2 / A3 / A5 / A6，只会制造假依赖 ⇒ 按 planner 粒度下限（「能独立验收」）合并为一个任务，不进一步下拆，也不上拆出「回归核对」任务（核对属阶段 5/6 的独立验证，非实现任务）。
- **功能点覆盖**：F18 验收 1 → **A1 / A2 / A4**；验收 2 → **A5**；验收 4 → **A6**。F18 验收 3（新记录留痕）的落点为 `O-04`（`pr-003` 的 `skill-optimization-v1.13.0.md`「更正登记」段），PR 的「文件范围」已将其列为**不涉及（零改动面）** ⇒ 本任务图**不覆盖、亦不遗漏**。
- **检索式判据体例**：A1~A4 的裸判据沿用 architecture §3.6「检索式判据（可裸判定）」行的组织方式。
- **本任务图不含实现代码、不含架构决策**；所有验收标准的追溯来源均落于 architecture v1.1.4 或 F18 卡，无凭空条目。
