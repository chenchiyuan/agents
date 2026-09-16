# pr-001：Router 侧状态基元（`connected` / `started_at` / `generation` / `task_cancel`）

## 上下文摘要

Router 进程与 UDS 会话层的全部本次改动集中在一个 PR（三个文件互为一体：节点快照字段、任务条目字段、协议方法）。内容：`registry.snapshot()` 追加 `connected`（= `connId !== null`，不暴露连接句柄）、任务条目追加 `started_at`（首次观察到 `working` 时写入，未进入过则 `null`）、Router 模块级 `generation`（启动时 `randomUUID()` 一次，经 `router.status` 结果追加键暴露）、新增第 9 个方法 `router.task_cancel`（内部 = 既有 `finishTask`：`failed` + `error:'cancelled'`，对已终态**幂等拒写**），`sdk/uds.js` 按既有 1:1 体例加会话方法 `taskCancel`。

关键约束：既有函数签名与语义、既有 4 字段节点投影、既有 8 个 UDS 方法语义逐字不变（G01 / architecture §6.1 Z-7）；终态词表封闭四值；层 B 入口清单与 `sdk/surface.js` 的 `UDS_ENTRIES` 同步**不在本 PR**（见 pr-007）。

## 涉及功能点

- F05
- F08
- F13
- F15
- F16

## 文件范围

- `oamp/src/registry.js`（`snapshot()` 追加 `connected`；任务条目追加 `started_at`；模块级 `generation`）
- `oamp/src/router.js`（`dispatch` 追加 `router.task_cancel` 分支；`router.status` 结果追加 `generation`）
- `oamp/sdk/uds.js`（会话方法追加 `taskCancel`，与既有 8 个同体例；头注方法清单同步）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-001-router-status-primitives.md`（本 PR 文件）

不触碰：`oamp/src/web.js`、`oamp/src/transport.js`、`oamp/sdk/surface.js`、`oamp/skill/hub.md`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`、`oamp/src/persist.js`（无改动面）。

## 验收标准

- [ ] `router.status` 结果含 `generation`：非空字符串；同一 Router 进程存续期内两次调用取值相同；重启后取值变化（F08 验收 1 / A-07）
- [ ] 节点投影每项含 `connected`（boolean，`connId !== null` 的派生）：既有 4 字段名/取值/顺序不变；`oamp status` 输出逐字不变（`src/status.js:20` 的 `COLUMNS` 未改，F16 验收 1 / G01 验收 3）
- [ ] `connected` 的三态可判据成立：`state='online' && connected=true` / `state='online' && connected=false`（连接断开、租约未过期的窗口，`registry.onConnClosed` 只置 `connId=null`）/ `state='offline'` 墓碑三者可从同一次 `router.status` 区分（A-13）
- [ ] 任务条目含 `started_at`：首次进入 `working` 时写入；未进入过为 `null`；`router.task_list` / `router.task_get` 的既有字段名与值域不变（F05 验收 1 的 `since` 数据源）
- [ ] `uds router.task_cancel --params '{"task_id":"<working 的 id>"}'` ⇒ 返回该任务，`state='failed'`、`result.error='cancelled'`；随后 `task_get` 当刻即为终态（F13 验收 1/3）
- [ ] 对同一 id 重复取消 ⇒ 返回 `TASK_ALREADY_FINAL`（第二次不写、不改已定终态与原因）；不存在 id ⇒ `TASK_NOT_FOUND`；`task_id` 缺失/非法 ⇒ 既有 `INVALID_PARAMS` 错误体例（F13 验收 4/5/6）
- [ ] 终态词表仍为既有四值；`registry.finishTask`（`oamp/src/registry.js:238`）的既有幂等拒写分支未被改写、未新增第五个取值（F13 验收 2 / G01 验收 2）
- [ ] `sdk/uds.js` 的 `connect()` 返回面**仅追加** `taskCancel`，既有 8 个方法签名不变；方法实现走既有 `RpcPeer` 请求路径（不新增第二套帧编解码）（F13；G01 验收 3）
- [ ] 零新增第三方依赖 / 零新 env / 零新配置键；DB 表结构未被触碰（G01 验收 6）
- [ ] 既有 8 个 UDS 方法的语义与响应体未变（逐条对同一组入参比对改动前后的返回形状）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F05-agent-live-state-projection.md`（验收 1/6）、`F08-resume-contract-and-snapshot.md`（验收 1）、`F13-call-cancel.md`（验收 1~6）、`F15-recovery-criteria-health.md`（验收 2/3）、`F16-reconnect-visibility-and-remanage.md`（验收 1/2/6）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §4 A-04 / A-07 / A-10 / A-12 / A-13、§5.2（追加字段表）、§5.3（新增 Router 方法）、§6.1 Z-3 / Z-7、§8（新实体剃刀检验）、§7 L1-02（已确认：`router.task_cancel` 与层 B 8 → 9）
- 代码锚点：`oamp/src/registry.js:153`（`snapshot()` 4 字段投影，本 PR 追加 `connected`）、`oamp/src/registry.js:238-248`（`finishTask` 幂等拒写 = 取消的既有落点）、`oamp/src/registry.js:110-118`（`onConnClosed` 只置 `connId=null` ⇒ 三态中"重连中"的来源）、`oamp/src/router.js:104-108`（`dispatch` 方法分发表）、`oamp/src/router.js:379-383`（`router.status` 分支）、`oamp/sdk/uds.js`（会话方法 1:1 体例）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：`router.status` 两次调用输出（`generation` / 节点 `connected`）+ `task_list` 条目的 `started_at` + `task_cancel` 的四条判据输出（生效 / 重复 / 不存在 / 参数非法）+ 既有 8 方法回归比对 + `oamp status` 输出。载体约定见 `architecture.md` §5.3 与本迭代 `status.md` 的取证体例。）
