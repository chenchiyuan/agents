// test/delivery-contract.test.js — F07 消息投递闭环契约测试（PR-004）
// 载体：脚本级假节点（test/helpers/fake-node.js，进程内）+ harness 拉起的真实 Router（临时 socket + 缩短 env）
//       + 一条真实 CLI agent 子进程用例（pr-002 agent 栈）。
// 语义准绳：architecture §4.4~4.6（send=单次同步代理/信封校验/错误映射）、§5.5（pendingDeliveries 与 ack 校验）、
//           §6.4/D12（deliver 自动受理：传输应答 {received:true} + 自动 ack accepted）、D11（无幂等去重状态机）。
// 方法面最小集覆盖（F07 验收 4）：agent.register / agent.heartbeat / message.send / message.deliver / message.ack
//   ——闭环用例实际驱动；agent.deregister 由假节点 stop() 于 teardown 触发。
// 隐私/日志卫生：消息正文不进日志断言（§6.4"不回显正文"）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { startRouter, startAgent, queryStatus, waitFor, stopAll } from './helpers/harness.js';
import { startFakeNode } from './helpers/fake-node.js';
import { RpcPeer, ERR } from '../src/rpc.js';

const HB_MS = 50; // 缩短 env 心跳间隔（§7.2：30~100ms 区间）
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function statusOf(socketPath, instanceId) {
  const snap = await queryStatus(socketPath);
  const nodes = (snap && snap.nodes) || [];
  return nodes.find((n) => n.instance_id === instanceId) || null;
}

let seq = 0;
function makeMsg(over = {}) {
  seq += 1;
  return {
    protocol: 'oamp/1',
    message_id: `msg-test-${seq}`,
    payload: { content_type: 'text/plain', body: 'hello' },
    ...over,
  };
}

/** 裸连接（未注册）——UNREGISTERED 用例用；不走 NodeClient（其 connect/register 封装非裸语义）。 */
function connectRawPeer(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath);
    socket.once('connect', () => resolve(new RpcPeer(socket, { idPrefix: 'raw' })));
    socket.once('error', reject);
  });
}

async function expectRejected(promise, dataCode, what) {
  let err = null;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  assert.ok(err, `${what}: 应被同步拒绝`);
  assert.equal(err.dataCode, dataCode, `${what}: 机器码应为 ${dataCode}`);
  return err;
}

// ─────────────────────────── T2：闭环 happy path（F07 验收 1~3 = PR 验收 1~3） ───────────────────────────

test('F07-1/4：双假节点闭环 register→send→deliver→ack 全链路 + 心跳继续（方法面最小集）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => a.stop());
  t.after(() => b.stop());

  // register 响应字段（§4.4 agent.register 行 result / 假节点 T1 验收 2）
  assert.equal(a.registered.instance_id, 'dev-a');
  assert.equal(a.registered.state, 'online');
  assert.match(a.registered.session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(a.registered.lease_timeout_ms, 300);
  assert.equal(typeof a.registered.last_heartbeat, 'number');

  // 发送（§4.4 message.send：单次投递同步代理）
  const msgId = 'msg-closure-1';
  const result = await a.send('dev-b', {
    protocol: 'oamp/1',
    message_id: msgId,
    type: 'task.request',
    payload: { content_type: 'text/plain', body: 'hello from closure' },
  });
  assert.deepEqual(result, { accepted: true, message_id: msgId, status: 'delivered' });

  await waitFor(() => b.deliverCount >= 1, { what: 'B 收到 deliver' });
  // Router 事件（§8.1 / §3.3 流程③顺序：先 MESSAGE_DELIVERED 后 MESSAGE_ACKED）
  await router.waitRouterLine(new RegExp(`MESSAGE_DELIVERED message_id=${msgId} from=dev-a to=dev-b`));
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=dev-b`));

  // 闭环后 A/B 心跳继续推进（§3.3 流程③末节"双方继续周期心跳"）
  const base = await statusOf(router.socketPath, 'dev-a');
  const baseB = await statusOf(router.socketPath, 'dev-b');
  await waitFor(async () => {
    const a2 = await statusOf(router.socketPath, 'dev-a');
    const b2 = await statusOf(router.socketPath, 'dev-b');
    return a2 && b2 && a2.last_heartbeat > base.last_heartbeat && b2.last_heartbeat > baseB.last_heartbeat;
  }, { what: 'A/B 心跳在消息闭环后继续推进', timeoutMs: 3000 });
});

test('F07-2/P-09：message_id 端到端贯通——send 提交→deliver 到达→ack 回执同一 id 可关联', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => a.stop());
  t.after(() => b.stop());

  const msgId = 'msg-e2e-1';
  await a.send('dev-b', makeMsg({ message_id: msgId }));

  // deliver 携带同一 message_id（§4.5 message_id 行：幂等键端到端不变）
  await waitFor(() => b.deliverCount >= 1, { what: 'B 收到 deliver' });
  assert.equal(b.received[0].message_id, msgId);

  // ack 回执引用同一 message_id（Router MESSAGE_ACKED 行锚点；ack 流向 = Router 记录，不回发送方）
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=dev-b`));

  // 自动 ack 已消费 pending：对同一 id 再 ack → UNKNOWN_MESSAGE（§5.5"查 pending 无 → UNKNOWN_MESSAGE"）
  await expectRejected(b.ack(msgId), ERR.UNKNOWN_MESSAGE, '自动 ack 后重复 ack');
});

