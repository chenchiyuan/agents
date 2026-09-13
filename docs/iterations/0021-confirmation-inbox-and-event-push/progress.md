# 进度快照（progress-observer）

**迭代**: 0021-confirmation-inbox-and-event-push
**核实对象**: `<迭代工作区>/docs/iterations/0021-confirmation-inbox-and-event-push/` + 分支 `iteration/0021-confirmation-inbox-and-event-push`
**核实时间**: 2026-09-13 13:24 (+0800)
**迭代分支 tip**: `1f7eceb`（`merge: 0021 pr-003 … into iteration/0021`，2026-09-13 13:21:40）
**迭代 base**: `854766c`（`git merge-base iteration/0021-… main` 输出即此值）；迭代分支领先 base **25** commits
**核实方法**: 全程只读。所有结论取自 `git log` / `git branch` / `git worktree list` / `git ls-tree` / `git grep` / `git hash-object` 与磁盘文件，**不采信 status.md 或任何角色报告的勾选**。

> 本文件每次生成整体覆盖，不追加历史（历史由 git commit history 承载）。

---

## 阶段完成状态

| 阶段 | status.md 声称 | 核实结果 | 依据 |
|---|---|---|---|
| 1 需求收敛 | ✅ | 一致 | `demand.md` 存在于迭代分支；最后提交 `897e987`（11:41:26）；文件头 `**版本**: v1.1.0` |
| 2 功能规格 | ✅ | 一致 | `prd.md` + `prd/` 卡文件共 **12** 个（`git ls-tree --name-only iteration/0021-…:<…>/prd/ \| wc -l` = 12，即 F01~F12）；最后提交 `6bb1a54`（11:48:49）；`prd.md` 版本 `0.2.0` |
| 3 技术架构 | ✅ | 一致 | `architecture.md` 存在，`wc -l` = **821**（与声称的 821 行一致）；最后提交 `1180183`（12:14:31） |
| 4 PR 规划 | ✅ / 已验证 ✅ | 一致 | `prs/` 下 4 个 PR 文件（pr-001~pr-004）+ `pr-003-tasks.md`；最后提交 `ad47ea0`（12:19:22）；Gate 报告 `clarifications/verify-stage4-gate-20260913-122303.md` 存在 |
| 5 PR 实现 | ⏸ | 一致（确在进行中） | pr-003 确已并入（`1f7eceb` 为双亲 merge）；pr-001 未合并且分支有 2 个自有 commit + worktree 未提交改动；pr-004 分支零自有 commit。详见「PR 实现状态核实」 |
| 6 独立验证 | ⬜ | 一致 | 迭代级阶段 6 无产物。`clarifications/` 下只有 **PR 级/阶段门** 验证报告（`verify-pr-001-20260913-131042.md`、`verify-pr-003-20260913-132013.md`、`verify-stage4-gate-20260913-122303.md`），无迭代级最终验证产物 |

---

## PR 依赖核实

声明来源 = 各 `prs/pr-*.md` 的 `## depends_on` 段（逐文件读取，非转述）。

| PR | depends_on 声明 | 实际合并状态 | 依据 |
|---|---|---|---|
| pr-001-agent-permission-suspend-and-reply-fix.md | （无） | 不适用 | 文件 `## depends_on` 段内容 = 「（无）」 |
| pr-002-agent-confirmation-wiring.md | pr-001-agent-permission-suspend-and-reply-fix.md | **未满足** | ① `git branch --no-merged iteration/0021-…` 列出 `+ feat/0021-pr-001-permission-suspend-and-reply-fix`；② `git log iteration/0021-… --grep="pr-001"` 的命中只有文档提交 `7e979ac`（正文提及），**无 0021 的合并提交**；③ 实体核实——迭代分支 `oamp/src/acp-client.js:123` 仍为 `… this.permission === 'deny' ? 'always-ask' : 'yolo'`、`:399` 仍为 `const allow = this._permissionDecision(message, toolCall) !== 'deny'`（pr-001 之前的同步判定形态），而 pr-001 分支同文件 `:131` 已改为 `args.push('--approval-mode', 'always-ask')`、`:422` 已含「判定可挂起——钩子返回未结算 Promise 期间**不回包**」⇒ **迭代分支上确实不含 pr-001 的产出** |
| pr-003-web-inbox-and-decision-api.md | （无） | 不适用（已合并） | 文件 `## depends_on` 段内容 = 「（无）」；合并事实见下行 |
| pr-004-console-inbox-column-and-notify.md | pr-003-web-inbox-and-decision-api.md | **已满足** | ① 真 merge：`git log -1 --format='%P' 1f7eceb` → 双亲 `7e979ac` + `0d9cbc2`，subject `merge: 0021 pr-003 … into iteration/0021`；② `git diff --stat 7e979ac 1f7eceb` 显示 pr-003 的 10 个文件真实并入（含 `oamp/src/inbox.js` +42）；③ 依赖实体在迭代分支可验：`git grep` 命中 `oamp/src/web.js:1253` `path: '/api/confirmations'`、`:1270` `path: '/api/confirmations/:confirmation_id/decision'`、`:1599` `transport.publishGlobal({ type: 'confirmation', data: entry })`、`:430` `'/notify.js': 'web/notify.js'`；④ `git cat-file -e iteration/0021-…:oamp/src/inbox.js` → EXISTS |

