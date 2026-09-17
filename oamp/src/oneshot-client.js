// L2 的一次性执行实现（无会话语义）：每轮一个独立子进程，不建会话、不累积上下文（本文件 = §3.3 L2 的 oneshot 落点）。
// （architecture §3.4 流 3 / §5.7 oneshot 能力位 / §4.2 L2-7 / §5.2 `omp:oneshot` profile / §3.3 L2 行
//  「不持有会话状态」；argv 与行流回收自既有 `agent.js:190-199` / `:236-250` 逐字承接。）
// 进程面：argv 全部经 L1（`launcher.js` 的 `omp:oneshot` profile + 唯一 argv 构造 + spawn 封装）产出——
//   本模块内不出现任何 flag 字面量；stdin 恒 `'ignore'`（既有一次性形态），stdout / stderr 为 pipe。
// 档位段（`--approval-mode`）= **唯一汇聚点的解析值**（§5.1 / L1-1）：本模块只消费 `spec.approval`
//   （`createProtocolLayer` 装配前求值一次并写回），经 L1 的 `approval` 入参落 argv（flag 字面量仍单点在 L1）；
//   工具关 ⇒ 传 `null`（无档位段）。
// 错误面：一律 ProtocolError。对 ProtocolError / CAPABILITY_KEYS 的引用只在**函数体内**求值（互有 import 的 TDZ）。

import { CAPABILITY_KEYS, ProtocolError } from './protocol.js';
import { spawnAgent } from './launcher.js';

const PROFILE = 'omp:oneshot';
const MAX_STREAM_LINES = 200; // 既有 agent.js 同值（逐字承接：行数上限）
const KILL_GRACE_MS = 500; // 既有一次性路径 SIGTERM → SIGKILL 宽限

// 能力位（§5.7 的 oneshot 列逐字）：`streaming` 降级（仅进程 stdout 行流，无结构化 delta 面），其余 'no'。
const ONESHOT_CAPABILITY_VALUES = {
  streaming: 'degraded',
  thinking: 'no',
  approvalGate: 'no',
  hostTools: 'no',
  introspection: 'no',
  queueControl: 'no',
};
const ONESHOT_CAPABILITY_NOTES = {
  streaming: '仅进程 stdout / stderr 行流（无结构化 delta 面）：逐行文本，行数上限 200',
  thinking: '一次性文本输出无思考块（`-p` 形态无 thinking 增量）',
  approvalGate: '本实现不承接审批门（无反向请求通道）；档位段由唯一汇聚点的解析值经 argv 落定（工具关 ⇒ 无该段）',
  hostTools: '本迭代不接线宿主工具面（omp 默认不注册即不触发）',
  introspection: '无会话状态面（不建会话，无 state / stats 回读）',
  queueControl: '无插话 / 排队控制（一次性执行，两轮之间不续接）',
};

/** 去 ANSI 转义（omp / 子进程输出可能带色码；逐字承接既有 agent.js 的实现与豁免注释）。 */
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

/** 逐行读流（逐字承接既有 agent.js 的 makeLineReader：`\r` 去除、末行无换行也上报）。 */
function makeLineReader(stream, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, i).replace(/\r$/, ''));
      buf = buf.slice(i + 1);
    }
  });
  stream.on('end', () => {
    if (buf.length > 0) onLine(buf);
  });
}

/** 取字符串或 null（未提供 / 空串 ⇒ null；调用方据此不追加对应 flag）。 */
function readOptionalText(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}

function messageOf(value) {
  return value && value.message ? value.message : String(value);
}

/** 会话级能力位（§5.1 `capabilities`）：键集取自 CAPABILITY_KEYS（不增不减），取值 ∈ {yes, no, degraded}。 */
function oneshotCapabilities() {
  const table = {};
  for (const key of CAPABILITY_KEYS) table[key] = ONESHOT_CAPABILITY_VALUES[key];
  return table;
}

/** 会话级能力位说明（§5.1 `capabilityNotes`）：任一非 'yes' 键恒有非空字符串（L2-12）。 */
function oneshotCapabilityNotes() {
  const notes = {};
  for (const key of CAPABILITY_KEYS) {
    if (ONESHOT_CAPABILITY_VALUES[key] !== 'yes') notes[key] = ONESHOT_CAPABILITY_NOTES[key];
  }
  return notes;
}

/**
 * 一次性执行会话（**不持有跨轮状态**）：`prompt` 每轮 spawn 一个独立子进程，退出即结算；
 * 无会话建立、无上下文续接、无 `contextId`（§3.4 流 3）。
 * @returns {object} 会话对象（四动作 + 能力位 / `pid`）
 */
