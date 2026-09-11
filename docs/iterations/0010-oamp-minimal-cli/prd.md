# prd.md — 0010-oamp-minimal-cli

**版本**: 0.2.0
**迭代**: 0010-oamp-minimal-cli
**创建日期**: 2026-09-09
**阶段**: 功能规格（Phase 2）
**状态**: 阶段 2 产物（M-01~M-03 已确认 2026-09-09 user_confirmed，可进阶段 3；待阶段 3 补全 `[架构待填]` 项）
**输入合同**: `demand.md`（v0.2.0 定稿版，2026-09-09 user_confirmed 收敛完成）

---

## 功能点索引

| ID | 功能名 | 用户价值摘要 | 规格卡 | model_inferred | 架构待填 |
|---|---|---|---|---|---|
| F01 | CLI 入口与子命令分发（含运行底座与交付形态） | 一个 `oamp` 入口统一拉起 Router / agent 节点 / 查询状态；v22 零依赖 + node:test 底座；README 承载手测 | [F01](prd/F01-cli-entry-subcommand-dispatch.md) | M-01（已确认） | 入口形态/分发实现/信号处理/README 组织 |
| F02 | Router 启动与注册表维护 | 独立服务角色 Router 接受节点注册，维护含 instance_id/session/state/last_heartbeat 的注册表；≥2 节点并发、同 id 唯一、重注册恢复 | [F02](prd/F02-router-start-registry.md) | — | 注册表 schema/同 id 冲突规则/deregister 处置/socket 路径 |
| F03 | agent daemon 节点客户端 | 反复 `oamp agent start <id>` 拉起裸协议节点：注册 + 周期心跳 + SIGINT 注销，通用形态供未来实例复用 | [F03](prd/F03-agent-daemon-node-client.md) | — | 心跳间隔/连接生命周期/SIGINT 时序 |
| F04 | 心跳租约与 offline 判定 | Router 自动发现死节点：心跳超时→offline 单段判定，无需人工 | [F04](prd/F04-heartbeat-lease-offline.md) | — | interval/timeout 数值与可配性/到期检查机制 |
| F05 | status 只读查询 | 一条命令看拓扑事实：instance_id/session/state/last_heartbeat，无副作用 | [F05](prd/F05-status-readonly-query.md) | M-02（已确认） | Router 查询方法名与 schema/输出格式 |
| F06 | 终端事件日志（心跳节流） | Router/agent 终端可见状态变迁事件，心跳日志节流不刷屏 | [F06](prd/F06-terminal-event-log.md) | M-03（已确认） | 事件分类与行格式/节流窗口数值 |
| F07 | 最小消息投递闭环（send/deliver/ack 契约测试） | 契约测试固定信封（message_id 幂等键贯通）与 register→send→deliver→ack→heartbeat 闭环 | [F07](prd/F07-message-delivery-contract.md) | — | 信封定义/ack 流向/寻址/重试域归属/假节点形态 |
| F08 | 卫生红线（运行时产物不入 git / 零凭据） | 运行产物不混入版本库、代码配置零凭据字段，仓库干净可共享 | [F08](prd/F08-hygiene-runtime-artifacts-credentials.md) | — | 产物落点与 gitignore/凭据检查载体 |

**合计**：8 个功能点。

---

## 本次迭代边界说明

### 包含

- 仓库顶层新建 `oamp/` 独立目录，交付 Node.js v22、零依赖的 CLI（UDS + JSON-RPC 2.0 + node:test 底座）（W1/D-2/D-3）。
- 单一 CLI 三形态：`oamp router start`（独立 Router 服务：注册表 + 心跳维护）、`oamp agent start <instance-id>`（可多次执行拉起多节点）、`oamp status`（只读查询）；前台长驻 + SIGINT 优雅退出；无 YAML 配置面（P-05/P-06）。
- 最小拓扑：Router 支持 ≥2 个不同 instance_id 节点并发注册并同时被维护；最小 lease→offline 单段判定；观测面 = status 查询 + 事件日志（心跳节流）（W5）。
- 最小消息契约闭环：固定信封（含 message_id 幂等键字段贯通链路）+ 纯内存 Router，以协议契约测试形态跑通 register→send→deliver→ack→heartbeat（W6/P-01）。
- 卫生红线：运行时产物不入 git；代码与配置零凭据字段（E4）。
- **W4（独立分支落地、不自动合 main）作为流程/SCM 约束处理，不拆功能卡**——它由 workflow-pb 规则（变更须在 `iteration/0010-oamp-minimal-cli` 迭代分支与 PR worktree 分支进行、阶段 6 后是否合入 main 由用户决定）在主 agent 调度与提交纪律层强制，不是可被 node:test/手测判定的产品功能；功能卡验收均不依赖分支策略。

