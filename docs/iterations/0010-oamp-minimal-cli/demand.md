# 需求合同：OAMP 最小拓扑 CLI（迭代 0010）

## 文档状态

**本版状态：定稿版（user_confirmed 收敛完成，2026-09-09，可进入阶段 2）。**

上一版为 demand 角色收敛后的"最佳草稿"（v0.1.0）：缺口以【待确认 → P-0x】占位并汇总于文末"待确认提案清单"。2026-09-09 主 agent 转交用户逐条确认，**9 项（P-01~P-09）全部确认完成**，确认结果已回填：澄清依据 §5 追加"用户逐条确认记录"（每项 `user_confirmed` 附用户决策要点）；需求结论（W1~W6、N1~N8、§3 方法面、§4 效果条款）已改写为与确认一致，P-01 按用户选择备选①（含最小 send→deliver→ack 冒烟链路）；文末"待确认提案清单"已转为"用户确认记录表"。两段均有内容、零【待确认】占位、零未确认 model_inferred，可作为阶段 2（功能规格）的输入。

---

## 第一段：澄清依据

### 1. 本轮用户表述与已确认决策（2026-09-09，user_confirmed）

**用户本轮原始表述（原文照录）**：

> "请新建迭代分支，我希望按照 workflow-pb 的工作流，先实现最小的拓扑结构，支持我测试。这个分支不一定会合入主干，切记用独立分支实现。我期望有一个 cli 程序（选型你来定，建议 node js 或 rust），可以启动维护 router，可以启动 agent deamon，维护心跳。"

**user_confirmed 决策（确认原料，全部生效）**：

| # | 决策 | 来源标注 |
|---|---|---|
| D-1 | 迭代 ID = `0010-oamp-minimal-cli` | user_confirmed（2026-09-09） |
| D-2 | 代码位置 = 仓库顶层 `oamp/` 独立目录（本轮新建） | user_confirmed |
| D-3 | 实现语言 = Node.js（v22 可用，本机实测 v22.15.0）；技术底座 = 零依赖 UDS + JSON-RPC 2.0 + node:test MVP | user_confirmed |
| D-4 | 本迭代在独立分支 `iteration/0010-oamp-minimal-cli` 实现；阶段 6 后是否合入 main 由用户后续决定（分支不一定会合入主干） | user_confirmed |
| D-5 | 本迭代范围 = 最小拓扑结构、支持用户测试；CLI 能力 (a) 启动并维护 Router、(b) 启动 agent daemon 并维护心跳 | user_confirmed |

### 2. 前两轮背景与拓扑修正（作为需求原料，与 docs/ds 不一致处以用户修正为准）

**背景**：用户前两轮要求调研并交付 `docs/ds/` 协议方案包——多 omp 实例各指定 provider、注入 agents.md 式初始化规则（prompt_profile）、agent 间消息投递 + Ack 保活 + 任意路由。方案包含：README（分层结论：A2A v1.0 语义对齐 + OAMP 消息层 + JSON-RPC 2.0/UDS 传输）、01 需求与边界（R-01~R-06）、02 协议选型调研、03 总体架构与生命周期（星型 Router）、04 OAMP 协议规格、05 实例配置与初始化集成、06 风险未决与实施路线。该包状态为"方案建议，待实现阶段确认"，当前未提交 git（工作区未跟踪）。

**ASCII 图确认时的两条用户修正（以修正为准）**：

- **R1（Router 定位）**：Router 不一定是本机——Router 是**独立服务角色**，负责路由 + 注册 + 心跳维护，不内嵌于某个 agent。
- **R2（主 agent 位置）**：**主 agent 也通过 Router 连接其他 agent，同为注册节点**（星内普通节点，不是星外调度者）。

**与 docs/ds 的差异说明（记录在案）**：docs/ds/03 §1 拓扑图将 Router 画在本机（ompd 与 Launcher 同框）、主 agent 画在星型之外（仅经 Launcher/人工接入）。按修正：主 agent 是 Router 上的注册节点之一（R2）；Router 是独立服务而非某个 agent 的附属（R1）。docs/ds 其余要点与修正不冲突、沿用：星型强制中转（agent 不直连）、Router 职责边界（注册 + 租约 + 路由 + 投递 + Ack/重试 + 持久化，不做 LLM/业务/凭据）、Ack 与心跳严格分离。

**与 D-3 的一致性**：本迭代 UDS 本机 MVP（D-3）与 R1"Router 不一定是本机"不冲突——R1 针对 Router 的**角色定位**（独立服务、未来可跨机），传输层跨机适配属后续路线（docs/ds/06 U-03 默认：MVP 不需要跨机，只做 UDS）。本迭代按 D-3 落地 UDS。

