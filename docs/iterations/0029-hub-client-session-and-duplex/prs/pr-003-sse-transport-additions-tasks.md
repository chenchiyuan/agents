# pr-003-tasks.md — pr-003 内部任务列表（SSE 传输补线：过滤订阅注册表 / 调用关流原语）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-003-sse-transport-additions.md`
**PR worktree 分支**: `feat/0029-pr-003-sse-transport-additions`（base = `72b659f`，= 迭代分支 tip，落盘时零 diff）｜ **任务总数**: **6**（T1~T6）｜ **依赖图**: **无环**（见 §2）
**性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（9 条验收标准 / 2 个功能点 F03·F09）+ `architecture.md`（§1.3 事实 F-3/F-4、§2 组件 3、§3.3、§3.5 第 1 条、§4 A-03/A-08、§5.5 transport.js 行、§6.1 Z-1、§6.2 S-9、§8 剃刀论证）+ `prd/{F03,F09}*.md` + `prs/pr-005-web-session-and-call-surface.md`（**下游消费面**）+ 代码库实读（§0.3 逐条带 `文件:行号`）

> **本 PR 无任何可执行入口**：订阅路由的注册与三个既有发布点的**调用点**、`publishCallResult` 的终态关流调用点都归 **pr-005**（PR 文件明文"本 PR 只提供能力"）⇒ **全部验收以模块级一次性脚本（mock `res`）+ `grep` + 与 base 版逐条对照判定**，**不新增测试文件**（PR 文件范围不含测试面；本仓无 `.test.js`，A12）。

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/transport.js` | 改（**只追加**，3 处） | 并行过滤注册表 + `handleSubscribe`（**T1**）；心搏覆盖面（**T2**）；`publishFiltered` 投递钩子（**T1**）；`closeCallSubscriptions`（**T3**）；返回对象追加 3 键（**T1/T3**） |
| 2 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md` | 改（仅「验收证据」段） | 取证输出回填（**T6**） |

> 本文件 `prs/pr-003-sse-transport-additions-tasks.md` 是本阶段产物，不计入改动面（与 PR 文件同目录，随 PR 分支提交）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动**（PR 文件「不触碰」+ 本 PR 语义边界）：`oamp/src/web.js`（订阅路由注册、三个发布点的投喂、`publishCallResult` 的关流调用点全部归 pr-005）、`oamp/web/calls.js`（控制台适配归 pr-004）、`oamp/src/router.js` / `registry.js` / `sdk/**` / `bin/**` / `package.json` / `API.md` / `llms.txt` / `skill/hub.md` / `web/**`、`roles/**`、`docs/**`（除 PR 文件与本文件）。
- **不新增**：依赖、配置键、env 键、模块级 import（A1：本文件**零 import**，须保持）、**新的关闭实现**（复用 `closeKey`，A6）、事件名（新面的事件词汇表归 pr-005 的谓词）、路由、测试文件、第三份注册表、额外的 `closeAll` 语义。
- **不改既有源文一行**（`§6.1 Z-1` 明文："既有发布点与既有帧构造**一行不改**"）：`subscribe` / `handle` / `publishTo` / `publish` / `publishGlobal` / `publishCall` / `publishChatCall` / `globalCount` / `closeKey` / `close` / `closeAll` / `handleCallStream` / `handleChatCallStream` 的函数体**零字符改动**（T2 只改心搏两函数，它们在 Z-1 的"发布点/帧构造"之外，且其既有可观测行为保持，见 §0.4 契约 7）。
- **不做**（F03/F09 边界）：回放 / 持久事件日志 / 投递保证、缓存 / 排队 / 补发、第二订阅形态（F04，D-16 出本期）、鉴权与配额、终态关流的"关流即状态变更"、对话作用域（`chat-calls:`）的终态关流与补发。

