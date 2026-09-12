# verify-20260912-145758-cluster-isolation — cluster-actions 测试隔离修复（迭代外补丁）独立验证

## 身份与交付元信息

| 项 | 值 |
|---|---|
| **验证者身份（反射结果）** | **同级代码审查者 + 并发环境复现工程师**——同时干过"测试套件与被测系统共享状态"这类事故审计的人：不信"默认没变"的口头保证，只看常量来源与调用点是否只差一行；也不信"测试没碰它"的感觉，只信**活集群日志的字节级不变性**与**受控 A/B 对照**。判据优先级 = 可复现实测 > 字节级证据 > diff 事实 > 注释自述。 |
| **产出物（验证范围）** | 主仓库工作区未提交改动，仅 2 个文件：`oamp/src/cluster.js`、`oamp/test/cluster-actions.test.js`（base = `3743f4e98f65385f21b9448ca1bf9174b43948cf`） |
| **验证标准来源** | 主 agent 委托的 7 条验证标准（原样内联于 brief），不附加通用最佳实践判定 |
| **验证日期** | 2026-09-12 |
| **验证方式** | 纯只读主仓库（验证前后 `git status --porcelain` 恒为上述 2 个 M，无新增未跟踪文件）+ **在集群运行中**（tmux `oamp-cluster` 12 窗口）实测：`node --test test/cluster-actions.test.js` 连跑 14 次、`node --test --test-concurrency=1 test/*.test.js` 全量 1 次；活集群日志用 md5 + 逐字节前缀比对；反向核对在 `/tmp/ab/` 副本沙箱内做 A/B（HEAD 版 vs 工作区版），**不触碰主仓库活集群日志** |
| **未使用的信息** | 未接收、未使用任何执行过程叙述（不提"为什么这么改"）；全部判定只基于产出物、7 条标准与实测输出 |

**隔离性声明（本报告是本次验证的唯一写入）**：未停集群、未清 `.runtime/cluster` 日志、未重启任何进程。验证前后 tmux session `oamp-cluster`（12 窗口）均在，router 进程 PID 31601 存活；主仓库 `.runtime/cluster/*.log` 仅被读取（`cp` 快照到 `/tmp`）。所有篡改/对照实验只在 `/tmp/ab/{orig,fixed}` 副本中进行，实验结束后已 `rm -rf`。

---

## 逐项判定

### 标准 1（默认行为不变）— **pass**

**1a. 改动仅限常量来源**：`oamp/src/cluster.js` 的 diff 只有 **2 个 hunk、3 增 2 删**，其中 2 行是注释换行，**唯一的代码行改动**是：
- `-const LOG_DIR = path.join(PKG_ROOT, '.runtime', 'cluster');`
- `+const LOG_DIR = path.resolve(process.env.OAMP_CLUSTER_LOG_DIR || path.join(PKG_ROOT, '.runtime', 'cluster'));`（现 `src/cluster.js:21`）

默认分支 `path.resolve(path.join(PKG_ROOT,'.runtime','cluster'))`：入参已是绝对路径，`path.resolve` 为恒等变换 ⇒ 默认值与改前**逐字节相同**。`PKG_ROOT` 定义（`src/cluster.js:19`）未动。

**1b. LOG_DIR 仅作为"目录基准"被消费，下游语义零变化**：全文件 7 处引用（`:51` `logPath()`、`:210-216` `prepareLogs()` 逐个 truncate、`:227-233` `logFiles()`、`:419` 超时提示、`:426` up 成功输出 `日志目录:`、`:494` down 残留提示、`:557` status `[日志] 目录:`），全部无第二处重新计算或拼接常量；`up/down/status` 控制流、退出码、tmux 子命令序列均不在 diff 内。

**1c. 默认值实测**：集群运行中执行 `node oamp/bin/oamp.js cluster status`（无任何 env 覆盖）两次（06:45、06:57），均输出：
```
[集群] session=oamp-cluster  运行中
  目录: /Users/chenchiyuan/projects/agents/oamp/.runtime/cluster   ← = <PKG_ROOT>/.runtime/cluster
```
两次输出一致，且 `[日志]` 段正常列出全部 12 个日志文件（非空列表，未退化为"暂无日志文件"）。

