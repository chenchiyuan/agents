# pr-001：demand v1.0.0 减法重写 + workflow-pb / prd / SKILL.md 对接最小同步（F01~F13 / G01）

## 上下文摘要

把 `roles/demand/demand.md` 从 v0.7.0（367 行）按 architecture.md §3 骨架重写为 v1.0.0（目标 ≤250 行）。核心是三个反射锚点（收敛路径 / 问题准入 / 决策归属+可逆性）、三条 CRITICAL（C1 准入+归属 / C2 依赖先于被依赖 / C3 终稿确认），在 Safety 里各有尾部验证形式；终稿确认做成独立 Gate；来源标记用三词表，不再使用 `model_inferred`；D-13 和 §3.7 列出的旧机制，在正文里连名字都不出现。同一 PR 还按 §7 / §8 的逐字措辞同步 workflow-pb :52 / :228、SKILL.md :130 和 prd.md 九处，并写 demand-changelog v1.0.0 条目（带「联动修改」小节）和 §12 核查记录。workflow-pb、prd 不升版本（A-04 方案 A）。用户裁决：单 PR。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F12
- F13
- G01
- U01（只引用，不作为本 PR 的通过判据：合并后由用户执行，见 prd/U01 卡的「性质」；本 PR 只负责让它的前置条件「新版 demand.md 已存在」在合并后成立）

## 文件范围

- `roles/demand/demand.md`（按 architecture.md §3.1 骨架整篇重写 v0.7.0 → v1.0.0 [F01~F09 / F12]）
- `roles/demand/data/demand-changelog.md`（只在最上方新增 v1.0.0 条目，四要素 +「联动修改」小节 + 指向核查记录的一句指针；既有条目不动 [F09 / A-04 / §9]）
- `roles/workflow-pb/workflow-pb.md`（只改 :52「输出」「推进条件」两列、:228 括号内容；不升版本 [F10 / A-05]）
- `.claude/skills/workflow-pb/SKILL.md`（只改 :130 示例括号；版本行与 description 不动 [F13 / A-05]）
- `roles/prd/prd.md`（按 §8 表替换 :13~14 / :20 / :46 / :47 / :60 / :70 / :87 / :91 / :106；:128 / :133 小节标题不动；不升版本 [F11 / A-06]）
- `docs/iterations/0031-demand-convergence-redesign/demand-skill-checklist.md`（新建：§12 #0~#19 + #0b 逐项核查表，外加约束词按节计数表 [F12 / A-07 §9]）

## 验收标准

以下命令都在工作区根目录执行，`D=roles/demand/demand.md`。计数类判据以命令输出为准；"通读"类判据要落到具体节名，并在核查记录里写明。

**衡量标准 1：无固定骨架 / 分类清单；三条硬约束；三处可见痕迹（F01 / F02 / F03 / F05 / F06）**

- [ ] `grep -c 'CRITICAL' $D` = 3，且 `grep -c '^\*\*CRITICAL: .*——.*\*\*$' $D` = 3（全文恰 3 处，每处独立加粗成段，形如 `**CRITICAL: {规则}——{后果}**`）；三条分别对应 C1 问题准入+归属 / C2 依赖先于被依赖 / C3 终稿整份确认（architecture §3.2）[F12-3；F02-1/2；F01-2；F06-5]
- [ ] Safety 节（`## Safety` 之后）对 C1 / C2 / C3 各有一条回看式验证句，可以一一指认 [F12-5]
- [ ] Strategy 节写有收敛路径锚点，明说"五项的列举顺序只是名称顺序，不是收敛顺序"：`grep -c '名称顺序' $D` ≥ 1 [F01-2/3/5]
- [ ] 反向：全文没有强制圈序表述（如"第 1 圈必须""先需求→再目标"）：`grep -nE '第 ?[1一] ?圈(必须|先)|先需求.{0,4}再目标' $D` 无输出 [F01-3]
- [ ] Workflow「2. 目标对齐」要求向用户展示收敛路径，三要素齐（圈数 / 每圈框定哪一项 / 为什么这样排）；「3. 计划」写明上游被推翻 → 重反射，并标出作废的下游结论：`grep -c '作废' $D` ≥ 2 [F01-1/4]
- [ ] Strategy 首句是目标锚点"让五项更明确"：`grep -c '让五项更明确' $D` ≥ 1 [F02-3]
- [ ] 决策归属锚点写全三种去向判据（问用户 / AI 定进摘要 / 留给下游记 `open`），并写有"依据是判断锚点，不是按主题分好的类"；反向：没有"某类决策一律问用户 / 一律 AI 定"：`grep -nE '一律(问用户|由 ?AI|AI 定)' $D` 无输出 [F03-1/2/6]
- [ ] 可逆性写成归属的第二把尺（越可逆越偏 AI 定，目标 / 边界这类改回代价大的才问用户）：`grep -c '可逆' $D` ≥ 1 [F03-4]
- [ ] 抛给用户的问题要带"归属行"（补五项中哪一项 + 为什么这题归你）：`grep -c '为什么这题归你' $D` ≥ 2（C1 与 Work / 成功标准各一处）；四段式写明只用于归用户的题 [F02-4；F03-3/5]
- [ ] Work 每圈收口必出摘要，摘要要素为：本圈框定了什么 / 本圈 `ai_decided` 各附理由 / 新增开放项 / 作废下游 / "未指出即视为通过，只适用于过程"：`grep -c '未指出即' $D` ≥ 2（Work 摘要与 Gate 各一处，互相对照）[F05-1/2/3/5；F06 QA]
- [ ] 独立 `### Gate：终稿整份确认` 节存在，位于「6. 修复」与「7. 交付」之间，四要素齐全：`grep -n '^### ' $D` 的输出顺序为 `6. 修复` → `Gate：终稿整份确认` → `7. 交付`；Gate 节内 `**触发条件**` `**验证内容**` `**通过标准**` `**未通过处理**` 各出现 1 次 [F06-1~4；F12-6]
- [ ] C3 / Gate 写明：没有明确确认就不交付、不进入阶段 2，确认原话与日期写进 demand.md 头部状态行；执行方向确认后改记 `user_confirmed`：`grep -c '头部状态行' $D` ≥ 2 [F06-1~4]

