# pr-005-tasks.md — pr-005 内部任务列表（HTTP 会话面与调用面，`oamp/src/web.js`）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-005-web-session-and-call-surface.md`
**PR worktree 分支**: `feat/0029-pr-005-web-session-and-call-surface` ｜ **base = `51eb893`**（迭代分支 tip：**pr-001 / pr-002 / pr-003 均已合并**，A1）｜ **任务总数**: **15**（T0~T14）｜ **依赖图**: **无环**（见 §2）
**性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（11 组 / ~50 条验收标准）+ `architecture.md`（§3.1~§3.10 数据流、§4 A-01~A-14、§5.1 路由表与位置纪律、§5.2 追加字段表、§5.5 改动面、§6.1 Z-1~Z-15、§6.2 S-1~S-11、§7 L1-01/L2-01~L2-13、§9.1 明文局限、§10 R-5）+ `prd/{F01,F02,F03,F05,F06,F07,F08,F09,F10,F11,F12,F13,F14,F15,F16,F17,G01}*.md` + 代码库实读（§0.3 逐条带 `文件:行号`；**依赖 PR 已合并 ⇒ 直接读其真实实现**，不按设计稿猜签名）

> **本 PR 体量最大**（`oamp/src/web.js` 1779 行；8 条新路由 + 6 处既有函数追加 + 2 个新助手）且**文件范围不可再分**（`createApiRoutes` 是唯一登记面）。故任务切分为**三段**：**段 A 会话面**（T1~T5）、**段 B 调用面**（T6~T12）、**收口**（T13~T14）。每段结束都应能跑通 `GET /api/docs` 与既有面回归（PR 文件「建议的内部拆分点」的同构细化，但粒度按"单次调用可产出可验证增量"再切细）。

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/web.js` | 改（8 条新路由 + 6 处追加 + 2 个助手） | 逐任务见 §1 各任务「文件·锚点」列 |
| 2 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md` | 改（仅「验收证据」段） | 逐条验收的原始命令与输出（**T14**） |

> 本文件 `prs/pr-005-web-session-and-call-surface-tasks.md` 是本阶段产物，不计入改动面（与 PR 文件同目录，随 PR 分支提交）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动**（PR 文件「不触碰」）：`oamp/API.md`、`oamp/llms.txt`（pr-006）、`oamp/sdk/surface.js`、`oamp/skill/hub.md`（pr-007）、`oamp/web/**`（pr-004）、`oamp/src/transport.js`、`oamp/src/registry.js`、`oamp/src/router.js`、`oamp/sdk/uds.js`（pr-001/pr-003 已交付，**只读消费**）、`oamp/src/principals.js`、`oamp/src/pickup.js`（pr-002 已交付，**只读消费**）、`oamp/src/persist.js`、`oamp/README.md`、`oamp/sdk/doctor.js`、`oamp/scripts/gen-llms-txt.mjs`、`oamp/package.json`、`roles/**`、`docs/**`（除 PR 文件与本文件）。
- **不新增**：第三方依赖、env 键、配置键、`STATIC_FILES` 键、DB 表/列、事件名（新面恰 7 名）、第二套错误构造点、第二套关闭实现、第二套终态写点、第二套信封构造。
- **不改既有源行**（§6.1 Z-1~Z-15）：既有 21 条端点的 handler 体**除三处明文追加**外零改动——`POST /api/calls` 插入 `requester` 段（T4）、`GET /api/agents` 行追加字段（T12）、`GET /api/calls` 行追加字段（T12）；此外 `composeCallEnvelope` / `callState` / `diffTopology` / `sendJson` / `sendError` / `publishMessage` / `publishState` 的既有帧构造**零改动**。
- **不做**（F11/F12/F09 边界）：不把"轮询 + 超时"当等待实现；等待超时不产生结论、不改调用状态；不做回放 / 持久事件日志 / 投递保证；不做鉴权与配额；不做客户端实现（pr-004）；不改 `mode:block` 语义与既有对账/幂等闸门。

### 0.3 实读事实锚点（本 stage 实读，base `51eb893`；判据基础）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | **依赖已就绪**：base 已合并 pr-001（`router.task_cancel` / `router.status.generation` / 节点 `connected` / 任务 `started_at`）、pr-002（`principals.js` / `pickup.js`）、pr-003（`transport.handleSubscribe` / `publishFiltered` / `closeCallSubscriptions`） | 实测（`git log --merges` + `grep`） |
| **A2** | **已合并 API 的真实签名**（直接消费，勿按设计稿猜）：`transport.handleSubscribe(req, res, { predicate })`（`predicate` 缺省/非函数 ⇒ **恒真**，`transport.js:74-88`）；`transport.publishFiltered(event)`（`{type,data}` 逐订阅者谓词过滤，`:94-99`）；`transport.closeCallSubscriptions(callId)`（`:167`，只关 `call:<id>`）；`router.task_cancel` 的错误以 **JSON-RPC `data.code`** 返回（`TASK_NOT_FOUND` / `TASK_ALREADY_FINAL`，`router.js:394-417`）；`registry.generation`（模块级常量，`registry.js:30`）；`listTasks` 行含 `started_at`（`registry.js:272`）；`principals.upsert/get/touch/requesterOf`、`pickup.add/listByRequester/ack` | 实测 |
| **A3** | 路由表 = `createApiRoutes` 返回的**顺序数组**，`matchRoute` 取**顺序首个命中**（`compileRouteMatcher` `:451`）；既有 21 条位置：`GET /api/agents` `:478`、`POST /api/messages` `:766`、`GET /api/docs` `:885`、`POST /api/calls` `:951-1127`、`GET /api/calls` `:1128-1157`、`GET /api/calls/stream` `:1158`、**`GET /api/calls/:call_id/stream` `:1180-1202`**、`GET /api/calls/:call_id/transcript` `:1203`、**`GET /api/calls/:call_id` `:1232-1256`**、`GET /api/confirmations` `:1257`、`POST /api/confirmations/:id/decision` `:1274` | 实测 |
| **A4** | **位置纪律**：`GET /api/calls/wait` 必须插在 `GET /api/calls/:call_id`（`:1232`）**之前**，否则被解析成 `call_id='wait'`（该 handler 回 `404 call 不存在: wait`） | A3 + `:1247-1250` |
| **A5** | `ERR_CODE` 五项（`:116-124`）、`sendJson`（`:107-110`）、`sendError`（`:126-129`，**唯一错误构造点**）；`queryOnce`（`:168-188`）RPC 失败抛 `RpcError`（机器码在 `.dataCode`） | 实测 |
| **A6** | `createTopologyWatch({transport, queryNodes, pollMs})`（`:216-262`）：`tick()` 以 `transport.globalCount()===0` 自停（`:227/:237`）、`diffTopology` 播 `agent_online/offline`（`:245-246`）；**唯一启动点** = `GET /api/events` handler 内的 `topologyWatch.ensureRunning()`（`:761`）；退出停表（`:1769`） | 实测 |
| **A7** | `publishCallResult(task, entry)`（`:1507-1520`）= 终态**唯一发布点**：`call.published` 幂等 → 写 `call.terminal` → `transport.publishCall(callId, {type:'call_result'})`（`:1515`）→ `call.resolve(envelope)`。**两个调用者**：`finishTask` 的投递路径（`:1556`）与 `reconcileTask` 的对账路径（`:1592`） | 实测 |
| **A8** | 调用登记 `call` 字面量（`:1083`）= `{callId, role, chatId, outputSchema, schemaMode, done, resolve, published, working, terminal}`；`tasks` Map 条目（`:1084`）；`callSchemas`（`:1085`）；`mode:block` 句柄 = `done`/`resolve`（`:1082`） | 实测 |
| **A9** | 既有发布点（新面投递钩子的候选点）：`agent_online/offline` `:245-246`；`call_state:'submitted'` `:1115`；`message` `:1491`；`chat_state` `:1498/:1500`；`call_result` `:1515`；`confirmation` `:1628`；对话面 `notice` `:1639`；`task_update` `:1649`；`call_state:'working'` `:1659` + `call_update` `:1661` | 实测 |
| **A10** | `composeCallEnvelope(task, call)`（`:372-394`，10 键 + `call_id`）与 `callState(task, call)`（`:396-398`）= 信封唯一构造点（取件面现算正文必须复用，不得另造） | 实测 |
| **A11** | `GET /api/agents` handler（`:486-508`）= `queryOnce('router.status')` → `withRole(nodes)` → `?state=online` 过滤（判据 `state === 'online'`）；`GET /api/calls`（`:1136-1156`）= `queryOnce('router.task_list')` → `filter(t.from === SENDER_ID)` → 逐键映射 6 列 | 实测 |
| **A12** | `GET /api/calls/:call_id/stream` handler（`:1180-1202`）= **先** `router.task_get` 验存在（不存在 ⇒ 404，不建订阅）→ `transport.handleCallStream` ⇒ **晚订阅者拿不到已过去的终态帧** | 实测 |
| **A13** | 配置面：`config.socketPath`（默认 `<包根>/.runtime/router.sock`）、`config.heartbeatTimeoutMs`（名册宽限复用它，**不新增配置键**）、`readPositiveMs`（`:81`）、既有 web 旋钮 `OAMP_WEB_TOPOLOGY_POLL_MS`（`:1450`）与 `OAMP_WEB_RECONCILE_*` | `config.js:141-156`、`web.js:81/:1450` |
| **A14** | 既有回归面：`STATIC_FILES`（`:418-436`）、SIGINT 清理段（`:1755-1775`）、`GET /api/docs` 请求时现算（`:885`）；`hub doctor` 的 R1/R2/R3 不在本 PR 范围（新路由会被其自动发现） | 实测 |
| **A15** | 本仓**无测试面**（0 个 `.test.js`）⇒ 判据 = 真集群实跑 + `curl`/`hub` + 迭代前后一致性比对；PR 文件明写"真集群 smoke 的起停记录按本迭代 `status.md` 体例留存" | 实测 |