### 0.3 读码事实锚点（2026-09-16 实读，base `72b659f`；判据基础）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | 本模块**零 import**（文件头第 4 行逐字"本模块零 import"）；全部状态 = 闭包内 `subscribers` Map + `heartbeatTimer` | `oamp/src/transport.js:1-4`、`:21-22` |
| **A2** | 键空间常量与全局键：`chatKey` / `callKey` / `chatCallsKey`（三前缀互不为前缀）；全局键 = `null`（`chatKeyOrGlobal`） | `:15-17`、`:25` |
| **A3** | `subscribe(req, res, key)` 内核：`res.writeHead(200, {content-type:'text/event-stream; charset=utf-8', cache-control:'no-store', connection:'keep-alive'})` → 注册进 `subscribers` → 写首帧 `retry: ${RETRY_MS}\n\n` → `res.on('close', …)` 清理（set 空且仍是本 set ⇒ 删键 + `stopHeartbeatIfIdle()`）→ `startHeartbeat()`。**不写任何初始数据帧**；`req` 在函数体内**未被使用**（断开清理走 `res` 的 `'close'`） | `:45-66` |
| **A4** | `publishTo(key, event)`：`subscribers.get(key)` 为 `undefined` ⇒ **直接 return**（无订阅者即丢）；帧 = `` `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n` `` | `:85-90` |
| **A5** | `publishCall(callId, event)` 一次写**两个键**：`call:<id>` 与 `chat-calls:<event.data.chat_id>` | `:103-107` |
| **A6** | `closeKey(key)` = 既有**唯一**关闭实现：`subscribers.delete(key)` → `for (const res of [...set]) res.end()` → `stopHeartbeatIfIdle()`。`close(chatId)` 与 `closeAll()` 都经它 | `:120-126`、`:129-136` |
| **A7** | `globalCount()` 只读 `subscribers.get(null)`（"仅在有全局订阅者时轮询"的唯一判据） | `:114-117` |
| **A8** | 心搏：`startHeartbeat()` = `setInterval(…, heartbeatMs)` + `heartbeatTimer.unref()`；`stopHeartbeatIfIdle()` = `if (heartbeatTimer === null \|\| subscribers.size > 0) return;` ⇒ 早退条件只数**既有注册表** | `:27-35`、`:37-41` |
| **A9** | 常量：`DEFAULT_HEARTBEAT_MS = 15000`、`RETRY_MS = 1000` | `:11-12` |
| **A10** | 返回对象（`createSseTransport()` 的 11 个键）：`kind / handle / publish / publishGlobal / globalCount / close / closeAll / handleCallStream / publishCall / handleChatCallStream / publishChatCall`；模块级导出仅 `createSseTransport` 一个 ⇒ **既有导出名共 12 个**（PR 文件 AC1 写的"13 个"是笔误，见 §7 疑问 1） | `:138-141`、`:19` |
| **A11** | 下游消费面（**接缝证据**）：pr-005 明文"按**合并后的实际导出面**接线"，且其三个既有发布点（`publishMessage` / `publishState` / `publishCall`）投喂过滤订阅注册表、`closeCallSubscriptions` 由其在 `publishCallResult` 内调用 | `prs/pr-005-web-session-and-call-surface.md:35`、`:152` |
| **A12** | 本仓**无任何 `.test.js`**（0 个）；`tests/` 仅两个 shell 脚本 ⇒ 验收只能靠一次性脚本，且**无既有 mock `res` 先例可抄**（自助 mock 见 §4.2） | 实测 |
| **A13** | `architecture §6.1 Z-1` 逐字："既有发布点与既有帧构造**一行不改**（新面的投递挂在发布之后的同一钩子里）"；`§5.5` 对本文件的改动面 = "+`closeCallSubscriptions(callId)`；+新订阅注册表（含过滤谓词）与其投递钩子"（**两项**，无第三项） | `architecture.md` §6.1 Z-1、§5.5 |
| **A14** | `architecture §4 A-03` 第 8 条：新面用**独立的订阅注册表**（不占用既有四个键空间）⇒ 存在与断开不影响既有订阅者与事件投递；第 4 条：`kinds` / `agents` 均**可选**（都不给 ⇒ 不受过滤） | `architecture.md` §4 A-03 |

### 0.4 本 PR 内冻结契约（每个任务都必须遵守；跨 PR 接缝在此一次定死）

1. **导出面只追加 3 键**〔追溯：PR 验收 1；A10/A11〕：`createSseTransport()` 返回对象**追加**恰好 `handleSubscribe`、`publishFiltered`、`closeCallSubscriptions` 三键；模块级导出仍**只有** `createSseTransport`。既有 12 个导出名（A10）的**签名与行为逐字不变**。**禁止**为方便调试追加 `filteredCount` / `closeAllFiltered` 一类入口（PR 文件"只追加"+ 剃刀；`closeAll` 语义见契约 6）。
2. **新注册表的形态**〔追溯：PR 上下文摘要①②；architecture §2 组件 3、§4 A-03 第 8 条〕：在 `createSseTransport` **闭包内**新增 `const filteredSubscribers = new Set()`（元素 = `{res, predicate}`），**不进 `subscribers` Map、不构造任何键** ⇒ "不占用既有四个键空间"由**结构**保证，不靠命名约定。
3. **`handleSubscribe(req, res, { predicate })`**〔追溯：PR 验收 4/7；A3/A14〕：与既有 `subscribe` 内核**同一套建立语义**——同样的 `writeHead(200, …)` 三头、同样的首帧 `retry: ${RETRY_MS}\n\n`、`res.on('close')` 断开即清理、`startHeartbeat()`；**订阅建立不写任何初始数据帧**。`predicate` **缺省或非函数 ⇒ 恒真（该订阅不受过滤）**〔口径见 §6 MI-P2；依据 A-03 第 4 条：过滤参数均可选〕。
4. **`publishFiltered(event)`**〔追溯：PR 验收 4/5；A4/A13〕：遍历 `filteredSubscribers`，对 `predicate(event)` 为真值者写**一帧**；事件对象形态与 `publishTo` 收到的**同一个**（`{type, data}`）；帧字符串与 `publishTo` **逐字同形**（同一模板字面量，`event: …\ndata: JSON\n\n`）。**`publishTo` 与既有帧构造一行不改**（A13）；无订阅者 / 无匹配 ⇒ **纯无操作**（不建键、不缓存、不排队、不补发、不抛错）。
5. **`closeCallSubscriptions(callId)`**〔追溯：PR 验收 2；architecture §4 A-08〕：函数体 = `closeKey(callKey(callId))`（**唯一**关落实现在既有 `closeKey`，不新增第二套关闭路径、不直接碰 `res.end()`）；影响面**仅** `call:<callId>`；`chat-calls:<chatId>` 与 `chat:<chatId>` 的订阅者**不受影响**。
6. **既有面零改动（含 `closeAll`）**〔追溯：PR 验收 1/3/6；A6/A13〕：`closeKey` / `close` / `closeAll` / `subscribe` / `handle*` / `publish*` / `globalCount` 的**函数体零字符改动**；`closeAll()` **不触碰新注册表**（⇒ PR 验收 6"反之，既有面全断开也不影响新注册表"由结构满足，且其"覆盖三个键空间"的既有语义不被改写）。新注册表的清理**只**经 `res.on('close')`（客户端断开）——本 PR 不新增批量关闭入口。
7. **心搏覆盖面**〔追溯：PR 验收 3/7；A8〕：`startHeartbeat()` 的定时回调整体改为**对两个注册表的订阅者各写一次** `': keepalive\n\n'`；`stopHeartbeatIfIdle()` 的自停条件 = **两个注册表都空**（即既有 `subscribers.size > 0` 早退条件改为两个集合合计 > 0）；`heartbeatTimer.unref()`、`DEFAULT_HEARTBEAT_MS = 15000`、`RETRY_MS = 1000` 不变；`heartbeatMs` 构造参数不变。⇒ 既有订阅者的可观测行为（15s keepalive、无订阅者时自停）**逐字不变**〔覆盖面口径见 §6 MI-P1〕。
8. **零 import 不变**〔追溯：PR 验收 9；A1〕：本文件**不新增任何 import**（不 import `web.js`，也不引入新依赖）；`package.json` 零 diff。
9. **验证载体**〔追溯：PR「验收证据」段〕：mock `res`（自助，A12）驱动四键空间投递/关闭断言；**与 base 版逐条对照**（base 副本取自 `git show 72b659f:oamp/src/transport.js`，见 §4.4）——对照是"既有行为逐字不变"的判据，不是快照约定。

