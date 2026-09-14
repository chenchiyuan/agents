# pr-005：协议层落地（标准面 + 唯一注入点 + rpc / oneshot 两实现，加性子集）

## 上下文摘要

阶段 4 第 2 轮重划出的**加性子集**：只做「把标准面写下来，并交付其中两个自洽的实现（rpc / oneshot）」。新建 `oamp/src/protocol.js`（`ProtocolError` / `CAPABILITY_KEYS` / `createProtocolLayer()` 唯一注入点）、`oamp/src/rpc-client.js`（默认链路：帧 → 三类增量 / 门 / 终态 / 分片重组 / 取消）、`oamp/src/oneshot-client.js`（无会话语义；承接 `agent.js` 的 `-p` argv 与行流回收），并新建自证用例。**本 PR 零消费方**：`oamp/src` 与 `oamp/test` 对这三个模块今日零引用（实测），故落地行为零变更、既有测试面零改动。acp 实现的对齐（能力位 / `onDelta` / `ProtocolError`）与其唯一消费方 `context-pool.js` 的补偿因构成同一签名链，归 pr-003。

## 涉及功能点

- F01
- F02
- F04
- F07
- F09
- F11
- F12

## 文件范围

- `oamp/src/protocol.js`（**新建**：`ProtocolError`（码值逐字沿用既有 `AcpError.code` 五值：`context_crashed` / `model_unavailable` / `timeout` / `permission_denied` / `context_busy`）、`CAPABILITY_KEYS`（六键 `streaming` / `thinking` / `approvalGate` / `hostTools` / `introspection` / `queueControl`）、`createProtocolLayer({resident, profiles, bin, cwd, logger})` ⇒ `capabilities()` / `createResident({chatId, agentId, role, hooks})` / `createEphemeral({hooks})`；解析链 = 角色级 > `env.OAMP_PROTOCOL` > `config.json: protocol` > 内置 `'rpc'`，选择域 `{rpc, acp}`；**全仓唯一 import 三个实现模块的文件**）
- `oamp/src/rpc-client.js`（**新建**：`--mode rpc` 的逐帧映射按 architecture §5.4；`ready` → `negotiate_protocol{protocolVersion:2}`；三类增量 `thinking_delta→thinking` / `text_delta→chunk` / `toolcall_delta→tool_call` + `tool_execution_update→tool_output`（空 delta 跳过）；终态 = `agent_end{isTerminal:true}`（`messages` 末条 assistant 取 `stop_reason` / `usage`），`agent_end{isTerminal:false}` 不结算；受理回包 `response{command:'prompt',success:true}` **只记受理**；门双重过滤 `type==='extension_ui_request' && method==='select' && title.startsWith('Allow tool: ')` + 复用门名解析原语；非门交互类回 `{cancelled:true}`、展示类不回执；`cancel()` = `{type:'abort'}`（无参、幂等）→ 终态宽限 → kill；`close()` = 关 stdin → 短宽限 → kill 且容忍晚到帧；`rpc_chunk` 按 v2 帧面重组；未知帧忽略不崩；import 白名单 = `node:*` / `./protocol.js` / `./launcher.js`）
- `oamp/src/oneshot-client.js`（**新建**：一次性执行，**不持有跨轮状态**（不建会话、无 `contextId`、两轮之间不续接）；argv 经 L1 的 `omp:oneshot` profile（`modeArgs:['-p']` / `input:'positional'` / `approval:{mode:'yolo',appliesWhen:'always'}`）；承接 `oamp/src/agent.js:190-199` 的 `-p` argv 拼装与 stdout / stderr 行流回收 + `MAX_STREAM_LINES=200` 截断语义；行流的 `kind` 取值保持既有的 `stdout` / `stderr` + `line` 形状（零行为变更口径）；能力位 `streaming:'degraded'` + 其余 `'no'`，各带 `capabilityNotes`）
- `oamp/test/protocol-layer.test.js`（**新建** = §9.4.2 **B-16**：① 能力位六键齐全 + 非 `yes` 必有非空 `capabilityNotes`（本 PR 交付的 `rpc` / `oneshot` 两个实现；`acp` 侧归 pr-003）；② 注入点解析链四档（角色级 / env / config.json / 内置默认）+ 选择域 `{rpc, acp}` 封闭；③ 默认 ⇒ 子进程 argv 含 `['--mode','rpc']`，指定 `acp` ⇒ argv 首段 = `acp`（D-1「指定即生效」的**选择与进程面**；观测面 = fake bin 记 argv）；④ RPC 帧 → 三类增量 / 终态 / 受理不结算 / 非门回执 / 未知帧忽略的逐帧映射（帧级夹具或 rpc 形态 fake bin）；⑤ oneshot：argv = `omp:oneshot` 期望值、两轮两进程不续接、行流 `kind` + `line` 形状、`MAX_STREAM_LINES=200` 截断）

