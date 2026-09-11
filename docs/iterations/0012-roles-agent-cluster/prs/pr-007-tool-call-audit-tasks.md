# pr-007 任务列表（`--approval-mode` 档位映射 + `tool_call` 通知 → `TOOL_CALL` 审计；阶段 6 返工）

**来源**：`prs/pr-007-tool-call-audit.md`（验收 ①~⑥）+ `architecture.md` v1.2.0 §1.4（V-9 / V-10）/ §4.4（档位 → argv 映射 + 兼容路径 + `clientCapabilities` 陷阱）/ §4.5（`TOOL_CALL` 事件名 / 落行规则 / 字段 / NC-5）/ §4.6（档位 argv 可见性）/ §11.2（实现与断言约束）/ §12.2 契约 1 / §13 R-11 / R-12 / §14.9
**范围**：`oamp/src/acp-client.js`（argv 档位 + `tool_call` 审计 + 兼容路径补 `source`）、`oamp/src/agent.js`（一次性 `omp -p` 档位 + `taskCtx.permission`）、`oamp/test/tool-permission.test.js`（增用例；9 键集合断言同步 10 键）、`oamp/test/acp-daemon.test.js`（只增断言，既有断言行零改动）
**依赖图**：T1 → T2 → T3（同文件 `acp-client.js`，按编号单线落笔）∥ T4（`agent.js`，与前者文件不相交）→ T5（两个测试文件，依赖 T1~T4 的参数面）→ T6（真实行为验收）；无环

---

## T1 · daemon argv 档位映射（`acp-client.js::start()`）

**做什么**
- `start()` 在既有 argv 构造末尾追加：`if (this.tools) args.push('--approval-mode', this.permission === 'deny' ? 'always-ask' : 'yolo')`——`permission` 为既有构造参数，**不新增参数**（§12.2 契约 1）。
- 追加条件 = `this.tools === true`；`tools=false` / 缺省（匿名）⇒ 不追加，argv 与 0011 形状逐字节一致（§2.3 回归不变式）。
- 追加位置取 argv 末尾（`--append-system-prompt` / `--model` 之后）；oauth 的取值规则是 flag 取下一 token（W-6），位置不影响取值（验收 ① 第 3 条）。

**验收（可测试判据）**
- `AcpClient({ tools: true, permission: 'allow' })` → argv 含 `--approval-mode` 且紧随值为 `yolo`。
- `AcpClient({ tools: true, permission: 'deny' })` → 紧随值 `always-ask`。
- `AcpClient({ tools: false, permission: 'deny' })` 与 `AcpClient({})`（匿名缺省）→ argv **不含** `--approval-mode`，且仍含 `--no-tools`。
- 匿名实例 argv 逐字节不变（`acp-daemon.test.js` 既有 `:537-541` deepEqual、`context-pool.test.js` 16 项回归）。

**前置依赖**：无　**优先级**：P0

---

## T2 · `tool_call` / `tool_call_update` 通知 → `TOOL_CALL`（在飞表落行规则）

**做什么**
- `_handleMessage()` 的通知分支改为：`method === 'session/update'` → `_handleSessionUpdate(params)`，并保持既有 `_chunkHandler` 调用（`agent_message_chunk` 轮次增量不变）。
- `_handleSessionUpdate(params)`：`params.sessionId !== this.sessionId` → 忽略（仅处理当前会话）；`update.sessionUpdate` 为 `tool_call` / `tool_call_update` 时按 `toolCallId` 登入/更新在飞表 `Map<toolCallId, {kind,title,status,path}>`（字段取本帧有值者，缺则沿用上一次观测值），**非终态（`pending`/`in_progress`）不落行**。
- 终态首见（`completed` / `failed`）→ 移出在飞表 + 落一行 `TOOL_CALL`；同 id 后续帧不再落行（多帧不重复）。
- `prompt()` 的 `finally` 增加轮次结算冲账：在飞表残留 id 以「最后观测 status」落行并清空 ⇒ **N 次调用恰 N 行**。
- `TOOL_CALL` 字段（§4.5）：身份四键（`instance`/`role`/`chat_id`/`context_id`，缺省 `null`）+ `pid` / `tool_call_id` / `kind` / `title`（≤120）/ `status` / `source='acp_tool_call'`；`path` 取自 `rawInput.path` 或 `locations[0]`（截断 120），**无则省略该键**。落行经 `logger.event()`（永不节流）；无 logger 不落。