**依赖图结论**：文件声明的 `pr-001→pr-002`、`pr-003→pr-004` 与 git 实际一致；**当前仅 pr-004 的依赖已满足**。

---

## PR 实现状态核实

对照基准 = 迭代分支 `1f7eceb`（worktree 列表与分支表由 `git worktree list --porcelain` / `git branch -vv` 取得）。

| PR | status.md 声称 | worktree | branch HEAD | 相对迭代分支 | 已合并 | 核实结果 |
|---|---|---|---|---|---|---|
| pr-001-agent-permission-suspend-and-reply-fix.md | 进行中（第 2 轮修复） | **存在** `…/.pb-agents/worktrees/0021-pr-001-permission-suspend-and-reply-fix` | `feat/0021-pr-001-…` @ `dd59d31` | **领先 2 个自有 commit**（`27eef14` 任务图 + `dd59d31` 实现），fork 点 `10cbca6`（12:24:40） | 否 | 一致（另有未提交改动，见下） |
| pr-002-agent-confirmation-wiring.md | 未解锁 | **不存在** | 不存在 | — | 否 | 一致（依赖 pr-001 未满足，阻塞符合依赖图预期） |
| pr-003-web-inbox-and-decision-api.md | ✅ 已完成（验收 PASS 46/46）；worktree/分支已清理 | **不存在** | 不存在 | — | **是**（`1f7eceb`） | 一致 |
| pr-004-console-inbox-column-and-notify.md | 进行中（planner 派发中） | **存在** `…/0021-pr-004-console-inbox-column-and-notify` | `feat/0021-pr-004-…` @ `1f7eceb` | **零自有 commit**（`git log iteration/0021-…..feat/0021-pr-004-…` 输出为空）；HEAD 与迭代分支 tip 同值 | 否（无独有 commit 可并） | **部分一致**：worktree/分支确实存在（已被认领），但 git 上零可见进展，且 `prs/pr-004-tasks.md` 不存在 |

**补充证据**

- pr-001 worktree `git status --short --branch` → ` M oamp/src/acp-client.js`、` M oamp/test/tool-permission.test.js`（第 2 轮未提交改动，属在飞工作，如实记录、未干预）。
- pr-001 实现提交 `dd59d31` 改动 = `oamp/src/acp-client.js` (+159/-…)、`oamp/test/acp-daemon.test.js`、`oamp/test/tool-permission.test.js`。
- pr-004 worktree `git status --porcelain --untracked-files=all` → **空**（工作区干净、无未跟踪文件）。
- pr-003 清理核实：`git branch -a --list '*pr-003*'` → 空输出；`git worktree list --porcelain` → 无 pr-003 条目。与声称的「已清理」一致。

---

## 并发度分析

- **依赖已满足且已有 git 可见进展**：`pr-001`（fork 点之上 2 个自有 commit + worktree 内 2 个文件的未提交改动 ⇒ 正在推进）。
- **依赖已满足、worktree 已建但零 git 可见进展**：`pr-004`（HEAD == 迭代分支 tip `1f7eceb`、零自有 commit、工作区干净无未跟踪文件、`prs/pr-004-tasks.md` 尚不存在）。这是本迭代当前**唯一**「已解锁但不可观测到任何落点」的 PR。
- **正常阻塞**：`pr-002`（depends_on pr-001，pr-001 未合并；阻塞与依赖图预期一致）。
- **「依赖已满足但连 worktree 都未建」的完全闲置 PR**：**0 个**。
- **槛位核对**：status.md 称「有效上限 5 / 累计释放 1（pr-003 合并）/ 已派发总数 7」。释放 1 次与 git 一致（恰有 1 个 PR 真实并入迭代分支）；「已派发总数 7」中的 +1（planner(pr-004)）在 git 上无对应落点，见「无法核实项」。

---

## 发现的不一致

