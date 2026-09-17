# pr-006-tasks.md — pr-006 内部任务列表（文档面同步：`API.md` / `README.md` / `llms.txt` / `skill/hub.md`）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-006-api-docs-sync.md`（5 条验收标准）
**PR worktree（绝对路径，唯一文档写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-006-api-docs-sync`
**PR worktree 分支**: `feat/0030-pr-006-api-docs-sync`（落盘时 HEAD = `9a4f424` = 迭代分支 tip；`git status --short` 为空；四个目标文档与迭代工作区**逐字节相同** ⇒ 无既有未落地改动）
**任务总数**: **9**（T1~T9）｜ **依赖图**: **无环**（见 §2）｜ **关键路径**: `T1 → T7 → T9`（3 节点）
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（5 条 AC）+ `architecture.md`（§4 A-01/A-02/A-03/A-04/A-05/A-07/A-09、§5 变更面与「文档面机械锁提示」、§6 零影响声明、§9-6~§9-10、§10-8/§10-12）+ `prd/F03/F04/F05/F07` 相关验收项 + **实现态实读与实跑**（§0.3，逐条带 `文件:行号` / 原始输出）

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（唯一，逐字取自 PR 文件「文件范围」）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/API.md` | 修改 | ① §3.19 字段表追加 `reason` 行 + 键集合句按失败侧改写（**T1**）；② §4.4 `call_result` 行标注失败侧 `reason`（**T1**）；③ §3.14 参数表加项级 `new_session` 行 + `tasks` 项形状补 `new_session?`（**T2**）；④ §3.12 / §3.13 取件两端点：写入时机 / 跨重启 / `acked` 恒 `false` / 缺省身份 / ack 语义（**T3**） |
| 2 | `oamp/README.md` | 修改 | ① 第 222 行的超时口径句（**T4**）；② 环境变量表：新增 `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS` 两行 + 修正 `OAMP_WEB_RECONCILE_TTL_MS` 默认值行（**T5**） |
| 3 | `oamp/llms.txt` | 生成物重生成（**期望零 diff**） | 由 `node oamp/scripts/gen-llms-txt.mjs` 决定内容，不得手改（**T6**） |
| 4 | `oamp/skill/hub.md` | 修改 | 序列 1 的取件步（**T8**） |

