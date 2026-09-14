// test/protocol-layer.test.js — B-16（architecture §9.4.2）：L2 协议层自证用例。
// 观测面：fake bin（沿用既有测试面的 `OAMP_OMP_BIN` 注入 + argv / 帧日志），零第三方依赖、零真实 omp / LLM / 外网。
// 五组断言：① 能力位 ② 解析链与选择域 ③ 选择与进程面（argv）④ RPC 逐帧映射与门 ⑤ oneshot 无会话语义。
// 依据：prs/pr-005-tasks.md T5 验收 1~8；architecture §5.2 / §5.3 / §5.4 / §5.6 / §5.7 / §9.4.2 B-16。
// 期望值真源 = `launcher.js` 模块（`PROFILES` / `buildArgv`），测试内不复写 argv 推导逻辑。

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPABILITY_KEYS, ProtocolError, createProtocolLayer, readApprovalToolName } from '../src/protocol.js';
import { buildArgv } from '../src/launcher.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-protocol-layer-'));
const FAKE_BIN = path.join(TMP, 'fake-omp.js');
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// —— fake bin：同一脚本三形态（rpc `--mode rpc` / acp 子命令 / 一次性 `-p`）——
// rpc 形态：握手（ready → negotiate_protocol）+ 按 `FAKE_SCRIPT` 剧本吐帧 + 记录收到/发出的帧；
// acp 形态：最小 initialize / session/new 应答（供 acp 分支装配观测）；
// 一次性形态：按 `FAKE_ONESHOT_LINES` 回吐行流（>0 时吐指定行数，否则 stdout / stderr 各一行）。
const FAKE_BIN_SOURCE = `#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');

const argv = process.argv.slice(2);
const send = (frame) => process.stdout.write(JSON.stringify(frame) + '\\n');
const log = (entry) => {
  if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(entry) + '\\n');
};
const terminal = () => ({
  type: 'agent_end',
  isTerminal: true,
  messages: [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: 'answer', stopReason: 'stop', usage: { input: 3, output: 4 } },
  ],
});
log({ event: 'argv', argv, pid: process.pid });

if (argv[0] === '-p') {
  const lines = Number(process.env.FAKE_ONESHOT_LINES || 0);
  if (lines > 0) {
    for (let i = 1; i <= lines; i += 1) console.log('line-' + i);
  } else {
    console.error('err-1');
    setTimeout(() => {
      console.log('out-1');
      console.log('out-2');
      console.error('');
      console.log('\\u001b[31mcolored\\u001b[0m');
    }, 50);
  }
  process.exitCode = 0;
} else if (argv[0] === 'acp') {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    log({ event: 'frame', frame: msg });
    if (msg.method === 'initialize') send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    else if (msg.method === 'session/new') send({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'sess-1', configOptions: [] } });
    else send({ jsonrpc: '2.0', id: msg.id, result: {} });
  });
} else {
  const script = process.env.FAKE_SCRIPT || 'basic';
  const delayMs = Number(process.env.FAKE_FIRST_DELAY_MS || 400);
  let gateQueue = [];
  let gateIndex = 0;
  const sendNextGate = () => {
    if (gateIndex >= gateQueue.length) { setTimeout(() => send(terminal()), 10); return; }
    const gate = gateQueue[gateIndex];
    gateIndex += 1;
    send(gate);
  };
  const emitTurn = () => {
    if (script === 'wait-abort' || script === 'nonterminal') {
      if (script === 'nonterminal') send({ type: 'agent_end', isTerminal: false, messages: [] });
      return;
    }
    if (script === 'fail-code') {
      send({ type: 'response', command: 'prompt', success: false, error: '模型不可用', code: 'model_unavailable' });
      return;
    }
    if (script === 'fail-classify') {
      send({ type: 'response', command: 'prompt', success: false, error: 'Agent is already processing a message.' });
      return;
    }
    if (script === 'gate' || script === 'gate-slow') {
      gateQueue = [{ id: 'g-1', type: 'extension_ui_request', method: 'select', title: 'Allow tool: bash\\nCommand: echo gate-A', options: ['Approve', 'Deny'] }];
      gateIndex = 0;
      sendNextGate();
      return;
    }
    if (script === 'gate-many') {
      gateQueue = [1, 2, 3].map((n) => ({
        id: 'g-' + n,
        type: 'extension_ui_request',
        method: 'select',
        title: 'Allow tool: bash\\nCommand: echo gate-' + n,
        options: ['Approve', 'Deny'],
      }));
      gateIndex = 0;
      sendNextGate();
      return;
    }
    if (script === 'chunk') {
      const logical = JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'chunked-text' } });
      const mid = Math.floor(logical.length / 2);
      send({ type: 'rpc_chunk', chunkId: 'c-1', index: 1, count: 2, byteLength: logical.length - mid, data: logical.slice(mid) });
      send({ type: 'rpc_chunk', chunkId: 'c-1', index: 0, count: 2, byteLength: mid, data: logical.slice(0, mid) });
      setTimeout(() => send(terminal()), 20);
      return;
    }
    if (script === 'ui-classes') {
      send({ id: 'd-1', type: 'extension_ui_request', method: 'setWidget', title: '' });
      send({ id: 'd-2', type: 'extension_ui_request', method: 'notify', title: 'hi' });
      send({ id: 'd-3', type: 'extension_ui_request', method: 'setStatus', title: 's' });
      send({ id: 'i-1', type: 'extension_ui_request', method: 'confirm', title: '继续吗' });
      send({ id: 'i-2', type: 'extension_ui_request', method: 'input', title: '输入' });
      setTimeout(() => send(terminal()), 40);
      return;
    }
    send({ type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 1 } });
    send({ type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', delta: 'think-1' } });
    send({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: '' } });
    send({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'hello' } });
    send({ type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', delta: '{"a":1}' } });
    send({ type: 'tool_execution_update', partialResult: { content: [{ type: 'text', text: 'tool-out' }], details: {} } });
    send({ type: 'tool_execution_update', partialResult: { content: [] } });
    send({ type: 'tool_execution_start', toolName: 'bash' });
    send({ type: 'tool_execution_end', toolName: 'bash' });
    send({ type: 'available_commands_update', commands: [] });
    send({ type: 'notice', text: 'unknown-frame' });
    send({ type: 'agent_end', isTerminal: false, messages: [] });
    setTimeout(() => send(terminal()), 20);
  };
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    log({ event: 'frame', frame });
    if (frame.type === 'negotiate_protocol') {
      send({ type: 'response', command: 'negotiate_protocol', success: true, data: { protocolVersion: frame.protocolVersion } });
      return;
    }
    if (frame.type === 'prompt') {
      send({ type: 'response', command: 'prompt', success: true, id: frame.id });
      setTimeout(emitTurn, delayMs);
      return;
    }
    if (frame.type === 'extension_ui_response') {
      log({ event: 'ui-response', frame });
      const gate = gateIndex > 0 ? gateQueue[gateIndex - 1] : null;
      if (gate && frame.id === gate.id) sendNextGate();
      return;
    }
    if (frame.type === 'abort') {
      log({ event: 'abort', frame });
      setTimeout(() => send(terminal()), 10);
      return;
    }
  });
  if (script === 'late') {
    process.stdin.on('end', () => {
      send({ id: 'x-1', type: 'extension_ui_request', method: 'select', title: 'Allow tool: bash\\nCommand: late' });
      send({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'late-delta' } });
      send({ type: 'unknown-type', payload: 1 });
      send(terminal());
      process.exitCode = 0;
    });
  }
  setTimeout(() => send({ type: 'ready', protocolVersion: 1, supportedProtocolVersions: [1, 2], maxFrameBytes: 1048576, maxReassembledFrameBytes: 67108864 }), 5);
}
`;
fs.writeFileSync(FAKE_BIN, FAKE_BIN_SOURCE, { mode: 0o755 });
process.env.OAMP_OMP_BIN = FAKE_BIN; // bin 解析链第一档（`resolveBin`：OAMP_OMP_BIN > profile.bin > 'omp'）

