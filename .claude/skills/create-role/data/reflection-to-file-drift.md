# 案例：反射阶段确认的设计意图，落盘时出现字面偏离

**记录日期**: 2026-09-02
**来源**：pr-planner + progress-observer 创建过程，原记录于 `roles/retrospective/data/retro-2026-09-02-workflow-pb-v2.md`（2026-09-02 归属重整时移入本文件，理由见 `roles/retrospective/data/retrospective-changelog.md` v0.3.0）

## 现象

pr-planner 和 progress-observer 两个角色的反射依据文档（`data/*-reflection.md`）都明确写清楚了设计意图——pr-planner 明确了和 commit-planner 的边界应该在正文体现；progress-observer 明确了"角色文件不描述触发时机，交给 workflow-pb.md 定义"。但两次落盘的正文/frontmatter 都出现了和自己刚确认的意图不一致的地方：

- pr-planner 的 commit-planner 边界一开始只写在 description，没落进正文"不做什么"清单
- progress-observer 的 description 里还是写了一句触发时机描述，与自己的反射依据文档直接矛盾

## 根因

这不是"没想清楚设计意图"，是"想清楚了但落盘时没有机械核对字面是否和反射展示内容、以及已确认的跨文件契约严格一致"。反射推理和落盘写入是两个独立动作，中间缺一步"逐字核对"。

## 现有覆盖

`principles/meta/agent-design-protocol.md`"闭环边界"章节已经要求 Verify 必须独立于 Execute，本次两处偏离都是被独立验证子 agent 发现的，说明协议本身有效——问题不在于缺流程，在于流程执行中落盘环节缺一个自检步骤。

## 经验总结（候选原则，暂未升级）

角色文件落盘后，先逐条对照反射展示内容和已确认的跨文件边界做一次字面核对（不是重新推理，是字面比对），再进入独立验证，减少"靠独立验证兜底发现本可以自查出的偏差"。

三问：①三个月后成立？✓ ②换场景适用？✓ ③一句话可执行？✓ ——暂不升级为 create-role 正文步骤，因为这是"闭环边界"已有原则下的执行细节收紧，不是新增原则维度；等类似偏差在未来创建过程中再次出现，再考虑升级。
