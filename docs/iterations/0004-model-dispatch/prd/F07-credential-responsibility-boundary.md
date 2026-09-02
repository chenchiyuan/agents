# F07 — 凭据与主/子 agent 责任边界

**功能 ID**: F07  
**来源**: `demand.md` §7「凭据与职责边界」、§8「本迭代包含与不包含」  
**迭代**: 0004-model-dispatch

---

## 用户价值

明确 agents、主机上的本地 CLI 与子 agent 各自负责的范围，使模型派发能够复用本地工具的认证环境而不扩大 agents 的敏感信息责任，也避免子 agent 越权修改路由或自行改变执行目标。

---

## 验收标准

1. agents 发起本地模型执行时，只通过统一 ACP 语义调用本地 CLI；本地 CLI 可包括 `omp`、`codex`、`codebuddy` 等协议参与者。
2. provider 注册、provider 实现、endpoint、API key、登录态及其他认证/凭据均由对应的本地工具或宿主环境负责；agents 不管理、不存储、不解析这些信息。
3. 路由配置和派发 brief 中不要求 agents 获取或解释 provider secret 才能完成模型选择；模型可用性以本地 executor/ACP 的能力报告为准。
4. 子 agent 按主 agent 提供的 brief 和指定 role 执行，并在报告中保留实际执行目标和边界问题。
5. 子 agent 不自行修改项目路由配置，也不因执行失败自行切换模型；需要再次派发时，由主 agent 根据结果显式决定。
6. 本迭代的派发能力不会改变既有主 agent 持有全局视图、子 agent 只读 brief 的协作边界。

---

## 边界（不包含）

- 不包含 provider 注册/实现、endpoint、API key、登录态或其他凭据的配置、认证、保存和轮换。
- 不包含 CLI 内部参数、认证方式、会话管理、重试和任务执行逻辑。
- 不包含 agents 自建通信服务。
- 不包含 role 能力定义重写或 role 文件模型绑定。
- 不包含子 agent 启动后的自动换模型重跑或其他自动重派机制。

---

## 架构维度

- agents 只通过统一 ACP 语义调用本地 CLI，并只消费不含 secret 的 executor/ACP 能力报告；provider、endpoint、API key、token、密码、登录态和认证由本地工具或宿主持有，agents 不读取、存储或解析。具体宿主调用实现待主 agent 根据实际代码确定。
- 主 agent 在派发请求/结果中承载 role、实际 `selected.executor/model` 和边界问题；子 agent 只按 brief 与 role 执行，不修改路由、不自行换模型，启动后失败是否重派由主 agent 显式决定。
