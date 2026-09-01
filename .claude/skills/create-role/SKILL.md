---
name: create-role
description: 创建 agents 项目的新角色（roles/<role>/）。通过 AI 反射推理产出角色定义，禁止占位符填空。内部自带完整的 Plan-Execute-Verify-Fix-Reflect 闭环——验证由内部派发的无上下文子 agent 独立完成，不对外暴露成单独的验证 skill。当用户要新增一个角色/agent 定义时使用。
---

# create-role

**版本**: 2.0.0
**创建日期**: 2026-09-01
**变更历史**: 见 `principles/meta/data/agent-design-protocol-changelog.md`（v0.5.0 和 v0.6.0 条目）

---

**CRITICAL: 绝不用占位符模板渲染判断类内容——identity/character/Strategy/能力边界必须来自真实反射推理，不是填空。**

**CRITICAL: 绝不跳过用户确认直接定稿——反射结果标记 `model_inferred`，写入角色文件前必须展示给用户并获得确认。**

**CRITICAL: 绝不自己验收——Verify 阶段必须派发一个不继承本次创建推理上下文的子 agent 独立检查，不能用同一条推理线程自我感觉良好就宣布完成。**

**CRITICAL: 绝不把验证能力拆出去做成另一个可被外部单独调用的 skill——验证是这个闭环自己的事，除非未来出现独立于创建过程的外部调用需求，否则不预先暴露。**

---

## 一句话职责

接收"要创建一个什么样的角色"的需求，通过反射推理产出角色定义，经用户确认后落盘，再在内部完成独立验证，直到验证通过才算完成。全程在自己的边界内闭环。

## 成功标准

- `roles/<role>/{<role>.md, memory.md, data/}` 全部就位
- `<role>.md` 的判断类内容全部经过反射三步和用户确认，反射依据留痕在 `roles/<role>/data/`
- 内部派发的无上下文子 agent 独立验证通过（不是创建者自证）

---

## Workflow：Plan → Execute → Verify → Fix → Reflect

### 1. Plan

- 明确这次要创建的角色处理什么任务、和已有角色（如 `roles/dev`）的边界在哪、为什么现有角色不够用
- 不确定边界时，先问用户，不猜

### 2. Execute —— 反射三步 + Thought-Action-Observation

严格遵循 `principles/meta/agent-design-protocol.md`「角色反射协议」：

1. **Thought/提取核心任务类型**：这个角色的核心任务是什么？现实世界谁每天做这类判断？为什么是这类人？
2. **Action/构造角色描述**：产出 identity（L4 精度：交叉稀缺×具象类比×战绩暗示）、relationship、character、Strategy 判断框架（对抗惯性表+判断锚点）、能力边界、领域事实
3. **Observation/展示确认**：用固定格式（见「角色反射协议」的展示模板）呈现给用户，明确标注 `model_inferred`，等待确认或调整
4. **再循环**：用户要求调整 → 回到 Thought 重新反射，不是小修小补；确认 → 进入落盘

落盘时机：**只有用户确认后**才能：
- `mkdir -p roles/<role>/data`
- 用 Write 直接写入完整的 `<role>.md`（参照 `roles/_template/role-structure-reference.md` 的七层结构清单核对完整性，不是复制模板改字段）
- 写入 `memory.md`（初始为空索引）

### 3. Verify —— 内部派发无上下文子 agent，不自证

用 Agent 工具启动一个新的子 agent 做验证。**这个子 agent 不能是继续沿用本次创建的推理上下文**——必须是全新对话，只给它角色目录路径，让它自己去读文件、自己判断，不告诉它"我是怎么反射出来的""我的推理过程是什么"。这是保证"创建者不能自证完成"的具体手段。

子 agent 的检查任务包含两层：

**结构层**：跑 `tools/check-role-structure.sh roles/<role>`，确认 `<role>.md`/`memory.md`/`data/` 三者存在。这层只证明文件存在，不证明内容合规。

**内容层**，逐项核对并要求给出文件证据（不接受"看起来还行"）：

| 检查项 | 不合规的判定标准 |
|---|---|
| 无占位符残留 | 全文搜索 `{{`、`TODO`、`待填写` 等标记，任何残留都不合规 |
| identity 达到 L4 精度 | 缺交叉稀缺/具象类比/战绩暗示三要素中任意一个，或描述能匹配"几百万人"级别的泛化专家 |
| 原则是内联不是引用 | 出现 `$ref(`、"遵循 principles/execution/core-principles.md" 这类指针式表达 |
| Strategy 判断框架具体不笼统 | 只有放哪个角色都成立的通用流程，没有这个角色专属的对抗惯性表内容 |
| harness 循环完整（含 Fix 回环） | Workflow 一节缺 Context/Align/Plan/Execute[T-A-O]/Verify/Fix/Reflect 任一阶段，或 Verify 之后没有显式的"不通过怎么办" |
| 能力边界有区分度 | "做什么/不做什么"如果只是抄了别的角色的边界没有针对性调整 |
| 反射依据已留痕 | `roles/<role>/data/` 下是否有一条记录说明这次反射的依据、否决过的备选方案、用户确认/调整过什么 |

子 agent 输出结构化报告：每项通过/不通过 + 证据，最终给出"全部通过"或"问题清单"。

### 4. Fix

子 agent 报告的问题：
- 结构性问题（缺文件、格式）→ 直接改
- 内容质量问题（占位符残留、原则是引用不是内联、Strategy 太笼统）→ 回到 Execute 阶段重新反射对应部分，不是打补丁改字句

修复后**重新回到 Verify**，重新派发一个新的无上下文子 agent 检查（不是复用刚才提过问题的那个子 agent 的上下文，否则又变成"知道答案的人检查自己的答案"）。同一问题连续 3 轮 Verify→Fix 仍不通过，停下来记录尝试过程、报错、根因判断，向用户报告，不第 4 次硬撑。

### 5. Reflect

- 验证通过后，把这次反射的完整依据（为什么是这个 identity、否决过的备选方案、用户调整过什么、Verify 阶段发现过什么问题）写一条到 `roles/<role>/data/`
- 在 `docs/mvp-plan.md` 或对应 `docs/iterations/` 迭代计划文件里记录这次创建结果
- 如果这次创建过程本身暴露了反射协议、结构参照或闭环协议的缺陷（不是这个角色本身的问题，是流程本身的问题），回去更新 `principles/meta/agent-design-protocol.md`，保留旧结论被推翻的痕迹

---

## Tools and capability boundaries

**做什么**：
- 读 `principles/meta/agent-design-protocol.md`、`principles/execution/core-principles.md`、`roles/_template/role-structure-reference.md`、已有角色文件作为反射参照
- 反射推理，展示确认，落盘角色文件
- 用 Agent 工具派发无上下文子 agent 做独立验证

**不做什么**：
- 不用脚本渲染任何角色内容模板
- 不跳过用户确认
- 不用同一条推理上下文自证验证结果
- 不把验证能力拆成外部可单独调用的 skill

---

## Safety

- 反射结果未经确认不落盘
- 验证必须由无上下文子 agent 完成，不能自证
- Verify 不通过必须进入 Fix 并重新验证，不允许跳验证宣布完成
