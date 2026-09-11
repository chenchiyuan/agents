# pr-003 任务列表（ACP 客户端 argv 参数化 + permission 应答与审计）

**来源**：`prs/pr-003-acp-tool-permission.md`（验收标准 1~8）+ `architecture.md` §3.2（注入机制）/ §4.3（工具开关三分支定案）/ §4.4（permission 协议契约与两档行为）/ §4.5（审计字段与落点）/ §8 AR-04/AR-08/AR-10/AR-11 / §11.2（E5 审计口径）/ §12.2 跨组契约 1
**范围**：`oamp/src/acp-client.js`（改造：构造参数 + argv 参数化 + 服务端请求分支 + 审计事件 + denied 标记）、`oamp/test/tool-permission.test.js`（新建）；零新第三方依赖、不改既有 16 个测试文件
**依赖图**：T1、T2 同一文件（无调用依赖，按编号单线落笔）→ T3（同为 `acp-client.js`）→ T4 → T5（无环，无外部前置）

---

## T1 · argv 参数化（`tools` / `roleFile`）

**做什么**
- 构造参数 `tools = false`、`roleFile = null`（其余 5 键 `bin/model/cwd/logger/onExit` 不动，签名逐键兼容）。
- `start()` 的 argv 由硬编码 `['acp','--no-skills','--no-rules','--no-tools','--no-session']`（`acp-client.js:79`）改为：`['acp','--no-skills','--no-rules']` +（`tools !== true` ⇒ `'--no-tools'`）+ `'--no-session'` +（`modelArg` 非空 ⇒ `'--model', modelArg`）+（`roleFile` 非空 ⇒ `'--append-system-prompt', roleFile`）。
- `--no-skills` / `--no-rules` / `--no-session` 三项恒在；缺省（不传 `tools`）⇒ 含 `--no-tools`、无 `--append-system-prompt`——既有匿名实例（`context-pool.js:173-180` 只传 5 键）零感知。

**验收（可测试判据）**
- 不传 `tools` / `tools:false` → argv 含 `--no-tools`；`tools:true` → argv **不含** `--no-tools`。
- `roleFile = <绝对路径>` → argv 含 `--append-system-prompt` 且紧随值为该绝对路径（原样透传，不做解析/校验——路径合法性归 pr-001/pr-004）。
- 三种情形下 `--no-skills` / `--no-rules` / `--no-session` 均在场。
- 回归：`test/context-pool.test.js:525-536`（`dev-1` 的 acp argv 含 `--no-tools` + `--model`）原样通过，文件零修改。

**前置依赖**：无　**优先级**：P0

---

## T2 · 服务端请求分支与 permission 应答（`permission` / `onPermissionRequest`）

**做什么**
- `_handleMessage()`：`id` 存在**且** `method` 为字符串 → 服务端请求，交 `_handleServerRequest(message)`；该分支**置于 `_pending` 表查找之前**（现状这类帧在 `if (!entry) return;`（`acp-client.js:267`）被静默丢弃 = V-6 挂起根因）。
- `session/request_permission`：`toolCall = params.toolCall || {}`；判定 `onPermissionRequest(info)`（构造时给了函数则以其返回 `'allow'|'deny'` 为准），否则取构造参数 `permission`（`'allow'` 缺省 / `'deny'`）——
  - `allow` → 回 `{outcome:{outcome:'selected',optionId:'allow_once'}}`（**恒 `allow_once`，不用 `allow_always`**：omp 按 cacheKey 缓存后不再发请求，会让审计记录数 < 调用数，违 §11.2）；
  - `deny` → 回 `{outcome:{outcome:'selected',optionId:'reject_once'}}` → 立即 `session/cancel()` → 置 `_permissionDenied`（轮次级标记，T3 消费）。
- 未知方法 → 回 JSON-RPC error `{code:-32601, message:'Method not found'}`（响亮失败，不静默丢弃、不挂起）。
- 审计：每次 permission 请求恰一行 `logger.event('TOOL_APPROVED' | 'TOOL_DENIED', fields)`——**字段集合恒定**（9 键恒在）：`instance / role / chat_id / context_id / pid / tool / title（截断 120 字符）/ tool_call_id / option`（AR-11），身份四键在 `auditContext` 缺省或某键缺失时取 `null`（不省略键）；走永不节流的 `event()`；无 logger 时不落。
- 回包写入失败（子进程已不可写）静默忽略（与既有 `cancel()` 同形态），不让 stdout data handler 抛异常。

