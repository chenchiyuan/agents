# 阶段 4 · Gate 独立验证报告（PR 粒度与依赖正确性）

**验证者身份**：冲刺计划审查者（PR 边界与依赖图核查）——针对「依赖的代码级耦合证据」部分叠加同级代码审查者视角（能判断这类跨进程 body 契约的坑）。

**产出物**（唯一验证对象）：

- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-001-approval-resolution-and-question-channel.md`（下称 `pr-001`）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-002-web-envelope-and-decision-routing.md`（下称 `pr-002`）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prs/pr-003-inbox-question-item-frontend.md`（下称 `pr-003`）

**验证标准来源**：主 agent 委托的验证标准（标准 A · PR 粒度判断框架 A1~A3；标准 B · 依赖正确性验证 B1~B3）+ 追加核实项（`deferred-demand-changes.md` 是否存在）。

**对照面（只读，不验证其内容为真）**：`prd.md` + `prd/F01~F16*.md`、`architecture.md`（v0.2.0）、代码库 `oamp/**`。

**验证日期**：2026-09-14

**方法与独立性声明**：未接收任何执行过程上下文（主 agent 的 brief 只给产出物路径与验证标准）。判定依据 = 三份 PR 文件 + 上述对照面 + `oamp/**` 实读。为此另读入一份本迭代产物树内的落盘文件 `clarifications/2026-09-14-pr-planner-round1.md`（阶段 4 澄清记录），仅用于交叉核对 PR 划分与依赖结论的论证，**不作为判定依据**；所有判定均可由本节列出的 文件:行号 复查。

---

## 逐项判定

### 标准 A · PR 粒度判断框架

#### A1 逻辑原子性（「只做一件可描述的事；回滚它不影响无关功能」）

- **A1·pr-001：pass**
  - 证据：`pr-001:5` 单句主题（档位唯一汇聚点 + 提问通路 agent 侧接线）、`pr-001:26-52` 文件面（8 生产 + 1 文档 + 9 测试）。
  - 「不可再拆」经实测复核成立：`oamp/src/launcher.js:109-114`、`:129-132` 的 `buildArgv` approval 入参收窄（现行 `undefined ⇒ 取 profile.approval` 静默回落待删）与三处调用点当日**均不传已解析档位**——`oamp/src/rpc-client.js:122`（`spawnAgent(PROFILE, {model, roleFile, tools})`）、`oamp/src/acp-client.js:165-169`（`buildArgv('omp:acp', {model, roleFile, tools})`）、`oamp/src/oneshot-client.js:93-97`+`:121`（本文件自造档位对象）。签名一改，三处必同批迁移；而 `agent.js` / `rpc-client.js` / `acp-client.js` 同时承载提问接线 ⇒ 在「PR 间文件范围不重叠」约束下不存在可拆分点（`pr-001:28-52` 逐文件列的检索式锚点实测命中：`oamp/src/protocol.js:23/59/73/93/112`、`oamp/src/launcher.js:22/37/52/68/83`、`oamp/src/agent.js:275-321`、`oamp/src/context-pool.js:193-196`）。
  - 「回滚不影响无关功能」成立：`pr-001:52` 将 `oamp/src/web.js`、`oamp/web/**` 列入零改动 ⇒ permission 链路与前端不被回滚波及。
- **A1·pr-002：pass**
  - 证据：`pr-002:5`（web 进程侧承载提问信封与裁决分化，单一句可描述）、`pr-002:18-21`（1 生产 + 2 文档 + 1 条件性 + 1 测试）。回滚只影响提问条目的服务端承载：`pr-002:18`② 明确 permission 类维持既有 `{option_id, text}` 路径逐字不变。
- **A1·pr-003：pass**
  - 证据：`pr-003:5`（栏内 question 条目渲染与提交载荷分化，单一句可描述）、`pr-003:17-19`（2 前端 + 1 测试）。回滚只影响 question 类控件，`pr-003:17`① 声明 permission 类渲染与点选即裁决逐字不变。

#### A2 可审查性（「reviewer 能在不切换心智模型的情况下完整审查」）

- **A2·pr-001：partial**
  - 子项①「单文件级可完整审查」= pass：每个文件给出改动点 + 检索式锚点 + 零改动清单，锚点实测可命中（同 A1·pr-001 的锚点清单；另 `oamp/src/launcher.js:101-107` JSDoc、`:150-152` 透传位与 `pr-001:30` 一致）。
  - 子项②「不切换心智模型」= fail：同一 PR 内含 3 个可独立失败的功能面——(i) 档位解析与 argv 收窄、(ii) 提问通路接线（rpc 宿主工具 + acp 拆问聚合）、(iii) `deny` 拒绝三步（`pr-001:34`、`:57-67` 逐条），横跨 `protocol/launcher/config` 与 `agent/rpc/acp/context-pool` 两个模块族，reviewer 需 ≥3 次心智模型切换（framework 明示「跨模块混合是信号」）。
  - 不判返工的理由：admissible 的替代划分均被否决且理由为代码级（`clarifications/2026-09-14-pr-planner-round1.md:55-57` 的否决表：按功能切分会导致三个共享文件重叠、且 `resolveApproval` 与 `buildArgv` 签名互缺时构成环），故该粒度为约束下的最细可行解；此处仅登记可审查性代价（见「下一迭代候选」）。
- **A2·pr-002：pass**
  - 证据：3 个文件同一主题（`pr-002:18-21`）。注入面体例实测存在——`oamp/test/helpers/fake-node.js:26`（`startFakeNode`）、`oamp/test/confirmation-inbox.test.js:175`（`ENVELOPE` 工厂，实测首字段 `kind: 'confirmation_request'`）；派生面漂移锁实测存在——`oamp/test/api-routes.test.js:280`（锁② llms.txt 逐字节）、`:305`（锁③ API.md 路径级双向覆盖）、`oamp/test/project-workspace.test.js:1283-1285`（锁②，含 `/^## 接口（21 条）$/`）。
- **A2·pr-003：pass**
  - 证据：3 个文件同一主题（`pr-003:17-19`）。判定体例实测存在——`oamp/test/inbox-console.test.js:331`（`fnBody(appJs,'renderInboxItem')`）、`:336`（既有 `placeholder="拒绝理由 / 补充说明（可不填）"` 断言）、`:379-380`（手势入口计数断言）；「调用点由 2 处变 3 处」与代码现状一致（`oamp/web/app.js:718`、`:1156` 两处，测试断言 `:379` 期望 2）。

#### A3 独立性（「验收标准可在不依赖其他 PR 合并的情况下判断」）

- **A3·pr-001：fail**
  - 证据链：
    1. `pr-001:63` 要求「各产生 `notice{kind:'confirmation_request'}`，其 body 含 `kind:'question'`」。而通知 body 是**扁平**结构、`kind` 已是**通知类型**判别键：`oamp/src/agent.js:245` `const body = fields === null ? { chat_id: chatId, kind, text } : { kind, ...fields };`、`:291` `sendNotice(..., { chatId, kind: 'confirmation_request', origin, fields })`；接收侧判据 `oamp/src/web.js:1597` `if (body.kind === 'confirmation_request')`。
    2. `pr-001:34` ⑤ 明确把 `kind` 放进 `raiseConfirmation` 的**字段集**（`kind` + `multiple`）。按 `oamp/src/agent.js:245` 的展开次序，`fields.kind` 会覆盖通知类型 ⇒ 产出的 body 的 `kind` 只能是 `'question'`，与 `pr-001:63` 前半句互斥；反过来若保持 `'confirmation_request'`，则该条要求的前半句成立而 `body` 不含 `kind:'question'`。**同一扁平 key 不能同时承载两值** ⇒ 该验收条目按字面不可构造、不可判定。
    3. 该条要成立，必须由 `pr-002` 改变判别口径（判据不再取 `body.kind` 作类型判定），而 `pr-002:18`① 只声明「`confirmation_request` 分支白名单 +`kind`」，未声明判据变更；`pr-002:47-49` 的 `depends_on` 为（无）。⇒ pr-001 的提问面验收**依赖未声明的跨 PR 改动**，独立性不成立。
  - 受影响的验收条目：`pr-001:63`（F04 面）、`:64`（信封 9 字段）、`:65`、`:66`、`:67` 的提问承载半句；档位面条目（`:57-62`）不受影响。
- **A3·pr-002：fail**（同一根因）
  - 证据：`pr-002:27` 要求「投递一条含 `kind:'question'` / `multiple:true` / `title` / `options` 的 `confirmation_request` ⇒ 条目逐字段含这四项」，与 `pr-002:18`① 「`confirmation_request` 分支白名单 +`kind`（缺失/非字符串 ⇒ 兜底 `'permission'`）」并存。既有判据取自同一 key（`oamp/src/web.js:1597`），既有注入面亦使用同一 key（`oamp/test/confirmation-inbox.test.js:175` 的 `ENVELOPE` 首字段 = `kind: 'confirmation_request'`）⇒「条目 `kind = 'question'`」与「该 body 是 `confirmation_request`」在同一扁平 body 上互斥；且判据内 `body.kind` 恒为 `'confirmation_request'` 时，「缺失/非字符串 ⇒ 兜底」的**取源字段无从确定**（是 notice 类型键还是信封类别字段，pr-002 未写）。
  - 连带：`pr-002:51` 以「消费面自洽 + 对缺 `kind` 的投递按 `'permission'` 兜底 ⇒ 生产面未合入时新分支为惰性、无构建/测试失败」主张与 pr-001 无硬依赖、可并发——该主张在 question 面上不成立（要么新分支永不产出 `'question'`，要么必须改判据）。
  - 不受影响的条目：`pr-002:29`（回传载荷分化）、`:30`（旁路停掉）、`:31`（必填性/404）、`:32`（permission 零回归）、`:33`（F14）、`:34`（F15）——这些按现文件字面可独立判断。
- **A3·pr-003：pass**
  - 证据：依赖已显式声明（`pr-003:47`），且其三条证据经实测逐条成立：① `oamp/web/app.js:671` `renderInboxItem(entry)` 存在，`oamp/src/web.js:1599-1607` 白名单今日只写 7 字段（`confirmation_id`/`chat_id`/`agent_id`/`tool`/`title`/`options`/`created_at`）⇒ 条目今日恒无 `kind`/`multiple`；② `oamp/src/web.js:1301-1307` 今日只认 `option_id`，非法即 `inbox.add(entry)` 回填 + 400（⇒「条目保留在途」的既有体例可复核）；③ 单向性成立——`pr-002:23` 的零改动含 `oamp/web/**`，pr-002 不读 `web/app.js`。判定面在 pr-002 合并后可独立构造（`oamp/test/helpers/fake-node.js:26` + `ENVELOPE` 工厂）。

### 标准 B · 依赖正确性验证

#### B1 `depends_on` 每条有代码级耦合证据

- **B1：partial**
  - 子项①「已声明依赖有代码级证据」= **pass**：全库仅一条声明（`pr-003:47` → `pr-002`），逐条核实通过（`oamp/src/web.js:1599-1607` 唯一产出点、`:1301-1307` body 校验面、`oamp/web/app.js:671` 消费点；反向不成立，`pr-002:23` 零改动含 `oamp/web/**`）⇒ 非「把顺序偏好误判成依赖」。
  - 子项②「依赖图如实反映真实耦合」= **fail**：`pr-001` 与 `pr-002` 在提问通路上存在**真实耦合**（同一扁平 body 的 `kind` 判别键：`oamp/src/agent.js:245`/`:291` ↔ `oamp/src/web.js:1597`），但两者均声明 `depends_on`（无）（`pr-001:82-84`、`pr-002:47-49`），且对同一 key 给出互斥语义（`pr-001:63` vs `pr-002:18`+`:27`）。按 pr-planner 自己对 pr-003 采用的口径（「直接消费跨进程字段与请求 body 契约，缺它则本 PR 的验收标准无法成立 ⇒ 写依赖」，见 `pr-003:47` 理由栏），这一对落在同一口径内却未声明 ⇒ 依赖图对该对的刻画不正确（根因与 A3 同一处，见偏差 D-1）。

#### B2 依赖图无环

- **B2：pass**
  - 证据：`pr-001:82-84`（无）、`pr-002:47-49`（无）、`pr-003:47`（→ pr-002、含回边不成立的论证 `pr-003:47`③ 末句）。依赖图为三节点一条单向边，无环；`batch` 字段（`pr-001:86-88` = 1、`pr-002:53-55` = 1、`pr-003:50-52` = 2）与依赖关系不冲突，且未作栅栏使用。

#### B3 PR 间文件范围无重叠、无遗漏功能点（F01~F16 全覆盖）

- **B3：pass**
  - 文件范围两两无重叠（脚本提取三份 PR「（**修改**/**新建**）」文件集合后两两求交）：
    - pr-001（18 个）：`oamp/src/{protocol,config,launcher,oneshot-client,acp-client,rpc-client,agent,context-pool}.js`、`oamp/README.md`、`oamp/test/{approval-resolution(新建),config-file,protocol-layer,tool-permission,acp-daemon,confirmation-roundtrip,context-pool,project-workspace,web}.test.js`；
    - pr-002（3 个 +1 条件性）：`oamp/src/web.js`、`oamp/API.md`、`oamp/test/confirmation-inbox.test.js`（+ `oamp/llms.txt` 条件性，`pr-002:20`）；
    - pr-003（3 个）：`oamp/web/app.js`、`oamp/web/style.css`、`oamp/test/inbox-console.test.js`；
    - 交集：pr-001∩pr-002 = ∅、pr-001∩pr-003 = ∅、pr-002∩pr-003 = ∅。
  - 文件面无遗漏：并集 24 个 = 13 个生产/文档文件（`architecture.md:552-563` 的 9 个后端 + `:566-570` 的 2 个前端 + `:589` 的文档面 `oamp/API.md`、`oamp/README.md`）+ 11 个测试文件（10 个既有修改 + `oamp/test/approval-resolution.test.js` 新建）；`architecture.md:573-575` 的零改动集合与三份 PR 的冻结清单一致（`inbox.js`/`transport.js`/`persist.js`/`router.js`/`web/notify.js`/`web/index.html`）。
  - 功能点全覆盖：`pr-001:7-23` ∪ `pr-002:7-14` ∪ `pr-003:7-13` = {F01…F16}，**无遗漏**；6 个功能点被多 PR 引用（F04/F05/F06/F07/F10/F15），三份 PR 均以「择一判定声明」显式排定跨 PR 判定归属（`pr-001:72`、`pr-002:38`、`pr-003:35`）⇒ 不构成重复判定或空白判定。
  - 交叉核对（附加）：三份 PR 引用的 `Fxx 验收 N` 编号全部落在对应卡的实际验收条目数内（逐卡实测计数：F01/F02/F03/F06/F07/F09 = 4 条，F04/F05/F08/F10/F13 = 5 条，F11/F12/F14/F15 = 3 条，F16 = 2 条），未发现越界引用。
  - 备注（不扣分，见偏差 D-2）：三份 PR 的「零改动（防夹带）」清单互相覆盖了其他 PR 的修改面（`pr-001:52` 冻结 pr-002/pr-003 的修改文件；`pr-002:23` 冻结 pr-001 的 8 个 src 修改面 + `oamp/test/{project-workspace,web}.test.js`；`pr-003:21` 冻结 `oamp/src/**`）。按各清单自身作用域（「本 PR 不修改」）阅读不构成修改面重叠。

