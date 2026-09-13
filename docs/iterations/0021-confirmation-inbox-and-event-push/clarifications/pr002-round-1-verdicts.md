# 主 agent 裁决记录 · pr-002（阶段 5 · 次波）

**迭代**: 0021-confirmation-inbox-and-event-push ｜ **阶段**: 5（PR 实现）｜ **日期**: 2026-09-13
**输入**: `prs/pr-002-tasks.md`（planner 产出，提交 `70c8877`，6 任务 T1~T6）+ PR 文件 7 条验收标准 + 已合并的 pr-001 / pr-003 实际代码
**性质**: 主 agent 对 planner 报告的 4 项 `[model_inferred]`（**经用户真实阻塞式确认**）与 6 项疑问的裁定。本文件是 pr-002 的 dev 与 verifier 的验收标准来源之一。

---

## 一、`[model_inferred]` 项的用户确认（**真实阻塞式转呈，2026-09-13**）

| # | planner 的 `[model_inferred]` 验收标准 | 用户裁决 |
|---|---|---|
| MI-1 | 钩子的会话身份（`chat_id` / `agent_id`）在 **`ContextPool` 侧注入**（而非 agent.js 侧） | **`user_confirmed`：ContextPool 侧注入** |
| MI-2 | 工具审批门的 `title` = **原样透传 elicitation 的 `message`**（含 `Allow tool: <tool>` 与路径/命令详情）并截断 120 字符 | **`user_confirmed`：透传 message（截断 120）** |
| MI-3 | 失效路径落点 = **轮次 settle 按 `chat_id` 清扫 + SIGINT 前全量清扫（先于 deregister）** | **`user_confirmed`：轮次 settle + SIGINT 全量** |
| MI-4 | 档位判定点取 **architecture §7 T-05 口径**（`ContextPool` 单点判定，仅 `permission==='allow'` 注入） | **`user_confirmed`：取架构口径（ContextPool）** |

四项均按 planner 推断口径生效，不再保留 `[model_inferred]` 待确认状态。

## 二、疑问裁定

- **Q1（pending 表如何同时覆盖两型钩子入参）—— 采纳 planner 口径**：两型共用**同一条** pending 表与**同一信封 1**，差异只在字段来源——ACP 权限门：`options` 逐字取 `params.options` 的 `optionId` 值域（`tool` = `toolCall.toolName`，可 `null`）；工具审批门：`options = ['Approve','Deny']`（`tool` 从 `message` 首行 `Allow tool: <tool>` 解析）。结算统一为 `resolve({ optionId: option_id })`（两型的 `option_id` 都等于可原样回显给 ACP 的 `optionId`）。**审批门放行语义只认 `'Approve'`**（pr-001 既有语义，本 PR 不重复实现）；**不得引入第二套去重**——放行凭据的 FIFO 一次性抵扣由 `acp-client` 承担。
- **Q2（pr-001 tasks §5 疑问 1 的承接检查项）—— 采纳结论并关闭该项**：读码证据表明 daemon 路径**只有** `task.timeoutMs` 透传给 `session.prompt`（`agent.js` 的两处 `setTimeout` 均属一次性路径与 shell 执行器），冻结唯一点在 `AcpClient` 的 `_request` 计时器 ⇒ **本 PR 不引入 agent 侧 task 级计时/取消**，与冻结语义无冲突。该结论以「diff 判据 + 行为判据」两条落进任务图（T5 验收 4/5），采纳。
- **Q3（档位判定点措辞差异）** —— 见 MI-4（用户确认取架构口径）。
- **Q4（`进程退出前发 cancelled` 的投递竞争）—— 采纳任务图的实现顺序约束，判据按可稳定观测者在两者中择一**：优先「假节点/对端实际收到该 `notice`」，退而「发送顺序先于 `agent.deregister` 的帧级或调用序证据」。**若两条都无法稳定观测，按 partial 报告给主 agent 裁决**，不得为了让判据变绿而删断言。
- **Q5（`API.md §7` 未列举 notice kind）—— 采纳：本 PR 对 `API.md` 零改动**（无待补项）。
- **Q6（不改 `oamp/test/helpers/**`）—— 采纳**：需要带 flag（`--tools on` / `--permission deny` 等）的实例时，由新测试文件照 `oamp/test/acp-daemon.test.js` 的 `startFlaggedAgent` 先例自建，不扩 harness 的公共面。

## 三、继承的硬约束

- **文件范围**（PR 文件 4 项）：`oamp/src/context-pool.js`、`oamp/src/agent.js`、`oamp/test/confirmation-roundtrip.test.js`（新建）、`oamp/test/context-pool.test.js`（如实现期需要）。**不得**触碰 pr-004 的文件面（`oamp/web/**`、`oamp/src/web.js`、`oamp/llms.txt`、`oamp/test/inbox-console.test.js`、`oamp/test/notification-scope.test.js`）与 `oamp/test/helpers/**`。
- **Router 零改动**（复用既有 `notice` 类型 + 扩 `kind`）；一次性 `omp -p` 与 `!` shell 路径零改动；`permission='deny'` 不注入钩子。
- 上游契约以**已合并的实际代码**为准（`oamp/src/acp-client.js` 的钩子入参两型与返回域），不以本文件转述为准。

## 四、Q7（dev 实现期上报，主 agent 裁决）

**问题**：`oamp/test/acp-daemon.test.js:665` 的「常驻路径 permission 审计」用例（真实 agent `--tools on --permission allow` + fake ACP 每轮发 `session/request_permission` + 真实 web，**无任何裁决方**）与 pr-002 的语义不相容——钩子注入后该轮无裁决方 ⇒ 永久挂起。dev 实测：base `c84233a` 单跑 1.5s PASS；带 pr-002 改动后 10s 超时 FAIL；oamp 全量 **322 tests / 321 pass / 1 fail**（唯一失败即此条）。该文件原不在 pr-002 文件面内。

**裁定：授权 (a) 最小连带更新，`oamp/test/acp-daemon.test.js` 由本裁决显式加入 pr-002 文件面（第 5 个文件）。**

- **改法**：该用例喂入 ACP 权限请求后，经 pr-003 已合入的 `POST /api/confirmations/<id>/decision`（`option_id: allow_once`）放行；**既有断言逐字保留**（`TOOL_APPROVED` 四键非空 + 第 2 轮 N=N），不得削弱或删除。
- **理由**：这是 **L1-2（`allow` 档由「自动放行」改为「上浮给人裁决」，`user_confirmed`）的必然连带**——该用例原先依赖「无裁决方也自动放行」这一已被本迭代推翻的前提。不修则 T6 验收 2「oamp 全量全绿」无法满足，违反迭代合并门。
- **边界**：除该文件外其余「其他测试文件」仍为禁改；若全量复跑暴露同类不相容用例（同因），按同一口径一并处理并逐条报告（文件:行 + 改法 + 保留的断言）。
- **收口判据**：`node --test oamp/test/*.test.js` 全绿 + 逐用例对照（改前断言 vs 改后断言）。
