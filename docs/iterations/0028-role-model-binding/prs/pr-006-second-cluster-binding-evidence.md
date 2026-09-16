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
