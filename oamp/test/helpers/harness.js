// test/helpers/harness.js — 进程级测试辅助（architecture §10.2）
// 每测试独立临时 socket（fs.mkdtemp(os.tmpdir())）+ 缩短 env（interval/timeout/窗口）→
// 子进程 node bin/oamp.js 拉起 Router/agent → 等 ROUTER_READY 行 → 返回句柄；
// teardown：SIGINT → 限时等退出 → 超时 kill 兜底。
// 测试绝不触碰仓库内 .runtime/（socket 全在系统临时目录）。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { RpcPeer } from '../../src/rpc.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');

// §7.2 测试时长策略：interval 30~100ms / timeout 200~400ms / 窗口 ~300ms（取区间内稳定值）
export const SHORT_ENV = {
  OAMP_HEARTBEAT_INTERVAL_MS: '50',
  OAMP_HEARTBEAT_TIMEOUT_MS: '300',
  OAMP_HB_LOG_WINDOW_MS: '300',
};

export function makeTempSocketDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-test-'));
}

export function buildEnv(socketPath, extra = {}) {
  return { ...process.env, OAMP_SOCKET: socketPath, ...SHORT_ENV, ...extra };
}

/** 轮询直到 pred 为真或超时（§10.2：不裸 sleep 关键路径）。pred 可同步可异步。 */
export async function waitFor(pred, { timeoutMs = 5000, intervalMs = 25, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await pred();
    if (v) return v;
    if (Date.now() >= deadline) throw new Error(`waitFor 超时（${timeoutMs}ms）: ${what}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function collectStream(stream) {
  const lines = [];
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      lines.push(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  });
  const matching = (re) => {
    const out = [];
    for (const l of lines) if (re.test(l)) out.push(l);
    return out;
  };
  // 支持两种调用：waitNth(re, opts) 或 waitNth(re, n, opts)
  function waitNth(re, nOrOpts, opts) {
    let n = 1;
    let options = opts;
    if (nOrOpts && typeof nOrOpts === 'object') {
      options = nOrOpts;
    } else if (typeof nOrOpts === 'number') {
      n = nOrOpts;
    }
    const { timeoutMs = 5000 } = options || {};
    return waitFor(() => {
      const ms = matching(re);
      return ms.length >= n ? ms[n - 1] : null;
    }, { timeoutMs, what: `第 ${n} 条匹配 ${re}` });
  }
  return {
    lines,
    text: () => lines.join('\n'),
    all: () => lines,
    matching,
    waitNth,
  };
}

/** 经 UDS 调 router.status 取 nodes 快照（本 PR 无 status.js CLI，测试进程内直连查询，§4.4）。 */
export async function queryStatus(socketPath) {
  const socket = net.connect(socketPath);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const peer = new RpcPeer(socket, { idPrefix: 'query' });
  try {
    const result = await peer.request('router.status', {}, { timeoutMs: 3000 });
    return result;
  } finally {
    peer.close();
  }
}

/**
 * 拉起 Router 子进程并等 ROUTER_READY 就绪行。
 * 返回句柄：{ child, socketPath, tmpDir, stdout, stderr, waitRouterLine(re, n?/opts?),
 *   stop(), kill(), cleanup() }
 */
export async function startRouter({ envExtra = {}, readyTimeoutMs = 5000 } = {}) {
  const tmpDir = makeTempSocketDir();
  const socketPath = path.join(tmpDir, 'router.sock');
  const env = buildEnv(socketPath, envExtra);
  const child = spawn(process.execPath, [BIN, 'router', 'start'], { cwd: OAMP_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = collectStream(child.stdout);
  const stderr = collectStream(child.stderr);
  let exitInfo = null;
  child.once('exit', (code, signal) => {
    exitInfo = { code, signal };
  });

  await stdout.waitNth(/ROUTER_READY socket=/, { timeoutMs: readyTimeoutMs });

  /** 优雅停止：SIGINT → 限时等退出 → 超时 kill 兜底。 */
  async function stop({ timeoutMs = 3000 } = {}) {
    if (exitInfo) return exitInfo;
    child.kill('SIGINT');
    try {
      await waitFor(() => exitInfo !== null, { timeoutMs, what: 'Router SIGINT 后退出' });
    } catch {
      child.kill('SIGKILL');
      await waitFor(() => exitInfo !== null, { timeoutMs: 2000, what: 'Router SIGKILL 后退出' });
    }
    return exitInfo;
  }

  return {
    child,
    socketPath,
    tmpDir,
    stdout,
    stderr,
    waitRouterLine: (re, nOrOpts, opts) => stdout.waitNth(re, nOrOpts, opts),
    getExitInfo: () => exitInfo,
    stop,
    kill: (signal = 'SIGKILL') => child.kill(signal),
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* 忽略 */
      }
    },
  };
}

/**
 * 拉起真实 agent 子进程（node bin/oamp.js agent start <id> + 缩短 env）。
 * 返回句柄：{ child, stdout, stderr, waitAgentLine(re, n?/opts?), stop(), kill() }
 */
export async function startAgent(instanceId, { socketPath, envExtra = {} } = {}) {
  const env = buildEnv(socketPath, envExtra);
  const child = spawn(process.execPath, [BIN, 'agent', 'start', instanceId], { cwd: OAMP_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = collectStream(child.stdout);
  const stderr = collectStream(child.stderr);
  let exitInfo = null;
  child.once('exit', (code, signal) => {
    exitInfo = { code, signal };
  });

  async function stop({ timeoutMs = 3000 } = {}) {
    if (exitInfo) return exitInfo;
    child.kill('SIGINT');
    try {
      await waitFor(() => exitInfo !== null, { timeoutMs, what: `agent ${instanceId} SIGINT 后退出` });
    } catch {
      child.kill('SIGKILL');
      await waitFor(() => exitInfo !== null, { timeoutMs: 2000, what: `agent ${instanceId} SIGKILL 后退出` });
    }
    return exitInfo;
  }

  return {
    child,
    stdout,
    stderr,
    waitAgentLine: (re, nOrOpts, opts) => stdout.waitNth(re, nOrOpts, opts),
    getExitInfo: () => exitInfo,
    stop,
    kill: (signal = 'SIGKILL') => child.kill(signal),
  };
}

/** 便捷清理：stop + 删临时目录。 */
export async function stopAll(handles) {
  for (const h of handles) {
    try {
      await h.stop();
    } catch {
      /* 忽略 */
    }
    if (h.cleanup) h.cleanup();
  }
}