### 0.4 本 PR 内冻结契约（跨任务一致面，逐条带追溯）

1. **路由登记纪律**〔AC「路由登记与元数据」；A3/A4〕：8 条新路由按既有 8 字段（`method/path/summary/params/response/errors/kind/docLink`）声明；`GET /api/subscribe` 同既有两个 SSE 面 `kind:'sse'`；**`GET /api/calls/wait` 的位置在 `GET /api/calls/:call_id` 之前**；既有 21 条的相对顺序与内容**零改动**。
2. **`ERR_CODE` 只追加一项**〔F08 / Z-4；A5〕：`STALE_EPOCH`（↔ 409）；既有 5 码与文案逐字不变；全部 4xx/5xx 仍经 `sendError`。
3. **`epoch` 语义**〔A-07 / L2-06；A1〕：`epoch = <webBootId>.<routerGeneration>`；`webBootId` 启动时 `randomUUID()` 一次；`routerGeneration` 取自 `router.status` 的 `generation`（`:381` 已提供）。**尽力观测**：需要给出/校验时观测一次；失败 ⇒ 沿用最后一次已知值；从未观测到 ⇒ `'0'` ⇒ 同一对进程存续期内恒定、任一进程重启即变。**出现位置**＝`POST /api/principals`、`GET /api/principals/<id>`、`GET /api/health`；**校验位置**＝`GET /api/subscribe`、`GET /api/pickup`、`POST /api/pickup/<id>/ack` 的**可选** `epoch`（给出且 ≠ 当刻 ⇒ 409 `STALE_EPOCH`；不给 ⇒ 不判过期）；**既有面一律不新增 `epoch`**。
4. **新订阅面的 7 名投递白名单**〔A-03 第 2/7 条；A9〕：只有这 7 名进 `transport.publishFiltered` —— `agent_online` / `agent_offline`（`:245-246`）、`agent_state`（T12 新增）、`call_state`（`:1115`、`:1659`）、`call_update`（`:1661`）、`call_result`（`:1515`）、`confirmation`（`:1628`）。**禁止**转发 `message`（`:1491`）、`chat_state`（`:1498/:1500`）、`task_update`（`:1649`）、对话面 `notice`（`:1639`）。转发语句一律**追加在既有发布语句之后**（既有行零改动）。
5. **`requester` 的解析与落点**〔F02 / F14 / A-02；A8〕：解析插在 `POST /api/calls` 的**既有全部校验之后、⑤ 逐项派发之前**（`:1050` 前）；未注册 ⇒ `principals.upsert` 按需建立、**不阻断**；`call.requester` 写进调用登记（A8 的 call 字面量**追加一键**）；**不进信封**（`composeCallEnvelope` 零改动）。
6. **取件指针的唯一写点 = `publishCallResult`**〔A-06 / Z-11；A7〕：仅在 `call.requester` 非空时 `pickup.add({call_id, requester, agent, chat_id, terminal_at, acked:false})`；投递路径与对账路径**共用**该写点，不出现第二个终态源。
7. **终态收口顺序**〔F09 验收 4 / A-08；A7〕：`publishCallResult` 内**先**写终态帧（`publishCall`）**后** `transport.closeCallSubscriptions(callId)`，**再**解等待句柄（`call.resolve` 与新增的 waiters）——同一 tick 顺序写 ⇒ 不吞最后一帧、不早关。
8. **等待句柄单一释放点**〔A-09 / L2-09；A7/A8〕：`GET /api/calls/wait` 的句柄登记在 web 侧 `Map<callId, Set<resolve>>`，**只由 `publishCallResult` 释放**；本进程无登记的 id 由既有对账兜底（`scheduleReconcile` / `reconcileTask`）复查覆盖 ⇒ 退出判据恒为"终态"；`timeout_ms` 缺省**不设上限**（与 `mode:block` 同构）。
9. **流补发不变量**〔F10 验收 2 / A-08；A12〕：`GET /api/calls/:call_id/stream` = **先建订阅、再读当刻状态**；已终态 ⇒ 补**一帧**当刻信封并随即关流；不存在 ⇒ 既有 404 且**不建订阅**；**每个调用订阅至多一帧终态帧、至多关闭一次**（先终态后订阅 / 先订阅后终态两路幂等）。
10. **名册提示（L1-01，已确认）**〔F16 验收 2/5；A13〕：文件 = `<包根>/.runtime/roster.json`（与 socket 同目录，`path.dirname(config.socketPath)`）；web **每次投影计算**与**正常退出**（SIGINT 段 `:1755-1775`）best-effort 写；**启动时读**（缺失/损坏 ⇒ 视为无提示，不报错）；提示项以 `state:'online' + connected:false` 呈现且**四字段投影一律清空**（`busy:false / current_call_id:null / queued:0 / since:null`）；`config.heartbeatTimeoutMs` 内仍未重新注册的提示项从视图移除；**写失败忽略**（§9.1 局限 7）；**不新增配置键**。
11. **`GET /api/agents` 追加 5 字段**〔F05 / F16 / Z-5；A11〕：既有 5 键（`instance_id / session_id / state / last_heartbeat / role`）名、值域与顺序**不变**，5 个新键（`connected / busy / current_call_id / queued / since`）**追加在后**；数据来源 = `router.status`（`connected`）+ `router.task_list`（四字段）；`?state=online` 判据仍为 `state === 'online'`（不加第三取值）。
12. **`GET /api/calls` 追加 `last_event_at`**〔F06 / A-05；A11〕：取值 = 任务条目 `updated_at`；既有 6 列名/顺序/取值不变；**服务端不给出 `idle_ms`**。
13. **`GET /api/health` 的形态与唯一特例**〔A-12；§5.1〕：一次调用返回 `{router:{ok,detail,generation}, web:{ok,detail}, agents:{online,reconnecting,offline,total}, callable, epoch}`；`callable = router.ok && web.ok && agents.online >= 1`；**唯一允许 Router 不可达仍 200 的面**；判据**零副作用**（不发真实调用、不写任何状态）。
14. **零新增依赖/env/配置键**〔G01 验收 6 / Z-15〕：`.runtime/roster.json` 是**运行态产物**（与既有 `.runtime/router.sock` 同性质），不是新配置键；`STATIC_FILES` 零新增键；DB 三表零改动；`/api/docs` 由既有请求时投影自动包含新路由。

### 0.5 PR 验收标准 → 任务映射（11 组 / ~50 条 AC 全覆盖，无孤儿任务）

| AC 组（PR 文件原文分节） | 条数 | 服务任务 |
|---|---|---|
| 路由登记与元数据（F17/§5.1） | 4 | **T1**（ERR_CODE 部分）+ **T3/T4/T5/T6/T8/T9/T10/T11/T12**（各路由登记）+ **T9**（位置纪律）+ **T13**（`/api/docs` 投影与既有 summary 逐字） |
| F01 身份面 | 5 | **T3**（+ T1 的 epoch） |
| F02 / F14 派发归属与自派发 | 6 | **T4** |
| F03 订阅第一形态 | 6 | **T5** |
| F05 / F16 / F06 投影与进展字段 | 12 | **T12** + **T2**（名册提示三态/软重启）+ **T5**（`agent_state` 经新面到达） |
| F07 / F08 取件与代次 | 9 | **T6**（路由与现算）+ **T7**（指针写点）+ **T1**（epoch 语义/409） |
| F09 / F10 终态关流与晚订阅补发 | 7 | **T7**（关流与顺序）+ **T8**（补发与不变量） |
| F11 / F12 等待入口 | 8 | **T9** |
| F13 取消 | 6 | **T10**（+ T7 的发布点复用） |
| F15 恢复判据 | 5 | **T11** |
| G01 既有面零影响 | 5 | **T13**（迭代前后比对）+ **T14**（零面核查与证据） |

> **无孤儿任务**：**T0** 是 AC「G01 验收 1/3」（迭代前后逐字比对）的**基线生产者**；**T14** 是全部 AC 的证据载体（PR 文件「验收证据」段要求的两类输出即其判据）；其余每个任务都在上表中至少出现一次。

---

## 1. 任务列表

> 每条任务的「验收判据」都是**可执行命令 + 可判定结果**；真集群的起停与证据落盘体例见 §4。

