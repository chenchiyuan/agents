// src/status.js — `oamp status` 只读查询客户端（architecture §3.1 ST / §4.4 router.status / §7.3 / D8 / D17 + F05）
// 入口 = default 导出 async 函数（cli.js 调用约定：status 分支透传 argv.slice(1)，restArgs 一般为空；
//   多余位置参数按 O-2 惯例忽略，不报错不校验）。
// 流程：loadConfig 取 socketPath（§7.2，OAMP_SOCKET 可覆盖）→ net.connect UDS →
//   RpcPeer 发 router.status（无参请求，2s 上限，D17；不注册身份——§4.4 router.status 任意已连接者可用）→
//   渲染 padEnd 对齐表格到 stdout（列 instance_id/session_id/state/last_heartbeat，按 instance_id 排序，
//   last_heartbeat 外显 UTC ISO-8601，§5.7/D17）→ 返回 0。
// Router 不可达/查询失败 → 仅 stderr 明确报错（含 socket 路径 + router 未运行提示）+ 返回 1，
//   stdout 零输出（M-02/F05-3：不静默空结果冒充成功）。零节点 → 表头无数据行 + 返回 0（§7.3 合法空态）。
// 查询路径零副作用（F05-4）：只读、不写任何状态、结束关闭连接。
// 查询段另以 `queryNodes(config)` 导出（§12.2 契约 4）：default 行为不变，`oamp cluster` 复用同一查询取拓扑。

import net from 'node:net';
import { loadConfig } from './config.js';
import { RpcPeer } from './rpc.js';

const REQUEST_TIMEOUT_MS = 2000; // D17：status 查询请求响应上限 2s
const CONNECT_TIMEOUT_MS = 2000; // 连接防悬挂定时器（node-client.js DEFAULT_CONNECT_TIMEOUT_MS 同值先例）

const COLUMNS = [
  { key: 'instance_id', header: 'instance_id' },
  { key: 'session_id', header: 'session_id' },
  { key: 'state', header: 'state' },
  { key: 'last_heartbeat', header: 'last_heartbeat' },
];

/** 外显时间戳：epoch ms → UTC ISO-8601（毫秒、Z 后缀，§5.7/D17）。 */
function toIso(ms) {
  return new Date(ms).toISOString();
}

function cellOf(node, col) {
  if (col.key === 'last_heartbeat') {
    return toIso(node.last_heartbeat);
  }
  return String(node[col.key]);
}

/** 渲染对齐表格（padEnd，零依赖，§7.3）：表头 + 按 instance_id 排序的数据行。 */
export function renderTable(nodes) {
  const rows = [...nodes].sort((a, b) => (a.instance_id < b.instance_id ? -1 : a.instance_id > b.instance_id ? 1 : 0));
  const widths = COLUMNS.map((col) =>
    Math.max(col.header.length, ...rows.map((node) => cellOf(node, col).length)),
  );
  const lineOf = (cells) =>
    cells.map((cell, i) => (i < cells.length - 1 ? cell.padEnd(widths[i]) : cell)).join('  ');
  const lines = [lineOf(COLUMNS.map((col) => col.header))];
  for (const node of rows) {
    lines.push(lineOf(COLUMNS.map((col) => cellOf(node, col))));
  }
  return lines.join('\n');
}

/** 建立 UDS 连接（成功 resolve socket；失败/超时 reject）。 */
function connectSocket(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`connect timeout: ${socketPath}`));
    }, CONNECT_TIMEOUT_MS);
    socket.once('connect', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 查询 Router 拓扑（§12.2 契约 4）：config = src/config.js 的 loadConfig() 返回值（消费 socketPath）。
 * 成功 → nodes[]；失败 → 抛出与既有 stderr 文案同源的 Error（调用方据此打印/收口）。
 */
export async function queryNodes(config) {
  const socketPath = config.socketPath;

  let socket;
  try {
    socket = await connectSocket(socketPath);
  } catch {
    throw new Error(
      `无法连接 oamp router（socket=${socketPath}；router 未运行？先执行 oamp router start）`,
    );
  }

  const peer = new RpcPeer(socket, { idPrefix: 'status' });
  let result;
  try {
    result = await peer.request('router.status', {}, { timeoutMs: REQUEST_TIMEOUT_MS });
  } catch (err) {
    peer.close();
    throw new Error(
      `查询被拒（${err && err.dataCode ? err.dataCode : 'query-failed'}）: ${err && err.message ? err.message : err}`,
    );
  }
  peer.close();

  return result && Array.isArray(result.nodes) ? result.nodes : [];
}

export default async function status(restArgs) {
  // restArgs 一般为空（cli status 分支透传 argv.slice(1)）；多余参数按 O-2 惯例忽略。
  void restArgs;

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp: status 失败: ${err.message}\n`);
    return 1;
  }

  let nodes;
  try {
    nodes = await queryNodes(config);
  } catch (err) {
    process.stderr.write(`oamp: status 失败: ${err.message}\n`);
    return 1;
  }

  process.stdout.write(`${renderTable(nodes)}\n`);
  return 0;
}
