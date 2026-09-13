# 历史记录（0021-confirmation-inbox-and-event-push）

> **记录协议**：每次派发执行角色、收到执行角色报告、做出阶段推进核查决策时逐条追加（workflow-pb v0.10.0「历史记录协议」）。
> **时标口径**：条目时间 = 记录时的本地时钟读数（`date` 实测）；凡涉及提交/合并的，以该条注明的 commit sha 的 committer time 为权威时间。

### 2026-09-13 · 调度决策 · 阶段推进核查

- 决策内容：**迭代 0021 启动**。依据用户新增需求（`clarifications/raw-request.md` 逐字）建立会话工作区 `.pb-agents/worktrees/0021-confirmation-inbox-and-event-push` + 迭代分支 `iteration/0021-confirmation-inbox-and-event-push`（base = main `854766c`）
- **执行方式决策（本迭代特有）**：按用户指令「agent 任务请使用 hub api 执行，记录下执行过程」——阶段 1~6 的全部角色任务改为经 hub API（`POST /api/calls`）派发到集群角色实例（`pb-demand`/`pb-prd`/`pb-architect`/`pb-pr-planner`/`pb-planner`/`pb-dev`/`pb-verifier` 等），不再使用宿主 harness 的子 agent 机制；每次派发在 `clarifications/hub-execution-log.md` 留一行（时间 / 角色 / call_id / 模式 / 终态 / 耗时 / 证据）
- **已知风险与对策**：集群实例的 cwd = 仓库根（main 工作区），**跨工作区写入风险真实存在**（迭代 0019 的 D-5 事故同源）⇒ 每次简报必须显式写入「工作目录纪律」段（绝对路径 + `git -C <工作区地址>`），且每次派发后由主 agent 核验三处 `git status` 与产物落点
- 触发依据：用户指令（2026-09-13）；workflow-pb「启动工作流」步骤 1~3

### 2026-09-13 · 派发 · demand（阶段 1）

- 派发通道：**hub API**（`POST /api/calls`，agent = `demand`）
- 任务：需求收敛（输入 = 用户 4 条原始表述）

### 2026-09-13 11:32 · 收到报告 · demand（第 1 轮）

- call `task-34713cc0-d0d9-4874-bbb4-41a08f0465e0`（`completed`，129437ms，`truncated=true`）
- 交付：`clarifications/demand-round-1-proposals.md`（草稿 v0 + 六维诊断 + 9 项提案 P1~P10 + 5 项方案雏形询问 Q1~Q5 + 12 项待裁决 + 产品现状实测 F1~F9）
- 关键实测：omp 的 `session/request_permission` 被 oamp **自动**答复（`acp-client.js:396-409`）；`onPermissionRequest` 钩子**生产零调用方**（`acp-client.js:73,85,416`）；全仓零通知/Service Worker 代码
- 越界：无（主工作区零改动；仅在本迭代工作区新建 1 个留痕文件）；自陈越界判断 1 处（P7/P10 贴近架构层）

### 2026-09-13 11:34 · 调度决策 · 阶段推进核查

- 决策内容：**12 项待裁决全部真实阻塞式转呈用户**（`ask`），用户逐项裁决完毕；其中 P5 与 P7 为用户**自定表述**（非选推荐项）：
  - P5 原话「新建通知服务，先走Notification。 后续可以扩展成web push」⇒ 需求形态升级为「**可扩展的通知服务 + 首个通道**」
  - P7 原话「默认阻塞且无上限，之后可以设置不同策略（比如使用默认选项，自动放行）」⇒ **用户明示接受挂起风险**，策略化留后续
- 处置：因 P7 裁决，demand 的 E4（原「超时后按档位收尾」）失效 ⇒ 裁定改为「默认无上限阻塞 + 策略可扩展」
- 记录：`clarifications/demand-round-1-verdicts.md`

### 2026-09-13 11:37 · 收到报告 · demand（第 2 轮）

- call `task-f9177ca6-880c-433f-87b0-134e6ee2a829`（`completed`，79452ms，`truncated=true`）
- 交付：`demand.md` **v1.0.0**（21695 B，两段齐备；12 项 `user_confirmed`；`model_inferred` 归零；另留 3 项 `[待裁决]` 空缺 T-1/T-2/T-3）
- 越界：无（主工作区零改动）

### 2026-09-13 11:40 · 调度决策 · 阶段推进核查

- 决策内容：**3 项 `[待裁决]` 空缺再次真实阻塞式转呈用户**并获裁决：T-1 = `deny` 档仍自动拒绝；T-2 = N1 只约束服务边界（厂商推送投递路径不在禁止范围）；T-3 = 刷新/断线后未裁决项必须在栏内

### 2026-09-13 11:46 · 收到报告 · demand（第 3 轮）

- call `task-f77851f3-3b4a-4888-8295-ff0707d9dbee`（`completed`，112635ms）
- 交付：`demand.md` **v1.1.0**（三项裁决并入 W/M/N/E 与 §6/§8；**`[待裁决]` 归零**；累计 15 项 `user_confirmed`）
- 越界：无（主工作区零改动）

### 2026-09-13 11:47 · 调度决策 · 阶段推进核查

- 决策内容：**阶段 1 → 阶段 2**。推进条件逐项核查（读 `demand.md` v1.1.0 自检段 + 主 agent 复核）：① **两段均有内容** ✅（第一段澄清依据 8 节 + 第二段五问齐备）；② **所有 `model_inferred` 经用户确认** ✅（归零；17 个问点 100% 用户裁决）；③ **无活跃冲突** ✅（§5 两处为派生措辞修订、§6 已闭合）。三项全满足
- 触发依据：workflow-pb §阶段 1~4 推进；`demand.md` v1.1.0 §8

### 2026-09-13 11:55 · 调度决策 · 阶段推进核查

- 决策内容：**记录用户新增的流程约束（其一）——「同一迭代只用一个 chat」**。原话：「我希望同迭代在同chat中。不用新建chat来对话，这条得记录下。我后续会约束」
- 处置：① 本迭代统一对话定为 `chat-ad0d43df-6d43-428e-bfc8-77e4308624ae`；② 后续全部派发（含各角色多轮）进该对话，**不再按角色新建对话**；③ 已发生的过渡例外（prd 阶段 2 首轮落在 `chat-76db2a03-…`，创建于约束下达前）**不重做**，登记在案；④ 约束写入 `status.md` 的「执行方式」段与 `clarifications/hub-execution-log.md`
- 说明：上下文池键 =（chat_id, agent_id）⇒ 同一对话内各角色上下文仍相互隔离，"一个对话"不影响角色独立性
- 触发依据：用户指令（2026-09-13，迭代执行中打断下达）