### 0.5 PR 验收标准 → 任务映射（9 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | 导出面**只追加**，既有导出键（PR 原文列 11 名 + `createSseTransport`）签名与行为逐字不变 | **T1/T3**（追加）+ **T5**（逐条对照） |
| AC2 | `closeCallSubscriptions(callId)` 只关 `call:<id>`；`chat-calls:` / `chat:` 订阅者仍在且后续事件照常到达；`closeKey` 为唯一关闭实现 | **T3** |
| AC3 | 既有"订阅者断开 ⇒ 清理订阅"路径未被改写；心搏在全部订阅者清空后自停（`stopHeartbeatIfIdle`）行为不变 | **T2**（心搏）+ **T4**（断开清理） |
| AC4 | 新注册表过滤投递：只要 `agent_online` 的订阅者收不到 `call_state` / `chat_state`；`kinds` 与 `agents` 同时给出为 AND | **T1** |
| AC5 | 新注册表**不缓存 / 不排队 / 不补发**：无订阅者时投递为无操作、零错误、零内存增长 | **T1** + **T4** |
| AC6 | 隔离性双向：新面断开不影响 `globalCount()` 与既有键空间；既有面全断开不影响新注册表 | **T4** |
| AC7 | 新订阅者沿用既有 SSE 建立语义（同头 / `retry: 1000` / 15s keepalive）；订阅建立不发初始数据帧 | **T1**（头 + 首帧 + 无初始帧）+ **T2**（keepalive） |
| AC8 | 一次性脚本按既有四个键空间逐条断言投递集合与关闭行为，**与改动前一致** | **T5** |
| AC9 | 零新增依赖；本模块仍不 import `oamp/src/web.js`（不产生依赖环） | **T5** + **T6**（diff 封闭性） |

---

## 1. 任务列表

### T1: `oamp/src/transport.js` —— 并行过滤注册表 + `handleSubscribe` + `publishFiltered`

- **服务哪条 AC**: AC4、AC5（投递侧）、AC7（头 / 首帧 / 无初始帧）、AC1（追加 2 键）
- **描述**: 在闭包内新增 `filteredSubscribers` Set 与两个函数：`handleSubscribe(req, res, {predicate})`（建立语义与既有 `subscribe` 内核逐条同形，但不进 `subscribers`）+ `publishFiltered(event)`（按谓词过滤写同形帧）；返回对象追加这两键。
- **文件/锚点**: `oamp/src/transport.js:21-22`（闭包状态区，新增 `filteredSubscribers`）；`:45-66`（**照抄**建立语义，不修改原 `subscribe`）；`:85-90`（帧模板的来源，**不改动**该函数）；`:138-141`（返回对象追加）。
- **步骤**: ① 加 Set；② `handleSubscribe`；③ `publishFiltered`；④ 返回对象追加两键；⑤ 头注补一行为新面（说明独立注册表与投递钩子）。
- **验收判据（可执行；mock `res` 全套见 §4.2）**:
  1. **AC1 追加面**：`Object.keys(createSseTransport({}))` ⊇ 既有 11 键，且差集**恰为** `{handleSubscribe, publishFiltered, closeCallSubscriptions}`（T1 完成时暂为前两键，T3 后闭合）。
  2. **AC7 建立语义**：对 mock `res` 调 `handleSubscribe(req, res, {predicate})` ⇒ ① `writeHead` 收到 `200` 与三头（`content-type: 'text/event-stream; charset=utf-8'`、`cache-control: 'no-store'`、`connection: 'keep-alive'`）；② `chunks` **恰为** `['retry: 1000\n\n']`（**零初始数据帧**）。
  3. **AC4 过滤投递**：注册三个订阅者，谓词分别为「只收 `agent_online`」「只收 `call_state`」「只收 `agent_online` **且** `data.instance_id === 'ag-1'`」；依次 `publishFiltered({type:'agent_online', data:{instance_id:'ag-1'}})`、`publishFiltered({type:'agent_online', data:{instance_id:'ag-2'}})`、`publishFiltered({type:'call_state', data:{agent:'x'}})`、`publishFiltered({type:'chat_state', data:{}})` ⇒ 逐订阅者断言收到的 `type` 序列：① `['agent_online','agent_online']`；② `['call_state']`；③ `['agent_online']`（AND 语义：`agent_online` 且 `ag-1`）；三者的 `chunks` 中**均不含** `call_state`/`chat_state` 的越界帧（前者与后者互为对照）。
  4. **AC4 帧形状**：收到帧的字符串与既有 `publishTo` 同形 —— 断言 `chunks` 含 `` `event: agent_online\ndata: {"instance_id":"ag-1"}\n\n` ``（逐字符相等）。
  5. **AC5 无订阅者即丢**：`publishFiltered` 在**零新订阅者**时调用 1000 次（含各类 type）⇒ **不抛错**；随后 `handleSubscribe` 的新订阅者的 `chunks` **仍只有** `retry` 首帧（**无历史帧** ⇒ 未缓存、未排队、未补发）。
  6. **AC5 断开即移除**：对某订阅者 `res.clientAbort()`（见 §4.2）后再 `publishFiltered` ⇒ 该 `res` 的 `chunks` **不再增长**（不产生对已断开连接的写入）。
  7. **既有面不受影响（T1 侧自检）**：同样的事件走既有 `publishGlobal` / `publish` / `publishCall` / `publishChatCall` ⇒ **新注册表订阅者一律收不到**（新面只由显式 `publishFiltered` 投喂，A13 的"投递钩子"语义）。
