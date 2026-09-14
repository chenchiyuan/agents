// 探针 R3b（0023 阶段 3 · F03 验收 3 前置）：RPC 链路上「自动拒绝 + 中止该轮」的三步落点。
// R3 已证：`cancelled:true`（或 `value:'Deny'`）只让该工具被拒、**该轮照常继续到 `agent_end{stopReason:'stop'}`**
//   ⇒ 现状不存在「该轮以 permission_denied 中止」这一观测面；F03 验收 3（MI-02）要求它存在。
// 本探针钉死补上「中止」这一步后 omp 的形态：
//   A1 `{type:'abort'}` 之后是否有终态帧（`agent_end{isTerminal}`）、耗时多少、帧面长什么样；
//   A2 abort 之后**同一会话能否继续下一轮**（决定 rpc 侧「中止该轮」是否等于「杀会话」——ACP 侧只 cancel 不 kill）。
// 复跑：node probe-r3b-abort-semantics.mjs  （HARD_MS 覆盖硬超时，默认 120000）
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 120000);
const DIR = '/tmp/probe-0023-r3b';

rmSync(DIR, { recursive: true, force: true });
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
const log = (...p) => console.log([at(), ...p].join(' | '));

const child = spawn(BIN, [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'always-ask',
], { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });

let buf = '';
let gates = 0;
let aborted = false;
const timeline = [];
const frames = {};
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
    frames[o.type] = (frames[o.type] || 0) + 1;
    if (o.type === 'ready') { send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 }); continue; }
    if (o.type === 'extension_ui_request') {
      if (o.method !== 'select') { send({ type: 'extension_ui_response', id: o.id, cancelled: true }); continue; }
      gates += 1;
      log('★ 门 #' + gates, JSON.stringify(String(o.title || '').slice(0, 40)));
      send({ type: 'extension_ui_response', id: o.id, cancelled: true });
      if (!aborted) {
        aborted = true;
        setTimeout(() => {
          log('>>> 发 {type:"abort"}（幂等无参）');
          send({ type: 'abort' });
        }, 300);
      }
      continue;
    }
    if (o.type === 'agent_end') {
      log('agent_end isTerminal=', o.isTerminal);
      if (o.isTerminal && !timeline.includes('firstEnd')) {
        timeline.push('firstEnd');
        // A2：abort 之后同一会话能否继续下一轮
        setTimeout(() => {
          log('>>> 第二轮 prompt（验证 abort 后会话是否仍可用）');
          send({ id: 'r2', type: 'prompt', message: '只回答两个字：可用' });
        }, 800);
      } else if (o.isTerminal && timeline.includes('firstEnd') && !timeline.includes('secondEnd')) {
        timeline.push('secondEnd');
        log('第二轮也收到终态帧 ⇒ 会话仍可用');
        setTimeout(() => { try { child.stdin.end(); } catch { /* 关闭 */ } setTimeout(() => child.kill(), 1000); }, 500);
      }
      continue;
    }
    if (o.type === 'response') {
      log('RESP', o.command, 'success=', o.success, JSON.stringify(o.error || null).slice(0, 120));
      continue;
    }
    if (o.type === 'turn_end' || o.type === 'turn_start' || o.type === 'agent_start') log(o.type);
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 200)));
child.on('exit', (code) => {
  log('=== 结论 ===');
  log('exit', code, '门数 =', gates, '帧计数 =', JSON.stringify(frames));
  log('timeline =', JSON.stringify(timeline));
});

log('>>> 第一轮 prompt（要求 write，必产门）');
setTimeout(() => send({ id: 'r1', type: 'prompt', message: '请用 write 工具把 "x" 写入 /tmp/probe-0023-r3b/o.txt。只做这一件事。' }), 900);
setTimeout(() => { log('硬超时：kill'); child.kill(); }, HARD_MS);
