# progress.md — 0025-hub-sdk-and-skill（独立进度快照）

**核实时刻**: 2026-09-15 15:27:45（本机）
**核实基准 ref**: `iteration/0025-hub-sdk-and-skill` tip = `4be4661`（`git rev-parse` → `4be46617260e443da9935c5de5a279105d0115df`），**不是 main**（main 停在 `d48102d`）
**被核实声明来源**: 工作区副本 `docs/iterations/0025-hub-sdk-and-skill/status.md`（mtime 15:25:07）、`history.md`（mtime 15:04:56）、`prs/*.md`
**核实手段**: 只读 git 命令（`rev-parse` / `merge-base --is-ancestor` / `log --merges` / `worktree list` / `branch -a` / `ls-tree -r` / `show` / `status --porcelain`）+ 文件存在性与内容逐字比对
**不核实面**: 产物质量（verifier 职责）、是否重新派发（主 agent 职责）

---

## 阶段完成状态

| 阶段 | status.md 声称 | 核实结果 | 依据 |
|---|---|---|---|
| 1 需求收敛 | ✅（demand.md v1.0.1；15 项决策全 `user_confirmed`） | 一致 | `git ls-tree -r <tip> -- …/demand.md` 命中；`git show <tip>:…/demand.md` 第 5 行逐字为 `**本版**：v1.0.1`；§3 表 15 行决策（A-1~A-5 / B-1~B-5 / C-1~C-3 / D-1~D-2）与表头「共 15 项，全部 `user_confirmed`」数目吻合（O-1 单列为下游承接项，不在该 15 项内） |
| 2 功能规格 | ✅（prd.md v0.1.0 + 17 张卡） | 一致 | `git show <tip>:…/prd.md` 第 3 行 `**版本**: 0.1.0`；`git ls-tree -r <tip> -- …/prd` 计数 = **17**（F01~F14 + G01~G03） |
| 3 技术架构 | ✅（architecture.md v1.0.0，687 行；T-01~T-09 全落定） | 一致 | `git show <tip>:…/architecture.md \| wc -l` = **687**（与声称逐字相符）；版本行 `1.0.0`；§6 汇总行 `T-01~T-09 逐项落定汇总 ✅（9/9）`；全文 T-0x 引用 32 处 |
| 4 PR 规划 | ✅（`prs/` 10 个 PR 文件；四项推进条件核查通过） | 形式面一致；推进条件仅第 4 项可独立核实（见「无法核实项」） | `git ls-tree -r <tip> -- …/prs` = 12 文件 = 10 个 PR 定义 + 2 个 tasks 归档；**10/10 文件均有 7 个二级字段标题与 `## depends_on` 标题**；依赖图独立复算（见下表）**无环** |
| 5 PR 实现 | ⏸（2/10 已合并：pr-001 / pr-005，均 PASS；pr-002 派发中） | 合并数一致（2/10）；pr-002 执行态见「无法核实项」 | 迭代分支上仅有两个 PR 合并 commit：`f9327ad`（pr-001）、`4be4661`（pr-005），均为 tip 的祖先（`git merge-base --is-ancestor` 逐个 YES） |
| 6 独立验证 | —（按需触发，不计入线性进度） | 一致（结构面） | status.md 该行与协议模板 `roles/workflow-pb/workflow-pb.md:705` 逐字同形 |

补充（不属声称，供对账）：`clarifications/verify-pr-005-20260915-151648.md`（222 行）与 `clarifications/verify-pr-001-20260915-152325.md`（270 行）在迭代分支上存在，两份报告「## 结论」均为 **PASS**（`git ls-tree` + `grep -n "^\*\*PASS\*\*"` 命中）。

---

## PR 依赖核实

依赖边来源：各 `prs/pr-{NNN}-*.md` 的 `## depends_on` 段。核实时点在 tip `4be4661`。

