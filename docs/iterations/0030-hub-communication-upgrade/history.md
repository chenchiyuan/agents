# history.md — 0030-hub-communication-upgrade

### 2026-09-17 12:10:00 · 调度决策 · 工作流启动

- 决策内容：建立迭代工作区并初始化进度产物，进入阶段 1（需求收敛，主 agent 内联执行）
- 触发依据：用户指令「阅读 `docs/hub-communication-upgrade-demand-2026-09-17.md`，按此需求开启新迭代；新迭代使用 subagents 方式，dev 用 gpt、verify 用 grok」；迭代 ID `0030-hub-communication-upgrade` 经用户确认；`git -C /Users/chenchiyuan/projects/agents worktree add .pb-agents/worktrees/0030-hub-communication-upgrade -b iteration/0030-hub-communication-upgrade main` 成功（base `706e3d0`）

### 2026-09-17 12:10:00 · 调度决策 · 启动前询问

- 决策内容：方案确认门 = `enabled`（默认值，用户选择）
- 触发依据：Step 0 启动前询问；用户 2026-09-17 回答「enabled（默认）」

### 2026-09-17 12:11:00 · 调度决策 · 执行方式裁决

- 决策内容：本轮新增四项执行方式决策（D-33 本地 subagent 通道 / D-34 只绑 dev=gpt、verifier=grok / D-35 agent 文件 + `modelRoles` 别名载体 / D-36 依据文档入库），均取用户显式裁决
- 触发依据：本轮唯一真缺口 = subagent 通道下"角色→模型"如何落地与留证；前置实测 F-10（`task` wire schema 无 per-dispatch model）/ F-11（agent frontmatter `model:` 实测生效，三条探针）/ F-12（V-06：`roles/*/*.md` 不得含 `model:`）；`clarifications/round-1-kickoff.md` §六

### 2026-09-17 12:14:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 1 产物 `demand.md` v1.0.0 两段已写入、自检完成（六维诊断逐条过、D-20~D-36 全部 `user_confirmed`、无遗留 `model_inferred`、无活跃冲突）；按 demand 角色 Deliver 契约**呈交四段摘要等待用户确认**，暂不标记 ✅、不进入阶段 2
- 触发依据：`demand.md` 第一段（澄清依据）与第二段（需求结论）均非空且内部一致；`clarifications/round-1-kickoff.md` 已记录 Step 0 声明、角色反射、Plan 调研摘要、四段提案与追问反射

### 2026-09-17 12:17:00 · 调度决策 · 阶段推进核查

- 决策内容：用户确认 `demand.md` v1.0.0 定稿并指示"自主推进直到产出完方案之后再通知我"；阶段 1 推进条件全部满足，标记 ✅ 并进入阶段 2（功能规格）
- 触发依据：两段结构完整、D-20~D-36 全部 `user_confirmed`、无遗留 `model_inferred`、无活跃冲突；用户 2026-09-17 原话「没问题，请自主推进直到产出完方案之后再通知我看整个方案」

### 2026-09-17 12:17:00 · 调度决策 · 执行方式修订登记

- 决策内容：登记 **D-35 载体不可实现**（agent 发现根固定在会话 cwd = 仓库主工作区，触规则 F；eval 桥 per-dispatch `model` 实测被忽略；`task` wire schema 无 model 字段），写入 `deferred-demand-changes.md`；**不回退不暂停**，阶段 2~4 继续（三者均走默认模型、不依赖该载体），修订选项与推荐在阶段 4→5 门与方案一并呈交
- 触发依据：探针实测三条（`.omp/agents/modelprobe.md` 在仓库根被发现并生效 / eval `agent(...,{model})` 两次指定 gpt、grok 均实报 `deepseek/deepseek-v4-flash` / `omp://tools/task.md` §Inputs 无 model 字段）；`data/scm-protocol.md` §规则 F 的闭集例外不含"在仓库主工作区建 harness 配置"

### 2026-09-17 12:18:00 · 派发 · prd

- 阶段：阶段 2（功能规格）
- 任务：将需求合同原子化为可独立验证的功能卡，只做产品维度，不做架构决策