**零改动（防夹带）**：`oamp/src/acp-client.js` / `oamp/src/context-pool.js` / `oamp/src/agent.js`（三者的对齐与接线归 pr-003）；`oamp/src/launcher.js` / `oamp/src/config.js`（pr-001）；`oamp/web/**`（pr-004）；`oamp/src/web.js` / `oamp/src/router.js` / `oamp/src/rpc.js`（oamp 内部 UDS 协议）/ `oamp/bin/**`；`oamp/test/acp-daemon.test.js` / `context-pool.test.js` / `project-workspace.test.js` / `call-protocol.test.js`（pr-002）；`oamp/test/web.test.js` / `confirmation-roundtrip.test.js` / `tool-permission.test.js` / `zero-intrusion.test.js`（pr-003）；其余既有测试文件；`oamp/API.md` / `oamp/llms.txt` / `oamp/package.json`；`omp/**`。

**边界稳定约束（两条，均带代码证据，违反即导致文件范围重叠）**：

- **门名解析原语（`readApprovalToolName`）不得从 `oamp/src/acp-client.js` 引入**：该函数现为模块**私有**（`oamp/src/acp-client.js:30-34` 无 `export`，仅在 `:567` 内部使用），ESM 命名导入会在**链接期**直接失败；且 `acp-client.js` 归 pr-003，依赖其新增导出即构成 `pr-005 → pr-003` 的反向边，与 `pr-003 → pr-005` 成环。故 `protocol.js` 必须自持该原语（或 `rpc-client.js` 内自持），pr-003 再把 `acp-client.js` 内的重复定义改为引用同一份。依据：architecture §5.6「`readApprovalToolName(title)`（复用既有原语，`acp-client.js:30-34`；RPC 与 ACP 审批门**同源**）」。
- **`AcpClient` 的构造入参集合在本 PR 内固定（实测 10 键，非 8 键）**：`oamp/src/context-pool.js:203` 现状 `new AcpClient({...})` 的入参实测 = **10 键** = `bin`（`:204`）/ `model`（`:205`）/ `cwd`（`:206`）/ `tools`（`:207`）/ `roleFile`（`:208`）/ `permission`（`:209`）/ `auditContext`（`:211-218`：`instance` / `role` / `chat_id` 三键 + 惰性 `context_id` getter）/ `logger`（`:219`）/ `onExit`（`:220`）/ `onPermissionRequest`（`:223-226`）——即注入点装配 acp 实现所用的入参面（= pr-003 所称「注入的会话工厂」的承载面）。**装配归属（与 pr-003 双侧闭合）**：① `auditContext` 四键由**本 PR 的注入工厂**承载——会话身份三键取自 `createResident({chatId, agentId, role})`（`chatId`→`chat_id`、`agentId`→`instance`、`role`→`role`），`context_id` 惰性 getter 由工厂经 `hooks` 转发回调用方的会话 `contextId`（现状 `get context_id() { return session.contextId; }`，`:215-217`；`context_id` 依赖 spawn 后的 pid ⇒ 取值期才解析），其取值来源（会话身份与生命周期）只有消费层持有、由 pr-003 的 `context-pool.js` 经调用面提供；② `onExit` 由**本 PR 的注入工厂**接到会话的空闲崩溃收尾（对应现状 `oamp/src/context-pool.js:239-243` 的 `_onClientExit`），回调实体由 pr-003 的 `context-pool.js` 给出；③ `onPermissionRequest` 的**档位注入语义**（仅 `allow` 档注入 + 附加 `{chatId, agentId, origin}` 后透传，`:223-226`）归 pr-003 的会话切换承载，本 PR 只承载其装配位；该集合由本 PR 的 `protocol.js` 一次性写定，pr-003 的 `acp-client.js` 改造项（§9.2 B-8：能力位 / `onDelta` 外观 / `ProtocolError`）**不含**构造签名变更。若实现阶段确需变更构造签名，须回到阶段 4 重划（否则 `protocol.js` 需二次改动）。