### T0: 改动前基线取证（既有 21 端点 + 4 推送面 + `/api/docs` 投影）

- **服务哪条 AC**: G01 验收 1/3（"迭代前后逐字比对"的基线生产者）
- **描述**: 在**任何源码改动之前**起真集群（router + agent + web，临时 socket/DB/端口），跑一遍「既有面会话脚本」并把原始输出与事件序列落盘到 `/tmp/pr005-baseline/`（**不进仓库**）。
- **文件·锚点**: 零源码改动。基线内容 = ① 21 端点典型入参的响应体（**含 4xx/5xx 文案**）；② 一次典型会话（订阅 `/api/stream` + `/api/events` → 派发 → 增量 → 终态）在既有 4 条推送面上的**事件名序列**；③ `GET /api/docs` 全量投影；④ `git rev-parse HEAD` 与 `git status --short`。
- **步骤**: ① 按 §4.1 起集群；② 按 §4.2 跑端点族与会话脚本；③ 按 §4.3 采集事件序列；④ 落盘 + 记录基线 commit。
- **验收判据（可执行）**:
  1. `/tmp/pr005-baseline/` 下存在 ① 21 端点输出（每端点一份原始响应体）、② 推送面事件序列 JSON、③ `/api/docs` 投影 JSON、④ `meta.txt`（`HEAD=51eb893`、`git status --short` 为空）。
  2. 全部输出为**原始响应体**（未裁剪、未加工）——T13 的逐字比对依赖它。
  3. 基线 commit = `51eb893`（若不符，说明工作树已被改动 ⇒ 比对失效，须重取或改用 §4.5 的 `git show` 副本法）。
- **前置依赖**: 无（**必须在任何源码改动前执行**——改动后不可复现该基线）
- **优先级**: P0

---

### T1: `ERR_CODE` 追加 `STALE_EPOCH` + `epoch` 观测助手

- **服务哪条 AC**: 路由登记组（`ERR_CODE` 部分）、F07/F08 组的 epoch 语义/409、F15 组的 `epoch` 字段
- **描述**: ① `ERR_CODE` 追加 `STALE_EPOCH`；② 在 `startWeb` 作用域新增 epoch 助手：`webBootId = randomUUID()`（启动一次）+ `routerGeneration` 尽力观测（`queryOnce(config.socketPath,'router.status')` → `.generation`；失败沿用最后已知值；从未观测到 ⇒ `'0'`）+ 拼装 `epoch = ${webBootId}.${gen}` + 校验函数（给出且不等 ⇒ 不通过）。
- **文件·锚点**: `oamp/src/web.js:116-124`（`ERR_CODE`，**只追加一项**）；新助手置于 `startWeb` 内既有旋钮区之后（`:1450` 一带）；复用 `queryOnce`（`:168-188`）；**`sendError`（`:126-129`）零改动**。
- **步骤**: ① 追加错误码（含 `// 409 视图已过期` 注释，体例同既有五项）；② 写助手（含缓存变量与"尽力观测"语义）；③ 返回值形态自定（L3），需覆盖"取当刻 epoch"与"校验给定值"两个用途。
- **验收判据（可执行）**:
  1. **只追加**：`git diff -U0` 中 `ERR_CODE` 块只有 `+` 行、无 `-` 行；键集合 = 既有 5 项 + `STALE_EPOCH`（一次性脚本 `import('./oamp/src/web.js')` 打印 `Object.keys(ERR_CODE)` 取证）。
  2. **形式与恒定**：`epoch` 匹配 `^[0-9a-f-]{36}\..+$`（UUID + `.` + generation；未观测到时以 `.0` 结尾），同进程内两次取值相同。
  3. **尽力观测**：停掉 router 后取 epoch **不抛错**且返回最后已知值（首次即不可达 ⇒ 以 `.0` 结尾）。
  4. **校验语义**：不给 ⇒ 通过；给当刻值 ⇒ 通过；给 `'x'` ⇒ 不通过（由调用面转 409）。
- **前置依赖**: T0
- **优先级**: P0

---

### T2: 软重启名册提示（`.runtime/roster.json` 读写）

- **服务哪条 AC**: F16 组的软重启窗口 / 名册 best-effort 两条
- **描述**: 新增名册助手：① 启动时读 `<包根>/.runtime/roster.json`（缺失/损坏 ⇒ 空）；② 每次投影计算与**正常退出**（SIGINT 段）best-effort 写（当前 `instance_id` 列表 + 写入时刻）；③ 提供"名册项 → 视图行"的派生（`state:'online' + connected:false` + 四字段清空）与"超过 `config.heartbeatTimeoutMs` 未回归即移除"的判据。
- **文件·锚点**: 新助手置于 `startWeb` 内（近 `:1450` 配置区）；目录用 `path.dirname(config.socketPath)`（A13，与既有 `mkdirSync` 同口径）；SIGINT 段 `:1755-1775` 追加一次写；`fs` 已在 `:31` 导入。
- **步骤**: ① 读 + 校验（`JSON.parse` 失败 ⇒ 空）；② 写（直接写即可；失败 `try/catch` 忽略）；③ 派生与宽限判据；④ 接入 SIGINT 写点。
- **验收判据（可执行）**:
  1. **文件形态**：正常退出（SIGINT）后该文件存在且为 JSON（含实例 id 列表与时刻），内容**只含实例 id**，不含任何在跑/调用投影。
  2. **坏文件不报错**：把文件写成 `not-json` 后启动 web ⇒ 进程正常起（`WEB_READY`）、无 stderr 报错；视图视为无提示。
  3. **best-effort**：把 `.runtime/` 置为不可写 ⇒ 启动与退出均不报错、HTTP 面正常。
  4. **宽限移除**：以极小 `OAMP_HEARTBEAT_TIMEOUT_MS`（如 3000）启动并预置一个名册项、不启动对应 agent ⇒ 宽限内该实例在 `GET /api/agents` 以 `online + connected:false` 可见，超时后**从视图移除**（不是 offline 墓碑）。
- **前置依赖**: T0
- **优先级**: P0

---

### T3: 身份两条路由（`POST /api/principals`、`GET /api/principals/:principal_id`）

- **服务哪条 AC**: F01 全部 5 条
- **描述**: 新增两条 JSON 路由：注册（幂等 upsert + 前移 `last_seen_at`）与按 id 查询（存在 ⇒ 前移 + 200；不存在 ⇒ 404）。两响应均含 `epoch`。
- **文件·锚点**: 插入位 = `createApiRoutes` 数组内（`:477` 起，建议紧随 `GET /api/agents` 之后，按"会话面"归组）；复用 `principals.upsert/get/touch` 与 `requesterOf`（A2，**新增 import 行** `import * as principals from './principals.js'`，体例同 `:41`）；`sendError` 体例 `:126`。
- **步骤**: ① `POST`：`requesterOf(body)` → 空/缺失 ⇒ 400；`upsert` 返回 `{error}` ⇒ 400；成功 ⇒ 200 `{principal, epoch}`；② `GET`：`get(id)` 命中 ⇒ `touch(id)` 后 200 `{principal, epoch}`；未命中 ⇒ 404（**不得**为查询而建条目）。
- **验收判据（可执行，`curl`）**:
  1. `POST {"principal_id":"p1","kind":"cli"}` 两次 ⇒ 两次 200、`created_at` **相同**、第二次 `last_seen_at ≥` 第一次。
  2. `GET /api/principals/p1` ⇒ 200 同形 + `epoch`；再查 ⇒ `last_seen_at` **前移**、`created_at` 不变。
  3. `GET /api/principals/nope` ⇒ 404 `{"error":…,"code":"NOT_FOUND"}`；再查仍 404（**查询不建条目**）。
  4. 形态非法三例（`""` / 65 字符 / 含控制字符）⇒ 400 `INVALID_PARAM`，且 `GET` 复查确认**未建条目**。
  5. 两响应均含 `epoch`，取值与 T1 判据 2 的同进程恒定一致。
  6. 重启 web 后同 id 再注册 ⇒ 200、`created_at` 取新进程首次交互时刻（新身份），**调用方不改任何身份**即可继续查询派发（F01 验收 4 的落地形态）。
- **前置依赖**: T0、T1（响应含 `epoch`）
- **优先级**: P0

---

### T4: `POST /api/calls` 的 `requester` 解析 + 自派发 `warnings`

