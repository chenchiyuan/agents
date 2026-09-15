# pr-001：SDK 错误契约与 Web 通道（F02/F06/F07/F08/F09/F10/G01）

## 上下文摘要

`errors.js` 定 `HubError` 与四类退出码归类表（0/1/2/3，首条命中者生效）；`http.js` 实现 21 条接口所需的 `node:http` 请求原语与 SSE 帧读取器，含连接 2000ms / 响应 5000ms 上限与 `--wait` 本地中止。约束：零依赖、请求与响应原样透传、不代做跨端点语义、每请求一连接、零本地写。本 PR 尚无可执行入口（bin 在 pr-004），验收以模块级实测判定。

## 涉及功能点

- F02
- F06
- F07
- F08
- F09
- F10
- G01

## 文件范围

- `oamp/sdk/errors.js`（新建：`HubError` + 四类退出码归类表 + 错误对象序列化）
- `oamp/sdk/http.js`（新建：`node:http` 客户端 + SSE 帧读取器 + 连接/响应上限）

## 验收标准

- [ ] `oamp/sdk/errors.js` 导出 `HubError`，实例携带 `.code` / `.exitCode` / `.httpStatus` / `.upstream`，`exitCode` 取值恒 ∈ {1,2,3}（§5.2 规则 3 / F07 验收 4）
- [ ] 归类表逐条覆盖 §5.4 四类判定规则（首条命中者生效）：本地 argv 解析失败 → `2`；连接建立失败（`ECONNREFUSED`/`ENOENT`/`ECONNRESET`/`EPIPE`/超 2000ms）｜非阻塞条目 5000ms 内无响应（`REQUEST_TIMEOUT`）｜订阅被服务端异常终止｜`UPSTREAM_UNAVAILABLE`(502) → `3`；上游 4xx-5xx（`error`/`code` 原样）｜`WAIT_TIMEOUT`｜`CONFIG_ERROR` → `1`；其余 → `0`（F07 验收 1~5、F08 验收 2、F10 验收 5）
- [ ] `oamp/sdk/http.js` 用 `node:http` 发请求：method + path（路径参数已替换）+ query/body **原样**透传，成功返回服务端响应体原对象（不加信封、不改字段名）（F02 验收 2 / §5.2 规则 2）
- [ ] 模块级实测：起既有 `oamp web start`（随机端口 + 临时 `OAMP_DB`，沿用 `oamp/test/web.test.js:126` 的做法）后调用 `GET /api/agents`（`API.md` §3 第 1 条），返回体与 `node:http` 直连结果逐字段一致（F02 验收 2）
- [ ] 上游 4xx/5xx 时抛 `HubError`，`.code` 为上游 `code` 原文、`.httpStatus` 为实际状态码、`.upstream` 持上游错误对象原样（F02 验收 3、F07 验收 2）
- [ ] 连接级失败：未监听端口 → `HUB_UNREACHABLE` / `exitCode === 3`；连接建立超 2000ms 同归 `3`；不挂起（F08 验收 1/2/3/4）
- [ ] 非阻塞条目 5000ms 内无响应 → `REQUEST_TIMEOUT` / `exitCode === 3`（§5.4）
- [ ] SSE 读取器按空行切帧、取 `event:` / `data:`，忽略 `:` 注释行与 `retry:` 帧；对真实服务订阅 `GET /api/events` 能起流并在有事件时逐帧产出 `{event, data}`（F06 验收 1/2/4、§5.3）
- [ ] `--wait` 到上限时本地中止（`req.destroy()`）并抛 `WAIT_TIMEOUT` / `exitCode === 1`，服务端调用不因此终止（F10 验收 3/5、§5.4）
- [ ] 一层一次请求：本条目不出现跨端点组合逻辑（不重建 `truncated` 正文、不做 roster 反查）（F02 验收 2 / W3 / P-1 口径）
- [ ] 无跨调用状态：每请求建连、结束即关；不写任何本地文件（F09 验收 1/2）
- [ ] 零新增依赖：仅用 `node:` 内置模块（F01 验收 5 / C1）
- [ ] 本 PR 的 diff 不含 `oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`，不新增任何路由（G01 验收 1/2/4/5）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F02-web-api-surface-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F06-subscription-ndjson-stream.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F07-exit-code-semantics.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F08-disconnect-degradation.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F10-wait-timeout-limit.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §4.1 N-4 / N-8、§4.4 顺序约束 2~3、§5.2、§5.3、§5.4、§10 T2
- 代码锚点：`oamp/src/node-client.js:10`（`DEFAULT_CONNECT_TIMEOUT_MS = 2000`）、`oamp/src/status.js:18`（`CONNECT_TIMEOUT_MS = 2000` 同值先例）、`oamp/src/agent.js:31`（`DEFAULT_OMP_TIMEOUT_MS = 1800000`）、`oamp/src/web.js:475`（`createApiRoutes` 路由登记）、`oamp/src/web.js:1384`（`projectRoutes`）、`oamp/test/web.test.js:126`（起 web 子进程 + 随机端口 + 临时库的既有做法）、`oamp/API.md` §3（21 条清单）/ §4（SSE 事件表）

## depends_on

（无）

## batch

1
