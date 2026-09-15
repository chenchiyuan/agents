// test/helpers/hub-harness.js — hub 子进程测试辅助（architecture §4.1 N-11、§5.3、§5.4；跨 PR 接口契约）
// `runHub(args, { env, input, timeoutMs })` → `{ code, stdout, stderr }`：起 `node <包根>/bin/hub.js`
//   子进程、收集两个流、限时退出（pr-007~pr-010 直接消费该签名 ⇒ 不得改名、不得改返回形状）。
// 包根按 `import.meta.url` 从本文件位置 `..`/`..` 推导（与 helpers/harness.js 的 `OAMP_ROOT` 同口径）⇒ 与 cwd 无关；
//   `cwd` 缺省 = 系统临时目录（结构性证明入口不依赖 cwd —— F13 验收 2/3）。
// `env` = `{ ...process.env, ...opts.env }`：调用方只给增量；本文件**不补**任何默认路径
//   （socket / 库 / 端口一律由调用方经 `env` 传入 —— 临时状态须用绝对临时路径，勿落仓库）。
// `input` 给出 ⇒ 写入 stdin 后 `end()`；未给出 ⇒ `stdin: 'ignore'`（子进程绝不因等 stdin 挂起）。
// 进程组收口（跨 PR 契约，用户 2026-09-15 裁决扩容）：`detached` ⇒ 子进程自成进程组（pgid = 其 pid），
//   一次调用结束（正常或超时）即 SIGKILL 整个进程组 —— 层 C 的长驻 / 派生命令（`web start`、`router start`、
//   `cluster up`）会派生孙进程并持有端口 / 文件，若只收直连子进程会让用例之间相互污染。零自动性：
//   只 SIGKILL，不重试、不重连、不补跑。
// 零本地写（§10 测试基建约束）：本文件零 fs 写 API、零运行态目录字面量，不 import `src/**`。

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // 包根 = oamp/
const HUB_BIN = path.join(PKG_ROOT, 'bin', 'hub.js');
const DEFAULT_TIMEOUT_MS = 10000; // 缺省上限；订阅类用例显式传更大值

/**
 * 跑一次 hub 入口并等它退出（§5.3 / §5.4 的进程面判据面）。
 * @param {string[]} args `hub` 之后的 argv（不含 node 与脚本路径）
 * @param {{env?: object, input?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{code: number|null, stdout: string, stderr: string}>} `code` = 退出码（信号终止时 null）
 */
export async function runHub(args, { env, input, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HUB_BIN, ...args], {
      cwd: os.tmpdir(),
      env: { ...process.env, ...(env ?? {}) },
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      detached: true, // 自成进程组（pgid = 子进程 pid）：一次调用 = 一棵可整体收口的进程树
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk; // 逐片追加：不切行、不截断，未以换行结尾的尾部同样保留
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    // 收口整个进程组（孙进程随调用一并结束）；组已不存在时 `kill` 抛 ESRCH ⇒ 吞掉即已收口
    const killGroup = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* 进程组已不存在（ESRCH）—— 无需再收 */
      }
    };
    const settle = (code) => {
      clearTimeout(timer);
      killGroup(); // 正常路径同样收口：长驻命令即使没超时也不把孙进程留在后台
      resolve({ code, stdout, stderr });
    };
    // 到限强杀整组并等它退出（信号终止的退出码即 null）
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    if (input !== undefined) child.stdin.end(input);
    // 正常路径等两流收口（`close` ⇒ stdout / stderr 逐字节完整）；
    // 超时路径等**子进程退出**即返回：孙进程会持有同一对管道，只等 `close` 会永不返回
    //   —— 冻结契约要求"SIGKILL 后返回"。
    child.once('exit', (code) => {
      if (timedOut) settle(code);
    });
    child.once('close', (code) => settle(code));
  });
}
