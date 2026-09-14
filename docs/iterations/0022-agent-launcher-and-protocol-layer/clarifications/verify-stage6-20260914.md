# 阶段 6 独立验证报告（迭代终态收口）— 0022-agent-launcher-and-protocol-layer

**验证者身份（反射结果）**：委托标准横跨四类产出物 ⇒ 反射为**四重身份并行**：①「PR 粒度与依赖」= 计划/任务图审查者；②「并发调度真实执行证据」= 流程审计者；③「需求效果 E1~E7」= 测试工程师（真实进程端到端）；④「边界与保证项 N1~N12 / F10~F13」= 同级代码审查者。判定以**产出物本身 + 独立实跑**为准，不采信任何执行过程自述。

**产出物（被验证对象）**：
- 迭代分支 `iteration/0022-agent-launcher-and-protocol-layer`；实测 HEAD = **`7651040`**（`git rev-parse HEAD`，2026-09-14 18:10:50，为 `a975ce8` 之上的文档收敛提交「阶段 5 收敛落盘」，与派单所写「HEAD = merge `a975ce8`」差 1 个提交——见偏差表 D-1）
- 5 个 PR 合并提交：`2a2d979`(pr-001) / `f1097ae`(pr-004) / `4777bf0`(pr-002) / `b54f143`(pr-005) / `a975ce8`(pr-003)
- `docs/iterations/0022-agent-launcher-and-protocol-layer/**`（demand.md / prd.md + `prd/F01~F13` / architecture.md / `prs/*` / `clarifications/**` / status.md / history.md / progress.md）+ 代码 `oamp/**`
- 各 PR 验收报告：`clarifications/verify-pr-00{1..5}-20260914.md`；阶段 4 Gate 两轮：`verify-stage4-gate-20260914.md` / `verify-stage4-gate-r2-20260914.md`

**验证标准来源**：委托方逐项给出的标准 A1~A3 / B1~B3 / C1~C7 / D1~D2 / E1~E2（本轮唯一判定依据；未接收执行过程上下文）。
**验证日期**：2026-09-14
**写入声明**：本报告为本次验证的**唯一写入**；未修改任何被验证产物（写入前后 `git status --porcelain` 中除 sibling 进程正在改写的 `history.md` / `status.md` / `progress.md` 外无其它项，代码与 PR 文件均无改动；`history.md` / `progress.md` 在验证期间被 sibling 持续追加，本报告对这两个文件的行级引用均为「读取时刻」取值）；未执行任何 git 写操作（仅 `log` / `show` / `diff` / `cat-file` / `ls-tree` / `rev-parse` / `merge-base` / `worktree list` / `branch --list` / `status`）。

---

## 0. 本次实跑基线（判定所依据的观测面）