**验收（可测试判据）**
- 同 id 推 `tool_call`(pending) → `tool_call_update`(in_progress) → `tool_call_update`(completed) ⇒ logger 恰 **1** 行 `TOOL_CALL`，`status='completed'`。
- 只收 pending/in_progress 即结算 ⇒ 恰 1 行，`status` = 最后观测值。
- 一轮两个 `toolCallId` ⇒ 恰 2 行；非本会话通知不落行；无工具调用的轮次 ⇒ 零 `TOOL_CALL`。
- 事件对象键集合恒定（身份缺省为 `null`）；`path` 缺省时该键不存在。

**前置依赖**：T1（同文件，按编号顺序）　**优先级**：P0

---

## T3 · 兼容路径补 `source='acp_permission'`

**做什么**
- `_audit()`（`TOOL_APPROVED` / `TOOL_DENIED` 共用）字段集合追加 `source: 'acp_permission'`（§4.5 兼容路径字段）。既有应答语义（`allow_once` / `reject_once` + `session/cancel` + `permission_denied`）零改动。
- `initialize` 的 `clientCapabilities: {}` **保持不变**（V-10③ / R-12：不得声明 `fs.*` / `terminal`）。

**验收（可测试判据）**
- 兼容路径两事件字段集合由 9 键变 **10 键**（新增 `source`），值为 `acp_permission`；`tool-permission.test.js:241-263` 的 9 键 `deepEqual` 同步为 10 键（**不删断言**）。
- 允许/拒绝/未知方法三条既有用例语义不变（`allow_once` / `reject_once` + `session/cancel` / `-32601`）。
- fake 记录握手帧 ⇒ `initialize` 的 `clientCapabilities` 恒为 `{}`。

**前置依赖**：T2　**优先级**：P0

---

## T4 · 一次性 `omp -p` 路径档位（`agent.js`）

**做什么**
- `taskCtx` 补 `permission`（`agent.js:575-583` 现无该键）——来源为既有 `--permission` 解析结果（与 `ContextPool` 同源）。
- `runOmpTask()` 的 args 构造：工具开关判定收敛为一个布尔（`task.tools === null ? ctx.tools : task.tools`），该布尔为真时在 argv 追加 `--approval-mode yolo|always-ask`（按 `ctx.permission`），为假时仍只追加 `--no-tools`。

**验收（可测试判据）**
- 角色实例（`--tools on`，`--permission` 缺省 allow）的一次性 argv 含 `--approval-mode yolo` 且不含 `--no-tools`。
- `--permission deny` 起实例 ⇒ 一次性 argv 含 `always-ask`。
- `--tools off` 起实例 ⇒ 一次性 argv **不含** `--approval-mode` 且含 `--no-tools`。
- 匿名实例一次性 argv 逐字节不变（仍 `--no-tools`、无 `--approval-mode`）。

**前置依赖**：无（与 T1~T3 文件不相交）　**优先级**：P0

---

## T5 · 测试（`tool-permission.test.js` 增用例 + `acp-daemon.test.js` 只增断言）

**做什么**
- `tool-permission.test.js`：fake ACP 增 `tool_call` 通知编排模式（`toolcall` / `toolcall_two` / `toolcall_unterminated` / `toolcall_readonly` / `toolcall_foreign`）与 `initialize` 帧记录；新增 argv 档位用例、`TOOL_CALL` 落行 5 条用例、握手空声明用例；既有 9 键集合断言同步 10 键。
- `acp-daemon.test.js`：在既有一次性 argv 用例（`:544-549` 附近）追加档位断言（dev ⇒ `yolo`；tools off 实例 ⇒ 无档位；deny 档实例 ⇒ `always-ask`），**既有断言行零改动**。

