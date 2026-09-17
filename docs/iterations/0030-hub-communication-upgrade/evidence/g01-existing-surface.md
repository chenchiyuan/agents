# G01 既有面零回归证据

> 运行所用模型标识：openai/gpt-5.6-luna
> 
> 本文是 pr-008 唯一交付物。结论列严格使用“不回归”；证据以 `main`(`706e3d004029396b0ab24f95c3951b9fe7226214`) → PR HEAD(`4748e78e41808e045b4a49733498dd81809215e6`) 为基线。所有 git 对照均采用 `git -C "$W" diff main HEAD -- <path>` 或 `git -C "$W" show main:<path>`。

## 0. 基线与复现前提（baseline SHA / PR worktree / 命令族入口）

`W=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-008-existing-surface-guard`。`git rev-parse HEAD main` 输出 `4748e78e41808e045b4a49733498dd81809215e6`、`706e3d004029396b0ab24f95c3951b9fe7226214`；`merge-base main HEAD` 输出 `706e3d004029396b0ab24f95c3951b9fe7226214`；执行前 `git status --porcelain` 为空。

对 G01 判据关心的 `oamp/` 交付面，diff 全集（相对上述两个 ref）为 14 路径；仓库级 diff 另含 `docs/**` 与 `roles/*/data/**` 过程产物。

```text
M oamp/API.md
M oamp/README.md
M oamp/skill/hub.md
M oamp/src/acp-client.js
M oamp/src/agent.js
M oamp/src/config.js
M oamp/src/context-pool.js
M oamp/src/oneshot-client.js
M oamp/src/persist.js
D oamp/src/pickup.js
A oamp/src/pool-routing.js
A oamp/src/reason.js
M oamp/src/rpc-client.js
M oamp/src/web.js
```

因此当前 ref 下不含 `oamp/llms.txt`；`oamp/API.md`、`oamp/README.md`、`oamp/skill/hub.md` 三个已有文档均在当前 diff 中。变更面内的 `oamp/` 共 14 路径：11 条落在 `oamp/src/**`（8 `M` + 1 `D` + 2 `A`），3 条落在 `oamp/*.md` 文档面。本 PR 自身仍只新建本证据文档。

## 1. G01 验收 1~12 逐条结论表

| G01 验收 | 结论 | 判据命令（引用 §11） | 证据所在节 |
|---|---|---|---|
| 1 | 不回归 | C04、C05 | §5 |
| 2 | 不回归 | C05 | §6 |
| 3 | 不回归 | C05 | §6 |
| 4 | 不回归 | C06、C10 | §7 |
| 5 | 不回归 | C06、C12 | §7 |
| 6 | 不回归 | C06 | §7 |
| 7 | 不回归 | C06、C02 | §7 |
| 8 | 不回归 | C03、C11、C12 | §4、§8 |
| 9 | 不回归 | C11 | §8 |
| 10 | 不回归 | C07、C08 | §9 |
| 11 | 不回归 | C02、C12 | §3、§8 |
| 12 | 不回归 | C01、C03、C07 | §9 |

## 2. 变更面 diff 的分类表（§5 明文改动 / 已登记预期差异 ①~⑤ / 既有滞后；无第三类）

| diff 路径/变化 | 分类与追溯 |
|---|---|
| `reason.js`、`pool-routing.js` 新增 | §5 明文改动；分别对应 F04/F06/F08 |
| `acp-client.js`、`agent.js`、`config.js`、`oneshot-client.js`、`persist.js`、`rpc-client.js`、`web.js`、`context-pool.js` | §5 明文改动；其中 context-pool 仅两键白名单，见 §4 |
| `pickup.js` 删除 | 已登记实现面变化⑤：模块文件退役、模块引用零命中；端点仍保留，见 §7 |
| `web.js` `/api/agents` role 投影 | 已登记取值变化①：`roleFromInstanceId` → `roleOfPoolInstance`，类型仍 `string|null` |
| Router 不可达时 pickup/ack | 已登记取值变化②：502 → 200，见 §7/C10 |
| `/api/calls` tasks 描述 | 已登记取值变化③：描述可见 `new_session?`，非新增顶层参数 |
| 失败信封 | 已登记取值变化④：既有 10 键 → 失败侧末位 11 键；成功/受理侧仍 10 键 |
| `RECONCILE_TTL` 默认算式、`entry.agentId = target` | §5 明文改动（不是回归）：TTL 为 `config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS`；池内选择结果成为目标 |
| `web.js:539`“11 键”注释 | 既有滞后：main 与 HEAD 同形；本 PR 不改 |

