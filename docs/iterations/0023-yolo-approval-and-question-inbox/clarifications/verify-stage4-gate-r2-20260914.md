# verify-stage4-gate-r2-20260914.md — 阶段 4 → 5 入口 Gate（第二轮）独立验证

**验证者身份**：提交单元切分与依赖图审查者（产出物类型 = 提交单元划分 + 单元间依赖声明 ⇒ 反射为「PR 粒度判断框架 + 依赖正确性验证」的执行者；关注点 = 逻辑原子性 / 审查心智负担 / 判定独立性 / 依赖证据是否为代码级耦合 / 依赖图有环无环 / 文件范围重漏）

**产出物**（三份，逐份完整判定）：

1. `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-001-approval-resolution-and-question-channel.md`
2. `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-002-web-envelope-and-decision-routing.md`
3. `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-003-inbox-question-item-frontend.md`

**验证标准来源**：主 agent 委托 brief 内联的【标准 A · PR 粒度判断框架】（A1 逻辑原子性 / A2 可审查性 / A3 独立性）与【标准 B · 依赖正确性验证】（B1 依赖证据 / B2 依赖图无环 / B3 范围与覆盖），另加「特别核实（同一信封字段名双语义）」与「deferred-demand-changes.md 存在性核验」两项委托显式要求。标准文本与 `roles/workflow-pb/workflow-pb.md` §验证目标「PR 粒度判断框架」（:571-579）、「依赖正确性验证」（:581-585）一致，并含阶段 4 推进条件（workflow-pb.md:152：格式规范 / 功能点被引用 / 文件范围无重叠 / 依赖图无环）与「PR 文件格式规范」七字段（workflow-pb.md:313-383）。

**验证日期**：2026-09-14

**独立性声明**：未接收执行过程上下文；**未读取** `clarifications/verify-stage4-gate-20260914.md`（第一轮报告）的任何内容，本报告全部判定为对当前三份产物 + 只读对照面（`prd.md` / `prd/F01~F16*.md` / `architecture.md` **v0.3.0** / 代码库 `oamp/**`）+ workflow-pb 规范的独立重算。仅 §4 的存在性核实项读取了 `status.md` / `history.md` 的少量行（该两项为委托显式要求，非判定输入）。

---

## 1. pr-001-approval-resolution-and-question-channel.md

### 1.1 A1 逻辑原子性：pass

- **只做一件可描述的事**：该 PR 的对象可一句话描述——「agent 进程侧（生产者面）：档位解析唯一汇聚 + 两型反向请求（工具门 / 提问）的接线」。18 个改动路径全部服务于同一接口族的扩展/收窄：`resolveApproval` 输出 → argv 段 → 确认项信封 → 结算值。
- **不可再拆的硬证据（按文件判重叠）**：若拆成「档位汇聚」与「提问通路」两个 PR，将同时改写四个文件的同一函数/同一对象 →
  - `oamp/src/agent.js`：档位面 :549（`AGENT_FLAGS`）、:565-571（`parseAgentArgs`）、:660-667（`AGENT_START`）、:681-694（resident spec）；提问面 :275-293（`raiseConfirmation` 字段集）、:300-308（`settleConfirmation`）、:693-712（池构造注入）——同一文件的同一装配段。
  - `oamp/src/context-pool.js`：:187-206 是**同一个 hooks 对象字面量**（档位面改 :193-196 的门钩子判定，提问面加 :201-206 的 `onQuestionRequest`）。
  - `oamp/src/rpc-client.js`：档位面 :122（`spawnAgent` argv）；提问面 :241-249（握手后注册）、:307-312（`handleApproval` 无收件人分支）。
  - `oamp/src/acp-client.js`：档位面 :107-118（构造面）+ :165（`buildArgv('omp:acp', …)` 现状不传 `approval`，收窄后必改）；提问面 :565-575（非门 elicitation 分支）。
  ⇒ 拆分必然同时列出这四个文件，直接违反阶段 4 推进条件「PR 间文件范围无重叠」（workflow-pb.md:152）。**代价已如实评估**：回滚粒度 = 两族功能（F01~F03 与 F04~F09）一并回滚——记入「下一迭代候选」第 1 条（属协议层的文件级重叠判据问题，不是本 PR 的判定失败）。

