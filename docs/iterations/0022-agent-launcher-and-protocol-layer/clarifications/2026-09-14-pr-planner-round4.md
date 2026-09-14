# pr-planner 第 4 轮记录 — 0022 阶段 5 次波（pr-005 授权范围扩展 + W2-A 口径校正）

**角色**: pr-planner（`roles/pr-planner/pr-planner.md` v0.1.0）
**日期**: 2026-09-14
**轮次性质**: 阶段 5 次波·第 4 轮（**本 PR 的文件范围 +1 与一处口径校正**——不重划边界、不改依赖图、不改其他 PR）
**主输入**: 主 agent 授权扩展（2026-09-14）+ 用户裁决 `clarifications/2026-09-14-stage5-wave2-verdicts.md`（**W2-A**）
**其余输入**: `prs/pr-005-protocol-layer-and-injection-entry.md`（待修，只此一个 PR 文件）、`prs/pr-001-launcher-and-protocol-config.md`（只读，文件范围核对）、代码库 `<工作区地址>/oamp/src/{launcher.js, agent.js}`（本轮**实读**，逐条带 `文件:行号`）
**产出**: 修订后的 `prs/pr-005-protocol-layer-and-injection-entry.md` + 本文件
**未改动**: `prs/pr-001` / `pr-002` / `pr-003` / `pr-004`（含 `*-tasks.md`）、`oamp/**`（代码只读）、`architecture.md` / `prd.md` / `prd/*.md` / `demand.md` / `status.md` / `history.md` / `progress.md` / 既有 `clarifications/**`

---

## 0. 本轮定位与不变式承诺

阶段 5 次波中 pr-005 正在实现，暴露两类需要在派发执行前对齐的事实：**(A)** 一次性路径的 approval 档位若由客户端自拼 argv 表达，会让本迭代要消灭的「argv 知识第二次落笔」复活；若由 pr-001 的 profile 数据决定，`deny` 档会静默绕过权限门——故主 agent 授权把 `oamp/src/launcher.js` 的 `buildArgv` 开一个**显式 `approval` 入参**，并把该文件纳入 pr-005 文件范围。**(B)** 用户裁决 W2-A 已把档位归属判给**调用层**，而 pr-005 验收里 `--approval-mode yolo` 的字面与之矛盾。

**四条不变式（本轮后实测复核，见 §3）**：PR 数量 = 5、文件名与编号、依赖边集合、功能点覆盖（F01~F13）——全部逐项一致。**文件范围集合按授权有一处定向变化**（pr-005 +`oamp/src/launcher.js`），见 §2 与 §3.1。

**未做的事**（明确登记，非遗漏）：
- 未改 `pr-002` / `pr-003` / `pr-004` 与 `status.md`（后者的 PR 状态表属主 agent 维护面）；
- 未新增验收条目 / 未新增依赖边（见 §1 各条的「性质说明」）；
- 未触 `architecture.md`（W2-C 已把 §3.4 / §5.6 的 `options:[{option_id}]` 字面登记为已知偏差交阶段 6，执行角色产物不由本阶段改写）。

---

## 1. 逐条修正

### 1.1 (A) 授权范围扩展 · `oamp/src/launcher.js` 纳入 pr-005 文件范围（4 → 5）

