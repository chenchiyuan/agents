# F05：status 只读查询

**功能 ID**: F05
**来源**: `demand.md` W5（P-05 观测面）、需求结论 §3「协议方法面（Router 查询方法）/CLI 形态」；效果条款 E2
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用户随时一条 `oamp status` 就能看到当前拓扑事实——每个节点是谁、在不在线、上次心跳是什么时候——不用翻日志猜状态（P-05 观测面 ①）。

## 验收标准

1. `oamp status` 连本机 Router 读取注册表快照并输出节点信息（P-05；连接目标细节见架构待填）。（README 手测 / node:test）
2. 输出对每个已注册节点包含四个字段：instance_id、session、state、last_heartbeat（P-05 字段），且字段值与节点实际注册/心跳状态一致。（node:test / README 手测）
3. Router 未运行时执行 `oamp status` → 明确失败：非零退出 + 可理解错误信息，不静默输出空结果冒充成功（M-02，2026-09-09 user_confirmed）。（node:test / README 手测）
4. 只读语义：连续执行 status 不改变任何节点的状态与注册表内容（查询无副作用）。（node:test）
5. 节点 online→offline 变化后再次 status，输出反映最新状态（E2：kill 节点进程后 status 显示该节点 offline）。（README 手测）

## 边界（不包含）

- 不含持续事件流与终端事件日志（F06）
- 不含对 Router 的任何写操作（本卡只读）
- 不含 Router 启动/注册表语义（F02）
- 输出格式（表格/JSON/字段排序等）不在本卡锁定（架构待填）
- 不含跨机查询（N8，UDS 本机）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §4.4/§7.2/§7.3/D8）

- **查询方法与 schema（AR-06 → D8，§4.4）**：方法名 = `router.status`（无参请求）；result = `{nodes: [{instance_id, session_id, state, last_heartbeat}]}`（按 instance_id 排序，仅 P-05 四字段投影，不暴露连接句柄等内部字段）。任何已连接者可调用（无需注册身份；安全面 = UDS 0600）。
- **Router 定位（AR-06 → D8，§7.2）**：默认 socket 路径 = `<oamp 包根>/oamp/.runtime/router.sock`（包根锚定、与 cwd 无关）；覆盖方式 = env `OAMP_SOCKET`（本次不引入额外 flag；P-06 允许 flag/env 两种，env 即满足覆盖与测试隔离）。查询请求设 2s 上限防悬挂。
- **输出格式（AR-06 → D8，§7.3）**：stdout 对齐文本表格（padEnd 渲染，零依赖），表头含 instance_id / session_id / state / last_heartbeat（UTC ISO-8601），行按 instance_id 排序；Router 运行但零节点 → 表头 + 空行、退出 0；Router 不可达 → stderr 明确报错（含 socket 路径、提示 router 未运行）+ 退出 1（M-02，不静默空结果）。查询路径零副作用（F05-4）。
