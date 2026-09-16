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

- [ ] `ENTRIES` 恰 **49** 条（层 A 29 / 层 B 9 / 层 C 11）；既有 40 条的 `id` / `cmd` / `args` / `flags` / `kind` / `method` / `path` / `acceptsAs` **逐字不变**（`git diff` 只含新增行 + 注释计数行）（G01 验收 4）
- [ ] 层 A 8 条与 pr-005 登记的 8 条新路由**1:1**：`cmd` 名按既有体例（`<资源> <动作>`，如既有 `calls list` / `confirmations list` / `stream events`），`method` / `path` / `args`（路径参数走位置参数）/ `flags`（query 与 body 字段走 `--<字段名>`，`_`→`-`）逐条由该路由的元数据机械推导（F17 验收 3 / L2-12）
- [ ] 层 B 1 条：`router.task_cancel` 经 `UDS_CALLS` 映射到 uds 会话方法（`acceptsAs:false`，与既有 `router.status` / `router.task_get` / `router.task_list` 同列）
- [ ] 逐条真集群可执行（存量 40 条 + 新增 9 条各取其入口名可被 `hub` 顶层解析）：新增的 `api principal(s) …` / `api subscribe` / `api pickup …` / `api calls wait …` / `api calls cancel …` / `api health` 全部可发出请求并按既有退出码语义返回（成功 `0` / 业务失败 `1` / 用法错误 `2` / 连接失败 `3`）（F17 验收 3）
- [ ] `hub uds router.task_cancel --params '{"task_id":"<working 的 id>"}'` ⇒ 生效（`failed` + `error:'cancelled'`）；对已终态 ⇒ 上游 `TASK_ALREADY_FINAL`、退出码 `1`（F13 验收 3/5 的入口侧判据）
- [ ] `hub doctor` 三段仍全 `pass`，且 **R3 探针集未扩**（仍为既有 8 个方法的存在性探测；第 9 个方法由 `router.task_cancel` 的功能验收覆盖）（N-14 / G01 验收 5）
- [ ] `hub doctor` R1 仍 `pass`：层 A 条数与 `API.md` §3 行数一致（29）（与 pr-006 的同一机械锁）
- [ ] `skill/hub.md`：层 A 清单 **29** 条、层 B 清单 **9** 条，与 `ENTRIES` 逐条同名同数（任一侧增删必撞另一侧）
- [ ] `skill/hub.md` 的层 C 清单 11 条与 `doctor` 段落**未改**；四条红线的语义未改（不裸写 HTTP / 不复制 schema / 退出码语义 / 边界只到子命令名）
- [ ] **F19 验收 1**：`skill/hub.md` 中**同时**出现 `--mode block` 与 `cli task watch` 两条现成等待路径，且各自说明适用场景（何时用哪条）
- [ ] **F19 验收 2**：「序列 1」的主推路径为上述现成原语（派发 → 等待 → 取件），`calls get` + sleep 型轮询降为**兜底说明**（明确写出"轮询是兜底"）
- [ ] **F19 验收 3**：本 PR 不新增任何 CLI / API 能力；文档所述与实现一致，差异一律以**实际行为**为准（权威归属 = D-14）；等待语义条文只**指向** `oamp/API.md` 的等待语义小节，不复写条文
- [ ] 零新增依赖；`oamp/sdk/cli.js` / `oamp/sdk/doctor.js` 未被修改（表驱动分派的既有实现零改动）

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

（本 PR 执行时填写：`ENTRIES` 条数与分层计数 + 既有 40 条的逐条不变比对（`git diff` 原文）+ 新增 9 条的真集群执行输出（含退出码）+ `hub uds router.task_cancel` 两条判据输出 + `hub doctor` 三段输出 + `skill/hub.md` 清单计数与「序列 1」原文 + F19 两条原语出现位置的 `grep` 输出。）
