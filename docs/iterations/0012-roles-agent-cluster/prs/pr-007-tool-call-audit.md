# pr-007 工具调用审计：`--approval-mode` 档位 + `tool_call` 通知 → `TOOL_CALL`（阶段 6 返工）

## 上下文摘要

阶段 6 真实 omp 实测证伪原 permission 门禁机制（V-9：ACP 路径从不发 `session/request_permission`）⇒ deny 档无效、审计恒 0。按 architecture v1.2.0 §4.4 / §4.5 就地替换：按 `permission` 派生 argv `--approval-mode`（allow→yolo / deny→always-ask，仅 `effectiveTools=true` 时追加，一次性 `omp -p` 同理）；审计源改为 `session/update` 的 `tool_call` / `tool_call_update` 通知 → `TOOL_CALL`（在飞表按 `toolCallId` 去重、终态首见落行、轮次结算冲账 ⇒ 一次调用恰一行）；原 ACP 应答保留为兼容路径并补 `source`。产品维度不变。

## 涉及功能点

- F04
- F05
- F02

## 文件范围

- oamp/src/acp-client.js（改造：argv 追加 `--approval-mode`；`tool_call` / `tool_call_update` 通知 → `TOOL_CALL` 审计 + 在飞表落行规则；兼容路径审计补 `source`）
- oamp/src/agent.js（改造：一次性 `omp -p` 路径同样追加 `--approval-mode`；`taskCtx` 增 `permission` 供其取值）
- oamp/test/tool-permission.test.js（增用例；既有「字段集合」断言由 9 键同步为 10 键）
- oamp/test/acp-daemon.test.js（**仅增断言**：一次性 `omp -p` 路径的 `--approval-mode` 档位；既有断言行零改动 —— 属主 agent 裁决 (a) 授权的跨卡追加）

> **相邻文件的取舍说明（附证据，避免被误读为遗漏）**：`oamp/src/context-pool.js` **不需要改** —— daemon 路径的档位与身份传递已就位：`oamp/src/context-pool.js:192-212` 的 `_ensureClient()` 已透传 `tools` / `roleFile` / `permission` 与 `auditContext`（后者的 `context_id` 为惰性取值器），`TOOL_CALL` 复用同一身份源即可。`oamp/test/acp-daemon.test.js` **已列入**（一次性路径档位的自动化断言按 §5.6 归属该文件；实施时只在既有一次性 argv 用例处追加档位断言行，**既有断言行零改动**）：其现有断言对本卡新增参数不敏感 —— `:537-541` 匿名实例逐字节 `deepEqual`（匿名 `tools=false` ⇒ 不追加档位）、`:546-549` 一次性 argv 存在性（只判 `--append-system-prompt` 与 `--no-tools` 的有无）。该文件与 pr-006 的重叠属「阶段 6 返工修订已交付产物」的结构性必然，双方均已合入、非并发，无冲突风险。

## 验收标准

**① daemon argv 档位（判定：`FAKE_ACP_ARGS_LOG`，按 includes/indexOf 判存在与取值，不对角色实例做逐字节相等）**

- [ ] `AcpClient({ tools: true, permission: 'allow' })` → argv 含 `--approval-mode yolo`；`{ tools: true, permission: 'deny' }` → 含 `--approval-mode always-ask`
- [ ] `{ tools: false }` 与缺省 `tools`（匿名实例）→ argv **不含** `--approval-mode`，且仍含 `--no-tools`；匿名实例 argv 与既有逐字节断言一致（§2.3 回归不变式，见 `acp-daemon.test.js:537-541`）
- [ ] `--approval-mode` 的位置不影响取值（omp 取值规则为 flag 取下一 token）；断言只判「参数存在 + 紧随值正确」

**② 一次性 `omp -p` 路径档位（agent.js；判定：自动化断言 + 人工可复跑冒烟）**

