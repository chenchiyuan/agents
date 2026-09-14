# pr-003：消费层切到标准面（acp 实现对齐 + 默认 rpc）

> **本轮（阶段 4 第 2 轮）重划说明**：协议层本体（`oamp/src/protocol.js` / `rpc-client.js` / `oneshot-client.js` + 其自证用例）已移出，归新增的 `prs/pr-005-protocol-layer-and-injection-entry.md`（加性子集：零消费方、行为零变更）。本 PR 保留原编号，只做**一件可描述的事**：把消费层（及其唯一实现 acp）切到标准面，并让常驻链路默认走 rpc。文件名保持不变以稳定既有引用（`status.md` / `clarifications/verify-stage4-gate-20260914.md`）。

## 上下文摘要

消费层的**一次性切换**：`oamp/src/acp-client.js` 对齐标准面（能力位声明 + 统一 `onDelta` 外观 + `ProtocolError`），`oamp/src/context-pool.js` 不再 import 具体实现、改消费注入的会话工厂，`oamp/src/agent.js` 接线唯一注入点（`createProtocolLayer()`，pr-005 交付）+ 一次性路径改走 L2 实现 + 新增 `--protocol` flag。**关键约束（决定本 PR 不能再拆）**：acp 的外观改名与错误类型变更会**立刻**打破其唯一消费方——`oamp/src/context-pool.js:186` 透传 `onChunk`、`:151`/`:153`/`:168`/`:178`/`:191`/`:242`/`:251`/`:257` 引用 `AcpError`（**其中 `instanceof` 判定仅 `:191` / `:251`**，其余 6 处为 `new AcpError(...)` 构造 / 抛出），且 `oamp/test/tool-permission.test.js:12` 直引 `AcpClient`、`:441` 断言 `err.name === 'AcpError'`——三者必须同批。

## 涉及功能点

- F01
- F02
- F03
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F12

## 文件范围

