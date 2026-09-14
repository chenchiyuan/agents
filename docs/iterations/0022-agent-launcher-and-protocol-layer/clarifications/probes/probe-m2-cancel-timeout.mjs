// M-2 探针：RPC 的取消与超时语义。
// 问题：`abort` 的作用域是什么？终态事件长什么样、什么时机到？有没有超时参数？
// 判据：
//   ① abort 命令不带任何会话 / 轮次参数（作用域 = 当前进程的唯一会话的当前轮）；
//   ② abort 后确实出现轮次终态事件（agent_end{isTerminal:true}），并且响应先于/不晚于终态；
//   ③ abort 不杀进程：abort 后仍能 get_state、能再开一轮；
//   ④ 空转时 abort 不报错；
//   ⑤ 门（extension_ui_request）自带 timeout 字段 —— 即等待人类裁决有超时面；
//   ⑥ 未应答的门在超时后发生什么（有无 cancel 帧 / 是否自动结算）。
// 运行：node probe-m2-cancel-timeout.mjs   （环境变量：OMP_BIN / MODEL / HARD_MS / GATE_WAIT_MS）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 210000);
const GATE_WAIT_MS = Number(process.env.GATE_WAIT_MS || 45000);

const ARGV = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--thinking', 'off', '--approval-mode', 'always-ask'];
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const timeline = [];
const counts = {};
const marks = {}; // 关键时点
const gates = []; // 门的原始形状
let unansweredGateId = null;
let gateAnswered = false;

const p = spawn(BIN, ARGV, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
console.log('argv:', BIN, ARGV.join(' '));

let buf = '';
const logs = [];
p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { timeline.push([at(), 'PARSE_ERR', line.slice(0, 80)]); continue; }
    counts[o.type] = (counts[o.type] || 0) + 1;
    if (o.type === 'agent_end') marks.agentEnd = [...(marks.agentEnd || []), { at: at(), isTerminal: o.isTerminal }];
    if (o.type === 'agent_start') timeline.push([at(), 'AGENT_START', '']);
    if (o.type === 'response' && o.command === 'abort') marks.abortResponse = at();
    if (o.type === 'response' && o.command === 'abort' && o.success === false) marks.abortFailed = JSON.stringify(o);
    if (o.type === 'response' && o.command === 'get_state' && o.data) {
      timeline.push([at(), 'STATE', `session=${o.data.sessionId} streaming=${o.data.isStreaming} msgs=${o.data.messageCount}`]);
    }
    if (o.type === 'response' && o.command === 'get_last_assistant_text') {
      timeline.push([at(), 'LAST_TEXT', JSON.stringify(o.data).slice(0, 120)]);
    }
    if (o.type === 'extension_ui_request') {
      gates.push({ at: at(), id: o.id, method: o.method, title: String(o.title || '').slice(0, 160), timeout: o.timeout, hasTimeout: Object.hasOwn(o, 'timeout'), options: o.options });
      timeline.push([at(), 'GATE', JSON.stringify({ id: o.id, method: o.method, hasTimeout: Object.hasOwn(o, 'timeout'), timeout: o.timeout })]);
      if (o.method === 'select' && String(o.title || '').startsWith('Allow tool:')) {
        // 第 1 道门：推迟到 GATE_WAIT_MS 之后再答（观察未应答期间发生什么）
        unansweredGateId = o.id;
        marks.gateAt = at();
        setTimeout(() => {
          if (!gateAnswered) {
            gateAnswered = true;
            marks.gateAnsweredAt = at();
            logs.push([at(), '>>> UI_RESP (延迟应答, value=Deny)', o.id]);
            send({ type: 'extension_ui_response', id: o.id, value: 'Deny' });
          }
        }, GATE_WAIT_MS);
      } else if (o.method === 'select' || o.method === 'confirm') {
        setTimeout(() => send({ type: 'extension_ui_response', id: o.id, ...(o.method === 'select' ? { value: 'Approve' } : { confirmed: true }) }), 150);
      }
    }
    if (o.type === 'message_update') {
      const t = o.assistantMessageEvent?.type || 'u';
      counts['mu:' + t] = (counts['mu:' + t] || 0) + 1;
    }
    if (o.type === 'tool_execution_start' || o.type === 'tool_execution_end') timeline.push([at(), o.type, o.toolName || '']);

    if (o.type === 'ready') {
      timeline.push([at(), 'READY', JSON.stringify(o).slice(0, 200)]);
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      // ④ 空转时 abort（无在飞轮次）
      setTimeout(() => { logs.push([at(), '>>> abort (idle, 无在飞轮次)', '']); send({ id: 'ab0', type: 'abort' }); }, 250);
      setTimeout(() => { logs.push([at(), '>>> get_state (空闲后)', '']); send({ id: 's0', type: 'get_state' }); }, 600);
      // ① 起一轮需要工具（必然过门）的对话 → 门到达后不立即答，观察超时面
      setTimeout(() => { logs.push([at(), '>>> prompt (触发门，门到达后延迟应答)', '']); send({ id: 'p1', type: 'prompt', message: '请用 bash 工具执行 `echo m2-gate` 并把输出贴出来。' }); }, 1200);
      // 第二轮：正常起一轮后 abort
      setTimeout(() => { logs.push([at(), '>>> prompt #2 (用于 abort 测试)', '']); send({ id: 'p2', type: 'prompt', message: '请分五步慢慢推理：37 × 41 等于多少？' }); }, Math.max(GATE_WAIT_MS + 8000, 56000));
      setTimeout(() => { logs.push([at(), '>>> abort (idle-mid: 试探空转时点)', '']); send({ id: 'ab2', type: 'abort' }); }, Math.max(GATE_WAIT_MS + 8500, 57000));
      setTimeout(() => { logs.push([at(), '>>> prompt #3 (abort 之后能否再开一轮)', '']); send({ id: 'p3', type: 'prompt', message: '请只回答两个字：继续' }); }, Math.max(GATE_WAIT_MS + 12000, 61000));
      setTimeout(() => { logs.push([at(), '>>> get_state (末态)', '']); send({ id: 'se', type: 'get_state' }); }, Math.max(GATE_WAIT_MS + 30000, 79000));
    }
  }
});
p.stderr.on('data', (d) => logs.push([at(), 'STDERR', d.toString().trim().slice(0, 300)]));
function send(o) { p.stdin.write(JSON.stringify(o) + '\n'); }

setTimeout(() => { logs.push([at(), '>>> end stdin', '']); p.stdin.end(); }, HARD_MS);

p.on('exit', (code) => {
  console.log('\n===== M-2 结论数据 =====');
  console.log(JSON.stringify({
    probe: 'M-2 RPC 取消与超时语义',
    argv: ARGV,
    exitCode: code,
    idleAbortIdleError: marks.abortFailed || null,
    agentEndEvents: marks.agentEnd || [],
    abortResponseAt: marks.abortResponse || null,
    gateAt: marks.gateAt || null,
    gateAnsweredAt: marks.gateAnsweredAt || null,
    gates,
    gateHasTimeoutField: gates.map((g) => g.hasTimeout),
    frameCounts: counts,
  }, null, 2));
  console.log('\n===== 时间线 =====');
  for (const r of timeline) console.log(r.join(' | '));
  console.log('\n===== 请求 / 响应日志 =====');
  for (const r of logs) console.log(r.join(' | '));
});