- **前置依赖**: 无
- **优先级**: P0

---

### T2: `oamp/src/transport.js` —— 心搏覆盖两个注册表

- **服务哪条 AC**: AC7（15s keepalive）、AC3（`stopHeartbeatIfIdle` 行为）
- **描述**: `startHeartbeat()` 的定时回调改为对两个注册表各写一次 keepalive；`stopHeartbeatIfIdle()` 的自停条件改为"两个注册表合计为空"。
- **文件/锚点**: `oamp/src/transport.js:27-35`（`startHeartbeat` 内的 for 循环）；`:37-41`（`stopHeartbeatIfIdle` 的早退条件）；常量 `:11-12` **不改**。
- **步骤**: ① 提取一次 keepalive 遍历（既有 map + 新 set，同一次 tick）；② 改自停条件；③ 注释说明覆盖面（含"既有面行为不变"的依据）。
- **验收判据（可执行；定时器观测用 §4.3 的全局 `setInterval`/`clearInterval` 计数器 + 小 `heartbeatMs`）**:
  1. **AC7 新面收 keepalive**：`createSseTransport({heartbeatMs: 20})` + 一个新面订阅者 ⇒ 约 60ms 内其 `chunks` 出现 `': keepalive\n\n'`（**既有订阅者与新增订阅者各得到一份**，互不替代）。
  2. **AC7 两表并列**：同时存在 1 个既有订阅者（`handle(req,res,{chatId:'c1'})`）与 1 个新面订阅者 ⇒ 60ms 内**两者**都出现 keepalive 行。
  3. **AC3 自停**：① 只挂既有订阅者 ⇒ `clientAbort` 后 `clearInterval` 计数 +1（timer 停）；② 只挂新面订阅者 ⇒ `clientAbort` 后 `clearInterval` +1；③ 两表各有订阅者，仅新面断开 ⇒ **不**触发 `clearInterval`（timer 仍在），随后既有面断开 ⇒ 触发。
  4. **AC3 既有语义不变**：仅既有订阅者的路径上，`started === cleared`（无 timer 泄漏）且 keepalive 行内容为 `': keepalive\n\n'`（逐字符）。
  5. **常量不变**：`grep -n 'DEFAULT_HEARTBEAT_MS = 15000\|RETRY_MS = 1000' oamp/src/transport.js` ⇒ 两行原样存在。
- **前置依赖**: T1（keepalive 要对新注册表写，先有其注册表）
- **优先级**: P0

---

### T3: `oamp/src/transport.js` —— `closeCallSubscriptions(callId)`

- **服务哪条 AC**: AC2、AC1（追加第 3 键）
- **描述**: 新增 `closeCallSubscriptions(callId)`（函数体 = `closeKey(callKey(callId))`）并追加进返回对象。
- **文件/锚点**: `oamp/src/transport.js:120-126`（`closeKey` = 唯一关闭实现）；`:129-132`（`close(chatId)` 同款体例可对照）；`:138-141`（返回对象追加）。
- **步骤**: ① 加函数（紧邻 `close`/`closeAll`）；② 返回对象追加；③ 注释标注"事实 F-3 的 0 调用点在此补上"（调用点归 pr-005）。
- **验收判据（可执行；mock `res`）**:
  1. **AC2 只关 `call:<id>`（对照实验）**：对同一 transport 建立 4 类订阅者 —— `call:c1`、`chat-calls:ch1`、`chat:ch1`、全局（`handle(req,res,{chatId:null})`）；调 `closeCallSubscriptions('c1')` ⇒ **只有** `call:c1` 的 `res.end()` 被调用（其 `closed === true`），另三者 `closed === false`。
  2. **AC2 后续事件照常到达**：关闭后 `publishChatCall('ch1', {type:'call_update', data:{}})` ⇒ `chat-calls:ch1` 订阅者收到该帧；`publish('ch1', …)` ⇒ `chat:ch1` 收到；`publishGlobal(…)` ⇒ 全局订阅者收到（**"仍在"= alive 且可继续收帧**）。
  3. **AC2 幂等/不存在**：对不存在的 `call_id` 调 `closeCallSubscriptions('never')` ⇒ 不抛错、无副作用（其余订阅者不受影响）。
  4. **AC2 唯一关闭实现**：`grep -c 'res.end()' oamp/src/transport.js` = **1**（仅 `closeKey` 内那一处；新函数不得自己调 `res.end()`）——原始输出进证据。
  5. **AC1 追加面闭合**：`Object.keys(createSseTransport({}))` 的差集**恰为** `{handleSubscribe, publishFiltered, closeCallSubscriptions}`。
- **前置依赖**: 无（代码面独立于 T1/T2；同文件施工顺序见 §3）
- **优先级**: P0

