# progress.md — 0026-test-protocol-and-suite-reset

**观测角色**: progress-observer（独立核实，不采信任何自我声明）
**快照时刻**: 2026-09-15 18:25:32 +0800（文件系统与 git 一手记录，本文件整体覆盖，不承载历史）
**核实基准**: 迭代分支 `iteration/0026-test-protocol-and-suite-reset`（**非 `main`**）
**快照锚点**:

| ref | commit | 说明 |
|---|---|---|
| `iteration/0026-test-protocol-and-suite-reset` | `58210bf` | 迭代分支实际 tip（快照时刻）；`git worktree list --porcelain` 与 `git log` 一致 |
| `main` | `ea8943e` | 与 status.md 声明的 base 一致；`git merge-base <迭代分支> main` = `ea8943e` |
| fork 点 | `bffc336` | 三个 PR 分支与迭代分支的共同祖先（`git merge-base <迭代分支> <PR 分支>` 对 pr-001 / pr-003 均为 `bffc336`） |
| `feat/0026-pr-001-test-assets-zeroing` | `f4dc4b8` | |
| `feat/0026-pr-002-stage5-output-contract-drop-tests` | `2e3b700` | |
| `feat/0026-pr-003-impact-surface-registration` | `f98c985` | |

---

## 阶段完成状态

| 阶段 | status.md 声称 | 核实结果 | 依据 |
|---|---|---|---|
| 1 需求收敛 | ✅ / 已验证 ✅ | 一致（产物存在）；"已验证"的独立性见 §6-2 | `docs/iterations/0026-test-protocol-and-suite-reset/demand.md` 存在于迭代目录（mtime 2026-09-15 18:10:45），迭代分支内可 `git show <迭代分支>:...demand.md` 取出 |
| 2 功能规格 | ✅ / 已验证 ⬜ | 一致 | `prd.md` 存在（mtime 18:10:11）；`prd/` 下 3 个卡文件：`F01-test-assets-zeroing.md`、`F02-stage5-output-contract-drop-tests.md`、`F09-impact-surface-registration.md`。声称"0 条 `[架构待填]`"经 `grep -rc "架构待填" prd/ prd.md` 核实：`prd/*` 三卡均 0，`prd.md` 3 处全在 §`架构待填汇总（交阶段 3）` 标题与"本迭代无架构待填项"的否定句内 |
| 3 技术架构 | ✅ / 已验证 ⬜ | 一致 | `architecture.md` 存在（mtime 18:09:14）；其 §2.2 明写「本迭代 L1 = 无、L2 = 无、L3 = 无」，与 status.md 声称的「L1 = 无、L2 = 无」一致（status.md 未提 L3，未构成冲突） |
| 4 PR 规划 | ✅ / 已验证 ⬜ | 一致 | `prs/` 下 4 个文件，其中 3 个为 PR 文件（`pr-001-test-assets-zeroing.md` / `pr-002-stage5-output-contract-drop-tests.md` / `pr-003-impact-surface-registration.md`），第 4 个 `pr-002-tasks.md` 是阶段 5 的 planner 产物而非 PR 文件 |
| 5 PR 实现 | ⏸ / **1/3 已合并** | 数量一致；**两处分支 tip 与状态描述漂移**（见 §5-1/2/3） | `git branch --merged <迭代分支>` 只命中 `feat/0026-pr-002-...`；`git merge-base --is-ancestor feat/0026-pr-001-... <迭代分支>` = 假、pr-003 同为假、pr-002 为真；迭代分支 `bffc336..58210bf` 的改动面不含 `oamp/**` 与 `docs/iteration-time-analysis.md` ⇒ pr-001 / pr-003 的实现确实未进迭代分支 |
| 6 独立验证 | — / 按需触发 | 一致 | 迭代目录 `clarifications/` 下只有 1 份 verify 报告 `verify-pr-002-20260915-182252.md`（PR 级，非阶段级），其结论行 `# PASS`、「22 项判定全部 pass；fail = 0，partial = 0，blocked = 0」；无阶段 1~4 的阶段级 verify 报告 |

---

## PR 依赖核实

