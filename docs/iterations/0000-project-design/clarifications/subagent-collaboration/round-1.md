---
dimension: subagent-collaboration
round: 1
scope: "agents 项目：主子 agent 协作机制与已有工具/协议的关系"
caller: pb-v1-talk
status: 生效
created: 2026-09-01
updated: 2026-09-01
---

# 主子 agent 协作机制 - Round 1

## 大原则确认

### 目标
明确"ACP 通信"与 Claude Code 现有 Agent/Task 子代理机制、以及 powerby-skills 的 dispatch-protocol / pb-agent-supervisor 协议之间的关系。

### 范围
- 包含：主子 agent 唤起机制的归属
- 不包含：具体派发协议文档的内容设计（留给执行阶段）

---

## 讨论清单

### CLR-SC-001: 主子 agent 唤起机制用什么
- **模糊点**：用户最初提到"使用 ACP 通信与子 agent 协作"，需要明确这是新协议还是复用已有工具
- **影响范围**：agents 项目是否需要自建通信层
- **推荐选项**：复用已有工具能力，不新建协议层
- **结论**：使用已有协议，用户当前使用的工具（MCP/Claude Code 的 Agent 和 Task 工具）本身已提供子 agent 唤起机制，agent 和 task 的唤起是工具插件层面提供的能力，agents 项目不需要重新设计通信协议
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

---

## 冲突处理

无
