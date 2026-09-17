# pr-008 · 既有面保持的证据面（G01）

## 上下文摘要

G01 是保证项卡（不引入新能力），它的可独立验收载体 = **一份逐条对照的零回归证据文档**。本 PR **只写这一份文档、零运行时代码改动**：其验收所指向的代码面在本迭代本身就是零改动（`transport.js` / `router.js` / `registry.js` / `role-binding.js` / `principals.js` / `inbox.js` / `cluster-config.js` / `cluster.json`（**仓库根**，`oamp/` 下无此文件） / `sdk/**` / `web/**` / `roles/*/*.md` 与 `roles/_template/**`（**定义面**；`roles/*/data/**` 是角色按设计写入的过程产物区，不属定义面，见 AC3 分层口径） —— 它们是**比对基准**，只被读取与核验，故不进入"文件范围"字段）；**唯一例外 = `oamp/src/context-pool.js` 的两键透传**（`idleMs` / `netMs` 沿既有选项通道透传，见 pr-004；`(chat_id, agent_id)` 键语义 / 同键 FIFO 串行 / LRU 与释放路径零改动 ⇒ A-06"池化不改 `ContextPool` 键语义"的声明依然成立）。判据全部可取：事件类集合比对、键集断言、路由条数、`git diff` 零改动核验、`hub doctor` R1 双向比对。

## 涉及功能点

- G01

## 文件范围

- docs/iterations/0030-hub-communication-upgrade/evidence/g01-existing-surface.md（新建）

## 验收标准

