# oamp — 本机多智能体运行时 CLI

零依赖 Node.js v22 ESM 命令行工具：单一入口拉起 Router、拉起 agent 节点、查询拓扑状态、运行对话式 Web 控制台。
运行参数经环境变量 + 可选配置文件 `oamp/config.json`（库路径 / 默认模型 / 上下文上限三键）提供；
节点与 Router 间为 UDS + JSON-RPC 2.0；对话历史落 SQLite（`node:sqlite`，仍为零第三方依赖），实时增量走 SSE。

> **当前状态**：CLI 分发、Router/agent 运行时、`status` 只读查询、`task` 任务指派/进度查询与
> **`web` 对话控制台（持久化 + 实时推送 + 常驻上下文）**均已落地可用——
> `oamp router start`、`oamp agent start <instance-id>`、`oamp status`、
> `oamp task send/status/list/watch`、`oamp web start` 端到端可执行
> （复现步骤见下方 E2 手测、任务演示与 Web 控制台）。

## 快速开始

前置：Node.js ≥ 22。进入 `oamp/` 目录。

方式一（推荐，`npm link` 后裸用 `oamp`）：

```sh
npm link
oamp --help
```

方式二（直接以 node 运行，不依赖 PATH）：

```sh
node bin/oamp.js --help
```

两者等价；下文命令以 `oamp` 指代。

## E2 手测步骤（三终端）

> 完整 E2 复现：Router 终端 + agent 终端 + `oamp status` 查询，按下列步骤直接执行即可
> 观察到"节点 online、心跳持续可见、kill 后 offline"。

1. **终端 1（Router）**：`oamp router start` → 等待 stdout 出现就绪行 `ROUTER_READY socket=…`。
2. **终端 2（agent）**：`oamp agent start dev-1` → 注册成功打印 `REGISTERED`，随后周期心跳。
3. **终端 1（观察）**：可看到该节点的心跳/状态事件行（心跳日志按窗口节流）。
4. **终端 3（查询）**：`oamp status` → 对齐表格，`dev-1` 行 `state=online`。
5. **下线验证**：回到终端 2 按 Ctrl-C（SIGINT）→ 优雅注销 `DEREGISTERED`；或直接 kill agent 进程
   → 等约 `OAMP_HEARTBEAT_TIMEOUT_MS` 后 `oamp status` 中该节点 `state=offline`。

## 任务指派与进度查询（demo：主 agent 视角）

agent 节点内置 **shell 任务执行器**：收到 `task.request` 后受理（ack），无 shell 直启命令
（spawn，非字符串拼接），逐行 stdout/stderr 上报进度，结束时回报结果。Router 维护全内存
**任务表**（task_id → 状态 + 明细流），发起方无需常驻即可随时查询。

```sh
# 前提：Router（终端 1）与 agent（终端 2，`oamp agent start dev-1`）已运行

# 指派任务（任务 JSON 内联或 @文件；发送方以 'main' 身份临时注册）
oamp task send dev-1 '{"command":"node","args":["-e","console.log(\"step 1\"); console.log(\"step 2\")"],"label":"demo"}'
# → task_id: task-xxxx…   （记下 task_id）

# 随时查进度与明细（增量输出，直到终态自动退出）
oamp task watch task-xxxx…
# → 任务状态: submitted/working … ▶ started … │ step 1 … 任务终态: completed / 结果: exit_code=0 …

# 一次性查详情 / 列列表
oamp task status task-xxxx…
oamp task list [--state completed]

# 失败/超时示例
oamp task send dev-1 '{"command":"node","args":["-e","process.exit(3)"],"label":"失败演示"}'
oamp task send dev-1 '{"command":"node","args":["-e","setTimeout(()=>{},60000)"],"timeout_ms":300}'
```

任务 JSON 字段：`command`（必填）/ `args`（字符串数组）/ `timeout_ms`（默认 30000，上限 600000）/
`label`（可选说明）。任务与明细存于 Router 内存（Router 重启即清空——迭代 0010 N2 无持久化边界）。
安全边界（demo）：**任务命令来自 payload，任何能向 agent 发消息的注册节点均可驱动执行**——
鉴权/白名单属后续迭代（迭代 0010 N6 已把鉴权划出范围）。

