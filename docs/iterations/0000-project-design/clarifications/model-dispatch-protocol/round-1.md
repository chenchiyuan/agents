---
dimension: model-dispatch-protocol
round: 1
scope: "主 agent 与子 agent 的本地 CLI、模型路由和 ACP 派发边界"
caller: pb-v1-talk
status: 生效
created: 2026-09-02
updated: 2026-09-02
---

# 模型派发协议 - Round 1

## 大原则确认

### 目标

确定主 agent、子 agent、role、本地 CLI 和模型之间的配置关系，并在实现前锁定统一 ACP 派发契约。

### 范围

- 包含：默认 executor/model、项目级路由配置、role 覆盖、fallback、ACP 调用边界、凭据归属
- 不包含：具体 CLI 的内部参数、provider 实现、凭据管理、运行时适配器实现

---

## 讨论清单

### CLR-MD-001: 默认派发目标

- **模糊点**：默认配置是否只指定 CLI，还是同时指定 CLI 和模型
- **影响范围**：主 agent、子 agent 的所有默认派发
- **结论**：主 agent 和子 agent 的默认目标均为 `omp + gpt`
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-002: executor 与 model 分层

- **模糊点**：`omp`、`codex`、`codebuddy` 与 `gpt`、`deepseek`、`minimax-k3` 是否处于同一配置层
- **影响范围**：协议可扩展性和 CLI 解耦
- **结论**：分为两个维度：`executor` 表示本地 CLI，`model` 表示 CLI 使用的模型。`omp + gpt` 是完整派发目标，而不是单一标识
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-003: 配置路径与所有权

- **模糊点**：项目级路由配置放在何处，以及是否属于 agents 框架 copy
- **影响范围**：安装、升级、版本管理和配置丢失风险
- **结论**：配置固定放在 `.pb-agents/config/agent-routing.yaml`。`.pb-agents/config/` 是项目可写配置例外区；框架安装/升级不得覆盖或删除该文件。`.pb-agents/roles/`、`.pb-agents/principles/` 等框架 copy 仍保持只读；`.pb-agents/project/` 继续存运行记录
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-004: 模型绑定位置

- **模糊点**：模型选择写入 role 文件，还是写入独立配置
- **影响范围**：角色可移植性和业务项目的模型替换
- **结论**：使用独立路由配置。role 文件只描述能力，不绑定部署模型
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-005: role 路由作用域

- **模糊点**：role 配置是否自动改变主 agent 的模型
- **影响范围**：人工调度边界和主 agent 可预测性
- **结论**：role 路由只对子 agent 生效。主 agent 由人工管理，默认保持 `omp + gpt`；主 agent 改变自身目标时必须显式指定
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-006: fallback 规则

- **模糊点**：目标模型不可用时是否自动降级，以及降级发生在什么时候
- **影响范围**：任务连续性、结果可解释性和故障排查
- **结论**：采用显式 fallback 链，仅在任务启动前解析模型时降级。设计为 `minimax-k3 → deepseek → gpt`；链尾回到默认 `omp + gpt`。子 agent 启动后的执行失败不得静默切换模型重跑
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-007: 凭据边界与 ACP

- **模糊点**：agents 是否管理 provider、endpoint 和 API key
- **影响范围**：安全边界、CLI 复用和协议复杂度
- **结论**：agents 只通过 ACP 调用本地 CLI，例如 `omp`、`codex`、`codebuddy`；不管理 provider 或凭据。不同 CLI 通过统一语义派发契约接入，CLI 内部参数和认证由各自工具负责
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

### CLR-MD-008: 统一 ACP 派发契约

- **模糊点**：每个 CLI 是否需要独立的 agents 路由协议
- **影响范围**：主 agent 调度逻辑与后续 executor 扩展
- **结论**：采用统一契约，至少表达 `role`、`executor`、`model`、`fallback`、`brief` 和 `working_directory`；CLI 参数映射留在 ACP/CLI 适配端
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-02

---

## 协议产物

已根据本轮结论落盘：

```text
principles/execution/model-dispatch-protocol.md
```

该文档包含配置格式、解析优先级、降级审计字段、ACP 请求/响应契约和实现验证标准。

---

## 冲突处理

### 与 `subagent-collaboration/round-1.md` 的关系

旧结论 `CLR-SC-001` 中“agents 项目不需要重新设计通信协议”仍然有效，具体表现为：agents 不自建通信服务、不实现 provider 通信层。

旧结论中“仅使用 MCP/Claude Code Agent 和 Task 工具、不设计 ACP 调用协议”的部分由本轮 `CLR-MD-007`、`CLR-MD-008` 覆盖。当前有效表述为：**复用宿主的 Agent/Task 调度能力，并通过 ACP 调用本地 executor CLI；不自建通信层**。

### 与 `data-storage-protocol/round-1.md` 的关系

本轮 `CLR-MD-003` 对 `CLR-DS-001` 做局部修订：`.pb-agents/` 的框架 copy 仍只读，但新增 `.pb-agents/config/` 项目可写配置例外区。`.pb-agents/project/` 的运行记录归属不变。

---

## 待实现边界

本轮只锁定协议和配置归属，不实现：

- 配置加载器
- ACP executor 适配器
- `omp`、`codex`、`codebuddy` 的 CLI 参数映射
- provider 或凭据管理
- role 文件内容改写
