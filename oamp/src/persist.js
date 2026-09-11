// src/persist.js — chat/message 持久层：建库、幂等建表、两类写口、查询、关闭、启动扫尾
// （architecture §4 全节 / AR-04~AR-07；本 PR 只交付模块本体，消费方接线见 pr-003/pr-004）。
// 形态：node:sqlite 的 DatabaseSync（Node 内置、零第三方依赖，V-10）。
// 落盘口径（§4.3）：输入 → 1 条 'in' + chat 'working'；输出 → 1 条 'out' + 'completed'/'failed'；
//   过程（流式 chunk / 工具中间态 / 心跳 / 日志）永不入库（§4.7 / E-5）。
// 结构面（§4.7）：能写 messages 的函数只有 insertInput()/insertOutput()，direction 在函数体内写死、不暴露参数。

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chats (
  chat_id     TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  agent_id    TEXT,
  state       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  closed_at   INTEGER,
  archived_at INTEGER,                        -- 归档标记 + 归档时间（NULL = 未归档）
  context_released INTEGER NOT NULL DEFAULT 0 -- 上下文已释放且未产生新回答
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     TEXT NOT NULL REFERENCES chats(chat_id),
  direction   TEXT NOT NULL,
  agent_id    TEXT,
  text        TEXT NOT NULL,
  model       TEXT,
  duration_ms INTEGER,
  error       TEXT,
  created_at  INTEGER NOT NULL,
  meta        TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
`;

const CHAT_STATES = ['working', 'completed', 'failed', 'closed'];
// §3.2 / M-1~M-5：按列存在性守卫的幂等迁移（新库 no-op，旧库补列；不引入 user_version / 迁移表）。
const MIGRATIONS = [
  { column: 'archived_at', ddl: 'ALTER TABLE chats ADD COLUMN archived_at INTEGER' },
  { column: 'context_released', ddl: 'ALTER TABLE chats ADD COLUMN context_released INTEGER NOT NULL DEFAULT 0' },
];

function migrate(db) {
  // 守卫真源 = pragma_table_info('chats')（与 persist.test.js 的列名断言同一函数）
  const existing = new Set(db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name));
  for (const { column, ddl } of MIGRATIONS) {
    if (!existing.has(column)) db.exec(ddl);
  }
}
const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;
const TITLE_MAX = 40; // AR-02：标题 = 首条输入去空白后截断
const TITLE_FALLBACK = '新对话'; // AR-02：空标题兜底
const LIKE_ESCAPE = '\\'; // §4.6：LIKE 通配符转义字符

const CHAT_COLUMNS = 'chat_id, title, agent_id, state, created_at, updated_at, closed_at, archived_at, context_released';
const MESSAGE_COLUMNS = 'id, direction, agent_id, text, model, duration_ms, error, created_at, meta';

// §4.6：过滤条件以"单行参数 CTE p"表达（缺省 NULL 即不过滤），单条预编译语句覆盖全部查询组合（条件间 AND，F03-7）。
const LIST_WITH = 'WITH p(q, agent, state, from_ts, to_ts, archived) AS (VALUES (?, ?, ?, ?, ?, ?)) ';
const LIST_FROM = `FROM chats c, p
  WHERE (p.q IS NULL OR c.title LIKE p.q ESCAPE '\\' OR EXISTS(SELECT 1 FROM messages m2 WHERE m2.chat_id = c.chat_id AND m2.text LIKE p.q ESCAPE '\\'))
    AND (p.agent IS NULL OR c.agent_id = p.agent OR EXISTS(SELECT 1 FROM messages m3 WHERE m3.chat_id = c.chat_id AND m3.agent_id = p.agent))
    AND (p.state IS NULL OR c.state = p.state)
    AND (p.from_ts IS NULL OR c.updated_at >= p.from_ts)
    AND (p.to_ts IS NULL OR c.updated_at <= p.to_ts)
    AND ((p.archived = 1 AND c.archived_at IS NOT NULL) OR (p.archived = 0 AND c.archived_at IS NULL))`;

function toPlain(row) {
  // node:sqlite 返回 null-prototype 对象；转普通对象便于调用方/断言直接比对（结构不变）
  return { ...row };
}

function toMetaJson(meta) {
  return meta === undefined || meta === null ? null : JSON.stringify(meta);
}

function parseMeta(raw) {
  return raw === null || raw === undefined ? null : JSON.parse(raw);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
}

function readLimit(value) {
  if (!Number.isInteger(value) || value < 1 || value > LIMIT_MAX) {
    throw new Error(`查询参数非法: limit 需为 1..${LIMIT_MAX} 的整数（当前值 ${JSON.stringify(value)}）`);
  }
  return value;
}

function readOffset(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`查询参数非法: offset 需为非负整数（当前值 ${JSON.stringify(value)}）`);
  }
  return value;
}

function readArchived(value) {
  if (value === undefined || value === null || value === 0) {
    return 0;
  }
  if (value === 1) {
    return 1;
  }
  throw new Error(`查询参数非法: archived 需为 0|1（当前值 ${JSON.stringify(value)}）`);
}

function readTimestamp(value, name) {
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    throw new Error(`查询参数非法: ${name} 需为毫秒整数（当前值 ${JSON.stringify(value)}）`);
  }
  return value === undefined ? null : value;
}

function readOptionalString(value, name) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`查询参数非法: ${name} 需为字符串（当前值 ${JSON.stringify(value)}）`);
  }
  return value;
}

/**
 * openDb — 建库/开库并返回持久层句柄。
 * 目录不存在 → mkdir -p（§4.2，`data/` 被 gitignore，首次运行必然不存在）；
 * 建表幂等 `CREATE TABLE/INDEX IF NOT EXISTS` + `PRAGMA foreign_keys = ON`（否则 REFERENCES 静默失效）。
 */
export function openDb(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db); // 旧库补列 / 新库 no-op（§3.2）

  const stmts = {
    // 防御性建行：输入先落盘（F02-3）不应因缺 chat 行失败；已存在则不改标题（AR-02：仅首条输入定标题）
    ensureChat: db.prepare(
      `INSERT INTO chats (chat_id, title, agent_id, state, created_at, updated_at)
       VALUES (?, ?, ?, 'working', ?, ?)
       ON CONFLICT(chat_id) DO NOTHING`,
    ),
    upsertChat: db.prepare(
      `INSERT INTO chats (chat_id, title, agent_id, state, created_at, updated_at)
       VALUES (?, ?, ?, 'working', ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         title = excluded.title, agent_id = excluded.agent_id, updated_at = excluded.updated_at
       WHERE chats.state != 'closed'`,
    ),
    insertMessage: db.prepare(
      `INSERT INTO messages (chat_id, direction, agent_id, text, model, duration_ms, error, created_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    // §4.3：状态写入统一带 closed 哨兵（迟到结果不改写已关闭 chat）
    setWorking: db.prepare(`UPDATE chats SET state = 'working', updated_at = ? WHERE chat_id = ? AND state != 'closed'`),
    setOutputState: db.prepare(`UPDATE chats SET state = ?, updated_at = ?, context_released = 0 WHERE chat_id = ? AND state != 'closed'`),
    // 幂等：已 closed 不改写 closed_at/updated_at
    closeChat: db.prepare(`UPDATE chats SET state = 'closed', closed_at = ?, updated_at = ? WHERE chat_id = ? AND state != 'closed'`),
    // ★ 归档：标记 + 归档时间同址写入，并置"上下文已释放"位。
    //    双守卫：archived_at IS NULL（幂等：已归档跳过，F01-4）+ state != 'working'（范围：进行中不可归档，F01-2 的结构性兜底）
    archiveChat: db.prepare(
      `UPDATE chats SET archived_at = ?, context_released = 1
        WHERE chat_id = ? AND archived_at IS NULL AND state != 'working'`,
    ),
    // ★ 激活：移除标记 + 状态还原 + 置顶，三件事一条语句（右值按更新前行值求值）
    //    WHERE archived_at IS NOT NULL 把"可重开"结构性地收窄在归档→激活路径上（N-5 / D-6）
    activateChat: db.prepare(
      `UPDATE chats
          SET archived_at = NULL,
              state      = CASE WHEN state = 'closed' THEN 'completed' ELSE state END,
              closed_at  = CASE WHEN state = 'closed' THEN NULL ELSE closed_at END,
              updated_at = ?
        WHERE chat_id = ? AND archived_at IS NOT NULL`,
    ),
    // ★ 批量归档的候选集（读口）：未归档 且 非进行中（F01-2）
    listArchivable: db.prepare(
      `SELECT chat_id FROM chats WHERE archived_at IS NULL AND state != 'working' ORDER BY chat_id`,
    ),
    chatExists: db.prepare('SELECT 1 AS found FROM chats WHERE chat_id = ?'),
    sweep: db.prepare(`UPDATE chats SET state = 'failed' WHERE state = 'working'`),
    getChat: db.prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE chat_id = ?`),
    getMessages: db.prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC`,
    ),
    listChats: db.prepare(
      `${LIST_WITH}SELECT c.chat_id, c.title, c.agent_id, c.state, c.created_at, c.updated_at, c.archived_at,
         (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.chat_id) AS message_count
       ${LIST_FROM}
       ORDER BY (CASE WHEN p.archived = 1 THEN c.archived_at ELSE c.updated_at END) DESC, c.chat_id DESC
       LIMIT ? OFFSET ?`,
    ),
    countChats: db.prepare(`${LIST_WITH}SELECT COUNT(*) AS total ${LIST_FROM}`),
  };

  function insertInput({ chatId, text, agentId = null, meta = null, nowMs = Date.now() } = {}) {
    const title = text.trim().slice(0, TITLE_MAX) || TITLE_FALLBACK;
    stmts.ensureChat.run(chatId, title, agentId, nowMs, nowMs);
    const info = stmts.insertMessage.run(chatId, 'in', agentId, text, null, null, null, nowMs, toMetaJson(meta));
    stmts.setWorking.run(nowMs, chatId);
    return { chat_id: chatId, message_id: info.lastInsertRowid };
  }

  function insertOutput({
    chatId,
    text,
    agentId = null,
    model = null,
    durationMs = null,
    error = null,
    meta = null,
    nowMs = Date.now(),
  } = {}) {
    const info = stmts.insertMessage.run(chatId, 'out', agentId, text, model, durationMs, error, nowMs, toMetaJson(meta));
    stmts.setOutputState.run(error ? 'failed' : 'completed', nowMs, chatId);
    return { chat_id: chatId, message_id: info.lastInsertRowid };
  }

  function upsertChat({ chatId, title, agentId = null, nowMs = Date.now() } = {}) {
    stmts.upsertChat.run(chatId, title, agentId, nowMs, nowMs);
  }

  function closeChat(chatId, nowMs = Date.now()) {
    stmts.closeChat.run(nowMs, nowMs, chatId);
    return stmts.chatExists.get(chatId) !== undefined;
  }

  function archiveChat(chatId, nowMs = Date.now()) {
    return stmts.archiveChat.run(nowMs, chatId).changes > 0;
  }

  function activateChat(chatId, nowMs = Date.now()) {
    return stmts.activateChat.run(nowMs, chatId).changes > 0;
  }

  function listArchivable() {
    return stmts.listArchivable.all().map((row) => row.chat_id);
  }

  function startupSweep() {
    return stmts.sweep.run().changes;
  }

  function listChats({ q, agent, state, from, to, archived = 0, limit = LIMIT_DEFAULT, offset = 0 } = {}) {
    const limitN = readLimit(limit);
    const offsetN = readOffset(offset);
    const archivedN = readArchived(archived);
    const stateN = readOptionalString(state, 'state');
    if (stateN !== null && !CHAT_STATES.includes(stateN)) {
      throw new Error(`查询参数非法: state 需为 ${CHAT_STATES.join('|')}（当前值 ${JSON.stringify(state)}）`);
    }
    const fromN = readTimestamp(from, 'from');
    const toN = readTimestamp(to, 'to');
    if (fromN !== null && toN !== null && fromN > toN) {
      throw new Error(`查询参数非法: from 需 <= to（当前值 ${fromN} > ${toN}）`);
    }
    const qN = readOptionalString(q, 'q');
    const params = [qN === null ? null : `%${escapeLike(qN)}%`, readOptionalString(agent, 'agent'), stateN, fromN, toN, archivedN];
    const chats = stmts.listChats.all(...params, limitN, offsetN).map(toPlain);
    const { total } = stmts.countChats.get(...params);
    return { chats, total, limit: limitN, offset: offsetN };
  }

  function getChat(chatId) {
    const chat = stmts.getChat.get(chatId);
    if (chat === undefined) {
      return null;
    }
    const messages = stmts.getMessages.all(chatId).map((row) => ({ ...toPlain(row), meta: parseMeta(row.meta) }));
    return { chat: toPlain(chat), messages };
  }

  return {
    insertInput, insertOutput, upsertChat, closeChat,
    archiveChat, activateChat, listArchivable,
    startupSweep, listChats, getChat, close: () => db.close(),
  };
}
