// L2 的 rpc 协议实现（默认链路）：帧 ↔ 标准面映射 + 门承接 + 生命周期（本文件 = §3.3 L2 的 rpc 落点）。
// （architecture §5.4 逐帧映射表 / §5.6 门映射 / §5.7 能力位 / §4.2 L2-3 L2-6 L2-8~L2-11 / §3.3 L2 行）
// 进程面：argv 全部经 L1（`launcher.js` 的 `omp:rpc` profile + 唯一 argv 构造 + spawn 封装）产出——
//   本模块内不出现任何 flag 字面量；stdio 三态与宽限常量沿用既有 acp-client 的口径。
// 错误面：一律 ProtocolError（码值 ∈ 五值）。对 ProtocolError / CAPABILITY_KEYS 的引用只在**函数体内**
//   求值（protocol.js 与三个实现模块互有 import，模块顶层求值会命中 ESM 循环导入的 TDZ）。

import { CAPABILITY_KEYS, ProtocolError, readApprovalToolName } from './protocol.js';
import { spawnAgent } from './launcher.js';

const PROFILE = 'omp:rpc';
const PROTOCOL_VERSION = 2; // v2 帧面（ready.supportedProtocolVersions 含 2，实测 M-1 / M-5）
const HANDSHAKE_TIMEOUT_MS = 10000; // 握手上限（体例同 acp-client 的 REQUEST_TIMEOUT_MS）
const DEFAULT_TURN_TIMEOUT_MS = 1800000; // 轮次默认上限（同既有 agent.js DEFAULT_OMP_TIMEOUT_MS）
const CANCEL_GRACE_MS = 2000; // §4.2 L2-8 明文沿用既有值（acp-client 同名常量）
const KILL_GRACE_MS = 500; // SIGTERM → SIGKILL 宽限（同上）
const CLOSE_GRACE_MS = 500; // 关 stdin 后的短宽限（同 KILL_GRACE_MS 量级）
const MAX_REASSEMBLED_BYTES = 67108864; // 逻辑帧上限（ready.maxReassembledFrameBytes 实测；超限丢弃不崩）

// 三类增量子类型 → 标准面 kind（§5.4）；其余 8 子类型（含 *_start / *_end）忽略。
const DELTA_KINDS = { thinking_delta: 'thinking', text_delta: 'chunk', toolcall_delta: 'tool_call' };
// 非审批门的交互类方法（§5.4）：回 `{cancelled:true}`——不代答产品外提问（§4.2 L2-6）；展示类方法与未知
// 方法一律不回执（M-5 实测 setWidget 三帧未回执且轮次正常收尾）。
const INTERACTIVE_METHODS = new Set(['select', 'confirm', 'input', 'editor']);
// RPC 审批门恒二元选项（M-5 实测 `options: ["Approve","Deny"]`）；仅当帧未携带合法选项串数组时兜底。
const RPC_GATE_OPTIONS = ['Approve', 'Deny'];
// ProtocolError 的码值集合（五值逐字，§5.1）：回包带 code 时只接受域内值，否则按命令归类。
const PROTOCOL_ERROR_CODES = new Set(['context_crashed', 'model_unavailable', 'timeout', 'permission_denied', 'context_busy']);

// 能力位（§5.7 的 rpc 列逐字）：键集取自 CAPABILITY_KEYS（不增不减）；非 yes 键必带非空 note（§4.2 L2-12）。
const RPC_CAPABILITY_VALUES = {
  streaming: 'yes',
  thinking: 'yes',
  approvalGate: 'yes',
  hostTools: 'no',
  introspection: 'yes',
  queueControl: 'yes',
};
const RPC_CAPABILITY_NOTES = {
  hostTools: '本迭代不接线宿主工具面：omp 默认不注册宿主工具即不触发（M-4 实测零触发）',
};

