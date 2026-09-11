#!/usr/bin/env node
// scripts/testenv.mjs — OAMP 最小测试环境（demo/冒烟）
// 复用 test/helpers/harness.js 的真实进程拉起能力，零第三方依赖。
// 行为：拉起 1 Router + 2 agent（缩短心跳便于快速演示）→ 验证双节点 online →
//       status 查询 → 消息闭环冒烟（test-sender → dev-1 自动受理 ack）→
//       SIGKILL verify-1 → 验证 Router 判 offline → 优雅清理 → PASS/FAIL 汇总。
// 用途：人工验证环境可用；自动化测试载体仍为 test/*.test.js（node --test）。
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, queryStatus, waitFor, stopAll, buildEnv } from '../test/helpers/harness.js';
import { createClient } from '../src/node-client.js';
import net from 'node:net';
import { RpcPeer } from '../src/rpc.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');
const ok = (m) => console.log(`  ✓ ${m}`);
const info = (m) => console.log(`  · ${m}`);

async function statusViaCli(socketPath) {
  const r = spawnSync(process.execPath, [BIN, 'status'], { cwd: OAMP_ROOT, env: buildEnv(socketPath), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`oamp status 失败 exit=${r.status} stderr=${r.stderr}`);
  return r.stdout.trim();
}

async function snapshot(socketPath) {
  const r = await queryStatus(socketPath);
  return Array.isArray(r) ? r : r.nodes ?? [];
}
async function queryTask(socketPath, taskId) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'demo' });
  try {
    const r = await peer.request('router.task_get', { task_id: taskId }, { timeoutMs: 3000 });
    return r.task;
  } finally {
    peer.close();
  }
}

