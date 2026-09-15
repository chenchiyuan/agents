// sdk/surface.js — 三层入口表的单点定义（F01~F04 / F14；architecture §2.1 SUR、§4.1 N-3、§5.1 全表、§5.2）
// 一张表两用（§5.2 规则 1）：CLI 面按 `cmd` 查表分派、库面按同一份 `ENTRIES` 装配命名空间 ⇒
//   "某条命令的行为"只写一处，不存在"改一处另一处没变"。
// 名面逐字锁定（A14）：40 条 `cmd` = `oamp/skill/hub.md` 的三层清单（层 A 21 / 层 B 8 / 层 C 11），
//   改名 / 增删立即撞已合并的 `test/sdk-skill.test.js`。
// 分层与 doctor（P-4）：`doctor` 是第四顶层入口，不属于三层封装，不在 `ENTRIES` 的 40 条内
//   （doctor 命名空间由 sdk/index.js 组合，本模块不装配）。
// 每条 = { id, layer, cmd, args, flags, kind, method, path, acceptsAs, run }：
//   · `id` = `<layer>.<cmd.join(' ')>`（唯一，用于 doctor / 用例点名）；`layer` 是分层唯一依据（F14）；
//   · `args` 位置参数声明（顺序 = 路径中 `:param` 出现序；含必填性）；
//   · `flags` 选项声明（`name` 由 API.md 字段名机械推导：`_` → `-`；kind ∈ string/int/json/bool/array，
//     其中 array = §5.1 规则 3 的"数组字段以逗号分隔"；含必填性、不含取值域 —— P-3）；
//   · `method` / `path`：层 A = HTTP 端点（`:` 为路径参数），层 B = Router 方法名，层 C = null；
//   · `kind`：`'result'`（一次调用一个结果）| `'stream'`（订阅，逐帧）；
//   · `run(ctx, params)`：一次调用。params 各层只读自己需要的字段：
//       层 A：{ args: string[], flags: object, waitMs: number|null }
//       层 B：{ flags: { params: object }, as: string|null }
//       层 C：{ tokens: string[] }（`hub cli` 之后的 token **原样**）
// 复用而非重建（§2.3）：HTTP / SSE 全经 ./http.js；UDS 会话全经 ./uds.js；层 C 全经子进程调用既有
//   bin/oamp.js（不改既有模块、不重写任一命令、不建第二套客户端 / 帧编解码 / socket 解析 / argv 库）。
// 零状态（F09 / §0.4 契约 12）：模块级只有 const 表与纯函数；每命令一次连接 / 一次子进程，结束即关；
//   零本地写、零缓存、零自动性（无重试 / 无重连 / 无退避 / 无心跳循环）。
// 路径推导（L2-11 / A11）：包根按 import.meta.url 从 `sdk/` 位置 `..` 推导，与 cwd 无关。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { request, stream } from './http.js';
import { connect as connectUds } from './uds.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 包根 = oamp/
const OAMP_BIN = path.join(PKG_ROOT, 'bin', 'oamp.js'); // 层 C 的被透传对象（既有入口，零改动）
const DEFAULT_PORT = 7788; // Web 默认端口的唯一落点（§5.2 / API.md §1.1 的覆盖链：显式 --port > OAMP_WEB_PORT > 本值）

/** 层前缀（顺序即 §5.1 表序；F14 验收 1/2 的分层判定面）。 */
export const LAYERS = ['api', 'uds', 'cli'];

// ────────────────────────────── 层 A：21 条（`hub api …` ↔ `API.md` §3 的 21 行）──────────────────────────────
// 规则（§5.1）：路径参数 → 位置参数；query / body 字段 → `--<字段名>`；订阅 4 条 `kind: 'stream'`；
//   17 条 `kind: 'result'`。必填性 = 入口表声明（§5.1 规则 4 的本地校验面，判据见 T1 验收 6）。

/** 选项名 → 线上字段名（§5.1 规则 3 的机械逆变换：flag 名由字段名 `_` → `-` 得到，此处还原）。 */
function fieldOf(flagName) {
  return flagName.replaceAll('-', '_');
}

