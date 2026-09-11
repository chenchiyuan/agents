# pr-004 任务列表（agent 参数面 + 两条 LLM 路径角色注入 + auditContext 透传）

**来源**：`prs/pr-004-agent-role-binding.md`（验收标准 1~8 + 回归） + `architecture.md` §3.4（单起参数面 / tools 三分支定案 / 优先级）/ §3.3（两条 LLM 路径落点）/ §4.1（模型解析链）/ §4.2（模型可观察面，`AGENT_START` 字段）/ §4.3（工具开关）/ §4.4（permission 拒绝档会话保留）/ §4.5（审计字段）/ §8 AR-02/AR-05/AR-06/AR-08/AR-10/AR-11 / §12.2 契约 1（10 项构造参数，含 `auditContext`）
**范围**：`oamp/src/agent.js`（改造：4 flag 解析、角色推断、两条 LLM 路径注入、启动事件、任务 ctx 透传）、`oamp/src/context-pool.js`（改造：向 `AcpClient` 透传 `tools`/`roleFile`/`permission`/`auditContext`；`_failSession` 早退名单加 `permission_denied`）；**不新增测试文件**（argv / 审计断言归 pr-006 的 `acp-daemon.test.js`），既有 16 个测试文件零修改
**依赖**：pr-001（`role-binding.js`，已合并）+ pr-003（`acp-client.js` 新构造参数，已合并）
**依赖图**：T1 → T2 → T4 → T5；T3 ∥（T1/T2）（`context-pool.js` 与 `agent.js` 不相交；T4 同时依赖 T2/T3）

---

## T1 · `agent.js` 参数解析与角色绑定（含启动事件）

**做什么**
- 新增纯函数 `parseAgentArgs(restArgs)`：`restArgs[0]` = instance-id（既有约定），其余逐个解析 `--role <role>` / `--model <model>` / `--tools on|off` / `--permission allow|deny`。
  - 每个 flag 缺值、取值非法、或出现未知参数（任何不在上述 4 项内的 token）→ 返回 `{ok:false, reason}`。
  - `--model` 用既有 `MODEL_RE`（`agent.js:27`）校验；`--tools` 仅 `on|off`；`--permission` 仅 `allow|deny`；`--role` 非空且不含路径分隔符 / 不等于 `.`/`..`（防路径穿越，文件存在性随后判定）。
- `startAgent()` 中：解析失败 → `process.stderr.write('oamp: agent start: <reason>\n')` + **返回 2**（§3.4；与 `cli.js` usageError 的退出码一致）。
- 角色绑定优先级（§3.4「CLI flag > 推断 > 无绑定」）：`role = 显式 --role || roleFromInstanceId(instanceId)`（**必须 import `role-binding.js`，不得自行拼 `pb-` 前缀**）；`source = 'flag' | 'instance_id'`。
- 绑定后 `roleFile = resolveRoleFile(resolveRoleRoot(), role)`；文件不存在（显式 `--role` 路径）→ stderr 报错 + 返回 2（**响亮失败**）。
- tools 三分支（§3.4/§4.3，agent 侧两部分）：`effectiveTools = CLI --tools ?? (role ? true : false)`（第三分支 = 内置缺省：有绑定 on / 无绑定 off）。
- 启动事件（§3.3 判定 3 / §4.2）：`AGENT_START {instance, role, model, tools, permission, role_file}`；绑定成功时追加 `ROLE_BOUND role=<r> file=<abs> source=flag|instance_id`（无绑定不落 `ROLE_BOUND`）。
- 模型链的实例级输入：`envModel = OAMP_OMP_MODEL`（空/空白视为未设，同 `config.js` 口径）、`modelOverride = --model`、`defaultModel = config.defaultModel`（已折叠 env > config.defaults.model > 内置）。

**验收（可测试判据）**
- `oamp agent start pb-dev`（`OAMP_ROLE_ROOT` 指向角色根）→ stdout 出现 `ROLE_BOUND role=dev file=<repo>/roles/dev/dev.md source=instance_id`；`oamp agent start dev-1` → 无 `ROLE_BOUND`（验收 1）。
- `oamp agent start pb-dev --role architect` → `ROLE_BOUND role=architect … source=flag`；`--role` 指向缺文件角色 → stderr + 退出 2（验收 2 + §3.4）。
- `--role ''` / `--tools maybe` / `--permission ask` / `--model 'bad model!'` / `--unknown` → stderr 明确报错 + 退出码 2（验收 3）。
- `AGENT_START` 行含 `instance`/`model`/`tools=on|off`/`permission`；绑定实例另含 `role`/`role_file`（§4.2 字段）。

