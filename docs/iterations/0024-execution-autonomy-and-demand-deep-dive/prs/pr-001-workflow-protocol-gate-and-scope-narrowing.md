# pr-001：workflow-pb.md + SKILL.md 协同改写（方案确认门 F01/F02 + 阶段4/5决策点收窄 F03 + 阶段6强制置顶呈现 F04）

## 上下文摘要

`roles/workflow-pb/workflow-pb.md`（规范源）与 `.claude/skills/workflow-pb/SKILL.md`（宿主执行层）是同一套协议的两份同步文本——SKILL.md 的对应章节内容直接复述/引用 workflow-pb.md 的定义，两者对同一批条款（方案确认门、用户决策点范围、阶段6强制呈现）必须逐条口径一致。F01/F02/F03/F04 四张功能卡改动的正是这三批条款，且四张卡在两份文件里落点的章节相互穿插（F01 新增独立章节、F02 改状态追踪协议+Step 0、F03 整章改写"需要用户决策的情况"、F04 补强"验证目标"/Step 6），拆开编辑无法避免反复对照两份文件核对口径一致性，判定为无真实并发收益（见下方"并发可行性判断"）。

## 涉及功能点

- F01
- F02
- F03
- F04

## 文件范围

- `roles/workflow-pb/workflow-pb.md`（修改：新增"方案确认门"独立章节 [F01]；「启动工作流」Step 0 新增开关询问 + 「状态追踪协议」status.md 头部新增 `方案确认门` 字段 [F02]；"需要用户决策的情况"整章改写为阶段1~3/阶段4~5两段范围 [F03]；"验证目标"章节的"搭置的需求变更/错误报告"小节补强"原文摘录+置顶/显著呈现+禁止脚注式一笔带过" [F04]；版本号升级并补一条 `v0.12.0 变更说明`）
- `.claude/skills/workflow-pb/SKILL.md`（修改：Step 0 新增开关询问 [F02]；"Step 1~4: 线性阶段推进"章节开头新增"Gate: 阶段3→4方案确认门"小节 [F01]；「§ 用户决策点与暂停格式」表格改写为阶段1~3/阶段4~5两段范围 [F03]；Step 6 补强"置顶呈现+禁止脚注式一笔带过"措辞 [F04]）

## 验收标准

- [ ] `workflow-pb.md` 存在独立命名为"方案确认门"的章节，明确触发时机（阶段3推进条件全部通过后、阶段4开始前）、呈现内容（产品维度+架构维度整体呈现）、通过条件（用户明确确认才能进入阶段4，不得自行判定跳过）（F01 验收 1~3）
- [ ] `SKILL.md` 中方案确认门描述与 `workflow-pb.md` 三要素（触发时机/呈现内容/通过条件）口径一致（F01 验收 4）
- [ ] `workflow-pb.md` 的「启动工作流」章节存在 Step 0 询问是否开启方案确认门的文字，默认值为"开启"；关闭时阶段3推进条件满足后直接进入阶段4，不触发方案确认门（F02 验收 1~2）
- [ ] `SKILL.md` Step 0 同步该开关询问逻辑，触发时机和默认值一致（F02 验收 3）
- [ ] `workflow-pb.md` 的「状态追踪协议」status.md 格式定义中新增 `方案确认门` 字段（取值 `enabled`/`disabled`，默认 `enabled`），供阶段3→4推进逻辑查询（F02 验收 4，架构已填：字段名 `plan_confirmation_gate`/中文呈现 `方案确认门`，落在 status.md 头部元信息区，与现有 `history` 字段同风格）
- [ ] `workflow-pb.md` "需要用户决策的情况"章节明确区分"阶段1~3适用"和"阶段4/5适用"两类范围；阶段4/5范围仅列"依赖图有环"与"阻塞且无法不修改上游产物解决"两项；明确 `[model_inferred]` 在阶段4/5不再触发暂停；明确需求层问题仍走 `deferred-demand-changes.md` 机制不暂停（F03 验收 1~3）
- [ ] `SKILL.md` "§用户决策点与暂停格式"章节同步以上范围收窄，口径与 `workflow-pb.md` 一致（F03 验收 4）
- [ ] `workflow-pb.md` "验证目标"章节中 `deferred-demand-changes.md` 呈现要求明确写出"原文摘录（不转述不总结）"+"置顶或显著呈现"+"禁止脚注式一笔带过、不得放报告末尾或不显眼位置"三层要求（F04 验收 1~2）
- [ ] `SKILL.md` Step 6 章节同步该强制呈现要求，口径与 `workflow-pb.md` 一致（F04 验收 3）
- [ ] 两份文件中 F01/F02/F03/F04 对应条款逐一比对，三要素（或等价关键字段）口径一致，无相互矛盾或遗漏同步的表述
- [ ] `workflow-pb.md` 版本号从 0.11.0 升至新版本号，且新增一条对应的"vX.X.0 变更说明"章节，记录本次四项改动摘要

## 参考资料

- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/architecture.md` §变更映射 F01、F02、F03、F04
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F01-plan-confirmation-gate.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F02-plan-confirmation-gate-toggle.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F03-stage45-decision-points-narrowed.md`
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F04-stage6-deferred-changes-highlight.md`
- 代码基线锚点：`roles/workflow-pb/workflow-pb.md:25`（版本号）、`:157-172`（阶段定义表）、`:176`（提交管理约束起点，F01 插入点）、`:400-416`（启动工作流/Step 0，F02 插入点）、`:510-517`（需要用户决策的情况，F03 改写对象）、`:579-585`（验证目标/搭置的需求变更小节，F04 补强对象）、`:628-687`（状态追踪协议/status.md 格式，F02 字段插入点）；`.claude/skills/workflow-pb/SKILL.md:135-140`（Step 0，F02）、`:142-156`（Step 1~4，F01 Gate 插入点）、`:183-192`（Step 6，F04）、`:316-341`（§用户决策点与暂停格式，F03 改写对象）

## depends_on

（无）

## batch

1
