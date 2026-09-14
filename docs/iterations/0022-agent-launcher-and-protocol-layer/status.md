# 工作流进度

**工作流**: workflow-pb v0.10.0
**迭代**: 0022-agent-launcher-and-protocol-layer
**当前阶段**: PR 实现（阶段 5）· 待首波派发
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
| 4 | PR 规划 | ✅ | ✅ | 5 个 PR（`pr-001~pr-005`）；**Gate 首轮 FAIL（pr-003 粒度）⇒ 重划后第二轮 Gate PASS 30/30**（`clarifications/verify-stage4-gate-r2-20260914.md`，8 条偏差已登记，2 项高优先在阶段 5 前定点修正中） |
| 5 | PR 实现 | ⏸ | ⬜ | 并发配置已初始化；待 pr-planner 第 3 轮修正完成后派发首波 `{pr-001, pr-004}` |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 待确认项

- [x] 阶段 1/2/3 的全部 `[model_inferred]` 与 L1 决策 —— 已全部经用户裁决
- [x] 阶段 4：Gate 第二轮 **PASS**（30/30，fail 0 / partial 0 / blocked 0）
- [ ] 阶段 5：各 PR 若出现 `[model_inferred]` 或阻塞，回填此处

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-launcher-and-protocol-config.md | （无） | ⬜ | | ⬜ | 排队(依赖已满足) |
| pr-002-test-face-profile-pinning.md | pr-001 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-003-protocol-layer-and-consumption-cutover.md | pr-005, pr-002, pr-001 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-004-stream-kind-partition-ui.md | （无）+ 验收时序登记 | ⬜ | | ⬜ | 排队(依赖已满足) |
| pr-005-protocol-layer-and-injection-entry.md | pr-001 | ⬜ | | ⬜ | 排队(依赖未满足) |

依赖图（阶段 4 交付）：`pr-001 → {pr-002, pr-005}`；`pr-002 → pr-003`；`pr-005 → pr-003`；`pr-001 → pr-003`；`pr-004` 独立（另有验收时序边 `pr-004 ⤳ pr-003`，非合并前置）。
**首波可并发 = {pr-001, pr-004}**；次波 = {pr-002, pr-005}（pr-001 合并后）；末波 = {pr-003}（pr-001 + pr-002 + pr-005 全部合并后）。

## 并发配置（阶段 5）

| 字段 | 值 |
|---|---|
| **起始并发数** | 3 |
| **硬上限** | 5（公式 `2×起始-1`） |
| **当前有效上限** | 3 |
| **累计槛位释放次数** | 0 |
| **已派发总数** | 0 |

## 已知偏差登记（交阶段 6 核查）

| # | 内容 | 来源 | 处置 |
|---|---|---|---|
| D-7 | `architecture.md` §9.4.1 的「既有测试面最小更新」清单列 6 个测试文件，实测应为 7（追加 `oamp/test/call-protocol.test.js`） | Gate 首轮 D-1 / 第二轮 D-7 | PR 文件（pr-002 / pr-003）已登记正确口径；**architecture.md 本体未回填**（执行角色产物，不在阶段 4 改）；阶段 6 需核查该偏差是否仍被登记且未造成实现遗漏 |
| D-2′ | pr-005 的 `AcpClient` 现状入参面声明为 8 键，实测 10 键（漏 `auditContext` 四键 + `onExit`） | Gate 第二轮 D-2（高优先） | 派发 pr-planner 第 3 轮定点修正 |
| D-3′ | pr-005 验收第 1 条的 import 白名单字面判定必假 | Gate 第二轮 D-3（高优先） | 派发 pr-planner 第 3 轮定点修正 |

## 更新日志

- 2026-09-14: 迭代启动；阶段 1 需求收敛（`demand.md` v1.0.0）→ 阶段 2 功能规格（`prd.md` v0.2.0，13 卡）→ 阶段 3 技术架构（`architecture.md` v0.2.0，M7 实测 + L1 已确认）。
- 2026-09-14: progress-observer 首次快照（补齐阶段 1~3 推进后的观测；偏差已登记），7 条发现中 2 条即时修正（status/history 滞后、迭代分支零提交 → `a4d3e2f`）。
- 2026-09-14: 阶段 4 首轮产出 4 个 PR ⇒ Gate 首轮 **FAIL**（pr-003 A1/A2：6 生产模块跨三层、18 条验收跨 5 个关注面）⇒ 回阶段 4 重划。
- 2026-09-14: 阶段 4 第二轮：重划为「加性子集 pr-005 + 切换子集 pr-003」，修正 D-1~D-5 ⇒ **Gate 第二轮 PASS 30/30**（5 PR × 6 判据全通过；依赖图无环；文件范围两两无交集；F01~F13 13/13）。
- 2026-09-14: 阶段 4 收口：派发 pr-planner 第 3 轮定点修正 Gate 第二轮的 2 项高优先 + 3 项轻微偏差（仅收紧文本，不改文件范围 / 依赖边 / 覆盖 ⇒ Gate PASS 结论不变）；修正完成后进入阶段 5 首波派发 `{pr-001, pr-004}`。
