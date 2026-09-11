# pr-005 集群入口：cluster up/down/status + 拓扑复用

## 上下文摘要

新增 `src/cluster.js`（`up` / `down` / `status`）与 `cli.js` 的 `cluster` 分发，并把 `status.js` 的查询抽成 `queryNodes(config)` 复用拓扑表：`up` 校验配置 → tmux 探活 → 建 session（router / web / 每角色一窗口，`-c <cwd>`、`tee` 日志落 `.runtime/cluster/`）→ 等全部实例 online；`down` 走 SIGINT → 等 pane 子树消失 → `kill-session` → 残留检查；`status` 只读分段展示。`OAMP_TMUX_BIN` / `OAMP_CLUSTER_WAIT_MS` 为测试注入点。

## 涉及功能点

- F06
- F07
- F01

## 文件范围

- oamp/src/cluster.js（新建）
- oamp/src/cli.js（改造：`cluster` 分发 + USAGE 一行）
- oamp/src/status.js（改造：抽出并导出 `queryNodes(config)`；default 导出行为不变）
- oamp/test/cluster-actions.test.js（新建）

## 验收标准

- [ ] `node bin/oamp.js cluster up --config <fixture> --wait 0`（`OAMP_TMUX_BIN` 指向记录 argv 的假 tmux）→ 假 tmux 记录中：session 名 = 配置 `session`；窗口名与数量 = `router` + `web` + enabled 角色数（顺序 = 配置声明序）；每窗口命令含 `-c <配置 cwd 的绝对路径>`、`--role <role>`、`--tools on|off`、`--permission allow|deny`、`[--model X]`，且尾部含 `tee -a <PKG_ROOT>/.runtime/cluster/<name>.log`（AR-13/AR-14/AR-15/AR-19）
- [ ] 日志：`up` 开始时逐个 truncate `<PKG_ROOT>/.runtime/cluster/*.log`；该目录被既有 `oamp/.gitignore` 的 `.runtime/` 覆盖（`git check-ignore` 命中，**不改任何 `.gitignore`**）（F06-6）
- [ ] 配置驱动、脚本内不硬编码角色清单：省略 `--config`（取缺省 = 仓库根 `cluster.json`，pr-002 产物）跑一次 fake-tmux `up --wait 0` → 窗口数 = 12（`router` + `web` + 10 个 `pb-*`），窗口名与 `roles/` 下 10 个角色一一对应；在 fixture 配置中增/删一个角色后窗口数随之增减而 `src/cluster.js` 无需改动（F06-1 / M-03 的可判定形式）
- [ ] `up` 幂等：`has-session` 命中时不发任何 `new-session`/`new-window`、不 kill，打印「集群已在运行（session=…，N 窗口）」+ attach 提示 + 「如需重建请先 `oamp cluster down`」，退出 0；部分失败（有实例未 online）→ 非 0 + 保留现场（AR-16）
- [ ] `down` 序列：对本次 session 的每个窗口先 `tmux send-keys -t <s>:<win> C-c`，等 pane 子树退出（≤10s），再 `tmux kill-session`；无 session → 打印后退出 0；残留 pid 存活 → SIGKILL 兜底 + 非 0 退出（AR-16）
- [ ] `status` 只读且分段输出：session 存在性 + `tmux list-windows -F '#{window_name} #{pane_current_path} #{pane_dead}'` + `renderTable(queryNodes(config))` 的 Router 拓扑表 + 日志目录与各文件大小；Router 不可达 → 明确报错段 + 退出 1（不静默冒充成功）（§5.2 / F06-4）
- [ ] `tmux -V` 探活失败（`OAMP_TMUX_BIN` 指向不存在路径）→ `oamp cluster: …` 明确报错 + 退出 2，不半启动（R-9）
- [ ] CLI 用户面：`oamp cluster <非法子命令>` → 退出 2 + USAGE 含 `cluster` 一行；`oamp -h` stdout 含 `cluster`（F06-4 可发现性）
- [ ] `node --test test/cluster-actions.test.js` 全绿（fake tmux + `OAMP_CLUSTER_WAIT_MS=0`，零真实 tmux 会话、零真实 omp）；`test/cli.test.js`、`test/status.test.js` 原样全绿（USAGE 只追加一行，`test/cli.test.js:63-76` 均为子串匹配）

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §5.2（三动作契约与退出码）、§5.3（tmux 组织）、§5.4（日志落点与截断）、§5.5（幂等与 down 序列）、§8 AR-13~AR-16/AR-19、§12.2（G5 与跨组契约 3/4）
- docs/iterations/0012-roles-agent-cluster/prd/F06-cluster-script-config-tmux.md（验收 2/3/4/5/6/8）、prd/F07-role-working-directory.md（验收 4）、prd/F01-role-instance-identity-lifecycle.md（验收 1/5）
- 现行代码锚点：`oamp/src/cli.js:4-27`（`USAGE` 常量；:29-32 是 `usageError`）、`:93-95`（`status` 分发范式，cluster 分支照此加）、`oamp/src/status.js:39`（`renderTable` 已导出）、`:79-117`（`status` default 导出的查询与渲染区，`queryNodes` 自 `loadConfig` 起抽出）、`oamp/.gitignore`（`.runtime/`）、`oamp/scripts/testenv.mjs`（独立脚本 + 既有辅助复用的先例）

## depends_on

- pr-002-cluster-config.md（理由：`up`/`status` 的第一步都是「读配置 + 全量校验」，消费跨组契约 3 的 `loadClusterConfig`。证据：`src/cluster.js` 必须 `import { loadClusterConfig } from './cluster-config.js'`——窗口名 `instanceId`、`-c` 的 `cwd`、三档角色参数与日志路径全部取自该函数返回的 `roles` Map；该模块不存在时 `oamp cluster up` 在 `oamp/src/cli.js:39-46` 的 `loadAndRun` 处即报「模块尚未实现」并退出 1，三动作全部不可用）

## batch

3