### 不包含（边界，源自 demand N1~N8）

- 不做重试 / ack 超时重投 / 幂等去重状态机——message_id 字段存在贯通已锁，行为是否实现由阶段 3 定（N1，见 F07 边界）。
- 不做任何投递/运行记录持久化（Router 状态全内存、重启清空、节点重连重注册）（N2）。
- 不做 provider/model/prompt 集成（agent 为裸协议节点，通用形态）（N3）。
- 不做广播/selector 路由、白名单、fan-out、topic 订阅——仅点对点 message.*（N4）。
- 不做 suspect 两段判定——lease→offline 单段最小判定（N5）。
- 不做注册鉴权 token 机制——安全面仅 UDS socket 0600 + 同 instance_id 并发唯一性（N6/P-07）。
- 不做 Router/agent 进程守护、自动重启、后台 daemonize——前台长驻（N7）。
- 不做跨机传输/远程 Router 适配——UDS 本机 MVP（N8）。

---

## 需求追溯（与 demand.md 一一对应）

| demand.md 条目 | 覆盖功能卡 |
|---|---|
| W1（oamp/ 目录 + Node.js v22 零依赖 CLI，UDS + JSON-RPC 2.0 + node:test） | F01 |
| W2（启动并维护 Router：独立服务角色、注册表 + 心跳维护） | F02 |
| W3（启动 agent daemon：裸协议节点，注册 + 周期心跳 + 退出注销；通用形态） | F03 |
| W4（独立分支落地、不自动合 main） | 流程约束，见上方边界说明（不进卡） |
| W5（最小拓扑：≥2 节点并发维护 / lease→offline / status + 事件日志观测面） | F02（并发注册/唯一性）、F04（lease→offline）、F05（status）、F06（事件日志） |
| W6（最小消息投递闭环：信封 + 契约测试形态 register→send→deliver→ack→heartbeat） | F07 |
| N1（不做重试/超时重投/幂等去重状态机，message_id 字段已锁） | F07 边界 + 架构待填 |
| N2（无持久化，全内存） | F02 边界、F04 边界、F07 边界 |
| N3（无 provider/model/prompt） | F03 边界 |
| N4（无广播/selector/fan-out/订阅） | F07 边界 |
| N5（无 suspect 两段） | F04 边界 |
| N6（无 token 鉴权；socket 0600 + 同 id 唯一性；零凭据） | F02（0600/唯一性）、F08（零凭据否定面） |
| N7（无守护/自动重启/后台化，前台长驻） | F01 验收 7、F02/F03 边界 |
| N8（无跨机，UDS 本机） | F02/F05/F07 边界 |
| E1（npm test 全绿：register→heartbeat→send→deliver→ack→kill→offline→同 id 重启重注册） | F01 验收 1（测试载体）、F03（注册/心跳）、F04（记录/kill→offline）、F02（同 id 重注册）、F07（send→deliver→ack + message_id） |
| E2（README 手测：Router 终端 + agent 终端 + status，online/心跳/offline 可观察） | F01 验收 8（README 载体）、F05、F06 |
| E3（两节点并发 online 同一 Router 维护） | F02 验收 3、F03 验收 4、F04 验收 4 |
| E4（运行时产物不入 git、零凭据字段） | F08 |

无 demand.md 之外的新增功能点。八张卡覆盖 W1~W6 全部产品能力（W4 为流程约束），N1~N8 全部落入对应卡边界。

---

## 拆分理由（原子粒度判断）

- **F05/F06 拆分**：demand P-05 是同一观测面决策的两个独立载体——status 是"查询契约"（可用断言直接测），事件日志是"终端输出"（用观察窗口测）；失败模式与验收判据相互独立，任一可单独交付不阻塞另一个，且阶段 3 将分别处理查询 RPC 与终端日志机制，故拆为两卡。
- **F02/F03/F04 按角色与方向拆分**：Router 侧注册表语义（F02）、节点侧注册/心跳发起（F03）、Router 侧判活（F04）是三个独立可测方向——F02 锁"注册与唯一性"，F04 锁"超时判活"，中间以 deregister/重注册为交接点；三卡各自验收可在契约测试中独立断言。
- **F08 独立成卡**：E4 卫生红线与功能能力正交，可脱离任何功能卡单独验收（git 状态 + 扫描），独立卡避免其被当作某张功能卡的边角。
- **W4 不进卡**：流程/SCM 约束（workflow-pb 规则 A/B + 用户 D-4 决策），非可测试产品功能，见边界说明。

