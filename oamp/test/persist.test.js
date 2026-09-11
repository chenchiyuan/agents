// test/persist.test.js — F02/F03 落盘侧：建库与 schema、两类写口（E-5 结构面）、meta 落盘/读回、
// 查询（排序/分页/时间闭区间/关键词转义/agent 相关性）、关闭哨兵与扫尾、重开读回 E-3。
// （architecture §4.1~§4.7；pr-001 验收 4~9）。库一律落 os.tmpdir()，不写 oamp/data/。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDb } from '../src/persist.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP_ROOT = tmpdir();
const T0 = 1_700_000_000_000;

const createdPaths = [];

function tmpDir() {
  return mkdtempSync(path.join(TMP_ROOT, 'oamp-persist-'));
}

function openTempDb(name = 'sql.db') {
  const dbPath = path.join(tmpDir(), name);
  createdPaths.push(dbPath);
  return { dbPath, db: openDb(dbPath) };
}

// 独立连接直读库文件（用于核对落盘的原始形态），与 persist 句柄无关
function rawAll(dbPath, sql, ...params) {
  const raw = new DatabaseSync(dbPath);
  try {
    return raw.prepare(sql).all(...params).map((row) => ({ ...row }));
  } finally {
    raw.close();
  }
}

test('建库：多级目录不存在时自动创建并建库（验收 4 / §4.2）', () => {
  const dbPath = path.join(tmpDir(), 'nested', 'deeper', 'sql.db');
  createdPaths.push(dbPath);
  const db = openDb(dbPath);
  assert.ok(existsSync(dbPath), '应自动 mkdir -p 并建库文件');
  db.close();
});

test('建库幂等：重复 openDb 同一路径不抛错，close 后可再开（验收 4）', () => {
  const { dbPath, db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'hello', nowMs: T0 });
  const again = openDb(dbPath);
  assert.equal(again.listChats().total, 1);
  again.close();
  db.close();
  const third = openDb(dbPath);
  assert.equal(third.listChats().total, 1);
  third.close();
});