除上述分类外没有第六类。`roles/*/data/**` 是按设计写入的过程产物区，不构成既有产品面回归；定义面判据见 §3。条数随验证产出单调增：本 PR ref（`main`→`4748e78`）实测 11 个 `A`，迭代 tip 后续 ref 实测 12 个；条数不作为判据冻结值，判据只要求新增全部落在 `data/` 层。

## 3. 零改动面逐条核验（含正对照）

组 A 7 个文件均存在且 diff=0：`router.js`、`registry.js`、`role-binding.js`、`transport.js`、`principals.js`、`inbox.js`、`cluster-config.js`，每项 `git ls-tree -r --name-only main -- <path>` 命中 1 行，随后 `git diff --name-only main HEAD -- <path>` 为空。组 B 存在性计数与 diff=0：`oamp/sdk`=`7`、`oamp/web`=`11`、`oamp/scripts`=`1`。组 C：根 `cluster.json` 存在性计数=`1`、diff=0；`test -e oamp/cluster.json` 输出 `ABSENT ok`（该路径不存在，故根路径不能写成 `oamp/cluster.json`）。组 E：`oamp/package.json` 存在性=`1`、整体 diff=0，依赖输出 `{}`。

定义面组 D 使用 glob magic：`git diff --name-only main HEAD -- ':(glob)roles/*/*.md' ':(glob)roles/_template/**'` 为空；`git ls-tree -r --name-only HEAD -- roles | grep -cE '^roles/[^/]+/[^/]+\.md$'` 输出 `22`，作为存在性前置。按本 PR 两个 ref 的实际对照，`git diff --name-status main HEAD -- roles` 输出 11 个 `A`，全部为 `roles/{architect,prd,verifier}/data/**`；新增全部落在 data 层。非 magic 的 `roles/*/*.md` 输出 11 行，正是 `*` 跨 `/` 的陷阱，不能作为定义面判据。

正对照：`git diff --name-only main HEAD -- oamp/src/web.js` 输出 `oamp/src/web.js`（1 行非空），证明零 diff 命令族不是恒空。以上每个零改动断言均伴随存在性计数或正对照。

## 4. `context-pool.js` 两键透传例外（白名单 + 归一化等价证明）

`git diff --stat main HEAD -- oamp/src/context-pool.js`：`1 file changed, 4 insertions(+), 2 deletions(-)`。`-U0` 的 6 个非头部改动行恰为三处白名单：

```text
-  prompt(text, { model = null, timeoutMs, onDelta = null, origin = null, projectContext = null } = {}) {
+  prompt(text, { model = null, timeoutMs, idleMs, netMs, onDelta = null, origin = null, projectContext = null } = {}) {
-      this.queue.push({ text, model, timeoutMs, onDelta, projectContext, resolve, reject });
+      this.queue.push({ text, model, timeoutMs, idleMs, netMs, onDelta, projectContext, resolve, reject });
+        idleMs: turn.idleMs,
+        netMs: turn.netMs,
```

按 C03 的 `sed` 归一化命令剔除形参及两行实参后，`diff` exit=0 并输出 `NORMALIZED-IDENTICAL`。因此 `(chat_id, agent_id)` 键语义未动；同键 FIFO 串行未动；LRU 与释放路径未动。三句断言均由归一化逐字等价证明，而非人眼推断。