- [ ] **自动化**（`oamp/test/acp-daemon.test.js`：在既有一次性 argv 用例的 `:544-549` 附近追加，不改既有断言行）：角色实例（`--tools on`、`--permission` 缺省）的 `omp -p` argv 含 `--approval-mode yolo`；`--permission deny` 起实例 → 含 `always-ask`；`--tools off` 起实例 → **不含** `--approval-mode` 且仍含 `--no-tools`
- [ ] 冒烟（人工可复跑，与上条同判据）：`OAMP_OMP_BIN` 指向记录 argv 的 fake、`OAMP_ROLE_ROOT=<仓库根>`，起 Router + `agent start pb-dev --role dev --tools on`（`--permission` 缺省 allow），投一条 `executor:'omp'` 任务 → 该 `-p` argv 含 `--approval-mode yolo` 且不含 `--no-tools`；同实例以 `--permission deny` 重启 → `always-ask`；以 `--tools off` 重启 → **不含** `--approval-mode` 且含 `--no-tools`（依据 §4.4「一次性 `omp -p` 路径同理」+ §7 D-21）
- [ ] 代码面证据（判定依据）：`agent.js:165-170` 的 `runOmpTask` args 现为 `['-p','--no-session'] + [--no-tools] + [--model] + [--append-system-prompt]`，且 `agent.js:575-583` 的 `taskCtx` **无 `permission` 键** ⇒ 不补这两处，一次性路径的档位必然缺失

**③ `TOOL_CALL` 落行规则（§4.5；判定：fake ACP 推送通知 + recorder logger）**

- [ ] 同一 `toolCallId` 推多帧（`tool_call`(pending) → `tool_call_update`(in_progress) → `tool_call_update`(completed)）⇒ 恰 **1 行** `TOOL_CALL`（多帧不重复落行）
- [ ] 字段齐全：身份四键（`instance` / `role` / `chat_id` / `context_id`）+ `pid` / `tool_call_id` / `kind` / `title`（≤120 字符）/ `status` / `path`（无则省略该键）/ `source='acp_tool_call'`
- [ ] 轮次在终态前结束（只收到 pending/in_progress 帧）⇒ 轮次结算时以「最后观测 status」落行，仍恰 1 行
- [ ] 两次独立调用（两个 `toolCallId`）⇒ 恰 2 行；非本会话通知（`params.sessionId !== this.sessionId`）忽略、不落行；无工具调用的轮次 ⇒ 零 `TOOL_CALL`
- [ ] 事件对象中键集合恒定（缺省身份为 `null`）；渲染层跳过 null（`log.js:22`）——断言针对事件对象/recorder fields，不以渲染行当判据

**④ 兼容路径不回归 + 补 `source`**

- [ ] 服务端 `session/request_permission` 仍按原语义应答：allow → `allow_once` + 恰 1 行 `TOOL_APPROVED`；deny → `reject_once` + 紧随 `session/cancel` + 轮次 `permission_denied`（会话保留）；未知方法 → `-32601`（不挂起）
- [ ] 兼容路径两事件带 `source='acp_permission'`（现行 `acp-client.js:355-369` 的 `_audit()` 字段集合**无** `source`，为本卡新增）
- [ ] 既有断言「缺省 auditContext 时字段集合恒定」同步为 10 键（新增 `source`），**不删断言**（现为 `tool-permission.test.js:241-263` 的 9 键 `deepEqual`，不更新必失败）

**⑤ 握手与 NC-5 事实**

- [ ] `initialize` 仍以 `clientCapabilities: {}` 发出（V-10③ / §13 R-12；判定：fake 记录握手帧）——后续不得"顺手"声明 `fs.*` / `terminal`
- [ ] NC-5：fake 下固化「只读类 `kind`（如 `read`）同样落一行 `TOOL_CALL`」；**交付报告须给出真实 omp 下只读工具是否发通知的实测结论**；未能实测时显式标注「未实测」并按 §4.5 分支②（变更类调用 N=N）定稿

**⑥ 回归**

