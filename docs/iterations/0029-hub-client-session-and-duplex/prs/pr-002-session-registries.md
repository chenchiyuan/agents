# pr-002：客户端会话登记模块（身份表 / 未取件指针表）

## 上下文摘要

按 `src/inbox.js` 的**进程内表体例**新建两个模块：`src/principals.js`（`Map<principal_id, {principal_id, kind, instance_id, created_at, last_seen_at}>` + `upsert / get / touch / resolve`，含 **单一接缝函数** `requesterOf(source)`）与 `src/pickup.js`（`Map<call_id, {call_id, requester, agent, chat_id, terminal_at, acked}>` + `add / listByRequester / ack`）。无 TTL、无定时器、无事件面、不落库、重启即丢；`kind` 不校验取值域，`instance_id` 只承载"所归属实例"的自述声明（不判定、不据此拒绝）。

本 PR 只交付模块与其语义（含幂等与形态校验），**HTTP 面接线由 pr-005 承担**：模块导出面是本 PR 的验收面，也是 pr-005 的消费面。

## 涉及功能点

- F01
- F07

## 文件范围

- `oamp/src/principals.js`（新建：身份表 + `requesterOf` 接缝）
- `oamp/src/pickup.js`（新建：未取件指针表）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（接线面归 pr-005）、`oamp/src/inbox.js`（体例来源，零改动）、`oamp/src/persist.js`（不落库）。

## 验收标准

- [ ] 两文件存在且可独立 import（`node --input-type=module -e "import('./oamp/src/principals.js')"`）；导出面 = 上述函数集合，**无多余入口**（不提供 `history / export / clear / decided` 类接口，与 `src/inbox.js` 的"导出面恰好 5 个"同款收敛）
- [ ] 两模块的 `import` 行**只含 `node:*`**（不 import 任何仓内模块，不产生新耦合）——`grep -n '^import' oamp/src/principals.js oamp/src/pickup.js`
- [ ] `upsert({principal_id:'p1', kind:'cli'})` 连续两次 ⇒ 两次都成功（不返回冲突）、`created_at` 两次相同、`last_seen_at` 不倒退；`get('p1')` 返回同形（F01 验收 1）
- [ ] 形态校验复用既有规则（非空 / ≤64 / 可打印 ASCII，与 `src/registry.js:7` 的 `isValidInstanceId` 同源，不另写一份正则）；非法形态 ⇒ **不建条目**且返回可判定的失败（不静默建）
- [ ] 无租约：模块内无 `setTimeout / setInterval`（`grep -c` 为 0）；`touch('p1')` 前移 `last_seen_at`、不改 `created_at`；无"未续期即失效/清除"的路径（F01 验收 2/3）
- [ ] `requesterOf(source)` 只读**显式声明**：缺字段或空 ⇒ `null`；不做任何推断（不从进程、环境、连接、路径推导身份）；`instance_id` 缺失 ⇒ 该字段为 `null` 而不报错（F01 验收 5 / D-2）
- [ ] `pickup.add({call_id, requester, agent, chat_id, terminal_at})` 幂等：同一 `call_id` 重复 add 不产生第二条、不覆盖首条（F07 验收 1）
- [ ] `listByRequester('p1')` 只返回该身份 `acked=false` 的条目（另一身份 `p2` 的条目不在列表中）——取件归属的对照实验（F02 验收 1 的模块侧判据）
- [ ] `ack(call_id)` 幂等删除语义：条目移出未取件集合；重复 ack / 不存在的 id ⇒ 返回成功且**无副作用**（不抛、不建条目）（F07 验收 3 / MI-5）
- [ ] 只存指针不存正文：条目字段集合恰为上述 6 个键，无正文/信封副本（F07 验收 5）
- [ ] 与既有 `src/inbox.js` 同寿命口径：文件头注释明写"进程内、不持久、重启即丢"，且无落库/无文件写入（F01 边界 / F07 验收 6）
- [ ] 零新增依赖；本 PR 的 diff 不含 `oamp/src/web.js` 与任何既有文件

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F01-client-identity-service.md`（验收 1~6、边界、MI-10）、`F07-terminal-result-pickup.md`（验收 1~6、边界、MI-5）、`F02-call-requester-identity.md`（验收 1/4、MI-3）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §3.1（身份注册/查询/续声明流）、§3.7（取件流）、§4 A-01 / A-02 / A-06、§5.4（新增进程内模块表）、§8（剃刀检验：两者的"不引入则不可实现"论证）
- 体例来源与代码锚点：`oamp/src/inbox.js`（进程内 Map + 小而固定导出面 + "进程内、不持久、重启即丢"注释口径）、`oamp/src/registry.js:7-10`（`isValidInstanceId` 形态规则，唯一来源）

## depends_on

（无）

## batch

1

## 验收证据

以下各节均采用“可复制命令 + 该命令 stdout 原样输出”。所有命令仅依赖仓库内文件或内联脚本；动态命令通过 `node --input-type=module -e` 直接导入本 worktree 模块。

```sh
$ node --input-type=module -e 'const [p,k] = await Promise.all([import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"), import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js")]); console.log(JSON.stringify({principals:Object.keys(p).sort(),pickup:Object.keys(k).sort()}));'
{"principals":["get","requesterOf","touch","upsert"],"pickup":["ack","add","listByRequester"]}
```

### AC1–AC2：导出面与零 import

```sh
$ grep -cE '^import' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js" "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js:0
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js:0
```

### AC3：upsert 幂等、时间字段与 get 形状

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"); const first = p.upsert({principal_id:"p1",kind:"cli",instance_id:"i1"}); const second = p.upsert({principal_id:"p1",kind:"cli",instance_id:"i1"}); console.log(JSON.stringify({first,second,created_same:first.principal.created_at===second.principal.created_at,last_seen_not_back:second.principal.last_seen_at>=first.principal.last_seen_at,get:p.get("p1")}));'
{"first":{"principal":{"principal_id":"p1","kind":"cli","instance_id":"i1","created_at":1789557907459,"last_seen_at":1789557907459}},"second":{"principal":{"principal_id":"p1","kind":"cli","instance_id":"i1","created_at":1789557907459,"last_seen_at":1789557907459}},"created_same":true,"last_seen_not_back":true,"get":{"principal_id":"p1","kind":"cli","instance_id":"i1","created_at":1789557907459,"last_seen_at":1789557907459}}
```