| PR | depends_on 声明 | 实际合并状态（核实结果） | 依据 |
|---|---|---|---|
| pr-001-sdk-error-contract-and-web-channel.md | （无） | 无依赖；自身已合并 | `git log --merges <tip>` 命中 `f9327ad Merge branch 'feat/0025-pr-001-…'`；`--is-ancestor f9327ad <tip>` = YES |
| pr-002-sdk-router-uds-channel.md | pr-001-… | **依赖已合并 ⇒ 已满足** | `--is-ancestor f9327ad <tip>` = YES；且依赖产物实体在 tip 上存在：`git ls-tree <tip> -- oamp/sdk` → `errors.js`（`HubError`/`classify`/`serializeError` 三个导出符号 `git show <tip>:oamp/sdk/errors.js` 第 12/51/76 行命中） |
| pr-003-sdk-entry-surface-cli-and-doctor.md | pr-001-…, pr-002-… | pr-001 已合并；**pr-002 未合并 ⇒ 未满足** | `git rev-parse feat/0025-pr-002-…` = `4be4661` = `git merge-base` 与迭代分支 tip 的三方同一值 ⇒ 该分支相对 base **零提交**；未在 `git log --merges <tip>` 中出现 |
| pr-004-sdk-dual-entry-and-hub-harness.md | pr-003-… | **未满足** | `git branch -a` 无 `feat/0025-pr-003-*`；`git worktree list` 无 pr-003 落点；tip 上无 `oamp/sdk/surface.js` / `cli.js` / `doctor.js` / `bin/hub.js`（`git ls-tree -r <tip> -- oamp/sdk oamp/bin/hub.js oamp/test/helpers/hub-harness.js` 只返回 `oamp/sdk/errors.js`、`oamp/sdk/http.js`） |
| pr-005-hub-skill-and-content-check.md | （无） | 无依赖；自身已合并 | `4be4661 Merge branch 'feat/0025-pr-005-…'`；合并内容含 `oamp/skill/hub.md`（129 行）与 `oamp/test/sdk-skill.test.js`（259 行），二者在 tip 上均存在 |
| pr-006-sdk-surface-coverage-test.md | pr-003-… | **未满足** | 同 pr-003 缺位证据（无分支、无 worktree、无 `oamp/sdk/surface.js`） |
| pr-007-sdk-api-behavior-test.md | pr-004-… | **未满足** | `git branch -a` 无 `feat/0025-pr-004-*`；tip 无 `oamp/bin/hub.js` / `oamp/test/helpers/hub-harness.js` |
| pr-008-sdk-uds-behavior-test.md | pr-004-… | **未满足** | 同上；另 tip 无 `oamp/sdk/uds.js` |
| pr-009-sdk-cli-contract-test.md | pr-004-… | **未满足** | 同上 |
| pr-010-sdk-doctor-test.md | pr-004-…, pr-003-… | **未满足** | 同上；tip 无 `oamp/sdk/doctor.js` |

**依赖图独立复算（不读 `batch`，只读 `depends_on`）**：`pr-001` / `pr-005` 为根 → `pr-002`←`pr-001`；`pr-003`←{`pr-001`,`pr-002`}；`pr-004`←`pr-003`；`pr-006`←`pr-003`；`pr-007`/`pr-008`/`pr-009`←`pr-004`；`pr-010`←{`pr-004`,`pr-003`}。DFS 复算**无环**。
**依赖理由中引用的架构证据抽样复核**：`architecture.md` §2.1 的边 `SUR --> HTTP`(L148) / `SUR --> UDS`(L149) / `BIN --> CLI`(L145) / `ERR -.-> UDS`(L160) / `ERR -.-> CLI`(L158) / `ERR -.-> HTTP`(L159) 均在 `git show <tip>:…/architecture.md` 中命中，即 pr-002/pr-003/pr-004 声明的理由所指的架构边真实存在。

---

## PR 实现状态核实

| PR | status.md 声称 | worktree | branch HEAD | 已合并 | 核实结果 |
|---|---|---|---|---|---|
| pr-001-… | ✅已合并（`f9327ad`） | **存在**（`.pb-agents/worktrees/0025-pr-001-sdk-error-contract-and-web-channel`，未清理） | `feat/0025-pr-001-…` = `0eb2d72` | 是（merge `f9327ad`；分支 tip `0eb2d72` 亦为 tip 的祖先 ⇒ 分支内容全部在迭代分支上） | 一致（status 表「已合并」列填的是合并 commit `f9327ad`，而分支 tip 是 `0eb2d72`——两值不等但不同义，非矛盾）；worktree 工作区干净（`status --porcelain` 空输出） |
| pr-002-… | ⏸（占用，派发中，worktree 已建，base `4be4661`） | **存在**（`.pb-agents/worktrees/0025-pr-002-sdk-router-uds-channel`） | `feat/0025-pr-002-…` = `4be4661`（= base = 迭代分支 tip） | 否 | worktree 与 base 声明一致；依赖产物可见（该 worktree 内 `oamp/sdk/errors.js`、`oamp/sdk/http.js` 存在）；**git 面零进展痕迹**：`status --porcelain -uall` 空、`log -3` 无新提交、`docs/…/prs/pr-002-tasks.md` 在**全工作区范围内不存在**（`find .pb-agents/worktrees -name pr-002-tasks.md` 仅命中历史迭代同名文件） |
| pr-005-… | ✅已合并（`4be4661`） | **存在**（`.pb-agents/worktrees/0025-pr-005-hub-skill-and-content-check`，未清理） | `feat/0025-pr-005-…` = `17a57c5` | 是（merge `4be4661`；分支 tip `17a57c5` 为 tip 的祖先） | 一致；工作区干净（`status --porcelain` 空输出） |
| pr-003 / pr-004 / pr-006~pr-010 | ⬜ 未开始（排队） | 不存在 | — | 否 | 一致（`git branch -a \| grep 0025` 只列出 pr-001 / pr-002 / pr-005 三个 feat 分支 + 迭代分支） |

