# pr-003：SSE 传输补线（过滤订阅注册表 / 调用关流原语）

## 上下文摘要

`src/transport.js` 的两处追加：① **并行**的订阅注册表（携带逐订阅者过滤谓词；**不占用**既有四个键空间），由既有发布点在写完既有键之后把同一帧交给它按谓词投递；② `closeCallSubscriptions(callId)`——内部 = 既有 `closeKey('call:' + callId)`，补上事实 F-3 的"`closeKey` 0 调用点"。

关键约束：既有四键空间（`chat:` / `call:` / `chat-calls:` / `null` 全局）、既有 `subscribe` 内核（SSE 头 + `retry: 1000` + 15s keepalive）、既有 `publishTo` 的"无订阅者即丢"语义**逐字不变**；新注册表与既有 `subscribers` 分离，任一面的存在/断开不影响另一面（Z-1 / F03 验收 5）。

## 涉及功能点

- F03
- F09

## 文件范围

- `oamp/src/transport.js`
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（订阅路由的注册与发布钩子的**调用点**在 pr-005；本 PR 只提供能力）、`oamp/web/calls.js`（控制台适配见 pr-004）。

## 验收标准

- [ ] 导出面只**追加**，既有 13 个导出键（`kind / handle / publish / publishGlobal / globalCount / close / closeAll / handleCallStream / publishCall / handleChatCallStream / publishChatCall / closeKey` 及 `createSseTransport`）签名与行为逐字不变（`oamp/src/transport.js:138-141`）
- [ ] `closeCallSubscriptions(callId)` 存在且**只关 `call:<callId>`**：mock res 断言 —— `call:<id>` 的订阅者被 `res.end()`；`chat-calls:<id>` 与 `chat:<id>` 的订阅者**仍在**且后续事件照常到达（F09 验收 3）——`oamp/src/transport.js:120-126`（`closeKey`）为唯一关闭实现，不新增第二套关闭路径
- [ ] 既有"订阅者断开 ⇒ 清理订阅"路径未被改写（F09 验收 5：终态关流是**第二条**关闭触发路径）；心搏定时器在全部订阅者清空后自停（`stopHeartbeatIfIdle`）行为不变
- [ ] 新注册表的过滤投递：谓词为"只要 `agent_online`"的订阅者收不到 `call_state` / `chat_state` 帧；`kinds` 与 `agents` 同时给出时为 AND（谓词语义由本 PR 定，过滤判据的实参形态由 pr-005 传入）（F03 验收 2）
- [ ] 新注册表**不缓存、不排队、不补发**：无订阅者时投递为无操作、零错误、零内存增长（F03 验收 3）
- [ ] 隔离性：新注册表全部订阅者断开后，既有 `globalCount()` 的取值与既有键空间的订阅者数**不受影响**；反之，既有面全断开也不影响新注册表（F03 验收 5 / Z-1）
- [ ] 新订阅者沿用既有 SSE 建立语义：同一份 `subscribe` 内核的头（`text/event-stream` / `no-store`）、首帧 `retry: 1000`、15s `: keepalive`；**订阅建立不发任何初始数据帧**（A-03 第 3 条）
- [ ] 一次性脚本按既有四个键空间逐条断言投递集合与关闭行为，与改动前一致（四条面的回归判据）
- [ ] 零新增依赖；本模块仍不 import `oamp/src/web.js`（不产生依赖环）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F03-realtime-event-subscription.md`（验收 1~5、MI-9）、`F09-close-stream-on-terminal.md`（验收 1~5）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §1.3 事实 F-3 / F-4、§2（组件 3：既有 SSE 传输内核，新增**并行**注册表）、§3.3（订阅流）、§3.5 第 1 条（终态关流）、§4 A-03 / A-08、§6.1 Z-1、§8（"不做按过滤条件建动态键"的剃刀论证）
- 代码锚点：`oamp/src/transport.js:18-20`（三个键空间与全局键）、`oamp/src/transport.js:45-66`（`subscribe` 内核与断开清理）、`oamp/src/transport.js:85-89`（`publishTo`：无订阅者即丢）、`oamp/src/transport.js:115-117`（`globalCount` = "仅在有全局订阅者时轮询"的唯一判据）、`oamp/src/transport.js:120-126`（`closeKey`）

## depends_on

（无）

## batch

1

## 验收证据

- 功能脚本：`node /tmp/pr003-verify.mjs` 输出 `RESULT: PASS`。原始关键输出：`PASS AC1 module export surface`、`PASS AC1 object export surface`、`PASS AC2 closeCallSubscriptions closes only call key`、`PASS AC2 remaining keys receive events`、`PASS AC4 online predicate`、`PASS AC4 call predicate`、`PASS AC4 AND predicate`、`PASS AC4 frame shape`、`PASS AC5 no history or cache`、`PASS AC5 disconnect removes filtered subscriber`、`PASS AC6 filtered disconnect preserves existing global count`、`PASS AC6 filtered subscriber survives existing close`、`PASS AC5 repeated rounds leave no residual subscribers`。
- 心搏脚本：`node /tmp/pr003-heartbeat.mjs` 输出 `RESULT: PASS`；原始输出含 `existing keepalives: 3 | timers: {"started":1,"cleared":0}`、`filtered keepalives: 3 | timers: {"started":1,"cleared":0}`、`after both abort: {"started":1,"cleared":1}`、`restart: {"started":2,"cleared":2} | keepalives restarted: 3`。
- 基线对照：`/tmp/pr003-probe.mjs` 分别运行 `/tmp/transport-base.mjs` 与当前 `oamp/src/transport.js`，两行 JSON 完全一致：`{"countSnapshots":[2,2,0],"before":{"global":["event: global\\ndata: {\\"n\\":1}\\n\\n"],"chat":["event: chat\\ndata: {\\"n\\":2}\\n\\n"],"call":["event: call\\ndata: {\\"chat_id\\":\\"ch1\\",\\"n\\":3}\\n\\n"],"chatCalls":["event: call\\ndata: {\\"chat_id\\":\\"ch1\\",\\"n\\":3}\\n\\n","event: chat_call\\ndata: {\\"n\\":4}\\n\\n"]},"afterClose":{"chatClosed":true,"callClosed":false,"chatCallsClosed":false,"globalClosed":false,"chatTypes":["chat"],"callTypes":["call"],"chatCallsTypes":["call","chat_call"],"globalTypes":["global"]},"afterAll":{"globalClosed":true,"chatCallsClosed":true}}`；`diff -u /tmp/pr003-base-probe.out /tmp/pr003-current-probe.out` 无输出且退出码 0。
- 静态输出：`/tmp/pr003-static-counts.out` 为 `res.end(): 1`、`imports: 0`、`web imports: 0`、`timers: 1`、`clear timer: 1`、`heartbeat constant: 1`、`retry constant: 1`；`^import` / `web.js` 扫描无匹配。
- 文件闭包输出：`git diff --name-status 72b659f -- oamp/` 仅为 `M	oamp/src/transport.js`；`git diff -- oamp/package.json` 无输出；最终仅修改本 PR 文件的证据段与 `oamp/src/transport.js`。
- 既有发布隔离脚本：`node /tmp/pr003-existing-isolation.mjs` 输出 `PASS AC6 existing publish APIs do not reach filtered registry` 与 `RESULT: PASS`，证明四个既有投递 API 不会隐式投喂新注册表。
