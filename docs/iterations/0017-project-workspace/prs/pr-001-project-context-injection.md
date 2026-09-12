# pr-001-project-context-injection

## 上下文摘要

agent 侧项目上下文注入：`agent.js` 新增唯一渲染点（`【项目上下文】` 三行）与 `payload.body.project` 解析（可选字段，非法即视为未携带、不拒收任务）；一次性路径前缀到 `omp -p` 末位 argv，常驻路径由 `context-pool.js` 在会话首个成功送达轮次注入一次（`sentTurns` 只在送达后自增）。投递端在 pr-002，故合入后既有 22 个测试文件零改写且全绿；上下文池键 / 串行 / 上限 / 并发语义不变。

## 涉及功能点

- F07（内容三要素、相对工作约定、agent 侧注入、首轮一次 / 每次的注入时机）
- F06（仅接收端：`payload.body.project` 的解析与"未携带即不注入"的向后兼容；投递端在 pr-002）

## 文件范围

- oamp/src/agent.js（修改）
- oamp/src/context-pool.js（修改）

## 验收标准

- [ ] `oamp/src/agent.js` 含唯一渲染点（模块级纯函数，输出 `【项目上下文】` + `- 项目名：` / `- 仓库地址：` / `- 工作约定：` 三行）与 `payload.body.project` 解析；三行取值全部来自载荷字段（约定文本的真源 = `web.js` 的 `PROJECT_AGREEMENT`，经载荷携带；`agent.js` 只渲染，既不复制文本也不 import `web.js`）
- [ ] 载荷 `project` 的三种形态均不改变既有裁决：合法对象 ⇒ 注入；缺失 / 非对象 / 字段类型非法 ⇒ 视为"未携带"、任务照常执行（对照既有 `label` 的 `typeof body.label === 'string' ? … : null` 体例）
- [ ] 一次性路径：payload 携带合法 `project` 时 `omp -p` 的**末位 argv** = `【项目上下文】…` + 换行 + 原文（可经 `FAKE_ACP_ARGS_LOG` 记录的 argv 末位观测）；未携带时末位 argv 逐字等于原文（`oamp/src/agent.js:173` 的 `args.push(task.prompt)` 处施加）
- [ ] 常驻路径：同 `(chat_id, agent_id)` 会话的**首个成功送达轮次**注入一次，其后轮次只发原文；会话被释放 / 崩溃 / 淘汰后重建 ⇒ 重新注入（观测量 = fake ACP 回显的 `session/prompt` 文本）
- [ ] `context_busy`（入队即拒）/ `model_unavailable`（`session/prompt` 之前失败）/ 会话崩溃 ⇒ 不消费首轮名额（`sentTurns` 只在 `client.prompt` 成功返回后自增，`oamp/src/context-pool.js` 的 `_pump()`）
- [ ] 未携带 `project` 时既有行为逐字不变：既有 22 个测试文件零改写且 `npm test` 全绿；`task.label` / `logger.event('TASK_STARTED')` / `task_update` 的 `prompt` 摘要仍为用户原文
- [ ] 协议方法面仍 7 个（`project` 只在 `task.request` 的 `payload.body` 内容层）；上下文池的键、FIFO 串行、队列上限 8、LRU、并发语义不变（本 PR 只增一个只增不减的计数 + 一个可选参数）

## 参考资料

- docs/iterations/0017-project-workspace/prd/F07-context-content-and-injection.md
- docs/iterations/0017-project-workspace/prd/F06-dispatch-payload-project-context.md
- docs/iterations/0017-project-workspace/architecture.md（§4.1 T-08 字段形态 / §4.2 T-04 注入时机与模块归属 / §4.3 T-12 措辞即契约）
- oamp/src/agent.js:46（`parseTaskBody`）、:157（`runOmpTask`）、:173（argv 末位）、:275（`runDaemonTask`）
- oamp/src/context-pool.js:112（`ContextSession`）、:144（`prompt()`）、:165（`_pump()`）

## depends_on

（无）

## batch

1
