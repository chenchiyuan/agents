# workflow-pb skill 记录索引

> 每行对应 `data/` 下的一条原始凭证。

- [v1.11.0 优化记录](data/skill-optimization-v1.11.0.md) — 新增"迭代分支"中间层（`main ← 迭代分支 ← PR worktree 分支`），11 处"主分支"术语替换为"当前迭代的迭代分支"/"迭代分支"，确保所有合并目标/解锁判据/worktree base 引用均指向迭代分支而非 main，与 workflow-pb.md v0.8.0 保持一致
- [v1.10.0 优化记录](data/skill-optimization-v1.10.0.md) — 新增「§ history.md 更新时机」一节 + Tools/Important facts/Safety 三处补充，与 workflow-pb.md v0.7.0「历史记录协议」保持一致
- [v1.1.0 优化记录](data/skill-optimization-v1.1.0.md) — 内联小节改纯指针 + 补阶段→角色映射表，根因和决策过程
- [v1.2.0 优化记录](data/skill-optimization-v1.2.0.md) — 补角色文件路径解析（`roles/` vs `.pb-agents/roles/` 两种部署场景），根因和决策过程
- [v1.3.0 优化记录](data/skill-optimization-v1.3.0.md) — 同步规范"需求问题只搭置不回退"新协议：阶段1硬性前置、执行角色直接写 deferred-demand-changes.md、主 agent 不代为判断和记录
