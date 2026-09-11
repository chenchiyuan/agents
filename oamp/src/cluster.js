// src/cluster.js — `oamp cluster up|down|status` 集群入口（architecture §5.2~§5.5 / §12.2 契约 3、4）
// 入口 = default 导出 async 函数（cli.js 调用约定：restArgs[0] = up|down|status，其后为 --config / --wait）。
// 职责边界：只做「一组进程」的生命周期编排（一个 tmux session：router / web / 各启用角色各占一窗口，
//   输出 tee 双通道落盘）。不读单个进程的配置（config.js 归各进程自身消费），不决定谁给谁派活。
// 角色清单不硬编码：角色集合、instance_id、cwd、模型/工具/permission 全部取自 loadClusterConfig。
// 测试注入点：OAMP_TMUX_BIN（tmux 可执行文件，缺省 tmux）、OAMP_CLUSTER_WAIT_MS（等待毫秒，0 = 不等）。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { loadClusterConfig } from './cluster-config.js';
import { queryNodes, renderTable } from './status.js';

// 路径基准 = 包根（按本模块位置推导，与 cwd 无关；与 src/config.js、src/role-binding.js 同口径）。
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(PKG_ROOT, 'bin', 'oamp.js');
const LOG_DIR = path.join(PKG_ROOT, '.runtime', 'cluster');

const TMUX_DEFAULT = 'tmux';
const ROUTER_WINDOW = 'router';
const WEB_WINDOW = 'web';
const UP_WAIT_DEFAULT_MS = 20000; // §5.2 up：就绪等待缺省
const DOWN_WAIT_DEFAULT_MS = 10000; // §5.5 down：等 pane 子树退出上限
const POLL_INTERVAL_MS = 50;
const CONNECT_TIMEOUT_MS = 300;
const ACTIONS = ['up', 'down', 'status'];
const USAGE = '用法: oamp cluster up|down|status [--config <path>] [--wait <ms>]';

function stdout(line) {
  process.stdout.write(`${line}\n`);
}

