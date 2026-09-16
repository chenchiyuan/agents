# pr-007-tasks.md — pr-007 内部任务列表（hub 入口表与 skill 清单：层 A 21→29 / 层 B 8→9 + F19 文档修复）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-007-hub-entries-and-skill-lists.md`
**PR worktree**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-007-hub-entries-and-skill-lists` ｜ **base = `22f6859`**（迭代分支 tip：**pr-001 / pr-002 / pr-003 / pr-004 / pr-005 / pr-008 / pr-006 均已合并**，A1）
**任务总数**: **12**（T0~T11）｜ **依赖图**: **无环**（见 §2）｜ **性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（13 条验收标准）+ `architecture.md`（§3.10 入口表追加链、§4 A-14「既有 SDK / CLI 面是否同步暴露：是」、§5.1 新路由表、§5.3「层 B 清单 8→9 的连带同步」、§6.1 Z-8、§7 L1-02（已确认）/ L2-12、§9.2 N-14、§1.3 事实 F-7 / F-8）+ `prd/{F13,F17,F19,G01}*.md` + `status.md`（§本迭代体感目标 D-13 / §更新日志）+ `deferred-demand-changes.md` DC-03 + 代码库实读（§0.3 逐条带 `文件:行号`；**依赖 PR 已合并 ⇒ 直接读其真实实现**，不按设计稿猜）

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/sdk/surface.js` | 改（**只追加**：`API_ENTRIES` +8、`UDS_CALLS` +1、`UDS_ENTRIES` +1；注释计数行同步） | T1 / T2 |
| 2 | `oamp/skill/hub.md` | 改（层 A 清单 21 → 29、层 B 清单 8 → 9；「序列 1」重写；F19 等待原语说明） | T3 / T4 / T5 |
| 3 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-007-hub-entries-and-skill-lists.md` | 改（**仅「验收证据」段 + 验收标准复选框**，七字段不动） | T11 |
| 4 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-007-hub-entries-and-skill-lists-tasks.md` | 本文件（本阶段产物，随 PR 分支提交） | — |

### 0.2 非目标（零改动清单 / 防夹带）

- **不触碰**（PR 文件「不触碰」逐条）：`oamp/sdk/cli.js`（表驱动分派的既有实现：按 `ENTRIES` 查表 ⇒ 新增条目**自动**进 CLI 面，零改动即生效）、`oamp/sdk/doctor.js`（R3 探针集**不扩**，N-14）、`oamp/sdk/http.js`、`oamp/sdk/uds.js`（pr-001 已追加 `taskCancel`，本 PR 只消费）、`oamp/API.md` / `oamp/llms.txt`（归 pr-006，已合并）、`oamp/src/**`（归 pr-001 / pr-003 / pr-005）。
- **不新增**：测试文件（本仓 0 个 `.test.js`）、第三方依赖、env 键、配置键、DB 表/列、路由、事件名、CLI / API 能力（F19 验收 3：本 PR **只改表述不改能力**）。
- **不做**：不改既有 40 条的 `id` / `cmd` / `args` / `flags` / `kind` / `method` / `path` / `acceptsAs`（逐字不变，G01 验收 4）；不改 `doctor` 的 R1/R2/R3 机制；不重写 `skill/hub.md` 的层 C 清单、`doctor` 段落与四条红线（AC9）；不改 `README.md`。

### 0.3 实读事实锚点（2026-09-17 实读，base `22f6859`；判据基础）

