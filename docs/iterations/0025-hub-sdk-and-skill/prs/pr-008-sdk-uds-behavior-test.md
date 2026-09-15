# pr-008：层 B 行为用例（F03/F08/F09/G02）

## 上下文摘要

落 `test/sdk-uds.test.js`：起真实 Router 后覆盖层 B 8 个方法各一例、库面注册闭环（connect → register → heartbeat → send → ack → deregister → close，并核对拓扑侧上下线可见）、UDS 不可达降级（单一明确错误 + 退出码 3 + 立即结束）与无自动性断言。用例经 pr-004 的 `hub-harness.js` 起子进程，不写仓库内运行态目录。

## 涉及功能点

- F03
- F08
- F09
- G02

## 文件范围

- `oamp/test/sdk-uds.test.js`（新建：8 方法各一例 + 库面注册闭环 + 不可达降级 + 无自动性 + 无跨调用状态）

## 验收标准

- [ ] 起真实 Router 后 8 个方法各成功调用一次，返回值与经 `RpcPeer` 直连得到的 JSON-RPC `result` 一致（字段不改名、不加信封）（F03 验收 1/2）
- [ ] 库面注册闭环可完成：`hub.uds.connect()` → `register` → `heartbeat` → `send` → `ack` → `deregister` → `close` 全程走通，且拓扑侧可见该实例上线、消息到达、下线（F03 验收 3）
- [ ] 拓扑盘点：`hub uds router.status` 与 `hub api agents` 的输出含在线实例清单（F03 验收 4）
- [ ] shell 面零手写协议：注册 / 心跳 / 收发 / 注销均经 `hub uds …` 子命令完成，用例内不出现手写 socket 或自建帧编解码（F03 验收 3 的判定面）
- [ ] 不可达降级：UDS 端点不存在 → 单一明确错误（**无堆栈**）+ 退出码 `3` + 立即结束（不挂起）；连接建立超 2000ms 同归 `3`（F08 验收 1/2/3/4）
- [ ] 无自动性：一次不可达失败后，用例观察到无自动重连 / 自动重试 / 自动心跳循环产生的后续动作或进程（G02 验收 3 / L2-9）
- [ ] 无跨调用状态：注销后的新进程再次调用不依赖此前上下文、无本地状态文件残留（F09 验收 1/2/4）
- [ ] 用例经 pr-004 的 `oamp/test/helpers/hub-harness.js` 的 `runHub()` 起子进程，并经 pr-004 的 `oamp/sdk/index.js` 走库面（不自行实现第二套子进程辅助）
- [ ] 不写仓库内 `.runtime/` / `data/`（临时 socket 落系统临时目录），不依赖真实 omp / 外网；不修改既有 `oamp/test/helpers/harness.js`（§10 测试基建约束）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T3 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F03-router-uds-method-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F08-disconnect-degradation.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/G02-lifecycle-boundary-preserved.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §5.1 层 B 全表（含注册闭环两条可照做路径）、§5.2、§5.4、§10 T3、§4.1 N-11
- 代码锚点：`oamp/test/helpers/harness.js`（`startRouter` / `makeTempSocketDir` / `buildEnv` / `waitFor` 既有手法）、`oamp/src/rpc.js:57`（`RpcPeer`）、`oamp/src/config.js:136`（`loadConfig`）、`oamp/src/router.js:109/161/186/201/348/379/384/395`（8 个方法分支）

## depends_on

- pr-004-sdk-dual-entry-and-hub-harness.md（理由：shell 面路径经 pr-004 新建的 `oamp/bin/hub.js` 与 `oamp/test/helpers/hub-harness.js` 的 `runHub()`；库面路径 `hub.uds.connect()` 经 pr-004 新建的 `oamp/sdk/index.js` 的 `uds` 命名空间——证据：`architecture.md` §10 T3 与 §4.1 N-2「层命名空间由 `surface.js` 装配」；`oamp/sdk/uds.js`（pr-002）由传递依赖覆盖）

## batch

4