### 追加核实项 · `deferred-demand-changes.md`

- **结论：不存在。**
  - 证据：`docs/iterations/0023-yolo-approval-and-question-inbox/` 目录实测条目 = `architecture.md`、`demand.md`、`history.md`、`prd.md`、`status.md`、`prd/`、`prs/`、`clarifications/`；对 `deferred-demand-changes.md` 做存在性判定返回 MISSING。⇒ 本迭代**无**搭置的需求变更/错误报告，无需原文摘录。

---

## 汇总

| 项 | 判定 |
|---|---|
| A1·pr-001 / A1·pr-002 / A1·pr-003 | pass / pass / pass |
| A2·pr-001 / A2·pr-002 / A2·pr-003 | **partial**（子项① pass、子项② fail） / pass / pass |
| A3·pr-001 / A3·pr-002 / A3·pr-003 | **fail** / **fail** / pass |
| B1 | **partial**（子项① pass、子项② fail） |
| B2 | pass |
| B3 | pass |

- pass：8 项
- **fail：2 项（需返工）** —— A3·pr-001、A3·pr-002（同一根因）
- partial：2 项（A2·pr-001、B1；两者的 fail 子项与上述 2 项同源/同域）
- blocked：0 项

---

## 偏差记录

> 本项目无既有规格与实现代码的漂移可比（阶段 4 产物尚未实现），故本区块登记的是「阶段 3 规格 / 阶段 4 产出物 / 现有代码事实」三者之间不一致、且会影响后续阶段的地方。