test('schema：chats/messages 两表与两索引齐备，列与 §4.1 一致（验收 4 / §4.1）', () => {
  const { dbPath, db } = openTempDb();
  db.close();
  const objects = rawAll(dbPath, "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
  assert.deepEqual(objects, [
    { type: 'table', name: 'chats' },
    { type: 'index', name: 'idx_chats_updated' },
    { type: 'index', name: 'idx_messages_chat_time' },
    { type: 'table', name: 'messages' },
  ]);
  assert.deepEqual(
    rawAll(dbPath, "SELECT name FROM pragma_table_info('chats')").map((r) => r.name),
    ['chat_id', 'title', 'agent_id', 'state', 'created_at', 'updated_at', 'closed_at', 'archived_at', 'context_released'],
  );
  assert.deepEqual(
    rawAll(dbPath, "SELECT name FROM pragma_table_info('messages')").map((r) => r.name),
    ['id', 'chat_id', 'direction', 'agent_id', 'text', 'model', 'duration_ms', 'error', 'created_at', 'meta'],
  );
});

const CHATS_COLUMNS_9 = [
  'chat_id', 'title', 'agent_id', 'state', 'created_at', 'updated_at', 'closed_at', 'archived_at', 'context_released',
];

test('迁移：旧库（7 列）openDb 后补两列，列序与新建库逐位相同、旧行语义正确、二次运行不变（M-1~M-3 / 验收 1）', () => {
  const oldDbPath = path.join(tmpDir(), 'legacy.db');
  createdPaths.push(oldDbPath);
  const legacy = new DatabaseSync(oldDbPath);
  legacy.exec(`CREATE TABLE chats (
    chat_id     TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    agent_id    TEXT,
    state       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    closed_at   INTEGER
  );`);
  legacy.exec(`INSERT INTO chats (chat_id, title, agent_id, state, created_at, updated_at, closed_at)
    VALUES ('chat-old', '旧对话', 'a1', 'closed', ${T0}, ${T0 + 1}, ${T0 + 1})`);
  legacy.close();

  const db = openDb(oldDbPath);
  assert.deepEqual(
    rawAll(oldDbPath, "SELECT name FROM pragma_table_info('chats')").map((r) => r.name),
    CHATS_COLUMNS_9,
    '旧库应补列到与新建库同构的列序（M-2）',
  );
  const old = db.getChat('chat-old').chat;
  assert.equal(old.archived_at, null, '既有行视为未归档（M-3 / N-9）');
  assert.equal(old.context_released, 0);
  assert.equal(old.state, 'closed', '既有状态不变');
  assert.equal(old.title, '旧对话');
  assert.equal(old.updated_at, T0 + 1);
  db.close();

  assert.deepEqual(
    rawAll(oldDbPath, "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"),
    [
      { type: 'table', name: 'chats' },
      { type: 'index', name: 'idx_chats_updated' },
      { type: 'index', name: 'idx_messages_chat_time' },
      { type: 'table', name: 'messages' },
    ],
    '迁移不引入新表 / 迁移版本号表（M-4）',
  );

  const again = openDb(oldDbPath);
  assert.deepEqual(
    rawAll(oldDbPath, "SELECT name FROM pragma_table_info('chats')").map((r) => r.name),
    CHATS_COLUMNS_9,
    '二次 openDb 列集不变（M-1 幂等）',
  );
  assert.equal(again.getChat('chat-old').chat.archived_at, null);
  assert.equal(again.listChats({ state: 'closed' }).total, 1);
  again.close();

  const { dbPath: freshPath, db: fresh } = openTempDb('fresh.db');
  fresh.close();
  assert.deepEqual(
    rawAll(freshPath, "SELECT name FROM pragma_table_info('chats')").map((r) => r.name),
    CHATS_COLUMNS_9,
    '新建库与迁移库列序逐位相同（M-2）',
  );
});

test('外键开启：向不存在的 chat 写 out 记录被拒绝（验收 4 / §4.2）', () => {
  const { db } = openTempDb();
  assert.throws(() => db.insertOutput({ chatId: 'chat-ghost', text: 'x' }), /FOREIGN KEY/);
});

test('.gitignore 含 data/ 且保留 .runtime/（F07 架构维度 2 / §8.4）', () => {
  const rules = readFileSync(path.join(OAMP_ROOT, '.gitignore'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  assert.ok(rules.includes('.runtime/'), '应保留既有 .runtime/ 规则');
  assert.ok(rules.includes('data/'), '应追加 data/ 规则');
});

test('写接口：一次 insertInput + insertOutput 恰 2 行，direction 恰 {in,out}（E-5 / 验收 5）', () => {
  const { dbPath, db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'T', agentId: 'a1', nowMs: T0 });
  const inInfo = db.insertInput({ chatId: 'chat-1', text: '问题', agentId: 'a1', nowMs: T0 + 1 });
  const outInfo = db.insertOutput({ chatId: 'chat-1', text: '答复', agentId: 'a1', nowMs: T0 + 2 });
  assert.deepEqual(inInfo, { chat_id: 'chat-1', message_id: 1 });
  assert.deepEqual(outInfo, { chat_id: 'chat-1', message_id: 2 });
  assert.equal(rawAll(dbPath, 'SELECT COUNT(*) AS n FROM messages')[0].n, 2);
  assert.deepEqual(rawAll(dbPath, 'SELECT DISTINCT direction FROM messages ORDER BY direction').map((r) => r.direction), ['in', 'out']);
  db.close();
});

test('结构面：能写 messages 的入口只有 insertInput/insertOutput，direction 不由调用方传入（§4.7 / 验收 5）', () => {
  const { db } = openTempDb();
  const writers = Object.keys(db)
    .filter((key) => typeof db[key] === 'function' && !['listChats', 'getChat', 'close', 'listArchivable'].includes(key))
    .sort();
  assert.deepEqual(writers, ['activateChat', 'archiveChat', 'closeChat', 'insertInput', 'insertOutput', 'renameChat', 'startupSweep', 'upsertChat'], '不得存在接受 direction 的通用写口');
  db.insertInput({ chatId: 'chat-1', text: 'hi', direction: 'out' });
  assert.deepEqual(db.getChat('chat-1').messages.map((m) => m.direction), ['in']);
});

test('状态流转：输入 → working；输出无 error → completed；输出带 error → failed（§4.3/§4.4）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q1', nowMs: T0 });
  assert.equal(db.getChat('chat-1').chat.state, 'working');

  db.insertOutput({ chatId: 'chat-1', text: 'a1', nowMs: T0 + 1 });
  const done = db.getChat('chat-1').chat;
  assert.equal(done.state, 'completed');
  assert.equal(done.updated_at, T0 + 1, '写入后 updated_at 应前移');

  db.insertInput({ chatId: 'chat-1', text: 'q2', nowMs: T0 + 2 });
  assert.equal(db.getChat('chat-1').chat.state, 'working');
  db.insertOutput({ chatId: 'chat-1', text: '模型不可用：x/y', error: 'model_unavailable', nowMs: T0 + 3 });
  const failed = db.getChat('chat-1').chat;
  assert.equal(failed.state, 'failed');
  assert.equal(failed.updated_at, T0 + 3);
});

test('meta 落盘与读回：insertInput 写 {task_id}、insertOutput 写 {context_id,pid} 可原样 JSON.parse（验收 6 / §4.1/§4.3）', () => {
  const { dbPath, db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'T', nowMs: T0 });
  db.insertInput({ chatId: 'chat-1', text: 'q', meta: { task_id: 'task-1' }, nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a', meta: { context_id: 'ctx-123-1', pid: 4321 }, nowMs: T0 + 1 });

  const raw = rawAll(dbPath, 'SELECT direction, meta FROM messages ORDER BY id');
  assert.deepEqual(JSON.parse(raw[0].meta), { task_id: 'task-1' });
  assert.deepEqual(JSON.parse(raw[1].meta), { context_id: 'ctx-123-1', pid: 4321 });

  const { messages } = db.getChat('chat-1');
  assert.deepEqual(messages[0].meta, { task_id: 'task-1' });
  assert.deepEqual(messages[1].meta, { context_id: 'ctx-123-1', pid: 4321 });
});

test('meta 未提供 → 落 NULL、读回 null（不抛错）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a', nowMs: T0 + 1 });
  assert.deepEqual(db.getChat('chat-1').messages.map((m) => m.meta), [null, null]);
});

