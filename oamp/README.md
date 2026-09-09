# oamp — 本机多智能体运行时 CLI

零依赖 Node.js v22 ESM 命令行工具：单一入口拉起 Router、拉起 agent 节点、查询拓扑状态。
运行参数全部经环境变量提供（无 YAML 配置面）；节点与 Router 间为 UDS + JSON-RPC 2.0。

> **当前状态**：本仓库首个落地 PR 交付 CLI 分发骨架与卫生基线；Router/agent/status 的完整能力
> 随后续 PR 落地。本 PR 阶段执行 `router start` / `agent start <instance-id>` / `status`
> 会得到"模块尚未实现"的明确提示（预期行为，非故障）。

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

> 以下为完整 E2 复现步骤骨架：Router 终端 + agent 终端 + `oamp status` 查询，
> 使"节点 online、心跳持续可见、kill 后 offline"可复现。Router/agent 完整能力随后续 PR 落地，
> 届时按本步骤即可完整执行。

1. **终端 1（Router）**：`oamp router start` → 等待 stdout 出现就绪行 `ROUTER_READY socket=…`。
2. **终端 2（agent）**：`oamp agent start dev-1` → 注册成功打印 `REGISTERED`，随后周期心跳。
3. **终端 1（观察）**：可看到该节点的心跳/状态事件行（心跳日志按窗口节流）。
4. **终端 3（查询）**：`oamp status` → 对齐表格，`dev-1` 行 `state=online`。
5. **下线验证**：回到终端 2 按 Ctrl-C（SIGINT）→ 优雅注销 `DEREGISTERED`；或直接 kill agent 进程
   → 等约 `OAMP_HEARTBEAT_TIMEOUT_MS` 后 `oamp status` 中该节点 `state=offline`。

## 环境变量参数表

| env | 作用对象 | 默认 | 说明 |
|---|---|---|---|
| `OAMP_SOCKET` | 全部 | `<oamp 包根>/.runtime/router.sock` | Router UDS socket 路径（测试/并行手测用临时路径覆盖） |
| `OAMP_HEARTBEAT_INTERVAL_MS` | agent | `10000` | 心跳周期（毫秒）；正整数 |
| `OAMP_HEARTBEAT_TIMEOUT_MS` | Router | `30000` | 租约超时（毫秒）；正整数；建议 ≥ 2×interval |
| `OAMP_HB_LOG_WINDOW_MS` | Router | `60000` | 心跳日志节流窗口（毫秒）；正整数 |

数值类 env 一律要求正整数，非法值启动即报错退出（快速失败）。自动化测试将 interval 缩到
30–100ms、timeout 缩到 200–400ms、日志窗口缩到 ~300ms，使全链路秒级完成。

## 协议速览

- 传输：UDS 长连接，NDJSON 逐行帧（每行一个 JSON 对象），JSON-RPC 2.0 语义（请求/响应/通知）。
- socket 文件权限 0600（属主访问，无 token 鉴权机制）；默认落点 `oamp/.runtime/router.sock`。
- 方法面：`agent.register` / `agent.heartbeat`（通知）/ `agent.deregister` /
  `message.send` / `message.deliver` / `message.ack` / `router.status`。
- 详细协议契约（信封字段、错误码、时序）随后续 PR 代码与文档落地。

## 卫生红线声明

- **运行时产物不入 git**：socket 等运行时产物的唯一落点 `oamp/.runtime/` 已被 `.gitignore`
  忽略；测试用 socket 全部位于系统临时目录，永不落仓库。
- **代码与配置零凭据字段**：`oamp/` 代码与配置中不出现 token / api_key / secret / password /
  credential / authorization / private_key 等赋值形态字段；本工具无鉴权凭据概念
  （本地 UDS 属主访问），仓库保持可 clone、可共享。
