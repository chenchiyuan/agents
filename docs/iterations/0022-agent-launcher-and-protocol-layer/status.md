# 工作流进度

**工作流**: workflow-pb v0.10.0
**迭代**: 0022-agent-launcher-and-protocol-layer
**当前阶段**: 独立验证（阶段 6）· 已派发
**迭代分支**: iteration/0022-agent-launcher-and-protocol-layer
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer
**状态**: 进行中
**history**: 开启
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` **v1.0.0**；两批裁决全部 `user_confirmed` |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` **v0.2.0**：13 张卡；4 项 MI 已裁决 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` **v0.2.0**：M7 实测 5 组探针；L1 决策 2 条已确认；T-01~T-11 落定 11/11 |
| 4 | PR 规划 | ✅ | ✅ | 5 个 PR；Gate 首轮 FAIL（p3 粒度）⇒ 重划后**第二轮 PASS 30/30**；第 3/4 轮偏差修正与授权范围扩展 |
| 5 | PR 实现 | ✅ | ✅ | **5/5 PR 全部合并**（pr-001 `2a2d979` / pr-004 `f1097ae` / pr-002 `4777bf0` / pr-005 `b54f143` / pr-003 `a975ce8`）；每个 PR 均经独立验收 **PASS**（5/5、6/6、12/12、14/14、16/16）；合并后全量 **361/361 绿** |
| 6 | 独立验证 | ⏸ | ⬜ | 已派发 verifier 对迭代终态做收口验证 |

## 待确认项

- [x] 阶段 1/2/3 的全部 `[model_inferred]` 与 L1 决策 —— 已全部经用户裁决
- [x] 阶段 4：Gate 第二轮 **PASS**（30/30）
- [x] 阶段 5 三个波次的任务图 `[model_inferred]`（7 + 8 + 5 项）与 3 项上报 —— 已全部经用户裁决
- [ ] 阶段 6：验证发现的新偏差与待裁决项（待回填）

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-launcher-and-protocol-config.md | （无） | ✅ 已完成（验收 PASS 5/5） | （已清理） | ✅（`2a2d979`） | 已释放 |
| pr-002-test-face-profile-pinning.md | pr-001 | ✅ 已完成（验收 PASS 12/12） | （已清理） | ✅（`4777bf0`） | 已释放 |
| pr-003-protocol-layer-and-consumption-cutover.md | pr-005, pr-002, pr-001 | ✅ 已完成（验收 PASS 16/16 + 69 条任务判据） | （已清理） | ✅（`a975ce8`） | 已释放 |
| pr-004-stream-kind-partition-ui.md | （无）+ 验收时序登记 | ✅ 已完成（验收 PASS 6/6） | （已清理） | ✅（`f1097ae`） | 已释放 |
| pr-005-protocol-layer-and-injection-entry.md | pr-001 | ✅ 已完成（验收 PASS 14/14；含授权的 `launcher.js` 扩展） | （已清理） | ✅（`b54f143`） | 已释放 |

依赖图全部边已满足；**5/5 PR 合并完成**；全部 PR worktree 与分支已清理。

## 并发配置（阶段 5）

| 字段 | 值 |
|---|---|
| **起始并发数** | 3 |
| **硬上限** | 5（公式 `2×起始-1`） |
| **当前有效上限** | **5**（= min(3 + 5×3, 5)，触硬上限；历次释放：pr-001 / pr-004 / pr-002 / pr-005 / pr-003） |
| **累计槛位释放次数** | 5 |
| **已派发总数** | 20（首波 planner×2 + dev×2 + verifier×2；次波 planner×2 + dev×2 + verifier×2 + 定点修复×1；末波 planner×1 + dev×1 + verifier×1；pr-planner 修正×2；progress-observer×2） |

## 已知偏差登记（交阶段 6 核查）

| # | 内容 | 处置状态 |
|---|---|---|
| D-7 | `architecture.md` §9.4.1 既有测试面清单 6 个 vs 实测 7 个 | 开放（architecture 本体未回填；PR 文件已登记正确口径） |
| D-7′ | `launcher.js` positional 空提示词产出 `undefined` | **已闭合**（pr-005 加守卫 + 断言，验收核实） |
| D-2′ / D-3′ | pr-005 的 AcpClient 装配面 8→10 键；import 白名单字面必假 | **已闭合** |
| D-w2-1 | architecture §3.4/§5.6 的 `option_id` 与 §5.1 的 `optionId` 冲突 | 开放（用户裁决按 `optionId`；architecture 字面待同步） |
| D-w2-2 | pr-005 文件范围 4 → 5（授权纳入 `launcher.js`） | 开放（阶段 6 核查授权例外是否只此一处） |
| D-w2-3 | `status.test.js:157` 时序断言偶发失败（既有 flake，非改动面） | 开放（阶段 6 核查是否需单独处理） |

## 更新日志

- 2026-09-14: 阶段 1~4 完成；Gate 首轮 FAIL ⇒ 重划后第二轮 PASS 30/30。
- 2026-09-14: 阶段 5 首波 `{pr-001, pr-004}` 合并（全量 335/335）。
- 2026-09-14: 阶段 5 次波 `{pr-002, pr-005}`：pr-005 内发现并修复 deny 档语义缺陷（授权纳入 `launcher.js`，含 D-7′ 守卫）；两 PR 验收 PASS 并合并（全量 357/357）。
- 2026-09-14: **阶段 5 末波 `{pr-003}` 完成**：消费层切到 L2 标准面（acp 对齐 / 默认 rpc / B-17 零侵入断言 / `--protocol` flag / README 同步）；独立验收 **PASS（16/16 + 69 条任务判据）**；合并 `a975ce8`；**5/5 PR 全部合并**；合并后全量 **361/361 绿**。
- 2026-09-14: 进入**阶段 6（独立验证）**——派发 verifier 对迭代终态做收口验证。