test('agent 归属：agentId 落 messages.agent_id，输出侧字段（model/duration_ms/error）可读回（F03-5 / §4.1）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q', agentId: 'a1', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a', agentId: 'a2', model: 'openai/gpt-5.6-luna', durationMs: 812, nowMs: T0 + 1 });
  const { messages } = db.getChat('chat-1');
  assert.equal(messages[0].agent_id, 'a1');
  assert.equal(messages[1].agent_id, 'a2');
  assert.equal(messages[1].model, 'openai/gpt-5.6-luna');
  assert.equal(messages[1].duration_ms, 812);
  assert.equal(messages[1].error, null);
});

test('缺 chat 行时 insertInput 防御性建行：标题取输入前 40 字符、空标题兜底「新对话」（I-2 / AR-02）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-long', text: 'x'.repeat(50), agentId: 'a1', nowMs: T0 });
  const chat = db.getChat('chat-long').chat;
  assert.equal(chat.title, 'x'.repeat(40));
  assert.equal(chat.state, 'working');
  assert.equal(chat.agent_id, 'a1');
  assert.equal(chat.created_at, T0);

  db.insertInput({ chatId: 'chat-blank', text: '   ', nowMs: T0 });
  assert.equal(db.getChat('chat-blank').chat.title, '新对话');
});

test('列表：默认排序 updated_at DESC, chat_id DESC（同毫秒按 chat_id 兜底）（验收 7 / F03-2）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-a', title: 'A', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-b', title: 'B', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-c', title: 'C', nowMs: T0 + 10 });
  const listed = db.listChats();
  assert.deepEqual(listed.chats.map((c) => c.chat_id), ['chat-c', 'chat-b', 'chat-a']);
  assert.equal(listed.total, 3);
  assert.equal(listed.limit, 50);
  assert.equal(listed.offset, 0);
});

test('列表：分页稳定、total 为匹配总数、message_count 为该 chat 消息数（验收 7 / §4.5）', () => {
  const { db } = openTempDb();
  for (let i = 0; i < 5; i += 1) {
    db.upsertChat({ chatId: `chat-${i}`, title: `T${i}`, nowMs: T0 + i });
  }
  db.insertInput({ chatId: 'chat-4', text: 'q', nowMs: T0 + 10 });
  db.insertOutput({ chatId: 'chat-4', text: 'a', nowMs: T0 + 11 });

  const page1 = db.listChats({ limit: 2, offset: 0 });
  const page2 = db.listChats({ limit: 2, offset: 2 });
  const page3 = db.listChats({ limit: 2, offset: 4 });
  const ids = [...page1.chats, ...page2.chats, ...page3.chats].map((c) => c.chat_id);
  assert.equal(new Set(ids).size, 5, '分页无重叠无遗漏');
  assert.deepEqual(ids, ['chat-4', 'chat-3', 'chat-2', 'chat-1', 'chat-0']);
  assert.equal(page1.total, 5);
  assert.equal(page1.limit, 2);
  assert.equal(page3.chats.length, 1);
  assert.equal(page1.chats.find((c) => c.chat_id === 'chat-4').message_count, 2);
  assert.equal(page1.chats.find((c) => c.chat_id === 'chat-3').message_count, 0);
});

test('列表：limit/offset 非法 → 抛错（默认 50、上限 200）（验收 7 / I-5 / §4.5）', () => {
  const { db } = openTempDb();
  assert.throws(() => db.listChats({ limit: 201 }), /limit/);
  assert.throws(() => db.listChats({ limit: 0 }), /limit/);
  assert.throws(() => db.listChats({ limit: 1.5 }), /limit/);
  assert.throws(() => db.listChats({ offset: -1 }), /offset/);
});

test('列表：时间过滤作用于 updated_at 且为闭区间（验收 7 / F03-3 / §4.6）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'A', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-2', title: 'B', nowMs: T0 + 100 });
  db.upsertChat({ chatId: 'chat-3', title: 'C', nowMs: T0 + 200 });

  assert.deepEqual(db.listChats({ from: T0, to: T0 + 100 }).chats.map((c) => c.chat_id), ['chat-2', 'chat-1'], '端点应被包含');
  assert.deepEqual(db.listChats({ from: T0 + 101 }).chats.map((c) => c.chat_id), ['chat-3']);
  assert.deepEqual(db.listChats({ to: T0 + 99 }).chats.map((c) => c.chat_id), ['chat-1']);
  assert.equal(db.listChats({ from: T0 + 201 }).total, 0);
  assert.throws(() => db.listChats({ from: T0 + 1, to: T0 }), /from/);
  assert.throws(() => db.listChats({ from: 'x' }), /from/);
});