- **服务哪条 AC**: F02 / F14 全部 6 条
- **描述**: 在既有全部校验之后、逐项派发之前插入两步：① `requesterOf(body)` 解析（缺省 ⇒ `null`，后续全跳过）；② 仅当该身份声明了 `instance_id` 时做自派发判定（`target === principal.instance_id`）；逐项派发时把 `requester` 记进 `call`；响应顶层按需给出 `warnings[]`。
- **文件·锚点**: 插入点 = `:1050`（`// ── ⑤ 逐项派发` 之前，既有校验结束处）；`agentId = instanceIdForRole(role)` 已在既有段；`call` 字面量（`:1083`）**追加** `requester`；响应写出处（`:1123`）按需追加 `warnings`；`instanceIdForRole` 已在 `:42` 导入。
- **步骤**: ① 解析 + 按需 `principals.upsert`（未注册 ⇒ 建立、**不阻断**）；② 逐项判定并累积 `{index, call_id, kind:'self_dispatch', message}`；③ 仅当携带 `requester` 时输出该键。
- **验收判据（可执行，`curl` + `jq`）**:
  1. **对照实验（唯一变量 = 是否携带 `requester`）**：同入参两次派发，`jq 'keys'` 仅差 `warnings`；**不携带**时响应体与 T0 基线**逐字相同**（`diff` 退出 0）。
  2. **自派发告警**：`requester=p1`（其 `instance_id` = 目标实例）⇒ 200、`warnings[0] = {index:0, call_id:<该项 id>, kind:'self_dispatch', message:…}`，且调用**照常派发**（`GET /api/calls/<id>` 可查、状态推进）。
  3. **非自身 ⇒ 空数组**：同入参仅换目标实例 ⇒ `warnings === []`。
  4. **批量定位**：两项、仅第二项自派发 ⇒ `warnings[0].index === 1` 且 `call_id` = 第二项 id。
  5. **不进信封**：`GET /api/calls/<id>` 的键集与键序 = 既有 11 键（A10），**无** `requester` / `warnings`。
  6. **按需 upsert 不阻断**：用未注册的 `requester=p-new` 派发 ⇒ 200 且调用正常；随后 `GET /api/principals/p-new` ⇒ 200。
  7. **既有校验顺序未动**：非法 `mode` / 非法 `output_schema` / 空 `tasks` / 不可寻址角色四种入参，响应与 T0 基线逐字相同。
- **前置依赖**: T0、T3（判据 6 的验证车辆）
- **优先级**: P0

---

### T5: `GET /api/subscribe`（SSE）+ 新面投递钩子接线

- **服务哪条 AC**: F03 全部 6 条（F05 组的"订阅面可看到跳变"由 T12 补齐 `agent_state`）
- **描述**: 新增订阅路由：`principal` 必填、`epoch` 可选校验、`kinds`/`agents` 解析成**谓词**（事件名域 = 7 名，域外 ⇒ 400；`agents` 做实例↔角色归一），交给 `transport.handleSubscribe`；并在**既有发布点之后**追加 `transport.publishFiltered(event)`（白名单 7 名，契约 4）。
- **文件·锚点**: 插入位 = SSE 面归组（建议紧随 `GET /api/events` `:750-765` 之后）；`handleSubscribe`/`publishFiltered`（A2）；投递点 `:245`、`:246`、`:1115`、`:1515`、`:1628`、`:1659`、`:1661`（**追加在既有语句之后**）；`roleFromInstanceId`/`instanceIdForRole`（`:42`）用于 `agents` 归一。
- **步骤**: ① 参数校验；② 身份 upsert/前移；③ 构造谓词（`kinds` 命中 ∧ `agents` 命中；两者都缺 ⇒ 恒真）；④ `handleSubscribe(req,res,{predicate})`；⑤ 七处发布点各追加一行。
- **验收判据（可执行，`curl -N` + 事件序列）**:
  1. **建立语义**：`curl -N '/api/subscribe?principal=p1'` ⇒ 头 `content-type: text/event-stream`、首帧 `retry: 1000`、**无初始数据帧**；15s 内出现 `: keepalive`。
  2. **7 名白名单**：观察窗内事件名集合 ⊆ 7 名；**不出现** `message`/`chat_state`/`task_update`/`notice`（对照：同窗口既有 `/api/stream` 确实收到了 `message`/`chat_state`）。
  3. **过滤**：`kinds=agent_online` 的订阅者在一次"派发→终态"期间**收不到** `call_state`；`agents=<角色名>` 与 `agents=<实例名>` 收帧集合**相同**；`kinds=call_state&agents=<非目标实例>` ⇒ 收不到（AND）。
  4. **无订阅者零错误**：无人订阅时连续派发 3 次 ⇒ web 零 stderr、`/api/calls` 正常。
  5. **隔离双向**：既有 `/api/stream` 与 `/api/events` 订阅者在新面订阅建立/断开（Ctrl-C）前后的事件到达**不受影响**；反之亦然。
  6. **409/400 形态**：`epoch=x` ⇒ 409 `{"code":"STALE_EPOCH"}`；`kinds=nope` ⇒ 400 `INVALID_PARAM`；两响应恰 `{error, code}` 两键。
- **前置依赖**: T0、T1（`epoch` 校验）
- **优先级**: P0

---

### T6: 取件两条路由（`GET /api/pickup`、`POST /api/pickup/:call_id/ack`）

- **服务哪条 AC**: F07 组的"只列未取件 / 现算正文 / 无游标"、"ack 幂等"、"epoch 409"三条（离线取件一条由 T7 合证）
- **描述**: 新增两条 JSON 路由：列未取件（逐条经 `router.task_get` + `composeCallEnvelope` **现算**正文）与确认（`pickup.ack` 幂等）。
- **文件·锚点**: 插入位 = 调用面归组（建议 `GET /api/calls/:call_id` 之后、`GET /api/confirmations` 之前）；`pickup.listByRequester/ack`（A2）；`composeCallEnvelope`（`:372-394`，**复用不另造**）；`queryOnce('router.task_get')` 体例见 `:1192`。
- **步骤**: ① `GET`：`principal` 必填、`epoch` 校验、`listByRequester(principal)` → 逐条现算 `envelope`（任务不可得 ⇒ 该条以"已失效"结论呈现，**不伪造正文**）→ 200 `{pickup:[{call_id, agent, state, terminal_at, envelope}]}`；② `POST .../ack` ⇒ `ack(call_id)` ⇒ **一律** 200 `{call_id, acked:true}`。
- **验收判据（可执行；指针由 T7 产生，本任务先验空表与形态）**:
  1. **空表**：无指针时 `GET /api/pickup?principal=p1` ⇒ 200 `{"pickup":[]}`（不是 404）。
  2. **参数与代次**：缺 `principal` ⇒ 400 `INVALID_PARAM`；`epoch=x` ⇒ 409 `STALE_EPOCH`（两响应恰两键）。
  3. **ack 幂等**：`POST /api/pickup/<任意 id>/ack?principal=p1` ⇒ 200 `{call_id, acked:true}`；重复 ⇒ 同响应；不存在 id ⇒ 同响应（**不建条目、不抛错**）。
  4. **无游标**：带 `limit` / `cursor` ⇒ 参数被忽略（响应与无参同形）。
  5. **现算同源**（T7 后复跑）：取件条目的 `envelope` 与 `GET /api/calls/<id>` **逐字相同**。
- **前置依赖**: T0、T1（`epoch` 校验）
- **优先级**: P0

---

### T7: `publishCallResult` 补线（写取件指针 + 关流 + 解等待句柄）

- **服务哪条 AC**: F07 组的"指针写点 = `publishCallResult` / 只有带 `requester` 才写 / 离线取件"；F09 组的"终态即关流 + 不吞最后一帧 / 关流范围只到 `call:`"；F13 组的"取消当刻关流 + 解等待"共用同一时点
- **描述**: 在终态**唯一发布点**内按固定顺序追加：① 按 `call.requester` 写取件指针 → ② 写终态帧（既有）→ ③ `closeCallSubscriptions(callId)` → ④ 解等待句柄（既有 `call.resolve` + 新 waiters）。
- **文件·锚点**: `oamp/src/web.js:1507-1520`（`publishCallResult`）；`pickup.add`（A2）；`transport.closeCallSubscriptions`（A2，**唯一调用点即此处**）；`call` 登记（A8，T4 已加 `requester`）；waiters 结构与释放函数（T9 定义，本任务先建）。
- **步骤**: ① 指针写入（`acked:false`）；② 帧写出后追加关流；③ 追加解 waiters；④ `call.published` 幂等闸门保持在最前（重复调用直接 return，不重复写/关/解）。
- **验收判据（可执行）**:
  1. **指针只在带 requester 时产生**：带 `requester` 的调用终态后 `GET /api/pickup?principal=<id>` ⇒ 含该 `call_id` 且 `envelope` 与 `calls get` 逐字相同；**不带** `requester` 的调用 ⇒ 集合仍为空。
  2. **两个路径共用写点**：`grep -c 'pickup.add' oamp/src/web.js` = **1** 且该行在 `publishCallResult` 内；行为面：投递路径（正常终态）与对账路径（`kill -9` agent 后由 `reconcileTask` 补终态）**各产生一条**指针、不重复。
  3. **终态即关流且不吞帧**：`curl -N /api/calls/<id>/stream` 先订阅、再让调用终态 ⇒ **先**收到 `call_result` 帧、**随后**连接关闭（`curl` 正常退出）；**不出现**"只有关闭没有帧"。
  4. **关流范围**：`GET /api/calls/stream?chat_id=<chat>` 订阅在该调用终态后**不断开**，随后另一次调用的 `call_state` 照常到达。
  5. **退出时刻不由超时决定**：客户端 `--max-time` 调大/调小不改变关闭时刻（秒级、与终态同刻）。
  6. **既有断开清理不变**：订阅者主动断开仍清理订阅（既有路径），后续新订阅不受影响。