/** 层 A 的一次调用（§2.2 流 1）：路径参数替换 + query / body 分流，之下全走 http.js 的 request / stream。 */
function runApi(ctx, spec, params) {
  const args = params.args ?? [];
  const flags = params.flags ?? {};
  let target = spec.path;
  const query = {};
  const body = {};
  spec.args.forEach((decl, index) => {
    const value = args[index];
    if (value === undefined || value === null) return;
    if (target.includes(`:${decl.name}`)) {
      target = target.replace(`:${decl.name}`, encodeURIComponent(value)); // 路径参数（§5.1 规则 2）
    } else {
      query[decl.name] = value; // 位置参数但不在路径中（`api stream chat <chat_id>` 走 query）
    }
  });
  for (const [name, value] of Object.entries(flags)) {
    if (name === 'wait') continue; // `--wait` 是**本地**等待上限（§5.4 `1` 类 ②），不进 query / body
    if (spec.method === 'GET') query[fieldOf(name)] = value; // GET 的字段走 query（值原样成串，A12）
    else body[fieldOf(name)] = value; // POST 的字段走 body
  }
  const requestSpec = {
    port: ctx.port,
    method: spec.method,
    path: target,
    query: spec.method === 'GET' && Object.keys(query).length > 0 ? query : null,
    body: spec.method === 'GET' || Object.keys(body).length === 0 ? null : body, // 无字段 ⇒ 无请求体（API.md §3.4/§3.5/§3.6）
    waitMs: params.waitMs ?? null,
  };
  return spec.kind === 'stream' ? stream(requestSpec) : request(requestSpec);
}

/** 层 A 条目构造（`run` 由同一工厂产出 ⇒ 21 条的行为只写一处）。 */
function apiEntry(spec) {
  return {
    id: `api.${spec.cmd.join(' ')}`,
    layer: 'api',
    cmd: spec.cmd,
    args: spec.args,
    flags: spec.flags,
    kind: spec.kind ?? 'result',
    method: spec.method,
    path: spec.path,
    acceptsAs: false,
    run: (ctx, params) => runApi(ctx, spec, params),
  };
}

const arg = (name, required = true) => ({ name, required });
const str = (name, required = false) => ({ name, kind: 'string', required });
const int = (name, required = false) => ({ name, kind: 'int', required });
const json = (name, required = false) => ({ name, kind: 'json', required });
const bool = (name, required = false) => ({ name, kind: 'bool', required });
const arr = (name, required = false) => ({ name, kind: 'array', required }); // §5.1 规则 3：数组字段以逗号分隔

