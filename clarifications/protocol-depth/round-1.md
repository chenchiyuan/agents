---
dimension: protocol-depth
round: 1
scope: "agents 项目：harness loop 标准结构的规范深度，以及原则的分层来源"
caller: pb-v1-talk
status: 生效
created: 2026-09-01
updated: 2026-09-01
---

# 协议规范深度 - Round 1

## 大原则确认

### 目标
确定 harness loop（Thought-Action-Observation）标准结构的产物形态，以及原则应该分几层、每层内容来自哪里。

### 范围
- 包含：标准结构的产物形态（文档约定 vs 代码框架）、角色目录结构、原则的两层划分
- 不包含：具体某个角色 dev.md 的完整内容（留给执行阶段）

---

## 讨论清单

### CLR-PD-001: harness loop 做成代码框架还是文档约定
- **模糊点**：标准结构可以是强制的可执行 schema，也可以是纯文档约定
- **影响范围**：agent 构造器的产出物类型
- **推荐选项**：文档约束，按 skill 标准定义 markdown，带角色专属目录（如 dev/ 下 dev.md + memory.md + data/）
- **结论**：确认为文档约定，结构需要持续优化，不做成强制代码框架
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-PD-002: 角色目录结构范本
- **模糊点**：每个角色目录下具体放哪些文件
- **影响范围**：agent 构造器生成的文件骨架
- **推荐选项**：`roles/<role>/{<role>.md, memory.md, data/}` —— data/ 存项目中沉淀的决策记录案例，用于更新原则
- **结论**：确认此结构
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-PD-003: 原则的分层来源
- **模糊点**：powerby-skills 里"原则"分散在三份文档（consitution.md 执行哲学 / skill-design-protocol.md 设计元协议 / powerby-foundation 继承机制），粒度不同，agents 项目该落哪一层
- **影响范围**：agents 项目 principles/ 目录的内容边界
- **推荐选项**：分两层，不合并——元原则（造 agent 的原则）与执行原则（agent 自己遵循的原则）分开存放
- **结论**：
  1. **元原则**：来自 skill-design-protocol.md 的七层结构 + 哲学式设计三支柱，用于指导后续设计新 agent，agent 执行时不读它
  2. **执行原则**：来自 consitution.md 的零假设、小步提交、SOLID/DRY/KISS 等，agent 执行时直接读它
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-PD-004: 原则的存放层级
- **模糊点**：元原则和执行原则在 agents 项目里的物理位置关系——项目级共享还是完全下沉到角色内部
- **影响范围**：目录结构设计，决定后续角色新增时是否需要重复内容
- **推荐选项**：项目级共享 + 角色级引用——`principles/meta/` 和 `principles/execution/` 放项目根目录，所有角色共享；角色目录下的 `<role>.md` 引用 execution 层原则 + 角色专属细则
- **结论（原为，已于 2026-09-01 推翻）**：目录结构本身仍成立（`principles/meta/` + `principles/execution/` + `roles/<role>/`），但"角色引用 execution 层原则"这一点已被推翻。原结论：
  ```
  agents/
  ├── principles/
  │   ├── meta/           # 造 agent 的原则，七层结构+三支柱
  │   │   └── agent-design-protocol.md
  │   └── execution/      # 具体 agent 执行时的通用原则基线
  │       └── core-principles.md   # 零假设/小步提交/SOLID 等
  ├── roles/
  │   └── dev/
  │       ├── dev.md      # 角色定义，引用 execution 原则 + 角色专属细则
  │       ├── memory.md
  │       └── data/
  ```
- **修订结论（2026-09-01）**：`principles/execution/core-principles.md` 降级为"起草库"，不再被角色运行时引用。新建角色时把相关条目**整段复制**进 `<role>.md` 自己的「原则」章节，写入后归角色自己所有、独立演化。原因：角色的原则是最重要且需要持续迭代升级的部分，`$ref` 式引用会让原则冻结在共享文件里、无法针对单个角色的真实案例演化。详见 `principles/meta/agent-design-protocol.md` v0.3.0「原则内联，不引用」章节。
- **来源分类**: user_confirmed
- **状态**: 修订生效（原引用式结论已推翻，见修订结论）
- **确认时间**: 2026-09-01（原始）/ 2026-09-01（修订）

---

## 冲突处理

无