## 环境变量参数表

| env | 作用对象 | 默认 | 说明 |
|---|---|---|---|
| `OAMP_SOCKET` | 全部 | `<oamp 包根>/.runtime/router.sock` | Router UDS socket 路径（测试/并行手测用临时路径覆盖） |
| `OAMP_HEARTBEAT_INTERVAL_MS` | agent | `10000` | 心跳周期（毫秒）；正整数 |
| `OAMP_HEARTBEAT_TIMEOUT_MS` | Router | `30000` | 租约超时（毫秒）；正整数；建议 ≥ 2×interval |
| `OAMP_HB_LOG_WINDOW_MS` | Router | `60000` | 心跳日志节流窗口（毫秒）；正整数 |
| `OAMP_RECONNECT` | agent | `1` | 断线/连接失败后自动重连重注册（自愈，D22）；`0` = 旧行为（断线即退） |
| `OAMP_RECONNECT_MAX_MS` | agent | `10000` | 重连退避上限（毫秒）；退避 500ms 起指数增长至该上限 |
| `OAMP_CONFIG` | 全部 | `<包根>/config.json` | 配置文件路径（见「配置面」） |
| `OAMP_DB` | web | `<包根>/data/sql.db` | 对话库路径；相对路径基准 = 包根 |
| `OAMP_OMP_MODEL` | agent | `deepseek/deepseek-v4-flash` | 默认模型（请求未指定 `model` 时生效）；`openai/gpt-5.6-luna` 为可选值，其首 token 可能数分钟 |
| `OAMP_CTX_MAX` | agent | `8` | 常驻上下文进程上限（超出按 LRU 淘汰）；正整数 |
| `OAMP_WEB_PORT` | web | `7788` | Web 控制台端口（命令行 `--port` 优先） |
| `OAMP_WEB_RECONCILE_INTERVAL_MS` | web | `5000` | 任务对账首查与间隔（毫秒，快速预算 6 次）；缺省/非法回退默认（运维/测试可调） |
| `OAMP_WEB_RECONCILE_SLOW_MS` | web | `30000` | 快速预算用尽后的低频续查间隔（毫秒）；缺省/非法回退默认 |
| `OAMP_WEB_RECONCILE_TTL_MS` | web | `1800000` | 对账登记软 TTL（毫秒，默认 30 分钟）：超时清理孤儿条目；缺省/非法回退默认 |
| `OAMP_OMP_BIN` | agent | `omp` | omp 可执行路径（测试注入 fake omp 用） |
| `OAMP_ROLE_ROOT` | agent | `<仓库根>`（oamp 包根上级） | 角色定义根：角色文件 = `<root>/roles/<role>/<role>.md`（见「集群」） |
| `OAMP_CLUSTER_CONFIG` | cluster | `<仓库根>/cluster.json` | 集群配置文件路径（`--config` 优先，见「集群」） |
| `OAMP_TMUX_BIN` | cluster | `tmux` | tmux 可执行文件路径（测试注入用） |
| `OAMP_CLUSTER_WAIT_MS` | cluster | `20000` | `cluster up` 就绪等待上限（毫秒）；`0` = 不等（测试用） |

数值类 env 一律要求正整数，非法值启动即报错退出（快速失败）。自动化测试将 interval 缩到
30–100ms、timeout 缩到 200–400ms、日志窗口缩到 ~300ms，使全链路秒级完成。

## 协议速览

- 传输：UDS 长连接，NDJSON 逐行帧（每行一个 JSON 对象），JSON-RPC 2.0 语义（请求/响应/通知）。
- socket 文件权限 0600（属主访问，无 token 鉴权机制）；默认落点 `oamp/.runtime/router.sock`。
- 方法面：`agent.register` / `agent.heartbeat`（通知）/ `agent.deregister` /
  `message.send` / `message.deliver` / `message.ack` / `router.status`。
- 详细协议契约（信封字段、错误码、时序）已随实现落地；设计依据见
  `docs/iterations/0010-oamp-minimal-cli/architecture.md`。