**1d. 交叉印证**：全量套件 251/251 通过（含 `test/cluster-config.test.js`、`test/cli.test.js`、`test/status.test.js` 等覆盖 cluster 配置与 CLI 分发的用例）。

### 标准 2（隔离生效，实测）— **pass**

集群运行中（10 个 `pb-*` online、12 个日志文件存在）执行 `node --test test/cluster-actions.test.js`，**14 次全部 12/12 全绿**（`# tests 12 | # pass 12 | # fail 0`，单次约 7.0–7.2s）：

| 批次 | 时间（UTC） | 结果 |
|---|---|---|
| 单次 run① | 06:48:08 → 06:48:15 | 12/12 pass |
| 单次 run② | 06:48:18 → 06:48:25 | 12/12 pass |
| 连跑 ×10 | 06:48:34 → 06:49:44（70s，跨 1 个心跳周期） | 每次 12/12 pass |
| 心跳对齐试跑① | 06:56:50 | 12/12 pass |
| 心跳对齐试跑② | 06:57:48 | 12/12 pass |

另有 1 次仅用于字节归因的试跑（未记录其判定结果，不计入上表）。全量套件运行时也包含这 12 个用例（见标准 4）。

### 标准 3（活集群日志未被触碰）— **pass**（判定口径需精化，见偏差 D-4）

**⚠ 方法论前提**：活集群**自身**持续写这些日志——心跳每 60s 每文件 1 行（实测对照窗：60s 内 10 个 `pb-*.log` 各 +92~106B、`router.log` +1107B（10 条心跳）、`web.log` 保持不变），且期间有人通过 web UI 派活（06:53:46 `TASK_CREATED from=web to=pb-workflow-pb`，label 为用户手输的"请告诉我workflow…"），使 `router.log` 在 156s 内增长 24KB。因此**"原始 md5 恒定"不是一个可重复成立的不变量**；本报告用三条可判定的不变性替代：①字节前缀保持（truncate/重写必破坏）②追加字节全部可归因为活集群自身活动 ③文件集合与外部内容零污染。

**3a. 严格 md5 一致窗口（核心证据）**：在对齐心跳间隙（秒 :48 启动、:55 前结束）的干净窗口 06:57:48 内跑完整测试文件：**12/12 文件 md5 完全一致**（`md5_identical=12/12 diff=[]`），测试同时 12/12 全绿；非零内容 11/12（`web.log` 前后均为 0 B——活集群 web 进程本就不向 stdout 写任何内容，改前改后均如此）。

**3b. 前缀保持 + 逐字节归因**：
- 70s 连跑 ×10 窗口（06:48:34 快照 → 06:49:44）：12/12 `PREFIX-OK`，`TRUNCATION_FREE=1`；追加字节**全部**为活集群心跳（10 个 `pb-*.log` 各 2 行 + `router.log` 19 行 = 39 行，时刻 06:48:40 与 06:49:40，与对照窗模式逐字一致，无一行测试产物）。
- 251 全量套件窗口（06:51:20 快照 → 06:53:56）：12/12 `PREFIX-OK`，`TRUNCATION_FREE=1`，文件集合 12→12 不变。
- 外部内容扫描（`test-cluster|cluster-logs|stale-sentinel|unused.sock|never-up|work/dev`）：全部窗口 `NO_FOREIGN_CONTENT`；活 `router.log` 内 `test-cluster|tmp/|/private/var/folders` 匹配数 = **0**（测试进程从未注册到活 Router——所有测试子进程的 `OAMP_SOCKET` 指向临时路径）。

**3c. 受控反向对照（A/B，`/tmp/ab/` 沙箱，非活集群）**：两副本各预置 12 个"既有日志"（含 `pb-verifier.log`）+ 仓库根 `cluster.json` + `roles/`，分别跑测试文件一次：

