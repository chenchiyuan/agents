// test/tool-permission.test.js — ACP 客户端 argv 参数化 + permission 应答/审计（fake ACP 帧级，不依赖真实 omp/网络）
// 覆盖：F04-AR-08/AR-09（argv 含否 --no-tools）、F02-AR-04（--append-system-prompt）,
//       F05-AR-10/AR-11（allow/deny/未知方法应答 + 每请求一行审计）、pr-003 验收 1~7（含 B-16 的 acp 侧：
//       六键能力位 / onDelta({kind:'chunk'}) 增量面 / ProtocolError 错误契约）。
// 范式：test/context-pool.test.js 的 FAKE_ACP_SOURCE（同构 fake bin 写 tmpdir、经 AcpClient 的 bin 注入）。
// 架构依据：architecture §3.2 / §4.3 / §4.4 / §4.5 / §11.2 / §12.2 跨组契约 1。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AcpClient } from '../src/acp-client.js';
import { buildArgv, PROFILES } from '../src/launcher.js';
import { CAPABILITY_KEYS, ProtocolError } from '../src/protocol.js';

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
let pairReplies = 0; // suspend_pair*：本轮已结算的重叠等待数（两个都结算才收尾）

/** 推一帧 session/update（tool_call / tool_call_update）——§4.5 主机制的审计源。 */
function emit(sessionId, toolCallId, patch) {
  send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: Object.assign({ toolCallId }, patch) } });
}
/** 推一帧 form elicitation——缺省即第二道审批门（Approve|Deny select，真实 omp 同型帧）；label 供帧日志归位、schema 可换非审批形状。 */
function elicit(sessionId, promptId, message, label, schema) {
  serverSeq += 1;
  awaitingReply.set(serverSeq, { promptId, kind: 'elicitation', label: label || null });
  send({
    jsonrpc: '2.0',
    id: serverSeq,
    method: 'elicitation/create',
    params: {
      mode: 'form',
      sessionId,
      message: message || 'Allow tool: edit',
      requestedSchema: schema || { type: 'object', properties: { value: { type: 'string', enum: ['Approve', 'Deny'] } }, required: ['value'] },
    },
  });
}