三个 PR 文件的 `depends_on` 段**全部为「（无）」**（逐文件读取 `## depends_on` 段核实），故不存在"声明依赖某个 PR"的条目可直接对照合并状态。

| PR | depends_on 声明 | 实际合并状态 | 依据 |
|---|---|---|---|
| `pr-001-test-assets-zeroing.md` | （无） | 无可核实依赖；自身**未合并** | 文件 `## depends_on` 段为「（无）」；`git merge-base --is-ancestor feat/0026-pr-001-test-assets-zeroing <迭代分支>` 返回非零 |
| `pr-002-stage5-output-contract-drop-tests.md` | （无） | 无可核实依赖；自身**已合并** | 文件 `## depends_on` 段为「（无）」；`git merge-base <迭代分支> feat/0026-pr-002-...` = `2e3b700` = 该分支 tip（即已被完全包含）；合并提交 `b3022be` 存在于迭代分支 `git log --merges` 中 |
| `pr-003-impact-surface-registration.md` | （无），但附「依赖判定依据」段，显式声明与 pr-001 / pr-002 之间存在「**判据读取边**」并归属给 pr-001 / pr-002 自身验收 + 阶段 6 | 无可核实依赖；自身**未合并**；其"读取边"目标的实际状态：**pr-002 已合并 ✔ / pr-001 未合并 ✘** | 文件 `## depends_on` 段为「（无）」+「依赖判定依据」段；两侧状态依据同上两行的 git 命令 |

**依赖边结论**：三个 PR 在 git 层面互不可达（merge-base 均为 fork 点 `bffc336`），依赖图确为三个孤立节点；status.md「无新解锁发生」的判断与 git 事实一致（无任何依赖边可供解锁）。

---

## PR 实现状态核实

worktree 落点均为 `<迭代工作区>/.pb-agents/worktrees/0026-pr-{NNN}-{slug}`，`git worktree list --porcelain` 中三个条目**全部在册**（含已合并的 pr-002）。三个 worktree 的 `git status --porcelain` **均为空**（无未提交改动、无未跟踪文件）。

| PR | status.md 声称 | worktree | branch HEAD（实核） | 已合并 | 核实结果 |
|---|---|---|---|---|---|
| pr-001-test-assets-zeroing | ⏸ dev 进行中；分支 tip `` `97b5c63` `` | 存在、干净 | **`f4dc4b8`** | 否 | **不一致**：实际 tip 比 status.md 记录**前移 1 个 commit**（`f4dc4b8`，18:23:52 实现提交），其后还有 history.md 记录的 dev 报告（见 §5-2） |
| pr-002-stage5-output-contract-drop-tests | ✅ 已合并；`` `b3022be` ``；分支 `` `2e3b700` `` | 存在、干净（合并后未清理） | `2e3b700` | **是** | 一致：分支 tip 与 status.md 记录逐字相符；合并提交 `b3022be`、归档提交 `2e3b700` 均在迭代分支上 |
| pr-003-impact-surface-registration | ⏸ dev 进行中；分支 tip `` `8440605` `` | 存在、干净 | **`f98c985`** | 否 | **不一致**：实际 tip 比 status.md 记录**前移 1 个 commit**（`f98c985`，18:24:29 F09 加注提交） |

**改动面事实（`git diff --name-status bffc336..<PR tip>`，仅记录事实，不做质量判断）**：

- pr-001：38 条路径 = 34 × `D oamp/test/**`（含 `helpers/harness.js`、`helpers/fake-node.js`）+ 1 × `D oamp/scripts/testenv.mjs` + 1 × `M oamp/package.json` + 1 × `M oamp/README.md` + 1 × `A docs/.../prs/pr-001-tasks.md`（阶段 5 planner 产物，按 18:24 判据口径 2 不计入判据面 ⇒ 代码面 37 条路径）。`oamp/src`、`oamp/web`、`oamp/bin` 零路径命中。
- pr-002：3 条路径 = `M roles/workflow-pb/workflow-pb.md` + `A prs/pr-002-tasks.md` + `A clarifications/verify-pr-002-20260915-182252.md`。
- pr-003：2 条路径 = `M docs/iteration-time-analysis.md` + `A prs/pr-003-tasks.md`；该 PR 分支上 `docs/iteration-time-analysis.md:236` 行尾已含括注「（0026 加注：本结论已失效——0026 迭代（F01）清洗 `oamp/test/`，该全量套件不再存在。）」，原句数值与引用在场。
- 迭代分支 `bffc336..58210bf` 的改动面：`roles/workflow-pb/workflow-pb.md`（M）、`prs/pr-003-impact-surface-registration.md`（M）、`prs/pr-002-tasks.md`（A）、`clarifications/verify-pr-002-*.md`（A）、`history.md`（M）、`status.md`（M）——**不含 `oamp/**`，不含 `docs/iteration-time-analysis.md`**。