const API_ENTRIES = [
  apiEntry({ cmd: ['agents'], method: 'GET', path: '/api/agents', args: [], flags: [str('state')] }),
  apiEntry({
    cmd: ['chats', 'list'],
    method: 'GET',
    path: '/api/chats',
    args: [],
    flags: [
      str('project-id', true),
      str('q'),
      str('agent'),
      str('state'),
      str('from'),
      str('to'),
      str('archived'),
      int('limit'),
      int('offset'),
    ],
  }),
  apiEntry({ cmd: ['chats', 'get'], method: 'GET', path: '/api/chats/:chat_id', args: [arg('chat_id')], flags: [] }),
  apiEntry({ cmd: ['chats', 'close'], method: 'POST', path: '/api/chats/:chat_id/close', args: [arg('chat_id')], flags: [] }),
  apiEntry({ cmd: ['chats', 'archive'], method: 'POST', path: '/api/chats/archive', args: [], flags: [] }),
  apiEntry({ cmd: ['chats', 'activate'], method: 'POST', path: '/api/chats/:chat_id/activate', args: [arg('chat_id')], flags: [] }),
  apiEntry({
    cmd: ['chats', 'rename'],
    method: 'POST',
    path: '/api/chats/:chat_id/rename',
    args: [arg('chat_id')],
    flags: [str('title', true)],
  }),
  apiEntry({
    cmd: ['messages', 'send'],
    method: 'POST',
    path: '/api/messages',
    args: [],
    // 必填面以 `API.md` 的「必填」列为准（A-4 唯一真源 / P-3）：`text` = 是；
    // `chat_id` = 否（省略即自动新建对话）、`agent_id` = 条件必填（可自 `@agent` 前缀解析，属跨字段约束 ⇒ 交服务端）
    flags: [str('chat-id'), str('project-id'), str('agent-id'), str('text', true), str('model'), bool('one-shot')],
  }),
  apiEntry({ cmd: ['stream', 'chat'], method: 'GET', path: '/api/stream', args: [arg('chat_id')], flags: [], kind: 'stream' }),
  apiEntry({ cmd: ['stream', 'events'], method: 'GET', path: '/api/events', args: [], flags: [], kind: 'stream' }),
  apiEntry({ cmd: ['docs'], method: 'GET', path: '/api/docs', args: [], flags: [] }),
  apiEntry({ cmd: ['projects', 'list'], method: 'GET', path: '/api/projects', args: [], flags: [] }),
  apiEntry({
    cmd: ['projects', 'create'],
    method: 'POST',
    path: '/api/projects',
    args: [],
    flags: [str('repo-url', true), str('name')],
  }),
  apiEntry({
    cmd: ['calls', 'create'],
    method: 'POST',
    path: '/api/calls',
    args: [],
    flags: [
      str('chat-id', true),
      str('agent', true),
      str('task'),
      json('tasks'),
      str('context'),
      json('output-schema'),
      str('schema-mode'),
      str('mode'),
      str('model'),
      int('wait'), // 唯一接受 `--wait` 的条目（L2-4；缺省值归 cli.js）
    ],
  }),
  apiEntry({ cmd: ['calls', 'list'], method: 'GET', path: '/api/calls', args: [], flags: [] }),
  apiEntry({
    cmd: ['stream', 'calls'],
    method: 'GET',
    path: '/api/calls/stream',
    args: [],
    flags: [str('chat-id', true)],
    kind: 'stream',
  }),
  apiEntry({
    cmd: ['stream', 'call'],
    method: 'GET',
    path: '/api/calls/:call_id/stream',
    args: [arg('call_id')],
    flags: [],
    kind: 'stream',
  }),
  apiEntry({
    cmd: ['calls', 'transcript'],
    method: 'GET',
    path: '/api/calls/:call_id/transcript',
    args: [arg('call_id')],
    flags: [],
  }),
  apiEntry({ cmd: ['calls', 'get'], method: 'GET', path: '/api/calls/:call_id', args: [arg('call_id')], flags: [] }),
  apiEntry({ cmd: ['confirmations', 'list'], method: 'GET', path: '/api/confirmations', args: [], flags: [] }),
  apiEntry({
    cmd: ['confirmations', 'decide'],
    method: 'POST',
    path: '/api/confirmations/:confirmation_id/decision',
    args: [arg('confirmation_id')],
    flags: [str('option-id'), arr('option-ids'), str('text')], // option_ids 是数组字段（逗号分隔）
  }),
];

// ────────────────────────────── 层 B：8 条（`hub uds …` ↔ Router 的 8 个方法）──────────────────────────────
// 每条绑定一个 Router 方法；`--params` 是唯一入参通道（对象原样进入方法参数）；返回值 = JSON-RPC result 原对象。
// 身份括号（L2-10 / §0.4 契约 7）：`--as` 只被 4 条身份相关方法接受（heartbeat / deregister / send / ack），
//   序列 = connect → register → 单次方法 → best-effort deregister → close；无 `--as` 时**不做身份合成**
//   （CLI 面不为调用方自动注册 —— N3 / L2-9），服务端如实回 UNREGISTERED。

/** 层 B 的 JSON-RPC 入参 → uds.js 会话方法（A13 的会话 API 适配，非第二份命令表）。 */
const UDS_CALLS = {
  'agent.register': (session, params) => session.register(params.instance_id),
  'agent.heartbeat': (session, params) => session.heartbeat(params),
  'agent.deregister': (session) => session.deregister(),
  'message.send': (session, params) => session.send(params),
  'message.ack': (session, params) => session.ack(params),
  'router.status': (session) => session.status(),
  'router.task_get': (session, params) => session.taskGet(params.task_id),
  'router.task_list': (session, params) => session.taskList(params),
};