| 项 | 内容 |
|---|---|
| **触发** | 主 agent 授权扩展（2026-09-14）：pr-005 可修改 `oamp/src/launcher.js`，把「一次性路径的 approval 档位」作为 **L1 的显式入参**表达。理由（安全 + 单一真源）：客户端自拼 argv ⇒ 本迭代要消灭的「argv 知识第二次落笔」复活；profile 数据定档 ⇒ `deny` 档静默绕过权限门（omp 在 yolo 档不发权限请求）。 |
| **修订内容** | ① **文件范围**新增一条 `oamp/src/launcher.js`（**修改**〔**主 agent 授权扩展，2026-09-14**〕），写明契约：`buildArgv(profileKey, {model, roleFile, tools, prompt, approval})` 增第 5 个可选入参 `approval`，**三态**——`undefined` ⇒ 取 `profile.approval`（既有调用方逐字零行为变更）；`null` ⇒ **不追加** `--approval-mode`；对象 ⇒ 用传入值（`{mode, appliesWhen}` 与 profile 同形）；`spawnAgent` 同步透传；唯一消费方 = 本 PR 的 `oneshot-client.js`（传 `toolsOn ? {mode: permission === 'deny' ? 'always-ask' : 'yolo', appliesWhen:'tools-on'} : null`）；`PROFILES['omp:oneshot'].approval` 数据行**不动**。② **零改动段**删去 `oamp/src/launcher.js`（并加「另注」指明其去向），`oamp/src/config.js`（pr-001；第 4 键 `protocol`）保留。③ **验收标准**的 `git diff --stat` 计数由「4 个文件」改为「**5** 个文件（= 4 新建 + `oamp/src/launcher.js` 的加性修改）」。④ **上下文摘要**补一句适用范围（落地面 = 4 新建 + 1 加性修改）。⑤ **depends_on 的理由段**补「加性修正」说明（**边不新增**）。 |
| **代码锚点（本轮实读）** | `oamp/src/launcher.js:106`（现状签名 `export function buildArgv(profileKey, { model, roleFile, tools, prompt } = {})`）、`:126-128`（现状唯一档位分支 `if (profile.approval.appliesWhen === 'always' \|\| toolsOn) args.push('--approval-mode', profile.approval.mode)`，注释在 `:125`）、`:144-146`（`export function spawnAgent(...)` 与其内 `buildArgv(profileKey, { model, roleFile, tools, prompt })` 调用点）、`:52`（`'omp:oneshot'` 行 `approval: { mode:'yolo', appliesWhen:'always' } // 既有一致（零行为变更）`）。 |
| **调用层语义真源** | `oamp/src/agent.js:197-198`：`if (toolsOn) args.push('--approval-mode', ctx.permission === 'deny' ? 'always-ask' : 'yolo');` —— 一次性路径今天就是「工具开才追加 + `deny` 走 `always-ask`」。W2-A 的「调用层合成后的 argv 与现状逐字一致」即以此为据。 |
| **性质说明** | 文件范围 **+1 文件**（授权变化，非自行扩权）；验收标准只改**计数口径**（4→5）与随带的文件构成说明，**不新增判定项**；依赖边**零变化**。 |

### 1.2 (B) W2-A 口径校正 · `--approval-mode` 由字面改为调用层语义

| 项 | 内容 |
|---|---|
| **矛盾** | pr-005 验收「**oneshot 无会话语义**」原写「…有角色时 `--append-system-prompt`；**`--approval-mode yolo`**」——把档位写死成 `yolo`，与 W2-A（档位归调用层：工具关 ⇒ 不追加；`permission==='deny'` ⇒ `always-ask`；其余 ⇒ `yolo`）矛盾；若照此字面实现，`deny` 档会静默绕过权限门。 |
| **修订内容** | ① 该验收条目内的档位子句改为**按调用层语义**的三分支：工具关 ⇒ **无该 flag**；工具开 + `permission === 'deny'` ⇒ `always-ask`；工具开 + 其余 ⇒ `yolo`——档位经 L1 的 `approval` 入参表达、与现状 `oamp/src/agent.js:192-199` 逐字一致；并**显式申明旧措辞「`--approval-mode yolo`」作废、不得作为第二读法保留**。② 同 PR 文件范围中 `oneshot-client.js` 行的档位来源由「`approval:{mode:'yolo',appliesWhen:'always'}`（profile 数据）」改为「**不由 profile 数据决定**，由本模块按调用层语义经 L1 的 `approval` 入参表达」（并给出两分支构造式）。③ `protocol-layer.test.js` 条目 ⑤ 的「argv = `omp:oneshot` 期望值」改为「= `omp:oneshot` profile 与调用层 `approval` 入参的**合成期望值**（W2-A）」，避免「profile 期望值」被读回第二套语义。④ 参考资料补入 W2-A 裁决文件（含「新增小 PR 改已合并的 launcher.js profile 数据」已否决的登记）。 |
| **文档锚点** | `clarifications/2026-09-14-stage5-wave2-verdicts.md` **W2-A**（归调用层；`pr-002` 断言口径 = 调用层合成后的 argv；`pr-003` / `pr-005` 必须复现该调用层语义；已否决「新增小 PR 改 profile 数据」）；W2-A 为 `user_confirmed`。 |
| **性质说明** | 只纠正**判定口径**（把一条会被实现成错行为的字面改成三分支语义），该条验收的**判定面粒度不变**（仍是「`createEphemeral()` 的 argv 期望值」这一个观测面）；不改其他验收条目、不改文件范围集合（除 §1.1 的授权 +1）、不改依赖边、不改功能点。 |

