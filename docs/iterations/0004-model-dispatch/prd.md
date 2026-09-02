# prd.md — 0004-model-dispatch

**版本**: 0.1.0  
**迭代**: 0004-model-dispatch  
**创建日期**: 2026-09-02  
**阶段**: 功能规格（Phase 2）  
**来源**: `demand.md`（0004-model-dispatch）

---

## 功能点索引

| ID | 功能名 | 用户价值摘要 | 规格卡 | model_inferred | 架构待填 |
|---|---|---|---|---|---|
| F01 | 默认派发目标与 role 作用域 | 让主/子 agent 默认目标可预测，并限制 role 路由只影响子 agent | [F01](prd/F01-default-target-scope.md) | — | 运行时默认值与作用域解析边界 |
| F02 | 项目路由配置与模型绑定 | 让业务项目独立维护路由，同时保护框架文件、运行记录和凭据边界 | [F02](prd/F02-project-routing-config.md) | — | 配置加载校验、安装升级保护、运行记录组织 |
| F03 | 路由解析优先级与字段继承 | 让单次显式覆盖可预测，并使未覆盖字段稳定继承 | [F03](prd/F03-routing-priority.md) | — | 分字段合并解析的实现和调用时机 |
| F04 | 启动前模型 fallback | 在同一 executor 内按明确顺序选可用模型，避免未审计的换 CLI 或重跑 | [F04](prd/F04-prestart-fallback.md) | — | 可用性报告接入、启动前解析时序 |
| F05 | 统一 ACP 派发请求与响应 | 让不同本地 CLI 复用统一派发语义并返回可判断的目标信息 | [F05](prd/F05-unified-acp-contract.md) | — | ACP 适配/传输、字段与 CLI 参数映射 |
| F06 | 结果状态与降级审计 | 区分完成、启动后失败和未启动阻断，并保留降级证据 | [F06](prd/F06-result-status-audit.md) | — | 结果归一化、记录传递/持久化/查询 |
| F07 | 凭据与主/子 agent 责任边界 | 复用本地工具认证环境而不扩大 agents 敏感信息责任，防止子 agent 越权 | [F07](prd/F07-credential-responsibility-boundary.md) | — | ACP 调用责任与凭据隔离、报告承载 |

**合计**：7 个功能点

---

## 需求结论追溯

| demand.md 章节 | 覆盖功能卡 | 覆盖内容 |
|---|---|---|
| §1 目标与价值 | F01–F07 | 可配置、可预测、可审计的模型/CLI 派发；保持 role 能力、凭据责任和主/子 agent 协作边界 |
| §2 派发目标与默认行为 | F01、F03 | `executor + model` 双维度；主/子 agent 默认 `omp + gpt`；role 路由仅对子 agent 生效；主 agent 仅显式改变自身目标 |
| §3 配置归属与模型绑定 | F02 | 固定路径、项目维护、安装升级保护、框架 copy/运行记录归属、独立模型绑定、默认值、非法配置快速失败、凭据禁入 |
| §4 路由解析范围与优先级 | F01、F03 | role 作用域；显式字段 > role 路由 > 子 agent 默认；按字段覆盖；主 agent 提供 role/brief 且不下放模型选择责任 |
| §5 启动前模型降级 | F04、F06、F07 | 同 executor 的有序模型链、链尾默认值、去重、不可用 executor 报告、全候选不可用不启动、仅启动前降级、启动后失败不静默重跑、可审计信息 |
| §6 统一 ACP 派发契约 | F05、F06 | 统一请求语义字段；响应状态、角色、requested/selected、fallback 与结果；`blocked`/`failed` 语义区分；不绑定 CLI 参数映射 |
| §7 凭据与职责边界 | F05、F07 | 通过 ACP 调用本地 CLI；provider/endpoint/API key/登录态由本地工具或宿主负责；agents 和子 agent 的责任边界 |
| §8 本迭代包含与不包含 | F01–F07 | 仅覆盖默认、路由、fallback、ACP 语义、结果状态和职责边界；各卡“边界”章节逐项排除技术实现及合同明确不包含项 |
| §9 预期效果与交接标准 | F01–F07 | 默认目标、作用域、优先级、配置错误、fallback 时机/链尾、阻断、ACP 字段、审计、凭据和启动后失败行为均有独立卡片 |

---

## 本次迭代边界说明

### 包含

- 将默认目标、独立 `executor/model` 维度、role 路由作用域、显式优先级和启动前 fallback 规则收敛为可验证的派发行为。
- 让主 agent 使用统一 ACP 语义派发子 agent，并获得包含实际目标与降级信息的结果。
- 固化 `.pb-agents/config/agent-routing.yaml` 的项目配置归属及凭据禁入边界。
- 保持 `completed`、`failed`、`blocked` 的结果语义可区分。

### 不包含

- 配置加载器、ACP adapter、CLI 调用器的具体技术实现或选型。
- `omp`、`codex`、`codebuddy` 的 CLI 内部参数映射、provider 实现、endpoint/API key/登录态及凭据管理。
- CLI 内部会话管理、重试、任务执行逻辑，或子 agent 启动后的自动换模型重跑。
- role 文件的能力定义重写或模型绑定。
- agents 自建通信服务或其他无关协作协议重构。
- 超出需求合同所述模型派发、路由、fallback、ACP 语义和职责边界的新增功能。

---

## model_inferred 列表（需主 agent 确认）

无。本需求合同 §1–§9 的结论均标记为 `user_confirmed`，本阶段未新增产品推断。

---

## 架构待填列表（技术架构阶段处理）

以下只记录实现方式留白，不对下游做技术选型：

| 编号 | 来源功能卡 | 架构待填内容 |
|---|---|---|
| AR-01 | F01 | 默认目标和 role 作用域在运行时的解析组件及调用边界 |
| AR-02 | F02 | `agent-routing.yaml` 的加载、语法/字段校验和具体错误报告方式；配置解析库留待架构阶段决定 |
| AR-03 | F02 | 安装/升级保护项目配置的机制；路由配置与 `.pb-agents/project/` 运行记录的落地组织方式 |
| AR-04 | F03 | 按字段合并显式请求、role 路由和默认值的解析实现及调用时机 |
| AR-05 | F04 | executor/ACP 可用性报告的接入方式；启动前模型解析与 ACP 派发的边界及时序 |
| AR-06 | F05 | ACP adapter、传输方式、协议版本承载，以及统一字段到各 CLI 参数的映射方式 |
| AR-07 | F06 | `completed/failed/blocked` 的结果归一化；结果和降级信息的记录、传递、持久化及查询方式 |
| AR-08 | F07 | agents 与本地 CLI 的调用责任和凭据隔离方式；子 agent 实际目标与边界问题在报告中的承载方式 |

---

## 疑问与越界

无。未发现 `demand.md` 内部矛盾或待用户确认项；所有技术实现、CLI 参数映射、配置解析库、ACP 传输细节和 provider 细节均保留为 `[架构待填]`。
