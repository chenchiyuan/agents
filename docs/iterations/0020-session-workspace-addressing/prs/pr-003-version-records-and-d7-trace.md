# pr-003-version-records-and-d7-trace

## 上下文摘要

落 v0.10.0 / v1.13.0 的两侧惯例留痕：规范侧 changelog 条目与 memory 索引行、SKILL 侧新记录 `skill-optimization-v1.13.0.md`（含 D-7 就地更正的「更正登记」段）与 memory 索引行；不新建文档类型，沿用既有体例。

## 涉及功能点

- F11（supersede 逐句显式声明：changelog 条目内的**被取代清单 / 保留清单**与规范 `## v0.10.0 变更说明` 同源，读规范的人与读 changelog 的人拿到同一份逐句清单）
- F15（0019 E 项承接三分类与留痕：changelog 条目与 SKILL 新记录承接保留 / 改写 / 新增三分类的登记面）
- F16（0018 活指令失效登记的留痕面：changelog 条目的备案段镜像"0018 文件不改写、其前置句已失效"）
- F18（D-7 承接的**留痕面**：新记录「更正登记」段——改了哪两处、改成什么；更正本体在 `pr-004`）

## 文件范围

- `roles/workflow-pb/data/workflow-pb-changelog.md`（**追加**）：头部新增 `## v0.10.0（2026-09-12）` 条目——**段构成与段序一律以 `architecture.md` v1.1.4 §8.3 表 B 为唯一真源，本 PR 不复述段序**；其中 §8.3 表 B 的第 6 段需逐条覆盖 `pr-001` 的规范侧与 SKILL 侧改动（含版本号迁移句）、第 7 段内容同 §9.1 / §9.2 与 F16；既有 v0.2.0~v0.9.0 条目**逐字不动**
- `roles/workflow-pb/memory.md`（**追加**）：在**既有最新版本行之上（置顶）**插入 v0.10.0 索引行——既有最新版本行 = **以 `- **v0.9.0（2026-09-12）**` 起首的那一行**（该文件以 frontmatter 起首、随后为标题行，**新行不插到文件首行**）；格式与 v0.9.0 行同构；既有行逐字不动
- `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md`（**新建**）：**段名与段数一律以 `architecture.md` v1.1.4 §8.3 的落点表为准（本 PR 不复述）**；体例沿用 `data/skill-optimization-v1.12.0.md` 的先例精神（粗体段名 + 段间空行 + 逐条可核对 + 首行版本对声明行；该先例的实际段构成见其文件自身，不在本 PR 复述）；「更正登记」段为本记录新增段，需写明**改了哪两处、改成什么**（两处 = `skill-optimization-v1.12.0.md` 中**含「措辞见规范 §8.4」的那一行**与**含缩略 `§8.4` 的那一行（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行）**；可用 `grep -n '8\.4' .claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` 核对恰为两行）
- `.claude/skills/workflow-pb/memory.md`（**追加**）：在**既有最新版本行之上（置顶）**插入 v1.13.0 索引行，指向 `data/skill-optimization-v1.13.0.md`——既有最新版本行 = **以 `- [v1.12.0 优化记录]` 起首的那一行**（该文件首行为标题、随后为说明引用行，**新行不插到文件首行**）；既有行（含 v1.12.0 行）逐字不动

