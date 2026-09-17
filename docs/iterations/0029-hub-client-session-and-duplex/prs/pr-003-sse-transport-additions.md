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

以下每条 AC 均给出可直接复制执行的命令和该命令的原始 stdout；命令均直接 import 本 PR worktree 中的 `oamp/src/transport.js`，不依赖仓库外取证脚本。

### AC1：导出面只追加

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const x = t.createSseTransport({ heartbeatMs: 1000000 });
console.log(JSON.stringify({ keys: Object.keys(x).sort(), kind: x.kind, module_exports: Object.keys(t).sort() }));
NODE
{"keys":["close","closeAll","closeCallSubscriptions","globalCount","handle","handleCallStream","handleChatCallStream","handleSubscribe","kind","publish","publishCall","publishChatCall","publishFiltered","publishGlobal"],"kind":"sse","module_exports":["createSseTransport"]}
```

实际对象键为既有 11 键加 3 个追加键；模块级仍仅导出 `createSseTransport`，原验收条文中的“既有 13 个键”及 `closeKey` 列举与基线实际不一致。

### AC2：closeCallSubscriptions 只关闭 call:9

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const mk = () => { const r = { chunks: [], ended: false, writeHead() {}, write(x) { this.chunks.push(x); }, on(e, f) { this.listeners ??= {}; this.listeners[e] = f; }, emit(e) { this.listeners?.[e]?.(); }, end() { this.ended = true; this.emit('close'); } }; return r; };
const events = (r) => r.chunks.filter((x) => x.startsWith('event:')).map((x) => x.split('\n')[0].slice(7));
const x = t.createSseTransport({ heartbeatMs: 1000000 }); const call = mk(), chat = mk(), cc = mk();
x.handleCallStream({}, call, { callId: '9' }); x.handle({}, chat, { chatId: '10' }); x.handleChatCallStream({}, cc, { chatId: '10' });
x.closeCallSubscriptions('9'); x.publishCall('9', { type: 'call_state', data: { chat_id: '10' } }); x.publish('10', { type: 'chat_state', data: {} });
console.log(JSON.stringify({ ended: { call: call.ended, chat: chat.ended, chatCalls: cc.ended }, events: { call: events(call), chat: events(chat), chatCalls: events(cc) } }));
NODE
{"ended":{"call":true,"chat":false,"chatCalls":false},"events":{"call":[],"chat":["chat_state"],"chatCalls":["call_state"]}}
```

`call:9` 被结束，`chat:10` 与 `chat-calls:10` 仍可接收后续事件。

### AC3：断开清理与心跳自停

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const mk = () => { const r = { chunks: [], writeHead() {}, write(x) { this.chunks.push(x); }, on(e, f) { this.listeners ??= {}; this.listeners[e] = f; }, emit(e) { this.listeners?.[e]?.(); } }; return r; };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const x = t.createSseTransport({ heartbeatMs: 40 }); const a = mk(), b = mk();
x.handleSubscribe({}, a, { predicate: () => true }); x.handle({}, b, { chatId: '1' }); await sleep(105);
const ka1 = a.chunks.filter((v) => v === ': keepalive\n\n').length, ka2 = b.chunks.filter((v) => v === ': keepalive\n\n').length;
a.emit('close'); b.emit('close'); const before = [a.chunks.length, b.chunks.length]; await sleep(90);
console.log(JSON.stringify({ ka1, ka2, after_close: { a: a.chunks.length - before[0], b: b.chunks.length - before[1] }, stopped: x.globalCount() === 0 }));
NODE
{"ka1":2,"ka2":2,"after_close":{"a":0,"b":0},"stopped":true}
```

两侧连接关闭后心跳计数不再增加，定时器停止。

### AC4：过滤投递谓词 AND

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const r = { chunks: [], writeHead() {}, write(x) { this.chunks.push(x); }, on() {} };
const x = t.createSseTransport({ heartbeatMs: 1000000 });
x.handleSubscribe({}, r, { predicate: (e) => e.type === 'agent_online' && e.data.agent === 'dev' });
x.publishFiltered({ type: 'agent_online', data: { agent: 'dev' } }); x.publishFiltered({ type: 'call_state', data: { agent: 'dev' } }); x.publishFiltered({ type: 'agent_online', data: { agent: 'ops' } });
console.log(JSON.stringify({ chunks: r.chunks, event_types: r.chunks.filter((x) => x.startsWith('event:')).map((x) => x.split('\n')[0].slice(7)) }));
NODE
{"chunks":["retry: 1000\n\n","event: agent_online\ndata: {\"agent\":\"dev\"}\n\n"],"event_types":["agent_online"]}
```

只有同时满足事件类型与 agent 条件的帧被投递。

### AC5：无缓存、无排队、无补发

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const x = t.createSseTransport({ heartbeatMs: 1000000 }); x.publishFiltered({ type: 'agent_online', data: { agent: 'dev' } });
const r = { chunks: [], writeHead() {}, write(v) { this.chunks.push(v); }, on() {} }; x.handleSubscribe({}, r, {});
console.log(JSON.stringify({ chunks: r.chunks, no_event: r.chunks.every((v) => !v.startsWith('event:')) }));
NODE
{"chunks":["retry: 1000\n\n"],"no_event":true}
```

订阅建立后只有 retry 首帧，没有补发订阅前事件。

### AC6：新旧注册表隔离

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const mk = () => { const r = { chunks: [], ended: false, writeHead() {}, write(x) { this.chunks.push(x); }, on(e, f) { this.listeners ??= {}; this.listeners[e] = f; }, emit(e) { this.listeners?.[e]?.(); }, end() { this.ended = true; this.emit('close'); } }; return r; };
const events = (r) => r.chunks.filter((x) => x.startsWith('event:')).map((x) => x.split('\n')[0].slice(7));
const x = t.createSseTransport({ heartbeatMs: 1000000 }); const global = mk(), filtered = mk();
x.handle({}, global, { chatId: null }); x.handleSubscribe({}, filtered, { predicate: () => true }); const before = x.globalCount();
x.publishGlobal({ type: 'agent_online', data: { agent: 'dev' } }); const filteredFromExisting = events(filtered); x.closeAll();
console.log(JSON.stringify({ before, after_close_all_global: x.globalCount(), global_ended: global.ended, filtered_ended: filtered.ended, filtered_from_existing: filteredFromExisting }));
NODE
{"before":1,"after_close_all_global":0,"global_ended":true,"filtered_ended":false,"filtered_from_existing":[]}
```

