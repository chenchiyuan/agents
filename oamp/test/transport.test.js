// test/transport.test.js — PR-002 传输抽象单元测试（architecture §5.1~§5.4 / §17「单元」层）
// 载体：node:http 起真实服务（随机端口，?chat_id 交给 transport.handle）+ node:http 裸客户端读流断言
//       （可原样读 connection 等响应头）；web.js 已接线 createSseTransport（§5.1 替换点）。
// 不依赖浏览器、外网、真实 oamp/data/；每用例独立服务与连接。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createSseTransport } from '../src/transport.js';

const CHAT = 'chat-1';

/** 轮询直到 pred 为真或超时（不裸 sleep 关键路径）。 */
async function waitFor(pred, { timeoutMs = 3000, intervalMs = 10, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = pred();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`waitFor 超时: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 最小 SSE 服务：解析 ?chat_id 后交给 transport.handle（模拟 pr-004 接线，不改 web.js）。 */
async function startServer(transport, { onResponse = null } = {}) {
  const server = http.createServer((req, res) => {
    const chatId = new URL(req.url, 'http://127.0.0.1').searchParams.get('chat_id');
    if (!chatId) {
      res.writeHead(400).end('missing chat_id');
      return;
    }
    if (onResponse) onResponse(res);
    transport.handle(req, res, { chatId });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    stop: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}

/** 裸 http 客户端订阅 SSE：累积文本 + 可中止。 */
function openSse(port, chatId) {
  const client = { status: null, headers: null, text: '', ended: false, req: null };
  client.ready = new Promise((resolve, reject) => {
    client.req = http.get(
      { host: '127.0.0.1', port, path: `/api/stream?chat_id=${encodeURIComponent(chatId)}` },
      (res) => {
        client.status = res.statusCode;
        client.headers = res.headers;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          client.text += chunk;
        });
        res.on('end', () => {
          client.ended = true;
        });
        resolve(client);
      },
    );
    client.req.once('error', reject);
  });
  client.abort = () => client.req.destroy();
  return client;
}

const frames = (text) => text.split('\n\n').filter((f) => f !== '');
const eventFrames = (text) => frames(text).filter((f) => f.startsWith('event:'));

test('接口形状：kind=sse + handle/publish/close/closeAll（注入 heartbeatMs 不改形状）', () => {
  for (const transport of [createSseTransport(), createSseTransport({ heartbeatMs: 80 })]) {
    try {
      assert.equal(transport.kind, 'sse');
      for (const name of ['handle', 'publish', 'close', 'closeAll']) {
        assert.equal(typeof transport[name], 'function', `${name} 应为函数`);
      }
    } finally {
      transport.closeAll();
    }
  }
});

test('handle 建立订阅：SSE 响应头 + retry: 1000 首帧', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const client = openSse(server.port, CHAT);
  try {
    await client.ready;
    assert.equal(client.status, 200);
    assert.equal(client.headers['content-type'], 'text/event-stream; charset=utf-8');
    assert.equal(client.headers['cache-control'], 'no-store');
    assert.equal(client.headers.connection, 'keep-alive');
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    assert.equal(frames(client.text)[0], 'retry: 1000');
  } finally {
    client.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('publish 帧格式 event:/data: 且同一连接 FIFO 保序', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const client = openSse(server.port, CHAT);
  const first = { type: 'task_update', data: { chat_id: CHAT, task_id: 't1', kind: 'chunk', text: '第一段' } };
  const second = { type: 'chat_state', data: { chat_id: CHAT, state: 'working' } };
  try {
    await client.ready;
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    transport.publish(CHAT, first);
    transport.publish(CHAT, second);
    await waitFor(() => eventFrames(client.text).length >= 2, { what: '两帧事件' });
    assert.deepEqual(eventFrames(client.text), [
      `event: task_update\ndata: ${JSON.stringify(first.data)}`,
      `event: chat_state\ndata: ${JSON.stringify(second.data)}`,
    ]);
  } finally {
    client.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('无订阅者的 chatId：publish 不抛错、不缓存（后建订阅者收不到旧事件）', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const client = openSse(server.port, CHAT);
  const stale = { type: 'task_update', data: { chat_id: CHAT, text: '早于订阅的事件' } };
  const fresh = { type: 'notice', data: { chat_id: CHAT, kind: 'context_released', text: '订阅后的事件' } };
  try {
    assert.doesNotThrow(() => transport.publish(CHAT, stale));
    await client.ready;
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    transport.publish(CHAT, fresh);
    await waitFor(() => client.text.includes('订阅后的事件'), { what: '订阅后事件帧' });
    assert.ok(!client.text.includes('早于订阅的事件'), '无订阅者期间的事件不得补发');
  } finally {
    client.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('客户端断开后订阅被移除：再 publish 不向已关闭连接写入', async () => {
  const transport = createSseTransport();
  const writes = [];
  let serverRes = null;
  const server = await startServer(transport, {
    onResponse: (res) => {
      serverRes = res;
      const rawWrite = res.write.bind(res);
      res.write = (chunk, ...rest) => {
        writes.push(String(chunk));
        return rawWrite(chunk, ...rest);
      };
    },
  });
  const client = openSse(server.port, CHAT);
  try {
    await client.ready;
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '在线时' } });
    await waitFor(() => writes.length >= 2, { what: '在线期间写出 retry + 事件帧' });
    client.abort();
    await waitFor(() => serverRes.destroyed === true, { what: '服务端 res 关闭' });
    const before = writes.length;
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '断开后' } });
    await delay(50);
    assert.equal(writes.length, before, '断开后不得再向该连接写入');
  } finally {
    transport.closeAll();
    await server.stop();
  }
});

test('close(chatId) 移除该 chat 订阅并结束其连接，其他 chat 不受影响', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const closed = openSse(server.port, CHAT);
  const other = openSse(server.port, 'chat-2');
  try {
    await Promise.all([closed.ready, other.ready]);
    await Promise.all([
      waitFor(() => closed.text.includes('retry: 1000'), { what: 'chat-1 订阅' }),
      waitFor(() => other.text.includes('retry: 1000'), { what: 'chat-2 订阅' }),
    ]);
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '关闭前' } });
    await waitFor(() => closed.text.includes('关闭前'), { what: '关闭前事件帧' });
    transport.close(CHAT);
    await waitFor(() => closed.ended, { what: 'close(chatId) 结束连接' });
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '关闭后' } });
    await delay(50);
    assert.ok(!closed.text.includes('关闭后'), 'close(chatId) 后不得再写入该连接');
    assert.ok(!other.ended, 'close(chatId) 不得影响其他 chat 的连接');
    transport.publish('chat-2', { type: 'task_update', data: { chat_id: 'chat-2', text: '其他 chat 仍可推' } });
    await waitFor(() => other.text.includes('其他 chat 仍可推'), { what: '其他 chat 仍收到事件' });
  } finally {
    closed.abort();
    other.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('closeAll() 结束所有连接（多 chat）且之后 publish 无写入', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const first = openSse(server.port, CHAT);
  const second = openSse(server.port, 'chat-2');
  try {
    await Promise.all([first.ready, second.ready]);
    await Promise.all([
      waitFor(() => first.text.includes('retry: 1000'), { what: 'chat-1 订阅' }),
      waitFor(() => second.text.includes('retry: 1000'), { what: 'chat-2 订阅' }),
    ]);
    transport.closeAll();
    await Promise.all([
      waitFor(() => first.ended, { what: 'chat-1 连接结束' }),
      waitFor(() => second.ended, { what: 'chat-2 连接结束' }),
    ]);
    assert.doesNotThrow(() => {
      transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: 'closeAll 之后' } });
      transport.publish('chat-2', { type: 'task_update', data: { chat_id: 'chat-2', text: 'closeAll 之后' } });
    });
    assert.ok(!first.text.includes('closeAll 之后'));
    assert.ok(!second.text.includes('closeAll 之后'));
  } finally {
    first.abort();
    second.abort();
    await server.stop();
  }
});

test('同一 chat 多订阅者：各收一份同一帧', async () => {
  const transport = createSseTransport();
  const server = await startServer(transport);
  const a = openSse(server.port, CHAT);
  const b = openSse(server.port, CHAT);
  try {
    await Promise.all([a.ready, b.ready]);
    await Promise.all([
      waitFor(() => a.text.includes('retry: 1000'), { what: '订阅者 A' }),
      waitFor(() => b.text.includes('retry: 1000'), { what: '订阅者 B' }),
    ]);
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '广播' } });
    await waitFor(() => a.text.includes('广播') && b.text.includes('广播'), { what: '两个订阅者均收到' });
    assert.deepEqual(eventFrames(a.text), eventFrames(b.text));
  } finally {
    a.abort();
    b.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('心跳：注入 heartbeatMs 后按周期写 `: keepalive` 注释行，closeAll 后停止', async () => {
  const transport = createSseTransport({ heartbeatMs: 80 });
  const server = await startServer(transport);
  const client = openSse(server.port, CHAT);
  try {
    await client.ready;
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    await waitFor(() => client.text.includes(': keepalive'), { what: 'keepalive 注释行', timeoutMs: 2000 });
    const comments = frames(client.text).filter((f) => f.startsWith(':'));
    assert.ok(comments.length >= 1);
    assert.equal(comments[0], ': keepalive');
    for (const comment of comments) {
      assert.ok(!comment.includes('event:') && !comment.includes('data:'), '注释行不得携带事件字段');
    }
    transport.closeAll();
    await delay(200); // 心跳停表前可能已有一帧在途
    const before = (client.text.match(/: keepalive/g) || []).length;
    await delay(240); // 3 个心跳周期
    assert.equal((client.text.match(/: keepalive/g) || []).length, before, 'closeAll 后不得继续心跳');
  } finally {
    client.abort();
    await server.stop();
  }
});

test('心跳默认周期 15000ms（未注入 heartbeatMs）', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const transport = createSseTransport();
  const server = await startServer(transport);
  const client = openSse(server.port, CHAT);
  try {
    await client.ready;
    await waitFor(() => client.text.includes('retry: 1000'), { what: 'retry 首帧' });
    t.mock.timers.tick(14999);
    await delay(50);
    assert.ok(!client.text.includes(': keepalive'), '14999ms 时不应写心跳');
    t.mock.timers.tick(1);
    await waitFor(() => client.text.includes(': keepalive'), { what: '15000ms 心跳' });
  } finally {
    client.abort();
    transport.closeAll();
    await server.stop();
    t.mock.timers.reset();
  }
});

// ────────────────────────── 0015 pr-002：全局订阅键（chatId=null） ──────────────────────────
// 载体：同一 transport 的两个键位——/api/events ⇒ handle(chatId=null)，/api/stream?chat_id ⇒ handle(chatId)。

/** 双键服务：全局路径无参数、chat 路径解析 chat_id（模拟 web.js 的两条接线）。 */
async function startBothServer(transport) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/events') {
      transport.handle(req, res, { chatId: null });
      return;
    }
    transport.handle(req, res, { chatId: url.searchParams.get('chat_id') });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    stop: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}

/** 全局订阅客户端（无参数路径 /api/events）：与 openSse 同款裸 http 读流。 */
function openGlobal(port) {
  const client = { status: null, headers: null, text: '', ended: false, req: null };
  client.ready = new Promise((resolve, reject) => {
    client.req = http.get({ host: '127.0.0.1', port, path: '/api/events' }, (res) => {
      client.status = res.statusCode;
      client.headers = res.headers;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        client.text += chunk;
      });
      res.on('end', () => {
        client.ended = true;
      });
      resolve(client);
    });
    client.req.once('error', reject);
  });
  client.abort = () => client.req.destroy();
  return client;
}

test('全局键：publishGlobal 只到 /api/events 订阅者，chat 订阅者收不到（键隔离）', async () => {
  const transport = createSseTransport();
  const server = await startBothServer(transport);
  const chat = openSse(server.port, CHAT);
  const glob = openGlobal(server.port);
  const online = { type: 'agent_online', data: { instance_id: 'dev-2', last_heartbeat: 1730000000000 } };
  try {
    await Promise.all([chat.ready, glob.ready]);
    await Promise.all([
      waitFor(() => chat.text.includes('retry: 1000'), { what: 'chat 订阅' }),
      waitFor(() => glob.text.includes('retry: 1000'), { what: '全局订阅' }),
    ]);
    transport.publishGlobal(online);
    await waitFor(() => glob.text.includes('agent_online'), { what: '全局订阅收到事件' });
    assert.deepEqual(eventFrames(glob.text), [`event: agent_online\ndata: ${JSON.stringify(online.data)}`]);
    transport.publish(CHAT, { type: 'task_update', data: { chat_id: CHAT, text: '按对话事件' } });
    await waitFor(() => chat.text.includes('按对话事件'), { what: 'chat 订阅收到事件' });
    assert.ok(!chat.text.includes('agent_online'), 'chat 订阅者不得收到全局事件');
    assert.ok(!glob.text.includes('按对话事件'), '全局订阅者不得收到 chat 事件');
  } finally {
    chat.abort();
    glob.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('全局键：globalCount 随全局订阅建立/断开变化，chat 订阅不计入', async () => {
  const transport = createSseTransport();
  const server = await startBothServer(transport);
  const chat = openSse(server.port, CHAT);
  const first = openGlobal(server.port);
  const second = openGlobal(server.port);
  try {
    await Promise.all([chat.ready, first.ready, second.ready]);
    await Promise.all([
      waitFor(() => first.text.includes('retry: 1000'), { what: '全局订阅 A' }),
      waitFor(() => second.text.includes('retry: 1000'), { what: '全局订阅 B' }),
    ]);
    assert.equal(transport.globalCount(), 2, '两个全局订阅者（chat 订阅不计入）');
    first.abort();
    await waitFor(() => transport.globalCount() === 1, { what: 'globalCount 回落到 1' });
    second.abort();
    await waitFor(() => transport.globalCount() === 0, { what: 'globalCount 归零' });
    assert.ok(!chat.ended, '全局订阅断开不得影响 chat 连接');
  } finally {
    chat.abort();
    transport.closeAll();
    await server.stop();
  }
});

test('全局键：closeAll 覆盖全局订阅（连接结束、之后 publishGlobal 无写入）', async () => {
  const transport = createSseTransport();
  const server = await startBothServer(transport);
  const glob = openGlobal(server.port);
  try {
    await glob.ready;
    await waitFor(() => glob.text.includes('retry: 1000'), { what: '全局订阅' });
    assert.equal(transport.globalCount(), 1);
    transport.closeAll();
    await waitFor(() => glob.ended, { what: 'closeAll 结束全局连接' });
    assert.equal(transport.globalCount(), 0);
    assert.doesNotThrow(() => transport.publishGlobal({ type: 'agent_offline', data: { instance_id: 'dev-2' } }));
    await delay(50);
    assert.ok(!glob.text.includes('agent_offline'), 'closeAll 之后不得再写入全局连接');
  } finally {
    glob.abort();
    await server.stop();
  }
});
