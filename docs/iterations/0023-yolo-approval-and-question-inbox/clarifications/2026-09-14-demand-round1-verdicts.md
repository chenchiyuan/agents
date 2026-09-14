# 0023 demand 第 1 轮 · 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `clarifications/2026-09-14-demand-round1.md` §7 待转呈清单（P1~P13 / Q3′ / N 系边界，共 15 行）
**性质**: `user_confirmed`（6 组裁决，用户全部采纳推荐项）
**用途**: demand 第 2 轮派发的输入

---

## 本轮裁决

### P1 · 默认链路下「agent 提问」的承载 —— **hub 自建 host tool**

- 默认链路保持 `--mode rpc`；hub 经 RPC 的 **`set_host_tools`** 为每个会话注册一个提问工具（如 `ask_user`），agent 主动调用 ⇒ `host_tool_call` 帧 ⇒ hub 上浮到收件箱 ⇒ 用户作答 ⇒ `host_tool_result` 回传 ⇒ 该轮继续。
- **主 agent 实测证据（本会话，可复跑）**：`probes/probe-r1b-host-tool-ask.mjs`（+ `r1b-host-tool-ask-output.txt`）——注册 `ask_user` 后，模型主动调用：`host_tool_call{toolName:'ask_user', arguments:{question:'…', options:[…]}}`，回 `host_tool_result` 后 `agent_end{isTerminal:true}` 正常收尾。命令面：`set_host_tools` 回包 `{success:true, data:{toolNames:['ask_user']}}`。
- **同时实测的否定证据**：`probes/probe-r1-ask-tool.mjs` —— RPC 的工具清单 = `["read","bash","edit","eval","glob","grep","task","hub","todo","web_search","write"]`，**无 `ask`**；模型自述 "No ask tool"（与 demand 的 K1 一致）。
- **主 agent 补充口径（非用户决策点）**：`acp` 链路无 `set_host_tools` 对应机制，其提问承载 = **原生 `ask` → `elicitation/create`**（demand 的 K3 事实，oamp 今天只认 `Approve|Deny` ⇒ 需扩展）。因此本迭代的提问通道按**协议能力位**表达：默认 rpc 用 host tool、acp 用原生 elicitation，**两者都必须落进同一收件箱与同一 `kind:'question'` 信封形状**。
- **已否决**：改用 `--mode rpc-ui`（改所有实例启动模式 + `PI_NO_PTY` 副作用未实测）；只在 acp 链路可提问（与用户要求不符）。

### P2 · 档位取值域 —— **只落 `{always-ask, yolo}`（默认 yolo）**

- 配置面只接受两值；`tier` 为臆造名（omp 侧叫 `write`），不入取值域。
- 已否决：三档（含 `write`）。

### P3 · 提问形状与作答 —— **四项全部采纳**

| # | 采纳 |
|---|---|
| P4 | 支持「无选项的纯自由文本提问」 |
| P5 | 多问题 = **一问一条**（复用现有裁决面，不引入 `questions[]` 大信封） |
| P6 | 回答**必须回传自由文本**，并停掉现在「文本 → 当成一条 chat 输入」的旁路 |
| P7 | 不提供「无人时自动拒绝」兜底（未作答则一直等） |

### P4（组）· 阻塞与通知 —— **三项按推荐**

| # | 采纳 |
|---|---|
| P13 | 提问类同样「默认阻塞、无上限、无自动裁决、不超时自动选」 |
| P11 | 不新增通知事件类型（沿用 `confirmation_required`） |
| P10 | 能力位 `approvalGate` 不随档位变（档位由 profile 声明表达） |

### P5（组）· 审计与口径 —— **五项按推荐**

| # | 采纳 |
|---|---|
| P9 | **不补偿** yolo 后消失的 ACP 审批审计行（登记为已知代价；`TOOL_CALL` 保留）——用户显式接受该代价 |
| P8 | 按提案登记 0021/0022 的口径更替清单（取代 / 保留 / 条件化 / 改写 / 收窄 五类，见 round1 §5-P8 表） |
| Q3′ | `always-ask` 档**必须验收**（它是 deny 能力的唯一载体） |
| P12 | `permission === 'deny'` **优先于**显式 `--approval-mode`（deny ⇒ 强制 always-ask） |
| P3 | `deny ⇒ always-ask` 的解析归属留 `[架构待填]`（需求只钉行为 + 「唯一汇聚点」硬约束） |

### N 系边界 —— **N1~N11 全部保留**

N1 不落中间档 / N2 不做自动裁决策略与超时退化 / N3 不改 omp / N4 不新增工具审计面 / N5 一次性与 shell 路径不上浮 / N6 不新增通知事件类型 / N7 不做通知分级与其它入口 / N8 不改服务边界 / N9 不做历史台账 / N10 零第三方依赖 / N11 不换第三栏载体。

---

## demand 第 2 轮的处理清单

1. 回收 13 项 `[model_inferred]`（P1~P13）→ `[user_confirmed]`，其中 P1 按「默认 rpc = host tool；acp = 原生 elicitation；同收件箱同形状」落字。
2. N1~N11 由 `[model_inferred]` 转 `user_confirmed`。
3. 第二段按 P8 冻结「0021/0022 口径更替清单」（五类处置）。
4. 把主 agent 的两条探针证据（R1 否定 / R1b 肯定）登记进第一段的 `实测` 来源。
5. 收敛后写 `demand.md` v1.0.0，`model_inferred` 归零；对最终草稿再跑一次六维诊断。
6. **不得**新增功能点；`[架构待填]` 项（`deny ⇒ always-ask` 的解析归属、提问形状的最终字段名、`rpc` 的 host tool 注册时机等）保持留白交阶段 3。
