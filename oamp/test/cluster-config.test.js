// test/cluster-config.test.js — pr-002：集群配置加载与校验（architecture §5.1 / §12.2 契约 3）
// fixture 一律落临时目录、自建自删；不依赖真实 omp / tmux / 网络 / Router，不写 oamp/。
// 覆盖：路径优先级、缺省填充、覆盖值、cwd 基准、非法输入、凭据字段扫描、角色预检、enabled:false 语义。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadClusterConfig } from '../src/cluster-config.js';
import { instanceIdForRole, resolveRoleFile } from '../src/role-binding.js';

// F01-1 完整清单（roles/ 下 10 个角色；_template / cdp-debug-skill 不在其中）
const ROLES = [
  'architect',
  'demand',
  'dev',
  'planner',
  'pr-planner',
  'prd',
  'progress-observer',
  'retrospective',
  'verifier',
  'workflow-pb',
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 临时 fixture：目录 = 配置文件所在目录（= 返回值的 root），可预置 <role>/<role>.md
function tmpFixture(t, config, roles = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'oamp-cluster-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const role of roles) {
    mkdirSync(path.join(root, 'roles', role), { recursive: true });
    writeFileSync(resolveRoleFile(root, role), `# ${role}\n`);
  }
  const configPath = path.join(root, 'cluster.json');
  writeFileSync(configPath, typeof config === 'string' ? config : JSON.stringify(config, null, 2));
  return {
    root,
    configPath,
    load: (options = {}) => loadClusterConfig({ path: configPath, env: {}, ...options }),
  };
}

test('缺省路径：加载仓库根 cluster.json，roles 键恰为 10 个角色（验收 4 / F06-1 / F01-2）', () => {
  const cfg = loadClusterConfig({ env: {} });
  assert.equal(cfg.root, REPO_ROOT);
  assert.equal(cfg.session, 'oamp-cluster');
  assert.deepEqual(cfg.web, { port: 7788 });
  assert.deepEqual(cfg.router, { socket: null });
  assert.deepEqual([...cfg.roles.keys()], ROLES);
  for (const role of ROLES) {
    const value = cfg.roles.get(role);
    assert.equal(value.instanceId, instanceIdForRole(role));
    assert.equal(value.cwd, REPO_ROOT);
    assert.equal(value.enabled, true);
  }
});

test('路径优先级：显式 path > OAMP_CLUSTER_CONFIG > <roleRoot>/cluster.json（验收 1 / §5.1）', (t) => {
  const explicit = tmpFixture(t, { session: 'from-explicit', roles: { dev: {} } }, ['dev']);
  const fromEnv = tmpFixture(t, { session: 'from-env', roles: { dev: {} } }, ['dev']);
  const viaRoleRoot = tmpFixture(t, { session: 'from-role-root', roles: { dev: {} } }, ['dev']);

  const byExplicit = loadClusterConfig({
    path: explicit.configPath,
    env: { OAMP_CLUSTER_CONFIG: fromEnv.configPath },
  });
  assert.equal(byExplicit.session, 'from-explicit');

  const byEnv = loadClusterConfig({ env: { OAMP_CLUSTER_CONFIG: fromEnv.configPath } });
  assert.equal(byEnv.session, 'from-env');
  assert.equal(byEnv.root, fromEnv.root);

  // 空串 env 视为未设置；缺省以 roleRoot 口径定位（OAMP_ROLE_ROOT 覆盖时取该目录）
  const byRoleRoot = loadClusterConfig({ env: { OAMP_CLUSTER_CONFIG: '', OAMP_ROLE_ROOT: viaRoleRoot.root } });
  assert.equal(byRoleRoot.session, 'from-role-root');
  assert.equal(byRoleRoot.root, viaRoleRoot.root);
});

test('路径参数类型非法 → 抛错（快速失败，不静默回落）', () => {
  assert.throws(() => loadClusterConfig({ path: 123, env: {} }), /配置文件路径 需为非空字符串/);
});

test('缺省值填充：session / web.port / router.socket / 角色段五键（验收 2 / §5.1）', (t) => {
  const f = tmpFixture(t, { roles: { dev: {} } }, ['dev']);
  const cfg = f.load();
  assert.equal(cfg.root, f.root);
  assert.equal(cfg.session, 'oamp-cluster');
  assert.deepEqual(cfg.web, { port: 7788 });
  assert.deepEqual(cfg.router, { socket: null });
  const dev = cfg.roles.get('dev');
  assert.equal(dev.instanceId, instanceIdForRole('dev'));
  assert.equal(dev.enabled, true);
  assert.equal(dev.tools, true);
  assert.equal(dev.permission, 'allow');
  assert.equal(dev.cwd, f.root); // '.' = 配置文件所在目录
  assert.equal(dev.model, undefined); // 缺省不写 = 用全局默认（§5.1 / §4.1 链，MI-1）
});