export function createOneshotSession({ resident = {} } = {}) {
  const spec = resident && typeof resident === 'object' ? resident : {};
  const roleFile = readOptionalText(spec.roleFile);
  const toolsOn = spec.tools === true; // 工具开关只在 argv 决定（与既有一次性形态同向）
  // §5.1：档位值由唯一汇聚点在装配前解析一次并写回 `spec.approval`（本模块零判定、零取值字面）；
  // 工具关 ⇒ `null` ⇒ argv 无档位段（既有「工具关不追加」口径逐字保留）。
  const approval = toolsOn ? spec.approval : null;

  let current = null; // 本轮子进程句柄（无跨轮状态：结算后清空）
  let closed = false;

  /**
   * 一轮一次性执行：`-p` 形态（提示词 = argv 末位位置参数）。
   * @param {string} text 提示词（非字符串 ⇒ 拒绝：**不得**让 argv 末位出现字面 `undefined`）
   * @param {{model?: string|null, timeoutMs?: number, onDelta?: function|null}} [opts]
   * @returns {Promise<{text:string, model:string|null, stop_reason:null, usage:null, pid:number|null}>}
   */
  function prompt(text, { model = null, timeoutMs = null, idleMs = null, netMs = null, onDelta = null } = {}) {
    if (closed) return Promise.reject(new ProtocolError('context_crashed', '会话已关闭'));
    if (typeof text !== 'string') return Promise.reject(new ProtocolError('context_crashed', '一次性执行需要提示词文本（非字符串）'));
    const turnModel = readOptionalText(model) ?? readOptionalText(spec.model);
    return new Promise((resolve, reject) => {
      let child;
      try { child = spawnAgent(PROFILE, { model: turnModel, roleFile, tools: { mode: toolsOn ? 'allow' : 'off' }, approval, prompt: text, stdin: 'ignore' }); }
      catch (err) { reject(new ProtocolError('context_crashed', `spawn 失败: ${messageOf(err)}`)); return; }
      current = child;
      let settled = false;
      let timedOut = false;
      let timeoutKind = null;
      let timeoutValue = null;
      let timer = null;
      let idleTimer = null;
      let netTimer = null;
      let reported = 0;
      let truncated = false;
      const stdoutLines = [];
      const clearTimers = () => { if (timer) clearTimeout(timer); if (idleTimer) clearTimeout(idleTimer); if (netTimer) clearTimeout(netTimer); timer = idleTimer = netTimer = null; };
      const kill = () => { try { child.kill('SIGTERM'); } catch {} setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, KILL_GRACE_MS); };
      const triggerTimeout = (kind, ms) => { if (timedOut) return; timedOut = true; timeoutKind = kind; timeoutValue = ms; kill(); };
      const resetIdleTimer = () => {
        if (timedOut || (Number.isInteger(timeoutMs) && timeoutMs > 0) || !(Number.isInteger(idleMs) && idleMs > 0)) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => triggerTimeout('idle', idleMs), idleMs);
      };
      if (Number.isInteger(timeoutMs) && timeoutMs > 0) timer = setTimeout(() => triggerTimeout('timeout', timeoutMs), timeoutMs);
      else { if (Number.isInteger(netMs) && netMs > 0) netTimer = setTimeout(() => triggerTimeout('net', netMs), netMs); resetIdleTimer(); }
      const finish = (err, result) => { if (settled) return; settled = true; clearTimers(); current = null; if (err) reject(err); else resolve(result); };
      const emitLine = (stream) => (rawLine) => {
        const line = stripAnsi(rawLine); if (line === '') return;
        if (reported >= MAX_STREAM_LINES) { if (!truncated) { truncated = true; resetIdleTimer(); onDelta?.({ event: 'truncated', note: `明细行数超上限（${MAX_STREAM_LINES}），后续行不再逐条上报` }); } return; }
        reported += 1; if (stream === 'stdout') stdoutLines.push(line); resetIdleTimer(); onDelta?.({ kind: 'chunk', text: line, stream });
      };
      makeLineReader(child.stdout, emitLine('stdout')); makeLineReader(child.stderr, emitLine('stderr'));
      child.on('error', (err) => finish(new ProtocolError('context_crashed', `spawn 错误: ${messageOf(err)}`)));
      child.on('close', (code, signal) => {
        if (timedOut) { const ms = timeoutValue; const label = timeoutKind === 'idle' ? `一次性执行空闲超时（空闲 ${ms}ms）` : timeoutKind === 'net' ? `一次性执行安全网超时（累计 ${ms}ms）` : `一次性执行超时（${ms}ms）`; const err = new ProtocolError('timeout', label); err.timeoutMs = ms; finish(err); return; }
        if (code !== 0) { finish(new ProtocolError('context_crashed', `子进程退出 code=${code === null ? signal || 'killed' : code}`)); return; }
        finish(null, { text: stdoutLines.join('\n'), model: turnModel, stop_reason: null, usage: null, pid: child.pid ?? null });
      });
    });
  }
  /** 取消本轮在飞子进程（SIGTERM → KILL_GRACE_MS → SIGKILL）；当前无在飞进程即空操作。 */
  function cancel() {
    const child = current;
    if (child === null) return;
    try {
      child.kill('SIGTERM');
    } catch {
      /* 已退出 */
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* 已退出 */
      }
    }, KILL_GRACE_MS);
  }

  /** 关闭会话（幂等）：一次性实现无长驻进程 ⇒ 只回收在飞子进程并拒绝后续轮次。 */
  function close() {
    if (closed) return;
    closed = true;
    cancel();
  }

  return {
    prompt,
    cancel,
    close,
    get capabilities() {
      return oneshotCapabilities();
    },
    get capabilityNotes() {
      return oneshotCapabilityNotes();
    },
    get pid() {
      return current ? current.pid ?? null : null; // 只在轮次在飞时有进程
    },
    get contextId() {
      return null; // 无会话语义：无上下文标识（恒 null）
    },
  };
}
