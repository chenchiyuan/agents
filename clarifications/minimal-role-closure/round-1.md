---
dimension: minimal-role-closure
round: 1
scope: "agents 框架最小 role 闭环设计（6个角色）"
caller: pb-v1-talk
status: 生效
created: 2026-09-01
updated: 2026-09-01
---

# minimal-role-closure - Round 1

## 大原则确认

### 目标
确认 agents 框架的最小 role 闭环：6个角色的职责边界、产出物契约、与已有角色的关系，以及主 agent 在闭环中的定位。

### 范围
- 包含：需求助理、prd、architect、planner、backend、verifier 6个角色的设计约定
- 不包含：前端角色、设计系统角色、流程编排角色（orchestrator）、独立审查角色（reviewer）

---

## 讨论清单

### CLR-ROLE-001: backend 与已有 dev 角色的关系
- **模糊点**: 用户说的第5个 role `backend` 和已有的 `roles/dev/dev.md` 高度重叠，是否重建？
- **影响范围**: 是否需要删除或修改现有 dev 角色
- **结论**: `backend` = `dev` 重命名，保留现有 dev 的全部设计，只改角色名。不重建，不修改边界定义。
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-ROLE-002: 需求助理的产出结构与边界定位
- **模糊点**: `demand.md` 对应 pb-v1 的 `design-brief.md`（探索阶段）还是 `proposal.md`（需求合同），还是两者合并？
- **影响范围**: 需求助理的职责深度，以及 prd 角色的输入深度
- **结论**: 两段结构 —
  - **第一段：澄清记录**（结论的依据）——沟通过程中的澄清内容，是结论的证据基础
  - **第二段：需求结论**（proposal.md 级别）——含最小边界定义（做什么/不做什么/大概怎么做/为什么/达到什么效果）
  - 边界即上下文，控制边界是需求助理的核心职责。需求助理完成 office-hours + discovery 两阶段的全部职责。
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-ROLE-003: reviewer 角色缺席与质量门分工
- **模糊点**: pb-v1 有独立的 reviewer 做产物链对齐审查，这里没有，职责去哪了？
- **影响范围**: 各阶段产物的质量保证机制
- **结论**:
  - 无独立 reviewer 角色
  - 每个 role 自建 harness 闭环，对自己的产出负责（P-E-V-F-R 完整走一遍）
  - 主 agent 核心职责是：分配任务 + 公正独立验证。主 agent 在每个 role 交付后执行对齐检查，是 role 间的质量门
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-ROLE-004: PRD 产出的文件结构
- **模糊点**: prd.md 是单文件还是多文件？功能点如何组织？
- **影响范围**: architect 和 planner 消费 PRD 的粒度和精度
- **结论**: 二级结构 —
  - `prd.md`：报告级索引，包含功能列表摘要、边界说明、版本信息
  - `prd/*.md`：每个功能点一个独立文件，包含功能明细
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

### CLR-ROLE-005: verifier 的触发方式与验证对象
- **模糊点**: verifier 验证的是代码实现，还是整条产物链？是固定触发还是按需触发？
- **影响范围**: verifier 的职责边界和与主 agent 的协作方式
- **结论**:
  - 由主 agent 委托触发，不固定绑定某个 role 的产出
  - 反射出最适合验证当前产出物的验证者身份
  - 做第三方独立验证（不接收执行过程上下文，独立性来自对执行过程的无知）
  - 验证对象由委托方（主 agent）指定
  - 结果必须记录（写入 verifier 的 data/）
- **来源分类**: user_confirmed
- **状态**: 生效
- **确认时间**: 2026-09-01

---

## 冲突处理

无
