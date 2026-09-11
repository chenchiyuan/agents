# pr-005 任务列表（集群入口 cluster up/down/status + 拓扑复用）

**来源**：`prs/pr-005-cluster-entry.md`（验收标准 9 条）+ `architecture.md` §5.2（三动作契约与退出码）/ §5.3（tmux 组织：session 名、一进程一窗口、`-c <cwd>`、`remain-on-exit`、`set-environment OAMP_ROLE_ROOT`、`tee` 双通道）/ §5.4（日志落点 `<PKG_ROOT>/.runtime/cluster/`、一进程一份、up 时逐个截断）/ §5.5（`up` 幂等与部分失败、`down` 序列与残留检查）/ §6.4（收口数据流）/ §8 AR-13~AR-16 / §12.2 契约 3（`loadClusterConfig`）与契约 4（`status.js` 导出 `queryNodes(config)`）
**范围**：`oamp/src/cluster.js`（新建）、`oamp/src/cli.js`（改造：`cluster` 分发 + USAGE 一行）、`oamp/src/status.js`（改造：抽出并导出 `queryNodes(config)`；default 导出行为不变）、`oamp/test/cluster-actions.test.js`（新建）；既有 16 个测试文件零修改、零新依赖、不改 `prd/`/`architecture.md`/`demand.md`/`.gitignore`
**依赖**：pr-002（`cluster-config.js` 的 `loadClusterConfig`，已合并）+ pr-001（`role-binding.js` 的 `instanceIdForRole`，经 pr-002 间接消费，已合并）
**依赖图**：T1 → T2 → T3 → T4 → T5 → T6 → T7（T2~T4 同文件 `cluster.js`，串行；T1 在独立文件、T5 在独立文件，但两者的验收都要等 `cluster.js` 存在 → 关键路径 T1 → T2 → T3 → T4 → T5 → T6 → T7）

---

## T1 · `status.js` 抽出并导出 `queryNodes(config)`

**做什么**
- 把 default 导出的查询段（`connectSocket` → `RpcPeer.request('router.status')` → `nodes` 归一）抽成 `export async function queryNodes(config) → nodes[]`；`renderTable` 保持已导出。
- 失败语义平移：连接失败抛 `无法连接 oamp router（socket=<path>；router 未运行？先执行 oamp router start）`；请求被拒抛 `查询被拒（<dataCode>）: <message>`（两段文案逐字保留）。
- default 导出改为 `loadConfig` → `queryNodes` → `renderTable`，两处 catch 均打印 `oamp: status 失败: <message>` 并返回 1。

**验收（可测试判据）**
- `node --test test/status.test.js` 原样全绿（5 用例；含 M-02 的退出码 1 / stderr 含 socket 路径 / stdout 空）。
- `grep -n "export async function queryNodes" src/status.js` 命中；`src/status.js` 的 default 导出仍返回 0/1 两个码。
- Router 不可达时 stderr 与改造前逐字一致（`test/status.test.js` 的 M-02 断言即判据）。

**前置依赖**：无　**优先级**：P0

---

## T2 · `cluster.js` · `up` 动作（探活 / 幂等 / 建窗 / 日志截断 / 就绪等待）