- `oamp/src/acp-client.js`（**修改**：① `start()` 的 argv 构造（检索式 `const args = ['acp'`，现状 `:137`）改经 L1 的 `omp:acp` profile（`buildArgv` / `PROFILES` 由 pr-001 交付），逐字复现现状 argv；② 增 `capabilities` / `capabilityNotes`（§5.7 表：`thinking:'no'`、`streaming` / `approvalGate` / `introspection` = `'yes'`、`hostTools` / `queueControl` = `'no'`，非 yes 键带 note）；③ `prompt()` 的 `onChunk`（`:191` 形参 / `:207` 调用 `onChunk(content.text)`）改为统一外观 `onDelta({kind:'chunk', text})`；④ 抛 `ProtocolError`（删本地 `AcpError` 类 `:42-48`，码值五值逐字不变；**文件内其余 `AcpError` 引用一并改类型**——`instanceof` 判定在 `:174` / `:321`，构造 / 抛出在 `:169` / `:175` / `:176` / `:192` / `:193` / `:226` / `:230` / `:298` / `:305` / `:328` / `:366` / `:674`），并把本地门名解析原语（`:30-34`）改为引用 `oamp/src/protocol.js` 的同源实现（pr-005 已自持，本处只删重复）；⑤ **构造入参集合不变**（10 键：`{bin, model, cwd, tools, roleFile, permission, auditContext, logger, onExit, onPermissionRequest}`——`oamp/src/context-pool.js:203-226` 实测 10 键，含 `auditContext` 四键（`:211-218`）与 `onExit`（`:220`）；该集合由 pr-005 的 `protocol.js` 注入工厂装配面一次性写定，本 PR 不改构造签名，变更会造成文件范围重叠）。**严格不动**：`_chunkHandler` 只接受 `agent_message_chunk` 的分支（检索式 `agent_message_chunk`，`:201-203`；思考 / 工具增量在 acp 侧**仍不产生**）、两道门逻辑（`session/request_permission` + `elicitation/create`，`:434-575`）、冻结计时 / `_pausedTurns`、`_waitQuiescence`、`CANCEL_GRACE_MS` / `KILL_GRACE_MS` / `INIT_*` 常量）
- `oamp/src/context-pool.js`（**修改**：删 `import { AcpClient, AcpError } from './acp-client.js'`（`:7`）与 `new AcpClient({...})`（`:203`）⇒ 改为调用**注入的**会话工厂（本 PR 经调用面提供 `auditContext` 四键的取值来源——会话身份三键 + 惰性 `context_id` getter，`:211-218`——与 `onExit` 回调实体（空闲崩溃收尾 `_onClientExit`，`:239-243`），装配落点见 pr-005 的注入工厂的 10 键集合；`onPermissionRequest` 的档位注入语义（仅 `allow` 档注入 + 附加会话身份后透传，`:223-226`）由本 PR 承载）；`prompt` 的 `onChunk`（`:150` / `:157` / `:186`）改 `onDelta`；`AcpError` 引用 8 处（`:151`、`:153`、`:168`、`:178`、`:191`、`:242`、`:251`、`:257`；**其中 `instanceof` 判定仅 `:191` / `:251`**，其余 6 处为 `new AcpError(...)` 构造 / 抛出）改 `ProtocolError`。**严格不动**：键 `chatId::agentId`、`QUEUE_LIMIT=8`、同键 FIFO 串行、`_evictIfNeeded` LRU、`_failSession` 收尾分类、`sentTurns` 首轮名额语义、`contextId` / `pid` / `model` 审计面）
- `oamp/src/agent.js`（**修改**：① `new ContextPool({...})`（`:698`）改为注入 `createProtocolLayer(...)`（pr-005）的产物，bin / cwd / role / roleFile / tools / permission 由 L1 profile + L2 门面承载；② `runOmpTask`（`:181-280`）瘦身为「取标准面的一次性实现 → `prompt` → 上报」，删除本处 `-p` argv 拼装（`:190-199`）与进程 / 超时 / 行流回收（由 pr-005 的 `oneshot-client.js` 承接，行流 `kind` 保持既有 `stdout` / `stderr` + `line`）；③ `AGENT_FLAGS`（`:589`）与 `parseAgentArgs`（`:592`）增 `--protocol`（取值域 `{rpc, acp}`，非法取值退 2，体例同既有 `--tools` / `--permission`）；④ `runDaemonTask`（`:372`）的 `onChunk`（`:396`）改 `onDelta` 并按 `kind` 原样上送。**严格不动**：`raiseConfirmation`（`:319`）、`readConfirmationOptions`（`:303`）、`settleConfirmation`、`cancelPending`、`handleNotice`、`runShellTask`（`:443`）、心跳两档与重连自愈）
- `oamp/test/web.test.js`（**修改**：① 用例 `Web：执行路径判定——默认 daemon / one_shot / ! shell` 的 `argvs.some((a) => a[0] === 'acp')`（`:557`，注释「默认路径应起 acp 常驻进程」）按 F02 验收 2 **语义反转**——默认协议已是 rpc，须以「默认 ⇒ 含 `['--mode','rpc']`」落字；② 需要 acp 语义的用例（`:573` 的 `argvs.find((a) => a[0] === 'acp')`）显式注入 `OAMP_PROTOCOL: 'acp'`（B-14 落字取「显式注入 + 按 profile 断言」，不扩写 fake 桩）；③ 用例 `Web：SSE 事件序列 + E-4` 中 `updates.every((u) => u.data.kind === 'chunk')`（`:627`）的判据面随之明确）
- `oamp/test/confirmation-roundtrip.test.js`（**修改**：① T1 三处 `new ContextPool({...})`（`:319`、`:354`、`:386`）改按注入的会话工厂构造（该契约变更由本 PR 的 `context-pool.js` 触发；该文件 `:20` 直引 `ContextPool`）；② 跨进程用例注入 `OAMP_PROTOCOL: 'acp'`（检索式 `startFlaggedAgent`（`:202`）、`envExtra`（`:263`））；③ 一次性 argv 断言（`:708-711` 的 `--approval-mode yolo`）按 `omp:oneshot` profile 期望值）
- `oamp/test/tool-permission.test.js`（**修改**：① `startClient`（`:307`）驱动的 argv 断言（`:329`、`:338`、`:510`、`:516`、`:527`）按 `omp:acp` profile 期望值（B-13）；② 拒绝档错误断言（`:441` 的 `err.name === 'AcpError'`，另 `:493`、`:709`、`:857`）改按标准面错误契约（`ProtocolError`，`code` 五值不变）；③ **新增 acp 实现的会话标准面外观断言**（能力位六键齐全 + 非 `yes` 必有非空 `capabilityNotes` + `prompt` 增量经 `onDelta({kind:'chunk', text})` 到达 = §9.4.2 **B-16 的 acp 侧**；本文件 `:12` 直引 `AcpClient`，是 acp 单实现的最短判定面）
- `oamp/test/zero-intrusion.test.js`（**新建** = §9.4.2 **B-17**，D-2 / D-3 的可执行证据：① 生产消费层（`oamp/src/context-pool.js` / `oamp/src/agent.js` / `oamp/src/web.js`）不 import、不构造任何具体协议实现模块；② 生产消费层不出现按协议取值（`'rpc'` / `'acp'` / `'oneshot'`）的分支；③ 切换协议只改注入配置时，生产消费层 `git diff` 为零（与基线快照比对））
- `oamp/README.md`（**修改** = §9.2 B-10：环境变量表补 `OAMP_PROTOCOL`；「配置面」由三键改四键；角色实例启动示例补 `--protocol`；常驻路径表述由「`omp acp` 进程」改为「默认 `omp --mode rpc`，可切回 acp」）

