# F03：agent daemon 节点客户端

**功能 ID**: F03
**来源**: `demand.md` W3（D-5b + P-02）、需求结论 §3「协议方法面/CLI 形态」（R2 通用形态）；效果条款 E1（注册/心跳节）、E3
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用户可反复执行 `oamp agent start <instance-id>` 拉起任意多个**裸协议节点**（P-02），每个节点自动向 Router 注册并维持周期心跳，成为最小拓扑里的叶子；节点客户端保持通用形态（R2），未来真实 OMP 实例与主 agent 接入复用同一客户端。

## 验收标准

1. `oamp agent start <instance-id>` 启动后，节点向本机 Router 注册；注册成功后 Router 注册表出现该 instance_id 且 state=online（E1 首节）。（node:test）
2. 节点按固定周期持续发送心跳，Router 侧该节点 last_heartbeat 随之更新（E1：周期心跳被 Router 记录；以两次查询/断言对比为判定）。（node:test）
3. 节点收到 SIGINT 后优雅退出：先发 deregister 再退出，退出码 0、不悬挂（§3 CLI 形态：agent 发 deregister）。（node:test）
4. 可多次实例化拉起多节点：两个不同 instance_id 的 `oamp agent start` 同时存活并各自心跳（E3 手测载体）。（README 手测 / node:test）
5. 裸协议形态：节点参数面不含 provider/model/prompt 相关必填项，启动所需必填参数仅 instance_id（P-02/P-06/N3）。（命令核查）

## 边界（不包含）

- 不含 Router 侧注册表语义、deregister 处理、同 id 唯一性（F02）
- 不含 Router 侧心跳记录更新与 offline 判定（F04）
- 不含 agent 进程内对 deliver 消息的业务受理/回执处理——本轮消息闭环由契约测试的脚本级假节点承担（W6/P-01；真实 CLI agent 与假节点的受理关系见 F07 架构待填）
- 不含 provider/model/prompt_profile 集成与 LLM 执行（N3）
- 不做进程守护/自动重启/后台化——agent 被 kill 后由用户或外部进程重新拉起（N7）
- 不做心跳/注册重试机制（N1 边界，见 F07 架构待填）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §6/D6/D12/D16/D17）

- **心跳间隔与可配（AR-04 → D6，§7.2）**：默认 interval 10s / Router 侧 timeout 30s（docs/ds 参考值）；env `OAMP_HEARTBEAT_INTERVAL_MS`（agent）与 `OAMP_HEARTBEAT_TIMEOUT_MS`（Router）覆盖，自动化测试缩短到 30~400ms 秒级完成；建议 timeout ≥ 2×interval，agent 启动时按 Router 授予的 lease_timeout_ms 自检告警。
- **连接生命周期与心跳机制（F03 → D6/D17，§6.2）**：启动 connect 失败 → stderr 明确报错（含 socket 路径、提示先启 Router）退出 1；register 等响应上限 2s（防悬挂）；成功后按间隔发 `agent.heartbeat`（**通知**，无响应不堆积）；运行中断线（Router 死/重启）→ 打 `CONNECTION_LOST` 事件 → 退出 1——N1/N7 无重试、无守护、不静默挂起。
- **SIGINT 时序（AR-03 → D16，§6.3）**：停心跳定时器 → 发 `agent.deregister`（请求语义，等响应 ≤1s，best-effort）→ 打 DEREGISTERED → 退出码 0（F03-3）；二次 SIGINT 强退（130）。
- **deliver 受理形态（AR-10 → D12，§6.4，见 F07 卡）**：真实 CLI agent 复用通用 `NodeClient`，**自动受理 deliver——回传输应答 `{received:true}` + 自动发 `message.ack{status:"accepted"}`**（纯传输层收讫，无业务处理/不执行/不回 started/completed），并打 `MSG_RECEIVED message_id=…` 事件（正文不进日志）。假节点与真实 agent 同一客户端（杜绝协议漂移）。详见 architecture.md §10.1 与 F07 卡架构维度。
