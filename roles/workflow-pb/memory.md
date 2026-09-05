---
name: workflow-pb memory
description: workflow-pb 角色的精选索引。指向 data/ 下每条记录的一句话摘要。
---

# workflow-pb memory

- **v0.4.0（2026-09-05）**：补全阶段5并发调度协议的可执行细节——并发槛位算法（爬升公式+硬上限公式）、status.md并发配置初始化字段、PR实现子状态表新增槛位状态列和失败/阻塞现场保留取值、progress-observer新增worktree/分支存在性核实项。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.3.0（2026-09-03）**：阶段回退从"发现需求问题就回退修正"改为"是否改demand.md结论"的统一判断标准；需求问题由执行角色直接搭置进 `deferred-demand-changes.md`，不回退不暂停，本迭代按现有需求还原到底，变更留给新迭代。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.2.0（2026-09-02）**：并入 workflow-scm，阶段从 7 减到 6，废除全局 tasks.md 环节，新增依赖解锁式并发调度。根因和决策过程见 `data/workflow-pb-changelog.md`。
- [创建反射依据](data/workflow-pb-creation-reflection.md) — 为什么是"交付流程顾问"身份、工作流/角色的分离点是"谁定义契约"
- [两层工作流握手 + brief 传递规则](data/workflow-handshake-and-brief-passing.md) — 跨协议衔接点找自然接缝，迭代特定规则走 brief 不改角色文件
- [status.md状态协议缺口 + 阶段出口案例](data/status-protocol-and-phase-exit-gaps.md) — 主agent验收与独立验证证据要分字段区分；规划阶段结束前先确认产物形成可恢复git快照