- [ ] `evidence/g01-existing-surface.md` 对 G01 验收 1~12 **逐条**给出判据与可核验证据（变更面 diff / 迭代前后事件类集合比对 / 响应键集断言 / 路由条数 / `git diff --stat` 零改动面核验），12 条结论全为"不回归"；任一条不成立 ⇒ 本 PR 不通过
- [ ] 逐条的可核验形态示例（文档须至少覆盖这些事实）：① SSE 事件类集合与语义逐字不变（4 条推送面、事件类不增不减不改名；失败终态 `call_result` 帧仅 payload 多一个 `reason` 键）；② `state` 仍四值、取消仍落 `failed`；③ 失败态信封保留 `error` 原键位与原值（含既有文案），不新增 `detail` 键（**本迭代前实测既有信封 = 10 键**：`call_id` / `agent` / `state` / `duration_ms` / `model` / `truncated` / `text` / `structured_output` / `error` / `exit_code`；本迭代只在失败侧追加末位 `reason`，不增删其余键）；④ 取件两端点参数名（`principal` / `epoch`）、响应键集与键序、确认语义不变；⑤ Router 任务表仍纯内存（`inbox` 只承载收件箱）；⑥ 无产物字段与产物核实；⑦ UDS 路径与 worktree 隔离协议零改动；⑧ hub 不启停/不伸缩实例、无无状态均衡；⑨ `transcript` 截断与惰性启动竞态未修；⑩ 无新增必填参数、既有响应字段集与取值域不变（**唯一例外，A-06 补定已登记**：`GET /api/agents` 的 `role` 列对 `pb-<role>-<n>` 由迭代前的 `null` 变为角色名——该 id 形态迭代前不可用，且与池成员判定同源）；⑪ 只绑 `dev` / `verifier`、模型值不入角色**定义面**（`roles/*/*.md` 与 `roles/_template/**`）——**过程产物区 `roles/*/data/**` 的验证记录会引用模型值，不属该断言范围，不得按字面 `roles/**` 核**、根 `cluster.json` 零改动；⑫ 无 `demand.md` 之外的新增功能点
- [ ] 零改动面可核验为零改动（**路径口径 = 仓库根**，且**分层**）：**(a)** `cluster.json`（**仓库根**，489 B；`architecture.md` §5 的零改动清单亦写作裸 `cluster.json`）、`oamp/src/router.js`、`oamp/src/registry.js`、`oamp/src/role-binding.js`、`oamp/src/transport.js` 在本迭代的 diff 中**零改动**，并须附**负向断言**「`oamp/cluster.json` **不存在**」（`test -e oamp/cluster.json` → 否；`git ls-tree -r --name-only <ref> -- oamp/cluster.json` → 空）——该路径在本仓库从不存在，缺此断言则该行判据会因文件不存在而**永远空转"通过"**；**(b) 角色面分层**：**定义面**（`roles/*/*.md` 与 `roles/_template/**`）**零改动**——须用 `git diff --name-only main..HEAD -- ':(glob)roles/*/*.md'`（→ 0 行）而非裸 `roles/*/*.md`（pathspec 的 `*` **默认跨 `/`**，实测 10 行，会把 `data/**` 过程产物计入定义面 ⇒ **假报失败**）；`git ls-tree` **不支持** `:(glob)`（报 `pathspec magic not supported`）⇒ 定义面存在性断言改用 `git ls-tree -r --name-only <ref> -- roles` + 正则 `^roles/[^/]+/[^/]+\.md$` 计数（→ 22）；**过程产物区** `roles/*/data/**` 是角色正常三级记录结构的一部分（写入 `data/` + `memory.md` 索引即角色设计内行为；权威口径：`roles/workflow-pb/data/scm-protocol.md:157` 只规定**角色定义**执行期只读、`data/` 与 `memory.md` 不随分发部署，`roles/_template/role-structure-reference.md` 定义该三级结构），其新增文件**不构成对"零改动"断言的违反**、须在证据文档中如实登记（本次事实更正实测新增 **10** 个：`roles/architect/data/**` 1、`roles/prd/data/**` 1、`roles/verifier/data/verify-20260917-*.md` 8；条数随验证产出单调增长，**不作为判据的冻结值**，判据只要求新增全部落在 `data/` 层）；**(c)** `oamp/package.json` 的 `dependencies` 仍为 `{}`；**(d) 唯一例外 = `oamp/src/context-pool.js`**：其 diff 只应出现 `idleMs` / `netMs` 两键透传（`prompt` 形参表 / 队列项 / `client.prompt` 实参），键语义、同键 FIFO 串行、LRU 与释放路径出现任何改动即本 PR 不通过
- [ ] 既有 HTTP 路由不增不减：`GET /api/docs` 的 `routes` 条数**与迭代前同值**（本迭代前实测 = **29**；**四处静态 + 一处运行时，全部为 29**：① `awk '/^export function createApiRoutes/,/^export function projectRoutes/' oamp/src/web.js | grep -cE "^      method: '"` → 29（源码路由表）；② `oamp/API.md` §3 清单命中行 `awk '/^## 3\. 接口清单/,/^## 4\./' oamp/API.md | grep -cE '^\| [0-9]+ \| '` → 29；③ `grep -cE "^- (GET|POST) /api/" oamp/llms.txt` → 29（正文清单）；④ `oamp/llms.txt` 头部 `## 接口（29 条）`（实测第 11 行）；⑤ 运行时 `GET /api/docs` 响应 `routes.length` → 29（`oamp/src/web.js:1245` 请求时投影 `projectRoutes(routes)`，与该数组经 `web.js:2009` / `web.js:2011` 渲染成的 `llms.txt` 同源，故 ①~⑤ 必然同值；dev 侧多验行数不构成偏离），且 `hub doctor` 的 R1 双向比对通过

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/prd/G01-existing-surface-preserved.md（验收 1~12）
- docs/iterations/0030-hub-communication-upgrade/architecture.md §6（逐条对 G01 验收 1~12 的满足方式）、§1.3 既有面硬约束
- oamp/src/transport.js（事件类集合与语义的唯一实现面）、oamp/sdk/doctor.js:44-70（R1 双向清单比对）、oamp/llms.txt（接口条数快照）

## depends_on

- pr-005-web-inbox-and-pool-wiring.md（理由：G01 验收 3 / 4 的"改动前 vs 改动后"比对对象由 `web.js` 产出，改动落地后才有可对照的终态；证据：`error` 的键位与取值形态来自 `oamp/src/web.js:539-558` 的 `composeCallEnvelope`（`web.js:555` 的 `structured_output_invalid` 覆写）与 `call.terminal` 写入（`web.js:2222`）；取件两端点契约在 `web.js:1613-1643` 与 `web.js:1776-1801`；这三处正是 pr-005 的改动对象 ⇒ 无它则无可比对的"改动后"基准）

## batch

3