## 卫生红线声明

- **运行时产物不入 git**：socket 落点 `oamp/.runtime/` 与对话库落点 `oamp/data/` 均已被
  `.gitignore` 忽略；测试用 socket 与临时库全部位于系统临时目录，永不落仓库。
- **代码与配置零凭据字段**：`oamp/` 代码与配置中不出现 token / api_key / secret / password /
  credential / authorization / private_key 等赋值形态字段；本工具无鉴权凭据概念
  （本地 UDS 属主访问），仓库保持可 clone、可共享。

## Web 控制台（demo）

```sh
oamp web start [--port 7788]      # 默认 http://127.0.0.1:7788（env OAMP_WEB_PORT 可覆盖）
```

浏览器打开后：
- **左栏**：对话列表（＋ New chat；All / Working / Completed / 归档 过滤，过滤栏最右侧「归档全部」按钮；条目标题 + 状态徽标 + @agent + 时间）
- **右栏**：对话详情——消息流（你的输入 / agent 回答，含耗时与错误提示）与「关闭对话」按钮
- **归档视图**：切到「归档」标签页只列出已归档对话（按归档时间倒序；首屏 200 条，底部「加载更多」按 offset 续页，到末尾不再显示）；每一项带归档时间、归档时的原状态徽标与独立「激活」按钮——点按钮回到 All 列表顶部并恢复可对话，不打开详情
- **输入框**：`@agent 提问` —— 输入 `@` 弹出全部 agent 列表（↑↓ 选择、Enter 补全）；Enter 发送、Shift+Enter 换行；
  输入框下方可选 **模型**（留空用默认链）与 **一次性**（勾选即不累积上下文）

**三种提交形态（互不干扰，判定顺序：`!` → 一次性 → 默认常驻）**：

| 输入 | 走哪条路 | 上下文 |
|---|---|---|
| 普通提问（默认） | 常驻 `omp acp` 进程（`omp-daemon`） | **同对话累积**；新对话互不可见 |
| 勾选「一次性」 | `omp -p --no-session`（0010 原样） | 不累积，也不复用常驻上下文 |
| 以 `!` 开头 | `/bin/sh -c` shell 执行（0010 原样） | 无上下文 |

Web 服务以 `web` 身份常驻连接 Router（心跳保活）；浏览器不直连 UDS。
**等待可见性**：对话处于 `working` 期间状态行显示「思考中 · 已等待 Ns」（每秒更新，不重绘消息区）；等待超过 **30s** 追加一行提示
「当前模型首 token 可能较慢（实测可达数分钟）——可在模型框切换更快模型」（应对 reasoning 模型的静默思考期）。
安全边界：监听 127.0.0.1，无鉴权；命令由输入文本决定（迭代 0010 N6 边界）。

## 对话持久化、历史查询与实时推送（0011）

- **历史真源 = SQLite**：`chats` / `messages` 两张表（`node:sqlite`，零第三方依赖），路径由配置面 `data.db` 决定
  （默认 `<包根>/data/sql.db`，`OAMP_DB` 可覆盖）。一次问答**恰两条**记录（`in` + `out`），
  流式增量 / 心跳 / 日志等过程**永不入库**；输入先落盘再派发，派发失败或进程中断按失败轮次如实补 `out` 记录。
- **HTTP API**：

  | 方法与路径 | 说明 |
  |---|---|
  | `GET /api/agents` | 在线 agent 列表（Router 拓扑快照） |
  | `GET /api/chats` | 对话列表；`q`（标题或消息文本）/ `agent` / `state` / `from` / `to` / `archived`（缺省 `0` = 排除已归档，`1` = 只看已归档，按归档时间倒序）过滤，`limit`（默认 50、上限 200）+ `offset` 分页 |
  | `GET /api/chats/<chat_id>` | 对话详情（消息按时间升序；未知对话 → 404） |
  | `POST /api/messages` | `{chat_id?, agent_id, text, model?, one_shot?}`：落库 + 派发；已关闭对话 → 409 |
  | `POST /api/chats/<chat_id>/close` | 关闭对话（幂等）：只读、拒绝新输入、**不删数据**，并通知 agent 释放上下文 |
  | `POST /api/chats/archive` | 批量归档「未归档且非进行中」的全部对话（逐条生效，失败项留在主列表可重试），并逐个通知相关 agent 释放上下文；→ `{archived, failed, failed_ids}` |
  | `POST /api/chats/<chat_id>/activate` | 激活一条归档对话：移除归档标记、`closed` 还原为 `completed` 并清除关闭时间、置顶主列表；未归档 → 409、未知对话 → 404 |
  | `GET /api/stream?chat_id=<id>` | SSE 实时流 |

