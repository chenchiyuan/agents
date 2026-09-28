# F12 · 新版 demand.md 符合 skill-design-protocol §12 checklist（D-16 保留项除外）

**来源**：D-16（编写须符合 `docs/skill-design-protocol.md`；与 `principles/meta/agent-design-protocol.md` 明确改写处保留项目版写法）；衡量标准 5（逐项核查 §12 checklist，重点 CRITICAL ≤3 且每条带后果、MUST/NEVER ≤2/节、关键约束首尾三明治、终稿确认为独立 Gate）

## 用户价值

新版 demand 里的强约束稀缺、有后果、落在注意力热区，终稿确认不会因为埋在段落中间而被跳过。

## 验收标准

1. **逐项核查记录**：对新版 `roles/demand/demand.md` 存在一份按 §12 checklist（#0~#19，含 #0b）逐项给出结论的核查记录；每项结论为 通过 / 不适用 / D-16 保留项 之一，"不适用"与"D-16 保留项"须附一句理由；无"基本通过"类模糊结论 [衡量 5]。
2. **D-16 保留项单列**：以下项目按项目版写法判定，不按 skill-design-protocol 原文判红 [D-16]：
   - 原则内联、不用 `$ref`（对应 §12 #12）；
   - 不要编排元数据（`compatibility` / `style` / 输入输出协议等）；
   - 流程层采用项目版 harness 循环生命周期（agent-design-protocol §流程层）。
3. **CRITICAL ≤3 且带后果**：新版全文 `CRITICAL` 出现 ≤3 处；每处为独立加粗段落，形如 `**CRITICAL: {规则}——{违反的后果}**`，后果为具体结果而非"可能出错"类空话 [衡量 5；§9.1.1 原则一、格式要求]。
4. **MUST/NEVER ≤2/节**：新版每个 Section 内 `MUST` 与 `NEVER`（含对应中文强约束"必须/绝不"作为约束词使用时）合计 ≤2 处，每处紧跟原因 [衡量 5；§12 #16；§9.1.1]。
5. **首尾三明治**：每条 CRITICAL 所声明的规则，在文档尾部（Safety 或验证清单）以验证形式再次出现 [衡量 5；§4.4.1]。
6. **终稿确认为独立 Gate**：终稿整份确认（F06）在 Workflow 中是与其它步骤平级的独立 Gate 步骤，包含 触发条件 / 验证内容 / 通过标准 / 未通过处理 四项；不是嵌在某个步骤描述里的一句话 [衡量 5；§4.4.2]。

QA 判定方式：
- 3、4：对新版 demand.md 按 Section 计数约束词；
- 5：列出全部 CRITICAL 规则，逐条在尾部找验证形式；
- 6：检查 Workflow 结构中存在独立 Gate 小节且四项齐全；
- 1、2：检查核查记录的覆盖完整性与保留项理由。

## 边界（不包含）

- 只核查 `roles/demand/demand.md`；workflow-pb.md、prd.md 本次只做最小同步（F10、F11），不纳入 §12 核查。
- 不修改 `docs/skill-design-protocol.md` 与 `principles/meta/agent-design-protocol.md`。
- 不引入 scripts/、references/、评估套件等新文件来"满足"checklist；相关项可按理由判"不适用"（判定见 `architecture.md` §9）。
- 本卡不决定哪几条规则升为 CRITICAL（见 `architecture.md` §3）。

## 架构维度

**A-01（已填定，详见 `architecture.md` §3.1 / §3.2 / §3.3）**：CRITICAL 恰 3 条 = 衡量标准 1 的三条硬约束（C1 问题准入 + 归属 / C2 依赖先于被依赖 / C3 终稿确认），各带后果，Safety 有逐条的尾部验证形式；每节约束词预算见 §3.1 预算列（`##` 与 `###` 两级都 ≤2）；Gate 为 Workflow 中独立 `###` 节，位于「6. 修复」与「7. 交付」之间。
**A-07（已填定，详见 `architecture.md` §9）**：预判——#6 / #8 / #9 / #18 不适用，#7 前半不适用，#12 为 D-16 保留项，其余通过（每项理由见 §9 表）。核查记录存放于 `docs/iterations/0031-demand-convergence-redesign/demand-skill-checklist.md`（阶段 5 产出，含约束词按节计数表）。

## model_inferred

- MI-12 · 验收 2 中 D-16 保留项到 §12 的映射 [model_inferred]：D-16 点名三处保留写法，本卡将其中"原则内联不用 `$ref`"对应到 §12 #12；"编排元数据"与"流程层"在 §12 无一一对应的条目，按"涉及条目中遇到这两处时不判红"处理。需主 agent 确认。
- MI-13 · 验收 4 中"必须/绝不"作为中文约束词计入 [model_inferred]：§9.1.1 以英文约束词定义频率，项目角色文件以中文书写；本卡将中文强约束词在约束词语境下计入同一上限，否则中文文件可绕过该上限。需主 agent 确认。
