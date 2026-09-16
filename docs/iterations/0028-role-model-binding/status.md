# 工作流进度

**工作流**: workflow-pb v0.13.0
**迭代**: 0028-role-model-binding
**当前阶段**: 阶段 4（PR 规划）
**迭代分支**: iteration/0028-role-model-binding
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding
**状态**: 进行中（方案确认门已通过；阶段 4 派发中）
**history**: 开启
**方案确认门**: enabled

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0：D-1~D-22 全部 `user_confirmed`；20:53 用户确认定稿 |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` v0.2.0 + 13 卡；A-01~A-05 待填；MI-1~MI-6 全部已确认；R-1~R-9 逐条核对通过（21:08） |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` 30829 字节（§0~§8，含 §7 自检、§8 补全记录）；A-01~A-05 全填；**L1 = 无**；执行异常（节点侧 30 分钟超时，call `task-191d2e14…`）已登记 G-9，产物在超时前完整落盘 |
| 4 | PR 规划 | ✅ | ✅ | `prs/` 10 个 PR 文件；Gate 验证 `clarifications/verify-20260915-221935.md` 结论 **PASS**（0 fail/1 partial/4 偏差，偏差均已在 history 裁定不阻塞；4 条下迭代候选）|
| 5 | PR 实现 | ⏸ | ⬜ | 并发配置已初始化；batch 1 已解锁 = pr-001 / pr-002 / pr-003 / pr-007（4 个，取前 3 派发）；详见「PR 实现子状态」|
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## PR 实现子状态（阶段 5 展开）

## 并发配置（阶段 5）

- **起始并发数**: 3
- **硬上限**: 5（公式 `2×起始-1`）
- **当前有效上限**: 3
- **累计槛位释放次数**: 0
- **已派发总数**: 3

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-iteration-artifacts-commit.md | （无） | ⏸ | feat/0028-pr-001-iteration-artifacts | ⬜ | 占用 |
| pr-002-role-model-binding.md | （无） | ⏸ | feat/0028-pr-002-role-model-binding | ⬜ | 占用 |
| pr-003-one-shot-backend-receipts.md | （无） | ⏸ | feat/0028-pr-003-one-shot-receipts | ⬜ | 占用 |
| pr-004-resident-backend-probes.md | pr-008 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-005-second-cluster-bring-up.md | pr-002 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-006-second-cluster-binding-evidence.md | pr-005 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-007-execution-gap-record.md | （无） | ⬜ | | ⬜ | 排队(等待槛位) |
| pr-008-dispatch-contract-audit.md | pr-006 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-009-existing-surface-freeze.md | pr-002, pr-004 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-010-post-merge-activation-evidence.md | pr-001, pr-002 | ⬜ | | ⬜ | 排队(依赖未满足) |

## 执行方式（本次迭代专用契约）

- **派发通道**：hub 已实现的调用面——`node <仓库根>/oamp/bin/hub.js api <子命令>`
- **等待终态**：正式派发用 `api calls create --mode block --wait 3600000`（**60 分钟**，2026-09-15 21:22 用户要求由 25 分钟上调；`--wait` 单独不阻塞，必须配 `--mode block`，见 **G-7**）；已存在的调用用 `api stream call <call_id>`；**不自建轮询或包装脚本（G-4）**。注意：客户端等待可设 60 分钟，但**节点侧单次执行仍有 30 分钟硬上限**（`src/agent.js:31-32`，调用面不传 `timeout_ms`，见 **G-9**）——超时后调用仍在服务端进行，客户端本地中止不代表调用被取消
- **chat 粒度（读法 (b)，21:05 用户确认）**：主集群承载阶段 2~6 全部派发；第二集群只承载 F05/F06/F07 的三条绑定实报
- **chat_id（阶段 2~6）**：`chat-6c89902c-0a9f-4513-a299-90a7f98ae611`（由 gpt 探针建立；标题已改为「【0028 迭代 · 多角色】role-model-binding（阶段 2~6 共用同一 chat）」）。注意 `chat.agent_id` 固定为建 chat 的 `pb-dev`（无修改端点，见 G-10）——核对派发目标须看**调用信封的 `agent` 字段**（本迭代已见 `dev` / `verifier` / `prd` / `architect`）
- **角色↔节点映射**：`--agent <role>` → oamp 节点 instance_id `pb-<role>`
- **模型真源**：角色级（`cluster.json` 的 `roles.<role>.model`）为唯一真源；正式派发不带 `model`（探针专用例外已于探针完成后关闭）
- **差距记录**：`docs/iterations/0028-role-model-binding/deferred-demand-changes.md`（三分区：需求变更 / 执行方式差距 G-1~G-10 / 澄清期冲突 C-1~C-4）
- **用户决策点通知通道（2026-09-15 21:10 用户要求，已落地）**：双通道——① hub 确认收件箱（`uds message.send` 上浮 `confirmation_request` → 控制台通知 + 在途项）；② 会话内「暂停格式」。裁决回传由主 agent 在会话内核持有的常驻 `main` 会话接收（SDK `createHub().uds.connect({onDeliver})` + 5s 心跳）

