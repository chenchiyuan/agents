# 工作流进度

**工作流**: workflow-pb v0.13.0
**迭代**: 0028-role-model-binding
**当前阶段**: 阶段 6（独立验证）· 阶段 5 已完成（**10/10** PR 全部落盘并合入 main）
**迭代分支**: iteration/0028-role-model-binding（**已合并**，merge `fb7b8dc`；分支已删）
**收口登记提交**: `3b23cba chore(0028): 收口登记——F08 合并后生效实证 + 迭代分支已合并回写`（+ 补录 `61601c7`；pr-010 文档订正另一次提交）
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding
**状态**: 进行中（2026-09-16 00:47 恢复；集群已重建，调用面清空、对话记录留存）
**history**: 开启
**方案确认门**: enabled

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0：D-1~D-22 全部 `user_confirmed`；20:53 用户确认定稿 |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` v0.2.0 + 13 卡；A-01~A-05 待填；MI-1~MI-6 全部已确认；R-1~R-9 逐条核对通过（21:08） |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` 30829 字节（§0~§8，含 §7 自检、§8 补全记录）；A-01~A-05 全填；**L1 = 无**；执行异常（节点侧 30 分钟超时，call `task-191d2e14…`）已登记 G-9，产物在超时前完整落盘 |
| 4 | PR 规划 | ✅ | ✅ | `prs/` 10 个 PR 文件；Gate 验证 `clarifications/verify-20260915-221935.md` 结论 **PASS**（0 fail/1 partial/4 偏差，偏差均已在 history 裁定不阻塞；4 条下迭代候选）|
| 5 | PR 实现 | ✅ | ⬜ | **10/10 全部落盘并合入 main**（`iteration/0028-role-model-binding` → merge `fb7b8dc`，分支已删；pr-010 在 main 上直接落盘 `3b23cba`）；返工/重验纪录：pr-001 / pr-002 / pr-006 / pr-010 各 1 次 FAIL 或 partial → 返工/订正 → 重验 PASS；pr-007 dev 超时失败但产物落盘（G-9） |
| 6 | 独立验证 | ⏸ | — | **进行中**（最终产物 + 本迭代的搭置记录） |

## PR 实现子状态（阶段 5 展开）

## 并发配置（阶段 5）

