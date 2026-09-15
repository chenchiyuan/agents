// test/sdk-surface.test.js — F02 / F03 / F04 / F14 的三层覆盖面对照（PR-006）
// 被核对象 = `sdk/surface.js` 导出的三层入口表（LAYERS / ENTRIES，pr-003 产物）；三个参照真源 = `API.md` §3 的
//   21 行接口清单、`src/router.js` 的 `dispatch` 分支、`src/cli.js` 的 `main(argv)` 顶层分派（§5.1 层 A/B/C 表）。
// 只读与零副作用（§10 T1）：起服务 / 连端口 / 子进程 / 写盘 一律为零；包根按 import.meta.url 从用例位置推导，不依赖 cwd。
// 解析口径：严格解析 + 点名失败 —— 行数 / 条数不符即失败（宽容会掩盖真源漂移）；归一只有一处：`<name>` → `:name`
//   并截断 `?…`（§5.5），不引第二份路径表。
// 判据全部现算（表数据 × 文档解析结果），不手抄任何名面清单。
// 并行边界：不断言 `sdk/index.js` / `test/helpers/**` / pr-007~pr-010 的用例是否存在（否则会在其落盘前制造假失败）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ENTRIES, LAYERS } from '../sdk/surface.js';

const OAMP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF_FILE = fileURLToPath(import.meta.url);

// 读取面恰四个文件（T1 验收 2 / T5 验收 1）：表由 import 取，其余三份只读文本。
const SOURCES = {
  api: 'API.md',
  router: path.join('src', 'router.js'),
  cli: path.join('src', 'cli.js'),
};

// ────────────────────────── 共享原语 ──────────────────────────

/** 被核真源的唯一文本读取入口（读不到即点名失败，不静默跳过）。 */
function readSource(rel) {
  const file = path.join(OAMP_ROOT, rel);
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    assert.fail(`期望可读的 ${rel}（未命中或不可读：${err.code || err.message}）`);
  }
}

/** 本用例自身的源文本 —— 零依赖守门（T5 验收 1）的扫描对象。 */
function readSelfSource() {
  try {
    return readFileSync(SELF_FILE, 'utf8');
  } catch (err) {
    assert.fail(`期望可读的本用例文件 ${path.relative(OAMP_ROOT, SELF_FILE)}（不可读：${err.code || err.message}）`);
  }
}

const memo = new Map();
function once(key, build) {
  if (!memo.has(key)) memo.set(key, build());
  return memo.get(key);
}

const apiRows = () => once('api', () => parseApiSection(readSource(SOURCES.api)));
const routerMethods = () => once('router', () => parseDispatchMethods(readSource(SOURCES.router)));
const cliLeaves = () => once('cli', () => parseCliLeaves(readSource(SOURCES.cli)));

const layerEntries = (layer) => ENTRIES.filter((e) => e.layer === layer);
const fullName = (entry) => [entry.layer, ...entry.cmd].join(' ');
const cmdKey = (cmd) => cmd.join(' ');
const countOf = (text, needle) => text.split(needle).length - 1;

/** 重复出现的元素（用于把「唯一性」写成可点名的失败消息）。 */
function duplicates(names) {
  const seen = new Set();
  const dup = new Set();
  for (const name of names) {
    if (seen.has(name)) dup.add(name);
    seen.add(name);
  }
  return [...dup];
}

/** 机械产出对照清单：由表数据与解析结果现算（C11），失败前先落到 stdout 供逐行核对（C8）。 */
function emitChecklist(t, title, lines) {
  t.diagnostic(`${title} —— 共 ${lines.length} 行`);
  for (const line of lines) t.diagnostic(line);
}

// ────────────────────────── 层 A 解析（API.md §3 表区段） ──────────────────────────

// 区段锚（C6）：标题字面量与 `### 3.1 ` 起止 —— 全文另有大量反引号签名，不限定区段会得到 > 21 条。
const API_SECTION_START = '## 3. 接口清单（21 条）';
const API_SECTION_END_RE = /^### 3\.1 /;
const API_ROW_RE = /^\|\s*(\d+)\s*\|\s*`(GET|POST)\s+(\S+)`\s*\|\s*(.*?)\s*\|\s*$/;

