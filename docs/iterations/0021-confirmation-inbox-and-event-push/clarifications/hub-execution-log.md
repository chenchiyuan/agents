# hub 派发执行过程日志（0021 迭代）

本迭代按用户指令「agent 任务请使用 hub api 执行，记录下执行过程」运行：workflow-pb 的全部角色任务经 oamp 调用面派发到集群角色实例，本文件逐次记录。

| # | 时间 | 阶段 | 角色 | 实例 | call_id | 模式 | 状态 | 耗时 | 证据 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-13 11:27 | 阶段 1 | demand | pb-demand | `task-34713cc0-d0d9-4874-bbb4-41a08f0465e0` | background | **completed**（truncated） | 129437ms | 对话 `chat-ad0d43df-6d43-428e-bfc8-77e4308624ae`；简报 `/tmp/brief-demand-0021.txt`（22558 B） |

## 派发机制说明（本迭代的固定做法）

- **通道**：`POST http://127.0.0.1:7788/api/calls`，`agent` 传**角色名**（由调用面按 `role` 字段解析到在线实例 `pb-<role>`）；`task` 传**完整简报文本**（角色定义全文注入 + 简报字段 + 工作目录纪律）。
- **对话的用途**：对话（chat）是角色上下文的载体——上下文池键 =（chat_id, agent_id），故**同一角色跨轮复用同一对话即上下文延续**（用于 demand 的多轮澄清）；需要隔离的角色任务另开对话。
- **进度观测**：`GET /api/calls/<call_id>`（终态信封）与 `GET /api/calls/<call_id>/transcript`（过程条目，含 `started`/`result` 与流式增量）。
- **不可对话的补偿**：集群角色无法直接与用户交互 ⇒ 其**回复正文**由主 agent 转呈用户；用户答复经主 agent 在同对话追派下一轮。
- **工作目录纪律**：集群实例 cwd = 仓库主工作区（main）⇒ 每次简报强制「绝对路径 + `git -C <工作区地址>`」，派发后由主 agent 核验产物落点与三处 `git status`。

## 第 1 轮结果（call `task-34713cc0-d0d9-4874-bbb4-41a08f0465e0`）

- 状态：`completed`，`duration_ms=129437`，`model=deepseek/deepseek-v4-flash`，`truncated=true`（正文超上限被截断）
- **完整正文的取回方式（重要）**：`truncated=true` 时信封 `text` 不完整 ⇒ 从 `GET /api/calls/<id>/transcript` 的 `entries[]`（`detail.text` 流式增量 + `detail.event='result'` 终态体）重建全文（本次重建 7995 字符，entries=1001）
- 产物：`clarifications/demand-round-1-proposals.md`（9 提案 + 5 方案雏形询问 + 12 待裁决项）
- 纪律核验：① 本迭代工作区新增该文件；② 仓库主工作区 `git status --porcelain -uall` = **空**；③ 无其他工作区改动 ⇒ **工作目录纪律未被违反**
| 2 | 2026-09-13 11:35 | 阶段 1 | demand（第 2 轮） | pb-demand | `task-f9177ca6-880c-433f-87b0-134e6ee2a829` | background | **completed**（truncated） | 79452ms | 产出 `demand.md` v1.0.0（21695 B） |
| 3 | 2026-09-13 11:41 | 阶段 1 | demand（第 3 轮） | pb-demand | `task-f77851f3-3b4a-4888-8295-ff0707d9dbee` | background | **completed** | 112635ms | 就地更新 `demand.md` → v1.1.0（15 项裁决落定、`[待裁决]` 归零） |

## 累计

- 派发次数 3（阶段 1）／全部 `completed`（0 失败、0 挂起）
- 累计执行时长 ≈ 321.5s（129.4 + 79.5 + 112.6）
- 单轮最大 `truncated=true` 的处理：从 transcript `entries[].detail.text` 重建全文（见上）
- **工作目录纪律**：3 轮全程仓库主工作区零改动（每轮派发后核验）
