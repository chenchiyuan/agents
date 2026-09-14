# 0023 开工前方案沟通记录（阶段 1 输入材料）

**日期**: 2026-09-14
**性质**: 用户原始表述 + 一手取证 + 用户已裁决项（`user_confirmed`）+ 已知冲突
**说明**: 本文件是 demand 角色的起点材料，不是需求合同；需求结论由 demand 产出到 `demand.md`。

---

## 一、用户原始表述（逐字）

> profile 应该默认使用yolo模式，同subagent； 只有在需求边界确认/澄清（本质是方案执行有歧义的时候）才会上浮到用户侧确认

**上下文**：用户此前问「subagents 模式下没那么多要确认的地方，对比实现差距」；主 agent 给出对比结论（subagent 的授权边界 = 父级 `task` 调用一次；hub 的授权边界 = 每次受门禁的工具调用，因为 profile 写死 `always-ask`）后，用户给出上述指令。

---

## 二、用户已裁决项（`user_confirmed`，2026-09-14）

### Q1（硬冲突）· yolo 与 deny 档
**裁决**：默认 yolo（无工具门）；当实例**显式** `--permission deny` 时，其 profile **自动切回 always-ask**（门存在才能拒绝），拒后仍然 `reject_once` + `session/cancel`，轮次以 `permission_denied` 收尾。两个能力都保留。

**为什么是硬冲突**：`yolo` 档下 omp **不发任何权限请求** ⇒ hub 看不到调用 ⇒ 现有 `deny`（靠门拒绝）物理上失效。

### Q2 · 上浮触发面
**裁决**：**只上浮 agent 主动提问**——
- RPC 路径：非门的 `select` / `confirm` / `input` / `editor`（现为自动回 `{cancelled:true}`）→ 进收件箱；
- ACP 路径：非 `Approve|Deny` 的 `elicitation/create`（现为直接 `decline`）→ 进收件箱；
- 收件箱信封需区分两类：`kind: 'question'`（澄清）与 `kind: 'permission'`（工具门，yolo 下基本不出现）。

### Q3 · 档位可配性
**裁决**：**可配，默认 yolo**——新增配置面（`config.json` 第 5 键 `approval` + `agent start --approval-mode <always-ask|tier|yolo>`，具体取值域待阶段 2/3 定），沿用 pr-005 已实现的 `buildArgv` approval 入参位。

---

## 三、一手取证（本会话实测 / 实读）

| # | 事实 | 证据 |
|---|---|---|
| F1 | 现状 profile 写死 `always-ask`：`omp:rpc`、`omp:acp`（`omp:oneshot` 已是 `yolo`） | `oamp/src/launcher.js:22`、`:37`、`:52`；判定逻辑 `:130-132` |
| F2 | RPC 路径收到非门交互请求时**自动取消** | `oamp/src/rpc-client.js:341-343`（`INTERACTIVE_METHODS` → `{cancelled:true}`；展示类不回执 `:344`） |
| F3 | RPC 路径的门识别 = `method==='select'` **且** `title` 以 `Allow tool: ` 开头 | `oamp/src/rpc-client.js:335-339` |
| F4 | ACP 路径只认 `Approve`/`Deny` 两种 enum 的 elicitation，其余一律 `decline` | `oamp/src/acp-client.js:565-571` |
| F5 | 上浮钩子仅在 `permission === 'allow'` 档注入；`deny` 档不注入（直接走静态拒绝） | `oamp/src/context-pool.js:193-203`；`oamp/src/agent.js:698` 注释 |
| F6 | omp 的 `ask` 工具**只在 `session.hasUI` 为真时注册**；headless 下 `execute()` 抛 `Ask tool requires interactive mode` | `omp://tools/ask.md` §Flow 1-2 |
| F7 | `ask` 的 UI 出口 = `ui.askDialog()` → 回退 `ui.select(...)` + `ui.editor(...)`（自由文本） | `omp://tools/ask.md` §Side Effects |
| F8 | ACP 侧 `ask` 走 `unstable_createElicitation` → `elicitation/create` 请求 | omp dist `unstable_createElicitation`；对照 `oamp/src/acp-client.js:464-465` |
| F9 | `ask.timeout` 默认 `0`（不超时）；`recommended` 仅在超时时用于自动选 | `omp://tools/ask.md` §Notes / §Flow 3,8 |
| F10 | omp 的 `tools.approvalMode` **schema 默认就是 `yolo`**；subagent 强制 yolo，父 `task` 调用即授权边界 | `omp://approval-mode.md:22`（模式表）、`:156`（§Subagents） |
| F11 | **默认配置的 ACP 会话仍保留客户端权限门**；显式 `approvalMode: yolo` 才会连门一起跳过 | `omp://approval-mode.md:150` |
| F12 | 0021 的验收口径建立在「每次受门禁调用恰一条确认项」上（F01/F05） | `docs/iterations/0021-*/demand.md`、`prd/*.md`；0022 的 `pr-003` 亦沿用该口径 |
| F13 | 0022 已收口：`launcher.js` 的 `buildArgv` 已有 approval 三态入参位（`undefined` ⇒ profile 值 / `null` ⇒ 不追加 / 对象 ⇒ 传入值） | `oamp/src/launcher.js:103-104,114,130-132`；`docs/iterations/0022-*/prs/pr-005*.md` |