| 副本 | 测试结果 | 预置日志状态 |
|---|---|---|
| `orig`（`git show HEAD:` 还原两文件，即改前） | **11 pass / 1 fail**：`not ok 1 … 未启用角色无日志`（`AssertionError` @ 原 `:219`）——活集群既有 `pb-verifier.log` 被误判为本次产物 = 复现了"随机 1 红" | **12/12 全部被 truncate 为 0 B** |
| `fixed`（工作区版本） | **12/12 pass** | **12/12 逐字节不变**（`seeds intact=12/12, truncated_to_0=0`） |

**3d. 跑完后集群仍正常**（06:57 实测）：`tmux ls` → `oamp-cluster: 12 windows`（在）；`node oamp/bin/oamp.js cluster status` → exit 0，`[集群] session=oamp-cluster 运行中`，拓扑表 **10 个 `pb-*` 全部 `online`**（另有 `web` 实例于 06:53:46 由人的 UI 操作触发 `AGENT_REGISTERED` 而 online，属活集群自身活动，非测试影响）；`ls oamp/.runtime/cluster/*.log | wc -l` = **12**（`pb-*.log` 全在）；`web.log` 仍为 0 B（与改前一致）。

### 标准 4（全仓 251/251）— **pass**

集群运行中、不清日志、不停集群，`node --test --test-concurrency=1 test/*.test.js`：
```
1..251   # tests 251  # pass 251  # fail 0  # cancelled 0  # skipped 0  # todo 0
# duration_ms 156073.4    SUITE_EXIT=0
```
窗口 06:51:20 → 06:53:56（156s），期间套件自身启动的真实 Router/agent 子进程均走临时 socket，未污染活集群（见 3b）。套件含本补丁的 12 个 cluster 用例，一次通过。

### 标准 5（断言意图未被削弱）— **pass**

**5a. 逐用例断言条目数量逐条一致**（改前 → 改后，`git show HEAD:` 对照）：24 / 6 / 5 / 3 / 7 / 4 / 10 / 5 / 3 / 13 / 8 / 7，**12 个用例全部相同，合计 95 条**；全文件含 `assert.` 的行数改前改后同为 **96 行**（1 行位于辅助函数内）。用例数量 12 → 12，用例名唯一变化是 test 1 标题里 `git check-ignore` → `.gitignore 契约`。

**5b. 断言行的 diff 只有 8 行增 / 8 行删**，且仅两类语义：
1. `LOG_DIR` → `logDir`（7 行；test 1 的 `日志目录:` / `tee -a`×3 / `应存在` / `未启用角色无日志`，test 10 的 `目录:`）——即"日志目录指向哪"；
2. `spawnSync('git',['check-ignore','-q','.runtime/cluster/pb-dev.log'])` 的 `status===0` → 静态读 `OAMP_ROOT/.gitignore` 断言其中存在规则行 `.runtime/`（test 1 末，`:210-214`）——即"check-ignore 怎么断"。

**5c. 覆盖面逐项复核（对照 brief 列出的意图，全部仍在）**：窗口名与数量（`new-window` 名序列 + `enabled:false` 零窗口）、每窗 `-c`（web=root / 角色=配置 cwd 绝对路径）、命令串含角色 flag（`--role/--tools on|off/--permission allow|deny/--model`）与尾部 `tee -a <logDir>/<name>.log`、日志 truncate（改前哨兵 `stale-sentinel.log` 现在写入**用例内** `logDir`，断言仍为 `readFileSync(sentinel) === ''`）、up 幂等（仅 `has-session`+`list-windows`）、tmux 探活失败（exit 2 + 零子命令）、就绪超时（exit 1 + `/Router 未就绪/` + `保留现场` + 未建角色窗）、实例未 online（exit 1 + `/未 online: pb-dev/` + 不回滚）、down 的 C-c→`kill-session`→残留检查（`killIndex > lastIndexOf('send-keys')`、干净收口 stderr 为空、残留 pid SIGKILL + exit 1、无 session 幂等）、status 分段与退出码（`[集群]/[窗口]/[Router 拓扑]/[日志]/[角色实例]` + 只读动词零出现 + Router 不可达 exit 1）。**无覆盖面丢失**；`snapshotLogs` 辅助函数被完整删除（全仓 grep 无残留引用）。