// —— 观测面小工具（自包含，不新增 / 不修改 test/helpers/**） ——
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let logSeq = 0;
/** 为本用例开一份独立日志（env 必须在 spawn 之前注入）。返回读取函数。 */
function useLog(t, env = {}) {
  const logPath = path.join(TMP, `log-${(logSeq += 1)}.jsonl`);
  fs.writeFileSync(logPath, '');
  process.env.FAKE_LOG = logPath;
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  t.after(() => {
    delete process.env.FAKE_LOG;
    for (const key of Object.keys(env)) delete process.env[key];
  });
  const read = () =>
    fs
      .readFileSync(logPath, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line));
  return () => ({
    all: read(),
    argv: read().filter((entry) => entry.event === 'argv'),
    frames: read().filter((entry) => entry.event === 'frame').map((entry) => entry.frame),
    replies: read().filter((entry) => entry.event === 'ui-response').map((entry) => entry.frame),
    aborts: read().filter((entry) => entry.event === 'abort').map((entry) => entry.frame),
  });
}

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 20, what = '条件' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return;
    if (Date.now() >= deadline) throw new Error(`等待超时: ${what}`);
    await sleep(intervalMs);
  }
}

/** 起一个 rpc 常驻会话（观测面 = fake bin 的 argv / 帧日志）。 */
async function rpcSession(t, { resident = {}, hooks = null, env = {} } = {}) {
  const readLog = useLog(t, env);
  const layer = createProtocolLayer({ resident, bin: FAKE_BIN, cwd: TMP });
  const session = await layer.createResident({ chatId: 'chat-1', agentId: 'agent-1', role: 'dev', hooks });
  t.after(() => session.close());
  return { layer, session, readLog };
}

