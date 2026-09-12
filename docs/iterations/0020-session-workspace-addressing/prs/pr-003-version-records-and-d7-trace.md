# pr-003-version-records-and-d7-trace

## 上下文摘要

落 v0.10.0 / v1.13.0 的两侧惯例留痕：规范侧 changelog 条目与 memory 索引行、SKILL 侧新记录 `skill-optimization-v1.13.0.md`（含 D-7 就地更正的「更正登记」段）与 memory 索引行；不新建文档类型，沿用既有体例。

## 涉及功能点

- F11（supersede 逐句显式声明：changelog 条目内的**被取代清单 / 保留清单**与规范 `## v0.10.0 变更说明` 同源，读规范的人与读 changelog 的人拿到同一份逐句清单）
- F15（0019 E 项承接三分类与留痕：changelog 条目与 SKILL 新记录承接保留 / 改写 / 新增三分类的登记面）
- F16（0018 活指令失效登记的留痕面：changelog 条目 ④ 备案段镜像"0018 文件不改写、其前置句已失效"）
- F18（D-7 承接的**留痕面**：新记录「更正登记」段——改了哪两处、改成什么；更正本体在 `pr-004`）

## 文件范围

- `roles/workflow-pb/data/workflow-pb-changelog.md`（**追加**）：头部新增 `## v0.10.0（2026-09-12）` 条目，**6 段**——触发 / 方案 / **被取代清单（逐句）+ 保留清单** / 未改变的部分 / 生效范围 / **备案段**；其中前 5 段与既有 v0.9.0 条目的 5 段同构（v0.9.0 实测：触发 `:5` / 方案 `:7` / 未改变的部分 `:17` / 生效范围 `:19` / 具体改动 `:21`），第 6 段「备案段」为本迭代新增段；具体改动逐条覆盖 `pr-001` 的规范侧与 SKILL 侧改动（含"头部版本号 0.9.0 → 0.10.0"与"`.claude/skills/workflow-pb/SKILL.md` 同步（v1.12.0 → v1.13.0）"）；既有 v0.2.0~v0.9.0 条目**逐字不动**
- `roles/workflow-pb/memory.md`（**追加**）：在**既有最新版本行之上（置顶）**插入 v0.10.0 索引行（既有惯例：最新版本行置顶）——实测落点：该文件 `:1-4` 为 frontmatter、`:6` 为标题行、**`:8` 为既有最新版本行**（v0.9.0），新行插在 `:8` **之前**（**不是文件首行**）；格式与 v0.9.0 行同构；既有行逐字不动
- `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md`（**新建**）：段名与段数以 architecture §8.3 为准——**5 段**：变更点（K-01~K-09 逐条对应）/ 未改变的部分 / 一致性核对 / **更正登记**（F18 验收 3：`skill-optimization-v1.12.0.md` 的 `:13` 与 `:40` 两处引用已显式化为 `architecture.md §8.4`，写明改了哪两处、改成什么）/ 关联文件。**先例实测为 7 段**（触发 / 根因 / 方案 / 具体改动 / 未改变的部分 / 一致性核对 / 关联文件；`v1.12.0` 的段首行号 = `:3` / `:5` / `:7` / `:9` / `:27` / `:29` / `:37`，`v1.11.0` = `:3` / `:5` / `:7` / `:9` / `:27` / `:29` / `:36`）——本记录**沿用其体例精神**（粗体段名 + 段间空行 + 逐条可核对 + `:1` 版本对声明行），**不照搬其段名**（不写「触发 / 根因 / 方案 / 具体改动」），按 §8.3 的 5 段落盘，其中「更正登记」为本记录新增段
- `.claude/skills/workflow-pb/memory.md`（**追加**）：在**既有最新版本行之上（置顶）**插入 v1.13.0 索引行，指向 `data/skill-optimization-v1.13.0.md`——实测落点：该文件 `:1` 为标题行、`:3` 为说明引用行、**`:5` 为既有最新版本行**（v1.12.0），新行插在 `:5` **之前**（**不是文件首行**）；既有行（含 v1.12.0 行）逐字不动

