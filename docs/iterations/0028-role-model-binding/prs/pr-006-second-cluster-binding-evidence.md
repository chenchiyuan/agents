# pr-006：第二集群三条绑定实报（F05/F06/F07）

## 上下文摘要

在第二集群自己的 chat 内取三条终态实报：`dev` 实报解析到 gpt 后端、`verifier` 实报解析到 grok 后端、未绑定的对照组 `prd` 实报解析到默认链路（deepseek 系）。三条命令形态逐字一致，唯一变量是 `--agent`；三条均不带 `--model`（真源唯一）。该 chat 在第二集群的空库上从零建立（建 chat 用一条 shell 形态消息，无模型参与），归属经 `chats get` 的 `messages[].meta.task_id` 与三条 `call_id` 逐条对上。判据口径按 MI-3：不要求实报字符串与绑定值逐字相等，只判"解析到同一后端"，实报字符串原文照录保留。

## 涉及功能点

- F05
- F06
- F07

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md`（本 PR 文件：三条实报与 chat 归属写入「验收证据」小节）

排除（本 PR 不触碰）：`cluster.second.json`（pr-005）、`status.md`（主 agent 滚动维护，三条实报的台账行由主 agent 追加并在 `用途` 列注明"第二集群绑定实报"）、`deferred-demand-changes.md`（pr-007）。

## 验收标准

- [ ] 第二集群（`--port 7789`）内建立 `chat-0028-second-cluster`：`api projects create --repo-url https://github.com/chenchiyuan/agents --port 7789` 取 `project_id`，再由一条 shell 形态消息建 chat（`api messages send --chat-id chat-0028-second-cluster --project-id <prj> --agent-id pb-workflow-pb --text '!echo second-cluster-chat-ready' --port 7789`）；该消息非角色派发、无模型参与，不构成对照判据（F07 架构维度 / D-05）
- [ ] 三条实报均为 `api calls create --chat-id chat-0028-second-cluster --agent <dev|verifier|prd> --task "<…>" --mode block --port 7789`：除 `--agent` 外命令形态逐字一致，三条均**不带** `--model`（D-05 / F09 验收 3）
- [ ] 三条终态信封的 `model` 分别解析到：`dev` → gpt 后端（provider 前缀 `openai/`，F05 验收 1）；`verifier` → grok 后端（`powerby/`，F06 验收 1）；`prd` → 默认链路 deepseek 系（F07 验收 1）——判据为"解析到同一后端"，实报字符串**原文照录**保留（MI-3，F05/F06/F07 验收 4）
- [ ] 三条终态字段（`state` / `model` / `error` / `exit_code`）逐字留存，三个 `call_id` 互不相同；三条 `state` 为终态（F05/F06 验收 2、F07 验收 3）
- [ ] 归属核对：`api chats get chat-0028-second-cluster --port 7789` 的 `messages[].meta.task_id` 与三条 `call_id` 逐条对上（调用信封封闭 10 键、不含 `chat_id`，归属只能走这一条）（F10 验收 2 / A-05）
- [ ] 三条实报彼此同属该 chat（F10 验收 2 的判定对象）；**不要求**与迭代 chat `chat-6c89902c-…` 同源（R-1 读法 (b)）
- [ ] 取证命令形态与 chat 存储均落在第二集群：`--port 7789`、对话库 `<工作区>/oamp/data/sql.db`（A-05：不共享对话存储，不设 `OAMP_DB`）
- [ ] 取证不携带 `--model`：三条实报的模型取值只能来自第二集群的角色级绑定（F05 验收 3 / F06 验收 3 / F13 验收 2）；绑定生效之前的既有调用不纳入判据（F05/F06 验收 5）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md` / `F06-verifier-binding-evidence.md` / `F07-unbound-control-evidence.md`（验收与边界、架构维度 A-05、MI-3）
- `docs/iterations/0028-role-model-binding/architecture.md` §3.2 取证链、§4 A-05（不共享 + 三条实报的定位与留证）、§5 D-05 / D-06（建 chat 形态与目标节点选择）
- `docs/iterations/0028-role-model-binding/prd.md` §术语口径（"第二集群 chat"）与 §本次迭代边界说明（端到端实证）
- 代码锚点：`oamp/src/cluster.js:190`（web 窗口端口取 `config.web.port`）、`oamp/src/config.js:154`（对话库按包根推导）、`oamp/src/web.js:1232-1256`（`calls get` = `router.task_get`，不按来源过滤）

## depends_on

- pr-005-second-cluster-bring-up.md（理由：三条实报的取证面（`--port 7789` 的 web 与 `chat-0028-second-cluster` 所在库）都是 pr-005 的产物——证据：`oamp/src/cluster.js:190` 把 `config.web.port` 作为 web 窗口 `--port` 的唯一来源，该取值只存在于 pr-005 新建的 `<工作区>/cluster.second.json`；`oamp/src/config.js:154` 的 `dbPath` 按包根推导，`<工作区>/oamp/data/sql.db` 由 pr-005 的 `cluster up` 首次建立；缺 pr-005，三条实报无处可取）

## batch

3

## 验收证据

（本 PR 执行时填写：`project_id` / `chat_id` + 三条实报逐条一个三级标题条目（`命令` / `call_id` / `终态字段` / `实报 model 原文`）+「chat 归属核对输出」；载体约定见 `architecture.md` §4 A-02 / A-05）

### 三条绑定实报取证（第二集群 `chat-0028-second-cluster`）

执行者 dev ｜ 2026-09-16 ｜ 第二集群 = tmux session `oamp-cluster-0028`（web `127.0.0.1:7789`）｜ 所有 hub 命令均带 `--port 7789`，对缺省端口（7788＝主集群）**零写动作**

- `project_id` = `prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61`
- `chat_id` = `chat-0028-second-cluster`（由一条 **shell 形态**消息建立：`--agent-id pb-workflow-pb`、`--text '!echo second-cluster-chat-ready'`、无 `--model`）

探针文本（三条 `--task` 逐字相同，唯一变量 = `--agent`）：

```
只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件
```

> **判据口径（MI-3）**：只判"解析到**同一后端**"（provider 前缀：`openai/` / `powerby/` / `deepseek/`）；实报 `model` 字符串**原文照录**保留，不作为比较判据。

#### 实报 ① `--agent prd`（未绑定对照组 ⇒ 默认链路）

**命令**（逐字；`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`）：

```
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent prd --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
```

**call_id**：`task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc`

**终态字段**（`node <WS>/oamp/bin/hub.js api calls get task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc --port 7789` 原文）：

```
{"call_id":"task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc","agent":"prd","state":"completed","duration_ms":2199,"model":"deepseek/deepseek-v4-flash","truncated":false,"text":"SECOND-CLUSTER-PROBE","structured_output":null,"error":null,"exit_code":0}
```

| 终态字段 | 值 |
|---|---|
| `state` | `completed`（终态） |
| `model` | `deepseek/deepseek-v4-flash` |
| `error` | `null` |
| `exit_code` | `0` |
| `truncated` | `false` |
| `duration_ms` | `2199` |

**实报 model 原文**：`deepseek/deepseek-v4-flash`
**判定**：provider 前缀 `deepseek/` ⇒ **默认链路（deepseek 系）**，与副本 `roles.prd` 无 `model` 键（未绑定）一致（F07 验收 1 / MI-3）。

#### 实报 ② `--agent verifier`（绑定 `powerby/grok-4.6` ⇒ grok 后端）

**命令**（逐字）：

```
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent verifier --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
```

**call_id**：`task-40da0340-e241-4e70-aa6c-255d98dbbaa7`

**终态字段**（`node <WS>/oamp/bin/hub.js api calls get task-40da0340-e241-4e70-aa6c-255d98dbbaa7 --port 7789` 原文）：

```
{"call_id":"task-40da0340-e241-4e70-aa6c-255d98dbbaa7","agent":"verifier","state":"completed","duration_ms":6936,"model":"powerby/grok-4.6","truncated":false,"text":"SECOND-CLUSTER-PROBE","structured_output":null,"error":null,"exit_code":0}
```

| 终态字段 | 值 |
|---|---|
| `state` | `completed`（终态） |
| `model` | `powerby/grok-4.6` |
| `error` | `null` |
| `exit_code` | `0` |
| `truncated` | `false` |
| `duration_ms` | `6936` |

**实报 model 原文**：`powerby/grok-4.6`
**判定**：provider 前缀 `powerby/` ⇒ **grok 后端**，与副本 `roles.verifier.model` = `powerby/grok-4.6` 一致（F06 验收 1 / MI-3）。

#### 实报 ③ `--agent dev`（绑定 `openai/gpt-5.6-luna` ⇒ gpt 后端）

**命令**（逐字）：

```
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent dev --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
```

**call_id**：`task-8589a6a0-fdea-4661-aa3d-a54a28b196cf`

**终态字段**（`node <WS>/oamp/bin/hub.js api calls get task-8589a6a0-fdea-4661-aa3d-a54a28b196cf --port 7789` 原文）：

```
{"call_id":"task-8589a6a0-fdea-4661-aa3d-a54a28b196cf","agent":"dev","state":"completed","duration_ms":5411,"model":"openai/gpt-5.6-luna","truncated":false,"text":"SECOND-CLUSTER-PROBE","structured_output":null,"error":null,"exit_code":0}
```

| 终态字段 | 值 |
|---|---|
| `state` | `completed`（终态） |
| `model` | `openai/gpt-5.6-luna` |
| `error` | `null` |
| `exit_code` | `0` |
| `truncated` | `false` |
| `duration_ms` | `5411` |

**实报 model 原文**：`openai/gpt-5.6-luna`
**判定**：provider 前缀 `openai/` ⇒ **gpt 后端**，与副本 `roles.dev.model` = `openai/gpt-5.6-luna` 一致（F05 验收 1 / MI-3）。

#### 环境与基线（执行前，只读）｜PR 验收 7 / 8

**就绪判据**（`deferred-demand-changes.md` G-17 ④：`cluster.js:415` 的 online 复核用 `runtimeConfig.socketPath`、`cluster.js:393` 的 router 等待用 `config.router.socket` ⇒ 两侧不同源，**不用 `cluster up` 的 exit code 判就绪**）：

```
$ node <WS>/oamp/bin/hub.js api agents --port 7789
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
（`pb-*` 计数 = 10，非 `online` 计数 = 0；固有节点 `web` 不在返回集中）
```

```
$ ls -l <WS>/oamp/data/sql.db
-rw-r--r-- 1 chenchiyuan staff 45056 Sep 16 09:53 <WS>/oamp/data/sql.db
$ lsof -nP -iTCP:7789 -sTCP:LISTEN
COMMAND   PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    92023 chenchiyuan   15u  IPv4 0x869d19e49509361d      0t0  TCP 127.0.0.1:7789 (LISTEN)
$ printenv | grep -i '^OAMP_DB'
（零输出，exit=1 ⇒ 未设 `OAMP_DB`，`config.js:154` 的包根推导生效）
$ grep -n '"session"\|"port"\|"socket"' <WS>/cluster.second.json
2:  "session": "oamp-cluster-0028",
4:    "port": 7789
7:    "socket": "/tmp/oamp-0028-router.sock"
$ grep -n 'model' <WS>/cluster.second.json
14:      "model": "openai/gpt-5.6-luna",
24:    "verifier": { "model": "powerby/grok-4.6" },
（`prd` 角色行无 `model` 键 ⇒ 未绑定，走默认链路）
$ node <WS>/oamp/bin/hub.js api calls list --port 7789
{"calls":[]}
（执行前零调用基线）
```

**绑定生效时点锚点**：pr-005 证据小节 `#### ② 启动命令逐字 + 启动时间` 的发起时点 = **2026-09-16 09:53:43 CST**（第二集群启动即加载 `cluster.second.json` 的角色级绑定）；三条实报的 `started_at` = `1789524265145`（dev）/ `1789524265164`（verifier）/ `1789524265197`（prd）⇒ 均**后于**该时点，且三条命令均不带 `--model` ⇒ 满足"绑定生效之前的既有调用不纳入判据"（F05 / F06 验收 5、PR 验收 8）。