---

## 四、已知冲突与必须澄清的边界（候选，待 demand 收敛）

1. **Q1 的实现形态**：`--permission deny` 触发 profile 档位切换的落点在哪一层？（L1 profile 数据不能随 flag 变 ⇒ 可能是调用方覆写面，即 pr-005 的 `approval` 入参位）。
2. **「澄清上浮」在 RPC 下是否可行**：依赖 F6（`ask` 需 `hasUI`）。**必须先实测**：RPC 模式下会话是否具备 UI（审批门能到达即说明有 UI 上下文，但 `ask` 工具是否注册、走哪种帧未证实）→ 属阶段 3 首步的 M7 式实测。
3. **收件箱语义变更**：0021 的「每次受门禁调用恰一条」是否仍作为 `always-ask` 档的行为保留？（Q2 裁决只上浮提问 ⇒ 默认档下该口径不再被触发，但档位切回 `always-ask` 时需仍然成立）。
4. **ACP 侧非门 elicitation 的形状**：omp 的 `ask` 在 ACP 下发出的 `requestedSchema` 形状（单选/多选/自由文本/多问题表单）需实测；现有 7 字段信封（`confirmation_id/chat_id/agent_id/tool/title/options/created_at`）不足以承载多问题表单。
5. **`tier` 档是否要引入**：Q3 的选项里提到 `always-ask | tier | yolo`；`tier` 是否本迭代就做（语义 = 只问 exec 档，写类不问）？
6. **既有边界的存续**：0021/0022 的 N 系边界（N4 不入库、N5 不做开关、N8 服务边界、N10 零依赖）是否继续适用；0022 的 W8 依赖注入判据/能力位声明是否需随之更新（`approvalGate` 能力位取值在 yolo 默认下是否变 `degraded`/`no`）。

---

## 五、本迭代的迭代目标（一句话，待 demand 收敛）

把 oamp 的 agent 授权边界从「每次受门禁的工具调用」改为「任务级/默认放行」，即 **profile 默认 `yolo`**（同 subagent），并把用户确认面收敛为**仅上浮 agent 主动发起的提问/澄清**（RPC 非门交互请求、ACP 非门 elicitation），同时保留显式 `deny` 档的拒绝能力（该档自动切回 `always-ask`）。

---

## 六、主 agent 提示的风险（供 demand 参考，不作为结论）

| # | 风险 | 影响 |
|---|---|---|
| R1 | `ask` 工具在 RPC 模式可能**未注册**（`hasUI` 判定）⇒ 「澄清上浮」在默认链路不可实现 | 若实测如此，需改走其它机制（例如 ACP 链路专属，或要求 hub 侧另设提问通道），属**结构性**风险，必须先实测（阶段 3 首步） |
| R2 | `yolo` 默认后，工具调用**无任何人工确认**且**无审计**（`TOOL_APPROVED` 行随之消失） | 与 0021「受门禁调用恰一行审计」的可观测性能力相冲突，需要在 demand 里明确「审计面是否保留以及由谁承担」 |
| R3 | 0021 的验收口径被推翻 | 需在 demand/prd 里显式声明被取代的条款，避免两个口径并存 |