## 5. 事件面（事件类集合 / 常量 / 发布调用点 / 4 键空间 / 失败侧 payload 增量）

`type: '…'` 字面集合两侧 `diff` 为空并输出 `EVENT-SET-IDENTICAL`；`FILTERED_EVENT_KINDS` 与 `CALL_EVENTS` 两常量行两侧为空并输出 `CONST-IDENTICAL`；`git diff main HEAD -- oamp/src/web.js | grep -E '^[+-].*transport\.'` 为空（发布调用点差异 0）。

既有 4 条推送面是 4 个键空间：`chat:<id>`、全局 `null`、`chat-calls:<id>`、`call:<id>`；SSE 路由共 5 条，多出的 `/api/subscribe` 是过滤面，不与“四个键空间”矛盾。事件类不增、不减、不改名；唯一帧级差异是失败终态 `call_result` 的 payload 追加 `reason` 键。

## 6. 信封与状态面（10 键与失败侧 11 键、键序、state 四值、取消落 failed）

C05 键序两侧均为：`call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code`，输出 `KEYS-IDENTICAL`。HEAD 唯一追加行为原文为：

```js
if (state === 'failed') envelope.reason = reasonOf(state, envelope.error);
```

它只在 `state === 'failed'` 分支执行且位于末位。因此本迭代前实测既有信封 = 10 键；失败侧 = 11 键；成功/受理侧仍 = 10 键。`error` 键位、拼写、取值形态（含既有文案）不变，不新增 `detail` 键。`structured_output_invalid`、`cancelled`、`timeout` 既有失败文案在本次 web 运行时改动差异中无新增改写；取消路径两侧逐字为 `finishTask(entry, { state: 'failed', error: 'cancelled' });`。`state` 字面集合两侧相同：任务域 `submitted`/`working`/`failed`，连同既有连接域 `online`/`closed`；仍为四值、不新增第三终态。`web.js:539` 注释的“11 键”是 main 同形的既有滞后，不把它算作本迭代改动。

## 7. 取件端点契约面（参数行 / 响应键序 / 确认语义 / Router 不在场时的取值登记）

C06 两侧端点参数行逐字相同：GET `/api/pickup` 为 `principal`（query, required）与 `epoch`（query, optional）；POST `/api/pickup/:call_id/ack` 为 `call_id`（path, required）、`principal`（query, required）、`epoch`（query, optional）。HEAD 响应显式 7 键有序：`call_id, requester, agent, chat_id, terminal_at, acked, envelope`；main 的 `pickup.js` 等价形态是 6 键 entry 白名单 `call_id, requester, agent, chat_id, terminal_at, acked` 加 `envelope`。

确认语义代码行：`db.listInbox(principalId)`（未取件集合）与 `db.deleteInbox(params.call_id)`（就地删除、幂等）。确认后不再出现在未取件集合，重复确认无副作用。

隔离活体附证（`/tmp/0030-pr-008`，端口 17788、Router socket 不存在，web 已起）：

```text
GET /api/pickup?principal=whoami       http=200 {"pickup":[]}
POST /api/pickup/call_x/ack?...        http=200 {"call_id":"call_x","acked":true}
GET /api/agents                        http=502 {"error":"router 不可达或请求失败: connect ENOENT /tmp/0030-pr-008/run/router.sock","code":"UPSTREAM_UNAVAILABLE"}
WEB_READY url=http://127.0.0.1:17788
```

这两个 200 是已登记取值变化②；`/api/agents` 的 502 是正对照，证明不是 web 未启动。Router/registry diff=0（§3）。Router 任务表仍纯内存；`inbox` 的 `insertInbox`/`listInbox`/`deleteInbox` 只服务取件面；普通 `GET /api/calls/<call_id>` 仍经 `queryOnce(router.task_get)`，不存在时仍按既有 404 口径。`artifact|产物校验|verify_artifact` 在 `oamp/src` 的 grep 均为零命中，因此无产物字段/核实新增。UDS 与 worktree 隔离协议未动；不做 `demand.md` 之外的隔离边界协议设计。

