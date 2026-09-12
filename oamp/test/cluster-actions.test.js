// test/cluster-actions.test.js — F06 集群入口三动作（AR-13~AR-16 / §5.2~§5.5 / §5.6 集成层）
// 断言面：up 的 session/窗口名与数量、每窗 `-c <cwd>`、命令串（角色 flag + tee 日志）、日志 truncate 与
//   `.gitignore` 静态契约、缺省配置（仓库根 cluster.json）驱动、up 幂等、tmux 探活失败、就绪超时、
//   实例未 online 的现场保留、down 的 C-c → kill-session → 残留检查序列、status 分段输出与退出码。
// 边界（§5.6 / AR-20）：零真实 tmux 会话、零真实 omp、零网络——OAMP_TMUX_BIN 指向记录 argv 的 fake 脚本，
//   状态用 JSON 状态文件回放；唯一真实进程 = 用例内的 Router（UDS 本地 socket，供就绪/拓扑段取证）。
//   OAMP_CLUSTER_LOG_DIR 指向每用例独立临时目录（dir/cluster-logs），测试永不触碰仓库级 .runtime/cluster。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter } from './helpers/harness.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(OAMP_ROOT, 'bin', 'oamp.js');
const RUN_TIMEOUT_MS = 15000;

// fake tmux：argv 逐行落 JSON；行为由 $OAMP_FAKE_TMUX_STATE 回放（list-windows 的 -F 决定输出形态）。
const FAKE_TMUX = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const logPath = process.env.OAMP_FAKE_TMUX_LOG;
if (logPath) fs.appendFileSync(logPath, JSON.stringify(args) + '\\n');
const statePath = process.env.OAMP_FAKE_TMUX_STATE;
const state = statePath && fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const windows = state.windows || [];
const panes = state.panes || [];
const fmtIndex = args.indexOf('-F');
const fmt = fmtIndex >= 0 ? args[fmtIndex + 1] : '';
const out = (text) => process.stdout.write(text + '\\n');
switch (args[0]) {
  case '-V':
    out('tmux 3.4');
    break;
  case 'has-session':
    process.exit(state.hasSession ? 0 : 1);
    break;
  case 'list-windows':
    if (fmt.indexOf('pane_current_path') >= 0) windows.forEach((w) => out(w.name + ' ' + w.path + ' ' + w.dead));
    else windows.forEach((w) => out(w.name));
    break;
  case 'list-panes':
    panes.forEach((p) => out(p.session + ' ' + p.pid));
    break;
  default:
    break;
}
process.exit(0);
`;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oamp-cluster-'));
}

function writeFakeTmux(dir) {
  const file = path.join(dir, 'fake-tmux.cjs');
  fs.writeFileSync(file, FAKE_TMUX, { mode: 0o755 });
  return file;
}

function writeState(dir, state) {
  const file = path.join(dir, 'tmux-state.json');
  fs.writeFileSync(file, JSON.stringify(state));
  return file;
}

/** fixture：临时 root 内 cluster.json + roles/<role>/<role>.md（满足 pr-002 的启动前预检）。 */
function makeFixture({ session = 'test-cluster', roles = {} } = {}) {
  const root = makeTempDir();
  const config = { session, web: { port: 7788 }, router: { socket: null }, roles: {} };
  for (const [role, section] of Object.entries(roles)) {
    fs.mkdirSync(path.join(root, 'roles', role), { recursive: true });
    fs.writeFileSync(path.join(root, 'roles', role, `${role}.md`), `# ${role}\n`);
    const cwd = section.cwd === undefined ? '.' : section.cwd;
    fs.mkdirSync(path.resolve(root, cwd), { recursive: true });
    config.roles[role] = { ...section };
  }
  const configPath = path.join(root, 'cluster.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { root, configPath };
}

function clusterEnv({ logDir, tmuxBin, logPath, statePath, socketPath, waitMs }) {
  return {
    ...process.env,
    OAMP_CLUSTER_CONFIG: '', // 显式清空：避免外部 env 影响「缺省配置」用例
    OAMP_CLUSTER_LOG_DIR: logDir, // 日志导流到本用例临时目录：不触碰仓库级 .runtime/cluster
    OAMP_TMUX_BIN: tmuxBin,
    OAMP_FAKE_TMUX_LOG: logPath,
    OAMP_FAKE_TMUX_STATE: statePath,
    OAMP_SOCKET: socketPath,
    OAMP_CLUSTER_WAIT_MS: String(waitMs),
  };
}

