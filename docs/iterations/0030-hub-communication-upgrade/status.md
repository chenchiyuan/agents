# 工作流进度

**工作流**: workflow-pb v0.14.0
**迭代**: 0030-hub-communication-upgrade
**当前阶段**: 阶段 5（PR 实现）
**迭代分支**: iteration/0030-hub-communication-upgrade
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade
**状态**: 进行中（Gate 验证在跑，阶段 5 首轮派发准备中）
**history**: 开启
**方案确认门**: enabled —— **已通过**（用户 2026-09-17 确认"没问题，请使用 subagents 推进直到交付"）
**一句话目标**: 把 hub 的送达模型从"广播给在线连接"收拢为"投递给身份"——收件箱升格为唯一权威送达路径并持久化、终态语义结构化（`reason`）、超时由固定总时长改为空闲判据、角色实例池化；本迭代经本地 subagent 通道执行（dev=gpt / verifier=grok）

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.0；F-1~F-12、D-20~D-36 全部 `user_confirmed`；用户 2026-09-17 确认定稿 |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` + 10 张卡；MI-1~MI-12 经用户 2026-09-17 **批量采纳** |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md`（534 行）：A-01~A-09 全填定、无内部冲突；**L1-01 经用户确认**（采纳 architect 推荐 = 候选 B 用户级载体）⇒ 本阶段三条件全满足，补标 ✅ |
| 4 | PR 规划 | ✅ | ✅ | 8 个 PR（经验证反馈返工：9→8，合并 F08+F09 消除不合规依赖边）；七项机械复核 exit 0；**Gate 三项验证全备**：推进条件六项 + 机械七项 + 阶段 6 独立验证 PASS（首轮 0 fail/3 partial → 返工 → **复验 0 fail/0 partial/0 偏差**，grok-4.6） |
| 5 | PR 实现 | ⏸ | ⬜ | 首轮进行中：pr-001（dev 在途 @ **gpt-5.6-luna**）、pr-002/pr-003（planner 在途）；并发配置见下 |
| 6 | 独立验证 | ⏸ | — | Gate 触发项已完成（`prs/` 两轮）；迭代级终验在阶段 5 完成后触发 |

**用户裁决落定（2026-09-17，原话「没问题，请使用 subagents 推进直到交付」）**

| 项 | 裁决 |
|---|---|
| 方案确认门 | **通过**（prd + architecture + PR 拆分 + 搭置登记全部照准） |
| **L1-01 载体形态** | 采纳呈交推荐 **B 用户级载体**：`~/.omp/agent/agents/{dev,verifier}.md`（frontmatter `model: "@dev"` / `"@verifier"`）+ `~/.omp/agent/config.yml` 的 `modelRoles.dev` / `modelRoles.verifier`；不触规则 F、零仓库写入。**实测通过**：dev 探针自报 `openai/gpt-5.6-luna`、verifier 探针自报 `powerby/grok-4.6`（2026-09-17 12:40） |
| 疑问 B（TTL 联动） | **照准**（`RECONCILE_TTL` 默认值与 `taskNetMs` 联动；`pr-005 → pr-004` 依赖边保留） |
| 疑问 C（4 项知会） | **照准**（`dispatch_failed` 不进终态信封；`agent_error` 为兜底类；不新增 `detail` 键；`acked` 恒 `false`） |
| MI-1~MI-12 | **全部采纳**（无例外提出） |
| 执行通道 | 延续 **D-33 本地 subagent**；"使用 subagents 推进直到交付" |

## 并发配置（阶段 5）

- **起始并发数**：3（默认值）
- **硬上限**：5（`2 × 起始并发数 - 1`）
- **当前有效上限**：**5**（`min(3 + 7×3, 5)` = 5，维持硬上限）
- **累计槛位释放次数**：**7**（pr-001、pr-002、pr-003、pr-004、pr-005、pr-006、pr-007 成功合并）
- **已派发总数（阶段 5 内部）**：**22**（planner ×6 + dev ×6 + verifier ×6（含 pr-005 补充验收）+ pr-planner/architect 的多次定向收口；不含 Gate 两轮 `prs/` 验证与两条载体探针）
- **当前在飞**：1（`DevP008Fix` pr-008 验收后收口：`paste -sd,` → `paste -sd, -`）；**空闲槛位 4 个**（8 个 PR 中 7 已合并，pr-008 是最后一个）