**docs/ds 全量方案与本迭代的关系**：docs/ds 是跨迭代的完整路线图（06 §5 给出 6 步实施顺序）；本迭代 = 其**第一个可测切片**（拓扑存活层：Router 注册表 + 节点心跳 + **最小消息契约闭环**——P-01 用户选择契约先行，06 §5 第 1 步在本轮即做），不承担全量 MVP。

### 3. 现状核查（客观事实，已核实）

- 仓库根目录**无 `oamp/` 目录**（本轮新建，D-2）。
- Node v22.15.0 本机可用（满足 D-3 的 v22）。
- 当前工作区在 `main`；`iteration/0010-oamp-minimal-cli` 尚未创建（workflow-pb v0.8：阶段 1 推进条件通过后由主 agent 创建）。
- `docs/ds/` 与 `docs/multi-omp-agent-protocol.md`（v0.1 草案）均为**未跟踪文件**——起点材料是刚交付的方案建议，尚未进入任何提交；本迭代产物按 D-4 落在独立分支。

### 4. 用户已有的方案雏形（第 6 维采集结果）

| 条目 | 内容 | 来源 |
|---|---|---|
| 语言 | Node.js（用户原话"建议 node js 或 rust"，选型权交执行方后定 Node.js） | user_confirmed（D-3） |
| CLI 形态 | 一个 CLI 程序，具备两类启动能力（Router / agent daemon） | 用户原话 |
| 本迭代目标形态 | 最小拓扑 = Router + agent daemon + 心跳维护 | 用户原话（D-5） |
| 技术底座 | 零依赖 UDS + JSON-RPC 2.0 + node:test | user_confirmed（D-3） |
| 拓扑原则 | Router 独立服务角色；agent（含未来主 agent）都是经 Router 注册的节点 | 用户修正 R1/R2 |
| 交付边界 | 独立分支、不自动合 main | user_confirmed（D-4） |
| 消息契约 | 本轮即做最小 send→deliver→ack 冒烟闭环（docs/ds 06 §5 第 1 步"契约先行"原样） | user_confirmed（P-01，2026-09-09） |

### 5. 六维诊断与用户逐条确认记录（2026-09-09，P-01~P-09 均 user_confirmed）

> demand 草稿对每个缺口给出推荐填法 + 理由 + 备选，主 agent 转交用户逐条拍板；9 项全部确认。以下记录用户决策（原样要点）与对草稿的影响，推理供追溯。

- **P-01 消息投递范围（user_confirmed，用户选择备选①，未采纳 demand 推荐）**：**含最小 send→deliver→ack 冒烟链路**——按 docs/ds 06 §5 第 1 步"契约先行"原样，本轮即做：固定信封 + 纯内存 Router + 跑通 register → send → deliver → ack → heartbeat 的最小闭环，以协议契约测试为可执行形态（脚本级双假节点）。demand 原推荐"整体后移下一迭代"被用户否决。
- **P-02 节点形态（user_confirmed，采纳推荐）**：agent daemon = 裸协议节点（注册 + 心跳 + 注销，可选元数据），不含 provider/model/prompt 执行。
- **P-03 并发节点数（user_confirmed，采纳推荐）**：Router 支持 ≥2 个 agent daemon 并发注册并同时被维护；手测场景 1 Router + 2 agent；自动测试覆盖 2 节点并发在线。
- **P-04 心跳维护语义（user_confirmed，采纳推荐）**：含最小 lease→offline 判定；suspect 两段判定后移。
- **P-05 观测面（user_confirmed，采纳推荐）**：CLI 提供只读 status 查询子命令（连 Router 查注册表：instance_id/session/state/last_heartbeat）+ 终端事件日志（心跳日志节流，防刷屏）。
- **P-06 运行形态与配置面（user_confirmed，采纳推荐）**：前台长驻 + 子命令（`oamp router start` / `oamp agent start <id>` / `oamp status`），参数走 CLI flag/env，本轮不引入 YAML。
- **P-07 身份安全边界（user_confirmed，采纳推荐）**：无注册 token 鉴权；只做 UDS socket 0600 + 同 instance_id 并发唯一性；零凭据字段红线。
- **P-08 持久化（user_confirmed，采纳推荐）**：不做运行记录持久化（无 NDJSON/SQLite），Router 状态全内存、重启清空、节点重连重注册。
- **P-09 效果条款（user_confirmed，采纳推荐并因 P-01 联动修订）**：4 条裸判定条款定稿；条款①自动覆盖链路扩展为 register→heartbeat→send→deliver→ack→kill→offline→同 id 重启重注册；链路中 message_id 作为幂等键字段存在——是否含重试/超时重投由阶段 3 决定，本合同只锁方法面与效果边界，不锁架构决策。

