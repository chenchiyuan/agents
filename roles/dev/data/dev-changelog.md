---
name: dev-changelog
description: roles/dev/dev.md 的变更历史：需求/原因/决策过程/经验总结
type: changelog
---

# dev.md 变更历史

---

## v0.3.0（2026-09-01）

**需求**：补齐显式 Fix 回环——对应 agent-design-protocol.md v0.6.0 新增 Fix 阶段，要求所有角色的 Workflow 中 Verify 不通过时有明确的回环描述。

**变更原因**：v0.2.0 补了 Verify 阶段，但没说 Verify 不通过怎么办。这个空白让角色在执行时"完成了验证发现问题"之后没有协议指引，实际上会退化成凭感觉处理。

**决策过程**：新增「修复（Fix）」阶段作为第 6 步，明确"Verify 不通过不能直接进入交付"、"修复后必须重新完整跑一遍 Verify"，并说明按问题类型分流（报错指向具体代码→回 Work 循环；修复反复不通过→触发失败记录阈值）。

**经验总结**：Verify 和 Fix 必须配对出现——单独有 Verify、没有 Fix 的协议，等于有了刹车却没定义"刹不住的时候怎么办"。这条现在作为「标准协议」中的硬性要求。

---

## v0.2.0（2026-09-01）

**需求**：对应 agent-design-protocol.md v0.2.0，用户要求 harness 循环成为每个角色必须体现的结构，dev 角色要补齐标准协议定义的完整七阶段生命周期。

**变更原因**：v0.1.0 的 dev.md 缺少从"接收任务"到"交付"的结构化生命周期描述，只有静态边界（做什么/不做什么）。主 agent 派发任务后，子 agent 没有协议指引怎么跑。

**决策过程**：按「标准协议：agent 自闭环生命周期」的七阶段（Context→Align→Plan→Work[T-A-O]→Verify→Deliver→Reflect）逐步补齐；Work 阶段内嵌 Thought-Action-Observation 微循环说明，并给出"连续 3 次失败"的切换条件。

**经验总结**：静态边界描述的角色文件只回答"它能做什么"，不回答"它怎么跑"。前者是接口说明，后者才是 agent 定义。两者缺一，主 agent 无法真正把任务"派"出去——派出去等于丢进黑盒。

---

## v0.1.0（2026-09-01）

**需求**：项目启动，需要 agents 项目自己的 dev 角色。基于 powerby-skills/skills/pb-v1-implementing/SKILL.md 一次性借鉴改写。

**变更原因**：新文件，无前版本。

**决策过程**：从 pb-v1-implementing 提炼核心概念（任务简报契约、"不做架构决策"的硬边界、报告契约）并按 agents 项目场景简化——去掉 powerby-skills 专属的产品研发流程引用，保留通用的"接收简报→执行→回报"结构。原则章节从 core-principles.md 起草库复制并按 dev 场景调整（比如"不做未要求的事"具象化为"简报没要求的文件不碰"）。

**经验总结**：从已有角色借鉴改写时，最重要的是"识别哪些是产品域逻辑、哪些是通用 agent 行为"——前者要删，后者要留。pb-v1-implementing 里大量的 powerby 生命周期引用（discovery/designing/demo 流程钩子）都是产品域逻辑，一并删除后 dev.md 精简了约 60%，反而更清晰。