既有 `globalCount` 与 `closeAll` 只作用于既有注册表，既有发布 API 不投喂过滤注册表。

### AC7：新订阅沿用 SSE 建立语义且无初始数据帧

```sh
$ node --input-type=module <<'NODE'
const t = await import('file:///Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js');
const r = { chunks: [], writeHead(status, headers) { this.status = status; this.headers = headers; }, write(v) { this.chunks.push(v); }, on() {} };
t.createSseTransport({ heartbeatMs: 1000000 }).handleSubscribe({}, r, {});
console.log(JSON.stringify({ status: r.status, headers: r.headers, chunks: r.chunks }));
NODE
{"status":200,"headers":{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-store","connection":"keep-alive"},"chunks":["retry: 1000\n\n"]}
```

输出包含既有 SSE 头、retry 首帧，且没有初始事件数据帧。

### AC8：四键空间逐条投递与关闭回归

```sh
$ node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
const root = '/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions';
const baseSource = execFileSync('git', ['-C', root, 'show', '72b659f:oamp/src/transport.js'], { encoding: 'utf8' });
const load = async (url) => (await import(url)).createSseTransport({ heartbeatMs: 1000000 });
const mk = () => { const r = { chunks: [], ended: false, writeHead() {}, write(x) { this.chunks.push(x); }, on(e, f) { this.listeners ??= {}; this.listeners[e] = f; }, emit(e) { this.listeners?.[e]?.(); }, end() { this.ended = true; this.emit('close'); } }; return r; };
const events = (r) => r.chunks.filter((x) => x.startsWith('event:')).map((x) => x.split('\n')[0].slice(7));
const probe = async (url) => { const x = await load(url); const global = mk(), chat = mk(), call = mk(), chatCalls = mk(); x.handle({}, global, { chatId: null }); x.handle({}, chat, { chatId: '10' }); x.handleCallStream({}, call, { callId: '9' }); x.handleChatCallStream({}, chatCalls, { chatId: '10' }); x.publishGlobal({ type: 'global', data: {} }); x.publish('10', { type: 'chat', data: {} }); x.publishCall('9', { type: 'call', data: { chat_id: '10' } }); x.publishChatCall('10', { type: 'chat_call', data: {} }); const before = { global: events(global), chat: events(chat), call: events(call), chatCalls: events(chatCalls) }; x.close('10'); x.publishGlobal({ type: 'global2', data: {} }); x.publishCall('9', { type: 'call2', data: { chat_id: '10' } }); return { before, ended: { global: global.ended, chat: chat.ended, call: call.ended, chatCalls: chatCalls.ended }, after: { global: events(global), chat: events(chat), call: events(call), chatCalls: events(chatCalls) } }; };
const now = await probe(`file://${root}/oamp/src/transport.js`); const base = await probe(`data:text/javascript;base64,${Buffer.from(baseSource).toString('base64')}`); console.log(JSON.stringify({ equal: JSON.stringify(now) === JSON.stringify(base), now, base }));
NODE
{"equal":true,"now":{"before":{"global":["global"],"chat":["chat"],"call":["call"],"chatCalls":["call","chat_call"]},"ended":{"global":false,"chat":true,"call":false,"chatCalls":false},"after":{"global":["global","global2"],"chat":["chat"],"call":["call","call2"],"chatCalls":["call","chat_call","call2"]}},"base":{"before":{"global":["global"],"chat":["chat"],"call":["call"],"chatCalls":["call","chat_call"]},"ended":{"global":false,"chat":true,"call":false,"chatCalls":false},"after":{"global":["global","global2"],"chat":["chat"],"call":["call","call2"],"chatCalls":["call","chat_call","call2"]}}}
```

当前实现与 `72b659f` 基线四键空间 probe 输出完全一致。

### AC9：零依赖且不 import web.js

```sh
$ grep -cE '^(import|export).*web\.js' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js"
0
```

```sh
$ grep -cE '^(import|export)' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/oamp/src/transport.js"
1
```

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions diff --name-only 72b659f..HEAD -- oamp/package.json oamp/src/web.js oamp/src/surface.js oamp/web/calls.js
```

transport.js 没有 web.js 导入，且保护路径 diff 为空；唯一模块级 export 是既有 `createSseTransport`。

### 提交前自查

```sh
$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md"
24:- [ ] `closeCallSubscriptions(callId)` 存在且**只关 `call:<callId>`**：mock res 断言 —— `call:<id>` 的订阅者被 `res.end()`；`chat-calls:<id>` 与 `chat:<id>` 的订阅者**仍在**且后续事件照常到达（F09 验收 3）——`oamp/src/transport.js:120-126`（`closeKey`）为唯一关闭实现，不新增第二套关闭路径
199:$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md"
200:222:$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md"
```