#### 建 `project` 与 chat（shell 形态消息，非判据）｜PR 验收 1

```
$ node <WS>/oamp/bin/hub.js api projects create --repo-url https://github.com/chenchiyuan/agents --port 7789
{"project":{"project_id":"prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61","name":"agents","repo_url":"https://github.com/chenchiyuan/agents","created_at":1789524243553}}
$ node <WS>/oamp/bin/hub.js api messages send --chat-id chat-0028-second-cluster --project-id prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61 --agent-id pb-workflow-pb --text '!echo second-cluster-chat-ready' --port 7789
{"chat_id":"chat-0028-second-cluster","task_id":"task-b9b119fd-8d2d-45d0-b012-70024ae88bd6","message_id":"msg-d3bf8017-5ef9-40de-84d1-16aa3225161e","warning":null}
$ node <WS>/oamp/bin/hub.js api chats list --project-id prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61 --port 7789
{"chats":[{"chat_id":"chat-0028-second-cluster","title":"!echo second-cluster-chat-ready","agent_id":"pb-workflow-pb","state":"completed","created_at":1789524257341,"updated_at":1789524257349,"archived_at":null,"message_count":2}],"total":1,"limit":50,"offset":0}
```

- **建 chat 前该 project 下零对话**（PR 验收 1 的"从零建立"判据）：`api chats list --project-id prj-d712d1b7-… --port 7789` ⇒ `{"chats":[],"total":0,"limit":50,"offset":0}`。
- 该 shell 消息命令**不含** `--model`；`--agent-id pb-workflow-pb` 与三条实报的三个节点（`pb-dev` / `pb-verifier` / `pb-prd`）不相交（D-06）。
- 执行痕迹（如实登记）：首次 `messages send` 因 dev 侧提取 `project_id` 的路径取值错误（`projects create` 的返回为嵌套结构 `.project.project_id`，首次误取顶层）而失败一次 —— 原文 `{"code":"INVALID_PARAM","error":"项目不存在: null","exit_code":1,"http_status":400}`；随后以正确 `project_id` 重跑同一条命令成功。该失败未创建任何 chat（其时 `chats list` 仍为 `{"chats":[],...}`）。
- **命令形态偏差（如实登记，见「执行中发现的事实偏差」①）**：该 shell 消息**确实产生了一条调用记录**（`task-b9b119fd-…`，`agent: workflow-pb`，`state: completed`，`model: null`），与任务图 T3-3 的"调用数不增"不符。