**验收（可测试判据）**
- 允许档：fake 下发 `{id, method:'session/request_permission', params:{sessionId, toolCall, options}}` → 客户端回上述 `allow_once` 结果；同会话两次请求 → fake 侧记录恰 2 个成功应答，logger 侧恰 2 行 `TOOL_APPROVED`。
- 拒绝档：回 `reject_once`、随即发出 `session/cancel` 通知、logger 恰 1 行 `TOOL_DENIED`（`option=reject_once`）。
- 未知方法：fake 收到 `{id, error:{code:-32601}}`；该轮不挂起。
- 审计字段齐全：注入的 recorder logger 收到的 `TOOL_APPROVED`/`TOOL_DENIED` 字段含 `instance`/`role`/`chat_id`/`context_id`/`pid`/`tool`/`title`/`tool_call_id`/`option`，且 `title` ≤120 字符。

**前置依赖**：无（与 T1 同文件，按编号顺序落笔）　**优先级**：P0

---

## T3 · denied 标记 → `prompt()` 结算抛 `permission_denied`

**做什么**
- `prompt()` 每轮开始置 `_permissionDenied = false`；`session/prompt` 请求结算时（正常返回或被拒绝返回）若标记已置位 → 抛 `AcpError('permission_denied', '工具调用被 permission 策略拒绝（permission=deny）')`——三步使终态确定，不依赖模型是否自行收敛。
- 客户端**不** kill 子进程、不销毁 session（`permission_denied` 是轮次级错误；归入 `_failSession` 早退名单是 pr-004 的事）。

**验收（可测试判据）**
- 拒绝档轮次：`prompt()` 以 `AcpError` 结算且 `err.code === 'permission_denied'`；`client.dead === false`（会话保留）。
- 允许档轮次：同参数下 `prompt()` 正常 resolve（结果为 `{text, model, stop_reason, usage, pid}`）。

**前置依赖**：T2　**优先级**：P0

---

## T4 · `oamp/test/tool-permission.test.js`（fake ACP 帧级）

**做什么**
- 新建 `node:test` 测试文件：fake ACP 脚本（CJS，写 `mkdtempSync(os.tmpdir())`，`chmod 0o755`）经 `AcpClient` 的 `bin` 直接注入；不依赖真实 omp / 网络 / tmux / Router。
- fake 行为按 env `FAKE_ACP_MODE` 编排：`allow` / `deny` / `unknown`；实现 `initialize` / `session/new`（真实数组形态 `configOptions`）/ 每次 `session/prompt` 主动下发一个服务端请求，并把收到的客户端应答与 `session/cancel` 以 JSON 行记入 `FAKE_ACP_FRAMES_LOG`、启动 argv 记入 `FAKE_ACP_ARGS_LOG`；每个用例独立临时目录与 env，`t.after` 清理。

**验收（可测试判据，`node --test test/tool-permission.test.js` 单独全绿）**
1. `tools:true` → argv 不含 `--no-tools`；缺省 / `tools:false` → argv 含 `--no-tools`（回归面）。
2. `roleFile` → argv 含 `--append-system-prompt <绝对路径>`；三项 `--no-*` 恒在。
3. 允许档 → fake 记录 `reject`/`allow` 结果为 `{outcome:{outcome:'selected',optionId:'allow_once'}}`；两次请求 → 2 行 `TOOL_APPROVED`，字段齐全（含 identity 四键 + `tool`/`title`/`tool_call_id`/`option`）。
4. 拒绝档 → fake 记录 `reject_once` 且同时记录 `session/cancel`；`prompt()` 抛 `permission_denied`；恰 1 行 `TOOL_DENIED`；`client.dead === false`。
5. 未知方法 → fake 记录 `{error:{code:-32601}}`；该轮 `prompt()` 正常结算（不挂起）。
6. 用例间独立启停，零残留（临时目录、子进程经 `kill()` 收尾）。
7. 缺省 `auditContext`（未提供身份）→ 审计事件键集合恒为同一 9 键，身份四键值为 `null`（§4.5 无条件字段口径；2026-09-11 主 agent 裁决后补）。

**前置依赖**：T1 / T2 / T3　**优先级**：P0

---

