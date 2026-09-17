# pr-006 · 文档面同步（API.md / README.md / llms.txt / skill-hub.md）

## 上下文摘要

把本迭代的行为变化同步到四项文档面：`API.md`（失败终态新增 `reason` 键与其五值闭集、`POST /api/calls` 项级可选参数 `new_session`、超时口径"缺省 = 空闲 10 分钟 + 安全网 4 小时；显式 `timeout_ms` 仍为该轮绝对上限"、取件两端点的"写入时机 = 终态发布 / 跨重启可查 / `acked` 恒 `false`"）、`README.md`（同超时口径）、`skill/hub.md`（取件叙述与 API.md 唯一真源对齐）、`llms.txt`（生成物重生成）。本迭代**不新增 HTTP 路由**（迭代前实测 29 条，与迭代前同值、不增不减）⇒ `hub doctor` R1 不会因缺行失败，但参数表与字段语义属人工同步项，必须与本 PR 的验收一一对应。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07

## 文件范围

- oamp/API.md
- oamp/README.md
- oamp/llms.txt
- oamp/skill/hub.md

## 验收标准

- [ ] `oamp/API.md`：失败终态信封的字段说明含 `reason`（五值闭集、仅失败终态出现、`error` 键保留原拼写与原值）；`POST /api/calls` 参数表含项级可选 `new_session` 及其语义（忽略既有绑定、按最空闲重选并重绑）；§3.12 / §3.13 取件两端点补充"写入时机 = 终态发布那一刻恰一次""跨重启可查""`acked` 恒 `false`"且参数名与响应结构描述与实现一致
- [ ] `oamp/README.md` 的超时描述不再写"omp 默认 1800s（30 分钟）绝对上限"，改为"缺省 = 空闲 10 分钟 / 安全网 4 小时（env 可调）；显式 `timeout_ms` 仍为该轮绝对上限"
- [ ] `oamp/llms.txt` 与 `node oamp/scripts/gen-llms-txt.mjs` 的当刻输出逐字节一致；接口条数**与迭代前同值**（迭代前实测 = **29**，本迭代不新增路由 ⇒ 条数不变；三处同值：`llms.txt` 头部 `## 接口（29 条）`、`llms.txt` 的 `- GET|POST /api/…` 行数、`API.md` §3 表的编号末位）
- [ ] `oamp/skill/hub.md` 的取件 / 等待叙述不与 `API.md` 冲突：等待语义仍指向 `API.md` 为唯一真源、不复述字段
- [ ] 文档描述与实现一致：任取 `reason` / `new_session` / 超时 / 取件四项，文档所述取值或参数形态可在实现中找到对应（`API.md` §3 路由行与 `GET /api/docs` 的 `routes[]` 双向比对通过）

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §5（文档面同步清单与"文档面机械锁提示"）、§4 A-05「文档面同步」、§9-6 / §9-8
- docs/iterations/0030-hub-communication-upgrade/prd/F04-terminal-reason-enum.md、F05-idle-timeout-and-safety-net.md、F07-pool-routing-stickiness.md（`new_session`）、F03-inbox-persistence.md（跨重启与 `acked`）

## depends_on

- pr-005-web-inbox-and-pool-wiring.md（理由：文档描述的字段 / 参数 / 行为由 `web.js` 实现，且 `llms.txt` 是 `web.js` 路由元数据的生成物；证据：`oamp/scripts/gen-llms-txt.mjs:10` 直接 `import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js'`（`:13` 生成并写包根 `llms.txt`），`oamp/sdk/doctor.js:44-70` 的 R1 把 `API.md §3` 与 `GET /api/docs` 的 `routes[]` 双向比对（文档侧行 23/24 = `API.md:194-195`，运行侧登记 = `web.js:1613` / `web.js:1776`），而 `new_session` 的解析点、`reason` 的产生点、取件语义分别落在 `web.js:1342` 段、`web.js:539`、`web.js:1613-1643`/`web.js:1776-1801`）
- pr-004-idle-net-turn-timers.md（理由：README / API 的超时口径对应 agent 侧缺省档的移除；证据：`oamp/src/agent.js:31` `DEFAULT_OMP_TIMEOUT_MS = 1800000` 与三处客户端缺省值（`acp-client.js:319` / `rpc-client.js:14` / `oneshot-client.js:17`）是文档中"默认 30 分钟"的唯一来源，属 pr-004 的改动对象）

## batch

3
