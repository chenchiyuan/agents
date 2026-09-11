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
// 收到客户端应答后才结算 prompt。观测面：FAKE_ACP_ARGS_LOG（启动 argv）/ FAKE_ACP_FRAMES_LOG（应答与 session/cancel 帧）。
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

let serverSeq = 9000;
const awaitingReply = new Map(); // 服务端请求 id -> 对应的 session/prompt id

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.method === 'initialize') {
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
