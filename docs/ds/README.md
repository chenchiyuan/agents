# 多 OMP 实例与 Agent 间通信协议 —— 设计规格包（docs/ds）

**状态**：方案建议，待实现阶段确认
**版本**：0.2.0
**日期**：2026-09-09
**演进自**：`docs/multi-omp-agent-protocol.md`（v0.1.0 单文件草案，保留未动，本目录为其正式化与调研补全）

## 本方案包回答什么

在现有 `model-dispatch-protocol`（一次一发的子 agent 派发）之上，新增两个能力：

1. **多常驻实例**：同时运行多个 OMP 实例，每个实例独立指定 provider/model（deepseek、gpt……）与初始化提示词（persona/规则，类似 AGENTS.md）；
2. **实例间通信**：agent 之间按标准协议消息投递、Ack 保活、任意路由。

本包给出协议选型调研（研究结论）、总体架构、OAMP 协议规格、实例配置与初始化集成、风险与实施路线。

## 调研结论（30 秒版）

**没有单一的"agent 邮箱协议"标准，正确做法是分层组合，而不是选一个协议通吃：**

| 层 | 职责 | 采用 | 理由（详见 02） |
|---|---|---|---|
| 应用语义层 | agent 协作语义：AgentCard/能力、Message/Part、Task 状态机 | **对齐 A2A v1.0**（2026-03 发布，Linux Foundation 治理，AWS/Cisco/Google/IBM/Microsoft/Salesforce/SAP/ServiceNow 背书） | 目前唯一被大厂联盟背书的 agent↔agent 标准；本方案只借其语义词汇，不声明完整实现 |
| 消息/生命周期层 | 注册、心跳租约、Ack、投递状态、路由 | **OAMP/1**（自研受限集，本包定义） | A2A 无心跳/租约/本地队列/任意路由语义；这些是本需求特有的 supervisor 职责 |
| 传输层 | 字节搬运与请求-响应外层 | **JSON-RPC 2.0 over Unix Domain Socket**（本机默认） | 零新依赖、可审计、可替换；跨机器时换 HTTP(S)/gRPC/NATS 适配器，信封不变 |

Ack 与心跳**严格分离**：`message.ack` 证明某条消息被某 session 接收；`agent.heartbeat` 证明某 session 在租约内在线。两者不混用（04 §6）。

## 文档索引

| 文件 | 内容 | 关键决策 |
|---|---|---|
| [01-需求与边界.md](01-需求与边界.md) | 需求条目化、术语表、非目标 | R-01~R-06 需求编号 |
| [02-协议选型调研.md](02-协议选型调研.md) | **调研正文**：A2A/MCP/ACP/AGNTCY/first-tree 语义层，NATS/Redis/AMQP/自研 传输层 | DS-01~DS-08 决策 |
| [03-总体架构与生命周期.md](03-总体架构与生命周期.md) | 拓扑、组件职责、状态机、时序、持久化、可观测、安全边界 | 星型 Router，agent 不直连 |
| [04-OAMP协议规格.md](04-OAMP协议规格.md) | OAMP/1 规范：RPC 方法、消息信封、Ack/心跳、路由寻址、幂等、错误码、版本协商、A2A 映射 | 方法名 `agent.*` / `message.*` / `control.*` |
| [05-实例配置与初始化集成.md](05-实例配置与初始化集成.md) | omp-instances.yaml、初始化提示词层级、与 model-dispatch-protocol/ACP 契约关系 | prompt 启动时固定 + `prompt_hash` |
| [06-风险未决与实施路线.md](06-风险未决与实施路线.md) | 未决事项、MVP 范围、验收矩阵、实施顺序 | 先 UDS 后跨机，不提前引中间件 |

## 决策摘要

| ID | 决策 | 一句话理由 |
|---|---|---|
| DS-01 | 分层组合：A2A v1.0 语义对齐 + OAMP 消息层 + JSON-RPC 2.0/UDS 传输 | agent 通信无单一标准；语义层跟业界标准走，投递层按本需求最小自研 |
| DS-02 | 本机传输用 UDS，不用 WebSocket/gRPC/外部消息队列 | 本机进程间通信不需要 TLS/HTTP 开销；boring 且可逆 |
| DS-03 | 星型 Router（registry+route+relay），agent 之间不直连暴露端口 | 发现/重试/安全只实现一份（借鉴 first-tree daemon、omp hub 先例） |
| DS-04 | 语义对齐 A2A 但 OAMP 不声明"是 A2A 实现" | A2A 无心跳/本地路由语义；避免背上完整 v1 合规成本 |
| DS-05 | `instance_id` 稳定 + `session_id` 每次启动变化 + `prompt_hash` 固定初始化规则 | 消息寻址用稳定身份，存活判断用 session，规则不可被消息静默覆盖 |
| DS-06 | at-least-once 投递 + `message_id` 幂等去重 + 有限重试 | 不做伪 exactly-once；接收端幂等吸收重投 |
| DS-07 | 寻址三种：`agent_id` 点对点 / `topic` 广播 / `selector` 白名单广播；RPC 用 `correlation_id`+`reply_to` | 任意路由 = 显式目标可达，不是把自然语言当路由 |
| DS-08 | 凭据不进配置/消息/日志/Router；身份靠本地启动凭证，跨机走 TLS+身份 | 复用 model-dispatch-protocol 的凭据边界，Router 不碰 secret |

## 与既有体系的关系

- **复用**：`model-dispatch-protocol` 的 `executor/provider/model` 解析、fallback、`requested/selected` 审计；项目内 **ACP 派发契约**（`protocol: acp`）作为一次派发的语义；role 文件与 `agent-routing.yaml`。
- **新增**：运行实例层（`omp-instances.yaml` + prompts）+ 消息层（OAMP Router）。role 文件语义、凭据边界、主子 agent 协作边界均不变。
- **名词澄清**：项目内 "ACP" 指 `model-dispatch-protocol` 定义的统一派发契约；与外部 Cisco ACP（已归档）或 Zed ACP（IDE↔coding agent）无关，同名不同物（见 02 §4）。

## 术语速查

| 词 | 含义 |
|---|---|
| OMP 实例 | 一个独立进程/会话的 agent 运行时，有独立 provider/model/初始化规则/工作目录 |
| OAMP | OMP Agent Messaging Protocol，本包定义的 agent 消息协议 v1 |
| Router（ompd） | 本机守护进程：注册表 + 路由 + 投递 + 生命周期；不持有凭据 |
| Agent Card | A2A 概念：agent 能力/端点的 JSON 元数据（OAMP 注册信息的语义参照） |
| prompt_profile | 实例启动时注入的初始化提示词文件（persona/规则，类似 AGENTS.md） |