test('列表：关键词命中标题或消息文本，已关闭 chat 也在结果内（验收 7 / F03-6 / §4.6）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-title', title: 'Plan A', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-body', title: 'plain', nowMs: T0 + 1 });
  db.upsertChat({ chatId: 'chat-closed', title: 'Plan C', nowMs: T0 + 2 });
  db.closeChat('chat-closed', T0 + 3);
  db.insertInput({ chatId: 'chat-body', text: 'needle-in-message', nowMs: T0 + 4 });

  assert.deepEqual(db.listChats({ q: 'plan' }).chats.map((c) => c.chat_id), ['chat-closed', 'chat-title'], 'ASCII 大小写不敏感且含已关闭');
  assert.deepEqual(db.listChats({ q: 'needle' }).chats.map((c) => c.chat_id), ['chat-body'], '应命中消息文本');
  assert.equal(db.listChats({ q: 'missing' }).total, 0);
});

test('列表：关键词中的 % _ \\ 被转义，只命中字面量（验收 7 / §4.6）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-plain', title: 'plain title', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-percent', title: 'discount 100%', nowMs: T0 + 1 });
  db.upsertChat({ chatId: 'chat-underscore', title: 'snake_case', nowMs: T0 + 2 });
  db.upsertChat({ chatId: 'chat-backslash', title: 'path c:\\tmp', nowMs: T0 + 3 });

  assert.deepEqual(db.listChats({ q: '%' }).chats.map((c) => c.chat_id), ['chat-percent'], '未转义时报 % 会命中全部');
  assert.deepEqual(db.listChats({ q: '_' }).chats.map((c) => c.chat_id), ['chat-underscore'], '未转义时 _ 会命中全部单字符位');
  assert.deepEqual(db.listChats({ q: '\\' }).chats.map((c) => c.chat_id), ['chat-backslash'], '未转义时 \\ 会转义掉后随字符');
});

test('列表：agent 相关性 = chats.agent_id 命中或 messages.agent_id 参与过（验收 7 / F03-5 / §4.6）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-default', title: 'A', agentId: 'a1', nowMs: T0 });
  db.upsertChat({ chatId: 'chat-other', title: 'B', agentId: 'a2', nowMs: T0 + 1 });
  db.insertInput({ chatId: 'chat-other', text: 'q', agentId: 'a9', nowMs: T0 + 2 });

  assert.deepEqual(db.listChats({ agent: 'a1' }).chats.map((c) => c.chat_id), ['chat-default']);
  assert.deepEqual(db.listChats({ agent: 'a9' }).chats.map((c) => c.chat_id), ['chat-other'], '参与过该 chat 的 agent 也应命中');
  assert.deepEqual(db.listChats({ agent: 'a2' }).chats.map((c) => c.chat_id), ['chat-other']);
  assert.equal(db.listChats({ agent: 'ghost' }).total, 0);
});

test('列表：状态过滤 + 四类条件 AND 组合，非法状态抛错（验收 7 / F03-4/7 / §4.6）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-working', text: 'plan q', agentId: 'a1', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-working', text: 'a', agentId: 'a1', nowMs: T0 + 1 });
  db.upsertChat({ chatId: 'chat-closed', title: 'closed plan', agentId: 'a1', nowMs: T0 + 2 });
  db.closeChat('chat-closed', T0 + 3);

  assert.deepEqual(db.listChats({ state: 'completed' }).chats.map((c) => c.chat_id), ['chat-working']);
  assert.deepEqual(db.listChats({ state: 'closed' }).chats.map((c) => c.chat_id), ['chat-closed']);
  assert.equal(db.listChats({ state: 'failed' }).total, 0);
  assert.deepEqual(
    db.listChats({ q: 'plan', agent: 'a1', state: 'closed', from: T0, to: T0 + 100 }).chats.map((c) => c.chat_id),
    ['chat-closed'],
    '多条件应同时满足',
  );
  assert.throws(() => db.listChats({ state: 'idle' }), /state/);
});

test('详情：消息按 created_at ASC, id ASC 升序，字段与 §4.1 一致，未知 chat → null（验收 7 / F03-8 / §4.5）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q1', agentId: 'a1', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a1', model: 'm', durationMs: 5, nowMs: T0 });
  db.insertInput({ chatId: 'chat-1', text: 'q2', agentId: 'a1', nowMs: T0 });

  const detail = db.getChat('chat-1');
  assert.deepEqual(detail.messages.map((m) => m.text), ['q1', 'a1', 'q2'], '同毫秒时按自增 id 稳定升序');
  assert.deepEqual(detail.messages.map((m) => m.id), [1, 2, 3]);
  assert.deepEqual(Object.keys(detail.messages[0]).sort(), [
    'agent_id', 'created_at', 'direction', 'duration_ms', 'error', 'id', 'meta', 'model', 'text',
  ]);
  assert.deepEqual(Object.keys(detail.chat).sort(), [
    'agent_id', 'archived_at', 'chat_id', 'closed_at', 'context_released', 'created_at', 'state', 'title', 'updated_at',
  ]);
  assert.equal(db.getChat('chat-ghost'), null);
});

test('空库启动：列表为空、total 0（F02-7 / 验收 7）', () => {
  const { db } = openTempDb();
  assert.deepEqual(db.listChats(), { chats: [], total: 0, limit: 50, offset: 0 });
});