/** ctx 感知的会话建立（库面 `uds.connect` 与本模块的入口 `run` 共用一处，无第二处默认路径解析）。 */
function connectWithCtx(ctx, opts = {}) {
  return connectUds({ socketPath: ctx.socketPath ?? undefined, env: ctx.env, ...opts });
}

/** 一次身份括号内的会话调用（层 B 的 `run`）。 */
async function runUds(ctx, spec, params) {
  const as = params.as ?? null;
  const body = params.flags?.params ?? {};
  const session = await connectWithCtx(ctx, {});
  let registered = false;
  try {
    if (as !== null) {
      await session.register(as);
      registered = true;
    }
    return await UDS_CALLS[spec.method](session, body);
  } finally {
    if (registered) {
      // best-effort 注销（L2-10）：注销失败不改写本次调用的结果（也不吞掉原错误）
      try {
        await session.deregister();
      } catch {
        /* 已尽力：连接随后关闭，Router 侧按既有租约判活收口 */
      }
    }
    session.close(); // 每命令一连接，结束即关（F09）
  }
}

function udsEntry(spec) {
  return {
    id: `uds.${spec.method}`,
    layer: 'uds',
    cmd: [spec.method], // 名面逐字 = hub.md 的 8 条（cmd 即方法名）
    args: [],
    flags: [],
    kind: 'result',
    method: spec.method,
    path: null,
    acceptsAs: spec.acceptsAs,
    run: (ctx, params) => runUds(ctx, spec, params),
  };
}

const UDS_ENTRIES = [
  udsEntry({ method: 'agent.register', acceptsAs: false }), // 自身即注册
  udsEntry({ method: 'agent.heartbeat', acceptsAs: true }),
  udsEntry({ method: 'agent.deregister', acceptsAs: true }),
  udsEntry({ method: 'message.send', acceptsAs: true }),
  udsEntry({ method: 'message.ack', acceptsAs: true }),
  udsEntry({ method: 'router.status', acceptsAs: false }), // 任意连接可用
  udsEntry({ method: 'router.task_get', acceptsAs: false }),
  udsEntry({ method: 'router.task_list', acceptsAs: false }),
];

// ────────────────────────────── 层 C：11 条（`hub cli …` ↔ 既有 CLI 的 11 个叶子命令）──────────────────────────────
// 零语义变更（P-2 / N4）：`hub cli` 之后的 token **不解析、不重排、不补默认值**，原样交给既有入口；
//   stdout / stderr / 退出码（既有 `0/1/2`）逐字透传（不经 classify 重分类 —— A18）。

/**
 * 层 C 的 spawn 原语（§0.4 契约 2 / L2-1）：`process.execPath` + 包根下的既有 bin，与 cwd 无关。
 * `ctx.stdio === 'inherit'` ⇒ 继承（CLI 面：TTY 语义与直跑一致、长驻命令不劫持调用方进程）；
 * `ctx.stdio === 'capture'` ⇒ 捕获两个流并返回 `{ exit_code, stdout, stderr }`（库面，逐字节保留）。
 * 退出码原样（信号终止时为 Node 的 `code === null`，不发明新码、不抛 HubError）；不重试、不补跑（L2-9）。
 */
function runOampCli(ctx, params) {
  const tokens = params.tokens ?? [];
  const inherit = ctx.stdio === 'inherit';
  const child = spawn(process.execPath, [OAMP_BIN, ...tokens], { stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
  const outDecoder = new StringDecoder('utf8');
  const errDecoder = new StringDecoder('utf8');
  let out = '';
  let errText = '';
  if (!inherit) {
    child.stdout.on('data', (chunk) => {
      out += outDecoder.write(chunk); // 分片可能切开多字节码元 ⇒ 用 StringDecoder 逐字节保真
    });
    child.stderr.on('data', (chunk) => {
      errText += errDecoder.write(chunk);
    });
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject); // 起不来（本地环境问题）→ 由调用方归类，不伪装成成功
    child.once('close', (code) => {
      if (inherit) resolve({ exit_code: code });
      else resolve({ exit_code: code, stdout: out + outDecoder.end(), stderr: errText + errDecoder.end() });
    });
  });
}