function runCluster(args, env) {
  const result = spawnSync(process.execPath, [BIN, 'cluster', ...args], {
    cwd: OAMP_ROOT,
    env,
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
  });
  assert.equal(result.error, undefined, `进程挂起/启动失败（args=${JSON.stringify(args)}）: ${result.error && result.error.message}`);
  return result;
}

/** fake tmux 记录（`-V` 探活是每个动作的固定前奏，序列断言只看其后）。 */
function tmuxCalls(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line))
    .filter((call) => call[0] !== '-V');
}

function flagOf(call, flag) {
  const i = call.indexOf(flag);
  return i < 0 ? undefined : call[i + 1];
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 用例 teardown：日志目录在本用例临时目录内，直接整体删除（不触碰仓库级 .runtime/cluster）。 */
function cleanupTest(t, dir) {
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('up：session/窗口名与数量、每窗 -c、命令串、日志 truncate 与 .gitignore 契约（F06 验收 1/2/6）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const statePath = writeState(dir, { hasSession: false, windows: [] });
  const logPath = path.join(dir, 'tmux.log');
  const { root, configPath } = makeFixture({
    roles: {
      dev: { cwd: 'work/dev' },
      planner: {},
      verifier: { enabled: false },
      demand: { cwd: 'work/demand', tools: false, permission: 'deny', model: 'openai/gpt-5.6-luna' },
    },
  });
  const devCwd = path.join(root, 'work', 'dev');
  const demandCwd = path.join(root, 'work', 'demand');

  // 哨兵：放在 up 之前，用于验证「目录内既有 *.log 被逐个 truncate」。
  fs.mkdirSync(logDir, { recursive: true });
  const sentinel = path.join(logDir, 'stale-sentinel.log');
  fs.writeFileSync(sentinel, 'previous run\n');

  const result = runCluster(
    ['up', '--config', configPath, '--wait', '0'],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /集群已启动（session=test-cluster，5 窗口）/); // router + web + dev/planner/demand
  assert.match(result.stdout, /tmux attach -t test-cluster/);
  assert.match(result.stdout, new RegExp(`日志目录: ${escapeRe(logDir)}`));

  const calls = tmuxCalls(logPath);
  assert.deepEqual(calls[0], ['has-session', '-t', 'test-cluster']);

  const newSession = calls[1];
  assert.deepEqual(newSession.slice(0, 8), ['new-session', '-d', '-s', 'test-cluster', '-n', 'router', '-c', root]);
  assert.ok(newSession[8].includes('router start'), newSession[8]);
  assert.ok(newSession[8].endsWith(`2>&1 | tee -a ${path.join(logDir, 'router.log')}`), newSession[8]);

  assert.deepEqual(calls[2], ['set-option', '-t', 'test-cluster', 'remain-on-exit', 'on']);
  assert.deepEqual(calls[3], ['set-environment', '-t', 'test-cluster', 'OAMP_ROLE_ROOT', root]);

  const newWindows = calls.filter((call) => call[0] === 'new-window');
  assert.deepEqual(
    newWindows.map((call) => flagOf(call, '-n')),
    ['web', 'pb-dev', 'pb-planner', 'pb-demand'],
    '窗口顺序 = router → web → 角色配置声明序；enabled:false 的角色零窗口',
  );
  assert.equal(flagOf(newWindows[0], '-c'), root, 'web 窗口 cwd = root');
  assert.equal(flagOf(newWindows[1], '-c'), devCwd, '角色窗口 cwd = 配置 cwd 绝对路径');
  assert.equal(flagOf(newWindows[3], '-c'), demandCwd);

  const webCmd = newWindows[0].at(-1);
  assert.ok(webCmd.includes('web start --port 7788'), webCmd);
  assert.ok(webCmd.endsWith(`2>&1 | tee -a ${path.join(logDir, 'web.log')}`), webCmd);

  const devCmd = newWindows[1].at(-1);
  assert.ok(devCmd.includes('agent start pb-dev --role dev --tools on --permission allow'), devCmd);
  assert.ok(devCmd.endsWith(`2>&1 | tee -a ${path.join(logDir, 'pb-dev.log')}`), devCmd);

  const demandCmd = newWindows[3].at(-1);
  assert.ok(demandCmd.includes('agent start pb-demand --role demand --tools off --permission deny --model openai/gpt-5.6-luna'), demandCmd);
  assert.ok(!newWindows.some((call) => flagOf(call, '-n') === 'pb-verifier'), 'enabled:false 的角色不起窗口');

  assert.equal(fs.readFileSync(sentinel, 'utf8'), '', 'up 开始时逐个 truncate 既有 *.log');
  for (const name of ['router', 'web', 'pb-dev', 'pb-planner', 'pb-demand']) {
    assert.ok(fs.existsSync(path.join(logDir, `${name}.log`)), `${name}.log 应存在`);
  }
  assert.ok(!fs.existsSync(path.join(logDir, 'pb-verifier.log')), '未启用角色无日志');

  const gitignore = fs.readFileSync(path.join(OAMP_ROOT, '.gitignore'), 'utf8');
  assert.ok(
    gitignore.split('\n').some((line) => line.trim() === '.runtime/'),
    '日志产物应被仓库 .gitignore 的 .runtime/ 覆盖（静态契约，不依赖运行时 .git）',
  );
});

test('up：省略 --config ⇒ 缺省仓库根 cluster.json 驱动（12 窗口 = router + web + 10 个 pb-*）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, { hasSession: false, windows: [] });

  const result = runCluster(
    ['up', '--wait', '0'],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /集群已启动（session=oamp-cluster，12 窗口）/);
  const names = tmuxCalls(logPath).filter((call) => call[0] === 'new-window').map((call) => flagOf(call, '-n'));
  assert.equal(names.length, 11, `应为 web + 10 个角色窗口，实际 ${names.length}`);
  assert.equal(names[0], 'web');
  assert.ok(names.slice(1).every((name) => name.startsWith('pb-')), names.join(','));
  assert.equal(new Set(names).size, names.length, '窗口名（= instance_id）不得重复');
});