/** 常驻协议（rpc）的能力位声明（供注入点的 `capabilities()` 读取；键集与常量单点一致）。 */
export function rpcCapabilities() {
  const table = {};
  for (const key of CAPABILITY_KEYS) table[key] = RPC_CAPABILITY_VALUES[key];
  return table;
}

/** 会话级能力位说明（§5.1 `capabilityNotes`）：任一非 'yes' 键恒有非空字符串。 */
export function rpcCapabilityNotes() {
  const notes = {};
  for (const key of CAPABILITY_KEYS) {
    if (RPC_CAPABILITY_VALUES[key] !== 'yes') notes[key] = RPC_CAPABILITY_NOTES[key];
  }
  return notes;
}

// 计时器口径：本模块的计时器一律 ref——`cancel()` / `prompt()` 返回的 Promise 结算与 kill 保证**不得**依赖
// 其它句柄存活（子进程消亡后事件循环可能只剩该计时器；unref 会让 Promise 永不结算）。acp-client 的 unref
// 体例服务于长驻进程内的请求计时，此处不适用。
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 取字符串或 null（未提供 / 非字符串 ⇒ null；调用方据此不追加对应 flag）。 */
function readOptionalText(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}

function messageOf(value) {
  return value && value.message ? value.message : String(value);
}

/** `tool_execution_update.partialResult` → `content[].text` 拼接；取不到文本 ⇒ null（不造内容，§5.4）。 */
function readPartialText(partial) {
  const content = partial && partial.content;
  if (!Array.isArray(content)) return null;
  const joined = content.map((item) => (item && typeof item.text === 'string' ? item.text : '')).join('');
  return joined === '' ? null : joined;
}

/** 帧内 options（字符串数组）→ 标准面选项形状 `[{optionId}]`；帧未携带时兜底 RPC 恒二元。 */
function readApprovalOptions(options) {
  const offered = Array.isArray(options) ? options.filter((option) => typeof option === 'string' && option !== '') : [];
  return (offered.length > 0 ? offered : RPC_GATE_OPTIONS).map((optionId) => ({ optionId }));
}

/** 钩子裁决值 → 合法 optionId（须在本次门提供的选项内）；否则 null（未裁决）。 */
function readDecidedOptionId(answer, options) {
  const optionId = answer && typeof answer.optionId === 'string' ? answer.optionId : null;
  return optionId !== null && options.some((option) => option.optionId === optionId) ? optionId : null;
}

/** 回包失败 → ProtocolError：`code` 取域内值，缺失时按命令归类（§5.4；并发误用 ⇒ context_busy）。 */
function protocolErrorFromResponse(frame) {
  const raw = frame.code;
  const fromFrame = typeof raw === 'string' && PROTOCOL_ERROR_CODES.has(raw) ? raw : null;
  const classified =
    frame.command === 'prompt' && /already processing/i.test(String(frame.error ?? '')) ? 'context_busy' : 'context_crashed';
  const detail = typeof frame.error === 'string' && frame.error !== '' ? frame.error : JSON.stringify(frame.error ?? null);
  return new ProtocolError(fromFrame ?? classified, `rpc ${frame.command ?? '?'} 失败: ${detail}`);
}

/** 末条 assistant 消息（终态帧字段来源：`stopReason` / `usage`，M-2b 实测）。 */
function lastAssistant(messages) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i] && messages[i].role === 'assistant') return messages[i];
  }
  return null;
}

/**
 * 开会话（常驻通道）：经 L1 起 `omp:rpc` 子进程 → 握手（`ready` → `negotiate_protocol{2}` → 校验回包）后返回
 * 会话对象（四动作 + 能力位 / `pid`）。握手失败即 kill 并抛 ProtocolError。
 * @returns {Promise<object>} 会话对象
 */
