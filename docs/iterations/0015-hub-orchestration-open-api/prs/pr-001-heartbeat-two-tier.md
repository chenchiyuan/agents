# pr-001-heartbeat-two-tier

## 上下文摘要

落地 F03 心跳两档与 F08 回归约束：agent 侧新增纯函数 `heartbeatPlan`（活跃档 = `heartbeatIntervalMs`，空闲档 = 6× 默认 60s），每跳前求值切换、不额外发跳；心跳通知新增可选 `next_interval_ms` 通告下一跳间隔，Router 由 `registry.findExpired` 按实例推导阈值 `max(基准, 2×通告)`，不变式由公式结构性保证——空闲 60s 跳不被判离线、零重注册、零换 session。新增 `HEARTBEAT_SENT` / `HEARTBEAT_TIER` / `LEASE_ADJUSTED` 观测面；旧 Router（缺 `lease_follows_interval`）禁用空闲档。注册 / 校验 / 顶替 / 注销语义与 `snapshot()` 4 字段逐字不变。

## 涉及功能点

- F03
- F08

## 文件范围

- oamp/src/config.js（修改：`+HEARTBEAT_IDLE_FACTOR`、`+heartbeatIdleMs` 派生字段）
- oamp/src/registry.js（修改：条目 `+next_interval_ms`、`heartbeat()` 可选入参、`findExpired()` 阈值公式、`+isValidAnnouncedInterval` / `+MAX_ANNOUNCED_INTERVAL_MS`）
- oamp/src/router.js（修改：`agent.heartbeat` 透传、`agent.register` 回包 `+lease_follows_interval`、`+LEASE_ADJUSTED`）
- oamp/src/node-client.js（修改：`startHeartbeat` 支持函数入参、心跳体 `+next_interval_ms`、`setInterval` → 自调度 `setTimeout` 链）
- oamp/src/agent.js（修改：`+heartbeatPlan` 具名导出、活动钩子、`+HEARTBEAT_SENT` / `+HEARTBEAT_TIER` / `+HEARTBEAT_IDLE_DISABLED`、`startHeartbeat` 调用点）
- oamp/test/agent-heartbeat.test.js（修改：新增纯函数段 + 端到端档位段；**既有用例零改写**）

## 验收标准

- [ ] `heartbeatPlan({idleForMs, activeMs, idleMs})` 的返回值只有两个可能值：`idleForMs < idleMs` → `{tier:'active', intervalMs: activeMs}`；`idleForMs === idleMs` → `{tier:'idle', intervalMs: idleMs}`；`idleMs === null` → 恒 `active`（三条边界各有断言；F03 验收 8）
- [ ] `cd oamp && node --test test/agent-heartbeat.test.js` 全绿；新增端到端档位段（`SHORT_ENV` ⇒ 活跃 50ms / 空闲 300ms）断言：出现 `HEARTBEAT_TIER … tier=idle`，其后 `HEARTBEAT_SENT` 的 `interval_ms` 由 `50` 变 `300`，此后 ≥3 × 空闲档时间的观察窗内**无 `AGENT_OFFLINE`**（F03 验收 2、5、7）
- [ ] 空闲档下向该实例发一条对话消息后，`HEARTBEAT_SENT` 的 `interval_ms` **立即**回到 `50`（不等下一个心跳周期），随后窗口内 `interval_ms=50` 的行 ≥4（F03 验收 1、3）
- [ ] 阈值联动有服务端直接证据：`LEASE_ADJUSTED` 行出现且 `threshold_ms = max(300, 2 × next_interval_ms)`（通告 300 ⇒ 600）；空闲期间 `LEASE_ALARM` 零命中（F03 验收 7）
- [ ] 身份不变：`HEARTBEAT_TIER … tier=idle` 行的 `session=` 与 `AGENT_REGISTERED` 行同值；空闲期间无 `AGENT_REGISTERED` / `AGENT_OFFLINE` / `agent.replaced`（F03 验收 6）
- [ ] 兼容零破坏：心跳无 `next_interval_ms`（既有 agent / 假节点 / web 常驻发送方的固定数字入参）⇒ 阈值回退基准 `config.heartbeatTimeoutMs`（默认 30000，逐字与迭代前一致），且不产生 `LEASE_ADJUSTED`（F08 验收 2、6）
- [ ] 回归锁零修改全绿：`node --test test/router-registry.test.js test/delivery-contract.test.js test/reconnect.test.js` 通过，且 `oamp/test/router-registry.test.js`、`oamp/test/delivery-contract.test.js`、`oamp/test/reconnect.test.js` 与 `oamp/test/agent-heartbeat.test.js` 的**既有**用例逐字未改（`git diff` 可查）；`registry.snapshot()` 逐字未变 ⇒ `oamp status` 仍只输出 4 字段，可作 F01 验收 2 的对照基准（F08 验收 3、4、5）

## 参考资料

- docs/iterations/0015-hub-orchestration-open-api/architecture.md（§3 全节「硬契约 ①」/ §3.6 计数规程 / §3.7 偏斜处置 / §9.1 测试同步 / §9.2 回归锁 / §14 L1-01 / §15.1 协议与心跳变更面 / §15.2 跨组契约 1~3 / §15.3 G1）
- docs/iterations/0015-hub-orchestration-open-api/prd/F03-heartbeat-two-tier.md（验收 1~8 + 架构维度）
- docs/iterations/0015-hub-orchestration-open-api/prd/F08-connection-semantics-unchanged.md（验收 1~6 + 架构维度）
- docs/iterations/0015-hub-orchestration-open-api/prd.md（疑问 1 裁决：机制不变、取值按 W5③ 联动）

## depends_on

（无）

> 代码级核实：本 PR 文件范围与 pr-002 / pr-003 零交集；对外可观测面只经 UDS 协议与 `registry.snapshot()` 的 4 字段投影（`oamp/src/registry.js:134-146` 显式投影 `instance_id` / `session_id` / `state` / `last_heartbeat`，不 spread 条目 ⇒ 新增 `next_interval_ms` 不外泄），而 `oamp/src/web.js:378-381` 的 `GET /api/agents` 是 `router.status` 的逐字透传 —— 两侧共享的符号在本 PR 中**未被改动**。`oamp/src/web.js:324` 的常驻发送方以固定数字调用 `startHeartbeat(heartbeatMs)`，本 PR 契约明确"固定数字入参行为逐字不变"，不构成消费关系。故不依赖任何其他 PR。

## batch

1
