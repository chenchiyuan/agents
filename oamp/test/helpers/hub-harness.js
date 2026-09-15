// test/helpers/hub-harness.js — hub 子进程测试辅助（architecture §4.1 N-11、§5.3、§5.4；跨 PR 接口契约）
// `runHub(args, { env, input, timeoutMs })` → `{ code, stdout, stderr }`：起 `node <包根>/bin/hub.js`
//   子进程、收集两个流、限时退出（pr-007~pr-010 直接消费该签名 ⇒ 不得改名、不得改返回形状）。
// 包根按 `import.meta.url` 从本文件位置 `..`/`..` 推导（与 helpers/harness.js 的 `OAMP_ROOT` 同口径）⇒ 与 cwd 无关；
//   `cwd` 缺省 = 系统临时目录（结构性证明入口不依赖 cwd —— F13 验收 2/3）。
// `env` = `{ ...process.env, ...opts.env }`：调用方只给增量；本文件**不补**任何默认路径
//   （socket / 库 / 端口一律由调用方经 `env` 传入 —— 临时状态须用绝对临时路径，勿落仓库）。
// `input` 给出 ⇒ 写入 stdin 后 `end()`；未给出 ⇒ `stdin: 'ignore'`（子进程绝不因等 stdin 挂起）。
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
    const settle = (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    // 到限强杀并等它退出（信号终止的退出码即 null）；不走重试 / 不补跑 —— 零自动性
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    if (input !== undefined) child.stdin.end(input);
    // 正常路径等两流收口（`close` ⇒ stdout / stderr 逐字节完整）；
    // 超时路径等**子进程退出**即返回：层 C 的长驻命令会留下持有同一对管道的孙进程（P-2 原样透传），
    //   只等 `close` 会永不返回 —— 冻结契约要求"SIGKILL 后返回"。
    child.once('exit', (code) => {
      if (timedOut) settle(code);
    });
    child.once('close', (code) => settle(code));
  });
}
