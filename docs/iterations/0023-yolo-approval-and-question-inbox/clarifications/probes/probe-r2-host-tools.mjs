// 探针 R2（0023 阶段 3 · T-05 前置）：RPC 宿主工具（host tool）通路的形态细节。
// K12 已证「通路可跑」，本探针钉死四件事：
//   S1 时序与轮次结算：host_tool_call 之后、host_tool_result 之前，该轮是否在飞？回包延迟期间 omp 是否发别的帧？
//   S2 注册时机：ready 之前发 `set_host_tools` 会怎样？ready 之后发才生效吗？
//   S3 可重复性：同一会话重复发 `set_host_tools` 是替换还是累加？
//   S4 `--no-tools` 下宿主工具是否可用（注册回包 / 工具清单 / 模型能否调用）。
// 复跑：node probe-r2-host-tools.mjs   （HARD_MS 可覆盖单场景硬超时，默认 60000）
import { spawn } from 'node:child_process';

const BIN = process.env.OMP_BIN || '/Users/chenchiyuan/.bun/bin/omp';
const MODEL = process.env.OMP_MODEL || 'deepseek/deepseek-v4-flash';
const HARD_MS = Number(process.env.HARD_MS || 45000);
const TOOL = (name, extra = {}) => ({
  name,
  label: name,
  description: '向用户提问以消除歧义（探针）。',
  parameters: {
    type: 'object',
    properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
    required: ['question'],
    additionalProperties: false,
  },
  ...extra,
});

function scenario(name, argv, steps) {
  return new Promise((resolve) => {
    console.log(`\n========== 场景 ${name}：${argv.slice(0, 4).join(' ')} ==========`);
    const t0 = Date.now();
    const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
    const log = (...parts) => console.log([at(), ...parts].join(' | '));
    const child = spawn(BIN, argv, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    const send = (o) => { try { child.stdin.write(`${JSON.stringify(o)}\n`); } catch { /* 已关闭 */ } };
    const state = { dumpTools: null, hostCalls: 0, agentEndAt: null, promptAt: null, inFlightAfterResponse: null };
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      log('场景结束 exit=', code);
      resolve({ name, state });
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
        if (o.type === 'ready') {
          log('ready protocolVersion=', o.protocolVersion);
          send({ id: 'neg', type: 'negotiate_protocol', protocolVersion: 2 });
          steps.onReady && steps.onReady({ send, log, state, child });
          continue;
        }
        if (o.type === 'response') {
          log('RESP', o.command, JSON.stringify(o.data || o.error || null).slice(0, 240));
          steps.onResponse && steps.onResponse({ send, log, state, o, child, close: closeSoon });
          continue;
        }
        if (o.type === 'host_tool_call') {
          state.hostCalls += 1;
          log('★ host_tool_call #' + state.hostCalls, o.toolName, JSON.stringify(o.arguments));
          steps.onHostToolCall && steps.onHostToolCall({ send, log, state, frame: o, child });
          continue;
        }
        if (o.type === 'agent_end') {
          state.agentEndAt = at();
          log('agent_end isTerminal=', o.isTerminal, '距 prompt', state.promptAt ? `(prompt@${state.promptAt})` : '');
          if (o.isTerminal) { steps.onAgentEnd && steps.onAgentEnd({ send, log, state, frame: o, child }); steps.armClose && steps.armClose(); }
          continue;
        }
        if (o.type === 'extension_ui_request') { log('extension_ui_request', o.method, JSON.stringify(o.title || o.message || '').slice(0, 120)); continue; }
        if (o.type === 'tool_execution_start' || o.type === 'tool_execution_end') { log(o.type, o.toolName); continue; }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => log('STDERR', String(d).trim().slice(0, 200)));
    child.on('exit', (code) => finish(code));
    setTimeout(() => { log('硬超时 → kill'); child.kill(); }, HARD_MS);
    // 轮次收尾后自动收口：关 stdin → 宽限 → kill（否则会话常驻，场景不结束）
    const closeSoon = () => {
      setTimeout(() => {
        try { child.stdin.end(); } catch { /* 已关闭 */ }
        setTimeout(() => child.kill(), 2000);
      }, 600);
    };
    steps.armClose = closeSoon;
    steps.beforeReady && steps.beforeReady({ send, log, state, child });
  });
}

const results = [];

