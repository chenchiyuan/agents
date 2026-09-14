# pr-001：档位解析唯一汇聚点 + 提问通路的 agent 侧（三实现消费与 argv 收窄）

## 上下文摘要

档位唯一汇聚点 + 提问通路 agent 侧接线：`resolveApproval` 求值一次写入 `spec.approval`，profile 不再承载档位取值、三实现只消费；`deny` 档在 rpc 侧补「拒绝 + abort + permission_denied」三步。提问：rpc 走宿主工具、acp 拆问后齐答一次回包，上浮为 `request_kind:'question'`。

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
- F13
- F16

## 文件范围

### 生产面（8 个既有文件，全部为扩展或收窄，无重构）

- `oamp/src/protocol.js`（**修改**：+`resolveApproval(spec)` 纯函数（解析链四条，唯一汇聚点）；`createProtocolLayer` 装配时求值**一次**并写入 `spec.approval`；acp 分支把已解析档位与提问钩子传下去。检索式：`export function createProtocolLayer`（:73）、`const protocol = resolveProtocol(spec)`（:75）、`function resolveProtocol`（:59）、`new AcpClient({`（:93）、`onPermissionRequest:`（:112）。**零改动**：`CAPABILITY_KEYS`（:23）与 `capabilities()` 键集/签名）
- `oamp/src/config.js`（**修改**：+第 5 键 `approval`（值域 `{always-ask, yolo}`，缺省 `yolo`，非法 ⇒ `OAMP 配置错误: approval 仅支持 always-ask/yolo（当前值 …）`）；**叶子约束不变**（不 import `src/` 内任何模块）。检索式：`function readProtocol`（:41）、`export function loadConfig`（:121）、`protocol:`（:145））
- `oamp/src/launcher.js`（**修改**：① `PROFILES` 五行的 `approval.mode` **删除**、保留 `appliesWhen`（:22 / :37 / :52 / :68 / :83）；② `buildArgv` 的 `approval` 入参 = **已解析档位字符串**（未给 ⇒ 响亮失败；现行 `undefined ⇒ 取 profile.approval` 的静默回落通路删除）（:109-114、:129-132）；③ JSDoc 同步（:100-107）；④ `spawnAgent` 透传位同步（:150-152））
- `oamp/src/oneshot-client.js`（**修改**：删除本文件内的档位自定义合成（:93-97），改为消费 `spec.approval` 落 argv（:121）。**零改动**：行流上限 200 / 超时三拍 / `-p` 形态）
- `oamp/src/acp-client.js`（**修改**：① 构造面 +`approval`（已解析档位，经 L1 落 argv）（:107-118、:160-170 的 `buildArgv('omp:acp', …)`；现状不传 `approval` ⇒ 收窄后会响亮失败）；② `_handleElicitationRequest` 的**非门分支**由 `decline` 改为「按 §5.5 映射表拆问 → 逐问调用提问钩子 → 本帧处理函数内的局部聚合 → 齐答后**恰一次** `_respond({action:'accept', content})`」（:565-575，`decline` 在 :570）。**零改动**：审批门路径（:573-574）、`_approvalGateDecision`（:583-603）、`_askHook`（:532-543）、拒绝三步（:485-494）、`_permissionDecision`（:510-528））
- `oamp/src/rpc-client.js`（**修改**：① argv 传已解析档位（:122 的 `spawnAgent(PROFILE, …)`）；② 握手完成后（`negotiate_protocol` 回包成功、返回会话对象之前）`set_host_tools([ask_user])` **恰一次**（:241-249 的 `onResponse` / `frame.command === 'negotiate_protocol'` 分支）；③ +`host_tool_call` 承接（冻结轮次计时 → 上浮 → `host_tool_result{result:{content:[{type:'text',text}]}}`）与 `host_tool_cancel`（撤条目、不回包）（检索式 `function handleFrame`）；④ `handleApproval` 的**「无收件人」分支**补三步：回执拒绝 + `{type:'abort'}` + 以 `ProtocolError('permission_denied')` 结算该轮（:307-312；现状仅 `{cancelled:true}`，R3 D1 实测该轮**照常收尾** ⇒ F03 验收 3 的 rpc 观测面今天不存在）。**零改动**：`INTERACTIVE_METHODS` 的 `{cancelled:true}` 回执（:341-343）、`freezeTurnTimer` / `thawTurnTimer`（:179-202）、能力位表（:31-46））
- `oamp/src/agent.js`（**修改**：① `AGENT_FLAGS` / `parseAgentArgs` +`--approval-mode <always-ask|yolo>`（非法 ⇒ 退出 2 并点名该值）（:549、:565-567、:571）；② resident spec 传入 `approval`（显式档位）与 `configApproval`（config 第 5 键）（:681-691、:717-718）；③ `AGENT_START` 事件 +`approval` 字段（:660-667）；④ `onQuestionRequest` 接线（与门钩子共用 `raiseConfirmation`）与池构造注入（:275、:693-712）；⑤ `raiseConfirmation` 支持 `request_kind:'question'` 字段集（`request_kind` + `multiple`，问题文本沿用既有 `title`、选项沿用既有 `options`）（:275-293）；⑥ `settleConfirmation` 支持 `option_ids`（question 类载荷；permission 类 `option_id` 逐字不变）（:300-308）。**零改动**：`cancelPending` / 信封 3（:315-321）、`runShellTask`、心跳两档与重连自愈）
- `oamp/src/context-pool.js`（**修改**：`_ensureClient` 的 hooks 面——门钩子判定 `permission === 'allow'` **逐字保留**（:193-196），**新增** `onQuestionRequest`（**恒注入**，与 `permission` 解耦）并附加会话身份后透传（:201-206）；构造面 `opts` +`onQuestionRequest`（:27）。**零改动**：键 `chatId::agentId`、FIFO 串行、LRU 淘汰、`_failSession` 收尾分类、`sentTurns`）