- **SSE 四类事件**：`message`（已落盘的输入/输出）/ `task_update`（流式增量，仅运行时、不入库）/ `chat_state`（状态变化）/
  `notice`（上下文释放·重置提示）。断线由浏览器自动重连，重连或刷新时以 `GET /api/chats/<id>` 全量补齐（断线期间增量不补发）。
- **对话状态**：`working` → `completed`（成功）/ `failed`（失败轮或派发失败）；关闭后为 `closed`。
  `closed` 不可重开——**唯一例外是「归档 → 激活」路径**：激活时 `closed` 还原为 `completed` 并清除关闭时间（N-5/D-6）。
  归档不改变对话 `state`，只是加一个独立归档标记；归档后该对话只读（拒绝新输入，409）。
  web 启动时把上次遗留的 `working` 对话置 `failed`（不补记录）。
- **终态对账补拉**：若 agent 已执行完、Router 任务表已是终态，但 `task.result` 投递丢失（发起者离线窗口/投递竞态），
  web 按 `router.task_get` 定时对账补落该轮 `out`（快速 5s、6 次用尽转 30s 低频续查、登记软 TTL 30min 清理；落库即停，恰一条 `out`）。
  三个间隔可用 `OAMP_WEB_RECONCILE_*` 覆盖（运维/测试用，不进配置文件）。

## 常驻上下文与关闭（0011）

- 默认路径按 **「对话 × agent」各一个常驻 `omp acp` 子进程 + 一个 ACP session** 维护上下文：
  同一对话多轮记得前文，**不同对话相互隔离**，同一对话的不同 agent 也互不串扰。
- 同一对话的轮次**串行**（单次在飞，FIFO 排队上限 8，超出以 `context_busy` 失败）；不同对话可并发；
  常驻进程总数上限 `context.max` / `OAMP_CTX_MAX`（默认 8），超出按 **LRU 淘汰**最久未用者并推送 `notice{context_reset}` 提示。
- **关闭对话即释放上下文**：web 向该对话涉及的各 agent 发 `context_release`，agent 结束该对话的常驻进程，在飞轮次按失败收尾；
  关闭后只读、拒绝新输入（409）、**不提供重开**。
- **归档即释放上下文**：归档复用同一 `context_release` 链路，对每个被归档的对话逐个通知其涉及的各 agent（best-effort，agent 离线忽略）。
  **激活不恢复上下文**：归档时释放的常驻上下文不会回来，界面在该对话头部以「此后不再记得此前内容」显式提示，直到它产生新的回答后自动消失。
- agent 进程重启会丢失全部常驻上下文（后续轮次以新的 `context_id` 重建）；**web 重启不影响**上下文（它活在 agent 进程内），历史照旧可查。

## 真实消息处理（omp / LLM 执行器）

agent 的任务执行器按 payload 路由（Web 控制台由上方「三种提交形态」决定走哪条）：

| executor | payload | 行为 |
|---|---|---|
| **omp-daemon**（默认；Web 普通提问走这条） | `{executor:"omp-daemon", chat_id, prompt:"…", model?, timeout_ms?}` | 常驻 `omp acp` 子进程 + ACP session 多轮：回答以流式增量实时回流，上下文按「对话 × agent」累积 |
| **omp**（显式一次性；Web 勾选「一次性」） | `{executor:"omp", prompt:"…", model?, tools?, timeout_ms?}` | spawn `omp -p --no-session [--no-tools] [--model X] <prompt>`——单次执行，不累积也不复用上下文 |
| shell（向后兼容；Web 以 `!` 开头） | `{command, args?, timeout_ms?, label?}` | spawn 直启命令（原行为，无上下文） |