**六维诊断收敛判据自检**：明确性（P-02/P-04/P-06）、逻辑闭环（P-01/P-04/P-09）、边界完整性（P-01/P-03/P-07/P-08）、内部一致性（P-01↔P-08：无重试/超时重投则无 outbox 持久化对象，一致）、可验证性（P-05/P-09）、方案雏形（P-06 及 W1~W6 每条的"怎么做"均已问过并确认）——六维跑不出新缺口，收敛完成。

---

## 第二段：需求结论

### 1. 做什么

**W1（user_confirmed，D-2/D-3）**：在仓库顶层新建 `oamp/` 独立目录，交付一个 **Node.js CLI 程序**（v22、零依赖），技术底座 = UDS + JSON-RPC 2.0 + node:test。

**W2（user_confirmed，D-5a）**：该 CLI **可以启动并维护 Router**——Router 是独立服务角色（R1），维护注册表与节点心跳。

**W3（user_confirmed，D-5b + P-02）**：该 CLI **可以启动 agent daemon 并维护心跳**——agent daemon 为**裸协议节点**（通用节点客户端，注册 + 周期心跳 + 退出注销；不含 provider/model/prompt 执行，P-02）；按 R2，节点客户端保持通用形态（未来真实 OMP 实例与主 agent 接入复用同一客户端）。

**W4（user_confirmed，D-1/D-4）**：全部实现在独立分支 `iteration/0010-oamp-minimal-cli` 上落地；阶段 6 后是否合入 main 由用户决定（不自动合入）。

**W5（user_confirmed，D-5 + P-03/P-04/P-05）**：本迭代交付"最小拓扑结构"，支持用户实际测试——Router 支持 **≥2 个不同 instance_id 的 agent daemon 并发注册并同时被维护**（P-03）；Router 做**最小 lease→offline 判定**（P-04）；观测面 = status 查询 + 事件日志（P-05）。

**W6（user_confirmed，P-01）**：**含最小消息投递冒烟链路**——按 docs/ds 06 §5 第 1 步"契约先行"：固定信封（含 `message_id` 幂等键字段）+ 纯内存 Router，以协议契约测试形态跑通 **register → send → deliver → ack → heartbeat** 的最小闭环（脚本级假节点，非真实 OMP）。协议方法面最小集 = `agent.register` / `agent.heartbeat` / `agent.deregister` / `message.send` / `message.deliver` / `message.ack` + Router 查询方法（供 status，P-05）。

- 去掉 W6 后最小闭环是否还成立：拓扑存活层（W1~W5）仍成立，但用户已明确本轮就要消息契约闭环（P-01 拍板），去掉即违背用户决策，故保留。
- 每条 W 的方案雏形均经用户确认（来源见 §4/§5），无未问条目。

### 2. 不做什么

**N1. 不做重试 / ack 超时重投机制与幂等去重状态机**——`message_id` 作为幂等键字段存在于信封并贯通链路，但"超时是否重投、按 message_id 去重的状态机行为"由阶段 3 决定是否纳入本轮（P-09 用户明确：本合同只锁方法面与效果边界，不锁此架构决策）。理由：P-01 用户选的是**最小冒烟闭环**（happy path 契约测试），docs/ds 全量 MVP 的重试/幂等语义（DS-06）不在本轮承诺。
**N2. 不做投递/运行记录持久化与重启恢复**（无 registry/outbox NDJSON、无 SQLite）——Router 状态全内存，重启即清空，节点重连后重新注册即可（P-08）。理由：持久化对象是"未完成投递"（outbox），本轮无重试/超时重投语义（N1），outbox 无消费者，做了即死代码；审计由终端事件日志承担（P-05）。
**N3. 不做 provider/model/prompt_profile 集成**（无 LLM 执行、无 Launcher/omp-instances.yaml 全量配置语义，P-02）。理由：本轮无任务消息，注入 provider 无从验证；节点客户端保持裸协议通用形态，集成属下一迭代（docs/ds 05 Launcher 链路）。
**N4. 不做广播/selector 路由、白名单、fan-out 与 topic 订阅**——方法面仅点对点 `message.*`。理由：docs/ds 明确"先在点对点契约稳定后加"（06 §3 不包含清单），广播语义依赖 selector 元数据建模，超出最小闭环。
**N5. 不做 suspect 两段判定**——Router 心跳维护 = lease→offline 单段最小判定（P-04）。理由：suspect 是 docs/ds 03 §4.3 的中间态细化，价值在减少 busy 长任务误判，本轮无长任务可验证，后移。
**N6. 不做注册鉴权（token 机制）与凭据管理**——只做 UDS socket 0600 + 同 instance_id 并发唯一性（P-07）。理由：本轮节点无凭据可管，token 价值在防冒充，等跨机/真实接入再补（docs/ds U-05）。
**N7. 不做 Router 进程守护/自动重启/后台 daemonize**——前台长驻进程（P-06）。理由：零依赖下前台最简可观察；自动拉起/重启 agent 属 Launcher 职能（docs/ds 03），下一迭代。
**N8. 不做跨机传输/远程 Router 适配**——本迭代 UDS 本机 MVP（D-3；docs/ds 06 U-03 默认跨机不需要）。理由：R1"Router 不一定是本机"针对角色定位，传输层跨机适配待跨机需求出现再评估（NATS 替换 vs A2A HTTP adapter）。