**不涉及（零改动面）**：`roles/workflow-pb/workflow-pb.md` 与 `.claude/skills/workflow-pb/SKILL.md`（属 `pr-001`）；`docs/worktrees/README.md`（属 `pr-002`）；`.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**就地更正由 `pr-004` 承担**，本 PR 只登记该更正的事实）；`.claude/skills/workflow-pb/data/` 下的其它历史版本记录（历史记录不改）；`roles/workflow-pb/data/` 的其余三个非版本文件；`.gitignore`、`tools/**`、`oamp/**`、`principles/**`、任何执行角色文件。

## 验收标准

- [ ] **changelog 条目（F11 验收 1~2 / F15 验收 1~4 / F16 验收 2）**：`roles/workflow-pb/data/workflow-pb-changelog.md` 中含以 `## v0.10.0（2026-09-12）` 起首的条目——**段构成与段序一律以 `architecture.md` v1.1.4 §8.3 表 B 为唯一真源，本 PR 不复述段序**；判据 = ① 段构成与 §8.3 表 B 一致；② 「被取代清单」逐句引 v0.9.0 原句（章节 + 原句，不用行号，同 §8.3-T-07 的句级引用方式）、「保留清单」覆盖 §7.2 的六组、「未改变的部分」覆盖 §3.5 的零改动面、表 B 的第 6 段逐条对应 `pr-001` 的 `N-01`~`N-21` 与 `K-01`~`K-09`；③ 表 B 的第 7 段内容同 §9.1 / §9.2 与 F16
- [ ] **备案段镜像（F15 验收 3 / F16 验收 2）**：changelog 条目的**§8.3 表 B 第 7 段**与规范 `## v0.10.0 变更说明` 的**§8.3 表 A 第 6 段**（两处段名均为「备案」）**内容同源**（**两处段序以 §8.3 表 A / 表 B 为唯一真源，本 PR 不复述**）——① 0019 E 项三分类（保留 E1~E4 / E6 / E7 / E9~E13、改写 E5 与 E8、**明确登记为两条新增**）；② `0018/status.md` 的「操作前置（宿主限制，必须由用户执行）」句已失效的登记，且**不含**"0018 需回改 / 本迭代将修改 0018 文件"类表述（F16 验收 5），`docs/iterations/0018-*/**` 在本 PR 的改动清单中 0 命中（F16 验收 1）
- [ ] **memory 索引行（F15）**：`roles/workflow-pb/memory.md` 与 `.claude/skills/workflow-pb/memory.md` 各自在**既有最新版本行之上（置顶）**新增对应版本索引行（v0.10.0 / v1.13.0），格式与既有行一致——落点判据（引文式）：`roles/workflow-pb/memory.md` 的新行应紧邻**以 `- **v0.9.0（2026-09-12）**` 起首的那一行之前**；`.claude/skills/workflow-pb/memory.md` 的新行应紧邻**以 `- [v1.12.0 优化记录]` 起首的那一行之前**；两文件首行 / 文件头（frontmatter、标题行）**不被占用**；两文件既有行**逐字不动**（`git diff` 中仅新增行、无删除与改写）
- [ ] **SKILL 新记录（F15 / F18 验收 3）**：新建 `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md`——**段名与段数一律以 `architecture.md` v1.1.4 §8.3 的落点表为准（本 PR 不复述）**；判据 = ① 该文件首行的版本对声明与 `SKILL.md` 的版本行一致；② 「更正登记」段可追溯到"改了哪两处（引文式：`skill-optimization-v1.12.0.md` 中含「措辞见规范 §8.4」的那一行、以及含缩略 `§8.4` 的那一行（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行））、改成什么"，且与实际落地文本一致（其落地由 `pr-004` 承担，`depends_on` 已声明）
- [ ] **记录体例与零改动面（F13 验收 3）**：不新建除 `skill-optimization-v1.13.0.md` 之外的任何文档类型；`data/skill-optimization-v1.12.0.md` 在本 PR 的 diff 中 **0 hunk**（该文件的改动归 `pr-004`）；`roles/workflow-pb/workflow-pb.md`、`.claude/skills/workflow-pb/SKILL.md`、`docs/worktrees/README.md` 在本 PR 的 diff 中 **0 hunk**；改动清单不含 `.sh`、`tools/**`、`.gitignore`、`oamp/**`、任何执行角色文件；**`K-09` 的跨 PR 归属（阶段 6 归类用；Gate r2 偏差 D-8）**：`K-09` = ① `SKILL.md` 内三处版本引用（**归 `pr-001`**）+ ② 本 PR 新建 `data/skill-optimization-v1.13.0.md` + ③ 两侧 `memory.md` 索引行（② ③ **归本 PR**）——阶段 6 逐 hunk 归类按此拆分归属，**不视为「无法归类的 hunk」**

> **独立性读法（阶段 4 主 agent 裁定，2026-09-12）**：本节全部验收条目的独立判定时点 = 本 PR 的 `depends_on`（`pr-001` + `pr-004`）**全部合并之后**；「独立性」不得读作"任何时刻都不需要其他 PR"，也不得读作需要任何**未声明**的外部条件。依据：规范《验证目标·PR 粒度判断框架》的「**独立性**：验收标准可在不依赖其他 PR 合并的情况下判断」句，按阶段 4 主 agent 的生效读法适用（该读法附加：不得读作需要任何**未声明**的外部条件）；且规范《验证目标·依赖正确性验证》的「**通过条件**：所有 `depends_on` 条目均有证据支撑；依赖图无环；PR 间文件范围无重叠、无遗漏功能点」为通过项判据；阶段 6 复核时不再按字面复判——本 PR 第 1 / 2 / 4 条（changelog 条目 / 备案段同源 / 更正登记与实际落地一致）即该读法下的**依赖序内可判**条目，第 3 / 5 条为纯结构判据。

## 参考资料

- `docs/iterations/0020-session-workspace-addressing/architecture.md` **v1.1.4**（**本 PR 的直接验收基准**；v1.1.4 未落盘时以 v1.1.3 为准）：§3.4（`O-01` / `O-02` / `O-04`）、§3.5 零改动清单、§3.6 版本一致性判据、§8.3 的「其余落点」表与段构成裁定（表 A / 表 B）、§9.1 / §9.2。**段序 / 段数一律以 architecture v1.1.4 §8.3 为准，本 PR 不复述**
- `roles/workflow-pb/data/workflow-pb-changelog.md` 的 **v0.9.0 条目**（引文式定位：**以 `## v0.9.0（2026-09-12）` 起首、以下一个 `## ` 级条目为界**）= 本 PR 追加条目的体例先例；其段序依据与逐段行号**见 `architecture.md` v1.1.4 §8.3 表 B 后的「段序依据（changelog 侧）」行，本 PR 不复述**；其中「头部版本号 `0.8.0` → `0.9.0`」与「`.claude/skills/workflow-pb/SKILL.md` 同步（v1.11.0 → v1.12.0）」两句即本 PR 与 `pr-001` 的文本耦合证据
- `roles/workflow-pb/memory.md`（**既有最新版本行 = 以 `- **v0.9.0（2026-09-12）**` 起首的那一行 = 新行格式与落点先例**）；`.claude/skills/workflow-pb/memory.md`（**既有最新版本行 = 以 `- [v1.12.0 优化记录]` 起首的那一行 = 新行格式与落点先例**）
- `.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md`（**体例先例**：其实际段构成见该文件自身，**本 PR 不复述**；含首行版本对声明行与两处待更正引用——引文式：含「措辞见规范 §8.4」的那一行、含缩略 `§8.4` 的那一行（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行））
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-stage6-20260912-200521.md`（偏差 D-7 原文要点）
- `docs/iterations/0020-session-workspace-addressing/prs/pr-001-addressing-contract-and-host-skill.md`（本 PR 所登记改动的出处）；`prs/pr-004-d7-reference-correction.md`（本 PR「更正登记」段所登记更正的实际落地 PR）

## depends_on

- **pr-001-addressing-contract-and-host-skill.md**（理由：本 PR 四份文件的内容是 `pr-001` 改动的**记录 / 索引**，逐处引用 `pr-001` 落地后才成立的标识与文本——三条证据（均以引文 / 检索式定位）：① `roles/workflow-pb/data/workflow-pb-changelog.md` 的 v0.10.0 条目以 `## v0.10.0（2026-09-12）` 起首，其「具体改动」段按既有体例必须写出「头部版本号 `0.9.0` → `0.10.0`」与「`.claude/skills/workflow-pb/SKILL.md` 同步（v1.12.0 → v1.13.0）」两句（对照 v0.9.0 条目内同两句的原文——**句级引用**：`头部版本号 \`0.8.0\` → \`0.9.0\`` 与 `\`.claude/skills/workflow-pb/SKILL.md\` 同步（v1.11.0 → v1.12.0）`；两句可分别用 `grep -n '头部版本号 \`0.8.0\` → \`0.9.0\`' roles/workflow-pb/data/workflow-pb-changelog.md` 与 `grep -n '同步（v1.11.0 → v1.12.0）' roles/workflow-pb/data/workflow-pb-changelog.md` **唯一定位**），这两个标识由 `pr-001` 产生；② `.claude/skills/workflow-pb/data/skill-optimization-v1.13.0.md` 的变更点是 `K-01`~`K-09` 的逐条记录（版本对"对应规范 workflow-pb v0.10.0"须与 `SKILL.md` 的版本行一致），其内容与 `pr-001` 的 SKILL diff 是**同一内容的两次落盘**；③ `.claude/skills/workflow-pb/memory.md` 索引行与 `roles/workflow-pb/memory.md` 索引行均描述 `pr-001` 的改动摘要。`pr-001` 未落地时，两处版本标识与全部变更点描述均为空指（记录先于被记录对象）。)
- **pr-004-d7-reference-correction.md**（理由：本 PR 的 `skill-optimization-v1.13.0.md` 含「更正登记」段，其内容是"`skill-optimization-v1.12.0.md` 的两处引用已就地更正为 `architecture.md §8.4`"这一**对另一文件状态的陈述**（F18 验收 3 的留痕面）；两处 = 含「措辞见规范 §8.4」的那一行、与含缩略 `§8.4` 的那一行（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行）；`pr-004` 未落地时该登记为不实陈述。故登记方等被登记方落地（对应 `architecture.md` §9.2 把 D-7 的纳入面拆为 `O-03`（更正）+ `O-04`（留痕）两处落点的分工）。)

> **未声明的依赖（逐条说明为何无证据）**：① 本 PR 与 `pr-002`（`docs/worktrees/README.md`）**无边**——changelog 条目在「方案」段会把该产物列为本次变更集的一项（与规范 `### 协议产物` 条款的声明同源，是**变更集枚举**，不是对产物内容的复制：产物侧各节的正文、区分句、边界声明均不被本 PR 重述）；② 本 PR 不构成 `pr-001` / `pr-002` 的上游。
> **依赖图全貌**：`pr-001 → pr-002`、`pr-001 → pr-003`、`pr-004 → pr-003`，**无环**；`pr-001` 与 `pr-004` 互不依赖。**独立性读法**：本 PR 的验收条目在其 `depends_on` 全部合并后独立判定（见「验收标准」段末注记；第 1 / 2 / 4 条为依赖序内可判条目）。

## batch

1

> **备注**：① 本 PR 与 `pr-001` / `pr-002` / `pr-004` 的文件范围**零交集**；`batch` 仅作人工速览分组（本迭代主交付 = 寻址契约 + 宿主 skill），调度依据是 `depends_on`。② **上下文摘要字数口径**：全字符（Unicode，含标点与空格）≤ 200（沿用 0019 阶段 4 的裁定口径）。③ 本 PR **不写规范条款**（不出现新判据 / 新约束）：记录文件的职责是留痕与索引，规范真源唯一（`pr-001`），越界即 N11 违反。④ **引用体例**：一律「节名 + 原句（或检索式）」，**不使用行号**；`architecture.md` 的行号 / 段序 / 位置口径若与本节引用相抵，**一律以 architecture 的结论句为准**。