test('up：session 已存在 → 幂等（零 new-session/new-window/kill）+ attach 提示 + 退出 0（AR-16）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, {
    hasSession: true,
    windows: [
      { name: 'router', path: '/repo', dead: '0' },
      { name: 'web', path: '/repo', dead: '0' },
      { name: 'pb-dev', path: '/repo', dead: '0' },
    ],
  });

  const result = runCluster(
    ['up', '--config', configPath, '--wait', '0'],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /集群已在运行（session=test-cluster，3 窗口）/);
  assert.match(result.stdout, /tmux attach -t test-cluster/);
  assert.match(result.stdout, /如需重建请先 oamp cluster down/);

  assert.deepEqual(tmuxCalls(logPath).map((call) => call[0]), ['has-session', 'list-windows'], '幂等命中时不得发任何变更类子命令');
});

test('up：tmux 探活失败（OAMP_TMUX_BIN 不存在）→ 报错 + 退出 2 + 零 session（R-9 / 验收 8）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const logPath = path.join(dir, 'tmux.log');
  const { configPath } = makeFixture({ roles: { dev: {} } });

  const result = runCluster(
    ['up', '--config', configPath, '--wait', '0'],
    clusterEnv({
      logDir,
      tmuxBin: path.join(dir, 'no-such-tmux'),
      logPath,
      statePath: writeState(dir, { hasSession: false, windows: [] }),
      socketPath: path.join(dir, 'unused.sock'),
      waitMs: 0,
    }),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /oamp cluster: tmux 探活失败/);
  assert.equal(tmuxCalls(logPath).length, 0, '探活失败不得执行任何 tmux 子命令');
});

test('up：Router 未就绪 → 退出 1 + 明确错误 + 不建 web/角色窗口（§5.2 up ⑤）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { root, configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, { hasSession: false, windows: [] });
  const socketPath = path.join(dir, 'never-up.sock');

  const started = Date.now();
  const result = runCluster(
    ['up', '--config', configPath, '--wait', '300'],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath, waitMs: 300 }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Router 未就绪/);
  assert.ok(result.stderr.includes(socketPath), result.stderr);
  assert.match(result.stderr, /保留现场/);
  assert.ok(Date.now() - started >= 250, '应实际等待到 --wait 预算耗尽');

  const calls = tmuxCalls(logPath);
  assert.deepEqual(calls.map((call) => call[0]), ['has-session', 'new-session', 'set-option', 'set-environment']);
  assert.equal(flagOf(calls[1], '-c'), root);
});

