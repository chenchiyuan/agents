---
name: model-dispatch-protocol
description: 主 agent 与子 agent 的本地 CLI/模型路由协议。定义项目配置、默认目标、角色覆盖、解析期降级和统一 ACP 派发契约；不管理 provider 或凭据。
type: 执行协议
version: 0.1.1
created: 2026-09-02
updated: 2026-09-10
---

# 模型派发协议

## 一、目的与边界

本协议把一次 agent 派发拆成两个可独立配置的维度：

```text
派发目标 = executor CLI + model
```

示例：`omp + DeepSeek-V4.1-Flash`、`omp + deepseek`、`codex + gpt`。

本协议负责：

- 加载项目级路由配置
- 根据主/子 agent 和 role 解析派发目标
- 在启动前按显式 fallback 链选择可用模型
- 通过 ACP 发送统一语义的派发请求
- 标准化回报实际 executor、model 和降级信息

本协议不负责：

- provider 注册与实现
- API key、endpoint、登录态或其他凭据
- `omp`、`codex`、`codebuddy` 等本地 CLI 的内部参数
- CLI 内部的会话管理、重试和任务执行逻辑
- 替换现有的主 agent / 子 agent 协作边界

ACP 是本协议使用的外部调用协议，不在 agents 项目内自建通信服务。executor 是本地可调用的 CLI，由本机环境负责提供。

## 二、配置归属与路径

项目级配置路径固定为：

```text
.pb-agents/config/agent-routing.yaml
```

`.pb-agents/config/` 是项目配置例外区：

- `.pb-agents/roles/`、`.pb-agents/principles/` 等框架 copy 仍为只读
- `.pb-agents/config/agent-routing.yaml` 属于业务项目，可由项目维护
- agents 安装或升级不得覆盖、删除该配置
- 配置不承载项目运行记录；运行记录仍放在 `.pb-agents/project/`

配置缺失时使用内置默认值。配置存在但语法或字段非法时必须快速失败并报告具体错误，不得静默退回默认值。

## 三、配置格式

最小配置：

```yaml
version: 1

defaults:
  main:
    executor: omp
    model: DeepSeek-V4.1-Flash
  subagent:
    executor: omp
    model: DeepSeek-V4.1-Flash

roles:
  dev:
    executor: omp
    model: deepseek

  architect:
    executor: omp
    model: minimax-k3
    fallback:
      - deepseek
      - gpt
```

字段定义：

| 字段 | 必填 | 含义 |
|---|---:|---|
| `version` | 是 | 配置格式版本，当前为 `1` |
| `defaults.main.executor` | 是 | 主 agent 默认使用的本地 CLI |
| `defaults.main.model` | 是 | 主 agent 默认使用的模型 |
| `defaults.subagent.executor` | 是 | 子 agent 未命中 role 路由时使用的本地 CLI |
| `defaults.subagent.model` | 是 | 子 agent 未命中 role 路由时使用的模型 |
| `roles.<role>.executor` | 否 | 指定 role 子 agent 使用的本地 CLI；缺失时继承 `defaults.subagent.executor` |
| `roles.<role>.model` | 否 | 指定 role 子 agent 使用的模型；缺失时继承 `defaults.subagent.model` |
| `roles.<role>.fallback` | 否 | 在同一个 executor 内依次尝试的备用模型列表 |

`roles` 的 key 必须与派发请求中的 role 名称一致。协议不要求每个 role 都配置路由；未配置的 role 使用子 agent 默认目标。

凭据字段不属于本格式。不得在此文件中保存 API key、token、密码或要求 agents 解析的 provider secret。

## 四、默认值与作用域

### 4.1 主 agent

主 agent 默认目标固定为：

```text
omp + DeepSeek-V4.1-Flash
```

主 agent 由人工管理。当前任务对应哪个 role，不会隐式改变主 agent 的模型。主 agent 如需改变自身目标，必须在自身派发请求中显式指定。

### 4.2 子 agent

子 agent 默认目标固定为：

```text
omp + DeepSeek-V4.1-Flash
```

role 路由只对子 agent 生效。例如：

```text
role=dev       → omp + deepseek
role=architect → omp + minimax-k3
未配置 role    → omp + DeepSeek-V4.1-Flash
```

### 4.3 路由优先级

从高到低：

```text
派发请求显式指定 executor/model
  > roles.<role>
  > defaults.subagent
```

请求显式指定的字段只覆盖对应字段；未指定字段继续按上述顺序解析。

## 五、目标解析与降级

解析流程：