let serverSeq = 9000;
const awaitingReply = new Map(); // 服务端请求 id -> { promptId, kind }

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
    if (MODE === 'elicit_only') {
      // 无第一道 permission 的 elicitation（非受门禁工具的审批门：无钩子时必须回落 Deny，不猜放行）
      elicit(sid, msg.id);
      return;
    }
    if (MODE === 'elicit_window') {
      // C2/C4 复现：call_A 经权限门放行后，窗口内插入一道与 call_A 无关的同型门；call_A 终态后再来一道。
      // 权限请求帧**不带** toolName（真实 omp 帧形：ACP 桥 mba() 只序列化 toolCallId/title/kind/rawInput/content/locations）。
      serverSeq += 1;
      awaitingReply.set(serverSeq, { promptId: msg.id, kind: 'permission', label: 'permission_A' });
      send({
        jsonrpc: '2.0',
        id: serverSeq,
        method: 'session/request_permission',
        params: {
          sessionId: sid,
          toolCall: { toolCallId: 'call_A', title: '$ echo hi', status: 'pending', rawInput: { command: 'echo hi', cwd: '/tmp' } },
          options: [
            { optionId: 'allow_once' },
            { optionId: 'allow_always' },
            { optionId: 'reject_once' },
            { optionId: 'reject_always' },
          ],
        },
      });
      return;
    }
    if (MODE === 'elicit_other') {
      // 非审批形状（ask 型 askDialog + boolean confirm）：形状不等同审批门 ⇒ 一律 decline（C5）
      elicit(sid, msg.id, '请选择', 'ask_dialog', { type: 'object', properties: { q0: { type: 'string', title: 'Q', oneOf: [{ const: 'A', title: 'A' }] } }, required: ['q0'] });
      elicit(sid, msg.id, '确认', 'confirm_boolean', { type: 'object', properties: { value: { type: 'boolean' } }, required: ['value'] });
      return;
    }
    if (MODE === 'suspend_pair' || MODE === 'suspend_pair_hang') {
      // L1-1（偏差 #3）：同一轮内**两个**裁决等待同时未结算——不等第一道门的应答就发第二道门（重叠挂起）。
      // 挂起期轮次计时必须保持冻结：任一等待未结算都不得解冻，否则轮次会在另一等待裁决前超时（cancel → kill）。
      serverSeq += 1;
      awaitingReply.set(serverSeq, { promptId: msg.id, kind: 'permission', label: 'perm_overlap' });
      send({
        jsonrpc: '2.0',
        id: serverSeq,
        method: 'session/request_permission',
        params: {
          sessionId: sid,
          toolCall: { toolCallId: 'call_ov', toolName: 'bash', title: '$ echo hi', status: 'pending', rawInput: { command: 'echo hi' } },
          options: [
            { optionId: 'allow_once' },
            { optionId: 'allow_always' },
            { optionId: 'reject_once' },
            { optionId: 'reject_always' },
          ],
        },
      });
      elicit(sid, msg.id, 'Allow tool: write', 'gate_overlap');
      return;
    }
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
    if (MODE === 'chunk') {
      // pr-003/B-16（acp 侧）：文本增量逐块下发（agent_message_chunk）+ 一帧思考增量（agent_thought_chunk）——
      // 后者必须**不被转发**（acp 只产文本块，§5.7 的 thinking='no' 由实现结构保证）。
      send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: '内部思考' } } } });
      for (const part of ['你好', '，世界']) {
        send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } } } });
      }
      send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn', usage: {} } });
      return;
    }
    serverSeq += 1;
    awaitingReply.set(serverSeq, { promptId: msg.id, kind: MODE === 'unknown' ? 'unknown_method' : 'permission' });
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
    const entry = awaitingReply.get(msg.id);
    awaitingReply.delete(msg.id);
    log('FAKE_ACP_FRAMES_LOG', {
      frame: 'server_request_reply',
      kind: entry.kind,
      label: entry.label || null,
      at: Date.now(),
      server_request_id: msg.id,
      result: msg.result || null,
      error: msg.error || null,
    });
    // M4：第一道门放行后才进第二道审批门（真实 omp 同序：放行 ⇒ 执行前 elicit；拒绝 ⇒ 不 elicit）
    if (entry.kind === 'permission' && MODE === 'elicit' && msg.result && msg.result.outcome && String(msg.result.outcome.optionId).startsWith('allow')) {
      elicit('sess-1', entry.promptId);
      return;
    }
    // C2/C4：permission_A 放行 ⇒ call_A 自己的门（gate_1）⇒ 无关同型门（gate_2）⇒ call_A 终态 ⇒ 终态后的门（gate_3）
    if (entry.label === 'permission_A' && msg.result && msg.result.outcome && String(msg.result.outcome.optionId).startsWith('allow')) {
      elicit('sess-1', entry.promptId, 'Allow tool: bash', 'gate_1_own');
      return;
    }
    if (entry.label === 'gate_1_own') {
      elicit('sess-1', entry.promptId, 'Allow tool: write', 'gate_2_unrelated');
      return;
    }
    if (entry.label === 'gate_2_unrelated') {
      emit('sess-1', 'call_A', { sessionUpdate: 'tool_call_update', status: 'completed' });
      elicit('sess-1', entry.promptId, 'Allow tool: bash', 'gate_3_after_terminal');
      return;
    }
    if (entry.label === 'ask_dialog') return; // 等第二道非审批询问答完再结算
    if (MODE === 'suspend_pair' || MODE === 'suspend_pair_hang') {
      pairReplies += 1;
      if (MODE === 'suspend_pair_hang') return; // 收到应答也不结算该轮（对照：验证恢复后按剩余预算续计）
      if (pairReplies < 2) return; // 两个重叠等待都结算后才收尾该轮
    }
    if (MODE === 'hang') return; // 收到应答也不结算该轮（pr-001④ 对照：验证超时路径与「按剩余时间恢复」）
    send({ jsonrpc: '2.0', id: entry.promptId, result: { stopReason: 'end_turn', usage: {} } });
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 轮询等待**进程外**事实成立（帧日志 / 子进程状态只能等，不能断言瞬时值）。 */
async function waitFor(predicate, what, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(10);
  }
  throw new Error(`等待超时：${what}`);
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
  // 期望值真源 = L1 的 omp:acp profile（argv 全序逐位比对；本文件不复写 profile 形态的期望数组）
  assert.deepEqual(onArgv, buildArgv('omp:acp', { tools: { mode: 'allow' } }));
  assert.ok(!onArgv.includes('--no-tools'), 'tools=true 不得传 --no-tools');
  for (const flag of ['--no-skills', '--no-rules', '--no-session']) {
    assert.ok(onArgv.includes(flag), `argv 应恒含 ${flag}`);
  }

  const dflt = writeFake('allow');
  await startClient(clients, dflt.bin, {});
  const dfltArgv = readJsonLines(dflt.argsLog)[0];
  assert.deepEqual(dfltArgv, buildArgv('omp:acp'), '缺省档 argv 全序 = omp:acp profile 期望值');
  assert.ok(dfltArgv.includes('--no-tools'), '缺省（既有 5 键调用方）必须沿用 --no-tools');
  assert.ok(!dfltArgv.includes('--append-system-prompt'), '未传 roleFile 不得出现注入参数');

  const off = writeFake('allow');
  await startClient(clients, off.bin, { tools: false });
  const offArgv = readJsonLines(off.argsLog)[0];
  assert.deepEqual(offArgv, buildArgv('omp:acp', { tools: { mode: 'off' } }));
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
  assert.deepEqual(argv, buildArgv('omp:acp', { roleFile, tools: { mode: 'allow' } }), 'argv 全序 = omp:acp profile 期望值');
  const idx = argv.indexOf('--append-system-prompt');
  assert.ok(idx >= 0, 'argv 应含 --append-system-prompt');
  assert.equal(argv[idx + 1], roleFile);
  assert.ok(path.isAbsolute(argv[idx + 1]), '注入值应为绝对路径');
  assert.ok(!argv.includes('--no-tools'));
});

