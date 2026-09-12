# pr-002-project-data-and-http

## 上下文摘要

项目数据层与 HTTP 面：`persist.js` 换新 schema（`projects` 表 + `chats.project_id NOT NULL REFERENCES` + 项目索引）、删 `migrate()`、`openDb()` 内旧库判据与删库重建、新增项目读写口与 `listChats` 项目过滤；`web.js` 末位追加两条 `/api/projects` 表项、`/api/chats` 增必填 `project_id`、`/api/messages` 增归属校验与载荷 `project`。文档三件必须同 PR（漂移锁②③），既有 4 个测试文件只做机械变更。

## 涉及功能点

- F01（项目实体：创建 / 列出 / 400 / 409 / 不归一化）
- F02（新建对话必须归属项目；归属列 DDL 与既有处理顺序的关系）
- F03（对话列表以项目为范围；`project_id` 必填与 400 触发条件）
- F06（投递端：两条 LLM 分支的载荷 `project` 字段与 shell 分支不变）
- F08（旧结构库启动即重建；`MIGRATIONS` / `migrate()` 删除）
- F09（承载 C-7 的四处必然变更面：`POST /api/messages` 新建路径、`GET /api/chats`、`chats` 列集断言、旧库断言语义反转）
- F10（两条表项的元数据、三面自动派生的登记义务、三条漂移锁 + 零依赖锁）

## 文件范围

- oamp/src/persist.js（修改）
- oamp/src/web.js（修改）
- oamp/API.md（修改）
- oamp/llms.txt（重新生成，不手改：`node oamp/scripts/gen-llms-txt.mjs`）
- oamp/README.md（修改）
- oamp/test/persist.test.js（修改：§8.2 ①）
- oamp/test/web.test.js（修改：§8.2 ②）
- oamp/test/api-routes.test.js（修改：§8.2 ③）
- oamp/test/acp-daemon.test.js（修改：§8.2 ④）

## 验收标准

- [ ] `persist.js` 的 schema 落地 §2.1：`projects(project_id TEXT PRIMARY KEY, name TEXT NOT NULL, repo_url TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`；`chats` 10 列（`project_id` 插在 `chat_id` 之后、`NOT NULL REFERENCES projects(project_id)`、既有 9 列相对顺序逐位不变）；`idx_chats_project_updated(project_id, updated_at DESC)`；`CHAT_COLUMNS` / `MESSAGE_COLUMNS` 逐字不变
- [ ] `GET /api/projects`：`200 {projects:[{project_id, name, repo_url, created_at, chat_count, last_activity_at}]}`，排序 `created_at DESC, project_id DESC`，无分页参数；`chat_count` 含已归档 / 已关闭，无对话项目 `last_activity_at === null`（sqlite 直读核对 `COUNT` / `MAX`）
- [ ] `POST /api/projects`：`repo_url` 缺失 / 空 / 非字符串 → `400 INVALID_PARAM`（`需要 repo_url（非空字符串）`）且不产生项目；重复地址 → `409 CONFLICT`（`项目已存在: <repo_url>`，由 `UNIQUE(repo_url)` + `ON CONFLICT DO NOTHING` + `changes > 0` 判定）；`name` 缺省 / 空 / 非字符串 ⇒ 派生（`https://github.com/acme/demo.git` → `demo`，派生为空 ⇒ 用地址原文）；`…/demo` 与 `…/demo.git` 可各自创建（不归一化）；任意非空可疑地址创建成功（不校验形态 / 域名 / 可达性）
- [ ] `GET /api/chats`：缺 `project_id`（`qs.get()` 为 `null`）与空值（`''`）**都** → `400 INVALID_PARAM`（`查询参数非法: project_id 不能为空（对话列表以项目为范围）`）；带项目 ⇒ 只返回该项目对话，且 `countChats` 与列表共用 `LIST_FROM`（`total` 与集合同源）；既有 `q` / `agent` / `state` / `from` / `to` / `archived` / `limit` / `offset` 在项目范围内语义不变；响应形状与行内字段逐字不变（不含 `project_id`）；未知 `project_id` ⇒ `200` 空列表
- [ ] `POST /api/messages`：新建路径（`db.getChat(chatId) === null`）缺 / 空 `project_id` → `400`（`新对话需要 project_id（对话必须归属一个项目）`，**不产生任何对话**）、指向未知项目 → `400`（`项目不存在: <project_id>`）；校验插在既有全部校验之后、`db.insertInput` 之前 ⇒ 既有 400 / 413 / 409 的触发条件与顺序逐字不变；目标对话已存在 ⇒ `project_id` 不参与判定
- [ ] 派发载荷：两条 LLM 分支含 `project: {name, repo_url, agreement}`（`agreement` 取自 `PROJECT_AGREEMENT` 常量原文）；shell 分支（`!` 前缀）载荷逐字不变、无 `project`；`messages.text` 仍为用户原文（E9）；`sendUpdate` 的 prompt 摘要 / `label` 不带项目块
- [ ] `openDb()`：旧结构库（`pragma_table_info('chats')` 有行且无 `project_id` 列）⇒ `db.close()` → `rmSync(dbPath)` → 重新 open（新列集 + `projects` 表存在 + `getChat('chat-old') === null` + 两表行数 0）；已是新结构 ⇒ 不重建、既有数据保留；删库文件后重启 ⇒ 新建空库可用；`MIGRATIONS` / `migrate()` 已删除（不得保留补列路径）
- [ ] F10 三面与三锁：`EXPECTED_SIGNATURES` 13 条（含 `GET` / `POST /api/projects`，追加末位）；`GET /api/docs` 投影 13 条且写接口（`danger`）6 条；`oamp/llms.txt` 与 `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 逐字节相等（用既有脚本重生成）；`API.md` 路径级双向覆盖（`## 3. 接口清单（13 条）` + `| 12 |` / `| 13 |` 行 + §3.12 / §3.13 的反引号签名）；`package.json` 的 `dependencies === {}`；`/docs`、`/debug` 页面零改动
- [ ] 既有 4 个测试文件的 diff 只含 §8.3 的四类形态：① `/api/chats` 列表调用点补 `project_id`；② `POST /api/messages` 新建路径补 `project_id`；③ `persist` 的 schema / 旧库断言 / 建行调用点参数（含 `openTempDb()` 的 1 个项目 fixture 与 `listChats()` 调用点补 `project`——实测该文件有 45 处 `insertInput` / 29 处 `upsertChat` / 43 处 `listChats`，其中无参 `listChats()` 在项目必填后同样需要补参）；④ 派发载荷观测断言与登记面计数（11 → 13）。**不允许**：断言语义放宽、既有断言删除、超时 / 等待策略调整、整文件格式化、顺手改进文案
- [ ] 其余 18 个测试文件零改写（含 `test/api-pages.test.js`、`test/context-pool.test.js` 以及全部直投 payload 的测试）且全绿

