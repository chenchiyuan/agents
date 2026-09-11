# pr-003 ACP 客户端：argv 参数化 + permission 应答与审计

## 上下文摘要

改造 `src/acp-client.js`：把 `start()` 里硬编码的 `acp --no-skills --no-rules --no-tools --no-session`（:79）参数化，新增 `tools` / `roleFile` / `permission` / `onPermissionRequest` 构造参数；并在 `_handleMessage()` 的 pending 表查找之前补「服务端请求」分支，应答 `session/request_permission`（allow → `allow_once`；deny → `reject_once` + `session/cancel` + 轮次 `permission_denied`），未知方法回 `-32601`，每次请求落一行审计事件。默认参数保持 0011 行为不变。

## 涉及功能点

- F04
- F05
- F02

## 文件范围

- oamp/src/acp-client.js（改造：构造参数 + argv 参数化 + 服务端请求分支 + 审计事件 + denied 标记）
- oamp/test/tool-permission.test.js（新建）

## 验收标准

- [ ] 既有调用零感知（回归面）：不传 `tools` 时 spawn 的 argv 仍含 `--no-tools`；不传 `roleFile` 时 argv 无 `--append-system-prompt` —— 证据面 `oamp/src/context-pool.js:173-180` 现行只传 `bin/model/cwd/logger/onExit`，`oamp/test/context-pool.test.js:525-536` 断言 `dev-1` 的 acp argv 含 `--no-tools`
- [ ] `tools=true` → argv **不含** `--no-tools`；`roleFile=<绝对路径>` → argv 含 `--append-system-prompt <绝对路径>`；`--no-skills` / `--no-rules` / `--no-session` 三项仍恒在（AR-08 ① / AR-04）
- [ ] 允许档：假 ACP 服务端以 `{id, method:'session/request_permission', params:{sessionId, toolCall, options}}` 下发 → 客户端回 `{outcome:{outcome:'selected',optionId:'allow_once'}}`，该轮不挂起；同一会话两次请求 → 恰好 2 行 `TOOL_APPROVED`（N 次受门禁调用 = N 条记录，F05-2 / §11.2）
- [ ] 审计字段齐全：`instance` / `role` / `chat_id` / `context_id` / `pid` / `tool` / `title`（≤120 字符）/ `tool_call_id` / `option`；走永不节流的 `event()`（AR-11）
- [ ] 拒绝档：回 `reject_once` → 立即发 `session/cancel` → `prompt()` 结算抛 `AcpError{code:'permission_denied'}`；同会话不因此销毁（错误码供 pr-004 归入轮次级）
- [ ] 未知服务端方法（如 `fs/read_text_file`）→ 回 JSON-RPC error `-32601`，既不静默丢弃也不挂起（W-5 说明当前不会发生，防未来）
- [ ] 服务端请求识别条件 = `id` 存在**且** `method` 为字符串，且**先于** `_pending` 查找 —— 现状这类帧因 `_pending` 无此 id 被 `return` 丢弃（丢弃点 = `oamp/src/acp-client.js:267` 的 `if (!entry) return;`，分支约 :265-267（`:264` 是 `_onAnyMessage`），即 V-6 挂起根因）；判定面 = 上述应答用例通过
- [ ] `node --test test/tool-permission.test.js` 全绿（fake ACP 内联在测试文件内，沿用 `oamp/test/context-pool.test.js:25` 的 `FAKE_ACP_SOURCE` 形态）；`test/context-pool.test.js`、`test/web.test.js`、`test/acp-daemon.test.js` 原样全绿（文件零修改）

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §4.3（工具开关）、§4.4（permission 协议契约与两档行为）、§4.5（审计字段与落点）、§8 AR-08/AR-10/AR-11、§11.2（E5 口径）、§12.2 跨组契约 1
- docs/iterations/0012-roles-agent-cluster/prd/F05-permission-policy.md（验收 1/2/3/4）、prd/F04-tool-toggle-per-role.md（验收 1/2）、prd/F02-role-definition-loading.md（验收 5）
- 现行代码锚点：`oamp/src/acp-client.js:79`（硬编码 argv）、`:55`（构造器签名）与 `:57-60`（`modelArg`/`cwd`/`logger`/`onExit`，`cwd` 在 :58）、`:262-280`（`_handleMessage`：pending 表查找与通知分发，丢弃点在 :267）、`oamp/src/context-pool.js:173-180`、`oamp/test/context-pool.test.js:525-536`

## depends_on

（无 —— 本 PR 只动 `acp-client.js` 与其新测试；新参数一律带默认值，对既有 5 个构造键的调用方零影响，故不依赖任何其它 PR）

## batch

1
