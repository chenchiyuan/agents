---
status: 已确认
version: 0.2.0
created: 2026-09-01
updated: 2026-09-02
---

# agents 项目提案

## 0. 文档状态

已确认。MVP 阶段 1/2 已完成，阶段 3/4 进行中，详见 `docs/mvp-plan.md`。

来源依据：`docs/iterations/0000-project-design/clarifications/` 目录下 4 个维度、共 8 条已确认结论（`mvp-scope`、`protocol-depth`、`subagent-collaboration`、`cross-project-reuse`）。本文档不引入新决策，只整理和结构化已确认的内容。

---

## 1. 背景

### 1.1 问题

用户需要一套**独立于具体产品域**的 agent 协作系统：定义清楚 agent 怎么设计、agent 怎么执行、主子 agent 怎么协作，并能沉淀经验持续迭代，还能被其他项目复用。

### 1.2 现有能力分析（可复用的部分）

从 `powerby-skills` 借鉴，但不迁移、不持续同步（`docs/iterations/0000-project-design/clarifications/cross-project-reuse/round-1.md` CLR-CR-002）：

| 可借鉴内容 | 来源 | 借鉴方式 |
|---|---|---|
| 造 agent 的元原则（七层结构、哲学式设计三支柱） | `docs/skill-design-protocol.md` | 提炼成 agents 项目自己的 `principles/meta/` |
| agent 自己执行时遵循的原则（零假设、小步提交、SOLID/DRY/KISS） | `docs/consitution.md` | 提炼成 `principles/execution/` |
| 具体角色定义范本 | `skills/pb-v1-*`（仅这一条线，不含老一代 `docs/powerby-*.md` 角色卡和通用五角色） | 改写为 agents 项目自己的 `roles/<role>/` 结构 |
| "规则系统 vs 原则系统"的教训 | `docs/pb-agent/pb-agent-design.md` | 直接作为元原则的证据：规则写太细会让 agent 查表而不是判断，原则要等真实案例验证后才稳定 |

不借鉴的部分：`pb-v1-*` 里针对产品研发生命周期的流程编排（discovery/designing/demo/...），这些是 powerby-skills 自己的产品域逻辑，agents 项目不碰。

---

## 2. 目标

做一套可持续迭代、可跨项目复用的 agent 协作框架，包含：

1. **原则沉淀**：分两层——造 agent 的元原则、agent 执行时遵循的执行原则
2. **agent 构造器**：基于已验证的原则和标准结构，生成新 agent
3. **标准结构与协议**：每个 agent 都有 harness loop（Thought-Action-Observation）能力，文档约定而非代码框架
4. **主子 agent 协作**：主 agent 管上下文、分派任务、验收；子 agent 干具体活。复用已有工具（Claude Code 的 Agent/Task 机制），不新建通信协议
5. **反思沉淀**：agent 和协议都支持从真实案例中反思、更新原则，在 agents 项目内迭代，之后可跨项目复用

## 3. 非目标（当前阶段不做）

- 不做产品研发生命周期的流程编排（那是 powerby-skills 的域，不是 agents 的域）
- 不做强制的可执行 schema / 代码框架来约束 harness loop——先用文档约定跑通
- 不做多个角色同时构造——先跑通一个真实角色，再抽象构造器
- 不做 agents 与 powerby-skills 的持续双向同步

---

## 4. 范围与启动顺序

五层能力都要做，但不同时启动（`docs/iterations/0000-project-design/clarifications/mvp-scope/round-1.md` CLR-MVP-001）：

```
第一步：跑通一个真实 agent
  ├─ 输入：从 pb-v1-implementing 改写（CLR-MVP-002）
  ├─ 产出：principles/execution/core-principles.md（执行原则真实生效）
  │        roles/dev/{dev.md, memory.md, data/}（标准结构真实生效）
  │        一次真实的主子 agent 派发闭环（用 Agent/Task 工具）
  └─ 验证：这一步跑完，原则和标准结构才算被验证过，不是猜的

第二步：从第一步的真实案例抽象 agent 构造器
第三步：反思沉淀机制——基于 roles/dev/data/ 里攒的真实案例定义触发条件
第四步：打包跨项目复用——github clone + 安装指令（CLR-CR-001）
```

---

## 5. 关键决策记录（引用澄清结论）

| 决策 | 结论摘要 | 来源 |
|---|---|---|
| 启动顺序 | 顺序启动，不同时铺开五层 | CLR-MVP-001 |
| 首个验证角色 | pb-v1-implementing（对应 developer 角色概念） | CLR-MVP-002 |
| harness loop 产物形态 | 文档约定，非强制代码框架 | CLR-PD-001 |
| 角色目录结构 | `roles/<role>/{<role>.md, memory.md, data/}` | CLR-PD-002 |
| 原则分层 | 元原则（设计 agent 用）+ 执行原则（agent 执行时用），不合并 | CLR-PD-003 |
| 原则存放层级 | 项目级共享（`principles/meta/`、`principles/execution/`）+ 角色级引用 | CLR-PD-004 |
| 主子协作机制 | 复用宿主 Agent/Task 调度，通过 ACP 调用本地 executor CLI，不自建通信层 | CLR-SC-001、CLR-MD-007 |
| 复用分发形式 | github clone + 安装指令 | CLR-CR-001 |
| 项目边界 | agents 与 powerby-skills 独立，一次性借鉴初始化 | CLR-CR-002 |
| 业务项目数据分层 | .pb-agents/ 框架 copy（`.pb-agents/config/` 为项目配置例外区）+ .pb-agents/project/（运行记录，镜像结构）+ docs/iterations/{编号-迭代名}/（迭代产物，每次迭代独立目录） | CLR-DS-001、CLR-MD-003 |
| copy 更新协议 | 框架 copy 单向可更新（agents→项目），copy 不可在业务项目直接修改；`.pb-agents/config/agent-routing.yaml` 由业务项目维护，安装升级不得覆盖 | CLR-DS-002、CLR-MD-003 |
| copy 包含范围 | roles/<role>.md + principles/（必须）；.claude/skills/ + tools/（可选）；data/ 和 memory.md 不 copy | CLR-DS-004 |

---

## 6. 成功标准

- 第一步完成后：`roles/dev/dev.md` 能被一个真实任务调用，产出代码+测试，且 `roles/dev/data/` 里有至少一条真实决策记录
- 原则文档（`principles/execution/core-principles.md`）里的每一条都能在这次真实案例中找到对应的判断依据，不是从 `consitution.md` 直接抄的空话
- 用户能用一句话描述"什么时候该往 `roles/dev/data/` 记一条案例，什么时候该更新 `principles/`"

---

## 7. 迭代记录

| 版本 | 日期 | 变更 |
|---|---|---|
| 0.1.0 | 2026-09-01 | 首次起草，整合 4 个维度 8 条澄清结论，待用户确认 |
| 0.2.0 | 2026-09-02 | 确认为已确认状态；移除 base.md 参考（已被实现取代）；阶段 1/2 已完成 |
