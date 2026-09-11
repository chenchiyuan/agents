# pr-006 任务列表（端到端断言扩展 + README 集群一节）

**来源**：`prs/pr-006-e2e-and-docs.md`（验收标准 1~8）+ `architecture.md` §5.6（测试组织：argv 断言层 / fake vs 真实边界 / 回归）、§3.4（单起参数面与 tools 三分支）、§3.3（两条 LLM 路径落点 1/2）、§4.5（审计字段恒定 + 落点=agent stdout 事件行）、§11.2（E5 审计口径：受门禁调用 N=N、变更类指令）、§2.3（回归不变式：匿名实例 argv 逐字节一致）、§12.1（README 同步项）
**范围**：`oamp/test/acp-daemon.test.js`（改造：**只增断言/用例，既有 E-1~E-5 与 F08 的断言零修改**）、`oamp/README.md`（更新：环境变量表 + 集群一节）
**不涉及**：`oamp/src/**`、`oamp/test/helpers/harness.js`、其余 15 个既有测试文件、`prd/`、`architecture.md`、`demand.md`
**依赖**：pr-003（`acp-client.js`：argv 参数化 + permission 应答 + `TOOL_APPROVED`，已合并）+ pr-004（`agent.js`/`context-pool.js`：4 flag、角色推断与注入、`auditContext` 透传，已合并）
**依赖图**：T1 → T2 → T4 → T5；T3 ∥（T1/T2）；T3 → T4（验收 7 需 README 与测试同 PR 交付，但不共享文件、无内容依赖）

---

## T1 · argv 级断言：角色实例注入 + 工具开关 + 匿名回归 + 一次性路径

**做什么**
- 在 `oamp/test/acp-daemon.test.js` 末尾追加新用例（不触碰既有用例、不修改 `FAKE_ACP_SOURCE` 与既有 helper）：
  - 复用本文件既有 `spawn`（`:11` import）、`buildEnv`、`waitFor`、`sendAndWait`、`startWeb`、`tempDbDir`，新增局部 helper `startFlaggedAgent(instanceId, flags, {socketPath, cwd, envExtra})`（**harness.startAgent 不支持附加 flag，卡明文要求就地 spawn，不得改 harness**）。
  - 在同一 Router 下起三个实例：`pb-dev --role dev --tools on --permission allow`（`OAMP_ROLE_ROOT` 与 `cwd` 指向仓库根）、`pb-planner --role planner --tools off`（同根）、匿名 `dev-1`（`startAgent`，既有 helper）；三者各以独立 `FAKE_ACP_ARGS_LOG` 落 argv（避免交错）。
  - 各投一轮 `omp-daemon`（经 web `POST /api/messages`）触发懒创建 `omp acp` 常驻进程；再各投一轮 `one_shot:true` 触发 `omp -p` 一次性路径。

**验收（可测试判据）**
- `pb-dev` acp argv：含 `--append-system-prompt` 且其值为 `<仓库根>/roles/dev/dev.md` 绝对路径；**不含 `--no-tools`**（验收 1 / F02-5 / F04-2 / AR-04/05/08）。
- `pb-planner --tools off` acp argv：**含 `--no-tools`**（验收 2 / AR-08 第 ② 支）。
- 匿名 `dev-1` acp argv：`acp --no-skills --no-rules … --no-tools`，**不含** `--append-system-prompt`（验收 3 / §2.3 回归不变式）；同一实例 `omp -p` argv 含 `--no-tools` 且无注入。
- `pb-dev` 一次性 `omp -p` argv：含 `--append-system-prompt` = 同一角色文件绝对路径（验收 4 / §3.3 第 2 行）。

**前置依赖**：无（pr-003/pr-004 已合并）　**优先级**：P0

---

## T2 · 审计级断言：常驻路径 permission → `TOOL_APPROVED` 四键非空 + N=N

**做什么**
- 在同一测试文件追加第二个新用例：新增**独立的** fake ACP 源（`FAKE_PERM_ACP_SOURCE`，写独立临时目录），实现 `initialize` / `session/new` / `set_config_option` / `session/prompt`，并在每次 `session/prompt` 主动下发一次 `session/request_permission`（`toolName:'edit'`，变更类，§11.2），收到客户端应答后才切一片 `agent_message_chunk` 并结算 `end_turn`。
- 起 `pb-dev --role dev --tools on --permission allow`（`OAMP_OMP_BIN` 指向该 fake），同一 chat 连投两轮；断言 agent stdout 事件行。
- 新增局部 helper `parseEventLines(text, name)` / `parseFields(rest)`：把 `log.js` 渲染行解析为 `{name, fields}` 对象**后对 fields 断言**（非子串匹配；`log.js` 对 null 值键跳过渲染 ⇒ 取值非空 ⇔ 该键在解析结果中存在，四键任一为 null 断言必失败）。

**验收（可测试判据）**
- 第 1 轮：该轮 `state=completed`（out 文本 = fake 应答），agent 事件中**恰 1 行** `TOOL_APPROVED`；其 fields 的 `instance='pb-dev'`、`role='dev'`、`chat_id` = 该轮 chat_id、`context_id` 匹配 `^ctx-\d+-\d+$`（四键非空且角色实例取值非空），另有 `tool='edit'`、`tool_call_id`、`option='allow_once'`、`pid` 为数字（验收 5 / F05-2 / AR-11 / §4.5）。
- 第 2 轮（同 chat，同常驻会话）：`TOOL_APPROVED` 累计**恰 2 行**，两行 `tool_call_id` 不同、`chat_id`/`context_id` 相同（N=N 口径，§11.2）。
- fake 侧收到的应答为 `{outcome:{outcome:'selected',optionId:'allow_once'}}`（允许档恒 `allow_once`）。

