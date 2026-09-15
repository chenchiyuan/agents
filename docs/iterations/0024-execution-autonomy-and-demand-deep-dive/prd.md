# prd.md — 0024-execution-autonomy-and-demand-deep-dive

**版本**: 0.1.0
**迭代**: 0024-execution-autonomy-and-demand-deep-dive
**创建日期**: 2026-09-15
**阶段**: 功能规格（阶段 2）
**输入合同**: `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/demand.md`（已收敛）

**说明**：本次迭代修改的是 workflow-pb 协议自身的 4 份规范文件（`roles/workflow-pb/workflow-pb.md`、`.claude/skills/workflow-pb/SKILL.md`、`roles/pr-planner/pr-planner.md`、`roles/demand/demand.md`），不是业务代码。因此本迭代的"用户可见行为"是这些规范文档最终文本内容本身——每张卡的验收标准都可以通过直接阅读改动后的文件文本来核查，不需要运行程序或做用户操作测试。

---

## 功能点索引

| ID | 功能名 | 用户价值摘要 | 规格卡 | 来源条款 | 架构维度 |
|---|---|---|---|---|---|
| F01 | 方案确认门（阶段3→4之间的触发与呈现） | 架构方案确认后才进入PR规划，不会等PR跑起来才发现方向不对 | [F01](prd/F01-plan-confirmation-gate.md) | 做什么#1（前半）；结论#2 | 无待填项（见architecture.md变更映射） |
| F02 | 方案确认门开关（Step 0，默认开启，可关闭） | 可以提前关掉这道确认门，不主动关闭时默认仍受保护 | [F02](prd/F02-plan-confirmation-gate-toggle.md) | 做什么#1（后半）；结论#3 | 已填：status.md头部`方案确认门`字段 |
| F03 | 阶段4/5用户决策点收窄为两项硬暂停 | PR规划和实现阶段不再被非结构性问题反复打断 | [F03](prd/F03-stage45-decision-points-narrowed.md) | 做什么#2；结论#4/#5/#6 | 无待填项（见architecture.md变更映射） |
| F04 | 阶段6验证报告强制置顶呈现 deferred-demand-changes.md | 留给下一迭代的需求层问题不会被淹没在验证细节里 | [F04](prd/F04-stage6-deferred-changes-highlight.md) | 做什么#3；结论#7 | 无待填项（见architecture.md变更映射） |
| F05 | pr-planner 新增"并发可行性"判断维度 | 拆出的每个PR都真的能和别的PR同时跑，不是白拆 | [F05](prd/F05-pr-planner-concurrency-dimension.md) | 做什么#4；结论#8/#9 | 已填：依赖图可达性判定算法 |
| F06 | demand.md Align 阶段新增角色反射子步骤 | 一开场就能看到本次讨论最合适的专家视角和维度列表 | [F06](prd/F06-demand-align-role-reflection.md) | 做什么#5（角色反射）；结论#10/#11 | 无待填项，L1决策见architecture.md |
| F07 | demand.md Plan 阶段改为按已确认维度做调研摘要 | 提问不是临场现想，是有备而来 | [F07](prd/F07-demand-plan-dimension-summary.md) | 做什么#5（Plan） | 已填：100~200字三段式摘要模板 |
| F08 | demand.md Work 循环替换为同维度深挖优先+维度收敛状态标记，无轮次硬上限 | 问题被顺着往深处问，讨论进度透明可见，不被轮次上限强行截断 | [F08](prd/F08-demand-work-deep-dive-convergence.md) | 做什么#5（Work）；结论#11/#13 | 已填：行内列表标记格式；L1决策见architecture.md |
| F09 | demand.md Verify 阶段六维诊断收窄为纯验收清单，与提问机制解耦 | 提问深度和最终结论质量是两件分开检查的事 | [F09](prd/F09-demand-verify-checklist-decoupled.md) | 做什么#5（Verify）；结论#12/#14 | 无待填项，L1决策见architecture.md |

