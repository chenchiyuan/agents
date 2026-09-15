# pr-001：pr-planner 关键路径硬约束与 workflow-pb 方案确认门迁移（F01/F02/F03/F04）

## 上下文摘要

pr-planner.md 当前具备逐对/逐个判断能力（三条粒度锚点 + v0.2.0 的并发可行性检查），但缺失对"依赖链整体深度"的约束——0025 迭代真实案例证明每对局部判断都合理、链条整体却可无限累加（链长 5）。本 PR 在 pr-planner.md Work 阶段新增"关键路径长度硬上限 ≤3"约束与合并压平循环，超限时按"B 的验收标准必须等 A 产出才能判断"的排序规则合并相邻对，合并前置检查若判定违反原子性/可审查性锚点则立即停止循环、转出"建议拆分为多个迭代"结论落盘为 `prs/split-suggestion.md`。同时，workflow-pb.md 的方案确认门从阶段3→4之间迁移至阶段4→5之间，呈现内容扩展为三部分（产品维度 + 架构维度 + PR 拆分方案摘要），阶段4推进条件表从四项扩展为六项（新增"并发可行性全部通过"与"关键路径长度 ≤3 或已转出拆分建议"），使得确认门触发条件天然包含结构性自检（F04 的技术基础）。formats.md 同步两处改动：status.md 注释行"阶段3→4"改"阶段4→5"，以及（若该文件原本不包含独立的阶段4推进条件描述段落则自动通过）确认格式文档与 workflow-pb.md 阶段定义表保持一致。SKILL.md 同步清单列出（工作区外，由主 agent 手动同步）。

## 涉及功能点

- F01
- F02
- F03
- F04

## 文件范围

- `roles/pr-planner/pr-planner.md`（修改：Strategy 章节「PR 粒度判断锚点」之后、「并发可行性（推进条件）」之前插入新小节"关键路径长度（Work 阶段硬约束）"含合并循环规则与合并受阻子节 [F01/F02]；Workflow §4 Work 追加关键路径压平段落 [F01]；§5 Verify 新增检查项 [F01]；成功标准/报告契约/红线/Tools 边界/决策记录各新增一条 [F01/F02]；版本 0.2.0 → 0.3.0，新增 v0.3.0 变更说明章节）
- `roles/pr-planner/data/pr-planner-changelog.md`（新增一条 v0.3.0 变更记录）
- `docs/iterations/0027-pr-planner-wave-cap/prs/split-suggestion.md`（格式规范定义文件，本次新建；注意：该文件是格式定义参考，不是运行时产物——真实的 split-suggestion.md 只有 pr-planner 在执行时触发合并受阻才会创建，不在本 PR 的"文件范围"内，验收标准也不检查它是否存在）
- `roles/workflow-pb/workflow-pb.md`（修改：§阶段定义表第4行「推进条件」列从四项扩展为六项 [F03 兼 F04 共同基础]；原"§方案确认门（阶段3→4之间）"整节替换为新版"§方案确认门（阶段4→5之间）"含触发时机/触发条件/前置说明/呈现内容/通过条件/关闭情况 [F03]；§调度指南「启动工作流」启动前询问措辞"阶段3→4"改"阶段4→5" [F03]；版本 0.13.0 → 0.14.0）
- `roles/workflow-pb/data/formats.md`（修改两处：① 第 104 行 `status.md` 格式规范注释，"供阶段3→4推进逻辑查询"改"供阶段4→5推进逻辑查询" [F03]；② 若该文件原本不包含独立的"阶段4推进条件"描述段落则此项自动通过，否则同步为六项内容或新增说明性注释指向 workflow-pb.md 作为规范来源 [F04 格式文档一致性]）
- `.claude/skills/workflow-pb/SKILL.md`（工作区外 `/Users/chenchiyuan/.claude/skills/workflow-pb/SKILL.md`，不在本迭代工作区内，按跨工作区写入禁止规则，本 PR 不直接写入，在 architecture.md §F03 第 5 点列出同步清单表格 [frontmatter description / Step 0 启动第4步 / Gate 章节标题、位置、内容五处]，由主 agent 在阶段5收口时或独立于 worktree 之外的时机手动同步）

## 验收标准

