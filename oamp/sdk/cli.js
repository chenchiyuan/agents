// sdk/cli.js — hub 的 CLI 面（F01 / F04~F08 / F10 / F14；architecture §2.1 CLI、§4.1 N-6、§5.1、§5.3、§5.4）
// 一次调用的形态：argv 解析（层归属 = 第一个 token）→ 本地校验（P-3：只判"构造请求所必需"的部分，
//   命中即用法错误 `2` 且**未发出任何连接 / 请求 / 子进程**）→ 查 `ENTRIES` 分派（零第二份命令表）
//   → 默认 JSON / `--human` 渲染 → 失败写 stderr 单行 JSON → 返回进程退出码（不自行 `process.exit`）。
// 层 C（P-2）：`hub cli` 之后的一切 token **原样**交给既有 oamp 命令（不解析、不重排、不补默认值），
//   stdout / stderr / 退出码逐字透传（既有 `0/1/2`，不经分类表重分类 —— A18）。
// 退出码落点（§5.4，与库面共用 errors.js 的同一张表）：成功 `0` / 业务失败 `1` / 用法错误 `2` / 连接失败 `3`；
//   `main` 返回数字，由 bin/hub.js 落 `process.exitCode`（A3 的同约定）。
// doctor（P-4）：第四顶层入口，不属于三层，不在 `ENTRIES` 的 40 条内；含 fail 项仍退出 `0`（结论由 stdout 的
//   `pass` / `items` 承载），hub 不可达 ⇒ `3` + stderr 统一错误。
// 零状态（F09 / §0.4 契约 12）：解析段模块级零可变值、结果不缓存不落盘、零本地写；同一 argv 连跑两次一致。
// 零自动性（L2-9 / G02 验收 3）：不重试、不重连、不补发、无心跳循环。

import { ENTRIES, LAYERS, createSurface } from './surface.js';
import { check as doctorCheck } from './doctor.js';
import { HubError, classify, serializeError } from './errors.js';

const DEFAULT_WAIT_MS = 1800000; // §5.4 要点 / L2-4：`api calls create --wait` 的缺省（逐字沿用既有 DEFAULT_OMP_TIMEOUT_MS）
const KEY_PAD = 12; // 对象渲染的键宽（逐字沿用 src/task.js:renderTask 的手法是 `padEnd(12)`）
const LAYER_TITLE = { api: '层 A · api', uds: '层 B · uds', cli: '层 C · cli' };

// ────────────────────────────── argv 解析（层归属 → 查表 → 本地校验）──────────────────────────────

/** 层 A / 层 B 的选项面（不在该条目接受面内的选项 ⇒ 用法错误 `2`，§5.4 `2` 类）。 */
function builtinOption(entry, name) {
  if (name === 'human') return { kind: 'bool', slot: 'human' }; // 通用选项（层 A / 层 B 生效）
  if (name === 'port' && entry.layer === 'api') return { kind: 'int', slot: 'port' }; // 层 A 选项（MI-5(c)）
  if (name === 'params' && entry.layer === 'uds') return { kind: 'json', slot: 'params' }; // 层 B 的唯一入参通道
  if (name === 'as' && entry.acceptsAs === true) return { kind: 'string', slot: 'as' }; // 4 条身份相关方法（MI-6）
  return null; // `--wait` 给非阻塞条目、`--as` 给非身份方法、`--port` 给非层 A、`--params` 给层 A……
}

/** 选项取值形态校验（P-3：只判"构造请求所必需"的部分 —— 整数 / 可解析 JSON / 数组切分；取值域交服务端）。 */
function parseValue(kind, name, raw) {
  if (kind === 'int') {
    if (!/^-?\d+$/.test(raw)) return { error: `选项取值非法: --${name} 需为整数（当前值 ${raw}）` };
    return { parsed: raw }; // 值原样成串下行（query / body 不本地转类型，A12 的 queryString 语义）
  }
  if (kind === 'json') {
    try {
      return { parsed: JSON.parse(raw) };
    } catch {
      return { error: `选项取值非法: --${name} 不是合法 JSON` };
    }
  }
  // 数组字段：§5.1 规则 3 的"以逗号分隔"（元素原样、不改写不补默认值）
  if (kind === 'array') return { parsed: raw.split(',') };
  return { parsed: raw };
}

function assign(out, slot, name, value) {
  if (slot === 'flag') out.flags[name] = value;
  else if (slot === 'human') out.human = true;
  else if (slot === 'port') out.port = Number(value);
  else if (slot === 'as') out.as = value;
  else if (slot === 'params') out.jsonParams = value;
}