1. **status.md 声称 planner 已交付的 `prs/pr-001-tasks.md` 在迭代分支上不存在。** 该文件仅存在于未合并的 `feat/0021-pr-001-…` 分支（提交 `27eef14`，12:30:45，+174 行，18587 B）；`git log iteration/0021-… -- '…/prs/pr-001-tasks.md'` 输出为空（从未出现在迭代分支上），`git ls-tree iteration/0021-…:…/prs/` 只列出 `pr-001-agent-…md`、`pr-002-agent-…md`、`pr-003-tasks.md`、`pr-003-web-…md`、`pr-004-console-…md`。对照：同批的 `pr-003-tasks.md` 已在迭代分支上（经 `1f7eceb` 并入，21140 B）。
2. **`clarifications/hub-execution-log.md` 第 14/15 行状态与 status.md 相反。** 日志把两个 hub dev 调用（`task-611698ac…` / `task-ad76744f…`）记为「**进行中**」；status.md 更新日志记为「零落盘（pr-001 `completed` 无产物 / pr-003 `failed context_crashed`）」。同一批派发的终态在两份产物中互相矛盾，且日志行未被后续状态覆盖。
3. **`hub-execution-log.md` 的表内时标与自身 git 落盘时刻自相矛盾。** 该文件当前内容的最后提交为 `bd39abb`（**12:40:17**）；`git ls-files -v` 显示标记为 `H`（正常，非 skip-worktree）、`git hash-object` 与 `git rev-parse HEAD:<path>` 同为 `f5aafb36…`、`git diff HEAD` 为空 ⇒ 工作区内容与该提交内容逐字节相同。但表内存在晚于该时刻的行：#8 `12:56`、#9 `13:12`、#10 `13:20`、#11 `13:27`、#12/#13 `13:36`、#14/#15 `13:50`。另有多行与其证据 commit 的时间不符：#12/#13 记 `13:36` 产出 `prs/pr-001-tasks.md` / `prs/pr-003-tasks.md`，而这两个文件的落盘提交 `27eef14` / `a5b2043` 均为 **12:30:45**；#11 记 `13:27` 完成 Gate，而其报告文件名为 `verify-stage4-gate-20260913-122303.md`（内嵌 12:23:03）。成因不可判定，见「无法核实项」。
4. **status.md 的 PR 子状态表把 pr-004 记为「进行中」且槛位「占用」，但 git 上无任何可观测落点**（零自有 commit、worktree 干净、无 `prs/pr-004-tasks.md`）。其「进行中」的依据（planner 已派发）不在 git 记录内。
5. **`git branch --merged <迭代分支>` 会把 `feat/0021-pr-004-…` 列为「已合并」**——因其 HEAD 与迭代分支 tip 同为 `1f7eceb`，并不表示该 PR 的工作已并入（实证：`git branch --merged iteration/0021-…` 输出含 `+ feat/0021-pr-004-console-inbox-column-and-notify`）。以 `--merged` 判定合并状态在此会误判。
6. **迭代工作区存在未提交的 status.md / history.md 改动。** `git status --short` → ` M docs/iterations/0021-confirmation-inbox-and-event-push/history.md`、` M …/status.md`；`git diff --stat HEAD` = 2 files changed, +42 / −7。即 status.md 中「pr-003 已合并 / 解锁 pr-004 / pr-001 第 2 轮」等表述**尚未落盘到任何 commit**。

---

## 无法核实项

- **pr-001 第 2 轮修复的完成度**：worktree 内有未提交改动（`oamp/src/acp-client.js`、`oamp/test/tool-permission.test.js`），但「高严重度偏差 #1（`write` 类工具静默拒绝）是否已闭合」需读代码差异或执行测试才能判定；本次未做代码级核实、未运行任何测试。
- **status.md 的「合并后 6 测试文件 87/87 绿」**：属测试执行结论，git 记录中无可追溯证据；本次未运行测试，无法核实。
- **status.md 的「已派发总数 7（含 planner(pr-004)×1）」**：派发记录不在 git 内（`hub-execution-log.md` 的覆盖范围止于模式切换前的 15 次 hub 调用），本地 sub agent 的派发痕迹无可核实载体。
- **pr-004「planner 派发中」是否属实**：同上，无 git 一手记录；只能核实到「worktree 已建、零 commit、无任务图文件」。
- **`hub-execution-log.md` 时标偏移的成因**（见「发现的不一致」第 3 条）：可核实的是「时标与自身落盘时刻 / 证据 commit 矛盾」这一事实；属预写、时钟口径不同还是笔误，git 记录无法判定。
- **阶段 1~4 产物的内容级完备性**（如 15 项裁决是否真的全部落定、T-01~T-16 是否真的闭合）：本次只核实了文件存在性、规模与版本号字符串，未做内容级复核（超出「产物是否存在」的核查范围）。