#### 三条命令形态自证与并发发起｜PR 验收 2 / 8

三条命令全文（与上文三条 `命令` 逐字一致；`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`）：

```
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent dev --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent verifier --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent prd --task "只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件" --mode block --port 7789
```

形态自证（机械判据 = 把 `--agent <值>` 归一为 `--agent <A> ` 后三行逐字比较）：

```
$ sed -E 's/--agent (dev|verifier|prd) /--agent <A> /' <三条命令> | diff 逐对比较
1v2 差异 = 0（exit 0）；1v3 差异 = 0（exit 0）
$ grep -c -- '--mode block'  → 3
$ grep -c -- '--port 7789'   → 3
$ grep -c -- '--model'       → 0
```

⇒ 除 `--agent` 外**逐字一致**、三条**均带** `--mode block` 与 `--port 7789`、三条**均不带** `--model`；模型取值只能来自第二集群的角色级绑定（F05/F06 验收 3、F13 验收 2）。

**并发发起形态**（`T4_START` = 2026-09-16 10:04:25 CST，三条各自 stdout/stderr 落独立日志）：

```
$ nohup node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent dev      --task "…" --mode block --port 7789 > /tmp/0028-pr-006/dev.log      2>&1 &
$ nohup node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent verifier --task "…" --mode block --port 7789 > /tmp/0028-pr-006/verifier.log 2>&1 &
$ nohup node <WS>/oamp/bin/hub.js api calls create --chat-id chat-0028-second-cluster --agent prd      --task "…" --mode block --port 7789 > /tmp/0028-pr-006/prd.log      2>&1 &
（`…` = 上表 `--task` 文本，逐字）
```

