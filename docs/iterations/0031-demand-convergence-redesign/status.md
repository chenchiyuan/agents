# 工作流进度

**工作流**: workflow-pb v0.13.1
**迭代**: 0031-demand-convergence-redesign
**当前阶段**: PR 实现（阶段 5）
**迭代分支**: iteration/0031-demand-convergence-redesign
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0031-demand-convergence-redesign
**状态**: 进行中
**history**: 关闭
**方案确认门**: enabled —— **已通过**（用户 2026-09-28 原话「同意。这次的修改范围不大，我建议一个pr完成就行」）
**一句话目标**: 把 demand 从"发散提问、逐条拍板"改为"围绕五项（需求/目标/边界/衡量标准/执行方向）反射式逐圈框定"，AI 写、AI 推荐，用户修正方向并最终确认

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0；D-1~D-15 全部 user_confirmed；用户 2026-09-28 确认整份文档 |
| 2 | 功能规格 | ✅ | ⬜ | 15 卡（F01~F13/G01/U01）；MI-1~MI-13 用户确认；架构待填 A-01~A-07 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md`（兼作 §11.4 优化方案）；A-01~A-07 填定；L1-1~L1-4 用户确认全选 A |
| 4 | PR 规划 | ✅ | ✅ | 单 PR `pr-001-demand-v1-rewrite-and-sync`（41 条验收）；check-pr-gates [7] 经用户豁免、[2] U01 为提示项 |
| 5 | PR 实现 | ✅ | ⬜ | 1/1 合并进迭代分支（`3ba69fb`）；pr-001 独立验收 41/41 PASS |
| 6 | 独立验证 | — | — | Gate：`verify-20260928-155755.md`（PASS/4 partial）→ 返工 → `verify-20260928-161043-rework.md`（PASS/1 partial）→ N1/N2 修订闭环 |

## 并发配置（阶段 5）

- **起始并发数**：3（默认值）
- **硬上限**：5
- **当前有效上限**：5（min(3+1×3, 5)）
- **累计槛位释放次数**：1
- **已派发总数**：1

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-demand-v1-rewrite-and-sync.md | （无） | ✅ | feat/0031-pr-001-demand-v1-rewrite(已清理 worktree) | ✅ | 已释放 |

## 待确认项

- [x] 阶段 1：衡量标准、执行方向、边界（含 prd 同步）
- [x] 方案确认门开关：开启

## 用户裁决（2026-09-28）

| 项 | 裁决 |
|---|---|
| L1-1 来源标记词表 | A：`user_confirmed` / `ai_decided` / `open`，demand 不再用 `model_inferred` |
| L1-2 D-13 未点名机制 | A：按 architecture.md §3.7 连带处置 |
| L1-3 character | A：按 §3.4 推荐稿重写 |
| L1-4 版本/changelog | A：workflow-pb / prd 不升版，联动修改记入 demand-changelog |
| 方案确认门 | 通过 |
| PR 粒度 | 用户建议单 PR 完成 |
| check-pr-gates [7] | 用户原话「可以豁免」：单 PR 无并发伙伴属结构性必然，不为过工具硬拆 |

## 遗留（不在本次范围）

- `tools/check-pr-gates.py` 在单 PR 时 [7] 必判失败，应跳过；[2] 不识别 U 类卡，另开 issue
- prd.md:28 指向的 `data/prd-changelog.md` 不存在（architect Q-A1），另开 issue
