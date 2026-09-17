# pr-002-tasks.md — pr-002 内部任务列表（池内路由叶子模块：最空闲选择 + 会话粘性 + 在飞预留）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-002-pool-routing-module.md`
**PR worktree（绝对路径，唯一代码写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-002-pool-routing-module`
**PR worktree 分支**: `feat/0030-pr-002-pool-routing-module`（落盘时 HEAD = `9f071b8`，`git status --short` 为空；与迭代分支 tip `e01e2a4` 的 merge-base = `9f071b8` ⇒ 本文件全程以 `9f071b8` 为 diff 基准）
**任务总数**: **4**（T1~T4）｜ **依赖图**: **无环**（链式，见 §2）｜ **关键路径**: `T1 → T2 → T3 → T4`（4 节点）
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（5 条验收标准 + F06·F07）+ `architecture.md`（§3.4 第 1~3 条、§4 A-06 / A-07、§5 变更面、§8 奥卡姆检验、§9-5）+ `prd/F06-role-instance-pooling.md`（验收 1~5）、`prd/F07-pool-routing-stickiness.md`（验收 1~5）+ 代码库实读（§0.3 逐条带 `文件:行号`）

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（唯一）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/pool-routing.js` | **新建**（唯一代码文件） | 头注 + `createPoolRouting({roleFromInstanceId})` 工厂 + 池成员判定 + 空池回落（**T1**）；次序键选择 + 在飞预留计数（**T2**）；粘性表（读 / 重绑 / `noReuse` / 失效）（**T3**） |