## T5 · PR 级验收（回归与范围核查）

**做什么**
- 在 worktree 的 `oamp/` 下：`node --check src/acp-client.js`、`node --test test/tool-permission.test.js`、`node --test test/context-pool.test.js`（回归）、`npm test`（全量）。
- 核查文件范围：仅 `src/acp-client.js` 改动 + `test/tool-permission.test.js` 新增；既有 16 个测试文件**零修改**。

**验收（可测试判据）**
- 四条命令全部通过；`context-pool.test.js` 中 `dev-1` 的 acp argv 仍含 `--no-tools`（§2.3 回归不变式）。
- `git status` 无范围外改动。

**前置依赖**：T4　**优先级**：P0

---

## 交付报告契约（dev 段）

1. 改动文件（路径 + 行数）
2. 新增参数面（名称 + 缺省）与事件名
3. 测试结果：`node --check` / `node --test test/tool-permission.test.js` / `node --test test/context-pool.test.js` / `npm test`
4. 回归证据（`context-pool.test.js` 仍绿，`dev-1` argv 仍含 `--no-tools`）
5. 越界声明（含是否改了范围外文件）

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | **审计身份字段的承载参数 `auditContext`**（`{instance, role, chat_id, context_id}`，缺省 `null`）：AR-11（`architecture.md:294`）要求这 4 个字段无条件存在，但 §12.2 契约 1 的构造参数清单未列承载者，且 `AcpClient` 自身无从获知（`pid` 可自产，`tool`/`title`/`tool_call_id` 取自 `params.toolCall`）——故新增一个**可选**对象参数，对既有 5 键调用方零影响；事件字段集恒定，缺省时四键取 `null`（2026-09-11 主 agent 裁决：AR-11 的字段无条件列出 ⇒ 实现恒带四键，而非"身份可得时才有"）。**下游要求（字段有值，非仅存在）**：pr-004 的 `ContextPool._ensureClient()` 应透传 `auditContext: {instance, role, chat_id, context_id}`，否则常驻路径身份四键恒为 `null` | `architecture.md:294`（AR-11 字段清单）+ §12.2 契约 1 + `acp-client.js` 可获知面 |
| MI-2 | T2 | `onPermissionRequest(info)` 与静态 `permission` 的优先级：**给了函数则以其返回 `'allow'|'deny'` 为准，否则取 `permission`**（两参数均按 §12.2 契约 1 落地；契约只写了签名与返回，未定义两者共存时的仲裁）。`info = {sessionId, toolCall, options}` | §12.2 契约 1 的 `onPermissionRequest(info) → 'allow'|'deny'` |
| MI-3 | T3 | `permission_denied` 的 `AcpError.message` 取 §4.4 的 task.result 文本「工具调用被 permission 策略拒绝（permission=deny）」（契约只定 `code`） | `architecture.md:279`（拒绝档三步）+ `:500` |
| MI-4 | T1 | `--append-system-prompt` 在 argv 中的位置未定：取 `--model` 之后（同属「按实例追加」段），对 omp 取值规则（W-6 按 flag 取值）无影响 | §3.2 + §12.2 契约 1 |

## 循环依赖

无（T1/T2 → T3 → T4 → T5，DAG；T1 与 T2 同文件但无调用依赖，按编号单线落笔）。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1（新增构造参数的跨 PR 面）**：`auditContext` 不在 pr-003/pr-004 卡片的参数枚举中（卡只列 `tools`/`roleFile`/`permission`/`onPermissionRequest`），但 AR-11 的 4 个身份字段必须有承载者。本 PR 以「可选参数 + 缺省 null + 字段集恒定」交付（缺省路径下四键存在但为 `null`，2026-09-11 主 agent 裁决后修订），pr-004 透传 `auditContext` 是 AR-11 身份维度**有值**的必要下游动作（见 MI-1）。
- **O-2（真实 omp 的 permission 帧时序）**：本 PR 全量以 fake ACP 取证；真实 omp 的 deny 时延（`duration_ms ≤ 10s`）与「会话保留」由阶段 6 的 E5 复测（§4.4 时间判据 / pr-006）。
- **O-3（一次性 `omp -p` 路径无 permission 面）**：`-p` 路径不经 ACP，其工具门禁由 omp 自身审批模式决定，不在本 PR 范围（F05 边界明文；pr-004 只透传参数）。
