# pr-004：双消费入口与 hub 子进程测试助手（F01/F09/F13/G01）

## 上下文摘要

`package.json` 的 `bin` 只追加 `hub: ./bin/hub.js`（其余不变），`bin/hub.js` 沿用 `bin/oamp.js` 形态转调 `sdk/cli.js` 的 `main`，`sdk/index.js` 提供 `createHub()` → `{ api, uds, cli, doctor }`；同 PR 落 `hub-harness.js`，供 pr-007~pr-010 复用。

## 涉及功能点

- F01
- F09
- F13
- G01

## 文件范围

- `oamp/sdk/index.js`（新建：库入口 `createHub({ port, socketPath })` → `{ api, uds, cli, doctor }`，层命名空间由 `surface.js` 装配）
- `oamp/bin/hub.js`（新建：第二个可执行入口，形态逐字沿用 `bin/oamp.js`）
- `oamp/package.json`（修改：`bin` 字段追加 `"hub": "./bin/hub.js"`；**只加这一个键**）
- `oamp/test/helpers/hub-harness.js`（新建：起 `hub` 子进程 + 收集 stdout/stderr/退出码；`N-11` 的创建条件由本迭代的四个用例满足）

## 验收标准

- [ ] `oamp/package.json` 的 `bin` 只追加 `"hub": "./bin/hub.js"`；`dependencies` 逐字仍为 `{}`、`engines.node` 沿用既有取值、`type` / `scripts` 逐字不变（F01 验收 1/5、§4.2 M-1）
- [ ] `oamp/bin/hub.js` 与 `oamp/bin/oamp.js` 同形：`import { main } from '../sdk/cli.js'; process.exitCode = await main(process.argv.slice(2))`（F01 验收 1）
- [ ] 在 `oamp/` **之外**的任意目录（如系统临时目录）执行 `node <包根>/oamp/bin/hub.js --help` 与 `node <包根>/oamp/bin/hub.js api docs`（hub 运行中）均正常，结果与在仓库内执行一致；模板不需要 `cd` 前置（F13 验收 2/3）
- [ ] `oamp/bin/hub.js` 内不出现凭据类字段名（`oamp/test/hygiene.test.js` 的扫描面含 `bin/*.js`：`token` / `api_key` / `secret` / `password` / `credential` / `authorization` / `private_key`）（G01 验收 3、architecture §8 C7）
- [ ] `await import('<包根>/oamp/sdk/index.js')` 得到 `createHub`；`createHub()` 返回 `{ api, uds, cli, doctor }` 四个命名空间；`hub.api.agents({ state: 'online' })` 对运行中的 hub 返回服务端响应体原对象、`hub.cli.run(['status'])` 返回 `{ exit_code, stdout, stderr }`（F01 验收 3、§5.2）
- [ ] 同一份入口表驱动两面：改动 `oamp/sdk/surface.js` 中一条入口的定义（如某条输出的取值），CLI 面与库面**同时**体现该改动（F01 验收 2 / §5.2 规则 1）
- [ ] `createHub()` 每次返回新对象，无模块级可变状态、零本地写（F09 验收 1/3、§5.2 规则 4）
- [ ] `oamp/test/helpers/hub-harness.js` 导出 `runHub(args, { env, input, timeoutMs } = {})` → `{ code, stdout, stderr }`：起 `node <包根>/bin/hub.js` 子进程、收集 stdout/stderr、限时退出（**跨 PR 接口契约**，pr-007 / pr-008 / pr-009 / pr-010 直接消费该签名）
- [ ] harness 及自测不写仓库内 `.runtime/` / `data/`（临时 socket / 临时库一律落系统临时目录），不依赖真实 omp / 外网（§10 测试基建约束）
- [ ] 零新增依赖（F01 验收 5）
- [ ] 本 PR 的 diff 不含 `oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`，不新增任何路由（G01 验收 1/4/5）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F01-sdk-package-and-dual-consumption.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F13-skill-sdk-entry-addressing.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/G01-hub-interface-unchanged.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §3.1（L1-1）、§4.1 N-1 / N-2 / N-11、§4.2 M-1、§4.4 顺序约束 6（`package.json` 的 bin 一行与 `bin/hub.js` 同一提交）、§5.2、§5.6（入口定位模板）、§8 C7、§10 测试基建约束
- 代码锚点：`oamp/package.json`（现状：`bin` 只有 `oamp`、`dependencies` 为 `{}`、`engines.node >= 22`）、`oamp/bin/oamp.js`（被逐字沿用的形态）、`oamp/src/cluster.js`（`BIN` 按模块位置推导的既有先例）、`oamp/test/helpers/harness.js`（`collectStream` / `waitFor` 手法）、`oamp/test/web.test.js:126`（`spawn(process.execPath, [BIN, ...])` 的既有做法）、`oamp/test/hygiene.test.js:28`（扫描面 = `bin/` + `src/` + `package.json`）

## depends_on

- pr-003-sdk-entry-surface-cli-and-doctor.md（理由：`oamp/bin/hub.js` 导入的 `main` 由 pr-003 新建的 `oamp/sdk/cli.js` 导出；`oamp/sdk/index.js` 的 `{ api, uds, cli, doctor }` 由 pr-003 新建的 `oamp/sdk/surface.js` 装配，其中 `doctor` 命名空间引用 pr-003 的 `oamp/sdk/doctor.js` 的 `check()` —— 证据：`architecture.md` §4.1 N-1「形态逐字沿用 `bin/oamp.js`（`import { main } from '../sdk/cli.js'`）」与 N-2「层命名空间由 `surface.js` 装配」，以及 §2.1 组件图的 `BIN --> CLI`）

## batch

2