> `pr-006-api-docs-sync-tasks.md`（本文件）是阶段 5 增量产物，**不计入** PR 的改动面。
> 取证产物一律落 `/tmp/0030-pr-006/`，**不入库**（§4）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/src/**`（**全仓 26 个 `src/*.js` 一个都不动**，含 `web.js` 的 `reason`/`new_session`/取件接线、`persist.js`、`reason.js`、`pool-routing.js`、`config.js`、`context-pool.js`、三客户端）、`oamp/sdk/**`、`oamp/scripts/**`、`oamp/web/**`、`oamp/bin/**`、`oamp/package.json`、`cluster.json`、`roles/**`、`tools/**`、`tests/**`、`docs/**`（本文件与阶段产物除外）。
  追溯：PR 文件「文件范围」（仅四文档）+ architecture §5「明确不改（零改动）」列。
- **不新增**：任何 HTTP 路由（既有 **29 条**不变，实测 `projectRoutes(createApiRoutes({}))` = 29）、任何协议方法、任何配置键 / env 键、任何依赖、任何仓库内文件 / 测试文件。
- **不改既有文案语义**：`API.md` §3 清单表的 `| n | \`METHOD /api/...\` |` 行（doctor R1 的文档侧真源）、既有 400/404 文案原文、既有 10 键的键名与键序、取件响应键集与键序、`/api/docs` 的既有 `params[].desc`（**属 `web.js` ⇒ 本 PR 不可写**）。
- **不做（属其他 PR）**：实现侧任何改动（pr-001~pr-005 已合并）；G01 零回归证据文档（pr-008）。
- **做错的形态（明确排除，每条都有上游依据）**：
  1. 手改 `oamp/llms.txt` 的任何一行 —— 它是 `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 的生成快照（architecture §5「`llms.txt` 由脚本重生成」）；手改会立刻与生成器脱钩（C8 判据会 FAIL）。
  2. 为 `reason` 发明第六个取值 / 加子枚举 / 分层原因码 —— F04 边界与 D-29 明文禁止；`reason.js` 的取值集合只有五值（`reason.js:7-16/34/44`）。
  3. 把 `reason` 写成"失败与成功都有"或"可空" —— 实现是 `state === 'failed'` 才追加（`web.js:559`），成功 / 受理侧**无该键**（F04 MI-4、architecture §9-9）。
  4. 把 `reason` 写成独立于信封的第二份数据源（如"另有一张表 / 另一个字段"）—— 它只存在于 `composeCallEnvelope` 的产物与 `inbox.envelope` 的 JSON 内（A-03「不单列一列」）。
  5. 把 `new_session` 写成"必填 / 有 CLI flag / 有 400 校验" —— 实现为项级可选、仅 `=== true` 生效、无校验分支（`web.js:1394`），且 `oamp/sdk/surface.js` 的 `calls create` flag 白名单**硬编码且无 `--new-session`**、本迭代 `sdk/**` 零改动（architecture §9-7、§10-12 ⑤）。
  6. 把取件面写成"正文现算 / 重启即丢 / Router 不可达即 502" —— 现实现直读 `inbox` 表（`web.js:1654` `db.listInbox`），Router 不可达时取件仍 **200**（已登记的**预期差异 ②**）。
  7. 在 `API.md` 里新增 / 删除 / 改写 §3 清单表的路由行（含"顺手"补一条）—— 会直接打破 `hub doctor` R1 的双向比对（§4.2 反例门已实测：插一条假行 ⇒ `pass:false`）。
  8. 把 README 里 shell 的 `timeout_ms`（默认 30000、上限 1800000）一并改掉 —— 那是**命令硬上限**语义，A-05 生效位置清单第 7 条明确**保留**。
  9. 把 README 中"显式 `timeout_ms` 上限 1800s"删掉 —— `agent.js:31 MAX_TIMEOUT_MS = 1800000` **保留**（只约束显式值），A-05 第 5 条。
  10. 在 `skill/hub.md` 里复述字段表 / 抄一份 `new_session` 说明 —— AC4 明文"不复述字段"；该文件的红线 2 就是"不复制 schema"。
  11. 顺手改 `API.md` §2.4 等待语义（第 163~164 行的 `timeout_ms` / 客户端 30 分钟预算）—— A-05 第 8 条明确**不改**客户端等待预算；§2.4 是等待语义唯一真源，本 PR 不动。

### 0.3 读码 + 实跑事实锚点（2026-09-17，PR worktree HEAD `9a4f424`；「实跑」= `/tmp` 副本上的真实执行，非推断）

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **A1** | 实现信封恰 **10 键**、键序 `call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code`；`state === 'failed'` 时**末位追加** `envelope.reason = reasonOf(state, envelope.error)` | `oamp/src/web.js:539-560`（`:559` 为追加行） |
| **A2** | `reason.js` 的取值集合恰五值：`cancelled_by_client` / `rejected` / `timeout` / `infra_error` / `agent_error`（含前缀规则 `timeout_after_…ms` → `timeout`、`spawn_failed:` / `spawn_error:` → `infra_error`，兜底 `agent_error`） | `oamp/src/reason.js:7-16 / 18-22 / 28-46` |
| **A3** | `new_session` 解析：项模板 `newSession: false`，仅 `raw.new_session === true` 置真（**无 400 分支**）；消费点 `pickInstance(role, { chatId, noReuse: item.newSession === true, snapshot })`；**单任务形态同为"项"**（`for (const raw of batchMode ? body.tasks : [body])` ⇒ 顶层 `new_session` 亦生效） | `oamp/src/web.js:1392-1394 / 1441 / 1387` |
| **A4** | `/api/docs` 的 `POST /api/calls` 登记元数据**已含** `new_session`（在 `tasks` 项 `desc` 文案里），并**无**独立 `params[]` 行 | `oamp/src/web.js:1309`（与主 agent 登记的**预期差异 ③**一致 ⇒ 无需改 `web.js`） |
| **A5** | 取件读取 = `db.listInbox(principalId)` 直读持久表，逐条映射 7 键 `{call_id, requester, agent, chat_id, terminal_at, acked:false, envelope: JSON.parse(...)}`；**不再** `queryOnce(router.task_get)`、**不**现算信封 | `oamp/src/web.js:1642-1662`、`oamp/src/persist.js:291-297 / 339-345` |
| **A6** | 写入点 = 唯一终态发布点：`db.insertInbox({callId, principal: call.principal, agent: call.role, chatId, terminalAt: Date.now(), envelope: JSON.stringify(envelope)})`（`INSERT OR IGNORE` 幂等） | `oamp/src/web.js:2246-2252`、`oamp/src/persist.js:291-293` |
| **A7** | 归属身份派生（唯一处）：`const principal = requester === null ? \`chat:${chatId}\` : requester;` | `oamp/src/web.js:1356` |
| **A8** | ack = `db.deleteInbox(params.call_id)`，响应恒 `{call_id, acked:true}`（不校验归属、0 行影响同样如此） | `oamp/src/web.js:1821-1822`、`oamp/src/persist.js:297 / 343-345` |
| **A9** | 超时双计时与两种触发的人类可读文本：`轮次空闲超时（空闲 <ms>ms）` / `轮次安全网超时（累计 <ms>ms）`（三个客户端各一份同构实现，rpc 走 `rpc-client.js:292`、acp 走 `acp-client.js:442`、one-shot 走 `oneshot-client.js:144`）；判死落 `task.result{state:'failed', error:'timeout'}`（`agent.js:234`）⇒ `reason=timeout` | 三客户端 + `oamp/src/agent.js:234` |
| **A10** | 配置面：`loadConfig()` 返回 `taskIdleMs`（默认 `600000`，env `OAMP_TASK_IDLE_MS`）/ `taskNetMs`（默认 `14400000`，env `OAMP_TASK_NET_MS`）；web 的对账软 TTL 缺省 = `readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS)`（`RECONCILE_SLOW_DEFAULT_MS = 30000` ⇒ 缺省 **14430000**，不再 1800000） | `oamp/src/config.js:29-30 / 155-156`、`oamp/src/web.js:76 / 2188` |
| **A11** | `oamp/README.md:222` 现文案把 LLM 轮次写成"omp 默认超时 1800s（30 分钟；`timeout_ms` 可覆盖，上限同为 1800s）"——**默认档已由 pr-004 移除**，该句是 A-05「文档面同步」段点名的唯一 README 语义残迹 | `oamp/README.md:222` + `oamp/README.md` 环境表 `:88 / :94` |
| **A12** | `oamp/README.md:70` 的 shell 任务 JSON 字段行（`timeout_ms`（默认 30000，上限 1800000））**保留**（A-05 第 7 条）；`oamp/README.md:214-216` 三条 payload 表的 `timeout_ms?` 亦不动 | `oamp/README.md:70 / 214-216` |
| **A13** | `oamp/skill/hub.md` 现状：等待语义已指向 `API.md`「等待语义」小节为**唯一真源**（`:111`）；取件步（`:112`）写"离线期间跑完的调用，结论不会丢"——与实现**不冲突**但未覆盖"hub 重启"；全文不复述字段（`reason` / `structured_output` / `exit_code` 零命中） | `oamp/skill/hub.md:111-112` |
| **A14** | `oamp/API.md` 的**章节编号有重复**：`3.11`（`GET /api/docs` `:570` 与 `GET /api/subscribe` `:1011`）、`3.12`（`GET /api/projects` `:591` 与 `GET /api/pickup` `:1051`）、`3.13`（`POST /api/projects` `:621` 与 `POST /api/pickup/<call_id>/ack` `:1096`）、`3.18`（`GET /api/calls/<call_id>/transcript` `:822` 与 `GET /api/calls/wait` `:1129`）⇒ **一切锚点必须写「`### <编号>` + 方法 + 路径」**，裸编号会指错节；另：`POST /api/calls` 的**参数表实际在 §3.14**（`:649`），architecture §4 A-07 与 prd/F07 的「`API.md` §3.9 参数表」指向的 `:520` 是 `GET /api/stream`（**引用滞后，本文件按实况 §3.14 落地**） | `oamp/API.md` 全表（实读） |
| **A15** | `hub doctor` 的 R1 只比 **method + path**（`shapePath` 归一）**不比 `params`** ⇒ `new_session` **不进机械锁**，其同步只能靠人工 + 本文件 C3 判据；且 R1 的正则只认 `^\|\s*\d+\s*\|\s*`（GET\|POST）\s+(\/api\/[^`]*)`` 的表格行（**全文扫描**，不限 §3） | `oamp/sdk/doctor.js:34-70`（实读 + §4.2 实跑） |
| **A16** | `hub doctor` 实跑（`/tmp` 隔离：真 Router + 真 web，端口 17931，socket `rt/router.sock`）⇒ `pass:true`，items = `R1×29`（全 ok）+ `R2×29` + `R3×8`，**29 R1 项全部 ok**；**反例门**：向 §3 清单表插一行 `| 30 | \`GET /api/nope\` | … |` ⇒ `pass:false`，失败项恰 `R1 GET /api/nope / 登记缺失` ⇒ 机械锁可判定 | 实跑（§4.2），JSON 落 `/tmp/0030-pr-006/logs/` |
| **A17** | `node oamp/scripts/gen-llms-txt.mjs` 实跑（`/tmp` 副本）⇒ 标准输出 `llms.txt 已生成：…（接口 29 条，3493 字节）`，与仓库内 `oamp/llms.txt` **`diff` 为空（逐字节一致）** ⇒ 本 PR 对 `llms.txt` 的期望是**零 diff** | 实跑（§4.3） |
| **A18** | 目标四文档在「迭代工作区」与「PR worktree」间 `diff -q` 全部 **same**；两 worktree `git status --short` 均为空（取证未留痕） | 实测 |
| **A19** | 仓内无任何 `*.test.js`；本 PR 自证载体 = 机械核查脚本 + 只读命令（§4），**不得**新增仓库内文件 | 实测（沿用 pr-005 §0.3 A15 口径） |

### 0.4 本 PR 冻结契约（跨任务一次定死；dev 按此落字，不再自行取舍）

1. **改动面封闭（全任务）**：`git diff --name-status 9a4f424 -- oamp/` **只允许**出现 `M oamp/API.md`、`M oamp/README.md`、`M oamp/skill/hub.md`（`oamp/llms.txt` 仅当生成器重生成产生 diff 时允许 `M`，且该 diff 属**异常信号**需上报）；`oamp/src/**` 零改动。
   〔追溯：PR 文件「文件范围」；architecture §5〕
2. **既有 10 键零改动**：`call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code` 的**键名与键序**在文档中逐字保留；`reason` 只作为**失败侧末位追加**出现（T1）。
   〔追溯：A1/A2；architecture §4 A-03；prd/F04 验收 5/7〕
3. **`reason` 五值闭集**：文档只可出现 `agent_error` / `cancelled_by_client` / `infra_error` / `timeout` / `rejected` 五个取值（不多不少）；**不加子枚举 / 分层原因码**；`timeout` 不区分空闲与安全网（人类可读文本才区分）。
   〔追溯：A2/A9；architecture §4 A-03（序列化形态）+ A-04；prd/F04 验收 1/3；D-29〕
4. **`error` 键保留原样**：文档须写明 `error` 键**不删除、不改名、键位不变、取值形态不变**，只把语义称谓收窄为人类可读的补充信息；**不新增 `detail` 键**。
   〔追溯：architecture §4 A-03 + §10-4（MI-6 读法）；prd/F04 验收 5〕
5. **`new_session` 描述 = 实现事实**：项级可选布尔；**仅 `true` 生效**（`false` / `null` / 非布尔与缺省等价）；语义 = 忽略既有绑定 → 按最空闲重选 → **重绑**（下一轮不声明时粘到本次选中的实例）；**不新增错误码 / 校验分支**；**无 CLI flag**（调用方途径 = 裸 HTTP 项级字段）。
   〔追溯：A3/A4；architecture §4 A-07 + §9-7 + §10-12 ⑤；prd/F07 验收 3 + MI-10〕
6. **取件面只补四件事 + ack 语义**：① 写入时机 = 终态发布那一刻**恰一次**（`submitted` / `working` **无记录**）；② **跨重启可查**（内容与重启前逐字一致）+ 保留期 = **至 ack 为止**（未取件不设过期）；③ `acked` **恒 `false`**（列出的条目必然未取件）；④ `principal` 参数 = **归属身份**（显式 `requester` 或缺省 `chat:<chat_id>`）；⑤ ack = **就地删除**该条目（幂等、无副作用）。**参数名、响应键集与键序逐字不变**。
   〔追溯：A5~A8；architecture §4 A-01/A-02/A-09 + §3.1 + §6 G01 验收 4 行 + §9-8；prd/F03 验收 1/2/3/5、F01 验收 5/6〕
7. **README 超时口径（逐字目标形态）**：缺省档 = **空闲 10 分钟**（自最近一次进展事件或轮次开始起算）+ **安全网 4 小时**（自轮次开始起算）先到者判死并落 `state:"failed"` / `reason:"timeout"`；阈值经 `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS` 可调；**显式 `timeout_ms` 仍为该轮绝对上限（上限 1800s，语义不变）**。
   〔追溯：architecture §4 A-05「文档面同步」段（逐字）+ §7 L2-09 + §9-7；prd/F05 验收 1/5/7；PR AC2〕
8. **README env 表三行**：新增 `OAMP_TASK_IDLE_MS`（默认 `600000`，agent）/ `OAMP_TASK_NET_MS`（默认 `14400000`，agent），作用对象与默认值逐字取 `config.js:29-30 / 155-156`；`OAMP_WEB_RECONCILE_TTL_MS` 的默认列由 `` `1800000` `` 改为与 `taskNetMs` 联动（缺省 `14430000`，`web.js:2188` 的算式），说明列点明"恒 ≥ 安全网阈值"的**不变式**。
   〔追溯：A10；architecture §4 A-05 生效位置清单第 6 条 + §5 修改表（README 行）+ §6 一致性检查（F05 × F03）〕
9. **`llms.txt` 是生成物**：内容只由 `scripts/gen-llms-txt.mjs` 决定；**禁止手改**；期望与当刻生成输出**逐字节一致**（A17 已实测成立）；若重生成后出现 diff ⇒ **停下上报**（意味着 `web.js` 路由元数据在迭代中被改过，属越界信号）。
   〔追溯：architecture §5「文档面机械锁提示」；PR AC3〕
10. **`skill/hub.md` 不复述**：等待语义仍指向 `API.md` 为**唯一真源**（`:111` 句保留）；取件步可补"hub 重启"字样，但**不得**出现信封字段名清单 / 取值域 / 参数表。
    〔追溯：architecture §5 修改表（skill/hub.md 行）；PR AC4；`hub.md` 红线 2〕
11. **不得声称未实现之物**：不写 `new_session` 的 CLI flag；不写取件在 Router 不可达时 502；不写 `acked` 有非 `false` 取值；不写 `reason` 出现在成功 / 受理态；不写"路由有 30 条 / 新增了接口"。
    〔追溯：A4/A5/A8 + §0.2「做错的形态」1~8；PR AC5〕
12. **锚点纪律**：任何"某节内容"的表述必须写「`### <编号>` + `METHOD /path`」（A14：编号有重复），评审/取证一律按路径锚定。
13. **证据落点**：脚本、原始输出、日志落 `/tmp/0030-pr-006/`；**不新建仓库内文件**、不写 `status.md` / `history.md` / `architecture.md` / PR 文件 / `deferred-demand-changes.md`；不执行 git 写操作。

### 0.5 PR 验收标准 → 任务映射（5 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | `API.md`：失败信封含 `reason`（五值闭集、仅失败侧、`error` 保留原拼写与原值）；`POST /api/calls` 参数表含项级可选 `new_session` 及语义；§3.12 / §3.13 取件两端点补"写入时机 / 跨重启 / `acked` 恒 `false`"且参数名与响应结构描述与实现一致 | **T1**（`reason`）+ **T2**（`new_session`）+ **T3**（取件） |
| AC2 | `README.md` 超时描述改写为"缺省 = 空闲 10 分钟 / 安全网 4 小时（env 可调）；显式 `timeout_ms` 仍为该轮绝对上限" | **T4**（+ **T5** 的 env 面同族） |
| AC3 | `llms.txt` 与生成器当刻输出逐字节一致；接口条数与迭代前同值（**29**），三处同值（`llms.txt` 头 / `llms.txt` 行数 / `API.md` §3 编号末位） | **T6**（生成物）+ **T7**（条数与机械锁） |
| AC4 | `skill/hub.md` 取件 / 等待叙述不与 `API.md` 冲突：等待语义仍指向 `API.md` 唯一真源、不复述字段 | **T8** |
| AC5 | 文档描述与实现一致：任取 `reason` / `new_session` / 超时 / 取件四项，文档所述取值或参数形态可在实现中找到对应；`API.md` §3 路由行与 `GET /api/docs` 的 `routes[]` 双向比对通过 | **T7**（R1 机械锁）+ **T9**（四项逐条对照 + 集成） |

---

## 1. 任务列表

### T1: `API.md` —— 失败终态信封的 `reason` 字段面（§3.19 字段表 + 键集合句 + §4.4 帧键集）

- **服务哪条 AC**: AC1（第 1 分句）、AC5（`reason` 项）
- **描述**: 把失败终态新增的 `reason` 键写进信封的**字段说明**（§3.19），并让"键集合封闭"句与 §4.4 的 `call_result` 帧键集同步为"失败侧多一个末位 `reason`"。三处一改，文档内部自洽且与实现同源。
- **文件/锚点**: `oamp/API.md` —— §3.19 字段表最后一行 `:899`（`| \`exit_code\` | … |`）**其后**追加 `reason` 行；键集合句 `:903`；§4.4 `call_result` 行 `:1360`。
  （**不得**动 §3.19 的**参数**表 `:867-869`（`call_id` 行）与错误表 `:905-909`；A14 的锚点纪律：`### 3.19` + `GET /api/calls/<call_id>`。）
- **步骤**（逐字目标形态见 §4.1 的 `doccheck.mjs` C1 段与 C2 段；示例文本已用 `/tmp` 模拟树验证可使 C1b/C1c/C1d/C1e/C2 全 PASS）:
  ① 在 `:899` 行后追加一行：
  ``| `reason` | string \| null | **仅失败终态**（`state` 为 `failed`）在既有 10 键之后**末位追加**该键，取值 ∈ 封闭五值：`agent_error`（agent 自报失败但未给出可归类原因 / 自由文本未命中任何已知形态）/ `cancelled_by_client`（调用方取消）/ `infra_error`（会话 / 子进程 / 上下文基础设施失败）/ `timeout`（空闲或安全网超时，**不分子枚举**）/ `rejected`（权限拒绝 / 模型不可用 / 队列满 / 结构校验未通过 / 目标拒绝受理）。成功与受理态**不带**该键 ⇒ 只读 `reason` 即可区分失败类别，无需解析自由字符串 |``
  ② 改写 `:903`：保留"封闭的 10 键"这一既有事实，**追加**"失败终态在该 10 键之后**末位追加** `reason`（⇒ 失败侧 11 键，既有键名与键序零改动）"，并把 `call_result` 帧的键数表述改为"成功 / 受理 11 键、失败 12 键"；
  ③ 在 `error` 行（`:898`）**不改值**的前提下补一句语义收窄（"`error` 键保留原拼写与原值，语义为人类可读的补充信息；**不新增 `detail` 键**"）——若放在行内过长，可改为紧随字段表的一条 bullet（**位置自由，语义必须齐**）；
  ④ 改写 `:1360` 的 `call_result` 行：在键集后追注"**失败终态**在末位追加 `reason`（键位与取值见 §3.19）"。
- **验收判据（可执行，全部由 §4.1 的 `doccheck.mjs` 判定）**:
  1. **C1a**：从 `web.js` 源码抽出的实现键序逐字 = `call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code`（**既有 10 键未被误改**）。
  2. **C1b/C1c**：§3.19 **字段表**（以表头 `| 字段 | 类型 | 说明 |` 锚定）的行首键名序列逐字 = 实现键序 + `reason`（**末位**）。
  3. **C1d**：§3.19 的键集合句同时含"封闭"、`reason`、"失败"三要素。
  4. **C1e**：§4.4 的 `call_result` 行含 `reason` 且含"失败"。
  5. **C2**：`API.md` 覆盖五值字面量，且与 `reason.js` 的实际取值集合一致（五值不多不少）。
  6. **C9**：实现键序的前 10 键逐字不变（对"既有键零改动"的交叉守门）。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §4 A-03（键位 = 末位 / 非失败态不带该键 / 序列化形态 = 字符串字面量 / 不单列列 / `call.terminal` 不动）+ A-04（五值来源、`agent_error` 兜底、`timeout` 不分子枚举）+ §5「修改」表（`API.md` 行）+ §6 G01 验收 1/3 行 + §9-9；prd/F04 验收 1/2/3/5/7 + MI-4/MI-6；PR AC1 第 1 分句、AC5。

---

### T2: `API.md` —— `POST /api/calls` 参数表的项级可选 `new_session`（§3.14）

- **服务哪条 AC**: AC1（第 2 分句）、AC5（`new_session` 项）
- **描述**: 把 F07 的"显式声明不延续"落成调用方可见的参数行：项级可选布尔、仅 `true` 生效、语义 = 忽略既有绑定 → 最空闲重选 → 重绑；同时把 `tasks` 项的形状列举补上 `new_session?`。
- **文件/锚点**: `oamp/API.md` —— §3.14 参数表 `tasks` 行 `:660`（项形状列举）与 `model` 行 `:665`（**其后**插入 `new_session` 行）；错误表 `:717-724`（**不得**新增该字段的 400 触发）。锚点写 `### 3.14 \`POST /api/calls\``（A14：裸 `§3.9` 是 `GET /api/stream`）。
- **步骤**:
  ① `:660` 的项形状 `{task, output_schema?, schema_mode?, mode?, model?}` ⇒ `{task, output_schema?, schema_mode?, mode?, model?, new_session?}`；
  ② 在 `:665` 行后插入：
  ``| `new_session` | boolean | 否 | 无（= 沿用既有绑定） | **项级**可选字段（单任务形态即写在请求体本身，批量形态写在 `tasks[]` 的每一项）：`true` ⇒ 本次派发**忽略既有绑定**（会话粘性），按池内**最空闲**实例重选并**重绑**（下一轮不再声明时粘到本次选中的实例）；缺省不出现 ⇒ 沿用既有绑定。**仅 `true` 生效**，其余取值（`false` / `null` / 非布尔）与缺省等价，**不新增校验分支与错误码**（既有响应形状零变化） |``
  ③ 确认"未声明的字段**忽略**"这一既有句（`:667`）仍在（`new_session` 的缺省语义与它一致，不另起第二套规则）。
- **验收判据（可执行，由 `doccheck.mjs` 的 C3 段判定）**:
  1. **C3a**：§3.14 参数表存在 `| \`new_session\` | …` 表行（**不是**仅散文提及）。
  2. **C3b**：该节同时出现"忽略"（既有绑定）、"最空闲"、"重绑"三要素。
  3. **C3c**：声明为**项级**可选且**缺省不出现**。
  4. **C3d**：§3.14 错误表中**没有**把 `new_session` 列为 `INVALID_PARAM` 触发（不新造拒绝面）。
  5. **A4 交叉核对（只读命令）**：`grep -c "new_session" oamp/src/web.js` 的命中点恰为 `:1309`（登记元数据 desc）/`:1394`（解析）/`:1441`（消费）⇒ 文档所述形态与实现一致，且**不需要**改 `web.js`。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §4 A-07（承载形态 = 项级可选布尔 / 缺省不出现 ⇒ 既有请求形状零变化 / 语义 = 忽略绑定 + 最空闲 + 重绑 / `API.md` 参数表同步）+ §8（`new_session` 保留的理由）+ §9-7（无 CLI flag）+ §10-12 ⑤（调用方途径 = 裸 HTTP）；prd/F07 验收 3/4/5 + MI-10；PR AC1 第 2 分句、AC5。

---

### T3: `API.md` —— 取件两端点（§3.12 `GET /api/pickup` / §3.13 `POST /api/pickup/<call_id>/ack`）

- **服务哪条 AC**: AC1（第 3 分句）、AC5（取件项）
- **描述**: 删掉两条与实现已矛盾的旧句（"正文现算 / 重启即丢"），补上"写入时机 = 终态发布那一刻恰一次""跨重启可查""`acked` 恒 `false`""`principal` = 归属身份（含缺省 `chat:<chat_id>`）"与 ack 的就地删除语义；**参数名、响应键集与键序逐字不变**。
- **文件/锚点**: `oamp/API.md` —— §3.12 参数表 `:1059`（`principal` 行）；响应说明 bullets `:1081 / 1082 / 1083`（外加 `:1080` 的 `agent` 说明行**不动**）；§3.13 `:1116`（幂等 bullet，**其后**加一条）。锚点写 `### 3.12 \`GET /api/pickup\`` / `### 3.13 \`POST /api/pickup/<call_id>/ack\``（A14）。
- **步骤**:
  ① `:1059` 的 `principal` 说明 ⇒ "取件身份 = 该调用的**归属身份**：派发时**显式声明**的 `requester`，未声明时为其缺省身份 `chat:<chat_id>`（见 §3.14）"；
  ② `:1081`（"`envelope` **正文现算**…`envelope` 为 `null`"）**整条替换**为："**写入时机 = 终态发布那一刻恰一次**：条目由 hub 在**终态发布点**写入持久层（`submitted` / `working` 的调用**无记录**，不存在半成品条目）；`envelope` 就是那一刻产出的那一份（失败侧含 `reason`）——**不再按当刻 Router 任务表现算**，也不因进程重启而为 `null`。"；
  ③ `:1082`（"只列 `acked === false` 的条目"）⇒ 补"列出的条目 `acked` **恒为 `false`**"（未取件集合的定义）；
  ④ `:1083`（"保留期 = 调用登记的寿命（进程内、**重启即丢**）…"）**整条替换**为："**跨重启可查**：条目存于 hub 的持久层，hub 进程重启后同一身份再取件**仍能取到**该终态，内容与重启前**逐字一致**；保留期 = **至 ack 为止**（未取件条目不设过期，不自动消失）。"；
  ⑤ §3.13 `:1116` 之后加一条："**确认 = 把该条目从待取清单就地删除**：确认后它不再出现在未取件集合中（重启前后一致）；已确认条目在持久层不留历史行（**不做**归档 / 导出 / 历史台账面）。"；
  ⑥ 顺带核对（**不改**）：`epoch` 参数与 `STALE_EPOCH` 文案仍在、响应示例的 7 键**键序未动**、`requester` 键名保留（取值域 = 归属身份）。
- **验收判据（可执行，由 `doccheck.mjs` 的 C4 段判定）**:
  1. **C4a**：§3.12 响应示例的 `pickup[0]` 键序逐字 = 从 `web.js` 抽出的实现映射键序（`call_id,requester,agent,chat_id,terminal_at,acked,envelope`，7 键）。
  2. **C4b**：旧句特征串（`正文**现算**` / `重启即丢` / `` `envelope` 为 `null` ``）在 §3.12 全节**零命中**。
  3. **C4c**：出现"写入时机 = 终态发布那一刻**恰一次**"的语义（含"终态"与"恰一次"）。
  4. **C4d**：出现**跨重启可查**语义。
  5. **C4e**：出现 `acked` **恒 `false`** 的说明。
  6. **C4f**：`principal` 说明含缺省身份 `chat:<chat_id>`。
  7. **C4g**：§3.13 同时含"删除 / 划掉 / 移除"与"幂等"。
  8. **只读交叉核对**：`grep -n "listInbox\|deleteInbox\|task_get" oamp/src/web.js` ⇒ 取件两 handler 内**无** `task_get`（`db.listInbox` 于 `:1654`、`db.deleteInbox` 于 `:1821`）⇒ 文档所述"不再现算"与实现一致。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §4 A-01（写入时机 = 终态发布那一刻恰一次 / 为什么存整份信封 / 响应形状零变化 / 取件不再逐条查 Router）+ A-02（`WHERE principal = ?` 与缺省身份的调用方自行构造）+ A-09（ack = 就地删除、`acked` 为常量、未取件不设 TTL）+ §3.1 第 3~4 条 + §5 修改表（`API.md` 行）+ §6 G01 验收 4 行 + §9-8；prd/F03 验收 1/2/3/5、F01 验收 5/6、F02 验收 1/2；PR AC1 第 3 分句、AC5。

---

### T4: `README.md` —— 超时口径句改写（第 222 行）

- **服务哪条 AC**: AC2、AC5（超时项）
- **描述**: 把"omp 默认超时 1800s（30 分钟）"的绝对上限叙事改为"缺省 = 空闲 10 分钟 / 安全网 4 小时（env 可调）；显式 `timeout_ms` 仍为该轮绝对上限"。
- **文件/锚点**: `oamp/README.md:222`（单行改写）；同文件 `:70`（shell 命令硬上限）与 `:214-216`（三条 payload 表的 `timeout_ms?`）为**不动项**（A12）。
- **步骤**: 把 `:222` 整行替换为（逐字目标形态）：
  `- omp 轮次超时（**缺省档**）：**空闲 10 分钟**（自轮次开始或最近一次进展事件起算）与**安全网 4 小时**（自轮次开始起算）先到者判死，判死后经既有失败路径产出 `state: "failed"` + `reason: "timeout"`（两种触发只在人类可读文本里区分）；阈值可调（`OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS`）。**显式** `timeout_ms` 语义不变：仍为该轮**绝对上限**（上限 1800s）。omp 可执行路径可用 `OAMP_OMP_BIN` 覆盖（测试注入 fake omp 用）。`
- **验收判据（可执行，由 `doccheck.mjs` 的 C5a/C5b/C5e 判定）**:
  1. **C5a**：README 全文**不再**含 `omp 默认超时 1800s`。
  2. **C5b**：README 同时含"空闲"、"安全网"、`timeout_ms`（口径三要素齐）。
  3. **C5e**：`oamp/README.md:70` 的 shell 行逐字未变（`timeout_ms`（默认 30000，上限 1800000））——**反向守门**（不得把命令硬上限一起改掉）。
  4. **只读交叉核对（人类可读文本真的区分两种触发）**：`grep -rn "轮次空闲超时\|轮次安全网超时" oamp/src/` ⇒ `rpc-client.js:292` 命中（另两客户端为 `${method} 空闲超时` / `${method} 安全网超时`、`一次性执行空闲超时` / `一次性执行安全网超时`：`acp-client.js:442`、`oneshot-client.js:144`）⇒ 文档所述"人类可读文本区分"有实现对应。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §4 A-05「文档面同步」段（逐字目标形态）+ §7 L2-09（显式 `timeout_ms` 语义保留）+ §9-6/§9-7 + §5 修改表（`README.md` 行）；prd/F05 验收 1/5/7（`timeout` 单一枚举 + 阈值可调 + 判据取代全部生效位置）；PR AC2、AC5。

---

### T5: `README.md` —— 环境变量表：两键新增 + 对账 TTL 默认值行修正

- **服务哪条 AC**: AC5（超时项在 README 的默认值面）
- **描述**: README 的「环境变量参数表」是仓内 env 的**唯一成表真源**。F05 的两键（阈值可调面）与 pr-005 改过的对账 TTL 缺省值（`1800000` → `taskNetMs + 30000`）若不登记，README 就会在**同一屏**内既说"缺省 4 小时"又写"对账 TTL 默认 30 分钟"，直接违反 AC5 的"文档所述取值可在实现中找到对应"。
- **文件/锚点**: `oamp/README.md:88`（`OAMP_CTX_MAX` 行，**其后**插入两行）；`:94`（`OAMP_WEB_RECONCILE_TTL_MS` 行改写）。
- **步骤**:
  ① `:88` 后插入两行（作用对象与默认值逐字取 `config.js:29-30/155-156`）：
  ``| `OAMP_TASK_IDLE_MS` | agent | `600000` | 轮次**空闲**判死阈值（毫秒，默认 10 分钟）：自轮次开始或最近一次进展事件起算；正整数（非法值启动即报错） |``
  ``| `OAMP_TASK_NET_MS` | agent | `14400000` | 轮次**安全网**阈值（毫秒，默认 4 小时）：自轮次开始起算；正整数（非法值启动即报错） |``
  ② `:94` 的默认列由 `` `1800000` `` ⇒ `` `taskNetMs + 30000`（缺省 `14430000`） ``，说明列改为"缺省值与 `OAMP_TASK_NET_MS` **联动**（恒 ≥ 安全网阈值，避免长任务终态被登记清理吞掉）；超时清理孤儿条目；缺省/非法回退该算式"。
- **验收判据（可执行，由 `doccheck.mjs` 的 C5c/C5d 判定）**:
  1. **C5c**：README 含 `` `OAMP_TASK_IDLE_MS` `` 与 `` `OAMP_TASK_NET_MS` `` 两条表行。
  2. **C5d**：`OAMP_WEB_RECONCILE_TTL_MS` 行的默认列**不再**是 `1800000` 且该行含 `taskNetMs`。
  3. **只读交叉核对**：`grep -n "OAMP_TASK_IDLE_MS\|OAMP_TASK_NET_MS" oamp/src/config.js` ⇒ `:29-30`（默认 `600000` / `14400000`）与 `:155-156`（`readPositiveInt` 校验）⇒ 表内默认值与校验语义均有实现对应；`grep -n "readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS'" oamp/src/web.js` ⇒ `:2188` 的算式与文档一致。
- **前置依赖**: 无（与 T4 同文件不同区域；**同一写者顺序执行**，见 §3）
- **优先级**: P1（**P1 ≠ 可选**：它是 AC5「超时」项在 README 的落点；若主 agent 裁定 README 只做 AC2 那一句，则本任务与 C5c/C5d 一并删除——见 §5.2 MI-P6-1）
- **追溯**: architecture §4 A-05「生效位置清单」第 6 条（对账 TTL 缺省 `taskNetMs + RECONCILE_SLOW_DEFAULT_MS` 与不变式）+ §5 修改表（`README.md` 行）+ §6 一致性检查（F05 × F03）+ §9-6；prd/F05 验收 5（阈值是初值、可调）；PR AC5。

---

### T6: `oamp/llms.txt` —— 生成物核对（期望零 diff）

- **服务哪条 AC**: AC3（第 1 分句）
- **描述**: `llms.txt` 是 `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 的落地快照（`scripts/gen-llms-txt.mjs`）。本迭代未改任何路由的 `summary` ⇒ 期望**零 diff**；"重生成"是**核对手段**，不是"必须产出改动"。
- **文件/锚点**: `oamp/llms.txt`（47 行，3493 字节）；生成器 `oamp/scripts/gen-llms-txt.mjs:10-15`；渲染真源 `oamp/src/web.js:1997`（`renderLlmsTxt`）。
- **步骤**:
  ① 在 `/tmp` 副本上实跑生成器（**不要在 PR worktree 直跑**，以免万一产生非预期 diff 混入改动面）：
  `cp -R "$PRWT/oamp" /tmp/0030-pr-006/gen/oamp && (cd /tmp/0030-pr-006/gen && node oamp/scripts/gen-llms-txt.mjs)` ⇒ 记录 stdout 的"接口 N 条，M 字节"；
  ② `diff "$PRWT/oamp/llms.txt" /tmp/0030-pr-006/gen/oamp/llms.txt` ⇒ 期望**无输出**；
  ③ 若（异常）有 diff：**停下上报主 agent**，并把生成结果原样落到 `$PRWT/oamp/llms.txt`（生成物以脚本为准），同时在 dev 回填段说明 diff 内容 —— 该 diff 意味着 `web.js` 路由元数据在迭代中被改过（越界信号）。
- **验收判据（可执行）**:
  1. **C8**：`renderLlmsTxt(projectRoutes(createApiRoutes({})))` 的字符串与文件字节**逐字节相等**（`doccheck.mjs` 内联判定，实测基线已 PASS）。
  2. **实跑证据**：生成器 stdout 原文（含"接口 **29** 条"）与 `diff` 的原始输出（空）落 `/tmp/0030-pr-006/logs/`。
  3. **改动面**：`oamp/llms.txt` 在 `git diff --name-status 9a4f424 -- oamp/` 中**不出现**（零 diff 的正常形态）。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: architecture §1.1「文档面机械锁」行 + §5「文档面机械锁提示」（`llms.txt` 由脚本重生成）；PR AC3 第 1 分句。

---

### T7: 机械锁核对 —— `hub doctor` R1 双向比对 + 路由条数三处同值（29）

- **服务哪条 AC**: AC3（条数）、AC5（末句）
- **描述**: 文档面改动后重跑既有机械锁，确认"未新增路由"在**双侧**成立（`API.md` §3 清单行 ↔ 运行侧 `GET /api/docs` 的 `routes[]`），并核对三个"29"同值。本任务**零源码改动**，只做核对与留证。
- **文件/锚点**: `oamp/sdk/doctor.js:34-70`（R1 的文档侧正则与 `shapePath` 归一）；`oamp/API.md` §3 清单表 `:170-200`（**只读、且不得被前面的任务改到**）；`oamp/llms.txt:11`（头部条数）；`oamp/scripts/gen-llms-txt.mjs`（条数来源）。
- **步骤**:
  ① **离线主判据**（无需 Router）：跑 `doccheck.mjs` 的 C7a/C7b —— 用 doctor 的同一正则 + 同一 `shapePath` 归一，把 `API.md` 全表命中行与 `projectRoutes(createApiRoutes({}))` 双向比对（`登记缺失` / `文档未覆盖` 两侧均须为空），并核对"三处 29"；
  ② **加持判据（真机械锁，env 隔离）**：按 §4.2 配方在 `/tmp` 起真 Router + 真 web（非默认端口 17931、socket 落 `/tmp`），对 **PR worktree 的最终树**跑 `node oamp/bin/hub.js doctor`，断言 JSON 的 `pass === true` 且 **R1 段 29 项全 `ok`**；
  ③ **反例门**（证明该判据真的会失败）：在 `/tmp` 副本的 `API.md` §3 表插一行 `| 30 | \`GET /api/nope\` | 反例门（假行） |` ⇒ 重跑 doctor ⇒ 断言 `pass === false` 且失败项恰 `R1 GET /api/nope`（原因 `登记缺失`）；随后**复原**副本并复核 `doccheck` 回到全 PASS。
- **验收判据（可执行）**:
  1. **C7a**：`routes.length === 29` ∧ `API.md` §3 命中行 = 29 ∧ `llms.txt` 头部 = `接口（29 条）` ∧ `llms.txt` 的 `- GET|POST /api/` 行 = 29。
  2. **C7b**：R1 双向比对两侧均为空集（离线复刻）。
  3. **真 doctor**：`pass:true`、`R1` 段 29/29 `ok`、非 ok 项为空（**读 JSON 字段判定，不依赖退出码**——反例门实测 `pass:false` 时进程退出码仍为 `0`）。
  4. **反例门**：插假行后 `pass:false` 且唯一失败项为 `R1 GET /api/nope / 登记缺失`。
  5. **零改动**：本任务不产生任何源码 / 文档 diff（`git status --short` 在 PR worktree 内仍只显示 T1~T6/T8 的文档改动）。
- **前置依赖**: **T1**、**T2**、**T3**（R1 是对 `API.md` **最终态**的判定；在文档面改动前跑等于没跑）、**T6**（"三处同值"含 `llms.txt` 两个面）
- **优先级**: P0
- **追溯**: architecture §5「文档面机械锁提示」（本迭代不新增路由 ⇒ R1 不因缺行失败；参数表与字段语义属人工同步项）+ §1.1（三处同值 29 的实测口径）+ §10-8（29 条的口径更正）；`oamp/sdk/doctor.js:44-70`；PR AC3 第 2 分句、AC5 末句。

---

### T8: `oamp/skill/hub.md` —— 取件步与 `API.md` 对齐（审 + 最小改）

- **服务哪条 AC**: AC4
- **描述**: hub skill 是"给 agent 直接照做"的操作面。等待语义已指 `API.md` 唯一真源（`hub.md:111`），本任务只处理取件步（`:112`）：把"离线期间跑完的调用，结论不会丢"扩到"**hub 重启**也不算丢"，并**反向守门**"不复述字段"。
- **文件/锚点**: `oamp/skill/hub.md:112`（序列 1 第 3 步）；`:111`（等待语义指向真源，**不动**）；`:5` / `:143`（红线：不复制 schema，**不动**）。
- **步骤**:
  ① 逐条判定（**必须先给出判定表**，再决定是否改）：对"等待语义指向唯一真源"、"取件叙述与 §3.12 新表述是否冲突"、"是否复述了字段 / 取值域 / 参数表"三条，各写 现状文字 → `API.md` 真源位置 → 冲突 / 兼容 结论；
  ② 取件步按最小改写落地（逐字目标形态）：
  `3. 取件：\`node "<项目根>/oamp/bin/hub.js" api pickup list\` 拿回自己尚未取件的终态结果（含完整信封），\`api pickup ack <call_id>\` 确认取走后从清单里划掉——**离线期间跑完的调用，结论不会丢；hub 重启也不算丢**（条目已持久化，重启后仍可查）。`
  ③ 若判定表出现"冲突"项（例如某句与新语义相抵），一并按最小改写修掉并在回填段如实记录；**不得**顺带把字段表 / 参数说明搬进来。
- **验收判据（可执行，由 `doccheck.mjs` 的 C6 段判定 + 判定表）**:
  1. **C6a**：`hub.md` 仍含"唯一真源"（等待语义未被改写成第二份定义）。
  2. **C6b**：序列 1（`### 序列 1: 派发 → 等待 → 取件` 至 `### 序列 2`）内出现"重启"字样。
  3. **C6c**：`hub.md` 全文**不出现** `reason` / `structured_output` / `exit_code`（不复述字段）。
  4. **判定表证据**：三条判定各带 `API.md` 锚点（§3.12 / §2.4）与结论，落 dev 回填段。
- **前置依赖**: 无（**但**：若 T3 改写了 §3.12 的措辞，本任务的判定表须对照**改后**的 §3.12 复核 ⇒ 实操顺序建议 T3 → T8，见 §3）
- **优先级**: P0
- **追溯**: architecture §5 修改表（`skill/hub.md` 行）；PR AC4；`oamp/skill/hub.md:5 / 111 / 143`（既有"不复述/唯一真源"约定）。

---

### T9: 集成自证 —— 文档↔实现逐条对照 + 改动面封闭性 + 全量判据复跑

- **服务哪条 AC**: AC5（整体）、AC1~AC4 的交叉面
- **描述**: 用一套机械核查器对**最终树**做四类判定：① 全量判据（`doccheck.mjs` 29 项全 PASS）；② AC5 的"四项对照表"（`reason` / `new_session` / 超时 / 取件，每项给出文档位置 ↔ 实现 `文件:行号` 的证据对）；③ 改动面封闭性（零代码改动）；④ 差异清单外零差异（不新增路由、不动既有 10 键、不新增 env 键语义）。
- **文件/锚点**: 零改动（只读）；脚本与原始输出落 `/tmp/0030-pr-006/`。
- **步骤**:
  ① 对 **PR worktree 最终树**跑 `node /tmp/0030-pr-006/doccheck.mjs "$PRWT/oamp"` ⇒ 期望 **29 PASS / 0 FAIL**；
  ② 逐条补全 **AC5 对照表**（格式见 §4.4；四项各至少一条实现锚点，值/形态逐字相等）；
  ③ `git -C "$PRWT" diff --name-status 9a4f424 -- oamp/` ⇒ 期望恰 `M oamp/API.md` + `M oamp/README.md` + `M oamp/skill/hub.md`（`oamp/llms.txt` 无 diff；`oamp/src/**` 零命中）+ `git status --short` 为空；
  ④ 零夹带核对：`grep -c "path: '/api/" oamp/src/web.js`（路由登记数）不变；`oamp/README.md:70` / `oamp/API.md` §3 清单表 `:170-200` / §2.4 等待语义 `:159-164` 三处逐字未变（可用 `git diff` 逐条目视 + 上面的机械判据）。
- **验收判据（可执行）**:
  1. **全量**：`doccheck.mjs` 输出末行 `29 PASS / 0 FAIL`，退出码 0。
  2. **AC5 对照表**：四项齐备，且每项的"实现锚点"是可复现的 `文件:行号`（`reason` → `web.js:559` + `reason.js:7-16`；`new_session` → `web.js:1394/1441` 且**无** 400 分支；超时 → `config.js:29-30/155-156` + `rpc-client.js:292`/`acp-client.js:442`/`oneshot-client.js:144` + `agent.js:234`；取件 → `web.js:1654/1821/2246` + `persist.js:291-297`）。
  3. **改动面封闭**：`git diff --name-status` 恰 3 个 `M`（三份文档），`oamp/src/**` / `oamp/sdk/**` / `oamp/scripts/**` / `oamp/web/**` / `oamp/bin/**` **零条目**；`git status --short` 为空（无 `.runtime/` / `data/` 等取证残留）。
  4. **三处 29 + R1**：沿用 T7 的 C7a/C7b 判定（不重复跑真 doctor，如跑则以 T7 的证据文件复用）。
  5. **差异清单核对**：本 PR **不产生**任何运行时差异；`GET /api/agents` 的 role 列、取件面 Router 不可达 200、失败信封 11 键、`/api/docs` desc 行、`pickup.js` 退役——**五条已登记预期差异的实现归属均在其他 PR**，文档面只做"如实描述"，不得在文档里把它们写成"本 PR 引入"。
- **前置依赖**: **T7**（经它传递 T1 / T2 / T3 / T6 的顺序保证）、**T4**、**T5**、**T8**
- **优先级**: P1（**P1 ≠ 可选**：AC5 的整体判定与"改动面零夹带"是本 PR 的可审查性交付物）
- **追溯**: PR AC5 全句；architecture §6（零影响声明——本 PR 不涉行为面）+ §5（文档面机械锁提示）+ §11（写入面纪律）；§0.2「非目标」。

---

## 2. 依赖图

```
T1 ─┬──────────────┐
T2 ─┼──> T7 ──┬───┴──> T9
T3 ─┤         │
T6 ─┘         │
T4 ───────────┼────────> T9
T5 ───────────┤
T8 ───────────┘
```

边（逐条，均为真实约束；共 8 条）：
- `T1 → T7`、`T2 → T7`、`T3 → T7`：R1 判定的是 `API.md` 的**最终态**且本任务的三条判据（C1/C3/C4）落在同一文件的邻近小节 ⇒ 在它们落地前跑机械锁等于对旧树跑（结论无信息量）；三处也共享"§3 清单表不得被动到"这条约束的统一验证时机。
- `T6 → T7`：T7 的"三处同值"含 `llms.txt` 的两个面（头部条数、`- GET|POST` 行数）⇒ 需 T6 先确认该文件与生成器一致，否则"同值"可能是拿一份过期快照对出的假 PASS。
- `T7 → T9`：T9 的全量判据复跑以"最终树"为对象，须在机械锁通过之后（否则可能在"文档已改但锁已破"的状态下拿到误导性结论）。
- `T4 → T9`、`T5 → T9`、`T8 → T9`：T9 的全量判据覆盖 README 与 `skill/hub.md` 面（C5/C6），且"改动面恰 3 个 M"的前置是这两处已落地。
  追溯：PR AC5 的"任取四项均可对照"是**跨文件**要求；architecture §5「文档面机械锁提示」把"人工同步项"与"生成物"分成两类，机械锁必须在这两类都定稿后才可信。

**无环**：全部边方向均为"前置 → 后继"（`T1/T2/T3/T4/T5/T6/T8` 无入边；`T7` 的出边只指向 `T9`）⇒ 拓扑序 `T1, T2, T3, T4, T5, T6, T8, T7, T9` 满足全部边，不存在回到已访问节点的路径。

**最长依赖链（= 本 PR 内部关键路径，3 节点）**：`T1 → T7 → T9`。
**关键路径任务**：**T1**（`reason` 字段面 = AC1 第 1 分句的唯一载体，且改的是"信封"这一被 §3.19/§4.4/§3.12 多处引用的核心对象）→ **T7**（机械锁 = AC3/AC5 的唯一机械判据面）→ **T9**（全量复跑 + 改动面封闭 = 阶段 6 verifier 的输入）。

**并行友好性**：`T2 / T3 / T4 / T5 / T6 / T8` 与关键路径**无相互依赖**，可与 T1 并行（T2/T3 同文件不同小节、T4/T5 同文件不同区域；单人执行按 §3 顺序）。

---

## 3. 执行顺序与增量策略

**顺序**：`T1 → T2 → T3 → T8 → T4 → T5 → T6 → T7 → T9`
（先把 `API.md` 三节改完，再让 `skill/hub.md` 对照**改后**的 §3.12 做判定；随后 README 两处；最后生成物核对 + 机械锁 + 集成自证。）
同文件任务（T1/T2/T3 同 `API.md`，T4/T5 同 `README.md`）**由同一写者顺序执行**（不并发、不交叉）；它们的**判据彼此独立**，故不设依赖边，但**不得**为了"顺手"把两次编辑合成一次未受判据覆盖的大改。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立留证）：

| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | T1：§3.19 `reason` 行 + 键集合句 + §4.4 帧键集 | `doccheck` C1a~C1e + C2 + C9 |
| 2 | T2：§3.14 `new_session` 行 + 项形状 | `doccheck` C3a~C3d |
| 3 | T3：§3.12/§3.13 取件面五处改写 | `doccheck` C4a~C4g |
| 4 | T8：`hub.md` 取件步 + 三条判定表 | `doccheck` C6a~C6c + 判定表 |
| 5 | T4：README 超时口径句 | `doccheck` C5a/C5b/C5e |
| 6 | T5：README env 表三行 | `doccheck` C5c/C5d |
| 7 | T6：生成物核对（期望零 diff） | `doccheck` C8 + 生成器 stdout + `diff` 空 |
| 8 | T7：机械锁（离线 + 真 doctor + 反例门） | `doccheck` C7a/C7b + doctor JSON + 反例门 |
| 9 | T9：全量复跑 + 四项对照表 + 封闭性 | `doccheck` 29 PASS / 0 FAIL + `git diff --name-status` + 对照表 |

**若单次调用未跑完**：按**任务边界**停下（不得交付"`reason` 行加了但键集合句仍写封闭 10 键"这类半改状态；T7/T9 不得在 T1~T6/T8 未落地时声称通过）。

---

## 4. 验证配方（**禁止新增仓库内文件**，A19；全部为 `/tmp` 脚本 + 只读命令，取证根 `/tmp/0030-pr-006/`）

> **本配方已用两份树完整演练**：① **改造前树**（PR worktree 现状，`doccheck` = **11 PASS / 18 FAIL**，FAIL 集合恰为待改的 18 项判据）；② **模拟改造后树**（在 `/tmp/0030-pr-006/sim/oamp` 上按本文件 T1~T6/T8 的逐字目标形态落地，`doccheck` = **29 PASS / 0 FAIL**）；③ **真 `hub doctor`**（隔离 Router + web）在模拟改造后树上 `pass:true`、R1 29/29 ok，**反例门**插假路由行后 `pass:false`；④ **真生成器**实跑与仓库内 `llms.txt` **逐字节一致**。⇒ **判据的可判定性已前置证明**；dev 只需让 PR worktree 的最终树拿到同一批结论。

### 4.0 环境与前置（冻结，避免"跑法不同导致结论不同"）

```bash
PRWT=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-006-api-docs-sync
BASE=/tmp/0030-pr-006                       # 取证根（不入库）
mkdir -p "$BASE" "$BASE/logs"
# ① 生成器副本（T6 用；不污染 PR worktree）：
rm -rf "$BASE/gen" && mkdir -p "$BASE/gen" && cp -R "$PRWT/oamp" "$BASE/gen/oamp"
# ② 判据脚本：§4.1 的 doccheck.mjs 原文写入 "$BASE/doccheck.mjs"（+x 不必要，用 node 跑）
# ③ 真 doctor 配方需要的隔离运行时目录（§4.2）：
mkdir -p "$BASE/rt" "$BASE/rt-bin"
```

- Node 版本：**v22.15.0**（`doccheck.mjs` 会 `import` `oamp/src/web.js`，其依赖链含 `node:sqlite`，须 ≥ 22；实跑环境已满足）。
- `doccheck.mjs` 是**只读**的：`createApiRoutes({})` 不建库、不起服务、不写文件（实跑后 PR worktree / 迭代工作区 `git status --short` 均为空）。

### 4.1 判据脚本 `$BASE/doccheck.mjs`（原文；对最终树的期望 = **29 PASS / 0 FAIL**）

```js
// doccheck.mjs — pr-006 文档面判据的机械核查器（只读；用法：node doccheck.mjs <oamp 目录绝对路径>）
// 判据 C1~C9 与本 PR tasks 文件的 T1~T9 一一对应；对"改造前"树应呈现固定 FAIL 集合（判据可判定性）。
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const O = path.resolve(process.argv[2] ?? './oamp');
const read = (p) => fs.readFile(path.join(O, p), 'utf8');
const [web, api, readme, hub, reason, llms] = await Promise.all([
  read('src/web.js'), read('API.md'), read('README.md'), read('skill/hub.md'), read('src/reason.js'), read('llms.txt'),
]);
const out = [];
const chk = (id, ok, detail = '') => out.push(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
const seg = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to)); // 锚点一律用「### <编号> `<METHOD /path>`」，不用裸编号（编号在本文件里有重复）

// ---- C1 信封：实现键序 ↔ API.md §3.19 字段表 / §4.4 call_result 键集 / 键集合句
const envBlock = web.slice(web.indexOf('const envelope = {'), web.indexOf("if (state === 'failed') envelope.reason"));
const implKeys = [...envBlock.matchAll(/^\s{4}([a-z_]+)[,:]/gm)].map((m) => m[1]);
chk('C1a 实现信封键序（10 键，末尾追加 reason）', implKeys.join(',') === 'call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code', implKeys.join(','));
const s319 = seg(api, '### 3.19 `GET /api/calls/<call_id>`', '### 3.20');
const s319Lines = s319.split('\n');
const hdr = s319Lines.findIndex((l) => l.trim() === '| 字段 | 类型 | 说明 |'); // 锚定「字段表」表头，避免吃到本节前面的「参数」表
const tbl = [];
for (const line of s319Lines.slice(hdr + 2)) {
  const t = line.trim();
  if (!t.startsWith('|')) break;
  if (/^\|\s*`[a-z_]+`\s*\|/.test(t)) tbl.push(/^\|\s*`([a-z_]+)`/.exec(t)[1]);
}
chk('C1b 字段表含 reason 行', tbl.includes('reason'), `doc rows = ${tbl.join(',')}`);
chk('C1c 字段行序 = 实现键序 + reason（末位）', tbl.join(',') === [...implKeys, 'reason'].join(','), tbl.join(','));
const keySetLine = (s319.split('\n').find((l) => /封闭的 10 键|封闭的 11 键|键集合/.test(l)) ?? '').trim();
chk('C1d 键集合句已交代失败侧追加 reason', /封闭的/.test(keySetLine) && /reason/.test(keySetLine) && /失败/.test(keySetLine), keySetLine.slice(0, 80));
const callResultRow = /^\|\s*`call_result`\s*\|([^|]*)\|/m.exec(seg(api, '## 4. 事件流', '## 5. 可粘贴示例'));
chk('C1e §4.4 call_result 键集含 reason 且标注失败侧', callResultRow !== null && /reason/.test(callResultRow[1]) && /失败/.test(callResultRow[1]), callResultRow ? callResultRow[1].trim().slice(0, 90) : '行未找到');

// ---- C2 reason 五值闭集：文档字面量集合 == reason.js 实际取值集合
const implVals = ['agent_error', 'cancelled_by_client', 'infra_error', 'timeout', 'rejected'].filter((v) => reason.includes(`'${v}'`));
const docVals = ['agent_error', 'cancelled_by_client', 'infra_error', 'timeout', 'rejected'].filter((v) => api.includes(v));
chk('C2 API.md 覆盖五值且与 reason.js 取值集合一致', implVals.length === 5 && docVals.length === 5, `doc=${docVals.join(',')} impl=${implVals.join(',')}`);

// ---- C3 new_session：§3.14 参数表行 + 语义三要素 + 不新增 400 面
const s314 = seg(api, '### 3.14 `POST /api/calls`', '### 3.15');
const nsRow = /^\|\s*`new_session`\s*\|[^\n]*$/m.exec(s314);
chk('C3a §3.14 参数表含 new_session 行', nsRow !== null, nsRow ? nsRow[0].slice(0, 60) : (s314.includes('new_session') ? '出现但非表行' : '零命中'));
chk('C3b 语义三要素（忽略既有绑定 / 最空闲重选 / 重绑）', /忽略/.test(s314) && /最空闲/.test(s314) && /重绑/.test(s314), '');
chk('C3c 声明为项级可选且缺省不出现', /项级/.test(s314) && /缺省/.test(s314), '');
chk('C3d 错误表未把 new_session 列为 400 触发（不新造错误面）', !/INVALID_PARAM[^\n]*new_session/.test(s314), '');

// ---- C4 取件端点：条目键序（doc 示例 ↔ 实现映射）+ 新增语义
const s312 = seg(api, '### 3.12 `GET /api/pickup`', '### 3.13 `POST /api/pickup/');
const s313 = seg(api, '### 3.13 `POST /api/pickup/', '### 3.18 `GET /api/calls/wait`');
const docPick = Object.keys(JSON.parse(/```json\n(\{[\s\S]*?)\n```/.exec(s312)[1]).pickup[0]);
const implPick = [...web.slice(web.indexOf('const result = rows.map((row) => ({'), web.indexOf('sendJson(res, 200, { pickup: result })')).matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]);
chk('C4a 条目键序：doc 示例 == 实现映射（7 键）', docPick.join(',') === implPick.join(',') && implPick.length === 7, `doc=${docPick.join(',')} impl=${implPick.join(',')}`);
chk('C4b 旧句「正文现算 / envelope 为 null / 重启即丢」已消失', !/正文\*\*现算\*\*/.test(s312) && !/重启即丢/.test(s312) && !/`envelope` 为 `null`/.test(s312), '');
chk('C4c 写入时机 = 终态发布那一刻恰一次', /恰一次/.test(s312) && /终态/.test(s312), '');
chk('C4d 跨重启可查已写明', /跨重启|重启后(仍|依然)/.test(s312), '');
chk('C4e acked 恒 false 已写明', /acked[^\n]*恒|恒[^\n]*false/.test(s312), '');
chk('C4f principal 说明含缺省身份 chat:<chat_id>', /chat:<chat_id>/.test(s312) || /chat:<chatId>/.test(s312), '');
chk('C4g ack = 就地删除 / 幂等表述', /删除|划掉|移除/.test(s313) && /幂等/.test(s313), '');