### 2026-09-17 12:18:00 · 调度决策 · 用户决策点批量呈现

- 决策内容：按用户 2026-09-17 指令，阶段 2/3 的 `model_inferred` 项与阶段 3 的 L1 决策**不在阶段内单独暂停**，改为在阶段 4→5 门与完整方案（prd + architecture + PR 拆分 + D-35 修订）**批量呈现**；`model_inferred` 标记在产物中**原样保留**，任何转为 `user_confirmed` 的动作只在收到用户真实输入后执行
- 触发依据：用户 2026-09-17 指令「自主推进直到产出完方案之后再通知我」；`workflow-pb.md` §需要用户决策的情况（阶段 1~3 适用项）与人机交互契约的"不得自问自答"红线——本次为**呈现时点后移**，未改变确认状态

### 2026-09-17 12:22:59 · 收到报告 · prd

- 1. `prd.md` 路径：docs/iterations/0030-hub-communication-upgrade/prd.md（v1.0.0）；功能点总数：10 张卡（F01~F07 产品功能点 + F08 模型归属 + F09 过程契约 + G01 保证项）
- 2. `prd/` 目录文件列表：F01-inbox-authoritative-delivery / F02-default-principal-fallback / F03-inbox-persistence / F04-terminal-reason-enum / F05-idle-timeout-and-safety-net / F06-role-instance-pooling / F07-pool-routing-stickiness / F08-model-attribution-routing / F09-process-contract-and-friction-log / G01-existing-surface-preserved（10 个）
- 3. model_inferred 标注列表：MI-1~MI-12（12 项，均未自行确认，待阶段 4→5 门批量交用户）
- 4. 架构待填列表：A-01~A-09（9 项，交阶段 3）；L1 决策：无
- 5. 疑问/越界：9 条（`reason` 枚举口径三处差 + MI-5 全仓排查结论 13 种自由串且 `agent_error` 无对应源字符串 / A-09 清理策略归属 / MI-1 优先规则 / HB-01 三备选与 HB-04 可见性未入选 / 模型绑定两处真源 / `reason`·`detail` 文档面可发现性 / 未发现 demand 内部矛盾 / D-35 已由上游搭置不重复搭置 / 未越界声明）
- 通道实况：本地 subagent 通道（D-33），调用 `completed`（4m45s），子 agent 自报模型 `deepseek/deepseek-v4-flash`（= 全局默认，符合 D-34）

### 2026-09-17 12:23:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2（功能规格）推进条件三项**逐项读文件核查通过**（① 10 张独立卡，每卡含来源/用户价值/验收标准/边界/架构维度/model_inferred 六段，机械核对段落齐备、索引与目录逐项一致；② 索引 §覆盖关系双向表覆盖 做什么 5/5、效果 6/6、不做 9/9、大概怎么做 5 组、D-20~D-36、执行方式约束 6 条，无 demand 外新增功能点；③ A-01~A-09 全标 `[架构待填]`，F09/G01 声明"无待填项"并附理由），标记 ✅ 并进入阶段 3
- 触发依据：`prd.md` §功能点索引 + §覆盖关系 + §架构待填汇总；`prd/F04-terminal-reason-enum.md`、`prd/F08-model-attribution-routing.md` 逐行抽读；`grep -c "架构待填" prd/*.md` 逐卡计数

### 2026-09-17 12:23:00 · 派发 · architect

- 阶段：阶段 3（技术架构）
- 任务：在现有架构上演进，补全功能卡的架构维度，产出技术方案

### 2026-09-17 12:32:06 · 收到报告 · architect

