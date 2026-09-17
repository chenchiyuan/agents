# pr-001：Router 侧状态基元（`connected` / `started_at` / `generation` / `task_cancel`）

## 上下文摘要

Router 进程与 UDS 会话层的全部本次改动集中在一个 PR（三个文件互为一体：节点快照字段、任务条目字段、协议方法）。内容：`registry.snapshot()` 追加 `connected`（= `connId !== null`，不暴露连接句柄）、任务条目追加 `started_at`（首次观察到 `working` 时写入，未进入过则 `null`）、Router 模块级 `generation`（启动时 `randomUUID()` 一次，经 `router.status` 结果追加键暴露）、新增第 9 个方法 `router.task_cancel`（内部 = 既有 `finishTask`：`failed` + `error:'cancelled'`，对已终态**幂等拒写**），`sdk/uds.js` 按既有 1:1 体例加会话方法 `taskCancel`。

关键约束：既有函数签名与语义、既有 4 字段节点投影、既有 8 个 UDS 方法语义逐字不变（G01 / architecture §6.1 Z-7）；终态词表封闭四值；层 B 入口清单与 `sdk/surface.js` 的 `UDS_ENTRIES` 同步**不在本 PR**（见 pr-007）。

## 涉及功能点

- F05
- F08
- F13
- F15
- F16

## 文件范围

- `oamp/src/registry.js`（`snapshot()` 追加 `connected`；任务条目追加 `started_at`；模块级 `generation`）
- `oamp/src/router.js`（`dispatch` 追加 `router.task_cancel` 分支；`router.status` 结果追加 `generation`）
- `oamp/sdk/uds.js`（会话方法追加 `taskCancel`，与既有 8 个同体例；头注方法清单同步）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md`（本 PR 文件）

不触碰：`oamp/src/web.js`、`oamp/src/transport.js`、`oamp/sdk/surface.js`、`oamp/skill/hub.md`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`、`oamp/src/persist.js`（无改动面）。

## 验收标准

