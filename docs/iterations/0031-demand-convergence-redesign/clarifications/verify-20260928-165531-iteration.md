验证者身份：迭代级需求契约终审人——熟悉 skill-design-protocol §4.4 / §9.1.1 / §12，能分辨 role 定义写的是"反射框架"还是"换了说法的模板"，也能对 demand → workflow-pb → prd 的对接口径和 status 台账做机械核对
产出物：迭代分支 `iteration/0031-demand-convergence-redesign`（HEAD `5435c1e`）相对 `main`（`ea619ca`）的全部改动
验证标准来源：主 agent 委托内联的 A~F 六组判据；需求基石 `docs/iterations/0031-demand-convergence-redesign/demand.md`（v1.1.0）；参照 prd.md、prd/*.md、architecture.md、prs/、clarifications/、status.md、`docs/skill-design-protocol.md`
验证日期：2026-09-28
执行环境：worktree 根目录，工作区干净（`git status --short` 无输出）。结论都来自亲自读文件和执行命令，没有采信 checklist、pr-001 验收报告或 dev 自检的结论，只用它们作索引去核对原文。

## deferred-demand-changes.md

`ls docs/iterations/0031-demand-convergence-redesign/deferred-demand-changes.md` → `No such file or directory`。本迭代不存在该文件，没有要置顶摘录的内容。

## 逐项判定

### A. 需求基石衡量标准 1~5（在迭代分支 HEAD 上判）

- A-1 衡量标准 1（没有固定骨架和固定决策分类；只有反射锚点、三条硬约束和三处可见痕迹）：pass
  证据：`roles/demand/demand.md`
  - 没有固定圈序：:71 写明"圈数、每圈框定哪一项、为什么这样排，都针对本话题反射得出，本文件不给圈序；五项的列举顺序只是名称顺序，不是收敛顺序"。
  - 没有固定决策分类清单：:75~78 的三路去向按"正确答案取决于什么"判断，:79 写明"这几类依据是判断时的锚点，不是按主题分好的类……归属只能逐点反射"。
  - 三条硬约束：依赖先于被依赖（:31 C2、:71）；问题准入（:29 C1、:73）；终稿确认（:33 C3、:190~195 Gate）。
  - 三处可见痕迹：收敛路径展示（:134 Align）；"为什么这题归你"归属行（:29、:146）；每圈摘要（:163）。
  - 残留的固定结构只有两处：四段式格式块（:148~154，D-13 明确保留，仅用于归用户的题）和内部验收清单 5 项（:179~184，D-13 明确保留为内部清单）。两者都不属于收敛骨架或决策分类。
- A-2 衡量标准 2（D-13 标为删除或降级的机制不作为强制步骤出现）：pass
  证据：`grep -nE "方案雏形|深挖下限|深挖|参考视角|追问反射|维度收敛|model_inferred|六维|可验证性|轮次上限"` 只命中三处：:144 "追问反射……作为内部思考完成，不向用户展示"（降级，符合 D-13）；:165 "不设轮次上限"（D-13 保留项）；:179 "源自六维诊断，删去一项后为五项"（保留为内部清单）。"方案雏形""深挖下限""参考视角""维度收敛状态"零命中。参考视角改为 AI 直接推荐执行方向：:147 "执行方向也由 AI 推荐"。维度收敛状态由每圈摘要替代：:163。
- A-3 衡量标准 3（第二段五项；推进条件；:228 引用）：pass
  证据：`roles/demand/demand.md:96~103` 第二段"恰为五项"：需求 / 目标 / 边界 / 衡量标准 / 执行方向。`roles/workflow-pb/workflow-pb.md:52` 推进条件为"五项齐全；用户明确确认整份 demand.md（确认记录见其头部状态行）"。`:228` 括号为"（需求/目标/边界/衡量标准/执行方向）"。另外 `.claude/skills/workflow-pb/SKILL.md:130` 已同步（D-17）。
- A-4 衡量标准 4（prd 不再用旧术语，以"衡量标准"作为验收来源）：pass
  证据：`grep -nE "大概怎么做|做什么|不做什么" roles/prd/prd.md` 只命中 :128 `**做什么**：`、:133 `**不做什么**：`，两处都是 Tools 节的能力边界小标题，不是对 demand.md 的引用。验收来源：:46 "验收标准（具体可测试，以 demand.md「衡量标准」为来源）"；:60 "验收标准来自'衡量标准'"；:70、:87、:106 同口径。
- A-5 衡量标准 5（§12 checklist 逐项核查；CRITICAL ≤3 且带后果；MUST/NEVER 每节 ≤2；首尾三明治；终稿确认是独立 Gate）：pass
  证据：
  - `grep -c CRITICAL` = 3（:29 / :31 / :33），每条都以"违反……"给出具体后果。
  - `grep -nE "必须|绝不|MUST|NEVER"` 命中 :33（CRITICAL 块内）、:146、:149（四段式字段标签）、:163、:227、:228。按节计：「4. 工作」2 处（:146、:163），「原则·红线」2 处（:227、:228），其余各节 0 处，都 ≤2。
  - 三明治：首部 C1/C2/C3 ↔ 「Safety」:269（归属行）/ :270（依赖与作废）/ :271（头部状态行确认原话），一一对应。
  - 独立 Gate：:190 `### Gate：终稿整份确认`，触发条件、验证内容、通过标准、未通过处理四要素齐全。
  - §12 逐项记录：`demand-skill-checklist.md` §1 覆盖 #0、#0b、#1~#19 共 21 行。我抽查了 #3（Strategy :53 在 Workflow :117 之前）、#5（交付物节 :88 在 Workflow 之前）、#14、#16，与原文一致。#12 判为 D-16 保留项（原则内联），符合 D-16。
- A-6 衡量标准 6（用户试跑）：待用户执行，不判。

### B. deferred-demand-changes.md

- B：pass
  证据：文件不存在（见上面的 `ls` 输出）；迭代目录 `ls` 列出的只有 architecture.md、clarifications、demand-skill-checklist.md、demand.md、prd、prd.md、prs、status.md。

### C. PR 粒度与 check-pr-gates [7] 豁免

- C：pass
  证据：`status.md` 「用户裁决（2026-09-28）」表：`| PR 粒度 | 用户建议单 PR 完成 |`；`| check-pr-gates [7] | 用户原话「可以豁免」：单 PR 无并发伙伴属结构性必然，不为过工具硬拆 |`。第 10 行方案确认门还记有用户原话"这次的修改范围不大，我建议一个pr完成就行"。

### D. 改动范围

- D：pass
  证据：`git diff --name-only main` 共 32 个文件。去掉 `docs/iterations/0031-demand-convergence-redesign/` 下的文件和 `docs/demand-convergence-redesign-2026-09-28.md` 后只剩 5 个：`.claude/skills/workflow-pb/SKILL.md`、`roles/demand/data/demand-changelog.md`、`roles/demand/demand.md`、`roles/prd/prd.md`、`roles/workflow-pb/workflow-pb.md`，与 `prd/G01-scope-guard.md` 验收 1 的白名单完全相同。`git diff --stat main -- roles/ .claude/` 只列这 5 个文件，workflow-pb / prd 没有另写 changelog。

### E. 产物一致性

- E-1 status.md 与文件系统 / git 一致：partial
  - 通过的子项：
    - PR 已合并：`3ba69fb` 存在且是 merge 提交（`git log --merges main..HEAD` → `3ba69fb merge: pr-001 ... into iteration/0031`）。
    - PR 子状态"worktree 已清理"：`git worktree list` 里没有 pr-001 的 worktree；分支 `feat/0031-pr-001-demand-v1-rewrite` 仍在，与"(已清理 worktree)"只说 worktree 的表述一致。
    - 阶段 1~5 完成：阶段提交 f48791a / b661509 / 8a64c92 / 27e42d9+04dab45 / 3ba69fb+5435c1e 都在。
    - 阶段 4"已验证 ✅"：有 `verify-20260928-155755.md`、`verify-20260928-161043-rework.md`。
    - 阶段 5 "41/41 PASS"：有 `verify-20260928-164716-pr-001.md`，结论为 PASS（41 条全部 pass）。
  - 不一致的子项：
    1. `status.md:17` 阶段 1 备注写"`demand.md` v1.0.0；D-1~D-15"，但 `demand.md:3` 实际是 **v1.1.0**，决策清单到 **D-18**（:43~45）。v1.1.0 变更由提交 b661509 引入，status.md 没有同步。
    2. `status.md:22` 阶段 6 行备注写"Gate：`verify-20260928-155755.md`……`verify-20260928-161043-rework.md`"。这两份报告的委托是"阶段 4→5 入口 Gate"（见 155755 报告头部"验证标准来源"），不是阶段 6 的报告。这是记账位置错误，会把阶段 4 的验证误读为阶段 6 的进度。
    3. `status.md:5` "当前阶段: PR 实现（阶段 5）"：阶段 5 在第 21 行已标完成，本报告是阶段 6 的产物，当前阶段字段落后（这可能是阶段 6 启动前的快照，由主 agent 在收口时更新）。
- E-2 决策 D-1~D-18 在 prd / architecture / 实现中无遗漏、无违背（抽查 D-2、D-5、D-8、D-9、D-12、D-13、D-16）：pass
  证据：先查覆盖：`grep` 统计 D-1~D-18 在 prd.md + prd/*.md 中每条都至少出现 1 次（D-15 最少，1 次；方案确认门在 status.md 第 10 行也有记录）。再逐条抽查实现：
  - D-2 反射而非模板：同 A-1。
  - D-5 归属判据：:75~78 三路去向与 D-5 的三类逐一对应，含"附'为什么这题归你'"（:146）和"记开放项"（:78、:158）。
  - D-8 过程确认：:163 摘要要素包括 `ai_decided` 条目附理由，并写有"未指出即视为通过，这只适用于过程"。
  - D-9 最终确认：:33 C3、:190~195 Gate。执行方向改记 `user_confirmed`（:193），未确认时停止、不进阶段 2（:194）。
  - D-12 推进条件：workflow-pb.md:52，同 A-3。
  - D-13 旧机制：同 A-2；四段式只用于归用户的题（:146），六维改为内部 5 项清单、"可验证性"改为"衡量标准可判断达到与否"（:184），都符合 D-13。
  - D-16 编写规范：同 A-5；原则整段内联、不用 `$ref`（:224~254），frontmatter 没有编排元数据（:1~19），属于 D-16 保留的写法。

### F. 新版 demand 与 workflow-pb 阶段 1、prd 的对接

- F：pass
  证据：三处口径逐项对照：

  | 对接点 | roles/demand/demand.md | roles/workflow-pb/workflow-pb.md | roles/prd/prd.md |
  |---|---|---|---|
  | 五项名称 | :99~103 需求/目标/边界/衡量标准/执行方向 | :52、:228 同名同序 | :13 同名同序 |
  | 推进条件 | :92 头部状态行记确认原话与日期；:96 "恰为五项，因为下游推进核查按'五项齐全'判定" | :52 "五项齐全；用户明确确认整份 demand.md（确认记录见其头部状态行）"；SKILL.md:130 同口径 | —（不消费推进条件） |
  | 衡量标准的来源地位 | :102 每条可判断达到与否；:246 "能否……从「衡量标准」写出验收" | —（不消费） | :46、:60、:70、:87、:106 验收以「衡量标准」为来源；拆卡以「边界·做」为来源 |

  三处在"五项名称、确认记录位置、衡量标准是验收来源"上没有互相矛盾的表述。

## 汇总

- pass: 10 项（A-1~A-5、B、C、D、E-2、F，另有 A-6 待用户执行不计）
- fail: 0 项
- partial: 1 项（E-1：status.md 三处记账滞后或错位）
- blocked: 0 项

## 偏差记录

| 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|
| `status.md:17` 阶段 1 "demand.md v1.0.0；D-1~D-15" | demand.md 实为 v1.1.0，决策清单到 D-18 | 按实际更新 status.md |
| `status.md:22` 阶段 6 行引用 155755 / 161043-rework 两份报告为 Gate | 两份都是阶段 4→5 入口 Gate 报告，阶段 6 报告为本文件 | 把这两份报告挪到阶段 4 备注，阶段 6 行改为引用本报告 |
| `status.md:5` 当前阶段为阶段 5 | 阶段 5 已完成，已进入阶段 6 | 收口时同步当前阶段字段 |
| `roles/workflow-pb/workflow-pb.md:241`、`SKILL.md:342` 把"产物中出现 `[model_inferred]`"列为阶段 1~3 的用户决策点 | 新版 demand 不再产出 `model_inferred`（changelog v1.0.0、demand.md:108~112 三词表），该条只对阶段 2~3（prd 仍用 `[model_inferred]`，prd.md:101）有效 | 不影响本次判据（衡量标准 3 只要求 :52 和 :228）；下一迭代可把措辞收窄为"阶段 2~3 产物中出现 `[model_inferred]`"，消除阅读歧义 |
| architecture 设定 demand.md ≤250 行为设计目标（checklist 偏差说明） | 实际 273 行 | 不是验收判据，只记录 |

## 下一迭代候选

- 衡量标准 6 用户试跑（U01）：合并后由用户用一个真实需求跑一次阶段 1，确认每个问题都带归属行、都对应五项缺口，且决策压力下降。这是本迭代唯一没有验证的衡量标准。
- `tools/check-pr-gates.py` 单 PR 时 [7] 必判失败、[2] 不识别 U 类卡（status.md 遗留，已登记）。
- `roles/prd/prd.md:28` 指向的 `data/prd-changelog.md` 不存在（status.md 遗留，已登记）。
- workflow-pb 阶段 1~3 决策点的 `model_inferred` 措辞收窄（见偏差记录第 4 条）。

## 结论

PASS（0 fail；1 partial 为 status.md 记账问题，不涉及需求基石衡量标准）

注：偏差记录不影响结论判定。