## 派发台账

| 时点 | 角色（节点） | 用途 | call_id | 终态 | 实报 model | truncated |
|---|---|---|---|---|---|---|
| 20:52 | dev（`pb-dev`） | 前置常驻探针（gpt，per-call model 例外） | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | completed（3607ms） | `openai/gpt-5.6-luna` | false |
| 20:56 | verifier（`pb-verifier`） | 前置常驻探针（grok，同 chat 第二条） | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | completed（4885ms） | `powerby/grok-4.6` | false |
| 20:56 | prd（`pb-prd`） | 阶段 2 首轮（含 D-22 对照组取证） | `task-8e84f95f-b783-4477-8054-abf0b36f31ec` | completed（366383ms） | `deepseek/deepseek-v4-flash` | **true**（G-5） |
| 21:06 | prd（`pb-prd`） | 阶段 2 定向修订轮（R-1~R-9） | `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb` | completed（119006ms） | `deepseek/deepseek-v4-flash` | **true**（G-5 聚合） |
| 21:09 | architect（`pb-architect`） | 阶段 3 技术架构 + A-01~A-05 补全 | `task-191d2e14-e852-412d-ab90-e6fc00092928` | **❌失败(超时·现场保留)**（1802661ms，「轮次超时（1800000ms）」，`error: timeout`） | —（超时未产生终态实报） | **true** |
| 22:03 | pr-planner（`pb-pr-planner`） | 阶段 4 PR 边界与依赖图 | `task-db950070-445a-492f-8f58-5bbd95c20c9f` | completed（817772ms） | `deepseek/deepseek-v4-flash` | **true**（G-5 聚合） |
| 22:17 | verifier（`pb-verifier`） | 阶段 4→5 入口门（阶段 6 独立验证 `prs/`） | `task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e` | completed（598437ms） | `powerby/grok-4.6`（异常，见 G-11） | false |
| 22:32 | planner（`pb-planner`） | 阶段 5 · pr-001 任务拆解 | `task-d76732bb-fd6c-480c-b1af-abd4f1726a3a` | completed（183086ms） | `deepseek/deepseek-v4-flash` | **true**（G-5 聚合） |
| 22:32 | planner（`pb-planner`） | 阶段 5 · pr-002 任务拆解 | `task-ece7344d-f237-4cde-b890-94bccfa0815c` | completed（345436ms） | `deepseek/deepseek-v4-flash` | **true**（G-5 聚合） |
| 22:32 | planner（`pb-planner`） | 阶段 5 · pr-003 任务拆解 | `task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068` | completed（475246ms） | `deepseek/deepseek-v4-flash` | **true**（G-5 聚合） |
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-001 实现（产物入库） | `task-4d88d08b-f977-4314-813e-e8dfc49c89df` | submitted（同轮并发 #1） | — | — |
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-002 实现（cluster.json 两键） | `task-4b8e1399-36ce-47e2-8a66-09293eb8725c` | submitted（同轮并发 #2） | — | — |
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-003 实现（三条一次性回执） | `task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e` | submitted（同轮并发 #3） | — | — |

