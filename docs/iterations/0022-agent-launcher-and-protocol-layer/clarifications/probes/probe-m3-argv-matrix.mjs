// M-3 探针：RPC 模式下 argv 面的完整性。
// 前置：需存在 `/tmp/oamp-probe-role.md`（内容见同目录 `fixture-role.md`，用于 `--append-system-prompt` 生效性验证）。
//   ⚠ 本文件在落盘后**只追加了这两行前置说明**，脚本逻辑未改；`m3-output.txt` 是追加之前（逻辑等价）的运行产物。
// 问题：`--no-skills` / `--no-rules` / `--tools` / `--no-session` / `--append-system-prompt` 在 RPC 模式是否可用？
//       ⇒ 决定一份 profile 字段集能否同时覆盖 rpc 与 acp（T-02）。
// 判据：逐个组合真实启动 `omp --mode rpc <argv...>`，观察 ① 是否发出 ready 帧（可用）；
//       ② 对可观察的开关，用 `get_state` 回读实际生效值（dumpTools / systemPrompt）——不靠"没报错"推结论；
//       ③ 对照组：`omp acp <同一组非 mode 参数>` 是否同样可用（证明差异只在 mode 记号本身）。
// 运行：node probe-m3-argv-matrix.mjs   （环境变量：OMP_BIN / MODEL）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v4-flash';
const MARK = 'OAMP-PROBE-ROLE-MARKER';
const READY_MS = Number(process.env.READY_MS || 15000);

const RPC = (extra) => ['--mode', 'rpc', '--model', MODEL, ...extra];

const CASES = [
  { name: 'rpc/baseline', argv: RPC([]), kind: 'rpc' },
  { name: 'rpc/no-skills+no-rules+no-session', argv: RPC(['--no-skills', '--no-rules', '--no-session']), kind: 'rpc' },
  { name: 'rpc/tools=read,bash', argv: RPC(['--no-skills', '--no-rules', '--no-session', '--tools=read,bash']), kind: 'rpc' },
  { name: 'rpc/no-tools', argv: RPC(['--no-skills', '--no-rules', '--no-session', '--no-tools']), kind: 'rpc' },
  { name: 'rpc/append-system-prompt', argv: RPC(['--no-skills', '--no-rules', '--no-session', '--append-system-prompt=/tmp/oamp-probe-role.md', '--tools=read']), kind: 'rpc' },
  { name: 'rpc/approval-mode+thinking+max-time', argv: RPC(['--no-skills', '--no-rules', '--no-session', '--thinking', 'off', '--approval-mode', 'always-ask', '--max-time', '5m']), kind: 'rpc' },
  { name: 'rpc/cwd-flag', argv: RPC(['--no-skills', '--no-rules', '--no-session', '--cwd=/tmp']), kind: 'rpc' },
  { name: 'rpc/@file-positional(应被拒)', argv: RPC(['--no-skills', '--no-rules', '--no-session', '@/tmp/oamp-probe-role.md']), kind: 'rpc' },
  { name: 'acp/对照组(同一组非 mode 参数)', argv: ['acp', '--no-skills', '--no-rules', '--no-tools', '--no-session', '--model', MODEL, '--append-system-prompt=/tmp/oamp-probe-role.md', '--approval-mode', 'always-ask'], kind: 'acp' },
];

function runCase(c) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
    const result = { name: c.name, argv: [BIN, ...c.argv], kind: c.kind, ready: null, readyAt: null, stderr: '', exit: null, state: null, error: null, frames: {} };
    const p = spawn(BIN, c.argv, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let done = false;
    const finish = (why) => {
      if (done) return;
      done = true;
      result.finishReason = why;
      try { p.stdin.end(); } catch {}
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve(result); }, 1500);
    };
    p.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        result.frames[o.type] = (result.frames[o.type] || 0) + 1;
        if (c.kind === 'rpc' && o.type === 'ready') {
          result.ready = true; result.readyAt = at();
          result.protocolVersion = o.protocolVersion;
          result.supportedProtocolVersions = o.supportedProtocolVersions;
          result.maxFrameBytes = o.maxFrameBytes;
          p.stdin.write(JSON.stringify({ id: 'n', type: 'negotiate_protocol', protocolVersion: 2 }) + '\n');
          p.stdin.write(JSON.stringify({ id: 's', type: 'get_state' }) + '\n');
        }
        if (c.kind === 'rpc' && o.type === 'response' && o.command === 'get_state' && o.data) {
          result.state = {
            sessionId: o.data.sessionId,
            isStreaming: o.data.isStreaming,
            tools: Array.isArray(o.data.dumpTools) ? o.data.dumpTools.map((t) => t.name) : null,
            toolCount: Array.isArray(o.data.dumpTools) ? o.data.dumpTools.length : null,
            systemPromptHasMarker: Array.isArray(o.data.systemPrompt) ? o.data.systemPrompt.join('\n').includes(MARK) : null,
            systemPromptLines: Array.isArray(o.data.systemPrompt) ? o.data.systemPrompt.length : null,
            contextUsage: o.data.contextUsage ? Object.keys(o.data.contextUsage) : null,
          };
          finish('got get_state');
        }
        if (c.kind === 'acp') {
          if (o.id === 'init' && o.result) {
            p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'newsess', method: 'session/new', params: { cwd: '/tmp', mcpServers: [] } }) + '\n');
          }
          if (o.id === 'newsess' && o.result) {
            result.acpSessionId = o.result.sessionId || null;
            result.acpConfigOptions = o.result.configOptions ? JSON.stringify(o.result.configOptions).slice(0, 200) : null;
            finish('got session/new');
          }
        }
      }
    });
    p.stderr.on('data', (d) => { result.stderr += d.toString(); });
    // 非 JSON / 非协议行的兜底：把 raw stdout 也存一份片段（argv 被拒时 omp 会直接打文本）
    p.stdout.on('data', (d) => { result.rawStdout = ((result.rawStdout || '') + d.toString()).slice(0, 800); });

    if (c.kind === 'acp') {
      setTimeout(() => {
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: 1, clientCapabilities: { elicitation: { form: {} } } } }) + '\n');
      }, 700);
    }
    setTimeout(() => finish('timeout ' + READY_MS + 'ms'), READY_MS);
    p.on('exit', (code, sig) => { result.exit = code === null ? 'signal:' + sig : code; if (!done) finish('exited before ready'); });
  });
}

const out = [];
for (const c of CASES) {
  const r = await runCase(c);
  out.push(r);
  console.log('\n----------- ' + c.name);
  console.log(JSON.stringify(r, null, 2));
}
console.log('\n===== M-3 汇总 =====');
console.log(JSON.stringify(out.map((r) => ({
  name: r.name, ready: r.ready, readyAt: r.readyAt, exit: r.exit,
  tools: r.state?.tools || null, systemPromptHasMarker: r.state?.systemPromptHasMarker ?? null,
  acpSessionId: r.acpSessionId || null, stderrHead: (r.stderr || '').trim().split('\n').slice(0, 2).join(' / ').slice(0, 300),
  nonJson: r.nonJsonLines || null, finishReason: r.finishReason,
})), null, 2));
