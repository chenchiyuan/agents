# 过程级案例：workflow-pb v0.2.0/v0.2.1 重构 + pr-planner/progress-observer 创建

**日期**: 2026-09-02
**归属类型**：过程级案例（主 agent 在会话中的设计/执行行为）
**范围**: workflow-pb 从 7 阶段精简到 6 阶段并并入 workflow-scm；新增 pr-planner、progress-observer 两个角色
**注**：本文件原名 `retro-2026-09-02-workflow-pb-v2.md`，2026-09-02 归属重整时拆分——"反射意图落盘偏离"和"独立验证有效性证据"两条移至 `.claude/skills/create-role/data/`（这两条说的是 create-role skill 的行为，不是主 agent 会话行为）；"0004遗留问题闭环"移至 `roles/pr-planner/data/pr-planner-reflection.md`（该角色本身就是这个问题的解法，记在解法自己的 data/ 更贴切）。本文件保留唯一真正的主 agent 过程级案例，理由见 `retrospective-changelog.md` v0.3.0。

---

## 案例：多轮讨论持续收敛，每轮都做代码调研而非臆测（好做法，第 2 次独立出现）

**做了什么**：本次设计经过至少 5 轮讨论收敛（从"改调度措辞"→"新增反射角色"→"合并角色"→"废除全局 tasks.md"→"workflow-scm 并入 workflow-pb"），每轮推进前都先读相关代码/文档再回应，不臆测。

**为什么有效**：`process-2026-09-02-workflow-pb.md` 案例 4 已经记录过同一模式（"方案空间大时先提边界问题再设计"），这是该模式的第 2 次独立出现。

**候选原则**（**已达升级条件：3 问通过 + 2 次独立出现**）：遇到方案空间大的设计任务，先做必要的代码/文档调研消除歧义，再基于用户已确认的每一轮结论继续深化方案，不臆测跳过调研直接产出下一版方案。

三问：①三个月后成立？✓ ②换场景适用？✓ ③一句话可执行？✓

**处置**：已达到升级条件，是否正式升级为 `principles/execution/core-principles.md` 的新条目，留给用户在 Phase 2 讨论中决定；本记录先归档，升级动作等用户明确表态。