/** 起一个一次性会话（无会话语义；spawn 发生在 prompt 内）。 */
function oneshotSession(t, { resident = {}, hooks = null, env = {} } = {}) {
  const readLog = useLog(t, env);
  const layer = createProtocolLayer({ resident, bin: FAKE_BIN, cwd: TMP });
  const session = layer.createEphemeral({ hooks });
  t.after(() => session.close());
  return { layer, session, readLog };
}

/** 回收会话进程：acp 分支的会话对象外观（`close()`）归 pr-003 对齐，今日只有 `kill()` ⇒ 两者兼容回收。 */
function dispose(session) {
  if (typeof session.close === 'function') session.close();
  else if (typeof session.kill === 'function') session.kill();
}

// ─────────────────────────── ① 能力位（T5 验收 2） ───────────────────────────

test('① 能力位：rpc / oneshot 两实现六键齐全、三态取值、非 yes 必有非空 note', async (t) => {
  const rpc = await rpcSession(t, { resident: {} });
  const oneshot = oneshotSession(t, {});
  for (const [name, session] of [
    ['rpc', rpc.session],
    ['oneshot', oneshot.session],
  ]) {
    const capabilities = session.capabilities;
    assert.deepEqual(Object.keys(capabilities).sort(), [...CAPABILITY_KEYS].sort(), `${name}: 六键齐全且不增不减`);
    for (const key of CAPABILITY_KEYS) {
      assert.ok(['yes', 'no', 'degraded'].includes(capabilities[key]), `${name}.${key} 取值须 ∈ 三态`);
      if (capabilities[key] !== 'yes') {
        assert.equal(typeof session.capabilityNotes[key], 'string', `${name}.${key} 非 yes 须有 note`);
        assert.notEqual(session.capabilityNotes[key], '', `${name}.${key} 的 note 须非空`);
      }
    }
  }
  assert.equal(rpc.session.capabilities.thinking, 'yes');
  assert.equal(oneshot.session.capabilities.streaming, 'degraded');
  assert.equal(oneshot.session.capabilities.approvalGate, 'no');
  assert.equal(typeof rpc.session.pid, 'number'); // 常驻会话进程可读
});

// ─────────────────── ②③ 解析链四档 / 选择域 / 选择与进程面（argv） ───────────────────

test('②③ 无任何指定 ⇒ 走 rpc（argv 由 omp:rpc profile 产出，含 --mode rpc）', async (t) => {
  const resident = { model: 'fake/model', roleFile: '/tmp/role.md', tools: true };
  const { session, readLog } = await rpcSession(t, { resident });
  const [entry] = readLog().argv;
  assert.ok(entry, '须已 spawn 子进程');
  assert.deepEqual(
    entry.argv,
    buildArgv('omp:rpc', { model: 'fake/model', roleFile: '/tmp/role.md', tools: { mode: 'allow' } }),
  );
  assert.deepEqual(entry.argv.slice(0, 2), ['--mode', 'rpc']);
  assert.ok(!entry.argv.includes('--thinking'), 'profile thinking=null ⇒ 不传 --thinking');
  assert.equal(session.pid, entry.pid);
});