test('覆盖值生效：session / web / router / 角色段五键（§5.1 覆盖示例；键一律角色名）', (t) => {
  const f = tmpFixture(t, {
    session: 's1',
    web: { port: 9000 },
    router: { socket: '/tmp/oamp-test.sock' },
    roles: {
      dev: { enabled: false, model: 'openai/gpt-5.6-luna', tools: false, permission: 'deny', cwd: 'sub' },
      prd: { cwd: '/tmp' },
    },
  }, ['dev', 'prd']);
  const cfg = f.load();
  assert.equal(cfg.session, 's1');
  assert.deepEqual(cfg.web, { port: 9000 });
  assert.deepEqual(cfg.router, { socket: '/tmp/oamp-test.sock' });
  assert.deepEqual(cfg.roles.get('dev'), {
    instanceId: instanceIdForRole('dev'),
    enabled: false,
    model: 'openai/gpt-5.6-luna',
    tools: false,
    permission: 'deny',
    cwd: path.join(f.root, 'sub'),
  });
  assert.equal(cfg.roles.get('prd').cwd, '/tmp'); // 绝对路径原样使用
});

test('cwd 相对基准 = 配置文件所在目录；不做 ~ 展开（验收 3 / §5.1 / AR-18）', (t) => {
  const f = tmpFixture(t, { roles: { dev: { cwd: '~/work' } } }, ['dev']);
  mkdirSync(path.join(f.root, '~', 'work'), { recursive: true });
  assert.equal(f.load().roles.get('dev').cwd, path.join(f.root, '~', 'work'));
});

test('非法输入全部抛错：文件缺失 / 非法 JSON / 非对象 / 类型与取值（验收 5）', (t) => {
  const missingPath = path.join(tmpdir(), `oamp-cluster-missing-${process.pid}.json`);
  assert.throws(() => loadClusterConfig({ path: missingPath, env: {} }), /配置文件不存在或不可读/);

  const badJson = tmpFixture(t, '{ "roles": ');
  assert.throws(() => badJson.load(), /配置文件不是合法 JSON/);

  const cases = [
    ['顶层非对象', '[]', /配置文件顶层 需为对象/],
    ['web 非对象', { web: 1 }, /web 需为对象/],
    ['router 非对象', { router: [] }, /router 需为对象/],
    ['roles 非对象', { roles: [] }, /roles 需为对象/],
    ['角色段非对象', { roles: { dev: 'x' } }, /roles\.dev 需为对象/],
    ['session 空串', { session: '' }, /session 需为非空字符串/],
    ['session 非字符串', { session: 7 }, /session 需为非空字符串/],
    ['router.socket 空串', { router: { socket: '' } }, /router\.socket 需为非空字符串/],
    ['router.socket 非字符串', { router: { socket: 42 } }, /router\.socket 需为非空字符串/],
    ['port = 0', { web: { port: 0 } }, /web\.port 需为 1~65535 的整数/],
    ['port = 65536', { web: { port: 65536 } }, /web\.port 需为 1~65535 的整数/],
    ['port 非整数', { web: { port: 7788.5 } }, /web\.port 需为 1~65535 的整数/],
    ['port 为字符串', { web: { port: '7788' } }, /web\.port 需为 1~65535 的整数/],
    ['enabled 非布尔', { roles: { dev: { enabled: 'yes' } } }, /roles\.dev\.enabled 需为布尔值/],
    ['tools 非布尔', { roles: { dev: { tools: 1 } } }, /roles\.dev\.tools 需为布尔值/],
    ['permission 非法取值', { roles: { dev: { permission: 'always' } } }, /roles\.dev\.permission 需为 'allow' 或 'deny'/],
    ['model 非字符串', { roles: { dev: { model: 5 } } }, /roles\.dev\.model 需为非空字符串/],
    ['model 空串', { roles: { dev: { model: '' } } }, /roles\.dev\.model 需为非空字符串/],
    ['cwd 空串', { roles: { dev: { cwd: '' } } }, /roles\.dev\.cwd 需为非空字符串/],
  ];
  for (const [label, config, pattern] of cases) {
    const f = tmpFixture(t, config);
    assert.throws(() => f.load(), pattern, label);
  }
});

