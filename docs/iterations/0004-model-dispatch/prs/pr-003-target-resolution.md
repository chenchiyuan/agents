# PR-003：主体与 role 目标解析

## 上下文摘要
本 PR 在能力检查和 ACP 派发前完成 main/subagent 作用域识别，并按 executor、model 两个字段独立合并显式请求、role 配置和子 agent 默认值，产出 fallback 可消费的 `requested` 双目标。不得从 role 文件读取模型绑定，也不在本 PR 判断能力或执行 fallback。

## 涉及 tasks

- T03

## 文件范围

- 未来运行时的“主体/role 作用域与分字段目标解析”专属解析器或宿主接入文件（具体路径由主 agent 根据实际代码确定；仅限 T03，不声明配置加载、能力检查、ACP adapter 或结果记录文件）

## 验收标准

- [ ] main 无显式覆盖时使用 `defaults.main`；subagent 无显式覆盖且 role 未配置时使用 `defaults.subagent`；无配置时两者均为 `omp + gpt`。
- [ ] subagent 每个维度按“显式字段 > `roles.<role>` 对应字段 > `defaults.subagent` 对应字段”独立合并；只覆盖一个字段时另一个字段继续继承。
- [ ] 未配置 role 时显式字段仅覆盖对应 subagent 默认字段；配置 role 时 role 对 subagent 生效。
- [ ] main 忽略 role 自动覆盖，仅显式请求字段可改变对应维度；同一 role 同时用于 main 和 subagent 时仍保持该隔离。
- [ ] 每次 subagent 解析要求明确 role 与 brief，并输出 `requested.executor/model`；缺失输入不进入正常 ACP 启动路径。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T03、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§PR 粒度判断框架
- `principles/execution/model-dispatch-protocol.md`（只读作用域与字段定义）