- [ ] `pr-planner.md` Strategy 章节在「PR 粒度判断锚点」之后、「并发可行性（推进条件）」之前存在命名为"关键路径长度（Work 阶段硬约束）"的独立小节，明确定义（依赖图最长链节点数）、硬上限（3）、检查时机（Work 阶段）、超限处理规则（四步合并循环，含合并排序规则/合并前置检查/违反锚点时立即停止）、决策理由（L2，复用 `depends_on` 图结构不引入工时估算）（F01 验收 1）
- [ ] 该小节包含子节"合并受阻：建议拆分为多个迭代"，明确停止动作、转出结论、拆分边界算法（以触发违反的相邻对为分割点、B 及其下游划入迭代 2）、落盘位置（`prs/split-suggestion.md`）、性质（建议而非自行执行）（F02 验收 1）
- [ ] Workflow §4 Work 章节在既有 Thought-Action-Observation 循环之后追加"关键路径压平（Work 阶段硬约束，循环收尾前必做）"段落，明确触发时机（全部 PR 文件 `depends_on` 写定后）、执行动作（计算关键路径长度、>3 时执行合并循环、合并会改 PR 文件需回本步骤重新 Action）、循环终止条件（≤3 或转出拆分建议）（F01 验收 2）
- [ ] Workflow §5 Verify 章节新增检查项："关键路径长度 ≤3，或合并受阻已转出'建议拆分为多个迭代'结论（`prs/split-suggestion.md` 存在）——二者必居其一，不能关键路径 >3 且没有转出结论就直接交付"（F01 验收 3）
- [ ] `pr-planner.md` 成功标准新增一条："关键路径长度 ≤3，或已转出'建议拆分为多个迭代'结论（`prs/split-suggestion.md`）"（F01 验收 4）
- [ ] 报告契约新增第 5 项："关键路径压平结果：最终关键路径长度；是否发生合并（合并了哪些 PR）；若转出'建议拆分为多个迭代'结论，附 `prs/split-suggestion.md` 路径与摘要"（F02 验收 2）
- [ ] 红线（绝不）新增："绝不为了让关键路径数字达标而强行合并违反原子性/可审查性的候选对"（F01 验收 5）
- [ ] Tools and capability boundaries §不做什么 新增："不自行创建新迭代目录或修改 demand.md——合并受阻时只产出'建议拆分'结论"（F02 验收 3）
- [ ] 决策记录判断标准新增一条："触发过合并受阻转出'建议拆分'结论 → 记"（F02 验收 4）
- [ ] `pr-planner.md` 版本号从 `0.2.0` 升至 `0.3.0`，新增"v0.3.0 变更说明"章节（格式参照现有 v0.2.0 章节：触发背景/新增了什么/目的/不改变的部分）（F01 验收 6）
- [ ] `data/pr-planner-changelog.md` 新增一条 v0.3.0 变更记录，包含触发背景（0025 迭代案例）、具体改动摘要、决策过程（若有非显然的架构选择）（F01 验收 7）
- [ ] `docs/iterations/0027-pr-planner-wave-cap/prs/split-suggestion.md` 文件存在，作为格式规范参考，包含四个章节：触发原因（合并循环停止处关键路径长度 + 候选对 + 违反锚点具体说明）、拆分建议（迭代 1 与迭代 2 各列功能点 F-ID 与覆盖 PR）、依据（分割点与划分算法说明）（F02 验收 5，架构已明确该文件为格式定义参考，不是运行时产物）
- [ ] `workflow-pb.md` §阶段定义表第4行「推进条件」列包含六项（原四项：格式规范/功能点引用/文件范围不重叠/依赖图无环；新增两项：并发可行性检查全部通过 + 关键路径长度 ≤3 或已转出拆分建议，后者明确引用 `prs/split-suggestion.md` 文件存在作为判断信号）（F03 验收 1，兼 F04 验收 1 共同基础）
- [ ] 原"§方案确认门（阶段3→4之间）"章节已被替换为新版"§方案确认门（阶段4→5之间）"，包含六个子项：触发时机（阶段4推进条件全部通过后、阶段5开始前）、触发条件（`status.md` 头部字段 `enabled` 默认值）、前置说明（阶段4推进条件已包含四项结构性检查、方案确认门只做结果汇总呈现不重新执行）、呈现内容（三部分：prd/architecture/PR 拆分方案摘要，若 `prs/split-suggestion.md` 存在必须一并呈现）、通过条件（用户明确确认后方可进阶段5）、关闭情况（`disabled` 则直接进阶段5）（F03 验收 2）
- [ ] §调度指南「启动工作流」章节的启动前询问措辞，"阶段3→4之间"已改为"阶段4→5之间"（F03 验收 4，口径一致性）
- [ ] `roles/workflow-pb/data/formats.md` 第 104 行左右（`status.md` 格式规范中 `**方案确认门**` 字段注释）的"供阶段3→4推进逻辑查询"已改为"供阶段4→5推进逻辑查询"（F03 验收 5，格式文档同步）
- [ ] `roles/workflow-pb/data/formats.md` 中关于"阶段4推进条件"的描述（若存在）已同步为六项内容（格式规范满足/功能点引用/文件范围不重叠/依赖图无环/并发可行性全部通过/关键路径长度 ≤3 或已转出拆分建议），或在适当位置新增说明性注释指向 `workflow-pb.md` §阶段定义表第4行作为唯一规范来源；若 `formats.md` 原本就不包含"阶段4推进条件"的独立描述段落（即该格式文件只定义 status.md/prd.md/architecture.md 等产物格式，不重复描述推进条件内容），则本验收项自动通过——不强制要求在 formats.md 中冗余记录已在 workflow-pb.md 阶段定义表中明确的内容（F04 验收 2 及备选判定）
- [ ] `workflow-pb.md` 版本号从 `0.13.0` 升至 `0.14.0`（F03 验收 6）
- [ ] `architecture.md` §F04 章节存在，明确说明"F04 的技术路径无独立文本改动——通过 F03 第1步（阶段4推进条件表扩展为六项）与 F03 第2步（方案确认门章节新增'前置说明'段）共同满足"，以及 `[架构待填]` 解答"复用阶段4推进条件核查结果，不独立重新执行"（F04 验收 3，架构决策留痕）
- [ ] `architecture.md` §F03 第 5 点存在完整的 SKILL.md 同步清单表格，明确列出 frontmatter description / Step 0 启动询问措辞 / Gate 章节标题从"阶段3→4"改"阶段4→5"、Gate 章节位置从"Step 1~4 末尾、既有 Gate 阶段4→5入口之前"迁移至"既有 Gate 阶段4→5入口之后、Step 5 之前"、Gate 章节内容同步为新版方案确认门五处改动（F03 验收 3，SKILL.md 工作区外不直接写但同步清单必须齐备）