test('pr-003/B-16：acp 标准面外观——六键能力位 + onDelta({kind:"chunk"}) + ProtocolError 错误契约', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('chunk');
  const deltas = [];
  const client = await startClient(clients, fake.bin, { tools: false });

  // ① 能力位（§5.7 的 acp 列逐字）：键集取自 CAPABILITY_KEYS（不增不减），非 yes 键必有非空 note
  assert.deepEqual(Object.keys(client.capabilities).sort(), [...CAPABILITY_KEYS].sort(), '六键齐全且不增不减');
  for (const key of CAPABILITY_KEYS) {
    assert.ok(['yes', 'no', 'degraded'].includes(client.capabilities[key]), `${key} 取值须 ∈ 三态`);
    if (client.capabilities[key] !== 'yes') {
      assert.equal(typeof client.capabilityNotes[key], 'string', `${key} 非 yes 须有 note`);
      assert.notEqual(client.capabilityNotes[key], '', `${key} 的 note 须非空`);
    }
  }
  assert.deepEqual(client.capabilities, {
    streaming: 'yes',
    thinking: 'no',
    approvalGate: 'yes',
    hostTools: 'no',
    introspection: 'yes',
    queueControl: 'no',
  });

  // ② 文本增量经 onDelta({kind:'chunk', text}) 逐块原样到达（不聚合）；思考块不转发（acp 不产生该增量）
  const result = await client.prompt('说点什么', { onDelta: (delta) => deltas.push(delta) });
  assert.deepEqual(deltas, [
    { kind: 'chunk', text: '你好' },
    { kind: 'chunk', text: '，世界' },
  ]);
  assert.equal(result.text, '你好，世界', '累积面逐字不变（acp 行为零变更）');

  // ③ 错误面 = 标准面的 ProtocolError（码值域五值）
  client.kill();
  await waitFor(() => client.dead, '子进程退出');
  const codes = ['context_crashed', 'model_unavailable', 'timeout', 'permission_denied', 'context_busy'];
  await assert.rejects(
    () => client.prompt('再来一轮'),
    (err) => {
      assert.ok(err instanceof ProtocolError, '错误须为标准面的 ProtocolError');
      assert.equal(err.name, 'ProtocolError');
      assert.ok(codes.includes(err.code), `码值须 ∈ 五值域（实得 ${err.code}）`);
      return true;
    },
  );
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
    (err) => err.name === 'ProtocolError' && err.code === 'permission_denied' && /permission=deny/.test(err.message),
  );

  // session/cancel 是**跨进程事实**：轮次结算（回包触发 prompt 拒绝）可能先于子进程把该帧追加进日志，
  // 直接读会偶发踩空（全量并行跑时 1/N 次）⇒ 先等该帧落地再断言（判据不变：帧必须存在且 params 逐字相同）。
  await waitFor(() => readJsonLines(fake.framesLog).some((f) => f.frame === 'session/cancel'), 'session/cancel 帧落地');
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