export async function createRpcSession({ resident = {}, logger = null, hooks = null } = {}) {
  const spec = resident && typeof resident === 'object' ? resident : {};
  const model = readOptionalText(spec.model); // 进程 argv 落定的模型（本实现无轮次级模型切换，见 prompt）
  const roleFile = readOptionalText(spec.roleFile);
  const toolsOn = spec.tools === true; // 工具开关只在 argv 决定（§4.3 口径）
  const child = spawnAgent(PROFILE, { model, roleFile, tools: { mode: toolsOn ? 'allow' : 'off' } });

  let buf = '';
  let dead = false;
  let closed = false;
  let killed = false;
  let abortSent = false;
  let ready = null; // 握手的结算器（{resolve, reject}）
  let turn = null; // 在飞轮次（M-1：1 进程 = 1 会话 = 1 在飞轮次）
  let pauseDepth = 0; // 门挂起深度（> 0 ⇒ 轮次计时冻结，§4.2 L2-9）
  let nextId = 0;
  const chunkParts = new Map(); // rpc_chunk 分片重组表（chunkId → {count, parts, bytes}）

  function send(frame) {
    if (dead || !child.stdin || child.stdin.destroyed) throw new ProtocolError('context_crashed', 'rpc stdin 不可写');
    child.stdin.write(`${JSON.stringify(frame)}\n`);
  }

  /** 帧处理器内的发送一律 best-effort（子进程可能已不可写；抛错会变成未捕获异常）。 */
  function trySend(frame) {
    try {
      send(frame);
      return true;
    } catch {
      return false;
    }
  }

  /** SIGTERM → KILL_GRACE_MS 未退则 SIGKILL（幂等；沿用既有 kill 模式）。 */
  function kill() {
    if (killed) return;
    killed = true;
    try {
      child.stdin.end();
    } catch {
      /* 已关闭 */
    }
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

  function clearTurnTimer(active) {
    if (!active.timer) return;
    clearTimeout(active.timer);
    active.timer = null;
  }

  function armTurnTimer(active, timeoutMs) {
    active.remainingMs = timeoutMs;
    active.deadline = Date.now() + timeoutMs;
    active.timer = setTimeout(() => onTurnTimeout(active), timeoutMs);
  }

  /** 门挂起：冻结本轮的剩余计时（§4.2 L2-9——门等待不计入轮次超时）。 */
  function freezeTurnTimer() {
    pauseDepth += 1;
    const active = turn;
    if (!active || !active.timer) return;
    active.remainingMs = Math.max(0, active.deadline - Date.now());
    clearTurnTimer(active);
  }

  function thawTurnTimer() {
    if (pauseDepth === 0) return;
    pauseDepth -= 1;
    if (pauseDepth > 0) return;
    const active = turn;
    if (!active || active.timer) return;
    active.deadline = Date.now() + active.remainingMs;
    active.timer = setTimeout(() => onTurnTimeout(active), active.remainingMs);
  }

  function settleTurn(active, result) {
    if (turn !== active) return;
    turn = null;
    clearTurnTimer(active);
    active.resolve(result);
  }

  function failTurn(active, err) {
    if (turn !== active) return;
    turn = null;
    clearTurnTimer(active);
    active.reject(err);
  }

  /** 轮次超时（L2-8 / M-2）：rpc 无协议级超时 ⇒ ① abort（幂等）→ ② 等终态宽限 → ③ kill。 */
  async function onTurnTimeout(active) {
    if (!abortSent) {
      abortSent = true;
      trySend({ type: 'abort' });
    }
    await delay(CANCEL_GRACE_MS);
    kill();
    failTurn(active, new ProtocolError('timeout', `轮次超时（${active.timeoutMs}ms）`));
  }

  /** 增量出口：只投给在飞轮次（无收件人则丢弃，不累积、不崩）。 */
  function emitDelta(active, payload) {
    if (typeof active.onDelta !== 'function') return;
    active.onDelta(payload);
  }

  function onReady(frame) {
    if (ready === null) return; // 重复 ready 帧：忽略
    trySend({ type: 'negotiate_protocol', protocolVersion: PROTOCOL_VERSION });
    logger?.event('RPC_READY', { pid: child.pid, protocolVersion: frame.protocolVersion ?? null });
  }

  function onResponse(frame) {
    if (frame.command === 'negotiate_protocol') {
      const settle = ready;
      ready = null;
      if (settle === null) return;
      const version = frame.data && frame.data.protocolVersion;
      if (frame.success === true && version === PROTOCOL_VERSION) settle.resolve();
      else {
        settle.reject(
          new ProtocolError(
            'context_crashed',
            `协议版本协商失败（期望 ${PROTOCOL_VERSION}，回包 ${JSON.stringify({ success: frame.success ?? null, protocolVersion: version ?? null })}）`,
          ),
        );
      }
      return;
    }
    if (frame.success === true) {
      // §5.4 / §4.2 L2-3：prompt 的受理回包**只记受理**，不结算轮次（F04 验收 2）。
      if (frame.command === 'prompt' && turn) turn.accepted = true;
      return;
    }
    // §5.4：`response{success:false}` ⇒ ProtocolError；可归属在飞轮次时结算为失败，否则登记（不抛、不崩）。
    const err = protocolErrorFromResponse(frame);
    if (frame.command === 'prompt' && turn) {
      failTurn(turn, err);
      return;
    }
    logger?.event('RPC_ERROR_RESPONSE', { pid: child.pid, command: frame.command ?? null, error: err.message });
  }

  function onMessageUpdate(frame) {
    const event = frame.assistantMessageEvent;
    const kind = event && DELTA_KINDS[event.type];
    if (kind === undefined) return; // 其余子类型忽略
    const delta = event.delta;
    if (typeof delta !== 'string' || delta === '') return; // 空 delta 跳过（M-2b：首个 toolcall delta 可为空串）
    const active = turn;
    if (!active) return;
    if (kind === 'chunk') active.chunks.push(delta); // 思考 / 工具参数不计入答案（§5.1）
    emitDelta(active, { kind, text: delta });
  }

  function onToolExecutionUpdate(frame) {
    const text = readPartialText(frame.partialResult);
    if (text === null) return; // 取不到文本即跳过
    const active = turn;
    if (!active) return;
    emitDelta(active, { kind: 'tool_output', text });
  }

  function onAgentEnd(frame) {
    if (frame.isTerminal !== true) return; // 非终态帧：不结算，继续等下一个终态帧（§5.4）
    const active = turn;
    if (active === null) return;
    const last = lastAssistant(frame.messages);
    settleTurn(active, {
      text: active.chunks.join(''),
      model: model ?? null,
      stop_reason: last && last.stopReason !== undefined ? last.stopReason : null,
      usage: last && last.usage !== undefined ? last.usage : null,
      pid: child.pid ?? null,
    });
  }

  /** 审批门承接（§5.6）：钩子返回未结算 Promise 期间冻结轮次计时；裁决值须在本次门的选项内。 */
  async function handleApproval(frame, toolName) {
    const onApproval = hooks && typeof hooks.onApproval === 'function' ? hooks.onApproval : null;
    if (onApproval === null) {
      // 无收件人（消费层未提供钩子）⇒ 不代答放行，也不把子进程吊死
      trySend({ type: 'extension_ui_response', id: frame.id, cancelled: true });
      return;
    }
    const options = readApprovalOptions(frame.options);
    freezeTurnTimer();
    let optionId = null;
    try {
      optionId = readDecidedOptionId(
        await onApproval({
          kind: 'tool_approval',
          toolCall: { toolName, title: frame.title }, // title 原样多行（截断由既有消费面负责，A13）
          options,
        }),
        options,
      );
    } catch {
      optionId = null; // 钩子抛错：绝不代答放行
    } finally {
      thawTurnTimer();
    }
    if (optionId === null) trySend({ type: 'extension_ui_response', id: frame.id, cancelled: true });
    else trySend({ type: 'extension_ui_response', id: frame.id, value: optionId });
  }

  function onUiRequest(frame) {
    const toolName = frame.method === 'select' ? readApprovalToolName(frame.title) : null;
    if (toolName !== null) {
      void handleApproval(frame, toolName); // 双重过滤 ⇒ 一次受门禁调用恰一道门（M-5「不重不欠」）
      return;
    }
    if (INTERACTIVE_METHODS.has(frame.method)) {
      trySend({ type: 'extension_ui_response', id: frame.id, cancelled: true });
    }
    // 展示类（setWidget / setStatus / setTitle / set_editor_text / notify / open_url / cancel）与未知方法：不回执
  }

  /** `rpc_chunk{chunkId,index,count,byteLength,data}` → 逻辑帧：先重组、再按 §5.4 处理。 */
  function reassemble(frame) {
    const chunkId = frame.chunkId;
    if (typeof chunkId !== 'string' && typeof chunkId !== 'number') return null;
    const data = frame.data;
    if (typeof data !== 'string' || data === '') return null;
    let entry = chunkParts.get(chunkId);
    if (entry === undefined) {
      if (!Number.isInteger(frame.count) || frame.count <= 0) return null;
      entry = { count: frame.count, parts: new Map(), bytes: 0 };
      chunkParts.set(chunkId, entry);
    }
    entry.bytes += typeof frame.byteLength === 'number' && frame.byteLength >= 0 ? frame.byteLength : data.length;
    entry.parts.set(Number.isInteger(frame.index) ? frame.index : entry.parts.size, data);
    if (entry.bytes > MAX_REASSEMBLED_BYTES) {
      chunkParts.delete(chunkId); // 超逻辑帧上限：丢弃该逻辑帧（不崩、不产生下游增量）
      return null;
    }
    if (entry.parts.size < entry.count) return null; // 重组未完成：不产生下游增量
    chunkParts.delete(chunkId);
    const parts = [];
    for (let i = 0; i < entry.count; i += 1) {
      const part = entry.parts.get(i);
      if (part === undefined) return null; // 缺片：丢弃
      parts.push(part);
    }
    try {
      return JSON.parse(parts.join(''));
    } catch {
      return null;
    }
  }

  function handleFrame(frame) {
    if (closed) return; // EOF 后晚到的帧：容忍（不崩、不产生增量、不产生未捕获异常）
    switch (frame.type) {
      case 'ready':
        onReady(frame);
        return;
      case 'response':
        onResponse(frame);
        return;
      case 'message_update':
        onMessageUpdate(frame);
        return;
      case 'tool_execution_update':
        onToolExecutionUpdate(frame);
        return;
      case 'agent_end':
        onAgentEnd(frame);
        return;
      case 'extension_ui_request':
        onUiRequest(frame);
        return;
      case 'rpc_chunk': {
        const logical = reassemble(frame);
        if (logical) handleFrame(logical);
        return;
      }
      default:
        return; // tool_execution_start / tool_execution_end / available_commands_update / 未知 type：忽略不崩
    }
  }

  function drain() {
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line === '') continue;
      let frame;
      try {
        frame = JSON.parse(line);
      } catch {
        logger?.event('RPC_BAD_FRAME', { pid: child.pid, line: line.slice(0, 200) });
        continue;
      }
      if (frame && typeof frame === 'object') handleFrame(frame);
    }
  }

  /** 子进程消亡（异常退出 / 主动 kill）：握手中与在飞轮次一并失败收尾（失败码沿用既有语义 = context_crashed）。 */
  function onProcessGone(detail) {
    dead = true;
    const settle = ready;
    ready = null;
    if (settle) settle.reject(new ProtocolError('context_crashed', detail));
    if (turn) failTurn(turn, new ProtocolError('context_crashed', detail));
  }

  const readyPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ready = null;
      reject(new ProtocolError('context_crashed', `rpc 握手超时（${HANDSHAKE_TIMEOUT_MS}ms）未就绪`));
    }, HANDSHAKE_TIMEOUT_MS);
    ready = {
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    };
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
    buf += data;
    drain();
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => {
    // 子进程 stderr 是诊断面（不进增量流；体例同 acp-client 的 ACP_STDERR）
    logger?.event('RPC_STDERR', { pid: child.pid, line: String(data).trim().slice(0, 500) });
  });
  child.on('error', (err) => onProcessGone(`子进程错误: ${messageOf(err)}`));
  child.on('close', (code, signal) => onProcessGone(`子进程退出 code=${code} signal=${signal || ''}`));

  try {
    await readyPromise;
  } catch (err) {
    kill();
    throw err;
  }

  /**
   * 一轮提示：发 `{id, type:'prompt', message}`；受理回包只记受理；终态帧（`agent_end{isTerminal:true}`）结算。
   * 本实现无轮次级模型切换命令（§5.4 未列）⇒ `opts.model` 不参与本轮；返回的 `model` 恒为进程 argv 落定的
   * 模型（未传即 null，不造值）。
   * @param {string} text
   * @param {{model?: string|null, timeoutMs?: number, onDelta?: function|null}} [opts]
   * @returns {Promise<{text:string, model:string|null, stop_reason:*, usage:*, pid:number|null}>}
   */
  function prompt(text, { timeoutMs = DEFAULT_TURN_TIMEOUT_MS, onDelta = null } = {}) {
    if (closed) return Promise.reject(new ProtocolError('context_crashed', '会话已关闭'));
    if (dead) return Promise.reject(new ProtocolError('context_crashed', '子进程已退出'));
    if (turn) return Promise.reject(new ProtocolError('context_busy', '上一轮尚未结算（1 进程 = 1 在飞轮次）'));
    return new Promise((resolve, reject) => {
      const active = {
        resolve,
        reject,
        chunks: [],
        onDelta,
        accepted: false,
        timeoutMs,
        remainingMs: timeoutMs,
        deadline: 0,
        timer: null,
      };
      turn = active;
      abortSent = false; // 新一轮：abort 的幂等作用域随之重置
      armTurnTimer(active, timeoutMs);
      try {
        send({ id: (nextId += 1), type: 'prompt', message: text });
      } catch (err) {
        failTurn(active, err instanceof ProtocolError ? err : new ProtocolError('context_crashed', messageOf(err)));
      }
    });
  }

  /**
   * 显式取消（§4.2 L2-8）：发**无参** `{type:'abort'}`（无 id / 无其它字段）且**幂等**（重复调用不产生第二帧）
   * ⇒ 等终态宽限 `CANCEL_GRACE_MS` ⇒ 超宽限 kill。
   */
  async function cancel({ graceMs = CANCEL_GRACE_MS } = {}) {
    if (!abortSent) {
      abortSent = true;
      trySend({ type: 'abort' });
    }
    await delay(graceMs);
    kill();
  }

  /** 关闭并回收（§4.2 L2-10）：关 stdin ⇒ 短宽限 ⇒ kill；幂等；EOF 后晚到的帧由帧处理器容忍。 */
  function close() {
    if (closed) return;
    closed = true;
    try {
      child.stdin.end();
    } catch {
      /* 已关闭 */
    }
    setTimeout(() => kill(), CLOSE_GRACE_MS);
  }

  return {
    prompt,
    cancel,
    close,
    get capabilities() {
      return rpcCapabilities();
    },
    get capabilityNotes() {
      return rpcCapabilityNotes();
    },
    get pid() {
      return child.pid ?? null;
    },
    // 审计 context_id 由消费层按既有公式（`ctx-<pid>-<generation>`，context-pool.js:133）生成 ⇒ L2 不复制该公式
    get contextId() {
      return null;
    },
  };
}
