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
const DEFAULT_TIMEOUT_MS = 1800000; // 既有 agent.js DEFAULT_OMP_TIMEOUT_MS 同值

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
  function prompt(text, { model = null, timeoutMs = DEFAULT_TIMEOUT_MS, onDelta = null } = {}) {
    if (closed) return Promise.reject(new ProtocolError('context_crashed', '会话已关闭'));
    if (typeof text !== 'string') {
      return Promise.reject(new ProtocolError('context_crashed', '一次性执行需要提示词文本（非字符串）'));
    }
    const turnModel = readOptionalText(model) ?? readOptionalText(spec.model); // 本轮请求模型 > 常驻解析值
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnAgent(PROFILE, {
          model: turnModel,
          roleFile,
          tools: { mode: toolsOn ? 'allow' : 'off' },
          approval,
          prompt: text,
          stdin: 'ignore', // 既有一次性形态：stdin 不接线
        });
      } catch (err) {
        reject(new ProtocolError('context_crashed', `spawn 失败: ${messageOf(err)}`));
        return;
      }
      current = child;

      let settled = false;
      let timedOut = false;
      let timer = null;
      let reported = 0; // 行数上限的计数（stdout / stderr 共用，既有语义）
      let truncated = false;
      const stdoutLines = [];

      const finish = (err, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        current = null; // 无跨轮状态：本轮句柄即刻释放
        if (err) reject(err);
        else resolve(result);
      };

      // 计时器一律 ref：轮次 Promise（超时结算）与 kill 保证不得依赖其它句柄存活（与 L2 的 rpc 实现同口径）
      timer = setTimeout(() => {
        timedOut = true;
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
      }, timeoutMs);

      /** 行流回收：去 ANSI → 空行跳过 → 200 行上限（超限恰一次截断事件）→ 增量上报（逐行原样）。 */
      const emitLine = (stream) => (rawLine) => {
        const line = stripAnsi(rawLine);
        if (line === '') return;
        if (reported >= MAX_STREAM_LINES) {
          if (!truncated) {
            truncated = true;
            if (typeof onDelta === 'function') {
              onDelta({ event: 'truncated', note: `明细行数超上限（${MAX_STREAM_LINES}），后续行不再逐条上报` });
            }
          }
          return;
        }
        reported += 1;
        if (stream === 'stdout') stdoutLines.push(line);
        if (typeof onDelta === 'function') onDelta({ kind: 'chunk', text: line, stream });
      };
      makeLineReader(child.stdout, emitLine('stdout'));
      makeLineReader(child.stderr, emitLine('stderr'));

      child.on('error', (err) => finish(new ProtocolError('context_crashed', `spawn 错误: ${messageOf(err)}`)));
      child.on('close', (code, signal) => {
        if (timedOut) {
          finish(new ProtocolError('timeout', `一次性执行超时（${timeoutMs}ms）`));
          return;
        }
        if (code !== 0) {
          finish(new ProtocolError('context_crashed', `子进程退出 code=${code === null ? signal || 'killed' : code}`));
          return;
        }
        finish(null, {
          text: stdoutLines.join('\n'), // 本轮 stdout 行流累积（stderr 不计入答案）
          model: turnModel, // 本轮请求模型（未给即 null，不造值）
          stop_reason: null, // 一次性路径无终态帧 ⇒ 不造值（MI-3）
          usage: null, // 同上
          pid: child.pid ?? null, // 本轮子进程
        });
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
