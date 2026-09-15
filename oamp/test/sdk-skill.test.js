// test/sdk-skill.test.js — F12 / F13 的文本面机械核对（PR-005）
// 语义准绳：architecture §5.1（三层 40 条入口的名面 + P-4 的 doctor 口径）、§5.4（退出码四类）、
//           §5.6（T-05 单文件自包含 / T-06 入口定位模板）、§10 T6（机械核对四项）。
// 只读文本：不 import SDK、不起子进程、不连端口、不写盘；被核文件路径按 import.meta.url 从用例位置推导，
//           与 SDK 内部「按模块位置推导路径」同口径（不依赖 cwd）。
// 断言纪律：只锚在已钉死的标题字面量、三层名面与固定模式上；不锚行号、段落长度、措辞顺序。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_REL = 'oamp/skill/hub.md';
const SKILL_FILE = path.join(OAMP_ROOT, 'skill', 'hub.md');

// 三段式（F12 验收 2）
const H2_TITLES = ['## 何时用', '## 怎么用', '## 红线'];

// 4 条典型序列（F12 验收 4）
const SEQUENCE_TITLES = [
  '### 序列 1：派发 → 取终态',
  '### 序列 2：截断恢复',
  '### 序列 3：事件订阅',
  '### 序列 4：状态盘点',
];

// 三层清单的名面（architecture §5.1 三表）：层 A 取层 A 表「SDK 子命令」列、层 B 取层 B 表「SDK 子命令」列、
// 层 C 取层 C 表「SDK 入口」列（同为「层 + 子命令」名面，不含调用前缀、不含选项、不含位置参数占位符）。
const LAYERS = [
  {
    title: '### 层 A · api（21 条）',
    names: [
      'api agents',
      'api chats list',
      'api chats get',
      'api chats close',
      'api chats archive',
      'api chats activate',
      'api chats rename',
      'api messages send',
      'api stream chat',
      'api stream events',
      'api docs',
      'api projects list',
      'api projects create',
      'api calls create',
      'api calls list',
      'api stream calls',
      'api stream call',
      'api calls transcript',
      'api calls get',
      'api confirmations list',
      'api confirmations decide',
    ],
  },
  {
    title: '### 层 B · uds（8 条）',
    names: [
      'uds agent.register',
      'uds agent.heartbeat',
      'uds agent.deregister',
      'uds message.send',
      'uds message.ack',
      'uds router.status',
      'uds router.task_get',
      'uds router.task_list',
    ],
  },
  {
    title: '### 层 C · cli（11 条）',
    names: [
      'cli router start',
      'cli agent start',
      'cli status',
      'cli task send',
      'cli task status',
      'cli task list',
      'cli task watch',
      'cli web start',
      'cli cluster up',
      'cli cluster down',
      'cli cluster status',
    ],
  },
];

// 退出码四值语义（architecture §5.4）
const EXIT_CODES = [
  ['0', '成功'],
  ['1', '业务失败'],
  ['2', '用法错误'],
  ['3', '连接失败'],
];

// 「不是第二份文档」的四类特征（F12 验收 7 / N8）
const NOT_A_SECOND_DOC = [
  { label: 'markdown 表格分隔行', re: /^\s*\|?\s*:?-{3,}/m },
  { label: '选项字面量（两个连字符）', literal: '--' },
  { label: '端点路径字面量 /api/', literal: '/api/' },
  { label: '字段类型标注（冒号 + 类型名）', re: /[:：]\s*(string|number|boolean|integer|object|array)\b/ },
];

// 本机路径 / 切目录 / 机器相关值（F13 验收 1/3/4）
const LOCAL_COUPLINGS = [
  { label: '本机路径字面量 /Users/', literal: '/Users/' },
  { label: '本机路径字面量 /home/', literal: '/home/' },
  { label: '行首 cd 前置', re: /^\s*cd\s/m },
  { label: '&& 之后的 cd 前置', re: /&&\s*cd\s/ },
  { label: '分号之后的 cd 前置', re: /;\s*cd\s/ },
  { label: '~ 家目录展开', literal: '~' },
  { label: '环境变量引用形态', re: /\$\w+/ },
];

// 手写 HTTP 的裸判据（F12 验收 4 / E1）
const HAND_WRITTEN_HTTP = [
  { label: '手写 HTTP 客户端命令 curl', literal: 'curl' },
  { label: '明文 HTTP URL 字面量 http://', literal: 'http://' },
  { label: 'TLS HTTP URL 字面量 https://', literal: 'https://' },
];

const DOCTOR_NOTE = '自检（不属于三层封装）';

function skillText() {
  try {
    return readFileSync(SKILL_FILE, 'utf8');
  } catch (err) {
    assert.fail(`期望可读的 skill 文件 ${SKILL_REL}（未命中或不可读：${err.code || err.message}）`);
  }
}

function trimmedLines(text) {
  return text.split('\n').map((line) => line.trim());
}

/** 字面量命中次数（用于把「零命中」写成可读的失败消息）。 */
function countOf(text, needle) {
  return text.split(needle).length - 1;
}