test('②③ 指定 acp ⇒ 起 acp 子进程（argv 首段 = acp 子命令，不回落 rpc）', async (t) => {
  const readLog = useLog(t, {});
  const layer = createProtocolLayer({ resident: { protocol: 'acp', model: 'fake/model' }, bin: FAKE_BIN, cwd: TMP });
  const session = await layer.createResident({ chatId: 'chat-1', agentId: 'agent-1', role: 'dev' });
  t.after(() => dispose(session));
  const [entry] = readLog().argv;
  assert.ok(entry, '须已 spawn 子进程');
  assert.equal(entry.argv[0], 'acp');
  assert.ok(!entry.argv.includes('--mode'), '指定 acp 不得回落 rpc');
  // acp 会话的标准面外观（能力位 / onDelta / ProtocolError）归 pr-003；本 PR 只判「选择与进程面」
  assert.equal(layer.capabilities(), null, 'acp 的能力位声明面随 AcpClient 实例落地（pr-003），门面侧为 null');
});

test('② 解析链四档逐档生效（角色级 > env / config.json 折叠值 > 内置 rpc）', async (t) => {
  const cases = [
    { name: '角色级 acp 覆盖折叠值 rpc', resident: { protocol: 'acp', configProtocol: 'rpc' }, expect: 'acp' },
    { name: '折叠值 acp（OAMP_PROTOCOL / config.json 档）', resident: { protocol: null, configProtocol: 'acp' }, expect: 'acp' },
    { name: '折叠值 rpc（config.json 档）', resident: { protocol: null, configProtocol: 'rpc' }, expect: 'rpc' },
    { name: '内置默认 rpc（两档皆未提供）', resident: {}, expect: 'rpc' },
  ];
  for (const item of cases) {
    const readLog = useLog(t, {});
    const layer = createProtocolLayer({ resident: item.resident, bin: FAKE_BIN, cwd: TMP });
    assert.equal(
      layer.capabilities() === null ? 'acp' : 'rpc',
      item.expect,
      `${item.name}: 选择结果须为 ${item.expect}`,
    );
    const session = await layer.createResident({ hooks: null });
    t.after(() => dispose(session));
    const [entry] = readLog().argv;
    assert.equal(entry.argv[0], item.expect === 'acp' ? 'acp' : '--mode', `${item.name}: 进程面须生效`);
  }
});

test('② 选择域封闭：域恰 {rpc, acp}，oneshot 不在域，越界值响亮失败', async (t) => {
  assert.equal(typeof createProtocolLayer({ resident: { protocol: 'rpc' } }).capabilities, 'function');
  assert.equal(typeof createProtocolLayer({ resident: { protocol: 'acp' } }).capabilities, 'function');
  for (const resident of [{ protocol: 'oneshot' }, { protocol: '非法值' }, { configProtocol: 'oneshot' }, { configProtocol: 'acp2' }]) {
    assert.throws(() => createProtocolLayer({ resident }), /OAMP 配置错误: .*仅支持 rpc\/acp/, JSON.stringify(resident));
  }
  // 空串 = 「空即未设」（体例同 config.js）⇒ 回落内置默认 rpc，不属越界
  assert.equal(typeof createProtocolLayer({ resident: { protocol: '' } }).capabilities, 'function');
});

// ─────────────────────────── ④ RPC 逐帧映射（T5 验收 5） ───────────────────────────

test('④ 三类增量逐 delta 原样（空 delta 跳过）+ tool_output 拼接（取不到文本跳过）+ 忽略面 + 受理不结算', async (t) => {
  const { session, readLog } = await rpcSession(t, { resident: { model: 'fake/model' } });
  const deltas = [];
  let settled = false;
  const pending = session
    .prompt('请回答', { timeoutMs: 10000, onDelta: (delta) => deltas.push(delta) })
    .then((result) => {
      settled = true;
      return result;
    });
  await sleep(100); // fake 在 400ms 后才吐帧 ⇒ 受理回包已到达
  assert.equal(settled, false, '受理回包只记受理，不结算轮次');
  const result = await pending;
  assert.deepEqual(deltas, [
    { kind: 'thinking', text: 'think-1' },
    { kind: 'chunk', text: 'hello' },
    { kind: 'tool_call', text: '{"a":1}' },
    { kind: 'tool_output', text: 'tool-out' },
  ]);
  assert.equal(result.text, 'hello', 'text = 本轮 chunk 累积（思考不计入答案）');
  assert.equal(result.model, 'fake/model');
  assert.equal(result.pid, session.pid);
  const sent = readLog().frames.filter((frame) => frame.type === 'prompt');
  assert.equal(sent.length, 1);
  assert.equal(typeof sent[0].id, 'number');
  assert.equal(sent[0].message, '请回答');
});

