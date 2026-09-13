# 阶段 3 · L1 裁决记录 + L1-2 的实测证据

**方式**: 主 agent 真实阻塞式转呈（`ask`）。architect 首轮列出 4 项 L1 + 1 项覆盖范围疑问，用户逐项裁决；其中 **L1-2 用户要求「先实测再定」**，主 agent 随即用真实 omp 做了受控实测（记录见下），实测结果证实架构师推断后再定。

## 一、L1 裁决

| # | L1 内容 | 用户裁决 |
|---|---|---|
| **L1-1** | 挂起期间**冻结轮次超时计时**（`clearTimeout` + 记 `remainingMs`，裁决后重启） | **采纳**（推荐项） |
| **L1-2** | ① 权限钩子由同步扩为可返回 **Promise / `{optionId}`**；② **`allow` 档 argv `--approval-mode yolo` → `always-ask`** | **先实测再定 → 实测证实推断后采纳**（含**答复链路修复**义务，见下） |
| **L1-3** | agent ⇄ web 的确认/裁决关联消息：**复用 `notice` + 扩 3 个 `kind`**（`confirmation_request` / `confirmation_decision` / `confirmation_cancelled`）⇒ **Router 零改动** | **采纳**（推荐项） |
| **L1-4** | 通知能力边界 = **页面内 Notification API**（不引入 Service Worker / Web Push / VAPID） | **采纳**（推荐项） |
| 覆盖范围 | 上浮覆盖 = **仅 `omp-daemon` 常驻路径**；一次性 `omp -p` 与 `!` shell 路径维持现状（无 ACP 应答通道） | **采纳**（推荐项） |

## 二、L1-2 的受控实测（2026-09-13，真实 omp；证据可复跑）

**方法**：直接以 oamp 的 `AcpClient` 起真实 `omp acp --no-skills --no-rules --no-session --approval-mode <档>`，挂 `onPermissionRequest` 钩子，prompt 要求真实执行 shell 工具；另经 hub API 对 `dev` 角色（`allow` 档 ⇒ `yolo`）派发同型任务，读 agent 侧日志。

| # | 实测项 | 结果 | 证据 |
|---|---|---|---|
| M1 | **`yolo` 档（现状 `allow`）是否发权限请求** | **不发** —— 工具直接执行，日志**零** PERMISSION/APPROVED 行 | `oamp/.runtime/cluster/pb-dev.log`：`TOOL_CALL … kind=execute title="$ echo L1-2-PROBE" status=completed`（无权限行）；调用 `task-d3140142-…` 返回真实输出 |
| M2 | **`always-ask` 档是否发权限请求** | **发**，且**携带请求方选项集合**：`[allow_once, allow_always, reject_once, reject_always]`（title = `echo ALWAYS-ASK-PROBE`） | 受控脚本 `/tmp/probe-always-ask.mjs` 输出 `hookFired: 1`、`options: [...]`；审计序列 `ACP_READY → TOOL_APPROVED → TOOL_CALL` |
| M3 | **omp 的响应契约** | 读 `result.outcome = { outcome: 'selected', optionId }`；并以 `SEs.get(optionId)` 校验，**未知 optionId 直接抛错** | omp dist `cli.js` 决策段：`let T=h.outcome; … let R=SEs.get(T.optionId); if(!R) throw new X('Tool permission response used unknown option ID: …')` |
| M4 | **⚠️ 新现象（未解，须实现期查）** | 受控实测中 oamp 回了 `allow_once`、审计出 `TOOL_APPROVED`，但**模型侧收到的工具结果仍是「Tool call denied by user: bash」** ⇒ 现有自动答复路径**在真实 omp 上并未真正放行** | 同一脚本输出 `text` 字段逐字：「我调用了 bash…工具返回的原始结果只有一行：`Tool call denied by user: bash`」 |

**M1/M2 的结论**：架构师 L1-2 的 `[INFERENCE]` **被实测证实**——不改 argv 就**没有可上浮的请求**（功能不存在）。
**M4 的结论**：接线缝**存在但不通**——该路径因 `yolo` 档从不触发，**从未在真实 omp 上跑通过**。⇒ **「答复链路修复」为本迭代的硬义务**，落在承载 F02 / F04 的 PR，并须在实现期完成根因定位与修复（不得降级为文档说明）。

## 三、由裁决派生的实现义务（供阶段 4/5 消费）

1. **argv 档位改写**（`acp-client.js`）：`allow` 档 → `always-ask`（`deny` 档本就 `always-ask`，语义由"自动拒绝"改为"上浮后由人裁决/仍自动拒绝"由 L1-2 与 T-1 裁决共同界定）。
2. **答复链路修复**（M4）：确保 `allow_once`（及人裁决选定的 optionId）**在真实 omp 上被采纳并放行工具**；根因定位需覆盖：响应包形态 / 时序（是否需在特定时机回包）/ 与 `--no-session` 等因素的交互。
3. **选项集合原样呈现**：M2 实测的 4 项即 W2「确认选项」的真实来源；请求方 options 需**原样**进入 inbox 条目。
4. **超时三层封顶**：L1-1 的冻结计时须同时覆盖 ACP 层与 agent 层计时。
