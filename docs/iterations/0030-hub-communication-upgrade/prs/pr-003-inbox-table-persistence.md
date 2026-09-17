# pr-003 · 收件箱持久表（inbox 表 + 3 个方法）

## 上下文摘要

在既有唯一 SQL 面 `oamp/src/persist.js` 内增量落地收件箱：`SCHEMA` 追加 `inbox` 表（`call_id` 主键、`principal` NOT NULL、`agent` / `chat_id` 可空、`terminal_at`、`envelope` NOT NULL）与覆盖索引 `idx_inbox_principal(principal, terminal_at)`，`openDb` 句柄追加 `insertInbox` / `listInbox` / `deleteInbox` 并导出。写入口径 = 终态发布那一刻恰一次（`INSERT OR IGNORE` ⇒ 重复发布/对账重入幂等、不覆盖首条）；确认口径 = 就地删除（不保留 `acked` 列，未取件侧不设 TTL——未取件集合正是"必达"承诺的载体）。本 PR 只交付持久层能力与其自证，**不接线**（写入/读取点迁移在 pr-005）。

## 涉及功能点

- F01
- F03

## 文件范围

- oamp/src/persist.js

## 验收标准

- [ ] `SCHEMA` 内含 `CREATE TABLE IF NOT EXISTS inbox (...)`（`call_id` 主键 ⇒ 每条调用至多一行）与 `CREATE INDEX IF NOT EXISTS idx_inbox_principal ON inbox(principal, terminal_at)`；沿用既有 `CREATE … IF NOT EXISTS` 幂等建表口径，不引入迁移机制
- [ ] `openDb(dbPath)` 返回句柄上新增 `insertInbox` / `listInbox` / `deleteInbox` 三个方法；既有导出面（`createProject` / `listProjects` / `getProject` / `projectByChat` / `insertInput` / `insertOutput` / `upsertChat` / `closeChat` / `renameChat` / `archiveChat` / `activateChat` / `listArchivable` / `startupSweep` / …）逐条不变
- [ ] 幂等与顺序：同一 `call_id` 二次 `insertInbox` ⇒ 行数不变且首条不被覆盖；`listInbox(principal)` 只返回该 principal 的行、按 `terminal_at` 升序；`deleteInbox` 对不存在或已删除的 `call_id` 影响 0 行且不抛错
- [ ] 结构幂等：同一库文件连续 `openDb` 两次不报错、表结构不变；既有三表（`projects` / `chats` / `messages`）的读写与索引行为不变
- [ ] 无 TTL/淘汰/归档/导出/`VACUUM` 类维护动作（未取件行只由调用方 ack 收敛）

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-01（表结构、索引、写入时机、为什么存整份信封）、§4 A-09（清理策略）
- docs/iterations/0030-hub-communication-upgrade/prd/F01-inbox-authoritative-delivery.md（验收 4）、prd/F03-inbox-persistence.md（验收 1~5）

## depends_on

（无）

## batch

1