**零改动（防夹带；越界即 F10 / F11 验收不通过）**：`oamp/src/protocol.js` / `oamp/src/rpc-client.js` / `oamp/src/oneshot-client.js` / `oamp/test/protocol-layer.test.js`（**归 pr-005**）、`oamp/src/launcher.js` / `oamp/src/config.js`（pr-001）、`oamp/web/app.js` / `oamp/web/style.css` / `oamp/web/index.html` / `oamp/web/notify.js`（pr-004）、`oamp/src/web.js`（`task.update` 分支原样透传新 kind，`:1626-1632`）、`oamp/src/router.js`、`oamp/src/rpc.js`（oamp 内部 UDS 协议，与本迭代的 rpc 无关）、`oamp/src/persist.js`、`oamp/src/transport.js`、`oamp/src/inbox.js`、`oamp/src/node-client.js`、`oamp/src/task.js`、`oamp/src/status.js`、`oamp/src/cluster.js`、`oamp/src/cluster-config.js`、`oamp/src/role-binding.js`、`oamp/bin/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/package.json`、`omp/**`、`oamp/test/helpers/**`、`oamp/test/acp-daemon.test.js` / `context-pool.test.js` / `project-workspace.test.js` / **`call-protocol.test.js`**（这 4 个文件归 pr-002；含第 4 个——该文件桩亦为 ACP-only，见下方「测试面口径登记」）、本 PR 未列的其他既有测试文件

**测试面口径登记（D-1；不改 `architecture.md` 本体）**：`architecture.md` §9.4.1 的「既有测试面 · 最小更新」列 6 个文件，**实测应为 7 个**——测试面 ACP-only 桩文件的全体 = `acp-daemon` / `call-protocol` / `confirmation-roundtrip` / `context-pool` / `project-workspace` / `tool-permission` / `web`（`FAKE_ACP_SOURCE` + `msg.method` 桩分布实测）。其中 `call-protocol.test.js` **属测试面**（归 pr-002 固定），本 PR 对其零改动；`tool-permission` / `confirmation-roundtrip` / `web` 三个因随实现改造而变（直引 `AcpClient` / `ContextPool` / 默认路径断言），归本 PR 处置。`architecture.md` §9.4.1 的清单回填由主 agent 另行处置（本 PR 只登记正确口径）。

## 验收标准