**`call_id` 登记与并发观测**（`api calls list --port 7789`，发起后 3 s 与 16 s 两次）：

```
$ node <WS>/oamp/bin/hub.js api calls list --port 7789     # 发起后 3 s
{"calls":[{"call_id":"task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc","agent":"prd","state":"completed","started_at":1789524265197,"ended_at":1789524267397,"model":"deepseek/deepseek-v4-flash"},{"call_id":"task-40da0340-e241-4e70-aa6c-255d98dbbaa7","agent":"verifier","state":"working","started_at":1789524265164,"ended_at":null,"model":null},{"call_id":"task-8589a6a0-fdea-4661-aa3d-a54a28b196cf","agent":"dev","state":"working","started_at":1789524265145,"ended_at":null,"model":null},{"call_id":"task-b9b119fd-8d2d-45d0-b012-70024ae88bd6","agent":"workflow-pb","state":"completed","started_at":1789524257343,"ended_at":1789524257349,"model":null}]}
$ node <WS>/oamp/bin/hub.js api calls list --port 7789     # 发起后 16 s（三条全终态）
{"calls":[{"call_id":"task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc","agent":"prd","state":"completed","started_at":1789524265197,"ended_at":1789524267397,"model":"deepseek/deepseek-v4-flash"},{"call_id":"task-40da0340-e241-4e70-aa6c-255d98dbbaa7","agent":"verifier","state":"completed","started_at":1789524265164,"ended_at":1789524272101,"model":"powerby/grok-4.6"},{"call_id":"task-8589a6a0-fdea-4661-aa3d-a54a28b196cf","agent":"dev","state":"completed","started_at":1789524265145,"ended_at":1789524270557,"model":"openai/gpt-5.6-luna"},{"call_id":"task-b9b119fd-8d2d-45d0-b012-70024ae88bd6","agent":"workflow-pb","state":"completed","started_at":1789524257343,"ended_at":1789524257349,"model":null}]}
```