### 文档面（1 个）

- `oamp/README.md`（**修改**：配置面「四键」→「五键」并补 `approval` 说明（:4、:309-314 的 JSON 示例）；补 `--approval-mode` 的取值域与默认值说明（:216、:302）。**零改动**：`## 协议速览` 的方法面清单（`oamp/test/project-workspace.test.js:972-980` 逐字断言其 7 项不变））

### 测试面（1 个新建 + 8 个既有文件迁移；均为 argv 签名收窄的必然迁移或新行为断言）

- `oamp/test/approval-resolution.test.js`（**新建**：`resolveApproval` 四条解析链与优先级（`deny` 压显式档位）、值域外响亮失败、`createProtocolLayer` 求值一次并写 `spec.approval`、`capabilities()` 六键不随档位变）
- `oamp/test/config-file.test.js`（**修改**：`assert.deepEqual(config, { … })` 全对象断言必须补 `approval` 键（:34-48）；+该键的三档取值、取值域、非法值响亮失败断言）
- `oamp/test/protocol-layer.test.js`（**修改**：`buildArgv` 调用点补传已解析档位（:278、:495-514）；+rpc「无收件人」分支的三步断言；+宿主工具注册恰一次与 `host_tool_call` 承接断言）
- `oamp/test/tool-permission.test.js`（**修改**：acp 的 `buildArgv` 期望值由 `PROFILES['omp:acp'].approval.mode` 改为**已解析档位**推导（:343、:352、:359、:374、:575-595）；+非门 elicitation 四形状拆问断言）
- `oamp/test/acp-daemon.test.js`（**修改**：两处档位断言（:559、:581、:595）与 `PROFILES[...].approval.mode` 解耦，改为按已解析档位值 + `buildArgv` 推导；匿名实例无档位段的回归断言（:588）保持）
- `oamp/test/confirmation-roundtrip.test.js`（**修改**：① 一次性路径档位期望值（:716）改为已解析档位；② rpc「无收件人（自动拒绝）」分支的期望由「该轮照常收尾」改为「该轮以 `permission_denied` 中止 + 收件箱零新增」（检索式 `FAKE_ACP_MODE: 'permission'`、`notices('confirmation_request')`）；③ +提问回路用例（rpc：`host_tool_call` → `notice{request_kind:'question'}` → 作答 → `host_tool_result` → 该轮继续；acp：一帧 N 问 ⇒ N 条条目 + 齐答前不推进 + 齐答后恰一次回包；未作答保持挂起且无超时））
- `oamp/test/context-pool.test.js`（**修改**：`buildArgv` 调用点补传档位（:540）；+提问钩子**恒注入**断言（`deny` 档提问仍上浮、工具门仍零注入））
- `oamp/test/project-workspace.test.js`（**修改**：`buildArgv` 调用点补传档位（:1013））
- `oamp/test/web.test.js`（**修改**：`buildArgv` 调用点补传档位（:592））