- **前置依赖**: T0、T6（判据 1 的验证车辆）、T4（`call.requester` 来源）
- **优先级**: P0

### T8: 晚订阅补发（`GET /api/calls/:call_id/stream`）+ 不变量

- **服务哪条 AC**: F10 全部 4 条 + F09 验收 4 的客户端侧（"不吞最后一帧"两路一致）
- **描述**: 改既有 stream handler 为"**先建订阅、再读当刻状态**"：已终态 ⇒ 补**一帧**当刻终态信封（与 `calls get` 同形同取值，不补发中间过程）并随即关流；不存在 ⇒ 既有 404 且**不建订阅**；进行中 ⇒ 与 T7 同一路径。
- **文件·锚点**: `oamp/src/web.js:1180-1202`（既有 handler）；`composeCallEnvelope`（A10）；`callSchemas`（`:1085`）；顺序调整 = 把 `transport.handleCallStream` 提到 `queryOnce` **之前**，并在读到终态时补帧 + 关流。
- **步骤**: ① 调整顺序（先订阅）；② 读 `router.task_get`；③ 不存在 ⇒ 404（此时**已建订阅** ⇒ 需先移除/关闭：用 `transport.closeCallSubscriptions(callId)` 或等价手段，**不得**留下悬挂订阅）；④ 已终态 ⇒ 写一帧 + 关流；⑤ 进行中 ⇒ 不额外动作。
- **验收判据（可执行）**:
  1. **晚订阅补发**：对**已终态**的调用 `curl -N /api/calls/<id>/stream` ⇒ 立即（<1s）收到**一帧** `call_result`（`data` 与 `GET /api/calls/<id>` 逐字相同），随后连接关闭；**不出现** `call_state`/`call_update` 等过程帧。
  2. **不存在 ⇒ 404 且不建订阅**：`curl -N /api/calls/nope/stream` ⇒ 404 `NOT_FOUND`；随后对该 id 派发一次调用并终态 ⇒ 该连接**收不到**任何帧（证明未登记订阅）。
  3. **不变量（两路幂等）**：① 先终态后订阅 ⇒ 恰好 1 帧终态帧 + 1 次关闭；② 先订阅后终态 ⇒ 恰好 1 帧终态帧 + 1 次关闭（**不出现两帧**）。取证方式：`curl -N` 输出中 `event: call_result` 计数 = 1，且进程日志/连接状态无第二次关闭。
  4. **同形同取值**：补发帧的 `data` 与 `GET /api/calls/<id>` 响应体 `diff` 为空。
  5. **既有 404 体例未变**：不存在 id 的响应体与 T0 基线逐字相同（`{"error":"call 不存在: nope","code":"NOT_FOUND"}`）。
- **前置依赖**: T0、T7（关流/终态时点由同一发布点定义）
- **优先级**: P0

---

### T9: `GET /api/calls/wait`（一次调用式等待）

- **服务哪条 AC**: F11 全部 6 条 + F12 全部 3 条
- **描述**: 新增等待入口：逐 id 读当刻状态（不存在 ⇒ `unresolved` 且 `state:null`）；未终态的 id 登记等待句柄（由 T7 的发布点释放）；`timeout_ms` 可选（缺省不设上限）；返回 `{timed_out, timeout_ms, results[], unresolved[]}`。
- **文件·锚点**: **插入位 = `GET /api/calls/:call_id`（`:1232`）之前**（契约 1 / A4，位置纪律）；waiters `Map<callId, Set<resolve>>` 在 `startWeb` 作用域声明（T7 释放点引用同一结构）；`composeCallEnvelope`（A10）；`scheduleReconcile`（`:1597`）/`reconcileTask`（`:1566-1597`）为"本进程无登记 id"的兜底复查路径。
- **步骤**: ① 解析 `ids`（CSV，必填、去重、空 ⇒ 400）与 `timeout_ms`（可选正整数；0/负数/非整数 ⇒ 400）；② 逐 id 读状态并分类（终态 ⇒ `results`；不存在 ⇒ `unresolved(state:null)`；进行中 ⇒ 登记句柄）；③ `Promise.all` 等句柄 + 可选超时（超时 ⇒ `timed_out:true`、未终态项留 `unresolved`）；④ 无论哪条路径，**超时都不改调用状态**。
- **验收判据（可执行，`curl`）**:
  1. **立即结论**：请求含"已终态 id + 不存在 id" ⇒ 两者**立即**给出结论（不等待其它项、不等超时）：已终态在 `results`（信封与 `calls get` 同形）、不存在在 `unresolved` 且 `state:null`。
  2. **退出条件 = 全部终态**：`ids=<终态 id>,<进行中 id>` ⇒ **不提前返回**；进行中项终态后当刻返回（秒级，`timed_out:false`）。
  3. **超时语义**：`timeout_ms=1000` 对一个长跑调用 ⇒ 恰好约 1s 返回、`timed_out:true`、该 id 在 `unresolved`；随后 `GET /api/calls/<id>` ⇒ 仍**非终态**、`error` 为空、`exit_code` 未变（超时不产生结论）。
  4. **缺省不设上限**：不传 `timeout_ms` ⇒ 一直等到终态（用 `!sleep 8` 造项：8s 后返回、`timed_out:false`）。
  5. **参数非法**：`ids` 缺失/空 ⇒ 400；`timeout_ms=0` / `=-1` / `=abc` ⇒ 400 `INVALID_PARAM`。
  6. **句柄释放点唯一**：`grep -c 'resolve(' oamp/src/web.js` 语境核对——waiters 的释放只出现在 `publishCallResult` 内（代码面）；行为面：等待中的请求在终态当刻返回（不依赖对账周期内的下一 tick）。
  7. **对账兜底覆盖**：对"本进程无 tasks 登记"的 id（如另一个 web 进程派发的调用，或 web 重启后仍在跑的调用）⇒ 请求**不悬挂**、最终按终态返回（由既有对账/复查路径覆盖）。
  8. **位置可达性**：`curl '/api/calls/wait?ids=x'` 命中本路由（不是 `404 call 不存在: wait`）；**反证**：把该行临时移到 `:call_id` 之后，同一请求得 `404 call 不存在: wait`（取证后**恢复原位**并重跑判据 1）。
- **前置依赖**: T0、T7（等待句柄的唯一释放点）
- **优先级**: P0

---

### T10: `POST /api/calls/:call_id/cancel`（取消）

- **服务哪条 AC**: F13 全部 6 条
- **描述**: 新增取消路由：调 `router.task_cancel`（无请求体）→ 成功 ⇒ `cancelled:true`；`TASK_ALREADY_FINAL` ⇒ 200 `cancelled:false` + 原 `state`/`error` 原样；`TASK_NOT_FOUND` ⇒ 404；生效时走**既有唯一终态发布点**（发布 + 关流 + 解等待）+ 落**恰一条** `out` + 推 `chat_state`。
- **文件·锚点**: 插入位 = 调用面归组（建议紧随 `GET /api/calls/wait`）；`queryOnce('router.task_cancel', {task_id})`（A2；错误经 `RpcError.dataCode`，A5）；`publishCallResult`（A7）；`db.insertOutput` + `publishMessage` + `publishState` 的既有体例见 `finishTask`（`:1520-1560`）。
- **步骤**: ① 解析路径参数（无请求体）；② `queryOnce('router.task_cancel', {task_id})`，按 `err.dataCode` 分支（`TASK_NOT_FOUND` ⇒ 404；`TASK_ALREADY_FINAL` ⇒ 读当刻信封取原 `state`/`error` ⇒ 200 `cancelled:false`）；③ 成功 ⇒ 读回任务条目 ⇒ 走 `publishCallResult`（发布 + 关流 + 解等待）⇒ 落**恰一条** `out`（`error:'cancelled'`）+ `publishState`（避免对话停在 `working`）⇒ 200 `cancelled:true`。**不得**在 web 侧做状态覆盖。
- **验收判据（可执行）**:
  1. **生效**：对 `working` 调用 `POST .../cancel`（无体）⇒ 200 `{call_id, cancelled:true, state:'failed', error:'cancelled'}`；随后**当刻** `GET /api/calls/<id>` ⇒ `state:'failed'`、`error:'cancelled'`（不出现"取消后仍在跑"）。
  2. **幂等 / 不覆盖已定终态**：重复取消 ⇒ 200 `cancelled:false` + `state`/`error` **与该调用当前终态原样相同**（先对一条已 `completed` 的调用取消 ⇒ 仍 `completed`，**不改成 failed**）。
  3. **不存在 ⇒ 404**：`POST /api/calls/nope/cancel` ⇒ 404 `NOT_FOUND`（不静默成功）。
  4. **与关流/等待协同**：取消生效当刻 ⇒ `call:<id>` 订阅收到终态帧后关闭；同时刻一个等待该 id 的 `GET /api/calls/wait` 请求**立即返回**该终态（同刻，秒级）。
  5. **恰一条 out + chat_state**：取消生效后 `GET /api/chats/<chat>` 的该对话消息里 **恰一条** `out`（`error:'cancelled'`）；`GET /api/chats` 该对话 `state` **不停在 `working`**。
  6. **无第二终态源**：取消后该调用的 `state` 全链一致（`calls get` / roster / transcript 读同一记录，A10 的 `callState`）；被取消调用的后续 `task.update`/`task.result` 到达后 `state` **仍为** `failed`/`cancelled`。
  7. **终态词表**：全流程 `state ∈ {submitted, working, completed, failed}`（无第五值）。