**并发配置字段复核**（`## 并发配置（阶段 5）`）：起始并发数 3 / 硬上限 5 / 累计槛位释放 2 / 当前有效上限 5。与协议公式 `硬上限 = 2×起始-1 = 5`（`workflow-pb.md:512`）、`当前有效上限 = min(3 + 2×3, 5) = 5`（`:513`）**逐值吻合**；「累计槛位释放 2」与迭代分支上**恰好 2 个 PR 合并 commit** 数目一致。已派发总数 3 与 `git worktree list` 中 3 个 PR worktree 数目一致。

---

## 并发度分析

- **可并发但闲置：无。** 遍历全部 10 个 PR 的 `depends_on` 实际合并状态后，满足「依赖已全部合并进迭代分支」且未合并的 PR **只有 pr-002 一个**，而 pr-002 的 worktree 已建立（base 正确）⇒ 不构成闲置。
- **正常并发中：pr-002**（依赖 pr-001 已合并，worktree 存在）。但 git 面尚未出现任何产出（无提交、无未跟踪文件、无 `prs/pr-002-tasks.md`）——进展只有执行态声明，见「无法核实项」。
- **正常阻塞（预期状态，与声明一致）**：pr-003（等 pr-002）、pr-004（等 pr-003）、pr-006（等 pr-003）、pr-007 / pr-008 / pr-009 / pr-010（等 pr-004）。
- **空闲槛位**：当前有效上限 5，实际在执行 PR 数 1 ⇒ **空闲 4 个**。协议对这种情况的处置是明确的空置要求（`workflow-pb.md:514`：「没有已解锁且排队中的 PR 时，释放出的槛位保持空置，不触发任何派发」）⇒ 空置本身符合协议，不是漂移；同时它也意味着**当前无闲置可派发对象**，瓶颈在 pr-002 这一单点，而非槛位。
- **串行链长度提示（事实陈列，不做建议）**：剩余 8 个 PR 全部位于 `pr-002 → pr-003 → pr-004 → {pr-007,008,009,010}` / `pr-003 → {pr-006, pr-010}` 这条单链下游，即在 pr-002 合并前，可并发度恒为 1。

---

## 发现的不一致

1. **`history.md` 缺少 merge 与派发记录，落后于 `status.md` 更新日志。** `status.md` 更新日志声称已发生「pr-001 与 pr-005 完成全链（planner → dev → verifier → merge）、两个 verifier 结论均 PASS、槛位释放 ×2、重扫依赖图后 pr-002 解锁并派发 planner」，而 `history.md` 的**最后一条记录为 `### 2026-09-15 15:04:40 · 派发 · dev`**，其后无任何条目（`grep -n "^### 2026-09-15 15:0[4-9]\|15:1\|15:2" history.md` 仅返回 3 条：15:04:13 / 15:04:40 / 15:04:40）。协议要求「每次派发、收到报告、槛位释放/爬升、PR 失败或阻塞判定时…追加 history.md 记录」（`workflow-pb.md:516`）。缺项清单（由 `status.md` 声称 + 迭代分支 merge commit 推出，均可 git 核实）：pr-001/pr-005 的 dev 报告接收、verifier 报告接收 ×2、merge/槛位释放 ×2、pr-002 派发。（git 面本身完整：两个 merge commit 与两份 PASS 报告都存在。）
2. **迭代分支上的 `status.md` 是过期版本，工作区副本未提交。** `git show 4be4661:docs/iterations/0025-hub-sdk-and-skill/status.md` 与工作区副本 `git diff` 为 **+39 / −35**；分支上那份仍写「**当前阶段**: 阶段 4 完成（阶段 5 待授权）」、`| 5 | PR 实现 | ⬜ | ⬜ | **未授权** |`、pr-001 / pr-002 / pr-005 三行均为 `⬜ 排队(等待槛位)`；工作区副本则是「阶段 5 ⏸、2/10 已合并」。`history.md` 同样为工作区改动未提交（分支上 61 行、工作区 100 行）。即：这两份「进度视图」当前只存在于工作区，任何从迭代分支检出的读取面（含 PR worktree）看到的都是阶段 5 未启动的旧视图。
3. **分支上那份 `status.md` 的一句表述与 `prs/pr-002` 的声明冲突。** 该旧版本写「根节点 pr-001 / pr-002 / pr-005 可立即起」，而 `prs/pr-002-sdk-router-uds-channel.md` 的 `## depends_on` 明确声明 `pr-001-…`（理由段引 `architecture.md` §2.1 的 `ERR -.-> UDS` 边，该边在 L160 确实存在）⇒ pr-002 **不是根节点**。工作区副本已无该句（其「待确认项」为「（无）」，PR 表 pr-002 行已标为依赖 pr-001 的 ⏸ 态），故本条只指向未提交的分支旧版本。
4. **`status.md` 表格列语义存在一处需读者自行消歧的地方**（事实陈列）：PR 子状态表「已合并」列填的是**合并 commit**（pr-001 → `f9327ad`、pr-005 → `4be4661`），而非各 PR 分支的 tip（`0eb2d72` / `17a57c5`）。两值都真实存在且语义不同，表格未标注是哪种，核对时需回到 `git log --merges` 才能对齐。