// —— S1：时序 + 轮次结算（tools 开、yolo）——
results.push(await scenario('S1 时序与轮次结算', [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'yolo',
], {
  onReady: ({ send, log }) => {
    setTimeout(() => {
      log('>>> set_host_tools（ready 后 300ms）');
      send({ id: 'ht', type: 'set_host_tools', tools: [TOOL('ask_user')] });
    }, 300);
  },
  onResponse: ({ send, log, state, o }) => {
    if (o.command === 'set_host_tools') {
      log('>>> get_state（看工具清单是否含宿主工具）');
      send({ id: 'st', type: 'get_state' });
      setTimeout(() => {
        state.promptAt = 'now';
        log('>>> prompt（要求调用 ask_user）');
        send({ id: 'r1', type: 'prompt', message: '请调用 ask_user 工具问我一个问题：「优先级？」选项给两个。只做这件事。' });
      }, 300);
    }
  },
  onHostToolCall: ({ send, log, state, frame }) => {
    const callAt = Date.now();
    state.callAt = callAt;
    log('⏳ 故意延迟 8s 回包（观察回包前是否仍在飞 / 是否有其它帧）');
    setTimeout(() => {
      log('回包延迟实测 =', ((Date.now() - callAt) / 1000).toFixed(2) + 's', ' agent_end 是否已发生 =', state.agentEndAt !== null);
      send({ type: 'host_tool_result', id: frame.id, result: { content: [{ type: 'text', text: '用户选择：优先级 = 正确性' }] } });
    }, 8000);
  },
}));

// —— S2：ready 之前发 set_host_tools ——
results.push(await scenario('S2 ready 前注册', [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'yolo',
], {
  beforeReady: ({ send, log }) => {
    log('>>> set_host_tools（**spawn 后立刻、任何 ready 帧之前**）');
    send({ id: 'ht-early', type: 'set_host_tools', tools: [TOOL('ask_user')] });
  },
  onReady: ({ send, log, state }) => {
    setTimeout(() => {
      log('>>> get_state');
      send({ id: 'st', type: 'get_state' });
      setTimeout(() => {
        log('>>> prompt（要求调用 ask_user；若 pre-ready 注册未生效则模型看不到该工具）');
        send({ id: 'r1', type: 'prompt', message: '如果存在名为 ask_user 的工具就调用它问「优先级？」；如果没有该工具，就直接回答「NO_TOOL」。' });
      }, 300);
    }, 300);
  },
}));

// —— S3：重复注册（替换 or 累加）——
results.push(await scenario('S3 重复注册', [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--approval-mode', 'yolo',
], {
  onReady: ({ send, log }) => {
    setTimeout(() => { log('>>> set_host_tools(A: ask_user)'); send({ id: 'htA', type: 'set_host_tools', tools: [TOOL('ask_user')] }); }, 300);
  },
  onResponse: ({ send, log, o, close }) => {
    if (o.command === 'set_host_tools' && o.id === 'htA') {
      setTimeout(() => { log('>>> set_host_tools(B: other_tool)'); send({ id: 'htB', type: 'set_host_tools', tools: [TOOL('other_tool')] }); }, 200);
    }
    if (o.command === 'set_host_tools' && o.id === 'htB') {
      setTimeout(() => { log('>>> get_state（工具清单）'); send({ id: 'st', type: 'get_state' }); }, 200);
    }
    if (o.command === 'get_state' && o.success) {
      log('重复注册后 dumpTools =', JSON.stringify((o.data.dumpTools || []).map((t) => t.name)));
      close();
    }
  },
}));

// —— S4：--no-tools 下宿主工具是否可用 ——
results.push(await scenario('S4 --no-tools', [
  '--mode', 'rpc', '--model', MODEL, '--no-skills', '--no-rules', '--no-session', '--no-tools', '--approval-mode', 'yolo',
], {
  onReady: ({ send, log }) => {
    setTimeout(() => { log('>>> set_host_tools（--no-tools 下）'); send({ id: 'ht', type: 'set_host_tools', tools: [TOOL('ask_user')] }); }, 300);
  },
  onResponse: ({ send, log, o }) => {
    if (o.command === 'set_host_tools') {
      setTimeout(() => { log('>>> get_state（工具清单）'); send({ id: 'st', type: 'get_state' }); }, 200);
      setTimeout(() => {
        log('>>> prompt（要求调用 ask_user）');
        send({ id: 'r1', type: 'prompt', message: '如果存在名为 ask_user 的工具就调用它问「优先级？」（选项两个）；如果没有该工具，直接回答「NO_TOOL」。' });
      }, 500);
    }
  },
}));

console.log('\n===== R2 汇总 =====');
for (const r of results) {
  console.log(r.name, '| dumpTools =', JSON.stringify(r.state.dumpTools), '| host_tool_call 次数 =', r.state.hostCalls, '| agent_end =', r.state.agentEndAt);
}
process.exit(0);
