# pr-004-project-workspace-acceptance

## 上下文摘要

为 F01~F08 的新能力与 F10 的三面 / 三锁建立**新测试文件**（`oamp/test/project-workspace.test.js`），把既有测试文件的改动压缩到"项目维度必然变更面"的最小集。只新增测试，不改生产代码与既有测试文件；断言复用既有观测面（`FAKE_ACP_ARGS_LOG` 的 argv、fake ACP 回显、`node:sqlite` 直读、临时 `OAMP_DB` + `fetch`），不依赖真实 omp / 外网。

## 涉及功能点

- F01（创建 / 列出往返、派生名、不归一化、400 / 409、派生列）
- F02（新建归属强制、未知项目 400、数据层 `NOT NULL`）
- F03（项目范围列表、缺参 / 空值 400、既有过滤在范围内生效）
- F04（前端项目视图与 boot 分派静态契约、创建后原地出现）
- F05（顶栏项目名与返回入口、工作台内新建自动归属的前端调用点）
- F06（载荷 `project` 三要素、两条 LLM 路径携带、shell 不携带、原文不被污染）
- F07（注入内容三要素与相对约定、agent 侧注入的可核对性）
- F08（旧结构库重建、三次启动对拍）
- F10（三面自动出现、三条漂移锁 + 零依赖锁）

## 文件范围

- oamp/test/project-workspace.test.js（新建）

## 验收标准

- [ ] 新文件存在且 `npm test` 全绿；本 PR 不修改任何既有测试文件与任何 `oamp/src/**`、`oamp/web/**`、文档文件
- [ ] F01：创建 → 列出往返（`chat_count` / `last_activity_at` 的派生值经 sqlite 直读核对）；名称留空时派生名 = 地址尾段去 `.git`；`…/demo` 与 `…/demo.git` 并存（不归一化）；任意非空可疑地址可创建；缺地址 → `400 INVALID_PARAM` 且项目条数不变；重复地址 → `409 CONFLICT` 且项目条数不变；排序 `created_at DESC, project_id DESC`；项目行不含本地路径字段
- [ ] F02 / F03：`POST /api/messages` 新建路径缺 / 空 `project_id` → `400` 且对话总数不变；指向未知项目 → `400`；带项目归属的新建成功且该对话出现在该项目的列表里；`GET /api/chats` 缺参 / 空值 → `400`，带参只返回本项目对话且与 `total` 同源；既有 `q` / `agent` / `state` / `from` / `to` / `archived` / `limit` / `offset` 在项目范围内语义不变；sqlite 直读 `pragma_table_info('chats')` 与 `NOT NULL` 约束（E4）
- [ ] F04 / F05 静态契约：`index.html` 含 `#projects-view` / `#project-repo` / `#project-name` / `#btn-create-project` / `#project-list` / `#project-hint` / `#project-bar` / `#btn-back-projects` / `#current-project-name`；`app.js` 的 boot 分派与三处带 `project_id` 的调用点在场；`style.css` 含三条真隐藏规则（`.layout.hidden` / `.projects-view.hidden` / `.project-bar.hidden`）
- [ ] F06 / F07：`task.request` 的 `payload.body.project` 含 `name` / `repo_url` / `agreement` 三要素（两条 LLM 分支）；一次性路径 `FAKE_ACP_ARGS_LOG` 的**末位 argv** 含 `repo_url`；常驻路径 fake ACP 回显的回复文本（`out.text`）含 `repo_url`；shell 分支载荷无 `project`；`agreement` 文本无绝对路径 / 盘符 / 主机名、无"已 clone / 已对齐目录 / 已进入项目根目录"一类表述；`messages.text` 与输入逐字相等（E9）；协议方法面仍 7 个
- [ ] F08：造一份不含 `project_id` 的旧结构库 → 启动后 `pragma_table_info('chats')` = 新列集且 `projects` 表存在、`chats` / `messages` 行数为 0（旧行消失、无兜底归属）；连起两次第二次不重建（数据保留）；删库文件后重启 ⇒ 新建空库可用且可创建项目 / 对话（E6）
- [ ] F10：`GET /api/docs` 投影 13 条（写接口 6 条）、`/docs` 与 `/debug` 面自动出现且零改动、`llms.txt` 快照与 `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 逐字节相等、`API.md` 路径级双向覆盖、`dependencies === {}`
- [ ] 断言不依赖真实 omp / 真实 LLM / 外网，且不写仓库内 `oamp/data/sql.db`（`OAMP_DB` 一律指向临时目录）

## 参考资料

- docs/iterations/0017-project-workspace/prd/F01-project-entity.md
- docs/iterations/0017-project-workspace/prd/F02-chat-requires-project.md
- docs/iterations/0017-project-workspace/prd/F03-chat-list-scoped-by-project.md
- docs/iterations/0017-project-workspace/prd/F04-project-list-page.md
- docs/iterations/0017-project-workspace/prd/F05-project-workspace.md
- docs/iterations/0017-project-workspace/prd/F06-dispatch-payload-project-context.md
- docs/iterations/0017-project-workspace/prd/F07-context-content-and-injection.md
- docs/iterations/0017-project-workspace/prd/F08-legacy-db-rebuild.md
- docs/iterations/0017-project-workspace/prd/F10-route-registration-and-locks.md
- docs/iterations/0017-project-workspace/architecture.md（§8.1 新断言落点 / §8.4 E5 / E9 / E6 / E8 的观测面）
- oamp/test/web.test.js:124（`startWeb` 既有体例）、oamp/test/api-routes.test.js:58（同款）、oamp/test/acp-daemon.test.js:27（fake ACP 与 `FAKE_ACP_ARGS_LOG` 体例）、oamp/test/helpers/harness.js（`startRouter` / `startAgent` / `buildEnv` / `waitFor`）

## depends_on

- pr-001-project-context-injection.md（理由：F06 / F07 的观测断言读该 PR 引入的符号与产物——`oamp/src/agent.js` 的一次性路径 argv 末位前缀与 `oamp/src/context-pool.js` 的 `sentTurns === 0` 首轮注入（`ContextSession.prompt()` 的 `projectContext` 参数、`_pump()` 的前缀判定）。缺它 ⇒ argv 末位与 `out.text` 都只有原文，本文件的 F06 / F07 断言必红）
- pr-002-project-data-and-http.md（理由：F01~F03 / F08 / F10 的断言直接调用该 PR 的产物——`oamp/src/web.js` 路由表末位的 `GET` / `POST /api/projects` 两条表项、`/api/chats` 的 `project_id` 必填校验、`/api/messages` 的归属校验与载荷 `project` 字段、`oamp/src/persist.js` 的 `projects` 表与 `chats.project_id` 列（`pragma_table_info('chats')`）、`oamp/llms.txt` 与 `oamp/API.md` 的快照字节。缺它 ⇒ 相关断言必红）
- pr-003-project-layer-ui.md（理由：F04 / F05 的静态契约断言读该 PR 引入的节点与函数——`oamp/web/index.html` 的 `#projects-view` / `#project-bar` 等静态节点、`oamp/web/app.js` 的 boot 分派与 `loadChats()` / `loadArchived()` / `send()` 三处带 `project_id` 的调用点、`oamp/web/style.css` 的三条隐藏规则。缺它 ⇒ 相关断言必红）

## batch

3

说明：F09（既有行为零变化 / 回归锁）的判定载体是 pr-002 的四个既有测试文件的 diff 形态（§8.3 四类形态核对），不在本文件内（architecture §8.1 未把 F09 列入新文件的断言面）。
