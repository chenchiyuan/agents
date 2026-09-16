# pr-001-tasks.md — pr-001 内部任务列表（Router 侧状态基元）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-001-router-status-primitives.md`
**PR worktree 分支**: `feat/0029-pr-001-router-status-primitives`（base = `72b659f`，= 迭代分支 tip，落盘时零 diff）｜ **任务总数**: **8**（T1~T8）｜ **依赖图**: **无环**（见 §2）
**性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（10 条验收标准 / 5 个功能点 F05·F08·F13·F15·F16）+ `architecture.md`（§4 A-04/A-07/A-10/A-12/A-13、§5.2 追加字段表、§5.3 新增方法、§5.5 改动面、§6.1 Z-3/Z-7、§7 L1-02）+ `prd/{F05,F08,F13,F15,F16,G01}*.md` + 代码库实读（§0.3 逐条带 `文件:行号`）

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/registry.js` | 改（3 处追加） | `snapshot()` + `connected`；任务条目 + `started_at`；模块级 + `generation`（**T2 / T3**） |
| 2 | `oamp/src/router.js` | 改（2 处追加） | `router.status` 结果 + `generation`；`dispatch` + `router.task_cancel` 分支（**T4 / T5**） |
| 3 | `oamp/sdk/uds.js` | 改（1 方法 + 头注） | 会话方法 + `taskCancel`（与既有 8 个 1:1 同体例）（**T6**） |
| 4 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md` | 改（仅「验收证据」段） | 取证输出回填（**T8**） |

> 本文件 `prs/pr-001-router-status-primitives-tasks.md` 是本阶段产物，不计入改动面（PR 文件「文件范围」明列自身；本 tasks 文件为阶段 5 增量产物、与 PR 文件同目录）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动**（PR 文件「不触碰」+ architecture §5.5 中不属本 PR 的行）：`oamp/src/web.js`、`oamp/src/transport.js`、`oamp/src/persist.js`、`oamp/src/status.js`、`oamp/src/task.js`、`oamp/src/agent.js`、`oamp/src/config.js`、`oamp/src/log.js`、**`oamp/src/rpc.js`**、`oamp/sdk/surface.js`、`oamp/sdk/index.js`、`oamp/sdk/doctor.js`、`oamp/sdk/http.js`、`oamp/sdk/errors.js`、`oamp/bin/**`、`oamp/package.json`、`oamp/API.md`、`oamp/llms.txt`、`oamp/skill/hub.md`、`oamp/web/**`、`oamp/README.md`、`roles/**`、`docs/**`（除 PR 文件与本文件）。
- **不新增**：Router 方法（除 `router.task_cancel` 这 1 个）、UDS 方法（除 `taskCancel` 这 1 个）、字段（除 `connected` / `started_at` / `generation` 这 3 个）、日志事件、配置键、env 键、第三方依赖、测试文件、目录。
- **不做**（属其他 PR）：`sdk/surface.js` 的 `UDS_ENTRIES` 8 → 9 与 `skill/hub.md` 层清单同步（**pr-007**，§7 L1-02）；`/api/*` 新路由、`ERR_CODE.STALE_EPOCH`、投影轮询、名册提示（**pr-002/pr-003/pr-005**）；`hub uds router.task_cancel` 的 **CLI 入口**（同上，见 §7 疑问 2）。
- **`rpc.js` 不改的连带约束**：`ERR`（`rpc.js:8-20`）**没有** `TASK_NOT_FOUND` / `TASK_ALREADY_FINAL` 键，且该文件不在本 PR 文件范围 ⇒ T5 的错误码**用既有字面量体例**（先例：`router.js:226` 的 `sendError(respond, 'TASK_NOT_FOUND', …)`），**不得**新增 `ERR` 键。
- **不新增日志事件**：`TASK_CANCEL` 一类事件不在 architecture 的任何改动面枚举内（§5.5 对 `router.js` 只列 2 项）⇒ 不追加，追加即越界。

