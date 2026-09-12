# pr-002-docs-and-debug-pages

## 上下文摘要

新增 docs/debug 两页 + 共享 api-pages.css：加载时取 /api/docs 渲染字段表与表单（消费 pr-001 的投影字段），含真实发送、耗时、SSE 订阅、写操作确认。顶栏加 2 入口、style.css 加 1 条规则、README 同步；新增 api-pages.test.js。

## 涉及功能点

- F03
- F04
- F07
- F08

## 文件范围

- oamp/web/docs.html（新建）
- oamp/web/docs.js（新建）
- oamp/web/debug.html（新建）
- oamp/web/debug.js（新建）
- oamp/web/api-pages.css（新建）
- oamp/web/index.html（修改）
- oamp/web/style.css（修改）
- oamp/README.md（修改）
- oamp/test/api-pages.test.js（新建）

## 验收标准

- [ ] `GET /docs`、`GET /debug` 返回 200 且类型为 `text/html; charset=utf-8`；`GET /docs.js`、`GET /debug.js` 为 `text/javascript; charset=utf-8`；`GET /api-pages.css` 为 `text/css; charset=utf-8`（直接输入地址与顶栏点击两条路径都可达）。
- [ ] `oamp/web/index.html` 顶栏新增「文档」「调试」两个真实锚点（href 分别指向 `/docs`、`/debug`），既有 3 个占位项逐字未变；`oamp/web/style.css` 相对改造前只追加 `a.nav-item { text-decoration: none; cursor: pointer; }` 一条规则，既有规则零改动。
- [ ] 文档页逐接口展示方法 / 路径 / 一句话说明 / 参数（名称·位置·类型·是否必填·说明）/ 请求体字段 / 响应形态 / 错误码；含"参数语义说明为人工撰写，结构与分发来自路由表"标注；页面接口集合与 `GET /api/docs` 的 11 条一致（双向求差为空）；全页零响应示例报文。
- [ ] 调试台接口集合与登记一致（11 条）；无参 / 查询参数 / 路径参数 / 多类型请求体四类接口生成的控件与其 `params` 字段一一对应；选中只读接口发送后展示真实状态码、响应体与毫秒耗时。
- [ ] 调试台页面顶部有静态风险提示"该页面直接作用于本机正在运行的应用，请求真实生效"；每个 POST 接口首次点击发送**不发出请求**（服务端零变化）并出现一次显式确认，确认后才真实发出；写类接口在接口列表与表单顶部两处都有可见危险标识，只读接口无标识。
- [ ] 调试台对 `/api/events` 与 `/api/stream?chat_id=<真实 id>` 可建立订阅、按到达顺序追加事件、可主动停止（停止后不再收到事件）；刷新后无任何历史留存。
- [ ] `node --test oamp/test/api-pages.test.js` 全绿（两个新页面与顶栏入口的静态契约 + `/docs`、`/debug`、`/llms.txt` 的 HTTP 可达性与响应类型）。
- [ ] `oamp/README.md` 三处同步完成：HTTP 表 +1 行 `GET /api/docs`；「Web 控制台」段 +2 条入口（`/docs`、`/debug`）；新增「接口文档与索引」小段（三个地址 + 快照现址 + `node scripts/gen-llms-txt.mjs` 重新生成命令）。
- [ ] 从 `oamp/API.md` 顶部新增的链接可打开文档页（F08 验收 3 的完整判定）；文档页**每个**接口的 `API.md` 链接均可点开（F08 验收 4）。
- [ ] `oamp/test/web.test.js` 零字节改动（`git diff` 为空）且其全部顶层用例通过（顶栏改动未破坏既有前端静态契约断言）。

## 参考资料

- docs/iterations/0016-api-reflection-docs/prd/F03-docs-page.md
- docs/iterations/0016-api-reflection-docs/prd/F04-debug-console.md
- docs/iterations/0016-api-reflection-docs/prd/F07-write-guard.md
- docs/iterations/0016-api-reflection-docs/prd/F08-api-md-cross-link.md
- docs/iterations/0016-api-reflection-docs/architecture.md（§5.1 投影形状、§6 文档页与调试台、§9.2 README.md 同步点、§13 R-3/R-10）
- docs/iterations/0016-api-reflection-docs/prs/pr-001-route-registry-and-derivations.md（共享契约：`GET /api/docs` 响应形状、表项字段名、`STATIC_FILES` URL 集合、`docLink` 锚点串、`danger` 派生规则）

## depends_on

- pr-001-route-registry-and-derivations.md（理由：本 PR 的三个消费点直接读取 pr-001 产出的符号与 URL 登记——① `oamp/web/docs.js`、`oamp/web/debug.js` 以 `fetch('/api/docs')` 取数并消费 `projectRoutes` 投影出的 `method/path/summary/params/response/errors/kind/danger/docLink` 字段；② `oamp/web/index.html` 新增锚点的 href 目标 `/docs`、`/debug` 与 `oamp/web/api-pages.css` 的可达性来自 pr-001 新增的 `STATIC_FILES` 映射；③ `oamp/test/api-pages.test.js` 断言的 `/docs`、`/debug`、`/llms.txt` 可达性与 `.txt`/`.md` MIME 来自 pr-001 的静态映射与 `STATIC_TYPES`。证据：`oamp/src/web.js:239-253` 的 `serveStatic` 对映射外/缺失文件只回 404，`oamp/src/web.js:733-739` 今日的静态分支只登记 `/`、`/index.html`、`/app.js`、`/style.css`；全仓 `grep -rn "api/docs" oamp/` 在当前基线零命中（该投影来源由 pr-001 新增）。反向依赖不存在：`oamp/test/api-pages.test.js` 与 5 个页面资产不被 pr-001 的任何一个用例读取，`serveStatic` 对缺失文件仅回 404，故 pr-001 可先独立合并并全绿。）

## batch

2
