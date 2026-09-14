// M-5 探针：RPC 下「一次受门禁调用」是否恒只产生一道门？（支撑 F05 验收 2「不重不欠」）
// 背景：ACP 链路有**两道**门（结构化 session/request_permission + elicitation 审批门，见 acp-client.js §M4）。
//       需求侧只见 RPC 一道（F6）。本探针用**多次、跨工具层级**的受门禁调用，验证是否恒为「一次调用一道门」。
// 判据：
//   ① 每个 tool_execution_start 的工具调用，恰好对应一个 `extension_ui_request{Allow tool: …}`；
//   ② 门的分组按 title 里的命令 / 路径识别（同一调用不得出现第二道）；
//   ③ 门的形状：method=select、options 恰为 ['Approve','Deny']、是否带 timeout；
//   ④ 门与工具执行的先后（门在前，批准后才有 tool_execution_start）。
// 运行：node probe-m5-gate-count.mjs   （环境变量：OMP_BIN / MODEL）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 180000);

const ARGV = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--thinking', 'off', '--approval-mode', 'always-ask', '--tools=read,bash,write'];
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const timeline = [];
const counts = {};
const gates = [];
const toolStarts = [];
const toolEnds = [];

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
      const t = o.assistantMessageEvent?.type || 'u';
      counts['mu:' + t] = (counts['mu:' + t] || 0) + 1;
    }
    if (o.type === 'tool_execution_start') {
      toolStarts.push({ at: at(), toolCallId: o.toolCallId, toolName: o.toolName, args: JSON.stringify(o.args).slice(0, 160) });
      timeline.push([at(), 'TOOL_START', `${o.toolName} ${JSON.stringify(o.args).slice(0, 80)}`]);
    }
    if (o.type === 'tool_execution_end') {
      toolEnds.push({ at: at(), toolCallId: o.toolCallId, toolName: o.toolName, isError: o.isError === true });
      timeline.push([at(), 'TOOL_END', `${o.toolName} isError=${o.isError === true}`]);
    }
    if (o.type === 'extension_ui_request') {
      const title = String(o.title || '');
      gates.push({ at: at(), id: o.id, method: o.method, title, options: o.options, hasTimeout: Object.hasOwn(o, 'timeout'), timeout: o.timeout, isGate: /^Allow tool:/.test(title) });
      timeline.push([at(), 'GATE', `${o.method} options=${JSON.stringify(o.options)} title=${JSON.stringify(title.slice(0, 100))}`]);
      if (o.method === 'select' || o.method === 'confirm') {
        setTimeout(() => send({ type: 'extension_ui_response', id: o.id, ...(o.method === 'select' ? { value: 'Approve' } : { confirmed: true }) }), 150);
      }
    }
    if (o.type === 'response' && o.success === false) timeline.push([at(), 'ERROR_RESPONSE', JSON.stringify(o).slice(0, 160)]);
    if (o.type === 'agent_end') timeline.push([at(), 'AGENT_END', `isTerminal=${o.isTerminal}`]);

    if (o.type === 'ready') {
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      setTimeout(() => {
        timeline.push([at(), '>>> prompt（2 次 bash + 1 次 write，全部过门）', '']);
        send({
          id: 'p1', type: 'prompt',
          message: '请严格依次做三件事，每件事单独调用一次工具：(1) 用 bash 执行 `echo gate-A`；(2) 用 bash 执行 `echo gate-B`；(3) 用 write 工具把文件 /tmp/oamp-probe-gated.txt 的内容写成 done。做完后只回答 DONE。',
        });
      }, 600);
      setTimeout(() => { timeline.push([at(), '>>> get_state (末态)', '']); send({ id: 'se', type: 'get_state' }); }, 90000);
    }
  }
});
p.stderr.on('data', (d) => timeline.push([at(), 'STDERR', d.toString().trim().slice(0, 200)]));

setTimeout(() => { timeline.push([at(), '>>> end stdin', '']); p.stdin.end(); }, HARD_MS);

p.on('exit', (code) => {
  // 把门按 title 里的命令 / 文件名归一，统计"每个调用几道门"
  const key = (g) => {
    const lines = g.title.split('\n');
    const cmd = lines.find((l) => /^Command:/.test(l));
    const path = lines.find((l) => /\/tmp\//.test(l));
    return (cmd || path || lines.slice(0, 2).join('|')).slice(0, 120);
  };
  const byKey = {};
  for (const g of gates.filter((g) => g.isGate)) {
    const k = key(g);
    byKey[k] = (byKey[k] || 0) + 1;
  }
  console.log('\n===== M-5 结论数据 =====');
  console.log(JSON.stringify({
    probe: 'M-5 RPC 一次受门禁调用是否恒只产生一道门',
    argv: ARGV,
    exitCode: code,
    gateTotal: gates.filter((g) => g.isGate).length,
    nonGateUiRequests: gates.filter((g) => !g.isGate).map((g) => g.method),
    gateOptionSets: [...new Set(gates.filter((g) => g.isGate).map((g) => JSON.stringify(g.options)))],
    gateMethods: [...new Set(gates.filter((g) => g.isGate).map((g) => g.method))],
    gateTimeoutFields: gates.filter((g) => g.isGate).map((g) => ({ hasTimeout: g.hasTimeout, timeout: g.timeout })),
    gatesByCallKey: byKey,
    toolExecStarts: toolStarts.length,
    toolNames: toolStarts.map((t) => t.toolName),
    toolExecEnds: toolEnds.length,
    toolErrors: toolEnds.filter((t) => t.isError).length,
    gates,
    frameCounts: counts,
  }, null, 2));
  console.log('\n===== 时间线 =====');
  for (const r of timeline) console.log(r.join(' | '));
});
