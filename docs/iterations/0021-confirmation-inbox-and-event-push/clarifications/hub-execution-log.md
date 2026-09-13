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

## 用户约束：同迭代同 chat（2026-09-13，用户原话）

> 「我希望同迭代在同chat中。不用新建chat来对话，这条得记录下。我后续会约束」

- **规则**：一个迭代**只用一个对话**承载全部角色派发；**不得**为每个角色新建对话。
- **统一对话（本迭代）**：`chat-ad0d43df-6d43-428e-bfc8-77e4308624ae`（0021 迭代对话）。
- **为什么各角色上下文不会混**：上下文池键 =（chat_id, agent_id）⇒ 同一对话内，不同角色实例各自持有独立会话上下文。
- **本迭代的过渡例外（登记）**：第 4 次派发（prd 阶段 2）发生在该约束下达**之前**，落在 `chat-76db2a03-2832-4c08-8f21-19f6255f1262`（因当时按「一角色一对话」创建）。该次不重做；**其余一切派发（含 prd 的后续轮次）一律使用统一对话**，prd 后续轮如需延续上下文，由主 agent 在简报中重述所需背景（其产物在磁盘上，可自行读取）。
| 4 | 2026-09-13 12:01 | 阶段 2 | prd（首轮） | pb-prd | `task-1bbae265-f8f1-44fb-8d96-bd5a473ab104` | background | **completed**（truncated） | 203743ms | 产出 `prd.md` + 12 卡（F01~F12）+ `clarifications/prd-round-1.md`；对话 `chat-76db2a03-…`（**过渡例外**） |
| 5 | 2026-09-13 12:09 | 阶段 2 | prd（第 2 轮） | pb-prd | `task-95038b97-ee3a-47d2-9830-5dc4bc3bf06b` | background | **completed** | 129410ms | 对话 `chat-ad0d43df-…`（**统一对话**）；并 5 项 MI 裁决 |
| 6 | 2026-09-13 12:16 | 阶段 3 | architect | pb-architect | `task-5d13d79c-fadf-4478-b6cb-f5cfd0f5907c` | background | **failed（timeout）** | 300841ms | 对话 = 统一对话；错误 `session/prompt 超时（300000ms）` |
| 7 | 2026-09-13 12:28 | 阶段 3 | architect | pb-architect | `task-ec3d248a-5fe0-4bc9-bb97-4d913a31b082` | background | 中断（集群重启） | ~120s | 分轮策略首轮；因抬高超时上限重启集群被中断 |
| 8 | 2026-09-13 12:56 | 阶段 3 | architect | pb-architect | `task-561dacf7-f9f7-4425-9333-bf368af2babd` | background | **completed** | 217040ms | **交付 `architecture.md` 736 行**（T-01~T-16 = 16/16；L1 四条 + 1 项覆盖疑问） |
| 9 | 2026-09-13 13:12 | 阶段 3 | architect（第 2 轮） | pb-architect | `task-5c27b3e9-79f6-4078-877a-ae8c6f56e1a9` | background | **completed** | 91985ms | 并入 L1 裁决与 **M1~M4 实测证据**；`architecture.md` → **821 行**；新增「答复链路修复」义务 |
| 7 | 2026-09-13 12:28 | 阶段 3 | architect | pb-architect | `task-ec3d248a-5fe0-4bc9-bb97-4d913a31b082` | background | 中断（集群重启） | ~120s | 分轮策略首轮；因用户指示抬高超时上限而重启集群，该轮被中断 |

## ⚠️ 实测约束：hub 派发的单轮硬上限 = 5 分钟（2026-09-13，第 6 次派发暴露）

**现象**：architect 阶段 3 首轮在 300.8s 被终止，信封 `state=failed`、`error=timeout`、`text="session/prompt 超时（300000ms）"`；agent 侧日志随后出现 `CONTEXT_RESET error=timeout`——**该角色在本对话的上下文被重置**（下一轮需在简报中重述背景）。