test('up：有实例未 online → 退出 1 + 列出缺失实例 + 保留现场（AR-16）', async (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, { hasSession: false, windows: [] });
  const router = await startRouter({});
  t.after(async () => {
    await router.stop();
    router.cleanup();
  });

  const result = runCluster(
    ['up', '--config', configPath, '--wait', '1200'],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: router.socketPath, waitMs: 1200 }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未 online: pb-dev/);
  const verbs = tmuxCalls(logPath).map((call) => call[0]);
  assert.ok(verbs.includes('new-window'), '失败后保留现场（窗口已建，不自动回滚）');
  assert.ok(!verbs.includes('kill-session'), 'up 失败不 kill 现场');
});

test('down：C-c（SIGINT）→ 等子树 → kill-session → 残留检查，干净收口退出 0（§5.5）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { configPath } = makeFixture({ roles: { dev: {} } });
  const deadPid = spawnSync(process.execPath, ['-e', '']).pid; // 已退出并被回收 ⇒ 非残留
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, {
    hasSession: true,
    windows: [
      { name: 'router', path: '/repo', dead: '0' },
      { name: 'web', path: '/repo', dead: '0' },
      { name: 'pb-dev', path: '/repo', dead: '0' },
    ],
    panes: [
      { session: 'test-cluster', pid: deadPid },
      { session: 'other-cluster', pid: 1 },
    ],
  });

  const result = runCluster(
    ['down', '--config', configPath],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /已收口（session=test-cluster，3 窗口）/);

  const calls = tmuxCalls(logPath);
  const verbs = calls.map((call) => call[0]);
  assert.equal(verbs[0], 'has-session');
  assert.deepEqual(calls[1], ['list-windows', '-t', 'test-cluster', '-F', '#{window_name}']);
  assert.deepEqual(
    calls[2],
    ['list-panes', '-a', '-F', '#{session_name} #{pane_pid}'],
    'pane pid 采集覆盖全部 session 后按本 session 过滤（不误伤用户另起的 oamp 进程）',
  );

  const sendKeys = calls.filter((call) => call[0] === 'send-keys');
  assert.deepEqual(sendKeys.map((call) => call[2]), ['test-cluster:router', 'test-cluster:web', 'test-cluster:pb-dev']);
  for (const call of sendKeys) {
    assert.equal(call[3], 'C-c', '必须先 SIGINT（触发注销与 socket unlink），不能直接 kill-session');
  }
  const killIndex = verbs.indexOf('kill-session');
  assert.deepEqual(calls[killIndex], ['kill-session', '-t', 'test-cluster']);
  assert.ok(killIndex > verbs.lastIndexOf('send-keys'), 'kill-session 必须晚于全部 send-keys');
  assert.equal(result.stderr.trim(), '', '干净收口应无 stderr 噪音');
});

test('down：残留 pid 存活 → SIGKILL 兜底 + 非 0 退出（§5.5 残留检查）', async (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  const statePath = writeState(dir, {
    hasSession: true,
    windows: [{ name: 'pb-dev', path: '/repo', dead: '0' }],
    panes: [{ session: 'test-cluster', pid: child.pid }],
  });

  const result = runCluster(
    ['down', '--config', configPath],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /残留进程已 SIGKILL/);
  assert.ok(result.stderr.includes(String(child.pid)), result.stderr);

  const exit = await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(() => r(null), 3000))]);
  assert.notEqual(exit, null, '残留进程应被 SIGKILL');
  assert.equal(exit[1], 'SIGKILL');
});

test('down：无 session → 打印「未在运行」+ 退出 0，零变更子命令（§5.5 幂等）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, { hasSession: false, windows: [] });

  const result = runCluster(
    ['down', '--config', configPath],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: path.join(dir, 'unused.sock'), waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /集群未在运行（session=test-cluster）/);
  assert.deepEqual(tmuxCalls(logPath).map((call) => call[0]), ['has-session']);
});

