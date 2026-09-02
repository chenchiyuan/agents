# 需求合同：模型派发

## 澄清依据

本合同基于以下已生效资料整理，不新增未确认的产品判断：

1. **模型派发协议**：`principles/execution/model-dispatch-protocol.md`。该协议已定义派发目标的 `executor + model` 两个维度、项目级路由配置、主/子 agent 的作用域、解析期 fallback、统一 ACP 请求/响应语义、凭据边界和运行结果的可审计要求。
2. **历史澄清记录**：`docs/iterations/0000-project-design/clarifications/model-dispatch-protocol/round-1.md`。Round 1 状态为“生效”，其中 CLR-MD-001 至 CLR-MD-008 的结论来源均为 `user_confirmed`，本迭代直接复用这些结论：
   - 主 agent 与子 agent 的默认目标均为 `omp + gpt`；`executor` 表示本地 CLI，`model` 表示 CLI 使用的模型。
   - 项目级路由配置固定归属于 `.pb-agents/config/agent-routing.yaml`；该配置由业务项目维护，安装或升级不得覆盖、删除；框架 copy 与运行记录的归属不因此改变。
   - 模型绑定放在独立路由配置中，role 文件只描述能力；role 路由只对子 agent 生效，不隐式改变主 agent。
   - 使用显式 fallback 链，并在任务启动前解析模型时降级；链尾回到默认 `omp + gpt`；子 agent 启动后的执行失败不得静默切换模型重跑。
   - agents 通过 ACP 调用本地 CLI，不管理 provider、endpoint、API key 或其他凭据；不同 CLI 复用统一语义派发契约。
   - 统一 ACP 派发契约至少表达 `role`、`executor`、`model`、`fallback`、`brief` 和 `working_directory`；CLI 参数映射留在 ACP/CLI 适配端。
3. **本阶段边界**：本阶段只把已确认协议收敛为可交给功能规格阶段的需求合同，不锁定配置加载器、ACP adapter、CLI 调用器或其他技术实现方案。

上述依据中的结论均标记为 `user_confirmed`；本合同不保留 `model_inferred` 结论，也不引入待用户确认项。

## 需求结论

### 1. 目标与价值（`user_confirmed`）

本迭代要把已确认的模型派发协议落成为主 agent 可使用的派发能力：主 agent 能为子 agent 按统一规则确定执行目标、在启动前处理模型不可用情形，并通过统一 ACP 语义发起派发与接收结果。

该能力的价值是让模型与本地 CLI 的选择可配置、可预测、可审计，同时保持 role 能力定义、provider/凭据责任和既有主/子 agent 协作边界不被派发逻辑侵入。

### 2. 派发目标与默认行为（`user_confirmed`）

- 一次派发目标由两个独立维度组成：`executor`（本地 CLI）与 `model`（该 CLI 使用的模型）；二者组合才是完整目标，例如 `omp + gpt`。
- 主 agent 的默认目标固定为 `omp + gpt`。
- 子 agent 的默认目标固定为 `omp + gpt`。
- 主 agent 由人工管理；子 agent 的 role 不得隐式改变主 agent 的目标。主 agent 只有在自己的派发请求中显式指定时，才改变自身的 `executor` 或 `model`。
- 子 agent 指定 role 后，可按该 role 的路由得到专用目标；未配置路由的 role 使用子 agent 默认目标。

### 3. 配置归属与模型绑定（`user_confirmed`）

- 项目级路由配置路径固定为 `.pb-agents/config/agent-routing.yaml`。
- 该文件属于业务项目的可写配置，由项目维护；agents 的安装与升级不得覆盖或删除它。
- `.pb-agents/roles/`、`.pb-agents/principles/` 等框架 copy 仍是只读归属；`.pb-agents/project/` 仍用于运行记录，路由配置不承担运行记录职责。
- 模型绑定必须位于独立路由配置中，不能写入 role 文件；role 文件继续只描述 role 的能力，不绑定部署模型。
- 配置至少能够表达版本、主 agent 默认目标、子 agent 默认目标，以及按 role 指定的子 agent `executor`、`model` 和可选 fallback 列表。
- 配置缺失时使用内置默认值，即主/子 agent 均为 `omp + gpt`。
- 配置存在但语法或字段非法时，必须快速失败并报告具体错误，不得静默退回默认值。
- 路由配置不得保存 API key、token、密码或要求 agents 解析的 provider secret。

### 4. 路由解析范围与优先级（`user_confirmed`）

- role 路由只对子 agent 生效；主 agent 不因当前 role 自动切换模型。
- 对子 agent，路由优先级从高到低为：派发请求显式指定的 `executor`/`model` > `roles.<role>` > `defaults.subagent`。
- 显式指定只覆盖对应字段；未显式指定的字段继续按优先级解析。
- 主 agent 负责为每次子 agent 派发提供明确 role 和 brief，并可按需要显式覆盖 `executor` 或 `model`；模型选择责任不下放给 role 文件。

