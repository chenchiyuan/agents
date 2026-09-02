# F05 — verifier 验证目标扩展

**功能 ID**: F05  
**来源**: demand.md §最小边界 #5  
**迭代**: 0003-workflow-scm

---

## 用户价值

让 verifier 角色在不修改自身角色文件的情况下，能够对 PR 粒度和文件范围进行标准化验证，保证 commit-planner 产出满足工作流质量标准。

---

## 验收标准

1. `roles/workflow-scm/workflow-scm.md`（F01 的产物）或 `roles/workflow-pb/workflow-pb.md`（F04 的产物）中，包含面向 verifier 的验证目标扩展说明，该说明覆盖以下两类验证目标：
   - **PR 粒度验证**：每个 PR 关联的 tasks 数量不超过规定上限 [model_inferred — 上限值需主 agent 确认]，且每个 PR 的验收标准可独立判断（不依赖其他 PR 完成）。
   - **文件范围验证**：PR 文件中声明的文件范围与 tasks.md 中对应任务的实际变更范围一致（无重叠、无遗漏）[model_inferred — "一致性"的判断方式由架构阶段确认]。
2. verifier 角色文件（`roles/verifier/verifier.md`）不被修改——验证目标扩展只通过工作流契约传递给 verifier，不写入 verifier 角色文件本身。
3. workflow-pb 或 workflow-scm 中，明确说明 verifier 在什么时机被触发来验证 commit-planner 的产出（路径和触发条件）。

---

## 边界（不包含）

- 不要求 verifier 验证 PR 合并后的代码质量（那是 dev 实现阶段的职责）。
- 不要求 verifier 验证 GitHub/GitLab 上的 PR 状态（本迭代无 API 对接）。
- 不要求修改 verifier 角色文件本身。

---

## model_inferred 标注

**[主 agent 确认 2026-09-02]** 不设 tasks 数量硬上限，以"预估 diff < 400 行"为粒度判断标准。verifier 验证行数估算合理性，不核查 tasks 数量。

**[主 agent 确认 2026-09-02]** 文件范围一致性采用静态声明对比：verifier 将实际 diff 覆盖文件与 PR 文件中声明的文件范围核对，不依赖运行时数据。

---

## 架构维度

**AR-04 已填（2026-09-02）**

主 agent 派发 verifier 时，brief 中直接内联 workflow-scm.md 相关章节内容作为验证标准；verifier 角色文件和现有契约不做任何修改。

brief 结构（示意）：

```
产出物路径: docs/iterations/{id}/prs/
验证标准:
  [内联自 workflow-scm.md §验证目标]
  1. PR 粒度：预估 diff < 400 行；验收标准可独立判断（不依赖其他 PR 完成）
  2. 文件范围：PR 文件声明的文件范围与 tasks.md 对应任务的实际变更范围核对，
              采用静态声明对比（无重叠、无遗漏）
```

verifier 现有契约接收"产出物路径 + 验证标准"两件事，标准内联传入是最直接的复用，不引入 verifier 主动读取外部文件的新模式（避免"规范文件"与"执行上下文"边界歧义）。

见 `architecture.md §四 AR-04`。
