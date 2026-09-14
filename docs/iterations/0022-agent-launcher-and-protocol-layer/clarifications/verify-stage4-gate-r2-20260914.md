# 阶段 4 → 5 入口 Gate · 独立验证报告（第二轮：修订后的 `prs/`，5 个 PR）

**验证者身份（反射结果）**：**PR 计划审查者**（sprint / PR 划分与依赖图审查）——由产出物类型（5 份 PR 规划文件 = 提交单元划分 + 单元间依赖声明）与验证标准（粒度三锚点 A1~A3 + 依赖正确性三类判据 B1~B3）反射得到。B1 的判据面本身指向代码库，故本报告在该身份下另做一层**代码级耦合校验**（读 `oamp/` 源码逐条核对 `depends_on` 所引共享符号 / 接口 / 文件的真实存在与口径一致性）。

**产出物**（只读验证，未修改任何一个）

- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-001-launcher-and-protocol-config.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-002-test-face-profile-pinning.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-003-protocol-layer-and-consumption-cutover.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-004-stream-kind-partition-ui.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-005-protocol-layer-and-injection-entry.md`

**验证标准来源**：主 agent 委托指定的两条标准（标准 A · PR 粒度判断框架 A1~A3；标准 B · 依赖正确性验证 B1~B3），逐字采用，未增删判据、未以通用最佳实践替代、未做「基本通过」类模糊判定。

**验证日期**：2026-09-14

**对照面（只读，不验证其内容为真）**：`prd.md` + `prd/F01~F13*.md`（13 张卡）、`architecture.md`（v0.2.0，844 行）、代码库 `oamp/`。另：同目录 `clarifications/verify-stage4-gate-20260914.md`（第一轮报告）**仅用于核查 r1 已登记偏差是否被承接**，不作为任何判定的依据（见「偏差记录」D-4 / D-7 / D-8）。

**执行过程上下文声明**：**未使用**。本报告未读取也未引用 `clarifications/2026-09-14-pr-planner-round1.md`、`2026-09-14-pr-planner-round2.md`、`clarifications/briefs/**` 等执行过程材料；全部判定以产出物文本 + `oamp/` 源码实测为据。

---

## 证据行（E-1~E-9：本次机械核实结果，均在会话工作区内实跑）

- **E-1 · 零消费方 / 零读者（pr-002 惰性与 pr-005 加性拆分的前提）**：`grep -rn "rpc-client\|oneshot-client" oamp/{src,test,web}` ⇒ **零命中**；`grep -rn "OAMP_PROTOCOL" oamp/{src,test,web,bin}` ⇒ **零命中**。
- **E-2 · 测试面受影响全集（B3 的对称核查面）**：ACP-only 桩（`FAKE_ACP_SOURCE` 或 `msg.method ===`）= **7** 文件：`acp-daemon` / `call-protocol` / `confirmation-roundtrip` / `context-pool` / `project-workspace` / `tool-permission` / `web`；注入 `OAMP_OMP_BIN` 的也是 7 文件（同上 − `tool-permission` + `omp-executor`）；`'acp'` 字面量命中 6 文件（含 `tool-permission`，不含 `call-protocol`）。`omp-executor.test.js` 的桩读 `process.argv` 末位（`oamp/test/omp-executor.test.js:20-21`）＝一次性 `-p` 形态，不受常驻默认协议切换影响 ⇒ **pr-002 的 4 个 + pr-003 的 3 个 = 全部受影响面**，零遗漏、零多余。
- **E-3 · 计数口径**：`oamp/test/*.test.js` = **29**；`oamp/test/**/*.js` = **31**（含 `helpers/harness.js`、`helpers/fake-node.js`）⇒ pr-001「28」/ pr-002「25」/ pr-003「29+1+1=31」/ pr-005「29」四处数字与实测**全部一致**（r1 的 D-4 已修正）。
- **E-4 · pr-001 锚点**：`oamp/src/acp-client.js:137`（`const args = ['acp','--no-skills','--no-rules']`）、`oamp/src/agent.js:190-199`（`-p` argv 段）、`oamp/src/config.js:13-17`（三键默认值常量；pr-001 引作 `:8-26` 为**包含该段**的区间，非错指）、`oamp/test/config-file.test.js:30-41`（全对象 `assert.deepEqual(config, {...})`，用例名与 pr-001 引用**逐字一致**）。
- **E-5 · pr-002 锚点**：4 文件注入点逐条命中（`acp-daemon.test.js:246`/`:466-469`/`:501-526`/`:698`、`context-pool.test.js:201`/`:203`/`:267`、`project-workspace.test.js:225`、`call-protocol.test.js:295`/`:301`）；argv 断言命中（`acp-daemon.test.js:546`/`:552`/`:560`/`:570-574`、`context-pool.test.js:506`/`:513`/`:525`/`:531`、`call-protocol.test.js:757`）。
- **E-6 · pr-003 锚点**：`acp-client.js:30-34`/`:42-48`/`:77`（`export class AcpClient {`）/`:137`/`:191`/`:207`/`:201-203`（`_chunkHandler` 只接受 `agent_message_chunk`）/`:434-575`；`context-pool.js:7`/`:150`/`:157`/`:186`/`:203`（构造 **10** 键，见 D-2）/`:151`/`:153`/`:168`/`:178`/`:191`/`:242`/`:251`/`:257`（引用 `AcpError`）/`:211-218`（`auditContext` 四键 + 惰性 `context_id` getter）+ `:219`（`logger`）+ `:220`（`onExit`）；`agent.js:181-280`/`:190-199`/`:372`/`:396`/`:589`/`:592`/`:698`/`:26`（`MAX_STREAM_LINES = 200`）；测试面 `web.test.js:557`/`:573`/`:627`、`confirmation-roundtrip.test.js:20`/`:202`/`:263`/`:319`/`:354`/`:386`/`:703-711`、`tool-permission.test.js:12`/`:307`/`:329`/`:338`/`:441`/`:493`/`:510`/`:516`/`:527`/`:709`/`:857` ⇒ 除 D-1 / D-3 两处**表述**外全部命中。
- **E-7 · pr-004 锚点**：`web/app.js:421`（`id="stream-text"`）/`:563`（`function handleEvent`）/`:566-572`（`task_update` 分支，现状不分 `kind`）/`:601-611`（`appendChunk`）命中；**4 类事件订阅行在 `:550`**（pr-004 引作 `:556`，见 D-4）；顶层六函数在场（`loadProjects:737`/`renderProjects:750`/`createProject:773`/`resolveCurrentProject:799`/`showProjectList:809`/`showWorkspace:817`）；`^import |require(` 命中 **0**；现状对 `kind` 的唯一使用在 `:595`（`context_reset` 文案）。
- **E-8 · pr-005 锚点与结构判据**：`architecture.md:310`（§3.3 `rpc-client.js` 判据行 =「文件的 import 只有 `node:*` / `protocol.js` / `launcher.js`」）、`:309`（`protocol.js` =「全仓 `grep`：只有本文件 import 三个实现模块」）、`:681-683`（§9.1 B-2/B-3/B-4）、`:601`/`:602`/`:604`（§5.7：rpc `thinking:'yes'` / oneshot `streaming:'degraded'` / oneshot `approvalGate:'no'`）；`oamp/test/hygiene.test.js` 三条断言 = `.gitignore 含 .runtime/` / 凭据词扫描（扫 `bin/`+`src/`+`package.json`）/ `dependencies` 为空，**无「孤儿模块」断言**。
- **E-9 · 变更点映射**（architecture §9 逐条落入 PR 文件范围，零遗漏零重复）：§9.1 B-1~B-4（`architecture.md:680-683`）→ pr-001（B-1）、pr-005（B-2/B-3/B-4）；§9.2 B-5~B-10（`:689-694`）→ pr-004（B-5）、pr-003（B-6/B-7/B-8/B-10）、pr-001（B-9）；§9.4.1 B-11~B-15（`:708-712`）→ pr-002（B-11/B-12/B-15-project-workspace）、pr-003（B-13/B-14/B-15-confirmation-roundtrip）；§9.4.2 B-16/B-17（`:718-719`）→ pr-005（B-16）、pr-003（B-17 新建）+ pr-003（B-16 的 acp 侧并入 `tool-permission.test.js`）。

### 文件范围矩阵（5 PR 两两交集 = ∅）

| PR | 新增 | 修改 | 涉及功能点 | batch | depends_on |
|---|---|---|---|---|---|
| pr-001 | `oamp/src/launcher.js` | `oamp/src/config.js`、`oamp/test/config-file.test.js` | F01 F10 F12 F13 | 1 | （无） |
| pr-002 | — | `oamp/test/{acp-daemon,context-pool,project-workspace,call-protocol}.test.js` | F03 F06 | 2 | pr-001 |
| pr-003 | `oamp/test/zero-intrusion.test.js` | `oamp/src/{acp-client,context-pool,agent}.js`、`oamp/test/{web,confirmation-roundtrip,tool-permission}.test.js`、`oamp/README.md` | F01 F02 F03 F05 F06 F07 F08 F09 F10 F11 F12 | 3 | pr-005、pr-002、pr-001 |
| pr-004 | — | `oamp/web/app.js`（+ 条件 `oamp/web/style.css`） | F08 | 1 | （无） |
| pr-005 | `oamp/src/{protocol,rpc-client,oneshot-client}.js`、`oamp/test/protocol-layer.test.js` | — | F01 F02 F04 F07 F09 F11 F12 | 2 | pr-001 |

**功能点并集 = F01~F13（13/13）**；**文件范围两两交集为空**；同名文件仅出现在他 PR 的「零改动」清单（显式让渡，如 `prs/pr-003-…md:34`、`prs/pr-005-…md:24`）。

---

## 逐项判定

### 标准 A · PR 粒度判断框架（5 PR × 3 锚点 = 15 项）

#### pr-001 · `pr-001-launcher-and-protocol-config.md`

- **A1 逻辑原子性：pass**
  - 子项 ①「只做一件可描述的事」**通过**：本 PR 的范围 = `oamp/src/launcher.js`（新建）+ `oamp/src/config.js` 第 4 键（`prs/pr-001-…md:14-19`）。architecture 自己把二者定义为**同一个 L1 单元**——`architecture.md:637`（§7 T-01）：「**L1** = `launcher.js`（profile + argv + spawn）+ `config.js`（第 4 键）」；`:307-308`（§3.3 三层落点表）把二者并列为同一「L1 启动服务」行组；`:506-533`（§5.2）的 `PROFILES` 键空间（`omp:rpc` / `omp:acp` / `omp:oneshot`）以 protocol 为后缀，与第 4 键取值域 `{rpc, acp}` **同源**（§5.3 解析链第 2/3 层取值即该键，`architecture.md:539`）。子项判据面：改写本 PR 只需一个主题「L1 启动服务层的数据落点」。
  - 子项 ②「回滚不影响无关功能」**通过**：全仓对 `launcher.js` 零引用（E-1）⇒ 回滚只撤回无消费方的新增面；回滚会波及 pr-002 / pr-003 / pr-005（其声明依赖方），属**相关方**而非「无关功能」。
  - 与 r1 的判定差异已登记（D-8，r1 以「无 import 关系」判 partial）。
- **A2 可审查性：pass**：两个变更点同属「数据面新增、零消费方、行为零变更」；验收标准 8 条（`prs/pr-001-…md:24-36`）全部为数据面/静态检索判据（`import` 集合、profile 字段集、`git diff --stat`、`node --test config-file.test.js`），不含任何运行路径判据 ⇒ reviewer 不切换心智模型。锚点逐条命中（E-4）。
- **A3 独立性：pass**：8 条验收标准**无一条**需要其他 PR 合并——`node --test oamp/test/config-file.test.js oamp/test/hygiene.test.js`（两文件实测存在）、`git diff --stat` 面、`grep` 面均可独立判定；`depends_on` 为「（无）」（`prs/pr-001-…md:48-50`）与「零消费方」事实一致（E-1）。

#### pr-002 · `pr-002-test-face-profile-pinning.md`

- **A1 逻辑原子性：pass**：单一事务 =「把既有测试面『内置默认即 acp』的隐式假设换成显式注入 + argv 期望值真源迁移到 L1 profile」；范围 = 4 个测试文件（`prs/pr-002-…md:12-20`），零改动面明列 `oamp/src/**` 全部；回滚只影响测试面，不触碰任何生产行为（同 PR 验收第 4~5 条即以此为可判定性前提）。4 文件确属同一族群（E-2：均为 ACP-only 桩，均经 `OAMP_OMP_BIN` 注入）。
- **A2 可审查性：pass**：4 文件同一心智模型（伪装桩 → 注入固定协议 → 期望值来源统一）；所引锚点逐条回代码命中（E-5），无跨层混合、无逻辑跳跃。
- **A3 独立性：pass（条目级说明）**：验收 6 条（`prs/pr-002-…md:22-29`）中，第 1/3/4/5/6 条可在本 PR 内独立判定（第 5 条「注入在切换落地前为惰性」= 对 `oamp/src` 的机械检索，今日即零命中，E-1）；**第 2 条需 pr-001 的 `PROFILES` 表存在** —— 该前置已被 `depends_on` 显式声明（`:40-42`），不构成未声明的前置（判定口径：A3 约束的是「不得依赖未声明的第三方 PR」，已声明的依赖由标准 B 校验；见 r1 同一口径）。

#### pr-003 · `pr-003-protocol-layer-and-consumption-cutover.md`

- **A1 逻辑原子性：pass（条目级）**
  - 子项 ①「只做一件可描述的事」**通过**：本轮重划后 =「把消费层（及其唯一实现 acp）切到标准面，并让常驻链路默认走 rpc」（`prs/pr-003-…md:3-6`），协议层本体（`protocol.js` / `rpc-client.js` / `oneshot-client.js` + 自证用例）已移出到 pr-005（`prs/pr-005-…md:17-22`）⇒ 原 r1 的 fail 诱因（60% 生产变更点、跨 L1~L3 三层、5 套心智模型中的 RPC 帧语义一整套）**已不在本 PR 内**。
  - 子项 ②「剩余三文件是否被迫同批」**通过（代码级强制）**：`acp-client.js` 的 `onChunk → onDelta` 外观改名与 `AcpError → ProtocolError` 类型变更**立刻**打破其唯一消费方——`context-pool.js:186` 透传 `onChunk`、`:151`/`:153`/`:168`/`:178`/`:191`/`:242`/`:251`/`:257` 引用 `AcpError`，且 `oamp/test/tool-permission.test.js:12` 直引 `AcpClient`、`:441` 断言 `err.name === 'AcpError'`；`agent.js:396` 亦经 `onChunk` 消费（E-6 全部命中）⇒ 三者（+ 该测试文件）必须同批。
  - 子项 ③「agent.js 内的 oneshot 迁移与 `--protocol` flag 是否构成第二单元」**通过（不可再分）**：阶段 4 的推进条件本身禁止「PR 间文件范围重叠」，故 `agent.js` 的 ③④ 子变更与 ①（注入点改造）**不可能由两个 PR 各自承担**；`runOmpTask`（`:181-280`）若保留在本 PR 之外，则需第二次改 `agent.js`。
  - 子项 ④「回滚不影响无关功能」**通过**：回滚本 PR 即恢复 acp 常驻 + 旧 `onChunk`/`AcpError` 外观，pr-005 的三模块退回零消费方（E-1），前端（pr-004）与该 PR 无文件/符号交集（E-7）⇒ 无关功能不受影响。
- **A2 可审查性：pass**：残留判据面收敛为**一个主题**——「标准面替换 → 逐个消费方补偿 → 行为零回归」；四套子面（acp 外观对齐 / 池接线 / 一次性迁移 / CLI + README）均是该替换的**后果**，而非并列的新主题。对照 r1（当时含「RPC 帧映射」这一独立协议语义面）已消除。
- **A3 独立性：pass**：验收标准 16 条（`prs/pr-003-…md:38-55`）的判定面全部落在本 PR 内——D-2/D-3 = 机械 `grep` + `git diff`；默认 rpc / 指定即生效 = 运行时被启动子进程 argv（`prs/pr-003-…md:42-43`，同 PR 明示「不依赖 pr-005 的 `protocol-layer.test.js`」）；入库面 = 恰两条记录；能力位 = acp 实例断言。对外仅依赖已声明三依赖（`:75-79`）。与 pr-004 无判据交叉（F08 两面按 `MI-01` 拆分：本 PR 判管道/入库面，pr-004 判界面面）。

#### pr-004 · `pr-004-stream-kind-partition-ui.md`

- **A1 逻辑原子性：pass**：单一事务 =「既有流式气泡内按 `task_update.kind` 分区渲染」；范围 = 1 个前端文件（+ 条件纳入 `style.css`，`prs/pr-004-…md:11-16`）；零改动面明列 `oamp/src/web.js`、`oamp/web/index.html`、`oamp/test/**`；回滚只影响前端渲染。
- **A2 可审查性：pass**：4 个改动锚点全部落在同一文件同一分支的同一心智模型内（`:421` / `:563` / `:566-572` / `:601-611`，E-7 逐条命中）；「既有六函数在场」的声称亦核实（E-7）。**锚点精度偏差**见 D-4（`:556` 实测 `:550`），不影响可审查性（字面串与检索式同时给出）。
- **A3 独立性：pass（本轮由 partial 升为 pass，理由见下）**
  - 子项 ① 验收 1~5 **通过**：第 2 条给出不依赖真实 rpc 链路的判定法（浏览器控制台直调页面顶层函数 `handleEvent('task_update', {…})` 观察落点）；第 5 条为既有静态契约用例（且自述「不以改测试达成」）。
  - 子项 ② F08 验收 1 端到端形态的**验收时序**：本轮已在 `depends_on` 段内显式登记（`prs/pr-004-…md:36-38`：「端到端形态在**复核时点**上依赖 pr-003……不得在本 PR 单独合并时判其端到端面通过」，并区分「验收时序依赖 ≠ 合并前置」）⇒ r1 的 partial 诱因（缺口未披露）已消除，且未虚增 `depends_on` 边（无共享符号，E-7 `^import |require(` = 0）。

#### pr-005 · `pr-005-protocol-layer-and-injection-entry.md`

- **A1 逻辑原子性：pass**：单一事务 =「把标准面写下来，并交付其中两个自洽实现（rpc / oneshot）」；范围 = 3 个新模块 + 1 个新用例（`prs/pr-005-…md:17-22`），**零消费方**（E-1 实测：`oamp/{src,test,web}` 对三模块零引用）⇒ 加性落地、行为零变更；回滚只撤回无引用面。三文件共享同一契约（`protocol.js` 导出 `ProtocolError` / `CAPABILITY_KEYS` / `createProtocolLayer`，两实现按 §5.1 标准面实现）而非三个并列主题。**边界稳定性**另有正面证据：同 PR 显式禁令——门名原语不得从 `acp-client.js` 引入（否则构成 `pr-005 → pr-003` 反边成环）、`AcpClient` 构造入参集合在本 PR 内固定（`prs/pr-005-…md:26-29`）⇒ 加性拆分不会制造隐式反向依赖。
- **A2 可审查性：pass**：审查面 = 一份标准面 + 两个实现 + 一个自证用例，同一心智模型（契约 → 实现 → 断言）；验收标准 14 条（`prs/pr-005-…md:33-46`）全部落在协议层自身观测面（fake bin argv、帧级夹具、能力位表、`hygiene.test.js` 静态卫生）。
- **A3 独立性：pass**：验收判据可在本 PR 内判定——能力位断言只覆盖本 PR 交付的 `rpc` / `oneshot`（acp 侧明示归 pr-003）；「默认走 rpc / 指定即生效」的观察面 = 本 PR 的 fake bin 记 argv；「零消费方」由 `grep` + `git diff --stat` 判定（`prs/pr-005-…md:37`、`:43`）。**但验收第 1 条的 import 白名单口径与 `protocol.js` 的性质冲突**（字面判定必假）⇒ 见 D-3（偏离的是条文的可满足性，不是独立性；判定仍为 pass，缺陷登记为偏差并给出修正建议）。

### 标准 B · 依赖正确性验证（5 PR × 3 判据 = 15 项）

#### pr-001

- **B1（本 PR 的 `depends_on` 为「无」——成立性核实）：pass**。成立依据两项实测：① `oamp/src/launcher.js` 尚无消费方、`oamp/src/config.js` 第 4 键尚无读者（E-1 零命中）⇒ 不引用任何其他 PR 的新增符号；② 本 PR 的新增面之间也不互相引用（`config.js` 自述叶子模块，`oamp/src/config.js:2`「只依赖 `node:` 内置模块，不 import src 内任何模块」）⇒ 无入边。
- **B2 依赖图无环（本 PR 的边）：pass**：出边 0、入边（被依赖）3（pr-002 / pr-003 / pr-005）——所有边方向为「被依赖 → 本 PR」，无回边。
- **B3 范围与覆盖（本 PR）：pass**：文件范围 3 项与其余 4 个 PR 交集为空（矩阵）；承载 architecture §9.1 B-1（`:680`）与 §9.2 B-9（`:693`）两处变更点（E-9）；F13 由本 PR 以「零改动承诺 + 验收 2（不与 `instances[]` 合并）」承载，与 F13 的**保证项**性质（`prd.md` 功能点索引 + `architecture.md:629`）一致。

#### pr-002

- **B1：pass（一条依赖：pr-002 → pr-001）**。共享符号真实存在且**强度已锁死**：本 PR 验收第 2 条要求 argv 期望值**直接引用** `oamp/src/launcher.js` 的 `PROFILES['omp:acp']` / `PROFILES['omp:oneshot']`，并明示「不得以本地复写的『一致期望数组』替代（那会使本 PR 对 pr-001 的依赖在实现层可被绕过、退化为顺序偏好）」（`prs/pr-002-…md:25`）⇒ r1 的 D-2（依赖可绕过）已修复；`OAMP_PROTOCOL` 键由 pr-001 的 `oamp/src/config.js` 第 4 键交付（E-1 今日零命中，故该键确为 pr-001 的新增产出）。
- **B2：pass**：唯一出边指向 pr-001；pr-001 的 `depends_on` 为空 ⇒ 无边可成环；与 pr-005（同批 2）之间**无隐藏边**：本 PR 的注入在 pr-005 落地后仍不进入任何运行路径（消费层未接线，pr-003 才接线）⇒ 两者合并序可互换，与 `batch` 同值 2 一致。
- **B3：pass**：4 个测试文件（`prs/pr-002-…md:12-20`）与其余 4 个 PR 交集为空；测试面覆盖经 E-2 独立复核 = 受影响集合「pr-002 的 4 + pr-003 的 3」无遗漏无多余；D-1（architecture §9.4.1 列 6 实为 7）已由本 PR 正文登记（`prs/pr-002-…md:19`）。

#### pr-003

- **B1：pass（三条依赖逐条有代码级证据）**
  - **→ pr-005**：共享符号 = `oamp/src/protocol.js` 的 `ProtocolError` / `CAPABILITY_KEYS` / `createProtocolLayer`（pr-005 文件范围 `prs/pr-005-…md:19` 写定三者）；替换面逐处可指：`oamp/src/acp-client.js:42-48`（本地 `AcpError` 类）、`oamp/src/context-pool.js:7`（`import { AcpClient, AcpError }`）与 `:191`/`:251`（`instanceof`）及 `:151`/`:153`/`:168`/`:178`/`:242`/`:257`（`new AcpError`）、`oamp/src/agent.js:698`（`new ContextPool({...})` 的构造面）——E-6 全部命中 ⇒ pr-005 未合并时本 PR 的 import 目标不存在。
  - **→ pr-002**：真实合并序耦合（文件 + 行为双重）：4 个 harness 测试文件的 fake omp 桩**只实现 ACP JSON-RPC**（`prs/pr-002-…md:3-6`）（E-2：`FAKE_ACP_SOURCE` + `msg.method` 分支），默认切 rpc 后桩不回包 ⇒ 整组失败；代码证据 `oamp/test/call-protocol.test.js:757`（`call_update.kind ∈ {chunk,stdout,stderr}`）、`oamp/test/context-pool.test.js:506`（一次性用例）/`:531`（`argvs.find((a) => a[0] === 'acp')`）、`oamp/test/acp-daemon.test.js:546`（`devArgv = readJsonl(devArgs).find((a) => a[0] === 'acp')`）——E-5 命中；文件级让渡另见本 PR 零改动清单（`prs/pr-003-…md:34`）。
  - **→ pr-001**：argv 真源 = `PROFILES` + `buildArgv`（现状两处 argv 生产点 `oamp/src/acp-client.js:137` 与 `oamp/src/agent.js:190-199`，E-4/E-6 命中）；解析链第 2/3 层取值 = pr-001 的 `oamp/src/config.js` 第 4 键（`architecture.md:539`）。
- **B2：pass**：出边 {pr-005, pr-002, pr-001} 全部指向 `depends_on` 为空或仅依赖 pr-001 的 PR；DFS 无回边。**反向边已被显式封堵**：pr-005 的「门名解析原语不得从 `acp-client.js` 引入」禁令（`prs/pr-005-…md:26-27`）正是为避免 `pr-005 → pr-003` 与 `pr-003 → pr-005` 成环 ⇒ 环风险有预防性证据，非默认无环。
- **B3：pass**：8 个文件（3 生产 + 4 既有测试 + 1 新建测试 + 1 文档）与其余 4 个 PR 交集为空；架构变更点覆盖 B-6/B-7/B-8/B-10/B-13/B-14/B-15-confirmation-roundtrip/B-17 + B-16-acp 侧（E-9）；F 引用 11/13 卡，未与其他 PR 的文件范围冲突。

#### pr-004

- **B1（`depends_on` 为「无」——成立性核实）：pass**。两项实测：① `oamp/web/app.js` 零 import / 零 require（E-7）⇒ 不引用任何 `src/**` 符号；② 上游 `oamp/src/web.js` 已按 `kind` 原样透传（`oamp/src/web.js:1626-1632`：`if (typeof body.kind !== 'string') return;` 后 `transport.publish(… {kind, text, line})`）⇒ 无共享符号 / 无共享接口 / 无共享文件，符合「不声明依赖」。同 PR 另以「F08 端到端形态的验收时序」段落区分「非合并前置」（`prs/pr-004-…md:36-38`），未虚增边。
- **B2：pass**：入边 0、出边 0 ⇒ 孤立节点，不参与任何环；与 pr-001 同批（batch 1）可并发，不违反调度语义（无依赖 ≠ 需串行）。
- **B3：pass**：文件范围（`oamp/web/app.js` + 条件 `oamp/web/style.css`）与其余 4 个 PR 交集为空（`style.css` 在 architecture §9.3 为「实现阶段确认」项、pr-003 明列归 pr-004，无争用）；承载 §9.2 B-5（`:689`）；F08 与 pr-003 的 F08 面按管道/界面拆分，无功能点遗漏。

#### pr-005

- **B1：pass（一条依赖：pr-005 → pr-001）**。共享产出两项：① 两实现的 argv 由 pr-001 新建的 `oamp/src/launcher.js` 的 `PROFILES` + 唯一构造产出（`architecture.md:310` 白名单行、`:307` L1 判据行「`-p` 与 `--mode rpc` 的 argv 均出自本模块」，E-8）；证据 = 现状两处 argv 生产点 `oamp/src/acp-client.js:137`、`oamp/src/agent.js:190-199` 在本 PR 内改为只经 L1 产出（E-4/E-6 命中）；② 解析链第 2/3 层取值 = pr-001 的 `config.js` 第 4 键。**附**：本 PR 声明的「现状 `AcpClient` 构造入参集合」不完整（8 键 vs 实测 10 键）⇒ D-2，属证据口径缺陷，不影响该依赖边的存在（argv / 解析链两项证据独立成立）。
- **B2：pass**：唯一出边指向 pr-001（其 `depends_on` 为空）⇒ 无环；与 pr-003 之间**无反向边**（禁令见 `prs/pr-005-…md:26-29`）；与 pr-002 之间无边且合并序可互换（E-1 + pr-005 验收「零消费方」）。
- **B3：pass**：4 个新文件与其余 4 个 PR 交集为空；承载 §9.1 B-2/B-3/B-4 与 §9.4.2 B-16（E-9）；F 引用 7 卡，acp 侧标准面断言明示让渡给 pr-003，无功能点遗漏、无与 pr-003 的文件争用。

### 汇总表

| 判据 | pr-001 | pr-002 | pr-003 | pr-004 | pr-005 |
|---|---|---|---|---|---|
| A1 逻辑原子性 | pass | pass | pass | pass | pass |
| A2 可审查性 | pass | pass | pass | pass | pass |
| A3 独立性 | pass | pass | pass | pass | pass |
| B1 依赖证据 | pass（无依赖成立） | pass | pass | pass（无依赖成立） | pass |
| B2 依赖图无环 | pass | pass | pass | pass | pass |
| B3 范围与覆盖 | pass | pass | pass | pass | pass |

**全局项（覆盖 5 个 PR）**：B2 全局依赖图 = `{pr-002→pr-001, pr-003→pr-005, pr-003→pr-002, pr-003→pr-001, pr-005→pr-001}`，节点 5、边 5、**无环**（拓扑序：pr-001 → {pr-002, pr-005, pr-004} → pr-003）；B3 全局 = F01~F13 **13/13 被引用**、architecture B-1~B-17 **17/17 各被唯一 PR 的文件范围承载**（E-9）、文件范围两两交集 **∅**。5 份 PR 文件均含完整七字段（各 7 个二级标题，实测 `grep -c '^## '` = 7）。

## 汇总

- **pass: 30**
- **fail: 0**（无需返工）
- **partial: 0**（无条目级混合）
- **blocked: 0**（信息齐备）

分布：标准 A 15/15 pass、标准 B 15/15 pass。分布明细见「汇总表」。

## 偏差记录

| # | 规格 / 文档描述 | 产物 / 实现实际 | 建议处理 |
|---|---|---|---|
| **D-1** | pr-003 的 `AcpError` 锚点表述：文件范围（`prs/pr-003-…md:26`）与 `depends_on`（`:77`）称 `oamp/src/context-pool.js:151`/`:153`/`:168`/`:178`/`:191`/`:242`/`:251`/`:257` 判 `instanceof AcpError` | 实测（E-6）：仅 `:191` 与 `:251` 是 `instanceof AcpError`；`:151`/`:153`/`:168`/`:178`/`:242`/`:257` 为 `new AcpError(...)` 构造（同样需改类型，但性质不同） | 表述改为「引用 `AcpError` 的 8 处（其中 `instanceof` 判定在 `:191`/`:251`）」；不影响任何判定与依赖边 |
| **D-2** | pr-005「边界稳定约束」称现状 `oamp/src/context-pool.js:203` 的构造入参集合 = `{bin, model, cwd, logger, tools, permission, roleFile, onPermissionRequest}`（8 键）并为 pr-005 固定面（`prs/pr-005-…md:29`） | 实测该构造为 **10** 键（`oamp/src/context-pool.js:203-220`）：另含 `auditContext`（四键 `instance/role/chat_id` + 惰性 `context_id` getter，`:211-218`）与 `onExit`（`:220`）。且 pr-003 要求注入的会话工厂「含 `auditContext` 四键」（`prs/pr-003-…md:26`）⇒ 一侧声明的固定面与另一侧的承载要求不闭合 | **优先修正**（阶段 5 派发前）：pr-005 的入参面更正为 10 键，并在 `createResident(...)` 入参或文件范围写明 `auditContext`（四键 + 惰性 `context_id`）与 `onExit` 的装配归属，避免阶段 5 装配丢审计面 / 退出回调 |
| **D-3** | pr-005 验收第 1 条（`prs/pr-005-…md:33`）：「`protocol.js` / `rpc-client.js` / `oneshot-client.js` 的 import 集合 ⊆ `node:*` ∪ `{./protocol.js, ./launcher.js}`」 | 与同 PR 文件范围 `:19`「`protocol.js` …**全仓唯一 import 三个实现模块的文件**」及 `architecture.md:309` 直接冲突 ⇒ 对 `protocol.js` 字面判定必假（其 import 必含 `./rpc-client.js` / `./oneshot-client.js` / `./acp-client.js`；`architecture.md:310` 的白名单判据只挂在 `rpc-client.js` 行） | **优先修正**（阶段 5 派发前）：白名单限定到 `rpc-client.js` / `oneshot-client.js`；`protocol.js` 改述为「零第三方依赖 + 只 import 三实现模块与 `launcher.js`」 |
| **D-4** | pr-004 引 `oamp/web/app.js:556` 为「4 类事件订阅」（`prs/pr-004-…md:13` 与 `:31` 两处） | 实测该行为 `oamp/web/app.js:550`（`for (const type of ['message','task_update','chat_state','notice'])`），偏移 6 行；r1 已指出、本轮未修正。其余 4 个锚点（`:421`/`:563`/`:566-572`/`:601-611`）命中 | 行号更正为 `:550`（保留检索式双锚即可自愈） |
| **D-5** | `status.md`（主 agent 维护）§阶段状态第 4 行：「产出 **4 个 PR**（`prs/pr-001~004`）；依赖图无环；文件范围零重叠；13/13 卡覆盖 ⇒ Gate 验证中」 | `prs/` 实测 **5** 个文件（新增 pr-005，pr-003 已重划为消费层切换）；`status.md` 的 mtime 早于本轮重划 | 阶段 4 收口时更新为 5 个 PR（pr-001~005）并登记重划事实（属主 agent 维护面，不在被验证产物内） |
| **D-6** | 同一验收条目被两个 PR 各自主张（无「择一判定」声明）：① F02 验收 1/2「指定即生效」在 pr-003（`prs/pr-003-…md:42`，观测面 = 端到端被启动子进程 argv）与 pr-005（`prs/pr-005-…md:37`，观测面 = 工厂层 fake bin argv）；② F08 验收 1/2 在 pr-003（管道/入库面）与 pr-004（界面面）；③ F06 验收 1 在 pr-002（测试面固定）与 pr-003（行为回归） | 三处均已各自限定观测面（口径本身自洽），但**无一处**写明「择一判定 / 两层各判一次」 | 阶段 5/6 的判定清单按「观测面」登记归属，避免同一条目被判两次或双方互推；建议在 PR 文件内加一行「本 PR 判据面」 |
| **D-7** | `architecture.md` §9.4.1「既有测试面 · 最小更新」列 **6 文件**（`:704-712`） | 实测 ACP-only 桩文件 = **7** 个（E-2），第 7 个 `oamp/test/call-protocol.test.js` 由 pr-002 承担（`prs/pr-002-…md:19` 已登记正确口径）；architecture 本体未回填 | 主 agent 回填 §9.4.1（或改为按桩分布派生的清单）；pr-002 / pr-003 的处置已正确，无需改 PR |
| **D-8** | r1 报告判 pr-001 A1 = partial（子项②：`launcher.js` 与 `config.js` 第 4 键无代码级耦合、可各自独立回滚） | 本报告独立复核后判 **pass**：`architecture.md:637`（T-01）将 L1 定义为「`launcher.js` + `config.js` 第 4 键」的**同一层单元**，`:307-308` 为同一行组；`PROFILES` 键空间（`:506-533`）以 protocol 为后缀，与第 4 键取值域同源；两者同为纯数据面、零消费方、同批回滚 | 请主 agent 明确 A1 口径（「单个模块内的一个主题」vs「同层同一数据面单元可含多文件」）；若取严格口径，该子项回落 partial，**不影响可合并性与依赖图**（依赖图 5 边、无环，两种口径下结论一致） |
| **—** | **`deferred-demand-changes.md`：不存在**（核实结论） | `find docs -name "*deferred*"`（含迭代根目录与 `clarifications/`）**零结果**；`prd.md`「疑问与越界」第 6 条亦声明「未写入 `deferred-demand-changes.md`」 | 无内容可摘录；本迭代至今无搭置项 |

## 下一迭代候选

1. **pr-005 的接口固定面与验收第 1 条口径（D-2 / D-3）**：两处均为**文本级**缺陷、可在阶段 5 派发前就地修正，不必留到下迭代；若不修正，阶段 5 的装配可能丢 `auditContext` / `onExit`，且验收第 1 条无法判定。
2. **跨 PR 验收观测面归属表（D-6）**：建议在 PR 文件（或 `status.md` 的阶段 5 区块）固定一个「本 PR 判据面」字段，供阶段 6 逐条复核直接引用，消除同一验收条目的双判/互推风险。
3. **跨 PR 接口的写定权集中（由 D-2 暴露的一般问题）**：本次出现「同一接口被两个 PR 分别写定 / 引用且口径不一致」的情形；建议约定「接口面由被依赖 PR 一次性写定，依赖方只引用 + 复核」，并把该约定写入 PR 文件的 `depends_on` 理由段。
4. **锚点行号的机械自愈（D-4 / D-1）**：手写 `文件:行号` 已两轮出现偏移/性质误述；建议阶段 4 的锚点统一写成「检索式 + 行号」双锚，或在 Gate 派发前跑一次锚点校验脚本。
5. **`status.md` 与 `prs/` 的同步（D-5）**：重划后 `status.md` 仍记 4 个 PR；建议把「PR 数量与文件名」改为从 `prs/` 目录派生的书写方式，避免重划漏同步。

## 结论

**PASS**（30 项判定 **全部 pass**（partial 0 / fail 0 / blocked 0））

- 判据覆盖：全部 **5 个 PR × 3 条粒度锚点（A1~A3）+ 3 条依赖判据（B1~B3）= 30 项**，逐项有 `文件:行号` 级证据（E-1~E-9）。
- fail 条目数：**0**；partial 条目数：**0**。
- 偏差记录条数：**8**（D-1~D-8）+ 1 条核实结论（`deferred-demand-changes.md` 不存在）。其中 **D-2 / D-3 建议在阶段 5 首次派发前修正**（文本级、不改变划分与依赖图）；D-4 / D-5 / D-7 为文档同步项；D-6 为阶段 5/6 判定清单的组织建议；D-8 为 A1 口径澄清请求。
- 依赖正确性（标准 B）全绿：5 条依赖 / 2 条「无依赖」声明均有代码级或实测证据；全局依赖图 5 节点 5 边**无环**；文件范围两两交集为空；**F01~F13 13/13 覆盖**；architecture 的 B-1~B-17 **17/17** 各被唯一 PR 承载（零遗漏、零重复归属）。
