// M-4 探针：`host_tool_call` / `host_uri_request` 在默认配置下是否会被触发？
// 问题：决定能力位 `hostTools` 是「必须实现」还是「显式声明不支持」（T-09）。
// 判据：
//   ① 默认（不注册任何宿主工具 / scheme）：跑一轮要求"使用宿主工具 / 读取宿主 URI"的提示，
//      不出现 host_tool_call / host_uri_request；get_state 里也没有宿主工具 ⇒ 默认零触发；
//   ② 反向请求通道本身是活的：默认下 `extension_ui_request`（审批门）确实会上浮（对照组）；
//   ③ 只有宿主**显式注册**后才触发：set_host_tools → 出现 host_tool_call（回 host_tool_result 后工具执行完成）；
//      set_host_uri_schemes → 出现 host_uri_request（回 host_uri_result）。
// 运行：node probe-m4-host-tools.mjs   （环境变量：OMP_BIN / MODEL）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 240000);

// yolo：不产生审批门，隔离宿主工具面（门本身由 M-5 单独取证）
const ARGV = ['--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--thinking', 'off', '--approval-mode', 'yolo', '--tools=read'];
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
const counts = {};
const timeline = [];
const hostToolCalls = [];
const hostUriRequests = [];
const uiRequests = [];
const stateTools = [];
let phase = 'A';

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
    if (o.type === 'tool_execution_start' || o.type === 'tool_execution_end') timeline.push([at(), o.type, o.toolName || '']);
    if (o.type === 'host_tool_call') {
      hostToolCalls.push({ at: at(), phase: phase, id: o.id, toolName: o.toolName, arguments: o.arguments });
      timeline.push([at(), 'HOST_TOOL_CALL', `${o.toolName} ${JSON.stringify(o.arguments).slice(0, 80)}`]);
      send({ type: 'host_tool_result', id: o.id, result: { content: [{ type: 'text', text: `HOST-TOOL-OK:${o.toolName}` }] } });
    }
    if (o.type === 'host_uri_request') {
      hostUriRequests.push({ at: at(), phase: phase, id: o.id, operation: o.operation, url: o.url });
      timeline.push([at(), 'HOST_URI_REQUEST', `${o.operation} ${o.url}`]);
      send({ type: 'host_uri_result', id: o.id, content: `HOST-URI-OK:${o.url}`, contentType: 'text/plain' });
    }
    if (o.type === 'extension_ui_request') {
      uiRequests.push({ at: at(), phase: phase, method: o.method, title: String(o.title || '').slice(0, 120), hasTimeout: Object.hasOwn(o, 'timeout'), timeout: o.timeout });
      timeline.push([at(), 'UI_REQUEST', o.method]);
      if (o.method === 'select' || o.method === 'confirm') setTimeout(() => send({ type: 'extension_ui_response', id: o.id, ...(o.method === 'select' ? { value: 'Approve' } : { confirmed: true }) }), 120);
    }
    if (o.type === 'response' && o.command === 'get_state' && o.data) {
      const tools = Array.isArray(o.data.dumpTools) ? o.data.dumpTools.map((t) => t.name) : null;
      stateTools.push({ at: at(), phase: phase, tools });
      timeline.push([at(), 'STATE', `tools=[${(tools || []).join(',')}] msgs=${o.data.messageCount}`]);
    }
    if (o.type === 'response' && o.success === false) timeline.push([at(), 'ERROR_RESPONSE', JSON.stringify(o).slice(0, 160)]);
    if (o.type === 'agent_end') timeline.push([at(), 'AGENT_END', `isTerminal=${o.isTerminal}`]);

    if (o.type === 'ready') {
      send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });

      // ── 阶段 A：默认（未注册任何宿主能力）下要求"用宿主工具 / 读宿主 URI" ──
      phase = 'A';
      setTimeout(() => { timeline.push([at(), '>>> PHASE A: get_state (默认)', '']); send({ id: 'sa', type: 'get_state' }); }, 300);
      setTimeout(() => { timeline.push([at(), '>>> PHASE A: prompt（要求使用未注册的宿主工具）', '']); send({ id: 'pa', type: 'prompt', message: '请调用名为 probe_host_echo 的工具（参数 text="a"）。如果它不存在，就只回答 NOT-AVAILABLE。' }); }, 800);
      setTimeout(() => { timeline.push([at(), '>>> PHASE A: prompt（要求读取宿主 scheme 的 URI）', '']); send({ id: 'pa2', type: 'prompt', message: '请用 read 工具读取 probe://hello 这个地址，原样贴出结果。' }); }, 30000);

      // ── 阶段 B：显式注册宿主工具后再问同一件事 ──
      phase = 'B';
      setTimeout(() => {
        timeline.push([at(), '>>> PHASE B: set_host_tools（显式注册）', '']);
        send({
          id: 'ht', type: 'set_host_tools', tools: [{
            name: 'probe_host_echo', label: 'Probe Host Echo',
            description: 'Echo text back from the host. Use this tool whenever the user asks for probe_host_echo.',
            parameters: { type: 'object', properties: { text: { type: 'string', description: 'text to echo' } }, required: ['text'] },
          }],
        });
      }, 62000);
      setTimeout(() => { timeline.push([at(), '>>> PHASE B: get_state（注册后）', '']); send({ id: 'sb', type: 'get_state' }); }, 64000);
      setTimeout(() => { timeline.push([at(), '>>> PHASE B: prompt（同一个问题再问一次）', '']); send({ id: 'pb', type: 'prompt', message: '请调用 probe_host_echo 工具，参数 text="b"，然后把它的返回原样贴出来。' }); }, 66000);

      // ── 阶段 C：显式注册宿主 URI scheme 后再读同一地址 ──
      phase = 'C';
      setTimeout(() => {
        timeline.push([at(), '>>> PHASE C: set_host_uri_schemes（显式注册）', '']);
        send({ id: 'hu', type: 'set_host_uri_schemes', schemes: [{ scheme: 'probe', description: 'probe scheme', writable: false }] });
      }, 108000);
      setTimeout(() => { timeline.push([at(), '>>> PHASE C: prompt（同一个 URI 再读一次）', '']); send({ id: 'pc', type: 'prompt', message: '请用 read 工具读取 probe://hello 这个地址，原样贴出结果。' }); }, 110000);
      setTimeout(() => { timeline.push([at(), '>>> PHASE C: get_state（末态）', '']); send({ id: 'sc', type: 'get_state' }); }, 150000);
    }
  }
});
p.stderr.on('data', (d) => timeline.push([at(), 'STDERR', d.toString().trim().slice(0, 200)]));

setTimeout(() => { timeline.push([at(), '>>> end stdin', '']); p.stdin.end(); }, HARD_MS);

p.on('exit', (code) => {
  console.log('\n===== M-4 结论数据 =====');
  console.log(JSON.stringify({
    probe: 'M-4 host_tool_call / host_uri_request 默认是否触发',
    argv: ARGV,
    exitCode: code,
    phaseA_hostToolCalls: hostToolCalls.filter((c) => c.phase === 'A').length,
    phaseB_hostToolCalls: hostToolCalls.filter((c) => c.phase === 'B').length,
    phaseA_uiRequests: uiRequests.filter((c) => c.phase === 'A').length,
    hostToolCalls,
    hostUriRequests,
    uiRequests,
    stateTools,
    frameCounts: counts,
  }, null, 2));
  console.log('\n===== 时间线 =====');
  for (const r of timeline) console.log(r.join(' | '));
});