/** 归一（唯一一处）：截断 `?…` / `#…`，`<name>` → `:name`（保留参数名，便于与 `args` 对齐）。 */
function normalizePath(p) {
  return p.split(/[?#]/)[0].replace(/<([^>]*)>/g, ':$1');
}

/** 该端点的参数面：路径参数（按出现序）与查询参数名，均取自该行的「方法 + 路径」单元格。 */
function endpointParams(row) {
  const [rawPath] = row.rawPath.split(/[?#]/);
  const pathParams = [...rawPath.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  const queryPart = row.rawPath.split('?')[1] || '';
  const queryParams = [...queryPart.matchAll(/([A-Za-z_][\w-]*)=/g)].map((m) => m[1]);
  return { pathParams, queryParams };
}

/** 解析 `API.md` §3 表区段：行数 / 编号不符即点名失败。 */
function parseApiSection(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === API_SECTION_START);
  assert.ok(start !== -1, `API.md 未命中 §3 标题字面量「${API_SECTION_START}」`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (API_SECTION_END_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  assert.ok(end < lines.length, 'API.md 未命中 §3 表区段的终点字面量「### 3.1 」');

  const rows = [];
  for (const line of lines.slice(start + 1, end)) {
    const m = API_ROW_RE.exec(line);
    if (m) rows.push({ no: Number(m[1]), method: m[2], rawPath: m[3], usage: m[4] });
  }
  assert.equal(rows.length, 21, `API.md §3 表区段应解析出 21 行，实际 ${rows.length} 行`);
  rows.forEach((row, i) => {
    assert.equal(
      row.no,
      i + 1,
      `API.md §3 第 ${i + 1} 行的编号应为 ${i + 1}，实际 ${row.no}（${row.method} ${row.rawPath}）`,
    );
  });
  return rows;
}

// ────────────────────────── T1 · 层 A（21 条） ──────────────────────────

test('层 A 双向比对：21 条 api 入口 ↔ API.md §3 的 21 行（F02 验收 1）', (t) => {
  const doc = apiRows();
  const entries = layerEntries('api');

  assert.equal(entries.length, 21, `层 A 入口表应有 21 条，实际 ${entries.length} 条`);

  const checklist = doc.map((row, i) => {
    const entry = entries[i];
    const name = entry ? `hub api ${cmdKey(entry.cmd)}` : `（层 A 缺第 ${i + 1} 条）`;
    return `#${row.no}\t${row.method} ${row.rawPath}\t↔\t${name}`;
  });
  emitChecklist(t, '层 A 对照清单（API.md §3 ↔ hub api 入口表）', checklist);
  const detail = `\n层 A 对照清单（21 行）：\n${checklist.join('\n')}`;

  const docSigs = doc.map((row) => `${row.method} ${normalizePath(row.rawPath)}`);
  const entrySigs = entries.map((e) => `${e.method} ${e.path}`);
  const docSet = new Set(docSigs);
  const entrySet = new Set(entrySigs);

  const missing = docSigs.filter((sig) => !entrySet.has(sig));
  const extra = entrySigs.filter((sig) => !docSet.has(sig));
  assert.deepEqual(missing, [], `层 A 入口表缺项（§3 有、ENTRIES 无）：${missing.join(', ') || '无'}${detail}`);
  assert.deepEqual(extra, [], `层 A 入口表多出项（ENTRIES 有、§3 无）：${extra.join(', ') || '无'}${detail}`);

  const orderFindings = [];
  const span = Math.min(docSigs.length, entrySigs.length);
  for (let i = 0; i < span; i += 1) {
    if (docSigs[i] !== entrySigs[i]) orderFindings.push(`第 ${i + 1} 行：文档 ${docSigs[i]} ↔ 入口表 ${entrySigs[i]}`);
  }
  assert.deepEqual(
    orderFindings,
    [],
    `层 A 顺序不一致（表序应逐条等于 API.md §3 行序）：\n${orderFindings.join('\n')}${detail}`,
  );
});

test('层 A 订阅面 kind 与 API.md §3 的 SSE 行一致（4 stream / 17 result；§5.1 规则 5）', (t) => {
  const doc = apiRows();
  const entries = layerEntries('api');
  assert.equal(entries.length, doc.length, `层 A 条数 ${entries.length} ≠ §3 行数 ${doc.length}`);

  const findings = [];
  const lines = [];
  for (let i = 0; i < doc.length; i += 1) {
    const row = doc[i];
    const entry = entries[i];
    const docKind = row.usage.includes('SSE') ? 'stream' : 'result';
    lines.push(`#${row.no}\t${docKind}\t↔\t${entry.id}（${entry.kind}）`);
    if (entry.kind !== docKind) {
      findings.push(`#${row.no} ${row.method} ${row.rawPath}：文档 ${docKind} ↔ 入口表 ${entry.kind}`);
    }
  }
  emitChecklist(t, '层 A 订阅面 kind 对照（§3 用途列 SSE ↔ ENTRIES.kind）', lines);
  assert.deepEqual(findings, [], `层 A kind 与文档 SSE 面不一致：\n${findings.join('\n')}`);

  const streams = entries.filter((e) => e.kind === 'stream').map((e) => e.id);
  const results = entries.filter((e) => e.kind === 'result').map((e) => e.id);
  assert.equal(streams.length, 4, `层 A 订阅（stream）条目应恰 4 条，实际 ${streams.length} 条：[${streams.join(', ')}]`);
  assert.equal(results.length, 17, `层 A 结果（result）条目应恰 17 条，实际 ${results.length} 条`);
});

test('层 A 位置参数 ↔ 端点参数（路径参数按出现序；§5.1 规则 2）', (t) => {
  const doc = apiRows();
  const entries = layerEntries('api');
  assert.equal(entries.length, doc.length, `层 A 条数 ${entries.length} ≠ §3 行数 ${doc.length}`);

  const findings = [];
  const lines = [];
  for (let i = 0; i < doc.length; i += 1) {
    const row = doc[i];
    const entry = entries[i];
    const { pathParams, queryParams } = endpointParams(row);
    const allowed = new Set([...pathParams, ...queryParams]);
    const argNames = entry.args.map((a) => a.name);
    lines.push(
      `#${row.no}\t${entry.id}\targs=[${argNames.join(', ')}]\t路径参=[${pathParams.join(', ')}]\t查询参=[${queryParams.join(', ')}]`,
    );

    for (const name of argNames) {
      if (!allowed.has(name)) {
        findings.push(
          `#${row.no} ${entry.id}：位置参数 ${name} 不属于该端点（路径参 [${pathParams.join(', ')}] / 查询参 [${queryParams.join(', ')}]）`,
        );
      }
    }
    // 路径参数按出现序须是位置参数名序的子序列
    let cursor = 0;
    for (const param of pathParams) {
      const at = argNames.indexOf(param, cursor);
      if (at === -1) {
        findings.push(`#${row.no} ${entry.id}：路径参数 ${param} 未按出现序出现在位置参数 [${argNames.join(', ')}] 中`);
        break;
      }
      cursor = at + 1;
    }
  }
  emitChecklist(t, '层 A 位置参数 ↔ 端点参数对照', lines);
  assert.deepEqual(findings, [], `层 A 位置参数与端点参数不一致：\n${findings.join('\n')}`);
});

// ────────────────────────── T2 · 层 B（8 条） ──────────────────────────

const DISPATCH_START = 'async function dispatch(';
const CASE_RE = /^\s+case '([^']+)':/;

/** 从 `src/router.js` 取 `dispatch` 函数体，抽 `case '<方法>':` 字面量（条数不符即点名失败）。 */
function parseDispatchMethods(text) {
  const start = text.indexOf(DISPATCH_START);
  assert.ok(start !== -1, `src/router.js 未命中函数字面量「${DISPATCH_START}」`);
  const bodyEnd = text.indexOf('\n  }\n', start);
  assert.ok(bodyEnd !== -1, 'src/router.js 未命中 dispatch 的 2 空格缩进函数收尾「\\n  }\\n」');

  const methods = [];
  for (const line of text.slice(start, bodyEnd).split('\n')) {
    const m = CASE_RE.exec(line);
    if (m) methods.push(m[1]);
  }
  assert.equal(
    methods.length,
    8,
    `src/router.js 的 dispatch 分支应解析出 8 条 case，实际 ${methods.length} 条：[${methods.join(', ')}]`,
  );
  return methods;
}

test('层 B 双向比对：8 条 uds 入口 ↔ router.js 的 dispatch 分支（F03 验收 1）', (t) => {
  const methods = routerMethods();
  const entries = layerEntries('uds');
  assert.equal(entries.length, 8, `层 B 入口表应有 8 条，实际 ${entries.length} 条`);

  const checklist = methods.map((m) => `uds ${m}\t↔\toamp/src/router.js dispatch 分支 ${m}`);
  emitChecklist(t, '层 B 对照清单（router.js dispatch 分支 ↔ hub uds 入口表）', checklist);
  const detail = `\n层 B 对照清单（8 行）：\n${checklist.join('\n')}`;

  const entryMethods = entries.map((e) => e.method);
  const methodSet = new Set(methods);
  const entrySet = new Set(entryMethods);

  const missing = methods.filter((m) => !entrySet.has(m));
  const extra = entryMethods.filter((m) => !methodSet.has(m));
  assert.deepEqual(missing, [], `层 B 入口表缺项（dispatch 有、ENTRIES 无）：${missing.join(', ') || '无'}${detail}`);
  assert.deepEqual(extra, [], `层 B 入口表多出项（ENTRIES 有、dispatch 无）：${extra.join(', ') || '无'}${detail}`);

  const orderFindings = [];
  const span = Math.min(methods.length, entryMethods.length);
  for (let i = 0; i < span; i += 1) {
    if (methods[i] !== entryMethods[i]) {
      orderFindings.push(`第 ${i + 1} 条：router.js ${methods[i]} ↔ 入口表 ${entryMethods[i]}`);
    }
  }
  assert.deepEqual(
    orderFindings,
    [],
    `层 B 顺序不一致（表序应逐条等于 dispatch 分支序）：\n${orderFindings.join('\n')}${detail}`,
  );

  const shapeFindings = [];
  for (const e of entries) {
    if (e.cmd.length !== 1 || e.cmd[0] !== e.method) {
      shapeFindings.push(`${e.id}：cmd 应为 [method] 形态，实际 [${e.cmd.join(', ')}]`);
    }
    if (!/^[a-z][a-z_]*\.[a-z][a-z_]*$/.test(String(e.method))) {
      shapeFindings.push(`${e.id}：method 应为 ns.name 形态，实际 ${e.method}`);
    }
    if (e.path !== null) shapeFindings.push(`${e.id}：层 B 的 path 应为 null，实际 ${e.path}`);
    if (e.args.length !== 0) {
      shapeFindings.push(`${e.id}：层 B 的唯一入参通道是 --params，位置参数应为 0，实际 ${e.args.length} 个`);
    }
  }
  assert.deepEqual(shapeFindings, [], `层 B 条目形态不符（§5.1 层 B 表）：\n${shapeFindings.join('\n')}`);

  const acceptsAs = entries.filter((e) => e.acceptsAs === true).map((e) => e.method);
  assert.deepEqual(
    acceptsAs,
    ['agent.heartbeat', 'agent.deregister', 'message.send', 'message.ack'],
    `层 B 接受 --as 的应恰为 heartbeat / deregister / message.send / message.ack 4 条，实际 [${acceptsAs.join(', ')}]`,
  );
});

// ────────────────────────── T3 · 层 C（11 条） ──────────────────────────

const MAIN_START = 'export async function main(';
const TOP_BRANCH_RE = /if \(cmd === '([^']+)'\) \{/;
const VALID_SUBS_RE = /const validSubs = \[([^\]]*)\]/;
const SINGLE_SUB_RE = /sub !== '([^']+)'/;

