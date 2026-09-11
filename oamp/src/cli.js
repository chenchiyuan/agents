// src/cli.js — oamp 子命令分发（零依赖手写 argv 解析；architecture §7.1 + demo 任务扩展）
// 职责边界：仅做分发与用法/报错；不读配置（config.js 由各进程模块消费）。

const USAGE = `oamp — 本地多智能体运行时 CLI

用法:
  oamp router start               启动 Router（前台长驻；监听 UDS）
  oamp agent start <instance-id>  启动 agent 节点（前台长驻，可执行 shell 任务）
  oamp status                     查询 Router 拓扑状态（只读）
  oamp task send <instance-id> '<json>'|@file [--as <id>]  指派任务给 agent
  oamp task status <task_id>      查看任务状态与明细
  oamp task list [--state <state>]  列出任务
  oamp task watch <task_id> [--interval <ms>]  轮询任务直到终态
  oamp web start [--port <n>]     启动 Web 控制台（默认 http://127.0.0.1:7788）
  oamp -h | --help                显示本用法并退出

命令:
  router    Router 服务进程（UDS 监听 + 注册表 + 租约扫描 + 任务表）
  agent     节点进程（注册 + 心跳 + SIGINT 注销 + shell 任务执行器）
  status    只读拓扑查询客户端
  task      任务指派与进度查询（主 agent 使用视角）
  web       Web 控制台（对话列表 + 详情 + @agent 派发命令；demo）

参数:
  instance-id  必填；agent 节点唯一标识（≤64 可打印字符）
  task JSON    任务定义：{"command":"echo","args":["hi"],"timeout_ms":30000,"label":"说明"}
`;

function usageError(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
  return 2;
}

// 延迟加载：各命令模块。加载成功后的调用约定：default 导出启动函数，传入分发后剩余 argv。
async function loadAndRun(moduleFile, label, restArgs) {
  let mod;
  try {
    mod = await import(moduleFile);
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
      process.stderr.write(`oamp: ${label} 模块尚未实现（${moduleFile} 不存在）\n`);
    } else {
      process.stderr.write(`oamp: ${label} 模块加载失败: ${err && err.message ? err.message : err}\n`);
    }
    return 1;
  }
  const entry = typeof mod.default === 'function' ? mod.default : null;
  if (!entry) {
    process.stderr.write(`oamp: ${label} 模块入口无效（模块需 default 导出启动函数）\n`);
    return 1;
  }
  try {
    const result = await entry(restArgs);
    return typeof result === 'number' ? result : 0;
  } catch (err) {
    process.stderr.write(`oamp: ${label} 运行失败: ${err && err.message ? err.message : err}\n`);
    return 1;
  }
}

export async function main(argv) {
  if (argv.length === 0) {
    return usageError('错误: 未指定命令');
  }
  const [cmd, sub] = argv;

  if (cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    return 0;
  }

  if (cmd === 'router') {
    if (sub !== 'start') {
      const why = sub === undefined ? '缺少 router 子命令' : `未知的 router 子命令: ${sub}`;
      return usageError(`错误: ${why}`);
    }
    return loadAndRun('./router.js', 'router start', argv.slice(2));
  }

  if (cmd === 'agent') {
    if (sub !== 'start') {
      const why = sub === undefined ? '缺少 agent 子命令' : `未知的 agent 子命令: ${sub}`;
      return usageError(`错误: ${why}`);
    }
    const instanceId = argv[2];
    if (instanceId === undefined) {
      return usageError('错误: missing required argument: instance-id');
    }
    // instance-id 归模块 restArgs[0]（O-1 收敛，2026-09-09 主 agent 裁决 A）
    return loadAndRun('./agent.js', 'agent start', argv.slice(2));
  }

  if (cmd === 'status') {
    return loadAndRun('./status.js', 'status', argv.slice(1));
  }

  if (cmd === 'web') {
    if (sub !== 'start') {
      const why = sub === undefined ? '缺少 web 子命令' : `未知的 web 子命令: ${sub}`;
      return usageError(`错误: ${why}`);
    }
    return loadAndRun('./web.js', 'web start', argv.slice(2));
  }

  if (cmd === 'task') {
    const validSubs = ['send', 'status', 'list', 'watch'];
    if (!validSubs.includes(sub)) {
      const why = sub === undefined ? '缺少 task 子命令' : `未知的 task 子命令: ${sub}`;
      return usageError(`错误: ${why}`);
    }
    if (sub === 'send' && argv[2] === undefined) {
      return usageError('错误: missing required argument: instance-id');
    }
    if ((sub === 'status' || sub === 'watch') && argv[2] === undefined) {
      return usageError('错误: missing required argument: task_id');
    }
    // restArgs 保留子命令：['send'|'status'|'list'|'watch', …]（task 模块自解析剩余参数）
    return loadAndRun('./task.js', `task ${sub}`, argv.slice(1));
  }

  return usageError(`错误: 未知命令: ${cmd}`);
}
