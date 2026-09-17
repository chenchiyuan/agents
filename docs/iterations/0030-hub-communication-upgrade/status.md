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
- **当前有效上限**：**5**（`min(3 + 1×3, 5)`，pr-001 合并后触发首次爬升并触及硬上限）
- **累计槛位释放次数**：**1**（pr-001 成功合并）
- **已派发总数**：**5**（planner ×3 + dev ×2）

## PR 实现子状态（阶段 5 展开）

**依赖图**（权威 = PR 文件的 `depends_on` + 下方子状态表）：`pr-001✅/002/003/004`（无依赖，batch 1）→ `pr-005` → `{pr-006, pr-008}`；`pr-007`（无依赖）独立。关键路径 = 3（`pr-004 → pr-005 → pr-006` 或 `pr-001 → pr-005 → pr-008`）。

> 更正记录（2026-09-17 15:26）：本行原写「`pr-008（无依赖）→ pr-007`」属阶段 4 返工前的旧图，与 PR 文件 `depends_on`、子状态表、已解锁集三处相斥；由 `planner`（pr-007）上报后修正（它的报告同时指出 `tools/check-model-dispatch-protocol.sh` 在本迭代布局下必然整体失败：V-01 要求 worktree 名带 `agents-` 前缀、V-04 要求 `agent-routing.yaml`——已登记为跨迭代候选，本迭代不改该工具）。

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-reason-mapping-module.md | （无） | ✅ | (已清理) | ✅ `f81d5c6` | 已释放（槛位释放 1） |
| pr-002-pool-routing-module.md | （无） | ⏸ | feat/0030-pr-002-pool-routing-module | ⬜ | **占用**（dev 在途 @ gpt） |
| pr-003-inbox-table-persistence.md | （无） | ⏸ | feat/0030-pr-003-inbox-table-persistence | ⬜ | **占用**（dev 在途 @ gpt） |
| pr-004-idle-net-turn-timers.md | （无） | ⏸ | feat/0030-pr-004-idle-net-turn-timers | ⬜ | **占用**（planner 在途） |
| pr-005-web-inbox-and-pool-wiring.md | pr-001✅、pr-002、pr-003、pr-004 | ⬜ | | ⬜ | 排队(依赖未满足：001 已满足，002/003/004 未合并) |
| pr-006-api-docs-sync.md | pr-004、pr-005 | ⬜ | | ⬜ | 排队(依赖未满足) |
| pr-007-model-routing-and-process-evidence.md | （无） | ⏸ | feat/0030-pr-007-model-routing-and-process-evidence | ⬜ | **占用**（planner 在途） |
| pr-008-existing-surface-guard.md | pr-005 | ⬜ | | ⬜ | 排队(依赖未满足) |

> 在飞 4 个（≤ 当前有效上限 5）。已合并 1/8。**欠账（现已全部出清）**：① ~~`architecture.md` §4 A-04 表展示微调~~ **已完成**（architect）；② ~~已合并 PR 的验收复选框勾选~~ **已完成**；③ ~~`pr-002-pool-routing-module-tasks.md` 旧判据口径~~ **已完成**（pr-planner 2026-09-17 15:57，22 处同步、执行证据段逐字节未动）；④ ~~`pr-008` 的 G01 零回归判据缺例外括注~~ **已完成**。

> **PR 集合已按验证反馈返工**：9 → 8 个（`pr-007` = 旧 007+008 合并，覆盖 F08+F09；原 009 重编号为 `pr-008`，覆盖 G01）。**已解锁集** = {pr-001, pr-002, pr-003, pr-004, pr-007}（5 个无依赖）；首轮按起始并发 3 派发前 3 个。

## 派发台账（阶段 2~6；模型归属为本次执行方式约束第 3 条要求）

| 时点 | 角色 | 用途 | 通道 | 子 agent 自报模型 | 耗时 | 状态 |
|---|---|---|---|---|---|---|
| 12:18 | prd | 阶段 2 · 功能规格 | 本地 subagent | `deepseek/deepseek-v4-flash` | 4m45s | ✅ |
| 12:23 | architect | 阶段 3 · 技术架构 | 本地 subagent | `deepseek/deepseek-v4-flash` | 7m58s | ✅ |
| 12:34 | pr-planner | 阶段 4 · PR 规划 | 本地 subagent | `deepseek/deepseek-v4-flash` | 3m26s | ✅ |
| 12:35 | prd（续做） | 索引收口 | 本地 subagent | `deepseek/deepseek-v4-flash` | <1m | ✅ |
| 13:57 | dev（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** ✅ | <1m | ✅ |
| 13:57 | verifier（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** ✅ | <1m | ✅ |
| 14:00 | verifier（PrsVerifier） | 阶段 6 · 验 `prs/`（Gate 首轮） | 本地 subagent（agent=verifier） | `powerby/grok-4.6` ✅ | 15m54s | ✅ PASS（3 partial） |
| 14:24 | verifier（PrsVerifier 复验） | Gate 返工后靶向复验 | 本地 subagent（agent=verifier） | `powerby/grok-4.6` ✅ | ~5m | ✅ PASS（0/0/0） |
| 14:33 | planner ×3（pr-001/002/003） | 阶段 5 · 各 PR 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash`（pr-001/pr-003 已回报） | 5m16s / 在途 / 9m27s | ⏸ |
| 14:41 | **dev（pr-001）** | 阶段 5 · pr-001 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** ✅ | 3m59s | ✅ 提交 `9cb5042` |
| 14:44 | **dev（pr-003）** | 阶段 5 · pr-003 实现＋自证 | 本地 subagent（**agent=dev**） | 待回报 | — | 在途 |
| 14:46 | **verifier（pr-001）** | 阶段 5 · pr-001 独立验收 | 本地 subagent（**agent=verifier**） | 待回报 | — | 在途 |

## 待确认项

（无——方案确认门、L1-01、疑问 B/C、MI-1~MI-12 均已裁决；L1-01 落地物为**工作区外**的用户级配置，已在 `model-routing-carrier`（pr-007 产物）与 history 留痕）

## 更新日志

- 2026-09-17：建立迭代工作区（base `706e3d0`）；阶段 1~4 依次落盘并入库（`bc77fdd` / `bab9102` / `6eb8ed7` / `5c73461` / `9f071b8`）。
- 2026-09-17：用户确认完整方案并指示"使用 subagents 推进直到交付"；L1-01 采纳候选 B 并实测生效（dev=gpt / verifier=grok）；阶段 3 补标 ✅；派发 `PrsVerifier`（grok）补跑 Gate 要求的 `prs/` 独立验证。