### 0.3 读码事实锚点（2026-09-16 实读，base `72b659f`；判据基础）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | `snapshot()` 投影 = `{instance_id, session_id, state, last_heartbeat}` 四键、按 `instance_id` 升序排序、不暴露连接句柄 | `registry.js:153-166` |
| **A2** | `onConnClosed(connId)` 只做 `connIdent.delete` + `entry.connId = null`；**不动** `entry.state`（条目保持 `online` 至租约到期）⇒ `state='online' && connected=false` 的窗口客观存在 | `registry.js:110-121`（`entry.connId = null` 在 `:116`） |
| **A3** | `markOffline` 置 `state='offline'` 且 `connId=null`（墓碑） | `registry.js:141-150` |
| **A4** | 任务条目由 `createTask` 建（schema 见 `registry.js:~192` 注释）；`recordTaskUpdate` 的 working 分支 = `if (state === 'working' && task.state !== 'completed' && task.state !== 'failed') { task.state = 'working' }` | `registry.js:196-213`、`registry.js:219-232`（working 分支 `:227-229`） |
| **A5** | `finishTask` 已终态**幂等拒写**：`if (task.state === 'completed' \|\| task.state === 'failed') return { task, error: 'TASK_ALREADY_FINAL' }`；写终态时 `task.result = { ...(result \|\| {}), at }`（⇒ `error:'cancelled'` 会与 `at` 并存）；`from` 入参**未被函数体消费**（死参数，传值不产生行为） | `registry.js:238-248` |
| **A6** | `listTasks` 是**显式逐键投影**（10 键）；`getTask` 返回**原条目对象**（`registry.js:250-252`） | `registry.js:255-273`、`registry.js:250-252` |
| **A7** | `router.status` 现存返回 = `respond.ok({ nodes: registry.snapshot() })`；`router.task_get` / `router.task_list` 均为**任意连接可用**（不校验 `ident`）；`dispatch` 分发表 = 顺序 `switch`，默认分支回 `-32601` | `router.js:379-383`、`router.js:384-404`、`router.js:104`、`router.js:403-406` |
| **A8** | `sendError(respond, code, message)` = `respond.error(JSONRPC_CODE.APP_ERROR, message, code)` ⇒ 机器码落在 `data.code`；客户端侧 `RpcError.dataCode`（`rpc.js:31-37`）承载它，`sdk/uds.js` 的 `toHubError` 把它映射成 `HubError.code` | `oamp/src/router.js:93-95`、`oamp/src/rpc.js:31-37`、`oamp/sdk/uds.js:79-87` |
| **A9** | `router.task_get` 的非法入参体例：`typeof taskId !== 'string' \|\| !isValidMessageId(taskId)` ⇒ `sendError(respond, ERR.INVALID_PARAMS, 'task_get 需携带合法 task_id')` | `router.js:385-390` |
| **A10** | `sdk/uds.js` 会话返回面 = 8 方法 + `close()`；`connect()` 头注第 2 行逐字列出方法清单（"8 个 Router 方法 1:1"）；所有方法经同一个 `request()` → `peer.request`（帧编解码唯一真源 = `src/rpc.js`） | `oamp/sdk/uds.js:2`、`:133-137`、`:139-178` |
| **A11** | 层 B 的 CLI 入口表 `UDS_ENTRIES` = **固定 8 条**（`router.status` / `router.task_get` / `router.task_list` 在内），`--params` 是唯一入参通道；未知方法名 ⇒ 查表失败（用法错误），**无通配透传** | `oamp/sdk/surface.js:223-295`、`oamp/sdk/cli.js:~40-70` |
| **A12** | `oamp status` 只渲染固定 4 列（`COLUMNS` = `instance_id`/`session_id`/`state`/`last_heartbeat`）⇒ 追加 `connected` 不影响其输出；`cluster.js` 的 `queryNodes` 只读 `nodes` | `oamp/src/status.js:20-25` |
| **A13** | `web.js` 的 `/api/calls` 对 `router.task_list` 行**逐键显式映射**（`started_at: t.created_at` 是它自己的列，不来自任务条目）⇒ listTasks 追加一列不会改变既有 `/api/calls` 输出 | `oamp/src/web.js:1137-1151` |
| **A14** | 既有 env 键含 `OAMP_SOCKET`（socket 路径覆盖）与 `OAMP_HEARTBEAT_TIMEOUT_MS`（默认 30000，即租约超时）——**取证可复用，不算新增 env** | `oamp/src/config.js:29-34`、`:144` |
| **A15** | 本仓**无任何 `.test.js`**（`find . -name '*.test.js'` = 0）；`tests/` 仅两个 shell 脚本 ⇒ 本 PR 的验收**只能靠"实跑 + 一次性脚本"**，且**不新增测试文件**（PR 文件范围不含测试面） | 实测 |
| **A16** | agent 侧的 working 写入点：shell 执行器开跑即发 `task.update {state:'working', event:'started'}`（omp-daemon 执行器同构）⇒ 任务条目进入 `working` 可被 `sleep` 类长命令稳定观测 | `oamp/src/agent.js:425`（shell）、`:197`（omp-daemon） |
| **A17** | 长驻进程的就绪信号：router 打 `ROUTER_READY`；节点注册由 **router 侧**打 `AGENT_REGISTERED instance=<id>`（事件行格式见 `log.js:1-2`） | `oamp/src/router.js:483`（`logger.event('ROUTER_READY'…)`）、`oamp/src/router.js:168`（`AGENT_REGISTERED`）、`oamp/src/log.js:16-18` |
| **A18** | `oamp task` 的两个渲染器都**逐键渲染固定列**、不遍历对象键：`renderTask` 固定 8 项（`task_id/state/label/from/to/created_at/updated_at/updates` + 明细）⇒ 条目新增 `started_at` 不会被渲染；`renderList` 固定 5 列（`task_id/state/to/label/created_at`） | `oamp/src/task.js:79-91`、`oamp/src/task.js:113-120` |

### 0.4 本 PR 内冻结契约（每个任务都必须遵守；跨 PR 接缝在此一次定死）

