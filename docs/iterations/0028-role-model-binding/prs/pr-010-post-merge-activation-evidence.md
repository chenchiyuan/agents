# pr-010：收口生效实证（F08）

## 上下文摘要

收口的最后一公里：迭代分支合入 main 后，对**主工作区集群**做唯一一次重启（`cluster down` + `cluster up --config <主工作区>/cluster.json`，写明 `--config` 以自证加载的是合并后的 main 配置），再取 `pb-dev` 与 `pb-verifier` 各一条终态实报，证明"文件已合、集群真按绑定运行"。本 PR 在 **main 上**执行（迭代分支已合并且已删），证据落本 PR 的「验收证据」小节。工作流时序：本 PR 须在全部 PR 合入迭代分支 → 迭代分支合入 main 之后触发。

## 涉及功能点

- F08

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-010-post-merge-activation-evidence.md`（本 PR 文件：重启记录与两条实报写入「验收证据」小节）

排除（本 PR 不触碰）：`status.md` 的收口登记（`迭代分支` 字段回写）——按 `architecture.md` §4 A-04，该回写是工作流的合并后动作，与本 PR 证据同批写入 main，不计入本 PR 写入面；`oamp/**`、`roles/**`、`cluster.json`（pr-002 已定内容，本 PR 只加载）。

## 验收标准

- [x] **合并存在（F08 验收 1）**：main 历史含该迭代的 merge 提交，message 形如 `merge: iteration 0028-role-model-binding {一句话目标} into main`；合并后 `docs/iterations/0028-role-model-binding/**`（含 `demand.md` / `prd.md` / `prd/*.md` / `architecture.md` / `clarifications/*.md` / `history.md` / `status.md` / `deferred-demand-changes.md` / `prs/*.md`）可在 main 上读到
- [x] **重启已发生（F08 验收 2）**：主工作区集群已重启——`node <主工作区>/oamp/bin/hub.js cli cluster down --config <主工作区>/cluster.json` 后 `… cli cluster up --config <主工作区>/cluster.json`；重启命令与重启时间留痕；重启后 `hub api agents`（缺省 `7788`）列出 10 个 `pb-<role>` 实例全部在线（排除固有节点 `web`）
- [x] **加载的是合并后的配置（F08 验收 3）**：重启动作发生在合并提交**之后**，且不存在"文件已合、集群仍跑旧配置"的状态（判据 = 时序 + 验收 4 的实报值）
- [x] **两条实报（F08 验收 4）**：主集群内 `pb-dev` 与 `pb-verifier` 各存在一条调用，其终态实报 `model` 分别解析到 gpt 后端与 grok 后端（判据口径同 F05 验收 4 / MI-3：不要求与绑定值逐字相等，实报字符串原文照录保留）
- [x] **证据可核对（F08 验收 5）**：重启记录 + 两条 `call_id` + 各自终态字段（`state` / `model` / `error` / `exit_code`）写入本 PR「验收证据」小节，并以合并提交**之后**的一次 `chore(0028): 收口登记` 提交落盘（该提交同时承载工作流对 `status.md` 的收口登记回写）
- [x] 本 PR 不重复证明绑定字段取值正确（F03 / F05 / F06 承担）；不对 `pb-dev` / `pb-verifier` 之外的角色补取证；不要求第二集群在收口后 `down` 或清理（F08 边界）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md`（验收 1~5、边界、架构维度 A-04）
- `docs/iterations/0028-role-model-binding/architecture.md` §3.4 收口链、§4 A-04（落点、时点四步、被否方案）、§4 A-05（两集群两库互不可见）
- `docs/iterations/0028-role-model-binding/status.md` §阶段状态（阶段 5 完成后进入收口）与 §派发台账
- `docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md`（验收 4 的判据口径）、`prd/F06-verifier-binding-evidence.md`（验收 4）
- 先例：0025 的 `162682d`（`chore(0025): 收口登记…`，晚于 merge `5839e9d`）、0026 的 `8d897a9`（`docs(0026): 收口落盘…`，晚于 merge `d8c2cb6`）——均只改 `docs/iterations/{迭代}/**`
- 代码锚点：`oamp/src/cluster.js:200-201`（角色级 `model` → `--model`）、`oamp/src/cluster.js:190`（`--port` 取 `config.web.port`）

## depends_on

- pr-001-iteration-artifacts-commit.md（理由：验收 1 要求"合并后迭代产物可在 main 上读到"，而迭代产物的 tracked 状态由 pr-001 建立（阶段 1~3 的产物在其提交前均为 untracked，不会随分支合并进入 main）——证据：`git status --porcelain` 在本迭代工作区对 `docs/iterations/0028-role-model-binding/` 报 `??`，未跟踪文件不参与合并；`prd/F08-post-merge-activation-evidence.md` 验收 1 原文）
- pr-002-role-model-binding.md（理由：验收 3 / 验收 4 要求主工作区集群加载的合并后配置含 F03 的两处 `model`，且重启后两条实报由此产生——证据：`oamp/src/cluster.js:200-201` 的 `if (entry.model !== undefined) argv.push('--model', entry.model)`：实报模型的唯一来源是配置文件里的 `roles.<role>.model`，该键由 pr-002 写入；缺 pr-002，重启后两条实报只能是全局默认）

## batch

7

## 验收证据

（本 PR 执行时填写：「merge 提交 hash 与 message」+「重启命令逐字与时间」+「重启后 10 实例在线表」+「两条实报：`call_id` / 终态字段 / 实报 model 原文」+「`chore(0028): 收口登记` 提交 hash」；载体约定见 `architecture.md` §3.4 / §4 A-02 / A-04）
 
### ① 合并提交与产物

以下命令均在主工作区只读执行：

```text
$ git -C /Users/chenchiyuan/projects/agents log -1 --format='%H %ad %s' --date=iso fb7b8dc
fb7b8dc20601a712b2bef7e322f4c6d987efb8ac 2026-09-16 10:42:01 +0800 merge: iteration 0028-role-model-binding 角色级模型绑定 into main

$ git -C /Users/chenchiyuan/projects/agents merge-base --is-ancestor fb7b8dc HEAD; printf 'exit=%s\n' "$?"
exit=0
```

合并提交在 main 历史中，message 原文为 `merge: iteration 0028-role-model-binding 角色级模型绑定 into main`；`fb7b8dc` 是当前 `HEAD` 的祖先。

```text
$ git -C /Users/chenchiyuan/projects/agents ls-tree -r --name-only HEAD -- docs/iterations/0028-role-model-binding
docs/iterations/0028-role-model-binding/architecture.md
docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md
docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md
docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md
docs/iterations/0028-role-model-binding/deferred-demand-changes.md
docs/iterations/0028-role-model-binding/demand.md
docs/iterations/0028-role-model-binding/history.md
docs/iterations/0028-role-model-binding/prd.md
docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md
docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md
docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F06-verifier-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F07-unbound-control-evidence.md
docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md
docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md
docs/iterations/0028-role-model-binding/prd/F10-single-chat-attribution.md
docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md
docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md
docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md
docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md
docs/iterations/0028-role-model-binding/prs/pr-002-role-model-binding.md
docs/iterations/0028-role-model-binding/prs/pr-003-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up.md
docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md
docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md
docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md
docs/iterations/0028-role-model-binding/prs/pr-009-existing-surface-freeze.md
docs/iterations/0028-role-model-binding/status.md
```

当前 main 上已有 **33** 个 tracked 路径（含本 PR 文件）：顶层 6 个（`demand.md` / `prd.md` / `architecture.md` / `deferred-demand-changes.md` / `history.md` / `status.md`）、`prd/` 13 张功能卡、`clarifications/` 4 个、`prs/` 10 个（`pr-001`~`pr-010`）。计数命令与原始输出：

```text
$ git -C /Users/chenchiyuan/projects/agents ls-tree -r --name-only HEAD -- docs/iterations/0028-role-model-binding | wc -l
33
```


### ② R1：主 agent 在集群外执行的重启记录

以下记录由主 agent 在集群外执行（执行角色自身运行于被重启的集群内，自行 `down` 会自杀）；本 PR 未执行 `cluster down` 或 `cluster up`。下列命令**逐条可复制执行**，输出为原样（时间行由命令行包装器 `echo "... $(date ...)"` 打印）。

```text
$ echo "DOWN_START $(date '+%Y-%m-%dT%H:%M:%S')"; node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js cli cluster down --config /Users/chenchiyuan/projects/agents/cluster.json; echo "exit=$?"; echo "DOWN_END $(date '+%H:%M:%S')"
DOWN_START 2026-09-16T10:45:18
已收口（session=oamp-cluster，12 窗口）
exit=0
DOWN_END 10:45:19
```

首次 up（`UP_START 10:45:22`）被幂等护栏误挡——`oamp/src/cluster.js:132-134` 的 `hasSession` 用 `tmux has-session -t <session>`，tmux 对目标**按前缀匹配**，`oamp-cluster` 命中了同前缀的第二集群 `oamp-cluster-0028`（该缺陷登记为 G-18）：

```text
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js cli cluster up --config /Users/chenchiyuan/projects/agents/cluster.json --wait 120000
集群已在运行（session=oamp-cluster，12 窗口）
tmux attach -t oamp-cluster
如需重建请先 oamp cluster down

$ tmux has-session -t 'oamp-cluster'; echo "exit=$?"
exit=0

$ tmux has-session -t '=oamp-cluster'; echo "exit=$?"
can't find session: oamp-cluster
exit=1
```

绕开（运行时、可逆、零文件改动、未停第二集群）：

```text
$ tmux rename-session -t oamp-cluster-0028 oamp-w0028; tmux ls
oamp-w0028: 12 windows (created Wed Sep 16 09:53:43 2026)
```

```text
$ echo "UP_START $(date '+%Y-%m-%dT%H:%M:%S')"; node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js cli cluster up --config /Users/chenchiyuan/projects/agents/cluster.json --wait 120000; echo "UP_END $(date '+%H:%M:%S')"
UP_START 2026-09-16T10:45:51
集群已启动（session=oamp-cluster，12 窗口）
tmux attach -t oamp-cluster
日志目录: /Users/chenchiyuan/projects/agents/oamp/.runtime/cluster
instance_id           session_id                            state   last_heartbeat
pb-architect          68ab74a9-4b02-49a9-943c-6da2e6564cb8  online  2026-09-16T02:45:51.785Z
pb-demand             2c8a8eb0-b92a-472b-b105-641f287988b8  online  2026-09-16T02:45:51.810Z
pb-dev                ff8dce06-9bbd-4db1-baf6-1785eaa967a9  online  2026-09-16T02:45:51.836Z
pb-planner            dc2905d9-335e-4a0b-b28c-bf6f5428cb32  online  2026-09-16T02:45:51.862Z
pb-pr-planner         b22c3f2c-0d47-4a0f-89a0-890a6c3232aa  online  2026-09-16T02:45:51.889Z
pb-prd                a7fb0052-8a38-4985-9d64-96163c1088de  online  2026-09-16T02:45:51.915Z
pb-progress-observer  33a62d69-7725-4348-a940-5b6fecfb5cea  online  2026-09-16T02:45:51.941Z
pb-retrospective      b08badd4-4564-4e44-a9fc-06aacbfcee0a  online  2026-09-16T02:45:51.967Z
pb-verifier           4ede5d3d-bfe2-4311-b337-6263a335cd6e  online  2026-09-16T02:45:51.994Z
pb-workflow-pb        e893e80e-b825-4383-be76-24e579e0c5b1  online  2026-09-16T02:45:52.004Z
UP_END 10:45:52
```

恢复（两 session 并存）：

```text
$ tmux rename-session -t oamp-w0028 oamp-cluster-0028
```
```text
$ tmux ls
oamp-cluster: 12 windows (created Wed Sep 16 10:45:51 2026)
oamp-cluster-0028: 12 windows (created Wed Sep 16 09:53:43 2026)
```

重启后进程级核验原始输出：

```text
$ lsof -nP -iTCP:7788 -sTCP:LISTEN
COMMAND   PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    29203 chenchiyuan   15u  IPv4 0x11df2af045b77962      0t0  TCP 127.0.0.1:7788 (LISTEN)

$ grep -h AGENT_START oamp/.runtime/cluster/pb-dev.log | tail -1
[2026-09-16T02:45:51.834Z] agent AGENT_START instance=pb-dev role=dev model=openai/gpt-5.6-luna tools=on permission=allow approval=yolo role_file=/Users/chenchiyuan/projects/agents/roles/dev/dev.md

$ grep -h AGENT_START oamp/.runtime/cluster/pb-verifier.log | tail -1
[2026-09-16T02:45:51.992Z] agent AGENT_START instance=pb-verifier role=verifier model=powerby/grok-4.6 tools=on permission=allow approval=yolo role_file=/Users/chenchiyuan/projects/agents/roles/verifier/verifier.md

$ grep -h AGENT_START oamp/.runtime/cluster/pb-prd.log | tail -1
[2026-09-16T02:45:51.913Z] agent AGENT_START instance=pb-prd role=prd model=deepseek/deepseek-v4-flash tools=on permission=allow approval=yolo role_file=/Users/chenchiyuan/projects/agents/roles/prd/prd.md
```

### ③ 重启后 10 个角色实例在线

主集群使用缺省端口 `7788`。下列投影命令及原始输出排除固有节点 `web` 后给出 10 个角色实例：

```text
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api agents | jq -r '.agents[] | [.instance_id,.state] | @tsv'
pb-architect	online
pb-demand	online
pb-dev	online
pb-planner	online
pb-pr-planner	online
pb-prd	online
pb-progress-observer	online
pb-retrospective	online
pb-verifier	online
pb-workflow-pb	online
web	online
```

`web` 为固有节点并排除；上述 10 个 `pb-*` 全部 `online`。重启后的 `tmux ls` 原始对照为：`oamp-cluster` created `10:45:51`、`oamp-cluster-0028` created `09:53:43`；第二集群仍在，F08 不要求其 `down` 或清理，本 PR 未对 `7789` 发起写动作。

### ④ 两条主集群实报

两条命令由主 agent 在同一轮并发发起；除 `--agent` 外逐字一致，使用同一 chat、缺省端口、`--mode block`，均未带 `--model`：

```text
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls create --chat-id chat-6c89902c-0a9f-4513-a299-90a7f98ae611 --agent verifier --task "只回复 OK。" --mode block
{"call_id":"task-67cb177b-4af5-4bf0-8895-3fceeb062a45","agent":"verifier","state":"completed","duration_ms":12356,"model":"powerby/grok-4.6","truncated":false,"text":"OK","structured_output":null,"error":null,"exit_code":0}

$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls create --chat-id chat-6c89902c-0a9f-4513-a299-90a7f98ae611 --agent dev --task "只回复 OK。" --mode block
{"call_id":"task-84c498ea-6dfa-43b5-924d-5561dbe794c3","agent":"dev","state":"completed","duration_ms":4834,"model":"openai/gpt-5.6-luna","truncated":false,"text":"OK","structured_output":null,"error":null,"exit_code":0}
```

终态字段原文：`verifier` 的 `call_id=task-67cb177b-4af5-4bf0-8895-3fceeb062a45`，`state=completed`、`model=powerby/grok-4.6`、`error=null`、`exit_code=0`；`dev` 的 `call_id=task-84c498ea-6dfa-43b5-924d-5561dbe794c3`，`state=completed`、`model=openai/gpt-5.6-luna`、`error=null`、`exit_code=0`。实报文本原文均为 `OK`。

可核对的重启后调用时序原始输出：

```text
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls list | jq -c '.calls[] | select(.call_id == "task-67cb177b-4af5-4bf0-8895-3fceeb062a45" or .call_id == "task-84c498ea-6dfa-43b5-924d-5561dbe794c3")'
{"call_id":"task-84c498ea-6dfa-43b5-924d-5561dbe794c3","agent":"dev","state":"completed","started_at":1789528253003,"ended_at":1789528257838,"model":"openai/gpt-5.6-luna"}
{"call_id":"task-67cb177b-4af5-4bf0-8895-3fceeb062a45","agent":"verifier","state":"completed","started_at":1789528236416,"ended_at":1789528248772,"model":"powerby/grok-4.6"}
```

MI-3 判定：`verifier` 实报解析到 `powerby/` 的 grok 后端，`dev` 实报解析到 `openai/` 的 gpt 后端；只判解析到同一后端，不要求与绑定值逐字相等。两条命令均不带 `--model`，因此实报来自合并后 `cluster.json` 的角色级绑定。

### ⑤ 失败轮与 G-19 转记、时序及逐条验收判定

上一轮执行调用 `task-2b66d138-cea9-46d3-a043-b49fa38017f5` 由 `dev` 实例执行本 PR；它把两条实报打给 `pb-dev`（自身实例）与 `pb-verifier`。内层 `--agent dev` 调用 `task-ccf0b236-a01d-4c2f-8ea5-9339f9b12a6d` 与外层轮次在同一实例的单 daemon 上互锁，24 分钟不结束，外层 `error=context_crashed`、`duration_ms=1441508`，内层 `duration_ms=1340742`、同为 `context_crashed`。该自排队死锁已登记为 G-19；主 agent 以 `kill -TERM <pid>` 终止该实例 daemon、保留父 supervisor，两个调用转为 `failed/context_crashed`。同轮内层 `--agent verifier` 调用 `task-a331fc39-810f-4a70-8d25-08659d11cf7d` 在另一实例上 4.8 秒成功，`OK`、实报 `powerby/grok-4.6`，作为 G-19 对照证据。上述失败轮不得替代本节两条成功实报。三条信封的原文（`calls get` 原样输出）：

```text
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-2b66d138-cea9-46d3-a043-b49fa38017f5
{"call_id":"task-2b66d138-cea9-46d3-a043-b49fa38017f5","agent":"dev","state":"failed","duration_ms":1441508,"model":null,"truncated":true,"text":"子进程退出 code=143 signal=","structured_output":null,"error":"context_crashed","exit_code":null}

$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-ccf0b236-a01d-4c2f-8ea5-9339f9b12a6d
{"call_id":"task-ccf0b236-a01d-4c2f-8ea5-9339f9b12a6d","agent":"dev","state":"failed","duration_ms":1340742,"model":null,"truncated":false,"text":"上下文实例已不可用，排队轮次未执行","structured_output":null,"error":"context_crashed","exit_code":null}

$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-a331fc39-810f-4a70-8d25-08659d11cf7d
{"call_id":"task-a331fc39-810f-4a70-8d25-08659d11cf7d","agent":"verifier","state":"completed","duration_ms":4801,"model":"powerby/grok-4.6","truncated":false,"text":"OK","structured_output":null,"error":null,"exit_code":0}
```

内层信封的 `text` = `上下文实例已不可用，排队轮次未执行` ⇒ **排队轮次从未执行**，这是 G-19 自排队死锁的机制级证据；外层 `text` = `子进程退出 code=143 signal=`（143 = 128+15 = SIGTERM，即主 agent 的 `kill -TERM`）。第三条为对照组（落在另一实例）。

时序判定：merge 提交时间为 `2026-09-16 10:42:01 +0800`；R1 down 完成于 `10:45:19`、最终 up 完成于 `10:45:52`；`verifier` 实报 `started_at=1789528236416`（`2026-09-16T11:10:36+0800`）并于 `1789528248772` 结束，`dev` 实报 `started_at=1789528253003`（`2026-09-16T11:10:53+0800`）并于 `1789528257838` 结束。严格顺序为 merge < 重启 < verifier 实报 < dev 实报。重启后的新 session（10:45:51）与新 7788 PID（29203）证明进程换代；`oamp/src/cluster.js:200-201` 的角色级 `model` → `--model` 规则与两条无 `--model` 的后重启实报共同证明不存在“文件已合、集群仍跑旧配置”。

逐条验收判定：

1. **合并存在（F08 验收 1）：通过。** `fb7b8dc` 的 message 合规，且 main 的完整 tracked 清单包含合并后的迭代产物；`pr-010` 由本次收口登记提交落盘。
2. **重启已发生（F08 验收 2）：通过。** R1 逐字交付 down/up 命令、起止时间及输出；重启后主 session/PID 换代，10 个 `pb-*` 全部 `online`，第二集群保留。
3. **加载的是合并后的配置（F08 验收 3）：通过。** merge < 重启 < 两条实报，且新进程的角色启动日志与实报分别为 `openai/`、`powerby/`；不存在“文件已合、集群仍跑旧配置”。
4. **两条实报（F08 验收 4）：通过。** 两个不同 `call_id` 均 completed、error 为 null、exit_code 为 0；`dev` → `openai/` gpt，`verifier` → `powerby/` grok，原文已照录。
5. **证据可核对（F08 验收 5）：通过。** 本小节保留 merge、R1 重启、10 实例在线表、两条终态实报、失败轮/G-19 与严格时序；收口登记提交的完整 hash 由本次提交后的 `git log --oneline -1` 与 `git show --stat HEAD` 原始输出核对。

边界复核：未重复证明绑定字段取值正确，未给其它角色补取证，未要求第二集群 `down`/清理；本 PR 无套件可跑，结论以只读命令原始输出与文件内容核验为准，不声称“测试全绿”。
