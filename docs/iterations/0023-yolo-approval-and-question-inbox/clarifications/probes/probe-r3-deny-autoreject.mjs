// 探针 R3（0023 阶段 3 · T-01 / F03 前置）：`deny` 档在 **RPC 链路**的自动拒绝落点。
// 现状：oamp 的 rpc 链路在 `--permission deny` 下**不注入上浮钩子**（context-pool.js 仅在 permission==='allow' 时注入），
//   于是 rpc-client.js 的 `handleApproval` 走到 `onApproval === null` 分支 ⇒ 回 `{type:'extension_ui_response', cancelled:true}`。
// 本探针要回答：这一回执在 omp 侧意味着什么？该轮是否中止？以什么收尾？与显式 `Deny` 选项回执有何差别？
// 三个场景（均为 always-ask + 工具开，模型被要求写文件 ⇒ tier ≥ write ⇒ 必产门）：
//   D1 回执 `cancelled: true`（= oamp 现状的 auto-reject 落点）
//   D2 回执 `{value:'Deny'}`（= 若钩子显式拒绝时 oamp 会发的回执）
//   D3 回执 `{value:'Approve'}`（对照组：证明门确实可裁决、轮次可继续）
// 复跑：node probe-r3-deny-autoreject.mjs  （HARD_MS 覆盖单场景硬超时，默认 90000）
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 90000);
const PROMPT = '请用 write 工具在 /tmp/probe-0023-r3/out.txt 写入内容 "hello"（若目录不存在先建）。只做这一件事。';

function scenario(name, reply, argv) {
  return new Promise((resolve) => {
    console.log(`\n========== ${name} ==========`);
    rmSync('/tmp/probe-0023-r3', { recursive: true, force: true });
    const t0 = Date.now();
    const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
    const log = (...p) => console.log([at(), ...p].join(' | '));
    const child = spawn(BIN, argv, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let done = false;
    const state = { gates: [], agentEnd: null, stopReason: null, turnText: '', frames: {} };
    const finish = (code) => {
      if (done) return;
      done = true;
      log('场景结束 exit=', code);
      resolve({ name, state });
    };
    const send = (o) => { try { child.stdin.write(`${JSON.stringify(o)}\n`); } catch { /* 关闭 */ } };
    const closeSoon = () => {
      setTimeout(() => {
        try { child.stdin.end(); } catch { /* 关闭 */ }
        setTimeout(() => child.kill(), 1500);
      }, 500);
    };
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
        state.frames[o.type] = (state.frames[o.type] || 0) + 1;
        if (o.type === 'ready') { send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 }); continue; }
        if (o.type === 'extension_ui_request') {
          state.gates.push({ method: o.method, title: String(o.title || '').slice(0, 60), options: o.options });
          log('★ extension_ui_request', o.method, JSON.stringify(o.options), JSON.stringify(String(o.title || '').slice(0, 60)));
          log('  ⇒ 回执 =', JSON.stringify(reply));
          send({ type: 'extension_ui_response', id: o.id, ...reply });
          continue;
        }
        if (o.type === 'message_update') {
          const ev = o.assistantMessageEvent;
          if (ev && ev.type === 'text_delta' && typeof ev.delta === 'string') state.turnText += ev.delta;
          continue;
        }
        if (o.type === 'agent_end') {
          const last = (o.messages || []).filter((m) => m && m.role === 'assistant').pop();
          state.agentEnd = at();
          state.stopReason = last ? last.stopReason : null;
          log('agent_end isTerminal=', o.isTerminal, 'lastAssistant.stopReason =', JSON.stringify(state.stopReason));
          if (o.isTerminal) closeSoon();
          continue;
        }
        if (o.type === 'response' && o.success === false) {
          log('RESP failure', o.command, JSON.stringify(o.error || null).slice(0, 200));
          continue;
        }
        if (o.type === 'tool_execution_start' || o.type === 'tool_execution_end') { log(o.type, o.toolName); continue; }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 200)));
    child.on('exit', (code) => finish(code));
    setTimeout(() => { log('硬超时 → kill'); child.kill(); }, HARD_MS);
    log('>>> prompt（要求 write）');
    setTimeout(() => send({ id: 'r1', type: 'prompt', message: PROMPT }), 800);
  });
}

const base = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session'];
const results = [];
results.push(await scenario('D1 always-ask + 回执 cancelled:true', { cancelled: true }, [...base, '--approval-mode', 'always-ask']));
results.push(await scenario('D2 always-ask + 回执 value:Deny', { value: 'Deny' }, [...base, '--approval-mode', 'always-ask']));
results.push(await scenario('D3 always-ask + 回执 value:Approve', { value: 'Approve' }, [...base, '--approval-mode', 'always-ask']));

console.log('\n===== R3 汇总 =====');
for (const r of results) {
  console.log(`${r.name} | 门数=${r.state.gates.length} | agent_end=${r.state.agentEnd} | stopReason=${JSON.stringify(r.state.stopReason)}`);
  console.log('   帧计数 =', JSON.stringify(r.state.frames));
  console.log('   末轮文本 =', JSON.stringify(r.state.turnText.slice(-260)));
}
process.exit(0);
