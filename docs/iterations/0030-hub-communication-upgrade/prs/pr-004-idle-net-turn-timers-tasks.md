# pr-004-tasks.md — pr-004 内部任务列表（轮次计时：空闲判据 + 绝对安全网）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-004-idle-net-turn-timers.md`
**PR worktree（绝对路径，唯一代码写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-004-idle-net-turn-timers`
**PR worktree 分支**: `feat/0030-pr-004-idle-net-turn-timers`
**任务总数**: **6**（T1~T6）+ **1 个前置裁决项（T0，非 dev 任务）** ｜ **依赖图**: **无环**（见 §2）｜ **关键路径**: `T1 → T2 → T5 → T6`
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（7 条验收标准）+ `architecture.md`（§3.3、§4 A-05 逐条含生效位置清单 1~8、§5 变更面、§7 L2-04/L2-05/L2-09、§9-6/§9-7）+ `prd/F05-idle-timeout-and-safety-net.md`（验收 1~7、MI-7/MI-8）+ 代码实读（§0.3 逐条带 `文件:行号`）+ **planner 在 `/tmp` 的参照实现演练实测**（§0.3 F9~F14、§4 配方 R1~R8）

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（PR 文件「文件范围」逐字，5 个文件）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/config.js` | 修改 | `loadConfig()` 新增 `taskIdleMs`（默认 `600000`）/ `taskNetMs`（默认 `14400000`）+ env `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS`（沿用 `readPositiveInt`）（**T1**） |
| 2 | `oamp/src/rpc-client.js` | 修改 | turn timer 改 `idle` + `net` 双计时（含门挂起同冻结、缺省档移除）（**T2**） |
| 3 | `oamp/src/acp-client.js` | 修改 | 同上（含 `_pauseTurnTimer` / `_resumeTurnTimer` 覆盖两个计时器）（**T3**） |
| 4 | `oamp/src/oneshot-client.js` | 修改 | 同上（无门 ⇒ 无冻结面；进展信号 = stdout/stderr 行 + `truncated` 控制条目）（**T4**） |
| 5 | `oamp/src/agent.js` | 修改 | 移除 `DEFAULT_OMP_TIMEOUT_MS` 默认档；两路 LLM 任务传 `{idleMs, netMs}`；超时失败文本按触发阈值参数化（**T5**） |
| — | `docs/.../prs/pr-004-idle-net-turn-timers-tasks.md`（本文件） | 增量产物 | 阶段 5 planner 产物，落在迭代工作区 `docs/` 下，**不计入** PR 代码改动面 |

