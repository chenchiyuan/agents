# pr-003：协议层落地（标准面 + 唯一注入点 + 三实现）与消费层接入（默认 rpc）

## 上下文摘要

把「怎么跟一个 agent 说话」收敛成一份被写定的标准面：新建 `oamp/src/protocol.js`（`ProtocolError` / `CAPABILITY_KEYS` / `createProtocolLayer()` 唯一注入点）、`oamp/src/rpc-client.js`（默认链路：帧 → 增量 / 门 / 终态 / 分片重组 / 取消）、`oamp/src/oneshot-client.js`（无会话语义）；`oamp/src/acp-client.js` 转为标准面的一个实现（argv 经 L1、能力位声明、统一 `onDelta` 外观，**行为零变更**）；`oamp/src/context-pool.js` 不再 import 具体实现、改收注入的会话工厂；`oamp/src/agent.js` 接线注入点 + `--protocol` flag + 一次性路径走 L2。**关键约束**：标准面实现模块与 `protocol.js` 互有 import（实现取 `ProtocolError`，注入点装配三实现），且 `onDelta` 是一条跨三文件的签名链（`acp-client.js:191/207` → `context-pool.js:150/186` → `agent.js:396`），故本 PR 是一个不可再拆的合并单元（证据见 `clarifications/2026-09-14-pr-planner-round1.md` §3）。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F12

## 文件范围