test('upsertChat：建行即 working，重复调用改标题/updated_at 但保留 created_at，已关闭不被改写（AR-01 / §4.3）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'first', agentId: 'a1', nowMs: T0 });
  const created = db.getChat('chat-1').chat;
  assert.deepEqual(created, {
    chat_id: 'chat-1', title: 'first', agent_id: 'a1', state: 'working', created_at: T0, updated_at: T0, closed_at: null, archived_at: null, context_released: 0,
  });

  db.upsertChat({ chatId: 'chat-1', title: 'second', agentId: 'a2', nowMs: T0 + 5 });
  const updated = db.getChat('chat-1').chat;
  assert.equal(updated.title, 'second');
  assert.equal(updated.agent_id, 'a2');
  assert.equal(updated.created_at, T0, 'created_at 不应被改写');
  assert.equal(updated.updated_at, T0 + 5);

  db.closeChat('chat-1', T0 + 10);
  db.upsertChat({ chatId: 'chat-1', title: 'third', nowMs: T0 + 20 });
  const closed = db.getChat('chat-1').chat;
  assert.equal(closed.state, 'closed');
  assert.equal(closed.title, 'second', '已关闭 chat 不应被 upsert 改写');
  assert.equal(closed.updated_at, T0 + 10);
});

test('closeChat：置终态并记 closed_at，未知 chat 返回 false（F01-5 / §4.5）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'T', nowMs: T0 });
  assert.equal(db.closeChat('chat-1', T0 + 7), true);
  assert.deepEqual(db.getChat('chat-1').chat, {
    chat_id: 'chat-1', title: 'T', agent_id: null, state: 'closed', created_at: T0, updated_at: T0 + 7, closed_at: T0 + 7, archived_at: null, context_released: 0,
  });
  assert.equal(db.closeChat('chat-ghost'), false);
});

test('closeChat 幂等：重复关闭不改写 closed_at/updated_at（验收 9 / §4.5）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'T', nowMs: T0 });
  db.closeChat('chat-1', T0 + 7);
  assert.equal(db.closeChat('chat-1', T0 + 99), true);
  const chat = db.getChat('chat-1').chat;
  assert.equal(chat.closed_at, T0 + 7);
  assert.equal(chat.updated_at, T0 + 7);
});

test('closed 哨兵：迟到输入/输出不改写已关闭 chat 状态与更新时间（验收 9 / §4.3/§4.7）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q', nowMs: T0 });
  db.closeChat('chat-1', T0 + 1);
  db.insertInput({ chatId: 'chat-1', text: 'late-q', nowMs: T0 + 2 });
  db.insertOutput({ chatId: 'chat-1', text: 'late-a', nowMs: T0 + 3 });

  const chat = db.getChat('chat-1').chat;
  assert.equal(chat.state, 'closed');
  assert.equal(chat.updated_at, T0 + 1);
  assert.equal(db.getChat('chat-1').messages.length, 3, '哨兵只拦状态写入，不拦消息落盘');
});

