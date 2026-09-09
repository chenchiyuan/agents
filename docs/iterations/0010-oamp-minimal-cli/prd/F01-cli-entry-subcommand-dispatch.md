# F01：CLI 入口与子命令分发

**功能 ID**: F01
**来源**: `demand.md` W1（D-2/D-3）、P-06、需求结论 §3「CLI 形态」；效果条款 E1/E2 的交付载体
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用户通过一个入口程序就能拉起 Router、拉起任意 agent 节点、查询拓扑状态——`oamp` 单一 CLI 把三类操作统一成同一可执行程序，测试与日常使用都只记一套命令。

## 验收标准

1. 仓库顶层存在 `oamp/` 独立目录，内含可执行 CLI 入口与 `npm test` 测试入口；`npm test` 基于 node:test 运行且全绿（E1 载体）。（node:test）
2. 运行时底座约束成立：CLI 在 Node.js v22 上运行；包清单声明零第三方运行时依赖（测试/开发依赖不影响运行时零依赖判定）（W1/D-3）。（命令核查）
3. 入口支持三个子命令形态：`oamp router start`、`oamp agent start <instance-id>`、`oamp status`，且能分发到各自行为（P-06）。（命令核查 / README 手测）
4. 未知/非法子命令 → 非零退出、打印可用子命令用法、不挂起（M-01，2026-09-09 user_confirmed）。（node:test）
5. `oamp agent start` 缺少必填参数 instance-id → 非零退出、报错明确指出缺失 instance_id、不挂起（P-06：本轮必填仅 instance_id）（M-01，2026-09-09 user_confirmed）。（node:test）
6. 无 YAML 配置面：运行所需参数经 CLI flag/env 提供，`oamp/` 内无 YAML 配置文件参与运行（P-06）。（命令/文件核查）
7. `oamp router start` / `oamp agent start <instance-id>` 为前台长驻进程：启动后进程保持存活不自行退出、不转入后台（N7 否定面）。（node:test / README 手测）
8. `oamp/` 交付物含 README，提供 E2 手测步骤（Router 终端 + agent 终端 + `oamp status` 查询），使"节点 online、心跳持续可见、kill 后 offline"可复现（E2 载体）。（文档核查 + 手测）

## 边界（不包含）

- 不含 Router 的注册表与 register/deregister 处理（F02）
- 不含 agent 节点的注册/心跳/注销协议行为（F03）
- 不含心跳租约与 offline 判定（F04）
- 不含 `oamp status` 的输出内容与查询语义（F05）
- 不含终端事件日志（F06）
- 不含消息投递闭环（F07）
- 不含 gitignore/凭据卫生（F08）
- 不做 Router/agent 的进程守护、自动重启、后台 daemonize（N7）
- 不做跨机传输/远程 Router 适配（N8）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §3.2/§7.1/D15/D16）

- **布局与入口（AR-01 → D1，architecture.md §3.2）**：`oamp/` ESM 工程（`package.json`：type=module、bin=`./bin/oamp.js`、`scripts.test="node --test test/*.test.js"`（glob 形态——Node v22.15 目录形态实测失败，glob 排除 helpers/，实现期已裁决）、零运行时依赖）；`bin/oamp.js`（shebang + chmod +x）仅转发给 `src/cli.js`；模块 = cli/config/rpc/registry/router/node-client/agent/status/log（见 architecture.md 文件树）。
- **子命令分发（AR-01 → D1，§7.1）**：手写 argv 解析（零依赖）。`router start` / `agent start <instance-id>` / `status` 三种形态；未知/非法子命令或 `agent start` 缺 instance-id → stderr 明确报错 + 用法、退出码 2、不挂起（M-01）；`-h/--help` → stdout 用法、退出 0。
- **前台长驻与信号处理（AR-01 → D16，§3.3 流程⑤）**：router/agent 均为前台长驻进程（不 daemonize，N7）；Router 就绪以 stdout `ROUTER_READY socket=…` 行为信号（自动化等待点）；SIGINT 优雅退出——agent 先发 deregister（best-effort ≤1s）再退出码 0，Router close 监听 + 关连接 + unlink socket 再退出码 0；二次 SIGINT 强退（130）。
- **README 组织（AR-01 → D15）**：快速开始（npm link 或 `node bin/oamp.js`）→ E2 手测三步（Router 终端 / agent 终端 / `oamp status`，含 kill 后等 timeout 见 offline）→ 参数表（env）→ 协议速览 → 卫生红线声明（F08-3）。