test('④ 终态结算：agent_end{isTerminal:true} 取 messages 末条 assistant 的 stopReason / usage', async (t) => {
  const { session } = await rpcSession(t, { resident: { model: 'fake/model' } });
  const result = await session.prompt('请回答', { timeoutMs: 10000 });
  assert.equal(result.text, 'hello');
  assert.equal(result.stop_reason, 'stop');
  assert.deepEqual(result.usage, { input: 3, output: 4 });
  assert.equal(result.pid, session.pid);
});

test('④ agent_end{isTerminal:false} 不结算（继续等下一个终态帧）', async (t) => {
  const { session } = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'nonterminal' } });
  let settled = false;
  const pending = session.prompt('请回答', { timeoutMs: 10000 }).then(
    (result) => {
      settled = true;
      return result;
    },
    (err) => {
      settled = true;
      throw err;
    },
  );
  await sleep(700);
  assert.equal(settled, false, '非终态帧不得结算轮次');
  session.close(); // 收尾：关 stdin ⇒ 子进程退出 ⇒ 轮次以 context_crashed 失败收尾
  await assert.rejects(pending, (err) => err instanceof ProtocolError && err.code === 'context_crashed');
  assert.equal(settled, true);
});

test('④ response{success:false} ⇒ ProtocolError（域内 code 原样 / 缺失时按命令归类）', async (t) => {
  const first = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'fail-code' } });
  await assert.rejects(
    first.session.prompt('请回答', { timeoutMs: 10000 }),
    (err) => err instanceof ProtocolError && err.code === 'model_unavailable',
  );
  const second = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'fail-classify' } });
  await assert.rejects(
    second.session.prompt('请回答', { timeoutMs: 10000 }),
    (err) => err instanceof ProtocolError && err.code === 'context_busy' && /already processing/.test(err.message),
  );
});

test('④ 门承接：恰一次 + title 首行取工具名 + 二元 options（optionId）+ 回执帧逐字', async (t) => {
  const calls = [];
  const hooks = {
    onApproval: (info) => {
      calls.push(info);
      return Promise.resolve({ optionId: 'Approve' });
    },
  };
  const { session, readLog } = await rpcSession(t, { resident: {}, hooks, env: { FAKE_SCRIPT: 'gate' } });
  const result = await session.prompt('请回答', { timeoutMs: 10000 });
  assert.equal(calls.length, 1, '一次受门禁调用恰一道门');
  assert.deepEqual(calls[0], {
    kind: 'tool_approval',
    toolCall: { toolName: 'bash', title: 'Allow tool: bash\nCommand: echo gate-A' },
    options: [{ optionId: 'Approve' }, { optionId: 'Deny' }],
  });
  assert.deepEqual(readLog().replies, [{ type: 'extension_ui_response', id: 'g-1', value: 'Approve' }]);
  assert.equal(result.text, '');
});

test('④ 门不重不欠：三帧门场景下回调计数 = 帧数', async (t) => {
  const calls = [];
  const hooks = { onApproval: (info) => { calls.push(info.toolCall.title); return Promise.resolve({ optionId: 'Approve' }); } };
  const { session, readLog } = await rpcSession(t, { resident: {}, hooks, env: { FAKE_SCRIPT: 'gate-many' } });
  await session.prompt('请回答', { timeoutMs: 10000 });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls, [
    'Allow tool: bash\nCommand: echo gate-1',
    'Allow tool: bash\nCommand: echo gate-2',
    'Allow tool: bash\nCommand: echo gate-3',
  ]);
  assert.equal(readLog().replies.length, 3);
});