1. **`snapshot()` 追加形态**〔追溯：PR 验收 2/3；architecture §4 A-13、§5.2〕：既有 4 键**名 / 取值 / 顺序**逐字不变，`connected` **追加在 `last_heartbeat` 之后**，取值 = `entry.connId !== null`（boolean）；仍按 `instance_id` 升序；仍不暴露任何连接句柄（`connId` 本身不出现在投影里）。
2. **`generation` 的形态与位置**〔追溯：PR 验收 1；§4 A-07、§5.2〕：`registry.js` 导出**模块级常量**（模块求值时 `randomUUID()` **一次**）⇒ 同一进程内恒定、进程重启即变；`router.status` 结果对象**追加顶层键** `generation`（与 `nodes` 平级），取值 = 该常量。**导出名自定**（L3），**结果键名固定为 `generation`**（下游 pr-005 只读该键）。
3. **`started_at` 的写入面**〔追溯：PR 验收 4；§4 A-04〕：任务条目新增键 `started_at`，`createTask` 初始化为 `null`；在 `recordTaskUpdate` 的**既有非终态 working 分支内**（A4 的 `:227-229`）且 `task.started_at === null` 时写入 `at`（首次观察到 `working`）；**不覆盖**已写值。`listTasks` 行投影**追加** `started_at`（PR 文件「验收证据」明写"`task_list` 条目的 `started_at`"）；`getTask` 返回原条目 ⇒ 自动携带。既有 10 键名/取值/顺序不变。
4. **`router.task_cancel` 的契约**〔追溯：PR 验收 5/6/7；§5.3、§4 A-10〕：
   - 入参 `{task_id}`；`typeof task_id !== 'string' || !isValidMessageId(task_id)` ⇒ `sendError(respond, ERR.INVALID_PARAMS, …)`（体例对齐 A9）；
   - 合法 ⇒ `registry.finishTask({ taskId: task_id, from: ident ? ident.instance_id : null, at: Date.now(), state: 'failed', result: { error: 'cancelled' } })`（`finishTask` 既有实现会补 `at`；`from` 是死参数，见 A5）；
   - `error === 'TASK_NOT_FOUND'` ⇒ `sendError(respond, 'TASK_NOT_FOUND', …)`；`error === 'TASK_ALREADY_FINAL'` ⇒ `sendError(respond, 'TASK_ALREADY_FINAL', …)`（**字面量**，见 §0.2 末两条）；
   - 成功 ⇒ `respond.ok({ task })`（原条目对象）；
   - **不校验身份**（任意连接可用，与 `router.status` / `router.task_get` / `router.task_list` 同款；PR 验收证据行的调用形态为 `--params '{"task_id":…}'`、不带 `--as`）；
   - **不改 `finishTask` 一个字符**（幂等拒写是它的既有语义，取消只是复用）。
5. **终态词表**〔追溯：PR 验收 7；§6.1 Z-3〕：`state` 恒为既有四值（`submitted`/`working`/`completed`/`failed`）；取消复用 `failed` + `result.error='cancelled'`；不新增第五取值、不改既有词表校验集合（`router.js:396-399` 的过滤白名单不动）。
6. **`sdk/uds.js` 追加纪律**〔追溯：PR 验收 8；§5.5〕：`connect()` 返回面**只追加** `taskCancel(taskId)`，实现体 = `return request('router.task_cancel', { task_id: taskId })`（与 `taskGet` 同体例，位置紧随三个 `router.*` 方法）；**不新增 import**（帧编解码仍全经 `src/rpc.js` 的 `RpcPeer`，A10）；文件头注释第 2 行的方法清单同步为 **9 个**。
7. **零依赖/零配置/零存储**〔追溯：PR 验收 9；§6.1 Z-15/Z-10〕：`package.json` 零 diff；不读/不新增 env 与配置键；`persist.js` 零 diff、DB 表结构零改动；本 PR 不写任何文件（除 §0.1 的 4 个文件）。
8. **既有面零回归**〔追溯：PR 验收 2/10；§6.1 Z-3/Z-7〕：既有 8 个 UDS 方法的语义与响应体逐字不变；`oamp status` 输出逐字不变（`status.js` 零改动 + A12）；`oamp task status/list` 输出逐字不变（`task.js` 零改动）。

### 0.5 PR 验收标准 → 任务映射（10 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | `router.status` 结果含 `generation`（非空字符串；同进程恒定；重启变化） | **T2**（值）+ **T4**（暴露面）+ T7（重启变化取证） |
| AC2 | 节点投影含 `connected`；既有 4 字段不变；`oamp status` 逐字不变 | **T2** + **T7** |
| AC3 | 三态可判据（`online&&connected` / `online&&!connected` / 墓碑） | **T2** |
| AC4 | 任务条目含 `started_at`（首次 working 写入；未进入过 `null`；既有字段名与值域不变） | **T3** |
| AC5 | `router.task_cancel` 生效：`failed` + `result.error='cancelled'`；随后 `task_get` 即终态 | **T5**（+ T6 经 sdk 面复核） |
| AC6 | 重复 ⇒ `TASK_ALREADY_FINAL`；不存在 ⇒ `TASK_NOT_FOUND`；缺参/非法 ⇒ `INVALID_PARAMS` | **T5** |
| AC7 | 终态仍四值；`finishTask` 拒写分支未被改写、无第五取值 | **T5** + **T8**（零改动核查） |
| AC8 | `connect()` 仅追加 `taskCancel`；既有 8 方法签名不变；走既有 `RpcPeer` 路径 | **T6** |
| AC9 | 零新依赖 / 零新 env / 零新配置键；DB 表结构未触碰 | **T8** |
| AC10 | 既有 8 个 UDS 方法语义与响应体未变（改动前后逐条比对） | **T1**（基线）+ **T7**（比对） |

---

## 1. 任务列表

### T1: 改动前基线取证（既有 8 方法 + `oamp status` + `task_list`/`task_get` 输出）