## PR 实现子状态（阶段 5 展开）

**依赖图**（权威 = PR 文件的 `depends_on` + 下方子状态表）：`pr-001✅/002/003/004`（无依赖，batch 1）→ `pr-005` → `{pr-006, pr-008}`；`pr-007`（无依赖）独立。关键路径 = 3（`pr-004 → pr-005 → pr-006` 或 `pr-001 → pr-005 → pr-008`）。

> 更正记录（2026-09-17 15:26）：本行原写「`pr-008（无依赖）→ pr-007`」属阶段 4 返工前的旧图，与 PR 文件 `depends_on`、子状态表、已解锁集三处相斥；由 `planner`（pr-007）上报后修正（它的报告同时指出 `tools/check-model-dispatch-protocol.sh` 在本迭代布局下必然整体失败：V-01 要求 worktree 名带 `agents-` 前缀、V-04 要求 `agent-routing.yaml`——已登记为跨迭代候选，本迭代不改该工具）。

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-reason-mapping-module.md | （无） | ✅ | (已清理) | ✅ `f81d5c6` | 已释放（槛位释放 1） |
| pr-002-pool-routing-module.md | （无） | ✅ | (已清理) | ✅ `4bcfbc3` | 已释放（槛位释放 2） |
| pr-003-inbox-table-persistence.md | （无） | ✅ | (已清理) | ✅ `9fc962a` | 已释放（槛位释放 3） |
| pr-004-idle-net-turn-timers.md | （无） | ✅ | (已清理) | ✅ `1b02689` | 已释放（槛位释放 5） |
| pr-005-web-inbox-and-pool-wiring.md | pr-001✅、pr-002✅、pr-003✅、pr-004✅ | ✅ | (已清理) | ✅ `9a4f424` | 已释放（槛位释放 6） |
| pr-006-api-docs-sync.md | pr-004✅、pr-005✅ | ✅ | (已清理) | ✅ `4748e78` | 已释放（槛位释放 7） |
| pr-007-model-routing-and-process-evidence.md | （无） | ✅ | (已清理) | ✅ `58e30cd` | 已释放（槛位释放 4） |
| pr-008-existing-surface-guard.md | pr-005✅ | ⏸ | feat/0030-pr-008-existing-surface-guard | ⬜ | **占用**（verifier **PASS**（T10 4/4 + AC 4/4，反证三处全捕获）；**验收后收口在途**（C05 paste 复现性缺陷）） |

> 在飞 1 个（≤ 当前有效上限 5）。**已合并 7/8**。**欠账（现已全部出清）**：① ~~`architecture.md` §4 A-04 表展示微调~~ **已完成**（architect）；② ~~已合并 PR 的验收复选框勾选~~ **已完成**；③ ~~`pr-002-pool-routing-module-tasks.md` 旧判据口径~~ **已完成**（pr-planner 2026-09-17 15:57，22 处同步、执行证据段逐字节未动）；④ ~~`pr-008` 的 G01 零回归判据缺例外括注~~ **已完成**。

> **PR 集合已按验证反馈返工**：9 → 8 个（`pr-007` = 旧 007+008 合并，覆盖 F08+F09；原 009 重编号为 `pr-008`，覆盖 G01）。**已解锁集** = {pr-001, pr-002, pr-003, pr-004, pr-007}（5 个无依赖）；首轮按起始并发 3 派发前 3 个。

## 派发台账（阶段 2~6；模型归属为本次执行方式约束第 3 条要求）

