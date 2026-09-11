# PR-002：协议运行核（RPC/注册表/事件日志/Router/NodeClient/agent）

## 上下文摘要

本 PR 交付除 `status.js` 外的全部运行时代码：src/rpc.js（UDS 连接 + NDJSON 分帧 + JSON-RPC 2.0 Peer，§4.1~4.3）、src/registry.js（注册表 Map + 连接身份反查 + 投递等待集 + 租约扫描纯逻辑，§5.2/§5.5/§5.6）、src/log.js（事件行格式化 + 心跳节流，§8，D9）、src/router.js（Router 进程：监听/全方法分发/租约扫描/SIGINT 清理，§5）、src/node-client.js（通用 NodeClient：register/heartbeat/deregister/send/ack + deliver 自动受理钩子，§6.1/D12）、src/agent.js（`oamp agent start` 生命周期编排 + SIGINT deregister 时序，§6.2/6.3）+ test/helpers/harness.js（临时 socket + 缩短 env + 子进程拉起，§10.2）。随附三张测试卡覆盖 F02/F03/F04/F06 的进程级与事件级验收（router-registry / agent-heartbeat / event-log）。**边界说明**：按"PR 间文件范围零重叠 + src 文件首次创建即须完整"约束，router.js/registry.js/node-client.js/log.js 中与消息域（send/deliver/ack、pendingDeliveries、MSG_* 事件、onDeliver 默认自动受理）共栖的实现代码随本 PR 一并完整落盘（§4.4 方法面、§5.5、§6.1/6.4 定义在同一个文件上，无法文件级拆分）；消息域的**可执行验收**（F07）由 pr-004 的契约测试承担。

## 涉及功能点

- F02（router-registry.test.js：注册字段/2 节点并发/同 id 替换唯一/offline 重注册/deregister 删除/socket 0600 stat/SIGINT 干净退出）
- F03（agent-heartbeat.test.js：真实 agent 子进程注册/心跳更新/SIGINT deregister 退出 0/双 agent 并发）
- F04（agent-heartbeat.test.js：kill→超时→offline 自动判定/正常心跳不误判；判定以 Router 侧 AGENT_OFFLINE 事件行为可测锚点，architecture.md §5.6/§8.1）
- F06（event-log.test.js：Router/agent 事件行可见、心跳节流 ≤⌈T/W⌉+1、节流不吞状态事件）
- F07（实现侧共栖，随本 PR 落盘：router.js message.* 分发、registry.js pendingDeliveries、node-client.js send/ack/自动受理、log.js MESSAGE_* 事件——§4.4/§5.5/§6.1/§6.4 定义在同一批文件上；可执行验收载体 = pr-004 契约测试）

## 文件范围

- oamp/src/rpc.js
- oamp/src/registry.js
- oamp/src/log.js
- oamp/src/router.js
- oamp/src/node-client.js
- oamp/src/agent.js
- oamp/test/helpers/harness.js
- oamp/test/router-registry.test.js
- oamp/test/agent-heartbeat.test.js
- oamp/test/event-log.test.js

## 验收标准

- [ ] `oamp/` 下 `npm test`（或 `node --test test/*.test.js`）全绿，且 router-registry.test.js / agent-heartbeat.test.js / event-log.test.js 三个文件在缩短 env（interval 30~100ms / timeout 200~400ms / 窗口 ~300ms，§7.2）下通过：注册成功字段、双节点并发各自心跳、同 id live 冲突替换后仅一个 live session（D4）、offline 条目同 id 重注册复活、deregister 后不再 online、socket 文件权限位 stat 为 0600（§5.1）、Router SIGINT 干净退出 0（D16）
- [ ] 真实 CLI agent 子进程（`node bin/oamp.js agent start <id>` + 缩短 env）注册成功、last_heartbeat 随周期心跳推进、SIGINT 后先 deregister 再退出码 0、两个不同 instance_id 子进程同时存活互不影响（F03-1~4）
- [ ] 强杀 agent 子进程（无 deregister）后，Router 在 timeout+sweep 上界内自动判 offline 并输出 AGENT_OFFLINE 事件行；正常周期心跳期间不误判 offline（F04-2/4；事件行锚点 architecture.md §5.6/§8.1）
- [ ] Router/agent 终端事件行格式符合 `[<UTC ISO-8601>] <role> <TOKEN> <key=value …>`（§8.1）；观察窗口 T 内单节点 HEARTBEAT 行数 ≤ ⌈T/W⌉+1（M-03 判据数值化），状态变迁事件（AGENT_REGISTERED/AGENT_OFFLINE 等）不被节流吞掉（F06-1~4）

## 参考资料

- docs/iterations/0010-oamp-minimal-cli/prd/F02-router-start-registry.md
- docs/iterations/0010-oamp-minimal-cli/prd/F03-agent-daemon-node-client.md
- docs/iterations/0010-oamp-minimal-cli/prd/F04-heartbeat-lease-offline.md
- docs/iterations/0010-oamp-minimal-cli/prd/F06-terminal-event-log.md
- docs/iterations/0010-oamp-minimal-cli/architecture.md §3.2/§4/§5/§6/§8/§10.2，D2~D7/D9/D12/D13/D16/D17

## depends_on

- pr-001-project-skeleton-cli-hygiene.md（理由：
  ① router.js/agent.js 消费 pr-001 的 src/config.js——§7.2 配置面定义 Router 侧 OAMP_SOCKET/OAMP_HEARTBEAT_TIMEOUT_MS/OAMP_HB_LOG_WINDOW_MS 与 agent 侧 OAMP_HEARTBEAT_INTERVAL_MS 的默认值/读取/数值校验集中在该叶子模块，模块引用证据 = brief 与 §3.1/§3.3 数据流"config 被 router/agent/status 消费"；
  ② 本 PR 全部进程级测试经 harness 以子进程 `node bin/oamp.js …` 拉起（§3.2 可执行入口形态 + §10.2 harness 职责），bin/oamp.js（转发）+ src/cli.js（`router start`/`agent start` 分发分支，§7.1）属 pr-001——cli.js 分发分支对 './router.js'/'./agent.js' 的延迟模块引用即本 PR 模块被 pr-001 代码消费的反向证据，本 PR 无 pr-001 则子进程入口不存在；
  ③ package.json（pr-001）的 scripts.test=`node --test test/*.test.js` 是 §10.2 node:test 用例组织与 F01-1 npm test 载体的运行入口）

## batch

2