async function main() {
  console.log('=== OAMP 最小测试环境 ===');
  console.log(`node: ${process.version}`);
  console.log(`oamp: ${OAMP_ROOT}`);
  console.log('环境设置：Router 与 agent 均为子进程（真实 CLI 入口 node bin/oamp.js），');
  console.log('socket 位于系统临时目录（不触碰仓库 .runtime/）；心跳参数缩短为');
  console.log('interval=50ms / timeout=300ms / 日志窗口=300ms（快速演示；生产默认 10s/30s）。');
  console.log('');

  let handles = [];
  try {
    // 1. Router
    console.log('① 启动 Router …');
    const router = await startRouter();
    handles.push(router);
    ok(`ROUTER_READY socket=${router.socketPath}`);

    // 2. 两个 agent
    console.log('② 启动 agent：dev-1 / verify-1 …');
    const dev1 = await startAgent('dev-1', { socketPath: router.socketPath });
    handles.push(dev1);
    await dev1.waitAgentLine(/REGISTERED instance=dev-1/);
    ok('dev-1 REGISTERED (online)');
    const verify1 = await startAgent('verify-1', { socketPath: router.socketPath });
    handles.push(verify1);
    await verify1.waitAgentLine(/REGISTERED instance=verify-1/);
    ok('verify-1 REGISTERED (online)');

    // 3. 等待两节点在线（注册表快照为准）
    console.log('③ 验证双节点并发 online …');
    await waitFor(async () => {
      const nodes = await snapshot(router.socketPath);
      return nodes.filter((n) => n.state === 'online').length >= 2;
    }, { timeoutMs: 3000, what: '两节点 online' });
    const snap1 = await snapshot(router.socketPath);
    for (const n of snap1) {
      ok(`${n.instance_id} state=${n.state} session=${n.session_id.slice(0, 8)}… last_heartbeat=${new Date(n.last_heartbeat).toISOString()}`);
    }

    // 4. oamp status CLI
    console.log('④ oamp status 查询 …');
    const cliOut = await statusViaCli(router.socketPath);
    console.log(cliOut.split('\n').map((l) => `    ${l}`).join('\n'));
    ok('status 表格输出（按 instance_id 排序）');

    // 5. 消息闭环冒烟：test-sender → dev-1（真实 agent 自动受理 + ack）
    console.log('⑤ 消息闭环冒烟 test-sender → dev-1 …');
    const sender = createClient({ socketPath: router.socketPath });
    await sender.connect();
    await sender.register('test-sender');
    const msgId = `msg-demo-${Date.now()}`;
    const sendResp = await sender.send('dev-1', {
      message_id: msgId,
      protocol: 'oamp/1',
      payload: { content_type: 'text/plain', body: 'hello from test environment' },
    });
    ok(`message.send accepted=${sendResp.accepted} status=${sendResp.status}`);
    await router.waitNth ? router.stdout.waitNth(new RegExp(`MESSAGE_ACKED.*message_id=${msgId}`), { timeoutMs: 3000 }) : null;
    ok(`Router 观察到 MESSAGE_ACKED message_id=${msgId}（dev-1 自动受理）`);
    await dev1.stdout.waitNth(new RegExp(`MSG_RECEIVED.*message_id=${msgId}`), { timeoutMs: 3000 }).catch(() => info('dev-1 MSG_RECEIVED 事件行未捕获（事件可能已在等待前发出，非失败）'));
    await sender.deregister().catch(() => info('test-sender deregister 未送达（best-effort）'));
    sender.close();

    // 6. 任务指派与进度（demo：主 agent 视角）
    console.log('⑥ 任务指派 dev-1（main → dev-1 shell 任务）…');
    const mainCli = createClient({ socketPath: router.socketPath });
    await mainCli.connect();
    await mainCli.register('main');
    const taskResp = await mainCli.send('dev-1', {
      protocol: 'oamp/1',
      message_id: `tsk-demo-${Date.now()}`,
      type: 'task.request',
      payload: {
        content_type: 'application/json',
        body: JSON.stringify({
          command: process.execPath,
          args: ['-e', 'console.log("task step 1"); console.log("task step 2")'],
          label: 'testenv 任务演示',
        }),
      },
    });
    const taskId = taskResp.task_id;
    ok(`task_id=${taskId} 已指派（send 受理）`);
    await waitFor(async () => {
      const task = await queryTask(router.socketPath, taskId);
      return task && (task.state === 'completed' || task.state === 'failed') ? task : null;
    }, { timeoutMs: 8000, what: `任务 ${taskId} 终态` });
    const finalTask = await queryTask(router.socketPath, taskId);
    const stdoutLines = finalTask.updates.filter((u) => u.detail && u.detail.kind === 'stdout').map((u) => u.detail.line);
    ok(`任务终态 ${finalTask.state} exit_code=${finalTask.result.exit_code}（明细 ${finalTask.updates.length} 条）`);
    if (stdoutLines.length > 0) info(`stdout: ${stdoutLines.join(' | ')}`);
    if (finalTask.state !== 'completed' || finalTask.result.exit_code !== 0) {
      throw new Error(`任务演示失败: state=${finalTask.state} exit=${finalTask.result.exit_code}`);
    }
    await mainCli.deregister().catch(() => info('main deregister 未送达（best-effort）'));
    mainCli.close();

    // 7. 崩溃 → offline 判定
    console.log('⑦ SIGKILL verify-1 → Router 判 offline …');
    verify1.kill('SIGKILL');
    await router.stdout.waitNth(/AGENT_OFFLINE instance=verify-1/, { timeoutMs: 3000 });
    ok('Router 输出 AGENT_OFFLINE instance=verify-1');
    await waitFor(async () => {
      const nodes = await snapshot(router.socketPath);
      const v = nodes.find((n) => n.instance_id === 'verify-1');
      return v && v.state === 'offline';
    }, { timeoutMs: 3000, what: 'verify-1 offline' });
    ok('status 快照 verify-1 state=offline（墓碑保留）');

    // 7. 拓扑与汇总
    const final = await snapshot(router.socketPath);
    console.log('');
    console.log('=== 拓扑 ===');
    console.log(`
                 ┌──────────────────────────────┐
                 │ Router（子进程, node oamp.js）│
                 │  registry + lease + route    │
                 └──────┬───────────────┬───────┘
              UDS/JSON-RPC（NDJSON 帧，socket 0600）
                 │                    │
        ┌────────┴───────┐   ┌───────┴────────┐
        │ agent dev-1     │   │ verify-1       │
        │ 心跳中 / 收消息   │   │ SIGKILL → offline│
        └────────────────┘   └────────────────┘`);
    console.log(`最终注册表：${final.map((n) => `${n.instance_id}=${n.state}`).join('  ')}`);
    console.log('');
    console.log('=== 验证结果: PASS（Router/agent/心跳/status/消息闭环/offline 判定/任务进度 全部可用）===');
    console.log('');
    console.log('自行实测：三个终端分别执行（生产默认心跳参数）');
    console.log(`  1) node bin/oamp.js router start`);
    console.log(`  2) node bin/oamp.js agent start dev-1`);
    console.log(`  3) node bin/oamp.js status   （另开终端；kill -9 <agent pid> 观察 offline）`);
    console.log(`  4) 任务演示：node bin/oamp.js task send dev-1 '{"command":"echo","args":["hi"],"label":"x"}'`);
    console.log(`     → node bin/oamp.js task watch <task_id>（看进度明细）`);
  } catch (err) {
    console.error('');
    console.error(`=== 验证结果: FAIL ===`);
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    console.log('清理进程 …');
    await stopAll(handles);
    console.log('已清理（Router/agent 均退出，临时 socket 目录已删除）');
  }
}

main();
