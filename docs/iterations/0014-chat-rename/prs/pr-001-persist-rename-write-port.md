# pr-001-persist-rename-write-port

## 上下文摘要

新增手动改名的唯一写口：`persist.js` 加常量 `TITLE_MAX_MANUAL = 100`、校验函数 `readTitle()`（trim → 非空 → ≤100，非法抛错）、单列语句 `stmts.renameChat`（`SET` 只写 `title`；`WHERE archived_at IS NULL AND state != 'closed'`；以 `changes > 0` 判定是否真的写入）、包装函数 `renameChat({chatId,title})`（返回权威标题 / 未写入返回 `null`）并加入导出表。同步 `persist.test.js`：写口白名单 +1 项 + 新增改名用例。schema / 迁移 / 既有查询与写口 / 自动标题路径零改动。

## 涉及功能点

- F01
- F02
- F03
- F05

## 文件范围

- oamp/src/persist.js（修改）
- oamp/test/persist.test.js（修改）

## 验收标准

- [ ] `cd oamp && node --test test/persist.test.js` 全绿；写口白名单断言（`oamp/test/persist.test.js:171-179`）由 7 项变为含 `renameChat` 的 8 项，且该断言之外既有用例零修改
- [ ] 改名只写 `title`：改名前记录整行，改名后 `updated_at` / `agent_id` / `state` / `archived_at` / `closed_at` / `created_at` / `context_released` 逐列 `assert.equal` 不变，`title` = trim 后新值（返回值为权威标题：`'  季度复盘  '` → `'季度复盘'`）
- [ ] 未写入路径返回 `null` 且库值不变：未知 `chat_id`、已归档行、`state = 'closed'` 行各一例
- [ ] 非法标题抛错（消息以 `标题非法: ` 开头）且库值不变：非字符串、`''`、`'   '`、`'　'`（全角空白）、`'x'.repeat(101)`、`'😀'.repeat(51)`（102 单位）；边界通过：100 单位、`'😀'.repeat(50)`（100 单位）、内部空白保留
- [ ] 与自动路径隔离：`insertInput` 建行后 `renameChat`，再 `insertInput` ⇒ 标题保持手动值（`ensureChat` 的 `ON CONFLICT DO NOTHING` 未被破坏）
- [ ] 回归锁零修改通过：`chats` 9 列列名与 schema 对象集断言（`oamp/test/persist.test.js:60-82`）、自动生成规则断言（40 截断 + 「新对话」兜底，`:233-244`）

## 参考资料

- docs/iterations/0014-chat-rename/architecture.md（§3.1 语句定案 / §3.2 不复用 upsertChat 的逐条对照 / §3.3 readTitle / §8.1 测试同步清单 / §14.2 G1）
- docs/iterations/0014-chat-rename/prd/F01-inline-title-edit-commit.md（AR-02 写入侧）
- docs/iterations/0014-chat-rename/prd/F02-title-validation.md（AR-06 服务端侧）
- docs/iterations/0014-chat-rename/prd/F03-title-readonly-boundary.md（AR-08 SQL 守卫）
- docs/iterations/0014-chat-rename/prd/F05-autotitle-unchanged.md（AR-12 隔离）

## depends_on

（无）

> 本 PR 的验收标准全部由 `oamp/test/persist.test.js` 直接驱动 `openDb()` 返回的句柄判定（`oamp/test/persist.test.js:12` `import { openDb } from '../src/persist.js'`、`:27` `db: openDb(dbPath)`），不经过 `src/web.js` 与 HTTP 端点 ⇒ 可独立合并、独立验收，不依赖任何其他 PR。

## batch

1