- **前置依赖**: T0、T7（终态发布点 + 关流 + 解等待）、T9（判据 4 的等待侧）
- **优先级**: P0

---

### T11: `GET /api/health`（恢复判据三问）

- **服务哪条 AC**: F15 全部 5 条
- **描述**: 新增判据路由：一次调用返回 `{router, web, agents, callable, epoch}`；`agents` 三项分别可读；Router 不可达仍 200；判据零副作用。
- **文件·锚点**: 插入位 = 会话面/判据归组（建议紧随身份两条）；`queryOnce('router.status')`（A11 体例）；`db` 轻查询（`db.getChat`/`listChats` 任取一次**只读**查询即可满足"持久层可读"，不得写）；T1 的 epoch 助手；T2 的名册项参与 `reconnecting` 计数。
- **步骤**: ① `router` 项（`queryOnce` 成功 ⇒ `ok:true` + `generation`；失败 ⇒ `ok:false` + 原始错误文案**含 socket 路径**）；② `web` 项（能返回即监听 ✓ + 一次只读轻查询）；③ `agents` 三项由同一次 `router.status` 节点集合派生（`online` = `state==='online' && connected`；`reconnecting` = `state==='online' && !connected`；`offline` = 墓碑）+ `total`；④ `callable = router.ok && web.ok && agents.online >= 1`；⑤ `epoch`。
- **验收判据（可执行）**:
  1. **形态与三项可拆**：`curl /api/health` ⇒ 200 且含全部键；`agents.online` / `agents.reconnecting` / `agents.offline` / `agents.total` **分别可读**（不是合成数）。
  2. **三态计数正确**：① 无 agent ⇒ `online:0`；② agent 在线 ⇒ `online:1`；③ `kill -9` 该 agent（租约未过期）⇒ `reconnecting:1`、`offline:0`、`online:0`；④ 租约过期后 ⇒ `offline:1`。
  3. **Router 不可达仍 200**：停 router ⇒ 200、`router.ok:false` 且 `router.detail` **含 socket 路径**、`callable:false`（`epoch` 用回退值）。
  4. **零副作用**：调用前后 `GET /api/calls` / `/api/agents` / `/api/pickup` 与调用前逐字相同；Router 任务表无新条目（`hub uds router.task_list` 前后一致）。
  5. **软重启转绿**：只重启 hub（保留 agent 进程）⇒ 待 agent 重连后 `callable:true` 且不修改任何身份即可继续派发与查询（与 T12 的软重启判据共用一次实验）。
- **前置依赖**: T0、T1（`epoch`）、T2（名册项参与 `reconnecting`）
- **优先级**: P0

---

### T12: 投影扩展（`/api/agents` 5 字段 / `/api/calls` `last_event_at` / `agent_state` 推送）

- **服务哪条 AC**: F05 全部 6 条 + F16 的"三态快照可区分/重连中不消失/不谎报在跑" + F06 全部 5 条
- **描述**: ① `GET /api/agents` 行追加 5 字段（数据来源 = `router.status` + `router.task_list`）；② `GET /api/calls` 行追加 `last_event_at`；③ 投影轮询扩展：在有 `agent_state` 订阅者时额外拉一次 `router.task_list`，四字段或 `connected` **有变化才发**一帧 `agent_state`（播种不发）；④ 名册项（T2）参与视图呈现且四字段清空。
- **文件·锚点**: `GET /api/agents` handler `:486-508`（**追加**字段，既有 5 键不动）；`GET /api/calls` 映射 `:1136-1156`（**追加**一列）；`createTopologyWatch`（`:216-262`）——扩展点建议在 web 侧新增**第二个**投影 tick（或在该 tick 内追加一次 `task_list`，**需保留既有 `agent_online/offline` 行为逐字不变**，A6）；`transport.publishFiltered` 转投 `agent_state`（契约 4 的第 7 名）。
- **步骤**: ① agents 行投影；② calls 行投影；③ tick 扩展 + 变化比较 + 只对 `agent_state` 订阅者拉 `task_list`；④ 名册项参与 + 四字段清空 + 既有 `?state=online` 判据不动。
- **验收判据（可执行）**:
  1. **既有 5 键不变**：`GET /api/agents` 每行的前 5 键名/顺序/取值与 T0 基线相同；新 5 键追加在后；`?state=online` 结果集与基线相同（判据仍 `state === 'online'`）。
  2. **空闲/在跑可判**：空闲实例 ⇒ `busy:false / current_call_id:null / queued:0 / since:null`；派发后 ⇒ `busy:true` 且 `current_call_id` == `GET /api/calls/<id>` 的 `call_id`（同源）。
  3. **队列可见**：在跑期间连续派发 3 次 ⇒ `queued ≥ 1`，队列消化后下降（回收为 0）。
  4. **`agent_state` 变化才发**：订阅 `/api/subscribe?principal=p1&kinds=agent_state` ⇒ 一次"空闲 → 在跑 → 空闲"的跳变**不轮询**即可收到 ≥2 帧（含 `busy` 翻转）；订阅建立时**无初始帧**；无变化的静默期内**不产生**新帧。
  5. **零新增 UDS 流量**：无 `agent_state` 订阅者时，`GET /api/agents`/`/api/calls` 的既有面**不额外拉** `router.task_list`（取证：router 侧无对应请求/日志增量，或用进程级观测对比有/无订阅者两次）。
  6. **三态 + 重连中不消失**：`kill -9` agent 后（租约内）⇒ `GET /api/agents` 该行 `state:'online' + connected:false`（**仍在列表中**）；重连后回到 `connected:true`；租约过期后 ⇒ `state:'offline'`（墓碑）。
  7. **软重启窗口**：只重启 hub（保留 agent 进程、T2 名册文件在）⇒ 重启后首次快照中该实例以 `online + connected:false` 出现且 `busy:false / current_call_id:null / queued:0 / since:null`（**不残留重启前的在跑投影**）；agent 重连后回到 `connected:true`；`heartbeatTimeoutMs` 内未回归的提示项消失。
  8. **`last_event_at`**：`GET /api/calls` 每行含 `last_event_at` = 任务条目 `updated_at`；既有 6 列逐字不变；**无** `idle_ms` 键。停滞对照：持续推进型调用的该值单调前进，无新事件型调用该值停住；终态后不再前进。
  9. **取消/终态不产生虚假在跑**：取消一次调用后 `GET /api/agents` 的该实例不出现 `busy:true`（`current_call_id` 不复现）。
- **前置依赖**: T0、T2（名册项呈现）
- **优先级**: P0

---

### T13: 既有面回归比对（迭代前后逐字）+ 8 条新路由可达性与 `/api/docs` 投影

- **服务哪条 AC**: G01 全部 5 条 + 路由登记组的"8 条登记/可达性/`/api/docs` 投影/既有 21 条 summary 未改"
- **描述**: 用 T0 的同一脚本重跑一遍，与基线逐字比对；并核对 8 条新路由的登记、可达性与兜底行为。
- **文件·锚点**: 零源码改动；产出 `/tmp/pr005-after/` 与 `diff` 结果。
- **步骤**: ① 重跑端点族与会话脚本；② 逐份 `diff`；③ 核 `GET /api/docs` 投影（8 条在场 + 既有 21 条 summary/字段未改）；④ 核 8 条路由的可达性与 404 兜底。
- **验收判据（可执行）**:
  1. **既有 21 端点逐字**：21 份响应体与基线 `diff` 全部为空（**含 4xx/5xx 文案**）；唯一允许差异 = 明确追加的响应字段（`/api/agents` 的 5 键、`/api/calls` 的 `last_event_at`、`POST /api/calls` 携带 `requester` 时的 `warnings`）——比对时须逐条列出并给出追溯（PR 验收标准），其余任一字节差异 = 回归失败。
  2. **既有 4 推送面事件类集合与语义**：同形态会话（订阅 → 派发 → 增量 → 终态）在 `/api/stream`、`/api/events`、`/api/calls/stream`、`/api/calls/<id>/stream` 上的**事件名序列**与基线相同；新面订阅的存在/断开不影响它们（双向）。
  3. **8 条路由登记**：`GET /api/docs` 投影含且仅含这 8 条新路径；每条含 8 个元数据字段；既有 21 条的 `summary` 与既有字段说明**逐字未改**（`params`/`response`/`errors` 只做追加）。
  4. **可达性与兜底**：8 条新路由在典型入参下返回各自契约形态（2xx 或既定的 4xx/5xx）；`GET /api/calls/wait` 命中本路由（非 404）；`POST /api/calls/<id>/cancel` 的未知 id 走 404；`GET /api/health` 的 Router 不可达特例仍 200。
  5. **零面**：`git diff --name-only 51eb893 HEAD` 仅含 `oamp/src/web.js`（+ PR 文件 / 本 tasks 文件）；`git diff -- oamp/package.json oamp/src/persist.js oamp/src/transport.js oamp/src/registry.js oamp/src/router.js oamp/sdk/uds.js oamp/web oamp/API.md oamp/llms.txt oamp/sdk/surface.js oamp/skill/hub.md` **为空**；`STATIC_FILES` 键集合与基线相同。
  6. **既有 `mode:block` 与对账/幂等闸门**：`POST /api/calls {mode:'block'}` 的阻塞-终态返回语义与基线相同；对账补落仍**恰一条** `out`（`kill -9` agent 场景复跑）。