## 验收标准

- [ ] 三个新文件存在且零第三方依赖：① **白名单判据只挂 `rpc-client.js` / `oneshot-client.js`**（与 architecture §3.3 的 `rpc-client.js` 行判据逐字一致）：该两文件的 import 集合 ⊆ `node:*` ∪ `{./protocol.js, ./launcher.js}`；② **`protocol.js` 是装配方、不在被限制方内**——其判据 = 只 import `node:*` + 三个实现模块（`./rpc-client.js` / `./oneshot-client.js` / `./acp-client.js`，可含 `./launcher.js`）；因其 import **必含**三实现模块，若把 `protocol.js` 一并套进上述白名单则字面判定必假（与同 PR 文件范围「全仓唯一 import 三个实现模块的文件」及 architecture §3.3「只有本文件 import 三个实现模块」一致）；③ 三文件均无第三方裸包名，`oamp/package.json` 的 `dependencies` 仍为 `{}`（F12 验收 1/2）。**机械复核式**：`grep -nE "^import" oamp/src/rpc-client.js oamp/src/oneshot-client.js` 的非 `node:` 命中 ⊆ `{./protocol.js, ./launcher.js}`；`grep -nE "^import" oamp/src/protocol.js` 的非 `node:` 命中 ⊆ `{./rpc-client.js, ./oneshot-client.js, ./acp-client.js, ./launcher.js}` 且 ⊇ 三个实现模块。
- [ ] **标准面四动作 + 三类增量 + 两类反向请求 + 能力位**齐备（§5.1）：会话对象具备 `prompt` / `cancel` / `close` + `capabilities` / `capabilityNotes` / `pid`；`prompt(text, {model, timeoutMs, onDelta})` 返回 `{text, model, stop_reason, usage, pid?}`。
- [ ] **能力位声明面（本 PR 侧）**（F09 验收 1/3）：`rpc` 与 `oneshot` 两实现各自 `capabilities` 六键齐全、取值 ∈ `{yes, no, degraded}`，任一非 `yes` 键的 `capabilityNotes[key]` 为非空字符串；`rpc.thinking === 'yes'`、`oneshot.streaming === 'degraded'`、`oneshot.approvalGate === 'no'`（§5.7 表逐字）。
- [ ] **注入点解析链四档 + 选择域封闭**（F02 验收 3/4、§5.3）：角色级 > `env.OAMP_PROTOCOL` > `config.json: protocol` > 内置 `'rpc'` 逐档生效；取值域恰 `{rpc, acp}`；越界值在 `loadConfig` 报错（体例同既有配置校验）；`oneshot` 不在选择域。
- [ ] **默认走 rpc + 指定即生效**（F02 验收 1/2 / D-1）：无任何指定 ⇒ 由 `createResident()` 起的子进程 argv 含 `['--mode','rpc']`；指定 `acp` ⇒ 同理起 `AcpClient`，argv 首段 = `acp`（子命令）；两者**都不回落到另一实现**（观测面 = fake bin 记录的 argv）。**本条只判「选择与进程面」**：`acp` 会话对象的**标准面外观**（能力位 / `notes` / `onDelta` / `ProtocolError`）在 pr-003 内对齐，相关断言归 pr-003（见 `prs/pr-003-protocol-layer-and-consumption-cutover.md`）。
- [ ] **RPC 帧映射逐条**（F04 验收 1/2）：`thinking_delta` / `text_delta` / `toolcall_delta` → `onDelta{kind:'thinking'|'chunk'|'tool_call'}`（空 delta 跳过）；`tool_execution_update` → `onDelta{kind:'tool_output', text: content[].text 拼接}`（取不到文本即跳过，不造内容）；`agent_end{isTerminal:true}` 结算且 `stop_reason` / `usage` 取自 `messages` 末条 assistant；`agent_end{isTerminal:false}` 不结算；`response{command:'prompt',success:true}` **不结算**；`message_update` 其余 8 子类型忽略；`tool_execution_start` / `tool_execution_end` / `available_commands_update` 忽略；未知帧忽略不崩（D-R7）。
- [ ] **门承接（RPC 侧）**（F05 验收 1~4 / §5.6）：一次受门禁调用 ⇒ `hooks.onApproval` **恰一次**、`tool` 名由 `title` 首行按既有原语提取（多行 `title` 不影响）、`options` 恒二元 `Approve` / `Deny`、裁决回 `{type:'extension_ui_response', id, value:<optionId>}`；非门交互类回 `{cancelled:true}`、`setWidget` 等展示类**不回执**。
- [ ] **取消与关闭语义**（L2-8 / L2-10）：`cancel()` 发无参 `{type:'abort'}`（幂等）→ 终态宽限 → 超宽限 kill；`close()` = 关 stdin → 短宽限 → kill，并容忍 EOF 后晚到帧。
- [ ] **oneshot 无会话语义**（F07 验收 1/2/3）：`createEphemeral()` 的 argv = `omp:oneshot` profile 期望值（`-p` 末位位置参数；工具关时 `--no-tools`；有角色时 `--append-system-prompt`；`--approval-mode yolo`）；连续两轮 prompt ⇒ **两次独立进程**、无 `contextId`、不续接；行流 `stdout` / `stderr` 的 `kind` + `line` 形状与 `MAX_STREAM_LINES=200` 截断事件与今天逐字一致；能力位 `streaming:'degraded'` + 其余键 `'no'` 各带 note；模块内**不含** shell 执行器（`!` shell 路径不进协议层）。
- [ ] **三实现与 `protocol.js` 的互有 import 可加载**：`node -e "import('./oamp/src/protocol.js')"` 无 TDZ / 循环导入错误——实现侧对 `ProtocolError` / `CAPABILITY_KEYS` 的引用只出现在**函数体 / 类成员**内，不在模块顶层求值（§3.3 的互有 import 是既定形态，顶层求值会命中 ESM 循环导入的 TDZ）。
- [ ] **零消费方 / 行为零变更**（本 PR 的可判定性前提）：`grep -rn "rpc-client\|oneshot-client" oamp/src` 的命中集合 ⊆ `{oamp/src/protocol.js}`；另 `grep -rn "from './protocol.js'\|from './rpc-client.js'\|from './oneshot-client.js'" oamp/src` 的命中集合 ⊆ 本 PR 的三个新模块本身（即新面之外无生产者引用）。`acp-client` 在 `oamp/src/context-pool.js:7` 的既有命中是 pr-003 的处置面，不属本 PR 的判定范围；`git diff --stat` 只含本 PR 的 4 个文件。
- [ ] **既有测试面零改动零回归**：29 个既有测试文件（`oamp/test/*.test.js` 实测 29 个）本 PR 修改 **0** 个；`node --test oamp/test/*.test.js` 全绿（含新增的 `protocol-layer.test.js`）。
- [ ] **静态卫生不因新增模块变红**（F12 载体）：`node --test oamp/test/hygiene.test.js` 全绿——该用例扫描 `oamp/bin/**` 与 `oamp/src/**` 全部 `.js` 的凭据词（`token` / `api_key` / `secret` / `password` / `credential` / `authorization` / `private_key`，词边界精确匹配）+ `package.json` 的 `dependencies === {}`（`oamp/test/hygiene.test.js:33-49`、`:61`）⇒ 新增三文件的文本不得出现上述**单词**；该用例**不含**「孤儿模块 / 未被 import 的模块」类断言，故加性子集不会因其变红。
- [ ] **服务边界与上游零改动**（F10 / F11 承载）：`git diff --stat` 不含 `oamp/src/web.js` 的监听 / 鉴权面，不含 `oamp/API.md` / `oamp/llms.txt` / `omp/**`；本 PR 消费的 rpc 能力全部可回指既有实测（M-1~M-5），无「需 omp 新增字段」前置项。

