// M-1 探针：RPC 会话模型——单个 `omp --mode rpc` 进程能否承载多个会话？
// 问题：现状 ACP 是「一对话一常驻进程 + 一 ACP session」（session/new 返回 sessionId，session/prompt 带 sessionId）。
//       RPC 若同为 1 进程 : 1 会话，则上下文池与 RPC 进程必须 1:1；若可多会话，则应做 1:N。
// 判据（三条同时成立即「1 进程 = 1 会话（同一时刻）」）：
//   ① 会话标识是进程级单值：get_state.sessionId 恒为一个标量，且 prompt 命令不带会话选择参数；
//   ② 运行中再发第二个 prompt：不被开成第二个会话，而是排进同一会话的队列（queuedMessageCount > 0，
//      且最终两条消息都在同一 sessionId 的 messageCount 里）；
//   ③ new_session 是「替换」而非「新增」：切换后 sessionId 变化、旧上下文不再可读。
// 运行：node probe-m1-session-model.mjs   （环境变量：OMP_BIN / MODEL / HARD_MS）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 150000);

const ARGV = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--thinking', 'off'];
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const timeline = [];
const counts = {};
const seen = { prompts: 0, agentStart: 0, agentEnd: 0, sessionIds: [] };
const queueSamples = [];
let lastState = null;

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
    if (o.type === 'agent_start') seen.agentStart += 1;
    if (o.type === 'agent_end') seen.agentEnd += 1;
    if (o.type === 'response' && o.command === 'prompt') seen.prompts += 1;
    if (o.type === 'response' && o.command === 'get_state' && o.data) {
      lastState = o.data;
      queueSamples.push({ at: at(), sessionId: o.data.sessionId, isStreaming: o.data.isStreaming, queued: o.data.queuedMessageCount, messageCount: o.data.messageCount });
      if (!seen.sessionIds.includes(o.data.sessionId)) seen.sessionIds.push(o.data.sessionId);
    }
    if (o.type === 'response' && o.command === 'new_session') {
      logs.push([at(), 'new_session.response', JSON.stringify(o.data)]);
    }
    if (o.type === 'response' && o.command === 'get_last_assistant_text') {
      logs.push([at(), 'get_last_assistant_text.response', JSON.stringify(o.data).slice(0, 200)]);
    }
    if (o.type === 'response' && o.success === false) logs.push([at(), 'ERROR_RESPONSE', JSON.stringify(o).slice(0, 200)]);
    if (o.type === 'message_update') {
      const t = o.assistantMessageEvent?.type || 'u';
      counts['mu:' + t] = (counts['mu:' + t] || 0) + 1;
    }
    if (o.type === 'ready') {
      timeline.push([at(), 'READY', JSON.stringify(o).slice(0, 200)]);
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
      setTimeout(() => { logs.push([at(), '>>> get_state (S1)', '']); send({ id: 's1', type: 'get_state' }); }, 200);
      // ②：运行中并发投两条 prompt（都不带 streamingBehavior）
      setTimeout(() => {
        logs.push([at(), '>>> prompt P1', '']);
        send({ id: 'p1', type: 'prompt', message: '请用 bash 工具执行 `echo M1-P1`，然后说明你执行了什么。' });
      }, 600);
      setTimeout(() => {
        logs.push([at(), '>>> prompt P2（P1 仍在飞）', '']);
        send({ id: 'p2', type: 'prompt', message: '请只回答两个字：收到' });
      }, 2500);
      // 运行中采样两次 get_state，观察 queuedMessageCount / isStreaming / 是否出现第二个 sessionId
      setTimeout(() => { logs.push([at(), '>>> get_state (S2, mid)', '']); send({ id: 's2', type: 'get_state' }); }, 4000);
      setTimeout(() => { logs.push([at(), '>>> get_state (S3, mid)', '']); send({ id: 's3', type: 'get_state' }); }, 9000);
      // ③：两条都落地后，读末轮文本 → new_session → 再读一次
      setTimeout(() => { logs.push([at(), '>>> get_state (S4, after both)', '']); send({ id: 's4', type: 'get_state' }); }, 30000);
      setTimeout(() => { logs.push([at(), '>>> get_last_assistant_text (before new_session)', '']); send({ id: 't1', type: 'get_last_assistant_text' }); }, 31000);
      setTimeout(() => { logs.push([at(), '>>> new_session', '']); send({ id: 'ns', type: 'new_session' }); }, 33000);
      setTimeout(() => { logs.push([at(), '>>> get_state (S5, after new_session)', '']); send({ id: 's5', type: 'get_state' }); }, 36000);
      setTimeout(() => { logs.push([at(), '>>> get_last_assistant_text (after new_session)', '']); send({ id: 't2', type: 'get_last_assistant_text' }); }, 37000);
    }
  }
});
p.stderr.on('data', (d) => logs.push([at(), 'STDERR', d.toString().trim().slice(0, 300)]));
function send(o) { p.stdin.write(JSON.stringify(o) + '\n'); }

setTimeout(() => { logs.push([at(), '>>> end stdin', '']); p.stdin.end(); }, HARD_MS);

p.on('exit', (code) => {
  const m = {
    probe: 'M-1 RPC 会话模型',
    argv: ARGV,
    exitCode: code,
    promptResponses: seen.prompts,
    agentStart: seen.agentStart,
    agentEnd: seen.agentEnd,
    distinctSessionIds: seen.sessionIds,
    sessionIdCount: seen.sessionIds.length,
    stateSamples: queueSamples,
    frameCounts: counts,
  };
  console.log('\n===== M-1 结论数据 =====');
  console.log(JSON.stringify(m, null, 2));
  console.log('\n===== 时间线 =====');
  for (const r of timeline) console.log(r.join(' | '));
  console.log('\n===== 请求 / 响应日志 =====');
  for (const r of logs) console.log(r.join(' | '));
});