**前置依赖**：T1（同文件、复用新增 helper；同文件串行写入）　**优先级**：P0

---

## T3 · `oamp/README.md`：环境变量表补四键 + 新增「集群（`oamp cluster`）」一节

**做什么**
- 环境变量表按既有列格式追加 4 行：`OAMP_ROLE_ROOT`（agent，缺省 `<仓库根>`）、`OAMP_CLUSTER_CONFIG`（cluster，缺省 `<仓库根>/cluster.json`）、`OAMP_TMUX_BIN`（cluster，缺省 `tmux`）、`OAMP_CLUSTER_WAIT_MS`（cluster，缺省 `20000`，`0`=不等）。
- 新增一节「集群（`oamp cluster`）」，位置在「真实消息处理（omp / LLM 执行器）」之后、「配置面」之前，覆盖 `pr-006` 卡的 README 要点：`cluster.json` 位置与 schema 要点（`session`/`web`/`router`/`roles.<role>` 五字段：`enabled`/`model`/`tools`/`permission`/`cwd`）、`oamp cluster up|down|status` 用法与幂等/失败语义、tmux 一进程一窗口（`router`/`web`/`pb-<role>`）与日志落点 `<包根>/.runtime/cluster/`、permission 两档与审计口径、默认模型与按角色覆盖链、单起角色实例的 flag 形式。
- **如实写明边界**：R-3（只读工具 read/glob/grep 不过门禁 → 无审计记录，N=N 仅指受门禁的变更类调用）、R-4（角色缺省 `cwd` = 仓库根 ⇒ 角色可在仓库内读写）。

**验收（可测试判据）**
- README 含四个新 env 键（grep 命中且语义与 `role-binding.js` / 架构 §3.1 / §5.2 一致）。
- 运维按 README 能照抄出 `oamp cluster up` / `down` / `status`、`cluster.json` 五字段、日志路径、permission 两档；R-3/R-4 明文可见（验收 6）。

**前置依赖**：无（文档面与测试面不共享文件）　**优先级**：P1

---

## T4 · 交付自验（回归 + 只增不变式）

**做什么 / 验收（可测试判据）**
- `node --test test/acp-daemon.test.js` 全绿（既有 5 用例 + 新增用例）。
- `npm test` 全绿（既有 182 + 新增用例），其余 15 个测试文件零修改。
- `git diff -- oamp/test/acp-daemon.test.js` 中**不存在既有断言行的删除**（只增）；`git status` 仅含 `oamp/test/acp-daemon.test.js`、`oamp/README.md` 与本 tasks 文件；`oamp/src/**`、`oamp/test/helpers/harness.js` 无改动。
- 零新依赖（`package.json` 无 diff）。

**前置依赖**：T1、T2、T3　**优先级**：P0

---

## T5 · 提交与 PR 级范围核查

**做什么 / 验收（可测试判据）**
- 在 worktree 分支 `feat/0012-pr-006-e2e-and-docs` `git commit`（不使用 `--no-verify`），commit 信息说明"为什么"。
- 交付报告含 commit hash + 新增断言清单 + README 改动摘要 + 测试结果 + 越界声明。

**前置依赖**：T4　**优先级**：P0

---

## 交付报告契约（dev 段）

1. 改动文件（路径）
2. 新增断言清单（逐条对应本文件 T1/T2 验收）
3. README 改动摘要（新增 env 行 + 新节结构）
4. 测试结果（`node --test test/acp-daemon.test.js` / `npm test` 的用例数与通过情况）
5. commit hash
6. 越界声明（是否有范围外文件改动、未决项）

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | 审计断言在 e2e 子进程链路下只能取 agent stdout 的**渲染事件行**，再解析为 fields 对象后断言；「四键非空」以"键在解析结果中存在（= log.js 未跳过它）"判定 | 卡验收 5 括注（断言 fields 而非渲染行；`log.js:22` 跳过 null 值键）+ §4.5（键恒定存在、未提供时为 null）+ 本文件唯一可观察通道是子进程 stdout |
| MI-2 | T2 | fake perm ACP 每次 `session/prompt` 恰下发 1 次 `session/request_permission`，两轮 → 2 行；不构造"单轮 2 次请求" | 卡验收 5「恰 1 行 … 同一会话两次受门禁请求 → 2 行」+ §11.2（一次 permission 请求一行） |
| MI-3 | T1 | 三个实例各用独立 `FAKE_ACP_ARGS_LOG`（同一 fake bin、不同文件）以便按实例归属 argv | §5.6「扩展 `FAKE_ACP_ARGS_LOG` 断言」+ 多实例同 Router 并行是既有能力（§4.4） |

## 循环依赖

无（T1 → T2 → T4 → T5；T3 → T4，DAG）。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1**：卡验收 5 括注「断言事件对象/recorder 收得的 fields，不是渲染行」——e2e 子进程链路不存在进程内 recorder，唯一通道是 stdout 渲染行；已按 MI-1 解析为 fields 对象后断言，并在测试注释中说明 null 跳过语义。若主 agent 要求真·事件对象，需改为在 `acp-daemon.test.js` 内起进程内 `ContextPool`+`AcpClient`（那属 `tool-permission.test.js` 的已覆盖层，且偏离"端到端"）。
- **O-2**：README 集群一节的 `cluster.json` 字段写作以架构 §5.1 为唯一来源；若 pr-005 实现的 `cluster.js` 用法与之有出入，需以实现为准回改 README（超出本 PR 可写范围）。
