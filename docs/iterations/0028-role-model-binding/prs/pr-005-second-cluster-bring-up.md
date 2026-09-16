# pr-005：第二集群全角色启动就绪（F04）

## 上下文摘要

在迭代工作区起一个与主集群互不打扰的第二集群：把工作区根 `cluster.json`（迭代分支版本，含 pr-002 的两处 `model`）逐字复制为工作区根 `cluster.second.json`，**只改两键**（`session` → `oamp-cluster-0028`、`web.port` → `7789`，`router.socket` 保持 `null`），经 `hub cli cluster up --config` 用既有启动路径拉起 10 个角色。socket / 集群日志 / 对话库三项隔离由既有包根推导免费获得。迭代期内对主集群零启停、零配置改动。

## 涉及功能点

- F04

## 文件范围

- `<工作区>/cluster.second.json`（新建：运行态配置副本，未纳入版本控制；其存在与性质在证据小节显式登记）
- `docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up.md`（本 PR 文件：启动记录写入「验收证据」小节）

排除（本 PR 不触碰）：`cluster.json`（pr-002）、`docs/iterations/0028-role-model-binding/deferred-demand-changes.md`（pr-007）、`status.md`（主 agent 滚动维护）。

## 验收标准

- [ ] `<工作区>/cluster.second.json` 存在，且 `diff <工作区>/cluster.json <工作区>/cluster.second.json` 输出**恰 2 行**差异（`session` 一行、`web.port` 一行），其余逐字一致；`router.socket` 保持 `null`（F04 验收 2）
- [ ] 副本的 `roles.dev.model` / `roles.verifier.model` 与 pr-002 写入 `<工作区>/cluster.json` 的取值逐字一致；启动过程不因这两个取值报错（启动输出与 `<工作区>/oamp/.runtime/cluster/*.log` 中不出现 `配置错误`）（F04 验收 4）
- [ ] `tmux ls` 同时存在 `oamp-cluster`（主集群）与 `oamp-cluster-0028`（第二集群），两个 session 并存（F04 验收 2 ①）
- [ ] `lsof -nP -iTCP:7789 -sTCP:LISTEN` 有监听（web 窗口按 `config.web.port` 起，F04 验收 2 ②）
- [ ] 第二集群的 socket 与集群日志落在 `<工作区>/oamp/.runtime/` 下（`router.sock`、`cluster/*.log`），与主集群不在同一包根（F04 验收 2 ③）
- [ ] `node <工作区>/oamp/bin/hub.js api agents --port 7789` 返回的 10 个 `pb-<role>` 实例（`architect` / `demand` / `dev` / `planner` / `pr-planner` / `prd` / `progress-observer` / `retrospective` / `verifier` / `workflow-pb`）全部 `online`（判定时排除固有节点 `web`）（F04 验收 1）
- [ ] 迭代期内主集群零启停、零配置改动：无对 `<主工作区>/cluster.json` 的 `cluster up` / `cluster down`，该文件与其运行 session 保持原样（F04 验收 3）
- [ ] 启动记录（命令逐字 + 启动时间 + 三项隔离取值）写入本 PR 证据小节；本 PR 不要求收口时 `down`（现场保留）（F04 验收 5 / 边界）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md`（验收 1~5、边界、架构维度 A-01）
- `docs/iterations/0028-role-model-binding/architecture.md` §3.1 配置→启动→生效、§4 A-01（副本形态/落点/刷新时点/三项隔离/被否方案）、§4 A-05（对话库不共享）
- `docs/iterations/0028-role-model-binding/status.md` §派发台账（主集群既有事实：socket `<主工作区>/oamp/.runtime/router.sock`、web `127.0.0.1:7788`、`oamp-cluster` 12 窗口）
- 代码锚点：`oamp/src/cluster-config.js:184`（`root = path.dirname(configPath)`：工作区根同时决定角色文件预检路径与角色 `cwd` 基准）、`oamp/src/cluster.js:190`（web 窗口 argv `--port` 取 `config.web.port`）、`oamp/src/cluster.js:19-21`（`PKG_ROOT` 推导 `LOG_DIR`）、`oamp/src/config.js:144/154`（socket 与对话库按包根推导）

## depends_on

- pr-002-role-model-binding.md（理由：本卡验收 4 要求第二集群的角色级配置含 F03 的两处 `model`，而副本被定义为 `<工作区>/cluster.json` 的逐字副本 + 仅两键差异 ⇒ 该配置只有在本 PR 的产物中才存在——证据：`oamp/src/cluster.js:200-201` 的 `planWindows` 把 `entry.model` 逐字追加为角色窗口的 `--model`，`entry.model` 的唯一来源是配置文件 `roles.<role>.model`；缺 pr-002 的提交，副本携带的两处绑定为空）

## batch

2

## 验收证据

（本 PR 执行时填写：「副本与 `cluster.json` 的 `diff` 输出（恰 2 行）」+「启动命令逐字」+「启动时间」+「三项隔离取值与核对命令」+「`api agents --port 7789` 的 10 实例在线表」+「`cluster.second.json` 的 untracked 性质登记」；载体约定见 `architecture.md` §4 A-01/§4 A-02）

### 执行记录（执行者 dev，2026-09-16；分支 `feat/0028-pr-005-second-cluster`）

路径记号：`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`（迭代工作区）；`<WT>` = 本 PR worktree；`<MAIN>` = `/Users/chenchiyuan/projects/agents`（主工作区）。

**执行结论**：副本生成、启动命令实跑、三项隔离取证全部执行；第二集群**未就绪**（阻塞，根因见 ⑤）⇒ 验收 4、验收 6 不通过，验收 5 的 socket 半项不通过（逐条判定见 ⑪）。未擅自改配置取值 / 改启动形态 / 换端口 / 换落点 / 设 `OAMP_SOCKET`。

#### ① 副本与 `<WS>/cluster.json` 的 `diff` 输出（恰 2 行差异）｜PR 验收 1 / F04 验收 2

生成方式：`cp -p <WS>/cluster.json <WS>/cluster.second.json`，再对副本仅替换两处取值（`session` / `web.port`）；源文件全程未改（判据 = 源 sha256 前后同值）。

```
$ diff <WS>/cluster.json <WS>/cluster.second.json
2c2
<   "session": "oamp-cluster",
---
>   "session": "oamp-cluster-0028",
4c4
<     "port": 7788
---
>     "port": 7789
$ git diff --no-index --numstat <WS>/cluster.json <WS>/cluster.second.json
2	2	<WS>/{cluster.json => cluster.second.json}
```

读数口径（避免歧义）：变化**取值行** = 2（`2c2` 的 `session` 行、`4c4` 的 `web.port` 行）；`diff` 默认渲染成 6 行文本（2 个 hunk 头 + 2 组 `<`/`---`/`>`），`--numstat` = `2	2` 即"2 增 2 删 = 恰 2 处取值变化"，其余行逐字一致。

结构等价（node 深比较：JSON 解析后按扁平键路径比较；命令与原始输出逐字照录）：

```
$ node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p?p+"."+k:k):[[p?p+"."+k:k,v]]);const ma=Object.fromEntries(flat(a)),mb=Object.fromEntries(flat(b));const keys=[...new Set([...Object.keys(ma),...Object.keys(mb)])];const diffs=keys.filter(k=>JSON.stringify(ma[k])!==JSON.stringify(mb[k])).map(k=>({key:k,src:ma[k],dst:mb[k]}));console.log("deep-diff keys:",JSON.stringify(diffs));console.log("router.socket src/dst:",JSON.stringify(ma["router.socket"]),JSON.stringify(mb["router.socket"]));console.log("roles keys count src/dst:",Object.keys(a.roles).length,Object.keys(b.roles).length);console.log("roles identical:",JSON.stringify(a.roles)===JSON.stringify(b.roles));console.log("dev.model src/second/equal:",ma["roles.dev.model"],"/",mb["roles.dev.model"],"/",ma["roles.dev.model"]===mb["roles.dev.model"]);console.log("verifier.model src/second/equal:",ma["roles.verifier.model"],"/",mb["roles.verifier.model"],"/",ma["roles.verifier.model"]===mb["roles.verifier.model"]);' <WS>/cluster.json <WS>/cluster.second.json
deep-diff keys: [{"key":"session","src":"oamp-cluster","dst":"oamp-cluster-0028"},{"key":"web.port","src":7788,"dst":7789}]
router.socket src/dst: null null
roles keys count src/dst: 10 10
roles identical: true
dev.model src/second/equal: openai/gpt-5.6-luna / openai/gpt-5.6-luna / true
verifier.model src/second/equal: powerby/grok-4.6 / powerby/grok-4.6 / true
```

（`roles identical: true` ⇒ `roles` 整段 10 个角色逐字一致，含两处 `model`；差集恰 `session` / `web.port` 两键。）

- 源 sha256（生成前后同值）：`4d8e476a05e48f4ad428d87810b6bd8dbf6bb4e7a297c0a63b84515c20743bd0  <WS>/cluster.json`
- 副本 sha256 / 字节数 / 行数：`bada5164b02f63157be227a4e328a4c6919111fb25354a2d2437d2f5c0e94008` / `494` / `27`
- 两处绑定与源逐字一致（PR 验收 2 / F04 验收 4）：

```
$ grep -n model <WS>/cluster.json <WS>/cluster.second.json
<WS>/cluster.json:14:      "model": "openai/gpt-5.6-luna",
<WS>/cluster.json:24:    "verifier": { "model": "powerby/grok-4.6" },
<WS>/cluster.second.json:14:      "model": "openai/gpt-5.6-luna",
<WS>/cluster.second.json:24:    "verifier": { "model": "powerby/grok-4.6" },
```

#### ② 启动命令逐字｜PR 验收 8 / F04 验收 5

```
node /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/bin/hub.js cli cluster up --config /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/cluster.second.json --wait 120000
```

#### ③ 启动时间｜PR 验收 8

| 次 | 发起时点 | 返回时点 | 实测耗时 | exit code | 结果 |
|---|---|---|---|---|---|
| 1（首次） | 2026-09-16 09:42:54 CST | 2026-09-16 09:44:55 CST | 120.2 s | `1` | **失败**（Router 未就绪） |
| 2（同一条命令逐字复跑） | 2026-09-16 09:46:12 CST | 2026-09-16 09:46:12 CST | <1 s | `0` | 幂等短路（`cluster.js:370` `hasSession` ⇒ 不启动），**非就绪证据** |

第 1 次原始输出（stderr）：

```
oamp cluster: Router 未就绪（socket=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/.runtime/router.sock，等待 120000ms）——查看 router 窗口或日志 /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/.runtime/cluster/router.log
oamp cluster: 保留现场（未自动回滚）；收口请执行 oamp cluster down
```

第 2 次原始输出（stdout）：

```
集群已在运行（session=oamp-cluster-0028，1 窗口）
tmux attach -t oamp-cluster-0028
如需重建请先 oamp cluster down
```

（口径说明：`oamp/src/cluster.js:370-376` 对已存在的 session 直接幂等返回 0，不启动、不等待、不打印拓扑表；故第 2 次 exit 0 不构成"集群已启动"证据。两次均未改配置取值、未改启动形态、未换端口、未改 session 名、未改 `router.socket`、未绕开 `oamp cluster`。）

#### ④ 三项隔离取值与核对命令｜PR 验收 3 / 5 / 6、F04 验收 2

**① session**（F04 验收 2 ①）：副本取值 `"session": "oamp-cluster-0028"`；实测：

```
$ tmux ls
oamp-cluster: 12 windows (created Wed Sep 16 08:47:42 2026)
oamp-cluster-0028: 1 windows (created Wed Sep 16 09:42:54 2026)
```

⇒ 两个 session 并存、名称与创建时点均不同（隔离①成立）。但第二集群只有 1 个窗口（`router`，pane 已 dead），**不是**"全角色就绪"的集群——见 ⑤。

**② web 端口**（F04 验收 2 ②）：副本取值 `"port": 7789`；实测：

```
$ lsof -nP -iTCP:7789 -sTCP:LISTEN
（空输出，exit=1：无监听）
$ lsof -nP -iTCP:7788 -sTCP:LISTEN
COMMAND   PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    64314 chenchiyuan   15u  IPv4 0xcb7bf46c7e87e73e      0t0  TCP 127.0.0.1:7788 (LISTEN)
```

⇒ **未通过**：web 窗口从未被创建（`cluster.js:406` 在 Router 就绪判定之后才创建 web 与角色窗口；`cluster.js:399` 未就绪即返回），故 7789 无监听。主集群 7788 仍由基线 PID `64314` 监听。

**③ socket / 集群日志**（F04 验收 2 ③）：两包根对照表——

| 侧 | socket 绝对路径 | 路径长度 | 集群日志目录 | 实测 |
|---|---|---|---|---|
| 主 `<MAIN>` | `/Users/chenchiyuan/projects/agents/oamp/.runtime/router.sock` | 60 | `<MAIN>/oamp/.runtime/cluster/` | `srw------- router.sock` 在场（inode 115312821） |
| 第二 `<WS>` | `<WS>/oamp/.runtime/router.sock` | **105** | `<WS>/oamp/.runtime/cluster/` | 日志目录与 12 个日志文件在场；**`router.sock` 缺失** |

```
$ ls -la <WS>/oamp/.runtime/
drwxr-xr-x  3 chenchiyuan staff  96 Sep 16 09:42 .
drwxr-xr-x 14 chenchiyuan staff 448 Sep 16 09:42 ..
drwxr-xr-x 14 chenchiyuan staff 448 Sep 16 09:42 cluster
$ ls -la <WS>/oamp/.runtime/cluster/
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-architect.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-demand.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-dev.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-planner.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-pr-planner.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-prd.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-progress-observer.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-retrospective.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-verifier.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 pb-workflow-pb.log
-rw-r--r-- 1 chenchiyuan staff 195 Sep 16 09:42 router.log
-rw-r--r-- 1 chenchiyuan staff   0 Sep 16 09:42 web.log
$ ls -la <WS>/oamp/.runtime/router.sock
ls: cannot access '…/oamp/.runtime/router.sock': No such file or directory
```

⇒ 日志落点隔离成立（`cluster.js:19-21` 的 `PKG_ROOT` 推导 = `<WS>/oamp/.runtime/cluster`，与主集群 `LOG_DIR` 不同）；socket 路径**按同口径推导为 `<WS>/oamp/.runtime/router.sock`（`config.js:144`），但该文件未能生成**（根因见 ⑤）。

副本 `router.socket` = `null`，且启动命令文本中不出现 `OAMP_SOCKET=`（`cluster.js:177-184` 的 `socketEnvPrefix` 仅在非 `null` 时注入）⇒ 被否方案② 未被触发。

#### ⑤ 启动失败记录与根因（阻塞项）｜F04 验收 4 后半

**现象**：`router` 窗口启动即退出（`tmux` pane dead，status 0），`<WS>/oamp/.runtime/cluster/router.log` 全文：

```
oamp: router start 失败: chmod 0600 失败: ENOENT: no such file or directory, chmod '/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/.runtime/router.sock'
```

**根因**（实测复现，非推断）：macOS `sockaddr_un.sun_path` 上限 = 104 字节；副本按包根推导出的 socket 路径长 **105** 字符 ⇒ 内核按 104 截断后 `bind` 成功（实际落成截断名 `…/oamp/.runtime/router.soc`），随后 `router.js:471` 的 `fs.chmodSync(socketPath, 0o600)` 对**未截断**的全长路径执行 ⇒ `ENOENT` ⇒ `router start` 返回 1（`router.js:472-481`）；`server.close()` 由 libuv 连带 unlink 掉那个截断名文件，故现场无 socket 残留、也无截断名残留。`router.js:456`（`server.listen`）与 `router.js:471`（`chmod`）之间没有其它失败点，与日志形态一致。

复现（`/tmp` 内同长度路径，与现场无关，仅验证上限口径；同一脚本，只改路径长度。命令与原始输出逐字照录）：

```
$ node -e 'const net=require("net"),fs=require("fs");const dir=process.argv[1],n=Number(process.argv[2]);const p=dir+"a".repeat(n-dir.length);console.log("pathlen",p.length,p);const s=net.createServer();s.on("error",e=>console.log("listen-error",e.code,e.message));s.listen(p,()=>{console.log("listening cb fired");try{fs.chmodSync(p,0o600);console.log("chmod ok");}catch(e){console.log("chmod FAILED",e.code,e.message);}console.log("existsSync(full)=",fs.existsSync(p));setTimeout(()=>process.exit(0),800);});' /tmp/udstest2/ 105
pathlen 105 /tmp/udstest2/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
listening cb fired
chmod FAILED ENOENT ENOENT: no such file or directory, chmod '/tmp/udstest2/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
existsSync(full)= false
$ node -e '（脚本同上一行逐字，仅末两个实参改为 /tmp/udstest3/ 104）' /tmp/udstest3/ 104
pathlen 104 /tmp/udstest3/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
listening cb fired
chmod ok
existsSync(full)= true
$ ls -la /tmp/udstest2 /tmp/udstest3
/tmp/udstest2:
srwxr-xr-x   1 chenchiyuan wheel     0 Sep 16 09:48 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
/tmp/udstest3:
srw-------   1 chenchiyuan wheel     0 Sep 16 09:48 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

