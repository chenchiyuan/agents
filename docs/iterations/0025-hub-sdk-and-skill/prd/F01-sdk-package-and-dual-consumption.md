# F01 · SDK 包形态与双消费方式（CLI + 同源库）

**功能 ID**: F01
**来源**: `demand.md` 第二段 §1 **W1**（`user_confirmed`：A-1 锚定 oamp / A-3 形态 / B-1 落点）；§3「大概怎么做 · 包结构」；§4 **E4**（跨宿主一致）
**迭代**: 0025-hub-sdk-and-skill
**产品对象（引用 `demand.md` 只读事实，非本阶段决策）**: oamp 包（`oamp/`；`bin/oamp.js` 为既有 bin 入口先例；`package.json` 现为零依赖、`engines.node >= 22`）——W1 的落点与零依赖约束同源

---

## 用户价值

需要与 hub 协作的人（shell 前的开发者、Node 侧程序、被 skill 引导的 agent）拿到的是**一个**东西——不必为"在终端里用"和"在代码里用"各实现一遍通信。

## 验收标准

1. **包存在且落点正确**（W1 / B-1）：仓库内存在一个承载该 SDK 的 Node 包，落点在 `oamp/` 内（SDK 目录 + bin 入口），不另起独立包管理形态。
   *判定*：在 `oamp/` 下可见新增的 SDK 目录与 bin 入口；该包对外暴露一个可直接执行的命令入口。
2. **同一份代码两种消费方式**（W1）：CLI 与库**不是两份并行实现**，而是同一份代码的两种消费面。
   *判定*：对同一处实现做一次最小行为改动（如某个输出的取值）→ 终端侧与库侧的调用**同时**体现该改动；不出现"改了一处、另一处没变"。
3. **库可被直接 import 消费**（W1）：在同一仓库内以 Node `import` 方式消费该库，能完成一次真实调用并得到结构化结果，过程中**不经过 shell、不出现手写 HTTP**。
   *判定*：写一段最小消费代码（import + 一次调用，如盘点 agent 状态或取一次调用终态）→ 打印得到结构化结果。
4. **跨宿主一致**（E4）：同一条命令在 ①shell ②Node `import` ③另一个 agent（经 shell 调用）三种宿主下，**退出码与 stdout 的 JSON 结构一致**。
   *判定*：三处各执行同一条命令，比对退出码与 JSON 结构。〔判定方式逐字取自 `demand.md` E4 的裸判据〕
5. **零依赖与运行约束沿用**（W1 / §3）：不引入第三方依赖；Node 版本要求沿用既有约束。
   *判定*：读 `oamp/package.json` → `dependencies` 为空、`engines` 沿用既有取值。

## 边界（不包含）

- 不含各宿主专属适配器 / 插件形态（Claude 插件、Codex 扩展、MCP server 等）——**N7** 封死；宿主差异由 shell 层吸收（A-3）。
- 不含跨机接入 / 鉴权 / 凭据管理——**N2**（沿用 0015 TC-06 既有边界：仅同机、不鉴权）。
- 不含下游业务项目的分发（不进分发脚本的分发面）——**N6** → [G03](G03-roles-and-distribution-untouched.md)。
- 不含包内目录划分与 bin 入口的子命令拼写 → `[架构待填]` T-01。
- 不含库 API 的函数签名 / 命名空间表达 → `[架构待填]` T-03。
- 不含 SDK 的接口覆盖面（→ F02 / F03 / F04）与调用契约（→ F05~F10）。

## 架构落定（阶段 3）

> 架构维度结论；**产品维度（用户价值 / 验收标准 / 边界）逐字未改动**。详见 `../architecture.md` §5 / §4。

- **T-01 · 子命令拼写与命名空间组织**（§5.1）：SDK 落 `oamp/sdk/`（7 文件：`index.js` / `surface.js` / `http.js` / `uds.js` / `cli.js` / `doctor.js` / `errors.js`）；可执行入口 = `oamp/bin/hub.js`（`package.json` 的 `bin` **只追加一行** `"hub": "./bin/hub.js"`，`dependencies` / `engines` 逐字不变）。调用形态 `node <项目根>/oamp/bin/hub.js <层> <子命令>`，三层前缀 `api` / `uds` / `cli`。
- **T-03 · 三层封装在库 API 上的表达**（§5.2）：库入口 `createHub({ port, socketPath })` → `{ api, uds, cli, doctor }`；**CLI 面与库面共用同一张入口表**（`sdk/surface.js`）⇒ "同一份代码两种消费方式"（验收 2）由结构保证。签名规则 = 路径参数走位置参数、query/body 走对象原样透传；返回值不加信封、不改字段名。
- **跨宿主一致（E4，验收 4）**：库面无进程退出码，其等价物 = `HubError.exitCode`（与 CLI 面共用 `sdk/errors.js` 的同一张归类表）；三宿主一致性由"同一份入口表 + 同一份归类表"结构性保证（§5.2 规则 5）。
- **零依赖与运行约束（验收 5）**：只用 `node:http` / `node:net`（经既有 `src/rpc.js`）/ `node:child_process` / `node:fs`；argv 手写解析（沿用 `src/cli.js` 既有手法）；`package.json` 的 `dependencies` 与 `engines` 逐字不变（§4.2 M-1）。

## model_inferred

无。

## 越界自查

- **未做技术选型**：只约束"零依赖 / 落点 `oamp/` 内 / 两种消费方式来自同一实现"，未指定包内结构、模块划分或导出形式。
- 验收 4 **逐字使用** E4 的裸判据（三种宿主 + 退出码与 JSON 结构一致），**未放宽或加严**。
- 未派生"安装脚本 / 版本发布 / 分发"之类 `demand.md` 之外的功能（**N6** 已封死）。
