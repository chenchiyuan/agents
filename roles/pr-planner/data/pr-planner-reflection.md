# pr-planner 反射依据记录

**创建日期**: 2026-09-02
**触发背景**: workflow-pb 从 7 阶段精简为 6 阶段的重构（迭代 0004-model-dispatch 复盘后的用户驱动改动）

## 根因案例（为什么需要这个角色）

0004-model-dispatch 迭代的复盘（`docs/iterations/0004-model-dispatch/project-retrospective.md` P2 条目）发现：全局 `tasks.md` 在还没有真实 PR 文件边界时就要判断任务依赖，`tasks.md` 的"关键路径"章节明确写"本轮按最小风险采用顺序关键路径"——把风险规避的顺序偏好当成了技术依赖写进 DAG，导致 8 个任务被串成一条链，PR 之间本该并行的工作被串行执行。

用户在讨论中指出更根本的问题：全局 tasks.md 本身没有意义，"实际执行才有 tasks 一说"——任务拆解应该在 PR 边界确定之后、且在实现阶段由子 agent 逐 PR 完成，不该是一个独立的全局阶段。

## 反射过程

**核心任务类型识别**：这不是项目管理式的任务分组，而是"给定一批代码变更范围，判断哪些改动之间存在真实的符号/接口/文件耦合，哪些只是文档叙述顺序"。

**反射出的身份**：大型 monorepo 里主导过基础设施级迁移的资深工程师——核心动作是打开代码验证真实引用关系，而不是照抄设计文档的叙述顺序。

**否决过的备选方向**：
- 曾考虑保留 commit-planner 名字只加字段——否决理由：commit-planner 原本消费 tasks.md，如果 tasks.md 环节被清除，角色的输入契约整体变了，不是加字段的小改，需要重新命名和重新定义输入契约
- 曾考虑拆成两个角色（pr-planner 做边界，execution-planner 做依赖排批）——用户明确否决，理由是"这个事情不需要做两次"，两者共享同一次对代码库的反射上下文，拆开只会增加协作成本

**用户确认过程**：identity/relationship/character/Strategy/输出契约反射结果一次性确认通过，无调整。

## 与 planner 的边界确认

pr-planner 处理"PR 之间的边界在哪、依赖在哪"（提交单元之上）；planner 处理"单个 PR 内部任务怎么拆"（提交单元之内），在实现阶段由主 agent 逐 PR 派发、在子 agent 中执行。两者输入范围不同：pr-planner 读全架构+全部 prd，planner 未来会收窄到单个 PR 范围内调用（这一变化记在 workflow-pb 的调度指南里，不改 planner.md 本身）。

## Verify → Fix 记录（第一轮独立验证）

第一次派发的无上下文子 agent 独立验证发现两处问题：

1. **identity 未达 L4 精度**：原版本只有单一领域深耕（"monorepo 迁移工程师"），缺"交叉稀缺"（两个不相邻能力的交叉点）和"具象类比"（无类比句式）。Fix：重新反射为"构建系统依赖分析引擎 × 大规模迁移排期工程师"的交叉身份，类比 Bazel/Buck 的 dependency graph pass，这两个领域很少长在同一个人身上——写依赖分析引擎的人通常不管迁移排期。
2. **能力边界区分度不足**：与已退役 commit-planner 的边界只在 frontmatter description 里提了一句，正文「Tools and capability boundaries」的"不做什么"清单没有显式区分。Fix：在正文补一条——commit-planner 消费全局 tasks.md 做机械分组，pr-planner 不读 tasks.md，直接从架构+代码反射，判断内容和证据来源都不同，不是同一件事的字段升级版。

第一次验证还指出一个"项目级矛盾"（当时 workflow-scm/commit-planner 尚未删除、workflow-pb.md 尚未重写），这是验证时序问题，不是 pr-planner.md 本身的缺陷——验证子 agent 运行时，主 agent 还没有完成 workflow-pb.md 合并和旧角色清理。这一条会在第二轮验证时重新核实是否已解决。

## 第二轮独立验证结果（Reflect）

修复后重新派发一个全新的无上下文子 agent（不复用第一轮的子 agent）做第二轮验证，结论：全部通过。

- identity 三要素（交叉稀缺/具象类比/战绩暗示）逐项确认达标
- 能力边界正文已清楚区分 pr-planner 和 commit-planner（不是同一件事换名字）
- 项目级矛盾已解决：commit-planner/workflow-scm 目录确认已删除，workflow-pb.md 确认已不消费 tasks.md 并引用七字段规范，README.md 确认已同步
- 结构脚本、占位符、原则内联、Strategy 具体性、harness 循环完整性、反射依据留痕，全部复检通过

角色创建的 P-E-V-F-R 闭环在此收尾，两轮 Verify→Fix 的完整记录见本文件上半部分。