- [ ] **D-2 机械可核**（§3.3 判据 1/2）：`grep -rn "acp-client\|rpc-client\|oneshot-client" oamp/src` 的命中集合 = `{oamp/src/protocol.js}`（本 PR 落地后 `oamp/src/context-pool.js:7` 的既有命中消失，且不得出现对 `rpc-client` / `oneshot-client` 的任何命中）；`grep -rn "'rpc'\|'acp'\|'oneshot'" oamp/src/{agent.js,context-pool.js,web.js}` 零命中。
- [ ] **D-3 机械可核**（F03 验收 3）：把注入配置从 rpc 改为 acp（三档任一：角色级 `--protocol acp` / `OAMP_PROTOCOL=acp` / `config.json: protocol`）→ 生产消费层（`oamp/src/context-pool.js`、`oamp/src/agent.js`、`oamp/src/web.js`）`git diff` 为空。
- [ ] **D-1 指定即生效**（F03 验收 1 / F02 验收 1）：指定 `acp` 起一轮 → 被启动子进程 argv 首段 = `acp`（子命令）；不做指定（默认）→ argv 含 `['--mode','rpc']`；**两者都不回落到另一实现**（argv 可观测，§5.3）。本 PR 的可判定性**不依赖** pr-005 的 `protocol-layer.test.js`：观测面是运行时被启动子进程的 argv。
- [ ] **默认走 rpc + 选择域封闭 + 可切回**（F02 验收 2/3/4/5）：无任何协议指定时，常驻路径 spawn 的 argv 含 `--mode rpc`；注入点可选值域恰 `{rpc, acp}`（`oneshot` 由「一次性」语义选中）；控制台与接口面无协议切换入口、无 per-chat / per-request 协议参数、无动态切换（N3）；切到 acp 后该轮确实走 acp、既有会话不被续接、界面出现既有「上下文已重置」提示语义（N9）。
- [ ] **acp 标准面外观**（F09 验收 1/3 的 acp 侧 / B-16 acp 部分）：`new AcpClient({...})` 实例的 `capabilities` 六键齐全、取值 ∈ `{yes, no, degraded}`、非 `yes` 键的 `capabilityNotes` 非空；`prompt` 的文本增量经 `onDelta({kind:'chunk', text})` 到达；错误面 `ProtocolError`（`code` 五值逐字不变）。
- [ ] **acp 不退化、不补能力**（F06 验收 1/2/3）：注入 acp 跑一轮 → 确认收件箱 7 字段语义、三事件通知（`chat_completed` / `chat_failed` / `confirmation_required`）、消息与状态流转与 0021 一致；acp 能力位 `thinking:'no'` 显式声明且 acp 链路**不产生** thinking / tool 增量（`_chunkHandler` 逐字未动）；指定回 acp 确实生效（与 D-1 同法复核）。
- [ ] **门承接（消费层侧）**（F05 验收 1~4）：一次受门禁调用（acp 与 rpc 各跑一次）→ 收件箱**恰一条** 7 字段信封（`confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at`），`options` 恒二元 `Approve` / `Deny`；`tool` 名由既有原语提取（多行 `title` 不影响）；裁决后条目消失、该轮推进或中止；门未裁决期间轮次挂起且**不计入轮次超时**（L2-9）。
- [ ] **非门反向请求处置（经消费层的观察面）**（L2-6 / N-3）：非门交互类回 `{cancelled:true}`、纯展示类（`setWidget` 等）不回执、未知帧类型忽略不崩（D-R7，实现归属见 pr-005；本 PR 判「经消费层可见的行为」面）。
- [ ] **一次性路径迁移后既有可见面零回归**（F07 / 主 agent 裁定 1）：`stdout` / `stderr` 两条行流的 `kind` 与 `line` 形状、`MAX_STREAM_LINES=200` 截断事件、超时三拍语义与今天一致（判据：`oamp/test/omp-executor.test.js` 与 pr-002 固定后的 `oamp/test/context-pool.test.js` 全绿，且 `oamp/src/web.js:1628` 的 `stdout` 累积分支仍被触发）；`one_shot` 轮次 argv = `omp:oneshot` profile 期望值（`-p` 末位位置参数、`--no-tools`（工具关时）、`--append-system-prompt`（有角色时）、`--approval-mode yolo`，与既有逐字一致）；前后两轮**无上下文续接**；`!` shell 路径**不进** L2（`oamp/src/agent.js` 的 `runShellTask` 逐字不变）。
- [ ] **三类增量在管道面被承接**（F04 验收 1/2 的消费侧、F08 验收 1/2）：一轮带思考与工具调用的对话里 `thinking` / `tool_call` / `tool_output` 三类**逐类可数**；受理回包（`response{command:'prompt',success:true}`）**不被判为轮次结束**，终态只认 `agent_end{isTerminal:true}`；`agent_end{isTerminal:false}` 不结算、继续等（N-5）。
- [ ] **过程增量不入库、记录条数不变**（F08 验收 3）：一轮结束后存储中恰 `in` / `out` 两条；过程增量只经 `transport.publish`，不触碰 `persist`。
- [ ] **CLI `--protocol`**（MI-A-7）：`agent start <instance-id> --protocol acp|rpc` 生效；非法取值退 2、未知参数退 2（体例同既有 `--tools` / `--permission`）；不指定时按解析链取默认 `rpc`。
- [ ] **D-2 / D-3 的可执行证据 + 本 PR 的 4 个测试文件全绿**：`node --test oamp/test/zero-intrusion.test.js oamp/test/tool-permission.test.js oamp/test/web.test.js oamp/test/confirmation-roundtrip.test.js`。
- [ ] **全库测试面全绿**：`node --test oamp/test/*.test.js`（29 个既有文件 + pr-005 新增的 `protocol-layer.test.js` + 本 PR 新增的 `zero-intrusion.test.js` = 31；含 pr-002 固定后的 4 个与 pr-005 的 1 个新增）；`oamp/test/hygiene.test.js` 的零依赖与凭据词断言保持绿（F12 承载）。
- [ ] **服务边界与上游零改动**（F10 / F11 承载）：`git diff --stat` 不含 `oamp/src/web.js` 的监听 / 鉴权面、不含 `oamp/API.md` / `oamp/llms.txt`（配置面不是 HTTP 接口面，不触发 0016 / 0021 文档漂移锁）、不含 `omp/**`；本迭代消费的 rpc 能力全部可回指既有实测（M-1~M-5，无「需 omp 新增字段」前置项）。
- [ ] **README 与实现一致**（B-10）：环境变量表含 `OAMP_PROTOCOL` 行；配置面说明为四键；角色实例启动示例含 `--protocol`；常驻路径不再表述为「总是 `omp acp`」。