### 1.3 与 (A) 的联动一致性（避免「档位仍由 profile 数据决定」的第二读法）

`oneshot-client.js` 行、`launcher.js` 行、验收条目、测试条目 ⑤、参考资料五处现已**逐字同向**：档位由**调用层**决定（W2-A）→ 经 L1 的 **`approval` 入参**表达 → `oneshot-client.js` 传入 `toolsOn ? {mode: …, appliesWhen:'tools-on'} : null` → profile 数据行只是 `undefined` 路径的兜底（对 `omp:oneshot` 而言本 PR 内不再被走到）。旧措辞在验收条目内**只以「作废声明」的形式出现一次**，不构成可被独立读取的第二套口径。

---

## 2. 本轮写入面与改动清单（机械可复核）

| 文件 | 改动点 | 计数 |
|---|---|---|
| `prs/pr-005-protocol-layer-and-injection-entry.md` | 摘要 +1 句；文件范围 +1 条 / 1 条改写；零改动段 1 处删改；验收 2 处（oneshot 档位子句 + `git diff --stat` 计数）；测试条目 ⑤ 1 处；参考资料 +1 行；depends_on 理由段 +1 子句 | 8 处 |
| `clarifications/2026-09-14-pr-planner-round4.md` | 本文件（新建） | 1 |
| 其余 PR 文件（pr-001 / pr-002 / pr-003 / pr-004 及 `*-tasks.md`） | **零改动** | 0 |

复核式（本轮实跑）：

- 七字段：`grep -c "^## " pr-005-*.md` ⇒ **7**（上下文摘要 / 涉及功能点 / 文件范围 / 验收标准 / 参考资料 / depends_on / batch）。
- 文件范围自有项：`- `oamp/src/protocol.js`` / `- `oamp/src/rpc-client.js`` / `- `oamp/src/oneshot-client.js`` / `- `oamp/src/launcher.js`` / `- `oamp/test/protocol-layer.test.js`` ⇒ **5 项**（原 4 项 + 授权的 `launcher.js`）。
- 残留旧字面：`grep -n "approval-mode yolo"` ⇒ 仅命中 oneshot 验收条目内的**作废声明**一处；`grep -n "4 个文件"` ⇒ **零命中**。

---

## 3. 不变式复核（本轮修订后机械跑）

| 不变式 | 实测结果 | 与第 3 轮 / Gate 矩阵对比 |
|---|---|---|
| PR 数量 | `prs/pr-00*.md` = **5** | 一致（5） |
| 文件名与编号 | pr-001~pr-005，逐字未改 | 一致 |
| 七字段齐备 | pr-005 `^## ` 计数 = **7** | 一致（5×7=35） |
| 文件范围 | pr-001 `{launcher, config, config-file.test}`；pr-002 `{acp-daemon, context-pool, project-workspace, call-protocol}.test`；pr-003 `{acp-client, context-pool, agent, web.test, confirmation-roundtrip.test, tool-permission.test, zero-intrusion.test（新）, README}`；pr-004 `{web/app.js, web/style.css（条件）}`；pr-005 `{protocol（新）, rpc-client（新）, oneshot-client（新）, **launcher（改，授权扩展）**, protocol-layer.test（新）}` | **定向变化一处**：`oamp/src/launcher.js` 由 pr-001 独占变为 pr-001 ∪ pr-005 —— **主 agent 授权的扩展**；`pr-001` 已于 `2a2d979` 合并，故非并行改动面（§3.1） |
| 依赖边集合 | `{pr-002→pr-001, pr-003→pr-005, pr-003→pr-002, pr-003→pr-001, pr-005→pr-001}`，`pr-001` / `pr-004` 为空 | **逐项一致**（5 边、无环；pr-005 的 `depends_on` 仍只一条边，理由段内新增的只是「加性修正」说明） |
| 功能点覆盖 | pr-001 F01 F10 F12 F13；pr-002 F03 F06；pr-003 F01 F02 F03 F05 F06 F07 F08 F09 F10 F11 F12；pr-004 F08；pr-005 F01 F02 F04 F07 F09 F11 F12 | **一致（13/13）** |

