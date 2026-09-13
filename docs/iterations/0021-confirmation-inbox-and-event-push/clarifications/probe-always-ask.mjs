import { AcpClient } from '/Users/chenchiyuan/projects/agents/oamp/src/acp-client.js';

const audit = [];
const hookCalls = [];
const client = new AcpClient({
  bin: process.env.OAMP_OMP_BIN || 'omp',
  cwd: '/Users/chenchiyuan/projects/agents',
  tools: true,
  permission: 'deny',                 // ⇒ argv: --approval-mode always-ask
  logger: { event: (type, fields) => audit.push({ type, title: fields?.title ?? null }) },
  onPermissionRequest: ({ toolCall, options }) => {
    hookCalls.push({
      title: (toolCall && (toolCall.title || toolCall.kind)) || null,
      options: Array.isArray(options) ? options.map((o) => o && (o.optionId ?? o.id ?? o.name)) : null,
    });
    return 'allow';                   // 让人侧等价裁决 = 放行，观察完整回路
  },
});

let out = { permission: 'deny(⇒always-ask)' };
try {
  await client.start();
  const res = await client.prompt('请用 shell 工具真实执行 echo ALWAYS-ASK-PROBE，并把原始输出告诉我。', { timeoutMs: 180000 });
  out.hookFired = hookCalls.length;
  out.hookCalls = hookCalls;
  out.audit = audit.map((a) => a.type);
  out.text = String(res.text || '').slice(0, 160);
} catch (e) {
  out.error = String(e && (e.code || e.message));
  out.hookFired = hookCalls.length;
  out.hookCalls = hookCalls;
  out.audit = audit.map((a) => a.type);
} finally {
  try { client.kill(); } catch {}
}
console.log(JSON.stringify(out, null, 2));
process.exit(0);