**择一判定声明（D-6 · 跨 PR 验收归属）**：① F02 验收 1/2（`D-1 指定即生效` 条）由**本 PR 判辅面（端到端回归面）**——主面在 `prs/pr-005-protocol-layer-and-injection-entry.md`（注入点解析链 + fake bin argv 的「选择与进程面」）；② F06 验收 1（acp 不退化）由**本 PR 判主面（行为回归面）**——辅面在 `prs/pr-002-test-face-profile-pinning.md`（把 harness 的「内置即 acp」隐式假设显式固定为 `OAMP_PROTOCOL='acp'`，使该回归判据可判）；③ F08 验收 1/2 由**本 PR 判辅面（管道面：三类增量被承接上送）**——主面在 `prs/pr-004-stream-kind-partition-ui.md`（界面面，F08 卡的 `[user_confirmed MI-01]` 判定面），界面上看不到时用本辅面区分「管道丢了」与「界面没接」。每张卡的每条验收只计一次主面判定、不互推。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§3.2 组件图、§3.3 三层落点与三条机械判据、§3.4 流 1~流 3、§4.2 L2-1~L2-13、§5.1 L2 标准面签名、§5.3 注入点与解析链、§5.5 增量帧面、§5.6 门映射、§5.7 能力位表、§6 F01~F12、§7 T-04~T-11、§9.2 B-6 / B-7 / B-8 / B-10、§9.3 零改动清单、§9.4.1 B-11~B-15（6 文件清单的实测口径见本 PR「测试面口径登记」）、§9.4.2 B-17、§11 N-1~N-6、§12.1 MI-A-1~MI-A-7）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F01-agent-launcher-and-profile.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F02-protocol-layer-and-injection-entry.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F03-zero-intrusion-contract.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F05-approval-gate-cross-protocol-mapping.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F06-acp-adapter-preserved.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F07-oneshot-adapter.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F08-process-visibility-runtime-stream.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F09-capability-declaration.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F10-service-boundary-unchanged.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F11-upstream-protocol-unchanged.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F12-zero-third-party-dependency.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/probes/m2-output.txt（abort 无参幂等 / 无协议级超时）、`m2b-output.txt`（三类增量与终态载荷）、`m5-output.txt`（恒一道门 / `title` 同源）、`m3-output.txt`（argv 矩阵：rpc / acp 非 mode 参数通用）
- prs/pr-005-protocol-layer-and-injection-entry.md（**标准面（`ProtocolError` / `CAPABILITY_KEYS` / `createProtocolLayer`）与 rpc / oneshot 两实现的真源**）、prs/pr-001-launcher-and-protocol-config.md（profile 表与 argv 构造）、prs/pr-002-test-face-profile-pinning.md（4 个 harness 测试文件的 acp 固定）
- 既有代码基线（本 PR 的改动锚点）：`oamp/src/acp-client.js:30-34`、`:42-48`、`:77`、`:136-145`、`:191`、`:198-207`、`:434-575`；`oamp/src/context-pool.js:7`、`:150-191`、`:203-249`；`oamp/src/agent.js:181-280`、`:303-337`、`:372-440`、`:589-624`、`:698-712`；`oamp/src/web.js:1626-1632`；`oamp/test/tool-permission.test.js:12`、`:307`、`:441`；`oamp/test/web.test.js:557`、`:573`、`:627`；`oamp/test/confirmation-roundtrip.test.js:20`、`:67-71`、`:202`、`:263`、`:319`、`:354`、`:386`、`:703-711`

