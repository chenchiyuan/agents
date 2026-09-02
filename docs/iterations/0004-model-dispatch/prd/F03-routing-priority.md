# F03 — 路由解析优先级与字段继承

**功能 ID**: F03  
**来源**: `demand.md` §4「路由解析范围与优先级」  
**迭代**: 0004-model-dispatch

---

## 用户价值

让主 agent 能为单次子 agent 派发做出明确、可预测的目标覆盖，而未覆盖的字段仍稳定继承项目路由或默认值，不把模型选择责任隐式转移给 role 文件。

---

## 验收标准

1. 对子 agent 的每个目标维度分别按以下顺序解析：派发请求显式指定的值优先于 `roles.<role>` 的值，后者优先于 `defaults.subagent` 的值。
2. 派发请求只显式指定 `executor` 时，最终 `executor` 使用请求值，而 `model` 仍从该 role 路由或 `defaults.subagent` 解析。
3. 派发请求只显式指定 `model` 时，最终 `model` 使用请求值，而 `executor` 仍从该 role 路由或 `defaults.subagent` 解析。
4. 派发请求同时显式指定 `executor` 和 `model` 时，两个维度均覆盖 role 路由和子 agent 默认值。
5. 对未配置 role 的子 agent，显式指定的字段覆盖子 agent 默认值，未指定字段继续使用子 agent 默认值。
6. role 路由只对子 agent 生效；主 agent 不因当前 role 或 `roles.<role>` 配置自动切换目标。主 agent 只有在自己的派发请求中显式指定对应字段时才改变该字段。
7. 每次子 agent 派发均由主 agent 提供明确的 role 和 brief；模型选择不要求子 agent 从 role 文件自行决定或改写路由配置。

---

## 边界（不包含）

- 不包含 role 文件能力内容的定义、修改或模型绑定。
- 不包含 fallback 候选可用性判断和启动时降级（见 F04）。
- 不包含路由配置的文件格式解析实现（见 F02）。
- 不包含 CLI 参数映射、provider 选择或凭据处理。

---

## 架构维度
- 目标解析边界对 `executor`、`model` 分别执行“派发请求显式值 > `roles.<role>` > `defaults.subagent`”的字段合并；只覆盖显式出现的字段，另一字段继续继承。
- 解析主体为 `subagent` 时 role 路由可参与合并；主体为 `main` 时只使用主 agent 默认和自身显式覆盖，不接受 role 自动切换。解析必须在能力检查和 ACP 派发之前完成，并输出请求目标。具体函数/模块承载实现待主 agent 根据实际代码确定。
