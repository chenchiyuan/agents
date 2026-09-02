# workflow-pb 变更历史

## v0.2.0（2026-09-02）

**触发**：`docs/iterations/0004-model-dispatch` 迭代复盘（`project-retrospective.md` P2 条目）+ 用户在实际执行中发现 PR 被串行执行，与设计初衷（PR 解耦、可并行开发）不符。

**根因**：
1. 全局 `tasks.md`（原阶段 4「任务拆解」产出）在还没有真实 PR 文件边界时就要判断任务依赖，`tasks.md` 的"关键路径"章节把"最小风险的顺序偏好"误判成"技术依赖"，导致任务被串成一条链。原阶段 5「提交规划」的 commit-planner 只做机械分组（按 tasks.md 的顺序投影），没有独立判断真实依赖的能力和输入（不读代码库）。
2. `commit-planner.md` 明确写"主 agent 按报告中的文件列表顺序逐一 dispatch dev"——调度语义本身写死了串行，即使输入支持并行也会串行执行。
3. `workflow-pb.md` 和 `workflow-scm.md` 两个独立文件重复定义同一套 worktree 隔离和 PR 文件前置规则，违反权责分离原则（协调者只定义一次契约）。

**决策过程**：与用户多轮讨论收敛，关键决策点：
- 是否新增角色做"执行方案反射"——用户否决拆成两个角色（commit-planner 做分组 + execution-planner 做排期），理由"这个事情不需要做两次"，合并为一个角色 `pr-planner`
- 是否保留全局 tasks.md——用户指出"目前全局的 tasks.md 其实没什么意义，实际执行才有 tasks 一说"，改为每个 PR 反射产生后，任务拆解移入实现阶段、逐 PR 在子 agent 内完成
- workflow-scm 是否保留独立文件——用户明确要求并入 workflow-pb，"流程统一由 workflow-pb 管理"，并要求"问题先简化，如果有必要再新增 role"（结果：不新增额外角色，只新增 pr-planner 一个）

**具体改动**：
- 阶段从 7 个减到 6 个：原「任务拆解」+「提交规划」合并为「PR 规划」（阶段 4，pr-planner 执行，直接从 architecture.md+prd/*.md+代码库现状反射 PR 边界，不经过全局任务图）；原「后端实现」改为「PR 实现」（阶段 5），任务拆解变成该阶段内部、逐 PR 在子 agent 中执行的步骤（由 planner 承担，输入范围收窄为单个 PR）
- `roles/workflow-scm/` 整个删除，其定义的不变量（worktree 隔离、PR 文件前置）、PR 文件格式规范、验证目标全部并入本文件
- PR 文件格式从五字段扩展为七字段：新增 `depends_on`（依赖的 PR，需代码级证据支撑）、`batch`（人工速览分组，非调度依据）；"涉及 tasks"改名"涉及功能点"（因为不再有全局 tasks.md，改为引用 prd F-ID）
- 调度指南新增"依赖解锁式并发"：不再是"按列表顺序逐一 dispatch"，而是无依赖或依赖已合并进主分支的 PR 立即并发派发，每次 merge 后重新扫描解锁新 PR，阻塞的 PR 只暂停自己的下游
- `roles/commit-planner/` 整个删除，由新角色 `roles/pr-planner/` 取代（走 create-role 反射流程创建，见 `roles/pr-planner/data/pr-planner-reflection.md`）

**未采纳的方案**：
- 曾考虑只加依赖字段+改调度措辞、不动 planner 生成任务图的方式（"方案 A"）——被后续讨论推翻，因为不解决"全局 tasks.md 本身没有意义"这个更根本的问题
- 曾考虑保留 workflow-scm 独立文件、只做小修订走 changelog 机制——被用户推翻，明确要求并入 workflow-pb 统一管理

**v0.1.0 → v0.2.0 的兼容性**：本约束仅从下一个使用 workflow-pb v0.2.0 的迭代起生效，不追溯已完成迭代（沿用原 workflow-scm 的生效范围条款）。