| # | 事实 | 位置 / 取证命令 |
|---|---|---|
| **A1** | **依赖已就绪**：base 含 pr-001 / pr-005 / pr-006 的合并提交（`git log --oneline -3` 首行 = `22f6859 merge: pr-006 …`） | `git -C <WS> log --oneline -3` |
| **A2** | **`API.md` §3 = 29 行**（R1 的文档侧输入，pr-006 写入面已落盘） | `grep -cE '^\| [0-9]+ \| `(GET\|POST) /api/' oamp/API.md` → **29** |
| **A3** | **现有入口表 = 40 条**（层 A 21 / 层 B 8 / 层 C 11；`surface.js:4` 头注、`:39`/`:223`/`:297` 层注释、`:360` 表注逐处写明计数） | `grep -n '层 A：21 条\|层 B：8 条\|层 C：11 条\|恰 40 条' oamp/sdk/surface.js` |
| **A4** | **层 A 追加的机械来源 = 8 条新路由的登记元数据**（`params[].in` ∈ path/query/body、`params[].required`、`method`、`path`）：`POST /api/principals`（body：principal_id 必填 / kind / instance_id）、`GET /api/principals/:principal_id`（path：principal_id 必填）、`GET /api/subscribe`（query：principal 必填 / epoch / kinds / agents；`kind:'sse'`）、`GET /api/pickup`（query：principal 必填 / epoch）、`POST /api/pickup/:call_id/ack`（path：call_id 必填；query：principal 必填 / epoch）、`GET /api/calls/wait`（query：ids 必填 / timeout_ms(number)）、`POST /api/calls/:call_id/cancel`（path：call_id 必填；无字段）、`GET /api/health`（无参） | `sed -n '685,760p;1048,1075p;1610,1660p;1735,1800p' oamp/src/web.js` |
| **A5** | **既有入口体例（逐字照抄面）**：`cmd` = `<资源> <动作>`（`calls list` / `confirmations decide` / `stream events`）；路径参数 → 位置参数（`arg('chat_id')`）；query / body 字段 → `--<字段名>`（字段名 `_` → `-`：`project-id` ↔ `project_id`、`output-schema` ↔ `output_schema`）；数组字段用 `arr()`（逗号分隔）、整数用 `int()`、JSON 用 `json()` | `sed -n '120,220p' oamp/sdk/surface.js` |
| **A6** | **层 B 追加的机械来源**：`UDS_CALLS` 每条 = 一个 JSON-RPC 方法 ↔ 一个 `sdk/uds.js` 会话方法（`'router.task_get': (session, params) => session.taskGet(params.task_id)`）；pr-001 已在 `sdk/uds.js` 追加 `taskCancel(taskId)`（`uds.js:171-174`）、Router 侧 `router.task_cancel` 分支 `src/router.js:394-414`（缺参 ⇒ `INVALID_PARAMS`；不存在 ⇒ `TASK_NOT_FOUND`；已终态 ⇒ `TASK_ALREADY_FINAL`）；`UDS_ENTRIES` 每条 `acceptsAs` 显式声明（`router.*` 三条均 `false`） | `grep -n 'taskCancel' oamp/sdk/uds.js`；`sed -n '286,296p' oamp/sdk/surface.js`；`sed -n '390,415p' oamp/src/router.js` |
| **A7** | **`cli.js` 是表驱动**：`matchEntry(layer, rest)` 做 `cmd` 前缀最长匹配、`parseTail` 按条目 `args` / `flags` 做本地校验（`surface.js` 追加条目 ⇒ CLI 面自动生效、`hub --help` 自动列出、库面命名空间自动装配） | `sed -n '70,110p' oamp/sdk/cli.js`；`sed -n '243,270p' oamp/sdk/cli.js` |
| **A8** | **doctor R1 / R3 机制（不改，只作为判据）**：R1 = `API.md` 表行 ↔ `GET /api/docs` 的 `routes[]` 双向比对（`doctor.js:34-72`）；R3 探针集 = 固定 8 个 Router 方法（`doctor.js:121-132`，**N-14：不扩**）；R2 对非流式 GET 自动探测、POST 记 `skipped`（`doctor.js:94-118`） | `sed -n '34,72p;94,132p' oamp/sdk/doctor.js` |
| **A9** | **F19 的两条现成原语（事实 F-7 / F-8 实测已存在）**：① `api calls create --mode block`（`surface.js:185` `int('wait')` 是唯一接受 `--wait` 的条目；`cli.js:19` `DEFAULT_WAIT_MS = 1800000`）；② `cli task watch <task_id>`（`surface.js:339-341` 的层 C 条目；实现 `src/task.js:204` `cmdWatch`，终态即打印 `任务终态: …` 并返回） | `grep -n \"'--mode'\\|int('wait')\" oamp/sdk/surface.js`；`grep -n 'task watch' oamp/sdk/surface.js`；`sed -n '204,260p' oamp/src/task.js` |
| **A10** | **等待语义条文的唯一真源 = `API.md` §2.4**（pr-006 已落盘：退出条件必须是终态 / 超时只表示放弃等待 / 禁止把"轮询 + 超时"当作等待的实现 / 客户端等待预算是放弃等待的预算）⇒ `hub.md` **只指向不复写**（F19 验收 3） | `grep -n '^### 2\\.4 等待语义' oamp/API.md` |
| **A11** | **隔离集群起停面**（真集群取证；**绝不触碰主工作区 / 主集群进程**）：`node oamp/bin/oamp.js router start` / `agent start <instance-id>`（实例名须可反解为存在的角色，如 `dev-1` ⇒ 角色 `dev`，`roles/dev` 在树内）/ `web start --port <n>`；env 旋钮 = `OAMP_SOCKET`（**必须短路径**：macOS `sun_path` 上限 104 B，而本 worktree 绝对路径已 151 B ⇒ 用相对短路径，配合固定 cwd）/ `OAMP_DB` / `OAMP_WEB_PORT`；`!sleep N` 任务文本走 shell 执行器、**不触发模型调用**（`web.js:1200` 的 `!` 分支） | `grep -n \"startsWith('!')\" oamp/src/web.js`；`sed -n '138,160p' oamp/src/config.js` |
| **A12** | **既有 `runApi` 的字段通道**：位置参数不在路径中 ⇒ 进 `query`；`flags` ⇒ `GET` 进 `query`、非 `GET` 进 `body`；而 `query` 只在 `spec.method === 'GET'` 时随请求发出（`surface.js:78-88`） | `sed -n '60,100p' oamp/sdk/surface.js` |

### 0.4 本 PR 内冻结契约（跨任务一致面，逐条带追溯）

1. **层 A 追加 8 条的逐条形态**〔AC2；A4 / A5〕：`cmd` / `method` / `path` / `args` / `flags` / `kind` 六面**逐条由登记元数据机械推导**，顺序 = `API.md` §3 表格行序（22~29）：

| # | `cmd` | `method` | `path` | `args`（路径参数） | `flags`（`_` → `-`） | `kind` |
|---|---|---|---|---|---|---|
| 22 | `['subscribe']` | GET | `/api/subscribe` | — | `principal`（必填）/ `epoch` / `kinds` / `agents` | `stream` |
| 23 | `['pickup', 'list']` | GET | `/api/pickup` | — | `principal`（必填）/ `epoch` | `result` |
| 24 | `['pickup', 'ack']` | POST | `/api/pickup/:call_id/ack` | `call_id` | `principal`（必填）/ `epoch` | `result` |
| 25 | `['calls', 'wait']` | GET | `/api/calls/wait` | — | `ids`（必填）/ `timeout-ms`（`int`） | `result` |
| 26 | `['calls', 'cancel']` | POST | `/api/calls/:call_id/cancel` | `call_id` | — | `result` |
| 27 | `['health']` | GET | `/api/health` | — | — | `result` |
| 28 | `['principals', 'create']` | POST | `/api/principals` | — | `principal-id`（必填）/ `kind` / `instance-id` | `result` |
| 29 | `['principals', 'get']` | GET | `/api/principals/:principal_id` | `principal_id` | — | `result` |

   - 动作词取既有体例的机械映射：GET 集合 → `list`、GET 单体 → `get`、POST 新建 → `create`、POST 路径动作 → 该路由末尾动作段（`ack` / `cancel` / `wait`）；无路径段且无同级资源的单条面沿用既有单 token 形态（`health` 同 `docs` / `agents`；`subscribe` 同 `docs`）。
   - `flags` 顺序 = 登记 `params` 数组序（登记是唯一真源；不强求与 `API.md` 表格列序一致）。