/** 子命令之后的一切 token：选项（含取值校验）与位置参数（含齐否 / 多余）。 */
function parseTail(entry, tail) {
  const declared = new Map(entry.flags.map((flag) => [flag.name, flag]));
  const out = { args: [], flags: {}, human: false, port: undefined, jsonParams: null, as: null };
  for (let i = 0; i < tail.length; i += 1) {
    const token = tail[i];
    if (!token.startsWith('--')) {
      out.args.push(token);
      continue;
    }
    const name = token.slice(2);
    const flag = declared.get(name);
    const spec = flag === undefined ? builtinOption(entry, name) : { ...flag, slot: 'flag' };
    if (spec === null) return { error: `该条目不接受选项: --${name}` };
    if (spec.kind === 'bool') {
      assign(out, spec.slot, name, true);
      continue;
    }
    const raw = tail[i + 1];
    if (raw === undefined) return { error: `选项缺值: --${name}` };
    i += 1;
    const value = parseValue(spec.kind, name, raw);
    if (value.error !== undefined) return value;
    if (spec.slot === 'params' && (value.parsed === null || typeof value.parsed !== 'object' || Array.isArray(value.parsed))) {
      return { error: `选项取值非法: --${name} 需为 JSON 对象` };
    }
    assign(out, spec.slot, name, value.parsed);
  }
  if (out.args.length > entry.args.length) return { error: `位置参数多余: ${out.args.slice(entry.args.length).join(' ')}` };
  for (let i = out.args.length; i < entry.args.length; i += 1) {
    if (entry.args[i].required) return { error: `缺少位置参数: ${entry.args[i].name}` };
  }
  for (const flag of entry.flags) {
    if (flag.required && out.flags[flag.name] === undefined) return { error: `缺少必填选项: --${flag.name}` };
  }
  return out;
}

/** 查表分派：`cmd` 前缀最长匹配（层 A / 层 B 的未知子命令 ⇒ null ⇒ 用法错误 `2`）。 */
function matchEntry(layer, rest) {
  let best = null;
  for (const entry of ENTRIES) {
    if (entry.layer !== layer || entry.cmd.length > rest.length) continue;
    if (!entry.cmd.every((token, index) => rest[index] === token)) continue;
    if (best === null || entry.cmd.length > best.cmd.length) best = entry;
  }
  return best;
}

// ────────────────────────────── 输出契约（默认 JSON / `--human` / NDJSON）──────────────────────────────

/** 单元格文本：标量原样、对象 / 数组 `JSON.stringify` 单行内联（不做时间本地化、不做字段语义解释 —— L2-7）。 */
function cellOf(value) {
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

/** 数组 → 表头行 + 数据行（列宽 = max(表头, 各单元格)、两空格分隔、末列不 pad；沿用 A4 的 renderTable 手法）。 */
function renderTable(rows) {
  if (rows.length === 0) return '（无数据）'; // 空态体例沿用 src/task.js:renderList
  const columns = [...new Set(rows.flatMap((row) => (typeof row === 'object' && row !== null ? Object.keys(row) : [])))];
  if (columns.length === 0) return rows.map((row) => cellOf(row)).join('\n');
  const cellOfRow = (row, key) => cellOf(typeof row === 'object' && row !== null ? row[key] : undefined);
  const widths = columns.map((key) => Math.max(key.length, ...rows.map((row) => cellOfRow(row, key).length)));
  const lineOf = (cells) =>
    cells.map((cell, index) => (index < cells.length - 1 ? cell.padEnd(widths[index]) : cell)).join('  ');
  return [lineOf(columns), ...rows.map((row) => lineOf(columns.map((key) => cellOfRow(row, key))))].join('\n');
}

/** 对象 → `键: 值` 逐行（键 `padEnd(12)`；沿用 src/task.js:renderTask 的手法）。 */
function renderObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return cellOf(value);
  return Object.entries(value)
    .map(([key, item]) => `${key.padEnd(KEY_PAD)}: ${cellOf(item)}`)
    .join('\n');
}

/**
 * `--human` 的两条渲染路径（§5.3）：数组 ⇒ 表格；对象恰含一个数组载荷 ⇒ 该载荷走表格、其余键随后逐行
 * （清单类端点的分页元数据因此不丢）；其余对象 ⇒ `键: 值`。渲染器只换呈现，不改结果对象（F05 验收 3）。
 */