**阶段 5 产物落点核实**：`prs/pr-002-tasks.md` 已在迭代分支上（随 `2e3b700` 归档）；`prs/pr-001-tasks.md` 与 `prs/pr-003-tasks.md` **只存在于各自 PR 分支，不在迭代分支**（因两个 PR 未合并）。

**主工作区越界写入事件的独立核实（不采信 history.md 自述）**：

- `git -C /Users/chenchiyuan/projects/agents status --porcelain -- oamp/` → **空**；`git diff --stat -- oamp/` → **空** ⇒ history.md 18:31 条目所称"误写主工作区的 `oamp/package.json` 与 `oamp/README.md` 已复原"与 git 一手记录**一致**。
- 主工作区当前未提交改动为 4 条：`M roles/demand/demand.md`、`M roles/demand/data/demand-changelog.md`、`M roles/pr-planner/pr-planner.md`、`?? roles/pr-planner/data/pr-planner-changelog.md`；其 mtime 实测为 15:32:50 / 16:01:19 / 15:58:32 / 15:58:17，**均早于本迭代开工时刻**（status.md 记录工作区建立于 `ea8943e`，迭代目录首产物 17:22 前后）⇒ 与 history.md 所称"属用户自己的未提交工作、与本迭代无关"一致；`oamp/` 面零命中。

---

## 并发度分析

- **依赖图**：三节点零边（三个 PR 的 `depends_on` 全为「（无）」，merge-base 均为 `bffc336`）⇒ 三个 PR 在阶段 5 起点即全部解锁，**不存在被依赖阻塞的 PR**。
- **worktree 时间窗口重叠（并发确实发生过的证据）**：三个 PR worktree 注册目录 birth time 为 `2026-09-15 18:15:34`（pr-001）/ `18:15:35`（pr-002）/ `18:15:35`（pr-003），三者均在 `.git/worktrees/` 中**至今在册**；三支分支的首个提交时间分别为 18:19:15（`9abdba6`）/ 18:19:57（`cff511d`）/ 18:23:03（`8440605`）⇒ 三个 PR 的现场在磁盘上同时存在，时间窗口重叠成立。
- **正常并发中（依赖已满足、worktree 在册、分支有新提交）**：pr-001（`f4dc4b8`，3 commits since fork，工作树干净）、pr-003（`f98c985`，2 commits since fork，工作树干净）。执行中 PR 数 = 2。
- **已合并但现场仍占位**：pr-002（worktree 与分支均在册，worktree HEAD = `2e3b700`，工作树干净）。status.md 该行「槛位状态：已释放」描述的是**槛位**语义，与实际 worktree 是否清理是两件不同的事，二者不冲突。
- **可并发但闲置：无**。3/3 个 PR 都已有 worktree 且各至少 1 个提交，`prs/` 下无第 4 个 PR 文件 ⇒ 不存在"依赖已满足但无现场/无进展"的闲置 PR；status.md「已解锁且排队中：无（3 个 PR 已全部派发）」与 worktree 实况（恰好 3 个 0026 PR worktree）一致。
- **槛位算术核对**：执行中 2 + 排队 0，有效上限 5 未成为派发约束；status.md 的 `min(3 + 1×3, 5) = 5` 与 `roles/workflow-pb/workflow-pb.md:190` 的爬升公式（起始 3、硬上限 `2×3-1=5`）**逐项相符**；「无排队 PR ⇒ 释放出的槛位保持空置」与该规范 `:191` 的强制条款一致。

---

## 发现的不一致

