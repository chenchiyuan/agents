# progress.md — 0018-chat-agent-subagent-protocol

**观测者**: progress-observer（独立观测；不采信 status.md 与任何角色报告，结论一律回溯 git 一手记录）
**观测时点**: 2026-09-13 00:59:24 ~ 01:00:56 +0800（`date "+%F %T %z"` 三次实测：00:59:24 / 01:00:09 / 01:00:56）
**核实基准**: 迭代分支 `iteration/0018-chat-agent-subagent-protocol`（合并/解锁一律以该分支为准，不以 main 为准）
**会话工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol`
**本次观测的 git 现场锚点**:

| 项 | 值 | 核实命令 |
|---|---|---|
| 会话工作区 HEAD 分支 | `iteration/0018-chat-agent-subagent-protocol` | `git -C <W18> branch --show-current` / `git worktree list`（该行 `9f42255 [iteration/0018-chat-agent-subagent-protocol]`） |
| 迭代分支 tip（观测终点） | `9f42255`「docs(0018): pr-004 合并台账」（committer 2026-09-13 00:58:20 +0800） | `git log -1 --format="%h %cI %s"` |
| 迭代分支 tip 与任务简报 | 简报称「tip 约 `9f42255`」→ **一致（逐字命中）** | 同上 |
| 迭代分支上 0018 PR 合并提交 | `b92ad82`(pr-001) / `95051b0`(pr-002) / `7e351fa`(pr-003) / `3a8f0d3`(pr-004)；**无第五条** | `git log iteration/0018-chat-agent-subagent-protocol --merges --format="%h %cI %s" \| grep "feat/0018-pr"` |
| pr-005 分支 tip | `8e4fa86`「test(0018/pr-005): 调用面端到端验收测试…」（00:47:06）；相对分叉点**领先 2**，相对迭代 tip**落后 9 / 领先 2** | `git log feat/0018-pr-005-call-protocol-acceptance-tests --oneline <merge-base>..`；`git rev-list --left-right --count iteration/…...feat/0018-pr-005-…` → `9	2` |
| pr-005 分支分叉点（merge-base） | `7e351fa`（= pr-003 合并提交）；`3a8f0d3`（pr-004 合并）**不是**其祖先 | `git merge-base feat/0018-pr-005-… iteration/…`；`git merge-base --is-ancestor 3a8f0d3 feat/0018-pr-005-…` → NO |
| `main` tip | `f7bf41e`；`main` **是**迭代 HEAD 的祖先 | `git merge-base --is-ancestor main HEAD` → YES |
| `main` 与 `origin/main` | `main` 落后 0 / 领先 71（未推送） | `git rev-list --left-right --count origin/main...main` → `0	71` |
| worktree 数量 | **3**（仓库主工作区 `main`@`f7bf41e` / 会话工作区 / **嵌套在会话工作区内的** pr-005 子工作区） | `git worktree list`；`git worktree list --porcelain` |
| `.git/worktrees` 管理目录 | **2** 项：`0018-chat-agent-subagent-protocol`、`0018-pr-005-call-protocol-acceptance-tests` | `ls /Users/chenchiyuan/projects/agents/.git/worktrees/` |
| 全仓 0018 相关分支 | **仅 2 条**：`iteration/0018-chat-agent-subagent-protocol`、`feat/0018-pr-005-call-protocol-acceptance-tests` | `git for-each-ref --format="%(refname) %(objectname:short)" refs/heads \| grep 0018` |
| 迭代产物被 git 跟踪数 | **45** 个路径 | `git ls-files docs/iterations/0018-chat-agent-subagent-protocol \| wc -l` |

---

## 1. 阶段完成状态

依据 = 文件实体实测 + `git ls-files` 跟踪记录（不采信 status.md 的完成标记）；**内容级声称**（分数、版本号、L1=0 等）不在此核实，见第 6 部分。

| 阶段 | status.md 声称 | 核实结果 | 依据（文件实体） |
|---|---|---|---|
| 1 需求收敛 | ✅ / 已验证 ⬜ | **产物存在且已被跟踪：一致；「已验证 ⬜」与实测一致**（无阶段 1 验证报告） | `demand.md`（**500 行**）；`clarifications/` 下 `round-1.md`、`round-2.md`、`round-3.md`、`demand-round-1-proposals.md`、`recon-20260912.md` 5 份均存在 |
| 2 功能规格 | ✅ / ⬜ | **一致**（卡数逐字相符） | `prd.md`（**238 行**）；`prd/` 下 **16** 份卡文件 `F01…F16`（F01-contract-anchoring… ~ F16-route-registration-and-locks）；`clarifications/prd-round-1.md`、`prd-round-2.md` 存在 |
| 3 技术架构 | ✅ / ⬜ | **一致** | `architecture.md` **686 行**（`wc -l` → 686），与 status.md 备注「686 行」逐字一致 |
| 4 PR 规划 | ✅ / 已验证 ✅ | **一致** | `prs/` 下 **5** 份 PR 文件 + **4** 份 tasks 文件（`pr-001-tasks`~`pr-004-tasks`；**`pr-005-tasks.md` 不在迭代分支**，只在 pr-005 分支）；阶段 4 Gate 报告 `clarifications/verify-stage4-gate-20260912-231000.md`（22434 B）存在且被跟踪 |
| 5 PR 实现 | ⏸ / ⬜ | **进行中（部分已合并）**：4 个 PR 已合并进迭代分支、1 个在飞 | 见第 3 部分；合并提交 `b92ad82`/`95051b0`/`7e351fa`/`3a8f0d3` 均为迭代分支祖先 |
| 6 独立验证 | — / —（备注「按需触发，不计入线性进度」） | **迭代级（阶段 6）报告未见**；但 **PR 级验证报告 6 份已存在且已被跟踪**（非本阶段表口径） | `clarifications/` 下 `verify-pr-001-20260912-232019.md`、`verify-pr-002-20260912-231911.md`、`verify-pr-003-20260913-000547.md`、`verify-pr-003-r2-20260913-002937.md`、`verify-pr-004-20260913-005655.md`、`verify-pr-005-20260913-005344.md` |

**阶段 1~4 产物文件存在性逐项结论**：`demand.md` ✅ / `prd.md` + `prd/*.md`（16） ✅ / `architecture.md` ✅ / `prs/*.md`（5 + 4 tasks） ✅ —— **四类产物全部物理存在且被 git 跟踪**（`git status --porcelain -uall` 在会话工作区为空 ⇒ 无未跟踪产物）。

---

## 2. PR 依赖核实

逐条对 `prs/pr-*.md` 的 `## depends_on` 声明作核实；判定基准 = 依赖 PR 是否**已合并进迭代分支**（不是 main）。

| PR | 声称 depends_on | 依赖是否已在迭代分支落地 | 判定 |
|---|---|---|---|
| pr-001-transport-call-key-namespace.md | （无） | 不适用（无依赖） | **一致**（声明为空） |
| pr-002-registry-task-list-model.md | （无） | 不适用（无依赖） | **一致**（声明为空） |
| pr-003-call-http-surface-and-contract-docs.md | pr-001, pr-002 | **两条均已合并** | **一致（2/2 满足）** |
| pr-004-console-call-page.md | pr-003 | **已满足** | **一致（1/1 满足）** |
| pr-005-call-protocol-acceptance-tests.md | pr-003 | **已满足**（`7e351fa` = pr-005 分支的 merge-base） | **一致（1/1 满足）**；但该 PR **尚未合并**（详见第 3、4 部分） |

**逐条实证（迭代分支基准，含合并 commit 里的分支名）**：

- `git log iteration/0018-chat-agent-subagent-protocol --merges --format="%h %cI %s"` → 恰 4 条 0018 PR 合并提交，标题内的分支名与规范命名 `feat/0018-pr-{NNN}-{slug}` 一致：
  - `b92ad82` `Merge branch 'feat/0018-pr-001-transport-call-key-namespace' …`（2026-09-12 23:20:58）
  - `95051b0` `Merge branch 'feat/0018-pr-002-registry-task-list-model' …`（2026-09-12 23:20:58）
  - `7e351fa` `Merge branch 'feat/0018-pr-003-call-http-surface-and-contract-docs' …`（2026-09-13 00:30:40）
  - `3a8f0d3` `Merge branch 'feat/0018-pr-004-console-call-page' …`（2026-09-13 00:58:20）
- 祖先性（`git merge-base --is-ancestor <合并提交> iteration/…`）：`b92ad82` **YES**、`95051b0` **YES**、`7e351fa` **YES**、`3a8f0d3` **YES**。
- 合并两侧父子关系（`git log -1 --format="%h parents=%p"` + `git log -1 3a8f0d3^2`）：`3a8f0d3` parents = `5106fc3 d84dba1`，第二父 = pr-004 实现提交；`b92ad82^2 = cb1bdc8`、`95051b0^2 = a827f4e`、`7e351fa^2 = baf9c43` —— 四者均为对应 PR 分支的实际 tip，非空合并。
- 迭代分支 reflog 交叉印证（只读）：`git reflog show iteration/…` 含 4 条 `merge feat/0018-pr-00X-…: Merge made by the 'ort' strategy`（`@{1}` pr-004、`@{7}` pr-003、`@{19}` pr-002、`@{20}` pr-001），另 2 条 `merge main` 为基线整合。
- pr-003 的两条依赖先后关系：`b92ad82`/`95051b0` committer 23:20:58 **早于** pr-003 合并 `7e351fa` 00:30:40 ⇒ 依赖在合并前已落地。
- pr-004 的依赖：`git merge-base --is-ancestor 7e351fa 3a8f0d3` → **YES**。
- pr-005 的依赖：`git merge-base feat/0018-pr-005-… iteration/…` → **`7e351fa`**（= pr-003 合并提交）⇒ pr-003 已在其分叉点之前合并；`git merge-base --is-ancestor 7e351fa feat/0018-pr-005-…` → **YES**。

**汇总**：`depends_on` 声明 5 条（2 条空、3 条非空）；**一致 5 / 不一致 0**。

---

## 3. PR 实现状态核实

| PR | worktree | 分支 | HEAD / 提交数 | 是否已合并进迭代分支 | 与 status.md 声明对照 |
|---|---|---|---|---|---|
| pr-001 | **不存在**（`git worktree list` 3 条无此项；`.git/worktrees/` 2 项无此项；`.pb-agents/worktrees/` 下仅会话工作区 1 项） | `feat/0018-pr-001-transport-call-key-namespace` **已删除**（`for-each-ref` 无） | 实现提交 `cb1bdc8`（23:17:31），合并第二父 | **已合并** = `b92ad82`（祖先 YES）；合并 diff：`oamp/src/transport.js` 修改 + `prs/pr-001-tasks.md` 新增 | status.md 记「✅ 已合并 / 分支已删除 / `b92ad82`」→ **一致** |
| pr-002 | **不存在**（同上） | `feat/0018-pr-002-registry-task-list-model` **已删除** | 实现提交 `a827f4e`（23:15:23） | **已合并** = `95051b0`（祖先 YES）；合并 diff：`oamp/src/registry.js` + `prs/pr-002-tasks.md` | status.md 记「✅ 已合并 / 分支已删除 / `95051b0`」→ **一致** |
| pr-003 | **不存在**（同上；上轮观测时的 pr-003 子工作区已移除） | `feat/0018-pr-003-call-http-surface-and-contract-docs` **已删除** | 实现/修复提交 `d1bc97d`、`f771ae5`、`baf9c43`；合并第二父 = `baf9c43` | **已合并** = `7e351fa`（祖先 YES）；合并 diff 7 文件 / +1501 −17（`oamp/API.md`、`oamp/llms.txt`、`oamp/src/web.js`、3 个既有测试文件、`prs/pr-003-tasks.md`） | status.md 记「✅ 已合并（验收 FAIL→修复→复验 PASS 28/28）/ 分支已删除 / `7e351fa`」→ **一致**（分值属内容级，见第 6 部分） |
| pr-004 | **不存在**（同上） | `feat/0018-pr-004-console-call-page` **已删除** | 实现提交 `d84dba1`（00:47:04），合并第二父；任务图提交 `da6fa63` | **已合并** = `3a8f0d3`（祖先 YES）；合并 diff 6 文件：`A prs/pr-004-tasks.md`、`M oamp/README.md`、`A oamp/test/call-console.test.js`、`A oamp/web/calls.html`、`A oamp/web/calls.js`、`M oamp/web/index.html` | status.md 记「✅ 已合并 / 已释放」，但「已合并」列**不写 sha**（写作「见 git log（merge pr-004）」）→ **sha 缺失**（见第 5 部分 2） |
| pr-005 | **存在**：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol/.pb-agents/worktrees/0018-pr-005-call-protocol-acceptance-tests`（目录 mtime 2026-09-13 00:30；= 会话工作区**子层**路径） | `feat/0018-pr-005-call-protocol-acceptance-tests` **存在**（tip `8e4fa86`） | 分叉点 `7e351fa` 之后 **2** 个提交：`b572cd4` 任务图（00:37:16）、`8e4fa86` 测试文件（00:47:06）；`git reflog show` 3 条（`@{2}` = `branch: Created from iteration/…`，即在 `7e351fa` 处建档）；子工作区 `git status --porcelain -uall` 两次采样：00:59:24 **空输出** → 01:00:56 **` M oamp/test/call-protocol.test.js`**（修复轮产生的未提交改动，分支 tip 未变）；变更面（`git diff --name-status 7e351fa feat/0018-pr-005-…`）= 仅两条 `A`：`prs/pr-005-tasks.md`、`oamp/test/call-protocol.test.js` | **未合并**（`git merge-base --is-ancestor feat/0018-pr-005-… iteration/…` → **NO**） | status.md 记「⏸ 进行中（**planner 已派发**）」→ **状态文本过期**（见第 5 部分 3）；分支名一格**一致** |

**迭代分支交付面实测（`oamp/`，逐项）**：

| 声称 | 实测 | 判定 |
|---|---|---|
| 6 条调用面路由 | `grep -n "path: '/api/calls" oamp/src/web.js` → 6 处：`:942` `POST /api/calls`、`:1119` `GET /api/calls`、`:1149` `GET /api/calls/stream`、`:1171` `GET /api/calls/:call_id/stream`、`:1194` `GET /api/calls/:call_id/transcript`、`:1223` `GET /api/calls/:call_id` | **一致（6/6）** |
| `STATIC_FILES` 两项 | `oamp/src/web.js` 表末 `'/calls': 'web/calls.html'`、`'/calls.js': 'web/calls.js'` ⇒ **恰 2 项** | **一致（2/2）** |
| `oamp/web/calls.html` + `oamp/web/calls.js` | 存在（1371 B / 7088 B，mtime 09-13 00:58），由 `3a8f0d3` 引入 | **一致** |
| `oamp/test/call-console.test.js` | 存在（7431 B），由 `3a8f0d3` 引入 | **一致** |
| `oamp/llms.txt` 19 条 | 文件 37 行；`## 接口（19 条）` 区块下列 **19** 个条目（行 13~31），其中调用面 6 条与 web.js 路由一一对应 | **一致（19/19）** |
| `oamp/API.md` §7 存在 | `## 7. sub agent 契约对照与差异清单`（行 1415），下含 §7.1~§7.5（行 1417/1431/1475/1501/1530） | **一致** |
| （旁证）页面入口 | `oamp/web/index.html:18` `<a class="nav-item" href="/calls">调用</a>`；`oamp/README.md:129` 顶栏入口说明一行 | 存在 |

**pr-005 分支不含 pr-004 产物（实测，供对账）**：`oamp/web/calls.html`、`oamp/web/calls.js`、`oamp/test/call-console.test.js` 在 `feat/0018-pr-005-…` 上 **ABSENT**（`git cat-file -e`），而 `oamp/test/call-protocol.test.js` EXISTS、`oamp/llms.txt` EXISTS 且与迭代分支版本**逐字节相同**（`git diff --stat` 无输出）—— 这是其分叉点 `7e351fa` 早于 pr-004 合并 `3a8f0d3` 的直接后果（事实记录，非判定）。

---

## 4. 并发度分析

**status.md「## 并发配置（阶段 5）」五字段核实**：

| 字段 | 声称 | 实测/推导 | 判定 |
|---|---|---|---|
| 起始并发数 | 3 | 规范默认 3（`roles/workflow-pb/workflow-pb.md`：默认 3）；无相反 git 记录 | **一致** |
| 硬上限 | 5（`2×起始-1`） | `2×3-1 = 5` | **一致** |
| 当前有效上限 | 5 | 迭代分支上 PR 合并提交恰 **4** 条 ⇒ 释放 4 ⇒ 规范公式 `min(3 + 4×3, 5) = 5`（已钳硬上限） | **结果一致**（但同表内公式括号写 `min(3 + 3×3, 5)`／「三次槛位释放后维持 5」，与「释放 4」数量口径不一致 —— 见第 5 部分 5） |
| 累计槛位释放次数 | 4（pr-001~004 各 +1） | 迭代分支 0018 PR 合并提交 = **4**（`b92ad82`/`95051b0`/`7e351fa`/`3a8f0d3`） | **一致**（口径细节见第 6 部分 6） |
| 已派发总数 | 5（pr-001~pr-005 全部已派发） | 可核实部分：4 条 PR 合并提交（每条含其分支名）+ 现存 pr-005 分支（reflog 有建档记录）⇒ 至少 5 次 `worktree add`；**pr-001~004 的建档 reflog 已随 `branch -d` 消失** | **一致（可核实范围内）**；完整次数见第 6 部分 5 |

**并发度现状（观测时点）**：

- **在飞（占用槛位）的 PR：1 个 —— pr-005**（worktree/分支存在、2 个提交、依赖已满足；子工作区 00:59:24 为空 → **01:00:56 出现未提交改动 ` M oamp/test/call-protocol.test.js`**（修复轮在写）。）
- **可并发但闲置的 PR：0 个。** 判定依据 = 「`depends_on` 全部已合并进迭代分支 **且** 未派发」的 PR 集合为空：pr-001~004 已合并（不再占槛位），pr-005 依赖已满足但**已派发且在飞**。
- **正常阻塞的 PR：0 个**（pr-005 的依赖 `pr-003` 已于 00:30:40 合并，其未合并的状态**不因依赖未满足**；其自 00:47 起处于定向修复轮）。
- **槛位空置事实**：有效上限 5 − 在飞 1 = **空置 4**。规范明文「没有已解锁且排队中的 PR 时，释放出的槛位保持空置，不触发任何派发」，故该空置本身**不构成不一致项**，此处仅记录事实。
- **已合并 PR 的现场清理（四写现场核查）**：pr-001/pr-002/pr-003/pr-004 的 **分支与 worktree 均已不存在** —— `git for-each-ref refs/heads` 仅剩 `feat/0018-pr-005-…` 与 `iteration/0018-…` 两条；`git worktree list` 仅 3 条（无 pr-001~004 子工作区）；`.git/worktrees/` 仅 2 项；`.pb-agents/worktrees/` 下仅会话工作区一项。与 history.md（23:20:58 / 00:30 / 00:58 三条「槛位释放」条目所述 `worktree remove` + `branch -d`）**在现状上一致**。
- **pr-005 与迭代分支的差量**：落后迭代分支 **9** 个提交、领先 **2** 个（其中 9 个里含 pr-004 全部产物与 5 条台账/裁定提交）—— 合并前需与迭代分支对齐的关系，此处仅记录事实。
- **定向修复轮的 git 可观测性**：截至观测终点，pr-005 分支 tip **仍为 `8e4fa86`**（无修复提交）、reflog 无 amend/reset 痕迹、子工作区 `git status` 两次采样 = 00:59:24 **空** → 01:00:56 **` M oamp/test/call-protocol.test.js`** ⇒ **唯一可观测的修复轮产出 = 该未提交改动**（分支历史未变；不能据此断言修复完成度，见第 6 部分 4）。

---

## 5. 发现的不一致

以下均为「文件声称」vs「git 一手记录 / 文件系统实测」的差异，逐条列出，**不做严重性判断、不给处理建议**。

1. **status.md 第 8 行状态描述过期**：`**状态**: **进行中**（阶段 1~4 已完成；阶段 5 首波已合并，**pr-003 进行中**）` —— 实测 pr-003 已合并（`7e351fa`，00:30:40）、pr-004 亦已合并（`3a8f0d3`，00:58:20），且同文件「更新日志」末条即为「pr-004 验收 PASS 14/14 → 合并进迭代分支」。
2. **status.md 第 56 行「已合并」列缺 sha**：pr-004 行写作 `见 git log（merge pr-004）`，而同表 pr-001/pr-002/pr-003 三行均写具体提交号；git 一手值 = **`3a8f0d3`**。
3. **status.md 第 57 行 pr-005 状态过期**：记为「⏸ 进行中（**planner 已派发**）」 —— 实测该 PR 分支已有 **2** 个提交（`b572cd4` 任务图 00:37:16、`8e4fa86` 验收测试文件 00:47:06），且验收报告文件 `clarifications/verify-pr-005-20260913-005344.md`（25983 B）已存在、记录提交 `5106fc3` 标题为「末波两份验收结论 + **pr-005 定向修复裁定**」⇒ planner 之外 dev 与验收环节均已发生。
4. **status.md 第 57 行「槛位状态」列取值超出规范枚举**：记为 `—`；`roles/workflow-pb/workflow-pb.md` 明定该列取值为 `占用` / `排队(依赖未满足)` / `排队(等待槛位)` / `已释放`；按实测（分支+worktree 存在、依赖已满足、未合并）应为 `占用` 一侧，文件未给值。
5. **status.md 并发配置表内部数字口径不一致**：第 43 行「当前有效上限 | 5（= min(3 + **3×3**, 5) → 钳到硬上限；**三次**槛位释放后维持 5）」vs 第 44 行「累计槛位释放次数 | **4**」。规范公式为 `min(起始 + 累计释放×起始, 硬上限)` ⇒ 以 4 次计应为 `min(3 + 4×3, 5)`；两处写法给出的结果同为 5，但次数口径（3 vs 4）在同一表内不一致。
6. **status.md 阶段状态表第 34 行「阶段 5」完成列 = `⏸`**：该符号在本文件其他位置用于表示**已暂停**（更新日志「本迭代置**已暂停**」用同一符号），与第 5 行「进行中」口径冲突。第 35 行「阶段 6」= `— | —`（备注「按需触发，不计入线性进度」）。
7. **status.md 第 35 行「阶段 6 = —（无）」与实测不符（阶段级口径）**：`clarifications/` 下已有 **6** 份 PR 级独立验证报告（`verify-pr-001`、`verify-pr-002`、`verify-pr-003`、`verify-pr-003-r2`、`verify-pr-004`、`verify-pr-005`，均已被 git 跟踪并有归档提交），阶段级验证报告未见 —— 该行以「—」表示「无验证产出」与文件实体不一致。
8. **status.md 第 22 行「下一步 = 阶段 3（技术架构）」过期**：阶段 3/4 均已在文件内标 ✅，迭代分支上已有阶段 5 的合并与台账提交；该行仍停留在阶段 3 派发前。
9. **status.md 第 31 行（阶段 2 备注）与第 32 行（阶段 3 备注）互相矛盾**：第 31 行仍写「…卡内 `[model_inferred]` 零残留；**T-01~T-17 架构待填**」，第 32 行写「16 卡 `[架构待填]` 全填；**T-01~T-17 = 17/17**」—— 前者为阶段 3 未执行前的旧文本。
10. **history.md 条目标题时间对 git committer 时间仍存在超前偏差（口径声明已存在）**：篇首第 1 行「时标口径声明」**存在**（逐字核对：「本文件条目中的时间字段是记录时的本地时钟读数，可能存在超前偏差…权威时间以 git 一手记录为准…」）。抽样 7 对（左侧 history 标题时间 → 右侧 git 一手时间）：
    - 「23:20:58 · 调度决策 · 槛位释放」→ `b92ad82`/`95051b0` committer **23:20:58** ⇒ **0 分 0 秒（精确命中）**；
    - 「00:38:00 · 调度决策 · 槛位释放」→ `7e351fa` **00:30:40** ⇒ **+7:20**；
    - 「01:00:00 · 收到报告 · dev（pr-004）」→ `d84dba1` **00:47:04** ⇒ **+12:56**；
    - 「01:11:00 · 收到报告 · dev（pr-005）」→ `8e4fa86` **00:47:06** ⇒ **+23:54**；
    - 「01:12:00 · 派发 · verifier（pr-004 ∥ pr-005）」→ 归档提交 `4dd5ac1` **00:47:55** ⇒ **+24:05**；
    - 「01:00:00 · 收到报告 · verifier（pr-005 验收）」→ 其自述报告路径 `clarifications/verify-pr-005-20260913-005344.md`（文件名时标 **00:53:44**）⇒ **+6:16**；
    - 「01:03:00 · 调度决策 · 阶段推进核查」→ 归档提交 `5106fc3` **00:58:14** ⇒ **+4:46**。
    文件级旁证：`history.md` mtime = **00:58:14** 且内容已含标注至 **01:12:00** 的条目；`status.md` mtime = **00:58:20**（与 `3a8f0d3`/`9f42255` committer 同秒）—— 即这些标题时间在落笔当时尚未到达。**结论（事实层）**：偏差方向为「条目标称时间 **超前** 于对应 git 时刻」，量级 0 ~ +24 分钟且不恒定；事件实质（提交、合并、清理）与 git 记录可一一对应。
11. **上轮 progress.md（2026-09-12 23:22 版）所列 6 条不一致的现状**（逐条复核，仅记事实）：① pr-003「尚未派发」+「已派发总数 = 2」→ **已闭合**（现第 45/57 行分别为 5 与「进行中」文本）；② history 时标超前 → **仍存在**（现第 10 条，另新增篇首口径声明）；③ 第 8 行状态行停留在阶段 4 → **已改写**（现文本改为阶段 5 相关，但产生新的过期表述，见第 1 条）；④ 阶段 3 备注「待启动」→ **已闭合**；⑤ 工作流版本 v0.10.0 与三处 v0.9.0 混用 → **已闭合**（第 3/16/18/21 行现均为 v0.10.0）；⑥ 恢复设置「tip `deeb1b7`」→ **已改为历史口径**（现第 17 行「tip 随阶段 5 推进前进；**恢复时为** `deeb1b7`」）。

**同表列出「status.md 与 git 一致项」（供对照）**：PR 子状态表 pr-001/pr-002/pr-003 三行的「已合并 + sha + 分支已删除」；pr-004 的「已合并 + 已释放」结论（仅缺 sha）；pr-005 的 worktree 分支名一行；阶段表阶段 1/2/3/4 的产物级完成标记；并发配置前两字段（起始 3 / 硬上限 5）与「累计槛位释放 4」「有效上限 5」的结果值；依赖图行 `{pr-001, pr-002} → pr-003 → {pr-004, pr-005}`。

---

## 6. 无法核实项

1. **pr-001 / pr-002 / pr-003 / pr-004 的 worktree 与分支「创建时刻 / 删除时刻」**：现状可核实（分支与 worktree 均不存在），但 `branch -d` 同时清掉了分支 reflog ⇒ 建档/删除时刻与其 **base 提交**均无 git 一手记录可查（pr-005 因分支仍在，其 base = `7e351fa` 可核实）。相关叙述仅见于 history.md 自述。
2. **history.md 时标的生成依据**：各条目标称时刻（如 01:11:00 / 01:12:00）与 git committer 时间系统性超前（第 5 部分 10），但不存在可指向其真实时刻的任何 ref/日志；篇首声明只说明口径，不提供原始读数。
3. **内容级声称无法用 git 核实**（本角色不做内容级质量判定）：「pr-001 PASS 32 项 / pr-002 PASS 19 项」「pr-003 复验 PASS 28/28」「pr-004 PASS 14/14」「pr-005 PASS 30/30」「阶段 4 Gate PASS 9/9」「architecture L1 = 0 条」「`model_inferred` 归零」「P-1~P-11 与 Q-1 经用户裁决」等。可核实的仅是**报告文件存在且被提交**：`clarifications/` 下 7 份 `verify-*`（6 份 PR 级 + 1 份阶段 4 Gate）全部存在；报告内部结论真伪不在核实范围。
4. **pr-005「定向修复轮」的实际作业进度**：观测窗口内 git 侧仅能确认「分支 tip 未前进（`8e4fa86` 不变）、无 amend/reflog 痕迹、子工作区 00:59:24 干净 / 01:00:56 出现 ` M oamp/test/call-protocol.test.js`」⇒ 可确认修复轮**已在该子工作区落笔**，但**不能**推断其完成度、是否会再产生提交、或改动的正确性。另：分支 tip 与提交数在窗口内未变（仍 2 个提交）。
5. **「已派发总数 = 5」的完整计数**：可核实 = 4 条 PR 合并提交（含分支名）+ pr-005 分支建档 reflog 1 条 + 5 份 PR 文件；pr-001~004 的分支建档 reflog 已消失 ⇒ 无法排除「同一 PR 曾被重复派发（第二次派发覆盖同名分支）」的情形。
6. **规范「失败/阻塞判定同样释放槛位」是否曾触发**：pr-003 曾出现验收 FAIL 并进入修复轮（`96cce20` 记录），但 git 侧无法判定该事件是否按「槛位释放」计数；status.md 记 `累计槛位释放次数 = 4`，恰等于迭代分支 0018 PR 合并提交数 4。
7. **「用户裁决真实发生」无 git 一手记录**（人机交互不落 commit）；status.md §用户确认记录与 history.md 的相关自述均属声明。
8. **迭代分支与 main 的整合态完整性**未做内容级核实：可核实 `main` 是迭代 HEAD 的祖先、`main` 领先 `origin/main` 71 个提交（未推送）；「0017/0019/0020 全部产出零丢失」属内容级判断。
9. **观测窗口外的变更不追认**：本报告以第 1 段锚点（tip `9f42255`、pr-005 tip `8e4fa86`）为界；写入期间迭代分支与 pr-005 分支若再有提交，不在结论内。

---

## 交付：三处 `git status --porcelain -uall`

- **会话工作区** `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol`：**覆盖写入前为空输出**；写入本文件后为单行 ` M docs/iterations/0018-chat-agent-subagent-protocol/progress.md`（即本文件自身的覆盖写入，见文末实测）。
- **仓库主工作区** `/Users/chenchiyuan/projects/agents`：**空输出**（干净；无跨工作区写入痕迹）。
- **pr-005 子工作区** `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol/.pb-agents/worktrees/0018-pr-005-call-protocol-acceptance-tests`：**00:59:24 首测为空输出**（干净）；**01:00:56 末测为 ` M oamp/test/call-protocol.test.js`**（修复轮的未提交改动，属该子工作区自身的在写内容，非本次观测写入）。无「其他」工作区。

**写入边界**：本次唯一写入 = 本文件（整体覆盖）。未修改 `status.md`、`history.md`、`prs/*.md`、任何代码或任何 git ref；全部 git 命令为只读（`log / show / reflog show / branch --show-current / for-each-ref / worktree list / status / rev-list / merge-base / merge-base --is-ancestor / rev-parse / cat-file -e / ls-files / diff --stat / diff --name-status`）。**未执行任何写入性 git 命令**（无 `commit`/`merge`/`branch -d`/`worktree add|remove`/`checkout`/`stash`）。
