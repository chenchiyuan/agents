# 工作流进度

**工作流**: workflow-pb v0.12.0
**迭代**: 0026-test-protocol-and-suite-reset
**当前阶段**: 阶段 5（PR 实现）
**迭代分支**: `iteration/0026-test-protocol-and-suite-reset`（tip `b3022be`；base = `main` @ `ea8943e`）
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
| 5 | PR 实现 | ⏸ | ⬜ | **1/3 已合并**（pr-002，验证 PASS）；pr-001 / pr-003 的 dev 进行中 |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 并发配置（阶段 5）

- **起始并发数**：3
- **硬上限**：5（公式 `2×起始-1`）
- **当前有效上限**：**5**（`min(3 + 1×3, 5)`；因 pr-002 合并释放 1 次槛位而爬升至硬上限）
- **累计槛位释放次数**：**1**
- **已派发总数**：3
- **已解锁且排队中**：无（3 个 PR 已全部派发）⇒ 释放出的槛位按协议保持空置，不触发新派发

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-test-assets-zeroing.md | （无） | ⏸ dev 进行中 | feat/0026-pr-001-test-assets-zeroing（`97b5c63`） | ⬜ | 占用 |
| pr-002-stage5-output-contract-drop-tests.md | （无） | ✅ | feat/0026-pr-002-stage5-output-contract-drop-tests（`2e3b700`） | ✅ `b3022be` | 已释放 |
| pr-003-impact-surface-registration.md | （无） | ⏸ dev 进行中 | feat/0026-pr-003-impact-surface-registration（`8440605`） | ⬜ | 占用 |

> 三个 PR 的 `depends_on` 全为空 ⇒ 直接执行依赖边的判据读取边归阶段 6（Q-PR-1 裁决），故无「新解锁」发生。

## 待确认项

（无）

## 已确认项

- **迭代容器（2026-09-15）**：新开 0026；0025 按现状跑完
- **存量测试全删**（Q8）：`oamp/test/**`（含 `helpers/`）+ `package.json` 的 `test` script + `oamp/README.md` 两处（`:195` 片段 / `:101-102` 整句）+ `oamp/scripts/testenv.mjs` 整文件（Q18）
- **本次只改工作流阶段 5 输出契约那一行**（Q7，已由 pr-002 落地）
- **维护主体**：新增横切角色（暂名 test-keeper），本次先不做（Q10）
- **测试协议整块移出 0026**（Q15）／**变更历史不留痕**（Q16）／**`oamp/src/cluster-config.js:19` 只登记不处置**（Q19）
- **Q-PR-1（2026-09-15 18:16）**：pr-003 的 `depends_on` 保持「（无）」，跨 PR 判据归阶段 6
- **三条全迭代判据口径（2026-09-15 18:24）**：
  1. **diff 基线取 `bffc336`**（各 PR 分支与迭代分支的 fork 点），不取迭代分支当前尖
  2. 本迭代阶段 5 产物 `docs/iterations/0026-*/prs/*-tasks.md` 不计入「改动面封闭 / 不新增文件」类判据面
  3. 判据编号一律以 **`prd/*` 功能卡序号**为准（PR 文件的 bullet 是其投影）

## 本迭代的性质（`demand.md` §6 / §8 已登记）

清存量不是解，是"清零重建"策略的前置动作；协议移出后，本次是**只有代价、收益待兑现**的清理。三处空缺（零回归保护窗口 / 阶段 5 失去方便判据 / 保留集空集无出口）全部依赖后续的协议迭代闭合。

## 更新日志

- 2026-09-15: 工作区建立（`ea8943e`）；阶段 1（`21f7bea`）→ 阶段 2（`02fcc33`）→ 阶段 3 v0.1.0（`a0fa71c`）
- 2026-09-15: **方案确认门**；用户裁决 Q15~Q19；回退阶段 2（`5aa8461`）
- 2026-09-15: `architecture.md` v0.2.0 + `prd.md` v0.3.0 + `demand.md` v1.2.0（`75d567f`）
- 2026-09-15: 阶段 4 完成（`bffc336`）；阶段 5 启动 + 3 个 PR worktree + 首波 planner（`7d5c954`）
- 2026-09-15: 三条全迭代判据口径裁决（`2cb66f1`）
- 2026-09-15: **pr-002 全链完成**（planner → dev → verifier PASS 22/0/0/0 → merge `b3022be`）；槛位释放 ×1，有效上限爬升至硬上限 5