test('§4.4/L1-2②/pr-001①：tools=true 时两档 argv 恒为 --approval-mode always-ask（tools=off/匿名不变）', async (t) => {
  const clients = withClients(t);

  const allow = writeFake('allow');
  await startClient(clients, allow.bin, { tools: true, permission: 'allow' });
  const allowArgv = readJsonLines(allow.argsLog)[0];
  const allowIdx = allowArgv.indexOf('--approval-mode');
  assert.ok(allowIdx >= 0, 'allow 档必须追加 --approval-mode');
  assert.equal(allowArgv[allowIdx + 1], PROFILES['omp:acp'].approval.mode, 'yolo 档下 omp 不发权限请求（实测 M1）⇒ 上浮无来源');
  assert.ok(!allowArgv.includes('--no-tools'));

  const deny = writeFake('allow');
  await startClient(clients, deny.bin, { tools: true, permission: 'deny' });
  const denyArgv = readJsonLines(deny.argsLog)[0];
  assert.equal(denyArgv[denyArgv.indexOf('--approval-mode') + 1], PROFILES['omp:acp'].approval.mode);

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

test('§4.4/R-12：initialize 握手只声明 elicitation.form（fs.* / terminal 仍不声明）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  await startClient(clients, fake.bin, { tools: true, permission: 'allow' });

  const init = readJsonLines(fake.framesLog).find((f) => f.frame === 'initialize');
  assert.ok(init, 'fake 应记录 initialize 帧');
  assert.deepEqual(
    init.params.clientCapabilities,
    { elicitation: { form: {} } },
    'M4：omp 的第二道审批门经 elicitation form select 询问；fs.* / terminal 仍不声明（V-10③：声明即把文件写入/终端委托给客户端）',
  );
});
// ─────────── pr-001：挂起链路（L1-2② / L1-1） + M3 应答契约 + M4 第二道审批门 ───────────

test('L1-2/pr-001②：未结算 Promise 期间不回包；结算后回显钩子选定 optionId（审计在裁决后写）', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  const rec = recorder();
  let release = null;
  const client = await startClient(
    clients,
    fake.bin,
    { tools: true, permission: 'allow', onPermissionRequest: () => new Promise((resolve) => { release = resolve; }) },
    rec.logger,
  );

  const inflight = client.prompt('创建 role-smoke.txt');
  await waitFor(() => release !== null, '钩子被调用');
  await sleep(150);
  assert.equal(readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply').length, 0, '挂起期不得回包');
  assert.equal(
    rec.events.filter((e) => e.name === 'TOOL_APPROVED' || e.name === 'TOOL_DENIED').length,
    0,
    '审计行在裁决到达后写',
  );

  const settledAt = Date.now();
  release({ optionId: 'allow_always' });
  const result = await inflight;
  assert.equal(result.stop_reason, 'end_turn');

  const replies = readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.equal(replies.length, 1);
  assert.deepEqual(replies[0].result, { outcome: { outcome: 'selected', optionId: 'allow_always' } }, '回包 = 钩子选定值');
  assert.ok(replies[0].at >= settledAt, '应答帧晚于 Promise 结算');
  const approved = rec.events.filter((e) => e.name === 'TOOL_APPROVED');
  assert.equal(approved.length, 1);
  assert.equal(approved[0].fields.option, 'allow_always');
});

test('§5.4/pr-001③：optionId 不在该请求 options 集合内 ⇒ 回落默认项（应答值恒为合法 optionId）', async (t) => {
  const clients = withClients(t);

  const allowFake = writeFake('allow');
  const recAllow = recorder();
  const allowClient = await startClient(
    clients,
    allowFake.bin,
    { tools: true, permission: 'allow', onPermissionRequest: () => ({ optionId: 'allow_everything_forever' }) },
    recAllow.logger,
  );
  const result = await allowClient.prompt('创建 role-smoke.txt');
  assert.equal(result.stop_reason, 'end_turn', '非法 optionId 不得让该轮崩在协议校验里');
  const allowReply = readJsonLines(allowFake.framesLog).find((f) => f.frame === 'server_request_reply');
  assert.deepEqual(allowReply.result, { outcome: { outcome: 'selected', optionId: 'allow_once' } }, '放行侧回落 allow_once');
  assert.equal(allowReply.error, null, 'fake 侧不得出现未知 option ID 类错误');
  const approved = recAllow.events.filter((e) => e.name === 'TOOL_APPROVED');
  assert.equal(approved.length, 1);
  assert.equal(approved[0].fields.option, 'allow_once');

  const denyFake = writeFake('allow');
  const recDeny = recorder();
  const denyClient = await startClient(
    clients,
    denyFake.bin,
    { tools: true, permission: 'allow', onPermissionRequest: () => ({ optionId: 'reject_forever' }) },
    recDeny.logger,
  );
  await assert.rejects(() => denyClient.prompt('创建 role-smoke.txt'), (err) => err.code === 'permission_denied');
  const denyReply = readJsonLines(denyFake.framesLog).find((f) => f.frame === 'server_request_reply');
  assert.deepEqual(denyReply.result, { outcome: { outcome: 'selected', optionId: 'reject_once' } }, '拒绝侧回落 reject_once');
  const denied = recDeny.events.filter((e) => e.name === 'TOOL_DENIED');
  assert.equal(denied.length, 1);
  assert.equal(denied[0].fields.option, 'reject_once');
});

test('L1-1/pr-001④：单次挂起 > timeoutMs 时轮次未被 cancel/kill；裁决后正常结算', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('allow');
  let release = null;
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: () => new Promise((resolve) => { release = resolve; }),
  });

  const inflight = client.prompt('创建 role-smoke.txt', { timeoutMs: 150 });
  await waitFor(() => release !== null, '钩子被调用');
  await sleep(500); // > timeoutMs：冻结未生效则轮次早已被 cancel → 宽限 → kill
  assert.equal(client.dead, false, '冻结期间不得 kill 子进程');
  assert.equal(readJsonLines(fake.framesLog).filter((f) => f.frame === 'session/cancel').length, 0, '冻结期间不得 cancel');

  release('allow');
  const result = await inflight;
  assert.equal(result.stop_reason, 'end_turn', '裁决到达后按剩余时间恢复并正常结算');
  assert.equal(client.dead, false);
});

