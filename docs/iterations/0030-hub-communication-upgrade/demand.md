# demand.md — 0030-hub-communication-upgrade

**版本**: v1.0.0
**日期**: 2026-09-17
**阶段**: 阶段 1（需求收敛，主 agent 内联执行）
**澄清依据**: `clarifications/round-1-kickoff.md`（本次起迭代的 Step 0 声明、角色反射、四段提案与追问反射）；起点材料四份：① 需求预稿 `docs/hub-communication-upgrade-demand-2026-09-17.md`；② `docs/hub-vs-subagent-protocol-comparison-2026-09-17.md`；③ `docs/hub-issues-and-fixes-2026-09-17.md`；④ `docs/hub-delivery-architecture-decisions-2026-09-17.md`

---

## 第一段 · 澄清依据

### 一、实测事实（沿用既有调研 + 本次新增，均为可复核事实）

| # | 事实 | 位置 |
|---|---|---|
| F-1 | hub 的通知模型是"广播给当前在线的连接"；subagent 的通知模型是"投递给一个身份"——身份先于事件存在、不要求在线 | `docs/hub-vs-subagent-protocol-comparison-2026-09-17.md` §四 |
| F-2 | `pickup` 机制已存在但是**选择性的**：只有传 `requester` 的调用才写入，收件箱条目 `ack` 后不删除、只置标记 | `oamp/src/web.js:1612-1644,1775-1802`、`oamp/src/pickup.js` |
| F-3 | confirmation（双向问答）链路已用"请求方挂起 + 事件推给可寻址面 + 裁决回来 resolve"这套正确模式，但从未推广到普通任务结果送达 | `oamp/src/agent.js:270-322` |
| F-4 | Router 任务表 `state` 是闭集 `{submitted,working,completed,failed}`，所有失败原因塞进自由字符串 `error` ⇒ "取消"与"崩溃"在 state 层同形 | `oamp/src/registry.js`、`oamp/src/web.js:2196,2202-2209` |
| F-5 | `acp-client.js:319` 的 30 分钟上限是**绝对总时长**而非空闲检测；三个实测案例（prd/architect/pr-planner）产物提前 20~26 分钟落盘，调用仍空转到 30 分钟才判死，合计浪费 70 分钟 | `docs/hub-issues-and-fixes-2026-09-17.md` HB-01 |
| F-6 | `last_event_at`/`idle_ms` 投影字段已存在（0029 F16），但只被动记录给人看，未驱动任何判死/续做逻辑 | 0029 pr-005 |
| F-7 | `ContextPool` 按 `(chat_id, agent_id)` 做同键 FIFO 排队、单 in-flight；`/api/agents` 的 `queued` 统计的是 Router 任务表 `submitted` 行数，与池内真实排队深度不同层，几乎恒为 0 | `oamp/src/context-pool.js:10,44,112,139-141`、HB-04 |
| F-8 | 角色到实例目前是硬编码 1:1 映射（`instanceIdForRole='pb-'+role`） | `oamp/src/role-binding.js` |
| F-9 | 0028/0029 累计三次"自建脚本绕开现成功能"（G-4、0028 watchdog、0029 DC-20 的 5 个私有脚本） | 复盘文档 |

**本次新增实测（起迭代时一手核实，见 `clarifications/round-1-kickoff.md` §三）**

| # | 事实 | 取证方式 |
|---|---|---|
| F-10 | harness `task` 通道的 wire schema **无 per-dispatch `model` 字段**；子 agent 模型由 `task.agentModelOverrides[agentName]` → agent frontmatter `model` → 父会话兜底 三级决定 | `omp://tools/task.md`；`omp config list --json` |
| F-11 | 项目 agent 文件 `.omp/agents/<name>.md` 的 `model:` frontmatter **实测生效**（gpt / grok / 默认三条探针子 agent 各自自报正确模型名） | 三条一次性探针（用后即删） |
| F-12 | 仓内既有检查明令 `roles/*/*.md` **不得包含 `model:`** | `tools/check-model-dispatch-protocol.sh` V-06；`principles/execution/model-dispatch-protocol.md` CLR-MD-004 |

### 二、决策清单（逐条标注来源）

