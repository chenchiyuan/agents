# SKILL.md v1.9.0 优化记录（对应规范 workflow-pb v0.6.0）

**触发**：用户报告 demand 角色实际执行时六维诊断记录、来源标注、方案雏形逐条询问等机械项被跳过（虽然语感贴近角色定义）。诊断根因：原「§ Brief 构建规则」只传递角色文件路径，子 agent 是否认真读取并严格执行取决于自觉性，机械性契约在这种模式下遵循度不稳定。

**用户提出的方向**：定义的 role 也要有对应的 skill，派发任务等价于给 agent 派发指定 skill 执行，skill 是 agent 标准协议，遵循度会更好。

**澄清过程中纠正的误解**：
- 最初理解为"role 和 skill 是两份文件需要双轨同步"或"角色定义要迁移到 `.claude/skills/<role>/` 目录"——均被用户纠正
- 正确理解：role 文件本身就是 skill 定义，是同一份产物；"skill" 是协议概念（agent 的标准协议单元），不是 Claude Code 的 `.claude/skills/` 文件系统机制
- 框架必须继续保持宿主无关，这次改动不能让 workflow-pb 变成 Claude Code 专属机制

**具体改动**：
- 「§ Brief 构建规则」新增"role = skill"协议等价性说明，引用 `principles/meta/agent-design-protocol.md` 对应章节
- 派发字段从「角色文件路径：...」改为「角色定义（全文注入）：{完整内容}」——主 agent 派发前必须先读出角色文件全文，显性注入 brief，不再是路径引用
- 补充"为什么全文注入"的说明，引用 demand 角色 2026-09-07 的真实失效案例作为依据
- 明确标注当前只在 demand 角色验证此机制，其余角色暂时仍可用路径引用，验证通过后再推广

**未采纳的方案**：
- 把角色定义整体迁移到 `.claude/skills/<role>/SKILL.md`（方案 B 的极端版本）——会让框架从"宿主无关协议"退化为"Claude Code 专属机制"，且与三级记录结构（`<role>.md`+`memory.md`+`data/`）的既有设计冲突，评估为过度设计
- 一次性推广全文注入机制到全部 9 个角色——未经验证的机制不批量推广，先在 demand 上验证效果

**验证方式**：下一次派发 demand 角色时，观察全文注入 brief 后，六维诊断记录、来源标注等机械项的遵循度是否改善。若改善明显，推广到其余角色；若无明显改善，重新诊断根因（说明问题不在"路径引用 vs 全文注入"，可能在别处）。

**关联文件**：
- `principles/meta/agent-design-protocol.md`「role = skill：协议等价性」章节
- `roles/workflow-pb/workflow-pb.md` v0.6.0「派发执行角色时的 brief 构建」一节
- `roles/demand/data/demand-skill-migration-understanding.md`（本次讨论的理解记录）