## 8. 边界与不越界面（实例生命周期 / 既有缺陷不修 / 绑定范围）

既有 UDS 方法集合为 9 个：`agent.register`, `agent.heartbeat`, `agent.deregister`, `message.send`, `message.ack`, `router.status`, `router.task_get`, `router.task_cancel`, `router.task_list`；router.js diff=0，未新增第 10 个方法。池内粘性键是 `(chat_id, role)`，`new_session` 是 tasks 项级可选；`web.js` 与 `pool-routing.js` 中生命周期词命中 0（`spawn|scale|startAgent|stopAgent|addInstance|removeInstance`），hub 不启停、不伸缩实例、无无状态均衡。

`api/calls/:call_id/transcript` handler 两侧抽取逐字相同，输出 `TRANSCRIPT-IDENTICAL`。惰性启动竞态判定面 `landed`/`attempts`/`slow` 与迟到结果丢弃分支未修；唯一相关差异是 `RECONCILE_TTL_DEFAULT_MS` 默认值算式改为 `config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS`，以及池内结果 `entry.agentId = target`，均为 §5 明文改动，不是竞态修复。两处既有缺陷均不在本迭代修。

模型定义层：`grep -cE '^[[:space:]]*model:' roles/*/*.md` 为 0；`grep -rnE 'openai/|powerby/|deepseek/' roles/*/*.md` 为 0。递归 `roles/*/data/**` 的命中属于过程产物/取证报告，不属判据层。根 `cluster.json` 两侧带 `model` 键的角色集合均为 `dev,verifier`；`roles` 键集为 10，不能用键集判断绑定范围（否则会误判为绑定 10 个角色）。绑定载体迁移说明见只读文档 `docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md`；cluster.json diff=0。

## 9. 兼容与范围面（无新增必填参数、取值域、预期差异 ①~⑤ 登记、§5↔F01~F08 回溯表）

`/api/calls` 两侧参数行均为 9，逐行 diff 为空；唯一描述差异为 tasks 项追加 `new_session?`。`new_session` 可选、缺省不出现，不是顶层 param 行。`/api/agents` 字段集两侧仍为 `instance_id/session_id/state/last_heartbeat/connected/role/busy/current_call_id/queued/since`，类型域不变；仅 `pb-<role>-<n>` 的 role 列由 null → 角色名（仍 `string|null`），即已登记取值变化①。

| 编号 | 变化 | 证据/出处 | 判定 |
|---|---|---|---|
| ① | `/api/agents` role：null → 角色名 | `withRole` 行；architecture §9-10/§10-10 | 已登记取值变化，不构成回归 |
| ② | Router 不可达时 pickup：502 → 200 | §7 活体三请求；architecture §6/§9-14 | 已登记取值变化，不构成回归 |
| ③ | `/api/docs` POST `/api/calls` desc 可见 `new_session?` | §9 参数行对照；architecture §5/§10-12 | 已登记取值变化，不构成回归 |
| ④ | 失败信封 10 → 11，末位 reason；成功仍 10 | §6 `composeCallEnvelope` | 已登记取值变化，不构成回归 |
| ⑤ | `pickup.js` 文件退役、模块引用零命中 | C09；architecture §5/§10-12 | 已登记实现面变化，不构成回归 |

§5 变更面 ↔ F01~F08 回溯：F01/F02 → `persist.js`、`reason.js`；F03 → inbox persistence；F04 → `reason.js` 与失败 reason；F05 → `web.js` 双计时/安全网；F06/F07 → `pool-routing.js`、`web.js` 池内粘性；F08 → `config.js`/`agent.js`/`rpc-client.js` 模型载体。`context-pool.js` 是唯一两键例外，详见 §4；`pickup.js` 是退役面。文档面 3 个当前差异属于已合并时序的文档面，非本 PR 零改动清单；`oamp/llms.txt` 不在当前 14 路径 diff 中。
### T9 封闭性守卫：枚举相等与 PR 文件范围并集