2. **层 B 追加 1 条的逐条形态**〔AC3；A6〕：`UDS_CALLS['router.task_cancel'] = (session, params) => session.taskCancel(params.task_id)`（与既有 `router.task_get` 同体例）；`UDS_ENTRIES` 追加 `udsEntry({ method: 'router.task_cancel', acceptsAs: false })`（与 `router.status` / `router.task_get` / `router.task_list` 同列），`id = 'uds.router.task_cancel'`。
3. **计数行同步面**〔AC1；A3〕：`surface.js` 内共 **5 处**计数文本随之更新 —— `:4` 头注（`40 条` → `49 条`；`层 A 21 / 层 B 8 / 层 C 11` → `层 A 29 / 层 B 9 / 层 C 11`）、`:39` 层 A 注释（`21 条` → `29 条`；`API.md` §3 的 `21 行` → `29 行`）、`:223` 层 B 注释（`8 条` → `9 条`；`8 个方法` → `9 个方法`）、`:360` 表注（`恰 40 条` → `恰 49 条`）、`apiEntry` 工厂注释（`21 条` → `29 条`）。**其余一律不动。**
4. **表 ↔ 清单互锁**〔AC8；§5.3〕：`ENTRIES` 的层 A `cmd` 序列与 `skill/hub.md` 层 A 清单**逐条同名**（29 行）、层 B 逐条同名（9 行）；两侧计数（29 / 9）与清单条目数一致。
5. **F19 文档面（只改表述不改能力）**〔AC10~AC12；F19 验收 1~3；A9 / A10〕：
   - 「序列 1」标题与正文改为 **派发 → 等待 → 取件** 三步；等待步的主推 = **两条现成原语**（`--mode block` 与 `cli task watch`），各自写明**适用场景**（何时用哪条）；
   - `calls get` + sleep 型轮询**降为兜底**并**明确写出「轮询是兜底」**；
   - 等待语义条文**只指向** `oamp/API.md` §2.4（不复写条文、不复制参数表）。
6. **零新增能力**〔AC12 / AC13〕：本 PR 不新增 CLI / API 能力、不新增依赖；`hub.md` 的层 C 清单 11 条、`doctor` 段落、四条红线（不裸写 HTTP / 不复制 schema / 退出码语义 / 边界只到子命令名）**逐字未改**。
7. **真集群取证形态**〔AC4 / AC5；A11〕：全部取证在**自建隔离集群**（相对短 socket 路径 + 非默认端口 + 独占 DB）上完成；命令一律自带 `cd <WS>` 前缀，**不引用 `/tmp`**、**不含占位符**。

---

## 0.5 PR 验收标准 → 任务映射（13 条 AC 全覆盖，无孤儿任务）

| # | PR 文件 AC 原文（摘要） | 服务任务 |
|---|---|---|
| 1 | `ENTRIES` 恰 49 条（29 / 9 / 11）；既有 40 条八字段逐字不变 | **T1** + **T2**（追加）+ **T6**（逐字比对） |
| 2 | 层 A 8 条与 pr-005 的 8 条新路由 1:1（`cmd` / `method` / `path` / `args` / `flags` 机械推导） | **T1** + **T6** |
| 3 | 层 B 1 条 `router.task_cancel` 经 `UDS_CALLS` → `uds.taskCancel`（`acceptsAs:false`） | **T2** |
| 4 | 逐条真集群可执行、按既有退出码语义返回（存储 40 + 新增 9） | **T7** |
| 5 | `hub uds router.task_cancel`：working ⇒ `failed` + `error:'cancelled'`；已终态 ⇒ `TASK_ALREADY_FINAL` + 退出码 1 | **T8** |
| 6 | `hub doctor` 三段仍全 `pass`，R3 探针集未扩 | **T9** |
| 7 | `hub doctor` R1 仍 `pass`：层 A 条数 ↔ `API.md` §3 行数（29） | **T9** |
| 8 | `skill/hub.md` 层 A 29 / 层 B 9，与 `ENTRIES` 逐条同名同数 | **T3** + **T4** + **T6** |
| 9 | `hub.md` 层 C 清单 11 条与 `doctor` 段落未改；四条红线语义未改 | **T5**（只改序列 1）+ **T10**（diff 核查） |
| 10 | F19 验收 1：同时出现 `--mode block` 与 `cli task watch`，且各自说明适用场景 | **T5** |
| 11 | F19 验收 2：「序列 1」主推现成原语，轮询降兜底（写出"轮询是兜底"） | **T5** |
| 12 | F19 验收 3：不新增 CLI / API 能力；等待语义只指向 `API.md`、不复写 | **T5** + **T10** |
| 13 | 零新增依赖；`cli.js` / `doctor.js` 未被修改 | **T10** |
| — | 全部 AC 的证据载体（PR 文件「验收证据」段 + 复选框勾选） | **T11** |

> **无孤儿任务**：**T0** 是全部任务的判据基础（A1~A12 的原始输出），**T11** 是全部 AC 的证据载体，其余每个任务在上表中至少出现一次。

---

## 1. 任务列表

### T0: 事实基线与「AC → 判据」冻结（读码取证，零写入）

- **服务哪条 AC**: 全部 AC 的判据基础（A1~A12 的原始输出）
- **描述**: 在任何写入之前，把判据基础固化为可复制的原样输出：① base commit 与工作区状态；② 现有 `ENTRIES` 的 40 条清单与三层计数；③ `API.md` §3 的 29 行；④ 8 条新路由的登记元数据（`params` / `errors` / `kind`）；⑤ `uds.taskCancel` 与 Router 侧 `router.task_cancel` 分支；⑥ doctor R1/R3 机制源码片段；⑦ F19 两条原语的实现锚点；⑧ `runApi` 的字段通道（A12）。
- **文件·锚点**: 零源码改动（只读 `oamp/sdk/surface.js`、`oamp/sdk/uds.js`、`oamp/sdk/doctor.js`、`oamp/src/web.js`、`oamp/src/router.js`、`oamp/API.md`、`oamp/skill/hub.md`）。
- **步骤**: ① `git -C <WS> log --oneline -3` + `git -C <WS> status --short`；② `node --input-type=module -e "import {ENTRIES} from './oamp/sdk/surface.js'; …"` 打印总数与分层计数 + 40 条 `id`；③ `grep -cE '^\| [0-9]+ \| \`(GET|POST) /api/' oamp/API.md`；④ `grep -n "path: '/api/\(principals\|subscribe\|pickup\|calls/wait\|calls/:call_id/cancel\|health\)" oamp/src/web.js`；⑤ `grep -n 'task_cancel\|TASK_ALREADY_FINAL' oamp/src/router.js`；⑥ `sed -n '34,72p;121,132p' oamp/sdk/doctor.js`；⑦ `grep -n "int('wait')\|task watch" oamp/sdk/surface.js`；⑧ `sed -n '60,100p' oamp/sdk/surface.js`。
- **验收判据（可执行）**:
  1. ②输出 ⇒ `ENTRIES 总数 40`、层 A `21` / 层 B `8` / 层 C `11`。
  2. ③输出 ⇒ `29`（与 A2 一致；R1 的文档侧基数）。
  3. ④输出含 8 条新路由的 `path:` 行（逐条可 `grep -n` 到）。
  4. ⑤输出含 `case 'router.task_cancel':` 与 `TASK_ALREADY_FINAL`。
  5. 全部输出为**原始 stdout**（未加工、未裁剪）。
