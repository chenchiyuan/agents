# pr-002：Router UDS 通道（F03/F08/F09/G01/G02）

## 上下文摘要

`uds.js` 以会话形态暴露 Router 的 8 个方法；帧编解码与地址解析复用既有 `src/rpc.js` 的 `RpcPeer` 与 `src/config.js` 的 `loadConfig`，不重写协议。失败统一构造 pr-001 的 `HubError`（`ENOENT` → 3，`data.code` → 1）。会话由调用方持有并 `close()`；无自动心跳 / 重连 / 重试。

## 涉及功能点

- F03
- F08
- F09
- G01
- G02

## 文件范围

- `oamp/sdk/uds.js`（新建：UDS 会话 `connect()` → 8 个方法 + `close()`，复用既有 `RpcPeer` / `loadConfig`）

## 验收标准

- [ ] `connect()` 返回会话，暴露 8 个方法 1:1（`register` / `heartbeat` / `send` / `ack` / `status` / `taskGet` / `taskList` / `deregister`）与 `close()`；帧编解码经既有 `src/rpc.js` 的 `RpcPeer`，socket 路径经既有 `src/config.js` 的 `loadConfig(env).socketPath`（F03 验收 1、§2.3、L2-11）
- [ ] 对既有 `oamp router start` 起的真实 Router，8 个方法各成功调用一次，返回值 = JSON-RPC `result` 原对象（不改字段名、不加信封）；入参原样透传、不做字段级搬运（F03 验收 1/2）
- [ ] 注册闭环（库面）：`register` → `heartbeat` → `send` → `ack` → `deregister` → `close` 全程可完成，且拓扑侧可见该实例上线、消息到达、下线（F03 验收 3）
- [ ] 身份由**连接**承载（会话即身份），SDK 只在调用方显式持有的会话内保持在线；不代替调用方做身份编排（L2-10 / F03 验收 2）
- [ ] 不可达：socket 不存在 → `ENOENT` → `HubError{code:'HUB_UNREACHABLE', exitCode:3}`；连接建立超 2000ms 同归 `3`；立即结束、不挂起、不重试（F08 验收 1/2/3/4）
- [ ] JSON-RPC 错误：`data.code`（如 `UNREGISTERED`）原样进入 `HubError.code`，退出码归 `1`；`-32601` 不被当作"方法不存在"以外的语义改写（§5.4 / F07 验收 2）
- [ ] 无自动性：不提供自动心跳循环、自动重连、自动重试、失败自动重派（L2-9 / G02 验收 3）
- [ ] `close()` 释放连接；除调用方显式持有的会话外无任何句柄，且不写任何本地文件（F09 验收 1/2/4）
- [ ] 零新增依赖：仅用 `node:net`（经 `src/rpc.js`）与既有模块（F01 验收 5 / C1）
- [ ] 本 PR 的 diff 不含 `oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`，不新增任何路由与方法（G01 验收 2/4/5）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F03-router-uds-method-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F08-disconnect-degradation.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/G02-lifecycle-boundary-preserved.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §2.1（`UDS --> RP` / `UDS --> CF`）、§2.3、§4.1 N-5、§4.4 顺序约束 3、§5.1 层 B 全表、§5.2、§5.4、§7 F03 行、§10 T3
- 代码锚点：`oamp/src/rpc.js:57`（`RpcPeer` 构造与请求/响应/通知/错误全套）、`oamp/src/rpc.js:8`（`ERR` 机器码表）、`oamp/src/rpc.js:23`（`JSONRPC_CODE.METHOD_NOT_FOUND = -32601`）、`oamp/src/config.js:136`（`loadConfig`）、`oamp/src/router.js:109/161/186/201/348/379/384/395`（8 个方法的 `dispatch` 分支）

## depends_on

- pr-001-sdk-error-contract-and-web-channel.md（理由：`oamp/sdk/uds.js` 的全部失败路径必须构造 `HubError` 并使用其四类归类表，而 `HubError` 与归类表由 pr-001 新建的 `oamp/sdk/errors.js` 定义——证据：`architecture.md` §2.1 组件图的 `ERR -.-> UDS` 边，以及 §7 的 F08 行把 `sdk/uds.js` 与 `sdk/errors.js` 列在同一落点组）

## batch

1
