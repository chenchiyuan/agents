// test/tool-permission.test.js — ACP 客户端 argv 参数化 + permission 应答/审计（fake ACP 帧级，不依赖真实 omp/网络）
// 覆盖：F04-AR-08/AR-09（argv 含否 --no-tools）、F02-AR-04（--append-system-prompt）,
//       F05-AR-10/AR-11（allow/deny/未知方法应答 + 每请求一行审计）、pr-003 验收 1~7。
// 范式：test/context-pool.test.js 的 FAKE_ACP_SOURCE（同构 fake bin 写 tmpdir、经 AcpClient 的 bin 注入）。
// 架构依据：architecture §3.2 / §4.3 / §4.4 / §4.5 / §11.2 / §12.2 跨组契约 1。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AcpClient } from '../src/acp-client.js';

// —— fake omp（acp 形态）：initialize / session/new（真实数组形态 configOptions）——
// 每次 session/prompt 主动下发一个服务端请求（按 FAKE_ACP_MODE：allow/deny → session/request_permission；unknown → fs/read_text_file），
// 收到客户端应答后才结算 prompt。toolcall* 模式则推 session/update 的 tool_call / tool_call_update 通知（§4.5 审计源）。
// 观测面：FAKE_ACP_ARGS_LOG（启动 argv）/ FAKE_ACP_FRAMES_LOG（initialize 帧、应答与 session/cancel 帧）。
const FAKE_ACP_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
const MODE = process.env.FAKE_ACP_MODE || 'allow';

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\\n');
}
function log(envKey, entry) {
  const file = process.env[envKey];
  if (!file) return;
  try { fs.appendFileSync(file, JSON.stringify(entry) + '\\n'); } catch {}
}

log('FAKE_ACP_ARGS_LOG', argv);
let promptSeq = 0;

/** 推一帧 session/update（tool_call / tool_call_update）——§4.5 主机制的审计源。 */
function emit(sessionId, toolCallId, patch) {
  send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: Object.assign({ toolCallId }, patch) } });
}

