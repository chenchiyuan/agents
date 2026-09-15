# pr-003：demand.md 提问机制重构（角色反射 F06 + Plan调研摘要 F07 + Work深挖收敛 F08 + Verify解耦 F09）

## 上下文摘要

`roles/demand/demand.md` 的 Align/Plan/Work/Verify 四个章节联动改写，将"固定用六维诊断驱动所有讨论"的机制替换为"Align 阶段动态反射专家角色+维度 → Plan 阶段按维度做调研摘要 → Work 阶段同维度深挖优先+维度收敛状态标记 → Verify 阶段六维诊断收窄为纯验收清单"的新机制。四张功能卡（F06~F09）改动的是同一份文件的四个互相衔接的章节，是一次连贯的机制替换（architecture.md §变更映射明确合并说明实施路径），拆开无法并发执行（F07依赖F06产出的维度格式、F08依赖F06+F07的维度列表和优先级、F09依赖F06的角色反射定义来描述解耦关系），合并为一个PR可一次性完成demand.md从0.5.0到0.6.0的核心机制演进，避免中间状态不一致。

## 涉及功能点

- F06
- F07
- F08
- F09

## 文件范围

- `roles/demand/demand.md`（修改：Align 章节新增"角色反射"子步骤 [F06]；Plan 章节整章改写为"按已确认维度做调研摘要" [F07]；Work 章节微循环整体替换为"同维度深挖+收敛状态标记"、删除现有"六维诊断驱动循环"描述 [F08]；Verify 章节改写为"六维诊断作为纯验收清单"，明确与角色反射维度解耦 [F09]；版本号从 0.5.0 升至 0.6.0 并补一条 `v0.6.0 变更说明`）

## 验收标准

- [ ] **F06 验收**：Align 章节新增明确命名的"角色反射"子步骤（或等价命名），要求本次讨论开始前反射最合适的专家角色+维度列表，反射结果必须显式呈现给用户（F06 验收 1~2）；维度不是固定的一套（文字能体现"不是每次都套用六维诊断"）（F06 验收 3）
- [ ] **F07 验收**：Plan 章节文字改为以 F06 反射出的维度列表为输入，对每个维度产出调研摘要（现状已知什么、缺口在哪）；不再以旧版固定六维诊断作为 Plan 阶段调研对象（F07 验收 1~2）；调研摘要在 Work 循环开始前产出，作为 Work 挑选深挖维度的依据（F07 验收 3，架构已填：每维度一段100~200字，含现状/缺口/优先级三段式）
- [ ] **F08 验收**：Work 章节微循环替换为"同维度有更深问题时优先继续深挖、只有当前维度问不出更深问题才切换、用户好回应时不表扬直接问更深"机制，原有"六维诊断驱动循环"描述被移除或改写 (F08 验收 1)；每个维度显式标记收敛状态（未开始/深挖中-第N轮/已收敛），且对用户可见 (F08 验收 2，架构已填：行内列表格式，附着在每轮提案前)；Work 循环不设轮次硬上限，退出条件仅为"所有维度已收敛"或"用户明说够了" (F08 验收 3~4)
- [ ] **F09 验收**：Verify 章节明确六维诊断在新机制下角色为"纯验收清单"（检查已收敛结论质量），不再驱动 Work 循环节奏 (F09 验收 1)；六维诊断与 F06 角色反射维度是两套独立的东西（六维诊断固定、角色反射维度动态，两者不合并） (F09 验收 2)；"方案雏形"（原六维诊断第6维）改为可能出现在角色反射维度列表里的一个具体维度，不再是六维诊断独占的固有环节 (F09 验收 3)
- [ ] 四个章节（Align/Plan/Work/Verify）之间的衔接关系正确：Align 反射产出维度列表 → Plan 按维度做摘要 → Work 用维度+优先级深挖 → Verify 用六维诊断验收，流程可串联无断点
- [ ] `demand.md` 版本号从 0.5.0 升至 0.6.0，且新增一条对应的"v0.6.0 变更说明"记录本次四项改动摘要（角色反射、Plan改为维度调研、Work深挖机制、Verify解耦）

## 参考资料

- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/architecture.md` §变更映射 F06~F09、§L1决策清单 L1-1/L1-2/L1-3
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F06-demand-align-role-reflection.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F07-demand-plan-dimension-summary.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F08-demand-work-deep-dive-convergence.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F09-demand-verify-checklist-decoupled.md`
- 代码基线锚点：`roles/demand/demand.md:27`（版本号）、`:103-107`（Align 章节，F06 插入点）、`:109-111`（Plan 章节，F07 改写对象）、`:113-155`（Work 章节，F08 改写对象）、`:146-155`（Verify 章节，F09 改写对象）

## depends_on

（无）

## batch

1