第一层采用枚举而非计数：对 `git -C "$W" diff --name-only main HEAD` 过滤过程产物 `docs/**`、`roles/*/data/**` 后，实测集合逐行等于以下 14 条，集合 diff exit=0、无输出：

```text
oamp/API.md
oamp/README.md
oamp/skill/hub.md
oamp/src/acp-client.js
oamp/src/agent.js
oamp/src/config.js
oamp/src/context-pool.js
oamp/src/oneshot-client.js
oamp/src/persist.js
oamp/src/pickup.js
oamp/src/pool-routing.js
oamp/src/reason.js
oamp/src/rpc-client.js
oamp/src/web.js
```

第二层将实测集合与 `docs/iterations/0030-hub-communication-upgrade/prs/pr-*.md` 的“文件范围”并集对账：归一化说明文字（如“新建”“删除”“仅两键透传”）后，实测变更集是声明并集的子集；未声明变更数 `0`。声明但零 diff 的路径仅 `oamp/llms.txt`，其内容未变，且 pr-006 AC3 明确这是预期。故“声明并集覆盖实测集 + 每条零 diff 声明有解释”均成立。

本快照按 `main`(`706e3d0`) → HEAD(`4748e78`) 的 14 条枚举取值执行；其中 11 条源码与 3 条文档面。tasks 文件 T9 中的“11”是 pr-006 合并前的陈旧字面，不能替代本快照枚举判据。封闭性守卫不得仅用“过滤后计数=11”或笼统排除 `.md`，避免少一多一对冲和未声明文档漏检。

## 10. 路由条数与 `hub doctor` R1（四处同值 + R1 双向比对）

四处静态计数与一处运行时均为 29：

```text
源码 createApiRoutes awk/grep                         29
源码 createApiRoutes 全函数 awk/grep                  29
oamp/llms.txt  GET/POST /api 行                      29
oamp/API.md  GET/POST /api 表行                      29
GET /api/docs 运行时 routes.length                   29
```

`oamp/llms.txt` 头部原文：`## 接口（29 条）`（第 11 行）。隔离运行使用 Router + web 同时在线、端口 17788、`/tmp/0030-pr-008/run/router.sock` 与 `/tmp/0030-pr-008/run/sql.db`；两个进程均已停止。`hub doctor` 经 `OAMP_WEB_PORT=17788` 执行，JSON 关键字段：`pass=true`、`items=66`、`R1=29`、`R1 fails=0`，exit 0；示例 R1：`{"id":"R1 GET /api/agents","ok":true,"expected":"GET /api/agents","actual":"GET /api/agents"}`。

R1 的 `compareSignatures` 原文逻辑为文档有运行无时 `reason: '登记缺失'`（doctor.js:44-57），运行有文档无时 `reason: '文档未覆盖'`（doctor.js:59-67），即双向比对。本迭代不新增路由，R1 不会因缺行失败。陷阱实测：`hub doctor --port 17788` → exit 2，`{"code":"USAGE","error":"doctor 不接受该参数: --port","exit_code":2}`；Router 不在线而仅 web 在线 → exit 3，`{"code":"UPSTREAM_UNAVAILABLE",...}`。故端口只能走 `OAMP_WEB_PORT`，且 R1 前提必须同时起 Router 与 web。路由数不变量 = 29；pr-006 只做文档面同步，其落地后复跑五条计数命令，期望仍全为 29。

## 11. 复现命令族（逐条可复制）

以下命令均以 PR worktree 为根，且每个编号在正文被引用；输出中长列表可按正文记录的计数/首尾复核。