三个 `call_id` **互不相同**：`task-8589a6a0-fdea-4661-aa3d-a54a28b196cf`（dev）/ `task-40da0340-e241-4e70-aa6c-255d98dbbaa7`（verifier）/ `task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc`（prd）。并发成立的旁证：三条 `started_at` 相差 ≤ 52 ms（…145 / …164 / …197），而 prd 先于另两条终态（`ended_at` …397 vs …557 / …101）⇒ 三条确实同轮并发、总墙钟 ≈ 最慢一条 ≈ 7 s。

**零污染反查**（契约 2 / PR 验收 7）：

```
$ node <WS>/oamp/bin/hub.js api calls list --port 7788 | grep -c 'task-8589a6a0\|task-40da0340\|task-2eac7142'
0
```

#### 三条并排对照与后端判定｜PR 验收 3（F06 验收 5 / F07 验收 5）

| # | `--agent` | `call_id` | 副本绑定取值（`cluster.second.json`） | 实报 `model` 原文 | 判定（MI-3：同一后端） |
|---|---|---|---|---|---|
| ① | `prd`（未绑定对照） | `task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc` | （`prd` 无 `model` 键） | `deepseek/deepseek-v4-flash` | `deepseek/` ⇒ **默认链路** |
| ② | `verifier` | `task-40da0340-e241-4e70-aa6c-255d98dbbaa7` | `powerby/grok-4.6` | `powerby/grok-4.6` | `powerby/` ⇒ **grok 后端** |
| ③ | `dev` | `task-8589a6a0-fdea-4661-aa3d-a54a28b196cf` | `openai/gpt-5.6-luna` | `openai/gpt-5.6-luna` | `openai/` ⇒ **gpt 后端** |

⇒ 三条分别落在 **三个不同后端**（`deepseek/` / `powerby/` / `openai/`）⇒ 形成"两处绑定生效、未绑定角色不受影响"的完整对照组；三条 `state` 均为终态 `completed`、`error` 均为 `null`、`exit_code` 均为 `0`。

#### chat 归属核对输出｜PR 验收 5 / 6

命令与原文（`node <WS>/oamp/bin/hub.js api chats get chat-0028-second-cluster --port 7789`）：