test('startupSweep：遗留 working → failed，返回影响行数，其余状态不动（验收 9 / AR-05 / §4.3）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-w1', text: 'q', nowMs: T0 });
  db.insertInput({ chatId: 'chat-w2', text: 'q', nowMs: T0 });
  db.insertInput({ chatId: 'chat-done', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-done', text: 'a', nowMs: T0 + 1 });
  db.insertInput({ chatId: 'chat-failed', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-failed', text: 'e', error: 'timeout', nowMs: T0 + 1 });
  db.upsertChat({ chatId: 'chat-closed', title: 'T', nowMs: T0 });
  db.closeChat('chat-closed', T0 + 1);

  assert.equal(db.startupSweep(), 2);
  assert.equal(db.startupSweep(), 0, '再次扫尾无遗留 working');
  const states = Object.fromEntries(db.listChats().chats.map((c) => [c.chat_id, c.state]));
  assert.deepEqual(states, {
    'chat-closed': 'closed', 'chat-done': 'completed', 'chat-failed': 'failed', 'chat-w1': 'failed', 'chat-w2': 'failed',
  });
});

test('archiveChat：未归档且非 working → 标记+时间+释放位；working 与已归档 → false 且不变（F01-2/4、F02-2）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-working', text: 'q', nowMs: T0 });
  db.insertInput({ chatId: 'chat-done', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-done', text: 'a', nowMs: T0 + 1 });
  db.insertInput({ chatId: 'chat-closed', text: 'q', nowMs: T0 });
  db.closeChat('chat-closed', T0 + 2);

  assert.equal(db.archiveChat('chat-working', T0 + 10), false, '进行中不可归档（范围兜底）');
  const working = db.getChat('chat-working').chat;
  assert.equal(working.archived_at, null);
  assert.equal(working.context_released, 0);

  assert.equal(db.archiveChat('chat-done', T0 + 10), true);
  const archived = db.getChat('chat-done').chat;
  assert.equal(archived.archived_at, T0 + 10, '归档时间 = 传入毫秒');
  assert.equal(archived.context_released, 1);
  assert.equal(archived.state, 'completed', '归档不改变原状态（F02-1）');

  assert.equal(db.archiveChat('chat-done', T0 + 99), false, '已归档跳过（F01-4）');
  assert.equal(db.getChat('chat-done').chat.archived_at, T0 + 10, '归档时间不被刷新');

  assert.equal(db.archiveChat('chat-closed', T0 + 10), true, 'closed 未归档可归档');
  assert.equal(db.getChat('chat-closed').chat.state, 'closed');
  assert.equal(db.archiveChat('chat-ghost', T0 + 10), false, '未知 chat → false');
});

test('activateChat：未归档 → false 全不变；closed/completed 来源 → 清标记+状态还原+清 closed_at+置顶；重复 → false（F05-3/4/8）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-live', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-live', text: 'a', nowMs: T0 + 1 });
  assert.equal(db.activateChat('chat-live', T0 + 50), false, '未归档不可激活（N-5 结构性收窄）');
  assert.deepEqual(db.getChat('chat-live').chat, {
    chat_id: 'chat-live', title: 'q', agent_id: null, state: 'completed', created_at: T0, updated_at: T0 + 1,
    closed_at: null, archived_at: null, context_released: 0,
  });

  db.insertInput({ chatId: 'chat-closed', text: 'q', nowMs: T0 });
  db.closeChat('chat-closed', T0 + 2);
  db.archiveChat('chat-closed', T0 + 3);
  assert.equal(db.activateChat('chat-closed', T0 + 100), true);
  const restored = db.getChat('chat-closed').chat;
  assert.equal(restored.archived_at, null, 'F05-1 移除标记');
  assert.equal(restored.state, 'completed', 'closed → completed（F05-4）');
  assert.equal(restored.closed_at, null, '关闭时间被清除（F05-4）');
  assert.equal(restored.updated_at, T0 + 100, '置顶：updated_at 前移（F05-3）');
  assert.equal(restored.context_released, 1, '激活不改释放位（AR-16）');

  assert.equal(db.activateChat('chat-closed', T0 + 200), false, '重复激活 → false');
  assert.equal(db.getChat('chat-closed').chat.updated_at, T0 + 100, '重复激活不再前移');

  db.insertInput({ chatId: 'chat-done', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-done', text: 'a', nowMs: T0 + 1 });
  db.archiveChat('chat-done', T0 + 3);
  assert.equal(db.activateChat('chat-done', T0 + 100), true);
  const done = db.getChat('chat-done').chat;
  assert.equal(done.state, 'completed', 'completed 来源保持原状态（F05-4 前半）');
  assert.equal(done.closed_at, null);
  assert.equal(done.archived_at, null);
  assert.equal(done.updated_at, T0 + 100);
});

test('listArchivable：未归档且非 working 的候选集（completed/failed/closed 入选，working 与已归档排除）（F01-2）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-working', text: 'q', nowMs: T0 });
  db.insertInput({ chatId: 'chat-done', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-done', text: 'a', nowMs: T0 + 1 });
  db.insertInput({ chatId: 'chat-failed', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-failed', text: 'e', error: 'timeout', nowMs: T0 + 1 });
  db.insertInput({ chatId: 'chat-closed', text: 'q', nowMs: T0 });
  db.closeChat('chat-closed', T0 + 2);
  db.insertInput({ chatId: 'chat-archived', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-archived', text: 'a', nowMs: T0 + 1 });
  db.archiveChat('chat-archived', T0 + 3);

  assert.deepEqual(db.listArchivable(), ['chat-closed', 'chat-done', 'chat-failed'], '按 chat_id 升序，排除 working 与已归档');
  db.archiveChat('chat-done', T0 + 4);
  assert.deepEqual(db.listArchivable(), ['chat-closed', 'chat-failed']);
});

test('context_released：归档置 1，产生新回答后置 0（AR-16 / F05-6 提示消失时机）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a', nowMs: T0 + 1 });
  assert.equal(db.getChat('chat-1').chat.context_released, 0, '常规回答 → 0');
  db.archiveChat('chat-1', T0 + 2);
  assert.equal(db.getChat('chat-1').chat.context_released, 1, '归档置 1');
  db.activateChat('chat-1', T0 + 3);
  assert.equal(db.getChat('chat-1').chat.context_released, 1, '激活不改释放位');
  db.insertOutput({ chatId: 'chat-1', text: 'a2', nowMs: T0 + 4 });
  assert.equal(db.getChat('chat-1').chat.context_released, 0, '产生新回答即复位');
});

test('renameChat：只写 title 一列（其余 8 列逐项不变、updated_at 不刷新），返回权威标题（§3.1 硬契约 ① / F01 写入侧）', () => {
  const { dbPath, db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: 'q', agentId: 'a1', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-1', text: 'a', nowMs: T0 + 1 });

  const row = () => rawAll(dbPath, 'SELECT * FROM chats WHERE chat_id = ?', 'chat-1')[0];
  const before = row();
  assert.equal(before.agent_id, 'a1', '前置：agent 已归属');

  assert.equal(db.renameChat({ chatId: 'chat-1', title: '  季度复盘  ' }), '季度复盘', '返回值为 trim 后的权威标题');

  const after = row();
  assert.equal(after.title, '季度复盘', '唯一被写入的列');
  assert.equal(after.chat_id, before.chat_id);
  assert.equal(after.updated_at, before.updated_at, 'updated_at 不刷新（不置顶，F04）');
  assert.equal(after.updated_at, T0 + 1);
  assert.equal(after.agent_id, before.agent_id);
  assert.equal(after.state, before.state);
  assert.equal(after.archived_at, before.archived_at);
  assert.equal(after.closed_at, before.closed_at);
  assert.equal(after.created_at, before.created_at);
  assert.equal(after.context_released, before.context_released);
  assert.equal(db.getChat('chat-1').chat.title, '季度复盘', '读口与库值同源');
  db.close();
});

test('renameChat：同值改名幂等成功（SQLite 按命中行数计 changes，不视为失败）（§3.1 changes 语义表）', () => {
  const { dbPath, db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: '保留标题', agentId: 'a1', nowMs: T0 });
  const row = () => rawAll(dbPath, 'SELECT * FROM chats WHERE chat_id = ?', 'chat-1')[0];
  const before = row();

  assert.equal(db.renameChat({ chatId: 'chat-1', title: '保留标题' }), '保留标题', '同值仍计命中 → 幂等成功');
  assert.deepEqual(row(), before, '同值写入不产生任何可观察状态变化');
  db.close();
});

test('renameChat：未写入三态 → null 且库值不变（不存在 / 已归档 / 已关闭）（§3.1 双守卫 / F03）', () => {
  const { dbPath, db } = openTempDb();
  assert.equal(db.renameChat({ chatId: 'chat-ghost', title: 'X' }), null, '不存在 → 未命中');
  assert.equal(db.getChat('chat-ghost'), null, '不存在的行不会被创建');

  db.insertInput({ chatId: 'chat-arch', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-arch', text: 'a', nowMs: T0 + 1 });
  db.archiveChat('chat-arch', T0 + 2);
  const archRow = () => rawAll(dbPath, 'SELECT * FROM chats WHERE chat_id = ?', 'chat-arch')[0];
  const archBefore = archRow();
  assert.equal(db.renameChat({ chatId: 'chat-arch', title: 'X' }), null, '已归档 → 守卫①拦截');
  assert.deepEqual(archRow(), archBefore, '已归档行逐列不变');

  db.insertInput({ chatId: 'chat-closed', text: 'q', nowMs: T0 + 3 });
  db.closeChat('chat-closed', T0 + 4);
  const closedRow = () => rawAll(dbPath, 'SELECT * FROM chats WHERE chat_id = ?', 'chat-closed')[0];
  const closedBefore = closedRow();
  assert.equal(db.renameChat({ chatId: 'chat-closed', title: 'X' }), null, '已关闭 → 守卫②拦截');
  assert.deepEqual(closedRow(), closedBefore, '已关闭行逐列不变');
  db.close();
});

test('renameChat：非法标题抛错（消息以「标题非法: 」开头）且库值不变（§3.3 / F02 服务端校验）', () => {
  const { dbPath, db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: '原标题', nowMs: T0 });
  const row = () => rawAll(dbPath, 'SELECT * FROM chats WHERE chat_id = ?', 'chat-1')[0];
  const before = row();

  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: 123 }), { message: /^标题非法: 需为字符串/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: undefined }), { message: /^标题非法: 需为字符串/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: '' }), { message: /^标题非法: 不能为空或全为空白/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: '   ' }), { message: /^标题非法: 不能为空或全为空白/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: '　' }), { message: /^标题非法: 不能为空或全为空白/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: 'x'.repeat(101) }), { message: /^标题非法: 长度需 <= 100（当前 101）/ });
  assert.throws(() => db.renameChat({ chatId: 'chat-1', title: '😀'.repeat(51) }), { message: /^标题非法: 长度需 <= 100（当前 102）/ });

  assert.deepEqual(row(), before, '非法入参不进 SQL，库值逐列不变');
  db.close();
});

