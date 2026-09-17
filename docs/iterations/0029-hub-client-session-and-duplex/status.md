# status.md — 0029-hub-client-session-and-duplex

**工作流**: workflow-pb v0.13.0
**迭代**: 0029-hub-client-session-and-duplex
**当前阶段**: 独立验证（阶段 6）· 迭代级验证已派发
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
| 5 | PR 实现 | ✅ | ⬜ | **8/8 PR 全部合并**（pr-001~008）；两轮独立验收（pr-005 partial 证据文本已修缮、pr-007 partial 纯文档已修）|
| 6 | 独立验证 | ⬜ | ⬜ | — |

## 并发配置（阶段 5）

- **起始并发数**：3（默认值）
- **硬上限**：5（`2 × 起始并发数 - 1`）
- **累计槛位释放次数**：8（**全部 8 个 PR 已合并**）
- **当前有效上限**：5（`min(3 + 5×3, 5)`，维持硬上限）
- **已派发总数（hub 通道，统计至 D-19 切换点 22:30）**：7（pr-001~pr-005 的 planner/dev/verifier 等，逐条见下表）
- **本地 subagent 通道（D-19 之后）**：新起 7 个 agent（`Pr005Finisher` / `Pr005Verifier` / `Pr006Builder` / `Pr006Verifier` / `Pr007Builder` / `Pr007Verifier` / `FinalVerifier`），另有若干次「唤醒续做」（如 pr-005 名册剔除、pr-006 复选框、pr-007 文档修复）；逐条见 `history.md`

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-router-status-primitives.md | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-002-session-registries.md | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-003-sse-transport-additions.md | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-004-console-call-stream-stop.md | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-005-web-session-and-call-surface.md | pr-001、pr-002、pr-003 | ✅ | (已清理) | ✅ | 已释放 |
| pr-006-protocol-docs-and-index.md | pr-005 | ✅ | (已清理) | ✅ | 已释放 |
| pr-007-hub-entries-and-skill-lists.md | pr-001、pr-005〔调度附加约束已满足：pr-006 已合并 `22f6859`〕 | ✅ | (已清理) | ✅ | 已释放 |
| pr-008-friction-log-completion.md | （无） | ✅ | (已清理) | ✅ | 已释放 |

## 派发台账

**口径**：本迭代**所有派发一律经 `hub`**（`oamp/skill/hub.md`，遵守其四条红线）。本表同时是 **F18 验收 2/3 / D-13 体感度量** 的载体，逐行回答三问：**① 是否需额外盯守 ② 结果如何到手 ③ 耗时**。

| 时点 | 角色（节点） | 用途 | call_id | 终态 | ① 是否需盯守 | ② 结果到手方式 | ③ 耗时 | 实报 model |
|---|---|---|---|---|---|---|---|---|
| 14:17 | prd（`pb-prd`） | 阶段 2 · 功能规格 | `task-3d15749f` | failed（`timeout`，产物已完整） | **需**（30 分钟内多次人工查状态） | 我自建 `cli task watch`（摩擦①） | 30.0 min（**空耗 ~24 min**） | `deepseek/deepseek-v4-flash` |
| 14:47 | architect（`pb-architect`） | 阶段 3 · 技术架构 | `task-8a80a749` | failed（`timeout`，产物已完整） | **需**（靠 `ps`/日志取证判活性） | 首次误用 `nohup &`（**无自动送达**，DC-08a） | 30.0 min（**空耗 ~20 min**） | — |
| 15:14 | pr-planner（`pb-pr-planner`） | 阶段 4 · PR 规划 | `task-63f31c78` | failed（`timeout`，产物已完整） | **需**（同型） | **产物稳定器提前 ~21 min 推进** | 30.0 min（**空耗 ~26 min**） | — |
| 15:27 | verifier（`pb-verifier`） | 阶段 6 · 验 `prs/`（阶段 4 门口） | `task-08bac0b6` | completed | 不需 | 推送面 `call_result` | 3.5 min | `powerby/grok-4.6` |
| 15:32 | planner ×3（`pb-planner`） | 阶段 5 · pr-001/002/003 的 tasks | `task-251b7e7b` / `2a34ff72` / `3fbe57f1` | completed ×3 | 不需 | 产物面 + 推送 | 4.5 / 7 / 12 min（**实例串行**） | `deepseek/deepseek-v4-flash` |
| 15:37 | dev（`pb-dev`） | 阶段 5 · pr-001 实现 | `task-49b58dd8` | completed | 不需 | 推送面 | 14.3 min | `openai/gpt-5.6-luna` |
| 15:39 | dev | 阶段 5 · pr-002 实现 | `task-3a39e75d` | completed | 不需 | 推送面 | 18.9 min | `openai/gpt-5.6-luna` |
| 15:45 | dev | 阶段 5 · pr-003 实现 | `task-32302e96` | completed | 不需 | 推送面 | 22.0 min | `openai/gpt-5.6-luna` |
| 15:52 | verifier | 阶段 6 · pr-001 验收（首轮） | `task-43b380ca` | completed（**FAIL**） | 不需 | 推送面 | 7.0 min | `powerby/grok-4.6` |
| 15:58 | verifier | 阶段 6 · pr-002 验收（首轮） | `task-370c1288` | completed（**FAIL**） | 不需 | 推送面 | 2.9 min | `powerby/grok-4.6` |
| 16:07 | verifier | 阶段 6 · pr-003 验收（首轮） | `task-a87a7c03` | completed（**FAIL**） | 不需 | 推送面 | 4.4 min | `powerby/grok-4.6` |
| 15:37–16:32 | dev ×6（`pb-dev`） | 阶段 5 · pr-001/002/003 返工（证据形态） | `88d09f25` / `b7bd0a9c` / `8c97d4bd` / `7207f08a` / `efcf2e6b` / `37a215fe` | completed（其中 `efcf2e6b` 记录脱落，判未落地后重派） | 不需 | 推送面 | 20.3 / 29.6 / 12.5 / 20.3 / — / 18.5 min | `openai/gpt-5.6-luna` |
| 16:20 | verifier | 阶段 6 · pr-001 重验 | `task-509a1241` | completed（**FAIL**，仅标准 3） | 不需 | 推送面 | 2.8 min | `powerby/grok-4.6` |
| 19:22 | dev | 阶段 5 · pr-001 收尾修复 | `task-eba25366` → 重派 `task-5393eaed` | failed（`context_crashed`，DC-21）→ completed | 不需 | 推送面 | 0 → 20.3 min | `openai/gpt-5.6-luna` |
| 19:23 | dev | 阶段 5 · pr-002 返工#2 | `task-c3cdaff6` | completed | 不需 | 推送面 | 10.2 min | `openai/gpt-5.6-luna` |
| 19:33 | verifier | 阶段 6 · pr-002 重验 | `task-afc70338` | completed（**PASS** ⇒ 合并 `cfb6736`） | 不需 | 推送面 | 4.6 min | `powerby/grok-4.6` |
| 19:42 | verifier | 阶段 6 · pr-003 重验 | `task-cc60948d` | completed（**PASS** ⇒ 合并 `f8f382a`） | 不需 | 推送面 | 3.6 min | `powerby/grok-4.6` |
| 19:38 | planner ×2 | 阶段 5 · pr-004 / pr-008 的 tasks | `task-c48ac1f4` / `task-5c579e20` | completed ×2 | 不需 | 推送面 | 4.6 / — min | `deepseek/deepseek-v4-flash` |
| 19:43 | dev | 阶段 5 · pr-004 实现 | `task-7553a07d` | completed（⇒ 合并 `4c6ddba`） | 不需 | 推送面（自动送达） | 22.9 min | `openai/gpt-5.6-luna` |