1. 识别派发主体：`main` 或 `subagent`
2. 读取项目配置；配置不存在则使用内置默认值
3. 按路由优先级合并 `executor` 与 `model`
4. 对最终模型和其 fallback 列表执行可用性解析
5. 找到第一个可用目标后启动 ACP 派发
6. 将请求目标、实际目标、降级原因写入结果

fallback 只对模型生效，且在当前 executor 内解析。示例：

```text
请求：omp + minimax-k3
fallback：[deepseek, gpt]
结果：omp + deepseek
```

统一规则：

- 没有配置 fallback 时，默认把 `defaults.subagent.model` 作为最后候选
- `defaults.subagent.model` 为 `DeepSeek-V4.1-Flash`，因此默认链尾是 `omp + DeepSeek-V4.1-Flash`
- role 已经是 `gpt` 时不得重复尝试 `gpt`
- executor 本身不可用时不得静默换成另一个 executor；必须报告不可用
- 目标模型和全部 fallback 均不可用时，不启动任务，返回 `blocked` 或 `failed`
- 判断“不可用”由本地 executor/ACP 能力报告；agents 不读取凭据、不猜测凭据状态

降级只允许发生在任务启动前。子 agent 已启动后，执行失败不得由本协议静默切换模型重跑；是否重派由主 agent 根据任务结果决定。

实际降级必须可审计：

```yaml
requested:
  executor: omp
  model: minimax-k3
selected:
  executor: omp
  model: deepseek
fallback_applied: true
fallback_chain: [deepseek, gpt]
fallback_reason: minimax-k3 unavailable
```

## 六、统一 ACP 派发契约

### 6.1 请求

agents 向本地 executor 发送统一语义请求：

```yaml
protocol: acp
protocol_version: 1
role: dev
executor: omp
model: deepseek
fallback: [gpt]
brief: path/to/brief.md
working_directory: /path/to/project
```

字段含义：

- `protocol`：固定为 `acp`
- `protocol_version`：ACP 派发契约版本
- `role`：本次子 agent 使用的 role 名称
- `executor`：本地 CLI 名称
- `model`：已解析出的实际模型
- `fallback`：尚未使用的备用模型，供审计和 executor 侧诊断
- `brief`：任务简报路径；子 agent 不继承主 agent 会话
- `working_directory`：任务工作目录

executor 的 CLI 参数如何映射到这些字段，不由 role 或路由配置定义。

### 6.2 响应

executor 返回的 ACP 结果至少能映射为：

```yaml
status: completed | failed | blocked
role: dev
requested:
  executor: omp
  model: deepseek
selected:
  executor: omp
  model: deepseek
fallback_applied: false
result: ...
```

`status=blocked` 表示任务没有形成可交付结果，例如所有候选模型均不可用或 brief 缺失。`status=failed` 表示已启动目标但执行失败。两者不得混用。

## 七、主 agent 调度职责

主 agent 负责：

- 给每次子 agent 派发提供明确 role 和 brief
- 在需要时显式覆盖 executor/model
- 接收并检查路由解析结果
- 看到降级时判断是否接受继续执行
- 根据子 agent 的最终结果决定是否重派
- 不把模型选择责任下放给 role 文件

子 agent 负责：

- 按 brief 和 role 文件执行任务
- 不自行修改路由配置
- 不因执行失败自行切换模型
- 在报告中保留实际执行目标和边界问题

## 八、验证标准

实现本协议的运行时适配器时，至少验证：

1. 无配置时，主 agent 和子 agent 均解析为 `omp + DeepSeek-V4.1-Flash`
2. `dev` 能解析为 `omp + deepseek`
3. `architect` 能解析为 `omp + minimax-k3`
4. `minimax-k3` 不可用时，`architect` 解析为 `omp + deepseek`
5. 所有候选不可用时，不启动任务并返回明确状态
6. role 路由不会改变主 agent 的默认目标
7. 显式请求覆盖 role 配置
8. 配置非法时快速失败，不静默使用默认值
9. 子 agent 启动后的执行失败不会触发静默模型切换
10. ACP 请求和响应包含实际 executor、model 与降级信息

## 九、与既有协议的关系

- 继续复用主 agent 持有全局视图、子 agent 只读 brief 的协作边界
- 不修改任何 role 的能力定义
- 不把模型路由写入角色原则
- 修订旧的“无需 ACP 调用协议”表述为“agents 不自建通信层，使用 ACP 调用本地 CLI”
- `.pb-agents/` 的框架 copy 与项目配置例外区按本协议执行