**验收（可测试判据）**
- `node --test test/tool-permission.test.js`、`node --test test/acp-daemon.test.js` 全绿。
- `test/context-pool.test.js`、`test/omp-executor.test.js` **文件零修改**且全绿；`npm test` 全绿（197 + 新增）。

**前置依赖**：T1 / T2 / T3 / T4　**优先级**：P0

---

## T6 · 真实 omp 端到端冒烟 + NC-5 事实定稿

**做什么**
- 同一 worktree 内起隔离环境（临时 `OAMP_SOCKET` / `OAMP_DB` + 临时端口 + 真实 omp，不设 `OAMP_OMP_BIN`）：Router + `agent start pb-dev-probe --role dev --tools on --permission allow` → 投一条「在 <tmp 目录> 创建文件」的 `omp-daemon` 指令。
- 断言：① 文件真实落盘；② 该实例日志出现 `TOOL_CALL ... status=completed`；③ 起 `--permission deny` 实例投同一指令 → 工具被拒（无副作用）且轮次 ≤10s 正常结束（不挂起）。
- NC-5：以真实 omp 判定只读工具（`read` / `glob` / `grep`）是否也发 `tool_call` 通知，把事实结论写进测试注释与交付报告（口径据此定稿）。
- 清理临时进程 / socket / 库 / 目录。

**验收（可测试判据）**
- allow 档：目标文件存在于 tmp 目录，且日志含 `TOOL_CALL`（`status=completed`）。
- deny 档：目标文件不存在，轮次 `state='completed'` 且 `duration_ms ≤ 10s`。
- NC-5 结论有实录证据（真实 omp 日志行），非推断。

**前置依赖**：T5　**优先级**：P0

---

## 交付报告契约（dev 段）

1. 改动文件与行号
2. argv 映射实测证据（allow / deny / tools=false 三组）
3. `TOOL_CALL` 落行证据（一次调用一行、两次两行）
4. NC-5 事实结论（真实 omp）
5. 测试结果（单测 + `npm test` + 真实冒烟）
6. commit hash
7. 越界声明

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | 在飞表条目对「本帧未提供字段」沿用上一次观测值（如 `kind` 仅在 `tool_call` 首帧出现）——§4.5 只规定「未观测到终态时取最后观测值」（针对 `status`），未逐字段规定合并策略；按「不丢信息」取同形合并 | `architecture.md` §4.5（字段清单 + status 取值规则） |
| MI-2 | T2 | `path` 的 `locations[0]` 兼容对象（`{path}`）与字符串两种形态（§4.5 只写「`locations[0]` 的路径」） | `architecture.md` §4.5 |
| MI-3 | T1 | `--approval-mode` 追加到 argv 末尾（§4.4 全量形态表列在 `--model` 之后；取值规则为 flag 取下一 token，位置无关） | `architecture.md` §4.4（全量 argv 形态） |
| MI-4 | T5 | `acp-daemon.test.js` 为覆盖验收 ② 的 deny 档一次性断言，需新增一个 `--permission deny` 实例（既有断言行零改动；卡面要求「只增断言」未禁止新增实例） | `prs/pr-007-tool-call-audit.md` 验收 ② 第 1 条 |

## 循环依赖

无（T1~T3 同文件单线；T4 独立；T5 汇合；T6 末位）。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1（NC-5 结论决定 E5 口径措辞）**：只读工具是否发通知需真实 omp 实测（§4.5 待实测边界）；若结论为「不发」，E5 口径按「变更类调用 N=N」定稿（§11.2 分支②），产品维度不变。
- **O-2（`kind` 取值面）**：ACP `kind` 的取值集合（`edit`/`execute`/`read`/…）由 omp 决定，本 PR 只做原样透传（≤120 截断），不做白名单校验。
- **O-3（兼容路径死代码）**：当前 omp 不触发 `session/request_permission`（V-9），兼容路径按 §4.4 保留；其新鲜度由未来 omp 版本决定，不在本 PR 复测范围。
