// sdk/errors.js — Hub 错误契约（F07 / F08 / F10；architecture §5.2 规则 3·5、§5.3、§5.4）
// 归类表（§5.4，首条命中者生效）在本模块**唯一落点**：CLI 面的进程退出码与库面的 HubError.exitCode
// 共用同一张表 ⇒ 两面语义一致性由结构保证，不靠约定同步（§5.2 规则 5）。
// 零 import、零状态：只做归类与序列化，不发出任何连接或请求；层 C 的子进程退出码透传不在此表（归 pr-003）。

const EXIT_USAGE = 2; // 用法错误：本地 argv 解析失败，未发出任何连接或请求
const EXIT_CONNECTION = 3; // 连接失败：连不上 / 响应未到 / 订阅被服务端终止 / 上游 502
const EXIT_BUSINESS = 1; // 业务失败：上游业务错误 / 等待超时 / 本地配置错误

/** Hub 调用失败的唯一错误类型（§5.2 规则 3）：携带归类结果，四个字段供两面各自呈现
 *  （CLI 面 → 进程退出码 + stderr 单行 JSON；库面 → 调用方直接读字段）。 */
export class HubError extends Error {
  /**
   * @param {object} spec
   * @param {string} spec.code       错误标识（上游 `code` 原文，或 SDK 侧码如 `HUB_UNREACHABLE` / `WAIT_TIMEOUT`）
   * @param {string} spec.error      人类可读文案（序列化后即错误对象的 `error` 字段）
   * @param {number} spec.exitCode   四类退出码之一（`1` / `2` / `3`）
   * @param {number|null} [spec.httpStatus] 层 A 的 HTTP 状态码（层 B / 本地错误为 null）
   * @param {object|null} [spec.upstream]   上游错误对象原样（层 B / 本地错误为 null）
   */
  constructor({ code, error, exitCode, httpStatus = null, upstream = null }) {
    super(error);
    this.name = 'HubError';
    this.code = code;
    this.exitCode = exitCode;
    this.httpStatus = httpStatus;
    this.upstream = upstream;
  }
}

/** 上游响应（4xx/5xx）的归类：序 5 命中在序 6 之前——502 是 hub 明示其上上游不可达，
 *  与其余 4xx/5xx 的"业务失败"不同类（§5.4 `3` 类 ④ / `1` 类 ①）。 */
function classifyResponse(status, body) {
  if (status >= 200 && status < 300) return { code: null, exitCode: 0 };
  if (status === 502) return { code: 'UPSTREAM_UNAVAILABLE', exitCode: EXIT_CONNECTION };
  return { code: body.code, exitCode: EXIT_BUSINESS }; // 上游 code 原样透出
}

/**
 * 归类表（§5.4，首条命中者生效；行序即优先级）。observation 判别式逐行对应表内一行：
 *   `{ kind: 'usage' }`                        序 1 本地 argv 解析失败（未发出任何连接或请求）
 *   `{ kind: 'connect' }`                      序 2 连接建立失败 / 连接建立超 2000ms
 *   `{ kind: 'response-timeout' }`             序 3 非阻塞条目 5000ms 内未收到响应
 *   `{ kind: 'stream-ended' }`                 序 4 已建立的订阅被服务端异常终止
 *   `{ kind: 'response', status, body }`       序 5·6 上游响应（502 / 其余 4xx·5xx / 2xx）
 *   `{ kind: 'wait-timeout' }`                 序 7 可阻塞条目在 `--wait` 内未见终态
 *   `{ kind: 'config' }`                       序 8 本地配置错误（loadConfig 抛错）
 *   `{ kind: 'success' }`                      序 9 其余成功（含订阅被下游管道截断）
 * @returns {{code: string|null, exitCode: number}} 成功行 `code === null` 且 `exitCode === 0`
 */
export function classify(observation) {
  switch (observation.kind) {
    case 'usage':
      return { code: 'USAGE', exitCode: EXIT_USAGE };
    case 'connect':
      return { code: 'HUB_UNREACHABLE', exitCode: EXIT_CONNECTION };
    case 'response-timeout':
      return { code: 'REQUEST_TIMEOUT', exitCode: EXIT_CONNECTION };
    case 'stream-ended':
      return { code: 'HUB_UNREACHABLE', exitCode: EXIT_CONNECTION };
    case 'response':
      return classifyResponse(observation.status, observation.body);
    case 'wait-timeout':
      return { code: 'WAIT_TIMEOUT', exitCode: EXIT_BUSINESS };
    case 'config':
      return { code: 'CONFIG_ERROR', exitCode: EXIT_BUSINESS };
    case 'success':
      return { code: null, exitCode: 0 };
    default:
      throw new Error(`未知 observation: ${observation.kind}`); // 不静默当成功（快速失败优于静默失败）
  }
}

/** 错误对象形态（§5.3）：`{code, error, exit_code}`（+ 层 A 的 `http_status`）；snake_case、
 *  不含 `stack`（F08 验收 1"不输出堆栈"的构造面）。`error` 取上游原文，无上游时取本错误文案。 */
export function serializeError(err) {
  const body = {
    code: err.code,
    error: err.upstream === null ? err.message : err.upstream.error,
    exit_code: err.exitCode,
  };
  if (err.httpStatus !== null) body.http_status = err.httpStatus;
  return body;
}