// ---- C5 README：超时口径 + 三个 env 行
chk('C5a README 不再写「omp 默认超时 1800s（30 分钟」', !/omp 默认超时 1800s/.test(readme), '');
chk('C5b 口径含 空闲 / 安全网 / 显式 timeout_ms 绝对上限', /空闲/.test(readme) && /安全网/.test(readme) && /timeout_ms/.test(readme), '');
chk('C5c env 表含 OAMP_TASK_IDLE_MS 与 OAMP_TASK_NET_MS', /`OAMP_TASK_IDLE_MS`/.test(readme) && /`OAMP_TASK_NET_MS`/.test(readme), '');
const recRow = /^\|\s*`OAMP_WEB_RECONCILE_TTL_MS`\s*\|.*$/m.exec(readme);
chk('C5d 对账 TTL 默认行与 taskNetMs 联动（不再写 1800000 / 默认 30 分钟）', recRow !== null && /taskNetMs/.test(recRow[0]) && !/1800000/.test(recRow[0]), recRow ? recRow[0].slice(0, 100) : '行未找到');
chk('C5e shell 命令硬上限语义未被误改', /timeout_ms`（默认 30000，上限 1800000）/.test(readme), '');

// ---- C6 skill/hub.md
chk('C6a 等待语义仍指向唯一真源（不复述）', /唯一真源/.test(hub), '');
chk('C6b 取件步含「hub 重启」措辞', /重启/.test(seg(hub, '### 序列 1', '### 序列 2')), '');
chk('C6c 未复述信封字段（无 reason / structured_output / exit_code）', !/reason|structured_output|exit_code/.test(hub), '');

// ---- C7 路由数三处同值（29）+ R1 双向比对（离线复刻 doctor.js:34-70）
const mod = await import(pathToFileURL(path.join(O, 'src/web.js')).href);
const routes = mod.projectRoutes(mod.createApiRoutes({}));
const docRows = [...api.matchAll(/^\|\s*\d+\s*\|\s*`(GET|POST) (\/api\/[^`]*)`/gm)].map((m) => `${m[1]} ${m[2]}`);
const llmsHead = /^## 接口（(\d+) 条）$/m.exec(llms);
const llmsLines = (llms.match(/^- (?:GET|POST) \/api\//gm) ?? []).length;
chk('C7a 三处同值 29（routes[] / API.md §3 / llms.txt 头 + 行数）', routes.length === 29 && docRows.length === 29 && Number(llmsHead?.[1]) === 29 && llmsLines === 29, `routes=${routes.length} api=${docRows.length} llmsHead=${llmsHead?.[1]} llmsLines=${llmsLines}`);
const shapePath = (p) => p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');
const docMap = new Map(docRows.map((r) => [shapePath(r), r]));
const runMap = new Map(routes.map((r) => [shapePath(`${r.method} ${r.path}`), `${r.method} ${r.path}`]));
const missing = [...docMap.keys()].filter((k) => !runMap.has(k));
const uncovered = [...runMap.keys()].filter((k) => !docMap.has(k));
chk('C7b doctor R1 双向比对（登记缺失 / 文档未覆盖均为空）', missing.length === 0 && uncovered.length === 0, `缺失=${JSON.stringify(missing)} 未覆盖=${JSON.stringify(uncovered)}`);

// ---- C8 llms.txt 与生成器当刻输出逐字节一致
const gen = mod.renderLlmsTxt(mod.projectRoutes(mod.createApiRoutes({})));
chk('C8 llms.txt 逐字节 == renderLlmsTxt(projectRoutes(createApiRoutes({})))', gen === llms, `gen=${Buffer.byteLength(gen)}B file=${Buffer.byteLength(llms)}B`);

// ---- C9 既有键名与键序零改动
chk('C9 既有键名与键序零改动（前 10 键逐字）', implKeys.slice(0, 10).join(',') === 'call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code', '');

console.log(out.join('\n'));
const p = out.filter((l) => l.startsWith('PASS')).length;
console.log(`\n${p} PASS / ${out.length - p} FAIL`);
process.exit(p === out.length ? 0 : 1);
```

**基线（改造前，实测）**：`11 PASS / 18 FAIL`，FAIL 集合逐条为 ——
`C1b`(字段表无 `reason`) / `C1c` / `C1d` / `C1e` / `C2`(只出现 `timeout`) / `C3a` / `C3b` / `C3c` / `C4b` / `C4c` / `C4d` / `C4e` / `C4f` / `C5a` / `C5b` / `C5c` / `C5d` / `C6b`。
**PASS 集合 = 必须保持不变的既有面**：`C1a`（实现键序）/ `C3d`（无 `new_session` 400 面）/ `C4a`（条目键序 7 键）/ `C4g`（ack 幂等）/ `C5e`（shell 硬上限）/ `C6a`（唯一真源）/ `C6c`（不复述字段）/ `C7a`（三处 29）/ `C7b`（R1 双向一致）/ `C8`（生成物逐字节一致）/ `C9`（既有 10 键）。
**模拟改造后（实测）**：`29 PASS / 0 FAIL` ⇒ 每条判据都能被"正确的文档改动"翻转，且**不会**被顺手改坏的既有面（C1a/C4a/C5e/C7/C8/C9）放过。

### 4.2 真机械锁：`hub doctor`（T7 加持判据 + 反例门；**实测通过**）

```bash
BASE=/tmp/0030-pr-006; PRWT=<PR worktree 绝对路径>; PORT=17931
# ① 隔离副本（doctor 的 R1 读 PKG_ROOT/API.md、R3 需真 Router ⇒ 用副本、非默认端口/socket）：
rm -rf "$BASE/run" && mkdir -p "$BASE/run/rt" && cp -R "$PRWT/oamp" "$BASE/run/oamp"
# ② 起 Router（隔离 socket）：
OAMP_SOCKET="$BASE/run/rt/router.sock" OAMP_DB="$BASE/run/rt/hub.db" \
  node "$BASE/run/oamp/bin/oamp.js" router start &   # 就绪日志：ROUTER_READY socket=…
# ③ 起 web（隔离端口 + 隔离库 + 同一 socket）：
OAMP_SOCKET="$BASE/run/rt/router.sock" OAMP_DB="$BASE/run/rt/hub.db" OAMP_WEB_PORT=$PORT \
  node "$BASE/run/oamp/bin/oamp.js" web start --port $PORT &
# ④ 跑 doctor（读 PKG_ROOT 的 API.md = 改动后的文档）：
OAMP_SOCKET="$BASE/run/rt/router.sock" OAMP_WEB_PORT=$PORT OAMP_DB="$BASE/run/rt/hub.db" \
  node "$BASE/run/oamp/bin/hub.js" doctor > "$BASE/logs/doctor-post.json" 2>/dev/null
# ⑤ 断言（读 JSON 字段，不依赖退出码）：
node -e 'const d=require("'"$BASE"'/logs/doctor-post.json");const r1=d.items.filter(i=>i.id.startsWith("R1"));console.log("pass="+d.pass,"R1="+r1.length,"allOk="+r1.every(i=>i.ok),"非ok="+JSON.stringify(d.items.filter(i=>!i.ok).map(i=>i.id)))'
# 期望：pass=true R1=29 allOk=true 非ok=[]
# ⑥ 反例门（证明锁真的会失败）：往副本 §3 清单表插一行假路由后重跑，断言 pass=false 且失败项 = R1 GET /api/nope（登记缺失）；随后复原副本。
```

**实测结论**（原始 JSON 落 `$BASE/logs/`）：`pass=true`；items = `R1×29`（全 ok）+ `R2×29` + `R3×8`；插入假行后 `pass=false`，失败项恰 `R1 GET /api/nope / 登记缺失`，**进程退出码仍为 `0`**（⇒ 判据必须读 `pass` 字段）。
若本机难以起 Router/web，则 §4.1 的 **C7b 离线复刻即为等价主判据**（同一正则、同一 `shapePath`、同一两侧集合），真 doctor 作为加持证据。

### 4.3 生成物核对（T6）

```bash
BASE=/tmp/0030-pr-006; PRWT=<PR worktree 绝对路径>
rm -rf "$BASE/gen" && mkdir -p "$BASE/gen" && cp -R "$PRWT/oamp" "$BASE/gen/oamp"
(cd "$BASE/gen" && node oamp/scripts/gen-llms-txt.mjs) | tee "$BASE/logs/gen.out"
diff "$PRWT/oamp/llms.txt" "$BASE/gen/oamp/llms.txt" > "$BASE/logs/llms.diff"; echo "diff-lines=$(wc -l < "$BASE/logs/llms.diff")"
```
**实测基线**：stdout = `llms.txt 已生成：…（接口 29 条，3493 字节）`；`diff-lines=0`（逐字节一致）⇒ 本 PR 的期望是**零 diff**。

### 4.4 AC5 的"四项对照表"（T9 的交付形态；每项：文档位置 ↔ 实现锚点 ↔ 判据）

| 项 | 文档位置（改动后） | 实现锚点（可复现） | 判据 |
|---|---|---|---|
| `reason` | `API.md` §3.19 字段表 `reason` 行 + 键集合句 + §4.4 `call_result` 行 | `web.js:559`（末位追加）/ `reason.js:7-16`（EXACT 映射）/ `:18-22`（前缀）/ `:44`（兜底 `agent_error`） | C1b/C1c/C1d/C1e/C2/C9 |
| `new_session` | `API.md` §3.14 参数表 `new_session` 行 + `tasks` 项形状 | `web.js:1394`（`=== true` 才生效）/ `:1441`（`noReuse`）/ `:1387`（单任务形态同为项）/ **无** 400 分支 | C3a/C3d + `grep` 交叉核对 |
| 超时口径 | `README.md:222` 句 + env 表三行 | `config.js:29-30/155-156`（两键与校验）/ `web.js:76/2188`（对账 TTL 算式）/ `rpc-client.js:292`、`acp-client.js:442`、`oneshot-client.js:144`（两种触发可读文本）/ `agent.js:234`（落 `error:'timeout'`） | C5a~C5e |
| 取件 | `API.md` §3.12 / §3.13 全节 | `web.js:1654`（`listInbox`）/ `:1821`（`deleteInbox`）/ `:2246`（`insertInbox`，唯一写点）/ `:1356`（缺省身份）/ `persist.js:291-297`（三方法） | C4a~C4g |

### 4.5 禁止项（取证卫生）

- **不得**新增任何仓库内文件（含 `*.test.js`、证据 `.md`）；证据一律落 `/tmp/0030-pr-006/`。
- **不得**为让判据通过而放宽断言（例如把 `reason` 键位从"末位"放宽成"存在即可"、把 `acked` 恒 `false` 删掉、"三处同值"只对两处）。
- **不得**在 PR worktree 内直跑 web / agent / 生成器（会写 `oamp/.runtime/roster.json`、`oamp/data/` 或改动生成物）；一律在 `/tmp` 副本上跑（跑前 `cp -R`，跑后核对 `git status --short` 为空）。
- **不得**用 `hub doctor` 的退出码当判据（反例门实测 `pass:false` 时退出码仍为 0）。
- **不得**动 `API.md` §3 清单表、§2.4 等待语义、README `:70` 的 shell 硬上限、`skill/hub.md` 的"唯一真源 / 不复制 schema"两条红线约定。

---

## 5. 事实更正、边界判定、已知风险与 `[model_inferred]` 清单

### 5.1 事实更正与判据面发现（planner 实读 + 实跑；**不改 PR 文件 / 架构文件，只在此上报**）

- **F-1（锚点模糊，会致错改）`API.md` 章节编号有 4 组重复**：`3.11`（`GET /api/docs` `:570` 与 `GET /api/subscribe` `:1011`）、`3.12`（`GET /api/projects` `:591` 与 `GET /api/pickup` `:1051`）、`3.13`（`POST /api/projects` `:621` 与 `POST /api/pickup/<call_id>/ack` `:1096`）、`3.18`（`GET /api/calls/<call_id>/transcript` `:822` 与 `GET /api/calls/wait` `:1129`）。
  ⇒ 本文件一切锚点与判据**按「`### <编号>` + `METHOD /path`」定位**（`doccheck.mjs` 的 `seg()` 亦如此；顺序写错会直接改变判据结论——实跑中已踩到一次：裸 `### 3.12` 抓到的是 `GET /api/projects`）。
  连带更正：**`POST /api/calls` 的参数表实际在 §3.14（`:649`）**，而 architecture §4 A-07 与 prd/F07 写的"`API.md` §3.9 参数表"指向 `:520` = `GET /api/stream`（引用滞后）。**PR 文件的 AC1 只说"`POST /api/calls` 参数表"（未给编号），故无冲突**，本文件按实况 §3.14 落地。
- **F-2（机械锁的真实覆盖面）`doctor` R1 只比 method + path，不比 `params`**（`doctor.js:44-70`）⇒ `new_session`、`reason`、超时口径**都不进机械锁**：本迭代不新增路由 ⇒ R1 的"通过"是**弱判据**（只证明没多没少路由）；参数与字段语义的同步**只能靠人工 + C2/C3 判据**。这与 architecture §5「文档面机械锁提示」的判断一致（"参数表与字段语义属人工同步项"），此处补上**机制层面的证据**。
- **F-3（判据不得用退出码）`hub doctor` 在 `pass:false` 时进程退出码实测仍为 0**（反例门实测）⇒ AC5 末句的判定必须读 JSON 的 `pass` / `items[].ok`。
- **F-4（生成物期望是"零 diff"而非"必须改"）**：`node oamp/scripts/gen-llms-txt.mjs` 实跑输出与仓库内 `oamp/llms.txt` **逐字节一致**（`接口 29 条，3493 字节`）⇒ T6 的正确期望是"零 diff + 留证"；**若重生成出现 diff，是越界信号**（说明 `web.js` 路由 `summary` 被改过），须停下上报。另：`llms.txt` 的行文本**不含** `new_session` / `reason` / 超时口径（它只列 `METHOD /path — summary`）⇒ 本 PR 的字段/参数同步**不会**反映到 `llms.txt`（不要期待它变化）。
- **F-5（README 的两处"1800"必须区别对待）**：`:70`（shell 任务 `timeout_ms` 默认 30000 / 上限 1800000）**保留**（A-05 第 7 条）；`:222` 句里的"上限同为 1800s"**保留其"显式上限"含义**（`MAX_TIMEOUT_MS` 未变）⇒ 改写**不得**把 1800 一律抹掉（C5e 就是这条的反向守门）。
- **F-6（判据可判定性的实测证明）**：改造前树 = `11 PASS / 18 FAIL`（FAIL 集合恰为待改 18 项）；按本文件逐字目标形态模拟改造后 = `29 PASS / 0 FAIL`；真 doctor 在模拟改造后树 `pass:true` / R1 29/29；反例门插假路由行 ⇒ `pass:false`。⇒ 每一条 AC 的判据都存在**能失败也能通过**的可执行形态。
- **F-7（本 PR 不产生运行时差异）**：五条已登记预期差异（`/api/agents` role 列、取件面 Router 不可达 200、`/api/docs` desc 行、失败信封 11 键、`pickup.js` 退役）**全部由已合并的 pr-001~pr-005 引入**；本 PR 只"如实描述"，文档里**不得**把它们表述成"本次新增的行为面"，也不得新增第六类差异。

### 5.2 `[model_inferred]`（**留待主 agent 确认，本文件不自行生效**）

- **[model_inferred] MI-P6-1（README 的改动范围）**：本文件把 README 的范围定为"超时口径句（T4，WR AC2 明文）+ env 表三行（T5：两键新增 + 对账 TTL 默认值修正）"，依据 = AC5「文档所述取值或参数形态可在实现中找到对应」在"超时"项上要求 README 的**默认值表**也不得与实现矛盾（现状 `OAMP_WEB_RECONCILE_TTL_MS` 行写死 `1800000`/默认 30 分钟，与 `web.js:2188` 的 `taskNetMs + 30000` 直接冲突；且与改写后的 `:222` 句**同屏自相矛盾**）。若主 agent 裁定"README 只做 AC2 那一句"，则**删除 T5 + 判据 C5c/C5d**（其余任务与判据不受影响），T9 的对照表相应收敛。
- **[model_inferred] MI-P6-2（§4.4 `call_result` 行的呈现形态）**：本文件选择"**保留既有键集列举 + 追注失败侧末位 `reason`**"（判据 = 该行含 `reason` 且含"失败"），而不是改写成 `reason?` 之类的可选键记法。依据 = G01 的"既有键集与键序不变"取向 + 事件表以"整键集"列举的既有体例；若主 agent 要求可选键记法，则 C1e 的判定式需同步改写（其余不动）。
- **[model_inferred] MI-P6-3（`skill/hub.md` 的改写幅度）**：AC4 的字面要求是"**不冲突**"，现状（A13）严格说**不构成冲突** ⇒ "零改动"在字面上也能通过。本文件按"补一句 `hub 重启也不算丢`"落（依据：F03 的跨重启语义是**本迭代用户价值**之一，hub skill 的取件步是 agent 实际照做的地方；不补则"重启即丢"的旧印象无处置换），并保留"仅判定 + 判定表"作为可接受形态。若主 agent 要求**逐字零改动**，则 T8 退化为"三条判定表 + C6a/C6c 守门"（C6b 判据删除）。

### 5.3 已知风险（不阻塞，供 dev / verifier 知情）

1. **锚点被编号重复污染**（F-1）：改错节（如把 `reason` 行加到 `GET /api/projects` 的 §3.12 里，或把 `new_session` 行加到 `GET /api/stream` 的 §3.9 里）不会被任何"语义判据"发现，但会被 `doccheck` 的位置判据（C1b/C3a/C4x 的 `seg()` 锚定）判为 FAIL。**dev 落笔前先 `grep -n "^### 3\\." oamp/API.md` 对锚点。**
2. **机械锁是弱判据**（F-2）：`doctor` 通过**不能**证明参数/字段同步正确；反过来，**§3 清单表被误改会让它失败**（这是它唯一强的地方，也是本 PR 必须守住的负向约束）。
3. **不可在 worktree 直跑工具**（§4.5）：`web start` 会写 `oamp/.runtime/roster.json`、生成器会写 `oamp/llms.txt` ⇒ 直接污染"改动面恰 3 个 M"的判定。全程用 `/tmp` 副本。
4. **`llms.txt` 的"零 diff"期望**：若 dev 在错误的确认下"为了让 PR 有产出"而手改它，C8 会立即 FAIL（且违反了"生成物不得手改"的冻结契约 9）。
5. **文档措辞自由度 vs 判据宽度**：`doccheck` 的判据按**语义关键词**（"恰一次"/"跨重启"/"恒"）判定，不同措辞可能命中或漏判 ⇒ 本文件已对每条给出**逐字目标形态**（§1 各任务步骤），dev 按其落字最稳；若改写措辞导致某判据 FAIL，**先核对语义是否真的齐了**，再决定改文档还是上报（不得为过判据而堆关键词）。

---

## 6. 粒度决策说明（非显然决策，记录依据）

- **按"文档面 → 文件/小节"拆成 9 条（而非"四文件四个任务"）**：`API.md` 一个文件里承载**三组互不相同的语义**（信封字段、调用参数、取件面），判据载体各异（键序比对 / 参数表行 + 语义三要素 / 响应键序 + 四条语义），失败面必须能分别定位（"`reason` 写错了"与"取件旧句没删干净"是两类问题）；故 T1/T2/T3 分列。
- **README 拆 T4/T5**：T4 是 AC2 明文的**单句改写**；T5 是 AC5 要求的**默认值面一致性**（含一条现状硬冲突），二者的判据与可裁性不同（T5 带 `[model_inferred]` 范围问题）⇒ 分列，使"只做 AC2 字面"的裁剪不影响 T4。
- **`llms.txt` 独立成 T6（而非并入 T9）**：它的判据（生成器逐字节一致）与"零 diff 期望"是**生成物特有**的，且其异常形态（出现 diff ⇒ 越界信号）需要**独立的上报路径**；并入集成任务会让这个信号被淹没。
- **T7（机械锁）与 T9（集成）分列**：T7 的判据面是**既有工具链**（doctor R1 + 三处条数），T9 的判据面是**本 PR 新增的核查器 + 改动面封闭性 + AC5 对照表**；两者失败含义不同（T7 失败 = 文档面破坏了既有机械锁；T9 失败 = 文档与实现不一致或夹带了他处改动）。
- **T3 → T8 不设依赖边、只设建议顺序**：T8 的判定表需要对照**改后**的 §3.12，但代码上/文件上无强制先后（T8 改的是 `hub.md`）⇒ 按"依赖只在严格必要时"的取向不设边，改由 §3 的执行顺序承载；代价 = 若 dev 先做 T8，需在 T9 前复查一次判定表（已在 T8 判据 4 与 T9 依赖面覆盖）。
- **不设"基线快照"任务**：改造前树由 PR worktree 的 HEAD `9a4f424` **随时可重现**（`git archive` / 直接读），基线数值（`11 PASS / 18 FAIL` 的 FAIL 集合、`diff-lines=0`、doctor `pass:true`）已固定在本文件 §4，重做属重复劳动。

---

## 7. 执行证据（dev 回填）

> 本段由 pr-006 的 dev 在执行过程中**原文回填**（原始命令、原始 stdout/stderr、退出码；逐任务对齐 §1 的判据编号）。**不得**改写判据、不得只写结论。
> 建议分段：`T1 / T2 / T3 / T4 / T5 / T6 / T7 / T8 / T9`，每段含：命令原文 → 原始输出 → 对照判据编号的 PASS/FAIL 判定 → 偏差说明（若有）。
> 证据落盘约定：`/tmp/0030-pr-006/`（脚本、out 文件、doctor JSON、日志）；**不新建仓库内证据文档**、不写入 `status.md` / `history.md` / `deferred-demand-changes.md` / `architecture.md` / PR 文件；**不执行 git 写操作**。
> verifier 的独立报告落 `clarifications/verify-<ts>-pr-006.md` + `roles/verifier/data/`，**不回填**本段。

### 执行环境

- 运行模型标识：`openai/gpt-5.6-luna`
- PRWT：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-006-api-docs-sync`
- 证据根：`/tmp/0030-pr-006/`
- 说明：所有运行时取证均在 `/tmp/0030-pr-006/run` 或 `/tmp/0030-pr-006/gen` 副本完成；未占用默认端口，Router/web 使用端口 `17931` 与 `/tmp/0030-pr-006/run/router.sock`。

### T1 / T2 / T3 / T4 / T5 / T8：文档改动与判据

命令原文：

```bash
node /tmp/0030-pr-006/doccheck.mjs "$PRWT/oamp"
```

`/tmp/0030-pr-006/logs/doccheck-after.out` 原始输出关键片段：

```text
PASS C1b ... doc rows = call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code,reason
PASS C1c ... call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code,reason
PASS C1d ...
PASS C1e ...
PASS C2 ... doc=agent_error,cancelled_by_client,infra_error,timeout,rejected impl=agent_error,cancelled_by_client,infra_error,timeout,rejected
PASS C3a ...
PASS C3b ...
PASS C3c ...
PASS C3d ...
PASS C4a ... doc=call_id,requester,agent,chat_id,terminal_at,acked,envelope impl=call_id,requester,agent,chat_id,terminal_at,acked,envelope
PASS C4b ...
PASS C4c ...
PASS C4d ...
PASS C4e ...
PASS C4f ...
PASS C4g ...
PASS C5a ...
PASS C5b ...
PASS C5c ...
PASS C5d ...
PASS C5e ...
PASS C6a ...
PASS C6b ...
PASS C6c ...

29 PASS / 0 FAIL
```

判定：T1 的 C1a~C1e/C2/C9、T2 的 C3a~C3d、T3 的 C4a~C4g、T4/T5 的 C5a~C5e、T8 的 C6a~C6c 全部 PASS。改造前同一判据器输出 `/tmp/0030-pr-006/logs/doccheck-before.out` 的 `11 PASS / 18 FAIL`，FAIL 恰为待改判据集合。

T8 三条判定表（先审后改）：

| 判定项 | 现状文字 | API.md 真源位置 | 结论 |
|---|---|---|---|
| 等待语义指向唯一真源 | `hub.md` 明确写等待语义以 `oamp/API.md`「等待语义」为唯一真源，且不复述 | `### 3.18 \`GET /api/calls/wait\``（等待语义段） | 兼容，保留不动 |
| 取件叙述与新表述 | 原文说明离线期间结论不会丢；改后 API 明确终态写入持久层、跨重启可查、ack 就地删除 | `### 3.12 \`GET /api/pickup\`` / `### 3.13 \`POST /api/pickup/<call_id>/ack\`` | 兼容；按 MI-P6-3 最小补充“hub 重启也不算丢” |
| 是否复述字段 / 取值域 / 参数表 | 全文不含 `reason` / `structured_output` / `exit_code` | `### 3.19 \`GET /api/calls/<call_id>\``、`### 3.12 \`GET /api/pickup\`` | 兼容；未搬运 schema |

### T6：llms.txt 生成物

命令原文：

```bash
(cd /tmp/0030-pr-006/gen && node oamp/scripts/gen-llms-txt.mjs) | tee /tmp/0030-pr-006/logs/gen.out
diff "$PRWT/oamp/llms.txt" /tmp/0030-pr-006/gen/oamp/llms.txt > /tmp/0030-pr-006/logs/llms.diff
```

原始输出关键片段：`llms.txt 已生成：...（接口 29 条，3493 字节）`；`llms.diff` 为空（`diff-lines=0`）。C8 PASS；`llms.txt` 未手改且最终与生成器逐字节一致。

### T7：路由三处同值、离线 R1 与真 doctor

`doccheck-after.out` 原始片段：

```text
PASS C7a ... routes=29 api=29 llmsHead=29 llmsLines=29
PASS C7b ... 缺失=[] 未覆盖=[]
PASS C8 ... gen=3493B file=3493B
```

真 doctor 命令（隔离副本、非默认端口/socket）：

```bash
OAMP_SOCKET="$BASE/run/router.sock" OAMP_WEB_PORT=17931 OAMP_DB="$BASE/run/hub.db" \
  node "$BASE/run/oamp/bin/hub.js" doctor > "$BASE/logs/doctor-post.json" 2>/dev/null
```

`/tmp/0030-pr-006/logs/doctor-post.json` 的 JSON 字段判定原文（读取 `pass` 与 `items[].ok`，不以退出码判定）：

```json
{"pass":true,"r1":29,"r1Ok":29,"allOk":true,"nonOk":[]}
```

反例门：隔离副本追加 `| 30 | \`GET /api/nope\` | 反例门（假行） |` 后，doctor JSON 字段判定为：

```json
{"pass":false,"nonOk":[{"id":"R1 GET /api/nope"}]}
```

反例 doctor 进程退出码为 `0`，故判据使用 JSON `pass`/`items[].ok`；随后副本已复原。

### T9：集成、AC5 对照与改动面

四项实现对照（文档改后 ↔ 实现真源）：

| 项 | 文档位置 | 实现锚点 |
|---|---|---|
| `reason` | `API.md` `### 3.19 \`GET /api/calls/<call_id>\`` 字段表、键集合句；`### 4.4` `call_result` | `oamp/src/web.js:559`；`oamp/src/reason.js:7-16`、`:18-22`、`:44` |
| `new_session` | `API.md` `### 3.14 \`POST /api/calls\`` 参数表与 `tasks` 项形状 | `oamp/src/web.js:1394`（仅 `=== true`）；`:1441`（`noReuse`）；`:1387`（单任务也是项）；无 400 分支 |
| 超时 | `README.md:224`（超时句）及 env 表 `OAMP_TASK_IDLE_MS` / `OAMP_TASK_NET_MS` / 对账 TTL | `oamp/src/config.js:29-30/155-156`；`oamp/src/web.js:76/2188`；`rpc-client.js:292`、`acp-client.js:442`、`oneshot-client.js:144`；`agent.js:234` |
| 取件 | `API.md` `### 3.12` / `### 3.13` | `oamp/src/web.js:1356`、`:1654`、`:1821`、`:2246`；`oamp/src/persist.js:291-297` |

改动面命令原文：

```bash
git -C "$PRWT" diff --name-status 9a4f424 -- oamp/
git -C "$PRWT" status --short
git -C "$PRWT" diff --name-only 9a4f424 -- oamp/src oamp/sdk oamp/scripts oamp/web oamp/bin
```

原始输出：

```text
M	oamp/API.md
M	oamp/README.md
M	oamp/skill/hub.md
 M oamp/API.md
 M oamp/README.md
 M oamp/skill/hub.md
```

禁止路径命令无输出。三处条数取证：`API rows=29`、`## 接口（29 条）`、`llms API lines=29`、`web route registrations=29`。实现交叉锚点原始输出含 `new_session` 命中 `web.js:1309/1394`、取件 `listInbox:1654` / `deleteInbox:1821` / `insertInbox:2246`、双超时文本 `rpc-client.js:292`。T9 全量 doccheck 为 `29 PASS / 0 FAIL`；无代码、依赖、路由改动，无取证残留写入 PR worktree。

### 收口补充证据（2026-09-17）

**运行模型标识**：`openai/gpt-5.6-luna`

本次仅按验收方报告修正两处文档矛盾：`oamp/API.md` §3.19 `reason` 类型由 `string \| null` 改为 `string`，失败终态限定与五值闭集描述保持不动；`oamp/README.md` 对账段登记软 TTL 由 `30min` 改为 `` `taskNetMs + 30s`（缺省 `14430000` ms ≈ 4h+30s） ``，保留定时补落、落库即停、恰一条 `out` 语义。`doccheck` 的 C1~C9 没有把 `string \| null` 当作类型基线（C1 只核对字段键名/键序及失败侧语义），因此未修改或放宽任何断言。

#### 1. doccheck（收口前后）

命令原文：

```bash
node /tmp/0030-pr-006/doccheck.mjs "$PRWT/oamp"
```

收口前（`HEAD=52777138c7760d885fb62dca0923753532150171`）原始输出末行：

```text
29 PASS / 0 FAIL
```

收口后（`HEAD=06d86e6d124a2981dc00a9852fb051355b016b49`）原始输出末行：

```text
29 PASS / 0 FAIL
```

收口后关键断言：

```text
PASS C1b ... doc rows = call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code,reason
PASS C1c ... call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code,reason
PASS C2 ... doc=agent_error,cancelled_by_client,infra_error,timeout,rejected impl=agent_error,cancelled_by_client,infra_error,timeout,rejected
PASS C5d ... 对账 TTL 默认行与 taskNetMs 联动（不再写 1800000 / 默认 30 分钟）
29 PASS / 0 FAIL
```

判定：PASS。既有改造前基线（初始文档树）仍为 `11 PASS / 18 FAIL`；本次收口前后的最终文档判据均为 `29 PASS / 0 FAIL`，未因本次类型/TTL 修正放宽判据。

#### 2. 路由计数（三/五处口径）

命令原文：

```text
node（只读计数 API.md §3、llms.txt 头部/正文、web.js 路由登记）
```

原始输出：

```json
{"apiRows":29,"llmsHead":29,"llmsLines":29,"webRoutes":29}
```

判定：PASS。`llms.txt` 正文行与头部、`API.md` §3 表行、`web.js` 路由行均为 `29`（五处读数同为 29）。

#### 3. llms.txt 逐字节生成核对

命令原文：

```bash
(cd /tmp/0030-pr-006/closeout-gen && node oamp/scripts/gen-llms-txt.mjs)
diff "$PRWT/oamp/llms.txt" /tmp/0030-pr-006/closeout-gen/oamp/llms.txt > /tmp/0030-pr-006/logs/llms-closeout.diff
```

原始输出：

```text
llms.txt 已生成：/private/tmp/0030-pr-006/closeout-gen/oamp/llms.txt（接口 29 条，3493 字节）
diff-lines=0
```

判定：PASS。`oamp/llms.txt` 与 `/tmp` 副本生成结果逐字节一致，diff 为空，未修改生成物。

#### 4. 隔离真 Router + 真 web 的 hub doctor

环境：Router socket `/tmp/0030-pr-006/closeout-run/rt/router.sock`、数据库 `/tmp/0030-pr-006/closeout-run/rt/hub.db`、web 端口 `17931`；运行后已停止 `pr006-closeout-web` 与 `pr006-closeout-router`。

命令原文：

```bash
OAMP_SOCKET=/tmp/0030-pr-006/closeout-run/rt/router.sock OAMP_WEB_PORT=17931 OAMP_DB=/tmp/0030-pr-006/closeout-run/rt/hub.db node /tmp/0030-pr-006/closeout-run/oamp/bin/hub.js doctor > /tmp/0030-pr-006/logs/doctor-closeout.json 2>/dev/null
```

JSON 判定原文（读取 `pass` 与 `items[].ok`，不看退出码）：

```json
{"pass":true,"r1":29,"r1Ok":29,"nonOk":[]}
```

判定：PASS。满足 `pass:true`、`R1=29`、`r1Ok=29`、`nonOk=[]`。

#### 5. 改动面、提交与顺带核查

`git -C "$PRWT" diff --name-status HEAD`（提交前）原始输出：

```text
M	oamp/API.md
M	oamp/README.md
```

提交后 `git diff --stat HEAD^ HEAD`：

```text
 oamp/API.md    | 2 +-
 oamp/README.md | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
```

提交 hash：`06d86e6d124a2981dc00a9852fb051355b016b49`

提交后工作树 `git status --short` 为空；本次提交仅含 `oamp/API.md` 与 `oamp/README.md`，未改代码、`oamp/llms.txt` 或其它文件。

顺带核查命令：

```bash
grep -nE '30min|30 分钟|1800' "$PRWT/oamp/API.md" "$PRWT/oamp/README.md" "$PRWT/oamp/skill/hub.md"
```

原始输出（均为按要求保留、无矛盾的既有口径）：

```text
API.md:164: CLI 侧 30 分钟的等待预算……不是等待的语义上限
README.md:70: timeout_ms（默认 30000，上限 1800000）
README.md:224: 显式 timeout_ms … 绝对上限（上限 1800s）
```

未发现除本次修正目标外、与超时口径/对账 TTL 矛盾的数字；上述三处均属明确的等待预算或显式命令/调用上限，按要求只报告不修。
