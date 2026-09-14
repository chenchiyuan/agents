# 进度快照：0022-agent-launcher-and-protocol-layer

**观测者**: progress-observer（独立核查，不采信任何角色的自我声明）
**观测时间**: 2026-09-14 16:08:51（本地）
**观测基准（一手记录）**:

- 代码库根 = `/Users/chenchiyuan/projects/agents`（共享 `.git`）；迭代工作区 = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer`（`git worktree list` 存在该条目）
- 迭代分支 HEAD = `fa2acd68fdef6bad21a63384c5186bd452d5fbb1`（`git -C <迭代工作区> rev-parse HEAD`）；main HEAD = `71d5920`
- `git merge-base main iteration/0022-agent-launcher-and-protocol-layer` = `71d5920348edffd222979819b5d554be1e7d4f78`；`git rev-list --count main..iteration/0022-...` = **9**（迭代分支领先 main 9 个提交，其中 2 个 merge 提交）
- 全部 PR worktree / 分支清单（`git worktree list --porcelain`、`git for-each-ref`）：
  - `iteration/0022-agent-launcher-and-protocol-layer` → `fa2acd6`（迭代工作区）
  - `feat/0022-pr-002-test-face-profile-pinning` → `fa2acd6`（worktree 嵌于迭代工作区内）
  - `feat/0022-pr-005-protocol-layer-and-injection-entry` → `fa2acd6`（同上）
  - 无 `feat/0022-pr-001-*`、无 `feat/0022-pr-004-*`、无任何 `pr-003` ref（`git for-each-ref | grep -i pr-003` 空）

> 本文件为覆盖式快照；历史演进不在此堆积（见 §5-4）。

---

## 1. 阶段完成状态

| 阶段 | status.md 声称 | 核实结果 | 依据（一手） |
|---|---|---|---|
| 1 需求收敛 | ✅ | **一致**（产物存在 + 版本声明相符） | `demand.md` 存在，mtime `10:59:59`，行 6 = `**版本**: v1.0.0（… 全部 user_confirmed；model_inferred 归零…）`；`git cat-file -e iteration/0022-...:docs/iterations/0022-.../demand.md` 命中（已入 git） |
| 2 功能规格 | ✅ | **一致** | `prd.md` mtime `11:14:54`，行 3 = `**版本**: 0.2.0`；`ls prd` = **13** 个文件（F01~F13）；`prd.md` 与 `prd/*` 均在迭代分支被跟踪 |
| 3 技术架构 | ✅ | **一致** | `architecture.md` mtime `15:02:49`，行 3 = `**版本**: 0.2.0（阶段 3 · 第 2 轮收口…）`；`prd/F02-…md` mtime `15:02:42` |
| 4 PR 规划 | ✅ / 已验证 ✅ | **一致** | `prs/` 下 5 个 PR 文件（`pr-001`~`pr-005`，mtime `15:24`~`15:34`）+ 2 个任务图；Gate 记录件 `clarifications/verify-stage4-gate-r2-20260914.md` 行 173 = `**PASS**（30 项判定全部 pass（partial 0 / fail 0 / blocked 0））` |
| 5 PR 实现 | ⏸（首波 2/2 已合并；次波 planner 已派发） | **与声称一致**（逐项见 §2/§3） | 两个真实双亲 merge 提交存在（§2）；合并后全量测试由本次独立复跑确认：`cd <迭代工作区>/oamp && npm test` → `# tests 335 / # pass 335 / # fail 0 / # cancelled 0 / # skipped 0 / # duration_ms 64220.219208`（Node `v22.15.0`）；首波验收报告 `clarifications/verify-pr-001-20260914.md`（行 204 `PASS`）、`clarifications/verify-pr-004-20260914.md`（行 243 `PASS`）存在，偏差表行数分别为 7（D-1~D-7）与 4（D-1~D-4），与 status.md「偏差 7 条 / 4 条」「验收 PASS 5/5 / 6/6」的口径相符（报告汇总口径分别见 `verify-pr-001:169`、`verify-pr-004:211`） |
| 6 独立验证 | —（按需触发，不计入线性进度） | **一致**（无阶段 6 级产物，亦未声称完成） | 迭代目录内无阶段 6 级独立验证报告；仅存在阶段 4 Gate 与阶段 5 PR 级验收件（属阶段 4/5 过程件） |

**阶段 1~3 的历史性问题已消除**：首轮快照（committed `a4d3e2f` 版 `progress.md`）曾记录「整个迭代目录在 git 中未跟踪、迭代分支零提交」；现一手记录 = 迭代分支上该目录共 **59** 个文件被跟踪（`git ls-tree -r --name-only iteration/0022-... -- docs/iterations/0022-.../ | wc -l`），迭代分支领先 main 9 个提交。

---

## 2. PR 依赖核实

| PR | `depends_on` 声明（来自 `prs/*.md`） | 实际合并状态（迭代分支上） | 核实结果 | 依据 |
|---|---|---|---|---|
| `pr-001-launcher-and-protocol-config.md` | （无）（行 48~50 原文「（无）」） | 无需依赖 | 依赖侧不适用；本身**已合并** | merge `2a2d979`（`git cat-file -p` parent = `e3f8a62` + `263c787`，真双亲） |
| `pr-002-test-face-profile-pinning.md` | `pr-001`（行 44，理由 = 引用 `launcher.js` 的 `PROFILES` 与 `config.js` 第 4 键 `protocol`） | **已满足** | 依赖已合并，且依赖所引符号在生产代码中确实存在 | `2a2d979` 在迭代分支上；`git show fa2acd6:oamp/src/launcher.js` 含 `export const PROFILES`（行 12）、`buildArgv`（行 106）；`git show fa2acd6:oamp/src/config.js` 含 `protocol`（行 117 / 145） |
| `pr-003-protocol-layer-and-consumption-cutover.md` | `pr-005` + `pr-002` + `pr-001`（行 79~81 三条） | **三条中 1 条满足、2 条未满足 ⇒ 依赖未满足** | 依赖未满足（阻塞为预期状态） | `pr-001` 已合并（`2a2d979`）；`pr-002` / `pr-005` **无合并提交**——迭代分支上全部 merge 提交仅两条（`git log iteration/0022-... --oneline` 中 `2a2d979`、`f1097ae`），且 `git log --oneline fa2acd6..feat/0022-pr-002-…`、`fa2acd6..feat/0022-pr-005-…` 均为空 |
| `pr-004-stream-kind-partition-ui.md` | （无）（行 36~38；行 40~42 另声明「验收时序依赖 pr-003」但明示**不进** `depends_on`） | 无需依赖 | 依赖侧不适用；本身**已合并** | merge `f1097ae`（`git cat-file -p` parent = `2a2d979` + `28acecb`，真双亲） |
| `pr-005-protocol-layer-and-injection-entry.md` | `pr-001`（行 65，理由 = 启动面 argv 出自 `launcher.js`、解析链取值出自 `config.js` 第 4 键） | **已满足** | 依赖已合并，依赖所引符号存在 | 同 `pr-002` 行：`2a2d979` 在分支上 + `launcher.js` / `config.js` 符号在场 |

**merge 提交真实性（专项核实项 1）**：两条 merge 均为**真双亲**提交，不是快进后的单亲提交——

```
$ git cat-file -p 2a2d979
tree 7d8d47025ae7eebc58199f27f19b0398e98d2c72
parent e3f8a62f56d7642a21cb0bbaf19547dbdd1a8b57
parent 263c787d641aa58db8f12273f7a4c79675d87848
merge: pr-001 launcher-and-protocol-config into iteration/0022

$ git cat-file -p f1097ae
tree 7e32dc6929b051bef160135f87ca14651652dc25
parent 2a2d979672cb58659bf794c1b8a77e983bb7c028
parent 28acecb3833f9965bb37298fe4576c0480d52970
merge: pr-004 stream-kind-partition-ui into iteration/0022
```

两条 merge 的提交时间均为 `2026-09-14 16:03:39 +0800`；`f1097ae` 的第一父 = `2a2d979`（串行合并顺序可追溯）。

**首波产物确在迭代分支上（专项核实项 2）**：

```
$ git log iteration/0022-... --oneline -- oamp/src/launcher.js
263c787 feat(0022): pr-001 L1 启动服务（profile 表 + 唯一 argv 构造 + spawn）与 config 第 4 键 protocol

$ git log iteration/0022-... --oneline -- oamp/web/app.js
28acecb feat(0022): 前端按 task_update.kind 分区渲染过程增量（F08 / T-06 · T-07）
（其后为 0021 及更早历史的同名文件提交）
```

且 `git ls-tree -r --name-only fa2acd6 -- oamp/src oamp/web` 中 `oamp/src/launcher.js` 在场；`fa2acd6:oamp/web/app.js` 含 pr-004 的新增分流（行 578~580 `thinking` / `tool_call` / `tool_output` 白名单）。

---

## 3. PR 实现状态核实

| PR | status.md 声称 | worktree | branch HEAD | 已合并 | 核实结果 |
|---|---|---|---|---|---|
| `pr-001` | ✅ 已完成（验收 PASS 5/5，偏差 7 条）/ 已合并 | **不存在**（目录已清理） | 分支**不存在**（`git branch --list '*pr-001*'` 空） | **是** → `2a2d979` | **一致**（清理与合并均有一手记录） |
| `pr-002` | ⏸ 进行中（planner 已派发）/ `feat/0022-pr-002-test-face-profile-pinning` | 存在：`…/0022-agent-launcher-and-protocol-layer/.pb-agents/worktrees/0022-pr-002-test-face-profile-pinning` | `fa2acd6`（= 依赖基线，**0 个新提交**，`git log fa2acd6..feat/0022-pr-002-…` 空） | 否 | **一致（但 git 面无进展）**：「已派发」由 branch/worktree 存在 + 进程快照（hub：`PlanPr002` running）支持；`prs/pr-002-tasks.md` **尚未落盘**（worktree 内 `prs/` 仅 7 个文件，无 `pr-002-tasks.md`） |
| `pr-003` | ⬜ / 排队（依赖未满足） | 不存在 | 无 ref | 否 | **一致**（依赖 `pr-005`/`pr-002` 未合并，见 §2） |
| `pr-004` | ✅ 已完成（验收 PASS 6/6，偏差 4 条）/ 已合并 | **不存在**（目录已清理） | 分支**不存在**（`git branch --list '*pr-004*'` 空） | **是** → `f1097ae` | **一致** |
| `pr-005` | ⏸ 进行中（planner 已派发）/ `feat/0022-pr-005-protocol-layer-and-injection-entry` | 存在：`…/0022-agent-launcher-and-protocol-layer/.pb-agents/worktrees/0022-pr-005-protocol-layer-and-injection-entry` | `fa2acd6`（**0 个新提交**） | 否 | **一致（但 git 面无进展）**：`prs/pr-005-tasks.md` **尚未落盘** |

**首波分支/工作区清理（专项核实项 3）**：`git worktree list --porcelain` 仅 4 条（主工作区 `71d5920 [main]`、迭代工作区 `fa2acd6 [iteration/…]`、两个次波 PR worktree `fa2acd6 [feat/…]`）；`git branch --list` 仅 4 条（`main`、`iteration/0022-…`、两个次波 `feat/…`）。首波 `feat/0022-pr-001-*` / `feat/0022-pr-004-*` 的 worktree 与分支**确已清理**，与 status.md「（已清理）」一致。

**次波基线（专项核实项 4）**：两个次波分支 HEAD = `fa2acd6` = 迭代分支 HEAD，且 `2a2d979`（pr-001 合并）为其祖先 ⇒ 次波 worktree **确从含 pr-001 产出的迭代分支基线开始**，与 status.md 所称「依赖已合并 ⇒ 解锁」的基准一致。

**迭代产物入 git（专项核实项 5）**：迭代分支上该目录 **59** 个文件被跟踪（含 `status.md`、`history.md`、`progress.md`、`prs/*`、`clarifications/**`、`prd/F01~F13`）。工作区内 `git status --porcelain`（含 `--untracked-files=all`）= **2 项**，均为 ` M`（`history.md`、`status.md`），**无未跟踪文件**。

---

## 4. 并发度分析

- **可并发但闲置（重点）：0 个。** 逐条核实：`pr-001` / `pr-004` 已合并（非闲置）；`pr-002` / `pr-005` 依赖已满足且**已派发**（worktree + 分支在场）；`pr-003` 依赖未满足（阻塞为预期）⇒ 不存在「依赖已满足但无 worktree / 无派发」的 PR。
- **正常并发中**：2 个（`pr-002`、`pr-005`）——分支与 worktree 存在，但两者相对基线 `fa2acd6` 均为 0 个新提交；产物侧仅「planner 已派发」的间接证据（进程快照 + 分支存在），任务图尚未落盘。
- **正常阻塞**：1 个（`pr-003`）——`depends_on` = `pr-005` + `pr-002` + `pr-001`，其中前两者未合并。
- **空闲槛位**：`当前有效上限 5` − 在飞 2 = **3 个空闲**；唯一排队 PR（`pr-003`）依赖未满足 ⇒ 属**结构性空置**（工作流规范明文：「没有已解锁且排队中的 PR 时，释放出的槛位保持空置，不触发任何派发」）。无可补位对象。
- **并发配置公式核对**：规范（`roles/workflow-pb/workflow-pb.md:465`）= `当前有效上限 = min(起始并发数 + 累计槛位释放次数 × 起始并发数, 硬上限)`，硬上限 = `2×起始-1` = 5；代入 status.md 报的 `起始 3 / 释放 2` ⇒ `min(3+2×3, 5)` = **5**，与 status.md「已触硬上限」一致（`释放次数 = 2` 的来源见 §6-3）。
- **stage 4 依赖图与实际图一致**：PR 文件 `depends_on` 汇总（`pr-001 → {pr-002, pr-005}`；`{pr-002, pr-005, pr-001} → pr-003`；`pr-004` 独立）与 status.md 依赖图文字逐项一致；`pr-004` 的 `pr-004 ⤳ pr-003` 为验收时序边、非合并前置，PR 文件行 42 已明示不入 `depends_on`。

---

## 5. 发现的不一致

1. **首波与次波 PR worktree 落点层级不同（体例差异，非状态矛盾）**：次波两个 worktree 落在**迭代工作区内部**（`…/0022-agent-launcher-and-protocol-layer/.pb-agents/worktrees/…`）；主仓库 `.pb-agents/worktrees/` 下现仅剩迭代工作区自身一个条目，首波目录已删除。现存首波报告中路径以 `...` 缩写（`clarifications/verify-pr-004-20260914.md:19` = ``PR worktree `.../.pb-agents/worktrees/0022-pr-004-stream-kind-partition-ui` ``；`verify-pr-001-20260914.md:18` 只写分支名未写路径）⇒ 首波绝对落点无法从现存记录还原本节对比（见 §6-1），本节仅登记「两波落点层级不同」这一事实。
2. **status.md / history.md 的当前版本未提交 git**：`git -C <迭代工作区> status --porcelain` = ` M docs/…/history.md` + ` M docs/…/status.md`；HEAD（`fa2acd6`）上的 `status.md` 仍是「阶段 5 · 待首波派发」旧版（`git diff HEAD -- …/status.md` 显示此两文件是本轮全部差异）。即「首波 2/2 已合并 / 次波进行中 / 并发配置 = 5」等认领内容**只存在于工作区文件**，无对应提交——其所述事实本身有一手记录支持（§2/§3），但记录载体未入库。
3. **文件 mtime 与文内自述时间不自洽（体例类，仅登记）**：`history.md` mtime = `16:05:22`、`status.md` mtime = `16:05:33`，而 `history.md` 内含标注 `16:05:30`（次波派发）的条目 ⇒ 文内时间戳为写入方自述，非文件系统时间。
4. **上一版 `progress.md`（committed `a4d3e2f` 版，12480 字节）的结论已被推翻**：该版 §5-5 声称「整个迭代目录在 git 中未跟踪」「`git rev-list --count main..iteration/0022-…` = 0」。现一手记录为：迭代分支领先 main **9** 个提交、目录内 **59** 个文件被跟踪、`git status` 无未跟踪文件。本条登记「上一版快照的该结论已不成立」；该文件在规定语义下为覆盖式快照，本次写入即替换其内容。
5. **（其余声称经核实均一致，逐条列出以免遗漏）**：`335/335 绿` = 本次独立复跑一致（§1）；「pr-001 验收 PASS 5/5 + 偏差 7 条」「pr-004 验收 PASS 6/6 + 偏差 4 条」= 报告汇总口径与偏差表行数一致（§1）；「首波 worktree/分支已清理」= 一致（§3）；「`D-4′`：`pr-004-tasks.md` 已由主 agent 补入迭代分支（`fa2acd6`）并闭合」= `git cat-file -e fa2acd6:…/prs/pr-004-tasks.md` 命中、`git show --stat fa2acd6` 含该文件（162 行新增），一致；「已派发总数 9」= `history.md` 中阶段 5 派发条目恰 9 条（`15:37:40`×2 planner、`15:45:00`×2 dev、`15:56:43`×2 verifier、`16:05:30`×2 次波 planner、`16:05:30`×1 progress-observer），一致。

---

## 6. 无法核实项

1. **首波 PR worktree 的绝对落点**：现存记录对首波路径以 `...` 缩写（`verify-pr-004:19`），分支与目录现已删除，`git worktree list` / `git for-each-ref` 无历史条目 ⇒ 无法判定首波是否与次波同层级（见 §5-1）。
2. **「次波 planner 正在推进」**：git 面**零证据**（两分支相对基线 0 提交、`pr-002-tasks.md` / `pr-005-tasks.md` 均未落盘）；仅有「worktree/branch 存在」+ 本机进程快照（hub 显示 `PlanPr002` / `PlanPr005` running）为证，二者都不是 git 一手记录。planner 是否真在写任务图、其内部进度如何，无法从 git 核实。
3. **并发配置的计数值**（`累计槛位释放次数 = 2`、`已派发总数 = 9`）：公式与 `history.md` 条目数可核（2 次合并各计 1 次释放；阶段 5 派发条目 9 条），但 `history.md` 本身是角色自述的追踪文件且未提交，非独立信道；除此之外无 git 一手记录可交叉验证。
4. **用户裁决的真实性**（阶段 1/2/3 的 `user_confirmed`、阶段 5 首波 7 项 `[model_inferred]` 裁决、approval 覆写面归属裁定）：唯一一手记录是 `clarifications/*-verdicts.md`（如 `2026-09-14-stage5-wave1-verdicts.md`，mtime `15:45`，文内自述「主 agent 阻塞式取得」）；产物侧（`demand.md` / `prd.md` / `architecture.md`）对裁决的引用属二次转述，不能作为独立证据。
5. **首波验收 PASS 的实质正确性**：本次只核实了报告件存在、结论行、汇总计数与偏差表条数（`verify-pr-001`：委托 5 条 / PR 验收 13 条 / T1~T6 6 条；`verify-pr-004`：委托 6 条 / PR 验收 6 条 / T1 7 条 / T2 9 条 / T3 8 条），**未独立复算**各条判据内容——重新判定属 verifier 职责面，不在本角色范围。
6. **「合并当时」的测试绿色**：本次复跑的事实是「当前迭代工作区（代码面 = `fa2acd6` 树）全量 `335 pass / 0 fail`」；合并时点（`16:03:39`）的绿色无 CI 记录可回放。另，各 PR 分支时点的分项结论（如 `verify-pr-001` 的 `14/14`、`verify-pr-004` 的 `74/74`）未逐 PR 重放。
7. **阶段 6（独立验证）状态**：status.md 标「—（按需触发）」，迭代目录内无阶段 6 级产物 ⇒ 无对象可核（既未声称完成，也无从核实是否应触发）。
8. **`history.md` / `status.md` 之外的角色自述事实**：如「已 stop 全部验证进程」「浏览器会话已关闭」等过程性陈述，均无 git 或文件级一手记录，本报告不予采信也不展开。

---

> 本报告为唯一写入；核查全程仅执行只读 git 命令（`log` / `cat-file` / `ls-tree` / `ls-files` / `rev-parse` / `merge-base` / `rev-list` / `worktree list` / `branch --list` / `for-each-ref` / `status` / `show` / `diff`）。未修改 `status.md`、`prs/*.md`、代码或任何其它产物；未执行任何写入性 git 命令。
