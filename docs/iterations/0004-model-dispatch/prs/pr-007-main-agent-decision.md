# PR-007：主 agent 结果决策与权责边界

## 上下文摘要
本 PR 将完整的解析、fallback 和结果信息接入主 agent，使其能检查 requested/selected、status 与审计，并显式决定接受结果或再次派发；同时保持主 agent 全局视图、subagent brief/role 输入边界和 secret 隔离。不新增协作协议，不改变既有主/子 agent 模型。

## 涉及 tasks

- T07

## 文件范围

- 未来运行时的“主 agent 结果检查、接受/再次派发显式决策与主/子 agent 权责隔离”专属宿主接入文件（具体路径和报告承载由主 agent 根据实际代码确定；仅限 T07，不声明 adapter、归一化记录或验证矩阵文件）

## 验收标准

- [ ] 主 agent 为每次 subagent 派发提供明确 role 与 brief，可显式覆盖 executor/model，并能检查 requested/selected、status 和 fallback 审计。
- [ ] 出现 fallback 时，主 agent 基于实际目标和降级原因显式决定接受继续执行或不接受；派发边界不静默重跑。
- [ ] subagent 仅按主 agent 提供的 brief 和 role 执行，不自行修改路由配置或切换模型；再次派发须由主 agent 显式决定。
- [ ] provider、endpoint、API key、token、密码、登录态和认证仍由本地 CLI/宿主持有；决策路径不读取、解释或持久化 secret。
- [ ] 主 agent 保持全局视图，subagent 仅接收 brief/role 相关执行输入，既有协作边界不被改变。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T07、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§PR 粒度判断框架
- `principles/execution/model-dispatch-protocol.md`（只读主/子 agent 边界）