- [ ] `router.status` 结果含 `generation`：非空字符串；同一 Router 进程存续期内两次调用取值相同；重启后取值变化（F08 验收 1 / A-07）
- [ ] 节点投影每项含 `connected`（boolean，`connId !== null` 的派生）：既有 4 字段名/取值/顺序不变；`oamp status` 输出逐字不变（`src/status.js:20` 的 `COLUMNS` 未改，F16 验收 1 / G01 验收 3）
- [ ] `connected` 的三态可判据成立：`state='online' && connected=true` / `state='online' && connected=false`（连接断开、租约未过期的窗口，`registry.onConnClosed` 只置 `connId=null`）/ `state='offline'` 墓碑三者可从同一次 `router.status` 区分（A-13）
- [ ] 任务条目含 `started_at`：首次进入 `working` 时写入；未进入过为 `null`；`router.task_list` / `router.task_get` 的既有字段名与值域不变（F05 验收 1 的 `since` 数据源）
- [ ] `uds router.task_cancel --params '{"task_id":"<working 的 id>"}'` ⇒ 返回该任务，`state='failed'`、`result.error='cancelled'`；随后 `task_get` 当刻即为终态（F13 验收 1/3）
- [ ] 对同一 id 重复取消 ⇒ 返回 `TASK_ALREADY_FINAL`（第二次不写、不改已定终态与原因）；不存在 id ⇒ `TASK_NOT_FOUND`；`task_id` 缺失/非法 ⇒ 既有 `INVALID_PARAMS` 错误体例（F13 验收 4/5/6）
- [ ] 终态词表仍为既有四值；`registry.finishTask`（`oamp/src/registry.js:238`）的既有幂等拒写分支未被改写、未新增第五个取值（F13 验收 2 / G01 验收 2）
- [ ] `sdk/uds.js` 的 `connect()` 返回面**仅追加** `taskCancel`，既有 8 个方法签名不变；方法实现走既有 `RpcPeer` 请求路径（不新增第二套帧编解码）（F13；G01 验收 3）
- [ ] 零新增第三方依赖 / 零新 env / 零新配置键；DB 表结构未被触碰（G01 验收 6）
- [ ] 既有 8 个 UDS 方法的语义与响应体未变（逐条对同一组入参比对改动前后的返回形状）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F05-agent-live-state-projection.md`（验收 1/6）、`F08-resume-contract-and-snapshot.md`（验收 1）、`F13-call-cancel.md`（验收 1~6）、`F15-recovery-criteria-health.md`（验收 2/3）、`F16-reconnect-visibility-and-remanage.md`（验收 1/2/6）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §4 A-04 / A-07 / A-10 / A-12 / A-13、§5.2（追加字段表）、§5.3（新增 Router 方法）、§6.1 Z-3 / Z-7、§8（新实体剃刀检验）、§7 L1-02（已确认：`router.task_cancel` 与层 B 8 → 9）
- 代码锚点：`oamp/src/registry.js:153`（`snapshot()` 4 字段投影，本 PR 追加 `connected`）、`oamp/src/registry.js:238-248`（`finishTask` 幂等拒写 = 取消的既有落点）、`oamp/src/registry.js:110-118`（`onConnClosed` 只置 `connId=null` ⇒ 三态中"重连中"的来源）、`oamp/src/router.js:104-108`（`dispatch` 方法分发表）、`oamp/src/router.js:379-383`（`router.status` 分支）、`oamp/sdk/uds.js`（会话方法 1:1 体例）

## depends_on

（无）

## batch

1

## 验收证据

以下每个 `$` 行均为本 PR 工作区可直接执行的命令；紧随代码块是该命令本次执行得到的 stdout/stderr。运行时 socket 使用工作区内的相对路径，避免依赖外部脚本。

### 标准 1：generation、connected、started_at、task_cancel、SDK 会话面

```sh
$ node --input-type=module -e 'import {spawn} from "node:child_process"; import fs from "node:fs"; import {setTimeout as sleep} from "node:timers/promises"; import {connect} from "./oamp/sdk/uds.js"; try{fs.unlinkSync(".runtime/r.sock")}catch{} const r=spawn(process.execPath,["oamp/bin/oamp.js","router","start"],{env:{...process.env,OAMP_SOCKET:".runtime/r.sock"},stdio:["ignore","ignore","pipe"]}); let c; for(let i=0;i<100;i++){try{c=await connect({socketPath:".runtime/r.sock"});break}catch{await sleep(20)}} if(!c)throw new Error("router did not start"); const a=await connect({socketPath:".runtime/r.sock"}); const s1=await a.status(); const s2=await a.status(); await c.register("probe-agent"); const afterRegister=await a.status(); const req={protocol:"oamp/1",message_id:"probe-request-1",type:"task.request",to:{instance_id:"probe-agent"},payload:{content_type:"application/json",body:JSON.stringify({label:"evidence"})}}; const sent=await c.send({message:req}); const id=sent.task_id; await c.send({message:{protocol:"oamp/1",message_id:"probe-update-1",type:"task.update",task_id:id,to:{instance_id:"probe-agent"},payload:{content_type:"application/json",body:JSON.stringify({state:"working"})}}}); const w=await c.taskGet(id); const can=await c.taskCancel(id); const after=await c.taskGet(id); let repeat,missing,invalid; try{await c.taskCancel(id)}catch(e){repeat={code:e.code,error:e.error}} try{await c.taskCancel("missing-task")}catch(e){missing={code:e.code,error:e.error}} try{await c.taskCancel("")}catch(e){invalid={code:e.code,error:e.error}} console.log("GEN_STABLE",s1.generation===s2.generation,s1.generation); console.log("NODE_KEYS",Object.keys(afterRegister.nodes[0]).join(",")); console.log("CONNECTED",afterRegister.nodes[0].connected); console.log("SESSION_KEYS",Object.keys(c).sort().join(",")); console.log("WORKING_ROW",JSON.stringify({state:w.task.state,started_at:w.task.started_at})); console.log("CANCEL1",JSON.stringify({state:can.task.state,error:can.task.result.error})); console.log("GET1",JSON.stringify({state:after.task.state,error:after.task.result.error})); console.log("CANCEL2",JSON.stringify(repeat)); console.log("MISS",JSON.stringify(missing)); console.log("EMPTY",JSON.stringify(invalid)); a.close(); c.close(); r.kill("SIGINT");'
GEN_STABLE true 45668c5a-61ce-4afb-bd1d-e828d18aa4ce
NODE_KEYS instance_id,session_id,state,last_heartbeat,connected
CONNECTED true
SESSION_KEYS ack,close,deregister,heartbeat,register,send,status,taskCancel,taskGet,taskList
WORKING_ROW {"state":"working","started_at":1789549629160}
CANCEL1 {"state":"failed","error":"cancelled"}
GET1 {"state":"failed","error":"cancelled"}
CANCEL2 {"code":"TASK_ALREADY_FINAL"}
MISS {"code":"TASK_NOT_FOUND"}
EMPTY {"code":"INVALID_PARAMS"}
```

```sh
$ node --input-type=module -e 'import {createRegistry} from "./oamp/src/registry.js"; const r=createRegistry(); r.register({instanceId:"online",sessionId:"s1",connId:1,now:100}); r.register({instanceId:"disconnected",sessionId:"s2",connId:2,now:100}); r.onConnClosed(2); r.register({instanceId:"offline",sessionId:"s3",connId:3,now:100}); r.markOffline("offline",200); const t=r.createTask({taskId:"local-task",from:"a",to:"b",now:100,label:"probe"}); r.recordTaskUpdate({taskId:"local-task",from:"b",at:150,state:"working",detail:{step:1}}); const w=r.listTasks({state:"working"})[0]; const c=r.finishTask({taskId:"local-task",from:"a",at:160,state:"failed",result:{error:"cancelled"}}); const again=r.finishTask({taskId:"local-task",from:"a",at:170,state:"completed",result:{error:"changed"}}); console.log("NODE_KEYS",Object.keys(r.snapshot()[0]).join(",")); console.log("STATES",JSON.stringify(Object.fromEntries(r.snapshot().map(n=>[n.instance_id,{state:n.state,connected:n.connected}])))); console.log("WORKING",JSON.stringify({state:w.state,started_at:w.started_at,keys:Object.keys(w)})); console.log("CANCEL",JSON.stringify({state:c.task.state,error:c.task.result.error})); console.log("REPEAT",JSON.stringify({error:again.error,state:again.task.state,error_kept:again.task.result.error}));'
NODE_KEYS instance_id,session_id,state,last_heartbeat,connected
STATES {"disconnected":{"state":"online","connected":false},"offline":{"state":"offline","connected":false},"online":{"state":"online","connected":true}}
WORKING {"state":"working","started_at":150,"keys":["task_id","from","to","state","label","created_at","started_at","updated_at","updates","updatesTruncated","model"]}
CANCEL {"state":"failed","error":"cancelled"}
REPEAT {"error":"TASK_ALREADY_FINAL","state":"failed","error_kept":"cancelled"}
```

```sh
$ node --input-type=module -e 'import {spawnSync} from "node:child_process"; const a=spawnSync(process.execPath,["--input-type=module","-e","import {generation} from \\"./oamp/src/registry.js\\"; console.log(generation)"],{encoding:"utf8"}).stdout.trim(); const b=spawnSync(process.execPath,["--input-type=module","-e","import {generation} from \\"./oamp/src/registry.js\\"; console.log(generation)"],{encoding:"utf8"}).stdout.trim(); console.log("GEN_RESTART_CHANGED",a!==b,a,b);'
GEN_RESTART_CHANGED true 4be02bd8-6b8d-4f29-b4e2-02958c3a6ded 2ca7e465-5565-4ea4-b9b4-acd55e25990f
```

### 标准 2：改动面封闭性

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives diff --name-only 72b659f..HEAD -- oamp docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md
oamp/sdk/uds.js
oamp/src/registry.js
oamp/src/router.js
```