（N1~N8 均附"为什么这次不做"；原为 demand 推断边界，2026-09-09 经用户逐条拍板 P-01~P-09 全部 user_confirmed。）

### 3. 大概怎么做（锁定方向性事实与机制轮廓，不锁架构细节）

- **技术底座（user_confirmed，D-3）**：Node.js v22、**零依赖**；传输 = **Unix Domain Socket**；外层协议 = **JSON-RPC 2.0**；测试 = **node:test**。
- **拓扑（user_confirmed，R1/R2 + D-5）**：星型——Router 是独立服务角色，维护注册表与节点心跳；agent（含未来主 agent）都是经 Router 注册的节点；agent 间不直连、不经 Router 的消息不存在。
- **协议方法面（user_confirmed，P-01/P-05）**：`agent.register` / `agent.heartbeat` / `agent.deregister` / `message.send` / `message.deliver` / `message.ack` + Router 查询方法（供 status）。冒烟链路以**协议契约测试**为可执行形态（docs/ds 06 §5 第 1 步原样：脚本级假节点双端跑通 register → send → deliver → ack → heartbeat）；客户端协议能力作为通用节点客户端实现，CLI agent daemon 是同一客户端的用户入口形态。
- **信封（user_confirmed 边界，P-09）**：消息信封含 `message_id` 作为幂等键字段并贯通链路；重试/超时重投/幂等吸收的行为边界见 N1，是否实现由阶段 3 定。
- **心跳与判活（user_confirmed，P-04）**：agent 周期心跳；Router 记录 last_heartbeat 并做 lease→offline 单段判定；agent 重启（新 session、同 instance_id）重新注册替换旧 offline 记录。默认参数沿用 docs/ds 参考值（interval 10s / timeout 30s），具体数值与是否可配 → `[架构待填]`。
- **CLI 形态（user_confirmed，P-05/P-06）**：前台长驻 + 子命令 `oamp router start` / `oamp agent start <instance-id>`（可多次执行拉起多节点）/ `oamp status`（只读查询）；SIGINT/Ctrl-C 优雅退出（agent 发 deregister、Router 清 session）；参数以 CLI flag/env 为主（本轮必填仅 instance_id），不引入 YAML 配置文件。
- **持久化（user_confirmed，P-08）**：Router 状态全内存，无 NDJSON/SQLite。
- **落地流程**：阶段 2 拆功能卡 → 阶段 3 架构（重点：方法面 RPC 细节、模块划分、同 instance_id 冲突替换规则、status 查询方法与字段、测试用例组织）→ 阶段 4/5 在独立分支实现 → 阶段 6 独立验证 → 合入 main 由用户决定（D-4）。
- **`[架构待填]`（全部留给阶段 3，不在本合同锁死）**：Node 模块划分与进程内组件边界；JSON-RPC 2.0 实现细节（UDS 帧、请求/通知/错误映射）；socket 路径与运行时产物布局、gitignore 规则；心跳/lease 具体数值与是否可配；同 instance_id 冲突的精确替换规则（唯一性语义已锁：同一时刻仅一个 live session）；status 查询 RPC 方法名与返回字段；消息信封字段子集的确切定义与校验；是否含重试/超时重投与幂等去重状态机（N1 边界内）；node:test 用例组织与假节点形态。

### 4. 达到什么效果（裸判定：不问作者也能判断真假；P-09 user_confirmed）