function renderHuman(result) {
  if (Array.isArray(result)) return renderTable(result);
  if (typeof result === 'object' && result !== null) {
    const arrayKeys = Object.keys(result).filter((key) => Array.isArray(result[key]));
    if (arrayKeys.length === 1) {
      const [key] = arrayKeys;
      const rest = Object.keys(result).filter((item) => item !== key);
      const sections = [renderTable(result[key])];
      if (rest.length > 0) sections.push(renderObject(Object.fromEntries(rest.map((item) => [item, result[item]]))));
      return sections.join('\n');
    }
    return renderObject(result);
  }
  return cellOf(result);
}

/** 订阅帧 → 一行 `<事件名>  key=value key=value …`（data 的顶层键值内联，§5.3）。 */
function renderFrame(frame) {
  const data = frame.data;
  const pairs = typeof data === 'object' && data !== null ? Object.entries(data).map(([key, value]) => `${key}=${cellOf(value)}`) : [];
  return `${frame.event}  ${pairs.join(' ')}`.trimEnd();
}

function writeResult(result, human) {
  const value = result === undefined ? null : result; // 层 B 的通知型方法（心跳）无 result ⇒ null（JSON 面仍可解析）
  process.stdout.write(human ? `${renderHuman(value)}\n` : `${JSON.stringify(value)}\n`);
}

// ────────────────────────────── 失败面与用法 ──────────────────────────────

/** 非归类表错误（本地环境 / 内部缺陷）：按"本地配置错误"呈现（§5.4 `1` 类 ③），不静默当成功。 */
function toHubError(err) {
  if (err instanceof HubError) return err;
  const { code, exitCode } = classify({ kind: 'config' });
  return new HubError({ code, error: err && err.message ? err.message : String(err), exitCode });
}

/** 失败 ⇒ stderr **恰一行** JSON（`{code, error, exit_code}`，层 A 另带 `http_status`）、stdout 保持干净。 */
function fail(err) {
  const hubError = toHubError(err);
  process.stderr.write(`${JSON.stringify(serializeError(hubError))}\n`);
  return hubError.exitCode;
}

/** 用法错误（`2`）：所有本地校验都发生在任何连接 / 请求 / 子进程之前（§5.4 `2` 类的零副作用）。 */
function usageError(message) {
  const { code, exitCode } = classify({ kind: 'usage' });
  return fail(new HubError({ code, error: message, exitCode }));
}

/** 用法（`--help` ⇒ stdout + exit 0，不发连接）：三层清单由同一份 `ENTRIES` 生成。 */
function entryLine(entry) {
  const args = entry.args.map((item) => (item.required ? `<${item.name}>` : `[${item.name}]`)).join(' ');
  const flags = entry.flags.map((flag) => `[--${flag.name}]`).join(' ');
  return `  ${['hub', entry.layer, ...entry.cmd, args, flags].filter((part) => part !== '').join(' ')}`;
}

function writeUsage() {
  const lines = [
    'hub — oamp 统一调用入口（三层封装 + 自检）',
    '',
    '用法:',
    '  hub api  <子命令> [位置参数] [--选项 值] [--human] [--port <n>]',
    "  hub uds  <子命令> [--params '<json 对象>'] [--as <instance-id>] [--human]",
    '  hub cli  <既有命令…>    # hub cli 之后的 token 原样交给 oamp（不解析）',
    '  hub doctor [--human]',
    '',
  ];
  for (const layer of LAYERS) {
    const entries = ENTRIES.filter((entry) => entry.layer === layer);
    lines.push(`${LAYER_TITLE[layer]}（${entries.length} 条）`);
    for (const entry of entries) lines.push(entryLine(entry));
    lines.push('');
  }
  lines.push('doctor（自检，不属于三层封装）', '  hub doctor [--human]');
  process.stdout.write(`${lines.join('\n')}\n`);
}

// ────────────────────────────── 分派与执行 ──────────────────────────────

/** 订阅类条目：逐帧一行 NDJSON；下游截断（stdout EPIPE，`| head -1` 一类）⇒ 结束进程、退出码 `0`（§5.4 `0` 类）。 */
async function runStream(ctx, entry, params, human) {
  const frames = await entry.run(ctx, params);
  const onStdoutError = (err) => {
    // 下游已关闭管道（`| head -1` 一类）：属预期用法（F06 边界 3 / §5.4 `0` 类）⇒ 结束进程、退出码 `0`，
    // SSE 连接随进程结束释放（不留残留进程）。管道语义下 EPIPE 只在**写入**时到达 ⇒ 本分支在下一次写帧时收尾。
    if (err && err.code === 'EPIPE') process.exit(0);
    throw err;
  };
  process.stdout.on('error', onStdoutError);
  try {
    for await (const frame of frames) {
      process.stdout.write(`${human ? renderFrame(frame) : JSON.stringify(frame)}\n`);
    }
  } finally {
    process.stdout.off('error', onStdoutError);
  }
  return 0;
}