⇒ 边界对照：104 字符路径 `chmod ok` + 文件在场；105 字符路径 `chmod FAILED ENOENT` + 全长路径无文件，且文件实际落在**截断到 104 字符**的名字上（`ls` 可见）。主集群不受影响：其 socket 路径长 60。

**与副本取值无关**：失败不因 `session` / `web.port` / 两处 `model` 触发——`cluster up` 输出与 `<WS>/oamp/.runtime/cluster/*.log` 中 `配置错误` 零命中（判据见 ⑪-2），router 失败发生在监听阶段而非配置加载阶段。

**处置（契约 5）**：已按"如实记失败 + 现象 + 关键日志摘要 + 同一条命令复跑一次"执行（见 ②③），复跑未能得出就绪结论（幂等短路），故**记录并上报，不做掩盖式重试**。在"副本必须落 `<WS>` 根"（`architecture.md` §4 A-01 落点）与"副本 `router.socket` 保持 `null`、不显式设 socket"（A-01 被否方案②）两条既定约束下，socket 路径长度由 `<WS>` 深度唯一决定，本 PR 授权范围内**不存在**不改动上述任一项即可缩短该路径的手段（设 `OAMP_SOCKET` 会把 socket 移出 `<WS>/oamp/.runtime/` 从而撞验收 5；改副本落点撞 A-01 落点与"工作区根同时决定角色文件预检路径与 `cwd` 基准"）。⇒ **阻塞，需主 agent 决策**（候选方向超出本 PR 边界，未实现、未试探）。