- **模型解析链**（每轮独立）：请求 payload `model` > `OAMP_OMP_MODEL` > 配置文件 `defaults.model` > 内置 `deepseek/deepseek-v4-flash`（TTFT ~1s）；
  `openai/gpt-5.6-luna` 仍可在模型框显式指定，但它是 reasoning 模型，**首 token 可能长达数分钟**（实测 ≈242s）且本机存在间歇性无响应；
  Web 侧不注入默认值（未指定即回默认链）。对话详情里的 `model` 记录的是 **ACP 实报的生效模型**（不是请求回显）。
- 默认 `--no-tools`（纯问答更安全/更快）；需要 agent 干活时 payload 传 `tools:true` 放开工具（仅一次性路径）。
- omp 默认超时 300s（`timeout_ms` 可覆盖，上限 600s）；omp 可执行路径可用 `OAMP_OMP_BIN` 覆盖（测试注入 fake omp 用）。
- 输出经 ANSI 清理后回流；回答在对话里以浅色可读排版展示（区别于 shell 的终端块）。

> 安全边界（demo）：`tools:true` 时 omp 可调用工具操作本机；`--no-tools` 不放开。鉴权仍属后续迭代（N6 边界）。

## 集群（`oamp cluster`）

一条命令拉起本仓库的「Router + Web + 各角色实例」tmux 集群，供本机多角色协作使用。

```sh
oamp cluster up     [--config <path>] [--wait <ms>]   # 起集群（已在运行则幂等：只打印状态，不动现场）
oamp cluster status [--config <path>]                 # 只读：session/窗口/Router 拓扑/日志/逐角色对齐
oamp cluster down   [--config <path>]                 # 收口：C-c → 等子树退出 → kill-session → 残留检查
```

### `cluster.json`（仓库根）

集群配置真源 = **仓库根 `cluster.json`**（`--config` / `OAMP_CLUSTER_CONFIG` 可覆盖）。它与 `oamp/config.json`
**互不合并、互不读取**：后者回答「单个进程怎么跑」，前者回答「一组进程怎么编排」（只被 `oamp cluster *` 消费）。

```jsonc
{
  "session": "oamp-cluster",          // tmux session 名（缺省 oamp-cluster）
  "web":     { "port": 7788 },        // 传给 `oamp web start --port`
  "router":  { "socket": null },      // null = oamp 默认 socket；非空 → OAMP_SOCKET 传给子进程
  "roles": {
    "dev":      { "enabled": true, "tools": true, "permission": "allow", "cwd": "." },
    "verifier": { "permission": "deny" }
  }
}
```

`roles` 的键是**角色名**（不是 instance_id；实例 id 由 `pb-<role>` 公式生成）：

| 字段 | 类型 | 缺省 | 语义 |
|---|---|---|---|
| `enabled` | bool | `true` | `false` = 该角色不起实例 |
| `model` | string | 不写 | 角色级模型（覆盖全局默认，见下） |
| `tools` | bool | `true` | 工具开关（`false` → argv 传 `--no-tools`） |
| `permission` | `'allow'\|'deny'` | `'allow'` | permission 档（见下） |
| `cwd` | string | `"."`（= 配置文件所在目录 = 仓库根） | 该角色窗口的工作目录 |

校验在创建 tmux session **之前**完成（非法 JSON / 类型不符 / `permission` 取值非法 / 凭据类字段 /
角色文件或 `cwd` 不存在 → 报错退出 2，不留半个集群）；未知键忽略；`cwd` 相对路径基准 = 配置文件所在目录。

### tmux 组织与日志

- **session**：`cluster.json` 的 `session`（缺省 `oamp-cluster`）；**一进程一窗口**，窗口名 = `router` / `web` / `pb-<role>`；
  `up` 打印 `tmux attach -t <session>` 提示（不自动 attach）。