---

### T4: 隔离性与生命周期断言（双向隔离 / 断开清理不变 / 零增长）

- **服务哪条 AC**: AC6、AC5（零增长侧）、AC3（断开清理路径）
- **描述**: 用一套 mock 场景断言两面互不干扰、既有断开清理路径未被改写、新面无累积。
- **文件/锚点**: 零源码改动（只驱动两个注册表；脚本见 §4.2）。
- **步骤**: ① 双向隔离场景；② 断开清理场景；③ 累积性场景。
- **验收判据（可执行）**:
  1. **AC6 方向一（新 ⇒ 既有）**：既有面挂 1 个全局订阅者 + 1 个 `chat:c1` 订阅者；新面挂 2 个；对全部新面订阅者 `clientAbort()` ⇒ `globalCount()` **仍为 1**（未变），既有两个订阅者仍能收到后续 `publishGlobal` / `publish` 帧。
  2. **AC6 方向二（既有 ⇒ 新）**：随后对既有面执行 `close('c1')`、`closeCallSubscriptions('c1')`、`closeAll()` 三种"全断开"动作（逐个场景重建 transport）⇒ 新面订阅者 `closed === false` 且仍能收到 `publishFiltered` 的匹配帧（**`closeAll` 不触碰新注册表**，契约 6）。
  3. **AC3 断开清理未改写**：客户端断开（`clientAbort`）后，既有键空间的订阅者数下降（再 `publish` 该键 ⇒ 该 `res` 不再增长）；且 `closeKey` 已删键后再断开不报错（既有"只清仍是本 set 的登记"逻辑）；`git diff` 中 `subscribe`（`:45-66`）函数体**零改动**。
  4. **AC5 零增长**：新面注册 → 断开 → 重复 200 轮，每轮结束时的可见状态一致（每轮新订阅者 `chunks` 只有 `retry` 首帧；且 200 轮后再次 `publishFiltered` 只投给当前存活者）——即"无累积、无残留订阅"的可观测判据〔口径见 §6 MI-P3〕。
- **前置依赖**: T1（新注册表）、T3（"既有面全断开"场景用到 `closeCallSubscriptions`）
- **优先级**: P0

---

### T5: 与 base 版逐条对照（导出面 / 四键空间投递与关闭行为）+ 零依赖核查

- **服务哪条 AC**: AC8、AC1、AC9
- **描述**: 用**同一份探针脚本**分别驱动「base 版副本」与「改动后文件」，输出规范 JSON 并 `diff`；再核对导出面差集与零依赖面。
- **文件/锚点**: 零源码改动；base 副本来自 `git -C <worktree> show 72b659f:oamp/src/transport.js`（写入 `/tmp/transport-base.mjs`）。
- **步骤**: ① 导出 base 副本；② 跑 §4.4 探针（只用既有 API，两个版本都能跑）；③ `diff` 两份 JSON；④ 跑导出面与零依赖 grep。
- **验收判据（可执行）**:
  1. **AC8 四键空间投递集合**：探针覆盖 —— `publishGlobal` → 只有全局键；`publish('c1')` → 只有 `chat:c1`；`publishCall('c1', {data:{chat_id:'ch1'}})` → `call:c1` **与** `chat-calls:ch1` 两处；`publishChatCall('ch1')` → 只有 `chat-calls:ch1`；`close('c1')` → 只关 `chat:c1`；`closeAll()` → 关全部既有键；`globalCount()` 在 0/1/2 个全局订阅者下的取值。⇒ 两份 JSON **逐字节相同**（`diff` 退出 0）。
  2. **AC1 导出面**：base 的 11 个对象键 + `createSseTransport` 在改动后**全部存在**；`Object.keys` 差集**恰为** 3 个新键；`typeof` 逐键相同（函数/字符串）。
  3. **AC9 零依赖**：`git diff 72b659f HEAD -- oamp/package.json` ⇒ 空；`grep -c '^import' oamp/src/transport.js` = **0**；`grep -c "from './web.js'\|from '../src/web.js'" oamp/src/transport.js` = **0**。
  4. **零外溢**：`git diff --name-status 72b659f HEAD -- oamp/` ⇒ **恰好一行且为 `M`**（`oamp/src/transport.js`；不得出现 `web.js` 或任何其它文件的改动）。
- **前置依赖**: T1、T2、T3、T4
- **优先级**: P1（**P1 ≠ 可选**：AC 未全过不算本 PR 完成）

---

### T6: 验收证据落盘（PR 文件「验收证据」段）

- **服务哪条 AC**: 全部 9 条的**证据载体**齐备（AC1~AC9 逐条可指）
- **描述**: 把 T1~T5 的原始输出按 PR 文件「验收证据」段要求回填。
- **文件/锚点**: `prs/pr-003-sse-transport-additions.md` 的 **「验收证据」** 段（只改该段，**不改七字段**）。
- **步骤**: ① 汇总原始输出（`/tmp/pr003-*.out`）；② 逐条粘贴，不做二次加工；③ 自查 AC1~AC9 的对应关系。
- **验收判据（可执行）**:
  1. 「验收证据」段含 PR 文件原文列举的**全部**载体：mock `res` 的四键空间投递/关闭断言输出 + `closeCallSubscriptions` 的"只关 `call:`"对照输出 + 新注册表过滤与"无订阅者即丢"的判据输出 + 导出面对比 + import 行检查。
  2. AC1~AC9 每条都能在该段指到对应的一条原始输出（缺一即 T6 未完成）。
  3. `git status --short` 除 PR 文件（证据段）与本 tasks 文件外**无其它改动**。
