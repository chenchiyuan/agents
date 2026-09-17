# pr-004 · 轮次计时：空闲判据 + 绝对安全网

## 上下文摘要

把"距开始 30 分钟"的**单绝对上限**换成 `idle`（自轮次开始或最近一次进展事件起算，达 `taskIdleMs` 判死）+ `net`（自轮次开始起算，达 `taskNetMs` 判死）**双计时**，落在既有唯一实现处——三个协议客户端的 turn timer。`config.js` 的 `loadConfig()` 新增 `taskIdleMs`（默认 `600000`）/ `taskNetMs`（默认 `14400000`）与 env `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS`（沿用 `readPositiveInt`，非法值启动即报错）；`agent.js` 两路 LLM 任务改传 `{idleMs, netMs}` 并**移除默认档** `DEFAULT_OMP_TIMEOUT_MS`（`MAX_TIMEOUT_MS` 保留，只约束调用方显式声明的上限）；**daemon（默认执行器）路径的选项通道 = `context-pool.js` 的 `ContextSession.prompt` 显式键集**（`context-pool.js:137` 形参表 / `:144` 队列项 / `:170-174` 的 `client.prompt` 实参），**未列入的键被静默丢弃** ⇒ 本 PR 同批把 `idleMs` / `netMs` 两键沿该通道透传（**只加两个键**：`(chat_id, agent_id)` 键语义、同键 FIFO 串行、LRU 与释放路径零改动）；**门挂起冻结语义保留**（审批/提问等待期间两个计时器同冻结）。触发后走既有失败收口（`ProtocolError('timeout')` → `task.result{state:'failed', error:'timeout'}`），`reason=timeout` 的归类与信封追加分别由 pr-001 / pr-005 承担。

## 涉及功能点

- F05

## 文件范围

- oamp/src/config.js
- oamp/src/agent.js
- oamp/src/acp-client.js
- oamp/src/rpc-client.js
- oamp/src/oneshot-client.js
- oamp/src/context-pool.js（仅两键透传，键语义/串行/LRU 零改动）

## 验收标准

- [ ] `loadConfig()` 返回对象含 `taskIdleMs === 600000` / `taskNetMs === 14400000`；`OAMP_TASK_IDLE_MS=abc`（或 0 / 负数）⇒ 启动即抛错，不静默回落；`OAMP_TASK_IDLE_MS=2000` ⇒ 阈值被压缩生效
- [ ] **daemon（默认执行器）路径的选项透传 + 否证面**：`ContextSession.prompt` 的显式键集（`oamp/src/context-pool.js:137` 形参表 / `:144` 队列项 / `:170-174` 的 `client.prompt` 实参）**未列入的选项被静默丢弃** ⇒ 两键透传落地后：以压缩阈值（如 `OAMP_TASK_IDLE_MS=1500`）派发一轮 daemon 任务并停止产出 ⇒ 判死时刻**跟随该配置阈值**、失败报文中的阈值数字**非 `null`**；否证面 = 去掉两键透传即复现"≈2.5s 判死 + `轮次安全网超时（累计 nullms）`"（planner 一次性参照实现的实测缺口形态），或客户端加 null 防御后该路径**完全无计时器**——两者任一出现即本条不通过
- [ ] 持续产出进展信号（`onDelta` / 轮次开始事件 ⇒ agent 侧 `sendUpdate('working', …)` ⇒ Router `task.update`）且累计时长超过旧 30 分钟绝对上限的轮次**不被判死**；停止产出达 `taskIdleMs` ⇒ 判死并上报 `state:'failed', error:'timeout'`
- [ ] 安全网独立生效：持续有噪音信号但累积时长达到 `taskNetMs` ⇒ 同样判死落 `error:'timeout'`；阈值内的正常长任务不被安全网触发
- [ ] 两种触发的**人类可读文本**可区分（空闲触发 / 安全网触发各一条 message），且**不新增** `state` 取值、不新增 `error` 取值形态、不引入子枚举
- [ ] 缺省档不存在：不传 `timeout_ms` 的 LLM 任务不再被 `1800000` 截断（`agent.js` 的 `DEFAULT_OMP_TIMEOUT_MS` 与三处客户端同名缺省值均不再作为默认证）；**显式** `timeout_ms` 的语义与 `≤ MAX_TIMEOUT_MS` 校验逐字不变
- [ ] 门（审批 / 提问）挂起期间两个计时器一并冻结：挂起时长不计入 `idle` 也不计入 `net`
- [ ] `shell` 路径的 `timeout_ms` 默认 30s / 上限 30 分钟语义不变（本 PR 不改 shell 的命令硬上限）

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-05（进展信号口径、计时起点、生效位置清单 1~8、显式 `timeout_ms` 的边界裁决）
- docs/iterations/0030-hub-communication-upgrade/prd/F05-idle-timeout-and-safety-net.md（验收 1~7）

## depends_on

（无）

## batch

1