test('L1-1/pr-001④对照：超时语义不变（无挂起仍 cancel → kill）；挂起后按剩余时间恢复计时', async (t) => {
  const clients = withClients(t);

  // ① 无挂起（静态 allow）且轮次不结算 ⇒ 计时照常到点：session/cancel → 宽限 → kill
  const hang = writeFake('hang');
  const c1 = await startClient(clients, hang.bin, { tools: true, permission: 'allow' });
  const startedAt1 = Date.now();
  await assert.rejects(() => c1.prompt('创建 role-smoke.txt', { timeoutMs: 200 }), (err) => err.code === 'timeout');
  assert.ok(Date.now() - startedAt1 < 1500, '同步路径不因冻结逻辑而延长超时');
  await waitFor(() => readJsonLines(hang.framesLog).some((f) => f.frame === 'session/cancel'), '超时后 session/cancel 落帧');
  await waitFor(() => c1.dead === true, '超时后 kill 子进程');

  // ② 挂起 300ms 后裁决、轮次仍不结算 ⇒ 恢复后按剩余时间（200ms）续计：总耗时 ≈ 300 + 200
  const hang2 = writeFake('hang');
  let release = null;
  const c2 = await startClient(clients, hang2.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: () => new Promise((resolve) => { release = resolve; }),
  });
  const startedAt2 = Date.now();
  const inflight = c2.prompt('创建 role-smoke.txt', { timeoutMs: 200 });
  await waitFor(() => release !== null, '钩子被调用');
  await sleep(300);
  release('allow');
  await assert.rejects(() => inflight, (err) => err.code === 'timeout');
  const elapsed = Date.now() - startedAt2;
  assert.ok(elapsed >= 400, `等人拍板的时间不计入轮次预算（总耗时 ≥ 挂起 300 + 剩余 200；实测 ${elapsed}）`);
});

