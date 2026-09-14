// 探针 R4（0023 阶段 3 · F01/E1 与 K10 例外面）：`--approval-mode yolo` 下工具门的真实分布。
// Y1 默认面：yolo + 工具开 ⇒ 一轮内「write（tier ≥ write）」+「bash」是否**零门**，且工具**确实产生了后果**（E1 裸判据两半句）。
// Y2 用户策略例外（K10）：用 `--config` 临时 overlay 把 `tools.approval.bash` 设为 `prompt` ⇒ yolo 下是否仍产门
//   （overlay 只落在 /tmp，**不触碰 ~/.omp 用户配置**）。
// Y3 用户策略例外（K10）：同法设为 `deny` ⇒ 是否被拦（有无门）。
// 复跑：node probe-r4-yolo-gate.mjs  （HARD_MS 覆盖单场景硬超时，默认 90000）
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 90000);
const DIR = '/tmp/probe-0023-r4';
const OUT = `${DIR}/out.txt`;
mkdirSync(DIR, { recursive: true });

const overlay = (policy) => {
  const file = `${DIR}/overlay-${policy}.yml`;
  writeFileSync(file, `tools:\n  approval:\n    bash: ${policy}\n`, 'utf8');
  return file;
};

function scenario(name, argv, prompt, reply) {
  return new Promise((resolve) => {
    console.log(`\n========== ${name} ==========`);
    rmSync(OUT, { force: true });
    const t0 = Date.now();
    const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
    const log = (...p) => console.log([at(), ...p].join(' | '));
    const child = spawn(BIN, argv, { cwd: DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let done = false;
    const state = { gates: 0, gateTitles: [], toolStarts: [], agentEnd: null, text: '' };
    const finish = (code) => {
      if (done) return;
      done = true;
      state.outFile = existsSync(OUT) ? JSON.stringify(readFileSync(OUT, 'utf8').slice(0, 80)) : null;
      log('场景结束 exit=', code, ' out.txt =', state.outFile);
      resolve({ name, state });
    };
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
        if (o.type === 'extension_ui_request') {
          state.gates += 1;
          state.gateTitles.push(`${o.method}:${String(o.title || '').slice(0, 40)}`);
          log('★ 门 #' + state.gates, o.method, JSON.stringify(o.options), JSON.stringify(String(o.title || '').slice(0, 50)));
          send({ type: 'extension_ui_response', id: o.id, ...reply });
          continue;
        }
        if (o.type === 'tool_execution_start') { state.toolStarts.push(o.toolName); log('tool_execution_start', o.toolName); continue; }
        if (o.type === 'message_update') {
          const ev = o.assistantMessageEvent;
          if (ev && ev.type === 'text_delta' && typeof ev.delta === 'string') state.text += ev.delta;
          continue;
        }
        if (o.type === 'agent_end') {
          state.agentEnd = at();
          log('agent_end isTerminal=', o.isTerminal);
          if (o.isTerminal) {
            setTimeout(() => { try { child.stdin.end(); } catch { /* 关闭 */ } setTimeout(() => child.kill(), 1200); }, 500);
          }
          continue;
        }
        if (o.type === 'response' && o.success === false) { log('RESP failure', o.command, JSON.stringify(o.error || null).slice(0, 200)); continue; }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 240)));
    child.on('exit', (code) => finish(code));
    setTimeout(() => { log('硬超时 → kill'); child.kill(); }, HARD_MS);
    log('>>> prompt');
    setTimeout(() => send({ id: 'r1', type: 'prompt', message: prompt }), 900);
  });
}

const base = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session'];
const results = [];
results.push(await scenario(
  'Y1 yolo（无用户策略）· write + bash',
  [...base, '--approval-mode', 'yolo'],
  `请依次做两件事：① 用 write 工具把 "hello-0023" 写入 ${OUT}；② 用 bash 执行 echo done。不要问我任何问题。`,
  { value: 'Approve' },
));
results.push(await scenario(
  'Y2 yolo + tools.approval.bash=prompt（K10 例外）',
  [...base, '--approval-mode', 'yolo', `--config=${overlay('prompt')}`],
  '请用 bash 执行 echo policy-prompt-probe。只做这一件事。',
  { value: 'Deny' },
));
results.push(await scenario(
  'Y3 yolo + tools.approval.bash=deny（K10 例外）',
  [...base, '--approval-mode', 'yolo', `--config=${overlay('deny')}`],
  '请用 bash 执行 echo policy-deny-probe。只做这一件事。',
  { value: 'Deny' },
));

console.log('\n===== R4 汇总 =====');
for (const r of results) {
  console.log(`${r.name} | 门数=${r.state.gates} ${JSON.stringify(r.state.gateTitles)} | 工具=${JSON.stringify(r.state.toolStarts)} | agent_end=${r.state.agentEnd} | out.txt=${r.state.outFile}`);
  console.log('   末轮文本 =', JSON.stringify(r.state.text.slice(-240)));
}
process.exit(0);