/** 层 A / 层 B：查表 → 执行 → 输出。 */
async function runLayer(layer, rest) {
  const entry = matchEntry(layer, rest);
  if (entry === null) {
    return usageError(`未知子命令: ${[layer, ...rest.filter((token) => !token.startsWith('--'))].join(' ')}`);
  }
  const parsed = parseTail(entry, rest.slice(entry.cmd.length));
  if (parsed.error !== undefined) return usageError(parsed.error);
  const { ctx } = createSurface({ port: parsed.port, stdio: 'inherit' }); // 端口缺省链的唯一落点（surface.js）
  const params =
    entry.layer === 'api'
      ? {
          args: parsed.args,
          flags: parsed.flags,
          // 只有声明了 `wait` 的条目接受该选项（§0.4 契约 6）；缺省 1800000 ms，到限 ⇒ WAIT_TIMEOUT / 1
          waitMs: entry.flags.some((flag) => flag.name === 'wait') ? Number(parsed.flags.wait ?? DEFAULT_WAIT_MS) : null,
        }
      : { flags: { params: parsed.jsonParams ?? {} }, as: parsed.as };
  try {
    if (entry.kind === 'stream') return await runStream(ctx, entry, params, parsed.human);
    writeResult(await entry.run(ctx, params), parsed.human);
    return 0;
  } catch (err) {
    return fail(err);
  }
}

/** 层 C：`hub cli` 之后的 token 原样交付（不解析 —— P-2）；退出码原样透传，不重分类。 */
async function runCli(tokens) {
  if (tokens.length === 0) return usageError('hub cli 后缺少既有命令（如 hub cli status）'); // MI-5(a)：不起子进程
  // 11 条既有叶子共用同一 spawn 原语；未命中名面（如 `hub cli bogus`）同样原样透传，由既有 CLI 自己判用法
  const entry = matchEntry('cli', tokens) ?? ENTRIES.find((item) => item.layer === 'cli');
  try {
    const { ctx } = createSurface({ stdio: 'inherit' }); // CLI 面：stdio 继承（TTY 语义与直跑一致）
    const result = await entry.run(ctx, { tokens });
    return typeof result.exit_code === 'number' ? result.exit_code : 1; // 信号终止（null）在进程码面按失败呈现
  } catch (err) {
    return fail(err);
  }
}

/** 第四顶层入口（P-4）：接受面 = 通用选项（§5.5 的 `hub doctor [--human]`）。 */
async function runDoctor(tail) {
  let human = false;
  for (const token of tail) {
    if (token === '--human') {
      human = true;
      continue;
    }
    if (token === '--help') {
      writeUsage();
      return 0;
    }
    return usageError(`doctor 不接受该参数: ${token}`);
  }
  try {
    const { ctx } = createSurface({ stdio: 'inherit' });
    const report = await doctorCheck({ port: ctx.port });
    // 含 fail 项仍退出 `0`：结论由 stdout 的 pass / items 承载（MI-4）；`--human` 走对象渲染器（§5.5）
    process.stdout.write(human ? `${renderObject(report)}\n` : `${JSON.stringify(report)}\n`);
    return 0;
  } catch (err) {
    return fail(err); // hub 不可达 ⇒ 3 + stderr 统一错误（不半跑）
  }
}

/**
 * hub 的 CLI 面入口（跨 PR 接口契约，签名不得改名）：`argv` 已去掉 node / 脚本两项。
 * @param {string[]} argv
 * @returns {Promise<number>} 进程退出码（`main` 只返回数字，不自行 `process.exit`）
 */
export async function main(argv) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const head = tokens[0];
  if (head === undefined) return usageError('缺少层前缀（api / uds / cli / doctor）');
  if (head === '--help') {
    writeUsage();
    return 0;
  }
  if (head === 'doctor') return runDoctor(tokens.slice(1));
  if (head === 'cli') return runCli(tokens.slice(1)); // 层 C：此后一切 token 不解析（P-2 / MI-5(b)）
  if (!LAYERS.includes(head)) return usageError(`未知层: ${head}`);
  if (tokens.includes('--help')) {
    writeUsage(); // 层 A / 层 B 的解析面内任意位置被识别（MI-5(b)）；层 C 之后不识别
    return 0;
  }
  return runLayer(head, tokens.slice(1));
}