test('④ 门等待不计入轮次超时：钩子未结算期间轮次计时冻结（L2-9）', async (t) => {
  const hooks = {
    onApproval: () => sleep(1200).then(() => ({ optionId: 'Approve' })),
  };
  const { session } = await rpcSession(t, { resident: {}, hooks, env: { FAKE_SCRIPT: 'gate-slow' } });
  // 轮次上限 300ms 远小于门挂起时长（1200ms）：若计时未冻结，本轮必超时
  const result = await session.prompt('请回答', { timeoutMs: 300 });
  assert.equal(result.stop_reason, 'stop');
});

test('④ 非门交互类回 {cancelled:true}；展示类不回执；轮次仍能正常终态', async (t) => {
  const hooks = { onApproval: () => Promise.resolve({ optionId: 'Approve' }) };
  const { session, readLog } = await rpcSession(t, { resident: {}, hooks, env: { FAKE_SCRIPT: 'ui-classes' } });
  const result = await session.prompt('请回答', { timeoutMs: 10000 });
  const replies = readLog().replies;
  assert.deepEqual(replies, [
    { type: 'extension_ui_response', id: 'i-1', cancelled: true },
    { type: 'extension_ui_response', id: 'i-2', cancelled: true },
  ]);
  assert.ok(!replies.some((reply) => reply.id.startsWith('d-')), '展示类不得回执');
  assert.equal(result.stop_reason, 'stop');
});

test('④ rpc_chunk 分片重组：处置与单帧路径一致', async (t) => {
  const { session } = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'chunk' } });
  const deltas = [];
  const result = await session.prompt('请回答', { timeoutMs: 10000, onDelta: (delta) => deltas.push(delta) });
  assert.deepEqual(deltas, [{ kind: 'chunk', text: 'chunked-text' }]);
  assert.equal(result.text, 'chunked-text');
});

test('④ cancel 幂等（abort 帧无参）+ close 容忍 EOF 后晚到的帧', async (t) => {
  const first = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'wait-abort' } });
  const pending = first.session.prompt('请回答', { timeoutMs: 10000 });
  await waitFor(() => first.readLog().frames.some((frame) => frame.type === 'prompt'), { what: 'prompt 帧到达' });
  const cancelOnce = first.session.cancel({ graceMs: 100 });
  const cancelTwice = first.session.cancel({ graceMs: 100 });
  await Promise.all([cancelOnce, cancelTwice]);
  await waitFor(() => first.readLog().aborts.length > 0, { what: 'abort 帧到达' });
  assert.deepEqual(first.readLog().aborts, [{ type: 'abort' }], 'abort 帧无参且重复调用不产生第二帧');
  assert.equal((await pending).stop_reason, 'stop');

  const second = await rpcSession(t, { resident: {}, env: { FAKE_SCRIPT: 'late' } });
  second.session.close();
  second.session.close(); // 幂等
  await sleep(300); // EOF 后 fake 仍吐帧（门 / 增量 / 未知帧）：不得崩、不得产生未捕获异常
  assert.equal(second.readLog().replies.length, 0, '关闭后到达的门不得被承接');
});

// ─────────────────────────── ⑤ oneshot 无会话语义（T5 验收 6） ───────────────────────────

test('⑤ oneshot argv = omp:oneshot profile 期望值（含末位位置参数与 --approval-mode yolo）', async (t) => {
  const { session, readLog } = oneshotSession(t, {
    resident: { model: 'fake/model', roleFile: '/tmp/role.md', tools: false },
  });
  await session.prompt('请回答', { timeoutMs: 10000, model: 'turn/model' });
  const [entry] = readLog().argv;
  assert.deepEqual(
    entry.argv,
    buildArgv('omp:oneshot', {
      model: 'turn/model',
      roleFile: '/tmp/role.md',
      tools: { mode: 'off' },
      prompt: '请回答',
    }),
  );
  assert.equal(entry.argv[0], '-p');
  assert.equal(entry.argv[entry.argv.length - 1], '请回答', '提示词 = argv 末位位置参数');
  assert.equal(entry.argv[entry.argv.indexOf('--approval-mode') + 1], 'yolo');
  assert.ok(!entry.argv.includes('--no-skills') && !entry.argv.includes('--no-rules'), 'profile skills/rules:true ⇒ 不追加');
});

