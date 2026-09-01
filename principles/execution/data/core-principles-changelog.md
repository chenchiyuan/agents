---
name: core-principles-changelog
description: principles/execution/core-principles.md 的变更历史：需求/原因/决策过程/经验总结
type: changelog
---

# core-principles.md 变更历史

---

## v0.2.0（2026-09-01）

**需求**：agent-design-protocol.md v0.7.0 新增「三大基础方法论」章节，其中 P-E-V-F-R（Plan-Execute-Verify-Fix-Reflect）被确立为项目地基，不限于"设计 agent"这个元任务，同样适用于所有角色执行具体任务的场景。需要在起草库里体现，让未来新建的角色能继承这条。

**变更原因**：v0.1.0 的起草库只有"验证优先"条目，说的是"先写测试再写实现"（TDD 导向），没有覆盖 P-E-V-F-R 这个更宏观的五阶段闭环——两者不是重复，验证优先说的是代码层的测试实践，P-E-V-F-R 说的是任务级的闭环结构。

**决策过程**：新增「Harness 循环闭环（Plan-Execute-Verify-Fix-Reflect）」小节，说明五阶段定义、独立验证硬约束、Fix-Verify 必须配对、Reflect 留痕要求，并标注"适用场景：任何任务，无条件"。

**经验总结**：起草库条目的粒度要和角色实际执行的决策粒度对齐——TDD 和 P-E-V-F-R 是两个不同层次的原则，都重要，不能用一条覆盖另一条。

---

## v0.1.0（2026-09-01）

**需求**：项目启动，需要执行原则起草库，供新建角色时挑选复制用。基于 powerby-skills/docs/consitution.md 一次性借鉴提炼。

**变更原因**：新文件，无前版本。

**决策过程**：从 consitution.md 提炼通用执行原则（红线/理解优先/简单优先/外科手术式精准/验证优先/失败处理/边界纪律/交付标准），去掉 powerby-skills 专属的产品研发流程描述，每条补写"适用场景"帮助新角色判断是否需要复制这条。

**经验总结**：起草库的"适用场景"标注是关键——没有它，所有条目看起来都该被复制，结果新角色的原则章节变成全量粘贴，失去针对性。
