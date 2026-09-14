# 工作流进度

**工作流**: workflow-pb v0.10.0
**迭代**: 0022-agent-launcher-and-protocol-layer
**当前阶段**: PR 实现（阶段 5）· 末波
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
| 4 | PR 规划 | ✅ | ✅ | 5 个 PR；Gate 首轮 FAIL（pr-003 粒度）⇒ 重划后**第二轮 Gate PASS 30/30**；**第 4 轮**按主 agent 授权把 `launcher.js` 纳入 pr-005 范围 |
| 5 | PR 实现 | ⏸ | ⬜ | **首波 2/2 + 次波 2/2 已合并**（pr-001 `2a2d979` / pr-004 `f1097ae` / pr-002 `4777bf0` / pr-005 `b54f143`）；末波 `{pr-003}` 已解锁并派发 planner |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 待确认项

- [x] 阶段 1/2/3 的全部 `[model_inferred]` 与 L1 决策 —— 已全部经用户裁决
- [x] 阶段 4：Gate 第二轮 **PASS**（30/30）
- [x] 阶段 5 首波任务图 7 项 + 次波任务图 8 项（含 1 处上游口径冲突）—— 已全部经用户裁决（`clarifications/2026-09-14-stage5-wave1-verdicts.md` / `-wave2-verdicts.md`）
- [ ] 阶段 5：末波任务图若出现 `[model_inferred]` 或阻塞，回填此处

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-launcher-and-protocol-config.md | （无） | ✅ 已完成（验收 PASS 5/5） | （已清理） | ✅（`2a2d979`） | 已释放 |
| pr-002-test-face-profile-pinning.md | pr-001（已合并） | ✅ 已完成（验收 PASS 12/12） | （已清理） | ✅（`4777bf0`） | 已释放 |
| pr-003-protocol-layer-and-consumption-cutover.md | pr-005, pr-002, pr-001（均已合并） | ⏸ 进行中（planner 已派发） | `feat/0022-pr-003-protocol-layer-and-consumption-cutover` | ⬜ | 占用 |
| pr-004-stream-kind-partition-ui.md | （无）+ 验收时序登记 | ✅ 已完成（验收 PASS 6/6） | （已清理） | ✅（`f1097ae`） | 已释放 |
| pr-005-protocol-layer-and-injection-entry.md | pr-001（已合并） | ✅ 已完成（验收 PASS 14/14；含主 agent 授权的 `launcher.js` 扩展） | （已清理） | ✅（`b54f143`） | 已释放 |

依赖图：`pr-001 → {pr-002, pr-005}`；`pr-002 → pr-003`；`pr-005 → pr-003`；`pr-001 → pr-003`；`pr-004` 独立（另有验收时序边 `pr-004 ⤳ pr-003`，非合并前置）。
**首波 {pr-001, pr-004} + 次波 {pr-002, pr-005} 已完成**；末波 = `{pr-003}`（进行中）。

## 并发配置（阶段 5）

| 字段 | 值 |
|---|---|
| **起始并发数** | 3 |
| **硬上限** | 5（公式 `2×起始-1`） |
| **当前有效上限** | **5**（= min(3 + 4×3, 5)，**已触硬上限**；历次释放：pr-001 / pr-004 / pr-002 / pr-005 各 1 次） |
| **累计槛位释放次数** | 4 |
| **已派发总数** | 16（首波 planner×2 + dev×2 + verifier×2 = 6；次波 planner×2 + dev×2 + verifier×2 + 定点修复×1 = 7；pr-planner 第 4 轮×1；progress-observer×2） |

## 已知偏差登记（交阶段 6 核查）

| # | 内容 | 来源 | 处置 |
|---|---|---|---|
| D-7 | `architecture.md` §9.4.1 的既有测试面清单列 6 个测试文件，实测应为 7 | Gate 首轮 D-1 / 第二轮 D-7 | PR 文件已登记正确口径；architecture 本体未回填；阶段 6 核查 |
| D-7′ | `launcher.js` 在 `input:'positional'` 且未传 prompt 时 argv 末位为 `undefined` | pr-001 验收 D-7 | **已闭合**：pr-005（授权扩展）加守卫 + 断言（验收 PASS 已核实） |
| D-2′ | pr-005 的 `AcpClient` 装配面 8 → 10 键 | Gate 第二轮 D-2 | 已闭合（pr-005 按实测 10 键） |
| D-3′ | pr-005 验收第 1 条 import 白名单字面判定必假 | Gate 第二轮 D-3 | 已闭合（两分口径已落 pr-005 文件与实现） |
| D-w2-1 | `architecture.md` §3.4 / §5.6 的钩子入参键名 `options:[{option_id}]` 与 §5.1 及既有消费面（`agent.js`）的 `optionId` 冲突 | pr-005 任务图矛盾① | 用户裁决按 `optionId`；architecture 字面作废；阶段 6 核查同步 |
| D-w2-2 | pr-005 文件范围由 4 → 5 文件（纳入 `oamp/src/launcher.js`） | 主 agent 授权（拒绝客户端自拼 argv） | pr-005 PR 文件已更新（pr-planner 第 4 轮）；阶段 6 核查该授权例外是否只此一处 |
| D-w2-3 | `status.test.js:157` 时序断言在多次全量运行中偶发失败（单跑 3/3 通过，不在任何 PR 改动面） | pr-005 验收观察 | 既有 flake，登记；阶段 6 核查是否需单独处理 |

## 更新日志

- 2026-09-14: 阶段 1~4 完成（`demand.md` v1.0.0 → `prd.md` v0.2.0 → `architecture.md` v0.2.0 → 5 PR + Gate PASS 30/30）。
- 2026-09-14: 阶段 5 首波 `{pr-001, pr-004}` 完成并合并（全量 335/335 绿）；槛位释放 2 次。
- 2026-09-14: 阶段 5 次波 `{pr-002, pr-005}`：任务图 8 项 MI + 1 处上游口径冲突经用户裁决；pr-005 内发现并修复 deny 档语义缺陷（主 agent 授权把 `launcher.js` 纳入其范围，含 D-7′ 守卫）；两个 PR 验收 **PASS**（12/12、14/14）并合并（`4777bf0` / `b54f143`）；槛位释放累计 4 次。
- 2026-09-14: 末波 `{pr-003}` 解锁并派发 planner；progress-observer 已两次快照（首波合并后、次波进行中）。
