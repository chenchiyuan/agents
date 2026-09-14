# 阶段 4 → 5 入口 Gate · 独立验证报告（PR 粒度与依赖正确性）

**验证者身份（反射结果）**：**PR 计划审查者**（sprint / PR 划分与依赖图审查）——由产出物类型（4 份 PR 规划文件 = 提交单元划分 + 单元间依赖声明）与验证标准（粒度三锚点 + 依赖正确性三类判据）反射得到。本报告在该身份下另做了一层**代码级耦合校验**（读 `oamp/` 源码核对 `depends_on` 的共享符号 / 接口 / 文件引用是否真实存在、核对被拆/被合的可行性），因为标准 B1 的判据面本身指向代码库证据。

**产出物**（只读验证，未修改任何一个）

- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-001-launcher-and-protocol-config.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-002-test-face-profile-pinning.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-003-protocol-layer-and-consumption-cutover.md`
- `docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-004-stream-kind-partition-ui.md`

**验证标准来源**：主 agent 委托指定的两条标准（标准 A · PR 粒度判断框架 A1~A3；标准 B · 依赖正确性验证 B1~B3）。未使用通用最佳实践替代、未增删判据、未接收执行过程上下文（`prs/pr-003` 正文引用的 `clarifications/2026-09-14-pr-planner-round1.md §3` 属执行过程材料，本报告**未**将其作为任何判定的依据；`prs/*.md` 自身给出的代码锚点属被验证产物内容，已逐条回代码库核实）。

**验证日期**：2026-09-14

**对照面（只读，不验证其内容为真）**：`prd.md` + `prd/F01~F13*.md`（13 张卡）、`architecture.md`（v0.2.0）、代码库 `oamp/`。

---
**证据行（E-1~E-6：本报告引用的机械核实结果，均在会话工作区内实跑）**

- **E-1 · 零消费方**：在 `oamp/` 全仓（`src/` + `test/` + `web/`）检索 `launcher\.js|protocol\.js|rpc-client|oneshot-client` ⇒ **零命中**。同时支撑：pr-001「launcher **尚无消费方**」（其上下文摘要自述）与 pr-003 的加性子集 {`protocol.js`, `rpc-client.js`, `oneshot-client.js`} 今日零引用。
- **E-2 · pr-002 所引 4 文件的锚点逐条命中**：`oamp/test/acp-daemon.test.js:246` / `:515`（`OAMP_OMP_BIN` 注入点）、`:546`（`devArgv = readJsonl(devArgs).find((a) => a[0] === 'acp')`）、`:552` / `:574`（`--approval-mode` = `always-ask` / `yolo`）、`:560` / `:570`（`anonArgv` / `devOneShot`）；`oamp/test/context-pool.test.js:203` / `:267`（注入点）、`:506`（一次性 `-p` 与 shell 不回归用例）、`:525` / `:531`（`§6.6` 用例 + `argvs.find((a) => a[0] === 'acp')`）；`oamp/test/project-workspace.test.js:44`（`FAKE_ACP_ARGS_LOG` 观测面）、`:225`（注入点）、`:988`（一次性末位 argv 断言面）；`oamp/test/call-protocol.test.js:295`（`agentEnv` 形参）、`:301`（注入点）、`:757`（`['chunk','stdout','stderr'].includes(u.data.kind)`）。
- **E-3 · `OAMP_PROTOCOL` 今日零读者**：检索 `OAMP_PROTOCOL` 于 `oamp/src/` 与 `oamp/test/` ⇒ **零命中** ⇒ pr-002 的注入在 pr-003 落地前确为惰性（pr-002 验收标准第 5 条的前提成立）。
- **E-4 · pr-003 的合并单元粘合链（代码实测）**：`oamp/src/acp-client.js:137`（现状 argv `['acp', '--no-skills', '--no-rules']`）、`:191`（`prompt(text, {… onChunk = null})`）、`:207`（`onChunk(content.text)`）；`oamp/src/context-pool.js:7`（`import { AcpClient, AcpError } from './acp-client.js'`）、`:150`（`onChunk` 形参）、`:186`（向 client 透传）、`:203`（`new AcpClient({…})`）；`oamp/src/agent.js:190-199`（现状 `-p` argv）、`:396`（`onChunk: (text) => sendUpdate('working', { kind: 'chunk', text })`）、`:589`（`AGENT_FLAGS`）、`:592`（`parseAgentArgs`）、`:698`（`new ContextPool({…})`）。
- **E-5 · `oamp/test/hygiene.test.js` 断言面**：`:41`（`.gitignore` 含 `.runtime/`）、`:47`（`bin/` `src/` `package.json` 凭据字段名零命中）、`:61`（`package.json` 的 `dependencies` 为空）——**无**「孤儿模块 / 未被 import 的模块」类断言 ⇒ 新增无消费方的模块不会使该测试变红。
- **E-6 · 测试面 ACP 桩分布（B1 / B3 的对称核查面）**：`FAKE_ACP_SOURCE` + `msg.method` 桩存在于 **7** 个测试文件（`acp-daemon` / `call-protocol` / `confirmation-roundtrip` / `context-pool` / `project-workspace` / `tool-permission` / `web`）；pr-002（4 个）+ pr-003（3 个）的测试文件并集 = 这 7 个，**零遗漏**；`omp-executor.test.js` 虽注入 `OAMP_OMP_BIN`，但其桩读 `process.argv` 末位（`oamp/test/omp-executor.test.js:21`）＝一次性 `-p` 形态，不受常驻默认协议影响，故未纳入固定面属正确取舍。今日 `oamp/test/*.test.js` 共 **29** 个（`test/` 下 `.js` 共 31 个，含 `helpers/harness.js`、`helpers/fake-node.js`）。

---

## 逐项判定

### 标准 A · PR 粒度判断框架（4 PR × 3 锚点）

#### pr-001 · `pr-001-launcher-and-protocol-config.md`

- **A1 逻辑原子性：partial**（条目级混合，拆开说）
  - 子项 ①「`oamp/src/launcher.js` 单一职责」**通过**：文件范围第 1 项 + 验收标准 1 / 3 / 4 / 5 全部围绕该模块（profile 表 / `modeArgs` / 工具与档位语义 / `bin` 解析链），无第二个主题混入。
  - 子项 ②「与 `oamp/src/config.js` 第 4 键同属一个逻辑单元」**不通过**：两者无代码级共享符号——`config.js` 自述保持叶子模块（`oamp/src/config.js:2`「叶子模块：只依赖 node: 内置模块，不 import src 内任何模块」），且全仓检索 `launcher.js|protocol.js|rpc-client|oneshot-client` 在 `oamp/` 下**零命中**（对照面实测，见证据行 E-1）⇒ launcher 与 config 键之间既无 import 关系也无调用关系，二者可各自独立回滚（回滚 config 键不影响 launcher 的 argv 产出；回滚 launcher 不影响 `OAMP_PROTOCOL` 的解析）。
  - 子项 ③「回滚不影响无关功能」**通过**：零消费方（`oamp/` 全仓对 `launcher.js` 零引用 = E-1），回滚只撤掉无人调用的新增面。
  - 边界说明（与 pr-003 的区分口径）：本 PR 的混合是 **2 个单元 / 同一层（L1 数据面）/ 3 个文件**，规模小、回滚面同质；pr-003 是 **≥4 个单元 / 跨 L1~L3 + 文档 + 测试**（见下）。
- **A2 可审查性：pass**：两个变更点均属「数据面新增、零消费方、行为零变更」同一心智模型；reviewer 无需在协议语义之间切换（本 PR 不含任何运行路径改动，验收标准亦无运行时判据）。
- **A3 独立性：pass**：验收标准 8 条全部可在本 PR 内判定——`node --test oamp/test/config-file.test.js oamp/test/hygiene.test.js`（实测两文件存在：`oamp/test/hygiene.test.js`、`oamp/test/config-file.test.js`）、`git diff --stat` 面、引号内机械检索；无一条需要其他 PR 合并。

#### pr-002 · `pr-002-test-face-profile-pinning.md`

- **A1 逻辑原子性：pass**：单一事务＝「把既有测试面的『内置默认即 acp』隐式假设换成显式注入 + argv 期望值真源迁移」；文件范围仅 4 个测试文件，零改动面明列 `oamp/src/**` 全部；回滚只影响测试面，不触碰任何生产行为（该 PR 验收标准第 5 条即以此为本 PR 的可判定性前提）。
- **A2 可审查性：pass**：4 个文件属同一测试族群、同一心智模型（伪装桩 → 注入 → 期望值来源）；所引锚点经逐条回代码核实全部命中（见 E-2），无逻辑跳跃、无跨层混合。
  - 产出物侧锚点：单事务范围 = `prs/pr-002-test-face-profile-pinning.md:12-17`（四个文件逐一列明），零改动面 = 同文件 `:18`（`oamp/src/**` 全部 + `oamp/test/helpers/**` + 其余测试文件）。
- **A3 独立性：pass**：验收标准 6 条可在本 PR 内判定（第 5 条「注入在切换落地前为惰性」= 对 `oamp/src` 的机械检索，实测今日即零命中，见 E-3）；第 2 条需 pr-001 的 `PROFILES` 表，属**已声明依赖**（`depends_on` 段），不构成额外未声明前置。

#### pr-003 · `pr-003-protocol-layer-and-consumption-cutover.md`

- **A1 逻辑原子性：fail**（证据面 = 单元数 × 跨层数 × 可拆性已被证明）
  - 该 PR 自述即为**两个交付物**：「协议层落地（标准面 + 唯一注入点 + 三实现）」**与**「消费层接入（默认 rpc）」（标题与「上下文摘要」首句）；文件范围 = **6 个生产模块**（`protocol.js` / `rpc-client.js` / `oneshot-client.js` 新建，`acp-client.js` / `context-pool.js` / `agent.js` 改造）+ **5 个测试文件** + **1 个文档**（`oamp/README.md`）；涉及功能点 **12 / 13 张卡**（除 F13）；验收标准 **18 条**横跨 5 个互不相同的关注面（① RPC 帧语义 ② 既有 ACP 行为零回归 ③ 池接线语义 ④ 一次性路径迁移 ⑤ CLI flag + 文档）。
  - 「不可再拆」的论据**只覆盖子簇**：其给出的粘合证据（实现模块与 `protocol.js` 互有 import + `onDelta` 是一条跨三文件的签名链）经代码核实**成立**（E-4：`oamp/src/acp-client.js:191/207` → `oamp/src/context-pool.js:150/186` → `oamp/src/agent.js:396`；另 `oamp/src/context-pool.js:7` 的 import 与 `:203` 的构造、`oamp/src/agent.js:698` 的注入点），但它只能证明 **{`protocol.js`, `acp-client.js`, `context-pool.js`, `agent.js`} 必须同批改**；对 `rpc-client.js`、`oneshot-client.js`、`--protocol` flag、`oamp/README.md`、5 个测试文件**不构成约束**。
  - **可拆性已被本计划自身证明**：pr-001 采用「新建模块 + 零消费方 + 行为零变更」的加性拆分并自述理由（pr-001「上下文摘要」：「本 PR 的 launcher **尚无消费方**……因此行为零变更」）。同一手法可用于 pr-003 的加性子集 {`protocol.js`, `rpc-client.js`, `oneshot-client.js`, `protocol-layer.test.js`}，且可行性经实测：该子集今日在 `oamp/` 全仓**零引用**（E-1）⇒ 加性落地不改变任何运行路径；`oamp/test/hygiene.test.js` 只断言 `.gitignore` 含 `.runtime/`、凭据词零命中、`package.json` 的 `dependencies` 为空（E-5），**不含**「孤儿模块 / 未被 import 的模块」类断言 ⇒ 加性子集不会因新增无消费方的模块而变红。
  - 结论：该 PR 承载了 60% 的生产变更点（architecture §9.1/§9.2 的 10 处生产变更点中 6 处）且跨 L1 / L2 / L3 三层，不满足「只做一件可描述的事」。
- **A2 可审查性：fail**：审查者须同时持有 5 套心智模型（RPC 帧映射 / ACP 遗留行为保持 / 池接线 / 一次性路径 / CLI + 文档），18 条验收标准即这 5 套模型的混合判据；这正是标准 A 明列的「跨模块混合」信号。反证面：本计划对 pr-001 用了「加性模块与消费方分离」以避免同类混合，对本 PR 未用。
- **A3 独立性：pass**：验收标准的判定面均落在本 PR 内（D-2 / D-3 = 机械 `grep` 与 `git diff`；默认 rpc 的 argv 观测；`in` / `out` 两条记录；能力位六键），对外仅依赖已声明的 pr-001 / pr-002；与 pr-004 无判据交叉（F08 的两面已按 PRD `MI-01` 拆分：本 PR 判管道面与入库面，pr-004 判界面面）。

#### pr-004 · `pr-004-stream-kind-partition-ui.md`

- **A1 逻辑原子性：pass**：单一事务＝「既有流式气泡内按 `task_update.kind` 分区渲染」；文件范围 1 个前端文件（+ 条件纳入的 `style.css`）；零改动面明列 `oamp/src/web.js`、`oamp/web/index.html`、`oamp/test/**`；回滚只影响前端渲染。
- **A2 可审查性：pass**：4 个改动锚点全部落在同一文件同一分支的同一心智模型内，且经实测逐条命中：`oamp/web/app.js:421`（`id="stream-text"`）、`:550`（4 类事件订阅循环；PR 引作 `:556`，偏移 6 行）、`:563` + `:566-571`（`handleEvent` 的 `task_update` 分支，与 PR 引用的 `:563`、`:566-572` 一致）、`:601`（`appendChunk`）；PR 声称的「既有六函数」在场亦已核实（`loadProjects` / `renderProjects` / `createProject` / `resolveCurrentProject` / `showProjectList` / `showWorkspace`）。
- **A3 独立性：partial**（条目级混合）
  - 子项 ① 验收标准 1~5 **通过**：第 2 条给出了不依赖真实 rpc 链路的判定法（浏览器控制台直调页面顶层函数 `handleEvent('task_update', {…})` 观察落点）；第 5 条为前端静态契约用例（只读既有测试，不修改）。
  - 子项 ② 隐含的 **F08 验收 1 端到端形态**（默认 rpc 链路上实时收到三类增量）**不通过**：该形态需 pr-003 先落地，而本 PR 声明 `depends_on`（无）。该缺口已由 PR 自行披露（pr-004 `depends_on` 段：「F08 验收 1 的**端到端**形态……属验收安排，不是合并前置」）⇒ 不构成 A3 的硬失败，但判定必须拆开陈述，故记 partial 而非 pass。

### 标准 B · 依赖正确性验证

#### B1 `depends_on` 每条依赖的代码级耦合证据（3 条依赖 + 1 条「无依赖」声明，逐条核实）

- **pr-002 → pr-001：pass**。共享符号真实存在：pr-002 验收标准第 2 条指名以 `oamp/src/launcher.js` 的 `PROFILES['omp:acp']` / `PROFILES['omp:oneshot']` 期望值为真源，该文件与 `PROFILES` 表由 pr-001 文件范围第 1 项交付；注入键 `OAMP_PROTOCOL` 由 pr-001 文件范围第 2 项（`oamp/src/config.js` 第 4 键）交付。**附注（登记为偏差 D-2）**：第 2 条留有「或与之一致的显式期望数组」的替代写法，使该依赖在实现层可被绕过 ⇒ 依赖强度弱于声明，但证据本身存在，不判不合规。
- **pr-003 → pr-001：pass**。共享符号 = `PROFILES` / argv 构造（pr-003 文件范围把 `oamp/src/acp-client.js` 的 argv 构造改经 L1，现状 argv 生产点实测存在于 `oamp/src/acp-client.js:137`＝`const args = ['acp', '--no-skills', '--no-rules']` 与 `oamp/src/agent.js:190-199`＝`const args = ['-p', '--no-session']` 起的一组拼接）+ 解析链第 2 / 3 层取值 = pr-001 的 `protocol` 键。
- **pr-003 → pr-002：pass（本批最强一条，文件 + 行为双重耦合）**。① 文件级：pr-002 的 4 个文件被 pr-003 明列于零改动清单（显式让渡）；② 行为级（经代码实测）：这 4 个文件的 fake omp 桩**只实现 ACP**——`FAKE_ACP_SOURCE` + `msg.method` 分支存在于 `oamp/test/acp-daemon.test.js`、`oamp/test/call-protocol.test.js`（注入点 `:301`）、`oamp/test/context-pool.test.js`（`:203`、`:267`）、`oamp/test/project-workspace.test.js`（`:225`），且 `oamp/test/call-protocol.test.js:757` 断言 `call_update.kind ∈ {chunk, stdout, stderr}` ⇒ 默认切 rpc 后桩不回包、该组用例必红；pr-003 的验收标准含「全库测试面全绿」，故 pr-002 未先合并时 pr-003 的验收必然不通过 = 真实合并序耦合，非顺序偏好。（受影响桩文件的全集经实测 = 7 个，见 E-6：pr-002 的 4 个 + pr-003 自理的 3 个，无第 8 个游离面。）
- **pr-004「无 depends_on」：pass**。「无依赖」的成立依据经两项实测确认：① `oamp/web/app.js` 零 import（`^import |require(` 命中数 = 0），不引用任何 `src/**` 模块；② 其声称的零改动上游 `oamp/src/web.js` 已按 `kind` 原样透传（`oamp/src/web.js:1627`「`if (typeof body.kind !== 'string') return;`」+ 紧随的 `transport.publish(… {kind: body.kind, text, line})`）⇒ 无共享符号、无共享接口、无共享文件，符合「不声明依赖」。**附注（登记为偏差 D-3）**：F08 验收 1 端到端形态的复核时序依赖 pr-003（PR 已自述）。

#### B2 依赖图无环：pass

依赖边集合 = {pr-002 → pr-001、pr-003 → pr-001、pr-003 → pr-002}；pr-004 无入边出边。拓扑序唯一、无回边（DFS 无环）；与各 PR 的 `batch` 字段一致（pr-001 = 1、pr-002 = 2、pr-003 = 3、pr-004 = 1）。

证据（产出物侧锚点）：`prs/pr-001-launcher-and-protocol-config.md:48-50`（`depends_on`「（无）」）、`:52-54`（batch 1）；`prs/pr-002-test-face-profile-pinning.md:39-41`（一条依赖，@ `:41`）、`:43-45`（batch 2）；`prs/pr-003-protocol-layer-and-consumption-cutover.md:80-83`（两条依赖：`pr-001` @ `:82`、`pr-002` @ `:83`）、`:85-87`（batch 3）；`prs/pr-004-stream-kind-partition-ui.md:34-36`（「（无）」）、`:40-42`（batch 1）。

#### B3 文件范围无重叠 + 功能点无遗漏

- **文件范围无重叠：pass**。四份 PR 的文件范围段：`prs/pr-001-launcher-and-protocol-config.md:14-19`（2 生产 + 1 测试 + 零改动面）、`prs/pr-002-test-face-profile-pinning.md:12-18`（4 测试 + 零改动面）、`prs/pr-003-protocol-layer-and-consumption-cutover.md:22-38`（6 生产 + 5 测试 + 1 文档 + 零改动面）、`prs/pr-004-stream-kind-partition-ui.md:11-16`（1 前端 + 条件 1 + 零改动面）；两两交集为空（生产 / 文档变更点：pr-001 = `launcher.js` / `config.js` / `config-file.test.js`；pr-002 = 4 个测试文件；pr-003 = `protocol.js` / `rpc-client.js` / `oneshot-client.js` / `acp-client.js` / `context-pool.js` / `agent.js` / `web.test.js` / `confirmation-roundtrip.test.js` / `tool-permission.test.js` / `protocol-layer.test.js` / `zero-intrusion.test.js` / `README.md`；pr-004 = `web/app.js`（+ 条件 `web/style.css`））。唯一同名文件出现在他人「零改动」清单中（pr-003 明列 pr-002 的 4 个文件为零改动），属显式让渡，非重叠。
- **无遗漏功能点：pass**。引用面 = 各 PR「涉及功能点」段：`prs/pr-001-…:7-12`（F01 / F10 / F12 / F13）、`prs/pr-002-…:7-10`（F03 / F06）、`prs/pr-003-…:7-20`（F01~F12）、`prs/pr-004-…:7-9`（F08），合计 19 个引用、并集 13 卡。逐卡结果：F01(pr-001 / pr-003)、F02(pr-003)、F03(pr-002 / pr-003)、F04(pr-003)、F05(pr-003)、F06(pr-002 / pr-003)、F07(pr-003)、F08(pr-003 / pr-004)、F09(pr-003)、F10(pr-001 / pr-003)、F11(pr-003)、F12(pr-001 / pr-003)、F13(pr-001)。F13 仅由 pr-001 以「零改动承诺」形式承载——F13 为**保证项**（PRD 索引：不引入新能力），不产生代码变更，故该承载形态语义成立（附注，非缺陷）。
- **附带的文件级覆盖核查（超出标准 B3 字面，作支持证据）**：`architecture.md:676-695`（§9.1 新建 4 / §9.2 修改生产 6）的 10 处生产变更点（B-1~B-10）与 `architecture.md:700-719`（§9.4.1 既有面 B-11~B-15 / §9.4.2 新增面 B-16 / B-17）在四份 PR 的文件范围中**全数落点、零遗漏**；唯一差异为 pr-002 追加了 architecture §9.4.1 未列的第 7 个测试文件 `oamp/test/call-protocol.test.js`（登记为偏差 D-1）；测试面受影响文件的全集与两 PR 并集的相等性另经 E-6 独立核实（零遗漏、零多余）。
- **格式面支持证据**：四份 PR 文件均含完整七字段（`上下文摘要` / `涉及功能点` / `文件范围` / `验收标准` / `参考资料` / `depends_on` / `batch`），各 7 个二级标题（实测 28 / 4 = 7。标题行号经逐文件核实：pr-001 `:3 / :7 / :14 / :22 / :38 / :48 / :52`；pr-002 `:3 / :7 / :12 / :21 / :31 / :39 / :43`；pr-003 `:3 / :7 / :22 / :39 / :61 / :80 / :85`；pr-004 `:3 / :7 / :11 / :18 / :27 / :34 / :40`）。

---

## 汇总

- **pass: 15**
- **fail: 2**（需返工：pr-003 的 A1、A2）
- **partial: 2**（pr-001 的 A1；pr-004 的 A3）
- **blocked: 0**

分布：

| 标准 | pr-001 | pr-002 | pr-003 | pr-004 |
|---|---|---|---|---|
| A1 逻辑原子性 | partial | pass | **fail** | pass |
| A2 可审查性 | pass | pass | **fail** | pass |
| A3 独立性 | pass | pass | pass | partial |
| B1 依赖证据 | —（无依赖） | pass | pass | pass（无依赖成立） |
| B2 依赖图无环 | — | — | — | — |
| B3 范围与覆盖 | — | — | — | — |

（B2 与 B3 为全局项，各计 1 / 2 条，均 pass。）

## 偏差记录

| # | 规格 / 文档描述 | 实现 / 产物实际 | 建议处理 |
|---|---|---|---|
| **D-1** | `architecture.md` §9.4.1「既有测试面 · 最小更新」列 **6 文件**（`acp-daemon` / `context-pool` / `tool-permission` / `web` / `project-workspace` / `confirmation-roundtrip`） | pr-002 追加第 **7** 个文件 `oamp/test/call-protocol.test.js`（其桩亦为 ACP-only：`:301` 经 `OAMP_OMP_BIN` 注入 + `:757` 断言 `call_update.kind ∈ {chunk, stdout, stderr}`，默认切 rpc 后必红） | 该追加是**正向修正**，不改 PR 划分；建议把第 7 个文件回填进 architecture §9.4.1（或登记为「§9.4.1 清单不完备，实为 7 个文件」） |
| **D-2** | pr-002 的依赖理由：argv 期望值真源 = pr-001 新建的 `PROFILES` 表 | 同 PR 验收标准第 2 条允许「**或**与之一致的显式期望数组」⇒ 该依赖在实现层可被绕过，退化为顺序偏好 | 建议把口径锁死为「直接引用 `PROFILES`」；若维持现状，须在依赖图上登记 pr-002 → pr-001 为**弱依赖**（不得据此断言真实技术依赖） |
| **D-3** | pr-004 声明 `depends_on`（无），依据 = 只读 SSE 帧的 `kind` / `text` / `line`、不 import `src/**` | F08 验收 1 的端到端形态（默认 rpc 链路上实时收到三类增量）**实际需 pr-003 先落地**；PR 已自述为「验收安排，不是合并前置」 | 不改 PR；建议在阶段 6 验证清单登记「pr-004 的 F08 端到端复核存在对 pr-003 的时序依赖」，避免阶段 5 在 pr-003 之前判其端到端面 |
| **D-4** | pr-001 验收标准：「其余 **30** 个既有测试文件零改动」；pr-002 零改动段：「其余 **30** 个测试文件」 | 实测 `oamp/test/*.test.js` = **29** 个（`oamp/test/` 下 `.js` 共 31 个，含 `helpers/harness.js`、`helpers/fake-node.js`）；扣除各自修改面后分别为 28 / 25 | 数值口径更正为 29（或改相对表述「其余既有测试文件」）；不影响任何判定 |
| **D-5** | pr-003 自述「**不可再拆**的合并单元」，理由 = 实现模块与 `protocol.js` 互有 import + `onDelta` 跨文件签名链 | 该论据在代码层**成立但覆盖不全**：实测 `acp-client.js:191/207` → `context-pool.js:150/186` → `agent.js:396`、`context-pool.js:7` / `:203`、`agent.js:698` 均可核实，但它只覆盖 {`protocol.js`, `acp-client`, `context-pool`, `agent`} 子簇，不覆盖 `rpc-client.js` / `oneshot-client.js` / `--protocol` flag / `oamp/README.md` / 5 个测试文件 | 见「下一迭代候选」第 1 条（在阶段 4 内重划，不让该规模进入阶段 5） |
| — | **`deferred-demand-changes.md`：不存在**（核实结论） | — | 无内容可摘录；该文件在本迭代根目录与 `clarifications/` 下均不存在（`find docs -name "deferred*"` 零结果） |

## 下一迭代候选

1. **pr-003 的再拆边界（本迭代阶段 4 内即可处置，不必留到下迭代）**：候选切法 = ①「加性子集」{`oamp/src/protocol.js`, `oamp/src/rpc-client.js`, `oamp/src/oneshot-client.js`, `oamp/test/protocol-layer.test.js`}（零消费方、行为零变更——可行性已由 E-1 与 E-5 实测支撑，手法与 pr-001 同）；②「切换子集」{`oamp/src/acp-client.js`, `oamp/src/context-pool.js`, `oamp/src/agent.js`, 3 个既有测试文件, `oamp/test/zero-intrusion.test.js`, `oamp/README.md`}。②仍含必须同批的互有 import 簇（E-4），但其审查面收敛为「把消费层切到标准面」一个模型。
2. **依赖强度口径**：把「或与之一致的显式期望数组」这类替代写法从依赖成立条件中剔除（D-2），否则阶段 5 的解锁判据可被字面绕过。
3. **架构清单与实现范围的同步机制**：`architecture.md` §9.4.1 的 6 文件清单在本迭代首轮即被实测证伪为 7 个（D-1）；建议把「测试面最小更新的文件清单」改为可机械复核的派生结果（如按 ACP-only 桩的文件集合生成），避免阶段 5 / 6 再手写清单。
4. **验收时序依赖的显式登记**：本次只有 pr-004 出现「验收面的一部分须待另一未声明依赖的 PR 合并后复核」（D-3）；建议在 PR 文件的「参考资料」或 `depends_on` 段固定一个字段承载这类**验收时序**（与合并前置区分），使阶段 6 的复核清单可直接引用。

## 结论

**FAIL**（存在 fail 条目：`pr-003` 的 A1 逻辑原子性、A2 可审查性）

- fail 条目数：**2**（均在 pr-003）
- partial 条目数：**2**（pr-001 A1；pr-004 A3）
- 偏差记录条数：**5**（D-1~D-5）+ 1 条核实结论（`deferred-demand-changes.md` 不存在）
- 依赖正确性（标准 B）**全部通过**：4 条依赖/无依赖声明均有真实耦合证据或实测支撑、依赖图无环、文件范围无重叠、13/13 功能点被引用、architecture 10 处生产变更点零遗漏。
- 返工范围最小化建议：只需重划 pr-003（其余 3 个 PR 的判定与依赖声明不需变更），重划后再走一次本 Gate 判定即可；阶段 5 在 pr-003 重划完成前不宜启动（其验收面覆盖 12 张卡、6 个生产模块，作为单一合并单元无法在阶段 5 内被有效审查与回滚）。
