# pr-001：agent 侧权限挂起链路与 ACP 答复链路修复

## 上下文摘要

把 `AcpClient` 的权限判定由「同步判定即回包」改为**可挂起等回包**（钩子返回值域扩为 `'allow' | 'deny' | {optionId} | Promise<…>`），`allow` 档 `--approval-mode` 由 `yolo` 改 `always-ask`（否则真实 omp 不发权限请求、上浮无来源），并冻结挂起期间的轮次计时。**含既有测试断言改写**（两处 argv 断言改 `always-ask`；同步返回 `'allow'`/`'deny'` 的既有用例逐字保留）。**承载 M4「答复链路修复」**（本迭代硬义务）：现状回 `allow_once` 且审计 `TOOL_APPROVED`，真实 omp 上模型侧仍得 `Tool call denied by user`，修复判据 = **模型侧工具结果**且**双向**（放行真执行 / 拒绝真被拒），审计行不作证据。约束：不改 ACP 协议形状；一次性 `omp -p` 路径 argv 与行为零改动。

## 涉及功能点

- F02
- F04
- F05
- F12

## 文件范围

- `oamp/src/acp-client.js`（修改：`start()` 的 argv 档位段〔检索式 `--approval-mode`〕；`_handleServerRequest` 的 permission 分支、`_respond` 包形态与 `_permissionDecision`〔检索式 `session/request_permission`、`_permissionDecision`〕；`prompt` / `_request` 的计时器段〔检索式 `timeoutMs`、`_pending`〕；`onPermissionRequest` 的 JSDoc 返回值域描述）
- `oamp/test/tool-permission.test.js`（修改：既有 argv 断言 `yolo` → `always-ask`；补挂起期间不回包、`optionId` 回显、非法 `optionId` 回落的帧级断言）
- `oamp/test/acp-daemon.test.js`（修改：常驻路径 argv 断言 `yolo` → `always-ask`；**一次性路径的 `yolo` 断言保持不变**）

## 验收标准

- [ ] `node --test oamp/test/tool-permission.test.js` 全绿：钩子同步返回 `'allow'` / `'deny'` 的两条既有用例**逐字保留**（应答仍是 `allow_once` / `reject_once`，审计各恰一行）；`deny` 档的三步自动拒绝（回 `reject_once` → `session/cancel` → `prompt()` 结算抛 `permission_denied`）行为不变。
- [ ] 钩子返回未结算的 Promise 期间，对该 `session/request_permission` **不回包**（帧级证据：fake ACP 的帧日志中该请求的应答**晚于** Promise 结算）；结算后回包的 `optionId` = 钩子选定值（`{optionId}` 返回形态），而非恒为 `allow_once` / `reject_once`。
- [ ] 钩子返回的 `optionId` **不在**该请求 `options` 集合内时，回落 `allow_once` / `reject_once` 并记审计；fake ACP 侧不出现「未知 option ID」类错误（应答值恒为合法 `optionId`）。
- [ ] 挂起期间轮次计时**冻结**：单次挂起时长 > `timeoutMs` 时轮次仍未被 `cancel` / `kill`（子进程存活、`prompt()` 未以 `timeout` 结算），裁决到达后按剩余时间恢复并正常结算。
- [ ] `tools=true` 且 `permission='allow'` 时 argv 含 `--approval-mode always-ask`（`oamp/test/tool-permission.test.js` 与 `oamp/test/acp-daemon.test.js` 的对应断言已同步为 `always-ask`）；`permission='deny'` 与 `tools=off` 的 argv 形状不变；**一次性路径**（`omp -p`）argv 仍为 `yolo`。
- [ ] **M4（硬义务）**：以真实 `omp` 复跑受控探针（用 **daemon 真实 argv**，不带 `--no-session`）——① 放行路径下**模型侧工具结果等于工具真实输出**（不是 `Tool call denied by user: …`）；② 拒绝路径下**模型侧确实**得到 denied。**两条同时成立**才判定通过；`TOOL_APPROVED` / `TOOL_DENIED` 审计行**不得**作为判据。

## 参考资料

- docs/iterations/0021-confirmation-inbox-and-event-push/architecture.md（§3.1 L1-1 / L1-2、§4.2 M-1 / M-2 / M-12 / M-16、§4.4 顺序约束 5~6、§5.4、§7 T-05 / T-16、§9.4、§11.1 B-1 / B-2、§11.5 B-15 / B-15a / B-15b）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F02-confirmation-source-surfacing.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F04-decision-roundtrip.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F05-pending-block-semantics.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F12-upstream-protocol-unchanged.md
- docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/arch-round-1-verdicts.md（L1-2 裁决 + M1~M4 实测证据与复跑方法）

## depends_on

（无）

## batch

1