test('L1-1/偏差#3：重叠挂起（权限门 + 工具审批门同时未结算）期间轮次计时保持冻结；两个等待先后结算后正常结算', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('suspend_pair');
  const pending = new Map(); // 两个未结算等待各持一个 resolver（key = 上浮面的 kind）
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: (info) => new Promise((resolve) => { pending.set(info.kind || 'permission', resolve); }),
  });
  const cancels = () => readJsonLines(fake.framesLog).filter((f) => f.frame === 'session/cancel').length;

  let settled = null;
  const inflight = client.prompt('执行 echo hi', { timeoutMs: 300 });
  inflight.then((result) => { settled = { ok: true, result }; }, (err) => { settled = { ok: false, code: err.code }; });

  await waitFor(() => pending.size === 2, '两个裁决等待都已挂起（权限门 + 审批门）');
  await sleep(450); // > timeoutMs：冻结未生效则轮次早已 cancel → 宽限 → kill
  assert.equal(settled, null, '挂起期间轮次不得以 timeout 结算');
  assert.equal(client.dead, false, '冻结期间不得 kill 子进程');
  assert.equal(cancels(), 0, '冻结期间不得 cancel');

  pending.get('permission')('allow'); // 先结算一个：另一等待仍未结算 ⇒ 必须保持冻结
  await sleep(450); // > timeoutMs：先结算方若解冻计时器，轮次即在另一挂起未裁决时超时（偏差 #3 实测形态）
  assert.equal(settled, null, '仍有未结算等待时轮次不得以 timeout 结算');
  assert.equal(client.dead, false, '仍有未结算等待时不得 kill 子进程');
  assert.equal(cancels(), 0, '仍有未结算等待时不得 cancel');

  pending.get('tool_approval')('deny'); // 最后一个等待结算 ⇒ 按剩余时间恢复计时
  const result = await inflight;
  assert.equal(result.stop_reason, 'end_turn', '两个等待先后结算后轮次正常结算');
  assert.equal(client.dead, false);
  const replies = readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.deepEqual(replies.find((f) => f.label === 'perm_overlap').result, { outcome: { outcome: 'selected', optionId: 'allow_once' } });
  assert.deepEqual(replies.find((f) => f.label === 'gate_overlap').result, { action: 'accept', content: { value: 'Deny' } });
});

test('L1-1/偏差#3对照：一个挂起 + 一个立即结算 ⇒ 先结算方不得解冻计时；恢复后按剩余预算续计', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('suspend_pair_hang'); // 两个等待都结算后仍不结算该轮 ⇒ 恢复后的计时器必然到点
  let release = null;
  let gateCalls = 0;
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: (info) => {
      if (info.kind === 'tool_approval') { gateCalls += 1; return Promise.resolve('deny'); } // 立即结算的等待
      return new Promise((resolve) => { release = resolve; }); // 长挂起
    },
  });

  let settled = null;
  const startedAt = Date.now();
  const inflight = client.prompt('执行 echo hi', { timeoutMs: 300 });
  inflight.then((result) => { settled = { ok: true, result }; }, (err) => { settled = { ok: false, code: err.code }; });

  await waitFor(() => release !== null && gateCalls === 1, '两个等待都已进入（其一立即结算）');
  await sleep(450); // > timeoutMs：立即结算的一方若解冻了计时器，此处已超时
  assert.equal(settled, null, '仍有未结算等待时轮次不得以 timeout 结算');
  assert.equal(client.dead, false, '仍有未结算等待时不得 kill 子进程');
  assert.equal(readJsonLines(fake.framesLog).filter((f) => f.frame === 'session/cancel').length, 0, '仍有未结算等待时不得 cancel');

  release('allow'); // 最后一个等待结算 ⇒ 恢复计时（该轮不结算 ⇒ 剩余预算内到点）
  await assert.rejects(() => inflight, (err) => err.code === 'timeout');
  const elapsed = Date.now() - startedAt;
  assert.ok(elapsed >= 450 + 250, `恢复后按剩余预算（≈timeoutMs）续计，不得清零/缩短（实测 ${elapsed}）`);
});