/** 从 `src/cli.js` 取 `main(argv)` 函数体，按顶层 `if (cmd === '…') {` 分块展开为叶子命令（条数不符即点名失败）。 */
function parseCliLeaves(text) {
  const start = text.indexOf(MAIN_START);
  assert.ok(start !== -1, `src/cli.js 未命中函数字面量「${MAIN_START}」`);
  const bodyEnd = text.indexOf('\n}\n', start);
  assert.ok(bodyEnd !== -1, 'src/cli.js 未命中 main 的函数收尾「\\n}\\n」');
  const body = text.slice(start, bodyEnd);

  const branches = [];
  const re = new RegExp(TOP_BRANCH_RE.source, 'g');
  let m = re.exec(body);
  while (m !== null) {
    branches.push({ top: m[1], at: m.index });
    m = re.exec(body);
  }
  assert.ok(branches.length > 0, 'src/cli.js 的 main 未解析到任何顶层「if (cmd === …) {」分块');

  const leaves = [];
  branches.forEach((branch, i) => {
    const to = i + 1 < branches.length ? branches[i + 1].at : body.length;
    const block = body.slice(branch.at, to);
    const validSubs = VALID_SUBS_RE.exec(block);
    const singleSub = SINGLE_SUB_RE.exec(block);
    if (validSubs) {
      const subs = [...validSubs[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      assert.ok(subs.length > 0, `顶层命令 ${branch.top} 的 validSubs 解析为空`);
      for (const sub of subs) leaves.push([branch.top, sub]);
    } else if (singleSub) {
      leaves.push([branch.top, singleSub[1]]);
    } else {
      leaves.push([branch.top]);
    }
  });

  assert.equal(
    leaves.length,
    11,
    `src/cli.js 的 main 分派展开应得 11 个叶子命令，实际 ${leaves.length} 个（顶层分支 ${branches.length} 个）：[${leaves.map(cmdKey).join(' | ')}]`,
  );
  return leaves;
}

test('层 C 双向比对：11 条 cli 入口 ↔ cli.js 的 main(argv) 分派展开（F04 验收 1）', (t) => {
  const leaves = cliLeaves();
  const entries = layerEntries('cli');
  assert.equal(entries.length, 11, `层 C 入口表应有 11 条，实际 ${entries.length} 条`);

  const checklist = leaves.map((cmd) => `cli ${cmdKey(cmd)}\t↔\toamp ${cmdKey(cmd)}`);
  emitChecklist(t, '层 C 对照清单（cli.js 叶子命令 ↔ hub cli 入口表）', checklist);
  const detail = `\n层 C 对照清单（11 行）：\n${checklist.join('\n')}`;

  const leafSet = new Set(leaves.map(cmdKey));
  const entrySet = new Set(entries.map((e) => cmdKey(e.cmd)));

  // 集合口径：cli.js 分支序 ≠ §5.1 层 C 表序，只断集合不断顺序
  const missing = [...leafSet].filter((k) => !entrySet.has(k));
  const extra = [...entrySet].filter((k) => !leafSet.has(k));
  assert.deepEqual(missing, [], `层 C 入口表缺项（cli.js 有、ENTRIES 无）：${missing.join(', ') || '无'}${detail}`);
  assert.deepEqual(extra, [], `层 C 入口表多出项（ENTRIES 有、cli.js 无）：${extra.join(', ') || '无'}${detail}`);

  const shapeFindings = [];
  for (const e of entries) {
    if (e.method !== null) shapeFindings.push(`${e.id}：层 C 的 method 应为 null，实际 ${e.method}`);
    if (e.path !== null) shapeFindings.push(`${e.id}：层 C 的 path 应为 null，实际 ${e.path}`);
    if (e.args.length !== 0) shapeFindings.push(`${e.id}：层 C 无位置参数，实际 ${e.args.length} 个`);
    if (e.flags.length !== 0) {
      shapeFindings.push(`${e.id}：层 C 不解析 / 不重排 / 不补默认值，选项应为 0，实际 ${e.flags.length} 个`);
    }
  }
  assert.deepEqual(shapeFindings, [], `层 C 条目形态不符（§5.1 层 C 表）：\n${shapeFindings.join('\n')}`);
});

// ────────────────────────── T4 · F14 四验收 ──────────────────────────

test('分层可判定：LAYERS / 40 条 / 层归属 = 第一个 token（F14 验收 1、2 · P-4）', () => {
  assert.deepEqual(LAYERS, ['api', 'uds', 'cli'], `LAYERS 应为三层前缀 ['api', 'uds', 'cli']，实际 [${LAYERS.join(', ')}]`);
  assert.equal(ENTRIES.length, 40, `ENTRIES 应恰 40 条，实际 ${ENTRIES.length} 条`);

  const findings = [];
  for (const e of ENTRIES) {
    if (!LAYERS.includes(e.layer)) findings.push(`${e.id}：layer ${e.layer} 不在 LAYERS [${LAYERS.join(', ')}] 中`);
    const first = fullName(e).split(' ')[0];
    if (first !== e.layer) findings.push(`${e.id}：名面「${fullName(e)}」的第一个 token ${first} ≠ layer ${e.layer}`);
    if (!String(e.id).startsWith(`${e.layer}.`)) findings.push(`${e.id}：id 应以 ${e.layer}. 开头`);
  }
  assert.deepEqual(findings, [], `分层判定不成立：\n${findings.join('\n')}`);

  const counts = { api: layerEntries('api').length, uds: layerEntries('uds').length, cli: layerEntries('cli').length };
  assert.deepEqual(counts, { api: 21, uds: 8, cli: 11 }, `三层计数应为 api 21 / uds 8 / cli 11，实际 ${JSON.stringify(counts)}`);
});

test('doctor 单列：不进 40 条分层判定（F14 验收 1、2 · P-4）', () => {
  const findings = [];
  for (const e of ENTRIES) {
    if (e.cmd[0] === 'doctor') findings.push(`${e.id}：doctor 是第四个顶层入口，不应作为三层覆盖入口`);
    if (String(e.id).includes('doctor')) findings.push(`${e.id}：id 不应含 doctor`);
  }
  assert.deepEqual(findings, [], `doctor 应单列为自检面、不进 40 条分层判定：\n${findings.join('\n')}`);

  const sum = layerEntries('api').length + layerEntries('uds').length + layerEntries('cli').length;
  assert.equal(sum, 40, `40 条应恰为三层之和（自检面不计入分层判定），实际 ${sum}`);
});

test('无同名同形：名面 / id 唯一，同一 cmd 名面不跨层（F14 验收 4）', () => {
  const names = ENTRIES.map(fullName);
  const ids = ENTRIES.map((e) => String(e.id));
  assert.deepEqual(duplicates(names), [], `40 条完整名面应互不相同，重名：${duplicates(names).join(', ')}`);
  assert.deepEqual(duplicates(ids), [], `40 条 id 应互不相同，重名：${duplicates(ids).join(', ')}`);

  const byCmd = new Map();
  for (const e of ENTRIES) {
    const key = cmdKey(e.cmd);
    if (!byCmd.has(key)) byCmd.set(key, new Set());
    byCmd.get(key).add(e.layer);
  }
  const crossLayer = [...byCmd]
    .filter(([, layers]) => layers.size > 1)
    .map(([key, layers]) => `cmd ${key} 出现在多层：[${[...layers].join(', ')}]`);
  assert.deepEqual(crossLayer, [], `同一 cmd 名面不得跨层（层前缀须唯一确定归属）：\n${crossLayer.join('\n')}`);

  const inner = [];
  for (const e of ENTRIES) {
    for (const name of duplicates(e.args.map((a) => a.name))) inner.push(`${e.id}：位置参数重名 ${name}`);
    for (const name of duplicates(e.flags.map((f) => f.name))) inner.push(`${e.id}：选项重名 ${name}`);
  }
  assert.deepEqual(inner, [], `单条内不得重名（会令形面歧义）：\n${inner.join('\n')}`);
});

// §5.1「跨层无歧义的三处样例（F14 验收 2 的判定样本）」—— 只核名面存在性与层归属，不核选项 / 位置参数取值。
const CROSS_LAYER_SAMPLES = [
  { label: '实例拓扑', names: ['api agents', 'uds router.status', 'cli status'] },
  { label: '任务 / 调用清单', names: ['api calls list', 'uds router.task_list', 'cli task list'] },
  { label: '单任务 / 调用终态', names: ['api calls get', 'uds router.task_get', 'cli task status'] },
];

test('跨层近名三处样例：组内三名面都存在且层归属无歧义（F14 验收 2、4）', () => {
  const present = new Set(ENTRIES.map(fullName));
  const findings = [];
  for (const sample of CROSS_LAYER_SAMPLES) {
    if (duplicates(sample.names).length > 0) {
      findings.push(`${sample.label}：样例名面自身重名 [${duplicates(sample.names).join(', ')}]`);
    }
    sample.names.forEach((name, i) => {
      if (!present.has(name)) findings.push(`${sample.label}：ENTRIES 中不存在名面「${name}」`);
      const expectedLayer = LAYERS[i];
      const first = name.split(' ')[0];
      if (first !== expectedLayer) findings.push(`${sample.label}：「${name}」的首 token 应为 ${expectedLayer}，实际 ${first}`);
    });
  }
  assert.deepEqual(findings, [], `跨层近名样例的层归属有歧义：\n${findings.join('\n')}`);
});

// 条目字段契约（surface.js:8-17 的封闭声明）。
const ENTRY_FIELDS = ['id', 'layer', 'cmd', 'args', 'flags', 'kind', 'method', 'path', 'acceptsAs', 'run'];

test('无编排条目：每条恰一个目标（单一端点 / 单一方法 / 单一条既有命令）（F14 验收 3 · N5）', () => {
  const findings = [];
  const expectedFields = [...ENTRY_FIELDS].sort().join(',');

  for (const e of ENTRIES) {
    const fields = Object.keys(e).sort();
    if (fields.join(',') !== expectedFields) {
      findings.push(`${e.id}：条目字段集应为 [${[...ENTRY_FIELDS].sort().join(', ')}]，实际 [${fields.join(', ')}]`);
    }
    if (!['result', 'stream'].includes(e.kind)) findings.push(`${e.id}：kind 应为 result | stream，实际 ${e.kind}`);

    if (e.layer === 'api') {
      if (!['GET', 'POST'].includes(e.method)) findings.push(`${e.id}：层 A 的 method 应为 GET | POST，实际 ${e.method}`);
      if (typeof e.path !== 'string' || !e.path.startsWith('/api/')) {
        findings.push(`${e.id}：层 A 的 path 应以 /api/ 开头，实际 ${e.path}`);
      } else if (/[\s|?#]/.test(e.path)) {
        findings.push(`${e.id}：层 A 的 path 不得含空白 / | / ? / #，实际 ${e.path}`);
      }
    } else if (e.layer === 'uds') {
      if (!/^[a-z][a-z_]*\.[a-z][a-z_]*$/.test(String(e.method))) {
        findings.push(`${e.id}：层 B 的 method 应为 ns.name 形态，实际 ${e.method}`);
      }
      if (e.path !== null) findings.push(`${e.id}：层 B 的 path 应为 null，实际 ${e.path}`);
    } else if (e.layer === 'cli') {
      if (e.method !== null || e.path !== null) {
        findings.push(`${e.id}：层 C 的 method / path 应为 null，实际 ${e.method} / ${e.path}`);
      }
    } else {
      findings.push(`${e.id}：未归属任一层（layer ${e.layer}）`);
    }
  }
  // 三个双射（T1 / T2 / T3 的覆盖率比对）⇒ 不存在一条覆盖两个目标的条目
  assert.deepEqual(findings, [], `无编排条目判定不成立：\n${findings.join('\n')}`);
});

// ────────────────────────── T5 · 零依赖守门 + 拾取性（§10 T1 / T-07） ──────────────────────────

// 被扫字面量一律拼接构造，规避扫描器命中自身（体例 = hygiene.test.js 的凭据词表）。
const READ_CALL = 'read' + 'FileSync(';
const ALLOWED_IMPORTS = ['node:test', 'node:assert/strict', 'node:fs', 'node:url', 'node:path', '../sdk/surface.js'];
const FORBIDDEN_MODULES = [
  ['node:', 'net'].join(''),
  ['node:', 'http'].join(''),
  ['node:', 'https'].join(''),
  ['node:', 'child_process'].join(''),
  ['node:', 'dgram'].join(''),
  ['node:', 'tls'].join(''),
];
const FORBIDDEN_WRITE_APIS = [
  ['write', 'FileSync'].join(''),
  ['append', 'FileSync'].join(''),
  ['mkdir', 'Sync'].join(''),
  ['create', 'WriteStream'].join(''),
  ['rm', 'Sync'].join(''),
];
// import 说明符的行形态：行首锚定，故不会命中本文件里写出的同一个正则字面量。
const IMPORT_LINE_RE = /^import\s.*'([^']+)';$/m;

test('零依赖守门：import 白名单 + 零网络 / 零子进程 / 零写盘 + 读取点收敛（§10 T1）', () => {
  const self = readSelfSource();

  const specifiers = [...self.matchAll(new RegExp(IMPORT_LINE_RE.source, 'gm'))].map((m) => m[1]);
  assert.deepEqual(
    [...specifiers].sort(),
    [...ALLOWED_IMPORTS].sort(),
    `本用例的 import 说明符应恰为白名单 [${[...ALLOWED_IMPORTS].sort().join(', ')}]，实际 [${[...specifiers].sort().join(', ')}]`,
  );

  const findings = [];
  for (const mod of FORBIDDEN_MODULES) {
    if (self.includes(mod)) findings.push(`命中禁止模块 ${mod}（${countOf(self, mod)} 处）`);
  }
  for (const api of FORBIDDEN_WRITE_APIS) {
    if (self.includes(api)) findings.push(`命中写盘 API ${api}（${countOf(self, api)} 处）`);
  }
  assert.deepEqual(findings, [], `本用例应当零网络 / 零子进程 / 零写盘：\n${findings.join('\n')}`);

  const callSites = [];
  let at = self.indexOf(READ_CALL);
  while (at !== -1) {
    const close = self.indexOf(')', at);
    callSites.push(self.slice(at + READ_CALL.length, close));
    at = self.indexOf(READ_CALL, close);
  }
  assert.deepEqual(
    callSites,
    [`file, 'utf8'`, `SELF_FILE, 'utf8'`],
    `读取点应恰为两处（三份只读真源经 readSource 的 file 变量 + 本用例自身的源文本，后者是零依赖守门的扫描对象），实际 [${callSites.join(' | ')}]`,
  );
  assert.ok(
    self.includes('const file = path.join(OAMP_ROOT, rel);'),
    '三份真源的读取路径应由包根 OAMP_ROOT 与相对路径 rel 拼出（不依赖 cwd）',
  );
  assert.deepEqual(
    Object.values(SOURCES),
    ['API.md', path.join('src', 'router.js'), path.join('src', 'cli.js')],
    `rel 的取值面应恰为 A2 的三个路径（API.md / src/router.js / src/cli.js），实际 [${Object.values(SOURCES).join(', ')}]`,
  );
});

test('拾取性：本用例落在 oamp/test/*.test.js 内（§10 T1 / T-07）', () => {
  const rel = path.relative(OAMP_ROOT, SELF_FILE).split(path.sep).join('/');
  assert.equal(rel, 'test/sdk-surface.test.js', `本用例应位于 oamp/test/sdk-surface.test.js，实际 ${rel}`);
  assert.ok(/^test\/[^/]+\.test\.js$/.test(rel), `本用例路径应落在既有 scripts.test 的 test/*.test.js glob 内，实际 ${rel}`);
});