- **起始并发数**: 3
- **硬上限**: 5（公式 `2×起始-1`）
- **当前有效上限**: 5（`min(起始并发数 3 + 累计槛位释放次数 10 × 起始并发数 3, 硬上限 5)` = `min(33, 5)` = 5；爬升在释放次数 ≥1 时即达硬上限）
- **累计槛位释放次数**: 10（3 次验收 FAIL/partial + 6 次 PR 合并 + 1 次超时失败）
- **已派发总数**: 10（pr-001~pr-010 全部派发；返工/重验轮不另计 PR 数）
- **槛位账目口径说明**（供 progress-observer 核对）：`占用` 列表示该 PR 当前有在途调用；FAIL 判定已计入「累计释放」，其后**因返工重新派发而再次占用**——释放是计数事件、占用是当前态，二者不矛盾

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-iteration-artifacts-commit.md | （无） | ✅ | feat/0028-pr-001-iteration-artifacts | ✅（merge `445fdd2`） | 已释放 |
| pr-002-role-model-binding.md | （无） | ✅ | feat/0028-pr-002-role-model-binding | ✅（merge `44588d8`） | 已释放 |
| pr-003-one-shot-backend-receipts.md | （无） | ✅ | feat/0028-pr-003-one-shot-receipts | ✅（merge `6115f2a`） | 已释放 |
| pr-005-second-cluster-bring-up.md | pr-002 | ✅ | feat/0028-pr-005-second-cluster | ✅（merge `1974f41`） | 已释放 |
| pr-006-second-cluster-binding-evidence.md | pr-005 | ✅ | feat/0028-pr-006-binding-evidence | ✅（merge `b8c7cf7`） | 已释放 |
| pr-008-dispatch-contract-audit.md | pr-006 | ✅ | feat/0028-pr-008-dispatch-audit | ✅（merge `b61092a`） | 已释放 |
| pr-004-resident-backend-probes.md | pr-008 | ✅ | feat/0028-pr-004-resident-probes | ✅（merge `46b9dcf`） | 已释放 |
| pr-009-existing-surface-freeze.md | pr-002, pr-004 | ✅ | feat/0028-pr-009-surface-freeze | ✅（迭代分支 `e66fe1f` → main `fb7b8dc`） | 已释放 |
| pr-007-execution-gap-record.md | （无） | ✅ | feat/0028-pr-007-execution-gap-record | ✅（merge `292df64`） | 已释放 |
| pr-010-post-merge-activation-evidence.md | pr-001, pr-002 | ✅ | —（**main 上执行**） | ✅（main 直接落盘 `3b23cba`） | 已释放 |

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
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-001 实现（产物入库） | `task-4d88d08b-f977-4314-813e-e8dfc49c89df` | completed（381614ms） | `openai/gpt-5.6-luna`（G-11） | **true**（G-5 聚合） |
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-002 实现（cluster.json 两键） | `task-4b8e1399-36ce-47e2-8a66-09293eb8725c` | completed（617839ms） | `openai/gpt-5.6-luna`（G-11） | **true**（G-5 聚合） |
| 22:41 | dev（`pb-dev`） | 阶段 5 · pr-003 实现（三条一次性回执） | `task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e` | completed（831193ms） | `openai/gpt-5.6-luna`（G-11） | **true**（G-5 聚合） |
| 23:13 | verifier（`pb-verifier`） | 阶段 5 · pr-001 验收（首轮） | `task-def5a04f-85a6-42b8-8dd5-c5f261e5171a` | completed（224086ms，结论 FAIL） | `powerby/grok-4.6`（G-11） | **true** |
| 23:13 | verifier（`pb-verifier`） | 阶段 5 · pr-002 验收 | `task-5585d411-a3cc-46cf-8a1f-31baccfd03b5` | completed（364616ms） | `powerby/grok-4.6`（G-11） | **true** |
| 23:15 | verifier（`pb-verifier`） | 阶段 5 · pr-003 验收 | `task-637e830a-a4f0-4318-9650-16b72eedeb82` | completed（365858ms） | `powerby/grok-4.6`（G-11） | **true** |
| 08:48 | pr-planner（`pb-pr-planner`） | 返工 · pr-002 验收标准 4 字面修订 | `task-05e21d21-1f3f-4619-bef1-38b2f64a549b` | completed（08:48:42→08:49:32） | `deepseek/deepseek-v4-flash` | **true** |
| 08:48 | dev（`pb-dev`） | 返工 · pr-001 证据原文照录 | `task-07508a08-32a3-4e12-86ea-34e856c09b6f` | completed（08:48:42→08:52:55，提交 `f6a8ccb`） | `deepseek/deepseek-v4-flash` | **true** |
| 08:50 | planner（`pb-planner`） | 阶段 5 · pr-007 任务拆解（补位） | `task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37` | completed（08:50:40→08:54:33） | `deepseek/deepseek-v4-flash` | **true** |
| 08:50 | progress-observer（`pb-progress-observer`） | PR merge 后自动进度核对（产出 `progress.md` 16199 B） | `task-c0acdd24-c873-4b27-b9fa-e1019949456e` | completed（08:50:40→08:53:21） | `deepseek/deepseek-v4-flash` | **true** |
| 09:06 | verifier（`pb-verifier`） | 阶段 5 · pr-001 **重验**（返工后） | `task-fc99395f-d815-4b2b-83c6-24696a18bdc1` | completed（09:06:27→09:10:02，结论 **PASS**） | `deepseek/deepseek-v4-flash` | **true** |
| 09:06 | dev（`pb-dev`） | 返工 · pr-002 证据与实现核对 | `task-2a20f315-586c-4206-969d-b421e6254fa8` | completed（09:06:26→09:08:48，提交 `e387cb4`） | `deepseek/deepseek-v4-flash` | **true** |
| 09:16 | verifier（`pb-verifier`） | 阶段 5 · pr-002 **重验**（返工后） | `task-4daeb32f-8a3e-41c0-bacf-38b89c9392c3` | completed（09:20:13，结论 **PASS** 6/6） | `deepseek/deepseek-v4-flash` | **true** |
| 09:22 | planner（`pb-planner`） | 阶段 5 · pr-005 任务拆解（pr-002 合并后解锁） | `task-4ad6c28f-5829-475f-8420-0df96012859f` | completed | `deepseek/deepseek-v4-flash` | **true** |
| 09:06 | dev（`pb-dev`） | 阶段 5 · pr-007 实现（差距记录核对补齐） | `task-92f31d55-3789-4184-a850-a43df30e54be` | **❌失败(超时·现场保留)**（2111305ms，「轮次超时（1800000ms）」，提交 `b86fa80`） | — | **true** |
| 09:42 | dev（`pb-dev`） | 阶段 5 · pr-005 实现（第二集群启动就绪） | `task-b392b024-e12c-4d19-befb-5424d636e69a` | completed（**阻塞**：UDS 路径 105>104 字节） | `deepseek/deepseek-v4-flash` | **true** |
| 09:42 | verifier（`pb-verifier`） | 阶段 5 · pr-007 验收（对已落盘产物） | `task-7cdd4339-b5fe-4f8b-935e-a8cc922eed37` | completed（**FAIL 8/9**·唯一 fail 系验证标准缺陷） | `deepseek/deepseek-v4-flash` | **true** |
| 09:50 | verifier（`pb-verifier`） | 阶段 5 · pr-007 **重验**（纠正标准） | `task-7670b5c5-cc96-4247-a4b3-7ae635c97e78` | completed（**PASS 9/9**） | `deepseek/deepseek-v4-flash` | **true** |
| 09:53 | dev（`pb-dev`） | 阶段 5 · pr-005 **返工**（方案 A：短路径 socket） | `task-74bf0ca1-6620-4111-b91e-913249b6d8e1` | completed（**8/8 通过**；第二集群 12 窗口/7789/10 角色 online） | `deepseek/deepseek-v4-flash` | **true** |
| 09:58 | verifier（`pb-verifier`） | 阶段 5 · pr-005 验收（判据按裁决 A 变更） | `task-94d4a91c-09af-403e-b464-40f59b4aff04` | completed（**PASS 8/8**） | `deepseek/deepseek-v4-flash` | **true** |
| 10:00 | planner（`pb-planner`） | 阶段 5 · pr-006 任务拆解（pr-005 合并后解锁） | `task-2d178ff2-0e52-43cf-8b81-e22b6718cf0a` | completed（44 KB 任务图 T1~T10） | `deepseek/deepseek-v4-flash` | **true** |
| 10:03 | dev（`pb-dev`） | 阶段 5 · pr-006 三条绑定实报取证（`--port 7789`） | `task-e595808c-e497-412d-90a2-7a2a57680144` | completed（**8/8 通过**；7789 实报 `openai/gpt-5.6-luna` / `powerby/grok-4.6` / `deepseek/deepseek-v4-flash`） | `deepseek/deepseek-v4-flash` | **true** |
| 10:07 | verifier（`pb-verifier`） | 阶段 5 · pr-006 验收（三条实报 + 归属 + 零污染） | `task-e770645e-ebd7-42c9-99ee-30af88aa9f56` | completed（**FAIL 7/8**·唯一 fail = 一处证据块形态） | `deepseek/deepseek-v4-flash` | **true** |
| 10:09 | dev（`pb-dev`） | 阶段 5 · pr-006 **返工**（证据块改为可执行命令 + 原始输出） | `task-ede2a399-8a89-4351-ac15-ddbfa94d712c` | completed（提交 `7f15f3e`） | `deepseek/deepseek-v4-flash` | **true** |
| 10:10 | verifier（`pb-verifier`） | 阶段 5 · pr-006 **重验**（返工后） | `task-000f245c-8f12-4ca6-bc59-de2ca1767d6d` | completed（**PASS 8/8**） | `deepseek/deepseek-v4-flash` | **true** |
| 10:12 | planner（`pb-planner`） | 阶段 5 · pr-008 任务拆解（pr-006 合并后解锁） | `task-8e419773-444e-4b33-b3a6-63dad11e4101` | completed（46 KB 任务图 T1~T11） | `deepseek/deepseek-v4-flash` | **true** |
| 10:15 | dev（`pb-dev`） | 阶段 5 · pr-008 全量派发契约核对（纯只读） | `task-d1bbac5c-da8c-4bad-a25f-cc1291c53c0e` | completed（**审计完成**·发现台账 D4/D5 缺陷；提交 `3792245`/`1edc88f`） | `deepseek/deepseek-v4-flash` | **true** |
| 10:22 | verifier（`pb-verifier`） | 阶段 5 · pr-008 验收（抽样复核 + 只读纪律） | `task-d43ac37c-0779-4512-8c1f-e56d3d056f7a` | completed（**PASS**：8 pass / 1 partial（partial 成因在被核对对象）） | `deepseek/deepseek-v4-flash` | **true** |
| 10:27 | planner（`pb-planner`） | 阶段 5 · pr-004 任务拆解（pr-008 合并后解锁） | `task-8055f6c3-cb01-4cbd-9e17-e4b994ccb904` | completed（70 KB 任务图 T1~T10） | `deepseek/deepseek-v4-flash` | **true** |
| 10:29 | dev（`pb-dev`） | 阶段 5 · pr-004 常驻探针回执落盘（纯只读） | `task-f552b1f2-e8e2-4f33-a936-5a1796ec0bb8` | completed（提交 `1cfd97b`；效力边界已登记） | `deepseek/deepseek-v4-flash` | **true** |
| 10:31 | verifier（`pb-verifier`） | 阶段 5 · pr-004 验收（回执 + 禁止重跑核查） | `task-1a2de9d5-5b41-4aa7-8b95-0678164eded0` | completed（**PASS 9/9**） | `deepseek/deepseek-v4-flash` | **true** |
| 10:33 | planner（`pb-planner`） | 阶段 5 · pr-009 任务拆解（窗口内：全 PR 已合入、未合入 main） | `task-b931d478-6c88-40ca-9676-607a88adf62d` | completed（任务图 T1~T8） | `deepseek/deepseek-v4-flash` | **true** |
| 10:35 | dev（`pb-dev`） | 阶段 5 · pr-009 既有面零改动核对（纯只读） | `task-905172ff-8f3d-4c71-af90-bb062468e550` | completed（提交 `21b9714`/`1f2c3aa`；32 行判据 + SHA 等价形式） | `deepseek/deepseek-v4-flash` | **true** |
| 10:37 | verifier（`pb-verifier`） | 阶段 5 · pr-009 验收（改动面 + 复用 + 副本登记） | `task-766163dd-5950-42ba-b475-0197b34c33f9` | completed（**PASS**：7 pass / 1 partial） | `deepseek/deepseek-v4-flash` | **true** |
| 10:42 | planner（`pb-planner`） | 阶段 5 · pr-010 任务拆解（**收口时点**，main 上执行） | `task-9b39e893-729c-432e-b95b-06006517b699` | completed（R1 外部前置 + 8 任务） | `deepseek/deepseek-v4-flash` | **true** |
| 10:46 | dev（`pb-dev`） | 阶段 5 · pr-010 F08 取证 + 收口登记提交 | `task-2b66d138-cea9-46d3-a043-b49fa38017f5` | **❌失败(context_crashed)**（`duration_ms=1441508`，G-19 自排队死锁，主 agent 终止其 daemon 解除） | — | — |
| 10:47 | dev（`pb-dev`） | 上一轮的内层实报（**打给自己的实例**） | `task-ccf0b236-a01d-4c2f-8ea5-9339f9b12a6d` | **❌失败(context_crashed)**（`duration_ms=1340742`，G-19 对照项） | — | — |
| 10:47 | verifier（`pb-verifier`） | 上一轮的内层实报（**落在另一实例**⇒ 成功） | `task-a331fc39-810f-4a70-8d25-08659d11cf7d` | completed（4801ms，`OK`） | `powerby/grok-4.6` | false |
| 11:10 | verifier（`pb-verifier`） | **F08 实报 ①**（重启后、主 agent 取得、不带 `--model`） | `task-67cb177b-4af5-4bf0-8895-3fceeb062a45` | completed（12356ms，`OK`，exit 0） | `powerby/grok-4.6` | false |
| 11:11 | dev（`pb-dev`） | **F08 实报 ②**（重启后、主 agent 取得、不带 `--model`） | `task-84c498ea-6dfa-43b5-924d-5561dbe794c3` | completed（4834ms，`OK`，exit 0） | `openai/gpt-5.6-luna` | false |
| 11:11 | dev（`pb-dev`） | 阶段 5 · pr-010 **落证 + 收口登记提交**（修正后：不再自派发） | `task-c8c9e09f-ad79-4703-bd5b-f74b25ef7bf3` | completed（360227ms，提交 `3b23cba`） | `openai/gpt-5.6-luna` | **true** |
| 11:18 | verifier（`pb-verifier`） | 阶段 5 · pr-010 验收（合并/重启/实报/收口提交） | `task-97d20f95-9e95-4889-847d-3442c28a8aa3` | completed（**PASS**：8 pass / 1 partial（证据形态）） | `powerby/grok-4.6` | **true** |

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
- 2026-09-15 22:27: Gate 验证 PASS（0 fail / 1 partial / 4 偏差，偏差裁定不阻塞）⇒ 阶段 4 已验证 ✅，进入阶段 5
- 2026-09-15 22:32: 初始化并发配置（起始 3 / 硬上限 5）；建 3 个 PR worktree；同轮并发派发 pr-001 / pr-002 / pr-003 的 `planner`
- 2026-09-15 22:40: 三条 planner 完成（183s / 345s / 475s），任务文件落在各自 worktree
- 2026-09-15 22:41: 同轮并发派发三个 PR 的 `dev`（实报均为 `openai/gpt-5.6-luna`，G-11）
- 2026-09-15 23:14: 三个 dev 全部完成并提交（`0e314a3`+`6cfb660` / `7a50b2a` / `edba633`）
- 2026-09-15 23:13~23:15: 同轮并发派发三个 PR 的 `verifier` 验收（实报均为 `powerby/grok-4.6`，G-11）
- 2026-09-15 23:22: 三条验收终态——pr-003 **PASS**；pr-001 / pr-002 **FAIL**（各 1 条 fail，返工范围已由 verifier 给出）；累计槛位释放 2 次，当前有效上限 5
- 2026-09-15 23:23: **按用户指示暂停迭代并关闭 hub**（16 条调用全部终态、0 条在飞）；现场按规则 G 原样保留
- 2026-09-16 08:47: 用户指令「继续 0028 迭代」⇒ 恢复：`hub cli cluster up`（12 窗口 / 10 节点 online）、沿用既有工作区与迭代分支；核实"调用面清空、对话记录留存、G-11 模型固化清除"
- 2026-09-16 08:48: 并发派发两条返工——`pr-planner` 修订 pr-002 验收标准 4 字面（08:48:42→08:49:32，选定形态 A）；`dev` 修复 pr-001 证据原文照录（08:48:42→08:52:55，提交 `f6a8ccb`）
- 2026-09-16 08:50: pr-003 合并进迭代分支（merge `6115f2a`，按 G-13 规程先移出同路径 untracked 文件）；槛位释放（累计 3）；补位派发 pr-007 的 `planner`（08:50:40→08:54:33）
- 2026-09-16 08:50: 自动触发 progress-observer（08:50:40→08:53:21，产出 `progress.md` 16199 B，核出 7 条记账不一致）
- 2026-09-16 09:05: 依 progress-observer 的 7 条不一致做**记录修正**（台账终态同步 / 时点由"00:xx"更正为实际"08:xx" / 槛位口径说明 / 阶段 5 备注更新 / 补记事件 / 新写 `clarifications/stage5-pr-verdicts-20260916.md`）；偏差根因为恢复轮未取机器时间戳
- 2026-09-16 09:06: 并发派发 3 条——`dev`(pr-002 返工 `task-2a20f315…`)、`dev`(pr-007 实现 `task-92f31d55…`)、`verifier`(pr-001 重验 `task-fc99395f…`)
- 2026-09-16 09:12: 三条结果落地——pr-001 重验 **PASS**（fail 0 / partial 1）；pr-002 返工提交 `e387cb4`；**pr-001 合并**（merge `445fdd2`，按 G-13 规程处理 23 个 untracked 文件并还原活文档）；槛位释放（累计 4）
- 2026-09-16 09:16: **等待机制纠正**（修 G-14 根因）——取消 7 个挂死的 `stream call` 作业，改挂**终态即退出的有界 watchdog**（`bg_10`）；派发 pr-002 重验（`task-4daeb32f…`）