## depends_on

- `pr-005-protocol-layer-and-injection-entry.md`（理由：本 PR 的消费面直接引用 pr-005 新建的 `oamp/src/protocol.js` 的三个符号——`ProtocolError`（`acp-client.js` 抛、`context-pool.js` 判的新契约）、`CAPABILITY_KEYS`（acp 能力位键集）、`createProtocolLayer()`（`agent.js` 的唯一注入点）；证据 = 这三个符号的**替换面在现状代码里逐处可指**：`oamp/src/acp-client.js:42-48`（本地 `AcpError` 类定义）、`oamp/src/context-pool.js:7`（`import { AcpClient, AcpError }`）与 `:191` / `:251` 的 `instanceof AcpError` 判定（另 `:151` / `:153` / `:168` / `:178` / `:242` / `:257` 为 `new AcpError(...)` 构造 / 抛出）、`oamp/src/agent.js:698`（`new ContextPool({...})` 的构造面改为注入 `createProtocolLayer(...)` 产物）⇒ pr-005 未合并时本 PR 的 import 目标不存在，判据无法成立）
- `pr-002-test-face-profile-pinning.md`（理由：4 个 harness 测试文件的 fake omp 桩**只实现 ACP JSON-RPC**（`FAKE_ACP_SOURCE` 按 `msg.method === 'initialize' / 'session/new' / 'session/prompt'` 分支），本 PR 把常驻链路默认切成 rpc 后若不先在这 4 个文件里显式固定 `OAMP_PROTOCOL='acp'`，它们会被以 `--mode rpc` 启动且桩永不回包 ⇒ 整组用例失败。代码证据：`oamp/test/call-protocol.test.js:757`（`['chunk','stdout','stderr'].includes(u.data.kind)`）、`oamp/test/context-pool.test.js` 的 `argvs.find((a) => a[0] === 'acp')` 与 `:506-534` 的一次性 / 常驻 argv 断言、`oamp/test/acp-daemon.test.js:546`（`devArgv = readJsonl(devArgs).find((a) => a[0] === 'acp')`）⇒ 真实合并序耦合，非顺序偏好）
- `pr-001-launcher-and-protocol-config.md`（理由：`oamp/src/acp-client.js:137` 现状 `['acp','--no-skills','--no-rules']` 的 argv 构造改经 L1 的 `omp:acp` profile（`PROFILES` + `buildArgv` 由 pr-001 交付，§3.3 判据「生产消费层的 import 图中不出现 argv 知识」）；解析链第 2/3 层取值 = pr-001 的 `oamp/src/config.js` 第 4 键 `protocol`（§5.3））

## batch

3
