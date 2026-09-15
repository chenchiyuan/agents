// sdk/index.js — 库面消费入口（F01 / F09 / F13；architecture §2.1 IDX、§4.1 N-2、§5.2）
// `createHub({ port, socketPath })` → `{ api, uds, cli, doctor }`：三层命名空间**原样**取自 ./surface.js 的
//   `createSurface`（同一份 40 条入口表 ⇒ 两面同源：改一条入口定义，CLI 面与库面同时生效 —— §5.2 规则 1）；
//   `doctor` 不属于三层封装（P-4），由本文件**组合** ./doctor.js 的 `check`（surface.js 不装配它）。
// 装配而非实现（§2.3 / §5.2 规则 2）：本文件零通道逻辑、零端点数据 / 路径 / 选项名字面量、
//   零端口缺省链（缺省链的唯一落点在 surface.js）—— 全部行为面由 pr-003 的六个模块承担。
// 零状态（F09 验收 1·3 / §5.2 规则 4）：模块级只有 import 与纯函数，无 `let` / 缓存 / 单例 / 零本地写；
//   每次调用新建命名空间 ⇒ 两次 `createHub()` 之间无共享引用。
// 零 cwd 依赖（L2-11）：包内路径一律由各模块按 `import.meta.url` 推导，本文件不落任何路径。

import { createSurface } from './surface.js';
import { check as doctorCheck } from './doctor.js';

/**
 * 库面一次装配（§5.2）。
 * @param {{port?: number, socketPath?: string}} [opts] `port` 的缺省链由 `createSurface` 承担；
 *   `socketPath` 缺省 ⇒ 由 uds.js 的既有链解析
 * @returns {{api: object, uds: object, cli: object, doctor: {check: (opts?: object) => Promise<object>}}}
 */
export function createHub({ port, socketPath } = {}) {
  const { ctx, api, uds, cli } = createSurface({ port, socketPath });
  return {
    api,
    uds,
    cli,
    // port 由本次装配的 ctx 绑定（§5.5 库面对位）；调用选项原样透传（显式 opts.port 仍可覆盖）
    doctor: { check: (opts = {}) => doctorCheck({ port: ctx.port, ...opts }) },
  };
}