**合计**：**9 张功能卡**，覆盖 demand.md「做什么」全部 5 条（F01/F02 ← 做什么#1；F03 ← 做什么#2；F04 ← 做什么#3；F05 ← 做什么#4；F06/F07/F08/F09 ← 做什么#5 的四个子步骤）。架构维度全部留白 `[架构待填]`。

---

## 本次迭代边界说明

### 包含

- 阶段3→4 之间新增方案确认门，默认开启，Step 0 可关闭（F01/F02）。
- 阶段4/5 用户决策点范围收窄为「依赖图有环」+「阻塞且无法绕开」两项，`model_inferred` 等其余情况不再触发暂停（F03）。
- 阶段6验证报告对 `deferred-demand-changes.md` 强制原文摘录+置顶呈现（F04）。
- pr-planner 新增"并发可行性"作为 PR 拆分的推进条件（F05）。
- demand.md 提问机制重构：Align 新增角色反射、Plan 改为按维度做调研摘要、Work 循环替换为深挖优先+收敛状态标记（无轮次硬上限）、Verify 的六维诊断收窄为纯验收清单（F06~F09）。

### 不包含（对应 demand.md「不做什么」，已作为各卡边界项落实，不单独拆保证项卡）

- 不改动阶段1~3现有暂停触发条件——见 F01/F03 边界说明。
- 阶段4/5 不设轮次上限式暂停——见 F03 边界说明。
- demand.md Work 循环不设轮次硬上限——见 F08 验收标准第3/4条。
- 不改动 `pb-v1-talk` 文件本身——见 F06/F08 边界说明。
- 不合并六维诊断和角色反射为一体——见 F09 验收标准第2条。

以上 5 条"不做什么"未在 demand.md 中对应独立的产品行为，均以既有功能卡的边界约束形式承载，不新增额外的保证项卡（与 demand.md 描述的改动范围一致：本次是纯文档改动，"不做什么"本身就是对文档内容的否定性约束，天然属于相关卡的边界，不构成独立可验证的用户价值点）。

### 架构维度处理

全部 9 张卡的"架构维度"列此前均为 `[架构待填]`，阶段3（技术架构）已完成填写，详见 `architecture.md`：
- 方案确认门开关状态的存储位置和字段名（F02）→ `status.md` 头部 `方案确认门` 字段（enabled/disabled，默认enabled）
- 并发重叠窗口的具体计算方法（F05）→ 依赖图可达性判定（复用pr-planner已有的`depends_on`依赖图）
- 调研摘要的篇幅/格式模板（F07）→ 每维度100~200字，含"现状/缺口/优先级"三段式
- 维度收敛状态标记的呈现格式（F08）→ 行内文本列表，格式`- {维度}:{状态}`

F06/F08/F09 涉及 demand.md 核心运作方式的重构，architecture.md 已标注为 L1 决策，待主agent确认后方可进入实现阶段。

---

## model_inferred 汇总（已确认）

| 卡片 | 推导内容 | 推导依据 | 状态 |
|---|---|---|---|
| F02 | 需要某种方式记录"本次迭代方案确认门是否开启"供阶段3→4推进逻辑查询 | 从"关闭后要能直接推进"这一要求必然推导出的前提，demand.md 未逐字写出 | user_confirmed |
| F05 | 并发可行性检查的时机是"产出PR拆分方案之后、交付前" | 从"这是推进条件"的定性必然推导，demand.md 未显式写出检查时机 | user_confirmed |
| F07 | 调研摘要作为 Work 循环挑选深挖维度的依据 | 从 Plan 在 Work 之前且必须有信息传递关系的流程逻辑推导，demand.md 未逐字写明衔接关系 | user_confirmed |

以上 3 项均已经用户确认，可作为阶段3架构设计的前提使用。

---

## 疑问/越界

无发现 demand.md 内部矛盾或不清晰之处。demand.md 两段结构完整、澄清依据充分，功能规格拆解过程顺利。