**择一判定声明（D-6 · 跨 PR 验收归属）**：F02 验收 1/2「默认走 rpc / 指定即生效」由**本 PR 判主面**（注入点自身的「选择与进程面」= 解析链四档 + fake bin 记录的 argv）；由 `prs/pr-003-protocol-layer-and-consumption-cutover.md` 判**辅面（端到端回归面）**（消费层接线后被启动的真实子进程 argv）。同一条验收两侧各判一次、不互推；阶段 5 / 6 的逐条判定以本声明为归属真源。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§3.2 组件图（L2→R/AC/OS、L1→R/OS）、§3.3 三层落点与判据、§3.4 流 1/流 3、§4.2 L2-1~L2-13、§5.1 L2 标准面签名、§5.2 profile 字段集、§5.3 注入点与解析链、§5.4 RPC 帧映射表、§5.5 增量帧面、§5.6 门映射、§5.7 能力位表、§6 F02 / F04 / F07 / F09 / F12、§7 T-02 / T-03 / T-04 / T-05、§9.1 B-2 / B-3 / B-4、§9.4.2 B-16、§12.1 MI-A-4 / MI-A-5 / MI-A-6）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F02-protocol-layer-and-injection-entry.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F04-rpc-adapter-stream-mapping.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F07-oneshot-adapter.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F09-capability-declaration.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F12-zero-third-party-dependency.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/probes/m1-output.txt（1 进程 = 1 会话 = 1 在飞轮次 / 并发 prompt 被拒）、`m2-output.txt`（abort 无参幂等 / 无协议级超时）、`m2b-output.txt`（三类增量与终态载荷）、`m5-output.txt`（恒一道门 / `title` 同源）
- prs/pr-001-launcher-and-protocol-config.md（profile 表、唯一 argv 构造、`OAMP_PROTOCOL` 键的真源）
- 既有代码基线（本 PR 的迁移来源与参照面）：`oamp/src/agent.js:190-199`（现状 `-p` argv 拼装，迁入 `oneshot-client.js`）、`:181-280`（现状一次性路径的进程 / 超时 / 行流回收，同上）、`oamp/src/acp-client.js:30-34`（门名解析原语，本 PR 自持同源实现）、`:77`（`AcpClient` 类，注入点装配 acp 分支的对象）、`:137-144`（现状 acp argv，迁入 L1 后由 `omp:acp` profile 复现）、`:191`、`:207`（现状 `onChunk` 面）、`oamp/src/context-pool.js:186`（现状向实现透传 `onChunk`）、`oamp/src/web.js:1628`（`stdout` 专属 `entry.lines` 累积面）
- 本轮证据（重划依据）：`clarifications/verify-stage4-gate-20260914.md` 的 E-1（三个新模块今日零引用）、E-5（`hygiene.test.js` 无孤儿模块断言）

## depends_on

- `pr-001-launcher-and-protocol-config.md`（理由：本 PR 两实现的**启动面**与解析链取值均来自 pr-001 的代码级产出——argv 由 pr-001 新建的 `oamp/src/launcher.js` 的 `PROFILES` + 唯一 argv 构造产出（§3.3 白名单「`rpc-client.js` 的 import 只有 `node:*` / `protocol.js` / `launcher.js`」；§9.1 B-1 判据「`-p` 与 `--mode rpc` 的 argv 均出自本模块」），解析链第 2/3 层取值由 pr-001 的 `oamp/src/config.js` 第 4 键 `protocol` 提供（§5.3）。证据：现状两处 argv 生产点 `oamp/src/acp-client.js:137`（`['acp','--no-skills','--no-rules']`）与 `oamp/src/agent.js:190-199`（`['-p','--no-session']`）在本 PR 内改为只经 L1 产出 ⇒ 无 launcher 即无 argv、无 `protocol` 键即无解析链）

## batch

2