test('enabled 角色的角色文件不存在 → 抛错（验收 5 / §5.1）', (t) => {
  const f = tmpFixture(t, { roles: { dev: {} } }); // roles/ 为空
  assert.throws(() => f.load(), /角色 dev 的角色文件不存在/);
});

test('enabled 角色的 cwd 不存在或非目录 → 抛错（验收 5 / AR-18）', (t) => {
  const missing = tmpFixture(t, { roles: { dev: { cwd: 'nope' } } }, ['dev']);
  assert.throws(() => missing.load(), /角色 dev 的 cwd 不存在或不是目录/);

  const notDir = tmpFixture(t, { roles: { dev: { cwd: 'afile.txt' } } }, ['dev']);
  writeFileSync(path.join(notDir.root, 'afile.txt'), 'x');
  assert.throws(() => notDir.load(), /角色 dev 的 cwd 不存在或不是目录/);
});

test('enabled:false 的角色保留在 Map 中且跳过角色文件 / cwd 预检（验收 3 / F06-1）', (t) => {
  const f = tmpFixture(t, {
    roles: { dev: { enabled: false, cwd: 'gone' }, prd: {} },
  }, ['prd']); // dev 的角色文件与 cwd 都不存在
  const cfg = f.load();
  assert.equal(cfg.roles.size, 2);
  assert.equal(cfg.roles.has('dev'), true);
  assert.equal(cfg.roles.get('dev').enabled, false);
  assert.equal(cfg.roles.get('dev').cwd, path.join(f.root, 'gone'));
  assert.equal(cfg.roles.get('prd').enabled, true);
});

test('凭据类键递归扫描：大小写不敏感、嵌套命中即抛错（验收 6 / F06-7）', (t) => {
  const cases = [
    [{ token: 'x' }, /凭据类字段: token/],
    [{ API_KEY: 'x' }, /凭据类字段: API_KEY/],
    [{ auth: { Secret: 'x' } }, /凭据类字段: auth\.Secret/],
    [{ roles: { dev: { password: 'x' } } }, /凭据类字段: roles\.dev\.password/],
    [{ roles: { dev: { passwd: 'x' } } }, /凭据类字段: roles\.dev\.passwd/],
    [{ web: { port: 7788, apikey: 'x' } }, /凭据类字段: web\.apikey/],
    [{ roles: { dev: { extra: { credential: 'x' } } } }, /凭据类字段: roles\.dev\.extra\.credential/],
    [{ roles: { dev: { githubToken: 'x' } } }, /凭据类字段: roles\.dev\.githubToken/],
  ];
  for (const [config, pattern] of cases) {
    const f = tmpFixture(t, config);
    assert.throws(() => f.load(), pattern);
  }
});

test('未知键忽略（不报错）：顶层 / web / router / 角色段（§5.1 校验表）', (t) => {
  const f = tmpFixture(t, {
    bogus: 1,
    web: { foo: 'bar' },
    router: { baz: true },
    roles: { dev: { unknown: [1, 2] } },
  }, ['dev']);
  const cfg = f.load();
  assert.deepEqual(cfg.web, { port: 7788 });
  assert.deepEqual(cfg.router, { socket: null });
  assert.equal(cfg.roles.get('dev').tools, true);
});

test('角色段 instance_id / instanceId 字段 → 抛错（§3.1 无覆盖字段；MI-2）', (t) => {
  for (const key of ['instance_id', 'instanceId']) {
    const f = tmpFixture(t, { roles: { dev: { [key]: 'custom-name' } } });
    assert.throws(() => f.load(), new RegExp(`roles\\.dev\\.${key} 不是受支持的字段`));
  }
});

test('roles Map 键为角色名、顺序 = 配置声明序、instanceId 单点导出（契约 3 / O-1 裁决）', (t) => {
  const f = tmpFixture(t, { roles: { prd: {}, dev: {}, architect: {} } }, ['prd', 'dev', 'architect']);
  const cfg = f.load();
  assert.ok(cfg.roles instanceof Map);
  assert.deepEqual([...cfg.roles.keys()], ['prd', 'dev', 'architect']);
  for (const [role, value] of cfg.roles) {
    assert.equal(value.instanceId, instanceIdForRole(role));
  }
});

test('roles 段整体缺省 → 空 Map（不抛错；角色清单完全由配置驱动）', (t) => {
  const f = tmpFixture(t, {});
  const cfg = f.load();
  assert.equal(cfg.roles.size, 0);
});
