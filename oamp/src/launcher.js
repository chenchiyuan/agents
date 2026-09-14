// src/launcher — L1 启动服务：「怎么起一个 agent 进程」的数据表（profile）+ 唯一 argv 构造 + 子进程 spawn
// （architecture §3.3 L1 / §5.2 profile 字段集 / §5.3 解析链 / §3.4 流 1 ★L1）。
// 叶子级模块：只依赖 node: 内置模块（N10），不 import src 内任何模块，也不被任何既有模块 import（本 PR 零消费方）。
// 键 = (host, protocol/执行方式)：解析链选出 protocol 后按 host 取；oneshot 由「一次性」语义取。
// 唯一真源：omp 的 argv 只在本模块产出（`-p` 与 `--mode rpc` 的 argv 均出自本模块）。

import { spawn } from 'node:child_process';

// 进程内字面量表（L2-13：不新增配置文件 / JSON 文件）；字段集 = §5.2 十三项，无多无少。
// 数据面承载「唯一 argv 差异段」= modeArgs：rpc / acp / oneshot 的其余 flag 段由同一段代码推导。
// omp 三行取值 = §5.2 逐字；claude / codex 两行仅结构与能力位（N1：本迭代不做真实接入，无 bin 探测 / 无实测证据）。
export const PROFILES = {
  'omp:rpc': {
    host: 'omp',
    bin: 'omp',                       // bin 解析：OAMP_OMP_BIN > profile.bin > 'omp'
    modeArgs: ['--mode', 'rpc'],      // ★ 唯一与 acp 不同的 argv 段
    input: 'protocol',                // 提示词走协议（rpc / acp）；oneshot 为 'positional'
    session: false,                   // false ⇒ 追加 --no-session
    skills: false,                    // false ⇒ 追加 --no-skills
    rules: false,                     // false ⇒ 追加 --no-rules
    tools: { mode: 'off' },           // 'off' ⇒ --no-tools；'allow' ⇒ 不传；'list' ⇒ --tools=<csv>
    approval: { mode: 'always-ask', appliesWhen: 'tools-on' }, // 门的存在性由档位决定
    thinking: null,                   // 恒 null = 不传 --thinking（传 off 会使思考增量消失）
    model: null,                      // null ⇒ 由调用方按既有解析链填入
    roleFile: null,
    cwd: null,                        // null ⇒ 子进程 cwd = 进程 cwd（既有形态）
  },
  'omp:acp': {
    host: 'omp',
    bin: 'omp',
    modeArgs: ['acp'],                // ★ 子命令形态
    input: 'protocol',
    session: false,
    skills: false,
    rules: false,
    tools: { mode: 'off' },
    approval: { mode: 'always-ask', appliesWhen: 'tools-on' },
    thinking: null,
    model: null,
    roleFile: null,
    cwd: null,
  },
  'omp:oneshot': {
    host: 'omp',
    bin: 'omp',
    modeArgs: ['-p'],
    input: 'positional',              // 提示词 = argv 末位位置参数
    session: false,
    skills: true,                     // true ⇒ 不追加 --no-skills（复现既有一次性 argv）
    rules: true,                      // true ⇒ 不追加 --no-rules
    tools: { mode: 'off' },
    approval: { mode: 'yolo', appliesWhen: 'always' }, // 既有一致（零行为变更）
    thinking: null,
    model: null,
    roleFile: null,
    cwd: null,
  },
  // 结构项：只承载字段与能力位；新增宿主 = 表内加一行，不动本模块之外的任何源码。
  'claude:acp': {
    host: 'claude',
    bin: 'claude',
    modeArgs: ['--acp'],
    input: 'protocol',
    session: false,
    skills: false,
    rules: false,
    tools: { mode: 'off' },
    approval: { mode: 'always-ask', appliesWhen: 'tools-on' },
    thinking: null,
    model: null,
    roleFile: null,
    cwd: null,
  },
  'codex:acp': {
    host: 'codex',
    bin: 'codex',
    modeArgs: ['--acp'],
    input: 'protocol',
    session: false,
    skills: false,
    rules: false,
    tools: { mode: 'off' },
    approval: { mode: 'always-ask', appliesWhen: 'tools-on' },
    thinking: null,
    model: null,
    roleFile: null,
    cwd: null,
  },
};

/** 取 profile：未知键沿用既有「响亮失败」体例（同 config.js 的 OAMP 配置错误）。 */
function requireProfile(profileKey) {
  if (!Object.hasOwn(PROFILES, profileKey)) {
    throw new Error(`OAMP 配置错误: 未知 profile "${profileKey}"`);
  }
  return PROFILES[profileKey];
}

/**
 * 唯一 argv 构造（L1 判据：`-p` 与 `--mode rpc` 的 argv 均出自本模块）。
 * 签名：buildArgv(profileKey, { model, roleFile, tools, prompt })——未传的 model / roleFile 取 profile 值
 * （null ⇒ 不追加对应 flag）；tools 覆写与 profile.tools 同形（未传即取 profile.tools）。
 * 返回值 = args 数组（不含可执行名，bin 由 spawn 侧按解析链注入）。
 * 次序：modeArgs → skills → rules → tools → session → model → roleFile → approval → positional prompt。
 */
export function buildArgv(profileKey, { model, roleFile, tools, prompt } = {}) {
  const profile = requireProfile(profileKey);
  const toolsSpec = tools === undefined ? profile.tools : tools;
  const modelValue = model === undefined ? profile.model : model;
  const roleFileValue = roleFile === undefined ? profile.roleFile : roleFile;
  const toolsOn = toolsSpec.mode !== 'off';

  const args = [...profile.modeArgs];
  if (profile.skills === false) args.push('--no-skills');
  if (profile.rules === false) args.push('--no-rules');
  if (!toolsOn) {
    args.push('--no-tools');
  } else if (toolsSpec.mode === 'list') {
    // 白名单偏好，不承诺精确集合（D-R5）
    args.push(`--tools=${(toolsSpec.list || []).join(',')}`);
  }
  if (profile.session === false) args.push('--no-session');
  if (modelValue !== null) args.push('--model', modelValue);
  if (roleFileValue !== null) args.push('--append-system-prompt', roleFileValue);
  // appliesWhen='tools-on' ⇒ 仅当工具开时追加；'always' ⇒ 恒追加。档位值只取 profile 值，本模块不改写。
  if (profile.approval.appliesWhen === 'always' || toolsOn) {
    args.push('--approval-mode', profile.approval.mode);
  }
  if (profile.input === 'positional') args.push(prompt);
  return args;
}

/** bin 解析链：OAMP_OMP_BIN > profile.bin > 'omp'（既有 OAMP_OMP_BIN 注入面语义不变）。 */
export function resolveBin(profileKey, env = process.env) {
  const profile = requireProfile(profileKey);
  return env.OAMP_OMP_BIN || profile.bin || 'omp';
}

/**
 * spawn 封装（§3.4 流 1 ★L1）：启动 profile 对应的 agent 子进程并返回句柄。
 * argv 全部来自 buildArgv（本封装不拼任何 flag）；stdin 两态可指定（常驻 'pipe' / 一次性 'ignore'），
 * stdout / stderr 恒为 pipe；data 监听的接线归实现方。
 */
export function spawnAgent(profileKey, { model, roleFile, tools, prompt, stdin = 'pipe' } = {}) {
  const profile = requireProfile(profileKey);
  return spawn(resolveBin(profileKey), buildArgv(profileKey, { model, roleFile, tools, prompt }), {
    cwd: profile.cwd === null ? undefined : profile.cwd,
    stdio: [stdin, 'pipe', 'pipe'],
  });
}
