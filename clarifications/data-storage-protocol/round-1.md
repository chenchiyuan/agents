---
dimension: data-storage-protocol
round: 1
scope: "agents 框架数据在业务项目中的分层存储协议"
caller: pb-v1-talk
status: 生效
created: 2026-09-01
updated: 2026-09-01
---

# 数据分层存储协议 - Round 1

## 大原则确认

### 目标
确定 agents 框架文件和业务项目运行数据的物理隔离方式，以及两者之间的更新协议和贡献流程。

### 核心原则
**自己的数据自己管理**：数据归属先于目录结构。先确认"谁有权改这个文件"，再确定"它放哪"。

### 范围
- 包含：`.pb-agents/` 目录结构、copy 范围、更新协议、project-generated 数据组织、归档贡献触发
- 不包含：安装脚本的具体实现（留给执行阶段）、`docs/iterations/` 迭代产物的内部结构

---

## 讨论清单

### CLR-DS-001: 目录命名与三分法结构
- **模糊点**: `.pb-agents/` 内部如何区分 agents 框架文件和项目运行记录
- **影响范围**: 所有后续约定的基础
- **结论**:
  - `.pb-agents/`（根目录直接放 copy）— agents 框架文件，**只读**，不能在业务项目里直接修改
  - `.pb-agents/project/` — 业务项目运行时积累的角色记录，属于业务项目
  - `docs/iterations/{编号-迭代名}/` — 迭代产物（demand.md、prd/*.md、architecture.md、tasks.md、clarifications/ 等），每次迭代独立目录，例如 `docs/iterations/0001-user-auth/`；属于业务项目，不属于 agents 框架
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-DS-002: 更新协议（修订 CLR-CR-002）
- **模糊点**: CLR-CR-002 说"一次性借鉴，不持续同步"，但实际需要支持 agents 升级后业务项目更新 copy
- **影响范围**: CLR-CR-002 需要更新
- **结论**: 单向可更新协议 —
  - agents 是唯一权威来源（source of truth）
  - copy（`.pb-agents/`）不能在业务项目里直接修改
  - 需要修改角色定义或原则时，必须走 agents 项目的 PR 流程，agents 发布后再更新业务项目的 copy
  - agents 升级后，业务项目手动触发更新（重新安装 copy），`.pb-agents/project/` 不受影响
- **来源分类**: user_confirmed
- **状态**: 生效（覆盖 CLR-CR-002 中"一次性借鉴"的表述，更新为"单向可更新"）
- **确认时间**: 2026-09-01

### CLR-DS-003: project-generated 目录采用镜像结构
- **模糊点**: `.pb-agents/project/` 内部按角色名组织还是按数据类型组织
- **影响范围**: 归档回 agents 时是否需要额外映射
- **结论**: 镜像 agents 内部结构 —
  - `.pb-agents/project/roles/<role>/data/` 对应 agents 里的 `roles/<role>/data/`
  - `.pb-agents/project/roles/<role>/memory.md` 对应 agents 里的 `roles/<role>/memory.md`
  - 归档时直接 copy 到 agents PR，无需额外整理
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-DS-004: copy 包含的内容范围
- **模糊点**: agents 项目里的 roles/、principles/、tools/、.claude/skills/、docs/ 哪些需要 copy 到业务项目
- **影响范围**: 业务项目的 .pb-agents/ 体积和可用性
- **结论**:
  - **必须 copy**：`roles/<role>/<role>.md`（角色定义）、`principles/`（执行原则）
  - **可选 copy**：`.claude/skills/`（创建新角色时需要）、`tools/`（验证脚本）
  - **不 copy**：`roles/<role>/data/`（agents 项目自身的运行记录，不属于业务项目）、`roles/<role>/memory.md`（同上）、`docs/`（agents 项目文档）
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-DS-005: project-generated 数据归档回 agents 的触发条件
- **模糊点**: 什么时候、由谁判断 .pb-agents/project/ 里的记录值得贡献回 agents
- **影响范围**: retrospective 角色的职责范围
- **结论**: 方案C（双触发）—
  - **retrospective 角色主动识别**：每次迭代结束后扫描 `.pb-agents/project/` 里的新记录，判断是否达到跨角色升级标准（同类踩坑在 3+ 项目/角色中独立出现），产出建议，用户决定是否提 PR
  - **用户主动发起**：开发者可随时判断某条记录对其他项目有价值，手动开 PR，不依赖 retrospective 触发
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

---

## 冲突处理

CLR-DS-002 覆盖了 CLR-CR-002（cross-project-reuse/round-1.md）中"一次性借鉴"的表述。
旧结论：agents 与 powerby-skills 是独立项目，一次性借鉴初始化，非持续同步。
更新后：agents 是权威来源，业务项目的 copy 单向可更新（agents → 项目），copy 不能直接改，修改走 agents PR。
两者不矛盾的部分（"agents 与 powerby-skills 独立"）继续生效。
