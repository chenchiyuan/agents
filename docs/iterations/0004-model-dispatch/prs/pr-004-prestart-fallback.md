# PR-004：启动前模型 fallback

## 上下文摘要
本 PR 消费 T03 产出的 requested 目标和本地 executor/ACP opaque 能力报告，在同一 executor 内按确定顺序选择首个可用模型；全部候选不可用时在启动前形成可诊断阻断输入。不得切换 executor、读取凭据或在启动后自动重试/换模。

## 涉及 tasks

- T04

## 文件范围

- 未来运行时的“同 executor 启动前模型 fallback 与阻断输出”专属文件或宿主接入点（能力报告接入和探测 wire shape 由主 agent 根据实际代码确定；仅限 T04，不声明 ACP 调用、结果持久化或主 agent 决策文件）

## 验收标准

- [ ] 候选链按 requested model → 配置 fallback 顺序 → 未配置时 `defaults.subagent.model` 链尾生成；只改变 model，不改变已解析 executor。
- [ ] 按本地能力报告选择候选中的第一个可用模型；候选链去重并保留首次出现顺序。
- [ ] executor 不可用时报告该 executor 不可用，不切换 executor；模型及全部 fallback 不可用时不调用 ACP，并输出明确阻断原因。
- [ ] 能力判断仅消费本地 opaque 能力报告，不读取或猜测任何凭据；fallback 只发生在任务启动前。
- [ ] executor 已启动后执行失败时，fallback 边界不再次选模、不静默重跑；再次派发留给主 agent 显式决定。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T04、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§文件范围验证
- `principles/execution/model-dispatch-protocol.md`（只读 fallback 定义）