**根因（证据）**：
- `oamp/src/acp-client.js` → `prompt(text, { …, timeoutMs = 300000 })`：**常驻会话单轮 prompt 默认上限 5 分钟**，超时即 cancel → 宽限 → kill 该轮。
- `oamp/src/agent.js` → `DEFAULT_OMP_TIMEOUT_MS = 300000`，且任务体可带 `timeout_ms`（校验范围 **1~600000**）⇒ 理论上限 10 分钟。
- **但调用面不暴露 `timeout_ms`**：`POST /api/calls` 的受理字段为 chat_id / agent / task / tasks / mode / model / output_schema / schema_mode / context（architecture §3.14）⇒ 经 hub 调用面派发的每一轮**实际封顶 5 分钟**。

**对本迭代执行方式的后果（已按此调整）**：
1. **大任务必须分轮**：单轮只做「探索 + 部分产出」，不得把"读完整个代码库 + 写完长篇架构文档"压进一轮。
2. **先落盘、后补写**：要求角色**先写文件骨架**（哪怕内容待补），再逐节增量补写 ⇒ 超时也能保住部分产出（本次失败即因全程只探索、零落盘）。
3. **减少探索面**：简报直接给关键文件与行区间，减少全仓 grep 扫描。
4. **上下文重置的补偿**：失败后重派时，简报必须重述背景与已产出物路径（本迭代已按此处理）。
5. **登记为下一迭代候选**：调用面是否应暴露 `timeout_ms`（或提供分轮/续跑语义）——本迭代不实现（超出其 12 张卡范围）。

## 超时上限调整（2026-09-13，用户指示「先把时间提高到30分钟，这里记录，后续需要优化」）

**动作**：主 agent 直接修改运行时代码（**流程基建，不属于本迭代 12 张卡的产品范围**），提交 `d84b2be`（main）：

| 位置 | 改动 |
|---|---|
| `oamp/src/acp-client.js` | `prompt()` 默认 `timeoutMs` 300000 → **1800000**（30 分钟） |
| `oamp/src/agent.js` | `DEFAULT_OMP_TIMEOUT_MS` 300000 → **1800000**；`MAX_TIMEOUT_MS` 600000 → **1800000** |
| `oamp/README.md` | 两处口径同步（`timeout_ms` 上限 600000→1800000；omp 默认超时 300s→1800s） |
| `oamp/src/web.js` | 对账软 TTL 注释订正（其「覆盖 agent 侧 300s 上限有余」的前提已变 ⇒ 覆盖关系由「有余」变「持平」） |

**生效方式**：集群 `cluster down` → `cluster up`（`pb-*` 10 个实例全部重启，2026-09-13 11:57 就绪）。

**验证**：`node --check` 三文件通过；oamp 全量回归 **285/285**（另一次 284/285 的失败经复跑不可复现，为既有负载 flake）。