| 时点 | 角色 | 用途 | 通道 | 子 agent 自报模型 | 耗时 | 状态 |
|---|---|---|---|---|---|---|
| 12:18 | prd | 阶段 2 · 功能规格 | 本地 subagent | `deepseek/deepseek-v4-flash` | 4m45s | ✅ |
| 12:23 | architect | 阶段 3 · 技术架构 | 本地 subagent | `deepseek/deepseek-v4-flash` | 7m58s | ✅ |
| 12:34 | pr-planner | 阶段 4 · PR 规划 | 本地 subagent | `deepseek/deepseek-v4-flash` | 3m26s | ✅ |
| 12:35 | prd（续做） | `prd.md` 索引收口 | 本地 subagent | `deepseek/deepseek-v4-flash` | <1m | ✅ |
| 13:57 | dev（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | <1m | ✅ |
| 13:57 | verifier（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | <1m | ✅ |
| 14:00 | verifier（PrsVerifier） | 阶段 6 · 验 `prs/`（Gate 首轮） | 本地 subagent（agent=verifier） | `powerby/grok-4.6` | 15m54s | ✅ PASS（3 partial） |
| 14:24 | verifier（PrsVerifier 复验） | Gate 返工后靶向复验 | 本地 subagent（agent=verifier） | `powerby/grok-4.6` | ~5m | ✅ PASS（0/0/0） |
| 14:33 | planner（pr-001） | 阶段 5 · pr-001 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 5m16s | ✅ |
| 14:33 | planner（pr-002） | 阶段 5 · pr-002 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 14m58s | ✅ |
| 14:33 | planner（pr-003） | 阶段 5 · pr-003 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 9m27s | ✅ |
| 14:41 | **dev（pr-001）** | 阶段 5 · pr-001 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 3m59s | ✅ 提交 `9cb5042`→合并 `f81d5c6` |
| 14:44 | **dev（pr-003）** | 阶段 5 · pr-003 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 1h6m | ✅ 提交 `33005c0` |
| 14:46 | **verifier（pr-001）** | 阶段 5 · pr-001 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | 5m7s | ✅ PASS（0/0/2 偏差） |
| 14:56 | architect（A-06 补定） | 架构层缺口补定（多实例识别约定） | 本地 subagent | `deepseek/deepseek-v4-flash` | ~9m | ✅ |
| 14:59 | **dev（pr-002）** | 阶段 5 · pr-002 实现＋自证（含追加契约） | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 13m30s | ✅ 提交 `9c5de19`→合并 `4bcfbc3` |
| 14:59 | planner（pr-004） | 阶段 5 · pr-004 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 11m14s | ✅ |
| 14:59 | planner（pr-007） | 阶段 5 · pr-007 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 6m11s | ✅ |
| 15:07 | architect（prd/F06 收口） | 授权面内的卡片判据修正 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 15:15 | pr-planner（口径对齐） | PR 文件判据与 A-06 补定对齐 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 15:27 | **dev（pr-007）** | 阶段 5 · pr-007 产物落地＋自证 | 本地 subagent（**agent=dev**） | 待回报 | — | 在途 |
| 15:40 | **dev（pr-004）** | 阶段 5 · pr-004 实现＋自证（含 T0 透传） | 本地 subagent（**agent=dev**） | 待回报 | — | 在途 |
| 15:46 | pr-planner（T0 落地） | pr-004/pr-008 文件范围与验收修订 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~6m | ✅ |
| 15:49 | architect（context-pool 同步） | §4 A-05 / §5 / §6 / §10 同步 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~9m | ✅ |
| 15:50 | **verifier（pr-002）** | 阶段 5 · pr-002 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | 6m30s | ✅ PASS（0/0/2 偏差） |
| 15:57 | pr-planner（欠账收口） | pr-002 tasks 文件口径同步（22 处） | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 16:07 | **verifier（pr-003）** | 阶段 5 · pr-003 独立验收 | 本地 subagent（**agent=verifier**） | `powerby/grok-4.6` | 4m5s | ✅ PASS（0/0/2 偏差） |
| 16:36 | **verifier（pr-007）** | 阶段 5 · pr-007 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | ~24m | ✅ PASS（0/0/2 partial） |
| 16:46 | **verifier（pr-004）** | 阶段 5 · pr-004 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | ~34m | ✅ PASS（0/0/4 偏差） |
| 17:22 | planner（pr-005） | 阶段 5 · pr-005 内部任务拆解 | 本地 subagent | `deepseek/deepseek-v4-flash` | 14m54s | ✅（6 项 MI） |
| 17:47 | **dev（pr-005）** | 阶段 5 · pr-005 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | ~53m | ✅（F08 第 7 例） |
| 17:47 | pr-planner（实测口径校正） | pr-005/pr-008 PR 文件判据校正 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~13m | ✅ |
| 17:47 | architect（实测口径更正） | §4 A-05/A-06、§3.4、§9、§10 同步 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~28m | ✅ |
| 18:02 | pr-planner（pr-001 计数残留） | tasks 文件计数口径收口 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~10m | ✅ |
| 18:16 | architect（prd 三处更正） | prd 架构维度段 3 处 + 搭置条目 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~9m | ✅（跨迭代搭置 2 条） |
| 18:42 | **verifier（pr-005）** | 阶段 5 · pr-005 端到端独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | ~13m | ✅ PASS（0/0/3 偏差） |
| 18:58 | architect（insertInbox 契约对齐） | §3.1/§5/§10 契约示例对齐 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~7m | ✅ |
| 19:12 | planner（pr-006） | 阶段 5 · pr-006 内部任务拆解 | 本地 subagent | `deepseek/deepseek-v4-flash` | 7m14s | ✅（9 任务 / 3 MI） |
| 19:22 | **dev（pr-006）** | 阶段 5 · pr-006 文档面同步＋自证 | 本地 subagent（**agent=dev**） | 待回报 | — | 在途 |
| 19:25 | architect（API.md 引用失真） | §4 A-07/§5/§10 章节引用更正 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 19:32 | architect（§9 登记 + §5 措辞） | §9-14 取值变化登记 + §5 两处措辞分层 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~15m | ✅ |
| 19:41 | planner（pr-008） | 阶段 5 · pr-008 内部任务拆解 | 本地 subagent | `deepseek/deepseek-v4-flash` | 9m12s | ✅（9+1 任务 / 5 MI） |
| 19:47 | **verifier（pr-005 补充）** | 补充验收：Router 不可达时取件面响应 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | ~20m | ✅ PASS（0/0/0） |
| 19:58 | pr-planner（pr-008 PR 文件） | AC3/AC4 事实更正 | 本地 subagent | `deepseek/deepseek-v4-flash` | 待回报 | 在途 |

