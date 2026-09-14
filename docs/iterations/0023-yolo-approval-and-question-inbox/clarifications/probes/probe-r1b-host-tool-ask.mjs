// 探针 R1b：RPC 下 (1) tool dump 里有没有 ask；(2) host_tools 机制能否当「提问通道」
import { spawn } from 'node:child_process';

const BIN = '/Users/chenchiyuan/.bun/bin/omp';
const p = spawn(BIN, ['--mode', 'rpc', '--model', 'deepseek/deepseek-v4-flash',
  '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'yolo'], {
  cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = '';
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const log = [];
let toolNames = null;
let hostCalls = 0;
let phase = 'boot';

p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }

    if (o.type === 'response' && o.command === 'get_state' && o.success) {
      toolNames = (o.data.dumpTools || []).map((t) => t.name);
      log.push([at(), 'get_state.dumpTools', JSON.stringify(toolNames)]);
      log.push([at(), '含 ask 工具?', String(toolNames.includes('ask'))]);
      // 注册 host tool：ask_user
      send({
        id: 'ht', type: 'set_host_tools',
        tools: [{
          name: 'ask_user',
          label: 'Ask User',
          description: '向用户提问以消除需求/方案歧义。返回用户的选择或自由文本。',
          parameters: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
            },
            required: ['question'],
            additionalProperties: false,
          },
        }],
      });
    }
    if (o.type === 'response' && o.command === 'set_host_tools') {
      log.push([at(), 'set_host_tools 回包', JSON.stringify(o).slice(0, 200)]);
      setTimeout(() => {
        log.push([at(), '>>> prompt（要求用它提问）', '']);
        phase = 'prompted';
        send({ id: 'r1', type: 'prompt', message: '我准备开始改代码，但有一个歧义：优先保证「思考过程可见」还是「每次工具调用都要人工批准」？请调用 ask_user 工具问我，选项给这两个。' });
      }, 300);
    }
    if (o.type === 'host_tool_call') {
      hostCalls += 1;
      log.push([at(), '★ host_tool_call', JSON.stringify({ toolName: o.toolName, arguments: o.arguments })]);
      // 回一个结果，模拟用户在收件箱里选了第一项
      setTimeout(() => {
        log.push([at(), '>>> host_tool_result（模拟用户作答）', '']);
        send({ type: 'host_tool_result', id: o.id, result: { content: [{ type: 'text', text: '用户选择：优先保证「思考过程可见」' }] } });
      }, 200);
    }
    if (o.type === 'ready') {
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      setTimeout(() => { log.push([at(), '>>> get_state', '']); send({ id: 'st', type: 'get_state' }); }, 300);
    }
    if (o.type === 'tool_execution_start') log.push([at(), 'tool_execution_start', o.toolName]);
    if (o.type === 'agent_end') log.push([at(), 'agent_end', String(o.isTerminal)]);
  }
});
p.stderr.on('data', (d) => log.push([at(), 'STDERR', d.toString().slice(0, 200)]));
function send(o) { p.stdin.write(JSON.stringify(o) + '\n'); }
setTimeout(() => p.stdin.end(), Number(process.env.HARD_MS || 100000));

p.on('exit', (code) => {
  console.log('\n===== R1b 结论 =====');
  console.log('exit:', code);
  console.log('工具清单含 ask ?', toolNames ? toolNames.includes('ask') : 'n/a');
  console.log('host_tool_call 次数:', hostCalls);
  console.log('\n===== 时间线 =====');
  for (const r of log.slice(0, 30)) console.log(r.join(' | '));
});