test('status：分段只读输出（session/窗口/拓扑/日志/角色对齐）+ 退出 0（§5.2 status）', async (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { root, configPath } = makeFixture({ roles: { dev: { cwd: 'work/dev' }, verifier: { enabled: false } } });
  const devCwd = path.join(root, 'work', 'dev');
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, {
    hasSession: true,
    windows: [
      { name: 'router', path: root, dead: '0' },
      { name: 'web', path: root, dead: '0' },
      { name: 'pb-dev', path: devCwd, dead: '0' },
    ],
    panes: [{ session: 'test-cluster', pid: 42 }],
  });
  const router = await startRouter({});
  t.after(async () => {
    await router.stop();
    router.cleanup();
  });

  const result = runCluster(
    ['status', '--config', configPath],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath: router.socketPath, waitMs: 0 }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[集群\] session=test-cluster {2}运行中/);
  assert.match(result.stdout, /\[窗口\]/);
  assert.match(result.stdout, new RegExp(`router ${escapeRe(root)} 0`));
  assert.match(result.stdout, new RegExp(`pb-dev ${escapeRe(devCwd)} 0`));
  assert.match(result.stdout, /\[Router 拓扑\]/);
  assert.match(result.stdout, /instance_id {2}session_id {2}state {2}last_heartbeat/);
  assert.match(result.stdout, /\[日志\]/);
  assert.match(result.stdout, new RegExp(`目录: ${escapeRe(logDir)}`));
  assert.match(result.stdout, /\[角色实例\]/);
  assert.match(result.stdout, /pb-dev {2}role=dev {2}window=yes {2}alive=yes {2}state=unknown/);
  assert.match(result.stdout, /pb-verifier {2}role=verifier {2}enabled=false（未起窗口）/);

  const verbs = tmuxCalls(logPath).map((call) => call[0]);
  for (const verb of ['new-session', 'new-window', 'send-keys', 'kill-session', 'set-option', 'set-environment']) {
    assert.ok(!verbs.includes(verb), `status 只读：不得出现 ${verb}`);
  }
});

test('status：Router 不可达 → 明确报错段 + 其余段照常输出 + 退出 1（不静默冒充成功）', (t) => {
  const dir = makeTempDir();
  const logDir = path.join(dir, 'cluster-logs');
  cleanupTest(t, dir);
  const tmux = writeFakeTmux(dir);
  const { root, configPath } = makeFixture({ roles: { dev: {} } });
  const logPath = path.join(dir, 'tmux.log');
  const statePath = writeState(dir, {
    hasSession: true,
    windows: [{ name: 'router', path: root, dead: '0' }],
    panes: [],
  });
  const socketPath = path.join(dir, 'absent.sock');

  const result = runCluster(
    ['status', '--config', configPath],
    clusterEnv({ logDir, tmuxBin: tmux, logPath, statePath, socketPath, waitMs: 0 }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Router 不可达/);
  assert.ok(result.stderr.includes(socketPath), result.stderr);
  assert.match(result.stdout, /\[集群\] session=test-cluster {2}运行中/);
  assert.match(result.stdout, /\[窗口\]/);
  assert.match(result.stdout, /\[Router 拓扑\]/);
  assert.match(result.stdout, /（不可达，未取到拓扑）/);
  assert.match(result.stdout, /\[日志\]/);
});

test('CLI 用户面：非法子命令/缺子命令 → 退出 2 + 用法；-h 暴露 cluster（F06-4 / §5.2）', () => {
  const bogus = spawnSync(process.execPath, [BIN, 'cluster', 'bogus'], { cwd: OAMP_ROOT, encoding: 'utf8', timeout: RUN_TIMEOUT_MS });
  assert.equal(bogus.status, 2);
  assert.match(bogus.stderr, /未知的 cluster 子命令: bogus/);
  assert.match(bogus.stderr, /用法:/);

  const missing = spawnSync(process.execPath, [BIN, 'cluster'], { cwd: OAMP_ROOT, encoding: 'utf8', timeout: RUN_TIMEOUT_MS });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /缺少 cluster 子命令/);

  const help = spawnSync(process.execPath, [BIN, '-h'], { cwd: OAMP_ROOT, encoding: 'utf8', timeout: RUN_TIMEOUT_MS });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /cluster up\|down\|status/);
});