- **前置依赖**: T5
- **优先级**: P1

---

## 2. 依赖图

```
T3 ──┐
     ├──> T4 ──┐
T1 ──┴────────┴──> T5 ──> T6
     └──> T2 ──> T5
```

边（逐条，均为真实约束；共 8 条）：
- `T1 → T2`：keepalive 的覆盖面只能对**已存在**的新注册表写（T1 建立 Set 与 `handleSubscribe`）。
- `T1 → T4`、`T3 → T4`：T4 的双向隔离与"既有面全断开不影响新面"场景同时驱动新注册表（T1）与 `closeCallSubscriptions`（T3）。
- `T1 → T5`、`T2 → T5`、`T3 → T5`、`T4 → T5`：与 base 的逐条对照覆盖**完整**改动面（少了任一函数，导出面差集与行为对照都不完整）。
- `T5 → T6`：证据落盘需要 T5 的对照输出。

**无环**：存在拓扑序 `T1 < T2 < T5 < T6`、`T3 < T4 < T5 < T6` 同时满足全部边方向，不存在回到已访问节点的路径。

**最长依赖链（本 PR 内部任务图的关键路径，4 节点）**：`T1 → T2 → T5 → T6`（另两条等长链 `T1 → T4 → T5 → T6`、`T3 → T4 → T5 → T6`）。
**关键路径任务**：**T1**（新注册表与投递钩子，是 T2/T4/T5 的前置）→ **T2** → **T5**（"既有行为逐字不变"的唯一判据点）→ **T6**。

---

## 3. 执行顺序（dev 单次调用 ≤ 30 分钟上限制下的增量策略，见 DC-06/DC-08）

**顺序**：`T1 → T2 → T3 → T4 → T5 → T6`（T1/T2/T3 同属 `transport.js`，**连续施工**避免交错改同一文件；这不新增依赖边——T3 与 T1/T2 无数据依赖）。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立落盘）：
| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | 新注册表 + `handleSubscribe` + `publishFiltered`（返回对象 +2 键） | §T1 判据 1~3、5~7（mock res 脚本，无需起进程） |
| 2 | 心搏覆盖面（两表） | §T2 判据 1~5（定时器计数器） |
| 3 | `closeCallSubscriptions`（返回对象 +1 键，追加面闭合） | §T3 判据 1~5 |
| 4 | 隔离性与生命周期断言输出 | §T4 判据 1~4 |
| 5 | 与 base 的逐条对照 JSON + diff | §T5 判据 1~4 |
| 6 | PR 文件「验收证据」段落盘 | §T6 判据 1~3 |

**若单次调用未跑完**：按上表在**任务边界**停下（`handleSubscribe` 与 `publishFiltered` 必须**同一次**交付——只有其一则导出面差集与过滤投递判据都不成立）；已完成任务的判据输出即为本次调用的增量证据。

---

## 4. 验证配方（**禁止新增测试文件**；全部为一次性脚本 + `grep` + 与 base 对照，A12）

工作目录 = PR worktree 根；脚本落 `/tmp/`（**不进仓库**）。

### 4.1 导出面（T1/T3/T5 判据）

```bash
node --input-type=module -e '
const m = await import(`file://${process.cwd()}/oamp/src/transport.js`);
const t = m.createSseTransport({});
console.log("module exports:", Object.keys(m).sort().join(","));
console.log("transport keys:", Object.keys(t).sort().join(","));
'
git -C <PR worktree 根> show 72b659f:oamp/src/transport.js > /tmp/transport-base.mjs   # 对照用 base 副本
```

### 4.2 mock `res`（A12：无既有先例，自助；语义对齐 Node 的 `res`）

```js
// /tmp/mock-res.mjs
export function mockRes() {
  const closeHandlers = [];
  const res = {
    chunks: [],
    closed: false,
    status: null,
    headers: null,
    writeHead(status, headers) { res.status = status; res.headers = headers; },
    write(s) { res.chunks.push(s); return true; },
    // Node 语义：end() 之后 'close' 会触发
    end() { if (!res.closed) { res.closed = true; closeHandlers.forEach((h) => h()); } },
    on(evt, cb) { if (evt === 'close') closeHandlers.push(cb); },
    // 客户端异常断开：连接终止（'close' 触发，但不经 end）
    clientAbort() { if (!res.closed) { res.closed = true; closeHandlers.forEach((h) => h()); } },
  };
  return res;
}
export const frames = (res) => res.chunks.filter((c) => c.startsWith('event:'));
export const typesOf = (res) => frames(res).map((c) => c.slice(7, c.indexOf('\n')));
```

> `req` 参数贴任意对象即可（A3：既有内核不读 `req`，断开清理走 `res` 的 `'close'`）。

### 4.3 定时器观测（T2 判据）——在 import 影响模块**之前**打桩

**本节脚本已在计划期对 base 版（`72b659f` 的 `transport.js`）实跑通过**，输出形态即下面的期望基线；两条已验证的坑必须遵守：
- ① 等待函数**必须用真 `setInterval` 且不 `unref`**——transport 自己的定时器是 `unref()` 过的（A8），若等待也 unref，Node 会立刻无活动句柄退出，顶层 `await` 悬空（实测退出码 13 `Unsettled top-level await`）；
- ② 脚本结尾加 `process.exit(0)`（脚本自身不持有其它活动句柄）。

```js
const realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
globalThis.__timers = { started: 0, cleared: 0 };
globalThis.setInterval = (...a) => { globalThis.__timers.started += 1; return realSet(...a); };
globalThis.clearInterval = (t) => { globalThis.__timers.cleared += 1; return realClear(t); };
const { createSseTransport } = await import(`file://${process.cwd()}/oamp/src/transport.js`);
const { mockRes } = await import('/tmp/mock-res.mjs');
const sleep = (ms) => new Promise((r) => realSet(r, ms));          // 不打桩等待、不 unref（见坑①）
const ka = (res) => res.chunks.filter((c) => c === ': keepalive\n\n').length;
const t = createSseTransport({ heartbeatMs: 20 });                 // 既有构造参数，非新配置键

