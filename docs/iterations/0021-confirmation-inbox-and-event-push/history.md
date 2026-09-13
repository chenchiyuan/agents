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
