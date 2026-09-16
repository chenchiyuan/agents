# pr-007：hub 入口表与 skill 清单（层 A 21→29 / 层 B 8→9 + F19 文档修复）

## 上下文摘要

`oamp/sdk/surface.js` 三层入口表**追加**：层 A 8 条（21 → 29，路径与 pr-005 的新路由逐条同形）、层 B 1 条（`router.task_cancel`，8 → 9，经既有 `UDS_CALLS` 映射到 pr-001 新增的 `uds.taskCancel`）；`oamp/skill/hub.md` 的两份清单同步（层 A 29 / 层 B 9）并按 F19 重写「序列 1」为"派发 → 等待 → 取件"（主推 `--mode block` / `cli task watch`，轮询降为兜底），等待语义条文**指向** `API.md` 而不复制。

关键约束：既有 40 条的 `id` / `cmd` / 行为 / 退出码零改动（G01 验收 4/5）；`surface.js` 的条目名面与 `skill/hub.md` 的三层清单互为机械锁（改一处必须同时改另一处）；`doctor` 的 R3 探针集**不扩**（N-14）。

## 涉及功能点

- F13
- F17
- F19
- G01

## 文件范围

- `oamp/sdk/surface.js`（`API_ENTRIES` 追加 8 条；`UDS_CALLS` 与 `UDS_ENTRIES` 各追加 `router.task_cancel` / `taskCancel`；头注的"40 条"计数同步）
- `oamp/skill/hub.md`（层 A 清单 21 → 29、层 B 清单 8 → 9；「序列 1」重写；F19 的等待原语说明）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-007-hub-entries-and-skill-lists.md`（本 PR 文件）

不触碰：`oamp/sdk/cli.js` / `oamp/sdk/doctor.js` / `oamp/sdk/http.js` / `oamp/sdk/uds.js`（零改动；`cli.js` 与 `doctor.js` 都是按 `ENTRIES` 表驱动的既有分派）、`oamp/API.md` / `oamp/llms.txt`（归 pr-006）、`oamp/src/**`（归 pr-001/pr-003/pr-005）。

## 验收标准

- [x] `ENTRIES` 恰 **49** 条（层 A 29 / 层 B 9 / 层 C 11）；既有 40 条的 `id` / `cmd` / `args` / `flags` / `kind` / `method` / `path` / `acceptsAs` **逐字不变**（`git diff` 只含新增行 + 注释计数行）（G01 验收 4）
- [x] 层 A 8 条与 pr-005 登记的 8 条新路由**1:1**：`cmd` 名按既有体例（`<资源> <动作>`，如既有 `calls list` / `confirmations list` / `stream events`），`method` / `path` / `args`（路径参数走位置参数）/ `flags`（query 与 body 字段走 `--<字段名>`，`_`→`-`）逐条由该路由的元数据机械推导（F17 验收 3 / L2-12）
- [x] 层 B 1 条：`router.task_cancel` 经 `UDS_CALLS` 映射到 uds 会话方法（`acceptsAs:false`，与既有 `router.status` / `router.task_get` / `router.task_list` 同列）
- [x] 逐条真集群可执行（存量 40 条 + 新增 9 条各取其入口名可被 `hub` 顶层解析）：新增的 `api principal(s) …` / `api subscribe` / `api pickup …` / `api calls wait …` / `api calls cancel …` / `api health` 全部可发出请求并按既有退出码语义返回（成功 `0` / 业务失败 `1` / 用法错误 `2` / 连接失败 `3`）（F17 验收 3）
- [x] `hub uds router.task_cancel --params '{"task_id":"<working 的 id>"}'` ⇒ 生效（`failed` + `error:'cancelled'`）；对已终态 ⇒ 上游 `TASK_ALREADY_FINAL`、退出码 `1`（F13 验收 3/5 的入口侧判据）
- [x] `hub doctor` 三段仍全 `pass`，且 **R3 探针集未扩**（仍为既有 8 个方法的存在性探测；第 9 个方法由 `router.task_cancel` 的功能验收覆盖）（N-14 / G01 验收 5）
- [x] `hub doctor` R1 仍 `pass`：层 A 条数与 `API.md` §3 行数一致（29）（与 pr-006 的同一机械锁）
- [x] `skill/hub.md`：层 A 清单 **29** 条、层 B 清单 **9** 条，与 `ENTRIES` 逐条同名同数（任一侧增删必撞另一侧）
- [x] `skill/hub.md` 的层 C 清单 11 条与 `doctor` 段落**未改**；四条红线的语义未改（不裸写 HTTP / 不复制 schema / 退出码语义 / 边界只到子命令名）
- [x] **F19 验收 1**：`skill/hub.md` 中**同时**出现 `--mode block` 与 `cli task watch` 两条现成等待路径，且各自说明适用场景（何时用哪条）
- [x] **F19 验收 2**：「序列 1」的主推路径为上述现成原语（派发 → 等待 → 取件），`calls get` + sleep 型轮询降为**兜底说明**（明确写出"轮询是兜底"）
- [x] **F19 验收 3**：本 PR 不新增任何 CLI / API 能力；文档所述与实现一致，差异一律以**实际行为**为准（权威归属 = D-14）；等待语义条文只**指向** `oamp/API.md` 的等待语义小节，不复写条文
- [x] 零新增依赖；`oamp/sdk/cli.js` / `oamp/sdk/doctor.js` 未被修改（表驱动分派的既有实现零改动）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F13-call-cancel.md`（验收 1~6）、`F17-service-metadata-discoverability.md`（验收 1~5、边界）、`F19-hub-usage-doc-fix.md`（验收 1~3）、`G01-existing-surface-preserved.md`（验收 4/5）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §3.10（入口表追加链）、§4 A-14（层 A 21→29、层 B 8→9 与 `skill/hub.md` 互锁）、§5.3（层 B 清单 8→9 的连带同步）、§6.1 Z-8、§7 L1-02（已确认）/ L2-12、§9.2 N-14、§1.3 事实 F-7 / F-8（两条现成等待原语实测已存在）
- `docs/iterations/0029-hub-client-session-and-duplex/status.md` §本迭代的体感目标（D-13）与 `deferred-demand-changes.md` DC-03（"结果不自动到手"的第一手摩擦证据，F19 的动机）
- 代码锚点：`oamp/sdk/surface.js:229-239`（`UDS_CALLS` 映射表与既有 8 条）、`oamp/sdk/surface.js:286-295`（`UDS_ENTRIES`）、`oamp/sdk/surface.js:160`（层 A 订阅条目 `stream events` 的既有形态）、`oamp/sdk/surface.js:185`（`int('wait')` = 唯一接受 `--wait` 的条目）、`oamp/sdk/surface.js:339-341`（层 C 的 `task watch`）、`oamp/skill/hub.md:52-88`（层 A/层 B/层 C 三份清单的既有文字）、`oamp/src/task.js:204`（`cmdWatch` 的既有实现）、`oamp/sdk/cli.js:18`（`DEFAULT_WAIT_MS = 1800000`）

## depends_on

- pr-001-router-status-primitives.md（理由：层 B 新条目是 `router.task_cancel` 的 1:1 封装 —— 证据：`oamp/sdk/surface.js:230-239` 的 `UDS_CALLS` 每条映射到一个 `uds.js` 会话方法（`router.task_get` → `session.taskGet` 的既有形态），`:257` 以 `UDS_CALLS[spec.method]` 调用，故新增 `router.task_cancel` 必须消费 pr-001 在 `oamp/sdk/uds.js` 新增的会话方法；`UDS_ENTRIES` 的 `method` 名与 `oamp/src/router.js:104` 的 `dispatch` 分支一一对应）
- pr-005-web-session-and-call-surface.md（理由：层 A 8 条的 `path` 字符串即 pr-005 在 `createApiRoutes` 登记的路由 —— 证据：`oamp/sdk/surface.js:60-94` 的 `runApi` 以 `spec.path` 直接构造 HTTP 请求（`target = spec.path`），路由不存在则条目全不可用；判据是 `hub doctor` R1 的"层 A 条数 ↔ `API.md` §3 行数 ↔ `/api/docs` 投影"三方一致，缺 pr-005 的行则新增条目全数失败）

## batch

3

## 验收证据

> **体例**：每条 AC = 一条可直接复制执行的命令 + 紧跟的**原样 stdout/stderr**。命令一律自带工作区（`cd $WS`）或 `git -C` 形态；**证据段零 `/tmp` 依赖、零占位符**（自检见 §14）。真集群取证只用**自建隔离集群**（socket 用相对短路径、端口 8437、独占 DB），不触碰主工作区 / 主集群进程。
> **与 PR 文件「验收证据」括注的逐项对应**：条数与分层计数 → §1；既有 40 条逐条不变比对（`git diff` 原文）→ §1；新增 9 条真集群执行输出（含退出码）→ §4；`hub uds router.task_cancel` 两条判据 → §5；`hub doctor` 三段输出 → §6；`skill/hub.md` 清单计数与「序列 1」原文 → §8 / §12；F19 两条原语出现位置的 `grep` → §10。

### §0.0 逐条 AC 结果一览（判据出处 = 本证据段的节号）

| # | 验收标准（摘要） | 结果 | 判据出处 |
|---|---|---|---|
| 1 | `ENTRIES` 恰 49（29 / 9 / 11）；既有 40 条八字段逐字不变 | **pass** | §1（差异 0 + 非注释删除行 0） |
| 2 | 层 A 8 条与 pr-005 的 8 条新路由 1:1（`method` / `path` / `args` / `flags` 机械推导） | **pass** | §2（命中 8/8 + §1 字段原文） |
| 3 | 层 B 1 条 `router.task_cancel`（`UDS_CALLS` → `uds.taskCancel`，`acceptsAs:false`） | **pass** | §3 |
| 4 | 逐条真集群可执行、按既有退出码语义返回 | **pass**（口径见 §4.1：`api pickup ack` 的退出码归类正常，业务成功路径受既有 `runApi` 无 POST→query 通道所限） | §4 |
| 5 | `router.task_cancel`：working ⇒ `failed` + `cancelled`；已终态 ⇒ `TASK_ALREADY_FINAL` + 退出码 1 | **pass** | §5 |
| 6 | `hub doctor` 三段全 `pass`，R3 探针集未扩 | **pass**（`pass:true` / `failed:[]` / R3 = 8 个既有方法） | §6 |
| 7 | `hub doctor` R1：层 A 条数 = `API.md` §3 行数（29） | **pass** | §6（R1 = 29 = 层 A 条数） |
| 8 | `skill/hub.md` 层 A 29 / 层 B 9，与 `ENTRIES` 逐条同名同数 | **pass** | §8 |
| 9 | `hub.md` 层 C 清单 11 条与 `doctor` 段落未改；四条红线语义未改 | **pass** | §7 + §9 |
| 10 | F19 验收 1：`--mode block` 与 `cli task watch` 同时在场 + 各自适用场景 | **pass** | §10 |
| 11 | F19 验收 2：主推现成原语；`calls get` + sleep 轮询降兜底并写明 | **pass** | §11 |
| 12 | F19 验收 3：零新增 CLI / API 能力；等待语义只指向 `API.md` | **pass** | §12 |
| 13 | 零新增依赖；`cli.js` / `doctor.js` 未被修改 | **pass** | §13 |

### §0 复现环境（自建隔离集群；真集群取证的唯一环境）

```bash
WS=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-007-hub-entries-and-skill-lists
cd $WS && mkdir -p .pb-agents/pr007
export OAMP_SOCKET=.pb-agents/pr007/router.sock OAMP_DB=.pb-agents/pr007/sql.db OAMP_WEB_PORT=8437
node oamp/bin/oamp.js router start           # 就绪行 ROUTER_READY
node oamp/bin/oamp.js agent start dev-1      # 角色 dev 在树内；`!` 前缀任务走 shell 分支，不触发模型调用
node oamp/bin/oamp.js web start --port 8437  # 就绪行 WEB_READY url=http://127.0.0.1:8437
```

取证明细（本机实跑，2026-09-16）与两条环境事实：

```
ROUTER_READY socket=.pb-agents/pr007/router.sock
WEB_READY url=http://127.0.0.1:8437
agent REGISTERED instance=dev-1 session=b4e95065-c036-41da-9ea3-96c224b33c72 lease_timeout_ms=30000
```

- **socket 必须用相对短路径**：macOS `sun_path` 上限 104 字节，本 worktree 绝对路径已 151 字节（绝对路径 socket 会 `ENAMETOOLONG`）⇒ `OAMP_SOCKET` 以相对路径给出，全部取证命令都在 `$WS` 下执行（两侧解析一致）。
- 运行态（socket / DB）与被忽略的临时文件都落在工作区内 `.pb-agents/`（`.gitignore` 第 2 行 `.pb-agents/`）⇒ `git status --short` 保持干净（§13）。
- 取证完成后逐个停止（`Stopped pr007-web` / `pr007-agent` / `pr007-router`）；**未触碰主工作区与主集群进程**。

### §1 AC1：`ENTRIES` 恰 49 条（29 / 9 / 11）+ 既有 40 条八字段逐字不变 + 新增 9 条字段原文 + 删除行全为注释计数行

```bash
cd $WS && node --input-type=module <<'NODE'
import { ENTRIES } from './oamp/sdk/surface.js';
const L = (l) => ENTRIES.filter((e) => e.layer === l);
console.log('总数', ENTRIES.length, '｜ 层 A', L('api').length, '｜ 层 B', L('uds').length, '｜ 层 C', L('cli').length);
const brief = (e) => JSON.stringify({ id: e.id, cmd: e.cmd, method: e.method, path: e.path, args: e.args.map((a) => `${a.name}${a.required ? '!' : ''}`), flags: e.flags.map((f) => `${f.name}${f.kind === 'string' ? '' : `:${f.kind}`}${f.required ? '!' : ''}`), kind: e.kind });
for (const e of L('api').slice(21)) console.log('新增层A', brief(e));
for (const e of L('uds').slice(8)) console.log('新增层B', JSON.stringify({ id: e.id, method: e.method, acceptsAs: e.acceptsAs }));
NODE
```

```
总数 49 ｜ 层 A 29 ｜ 层 B 9 ｜ 层 C 11
新增层A {"id":"api.subscribe","cmd":["subscribe"],"method":"GET","path":"/api/subscribe","args":[],"flags":["principal!","epoch","kinds","agents"],"kind":"stream"}
新增层A {"id":"api.pickup list","cmd":["pickup","list"],"method":"GET","path":"/api/pickup","args":[],"flags":["principal!","epoch"],"kind":"result"}
新增层A {"id":"api.pickup ack","cmd":["pickup","ack"],"method":"POST","path":"/api/pickup/:call_id/ack","args":["call_id!"],"flags":["principal!","epoch"],"kind":"result"}
新增层A {"id":"api.calls wait","cmd":["calls","wait"],"method":"GET","path":"/api/calls/wait","args":[],"flags":["ids!","timeout-ms:int"],"kind":"result"}
新增层A {"id":"api.calls cancel","cmd":["calls","cancel"],"method":"POST","path":"/api/calls/:call_id/cancel","args":["call_id!"],"flags":[],"kind":"result"}
新增层A {"id":"api.health","cmd":["health"],"method":"GET","path":"/api/health","args":[],"flags":[],"kind":"result"}
新增层A {"id":"api.principals create","cmd":["principals","create"],"method":"POST","path":"/api/principals","args":[],"flags":["principal-id!","kind","instance-id"],"kind":"result"}
新增层A {"id":"api.principals get","cmd":["principals","get"],"method":"GET","path":"/api/principals/:principal_id","args":["principal_id!"],"flags":[],"kind":"result"}
新增层B {"id":"uds.router.task_cancel","method":"router.task_cancel","acceptsAs":false}
```

**既有 40 条八字段逐字比对**（取 base `22f6859` 的同一模块做同名比对；临时文件在工作区内、命令末尾删除）：

```bash
cd $WS && git show 22f6859:oamp/sdk/surface.js > oamp/sdk/.surface-base.tmp.mjs && node --input-type=module 2>/dev/null <<'NODE'
import { ENTRIES as HEAD } from './oamp/sdk/surface.js';
import { ENTRIES as BASE } from './oamp/sdk/.surface-base.tmp.mjs';
const FIELDS = ['id', 'cmd', 'args', 'flags', 'kind', 'method', 'path', 'acceptsAs'];
const pick = (e) => Object.fromEntries(FIELDS.map((f) => [f, e[f]]));
const baseIds = new Set(BASE.map((e) => e.id));
const kept = HEAD.filter((e) => baseIds.has(e.id)); // 剔除新增 9 条后，既有 40 条的原序子序列
let diff = 0;
for (let i = 0; i < BASE.length; i += 1) if (JSON.stringify(pick(BASE[i])) !== JSON.stringify(pick(kept[i]))) diff += 1;
console.log(`base ${BASE.length} 条 × ${FIELDS.length} 字段 ↔ HEAD 中同名 ${kept.length} 条（保持原序）→ 差异 ${diff}`);
console.log(`条数：base ${BASE.length} → HEAD ${HEAD.length}（新增 ${JSON.stringify(HEAD.filter((e) => !baseIds.has(e.id)).map((e) => e.id))}）`);
NODE
rm oamp/sdk/.surface-base.tmp.mjs
```

```
base 40 条 × 8 字段 ↔ HEAD 中同名 40 条（保持原序）→ 差异 0
条数：base 40 → HEAD 49（新增 ["api.subscribe","api.pickup list","api.pickup ack","api.calls wait","api.calls cancel","api.health","api.principals create","api.principals get","uds.router.task_cancel"]）
```

**`git diff` 原文**（相对 base；删除行**全部**是注释计数行，非注释删除行 = 0 ⇒ 既有 40 条的声明行逐字未动）：

```bash
cd $WS && git diff 22f6859 -U0 -- oamp/sdk/surface.js | grep -E '^-[^-]'
git diff 22f6859 -U0 -- oamp/sdk/surface.js | grep -E '^-[^-]' | grep -vcE '^-\s*(//|/\*)'
git diff --numstat 22f6859 -- oamp/sdk/surface.js
node --check oamp/sdk/surface.js; echo "node --check exit=$?"
```

```
-// 名面逐字锁定（A14）：40 条 `cmd` = `oamp/skill/hub.md` 的三层清单（层 A 21 / 层 B 8 / 层 C 11），
-// 分层与 doctor（P-4）：`doctor` 是第四顶层入口，不属于三层封装，不在 `ENTRIES` 的 40 条内
-// ────────────────────────────── 层 A：21 条（`hub api …` ↔ `API.md` §3 的 21 行）──────────────────────────────
-// 规则（§5.1）：路径参数 → 位置参数；query / body 字段 → `--<字段名>`；订阅 4 条 `kind: 'stream'`；
-//   17 条 `kind: 'result'`。必填性 = 入口表声明（§5.1 规则 4 的本地校验面，判据见 T1 验收 6）。
-/** 层 A 条目构造（`run` 由同一工厂产出 ⇒ 21 条的行为只写一处）。 */
-// ────────────────────────────── 层 B：8 条（`hub uds …` ↔ Router 的 8 个方法）──────────────────────────────
-/** 三层入口表（恰 40 条；顺序 = 层 A 的 `API.md` §3 行序 ‖ 层 B 表序 ‖ 层 C 表序）。 */
0
69	8	oamp/sdk/surface.js
node --check exit=0
```

### §2 AC2：层 A 8 条与 pr-005 登记的 8 条新路由 1:1（`method` + `path` 逐条命中运行侧登记）

```bash
cd $WS && git show 22f6859:oamp/sdk/surface.js > oamp/sdk/.surface-base.tmp.mjs && node --input-type=module 2>/dev/null <<'NODE'
import { ENTRIES } from './oamp/sdk/surface.js';
import { createApiRoutes } from './oamp/src/web.js';
const routes = createApiRoutes({}).map((r) => `${r.method} ${r.path}`);
const news = ENTRIES.filter((e) => e.layer === 'api').slice(21);
const miss = news.filter((e) => !routes.includes(`${e.method} ${e.path}`));
console.log(`运行侧登记路由 ${routes.length} 条 ｜ 新增层 A ${news.length} 条 → 命中 ${news.length - miss.length}/${news.length}`);
console.log('未命中 =', JSON.stringify(miss.map((e) => `${e.method} ${e.path}`)));
NODE
rm oamp/sdk/.surface-base.tmp.mjs
```

```
运行侧登记路由 29 条 ｜ 新增层 A 8 条 → 命中 8/8
未命中 = []
```

**命名体例与字段推导面**（`cmd` = 既有 `<资源> <动作>` 体例；路径参数 → 位置参数；query / body 字段 → `--<字段名>`（`_` → `-`）；见 §1 的 9 行字段原文）——`hub --help` 的同源投影：

```bash
cd $WS && node oamp/bin/hub.js --help | grep -E '层 |api (subscribe|pickup|principals|health|calls wait|calls cancel)|uds router.task_cancel'
```

```
层 A · api（29 条）
  hub api subscribe [--principal] [--epoch] [--kinds] [--agents]
  hub api pickup list [--principal] [--epoch]
  hub api pickup ack <call_id> [--principal] [--epoch]
  hub api calls wait [--ids] [--timeout-ms]
  hub api calls cancel <call_id>
  hub api health
  hub api principals create [--principal-id] [--kind] [--instance-id]
  hub api principals get <principal_id>