### AC4：principal_id 形态校验

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"); const accepted = ["a".repeat(64),"valid"].map(value => p.upsert({principal_id:value}).principal.principal_id.length); const rejected = ["","a".repeat(65),"\u0000","\u007f","a\n","é",42,{}].map(value => { const result = p.upsert({principal_id:value}); return {inputType:typeof value,length:typeof value === "string" ? value.length : null,result:result.error ?? "ACCEPTED"}; }); console.log(JSON.stringify({accepted,rejected}));'
{"accepted":[64,5],"rejected":[{"inputType":"string","length":0,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"string","length":65,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"string","length":1,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"string","length":1,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"string","length":2,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"string","length":1,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"number","length":null,"result":"INVALID_PRINCIPAL_ID"},{"inputType":"object","length":null,"result":"INVALID_PRINCIPAL_ID"}]}
```

### AC5：与 registry.isValidInstanceId 等价

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"); const r = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/registry.js"); const values = ["a","a".repeat(64),"a".repeat(65),""," ","a b","!","~","\u0000","é",42,null,{},"x\n","x\t"]; const matches = values.filter(value => Boolean(p.upsert({principal_id:value}).principal) === r.isValidInstanceId(value)).length; console.log(JSON.stringify({matches,total:values.length,allMatch:matches===values.length}));'
{"matches":15,"total":15,"allMatch":true}
```

### AC6：touch 时间边界、无 lease/expiry/clear

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"); const before = structuredClone(p.upsert({principal_id:"p1",kind:"cli"}).principal); let after; do { await new Promise(resolve => setTimeout(resolve,1)); after = structuredClone(p.touch("p1")); } while (after.last_seen_at === before.last_seen_at); const same_millisecond_before = after.last_seen_at; const same_millisecond_after = p.touch("p1").last_seen_at; console.log(JSON.stringify({before,after,advanced:after.last_seen_at>before.last_seen_at,created_same:after.created_at===before.created_at,same_millisecond:{before:same_millisecond_before,after:same_millisecond_after,advanced:same_millisecond_after>same_millisecond_before}}));'
{"before":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789558096436,"last_seen_at":1789558096436},"after":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789558096436,"last_seen_at":1789558096437},"advanced":true,"created_same":true,"same_millisecond":{"before":1789558096437,"after":1789558096437,"advanced":false}}
```

输出同时证明：跨过毫秒边界时 `last_seen_at` 前移；同一毫秒内再次 `touch` 不虚构前移。

### AC7：requesterOf 只读取显式 principal_id

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js"); console.log(JSON.stringify({null:p.requesterOf(null),empty:p.requesterOf({}),empty_id:p.requesterOf({principal_id:""}),explicit:p.requesterOf({principal_id:"p9",kind:"cli"}),missing_instance:p.requesterOf({principal_id:"p10",kind:"cli"}),p9_registered:p.get("p9") !== null}));'
{"null":null,"empty":null,"empty_id":null,"explicit":{"principal_id":"p9","kind":"cli","instance_id":null},"missing_instance":{"principal_id":"p10","kind":"cli","instance_id":null},"p9_registered":false}
```

