# pr-002-registry-task-list-model

> 迭代：0018-chat-agent-subagent-protocol · 阶段 4（PR 规划）产物
> 真源：`docs/iterations/0018-chat-agent-subagent-protocol/architecture.md` §3.4 + §9.2 L2-9 + §10-2

## 上下文摘要

为调用 roster「模型」列补唯一数据源：`listTasks` 投影追加只读字段 `model: task.result?.model ?? null`（终态 = 执行侧实报值，进行中 = `null`）。方法集不变（agent↔router 仍 7 个方法），`updates[]` 与终态语义不变。**不含既有测试断言改写**（`oamp/test/task.test.js` 零改写）。

## 涉及功能点

- F09

## 文件范围

- oamp/src/registry.js（修改）

## 验收标准

- [ ] `oamp/src/registry.js` 的 `listTasks` 投影行包含 `model` 键，取值 = `task.result?.model ?? null`（检索式 `grep -n 'function listTasks' oamp/src/registry.js`，阅读其 `out.push({…})` 的字段清单）。
- [ ] 进行中任务（`result === null`）该键为 `null`，不填请求参数或推测值。
- [ ] 本 PR diff 只落在 `listTasks` 投影一处：`createTask` / `recordTaskUpdate` / `finishTask` / `getTask` 的字段与语义零改动。
- [ ] `node --test oamp/test/task.test.js` 全绿，且该文件内容 `git diff` 为空。
- [ ] 协议方法面仍 7 个（`oamp/src/router.js` 零改动，`git diff --name-only` 不含该路径）。

## 参考资料

- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §3.4（roster 行 6 列与 `model` 口径）
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F09-call-roster.md（T-06）

## depends_on

（无）

## batch

1