## 参考资料

- `docs/iterations/0027-pr-planner-wave-cap/architecture.md` §F01/§F02（F01/F02 共享同一技术路径章节）、§F03（包含 SKILL.md 同步清单详表与位置迁移理由）、§F04（结构性自检复用机制说明）
- `docs/iterations/0027-pr-planner-wave-cap/prd/F01-pr-planner-critical-path-constraint.md`
- `docs/iterations/0027-pr-planner-wave-cap/prd/F02-pr-planner-split-iteration-suggestion.md`
- `docs/iterations/0027-pr-planner-wave-cap/prd/F03-plan-gate-relocation-and-content.md`
- `docs/iterations/0027-pr-planner-wave-cap/prd/F04-stage4-structural-precheck.md`
- 代码基线锚点（pr-planner）：`roles/pr-planner/pr-planner.md:30`（版本号）、`:50-54`（v0.2.0 变更说明章节，格式参照点）、`:56-63`（成功标准）、`:165-183`（Strategy 章节，插入点在 :179 三条锚点之后、:184 并发可行性之前）、`:211-257`（Workflow，Work 在 :230-237、Verify 在 :237-245）、`:322-336`（报告契约）、`:282-291`（红线）、`:260-280`（Tools and capability boundaries）、`:338-346`（决策记录）；`roles/pr-planner/data/pr-planner-changelog.md:1-25`（现有变更记录格式参照）
- 代码基线锚点（workflow-pb）：`roles/workflow-pb/workflow-pb.md:1`（版本号 v0.13.0）、`:55`（§阶段定义表第4行）、`:65-77`（原"§方案确认门（阶段3→4之间）"章节，整节替换）、`:134-142`（§调度指南「启动工作流」含询问措辞）；`roles/workflow-pb/data/formats.md:104`（status.md 格式规范 `**方案确认门**` 字段注释行）、`:1-229`（全文扫描确认是否存在独立的"阶段4推进条件"描述段落）

## depends_on

（无）

## batch

1