**做什么**
- 模块骨架：`PKG_ROOT`（按本模块位置推导，与 `config.js`/`role-binding.js` 同口径）、`BIN = <PKG_ROOT>/bin/oamp.js`、`LOG_DIR = <PKG_ROOT>/.runtime/cluster`；default 导出 `async function cluster(restArgs)`（`restArgs[0]` = 动作）分发 `up|down|status`。
- 参数面：`--config <path>`、`--wait <ms>`（仅 up）；未知动作 / 未知参数 / 缺值 → stderr 报错 + 退出 2。
- 配置：`loadClusterConfig({ path, env })`，抛错 → `oamp cluster: 配置错误: <原因>` + 退出 2（在建立 session 之前）。
- tmux 探活：`bin = env.OAMP_TMUX_BIN || 'tmux'`；`tmux -V` 失败（ENOENT / 非 0）→ `oamp cluster: tmux 探活失败（bin=…）: <原因>` + 退出 2，不建任何 session。
- 幂等：`has-session -t <session>` 命中 → 不 new-session/new-window/kill，打印 `集群已在运行（session=<s>，N 窗口）`（N = `list-windows` 行数）+ `tmux attach -t <s>` + `如需重建请先 oamp cluster down`，退出 0。
- 建窗（顺序 = router → web → 角色配置声明序，`enabled:false` 不建窗）：`new-session -d -s <s> -n router -c <root> <cmd>` → `set-option -t <s> remain-on-exit on` → `set-environment -t <s> OAMP_ROLE_ROOT <root>` → 逐个 `new-window -t <s> -n <instanceId> -c <cwd> <cmd>`。
- 窗口命令：`<env 前缀><node> <BIN> <argv…> 2>&1 | tee -a <LOG_DIR>/<name>.log`；argv = `router start` / `web start --port <port>` / `agent start <instanceId> --role <role> --tools on|off --permission allow|deny [--model <m>]`；env 前缀仅在 `router.socket` 非空时承载 `OAMP_SOCKET=<path>`（§5.1）。
- 日志：`mkdir -p <LOG_DIR>`；逐个清空目录内既有 `*.log`（§5.4「up 开始时逐个 truncate」）；为本次预期日志补齐空文件。
- 就绪等待（`waitMs = --wait > env OAMP_CLUSTER_WAIT_MS > 20000`；`0` = 不等）：共享单一 deadline——先轮询 Router socket 可连，超时 → stderr `Router 未就绪（socket=…，等待 Nms）` + 指向 router 窗口/日志 + 退出 1（**不 kill 现场**）；再轮询 `queryNodes` 直到全部 enabled 实例 `state=online`，超时 → stderr 列出未 online 的 `instance_id` + 退出 1（同样保留现场）。
- 成功：打印 session 名 / 窗口数 / `tmux attach -t <s>` / 日志目录 / `renderTable(nodes)` 拓扑表，退出 0；`waitMs=0` 时跳过两段等待并打印「未等待就绪」一行（不查 Router）。

**验收（可测试判据）**
- fake tmux（`OAMP_TMUX_BIN`）+ `--wait 0`：session 名 = 配置 `session`；窗口数 = `router` + `web` + enabled 角色数（fixture 增删角色 ⇒ 窗口数随增减，`src/cluster.js` 零改动）；每个角色窗口 `-c` = 配置 `cwd` 的绝对路径、命令含 `--role/--tools on|off/--permission allow|deny/[--model X]`、尾部 `tee -a <LOG_DIR>/<instanceId>.log`；`enabled:false` 角色零窗口（验收 1/2/9）。
- 幂等：`has-session` 命中时 fake tmux 记录中零 `new-session`/`new-window`/`kill-session`，stdout 含「集群已在运行（session=…，N 窗口）」+ attach 提示 + 「如需重建请先 `oamp cluster down`」，退出 0（验收 4）。
- 探活失败（`OAMP_TMUX_BIN` 指向不存在路径）：`oamp cluster:` 前缀报错 + 退出 2 + 零 tmux 子命令（验收 8）。
- 就绪超时：`--wait 300`（或 env）+ 不可达 socket → 退出 1 + stderr 含 `Router 未就绪` 与 socket 路径；fake tmux 记录中只有 router 窗口、无 web/角色窗口、无 `kill-session`（验收 5）。
- 部分失败：真实 Router + fake tmux（无角色进程）→ 全部实例未 online ⇒ 退出 1 + stderr 列出缺失 `instance_id` + 全部窗口已建（保留现场，验收 5）。
- `up` 后 `<LOG_DIR>/<name>.log` 存在且被截断（预置哨兵 `.log` 内容被清空）；`git check-ignore` 命中日志产物（验收 2）。

**前置依赖**：T1　**优先级**：P0

---

## T3 · `cluster.js` · `down` 动作（SIGINT → 等子树 → kill-session → 残留检查）

**做什么**
- 无 session（`has-session` 非 0）→ 打印 `集群未在运行（session=…）` + 退出 0（幂等）。
- 采集：`list-windows -t <s> -F '#{window_name}'`（窗口名）与 `list-panes -a -F '#{session_name} #{pane_pid}'`（过滤本 session 的 pane pid = 残留检查的根）。
- 逐窗口 `send-keys -t <s>:<win> C-c`（SIGINT → Router unlink socket / agent 注销）。
- 等 pane 子树消失：`ps -axo pid=,ppid=,stat=` 展开后代，上限 10s（`OAMP_CLUSTER_WAIT_MS` 可覆盖，供测试），僵尸态（`stat` 以 `Z` 开头）不计存活。
- `kill-session -t <s>`；随后以步骤 ② 的 pid 为根做残留检查：仍有存活 → 逐个 `SIGKILL`（跳过 pid ≤ 1 与自身）+ stderr 报告 + 退出 1；干净 → stderr/stdout 打印已收口 + 退出 0。
- `ps` 不可用 → 明确警告并跳过残留检查（不静默：写明「无法执行 ps」）。

