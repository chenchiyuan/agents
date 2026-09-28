# F13 · workflow-pb SKILL.md 推进条件示例同步

**来源**：D-17（`.claude/skills/workflow-pb/SKILL.md:130` 的"demand.md 两段均非空"示例同步为新推进条件口径，纳入本次）；边界·做 第 4 条；原 prd.md 疑问 Q-1（已由 D-17 关闭）

## 用户价值

主 agent 通过 `/workflow-pb` 加载的调度说明里，阶段 1 推进条件的示例和 workflow-pb.md 口径一致，不会按旧的"两段均非空"放行。

## 验收标准

1. **示例同步**：`.claude/skills/workflow-pb/SKILL.md` 中"推进条件核查 = 读文件内容"一条（现 :130）的示例不再是"demand.md 两段均非空"，改为与 F10 验收 2 一致的口径——五项齐全 + 用户明确确认整份 demand.md [D-17；边界·做 4]。
2. **与 workflow-pb.md 一致**：该示例与 `roles/workflow-pb/workflow-pb.md` 阶段 1 推进条件表述不矛盾 [D-17 "同步为新推进条件口径"]。
3. **最小同步**：该文件 diff 仅限这一处示例；第 5 条主句（"推进条件核查 = 读文件内容……逐项确认内容满足条件"）及其它条目不变 [边界·做 4 "同步……示例"；执行方向"最小同步"]。

QA 判定方式：`git diff` 该文件，确认只改动该示例；检索全文不再出现"两段均非空"。

## 边界（不包含）

- 不改 SKILL.md 的 description（其中版本号与流程概述不在 D-17 范围）。
- 不改其它 skill 文件。

## 架构维度

**A-05（已填定，详见 `architecture.md` §7）**：`（如 demand.md 两段均非空）` → `（如 demand.md 五项齐全，且头部状态行记有用户对整份文档的明确确认）`；该文件其它内容（含版本行与 description）不改。

## model_inferred

无。
