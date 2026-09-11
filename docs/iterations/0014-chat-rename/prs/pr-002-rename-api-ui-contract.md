# pr-002-rename-api-ui-contract

## 上下文摘要

`web.js` 新增 `POST /api/chats/<id>/rename`（复用 `readBody` / `sendJson` 与既有单条状态变更端点形态：404 → 409 → 400 → 200），并把 `/api/messages` 的内联只读表达式提取为模块级 `isReadonly(chat)` 供两处 409 共用；前端交付详情头标题行内编辑（静态孪生 `input`、`state.titleEdit` 门控、Enter / 失焦提交、Esc 优先、成功后就地回填）；`web.test.js` 同步 API 用例段与静态契约追加断言，`README.md` 同步左右栏描述与 API 表。**硬约束**：`web.test.js` 的两段修改（末尾 API 用例段与 `:1000-1043` 静态契约段）必须同属本 PR，不得拆给两个 PR（文件范围互斥）。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05

## 文件范围

- oamp/src/web.js（修改）
- oamp/web/index.html（修改）
- oamp/web/app.js（修改）
- oamp/web/style.css（修改）
- oamp/test/web.test.js（修改）
- oamp/README.md（修改）

## 验收标准

- [ ] `cd oamp && node --test test/web.test.js` 全绿：新增改名用例覆盖 200（响应 `title` = trim 后权威值，`GET /api/chats/<id>` 与库值一致）、400（`{title:123}` / 空体 `{}` / `{title:null}` / `''` / `'   '` / 101 单位，且读回标题不变）、404（未知对话）、409 双路径（归档后改名文案含「已归档」、closed 后改名文案含「已关闭」，且库值不变）、畸形 JSON 400 / 超限 413
- [ ] 不置顶（服务端断言）：改名成功后该条 `updated_at` 与改名前逐字相等，且 `GET /api/chats` 的 `chat_id` 顺序逐项不变
- [ ] 只读判定不分叉：同一对话「改名 409」与「发消息 409」同真；既有 closed / archived 409 文案与状态码断言零修改通过
- [ ] 静态契约断言通过：`index.html` 含 `id="detail-title-input"` 与 `maxlength="100"`；`app.js` 含 `isReadonly` 与 `titleEdit`；`style.css` 含 `.detail-title-input`
- [ ] 浏览器实测（真实页面，非仅单测）：可编辑对话点击标题 → 出现预填且全选的编辑框；Enter 与失焦**各**触发一次保存；Esc 后标题保持原值且随后点击他处不补保存；已归档 / 已关闭 / 空态点击无编辑框；改名后详情头与左栏对应项立即显示新值且该项列表位置与时间显示不变
- [ ] 回归锁零修改通过：`oamp/test/web.test.js:415-431`「标题取首条输入 40 字符且后续输入不改标题」与既有全部断言

## 参考资料

- docs/iterations/0014-chat-rename/architecture.md（§4 只读判定单一真源 / §5 接口形态 / §6 前端方案 / §7 数据流 / §8.2~§8.3 契约同步 / §10 AR-01~AR-13 / §14.2 硬约束）
- docs/iterations/0014-chat-rename/prd/F01-inline-title-edit-commit.md
- docs/iterations/0014-chat-rename/prd/F02-title-validation.md
- docs/iterations/0014-chat-rename/prd/F03-title-readonly-boundary.md
- docs/iterations/0014-chat-rename/prd/F04-rename-sync-no-reorder.md
- docs/iterations/0014-chat-rename/prd/F05-autotitle-unchanged.md

## depends_on

- pr-001-persist-rename-write-port.md（理由：本 PR 的 `/rename` 路由调用 `db.renameChat({chatId,title})`，该成员由 pr-001 加入 `persist.js` 的导出对象；此外 `test/web.test.js` 的新增改名用例把 web 服务作为子进程真实拉起、经 HTTP 打到该路由，库值断言也依赖写入落点。证据：`oamp/src/web.js:26` `import { openDb } from './persist.js'`、`:180` `db = openDb(config.dbPath)`（`db` 即 persist 模块返回的句柄），而 `oamp/src/persist.js:279-283` 的 `return { insertInput, insertOutput, upsertChat, closeChat, archiveChat, activateChat, listArchivable, startupSweep, listChats, getChat, close }` **当前不含 `renameChat`**；`oamp/test/web.test.js:123` 的 `startWeb(...)` 用 `spawn` 拉真实服务进程 → 本 PR 的改名用例在 `renameChat` 缺席时会 502/断言失败）

## batch

2