- **前置依赖**: 无（**必须在任何写入前执行**）
- **优先级**: P0

---

### T1: `surface.js` 层 A 追加 8 条 + 5 处计数行同步

- **服务哪条 AC**: AC1（49 条 / 29 层 A）+ AC2（8 条 1:1 机械推导）
- **描述**: 按冻结契约 1 的表，在 `API_ENTRIES` 末尾（`confirmations decide` 之后、数组收尾 `];` 之前）**追加** 8 条 `apiEntry({…})`；按冻结契约 3 更新 5 处计数文本。
- **文件·锚点**: `oamp/sdk/surface.js:120-221`（`API_ENTRIES`，插入点 = `:213-220` 的 `confirmations decide` 条目之后）、`:4` / `:39` / `:223` / `:360` 与 `apiEntry` 工厂注释（计数行）。
- **步骤**: ① 逐条写 `apiEntry`（`cmd` / `method` / `path` / `args` / `flags` / `kind`，`kind` 缺省 `result` ⇒ 只有 `subscribe` 显式写 `kind: 'stream'`）；② 复用既有 `arg` / `str` / `int` 工厂，**不新增工厂、不加新键**；③ 5 处计数文本改为 `49` / `29` / `9`；④ `node --check oamp/sdk/surface.js` 语法自检。
- **验收判据（可执行）**:
  1. **总数与分层**：`node --input-type=module -e "…import {ENTRIES} from './oamp/sdk/surface.js'…"` ⇒ 总数 **49**、层 A **29**、层 B **9**、层 C **11**。
  2. **8 条逐条在场**：打印新增 8 条的 `{id, cmd, method, path, args, flags, kind}`，与冻结契约 1 的表**逐字相同**（脚本比对，8/8）。
  3. **既有 40 条逐字不变**：与 T0-② 捕获的基线逐条比对（`id` / `cmd` / `args` / `flags` / `kind` / `method` / `path` / `acceptsAs`）⇒ 差异集合为空。
  4. **语法**：`node --check oamp/sdk/surface.js` 退出码 0。
- **前置依赖**: T0
- **优先级**: P0

---

### T2: `surface.js` 层 B 追加 1 条（`router.task_cancel`）

- **服务哪条 AC**: AC1（49 条 / 9 层 B）+ AC3
- **描述**: `UDS_CALLS` 追加 `'router.task_cancel': (session, params) => session.taskCancel(params.task_id)`（与 `router.task_get` 同体例）；`UDS_ENTRIES` 追加 `udsEntry({ method: 'router.task_cancel', acceptsAs: false })`。
- **文件·锚点**: `oamp/sdk/surface.js:230-239`（`UDS_CALLS`）、`:286-295`（`UDS_ENTRIES`）；被消费的会话方法 = `oamp/sdk/uds.js:171-174` `taskCancel`（pr-001 已落盘）。
- **步骤**: ① 追加两条；② 复核 `UDS_ENTRIES` 的顺序 = 既有 8 条之后追加（表序 = 层 B 表序）；③ 语法自检。
- **验收判据（可执行）**:
  1. `node --input-type=module -e "…"` 打印层 B 的 9 条 `{id, method, acceptsAs}` ⇒ 第 9 条 = `{id:'uds.router.task_cancel', method:'router.task_cancel', acceptsAs:false}`，且与 `router.status` / `router.task_get` / `router.task_list` 同列（`acceptsAs === false`）。
  2. `git -C <WS> diff -U0 -- oamp/sdk/surface.js` 中 `UDS_CALLS` 与 `UDS_ENTRIES` 区段**只有 `+` 行**（无 `-` 行）。
  3. 语法：`node --check oamp/sdk/surface.js` 退出码 0。
- **前置依赖**: T0
- **优先级**: P0

---

### T3: `skill/hub.md` 层 A 清单 21 → 29

- **服务哪条 AC**: AC8（层 A 清单 29 条 + 与 `ENTRIES` 逐条同名同数）
- **描述**: 把「### 层 A · api（21 条）」改为「（29 条）」，并在既有 21 条之后**追加 8 条**子命令名（`- ` + `api <cmd…>`），顺序 = `ENTRIES` 的层 A 顺序（= `API.md` §3 行序）。
- **文件·锚点**: `oamp/skill/hub.md:37-61`（层 A 标题 + 21 条清单）。
- **步骤**: ① 改标题计数；② 追加 8 行清单（只到子命令名，**不写选项与字段** —— 红线 2「不复制 schema」）；③ 与 `ENTRIES` 逐条比对。
- **验收判据（可执行）**:
  1. **计数**：`grep -n '### 层 A · api' oamp/skill/hub.md` ⇒ `（29 条）`；清单行数 `grep -c '^- \`api ' oamp/skill/hub.md` ⇒ **29**。
  2. **逐条同名**（脚本）：从 `hub.md` 抽层 A 清单的 `api …` 名 → 与 `ENTRIES` 层 A 的 `cmd.join(' ')` 序列**逐字相等且同序**（差异集合为空）。
  3. 清单内**不出现**选型名（`--principal` / `--ids` / `epoch` 等）：`grep -cE '^- \`api .*--' oamp/skill/hub.md` ⇒ **0**。
