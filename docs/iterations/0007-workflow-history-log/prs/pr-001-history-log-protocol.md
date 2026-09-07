# PR-001：workflow-pb.md / SKILL.md 新增 history.md 记录协议与开关

## 上下文摘要

把 `architecture.md`「对 workflow-pb.md / SKILL.md 的目标改动」列出的全部改动点落实为正式协议文字：新增独立于 `status.md` 的 `history.md` 记录产物（决策 D1/D2）、`status.md` 头部新增 `history` 开关字段（决策 D3）、三类事件（派发/收到报告/调度决策）的记录格式（决策 D4）、并发场景下的顺序保真约定（决策 D5）。四项决策全部落在同两份文件（`workflow-pb.md`、`SKILL.md`）的少数几个章节内，且 D2/D4/D5 共享同一个新增章节的内部结构，按"文件范围不重叠、逻辑原子性"判断锚点无法切分成互不相关的独立提交，合并为一个 PR（同类先例：`0005-pr-concurrent-execution` 迭代 pr-001 对同两份文件的合并处理）。

## 涉及功能点

- F01
- F02
- F03
- F04

## 文件范围

- `roles/workflow-pb/workflow-pb.md`（修改：新增「历史记录协议（history.md）」章节；「文档路径协议」目录树新增一行；「状态追踪协议」status.md 格式定义头部字段区新增 `history` 行；「调度指南 § 启动工作流」新增一步；「调度指南」阶段1~4/阶段5相关段落补充交叉引用；版本号递增并更新文件头版本号）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（修改：追加本次版本变更记录，沿用项目既有惯例）
- `roles/workflow-pb/memory.md`（修改：追加一条索引摘要，沿用项目既有惯例）
- `.claude/skills/workflow-pb/SKILL.md`（修改：新增 `## § history.md 更新时机` 一节；「Tools and capability boundaries」「Important facts and constraints」「Safety」各新增一条；版本号/变更历史引用同步更新）
- `.claude/skills/workflow-pb/data/skill-optimization-v{下一版本号}.md`（新建：沿用项目既有惯例，每次 SKILL.md 版本变更都在 `data/` 下新建一份对应记录）
- `.claude/skills/workflow-pb/memory.md`（修改：追加一条索引摘要，沿用项目既有惯例）

## 验收标准

