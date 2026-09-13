# 主 agent 裁决记录 · pr-001 第 2 轮（阶段 5）

**迭代**: 0021-confirmation-inbox-and-event-push ｜ **阶段**: 5（PR 实现）｜ **日期**: 2026-09-13
**输入**: `clarifications/verify-pr-001-20260913-131042.md`（pr-001 首轮独立验证报告，结论 PASS，但列出偏差 #1~#5，其中 #1 判为「高」）
**性质**: 主 agent 对偏差 #1 的**合并前裁决策略**与**行为契约**；本文件是 pr-001 第 2 轮 dev 与复验的验收标准来源之一（与 PR 文件 6 条验收标准、`prs/pr-001-tasks.md` T1~T6 并列）。

---

## 一、裁决（偏差 #1：非 `bEs` 写类工具在 `allow` 档被静默拒绝）

**采纳**：偏差 #1 是**本 PR 引入的行为回退**，且**无下游 PR 承接**（pr-002 只注入 ACP 权限门的钩子），**不得随本 PR 合入**。pr-001 在第 2 轮补齐该覆盖面前，不允许 merge 进迭代分支。

**依据**（验证报告的可复查证据）：
- omp 18.0.11 在 `--approval-mode always-ask` 下，对 tier ≥ `write` 的工具**一律**叠加工具审批门（`elicitation/create`，`enum=["Approve","Deny"]`）；该门与 ACP 权限门（只覆盖 `bEs={bash,edit,delete,move}`）是两层。
- 首轮实现只对「刚通过 ACP 权限门」的 toolCall 答 `Approve`（单槽凭据 `_approvedToolCallId`）⇒ `write` 等不经 ACP 权限门的工具**永远无凭据** ⇒ 恒答 `Deny`。实测 `write`：无上浮、模型侧 `Tool call denied by user: write`、文件未创建；改动前（`yolo` 档）同一调用正常执行。

**不构成需求变更**：`demand.md` 的功能来源是 W3「agent 中需要用户确认的（受门禁工具调用）单独一栏 + 交互确认」。`always-ask` 下 `write` 属**受门禁**调用 ⇒ 其正确形态是**上浮给人裁决**（F02/F03/F04/F05 的同一套机制），而不是无人工介入地拒绝。故本项**不是**「需要改需求才能解决」的问题，**不写入** `deferred-demand-changes.md`，**不回退**阶段，由本阶段直接解决。

## 二、第 2 轮行为契约（C1~C6，作为追加验收项）

- **C1（不得静默拒绝）**：`allow` 档（含 `always-ask` argv）下，**任何**工具审批门都不得在用户未裁决的情况下被拒绝。工具审批门（`elicitation/create`，`message` 形如 `Allow tool: <toolName>…`、`requestedSchema.properties.value.enum = ["Approve","Deny"]`）必须经 `onPermissionRequest` 钩子**上浮**，由裁决结果决定回包；上浮项须能被 pr-002 的 pending 表承接（钩子入参须携带足够的关联与展示信息：工具名、请求方给的选项集合）。
- **C2（不得重复提问）**：同一 toolCall 若已在 ACP 权限门获得用户放行，其紧随的工具审批门**不再上浮**（直接回 `Approve`）。判定必须基于**该次放行的显式关联**，不得使用「最近一次放行」的单槽凭据语义（见 C4）。
- **C3（非交互安全默认）**：未配置钩子时不得默认放行；保守拒绝/`decline`，且不得让轮次崩在协议校验里。
- **C4（消除误放行窗口）**：验证报告偏差 #4 的确定性复现（`permission(call_A)→allow` 后，窗口内与 call_A 无关的同型门被答 `Approve`）**必须消失**：改为拒绝或上浮，且有一个 fake 层用例固定该行为。
- **C5（非审批 elicitation 不变）**：`ask` 等非审批 elicitation 维持 `decline`（本迭代不改该产品面；连带面按偏差 #5 登记）。
- **C6（M4 不回归）**：`bash` 等 `bEs` 工具的「上浮→裁决→真执行 / 真拒绝」双向真实 omp 行为**逐条保持**（首轮证据有效，第 2 轮须复跑确认未回归）。

## 三、第 2 轮附加交付项

1. **T5 证据落盘**（对应验证报告偏差 #3、T5.1/T5.2/T5.4 的 partial）：把 M4 根因定位的原始证据写成 `<迭代工作区>/docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/pr-001-m4-evidence.md`——含**argv 逐字列表**（含/不含 `--no-session` 两侧）、**原始帧原文**（权限请求帧 / 客户端应答帧 / 工具审批门 elicitation 帧）、**0/1/100/1000ms 四档对照表**（修复前/后）、以及双层门（ACP 权限门 vs 工具审批门）的 omp dist 代码位置引用。
2. **回归**：`node --test oamp/test/tool-permission.test.js`、`node --test oamp/test/acp-daemon.test.js`、`node --test oamp/test/*.test.js` 全绿；既有同步 `'allow'`/`'deny'` 用例与一次性 `yolo` 断言**逐字不变**。
3. **真实 omp 双向实测（write 场景）**：`write` 经上浮裁决后**真执行**（带副作用文件证据）；拒绝后**不执行**；判据仍为模型侧工具结果，审计行不作判据。
4. **文件范围不变**：仍只写 `oamp/src/acp-client.js`、`oamp/test/tool-permission.test.js`、`oamp/test/acp-daemon.test.js`（另加上述 `clarifications/` 证据文件一份）。

## 四、不阻塞本轮、按偏离登记处理

- **偏差 #2（架构 §9.4.3 D3 行误述「daemon 常驻路径不带 `--no-session`」）**：确认属实（`acp-client.js:126` 无条件追加）。登记为文档偏差，由阶段 6 汇总时回填 `architecture.md`，**不阻塞** pr-001。
- **偏差 #5（`elicitation.form` 连带面：`ask` 工具对模型可见）**：登记为**已知连带面 + 下一迭代候选**（`ask` 的 elicitation 是否纳入上浮面），本迭代不扩范围。
- **偏差 #3 的判据补强**：本裁决第三节第 1 条即该项的处置；此外「证据落盘路径」建议在下一迭代的任务图规范中写成硬判据（记为下一迭代候选）。