> 取证产物一律落 `/tmp/0030-pr-004/`，**不入库**（§4；`oamp/` 下无 `*.test.js` 先例 ⇒ 自证载体 = 一次性脚本 + 只读命令）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/src/web.js`（对账 TTL 联动属 **pr-005**）、`oamp/src/router.js`、`oamp/src/registry.js`、`oamp/src/role-binding.js`、`oamp/src/transport.js`、`oamp/src/protocol.js`、`oamp/src/launcher.js`、`oamp/src/context-pool.js`（⚠ 见 **T0**：本项与其他约束冲突，须主 agent 裁决）、`oamp/src/reason.js`（pr-001 已合入）、`oamp/sdk/**`（`cli.js` / `surface.js` 的 30 分钟等待预算是**调用方放弃等待**语义，A-05 生效位置清单第 8 条明文不改）、`oamp/web/**`、`oamp/bin/**`、`oamp/scripts/**`、`oamp/package.json`、`oamp/API.md`、`oamp/README.md`、`oamp/llms.txt`、`oamp/skill/hub.md`（后四项属 **pr-006**）、`roles/**`、`cluster.json`。
  追溯：PR 文件「文件范围」（恰 5 个文件）+ architecture §5 变更面清单 + §4 A-05 生效位置清单第 5/7/8 条（`MAX_TIMEOUT_MS` / `shell` / 客户端等待预算三者**保留**）。
- **不新增**：任何 HTTP 路由（既有 **29 条**不变）、任何协议方法、任何 `state` 取值、任何 `error` 取值形态、任何子枚举（D-29）、任何第三方依赖、任何测试文件、任何目录、**任何新文件**。
- **不做（属其他 PR / 其他层）**：`reason` 归类（pr-001，已合入，本 PR 只保证产出的 `error` 串落在其可归类形态内）、信封 `reason` 追加与对账 TTL 联动（pr-005）、文档面同步（pr-006）、模型路由（pr-007）、G01 冻结核查（pr-008）。
- **明确排除的错误形态**：
  1. 在**判死点**改写 `error` 文案以配合区分（A-04 裁决 2「既有失败产生点的改造清单 = 空」；G01 验收 3）。⇒ **禁止**把 `轮次空闲超时（…）` 一类 message 直接塞进 `error` 字段（实测：reason.js 会归 `agent_error`，破 F05 验收 2/4，见 F13）。
  2. 新增 web 看门狗 / Router 判死（L2-04：第二判死源 + 僵尸轮次）。
  3. 把 30 分钟上限"改成别的数字"（那不是双计时：F05 验收 1 要求"一直在干活的长任务不被砍"，单阈值做不到）。
  4. 判死转 `suspended` / 可续做 / 剩余额度投影（F05 边界三条明文排除）。

### 0.3 读码与实测事实锚点（2026-09-17 实读 + `/tmp` 演练实测）

**代码事实（PR worktree HEAD `9f071b8`）**

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **F1** | `config.js` 的 env 数值面 = `NUMERIC_DEFAULTS` 表 + `readPositiveInt(name, env)`（未设 ⇒ 表内默认；非正整数 ⇒ **抛 `OAMP 配置错误: <NAME> 需为正整数（当前值 "…"）`**） | `config.js:24-28`（表）、`:34-43`（函数）、`:136-163`（`loadConfig`，返回对象起于 `:143`） |
| **F2** | rpc 轮次计时 = **单计时器** `active.timer` + `remainingMs`/`deadline`；门挂起经 `freezeTurnTimer()` / `thawTurnTimer()`（按 `pauseDepth`，按剩余量恢复）；增量出口 = `emitDelta(active,payload)`（`onMessageUpdate` / `onToolExecutionUpdate` 两处调用） | `rpc-client.js:14`（`DEFAULT_TURN_TIMEOUT_MS=1800000`）、`:198-227`（clear/arm/freeze/thaw）、`:254-258`（emitDelta）、`:309/318`（两处调用）、`:351/365`、`:403/415`（门 freeze/thaw）、`:584`（`prompt` 默认档）、`:602`（`armTurnTimer`） |
| **F3** | acp 轮次计时 = `_request('session/prompt', …, {timeoutMs, onTimeout})` 内建的**请求级计时器** `entry.timer` + `remainingMs`/`startedAt`/`paused`；门挂起经 `_pauseTurnTimer()` / `_resumeTurnTimer()`（按 `_pausedTurns` 深度）；**轮次增量只有 `agent_message_chunk` 走 `onDelta`**（`_chunkHandler`），工具调用帧走 `_handleSessionUpdate`（审计面，**不**产 `onDelta`） | `acp-client.js:17`（`REQUEST_TIMEOUT_MS=10000`）、`:319`（`prompt` 默认档）、`:329-336`（chunkHandler → onDelta）、`:425-443`（`_request` 计时 arm/expire）、`:500-503`（`session/update` 分流）、`:510-531`（tool_call 审计）、`:637-643`/`:717-723`（挂起 freeze/resume 调用点）、`:756-783`（两个 freeze/thaw 函数） |
| **F4** | oneshot 轮次计时 = `setTimeout(…, timeoutMs)` 单计时器（`timer`），`emitLine` 逐行回调 `onDelta`；**无门面**（能力位 `approvalGate: 'no'`，`approval` 只作 argv 档位） | `oneshot-client.js:17`、`:107`（`prompt` 默认档）、`:132-161`（timer）、`:163-178`（emitLine → onDelta）、`:22-33`（能力位） |
| **F5** | agent 侧默认档 = `DEFAULT_OMP_TIMEOUT_MS = 1800000`，在 `parseTaskBody` 的 **`omp` 与 `omp-daemon` 两分支**回落；显式值经 `MAX_TIMEOUT_MS = 1800000` 校验，拒绝文案 = `timeout_ms 需为 1~600000 正整数`（文案与上限**不匹配**的既有事实，逐字保留）；shell 分支默认 `DEFAULT_TASK_TIMEOUT_MS = 30000` | `agent.js:30-32`、`:91-93`（omp）、`:115-117`（omp-daemon）、`:140-144`（shell） |
| **F6** | 两路 LLM 的 `prompt` 调用传 `timeoutMs: task.timeoutMs`；失败体形状不同：one-shot = `{state:'failed', error:'timeout_after_<task.timeoutMs>ms', timed_out:true, executor:'omp'}`（`error` 承载文本）；daemon = `{state:'failed', error:<ProtocolError.code>, text:<err.message>}`（`text` 承载文本） | `agent.js:202-205`（one-shot 调用）、`:220-221`（one-shot 失败体）、`:365-367`（daemon 调用）、`:389-401`（daemon 失败体） |
| **F7** | daemon 路径的 `prompt` 选项**必须**经 `ContextSession.prompt` 转发：其形参表与队列项都是**显式键集**（`{text, model, timeoutMs, onDelta, projectContext}`），`client.prompt` 只收到 `{model, timeoutMs, onDelta}` ⇒ **任何未列入的选项在 daemon 路径被静默丢弃** | `context-pool.js:137`（形参表）、`:144`（队列项）、`:170-174`（`client.prompt` 实参） |
| **F8** | PR worktree HEAD = `9f071b8`（**不含** `oamp/src/reason.js`）；迭代分支 tip = `2023e88`（含 pr-001 合入的 `oamp/src/reason.js`）⇒ dev 需先同步迭代分支才能做 `reason` 归类核对 | `git log --oneline`（两工作区）+ `ls oamp/src/reason.js`（迭代工作区命中、PR worktree 未命中） |

**planner 参照实现演练实测（`/tmp/pr004-reh/`，仅 `oamp/**` 的 `/tmp` 副本；**未写入仓库任何路径**）**

| # | 实测结论 | 数值/证据 |
|---|---|---|
| **F9** | 压缩时间轴可用：`OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS` 经 config → agent → 客户端全链路生效，判死时刻与压缩阈值**一致**（one-shot：`elapsed≈idle`；daemon：`elapsed≈阈值 + 2000ms` 宽限） | one-shot `idle=1500` ⇒ 判死 **1.61 s**；daemon `idle=1500` ⇒ 判死 **3.63 s**（=1.5+2.0 宽限） |
| **F10** | **"缺省档移除"必须同时处理 `null`**：三客户端在 `timeoutMs: null` 下都会**立刻判死**（`setTimeout(fn, null)` ≈ 1 ms） —— 未加固时实测：acp `session/prompt 超时（nullms）`@**1 ms**、one-shot `一次性执行超时（nullms）`@**3 ms**、rpc `轮次超时（nullms）`@**2003 ms**（1 ms + 2 s 宽限） | 对 PR worktree **原始**客户端直接驱动所得（只读引用，未改动） |
| **F11** | 同一陷阱的**复合形态**：daemon 路径若阈值未送达客户端（F7 的丢弃），`idleMs`/`netMs` 为 `null` ⇒ 判死报文出现 **`轮次安全网超时（累计 nullms）`**，判死时刻 ≈ 2.5 s | 用**未改** `context-pool.js` 的副本跑 daemon 桩：`{state:'failed', error:'timeout', text:'轮次安全网超时（累计 nullms）'}` |
| **F12** | rpc 判死有 `CANCEL_GRACE_MS=2000` 宽限；**若子进程在宽限内发出终态帧，该轮会先按成功结算**（`settleTurn` 先行 ⇒ `failTurn` 空操作）⇒ 证据桩必须在收到 `abort` 后**保持静默** | 桩在 `abort` 帧上 `process.exit(0)` 时实测得到 `error=context_crashed / text=子进程退出 code=0 signal=`（**错误结论**）；改为静默后得 `error=timeout / text=轮次空闲超时（空闲 1500ms）` |
| **F13** | `reason.js`（pr-001，已合入）归类实测：`timeout_after_1500ms` → `timeout`、`timeout_after_4000ms` → `timeout`、`timeout` → `timeout`、`timeout_after_nullms` → `timeout`；而 **`轮次空闲超时（空闲 1500ms）` → `agent_error`** | 直接 `import { reasonOf }`（迭代工作区路径）逐串打印 |
| **F14** | 门挂起冻结可判定：`idle=1200`/`net=3000`、提问门挂起 **4000 ms**（越过两个阈值）⇒ 本轮**正常结算**（4.00 s，`text='answered'`）；若两个计时器未同冻结，必在 1.2 s / 3.0 s 判死 | 客户端级驱动 `createRpcSession({hooks:{onQuestionRequest}})` + `host_tool_call` 桩 |
| **F15** | 显式 `timeout_ms` 的旧语义可判：`timeout_ms=1200`（idle/net 取默认大值）⇒ 判死 **1.21 s**、`error='timeout_after_1200ms'`（`err.timeoutMs` 承载触发阈值后与今日逐字同形） | one-shot 端到端 |
| **F16** | 两种触发的**可区分性**可判：同一路径两条失败文本不同 —— one-shot `timeout_after_1500ms`（空闲）vs `timeout_after_4000ms`（安全网）；daemon `text='轮次空闲超时（空闲 1500ms）'` vs `text='轮次安全网超时（累计 4000ms）'` | 端到端（R2/R3 配方） |

### 0.4 本 PR 冻结契约（跨任务一次定死；三个客户端同形）

**C1 · `prompt(text, opts)` 选项契约（三客户端一致，形态与 PR 文件「上下文摘要」逐字对齐）**

1. 选项集 = `{ model = null, timeoutMs = null, idleMs = null, netMs = null, onDelta = null }`（各客户端既有同名选项保持原语义；**同名缺省值 `1800000` 一律移除**）。
   〔追溯：PR 验收 5；A-05 生效位置清单第 2/3/4 条〕
2. **三分支，互斥**：
   - `timeoutMs` 为**正整数** ⇒ **旧语义逐字不变**：单绝对计时，`idleMs`/`netMs` **不参与**（调用方显式声明的本轮绝对上限）。
   - `timeoutMs` 为 `null`/`undefined` 且 `idleMs`/`netMs` 为**正整数** ⇒ `idle` + `net` **双计时**。
   - 三者皆缺失 ⇒ **不武装任何计时器**（"缺省档不存在"的字面含义）。**禁止**把 `null` 当 `0 ms`（F10/F11 实测形态即此错误的后果）。
   〔追溯：PR 验收 5（缺省档不存在）；A-05「显式 `timeout_ms` 的边界裁决」〕
3. **计时起点**：`net` 自轮次开始起算；`idle` 自"轮次开始**或**最近一次进展事件"起算（轮次开始即武装一次）。
   〔追溯：A-05「计时起点（MI-8）」；F05 验收 2〕
4. **进展事件（重置 `idle` 的信号集）**：
   - rpc：`emitDelta()` 闸口（覆盖 `message_update` 的 `chunk`/`thinking`/`tool_call` 三类 + `tool_execution_update` 的 `tool_output`）；
   - oneshot：`emitLine` 的每一行（stdout/stderr）+ `truncated` 控制条目；
   - acp：`agent_message_chunk`（即 `onDelta` 唯一来源）**+ `session/update` 的 `tool_call` / `tool_call_update`**〔`[model_inferred]` **MI-P4**：A-05 把"每一个增量事件"列为信号集（含工具事件），而 acp 实现的工具事件不流经 `onDelta`；若只按 `onDelta` 重置，acp 下"长工具执行无文本块"会被误判空闲〕。
   〔追溯：A-05「信号源接入点」+ §3.3 第 1 条；MI-7〕
5. **触发动作**：复用各客户端**既有**超时收尾（rpc：`abort` → 宽限 `CANCEL_GRACE_MS` → `kill`；acp：`cancel` → 宽限 → `kill`；oneshot：`SIGTERM` → `KILL_GRACE_MS` → `SIGKILL`），抛 `ProtocolError('timeout', <message>)`，并在该错误实例上附**内部字段** `timeoutMs = <触发阈值>`（不上 wire、不进信封）。
   〔追溯：A-05「触发后走既有唯一终态路径」；F05 验收 6；PR 验收 2/3〕
6. **报文形态（人类可读面）**：`idle` ⇒ `轮次空闲超时（空闲 <idleMs>ms）`；`net` ⇒ `轮次安全网超时（累计 <netMs>ms）`；显式 `timeoutMs` ⇒ 各客户端**既有文案逐字**（rpc `轮次超时（<ms>ms）`、acp `<method> 超时（<ms>ms）`、oneshot `一次性执行超时（<ms>ms）`）。
   〔追溯：A-05 第 6 条 + §3.3 第 6 条（示例报文逐字）；PR 验收 4〕
7. **门挂起同冻结**：门（审批 / 提问）挂起期间 `idle` 与 `net` **一并冻结**，恢复按各自剩余量；重叠挂起按既有深度语义（rpc `pauseDepth` / acp `_pausedTurns`）。
   〔追溯：A-05「门挂起冻结语义保留（0029 L1-1 不回归）」+ §3.3 第 2 条；PR 验收 6〕
8. **不新增** `state` 取值、`error` 取值形态、子枚举、协议帧、配置键（除 T1 的两个 env）。
   〔追溯：D-29；G01 验收 2/3；PR 验收 4〕

**C2 · agent 侧契约（T5）**

1. `parseTaskBody`：`omp` / `omp-daemon` 两分支中 `body.timeout_ms === undefined` ⇒ `timeoutMs: null`（**不再回落** `DEFAULT_OMP_TIMEOUT_MS`，该常量删除）；**显式**值的校验分支与拒绝文案 `timeout_ms 需为 1~600000 正整数` **逐字不变**，`MAX_TIMEOUT_MS = 1800000` **保留**。
   〔追溯：A-05 生效位置清单第 1/5 条 +「显式 `timeout_ms` 的边界裁决」；PR 验收 5〕
2. `shell` 分支：`DEFAULT_TASK_TIMEOUT_MS = 30000` 与校验**零改动**。
   〔追溯：A-05 生效位置清单第 7 条；PR 验收 7〕
3. 两路 LLM 调用传 `{timeoutMs: task.timeoutMs, idleMs: <config.taskIdleMs>, netMs: <config.taskNetMs>}`；阈值真源 = `loadConfig()`，**无硬编码**。
   〔追溯：A-05「阈值配置面位置」；PR 验收 1〕
4. 失败体：
   - one-shot：`error` **保持参数化形态** `timeout_after_<触发阈值>ms`（`err.timeoutMs` 缺失时回落 `task.timeoutMs`），`timed_out: true` 保留 ⇒ 形态不变、参数 = 触发阈值（两触发可区分），`reason.js` 仍归 `timeout`（F13）。
   - daemon：`error = <ProtocolError.code>`（`timeout`）+ `text = <err.message>`（承载区分文本）⇒ **零改动**。
   - **禁止**任何路径把 `轮次空闲超时（…）`/`轮次安全网超时（…）` 放进 `error` 字段（F13：会归 `agent_error`）。
   〔追溯：A-05 第 6 条（承载 = `text`（daemon）/ 参数化串（shell / one-shot））；A-04 裁决 1 表第 7/8 行 + 裁决 2；PR 验收 2/3/4〕

**C3 · 跨 PR 接缝（本 PR 只保证，不实现）**

1. `loadConfig()` 返回的键名**必须是** `taskIdleMs` / `taskNetMs`（pr-005 读 `config.taskNetMs` 做 `RECONCILE_TTL` 联动）。
   〔追溯：PR-004 文件「上下文摘要」；A-05 生效位置清单第 6 条；pr-005「参考资料」第 2 条〕
2. 本 PR 产出的失败 `error` 串必须 ∈ {`timeout`, `timeout_after_<N>ms`}（供 pr-001 的 `reasonOf` 归 `timeout`）。
   〔追溯：architecture §4 A-04 表第 7/8 行；F13 实测〕
3. 本 PR **不**新增终态写点：一切判死经既有 `task.result` → Router `finishTask` → web `publishCallResult` 链路。
   〔追溯：A-05 第 5 条；F05 验收 6〕

### 0.5 PR 验收标准 → 任务映射（7 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC（PR 文件原文摘要） | 服务任务 | 判定配方 |
|---|---|---|
| **AC1** `loadConfig()` 含 `taskIdleMs===600000`/`taskNetMs===14400000`；`abc`/`0`/负数 ⇒ 启动即抛错；`=2000` ⇒ 压缩生效 | **T1** | **R1** |
| **AC2** 持续进展且累计时长超过旧 30 分钟上限**不被判死**；停止产出达 `taskIdleMs` ⇒ 判死 `state:'failed', error:'timeout'` | **T2/T3/T4**（计时语义）+ **T5**（缺省档移除） | **R2/R3**（含压缩等价判据，§4.9） |
| **AC3** 安全网独立生效（持续噪音信号 ⇒ 达 `taskNetMs` 判死 `error:'timeout'`）；阈值内正常长任务不被触发 | **T2/T3/T4** + **T5** | **R2/R3** |
| **AC4** 两种触发的人类可读文本可区分；不新增 `state`/`error` 取值形态、无子枚举 | **T2/T3/T4**（报文）+ **T5**（承载） | **R2/R3/R7** |
| **AC5** 缺省档不存在（`DEFAULT_OMP_TIMEOUT_MS` 与三处客户端默认值均不再作为默认证）；显式 `timeout_ms` 语义与 `≤ MAX_TIMEOUT_MS` 校验逐字不变 | **T5** + **T2/T3/T4**（同名默认值移除） | **R4/R6/R8** |
| **AC6** 门（审批/提问）挂起期间两个计时器一并冻结 | **T2/T3** | **R5** |
| **AC7** `shell` 路径 `timeout_ms` 默认 30 s / 上限 30 分钟语义不变 | **T5**（+ 零改动核对） | **R8** |

---

## 1. 任务列表

### T0（**前置裁决项，非 dev 任务**）：阈值在 `daemon` 路径的投送形态 —— 文件范围缺口

- **性质**: **主 agent 裁决**（planner 按角色边界上报，不自行填补架构空白；见 §5.1 上报原文）
- **事实**: PR 文件「上下文摘要」写明 "`agent.js` 两路 LLM 任务改传 `{idleMs, netMs}`"；但 **daemon（默认 executor）路径**的选项通道是 `agent.js → context-pool.js ContextSession.prompt → <acp|rpc>-client.prompt`，而 `ContextSession.prompt` 的形参表与队列项是**显式键集**（F7）⇒ 未列入的 `idleMs`/`netMs` **被静默丢弃**。
- **后果（实测 F11）**: 丢弃后两阈值为 `null` ⇒ 若客户端只做"移除默认档"而不做防御，daemon 轮次会**立即判死**（实测报文 `轮次安全网超时（累计 nullms）`，≈2.5 s）；即便做了防御，也退化为"**完全没有计时器**"⇒ F05 验收 2/3/6 在默认路径上不成立。
- **候选（三选一，均需主 agent 裁决；planner 不选边）**:
  - **A（推荐）**：把 `oamp/src/context-pool.js` 纳入本 PR 文件范围，做 3 行透传（形参 + 队列项 + `client.prompt` 实参各加 `idleMs`/`netMs`）。代价：pr-008 的"`context-pool.js` 本迭代零改动"子句需同步修订（该文件受保护的是**键语义/串行/LRU**，两句透传不触碰任何 G01 不变量）。
  - **B**：三客户端自行 `import config from './config.js'` 读取阈值（本 PR 文件范围内，零 context-pool 改动）。代价：与 PR 文件「agent.js 改传」的明文接线方式不符；客户端与配置面耦合（config.js 是叶子模块，无循环依赖）。
  - **C**：阈值随 `resident` spec 经 `protocol.js` 注入客户端构造函数（`protocol.js` 不在 pr-008 零改动清单内）。代价：改动面更大（构造期烘焙 vs 每轮选项），且一次性路径的"逐任务装配"语义被拉平。
- **对任务图的影响**: 只影响 **T5** 的接线写法；**T1~T4 的客户端契约（C1）与判据在三种候选下完全不变** ⇒ T1~T4 可立即开工。

---

### T1: `oamp/src/config.js` —— `taskIdleMs` / `taskNetMs` 两个阈值键（env + 默认 + 非法值响亮失败）

- **服务哪条 AC**: PR **AC1**；F05 验收 5（阈值是初值、可调）
- **描述**: 在既有唯一配置面加两个数值键：`NUMERIC_DEFAULTS` 增 `OAMP_TASK_IDLE_MS: 600000` / `OAMP_TASK_NET_MS: 14400000`；`loadConfig()` 返回对象增 `taskIdleMs` / `taskNetMs`（经既有 `readPositiveInt`）。**不新增**配置文件键（只 env，与 `OAMP_WEB_RECONCILE_*` 先例同形）。
- **文件/锚点**: `oamp/src/config.js:24-28`（`NUMERIC_DEFAULTS`）、`:34-43`（`readPositiveInt`，**不改**）、`:136-163`（`loadConfig`，返回对象起于 `:143`）。
- **步骤**:
  1. `NUMERIC_DEFAULTS` 增两行（默认 `600000` / `14400000`）。
  2. `loadConfig()` 返回对象增 `taskIdleMs: readPositiveInt('OAMP_TASK_IDLE_MS', env)` 与 `taskNetMs: readPositiveInt('OAMP_TASK_NET_MS', env)`；位置紧随 `reconnectMaxMs`，注释引用 `architecture §4 A-05` 与"env 的存在理由 = 验收 5 可调 + 阶段 5/6 压缩时间轴取证（先例 `OAMP_WEB_RECONCILE_*`）"。
  3. **不改** `readPositiveInt` 本身、不改任何既有键的取值链（env > 配置文件 > 内置默认）。
- **验收判据（可执行；脚本见 §4 R1）**:
  1. 清空两 env 后 `loadConfig({...})` ⇒ `taskIdleMs === 600000` **且** `taskNetMs === 14400000`（严格相等）。
  2. `OAMP_TASK_IDLE_MS` ∈ {`'abc'`, `'0'`, `'-1'`, `'2.5'`, `''`} ⇒ **抛错**，消息含 `OAMP_TASK_IDLE_MS 需为正整数`；`OAMP_TASK_NET_MS` 同法逐值抛错（**不得**静默回落默认值）。
  3. `OAMP_TASK_IDLE_MS=2000` / `OAMP_TASK_NET_MS=9000` ⇒ 返回值恰为 `2000` / `9000`（压缩可用）。
  4. 既有键取值不变：`socketPath` / `heartbeatIntervalMs` / `heartbeatIdleMs` / `reconnect` / `dbPath` / `defaultModel` / `contextMax` / `protocol` / `approval` 在同 env 下与改动前逐键相等（同进程对照或与 `9f071b8` 版本对读）。
  5. `git diff --stat` 只含 `oamp/src/config.js` 一个路径。
- **追溯**: A-05「阈值配置面位置」（键名/env 名/默认值/`readPositiveInt` 校验逐字）；PR 验收 1；F05 验收 5（D-27/D-28"初始取值，可调"）；机制先例 = `web.js:76-79` 的 `OAMP_WEB_RECONCILE_*` 注释"测试用 env 压缩时间轴"。
- **前置依赖**: 无　**优先级**: P0

---

### T2: `oamp/src/rpc-client.js` —— turn timer 改 `idle` + `net` 双计时（含门挂起同冻结）

- **服务哪条 AC**: PR **AC2/AC3/AC4/AC5/AC6**；F05 验收 1/2/3/4/6
- **描述**: 把 `active` 的**单计时器**（`timer` + `remainingMs`/`deadline`）改为按 C1 的三分支：显式 `timeoutMs` ⇒ 旧单计时器逐字保留；缺省 + 正整数 `idleMs`/`netMs` ⇒ 两个独立计时器（`idleTimer` 每个进展事件重臂、`netTimer` 只在轮次开始时臂一次）；三缺失 ⇒ 无计时器。门挂起时**两个计时器同冻结**、按各自剩余量恢复。
- **文件/锚点**: `oamp/src/rpc-client.js:14`（删 `DEFAULT_TURN_TIMEOUT_MS`）、`:198-227`（`clear/arm/freeze/thaw`）、`:244-252`（`onTurnTimeout`）、`:254-258`（`emitDelta`）、`:309/318`（两处 `emitDelta` 调用点）、`:584-602`（`prompt` 参数与 `active` 形状）、`:351/365`、`:403/415`（门 freeze/thaw 调用点，**不改位置**）。
- **步骤**:
  1. `prompt` 签名改 `{ timeoutMs = null, idleMs = null, netMs = null, onDelta = null }`（**删除** `= DEFAULT_TURN_TIMEOUT_MS`）；`active` 增 `idleMs`/`netMs`/`idleTimer`/`netTimer`/`idleDeadline`/`netDeadline` 与冻结期的 `idleRemainingMs`/`netRemainingMs`。
  2. `armTurnTimer(active)` 按 C1 分支二/三武装（**三分支判定只看 `timeoutMs` 与两阈值是否为正整数**，禁止把 `null` 当 0）。
  3. `emitDelta(active, payload)` 首行重置 `idle` 计时（**唯一闸口** ⇒ 两个调用点无需各自改动）。
  4. `clearTurnTimer` 清三个计时器；`freezeTurnTimer`/`thawTurnTimer` 覆盖两个计时器且保留既有深度语义与"按剩余量恢复"口径。
  5. `onTurnTimeout(active, kind, ms)` 按 C1 第 6 条生成报文，并在 `ProtocolError` 实例上附 `timeoutMs = ms`。
  6. 保持既有收尾顺序（`abort` 幂等 → `delay(CANCEL_GRACE_MS)` → `kill()` → `failTurn`）与 `turn !== active` 幂等判据**逐字不变**（F12：这是宽限期内终态帧优先结算的既有语义，不得改动）。
- **验收判据（可执行；配方 §4 R2/R3/R5，桩见 §4.2）**:
  1. **进展不判死**：桩每 `GAP` 发一片 `text_delta`、`idle=1500`/`net=20000`、持续 6 s ⇒ 轮次 **resolve**（不抛 `timeout`）。
  2. **idle 判死**：桩发首片后静默、`idle=1500`/`net=20000` ⇒ 抛 `ProtocolError`，`code === 'timeout'`、`message === '轮次空闲超时（空闲 1500ms）'`、`err.timeoutMs === 1500`；墙钟 ≈ `idle + 2000 ms`（宽限）。
  3. **net 判死（独立生效）**：桩持续发片（`GAP=300`）、`idle=1500`/`net=4000` ⇒ 抛 `code='timeout'`、`message === '轮次安全网超时（累计 4000ms）'`、`err.timeoutMs === 4000`；且**在 idle 被持续喂饱的前提下**发生。
  4. **显式档逐字不变**：`{timeoutMs: 1200}`（`idleMs`/`netMs` 任取或缺失）⇒ `message === '轮次超时（1200ms）'`、`err.timeoutMs === 1200`，与改动前同值。
  5. **无缺省档**：`{}`（三值皆缺）⇒ **不武装计时器**：桩静默 5 s 后该轮仍**未结算**（`Promise` 仍 pending），且**不得**出现 `超时（nullms）`。
  6. **门挂起同冻结**：`idle=1200`/`net=3000`，`host_tool_call`（`ask_user`）经 `hooks.onQuestionRequest` 挂起 **4000 ms** 后作答 ⇒ 轮次正常 resolve，墙钟 ≥ 4000 ms，无 `timeout`（F14）。
  7. **不新增面**：`git diff` 面仅本文件；无新帧类型、无新错误码（`PROTOCOL_ERROR_CODES` 未改）。
- **追溯**: A-05「计时落点」（3 客户端 turn timer 改双计时，同一实现处）+ §3.3 第 2/5/6 条；MI-7（进展信号口径）/MI-8（计时起点）；PR 验收 2/3/4/5/6；F05 验收 1/2/3/4/6；L2-04（判据落执行侧）。
- **前置依赖**: 无（客户端契约 C1 已冻结）　**优先级**: P0

---

### T3: `oamp/src/acp-client.js` —— `_request` 计时器改 `idle` + `net` 双计时（含两个门同冻结）

- **服务哪条 AC**: 同 T2（acp 协议面）；F05 验收 1/2/3/4/6
- **描述**: 对 `session/prompt` 这一**请求级**计时器（`_pending` 中的 `entry`）实施 C1 契约；`timeoutMs` 显式时保持今日行为；`idle`/`net` 生效时两计时器独立，`_chunkHandler` 每片重置 `idle`；`_pauseTurnTimer`/`_resumeTurnTimer` 覆盖两者。
- **文件/锚点**: `oamp/src/acp-client.js:319-352`（`prompt` 签名与 `_request` 调用）、`:425-443`（`_request` 的 arm/expire）、`:329-336`（`_chunkHandler` → `onDelta`）、`:510-531`（`_handleSessionUpdate`，见 MI-P4）、`:637-643` / `:717-723`（两次 `_pauseTurnTimer()`）、`:756-783`（两个 freeze/thaw 函数）。
- **步骤**:
  1. `prompt` 签名改 `{ model = null, timeoutMs = null, idleMs = null, netMs = null, onDelta = null }`，并把三值透传给 `_request`（**不得**让 `null` 落进 `_request` 的 `timeoutMs = REQUEST_TIMEOUT_MS` 默认档 —— 实测该默认档会让 `null` 变成 **1 ms 判死**，F10）。
  2. `_request` 对"带双阈值的轮次请求"武装 `entry.idleTimer`/`entry.netTimer`；`expire` 改为 `expire(kind, ms)`，按 C1 第 6 条生成报文并在 `ProtocolError` 上附 `timeoutMs`；`onTimeout` 收尾（`cancel()` → `delay(CANCEL_GRACE_MS)` → `kill()`）**逐字不变**。
  3. `_chunkHandler` 内每片重置 `idle`；`_handleSessionUpdate`（`tool_call` / `tool_call_update`）亦重置 `idle`（**MI-P4**；若主 agent 否证该口径则删除此重置，其余判据不变）。
  4. `_pauseTurnTimer`/`_resumeTurnTimer` 覆盖两个计时器（冻结记各自剩余量、恢复按剩余量），保留既有 `entry.paused` / `_pausedTurns` 深度语义与"跨轮残留恢复不得给未冻结轮次装计时器"的防护。
  5. 保持 `initialize` / `session/new` / `set_config_option` 的请求计时（`REQUEST_TIMEOUT_MS`）**零改动**。
- **验收判据（可执行；配方 §4 R2/R3/R5，桩见 §4.3）**:
  1. 进展不判死 / 2. idle 判死（`message === 'session/prompt 超时（<idleMs>ms）'`？**否**：idle/net 触发一律走 C1 第 6 条的两条**新报文**；`err.timeoutMs === <触发阈值>`）/ 3. net 判死 —— 现象判据与 T2 判据 1/2/3 同形（协议换成 acp 桩）。
  4. **显式档逐字不变**：`{timeoutMs: 1200}` ⇒ `message === 'session/prompt 超时（1200ms）'`（既有文案逐字）。
  5. **无缺省档**：`{}` ⇒ 不武装任何计时器；桩静默 5 s 时该轮仍 pending，**不得**出现 `超时（nullms）`（F10 回归守卫）。
  6. **两个门同冻结**：`session/request_permission`（`onPermissionRequest` 返回未结算 Promise）挂起 > `net` ⇒ 轮次正常结算；`elicitation/create`（`onQuestionRequest`）同法各一条。
  7. **工具事件重置 idle（MI-P4）**：桩只发 `session/update{tool_call*}`（无 `agent_message_chunk`）、周期 < `idleMs`、总时长 > `idleMs` ⇒ 轮次**不被 idle 判死**（negative control：把该重置移除后同场景应判死）。
  8. `git diff` 面仅本文件。
- **追溯**: A-05「计时落点」+ §3.3 第 2 条（三客户端各一份同构实现）；PR 验收 2/3/4/5/6；F05 验收 1/2/3/4/6；MI-7/MI-8；MI-P4 见 §5.1。
- **前置依赖**: 无　**优先级**: P0

---

### T4: `oamp/src/oneshot-client.js` —— 单计时器改 `idle` + `net` 双计时（无门面）

- **服务哪条 AC**: 同 T2（一次性执行面）；F05 验收 1/2/3/4
- **描述**: 对 `prompt` 内建的 `setTimeout(…, timeoutMs)` 实施 C1；`idle` 由 `emitLine`（stdout/stderr 每行 + `truncated` 条目）重置；**无门 ⇒ 无冻结面**（能力位 `approvalGate: 'no'`，F4）。
- **文件/锚点**: `oamp/src/oneshot-client.js:17`（删 `DEFAULT_TIMEOUT_MS`）、`:107-108`（`prompt` 签名）、`:132-161`（计时器与收尾）、`:163-178`（`emitLine`，含 `truncated` 分支）、`:185-191`（`close` 回调里的超时分支）。
- **步骤**:
  1. `prompt` 签名改 `{ model = null, timeoutMs = null, idleMs = null, netMs = null, onDelta = null }`。
  2. 三分支武装（C1 第 2 条；三缺失 ⇒ 无计时器；**禁止** `null ⇒ 0ms`）。触发时保留既有 `SIGTERM → KILL_GRACE_MS → SIGKILL` 收尾与 `timedOut` 标记口径。
  3. `emitLine` 每行（含 `truncated` 条目）重置 `idle`；`finish` 清全部计时器。
  4. `close` 回调的超时分支改按触发类型生成报文（C1 第 6 条），并在错误上附 `timeoutMs`。
- **验收判据（可执行；配方 §4 R2/R3，桩见 §4.4）**:
  1. 进展不判死：桩每 `GAP` 打印一行、`idle=1500`/`net=20000`、总 6 s ⇒ 轮次 resolve（`text` 为行累积）。
  2. idle 判死：桩打印一行后静默、`idle=1500` ⇒ 抛 `code='timeout'`、`message === '轮次空闲超时（空闲 1500ms）'`、`err.timeoutMs === 1500`；墙钟 ≈ `idleMs`（**无宽限**）。
  3. net 判死：持续打印（`GAP=300`）、`idle=1500`/`net=4000` ⇒ `message === '轮次安全网超时（累计 4000ms）'`、`err.timeoutMs === 4000`。
  4. 显式档逐字不变：`{timeoutMs: 1200}`（静默桩）⇒ 判死 ≈1.2 s、`message === '一次性执行超时（1200ms）'`（F15）。
  5. 无缺省档：`{}` ⇒ 无计时器（静默 5 s 仍 pending；**不得**出现 `一次性执行超时（nullms）`，F10 回归守卫）。
  6. `stderr` 行与 `truncated` 条目同样重置 `idle`（各一条负例：只发 stderr / 只触发 truncated 的场景不得被 idle 判死）。
  7. `git diff` 面仅本文件。
- **追溯**: A-05「计时落点」（三实现之一）；PR 验收 2/3/4/5；F05 验收 1/2/3/4；MI-7（`stdout` 行 / `truncated` 明确在信号集内）。
- **前置依赖**: 无　**优先级**: P0

---

### T5: `oamp/src/agent.js` —— 缺省档移除 + 两路 LLM 接线 + 超时失败文本参数化

- **服务哪条 AC**: PR **AC2/AC5/AC7**；F05 验收 1/2/3/7
- **描述**: ① 删除 `DEFAULT_OMP_TIMEOUT_MS`（LLM 两路未给 `timeout_ms` ⇒ `timeoutMs: null`，显式值校验逐字不变）；② 两路 LLM `prompt` 传 `{timeoutMs: task.timeoutMs, idleMs, netMs}`（阈值真源 = T1 的 `config.taskIdleMs`/`taskNetMs`，经 `taskCtx` 传入）；③ one-shot 失败体 `error` 保持 `timeout_after_<触发阈值>ms`；daemon 失败体零改动。接线写法**依 T0 裁决**（候选 A/B/C）。
- **文件/锚点**: `agent.js:30-32`（常量）、`:91-93` / `:115-117`（两处回落+校验）、`:140-144`（shell，**不改**）、`:202-205`（one-shot 调用）、`:220-221`（one-shot 失败体）、`:365-367`（daemon 调用）、`:389-401`（daemon 失败体，**不改**）、`:749-771`（`taskCtx` 装配，增两键）。
- **步骤**:
  1. `parseTaskBody` 两处：`const timeoutMs = body.timeout_ms === undefined ? null : body.timeout_ms;`，校验改为"仅当非 `null` 时校验"（**保持**同一拒绝文案与 `MAX_TIMEOUT_MS`）。删除 `DEFAULT_OMP_TIMEOUT_MS` 常量及其两处引用。
  2. `taskCtx` 增 `taskIdleMs: config.taskIdleMs, taskNetMs: config.taskNetMs`（`config` 已在 `agent.js:663` 经 `loadConfig` 取得）。
  3. 两路 LLM 调用传 `idleMs`/`netMs`；按 **T0 裁决** 决定 daemon 路径的透传落点（候选 A：`context-pool.js` 三行透传；B：客户端自读 config；C：resident spec + `protocol.js`）。
  4. one-shot 失败体：`error: \`timeout_after_${err.timeoutMs ?? task.timeoutMs}ms\``（`timed_out: true` 与其余键不变）。
  5. **不触碰**：`runShellTask` 全部计时与文案、`MAX_TIMEOUT_MS` 校验、daemon 失败体形状、`logger.event` 的既有字段。
- **验收判据（可执行；配方 §4 R2/R3/R4/R6）**:
  1. **缺省档移除（静态）**：`grep -n "DEFAULT_OMP_TIMEOUT_MS" oamp/src/agent.js` **零命中**；`grep -rn "1800000" oamp/src/{agent,acp-client,rpc-client,oneshot-client}.js` 的命中**只剩** `MAX_TIMEOUT_MS = 1800000`（`agent.js`）一处（三客户端零命中）。
  2. **压缩阈值真被采用（动态）**：`OAMP_TASK_IDLE_MS=1500` 下，一条**不带** `timeout_ms` 的 `omp-daemon` 任务在桩静默后 ≈1.5 s(+宽限) 判死（**不是** 30 分钟、**不是**瞬时）⇒ 阈值真源 = config。
  3. **不传 `timeout_ms` 的 LLM 任务不被 `1800000` 截断**：同一条任务在 `idle=1500`/`net=20000` + 持续进展 6 s 的桩下 `state='completed'`（判据 2 与 3 合起来排除"仍按旧上限截断"与"立即判死"两种残留，§4.9 给出压缩等价论证）。
  4. **显式 `timeout_ms` 逐字不变**：`{"executor":"omp","prompt":"x","timeout_ms":1200}` ⇒ 失败体 `error === 'timeout_after_1200ms'`、`timed_out === true`（F15）；`timeout_ms=1800001` ⇒ agent **拒绝**该任务（`ack rejected`，任务不进入 `working`），拒绝文案源码**逐字未改**（`timeout_ms 需为 1~600000 正整数`）。
  5. **daemon 面承载（零改动验证）**：idle 触发 ⇒ `task.result = {state:'failed', error:'timeout', text:'轮次空闲超时（空闲 1500ms）', …}`；net 触发 ⇒ `text:'轮次安全网超时（累计 4000ms）'`（F16）。
  6. **one-shot 面承载**：idle ⇒ `error:'timeout_after_1500ms'`；net ⇒ `error:'timeout_after_4000ms'`（两串不同 ⇒ 可区分；两条都经 `reasonOf` 归 `timeout`，F13）。
  7. **`shell` 语义不变**：`{"command":"sleep","args":["0.2"]}`（无 `timeout_ms`）⇒ `completed`；`{"command":"sleep","args":["3"],"timeout_ms":1000}` ⇒ `{state:'failed', error:'timeout_after_1000ms', timed_out:true}`；`DEFAULT_TASK_TIMEOUT_MS = 30000` 三处引用零改动（`git diff` 核对）。
  8. `git diff --stat` 面 = PR 文件范围 5 个文件（+ T0 候选 A 时的第 6 个 `context-pool.js`），无其它路径。
- **追溯**: A-05 生效位置清单第 1/2/3/4/5/7 条与「显式 `timeout_ms` 的边界裁决」；A-04 裁决 1 表第 7/8 行 + 裁决 2（产生点零改写 ⇒ 只换参数来源）；§3.3 第 5/6 条；PR 验收 2/3/4/5/7；F05 验收 1/2/3/4/7；L2-09。
- **前置依赖**: **T0（裁决）** + T1 + T2 + T4（+ T3，若验收覆盖 acp 协议面）　**优先级**: P0

---

### T6: 集成取证与残留核对（压缩时间轴端到端 + 门冻结回归 + `reason` 归类 + 生效位置清单 1~8）

- **服务哪条 AC**: PR 全部 7 条（**唯一承载"端到端可观测"的取证任务**）；F05 验收 1~7；G01 验收 2/3 在本 PR 的落点
- **描述**: 用 §4 的压缩配方跑**端到端**（真 Router + 真 agent + 真客户端 + 桩 omp），产出可复核的证据原文，并完成"生效位置清单 1~8"的**残留核对**与**零改动封闭性**核对。**零源码改动**（只跑脚本 + 只读命令）。
- **文件/锚点**: 产 `/tmp/0030-pr-004/{e2e.mjs,fake-oneshot.mjs,fake-rpc.mjs,fake-acp.mjs,freeze.mjs,*.out}`；只读 `oamp/src/**`、`git status/diff`。
- **步骤**:
  1. 写桩与驱动器（§4.2~§4.5 骨架）；**独立于 dev 的 T2~T5 实现**（桩按 §5.4 帧面自行实现，不读实现代码的私有函数）。
  2. 跑 R2（one-shot 三场景 O1/O2/O3）与 R3（daemon 三场景 D1/D2/D3），原始 stdout 落 `*.out`。
  3. 跑 R4（显式档 + 校验拒绝）、R5（门冻结，rpc 与 acp 各一条）、R6（`null` 三客户端回归守卫）。
  4. 跑 R7（`reasonOf` 归类核对，迭代分支的 `reason.js` 只读 import）。
  5. 跑 R8（生效位置清单 1~8 残留 grep + 改动面封闭性）。
- **验收判据（可执行）**:
  1. `R2.out` / `R3.out` 六场景逐条 `PASS`，且每条含**期望 ⇒ 实际**（state / error 或 text / 墙钟）；`FAIL` 行数 = 0。
  2. **两触发可区分**：同一路径上 idle 与 net 两条失败文本**互不相同**且各自可追溯阈值（F16）。
  3. `R5.out` 证明门挂起期间两计时器同冻结（挂起时长 > `net` 仍正常结算，F14）。
  4. `R6.out` 证明三客户端在 `{}`（三值皆缺）下不判死、不出现 `nullms` 报文。
  5. `R7.out` 证明本 PR 产出的每条 `error` 串 `reasonOf('failed', e) === 'timeout'`。
  6. `R8.out` 逐条覆盖生效位置清单 1~8（第 1~4 条：默认档已消除；第 5/7/8 条：保留面零改动；第 6 条：`config.taskNetMs` 存在且**登记为 pr-005 的消费项**，本 PR 不声称对账链路已通 —— 那是 pr-005 的验收面）。
  7. 改动面：`git status --short` 只出现 5 个（T0 候选 A 时 6 个）`M` 文件，无新增文件；`oamp/package.json` 未改。
- **追溯**: PR「上下文摘要」（判死走既有失败收口；`reason` 归类与信封分别由 pr-001/pr-005 承担 ⇒ 本 PR 只证"失败体形状可归类"）；A-05 第 5/6/7 条；F05 验收 6/7；§9-6/§9-7（客户端等待预算与显式上限的**保留面**，本 PR 不越界声称）。
- **前置依赖**: T1、T2、T3、T4、T5　**优先级**: P1

---

## 2. 依赖图

```
T0（裁决，非 dev 任务）───┐
                          ▼
T1 ──┐                    │
T2 ──┼──> T5 ──> T6       │
T3 ──┤                    │
T4 ──┘                    │
```

边（逐条，均为真实约束；共 6 条）：
- `T1 → T5`：`taskCtx` 要注入 `config.taskIdleMs`/`taskNetMs`，键不存在则接线无真源。
- `T2 → T5`、`T4 → T5`、`T3 → T5`：`agent.js` 传 `{idleMs, netMs}` 的前提是客户端**接受并处理**该选项（客户端未改前传入的选项被静默忽略 ⇒ 得到"无计时器"或 `nullms` 判死，F11）。
- `T0 → T5`：daemon 路径的投送落点由该裁决决定（只影响 T5 的写法与文件集合，不影响 T1~T4）。
- `T5 → T6`：端到端取证的对象是接线后的 agent（未接线则只有客户端级证据，AC2/AC3/AC5 的"端到端"面无法判定）。
- （隐式）`T1..T5 → T6`：T6 是五者的集成证据生产者。

**无环**：全部边方向为 `{T0,T1,T2,T3,T4} → T5 → T6`，拓扑序 `T0/T1/T2/T3/T4 < T5 < T6` 满足所有边；不存在回到已访问节点的路径（T1~T4 之间**无依赖** ⇒ 四个任务相互独立，可乱序/并行）。

**最长依赖链（本 PR 内部关键路径）**：`T1 → T5 → T6`（3 节点）；考虑客户端就绪前置则为 `T2 → T5 → T6`（同为 3 节点）。
**关键路径任务**：**T1/T2/T3/T4**（两条并行分支的生产者，任一未完成则 T5 无法开工）→ **T5**（接线与缺省档移除的唯一生产者）→ **T6**（证据的唯一生产者）。

---

## 3. 执行顺序与增量策略

**推荐顺序**：`T1 → T2 → T3 → T4 → T5 → T6`（T1~T4 之间无依赖，可按会话节奏调整；T5 必须在 T1~T4 之后；T6 最后）。
**T0 必须在 T5 开工前裁决**（T1~T4 不受影响，可先做）。

| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | `config.js` 两键 + env | R1（判据 1~5） |
| 2 | `rpc-client.js` 双计时 | §T2 判据 1~7（R2/R3/R5 的 rpc 面） |
| 3 | `acp-client.js` 双计时 | §T3 判据 1~8（R2/R3/R5 的 acp 面） |
| 4 | `oneshot-client.js` 双计时 | §T4 判据 1~7（R2/R3 的 one-shot 面） |
| 5 | `agent.js` 缺省档移除 + 接线（+ T0 决定的第 6 文件） | §T5 判据 1~8（R2/R3/R4/R6） |
| 6 | 端到端证据原文 + 残留核对 | §T6 判据 1~7（R2~R8） |

**若单次调用未跑完**：在**任务边界**停下（不得把"改了一半的客户端"与"已改的 agent"留给下一次；T5 尤其不得只改一半分支）。

---

## 4. 验证配方（**禁止新增测试文件**；全部为一次性脚本与只读命令，落 `/tmp/0030-pr-004/`）

> 下述配方的**可执行性已由 planner 演练确认**（F9~F16）：桩可确定性编排、压缩阈值真实生效、判死时刻可预测、两触发文本可区分、门冻结可判定。演练副本在 `/tmp/pr004-reh/`（planner 产物，**可读作参照，但不构成 dev 的交付依赖**；dev 须在 `/tmp/0030-pr-004/` 自建自证）。

### 4.1 R1 · 配置面（T1 判据 1~4）

```bash
mkdir -p /tmp/0030-pr-004 && WT=<PR worktree 绝对路径>
cat > /tmp/0030-pr-004/config-probe.mjs <<'EOF'
const { loadConfig } = await import(`${process.env.WT}/oamp/src/config.js`);
const base = { ...process.env }; for (const k of ['OAMP_TASK_IDLE_MS','OAMP_TASK_NET_MS']) delete base[k];
const d = loadConfig(base);
console.log('defaults', d.taskIdleMs, d.taskNetMs, d.taskIdleMs === 600000 && d.taskNetMs === 14400000 ? 'PASS' : 'FAIL');
const c = loadConfig({ ...base, OAMP_TASK_IDLE_MS: '2000', OAMP_TASK_NET_MS: '9000' });
console.log('compressed', c.taskIdleMs, c.taskNetMs, c.taskIdleMs === 2000 && c.taskNetMs === 9000 ? 'PASS' : 'FAIL');
for (const v of ['abc','0','-1','2.5','']) {
  let line = 'FAIL(未抛错)';
  try { loadConfig({ ...base, OAMP_TASK_IDLE_MS: v }); }
  catch (e) { line = /OAMP_TASK_IDLE_MS 需为正整数/.test(e.message) ? 'PASS' : `FAIL(${e.message})`; }
  console.log('invalid', JSON.stringify(v), line);
}
EOF
WT=$WT node /tmp/0030-pr-004/config-probe.mjs | tee /tmp/0030-pr-004/R1.out
```
**演练实测基准**：`defaults 600000 14400000 PASS`、`compressed 2000 9000 PASS`、五个非法值全部 `PASS`（消息 `OAMP 配置错误: OAMP_TASK_IDLE_MS 需为正整数（当前值 "abc"）`）。

### 4.2 R2/R3 · 端到端压缩配方（T5 判据 2/3/4/5/6、T6 判据 1~3）

**桩**（两个；`#!/usr/bin/env node` + `chmod +x`，经 `OAMP_OMP_BIN` 注入）：

- `fake-oneshot.mjs`（`omp -p <prompt>` 形态）：按 `FAKE_GAP_MS` 间隔向 stdout 打印 `FAKE_LINES` 行，随后按 `FAKE_TAIL_HOLD_MS` 保持静默后 `exit 0`。
- `fake-rpc.mjs`（`omp --mode rpc` 形态，帧面取 `rpc-client.js` 的 `handleFrame` 分支）：
  1. 启动即发 `{"type":"ready","protocolVersion":2}`；
  2. 收 `negotiate_protocol` ⇒ 回 `{"type":"response","command":"negotiate_protocol","success":true,"data":{"protocolVersion":2}}`；
  3. 收 `prompt` ⇒ 回 `{"type":"response","command":"prompt","success":true}`，随后按模式：`progress` 每 `GAP` 发 `{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"x"}}`，共 `LINES` 片后发 `{"type":"agent_end","isTerminal":true,"messages":[{"role":"assistant","stopReason":"end_turn"}]}`；`stall` 发首片后永久静默；`noisy` 持续发片、永不发终态帧；`gate` 发 `{"type":"host_tool_call","id":1,"toolName":"ask_user","arguments":{"question":"q?","options":["a","b"]}}` 等回包；
  4. 收 `abort` ⇒ **保持静默**（**F12 强制要求**：若在宽限内退出或发终态帧，该轮会按 `context_crashed` 或 `completed` 结算，证据作废）。

**驱动器**（`e2e.mjs`）：`mkdtemp` → 以 env `{OAMP_SOCKET, OAMP_DB, OAMP_TASK_IDLE_MS, OAMP_TASK_NET_MS, OAMP_OMP_BIN}` 起 `node bin/oamp.js router start` 与 `agent start dev-1` → 等 socket → `task send dev-1 '<spec>'` 取 `task_id` → 轮询 `router.task_get`（`RpcPeer`，见 `task.js:40-47` 的 `queryOnce` 同形）至终态 → 打印 `{state, elapsed_ms, updates, result}` 原文。

| 场景 | 执行器 | 桩模式 | `IDLE` / `NET` | 期望（**演练实测**） |
|---|---|---|---|---|
| **O1** | `omp` | 每 300 ms 一行 ×20 | 1500 / 20000 | `completed`，墙钟 ≈6.2 s（**进展不判死**） |
| **O2** | `omp` | 一行后静默 | 1500 / 20000 | `failed`，`error='timeout_after_1500ms'`，`timed_out:true`，≈1.6 s |
| **O3** | `omp` | 每 300 ms 一行 ×40 | 1500 / 4000 | `failed`，`error='timeout_after_4000ms'`，≈4.0 s（**net 独立生效**） |
| **D1** | `omp-daemon` | `progress`（300 ms ×20） | 1500 / 20000 | `completed`，≈6.0 s |
| **D2** | `omp-daemon` | `stall` | 1500 / 20000 | `failed`，`error='timeout'`，`text='轮次空闲超时（空闲 1500ms）'`，≈3.6 s（=1.5+2.0 宽限） |
| **D3** | `omp-daemon` | `noisy`（300 ms，永不终态） | 1500 / 4000 | `failed`，`error='timeout'`，`text='轮次安全网超时（累计 4000ms）'`，≈6.0 s（=4.0+2.0） |
| **O4 / R4** | `omp` | 一行后静默 | 600000 / 14400000 | 显式 `timeout_ms=1200` ⇒ `error='timeout_after_1200ms'`，≈1.2 s（**旧语义逐字不变**） |

> `R2.out` = O1/O2/O3/O4，`R3.out` = D1/D2/D3；均须 `FAIL 行数 = 0`。

### 4.3 R5 · 门挂起冻结（T2 判据 6、T3 判据 6）

客户端级直接驱动（不起 Router）：`createRpcSession({resident, hooks:{onQuestionRequest}})` + `gate` 桩，`idle=1200`/`net=3000`、挂起 `HOLD=4000 ms`（**故意越过两个阈值**）⇒ 期望本轮**正常 resolve**、墙钟 ≥4000 ms、无 `timeout`（**演练实测：4.00 s、`text='answered'`**）。acp 面同法用 `session/request_permission` 桩 + `onPermissionRequest` 挂起。

### 4.4 R6 · `null` 回归守卫（T2/T3/T4 判据 5、T6 判据 4）

对三客户端各跑一次 `prompt(text, {})`（三值皆缺）⇒ 静默桩下 5 s 后该轮**仍 pending**（驱动器用 `Promise.race` + 超时打印 `pending`），且输出中**不得**出现 `nullms`。
**改动前基线（演练实测，证明这是真风险）**：原始客户端在 `{timeoutMs: null}` 下 —— acp `session/prompt 超时（nullms）`@1 ms；one-shot `一次性执行超时（nullms）`@3 ms；rpc `轮次超时（nullms）`@2003 ms。

### 4.5 R7 · `reason` 归类核对（T6 判据 5）

```bash
# 在迭代分支（含 pr-001 的 reason.js）上只读执行
node --input-type=module -e "
import { reasonOf } from '<迭代工作区>/oamp/src/reason.js';
for (const e of ['timeout','timeout_after_1500ms','timeout_after_4000ms','timeout_after_1200ms']) console.log(e, reasonOf('failed', e));
"
```
**期望**：全部 `timeout`（**演练实测**）。同时记录**反例**：`轮次空闲超时（空闲 1500ms）` ⇒ `agent_error`（**禁止**该串进入 `error` 字段的判据来源）。

### 4.6 R8 · 生效位置清单 1~8 残留核对（T6 判据 6/7）

```bash
cd $WT
{
  echo "== 清单1：agent.js 默认档（须零命中）=="; grep -n "DEFAULT_OMP_TIMEOUT_MS" oamp/src/agent.js || echo "(无)"
  echo "== 清单2/3/4：三客户端默认档（须零命中）=="
  grep -n "1800000\|DEFAULT_TURN_TIMEOUT_MS\|DEFAULT_TIMEOUT_MS" oamp/src/{acp-client,rpc-client,oneshot-client}.js || echo "(无)"
  echo "== 清单5：MAX_TIMEOUT_MS 保留（须 1 命中）=="; grep -n "MAX_TIMEOUT_MS = 1800000" oamp/src/agent.js
  echo "== 清单6：config.taskNetMs 存在（pr-005 消费项）=="; grep -n "taskNetMs" oamp/src/config.js
  echo "== 清单7：shell 默认 30s 保留 =="; grep -n "DEFAULT_TASK_TIMEOUT_MS" oamp/src/agent.js
  echo "== 清单8：客户端等待预算零改动 =="; git diff --name-only HEAD -- oamp/sdk oamp/web | grep -v '^$' || echo "(空)"
  echo "== 改动面：" ; git status --short
} | tee /tmp/0030-pr-004/R8.out
```

### 4.7 禁止项（取证卫生）

- **不得**新增 `*.test.js`、不得新增任何仓库内文件（§0.2）；证据一律落 `/tmp/0030-pr-004/`。
- **不得**为让判据通过而放宽阈值文案（如把 `nullms` 报文当"可接受"）。
- **不得**在 `error` 字段承载 `轮次空闲超时（…）` 一类 message（F13）。

### 4.8 命令族清单（逐条，可直接复制）

`node oamp/bin/oamp.js router start`（压缩 env）｜`node oamp/bin/oamp.js agent start dev-1`（同 env + `OAMP_OMP_BIN`）｜`node oamp/bin/oamp.js task send dev-1 '<json>'`｜`node oamp/bin/oamp.js task status <task_id>`｜`router.task_get` 只读查询（`RpcPeer`，同 `task.js:40-47`）｜`grep -n` 残留核对｜`git status --short` / `git diff --stat`。

### 4.9 「累计时长超过旧 30 分钟上限不被判死」的**判据等价转换**（勘定，非放水）

真等 30 分钟在阶段 5/6 不可行。可判定的等价形态 = **两条互补判据**：
1. **静态**：旧上限的全部生效位置（清单 1~4）默认档**零残留**（`grep` 证据；`MAX_TIMEOUT_MS` 只约束显式值）⇒ "不存在按 1800000 截断的路径"。
2. **动态**：压缩轴下判死时刻**严格跟随 config 阈值**（`idle=1500` ⇒ ≈1.5 s；`net=4000` ⇒ ≈4.0 s）且持续进展的轮次跨越压缩阈值仍在跑（6 s 完成）⇒ "判据真源 = `taskIdleMs`/`taskNetMs`（而非任何固定 30 分钟）"。
两条合并即为 AC2 前半的可判定形态；**不得**以"跑了 6 秒没被杀"单独声称"超过 30 分钟不被杀"。

---

## 5. 边界、已知风险与 `[model_inferred]` 清单

### 5.1 `[model_inferred]`（**留待主 agent 确认，本文件不自行生效**）

- **MI-P1 · one-shot 面"两种触发可区分"的最小承载形态**：A-05 第 6 条把 shell / one-shot 的承载写作"既有失败路径的 `error`（参数化串）"，而 A-04 裁决 2 要求既有失败产生点**零改写**。本任务列表按"**保持 `timeout_after_<N>ms` 形态、`N` = 触发阈值**"落判据（形态不变 + 两触发串不同 + 经 `reasonOf` 归 `timeout`，F13/F16 实测）。若主 agent 认为需在 one-shot 面直接承载可读 message，则替代形态是 `error:'timeout'` + 新增 `text` 键（daemon 形状），但那会**触碰 A-04 裁决 2**，故本文件不自行采用。
- **MI-P2 · 三客户端"三值皆缺 ⇒ 不武装计时器"**：PR 验收 5 只写"缺省档不存在"，未写"皆缺时的行为"。本列表按字面落为"无计时器"（而非回落到任一新默认值）。依据：缺省档移除的语义 = 不再有代理默认；F10/F11 实测证明"`null` 当 0"是唯一另一种可能解释，且其后果是即时判死（与 F05 用户价值相反）。
- **MI-P3 · 报文措辞**：A-05 第 6 条给的是**示例**（"如 `轮次空闲超时（空闲 600000ms）` / `轮次安全网超时（累计 14400000ms）`"）。本列表把示例括注里的数字取为**触发阈值实参**（压缩取证时即压缩值），并把该文本同时用于三客户端 message。若主 agent 要求"默认值原样"（即报文恒写 `600000`/`14400000`），则压缩取证下的可区分性判据需改写（不推荐：报文与实参不一致会误导取证）。
- **MI-P4 · acp 的 `tool_call` 事件是否重置 `idle`**（T3 判据 7）：A-05 的进展信号集含工具事件，但 acp 实现的工具事件不流经 `onDelta`（F3）。本列表按"信号集优于 `onDelta` 通道"落为"重置"；若主 agent 否证，T3 判据 7 删除、其余判据不变。
- **MI-P5 · `err.timeoutMs` 作为内部字段**：A-05 未规定"agent 侧如何得知触发的是哪个阈值"。本列表用"客户端在抛出的 `ProtocolError` 实例上附 `timeoutMs`"（进程内字段，不上 wire、不进信封）作为 one-shot 参数化串的参数来源。替代形态是解析 message 文本（劣）或让 agent 各自记账（做不到）。

### 5.2 上报项（**主 agent 必须裁决，planner 不自行填补**）

- **⛔ T0（阻塞 T5，不阻塞 T1~T4）：`context-pool.js` 文件范围缺口**。事实链：PR 文件要求 `agent.js` 改传 `{idleMs, netMs}`（明文）→ daemon（**默认执行器**）路径的选项唯一通道是 `context-pool.js:137/144/170`（显式键集，F7）→ 该文件在 pr-004 的「文件范围」之外，且被 pr-008 声明为"本迭代零改动" → 未处理时实测后果 = `轮次安全网超时（累计 nullms）`（F11，daemon 轮次 ≈2.5 s 即判死）。**三个候选见 T0 节**；planner 建议 A（3 行透传 + pr-008 子句同步修订），但**不代为定案**。

### 5.3 已知风险（不阻塞，供 dev/verifier 知情）

1. **`null` 即时判死陷阱（最高危）**：三客户端的"移除默认档"若只删常量、不判 `null`，全部 LLM 轮次会在 **1~3 ms** 内判死（F10）。判据 §T2/T3/T4 判据 5 与 R6 即为此设的回归守卫。
2. **rpc 判死带 2000 ms 宽限**（F12）：`idle=1500` 的**终态**时刻 ≈3.6 s；证据须写"触发时刻（日志/墙钟推算）≈ 阈值"与"终态时刻 ≈ 阈值 + 宽限"，不得把两者混为一谈。且证据桩**必须**在 `abort` 后保持静默（否则得到 `context_crashed` 或 `completed` 的错误结论）。
3. **acp 的轮次增量面只有 `agent_message_chunk`**（F3）：工具执行期无 `onDelta` ⇒ **MI-P4** 未获确认时，acp 下长工具执行可能被误判空闲（默认 10 分钟阈值下影响有限，但压缩取证时会放大）。
4. **PR worktree 落后于迭代分支**（F8）：HEAD `9f071b8` 无 `reason.js`；R7 的归类核对需在**迭代分支**上只读执行（或在同步后的 PR worktree 上）。dev **不得**把 `reason.js` 复制进本 PR 的改动面。
5. **压缩阈值下的计时精度**：`FAKE_GAP_MS` 必须 ≲ `idleMs / 3`（本演练用 300 vs 1500），否则 idle 会因调度抖动误触发；同理 daemon 场景的观察窗口要覆盖 `阈值 + 宽限`。
6. **`shell` 默认 30 s 不可压缩**（A-05 清单第 7 条保留）：若要动态验证 30 s 默认档，需真跑 30 s（可接受）或只做静态核对（§T5 判据 7 已给两形态）。
7. **`mode:block` 不可绕**（F05 验收 7）：本 PR 的判据落在**执行侧**统一实现处，`block` 与 `background` 同源由构造保证（A-05 第 3 条）；本 PR **不得**声称"两条形态各自实测"——那是 web 侧（pr-005）的面。

---

## 6. 粒度决策说明（非显然决策，记录依据）

- **三客户端拆为 T2/T3/T4（而非合并一个"改三处"任务）**：三者的失败模式与证据载体都不同 —— rpc 面是"请求/帧流 + `freezeTurnTimer` 深度语义 + 2000 ms 宽限"；acp 面是"请求级计时器 `entry` + `_pausedTurns` 深度 + 工具事件不经 `onDelta`（MI-P4）"；oneshot 面是"行流 + 无门面 + 无宽限"。拆开后每个任务可**独立验收**（各自的桩与探针），且三者**并行独立**（无相互依赖）。防漂移机制 = §0.4 的 C1 契约（三份实现同形判据表）。
- **T1 独立成任务**：配置面是 T5 的**真源**且自身零风险（纯新增键 + 既有校验复用），单独成任务使"键名/env/默认值/非法值"四项可在 T5 开工前先冻结（也是 pr-005 的接缝）。
- **T5 不再细分**（例如"缺省档移除"与"失败文本参数化"各一任务）：两者共用同一批调用点与同一份端到端证据（R2/R3/R4），拆开会导致第二次验收必须重跑第一次的全部场景 ⇒ 独立验收价值不成立。
- **T6 单独成任务的依据**：PR 验收的 7 条中，AC2/AC3/AC5/AC7 的"端到端"面（真 Router + 真 agent + 真客户端 + 压缩阈值）**不是** T1~T5 任一条判据的子集；且"生效位置清单 1~8 的残留核对""改动面封闭性""`reason` 归类核对"三项只在集成层可得。T6 的产出（`R*.out` 原文）是阶段 6 verifier 的输入。
- **不设"改动前基线"任务**：本 PR 的改动前后对比对象（既有 30 分钟上限、既有失败体形状）已由 §0.3 的代码事实锚点与 F10/F15 的实测基线固定；再做一份基线快照属重复劳动。
- **不设"文档同步"任务**：`API.md` / `README.md` / `llms.txt` / `skill/hub.md` 属 **pr-006**（其「文件范围」逐字列四者），本 PR 写文档即越界。

---

## 7. 执行证据（dev 回填）

> 本段由 pr-004 的 dev 在执行过程中**原文回填**（原始命令、原始 stdout/stderr、退出码；逐任务对齐 §1 的判据编号）。**不得**改写判据、不得只写结论。
> 建议分段：`T1 / T2 / T3 / T4 / T5 / T6`，每段含：命令原文 → 原始输出 → 对照判据编号的 PASS/FAIL 判定 → 偏差说明（若有）。
> verifier 的独立报告落 `clarifications/verify-<ts>-pr-004.md` + `roles/verifier/data/`，**不回填**本段。

（待回填）

## 5. dev 执行证据（2026-09-12，openai/gpt-5.6-luna）

- R1 `/tmp/0030-pr-004/R1.out`：默认 `600000 14400000 PASS`；压缩 `2000 9000 PASS`；`abc/0/-1/2.5/""` 五个非法值均 `PASS`。
- R2/R3 客户端桩证据：`/tmp/0030-pr-004/R2-client.out`、`R3-rpc.out`、`R3-acp.out`。one-shot idle/net 分别报 `一次性执行空闲超时（空闲 80ms）` / `一次性执行安全网超时（累计 80ms）`，进展场景完成；rpc 分别报 `轮次空闲超时（空闲 80ms）` / `轮次安全网超时（累计 80ms）`，进展场景完成；acp 分别报 `session/prompt 空闲超时（空闲 80ms）` / `session/prompt 安全网超时（累计 80ms）`，进展场景完成。
- R5 ACP 审批门冻结：`/tmp/0030-pr-004-acp-gate.mjs` 输出正常完成 `text=answered`，门等待约 150ms 且 idle=50/net=100 未判死。
- R6 `/tmp/0030-pr-004/R6.out`：三值缺省 one-shot 静默桩 80ms 后 `settled=false`；无 `nullms`。
- daemon 透传 `/tmp/0030-pr-004/daemon-passthrough.out`：`idleMs=123, netMs=456`。
- R7 `/tmp/0030-pr-004/R7.out`：`timeout`、`timeout_after_1500ms`、`timeout_after_4000ms`、`timeout_after_1200ms` 均归类 `timeout`；中文轮次空闲文案归 `agent_error`（未进入 error 字段）。
- R8 `/tmp/0030-pr-004/R8.out`：三客户端/agent 默认常量残留均无；`MAX_TIMEOUT_MS=1800000` 与 shell `DEFAULT_TASK_TIMEOUT_MS=30000` 保留；sdk/web 改动为空；改动面仅六个指定 `oamp/src` 文件。
- 所有六个指定 JS 文件 `node --check` 通过；`git diff --check` 通过。
