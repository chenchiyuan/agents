# F03 · Router UDS 的 8 个方法 1:1 封装

**功能 ID**: F03
**来源**: `demand.md` 第二段 §1 **W2②**（`user_confirmed`：A-2）；**W3**（严格 1:1）；§4.2 的"需补理由"条（UDS 是**非 oamp 启动的 agent** 注册进拓扑的唯一入口）；§4 **E1** 的 ⑤ 类操作
**迭代**: 0025-hub-sdk-and-skill
**产品对象（引用 `demand.md` 只读事实，非本阶段决策）**: Router 的 8 个 JSON-RPC 方法——`agent.register` / `agent.heartbeat` / `agent.deregister` / `message.send` / `message.ack` / `router.status` / `router.task_get` / `router.task_list`（W2 原文）

---

## 用户价值

不是由 oamp 自己拉起的 agent（或别的进程）也能把自己接进拓扑、参与消息收发——同样不用手写 socket 与协议帧。

## 验收标准

1. **8 个方法逐条可达、无遗漏、无自发新增**（W2② / W3）：8 个方法各有一个可寻址入口，且对应关系能被逐条列出（**一张 8 行的对照清单**）。
   *判定*：把对照清单与 8 个方法名逐条比对 → 双向无缺项。
2. **请求与响应原样透传**（W3 / C-1）：方法入参与返回值不被重新包装成语义不同的形态；调用方拿到的字段与 UDS 面的字段一致。
   *判定*：对同一个方法，比对"直接经协议调用"与"经 SDK 调用"的返回字段与取值 → 一致（形态简化不算改语义，多了/少了语义字段才算）。
3. **注册闭环可被完成**（§4.2 的"缺它则只覆盖消费 hub"）：以 SDK 组合完成"注册 → 心跳 → 消息收发 → 注销"这一序列，**全程不出现手写 socket / 手写 JSON-RPC 帧**。
   *判定*：按顺序执行该序列（含一次消息往返）→ 拓扑侧可见该实例上线、消息到达、实例下线；消费方记录的命令清单里不出现 socket 手写或自建帧编解码。
4. **拓扑数据可被盘点**（E1 的 ⑤ 类操作）：借助该层的盘点方法与调用面的拓扑数据，可列出当前在线实例与逐角色对齐结果。
   *判定*：执行盘点入口 → 输出含在线实例清单（与既有控制面观察一致）。

## 边界（不包含）

- 不含 Web 接口面（→ [F02](F02-web-api-surface-coverage.md)）与 oamp CLI 命令（→ [F04](F04-oamp-cli-command-coverage.md)）。
- 不含新增任何 agent 生命周期能力（守护 / 自愈 / 自动重试拉起）——**N3** → [G02](G02-lifecycle-boundary-preserved.md)。
- 不含把"启停 agent"这件事搬进 hub 的 HTTP 面——**N4** → G02。
- 不含跨机接入 / 鉴权（UDS 的访问边界沿用既有形态）——**N2**。
- 不含不可达时的降级行为（socket 不存在 / 连接被拒 → [F08](F08-disconnect-degradation.md)）；不含退出码语义（→ F07）。
- 不含 8 个方法在子命令结构上的拼写 → `[架构待填]` T-01；不含库 API 表达 → T-03。

## 架构落定（阶段 3）

> 架构维度结论；**产品维度（用户价值 / 验收标准 / 边界）逐字未改动**。详见 `../architecture.md` §5 / §4。

- **T-01 · 层 B 的子命令**（§5.1 层 B 全表）：前缀 `uds`，8 条逐条 1:1 —— `uds agent.register` / `uds agent.heartbeat` / `uds agent.deregister` / `uds message.send` / `uds message.ack` / `uds router.status` / `uds router.task_get` / `uds router.task_list`。
- **参数与返回的透传形态**：入参统一走 `--params '<json 对象>'`（**方法参数原样**，SDK 不做字段级搬运）；返回值为 JSON-RPC `result` 原样输出（验收 2）。身份相关的 5 个方法接受 `--as <instance-id>` = **身份括号**（连接 → `agent.register` → 单次方法 → best-effort `agent.deregister`），沿用既有 `oamp task send` 临时注册 `main` 的既有做法（L2-10）；`router.*` 三条与 `agent.register` 不接受该选项（给出即用法错误 2，避免"给了却不生效"）。
- **T-03 · 层 B 的库 API**（§5.2）：`const s = await hub.uds.connect()` → `s.register(id)` / `s.heartbeat(params)` / `s.send(params)` / `s.ack(params)` / `s.status()` / `s.taskGet(id)` / `s.taskList(q)` / `s.deregister()` / `s.close()`；**不提供自动心跳循环 / 自动重连**（N3 / G02，L2-9）。
- **复用面（不重写）**：NDJSON 帧与 JSON-RPC 复用既有 `src/rpc.js` 的 `RpcPeer`；socket 地址复用既有 `src/config.js` 的 `loadConfig(env).socketPath`（与 `status.js` / `task.js` 同一条解析链，无第二处定义）。
- **注册闭环（验收 3）的两条可照做路径**（§5.1 层 B 末尾）：库面（面向非 oamp 启动的进程，会话显式持有）与 shell 面（`hub uds … --as`，每次调用独立连接、期间该实例在线）；全程零手写 socket、零手写帧。拓扑盘点（验收 4）由 `uds router.status` + `api agents` 提供。

## model_inferred

无。

## 越界自查

- **未做技术选型**：未指定传输实现、连接复用方式、帧编解码归属，只要求"8 个方法可达 + 语义透传"。
- 验收 3 的序列是**消费方组合**形态（W3 的"闭环可被完成"），**未要求 SDK 代做编排**——跨端点的编排命令是 **N5** 明令不做的。
- 未把"agent 上下线"写成 SDK 能力：上线/下线是**既有方法**的语义结果，SDK 只透传（G02 验收 3）。