- **服务哪条 AC**: AC10（改动前后比对的基线生产者）；同时为 AC2 的 `oamp status` 项留证。
- **描述**: 在任何源码改动**之前**，起一次干净的 Router + agent，跑 §4 的全部取证命令族，把 stdout 原样落到 `/tmp/0029-pr-001-baseline/`（**不进仓库**）。
- **文件/锚点**: 零源码改动。产出 `/tmp/0029-pr-001-baseline/*.out`。
- **步骤**:
  1. 按 §4.1 起 router + agent（临时 socket，独立于既有 `.runtime/router.sock`）。
  2. 依次执行并各存一份原始输出：`hub uds agent.register`（用独立实例名）、`hub uds agent.heartbeat --as <id> --params '{}'`、`hub uds agent.deregister --as <id>`、`hub uds message.send --as <id> --params '{"message":{…}}'`、`hub uds message.ack --as <id> --params '{}'`、`hub uds router.status`、`hub uds router.task_get --params '{"task_id":"<存在的 id>"}'`、`hub uds router.task_list --params '{}'`。
  3. `oamp status`、`oamp task status <id>`、`oamp task list` 各存一份。
  4. 记录当时 `git -C <worktree> rev-parse HEAD` 与 `git status --short`（应为空）到 `baseline/meta.txt`。
- **验收判据（可执行）**:
  1. `/tmp/0029-pr-001-baseline/` 下存在 ≥ 11 份非空输出文件，且 `meta.txt` 的 HEAD = `72b659f`、`git status --short` 为空行。
  2. 每份文件是**原始 stdout**（未加工、未摘要）——T7 的逐字比对依赖它。
- **前置依赖**: 无（但见 §3：必须在任何源码改动前执行）
- **优先级**: P0

---

### T2: `oamp/src/registry.js` —— `snapshot()` 追加 `connected` + 模块级 `generation`

- **服务哪条 AC**: AC2（`connected` 部分 + 既有 4 字段不变）、AC3（三态）、AC1（`generation` 值的生产者）
- **描述**: 在 `snapshot()` 的四键投影后追加 `connected: entry.connId !== null`；在模块顶层新增模块级 `generation` 常量（`randomUUID()` 求值一次）并导出。
- **文件/锚点**:
  - `oamp/src/registry.js:153-166`（`snapshot()` 投影对象；追加位置 = `last_heartbeat` 之后）；同函数注释行 `:152` 的"4 字段快照投影"需同步为"5 字段"（注释同步，非行为）。
  - `oamp/src/registry.js:5`（`import { randomUUID } from 'node:crypto'` 已存在，**不新增 import**）；模块级常量位置 = 既有模块级导出区（`MAX_ANNOUNCED_INTERVAL_MS` / `newSessionId` 一带，`:17-28`）。
  - `oamp/src/registry.js:276-295`（return 对象）——**不加**新键（generation 走模块级导出，不是 registry 实例方法）。
- **步骤**: ① 加模块级常量；② `snapshot()` 追加一键；③ 注释同步。
- **验收判据（可执行）**:
  1. **模块面**（一次性 `node --input-type=module -e` 脚本 import `./oamp/src/registry.js`）：`createRegistry()` → `register({instanceId:'a', sessionId:'s', connId:1, now:1})` → `snapshot()` 返回 `[{instance_id:'a', session_id:'s', state:'online', last_heartbeat:1, connected:true}]`，且 `Object.keys(row)` **逐字**顺序 = `['instance_id','session_id','state','last_heartbeat','connected']`。
  2. **三态可判据（同一脚本内，三段各一断言）**：① 注册后 ⇒ `state='online' && connected===true`；② `onConnClosed(1)` 后 ⇒ **同一次** `snapshot()` 里 `state==='online' && connected===false`（`connId` 已被置 null、Deregister 未发生）；③ `markOffline('a', now)` 后 ⇒ `state==='offline' && connected===false`。三态在同一进程内依次可区分。
  3. **既有 4 字段不变**：②/③ 的 `session_id` / `last_heartbeat` 取值与注册时一致（`state` 除三态转换外不被 snapshot 改写）。
  4. **`generation` 恒定**：同一进程内两次读取该导出值相等；格式 = 非空 string（UUID 形态）。
  5. **进程面**（可选加强，若 router 已起且 T4 未完成也可做）：`hub uds router.status` 的节点对象**已含** `connected`（该键经 T2 即通，不依赖 T4）。
- **前置依赖**: T1（基线必须先于任何源码改动）
- **优先级**: P0

---

### T3: `oamp/src/registry.js` —— 任务条目 `started_at`

- **服务哪条 AC**: AC4
- **描述**: `createTask` 初始化 `started_at: null`；`recordTaskUpdate` 在既有非终态 working 分支内、`started_at === null` 时写入 `at`；`listTasks` 行投影追加 `started_at`。
- **文件/锚点**:
  - `oamp/src/registry.js:196-213`（`createTask` 条目字面量；`started_at` 加在 `created_at` 附近，**不改既有 10 个键的键名与取值**）
  - `oamp/src/registry.js:227-229`（working 分支；写入语句放该分支内）
  - `oamp/src/registry.js:255-273`（`listTasks` 投影；`started_at` 追加在 `created_at` 之后）
  - `oamp/src/registry.js:~192` 条目 schema 注释同步（含 `started_at`）
  - **不改** `finishTask`（`:238-248`）与 `getTask`（`:250-252`）
