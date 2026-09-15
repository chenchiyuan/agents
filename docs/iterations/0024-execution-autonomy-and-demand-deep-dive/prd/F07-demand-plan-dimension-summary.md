# F07 · demand.md Plan 阶段改为按已确认维度做调研摘要

**来源**：demand.md 做什么#5（Plan 部分）

## 用户价值

用户能看到 demand 角色在真正开始提问前，已经针对反射出来的每个维度做过一轮摘要性梳理，提问不是临场现想，而是有备而来。

## 验收标准

1. `demand.md` 的"Plan（计划）"章节文字，改为以 [F06](F06-demand-align-role-reflection.md) 反射出的维度列表为输入，对每个维度产出一段调研摘要（现状已知什么、缺口在哪）。
2. 该章节不再以旧版固定的六维诊断作为 Plan 阶段的调研对象——六维诊断的角色收窄为 Verify 阶段的验收清单（见 [F09](F09-demand-verify-checklist-decoupled.md)），Plan 阶段的调研对象是 [F06](F06-demand-align-role-reflection.md) 反射出的维度。
3. 调研摘要在 Work 循环开始前产出，作为 Work 循环挑选"当前深挖维度"的依据之一。

## 边界（不包含）

- 不规定调研摘要的具体篇幅或格式模板。**[架构已填]**：每个维度一段，100~200字，含"现状/缺口/优先级"三段式结构，与demand.md现有"草稿更新/理由"提案格式同构。理由见 `architecture.md` §变更映射 F07。
- 不改变 Plan 阶段"缺输入需求时停下报告"这类既有安全约束（demand.md 现有机制不动）。

## model_inferred

- **验收标准第3条**："调研摘要作为 Work 循环挑选深挖维度的依据"是从"Plan 在 Work 之前、且两者必须有信息传递关系才有意义"这一流程逻辑推导出的，demand.md 原文未逐字写明这一衔接关系，需要主 agent 确认。