- [ ] `roles/workflow-pb/workflow-pb.md` 新增 `## 历史记录协议（history.md）` 一节，与现有 `## 状态追踪协议（status.md）` 平级并列（不嵌入其章节内部），内容包含：落盘位置 `docs/iterations/{迭代ID}/history.md`、创建时机（工作流启动创建 `status.md` 之后，若 `history` 开启立即创建仅含标题行的空文件）、关闭时的行为（启动时关闭不创建；运行中途关闭已存在文件保留不删除且不再追加）。
- [ ] 同一新增章节内包含三类事件（`派发` / `收到报告` / `调度决策`）的统一条目格式：三级标题 `### {YYYY-MM-DD HH:MM:SS} · {事件类型} · {对象}` + 字段行；时间戳精度到秒级（不是日期级）；派发类字段对应 brief 已内联字段（阶段/任务，阶段 5 额外加 PR 路径）；收到报告类字段逐条对应该角色报告契约已定义的编号/字段项（不是自由摘要）；调度决策类至少含"决策内容"和"触发依据"两个字段。三类各附至少一个具体示例（沿用 `architecture.md` §决策 D4 的示例）。
- [ ] 同一新增章节内包含顺序保真约定（决策 D5）：不引入序号字段、不引入同步锁；文字说明"history.md 写入动作本身是主 agent 单线程顺序完成的，即使随后并发发起多个 `Agent()` 调用"这一技术事实；阶段 5 同一轮响应内准备并发发起 N 个调用前，先依次追加 N 条「派发」记录再发起调用；补位派发同理，先记「调度决策·槛位释放」再依次记每个补位派发的「派发」条目，两者不合并。
- [ ] 「文档路径协议」章节的目录树中新增一行 `history.md` 条目，标注"历史记录（由主 agent 维护，见「历史记录协议」）"，与 `status.md` 同级。
- [ ] 「状态追踪协议」`status.md` 格式定义的头部字段区（`**工作流**`/`**迭代**`/`**当前阶段**`/`**状态**` 所在组）中，紧跟 `**状态**` 字段之后新增一行 `**history**: 开启`，并说明取值只有 `开启`/`关闭` 两种、默认 `开启`。
- [ ] 「调度指南 § 启动工作流」步骤中新增一步：创建 `status.md` 之后，若 `history` 字段为开启，创建空 `history.md`。
- [ ] 「调度指南」中涉及派发/收到报告/调度决策的既有段落（阶段1~4推进、阶段5）补充一句"同时按「历史记录协议」追加 history.md 记录"的交叉引用，不在这些段落里重复定义格式。
- [ ] `roles/workflow-pb/workflow-pb.md` 文件头版本号从 0.6.0 递增到 0.7.0（协议新增记录产物和字段，非措辞微调，遵循既有 semver 习惯递增 minor 版本），新增一节「v0.7.0 变更说明（相对 v0.6.0）」，且 `roles/workflow-pb/data/workflow-pb-changelog.md` 新增对应版本条目（触发背景、具体改动，可追溯到本迭代 `0007-workflow-history-log`），`roles/workflow-pb/memory.md` 追加一条索引摘要。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 新增 `## § history.md 更新时机` 一节，与现有 `## § status.md 更新时机` 平级并列，内容引用 `workflow-pb.md` 的「历史记录协议」章节获取格式定义，本节只定义"何时写"：启动时若开启则创建；每次派发前追加「派发」；每次收到报告后追加「收到报告」；每次阶段推进核查/Gate确认/槛位释放爬升/PR失败或阻塞判定后追加「调度决策」；`history` 被显式改为关闭后停止追加、不删除已有文件。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 「Tools and capability boundaries」的"做什么"列表新增一条："若 `history` 开启，逐条维护 `history.md`"。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 「Important facts and constraints」新增一条："history.md 与 status.md 并存、格式互不侵入，history.md 记录顺序即写入顺序，不依赖序号字段"。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 「Safety」新增一条："`history` 关闭后不得继续追加 history.md，也不删除已存在的 history.md"。
- [ ] 新增文字未修改任何角色文件（`roles/<role>/<role>.md`）本身的报告契约字段定义，只在调度层新增"如何摘录"的规则；未改变 `status.md` 现有格式与维护时机中除新增 `history` 字段行之外的任何部分。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 文件头版本号从 v1.9.0 递增到 v1.10.0（对应规范 workflow-pb v0.7.0），`data/skill-optimization-v1.10.0.md` 记录触发背景与具体改动，`memory.md` 追加一条索引摘要；版本号/变更历史引用与 `workflow-pb.md` 正式规范文字不产生矛盾或遗漏。

## 参考资料

- `docs/iterations/0007-workflow-history-log/architecture.md` §决策 D1~D5、§「对 workflow-pb.md / SKILL.md 的目标改动」
- `docs/iterations/0007-workflow-history-log/prd/F01-history-md-append-only-artifact.md`
- `docs/iterations/0007-workflow-history-log/prd/F02-history-toggle-per-iteration.md`
- `docs/iterations/0007-workflow-history-log/prd/F03-three-event-types-recording.md`
- `docs/iterations/0007-workflow-history-log/prd/F04-concurrent-dispatch-order.md`
- `roles/workflow-pb/workflow-pb.md`（现有全文，尤其「文档路径协议」「状态追踪协议」「调度指南」三处章节）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（版本变更记录格式参考，v0.5.0/v0.6.0 条目）
- `.claude/skills/workflow-pb/SKILL.md`（现有全文，尤其「§ status.md 更新时机」「Tools and capability boundaries」「Important facts and constraints」「Safety」四处）
- `.claude/skills/workflow-pb/data/skill-optimization-v1.9.0.md`（记录格式参考）
- `docs/iterations/0005-pr-concurrent-execution/prs/pr-001-workflow-pb-concurrent-dispatch-protocol.md`（同类先例：同两份文件多处改动合并为一个 PR 的判断依据）

## depends_on

（无）

## batch

1
