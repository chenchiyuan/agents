# pr-008 · 既有面保持的证据面（G01）

## 上下文摘要

G01 是保证项卡（不引入新能力），它的可独立验收载体 = **一份逐条对照的零回归证据文档**。本 PR **只写这一份文档、零运行时代码改动**：其验收所指向的代码面在本迭代本身就是零改动（`transport.js` / `router.js` / `registry.js` / `context-pool.js` / `role-binding.js` / `principals.js` / `inbox.js` / `cluster-config.js` / `cluster.json` / `sdk/**` / `web/**` / `roles/**` —— 它们是**比对基准**，只被读取与核验，故不进入"文件范围"字段）。判据全部可取：事件类集合比对、键集断言、路由条数、`git diff` 零改动核验、`hub doctor` R1 双向比对。

## 涉及功能点

- G01

## 文件范围

- docs/iterations/0030-hub-communication-upgrade/evidence/g01-existing-surface.md（新建）

## 验收标准

- [ ] `evidence/g01-existing-surface.md` 对 G01 验收 1~12 **逐条**给出判据与可核验证据（变更面 diff / 迭代前后事件类集合比对 / 响应键集断言 / 路由条数 / `git diff --stat` 零改动面核验），12 条结论全为"不回归"；任一条不成立 ⇒ 本 PR 不通过
- [ ] 逐条的可核验形态示例（文档须至少覆盖这些事实）：① SSE 事件类集合与语义逐字不变（4 条推送面、事件类不增不减不改名；失败终态 `call_result` 帧仅 payload 多一个 `reason` 键）；② `state` 仍四值、取消仍落 `failed`；③ 失败态信封保留 `error` 原键位与原值（含既有文案），不新增 `detail` 键；④ 取件两端点参数名（`principal` / `epoch`）、响应键集与键序、确认语义不变；⑤ Router 任务表仍纯内存（`inbox` 只承载收件箱）；⑥ 无产物字段与产物核实；⑦ UDS 路径与 worktree 隔离协议零改动；⑧ hub 不启停/不伸缩实例、无无状态均衡；⑨ `transcript` 截断与惰性启动竞态未修；⑩ 无新增必填参数、既有响应字段集与取值域不变；⑪ 只绑 `dev` / `verifier`、模型值不入 `roles/**`、`cluster.json` 零改动；⑫ 无 `demand.md` 之外的新增功能点
- [ ] 零改动面可核验为零改动：`oamp/cluster.json`、`roles/**`、`oamp/src/router.js`、`oamp/src/registry.js`、`oamp/src/context-pool.js`、`oamp/src/role-binding.js`、`oamp/src/transport.js` 在本迭代的 diff 中**零改动**；`oamp/package.json` 的 `dependencies` 仍为 `{}`
- [ ] 既有 HTTP 路由不增不减：`GET /api/docs` 的 `routes` 条数**与迭代前同值**（本迭代前实测 = **29**；复核命令 `awk '/^export function createApiRoutes/,/^export function projectRoutes/' oamp/src/web.js | grep -cE "^      method: '"`、`grep -cE "^- (GET|POST) /api/" oamp/llms.txt`、`oamp/llms.txt` 头部 `## 接口（29 条）` 三处同值），且 `hub doctor` 的 R1 双向比对通过

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/prd/G01-existing-surface-preserved.md（验收 1~12）
- docs/iterations/0030-hub-communication-upgrade/architecture.md §6（逐条对 G01 验收 1~12 的满足方式）、§1.3 既有面硬约束
- oamp/src/transport.js（事件类集合与语义的唯一实现面）、oamp/sdk/doctor.js:44-70（R1 双向清单比对）、oamp/llms.txt（接口条数快照）

## depends_on

- pr-005-web-inbox-and-pool-wiring.md（理由：G01 验收 3 / 4 的"改动前 vs 改动后"比对对象由 `web.js` 产出，改动落地后才有可对照的终态；证据：`error` 的键位与取值形态来自 `oamp/src/web.js:539-558` 的 `composeCallEnvelope`（`web.js:555` 的 `structured_output_invalid` 覆写）与 `call.terminal` 写入（`web.js:2222`）；取件两端点契约在 `web.js:1613-1643` 与 `web.js:1776-1801`；这三处正是 pr-005 的改动对象 ⇒ 无它则无可比对的"改动后"基准）

## batch

3