test('F07-3/§4.5：payload 保真 + Router 代填 from/created_at（目标可还原发送内容与发送方）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => a.stop());
  t.after(() => b.stop());

  const jsonBody = JSON.stringify({ cmd: 'greet', who: 'dev-b', n: 42 });
  const submitted = {
    protocol: 'oamp/1',
    message_id: 'msg-payload-1',
    type: 'task.request',
    payload: { content_type: 'application/json', body: jsonBody },
  };
  await a.send('dev-b', submitted);
  await waitFor(() => b.deliverCount >= 1, { what: 'B 收到 deliver' });

  const got = b.received[0];
  // 信封与负载不丢不改（§4.5 校验表 / F07 验收 3）
  assert.equal(got.message_id, submitted.message_id);
  assert.equal(got.protocol, 'oamp/1');
  assert.equal(got.type, 'task.request');
  assert.deepEqual(got.payload, submitted.payload);
  assert.deepEqual(JSON.parse(got.payload.body), { cmd: 'greet', who: 'dev-b', n: 42 });
  // Router 代填：from = 发送方连接身份、to = 目标、created_at = UTC ISO-8601（§4.5 from/created_at 行 / §4.6）
  assert.deepEqual(got.from, { instance_id: 'dev-a', session_id: a.sessionId });
  assert.deepEqual(got.to, { instance_id: 'dev-b' });
  assert.match(got.created_at, ISO_RE);
  assert.ok(!Number.isNaN(Date.parse(got.created_at)), 'created_at 应为可解析时间戳');
  assert.ok(Date.parse(got.created_at) <= Date.now(), 'created_at 应为 Router 投递时生成');
});

// ─────────────────────── T3：错误映射 / 信封校验 / 钩子接管（PR 验收 4 + 边界组） ───────────────────────

test('UNREGISTERED：未注册连接 send → 同步拒绝（§4.3/§4.4）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const peer = await connectRawPeer(router.socketPath);
  t.after(() => peer.close());

  await expectRejected(
    peer.request(
      'message.send',
      { message: makeMsg({ to: { instance_id: 'dev-b' } }) },
      { timeoutMs: 2000 },
    ),
    ERR.UNREGISTERED,
    '未注册连接 send',
  );
});

