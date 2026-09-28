# G01 · 范围守卫（保证项）

**来源**：边界·不做 第 1~3 条；边界·做 第 1~4 条（三个角色文件 + demand changelog + workflow-pb SKILL.md）；D-17；执行方向"workflow-pb 与 prd 只做对接所需的最小同步"

**性质**：保证项卡，不引入新能力，用于让"不做什么"可被独立判红。

## 用户价值

这次改造只动 demand、它的两个直接对接角色和 workflow-pb 的 SKILL.md 入口，不会顺手牵动其它角色或外部 skill。

## 验收标准

1. **改动文件白名单**：迭代分支相对 main 在 `roles/` 与 `.claude/skills/` 下的改动文件集合 ⊆ { `roles/demand/demand.md`、`roles/demand/data/demand-changelog.md`、`roles/workflow-pb/workflow-pb.md`、`roles/prd/prd.md`、`.claude/skills/workflow-pb/SKILL.md` }，workflow-pb / prd 不另写 changelog（见 `architecture.md` §6） [边界·做 1~4；D-17；边界·不做 2]。
2. **不触碰 pb-v1-talk**：不存在对 pb-v1-talk skill 的任何修改 [边界·不做 1]。
3. **prd 之外的下游角色不变**：`roles/` 下除 demand / workflow-pb / prd 之外的角色目录无改动 [边界·不做 2]。
4. **本迭代不按新流程重走**：本迭代 `docs/iterations/0031-demand-convergence-redesign/demand.md` 不因新规则被重写或重新走阶段 1 [边界·不做 3]。

QA 判定方式：`git diff --name-only main...iteration/0031-demand-convergence-redesign -- roles/ .claude/skills/` 对照白名单；检查 0031 demand.md 未被改动。

## 边界（不包含）

- 不约束 `docs/iterations/0031-*/` 下的过程产物（prd、architecture、prs 等本就会新增）。
- 不约束 `roles/*/data/` 下的迭代决策记录（各角色按自身"决策记录"规则写入）[user_confirmed · D-18，见下]。

## 架构维度

无待填项。A-04 推荐方案 A（`architecture.md` §6；L1-4 用户已确认选 A）：**白名单不扩充**，维持验收 1 所列 5 个文件。

## model_inferred（已由 D-18 全部采纳，来源改为 user_confirmed）

- 边界第 2 条（允许各角色写 `data/` 决策记录）[user_confirmed · D-18]：demand 未提及；按各角色既有"决策记录"规则与 0029/0030 惯例推导，否则会与角色自身规则冲突。