- **窗口 cwd**：角色窗口 = 该角色 `cwd`（缺省仓库根），`router` / `web` 窗口 = 仓库根。
- **日志落点**：`<oamp 包根>/.runtime/cluster/`，一进程一份（`router.log` / `web.log` / `pb-<role>.log`）；
  `up` 开始时逐个截断、运行期追加——窗口是实时通道，日志文件是事后追溯通道（已在 `.gitignore` 覆盖内）。
- `up` 命中已有 session → **幂等**（不启动、不改、不杀，退出 0）；`down` 无 session → 幂等退出 0；
  `up` 部分失败**不自动回滚**（保留现场，用 `status` 与日志诊断；`down` 是唯一收口动作）。

### permission 两档与审计

| 档 | 行为 | 审计 |
|---|---|---|
| `allow`（缺省） | 每次受门禁（可变更）工具调用恒回 `allow_once` 放行 | 每次调用**恰一行** `TOOL_APPROVED`（agent 事件行，落各自窗口与日志） |
| `deny` | 回 `reject_once` → 立即 `session/cancel` → 该轮以 `permission_denied` 失败（**会话保留**，下一轮可继续） | 每次调用**恰一行** `TOOL_DENIED` |

审计字段：身份 `instance` / `role` / `chat_id` / `context_id` + 协议 `pid` / `tool` / `title` / `tool_call_id` / `option`。

**边界（如实说明）**：

- **R-3 只读工具无审计**：omp 侧只有 `bash` / `edit` / `delete` / `move` 经过门禁；`read` / `glob` / `grep` 等只读工具
  **不产生请求、也没有记录**。因此审计口径是「每次**受门禁**调用恰一行」，而非「每次工具调用」。
- **R-4 缺省 cwd = 仓库根且可写**：`tools: true` 时角色可在其 cwd（缺省 = 仓库根）内读写文件、执行命令；
  需要隔离时在 `cluster.json` 里为该角色配 `cwd`，或将其 `permission` 设为 `deny` / `tools` 设为 `false`。

### 模型与工具开关的解析

- **模型链**（每轮独立）：请求 `model` > `OAMP_OMP_MODEL` > 角色级 `--model`（`roles.<role>.model`）> 全局默认 > 内置 `deepseek/deepseek-v4-flash`。
- **工具开关**：`payload.tools`（仅一次性路径）> CLI `--tools on|off`（集群恒显式传）> 内置缺省（**有角色绑定 ⇒ on，无绑定 ⇒ off**）。

单起一个角色实例（不经集群）：

```sh
OAMP_ROLE_ROOT=<仓库根> oamp agent start pb-dev --role dev --tools on --permission allow [--model M]
```

`instance_id = pb-<role>` 且 `<仓库根>/roles/<role>/<role>.md` 存在时也会自动绑定（等价于显式传 `--role`）；
角色规则经进程 argv 注入——常驻路径 `omp acp … --append-system-prompt <角色 md 绝对路径>`，
一次性路径 `omp -p … --append-system-prompt <角色 md 绝对路径>`，**不在仓库根写入任何规则类文件**。

## 配置面（oamp/config.json）

可选 JSON 文件（默认 `<包根>/config.json`，`OAMP_CONFIG` 可改路径）；文件不存在则全部走内置默认：

```json
{ "data": { "db": "data/sql.db" }, "defaults": { "model": "deepseek/deepseek-v4-flash" }, "context": { "max": 8 } }
```

- 逐键优先级 **env > 配置文件 > 内置默认**（对应 `OAMP_DB` / `OAMP_OMP_MODEL` / `OAMP_CTX_MAX`）；相对路径基准 = 包根（与 cwd 无关）。
- 文件缺失 → 正常启动；JSON 非法或类型不符 → 启动即报错退出 1（快速失败）；未知键忽略；无热重载。
- 运行时产物落点：socket → `oamp/.runtime/`，对话库 → `oamp/data/`（均已 `.gitignore`）。
- **不进配置文件的环境变量**：web 的任务对账间隔（`OAMP_WEB_RECONCILE_*`，见上表）属运行期兜底参数，仅由 env 覆盖、非法值回退内置默认。