**衡量标准 2：D-13 删除 / 降级项不作为强制步骤（F08）**

- [ ] 反向检索被删机制名，正文零命中：`grep -nE '方案雏形|深挖下限|参考视角|维度收敛状态|深挖中-第|维度粒度自检|决策关键度|model_inferred' $D` 无输出 [F08 第 1~5 行；F05-4；A-03]
- [ ] 保留项可检索：`grep -c '六维诊断' $D` ≥ 1（写作内部验收清单，五项中没有"方案雏形"，"可验证性"改为"衡量标准可判断达到与否"）；四段式在 Work·Action 中；写有"不设轮次上限"（`grep -c '轮次上限' $D` ≥ 1）；frontmatter `role:` 段在，`identity` 与 v0.7.0 逐字一致（`git diff main -- $D` 的 identity 块没有增删行）[F08 第 6~9 行]
- [ ] 追问反射写在 Work·Thought，作为内部思考，不要求展示 [F08 第 4 行]

**衡量标准 3：第二段五项；workflow-pb 阶段 1 推进条件与 :228（F07 / F10）**

- [ ] 「交付物结构与来源标记」一节在 Workflow 之前（`grep -n '^## ' $D` 中它排在 `## Workflow` 之前），定义两段结构，第二段恰为五项，依次为 需求 / 目标 / 边界 / 衡量标准 / 执行方向；写明"执行方向写到方向为止"；来源标记三词表 `user_confirmed` / `ai_decided` / `open` 只在这一节定义；给出失败归因的回溯读法，不单独设"失败归因"节：`grep -nE '^#+ .*失败归因' $D` 无输出 [F07-1/3/4/5/6；A-03]
- [ ] 反向：旧五问不再作为交付物或草稿结构：`grep -nE '大概怎么做|达到什么效果' $D` 无输出 [F07-2；F04-2]
- [ ] 原则·红线恰 2 条（来源标记如实 / 执行方向不下沉技术选型）[F07-3]
- [ ] `sed -n 52p roles/workflow-pb/workflow-pb.md` 含 `第二段为五项：需求/目标/边界/衡量标准/执行方向` 与 `五项齐全；用户明确确认整份 demand.md（确认记录见其头部状态行）`，不含 `model_inferred`、`无活跃冲突` [F10-1/2]
- [ ] `grep -c '（需求/目标/边界/衡量标准/执行方向）？' roles/workflow-pb/workflow-pb.md` = 1；`grep -c '大概怎么做' roles/workflow-pb/workflow-pb.md` = 0 [F10-3]
- [ ] `git diff main -- roles/workflow-pb/workflow-pb.md` 只改动 :52、:228 两行（`git diff main --numstat -- roles/workflow-pb/workflow-pb.md` 为 `2 2`）；版本行不变 [F10-4；A-04]

**衡量标准 4：prd 无旧术语，衡量标准为验收来源（F11）**

- [ ] `grep -nE '大概怎么做|达到什么效果' roles/prd/prd.md` 无输出；`grep -n '"做什么"' roles/prd/prd.md` 无输出（:128 / :133 的 `**做什么**：` `**不做什么**：` 小节标题不带引号，不算）[F11-1]
- [ ] `grep -c '边界·做' roles/prd/prd.md` ≥ 5；`grep -c '需求/目标/边界/衡量标准/执行方向' roles/prd/prd.md` ≥ 1 [F11-2]
- [ ] `grep -n '以 demand.md「衡量标准」为来源' roles/prd/prd.md` 有输出（:46 附近）[F11-3]
- [ ] `grep -n '"执行方向"是方向，不是验收标准' roles/prd/prd.md` 有输出（:60 附近）[F11-4]
- [ ] `git diff main -- roles/prd/prd.md` 的改动行只落在 §8 表列出的九处；CRITICAL 清单、identity、报告契约、红线、`**版本**: 0.1.0` 都不变 [F11-5；A-04]