// ① 既有订阅者：keepalive 到达（基线实测：~70ms 内 3 次）
const a = mockRes(); t.handle({}, a, { chatId: 'c1' });
await sleep(70);
console.log('existing keepalives:', ka(a), '| timers:', JSON.stringify(globalThis.__timers));

// ② 新面订阅者：keepalive 到达（T1/T2 的新能力；base 版此处无该 API ⇒ 只对改动后跑）
// const b = mockRes(); t.handleSubscribe({}, b, { predicate: () => true }); await sleep(70);
// console.log('filtered keepalives:', ka(b));

// ③ 自停：最后一个订阅者断开 ⇒ clearInterval +1（基线实测 {started:1, cleared:1}）
a.clientAbort();
await sleep(40);
console.log('after abort:', JSON.stringify(globalThis.__timers));

// ④ 重启：再订阅 ⇒ started 再次 +1 且新订阅者拿到 keepalive
const c = mockRes(); t.handle({}, c, { chatId: 'c2' });
await sleep(70);
console.log('restart:', JSON.stringify(globalThis.__timers), '| keepalives c:', ka(c));
process.exit(0);                                                    // 见坑②
```

### 4.4 与 base 的逐条对照探针（T5 判据 1；**只用既有 API**，两版都能跑）

```js
// /tmp/transport-probe.mjs  用法：node transport-probe.mjs <模块路径>
const mod = await import(process.argv[2]);
const { mockRes, typesOf } = await import('/tmp/mock-res.mjs');
const t = mod.createSseTransport({});
const g = mockRes(), c1 = mockRes(), cb = mockRes(), cc = mockRes();
t.handle({}, g, { chatId: null });          // 全局键
t.handle({}, c1, { chatId: 'c1' });         // chat:c1
t.handleCallStream({}, cb, { callId: 'c1' });// call:c1
t.handleChatCallStream({}, cc, { chatId: 'ch1' }); // chat-calls:ch1
t.publishGlobal({ type: 'agent_online', data: {} });
t.publish('c1', { type: 'chat_state', data: {} });
t.publishCall('c1', { type: 'call_state', data: { chat_id: 'ch1' } });
t.publishChatCall('ch1', { type: 'call_update', data: {} });
const out = {
  global: typesOf(g), chat_c1: typesOf(c1), call_c1: typesOf(cb), chatcalls_ch1: typesOf(cc),
  globalCount: t.globalCount(),
  closed_before: [g, c1, cb, cc].map((r) => r.closed),
};
t.close('c1');
out.closed_after_close_chat = [g, c1, cb, cc].map((r) => r.closed);
t.closeAll();
out.closed_after_closeAll = [g, c1, cb, cc].map((r) => r.closed);
out.globalCount_after = t.globalCount();
console.log(JSON.stringify(out, null, 1));
```

```bash
node /tmp/transport-probe.mjs file:///tmp/transport-base.mjs > /tmp/pr003-base.json
node /tmp/transport-probe.mjs file://$PWD/oamp/src/transport.js > /tmp/pr003-mod.json
diff -u /tmp/pr003-base.json /tmp/pr003-mod.json      # 期望：无差异（退出 0）
```

> **本节探针已在计划期对 base 版实跑通过**（mock `res` 与真实 `subscribe` 内核兼容），base 版实测输出即下述形态——改动后应与之**逐字节相同**：
> ```json
> {"global":["agent_online"],"chat_c1":["chat_state"],"call_c1":["call_state"],
>  "chatcalls_ch1":["call_state","call_update"],"globalCount":1,
>  "closed_before":[false,false,false,false],
>  "closed_after_close_chat":[false,true,false,false],
>  "closed_after_closeAll":[true,true,true,true],"globalCount_after":0}
> ```
> 由此三条既有语义同时被钉住：① `publishCall` 一次**同时**到 `call:c1` 与 `chat-calls:ch1`；② `close('c1')` **只**关 `chat:c1`；③ `closeAll()` 关掉四个键空间全部订阅且 `globalCount()` 归零。

### 4.5 零面 grep 族（T3/T5 判据）

```bash
grep -c '^import' oamp/src/transport.js                         # 0（A1：零 import 保持）
grep -c 'res.end()' oamp/src/transport.js                       # 1（唯一关闭实现 = closeKey 内那一处）
grep -c "from './web.js'\|from '../src/web.js'" oamp/src/transport.js   # 0
grep -n 'DEFAULT_HEARTBEAT_MS = 15000\|RETRY_MS = 1000' oamp/src/transport.js  # 两行原样
git -C <PR worktree 根> diff --name-status 72b659f HEAD -- oamp/ # 恰好一行 M（transport.js）
```

---

## 5. 证据载体与落盘

- **原始输出**：`/tmp/pr003-*.out` / `*.json`（临时面，**不写进仓库**）。
- **最终证据载体**：`prs/pr-003-sse-transport-additions.md` 的 **「验收证据」** 段（PR 文件自身在文件范围内，原文即要求"本 PR 执行时填写"）。
- **分两次落盘**（对齐 30 分钟上限）：T3 完成时先落「新增能力」侧证据（过滤投递 / 只关 `call:` / 导出面差集 / grep 计数）；T5 完成时补「既有面不变」侧证据（base 对照 diff + 导出面逐键对照）。**不得**新建文档、不得写进 `status.md` / `history.md`（不在本 PR 文件范围，主 agent 维护）。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（契约 7 的口径）**：心搏用**同一个** `heartbeatTimer` 覆盖两个注册表，`stopHeartbeatIfIdle()` 的自停条件 = **两个注册表合计为空**（而非各自一份定时器）。
  - 为什么需要推导：PR 验收 3 只说"心搏定时器在全部订阅者清空后自停（`stopHeartbeatIfIdle`）行为不变"，验收 7 又要求新订阅者获得 15s keepalive——两句并存时"谁数谁"未写明。
  - 推导依据：① 验收 7 的 keepalive 要求 ⇒ 新订阅者必须被定时器覆盖；② PR 上下文摘要与 A-13 的改动面只有两项、§8 剃刀反对新增机制 ⇒ 不引入第二个定时器；③ 既有可观测行为（仅既有订阅者时的 15s 行与自停）在**零新订阅者**时逐字不变 ⇒ 满足验收 3 与 Z-1。
- **[model_inferred] MI-P2（契约 3 的口径）**：`handleSubscribe` 的 `predicate` 缺省或非函数 ⇒ **恒真**（该订阅不受过滤）。
  - 为什么需要推导：PR 验收 4 只规定"谓词语义由本 PR 定、实参形态由 pr-005 传入"，未规定缺省形态。
  - 推导依据：`architecture §4 A-03` 第 4 条明文 `kinds` / `agents` **均为可选**（都不给 ⇒ 不受过滤）⇒ 缺省谓词=恒真与产品语义一致；且让"无谓词"与"恒真谓词"同解，不产生第二套语义。
- **[model_inferred] MI-P3（T4 判据 4 的口径）**：验收 5 的"零内存增长"以**行为判据**落地（无订阅者时投递为纯无操作 + 新订阅者收不到历史帧 + 断开即移除 + 重复轮次后无残留订阅），不用 `heapUsed` 采样阈值（噪声不可复现）。
  - 为什么需要推导：PR 验收 5 的"零内存增长"没有给出可判定判据。
  - 推导依据：验收 5 的完整表述是"不缓存、不排队、不补发：无订阅者时投递为无操作、零错误、零内存增长"——前四者都可由 `chunks` 与调用不抛错直接观测；"零增长"的**结构性前提**恰是"无缓存 + 断开即移除"，故以前四者的行为判据承载。

**无其他推导项**：AC1~AC9 的其余判据均可逐字回指 PR 文件、`architecture.md`（§4 A-03/A-08、§5.5、§6.1 Z-1、§1.3 F-3/F-4）或 §0.3 的事实锚点。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的 8 条边与拓扑序 `T1<T2<T5<T6`、`T3<T4<T5<T6`）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **PR 验收 1 的"既有 13 个导出键"计数与代码不符（少计 1）**：PR 原文列出的既有键为 `kind / handle / publish / publishGlobal / globalCount / close / closeAll / handleCallStream / publishCall / handleChatCallStream / publishChatCall`（**11 个对象键**）+ `createSseTransport`（模块级导出）= **12 个导出名**；`transport.js:138-141` 的返回对象正是 11 键（A10）。本任务列表的判据按**实际集合**判定（"base 集合 ⊆ 改动后集合，差集恰为新 3 键"），**不按数字 13**。该计数笔误不影响任何一条验收标准的可判定性，处置权归主 agent。
2. **`closeAll()` 是否应覆盖新注册表——本文件取"不覆盖"**：PR 验收 1 要求既有键"行为逐字不变"、验收 6 要求"既有面全断开也不影响新注册表"，两条合起来指向 `closeAll()` **只关既有键空间**（`transport.js:134-136` 的既有语义"覆盖三个键空间"被保留）；新注册表的清理只经 `res.on('close')`（与既有断开清理同款）。PR 验收证据段未要求批量关闭新面的入口，故本 PR **不新增**。若主 agent 认为需要批量关闭新面，那是**新增能力**（须相应改 PR 验收标准），不在本 PR 自行扩面。
3. **简报「工作区地址」笔误（同前两个 PR）**：简报给 `…/worktrees/0029pr-003-sse-transport-additions`（缺一个 `-`），该路径不存在；实际 worktree = `…/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions`（分支 `feat/0029-pr-003-sse-transport-additions` 检出于此，符合 `scm-protocol` 规则 C 落点命名）。本文件按实际存在且分支匹配的地址作业。
4. **粒度决策记录（本 PR 未写 `roles/planner/data/`）**：本次把"注册表 + 投递钩子"（T1）与"心搏覆盖面"（T2）拆开，理由是**两者的判据载体不同**（前者靠 mock `res` 的帧序列，后者必须靠定时器打桩）；把"隔离性/生命周期"（T4）与"与 base 对照"（T5）拆开，理由是前者断言**新能力的行为**、后者断言**既有行为的不变**。按 planner 角色定义本应记入 `data/`，但本 PR 文件范围不含（且明列不触碰）`roles/**` ⇒ 记录在此，不越界写 `roles/`。
5. **未发现的架构信息缺口**：AC1~AC9 均能在 PR 文件、`architecture.md`（§1.3/§2/§3.3/§3.5/§4 A-03·A-08/§5.5/§6.1 Z-1/§8）与 `prd/{F03,F09}` 找到可追溯依据；三条需要推导的口径（MI-P1~MI-P3）已列 §6 等确认，其余无信息不足情形。
6. **PR 文件七字段零改动**：本任务列表未修改 `prs/pr-003-sse-transport-additions.md` 的任何字段；上文第 1/2 条仅为上报。