**验收（可测试判据）**
- fake tmux 记录序列：`has-session` → `list-windows -F '#{window_name}'` → `list-panes -a -F '#{session_name} #{pane_pid}'` → 每窗口一条 `send-keys -t <s>:<win> C-c` → `kill-session -t <s>`，且 `kill-session` 位于全部 `send-keys` 之后（验收 6）。
- pane pid 指向已死进程 → 无残留、退出 0、stdout 含「已收口」。
- pane pid 指向存活进程（`OAMP_CLUSTER_WAIT_MS=0` 跳过等待）→ 该进程被 SIGKILL、退出 1、stderr 含「残留」（验收 6）。
- 无 session → 退出 0 + 打印「未在运行」，零 `send-keys`/`kill-session`（验收 6）。

**前置依赖**：T2（共用参数解析、`runTmux`、`readWaitMs`）　**优先级**：P0

---

## T4 · `cluster.js` · `status` 动作（只读分段输出）

**做什么**
- 只读四段：① session 存在性；② 窗口清单 `list-windows -t <s> -F '#{window_name} #{pane_current_path} #{pane_dead}'`；③ `renderTable(queryNodes(runtimeConfig))` 的 Router 拓扑表；④ 日志目录 + 各 `*.log` 字节数；⑤ 逐角色对齐行（`instance_id` / 窗口是否存在 / 窗口存活 / online 状态 / `cwd` / 日志路径；`enabled:false` 标「未起窗口」）。
- Router 不可达：stderr 报错段（含 socket 路径）+ 其余段照常输出 + 退出 1（不静默冒充成功）；可达 → 退出 0。
- 不改任何状态（不发任何 tmux 变更子命令）。

**验收（可测试判据）**
- fake tmux + 真实 Router（零节点）→ 退出 0，stdout 同时含 session 段、窗口段（含 `pane_current_path` 值）、`renderTable` 表头 `instance_id  session_id  state  last_heartbeat`、日志目录与角色对齐行。
- Router 不可达 + session 存在 → 退出 1 + stderr 含「Router 不可达」+ stdout 其余段仍在。
- fake tmux 记录中零 `new-session`/`new-window`/`send-keys`/`kill-session`/`set-option`（验收 7 / §5.2 status 契约）。

**前置依赖**：T1、T2　**优先级**：P0

---

## T5 · `cli.js` · `cluster` 分发 + USAGE 一行

**做什么**
- `main(argv)` 新增 `cluster` 分支：`up|down|status` 之外的子命令（含缺子命令）→ `usageError('错误: 缺少/未知的 cluster 子命令: …')`（退出 2）；合法 → `loadAndRun('./cluster.js', 'cluster <sub>', argv.slice(1))`（restArgs 保留子命令，与 `task` 分支同范式）。
- `USAGE` 的「用法」区**只追加一行**：`  oamp cluster up|down|status [--config <path>] [--wait <ms>]  集群：拉起 / 收口 / 查看（tmux + 日志）`。

**验收（可测试判据）**
- `node bin/oamp.js cluster bogus` → 退出 2 + stderr 含用法与 `cluster`（验收 8/9）。
- `node bin/oamp.js -h` → stdout 含 `cluster`（可发现性）。
- `node --test test/cli.test.js` 原样全绿（USAGE 仅追加一行，既有断言均为子串匹配）。

**前置依赖**：T2~T4（模块存在才能联调）　**优先级**：P0

---

## T6 · `test/cluster-actions.test.js`（fake tmux + 四组用例）

**做什么**
- fake tmux：CJS 脚本，`$OAMP_FAKE_TMUX_STATE`（JSON：`hasSession`/`windows`/`panes`）驱动回放，`$OAMP_FAKE_TMUX_LOG` 逐行追加 argv JSON；`-V` 回 `tmux 3.4`；`has-session` 按状态退 0/1；`list-windows` 按 `-F` 格式回窗口名或 `name path dead`；`list-panes` 回 `session pid`；其余退 0。
- fixture：临时 root + `cluster.json` + `roles/<role>/<role>.md` + 各 `cwd` 目录（满足 pr-002 的启动前预检）。
- 用例：① `up --wait 0` 的 session/窗口名与数量/`-c`/命令串/日志截断/`git check-ignore`；② 幂等 `up`（零变更子命令）；③ 就绪超时失败（退出 1 + 明确错误 + 无 web/角色窗口）；④ 部分失败（真实 Router + 未 online 实例 → 退出 1 + 现场保留）；⑤ `down` 序列 + 干净退出；⑥ `down` 残留 → SIGKILL + 退出 1；⑦ `down` 无 session → 退出 0；⑧ `status` 分段输出（真实 Router 零节点 → 退出 0；Router 不可达 → 退出 1 且其余段照常）。
- 零真实 tmux 会话、零真实 omp、零网络；teardown 清理临时目录、spawn 的子进程、测试新建的日志文件与哨兵。

