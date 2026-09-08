# F01：迭代分支概念与命名规范

## 功能 ID
F01

## 用户价值
明确"迭代分支"在工作流中的定义和命名规范，为后续阶段的分支操作提供统一的术语基础。

## 验收标准
- [ ] workflow-pb.md 中能找到"迭代分支"的明确定义（至少包含：它在工作流中的位置、作用、生命周期）
- [ ] workflow-pb.md 中明确说明迭代分支的命名格式为 `iteration/{迭代ID}`
- [ ] 能从协议文件中理解迭代分支在 `main ← 迭代分支 ← PR worktree 分支` 两层结构中的位置

## 边界（不包含）
- 不包含迭代分支的创建时机（由 F02 处理）
- 不包含 PR worktree 分支如何指向迭代分支（由 F03 处理）
- 不包含迭代分支如何合并进 main（由 F05 处理）
- 不包含对孤立分支 `iteration/0004-model-dispatch` 的清理动作（demand.md §3 明确不做）

## 架构维度

已补全为决策 D1（见 `architecture.md` §决策 D1）：

- **定义位置**：`workflow-pb.md`「提交管理约束」章节新增「迭代分支层」小节（置于「规则 A」之前），定义迭代分支的作用（PR 的公共 base 和合并目标）、命名格式（`iteration/{迭代ID}`）、在两层结构 `main ← 迭代分支 ← PR worktree 分支` 中的位置。
- **命名格式**：`iteration/{迭代ID}`，复用孤立分支 `iteration/0004-model-dispatch` 已出现的命名先例，`{迭代ID}` 取值与该迭代 `docs/iterations/{迭代ID}/` 目录名一致（如 `iteration/0008-iteration-branch-workflow`）。
- **生命周期**：创建时机见 F02；终点见 F05（合并进 main 后，主 agent 执行 `git branch -d iteration/{迭代ID}` 删除本地分支——遵循"合并成功即清理"的既有惯例，不长期保留，`git log --merges` 仍可追溯历史）。
