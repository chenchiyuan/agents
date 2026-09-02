# F04 — 启动前模型 fallback

**功能 ID**: F04  
**来源**: `demand.md` §5「启动前模型降级」  
**迭代**: 0004-model-dispatch

---

## 用户价值

在首选模型暂不可用时，任务可以按项目明确声明的顺序选择同一本地 executor 内的可用模型；如果没有可用候选，用户能在任务未启动前得到明确阻断，而不会遭遇不可审计的换 CLI 或重跑。

---

## 验收标准

1. fallback 被解释为有顺序的模型候选链，只改变 `model`；所有候选均在解析出的同一个 `executor` 内尝试。
2. 目标模型不可用时，按 fallback 配置顺序选择第一个被本地 executor/ACP 能力报告为可用的模型；例如目标为 `minimax-k3`、链为 `[deepseek, gpt]` 时，前者不可用且后者可用，实际目标为同一 executor + `deepseek`。
3. 未配置 fallback 时，候选链以 `defaults.subagent.model` 作为最后候选；默认配置下链尾为 `gpt`，因此可回到 `omp + gpt`。
4. 当前目标模型已经是 `gpt` 时，候选链不得再次尝试 `gpt`。
5. executor 本身不可用时，派发不得静默换用另一个 executor，而必须报告该 executor 不可用。
6. 目标模型及全部 fallback 均不可用时，任务不启动，并返回明确的 `blocked` 或 `failed` 状态；不得产生已启动的子 agent 执行结果。
7. fallback 只在任务启动前发生。子 agent 已启动后执行失败时，派发能力不得静默切换模型并重跑；是否重新派发由主 agent 根据结果显式决定。
8. 模型可用性以本地 executor/ACP 能力报告为准；agents 不读取凭据，也不根据猜测判断凭据状态。

---

## 边界（不包含）

- 不包含把 fallback 用作 executor 切换链。
- 不包含子 agent 启动后的自动重试、自动换模型或执行策略。
- 不包含 provider 注册、endpoint、API key、登录态及其他凭据管理。
- 不包含本地 executor/ACP 如何报告能力或实现候选探测。
- 不包含降级信息的持久化与展示方式（见 F06）。

---

## 架构维度

- 目标解析完成后向解析出的同一 executor 获取能力报告；能力报告至少能判断 executor 是否可用及候选模型是否可用，agents 不读取凭据。报告 wire shape 与接入方式实现待主 agent 根据实际代码确定。
- 启动前按“请求模型 → 配置 fallback 顺序 → 未配置 fallback 时的 `defaults.subagent.model` 链尾”选择首个可用模型，去重且不重复当前模型；executor 不可用或全候选不可用时不调用 ACP 启动，交给结果归一化边界返回阻断。具体时序承载实现待主 agent 根据实际代码确定。
