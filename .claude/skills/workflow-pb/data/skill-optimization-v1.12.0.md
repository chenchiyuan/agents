# SKILL.md v1.12.0 优化记录（对应规范 workflow-pb v0.9.0）

**触发**：迭代 `0019-worktree-isolation-protocol`——并行会话共用一个工作树时，工作目录 / 索引 / HEAD 三个层面互相踩踏（0017 实测：一边切换分支、一边留下未提交改动，另一边读到的是混合状态）；同时 SKILL 把角色文件根路径固定为 `.pb-agents/roles/`，使"新工作区必须先跑一次安装脚本才能读到角色定义"成为运行前提，与"新工作区零动作即可开工"冲突；且新增会话工作区层后，裸 `worktree` 指的到底是会话层还是 PR 层不再单义。

**根因**：SKILL 里"会话的工作目录"从未被绑定到某个具体工作区——Step 0 只检查安装、不校验工作区；角色定义的读取来源被锚定在**被 git 忽略的部署副本**上，而不是随检出即得的被追踪内容；术语层面只有一层 worktree（PR 层），缺少会话层的限定词。

**方案**：与规范 v0.9.0 同步——① `:42` CRITICAL 语义反转为**来源契约**（真源 = 随检出即得的被追踪内容；`.pb-agents/roles/` 是下游业务项目副本；`tools/install-pb-agents.sh` 是面向下游的可选分发手段、不是运行前提）；② 新增 1 条 CRITICAL（会话必须在自己的迭代工作区内启动与运行，校验不通过即发现即停并输出创建命令）；③ Tools 与 Step 0 改为**启动校验**（判据引用规范 §规则 D）+ **角色来源解析**（`{角色定义根}` 一次解析、会话内复用、结果写入每次 brief）；④ `§ 角色文件路径与安装` 改名 `§ 角色文件来源与部署`（真源规则 + 两场景 + 解析动作 + 只读约束）；⑤ 全文 32 处 `.pb-agents/roles/...` → `{角色定义根}/...`；⑥ brief 阶段 5 模板行限定为「PR worktree 分支：{分支名}」；⑦ Step 5 步骤 2 补 PR worktree 落点引用；⑧ 新增一行隔离边界引用（只引用、不重复定义）；⑨ 三处规范版本引用同步为 v0.9.0。

**具体改动**：
- `:4` description「启动并驱动 pb 产品研发工作流（v0.8.0）」→「（v0.9.0）」
- `:30` `**版本**: 1.11.0（对应规范 workflow-pb v0.8.0）` → `1.12.0（对应规范 workflow-pb v0.9.0）`
- `:31` `**完整规范**` 路径行 → `{角色定义根}/workflow-pb/workflow-pb.md`（章节名引用同步为「§ 角色文件来源与部署」）
- `:42` CRITICAL 语义反转（槽位保留，措辞见规范 §8.4）
- CRITICAL 块新增 1 条：「会话必须在自己的迭代工作区内启动与运行——启动校验不通过 → 发现即停并输出可用于创建该迭代工作区的命令」
- `:50` 路径引用 → `{角色定义根}/workflow-pb/workflow-pb.md`
- `:58` Purpose「按 workflow-pb v0.8.0 规范调度」→ v0.9.0
- Tools `:96-97`：改为"启动时执行**启动校验**（判据引用规范 §规则 D）与**角色来源解析**"；删除"检测 `.pb-agents/roles/` 是否存在，不存在则提示执行安装脚本并停止"
- Tools 新增一行：「隔离边界（覆盖 / 不覆盖）与非 git 共享资源见规范 §隔离边界声明（只引用，不重复定义）」
- Step 0：原第 1 步「检查安装」→ 第 1 步「**启动校验**」（三判据 → 不通过则输出创建命令并发现即停）；新增第 2 步「**角色来源解析**」（原第 2 / 3 步顺延为第 3 / 4 步）
- `§ 角色文件路径与安装` → `§ 角色文件来源与部署`：真源规则 + 两场景（本仓库零动作 / 下游可选分发）+ 解析动作 + 只读约束；删除"未安装即停止"与"不得退回读 `roles/`"
- Step 5 步骤 2：补 PR worktree 落点引用（落 `<会话工作区>/.pb-agents/worktrees/{迭代编号}-pr-{NNN}-{slug}`、分支 `feat/{迭代编号}-pr-{NNN}-{slug}`、base 为迭代分支）；并发 / 解锁语义不变
- Brief 构建规则：`{读出的 .pb-agents/roles/<role>/<role>.md …}` 与 `工作流规范：…` 两行 → `{角色定义根}/…`；阶段 5 模板行 `worktree 分支：{分支名}` → `PR worktree 分支：{分支名}`
- § 阶段执行卡片：9 处「角色文件路径」+ 阶段 5 的 `planner` / `dev` / `verifier` 三条路径 → `{角色定义根}/…`
- `§ status.md 更新时机` / `§ history.md 更新时机` / Resources 两行 / Safety 两条：路径与来源表述同步（Safety 的"未安装即停止"改为"派发前必须已解析角色定义根路径"）
- 新建本记录与 `memory.md` 索引行

**未改变的部分**：其余 6 条 CRITICAL；`## Purpose`（除版本数字）；`## Success criteria`；`## Strategy`；`## Important facts`（9 条）；`## Workflow` 的 Step 1~4 / Gate 4→5 / Step 6；`## § 对外协议` 三组契约全文；`## § 用户决策点与暂停格式`；`## Safety` 中与工作区无关的条目；`:32` 变更历史索引行（现状已漏 v1.11.0，本次不补，避免产生无法归类的改动）。`tools/install-pb-agents.sh` 与仓库根 `.gitignore` **零改动**——本记录描述的仅是 SKILL 文本里的定位改写。

**一致性核对**：`SKILL.md` 与 `workflow-pb.md` v0.9.0 在以下关键点描述一致：
- 角色定义真源均为"被 git 追踪的内容"，判据均为 `git ls-files --error-unmatch`；SKILL 只写解析动作与章节引用，不重复契约措辞
- 启动校验判据均为三条 git 原语（`--show-toplevel` == cwd / `--git-dir` ≠ `--git-common-dir` / `--show-current` == `iteration/{迭代ID}`），不通过即发现即停并输出创建命令
- 阶段 5 的 PR worktree 落点、分支命名与 base 两侧一致
- brief 阶段 5 模板行两侧均为「PR worktree 分支：{分支名}」
- 隔离边界与非 git 共享资源只在规范 §隔离边界声明 定义一处，SKILL 侧仅为引用行
- 改动后 `grep -n 'v0\.8\.0' SKILL.md` 0 命中；`grep -n '\.pb-agents/roles' SKILL.md` 仅剩 2 行，均为"下游副本 / 可选分发手段"语境

**关联文件**：
- `roles/workflow-pb/workflow-pb.md` v0.9.0「v0.9.0 变更说明」及「规则 C」~「规则 G」、「隔离边界声明」、「角色定义来源与部署」
- `roles/workflow-pb/data/workflow-pb-changelog.md` v0.9.0 条目
- `docs/iterations/0019-worktree-isolation-protocol/architecture.md` §5.1-W10 / §5.2-S1~S10 / §8.4
