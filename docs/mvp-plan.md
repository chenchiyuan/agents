---
status: 待确认
version: 0.1.0
created: 2026-09-01
updated: 2026-09-01
depends_on: docs/proposal.md
---

# MVP 计划

## 0. 文档状态

草稿，等待第一次确认。依据 `docs/proposal.md` 第 4 节的启动顺序拆解为可执行阶段。本文档只拆步骤，不做新决策；如执行中发现需要新决策，先回到 `pb-v1-talk` 或 `pb-v1-clarify` 澄清，再回填本文档。

---

## 阶段 1：跑通第一个真实 agent（roles/dev）

**目标**：把 `pb-v1-implementing` 改写为 agents 项目自己的 `dev` 角色，产出真实可用的角色文件 + 执行原则文档，并用一次真实任务跑通闭环。

**验收标准**：
- `principles/execution/core-principles.md` 存在，内容来自 `consitution.md` 提炼（零假设、小步提交、SOLID/DRY/KISS 等），且每条都标注适用场景
- `roles/dev/dev.md` 存在，定义角色身份、边界、harness loop 工作方式，引用 `principles/execution/core-principles.md`
- `roles/dev/memory.md` 存在（初始为空模板即可）
- `roles/dev/data/` 目录存在，且在跑通一次真实任务后，至少有 1 条决策记录
- 用主 agent（当前会话）通过 Claude Code 的 Agent/Task 工具，把一个真实小任务派发给按 `dev.md` 定义行事的子 agent，产出代码+验证结果，主 agent 完成验收

**测试/验证方法**：
- 派发一个范围明确的真实小任务（不是玩具任务），检查子 agent 产出是否符合 `dev.md` 定义的边界（不写测试用例、不做架构决策等）
- 检查 `roles/dev/data/` 是否记录了这次任务中"哪条原则被验证、哪条原则不够用"

**状态**: 未开始

---

## 阶段 2：从真实案例抽象 agent 构造机制

**目标**：基于阶段 1 跑出来的真实 `roles/dev/` 结构，把"创建一个新角色"这件事本身沉淀为可复用、可验证的机制。

**验收标准**：
- 创建机制的输入输出基于阶段 1 的真实产出反推，不是凭空设计
- 创建判断类内容（identity/character/Strategy/能力边界）必须来自 AI 反射推理并经用户确认，禁止占位符模板填空
- 创建与验证职责分离——创建者不能自证完成，必须有独立验证环节
- 实际创建第二个真实角色，走完整 Plan→Execute→Verify→Fix→Reflect 闭环，验证机制可用

**测试/验证方法**：用第二个真实角色实际派发一次真实任务，检验产出是否符合角色边界；同时检验 `verify-role` 是否能独立发现问题（不依赖创建者自报）

**状态**: 机制已确立为 `.claude/skills/create-role/` + `.claude/skills/verify-role/` 两个 skill（详见 `plans/0002-2026-09-01-agent-constructor/task_plan.md`）。此前尝试过脚本驱动（`tools/new-role.sh` + 占位符模板）两版，均被判定"填空不是思考"而推翻，已删除。尚未用新机制实际跑通一个真实角色的完整闭环。

---

## 阶段 3：反思沉淀机制

**目标**：定义"什么时候该往 `roles/<role>/data/` 记一条案例，什么时候该回头更新 `principles/`"的判断标准和触发条件。

**验收标准**：
- 有明确的记录时机（对应 `base.md` 里 constraints/pitfalls 的判断标准：违反后果是否严重、是否反直觉、是否跨多处必须同步）
- 有明确的"台账防腐"机制——原则更新后，旧结论的痕迹要保留，不能直接抹掉

**测试/验证方法**：用阶段 1、2 积累的真实案例，检验判断标准是否能正确分类（哪些该进 data/，哪些该升级为 principles/ 变更）

**状态**: 未开始

---

## 阶段 4：跨项目复用打包

**目标**：把 `principles/`、`roles/` 等核心文件打包成可安装单元，提供 github clone 后的安装指令。

**验收标准**：
- 有一条命令或脚本，能把 agents 项目的核心文件安装到任意目标项目的指定位置
- 在至少一个其他项目里验证安装后可用

**测试/验证方法**：在一个真实的其他项目里跑一次安装流程，确认核心文件到位且可被该项目的 agent 读取

**状态**: 未开始

---

## 迭代记录

| 版本 | 日期 | 变更 |
|---|---|---|
| 0.1.0 | 2026-09-01 | 首次起草，4 个阶段对应 proposal.md 第 4 节的启动顺序，待用户确认 |