test('M4：第一道门放行 ⇒ 第二道审批门（elicitation）答 Approve；无放行凭据 ⇒ 回落 Deny', async (t) => {
  const clients = withClients(t);

  const allow = writeFake('elicit');
  const c1 = await startClient(clients, allow.bin, { tools: true, permission: 'allow' });
  await c1.prompt('创建 role-smoke.txt');
  const allowReplies = readJsonLines(allow.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.deepEqual(allowReplies.find((f) => f.kind === 'permission').result, { outcome: { outcome: 'selected', optionId: 'allow_once' } });
  assert.deepEqual(
    allowReplies.find((f) => f.kind === 'elicitation').result,
    { action: 'accept', content: { value: 'Approve' } },
    '放行路径第二道门必须答 Approve（不答 ⇒ 模型侧得 Tool call denied by user——M4 根因）',
  );

  // 拒绝路径：第一道门即 cancel，不进入第二道门（真实 omp 同序：拒绝 ⇒ execute 不发起）
  const deny = writeFake('elicit');
  const c2 = await startClient(clients, deny.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: () => ({ optionId: 'reject_once' }),
  });
  await assert.rejects(() => c2.prompt('创建 role-smoke.txt'), (err) => err.code === 'permission_denied');
  const denyReplies = readJsonLines(deny.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.equal(denyReplies.length, 1, '拒绝路径不得进入第二道门');
  assert.deepEqual(denyReplies[0].result, { outcome: { outcome: 'selected', optionId: 'reject_once' } });

  // 无放行凭据的 elicitation（非受门禁工具的第二道门）：回落 Deny，绝不猜放行
  const orphan = writeFake('elicit_only');
  const c3 = await startClient(clients, orphan.bin, { tools: true, permission: 'allow' });
  const orphanResult = await c3.prompt('创建 role-smoke.txt');
  assert.equal(orphanResult.stop_reason, 'end_turn', 'C3：无钩子时审批门保守拒绝，轮次不得崩在协议校验里');
  const orphanReplies = readJsonLines(orphan.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.deepEqual(orphanReplies[0].result, { action: 'accept', content: { value: 'Deny' } });
});

test('M4/C1：无权限门的工具审批门（write 型）经钩子上浮；钩子放行 ⇒ Approve，钩子拒绝 ⇒ Deny（轮次均正常结算）', async (t) => {
  const clients = withClients(t);

  // 钩子放行：该形状的工具（不经 bEs 权限门）只有这一道门，必须可上浮（否则 always-ask 下写类工具被静默拒绝）
  const allow = writeFake('elicit_only');
  const allowCalls = [];
  const c1 = await startClient(clients, allow.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: (info) => {
      allowCalls.push(info);
      return info.kind === 'tool_approval' ? 'allow' : 'deny';
    },
  });
  const allowed = await c1.prompt('创建 role-smoke.txt');
  assert.equal(allowed.stop_reason, 'end_turn');
  assert.equal(allowCalls.length, 1, '审批门必须上浮，且恰一次');
  const info = allowCalls[0];
  assert.equal(info.kind, 'tool_approval', '上浮项须可与 ACP 权限门判定区分');
  assert.equal(info.sessionId, 'sess-1');
  assert.equal(info.toolCall.toolName, 'edit', '上浮项须携带工具名（取自 message 首行 Allow tool: <name>）');
  assert.equal(info.toolCall.title, 'Allow tool: edit');
  assert.deepEqual(info.options.map((o) => o.optionId), ['Approve', 'Deny'], '上浮项须携带请求方给的选项集合');
  assert.deepEqual(
    readJsonLines(allow.framesLog).find((f) => f.kind === 'elicitation').result,
    { action: 'accept', content: { value: 'Approve' } },
    '钩子放行 ⇒ 审批门答 Approve',
  );

  // 钩子拒绝：答 Deny 且轮次正常结算（不 cancel、不抛）
  const deny = writeFake('elicit_only');
  const c2 = await startClient(clients, deny.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: (gate) => (gate.kind === 'tool_approval' ? 'deny' : 'allow'),
  });
  const denied = await c2.prompt('创建 role-smoke.txt');
  assert.equal(denied.stop_reason, 'end_turn');
  assert.deepEqual(
    readJsonLines(deny.framesLog).find((f) => f.kind === 'elicitation').result,
    { action: 'accept', content: { value: 'Deny' } },
    '钩子拒绝 ⇒ 审批门答 Deny',
  );
});