### 1.2 A2 可审查性：pass

- **审查面被显式封闭**：8 个源文件 + 1 个文档 + 9 个测试文件逐条列出，并对 20+ 项逐一给出「零改动」边界（`oamp/src/web.js`、`inbox.js`、`transport.js`、`persist.js`、`router.js`、`rpc.js`、`node-client.js`、`status.js`、`task.js`、`registry.js`、`cluster.js`、`cluster-config.js`、`role-binding.js`、`log.js`、`bin/**`、`package.json`、`API.md`、`llms.txt`、`web/**`、`test/helpers/**`、`omp/**`）。
- **每条验收标准自带可执行判据**：`grep -rn "resolveApproval" oamp/src` 命中集合 = {protocol.js}；`grep -rn "spec\.approval\|configApproval" oamp/src` 写入面唯一；`node --test <9 个文件>`；`git diff --stat` 封闭性；`dependencies` 仍 `{}`。
- **锚点准确性抽查（20 处，18 处逐字命中）**：`launcher.js:22/37/52/68/83`（五行 `approval: {mode, appliesWhen}` 实测逐行命中）、`launcher.js:109/114/129-132`（`buildArgv` 签名、`approval === undefined ? profile.approval` 静默回落、档位段追加）；`protocol.js:23`（`CAPABILITY_KEYS` 六键）、`:59/73/75/93/112` 全部命中；`agent.js:245/275/291/300/549/565-571/660-667` 全部命中；`acp-client.js:565-575`（非门分支，`decline` 实测在 `:570`）、`:107-118`、`:583` 命中；`oneshot-client.js:93-97/121` 命中；`rpc-client.js:122/241-249/307-312/341-343` 命中；`context-pool.js:193-196`（`permission === 'allow'`）命中；`config-file.test.js:34-48`（`assert.deepEqual(config, {…})` 实测 :34-47）命中；`project-workspace.test.js:972-980`（README §协议速览 7 项断言）命中；`inbox.js:9-42`（5 导出 / `take()` 即删）命中。2 处不命中见「偏差记录」D-1 / D-2。
- **心智模型切换评估**：审查需在「档位链」与「提问链」两套机制间切换，但两者共用同一接口族（hooks / 信封 / 结算），验收清单已按机制分组，无逻辑跳跃（跨模块是事实，但每模块的改动点均为同一接口的扩展/收窄）⇒ 未构成「跨模块混合」信号。

### 1.3 A3 独立性（验收标准可脱离其他 PR 判定）：pass

- **判定面全部在 agent 进程内，且基建已就位**：`oamp/test/confirmation-roundtrip.test.js:1-10` 自述「本地自建假 ACP + 脚本级假 web 节点，不改 harness 公共面」体例（与 pr-001 的「`oamp/test/helpers/**` 零改动」自洽）；`oamp/test/protocol-layer.test.js:69-123` 的 `FAKE_SCRIPT` 脚本化 rpc 假子进程（现成 `gate` / `gate-many` / `ui-classes` 脚本 ⇒ 新增 `host_tool_call` 脚本可在同文件内完成）。
- **跨 PR 判定面已显式切分**（该 PR「择一判定声明」）：F04 验收 1 的「控制台栏内可见」半句 → pr-002/pr-003；F07 验收 3 的主面 → pr-002；F05 验收 2 的控件面 → pr-003；F14/F15 不引用 ⇒ 无任何条目需 pr-002/pr-003 的代码才能判定。
- **反向核实**：无一条验收标准引用 `oamp/src/web.js` / `oamp/web/**` 的行为（该两处是另两 PR 的改动面，且被本 PR 列为零改动）。