test('renameChat：边界通过（100 单位、50×emoji、内部空白保留、trim 落库）（§3.1 / F02）', () => {
  const { db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: 'T', nowMs: T0 });

  assert.equal(db.renameChat({ chatId: 'chat-1', title: 'x'.repeat(100) }), 'x'.repeat(100), '100 单位通过');
  assert.equal(db.getChat('chat-1').chat.title, 'x'.repeat(100));
  assert.equal(db.renameChat({ chatId: 'chat-1', title: '😀'.repeat(50) }), '😀'.repeat(50), '50×emoji = 100 单位通过');
  assert.equal(db.getChat('chat-1').chat.title, '😀'.repeat(50));
  assert.equal(db.renameChat({ chatId: 'chat-1', title: '年度 复盘  A' }), '年度 复盘  A', '内部空白保留');
  assert.equal(db.getChat('chat-1').chat.title, '年度 复盘  A');
  db.close();
});

test('renameChat：与自动标题路径隔离（改名后再 insertInput 保持手动值）（F05 / §3.3 结构性保证）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-1', text: '第一条输入', nowMs: T0 });
  assert.equal(db.getChat('chat-1').chat.title, '第一条输入', '自动标题 = 首条输入');

  db.renameChat({ chatId: 'chat-1', title: '手动标题' });
  db.insertInput({ chatId: 'chat-1', text: '第二条输入', nowMs: T0 + 1 });
  assert.equal(db.getChat('chat-1').chat.title, '手动标题', 'ensureChat 的 ON CONFLICT DO NOTHING 未被破坏');
  assert.equal(db.getChat('chat-1').chat.updated_at, T0 + 1, '后续输入照常刷新 updated_at');
  db.close();
});

