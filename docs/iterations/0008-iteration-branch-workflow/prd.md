# 功能规格：workflow-pb 迭代分支层

**迭代 ID**: 0008-iteration-branch-workflow  
**版本**: 0.1.0  
**创建日期**: 2026-09-07  
**状态**: 已完成阶段 2（功能规格）

---

## 功能列表索引

| 功能 ID | 功能点摘要 | 文件路径 |
|---------|-----------|----------|
| F01 | 迭代分支概念与命名规范 | [prd/F01-iteration-branch-concept.md](prd/F01-iteration-branch-concept.md) |
| F02 | 阶段 1 创建迭代分支机制 | [prd/F02-create-iteration-branch.md](prd/F02-create-iteration-branch.md) |
| F03 | PR worktree 的 base 与合并目标改为迭代分支 | [prd/F03-pr-worktree-target.md](prd/F03-pr-worktree-target.md) |
| F04 | 阶段 5 解锁判据改为"合并进迭代分支" | [prd/F04-unlock-criterion-update.md](prd/F04-unlock-criterion-update.md) |
| F05 | 迭代分支合并进 main 的触发机制 | [prd/F05-merge-iteration-to-main.md](prd/F05-merge-iteration-to-main.md) |
| F06 | 版本号升级与变更说明 | [prd/F06-version-and-changelog.md](prd/F06-version-and-changelog.md) |

---

## 本次迭代边界说明

### 做什么
新增"迭代分支"层级（`main ← 迭代分支 ← PR worktree 分支`），让 main 分支始终只包含已验证、已完成的迭代产出，避免未完成迭代的中间变更过早落地 main。

核心改动：
- 新增迭代分支概念和命名格式 `iteration/{迭代ID}`
- 阶段 1 确认迭代名后立即创建迭代分支
- PR worktree 分支的 base 和合并目标改为迭代分支
- 阶段 5 依赖解锁判据从"合并进主分支"改为"合并进迭代分支"
- 迭代分支最终由主 agent 在阶段 6 验证通过后自动合并进 main

### 不做什么
- 不处理孤立分支 `iteration/0004-model-dispatch` 的清理（留给后续单独清理）
- 不改变 PR 文件的七字段格式本身
- 不追溯已完成迭代（延续"仅从下一个使用本工作流的迭代起生效"原则）

---

## 需求追溯
所有功能点来自 `docs/iterations/0008-iteration-branch-workflow/demand.md`，无新增需求。