| # | 决策点 | 结论 | 来源 |
|---|---|---|---|
| D-20 | **推送模型** | 收件箱（inbox）升格为**唯一权威送达路径**；SSE 广播降级为 best-effort 体感优化，两者并行、互不依赖 | `user_confirmed`（预稿方案 C） |
| D-21 | **身份是否强制** | 不强制。`requester` 缺失时按 `chat_id` 自动派生缺省身份兜底，收件箱照常生效；调用方无需额外操作即获得必达保证 | `user_confirmed`（预稿方案 2-B） |
| D-22 | **持久化范围** | 只把收件箱落一张 SQLite 表；Router 任务表继续纯内存、重启即丢，继续依赖"产物为权威"兜底 | `user_confirmed`（预稿方案 3-B） |
| D-23 | **终态语义** | `state` 不变；新增封闭枚举 `reason`（`agent_error`/`cancelled_by_client`/`infra_error`/`timeout`/`rejected`）；原 `error` 保留并收窄为 `detail`（人类可读，不参与程序判断） | `user_confirmed`（预稿方案 4-B） |
| D-24 | **隔离边界（UDS 路径 / worktree）** | 本次不处理，维持现状，靠执行纪律规避 | `user_confirmed`（搁置，方案 5-A） |
| D-25 | **终态与产物一致性** | 不在协议层处理；不引入"产物清单"字段、不做 hub 侧核实；各 agent 自行管理自己任务的产物边界 | `user_confirmed`（原决策 7 撤回） |
| D-26 | **超时机制** | 从"固定 30 分钟总时长上限"改为"**空闲超时为主判据 + 宽松绝对安全网**"；活跃信号复用已有 `last_event_at`/`task.update` | `user_confirmed`（预稿方案 6-B） |
| D-27 | **空闲阈值** | 10 分钟无新增 `task.update` 视为空闲 | `user_confirmed`（初始取值，可调） |
| D-28 | **绝对安全网** | 4 小时，仅作"真死锁但仍有噪音信号"场景的最后防线，不作常态判据 | `user_confirmed`（初始取值，可调） |
| D-29 | **触发后的终态归类** | 统一落 `reason=timeout`（不新增子枚举），用 `detail` 区分空闲触发还是安全网触发 | `user_confirmed` |
| D-30 | **并发模型** | 实例池化：角色可对应多个已在线实例；**hub 不管理实例生命周期**（不负责启停），只在已在线的池子里做路由；实例启停与规模完全由使用者决定 | `user_confirmed`（预稿方案 8-C 简化版） |
| D-31 | **池内路由策略** | 同一 `(chat_id, agent_id)` 组合**粘性路由**——已建立上下文的会话固定复用同一实例，保证角色跨轮次记忆不断裂；新会话或调用方显式声明"不需要延续"时，从池内挑当前最空闲实例 | `user_confirmed`（预稿方案 8-A/C） |
| D-32 | **池规模管理方式** | 固定配置（使用者预先启动 N 个同角色实例），不做动态伸缩；hub 只感知"当前在线的池子有几个" | `user_confirmed` |
| D-33 | **本次执行通道** | 阶段 2~6 全部改用**本地 subagent**（宿主 `task` 派发、brief 全文注入角色定义），**不经 hub 派发**；延续 0029 D-19 已生效的通道变更 | `user_confirmed`（2026-09-17） |
| D-34 | **本次模型绑定** | `dev` = `openai/gpt-5.6-luna`、`verifier` = `powerby/grok-4.6`；其余执行角色走全局默认（`deepseek/deepseek-v4-flash`）——沿用 0028 已定案的绑定清单，只换执行通道不改绑定 | `user_confirmed`（2026-09-17） |
| D-35 | **模型路由载体** | 项目 agent 文件 `.omp/agents/<role>.md` 的 frontmatter 只写**别名**（如 `model: "@pb_dev"`），具体模型值集中在 `.omp/config.yml` 的 `modelRoles`；**模型值不写入** `roles/*/*.md` | `user_confirmed`（2026-09-17，方案 A） |
| D-36 | **依据文档入库** | 三份未被 git 跟踪的 hub 文档（预稿 / 架构决策 / 协议对比）复制进迭代分支并按原相对路径提交，使下游 PR worktree 与阶段 6 验证可读原文 | `user_confirmed`（2026-09-17） |