### AC8：pickup.add 按 call_id 去重且不覆盖

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"); const first = p.add({call_id:"c1",requester:"p1",agent:"a1",chat_id:"h1",terminal_at:1}); const duplicate = p.add({call_id:"c1",requester:"p2",agent:"a2",chat_id:"h2",terminal_at:2}); console.log(JSON.stringify({first,duplicate,list_p1:p.listByRequester("p1"),list_p2:p.listByRequester("p2")}));'
{"first":true,"duplicate":false,"list_p1":[{"call_id":"c1","requester":"p1","agent":"a1","chat_id":"h1","terminal_at":1,"acked":false}],"list_p2":[]}
```

### AC9：listByRequester 隔离且仅返回 acked=false

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"); p.add({call_id:"c1",requester:"p1",agent:"a1",chat_id:"h1",terminal_at:1}); p.add({call_id:"c2",requester:"p2",agent:"a2",chat_id:"h2",terminal_at:2}); p.add({call_id:"c3",requester:"p1",agent:"a3",chat_id:"h3",terminal_at:3}); p.ack("c3"); console.log(JSON.stringify({p1:p.listByRequester("p1"),p2:p.listByRequester("p2"),p3:p.listByRequester("p3")}));'
{"p1":[{"call_id":"c1","requester":"p1","agent":"a1","chat_id":"h1","terminal_at":1,"acked":false}],"p2":[{"call_id":"c2","requester":"p2","agent":"a2","chat_id":"h2","terminal_at":2,"acked":false}],"p3":[]}
```

### AC10：ack 软删除、重复/缺失无副作用且仍占 Map

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"); p.add({call_id:"c1",requester:"p1",agent:"a1",chat_id:"h1",terminal_at:1}); const before = structuredClone(p.listByRequester("p1")); const first_ack = p.ack("c1") ?? null; const after = p.listByRequester("p1"); const repeat_ack = p.ack("c1") ?? null; const missing_ack = p.ack("missing") ?? null; const add_after_ack = p.add({call_id:"c1",requester:"p1",agent:"a2",chat_id:"h2",terminal_at:2}); console.log(JSON.stringify({before,first_ack,after,repeat_ack,missing_ack,add_after_ack}));'
{"before":[{"call_id":"c1","requester":"p1","agent":"a1","chat_id":"h1","terminal_at":1,"acked":false}],"first_ack":null,"after":[],"repeat_ack":null,"missing_ack":null,"add_after_ack":false}
```

`after:[]` 证明列表过滤已 ack 条目；`repeat_ack:null`、`missing_ack:null` 证明重复/缺失调用无可见副作用；`add_after_ack:false` 证明 ack 只改标记、不从 Map 删除。

### AC11：pickup 指针严格六字段

```sh
$ node --input-type=module -e 'const p = await import("/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"); p.add({call_id:"c1",requester:"p1",agent:"a1",chat_id:"h1",terminal_at:1}); const entry = p.listByRequester("p1")[0]; const keys = Object.keys(entry).sort(); console.log(JSON.stringify({keys,entry,has_text:Object.hasOwn(entry,"text"),has_envelope:Object.hasOwn(entry,"envelope")}));'
{"keys":["acked","agent","call_id","chat_id","requester","terminal_at"],"entry":{"call_id":"c1","requester":"p1","agent":"a1","chat_id":"h1","terminal_at":1,"acked":false},"has_text":false,"has_envelope":false}
```

### AC12：进程内生命周期、无持久化/事件副作用、基线边界

```sh
$ grep -cE 'setTimeout|setInterval' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js" "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js:0
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js:0
```

```sh
$ grep -cE 'writeFile|appendFile|createWriteStream|process\.|EventEmitter|emit\(' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js" "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js:0
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js:0
```

```sh
$ grep -c '进程内、不持久、重启即丢' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js" "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js"
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/principals.js:1
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/oamp/src/pickup.js:1
```

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries diff --name-only 72b659f..HEAD -- oamp/src/web.js oamp/src/inbox.js oamp/src/persist.js oamp/package.json
```

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries diff --stat 72b659f..HEAD -- oamp/src/principals.js oamp/src/pickup.js
 oamp/src/pickup.js     | 37 +++++++++++++++++++++++++++
 oamp/src/principals.js | 68 ++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 105 insertions(+)
```

### 提交前自查

```sh
$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md"
169:$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md"
```
