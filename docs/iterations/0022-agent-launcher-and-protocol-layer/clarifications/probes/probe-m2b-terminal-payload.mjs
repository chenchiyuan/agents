// M-2b 探针：轮次终态帧的完整载荷 + 思考增量（支撑 T-04 的返回值字段与 E3 的前置条件）。
// 问题：
//   ① `agent_end` 帧除 isTerminal 外带什么？能否从它取到 stop_reason（不额外发 get_messages）？
//   ② 不传 `--thinking off` 时思考增量是否稳定出现（E3「轮次结束前可见思考增量」的前置条件）？
//   ③ `message_update.assistantMessageEvent` 各子类型的字段形状（text/thinking/toolcall delta）。
// 运行：node probe-m2b-terminal-payload.mjs   （环境变量：OMP_BIN / MODEL / HARD_MS）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 60000);
// 注意：**不传** --thinking（默认档）——acp 现状 argv 亦不传该参数
const ARGV = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session'];

const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const counts = {};
const firstDelta = {};
const agentEnds = [];
const evSamples = {};
const timeline = [];

const p = spawn(BIN, ARGV, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
console.log('argv:', BIN, ARGV.join(' '));
const send = (o) => p.stdin.write(JSON.stringify(o) + '\n');

let buf = '';
p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    counts[o.type] = (counts[o.type] || 0) + 1;
    if (o.type === 'message_update') {
      const ev = o.assistantMessageEvent || {};
      const t = ev.type || 'u';
      counts['mu:' + t] = (counts['mu:' + t] || 0) + 1;
      if (firstDelta[t] === undefined) firstDelta[t] = at();
      if (evSamples[t] === undefined) {
        // 只留字段名 + delta 前 40 字（不整包落盘）
        const keys = Object.keys(ev);
        evSamples[t] = { keys, delta: typeof ev.delta === 'string' ? ev.delta.slice(0, 40) : null, contentIndex: ev.contentIndex };
      }
      if (t === 'thinking_delta' && timeline.length < 40) timeline.push([at(), 'THINKING_DELTA', JSON.stringify(String(ev.delta || '').slice(0, 40))]);
      if (t === 'text_delta' && timeline.length < 40) timeline.push([at(), 'TEXT_DELTA', JSON.stringify(String(ev.delta || '').slice(0, 40))]);
    }
    if (o.type === 'tool_execution_update') {
      const pr = o.partialResult;
      const keys = pr && typeof pr === 'object' ? Object.keys(pr) : [];
      const contentKinds = pr && Array.isArray(pr.content) ? pr.content.map((c) => c && c.type) : null;
      timeline.push([at(), 'TOOL_UPDATE', `keys=${JSON.stringify(keys)} contentKinds=${JSON.stringify(contentKinds)}`]);
    }
    if (o.type === 'tool_execution_end') {
      const r = o.result;
      timeline.push([at(), 'TOOL_END', `keys=${JSON.stringify(r && typeof r === 'object' ? Object.keys(r) : [])}`]);
    }
    if (o.type === 'agent_end') {
      const msgs = Array.isArray(o.messages) ? o.messages : null;
      const lastAssistant = msgs ? [...msgs].reverse().find((m) => m && m.role === 'assistant') : null;
      agentEnds.push({
        at: at(),
        frameKeys: Object.keys(o),
        isTerminal: o.isTerminal,
        messageCount: msgs === null ? null : msgs.length,
        lastAssistantKeys: lastAssistant ? Object.keys(lastAssistant) : null,
        lastStopReason: lastAssistant ? (lastAssistant.stopReason ?? null) : null,
        lastUsageKeys: lastAssistant && lastAssistant.usage ? Object.keys(lastAssistant.usage) : null,
      });
      timeline.push([at(), 'AGENT_END', `isTerminal=${o.isTerminal} msgs=${msgs === null ? 'n/a' : msgs.length}`]);
    }
    if (o.type === 'response' && o.success === false) timeline.push([at(), 'ERROR_RESPONSE', JSON.stringify(o).slice(0, 160)]);

    if (o.type === 'ready') {
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      setTimeout(() => { timeline.push([at(), '>>> prompt（含多步推理 + 一次工具调用）', '']); send({ id: 'p1', type: 'prompt', message: '请分三步推理 13×17 是多少（把推理过程写出来），然后用 bash 执行 `echo m2b` 并贴出输出。' }); }, 500);
    }
  }
});
p.stderr.on('data', (d) => timeline.push([at(), 'STDERR', d.toString().trim().slice(0, 200)]));
setTimeout(() => { timeline.push([at(), '>>> end stdin', '']); p.stdin.end(); }, HARD_MS);

p.on('exit', (code) => {
  console.log('\n===== M-2b 结论数据 =====');
  console.log(JSON.stringify({
    probe: 'M-2b 终态帧载荷 + 思考增量',
    argv: ARGV,
    exitCode: code,
    agentEnds,
    firstDeltaAt: firstDelta,
    assistantEventSamples: evSamples,
    frameCounts: counts,
  }, null, 2));
  console.log('\n===== 时间线 =====');
  for (const r of timeline) console.log(r.join(' | '));
});