- `oamp/src/protocol.js`（**新建**：`ProtocolError`（码值逐字沿用既有 `AcpError.code` 五值：`context_crashed` / `model_unavailable` / `timeout` / `permission_denied` / `context_busy`）、`CAPABILITY_KEYS`（M6 六键原样）、`createProtocolLayer({resident, profiles, bin, cwd, logger})` ⇒ `capabilities()` / `createResident()` / `createEphemeral()`；**全仓唯一 import 三个实现模块的文件**；解析链 = 角色级 > `env.OAMP_PROTOCOL` > `config.json: protocol` > 内置 `'rpc'`，选择域 `{rpc, acp}`）
- `oamp/src/rpc-client.js`（**新建**：`--mode rpc` 的逐帧映射按 architecture §5.4；`ready` → `negotiate_protocol{protocolVersion:2}`；三类增量 `thinking_delta→thinking` / `text_delta→chunk` / `toolcall_delta→tool_call` + `tool_execution_update→tool_output`（空 delta 跳过）；终态 = `agent_end{isTerminal:true}`（`messages` 末条 assistant 取 `stop_reason` / `usage`）；门双重过滤 `method==='select' && title.startsWith('Allow tool: ')` + `readApprovalToolName` 复用；非门交互类回 `cancelled:true`、展示类不回执；`cancel()` = `{type:'abort'}` → 终态宽限 → kill（`CANCEL_GRACE_MS` / `KILL_GRACE_MS` 沿用量级）；`close()` = 关 stdin → 短宽限 → kill 且容忍晚到帧；`rpc_chunk` 重组；未知帧忽略不崩）
- `oamp/src/oneshot-client.js`（**新建**：一次性执行，**不持有跨轮状态**；承接 `oamp/src/agent.js` 现有 `-p` argv 语义与 stdout/stderr 行流回收 + `MAX_STREAM_LINES=200` 截断语义；不建立会话、无 `contextId`；能力位 `streaming:'degraded'` + 其余 `'no'` 且各带 `capabilityNotes`）
- `oamp/src/acp-client.js`（**修改**：① `start()` 的 argv 构造（检索式 `const args = ['acp'`、`spawn(this.bin`）改经 L1 profile；② 增 `capabilities` / `capabilityNotes`（`thinking:'no'`、`streaming/approvalGate/introspection:'yes'`）；③ `prompt()` 的 `onChunk`（检索式 `onChunk`）改为统一外观 `onDelta({kind,text})`；④ 错误类型改抛 `ProtocolError`。**严格不动**：`_chunkHandler` 只接受 `agent_message_chunk` 的分支（思考/工具增量在 acp 侧**仍不产生**）、两道门逻辑（`session/request_permission` + `elicitation/create`）、冻结计时逻辑）
- `oamp/src/context-pool.js`（**修改**：删 `import { AcpClient, AcpError } from './acp-client.js'`（`:7`）与 `new AcpClient({...})`（`:203`）⇒ 改为调用**注入的**会话工厂（含 `auditContext` 四键与 `onPermissionRequest` 的档位注入语义）；`prompt` 的 `onChunk`（`:150`、`:157`、`:186`）改 `onDelta`；`AcpError` 判定（`:151`、`:153`、`:168`、`:178`、`:191`、`:242`、`:251`、`:257`）改 `ProtocolError`。**严格不动**：键 `chatId::agentId`、`QUEUE_LIMIT=8`、同键 FIFO 串行、`_evictIfNeeded` LRU、`_failSession` 收尾分类、`sentTurns` 首轮名额语义、`contextId`/`pid`/`model` 审计面）
- `oamp/src/agent.js`（**修改**：① `new ContextPool({...})`（`:698`）改为注入协议层产物（bin/cwd/role/roleFile/tools/permission 由 L1 profile + L2 门面承载）；② `runOmpTask`（`:181`）瘦身为「取标准面的一次性实现 → `prompt` → 上报」，删除本处 `-p` argv 拼装（`:190-199`）；③ `AGENT_FLAGS`（`:589`）与 `parseAgentArgs`（`:592`）增 `--protocol`（取值域 `{rpc, acp}`，非法取值退 2，体例同现有 `--tools` / `--permission`）；④ `runDaemonTask`（`:372`）的 `onChunk`（`:396`）改 `onDelta` 并按 `kind` 原样上送。**严格不动**：`raiseConfirmation`（`:319`）、`readConfirmationOptions`（`:303`）、`settleConfirmation`、`cancelPending`、`handleNotice`、`runShellTask`（`:443`）、心跳两档与重连自愈）
- `oamp/test/web.test.js`（**修改**：① 用例 `Web：执行路径判定——默认 daemon / one_shot / ! shell` 的 `argvs.some((a) => a[0] === 'acp')`（`:561`）按 F02 验收 2 **改写**——默认协议已是 rpc，须以「默认 ⇒ 含 `--mode rpc`」落字，并以显式注入固定其余 acp 断言；② 该文件全部 agent 启动点（检索式 `OAMP_OMP_BIN`）在需要 acp 语义的用例里注入 `OAMP_PROTOCOL: 'acp'`；③ 用例 `Web：SSE 事件序列 + E-4`（`:596`）中 `updates.every((u) => u.data.kind === 'chunk')`（`:627`）的判据面随之明确）
- `oamp/test/confirmation-roundtrip.test.js`（**修改**：① T1 三处 `new ContextPool({...})`（`:319`、`:354`、`:386`）改按注入的会话工厂构造（该契约变更由本 PR 的 `context-pool.js` 触发）；② 跨进程用例注入 `OAMP_PROTOCOL: 'acp'`（检索式 `startFlaggedAgent`、`envExtra`）；③ 一次性 argv 断言（检索式 `-p`、`--approval-mode`）按 `omp:oneshot` profile 期望值）
- `oamp/test/tool-permission.test.js`（**修改**：① `startClient`（`:307`）驱动的 argv 断言（`:329`、`:338`、`:510`、`:516`、`:527`）按 `omp:acp` profile 期望值（B-13）；② 拒绝档错误断言（`:441`、`:493`、`:709`、`:857`）改按标准面错误契约（`ProtocolError`，`code` 五值不变；`AcpClient` 的名字/导出若保留则断言可不动））
- `oamp/test/protocol-layer.test.js`（**新建** = §9.4.2 **B-16**：能力位六键齐全 + 非 `yes` 必有非空 `capabilityNotes`；注入点解析链三档（角色级 / env / config）+ 默认 rpc 的 argv 观测（含 `--mode rpc`）；D-1「指定即生效」；RPC 帧 → 三类增量与终态映射（真实进程或帧级夹具）；未知帧忽略不崩）
- `oamp/test/zero-intrusion.test.js`（**新建** = §9.4.2 **B-17**，D-2 / D-3 的可执行证据：① 生产消费层（`src/context-pool.js` / `src/agent.js` / `src/web.js`）不 import、不构造任何具体协议实现模块；② 生产消费层不出现按协议取值（`'rpc'` / `'acp'` / `'oneshot'`）的分支；③ 切换协议只改注入配置时，生产消费层 `git diff` 为零（与基线快照比对））
- `oamp/README.md`（**修改** = §9.2 B-10：环境变量表补 `OAMP_PROTOCOL`；「配置面」由三键改四键；角色实例启动示例补 `--protocol`；常驻路径表述由「`omp acp` 进程」改为「默认 `omp --mode rpc`，可切回 acp」）