let serverSeq = 9000;
const awaitingReply = new Map(); // 服务端请求 id -> 对应的 session/prompt id

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.method === 'initialize') {
    log('FAKE_ACP_FRAMES_LOG', { frame: 'initialize', params: msg.params });
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    return;
  }
  if (msg.method === 'session/new') {
    send({ jsonrpc: '2.0', id: msg.id, result: {
      sessionId: 'sess-1',
      configOptions: [{ id: 'model', category: 'model', currentValue: 'deepseek/deepseek-v4-flash', options: [] }],
    } });
    return;
  }
  if (msg.method === 'session/cancel') {
    log('FAKE_ACP_FRAMES_LOG', { frame: 'session/cancel', params: msg.params });
    return;
  }
  if (msg.method === 'session/prompt') {
    promptSeq += 1;
    const sid = msg.params.sessionId;
    if (MODE === 'toolcall') {
      // 同 id 三帧（pending → in_progress → completed）：终态首见落行 ⇒ 恰 1 行；title 超长以验截断
      emit(sid, 'tc-' + promptSeq, { sessionUpdate: 'tool_call', kind: 'edit', title: 'Create /tmp/role-smoke.txt ' + 'x'.repeat(130), status: 'pending', rawInput: { path: '/tmp/role-smoke.txt' } });
      emit(sid, 'tc-' + promptSeq, { sessionUpdate: 'tool_call_update', status: 'in_progress' });
      emit(sid, 'tc-' + promptSeq, { sessionUpdate: 'tool_call_update', status: 'completed' });
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    if (MODE === 'toolcall_two') {
      for (const toolCallId of ['tc-a', 'tc-b']) {
        emit(sid, toolCallId, { sessionUpdate: 'tool_call', kind: 'edit', title: 'Edit ' + toolCallId, status: 'pending', rawInput: { path: '/tmp/' + toolCallId + '.txt' } });
        emit(sid, toolCallId, { sessionUpdate: 'tool_call_update', status: 'completed' });
      }
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    if (MODE === 'toolcall_unterminated') {
      // 只观测到非终态：轮次结算冲账以「最后观测 status」落行，且无 path 时该键省略
      emit(sid, 'tc-open', { sessionUpdate: 'tool_call', kind: 'execute', title: 'Run something', status: 'pending' });
      emit(sid, 'tc-open', { sessionUpdate: 'tool_call_update', status: 'in_progress' });
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    if (MODE === 'toolcall_readonly') {
      // NC-5：只读类 kind（read）在 fake 层固化「同样落一行」；path 取 locations[0]（对象形态）
      emit(sid, 'tc-read', { sessionUpdate: 'tool_call', kind: 'read', title: 'Read foo.txt', status: 'pending', locations: [{ path: '/tmp/foo.txt' }] });
      emit(sid, 'tc-read', { sessionUpdate: 'tool_call_update', status: 'completed' });
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    if (MODE === 'toolcall_foreign') {
      // 非本会话通知：必须被忽略（§4.5 仅处理当前 sessionId）
      emit('other-sess', 'tc-foreign', { sessionUpdate: 'tool_call', kind: 'edit', title: 'Foreign', status: 'pending' });
      emit('other-sess', 'tc-foreign', { sessionUpdate: 'tool_call_update', status: 'completed' });
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    serverSeq += 1;
    awaitingReply.set(serverSeq, msg.id);
    if (MODE === 'unknown') {
      send({ jsonrpc: '2.0', id: serverSeq, method: 'fs/read_text_file', params: { sessionId: 'sess-1', path: '/tmp/x' } });
    } else {
      send({
        jsonrpc: '2.0',
        id: serverSeq,
        method: 'session/request_permission',
        params: {
          sessionId: 'sess-1',
          toolCall: {
            toolCallId: 'tc-' + serverSeq,
            toolName: 'edit',
            title: 'Create /tmp/role-smoke.txt with role marker' + 'x'.repeat(140),
            status: 'pending',
            rawInput: { file_path: '/tmp/role-smoke.txt' },
          },
          options: [
            { optionId: 'allow_once' },
            { optionId: 'allow_always' },
            { optionId: 'reject_once' },
            { optionId: 'reject_always' },
          ],
        },
      });
    }
    return;
  }

  // 客户端对我们服务端请求的应答（正常 result，或未知方法的 -32601 error）
  if (msg.id !== undefined && awaitingReply.has(msg.id)) {
    const promptId = awaitingReply.get(msg.id);
    awaitingReply.delete(msg.id);
    log('FAKE_ACP_FRAMES_LOG', {
      frame: 'server_request_reply',
      server_request_id: msg.id,
      result: msg.result || null,
      error: msg.error || null,
    });
    send({ jsonrpc: '2.0', id: promptId, result: { stopReason: 'end_turn', usage: {} } });
  }
});
`;

const tmpDirs = [];

/** 写一个 fake omp 到独立临时目录；env 观测面指向该目录（AcpClient 直接注入 bin，不依赖 OMP_BIN 包装）。 */
function writeFake(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-tool-permission-'));
  tmpDirs.push(dir);
  const bin = path.join(dir, 'fake-omp.js');
  fs.writeFileSync(bin, FAKE_ACP_SOURCE);
  fs.chmodSync(bin, 0o755);
  process.env.FAKE_ACP_ARGS_LOG = path.join(dir, 'args.log');
  process.env.FAKE_ACP_FRAMES_LOG = path.join(dir, 'frames.log');
  process.env.FAKE_ACP_MODE = mode;
  return { bin, argsLog: process.env.FAKE_ACP_ARGS_LOG, framesLog: process.env.FAKE_ACP_FRAMES_LOG };
}

function cleanup() {
  delete process.env.FAKE_ACP_ARGS_LOG;
  delete process.env.FAKE_ACP_FRAMES_LOG;
  delete process.env.FAKE_ACP_MODE;
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
}

/** 记录式 logger（AcpClient 只消费 event()/heartbeat()）。 */
function recorder() {
  const events = [];
  return {
    events,
    logger: { event: (name, fields) => events.push({ name, fields }), heartbeat: () => {} },
  };
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function startClient(clients, bin, opts = {}, logger = null) {
  const client = new AcpClient({ bin, cwd: process.cwd(), logger, ...opts });
  clients.push(client);
  await client.start();
  return client;
}

function withClients(t) {
  const clients = [];
  t.after(() => {
    for (const client of clients) client.kill();
    cleanup();
  });
  return clients;
}

test('F04/AR-08/AR-09：tools=true → argv 不含 --no-tools；缺省/false → 含（既有调用方回归）', async (t) => {
  const clients = withClients(t);

  const on = writeFake('allow');
  await startClient(clients, on.bin, { tools: true });
  const onArgv = readJsonLines(on.argsLog)[0];
  assert.deepEqual(onArgv.slice(0, 3), ['acp', '--no-skills', '--no-rules']);
  assert.ok(!onArgv.includes('--no-tools'), 'tools=true 不得传 --no-tools');
  for (const flag of ['--no-skills', '--no-rules', '--no-session']) {
    assert.ok(onArgv.includes(flag), `argv 应恒含 ${flag}`);
  }

  const dflt = writeFake('allow');
  await startClient(clients, dflt.bin, {});
  const dfltArgv = readJsonLines(dflt.argsLog)[0];
  assert.ok(dfltArgv.includes('--no-tools'), '缺省（既有 5 键调用方）必须沿用 --no-tools');
  assert.ok(!dfltArgv.includes('--append-system-prompt'), '未传 roleFile 不得出现注入参数');

  const off = writeFake('allow');
  await startClient(clients, off.bin, { tools: false });
  const offArgv = readJsonLines(off.argsLog)[0];
  assert.ok(offArgv.includes('--no-tools'), 'tools=false 必须传 --no-tools');
});

test('F02/AR-04：roleFile → argv 含 --append-system-prompt <绝对路径>', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  const roleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-role-'));
  tmpDirs.push(roleDir);
  const roleFile = path.join(roleDir, 'roles', 'dev', 'dev.md');
  fs.mkdirSync(path.dirname(roleFile), { recursive: true });
  fs.writeFileSync(roleFile, '# dev\n');

  await startClient(clients, fake.bin, { tools: true, roleFile });
  const argv = readJsonLines(fake.argsLog)[0];
  const idx = argv.indexOf('--append-system-prompt');
  assert.ok(idx >= 0, 'argv 应含 --append-system-prompt');
  assert.equal(argv[idx + 1], roleFile);
  assert.ok(path.isAbsolute(argv[idx + 1]), '注入值应为绝对路径');
  assert.ok(!argv.includes('--no-tools'));
});

test('F05-2/§11.2：允许档恒回 allow_once，N 次受门禁调用 = N 行 TOOL_APPROVED（字段齐全）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  const rec = recorder();
  const auditContext = { instance: 'pb-dev', role: 'dev', chat_id: 'chat-1', context_id: 'ctx-100-1' };
  const client = await startClient(clients, fake.bin, { tools: true, permission: 'allow', auditContext }, rec.logger);

  const first = await client.prompt('创建 role-smoke.txt');
  const second = await client.prompt('再创建一次');
  assert.equal(first.stop_reason, 'end_turn');
  assert.equal(second.stop_reason, 'end_turn');

  const replies = readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.equal(replies.length, 2);
  for (const reply of replies) {
    assert.equal(reply.error, null);
    assert.deepEqual(reply.result, { outcome: { outcome: 'selected', optionId: 'allow_once' } });
  }

  const approved = rec.events.filter((e) => e.name === 'TOOL_APPROVED');
  assert.equal(approved.length, 2, '两次受门禁调用必须恰有 2 条审计记录');
  assert.equal(rec.events.filter((e) => e.name === 'TOOL_DENIED').length, 0);

  const fields = approved[0].fields;
  assert.equal(fields.instance, 'pb-dev');
  assert.equal(fields.role, 'dev');
  assert.equal(fields.chat_id, 'chat-1');
  assert.equal(fields.context_id, 'ctx-100-1');
  assert.equal(fields.pid, client.pid);
  assert.equal(fields.tool, 'edit');
  assert.equal(fields.tool_call_id, 'tc-9001');
  assert.equal(fields.option, 'allow_once');
  assert.equal(fields.title.length, 120, 'title 截断 120 字符');
  assert.equal(approved[1].fields.tool_call_id, 'tc-9002');
});

test('§4.5：缺省 auditContext 时审计字段集合恒定（身份四键存在且为 null）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  const rec = recorder();
  const client = await startClient(clients, fake.bin, { tools: true }, rec.logger);

  const result = await client.prompt('创建 role-smoke.txt');
  assert.equal(result.stop_reason, 'end_turn');

  const approved = rec.events.filter((e) => e.name === 'TOOL_APPROVED');
  assert.equal(approved.length, 1);
  const fields = approved[0].fields;
  assert.deepEqual(
    Object.keys(fields).sort(),
    ['chat_id', 'context_id', 'instance', 'option', 'pid', 'role', 'source', 'title', 'tool', 'tool_call_id'].sort(),
    '审计字段集合不随调用方是否提供身份而变（pr-007：兼容路径新增 source 键）',
  );
  assert.equal(fields.instance, null);
  assert.equal(fields.role, null);
  assert.equal(fields.chat_id, null);
  assert.equal(fields.context_id, null);
  assert.equal(fields.pid, client.pid);
  assert.equal(fields.tool, 'edit');
  assert.equal(fields.option, 'allow_once');
  assert.equal(fields.source, 'acp_permission', '§4.5：兼容路径来源标识');
});

test('F05-3/F05-4：拒绝档回 reject_once + 立即 session/cancel + 轮次 permission_denied（会话保留）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('deny');
  const rec = recorder();
  const client = await startClient(
    clients,
    fake.bin,
    { tools: true, permission: 'deny', auditContext: { instance: 'pb-dev', role: 'dev', chat_id: 'chat-1', context_id: 'ctx-100-1' } },
    rec.logger,
  );

  await assert.rejects(
    () => client.prompt('创建 role-smoke.txt'),
    (err) => err.name === 'AcpError' && err.code === 'permission_denied' && /permission=deny/.test(err.message),
  );

  const frames = readJsonLines(fake.framesLog);
  const reply = frames.find((f) => f.frame === 'server_request_reply');
  assert.deepEqual(reply.result, { outcome: { outcome: 'selected', optionId: 'reject_once' } });
  assert.ok(
    frames.some((f) => f.frame === 'session/cancel' && f.params.sessionId === 'sess-1'),
    '拒绝后必须立即发出 session/cancel',
  );

  const denied = rec.events.filter((e) => e.name === 'TOOL_DENIED');
  assert.equal(denied.length, 1);
  assert.equal(denied[0].fields.option, 'reject_once');
  assert.equal(denied[0].fields.tool, 'edit');
  assert.equal(rec.events.filter((e) => e.name === 'TOOL_APPROVED').length, 0);
  assert.equal(client.dead, false, 'permission_denied 是轮次级：不 kill 子进程');
});

test('§4.4/W-5：未知服务端方法回 -32601（不静默丢弃、不挂起）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('unknown');
  const client = await startClient(clients, fake.bin, { tools: true });

  const result = await client.prompt('读文件');
  assert.equal(result.stop_reason, 'end_turn', '未知方法不得让该轮挂起');

  const reply = readJsonLines(fake.framesLog).find((f) => f.frame === 'server_request_reply');
  assert.equal(reply.result, null);
  assert.equal(reply.error.code, -32601);
  assert.equal(reply.error.message, 'Method not found');
});

test('§12.2 契约 1：onPermissionRequest 优先于静态 permission', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('deny');
  const rec = recorder();
  let seen = null;
  const client = await startClient(
    clients,
    fake.bin,
    {
      tools: true,
      permission: 'allow',
      onPermissionRequest: (info) => {
        seen = info;
        return 'deny';
      },
    },
    rec.logger,
  );

  await assert.rejects(() => client.prompt('创建 role-smoke.txt'), (err) => err.code === 'permission_denied');
  assert.equal(seen.sessionId, 'sess-1');
  assert.equal(seen.toolCall.toolName, 'edit');
  assert.ok(Array.isArray(seen.options));
  assert.equal(rec.events.filter((e) => e.name === 'TOOL_DENIED').length, 1);
});

// ─────────── pr-007（阶段 6 返工）：argv 档位映射（§4.4 主机制）+ `tool_call` 通知 → TOOL_CALL（§4.5） ───────────

test('§4.4/pr-007①：permission 档 → argv 追加 --approval-mode（仅 tools=true；tools=off/匿名不变）', async (t) => {
  const clients = withClients(t);

  const allow = writeFake('allow');
  await startClient(clients, allow.bin, { tools: true, permission: 'allow' });
  const allowArgv = readJsonLines(allow.argsLog)[0];
  const allowIdx = allowArgv.indexOf('--approval-mode');
  assert.ok(allowIdx >= 0, 'allow 档必须追加 --approval-mode');
  assert.equal(allowArgv[allowIdx + 1], 'yolo');
  assert.ok(!allowArgv.includes('--no-tools'));

  const deny = writeFake('allow');
  await startClient(clients, deny.bin, { tools: true, permission: 'deny' });
  const denyArgv = readJsonLines(deny.argsLog)[0];
  assert.equal(denyArgv[denyArgv.indexOf('--approval-mode') + 1], 'always-ask');

  const off = writeFake('allow');
  await startClient(clients, off.bin, { tools: false, permission: 'deny' });
  const offArgv = readJsonLines(off.argsLog)[0];
  assert.ok(!offArgv.includes('--approval-mode'), 'tools=false ⇒ 档位无意义，不得追加');
  assert.ok(offArgv.includes('--no-tools'));

  const anon = writeFake('allow');
  await startClient(clients, anon.bin, {});
  const anonArgv = readJsonLines(anon.argsLog)[0];
  assert.ok(!anonArgv.includes('--approval-mode'), '缺省（匿名实例）⇒ 不追加');
  assert.ok(anonArgv.includes('--no-tools'));
});

test('§4.5/pr-007③：同 id 多帧（pending→in_progress→completed）⇒ 恰 1 行；两次调用 ⇒ 恰 2 行（字段齐全）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('toolcall');
  const rec = recorder();
  const auditContext = { instance: 'pb-dev', role: 'dev', chat_id: 'chat-1', context_id: 'ctx-100-1' };
  const client = await startClient(clients, fake.bin, { tools: true, permission: 'allow', auditContext }, rec.logger);

  const first = await client.prompt('创建 role-smoke.txt');
  assert.equal(first.stop_reason, 'end_turn');
  assert.equal(rec.events.filter((e) => e.name === 'TOOL_CALL').length, 1, '三帧同一 id ⇒ 终态首见恰 1 行');
  const second = await client.prompt('再创建一次');
  assert.equal(second.stop_reason, 'end_turn');

  const rows = rec.events.filter((e) => e.name === 'TOOL_CALL');
  assert.equal(rows.length, 2, '两次独立调用（两个 toolCallId）⇒ 恰 2 行');
  assert.deepEqual(
    Object.keys(rows[0].fields).sort(),
    ['chat_id', 'context_id', 'instance', 'kind', 'path', 'pid', 'role', 'source', 'status', 'title', 'tool_call_id'].sort(),
    'TOOL_CALL 字段集合恒定（path 有值时在内）',
  );
  const fields = rows[0].fields;
  assert.equal(fields.instance, 'pb-dev');
  assert.equal(fields.role, 'dev');
  assert.equal(fields.chat_id, 'chat-1');
  assert.equal(fields.context_id, 'ctx-100-1');
  assert.equal(fields.pid, client.pid);
  assert.equal(fields.tool_call_id, 'tc-1');
  assert.equal(fields.kind, 'edit');
  assert.equal(fields.status, 'completed');
  assert.equal(fields.source, 'acp_tool_call');
  assert.equal(fields.title.length, 120, 'title 截断 120 字符');
  assert.equal(fields.path, '/tmp/role-smoke.txt', 'path 取 rawInput.path');
  assert.equal(rows[1].fields.tool_call_id, 'tc-2');
});

test('§4.5：未观测到终态的调用在轮次结算冲账（最后观测 status；无 path 则省略该键）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('toolcall_unterminated');
  const rec = recorder();
  const client = await startClient(
    clients,
    fake.bin,
    { tools: true, auditContext: { instance: 'pb-dev', role: 'dev', chat_id: 'chat-1', context_id: 'ctx-1' } },
    rec.logger,
  );

  const result = await client.prompt('跑个命令');
  assert.equal(result.stop_reason, 'end_turn');
  const rows = rec.events.filter((e) => e.name === 'TOOL_CALL');
  assert.equal(rows.length, 1, '轮次结算必须冲账，仍恰 1 行');
  assert.equal(rows[0].fields.tool_call_id, 'tc-open');
  assert.equal(rows[0].fields.status, 'in_progress', '以最后观测 status 落行');
  assert.equal(rows[0].fields.kind, 'execute', 'kind 沿用首帧观测值');
  assert.ok(!('path' in rows[0].fields), '无 path ⇒ 省略该键');
});

test('§4.5：一轮两次调用 ⇒ 2 行；非本会话通知忽略；无工具调用的轮次零行', async (t) => {
  const clients = withClients(t);

  const two = writeFake('toolcall_two');
  const recTwo = recorder();
  const c2 = await startClient(clients, two.bin, { tools: true }, recTwo.logger);
  await c2.prompt('做两件事');
  assert.deepEqual(
    recTwo.events.filter((e) => e.name === 'TOOL_CALL').map((e) => e.fields.tool_call_id),
    ['tc-a', 'tc-b'],
  );

  const foreign = writeFake('toolcall_foreign');
  const recForeign = recorder();
  const c3 = await startClient(clients, foreign.bin, { tools: true }, recForeign.logger);
  await c3.prompt('外部会话的通知');
  assert.equal(recForeign.events.filter((e) => e.name === 'TOOL_CALL').length, 0, '非本会话通知必须忽略');

  const plain = writeFake('allow');
  const recPlain = recorder();
  const c4 = await startClient(clients, plain.bin, { tools: true }, recPlain.logger);
  await c4.prompt('纯聊天');
  assert.equal(recPlain.events.filter((e) => e.name === 'TOOL_CALL').length, 0, '无工具调用的轮次零 TOOL_CALL');
});

// NC-5（§4.5 待实测边界）——**真实 omp 18.0.11 实测定稿（2026-09-11，pr-007）**：只读工具同样推送
// `tool_call` / `tool_call_update` 通知，实测行实录：`TOOL_CALL … kind=read title="Reading probe allow file"
// status=completed source=acp_tool_call path=<file>` ⇒ E5 字面口径「每一次工具调用恰一行」**完全成立**（分支①），
// 无需退化为「变更类调用 N=N」。本用例以 fake 固化该口径。
test('§4.5/NC-5：只读类 kind（read）同样落一行 TOOL_CALL（path 取 locations[0]）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('toolcall_readonly');
  const rec = recorder();
  const client = await startClient(clients, fake.bin, { tools: true }, rec.logger);

  await client.prompt('读文件');
  const rows = rec.events.filter((e) => e.name === 'TOOL_CALL');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fields.kind, 'read');
  assert.equal(rows[0].fields.status, 'completed');
  assert.equal(rows[0].fields.path, '/tmp/foo.txt');
});

test('§4.4/R-12：initialize 握手 clientCapabilities 恒为空对象（不得声明 fs.* / terminal）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  await startClient(clients, fake.bin, { tools: true, permission: 'allow' });

  const init = readJsonLines(fake.framesLog).find((f) => f.frame === 'initialize');
  assert.ok(init, 'fake 应记录 initialize 帧');
  assert.deepEqual(init.params.clientCapabilities, {}, 'V-10③：声明能力会把文件写入 / 终端委托给客户端 → 工具 failed');
});
