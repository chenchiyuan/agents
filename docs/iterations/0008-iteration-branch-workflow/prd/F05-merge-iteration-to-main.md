# F05：迭代分支合并进 main 的触发机制

## 功能 ID
F05

## 用户价值
明确迭代分支何时、由谁合并进 main，确保 main 分支始终只包含已通过独立验证、已完整完成的迭代产出，不留孤立悬挂的迭代分支。

## 验收标准
- [ ] workflow-pb.md §调度指南中明确说明：阶段 6（独立验证）结论为 pass 之后，主 agent 自动执行迭代分支合并进 main 的操作
- [ ] 该机制描述能回答："谁执行合并（主 agent）""触发条件是什么（阶段 6 独立验证 pass）""合并方式是否与现有 PR 合并模式一致"
- [ ] 该机制与 demand.md §7 的用户确认结论一致：延续"PR 验收通过→主 agent 自动 merge"的既有模式

## 边界（不包含）
- 不包含迭代分支的创建机制（由 F02 处理）
- 不包含 PR 如何合并进迭代分支（由 F03 处理）
- 不包含孤立分支 `iteration/0004-model-dispatch` 的清理（demand.md §3 明确不做，留给后续单独清理）

## 架构维度

已补全为决策 D4（见 `architecture.md` §决策 D4）：

- **触发时机**：`workflow-pb.md`「调度指南 § 启动工作流」或「调度指南 § 终止工作流」补充一节（如「迭代分支合并进 main」），定义阶段 6（独立验证）对"整个迭代所有 PR 合并完成后的最终产物"验证结论为 pass 之后，主 agent 执行迭代分支合并进 main 的操作——不需要新的人工确认关卡，延续现有"验收通过→自动 merge"惯例。
- **执行方**：主 agent（不是执行角色）。
- **合并策略**：`git checkout main`（从当前的迭代分支切回 main）→ `git merge --no-ff iteration/{迭代ID}`（保留合并记录，不 fast-forward）→ `git branch -d iteration/{迭代ID}`（合并成功后删除本地迭代分支）——复用现有 `--no-ff` 惯例（见 demand.md §2 核查的历史 merge 记录），让 `git log --merges` 可追溯"哪次合并代表哪个迭代完成"。
- **commit message 格式**：修正——实际 `git log --merges` 核实到的历史 merge commit 格式是 `merge: PR-{NNN} {该 PR 的一句话描述} ({迭代ID})`（如 `merge: PR-001 workflow-pb history.md 记录协议 (0007-workflow-history-log)`），不是此前误写的 `chore: merge PR-001 feat: ... into main`。迭代分支合并进 main 参照同一命名习惯，用 `merge: iteration {迭代ID} {该迭代一句话目标} into main`，让 message 本身说明这是迭代层级合并（关键词 `iteration` + `into main`），而非单个 PR 合并（单个 PR 合并的 message 关键词是 `PR-{NNN}`，两者可通过 message 前缀区分）。
- **失败处理**：若 `git merge --no-ff` 报告冲突，主 agent 停止推进并向用户上报——这是结构性错误（类比"PR 依赖图有环"），不在调度层绕开；由于迭代分支的所有 PR 均已验收通过，理论上不应出现冲突，出现即说明 main 在该迭代进行中被他人直接提交（违反规则 A），或存在未被 verifier 发现的合并冲突。