- **步骤**: ① `createTask` 加初值；② working 分支内加"首次写"；③ `listTasks` 投影加列；④ 注释同步。
- **验收判据（可执行，一次性脚本驱动真 registry）**:
  1. `createTask({taskId:'t1', from:'main', to:'ag', now:1000, label:null})` 后 `getTask('t1').started_at === null`；`listTasks({})[0].started_at === null`。
  2. `recordTaskUpdate({taskId:'t1', from:'ag', at:2000, state:'working', detail:{}})` 后 `started_at === 2000`。
  3. 再次 `recordTaskUpdate({… at:3000, state:'working' …})` 后 `started_at` **仍为 2000**（不覆盖）。
  4. 仅有非 working 更新（`state:null`）的任务 ⇒ `started_at === null`（未进入过 working）。
  5. `listTasks({state:'working'})` 行含 `started_at`，且该行既有键（`task_id/from/to/state/label/created_at/updated_at/updates/updatesTruncated/model`）**键名与取值逐字不变**。
  6. `finishTask` 后再 `recordTaskUpdate({state:'working'})` ⇒ `started_at` 不变（既有的终态不因新更新改状态；`started_at` 同样不被改写）〔口径见 §6 MI-P1〕。
- **前置依赖**: T1
- **优先级**: P0

---

### T4: `oamp/src/router.js` —— `router.status` 结果追加 `generation`

- **服务哪条 AC**: AC1（暴露面）
- **描述**: `router.status` 分支的 `respond.ok({ nodes: registry.snapshot() })` 追加顶层键 `generation`；import 行引入 `registry.js` 的 generation 导出。
- **文件/锚点**: `oamp/src/router.js:379-383`（`case 'router.status'`）；`oamp/src/router.js:13`（既有 `import { createRegistry, … } from './registry.js'` —— 在**同一条 import 语句**内追加具名导入，不新增 import 语句）。
- **步骤**: ① import 追加；② `respond.ok({ nodes: …, generation })`。
- **验收判据（可执行，真进程）**:
  1. `hub uds router.status` 输出 JSON 含顶层 `generation`（非空 string）与 `nodes`（数组），**键名逐字**为 `generation`。
  2. 同一 router 进程内连续两次调用 ⇒ 两次 `generation` **相等**（`jq -r .generation` 比对）。
  3. 停掉 router 重启 ⇒ `generation` **不相等**（PR 验收 1 的"重启后取值变化"；证据进 T7）。
  4. 既有 `nodes` 行**仍含** 4 个既有键 + `connected`（顺序同 T2），且 `oamp status` 输出与 T1 基线**逐字节相同**（`diff` 退出 0）。
- **前置依赖**: T1、T2（generation 常量由 T2 提供）
- **优先级**: P0

---

### T5: `oamp/src/router.js` —— 新增 `router.task_cancel` 分支

- **服务哪条 AC**: AC5、AC6、AC7
- **描述**: 在 `dispatch` 的 `router.task_get` / `router.task_list` 相邻处新增 `case 'router.task_cancel'`，入参校验 → `registry.finishTask(… failed / {error:'cancelled'})` → 三种出口（成功 / `TASK_NOT_FOUND` / `TASK_ALREADY_FINAL`）。
- **文件/锚点**: `oamp/src/router.js:384-404`（`router.task_get` / `router.task_list` 两个 case 之间的插入位）；错误出口复用既有 `sendError`（`oamp/src/router.js:93-95`）；入参校验体例对齐 `oamp/src/router.js:385-390`（A9）。
- **步骤**: ① 写 case（按 §0.4 契约 4 逐条）；② 不加日志事件、不动 `finishTask`、不动 `router.task_list` 的 state 白名单。
- **验收判据（可执行，真进程；调用载体见 §4.3）**:
  1. **生效（AC5）**：对一条 `state='working'` 的任务（用 `sleep 60` 制造，A16）调用 ⇒ 返回体含 `task`，且 `task.state==='failed'`、`task.result.error==='cancelled'`、`task.result.at` 为数字时刻、`task.updated_at === task.result.at`。
  2. **当刻终态（AC5）**：同一调用返回后立刻 `hub uds router.task_get --params '{"task_id":"<id>"}'` ⇒ `state==='failed'` 且 `result.error==='cancelled'`（不出现"取消后仍在跑"）。
  3. **幂等（AC6）**：对同一 id 再调用一次 ⇒ 返回错误，机器码 = `TASK_ALREADY_FINAL`；随后的 `task_get` 与第 2 步的快照**逐字相同**（`state` / `result.error` / `result.at` / `updated_at` 均未被改写）。
  4. **不存在（AC6）**：`{"task_id":"task-does-not-exist"}` ⇒ 机器码 `TASK_NOT_FOUND`。
  5. **参数非法（AC6）**：`{}`（缺失）与 `{"task_id":123}`（类型错）与 `{"task_id":""}`（空串）三种 ⇒ 机器码 `INVALID_PARAMS`，且错误文案体例与 `task_get` 同款（`sendError` 出口）。
  6. **终态词表（AC7）**：取消后 `hub uds router.task_list --params '{}'` 的该行 `state ∈ {submitted, working, completed, failed}`；`git diff` 中 `finishTask` 函数体**零改动**（`git diff -U0 oamp/src/registry.js` 不含 `:238-248` 行段）。
  7. **身份无关**（口径见 §6 MI-P2）：上述全部调用**不带** `--as` 亦成立；带 `--as <已注册实例>` 亦成立且结果相同。
  8. **被取消调用的后续回报不污染状态面**：`sleep` 结束后 agent 仍会发 `task.result` ⇒ Router 侧 `finishTask` 拒写，`task_get` 的 `state` **仍为** `failed` / `error='cancelled'`（architecture §4 A-10 的明文已知局限的正面证据）。