**0.1 环境**
- 迭代工作区：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer`
- 真实宿主二进制：`omp` = `/Users/chenchiyuan/.bun/bin/omp`（`omp/18.0.11`，符号链接指向 `@oh-my-pi/pi-coding-agent/dist/cli.js`），模型 `deepseek/deepseek-v4-flash`
- Node：`v22.15.0`

**0.2 实跑方式（零仓库写入）**
- 全部探针在 `os.tmpdir()` 下的**字节级副本**上运行：`/var/folders/ss/pyt_516n0tsgb3dcqvn5zw900000gn/T/stage6-verify.S1ID0y/oamp`（`cp -R` 自迭代工作区 `oamp/`）。副本与工作区逐文件 sha256 比对：`src/{launcher,config,protocol,rpc-client,oneshot-client,acp-client,context-pool,agent,web}.js` + `web/app.js` **全部 SAME**（10/10）⇒ 探针观测面 = 被验证代码本身。
- 探针脚本与全部夹具（fake 目录、临时库、SSE 客户端）均落该临时目录；库 = `mkdtemp` 下的 `sql.db`，socket = `mkdtemp` 下的 `router.sock`；**迭代工作区未被写入**（运行后 `git status --porcelain` 无新增项）。
- 探针脚本：`probe.mjs`（rpc 默认 + 门 + acp + oneshot + `!` shell）/ `probe2.mjs`（rpc 完整事件时序 + acp 门反面）/ `probe3.mjs`（acp 门正面裁决）/ `probe4.mjs`（解析链逐档 + CLI 非法取值）；报告：同目录 `probe-report.json` / `probe2-report.json` / `probe3-report.json` / `probe4-report.json`。
- 探针进程与夹具已全部停止/清理（`ps` 复查无本报告自起的 `oamp`/`omp` 进程残留）。

**0.3 报告自身检查**：① 每条判定均附可复查证据（文件:行 / 提交哈希 / 命令输出 / 探针 JSON 路径）；② 派单携带的提交标识与验收结论字样**仅用于定位产出物与确定 diff 基准**，未作为判定依据——所有结论来自产出物本身与本次实跑，未采信任何执行过程自述；③ 委托的 A1~A3 / B1~B3 / C1~C7 / D1~D2 / E1~E2 共 **17 条无漏项**，逐条给出 pass / partial / fail / blocked

---

## A. 标准 A · PR 粒度与依赖正确性终态

### A-1 5 个 PR 的 `depends_on` 每条在代码库/合并记录中有真实耦合证据；依赖图无环 —— **pass**

**逐边证据（子分支 vs 其自身基线，排除文档噪声后的真实改动面）**：

| PR | `depends_on` 声明 | 代码级耦合证据（一线） |
|---|---|---|
| pr-001 | （无） | `oamp/src/launcher.js` import 面 = 仅 `node:child_process`（`:7`）；`oamp/src/config.js` 第 4 键为叶子实现（PR 文件「零 `src/` 内 import」判据成立） |
| pr-002 | pr-001 | `oamp/test/acp-daemon.test.js:18`、`context-pool.test.js:18`、`project-workspace.test.js:20` 均 `import { PROFILES, buildArgv } from '../src/launcher.js'`（pr-001 新建文件）；4 个文件 8 处 agent 启动点注入 `OAMP_PROTOCOL: 'acp'`（`acp-daemon:253/508/522/705`、`call-protocol:301`、`context-pool:210/274`、`project-workspace:232`）= pr-001 的 `config.js` 第 4 键 |
| pr-005 | pr-001 | `src/rpc-client.js:9` / `src/oneshot-client.js:11` = `import { spawnAgent } from './launcher.js'`；解析链取值 `resident.configProtocol`（`src/protocol.js:59-63`）= pr-001 折叠值 |
| pr-003 | pr-005 | `src/acp-client.js:11`（`CAPABILITY_KEYS, ProtocolError, readApprovalToolName`）、`src/context-pool.js:8`（`ProtocolError`）、`src/agent.js:18`（`createProtocolLayer`）全部 `from './protocol.js'` ⇒ 三个消费面符号**逐处可指**，pr-005 未合并则 import 目标不存在 |
| pr-003 | pr-002 | pr-003 把常驻默认切成 rpc（`prs/pr-003-...md`「默认走 rpc」）；4 个 ACP-only 桩测试文件**只有**靠 pr-002 注入的 `OAMP_PROTOCOL='acp'` 才不会以 `--mode rpc` 启动、桩永不回包（实测注入点见上表 pr-002 行）⇒ 真实合并序耦合，非顺序偏好 |
| pr-003 | pr-001 | `src/acp-client.js:12` = `import { buildArgv } from './launcher.js'`；`src/agent.js:684` = `configProtocol: config.protocol`（第 4 键） |
| pr-004 | （无） | `oamp/web/app.js` **零 import**（`grep -nE "^import|require\(" web/app.js` 无命中）⇒ 不引用任何 PR 的新增符号；其输入契约 `src/web.js` 本迭代零改动（见 A-2 表） |

**无环判定**：存在边 = `pr-001 → {pr-002, pr-005}`、`{pr-002, pr-005} → pr-003`；`pr-004` 独立。反向边核查：`launcher.js` / `config.js` 不 import 任何 `src/` 内模块（launcher 仅 `node:child_process`，config 为叶子）⇒ 无 `pr-002/pr-005 → pr-001` 的代码回路。**模块级互有 import 的真实现象（已登记形态，非 PR 级环）**：`protocol.js → acp-client.js`（`:9` `import { AcpClient }`）与 `acp-client.js → protocol.js`（`:11`）互有；独立核查 `protocol.js` 对 acp 的引用**只有** `new AcpClient({...})` 与 `client.start()`（`:93-120`），**不含** pr-003 引入的任何符号（无 `capabilities` / `capabilityNotes` / `ProtocolError` 构造面引用）⇒ 不构成 `pr-005 → pr-003` 的反向边；`pr-003 → pr-005` 的边方向与实现一致。

### A-2 PR 间文件范围无重叠（含已合并后与实际 diff 的比对）—— **pass**（含 1 处**已授权**例外）

**各 PR 真实改动面（相对其自身分支基线，`git diff --stat <base> <branch-tip>`）**：

| PR | 基线 | 真实改动文件（代码面） | 文档面 |
|---|---|---|---|
| pr-001 | `e3f8a62` | `src/launcher.js`、`src/config.js`、`test/config-file.test.js` | `prs/pr-001-tasks.md` |
| pr-004 | `e3f8a62` | `web/app.js`（**仅此一个**；`web/style.css` 未被触碰） | 无 |
| pr-002 | `fa2acd6` | `test/{acp-daemon,call-protocol,context-pool,project-workspace}.test.js` | `prs/pr-002-tasks.md` |
| pr-005 | `fa2acd6` | `src/protocol.js`、`src/rpc-client.js`、`src/oneshot-client.js`、`src/launcher.js`(+24/−9)、`test/protocol-layer.test.js` | `prs/pr-005-tasks.md` |
| pr-003 | `b54f143` | `src/{acp-client,agent,context-pool}.js`、`test/{confirmation-roundtrip,tool-permission,web,zero-intrusion}.test.js`、`README.md`（**8 个**，与 pr-003 文件范围逐项一致） | `prs/pr-003-tasks.md` |

- **重叠面恰一处**：`src/launcher.js` ∈ pr-001 ∩ pr-005 = 派单点名的「pr-005 授权扩展」例外；授权一手记录 = `clarifications/2026-09-14-pr-planner-round4.md:28-36`（§1.1「授权范围扩展 · `oamp/src/launcher.js` 纳入 pr-005 文件范围（4 → 5）」）与 `prs/pr-005-...md:22`；且 pr-005 的加性修改落在 `buildArgv` 第 5 入参 `approval`（`src/launcher.js:109`、`:133-136` D-7′ 防护）—— `undefined` 路径逐字等价（既有调用方零行为变更，`PROFILES['omp:oneshot'].approval` 数据行未动）。
- **「pr-003 的 8 文件」**（第二处点名例外）经复核 = 上表 pr-003 行的 8 个代码/文档文件，与其文件范围声明（含 `README.md`）逐项一致，**无第三个例外**：pr-001/pr-002/pr-004 的真实改动面均互相不相交，且与 pr-003/pr-005 不相交。
- **合并后与实际 diff 的比对（防合并吞改动）**：`git diff --stat 4777bf0 b54f143 -- oamp/` = 仅 pr-005 的 5 个文件（pr-002 的 4 个测试固定**未被回退**）；`git diff --stat b41933c a975ce8 -- oamp/ docs/` = 仅 pr-003 的 8 个文件 + `prs/pr-003-tasks.md`（文档面无回退）。5 个 merge 提交均为**真双亲**（`git log -1 --format=%P` 各两条父提交）。
- **体例观察（非违规）**：PR 分支相对迭代分支的 diff 含文档行回退噪声（子分支基线落后于 docs 提交），合并结果不失文档（上一条已验证）。

### A-3 `prd/` 每个功能点 F01~F13 至少被一个 PR 引用，且每张卡的需求级验收均在终态代码上有实现锚点 —— **pass**

**覆盖（各 PR「涉及功能点」并集）**：pr-001{F01,F10,F12,F13} ∪ pr-002{F03,F06} ∪ pr-003{F01,F02,F03,F05,F06,F07,F08,F09,F10,F11,F12} ∪ pr-004{F08} ∪ pr-005{F01,F02,F04,F07,F09,F11,F12} = **F01~F13 全覆盖**（无缺口）。

**逐卡实现锚点（终态代码，一行一卡）**：

| 卡 | 需求级验收的终态锚点 |
|---|---|
| F01 | `src/launcher.js:12` `PROFILES`（omp:rpc / omp:acp / omp:oneshot + claude:acp / codex:acp 结构项）、`:109 buildArgv`、`:150 spawnAgent` = 同一入口；验收 3/4（新增宿主=加数据 / claude·codex 只留结构）实测：`buildArgv('claude:acp',{tools:{mode:'off'}})` ⇒ `['--acp','--no-skills','--no-rules','--no-tools','--no-session']`（**零源码改动**产出非 omp 宿主 argv） |
| F02 | `src/protocol.js:73 createProtocolLayer` + `:39 SELECTABLE_PROTOCOLS={rpc,acp}` + `:59 resolveProtocol`；实测默认 ⇒ `--mode rpc`、指定 acp ⇒ `acp`（§0 探针 1B/2A/3）、角色级压 env（探针 4）、`oneshot` 越界 ⇒ 退出码 2、`web.js` 零协议参数 |
| F03 | `test/zero-intrusion.test.js`（B-17 三条机械断言，**本次实跑 3/3 pass**）+ `grep -rn "acp-client\|rpc-client\|oneshot-client" src` 命中 ⊆ `{src/protocol.js}` |
| F04 | `src/rpc-client.js:21 DELTA_KINDS`、`:283 onMessageUpdate`（空 delta 跳过）、`:293`（仅 `isTerminal:true` 结算）、`:250-262`（受理回包只记受理）；实测时间线：thinking(idx2) / tool_call(86) / tool_output(134) 均早于 out(idx163) |
| F05 | 实测 rpc 门：7 字段信封、`options=[{Approve},{Deny}]`、`tool='bash'`（多行 title 提取）、在飞 1→裁决→0；实测 acp 门：7 字段信封、4 选项带 label（值域随协议声明）；`src/protocol.js:32 readApprovalToolName` 为 RPC/ACP 同源原语 |
| F06 | 实测 acp 真实回合：argv 首段 `acp`、事件仅 `task_update:chunk`（无 thinking）、in/out 各一条、`model` 落库；`src/acp-client.js` 能力位 `thinking:'no'`（`:28-42`）；对 main 的定向 diff 显示门名解析原语仅**移位**（`-function readApprovalToolName(message)` → `+import ... from './protocol.js'`），提取语义未改 |
| F07 | 实测 oneshot：argv `-p`（末位位置参数、无 `--no-skills/--no-rules`、`--approval-mode yolo`）；两轮两进程（pid 44048 / 44262）、第二轮答「不知道」= 无上下文续接；`src/oneshot-client.js:19-26` 能力位 `streaming:'degraded'` + 其余 `no` |
| F08 | `web/app.js:578-581`（thinking / tool_call+tool_output 分流）+ `:427 renderStreamPart` + `:629 appendProcess`（落在既有气泡内，`index.html` 零改动）；实测 rpc 回合结束后库内**恰 1 in + 1 out** |
| F09 | `src/protocol.js:23 CAPABILITY_KEYS`（六键）+ 三实现的取值/notes 表：`rpc-client.js:31-42`、`acp-client.js:28-42`、`oneshot-client.js:19-33`（非 yes 键恒有非空 note） |
| F10 | `git diff --stat main...HEAD -- oamp/src/web.js` **为空**（监听/鉴权零改动）+ `oamp/API.md`/`oamp/llms.txt` 零改动（无新 HTTP 接口） |
| F11 | `git diff --stat main...HEAD -- omp/` **为空**（omp 侧源码与协议零改动） |
| F12 | `oamp/package.json` `dependencies: {}` + 新模块 import 白名单（仅 `node:*` 与同目录实现模块）+ `test/hygiene.test.js` 本次实跑 3/3 pass |
| F13 | `src/launcher.js` 无 `cluster/instances/roles` 读取（grep 零命中）；`src/cluster-config.js`、`src/registry.js`、`src/router.js` 均不在改动面；`docs/multi-omp-agent-protocol.md` 零改动 |

---

## B. 标准 B · 并发调度真实执行证据

### B-1 worktree 时间窗口重叠 —— **pass**（证据等级：独立观测者快照 + 派发/合并时刻）

- **一手（已入 git）**：`git show 0b78fee:docs/.../progress.md`（progress-observer 第 2 次快照，文头「观测时间: 2026-09-14 16:08:51」）§0 记录 `git worktree list --porcelain` / `git for-each-ref` **同时**含 `feat/0022-pr-002-test-face-profile-pinning → fa2acd6` 与 `feat/0022-pr-005-protocol-layer-and-injection-entry → fa2acd6` 两个 PR worktree（均嵌于迭代工作区 `.pb-agents/worktrees/` 下）；该快照由**独立核查角色**产出，非执行者自述。
- **时间窗口闭合**：两 PR 同批派发 `16:05:30`（history.md）、两个 merge 同刻 `16:53:15`（`4777bf0` pr-002 → `b54f143` pr-005，`git log -1 --format=%ci`）⇒ 两 worktree 在磁盘上**并行存在约 48 分钟**，且 16:08:51 的独立快照落在该窗口内，记录到两者均在场（当时相对基线各 0 提交 ⇒ 属真实并行进行中）。
- **首波旁证**：history.md 记录 `15:37:40` 同时派发 pr-001 / pr-004 两个 planner 并各建 worktree、两者 `16:03:39` 同刻合并（`2a2d979` / `f1097ae`）；首波 worktree 已被清理，其共存仅由 history.md（自述信道）支撑 ⇒ 作为旁证，不作为主判据。
- **后验状态**：`git worktree list` 现仅 `main` + 迭代工作区两条（PR worktree 与 `feat/*` 分支已全部清理，与 status.md「（已清理）」一致）。

### B-2 `status.md` 的 `## 并发配置（阶段 5）` 五字段均初始化且随后续 PR 合并被真实更新 —— **pass**

`git show <commit>:.../status.md` 的逐版本取值（一手）：

| 提交（时间） | 起始并发数 | 硬上限 | 当前有效上限 | 累计槛位释放次数 | 已派发总数 |
|---|---|---|---|---|---|
| `ea63557`（15:14:23，初始化） | 3 | 5 | **3** | **0** | **0** |
| `e3f8a62`（15:36:05） | 3 | 5 | 3 | 0 | 0 |
| `0b78fee`（16:09:35，首波 2 合并后） | 3 | 5 | **5** | **2** | 9 |
| `b41933c`（17:04:32，次波 2 合并后） | 3 | 5 | 5 | **4** | — |
| `7651040`（18:10:50，末波合并后） | 3 | 5 | **5** | **5** | **20** |

⇒ 五字段在同一次提交内**均初始化**（非逐次补字段），且其后**三次**真实更新（释放 0→2→4→5）。**非「初始化后再未变化」**。

### B-3 爬升公式真实触发 —— **pass**

- 规范真源：`roles/workflow-pb/workflow-pb.md:465`（爬升公式 `当前有效上限 = min(起始并发数 + 累计槛位释放次数 × 起始并发数, 硬上限)`；硬上限 `2×起始-1`）。
- 终态值 `min(3 + 5×3, 5) = 5`；各版本注释逐次换算式：`0b78fee` = `min(3 + 2×3, 5)`、`b41933c` = `min(3 + 4×3, 5)`、`7651040` = `min(3 + 5×3, 5)`；由 `3`（释放 0）→ `5`（释放 2 起）= **按公式重新计算**，非静态值。
- 事实性注记（非偏差）：起始 3 时 `min(3+1×3, 5)` 已触硬上限 ⇒ 该公式在本迭代**从第 1 次释放起即饱和于 5**；「从 3 升至 5」成立且此后维持硬上限，与规范「达到硬上限后维持不变」一致。

---

## C. 标准 C · 需求效果 E1~E7 的终态证据

### C-1 E1（默认走 rpc）：实跑观察被启动进程 argv —— **pass**
真实 omp 被启动子进程 argv（两次独立实跑，`ps -Ao pid,ppid,command` 于任务在飞期间采样，非 fake 桩）：
```
bun /Users/chenchiyuan/.bun/bin/omp --mode rpc --no-skills --no-rules --no-session --model deepseek/deepseek-v4-flash --approval-mode always-ask
```
（探针 1 phase A 与探针 2 A 各一次，默认档 = 未做任何协议指定。）argv 首两段 = `--mode rpc` ⇒ **默认走 rpc 成立**。

### C-2 E2（切协议只改一处注入配置 + 消费层 diff 为零 + 指定即生效）—— **pass**
- **一处注入配置**：实测两种切换面各起一轮真实回合——① `env OAMP_PROTOCOL='acp'`（探针 1B/2B/3）⇒ 子进程 argv 首段 = `acp`；② 角色级 `agent start ... --protocol acp`（探针 4，同时把 env 设为 `rpc` 作反证）⇒ argv 首段仍 = `acp`（角色级压过 env，**未回落**）；越界值 `--protocol oneshot` ⇒ 退出码 2（`oamp: agent start: --protocol 取值非法: "oneshot"`），未知参数亦退 2。
- **消费层 diff 为零**：`git diff --stat main...HEAD -- oamp/src/web.js omp/` 为空（web.js 零改动）；三次切换运行前后对 `src/{context-pool,agent,web}.js` 取 sha256 无变化，运行结束工作区 `git status` 无代码改动 ⇒ 「切换协议 = 改注入配置、消费层源码不变」成立。可执行证据：`test/zero-intrusion.test.js`（B-17①②③）**本次实跑 3/3 pass**，其中 ③ 以「两种注入配置各起一次真实 agent + 逐字节比对」断言。
- **指定即生效（不回落到内置默认）**：`acp` 指定后真实启动的就是 `omp acp`（无 `--mode rpc`）；默认档启动的就是 `--mode rpc`（无 `acp`）——两向均有 argv 观测面。

### C-3 E3（**默认 rpc 链路**轮次结束前可见思考/工具增量 + 同一轮结束后库内仍只有 in/out 两条）—— **pass**
真实 rpc 回合的完整 SSE 时序（探针 2 A；`eventOrder` 为**数组下标**，均为轮次结束前的增量）：

| 下标 | 事件 | 相对发送时刻 | 采样文本（首片） |
|---|---|---|---|
| 0 / 1 | `message(in)` / `chat_state(working)` | 3 ms / 3 ms | — |
| **2** | `task_update:thinking` | **1534 ms** | `The` |
| **86** | `task_update:tool_call` | — | 工具参数边生成边流出 |
| **134** | `task_update:tool_output` | — | 工具执行中的输出 |
| 137 | `task_update:chunk` | — | 答案文本 |
| **163** | `message(out)`（终态） | **3101 ms** | `输出为 \`stage6b-ok\`…` |

计数：thinking 84 / tool_call 48 / tool_output 3 / chunk 26 / message 2 / chat_state 2（共 165 帧）⇒ **三类增量在 out 之前到达管道**（首次思考增量在 1.5 s，终态在 3.1 s）。
**不入库**：同轮结束后直连库文件查询：`messages` 恰 2 条（1 `in` + 1 `out`），`chats.state='completed'`；`src/rpc-client.js` / `src/oneshot-client.js` 内零 `persist` 引用（grep 无命中）。**acp 不在本项范围**（该链路实测无 thinking 增量，见 C-5）。

### C-4 E4（一次受门禁调用恰一条确认项：不重不欠，裁决后条目消失）—— **pass**
真实 rpc 回合（探针 2 A）：
- 在途条目轮询序列 `[0,…,0,1,0,…]`，`maxInFlight = 1`；全轮**只出现 1 个** `confirmation_id` ⇒ **恰一条**（不重不欠）。
- 条目 7 字段齐备且恰为 7 键：`confirmation_id / chat_id / agent_id / tool / title / options / created_at`；`tool = "bash"`（由多行 `title = "Allow tool: bash\nCommand: echo stage6b-ok && pwd"` 用既有原语提取）；`options = [{option_id:'Approve'},{option_id:'Deny'}]`（恒二元）。
- 裁决 `POST /api/confirmations/<id>/decision {option_id:'Approve'}` ⇒ `{accepted:true}`；随后在途表 = **0**（条目消失）；该轮继续并落 `out`（答案含工具输出）⇒ 轮次推进。
- 反面核查（探针 2 B，同一实现）：以**不在本次门选项内**的 id 裁决 ⇒ 该裁决被**静默丢弃**（条目保留、轮次保持 `working`、无 out 记录）⇒ 不存在「错 id 被当作放行」的静默放行路径。

### C-5 E5（acp 兜底链路与 0021 行为一致；oneshot 无会话语义；`!` shell 行为不变）—— **pass**
- **acp 兜底（真实 omp acp）**：argv = `omp acp --no-skills --no-rules --no-tools --no-session --model deepseek/deepseek-v4-flash`；回合正常终结，落 `in`/`out` 两条（out 文本正确、`model` 落库）；SSE 仅 `task_update:chunk`（**无思考/工具增量**，与能力位 `thinking:'no'` 一致，N12/A4 允许）；`/api/events` 全局链路实测序列 `chat_state(working) → confirmation(7 字段) → chat_state(completed)`。
- **acp 门**：实测 7 字段信封（`tool=null`、`title='echo stage6c-acp-ok'`、`options=[allow_once/Allow once, allow_always/Always allow, reject_once/Reject, reject_always/Always reject]`）⇒ 按正确 `option_id='allow_once'` 裁决 ⇒ `accepted:true`、在途 1→0、轮次推进并落 out（探针 3）⇒ 字段集合与语义等价、**值域随协议声明**（acp 4 项 / rpc 恒二元）。
- **0021 不退化（定向代码面核查）**：`git diff main...HEAD -- oamp/src/acp-client.js` 中与门/工具名相关的改动仅**原语移位**（`-function readApprovalToolName(message)` → `+import ... from './protocol.js'`）；`src/` 内 `AcpError` 残留 0（唯一命中在 `protocol.js` 注释「码值沿用既有 AcpError.code 五值」），`onChunk` 残留 0（全部改 `onDelta`）；`runShellTask` 零 diff；三事件通知的实现位于前端派生 `web/notify.js:12 EVENT_TYPES = ['chat_completed','chat_failed','confirmation_required']`（`test/inbox-console.test.js:170` 逐字断言）——**本报告未起浏览器，未实测通知投递**，该条按代码/测试面证据判定。
- **oneshot 无会话语义（真实 omp -p）**：argv = `omp -p --no-session --model … --approval-mode yolo` + 末位位置参数（项目块 + 原文），**无** `--no-skills/--no-rules`；连续两轮 = 两次独立进程（pid 44048 / 44262），第二轮问「上一轮记住的数字」答 **「不知道」**、无 `contextId` 续接；库内 4 条（2 in + 2 out，`model=null` 沿用既有一次性口径）。
- **`!` shell 不变**：`!echo stage6-shell-ok` ⇒ `out.text = 'stage6-shell-ok'`，且该回合前后 agent 子进程数 4→4（**未 spawn omp**）⇒ shell 不进入协议层、行为不变。

### C-6 E6（验收证据 = rpc 真实 omp 链路端到端一条 + acp 回归一条）—— **partial**
- **需求效果本身（本轮实跑已成立）**：rpc 真实 omp 端到端一条（思考/工具增量可见 + 受门禁调用一次上浮与裁决 + 不入库核查，见 C-3/C-4）+ acp 真实回归一条（C-5）——**全部证据来自真实进程，非 fake 桩**。
- **但交付物自身的验收证据载体不合规**：全部 `clarifications/verify-pr-00{1..5}-20260914.md` 的协议行为证据**均来自 fake bin**；`clarifications/verify-pr-003-20260914.md:147`（其「下一迭代候选」第 4 条）自陈：「本迭代（含本 PR）的协议行为证据全部来自 fake bin；建议阶段 6 以真实 `omp` 跑一轮 rpc 常驻 … 与一轮 acp 常驻」。终态产物（status.md / history.md / 各 PR 验收报告）中**没有任何一条真实 omp 链路证据**的落点。
- 判定：条目级混合 ⇒ **partial**——需求效果成立（本轮补足并已记录于本报告 §0/C-3~C-5），但「验收证据」这一要求在其应有的载体（阶段 5 验收记录 / status.md）上缺失，构成本报告的偏差 D-2。

### C-7 E7（新增宿主只需新增 profile，L2/L3 零改动）—— **pass**（架构/代码面判定）
- 数据面：`src/launcher.js:12 PROFILES` 为**进程内字面量表**，字段集 = 十三项；唯一 argv 差异段 `modeArgs`（`:16/:31/:46`），其余 flag 段由同一段代码（`:109-138`）从字段推导。
- 实测（副本内、零源码改动）：`buildArgv('claude:acp', {tools:{mode:'off'}})` ⇒ `['--acp','--no-skills','--no-rules','--no-tools','--no-session']`——**非 omp 宿主经同一入口产出 argv**，L2（`protocol.js`）只按协议名（`rpc`/`acp`）选实现、L3（`agent.js`）只消费注入工厂，均不含宿主知识 ⇒ 新增宿主 = 加一份 profile 数据，L2/L3 零改动。

---

## D. 标准 D · 边界与保证项

### D-1 N1~N12 与 F10~F13 保证项在终态代码上有可核实的证据 —— **pass**

| 保证项 | 终态证据（可定位） |
|---|---|
| **N1** claude/codex 仅留 profile 结构与能力位 | `src/launcher.js:57-90` 两行结构项；选择域 `{rpc,acp}`（`protocol.js:39`）不含 `claude:` 键；无任何 `claude`/`codex` 的可执行链路 |
| **N2** 不改 omp | `git diff --stat main...HEAD -- omp/` 为空 |
| **N3** 无动态切换 / 无 per-chat·per-request / 控制台不可切 | `src/web.js` 零协议引用（`grep -n "protocol" src/web.js` 仅内部 `protocol:'oamp/1'`）；`/api/messages` 参数面（`src/web.js:773-778`）无 protocol 字段；`zero-intrusion.test.js` B-17② 断言消费层零协议字面（实跑 pass） |
| **N4** 过程增量不落库、不改记录条数 | `src/rpc-client.js`/`src/oneshot-client.js` 零 `persist` 引用；实测 rpc 回合后库内恰 2 条 |
| **N5** 无开关 / 过滤 / 分级、无新 UI 载体 | `oamp/web/index.html` 零改动；过程分区落在既有气泡（`web/app.js:419-431`） |
| **N6** `steer` 仅能力位 | `rpc-client.js:31-42` `queueControl:'yes'`；控制台/接口面零插话功能（无新增路由） |
| **N7** shell 不进协议层 | L2 四模块 `grep "shell\|/bin/sh"` 零命中；`runShellTask` 零 diff；实测 shell 回合未 spawn omp |
| **N8** 服务边界不变 | `src/web.js` 零 diff（监听地址/鉴权零改动）；`API.md`/`llms.txt` 零 diff |
| **N9** 无在飞上下文迁移 | 协议一次落定（`protocol.js:74` 注释「切换协议 = 新会话」）；既有「上下文已重置」文案在 `web/app.js:608` 保留 |
| **N10** 零第三方依赖 | `oamp/package.json` `dependencies:{}`；新模块 import 面 ⊆ `node:*` ∪ 同目录；`hygiene.test.js` 实跑 3/3 pass |
| **N11** 未实现 OAMP Router / 不与 `instances[]` 合并 | `src/launcher.js` 零 `cluster/instances/roles` 命中；`cluster-config.js`/`registry.js` 不在改动面；`docs/multi-omp-agent-protocol.md` 零 diff |
| **N12** 不为 acp 补思考/工具增量 | `src/acp-client.js:28-42` `thinking:'no'` + 实测 acp 回合零 thinking 帧 |
| **F10** 服务边界不变 | 同 N8（`web.js` / `API.md` / `llms.txt` 零 diff） |
| **F11** 上游协议不变 | `omp/` 零 diff；本迭代改动面 20 个文件全部在 `oamp/` + 迭代文档目录内 |
| **F12** 零依赖 | 同 N10 |
| **F13** 未实现 Router | 同 N11 |

### D-2 `oamp/test/zero-intrusion.test.js`（B-17）确实存在且断言非空 —— **pass**
文件存在（72 行）；3 个用例，每个含真实断言且第 ③ 条为「两种注入配置各起一次真实 agent + 逐字节比对」的行为断言；本次实跑 `node --test test/zero-intrusion.test.js` ⇒ **tests 3 / pass 3 / fail 0**（副本 = 字节级同源）。断言内容直接对应 §3.3 三条机械判据（不 import/不构造具体实现、无协议字面、切换零 diff）。

---

## E. 标准 E · 搭置与偏差台账

### E-1 `deferred-demand-changes.md` 是否存在 —— **不存在**
核查：迭代工作区内 `ls docs/iterations/0022-agent-launcher-and-protocol-layer/deferred-demand-changes.md` ⇒ No such file；`find . -name "deferred*"`（迭代工作区，排除 node_modules）**零命中**；`find /Users/chenchiyuan/projects/agents -maxdepth 3 -name "deferred*"` **零命中**。
⇒ 本迭代**不存在**搭置台账文件；**无可摘录原文**。需求变更在本迭代的承载物 = `demand.md`（v1.0.0，两批裁决 `user_confirmed`）与 `clarifications/*-verdicts.md`（阶段裁决件），属正常裁决链而非搭置。

### E-2 `status.md`「已知偏差登记」逐条核实（不得照抄）—— **pass**（逐条独立核实，2 条状态需修正）

| # | status.md 登记状态 | 本次独立核实 | 判定 |
|---|---|---|---|
| **D-7** | 开放（architecture 本体未回填） | `architecture.md:704` 标题仍为「既有测试面 · 最小更新（**6 文件**）」，表体 5 行覆盖 6 个路径（B-15 一行含两文件）；按 `FAKE_ACP_SOURCE` / `msg.method` 桩分布实测**既有** ACP-only 桩文件 = **7**（`acp-daemon` / `call-protocol` / `confirmation-roundtrip` / `context-pool` / `project-workspace` / `tool-permission` / `web`）；另有本迭代新增的 `protocol-layer.test.js` 亦含 ACP 形态桩（`:64-65`），不属「既有测试面」口径 | **仍开放**（文档计数与实测不一致，无行为影响） |
| **D-7′** | **已闭合** | `src/launcher.js:133-136` 存在 D-7′ 守卫（`prompt !== undefined && !== null && !== ''`）；断言在场：`test/protocol-layer.test.js:507-511`（「argv 内不得出现 undefined / "undefined"」）与 `:591-601`（非字符串提示词不得 spawn） | **已闭合**（属实） |
| **D-2′/D-3′** | **已闭合** | `src/protocol.js:9-11` import 面 = 三个实现模块（无第三方、无 `node:` 亦无越界）；acp 装配面 10 键（`bin/model/cwd/tools/roleFile/permission/auditContext/logger/onExit/onPermissionRequest`，`:93-120`） | **已闭合**（属实） |
| **D-w2-1** | 开放（architecture 字面待同步） | architecture 两处字面确实并存：§3.4（`:362`）与 §5.6（`:587`）写 `[{option_id:…}]`，§5.1/§5.6 钩子面（`:496-497`、`:561`）写 `optionId`；**代码两面各自自洽**：钩子入参面 = `optionId`（`src/agent.js:263`、`src/rpc-client.js:89`、`src/acp-client.js:521`），信封/HTTP 面 = `option_id`（`src/agent.js:265`、`:302`）⇒ **无行为冲突**，登记项性质 = 文档未点明「两面字段名不同」 | **仍开放**（性质降级为文档措辞项） |
| **D-w2-2** | 开放（阶段 6 核查授权例外是否只此一处） | 独立复核 A-2 表：5 个 PR 的真实改动面中，唯一跨界重叠 = `src/launcher.js`（pr-001 ∩ pr-005），授权记录 = `clarifications/2026-09-14-pr-planner-round4.md:28-36`；**不存在第二处跨界改动**（pr-003 的 8 文件、pr-002 的 4 测试文件、pr-004 的 1 文件均在各自声明范围内） | **可闭合**（授权例外确为唯一一处；建议 status.md 改为已闭合并注明依据） |
| **D-w2-3** | 开放（既有 flake） | **本次实测复现**：`node --test test/status.test.js` 连跑 8 次 ⇒ **2 次失败**（runs 2/4），失败用例 = `F05-4：只读无副作用——连续两次 status 仅 last_heartbeat 自然推进、注册表不变`，断言 = `status.test.js:157` `assert.ok(Date.parse(r2[3]) > Date.parse(r1[3]))`（ErrorAssertion: 'last_heartbeat 第二轮应严格推进'）；该文件**不在**本迭代改动面（`git diff main...HEAD` 无 `status.test.js`）⇒ 既有 flake，终态仍存活，失败率 ≈ 25% | **仍开放**（且比登记的「偶发」更明确：可复现、有定位、约 1/4 概率） |

---

## 偏差记录

| # | 规格描述 | 实现实际 | 建议处理 |
|---|---|---|---|
| **D-1** | 派单书写「迭代终态 HEAD = merge 提交 `a975ce8`」 | 实测 HEAD = `7651040`（`a975ce8` 之上 1 个文档收敛提交，18:10:50「阶段 5 收敛落盘」，内容 = `status.md`/`history.md` 回填 + `verify-pr-003` 报告入库），代码面与 `a975ce8` 逐字节一致（`git diff --stat a975ce8 7651040` 仅 3 个 docs 文件） | 无需处置（派单信息滞后于文档收敛提交）；后续派单以 `git rev-parse HEAD` 现值为准 |
| **D-2**（对应 C-6 partial） | E6：验收证据 = **rpc 真实 omp 链路端到端一条 + acp 回归一条** | 交付物内（status.md / history.md / 5 份 PR 验收报告）**零真实 omp 证据**，协议行为证据全部来自 fake bin（`verify-pr-003-20260914.md:147` 已自陈）；本报告以真机探针补足（§0 / C-3 / C-4 / C-5） | 建议主 agent 把本报告 §0 的探针与证据索引回填 `status.md`（阶段 6 行 + 偏差登记），使 E6 的证据落点与需求要求一致 |
| **D-3**（= 台账 D-7） | architecture §9.4.1「既有测试面 · 最小更新（6 文件）」 | 实测既有 ACP-only 桩测试文件 = 7（含 `call-protocol.test.js`）；表体 5 行覆盖 6 路径 | 回填 architecture §9.4.1 标题与清单为 7（或点明「6 路径 / 7 文件」），并注明 `call-protocol.test.js` 归测试面 |
| **D-4**（= 台账 D-w2-3） | status.md 声称「合并后全量 **361/361 绿**」 | `status.test.js` F05-4（`:157` 严格递增断言）在终态**连跑 8 次失败 2 次**（约 25%），文件本身不在改动面 ⇒ 既有 flake | 沿用既有口径：本迭代不动该文件；下一迭代把该断言改为「≥」或加轮询（见下一迭代候选 1）；status.md 的「361/361」建议注明「单次运行结果，含 1 处既有 flake 用例」 |
| **D-5**（= 台账 D-w2-1） | architecture §3.4/§5.6 写 `option_id`、§5.1 写 `optionId` | 代码两面各自自洽（钩子面 `optionId` / 信封面 `option_id`），无行为冲突；仅文档未点明两面差异 | architecture 侧加一句「钩子入参面 = `optionId`，7 字段信封与 HTTP 面 = `option_id`」即闭合（**无需改代码**） |
| **D-6**（= 台账 D-w2-2） | pr-005 文件范围 4 → 5（授权纳入 `launcher.js`） | 授权记录完备（round4 §1.1），且**跨界例外仅此一处**（A-2 表逐 PR 复核） | status.md 该条转「已闭合」并注明「依据 = round4 §1.1 + 阶段 6 全 PR 改动面复核」 |
| **D-7** | `status.md`「已派发总数 = 20」 | history.md 中`15:37:40 → 18:08:00` 的派发记录实测 **18** 条（含 1 条 progress-observer 与 1 条阶段 6 verifier 派发）；20 = 该 18 + 2 条**阶段 4** 的 pr-planner 修正轮（`15:19:57` / `15:33:00`），同时又**未**计入阶段 1~3 的 demand / prd / architect 5 条 ⇒ 计数器口径混用「阶段 5 起」与「部分更早轮次」，既非「阶段 5 派发」也非「本迭代全部派发」 | 台账口径注解即可（不影响 B-2/B-3 判定：五字段初始化与更新均属实） |
| **D-8** | 需求侧 M4/E5「确认收件箱 7 字段语义」（跨协议字段集合与语义等价） | acp 真实门的上浮条目 `tool = null`、`title = 'echo stage6c-acp-ok'`（真实 omp 的 ACP 权限请求不带 `Allow tool: ` 前缀）；`options` 为 4 项带 label。字段集合与键数等价、值域随协议声明（不违规），但 acp 侧确认项**主标签（工具名）缺失**；该形态与 main 一致（原语仅移位、`runShellTask`/上浮函数零 diff）⇒ **非本迭代引入** | 记为下一迭代候选 2（核实 0021 同形后决定是否对 acp 面补工具名提取或界面回退到 `title`） |
| **D-9** | 门未裁决期间的行为（L2-9：门冻结不计入轮次超时） | 实测（探针 2 B，错 id 裁决）：条目长期在途、轮次保持 `working` **无上限**、`/api/stream` 不再产出增量 | 属设计（「无人裁决 ⇒ 轮次保持等待」已在 pr-003 报告 R1 登记）；建议下一迭代候选 3（确认项超时/失效提示），非本迭代缺陷 |

---

## 下一迭代候选

1. **消除 `status.test.js:157` 既有 flake**（终态可复现，~25% 失败率）：把 `last_heartbeat` 严格递进断言改为「≥ 且相邻两次采样至少推进一次」或先轮询到心跳落地再比；附带把「合并后全量绿」的表述改为「单次运行 + 已知 flake 清单」。
2. **acp 确认项的工具名**：核实 0021 同形后，考虑在 acp 权限门的钩子入参上补 `toolName`（真实 omp 只给命令原文），或让确认栏在 `tool === null` 时以 `title` 作为主标签。
3. **在途确认项的超时/失效提示**：门可无限期挂起（本报告实测 ≥240 s 无任何界面变化）；建议下一迭代给「挂起中」一个可视状态或失效回流，避免用户侧无感卡死。
4. **把真实 omp 探针固化为可重放资产**：本报告的 4 个探针脚本（`os.tmpdir()` 副本模式）可直接沉淀为「阶段 6 真机回归清单」，避免每次靠 fake 桩推断真实链路等价性（即 E6 的长期载体）。
5. **architecture 文档滞后项一次性回填**：§9.4.1 计数（D-3）、`option_id`/`optionId` 两面说明（D-5）——两处均为纯文档动作，建议合并在下一迭代开头的文档同步里完成。

---

## 汇总

| 标准 | 条目 | 判定 |
|---|---|---|
| A1 / A2 / A3 | 3 | pass ×3 |
| B1 / B2 / B3 | 3 | pass ×3 |
| C1 / C2 / C3 / C4 / C5 / C6 / C7 | 7 | pass ×6 + **partial ×1**（C6） |
| D1 / D2 | 2 | pass ×2 |
| E1 / E2 | 2 | pass ×2（E1 = 「不存在」明确成立；E2 = 6 条逐条独立核实，2 条状态修正建议） |
| **合计** | **17** | **pass 16 / partial 1 / fail 0 / blocked 0** |

- **fail 条数：0**
- **partial 条数：1**（C6 · E6 的「验收证据」载体缺失；需求效果本身已由本报告真机实跑补足）
- **偏差记录条数：9**（其中 3 条为台账既有项的状态复核/口径修正：D-3 / D-4 / D-5；1 条派单信息滞后：D-1；其余 5 条为本次新发现的登记项）
- **台账 6 条偏差复核结论**：已闭合 2（D-7′、D-2′/D-3′）；仍开放 4（D-7 文档计数、D-w2-1 文档措辞、D-w2-2 **可闭合**、D-w2-3 flake 已确证）

---

## 结论

**PASS**

- 5/5 PR 的依赖边在终态代码上逐条有真实耦合证据、依赖图无环（A1）；真实改动面除**已授权的一处** `launcher.js` 跨界外零重叠，且 5 次合并无回退（A2）；F01~F13 全被引用且逐卡有实现锚点（A3）。
- 并发调度三项强制证据**全部为真**：worktree 并存有独立观测者快照（已入 git）背书（B1）；并发配置五字段初始化后被真实更新 3 次（B2）；爬升公式按 `min(3+N×3, 5)` 逐次重算并由 3 升至硬上限 5（B3）。
- 需求效果 E1~E7 在**真实 omp 进程**上端到端成立：默认 `--mode rpc`（E1）；一处注入配置切换、消费层零 diff、指定即生效且角色级压过 env、越界值退 2（E2）；默认 rpc 链路三类增量在终态前到达管道 + 轮后恰 in/out 两条（E3）；一次门恰一条 7 字段信封、裁决后消失、轮次推进（E4）；acp 兜底与 oneshot/`!` shell 行为一致（E5）；E7 由「新增 profile 数据即产出非 omp 宿主 argv」实测成立。唯一 partial 是 E6 的**证据载体**（交付物内零真实 omp 证据），其需求效果已由本报告补足并记录。
- 保证项 N1~N12 与 F10~F13 在终态代码上全部可核实（D1），B-17 零侵入断言文件存在、断言非空且实跑 3/3 绿（D2）。
- 搭置文件 `deferred-demand-changes.md` **不存在**（E1，明确记录）；台账 6 条偏差逐条独立核实完毕（E2）。
- 剩余风险集中在**不影响本迭代验收**的两类：文档滞后（architecture 计数、`optionId` 两面说明）与一处既有 flake（`status.test.js:157`，可复现 ~25%）——均已在偏差记录与下一迭代候选中给出可执行处置。