### 1.4 B1 依赖证据（该 PR 声明 `depends_on` =「（无）」⇒ 核实「无依赖」成立）：pass

- **反向核实一**：该 PR 的零改动清单覆盖 pr-002/pr-003 的**全部**改动路径（实测另两 PR 修改集合 = {`oamp/src/web.js`, `oamp/API.md`, `oamp/llms.txt`, `oamp/test/confirmation-inbox.test.js`, `oamp/web/app.js`, `oamp/web/style.css`, `oamp/test/inbox-console.test.js`}），逐一在该 PR 零改动段中出现。
- **反向核实二**：唯一可能越界的条目（F10「收件箱恰一条 `request_kind:'permission'` 条目」）的判定面为 `notice{kind:'confirmation_request'}` 信封面（本 PR 生产）与 rpc `err.code === 'permission_denied'`（本 PR 改动 :307-312），不需 web 侧改动；web 侧的 F10 判定由 pr-002 单独认领。
- **迁移面完备性实测**：`grep -rn "buildArgv(" oamp/{src,test}` 的 18 个命中分布于 8 个文件，`grep -rn "PROFILES\[…\].approval.mode\|profile.approval"` 的 6 个引用点分布于 3 个测试文件——**全部落在本 PR 已列的 8 个测试文件 + 3 个源文件内**（acp-daemon / tool-permission / protocol-layer / web / project-workspace / context-pool / confirmation-roundtrip / config-file），且 `loadConfig` 的测试引用仅存在于 `config-file.test.js`（`grep -rn "loadConfig" oamp/test` 实测 19 处同文件）⇒ 无遗漏的迁移文件。

### 1.5 B2 依赖图无环（本 PR 参与的子图）：pass

- 本 PR 无出边、无入边（`depends_on` 为空且经上一项核实成立）；全图仅一条边（pr-003 → pr-002，见 §3.4）⇒ 无环。

### 1.6 B3 范围与覆盖：pass

- **文件范围无重叠（机械比对）**：按「文件范围」顶层条目提取路径集合（剔除 `**零改动` 段）——pr-001 = 18、pr-002 = 4、pr-003 = 3；两两交集实测 = ∅ ×3。
- **对照 architecture §9.1（9 个后端文件）无遗漏**：protocol / launcher / config / agent / rpc-client / acp-client / oneshot-client / context-pool 由本 PR 认领（8 个）、web.js 由 pr-002 认领 ⇒ 9/9；§9.2 前端 2 文件 → pr-003；§9.5 文档面 `README.md` → 本 PR、`API.md` → pr-002。
- **功能点无挂名**：14 项涉及功能点（F01~F13 + F16）在其 14 条验收标准中**逐条**出现（F01/F02/F03/F04/F05/F06/F07/F08/F09/F10/F11/F12/F13/F16 各有对应条目），无仅列不判者。

---

## 2. pr-002-web-envelope-and-decision-routing.md

### 2.1 A1 逻辑原子性：pass

- 单一对象可描述为「web 进程消费 question 类信封 + 裁决路由按 `request_kind` 分化（含派生文档面同步）」；4 个改动路径同属一条消费链：白名单重建（`web.js:1597-1610`）→ 裁决路由（`:1272-1341`）→ 路由元数据（`:1258-1263` / `:1275-1285`）→ 文档投影（`API.md` / `llms.txt`）。
- 回滚只影响 question 类消费；permission 类路径逐字保留（实测 `web.js:1301-1311` 的 `option_id` 必填 + 成员校验 + 文本落地现状，与 pr-002 声明的「逐字不变」一致）。
- F14（服务边界）/ F15（无历史台账）条目为**零改动声明**（无代码改动，仅给出机械判据：`grep -n "listen\|createServer"` 命中集合不变、`inbox` 仍 5 导出且 `take()` 即删——实测 `oamp/src/inbox.js:14/22/27/34/40` 五导出成立）⇒ 不构成第二件事。