test('M4/C1：审批门挂起（钩子返回未结算 Promise）期间同样冻结轮次计时，裁决后正常结算', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('elicit_only');
  let release = null;
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    // pr-002 的 pending 表即此形态：上浮后等人答复，等的时间不计入轮次预算（L1-1）
    onPermissionRequest: () => new Promise((resolve) => { release = resolve; }),
  });

  const inflight = client.prompt('创建 role-smoke.txt', { timeoutMs: 150 });
  await waitFor(() => release !== null, '审批门钩子被调用');
  await sleep(400); // > timeoutMs：冻结未生效则轮次早已被 cancel → 宽限 → kill
  assert.equal(client.dead, false, '冻结期间不得 kill 子进程');
  assert.equal(readJsonLines(fake.framesLog).filter((f) => f.frame === 'session/cancel').length, 0, '冻结期间不得 cancel');

  release('allow');
  const result = await inflight;
  assert.equal(result.stop_reason, 'end_turn', '裁决到达后按剩余时间恢复并正常结算');
  assert.deepEqual(
    readJsonLines(fake.framesLog).find((f) => f.kind === 'elicitation').result,
    { action: 'accept', content: { value: 'Approve' } },
  );
});

test('M4/C2+C4：放行凭据只抵扣紧随其后的一个审批门——窗口内无关同型门不再被静默放行', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('elicit_window');
  const gateCalls = [];
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: (info) => {
      if (info.kind === 'tool_approval') {
        gateCalls.push(info.toolCall.toolName);
        return 'deny'; // 上浮后由人裁决；本用例固定「拒绝」以便区分「凭据抵扣」与「上浮」
      }
      return 'allow';
    },
  });
  const result = await client.prompt('执行 echo hi');
  assert.equal(result.stop_reason, 'end_turn');

  const replies = readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply');
  const gate = (label) => replies.find((f) => f.label === label);
  assert.deepEqual(gate('permission_A').result, { outcome: { outcome: 'selected', optionId: 'allow_once' } });
  assert.deepEqual(
    gate('gate_1_own').result,
    { action: 'accept', content: { value: 'Approve' } },
    'C2：call_A 自己的审批门由本次放行凭据抵扣，不再重复上浮',
  );
  assert.deepEqual(
    gate('gate_2_unrelated').result,
    { action: 'accept', content: { value: 'Deny' } },
    'C4：放行窗口内与 call_A 无关的同型门必须上浮（不得沿用凭据静默 Approve）',
  );
  assert.deepEqual(
    gate('gate_3_after_terminal').result,
    { action: 'accept', content: { value: 'Deny' } },
    'C2：call_A 终态后凭据已失效，后续门一律上浮',
  );
  assert.deepEqual(gateCalls, ['write', 'bash'], 'C2/C4：只有无关门与终态后的门走上浮（自己的门被凭据抵扣 ⇒ 钩子零调用）');
});

test('M4/C5：非审批形状的 elicitation（ask 型 askDialog / boolean confirm）仍一律 decline', async (t) => {
  const clients = withClients(t);
  const fake = writeFake('elicit_other');
  const client = await startClient(clients, fake.bin, {
    tools: true,
    permission: 'allow',
    onPermissionRequest: () => 'allow', // 钩子恒放行：以此证明 decline 由「非审批形状」决定，而非钩子没给值
  });
  const result = await client.prompt('向用户提问');
  assert.equal(result.stop_reason, 'end_turn');
  const replies = readJsonLines(fake.framesLog).filter((f) => f.frame === 'server_request_reply');
  assert.deepEqual(replies.map((f) => f.label), ['ask_dialog', 'confirm_boolean']);
  for (const reply of replies) {
    assert.deepEqual(reply.result, { action: 'decline' }, `非审批 elicitation（${reply.label}）不得被本轮改动误答 Approve`);
  }
});