**衡量标准 5：§12 checklist 逐项核查（F12）**

- [ ] `demand-skill-checklist.md` 存在，§12 #0~#19 与 #0b 共 21 行逐项给结论，结论只取 通过 / 不适用 / D-16 保留项；"不适用""D-16 保留项"每行都附理由；`grep -c '基本通过' docs/iterations/0031-demand-convergence-redesign/demand-skill-checklist.md` = 0 [F12-1]
- [ ] #12 判为 D-16 保留项；附注写明"编排元数据""流程层"两处涉及时不判红（MI-12）[F12-2]
- [ ] 核查记录里有一张约束词按节计数表：`##` 与 `###` 两级各节中，加粗或独立成句的 必须 / 绝不 / MUST / NEVER 都 ≤2（口径 MI-13），并与 architecture §3.1 预算列逐节对得上 [F12-4]

**F04 / F09 / F13**

- [ ] Workflow「2. 目标对齐」写明 AI 先写出五项实时草稿 v0（全部由 AI 执笔，不留空项让用户填）；Work·Action 写明 AI 改写草稿并给推荐；草稿随每圈持续更新 [F04-1~4]
- [ ] `grep -n '^\*\*版本\*\*: 1.0.0' $D` 有输出 [F09-1]
- [ ] frontmatter `description` 与 architecture §3.4 口径一致，不含旧流程词：`sed -n 3p $D | grep -cE '草稿\+角色反射|同维度深挖|提案确认'` = 0 [F09-5]
- [ ] `grep -n '^## v' roles/demand/data/demand-changelog.md | head -1` 为 `## v1.0.0`；该条目含 `**需求**` `**变更原因**` `**决策过程**` `**经验总结**` 四要素和「联动修改」小节（逐条列出 workflow-pb :52 / :228、SKILL.md :130、prd.md 各处）；`git diff main -- roles/demand/data/demand-changelog.md` 只有新增行，删除行为 0 [F09-2/3/4]
- [ ] `grep -c '两段均非空' .claude/skills/workflow-pb/SKILL.md` = 0，且 `grep -c 'demand.md 五项齐全，且头部状态行记有用户对整份文档的明确确认' .claude/skills/workflow-pb/SKILL.md` = 1；`git diff main --numstat -- .claude/skills/workflow-pb/SKILL.md` 为 `1 1` [F13-1/2/3]

**G01 范围守卫**

- [ ] `git diff --name-only main... -- roles/ .claude/` 的输出 ⊆ { `roles/demand/demand.md`, `roles/demand/data/demand-changelog.md`, `roles/workflow-pb/workflow-pb.md`, `roles/prd/prd.md`, `.claude/skills/workflow-pb/SKILL.md` }（按 G01 边界，各角色 `roles/*/data/` 下的决策记录不计入）[G01-1/3]
- [ ] `git diff --name-only main... | grep -c 'pb-v1-talk'` = 0 [G01-2]
- [ ] 以本 PR 起点提交为基线，`git diff 8a64c92 -- docs/iterations/0031-demand-convergence-redesign/demand.md` 无输出 [G01-4]

## 参考资料

- `docs/iterations/0031-demand-convergence-redesign/architecture.md`：§3.1（骨架 + 约束词预算）、§3.2（CRITICAL 原文 + 尾部验证）、§3.3（Gate 四要素原文）、§3.4（frontmatter 口径）、§3.5（成功标准 7 条）、§3.6（措辞内核）、§3.7（连带处置表）、§4（可见痕迹要素）、§5（三词表）、§6（A-04 方案 A）、§7（workflow-pb / SKILL.md 逐字措辞）、§8（prd.md 九处逐字措辞）、§9（核查记录格式 + #0~#19 预判）、§11（渐进写法与阶段 5 自检顺序）
- `docs/iterations/0031-demand-convergence-redesign/prd.md`（索引 + 覆盖关系）与 `prd/F01`~`F13`、`G01`、`U01` 各卡
- `docs/iterations/0031-demand-convergence-redesign/demand.md`（只读：衡量标准 1~6、D-1~D-18）
- `docs/skill-design-protocol.md` §4.4 / §9.1.1 / §12（只读）
- 基线锚点（迭代分支 @ 8a64c92；此时 `roles/` 与 `.claude/` 相对 main 无差异）：`roles/demand/demand.md:27`（版本 0.7.0）、`:33/:35/:37`（旧 CRITICAL ×3）、`:113~:295`（Workflow 1~8）、`:320`（红线）、`:363`（Safety）；`roles/demand/data/demand-changelog.md:11`（最新条目 v0.7.0，四要素体例参照）；`roles/workflow-pb/workflow-pb.md:52` / `:228`；`.claude/skills/workflow-pb/SKILL.md:130`；`roles/prd/prd.md:13~14` / `:20` / `:46` / `:47` / `:60` / `:70` / `:87` / `:91` / `:106`（替换点）、`:128` / `:133`（不动）

## depends_on

（无）

## batch

1