test('双视图：缺省排除已归档、archived=1 只取已归档且 archived_at DESC, chat_id DESC、total 与集合同源（F03-2/3 / V-1~V-3）', () => {
  const { db } = openTempDb();
  db.insertInput({ chatId: 'chat-live-working', text: 'q', nowMs: T0 });
  db.insertInput({ chatId: 'chat-live-done', text: 'q', nowMs: T0 });
  db.insertOutput({ chatId: 'chat-live-done', text: 'a', nowMs: T0 + 1 });
  for (const chatId of ['chat-arch-a', 'chat-arch-b']) {
    db.insertInput({ chatId, text: 'q', nowMs: T0 });
    db.insertOutput({ chatId, text: 'a', nowMs: T0 + 1 });
  }
  db.insertInput({ chatId: 'chat-arch-c', text: 'q', nowMs: T0 });
  db.closeChat('chat-arch-c', T0 + 2);

  db.archiveChat('chat-arch-a', T0 + 10);
  db.archiveChat('chat-arch-b', T0 + 10); // 同归档时间 → 由 chat_id DESC 兜底
  db.archiveChat('chat-arch-c', T0 + 11);

  const main = db.listChats();
  assert.deepEqual(main.chats.map((c) => c.chat_id).sort(), ['chat-live-done', 'chat-live-working']);
  assert.equal(main.total, 2, 'total 与主列表集合同源');
  assert.equal(main.chats.every((c) => c.archived_at === null), true);

  const archived = db.listChats({ archived: 1 });
  assert.deepEqual(archived.chats.map((c) => c.chat_id), ['chat-arch-c', 'chat-arch-b', 'chat-arch-a'], 'archived_at DESC，同值 chat_id DESC');
  assert.equal(archived.total, 3, 'total 与归档视图集合同源');
  assert.deepEqual(archived.chats.map((c) => c.archived_at), [T0 + 11, T0 + 10, T0 + 10]);

  assert.deepEqual(db.listChats({ state: 'closed' }).chats.map((c) => c.chat_id), [], 'state 过滤同时排除已归档（V-5）');
  assert.deepEqual(db.listChats({ state: 'closed', archived: 1 }).chats.map((c) => c.chat_id), ['chat-arch-c']);

  assert.throws(() => db.listChats({ archived: 2 }), /archived/);
  assert.throws(() => db.listChats({ archived: '1' }), /archived/);
  assert.throws(() => db.listChats({ archived: -1 }), /archived/);
});

test('归档视图分页：limit 20 三页并集无重复无遗漏、total = 60（F04-1/3/4）', () => {
  const { db } = openTempDb();
  for (let i = 0; i < 60; i += 1) {
    const chatId = `chat-${String(i).padStart(2, '0')}`;
    db.insertInput({ chatId, text: 'q', nowMs: T0 + i });
    db.insertOutput({ chatId, text: 'a', nowMs: T0 + i });
    db.archiveChat(chatId, T0 + 1000 + i);
  }
  const pages = [0, 20, 40].map((offset) => db.listChats({ archived: 1, limit: 20, offset }));
  const ids = pages.flatMap((page) => page.chats.map((c) => c.chat_id));
  assert.equal(ids.length, 60);
  assert.equal(new Set(ids).size, 60, '分页无重叠无遗漏');
  assert.deepEqual(pages.map((page) => page.total), [60, 60, 60], 'total 与视图同源恒一致');
  assert.deepEqual(ids, Array.from({ length: 60 }, (_, i) => `chat-${String(59 - i).padStart(2, '0')}`), '归档时间倒序');
});

test('E-3 落盘侧：关闭连接后用同一路径重开，chat 与输入/输出（含 meta）一致可读回（验收 9 / F02-6）', () => {
  const { dbPath, db } = openTempDb();
  db.upsertChat({ chatId: 'chat-1', title: '重启前', agentId: 'a1', nowMs: T0 });
  db.insertInput({ chatId: 'chat-1', text: '重启前的问题', agentId: 'a1', meta: { task_id: 'task-1' }, nowMs: T0 + 1 });
  db.insertOutput({ chatId: 'chat-1', text: '重启前的答复', agentId: 'a1', model: 'openai/gpt-5.6-luna', meta: { context_id: 'ctx-9-1', pid: 99 }, nowMs: T0 + 2 });
  const before = db.getChat('chat-1');
  db.close();

  const reopened = openDb(dbPath);
  assert.deepEqual(reopened.getChat('chat-1'), before);
  assert.deepEqual(reopened.listChats().chats.map((c) => c.chat_id), ['chat-1']);
  reopened.close();
});

test('测试卫生：本文件所有库路径均落在 os.tmpdir() 下，不写 oamp/data/（验收 10 / §17）', () => {
  assert.ok(createdPaths.length > 0);
  for (const dbPath of createdPaths) {
    assert.ok(dbPath.startsWith(TMP_ROOT + path.sep), `库路径应在临时目录: ${dbPath}`);
    assert.ok(!dbPath.startsWith(OAMP_ROOT + path.sep), `库路径不得落在仓库内: ${dbPath}`);
  }
});