### 三、明确否决/排除的路径

**产品面（预稿 §三，`user_confirmed`）**

- **否决：让 hub 主动核实产物是否落盘**（原方案 7-C）—— 协议无"产物"概念，各任务产物约定千差万别，且会把范围拖入"重新定义什么是产物"。
- **否决：无状态负载均衡**（原方案 8-B）—— 会打破角色跨轮次记忆，除非上下文可迁移，而这正是 `ContextPool` 存在的意义。
- **否决：纯空闲超时不设绝对安全网**（原方案 6-A）—— 会重蹈 0028 watchdog v2 的误报覆辙；完全去掉自动兜底又会重新打开 G-19 死锁风险（原方案 6-C 同理被否决）。
- **排除：本次不做实例生命周期管理** —— 用户主动简化，职责边界更清楚，代价（不能按负载伸缩）被接受。
- **排除：终态与产物一致性问题不在协议层解决** —— 移交"各 agent 自行管理任务边界"这一更泛的流程规范。

**执行方式面（本轮，见 `clarifications/round-1-kickoff.md` §八，`user_confirmed`）**

- **否决：agent 文件直写模型值**（方案 B）—— 模型值散落，换模型要改 N 处。
- **否决：`omp -p` 一次性 CLI 作子 agent 执行器**（方案 C）—— 退出 0029 已确立的本地 subagent 通道，证据形态与"brief 全文注入角色定义"的派发契约不匹配。
- **否决：全角色显式绑定** —— 与 0028 定案清单不一致、新增配置面与验证面无对应收益。
- **否决：把模型值写进 `roles/*/*.md`** —— 违反 F-12（V-06 + CLR-MD-004）。

---

## 第二段 · 需求结论

### 做什么

1. **把收件箱升格为唯一权威送达路径**：所有 `mode=background` 调用的终态，无论是否显式传 `requester`，都保证有一个可查询的身份（显式或缺省兜底）能在收件箱里拿到结果；SSE 广播保持现状，作体感加成，不承担送达责任。
2. **给收件箱补一层轻量持久化**：新增一张 SQLite 表，只在终态发布那一刻写一次，使"必达"保证不依赖 hub 进程是否重启过。
3. **把终态语义结构化**：新增封闭枚举 `reason`，让调用方可靠区分"我自己取消的"/"它崩了"/"等超时了"/"被拒绝了"/"agent 自己执行出错"，不再解析自由字符串。
4. **把超时机制从固定总时长改成空闲检测**：复用已有进展信号（`task.update`/`last_event_at`），空闲超过阈值才判死，同时保留一个远高于当前值的绝对安全网，防真死锁无限占用资源。
5. **支持角色实例池化**：允许一个角色对应多个已在线的实例，hub 在池内做路由（同会话粘性、新会话选最空闲），不负责实例的启动/停止/伸缩。

### 不做什么（每条附"为什么这次不做"）

1. **不做 Router 任务表全面持久化** —— 会牵动 Router/web.js 两层现有结构，且会把技术债（D-23 要解决的自由字符串终态语义）焊死进 schema；真正需要解决的缺口（必达依赖进程存活）用范围更小的方案 3-B 已覆盖。留作独立后续项。
2. **不引入产物核实/产物清单机制** —— 协议不应涉及"产物"概念，各 agent 自行对自己的任务产出负责（对应 D-25）。
3. **不做隔离边界（worktree/UDS 路径）的协议层设计** —— 与本次核心问题（身份/推送/持久化/终态语义/超时/并发）无耦合，继续靠执行纪律规避（对应 D-24）。留作独立后续项。
4. **不做实例生命周期管理** —— 用户主动选择的职责边界：池子的存在与规模完全交给使用者，牺牲灵活性换清晰边界（对应 D-30）。
5. **不做无状态负载均衡** —— 会打破角色的跨轮次会话记忆，与 `ContextPool` 的设计意图冲突（对应 D-31）。
6. **不修 transcript 1000 条前缀截断问题**（HB-07 遗留部分）—— 与本次决策集无关，是独立的实现缺陷，留给后续单独修。
7. **不修惰性启动竞态 bug**（`completed` 但产物缺失的时序问题）—— 不是设计选择题，是具体代码缺陷，留给后续独立修复卡片，不作为架构决策。
8. **不改 `cluster.json` 的角色级绑定**（0028 定案）—— 本次只换执行通道，绑定清单原样不动（对应 D-34/D-35）。
9. **不把模型值写进角色定义** —— 角色文件只描述能力；模型值集中在 `.omp/config.yml`（对应 F-12、D-35）。

