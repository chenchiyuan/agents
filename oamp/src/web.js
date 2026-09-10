// src/web.js — `oamp web start [--port N]` 内建 Web 控制台（demo）
// 形态：Node 内置 http 服务（零新依赖）serve 静态单页 + JSON API；进程内以 'web' 身份
//       经 NodeClient/RpcPeer 连 Router（UDS）桥接——浏览器不直连 UDS。
// API：
//   GET  /api/agents                 → Router 拓扑快照（活跃 agent 列表）
//   GET  /api/chats                  → 会话摘要列表
//   GET  /api/chats/<chat_id>        → 会话详情（消息流 + join 任务明细）
//   POST /api/messages               → {chat_id?, agent_id, text} 写入会话 + 派发命令任务（消息即命令）
// 语义（用户确认）：消息即命令——文本经 `/bin/sh -c` 交目标 agent 执行，输出/exit/耗时回流为任务明细。
// 安全边界（demo）：监听 127.0.0.1；无鉴权（迭代 0010 N6 边界）；命令由输入文本决定。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { RpcPeer } from './rpc.js';
import { NodeClient } from './node-client.js';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const SENDER_ID = 'web'; // web 服务作为常驻发送方身份（R2：客户端节点）
const DEFAULT_PORT = 7788;
const QUERY_TIMEOUT_MS = 3000;

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(text);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error(`invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

/** 无状态查询：UDS 直连 Router 发一次 RPC（无需注册身份；Router 不可达 → 抛错）。 */
async function queryOnce(socketPath, method, params) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connect timeout: ${socketPath}`));
    }, 2000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  const peer = new RpcPeer(socket, { idPrefix: 'web' });
  try {
    return await peer.request(method, params, { timeoutMs: QUERY_TIMEOUT_MS });
  } finally {
    peer.close();
  }
}

function serveStatic(res, file) {
  const full = path.join(WEB_ROOT, file);
  if (!full.startsWith(WEB_ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': STATIC_TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}

export default async function startWeb(restArgs) {
  const args = restArgs || [];
  let port = Number(process.env.OAMP_WEB_PORT || DEFAULT_PORT);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--port') {
      port = Number(args[i + 1]);
      i += 1;
    }
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    process.stderr.write(`oamp web: 非法端口 "${process.env.OAMP_WEB_PORT ?? ''}"\n`);
    return 2;
  }

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp web: 配置错误: ${err && err.message ? err.message : err}\n`);
    return 1;
  }

  // 常驻发送方（懒连接：Router 尚未就绪/断开时，发送路径报错但查询路径仍可用）。
  // 注册后必须维持心跳：否则租约超时被判 offline，后续 send 得 UNREGISTERED。
  let sender = null;
  const heartbeatMs = Math.max(500, Math.min(config.heartbeatIntervalMs, Math.floor(config.heartbeatTimeoutMs / 3)));
  const ensureSender = async () => {
    if (sender && !sender.closed) return sender;
    const client = new NodeClient({ socketPath: config.socketPath });
    await client.connect();
    await client.register(SENDER_ID);
    client.startHeartbeat(heartbeatMs);
    client.onClose = () => {
      if (sender === client) sender = null; // 断线失效，下次发送时重连
    };
    sender = client;
    return sender;
  };
  /** 发送任务；失败（连接失效/被替换等）失效 sender 并重试一次。 */
  const sendTask = async (agentId, messageId, payloadBody) => {
    let lastErr = null;
    for (let i = 0; i < 2; i += 1) {
      try {
        const client = await ensureSender();
        return await client.send(agentId, {
          protocol: 'oamp/1',
          message_id: messageId,
          type: 'task.request',
          payload: { content_type: 'application/json', body: JSON.stringify(payloadBody) },
        });
      } catch (err) {
        lastErr = err;
        sender = null;
      }
    }
    throw lastErr;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && p === '/api/agents') {
        const r = await queryOnce(config.socketPath, 'router.status', {});
        sendJson(res, 200, { agents: r.nodes });
        return;
      }
      if (req.method === 'GET' && p === '/api/chats') {
        const r = await queryOnce(config.socketPath, 'router.chat_list', {});
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'GET' && p.startsWith('/api/chats/')) {
        const chatId = decodeURIComponent(p.slice('/api/chats/'.length));
        const r = await queryOnce(config.socketPath, 'router.chat_get', { chat_id: chatId });
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'POST' && p === '/api/messages') {
        const body = await readBody(req);
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        let agentId = typeof body.agent_id === 'string' ? body.agent_id : '';
        // 兜底解析 "@agent 剩余文本"（前端已解析时 agent_id 直接给出）
        if (!agentId) {
          const m = /^@([^\s@]+)\s+([\s\S]+)$/.exec(text);
          if (m) agentId = m[1];
        }
        if (!agentId) {
          sendJson(res, 400, { error: '需要指定目标 agent（输入 @agent 或提供 agent_id）' });
          return;
        }
        if (!text) {
          sendJson(res, 400, { error: '消息不能为空' });
          return;
        }
        // 消息文本 = 去掉 @agent 前缀后的剩余内容
        const messageText = text.replace(/^@[^\s@]+\s+/, '') || text;
        // 路由：默认交给 omp（真实 LLM 处理）；`!命令` 前缀走 shell（demo 保留能力）
        const payloadBody = messageText.startsWith('!')
          ? { command: '/bin/sh', args: ['-c', messageText.slice(1).trim()], label: messageText.slice(0, 60) }
          : { executor: 'omp', prompt: messageText, label: messageText.slice(0, 60) };
        const messageId = `msg-${randomUUID()}`;
        // 1) 先记录消息（保证即使派发失败，对话流仍完整）
        const chatResp = await queryOnce(config.socketPath, 'router.chat_message', {
          chat_id: typeof body.chat_id === 'string' && body.chat_id ? body.chat_id : undefined,
          agent_id: agentId,
          text,
          message_id: messageId,
        });
        const chatId = chatResp.chat_id;
        // 2) 派发命令任务（/bin/sh -c 执行整条文本；输出经任务明细回流）
        let taskId = null;
        let warning = null;
        try {
          const resp = await sendTask(agentId, messageId, payloadBody);
          taskId = resp.task_id;
        } catch (err) {
          warning = `派发失败（${(err && err.dataCode) || (err && err.message) || err}）——消息已记录，agent 恢复后可重发`;
        }
        sendJson(res, 200, { chat_id: chatId, task_id: taskId, warning });
        return;
      }
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        serveStatic(res, 'index.html');
        return;
      }
      if (req.method === 'GET' && (p === '/app.js' || p === '/style.css')) {
        serveStatic(res, p.slice(1));
        return;
      }
      sendJson(res, 404, { error: `not found: ${req.method} ${p}` });
    } catch (err) {
      sendJson(res, 502, { error: `router 不可达或请求失败: ${err && err.message ? err.message : err}` });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  process.stdout.write(`WEB_READY url=http://127.0.0.1:${port}\n`);

  return await new Promise((resolve) => {
    let sigint = 0;
    const onSigint = () => {
      sigint += 1;
      if (sigint >= 2) process.exit(130);
      server.close(() => {
        if (sender) sender.close();
        resolve(0);
      });
    };
    process.on('SIGINT', onSigint);
  });
}