| 规格描述 | 现状 / 实现实际 | 建议处理 |
|---|---|---|
| **D-1（高，阻塞）** `architecture.md:392-407`（§5.2）「信封沿用既有 7 字段，**新增 2 个**（`kind` / `multiple`）」，`kind` = `'permission' \| 'question'`；`pr-001:63`「各产生 `notice{kind:'confirmation_request'}`，其 body 含 `kind:'question'`」 | 通知 body 是扁平结构且 `kind` 已是**通知类型**判别键（`oamp/src/agent.js:245` `{ kind, ...fields }`、`:291` `kind:'confirmation_request'`；`oamp/src/web.js:1597` 判据、`:1599-1607` 白名单重建）。`pr-001:34`⑤ 把 `kind` 放进 `fields` ⇒ 展开后覆盖通知类型：**保持 pr-002 现有判据则提问请求在 `web.js:1597` 判否后被丢弃**（无条目）；若改判据，则 `pr-001:63` 的「通知 `kind = confirmation_request`」半句不成立。同一扁平 key 无法同时承载两值 | 阶段 4 返工后在进入阶段 5 并发派发：二者取一并在两 PR 文件与 `architecture.md` §5.2 / §1.3 同步——① 信封类别字段**改名**（如 `request_kind` / `entry_kind`，`pr-001:34`⑤ 与 `pr-002:18`①/`:27` 同步改写）；或 ② 通知判据**不再依赖 `kind`**（改由 `confirmation_id` 等识别），并把 `pr-001:63` 改述为「通知 `kind` 取值域扩为 `'permission' \| 'question'`」。返工完成前不建议派发 pr-001 与 pr-002 的并发 |
| **D-2（低）** `pr-001:52`、`pr-002:23`、`pr-003:21` 的「零改动（防夹带；越界即 F1x 验收不通过）」清单 | 每份清单都包含**其他 PR 的修改面**（pr-001 冻结 `oamp/src/web.js` / `API.md` / `llms.txt` / `oamp/test/{confirmation-inbox,inbox-console}.test.js` = pr-002/pr-003 的修改文件；pr-002 冻结 pr-001 的 8 个 `oamp/src/*.js` 与 `oamp/test/{project-workspace,web}.test.js`；pr-003 冻结 `oamp/src/**` 与 `oamp/API.md`/`oamp/llms.txt`）。跨 PR 阅读时易被读成「该文件本迭代不得被修改」 | 无需改产物（按各清单自身作用域「本 PR 不修改」阅读即正确，且修改面两两交集已实测为空）；如需消歧，在下一轮 PR 文件体例中把限定语写全为「本 PR 修改面之外」 |
| **D-3（低）** `architecture.md:587-589`（§9.5 文档面）只列 `oamp/API.md`、`oamp/README.md` | `pr-002:20` 把 `oamp/llms.txt` 以「**条件性**：仅当路由 `summary` 文案变更时按 `node oamp/scripts/gen-llms-txt.mjs` 重新生成，不手改」纳入修改面。该处理有实测依据：`oamp/scripts/gen-llms-txt.mjs` 存在；`oamp/test/api-routes.test.js:280` 的漂移锁②对 `oamp/llms.txt` 逐字节比对（失败提示即指向该生成脚本） | 按实现更新 `architecture.md` §9.5（补记该条件性文件），或阶段 5 实现时以 `pr-002:20` 的内联条件为准、不回改 architecture（登记即满足） |

