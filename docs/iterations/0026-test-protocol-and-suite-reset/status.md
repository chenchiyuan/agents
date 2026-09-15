# 工作流进度

**工作流**: workflow-pb v0.12.0
**迭代**: 0026-test-protocol-and-suite-reset
**当前阶段**: 阶段 5（PR 实现）
**迭代分支**: `iteration/0026-test-protocol-and-suite-reset`（tip `cb248dd`；base = `main` @ `ea8943e`）
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0026-test-protocol-and-suite-reset
**状态**: 进行中
**history**: 开启
**方案确认门**: enabled — **已行使完毕**（阶段 3→4 处暂停，用户据此完成 Q15~Q19 五项裁决；阶段 3 无 L1，故放行）
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发；阶段 1 由主 agent 内联执行

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ✅ | `demand.md` **v1.2.0**：19 项决策全 `user_confirmed` |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` **v0.3.0** + **3 张卡**（F01 / F02 / F09）；0 条 `[架构待填]` |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` **v0.2.0**：**L1 = 无、L2 = 无、新增实体 = 0** |
| 4 | PR 规划 | ✅ | ⬜ | `prs/` **3 个 PR 文件**；四项推进条件核查通过 |
| 5 | PR 实现 | ⏸ | ⬜ | **2/3 已合并**（pr-002 / pr-001，两份验证均 PASS）；pr-003 verifier 进行中 |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 并发配置（阶段 5）

- **起始并发数**：3
- **硬上限**：5（公式 `2×起始-1`）
- **当前有效上限**：**5**（`min(3 + 2×3, 5)`；因两次合并释放槛位而爬升至硬上限并封顶）
- **累计槛位释放次数**：**2**（pr-002、pr-001 各 1 次）
- **已派发总数**：3
- **已解锁且排队中**：无（3 个 PR 已全部派发）⇒ 释放出的槛位按协议保持空置，不触发新派发

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-test-assets-zeroing.md | （无） | ✅ | feat/0026-pr-001-test-assets-zeroing（`f4dc4b8` → 归档 `159ca44`） | ✅ `cb248dd` | 已释放 |
| pr-002-stage5-output-contract-drop-tests.md | （无） | ✅ | feat/0026-pr-002-stage5-output-contract-drop-tests（`cff511d` → 归档 `2e3b700`） | ✅ `b3022be` | 已释放 |
| pr-003-impact-surface-registration.md | （无） | ⏸ 验证中 | feat/0026-pr-003-impact-surface-registration（`f98c985`） | ⬜ | 占用 |

> 三个 PR 的 `depends_on` 全为空 ⇒ 无「依赖解锁」发生（判据读取边归阶段 6，Q-PR-1 裁决）。

## 两份独立验证结论

| PR | 验证者身份 | 结论 | pass | fail | partial | blocked | 偏差 |
|---|---|---|---|---|---|---|---|
| pr-002 | 工作流协议文档的独立逐字审计者 | **PASS** | 22 | 0 | 0 | 0 | 4 |
| pr-001 | 版本库卫生审查者（repo-hygiene / deletion-cutover） | **PASS** | 34 | 0 | 0 | 0 | 6 |

两份报告的偏差全部为「文档同步类」（PR 文件措辞与实现形态的差异、行号位移、计数口径），实证均不影响判定。

## 待确认项

（无）

## 已确认项

- **迭代容器（2026-09-15）**：新开 0026；0025 按现状跑完
- **存量测试全删**（Q8）：`oamp/test/**`（含 `helpers/`）+ `package.json` 的 `scripts` 容器 + `oamp/README.md` 两处（`:195` 片段 / `:101-102`）+ `oamp/scripts/testenv.mjs` 整文件（Q18）
- **本次只改工作流阶段 5 输出契约那一行**（Q7，已由 pr-002 落地）
- **维护主体**：新增横切角色（暂名 test-keeper），本次先不做（Q10）
- **测试协议整块移出 0026**（Q15）／**变更历史不留痕**（Q16）／**`oamp/src/cluster-config.js:19` 只登记不处置**（Q19）
- **Q-PR-1**：pr-003 的 `depends_on` 保持「（无）」，跨 PR 判据归阶段 6
- **三条全迭代判据口径**：① diff 基线取 `bffc336` ② 阶段 5 产物 `prs/*-tasks.md` 不计入「改动面封闭」类判据面 ③ 判据编号以 `prd/*` 功能卡序号为准
- **两条 PR 内形态裁决**：pr-001 的 T4 `:195` 为**片段删除**；T3 **整块移除 `scripts` 键**（不留 `{}` 空容器）

## 需主 agent 关注的事故与登记（progress-observer 独立核实过）

- **越界写入事件（已复原）**：pr-001 的 dev 用 `edit` 工具的相对路径形态时被解析到**会话 cwd（仓库主工作区）**，误写 `oamp/package.json` 与 `oamp/README.md`；已 `checkout` 复原。**主 agent 与 progress-observer 两方独立核实**：主工作区 `oamp/` 面 `diff --stat` 与 `status --porcelain` 均为空，两文件与 HEAD 逐字节一致
- **根因（工具面）**：`edit` / `grep` 的**相对路径按会话 cwd 解析**，不按「工作区地址」解析。后续所有派发已显式禁止相对路径形态（pr-001/pr-002/pr-003 的 verifier 简报均含此约束）
- **主工作区其余 4 处改动**（`roles/demand/*`、`roles/pr-planner/*`）mtime 15:32–16:01，内容指向 0025 迭代的 skill 改进 ⇒ **用户自己的未提交工作，早于本迭代开工（17:22）**，本迭代零触碰
- **history.md 条目时刻超前于承载提交**（progress-observer 报，1–6 分钟）：主 agent 按「事件发生时刻」记录，提交在之后发生。登记为已知的记录层特性，不影响 git 面的真实性

## 更新日志

- 2026-09-15: 工作区建立（`ea8943e`）；阶段 1（`21f7bea`）→ 阶段 2（`02fcc33`）→ 阶段 3 v0.1.0（`a0fa71c`）
- 2026-09-15: **方案确认门**；用户裁决 Q15~Q19；回退阶段 2（`5aa8461`）
- 2026-09-15: `architecture.md` v0.2.0 + `prd.md` v0.3.0 + `demand.md` v1.2.0（`75d567f`）
- 2026-09-15: 阶段 4 完成（`bffc336`）；阶段 5 启动 + 3 个 PR worktree + 首波 planner（`7d5c954`）
- 2026-09-15: 三条全迭代判据口径裁决（`2cb66f1`）
- 2026-09-15: **pr-002 全链完成** → merge `b3022be`；槛位释放 ×1
- 2026-09-15: pr-001 dev 报告越界写入事故（已复原，独立核实），记录于 `58210bf`
- 2026-09-15: **pr-001 全链完成** → merge `cb248dd`；槛位释放 ×2，有效上限封顶 5
- 2026-09-15: `progress-observer` 独立快照产出（`progress.md`），发现 4 处 status 视图滞后（本次已修正）与 6 项无法核实项
