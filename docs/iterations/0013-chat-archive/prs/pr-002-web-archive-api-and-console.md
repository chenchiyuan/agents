# pr-002 Web API 与控制台：批量归档、归档视图、激活与文档同步

## 上下文摘要

在 pr-001 数据层之上接线全部用户可见面：`web.js` 透传 `archived`、新增批量归档与激活端点（含释放上下文）、409 扩为 archived/closed 双路径；`web/` 加归档标签、归档全部、加载更多、激活按钮与 `context_released` 提示条；同步 `web.test.js`/`README.md`。前后端互相消费，拆开不可独立验收，故合并。

## 涉及功能点

- F01（入口存在与位置、范围触发、一次轻确认、结果反馈、失败不回滚可重试、零可归档项也反馈）
- F02（归档对话只读 409 且不落 in、历史照常可读、归档即释放常驻上下文）
- F03（归档标签页、与主列表互斥、归档时间倒序、项构成、激活按钮不触发行点击、空态）
- F04（首屏 `limit=200` + `offset` 续页、续页同排序、无更多则不留「加载更多」）
- F05（激活端点、置顶、状态还原、上下文不延续提示条、非归档的 closed 仍被拒）

## 文件范围

- oamp/src/web.js（改造：`/api/chats` 的 `archived` 透传、新增 2 个端点、`/api/messages` 409 双路径）
- oamp/web/index.html（改造：`data-filter="archived"` 标签、`id="btn-archive-all"`、`id="load-more-slot"`）
- oamp/web/app.js（改造：归档视图状态与分页、归档行渲染、激活按钮、批量归档编排、`context_released` 提示条）
- oamp/web/style.css（微改造：`.filters` 对齐、`.archive-all`、`.chat-item .activate`、`.load-more`）
- oamp/test/web.test.js（改造：既有断言保持不变 + 新增接口用例与静态契约用例）
- oamp/README.md（同步：UI 段、API 表、`closed` 收窄例外、归档释放 / 激活不恢复）

## 验收标准

- [ ] `GET /api/chats`：缺省（不传 `archived`）返回不含任何已归档对话——前端 `loadChats()` 无参调用即得主列表；`?archived=1&limit=200&offset=N` 只返回已归档对话、顺序 = `archived_at DESC, chat_id DESC`、响应含该视图 `total`；`archived=2` → `400`（F03-2 / F03-3 / F04-1 / F04-2，D-17）
- [ ] `POST /api/chats/archive` → `200 {archived,failed,failed_ids}` 三键恒存在；`working` 对话未被归档且 `state` 不变；已归档项的 `archived_at` 不被本次改动；零可归档项 → `{archived:0,failed:0,failed_ids:[]}`（F01-2 / F01-4 / F01-8）
- [ ] **只读双路径**：归档后 `GET /api/chats` 不含它、`GET /api/chats?archived=1` 含它；归档对话 `POST /api/messages` → `409 {error:'chat 已归档（只读），不接受新输入'}` 且库中不新增该轮 `in` 记录；`state='closed'` 对话的 409 状态码与文案 `chat 已关闭，不接受新输入` 逐字不变（F02-3 / F02-4）
- [ ] **归档释放上下文**：对每个成功归档的 chat 向 `chats.agent_id ∪ DISTINCT messages.agent_id` 逐条发 `notice{kind:'context_release', chat_id}`，best-effort（agent 离线忽略、不影响响应计数）——以 fake agent 侧观察到该 notice 为判定（F02-7）
- [ ] `POST /api/chats/<id>/activate` → `200 {chat_id,state}`：`closed` 来源的归档项 `state='completed'` 且 `closed_at` 清空，随后 `GET /api/chats` 的 `chats[0]` 即它（置顶）、`GET /api/chats?archived=1` 不再含它；对未归档对话 → `409 {error:'chat 未归档，无法激活'}`；未知 chat → `404`（F05-1 / F05-3 / F05-4 / F05-8）
- [ ] **前端静态与行为契约**：`index.html` 的 `.filters` 含 `data-filter="archived"` 与 `id="btn-archive-all"`（文案「归档全部」）、`#chat-list` 之后有 `id="load-more-slot"`；`app.js` 含 `ARCHIVE_PAGE_SIZE = 200`、`/api/chats?archived=1`、`window.confirm('将归档全部非进行中的对话，是否继续？')`、`.activate` 绑定的 `e.stopPropagation()`、「加载更多」仅当 `chats.length < total` 时渲染、`chat.archived_at === null && chat.context_released === 1` 驱动的头部说明条（激活后可见、首次产生新回答后消失）；`style.css` 含 `.archive-all` 与 `.load-more`（F01-1 / F01-5 / F03-1 / F03-4 / F03-5 / F03-6 / F04-3 / F04-5 / F05-6）
- [ ] **F05-6 行为验收**：激活后打开该对话：可见「此后不再记得此前内容」说明条；向该对话发送一轮并收到回复后，该说明条消失（判据：`archived_at === null && context_released === 1` 时渲染；新回答落库后 `context_released` 复位为 0，刷新/推进后不再渲染）（F05-6 / AR-16 / M-04）
- [ ] `web.test.js:1000-1044` 的既有前端契约（轮询消失 / SSE 订阅 / 新控件 / `@` 与 `!` 保留 / working 计时）与既有列表、过滤、分页、`close`、409、SSE 用例**零删改**仍全绿（AR-17）
- [ ] `README.md`：UI 段（`:126-129`）补「归档」标签、「归档全部」按钮、「激活」与「加载更多」；API 表（`:153-158`）给 `GET /api/chats` 补 `archived`（缺省 0 = 排除已归档）并新增 `POST /api/chats/archive`、`POST /api/chats/<chat_id>/activate` 两行（含 409 / 404 语义）；状态段（`:162`）把「`closed`（终态、不可重开）」收窄为「唯一例外是「归档 → 激活」路径」；上下文段（`:174-175`）补「归档即释放上下文」「激活不恢复上下文」（AR-17）
- [ ] `cd oamp && node --test test/web.test.js` 全绿；本 PR 内 `oamp/src/persist.js`、`oamp/test/persist.test.js`、`oamp/test/acp-daemon.test.js`、其余 17 个既有测试文件零改动