#### ⑥ `api agents --port 7789` 的 10 实例在线表｜PR 验收 6 / F04 验收 1

命令逐字与原始输出：

```
$ node <WS>/oamp/bin/hub.js api agents --port 7789
{"code":"HUB_UNREACHABLE","error":"无法连接 hub（127.0.0.1:7789；服务未运行？）","exit_code":3}
```

⇒ **未通过**：10 个 `pb-<role>` 实例在线表不可得（7789 无监听，见 ④-②），无 `instance_id` / `state` 可列。

判定口径留痕（`API.md:1505`：无参含 `offline` 墓碑；本次使用无参形态，未使用 `--state online` 过滤）：对照跑一次**只读**的缺省端口形态（打主集群 7788，不属本 PR 验收面，仅证明口径与"排除固有节点 `web`"的读法）：

```
$ node <WS>/oamp/bin/hub.js api agents | jq -r '.agents[] | "\(.instance_id)\t\(.state)"'
pb-architect	online
pb-demand	online
pb-dev	online
pb-planner	online
pb-pr-planner	online
pb-prd	online
pb-progress-observer	online
pb-retrospective	online
pb-verifier	online
pb-workflow-pb	online
web	online
```

（零派发：本任务与本次对照查询均未产生 `calls create` / `messages send`。）