```
{"chat":{"chat_id":"chat-0028-second-cluster","title":"!echo second-cluster-chat-ready","agent_id":"pb-workflow-pb","state":"completed","created_at":1789524257341,"updated_at":1789524272101,"closed_at":null,"archived_at":null,"context_released":0},"messages":[{"id":1,"direction":"in","agent_id":"pb-workflow-pb","text":"!echo second-cluster-chat-ready","model":null,"duration_ms":null,"error":null,"created_at":1789524257341,"meta":{"task_id":"task-b9b119fd-8d2d-45d0-b012-70024ae88bd6"}},{"id":2,"direction":"out","agent_id":"pb-workflow-pb","text":"second-cluster-chat-ready","model":null,"duration_ms":5,"error":null,"created_at":1789524257349,"meta":null},{"id":3,"direction":"in","agent_id":"pb-dev","text":"只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件","model":null,"duration_ms":null,"error":null,"created_at":1789524265144,"meta":{"task_id":"task-8589a6a0-fdea-4661-aa3d-a54a28b196cf"}},{"id":4,"direction":"in","agent_id":"pb-verifier","text":"只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件","model":null,"duration_ms":null,"error":null,"created_at":1789524265163,"meta":{"task_id":"task-40da0340-e241-4e70-aa6c-255d98dbbaa7"}},{"id":5,"direction":"in","agent_id":"pb-prd","text":"只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件","model":null,"duration_ms":null,"error":null,"created_at":1789524265196,"meta":{"task_id":"task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc"}},{"id":6,"direction":"out","agent_id":"pb-prd","text":"SECOND-CLUSTER-PROBE","model":"deepseek/deepseek-v4-flash","duration_ms":2199,"error":null,"created_at":1789524267397,"meta":{"context_id":"ctx-99520-1","pid":99520}},{"id":7,"direction":"out","agent_id":"pb-dev","text":"SECOND-CLUSTER-PROBE","model":"openai/gpt-5.6-luna","duration_ms":5411,"error":null,"created_at":1789524270557,"meta":{"context_id":"ctx-99515-1","pid":99515}},{"id":8,"direction":"out","agent_id":"pb-verifier","text":"SECOND-CLUSTER-PROBE","model":"powerby/grok-4.6","duration_ms":6936,"error":null,"created_at":1789524272101,"meta":{"context_id":"ctx-99518-1","pid":99518}}]}
```

归属核对（唯一通道 = `messages[].meta.task_id`；`calls get` 信封为封闭 10 键 `agent,call_id,duration_ms,error,exit_code,model,state,structured_output,text,truncated`，**不含 `chat_id`**）：

| # | `call_id` | `meta.task_id` 命中位置 | 命中数 | 该消息 `agent_id` 原文 | 判定 |
|---|---|---|---|---|---|
| ① | `task-2eac7142-3f3f-4a9e-aafe-c53e7fc8e7dc`（prd） | `messages[].id = 5`（`direction: in`） | 1 | `pb-prd` | ✅ |
| ② | `task-40da0340-e241-4e70-aa6c-255d98dbbaa7`（verifier） | `messages[].id = 4`（`direction: in`） | 1 | `pb-verifier` | ✅ |
| ③ | `task-8589a6a0-fdea-4661-aa3d-a54a28b196cf`（dev） | `messages[].id = 3`（`direction: in`） | 1 | `pb-dev` | ✅ |
| — | `task-b9b119fd-8d2d-45d0-b012-70024ae88bd6`（shell 消息，**非判据**） | `messages[].id = 1` | 1 | `pb-workflow-pb` | 不参与对照（D-06：节点与三个对照节点不相交） |

（`id = 2 / 6 / 7 / 8` 为 `direction: out` 的角色回包，`meta` 为 `null` 或仅含 `context_id`/`pid`，不含 `task_id`，不参与归属判据。）

⇒ **三条实报彼此同属** `chat-0028-second-cluster`（同址判定成立，PR 验收 6）；**不要求**与迭代 chat `chat-6c89902c-…` 同源（R-1 读法 (b)）。第二集群侧仅此一个承载三条实报的 chat。

**跨库对照（只读旁证，P1）**：

```
$ node <WS>/oamp/bin/hub.js api chats list --project-id prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61 --port 7789 | grep -c 'chat-0028-second-cluster'
1
$ node <WS>/oamp/bin/hub.js api chats list --project-id prj-b1a74533-2c8e-449f-be7e-c5e47331b531 --port 7788 | grep -c 'chat-0028-second-cluster'
0
```

（7788 侧的输出含主集群既有 chat 如 `chat-6c89902c-0a9f-4513-a299-90a7f98ae611`，其中**不含**本 PR 的 chat ⇒ 与 `architecture.md` §4 A-05「不共享」一致。注：`chats list` 的 `--project-id` 为必填（`oamp/sdk/surface.js:123-124`），故 7788 侧以主集群既有 project `prj-b1a74533-…`（`projects list --port 7788` 只读取得）为过滤条件。）

#### 运行态副作用登记（brief 硬约束 6）

**① 第二集群运行态写入面** = 第二集群自己的对话库 `<WS>/oamp/data/sql.db`：

