# pr-007：层 A 行为用例（F02/F05/F06/F09）

## 上下文摘要

落 `test/sdk-api.test.js`：起真实 Router + `oamp web start`（随机端口 + 临时库）后经 `bin/hub.js` 跑层 A——只读端点逐条、写端点各一例、4 条 SSE 起流即得帧，并核对响应体与直连 HTTP 一致、上游 `code` 原样、NDJSON 逐行可解析、跨进程无状态。用例只用 pr-004 的 `hub-harness.js` 起子进程，临时 socket 与库全在系统临时目录。

## 涉及功能点

- F02
- F05
- F06
- F09

## 文件范围

- `oamp/test/sdk-api.test.js`（新建：层 A 逐条行为 + 写端点各一例 + 4 条 SSE + NDJSON 逐行可解析 + 独立进程）

## 验收标准

- [ ] 起真实 Router + `oamp web start`（随机端口 + 临时 `OAMP_DB`，沿用 `oamp/test/web.test.js:126` 的做法）后，层 A 的只读端点逐条至少成功调用一次（F02 验收 1/2）
- [ ] 响应体与既有控制面观察一致：同一端点经 SDK 与直连 HTTP 拿到的结果字段与取值一致（F02 验收 2）
- [ ] 写端点各一例走通（如创建项目 → 发起一次调用），结果字段与 `API.md` §5 示例一致；`truncated` 为真的场景下 SDK 侧仍是"标记为截断的那份结果"，未做正文重建（F02 验收 2 / C-A）
- [ ] 4 条 SSE 入口各"起流即得帧"：命令不立即退出、不报"未实现"，并在有事件时逐帧输出（F02 验收 4、F06 验收 1/4）
- [ ] 订阅输出为 NDJSON：每一行单独 `JSON.parse` 得到 `{ event, data }` 对象，行分隔而非一整份大 JSON 数组（F06 验收 2、T-04）
- [ ] 服务端错误可见：请求不存在的对象 → stderr 错误对象的 `code` 与上游原文一致、退出码 `1`、stdout 无非 JSON 残片（F02 验收 3、F05 验收 4、F07 验收 2）
- [ ] `--human` 两态：同一只读命令加/不加开关，形态明显不同且承载的事实逐项一致（清单条数 / 实例名 / 状态）（F05 验收 2/3）
- [ ] 跨进程无状态：同一命令在两个互不相干的新进程（并发或先后）中各得到完整正确结果，不互相覆盖 / 不串结果（F09 验收 2/3、MI-03 观测口径）
- [ ] 用例经 pr-004 的 `oamp/test/helpers/hub-harness.js` 的 `runHub(args, { env, input, timeoutMs })` 起子进程（跨 PR 接口契约，不自行实现第二套子进程辅助）
- [ ] 不写仓库内 `.runtime/` / `data/`（临时目录），不依赖真实 omp / 外网；不修改既有 `oamp/test/helpers/harness.js`（§10 测试基建约束）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T2 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F02-web-api-surface-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F05-json-output-and-human-flag.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F06-subscription-ndjson-stream.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §5.1 层 A 全表、§5.2、§5.3、§8 C8、§10 T2、§10 测试基建约束、§4.1 N-11
- 代码锚点：`oamp/test/web.test.js:126`（`spawn(process.execPath, [BIN, ...])` + 随机端口 + 临时 `OAMP_DB` 的既有做法）、`oamp/test/helpers/harness.js`（`waitFor` / `collectStream` / `startRouter` 手法）、`oamp/API.md` §3（21 条）/ §4（SSE 事件表）/ §5（可粘贴示例）、`oamp/src/web.js:475`（路由登记）

## depends_on

- pr-004-sdk-dual-entry-and-hub-harness.md（理由：本用例全部经 pr-004 新建的 `oamp/bin/hub.js` 子进程入口执行层 A 子命令，并直接 import pr-004 新建的 `oamp/test/helpers/hub-harness.js` 的 `runHub()` 签名——证据：`architecture.md` §10 T2 的判据依赖 `hub` 可执行入口与 `N-11` 的子进程辅助；`oamp/sdk/http.js`（pr-001）与 `oamp/sdk/surface.js`（pr-003）由本 PR 的传递依赖（pr-004 → pr-003 → pr-001）覆盖）

## batch

4