- **前置依赖**: T1
- **优先级**: P0

---

### T4: `skill/hub.md` 层 B 清单 8 → 9

- **服务哪条 AC**: AC8（层 B 清单 9 条）
- **描述**: 「### 层 B · uds（8 条）」→「（9 条）」+ 追加 `- \`uds router.task_cancel\``（顺序 = `UDS_ENTRIES` 第 9 条）。
- **文件/锚点**: `oamp/skill/hub.md:63-74`。
- **步骤**: ① 改计数；② 追加一行；③ 与 `ENTRIES` 层 B 比对。
- **验收判据（可执行）**:
  1. `grep -n '### 层 B · uds' oamp/skill/hub.md` ⇒ `（9 条）`；`grep -c '^- \`uds ' oamp/skill/hub.md` ⇒ **9**。
  2. 逐条同名同序（脚本，同 T3-②）且含 `uds router.task_cancel`。
  3. `git -C <WS> diff -U0 -- oamp/skill/hub.md` 在本段**只有 `+` 行**（除计数行）。
- **前置依赖**: T2
- **优先级**: P0

---

### T5: `skill/hub.md`「序列 1」重写（F19 三条验收）

- **服务哪条 AC**: AC10（F19 验收 1）+ AC11（F19 验收 2）+ AC12（F19 验收 3）+ AC9（其余段落零改动）
- **描述**: 把 `### 序列 1：派发 → 取终态` 重写为 **派发 → 等待 → 取件**：① 派发步保持 `api calls create`；② 等待步列出**两条现成原语**并各写适用场景 —— `api calls create --mode block`（**本次就等到底**：派发与等待合成一步，最省事）与 `cli task watch <task_id>`（**已派发后补看/盯进度**：要先拿到 `task_id`、或派发时没选阻塞形态）；③ 取件步 = `api pickup list` / `api pickup ack`（离线也不丢结论）；④ 兜底段写明 **「轮询是兜底」**（`calls get` + sleep 仅在上述原语都不可用时用）；⑤ 等待语义条文**只指向** `oamp/API.md` §2.4（写链接/小节名，不复写条文）。
- **文件·锚点**: `oamp/skill/hub.md:96-100`（序列 1 段落）；被指向的真源 = `oamp/API.md` §2.4（`### 2.4 等待语义`，A10）；两条原语的实现锚点 = `surface.js:185`（`int('wait')`）、`:339-341`（层 C `task watch`）、`src/task.js:204`（`cmdWatch`）。
- **步骤**: ① 重写该段（保持既有体例：有序步骤 + 行内命令模板）；② 两条原语各一段"何时用哪条"；③ 兜底句含「兜底」字样；④ 不触碰层 C 清单 / `doctor` 段落 / 四条红线；⑤ 不写选项与字段（红线 2）。
- **验收判据（可执行）**:
  1. **F19 验收 1**：`grep -n -- '--mode block' oamp/skill/hub.md` 与 `grep -n 'cli task watch' oamp/skill/hub.md` **各有命中**（≥1），且两处附近各有一句适用场景说明（人工判据 + 脚本抽查关键词 `适用` / `何时`）。
  2. **F19 验收 2**：`grep -n '轮询' oamp/skill/hub.md` 命中且同段含「兜底」字样；派发 → 等待 → 取件三步以有序列表出现（`sed` 出该段原文）。
  3. **F19 验收 3**：该段**只指向** `API.md`（`grep -n 'API.md' oamp/skill/hub.md` 命中 §2.4 等待语义），**不复写**四条语义（不出现 `timed_out` / `退出条件` 等条文正文的复制）。
  4. **其余零改动**：`git -C <WS> diff -U0 -- oamp/skill/hub.md` 的 `-` 行**只落在**层 A / 层 B 计数行与序列 1 段（层 C 清单 11 行、`doctor` 段落、四条红线区段零 `-` 行）。
- **前置依赖**: T3、T4（同一文件的顺序编辑；锁面在 T6 一并核查）
- **优先级**: P0

---

### T6: 表 ↔ 清单互锁与既有 40 条逐字不变（机械核查，零写入）

- **服务哪条 AC**: AC1（既有 40 条八字段逐字不变）+ AC2（8 条 1:1）+ AC8（清单互锁）
- **描述**: 用一次性脚本（**不入库**）做三件事：① `ENTRIES` 的 49 条与 base `22f6859` 的 40 条逐条比对八字段（取 base 版本 = `git show 22f6859:oamp/sdk/surface.js` 落到工作区外的临时文件后 `import()`，或按 `git diff` 判定）；② 新 8 条与登记元数据的 `method` / `path` 1:1（与 `createApiRoutes` 的 29 条路由集合比对）；③ `ENTRIES` 的层 A / 层 B `cmd` 与 `hub.md` 两份清单逐条同名同序。
- **文件·锚点**: 零写入（`node --input-type=module` 脚本）。
- **步骤**: ① 导出 base 版 `surface.js` 到工作区外临时文件（或直接读 `git show` 文本解析）；② 比对八字段差异集合；③ 与 `oamp/src/web.js` 的 `createApiRoutes` 投影比对（新 8 条的 `method` + `path` 必须逐条命中路由集合）；④ 抽 `hub.md` 两份清单与 `ENTRIES` 比对；⑤ 打印四组结论与差异内容。
- **验收判据（可执行）**:
  1. **既有 40 条差异 = ∅**：脚本输出 `旧 40 条 × 8 字段 → 差异 0`。
  2. **新 8 条 1:1**：`method + path` 命中 `createApiRoutes` 的 8 条新路由（8/8，无多出、无缺失）。
  3. **互锁**：层 A `29 = 29`、层 B `9 = 9`，两侧序列逐字相等。
  4. 脚本正文与原样输出都进 T11 的证据段（可重建）。
- **前置依赖**: T1、T2、T3、T4
- **优先级**: P0

---

### T7: 逐条真集群可执行（新增 9 条 + 存量抽查；退出码语义）

