// 探针 A2（0023 阶段 3 · M-1）：ACP 链路「agent 主动提问」的端到端帧面。
// 目标：钉死 `ask` → `elicitation/create` 的 requestedSchema 形状（单/多问、单选/多选、每题自由文本字段命名、
//   与 `Approve|Deny` 审批门表单的区分方式），以及「齐答后一次性回包」在客户端侧需要的状态与回包内容形状。
// 形态：真实 `omp acp` 子进程 + NDJSON JSON-RPC（与 oamp/src/acp-client.js 同协议面）。
// 复跑：node probe-a2-acp-ask-form.mjs   （HARD_MS 可覆盖硬超时，默认 150000）
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const CWD = process.env.PROBE_CWD || '/tmp/probe-0023-a2';
const HARD_MS = Number(process.env.HARD_MS || 150000);
mkdirSync(CWD, { recursive: true });

const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
const log = (...parts) => console.log([at(), ...parts].join(' | '));

const child = spawn(BIN, [
  'acp', '--no-skills', '--no-rules', '--no-session', '--model', MODEL, '--approval-mode', 'yolo',
], { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] });

let buf = '';
let sessionId = null;
let elicitSeen = 0;
let promptSettled = false;
const frames = [];

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}
function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function onMessage(message) {
  if (message.method === 'session/update') return; // 流式增量：本探针不关心
  if (message.method === 'session/request_permission') {
    const options = (message.params && message.params.options) || [];
    const pick = options.find((o) => /allow/i.test(o.optionId)) || options[0];
    log('REQ session/request_permission → 回 allow', JSON.stringify(pick && pick.optionId));
    respond(message.id, { outcome: { outcome: 'selected', optionId: pick && pick.optionId } });
    return;
  }
  if (message.method === 'elicitation/create') {
    elicitSeen += 1;
    const params = message.params || {};
    log(`★ REQ elicitation/create #${elicitSeen} mode=${params.mode} sessionId=${params.sessionId}`);
    log('  message =', JSON.stringify(params.message));
    log('  requestedSchema =', JSON.stringify(params.requestedSchema));
    frames.push(params);

    const props = (params.requestedSchema && params.requestedSchema.properties) || {};
    // 审批门形态（properties.value.enum 含 Approve|Deny）⇒ 回 Approve；否则视为提问表单 ⇒ 组内齐答后一次性回包
    const value = props.value;
    if (value && Array.isArray(value.enum) && value.enum.includes('Approve') && value.enum.includes('Deny')) {
      log('  ⇒ 判定为审批门表单（value.enum = Approve|Deny）→ 回 accept/Approve');
      respond(message.id, { action: 'accept', content: { value: 'Approve' } });
      return;
    }
    const keys = Object.keys(props);
    log('  提问表单 keys =', JSON.stringify(keys));
    // 构造一次「选项 + 自由文本并存」的作答：检验 omp 侧 selectedOptions / customInput 的取舍规则
    const content = {};
    const qKeys = keys.filter((k) => !k.endsWith('__other'));
    for (const [index, key] of qKeys.entries()) {
      const prop = props[key];
      if (prop.type === 'array') {
        const labels = ((prop.items && prop.items.anyOf) || []).map((e) => e.const);
        content[key] = labels.slice(0, 2); // 多选：选前两项
        content[`${key}__other`] = index === 0 ? '多选题的补充文本' : '';
      } else {
        const options = (prop.oneOf || []).map((e) => e.const);
        content[key] = options[options.length - 1] || 'x'; // 单选：选最后一项
        content[`${key}__other`] = index === 0 ? '单选题的补充文本' : '';
      }
    }
    for (const key of keys) if (!(key in content)) content[key] = '';
    log('  ⇒ 组内一次性回包 content =', JSON.stringify(content));
    respond(message.id, { action: 'accept', content });
    return;
  }
  if (message.id !== undefined && message.id !== null && message.method === undefined) {
    // 我方请求的响应
    if (message.error) {
      log('RESP ERROR', JSON.stringify(message).slice(0, 400));
      return;
    }
    const rid = message.id;
    if (rid === 1) {
      log('RESP initialize', JSON.stringify(message.result).slice(0, 300));
      send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: CWD, mcpServers: [] } });
      return;
    }
    if (rid === 2) {
      sessionId = message.result && message.result.sessionId;
      log('RESP session/new sessionId =', sessionId, ' model =', JSON.stringify((message.result && message.result.models) || null));
      if (!sessionId) { log('无 sessionId，终止'); child.kill(); return; }
      const text = [
        '请调用 ask 工具，用**一次**调用问我三个问题（questions 数组三项）：',
        '1) id="q1"，question="优先保证哪一点？"，options=[{"label":"思考过程可见"},{"label":"工具调用可审批"}]（单选，不设 multi）',
        '2) id="q2"，question="要改哪些文件？"，options=[{"label":"web.js"},{"label":"agent.js"},{"label":"rpc-client.js"}]，multi=true（多选）',
        '3) id="q3"，question="备注写什么？"，options=[{"label":"无"},{"label":"有"}]（单选）',
        '只做这一件事，不要调用其它工具。收到结果后，请把你**逐问收到的答案原样复述**出来（每题分别列出：选中项文本、自定义/其它文本），不要额外解释。',
      ].join('\n');
      log('>>> session/prompt（要求一次三问）');
      send({ jsonrpc: '2.0', id: 3, method: 'session/prompt', params: { sessionId, prompt: [{ type: 'text', text }] } });
      return;
    }
    if (rid === 3) {
      promptSettled = true;
      log('RESP session/prompt stopReason =', JSON.stringify(message.result && message.result.stopReason));
      return;
    }
    return;
  }
  log('OTHER', JSON.stringify(message).slice(0, 300));
}

child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line === '') continue;
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    if (message.method === 'session/update') {
      const update = message.params && message.params.update;
      if (update && update.sessionUpdate === 'agent_message_chunk' && update.content && typeof update.content.text === 'string') {
        process.stdout.write(update.content.text);
      }
      continue;
    }
    onMessage(message);
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 300)));
child.on('exit', (code, signal) => {
  log('=== 结论 ===');
  log('exit', code, signal);
  log('elicitation/create 次数 =', elicitSeen);
  log('session/prompt 已结算 =', promptSettled);
  for (const [index, params] of frames.entries()) {
    log(`帧#${index + 1} requestedSchema =`, JSON.stringify(params.requestedSchema));
  }
});

log('spawn', BIN, '（cwd =', CWD, '）');
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1, clientCapabilities: { elicitation: { form: {} } } } });

setTimeout(() => { log('硬超时：kill'); child.kill(); }, HARD_MS);