**遗留待优化（用户已明示"后续需要优化"）**：
1. **对账软 TTL**（`web.js` `RECONCILE_TTL_DEFAULT_MS` = 30 分钟）与新的 30 分钟单轮上限**已持平**——长任务的补拉窗口是否够用需重新评估。
2. **调用面未暴露 `timeout_ms`**：现在靠"抬高全局默认"实现 30 分钟；更干净的做法是让调用面按次传 `timeout_ms`（或提供分轮/续跑语义），避免全局默认被单次需求牵引。
3. 本迭代自身的执行记录（本次失败 → 调整 → 重派）可作为「hub 派发单轮上限」议题的真实样本。
| 10 | 2026-09-13 13:20 | 阶段 4 | pr-planner | pb-pr-planner | `task-d050e792-c248-4806-8ec9-9d892ea75768` | background | **completed** | 306775ms | **4 个 PR**；依赖图 `pr-001→pr-002`、`pr-003→pr-004`；首波可并发 {pr-001, pr-003}；提交 `ad47ea0` |
| 11 | 2026-09-13 13:27 | 阶段 4 | verifier（Gate） | pb-verifier | `task-dc76f986-31cf-4bfd-bedb-1442f73445d7` | background | **completed** | 230214ms | Gate **PASS 11/11**；报告 `verify-stage4-gate-20260913-122303.md` |
| 12 | 2026-09-13 13:36 | 阶段 5 首波 | planner（pr-001） | pb-planner | `task-aa2957f0-503b-4dc8-b72e-6d325c36653f` | background | **completed** | ~180s | 产出 `prs/pr-001-tasks.md`（18.6KB） |
| 13 | 2026-09-13 13:36 | 阶段 5 首波 | planner（pr-003） | pb-planner | `task-fdab6b60-efe2-4114-b648-f21b77a465ff` | background | **completed** | ~360s | 产出 `prs/pr-003-tasks.md`（21.1KB）；**与 #12 同批并发** |
| 14 | 2026-09-13 13:50（时标含固定偏移，见文末订正） | 阶段 5 首波 | dev（pr-001） | pb-dev | `task-611698ac-6016-4854-b01b-57333c091936` | background | **completed（但零落盘）** | 565058ms | 终态信封 `state=completed`、`truncated=false`，正文为过程叙述；**PR worktree 零提交、零未提交改动 ⇒ 无实现产物**（主 agent 复核，见 `history.md` 12:41 条） |
| 15 | 2026-09-13 13:50（时标含固定偏移，见文末订正） | 阶段 5 首波 | dev（pr-003） | pb-dev | `task-ad76744f-6c6b-499d-a5cf-19a73ef79e50` | background | **failed（context_crashed）** | 565059ms | 信封 `state=failed`、`error=context_crashed`、`text="ACP error: Internal error"`；零落盘（主 agent 复核） |

## ⚠️ 模式切换（2026-09-13，用户指令）

> 用户原话：「此次迭代改为本地sub agent执行，不走hub。」

- **切换生效点**：阶段 5 首波的两个 dev 调用（#14 `task-611698ac…` / #15 `task-ad76744f…`）**之后**的全部派发。
- **hub 阶段的范围（本文件即其记录）**：阶段 1 → 阶段 5 首波 dev，共 **15 次调用**（含 1 次 timeout 失败、1 次被集群重启中断），全部逐条留痕如上。
- **在飞处置**：切换时在飞的 2 个 dev 调用不中止（各写各的 PR worktree、零重叠），其产物照常接受；若有失败，该 PR 剩余工作由本地 sub agent 接力。
- **hub 阶段的可复用产出**（不因切换而作废）：`probe-always-ask.mjs`（M4 探针，已入库）、M1~M4 实测证据、以及本文件记录的「单轮 5 分钟上限 → 已抬至 30 分钟」全过程。

## 时标订正说明（2026-09-13，主 agent 于阶段 5 核实后补记）

**事实**：本文件表内 #6~#15 的时间列曾按一个**偏移时钟**记录（较真实本地时钟超前约 78 分钟）；本文件自身最后一次落盘提交 `bd39abb` 的 committer time = **12:40:17**，却含 12:56~13:50 的行 ⇒ 行内时标与落盘时刻自相矛盾（`progress-observer` 于阶段 5 独立核实发现，见 `progress.md` §5）。

**订正**：本文件**不再改写已记录的行内时间**（保留原始记录，以免二次失真）；凡涉及提交/合并的时间，一律以对应 **commit 的 committer time 为权威时间**。据此的真实时刻：阶段 5 首波 planner 产出提交 = `27eef14` / `a5b2043`（12:30:45）；首波 dev 派发 = 12:31:18（`a779ebd`）；执行模式切换 = 12:40:17（`bd39abb`）；#14/#15 的终态判定 = 主 agent 阶段 5 复核（`history.md` 12:41 条）。自 `history.md` 的 12:42 条目起，时标一律按 `date` 实测记录。
