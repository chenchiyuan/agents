# PR-005：统一 ACP 请求响应适配

## 上下文摘要
本 PR 将已解析且完成 fallback 的实际目标组装为统一 ACP 语义请求，并把本地 executor 返回映射为统一响应。字段语义必须稳定，但 adapter 位置、transport、协议版本承载、宿主调用和 CLI 参数映射均留给主 agent 根据实际代码确定，不把私有参数扩散到 role、路由或主 agent 层。

## 涉及 tasks

- T05

## 文件范围

- 未来运行时的“统一 ACP 请求/响应语义适配”专属 adapter 或调用边界文件（具体路径、transport、版本承载由主 agent 根据实际代码确定；仅限 T05，不声明 fallback、结果记录或主 agent 决策文件）

## 验收标准

- [ ] 每次请求承载 `protocol=acp`、`protocol_version`、本次 role、fallback 后实际 executor/model、未使用 fallback、brief 路径和 working directory。
- [ ] role 表示本次 subagent 的 role，brief 表示任务简报路径；subagent 不因 ACP 请求继承主 agent 会话。
- [ ] 请求中的目标是解析和 fallback 后的 selected 目标，fallback 仅列尚未使用的备用模型且不引入新 executor。
- [ ] 响应可表达 status、role、requested/selected、fallback_applied、降级信息及执行结果/原因，并保持双目标含义。
- [ ] CLI 私有参数只存在于 ACP/CLI 适配端；role、路由配置和主 agent 路由逻辑不承载它们，agents 不自建通信服务或处理 provider secret。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T05、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§PR 粒度判断框架
- `principles/execution/model-dispatch-protocol.md`（只读 ACP 字段基线）