### 大概怎么做（用户已确认的机制方向；技术选型留给架构阶段）

- **送达**：`POST /api/calls` 的 `requester` 变为"可选但总有效"——不传时用 `chat:<chat_id>` 派生缺省身份；`publishCallResult` 终态发布时**必然**写入 inbox（SQLite 新表）；`GET /api/pickup` + `POST /api/pickup/:id/ack` 复用现有端点框架，仅调整"何时写入"的触发条件。
- **终态语义**：终态信封新增 `reason` 字段（封闭枚举），`error` 字段保留但语义收窄为 `detail`（人类可读，不参与程序判断）。
- **超时**：agent 侧执行路径的判死逻辑从"距开始时间 30 分钟"改为"距最后一次 `task.update` 超过空闲阈值（10 min），或距开始时间超过绝对安全网（4 h）"，触发后统一落 `reason=timeout`。
- **并发**：`role-binding.js` 的 `instanceIdForRole` 从 1:1 映射改为查询"当前在线的角色实例池"；新增按 `(chat_id, agent_id)` 的粘性路由表；调用方可显式声明"新会话/不需要延续"以获得池内最空闲实例。
- **执行方式**（本次迭代专用）：派发用宿主 `task` 子 agent，brief 全文注入角色定义；`.omp/agents/dev.md`、`.omp/agents/verifier.md` 以 `model: "@pb_dev"` / `"@pb_verifier"` 别名引用 `.omp/config.yml` 的 `modelRoles`（`pb_dev: openai/gpt-5.6-luna`、`pb_verifier: powerby/grok-4.6`）；其余角色用宿主默认子 agent（模型 = 全局默认）。

### 达到什么效果（每条均可裸判定）

1. 派发一个 `mode=background` 调用后，无论调用方是否显式声明身份，都能在结果产生后通过 `GET /api/pickup` 拿到终态——不需要提前订阅、不需要一直在线。
2. hub 进程重启后（在收件箱条目未被 ack 的前提下），已产生的终态结果依然可查。
3. 任一失败的调用，调用方能通过 `reason` 字段直接判断是"我自己取消的"还是"它真的崩了"还是"等超时了"，不需要解析自由字符串。
4. 一个正常运行、持续产出进展的长任务，不会因为累计跑了很久而被判死；只有真正停止产出进展超过阈值才会被判死。
5. 用户手动启动同一角色的多个实例后，对该角色的并发派发能被分散到不同实例上处理，不再因单实例串行而排队等待；同一对话对同一角色的连续多轮请求，仍固定路由到同一个已建立上下文的实例。
6. 本迭代阶段 2~6 的每一次 `dev` 派发（载体 = `.omp/agents/dev.md`），其子 agent 自报模型 `openai/gpt-5.6-luna`；每一次 `verifier` 派发（载体 = `.omp/agents/verifier.md`）自报 `powerby/grok-4.6`；其余角色自报全局默认——判据是子 agent 系统提示中的模型名（F-11 已实测该判据可用）。

### 为什么