- **E1（自动化主链路）**：`oamp/` 下 `npm test`（node:test）全绿，自动覆盖完整链路：agent 注册成功 → 周期心跳被 Router 记录 → `message.send` 提交的消息经 Router `deliver` 到目标且目标回 `ack`（链路中 `message_id` 作为幂等键字段贯通）→ 进程被杀后 Router 在超时后判 `offline` → 同 instance_id 重启后重新注册成功。
- **E2（手测拓扑）**：按 README 手测步骤（Router 终端 + agent 终端 + status 查询）可复现：节点 online、心跳持续可见；kill 节点进程后，status 显示该节点 offline。
- **E3（并发）**：两个不同 instance_id 的 agent daemon 可同时 online，被同一 Router 维护（可同时各自心跳；测试覆盖 2 节点并发在线场景）。
- **E4（卫生）**：`oamp/` 运行时产物（socket 等）不进入 git；代码与配置中无任何凭据字段。

### 5. 为什么这么做

- **直接触发点（user_confirmed 表述）**：用户按 workflow-pb 迭代式推进 OAMP（多 omp 实例 agent 通信协议），本迭代**先交付最小拓扑结构**——让拓扑存活层（Router 注册表 + 节点心跳）立起来、可被用户亲手测试，再谈消息/执行等上层闭环。
- **消息契约前置（user_confirmed，P-01）**：用户在"纯拓扑"与"拓扑 + 最小消息闭环"之间选择了后者——按 docs/ds 06 §5 第 1 步契约先行，本轮即以协议契约测试固定信封与 register→send→deliver→ack→heartbeat 闭环，让 OAMP 规格（docs/ds 04）以测试为可执行形态，避免协议文本与实现漂移。
- **拓扑原则来源（user_confirmed）**：R1/R2（Router 独立服务角色、主 agent 同为注册节点）来自用户对架构图的直接修正，本合同的 W2/W3 与节点通用形态忠实保留该骨架。
- **边界收敛原则**：每个"不做什么"（N1~N8）都能说清"为什么这次不做"；本次只交付"可测的最小拓扑切片 + 消息契约闭环测试"；docs/ds 全量 MVP（provider 集成、广播、持久化、鉴权、跨机）逐项后移，随后续迭代兑现。

---

## 用户确认记录表（原"待确认提案清单"→ 2026-09-09 全部确认，转为本表）

| # | 问题 | 用户决策（user_confirmed，2026-09-09） | demand 原推荐 | 决策影响 |
|---|---|---|---|---|
| P-01 | 本迭代协议方法面是否含消息投递？ | **含最小 send→deliver→ack 冒烟链路**（选择备选①，未采纳推荐）：docs/ds 06 §5 第 1 步"契约先行"原样，固定信封 + 纯内存 Router，跑通 register→send→deliver→ack→heartbeat 最小闭环，以契约测试为可执行形态 | 消息闭环整体后移下一迭代 | 新增 W6；方法面含 message.* 六方法 + 查询；N1 把重试/幂等状态机划出（由阶段 3 定） |
| P-02 | agent daemon 是裸协议节点还是 LLM 实例？ | 裸协议节点（采纳推荐） | 裸协议节点 | W3 定稿：通用节点客户端，无 provider/prompt；N3 |
| P-03 | 拓扑验收几个并发节点？ | ≥2 节点并发注册并同时被维护（采纳推荐） | 同左 | W5/E3 含 2 节点并发；测试覆盖 2 节点场景 |
| P-04 | Router 心跳维护是否含判活？ | 含最小 lease→offline 判定，suspect 后移（采纳推荐） | 同左 | W5/E1/E2 的 offline 判定成立；N5 |
| P-05 | 观测面怎么做？ | status 只读查询子命令 + 事件日志（采纳推荐） | 同左 | 方法面加查询方法；E2 手测载体 |
| P-06 | CLI 运行形态与配置面？ | 前台长驻 + 子命令，参数走 flag/env，无 YAML（采纳推荐） | 同左 | W1/§3 CLI 形态定稿；N7 |
| P-07 | 身份安全做到哪一级？ | 无 token，UDS 0600 + 同 instance_id 唯一性（采纳推荐） | 同左 | §3 唯一性语义锁定（同一时刻仅一个 live session）；N6 |
| P-08 | 持久化做不做？ | 不做，全内存（采纳推荐） | 同左 | W5/§3 全内存；N2 |
| P-09 | 效果条款措辞？ | 4 条裸判定采纳，条款①按 P-01 扩展为 register→heartbeat→send→deliver→ack→kill→offline→同 id 重启重注册；message_id 作为幂等键字段存在，重试/超时重投由阶段 3 决定（采纳推荐+联动修订） | 同左 + 无消息链路 | E1~E4 定稿；N1 边界（字段存在已锁，行为未锁） |

（确认执行：2026-09-09 主 agent 转交、用户逐条确认，9 项全部 user_confirmed，无残留 model_inferred。本定稿可进入阶段 2。）
