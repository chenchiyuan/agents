# 工作流进度

**工作流**: workflow-pb v0.12.0
**迭代**: 0025-hub-sdk-and-skill
**当前阶段**: 阶段 5（PR 实现）
**迭代分支**: iteration/0025-hub-sdk-and-skill（tip `4be4661`）
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0025-hub-sdk-and-skill
**状态**: 进行中
**history**: 开启
**方案确认门**: enabled
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发；阶段 1 由主 agent 内联执行

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.1：15 项决策全 `user_confirmed` |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` v0.1.0 + 17 张卡；三张追溯表无未承载项 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` v1.0.0（687 行）；T-01~T-09 全落定；L1-1 与 P-1~P-4 经用户确认 |
| 4 | PR 规划 | ✅ | ⬜ | `prs/` 10 个 PR 文件；四项推进条件核查通过（第 4 项「无环」已由 progress-observer 独立复算） |
| 5 | PR 实现 | ⏸ | ⬜ | **2/10 已合并**（pr-001 / pr-005，两份 verifier 均 PASS）；pr-002 任务图已落，派发 dev 中 |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 并发配置（阶段 5）

- **起始并发数**：3
- **硬上限**：5
- **当前有效上限**：5（已因 2 次槛位释放爬升至硬上限）
- **累计槛位释放次数**：2
- **已派发总数**：3

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-sdk-error-contract-and-web-channel.md | （无） | ✅ | feat/0025-pr-001-… | ✅ `f9327ad` | 已释放 |
| pr-002-sdk-router-uds-channel.md | pr-001-… | ⏸ | feat/0025-pr-002-sdk-router-uds-channel | ⬜ | 占用 |
| pr-003-sdk-entry-surface-cli-and-doctor.md | pr-001-…, pr-002-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-004-sdk-dual-entry-and-hub-harness.md | pr-003-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-005-hub-skill-and-content-check.md | （无） | ✅ | feat/0025-pr-005-… | ✅ `4be4661` | 已释放 |
| pr-006-sdk-surface-coverage-test.md | pr-003-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-007-sdk-api-behavior-test.md | pr-004-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-008-sdk-uds-behavior-test.md | pr-004-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-009-sdk-cli-contract-test.md | pr-004-… | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-010-sdk-doctor-test.md | pr-003-…, pr-004-… | ⬜ | | ⬜ | 排队(依赖未满足) |

> 「已合并」列填**该 PR 的 merge commit**；worktree 分支的 tip 是该 PR 自身最后一个提交，两者不同属正常。

## 待确认项

（无）

**跨 PR 接口契约（主 agent 冻结，下游按此接入）**：

- `oamp/sdk/errors.js` 导出 `HubError` / `classify(observation)` / `serializeError(err)`；`classify` 入参为带 `kind` 判别式的对象（`usage` / `connect` / `response-timeout` / `stream-ended` / `response{status,body}` / `wait-timeout` / `config` / `success`，未知 kind 抛错）
- `oamp/sdk/http.js` 导出 `request(spec)` / `stream(spec)`，`spec = {port, method, path, query, body, waitMs}`
- **pr-002 追加裁决（2026-09-15 15:30:49）**：① `connect({…, onDeliver})` 对 `message.deliver` 恒回传输层应答 `{received:true, message_id}`，**不做自动 ack**，由调用方显式 `ack()`；② `uds.js` 用 `loadConfig(env).socketPath` 解析地址，但须在 `connect()` 内**惰性动态 import** `config.js`，把 import / 解析失败经 `classify` 映射为 `CONFIG_ERROR`

## 更新日志

- 2026-09-15: 工作流启动；阶段 1 内联执行完成；阶段 2 `prd` / 阶段 3 `architect` / 阶段 4 `pr-planner` 依次完成
- 2026-09-15: 方案确认门通过；用户授权阶段 5
- 2026-09-15: 阶段 1~4 产物提交至迭代分支（`4d162d7`）；并发配置初始化；首批 worktree 建立（pr-001 / pr-005）
- 2026-09-15: **pr-001 与 pr-005 完成全链**（planner → dev → verifier → merge），两个 verifier 结论均 PASS；合并 `f9327ad` / `4be4661`；槛位释放 ×2
- 2026-09-15: 依赖图重扫 → pr-002 解锁，建立 worktree 并派发 `planner`；`progress-observer` 做独立核实
- 2026-09-15: **修正 progress-observer 发现的记录漂移**——补记 history 缺失事件；把状态/历史视图提交到迭代分支（此前它们只是工作区改动，导致按 ref 读到的视图落后一个阶段）；就 pr-002 planner 报来的两项阻塞作出裁决
