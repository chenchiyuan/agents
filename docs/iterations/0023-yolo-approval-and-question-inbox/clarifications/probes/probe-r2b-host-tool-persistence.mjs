// 探针 R2b（0023 阶段 3 · T-05 补齐）：宿主工具注册的**跨轮存活**与 `host_tool_cancel` 形态。
// 问题：`set_host_tools` 注册一次后，同一会话的**后续轮次**是否仍能调用该工具？（R2 的 S1 只跑了单轮）
// 次问：轮次/会话终结时，omp 是否会发 `host_tool_cancel`（挂起项收尾的依据）。
// 复跑：node probe-r2b-host-tool-persistence.mjs  （HARD_MS 覆盖硬超时，默认 90000）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 90000);

const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
const log = (...p) => console.log([at(), ...p].join(' | '));

const child = spawn(BIN, [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'yolo',
], { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });

let buf = '';
let calls = { t1: 0, t2: 0 };
let turn = 0;
const send = (o) => { try { child.stdin.write(`${JSON.stringify(o)}\n`); } catch { /* 关闭 */ } };

child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line === '') continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'ready') { send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 }); continue; }
    if (o.type === 'response' && o.command === 'set_host_tools') {
      log('RESP set_host_tools', JSON.stringify(o.data));
      log('>>> 第一轮 prompt');
      turn = 1;
      send({ id: 'p1', type: 'prompt', message: '请调用 ask_user 问我「第一轮的优先级？」。只做这一件事。' });
      continue;
    }
    if (o.type === 'host_tool_call') {
      calls[`t${turn}`] += 1;
      log(`★ 第 ${turn} 轮 host_tool_call`, o.toolName, JSON.stringify(o.arguments));
      send({ type: 'host_tool_result', id: o.id, result: { content: [{ type: 'text', text: `第${turn}轮的答案：A` }] } });
      continue;
    }
    if (o.type === 'host_tool_cancel') { log('★ host_tool_cancel', JSON.stringify(o)); continue; }
    if (o.type === 'agent_end') {
      log(`agent_end(第${turn}轮) isTerminal=`, o.isTerminal);
      if (turn === 1 && o.isTerminal) {
        setTimeout(() => {
          log('>>> 第二轮 prompt（同一会话，未重新注册）');
          turn = 2;
          send({ id: 'p2', type: 'prompt', message: '请再调用 ask_user 问我「第二轮的优先级？」。只做这一件事。' });
        }, 800);
      } else if (turn === 2 && o.isTerminal) {
        log('第二轮也已收尾 ⇒ 宿主工具跨轮存活');
        setTimeout(() => { try { child.stdin.end(); } catch { /* 关闭 */ } setTimeout(() => child.kill(), 1000); }, 500);
      }
      continue;
    }
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 200)));
child.on('exit', (code) => {
  log('=== 结论 ===');
  log('exit', code, '| 第一轮 host_tool_call 次数 =', calls.t1, '| 第二轮 host_tool_call 次数 =', calls.t2);
});

setTimeout(() => {
  log('>>> set_host_tools（握手后注册一次）');
  send({ id: 'ht', type: 'set_host_tools', tools: [{
    name: 'ask_user',
    label: 'Ask User',
    description: '向用户提问以消除歧义。',
    parameters: {
      type: 'object',
      properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
      required: ['question'],
      additionalProperties: false,
    },
  }] });
}, 1200);
setTimeout(() => { log('硬超时：kill'); child.kill(); }, HARD_MS);