#### ⑦ 跨工作区写入登记（SCM 规则 F 偏差，显式登记、不静默）｜PR 边界硬约束 1 / T3

1. **写入路径（绝对）**：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/cluster.second.json`；**写入时点** = `2026-09-16 09:42:48 CST`（`stat` birth）；生成时点的源 sha256 = `4d8e476a05e48f4ad428d87810b6bd8dbf6bb4e7a297c0a63b84515c20743bd0`。
2. **该路径在本 PR worktree 之外**，判据两条：

```
$ ls -l <WT>/cluster.second.json
ls: cannot access '/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-005-second-cluster/cluster.second.json': No such file or directory
$ git -C <WT> status --porcelain
?? docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up-tasks.md
?? docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up.md
```

3. **冲突描述**：本迭代 SCM 规则「写入限本工作区」与本次写入（落在迭代工作区 `<WS>` 根、本 PR worktree 之外）冲突。
4. **上游依据**（逐条可点）：① `architecture.md` §4 A-01「落点」原文——「迭代工作区根（`<WS>/cluster.second.json`）。**必须在这一级**：`cluster-config.js` 的 `root = dirname(configPath)` 同时决定 ① 角色文件预检路径 `<root>/roles/<role>/<role>.md` ② 角色 `cwd` 缺省基准」（代码原文 `oamp/src/cluster-config.js:184`：`const root = path.dirname(configPath);`；同节被否方案④ 已论证放进 `docs/iterations/…` 会同时失效）；② 本 PR 文件「文件范围」第 1 行：`<工作区>/cluster.second.json`。
5. **除该路径外 `<WS>` 零写入**：与执行前基线逐行比对 ⇒ 唯一新增行 = `?? cluster.second.json`；`<WS>/oamp/.runtime/**` 未出现在 `git status` 中（被 `oamp/.gitignore:1:.runtime/` 覆盖，判据 = `git check-ignore -v` 命中 `oamp/.gitignore:1:.runtime/`）；`<WS>/cluster.json` 未出现在 ` M` 列且 sha256 与基线同值。

```
$ git -C <WS> status --porcelain
 M docs/iterations/0028-role-model-binding/history.md
 M docs/iterations/0028-role-model-binding/status.md
?? cluster.second.json
?? docs/iterations/0028-role-model-binding/clarifications/stage5-pr-verdicts-20260916.md
?? docs/iterations/0028-role-model-binding/clarifications/verify-20260915-221935.md
?? docs/iterations/0028-role-model-binding/deferred-demand-changes.md
?? docs/iterations/0028-role-model-binding/progress.md
?? docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
?? docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up.md
?? docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md
?? docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md
?? docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md
?? docs/iterations/0028-role-model-binding/prs/pr-009-existing-surface-freeze.md
?? docs/iterations/0028-role-model-binding/prs/pr-010-post-merge-activation-evidence.md
$ shasum -a 256 <WS>/cluster.json
4d8e476a05e48f4ad428d87810b6bd8dbf6bb4e7a297c0a63b84515c20743bd0  <WS>/cluster.json
```

（上表前 2 行 ` M` 与后 11 行 `??` 均为执行前基线中已存在的在途产物，逐行一致，无新增；新增仅第 3 行 `?? cluster.second.json`。）

⇒ **本次写入 `<WS>/cluster.second.json` 属跨工作区写入（由本 PR 文件与 `architecture.md` §4 A-01 约定），不涉及该工作区其它路径。**

#### ⑧ `cluster.second.json` 的 untracked 性质登记｜PR 验收 1 / A-01「未纳入版本控制的性质」

```
$ git -C <WS> status --porcelain | grep cluster.second
?? cluster.second.json
$ git -C <WS> check-ignore -v cluster.second.json
（无输出，exit=1 ⇒ 未命中任何 .gitignore 规则，呈 untracked）
$ git -C <WT> status --porcelain | grep cluster.second
（无输出 ⇒ 不在本 worktree 内）
```

性质登记：该副本是**运行态产物**（与 socket、集群日志同类），不是迭代分支的改动路径 ⇒ 不出现在 F13 验收 1 的 `git diff --name-only` 判据面；但 `git status --porcelain` 会显示为 untracked，此处显式登记供复核者一眼对上（F13 侧的登记归 pr-009）。

#### ⑨ 启动环境审计（`OAMP_*` 面与角色文件解析根）｜T4

```
$ printenv | grep -i '^OAMP'                                  # 启动前（执行 shell）
OAMP_ROLE_ROOT=/Users/chenchiyuan/projects/agents
$ tmux show-environment -t oamp-cluster-0028                    # 启动后（第二集群 session；原文照录，未过滤）
-DISPLAY
-KRB5CCNAME
-MSYSTEM
OAMP_ROLE_ROOT=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding
-SSH_AGENT_PID
SSH_ASKPASS=/usr/bin/false
SSH_AUTH_SOCK=/private/tmp/com.apple.launchd.OkKzWOY6JX/Listeners
-SSH_CONNECTION
-WINDOWID
-XAUTHORITY
$ tmux show-environment -t oamp-cluster | grep -i OAMP         # 主集群 session
OAMP_ROLE_ROOT=/Users/chenchiyuan/projects/agents
$ diff -rq /Users/chenchiyuan/projects/agents/roles <WS>/roles
（空输出，exit=0）
```

结论 = **无泄漏**（判据二选一中的第 ① 项）：新 session 的 `OAMP_ROLE_ROOT` 被 `cluster.js:389`（`set-environment -t <session> OAMP_ROLE_ROOT <config.root>`）显式设为副本所在工作区根 `<WS>`，而非执行 shell 继承的 `<MAIN>` ⇒ `role-binding.js:16-22` 的 override 分支取到 `<WS>/roles/**`。`OAMP_SOCKET` / `OAMP_WEB_PORT` / `OAMP_CLUSTER_LOG_DIR` 全程未设（三者均不出现在上述三份环境快照中）。`<MAIN>/roles` 与 `<WS>/roles` 内容面亦逐字一致（`diff -rq` 零输出）。本任务未改动启动形态（未加 `env -u`、未重启）。

#### ⑩ 主集群零触碰核对（对照执行前基线）｜PR 验收 7 / F04 验收 3

| 项 | 执行前基线（2026-09-16 09:42:35 CST） | 执行后实测 | 判定 |
|---|---|---|---|
| `<MAIN>/cluster.json` sha256 | `7eaa38ef71db9794e3e8464469b0bdae8bdab5685ef76dca9d4431807cd5a258` | 同值 | ✅ 零配置改动 |
| `oamp-cluster` session | `oamp-cluster: 12 windows (created Wed Sep 16 08:47:42 2026)` | 逐字同值（12 窗口、创建时点未变） | ✅ 无重建迹象 |
| `127.0.0.1:7788` LISTEN | PID `64314` | PID `64314` | ✅ 端口原样 |
| `<MAIN>/oamp/.runtime/router.sock` | inode `115312821`、mtime `2026-09-16 08:47:43.011394693 +0800` | 同 inode、同 mtime | ✅ 未被重建 |
| `127.0.0.1:7789` LISTEN | 无（exit=1） | 无（exit=1） | ✅ 占用面未变 |
| `<WS>/cluster.json` sha256 | `4d8e476a05e48f4ad428d87810b6bd8dbf6bb4e7a297c0a63b84515c20743bd0` | 同值 | ✅ 副本生成未回写源 |
| 新增 session | — | 仅 `oamp-cluster-0028`（1 窗口） | ✅ 主集群 session 未动 |

命令面自证：本 PR 全部命令中涉及 `cluster` 动作的**只有** `cli cluster up --config <WS>/cluster.second.json`（2 次，见 ②）；`<MAIN>/cluster.json` 仅以 `shasum -a 256` 只读形式出现，**零次**作为 `--config` 取值；`cluster down` 零次；`calls create` / `messages send` 零次（`up` / `down` / 改配置三类动作对主集群均零次）。

#### ⑪ 八条验收标准逐条判定

| # | 验收标准（本 PR 文件） | 判定 | 证据 |
|---|---|---|---|
| 1 | 副本存在；`diff` 恰 2 行差异；`router.socket` 保持 `null` | **通过** | ①（`diff` + `--numstat 2	2` + 深比较差集恰 `session`/`web.port` 两键 + `router.socket` 两侧 `null`） |
| 2 | 两处 `model` 与源逐字一致；启动输出与 `cluster/*.log` 不出现 `配置错误` | **通过** | ①（`grep -n model` 两侧同值）；`grep -n '配置错误' <WS>/oamp/.runtime/cluster/*.log` **零命中**（exit=1） |
| 3 | `tmux ls` 同时存在 `oamp-cluster` 与 `oamp-cluster-0028` | **通过**（字面） | ④-①；**附带事实**：第二 session 仅 1 窗口（`router`，pane dead），非就绪集群 |
| 4 | `lsof -nP -iTCP:7789 -sTCP:LISTEN` 有监听 | **不通过** | ④-②（空输出，exit=1；web 窗口未创建） |
| 5 | socket 与集群日志落 `<WS>/oamp/.runtime/`、与主集群不同包根 | **部分通过**：日志目录 ✅ / `router.sock` 缺失 ❌ | ④-③（两条绝对路径包根不同；socket 文件未生成，根因见 ⑤） |
| 6 | `api agents --port 7789` 返回 10 个 `pb-<role>` 全 `online`（排除 `web`） | **不通过** | ⑥（`HUB_UNREACHABLE`，exit=3） |
| 7 | 主集群零启停、零配置改动 | **通过** | ⑩（四项基线逐项同值 + 命令面自证） |
| 8 | 启动记录（命令逐字 / 时间 / 三项隔离取值）写入证据小节；不收口 `down`、现场保留 | **通过（含失败记录）** | ②③④⑤；未执行 `down`、未删除副本、未停止现场 |

**未通过项汇总（供主 agent 决策）**：验收 4、验收 6，以及验收 5 的 socket 半项，全部归因于 ⑤ 的**单一根因**（`<WS>/oamp/.runtime/router.sock` 长 105 > macOS UDS 上限 104 ⇒ `bind` 被内核截断、`chmod` 全长路径 `ENOENT` ⇒ `router start` 失败 ⇒ Router 永不就绪 ⇒ web / 角色窗口从不创建）。该根因与副本内任何取值无关，且在既有约束（副本落 `<WS>` 根 + `router.socket` 保持 `null`）下不能由本 PR 消解；需要的是架构层决策（例如缩短负载路径深度或改 socket 落点），超出本 PR 授权范围，**未实现、未试探、未掩盖**。

---

### 执行记录 · 返工轮（方案 A：副本增 `router.socket` 短路径；执行者 dev，2026-09-16）

**判据变更依据**：用户 2026-09-16 09:52 裁决「方案 A」（本轮 brief 逐字记载，并登记为 brief 引用的 **G-17** 项）：副本允许**第三键差异** —— `router.socket` 由 `null` 改为绝对路径 **`/tmp/oamp-0028-router.sock`**；判据随之变为 `diff` 恰 **3 行**（`session` / `web.port` / `router.socket` 各一行），其余逐字一致。依据链（代码锚点，本轮复核）：`oamp/src/config.js:144`（`socketPath: env.OAMP_SOCKET || path.join(PKG_ROOT, '.runtime', 'router.sock')`）、`oamp/src/cluster.js:177-184`（`socketEnvPrefix` 把 `config.router.socket` 作为 `OAMP_SOCKET=` 前缀加给**所有**窗口，含 router / web / 角色）、`oamp/src/cluster.js:393`（`const socketPath = config.router.socket ?? runtimeConfig.socketPath;`）+ `cluster.js:397`（就绪探测用该 `socketPath`）。

> 上一轮小节（`### 执行记录（执行者 dev，2026-09-16；分支 …）`）为**保留**的失败记录，本轮不改写、不删除它。

**本轮结论**：第二集群**已就绪** —— 12 窗口全活（`pane_dead=0`）、7789 监听、10 个 `pb-<role>` 全 `online`、Router 实际绑定 `/tmp/oamp-0028-router.sock`。**一处未对齐**：`cluster up` 自身 exit code 仍为 `1`（其内置 online 复核不认 `config.router.socket`，见 ② 的根因说明）⇒ **不得以 `up` 的退出码作为本集群的就绪判据**。

#### ⓪ 清理上一轮失败会话（本轮授权的前置动作，仅此一次）

```
$ node <WS>/oamp/bin/hub.js cli cluster down --config <WS>/cluster.second.json
已收口（session=oamp-cluster-0028，1 窗口）
（时点 2026-09-16 09:53:37 CST → 09:53:37 CST；exit code = 0）
$ tmux ls
oamp-cluster: 12 windows (created Wed Sep 16 08:47:42 2026)
```

（未出现「Router 不可达」原文；主集群 session 未受影响，7788 仍由 PID `64314` 监听。）

#### ① 副本三键差异（判据变更后）｜PR 验收 1 / F04 验收 2

```
$ diff <WS>/cluster.json <WS>/cluster.second.json
2c2
<   "session": "oamp-cluster",
---
>   "session": "oamp-cluster-0028",
4c4
<     "port": 7788
---
>     "port": 7789
7c7
<     "socket": null
---
>     "socket": "/tmp/oamp-0028-router.sock"
$ git diff --no-index --numstat <WS>/cluster.json <WS>/cluster.second.json
3	3	<WS>/{cluster.json => cluster.second.json}
```

（读数口径同上一轮：变化**取值行** = 3（`2c2` / `4c4` / `7c7`）；`--numstat` = `3	3` 即"3 增 3 删 = 恰 3 处取值变化"。）

- 副本 sha256（三键版）= `52e971ad5a204de3cce73fc616941f2baf771530f9c8b9145f021a252c207fe9`（上一轮两键版 = `bada5164…`）；行数 `27`；源 `<WS>/cluster.json` sha256 仍 = `4d8e476a05e48f4ad428d87810b6bd8dbf6bb4e7a297c0a63b84515c20743bd0`（未回写）。
- 深比较（与上一轮同一脚本，逐字照录）：

```
$ node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p?p+"."+k:k):[[p?p+"."+k:k,v]]);const ma=Object.fromEntries(flat(a)),mb=Object.fromEntries(flat(b));const keys=[...new Set([...Object.keys(ma),...Object.keys(mb)])];const diffs=keys.filter(k=>JSON.stringify(ma[k])!==JSON.stringify(mb[k])).map(k=>({key:k,src:ma[k],dst:mb[k]}));console.log("deep-diff keys:",JSON.stringify(diffs));console.log("router.socket src/dst:",JSON.stringify(ma["router.socket"]),JSON.stringify(mb["router.socket"]));console.log("roles keys count src/dst:",Object.keys(a.roles).length,Object.keys(b.roles).length);console.log("roles identical:",JSON.stringify(a.roles)===JSON.stringify(b.roles));console.log("dev.model src/second/equal:",ma["roles.dev.model"],"/",mb["roles.dev.model"],"/",ma["roles.dev.model"]===mb["roles.dev.model"]);console.log("verifier.model src/second/equal:",ma["roles.verifier.model"],"/",mb["roles.verifier.model"],"/",ma["roles.verifier.model"]===mb["roles.verifier.model"]);' <WS>/cluster.json <WS>/cluster.second.json
deep-diff keys: [{"key":"session","src":"oamp-cluster","dst":"oamp-cluster-0028"},{"key":"web.port","src":7788,"dst":7789},{"key":"router.socket","src":null,"dst":"/tmp/oamp-0028-router.sock"}]
router.socket src/dst: null "/tmp/oamp-0028-router.sock"
roles keys count src/dst: 10 10
roles identical: true
dev.model src/second/equal: openai/gpt-5.6-luna / openai/gpt-5.6-luna / true
verifier.model src/second/equal: powerby/grok-4.6 / powerby/grok-4.6 / true
```

- 三键取值行两版并列（含两处绑定，逐字一致 ⇒ PR 验收 2 / F04 验收 4）：

```
$ grep -n 'session\|"port"\|"socket"\|"model"' <WS>/cluster.json <WS>/cluster.second.json
<WS>/cluster.json:2:  "session": "oamp-cluster",
<WS>/cluster.json:4:    "port": 7788
<WS>/cluster.json:7:    "socket": null
<WS>/cluster.json:14:      "model": "openai/gpt-5.6-luna",
<WS>/cluster.json:24:    "verifier": { "model": "powerby/grok-4.6" },
<WS>/cluster.second.json:2:  "session": "oamp-cluster-0028",
<WS>/cluster.second.json:4:    "port": 7789
<WS>/cluster.second.json:7:    "socket": "/tmp/oamp-0028-router.sock"
<WS>/cluster.second.json:14:      "model": "openai/gpt-5.6-luna",
<WS>/cluster.second.json:24:    "verifier": { "model": "powerby/grok-4.6" },
```

#### ② 启动命令逐字 + 启动时间｜PR 验收 8

```
node /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/bin/hub.js cli cluster up --config /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/cluster.second.json --wait 120000
```

| 项 | 值 |
|---|---|
| 发起时点 | 2026-09-16 09:53:43 CST |
| 返回时点 | 2026-09-16 09:55:43 CST |
| 实测耗时 | 120.26 s（`--wait` 预算耗尽） |
| exit code | `1` |

原始输出（stderr 全文）：

```
oamp cluster: 等待超时（120000ms）：以下实例未 online: pb-architect pb-demand pb-dev pb-planner pb-pr-planner pb-prd pb-progress-observer pb-retrospective pb-verifier pb-workflow-pb
oamp cluster: 保留现场（未自动回滚）；逐个查看窗口或日志目录 /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/oamp/.runtime/cluster，收口请执行 oamp cluster down
```

**exit 1 的根因（非集群故障，必须与就绪判据分开读）**：`oamp/src/cluster.js:415` 的 online 复核是 `await waitForOnline(runtimeConfig, instanceIds, deadline)` —— 传入的是 **`runtimeConfig`**（其 `socketPath = env.OAMP_SOCKET || <包根>/.runtime/router.sock` = 上一轮那条 **105 字符、本轮已废弃**的路径），而非 `cluster.js:393` 解析出的 `config.router.socket`。父进程因此连不上 Router，10 个实例被一律列为 `missing`。子进程侧（router / web / 角色）全部由 `cluster.js:177-184` 的 `socketEnvPrefix` 注入 `OAMP_SOCKET=/tmp/oamp-0028-router.sock` ⇒ **集群实际已就绪**，就绪证据见 ③④。

#### ③ 三项隔离取值与核对命令（判据变更后）｜PR 验收 3 / 5 / 6、F04 验收 2

**① session**：

```
$ tmux ls
oamp-cluster: 12 windows (created Wed Sep 16 08:47:42 2026)
oamp-cluster-0028: 12 windows (created Wed Sep 16 09:53:43 2026)
```

**② web 端口**：

```
$ lsof -nP -iTCP:7789 -sTCP:LISTEN
COMMAND   PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    92023 chenchiyuan   15u  IPv4 0x869d19e49509361d      0t0  TCP 127.0.0.1:7789 (LISTEN)
$ lsof -nP -iTCP:7788 -sTCP:LISTEN
COMMAND   PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    64314 chenchiyuan   15u  IPv4 0xcb7bf46c7e87e73e      0t0  TCP 127.0.0.1:7788 (LISTEN)
$ cat <WS>/oamp/.runtime/cluster/web.log
(node:92023) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
WEB_READY url=http://127.0.0.1:7789
```

（第二集群 web PID `92023` ≠ 主集群 `64314`。）

**③ socket / 集群日志**（判据变更后的三行取值表）：

| 侧 | socket 绝对路径 | 长度 | 依据 | 集群日志目录 |
|---|---|---|---|---|
| 第二 `<WS>` | `/tmp/oamp-0028-router.sock` | 26 | 副本 `router.socket` 显式取值（本轮裁决） | `<WS>/oamp/.runtime/cluster/` |
| 主 `<MAIN>` | `/Users/chenchiyuan/projects/agents/oamp/.runtime/router.sock` | 60 | 包根推导（`config.js:144`） | `<MAIN>/oamp/.runtime/cluster/` |
| ~~上一轮失败值~~ | `<WS>/oamp/.runtime/router.sock` | 105 | 包根推导（超 macOS 上限 104） | 本轮不再使用 |

```
$ ls -la /tmp/oamp-0028-router.sock
srw------- 1 chenchiyuan wheel 0 Sep 16 09:53 /tmp/oamp-0028-router.sock
$ grep -n ROUTER_READY <WS>/oamp/.runtime/cluster/router.log
1:[2026-09-16T01:53:43.960Z] router ROUTER_READY socket=/tmp/oamp-0028-router.sock
$ ls -la <WS>/oamp/.runtime/cluster/
-rw-r--r-- 1 chenchiyuan staff 1534 Sep 16 09:55 pb-architect.log
-rw-r--r-- 1 chenchiyuan staff 1483 Sep 16 09:55 pb-demand.log
-rw-r--r-- 1 chenchiyuan staff 1425 Sep 16 09:55 pb-dev.log
-rw-r--r-- 1 chenchiyuan staff 1500 Sep 16 09:55 pb-planner.log
-rw-r--r-- 1 chenchiyuan staff 1551 Sep 16 09:55 pb-pr-planner.log
-rw-r--r-- 1 chenchiyuan staff 1432 Sep 16 09:55 pb-prd.log
-rw-r--r-- 1 chenchiyuan staff 1670 Sep 16 09:55 pb-progress-observer.log
-rw-r--r-- 1 chenchiyuan staff 1602 Sep 16 09:55 pb-retrospective.log
-rw-r--r-- 1 chenchiyuan staff 1507 Sep 16 09:55 pb-verifier.log
-rw-r--r-- 1 chenchiyuan staff 1568 Sep 16 09:55 pb-workflow-pb.log
-rw-r--r-- 1 chenchiyuan staff  205 Sep 16 09:53 web.log
-rw-r--r-- 1 chenchiyuan staff 6973 Sep 16 09:55 router.log
```

`lsof -U` 复核（两集群 Unix socket 绑定侧，节选）：`node 64290 … /Users/chenchiyuan/projects/agents/oamp/.runtime/router.sock` ｜ `node 91999 … /tmp/oamp-0028-router.sock`。

#### ④ 窗口态与 10 实例在线｜PR 验收 3 / 6、F04 验收 1

```
$ tmux list-windows -t oamp-cluster-0028 -F '#{window_index} name=#{window_name} panes=#{window_panes} dead=#{pane_dead} pid=#{pane_pid} cmd=#{pane_current_command}'
0 name=router panes=1 dead=0 pid=91991 cmd=zsh
1 name=web panes=1 dead=0 pid=92015 cmd=zsh
2 name=pb-architect panes=1 dead=0 pid=92025 cmd=zsh
3 name=pb-demand panes=1 dead=0 pid=92035 cmd=zsh
4 name=pb-dev panes=1 dead=0 pid=92045 cmd=zsh
5 name=pb-planner panes=1 dead=0 pid=92055 cmd=zsh
6 name=pb-pr-planner panes=1 dead=0 pid=92076 cmd=zsh
7 name=pb-prd panes=1 dead=0 pid=92086 cmd=zsh
8 name=pb-progress-observer panes=1 dead=0 pid=92096 cmd=zsh
9 name=pb-retrospective panes=1 dead=0 pid=92106 cmd=zsh
10 name=pb-verifier panes=1 dead=0 pid=92116 cmd=zsh
11 name=pb-workflow-pb panes=1 dead=0 pid=92126 cmd=zsh
$ tmux list-windows -t oamp-cluster-0028 | wc -l
12
$ tmux list-panes -s -t oamp-cluster-0028 -F '#{window_name} dead=#{pane_dead}' | awk '{print $2}' | sort | uniq -c
     12 dead=0
```

⇒ 窗口数 = 12（router + web + 10 角色），**12 个 pane 全 `dead=0`**。

```
$ node <WS>/oamp/bin/hub.js api agents --port 7789
{"agents":[{"instance_id":"pb-architect","session_id":"11fc2cca-e3ec-4e0f-b952-690c5cce64c8","state":"online","last_heartbeat":1789523744070,"role":"architect"},{"instance_id":"pb-demand","session_id":"cc79221f-2b4e-46c7-b41d-65a108ca87dd","state":"online","last_heartbeat":1789523744094,"role":"demand"},{"instance_id":"pb-dev","session_id":"c3c0161e-055b-4053-a580-b99aa769746c","state":"online","last_heartbeat":1789523744125,"role":"dev"},{"instance_id":"pb-planner","session_id":"4d17cb82-614d-431d-baf5-287657e1586f","state":"online","last_heartbeat":1789523744149,"role":"planner"},{"instance_id":"pb-pr-planner","session_id":"92af9731-f367-4ed5-883c-93f4dec417d7","state":"online","last_heartbeat":1789523744173,"role":"pr-planner"},{"instance_id":"pb-prd",…}}
```

10 实例在线表（`state` 逐行取自上述 JSON）：

| # | instance_id | state |
|---|---|---|
| 1 | `pb-architect` | `online` |
| 2 | `pb-demand` | `online` |
| 3 | `pb-dev` | `online` |
| 4 | `pb-planner` | `online` |
| 5 | `pb-pr-planner` | `online` |
| 6 | `pb-prd` | `online` |
| 7 | `pb-progress-observer` | `online` |
| 8 | `pb-retrospective` | `online` |
| 9 | `pb-verifier` | `online` |
| 10 | `pb-workflow-pb` | `online` |

判定口径（`API.md:1505`：无参含 `offline` 墓碑；本次用无参形态，未用 `--state online` 过滤；未产生任何调用）：

```
$ jq -r '.agents|map(.instance_id)|join(" ")' <上条输出>
pb-architect pb-demand pb-dev pb-planner pb-pr-planner pb-prd pb-progress-observer pb-retrospective pb-verifier pb-workflow-pb
$ jq -r '([.agents[]|select(.instance_id|startswith("pb-"))]|length)'  → 10
$ jq -r '([.agents[]|select(.instance_id|startswith("pb-"))|select(.state!="online")]|length)'  → 0
$ jq -r '([.agents[]|select(.instance_id=="web")]|length)'  → 0
```

⇒ 10 个 `pb-<role>` 全部 `online`、非 online 计数 = 0；固有节点 `web` 未出现在本集群返回集中（无需额外排除，判定面干净）。

#### ⑤ `配置错误` 零命中 / 主集群零触碰 / 副本性质登记

```
$ grep -n '配置错误' <WS>/oamp/.runtime/cluster/*.log
（零命中，exit=1）
$ grep -n '配置错误' <启动输出原文>
（零命中，exit=1）
```

主集群（对照上一轮基线，逐项同值）：

| 项 | 基线（09:42:35 CST） | 本轮实测 | 判定 |
|---|---|---|---|
| `<MAIN>/cluster.json` sha256 | `7eaa38ef71db9794e3e8464469b0bdae8bdab5685ef76dca9d4431807cd5a258` | 同值 | ✅ 零配置改动 |
| `oamp-cluster` session | `12 windows (created Wed Sep 16 08:47:42 2026)` | 逐字同值 | ✅ 无重建 |
| `127.0.0.1:7788` LISTEN | PID `64314` | PID `64314` | ✅ |
| `<MAIN>/oamp/.runtime/router.sock` | inode `115312821` | 同 inode | ✅ |
| `<MAIN>/cluster.json` 的 `router.socket` | `null` | 仍 `null`（见 ①） | ✅ |

命令面自证：本轮涉及 cluster 动作的只有 `cluster down --config <WS>/cluster.second.json`（1 次，见 ⓪）与 `cluster up --config <WS>/cluster.second.json`（1 次，见 ②）；`<MAIN>/cluster.json` **零次**作为 `--config`；`calls create` / `messages send` 零次。

副本性质（仍为运行态产物、未纳入版本控制）：

```
$ git -C <WS> status --porcelain | grep cluster.second
?? cluster.second.json
$ git -C <WS> check-ignore -v cluster.second.json
（无输出，exit=1 ⇒ 未命中任何 .gitignore 规则）
$ git -C <WT> status --porcelain
?? docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up-tasks.md
```

（`<WS>` 下本轮新增写入仅 `cluster.second.json` 与运行态 `<WS>/oamp/.runtime/**`（被 `oamp/.gitignore:1:.runtime/` 覆盖）；`<WS>/cluster.json` 未出现在 ` M` 列、sha256 与基线同值。执行期间 `<WS>` 另有主 agent 的在途改动（` M history.md` / ` M status.md` / ` M deferred-demand-changes.md` 等），非本次写入。）

#### ⑥ 八条验收标准逐条判定（按变更后判据）

| # | 验收标准（变更后） | 判定 | 证据 |
|---|---|---|---|
| 1 | 副本存在；`diff` 恰 3 行（`session` / `web.port` / `router.socket`）；其余逐字一致 | **通过** | ①（`diff` 3 hunk + `--numstat 3	3` + 深比较差集恰 3 键） |
| 2 | 两处 `model` 与源逐字一致；启动输出与 `cluster/*.log` 无 `配置错误` | **通过** | ①（`roles identical: true` + 两处取值行）+ ⑤（两处 grep 零命中） |
| 3 | `tmux ls` 同时存在 `oamp-cluster` 与 `oamp-cluster-0028` | **通过** | ③-①（两 session 均 12 窗口）+ ④（12 pane 全 `dead=0`） |
| 4 | `lsof -nP -iTCP:7789 -sTCP:LISTEN` 有监听 | **通过** | ③-②（PID `92023` + `WEB_READY url=http://127.0.0.1:7789`） |
| 5 | socket 落副本指定路径 `/tmp/oamp-0028-router.sock`、与主集群路径不同；集群日志落 `<WS>/oamp/.runtime/cluster/` | **通过** | ③-③（26 vs 60、`ROUTER_READY socket=/tmp/oamp-0028-router.sock`、`lsof -U` 双侧绑定） |
| 6 | `api agents --port 7789` 返回 10 个 `pb-<role>` 全 `online`（排除 `web`） | **通过** | ④（10 / 0 / `web` 计数 0） |
| 7 | 主集群零启停、零配置改动 | **通过** | ⑤ |
| 8 | 启动记录（命令逐字 / 时间 / 三项隔离取值）写入证据小节；不收口 `down`、现场保留 | **通过** | ②③④；本轮除授权的前置清理（⓪）外未执行收口 `down`，未删副本、未停现场 |

**与上一轮的差异（一段话）**：上一轮判 5 通过 / 2 不通过 / 1 部分，阻塞根因 = 包根推导出的 socket 路径 105 字符超 macOS `sun_path` 上限 104；本轮按方案 A 把 socket 显式钉到 26 字符的绝对路径 ⇒ 验收 4 / 6 与验收 5 的 socket 半项全部转为通过，三项隔离的 ②③ 判据面随之由"包根推导"变为"显式取值"（① session 不变）。**新增并须保留的事实**：`cluster up` 的 exit code 仍为 `1`（`cluster.js:415` 的 online 复核只认 `runtimeConfig`，不认 `config.router.socket`），因此本集群的就绪判据**必须以** `api agents --port 7789` / `lsof` / 窗口态为准，不可用 `up` 的退出码代理。