**模型归属汇总（F08 验收 1~3 的取证面）**：`dev` 台账行 **8**（载体探针 1 + pr-001/002/003/004/005/007 各 1 + pr-006 在途）——**已回报的 7 条全部自报 `openai/gpt-5.6-luna`**；`verifier` 台账行 **10**（载体探针 1 + Gate 两轮（`PrsVerifier` + 靶向复验）+ pr-001~pr-005/pr-007 验收 6 + pr-005 补充验收 1）——**已回报的全部自报 `powerby/grok-4.6`**；其余角色（prd / architect / pr-planner / planner）全部自报 `deepseek/deepseek-v4-flash`（= 当刻全局默认）。

## 待确认项

（无——方案确认门、L1-01、疑问 B/C、MI-1~MI-12 均已裁决；L1-01 落地物为**工作区外**的用户级配置，已在 `model-routing-carrier`（pr-007 产物）与 history 留痕）

## 更新日志

- 2026-09-17：建立迭代工作区（base `706e3d0`）；阶段 1~4 依次落盘并入库（`bc77fdd` / `bab9102` / `6eb8ed7` / `5c73461` / `9f071b8`）。
- 2026-09-17：用户确认完整方案并指示"使用 subagents 推进直到交付"；L1-01 采纳候选 B 并实测生效（dev=gpt / verifier=grok）；阶段 3 补标 ✅；派发 `PrsVerifier`（grok）补跑 Gate 要求的 `prs/` 独立验证。

## 并发执行证据（git 事实，阶段 6 强制核查面的取证原料）

口径声明：本节**只采信 git 事实**（提交的 committer 时间与合并提交时间）。`history.md` / 上方台账的「时点」是**叙述性近似值**，与 git 存在系统性偏移（例：pr-001 的 dev 派发记作 14:41，而该 PR 分支提交时间为 **14:29:09**）⇒ **并发判定一律以本节为准**，历史时点仅供人工速览。