---

## 下一迭代候选

- **pr-001 的可审查性代价结构性存在**：单 PR 18 个文件、3 个可独立失败的功能面（档位解析/argv 收窄、提问通路接线、`deny` 拒绝三步）。本迭代受「文件范围不重叠 + 无环」约束无法再拆（否决理由为代码级）。若后续迭代允许同一文件分属不同 PR（分层提交 / 更细的合并单位），应重新评估该 PR 的粒度。
- **跨进程契约字段名的唯一性缺一道机械判据**：本次暴露的 D-1 是「同一扁平 body 的 key 被两类语义复用」（传输层判别键 vs 信封字段）。建议在阶段 2/3 的自查清单里加一条可机械执行的自查项：信封新增字段名与既有通知 body 的 key 集求交必须为空（对 `oamp/src/agent.js` 的 `sendNotice`/`fields` 形态取 key 集）。
- **「零改动」清单的作用域限定应写进 pr-planner 体例**：三份 PR 的冻结清单必然与他 PR 修改面重叠（D-2），一句话作用域限定可永久消除误读成本。
- **上游形态差异（既有登记，非本轮发现，供复核）**：`architecture.md §2.7` 的 acp 单值属性承载上限（单选问「选项 + 自由文本」并存时 omp 丢弃选项）已按 Q-1 裁为「必然差异」；本轮未见三份 PR 的验收标准与之冲突（`pr-001:64` 只判「信封 9 字段齐备」与「acp 由 `content` 承载」），登记备查。

---

## 结论

## **FAIL**

**理由**：2 个 fail 条目（A3·pr-001、A3·pr-002）+ 同源的 B1 子项②失败。pr-001 与 pr-002 在提问通路上存在真实耦合（同一扁平 body 的 `kind` 判别键），而两者的 `depends_on` 均写（无）、且对该键给出互斥语义；按各自 PR 文件字面实现，pr-001 产出的提问通知会被 pr-002 的既有判据（`oamp/src/web.js:1597`）丢弃。该两 PR 正是阶段 5 计划**并发派发**的一对，故 Gate 不通过：需先按 D-1 消解判别键歧义并同步 PR 文件/architecture，再进入阶段 5。

**不需要返工的部分**（可直接沿用）：PR 文件七字段格式、批次标记、文件范围两两无重叠、F01~F16 全覆盖、依赖图无环、pr-003 → pr-002 的依赖证据、以及除提问信封判别键之外的各条验收标准。
