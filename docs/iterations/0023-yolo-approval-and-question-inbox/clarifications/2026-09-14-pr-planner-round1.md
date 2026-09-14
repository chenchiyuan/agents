# 阶段 4 澄清记录（pr-planner · 第 1 轮）— 0023-yolo-approval-and-question-inbox

**角色**: pr-planner（阶段 4 · PR 规划）·第 1 轮
**日期**: 2026-09-14
**迭代**: 0023-yolo-approval-and-question-inbox
**阶段**: 4（PR 规划）
**工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0023-yolo-approval-and-question-inbox`（本轮一切写入均以该地址为根的**绝对路径**）
**本轮性质**: **从架构 + 功能卡 + 代码库现状反射 PR 边界与依赖**——不写实现、不做单 PR 内部任务拆解、不产出全局 `tasks.md`、不创建 worktree / 分支、不执行任何 git 写操作
**输入**: `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`（v0.2.0，665 行）、`prd.md` + `prd/F01~F16*.md`（16 卡）、`clarifications/probes/**`（A2 / R2 / R2b / R3 / R3b / R4 六探针与原始输出）、`<工作区>/oamp/**`（**实读**：`src/` 23 个 .js、`web/` 7 个 .js + `web/style.css`、`test/` 29 个 `.test.js` + 2 helpers = 31 个 .js）
**产出**: `prs/pr-001-approval-resolution-and-question-channel.md`、`prs/pr-002-web-envelope-and-decision-routing.md`、`prs/pr-003-inbox-question-item-frontend.md` + 本记录
**会话限制**: 运行在**无实时对话通道**的子 agent ⇒ **零自问自答**；依赖判断不确定处一律列入 §7 交主 agent，不自行拍板。

---

## §1 上下文获取（实读清单）

| 面 | 实读对象 | 用途 |
|---|---|---|
| 架构 | `architecture.md` 全文（§1 现状基线 / §2 六探针实测 / §3 目标架构与流 1~6 / §4 L1-7 + L2-9 / §5 接口契约 / §6 卡↔路径 / §7 T-01~T-08 / §9 必然变更点清单 / §10 奥卡姆 / §11 风险与新事实） | 变更面与契约的事实源 |
| 产品 | `prd.md`（功能点索引 + 追溯 + 口径更替五类处置 + MI 回收表）、`prd/F01~F16*.md` 全 16 张 | `涉及功能点` 与 `验收标准` 的来源 |
| 探针 | `clarifications/probes/probe-{a2,r2,r2b,r3,r3b,r4}*` 的脚本与输出（A2 一帧多问 / R2 宿主工具四场景 / R2b 跨轮 / R3 拒绝不中止 / R3b abort 轮次级 / R4 yolo 零门） | 依赖核实时的行为判决依据 |
| 代码（**逐处实读，不采信文档叙述**） | `src/{protocol,launcher,config,agent,context-pool,rpc-client,acp-client,oneshot-client,web,inbox}.js`、`web/app.js`、`test/` 受影响用例与 `test/helpers/{harness,fake-node}.js`、`package.json`、`README.md`、`API.md`、`llms.txt`、`scripts/gen-llms-txt.mjs` | PR 边界与 `depends_on` 的证据源 |
| 体例参照（只读） | `docs/iterations/0022-*/prs/{pr-001,pr-002,pr-003,pr-005}*.md`、`docs/iterations/0021-*/prs/{pr-002,pr-003,pr-004}*.md` | 七字段写法、`depends_on` 证据强度、文件范围 + 零改动清单 + 择一判定声明的既有体例 |

---

## §2 目标对齐：变更组件清单（新建 / 修改，逐条带实读证据）

架构 §9 的清单经**实读复核**成立（11 个文件；**新建模块 0**）。逐条复核结论：

| # | 变更点 | 实读证据 | 性质 |
|---|---|---|---|
| 1 | `protocol.js` +`resolveApproval` 唯一汇聚点 | `createProtocolLayer`（:73）今日只做 `resolveProtocol`（:59-64）；acp 分支逐字段装配 `new AcpClient({…})`（:93-114） | 扩展 |
| 2 | `launcher.js` profile 档位取值删除 + `buildArgv` 入参语义收窄 | `PROFILES` 五行带 `approval.mode`（:22/:37/:52/:68/:83）；`buildArgv` 的 `plain undefined ⇒ profile.approval` 静默回落（:114、:130-132）；**当前 rpc/acp 调用点都不传 `approval`**（`rpc-client.js:122`、`acp-client.js:165-169`）⇒ 收窄与三实现接线**必然同批** | 收窄（破坏性签名变更） |
| 3 | `config.js` 第 5 键 `approval` | `loadConfig` 今日返回 11 键（:121-146）；`readProtocol`（:41）为值域校验体例；**唯一全对象断言**在 `test/config-file.test.js:34-48` | 扩展 |
| 4 | `oneshot-client.js` 删除自定义档位合成 | :93-97 的 `toolsOn ? (permission==='deny' ? 'always-ask' : 'yolo') : null`（G3：第三处判定） | 收窄 |
| 5 | `acp-client.js` 构造面 +`approval` + 非门 elicitation 改写 | `buildArgv('omp:acp', …)` 不传 `approval`（:165-169）；`_handleElicitationRequest` 非门分支 `decline`（:569-571） | 改写（1 分支）+ 入参 |
| 6 | `rpc-client.js` argv + 宿主工具 + 拒绝三步 | `spawnAgent(PROFILE, …)` 不传 `approval`（:122）；`negotiate_protocol` 回包分支为握手终点（:241-249）；`handleApproval` 无收件人分支仅回 `{cancelled:true}`（:307-312）；非门交互回 `{cancelled:true}`（:341-343） | 扩展 |
| 7 | `agent.js` `--approval-mode` + 钩子接线 + 信封扩展 | `AGENT_FLAGS` 5 项（:549）；`parseAgentArgs`（:565-571）；`makeLayer`/spec（:681-691、:717-718）；`raiseConfirmation`（:275-293）/`settleConfirmation`（:300-308） | 扩展（3 处） |
| 8 | `context-pool.js` hooks 面 | `_ensureClient` 的 `onRequest` 判定 `permission === 'allow'`（:193-196）、`hooks:{onPermissionRequest, onApproval}`（:201-206） | 扩展（1 处） |
| 9 | `web.js` 白名单 + 裁决路由分化 | `confirmation_request` 白名单 7 字段（:1597-1610）；裁决路由只认 `option_id`（:1301-1311）+ 文本旁路（:1313-1340）；路由元数据（:1258-1263 / :1275-1285） | 扩展（2 处） |
| 10 | `web/app.js` 条目渲染分化 | `renderInboxItem`（:671-681）、`decide`（:717-732） | 扩展（1 分支） |
| 11 | `web/style.css` question 控件样式 | 既有 inbox 类名体系（`.inbox-item` / `.inbox-option` / `.inbox-text`） | 扩展 |

**与架构不一致处**：无（§9 清单与实读逐条相符；`inbox.js` / `transport.js` / `persist.js` / `router.js` / `web/notify.js` / `web/index.html` 的「零改动」经实读确认——例如 `inbox.js` 恰好 5 个导出、`take()` 即删）。**唯一需要实现期决定、但两种读法都不改变 PR 边界的未定项**见 §7。

---

## §3 PR 划分与边界（3 个 PR）

| PR | 主题 | 文件数 | batch |
|---|---|---|---|
| `pr-001-approval-resolution-and-question-channel.md` | 档位解析唯一汇聚点 + 提问通路的 agent 侧（含三实现消费与 argv 收窄） | 8 生产 + 1 文档 + 10 测试 | 1 |
| `pr-002-web-envelope-and-decision-routing.md` | web 进程承载提问信封与裁决分化（白名单 + 裁决路由 + 派生面同步） | 1 生产 + 2 文档 + 1 测试 | 1 |
| `pr-003-inbox-question-item-frontend.md` | 控制台第三栏 question 条目渲染与提交载荷分化 | 2 前端 + 1 测试 | 2 |

**为什么是这三个**：边界按**运行时进程面 + 文件不可重叠**反射，不按架构章节顺序：

1. **`pr-001` 不能再拆**（论证同 0022 `pr-003` 的「关键约束」体例）：`launcher.js` 删除 `approval.mode` + `buildArgv` 入参收窄是**破坏性签名变更**——此刻 `rpc-client.js:122` / `acp-client.js:165-169` / `oneshot-client.js:121` 三处调用点当日均不传 `approval`（实读），签名一改即全部命中「未给 ⇒ 响亮失败」⇒ **档位真源与三实现消费必然同批**；同理 `resolveApproval` 的输入（`spec.approval` / `spec.configApproval`）由 `agent.js:681-691` 装配，而 `agent.js` 同时承载提问钩子接线（:275 / :693-712）⇒ **档位与提问通路在这 3 个共享文件上无法分属两个 PR**（文件范围重叠是硬约束）。
2. **`pr-002` 单列 web 进程**：`web.js` 的改动在文件内自洽（白名单写 `kind`/`multiple`、裁决路由读 `entry.kind`、缺 `kind` 按 `'permission'` 兜底），行为可用**既有假节点注入面**独立验证（`test/helpers/fake-node.js` + `test/confirmation-inbox.test.js:153-183` 的 `ENVELOPE` 工厂）⇒ 与 `pr-001` 并**可并发**（体例 = 0021 的 `pr-002`（agent 侧）/ `pr-003`（web 侧）分立，且 0021 `pr-003` 的 `depends_on` 亦为「（无）」）。
3. **`pr-003` 单列前端**：`web/app.js` + `web/style.css` + `test/inbox-console.test.js` 是同一件可描述的事（栏内控件分化），判定面是 `app.js` 的函数级静态契约与 `vm` 沙箱产出（`test/inbox-console.test.js:59-99` 的既有体例），与后端零文件重叠。

**被否决的划分（登记，避免下轮重复推演）**：

| 候选划分 | 否决理由（代码级） |
|---|---|
| 「档位 PR」与「提问 PR」按功能切分，各自独立 | 三个共享文件 `agent.js` / `rpc-client.js` / `acp-client.js` 同时承载两件事 ⇒ 文件范围重叠，违反硬约束；且两半互缺时 `resolveApproval` 与 `buildArgv` 签名构成**环**（消费侧要求真源、真源要求消费侧），有环不可调度 |
| 把「档位解析真源 + 配置键」做成**加性子集**单列（体例同 0022 `pr-005`） | ① `protocol.js` 的提问钩子转发（acp 分支，:111-113）归属存在未定项（§7-Q1）——若实现期选「新增构造参数」读法，`protocol.js` 必须与提问接线同批 ⇒ 该切分不稳；② `agent.js` 的 `--approval-mode` 取值域校验很可能需要 `protocol.js` 导出的域符号（体例：`agent.js:552-560` 的 `isSelectableProtocol` 以 `createProtocolLayer` 为真源）⇒ 两文件同批更稳。**收益不足以承担不确定性** |
| 「测试面固定」单列（体例同 0022 `pr-002`） | 0022 的测试面 PR 是**前置惰性**（注入 env 而不改断言）；本迭代的测试迁移是 `buildArgv` 签名的**必然联动**（`test/{config-file,protocol-layer,tool-permission,acp-daemon,confirmation-roundtrip,context-pool,project-workspace,web}.test.js`），无法先于实现落地或晚于实现遗留 ⇒ 必须与实现同批 |
| 所有改动放一个 PR | 文件范围虽不重叠但违反粒度锚点（可审查性）：11 文件跨 2 进程 + 前端 + 8 个测试文件，reviewer 需 4 次心智模型切换；且丧失阶段 5 的并发派发能力 |
| 按功能卡 1:1 拆 PR（16 个） | 功能点是产品切分、PR 是提交切分；F01/F02/F03 共享同一批文件（`protocol`+`launcher`+`config`+三实现），强行 1:1 必然文件重叠 |

---

## §4 依赖核实（brief 点名的 4 个重点，逐条给代码级证据）

### 4.1 `resolveApproval` 是三实现与 `agent.js` 的共同前置？→ **是，故同批（不写跨 PR 依赖）**

- 三实现**结构上只能从门面拿 spec**：`rpc-client.js:122`（`spawnAgent(PROFILE, {model, roleFile, tools})`）、`acp-client.js:165-169`（`buildArgv('omp:acp', {model, roleFile, tools})`）、`oneshot-client.js:93-97`（自造档位对象）——三处当日都**没有** `spec.approval` 这个输入。
- `spec.approval` 的唯一产出点将是 `protocol.js::createProtocolLayer`（:73-75 的求值点），而 `spec` 由 `agent.js:681-691` 装配。
- 若把 `resolveApproval` 与「三实现消费 + `buildArgv` 收窄」分属两个 PR：**消费侧要求真源存在**（读 `spec.approval`）、**真源要求 `buildArgv` 已收窄**（未给即响亮失败）⇒ 双向硬依赖，**有环**。结论：同批，落 `pr-001`（不写 `depends_on`，因为不是两个 PR 之间的关系）。

### 4.2 提问上浮跨「协议实现 → agent 钩子 → web 信封」三层：三层的**批归属**

- 层 1（协议实现）：`rpc-client.js` 的 `host_tool_call` 承接（现无该 type 分支：`handleFrame` 今日只认 7 类帧）与 `acp-client.js:569-571` 的 `decline` 改写。
- 层 2（agent 钩子）：`context-pool.js:193-196` 的注入判定（今日**只有门钩子**、`deny` 档恒 `null`）→ `agent.js:275-293` 的 `raiseConfirmation`（今日字段集为 7 字段、无 `kind`）。
- 层 3（web 信封）：`web.js:1597-1610` 白名单 + `web.js:1301-1311` 裁决路由。
- 结论：**层 1 + 层 2 同批（`pr-001`）**——依据 `context-pool.js:201-206` 的 `hooks` 对象是两个实现**唯一**的钩子入口，`onQuestionRequest` 不注入则两实现的提问承接永远收不到挂起载体（钩子为 `null`）；**层 3 可独立（`pr-002`）**——见 4.3。

### 4.3 信封 `kind`/`multiple` 的消费面（`web.js` + `app.js`）与生产面（`agent.js`）**是否必须同批**？→ **不必**（可独立、可并发）

证据三条：
1. **消费面自洽且向后兼容**：`web.js:1597-1610` 是逐字段白名单重建条目（`typeof body.kind === 'string' ? … : null` 形态），对**缺 `kind` 的投递按 `'permission'` 兜底**（architecture §5.2 明文），裁决路由另一支（permission 类 `{option_id}`）逐字保留 ⇒ 生产面未合入时 `pr-002` 的新分支为**惰性**，既有 permission 链路零变更（这是「会不会缺另一半而失败」的直接答案：不会）。
2. **消费面可独立验证**：`test/helpers/fake-node.js` 的 `startFakeNode` 能直接向 web 投递任意 `notice`，`test/confirmation-inbox.test.js:175-183` 已有 `ENVELOPE` 工厂 —— 0021 就是用这套注入面把 web 侧做成「`depends_on:（无）`」的独立 PR。
3. **生产面可独立验证**：`pr-001` 的断言面是 agent 进程的 `notice` 信封与 argv（`test/confirmation-roundtrip.test.js` / `test/protocol-layer.test.js`），不读 `web.js` 的白名单。
- 副作用（**已登记，不写成依赖**）：`pr-001` 先合入而 `pr-002` 未合入的中间态下，提问条目在浏览器里会以 `permission` 形态出现且无法正确作答（属**新功能**的半成品，不使既有链路退化）；因此 §6 的派发建议是 `pr-001` 与 `pr-002` 同波并发、`pr-003` 随后。

### 4.4 rpc 自动拒绝三步与 `deny` 档（F03）**是否同批**？→ **是（同一代码位置，不可分）**

- `deny` 档的 rpc 结局**只**经过一条通路：`context-pool.js:193-196` 因 `permission !== 'allow'` 把 `onRequest` 置 `null` ⇒ `hooks.onApproval === null` ⇒ `rpc-client.js:307-312` 的「无收件人」分支。该分支今日只回 `{cancelled:true}`，而 R3/D1 实测证明**该轮照常收尾**、无 `permission_denied` ⇒ F03 验收 3 的 rpc 观测面**今天不存在**。
- 于是「三步」（回执拒绝 + `{type:'abort'}` + `ProtocolError('permission_denied')` 结算）就是 F03 验收 3 的**唯一实现落点**，与 `deny` 档语义是同一件事的两个侧面 ⇒ 必须同批。二者同属 `pr-001`（同一文件，且 `context-pool` 的判定也在此 PR 内）。
- 边界提示（已写入 `pr-001` 验收）：三步只落**「无收件人」分支**；「有收件人但未裁决（`optionId === null`，:331-333）」是否也中止该轮，架构未写 ⇒ 列入 §7-Q3。

### 4.5 其余依赖对（逐对核实，结论 = 无硬依赖）

| 对 | 核实（实读） | 结论 |
|---|---|---|
| `pr-002` ↔ `pr-001` | 见 4.3 | （无） |
| `pr-003` → `pr-002` | `web/app.js:671-681` 将按 `entry.kind`/`entry.multiple` 分化，而这两个字段的唯一产出点是 `web.js:1597-1610`；`web/app.js:717-732` 的 question 提交 body `{option_ids}` 由 `web.js:1301-1311` 校验（今日只认 `option_id`，非法即 400 且条目保留在途）⇒ 缺 `pr-002` 时分支不可达、提交必 400 | **依赖（写）** |
| `pr-003` ↔ `pr-001` | `app.js` 不 import 任何 `src/`；判据用 `pr-002` 的服务端即可构造条目 | （无） |
| 测试面跨 PR | 8 个测试文件的迁移全部由 `pr-001` 的签名变更触发；`test/confirmation-inbox.test.js`（web 注入面）与 `test/inbox-console.test.js`（前端静态契约）与 `pr-001` **零交集**（实读逐个候选文件确认无 `buildArgv` / `PROFILES.approval` 命中） | 无重叠、无依赖 |

**依赖图**：`pr-001 → （无）`；`pr-002 → （无）`；`pr-003 → pr-002`。**无环**（三点一条单向边）。

---

## §5 保证项 F12~F16 的承载与复核方式（可为零代码保证项）

| 卡 | 承载 PR | 复核方式（机械可核） |
|---|---|---|
| **F12** 不改上游 | `pr-001` | `git diff --stat` 不含 `omp/**` 与 harness；六条新通路逐条回指既有实测（A2 `elicitation/create` / R2+R2b `set_host_tools`·`host_tool_call`·`host_tool_result` / R3/R3b `abort` / R4 `yolo` 零门）⇒ 「所需能力均为既有」可核 |
| **F13** 不新增审计面 | `pr-001` | 枚举审计行类型（`TOOL_CALL` / `TOOL_APPROVED` / `TOOL_DENIED`）**无新增**；rpc 拒绝**不补**审批行（复用既有 `ProtocolError` 码值 `permission_denied`，`rpc-client.js:27` 的码值集合逐字不变）；`yolo` 档零审批行由 R4/Y1 实测支撑 |
| **F14** 服务边界不变 | `pr-002` | `grep -n "createServer\|listen" oamp/src/web.js` 命中集合不变；零新监听地址 / 端口 / 鉴权 / 对外接口 |
| **F15** 无历史台账 | `pr-002`（主） + `pr-003`（辅） | `src/inbox.js` 五导出与 `take()` 即删零改动；`GET /api/confirmations` 只出在途项、无已裁决的列表 / 查询参数 / 导出；`src/persist.js` 零改动（沿用 0021 MI-03「只判用户可见面」口径） |
| **F16** 零第三方依赖 | `pr-001` | `oamp/package.json` 的 `dependencies` 仍 `{}`；`test/hygiene.test.js` 绿；前端仍 vanilla（零新 CSS 文件 / 零框架 / 零构建） |

---

## §6 测试面归属（brief 第 4 点）

**受影响既有文件（实读逐文件确认，含具体行）** → 全部归 `pr-001`（签名变更的必然迁移），**新增测试同样归 `pr-001`**（提问回路与档位解析的第一手判定面在 agent 进程）：

| 测试文件 | 受影响原因（实读行号） | 归 |
|---|---|---|
| `test/config-file.test.js` | `loadConfig` 全对象 `deepEqual`（:34-48）新增键必命中 | `pr-001` |
| `test/protocol-layer.test.js` | `buildArgv` 调用（:278、:495-514）+ rpc 无收件人分支期望 | `pr-001` |
| `test/tool-permission.test.js` | `buildArgv('omp:acp')`（:343、:352、:359、:374）与档位断言（:575-595 读 `PROFILES['omp:acp'].approval.mode`） | `pr-001` |
| `test/acp-daemon.test.js` | 档位断言读 profile（:559、:581、:595） | `pr-001` |
| `test/confirmation-roundtrip.test.js` | 一次性档位断言（:716）+ rpc 拒绝分支期望变更 | `pr-001` |
| `test/context-pool.test.js` | `buildArgv` 调用（:540） | `pr-001` |
| `test/project-workspace.test.js` | `buildArgv` 调用（:1013） | `pr-001` |
| `test/web.test.js` | `buildArgv` 调用（:592） | `pr-001` |
| `test/approval-resolution.test.js` | **新建**：`resolveApproval` 解析链与唯一性 | `pr-001` |
| （提问回路） | 复用 `confirmation-roundtrip.test.js` 的 fake-omp 脚手架 + `protocol-layer.test.js` 的单实现层 | `pr-001` |
| `test/confirmation-inbox.test.js` | **新增** question 信封与裁决分化断言（用既有 `startFakeNode` + `ENVELOPE` 体例） | `pr-002` |
| `test/inbox-console.test.js` | **扩展** question 渲染 / 提交契约（`fnBody` + `vm` 体例；含 :379 的手势点计数同步） | `pr-003` |

**零改动的测试面（防夹带）**：`test/{hygiene,zero-intrusion,api-routes,call-protocol,omp-executor,inbox-console(仅 pr-002 面),web,project-workspace 的 route 断言,delivery-contract,notification-scope,...}` 由各 PR 的「零改动」清单逐条列出；`test/helpers/**` 一律零改动（注入面已足够）。

**「零门默认」的判定面**：`yolo` ⇒ argv 无门 / 最低档（`test/protocol-layer.test.js` 与 `test/acp-daemon.test.js` 的 argv 断言迁移后即承载）+ R4/Y1 探针形态（阶段 6 端到端复核）。

---

## §7 验证（阶段 4 完成定义）与疑问

### 7.1 完成定义自查

| # | 判据 | 结论 | 依据 |
|---|---|---|---|
| V1 | 每个 PR 文件满足七字段 | ✅ | 三份文件均含 `## 上下文摘要`（≤200 字）/ `## 涉及功能点` / `## 文件范围` / `## 验收标准`（可独立判断的勾选项）/ `## 参考资料` / `## depends_on` / `## batch` |
| V2 | `prd/` 中 F01~F16 每个功能点至少被一个 PR 引用 | ✅ | F01/F02/F03/F08/F09/F11/F12/F13/F16 → `pr-001`；F04/F05/F07/F10/F14/F15 → `pr-002`；F05/F06/F07/F10/F15 → `pr-003`；并集 = F01~F16（16/16，无遗漏） |
| V3 | PR 间文件范围无重叠 | ✅ | `pr-001`：`src/{protocol,config,launcher,oneshot-client,acp-client,rpc-client,agent,context-pool}.js` + `README.md` + 10 个测试文件；`pr-002`：`src/web.js` + `API.md` + `llms.txt` + `test/confirmation-inbox.test.js`；`pr-003`：`web/app.js` + `web/style.css` + `test/inbox-console.test.js`。三份清单两两交集为空（逐文件核对） |
| V4 | `depends_on` 每条有代码级证据 | ✅ | 唯一一条依赖（`pr-003 → pr-002`）给出两处证据：`web.js:1597-1610`（字段唯一产出点）与 `web.js:1301-1311`（body 校验点）；两条「（无）」也在 `pr-002` / `pr-001` 的 `depends_on` 段写明了核实过程（避免读成「未核实」） |
| V5 | 依赖图无环 | ✅ | 三节点一条边（`pr-003 → pr-002`） |
| V6 | 每个 PR 的验收标准可独立判断 | ✅ | 每条勾选项都给出**本 PR 面内**的判定方式（argv / `notice` 信封字段 / HTTP 响应 / 函数级静态契约 / `vm` 产出）；跨 PR 的端到端判据用「择一判定声明」显式排出（不重复计） |
| V7 | 不做单 PR 内部任务拆解 / 不产出全局 `tasks.md` | ✅ | 三份文件不含任务序号、不含实现步骤；未创建 `tasks.md` |

### 7.2 疑问（**无用户通道 ⇒ 不猜，交主 agent / 实现期裁定；均不影响 PR 边界与依赖图**）

1. **Q1 提问钩子如何到达 `AcpClient`**（架构未定项）：`architecture.md` §3.2 只写「`context-pool.js` 提问钩子透传」与「`acp-client.js` 构造面 +`approval`」，但**未写** acp 实现如何拿到提问钩子——`protocol.js:111-113` 的 acp 分支只转发 `hooks.onExit` / `hooks.onPermissionRequest`（rpc 分支则整体透传 `hooks`，:88）。两种自洽读法：**(a)** 复用既有 `onPermissionRequest` 参数、按 `info.kind` 同形区分（`protocol.js` 零改动）；**(b)** 新增构造参数 `onQuestionRequest` 并在 `protocol.js` 转发（+1 行）。**对 PR 划分无影响**（`protocol.js` 与 `agent.js` 同在 `pr-001`）⇒ 仅需实现期选定，或回架构补一句。
2. **Q2 `buildArgv` 的 `approval` 入参形态**：架构写「入参 = 已解析档位**字符串**（未给 ⇒ 响亮失败）」同时要求「保留 profile 的 `appliesWhen` 形态」（决定工具关时是否追加档位段）。两种读法：**(a)** 入参 = 字符串、`appliesWhen` 仍取 profile；**(b)** 入参 = `{mode, appliesWhen}` 对象。两者对**测试迁移面相同**（所有调用点都必须显式传值）⇒ 不影响 PR 边界，但影响 §9.4 迁移断言的写法与 `pr-001` 验收标准的措辞（现按 (a) 写）。
3. **Q3 rpc 的「有收件人但未裁决」是否也中止该轮**：架构 §9.1 只把三步落在 `handleApproval` 的**「无收件人」**分支（`rpc-client.js:307-312`）。今日「有收件人 + `optionId === null`」（:331-333，如钩子抛错或返回非域内值）同样只回 `{cancelled:true}` 而**轮次照常收尾**。若实现期认为该支也应中止，会改变 F10 验收 1（人裁决后「该轮继续或中止」）的一小部分口径 ⇒ **需架构确认后再落**；本 PR 按架构原文只判「无收件人」分支（`pr-001` 验收标准已如实写明适用范围）。
4. **Q4 `llms.txt` 是否随 `pr-002` 变更**：取决于实现期是否改裁决路由的 `summary` 文案（架构 §9.5 只点名 `API.md`）。`pr-002` 已把 `oamp/llms.txt` 列为**条件性**文件并给出生成方式（`node oamp/scripts/gen-llms-txt.mjs`，不手改）⇒ 无论改不改，漂移锁（`test/api-routes.test.js` 锁②③）都必须保持绿。
5. **Q5 `prd/F13` 的「yolo 档零审批行」判定归属**：R4/Y1 实测已证明，但 `yolo` 与「用户策略例外」（Y2/Y3）的最终端到端复核在阶段 6；`pr-001` 只判「档位 ⇒ argv ⇒ 门是否产生」的管道面，不重复判审计面（避免与 F13 的机械复核重复计判）。

### 7.3 阶段 5 派发建议（**不是依赖，仅供调度参考**）

- **同波并发**：`pr-001` 与 `pr-002`（文件不重叠、互不阻塞、各自的验收面可独立判定）。
- **串行**：`pr-003` 需 `pr-002` 合入（`depends_on` 已写）。
- **端到端（F05 / F07 的完整用户链路、E3/E4/E9 的裸判据）**：三 PR 全合入后由阶段 6 覆盖，不计入任何单 PR 的验收。

---

## §8 未越界声明

本阶段（阶段 4 · 第 1 轮）**唯一写入**为**本工作区内**的绝对路径文件：

- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-001-approval-resolution-and-question-channel.md`（新建）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-002-web-envelope-and-decision-routing.md`（新建）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-003-inbox-question-item-frontend.md`（新建）
- `docs/iterations/0023-yolo-approval-and-question-inbox/clarifications/2026-09-14-pr-planner-round1.md`（本文件，新建）

- **未修改** `architecture.md`、`prd.md`、`prd/F01~F16*.md`、`demand.md`、`status.md`、`history.md`、既有 `clarifications/*.md`、`clarifications/probes/**`（全部只读）；
- **未触碰** `oamp/**`（只读实读：`src/`、`web/`、`test/`、`package.json`、`README.md`、`API.md`、`llms.txt`、`scripts/`）、`omp` 安装包、`roles/**`、`docs/iterations/0021-*` 与 `0022-*`（只读体例参照）；
- **未执行**任何 git 写操作（未建分支 / 未建 worktree / 未 add / 未 commit）；**未运行**任何测试、构建、格式化或服务（阶段 5/6 职责）；
- **未产出**全局 `tasks.md`，**未做**单 PR 内部的任务拆解（那是 planner 在实现阶段的职责）；
- **未做**架构或产品决策：§7.2 的三条疑问一律列为待裁定，不自行选边；未改写任何 L1 / L2 决策结论。