| 写入物 | 数量 | 判据（原始输出） |
|---|---|---|
| `project` | 1（`prj-d712d1b7-6ef1-4a41-b5f3-18d6f6939c61`） | `projects create` 返回原文（见上） |
| `chat` | 1（`chat-0028-second-cluster`） | `chats list --project-id … --port 7789` ⇒ `"total":1` |
| shell 消息 + 其回包 | 2 条消息 | `chats get` 的 `messages[].id = 1, 2` |
| 三条实报调用（+ 回包消息 3 条） | 3 条调用 / 3 条回包消息 | `calls list --port 7789` 中 `agent` ∈ {dev, verifier, prd} 计数 = 3；`chats get` 的 `id = 3~5`（in）与 `6~8`（out） |
| 建 chat 的 shell 调用记录 | 1 条（`task-b9b119fd-…`，`model: null`） | `calls list --port 7789`（见上述偏差登记①） |

**文件字节对照（如实照录，含其局限）**：`<WS>/oamp/data/sql.db` **before** = `45056` 字节（mtime `Sep 16 09:53`，即 pr-005 启动后时点）；**after** = `45056` 字节（mtime `2026-09-16 10:04:32`，`birth` `2026-09-16 09:53:44`）。⇒ **字节数未变、mtime 前进**（SQLite 页级预分配；`data/` 下无 `-wal` / `-shm` 残留）⇒ 字节差**不足以**作为写入判据，**以 API 面为权威判据**：`calls list --port 7789` 的 3 条 + `chats get` 的 8 条消息（上表）。

**② scratch 落点**（两工作区之外，不进任何 SCM 判据面）：`/tmp/0028-pr-006/dev.log`、`/tmp/0028-pr-006/verifier.log`、`/tmp/0028-pr-006/prd.log`（三条并发发起的 stdout/stderr；内容与 `calls get` 终态信封逐字一致）。

**③ 未写入清单与反向判据**：

| 面 | 判据 | 结果 |
|---|---|---|
| `<WS>/cluster.second.json` | `shasum -a 256` | `52e971ad5a204de3cce73fc616941f2baf771530f9c8b9145f021a252c207fe9` = 执行前同值（本 PR 零改动） |
| `<MAIN>/cluster.json` | `shasum -a 256` | `7eaa38ef71db9794e3e8464469b0bdae8bdab5685ef76dca9d4431807cd5a258` = 执行前同值 |
| `oamp/**`、`roles/**` | `git -C <WS> status --porcelain` | 无 `oamp/` / `roles/` 行（输出见下） |
| `status.md` / `deferred-demand-changes.md` | 同上 | 二者的 ` M` 行均为执行前既有（主 agent 在途），本 PR 未写 |
| 主集群 | `calls list --port 7788` grep 三条 `call_id` / `chats list --port 7788` grep chat_id | `0` / `0`（零污染） |
| 集群启停 | 本 PR 未执行 `cluster up` / `cluster down` | 现场保留：`oamp-cluster-0028` 12 窗口、7789 监听 |

```
$ git -C <WS> status --porcelain
 M docs/iterations/0028-role-model-binding/deferred-demand-changes.md
 M docs/iterations/0028-role-model-binding/history.md
 M docs/iterations/0028-role-model-binding/status.md
?? cluster.second.json
?? docs/iterations/0028-role-model-binding/clarifications/stage5-pr-verdicts-20260916.md
?? docs/iterations/0028-role-model-binding/clarifications/verify-20260915-221935.md
?? docs/iterations/0028-role-model-binding/progress.md
?? docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
?? docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md
?? docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md
?? docs/iterations/0028-role-model-binding/prs/pr-009-existing-surface-freeze.md
?? docs/iterations/0028-role-model-binding/prs/pr-010-post-merge-activation-evidence.md
（全部为执行前既有在途行；本 PR 未在 `<WS>` 下新增任何路径）
```

**④ 声明**：本 PR 的**唯一版本控制写入** = 本 worktree 内的本 PR 文件（`docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md`）；上述第二集群对话库与 `/tmp` scratch 均为**运行态副作用**，非本 worktree 的版本控制产物。

#### 截断去向（D-16 / `architecture.md` §4 A-03 第 3 拍）｜F11 验收 2

三条实报的 `truncated` 取值逐条记录：`prd` = `false`、`verifier` = `false`、`dev` = `false` ⇒ **三条 `truncated` 均为 `false`**（无截断），故**本次不产生**"待 F12 收录"的聚合行。