function stderr(line) {
  process.stderr.write(`${line}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 命令串里按需加单引号（常规字符集原样，保证 `tee -a <path>` 等片段肉眼可读）。 */
function shellQuote(value) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

function logPath(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

// —— 参数面（未知动作 / 未知参数 / 缺值 → 退出 2，与 cli.js usageError 同码） ——

function parseClusterArgs(restArgs) {
  const args = Array.isArray(restArgs) ? restArgs : [];
  const action = args[0];
  if (!ACTIONS.includes(action)) {
    return {
      ok: false,
      reason: action === undefined ? '缺少 cluster 子命令' : `未知的 cluster 子命令: ${action}`,
    };
  }
  const parsed = { ok: true, action, configPath: undefined, waitMs: undefined };
  for (let i = 1; i < args.length; i += 1) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag !== '--config' && flag !== '--wait') {
      return { ok: false, reason: `未知参数: ${flag}` };
    }
    if (value === undefined) {
      return { ok: false, reason: `${flag} 缺少取值` };
    }
    if (flag === '--config') {
      parsed.configPath = value;
    } else {
      if (parsed.action !== 'up') {
        return { ok: false, reason: '--wait 仅适用于 `oamp cluster up`' };
      }
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return { ok: false, reason: `--wait 需为非负整数（当前值 "${value}"）` };
      }
      parsed.waitMs = n;
    }
    i += 1;
  }
  return parsed;
}

/** 等待毫秒：env OAMP_CLUSTER_WAIT_MS 覆盖给定缺省（0 = 不等，供测试）。 */
function readWaitMs(env, fallback) {
  const raw = env.OAMP_CLUSTER_WAIT_MS;
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`OAMP_CLUSTER_WAIT_MS 需为非负整数（当前值 "${raw}"）`);
  }
  return n;
}

// —— tmux 调用面（全部经 spawnSync；fake tmux 由 OAMP_TMUX_BIN 注入） ——

function tmuxBin(env) {
  const override = env.OAMP_TMUX_BIN;
  return typeof override === 'string' && override !== '' ? override : TMUX_DEFAULT;
}

function runTmux(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8' });
  if (result.error) {
    return { status: null, stdout: '', stderr: String(result.error.message || result.error) };
  }
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** `tmux -V` 探活：缺失/失败 → 明确原因（调用方收口为 `oamp cluster:` 报错 + 退出 2）。 */
function probeTmux(bin) {
  const result = runTmux(bin, ['-V']);
  if (result.status === null) {
    return { ok: false, reason: result.stderr };
  }
  if (result.status !== 0) {
    return { ok: false, reason: result.stderr.trim() || `exit=${result.status}` };
  }
  return { ok: true, version: result.stdout.trim() };
}

function hasSession(bin, session) {
  return runTmux(bin, ['has-session', '-t', session]).status === 0;
}

function listWindowNames(bin, session) {
  return linesOf(runTmux(bin, ['list-windows', '-t', session, '-F', '#{window_name}']));
}

/** §5.2 status 契约的窗口行：`#{window_name} #{pane_current_path} #{pane_dead}`。 */
function listWindowRows(bin, session) {
  return linesOf(runTmux(bin, ['list-windows', '-t', session, '-F', '#{window_name} #{pane_current_path} #{pane_dead}']));
}

function linesOf(result) {
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

/** 本 session 的全部 pane pid（残留检查的根，§5.2 down ②）。 */
function listPanePids(bin, session) {
  const pids = [];
  for (const line of linesOf(runTmux(bin, ['list-panes', '-a', '-F', '#{session_name} #{pane_pid}']))) {
    const [name, pidText] = line.split(/\s+/);
    if (name !== session) continue;
    const pid = Number(pidText);
    if (Number.isInteger(pid) && pid > 1) pids.push(pid);
  }
  return pids;
}

/** 变更类 tmux 子命令：非 0 即响亮失败（不静默半启动）。 */
function tmuxOrFail(bin, args, label) {
  const result = runTmux(bin, args);
  if (result.status !== 0) {
    const why = result.status === null ? result.stderr : result.stderr.trim() || `exit=${result.status}`;
    stderr(`oamp cluster: tmux ${label} 失败: ${why}`);
    return false;
  }
  return true;
}

// —— 启动计划（§5.3：顺序 = router → web → 角色配置声明序） ——

function socketEnvPrefix(config) {
  return config.router.socket === null ? '' : `OAMP_SOCKET=${shellQuote(config.router.socket)} `;
}

/** 窗口命令 = `<env 前缀> node <BIN> <argv…> 2>&1 | tee -a <log>`（E7 双通道：窗口可见 + 落盘）。 */
function windowCommand(config, argv, name) {
  const cmd = [process.execPath, BIN, ...argv].map(shellQuote).join(' ');
  return `${socketEnvPrefix(config)}${cmd} 2>&1 | tee -a ${shellQuote(logPath(name))}`;
}

function planWindows(config) {
  const planned = [
    { name: ROUTER_WINDOW, cwd: config.root, argv: ['router', 'start'] },
    { name: WEB_WINDOW, cwd: config.root, argv: ['web', 'start', '--port', String(config.web.port)] },
  ];
  for (const [role, entry] of config.roles) {
    if (!entry.enabled) continue;
    const argv = [
      'agent', 'start', entry.instanceId,
      '--role', role,
      '--tools', entry.tools ? 'on' : 'off',
      '--permission', entry.permission,
    ];
    if (entry.model !== undefined) {
      argv.push('--model', entry.model);
    }
    planned.push({ name: entry.instanceId, cwd: entry.cwd, argv });
  }
  return planned.map((win) => ({ ...win, command: windowCommand(config, win.argv, win.name) }));
}

/** §5.4：先把目录内既有 `*.log` 逐个清空，再为本次预期日志补齐空文件。 */
function prepareLogs(names) {
  mkdirSync(LOG_DIR, { recursive: true });
  for (const entry of readdirSync(LOG_DIR)) {
    if (!entry.endsWith('.log')) continue;
    const full = path.join(LOG_DIR, entry);
    if (statSync(full).isFile()) {
      writeFileSync(full, '');
    }
  }
  for (const name of names) {
    const full = logPath(name);
    if (!existsSync(full)) {
      writeFileSync(full, '');
    }
  }
}

function logFiles() {
  if (!existsSync(LOG_DIR)) {
    return [];
  }
  return readdirSync(LOG_DIR)
    .filter((entry) => entry.endsWith('.log'))
    .sort()
    .map((entry) => ({ name: entry, size: statSync(path.join(LOG_DIR, entry)).size }));
}

// —— 就绪等待（§5.2 up ⑤⑦：Router socket 可连 → 全部 enabled 实例 online） ——

function canConnect(socketPath) {
  return new Promise((resolve) => {
    const socket = net.connect(socketPath);
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), CONNECT_TIMEOUT_MS);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function waitForRouter(socketPath, deadline) {
  for (;;) {
    if (await canConnect(socketPath)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }
}

async function waitForOnline(runtimeConfig, instanceIds, deadline) {
  let nodes = [];
  for (;;) {
    try {
      nodes = await queryNodes(runtimeConfig);
      const online = new Set(nodes.filter((node) => node.state === 'online').map((node) => node.instance_id));
      if (instanceIds.every((id) => online.has(id))) {
        return { nodes, missing: [] };
      }
    } catch {
      // Router 仍在建连/启动窗口内：继续轮询到 deadline（失败面由 missing 列表如实呈现）
    }
    if (Date.now() >= deadline) {
      const online = new Set(nodes.filter((node) => node.state === 'online').map((node) => node.instance_id));
      return { nodes, missing: instanceIds.filter((id) => !online.has(id)) };
    }
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }
}

// —— down 的残留检查（§5.5：以 pane pid 为根展开子树；僵尸不计存活） ——

function processTable() {
  const result = spawnSync('ps', ['-axo', 'pid=,ppid=,stat='], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    return null;
  }
  const parents = new Map();
  const states = new Map();
  for (const line of String(result.stdout).split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);
    if (!match) continue;
    const pid = Number(match[1]);
    parents.set(pid, Number(match[2]));
    states.set(pid, match[3]);
  }
  return { parents, states };
}

/** 以 rootPids 为根展开进程子树，返回仍存活的 pid；ps 不可用 → null（跳过检查，调用方明确告警）。 */
function aliveSubtree(rootPids) {
  const table = processTable();
  if (!table) return null;
  const children = new Map();
  for (const [pid, ppid] of table.parents) {
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const alive = [];
  const seen = new Set();
  const stack = [...rootPids];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    const stat = table.states.get(pid);
    if (stat !== undefined && !stat.startsWith('Z')) alive.push(pid);
    for (const child of children.get(pid) || []) stack.push(child);
  }
  return alive;
}

async function waitForSubtreeExit(rootPids, waitMs) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const alive = aliveSubtree(rootPids);
    if (alive === null || alive.length === 0) return;
    if (Date.now() >= deadline) return;
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }
}

// —— 三动作 ——

async function up(parsed, env) {
  let config;
  try {
    config = loadClusterConfig({ path: parsed.configPath, env });
  } catch (err) {
    stderr(`oamp cluster: 配置错误: ${err.message}`);
    return 2;
  }

  const bin = tmuxBin(env);
  const probe = probeTmux(bin);
  if (!probe.ok) {
    stderr(`oamp cluster: tmux 探活失败（bin=${bin}）：${probe.reason}`);
    return 2;
  }

  let runtimeConfig;
  try {
    runtimeConfig = loadConfig(env);
  } catch (err) {
    stderr(`oamp cluster: ${err.message}`);
    return 2;
  }

  let waitMs;
  try {
    waitMs = parsed.waitMs ?? readWaitMs(env, UP_WAIT_DEFAULT_MS);
  } catch (err) {
    stderr(`oamp cluster: ${err.message}`);
    return 2;
  }

  const session = config.session;
  if (hasSession(bin, session)) {
    // §5.5：幂等——不启动、不修改、不 kill（重建只能走 down）。
    const count = listWindowNames(bin, session).length;
    stdout(`集群已在运行（session=${session}，${count} 窗口）`);
    stdout(`tmux attach -t ${session}`);
    stdout('如需重建请先 oamp cluster down');
    return 0;
  }

  const windows = planWindows(config);
  prepareLogs(windows.map((win) => win.name));

  const [routerWindow, ...roleWindows] = windows;
  if (!tmuxOrFail(bin, ['new-session', '-d', '-s', session, '-n', routerWindow.name, '-c', routerWindow.cwd, routerWindow.command], 'new-session')) {
    return 1;
  }
  if (!tmuxOrFail(bin, ['set-option', '-t', session, 'remain-on-exit', 'on'], 'set-option remain-on-exit')) {
    return 1;
  }
  if (!tmuxOrFail(bin, ['set-environment', '-t', session, 'OAMP_ROLE_ROOT', config.root], 'set-environment OAMP_ROLE_ROOT')) {
    return 1;
  }

  const socketPath = config.router.socket ?? runtimeConfig.socketPath;
  const deadline = Date.now() + waitMs; // 同一 --wait 预算：Router 就绪 + 实例 online 共享
  let nodes = [];

  if (waitMs > 0 && !(await waitForRouter(socketPath, deadline))) {
    stderr(
      `oamp cluster: Router 未就绪（socket=${socketPath}，等待 ${waitMs}ms）——查看 ${ROUTER_WINDOW} 窗口或日志 ${logPath(ROUTER_WINDOW)}`,
    );
    stderr('oamp cluster: 保留现场（未自动回滚）；收口请执行 oamp cluster down');
    return 1;
  }

  for (const win of roleWindows) {
    if (!tmuxOrFail(bin, ['new-window', '-t', session, '-n', win.name, '-c', win.cwd, win.command], `new-window ${win.name}`)) {
      return 1;
    }
  }

  if (waitMs > 0) {
    const instanceIds = [...config.roles.values()]
      .filter((entry) => entry.enabled)
      .map((entry) => entry.instanceId);
    const result = await waitForOnline(runtimeConfig, instanceIds, deadline);
    nodes = result.nodes;
    if (result.missing.length > 0) {
      stderr(`oamp cluster: 等待超时（${waitMs}ms）：以下实例未 online: ${result.missing.join(' ')}`);
      stderr(`oamp cluster: 保留现场（未自动回滚）；逐个查看窗口或日志目录 ${LOG_DIR}，收口请执行 oamp cluster down`);
      return 1;
    }
  }

  stdout(`集群已启动（session=${session}，${windows.length} 窗口）`);
  stdout(`tmux attach -t ${session}`);
  stdout(`日志目录: ${LOG_DIR}`);
  if (waitMs === 0) {
    stdout('（--wait 0：未等待就绪，跳过拓扑表）');
  } else {
    for (const line of renderTable(nodes).split('\n')) stdout(line);
  }
  return 0;
}

async function down(parsed, env) {
  let config;
  try {
    config = loadClusterConfig({ path: parsed.configPath, env });
  } catch (err) {
    stderr(`oamp cluster: 配置错误: ${err.message}`);
    return 2;
  }

  const bin = tmuxBin(env);
  const probe = probeTmux(bin);
  if (!probe.ok) {
    stderr(`oamp cluster: tmux 探活失败（bin=${bin}）：${probe.reason}`);
    return 2;
  }

  let waitMs;
  try {
    waitMs = readWaitMs(env, DOWN_WAIT_DEFAULT_MS);
  } catch (err) {
    stderr(`oamp cluster: ${err.message}`);
    return 2;
  }

  const session = config.session;
  if (!hasSession(bin, session)) {
    stdout(`集群未在运行（session=${session}）`);
    return 0;
  }

  const windowNames = listWindowNames(bin, session);
  const rootPids = listPanePids(bin, session);

  // §5.5：先 C-c（SIGINT）——Router 打 ROUTER_STOPPING 并 unlink socket、agent 注销、web 走既有 SIGINT 路径。
  for (const name of windowNames) {
    runTmux(bin, ['send-keys', '-t', `${session}:${name}`, 'C-c']);
  }

  await waitForSubtreeExit(rootPids, waitMs);

  if (!tmuxOrFail(bin, ['kill-session', '-t', session], 'kill-session')) {
    return 1;
  }

  const residual = aliveSubtree(rootPids);
  if (residual === null) {
    stderr('oamp cluster: 无法执行 ps，跳过残留检查（session 已 kill）');
    stdout(`已收口（session=${session}，${windowNames.length} 窗口）`);
    return 0;
  }
  if (residual.length > 0) {
    for (const pid of residual) {
      if (pid <= 1 || pid === process.pid) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // 已在检查与 kill 之间退出：忽略
      }
    }
    stderr(`oamp cluster: down 残留进程已 SIGKILL：${residual.join(' ')}（查看 日志 ${LOG_DIR}）`);
    return 1;
  }

  stdout(`已收口（session=${session}，${windowNames.length} 窗口）`);
  return 0;
}

async function statusAction(parsed, env) {
  let config;
  try {
    config = loadClusterConfig({ path: parsed.configPath, env });
  } catch (err) {
    stderr(`oamp cluster: 配置错误: ${err.message}`);
    return 2;
  }

  const bin = tmuxBin(env);
  const probe = probeTmux(bin);
  if (!probe.ok) {
    stderr(`oamp cluster: tmux 探活失败（bin=${bin}）：${probe.reason}`);
    return 2;
  }

  let runtimeConfig;
  try {
    runtimeConfig = loadConfig(env);
  } catch (err) {
    stderr(`oamp cluster: ${err.message}`);
    return 2;
  }

  const session = config.session;
  const running = hasSession(bin, session);
  stdout(`[集群] session=${session}  ${running ? '运行中' : '未运行'}`);

  const rows = running ? listWindowRows(bin, session) : [];
  stdout('[窗口]');
  if (!running) {
    stdout('  （session 未运行）');
  } else if (rows.length === 0) {
    stdout('  （无窗口）');
  } else {
    for (const row of rows) stdout(`  ${row}`);
  }

  let nodes = null;
  let routerError = null;
  try {
    nodes = await queryNodes(runtimeConfig);
  } catch (err) {
    routerError = err.message;
  }

  stdout('[Router 拓扑]');
  if (routerError !== null) {
    stderr(`oamp cluster: Router 不可达（socket=${runtimeConfig.socketPath}）：${routerError}`);
    stdout('  （不可达，未取到拓扑）');
  } else {
    for (const line of renderTable(nodes).split('\n')) stdout(`  ${line}`);
  }

  stdout('[日志]');
  stdout(`  目录: ${LOG_DIR}`);
  const files = logFiles();
  if (files.length === 0) {
    stdout('  （暂无日志文件）');
  } else {
    for (const file of files) stdout(`  ${file.name}  ${file.size} B`);
  }

  stdout('[角色实例]');
  const nodeById = new Map((nodes ?? []).map((node) => [node.instance_id, node]));
  for (const [role, entry] of config.roles) {
    if (!entry.enabled) {
      stdout(`  ${entry.instanceId}  role=${role}  enabled=false（未起窗口）`);
      continue;
    }
    const row = rows.find((line) => line.split(' ')[0] === entry.instanceId);
    const dead = row === undefined ? null : row.split(' ').at(-1);
    const node = nodeById.get(entry.instanceId);
    stdout(
      `  ${entry.instanceId}  role=${role}  window=${row === undefined ? 'no' : 'yes'}`
      + `  alive=${dead === '0' ? 'yes' : 'no'}  state=${node === undefined ? 'unknown' : node.state}`
      + `  cwd=${entry.cwd}  log=${logPath(entry.instanceId)}`,
    );
  }

  return routerError === null ? 0 : 1;
}

export default async function cluster(restArgs) {
  const parsed = parseClusterArgs(restArgs);
  if (!parsed.ok) {
    stderr(`oamp cluster: ${parsed.reason}\n${USAGE}`);
    return 2;
  }
  const env = process.env;
  if (parsed.action === 'up') return up(parsed, env);
  if (parsed.action === 'down') return down(parsed, env);
  return statusAction(parsed, env);
}
