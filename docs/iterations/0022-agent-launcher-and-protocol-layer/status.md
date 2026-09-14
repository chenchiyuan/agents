# 工作流进度

**工作流**: workflow-pb v0.10.0
**迭代**: 0022-agent-launcher-and-protocol-layer
**当前阶段**: **已完成**（6/6 阶段收口）
**迭代分支**: iteration/0022-agent-launcher-and-protocol-layer（**已合并进 main**：merge `4e644b1`；分支与工作区已清理）
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer
**状态**: **已完成**（阶段 6 独立验证 PASS；迭代分支已合并 main；`oamp` 全量测试在主分支复跑通过）
**history**: 开启
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0；两批裁决全部 `user_confirmed` |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` v0.2.0：13 张卡；4 项 MI 已裁决 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` v0.2.0：M7 实测 5 组；L1 决策 2 条已确认；T-01~T-11 落定 11/11 |
| 4 | PR 规划 | ✅ | ✅ | 5 个 PR；Gate 首轮 FAIL ⇒ 重划后第二轮 **PASS 30/30** |
| 5 | PR 实现 | ✅ | ✅ | **5/5 PR 合并**（`2a2d979` / `f1097ae` / `4777bf0` / `b54f143` / `a975ce8`）；每 PR 独立验收 PASS（5/6/12/14/16 项）；合并后全量 **361/361 绿** |
| 6 | 独立验证 | ✅ | ✅ | `clarifications/verify-stage6-20260914.md`：**PASS**（17 条判据：pass 16 / partial 1 / fail 0；偏差 9 条）；真机证据 10/10 sha256 同源、仓库零写入 |

## 待确认项

- [x] 阶段 1/2/3 的全部 `[model_inferred]` 与 L1 决策 —— 已全部经用户裁决
- [x] 阶段 4：Gate 第二轮 PASS（30/30）
- [x] 阶段 5 三个波次任务图的 `[model_inferred]`（7 + 8 + 5 项）与 3 项上报 —— 已全部经用户裁决
- [x] 阶段 6：PASS；偏差已登记（见下表），**无阻塞收口的 fail**

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-launcher-and-protocol-config.md | （无） | ✅ 已完成（验收 PASS 5/5） | （已清理） | ✅（`2a2d979`） | 已释放 |
| pr-002-test-face-profile-pinning.md | pr-001 | ✅ 已完成（验收 PASS 12/12） | （已清理） | ✅（`4777bf0`） | 已释放 |
| pr-003-protocol-layer-and-consumption-cutover.md | pr-005, pr-002, pr-001 | ✅ 已完成（验收 PASS 16/16 + 69 条任务判据） | （已清理） | ✅（`a975ce8`） | 已释放 |
| pr-004-stream-kind-partition-ui.md | （无）+ 验收时序登记 | ✅ 已完成（验收 PASS 6/6） | （已清理） | ✅（`f1097ae`） | 已释放 |
| pr-005-protocol-layer-and-injection-entry.md | pr-001 | ✅ 已完成（验收 PASS 14/14） | （已清理） | ✅（`b54f143`） | 已释放 |

## 并发配置（阶段 5）

| 字段 | 值 |
|---|---|
| **起始并发数** | 3 |
| **硬上限** | 5（公式 `2×起始-1`） |
| **当前有效上限** | **5**（= min(3 + 5×3, 5)，触硬上限；历次释放：pr-001 / pr-004 / pr-002 / pr-005 / pr-003） |
| **累计槛位释放次数** | 5 |
| **已派发总数** | **24**（按 `history.md` 实际条目重算：首波 6 + 次波 7 + 末波 3 + pr-planner 修正轮 3 + Gate verifier 2 + progress-observer 3） |

> 明细口径修正（观察者第 3 次快照发现）：`history.md` 原缺 3 条派发条目与 2 处超前时间戳，已于 2026-09-14 修正并逐条标注「事后补记」及推导依据；上方计数按修正后的条目重算。

## 已知偏差登记（阶段 6 核定后）

| # | 内容 | 阶段 6 核定 |
|---|---|---|
| D-7 | `architecture.md` §9.4.1 既有测试面清单 6 个 vs 实测 7 个 | **仍开放**（文档面；需同步 architecture 或登记为已知差异） |
| D-w2-1 | `architecture.md` §3.4/§5.6 的 `option_id` 与 §5.1 的 `optionId` | **仍开放**（阶段 6 实读确认：两者是两个真实面——信封 vs 钩子，代码自洽，仅文档未点明） |
| D-w2-2 | pr-005 文件范围 4 → 5（授权纳入 `launcher.js`） | **可闭合**（阶段 6 核实：跨界例外仅此一处，授权记录完备） |
| D-w2-3 | `status.test.js:157` 时序断言偶发失败 | **仍开放**（阶段 6 实跑 8 次失败 2 次 ≈25%，属既有 flake、不在任何 PR 改动面 ⇒ 使「361/361 绿」非确定性） |
| D-7′ | `launcher.js` positional 空提示词产出 `undefined` | 已闭合（pr-005 加守卫 + 断言） |
| D-2′ / D-3′ | pr-005 装配面 8→10 键；import 白名单字面 | 已闭合 |
| D-6-新 | **E6 的证据形态**：交付物内（status.md / history.md / 5 份 PR 验收报告）零真实 omp 证据，协议行为证据全部来自 fake bin ⇒ 阶段 6 真机探针补足 | 开放（下一迭代候选：把「真实 omp 链路端到端」固化为验收证据形态） |
| D-8-新 | 真实 acp 门的 `tool=null`（与 main 一致，非本迭代引入） | 开放（下一迭代候选） |
| D-9-新 | 门未裁决时轮次可无限挂起且界面无状态变化（属设计） | 开放（下一迭代候选） |

## 更新日志

- 2026-09-14: 阶段 1~4 完成；Gate 首轮 FAIL ⇒ 重划后第二轮 PASS 30/30。
- 2026-09-14: 阶段 5 首波 `{pr-001, pr-004}` 合并（全量 335/335）。
- 2026-09-14: 阶段 5 次波 `{pr-002, pr-005}`：pr-005 内发现并修复 deny 档语义缺陷（授权纳入 `launcher.js`，含 D-7′ 守卫）；两 PR 验收 PASS 并合并（全量 357/357）。
- 2026-09-14: 阶段 5 末波 `{pr-003}` 完成并合并（`a975ce8`）；**5/5 PR 全部合并**；合并后全量 **361/361 绿**。
- 2026-09-14: **阶段 6 独立验证 PASS**（`clarifications/verify-stage6-20260914.md`）：PR 粒度与依赖终态、并发真实执行证据三项（worktree 重叠 ≈48 分钟 / 并发配置真实更新 3→5 / 爬升公式触发）、E1~E7 真机效果、边界与保证项、搭置核实（`deferred-demand-changes.md` 不存在）全部有证据；C6（验收证据形态）判 partial 并登记为下一迭代候选。
- 2026-09-14: progress-observer 第 3 次快照（迭代终态）；观察者报出的 6 条不一致（缺 3 条派发条目 / 2 处超前时间戳 / 派发计数口径 / 阶段 6 无记录 / 合并后全量无完成态记录）已逐条修正。