### 2.2 A2 可审查性：pass

- 审查面 = 1 个源文件 + 2 个文档投影 + 1 个测试文件；10 条验收标准每条给出可执行判据（HTTP 断言 + `404 NOT_FOUND` / `400 INVALID_PARAM` 契约 + 漂移锁 `oamp/test/api-routes.test.js:280`、`oamp/test/project-workspace.test.js:1283-1305` 保持绿）。
- 锚点抽查全部命中：`web.js:1597` = `if (body.kind === 'confirmation_request') {`；`:1599-1606` 条目 7 字段（`confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at`）；`:1613-1616` `confirmation_cancelled`；`:1313-1340` 文本→chat 输入旁路（实测含 `db.insertInput` + `publishMessage` + `sendTask` + 对账登记）；`API.md` §3.20 实测 :901、§3.21 实测 :949、接口清单 21 条 :157；`confirmation-inbox.test.js:153-183` 注入面；`oamp/llms.txt` 为**被跟踪文件**（`git ls-files --error-unmatch oamp/llms.txt` 成功）且有逐字节漂移锁（`api-routes.test.js:280`、`project-workspace.test.js:1284`）⇒ 条件性重新生成一条自洽。

### 2.3 A3 独立性：pass

- 判定面可用**既有注入面**独立构造，经源码核对成立：`oamp/test/helpers/fake-node.js:26` 的 `startFakeNode` + `oamp/test/confirmation-inbox.test.js:174-184` 的 `ENVELOPE = (over = {}) => ({ kind: 'confirmation_request', … , ...over })`（spread 允许注入 `request_kind` / `multiple`）⇒ 合成一条 question 类投递不需要 pr-001 的任何代码（与该 PR 依赖核实结论第③条一致，我独立复核为真）。
- 「旁路停掉」的判定面是 web 侧 `db` / `task` 表与假节点 receipts，不涉及 pr-003 的前端代码。

### 2.4 B1 依赖证据（该 PR 声明 `depends_on` =「（无）」+ 三段论证 ⇒ 核实成立）：pass

- **论证①「通知类型判据零改动」成立**：实测 `oamp/src/web.js:1597` 读 `body.kind`，本迭代写入的类别键为 `request_kind`（见 §4 特别核实：键集交集 = ∅）；`agent.js:245` 的 `{ kind, ...fields }` 展开不再可能覆盖通知类型 ⇒ 「生产面必须与消费面同批改判据」的耦合**根因已被消除**（与 `architecture.md` §5.2.1（:420-453）一致，我按代码独立重算键并集 = {`kind`,`chat_id`,`text`,`confirmation_id`,`agent_id`,`tool`,`title`,`options`,`created_at`,`option_id`}，与新增键集 {`request_kind`,`multiple`} 交集 = ∅）。
- **论证②「缺字段兜底 ⇒ 新分支惰性」成立**：实测 `:1599-1606` 白名单以 `typeof … === 'string' ? … : null` / `Number.isFinite` 体例逐字段兜底 ⇒ 生产面未合入时既有投递仍走 permission 路径，无条目丢失、无测试失败。
- **论证③「两侧判定面互不重叠」成立**：本 PR 断言面 = fake node 注入 + HTTP + `inbox`/`db`/`tasks`；pr-001 断言面 = notice 信封面与 agent 侧（`confirmation-roundtrip.test.js:6-7` 观测面声明）⇒ 两 PR 可并发，无需依赖边。
- 未见可支撑「pr-002 → pr-001」或「pr-002 → pr-003」的代码级耦合：`oamp/src/web.js` 不读 `web/app.js`，亦不读 pr-001 的 `src/*` 产出（唯一交互面是既有的 `notice` 通道契约，其字段由 0021 既有实现承载）。

### 2.5 B2 依赖图无环：pass