- **根因**（②的结论）：hub 的通知模型是"广播给在线连接"，subagent 是"投递给身份"——这一个分歧衍生出 HB-01/02/03/04 四个问题；本次决策集的核心（D-20/21/22）就是把 hub 的送达模型往"投递给身份"方向收拢。
- **不做会怎样**：HB 清单里"本迭代最贵的一条"（HB-01）和体感最差的一条（HB-02）会持续存在，且历史上已三次诱发"自建脚本绕开现成功能"（F-9），该模式会继续复发。
- **为什么现在做**：五项原始决策（D-20~D-24）已经过独立讨论定案，本轮追加的三项（超时 D-26~D-29、并发 D-30~D-32）恰好填补原决策集里唯一还牵动"最贵一条"（HB-01）与"单实例串行"（HB-04）的两个缺口，形成完整闭环。
- **为什么这次用 subagent 通道执行**：本迭代要改造的正是 hub 的送达与超时机制，而 0029 实测的 30 分钟固定上限（F-5）会让"边改边用同一通道"退化成鸡生蛋问题（改造前无法安全使用，改造中又被上限截断）；用本地 subagent 通道执行，使实现期的推进速度不依赖被改造对象本身。
- **为什么模型绑定沿用 0028 清单**：`dev` 与 `verifier` 异源（gpt vs grok）是验证独立性的既有配置，本次只换通道不改绑定，保持两次迭代之间可对照。

### 验证方法（怎么判断上面的效果已达成）

1. **效果 1/2**：起一次真实 `mode=background` 调用 → 不订阅、不轮询，终态产生后 `GET /api/pickup` 取件成功；随后重启 hub 进程，再次取件仍成功（条目未 ack）。
2. **效果 3**：分别制造一次"取消"、一次"agent 执行失败"、一次"空闲超时"，检查三条终态的 `reason` 各不相同且落在枚举内，`detail` 保留原自由字符串。
3. **效果 4**：构造一个持续产出 `task.update` 但总时长超过旧 30 分钟阈值的任务，确认其不因累计时长被判死；再构造一个停止产出进展的任务，确认其在空闲阈值后被判死且 `reason=timeout`。
4. **效果 5**：手动启动同一角色的两个实例，对同一角色并发派发两条不同 `chat_id` 的调用，确认落在不同实例；同一 `chat_id` 连续两轮确认落在同一实例。
5. **效果 6**：逐条派发记录附子 agent 自报模型（`dev`→gpt、`verifier`→grok、其余→默认），并在阶段 6 由 verifier 独立复核。

### 执行方式约束（本次迭代专用，过程要求）

1. **派发一律走本地 subagent 通道**（D-33）：宿主 `task` 派发、brief 按 workflow-pb §Brief 构建规则全文注入角色定义；不使用 hub 派发。hub 仅作为**被改造对象**与取证面，不作为派发通道。
2. **模型路由按 D-34/D-35 落地**：`.omp/agents/dev.md` / `.omp/agents/verifier.md` + `.omp/config.yml` 的 `modelRoles`；模型值不进 `roles/*/*.md`。
3. **每次派发留证模型归属**：在 `status.md` 的派发台账逐条记录子 agent 自报模型（判据见效果 6）。
4. **阶段 6 的并发真实执行证据按 subagent 通道形态取证**：迭代产物与 hub 调用记录不再是同一通道，并发证据以 git 事实（worktree 落点/分支时间窗/提交交错）为主（沿用 0029 D-19 的取证形态变更）。
5. **执行中的摩擦与需求层问题**当场搭置到 `docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md`，不回退、不暂停（按 workflow-pb 既有机制）。
6. **迭代产物**落在工作区 `docs/iterations/0030-hub-communication-upgrade/`；阶段推进按 `roles/workflow-pb/workflow-pb.md`。

---

## 确认记录

- **D-20~D-32 全部 `user_confirmed`**：确认发生在本次起迭代之前的同一需求讨论（载体 = 预稿 `docs/hub-communication-upgrade-demand-2026-09-17.md` §二，逐条标注 `user_confirmed`，无遗留 `model_inferred`）；本次由用户 2026-09-17 指令"按照此需求开启新迭代"承接为迭代起点。
- **D-33~D-36 为本次起迭代 round 1 逐条确认**（2026-09-17，用户对四个提案的显式裁决，见 `clarifications/round-1-kickoff.md` §六）。
- **无遗留 `model_inferred`** ⇒ 本 `demand.md` 两段结构完整、可交付。
- 起点材料内部一致性检查：预稿 §二（D-20~D-32）与 ④ 的决策 1~5 逐条对应、无矛盾；预稿 §一 的 F-5（HB-01，30 分钟固定上限）与 D-26~D-29（空闲判据）是同一问题的"现象/修法"两面，不构成冲突。
