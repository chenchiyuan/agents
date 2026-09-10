# oamp — 本机多智能体运行时 CLI

零依赖 Node.js v22 ESM 命令行工具：单一入口拉起 Router、拉起 agent 节点、查询拓扑状态。
运行参数全部经环境变量提供（无 YAML 配置面）；节点与 Router 间为 UDS + JSON-RPC 2.0。

> **当前状态**：CLI 分发、Router/agent 运行时、`status` 只读查询与 **`task` 任务指派/进度查询**均已落地可用——
> `oamp router start`、`oamp agent start <instance-id>`、`oamp status`、
> `oamp task send/status/list/watch` 端到端可执行（复现步骤见下方 E2 手测与任务演示）。

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

- **运行时产物不入 git**：socket 等运行时产物的唯一落点 `oamp/.runtime/` 已被 `.gitignore`
  忽略；测试用 socket 全部位于系统临时目录，永不落仓库。
- **代码与配置零凭据字段**：`oamp/` 代码与配置中不出现 token / api_key / secret / password /
  credential / authorization / private_key 等赋值形态字段；本工具无鉴权凭据概念
  （本地 UDS 属主访问），仓库保持可 clone、可共享。

## Web 控制台（demo）

```sh
oamp web start [--port 7788]      # 默认 http://127.0.0.1:7788（env OAMP_WEB_PORT 可覆盖）
```

浏览器打开后：
- **左栏**：对话列表（按 TODAY/OLDER 分组，条目标题 + 状态徽标 + @agent + 时间；All/Working/Completed 过滤）
- **右栏**：对话详情——你的消息与 agent 执行块（状态徽标 / 耗时 / 命令 / 输出明细（stderr 标红）/ exit_code 结果行；输出超 8 行折叠可展开）
- **输入框**：`@agent 命令` —— 输入 `@` 弹出全部 agent 列表（↑↓ 选择、Enter 补全）；Enter 发送、Shift+Enter 换行

**消息即命令（demo 语义）**：消息文本去掉 `@agent` 前缀后以 `/bin/sh -c` 在目标 agent 上执行，输出经任务明细回流到对话。
Web 服务以 `web` 身份常驻连接 Router（心跳保活）；浏览器不直连 UDS。会话与消息存于 Router 内存（重启即清空）。
安全边界：监听 127.0.0.1，无鉴权；命令由输入文本决定（迭代 0010 N6 边界）。
