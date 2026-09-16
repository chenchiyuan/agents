# status.md — 0029-hub-client-session-and-duplex

**工作流**: workflow-pb v0.13.0
**迭代**: 0029-hub-client-session-and-duplex
**当前阶段**: PR 规划（阶段 4）完成 ⇒ **方案确认门待用户确认**
**阶段 2 结果**: 产物完整（`prd.md` 30089 B + 20 卡）；**prd 调用终态 failed（error=timeout，30 分钟上限）**，报告未回——按 D-14（产物为权威）以产物推进
**迭代分支**: iteration/0029-hub-client-session-and-duplex
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex
**状态**: 等待确认（方案确认门）
**history**: 开启
**方案确认门**: enabled
**一句话目标**: 把"连接到 hub"做成一等入口（客户端会话），让 hub 与 hub 纳管的 agents **像 subagent 一样好用**（一次派发、无需盯守、结果到手），并保证**重启可恢复**

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0：D-1~D-14 **全部 `user_confirmed`**（D-4/D-6/D-14 经用户逐条确认）；F-1~F-10 实测事实；否决路径 5 条 |
| 2 | 功能规格 | ✅ | ✅ | `prd.md` + **20 张卡（F01~F19 + G01）**；主 agent 核产物：卡 100% 带『来源』行、双向覆盖表齐、**A-01~A-14 架构待填已登记**、卡内无架构决策；**11 项 `model_inferred` 逐条确认（11/11 采纳）** |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md`（49769 字符）：A-01~A-14 逐项答案 + 追溯、§6 零影响声明、§8 剃刀检验；`prd.md` 14 行已回填；**L1-01 / L1-02 经用户确认（2026-09-16）** |
| 4 | PR 规划 | ✅ | ⬜ | **8 个 PR** 全七字段；覆盖 19/20 卡（未覆盖 F04 系 D-16 出范围）；文件范围 21 条两两不重叠；**依赖无环、无悬挂**；**关键路径 = 3**（≤3）；并发可行性通过；无 `split-suggestion.md` |
| 5 | PR 实现 | ⬜ | ⬜ | — |
| 6 | 独立验证 | ⬜ | ⬜ | — |

## 并发配置（阶段 5）

- **起始并发数**：3（默认值）
- **硬上限**：5（`2 × 起始并发数 - 1`）
- **累计槛位释放次数**：0
- **当前有效上限**：3
- **已派发总数**：0

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-router-status-primitives.md | （无） | ⬜ | feat/0029-pr-001-router-status-primitives | ⬜ | 排队(等待槛位) |
| pr-002-session-registries.md | （无） | ⬜ | feat/0029-pr-002-session-registries | ⬜ | 排队(等待槛位) |
| pr-003-sse-transport-additions.md | （无） | ⬜ | feat/0029-pr-003-sse-transport-additions | ⬜ | 排队(等待槛位) |
| pr-004-console-call-stream-stop.md | （无） | ⬜ | feat/0029-pr-004-console-call-stream-stop | ⬜ | 排队(等待槛位) |
| pr-005-web-session-and-call-surface.md | pr-001-router-status-primitives.md、pr-002-session-registries.md、pr-003-sse-transport-additions.md | ⬜ | feat/0029-pr-005-web-session-and-call-surface | ⬜ | 排队(依赖未满足) |
| pr-006-protocol-docs-and-index.md | pr-005-web-session-and-call-surface.md | ⬜ | feat/0029-pr-006-protocol-docs-and-index | ⬜ | 排队(依赖未满足) |
| pr-007-hub-entries-and-skill-lists.md | pr-001-router-status-primitives.md、pr-005-web-session-and-call-surface.md | ⬜ | feat/0029-pr-007-hub-entries-and-skill-lists | ⬜ | 排队(依赖未满足) |
| pr-008-friction-log-completion.md | （无） | ⬜ | feat/0029-pr-008-friction-log-completion | ⬜ | 排队(等待槛位) |

## 派发台账

| 时点 | 角色（节点） | 用途 | call_id | 终态 | 实报 model | truncated |
|---|---|---|---|---|---|---|

**口径**：本迭代的**所有派发一律经 `hub`**（`oamp/skill/hub.md`，遵守其四条红线）；台账同时作为 D-13「hub 体感」的度量载体——每行额外记录**结果到手方式**（自动送达 / 主动查询 / 阻塞等待）。

| 时点 | 角色（节点） | 用途 | call_id | 终态 | 实报 model | 结果到手方式 |
|---|---|---|---|---|---|---|
| 14:17 | prd（`pb-prd`） | **阶段 2 · 功能规格**（demand.md → prd.md + prd/*.md） | `task-3d15749f-6a37-49d7-a1b0-870ce78f5e26` | **failed**（`error=timeout`，30.0 分钟命中节点上限；**产物已完整**，报告未回） | `deepseek/deepseek-v4-flash` | **我自建 `cli task watch` 拉起等待**＝摩擦①（+ 报告未回⇒只能靠**产物**判定成败＝摩擦③） |
| 14:47 | architect（`pb-architect`） | **阶段 3 · 技术架构**（prd.md + prd/*.md → architecture.md） | `task-8a80a749-6edf-447a-a862-74ba85fefbf3` | **failed**（`error=timeout`，30.0 分钟上限；产物 14:57 已完整，报告未回） | — | 我自建 `cli task watch`（**首次误用 `nohup &` 无自动送达**，见 DC-08a） |
| 15:14 | pr-planner（`pb-pr-planner`） | **阶段 4 · PR 规划**（architecture.md + prd/*.md → prs/pr-NNN.md） | `task-63f31c78-993d-4303-8089-113122ee0271` | 在途 | — | （观测中） |

**体感基线（派发时记录，用于 D-13 对比）**：派发即时返回 `call_id`（0.08s）；但**要拿到结果必须由我自己拉起一个等待进程**（本次用 hub 自带的 `cli task watch`，而非自建 watchdog）。理想形态是"结果自动到手、无需拉起等待"——这正是本迭代要实现的能力，因此本次记录为 **`需人工/编排层拉起等待` = 摩擦点 ①**。

## 待确认项

- [x] **MI-1~MI-11**（prd 的 11 项 `model_inferred`）逐条确认，**11/11 采纳**（2026-09-16）
- [x] **D-15** 效果#3 / 效果#5 两处措辞按落卡口径收窄（2026-09-16）
- [x] **D-16** 订阅第二形态（F04）出本迭代，只交付 SSE（2026-09-16）
- [x] **D-17** hub 使用面文档修复**升格为交付项**（新增卡 F19）（2026-09-16）
- [x] **D-18** 事件类命名对应 / 三态承载形态**交阶段 3**（2026-09-16）

- [x] **D-4** 收件箱保留期 = 跟随状态寿命（2026-09-16 用户确认）
- [x] **D-6** 自派发拦截 = 先告警不硬拒（2026-09-16 用户确认）
- [x] **D-14** 权威归属 = 产物与 DB 为准、hub 登记为易失视图（2026-09-16 用户确认）

## 本迭代的体感目标（D-13）与当前已知摩擦

| 目标 | 当前状态（迭代开始时实测） |
|---|---|
| 一次派发、无需盯守、结果自动到手 | ❌ 需要 watchdog 或轮询；`stream call` 终态不退出 |
| 像 subagent 一样使用 | ❌ harness 未导出会话身份；层 A 无身份通道；等待语义未统一 |
| hub skill 能指导正确用法 | ⚠ `skill/hub.md` 的「序列 1」只教"派发 → `calls get`"，未提 `--mode block` / `cli task watch` |
| **（stage-2 实测追加）** 结果到手 | ❌ 无自动送达：本次靠**自行拉起** `cli task watch` 才拿到终态（摩擦①） |
| **（stage-2 实测追加）** 进度可见性 | ❌ 无进度投影：调用"还在跑/已卡死"在 hub 观测面上**不可区分**，只能靠 `ps`/`lsof`/日志 mtime 做进程取证（摩擦③） |
| **（stage-2 实测追加）** 成败判定 | ⚠ 报告未回时只能以**产物**判定（本次即如此）——hub 未把"产物已落盘"作为可查询事实 |

## 更新日志

- 2026-09-16: 阶段 1 完成（`demand.md` v1.0.0，D-1~D-14 全 `user_confirmed`）
- 2026-09-16: 阶段 2 派发 `prd`；产物达标（`prd.md` + 20 卡）；**以产物为据推进**（prd 调用终态 failed/timeout）
- 2026-09-16: 用户裁决 D-15~D-18（措辞收窄 / 第二形态出本期 / 新增交付项 F19 / 两项疑问交阶段 3）+ MI 11/11 采纳
- 2026-09-16: 阶段 3 派发 `architect`；产物达标（`architecture.md`）；**L1-01 / L1-02 / O-1 经用户确认** ⇒ 阶段 3 完成
- 2026-09-16: `status.md` 对齐 `data/formats.md` §状态追踪协议（补 `**history**` 字段、PR 实现子状态表、更新日志）
- 2026-09-16: 阶段 4 派发 `pr-planner`（严格按 §brief 构建 的字段格式；纠正 DC-07）
- 2026-09-16: 阶段 4 完成（8 PR，闸门七项机械核查全通过）；初始化阶段 5 并发配置（起始 3 / 硬上限 5）；**方案确认门待用户确认**