层 B · uds（9 条）
  hub uds router.task_cancel
层 C · cli（11 条）
```

### §3 AC3：层 B 1 条 `router.task_cancel`（经 `UDS_CALLS` 映射、`acceptsAs:false`，与 `router.*` 同列）

```bash
cd $WS && sed -n '286,300p' oamp/sdk/surface.js && sed -n '345,357p' oamp/sdk/surface.js
```

```
const UDS_CALLS = {
  'agent.register': (session, params) => session.register(params.instance_id),
  'agent.heartbeat': (session, params) => session.heartbeat(params),
  'agent.deregister': (session) => session.deregister(),
  'message.send': (session, params) => session.send(params),
  'message.ack': (session, params) => session.ack(params),
  'router.status': (session) => session.status(),
  'router.task_get': (session, params) => session.taskGet(params.task_id),
  'router.task_list': (session, params) => session.taskList(params),
  // 0029（pr-007；§5.3「层 B 清单 8 → 9 的连带同步」）：pr-001 追加的 Router 方法（与既有 `router.task_get`
  //   同体例 —— 1:1 包一个 uds.js 会话方法，`--params` 的 `task_id` 原样进方法参数）。
  'router.task_cancel': (session, params) => session.taskCancel(params.task_id),
};
```

```bash
cd $WS && grep -n "udsEntry({ method: 'router" oamp/sdk/surface.js && grep -n "taskCancel" oamp/sdk/uds.js
```

```
350:  udsEntry({ method: 'router.status', acceptsAs: false }), // 任意连接可用
351:  udsEntry({ method: 'router.task_get', acceptsAs: false }),
352:  udsEntry({ method: 'router.task_list', acceptsAs: false }),
354:  // 0029（pr-007）：与既有 `router.*` 三条同列（`acceptsAs: false` —— 任意连接可用，无身份合成）
355:  udsEntry({ method: 'router.task_cancel', acceptsAs: false }),
172:    taskCancel(taskId) {
```

### §4 AC4：逐条真集群可执行（新增 9 条入口 + 存量抽查；含退出码）

前置：§0 集群在跑；`hub` 命令的工作目录 = `$WS`（§0 的 `cd` 与 `export` 已生效）。

```bash
cd $WS && CH=$(curl -s -X POST http://127.0.0.1:8437/api/messages -H 'content-type: application/json' -d '{"project_id":"prj-9cbfd831-98a9-49ec-8c67-95adf3f7618f","agent_id":"dev-1","text":"!true"}' | jq -r '.chat_id')
run() { echo "\$ $*"; "$@"; echo "exit=$?"; }
run node oamp/bin/hub.js api health
run node oamp/bin/hub.js api principals create --principal-id pr007-cli --kind agent --instance-id pr007-cli
run node oamp/bin/hub.js api principals get pr007-cli
run node oamp/bin/hub.js api pickup list --principal pr007-cli
run node oamp/bin/hub.js api calls wait --ids task-nope-0001
run node oamp/bin/hub.js api calls cancel task-nope-0001
```

```
$ node oamp/bin/hub.js api health
{"router":{"ok":true,"detail":"ok","generation":"af92e784-9e3d-440f-95a6-2639cedd6e89"},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{"online":2,"reconnecting":0,"offline":1,"total":3},"callable":true,"epoch":"a75b64d1-64d3-40f9-9de8-c5b72ac2e05f.af92e784-9e3d-440f-95a6-2639cedd6e89"}
exit=0
$ node oamp/bin/hub.js api principals create --principal-id pr007-cli --kind agent --instance-id pr007-cli
{"principal":{"principal_id":"pr007-cli","kind":"agent","instance_id":"pr007-cli","created_at":1789574891972,"last_seen_at":1789574891972},"epoch":"a75b64d1-64d3-40f9-9de8-c5b72ac2e05f.af92e784-9e3d-440f-95a6-2639cedd6e89"}
exit=0
$ node oamp/bin/hub.js api principals get pr007-cli
{"principal":{"principal_id":"pr007-cli","kind":"agent","instance_id":"pr007-cli","created_at":1789574891972,"last_seen_at":1789574892039},"epoch":"a75b64d1-64d3-40f9-9de8-c5b72ac2e05f.af92e784-9e3d-440f-95a6-2639cedd6e89"}
exit=0
$ node oamp/bin/hub.js api pickup list --principal pr007-cli
{"pickup":[]}
exit=0
$ node oamp/bin/hub.js api calls wait --ids task-nope-0001
{"timed_out":false,"timeout_ms":null,"results":[],"unresolved":[{"call_id":"task-nope-0001","state":null}]}
exit=0
$ node oamp/bin/hub.js api calls cancel task-nope-0001
{"code":"NOT_FOUND","error":"call 不存在: task-nope-0001","exit_code":1,"http_status":404}
exit=1
```

**流式条目 `api subscribe`**（订阅建立后才推送 ⇒ 用并发触发器制造一个 `agent_state` 事件，`head -1` 取首帧后走既有 EPIPE 收尾路径）：

```bash
cd $WS && bash -c '( sleep 2; node oamp/bin/oamp.js agent start dev-2 > /dev/null 2>&1 & sleep 5; pkill -f "oamp/bin/oamp.js agent start dev-2" ) & node oamp/bin/hub.js api subscribe --principal pr007-cli | head -1; echo "hub_code=${PIPESTATUS[0]}"'
```

```
{"event":"agent_state","data":{"instance_id":"dev-2","connected":true,"busy":false,"current_call_id":null,"queued":0,"since":null}}
hub_code=0
```

**存量 40 条的抽查**（同一分派面仍可用；`cli status` 为层 C 透传）：

```bash
cd $WS && node oamp/bin/hub.js api docs | jq -c '{routes:(.routes|length)}'; echo "exit=$?"
node oamp/bin/hub.js api calls list > /dev/null; echo "api calls list exit=$?"
node oamp/bin/hub.js uds router.status | jq -c '[.nodes[].instance_id]'; echo "exit=$?"
node oamp/bin/hub.js cli status; echo "exit=$?"
```

```
{"routes":29}
exit=0
api calls list exit=0
["dev-1","dev-2","probe-pr007","web"]
exit=0
instance_id  session_id                            state    last_heartbeat
dev-1        b4e95065-c036-41da-9ea3-96c224b33c72  online   2026-09-16T16:09:24.371Z
dev-2        214b8ddc-9952-4531-8d20-c782339f1d45  online   2026-09-16T16:09:51.745Z
probe-pr007  da930387-837a-4434-b50e-87336995cf8a  offline  2026-09-16T16:06:44.343Z
web          2dcebc78-9377-4898-a63a-ec3b11756743  online   2026-09-16T16:10:06.579Z
exit=0
```

#### §4.1 已知跨 PR 缺口（`api pickup ack` 的 query 通道）——**需主 agent 裁决**

`POST /api/pickup/:call_id/ack`（登记形态）的两个字段 `principal` / `epoch` 在登记里都是 `in: 'query'`，而既有 `runApi`（`oamp/sdk/surface.js:78-88`）**只在 `spec.method === 'GET'` 时把 query 随请求发出**（非 GET 的 `flags` 一律进 `body`）。⇒ 按 AC2 的机械规则（query 字段 → `--<字段名>` 标志）落地的 `api pickup ack` 条目，其请求落在"无 query"形态上，被服务端以 `400 INVALID_PARAM` 拒绝（**入口名解析、请求发出、退出码归类都正常**；不可达的只是该端点的业务成功路径）。本 PR 按 AC1 / AC2 的字面契约落地（追加式 diff），**未擅自改** `runApi`（那属超出文件面描述的请求构造逻辑改动）。最小修复选项：`runApi` 的 `query:` 条件去掉 `spec.method === 'GET'`（1 行；对既有 40 条等价 —— 既有 POST 条目均无 query 字段）。

```bash
cd $WS && node oamp/bin/hub.js api pickup ack task-nope-0001 --principal pr007-cli; echo "exit=$?"
curl -s -w '\nHTTP %{http_code}\n' -X POST 'http://127.0.0.1:8437/api/pickup/task-nope-0001/ack?principal=pr007-cli'
curl -s -w '\nHTTP %{http_code}\n' -X POST 'http://127.0.0.1:8437/api/pickup/task-nope-0001/ack' -H 'content-type: application/json' -d '{"principal":"pr007-cli"}'
```

```
{"code":"INVALID_PARAM","error":"需要合法 principal","exit_code":1,"http_status":400}
exit=1
{"call_id":"task-nope-0001","acked":true}
HTTP 200
{"error":"需要合法 principal","code":"INVALID_PARAM"}
HTTP 400
```

### §5 AC5：`hub uds router.task_cancel` 两条判据（working ⇒ `failed` + `cancelled`；已终态 ⇒ `TASK_ALREADY_FINAL` + 退出码 1）

车辆：`!sleep 45`（shell 分支，不触发模型调用）⇒ 任务处于 `working` 时取消。

```bash
cd $WS && CH=chat-b6027b50-c200-4635-8baa-517033766c14
CALL=$(curl -s -X POST http://127.0.0.1:8437/api/messages -H 'content-type: application/json' -d "{\"chat_id\":\"$CH\",\"agent_id\":\"dev-1\",\"text\":\"!sleep 45\"}" | jq -r '.task_id')
echo "CALL=$CALL"
node oamp/bin/hub.js uds router.task_get --params "{\"task_id\":\"$CALL\"}" | jq -c '.task.state'
node oamp/bin/hub.js uds router.task_cancel --params "{\"task_id\":\"$CALL\"}" | jq -c '{state:.task.state, error:.task.result.error}'; echo "exit=$?"
node oamp/bin/hub.js api calls get "$CALL" | jq -c '{state,error}'
node oamp/bin/hub.js uds router.task_cancel --params "{\"task_id\":\"$CALL\"}"; echo "exit=$?"
node oamp/bin/hub.js api calls get "$CALL" | jq -c '{state,error}'
```

```
CALL=task-d9abff82-9515-4cfb-ba48-ee366766d2ff
"working"
{"state":"failed","error":"cancelled"}
exit=0
{"state":"failed","error":"cancelled"}
{"code":"TASK_ALREADY_FINAL","error":"task_cancel: task already final","exit_code":1}
exit=1
{"state":"failed","error":"cancelled"}
```

要点：取消**当刻**即可经调用面看到终态（`calls get` = `failed` / `cancelled`，F13 验收 3）；第二次取消**不改写**已定终态（逐字相同，F13 验收 5）；不存在 id ⇒ `TASK_NOT_FOUND`、退出码 `1`。

### §6 AC6 + AC7：`hub doctor` 三段全 `pass`、R3 探针集未扩（仍 8 个）、R1 层 A 条数 = `API.md` §3 行数（29）

```bash
cd $WS && node oamp/bin/hub.js doctor > .pb-agents/pr007/doctor.json; echo "doctor exit=$?"
jq -c '{pass, total:(.items|length), R1:([.items[]|select(.id|startswith("R1"))]|length), R2:([.items[]|select(.id|startswith("R2"))]|length), R3:([.items[]|select(.id|startswith("R3"))]|length), failed:[.items[]|select(.ok==false)]}' .pb-agents/pr007/doctor.json
jq -r '[.items[]|select(.id|startswith("R3"))|.id] | join(", ")' .pb-agents/pr007/doctor.json
jq -r '.items[]|select(.id|startswith("R3") and (.id|test("task_cancel")))' .pb-agents/pr007/doctor.json
node --input-type=module -e "import {ENTRIES} from './oamp/sdk/surface.js'; console.log('层 A 条数 =', ENTRIES.filter((e)=>e.layer==='api').length)"
grep -cE '^\| [0-9]+ \| `(GET|POST) /api/' oamp/API.md
```

```
doctor exit=0
{"pass":true,"total":66,"R1":29,"R2":29,"R3":8,"failed":[]}
R3 agent.register, R3 agent.heartbeat, R3 agent.deregister, R3 message.send, R3 message.ack, R3 router.status, R3 router.task_get, R3 router.task_list
层 A 条数 = 29
29
```

要点：`failed` = `[]`（三段无 `ok:false`，R1 无 `文档未覆盖` / `登记缺失`）；R3 条目集合 = **既有 8 个方法**，**不含** `router.task_cancel`（第 2 条 `jq` 输出为空；N-14 的探针集不扩，第 9 个方法由 §5 的功能验收覆盖）；R1 = 29 = 层 A 条数 = `API.md` §3 表行数（同一机械锁，pr-006 写入面）。

**8 条新路由在三段中的逐条投影**（R1 逐条在场；R2 对新增非流式 GET 自动扩展、流式与 POST 按既有"不探"口径记 `skipped`）：

```bash
cd $WS && jq -r '.items[]|select(.id|test("subscribe|pickup|wait|/cancel|health|principals"))|"\(.id) ok=\(.ok) skipped=\(.skipped//false)"' .pb-agents/pr007/doctor.json
```

```
R1 GET /api/subscribe ok=true skipped=false
R1 GET /api/pickup ok=true skipped=false
R1 POST /api/pickup/:/ack ok=true skipped=false
R1 GET /api/calls/wait ok=true skipped=false
R1 POST /api/calls/:/cancel ok=true skipped=false
R1 GET /api/health ok=true skipped=false
R1 POST /api/principals ok=true skipped=false
R1 GET /api/principals/: ok=true skipped=false
R2 POST /api/principals ok=true skipped=true
R2 GET /api/principals/:principal_id ok=true skipped=false
R2 GET /api/health ok=true skipped=false
R2 GET /api/subscribe ok=true skipped=true
R2 GET /api/pickup ok=true skipped=false
R2 GET /api/calls/wait ok=true skipped=false
R2 POST /api/calls/:call_id/cancel ok=true skipped=true
R2 POST /api/pickup/:call_id/ack ok=true skipped=true
```

### §7 AC9（第一半）：`hub.md` 层 C 清单 11 条与 `doctor` 段落未改

见 §9 的 `hub.md` diff 原文（删除行只有层 A / 层 B 计数行与序列 1 段；层 C 清单、`doctor` 段落区段**零删除行**）：

```bash
cd $WS && git diff 22f6859 -U0 -- oamp/skill/hub.md | grep -E '^-[^-]' | grep -cE 'cli |doctor|不裸写 HTTP|不复制 schema|退出码语义|边界只到'
```

```
0
```

### §8 AC8：`skill/hub.md` 层 A 29 / 层 B 9，与 `ENTRIES` 逐条同名同数

```bash
cd $WS && grep -nE '^### 层 [ABC]' oamp/skill/hub.md
for p in 'api ' 'uds ' 'cli '; do printf '%s' "$p"; grep -c "^- \`$p" oamp/skill/hub.md; done
node --input-type=module 2>/dev/null <<'NODE'
import fs from 'node:fs';
import { ENTRIES } from './oamp/sdk/surface.js';
const grab = (layer) => fs.readFileSync('./oamp/skill/hub.md', 'utf8').split('\n').map((l) => /^- `(api|uds|cli) (.+)`$/.exec(l)).filter((m) => m && m[1] === layer).map((m) => `${layer} ${m[2]}`);
for (const [layer, cn] of [['api', '层 A'], ['uds', '层 B'], ['cli', '层 C']]) {
  const table = ENTRIES.filter((e) => e.layer === layer).map((e) => `${layer} ${e.cmd.join(' ')}`);
  const doc = grab(layer);
  console.log(`${cn}：hub.md 清单 ${doc.length} 条 ↔ ENTRIES ${table.length} 条 → 逐条同序同名 = ${JSON.stringify(doc) === JSON.stringify(table)}`);
}
NODE
```

```
37:### 层 A · api（29 条）
71:### 层 B · uds（9 条）
85:### 层 C · cli（11 条）
api 29
uds 9
cli 11
层 A：hub.md 清单 29 条 ↔ ENTRIES 29 条 → 逐条同序同名 = true
层 B：hub.md 清单 9 条 ↔ ENTRIES 9 条 → 逐条同序同名 = true
层 C：hub.md 清单 11 条 ↔ ENTRIES 11 条 → 逐条同序同名 = true
```

### §9 `hub.md` 的 `git diff` 原文（AC8 / AC9 的机械面）

```bash
cd $WS && git diff 22f6859 -U0 -- oamp/skill/hub.md | grep -E '^-[^-]'
git diff --numstat 22f6859 -- oamp/skill/hub.md
```

```
-### 层 A · api（21 条）
-层 A 走 Web 开放接口面（HTTP / SSE），共 21 条：
-### 层 B · uds（8 条）
-层 B 走 Router 的 UDS 面（JSON-RPC），共 8 条：
-### 序列 1：派发 → 取终态
-2. 取终态：`node "<项目根>/oamp/bin/hub.js" api calls get <call_id>`，读该调用的终态信封。
21	6	oamp/skill/hub.md
```

### §10 AC10（F19 验收 1）：`--mode block` 与 `cli task watch` 同时在场，且各自说明适用场景

```bash
cd $WS && grep -n -- '--mode block' oamp/skill/hub.md
grep -n 'cli task watch' oamp/skill/hub.md
```

```
109:   - `api calls create --mode block`：**派发与等待合成一步**，本次就等到底，回来时要么带结论、要么明确告诉你没结论。**何时用它**：派发时就确定"我要的正是这次的结果"，且愿意用一条连接等下去。
110:   - `cli task watch <task_id>`：**已派发之后的盯进度 / 补看**，逐条打印进展、到终态收尾退出。**何时用它**：手上已经有 `task_id`（派发时选了后台形态，或这次调用是别处派发的），或想在终端里边跑边看。
```

### §11 AC11（F19 验收 2）：主推路径 = 现成原语；轮询降兜底并写明"轮询是兜底"

```bash
cd $WS && grep -n '轮询' oamp/skill/hub.md
```

```
108:2. 等待：**用现成的等待原语，不要自己拼轮询**。两条路径按其适用场景择一：
114:兜底（仅在上述现成原语都用不上时才用）：`api calls get <call_id>` 配 `sleep` 型定期查询——**轮询是兜底，不是主推路径**，且它拿到的"还没结果"不等于失败判据。
```

### §12 AC12（F19 验收 3）+ 「序列 1」原文：等待语义只**指向** `API.md`，不复写条文

```bash
cd $WS && sed -n '105,114p' oamp/skill/hub.md
```

```
### 序列 1：派发 → 等待 → 取件

1. 派发：`node "<项目根>/oamp/bin/hub.js" api calls create`，拿到这次调用的 `call_id`。
2. 等待：**用现成的等待原语，不要自己拼轮询**。两条路径按其适用场景择一：
   - `api calls create --mode block`：**派发与等待合成一步**，本次就等到底，回来时要么带结论、要么明确告诉你没结论。**何时用它**：派发时就确定"我要的正是这次的结果"，且愿意用一条连接等下去。
   - `cli task watch <task_id>`：**已派发之后的盯进度 / 补看**，逐条打印进展、到终态收尾退出。**何时用它**：手上已经有 `task_id`（派发时选了后台形态，或这次调用是别处派发的），或想在终端里边跑边看。
   两条路径的退出条件是同一个：**结论产生**，不是"时间到了"。等待语义（退出条件、超时只表示放弃等待、客户端等待预算的口径）以 `oamp/API.md` 的「等待语义」小节为**唯一真源**，本文件不复述、不改写。
3. 取件：`node "<项目根>/oamp/bin/hub.js" api pickup list` 拿回自己尚未取件的终态结果（含完整信封），`api pickup ack <call_id>` 确认取走后从清单里划掉——**离线期间跑完的调用，结论不会丢**。

兜底（仅在上述现成原语都用不上时才用）：`api calls get <call_id>` 配 `sleep` 型定期查询——**轮询是兜底，不是主推路径**，且它拿到的"还没结果"不等于失败判据。
```

本 PR 零新增 CLI / API 能力：能力面 diff 见 §13（`surface.js` 只追加 9 条入口、`hub.md` 只改清单与表述）：

```bash
cd $WS && git diff --name-only 22f6859
```

```
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-007-hub-entries-and-skill-lists-tasks.md
oamp/sdk/surface.js
oamp/skill/hub.md
```

### §13 AC13 + 「不触碰」清单：零新增依赖、零越界改动

```bash
cd $WS && git diff --stat 22f6859 -- oamp/sdk/cli.js oamp/sdk/doctor.js oamp/sdk/http.js oamp/sdk/uds.js oamp/API.md oamp/llms.txt oamp/package.json oamp/README.md oamp/src oamp/web; echo "（以上为空 = 零改动）"
git status --short; echo "（以上为空 = 工作区干净）"
```

```
（以上为空 = 零改动）
（以上为空 = 工作区干净）
```

### §14 证据段自检（无临时目录依赖、无自造占位符）

两种口径各跑一次：① 全文件（含七字段、引用块、本节命令行自身）；② 排除代码块（只扫代码块以外的文本）。

```bash
cd $WS && P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-007-hub-entries-and-skill-lists.md
echo "全文件命中行数=$(grep -E '/tmp/|<[a-z_]+>' $P | wc -l | tr -d ' ')"
echo "非引用区命中行数=$(awk '/^```/{f=!f;next} !f' $P | grep -cE '/tmp/|<[a-z_]+>')"
echo "临时目录前缀命中行数=$(grep -cE '/tmp/' $P)"
echo "非引用区临时目录前缀命中行数=$(awk '/^```/{f=!f;next} !f' $P | grep -cE '/tmp/')"
```

原样输出（本段只贴读数、不贴命令行回显 ⇒ 读数自身不含任何模式串，重跑读数是不动点）：

```
全文件命中行数=13
非引用区命中行数=0
临时目录前缀命中行数=4
非引用区临时目录前缀命中行数=0
```

读数解释：

1. **全文件的命中全部是引用内容**：§4 的 `hub --help` 投影、§9 / §12 的 `oamp/skill/hub.md` 原文（该文件体例本身就用尖括号写法表达位置参数：项目根路径 / `task_id` / `call_id`），以及本节自检命令行自身（模式串自匹配，含临时目录前缀那一串）。
2. **排除代码块后为零**（第二、四行读数）：本 PR 自写的散文与命令不含尖括号占位符、不引入临时目录依赖 —— 全部真集群取证命令都用工作区相对短 socket 路径 + `curl` / `node` / `git` 仓内形态（§0）。