1. **status.md 头「迭代分支 tip `b3022be`」vs 实际 tip `58210bf`**：写入该行的提交 `40dd1cf`（18:24:33）本身即让分支前移（`40dd1cf` = `b3022be` + 1），其后又有 `58210bf`（18:25:00，记录 pr-001 dev 报告）⇒ 该声明在写下的一刻即已过期，当前落后 2 个 docs commit。
2. **status.md pr-001 行「⏸ dev 进行中」+「tip `97b5c63`」vs 实际**：分支 tip 已前移到 `f4dc4b8`（18:23:52，实现提交，落在 status.md 落笔时刻 18:23:53 之前 1 秒）；`history.md` 中已有「2026-09-15 18:31:00 · 收到报告 · dev（pr-001）」条目（含 37 路径逐条 PASS 的自述与一起越界写入事件）⇒ status.md 的 PR 子状态表**未同步 pr-001 的实现提交与 dev 报告**。
3. **status.md pr-003 行「tip `8440605`」vs 实际 `f98c985`**：`f98c985`（18:24:29，F09 加注提交）晚于 `8440605`（18:23:03，任务图提交）⇒ status.md 记录的是任务图提交，实现提交未登记；该行「dev 进行中」的**状态描述本身未被 git 记录反驳**（详 §6-1）。
4. **history.md 条目时间超前于承载它的提交时间**：`git show 40dd1cf -- <history.md>` 显示提交（18:24:33）新增的条目头为 `18:26:00` / `18:28:00` / `18:29:00`；`git show 58210bf -- <history.md>` 显示提交（18:25:00）新增的条目头为 `18:31:00` ⇒ 共 4 条条目的声明时刻晚于其落盘提交时刻（最大超前 6 分钟）。两处均为 docs 提交，不影响任何代码面。

（除上述 4 条外，status.md 其余可核实的声明——阶段 1~4 产物存在性、阶段 5 "1/3 已合并"、pr-002 的合并状态、并发配置的输入事实与公式、pr-003 的 `depends_on` 口径、主工作区 `oamp/` 复原声明——均与 git 一手记录一致。）

---

## 无法核实项

1. **pr-001 / pr-003 的 dev 是否仍在执行**：两者分支 tip 之后无新提交、worktree `git status --porcelain` 为空 ⇒ git 面无法区分「dev 已产出实现、等待验收」与「dev 仍在工具调用中」。进程侧可见两者仍为运行态，但那属主 agent 的调度状态，不是 git 一手记录，故不作结论。
2. **阶段 1「已验证 ✅」的独立性**：迭代目录 `clarifications/` 下无任何阶段级 verify 报告（唯一 verify 报告是 PR 级的 pr-002），该标记的全部依据是 `history.md:5` / `:12` 记录的主 agent 内联判定（"推进条件核查通过"→"交付确认通过，标记『已验证』"）。可核实的是"该判定被记录过"，**不可核实**的是"存在一次独立于阶段 1 执行者的验证"。
3. **pr-001 dev 自述的判据全 PASS**：本次只核实了该 PR 的改动面路径计数（37 条代码面路径 / 38 条含 tasks 图）与目录面零命中，**未重放**其 7 条验收标准与 T5 判据 1~8（属 verifier 职责，非本角色核实范围）。
4. **status.md 并发配置区块各字段值**（起始 3 / 硬上限 5 / 有效上限 5 / 累计释放 1）不是 git 可核实对象；本次只核对了其输入事实（1 个 PR 已合并、已派发 3、执行中 2）及公式与 `workflow-pb.md:190` 的一致性，字段值本身取自 status.md 自述。
5. **pr-003「判据读取边」的最终生效性**：该 PR 文件自行声明其跨 PR 判据归阶段 6，本次未展开代码级/文本级生效核实（其"读取边"指向的 pr-001 文件面当前未合并进迭代分支，`oamp/package.json`、`oamp/README.md` 在迭代分支上仍是原状——此为可核实事实，列此仅为登记，不对其后果作判断）。
6. **阶段 6 是否触发**：迭代目录内无阶段 6 产物，status.md 该阶段标为「—/按需触发」，无可核实记录。