**不涉及（零改动面）**：`roles/workflow-pb/workflow-pb.md` 与 `.claude/skills/workflow-pb/SKILL.md`（属 `pr-001`）；`docs/worktrees/README.md`（属 `pr-002`）；`.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**就地更正由 `pr-004` 承担**，本 PR 只登记该更正的事实）；`data/skill-optimization-v1.1.0.md`~`v1.11.0.md`（历史记录不改）；`roles/workflow-pb/data/` 的其余三个非版本文件；`.gitignore`、`tools/**`、`oamp/**`、`principles/**`、任何执行角色文件。

## 验收标准

- [ ] **changelog 条目（F11 验收 1~2 / F15 验收 1~4 / F16 验收 2）**：`roles/workflow-pb/data/workflow-pb-changelog.md` 中含 `## v0.10.0（2026-09-12）`，**6 段齐备**（触发 / 方案 / 被取代清单 + 保留清单 / 未改变的部分 / 生效范围 / 备案段）；前 5 段体例与 v0.9.0 条目的 5 段同构（v0.9.0 实测 `:5` / `:7` / `:17` / `:19` / `:21`），「备案段」为本迭代新增段；其中「被取代清单」逐句引 v0.9.0 原句（章节 + 原句，**不用行号**，同 architecture §8.3-T-07 的句级引用方式）、「保留清单」覆盖 P1~P6 六组、「未改变的部分」覆盖阶段职责 / 推进条件 / 并发槛位算法 / PR 七字段 / 规则 A·B·E·G / `.gitignore` 与安装脚本 / 任何执行角色文件、「具体改动」逐条对应 `pr-001` 的 `N-01`~`N-21` 与 `K-01`~`K-09`
- [ ] **备案段镜像（F15 验收 3 / F16 验收 2）**：changelog 条目的备案内容与规范 `## v0.10.0 变更说明` 的备案段**同源**——① 0019 E 项三分类（保留 E1~E4 / E6 / E7 / E9~E13、改写 E5 与 E8、**明确登记为两条新增**）；② `0018/status.md` 的「操作前置（宿主限制，必须由用户执行）」句已失效的登记，且**不含**"0018 需回改 / 本迭代将修改 0018 文件"类表述（F16 验收 5），`docs/iterations/0018-*/**` 在本 PR 的改动清单中 0 命中（F16 验收 1）
- [ ] **memory 索引行（F15）**：`roles/workflow-pb/memory.md` 与 `.claude/skills/workflow-pb/memory.md` 各自在**既有最新版本行之上（置顶）**新增对应版本索引行（v0.10.0 / v1.13.0），格式与既有行一致——落点实测：`roles/workflow-pb/memory.md` 的既有最新版本行 = `:8`（新行插在 `:8` 之前）；`.claude/skills/workflow-pb/memory.md` 的既有最新版本行 = `:5`（新行插在 `:5` 之前）；两文件首行 / 文件头（frontmatter、标题行）**不被占用**；两文件既有行**逐字不动**（`git diff` 中仅新增行、无删除与改写）
- [ ] **SKILL 新记录（F15 / F18 验收 3）**：新建 `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md`，段名与段数以 architecture §8.3 为准——5 段齐备（变更点 / 未改变的部分 / 一致性核对 / **更正登记** / 关联文件）；**先例实测为 7 段**（触发 / 根因 / 方案 / 具体改动 / 未改变的部分 / 一致性核对 / 关联文件），本记录不照搬先例段名；首行以"对应规范 workflow-pb v0.10.0"声明版本对（与 `skill-optimization-v1.12.0.md:1` 体例同构）；「更正登记」段可追溯到"改了哪两处（`:13` / `:40`）、改成什么（显式化为 `architecture.md §8.4`）"，且与实际落地文本一致（其落地由 `pr-004` 承担，`depends_on` 已声明）
- [ ] **记录体例与零改动面（F13 验收 3）**：不新建除 `skill-optimization-v1.13.0.md` 之外的任何文档类型；`data/skill-optimization-v1.12.0.md` 在本 PR 的 diff 中 **0 hunk**（该文件的改动归 `pr-004`）；`roles/workflow-pb/workflow-pb.md`、`.claude/skills/workflow-pb/SKILL.md`、`docs/worktrees/README.md` 在本 PR 的 diff 中 **0 hunk**；改动清单不含 `.sh`、`tools/**`、`.gitignore`、`oamp/**`、任何执行角色文件

> **独立性读法（阶段 4 主 agent 裁定，2026-09-12）**：本节全部验收条目的独立判定时点 = 本 PR 的 `depends_on`（`pr-001` + `pr-004`）**全部合并之后**；「独立性」不得读作"任何时刻都不需要其他 PR"，也不得读作需要任何**未声明**的外部条件。依据：`roles/workflow-pb/workflow-pb.md:514-519` 的「依赖正确性验证·通过条件」只要求 `depends_on` 每条有证据 + 依赖图无环 + PR 间文件范围无重叠 + 无遗漏功能点；`:513` 的独立性字面口径按前述读法生效，阶段 6 复核时不再按字面复判——本 PR 第 1 / 2 / 4 条（changelog 逐条对应 / 备案段同源 / 更正登记与实际落地一致）即该读法下的**依赖序内可判**条目，第 3 / 5 条为纯结构判据。

## 参考资料

- `docs/iterations/0020-session-workspace-addressing/architecture.md` **v1.1.1**：§3.4（`O-01` / `O-02` / `O-04`）、§8.3 的「其余落点」表（四份记录文件的动作与体例基准）、§8.3 的六段表（changelog 条目内容来源）、§9.1（0019 E 三分类逐条）、§9.2（D-7 纳入面与留痕落点）、§3.6（版本一致性判据）
- `roles/workflow-pb/data/workflow-pb-changelog.md:1-43`（**v0.9.0 条目 = 本 PR 追加条目的体例先例，实测 5 段**：触发 `:5` / 方案 `:7` / 未改变的部分 `:17` / 生效范围 `:19` / 具体改动 `:21`；其中"头部版本号 0.8.0 → 0.9.0"与"`.claude/skills/workflow-pb/SKILL.md` 同步（v1.11.0 → v1.12.0）"两句即本 PR 与 `pr-001` 的文本耦合证据）
- `roles/workflow-pb/memory.md`（**既有最新版本行 = `:8` 的 v0.9.0 行 = 新行格式与落点先例**）；`.claude/skills/workflow-pb/memory.md`（**既有最新版本行 = `:5` 的 v1.12.0 行 = 新行格式与落点先例**）
- `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**体例先例，实测 7 段**：触发 `:3` / 根因 `:5` / 方案 `:7` / 具体改动 `:9` / 未改变的部分 `:27` / 一致性核对 `:29` / 关联文件 `:37`；含 `:1` 版本对声明行、`:13` / `:40` 两处待更正引用）
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-stage6-20260912-200521.md`（偏差 D-7 原文要点）
- `docs/iterations/0020-session-workspace-addressing/prs/pr-001-addressing-contract-and-host-skill.md`（本 PR 所登记改动的出处）；`prs/pr-004-d7-reference-correction.md`（本 PR「更正登记」段所登记更正的实际落地 PR）

## depends_on

- **pr-001-addressing-contract-and-host-skill.md**（理由：本 PR 四份文件的内容是 `pr-001` 改动的**记录 / 索引**，逐处引用 `pr-001` 落地后才成立的标识与文本——三条证据：① `roles/workflow-pb/data/workflow-pb-changelog.md` 的条目以 `## v0.10.0（2026-09-12）` 起首，其「具体改动」按既有体例必须写出"头部版本号 `0.9.0` → `0.10.0`"与"`SKILL.md` 同步（v1.12.0 → v1.13.0）"（对照 v0.9.0 条目的同两句——**句级引用**：`:15`「`.claude/skills/workflow-pb/SKILL.md` 同步（v1.11.0 → v1.12.0）」、`:22`「头部版本号 `0.8.0` → `0.9.0`」；行号为实测值、仅供定位，判据仍为句级引用，同 architecture §8.3-T-07），这两个标识由 `pr-001` 产生；② `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md` 的变更点是 `K-01`~`K-09` 的逐条记录（版本对"对应规范 workflow-pb v0.10.0"须与 `SKILL.md:30` 一致），其内容与 `pr-001` 的 SKILL diff 是**同一内容的两次落盘**；③ `.claude/skills/workflow-pb/memory.md` 索引行与 `roles/workflow-pb/memory.md` 索引行均描述 `pr-001` 的改动摘要。`pr-001` 未落地时，两处版本标识与全部变更点描述均为空指（记录先于被记录对象）。)
- **pr-004-d7-reference-correction.md**（理由：本 PR 的 `skill-optimization-v1.13.0.md` 含「更正登记」段，其内容是"`skill-optimization-v1.12.0.md` 的 `:13` / `:40` 两处已就地更正为 `architecture.md §8.4`"这一**对另一文件状态的陈述**（F18 验收 3 的留痕面）；`pr-004` 未落地时该登记为不实陈述——`:13` 仍写作"措辞见规范 §8.4"、`:40` 仍为缩略 `§8.4`。故登记方等被登记方落地（对应 `architecture §9.2` 把 D-7 的纳入面拆为 `O-03`（更正）+ `O-04`（留痕）两处落点的分工）。)

> **未声明的依赖（逐条说明为何无证据）**：① 本 PR 与 `pr-002`（`docs/worktrees/README.md`）**无边**——changelog 条目在「方案」段会把该产物列为本次变更集的一项（与规范 `### 协议产物` 条款的声明同源，是**变更集枚举**，不是对产物内容的复制：产物侧 5 节的正文、区分句、边界声明均不被本 PR 重述）；② 本 PR 不构成 `pr-001` / `pr-002` 的上游。
> **依赖图全貌**：`pr-001 → pr-002`、`pr-001 → pr-003`、`pr-004 → pr-003`，**无环**；`pr-001` 与 `pr-004` 互不依赖。**独立性读法**：本 PR 的验收条目在其 `depends_on` 全部合并后独立判定（见「验收标准」段末注记；第 1 / 2 / 4 条为依赖序内可判条目）。

## batch

1

> **备注**：① 本 PR 与 `pr-001` / `pr-002` / `pr-004` 的文件范围**零交集**；`batch` 仅作人工速览分组（本迭代主交付 = 寻址契约 + 宿主 skill），调度依据是 `depends_on`。② **上下文摘要字数口径**：全字符（Unicode，含标点与空格）≤ 200（沿用 0019 阶段 4 的裁定口径）。③ 本 PR **不写规范条款**（不出现新判据 / 新约束）：记录文件的职责是留痕与索引，规范真源唯一（`pr-001`），越界即 N11 违反。