### 3.1 `oamp/src/launcher.js` 的双声明为何不构成规划错误

- **证据**：`grep -rn "launcher" oamp/src oamp/test` 的非自身命中 = **0**（`oamp/src/launcher.js:3` 自陈「也不被任何既有模块 import（本 PR 零消费方）」）⇒ pr-005 对该文件的修改**不影响任何既有消费方**，与 pr-001 已合并的状态叠加后无并发冲突面。
- **性质**：本轮的变更属「**已合并产物的加性扩展**」（`buildArgv` 增一个默认 `undefined` 的可选入参 + `spawnAgent` 透传），不是把 pr-001 的产出搬到 pr-005；pr-001 的验收（`launcher.js` 存在 / profile 字段集 / `modeArgs` 唯一差异段 / 工具与档位三态）均不受影响（`undefined` 路径与既有行为逐字等价）。
- **登记**：`prs/pr-005` 的零改动段与 `depends_on` 理由段已分别注明「移出本段 → 上方文件范围」与「依赖边不新增；pr-001 已合并，不构成并行改动面」，供阶段 6 复核直接引用。

---

## 4. 未处理项（明确归主 agent / 非本轮授权范围）

1. **D-7′ 防护义务未落在 pr-005 的验收面**：`status.md` 登记「`launcher.js` 在 `input:'positional'` 且未传 prompt 时 argv 末位为 `undefined`（子进程实收字面量）——阶段 5 消费方（`pr-003` / `pr-005`）需加防护；阶段 6 核查」。本轮**未**在 pr-005 新增该判定项（本轮授权仅两项：文件范围 +1 与 W2-A 口径校正，新增验收项超出授权）。事实面登记：`launcher.js:129`（`if (profile.input === 'positional') args.push(prompt);`）对 `undefined` 无防护 ⇒ 该义务目前**只在 `status.md` 有登记、未进入 pr-005 的验收／文件范围**，建议主 agent 决定是否另派一轮补入或按现状交阶段 6 核查。
2. **W2-C（`optionId` 口径）**：与本轮无关（`pr-005` 的门承接条目已按 `optionId` 写），此处仅确认无第二读法残留于本轮改动面。
3. **`status.md` 的 PR 状态表 / worktree 分支列**：属主 agent 维护面，本轮未触。
4. `deferred-demand-changes.md`：本轮无新增搭置项。

---

## 5. 越界声明

- 本轮**只写入**两处面：`docs/iterations/0022-agent-launcher-and-protocol-layer/prs/pr-005-protocol-layer-and-injection-entry.md`（8 处定点修正）与 `docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/2026-09-14-pr-planner-round4.md`（本文件）；一切写入以**工作区地址**为根、按**绝对路径**寻址。
- **未修改** `architecture.md` / `prd.md` / `prd/*.md` / `demand.md` / `status.md` / `history.md` / `progress.md` 与既有 `clarifications/**`（只读）。
- **未修改**其他 PR 文件（`pr-001` / `pr-002` / `pr-003` / `pr-004` 及 `*-tasks.md`）。
- **未改变**：PR 数量、文件名与编号、依赖边集合、功能点覆盖（§3 逐项复核）；文件范围的变化**只有**主 agent 授权的一条（pr-005 +`oamp/src/launcher.js`）。
- **未执行任何 git 写操作**（无 commit / branch / worktree / checkout / add / stash）；**未创建** PR worktree 或分支。
- **未触碰** `oamp/**` / `omp/**`（代码库只读，仅实读锚点用于逐条证据）。
- **未产出**全局 `tasks.md`；**未做**单 PR 内部的任务拆解。
