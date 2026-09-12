# workflow-pb skill 记录索引

> 每行对应 `data/` 下的一条原始凭证。

- [v1.13.0 优化记录](data/skill-optimization-v1.13.0.md) — 入口绑定改为寻址绑定：会话开工时解析并以绝对地址声明其迭代工作区、一切文件写入与 git 写操作按 `git -C <地址>` 显式寻址；启动校验动作删除、硬停收窄为工作区就绪性一处；`status.md` 与派发简报各加一行 `工作区地址` 字段；SKILL 侧逐条同步（`K-01` CRITICAL 槽位保留、语义换向，Step 0 第 1 步改为工作区地址解析与声明，Tools / Important facts 术语口径 / §文档协议引用行 / §Brief 构建规则字段块 / Step 5 步骤 2 的 PR worktree 落点 / Safety 两处，三处规范版本引用同步为 v0.10.0）；含 D-7 更正登记（`skill-optimization-v1.12.0.md` 两处 `§8.4` 引用就地更正为 `architecture.md §8.4`）
- [v1.12.0 优化记录](data/skill-optimization-v1.12.0.md) — 会话工作区层与来源契约同步（对应规范 v0.9.0）：`:42` CRITICAL 语义反转为来源契约（真源 = 随检出即得的被追踪内容，安装脚本降级为面向下游的可选分发手段）、新增 1 条启动校验 CRITICAL、Step 0 改两步（启动校验 + 角色来源解析）、章节改名「§ 角色文件来源与部署」、32 处 `.pb-agents/roles/...` 路径引用改为 `{角色定义根}/...`、brief 阶段 5 模板行限定为「PR worktree 分支」、三处规范版本引用同步为 v0.9.0
- [v1.11.0 优化记录](data/skill-optimization-v1.11.0.md) — 新增"迭代分支"中间层（`main ← 迭代分支 ← PR worktree 分支`），11 处"主分支"术语替换为"当前迭代的迭代分支"/"迭代分支"，确保所有合并目标/解锁判据/worktree base 引用均指向迭代分支而非 main，与 workflow-pb.md v0.8.0 保持一致
- [v1.10.0 优化记录](data/skill-optimization-v1.10.0.md) — 新增「§ history.md 更新时机」一节 + Tools/Important facts/Safety 三处补充，与 workflow-pb.md v0.7.0「历史记录协议」保持一致
- [v1.1.0 优化记录](data/skill-optimization-v1.1.0.md) — 内联小节改纯指针 + 补阶段→角色映射表，根因和决策过程
- [v1.2.0 优化记录](data/skill-optimization-v1.2.0.md) — 补角色文件路径解析（`roles/` vs `.pb-agents/roles/` 两种部署场景），根因和决策过程
- [v1.3.0 优化记录](data/skill-optimization-v1.3.0.md) — 同步规范"需求问题只搭置不回退"新协议：阶段1硬性前置、执行角色直接写 deferred-demand-changes.md、主 agent 不代为判断和记录
