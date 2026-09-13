# pr-002：agent 进程接线（上浮钩子注入 / pending 表 / 信封收发）

## 上下文摘要

在 agent 进程内接线上浮链路：`ContextPool` 增加并透传 `onPermissionRequest`（**仅 `permission === 'allow'` 时由 agent 侧注入**，`deny` 档不注入），daemon 任务生成 `confirmation_id`、登记本地 `pending` Promise 并发出 `notice{kind:'confirmation_request'}`；收到 `notice{kind:'confirmation_decision'}` 时按 `confirmation_id` 结算该 Promise、`confirmation_cancelled` 走失效路径。**不含既有测试断言改写**（既有断言不与之相撞，只新增断言）。**不承载 M4 答复链路修复**（该硬义务落 pr-001，本 PR 消费其成果）。约束：复用既有 `notice` 类型与 `sendNotice` / `handleNotice` 形状（Router 零改动）；一次性 `omp` 与 `!` shell 路径零改动。

## 涉及功能点

- F02
- F04
- F05

## 文件范围

- `oamp/src/context-pool.js`（修改：构造 opts 增加 `onPermissionRequest` 并透传给 `new AcpClient({ … })`〔检索式 `new AcpClient({`、`opts.onNotice`、`permission = 'allow'`〕）
- `oamp/src/agent.js`（修改：daemon 任务注入钩子与 `pending` 表〔检索式 `runDaemonTask`〕、池构造处〔检索式 `new ContextPool({`〕、`notice` 收发与 pending 结算〔检索式 `sendNotice`、`handleNotice`、`createTaskDeliverHandler`〕）
- `oamp/test/confirmation-roundtrip.test.js`（**新建**：agent 侧上浮 / 裁决结算 / 失效路径的行为断言）
- `oamp/test/context-pool.test.js`（修改：`onPermissionRequest` 透传断言；如实现期需要）

## 验收标准

- [ ] `permission='allow'` 的 daemon 路径上，受门禁工具调用触发权限请求后，agent 向发起者发出 `notice`，其 body 含 `kind: 'confirmation_request'`、`confirmation_id`、`chat_id`、`agent_id`、`tool`、`title`、`options`、`created_at`；其中 `options` **逐字等于请求方给出的选项集合**（不筛选、不增补、不翻译）。
- [ ] 收到 `notice{kind:'confirmation_decision', confirmation_id, option_id}` 后：该挂起被结算，ACP 侧回包的 `optionId` **等于** `option_id`；`allow*` 使轮次继续、`reject*` 按既有拒绝路径使该轮中止（`permission_denied`）。
- [ ] **作用域精确**：同时挂起两条（不同 `confirmation_id`）时，裁决其中之一只结算对应那条，另一条的轮次仍挂起（未推进、未中止）。
- [ ] 未知 `confirmation_id` 的裁决**静默丢弃**并留一行审计：不影响其它挂起项、不向浏览器/发起方回错误。
- [ ] **失效路径**：轮次被取消 / 上下文被淘汰 / agent 进程退出前，未裁决项发出 `notice{kind:'confirmation_cancelled', confirmation_id}`（或等价失效通知），且对应 `pending` 条目不再残留。
- [ ] `permission='deny'` 时**不注入**上浮钩子：不产生任何 `confirmation_request`，既有自动拒绝行为不变。
- [ ] 一次性路径（`omp -p`）与 `!` shell 路径不产生确认项，其 argv 与行为零改动。

## 参考资料

- docs/iterations/0021-confirmation-inbox-and-event-push/architecture.md（§3.1 L1-3、§4.2 M-3 / M-13、§4.3 Z-11 / Z-12、§5.3、§6.1~§6.2、§7 T-05 / T-06 / T-16、§9.4.2）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F02-confirmation-source-surfacing.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F04-decision-roundtrip.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F05-pending-block-semantics.md
- docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/arch-round-1-verdicts.md（L1-3 裁决；M2 的选项四项）

## depends_on

- pr-001-agent-permission-suspend-and-reply-fix.md（理由：本 PR 注入的钩子返回**未结算的 Promise**，该返回形态由 pr-001 扩展并在 `AcpClient` 侧消费；pr-001 之前 `_handleServerRequest` 把任何非 `'deny'` 的判定值（含未结算的 Promise）当作 allow **立即回包**，且 `yolo` 档下真实 omp **不发权限请求**（实测 M1：`yolo` 档零权限请求），钩子永不触发、`confirmation_request` 信封永不产生 ⇒ 本 PR 的验收标准一条也无法成立。证据：`oamp/src/acp-client.js` 中 `_handleServerRequest` 的 `this._permissionDecision(message, toolCall) !== 'deny'` 与 `_permissionDecision` 的 `if (verdict === 'allow' || verdict === 'deny') return verdict;`；`oamp/src/acp-client.js` 的 `start()` 中 `args.push('--approval-mode', this.permission === 'deny' ? 'always-ask' : 'yolo')`；`oamp/src/context-pool.js` 中 `new AcpClient({ … })` 的 opts 组装点；`oamp/src/agent.js` 的 `runDaemonTask` 注入点）

## batch

2