// 11 条共用同一原语：条目存在性 / 名面即覆盖面的判据（F04 验收 1），行为只写一处。
const CLI_LEAF_COMMANDS = [
  ['router', 'start'],
  ['agent', 'start'],
  ['status'],
  ['task', 'send'],
  ['task', 'status'],
  ['task', 'list'],
  ['task', 'watch'],
  ['web', 'start'],
  ['cluster', 'up'],
  ['cluster', 'down'],
  ['cluster', 'status'],
];

const CLI_ENTRIES = CLI_LEAF_COMMANDS.map((cmd) => ({
  id: `cli.${cmd.join(' ')}`,
  layer: 'cli',
  cmd,
  args: [],
  flags: [],
  kind: 'result',
  method: null,
  path: null,
  acceptsAs: false,
  run: runOampCli,
}));

/** 三层入口表（恰 40 条；顺序 = 层 A 的 `API.md` §3 行序 ‖ 层 B 表序 ‖ 层 C 表序）。 */
export const ENTRIES = [...API_ENTRIES, ...UDS_ENTRIES, ...CLI_ENTRIES];

// ────────────────────────────── 装配：createSurface ──────────────────────────────

/** 库面一次调用 → 入口的 params（首 `args.length` 个入参是位置参数，其后是选项对象，再后是调用选项）。 */
function libParams(entry, callArgs) {
  const args = callArgs.slice(0, entry.args.length);
  const flags = callArgs[entry.args.length] ?? {};
  const options = callArgs[entry.args.length + 1] ?? {};
  return { args, flags, waitMs: options.waitMs ?? null };
}

/** 由同一份 `ENTRIES` 装配层 A 命名空间（§5.2 规则 1：不存在第二份方法表）。 */
function buildApiNamespace(ctx) {
  const namespace = {};
  for (const entry of ENTRIES) {
    if (entry.layer !== 'api') continue;
    const tokens = entry.cmd;
    let node = namespace;
    for (const token of tokens.slice(0, -1)) {
      node[token] = node[token] ?? {};
      node = node[token];
    }
    node[tokens[tokens.length - 1]] = (...callArgs) => entry.run(ctx, libParams(entry, callArgs));
  }
  return namespace;
}

/**
 * 装配三层命名空间 + 已解析 ctx（§5.2；`doctor` 命名空间由 sdk/index.js 组合，见 P-4 / MI-1）。
 * @param {{port?: number, socketPath?: string, env?: object, stdio?: 'inherit'|'capture'}} [opts]
 * @returns {{ctx: object, api: object, uds: object, cli: object}}
 */
export function createSurface(opts = {}) {
  const env = opts.env ?? process.env;
  // 端口缺省链的**唯一落点**（§0.4 契约 3 / A12：http.js 只接受显式 port）：
  const port = opts.port ?? Number(env.OAMP_WEB_PORT || DEFAULT_PORT);
  const ctx = {
    port,
    socketPath: opts.socketPath ?? null,
    env,
    stdio: opts.stdio === 'inherit' ? 'inherit' : 'capture', // CLI 面 inherit、库面 capture
  };
  const capture = { ...ctx, stdio: 'capture' };
  return {
    ctx,
    api: buildApiNamespace(ctx),
    uds: { connect: (connectOpts = {}) => connectWithCtx(ctx, connectOpts) }, // 会话（A13）
    // 库面层 C：token 原样交给既有命令，捕获输出（§5.2：`hub.cli.run(['status'])` → { exit_code, stdout, stderr }）
    cli: { run: (args) => CLI_ENTRIES[0].run(capture, { tokens: args }) },
  };
}
