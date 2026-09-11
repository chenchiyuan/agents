# pr-001 角色标识与角色文件定位（role-binding）

## 上下文摘要

新增叶子模块 `src/role-binding.js`：把「角色名 ↔ 实例名 ↔ 角色文件路径」的映射收敛到唯一一处（`instanceIdForRole` / `roleFromInstanceId` / `resolveRoleRoot` / `resolveRoleFile`），并配纯函数单测。它是其余 PR 的公共底座——集群脚本（pr-005）与 agent 单起推断（pr-004）都消费这四个导出；公式一旦分裂，「批量起的实例」与「裸起的实例」就会人格不一致。零依赖、不碰任何既有文件，可独立合入。

## 涉及功能点

- F01
- F02

## 文件范围

- oamp/src/role-binding.js（新建）
- oamp/test/role-binding.test.js（新建）

## 验收标准

- [ ] `oamp/src/role-binding.js` 存在，导出 `instanceIdForRole` / `roleFromInstanceId` / `resolveRoleRoot` / `resolveRoleFile` 四个函数（架构 §12.2 跨组契约 2），且不 import 任何第三方包
- [ ] `instanceIdForRole('dev') === 'pb-dev'`；`grep -rn "'pb-'" oamp/src` **只**命中 `role-binding.js`（F01-1：id 无后缀、公式单点）
- [ ] `roleFromInstanceId('pb-dev') === 'dev'`；`roleFromInstanceId('dev-1')` / `roleFromInstanceId('pb-')` 返回 null（`^pb-(.+)$` 不成立即不绑定，供 pr-004 推断路径消费）
- [ ] `resolveRoleRoot(env)`：`env.OAMP_ROLE_ROOT` 非空时取该值（绝对化），否则取包根（`oamp/`）的上级目录 —— 即本仓库 `agents/`，与 `oamp/src/config.js:10` 的 `PKG_ROOT` 推导同口径
- [ ] `resolveRoleFile(root, 'dev')` 得到 `<root>/roles/dev/dev.md` 的绝对路径；`OAMP_ROLE_ROOT` 覆盖后随之改变（本模块只解析路径；文件存在性判定归调用方，见架构 §3.1/§5.1）
- [ ] `node --test test/role-binding.test.js` 全绿，不依赖真实 omp / 网络 / tmux；既有 16 个测试文件零修改

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §3.1（角色真源、命名映射、角色根解析）、§8 AR-01、§12.2 跨组契约 2
- docs/iterations/0012-roles-agent-cluster/prd/F01-role-instance-identity-lifecycle.md（验收 1/2）、prd/F02-role-definition-loading.md（验收 1）
- 仓库事实：`roles/` 下 10 个 `<role>/<role>.md`（architect/demand/dev/planner/pr-planner/prd/progress-observer/retrospective/verifier/workflow-pb）；`roles/_template`、`roles/cdp-debug-skill` 不参与（F01-2）

## depends_on

（无）

## batch

1