- 1. architecture.md 路径：docs/iterations/0030-hub-communication-upgrade/architecture.md（v1.0.0，534 行）；核心组件：既有 web 进程（收件箱唯一写点 `publishCallResult` + inbox 表 + 池内选择 + 粘性表 + `reason` 映射消费 + 对账 TTL 联动）/ 既有 Router 进程（零改动，`router.status` + `router.task_list` 作池成员与负载唯一读数）/ 既有 agent 执行侧（轮次计时由「单绝对上限」改「空闲 10min + 安全网 4h」双计时，3 个协议客户端同构）/ 既有 SQLite 持久层（新增 inbox 表 + 1 索引 + 3 方法）/ 新增 2 个叶子模块（`reason.js`、`pool-routing.js`）
- 2. L1 决策清单：**L1-01 · 模型路由的落地载体形态（A-08）**——三候选技术评估与推荐（A 项目级最贴 D-35 字面但触规则 F；**B 用户级为推荐**、不触规则 F、harness 原生正例但未实测；C 一次性进程不推荐、与 D-33/F09 验收 1 冲突且破坏 F08 判据），另附第四条观察（扩展包根）；全部标注"待用户裁决"，未选定；其余无 L1（不引入新技术栈、不新增进程/端口/socket 方法，Router/registry/context-pool/transport 零改动）
- 3. 新引入技术组件：**无新增技术栈**（零第三方依赖、零新进程、零新协议方法）；新实体 7 项（2 叶子模块、inbox 表、2 配置键、`new_session` 字段、失败侧 `reason` 键、退役 `pickup.js`），每项附"不引入它什么无法实现"
- 4. `[架构待填]` 已填写条目数：**9/9（A-01~A-09 全部填定）**；回填 8 张卡的「架构维度」段，产品维度逐字未动；F09/G01 声明无待填项
- 5. 疑问/越界：3 类需裁决或知会——① 疑问 A（需裁决，阻塞 F08）：A-08 载体形态（= L1-01）；② 疑问 B（需确认，不阻塞）：`RECONCILE_TTL` 软 TTL 默认值与 `taskNetMs` 联动（L2-05，不联动即破 F01 必达，跨 F01/F03/F05 三卡）；③ 疑问 C（需知会）：`prd.md` 索引状态列未同步 / `acked` 恒 false / MI-5 分类更正（`dispatch_failed` 不进终态信封、`agent_error` 为兜底类）。另登记 4 项已知局限（§9），其中两项已搭置 `deferred-demand-changes.md`。未越界（未触碰 oamp/**、未写实现代码、未做 PR 拆分、未实施 L1、无 git 写操作）
- 通道实况：本地 subagent 通道（D-33），调用 `completed`（7m58s），子 agent 自报模型 `deepseek/deepseek-v4-flash`（= 全局默认，符合 D-34）

### 2026-09-17 12:32:30 · 调度决策 · 阶段推进核查

- 决策内容：阶段 3（技术架构）**逐项读文件核查**——推进条件 2（所有功能卡有技术路径：A-01~A-09 填定、8 张卡「架构维度」段已回填）✅、条件 3（无架构内部冲突：`architecture.md` §9 末段 7 组交叉一致性检查全过）✅；**条件 1（L1 决策经用户确认）未满足**（L1-01 按用户 2026-09-17 指令后移至阶段 4→5 门）。据此**不标记阶段 3 ✅**（`⏸` + 备注），按用户"继续产出完整方案"的指令进入阶段 4；偏差已写入 status.md 显式登记
- 触发依据：`architecture.md` §4（A-01~A-09）、§7（L1/L2 分级）、§9（一致性检查）、§11（回填与越界声明）；`grep -n "^## 架构维度" -A3 prd/F0[1-8]*.md` 确认回填到位；用户 2026-09-17 指令「自主推进直到产出完方案之后再通知我」

### 2026-09-17 12:33:00 · 派发 · pr-planner

- 阶段：阶段 4（PR 规划）
- 任务：反射出可独立合并的提交单元划分及单元间真实依赖，从架构方案 + 代码库现状出发

### 2026-09-17 12:35:30 · 派发 · prd（续做，同一角色的收口动作）

- 阶段：阶段 3 收口（产物一致性）
- 任务：把 `prd.md` 索引「功能点索引」表的「架构维度」列由 `待填 · A-xx` 改为 `已填定 · A-xx`（8 行），与 architect 已回填的卡内取值一致

### 2026-09-17 12:36:20 · 收到报告 · prd（续做）

- 1. 收口范围：`prd.md` 功能点索引表 F01~F08 八行的「架构维度」列（git diff = 8 增 8 删）
- 2. 现取值：F01 `已填定 · A-01` / F02 `已填定 · A-02` / F03 `已填定 · A-01 / A-09` / F04 `已填定 · A-03 / A-04` / F05 `已填定 · A-05` / F06 `已填定 · A-06` / F07 `已填定 · A-07` / F08 `已给出技术评估与推荐（载体形态待 L1-01 裁决）· A-08`
- 3. F09 / G01 仍为 `无待填项`；全文无 `待填 · A-` 残留（`grep -c` = 0，主 agent 复核）
- 4. 未动卡片与其它文件；未执行 git 写操作
- 5. 疑问/越界：无

### 2026-09-17 12:36:30 · 收到报告 · pr-planner

- 1. `prs/` 目录路径：docs/iterations/0030-hub-communication-upgrade/prs/
- 2. 文件列表：pr-001-reason-mapping-module / pr-002-pool-routing-module / pr-003-inbox-table-persistence / pr-004-idle-net-turn-timers / pr-005-web-inbox-and-pool-wiring / pr-006-api-docs-sync / pr-007-model-routing-carrier / pr-008-process-contract-evidence / pr-009-existing-surface-guard（9 个）
- 3. 各 PR 摘要：见 `prs/*.md` 七字段（涉及功能点 / 文件范围 / depends_on 证据摘要 / batch 逐条写入；主 agent 已逐份抽读核验）
- 4. 疑问/越界：6 条须知会（web.js 单文件承载六处接线故整文件一个 PR——代码耦合的如实反映 / 约束 4 与 G01 落位建议冲突已按硬约束处理（零改动面只作比对基准不入文件范围）/ **pr-007→pr-008 是产物级依赖**（共享 `dispatch-ledger.md`）请复核 / **pr-005→pr-004 的唯一判据是 RECONCILE_TTL 与 taskNetMs 联动**，若用户否决则该边消失 / L1-01 未决但 pr-007 保持可独立验收、载体落点不写死 / 未越界声明）；未创建 `split-suggestion.md`
- 5. 关键路径压平结果：最终关键路径 **3**；未发生合并（初始图即为 3）；无 `split-suggestion.md`
- 通道实况：本地 subagent 通道（D-33），调用 `completed`（3m26s），子 agent 自报模型 `deepseek/deepseek-v4-flash`（= 全局默认，符合 D-34）

### 2026-09-17 12:36:49 · 调度决策 · Gate确认（阶段 4→5 入口）

- 决策内容：阶段 4 推进条件**六项逐项核查通过**（① 七字段 9/9 齐备 ② 覆盖 10/10 卡 ③ 文件范围 21 条两两不重叠 ④ 依赖无环 ⑤ 无悬挂依赖 ⑥ 关键路径 = 3 ≤3）+ `tools/check-pr-gates.py` 七项机械复核 **exit 0**；初始化 `## 并发配置（阶段 5）` 区块（3 / 5 / 3 / 0 / 0）；**呈交方案确认门并暂停等待用户**
- 触发依据：`tools/check-pr-gates.py docs/iterations/0030-hub-communication-upgrade` 输出「七项全过，满足阶段 4 推进条件」；`prs/*.md` 逐份抽读（pr-004 / pr-005 / pr-007 / pr-009 全文，pr-001/002/003/006 核 文件范围+验收标准+depends_on）；用户 2026-09-17 指令「产出完方案之后再通知我」
- **Gate 未闭合项（如实登记）**：Gate 的验证内容含「派发阶段 6 独立验证，产物路径 = `prs/`，结论必须为 pass」——该验证须以 `verifier` 角色派发，而 verifier 的模型载体正是 **L1-01 待裁决项**（D-34/F08 验收 2 要求 verifier 跑在 grok 上）⇒ 该验证排在用户裁决 L1-01 之后立即执行，未在本次呈交前完成
- 呈交内容（四项，逐项对应 `workflow-pb.md` §方案确认门"不能只呈现其中部分"）：产品维度（`prd.md` + `prd/*.md`）/ 架构维度（`architecture.md`）/ PR 拆分摘要（PR 数、依赖图、关键路径；无 `split-suggestion.md`）/ 待裁决项（L1-01、MI-1~MI-12、疑问 B、疑问 C）