## 参考资料

- docs/iterations/0017-project-workspace/prd/F01-project-entity.md
- docs/iterations/0017-project-workspace/prd/F02-chat-requires-project.md
- docs/iterations/0017-project-workspace/prd/F03-chat-list-scoped-by-project.md
- docs/iterations/0017-project-workspace/prd/F06-dispatch-payload-project-context.md
- docs/iterations/0017-project-workspace/prd/F08-legacy-db-rebuild.md
- docs/iterations/0017-project-workspace/prd/F09-existing-behavior-unchanged.md
- docs/iterations/0017-project-workspace/prd/F10-route-registration-and-locks.md
- docs/iterations/0017-project-workspace/architecture.md（§2 数据模型与 DDL / §3 HTTP 面 / §6 登记与工程锁 / §8.2 既有变更面 / §8.3 可核对口径 / §10.3 D-01~D-04）
- oamp/src/persist.js:12（`SCHEMA`）、:42（`MIGRATIONS`）、:47（`migrate`）、:60（`CHAT_COLUMNS`）、:153（`openDb`）、:225（`insertInput`）、:280（`listChats`）
- oamp/src/web.js:261（`STATIC_FILES`）、:313（`createApiRoutes`）、:344（`/api/chats` handler）、:600（`/api/messages` handler）、:667（`payloadBody` 装配）、:803（`openDb(config.dbPath)`）
- oamp/test/api-routes.test.js:36（`EXPECTED_SIGNATURES`）、:186 / :268 / :293（三条漂移锁）、:455 / :478（投影与 `llms.txt` 计数）、:490（`API.md` 同步）
- oamp/test/persist.test.js:56（chats 列集断言）、:73（旧库断言，本次语义反转）
- oamp/test/web.test.js:443 / :546 / :549 / :557 / :943（派发载荷观测断言）、oamp/test/acp-daemon.test.js:411（一次性回显断言）

## depends_on

- pr-001-project-context-injection.md（理由：本 PR 必须随 `web.js` 开始下发 `payload.body.project` 一并改写既有**派发载荷观测断言**，而这些断言只有 pr-001 的注入产物在场才可能通过。证据：`oamp/test/web.test.js:443`（`收到：web-contract-check`，新对话首轮常驻回显）、`:546`（`收到：默认路径问题`）、`:549`（`one-shot answer: 一次性问题`，一次性路径**每次**注入）、`:557`（`a[a.length - 1] === '一次性问题'`，`omp -p` 末位 argv）、`:943`（`收到：无订阅者`）与 `oamp/test/acp-daemon.test.js:411`（`one-shot answer: 请记住数字 7`）—— 这些字符串在注入生效后必然变成 `收到：【项目上下文】…` / 末位 = 前缀 + 原文；前缀由 pr-001 的 `oamp/src/agent.js`（`runOmpTask` 的末位 `args.push`，:173）与 `oamp/src/context-pool.js`（`ContextSession.prompt()` :144 的可选参数 + `_pump()` :165 的 `sentTurns === 0` 分支）产生。缺 pr-001 ⇒ 上述改写后的断言必红；保留旧断言同样必红（输出已多出前缀）；放宽语义又被 §8.3 禁止 ⇒ 本 PR 的既有测试面无法自洽。）

## batch

2

备注（阶段 5 核对口径，不改变依赖判定）：按 §8.2 ②(d) 的枚举，`web.test.js:632` / `:638` 位于同一 `(chat_id, agent_id)` 会话的第二轮，按"首轮一次"语义应不注入、一般不需改写；真正必然改写的是第一轮常驻回显、一次性路径回显与末位 argv 断言。逐条以代码实际为准（见本 PR 报告第 4 条的出入说明）。
