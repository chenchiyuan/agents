# F06：模型指定与默认

**功能 ID**: F06
**来源**: `demand.md` D-4（agent 协议调用需支持指定模型；默认 gpt-5.6）；可行性依据 V-2（默认模型实测可用）
**迭代**: 0011-chat-context-protocol

---

## 用户价值

用户能为每次提问挑选模型（不同任务不同取舍），不指定时有稳定的默认值，不用每次填写。

## 验收标准

1. **默认模型**：用户未指定模型时，调用使用系统默认模型「gpt-5.6」（唯一标识形式 = `openai/gpt-5.6-luna`；生效点 = ACP session 的 model 配置项；⚠️ 该默认值的可用性待确认，见 `architecture.md` §7.5 / L1-6）（D-4）。
2. **可指定**：用户可为一次提问指定模型；指定后该轮使用的模型为指定值，且不影响同一 chat 中未指定轮次继续使用默认值（D-4）。
3. **指定优于默认**：同一 chat 中一轮显式指定、一轮不指定时，两轮可观察到使用了不同模型（判定依据 = 每轮输出记录中的 `model` 字段，取自 ACP session 回读的**实际生效**模型标识）。
4. **不可用时明确失败**：指定了一个当前不可用的模型 → 该轮以明确失败呈现（chat 状态为「失败」+ 可见错误信息），不静默回退到默认模型继续作答 `[model_inferred]`。
5. **可用取值来源**：可指定的模型为用户本机已配置的模型（本机实测可用值见 V-2）；可用清单 = omp 自身模型注册表（本系统不解析、不复制；ACP `session/new` 的 `configOptions.model.options` 天然提供清单，本迭代不做清单接口），校验方式 = 以 ACP 切换模型时的报错为准（未知模型 → 明确失败）。

## 边界（不包含）

- 不做模型自动选择 / 能力探测 / 成本优化 / 多模型并行投票（demand 外）。
- 不做 token 用量与费用统计、配额限制（demand 外）。
- 不做远程模型接入与凭据管理（V-2 为本机已配置模型；凭据责任沿用 0010 边界）。
- 默认值在环境变量 / 配置文件层面的覆盖优先级不在本卡锁定（落地优先级链 = payload > `OAMP_OMP_MODEL` > `config.defaults.model` > 内置默认，逐键 env 恒胜——见「架构维度」）。

## 架构维度（阶段 3 已填，2026-09-10；详见 `architecture.md` §7、§7.5）

- **传递形态与校验**：web → agent 的 `task.request` payload 携 `model?`（字符串，校验 `^[A-Za-z0-9._/-]{1,128}$`，非法 → 400/拒收）；agent 内解析后在**首轮**随进程启动参数 `omp acp --model <model>` 生效，**后续轮次**用 ACP `session/set_config_option{sessionId, configId:'model', value}` 切换（实测 V-6/V-8：模型是 session 级设置，切换**不重建进程、不清空上下文**——这是 F05-1 与 F06-2/3 能同时成立的关键）。
- **不可用模型的判定与错误面**：判定 = `set_config_option` 返回 JSON-RPC error（实测 V-7：`Unknown ACP model: <x>`，**可在 prompt 前失败**）；错误面 = 该轮 `task.result{state:'failed', error:'model_unavailable'}` → chat 状态「失败」+ 一条失败 out 记录（text = 「模型不可用：<model>」）；**绝不静默回退默认模型**（对应验收 4）。可用清单来源 = omp 自身模型注册表（本系统不解析、不复制；ACP `session/new` 返回的 `configOptions` **数组**中 `id === 'model'` 项的 `.options` 天然提供清单（须按数组形态 `find` 读取），本迭代不做清单接口/下拉）（对应验收 5）。
- **默认值优先级链**：`payload.model` > `OAMP_OMP_MODEL`（env） > `config.defaults.model`（`oamp/config.json`） > 内置 `openai/gpt-5.6-luna`；解析在 agent 侧（真正生效点），**每轮独立解析**（未指定的轮次回到默认链，因此"指定一轮不影响后续未指定轮次"由构造保证）（对应验收 1/2/3）。
- **审计形态**：每条 out 记录的 `model` 字段写**该轮实际生效**的模型标识——由 agent 从 ACP session 返回的 `configOptions` 数组中 `id === 'model'` 的 `currentValue` 回读后上报（**不是用户输入的回显**；回读失败时为 `null`，不用请求参数顶替）；前端在输出气泡元信息行展示该模型 → 验收 3"两轮可观察到使用了不同模型"由此判定。
- **默认模型可用性（已确认，2026-09-10 用户选择 (a)；见 `architecture.md` L1-6/§7.5）**：实测本机 `openai/gpt-5.6-luna` 间歇性无响应（ACP 与一次性路径同时段同现象 → 上游 provider 问题，非本架构缺陷）。**裁定：内置默认保持 `openai/gpt-5.6-luna`**（配置面 `defaults.model` / `OAMP_OMP_MODEL` 可一行覆盖）+ **上线前两路径对照复测门禁**（§7.5 第 4 条；若复测仍高频挂起，再由用户决定切换备选 `deepseek/deepseek-v4-flash`）；超时 → cancel → kill → `context_reset` 提示为必需兜底；不采用 `--thinking off` 规避。
