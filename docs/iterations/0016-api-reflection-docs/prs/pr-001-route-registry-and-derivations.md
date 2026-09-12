# pr-001-route-registry-and-derivations

## 上下文摘要

src/web.js 扁平 if 链改为 12 项有序路由表并由表驱动分发（handler 体逐字不动），新增 GET /api/docs 投影、静态映射表与 .txt/.md MIME、llms.txt 快照与生成器、三条漂移锁，API.md 补路径登记。既有用例零字节改动。/docs、/debug 只登记映射，页面由 pr-002 交付。

## 涉及功能点

- F01
- F02
- F05
- F06
- F08

## 文件范围

- oamp/src/web.js（修改）
- oamp/scripts/gen-llms-txt.mjs（新建）
- oamp/web/llms.txt（新建）
- oamp/API.md（修改）
- oamp/test/api-routes.test.js（新建）

## 验收标准

- [ ] `oamp/src/web.js` 新增具名导出 `createApiRoutes` / `matchRoute` / `projectRoutes` / `renderLlmsTxt`；`createApiRoutes({})` 返回 12 个表项且不抛错（纯构造：不调用依赖、不读磁盘、不起定时器）。
- [ ] 分发仍由表驱动且顺序 = 改造前 `if` 链顺序：`GET /api/chats/archive` → 404 `chat 不存在: archive`；`GET /api/chats/` → `chat 不存在: `；`GET /api/chats/a/b` → `chat 不存在: a/b`；`POST /api/chats/a/b/close` → `chat 不存在: a/b`；`GET /api/agents/` → 404 `not found: GET /api/agents/`。
- [ ] `node --test oamp/test/api-routes.test.js` 全绿：F06 三条漂移锁各一个独立顶层用例 + C-5 七条与 Q-1~Q-8 的 L2 探针 + 匹配器 L3 单测（含"每个表项不被更靠前表项吞掉"的可达性断言）。
- [ ] `oamp/test/web.test.js` 零字节改动（对该文件 `git diff` 为空）且其全部顶层用例通过；其余 19 个既有测试文件未改动且通过。
- [ ] 起真实 web 实例：`GET /api/docs` → 200 `application/json; charset=utf-8`，`routes` 为 11 条（含本接口自身），每项含 `danger`（由 `method !== 'GET'` 派生）与 `docLink`。
- [ ] `GET /llms.txt` → 200 `text/plain; charset=utf-8`，响应内容与 `oamp/web/llms.txt` 逐字节相等；`node oamp/scripts/gen-llms-txt.mjs` 重新生成后工作区无差异（快照新鲜）。
- [ ] 锁③双向差集为空：登记侧 11 条签名集合与从 `oamp/API.md` 抽取的路径签名集合互不缺失、不多出。
- [ ] 错误兜底覆盖面不缩小：`GET /api/chats/%E0%A4%A` → 502 且文案为 `router 不可达或请求失败: URI malformed`；`PUT /api/agents` → 404 `not found: PUT /api/agents`（无 405）。
- [ ] `oamp/package.json` 未改动（`dependencies` 仍为 `{}`），`oamp/test/hygiene.test.js` 通过。
- [ ] `oamp/API.md`：顶部新增一行指向 `/docs` 的引用块；§3 标题为「11 条」并含 `GET /api/docs` 的登记行与 `### 3.11` 小节；既有 10 小节的文案逐字未改。（该链接的目标页由 pr-002 交付，链接"能打开页面"的完整判定在 pr-002 的验收标准内。）

## 参考资料

- docs/iterations/0016-api-reflection-docs/prd/F01-declarative-route-table.md
- docs/iterations/0016-api-reflection-docs/prd/F02-existing-api-behavior-unchanged.md
- docs/iterations/0016-api-reflection-docs/prd/F05-llms-txt.md
- docs/iterations/0016-api-reflection-docs/prd/F06-drift-locks.md
- docs/iterations/0016-api-reflection-docs/prd/F08-api-md-cross-link.md
- docs/iterations/0016-api-reflection-docs/architecture.md（§3 路由表与匹配、§4 行为保真、§5 派生产物、§7 三条漂移锁、§9.1 API.md 同步点、§10 L1-01/L1-02）

## depends_on

（无）

## batch

1
