# workflow-pb skill 记录索引

> 每行对应 `data/` 下的一条原始凭证。

- [v1.12.0 优化记录](data/skill-optimization-v1.12.0.md) — 会话工作区层与来源契约同步（对应规范 v0.9.0）：`:42` CRITICAL 语义反转为来源契约（真源 = 随检出即得的被追踪内容，安装脚本降级为面向下游的可选分发手段）、新增 1 条启动校验 CRITICAL、Step 0 改两步（启动校验 + 角色来源解析）、章节改名「§ 角色文件来源与部署」、32 处 `.pb-agents/roles/...` 路径引用改为 `{角色定义根}/...`、brief 阶段 5 模板行限定为「PR worktree 分支」、三处规范版本引用同步为 v0.9.0
- [v1.11.0 优化记录](data/skill-optimization-v1.11.0.md) — 新增"迭代分支"中间层（`main ← 迭代分支 ← PR worktree 分支`），11 处"主分支"术语替换为"当前迭代的迭代分支"/"迭代分支"，确保所有合并目标/解锁判据/worktree base 引用均指向迭代分支而非 main，与 workflow-pb.md v0.8.0 保持一致
- [v1.10.0 优化记录](data/skill-optimization-v1.10.0.md) — 新增「§ history.md 更新时机」一节 + Tools/Important facts/Safety 三处补充，与 workflow-pb.md v0.7.0「历史记录协议」保持一致
- [v1.1.0 优化记录](data/skill-optimization-v1.1.0.md) — 内联小节改纯指针 + 补阶段→角色映射表，根因和决策过程
- [v1.2.0 优化记录](data/skill-optimization-v1.2.0.md) — 补角色文件路径解析（`roles/` vs `.pb-agents/roles/` 两种部署场景），根因和决策过程
- [v1.3.0 优化记录](data/skill-optimization-v1.3.0.md) — 同步规范"需求问题只搭置不回退"新协议：阶段1硬性前置、执行角色直接写 deferred-demand-changes.md、主 agent 不代为判断和记录