- 本 PR 仅有一条**入边**（pr-003 → 本 PR），无出边；子图 {pr-002, pr-003} 为单边有向无环，全图见 §3.5。

### 2.6 B3 范围与覆盖：pass

- 文件范围：4 路径与另两 PR 交集 ∅；`oamp/llms.txt` 亦被另两 PR 列入零改动 ⇒ 单一所有权（条件性表述不产生歧义）。
- 功能点：F04 / F05 / F07 / F10 / F14 / F15 六项在其 10 条验收标准中逐条出现，无挂名。
- `architecture.md` §9.1 的 `src/web.js`、§9.5 的 `API.md` 均由本 PR 唯一认领 ⇒ 无遗漏。

---

## 3. pr-003-inbox-question-item-frontend.md

### 3.1 A1 逻辑原子性：pass

- 单一对象：「控制台第三栏 question 条目渲染 + 提交载荷分化」；3 个改动路径（`web/app.js` / `web/style.css` / `test/inbox-console.test.js`）同属该渲染与提交链。
- 回滚只影响前端 question 渲染；permission 类「点选即裁决」路径逐字不变（实测 `oamp/web/app.js:717-732` `decide` 现状 = `POST` + `{option_id, text}` + 提交中 disabled + 200/404 移出，与该 PR 声明的「逐字不变」一致）。

### 3.2 A2 可审查性：pass

- 审查面 = 2 个源文件 + 1 个测试文件；10 条验收标准每条给出可执行判据（含 `style.css` 只追加的既有判据 `inbox-console.test.js:284-311`、零前端存储/零轮询的结构性判据）。
- 锚点抽验全部命中：`app.js:37`（`state.inbox`）、`:167`（`onopen` 重建）、`:170-182`（全局 `confirmation` 帧分支）、`:646-668`（`inboxRequest` / `inboxSource`）、`:653-661`（`loadConfirmations`）、`:671-681`（`renderInboxItem`）、`:684-697`（`renderInbox`）、`:701-706`（`syncInboxLabels`）、`:709-712`（`dropInboxItem`）、`:717-732`（`decide`）；测试体例 `inbox-console.test.js:59-99`（`fnBody` + `vm` 沙箱，实测逐字在场）、`:315-336`（`renderInboxItem` 静态契约，含 `placeholder="拒绝理由 / 补充说明（可不填）"` 逐字在场）。

### 3.3 A3 独立性：pass（并说明与 `depends_on` 并存不矛盾）

- 判定面可用 `vm` 沙箱注入条目独立构造（`inbox-console.test.js:59-99` 的 `fnBody` + `runInNewContext` 体例，实测已在用于 `inboxRequest` / `notify.js`）⇒ 即便 pr-002 未合入，「渲染形状 / 提交 body 形态 / disabled 与移出分支」仍可判定。
- 与 `depends_on` 不矛盾的理由：该依赖成立的原因是**运行时契约**（字段唯一产出点与请求体校验点在 pr-002），不是**判定面**的前置；A3 只要求验收标准可独立判定，B1 只要求依赖有代码级证据——两者同时满足，非互相抵消。

### 3.4 B1 依赖证据（`depends_on` = [pr-002]，三条理由逐一核实）：pass

- **理由①「字段唯一产出点」成立**：实测 `oamp/src/web.js:1597-1610` 的 `entry` 为**显式 7 键字面量**（无 spread、无透传）⇒ `request_kind` / `multiple` 只能由 pr-002 的白名单重建写入；未合入 pr-002 时前端读到的 `entry.request_kind` 恒为 `undefined`，question 分支不可达 ⇒ 证据成立。
- **理由②「提交体必然 400」成立**：实测 `oamp/src/web.js:1301-1311`：`const optionId = typeof body.option_id === 'string' ? body.option_id : null;`，不合法即 `inbox.add(entry)` 回填 + `sendError(400, INVALID_PARAM)` ⇒ 未合入 pr-002 时提交 `{option_ids, text}` 必然 400 ⇒ 证据成立。
- **理由③「反向不成立 / 无环」成立**：pr-002 的断言面为 HTTP + `inbox` 表 + fake node，实测其验收标准与参考资料**不读** `oamp/web/app.js` ⇒ 单向依赖。
- 附带核实：「与 pr-001 无直接依赖」成立——不同进程面/文件，且 pr-001 将 `oamp/web/**` 列为零改动；完整用户链路属阶段 6 端到端面，未写成本 PR 的依赖（与三 PR 的择一判定声明一致）。

