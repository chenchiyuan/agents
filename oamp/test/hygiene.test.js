// test/hygiene.test.js — F08 静态卫生断言（architecture §9 / D14）
// ① .gitignore 含 .runtime/ 规则；② bin/ src/ package.json 凭据字段名扫描零命中（排除 test/）；
// ③ package.json dependencies 为空。
// 凭据模式串用字符串拼接构造，规避扫描器对自身字面量的误命中。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 禁止凭据字段名（§9：token/api_key/secret/password/credential/authorization/private_key 等，
// 词边界、大小写不敏感）。字符串拼接规避字面量自匹配。
const FORBIDDEN_WORDS = [
  'to' + 'ken',
  'api' + '_key',
  'secr' + 'et',
  'pass' + 'word',
  'cre' + 'dential',
  'authori' + 'zation',
  'private' + '_key',
];

function scanTargets() {
  const targets = [];
  for (const dir of ['bin', 'src']) {
    const abs = path.join(OAMP_ROOT, dir);
    for (const name of readdirSync(abs)) {
      const file = path.join(abs, name);
      if (statSync(file).isFile() && name.endsWith('.js')) {
        targets.push(file);
      }
    }
  }
  targets.push(path.join(OAMP_ROOT, 'package.json'));
  return targets;
}

test('.gitignore 含 .runtime/ 忽略规则（F08-1 静态面 / §9）', () => {
  const content = readFileSync(path.join(OAMP_ROOT, '.gitignore'), 'utf8');
  const rules = content.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  assert.ok(rules.some((line) => line.trim() === '.runtime/'), '.gitignore 应含 .runtime/ 规则');
});

test('bin/src/package.json 凭据字段名扫描零命中（F08-2 / §9）', () => {
  const findings = [];
  for (const file of scanTargets()) {
    const content = readFileSync(file, 'utf8');
    for (const word of FORBIDDEN_WORDS) {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(content)) {
        findings.push(`${path.relative(OAMP_ROOT, file)} 命中禁止字段名: ${word}`);
      }
    }
  }
  assert.deepEqual(findings, [], '扫描范围内不得出现凭据类字段名');
});

test('package.json dependencies 为空（F08 载体 / 零依赖声明）', () => {
  const pkg = JSON.parse(readFileSync(path.join(OAMP_ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies === undefined ? {} : pkg.dependencies, {});
});