- **前置依赖**: T0、T1、T2、T3、T4、T5、T6、T7、T8、T9、T10、T11、T12（全部实现任务与基线）
- **优先级**: P0

---

### T14: 验收证据落盘（PR 文件「验收证据」段）+ 零面复核

- **服务哪条 AC**: 全部 11 组 AC 的证据载体齐备（**P1 ≠ 可选**：AC 未全过不算本 PR 完成）
- **描述**: 把 T0~T13 的原始命令与输出按 PR 文件「验收证据」段要求回填：逐条验收的原始命令与输出（`hub api …` / `curl` / 一次性脚本 / `git stash` 前后响应体比对）+ 8 条新路由可达性与 404 兜底对照 + 四推送面迭代前后事件类集合比对 + `/api/docs` 投影摘录。
- **文件·锚点**: `prs/pr-005-web-session-and-call-surface.md` 的 **「验收证据」** 段（只改该段，**不改七字段**）；体例先例 = 0028 `pr-007-execution-gap-record.md`（命令 + 原样输出 + 逐条自检表；**不依赖 `/tmp` 的不可复现引用**）。
- **步骤**: ① 汇总原始输出；② 按四类载体逐条粘贴（命令自带 `cd` 与绝对路径）；③ 逐组自查 AC 对应关系；④ 复核零面与改动面。
- **验收判据（可执行）**:
  1. **四类载体齐备**：① 逐条验收的原始命令与输出；② 8 条新路由可达性 + 404 兜底对照；③ 四推送面迭代前后事件类集合比对；④ `/api/docs` 投影摘录。
  2. **可复现性**：证据段内命令**自带工作目录与绝对路径**，且**不引用 `/tmp/pr005-*` 作为唯一证据源**（关键响应体须内联原样输出）。
  3. **AC 覆盖**：11 组 AC 每条都能指到对应原始输出（缺一即 T14 未完成）。
  4. **零面复核**：`git status --short` 仅 `oamp/src/web.js`（M）与 PR 文件（M）（+ 本 tasks 文件）；无新增未跟踪产物入库（截图、临时脚本一律不入库）。
- **前置依赖**: T13
- **优先级**: P1

---

## 2. 依赖图

```
T0 ─┬─> T1 ─┬─> T3 ──> T4 ──┐
    │       ├─> T5 ────────┤
    │       ├─> T6 ──> T7 ──┼─> T8 ─┐
    │       │         │     ├─> T9 ─┤
    │       │         └─────┼─> T10 ┤
    │       └─> T11 ────────┤       │
    ├─> T2 ─┬───────────────┤       │
    │       └─> T11/T12 ────┤       │
    ├─> T3~T12（各任务）─────┤       │
    └───────────────────────┴───────┴─> T13 ──> T14
```

边（**逐条枚举，共 39 条**；与 §1 各任务「前置依赖」行逐字对应）：

| 前置 | 后继（出边） | 条数 |
|---|---|---|
| `T0` | `T1`、`T2`、`T3`、`T4`、`T5`、`T6`、`T7`、`T8`、`T9`、`T10`、`T11`、`T12`、`T13` | 13 |
| `T1` | `T3`、`T5`、`T6`、`T11`、`T13` | 5 |
| `T2` | `T11`、`T12`、`T13` | 3 |
| `T3` | `T4`、`T13` | 2 |
| `T4` | `T7`、`T13` | 2 |
| `T5` | `T13` | 1 |
| `T6` | `T7`、`T13` | 2 |
| `T7` | `T8`、`T9`、`T10`、`T13` | 4 |
| `T8` | `T13` | 1 |
| `T9` | `T10`、`T13` | 2 |
| `T10` | `T13` | 1 |
| `T11` | `T13` | 1 |
| `T12` | `T13` | 1 |
| `T13` | `T14` | 1 |

逐类理由：
- **`T0 → *`（13 条）**：**基线必须在任何源码改动前捕获**——改动后再取"改动前"基线不可复现（G01 验收 1/3 的判据基础）。
- **`T1 → T3/T5/T6/T11`**：四条面的 `epoch` 字段与 409 由 T1 的助手提供。
- **`T2 → T11/T12`**：名册项参与 `reconnecting` 计数与视图呈现。
- **`T3 → T4`**：T4 判据 6（按需 upsert）的验证车辆 = `GET /api/principals/<id>`。
- **`T4 → T7`**：指针写入以 `call.requester` 为条件（该字段由 T4 加入）。
- **`T6 → T7`**：T7 判据 1（指针）的验证车辆 = `GET /api/pickup`。
- **`T7 → T8/T9/T10`**：关流时点 / 等待句柄释放点 / 取消的终态发布都落在同一个发布点。
- **`T9 → T10`**：取消判据 4 的等待侧需要等待入口。
- **`* → T13`**（T0~T12 各一条）：回归比对覆盖全部改动面（T0 提供基线，T1~T12 提供改动后的行为）。
- **`T13 → T14`**：证据落盘需要 T13 的比对输出。

**无环**：存在拓扑序 `T0 < T2 < T1 < {T3,T5,T6} < T4 < T7 < {T8,T9} < T10 < {T11,T12} < T13 < T14`，满足全部边方向（T2 与 T1 同层，二者互不依赖）。

**最长依赖链（本 PR 内部任务图的关键路径，9 节点）**：`T0 → T1 → T3 → T4 → T7 → T9 → T10 → T13 → T14`（唯一最长链，已机械枚举全部链核对）。
**关键路径任务**：**T0**（基线）→ **T1**（epoch 助手，四条面共用）→ **T3 → T4**（身份面 + 派发归属）→ **T7**（终态收口：指针/关流/解等待）→ **T9**（等待）→ **T10**（取消）→ **T13**（回归比对）→ **T14**（证据收口）。

---

## 3. 执行顺序与分段增量（dev 单次调用 ≤ 30 分钟上限制，见 DC-06/DC-08）

**顺序**：`T0 → T1 → T2 → T3 → T4 → T5`（段 A 会话面）`→ T6 → T7 → T8 → T9 → T10 → T11 → T12`（段 B 调用面）`→ T13 → T14`（收口）。
（段内允许按同文件相邻关系微调；**跨段不得提前**——段 B 的判据依赖段 A 的 `epoch` 助手与身份面。）

**每次调用产出的可验证增量**（每行都能独立跑判据）：
| 调用 | 产出增量 | 独立判据 | 段末共同判据 |
|---|---|---|---|
| 1 | T0 基线目录 | §T0 | — |
| 2 | `ERR_CODE` + epoch 助手 | §T1 | `GET /api/docs` 仍可访问 |
| 3 | 名册助手 | §T2 | 既有面回归（快跑） |
| 4 | 身份两条路由 | §T3 | 段 A 回归：既有 21 端点未变 |
| 5 | `requester`/`warnings` | §T4 | 同上 |
| 6 | `subscribe` + 投递钩子（**段 A 收口**） | §T5 | 段 A 全量回归 + `/api/docs` 含新 3 条 |
| 7 | 取件两条路由 | §T6 | 既有面回归 |
| 8 | `publishCallResult` 补线 | §T7 | 既有面回归 |
| 9 | 流补发 | §T8 | 既有面回归 |
| 10 | `calls/wait` | §T9 | 既有面回归 |
| 11 | `cancel` | §T10 | 既有面回归 |
| 12 | `health` | §T11 | 既有面回归 |
| 13 | 投影扩展（**段 B 收口**） | §T12 | 段 B 全量回归 + `/api/docs` 8 条齐 |
| 14 | 回归比对 + `/api/docs` 核对 | §T13 | — |
| 15 | 证据落盘 | §T14 | — |

**若单次调用未跑完**：在**任务边界**停下，且**不得**留下半条路由（登记了路径但 handler 未写全 ⇒ `GET /api/docs` 与既有回归都会失败）；段 A 未收口（T5 未完成）时**不要**开始段 B。

---

## 4. 验证配方（真集群 + `curl`/`hub` + 一次性脚本；**禁止新增测试文件**，A15）

### 4.1 起真集群（长驻进程一律经 hub 的进程面）