### 3.5 B2 依赖图无环（全图）：pass

- 全图边集 = {pr-003 → pr-002}；pr-001 孤立。拓扑序 {pr-001, pr-002} → pr-003 可构造，无自环、无回边、无环。
- 附带：`batch` 取值为 pr-001/pr-002 = 1、pr-003 = 2，与上述拓扑一致；按 workflow-pb.md:374-376「batch 不是调度依据」，未将其作为依赖证据使用。

### 3.6 B3 范围与覆盖：pass

- 文件范围：3 路径与另两 PR 交集 ∅；`index.html` / `notify.js` 列入零改动 ⇒ 与 `architecture.md` §9.3 一致。
- 功能点：F05 / F06 / F07 / F10 / F15 五项在其 10 条验收标准中逐条出现，无挂名。
- `architecture.md` §9.2 的前端 2 文件由本 PR 唯一认领 ⇒ 无遗漏。

---

## 4. 特别核实：两个 PR 同时涉及同一信封时，是否存在「同一字段名承载两种语义」的冲突（生产侧写入 vs 消费侧判别）

**判定：pass（冲突不存在）**

1. **键名与值域两侧一致 ⇒ 单字段单语义**：生产侧（pr-001，`agent.js:275-293` 的 `fields` + 声明的 `request_kind` / `multiple`）与消费侧（pr-002，`web.js:1597-1610` 读 `body.request_kind`（非字符串 ⇒ `'permission'`）、`body.multiple`（非布尔 ⇒ `false`））使用**同名键、同值域**（`'permission' | 'question'` / boolean），缺省口径亦一致。
2. **历史冲突（同一扁平 key 承载两个值）根因已消除，且可复核**：`agent.js:245` 的 `const body = fields === null ? { chat_id: chatId, kind, text } : { kind, ...fields };` 会使 `fields.kind` 覆盖通知类型；本迭代类别键改名为 `request_kind` ⇒ 实测既有通知 body 的 key 并集（出处 `agent.js:245/291/319`、`web.js:1597/1600-1606/1311`）= {`kind`, `chat_id`, `text`, `confirmation_id`, `agent_id`, `tool`, `title`, `options`, `created_at`, `option_id`}，与新增键集 {`request_kind`, `multiple`} **交集 = ∅**（我按代码独立重算，与 `architecture.md:420-453` §5.2.1 的逐 key 表结论一致）。
3. **回传向同型核验（无冲突）**：`web.js:1311` 写 `notice{kind:'confirmation_decision', confirmation_id, option_id, text, chat_id}`；pr-002 为 question 类改送 `option_ids`（与 `option_id` **异名**），pr-001 的 `settleConfirmation`（`agent.js:300-308`）保留 `option_id` 并新增 `option_ids` ⇒ 两类各占一键；`text` 两侧语义一致（用户自由文本）。
4. **残留观察（非冲突）**：`title`（权限请求正文 / 问题文本）与 `tool`（工具名 / 承载名 `ask_user`|`ask`）按类承载不同内容，但两侧均以「给人看的文本 / 是谁在要」**同一语义**消费（`web.js:1604-1605` 白名单 + `app.js:665-668` 渲染）⇒ 属 `architecture.md` §5.2 已登记的承载设计，不是双语义冲突。

---

## 5. deferred-demand-changes.md 存在性核验（委托显式要求）