test('AGENT_NOT_FOUND/§5.4：目标不存在 send → 同步拒绝（未注册目标 / deregister 后目标）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => a.stop());
  t.after(() => b.stop());

  // 目标从未注册（§4.3 AGENT_NOT_FOUND / F07 卡寻址节）
  await expectRejected(a.send('ghost-9', makeMsg()), ERR.AGENT_NOT_FOUND, '目标不存在 send');

  // deregister = 删除条目不留墓碑（§5.4）→ 同码 AGENT_NOT_FOUND
  await b.stop();
  await router.waitRouterLine(/AGENT_DEREGISTERED instance=dev-b/);
  await expectRejected(a.send('dev-b', makeMsg()), ERR.AGENT_NOT_FOUND, 'deregister 后目标 send');
});

test('AGENT_OFFLINE：目标已知但 offline（租约超时）send → 同步拒绝（§4.3/§4.6/§5.6）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  // B 不启心跳 → 300ms 租约到期被 Router 扫描判 offline（D7 sweep = clamp(300/4)=75ms）
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b' });
  t.after(() => a.stop());
  t.after(() => b.stop());

  await router.waitRouterLine(/AGENT_OFFLINE instance=dev-b/); // 判定锚点（§8.1/§5.6）
  const snap = await statusOf(router.socketPath, 'dev-b');
  assert.equal(snap.state, 'offline');
  await expectRejected(a.send('dev-b', makeMsg()), ERR.AGENT_OFFLINE, '目标 offline send');
});

test('UNKNOWN_MESSAGE：对未知 message_id 回 ack → 同步拒绝（§4.3/§5.5）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => b.stop());

  await expectRejected(b.ack('msg-never-sent'), ERR.UNKNOWN_MESSAGE, '未知 message_id ack');
});

test('INVALID_MESSAGE：信封校验失败逐项 → 同步拒绝（§4.5 校验表/§4.3）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  t.after(() => a.stop());

  const cases = [
    { name: '坏 protocol', call: () => a.send('dev-b', makeMsg({ protocol: 'oamp/2' })) },
    { name: '缺 message_id', call: () => a.send('dev-b', makeMsg({ message_id: undefined })) },
    { name: '空 message_id', call: () => a.send('dev-b', makeMsg({ message_id: '' })) },
    { name: '超长 message_id（>64）', call: () => a.send('dev-b', makeMsg({ message_id: 'x'.repeat(65) })) },
    { name: 'message_id 含控制字符', call: () => a.send('dev-b', makeMsg({ message_id: 'msg\nbad' })) },
    { name: '坏 to（含空白字符）', call: () => a.send('bad target', makeMsg()) },
    { name: '坏 to（空）', call: () => a.send('', makeMsg()) },
    { name: 'payload content_type 非法', call: () => a.send('dev-b', makeMsg({ payload: { content_type: 'text/html', body: 'x' } })) },
    { name: 'payload body 非字符串', call: () => a.send('dev-b', makeMsg({ payload: { content_type: 'text/plain', body: 42 } })) },
    { name: '缺 payload', call: () => a.send('dev-b', makeMsg({ payload: undefined })) },
  ];
  for (const c of cases) {
    await expectRejected(c.call(), ERR.INVALID_MESSAGE, `信封校验：${c.name}`);
  }
});

test('INVALID_SENDER：发送方自报 from → 同步拒绝（§4.5"发送方不得自报"/§4.3）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  t.after(() => a.stop());

  await expectRejected(
    a.send('dev-b', makeMsg({ from: { instance_id: 'evil' } })),
    ERR.INVALID_SENDER,
    '自报伪造 from',
  );
});