---

## 无法核实项

- **pr-002「派发中」这一执行态**：git 面零痕迹（无提交、无未跟踪文件、无 `prs/pr-002-tasks.md`、分支 tip 等于 base）。可核实的只有「worktree 已建且 base 正确」。派发动作本身不产生 git 记录，故该状态在 git 一手记录下**无法核实**。
- **阶段 4 四项推进条件中的三项**：协议四项为「每个 PR 文件满足格式规范 / `prd/*.md` 中每个功能点被某个 PR 引用 / PR 间文件范围无重叠 / 依赖图无环」（`workflow-pb.md` 阶段定义表）。我只独立复算了第 4 项（**无环，通过**）与第 1 项的形式面（**10/10 文件 7 个字段标题齐备**）；第 2、3 项需要内容面比对（功能点引用矩阵、17 个文件范围互斥性），非 git ref 可判，**未核实**。
- **阶段 3 输出契约「`prd/*.md` 中 `[架构待填]` 项补全」的落实形态**：迭代分支 tip 上，`prd/` **卡文件内仍存 21 处** `[架构待填]` 文本（F13 3 / F10 3 / F12 2 / F11 2 / F01 2 / G03 1 / F14 1 / F08 1 / F07 1 / F06 1 / F05 1 / F04 1 / F03 1 / F02 1；F09 / G01 / G02 为 0），另有 **14 处**在 `prd.md` 内（多为「架构落定（阶段 3）」回指段）。抽读卡内命中位置（如 `F13:29-30` 的「→ `[架构待填]` T-05」）为**边界段的前向指针**，而 `architecture.md` §6 提供 `T-01~T-09 逐项落定汇总 ✅（9/9）`。两种落实形态（就地改写卡片 vs 在 architecture.md 汇总回填）哪一种才算满足该输出契约，**无法由 git 一手记录判定**；`status.md` 与 `history.md` 均未就「卡内标记是否清除」作任何声称，故不记入「不一致」。
- **依赖 `depends_on` 理由段的实质成立性**：我只核实了「被依赖 PR 是否真的合并进迭代分支」这一可判事实，并对每条理由引用的 `architecture.md` §2.1 边做了存在性抽样（全部命中）。理由段中「某导出符号会被下游 import」这类**未来时**断言（如 pr-002 依赖 `HubError`、pr-004 依赖 `cli.js` 的 `main`）在依赖 PR 尚未合并时无法核实其最终形态，**未核实**。
- **各 PR「验收标准全部通过 / 无简报外改动」（阶段 5 推进条件）**：属内容面判定，我只登记了 pr-001 / pr-005 的 verifier 报告存在且结论为 PASS 这一文件级事实，不重复判定其判定是否成立。
- **`status.md` / `history.md` 中所有「用户确认 / 用户授权」类声明**（方案确认门通过、阶段 5 授权、15 项决策 `user_confirmed`）：用户侧动作不留 git 痕迹，**无法核实**；可核实的只有 `demand.md` / `status.md` 文本内的记录本身存在。
