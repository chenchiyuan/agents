# pr-003 上下文池 + ACP 客户端 + daemon 执行器

## 上下文摘要

落地 agent 侧的"上下文能力"整体：`acp-client.js`（一个 `omp acp` 子进程的按行 JSON-RPC 封装：initialize / session/new / set_config_option / session/prompt 流式 / cancel）、`context-pool.js`（键 `chat_id → 常驻进程 + ACP session`：懒创建、同键串行、异键并发、LRU 上限、释放、崩溃/超时收尾与 notice），以及 `agent.js` 的 `omp-daemon` 执行器分支、`notice`（上下文释放）处理与 SIGINT `pool.dispose()`；shell 与 `executor:'omp'` 一次性路径原样保留。池与客户端单独存在但不可达，故与 agent 接线同 PR 交付，验收以 fake ACP 注入在 agent 侧独立判定（不依赖 web）。

## 涉及功能点

- F05（上下文规范：同 chat 累积 / 同一常驻实例 / 新 chat 隔离 / 多 agent 隔离 / B 侧自管 / 异常可告知）
- F06（模型指定与默认：优先级链解析、`set_config_option` 切换、不可用模型明确失败、审计回读）
- F08（基线兼容：`executor:'omp'` 一次性路径与 shell 路径行为不变）

## 文件范围

- oamp/src/acp-client.js（新建）
- oamp/src/context-pool.js（新建）
- oamp/src/agent.js（改造：`parseTaskBody` 增 `omp-daemon` 分支、`createTaskDeliverHandler` 增 `notice` 处理、SIGINT 增 `pool.dispose()`）
- oamp/test/context-pool.test.js（新建）

## 验收标准

- [ ] fake ACP 注入（`OAMP_OMP_BIN` 指向实现 `initialize`/`session/new`/`set_config_option`/`session/prompt` 流式 + per-session 记忆的 node 脚本）下：同一 chat 两轮"记住 42 → 数字是多少"命中 42，且两轮 `task.result` 回报的 `context_id`/`pid` 相等（E-1/F05-2）
- [ ] 新 chat → 新键 → 新进程：同样两问的第二轮不含 42（E-2）；同 chat 两个不同 agent 各自独立、互不串扰（F05-4）
- [ ] 同键串行：上一轮 prompt 未结束时下一轮不开始（FIFO 队列）；队列超过 8 的轮次立即以 `context_busy` 失败；不同键之间并发（F05-3/§6.2）
- [ ] 超出 `contextMax` 时按 LRU 淘汰最久未使用的键（kill 子进程）并向 web 发 `notice{kind:'context_reset'}`（F05-7/§6.3）
- [ ] ACP 子进程异常退出 → 在飞轮次 `task.result{state:'failed', error:'context_crashed'}` + `notice{context_reset}`；下一轮同键重建，`context_id`/`pid` 随之改变（§6.5）
- [ ] 未知模型：`session/set_config_option` 返回 JSON-RPC error → 该轮 `failed(model_unavailable)`，**不回退**默认模型（F06-4）；成功轮次的 `model` 取自 ACP `currentValue`（实际生效值，F06-3 审计面）
- [ ] 模型分辨率链：payload `model` &gt; `OAMP_OMP_MODEL` &gt; `config.defaultModel`（`loadConfig()` 新键）&gt; 内置默认；同一 chat 内切模型不重建进程、上下文不丢（§7.1/§7.2）
- [ ] agent 受理面：`{executor:'omp-daemon', chat_id, prompt, model?}` 被受理执行；缺 `chat_id` → ack rejected；`model` 不匹配 `^[A-Za-z0-9._/-]{1,128}$` → 拒收（§7.2/§9.1）
- [ ] 一次性路径不回归：`executor:'omp'`（`omp -p`）与 shell（`command`）分支行为不变，`oamp/test/omp-executor.test.js`、`oamp/test/task.test.js`、`oamp/test/delivery-contract.test.js` 原样全绿
- [ ] SIGINT → `pool.dispose()`：全部常驻子进程被 kill 并移除键（§6.4）；agent 既有优雅退出流程（deregister/退出码）不变
- [ ] `node --test test/context-pool.test.js` 全绿，且不依赖真实 LLM/外网

## 参考资料

- docs/iterations/0011-chat-context-protocol/architecture.md §6.1~§6.6（键与实例标识 / 串行 / LRU / 释放与重启边界 / 崩溃超时 / ACP 客户端细则）、§7.1~§7.4（模型解析、切换、错误面、审计）、§9.1（执行路径路由表）、§12（AR-11/AR-12/AR-16）、§17（fake ACP 集成测试层）
- docs/iterations/0011-chat-context-protocol/prd/F05-context-per-chat-agent.md、F06-model-selection-default.md、F08-baseline-compatibility-regression.md
- 现有注入点：oamp/src/agent.js:22（`OMP_BIN = () => process.env.OAMP_OMP_BIN || 'omp'`）、:35 `parseTaskBody`、:50 `executor:'omp'` 分支、:211 `runTask` 分派、:309 `createTaskDeliverHandler`、:384 SIGINT；测试范式 oamp/test/omp-executor.test.js（fake omp 注入）

## depends_on

- pr-001-config-surface-and-persistence.md（理由：本 PR 在 `agent.js` 的 daemon 分支消费 `loadConfig()` 新增的 `defaultModel`/`contextMax` 键（架构 §8.5 定义的返回值），该两键由 pr-001 产出。证据：`oamp/src/agent.js:8` 现为 `import { loadConfig } from './config.js'`，而现行 `oamp/src/config.js:30-44` 的返回值只有 `socketPath`/心跳/重连字段，**没有** `defaultModel`/`contextMax`——不先合入 pr-001，默认模型与池上限会解析为 `undefined`）

## batch

2
