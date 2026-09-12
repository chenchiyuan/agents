# SKILL.md v1.13.0 优化记录（对应规范 workflow-pb v0.10.0）

**变更点**：与规范 v0.10.0 同步——入口绑定改为寻址绑定（会话开工时解析并以绝对地址声明其迭代工作区，一切写入与 git 写操作按 `git -C <地址>` 显式寻址）；启动校验动作删除、硬停面收窄为工作区就绪性一处；`status.md` 与派发简报各加一行 `工作区地址` 字段；寻址纪律与落点语义区分以引用形态接入。逐条对应 §3.2 的各条目（`K-01`~`K-09`）：

- `K-01`（CRITICAL，槽位保留、语义换向）：由"会话必须在自己的迭代工作区内启动与运行"改为"会话开工时须**解析并以绝对地址声明**其迭代工作区（工作区不存在则由会话建立）；一切文件写入与 git 写操作按该地址显式寻址（`git -C <地址>`）；工作区无法确定或无法创建 → **唯一硬停**（不进入任何阶段、不产生任何写入，输出三行事实陈述，不含指向人的动作要求）。判据见规范 §规则 D / §规则 H"
- `K-02`（Step 0 第 1 步）：原"启动校验"改为"**工作区地址解析与声明**"（规范 §规则 D）——解析仓库主工作区 → 地址 = `<仓库主工作区>/.pb-agents/worktrees/{迭代ID}`（简报「工作区地址」字段存在时以其为准）；不存在则建立，成功即继续；无法确定或无法创建 → 唯一硬停
- `K-03`（Tools 第一项）：改为"启动时**解析并声明其迭代工作区地址**（见规范 §规则 D）与**角色来源解析**（见「§ 角色文件来源与部署」）"
- `K-04`（Important facts #6）：术语口径同步——"pr-planner 报告依赖图有环"这一类改称**流程结构错误**才中止（与工作区就绪性硬停并列、不互相替代）
- `K-05`（§Brief 构建规则字段块）：新增一行 `工作区地址：<绝对路径>`（阶段 1~4 = 该迭代的迭代工作区；阶段 5 = 该 PR 的 PR worktree）
- `K-06`（Step 5 步骤 2）：PR worktree 落点由"会话工作区内的相对路径"改为"**该 PR worktree 的绝对地址**"（按派发简报的「工作区地址」字段解析，以 `git -C <地址>` 创建）；子层、分支命名 `feat/{迭代编号}-pr-{NNN}-{slug}` 与 base（当前迭代的迭代分支）不变
- `K-07`（§文档协议）：新增一行"产物路径的判读基准 = 该会话**声明的工作区地址**（见规范 §文档路径协议）；本 skill 不重复该基准的措辞"
- `K-08`（Safety）：改写原启动校验类条目为"开工前必须已解析并声明工作区地址（规范 §规则 D）；无法确定或无法创建 → 唯一硬停（三行事实陈述，不含指向人 / 用户的动作要求）"；新增"不得把寻址纪律表述为『越界会被阻止』——跨工作区写入不可被 git 强制，只能事后核查（规范 §规则 F / §隔离边界声明）"
- `K-09`（description / 版本行 / Purpose + `data/`）：三处规范版本引用同步为 `workflow-pb v0.10.0`（版本行 = `**版本**: 1.13.0（对应规范 workflow-pb v0.10.0）`）；新建本记录 `data/skill-optimization-v1.13.0.md`；`memory.md` 追加索引行。判据：`grep -n 'v0\.9\.0' .claude/skills/workflow-pb/SKILL.md` = **0 命中**

**未改变的部分**：其余 9 条 CRITICAL；`## Purpose`（除版本数字）；`## Success criteria`；`## Strategy`；`## Important facts` 其余 8 条；`## Workflow` 的 Step 1~4、Gate 4→5、Step 5 其余步骤、Step 6；`## § 对外协议` 三组契约全文；`## § 用户决策点与暂停格式`；`## Safety` 中与寻址无关的条目；`§ 阶段执行卡片` 与阶段 5 三条角色路径；`## Resources` 其余行；`**变更历史**` 索引行（现状止于 v1.10.0，本次不补，避免产生无法归类的改动）。`tools/install-pb-agents.sh` 与仓库根 `.gitignore` **零改动**——本记录描述的仅是 SKILL 文本里的定位改写。

**一致性核对**：`SKILL.md` 与 `workflow-pb.md` v0.10.0 在以下关键点描述一致：

- 工作区地址的解析链与显式覆盖两侧一致（仓库主工作区 = `--git-common-dir` 的父目录；简报「工作区地址」字段优先）；SKILL 只写解析动作与章节引用，不重复契约措辞
- 硬停唯一（本会话工作区无法确定或无法创建）与三行事实陈述形态两侧一致
- 阶段 5 的 PR worktree 落点（该 PR worktree 的绝对地址）、分支命名与 base 两侧一致
- brief 字段行「工作区地址：<绝对路径>」两侧逐字同构
- 寻址纪律（规范 §规则 H）与落点语义区分句只在规范定义一处，SKILL 侧仅为引用行
- 改动后 `grep -n 'v0\.9\.0' .claude/skills/workflow-pb/SKILL.md` **0 命中**

**更正登记**（D-7）：`.claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` 的 `:13` 与 `:40` 两处 `§8.4` 引用已**就地**更正为 `architecture.md §8.4`。改了哪两处：① 含「措辞见规范 §8.4」的那一行；② 含缩略 `§8.4` 的那一行（以 `docs/iterations/0019-worktree-isolation-protocol/architecture.md` 开头的引用行）。改成什么：两处均就地显式化为 `architecture.md §8.4`——原写作「规范 §8.4」指向不存在的规范章节，而 `§8.4` 实为 `architecture.md` 的章节号。更正形态：就地改写，不新增旁注、不改叙述结构、不另起更正段；范围限于这两处，不做其他历史文件的引用核查、不批量统一引用体例。核对：`grep -n '8\.4' .claude/skills/workflow-pb/data/skill-optimization-v1.12.0.md` 恰 **2 行**；`grep -c 'architecture\.md[^0-9]*§8\.4' <该文件>` = **2**。

**关联文件**：

- `roles/workflow-pb/workflow-pb.md` v0.10.0「v0.10.0 变更说明」及「规则 C」~「规则 H」、「协议产物」、「约束主体」、「隔离边界声明」
- `roles/workflow-pb/data/workflow-pb-changelog.md` v0.10.0 条目
- `roles/workflow-pb/memory.md` v0.10.0 索引行
- `docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-stage6-20260912-200521.md`（偏差 D-7 原文要点）
- `docs/worktrees/README.md`（协议产物本体）