- **前置依赖**: T1（**仅**"基线先行"这一条；代码面**独立于** T2/T3/T4——取消分支不消费 `generation` 也不消费 `started_at`；同文件施工顺序见 §3）
- **优先级**: P0

---

### T6: `oamp/sdk/uds.js` —— 会话方法 `taskCancel` + 头注清单同步

- **服务哪条 AC**: AC8（+ AC5 的库面复核路径）
- **描述**: `connect()` 返回面追加 `taskCancel(taskId)`（紧随 `taskList`），头注方法清单由 8 → 9。
- **文件/锚点**: `oamp/sdk/uds.js:2`（头注"8 个 Router 方法 1:1"）；`oamp/sdk/uds.js:167-169`（`taskList(query)` 之后追加）；**不新增 import**（A10）。
- **步骤**: ① 追加方法；② 改头注两处（方法清单 + 计数）。
- **验收判据（可执行）**:
  1. **方法签名**：`connect()` 返回对象的键集合 = 既有 9 键（8 方法 + `close`）+ `taskCancel` = **10 键**；既有 9 键的**函数 arity 与名字**不变（`register(1) heartbeat(1) send(1) ack(1) status(0) taskGet(1) taskList(1) deregister(0) close(0)`）。
  2. **真实调用往返**：一次性脚本经 `createHub({socketPath}).uds.connect()` 调 `taskCancel(<working id>)` ⇒ 解开为 `{task:{state:'failed', result:{error:'cancelled', …}}}`；对同一 id 再调 ⇒ 抛错且 `err.code === 'TASK_ALREADY_FINAL'`（走 `toHubError` 的既有一跳，A8）。
  3. **零第二套编解码**：`git diff oamp/sdk/uds.js` 不含新增 import 行；新方法体只有一行 `return request('router.task_cancel', { task_id: taskId });`。
- **前置依赖**: T5（该方法必须打到已存在的 Router 方法上才能验收）
- **优先级**: P0

---

### T7: 既有面回归比对（改动前后逐字）+ 重启取证

- **服务哪条 AC**: AC10、AC2（`oamp status` 项）、AC1（重启变化）
- **描述**: 在与 T1 **同一套命令族、同一组入参**下重跑一遍，逐字节比对；补做 router 重启的 `generation` 变化取证。
- **文件/锚点**: 零源码改动；产出 `/tmp/0029-pr-001-after/*.out` + `diff` 结果。
- **步骤**: ① 重启一套干净的 router + agent（新 socket 或同 socket 重建）；② 重跑 T1 的全部命令族到 `after/`；③ `diff -u baseline/<f> after/<f>` 逐份比对；④ 记录 `generation` 重启前后取值。
- **验收判据（可执行）**:
  1. 8 个既有 UDS 方法的返回体：与基线**逐字节相同**的部分 = 键集与既有键取值；**允许的差异**只有 `session_id`（每次注册新生成）与 `last_heartbeat`（时刻）——比对时须把这两处按"同形不同值"判定并写明理由，其余任一字节差异 = 回归失败。
  2. `oamp status` 输出：**0 字节差异**（`diff` 退出 0；列数与列名不得出现 `connected`）。
  3. `oamp task status <id>` / `oamp task list` 输出：**0 字节差异**——两个渲染器都逐键渲染固定列（A18：`renderTask` 8 项 / `renderList` 5 列），条目新增 `started_at` 不进入渲染；`task.js` 零改动。
  4. 重启前后 `generation` 两个取值不相等，且各自非空。
- **前置依赖**: T1、T2、T3、T4、T5、T6
- **优先级**: P1

---

### T8: 零影响核查 + 验收证据落盘（PR 文件「验收证据」段）

- **服务哪条 AC**: AC9、AC7（零改动面）、AC1~AC10 的证据载体齐备
- **描述**: ① 机械核查改动面封闭性；② 把 T1~T7 的原始输出按 PR 文件「验收证据」段要求的五类载体回填进 PR 文件。
- **文件/锚点**: `prs/pr-001-router-status-primitives.md` 的 **「验收证据」** 段（只改该段，**不改七字段**）。
- **步骤**:
  1. `git -C <worktree> diff --stat` ⇒ 仅 `oamp/src/registry.js`、`oamp/src/router.js`、`oamp/sdk/uds.js`（+ PR 文件自身）四个路径。
  2. `git diff oamp/package.json` ⇒ 空；`git diff oamp/src/persist.js` ⇒ 空；`git diff -- oamp/src/config.js` ⇒ 空；全仓新增 env 读取 = 0（`git diff | grep -c "process.env"` = 0）。
  3. `finishTask`（`registry.js:238-248`）函数体零改动；`router.js` 的 `router.task_list` state 白名单（`:396-399`）零改动。
  4. 回填五类证据（PR 文件原文列举）：`router.status` 两次调用输出（`generation` + 节点 `connected`）+ `task_list` 条目的 `started_at` + `task_cancel` 四条判据输出（生效 / 重复 / 不存在 / 参数非法）+ 既有 8 方法回归比对结果 + `oamp status` 输出。
- **验收判据（可执行）**:
  1. 第 1~3 步的核查命令输出**逐条出现在 PR 文件「验收证据」段**（原文粘贴，不做二次加工）。
  2. AC1~AC10 每条都能在「验收证据」段指到对应的一条原始输出（缺一即 T8 未完成）。
  3. `git diff` 的**改动路径集合** ⊆ {`oamp/src/registry.js`, `oamp/src/router.js`, `oamp/sdk/uds.js`, `prs/pr-001-router-status-primitives.md`, `prs/pr-001-router-status-primitives-tasks.md`}（`tasks.md` 为阶段产物，PR 合并前置不受影响）。