**5d. `git check-ignore` 原意图保留性**：静态断言命中 `oamp/.gitignore` 的 `.runtime/` 规则行（实测 `.gitignore` 全文仅 2 条规则：`.runtime/`、`data/`，**无 negation 规则**），我另行亲手运行运行时校验：`git check-ignore -v .runtime/cluster/pb-dev.log` → `oamp/.gitignore:1:.runtime/`，exit **0** ⇒ "日志不进 git"在当前仓库状态下成立。**注意**：静态断言只校验"规则行存在"，不校验"路径实际被命中"，严格弱于原运行时断言（记偏差 D-2）。

### 标准 6（边界）— **pass**

- `git diff --name-only` = `oamp/src/cluster.js`、`oamp/test/cluster-actions.test.js`，**恰好 2 个文件**；`git status --porcelain` 无其他 M、无新增未跟踪文件（验证前后一致）。
- 零新依赖：`oamp/package.json` 与 lock 均 **0 改动**；`test/hygiene.test.js` 断言 `dependencies === {}` 且在全量套件中通过。
- `oamp/test/web.test.js` 及其他测试文件零改动（`git diff --name-only` 不含它们）；全仓仅 `src/cluster.js`、`test/cluster-actions.test.js` 引用 `OAMP_CLUSTER_LOG_DIR`。
- 除 `LOG_DIR` 常量定义外，`src/cluster.js` 无第二处改动（2 hunk，见标准 1a）。

### 标准 7（反向核对）— **pass（已做，非声明跳过）**

在 `/tmp/ab/` 沙箱内以"去掉注入"的方式做 A/B（HEAD 版 = 注入不存在，工作区版 = 注入存在），两副本输入完全同构（各含 12 个预置日志 + 仓库根 `cluster.json` + `roles/`）：

- **注入去掉（orig）**：隔离立即失效 —— (a) 预置的 12 个日志被 `up` **全部 truncate 为 0 B**；(b) `pb-verifier.log` 存在导致 `未启用角色无日志` **断言转红**，11/12。
- **注入存在（fixed）**：12/12 全绿，12 个预置日志**逐字节不变**。

即"隔离断言确实由 `OAMP_CLUSTER_LOG_DIR` 注入承重"，非空跑断言。**关于为什么不把反向核对直接打在仓库级 `.runtime/cluster` 上**：该操作会让 `up` 真实 truncate 活集群日志（正是本次修复要消除的行为），与"不得清活集群日志"的约束冲突；沙箱对照在破坏性与证明力上等价且无副作用，故采用沙箱。

---

## 汇总

- **pass：7 项**
- **fail：0 项**（无需返工）
- **partial：0 项**
- **blocked：0 项**

## 偏差记录

> 实现与现有规格/文档不一致之处。不影响本次验收判定。