- **服务哪条 AC**: AC4
- **描述**: 在自建隔离集群（A11）上，逐条执行新增的 9 条入口（8 层 A + 1 层 B），并抽查存量条目代表性样本，记录**退出码**与输出：
  - `api subscribe`（`kind:'stream'` ⇒ 用 `timeout`/`head` 截断，退出码语义按 §5.4 `0` 类）；
  - `api pickup list --principal …` / `api pickup ack <call_id> --principal …`；
  - `api calls wait --ids …` / `api calls cancel <call_id>`；
  - `api health`；`api principals create --principal-id …` / `api principals get <principal_id>`；
  - `uds router.task_cancel`（详判据归 T8，此处只记"入口名被顶层解析"）。
- **文件·锚点**: 零源码改动；隔离集群三步起停（A11）；层 A 端口 = 隔离 web 的非默认端口（`--port` 或 `OAMP_WEB_PORT`）。
- **步骤**: ① 起隔离 router（相对短 socket）+ agent（`dev-1`）+ web（非默认端口）；② 逐条跑入口并记 `echo "exit=$?"`；③ 造前置数据（`principals create` 一次、`calls wait` 用一个不存在的 id 证明 `unresolved` 语义）；④ 收尾停三个进程（只停自建集群名）。
- **验收判据（可执行）**:
  1. **9 条逐条**：每条入口都有一行"命令 + 原样 stdout/stderr + `exit=<n>`"，且 `exit` ∈ {0,1,2,3}（既有退出码语义）。
  2. **成功路径抽样**：`api health` ⇒ `200` 体 + `exit=0`；`api principals create` / `api principals get` ⇒ `exit=0`；`api pickup list` ⇒ `exit=0`；`api calls wait` ⇒ `exit=0`；`api calls cancel`（对不存在 id）⇒ `exit=1`（业务失败，`404 NOT_FOUND`）。
  3. **流式条目**：`api subscribe` 在被截断时 `exit=0`（§5.4 `0` 类：下游关闭管道属预期用法）。
  4. **存量抽查**：`api docs` / `api calls list` / `uds router.status` / `cli status` 各一条 ⇒ `exit=0`（证明既有 40 条仍在同一分派面上）。
- **前置依赖**: T1、T2（代码就位）
- **优先级**: P0

---

### T8: `hub uds router.task_cancel` 两条判据（F13 验收 3/5 的入口侧）

- **服务哪条 AC**: AC5
- **描述**: 在同一隔离集群里：① 造一个 **working** 任务（`POST /api/calls` 带 `task:"!sleep 30"`、`mode:"background"`，A11 的 `!` 分支**不触发模型调用**）；② `hub uds router.task_cancel --params '{"task_id":"<该 id>"}'` ⇒ `{task:{state:'failed', result:{error:'cancelled'}}}` + `exit=0`；③ 对**已终态**的同一 id 再取消 ⇒ 上游 `TASK_ALREADY_FINAL` + `exit=1`。
- **文件·锚点**: 零源码改动；`oamp/sdk/uds.js:171-174`（`taskCancel`）、`oamp/src/router.js:394-414`（分支语义）、`oamp/sdk/errors.js`（退出码归类：JSON-RPC 业务错误 ⇒ `1`）。
- **步骤**: ① 用 `curl POST /api/calls` 拿 `call_id`（`!sleep 30`）；② 立刻 `hub uds router.task_cancel --params …` 并记 `exit=$?`；③ 用 `hub api calls get` 复核 `state` / `error`；④ 重复调用一次记 `exit=$?` 与 stderr 原文；⑤ 收尾收进 T7 的同一集群。
- **验收判据（可执行）**:
  1. **生效**：首次取消的 stdout 含 `"state":"failed"` 与 `"error":"cancelled"`，`exit=0`；随后 `hub api calls get <id>` 的 `state` = `failed`、`error` = `cancelled`（终态**当刻**可判定）。
  2. **已终态**：第二次取消 ⇒ stderr 单行 JSON 含 `TASK_ALREADY_FINAL`、`exit=1`；`calls get` 的 `state` / `error` **未被改写**。
  3. 两次调用的完整命令与输出（含 `exit`）进 T11 证据段。
- **前置依赖**: T2、T7（同一隔离集群）
- **优先级**: P0

---

### T9: `hub doctor` 三段全 pass + R1 的 29 锁 + R3 未扩

- **服务哪条 AC**: AC6 + AC7
- **描述**: 在同一隔离集群上跑 `hub doctor`，核：三段（R1 / R2 / R3）无 `ok:false`；R1 的文档侧行数 = 29（= 层 A 条数）；R3 的条目集合仍为既有 8 个方法。
- **文件·锚点**: 零源码改动；`oamp/sdk/doctor.js`（A8）；`oamp/sdk/cli.js:290-305`（`hub doctor` 的端口取自 `createSurface` 的 `ctx.port`）。
- **步骤**: ① `OAMP_WEB_PORT=<隔离端口> node oamp/bin/hub.js doctor`；② 抽 `{pass, 分段计数, ok:false 列表, R3 条目集合, R1 中新增 8 条路由的行}`；③ 与层 A 条数（29）对照。
- **验收判据（可执行）**:
  1. **三段 pass**：输出中 `ok:false` 的条目数 = **0**（`pass:true`）；R1 / R2 / R3 三段各有条目（分段计数 > 0）。
  2. **R1 的 29 锁**：`R1` 条目数 = **29**，且等于 `ENTRIES` 的层 A 条数（同时打印两侧读数）。
  3. **R3 未扩**：`R3` 条目集合 = 既有 8 个方法（`agent.register` / `agent.heartbeat` / `agent.deregister` / `message.send` / `message.ack` / `router.status` / `router.task_get` / `router.task_list`），**不含** `router.task_cancel`。
  4. 原始 JSON（或其 `jq` 投影）原样进 T11 证据段。
- **前置依赖**: T1、T2（表就位）+ T7（同一隔离集群）
- **优先级**: P0

---

### T10: 未触碰面与零新增核查（`cli.js` / `doctor.js` / `API.md` / `llms.txt` / 层 C / 红线）