```bash
cd <PR worktree 根>
export OAMP_SOCKET=/tmp/pr005/router.sock
export OAMP_DB=/tmp/pr005/sql.db
export OAMP_WEB_PORT=8431           # 非默认端口，避免与其它会话的真实服务相撞
mkdir -p /tmp/pr005
```
- router：`hub start name=pr005-router application=node args=["oamp/bin/oamp.js","router","start"] env={OAMP_SOCKET,OAMP_DB} ready={log:"ROUTER_READY"}`
- agent（实例名须可反解为存在的角色）：`hub start name=pr005-agent application=node args=["oamp/bin/oamp.js","agent","start","pb-dev"] env={OAMP_SOCKET,OAMP_DB}`；就绪以 router 日志 `AGENT_REGISTERED instance=pb-dev` 为准
- web：`hub start name=pr005-web application=node args=["oamp/bin/oamp.js","web","start","--port","8431"] env={OAMP_SOCKET,OAMP_DB} ready={log:"WEB_READY url=http://127.0.0.1:8431"}`

### 4.2 造调用（**无模型调用**，秒级终态；`repo_url` 唯一键 ⇒ 每次用唯一值）

```bash
B=http://127.0.0.1:8431
PRJ=$(curl -s -X POST $B/api/projects -H 'content-type: application/json' -d "{\"repo_url\":\"https://example.invalid/pr005-$(date +%s)\"}" | jq -r .project.project_id)
CHAT=$(curl -s -X POST $B/api/messages -H 'content-type: application/json' -d "{\"project_id\":\"$PRJ\",\"agent_id\":\"pb-dev\",\"text\":\"@pb-dev !sleep 6\"}" | jq -r .chat_id)
CALL=$(curl -s -X POST $B/api/calls -H 'content-type: application/json' -d "{\"chat_id\":\"$CHAT\",\"agent\":\"dev\",\"task\":\"hi\"}" | jq -r '.calls[0].call_id')
curl -s -N $B/api/calls/$CALL/stream &     # 订阅侧观察（终态即关流）
curl -s $B/api/calls/$CALL | jq .          # 终态信封
```
> 需要长跑项时用 `POST /api/messages` 的 `!sleep N` 分支（shell 执行器，**不触发模型调用**）；需要"在跑"项给 `queued` 计数时连续派发多条。

### 4.3 事件序列采集（新面与既有面同时点对照）

```bash
curl -s -N "$B/api/subscribe?principal=p1&kinds=agent_online,call_state,call_result" | head -50 > /tmp/pr005/new-face.txt &
curl -s -N "$B/api/stream?chat_id=$CHAT" | head -50 > /tmp/pr005/old-face.txt &
# …触发一次派发→终态后比对两侧事件名集合（`grep -o '^event: .*' | sort -u`）
```

### 4.4 四推送面迭代前后比对（G01 验收 1）

同一形态会话在 **① `git stash`（改动前）** 与 **② 改动后** 各跑一次，分别采集四个面的事件名序列并 `diff`。（若 stash 不便，用 §4.5 的 `git show` 副本法。）

### 4.5 `git show` 副本法（基线的可复现替代路径）

```bash
mkdir -p /tmp/pr005-base && git -C <worktree> show 51eb893:oamp/src/web.js > /tmp/pr005-base/web.js
# 以 /tmp/pr005-base 副本替换包内文件跑一次（跑完恢复）⇒ 得到"改动前"响应体
```

---

## 5. 证据载体与落盘

- **原始输出**：`/tmp/pr005-baseline/`、`/tmp/pr005-after/`、`/tmp/pr005/*.txt`（临时面；**关键响应体须内联进 PR 文件**，不得只留路径引用）。
- **最终证据载体**：`prs/pr-005-web-session-and-call-surface.md` 的 **「验收证据」** 段（PR 文件自身在文件范围内，原文即要求"本 PR 执行时填写"）；真集群起停记录按本迭代 `status.md` 体例由**主 agent** 留存（本 PR 不写 `status.md`）。
- **不得**：新增文档 / 截图入库 / 改 `status.md`、`history.md`、`API.md`、`llms.txt`（后两者归 pr-006）。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（T8 的"至多一帧终态帧"判据的机制口径）**：AC 只给出**不变量**（F10 验收 2），未给出实现机制。本任务列表把它落为**可观测判据**（`event: call_result` 计数 = 1 且只关闭一次），并建议一种确定性实现（**非架构决策，属 L3**）：在 web 侧维护单调发布序号——`publishCallResult` 记 `call.terminalSeq = ++seq`，stream handler 在**同步**完成订阅登记后捕获 `regSeq = seq`，随后异步读到终态时判定 `call.terminalSeq > regSeq` ⇒ 实时路径已投达本连接 ⇒ **跳过补发**；否则补一帧。依据 A-08（"订阅登记后若已通过实时路径收到过终态帧，补发被跳过"）与 Node 单线程语义。若主 agent 要求其他机制，判据（计数 = 1）不变、实现可换。
- **[model_inferred] MI-P2（T5 的谓词缺省口径）**：`kinds` 与 `agents` **都缺** ⇒ 谓词**恒真**（接收全部 7 名）。依据：`transport.handleSubscribe` 已把"缺省 predicate"定义为恒真（A2）+ A-03 第 4 条（两参数均可选）；且白名单在**投递侧**已由契约 4 收口（`chat_state`/`message`/`notice` 不进新面）⇒ 恒真不会泄漏越界事件名。
- **[model_inferred] MI-P3（T11 的 `agents.total` 与名册项口径）**：`total = online + reconnecting + offline`，且**名册提示项计入 `reconnecting`**（它们以 `online + connected:false` 呈现）。依据：A-12（三问由同一次 `router.status` 派生）+ A-13（名册项呈现形态）；F15 只要求三项"分别可读"，未定义 `total` 的确切成分。

**无其他推导项**：其余 AC 的判据均可逐字回指 PR 文件、`architecture.md`（§3.x / §4 A-xx / §5.x / §6.x / §7 L2-xx / §9.1）或 §0.3 的事实锚点。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的 20 条边与拓扑序；T1↔T2、T3↔T6 等看似相邻的任务已逐条核对为**无相互依赖**）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **依赖已满足（正面事实）**：本 worktree 的 base = `51eb893`，已合并 **pr-001 / pr-002 / pr-003** ⇒ `router.task_cancel`、`router.status.generation`、节点 `connected`、任务 `started_at`、`principals.js`/`pickup.js`、`transport.handleSubscribe`/`publishFiltered`/`closeCallSubscriptions` **均已在树内可用**（A1/A2）。故本 PR **不需要**为"依赖未合并"做任何降级或兼容分支。
2. **已合并实现与设计稿的两处命名差异（dev 必须按实现写，不得按设计稿猜）**：① `registry.js` 导出的 generation 名是**小写** `generation`（`registry.js:30`），不是设计稿里的 `ROUTER_GENERATION`；② `router.task_cancel` 的 `TASK_ALREADY_FINAL` / `TASK_NOT_FOUND` 是 **JSON-RPC `data.code`**（`respond.error`），不是 HTTP 码 ⇒ web 侧须按 `RpcError.dataCode` 分支（A2/A5）。两处均已在 §0.3 标注为锚点。
3. **`GET /api/calls/stream`（对话作用域）在终态后**是否算"关流范围只到 `call:<id>`"的判据：PR 的 F09 验收 3 只要求 `chat-calls:` **不关**；本任务列表按此判定（T7 判据 4），**不**要求 `chat-calls:` 在对话关闭时关流（那是既有 `close(chatId)` 的语义，本 PR 不动）。
4. **`/api/calls/wait` 的"位置纪律"不可在最终态里被自动验证**：AC 要求的是"表中位置在此之前"，本任务列表用**可达性 + 反证**（临时移位 ⇒ 404 `call 不存在: wait`，取证后恢复）落地（T9 判据 8）——该反证会**短暂改动**路由顺序，务必在证据中写明已恢复原位并附恢复后的复跑结果。
5. **简报提及的 `DC-13` 不存在**（本迭代 `deferred-demand-changes.md` 只到 `DC-09` + `DC-08a`）；本 PR 按 DC-06/DC-08 的 30 分钟切分约束执行（15 个任务、每任务一次调用可产出可验证增量）。
6. **简报工作区地址与实际一致**：`…/worktrees/0029-pr-005-web-session-and-call-surface` 存在，分支 = `feat/0029-pr-005-web-session-and-call-surface`（无需纠偏）。
7. **粒度/决策记录（本 PR 未写 `roles/planner/data/`）**：本次按"**每个任务自带可执行判据 + 段末共同回归**"切分（15 任务 / 3 段），其中把 T6（取件路由）与 T7（指针写点）**刻意分列**、并让 `T6 → T7`（而非直觉上的"先写后读"）——因为 T7 的指针判据**只能经取件面观测**；同理 T3 先于 T4（T4 的按需 upsert 判据经身份面观测）。这类"验证车辆决定依赖方向"的决策按 planner 角色定义本应记入 `data/`，但本 PR 文件范围不含（且明列不触碰）`roles/**` ⇒ 记录在此，不越界写 `roles/`。
8. **未发现的架构信息缺口**：11 组 AC 均可在 PR 文件、`architecture.md`（§3.1~§3.10 / §4 A-01~A-14 / §5.1~§5.5 / §6.1~§6.2 / §7 L2-xx / §9.1）与 `prd/*` 找到可追溯依据；三条需要推导的口径（MI-P1~MI-P3）已列 §6 等确认。