```bash
# C01 baseline
W=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-008-existing-surface-guard
 git -C "$W" rev-parse HEAD main
 git -C "$W" merge-base main HEAD
 git -C "$W" status --porcelain
 git -C "$W" diff --name-status main HEAD

# C02 zero-change surfaces + positive control
for p in oamp/src/router.js oamp/src/registry.js oamp/src/role-binding.js oamp/src/transport.js oamp/src/principals.js oamp/src/inbox.js oamp/src/cluster-config.js oamp/sdk oamp/web oamp/scripts cluster.json oamp/package.json; do printf '%s exists=%s diff=%s\n' "$p" "$(git -C "$W" ls-tree -r --name-only main -- "$p" | wc -l | tr -d ' ')" "$(git -C "$W" diff --name-only main HEAD -- "$p" | wc -l | tr -d ' ')"; done
 git -C "$W" ls-tree -r --name-only HEAD -- roles | grep -cE '^roles/[^/]+/[^/]+\.md$'
 test -e "$W/oamp/cluster.json" && echo 'UNEXPECTED EXISTS' || echo 'ABSENT ok'
 git -C "$W" diff --name-only main HEAD -- ':(glob)roles/*/*.md' ':(glob)roles/_template/**'
 git -C "$W" diff --name-only main HEAD -- oamp/src/web.js
 node -p "JSON.stringify(require('$W/oamp/package.json').dependencies)"

# C03 context-pool whitelist and normalization
 git -C "$W" diff --stat main HEAD -- oamp/src/context-pool.js
 git -C "$W" diff -U0 main HEAD -- oamp/src/context-pool.js | grep -E '^[+-][^+-]'
 norm(){ sed -e 's/, idleMs, netMs//' -e '/idleMs: turn\.idleMs,$/d' -e '/netMs: turn\.netMs,$/d' "$1"; }
 git -C "$W" show main:oamp/src/context-pool.js >/tmp/0030-pr-008/cp.main.js
 norm "$W/oamp/src/context-pool.js" >/tmp/0030-pr-008/cp.head.norm.js
 norm /tmp/0030-pr-008/cp.main.js >/tmp/0030-pr-008/cp.main.norm.js
 diff /tmp/0030-pr-008/cp.head.norm.js /tmp/0030-pr-008/cp.main.norm.js && echo NORMALIZED-IDENTICAL

# C04 event set/constant/publish comparison
 diff <(grep -oE "type: '[a-zA-Z_]+'" "$W/oamp/src/web.js" | sort -u) <(git -C "$W" show main:oamp/src/web.js | grep -oE "type: '[a-zA-Z_]+'" | sort -u)
 diff <(grep -E 'CALL_EVENTS = |FILTERED_EVENT_KINDS = ' "$W/oamp/src/web.js") <(git -C "$W" show main:oamp/src/web.js | grep -E 'CALL_EVENTS = |FILTERED_EVENT_KINDS = ')
 git -C "$W" diff main HEAD -- oamp/src/web.js | grep -E '^[+-].*transport\.'

# C05 envelope/state
 keys(){ awk '/^function composeCallEnvelope/,/^}/' "$1" | grep -oE '^    [a-z_]+' | tr -d ' ' | paste -sd,; }
 keys "$W/oamp/src/web.js"; git -C "$W" show main:oamp/src/web.js >/tmp/0030-pr-008/web.main.js; keys /tmp/0030-pr-008/web.main.js
 diff <(keys "$W/oamp/src/web.js") <(keys /tmp/0030-pr-008/web.main.js) && echo KEYS-IDENTICAL
 grep -n 'envelope.reason = reasonOf' "$W/oamp/src/web.js"
 grep -nE "error: 'cancelled'|state: 'failed'" "$W/oamp/src/web.js"

# C06 pickup contract
 pickupParams(){ awk -v p="path: '$1'," 'index($0,p){f=1} f{print} f&&/kind: .json./{exit}' "$2" | grep -E "\{ name: '"; }
 pickupParams '/api/pickup' "$W/oamp/src/web.js"; pickupParams '/api/pickup/:call_id/ack' "$W/oamp/src/web.js"
 sed -n '/const result = rows.map/,/}));/p' "$W/oamp/src/web.js"
 grep -n 'db.deleteInbox\|db.listInbox' "$W/oamp/src/web.js"

# C07 route counts
 awk '/^export function createApiRoutes/,/^export function projectRoutes/' "$W/oamp/src/web.js" | grep -cE "^      method: '"
 awk '/function createApiRoutes/,0' "$W/oamp/src/web.js" | grep -cE "method: '(GET|POST|PUT|DELETE)'"
 grep -cE '^- (GET|POST) /api/' "$W/oamp/llms.txt"
 grep -n '接口（' "$W/oamp/llms.txt"
 grep -cE '^\|\s*[0-9]+\s*\|\s*`(GET|POST)\s+/api/' "$W/oamp/API.md"

