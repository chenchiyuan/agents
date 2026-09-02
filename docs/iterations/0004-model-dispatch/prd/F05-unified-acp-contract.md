# F05 — 统一 ACP 派发请求与响应

**功能 ID**: F05  
**来源**: `demand.md` §6「统一 ACP 派发契约」  
**迭代**: 0004-model-dispatch

---

## 用户价值

让主 agent 以同一套可互换的语义向本地 CLI 派发子 agent，并获得足够的信息判断任务结果和实际使用目标，而不必为每个 CLI 维护一套 agents 路由协议。

---

## 验收标准

1. 每次派发请求都能表达 `protocol=acp`、`protocol_version`、本次子 agent 的 `role`、`executor`、已解析的实际 `model`、尚未使用的 `fallback` 候选、`brief` 和 `working_directory`。
2. 请求中的 `role` 是本次子 agent 使用的 role 名称，`brief` 是任务简报路径；子 agent 不因该请求继承主 agent 会话。
3. 请求中的 `executor` 与 `model` 表示已经完成路由和 fallback 解析后的实际目标；请求中的 `fallback` 仅列出尚未使用的备用模型，便于审计和 executor 侧诊断。
4. 请求中的 `working_directory` 能明确指出本次任务工作目录。
5. 不同本地 CLI 均通过上述统一语义接收 agents 派发；agents 不为每个 CLI 另建独立的路由协议，也不在 agents 项目内自建通信服务。
6. 每次响应都能表达 `status`、`role`、`requested` 目标、`selected` 目标、`fallback_applied` 及可审计的降级信息，以及执行结果。
7. 响应中的 `requested` 表示请求的 `executor/model`，`selected` 表示实际使用的 `executor/model`；即使发生 fallback，也能同时辨认两者。

---

## 边界（不包含）

- 不包含本地 CLI 的具体参数映射。
- 不包含 ACP adapter、传输通道、通信服务或调用器的技术选型与实现。
- 不包含 provider 实现、endpoint、API key、登录态或其他凭据管理。
- 不包含 CLI 内部会话管理、重试和任务执行逻辑。
- 不替换既有主 agent / 子 agent 协作边界。

---

## 架构维度

- ACP 语义适配边界承载固定 `protocol=acp`、`protocol_version`、`role`、已解析的 `executor/model`、尚未使用的 `fallback`、`brief` 和 `working_directory`，并将 executor 返回映射为统一响应；传输方式和协议版本承载实现待主 agent 根据实际代码确定。
- CLI 参数映射只存在于 ACP/CLI 适配端，不进入 role 文件、路由配置或主 agent 路由逻辑；`omp`、`codex`、`codebuddy` 的具体映射实现待主 agent 根据实际代码确定。