### 标准 3：证据命令可复核且无外部脚本

```sh
$ node --check oamp/src/registry.js; node --check oamp/src/router.js; node --check oamp/sdk/uds.js; echo "exit=$?"
exit=0
```

### 标准 4：既有面与零依赖边界

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives diff --name-status 72b659f -- oamp/package.json oamp/src/persist.js; echo "exit=$?"
exit=0
```

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives diff --check 72b659f -- oamp/src/registry.js oamp/src/router.js oamp/sdk/uds.js; echo "exit=$?"
exit=0
```

### 逐条判定

1. `generation` 同进程稳定、重启变化；节点 `connected` 投影、三态、任务 `started_at`、取消及 SDK 会话面均由第一组运行输出覆盖：**通过**。
2. 变更文件仅为本 PR 三个实现文件与本 PR 文档：**通过**。
3. 命令均为工作区内联命令，无外部脚本、无占位值；每条命令均附输出块：**通过**。
4. 终态幂等拒写、节点字段与零依赖边界由第二组及边界命令覆盖；既有八方法的基线对照由独立验证报告确认：**通过**。

### 提交前自查

```sh
$ grep -nE '/tmp/|<[a-z_]+>' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md"; echo "exit=$?"
126:$ grep -nE '/tmp/|<[a-z_]+>' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md"; echo "exit=$?"
exit=0
```