---

## model_inferred 确认记录（2026-09-09 user_confirmed）

M-01~M-03 于 2026-09-09 经主 agent 转交用户逐条确认，三条均采纳推荐、无推翻（user_confirmed），对应功能卡内标注已同步为确认状态——**零残留未确认 model_inferred**。原推导内容记录如下：

| 编号 | 来源功能卡 | model_inferred 内容（已确认） |
|---|---|---|
| M-01 | F01 验收 4/5 | CLI 误用行为：未知/非法子命令、`agent start` 缺 instance-id 必填参数时 → 非零退出 + 打印用法/明确报错 + 不挂起（demand 只确认了命令形态与"本轮必填仅 instance_id"，未说明误用时的行为） |
| M-02 | F05 验收 3 | `oamp status` 在 Router 未运行/不可达时 → 明确失败（非零退出 + 可理解错误），不静默输出空结果冒充成功 |
| M-03 | F06 验收 3 | 心跳节流的可测判据："固定观察窗口内单节点心跳日志条数有明确上限、显著小于实际心跳次数"（demand 只说"节流防刷屏"未给判据；上限/窗口数值归架构待填） |

---

## 架构待填列表（技术架构阶段处理）

以下只记录实现方式留白，不对下游做技术选型：

| 编号 | 来源功能卡 | 架构待填内容 |
|---|---|---|
| AR-01 | F01 | `oamp/` 内部文件布局与可执行入口形态（入口文件/bin 声明、模块划分）；子命令分发实现；前台长驻与信号处理；README 组织 |
| AR-02 | F02 | socket 路径与命名、注册表数据结构与条目 schema；JSON-RPC 2.0 方法面实现细节（register/deregister 请求-响应与错误映射） |
| AR-03 | F02 | 同 instance_id 冲突的精确替换规则（live 冲突时拒绝 vs 替换；唯一性不变量已锁）与 session 标识生成；deregister 后条目处置（移除 vs offline 保留）；进程就绪信号与退出清理 |
| AR-04 | F03/F04 | 心跳 interval/timeout 具体数值与是否可配（docs/ds 参考 interval 10s / timeout 30s；可配性影响自动化测试时长） |
| AR-05 | F04 | 租约到期检查机制（定时扫描 vs 惰性）与 offline 在注册表中的表示方式 |
| AR-06 | F05 | Router 查询方法的方法名与返回 schema；`oamp status` 定位 Router 的方式（socket 路径默认值/flag-env 覆盖）；输出格式 |
| AR-07 | F06 | 事件分类集合与事件行格式；心跳节流窗口与上限的具体数值/机制 |
| AR-08 | F07 | 消息信封字段子集定义与校验；send/deliver/ack 请求-响应映射与 ack 流向（回发送方 vs Router 记录）；目标寻址规则与未注册/离线目标的 send 行为 |
| AR-09 | F07 | 是否纳入重试/超时重投/幂等去重状态机（N1 边界内，message_id 字段已锁、行为未锁） |
| AR-10 | F07/F03 | 契约测试假节点形态与用例组织；真实 CLI agent（F03）与假节点在消息收发（deliver 受理/回执）上的关系 |
| AR-11 | F08 | socket/运行时产物落点与 gitignore 规则细节；凭据扫描的检查载体 |
| AR-12 | 全局 | JSON-RPC 2.0 over UDS 实现细节（帧、请求/通知/错误映射）与 node:test 用例组织 |

---

## 疑问与越界

1. **W4 未拆为功能卡**：作为流程/SCM 约束处理（workflow-pb 规则 A/B + 用户 D-4 决策），已在边界说明写明判断理由——如主 agent 认为需显式卡化，请指正。
2. **真实 CLI agent 进程内是否受理 deliver 并回 ack**：demand 明确冒烟闭环由"脚本级假节点"承担（P-01/W6），但未说明 `oamp agent start` 拉起的真实节点进程是否也要受理 deliver/回 ack（通用客户端能力的边界）。已在 F07/F03 标注架构待填（AR-10），建议阶段 3 明确，避免阶段 5 实现范围歧义。
3. **offline 后同 id 重注册的替换语义边界**：demand 已锁"offline 后重新注册成功（E1）"与"同一时刻仅一个 live session（P-07）"，但 live 冲突时新注册的精确处置（拒绝 vs 替换）未锁——已在 F02 标注架构待填（AR-03），不属于本阶段产品结论。
4. 未发现 demand.md 内部矛盾或需回退的缺口；本阶段未修改 demand.md。