/** 规则命中数：literal 走字面量计数，re 走模式（命中即 1）。 */
function hitsOf(text, rule) {
  if (rule.literal !== undefined) return countOf(text, rule.literal);
  return rule.re.exec(text) ? 1 : 0;
}

/** 取标题行到下一个同级或更高级标题之间的正文；标题未命中返回 null。 */
function sectionBody(text, heading, level) {
  const all = text.split('\n');
  const start = all.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const boundary = new RegExp(`^#{1,${level}}\\s`);
  let end = all.length;
  for (let i = start + 1; i < all.length; i += 1) {
    if (boundary.test(all[i])) {
      end = i;
      break;
    }
  }
  return all.slice(start + 1, end).join('\n');
}

/** 小节内「一行一条子命令名」的条目：去列表符号与反引号后仍以层前缀开头者。 */
function entriesOf(body) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.replace(/^[-*+]\s+/, '').replace(/`/g, '').trim())
    .filter((line) => /^(api|uds|cli)\s/.test(line));
}

function assertZeroHits(text, rules, why) {
  for (const rule of rules) {
    const hits = hitsOf(text, rule);
    assert.equal(hits, 0, `期望${rule.label}零命中，实际 ${hits} 次（${why}）`);
  }
}

test('F12-2：三段式 H2 标题齐备（何时用 / 怎么用 / 红线）且各恰一次', () => {
  const text = skillText();
  for (const title of H2_TITLES) {
    const hits = trimmedLines(text).filter((line) => line === title).length;
    assert.equal(hits, 1, `期望标题字面量「${title}」恰命中 1 次，实际 ${hits} 次`);
  }
  assert.deepEqual(
    trimmedLines(text).filter((line) => /^##\s/.test(line)),
    H2_TITLES,
    '顶层 H2 应为且仅为这三段（多出第四段顶层标题会让三段式失去判据面）',
  );
});

test('F12-4：4 条典型序列标题齐备且各恰一次', () => {
  const text = skillText();
  for (const title of SEQUENCE_TITLES) {
    const hits = trimmedLines(text).filter((line) => line === title).length;
    assert.equal(hits, 1, `期望序列标题字面量「${title}」恰命中 1 次，实际 ${hits} 次`);
  }
});

test('F12-7 / N8：无参数表与字段清单特征（表格分隔行 / 选项 / 端点路径 / 字段类型零命中）', () => {
  const text = skillText();
  assertZeroHits(text, NOT_A_SECOND_DOC, 'skill 不得复制 API.md 的参数与字段');
});

test('F13-1/3/4：无本机路径字面量、无 cd 前置、无 ~ 与环境变量前置（零命中）', () => {
  const text = skillText();
  assertZeroHits(text, LOCAL_COUPLINGS, '入口定位只用「项目根 + 相对位置」表达');
});

test('F12-4 / E1：序列全程零手写 HTTP（curl 与 HTTP(S) URL 字面量零命中）', () => {
  const text = skillText();
  assertZeroHits(text, HAND_WRITTEN_HTTP, '一律经 hub 子命令或 SDK 方法');
});

test('P-4：doctor 带标注字面量且不出现在三层小节内', () => {
  const text = skillText();
  assert.ok(text.includes(DOCTOR_NOTE), `期望标注字面量「${DOCTOR_NOTE}」出现（doctor 的层归属口径）`);
  for (const layer of LAYERS) {
    const body = sectionBody(text, layer.title, 3);
    assert.ok(body !== null, `期望存在小节「${layer.title}」（未命中）`);
    assert.ok(!body.includes('doctor'), `小节「${layer.title}」内不应出现 doctor（doctor 应单列于三层之外）`);
  }
});

test('§5.1 / F14-1·3：三层清单条目数 21 / 8 / 11，且名面与入口表逐条一致', () => {
  const text = skillText();
  let total = 0;
  for (const layer of LAYERS) {
    const body = sectionBody(text, layer.title, 3);
    assert.ok(body !== null, `期望存在小节「${layer.title}」（未命中）`);
    const actual = entriesOf(body);
    total += actual.length;
    assert.equal(
      actual.length,
      layer.names.length,
      `小节「${layer.title}」条目数应为 ${layer.names.length}，实际 ${actual.length}`,
    );
    const missing = layer.names.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !layer.names.includes(name));
    assert.deepEqual(
      { missing, extra },
      { missing: [], extra: [] },
      `小节「${layer.title}」名面应与 §5.1 一致（缺项 / 多出项见上）`,
    );
  }
  assert.equal(total, 40, `三层清单合计应为 40 条（21 + 8 + 11），实际 ${total} 条`);
});

test('§5.4 / F12-6：红线段含退出码四值语义（0 成功 / 1 业务失败 / 2 用法错误 / 3 连接失败）', () => {
  const text = skillText();
  const body = sectionBody(text, '## 红线', 2);
  assert.ok(body !== null, '期望存在「## 红线」段（未命中）');
  for (const [code, meaning] of EXIT_CODES) {
    const re = new RegExp(`\`?${code}\`?[^\\n]{0,12}${meaning}`);
    assert.ok(re.test(body), `红线段应写明退出码 ${code} = ${meaning}（期望模式 ${re}，未命中）`);
  }
});
