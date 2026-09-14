// 探针 R1：RPC 模式下 omp 的 `ask` 工具是否存在？提问走哪种帧？
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
const counts = {};
const uiMethods = {};

p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    counts[o.type] = (counts[o.type] || 0) + 1;
    if (o.type === 'extension_ui_request') {
      uiMethods[o.method] = (uiMethods[o.method] || 0) + 1;
      log.push([at(), 'UI_REQ', JSON.stringify({ method: o.method, title: String(o.title || '').slice(0, 80), options: o.options, message: String(o.message || '').slice(0, 80) })]);
    } else if (o.type === 'tool_execution_start' || o.type === 'tool_execution_end') {
      log.push([at(), o.type, o.toolName]);
    } else if (o.type === 'message_update') {
      const t = o.assistantMessageEvent?.type;
      counts['mu:' + t] = (counts['mu:' + t] || 0) + 1;
    } else if (['ready', 'agent_start', 'agent_end', 'turn_start', 'turn_end'].includes(o.type)) {
      log.push([at(), o.type, JSON.stringify(o).slice(0, 120)]);
    }
    if (o.type === 'ready') {
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      setTimeout(() => {
        log.push([at(), '>>> prompt', '']);
        send({ id: 'r1', type: 'prompt', message: '请使用 ask 工具向我提一个问题：「这次改动你希望我优先保证哪一点？」并给出两个选项。只调用 ask 工具，不要做别的。' });
      }, 300);
    }
  }
});
p.stderr.on('data', (d) => log.push([at(), 'STDERR', d.toString().slice(0, 200)]));
function send(o) { p.stdin.write(JSON.stringify(o) + '\n'); }
setTimeout(() => p.stdin.end(), Number(process.env.HARD_MS || 90000));

p.on('exit', (code) => {
  console.log('\n===== R1 结论：RPC 下 ask 工具可用性 =====');
  console.log('exit:', code);
  console.log('extension_ui_request 方法分布:', JSON.stringify(uiMethods));
  console.log('帧计数:', JSON.stringify(counts));
  console.log('\n===== 时间线 =====');
  for (const r of log.slice(0, 40)) console.log(r.join(' | '));
  console.log('... 共', log.length, '条');
});