### 5. 启动前模型降级（`user_confirmed`）

- fallback 必须是显式、有顺序的模型候选链，只对模型生效，并在同一个 executor 内解析；不得借 fallback 静默替换 executor。
- 目标模型不可用时，按配置的 fallback 顺序选择第一个可用模型。示例链为 `minimax-k3 → deepseek → gpt`。
- 未配置 fallback 时，默认以 `defaults.subagent.model` 作为最后候选；当前默认值为 `gpt`，因此链尾回到 `omp + gpt`。
- 当前目标已经是 `gpt` 时，不得重复尝试 `gpt`。
- 模型可用性由本地 executor/ACP 能力报告；agents 不读取凭据，也不猜测凭据状态。
- executor 本身不可用时，不得静默切换到另一个 executor，必须报告不可用。
- 目标模型及全部 fallback 均不可用时，不启动任务，并返回明确的 `blocked` 或 `failed` 状态。
- 降级只能发生在任务启动前。子 agent 启动后的执行失败不得由派发能力静默切换模型并重跑；是否重新派发由主 agent 根据任务结果显式决定。
- 发生降级时，结果必须能审计原始请求目标、实际选定目标、是否应用 fallback、候选链和降级原因。

### 6. 统一 ACP 派发契约（`user_confirmed`）

agents 与本地 executor 之间使用统一的 ACP 语义派发契约，不为每个 CLI 另建一套 agents 路由协议，也不在 agents 项目内自建通信服务。

请求至少包含以下语义字段：

- `protocol: acp` 与 `protocol_version`；
- `role`：本次子 agent 使用的 role 名称；
- `executor`：本地 CLI 名称；
- `model`：解析后的实际模型；
- `fallback`：尚未使用的备用模型，用于审计和 executor 侧诊断；
- `brief`：任务简报路径，子 agent 不继承主 agent 会话；
- `working_directory`：任务工作目录。

响应至少能够表达：

- `status` 为 `completed`、`failed` 或 `blocked`；
- `role`；
- `requested` 目标（请求的 executor/model）；
- `selected` 目标（实际使用的 executor/model）；
- `fallback_applied` 及可审计的降级信息；
- 执行结果。

`blocked` 表示任务未形成可交付结果，例如所有候选模型不可用或 brief 缺失；`failed` 表示目标已启动但执行失败，二者不得混用。CLI 内部参数如何映射到上述字段不属于本需求合同的技术选型范围。

### 7. 凭据与职责边界（`user_confirmed`）

- agents 只通过 ACP 调用本地 CLI，例如 `omp`、`codex`、`codebuddy`。
- provider 注册、provider 实现、endpoint、API key、登录态及其他认证/凭据由各自本地工具或宿主环境负责；agents 不管理、不存储、不解析这些信息。
- CLI 内部参数、认证方式、会话管理、重试和任务执行逻辑不属于本迭代的派发需求。
- 子 agent 按 brief 和 role 文件执行，不自行修改路由配置，不因执行失败自行切换模型，并在报告中保留实际执行目标和边界问题。

### 8. 本迭代包含与不包含（`user_confirmed`）

**包含：**

- 将上述默认目标、独立 executor/model 维度、role 路由作用域、显式优先级和启动前 fallback 规则收敛为可验证的派发行为；
- 让主 agent 能使用统一 ACP 语义派发子 agent，并获得包含实际目标与降级信息的结果；
- 固化 `.pb-agents/config/agent-routing.yaml` 的项目配置归属及凭据禁入边界；
- 保持 `completed`、`failed`、`blocked` 的结果语义可区分。

**不包含：**

- 配置加载器、ACP adapter、CLI 调用器的具体技术实现或选型；
- `omp`、`codex`、`codebuddy` 的 CLI 内部参数映射、provider 实现、endpoint/API key/登录态及凭据管理；
- CLI 内部会话管理、重试、任务执行逻辑，或子 agent 启动后的自动换模型重跑；
- role 文件的能力定义重写或模型绑定；
- agents 自建通信服务或其他无关协作协议重构；
- 超出本合同所述模型派发、路由、fallback、ACP 语义和职责边界的新增功能。

### 9. 预期效果与阶段交接标准（`user_confirmed`）

进入功能规格阶段后，应能将本合同拆为独立可验证的功能点，至少覆盖：默认目标、role 路由作用域、显式覆盖优先级、配置归属与非法配置处理、fallback 解析时机与链尾、全候选不可用阻断、ACP 请求/响应字段、降级审计、凭据边界，以及启动后失败不自动换模型。

本合同完成阶段 1 的交付条件：两段内容均完整；所有结论均为 `user_confirmed`；没有活跃冲突或待用户确认项；未锁定配置加载器、ACP adapter 或 CLI 调用器的实现方案。

**待确认疑问：无（`user_confirmed`）。**