## 参考资料

- docs/iterations/0013-chat-archive/architecture.md §4.3（上下文释放复用）、§4.4（只读双路径）、§5.1（批量归档编排与响应）、§5.2（归档视图查询）、§5.3（激活处理链）、§5.4（端点总览）、§6.1~§6.4（过滤栏 / 交互 / 零改动面 / 只读与提示）、§7.2（web.test.js 改法）、§7.3（README 同步清单）、§8.1~§8.3（三条时序）、§10（AR-01 / AR-02 / AR-03 / AR-06 / AR-07 / AR-09~AR-13 / AR-16 / AR-17）
- docs/iterations/0013-chat-archive/prd/F01（验收 1~8）、F02（验收 3/4/5/7）、F03（验收 1~7）、F04（验收 1~5）、F05（验收 1~8）
- 现行代码锚点：`oamp/src/web.js:24`（`import { openDb } from './persist.js'`）、`:178`（`db = openDb(config.dbPath)`）、`:348-355`（`sendControlNotice`，释放上下文的既有函数）、`:372-390`（`GET /api/chats` 的参数透传与 400 catch）、`:391-400`（详情）、`:401-418`（`<id>/close` 的「预检 → 变更 → `publishState` → agent 集推导 → 应答」形态，`activate` 逐字同构）、`:431-466`（`POST /api/messages` 的 409 分支，本次扩为两条路径）
- `oamp/web/index.html:27-32`（`.filters` 三颗静态按钮 + `#chat-list`）、`oamp/web/app.js:45-55`（`badge`）、`:70-101`（`renderChats` 的内存过滤与 TODAY/OLDER 分组）、`:104-121`（`renderChat` 与 `#btn-close` 禁用条件）、`:283-310`（`handleEvent`）、`:345-352`（`loadChats()` 无参、只取第一页）、`:563-569`（`.filter` 绑定循环）、`oamp/web/style.css:74`（`.filters`）、`:84`（`.filter.active`）、`:275`（`.notice-bar`）
- `oamp/test/web.test.js:289`（列表 `updated_at` 倒序）、`:292-346`（过滤 / 时间范围 / 分页 / 非法参数 400）、`:1000-1044`（前端静态契约，读 `web/app.js`、`web/index.html`、`web/style.css`）
- `oamp/README.md:126-129`（UI 描述）、`:153-158`（HTTP API 表）、`:162`（对话状态段）、`:174-175`（常驻上下文与关闭段）
- 注（与 architecture §14.2 建议分组的差异）：§14.2 把前端（G3）与 `web.js`（G2）列为两组、并各自声明消费 `oamp/test/web.test.js`（G2 的新增用例与 G3 的静态契约用例同处该文件）。按「不同 PR 的文件范围不得重叠」，两组合并为本 PR；`README.md`（§14.2 的 G4）一并并入——它逐条同步的正是本 PR 交付的 UI/API/状态语义，同一文件在两组拆分下无共享符号可写。

## depends_on

- pr-001-persist-archive-schema-and-writes.md（理由：本 PR 的新代码直接消费 pr-001 新增的持久层符号。证据：`oamp/src/web.js:24` 已 `import { openDb } from './persist.js'`、`:178` 已 `db = openDb(config.dbPath)`，且 `:375` 调 `db.listChats(...)`、`:393/:403/:462` 调 `db.getChat(...)`、`:412` 调 `db.closeChat(...)`；本 PR 要在同一 `db` 句柄上调用 pr-001 新增的 `db.archiveChat` / `db.activateChat` / `db.listArchivable`、给 `db.listChats` 传 `archived`、并读 `existing.chat.archived_at`（`:462-466` 处的新 409 分支）——该键只有在 pr-001 把 `architecture.md` §4.1 的 `CHAT_COLUMNS` 扩展后才存在。未合入 pr-001 时，本 PR 的 `web.test.js` 新增用例必然失败：`/api/chats/archive` 与 `/activate` 无对应 SQL 口、`/api/chats?archived=1` 的谓词与 `ORDER BY` 不存在、`existing.chat.archived_at` 恒 `undefined`）

## batch

2
