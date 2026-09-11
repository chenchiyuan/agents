# F04：心跳租约与 offline 判定

**功能 ID**: F04
**来源**: `demand.md` W5（P-04 最小 lease→offline 判定）、N5；效果条款 E1（kill→offline 节）、E2（offline 可见节）
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

Router 能自动发现"死掉的节点"：节点停止心跳超过租约阈值后无需人工干预即被判 offline，让用户与上层始终看到真实存活状态（P-04 最小单段判定）。

## 验收标准

1. Router 每次收到节点心跳即更新该节点 last_heartbeat（E1：周期心跳被 Router 记录）。（node:test）
2. 节点进程被强杀（无机会发 deregister）后，Router 在租约超时阈值过后**自动**将该节点判为 offline——不需要人工干预、不经过 suspect 中间态（P-04/N5；E1 kill→offline 节、E2）。（node:test，超时参数见架构待填）
3. offline 判定可经 `oamp status` 观察：该节点 state 显示为 offline（E2）。（node:test / README 手测）
4. 心跳节流不改变判定正确性：节点正常周期心跳期间不会被误判 offline（对照 E3 并发场景）。（node:test）

## 边界（不包含）

- 不含节点侧注册/心跳发起行为（F03）
- 不含同 instance_id 重启后的重注册与 live 唯一性语义（F02，本卡只到"判 offline"为止，offline 后的恢复路径归 F02）
- 不含 suspect 两段判定（N5，后移）
- 不做投递/运行记录持久化（N2，判定状态随 Router 进程全内存）
- 不做离线主动探测/进程外探活语义（本卡只承诺"心跳停止超时→offline"这一被动判定结果）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §5.4/§5.6/§5.7/§7.2/D6/D7/D17）

- **interval/timeout 数值与可配（AR-04 → D6，§7.2）**：默认 interval 10s（agent 侧）/ timeout 30s（Router 侧租约），沿用 docs/ds 参考值；env 可配：`OAMP_HEARTBEAT_INTERVAL_MS`、`OAMP_HEARTBEAT_TIMEOUT_MS`（正整数，非法即启动报错退出）。测试把 timeout 缩到 200~400ms 使 E1 kill→offline 秒级可断言；建议 timeout ≥ 2×interval。
- **到期检查机制（AR-05 → D7，§5.6）**：**主动定时扫描**——Router `setInterval` 每 `clamp(timeout/4, 20, 1000)` ms 遍历 online 条目，`now - last_heartbeat > timeout` → 判 offline。理由：F04-2 要求"超时后自动判定、免人工"，惰性方案在"只剩一个死节点且无查询/无其他心跳"时永不触发；主动扫描给判定延迟上界（≈timeout+sweep）供测试精确断言。扫描与心跳日志节流完全解耦，正常心跳不会误判（F04-4）。
- **offline 表示（AR-05 → D4/D7，§5.4）**：`state` 字段置 `offline` + `connId=null`（连接仍开则关闭），**条目保留**至同 id 重注册覆盖——E2 要求 kill 后 `oamp status` 可见 offline，删除条目则无痕；offline 墓碑不做 GC（本机拓扑 id 数量有限）。
- **时间基准（F04 → D17，§5.7）**：单一时钟源 = 进程内 `Date.now()`（epoch ms）；UDS 本机单 Router 无跨机时钟偏差；外显时间戳一律 UTC ISO-8601。