**验收（可测试判据）**
- `node --test test/cluster-actions.test.js` 全绿；`npm test` 全绿（既有 16 文件 + 本文件）。

**前置依赖**：T2~T5　**优先级**：P0

---

## T7 · 交付自验与范围核查

**做什么 / 验收（可测试判据）**
- `node --check src/cluster.js src/cli.js src/status.js` 通过。
- `node --test test/cluster-actions.test.js`、`node --test test/cli.test.js test/status.test.js`、`npm test` 全绿（既有 16 文件零修改）。
- `node bin/oamp.js cluster --help` / `cluster bogus` / `cluster up --config <不存在的路径>` 三条路径的退出码与文案可复跑（2 / 2 / 2）。
- `git status` 仅含 4 个受控文件 + 本 tasks 文件；无新依赖、无 `.gitignore`/`prd/`/`architecture.md`/`demand.md` 改动。

**前置依赖**：T6　**优先级**：P1

---

## 交付报告契约（dev 段）

1. 改动文件（路径 + 关键行号）
2. 三动作契约（up / down / status 的命令序列、退出码表、等待与超时口径）
3. 日志落点与截断证据（`<PKG_ROOT>/.runtime/cluster/` + `git check-ignore`）
4. 测试结果（`node --check` / `node --test test/cluster-actions.test.js` / `npm test` 用例数）
5. commit hash
6. 越界声明（范围外文件改动、未决项）

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | 就绪等待的单一预算：Router socket 就绪与实例 online 共享同一个 deadline（`waitMs` 一次性分配），不是各给一份 | §5.2 ⑦「同一 `--wait` 预算」的字面读解 |
| MI-2 | T2/T3 | `OAMP_CLUSTER_WAIT_MS=0` = up 跳过两段等待并以 0 退出（不查 Router）；同值也作为 down「等 pane 子树消失」的上限覆盖（缺省 10000ms）——后者是测试注入所需，架构只写「≤10s」 | §5.2 env 行（`0` = 不等，供测试）+ §5.5 down 上限 10s |
| MI-3 | T2/T3/T4 | 退出码分配：配置错误 / tmux 探活失败 = 2；就绪超时、实例未 online、down 残留 = 1；幂等命中 / 无 session / 全部就绪 = 0 | §5.2 三动作契约（up 探活明确「退出 2」，其余「非 0」）+ `status.js` 既有失败风格（运行时失败 = 1） |
| MI-4 | T2 | 窗口命令的 env 前缀只承载 `OAMP_SOCKET`（`router.socket` 非空时）；`OAMP_ROLE_ROOT` 走 `set-environment`（不重复进命令串）；命令内路径/取值按需 shell 单引号转义（常规字符集不加引号，保证 `tee -a <path>` 原样可见） | §5.1 `router.socket` 语义 + §5.3 `set-environment` 与 `<env 前缀>` 行 |
| MI-5 | T2 | 日志截断口径 = 清空目录内既有全部 `*.log`（含本次不再使用的历史日志）+ 为本次预期日志补齐空文件 | §5.4「`up` 开始时逐个 truncate `<PKG_ROOT>/.runtime/cluster/*.log`」 |
| MI-6 | T4 | cluster status 中 tmux 不可用（`OAMP_TMUX_BIN` 缺失）= 报错 + 退出 2；Router 不可达 = 退出 1（其余段照常输出） | §5.2 status 契约（Router 不可达退出 1）+ MI-3 的退出码分配 |

## 循环依赖

无（T1 → T2 → T3 → T4 → T5 → T6 → T7，DAG）。T2~T4 同文件故串行，非依赖环。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1**：`up` 的日志截断作用域是 `<PKG_ROOT>/.runtime/cluster/*.log`（规格固定路径，无 env 覆盖）⇒ 测试会触碰仓库内 `.runtime/cluster/`（该目录被 `.gitignore` 的 `.runtime/` 覆盖，harness 的「测试绝不触碰仓库 `.runtime/`」惯例在此被迫让位于 §5.4 的落点定案）；测试自身负责清理其新建的日志文件与哨兵。
- **O-2**：「部分失败（实例未 online）」的失败路径需要真实 Router 才可复现（fake tmux 下 router 窗不产生进程），测试用 `test/helpers/harness.js` 的真实 Router + fake tmux 组合覆盖；不涉及真实 omp/网络。
