# F06：终端事件日志（心跳节流）

**功能 ID**: F06
**来源**: `demand.md` W5（P-05 观测面 ②：终端事件日志，心跳日志节流防刷屏）、N2（审计由终端事件日志承担）；效果条款 E2
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

Router 与 agent 终端实时输出关键生命周期事件（注册、注销、offline 判定等），用户盯着终端就能看到拓扑在动；心跳日志节流保证长跑节点不刷屏淹没关键事件（P-05 观测面 ②）。

## 验收标准

1. Router 终端在节点注册、deregister、offline 判定等状态变迁发生时输出可见事件行（E2：终端可观察 online/offline）。（README 手测）
2. agent 终端在自身注册成功、注销时输出可见事件行（E2）。（README 手测）
3. 节点持续心跳期间，心跳相关日志被节流：固定观察窗口内单节点心跳日志条数有明确上限、显著小于实际心跳次数，不逐跳刷屏（M-03，2026-09-09 user_confirmed；上限/窗口数值见架构待填）。（README 手测 / 脚本统计）
4. 心跳节流只抑制心跳类日志，不吞掉状态变迁事件行（对照验收标准 1 在长跑期间仍可观察）。（README 手测）

## 边界（不包含）

- 不含 `oamp status` 查询（F05）
- 不做日志持久化/日志文件（N2：审计由终端事件日志承担，不留盘）
- 不含事件日志的结构化文件输出（本卡只承诺终端可见）
- 不做日志轮转/级别配置面（未在 P-06 确认范围内）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §8/D9）

- **事件分类与行格式（AR-07 → D9，§8.1）**：事件行 = `[<UTC ISO-8601>] <role> <TOKEN> <key=value …>`（值含空格加引号；值全 key=value 便于脚本统计），输出 stdout（错误/用法走 stderr）。Router 侧：`ROUTER_READY`/`AGENT_REGISTERED`/`AGENT_REPLACED`/`AGENT_DEREGISTERED`/`AGENT_OFFLINE`/`HEARTBEAT`（节流）/`MESSAGE_DELIVERED`/`MESSAGE_ACKED`/`ROUTER_STOPPING`；agent 侧：`AGENT_START`/`REGISTERED`/`MSG_RECEIVED`/`CONNECTION_LOST`/`DEREGISTERED`。状态变迁事件（注册/替换/注销/offline/消息）**永不节流**（F06-1/4）。
- **节流机制与数值（AR-07 → D9，§8.2）**：只节流 `HEARTBEAT`（Router 侧唯一高频事件；agent 侧不逐跳打日志）。机制 = **每节点滑动窗口至多 1 条**（惰性判断，无定时器扫表）：`now - lastHbLogTs ≥ W` 才打。默认 `W = 60s`（env `OAMP_HB_LOG_WINDOW_MS` 覆盖，测试缩到 ~300ms）。默认参数下每分钟实际 6 跳至多 1 条（抑制 ≥5/6，满足 M-03"显著小于"）；可测判据 = 观察窗 T 内单节点 HEARTBEAT 行 ≤ ⌈T/W⌉+1。
- **输出实现（F06 → D9）**：`src/log.js` 统一格式化 + 节流状态；Router 与 agent 各持实例写自己的 stdout（不落盘、不轮转——N2 审计 = 终端事件，不留文件）。