- [ ] `node --test test/tool-permission.test.js test/context-pool.test.js test/acp-daemon.test.js test/omp-executor.test.js` + `npm test` 全绿；`test/context-pool.test.js`、`test/omp-executor.test.js` **文件零修改**；`test/acp-daemon.test.js` **只增断言、既有断言行零改动**（依据见「文件范围」）
- [ ] 匿名实例行为逐字节不变（acp argv 与 `omp -p` argv 均无新增参数）

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md（v1.2.0）§1.4 V-9 / V-10、§4.4（档位 → argv 映射表 + 兼容路径）、§4.5（`TOOL_CALL` 事件名 / 落行规则 / 字段 / NC-5）、§11.2（实现与断言约束）、§12.2 契约 1、§13 R-11 / R-12、§14.9、§5.6（测试组织）
- docs/iterations/0012-roles-agent-cluster/prs/pr-003-acp-tool-permission.md（被本卡修订的主路径）、pr-004-agent-role-binding.md（`effectiveTools` / `permission` 传参链路）
- docs/iterations/0012-roles-agent-cluster/prd/F05-permission-policy.md、F04-tool-toggle-per-role.md、F02-role-definition-loading.md
- 现行代码锚点：`oamp/src/acp-client.js:103-107`（argv 构造）、`:147-197`（`prompt()` 与轮次结算）、`:157-195`（`_chunkHandler`：现仅处理 `agent_message_chunk`）、`:298-320`（`_handleMessage`，通知分发在 `:319`）、`:322-353`（兼容路径应答）、`:355-369`（`_audit()`，无 `source`）、`:17`（`TOOL_TITLE_MAX=120`）；`oamp/src/agent.js:165-170`（一次性 argv）、`:565-583`（`ContextPool` 已含 `permission` / `taskCtx` 无 `permission`）；`oamp/src/context-pool.js:192-212`（透传面已就位）；`oamp/src/log.js:22`（渲染跳过 null）；`oamp/test/tool-permission.test.js:163-186`（argv 用例范式）、`:241-263`（9 键集合断言）；`oamp/test/acp-daemon.test.js:523-533`（角色实例 acp argv 断言）、`:544-549`（一次性 `omp -p` argv 断言位点，本卡在此追加档位断言）

## depends_on

- pr-003-acp-tool-permission.md（理由：本卡修订的正是 pr-003 落地的主路径。证据：argv 构造点 `oamp/src/acp-client.js:103-107` 与审计点 `:322-369`（`_handleServerRequest` / `_audit`）由 pr-003 引入，本卡在同处追加 `--approval-mode` 与 `TOOL_CALL`；且新增 `source` 键会使 pr-003 交付的 `oamp/test/tool-permission.test.js:241-263` 的 9 键 `deepEqual` 失败 ⇒ 两卡共享同一模块与同一测试文件，本卡必须以其为基线）
- pr-004-agent-role-binding.md（理由：验收 ①② 的判定面依赖 pr-004 的传参链路——`effectiveTools` 与 `permission` 由 pr-004 解析后传给 `ContextPool`（`oamp/src/agent.js:565-574`）并经 `_ensureClient()` 进入 `AcpClient`（`oamp/src/context-pool.js:192-212`）；未合入则 `AcpClient.permission` 恒为缺省、`tools` 恒为 false，主机制的两档与「仅 tools 时追加」都无从成立。另本卡对 `agent.js` 的改动落在 pr-004 建立的 `runOmpTask` / `taskCtx`（`:165-170` / `:575-583`）之上）
- pr-006-e2e-and-docs.md（理由：本卡验收 ② 的自动化断言**锚定在 pr-006 建立的一次性 argv 用例内**——`oamp/test/acp-daemon.test.js:544-549`（pb-dev 实例的 `-p` argv 断言：`:548` 判注入参数、`:549` 判 `--no-tools` 的有无）由 pr-006 交付，本卡只在该处追加档位断言行；证据：该用例的文件头注释标注「pr-006：角色实例 argv 级断言」（`oamp/test/acp-daemon.test.js:436`），且 `:544-549` 的 `-p` 分支若不存在，本卡的一次性档位断言将无处落笔）

## batch

4