**前置依赖**：无　**优先级**：P0

---

## T2 · `agent.js` 两条 LLM 路径注入与模型链

**做什么**
- `taskCtx` 增补：`envModel` / `modelOverride`（= `--model`）/ `tools`（`effectiveTools`）/ `roleFile`（供两条路径消费）。
- 一次性 `omp -p`（`runOmpTask`，§3.3 第 2 行 / §4.3 ②）：argv 追加 `--append-system-prompt <roleFile>`（仅绑定实例）；`--no-tools` 由 `payload.tools`（布尔）决定，payload 未给 → 回落 `ctx.tools`（= CLI `--tools` 或内置缺省）；`--model` 取 `payload.model || envModel || modelOverride`（三者皆空 ⇒ 不传，保持匿名/未传 flag 实例 argv 不变）。
- `parseTaskBody` 的 `executor:'omp'` 分支：`tools = typeof body.tools === 'boolean' ? body.tools : null`（保留既有的"非布尔即视为未给"容忍度，仅多一个"未给"态）。
- 常驻 `omp-daemon`（`runDaemonTask`）：每轮模型 = `payload.model || envModel || modelOverride || defaultModel`（§4.1 链）；角色注入与工具开关经 `ContextPool` → `AcpClient`（T3）生效。
- bootstrap argv 顺序：`-p --no-session [--no-tools] [--model X] [--append-system-prompt <file>] <prompt>`。

**验收（可测试判据）**
- `dev-1`（无绑定、无 flag）：`omp -p` argv 与 0011 逐字节一致（`-p --no-session --no-tools <prompt>`；无 `--append-system-prompt`）——`test/omp-executor.test.js` 零修改通过（验收 8 回归）。
- `--role dev --tools on` 实例的 daemon `omp acp` argv 含 `--append-system-prompt <role.md 绝对路径>` 且**不含** `--no-tools`；`--tools off` 时含 `--no-tools`（验收 4；argv 断言自动化在 pr-006）。
- 绑定实例的一次性路径 argv 含同一 `--append-system-prompt`（验收 5 / TC-09）。
- `--model X`（无 payload/env）→ daemon argv `--model X`、一次性 argv `--model X`；未传该 flag 且 payload/env 未给 → 两条路径 argv 均与现状一致（验收 6）。

**前置依赖**：T1（`taskCtx` 形状）　**优先级**：P0

---

## T3 · `context-pool.js` 透传与 `permission_denied` 轮次级

**做什么**
- `ContextPool` 构造新增可选参数：`role = null` / `roleFile = null` / `tools = false` / `permission = 'allow'`（缺省值与 `AcpClient` 一致 ⇒ 既有只传 5 键的调用方语义不变）。
- `ContextSession._ensureClient()`（`AcpClient` 唯一构造点，§12.2 契约 1）：构造参数追加 `tools: this.pool.tools`、`roleFile: this.pool.roleFile`、`permission: this.pool.permission`、`auditContext: {instance: this.agentId, role: this.pool.role, chat_id: this.chatId, context_id: this.contextId}`。
  - `context_id`（`ctx-<pid>-<generation>`）在 spawn 前不可得 ⇒ 以取值器（getter）随 `contextId` 实时解析，保证审计时刻四键**值**非空（AR-11 / pr-003 MI-1 下游要求）。
- `_failSession(err)` 早退名单加入 `permission_denied`（与 `model_unavailable`/`context_busy` 同级）：deny 轮不触发 `CONTEXT_RESET`、不移除键、`context_id` 不变、下一轮可继续（§4.4 定案）。
- `onPermissionRequest` **不新增透传**：本 PR 无可变策略来源（策略真源 = `permission` 静态档），传 `null`（默认值）与传"恒真返回同值"的函数行为完全等价，属推测性灵活度，按 YAGNI 不引入；`AcpClient.onPermissionRequest` 缺省 `null` 时即回落到 `permission`（pr-003 T2 MI-2）。

**验收（可测试判据）**
- `test/context-pool.test.js:525-536`（`dev-1` acp argv 含 `--no-skills/--no-rules/--no-tools/--no-session` + `--model deepseek/deepseek-v4-flash`）原样通过（验收 8）。
- 直接构造 `ContextPool` + fake ACP 跑一轮 permission 请求：审计行四键非空（`instance`/`role`/`chat_id`/`context_id`）；无角色实例 `role` 为 `null` 但键仍在（验收 8 / AR-11；固化在 pr-006）。
- 拒绝档轮次后同实例下一轮正常完成：无 `CONTEXT_RESET`、`context_id` 不变（验收 7）。