- **结论：不存在。** 证据：`glob **/*deferred*`（含 hidden、不遵守 gitignore）0 命中；`find /Users/chenchiyuan/projects/agents -name deferred-demand-changes.md`（排除 node_modules）0 命中；迭代目录内容 = {`architecture.md`, `clarifications/`, `demand.md`, `history.md`, `prd/`, `prd.md`, `prs/`, `status.md`}。
- **含义**：本报告时点上无「搭置的需求变更/错误」可摘录（workflow-pb §验证目标「搭置的需求变更/错误报告」的职责为透传，无内容即无需透传）；该事实**不影响** §1~§3 的 18 项判定。
- **独立性披露**：为完成本项核实，读取了 `status.md` 与 `history.md` 的少量行；**未读取** `clarifications/verify-stage4-gate-20260914.md`（第一轮报告）的内容，判定过程未使用任何执行过程叙述。

---

## 6. 汇总

| 判定 | 计数 | 条目 |
|---|---|---|
| pass | 19 | pr-001 的 A1/A2/A3/B1/B2/B3、pr-002 的 A1/A2/A3/B1/B2/B3、pr-003 的 A1/A2/A3/B1/B2/B3、特别核实（信封字段名双语义） |
| fail | 0 | — |
| partial | 0 | — |
| blocked | 0 | — |

核验项（不计入判定计数）：`deferred-demand-changes.md` 存在性 = **不存在**（见 §5）。

---

## 7. 偏差记录

> 产出物声明与代码库实际不一致之处。**不影响本次验收判定**（阶段 4 推进条件与标准 A/B 均已满足），但应在阶段 5 落地或后续文档同步时处理。

| 产出物声明 | 核对到的实际 | 建议处理 |
|---|---|---|
| pr-001「文件范围」config.js 检索式：``function readProtocol``（:41） | 实测 `oamp/src/config.js:49` 才是 `function readProtocol`；`oamp/src/config.js:41` 是 `readPositiveInt` 的收尾 `}`（同条的 `:121` `loadConfig`、`:145` `protocol:` 实测精确，无需改） | 把该检索式锚点改为 `:49` |
| pr-001「文件范围」protocol-layer.test.js：``buildArgv`` 调用点补传已解析档位（`:278、:495-514`） | 实测该文件内共 6 个 `buildArgv` 调用点（`:278`、`:495`、`:508`、`:509`、`:513`、**`:535`**）；`:535` 位于 ④/⑤ 档位用例，其期望值以 `{ mode, appliesWhen }` 形状合成 `approval`（实测源码 `approval: item.toolsOn ? { mode: item.expectedApproval, appliesWhen: 'tools-on' } : null`），收窄为「已解析档位字符串」后**必须一并迁移** | 把 `:535` 补进迁移锚点清单（文件本身已在改动面内，不改变文件范围） |
| pr-002「文件范围」未声明路由 `summary` 文案是否同步 | 实测 `oamp/src/web.js:1276` 的 summary = 「提交确认项裁决（选项 id 必填 + 可选文本；条目随即移出在途表并回传请求方）」——在 question 类（`option_ids` + 「选项/文本至少一个非空」）下**不再成立**；`oamp/llms.txt:33` 逐字复制该 summary，而漂移锁（`api-routes.test.js:280`、`project-workspace.test.js:1284`）只比字节、不校验语义 ⇒ 语义陈旧不会被测试兜住 | 在 pr-002 内明确：同步 summary 文案并按 `node oamp/scripts/gen-llms-txt.mjs` 重生成 `llms.txt`（漂移锁随之保持绿）；或在零改动清单显式登记「summary 文案的类条件化已知并接受」 |
| pr-001「零改动：能力位表（:31-46）」+ `architecture.md` §5.6「不改 0022 既有能力位定义」 | 实测 `oamp/src/rpc-client.js:31-41` 的 `hostTools: 'no'` 及其 note「本迭代不接线宿主工具面：omp 默认不注册宿主工具即不触发（M-4 实测零触发）」在本 PR 接线宿主工具（`:241-249` 的 `set_host_tools` 注册 + `host_tool_call` 承接）后**与事实不符**（声明面自身陈旧） | 阶段 5 落地前由主 agent 裁定：同步该键取值 / note 文案（需 §5.6 一句话授权"哪些位可变"），或在 PR 文件显式登记「能力位表按 0022 冻结、note 陈旧性已知并接受」。注：F11 的三条验收标准（键集 / 签名 / 档位隔离）不受影响，`approvalGate` 取值 rpc/acp = `'yes'`、oneshot = `'no'` + note 实测成立 |
| （对照面外，扫描中顺带发现）`status.md:19` 阶段 3 备注写 `architecture.md` **v0.2.0**（665 行） | 实测 `architecture.md` 头部为 **v0.3.0**（758 行，第 3 轮「门禁 D-1 定点修正」后：类别字段 `kind` → `request_kind`） | 主 agent 更新 `status.md` 阶段 3 备注（不涉及本报告验证的三份产出物） |

