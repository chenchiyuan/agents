# pr-004 agent 角色参数面与两条 LLM 路径注入

## 上下文摘要

改造 `src/agent.js` 与 `src/context-pool.js`：`agent start <id>` 新增 4 个可选 flag（`--role` / `--model` / `--tools` / `--permission`，非法值退出 2），未传 `--role` 时按 `pb-<role>` 推断绑定（flag > 推断 > 无绑定）；两条 LLM 路径注入角色文件——常驻路径经 `ContextPool` 透传给 `AcpClient`，一次性 `omp -p` 路径追加同一参数且 payload 未给时回落角色开关；启动落 `AGENT_START` / `ROLE_BOUND`；`permission_denied` 归轮次级。无角色实例行为逐字节不变。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05

## 文件范围

- oamp/src/agent.js（改造：4 flag 解析、角色推断、两条 LLM 路径注入、事件字段、任务 ctx 透传）
- oamp/src/context-pool.js（改造：向 `AcpClient` 透传 tools/roleFile/permission/onPermissionRequest；`_failSession` 早退名单加 `permission_denied`）

## 验收标准

- [ ] 单起可用与推断绑定：`oamp agent start pb-dev`（不带任何 flag，`OAMP_ROLE_ROOT` 指向角色根）启动行出现 `ROLE_BOUND role=dev file=<绝对路径> source=instance_id`；`oamp agent start dev-1` 无 `ROLE_BOUND`，注册/心跳/退出行为与 0011 一致（F01-4 / AR-02）
- [ ] flag 优先于推断：`oamp agent start pb-dev --role architect` 绑定 architect 且 `source=flag`（F02-1 的实例语义）
- [ ] 非法取值快速失败：`--role` 空值 / `--tools maybe` / `--permission ask` / `--model` 不匹配 `^[A-Za-z0-9._/-]{1,128}$`（既有 `MODEL_RE`，`oamp/src/agent.js:27`）→ stderr 明确报错 + 退出码 2
- [ ] 常驻路径注入与工具开关：`--tools on --role dev` 的实例，其 `omp acp` argv 含 `--append-system-prompt <role.md 绝对路径>` 且**不含** `--no-tools`；`--tools off` 时含 `--no-tools`（判定面 `FAKE_ACP_ARGS_LOG`；自动化固化在 pr-006）
- [ ] 一次性路径同源：`executor:'omp'` 任务的 `omp -p` argv 含同一注入参数；`--no-tools` 由 `payload.tools` 决定，payload 未给时回落角色开关，无角色绑定回落 `off`（TC-09 / AR-08 ②；现行 `oamp/src/agent.js:158-161` 只有 `-p/--no-session/[--no-tools]/[--model]`）
- [ ] 模型解析链：`payload.model > OAMP_OMP_MODEL > --model(角色级) > config.defaults.model > 内置`；无 payload/env 且传 `--model X` 时 argv 含 `--model X`，未传该 flag 的实例行为不变（F03-2/3/4）
- [ ] `permission_denied` 为轮次级错误：拒绝一轮后同实例下一轮可正常完成，不产生 `CONTEXT_RESET`、`context_id` 不变（判定依据 `oamp/src/context-pool.js:202-204` 的早退名单需含该码；F05-4）
- [ ] 回归：`node --test test/context-pool.test.js test/acp-daemon.test.js test/omp-executor.test.js test/reconnect.test.js test/web.test.js` 原样全绿（**文件零修改**即证 §2.3 的逐字节不变式）
- [ ] 冒烟（人工可复跑）：临时 socket 起 Router，`OAMP_OMP_BIN` 指向记录 argv 的 fake、`OAMP_ROLE_ROOT=<仓库根>`，启动 `node bin/oamp.js agent start pb-dev --role dev --tools on --permission allow` 并投一轮 `omp-daemon` 任务，`FAKE_ACP_ARGS_LOG` 中出现 `.../roles/dev/dev.md` 且无 `--no-tools`

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §3.3（两条路径落点）、§3.4（单起参数面与优先级）、§4.1~§4.4（模型链 / 工具 / permission）、§8 AR-02/AR-05/AR-06/AR-08/AR-10、§12.2 跨组契约 1~2
- docs/iterations/0012-roles-agent-cluster/prd/F01（验收 4）、F02（验收 5/7）、F03（验收 2/4）、F04（验收 1/2/3/6）、F05（验收 4）
- 现行代码锚点：`oamp/src/agent.js:8-15`（import 面）、`:27`（`MODEL_RE`）、`:150-161`（一次性 argv）、`:263-292`（`runDaemonTask` 模型链）、`:459-492`（`startAgent` 参数面与 `ContextPool` 构造）、`oamp/src/context-pool.js:23`（`ContextPool` 构造）、`:173-180`（`_ensureClient`）、`:202-204`（`_failSession` 早退名单）

## depends_on

- pr-001-role-binding.md（理由：`--role` 显式绑定与 `pb-<role>` 推断都要 `roleFromInstanceId` / `resolveRoleRoot` / `resolveRoleFile`（跨组契约 2）。证据：`oamp/src/agent.js:8-15` 现行只 import `config`/`node-client`/`log`/`context-pool`/`child_process`/`crypto`，**无任何角色映射来源**；不先合入 pr-001，本 PR 新增的 `import ... from './role-binding.js'` 会 ERR_MODULE_NOT_FOUND，agent 进程根本起不来）
- pr-003-acp-tool-permission.md（理由：透传目标就是 pr-003 新增的 `AcpClient` 构造参数。证据：`oamp/src/context-pool.js:173-180` 现为 `new AcpClient({ bin, model, cwd, logger, onExit })`，本 PR 必须追加 `tools`/`roleFile`/`permission`/`onPermissionRequest`（跨组契约 1）——这些参数名由 pr-003 定义；未合入时它们是未知键、被构造器静默忽略，argv 仍是硬编码 `--no-tools`，角色注入与工具开关整体失效。另 `oamp/src/context-pool.js:202-204` 的早退名单现仅 `model_unavailable`/`context_busy`，本 PR 要加入的错误码 `permission_denied` 由 pr-003 产出）

## batch

2