- **服务哪条 AC**: AC9 + AC13（并覆盖 PR 文件「不触碰」清单）
- **描述**: 以 `git diff` 与 `git status` 为唯一判据：① 本 PR 的改动面 ⊆ 文件范围；② `cli.js` / `doctor.js` / `http.js` / `uds.js` / `API.md` / `llms.txt` / `src/**` / `README.md` 零改动；③ `package.json` 零改动（零新增依赖）；④ `hub.md` 的层 C 清单（11 条）、`doctor` 段落、四条红线区段零 `-` 行。
- **文件·锚点**: 零写入（只读 `git diff` / `git status`）。
- **步骤**: ① `git -C <WS> diff --name-only 22f6859`；② `git -C <WS> diff --stat 22f6859 -- oamp/sdk/cli.js oamp/sdk/doctor.js oamp/sdk/http.js oamp/sdk/uds.js oamp/API.md oamp/llms.txt oamp/package.json oamp/README.md oamp/src oamp/web`（**必须为空**）；③ `git -C <WS> diff -U0 -- oamp/skill/hub.md | grep '^-'` 逐行归类；④ `git -C <WS> status --short`。
- **验收判据（可执行）**:
  1. ①的输出 ⊆ `{oamp/sdk/surface.js, oamp/skill/hub.md, docs/…/pr-007-hub-entries-and-skill-lists.md, docs/…/pr-007-hub-entries-and-skill-lists-tasks.md}`。
  2. ②的输出为空。
  3. ③的 `-` 行只落在：层 A 计数行、层 B 计数行、序列 1 段被替换行；**层 C 清单 11 行、`doctor` 段落、四条红线零命中**。
  4. ④除既有未跟踪 `clarifications/` 外无其它未跟踪产物（临时脚本 / 探针文件一律落在工作区外，或置于被忽略的 `.pb-agents/` 下）。
- **前置依赖**: T1~T5（写入完成后）
- **优先级**: P0

---

### T11: 验收证据落盘（PR 文件「验收证据」段）+ 复选框勾选 + 占位符自检

- **服务哪条 AC**: 全部 13 条 AC 的证据载体（AC 未全过 ⇒ 本任务未完成）
- **描述**: 把 T0~T10 的原始命令与原样输出按 PR 文件「验收证据」段的要求逐条回填（**只改该段与复选框，七字段不动**），并附占位符自检输出。
- **文件·锚点**: `prs/pr-007-hub-entries-and-skill-lists.md` 的「验收证据」段 + 「验收标准」复选框；体例先例 = 同迭代 `pr-006-protocol-docs-and-index.md` 的证据段（`WS=` + `cd $WS && …` + 紧跟原样输出）。
- **步骤**: ① 复现环境块（隔离集群三步 + 相对短 socket 说明）；② 逐条 AC：命令 + 原样 stdout/stderr；③ 49 条计数与分层读数、8 条新增条目原文、既有 40 条差异 = ∅ 的脚本输出；④ 9 条入口的退出码输出；⑤ `task_cancel` 两条判据输出；⑥ `hub doctor` 三段输出；⑦ `hub.md` 清单计数与「序列 1」原文 + F19 两条 `grep` 输出；⑧ `grep -nE '/tmp/|<[a-z_]+>' <本 PR 文件>` 自检输出（命中必须为 0）；⑨ 按实际结果勾选复选框。
- **验收判据（可执行）**:
  1. **每条 AC 命令可复制执行**且自带工作区绝对路径或 `cd <WS> &&` 前缀，**不引用 `/tmp`**（`grep -nE '/tmp/'` 命中数 = 0）。
  2. **无占位符**：`grep -nE '<[a-z_]+>|\{[a-z_]+\}|xxx' <本 PR 文件>` 命中数 = 0。
  3. **AC 覆盖**：13 条 AC 每条都能指到对应原样输出（缺一即不完成）。
  4. `git -C <WS> status --short` 干净（除既有未跟踪 `clarifications/`）。
- **前置依赖**: T6、T7、T8、T9、T10
- **优先级**: P0

---

## 2. 依赖图

```
T0 ─┬─> T1 ──> T3 ──┐
    │        ├─> T6 ├─> (T11)
    └─> T2 ──> T4 ──┤
             └──────┘
T1,T2 ──> T7 ─┬─> T9 ──┐
              ├─> T8 ──┤
T3,T4 ──> T5 ──────────┤
T1..T5 ──> T10 ────────┴─> T11
```

边（逐条枚举，共 13 条；与 §1 各任务「前置依赖」行逐字对应）：

| 前置 | 后继（出边） | 条数 |
|---|---|---|
| `T0` | `T1`、`T2` | 2 |
| `T1` | `T3`、`T6`、`T7`、`T9`、`T10` | 5 |
| `T2` | `T4`、`T6`、`T7`、`T9`、`T10` | 5 |
| `T3` | `T5`、`T6`、`T10` | 3 |
| `T4` | `T5`、`T6`、`T10` | 3 |
| `T5` | `T10` | 1 |
| `T6` | `T11` | 1 |
| `T7` | `T8`、`T9`、`T11` | 3 |
| `T8` | `T11` | 1 |
| `T9` | `T11` | 1 |
| `T10` | `T11` | 1 |

**最长依赖链（关键路径）**：`T0 → T1 → T3 → T5 → T10 → T11`（6 个任务）与 `T0 → T2 → T4 → T5 → T10 → T11`（6 个任务）并列；**无环**（全部边从低编号指向高编号的后继，拓扑序 = `T0,T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11` 的一个线性扩展）。

**逐类理由**：
- **`T0 → T1/T2`**：判据基础（A1~A12 的原始输出）必须在任何写入前捕获（既有 40 条的基线清单）。
- **`T1 → T3` / `T2 → T4`**：清单的逐条同名同序对象是 `ENTRIES` 的真实条面（不是设计稿）。
- **`T3/T4 → T5`**：同一文件（`hub.md`）的连续编辑，按清单在前、序列在后的顺序落地（避免同段冲突）。
- **`T1/T2/T3/T4 → T6`**：互锁核查的对象是两侧落盘后的真实产物。
- **`T1/T2 → T7/T9`**：真集群取证需要表已就位（否则入口名解析不到）。
- **`T7 → T8/T9`**：`task_cancel` 判据与 `doctor` 三段都在 T7 起的同一隔离集群上跑（省一次起停，且避免并发端口/socket 冲突）。
- **`T1..T5 → T10 → T11`**：未触碰面核查覆盖全部写入任务；证据段是全任务的载体。

