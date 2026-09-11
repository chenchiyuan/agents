// test/role-binding.test.js — pr-001：角色标识与角色文件定位（architecture §3.1 / §12.2 契约 2）
// 纯函数单测：fixture 一律落临时目录，不依赖真实 omp / 网络 / tmux，不写 oamp/。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  instanceIdForRole,
  roleFromInstanceId,
  resolveRoleFile,
  resolveRoleRoot,
} from '../src/role-binding.js';

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

// 临时角色根：写入给定角色的 <role>/<role>.md
function roleRootFixture(roles) {
  const root = mkdtempSync(path.join(tmpdir(), 'oamp-role-binding-'));
  for (const role of roles) {
    mkdirSync(path.join(root, 'roles', role), { recursive: true });
    writeFileSync(path.join(root, 'roles', role, `${role}.md`), `# ${role}\n`);
  }
  return root;
}

test('instanceIdForRole：10 个角色 → pb-<role>，公式单一（F01-1 / 验收 2）', () => {
  assert.equal(instanceIdForRole('dev'), 'pb-dev');
  for (const role of ROLES) {
    assert.equal(instanceIdForRole(role), `pb-${role}`);
  }
});

test('resolveRoleRoot：缺省 = 包根上级（仓库根），与 config.js 的 PKG_ROOT 同口径（验收 4）', () => {
  assert.equal(resolveRoleRoot({}), REPO_ROOT);
  assert.equal(resolveRoleRoot({ OAMP_ROLE_ROOT: '' }), REPO_ROOT);
});

test('resolveRoleRoot：OAMP_ROLE_ROOT 非空时取该值并绝对化（验收 4）', () => {
  assert.equal(resolveRoleRoot({ OAMP_ROLE_ROOT: '/tmp/oamp-roles' }), '/tmp/oamp-roles');
  assert.equal(
    resolveRoleRoot({ OAMP_ROLE_ROOT: 'relative/roles' }),
    path.resolve('relative/roles'),
  );
});

test('resolveRoleFile：<root>/roles/<role>/<role>.md 绝对路径，只解析不判存在性（验收 5）', () => {
  assert.equal(resolveRoleFile('/tmp/root', 'dev'), '/tmp/root/roles/dev/dev.md');
  assert.equal(resolveRoleFile(REPO_ROOT, 'dev'), path.join(REPO_ROOT, 'roles', 'dev', 'dev.md'));
  // 文件不存在仍返回路径（存在性判定归调用方）
  assert.equal(resolveRoleFile('/tmp/root', 'nobody'), '/tmp/root/roles/nobody/nobody.md');
});

test('roleFromInstanceId：缺省 env 下 pb-dev → dev（验收 3 / F02-1 真源）', () => {
  assert.equal(roleFromInstanceId('pb-dev'), 'dev');
});

test('roleFromInstanceId：OAMP_ROLE_ROOT 指向 fixture 时，10 角色全部成立（验收 3）', () => {
  const env = { OAMP_ROLE_ROOT: roleRootFixture(ROLES) };
  for (const role of ROLES) {
    assert.equal(roleFromInstanceId(`pb-${role}`, env), role);
  }
});

test('roleFromInstanceId：前缀不成立 / 角色文件缺失 → null（验收 3）', () => {
  const env = { OAMP_ROLE_ROOT: roleRootFixture(['dev']) };
  assert.equal(roleFromInstanceId('dev-1', env), null);
  assert.equal(roleFromInstanceId('pb-', env), null);
  assert.equal(roleFromInstanceId('', env), null);
  assert.equal(roleFromInstanceId('pb-architect', env), null); // 前缀成立但文件不存在
  assert.equal(roleFromInstanceId('pb-dev-1', env), null); // id 无后缀：不截断为 dev
});

test('roleFromInstanceId：非法输入 → null（验收 3）', () => {
  assert.equal(roleFromInstanceId(null), null);
  assert.equal(roleFromInstanceId(undefined), null);
  assert.equal(roleFromInstanceId(123), null);
  assert.equal(roleFromInstanceId({}), null);
});