**前置依赖**：pr-003（`AcpClient` 参数名，已合并）　**优先级**：P0

---

## T4 · 交付自验（回归 + 临时探针）

**做什么 / 验收（可测试判据）**
- `node --check src/agent.js src/context-pool.js` 通过。
- `node --test test/context-pool.test.js`：16/16 通过；`dev-1` argv 仍含 `--no-tools`。
- `npm test`：159 用例全绿（16 个既有测试文件零修改 = §2.3 逐字节不变式）。
- `/tmp` 临时探针（不入库）：`oamp agent start pb-dev --tools off` 的 acp argv 含 `--no-tools`；`pb-dev` 裸起 → 内置缺省 on 且 argv 含 `--append-system-prompt …/roles/dev/dev.md`；`auditContext` 四键在审计日志行出现。
- `grep -rn "'pb-'" oamp/src` 仍仅命中 `role-binding.js`（前缀公式单一）。

**前置依赖**：T2、T3　**优先级**：P0

---

## T5 · PR 级范围核查

**做什么 / 验收（可测试判据）**
- `git status` 仅含 `oamp/src/agent.js`、`oamp/src/context-pool.js`、`docs/iterations/0012-roles-agent-cluster/prs/pr-004-agent-role-binding-tasks.md`（本文件）；无测试文件改动、无 `prd/`/`architecture.md`/`demand.md` 改动、零新依赖。
- 人工冒烟（可复跑，判定见 PR 卡）：fake Router + `OAMP_OMP_BIN` 记录 argv 的 fake + `OAMP_ROLE_ROOT=<仓库根>`，`agent start pb-dev --role dev --tools on --permission allow` 投一轮 `omp-daemon` 任务 → argv 含 `roles/dev/dev.md` 且无 `--no-tools`。

**前置依赖**：T4　**优先级**：P1

---

## 交付报告契约（dev 段）

1. 改动文件（路径 + 关键行号）
2. 参数面与推断绑定（flag 名 / 缺省 / 优先级 / 退出码 2 触发表）
3. 两条 LLM 路径注入证据（daemon argv / 一次性 argv）
4. `auditContext` 透传证据（四键来源与取值时机）
5. 测试结果（`node --check` / `node --test test/context-pool.test.js` / `npm test` / 临时探针）
6. 越界声明（含是否有范围外文件改动、是否有未决项）

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | 一次性 `omp -p` 的 `--model` 取 `payload.model \|\| envModel \|\| modelOverride`（实例级链至 env 为止，**不**注入 `config.defaults.model`/内置）——`omp -p` 的 config/内置层由 omp 自身解析（0011 现状）；若注入 defaultModel，则无 flag 的匿名实例 argv 会变，违反 §2.3 逐字节不变式 | §4.1 链 + §2.3 回归不变式（含「`omp -p` argv」）+ 卡验收 6「未传该 flag 的实例行为不变」 |
| MI-2 | T3 | `onPermissionRequest` 不透传（缺省 `null`）；策略判定由静态 `permission` 承担 | §12.2 契约 1（参数存在，但无动态策略来源）+ YAGNI（无可变真源） |
| MI-3 | T3 | `auditContext.context_id` 以取值器惰性解析（`ctx-<pid>-<generation>` 依赖 spawn 后的 pid，构造时刻不可得） | §12.2 契约 1 + `context-pool.js` 既有 `contextId` 定义 |
| MI-4 | T1 | `--role` 值校验：非空 + 不含 `/`、`\`，且非 `.`/`..`（架构未定义角色名正则；路径安全后仍以角色文件存在性兜底） | §3.4（仅列「空值非法」）+ §3.1（角色文件真源路径） |

## 循环依赖

无（T1 → T2 → T4 → T5；T3 → T4，DAG）。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1**：`AGENT_START` 按 §4.2 增补 `role`/`model`/`tools`/`permission`/`role_file` 字段 ⇒ 无角色实例的 `AGENT_START` 行由 `instance=…` 变为多字段（`role`/`role_file` 取 null 时按 `log.js` 既有口径省略键）。§2.3 的逐字节不变式明确限定于 ACP argv 与 `omp -p` argv，故本项不冲突；`event-log.test.js` 的行格式正则（`[a-z_]+=[^ ]+`）不受影响。
- **O-2**：`permission_denied` 轮次的 `task.result` 文案与 `duration_ms ≤ 10s` 由 pr-003（`AcpClient`）与阶段 6 的 E5 取证；本 PR 只负责「会话保留」这一半（早退名单）。