**台账范围**：本表记录**统计至 D-19 切换点（2026-09-16 22:30）之前的 hub 派发**；此后阶段 5 余下实现与阶段 6 验证经用户裁决改用**本地 subagent**（`demand.md` D-19），其派发与续做记录见 `history.md`（同表口径的三问在本地通道下为：① 是否需盯守=不需 ② 结果到手=任务直接回报 ③ 耗时=各 subagent 回报值）。

**体感基线（用于 D-13 对照）**：**阶段 2~4 的三条长调用全部"需盯守"且空耗 ≈70 分钟**（产物早已落盘、调用仍烧满 30 分钟）；**阶段 5 起改用推送订阅（`api stream calls`）后，所有调用均"不需盯守"、结果自动到手**——这正是本迭代要交付的形态，实测对比见上表 ① 列由「需」转「不需」。

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
- 2026-09-16: 方案确认门通过（用户确认按起始并发 3 进入阶段 5）；阶段 4→5 入口按 §验证触发时机先派 `verifier` 验 `prs/`；产物入库提交 `72b659f`；建 `pr-001/002/003` 三个 PR worktree
- 2026-09-16: 阶段 4 验证 verdict PASS（2 partial：缺边 pr-007→pr-006 转调度约束；pr-005 可审查性/独立性登记为结构性张力）；阶段 5 首批派发 pr-001/002/003 planner
- 2026-09-16: pr-001 首轮独立验收 **FAIL**（标准3 证据为散文 / 标准1 partial 缺基线对照；标准2 的「tasks 文件不在文件范围」已由主 agent 改判为计划陈述缺口 DC-18）⇒ 派 dev **返工**（同 worktree/分支，**现场保留**）
- 2026-09-16: **pr-002 独立验收 PASS ⇒ 合并进迭代分支 `cfb6736`**（首个合并）；槛位释放 1、有效上限升至 5；补位派发 pr-004/pr-008 的 planner
- 2026-09-16: **pr-003 独立验收（重验）PASS ⇒ 合并 `f8f382a`**；槛位释放累计 2、有效上限维持 5
- 2026-09-16: **pr-001 第二次重验 PASS ⇒ 合并 `51eb893`**；槛位释放累计 3；**pr-005 解锁**（依赖三条经合并提交祖先链 + 代码符号双重校验）并派其 planner
- 2026-09-16: **pr-004 独立验收 PASS ⇒ 合并 `4c6ddba`**；累计 4/8 已合并；槛位释放 4
- 2026-09-16: **pr-008 验收 PASS ⇒ 合并 `ecba11d`**（解冲突：pr-008 条目改号 DC-23）+ 修复截断事故 `aa6bd02`；累计 **5/8** 已合并
- 2026-09-16: **pr-005 验收 PASS ⇒ 合并 `b090369`**（迭代分支路由 21→29）；累计 **6/8**；pr-006 解锁并派本地 subagent
- 2026-09-16: **pr-006 验收 PASS ⇒ 合并 `22f6859`**（API.md §3 = 29 节）；累计 **7/8**；**pr-007 解锁**（含调度附加约束已满足）并派本地 subagent
- 2026-09-17: **pr-007 验收 PASS ⇒ 合并 `860fa2a`**（8/8 全部合并；迭代分支相对 main 12 文件 / 1365 增 / 48 删）；阶段 6 迭代级验证已派本地 subagent