test('⑤ 连续两轮 = 两次独立子进程、不续接、无 contextId', async (t) => {
  const { session, readLog } = oneshotSession(t, { resident: { model: 'fake/model' } });
  const first = await session.prompt('第一轮', { timeoutMs: 10000 });
  const second = await session.prompt('第二轮', { timeoutMs: 10000 });
  const entries = readLog().argv;
  assert.equal(entries.length, 2, '两轮两进程');
  assert.notEqual(entries[0].pid, entries[1].pid);
  assert.equal(first.pid, entries[0].pid);
  assert.equal(second.pid, entries[1].pid);
  assert.ok(!entries[1].argv.includes('第一轮'), '第二轮 argv 不含上一轮残留');
  assert.equal(session.contextId, null, '无会话语义 ⇒ 无上下文标识');
  assert.equal(session.pid, null, '轮次结算后无在飞进程');
});

test('⑤ 行流形状 {kind,text,stream} + stdout 累积 + 空行跳过 + 去 ANSI', async (t) => {
  const { session } = oneshotSession(t, { resident: { model: 'fake/model' } });
  const deltas = [];
  const result = await session.prompt('请回答', { timeoutMs: 10000, onDelta: (delta) => deltas.push(delta) });
  assert.deepEqual(deltas, [
    { kind: 'chunk', text: 'err-1', stream: 'stderr' },
    { kind: 'chunk', text: 'out-1', stream: 'stdout' },
    { kind: 'chunk', text: 'out-2', stream: 'stdout' },
    { kind: 'chunk', text: 'colored', stream: 'stdout' },
  ]);
  assert.equal(result.text, 'out-1\nout-2\ncolored', 'text = 本轮 stdout 行流累积');
  assert.equal(result.model, 'fake/model');
  assert.equal(result.stop_reason, null, '不造值');
  assert.equal(result.usage, null, '不造值');
  assert.equal(typeof result.pid, 'number');
});

test('⑤ MAX_STREAM_LINES = 200 截断：恰一次截断事件且 note 文案逐字', async (t) => {
  const { session } = oneshotSession(t, { resident: {}, env: { FAKE_ONESHOT_LINES: '250' } });
  const deltas = [];
  const result = await session.prompt('请回答', { timeoutMs: 10000, onDelta: (delta) => deltas.push(delta) });
  assert.equal(deltas.filter((delta) => delta.kind === 'chunk').length, 200);
  const truncated = deltas.filter((delta) => delta.event === 'truncated');
  assert.deepEqual(truncated, [{ event: 'truncated', note: '明细行数超上限（200），后续行不再逐条上报' }]);
  assert.equal(result.text.split('\n').length, 200);
});

test('⑤ 从不产生门（能力位 approvalGate:no）；非字符串提示词被拒（argv 不落字面 undefined）', async (t) => {
  const calls = [];
  const { session, readLog } = oneshotSession(t, {
    resident: {},
    hooks: { onApproval: () => { calls.push('gate'); return Promise.resolve({ optionId: 'Approve' }); } },
  });
  await assert.rejects(
    session.prompt(undefined, { timeoutMs: 10000 }),
    (err) => err instanceof ProtocolError && err.code === 'context_crashed',
  );
  assert.deepEqual(readLog().argv, [], '非字符串提示词不得 spawn（argv 末位不得出现字面 undefined）');
  await session.prompt('请回答', { timeoutMs: 10000 });
  assert.deepEqual(calls, [], '一次性实现不产生任何反向请求');
  assert.equal(readLog().argv.length, 1);
});

// ─────────────────────────── 标准面小面（T1 验收 10 / PR 验收 2） ───────────────────────────

test('门名解析原语：同源实现的首行提取语义（含多行 title 与五种边界输入）', () => {
  assert.equal(readApprovalToolName('Allow tool: bash'), 'bash');
  assert.equal(readApprovalToolName('Allow tool: write\nPath: /tmp/x\nContent:\ndone'), 'write');
  assert.equal(readApprovalToolName('Allow tool: bash\nCommand: echo a'), 'bash');
  assert.equal(readApprovalToolName('Allow tool:   '), null);
  assert.equal(readApprovalToolName('Read file: bash'), null);
  assert.equal(readApprovalToolName(null), null);
  assert.equal(readApprovalToolName({ title: 'Allow tool: bash' }), null);
});
