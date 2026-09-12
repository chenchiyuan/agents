// src/persist.js — chat/message 持久层：建库、幂等建表、两类写口、查询、关闭、启动扫尾
// （architecture §4 全节 / AR-04~AR-07；本 PR 只交付模块本体，消费方接线见 pr-003/pr-004）。
// 形态：node:sqlite 的 DatabaseSync（Node 内置、零第三方依赖，V-10）。
// 落盘口径（§4.3）：输入 → 1 条 'in' + chat 'working'；输出 → 1 条 'out' + 'completed'/'failed'；
//   过程（流式 chunk / 工具中间态 / 心跳 / 日志）永不入库（§4.7 / E-5）。
// 结构面（§4.7）：能写 messages 的函数只有 insertInput()/insertOutput()，direction 在函数体内写死、不暴露参数。

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  project_id  TEXT PRIMARY KEY,               -- prj-<uuid>（与既有 chat-<uuid> 同族）
  name        TEXT NOT NULL,                  -- 展示名；缺省 = 仓库地址尾段去尾部 .git
  repo_url    TEXT NOT NULL UNIQUE,           -- 唯一键 = 原样（trim 后）地址；不归一化、不校验可达性
  created_at  INTEGER NOT NULL                -- epoch ms
);
CREATE TABLE IF NOT EXISTS chats (
  chat_id     TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(project_id), -- 必填 + 外键（归属的结构性保证）
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
CREATE INDEX IF NOT EXISTS idx_chats_project_updated ON chats(project_id, updated_at DESC); -- 项目范围列表
`;

const CHAT_STATES = ['working', 'completed', 'failed', 'closed'];

/** 旧结构判据（唯一真源，architecture §2.2）：`pragma_table_info('chats')` 有行 且 列名不含 project_id。
 *  `chats` 表不存在（首次运行 / 删库后）⇒ 0 行 ⇒ 非旧结构 ⇒ 正常建新库（IF NOT EXISTS 幂等）。
 *  用列存在性而非 user_version：守卫真源与 pragma_table_info 一致，零新迁移机制。 */
function isLegacyChats(db) {
  const cols = db.prepare("SELECT name FROM pragma_table_info('chats')").all().map((r) => r.name);
  return cols.length > 0 && !cols.includes('project_id');
}
const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;
const TITLE_MAX = 40; // AR-02：标题 = 首条输入去空白后截断
const TITLE_FALLBACK = '新对话'; // AR-02：空标题兜底
const TITLE_MAX_MANUAL = 100; // §3.1：手动标题上限，UTF-16 code unit（= String.length，D-5）；与 TITLE_MAX 互不引用
const LIKE_ESCAPE = '\\'; // §4.6：LIKE 通配符转义字符

const CHAT_COLUMNS = 'chat_id, title, agent_id, state, created_at, updated_at, closed_at, archived_at, context_released';
const MESSAGE_COLUMNS = 'id, direction, agent_id, text, model, duration_ms, error, created_at, meta';

// §4.6：过滤条件以"单行参数 CTE p"表达（缺省 NULL 即不过滤），单条预编译语句覆盖全部查询组合（条件间 AND，F03-7）。
const LIST_WITH = 'WITH p(q, agent, state, from_ts, to_ts, archived, project) AS (VALUES (?, ?, ?, ?, ?, ?, ?)) ';
const LIST_FROM = `FROM chats c, p
  WHERE (p.q IS NULL OR c.title LIKE p.q ESCAPE '\\' OR EXISTS(SELECT 1 FROM messages m2 WHERE m2.chat_id = c.chat_id AND m2.text LIKE p.q ESCAPE '\\'))
    AND (p.agent IS NULL OR c.agent_id = p.agent OR EXISTS(SELECT 1 FROM messages m3 WHERE m3.chat_id = c.chat_id AND m3.agent_id = p.agent))
    AND (p.state IS NULL OR c.state = p.state)
    AND (p.from_ts IS NULL OR c.updated_at >= p.from_ts)
    AND (p.to_ts IS NULL OR c.updated_at <= p.to_ts)
    AND ((p.archived = 1 AND c.archived_at IS NOT NULL) OR (p.archived = 0 AND c.archived_at IS NULL))
    AND c.project_id = p.project`;

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

/** 必填查询参数（§3.2）：非空字符串。空值**不**沿用 readOptionalString 的"空值即无参"语义——
 *  那正是本次要消灭的口径（未提供与提供空值都判非法）。 */
function readRequiredString(value, name) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`查询参数非法: ${name} 不能为空（对话列表以项目为范围）`);
  }
  return value;
}

/** 写口归属校验（§2.3）：project_id 必填（非空字符串）；缺失即抛错，绝不静默兜底。 */
function readProjectId(value) {
  if (typeof value !== 'string' || value === '') {
    throw new Error('需要 project_id（对话必须归属一个项目）');
  }
  return value;
}

/** 项目名派生（§3.1）：地址去尾部斜杠后取尾段、再去尾部 .git；派生为空 ⇒ 兜底用地址原文。 */
function deriveProjectName(repoUrl) {
  const tail = repoUrl.replace(/\/+$/, '').split('/').pop() ?? '';
  const name = tail.replace(/\.git$/, '');
  return name === '' ? repoUrl : name;
}

/** 手动标题校验与归一（§3.3 / F02-1/2/4/6）：trim（首尾去空白，内部保留）→ 非空 → ≤ 100。
 *  非法入参抛错（由 renameChat 内建调用）⇒ 调用方转 400；绝不静默兜底。 */
function readTitle(value) {
  if (typeof value !== 'string') {
    throw new Error(`标题非法: 需为字符串（当前值 ${JSON.stringify(value)}）`);
  }
  const title = value.trim();
  if (title === '') {
    throw new Error('标题非法: 不能为空或全为空白');
  }
  if (title.length > TITLE_MAX_MANUAL) {
    throw new Error(`标题非法: 长度需 <= ${TITLE_MAX_MANUAL}（当前 ${title.length}）`);
  }
  return title;
}

/**
 * openDb — 建库/开库并返回持久层句柄。
 * 目录不存在 → mkdir -p（§4.2，`data/` 被 gitignore，首次运行必然不存在）；
 * 建表幂等 `CREATE TABLE/INDEX IF NOT EXISTS` + `PRAGMA foreign_keys = ON`（否则 REFERENCES 静默失效）。
 */
export function openDb(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  let db = new DatabaseSync(dbPath);
  // §2.2 硬契约②：旧结构库（chats 存在且无 project_id）⇒ 删库重建（不可恢复，不留兼容路径）。
  // 只删主库文件本体：检测发生在本次已成功 open 之后，SQLite 在 open 时已完成热日志回滚。
  if (isLegacyChats(db)) {
    db.close();
    rmSync(dbPath, { force: true });
    db = new DatabaseSync(dbPath);
    process.stdout.write(`DB_REBUILT path=${dbPath}\n`); // D-02：重建必须留一行可观测告知
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const stmts = {
    // 防御性建行：输入先落盘（F02-3）不应因缺 chat 行失败；已存在则不改标题（AR-02：仅首条输入定标题）；
    // ON CONFLICT DO NOTHING ⇒ 既有对话的归属（project_id）不可被改写（§10.2 L2-8 结构性保证）。
    ensureChat: db.prepare(
      `INSERT INTO chats (chat_id, project_id, title, agent_id, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'working', ?, ?)
       ON CONFLICT(chat_id) DO NOTHING`,
    ),
    // project_id 只进 INSERT 列、**不进** DO UPDATE SET（归属不可变；§2.3）
    upsertChat: db.prepare(
      `INSERT INTO chats (chat_id, project_id, title, agent_id, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'working', ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         title = excluded.title, agent_id = excluded.agent_id, updated_at = excluded.updated_at
       WHERE chats.state != 'closed'`,
    ),
    createProject: db.prepare(
      `INSERT INTO projects (project_id, name, repo_url, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(repo_url) DO NOTHING`,
    ),
    getProject: db.prepare('SELECT project_id, name, repo_url, created_at FROM projects WHERE project_id = ?'),
    // §7.3：单条聚合 SQL——四字段 + 两个派生列（含已归档/已关闭；无对话 ⇒ last_activity_at = NULL）
    listProjects: db.prepare(
      `SELECT p.project_id, p.name, p.repo_url, p.created_at,
              COUNT(c.chat_id)  AS chat_count,
              MAX(c.updated_at) AS last_activity_at
         FROM projects p LEFT JOIN chats c ON c.project_id = p.project_id
        GROUP BY p.project_id
        ORDER BY p.created_at DESC, p.project_id DESC`,
    ),
    // 既有对话的归属读口：一条语句，不改 chats 任何读口的字段面（§2.3）
    projectByChat: db.prepare(
      `SELECT p.project_id, p.name, p.repo_url, p.created_at
         FROM chats c JOIN projects p ON p.project_id = c.project_id
        WHERE c.chat_id = ?`,
    ),
    // ★ 改名（§3.1 硬契约 ①）：SET 只有 title 一列 ⇒ updated_at（不置顶）/ agent_id / state / archived_at /
    //    closed_at / created_at / context_released 全不被触碰；双守卫与只读面同值（archived_at IS NULL、state != 'closed'）；
    //    未命中 ⇒ changes = 0，由包装函数转为"未写入"，绝不静默报成功。
    renameChat: db.prepare(
      `UPDATE chats SET title = ? WHERE chat_id = ? AND archived_at IS NULL AND state != 'closed'`,
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

  function insertInput({ chatId, projectId, text, agentId = null, meta = null, nowMs = Date.now() } = {}) {
    readProjectId(projectId);
    const title = text.trim().slice(0, TITLE_MAX) || TITLE_FALLBACK;
    stmts.ensureChat.run(chatId, projectId, title, agentId, nowMs, nowMs);
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

  function upsertChat({ chatId, projectId, title, agentId = null, nowMs = Date.now() } = {}) {
    readProjectId(projectId);
    stmts.upsertChat.run(chatId, projectId, title, agentId, nowMs, nowMs);
  }

  /** 创建项目（§2.3 / §3.1）：repo_url trim 后**原样**入库（不归一化 .git / 尾斜杠 / 大小写 / SSH↔HTTPS）；
   *  name 缺省 / 空 / 非字符串 ⇒ 派生（见 deriveProjectName）。重复地址 → null（ON CONFLICT DO NOTHING +
   *  changes === 0 判定，不解析 SQLite 错误文案）；成功 ⇒ 回读库值（沿用 activateChat 的既有体例）。 */
  function createProject({ repoUrl, name = null, nowMs = Date.now() } = {}) {
    if (typeof repoUrl !== 'string' || repoUrl.trim() === '') {
      throw new Error('需要 repo_url（非空字符串）');
    }
    const repo = repoUrl.trim();
    const given = typeof name === 'string' ? name.trim() : '';
    const projectId = `prj-${randomUUID()}`;
    const info = stmts.createProject.run(projectId, given === '' ? deriveProjectName(repo) : given, repo, nowMs);
    if (info.changes === 0) {
      return null;
    }
    return toPlain(stmts.getProject.get(projectId));
  }

  /** 项目列表（§7.3）：chat_count 含已归档 / 已关闭；无对话项目 last_activity_at = null（不是 0、不是缺键）。 */
  function listProjects() {
    return stmts.listProjects.all().map(toPlain);
  }

  /** 单个项目；不存在 → null（新建对话的归属校验用）。 */
  function getProject(projectId) {
    const row = stmts.getProject.get(projectId);
    return row === undefined ? null : toPlain(row);
  }

  /** 既有对话的归属读口（§2.3）：不存在 → null；不改变 chats 任何读口的字段面。 */
  function projectByChat(chatId) {
    const row = stmts.projectByChat.get(chatId);
    return row === undefined ? null : toPlain(row);
  }

  function closeChat(chatId, nowMs = Date.now()) {
    stmts.closeChat.run(nowMs, nowMs, chatId);
    return stmts.chatExists.get(chatId) !== undefined;
  }

  /** 改名：返回已写入的权威标题（trim 后）；未写入（不存在 / 已归档 / 已关闭）→ null。
   *  非法标题由 readTitle 抛错（不进 SQL）。返回值即 changes 校验的对外表达（§3.1）。 */
  function renameChat({ chatId, title } = {}) {
    const normalized = readTitle(title);
    return stmts.renameChat.run(normalized, chatId).changes > 0 ? normalized : null;
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

  function listChats({ project, q, agent, state, from, to, archived = 0, limit = LIMIT_DEFAULT, offset = 0 } = {}) {
    // 项目范围是必填（§3.2）：校验落点在 persist，handler 零新增错误分支（既有 try → 400 原样接住）
    const projectN = readRequiredString(project, 'project_id');
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
    const params = [qN === null ? null : `%${escapeLike(qN)}%`, readOptionalString(agent, 'agent'), stateN, fromN, toN, archivedN, projectN];
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
    createProject, listProjects, getProject, projectByChat,
    insertInput, insertOutput, upsertChat, closeChat, renameChat,
    archiveChat, activateChat, listArchivable,
    startupSweep, listChats, getChat, close: () => db.close(),
  };
}