# C08 isolated runtime and doctor (Router + web, never default resources)
 T=/tmp/0030-pr-008; OAMP_SOCKET=$T/run/router.sock OAMP_DB=$T/run/sql.db OAMP_WEB_PORT=17788 node bin/hub.js doctor
 curl -s http://127.0.0.1:17788/api/docs | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).routes.length))"

# C09 module retirement
 test -e "$W/oamp/src/pickup.js" && echo 'STILL EXISTS' || echo 'ABSENT ok'
 grep -rnE "from '(\./)?pickup(\.js)?'|import\('\./pickup" "$W/oamp/src" "$W/oamp/sdk" "$W/oamp/bin" "$W/oamp/scripts"; echo "module reference rc=$?"

# C10 Router-absent pickup live probe
 curl -s -w '\nhttp=%{http_code}\n' 'http://127.0.0.1:17788/api/pickup?principal=whoami'
 curl -s -w '\nhttp=%{http_code}\n' -X POST 'http://127.0.0.1:17788/api/pickup/call_x/ack?principal=whoami'
 curl -s -o /dev/null -w 'control /api/agents http=%{http_code}\n' 'http://127.0.0.1:17788/api/agents'

# C11 reconcile/transcript
 git -C "$W" diff main HEAD -- oamp/src/web.js | grep -nE '^[+-].*(RECONCILE_TTL|RECONCILE_SLOW|agentId|landed|attempts|slow)'
 diff <(sed -n '/path: .\/api\/calls\/:call_id\/transcript.,/,/^    },$/p' "$W/oamp/src/web.js") <(sed -n '/path: .\/api\/calls\/:call_id\/transcript.,/,/^    },$/p' /tmp/0030-pr-008/web.main.js) && echo TRANSCRIPT-IDENTICAL

# C12 UDS and binding
 grep -cE "^      case '" "$W/oamp/src/router.js"
 grep -oE "^      case '[a-z._]+'" "$W/oamp/src/router.js"
 node -p "Object.entries(require('$W/cluster.json').roles).filter(([,v])=>v&&v.model).map(([k])=>k).join(',')"
 git -C "$W" show main:cluster.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(Object.entries(j.roles).filter(([,v])=>v&&v.model).map(([k])=>k).join(','))})"
 
# C13 closure enumeration and declared-range union (enumeration, not count)
 expected=$(mktemp); actual=$(mktemp)
 printf '%s\n' oamp/API.md oamp/README.md oamp/skill/hub.md oamp/src/acp-client.js oamp/src/agent.js oamp/src/config.js oamp/src/context-pool.js oamp/src/oneshot-client.js oamp/src/persist.js oamp/src/pickup.js oamp/src/pool-routing.js oamp/src/reason.js oamp/src/rpc-client.js oamp/src/web.js | sort >"$expected"
 git -C "$W" diff --name-only main HEAD | grep -vE '^docs/|^roles/[^/]+/data/' | sort >"$actual"
 diff "$expected" "$actual"
 rm -f "$expected" "$actual"
```
