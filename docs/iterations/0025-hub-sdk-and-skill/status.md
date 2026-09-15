# 工作流进度

**工作流**: workflow-pb v0.12.0
**迭代**: 0025-hub-sdk-and-skill
**当前阶段**: 阶段 5（PR 实现）
**迭代分支**: iteration/0025-hub-sdk-and-skill（tip `ec7fc84`）
**工作区地址**: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0025-hub-sdk-and-skill
**状态**: 进行中
**history**: 开启
**方案确认门**: enabled
**执行方式**: 本地 sub agent（宿主 `task` 工具）派发；阶段 1 由主 agent 内联执行

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | `demand.md` v1.0.1：15 项决策全 `user_confirmed` |
| 2 | 功能规格 | ✅ | ⬜ | `prd.md` v0.1.0 + 17 张卡 |
| 3 | 技术架构 | ✅ | ⬜ | `architecture.md` v1.0.0（687 行）；T-01~T-09 全落定 |
| 4 | PR 规划 | ✅ | ⬜ | `prs/` 10 个 PR 文件 |
| 5 | PR 实现 | ⏸ | ⬜ | **9/10 已合并**；pr-009 返工中 |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## 并发配置（阶段 5）

- **起始并发数**：3　**硬上限**：5　**当前有效上限**：5
- **累计槛位释放次数**：8　**已派发总数**：10
- 实测并发波形：**2 → 1 → 1 → 2 → 4**；槛位从未成为瓶颈（瓶颈是依赖图的单链中部）

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-sdk-error-contract-and-web-channel.md | （无） | ✅ | feat/0025-pr-001-… | ✅ `f9327ad` | 已释放 |
| pr-002-sdk-router-uds-channel.md | pr-001 | ✅ | feat/0025-pr-002-… | ✅ `14ca2cf` | 已释放 |
| pr-003-sdk-entry-surface-cli-and-doctor.md | pr-001, pr-002 | ✅ | feat/0025-pr-003-… | ✅ `453326c` | 已释放 |
| pr-004-sdk-dual-entry-and-hub-harness.md | pr-003 | ✅ | feat/0025-pr-004-… | ✅ `3ba06dd` | 已释放 |
| pr-005-hub-skill-and-content-check.md | （无） | ✅ | feat/0025-pr-005-… | ✅ `4be4661` | 已释放 |
| pr-006-sdk-surface-coverage-test.md | pr-003 | ✅ | feat/0025-pr-006-… | ✅ `b93fead` | 已释放 |
| pr-007-sdk-api-behavior-test.md | pr-001, pr-003, pr-004 | ✅ | feat/0025-pr-007-… | ✅ `f4b6aa7` | 已释放 |
| pr-008-sdk-uds-behavior-test.md | pr-002, pr-004 | ✅ | feat/0025-pr-008-… | ✅ `46969a0` | 已释放 |
| pr-009-sdk-cli-contract-test.md | pr-004 | **❌FAIL(现场保留)** | feat/0025-pr-009-… | ⬜ | 已释放（返工中） |
| pr-010-sdk-doctor-test.md | pr-003, pr-004 | ✅ | feat/0025-pr-010-… | ✅ `ec7fc84` | 已释放 |

> 注：pr-009 的 worktree 与分支**原样保留**（协议：不得对其执行 `git worktree remove` / `git branch -d`）；它正在第 2 轮返工，返工后重新走验收。

## 待确认项

- [ ] **pr-011（收口修复 PR）**：待 wave 5 全部合并后，按用户口径**跑一次全量测试**并据此生成。已知必含项 = `oamp/sdk/http.js` 5000ms 响应头上限先行于 `--wait`（block 调用超 5s 拿不到终态，实测 5048ms → `REQUEST_TIMEOUT/3` 而非规格要求 `WAIT_TIMEOUT/1`）

## 跨 PR 契约与冻结口径（下游按此接入）

- `oamp/sdk/errors.js` → `HubError` / `classify(observation)` / `serializeError(err)`
- `oamp/sdk/http.js` → `request(spec)` / `stream(spec)`，`spec = {port, method, path, query, body, waitMs}`
- `oamp/sdk/uds.js` → `connect(opts)`（`opts` 可含 `socketPath` / `onDeliver`）
- `oamp/sdk/surface.js` → `LAYERS` / `ENTRIES`(40) / `createSurface(opts) → {ctx, api, uds, cli}`
- `oamp/sdk/cli.js` → `main(argv)` 返回数字
- `oamp/sdk/doctor.js` → `check({apiDocPath?, port?}) → {pass, items}`
- `oamp/sdk/index.js` → `createHub({port, socketPath}) → {api, uds, cli, doctor}`
- `oamp/test/helpers/hub-harness.js` → `runHub(args, {env, input, timeoutMs}) → {code, stdout, stderr}`
- **端口段（主 agent 冻结）**：pr-007 `51000-51999`／pr-008 `52000-52999`／pr-009 `53000-53999`／pr-010 `54000-54999`
- **两条跨 PR 已知约束**：① `createHub({socketPath})` 不达 `doctor` 的 R3；② 库面读**调用方进程 env**

## 更新日志

- 2026-09-15: 工作流启动；阶段 1 内联执行完成；阶段 2 / 3 / 4 依次完成；方案确认门通过；用户授权阶段 5
- 2026-09-15: wave 1~4 完成（pr-001 / pr-005 / pr-002 / pr-003 / pr-004 / pr-006 全链通过并合并）
- 2026-09-15: **wave 5 四路并发**（pr-007 ~ pr-010 的 planner / dev / verifier 三阶）——pr-007 / pr-008 / pr-010 验收 PASS 并合并；**pr-009 验收 FAIL**（主 agent 裁决未落地 + 2 处判别力问题），已唤醒其 dev 返工
- 2026-09-15: `progress-observer` 独立核实曾发现两处记录漂移（history 缺记 + 状态视图未提交），已修正