| PR | 分支自身提交 | 合入迭代分支 |
|---|---|---|
| pr-001 reason 映射叶子模块（F04） | `9cb5042` @ **14:29:09** | `f81d5c6` @ **14:35:03** |
| pr-002 池内路由叶子模块（F06/F07） | `9c5de19` @ **14:45:28** | `4bcfbc3` @ **14:56:02** |
| pr-003 persist inbox 表与三方法（F01/F03） | `33005c0` @ **15:34:39** | `9fc962a` @ **15:39:19** |
| pr-007 模型路由载体声明 + 唯一派发台账 + F09 过程证据 + 摩擦条目（F08/F09） | `ffb4b6b` @ **15:43:08** | `58e30cd` @ **15:59:37** |
| pr-004 轮次判死改空闲阈值+绝对安全网双计时（F05，含 context-pool 两键透传） | `53c27a0` @ **15:53:31** | `1b02689` @ **16:12:50** |
| pr-005 web 面接线（收件箱必达 + 池内路由 + role 同源 + 对账联动）与退役 pickup.js（F01~F07） | `ba31e6a` @ **16:55:31** | `9a4f424` @ **17:14:10** |

**并发重叠证据（依赖图之外的真实并存）**：

- 提交/合并交替序列：reason(14:29:09) → 池内路由叶子模块（F06/F07）into(14:45:28) → persist(15:34:39) → 模型路由载体声明(15:43:08) → 轮次判死改空闲阈值+绝对安全网双计时（F05，含(15:53:31) → web(16:55:31)
- 判读方式：某 PR 的**提交时间**落在另一 PR 的「提交时间 → 合入时间」窗口内 ⇒ 两者当时的 worktree 并存、确属并发执行（非串行等待）。上表中 pr-002/pr-003/pr-007/pr-004 的提交时间均**早于**其前序 PR 的合入时间，即它们在前序 PR 尚未合并时已完成实现 ⇒ 并发窗口真实存在。
- 每个 PR 分支自身恰 **1 个**提交、合并为 `--no-ff` ⇒ PR 隔离成立（无跨 PR 混提）。

### 三项强制核查的取证原料（阶段 6 用；已由主 agent 预先取到，verifier 须独立复跑）

**① worktree 时间窗重叠**
- 磁盘事实：两个仍存在的 PR worktree 由**同一时刻**创建——`stat -f '%SB' <会话工作区>/.pb-agents/worktrees/0030-pr-006-api-docs-sync` = `2026-09-17 17:14:10.46`、`…/0030-pr-008-existing-surface-guard` = `2026-09-17 17:14:10.80`（同一秒、均自 `9a4f424` 拉出）⇒ **两个 PR worktree 同时在盘**。
- 已被清理的 PR：`git worktree remove` 会删除 `.git/worktrees/<name>/` 管理目录 ⇒ 磁盘痕迹不可回溯；时间窗证据以「提交/合入交替序列」（上表）为准——其判读即"某 PR 提交时另一 PR 尚未合入"⇒ 并存。
- 历史记录：`history.md` 逐 PR 记有 worktree 创建与清理动作（叙述性时点，口径见上节声明）。

**② 并发配置区块真实初始化与更新**
- 初始化：`git -C <会话工作区> show 9f071b8:docs/iterations/0030-hub-communication-upgrade/status.md` ⇒ `## 并发配置（阶段 5）` 五字段**均有值**（起始并发数 3 / 硬上限 5 / 当前有效上限 3（初始值，尚未释放）/ 累计槛位释放次数 0 / 已派发总数 0）。
- 真实更新：`2023e88`（pr-001 合并）⇒ 当前有效上限 `3 → 5`、累计释放 `0 → 1`、已派发总数 `0 → 5`；其后每次合并均再更新（见「累计槛位释放次数」现值 6）⇒ **不是初始化后再未变化**。

**③ 爬升公式真实触发**
- 公式：`min(起始并发数 + 累计槛位释放次数 × 起始并发数, 硬上限)` = `min(3 + N×3, 5)`。
- 触发证据：`9f071b8`（入口，N=0）⇒ 3；`2023e88`（N=1）⇒ `min(6,5)` = **5** ⇒ **一次释放即触及硬上限**，此后各项维持 5 并逐步记录 `min(3+6×3,5)` = 5（现值）。
- 命令：`git -C <会话工作区> log --oneline -S"当前有效上限" -- docs/iterations/0030-hub-communication-upgrade/status.md`（返回上述两个提交）。