> `pr-002-pool-routing-module-tasks.md`（本文件）是阶段 5 增量产物，**不计入** PR 的代码改动面（`tools/check-pr-gates.py:39-41` 已把 `-tasks.md` 排除在 PR 文件之外）。
> 取证产物一律落 `/tmp/0030-pr-002/`，**不入库**（§5）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/src/` 下其余 **25** 个既有 `.js`（含接线面 `web.js`、只读体例参照 `role-binding.js`、`router.js` / `registry.js` / `context-pool.js` / `inbox.js` / `principals.js`）；`oamp/package.json`、`oamp/API.md`、`oamp/README.md`、`oamp/llms.txt`、`oamp/skill/hub.md`、`oamp/sdk/**`、`oamp/web/**`、`oamp/bin/**`、`oamp/scripts/**`、`cluster.json`、`roles/**`、`tests/**`、`tools/**`。
  追溯：PR 文件「文件范围」（只列 `oamp/src/pool-routing.js`）+ architecture §5「明确不改（零改动）」列。
- **不新增**：任何 HTTP 路由（既有 **29 条**不变；本迭代明列"不新增路由"）、任何协议方法（architecture §4 A-06「不做」条：`pool_pick` 被明确拒绝）、任何配置键 / env 键、任何第三方依赖、任何测试文件、任何目录、任何定时器、任何持久化写入。
- **不接线（本 PR 最易越界项）**：`oamp/src/pool-routing.js` **不得被任何既有文件 import**（全仓 `from './pool-routing.js'` 零命中）；`pickInstance` 的 deps 注入（`web.js:2457-2460`）与 `/api/calls` 目标解析替换（`web.js:1342`）**全部归 pr-005**，本 PR 不预置调用点、不留 TODO 挂钩、不改 `web.js`。
  追溯：PR 文件「上下文摘要」明文"本 PR 只交付模块与其自证，deps 注入与 `/api/calls` 调用点替换在 pr-005"。
- **不做（属其他 PR）**：`web.js` 的全部接线与 `pickup.js` 退役（pr-005）、turn timer 双计时（pr-004）、`inbox` 表与持久化（pr-003）、文档面同步（pr-006）、既有面冻结核查与 G01 证据文档（pr-008）。
- **做错的形态（明确排除，每条都有上游依据）**：
  1. 在模块内**复制** `roleFromInstanceId` 的推导公式 —— architecture §4 A-06"复用，不复制公式"；本 PR 的形态 = 由调用方注入。
  2. 在模块内**复制** `deriveAgentWork` 的负载公式（自己遍历 taskRows） —— 同上"不需要新度量"；负载由调用方算好注入（§0.4 契约 4）。
  3. 模块自己发 UDS 查询 —— PR 验收 1 禁网络 I/O；快照由调用方注入。
  4. 给粘性表加 TTL / 淘汰定时器 —— architecture §4 A-07"进程内、**无 TTL、无淘汰定时器**"（§9-5 同口径）。
  5. 给空池造新错误面 / 静默排队 / 自动拉起实例 —— F06 验收 4 + MI-9 + architecture §3.4 第 2 条末句。
  6. 引入"同会话粘性 / 新会话最空闲"之外的第三、第四条路由规则 —— F07 边界。
  7. 改 `ContextPool` 的 `(chat_id, agent_id)` 键语义或同键串行语义 —— F06 验收 4 / F07 验收 4（粘性表只回答"落到哪个实例"）。

### 0.3 读码事实锚点（2026-09-17 实读，PR worktree HEAD `9f071b8`）

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **A1** | `router.status` 的节点 = `registry.snapshot()` 投影的 **5 字段** `{instance_id, session_id, state, last_heartbeat, connected}`，`connected = (connId !== null)`，按 `instance_id` 升序返回 | `oamp/src/registry.js:156-168` |
| **A2** | `router.status` = `{ nodes: registry.snapshot(), generation }`，任意连接可查（无需注册身份） | `oamp/src/router.js:379-382` |
| **A3** | `message.send` 对 `state !== 'online'` **或** `connId === null` 的节点直接回 `AGENT_OFFLINE` ⇒ 未连通节点进池只会浪费一次选择（池成员要求 `connected` 的理由） | `oamp/src/router.js:285-287` |
| **A4** | `deriveAgentWork(taskRows)` 是 `web.js` 的**内部函数（未导出）**，产出 `Map<instance_id, {busy, current_call_id, queued, since}>`；`projectAgentState` 复用它 | `oamp/src/web.js:214-233`、`:237-251` |
| **A5** | 目标解析**唯一调用点** = `/api/calls` handler 的 `const agentId = instanceIdForRole(role)`，紧随其后 `roleOfInstance(agentId) !== role` ⇒ 404 `agent 不可用: <role>（无对应在线实例）`（= MI-9 要求逐字复用的既有回落结论） | `oamp/src/web.js:1342-1346` |
| **A6** | deps 注入体例 = 接线处 `createApiRoutes({ db, transport, …, sendTask, sendControlNotice, scheduleReconcile, … })` 显式传名 | `oamp/src/web.js:2457-2460` |
| **A7** | `sendTask` 投递异常重试一次后**吞掉异常**（返回 `undefined`） ⇒ "settle" 的判定点在调用方（pr-005），本 PR 只提供 `release(instanceId)` 供其调用 | `oamp/src/web.js:2424-2441` |
| **A8** | `instanceIdForRole(role) = 'pb-' + role`（**公式只此一处**）；`roleFromInstanceId(id)` = `'pb-<rest>'` 且 `roles/<rest>/<rest>.md` 存在 ⇒ `<rest>`，否则 `null` | `oamp/src/role-binding.js:30-44` |
| **A9** | 叶子模块体例（`role-binding.js`）：头注 4 行 = 职责 / 为什么落在此处 / "零 src 内 import"声明 / 公式唯一性；零第三方依赖 | `oamp/src/role-binding.js:1-4`（`import` 行在 `:8-10`） |
| **A10** | 仓内**无任何 `*.test.js`**（`find` 命中 0）；`tests/` 仅两个 shell 静态检查脚本、均不涉本模块 ⇒ 本 PR 自证载体 = **一次性脚本 + `grep`**，且 PR 文件范围不含测试面 | 实测 |
| **A11** | PR worktree 干净；`oamp/**` 在 base `9f071b8` 与迭代分支 tip `e01e2a4` 之间**零差异**（`git diff --name-only` 命中 0 行）⇒ 代码面基准无歧义 | `git -C <worktree> diff --name-only 9f071b8 iteration/0030-hub-communication-upgrade -- oamp/` |
| **A12** | `cluster-config.js` 的 `roles.<role>` 仅支持 `enabled/model/tools/permission/cwd`，`instance_id` **恒为** `instanceIdForRole(role)`（无覆盖字段）；`cluster.json` 每角色一条 ⇒ 按 A8 的解析规则，**现配置下同角色池上限 = 1**（多实例池的构造问题见 §7 疑问 3） | `oamp/src/cluster-config.js:136,154`、`cluster.json` |

### 0.4 本 PR 冻结契约（跨 PR 接缝，一次定死；下游 pr-005 按此编码）

1. **落点与形态**：新文件 `oamp/src/pool-routing.js`，ESM；**唯一导出** `createPoolRouting`（具名；**无 default export、无别名、无第二个导出名**）。工厂入参 = `{ roleFromInstanceId }`（本模块的**唯一注入依赖**）。
   〔追溯：PR 验收 1"`roleFromInstanceId` 由调用方注入"；architecture §4 A-06 第 4 条（叶子模块）；§8（`pool-routing.js` 存在理由 = F07 粘性/最空闲 + F06 验收 1 确定性的落点）〕
2. **工厂返回面恰 4 个方法**（对应 PR 验收 1 的"三类"覆盖关系）：
   - `choose(role, {chatId, noReuse, snapshot})` → `instance_id | null` —— **选择**（并内含粘性写、在飞 +1）；
   - `release(instanceId)` → `undefined` —— **在飞预留减**；
   - `bindingOf(chatId, role)` → `instance_id | null` —— **粘性读**（只读、无副作用）；
   - `inflightOf(instanceId)` → `number` —— **在飞预留读**（只读；AC5"净值为 0"的机械判据面，见 §6 MI-P3）。
   〔追溯：PR 验收 1 + 验收 4 + 验收 5〕
3. **`choose` 是同步函数**（不返回 Promise、不 await、不做任何 I/O）：快照由调用方注入，选中即计数 —— AC5"两条并发且快照相同的选择不会落到同一实例"依赖"`+1` 发生在返回之前"。
   〔追溯：PR 验收 1（无文件与网络 I/O）、验收 5；architecture §3.4 第 3 条〕
4. **`snapshot` 形状 = `{ nodes, work }`**：`nodes` = `router.status` 的 `nodes`（A1 的 5 字段形状）；`work` = `deriveAgentWork(taskRows)` 的返回 `Map`（A4）。模块只读 `node.instance_id` / `node.state` / `node.connected` 与 `work.get(id)` 的 `queued` / `busy`（缺项 ⇒ `queued 0 / busy false`）。`snapshot` 缺失或 `nodes` 缺失 ⇒ 视作空池（**不抛错**）。
   〔追溯：architecture §4 A-06 第 1~2 条（池成员读数 = `router.status`；负载 = `router.task_list` + `deriveAgentWork`）；本形状为推导项，见 §6 MI-P2〕
5. **池成员判定**：`node.state === 'online' && node.connected === true && roleFromInstanceId(node.instance_id) === role`；非成员一律不参与选择。
   〔追溯：PR 验收 2；architecture §4 A-06 第 1 条与 §3.4 第 1 条（逐字同式）；A3（`connected` 的必要性）〕
6. **次序键** = `(queued, busy ? 1 : 0, inflight, instance_id)` **字典序升序取最小**；前三个分量相等时按 `instance_id` **码元升序**（`a < b` 即更小）做确定性 tie-break，**不随机**、不依赖快照内顺序。
   〔追溯：PR 验收 3；architecture §4 A-06 第 3 条（逐字同键）〕
7. **粘性表**：进程内 `Map`，键 = `chatId + '\u0000' + role`，值 = `instance_id`；**无 TTL、无淘汰定时器**。
   - 命中（该键有绑定，且绑定实例 ∈ 当次池，且 `noReuse !== true`）⇒ **直接返回绑定实例**（即便它不是最空闲）；
   - 未命中 / 绑定实例不在池（MI-11）/ `noReuse === true` ⇒ 按次序键选最空闲并**重绑**（覆盖该键），**不报错**；
   - 池为空 ⇒ 返回 `null`，并删除该键的绑定（失效条目顺带丢弃），**不静默排队**。
   〔追溯：PR 验收 4；architecture §4 A-07（表与键 / 生命周期与增长 / 失效口径）+ §3.4 第 2 条；prd/F07 验收 1/3 + MI-11〕
8. **`noReuse` 语义**（= `/api/calls` 项级 `new_session: true` 在 web 侧译成的入参）：本次忽略既有绑定、按最空闲重选并重绑；下一次不带该声明时即粘到本次选中的实例。
   〔追溯：architecture §4 A-07"不需要延续"声明的承载形态条（`new_session`）+ §3.4 第 2 条；prd/F07 验收 3〕
9. **在飞预留计数**：`choose` 在返回实例**之前**对该实例 `+1`（含粘性命中路径）；`release(instanceId)` 对该实例 `−1`，减到 0 时删除该条目；对未计数实例 `release` ⇒ **no-op**（计数不出现负数）。
   〔追溯：PR 验收 5；architecture §4 A-06 第 3 条 + §3.4 第 3 条（"选中 ⇒ +1；settle ⇒ −1"）〕
10. **`chatId` 形态守卫**：`chatId` 非"非空字符串" ⇒ 本次**不做粘性读写**（不建条目、不删条目），选择照常进行、**不抛错**。
    〔追溯：PR 验收 2"模块自身不造错误面"；`/api/calls` 已保证 `chat_id` 非空（`web.js:1327-1335`）⇒ 该守卫只兜底，不改变生产路径〕
11. **零面**：文件内 **0 条 `import`**（连 `node:` 也不要）、无定时器、无文件/网络 I/O、无 `process.*`、无 `Date.now()`。头注照 A9 体例（职责 / 为什么在 web 进程（Router 任务条目不携带 `chat_id`）/ 零依赖声明 / 导出面逐条列名）。
    〔追溯：PR 验收 1；architecture §4 A-07 第 1 条"为什么键在 web 而不在 Router"〕
12. **下游接缝（本 PR 不实现，仅冻结）**：pr-005 在 `startWeb` 内 `const poolRouting = createPoolRouting({ roleFromInstanceId })`，令 `pickInstance = (role, opts) => poolRouting.choose(role, opts)` 注入 `createApiRoutes` 的 deps（A6 体例），快照每请求取一次（`router.status` + `router.task_list` 两次只读查询）；`/api/calls` 的替换点为 A5；`release` 在每次派发的 settle 处调用（A7）。⇒ 本 PR 冻结的签名与返回面**不得**在后续 PR 中被改写。
    〔追溯：architecture §4 A-06 第 4~5 条（`pickInstance(role, {chatId, noReuse, snapshot})` 调用形状与替换落点）+ §5 变更面 `web.js` 第 ①⑦ 项；pr-005 `depends_on` 第 2 条〕

### 0.5 PR 验收标准 → 任务映射（5 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | 文件存在，导出面覆盖"选择 / 粘性读写 / 在飞预留增减"三类；无定时器、无文件与网络 I/O、无对其它 `src/**` 的 import | **T1**（形态骨架 + 注入口）+ **T4**（导出面与零面的机械核查） |
| AC2 | 池成员过滤正确（`offline` / `connected === false` / 异角色三者均不被选中）；池为空 ⇒ `null`，不造错误面、不静默排队 | **T1**（+ T4 复跑，含"空池不留粘性"一条） |
| AC3 | 选择确定性：同快照 + 同本地预留计数 ⇒ 同输入同输出；负载并列 ⇒ `instance_id` 升序，不随机 | **T2** |
| AC4 | 粘性：二次选择命中既有绑定；`noReuse` ⇒ 忽略绑定、按最空闲重选**并重绑**；绑定实例不在池 ⇒ 重选重绑且**不抛错** | **T3** |
| AC5 | 在飞预留：`choose` 选中即 `+1`、`release` 即 `−1`；成对调用后净值为 0、无泄漏；两条并发且快照相同的选择不落同一实例 | **T2** |

---

## 1. 任务列表

### T1: `oamp/src/pool-routing.js` —— 骨架 + 工厂与注入口 + 池成员判定 + 空池回落

- **服务哪条 AC**: AC2（AC1 的形态骨架在此建立）
- **描述**: 新建模块：头注（照 A9 体例 + 导出面列名）、`createPoolRouting({roleFromInstanceId})` 工厂、私有 `membersOf(role, snapshot)` 池成员判定（§0.4 契约 5）、`choose(role, {chatId, noReuse, snapshot})` 的**空池分支**（返回 `null`、不抛错、不造错误面）。本任务**不**实现在飞计数与粘性（T2 / T3）。
- **文件/锚点**: 新建 `oamp/src/pool-routing.js`；头注体例逐条对照 `oamp/src/role-binding.js:1-4`（A9）；成员判定的三个条件与 `oamp/src/router.js:285-287`（A3，`connected` 的理由）和 `oamp/src/registry.js:159-165`（A1，字段名）对照。
- **步骤**: ① 头注（职责 / 为什么在 web 进程 / 零 import 声明 / 导出面与 4 个方法名）；② `const STICKY_SEP = '\u0000'`（模块级常量，**不导出**）+ 工厂骨架；③ `membersOf`（节点过滤 + 从 `snapshot.work` 取 `queued`/`busy`）；④ `choose` 的空池分支（`members.length === 0` ⇒ `return null`）；⑤ 成员非空时的临时取值（取候选集中最小 `instance_id` 者，仅用于本任务可判；次序键在 T2 替换）。
- **验收判据（可执行；脚本原文见 §4.2，本任务判定其中 **8 条** = AC2 段中除"空池不留粘性"的 5 条 + 末段"真实解析器"的 3 条）**:
  1. **AC2 过滤**：快照含 `pb-dev-9`（`state='offline'`）、`pb-dev-2`（`connected=false`）、`pb-other`（异角色）、`pb-dev`（合格）⇒ `choose('dev', {chatId, snapshot})` 返回 **`'pb-dev'`**（三者均不被选中）。
  2. **AC2 空池**：`nodes: []` ⇒ 返回 `null`；全部节点被过滤（只剩 `state='offline'`）⇒ 返回 `null`；`snapshot` 数据缺失（只有 `chatId`）⇒ 返回 `null` 且**不抛错**。
  3. **AC2 不造错误面**：上述三条 `null` 分支均不抛异常、不返回错误对象（返回值严格 `null`）。
  4. **AC2 池内选择**：池 = `{pb-dev-2}`（另一节点异角色）⇒ 返回 `'pb-dev-2'`（不返回非池成员）。
  5. **AC2 真实解析器**：注入 `role-binding.js` 的真实 `roleFromInstanceId`（A8）时，`pb-dev-2` 解析为 `null` ⇒ 池内仅 `pb-dev`：返回 `'pb-dev'`；同一 `chatId` 二次选择仍为 `'pb-dev'`（单实例不回归，F06 验收 2）。
  6. **形态**：`Object.keys(await import(...))` = `['createPoolRouting']`（**本任务只做骨架**，工厂返回面的 4 方法断言归 T4）。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §4 A-06 第 1 条（池成员三条件）＋ §3.4 第 1 条；prd/F06 验收 3（池成员 = 当前在线实例）、验收 4（hub 不管理生命周期 ⇒ 模块只读快照、不启停）；PR 验收 2。

---

### T2: `oamp/src/pool-routing.js` —— 次序键（最空闲 + 确定性 tie-break）+ 在飞预留增减

- **服务哪条 AC**: AC3、AC5
- **描述**: 在 `membersOf` 之上实现 §0.4 契约 6 的次序键（`(queued, busy?1:0, inflight, instance_id)` 升序取最小），并把 `choose` 改为**同步返回前**对该实例 `+1`；新增 `release(instanceId)`（`−1`、减到 0 删条目、未计数时 no-op）与 `inflightOf(instanceId)`。
- **文件/锚点**: `oamp/src/pool-routing.js`（紧跟 T1 的 `choose` 骨架）；`busy`/`queued` 的取值口径对照 `oamp/src/web.js:214-233`（A4，`deriveAgentWork` 的字段语义——**只读不复制公式**）；`+1 / −1` 的时序语义对照 architecture §3.4 第 3 条。
- **步骤**: ① 私有 `inflight = new Map()` + 私有比较函数 `before(a, b)`（四分量升序）；② `choose` 取候选集的最小者；③ 返回前 `inflight.set(pick, n + 1)`；④ `release` / `inflightOf`。
- **验收判据（可执行；§4.2 中 **AC3 段 5 条** + **AC5 段 6 条**）**:
  1. **AC3 负载次序**：`pb-dev` queued 1 而 `pb-dev-2` queued 0 ⇒ 选 `pb-dev-2`；`pb-dev` busy 且 `pb-dev-2` queued 1 ⇒ 选 `pb-dev`（`queued` 优先于 `busy`）；queued 相同时 `busy=false` 者胜。
  2. **AC3 确定性 tie-break**：两实例负载全并列 ⇒ 选 `instance_id` **升序最小**者；把快照内节点顺序倒置后结果不变（不依赖输入顺序）；两个**干净**的工厂实例对同一输入返回同一结果（同输入同输出，不随机）。
  3. **AC5 并发分流**：同一快照、两个不同 `chatId` 连续两次 `choose` ⇒ 返回 **不同实例**（`pb-dev` / `pb-dev-2` 各一）。
  4. **AC5 计数可见**：两次选择后 `inflightOf('pb-dev') === 1` **且** `inflightOf('pb-dev-2') === 1`；`release('pb-dev-2')` 后该实例归 0、另一实例仍为 1。
  5. **AC5 净值为 0**：两次 `release` 后两实例均 `0`（无泄漏）；对未计数实例 `release` ⇒ no-op 且 `inflightOf` 仍为 0（不出现负数）。
  6. **AC5 release 真的减了计数**：三实例池连选三次后 `release` 掉第一个选中的实例 ⇒ 下一次选择**回到该实例**（次序键的第三个分量起作用的判别式；release 若是 no-op 则判据失败）。
- **前置依赖**: T1（`membersOf` 的候选集与 `snapshot` 形状由 T1 建立）
- **优先级**: P0
- **追溯**: architecture §4 A-06 第 3 条（次序键原文）＋ §3.4 第 3 条（在飞预留的作用与 `+1/−1` 时点）；prd/F06 验收 1（并发分流 ⇒ 两条不同 `chat_id` 落不同实例）、验收 2（单实例不回归）；prd/F07 验收 2（新会话选最空闲、非随机非固定第一个）；PR 验收 3、验收 5。

---

### T3: `oamp/src/pool-routing.js` —— 粘性表（命中 / 重绑 / `noReuse` / 失效）

- **服务哪条 AC**: AC4
- **描述**: 实现 §0.4 契约 7~8：私有 `bindings = new Map()`（键 `chatId + '\u0000' + role`）、`choose` 的粘性分支（命中且绑定实例 ∈ 池 ⇒ 直接返回绑定；否则按次序键重选并**重绑**；池空 ⇒ 删键并返回 `null`）、`noReuse === true` 忽略绑定并重绑、只读 `bindingOf(chatId, role)`。
- **文件/锚点**: `oamp/src/pool-routing.js`（粘性分支插在 T2 的 `choose` 主干最前）；键与生命周期口径逐条对照 architecture §4 A-07 与 §3.4 第 2 条；`noReuse` 的上游语义对照 A-07 的 `new_session` 条。
- **步骤**: ① `bindings` 表 + 键构造函数（`\u0000` 分隔）；② `choose` 前缀分支（`chatId` 守卫见契约 10）；③ 重绑写入；④ 池空时 `bindings.delete(key)`；⑤ `bindingOf`。
- **验收判据（可执行；§4.2 中 **AC4 段 9 条**断言，归入下列 8 条判据）**:
  1. **AC4 首次建绑 + 命中**：首次 `choose('dev', {chatId:'c1'})` 返回 `pb-dev` 且 `bindingOf('c1','dev') === 'pb-dev'`；把 `pb-dev` 变成明显更忙（`busy:true, queued:2`）后同 `chatId` 再选 ⇒ **仍返回 `pb-dev`**（粘性优先于最空闲）。
  2. **AC4 异会话分流**：同一更忙快照下，另一个 `chatId` ⇒ 按最空闲返回 `pb-dev-2`。
  3. **AC4 键含 role**：同一 `chatId` 对 `verifier` 的选择落在 `verifier` 池内（`pb-verifier`），且不改写 `(chatId, 'dev')` 的绑定（两个键互不干扰）。
  4. **AC4 `noReuse` 重选并重绑**：`choose('dev', {chatId:'c1', snapshot: 更忙快照, noReuse:true})` ⇒ 返回 `pb-dev-2`，且 `bindingOf('c1','dev') === 'pb-dev-2'`。
  5. **AC4 重绑生效**：紧接一次**不带** `noReuse` 的选择 ⇒ 返回 `pb-dev-2`（粘到新实例）。
  6. **AC4 绑定失效（MI-11）**：快照只剩 `pb-dev-2`（绑定的 `pb-dev` 掉线）⇒ 返回 `pb-dev-2`、绑定被重写为 `pb-dev-2`、**不抛错**；另一例：绑定实例 `state='offline'` 同上。
  7. **AC4 空池**：池为空 ⇒ 返回 `null` **且该键绑定被丢弃**（`bindingOf` ⇒ `null`）。
  8. **AC4 粘性不越过池**：粘性命中路径不返回非池成员（由判据 6 的池外构造覆盖）。
- **前置依赖**: T2（粘性分支是 `choose` 主干的前置分支；判据 1 的"粘性优先于最空闲"需要 T2 的次序键才能构造可区分的负载快照）
- **优先级**: P0
- **追溯**: architecture §4 A-07（表与键 / 生命周期与增长 / 失效口径 / `new_session` 语义）＋ §3.4 第 2 条；prd/F07 验收 1（同会话粘性）、验收 3（显式声明不延续 ⇒ 最空闲 + 重绑）、验收 5（可由既有实例标识面观测）、MI-11；PR 验收 4。

---

### T4: 合同面机械核查 + 全量自证复跑 + 改动面封闭性（本 PR 的"自证"交付物）

- **服务哪条 AC**: AC1（导出面与零面的终判）、AC2~AC5（全量复跑）＋ PR「上下文摘要」的"只交付模块与其自证"
- **描述**: 用 `grep` 族 + 一次性脚本，对**已完成**的模块做四类机械判定：① 导出面（模块恰 1 名 / 工厂恰 4 方法）；② 零面（0 import、0 定时器、0 I/O、0 `process.*`、0 时间读取）；③ 全量行为断言（§4.2 全部 31 条）；④ 改动面封闭性（`oamp/**` 恰新增 1 个文件、`package.json` 零 diff、模块未被任何既有文件 import）。
- **文件/锚点**: 零源码改动（只读 `oamp/src/pool-routing.js` + git 只读命令）；原始输出落 `/tmp/0030-pr-002/`（§5）。
- **步骤**: ① 跑 §4.1 导出面/零面；② 跑 §4.2 全量脚本；③ 跑 §4.3 真实解析器对照（已并入 §4.2 末段，可单列输出）；④ 跑 §4.4 封闭性；⑤ 汇总原始输出供 stage 报告引用。
- **验收判据（可执行）**:
  1. **AC1 导出面**：`Object.keys(await import(...)).sort()` = `['createPoolRouting']`（逐字符相等）；`Object.keys(createPoolRouting({roleFromInstanceId}))` 排序 = `['bindingOf','choose','inflightOf','release']`（**多一个/少一个即失败**）。
  2. **AC1 零面**：`grep -cE '^import' oamp/src/pool-routing.js` = **0**；`grep -cE 'setTimeout|setInterval'` = **0**；`grep -cE 'node:fs|node:net|node:http|writeFile|createWriteStream|fetch\(|require\('` = **0**；`grep -cE 'process\.'` = **0**；`grep -cE 'Date\.now\(\)'` = **0**；`grep -cE 'export default'` = **0**；`grep -cE '^export '` = **1**。
  3. **AC2~AC5 全量**：§4.2 脚本 31 条断言全 `PASS`、末行 `RESULT: PASS`、退出码 0（原始输出留存）。
  4. **未接线**：`grep -rn "pool-routing" oamp/ | grep -v '^oamp/src/pool-routing.js:' | wc -l` = **0**（模块未被任何文件 import；排除模块自身头注里的文件名——A9 体例的头注第 1 行含 `src/role-binding.js` 式自指，**不得**用裸 `grep` 判零命中）。
  5. **改动面封闭性**：`git -C <worktree> diff --name-status 9f071b8 HEAD -- oamp/` ⇒ **恰一行** `A oamp/src/pool-routing.js`；`git -C <worktree> diff 9f071b8 HEAD -- oamp/package.json` ⇒ **空**；`git -C <worktree> status --short` 无未跟踪的 `oamp/**` 新文件。
  6. **头注口径**：文件头注含"零依赖 / 零 import"声明与**逐条列出的 4 个方法名**（照 A9 体例）。
- **前置依赖**: T2、T3（导出面与全量断言覆盖 `release` / `bindingOf` / `inflightOf` 与粘性分支，缺任一则判据 1、3 必失败）
- **优先级**: P1（**P1 ≠ 可选**：本 PR 的"自证"是 PR 文件明列的交付物）
- **追溯**: PR 验收 1 + PR「上下文摘要」（"本 PR 只交付模块与其自证"）；architecture §5「新增（2 个文件）」第 2 条、§8（`pool-routing.js` 的保留判定）；A10（仓内无测试文件 ⇒ 自证 = 一次性脚本 + `grep`）。

---

## 2. 依赖图

```
T1 ──> T2 ──> T3 ──┐
                   ├──> T4
        T2 ────────┘
```

边（逐条，均为真实约束；共 4 条）：
- `T1 → T2`：次序键作用于 T1 的候选集（`membersOf` 的 `{instance_id, queued, busy, inflight}` 投影），`snapshot` 形状与 `work` 取值口径由 T1 冻结；T2 不重复实现成员过滤。
- `T2 → T3`：粘性分支是 `choose` 主干的前置分支（"命中 ⇒ 直接用绑定，否则走最空闲"），T2 定义了该主干与"最空闲"的语义；T3 的判据 1（粘性优先于最空闲）需要 T2 的次序键才能构造可区分负载的快照。
- `T2 → T4`、`T3 → T4`：T4 的导出面断言（判据 1）与全量行为断言（判据 3）覆盖`release` / `inflightOf`（T2）与粘性面（T3），任一未完成则判据必失败。

**无环**：全部边的方向均为"小号 → 大号"（`T1 < T2 < T3 < T4`）⇒ 唯一拓扑序 `T1, T2, T3, T4` 同时满足所有边，不存在回到已访问节点的路径。

**最长依赖链（= 本 PR 内部关键路径，4 节点）**：`T1 → T2 → T3 → T4`。
**关键路径任务**：**T1**（候选集与快照口径的唯一生产者）→ **T2**（次序键与在飞计数的唯一生产者，AC3/AC5 的判据面）→ **T3**（粘性表的唯一生产者，AC4 的判据面）→ **T4**（导出面 + 零面 + 全量复跑 + 改动面封闭性 = 阶段 6 verifier 的输入）。

---

## 3. 执行顺序与增量策略

**顺序**：`T1 → T2 → T3 → T4`（同一文件的连续施工；链式依赖决定顺序，非偏好）。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立留证）：
| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | `pool-routing.js`：头注 + 工厂 + `membersOf` + `choose` 空池分支 | §4.2 的 AC2 段（6 条中的 5 条）+ 末段"真实解析器"（3 条）= 8 条 |
| 2 | 次序键 + 在飞预留（`choose` +1 / `release` / `inflightOf`） | §4.2 的 AC3 段（5 条）+ AC5 段（6 条） |
| 3 | 粘性表（`bindingOf` + 重绑 + `noReuse` + 失效/空池丢弃）= **文件完成** | §4.2 的 AC4 段（9 条） |
| 4 | 合同面 grep 族 + 全量复跑 + 改动面封闭性（四份原始输出） | §4.1 / §4.2 / §4.4 |

**若单次调用未跑完**：按**任务边界**停下（不得把"有 `choose` 无 `release`"或"有选择无粘性"的中间态当作完成态交付——T4 的导出面与全量断言要求四方法齐备）；已完成任务的判据输出即为本次调用的增量产物。

---

## 4. 验证配方（**禁止新增测试文件**，A10；全部为一次性脚本 + `grep`，脚本落 `/tmp/0030-pr-002/`）

> 本配方已用一份 `/tmp` 的一次性参考实现**演练通过**（31/31 `PASS`，退出码 0）⇒ 判据的"可判定性"已前置证明；dev 只需让**真实模块**通过同一脚本。

### 4.1 导出面与零面（T4 判据 1/2/6）

```bash
W=<PR worktree 根>
cd "$W"
node --input-type=module -e '
const M = await import(`file://${process.cwd()}/oamp/src/pool-routing.js`);
const { createPoolRouting } = M;
console.log("module exports:", JSON.stringify(Object.keys(M).sort()));
console.log("factory surface:", JSON.stringify(Object.keys(createPoolRouting({ roleFromInstanceId: () => null })).sort()));
'
for p in '^import' 'setTimeout|setInterval' 'node:fs|node:net|node:http|writeFile|createWriteStream|fetch\(|require\(' 'process\.' 'Date\.now\(\)' 'export default' '^export '; do
  printf '%-70s => %s\n' "$p" "$(grep -cE "$p" oamp/src/pool-routing.js)"
done
grep -rn "pool-routing" oamp/ | grep -v '^oamp/src/pool-routing.js:' | wc -l   # 期望 0（模块未被任何文件 import；排除模块自身头注）
```

### 4.2 全量断言脚本（T1~T4 判据；`/tmp/0030-pr-002/verify.mjs` 原文）

```js
// cwd = PR worktree 根；ESM
const base = `file://${process.cwd()}/oamp/src/`;
const MOD = await import(base + 'pool-routing.js');
const { createPoolRouting } = MOD;
const { roleFromInstanceId } = await import(base + 'role-binding.js'); // 仅脚本可 import 仓内模块（模块本体零 import）
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) process.exitCode = 1; };

const NODE = (id, { state = 'online', connected = true } = {}) => ({ instance_id: id, session_id: `s-${id}`, state, last_heartbeat: 1, connected });
const WORK = (spec = {}) => new Map(Object.entries(spec).map(([id, v]) => [id, { busy: v.busy === true, current_call_id: null, queued: v.queued ?? 0, since: null }]));
// 多实例同角色的解析器（真实 roleFromInstanceId 恒把 'pb-<role>' 映到一个角色 ⇒ 池上限 1，见 §7 疑问 3）
const STUB = (id) => { const m = /^pb-([a-z]+)(-\d+)?$/.exec(id); return m ? m[1] : null; };
const mk = (roleOf = STUB) => createPoolRouting({ roleFromInstanceId: roleOf });
const snap = (nodes, work = {}) => ({ nodes, work: WORK(work) });

// ---- AC1 导出面 ----
ok('AC1 模块导出面恰 1 名 createPoolRouting', JSON.stringify(Object.keys(MOD).sort()) === JSON.stringify(['createPoolRouting']));
ok('AC1 工厂返回面恰 4 方法（选择 / 粘性读 / 在飞读 / 在飞减）',
  JSON.stringify(Object.keys(mk()).sort()) === JSON.stringify(['bindingOf', 'choose', 'inflightOf', 'release']));

// ---- AC2 池成员过滤 + 空池 ----
{
  ok('AC2 offline / connected===false / 异角色 均不入池 ⇒ 选中 pb-dev',
    mk().choose('dev', { chatId: 'cA', snapshot: snap([NODE('pb-dev-9', { state: 'offline' }), NODE('pb-dev-2', { connected: false }), NODE('pb-other'), NODE('pb-dev')]) }) === 'pb-dev');
  ok('AC2 空池 ⇒ null', mk().choose('dev', { chatId: 'cA', snapshot: snap([]) }) === null);
  ok('AC2 全被过滤 ⇒ null', mk().choose('dev', { chatId: 'cA', snapshot: snap([NODE('pb-dev', { state: 'offline' })]) }) === null);
  ok('AC2 快照缺失 ⇒ null 且不抛', (() => { try { return mk().choose('dev', { chatId: 'cA' }) === null; } catch { return false; } })());
  const r = mk();
  ok('AC2 空池不留粘性、不留在飞', r.choose('dev', { chatId: 'cA', snapshot: snap([]) }) === null && r.bindingOf('cA', 'dev') === null && r.inflightOf('pb-dev') === 0);
  ok('AC2 非池成员不被选中（此处池 = {pb-dev-2}）', mk().choose('dev', { chatId: 'cA', snapshot: snap([NODE('pb-dev-2'), NODE('pb-other')]) }) === 'pb-dev-2');
}

// ---- AC3 确定性 ----
{
  const two = [NODE('pb-dev'), NODE('pb-dev-2')];
  ok('AC3 queued 小者胜', mk().choose('dev', { chatId: 'x', snapshot: snap(two, { 'pb-dev': { queued: 1 } }) }) === 'pb-dev-2');
  ok('AC3 queued 优先于 busy', mk().choose('dev', { chatId: 'x', snapshot: snap(two, { 'pb-dev': { busy: true }, 'pb-dev-2': { queued: 1 } }) }) === 'pb-dev');
  ok('AC3 queued 相同时 busy=false 优先', mk().choose('dev', { chatId: 'x', snapshot: snap(two, { 'pb-dev': { busy: true } }) }) === 'pb-dev-2');
  ok('AC3 全并列 ⇒ instance_id 升序（与快照内顺序无关）', mk().choose('dev', { chatId: 'x', snapshot: snap([NODE('pb-dev-2'), NODE('pb-dev')]) }) === 'pb-dev');
  ok('AC3 同输入同输出（两个干净实例）', mk().choose('dev', { chatId: 'x', snapshot: snap(two) }) === mk().choose('dev', { chatId: 'x', snapshot: snap(two) }));
}

// ---- AC5 在飞预留 ----
{
  const r = mk();
  const s = snap([NODE('pb-dev'), NODE('pb-dev-2')]);
  const a = r.choose('dev', { chatId: 'c1', snapshot: s });
  const b = r.choose('dev', { chatId: 'c2', snapshot: s });
  ok('AC5 两条并发、快照相同 ⇒ 分落不同实例', a === 'pb-dev' && b === 'pb-dev-2');
  ok('AC5 选中即 +1', r.inflightOf('pb-dev') === 1 && r.inflightOf('pb-dev-2') === 1);
  r.release('pb-dev-2');
  ok('AC5 release 即 −1', r.inflightOf('pb-dev-2') === 0 && r.inflightOf('pb-dev') === 1);
  r.release('pb-dev');
  ok('AC5 成对调用后净值为 0（无泄漏）', r.inflightOf('pb-dev') === 0 && r.inflightOf('pb-dev-2') === 0);
  ok('AC5 未计数实例 release ⇒ no-op、不出现负数', (() => { r.release('pb-nope'); return r.inflightOf('pb-nope') === 0; })());

  const r3 = mk();
  const s3 = snap([NODE('pb-dev'), NODE('pb-dev-2'), NODE('pb-dev-3')]);
  r3.choose('dev', { chatId: 'a', snapshot: s3 });
  r3.choose('dev', { chatId: 'b', snapshot: s3 });
  r3.choose('dev', { chatId: 'c', snapshot: s3 });
  r3.release('pb-dev');
  ok('AC5 release 真的减了计数（释放后回到最空闲 pb-dev）', r3.choose('dev', { chatId: 'd', snapshot: s3 }) === 'pb-dev');
}

// ---- AC4 粘性 ----
{
  const r = mk();
  const s = snap([NODE('pb-dev'), NODE('pb-dev-2')]);
  ok('AC4 首次选择建立绑定', r.choose('dev', { chatId: 'c1', snapshot: s }) === 'pb-dev' && r.bindingOf('c1', 'dev') === 'pb-dev');
  const loaded = snap([NODE('pb-dev'), NODE('pb-dev-2')], { 'pb-dev': { busy: true, queued: 2 } });
  ok('AC4 二次选择命中既有绑定（不按负载重选）', r.choose('dev', { chatId: 'c1', snapshot: loaded }) === 'pb-dev');
  ok('AC4 异 chat ⇒ 按最空闲', r.choose('dev', { chatId: 'c2', snapshot: loaded }) === 'pb-dev-2');
  ok('AC4 键含 role：同 chat 异角色互不干扰',
    r.choose('verifier', { chatId: 'c1', snapshot: snap([NODE('pb-verifier'), NODE('pb-verifier-2')]) }) === 'pb-verifier'
    && r.bindingOf('c1', 'dev') === 'pb-dev' && r.bindingOf('c1', 'verifier') === 'pb-verifier');
  ok('AC4 noReuse ⇒ 忽略绑定、按最空闲重选并重绑',
    r.choose('dev', { chatId: 'c1', snapshot: loaded, noReuse: true }) === 'pb-dev-2' && r.bindingOf('c1', 'dev') === 'pb-dev-2');
  ok('AC4 重绑生效：下一次无声明即粘新实例', r.choose('dev', { chatId: 'c1', snapshot: loaded }) === 'pb-dev-2');
  ok('AC4 绑定实例不在池 ⇒ 重选重绑、不抛错',
    (() => { try { return r.choose('dev', { chatId: 'c1', snapshot: snap([NODE('pb-dev-2')]) }) === 'pb-dev-2' && r.bindingOf('c1', 'dev') === 'pb-dev-2'; } catch { return false; } })());

  const r9 = mk();
  r9.choose('dev', { chatId: 'c9', snapshot: s });
  ok('AC4 绑定实例离线 ⇒ 重绑到池内实例', r9.choose('dev', { chatId: 'c9', snapshot: snap([NODE('pb-dev-2')]) }) === 'pb-dev-2' && r9.bindingOf('c9', 'dev') === 'pb-dev-2');
  ok('AC4 池为空 ⇒ 绑定被丢弃、返回 null', r9.choose('dev', { chatId: 'c9', snapshot: snap([]) }) === null && r9.bindingOf('c9', 'dev') === null);
}

// ---- AC2/单实例不回归：真实解析器（A8）----
{
  const r = createPoolRouting({ roleFromInstanceId });
  const s = snap([NODE('pb-dev'), NODE('pb-other', { state: 'offline' }), NODE('pb-dev-2')]);
  ok('AC2 真实解析器：pb-dev-2 不解析为 dev ⇒ 池内仅 pb-dev', r.choose('dev', { chatId: 'c1', snapshot: s }) === 'pb-dev');
  ok('AC2 单实例：二次选择同目标', r.choose('dev', { chatId: 'c1', snapshot: s }) === 'pb-dev');
  ok('AC2 真实解析器下池为空 ⇒ null', r.choose('dev', { chatId: 'c1', snapshot: snap([NODE('pb-dev', { connected: false })]) }) === null);
}

console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
```

### 4.3 一次性断言脚本的运行约束

- `STUB` 解析器（`/^pb-([a-z]+)(-\d+)?$/ ⇒ capture 1`）是多实例同角色池的**唯一构造手段**（原因见 §7 疑问 3）；真实 `roleFromInstanceId` 段（脚本末段）只用于单实例不回归与"未解析 ⇒ 不入池"两条。
- 每个场景用**新的工厂实例**（`mk()`）⇒ 粘性表与在飞计数互不污染，断言顺序无关（`AC5` 段内对同一实例的调用顺序是判据的一部分，已显式排列）。
- 脚本**不改仓库文件、不写仓库**；`node` 直跑，cwd = PR worktree 根。

### 4.4 改动面封闭性（T4 判据 5）

```bash
WT=<PR worktree 根>
git -C "$WT" diff --name-status 9f071b8 HEAD -- oamp/            # 期望：恰一行 "A  oamp/src/pool-routing.js"
git -C "$WT" diff 9f071b8 HEAD -- oamp/package.json              # 期望：空
git -C "$WT" status --short                                      # 期望：无未跟踪的 oamp/** 新文件
git -C "$WT" diff 9f071b8 HEAD -- oamp/src/web.js oamp/src/role-binding.js   # 期望：空（接线归 pr-005）
```

---

## 5. 证据载体与落盘

- **原始输出**：§4.1 / §4.2 / §4.4 的 stdout 原样落 `/tmp/0030-pr-002/`（如 `verify.out` / `surface.out` / `closure.out`）——**不写进仓库、不写入任何仓库文件**。
- **唯一引用面**：dev 的**阶段报告**内原文引用上述输出（与同批 `pr-001-reason-mapping-module-tasks.md` 的约定一致）。
- **依据**：0030 迭代的 PR 文件均**无「验收证据」段**（与 0029 的 `pr-002-session-registries.md` 不同），且本 PR 的「文件范围」只列 `oamp/src/pool-routing.js` ⇒ 证据无仓库内落点；**不得**新建证据文档、不得写入 `status.md` / `history.md`（主 agent 维护，不在本 PR 文件范围）。
- **阶段 6 verifier 的输入**：本文件（任务与判据）+ PR 文件（AC）+ 阶段报告中的原始输出。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（T1/T2/T3 的形态：工厂 + 返回面 4 方法）**：模块导出**恰一个** `createPoolRouting({roleFromInstanceId})`，其返回对象恰 4 个方法 `choose / release / bindingOf / inflightOf`。
  - 为什么需要推导：PR 验收 1 只写"导出面**覆盖**'选择 / 粘性读写 / 在飞预留增减'三类"与"`roleFromInstanceId` 由调用方注入"，**未点名函数、未定形态**（工厂 vs 模块级函数）。
  - 推导依据：① 注入要求（验收 1）+ A-06 的调用形状 `pickInstance(role, {chatId, noReuse, snapshot})` ⇒ 解析器必须藏在闭包里，调用形状才能逐字一致；② 每场景一个干净实例使 AC3/AC4/AC5 可**各自独立判定**（模块级共享状态会互相污染）；③ A-06 第 4 条称其为"叶子模块"、A9 体例允许"模块级常量 + 函数"或工厂两种既有形态（`inbox.js` 是模块级、`context-pool.js` 是类）。
- **[model_inferred] MI-P2（T1 判据的快照形状 = `{nodes, work}`）**：`snapshot.nodes` = `router.status` 的 `nodes`（A1），`snapshot.work` = `deriveAgentWork(taskRows)` 的 `Map`（A4）。
  - 为什么需要推导：A-06 与 `pickInstance` 签名都只写参数名 `snapshot`，**未定义其形状**；A-06 说负载"复用 `deriveAgentWork`"，而该函数是 `web.js` 的**未导出**内部函数（A4），且本模块被禁 import 仓内模块（验收 1）。
  - 推导依据：唯一能同时满足"复用既有函数（不复制公式）"+"叶子模块零 import"的形状 = 调用方算好 `work` 注入；若改为模块自己遍历 `taskRows`，则必须在模块内复制 `deriveAgentWork` 的公式（与 A-06"不需要新度量"冲突）⇒ 两条不可同时满足，取舍权归主 agent（见 §7 疑问 2）。
- **[model_inferred] MI-P3（T4 判据 1 的"在飞预留读"与"粘性读"入口）**：导出 `inflightOf(instanceId)` 与 `bindingOf(chatId, role)` 两个**只读**入口。
  - 为什么需要推导：PR 验收 5 要求判定"成对调用后**净值为 0**、无泄漏"，但未提供读数面；AC4 的"命中 / 重绑"亦只给了行为判据。
  - 推导依据：次序键的**前三分量相等时**，等量泄漏在"选择结果"上不可观测（两实例同时多计 1 ⇒ 次序不变）⇒ 无读数入口时"无泄漏"只能靠间接推断；AC5 的"release 真的减了计数"判别式（§4.2 第 19 条）可部分替代，但不足以证明"净值为 0"。两个入口均为只读、无副作用、无生产消费者（消费者 = 自证脚本与 pr-005 的可观测性）。**若主 agent 认为"无生产消费者的只读入口"违反仓内既有的"导出面恰好 N 个"口径**，处置面 = 删 2 个函数 + 把 AC5 的 3 条读数断言替换为行为差分（§4.2 中 `AC5 release 真的减了计数` 一条即可保留）。
- **[model_inferred] MI-P4（T1 契约 10：`chatId` 形态守卫）**：`chatId` 非"非空字符串" ⇒ 本次跳过粘性读写（不建条目、不删条目），选择照常、不抛错。
  - 为什么需要推导：A-07 只写键 = `(chat_id, role)`，未定义 `chatId` 缺失/非法时的行为。
  - 推导依据：`/api/calls` 已保证 `chat_id` 非空（`web.js:1327-1335`），生产路径不触发该分支；PR 验收 2 明文"模块自身不造错误面、不静默排队" ⇒ 兜底不得抛错，且不得把 `undefined` 拼成伪绑定键。
- **[model_inferred] MI-P5（T2 契约 9：`release` 的边界）**：对**未计数**实例 `release` ⇒ no-op（计数不出现负数）；计数减到 0 ⇒ 删除该条目。
  - 为什么需要推导：A-06 与验收 5 只写"`release` 即 `−1`"，未定义下界与清零后的条目去留。
  - 推导依据：验收 5 明文"净值为 0、**无泄漏**"⇒ 负值与零值残留条目都不满足该口径；`sendTask` 存在重试与吞错路径（A7），settle 判定在调用方 ⇒ 重复/多余 `release` 必须无害。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（§2 的 4 条边全部由小号指向大号，唯一拓扑序 `T1 < T2 < T3 < T4`）。

### 疑问 / 越界（**不改 PR 文件与本 PR 的七字段关系**，只上报）

1. **AC1"三类能力"未点名函数 ⇒ 冻结形态与"无多余入口"存在潜在张力**（对应 MI-P1 / MI-P3）：本文件冻结为"工厂 + 恰 4 方法"，其中 `inflightOf` / `bindingOf` 是**只读、无生产消费者**的入口（动机 = 让 AC5 的"净值为 0"可机械判定）。若主 agent 裁定应严格照 0029 的"导出面恰好 N 个且每个都有消费者"口径，改动面 = 2 个函数 + AC5 的 3 条读数断言（见 MI-P3 的替代判据）。
2. **`snapshot` 形状未定义 ⇒"复用 `deriveAgentWork`"与"模块零 import"两条只能二选一**（对应 MI-P2）：A-06 要求复用既有函数（不复制公式），验收 1 禁止 import 仓内模块，而 `deriveAgentWork` 未导出（A4）⇒ 本文件的取舍 = **调用方注入 `work`**（模块零 import、公式仍只此一处）。若主 agent 裁定模块应自行解析任务数组，则必须在模块内复制负载公式（与 A-06"既有函数复用"冲突），改动面 = `choose` 入参与判据 §4.2 的 `snap()` 辅助函数。
3. **观察（非本 PR 阻塞，属架构/端到端验收面）——"同角色多实例"缺实例 id 派生路径**：
   - 事实：`instanceIdForRole(role)` 恒为 `'pb-' + role` 且是唯一公式（A8）⋅ `roleFromInstanceId` 只认 `'pb-<role>'` 且 `roles/<role>/<role>.md` 必须存在（A8）⋅ `cluster-config.js` 的 `roles.<role>` 无 instance 覆盖字段、`instance_id` 恒由该公式产生（A12）⋅ `cluster.json` 每角色一条 ⋅ Router 侧同 `instance_id` 再注册是 **latest-wins 顶替**（`router.js:118-131`）。
   - 结论：按 A-06 的池成员口径，**当前生产配置下"同一角色的在线池"上限 = 1**；F06 验收 1（同角色两实例并发分流）在端到端面**没有可构造的两实例**。prd/F06 只写"手动启动同一角色的两个在线实例"，未定义手段；本迭代 9 个 PR 中**无一个**声明覆盖"实例 id 派生 / 多实例启动"（已核 `prs/*.md` 的文件范围与 `depends_on`）。
   - 对 PR-002 的影响：**无**（本 PR 的 5 条 AC 全部是模块级，可用注入解析器构造，见 §4.2 的 `STUB`）；对下游的影响：pr-005 的"池化分流与粘性"端到端验收与阶段 6 取证需要该路径。
   - **上报主 agent 裁定**：(a) 按"池化只对既有可解析实例集合生效，多实例由使用者自行提供"接受该端到端验收在生产态不可构造；或 (b) 需要一条额外的实例 id 派生机制（属架构改动，超出 PR-002 文件范围，本 PR 不实现、不预留挂点）。
4. **粒度决策记录（本 PR 未写 `roles/planner/data/`——该目录不在本 PR 文件范围，故记录于此）**：把单一新文件按**算法断面**切成 T1（池成员/空池）、T2（次序键 + 在飞计数）、T3（粘性）三片，理由是三者各有互不重叠的 AC 归属（AC2 / AC3+AC5 / AC4）与互不相同的判据构造（过滤快照 / 负载快照 + 计数读数 / 粘性快照）；合并成一个"写 `choose`"任务会使失败面无法定位（T3 判据 1"粘性优先于最空闲"尤其需要 T2 已成立的次序键）。T4 单独成任务的依据 = PR 文件把"自证"列为交付物原文，且其判据（导出面 / 零面 / 未接线 / diff 封闭性）**不是 T1~T3 判据的重跑**（其中"未接线"与"改动面封闭性"三项在 T1~T3 中均不包含）。
5. **未发现 architecture 内部矛盾**：§3.4 第 1~3 条与 §4 A-06 / A-07 在选择口径、粘性键、失效口径、空池口径上逐条同值（次序键 `(queued, busy, inflight, instance_id)`、键 `(chat_id, role)`、无 TTL、"绑定失效 ⇒ 重选重绑不报错"、"空池 ⇒ `null` ⇒ 回落 `instanceIdForRole`"），无需选边。
6. **上游信息充分性**：5 条 AC 均能在 `architecture.md`（§3.4 / §4 A-06·A-07 / §5 / §8）与 `prd/{F06,F07}` 找到可追溯依据；需要推导的 5 项口径已列 §6 等主 agent 确认；除第 3 条观察外无信息缺口。
7. **PR 文件七字段零改动**：本任务列表未修改 `prs/pr-002-pool-routing-module.md` 的任何字段；本文件亦未写入 `architecture.md` / `prd/**` / `status.md` / `history.md` / `deferred-demand-changes.md`（第 3 条观察仅在本文件上报，未搭置到 `deferred-demand-changes.md`——该文件的追加在本迭代归属 pr-007）。
 
---

## 执行证据（dev 回填）

追加实现：按主 agent 2026-09-17 契约追加 `roleOfPoolInstance(instanceId, baseResolve)` 具名导出；工厂内部成员解析复用该函数。以下为 PR worktree 内一次性脚本原始 stdout；`node` 退出码为 `0`。

### `/tmp/0030-pr-002/verify.out`

```text
PASS AC1 模块导出面含 createPoolRouting 与 roleOfPoolInstance
PASS AC1 工厂返回面恰 4 方法（选择 / 粘性读 / 在飞读 / 在飞减）
PASS AC2 offline / connected===false / 异角色 均不入池 ⇒ 选中 pb-dev
PASS AC2 空池 ⇒ null
PASS AC2 全被过滤 ⇒ null
PASS AC2 快照缺失 ⇒ null 且不抛
PASS AC2 空池不留粘性、不留在飞
PASS AC2 非池成员不被选中（此处池 = {pb-dev-2}）
PASS AC3 queued 小者胜
PASS AC3 queued 优先于 busy
PASS AC3 queued 相同时 busy=false 优先
PASS AC3 全并列 ⇒ instance_id 升序（与快照内顺序无关）
PASS AC3 同输入同输出（两个干净实例）
PASS AC5 两条并发、快照相同 ⇒ 分落不同实例
PASS AC5 选中即 +1
PASS AC5 release 即 −1
PASS AC5 成对调用后净值为 0（无泄漏）
PASS AC5 未计数实例 release ⇒ no-op、不出现负数
PASS AC5 release 真的减了计数（释放后回到最空闲 pb-dev）
PASS AC4 首次选择建立绑定
PASS AC4 二次选择命中既有绑定（不按负载重选）
PASS AC4 异 chat ⇒ 按最空闲
PASS AC4 键含 role：同 chat 异角色互不干扰
PASS AC4 noReuse ⇒ 忽略绑定、按最空闲重选并重绑
PASS AC4 重绑生效：下一次无声明即粘新实例
PASS AC4 绑定实例不在池 ⇒ 重选重绑、不抛错
PASS AC4 绑定实例离线 ⇒ 重绑到池内实例
PASS AC4 池为空 ⇒ 绑定被丢弃、返回 null
PASS AC2 真实解析器：pb-dev 与 pb-dev-2 均归入 dev 池，tie-break 选 pb-dev
PASS AC2 单实例：二次选择同目标
PASS AC2 真实解析器下池为空 ⇒ null
RESULT: PASS
退出码: 0
```

### `/tmp/0030-pr-002/resolver-boundary.out`（追加契约边界 5 条）

```text
PASS resolver exact pb-dev ⇒ dev
PASS resolver suffix pb-dev-2 ⇒ dev
PASS resolver suffix pb-dev-1 and exact pb-dev preserve distinct identities
PASS resolver invalid suffix pb-dev-0 / pb-dev-x / pb-dev- ⇒ null
PASS resolver non-string input ⇒ null without throw
RESULT: PASS
退出码: 0
```
