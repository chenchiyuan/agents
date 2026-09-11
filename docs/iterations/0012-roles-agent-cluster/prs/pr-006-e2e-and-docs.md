# pr-006 端到端断言扩展与文档同步

## 上下文摘要

收口：扩展 `oamp/test/acp-daemon.test.js`（真实 Router + agent 子进程 + fake ACP + `FAKE_ACP_ARGS_LOG`），断言角色实例两条 LLM 路径的注入参数、工具开关与 permission 审计链路；并同步 `oamp/README.md` 的配置面与集群一节。只改测试与文档，不动任何 `src/`——它是「角色实例真的按角色干活」的自动化判定面，也是匿名实例回归不变式的守护。

## 涉及功能点

- F02
- F04
- F05
- F01

## 文件范围

- oamp/test/acp-daemon.test.js（改造：新增断言，不删既有断言）
- oamp/README.md（更新：集群一节与配置面）

## 验收标准

- [ ] 常驻路径（`agent start pb-dev --role dev --tools on --permission allow`，`OAMP_ROLE_ROOT` 与进程 cwd 指向仓库根）：`FAKE_ACP_ARGS_LOG` 中出现 `--append-system-prompt <仓库根>/roles/dev/dev.md` 且该行**不含** `--no-tools`（F02-5 / F04-2 / AR-04/AR-05/AR-08）
- [ ] 一次性路径（`executor:'omp'`）：`omp -p` 的 argv 含同一角色文件绝对路径（现行 `oamp/src/agent.js:158-161` 的 args 只有 `-p/--no-session/[--no-tools]/[--model]`，断言在 pr-004 合入前必然失败）
- [ ] 匿名实例（`agent start dev-1`，无 flag）的 argv 与既有断言逐项一致：acp argv 含 `--no-tools` 且无 `--append-system-prompt`（§2.3 回归不变式）
- [ ] permission 审计链路（fake ACP 在常驻会话中主动发 `session/request_permission`）：允许档该轮 `completed` 且 agent 事件中恰 1 行 `TOOL_APPROVED`（含 `instance`/`role`/`tool`/`tool_call_id`/`option`）；同一会话两次受门禁请求 → 2 行（N=N，§11.2 口径）
- [ ] 既有 E-1~E-5 与 F08 用例的断言面不删不改（只增断言）
- [ ] `oamp/README.md` 新增集群一节：`oamp cluster up|down|status`、仓库根 `cluster.json` 的角色段字段（`enabled`/`model`/`tools`/`permission`/`cwd`）、日志落点 `.runtime/cluster/`、`--append-system-prompt <role.md>` 注入机制与 permission 两档，并如实写明 R-3（只读工具无审计记录）与 R-4（缺省 cwd = 仓库根，可写）边界
- [ ] 测试以本文件既有的 `spawn`（`oamp/test/acp-daemon.test.js:11`，`spawn` import）与 `buildEnv`/`waitFor` 直接拉起带 flag 的 agent 子进程；**不修改 `oamp/test/helpers/harness.js` 及其余 15 个既有测试文件**
- [ ] `node --test test/acp-daemon.test.js` 与全量 `npm test` 全绿；`git status` 中 `src/` 与其余 15 个测试文件无改动

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §5.6（测试组织与 fake / 真实边界）、§9（卡片映射的判定锚点）、§11.2（E5 审计口径）、§12.1（README 同步项）、§2.3（回归不变式）
- docs/iterations/0012-roles-agent-cluster/prd/F02（验收 2/5）、F04（验收 2）、F05（验收 2/4）、F01（验收 3/4）
- 现行代码锚点：`oamp/test/acp-daemon.test.js:26-37`（`FAKE_ACP_ARGS_LOG` 注入）、`:404-408`（argsLog 用法）、`oamp/src/agent.js:150-161`（一次性 argv）、`oamp/src/acp-client.js:79`（常驻 argv）、`oamp/test/helpers/harness.js`（`buildEnv` / `startAgent`）
- 注（与 §12.2 的 G6 建议的差异）：架构 §12.2 把 G6 记为「依赖 G4 + G5」，但 §5.6 对本文件的断言面只列 argv 级（角色实例与一次性路径的注入参数、`--no-tools` 有无），未含 `cluster.js` 编排；集群编排的判定面在 pr-005 的 `cluster-actions.test.js`（fake tmux），真实 tmux 链路是阶段 6 人工验收（G7，非 PR）。故按代码证据只写 G3/G4 两条直接依赖。

## depends_on

- pr-003-acp-tool-permission.md（理由：断言的两类可观察量由 pr-003 产出——常驻 argv 的拼装点 `oamp/src/acp-client.js:79`（现行硬编码 `--no-tools`）与 `_handleMessage` 的 permission 分支 / `TOOL_APPROVED` 事件。未合入时 argv 恒含 `--no-tools` 且 permission 帧被 `_pending` 查找直接丢弃，注入断言与审计断言均不可能通过）
- pr-004-agent-role-binding.md（理由：e2e 以带 flag 的 `agent start` 拉起实例，flag 解析、`pb-` 推断、两条路径注入与 `ROLE_BOUND`/`AGENT_START` 事件由 pr-004 在 `oamp/src/agent.js:459-492` 与 `:150-161` 落地；未合入时多余 flag 被静默忽略、argv 中不会出现 `--append-system-prompt`。pr-001 经 pr-004 传递满足）

## batch

3