**零改动（防夹带；越界即 F12 / F13 验收不通过）**：`oamp/src/web.js`、`oamp/src/inbox.js`、`oamp/src/transport.js`、`oamp/src/persist.js`、`oamp/src/router.js`、`oamp/src/rpc.js`、`oamp/src/node-client.js`、`oamp/src/status.js`、`oamp/src/task.js`、`oamp/src/registry.js`、`oamp/src/cluster.js`、`oamp/src/cluster-config.js`、`oamp/src/role-binding.js`、`oamp/src/log.js`、`oamp/bin/**`、`oamp/package.json`（`dependencies` 仍 `{}`）、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`、`oamp/test/helpers/**`、`oamp/test/confirmation-inbox.test.js`、`oamp/test/inbox-console.test.js`、`oamp/test/api-routes.test.js`、`oamp/test/{zero-intrusion,hygiene}.test.js`、`omp/**`。

## 验收标准

- [ ] **唯一汇聚点（F03 验收 4 / L1-1）**：`resolveApproval` 的实现与调用点各**恰一处**（`oamp/src/protocol.js`）；`grep -rn "resolveApproval" oamp/src` 命中集合 = `{protocol.js}`；`grep -rn "spec\.approval\|configApproval" oamp/src` 的写入面**只有** `protocol.js`，`rpc-client.js` / `acp-client.js` / `oneshot-client.js` 只读不判定 ⇒ 不存在「某条链路忘记覆写」的通路。
- [ ] **默认档 = `yolo`（F01 验收 1/3/4）**：不做任何档位配置（无 `--approval-mode`、无 `config.json: approval`）、`--permission allow`、工具开 ⇒ 常驻与一次性 argv 的 `--approval-mode` 值为 `yolo`；`yolo` 下一轮受门禁调用**零上浮条目**且工具确实产生后果（复用 `clarifications/probes/probe-r4-yolo-gate.mjs` 的 Y1 判定面）。
- [ ] **档位可配 + 取值域两值（F02 验收 1/2/3）**：`config.json: {"approval":"always-ask"}` 或无配置文件的 `--approval-mode always-ask` ⇒ argv 随之变 `always-ask`；枚举取值域 = `{always-ask, yolo}`（无 `write` / `tier`）。
- [ ] **非法值响亮失败（F02 验收 4 / MI-01）**：`agent start x --approval-mode bogus` ⇒ 退出 2 且 stderr 点名该值；`config.json: {"approval":"bogus"}` ⇒ `agent start` 退出 1 且报 `OAMP 配置错误`；**不出现**「启动成功且档位落到 `yolo`」。
- [ ] **`deny` 强制 `always-ask` 且优先（F03 验收 1/2/3 / MI-02）**：`--permission deny` + 显式 `--approval-mode yolo` ⇒ argv 仍 `--approval-mode always-ask`；一次受门禁调用 ⇒ 收件箱**零新增条目**、该轮以 `permission_denied` **中止**（rpc：新增三步；判定面 = `err.code === 'permission_denied'` 且 `pending` 表无残留）、acp 侧 `TOOL_DENIED` 审计行（既有）且三步逐字未改；两条链路均**不出现**新增的拒绝痕迹载体。
- [ ] **门通路保留（F10 验收 1/2/3/4/5）**：`--approval-mode always-ask` 档一次受门禁调用 ⇒ 收件箱**恰一条** `request_kind:'permission'` 条目、可裁决、裁决后条目消失且该轮继续或中止；`yolo` 档被用户策略强制的偶发门同样可裁决（R4 Y2 形态）；`deny` 实例零条目；`request_kind:'permission'` 的形状与交互（选项为主、文本为辅、点选即裁决）逐字不变。
- [ ] **提问上浮（F04 验收 1/2/3/4/5）**：rpc 链路一次 `ask_user` 宿主工具调用与 acp 链路一次非门 `elicitation/create` ⇒ 各产生 `notice{kind:'confirmation_request'}`，其 body 含 `request_kind:'question'`、`title` = 问题文本、`options`（可为 `[]`）、`multiple`；不再出现 `{cancelled:true}` / `{action:'decline'}` 回执；通知事件类型仍为 `confirmation_required`（零新类型）；`deny` 实例的提问**同样**上浮（提问钩子恒注入）。
- [ ] **提问形状与回传（F05 验收 1~5 / F07 验收 1~4 / MI-03)）**：信封 9 字段齐备且 `title` 逐字 = 提问文本、`options` 不增不减、`multiple` 来自请求方；作答 `{optionIds, text}` ⇒ rpc 回包文本按 L2-5 模板（`选项：…` / `文本：<逐字>`）且该轮**从等待变为继续**（`host_tool_result` → `agent_end{isTerminal:true}`）；acp 侧由 `content` 承载且齐答后单次 `accept`；`option_ids` 与 `text` **皆空**时不解锁回传（条目保持挂起）；question 类**不**追加 chat 输入（该侧面归 pr-002，本 PR 判「不回传 `option_id`」侧）。
- [ ] **一问一条与组内暂存（F06 验收 1~4 / L1-5）**：acp 一帧 N 问 ⇒ N 条独立条目（各 `confirmation_id`）、齐答前该轮不推进、齐答后**恰一次** `_respond`；条目仍是「一条 = 一次裁决」，无 `questions[]` 大信封；rpc 侧 N 次调用 ⇒ N 条（天然逐问）。
- [ ] **挂起无上限（F08 验收 1~5 / T-08）**：挂起期轮次计时**冻结**（`freezeTurnTimer` / `_pauseTurnTimer` 复用；判定 = 轮次超时 300ms 远小于挂起时长的用例仍不超时）；全仓无新增计时器 / 超时面 / `ask.timeout`（`grep -rn "setTimeout" oamp/src` 的新增命中不含提问路径；无超时配置键）；不自动选、不代答拒绝。
- [ ] **两条链路承载与零上游改动（F09 验收 1~4 / F12）**：默认链路 argv 首段仍 `['--mode','rpc']`（会话形态不变）；`--no-tools` 下 `ask_user` 仍可注册并调用（R2 S4 实测面）；`omp/**` 与 `harness` 源码零改动（`git diff --stat` 不含 `omp/**`）；`set_host_tools` 注册**恰一次**（R2 S3 替换语义 ⇒ 重复即自覆盖）。
- [ ] **能力位与档位声明分离（F11 验收 1/2/3 / T-06）**：`CAPABILITY_KEYS` 六键与 `capabilities()` 签名不变，`approvalGate` 两档取值相同（rpc/acp = `'yes'`、oneshot = `'no'` + 非空 note）；档位声明三处同源——`AGENT_START` 事件的 `approval` 字段、`spec.approval`、argv 的 `--approval-mode` 值三者相等；能力位定义内不含档位取值。
- [ ] **不新增审计面与零依赖（F13 验收 1~5 / F16）**：审计面无新增行类型 / 载体（rpc 拒绝路径**不**补审批行，复用既有 `permission_denied` 码值；`TOOL_CALL` 不受影响）；`oamp/package.json` 的 `dependencies` 仍 `{}`（`test/hygiene.test.js` 绿）。
- [ ] **命令全绿且改动面封闭**：`node --test oamp/test/approval-resolution.test.js oamp/test/config-file.test.js oamp/test/protocol-layer.test.js oamp/test/tool-permission.test.js oamp/test/acp-daemon.test.js oamp/test/confirmation-roundtrip.test.js oamp/test/context-pool.test.js oamp/test/project-workspace.test.js oamp/test/web.test.js` 全绿；`node --test oamp/test/*.test.js` 无非本 PR 引入的失败；`test/zero-intrusion.test.js` 保持绿（消费层不 import 具体实现、不出现协议取值字面）；`git diff --stat` 只含本 PR 列出的文件。

**择一判定声明（跨 PR 验收归属）**：① F03 验收 4（唯一汇聚点）与 F11 验收 2（档位声明三处同源）**主面在本 PR**；② F04 验收 1 的「控制台栏内可见」半句归 pr-002 / pr-003（本 PR 只判 `notice` 信封面：`request_kind:'question'` + 字段集合）；③ F07 验收 3（停掉「文本 → chat 输入」旁路）的**主面在 pr-002**（`web.js` 的旁路点），本 PR 只判「question 类结算值不含 `optionId`」；④ F05 验收 2 的「条目允许选中多项并一并提交」**主面在 pr-003**（栏内控件），本 PR 判「信封 `multiple` 承载正确」；⑤ F15 / F14 的判定面归 pr-002（`prd/F15` / `prd/F14` 属保证项，本 PR 不引用）。

## 参考资料

- `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`（§3.1 组件图、§3.2 模块布局、§3.3 流 1~流 6、§4.1 L1-1~L1-7、§4.2 L2-1~L2-9、§5.1 档位（解析链 / 配置面 / argv 面 / 两型钩子注入面 / 能力位面）、§5.2 信封、§5.3 回传载荷、§5.4 宿主工具、§5.5 acp 映射表、§5.6 能力位、§5.7 挂起与收尾、§6 F01~F16、§7 T-01~T-08、§9.1 修改面、§9.3 零改动清单、§9.4 测试面、§10 奥卡姆表、§11 实测新事实 N-1~N-5）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prd/F01-default-approval-yolo.md`、`F02-approval-mode-config.md`、`F03-deny-forces-always-ask.md`、`F04-question-surfacing.md`、`F05-question-shape.md`、`F06-multi-question-one-item-each.md`、`F07-answer-roundtrip.md`、`F08-question-pending-block.md`、`F09-question-channel-both-lanes.md`、`F10-permission-channel-preserved.md`、`F11-approval-gate-vs-approval-declaration.md`、`F12-upstream-unchanged.md`、`F13-no-new-audit-surface.md`、`F16-zero-third-party-dependency.md`
- `docs/iterations/0023-yolo-approval-and-question-inbox/clarifications/probes/`（`probe-r2-host-tools.mjs` + `r2-host-tools-output.txt`（S1 挂起期无终态帧 / S3 注册为替换 / S4 `--no-tools` 下可用）、`probe-r2b-host-tool-persistence.mjs` + 输出（跨轮存活）、`probe-r3-deny-autoreject.mjs` + 输出（D1 仅拒工具、轮次照常收尾）、`probe-r3b-abort-semantics.mjs` + 输出（abort 为轮次级、同会话可续）、`probe-r4-yolo-gate.mjs` + 输出（Y1 零门 / Y2 用户策略偶发门 / Y3 策略阻断）、`probe-a2-acp-ask-form.mjs` + 输出（一帧多问 / 一次回包 / 单选 + 文本时选项被上游丢弃））
- 代码基线锚点：`oamp/src/launcher.js:22,37,52,68,83,109-114,129-132`；`oamp/src/protocol.js:23,59-64,73-75,87-116`；`oamp/src/config.js:41,121-146`；`oamp/src/oneshot-client.js:93-97,121`；`oamp/src/acp-client.js:107-118,160-170,485-494,510-543,565-575,583-603`；`oamp/src/rpc-client.js:24,112-122,241-249,307-312,335-343`；`oamp/src/agent.js:275-321,549,565-571,660-667,681-691,693-718`；`oamp/src/context-pool.js:27,187-206`；`oamp/test/{config-file,protocol-layer,tool-permission,acp-daemon,confirmation-roundtrip,context-pool,project-workspace,web}.test.js` 对应行
- 体例参照（只读）：`docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-003-protocol-layer-and-consumption-cutover.md`（消费层切换的不可再拆论证体例）、`docs/iterations/0021-confirmation-inbox-and-event-push/prs/pr-002-agent-confirmation-wiring.md`（agent 侧接线体例）

## depends_on

（无）

## batch

1