- **前置依赖**: T7
- **优先级**: P1

---

## 2. 依赖图

```
T1 ─┬─> T2 ──> T4 ─────────────┐
    ├─> T3 ────────────────────┤
    └─> T5 ──> T6 ─────────────┴──> T7 ──> T8
```

边（逐条，均为真实约束；共 13 条）：
- `T1 → T2`、`T1 → T3`、`T1 → T4`、`T1 → T5`：**基线必须在任何源码改动前捕获**——改动后再取"改动前"基线不可复现（AC10 的判据基础）。
- `T2 → T4`：`router.status` 只能暴露 T2 导出的 `generation` 常量。
- `T5 → T6`：`taskCancel` 的库面验收必须打到已存在的 Router 方法。
- `T1 → T7`、`T2 → T7`、`T3 → T7`、`T4 → T7`、`T5 → T7`、`T6 → T7`：回归比对需要全部改动 + 基线。
- `T7 → T8`：证据落盘需要 T7 的比对输出。

**无环**：上述边集合中不存在回到已访问节点的路径（拓扑序 T1 < T2 < T3 < T4 < T5 < T6 < T7 < T8 即满足全部边的方向）。

**最长依赖链（本 PR 内部任务图的关键路径，5 节点）**：`T1 → T2 → T4 → T7 → T8`（另一条等长链 `T1 → T5 → T6 → T7 → T8`）。
**关键路径任务**：**T1**（证据基线的唯一生产者）→ **T2**（`connected` / `generation` 两个值的唯一生产者，T4 依赖它）→ **T4** → **T7** → **T8**。

---

## 3. 执行顺序（dev 单次调用 ≤ 30 分钟上限制下的增量策略，见 DC-06/DC-08）

**顺序**：`T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8`（与拓扑序一致；T3 与 T2 同为 `registry.js`、T5 与 T4 同为 `router.js`，**同文件连续施工**避免交错改同一文件；这不新增依赖边——T3 与 T4/T5 之间无数据依赖）。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立落盘）：
| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | T1 基线目录（11+ 份原始输出） | §T1 判据 1/2 |
| 2 | `registry.js`：`connected` + `generation` | §T2 判据 1~4（模块脚本，无需起进程） |
| 3 | `registry.js`：`started_at` | §T3 判据 1~5 |
| 4 | `router.js`：`router.status` + `generation` | §T4 判据 1~4 |
| 5 | `router.js`：`router.task_cancel` | §T5 判据 1~8 |
| 6 | `sdk/uds.js`：`taskCancel` | §T6 判据 1~3 |
| 7 | 回归比对结果 | §T7 判据 1~4 |
| 8 | 证据落盘 + 零影响核查 | §T8 判据 1~3 |

**若单次调用未跑完**：按上表在**任务边界**停下（不得把半改的 `case` 或半改的投影留给下一次）；已完成任务的判据输出即为本次调用的增量产物。

---

## 4. 验证配方（**禁止新增测试文件**；全部为实跑 + 一次性脚本，A15）

### 4.1 起隔离环境（长驻进程一律经 `hub` 的 `op:"start"`，遵守四条红线）

```bash
cd <PR worktree 根>
SOCK=$(mktemp -d)/pr001.sock        # 独立 socket：不占用既有 <包根>/.runtime/router.sock
export OAMP_SOCKET=$SOCK
export OAMP_HEARTBEAT_TIMEOUT_MS=120000   # 既有 env 键（config.js:29-34）；仅为拉宽"重连中"观测窗
```
- router：`hub start name=pr001-router application=node args=["oamp/bin/oamp.js","router","start"] env={OAMP_SOCKET,…} ready={log:"ROUTER_READY"}`
- agent：`hub start name=pr001-agent application=node args=["oamp/bin/oamp.js","agent","start","ag-pr001"] env={OAMP_SOCKET,…}`；**就绪判据在 router 侧**：`hub wait name=pr001-router pattern="AGENT_REGISTERED instance=ag-pr001"`（A17）。
- 收工：`hub stop name=pr001-agent` → `hub stop name=pr001-router`。

### 4.2 证据命令族（T1 与 T7 必须使用**同一组**）

```bash
node oamp/bin/hub.js uds router.status
node oamp/bin/hub.js uds router.task_get --params '{"task_id":"<id>"}'
node oamp/bin/hub.js uds router.task_list --params '{}'
node oamp/bin/hub.js uds router.task_list --params '{"state":"working"}'
node oamp/bin/oamp.js status
node oamp/bin/oamp.js task list
node oamp/bin/oamp.js task status <id>
node oamp/bin/oamp.js task send ag-pr001 '{"command":"sleep","args":["60"],"label":"pr001-cancel"}'   # 返回 task_id；进入 working（A16）
```

### 4.3 `router.task_cancel` 的调用载体（**本 PR 内没有 CLI 入口**，见 §7 疑问 2）