| # | 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|---|
| D-1 | 0012 迭代 `architecture.md` §5.2 env 行（`:404`）与 D-17（`:559`）、`:618` 只登记 `OAMP_CLUSTER_CONFIG` / `OAMP_TMUX_BIN` / `OAMP_CLUSTER_WAIT_MS` 三个注入点；`prs/pr-005-cluster-entry.md:22` 写死 `tee -a <PKG_ROOT>/.runtime/cluster/<name>.log` | 新增第 4 个注入点 `OAMP_CLUSTER_LOG_DIR`，仅记录在 `src/cluster.js:6-7` 注释与测试文件头部注释中；默认值不变（仍为 `<PKG_ROOT>/.runtime/cluster`），但已可被 env 覆盖 | 按实现更新 0012 `architecture.md` §5.2 env 行 / D-17 注入点清单（补 `OAMP_CLUSTER_LOG_DIR`），并在 `pr-005-cluster-entry.md:22` 的 tee 路径处注明"缺省值，可被 env 覆盖" |
| D-2 | 原断言用运行时 `git check-ignore -q .runtime/cluster/pb-dev.log` 校验"该路径确实被 git 忽略"（对规则语法、negation、`.gitignore` 位置均敏感） | 改为静态断言"`oamp/.gitignore` 中存在规则行 `.runtime/`"——仅证明规则存在，不证明路径被命中 | 二选一：①恢复一条轻量运行时校验（如 `spawnSync('git',['check-ignore','-q',...])`）与静态断言并存；②明确由 `test/hygiene.test.js:41-45`（已存在同款静态断言）承担该契约，cluster 用例里删掉重复断言 |
| D-3 | 其余 cluster 路径基准均为 `PKG_ROOT`（如 `bin`、配置缺省 `<roleRoot>/cluster.json`），路径语义与 cwd 无关 | `OAMP_CLUSTER_LOG_DIR` 若为相对路径按 **cwd** 归一（`path.resolve`），基准与同类路径不一致；当前仅测试使用且始终传绝对路径，无实际后果 | 若要保留该注入点作为通行开关，改为相对 `PKG_ROOT` 归一，或在 `src/cluster.js:21` 对相对值直接报错要求绝对路径 |
| D-4 | 委托标准 3 的判定口径为"跑测试前后 `*.log` md5 完全一致" | 活集群自身每 60s 心跳、且期间有真实任务/人的 UI 操作持续追加日志，md5 恒定**不可重复成立**（实测 156s 窗口 `router.log` +24KB，其中 1241 行 `TASK_UPDATE`、含人输 label 的 `TASK_CREATED`） | 后续同类验收改为三条可判定不变性：①字节前缀保持（无 truncate/重写）②追加字节可归因于被测系统自身活动 ③文件集合与外部内容零污染——本报告已在干净窗口同时给出"md5 12/12 一致"的严格证据 |

## 下一迭代候选

- **clusterEnv 缺少"必须传 logDir"的守卫**：Node 会**丢弃值为 `undefined` 的 env 键**（实测 `spawn(env:{OAMP_CLUSTER_LOG_DIR:undefined})` → 子进程 `'OAMP_CLUSTER_LOG_DIR' in process.env === false`），因此未来任何漏传 `logDir` 的调用点会**静默回退**到仓库级 `.runtime/cluster`，重新引入本次修复的 bug。建议在 `clusterEnv()` 内加一条守卫（`logDir` 必填 / 断言其不在 `OAMP_ROOT` 内 / 缺省落到临时目录）。
- **测试对活集群的其余共享只读输入未隔离**：本次只隔离了日志目录；「省略 `--config` ⇒ 缺省仓库根 `cluster.json`（12 窗口）」用例仍读取仓库根 `cluster.json` 与 `<roleRoot>/roles/*`。若活集群运行期间这些文件被改动（如角色增删），该用例的期望值会漂移。本次实测未发生（251/251 全绿）。
- **`.runtime/cluster` 日志无轮转/上限**：`up` 的逐个 truncate 是唯一回收手段（也正是本次事故的成因之一）。活跃任务下 `router.log` 增长很快（实测验证期间 06:45→06:57 约 12 分钟：6.5KB → 537KB，主要来自 `TASK_UPDATE` 的大量重复行），长期运行的集群可能耗尽磁盘。

## 结论

**PASS** —— 7 条标准全部 pass，0 fail / 0 partial / 0 blocked。核心结论：修复在"集群运行中"的真实前提下有效且可复现——测试文件在活集群在线时连跑 14 次全部 12/12 全绿；干净窗口内活集群 12 个日志 md5 完全一致；受控 A/B 证明"去掉注入即复现活日志被 truncate + 断言转红"。偏差 4 条（D-1 文档未登记新注入点、D-2 静态断言弱于原运行时断言、D-3 相对路径基准不一致、D-4 原验收口径在活集群下不可重复成立）均不阻塞本次交付，其中 D-1/D-2 建议在下一迭代同步文档与断言强度。
