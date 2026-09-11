# F07：最小消息投递闭环（send/deliver/ack 契约测试）

**功能 ID**: F07
**来源**: `demand.md` W6（P-01）、需求结论 §3「协议方法面/信封」；效果条款 E1（send→deliver→ack 节）
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用可执行的协议契约测试（脚本级假节点）固定消息信封与 register→send→deliver→ack→heartbeat 闭环，让 OAMP 协议以测试形态落地——协议文本与实现不漂移（P-01"契约先行"）。

## 验收标准

1. 以协议契约测试形态（脚本级假节点，node:test）跑通最小闭环：两节点注册 → 发送方提交 message.send → Router 将消息 deliver 至目标节点 → 目标回 message.ack → 双方继续 heartbeat——全链路无错误完成（W6/E1 中段）。（node:test）
2. 消息信封含 message_id 幂等键字段，且该字段在 send 提交 → deliver 到达 → ack 回执全链路贯通一致：同一消息的 message_id 端到端不变、可关联（P-09/E1）。（node:test）
3. deliver 到目标节点的消息负载与 send 提交的一致（不丢、不改，目标可还原发送内容与发送方）。（node:test）
4. 闭环所用协议方法面覆盖最小集：agent.register / agent.heartbeat / agent.deregister / message.send / message.deliver / message.ack（Router 查询方法归 F05 承担）（W6/P-01）。（node:test）

## 边界（不包含）

- 不承诺重试 / ack 超时重投 / 按 message_id 幂等去重状态机——message_id 作为幂等键字段**存在并贯通**已锁（本卡验收 2），重试/去重的行为是否实现由阶段 3 定（N1/P-09）。（对应架构待填项）
- 不做广播 / selector 路由 / 白名单 / fan-out / topic 订阅——仅点对点 message.*（N4）
- 不做投递持久化 / outbox（N2：无重试则 outbox 无消费者）
- 不做跨机投递（N8）
- 不做 provider/prompt 集成（N3，消息无业务执行语义）
- 真实 CLI agent 进程内对 deliver 的受理与回执形态不在本卡承诺（见架构待填；冒烟闭环以契约假节点证明）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §4.4~4.6/§5.5/§6.4/§10/D10~D12）

- **信封子集与校验（AR-08 → D10，§4.5）**：`{protocol:"oamp/1"(必), message_id(必：非空≤64 可打印 ASCII，幂等键端到端不变), type(可选预留，Router 不校验), from{Router 代填，携带任何 from 一律 INVALID_SENDER}, to{instance_id}(必，点对点), payload{content_type ∈ text/plain|text/markdown|application/json, body}(必), created_at(Router 代填 UTC)}`；违反 → `INVALID_MESSAGE`。
- **send/deliver/ack 映射与 ack 流向（AR-08 → D10/D11，§4.4/§4.6/§5.5）**：send（请求）= **单次投递同步代理**——校验目标 live 后转发 deliver、等目标传输应答再回发送方 `{accepted:true, message_id, status:"delivered"}`（本轮无 queued/异步投递语义，docs/ds queued 依赖 outbox+重试，均 N 掉）；deliver（Router→目标请求）→ 目标回 `{received:true}`（传输层应答），Router 记投递等待集；ack（目标→Router 请求）**流向 = Router 记录，不回发送方**（无 message.status/事件推送）：Router 校验 pending + 会话 + `status:"accepted"` → 回 `{acked:true}`；未知 message_id → `UNKNOWN_MESSAGE`，会话不符 → `STALE_SESSION`。
- **寻址与未注册/离线 send（AR-08 → D10，§4.4）**：仅按 instance_id 寻址当前唯一 live 会话（替换语义保证映射最新）；目标不在注册表 → `AGENT_NOT_FOUND`，offline/连接已断 → `AGENT_OFFLINE`——**同步拒绝，不排队、不进入重试域**（N1）。发送方连接未注册 → `UNREGISTERED`。
- **重试/超时重投/幂等去重状态机（AR-09 → D11）**：**不纳入**。裁决理由：重投的唯一消费者是幂等去重表、去重表的唯一消费者是重投——无重投则状态机无触发源（死代码）；message_id 的贯通语义由 Router 单次投递等待集 + ack 校验承担（保证 ack 可关联、防伪）。与"最小冒烟"的张力：E1 冒烟仅承诺 happy path 单次投递成功 + message_id 贯通，重投/去重属故障注入域（docs/ds 06 实施第 2 步），本轮无故障注入用例，纳入即超出冒烟范围。
- **假节点形态与真实 agent 关系（AR-10 → D12，§10.1）**：假节点 = `test/helpers/fake-node.js`，**复用通用 `NodeClient`**（与真实 CLI agent 同一协议实现，杜绝漂移）+ `onDeliver(msg)` 断言钩子（可记录/校验/延迟 ack 以证明 deliver 与 ack 分离），进程内运行；真实 CLI agent（子进程）同样**自动受理 deliver（传输应答 + ack accepted，无业务处理）**——两者协议行为结构一致；契约闭环主载体 = 双假节点，另设真实 agent 用例证明受理路径（§10.1/§6.4）。
