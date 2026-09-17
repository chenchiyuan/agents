# pr-001 · reason 映射叶子模块（源串 → 五值闭集）

## 上下文摘要

新增叶子模块 `oamp/src/reason.js`，承载"失败终态自由串 → `reason` 五值闭集"的**唯一**映射公式（精确匹配 → 三条前缀规则 → 兜底 `agent_error`），零依赖、纯函数、无 I/O、无定时器，体例照 `oamp/src/role-binding.js` 的"公式只此一处"。归类全部发生在**消费侧**：既有失败产生点（`agent.js` / 三客户端 / `context-pool.js` / `router.js` / `web.js`）**零改动**——G01 验收 3 与 F04 边界要求既有 `error` 文案逐字不变，任何"在产生点改写错误串"的做法都被排除。本 PR 只交付模块本体与其自证，**不接线**（唯一消费点 `composeCallEnvelope` 的追加动作在 pr-005）。

## 涉及功能点

- F04

## 文件范围

- oamp/src/reason.js（新建）

## 验收标准

- [x] `oamp/src/reason.js` 存在，导出唯一函数 `reasonOf(state, error)`；无其它导出、无对其它 `src/**` 模块的 import
- [x] `state !== 'failed'` ⇒ 返回 `null`；`state === 'failed'` ⇒ 返回值 ∈ {`agent_error`, `cancelled_by_client`, `infra_error`, `timeout`, `rejected`} 且**恒非 null**（含 `error` 为 `null` / 缺失 / 非字符串 / 空串的情形）——"全函数"由构造保证，不依赖对自由文本的穷举
- [x] 已知形态逐条命中：`cancelled` → `cancelled_by_client`；`rejected_by_agent` / `structured_output_invalid` / `permission_denied` / `model_unavailable` / `context_busy` → `rejected`；`timeout` / `timeout_after_<N>ms`（任意 N） → `timeout`；`context_crashed` / `spawn_failed:` 前缀 / `spawn_error:` 前缀 / `dispatch_failed` → `infra_error`；任意未匹配自由文本（如 `一次性执行失败`、`err.message` 透传串） → `agent_error`
- [x] 参数化串按**前缀**口径归类、不解析参数（`timeout_after_` 开头的 N 不参与归类；`spawn_failed:` / `spawn_error:` 冒号后任意文本含空串），无关键字启发式分支

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-03 / A-04（映射表 15 行、三段式匹配规则、`agent_error` 兜底归属）
- docs/iterations/0030-hub-communication-upgrade/prd/F04-terminal-reason-enum.md（验收 1/2/4）
- oamp/src/role-binding.js（叶子模块体例：零依赖、"公式只此一处"）

## depends_on

（无）

## batch

1