---

## 8. 下一迭代候选

1. **PR 边界约束与回滚粒度的张力**：pr-001 因「PR 间文件范围无重叠」判据（workflow-pb.md:152，按**文件**判重叠）而无法把「档位汇聚」与「提问通路」拆成两个 PR——四个文件（`agent.js` / `context-pool.js` / `rpc-client.js` / `acp-client.js`）的同一函数或同一对象字面量被两族改动共同触及（证据见 §1.1）。代价：回滚粒度 = 两族功能一并回滚。若下一迭代希望获得更细的回滚粒度，需要协议层回答「同文件不同区域是否可拆」，非本迭代返工项。
2. **`spec.approval` 一键承载两阶段语义**：`architecture.md` §5.1 以 `spec.approval`（显式档位）为解析链输入档，又规定「结果写入传给实现的 `spec.approval`」——同一 key 先后承载「显式档位」与「已解析档位」。当前单点求值（`createProtocolLayer`，`protocol.js:73-75`）下无歧义，但任何在求值前读 `spec.approval` 的代码会拿到未解析值。建议下一迭代评估改名（如 `approvalResolved`）或加断言锁。**注**：本项不属 §4 的「同一信封字段名双语义」检查范围（该检查结论为 pass），仅风险同型、记录以备。
3. **acp 单选 + 自由文本的必然差异需在阶段 5 用例中显式落地**：`architecture.md` §11 R4 / §12.1-Q-1 已裁定按「**文本胜出**」登记（选项被上游丢弃），`prd/F05` 验收 3 保持原文。派发 pr-001 的实现会话时宜在简报中明确该口径，否则 acp 侧用例可能把「必然差异」误判为验收失败。

---

## 9. 报告自身检查

- 所有 pass 条目均附可定位证据（`文件:行`、命令级判据或机械比对输出），无印象式判定；本报告无 fail / partial 条目。
- 全文未使用「因为设计意图是…」「背景是…」式过程解释；未引用第一轮报告内容；未修改任何被验证产物（本次唯一写入 = 本报告文件）。
- 无漏项：委托要求 = 3 PR × {A1, A2, A3, B1, B2, B3}（18 项）+ 特别核实 1 项 + 存在性核验 1 项，逐项已判定。

---

## 10. 结论

**PASS**

- 19 项判定全部 pass；**0 fail / 0 partial / 0 blocked**（阶段 4 推进条件四项——格式规范七字段齐备、F01~F16 全部被引用、PR 间文件范围无重叠、依赖图无环——逐项成立）。
- 偏差记录 **5 条**（含 1 条对照面外观察），均非阻塞，每条附建议处理。
- 下一迭代候选 **3 条**。
- 交付判断：**无需返工，阶段 4 → 5 入口 Gate 可判定通过**（偏差 1~4 建议在阶段 5 落地时一次性吸收）。