## 待确认项

- [x] **通知链路自检**（`cfm-f1296d32-8025-4ad8-a367-f08579e53517`）：2026-09-15 21:12 用户在控制台裁决 `option_ids: ["seen"]`（已收到通知），裁决经 `message.deliver` 回传至主 agent 的常驻 `main` 会话，在途表随即清空 ⇒ **hub 通知服务链路端到端可用**

**MI 落定摘要**：MI-1 **改**（回执验收字段 = 命令 + 原始输出；耗时如实记录但不入判据）／MI-2 确认（补记 20:52 取证时配置无 `model` 键）／MI-3 确认（补"留存实报字符串"）／MI-4 确认（台账取 `status.md` 内最小表，即上表）／MI-5 确认（含 G-5 已记为缺口的后果）／MI-6 确认。

## 更新日志

- 2026-09-15 20:45: 初始化——建立迭代工作区（分支 `iteration/0028-role-model-binding`，base `main@162682d`），创建 `status.md` 与 `history.md`
- 2026-09-15 20:53: 阶段 1 定稿（`demand.md` v1.0.0，D-1~D-22 全部 user_confirmed），进入阶段 2
- 2026-09-15 20:52~20:56: 前置探针 3 条（一次性）+ 2 条（常驻）完成并实报命中；建立迭代唯一 chat
- 2026-09-15 20:59: 阶段 2 `prd` 派发完成（13 卡 + A-01~A-04 + MI-1~MI-6）；G-5 / G-6 记入差距记录
- 2026-09-15 21:00: 阶段 2 形式核查通过但 `model_inferred` 未确认 ⇒ 暂停等待用户决策
- 2026-09-15 21:05: 用户落定读法 (b) 与 MI-1~MI-6；更正 `demand.md` 的 `oamp/README.md` 引用（记录修正）；G-7 记入差距记录
- 2026-09-15 21:06: 派发阶段 2 定向修订轮（R-1~R-9）
- 2026-09-15 21:08: 修订轮完成（119s），R-1~R-9 逐条核对通过；阶段 2 标记 ✅，进入阶段 3
- 2026-09-15 21:09: 派发 `architect`（`--mode block --wait`）
- 2026-09-15 21:10~21:12: 按用户要求接入 hub 通知服务（确认收件箱 + 控制台通知 + 裁决回传），链路闭环验证通过（G-8）
- 2026-09-15 21:22: 等待上限由 25 分钟上调至 60 分钟；查明节点侧 30 分钟硬上限并登记 G-9
- 2026-09-15 21:25: 按用户疑问核实"派发 agent 是否正确"——调用级 `agent` 全部正确，`pb-dev` 为对话归属字段（无修改端点），已 rename 标题并登记 G-10
- 2026-09-15 21:39: `architect` 被节点侧 30 分钟上限切断（`failed`/`timeout`）；产物已完整落盘
- 2026-09-15 22:00: 阶段 3 推进条件核查通过 ⇒ 阶段 3 标记 ✅；触发**方案确认门**，等待用户确认后派发 `pr-planner`（阶段 4）
- 2026-09-15 22:02: 用户在会话内确认「确认，请继续」⇒ 方案确认门通过；控制台确认项 `cfm-d0b8a018…` 以 `approve` 结清
- 2026-09-15 22:03: 派发 `pr-planner`（阶段 4）
- 2026-09-15 22:16: `pr-planner` 完成（817s）⇒ `prs/` 10 个 PR 文件；脚本核查七字段齐备 / F01~F13 全覆盖 / 文件范围零重叠 / 依赖图无环 ⇒ 阶段 4 标记 ✅
- 2026-09-15 22:17: 进入「Gate：阶段 4→5 入口」，派发 `verifier` 对 `prs/` 做阶段 6 独立验证（结论须为 pass）
