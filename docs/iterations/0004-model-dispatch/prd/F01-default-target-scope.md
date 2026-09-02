# F01 — 默认派发目标与 role 作用域

**功能 ID**: F01  
**来源**: `demand.md` §2「派发目标与默认行为」  
**迭代**: 0004-model-dispatch

---

## 用户价值

让主 agent 和子 agent 在没有额外指定时拥有一致、可预测的派发目标，同时让 role 专用路由只影响对应的子 agent，不破坏主 agent 的人工管理边界。

---

## 验收标准

1. 在没有显式覆盖且没有可用项目路由的情况下，主 agent 的派发目标为 `executor=omp`、`model=gpt`。
2. 在没有显式覆盖且 role 未配置专用路由的情况下，子 agent 的派发目标为 `executor=omp`、`model=gpt`。
3. 派发目标同时包含独立的 `executor` 和 `model` 两个维度；只有两者组合后，才形成一次完整目标。例如，`omp + gpt` 与 `omp + deepseek` 被识别为不同目标。
4. 子 agent 指定一个已配置路由的 role 后，使用该 role 所解析出的专用目标；指定未配置路由的 role 后，使用子 agent 默认目标。
5. 当前任务或 role 不会自动改变主 agent 的目标；只有主 agent 在自己的派发请求中显式指定 `executor` 或 `model` 时，该对应维度才改变。
6. 将同一 role 用于子 agent 和主 agent 时，role 路由仍只对前者生效，主 agent 不因该 role 自动切换。

---

## 边界（不包含）

- 不包含 role 文件能力定义的重写或扩展。
- 不包含把模型绑定写入 role 文件；模型绑定由独立路由配置承担（见 F02）。
- 不包含具体配置读取、目标解析或 CLI 调用实现方式。
- 不包含 provider、endpoint、登录态或凭据管理。

---

## 架构维度
- 由派发入口先标记主体为 `main` 或 `subagent`，再进入目标解析边界；目标始终由独立的 `executor` 与 `model` 两个字段组成，最终组合才是一次派发目标。
- `subagent` 解析读取指定 role 的项目路由；未命中时使用 `defaults.subagent`，缺少配置时使用内置 `omp + gpt`。`main` 只读取 `defaults.main`/内置默认，忽略 role 路由的自动覆盖。
- 主 agent 自身只有在派发请求显式指定对应字段时才改变目标；解析边界输出 `requested.executor/model`，不读取 role 文件中的模型信息。具体运行时承载实现待主 agent 根据实际代码确定。