---

## 3. 增量（每个增量可独立产出可验证结果）

| 增量 | 任务 | 可独立验证的结果 |
|---|---|---|
| **I1 入口表追加** | T1、T2 | `ENTRIES` = 49 条（29 / 9 / 11）；`git diff` 只追加；既有 40 条八字段差异 = ∅（与 T0 基线比对）；`node --check` 通过 |
| **I2 skill 清单与 F19 文档面** | T3、T4、T5 | `hub.md` 层 A 29 / 层 B 9，与 `ENTRIES` 逐条同名同序；「序列 1」三条 F19 判据的 `grep` 输出齐备；层 C / `doctor` / 红线零 `-` 行 |
| **I3 真集群取证与证据落盘** | T6、T7、T8、T9、T10、T11 | 9 条新增入口的 `exit` 原样输出；`task_cancel` 两条判据输出；`hub doctor` 三段 pass + R1 29 + R3 未扩；未触碰面 diff 核查；PR 文件证据段 + 复选框 + 占位符自检 = 0 |

> **提交纪律**（简报要求）：每完成一个增量立即 `git -C <WS> add -- <本 PR 文件范围> && git -C <WS> commit -m "…"`；**不做** push / merge / 切分支 / `--no-verify`。

---

## 4. 判据成熟度自检（每条 AC 是否"可在不运行代码时判通过/不通过"）

| AC | 可测试判据 | 成熟度 |
|---|---|---|
| 1 | 脚本读数 49/29/9/11 + 八字段差异集合 = ∅ + `git diff` 只追加 | ✅ 机械 |
| 2 | 8 条与登记元数据的 `method`+`path` 1:1 + 逐条形态表比对 | ✅ 机械 |
| 3 | 层 B 第 9 条 `{id, method, acceptsAs:false}` 打印比对 | ✅ 机械 |
| 4 | 9 条入口逐条 `exit=<n>` ∈ {0,1,2,3} + 成功路径抽样 | ✅ 机械（真集群） |
| 5 | 首次 `state:failed` / `error:cancelled` + `exit=0`；再次 `TASK_ALREADY_FINAL` + `exit=1` | ✅ 机械（真集群） |
| 6 | `doctor` 输出 `pass:true`、`ok:false` 计数 = 0、R3 集合 = 既有 8 个 | ✅ 机械（真集群） |
| 7 | R1 条目数 = 29 = 层 A 条数（两侧读数同屏） | ✅ 机械（真集群） |
| 8 | `hub.md` 两侧清单与 `ENTRIES` 逐条同名同序（脚本） | ✅ 机械 |
| 9 | `git diff -U0 -- oamp/skill/hub.md` 的 `-` 行归类（层 C / `doctor` / 红线区段零命中） | ✅ 机械 |
| 10 | 两条原语的 `grep` 命中 + 各自适用场景句 | ✅ 机械 + 一处人工判据（场景句可读性） |
| 11 | 「轮询」+「兜底」同段命中 + 三步有序列表原文 | ✅ 机械 + 原文呈现 |
| 12 | 段落内不出现条文复制（`timed_out` 等）+ 指向 `API.md` §2.4 | ✅ 机械 |
| 13 | `git diff --stat` 对 `cli.js` / `doctor.js` / `package.json` 为空 | ✅ 机械 |

---

## 5. 待主 agent 裁决的发现（planner 上报，**不在本任务图里绕开**）

**F-1（跨 PR 契约缺陷，非本 PR 可独立修复）**：`POST /api/pickup/<call_id>/ack` 的两个字段 `principal` / `epoch` 在登记里都是 `in: 'query'`，而既有 `runApi`（`surface.js:78-88`）**只在 `spec.method === 'GET'` 时把 query 随请求发出**（非 GET 的 `flags` 一律进 `body`）。⇒ 按 AC2 的机械规则（query 字段 → `--<字段名>` 标志）落地的 `api pickup ack` 条目，其请求会落在"无 query"的形态上，被服务端以 `400 INVALID_PARAM / 需要合法 principal` 拒绝（实测：query 形态 `200`、body 形态 `400`）。

- **本 PR 的处置**：按 AC1 / AC2 的字面契约落地（追加式 diff、query 字段走标志），并在证据段**透明记录**该读数的来源；**不擅自改** `runApi`（那是超出「只追加」文件面描述的改动，属架构决策）。
- **最小修复选项（供主 agent 选择）**：① `runApi` 的 `query:` 条件去掉 `spec.method === 'GET'`（1 行；对既有 40 条等价 —— 既有 POST 条目均无 query 字段）；② 或在条目表引入"字段通道"声明（改动面更大，与本 PR 的追加式文件面冲突，不建议）。
- **影响面**：只影响 `api pickup ack` 一条入口的业务成功路径；不影响 `ENTRIES` 条数、分层计数、清单互锁、`doctor` 三段与其余 8 条新入口。

---

## 6. 疑问 / `[model_inferred]` 项

1. **`[model_inferred]` 层 A 8 条的 `cmd` 动作词**：`subscribe` / `health` 单 token、`pickup list` / `pickup ack` / `principals create` / `principals get` / `calls wait` / `calls cancel` 双 token —— 依据 = 既有体例（`docs` / `agents` 单 token；`calls list` / `confirmations list` / `projects create` 双 token）+ PR 文件第 29 行对入口名的字面列举（`api principal(s) …` / `api subscribe` / `api pickup …` / `api calls wait …` / `api calls cancel …` / `api health`）。**无架构决策新增**，属体例推导。
2. **`flags` 顺序**：取登记 `params` 数组序（非 `API.md` 表格列序）。理由 = AC2 明写"由该路由的**元数据**机械推导"，而 `params` 是登记真源。
3. **`api pickup ack` 的 query 通道**：见 §5 F-1（需主 agent 裁决；本 PR 按字面契约落地 + 透明记录）。