**零改动（防夹带；越界即 F10 / F11 验收不通过）**：`oamp/src/web.js`（`task.update` 分支原样透传新 kind，`:1626-1632`）、`oamp/src/router.js`、`oamp/src/rpc.js`（oamp 内部 UDS 协议，与本迭代的 rpc 无关）、`oamp/src/persist.js`、`oamp/src/transport.js`、`oamp/src/inbox.js`、`oamp/src/node-client.js`、`oamp/src/task.js`、`oamp/src/status.js`、`oamp/src/cluster.js`、`oamp/src/cluster-config.js`、`oamp/src/role-binding.js`、`oamp/bin/**`、`oamp/web/index.html`、`oamp/web/notify.js`、`oamp/API.md`、`oamp/llms.txt`、`oamp/package.json`、`omp/**`、`oamp/test/helpers/**`、`oamp/test/acp-daemon.test.js` / `context-pool.test.js` / `project-workspace.test.js` / `call-protocol.test.js`（这 4 个文件归 pr-002）。

## 验收标准

- [ ] **D-2 机械可核**（§3.3 判据 1/2）：`grep -rn "acp-client\|rpc-client\|oneshot-client" oamp/src` 的命中集合 ⊆ `{oamp/src/protocol.js}`；`grep -rn "'rpc'\|'acp'\|'oneshot'" oamp/src/{agent.js,context-pool.js,web.js}` 零命中。
- [ ] **D-3 机械可核**（F03 验收 3）：把注入配置从 rpc 改为 acp（三档任一：角色级 `--protocol acp` / `OAMP_PROTOCOL=acp` / `config.json: protocol`）→ 生产消费层（`oamp/src/context-pool.js`、`oamp/src/agent.js`、`oamp/src/web.js`）`git diff` 为空。
- [ ] **D-1 指定即生效**（F03 验收 1）：指定 `acp` 起一轮 → 被启动子进程 argv 首段 = `acp`（子命令）；不做指定（默认）→ argv 含 `['--mode','rpc']`；**两者都不回落到另一实现**（argv 可观测，§5.3）。
- [ ] **默认走 rpc**（F02 验收 2）：无任何协议指定时，常驻路径 spawn 的 argv 含 `--mode rpc`。
- [ ] **选择域封闭**（F02 验收 3/4）：注入点可选值域恰 `{rpc, acp}`（`oneshot` 由「一次性」语义选中，不在其中）；控制台与接口面无协议切换入口、无 per-chat / per-request 协议参数、无动态切换（N3）。
- [ ] **可切回 acp 且不迁移在飞上下文**（F02 验收 5 / N9）：切到 acp 后该轮确实走 acp，既有会话不被续接，界面出现既有「上下文已重置」提示语义。
- [ ] **三类增量在管道面被承接**（F04 验收 1/2，判定面 = agent ↔ omp 之间流动的数据，不看浏览器）：一轮带思考与工具调用的对话里 `thinking` / `tool_call` / `tool_output` 三类**逐类可数**；受理回包（`response{command:'prompt',success:true}`）**不被判为轮次结束**，终态只认 `agent_end{isTerminal:true}`；`agent_end{isTerminal:false}` 不结算、继续等（N-5）。
- [ ] **取消与关闭语义**（D-R2 / L2-8 / L2-10）：`cancel()` 发无参 `{type:'abort'}`（幂等）→ 终态宽限 → 超宽限 kill；`close()` = 关 stdin → 短宽限 → kill，并容忍 EOF 后晚到帧。
- [ ] **门承接④条**（F05 验收 1~4）：一次受门禁调用 → 收件箱**恰一条** 7 字段信封（`confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at`），`options` 恒二元 `Approve` / `Deny`；`tool` 名由既有原语 `readApprovalToolName(title)` 提取（多行 `title` 不影响）；裁决后条目消失、该轮推进或中止；门未裁决期间轮次挂起且**不计入轮次超时**（L2-9）。
- [ ] **非门反向请求处置**（L2-6 / N-3）：非门交互类回 `{cancelled:true}`；纯展示类（`setWidget` 等）**不回执**；未知帧类型忽略不崩（D-R7）。
- [ ] **acp 不退化、不补能力**（F06 验收 1/2/3）：注入 acp 跑一轮 → 确认收件箱 7 字段语义、三事件通知（`chat_completed` / `chat_failed` / `confirmation_required`）、消息与状态流转与 0021 一致；acp 能力位 `thinking:'no'` 显式声明且 acp 链路**不产生** thinking / tool 增量（`_chunkHandler` 逐字未动）；指定回 acp 确实生效（与 D-1 同法复核）。
- [ ] **oneshot 无会话语义**（F07 验收 1/2/3）：`one_shot` 轮次走 `omp -p`（argv = `omp:oneshot` profile 期望值，`--no-tools`（工具关时）/ `--append-system-prompt`（有角色时）/ `--approval-mode yolo` 与既有逐字一致）；前后两轮**无上下文续接**；能力位 `streaming:'degraded'` + 其余 `'no'` 各带 note；`!` shell 路径**不进** L2（`oamp/src/protocol.js` 与 `oamp/src/oneshot-client.js` 内不含 shell 执行器，`oamp/src/agent.js` 的 `runShellTask` 逐字不变）。
- [ ] **一次性路径的既有可见面零回归**：`stdout` / `stderr` 两条行流的 `kind` 与 `line` 形状、`MAX_STREAM_LINES=200` 截断事件、超时三拍语义与今天一致（判据：`oamp/test/omp-executor.test.js` 与 pr-002 固定后的 `oamp/test/context-pool.test.js` 全绿，且 `oamp/src/web.js:1628` 的 `stdout` 累积分支仍被触发）。
- [ ] **能力位声明面**（F09 验收 1/2/3/4）：三实现各自 `capabilities`（六键齐全、取值 ∈ `{yes,no,degraded}`）与 `capabilityNotes`（非 `yes` 必有非空理由）成立；缺能力在**实现内**降级、消费层零能力分支；`queueControl` 仅声明、无插话产品功能面。
- [ ] **过程增量不入库、记录条数不变**（F08 验收 3）：一轮结束后存储中恰 `in` / `out` 两条；过程增量只经 `transport.publish`，不触碰 `persist`。
- [ ] **两条 D-2/D-3 的可执行证据测试全绿**：`node --test oamp/test/protocol-layer.test.js oamp/test/zero-intrusion.test.js`。
- [ ] **全库测试面全绿**：`node --test oamp/test/*.test.js`（含本 PR 修的 3 个文件与 pr-002 固定后的 4 个文件）；`oamp/test/hygiene.test.js` 的零依赖断言保持绿（F12 承载）。
- [ ] **服务边界与上游零改动**（F10 / F11 承载）：`git diff --stat` 不含 `oamp/src/web.js` 的监听 / 鉴权面、不含 `oamp/API.md` / `oamp/llms.txt`（配置面不是 HTTP 接口面，不触发 0016/0021 文档漂移锁）、不含 `omp/**`；本迭代消费的 rpc 能力全部可回指既有实测（M-1~M-5，无「需 omp 新增字段」前置项）。
- [ ] **README 与实现一致**（B-10）：环境变量表含 `OAMP_PROTOCOL` 行；配置面说明为四键；角色实例启动示例含 `--protocol`；常驻路径不再表述为「总是 `omp acp`」。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§3.2 组件图（L1→R/AC/OS、L2→三实现）、§3.3 三层落点与三条机械判据、§3.4 四条数据流、§4.1 L1-1 / L1-2（均已用户确认）、§4.2 L2-1~L2-13、§5.1 L2 标准面签名、§5.2 profile、§5.3 注入点与解析链、§5.4 RPC 帧映射表、§5.5 增量帧面、§5.6 门映射、§5.7 能力位表、§6 F01~F13、§7 T-04 / T-05 / T-06 / T-07 / T-08 / T-09 / T-10 / T-11、§9.1 B-2~B-4、§9.2 B-6 / B-7 / B-8 / B-10、§9.3 零改动清单、§9.4.2 B-16 / B-17、§11 N-1~N-6、§12.1 MI-A-1~7）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F01-agent-launcher-and-profile.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F02-protocol-layer-and-injection-entry.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F03-zero-intrusion-contract.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F04-rpc-adapter-stream-mapping.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F05-approval-gate-cross-protocol-mapping.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F06-acp-adapter-preserved.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F07-oneshot-adapter.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F08-process-visibility-runtime-stream.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F09-capability-declaration.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F10-service-boundary-unchanged.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F11-upstream-protocol-unchanged.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F12-zero-third-party-dependency.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/probes/m1-output.txt（1 进程 = 1 会话 = 1 在飞轮次 / 并发 prompt 被拒）、`m2-output.txt`（abort 无参幂等 / 无协议级超时）、`m2b-output.txt`（三类增量与终态载荷）、`m5-output.txt`（恒一道门 / `title` 同源）
- prs/pr-001-launcher-and-protocol-config.md（L1 profile 表与 argv 构造）、prs/pr-002-test-face-profile-pinning.md（这 4 个文件的 acp 固定）
- 既有代码基线（本 PR 的改动锚点）：`oamp/src/context-pool.js:7`、`:150-191`、`:203-249`；`oamp/src/acp-client.js:136-145`、`:191`、`:198-207`、`:434-575`；`oamp/src/agent.js:181-280`、`:303-337`、`:372-440`、`:589-624`、`:698-712`；`oamp/src/web.js:1626-1632`

## depends_on

- `pr-001-launcher-and-protocol-config.md`（理由：三个实现模块的启动面 = pr-001 新建的 `oamp/src/launcher.js`（`PROFILES` + 唯一 argv 构造 + spawn），证据 = architecture §3.3「`rpc-client.js` 的 import 只有 `node:*` / `protocol.js` / `launcher.js`」与 §3.2 组件图 `L1 --> R/AC/OS`；解析链第 2/3 层取值 = pr-001 的 `oamp/src/config.js` 的 `protocol` 键）
- `pr-002-test-face-profile-pinning.md`（理由：4 个 harness 测试文件的 fake omp 桩只实现 ACP JSON-RPC（`oamp/test/acp-daemon.test.js` 的 `FAKE_ACP_SOURCE` 按 `msg.method === 'initialize' / 'session/new' / 'session/prompt'` 分支），本 PR 把默认协议切成 rpc 后若不先在这 4 个文件里显式固定 `OAMP_PROTOCOL='acp'`，它们会被以 `--mode rpc` 启动且桩永不回包 ⇒ 整组用例失败）

## batch

3
