# retrospective 角色记录索引

一行一条，先看这里判断相关性再展开读 `data/` 里的具体记录。

**归属说明（v0.3.0 起）**：本索引只覆盖 retrospective 自己的 changelog/reflection，以及"过程级案例"（主 agent 在会话中的设计/执行行为，不属于任何具体角色执行任务）和"跨角色案例"（涉及 3+ 角色无法归到单一角色）。能定位到具体角色的复盘发现已按归属移到对应角色的 `data/`，不在此列——比如 verifier 相关的假阳性案例在 `roles/verifier/data/`，工作流协议设计案例在 `roles/workflow-pb/data/`，create-role skill 行为案例在 `.claude/skills/create-role/data/`。判断规则见 `retrospective.md` §归档执行「归属判断」。

<!-- 格式: - [[记录文件名（不含 .md）]] - 一句话摘要 -->

- [[retrospective-changelog]] - retrospective.md 各版本变更历史（v0.1.0 创建 / v0.2.0 从记录管理员重写为复盘引导者 / v0.3.0 补归属判断规则）
- [[retrospective-v02-reflection]] - v0.2.0 重写的反射依据：为什么改定位、三问过滤的设计来源、两阶段模式的来源
- [[process-2026-09-02-workflow-scm]] - 过程级案例：model_inferred填空脱离元思想、批量修改逐一验证第1次出现
- [[process-2026-09-02-model-dispatch]] - 过程级案例：未来任务误读为当前授权、范围纠正后完整回退、追溯链完整性
- [[process-2026-09-02-workflow-pb]] - 过程级案例：设计讨论未落澄清记录、去耦合双类检查、批量修改逐一验证第2次出现（**接近升级门槛**）、边界问题先于方案第1次出现
- [[process-2026-09-02-workflow-pb-v2]] - 过程级案例：**"先调研再深化方案"第2次独立出现，已达三问+2次门槛，待用户 Phase 2 表态**
- [[process-2026-09-03-workflow-pb-skill-optimization]] - 过程级案例：中途误加未获批改动后自查撤销、长文件Write被截断未提前分段、双部署场景漏检直到用户第二轮指出、边界问题先于方案第4次出现（用户选择先记案例，暂不升级）
- [[retro-2026-09-05-0005-0006]] - **Phase 1 扫描报告原始存档，尚未归属拆分/尚未 Phase 2 讨论**：0005+0006 迭代，5 个问题（子agent静默停滞/写入只读部署副本第2次出现/协议文字与真实执行验证脱节/PR级验收粒度粗于功能卡级/简化流程未协议化）+ 4 个好做法（pr-planner合并判断/model_inferred逐一确认/verifier独立grep核实/verifier拒绝代为下结论）