**载体①（本 PR 文件范围内的唯一库面）**——经 `sdk/uds.js` 的新方法：
```bash
node --input-type=module -e '
const { createHub } = await import("./oamp/sdk/index.js");
const hub = createHub({ socketPath: process.env.OAMP_SOCKET });
const s = await hub.uds.connect({});
try { console.log(JSON.stringify(await s.taskCancel(process.argv[1]))); }
catch (e) { console.log(JSON.stringify({ code: e.code, message: e.message })); }
s.close();' <task_id>
```
**载体②（裸 JSON-RPC，用于"无 CLI 也能验"的交叉证据）**：
```bash
node --input-type=module -e '
import net from "node:net";
import { RpcPeer } from "./oamp/src/rpc.js";
const sock = net.connect(process.env.OAMP_SOCKET);
await new Promise((r) => sock.once("connect", r));
const peer = new RpcPeer(sock, { idPrefix: "probe" });
try { console.log(JSON.stringify(await peer.request("router.task_cancel", { task_id: process.argv[1] }, { timeoutMs: 5000 }))); }
catch (e) { console.log(JSON.stringify({ dataCode: e.dataCode, message: e.message })); }
peer.close();' <task_id>
```
> 参数非法的三例与"不存在"一例直接替换上面的 `{ task_id: … }` 字面量。

### 4.4 "重连中"窗口（AC3 的进程面取证）

1. agent 在线时 `hub uds router.status` ⇒ 该行 `state='online'`、`connected=true`。
2. 对 agent 进程发 `SIGKILL`（不经 SIGINT 优雅注销）⇒ Router 的 `socket.on('close')` 走 `onConnClosed`（A2）⇒ **120s 租约内**再查 ⇒ `state='online'`、`connected=false`（"重连中"）。
3. 重启 agent（同名实例）⇒ 一次 `agent.register` ⇒ 再查 ⇒ `state='online'`、`connected=true`（收敛不依赖租约超时）。

---

## 5. 证据载体与落盘

- **原始输出落盘位置**：`/tmp/0029-pr-001-{baseline,after}/`（临时面，A15 之外的既有惯例；**不写进仓库**）。
- **最终证据载体**：`prs/pr-001-router-status-primitives.md` 的 **「验收证据」** 段（PR 文件自身在文件范围内，且原文即要求"本 PR 执行时填写"）。
- **不得**：新建文档、新建测试文件、把证据写进 `status.md` / `history.md`（不在本 PR 文件范围，主 agent 维护）。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（T3 判据 6 的口径）**：`started_at` 的写入只发生在 `recordTaskUpdate` 的**既有非终态 working 分支内** ⇒ "终态之后才到达的 `working` 更新"**不写** `started_at`。
  - 为什么需要推导：PR 验收 4 原文只说"首次进入 `working` 时写入；未进入过为 `null`"，未覆盖"终态后到达 working"这一边角。
  - 推导依据：`registry.js:227-229` 的既有分支**显式排除**终态（`task.state !== 'completed' && task.state !== 'failed'`）⇒ 终态条目不再发生状态迁移，此时写 `started_at` 会与 AC7/AC10 的"既有语义不变"冲突。
- **[model_inferred] MI-P2（T5 判据 7 的口径）**：`router.task_cancel` **不校验身份**（任意连接可用）。
  - 为什么需要推导：PR 验收 5/6 未写身份要求。
  - 推导依据：① `architecture.md` §5.3 的入参面只有 `{task_id}`；② PR 文件「验收证据」的调用形态为 `uds router.task_cancel --params '{"task_id":…}'`（**不带 `--as`**）；③ 既有 `router.status` / `router.task_get` / `router.task_list` 三个 `router.*` 方法均为任意连接可用（A7）。

**无其他推导项**：AC1~AC10 的其余判据均可逐字回指 PR 文件、`architecture.md` 或上表事实锚点。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的边集合与拓扑序 `T1<T2<T3<T4<T5<T6<T7<T8`）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **PR 文件「验收证据」段的 `uds router.task_cancel --params …` 载体在本 PR 内不可达**：该 CLI 形态要求 `sdk/surface.js` 的 `UDS_ENTRIES` 含第 9 条（A11，`surface.js:286-295` 固定 8 条、无通配透传），而 `surface.js` 明列在 PR 文件的**「不触碰」**清单内（层 B 8 → 9 的同步归 **pr-007**，§7 L1-02）。本任务列表据此把取证载体改为**同文件范围内的库面**（§4.3 载体①/②），并把 CLI 载体留给 pr-007 之后的迭代级取证。**该差异属载体表述问题，不影响 PR 的 10 条验收标准本身**（AC5/AC6/AC8 均可用库面判据判定）。
2. **粒度决策记录（本 PR 未写 `roles/planner/data/`）**：本次把 `registry.js` 拆成 T2/T3、把 `router.js` 拆成 T4/T5、把回归与取证拆成 T1/T7/T8，理由是"独立验收面"而非"独立文件"；按 planner 角色定义本应记入 `data/`，但本 PR 的**文件范围不含 `roles/**`**（该路径亦在「不触碰」清单内）⇒ 记录在本文件此处，不越界写 `roles/`。
3. **未发现的架构信息缺口**：AC1~AC10 均能在 `architecture.md`（A-04/A-07/A-10/A-12/A-13、§5.2/§5.3/§5.5/§6.1）与 `prd/{F05,F08,F13,F15,F16,G01}` 找到可追溯依据；无因架构缺信息而写不出验收标准的情形。
4. **PR 文件七字段零改动**：本任务列表未修改 `prs/pr-001-router-status-primitives.md` 的任何字段（含「文件范围」「验收标准」）；上文第 1 条仅为上报，处置权归主 agent。
