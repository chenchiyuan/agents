# 工作流进度

**工作流**: workflow-pb v0.10.0
**迭代**: 0022-agent-launcher-and-protocol-layer
**当前阶段**: PR 实现（阶段 5）· 次波
**迭代分支**: iteration/0022-agent-launcher-and-protocol-layer
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer
**状态**: 进行中
**history**: 开启
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` **v1.0.0**；两批裁决全部 `user_confirmed`；`model_inferred` 归零 |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` **v0.2.0**：13 张卡；4 项 MI 裁决已回收 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` **v0.2.0**：M7 实测 5 组探针；L1 决策 2 条已确认；T-01~T-11 落定 11/11 |
| 4 | PR 规划 | ✅ | ✅ | 5 个 PR；Gate 首轮 FAIL（pr-003 粒度）⇒ 重划后**第二轮 Gate PASS 30/30** |
| 5 | PR 实现 | ⏸ | ⬜ | **首波 2/2 已合并**（pr-001 `2a2d979` / pr-004 `f1097ae`，合并后全量 **335/335 绿**）；次波 `{pr-002, pr-005}` 已解锁并派发 planner |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 待确认项

- [x] 阶段 1/2/3 的全部 `[model_inferred]` 与 L1 决策 —— 已全部经用户裁决
- [x] 阶段 4：Gate 第二轮 **PASS**（30/30）
- [x] 阶段 5 首波任务图的 7 项 `[model_inferred]` —— 已全部经用户裁决（`clarifications/2026-09-14-stage5-wave1-verdicts.md`，七项全采纳）+ 主 agent 裁定 approval 覆写面归属
- [ ] 阶段 5：次波任务图若出现 `[model_inferred]` 或阻塞，回填此处

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-launcher-and-protocol-config.md | （无） | ✅ 已完成（验收 PASS 5/5，偏差 7 条） | `feat/0022-pr-001…`（已清理） | ✅（`2a2d979`） | 已释放 |
| pr-002-test-face-profile-pinning.md | pr-001（已合并） | ⏸ 进行中（planner 已派发） | `feat/0022-pr-002-test-face-profile-pinning` | ⬜ | 占用 |
| pr-003-protocol-layer-and-consumption-cutover.md | pr-005, pr-002, pr-001 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-004-stream-kind-partition-ui.md | （无）+ 验收时序登记 | ✅ 已完成（验收 PASS 6/6，偏差 4 条） | `feat/0022-pr-004…`（已清理） | ✅（`f1097ae`） | 已释放 |
| pr-005-protocol-layer-and-injection-entry.md | pr-001（已合并） | ⏸ 进行中（planner 已派发） | `feat/0022-pr-005-protocol-layer-and-injection-entry` | ⬜ | 占用 |

依赖图：`pr-001 → {pr-002, pr-005}`；`pr-002 → pr-003`；`pr-005 → pr-003`；`pr-001 → pr-003`；`pr-004` 独立（另有验收时序边 `pr-004 ⤳ pr-003`，非合并前置）。
**首波 {pr-001, pr-004} 已完成**；次波 = `{pr-002, pr-005}`（进行中）；末波 = `{pr-003}`。

## 并发配置（阶段 5）

| 字段 | 值 |
|---|---|
| **起始并发数** | 3 |
| **硬上限** | 5（公式 `2×起始-1`） |
| **当前有效上限** | **5**（= min(3 + 2×3, 5)，**已触硬上限**；历次释放：pr-001 / pr-004 各 1 次） |
| **累计槛位释放次数** | 2（pr-001、pr-004 合并） |
| **已派发总数** | 9（首波 planner×2 + dev×2 + 验收 verifier×2 + 次波 planner×2 + progress-observer×1） |

## 已知偏差登记（交阶段 6 核查）

| # | 内容 | 来源 | 处置 |
|---|---|---|---|
| D-7 | `architecture.md` §9.4.1 的既有测试面清单列 6 个测试文件，实测应为 7 | Gate 首轮 D-1 / 第二轮 D-7 | PR 文件已登记正确口径；architecture 本体未回填；阶段 6 核查 |
| D-7′ | `launcher.js` 在 `input:'positional'` 且未传 prompt 时，argv 末位为 `undefined`（子进程实收字面量） | pr-001 验收 D-7 | 非本 PR 判据面；**阶段 5 消费方（pr-003 / pr-005）需加防护**；阶段 6 核查是否已防护 |
| D-4′ | `prs/pr-004-tasks.md` 未被 git 跟踪（体例不一致） | pr-004 验收 D-4 | 已由主 agent 补入迭代分支（`fa2acd6`），闭合 |

## 更新日志

- 2026-09-14: 阶段 1~4 全流程完成（`demand.md` v1.0.0 → `prd.md` v0.2.0 → `architecture.md` v0.2.0 → 5 PR + Gate PASS 30/30）。
- 2026-09-14: 阶段 5 首波：`{pr-001, pr-004}` 并发执行（planner → dev → 独立验收 → 合并）；两个 PR 验收均 PASS；合并后 `oamp` 全量 **335/335 绿**；worktree/分支已清理。
- 2026-09-14: 槛位释放 2 次 ⇒ 当前有效上限触硬上限 5；次波 `{pr-002, pr-005}` 解锁并派发 planner；progress-observer 自动触发（首波合并后）。
