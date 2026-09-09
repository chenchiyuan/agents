# F02：Router 启动与注册表维护

**功能 ID**: F02
**来源**: `demand.md` W2（R1）、W5（P-03）、P-07、P-08、需求结论 §3「拓扑/协议方法面/持久化」；效果条款 E1（重注册节）、E3
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用户启动一个**独立服务角色**的 Router（R1）后，多个 agent 节点可以注册进来并被统一维护——注册表是拓扑存活层的核心事实源，节点是谁、是否活着、何时心跳，都以 Router 注册表为准。

## 验收标准

1. `oamp router start` 前台启动后成为可接受节点注册的服务；节点可成功注册（就绪以同机注册尝试成功或 README 手测无报错为判定）（W2）。（node:test 契约形态 / README 手测）
2. 节点注册（register）成功后：注册表含该节点条目，条目含 instance_id、唯一 session 标识、state=online、last_heartbeat（注册时初始化）——经 status 或契约断言可见（P-05 字段）。（node:test）
3. 两个不同 instance_id 的节点可同时 online 并被同一 Router 维护，各自心跳互不影响（E3）。（node:test）
4. 同一时刻同一 instance_id 至多存在一个 live session（P-07 唯一性语义）：同 id 已有 live session 时再次注册不产生第二个 live（具体处置方式见架构待填，本卡只锁不变量）。（node:test）
5. 节点被判 offline 后，同 instance_id 重新注册成功，注册表恢复该节点 online（E1 末节：同 id 重启重注册）。（node:test）
6. 节点 deregister（优雅退出路径）后：该节点不再处于 online/live 集合，Router 不再将其视为活节点（W6 方法面 agent.deregister）。（node:test）
7. UDS socket 权限限定为属主本机用户可访问（P-07：0600 级别），非属主用户不可连接（以产物 socket 权限位 stat 核查为判定）。（脚本/命令核查）
8. Router 收到 SIGINT 后优雅退出：进程干净退出不悬挂（§3 CLI 形态：Router 清 session）。（README 手测 / node:test）

## 边界（不包含）

- 不含节点侧注册/心跳/注销的发起行为（F03）
- 不含心跳记录更新与 lease→offline 判定（F04；本卡只锁注册时点状态与 deregister/重注册语义）
- 不含 status 查询命令与终端事件日志（F05/F06）
- 不做任何持久化：Router 状态全内存，重启即清空，节点重连重注册（N2/P-08）
- 不做 suspect 两段判定（N5，归 F04 单段边界）
- 不做注册鉴权 token 机制（N6；安全面仅 socket 0600 + 同 id 唯一性，本卡 4/7 条）
- 不做进程守护/自动重启/后台化（N7）
- 不做跨机传输（N8，UDS 本机 MVP）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §4/§5/D2~D5/D16）

- **socket 路径与注册表 schema（AR-02 → D2/D3，§5.1/§5.2）**：默认 `<oamp 包根>/oamp/.runtime/router.sock`（包根锚定与 cwd 无关；env `OAMP_SOCKET` 覆盖）；监听后 `chmodSync 0600`（验收 stat 0600）；bind 撞 EADDRINUSE 时 connect 探测区分"活 Router"（报 `ROUTER_ALREADY_RUNNING` 退出）与"陈旧文件"（unlink 重试）。注册表 = 全内存 `Map<instance_id, Entry>`，Entry = `{instance_id, session_id, state: online|offline, last_heartbeat(epoch ms), connId|null}` + 连接身份反查表；单事件循环串行，无锁。
- **同 id 冲突规则与 session 生成（AR-03 → D4/D5，§5.3）**：**live 冲突 = 替换（latest-wins）**——新 register 关闭旧连接、以新 session 覆盖条目并打 `AGENT_REPLACED`；offline 条目同 id 重注册直接覆盖复活；唯一性由"instance_id 单键 + 替换写"结构性保证（至多一个非空 connId）。session_id = `crypto.randomUUID()`。备选"拒绝"语义单点可逆（见 architecture.md §13 开放项 1）。
- **deregister 处置（AR-03 → D4，§5.4）**：优雅 deregister = **删除条目**（不留墓碑）；offline（超时） = **保留条目、state=offline、connId=null**（E2 要求 status 可见 offline），同 id 重注册时覆盖。
- **就绪信号与退出清理（AR-03 → D16）**：stdout `ROUTER_READY socket=…` 行 = 可接受注册；SIGINT → 停扫描 → close 监听 → 关全部节点连接 → unlink socket → 退出 0；二次 SIGINT 强退（130）。
- **方法面 RPC 细节（AR-02 → D16，§4.4/§4.6）**：`agent.register`（请求）→ result `{instance_id, session_id, state, lease_timeout_ms, last_heartbeat}`；`agent.deregister` 用**请求语义**（可测注销时序与错误可见），Router 兼容无 id 通知形态；错误映射见 architecture.md §4.3 错误码表（`UNREGISTERED`/`AGENT_NOT_FOUND`/`STALE_SESSION` 等，`data.code` 承载）。
