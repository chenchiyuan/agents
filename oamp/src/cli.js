// src/cli.js — oamp 子命令分发（零依赖手写 argv 解析；architecture §7.1）
// 职责边界：仅做分发与用法/报错；不读配置（config.js 由各进程模块消费，随后续 PR 落地）。

const USAGE = `oamp — 本地多智能体运行时 CLI

用法:
  oamp router start               启动 Router（前台长驻；监听 UDS）
  oamp agent start <instance-id>  启动 agent 节点（前台长驻）
  oamp status                     查询 Router 拓扑状态（只读）
  oamp -h | --help                显示本用法并退出

命令:
  router    Router 服务进程（UDS 监听 + 注册表 + 租约扫描）
  agent     裸协议 agent 节点（注册 + 心跳 + SIGINT 注销）
  status    只读拓扑查询客户端

参数:
  instance-id  必填；agent 节点唯一标识（≤64 可打印字符）
`;

function usageError(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
  return 2;
}

// 延迟加载：router/agent/status 模块随后续 PR（pr-002/003）落地。
// 模块文件缺失时必须清晰报错 + 非零退出，不静默、不挂起。
// 加载成功后的调用约定见 tasks.md 开放项 O-1（default 导出启动函数，传入分发后剩余 argv）。
async function loadAndRun(moduleFile, label, restArgs) {
  let mod;
  try {
    mod = await import(moduleFile);
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
      process.stderr.write(`oamp: ${label} 模块尚未实现（${moduleFile} 不存在；随后续 PR 落地）\n`);
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
    // 分发后剩余 argv（router start 无位置参数）
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
    return loadAndRun('./agent.js', 'agent start', argv.slice(3));
  }

  if (cmd === 'status') {
    return loadAndRun('./status.js', 'status', argv.slice(1));
  }

  return usageError(`错误: 未知命令: ${cmd}`);
}