test('受理与 ack 分离：onDeliver 返回 false → 不自动 ack，手动 ack 成功（§6.4/D12/§10.1）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({
    socketPath: router.socketPath,
    instanceId: 'dev-b',
    heartbeatMs: HB_MS,
    onDeliver: () => false, // 接管：跳过自动 ack（延迟 ack 证明受理与 ack 分离）
  });
  t.after(() => a.stop());
  t.after(() => b.stop());

  const msgId = 'msg-nohook';
  await a.send('dev-b', makeMsg({ message_id: msgId }));
  await waitFor(() => b.deliverCount >= 1, { what: 'B 收到 deliver（受理）' });

  // 短窗确认无自动 ack（自动 ack 若发生会在数 ms 内；150ms 足够观察）
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(
    router.stdout.matching(new RegExp(`MESSAGE_ACKED message_id=${msgId}`)).length,
    0,
    '钩子返回 false 时不应自动 ack',
  );

  // 手动 ack 成功 → pending 未被消费（§5.5 ack 校验可关联）
  const ackResult = await b.ack(msgId);
  assert.deepEqual(ackResult, { acked: true, status: 'accepted' });
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=dev-b`));
});

test('重复 send 同 message_id：透传可区分，非幂等去重（D11/§5.5）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  const b = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-b', heartbeatMs: HB_MS });
  t.after(() => a.stop());
  t.after(() => b.stop());

  const msgId = 'msg-dup-1';
  // 第一次投递（等 MESSAGE_ACKED 落定再发第二次，消除 ack 竞态）
  const r1 = await a.send('dev-b', makeMsg({ message_id: msgId }));
  assert.deepEqual(r1, { accepted: true, message_id: msgId, status: 'delivered' });
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=dev-b`));

  // 第二次投递同 message_id → 同样成功（D11 无去重状态机；pending 按 message_id 记录 §5.5）
  const r2 = await a.send('dev-b', makeMsg({ message_id: msgId }));
  assert.deepEqual(r2, { accepted: true, message_id: msgId, status: 'delivered' });
  await waitFor(() => b.deliverCount >= 2, { what: 'B 收到两次 deliver' });
  assert.equal(b.received[0].message_id, msgId);
  assert.equal(b.received[1].message_id, msgId);
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=dev-b`), 2);
});

// ─────────────────────────── T4：真实 CLI agent 受理（PR 验收 5 / §10.1 / D12） ───────────────────────────

test('真实 agent 受理：send 投递 real-1 → 传输应答 + 自动 ack + MSG_RECEIVED（正文不进日志，§6.4）', async (t) => {
  const router = await startRouter();
  t.after(() => stopAll([router]));
  const agent = await startAgent('real-1', { socketPath: router.socketPath });
  t.after(() => agent.stop());
  await router.waitRouterLine(/AGENT_REGISTERED instance=real-1 session=/);

  const a = await startFakeNode({ socketPath: router.socketPath, instanceId: 'dev-a', heartbeatMs: HB_MS });
  t.after(() => a.stop());

  // 真实节点回传输应答后 Router 同步代理才完成（§4.4"同步等待目标传输层响应"）
  const secretBody = '超机密正文 DO-NOT-LOG-98765';
  const msgId = 'msg-real-1';
  const r1 = await a.send('real-1', makeMsg({ message_id: msgId, payload: { content_type: 'text/plain', body: secretBody } }));
  assert.deepEqual(r1, { accepted: true, message_id: msgId, status: 'delivered' });

  await router.waitRouterLine(new RegExp(`MESSAGE_DELIVERED message_id=${msgId} from=dev-a to=real-1`));
  await router.waitRouterLine(new RegExp(`MESSAGE_ACKED message_id=${msgId} instance=real-1`));

  // 真实 agent stdout：MSG_RECEIVED message_id/from/size，正文不回显（§6.4 日志卫生/隐私）
  const recvLine = await agent.waitAgentLine(new RegExp(`MSG_RECEIVED message_id=${msgId} from=dev-a size=\\d+`));
  assert.ok(!recvLine.includes(secretBody), 'MSG_RECEIVED 行不得含消息正文');
  assert.ok(!agent.stdout.text().includes(secretBody), 'agent 日志整体不得含消息正文');
  assert.match(recvLine, /size=\d+/);

  // 真实节点仍存活可再交互 → SIGINT 干净 deregister 退出 0（§6.3/F03-3）
  const r2 = await a.send('real-1', makeMsg({ message_id: 'msg-real-2' }));
  assert.deepEqual(r2, { accepted: true, message_id: 'msg-real-2', status: 'delivered' });
  const exit = await agent.stop();
  assert.equal(exit.code, 0);
  assert.equal(exit.signal, null);
  await router.waitRouterLine(/AGENT_DEREGISTERED instance=real-1/);
});