#### 执行中发现的事实偏差（如实登记，不自行补方案；契约 10）

1. **shell 形态消息**确实**产生一条调用记录**：`{"call_id":"task-b9b119fd-8d2d-45d0-b012-70024ae88bd6","agent":"workflow-pb","state":"completed","started_at":1789524257343,"ended_at":1789524257349,"model":null}` —— 与任务图 T3-3「执行后 `api calls list` 中**不出现**由该消息产生的调用（调用数不增）」（PR 验收 1 / F07 架构维度）**不一致**。实测事实：`messages send` 走同一条任务链路，形成一条 `model: null` 的调用记录。**影响面**：不影响本 PR 的三条对照判据 —— 该记录 `agent` = `workflow-pb`，与三个对照节点（`pb-dev` / `pb-verifier` / `pb-prd`）不相交（D-06 的选择正是为了避免该噪声），且在证据中已显式标注为"非判据"。**上报项**（不在本 PR 自行补写或改判）。
2. **`api chats list` 的 `--project-id` 为必填**（`oamp/sdk/surface.js:123-124`）⇒ 任务图 T2-5 的"执行前 `chats list` 基线"无法在无 project 时取得；本 PR 以"建 project 后、建 chat 前 ⇒ `{"chats":[],"total":0,…}`"等价满足"`chat-0028-second-cluster` 此前不存在"的判据。
3. **探针 `--task` 文本的取值**：brief 的示例含 `<agent>` 占位，而 PR 验收 2 的机械判据要求"除 `--agent` 外命令形态逐字一致"，二者不能同时成立 ⇒ 本 PR 取**三条完全相同的固定文本**（`只回复一行：SECOND-CLUSTER-PROBE；不要读写任何文件`），依据任务图 §4-①4「由 dev 选一条中性的固定文本并在证据中原文照录」。故三条 `text` 回包一律为 `SECOND-CLUSTER-PROBE`（不含角色名）。
4. **`data/sql.db` 字节数不变**（45056 → 45056）：见「运行态副作用登记」①的判据局限说明。

#### 本 PR 八条验收标准逐条判定

| # | 验收标准（本 PR 文件） | 判定 | 证据 |
|---|---|---|---|
| 1 | 第二集群内建 `chat-0028-second-cluster`（`project_id` + shell 形态消息；该消息非角色派发、不构成对照判据） | **通过**（判据"该消息不产生调用"一项按偏差①如实登记） | 见「建 `project` 与 chat」段；`project_id` = `prj-d712d1b7-…`、`chat_id` = `chat-0028-second-cluster`；shell 消息命令不含 `--model` |
| 2 | 三条命令除 `--agent` 外形态逐字一致、均不带 `--model` | **通过** | 「三条命令形态自证」：归一后逐对 `diff` 差 0；`--mode block` ×3、`--port 7789` ×3、`--model` ×0 |
| 3 | 三条 `model` 分别解析到 gpt / grok / 默认（MI-3，同一后端 + 原文照录） | **通过** | 「三条并排对照」：`openai/gpt-5.6-luna` / `powerby/grok-4.6` / `deepseek/deepseek-v4-flash` |
| 4 | 终态字段逐字留存；三个 `call_id` 互不相同；`state` 为终态 | **通过** | 三条 `calls get` 原文（10 键信封）+ `calls list` 原文；三 `call_id` 互异；`state` = `completed` |
| 5 | 归属核对走 `messages[].meta.task_id` 与三条 `call_id` 逐条对上 | **通过** | 「chat 归属核对输出」：三条各命中恰一处（`id` 5 / 4 / 3） |
| 6 | 三条彼此同属该 chat；不要求与迭代 chat 同源 | **通过** | 同上（同址判定）；跨库对照 7788 侧 `grep -c` = 0 |
| 7 | 取证命令形态与 chat 存储均落第二集群（`--port 7789`、库 `<WS>/oamp/data/sql.db`、不设 `OAMP_DB`） | **通过** | 「环境与基线」：7789 LISTEN、`printenv` 无 `OAMP_DB`、库路径；三条命令均含 `--port 7789`；7788 侧零命中 |
| 8 | 不携带 `--model`；绑定生效前的既有调用不纳入判据 | **通过** | `--model` 计数 = 0；三条 `started_at` 晚于 pr-005 启动时点 09:53:43 CST；执行前 `calls list` = `{"calls":[]}` |
