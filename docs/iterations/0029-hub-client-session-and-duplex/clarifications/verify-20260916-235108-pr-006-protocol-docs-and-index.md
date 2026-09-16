# 独立验收报告：pr-006（协议文档面与索引快照 `API.md` / `llms.txt`）

- 委托编号：`verify-20260916-235108-pr-006-protocol-docs-and-index`
- 验证者角色：`verifier`（第三方独立验证者；本报告由本地 subagent 执行，未接收执行过程上下文）
- 验证日期：2026-09-16
- 验证者身份（反射结果）：**协议文档 + 生成物一致性评审者**（能读 HTTP 契约文档、能按 GitHub slug 规则机械复核锚点、能自起隔离集群跑 `hub doctor` 与端到端回归；判据只来自产出物本身与本委托的 4 条标准，不采信产出方的过程叙述）

---

## 置顶：本工作区 `deferred-demand-changes.md` 原文摘录（逐字，含 `DC-01`~`DC-23`）

> **来源**：`<WS>/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`
> **取证据**：`sha256 = 106b92a22d89307111e84e42b1c15cff6278326dacefa654687004e9072786f2`，`29445` 字节，`231` 行（含末行）；与 base 提交 `b090369` 中的该文件**逐字节相同**（`git diff --quiet b090369 -- <path>` 退出码 `0`）。
> 以下为**逐字原文**，未增删任何字符。

```markdown
# deferred-demand-changes.md — 0029-hub-client-session-and-duplex

> **用途**（workflow-pb v0.13.0 / 本迭代执行方式约束③）：执行过程中发现的**需求变更 / 错误 / 摩擦**在此**当场搭置**登记（执行角色可直接写入，不经过主 agent）。
> **格式**：遵循 `workflow-pb.md` §文档路径协议 的 `## {发现日期} · {发现阶段}` + 三字段模板；编号（DC-NN）为便于引用而加。
> **处置原则**：**不回退、不暂停**；本迭代按已落盘需求继续；本文件在阶段 6 验证报告中**原文置顶呈现**。
> **格式迁移说明（2026-09-16 15:30）**：DC-01~DC-08a 原以表格记录，已一次性转为本模板，**内容未增删**。

## 2026-09-16 · **错误（调用面）**

**编号**：DC-01
**问题**：`prd` 调用 `task-3d15749f` 终态 = **failed / `error=timeout`**，`duration_ms=1802670`（**30.0 分钟**正好命中节点上限）。而其产物在 14:23 即已全部落盘（`prd.md` 30089 B + 20 卡 + 决策记录）。**报告未回**。证据：`cli task watch` 输出 `任务终态: failed … error=timeout`；`ps` 显示 daemon 无子进程、CPU 0.1%、日志自 14:17:42 起零事件（挂起于 provider 调用）。
**为什么判定为需求层面问题 / 为什么记录于此**：阶段 2 的**成败判定不能依赖报告**，只能依赖产物；hub 侧没有"产物已落盘"的可查询事实
**本迭代如何处理**：按 **D-14（产物为权威）**直接以产物推进阶段 3，**不重跑**；本条与 DC-04 一并作为 F18 的过程证据

---

## 2026-09-16 · **摩擦（可观测性）**

**编号**：DC-02
**问题**：**无进度投影**：`api calls list` 只有 `working`，无法与"卡死"区分——本次只能靠 `ps`（CPU 0.1%）/`lsof`/日志 mtime 做**进程取证**才判定"挂起 vs 长跑"。
**为什么判定为需求层面问题 / 为什么记录于此**：每轮阶段推进都要人工取证，D-13 体感受损
**本迭代如何处理**：不改需求；转为设计输入：**F05（实例实时状态投影四字段）/ F06（停滞可区分）正是本条的产品化**（迁移到 `prd.md` 的既有卡，不新增）

---

## 2026-09-16 · **摩擦（结果到手）**

**编号**：DC-03
**问题**：结果**不自动到手**：本次靠主 agent **自行拉起** `cli task watch` 才拿到终态（hub skill 的「序列 1」只教"派发 → `calls get`"，未提 `--mode block` / `cli task watch`）。
**为什么判定为需求层面问题 / 为什么记录于此**：与迭代开始时实测的摩擦①同源；`skill/hub.md` 未教正确用法
**本迭代如何处理**：已由用户裁决升格为交付项 ⇒ **D-17 / 新增卡 F19**（本迭代内修复）

---

## 2026-09-16 · **事实修正（对 F-3 的细化）**

**编号**：DC-04
**问题**：`api stream call` 的流里**确实有**逐 token 的 `tool_call` 事件（本次 watch 输出可见 `{"state":"working","kind":"tool_call","text":"…"}` 逐段文本）⇒ **实时进展数据是存在的**，只是没有被聚合成"进度/健康"字段；而**终态里 `error=timeout` 不带任何正文**，无法区分"产物已完成但报告超时"与"什么都没做"。
**为什么判定为需求层面问题 / 为什么记录于此**：说明 F05/F06 的**数据源已存在**（不需要新造埋点），只需聚合与投影——这会直接影响阶段 3 的选型（更低成本）
**本迭代如何处理**：作为事实追加（不改需求条款）；阶段 3 架构时须以本条为约束

---

## 2026-09-16 · **摩擦（追溯）**

**编号**：DC-05
**问题**：本迭代阶段 2 的调用被派发进 **0028 的对话**（`chat-6c89902c`，标题原为「【0028 迭代…】」）
**为什么判定为需求层面问题 / 为什么记录于此**：迭代间追溯易混淆
**本迭代如何处理**：已将该对话标题更正为「【0029 迭代 · 多角色】hub-client-session-and-duplex（承 0028，阶段 2~6 共用同一 chat）」，并在 `history.md` 留痕

---

## 2026-09-16 · **事实（对上游的补充）**

**编号**：DC-06
**问题**：30 分钟上限的来源与可调性已核实：omp 任务默认 `timeoutMs = 1800000`（`oamp/src/acp-client.js:319`；shell 任务另有 `DEFAULT_TASK_TIMEOUT_MS = 30000`，`oamp/src/agent.js:30`）；而 **`/api/calls` 参数表为 `chat_id / agent / task / tasks / context / output_schema / schema_mode / mode / model`——没有 timeout 参数** ⇒ 调用方**无法**为长任务申请更长时间。
**为什么判定为需求层面问题 / 为什么记录于此**：长任务（阶段 5 的 dev PR）同样会被 30 分钟硬切；缓解只能靠"任务切小 + 产物增量落盘"
**本迭代如何处理**：不回退不暂停；**转入阶段 4 的切分约束**（planner 须把单 PR 工作量压在 30 分钟内可产出增量产物），并作为 D-13 摩擦证据

---

## 2026-09-16 · **流程偏差（主 agent 自身）**

**编号**：DC-07
**问题**：主 agent 在阶段 2/3 的派发 brief **未遵守** `workflow-pb.md` §派发执行角色时的 brief 构建 的强制格式（应逐行 `角色名：值` 呈现 11 个字段），改用了自拟的小节结构；`status.md` 亦缺 `**history**` 字段与 `## 更新日志` 区块，`history.md` 早期记录为叙述式而非 §历史记录协议 的「三级标题 + 字段行」。
**为什么判定为需求层面问题 / 为什么记录于此**：机械性契约（CRITICAL 清单/报告格式/停止条件）的遵循度可能被削弱（本例未见实质损害：architect 产物与 prd 产物均达标）
**本迭代如何处理**：**不回退**；阶段 4 起 brief 严格按规范字段逐行构建；`status.md` 已对齐模板；`history.md` 自 2026-09-16 15:20 起改规范格式（更早记录原文保留、不臆造秒级时点）

---

## 2026-09-16 · **期望偏差（严重：流程不能自推进）**

**编号**：DC-08
**问题**：**两次调用都在产物早已完成的情况下空耗到 30 分钟上限，且流程两次都是靠「用户主动唤醒」才继续**（用户 2026-09-16 原话：*"这两次都是我主动唤醒继续的流程，这完全不符合我预期"*）。一手证据：① `prd`：14:17:41 派发 → **14:23 产物全部落盘** → 14:47:44 才以 `failed / error=timeout`（`duration_ms=1802670`）结束 ⇒ **约 24 分钟是在"报告阶段"空耗**；② `architect`：14:47:27 派发 → **14:57 `architecture.md` 落盘** → **15:17:28 撞同一上限**（实测终态 `failed / error=timeout`，`duration_ms=1802677`）⇒ **约 20 分钟空耗**。两次都不需要用户做任何决策，**唯一的推进条件就是"有人来看一眼"**。
**为什么判定为需求层面问题 / 为什么记录于此**：与 **D-13**「一次派发、无需盯守、结果自动到手」的目标**直接冲突**：本迭代的"体感目标"在迭代执行过程中就以最刺眼的方式复现了一次 —— 不是"要人盯守"，而是"**连主 agent 都无法自推进，得用户来捅**"。同时说明：产物完成与调用终态**之间没有因果耦合**（产物落盘不会结束调用）。
**本迭代如何处理**：**不回退**：不改需求、不重跑；本迭代按已落盘需求继续。**处置三层**：① **主 agent 侧立即修正**（见 DC-08a）；② 作为 **F18 的过程证据**与 **F07/F09~F12 的体感对照基线**（本迭代实现的"结果自动到手"必须能消除本现象，阶段 6 以此对照取证）；③ 作为事实输入校验本迭代条文：**"产物已落盘"应当是可被观测的事实**（当前 hub 观测面缺此项 —— 见 DC-02/DC-04）

---

## 2026-09-16 · **主 agent 侧修正（当场执行）**

**编号**：DC-08a
**问题**：排查出"靠人唤醒"里**属于我自己**的那一半：① 等待手段不自足——`cli task watch` 必须由我自行拉起，且 `prd` 那次用 hub 后台作业（**自动送达** ✓），`architect` 那次误用 `nohup ... &` 裸进程（**无自动送达** ✗，只能人工回读日志）；② 缺"到点自检"节拍——定时器只在被唤醒的间隙生效。
**为什么判定为需求层面问题 / 为什么记录于此**：属于主 agent 可实现的部分，不属 hub 缺陷：**未用自动送达机制**是我自己的操作失误
**本迭代如何处理**：**即刻规则（本迭代余下阶段一律遵守）**：① 一切等待**一律**以"会自动送达的后台作业"发起（hub 作业或 `cli task watch` 作为后台作业），**禁止** `nohup &` 裸进程；② 后台等待作业 + 周期定时器**双通道**并存，任一通道到达即推进，**不允许"没人捅就不动"**；③ 已按此规则重挂两路等待（`pr-planner` 与 `architect` 终态）

---

## 2026-09-16 · 阶段 4→5 入口

**编号**：DC-09
**问题**：**阶段 4 的 PR 计划未包含"迭代产物入库"这一步骤**，而它在阶段 5 会立刻变成硬阻塞：8 个 PR 的「文件范围」都含各自的 `docs/iterations/0029-.../prs/pr-00N-*.md`，而迭代分支上这些文件全部还是 **untracked**（`git -C <迭代工作区> status` 显示 `?? docs/iterations/0029-hub-client-session-and-duplex/`）⇒ 第一次 `git merge <PR 分支>` 会被 git 直接拒绝（`error: The following untracked working tree files would be overwritten by merge`）。此外收口（`merge --no-ff iteration/0029-... into main`）只会搬运**已提交**的内容 —— 产物不入库，整个迭代的记录就不会进 main。
**为什么判定为需求层面问题 / 为什么记录于此**：这不是需求问题，是**计划缺口 + 操作前置**：0028 迭代的 pr-planner 曾自行产出 `pr-001-iteration-artifacts-commit`，本次 pr-planner 未产出对应 PR。
**本迭代如何处理**：不回退、不重规划（重规划会使刚派发的阶段 4 验证失效）。由主 agent 在**阶段 5 派发前**执行一次产物入库提交：`git -C <迭代工作区>` 在 `iteration/0029-hub-client-session-and-duplex` 上提交 `docs/iterations/0029-.../` 与 `roles/*/data/0029-*`（消息体例 `docs(0029): 阶段 1~4 产物入库`），随后每次阶段推进与收口前再提交增量。
**合规性说明（显式披露，供阶段 6 与用户判断）**：`scm-protocol.md` 规则 A 的字面判断方式为"每次提交所在分支不得为…当前迭代的迭代分支本身"。本条按以下依据判定为不违反：① 规则 A 的**约束对象是代码变更**（"任何代码变更必须在独立 PR worktree 分支上进行"），`docs/iterations/**` 是工作流自身的进度/产物记录（§文档路径协议明写 `status.md`/`history.md` 由**主 agent 维护**），不是产品代码；② 既有实践一致：仓库 main 上存在 `docs(0025)` / `chore(0026)` 等主 agent 维护类提交；③ 若判为违反，回退动作 = 把该提交改由 PR 承载（成本：新增一个 PR 文件并重跑阶段 4 验证）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-10
**问题**：主 agent 生成的阶段 5 派发简报里，`工作区地址` 字段存在**拼接缺陷**——`{迭代 ID 前 4 位} + slug` 少了连字符，实际写成 `…/worktrees/0029pr-002-session-registries`（正确为 `…/0029-pr-002-…`）。两处已派发简报（pr-001 planner、pr-002 planner）均带此笔误。
**为什么判定为需求层面问题 / 为什么记录于此**：属主 agent 侧操作缺陷（不是需求问题）。记录理由：它是"机械性契约字段（规则 D/检测项）被主 agent 写错"的实证，与本迭代的通道可靠性主题直接相关。
**本迭代如何处理**：不回退。两个子 agent 均**自行发现并纠正**（pr-002 的 planner 在 §7 疑问 3 明确指出"该路径不存在"，并以 `git worktree list` 的实际检出作业）⇒ 未造成实际损害；主 agent 已修正简报生成逻辑（补回连字符），pr-002/pr-003 后续派发使用修正后地址。

---

## 2026-09-16 · 阶段 5

**编号**：DC-11
**问题**：上游架构文档内部命名不一致——`architecture.md` §5.4（`:433`）把接缝函数写作 `resolve(source)`，而 §4 A-01（`:241`）、pr-002 验收 6 与 pr-005 消费清单（`:151`）均写作 `requesterOf(source)`。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**上游产物内部一致性缺陷**（阶段 3 产物）。记录理由：这类不一致会在阶段 5 变成实现分歧（本处已由 planner 以"消费面证据多寡"冻结命名并上报）。
**本迭代如何处理**：不回退、不改已验证的 `architecture.md`（改文档会使阶段 3 产物与阶段 4 验证失配）。裁定以 **`requesterOf`** 为准（消费面 + 判据名双重证据），本迭代内不做别名、不做双导出；该不一致作为已知偏差留给阶段 6 验证者与用户判断。

---

## 2026-09-16 · 阶段 5

**编号**：DC-12
**问题**：**对 DC-02/DC-04 的自我修正**——"`working` 与卡死不可区分"的表述**过头**。实测：hub 的调用面存在 `api calls transcript <call_id>`，返回**带毫秒时间戳的事件流**（`thinking` / `tool_call` 等 kind），取**末条事件时间**即可判定"在推进 vs 停住"（本次三条在途调用的末事件分别落在最近 1~2 分钟内，与 `ps` 的 CPU 判据结论一致）。此外，`api stream call` 的流里也已见逐 token 的 `tool_call` 事件（DC-04）。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**主 agent 对既有能力认知不足导致的记录失真**；记录理由：它直接影响本迭代的设计输入——**F05/F06 需要"进展/停滞"字段的价值主张不能建立在"完全没有数据"之上**，而应落在"数据已存在但需聚合、且需免去每次人工取流"（含 transcript 的 1000 条截断、无跨调用聚合、无订阅推送三处缺口）。
**本迭代如何处理**：不回退；保留 DC-02/DC-04 原文（只增不改），以本条更正口径。阶段 3 的 A-05/A-09 选型不受影响（其数据源结论与"数据已存在"一致）；阶段 6 验证时以本口径评价 F05/F06 的价值前提。

---

## 2026-09-16 · 阶段 5

**编号**：DC-13（DC-08 的第三例，补充证据）
**问题**：**同型现象第三次复现**——`pr-planner` 调用 `task-63f31c78` 终态 = `failed` / `error=timeout`，`duration_ms=1802568`（**30.04 分钟**，正好命中同一上限）；而其产物（`pr-001~008` 八个 PR 文件）在 **15:18:41** 即已全部落盘并此后不再变化 ⇒ **约 26 分钟空耗在"报告阶段"**。
**为什么判定为需求层面问题 / 为什么记录于此**：与 DC-08 同源（产物完成与调用终态之间无因果耦合；hub 观测面缺"产物已落盘"事实）。记录理由：三例同型（阶段 2 / 阶段 3 / 阶段 4 各一）说明这不是偶发，而是**该通道的结构性行为**；同时它给出了本次迭代的**真实基线数字**（3 次调用合计空耗 ≈ 70 分钟，占全部调用时长的多数）。
**本迭代如何处理**：不回退、不重跑。主 agent 侧的三项修补已生效：① 产物面等待器（本次据此在 **15:23:41** 判定推进，比上限早 **~21 分钟**，未阻塞任何下游）；② 一切等待以会自动送达的后台作业发起；③ 活性判据改用 `calls transcript` 末事件时间（DC-12）。三例均作为 **F18 的过程证据**与 **F07/F09~F12 的体感对照基线**（阶段 6 以此对照取证）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-14
**问题**：`prs/pr-003-sse-transport-additions.md` 验收 1 写的"既有 **13** 个导出键"与代码不符——`oamp/src/transport.js:138-141` 的返回对象只有 **11 个对象键**，加模块级导出 `createSseTransport` 共 **12 个导出名**（planner 实读计数）。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**阶段 4 产物的计数笔误**；且阶段 4 的独立验证未覆盖"数字型断言与代码的一致性"这一维度（验证标准只含依赖正确性与粒度锚点）——这一点本身是验证设计的观察。
**本迭代如何处理**：不回退。裁定按**实际集合**判定（`base 集合 ⊆ 改动后集合，差集恰为新 3 键`），不按数字 13；改动面与语义结论不受影响。笔误作为阶段 6 的输入（验证者可判"该条 AC 计数表述与实现不符，但判据等价"）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-15
**问题**：**同角色实例的多个调用在实例侧串行执行**——hub 的调用面**接受**同轮并发创建（三条 `planner` 调用同一时刻全部回到 `submitted/working`），但**每个角色只有一个 omp daemon**（实测：`pb-planner` = pid 18820、`pb-dev` = 45174、`pb-verifier` = 30863，各 1 个，且 daemon **无子进程** ⇒ 一次只跑一个 turn）。旁证：① 三条同时刻派发的 `planner` 完成耗时递增 **4.5 → 7 → 12 分钟**（串行排队特征）；② `pr-002`/`pr-003` 的 `dev` 自派发起长时间只有 `started` 事件、零文件写入，而 `pr-001` 的 `dev` 在持续写文件（`registry.js` mtime 15:47:13）。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是对**本迭代"并发"语义的关键澄清**。记录理由：① 它决定阶段 6「并发调度真实执行证据」应如何判定（"worktree 时间窗口重叠"为真 ✓，但**"真并行执行"为假**——本迭代的并发是**PR 槽位并发 + 实例级串行**）；② 它是 D-13 体感目标的另一处真实瓶颈（"派了三件、实际一件一件跑"，而调用面无任何排队位次/预计等待的可见性）。
**本迭代如何处理**：不回退；调度层不改（串行不改 PR 槽位语义，`depends_on` 解锁判断不依赖并行度）。作为事实输入交给阶段 6；并作为"排队位次/实例占用"这类投影的**需求证据**（若用户希望下迭代补，属新增能力）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-16
**问题**：**对 DC-12 适用边界的修正**——`api calls transcript <call_id>` 返回的事件流**上限 1000 条**（响应含 `"truncated": true`），超出后返回的是**前缀**而非尾部 ⇒ 其"末事件时间"会**停滞**：`pr-001` 的 dev 调用 transcript 末事件停在 15:38:55，而该 dev 在 15:47:13 仍在写文件（滞后 ≥8 分钟）。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**既有能力边界**；记录理由：DC-12 据此声称"末事件时间可判活性"，需限定为"**仅在前 1000 条事件以内有效**"；对长调用，可靠判据是**产物面文件 mtime**（本迭代 `pr-001` 的判活即靠此）。
**本迭代如何处理**：不回退。口径更正为：短调用（<1000 事件）用 transcript 末事件时间；长调用用**产物文件 mtime** 或 `ps` 的 CPU。该边界（截断 + 无尾部窗口 + 无跨调用聚合 + 无推送）一并作为 F05/F06 的需求证据。

---

## 2026-09-16 · 阶段 5

**编号**：DC-17
**问题**：**主 agent 自身长期以"定时器 + 轮询"驱动流程，而未使用既有的推送面**（用户 2026-09-16 直接指出："目前应该接入了消息，应该不用走定期 call 的模式，能实时看到信息才对吧"）。实证：`api stream calls --chat-id <id>` 是**可用的 SSE 实时流**，事件类 = `call_state` / `call_update` / `call_result`（另有全局 `api stream` 推 `message` / `task_update` / `chat_state` / `notice`）；实测 5 秒内收到 **235 条** `call_update`（含 `kind:"thinking"` 的思考文本），8 秒内可读到在途调用"正在思考什么"。
**为什么判定为需求层面问题 / 为什么记录于此**：**不是需求问题，是主 agent 的用法错误**——本轮之前（含 0028 迭代）主 agent 一直在用"睡眠定时器 + `calls list` 轮询 + `cli task watch`"这套拉取式办法，甚至在本次会话前半段用 `sleep 600` 定时器驱动阶段推进。这与本迭代的目标（**像使用 subagent 一样使用 hub**：一次派发、事件到达即推进）**直接相悖**，是本迭代"体感目标"的最强反面样本——**主 agent 自己就是那个不会用推送面的用户**。
**本迭代如何处理**：不回退；**即刻改正**：① 常驻订阅进程 `pb-calls-stream-0029`（`api stream calls --chat-id … | grep -E '"event":"call_(state|result)"'`，hub `op:"start"` 托管）已在运行；② 等待一律改为 `hub op:"logs", follow:true, cursor:<last>` —— **事件到达才返回**（超时仅作兜底，不再是轮询周期）；③ **废除 `sleep <n>` 定时器模式**；④ 该误区作为 **F18 的过程证据**与 **D-13 的体感对照基线**（"既有推送面 vs 实际用法"的落差），并作为文档面（F19/F17）应显性写明的用法指引。

---

## 2026-09-16 · 阶段 5

**编号**：DC-18
**问题**：阶段 5 逐 PR 验收的**标准 2（改动面封闭性）存在系统性误判风险**——`pr-001` 的验收把「`prs/pr-001-…-tasks.md` 被提交进 PR 分支」判为 `fail`（"不在文件范围"）。但该路径是 `workflow-pb.md` §文档路径协议 明文列出的**阶段 5 产物**（`prs/pr-{NNN}-tasks.md` ← "阶段 5：该 PR 内部任务列表（planner 逐 PR 产出）"），只是 8 个 PR 文件的「文件范围」字段都只写了"本 PR 文件"、未显式列它。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**计划陈述不全 + 验收标准口径缺失**；记录理由：若不裁定，`pr-002`~`pr-008` 每条都会以同型 fail 返回（系统性返工）。
**本迭代如何处理**：不回退、不改已验证的 8 个 PR 文件（改计划会使阶段 4 验证失配；且各 PR worktree 已从同一 base 检出，只改迭代工作区副本会造成跨分支分叉）。**主 agent 裁定**（行使 workflow-pb「上报项处置权归主 agent」）：① `prs/<slug>-tasks.md` 在 PR 分支内被提交**不构成夹带**，属工作流规定产物；② 该口径**写入后续所有 PR 的 verifier 简报**，避免误判；③ `pr-001` 该条 fail **改判为"计划陈述缺口"**，不计入返工项。

---

## 2026-09-16 · 阶段 5

**编号**：DC-19
**问题**：**系统性证据格式缺陷**——前两个 PR（pr-001 / pr-002）的独立验收**均在标准 3「验收证据须为命令 + 原样输出」上 fail**：dev 交出的「验收证据」段是散文/摘要（如"取消后 task_get 返回终态：通过"），而标准要求可复制命令 + 原始输出。两次同型（0028 迭代亦曾两次因该标准返工）。
**为什么判定为需求层面问题 / 为什么记录于此**：不是需求问题，是**本工作流的派发口径缺陷**：dev 简报写了"证据写进验收证据段"但**未给机械格式**（结构 / 正例 / 反例 / 禁止词），而该标准的判定是纯机械的。记录理由：它决定返工成本（每个 PR 一次返工 ≈ 20 分钟串行时间）。
**本迭代如何处理**：不回退。① **治根**：把「验收证据段强制格式」内嵌进 dev 简报模板（对 pr-003 起的待发简报已生效）；② pr-001 / pr-002 按返工处置；③ 交下一迭代的流程改进建议：**planner 的 tasks 文件应显式冻结证据格式**，而不是靠 brief 反复叮嘱。

---

## 2026-09-16 · 阶段 5

**编号**：DC-20（**主 agent 自建连接层：同类错误第三次发生**）
**问题**：用户在 2026-09-16 指出"你好像又自己实现过与 agents 的连接"。核实成立。本会话中主 agent 自建/自搭的清单（**全部在 `/tmp`，仓库零污染**，已核 `git status`）：

| # | 自建物 | 性质 | 现状 |
|---|---|---|---|
| 1 | `artifact-watch-0029.py`（轮询 `calls list` + 产物 mtime 稳定性判定） | **产物面等待器** | 在用（注：其"依赖产物文件而非消息送达"的方向恰是 0028 复盘候选 B 的处方 ✓，但实现是主 agent 私有脚本） |
| 2 | `sleep 600` 定时器驱动阶段推进 | **轮询式等待** | 已废除（DC-17） |
| 3 | `nohup … &` 裸进程等待 | 无自动送达的等待 | 已废除（DC-08a） |
| 4 | `api stream calls … \| grep -E 'call_(state\|result)'` 常驻订阅 | **使用既有推送面** ✓，但过滤是自己 grep 的 | 在用（= "穷人的 F03"；F03 交付过滤订阅后应取而代之） |
| 5 | `verify-prs-0029.py`（阶段 4 闸门核查脚本） | 主 agent 职责内的工具（非连接层） | 在用（可复用） |

**为什么判定为需求层面问题 / 为什么记录于此**：**不是需求问题，是主 agent 的行为缺陷**，且是**同类错误第三次发生**：0028 复盘已判定自建 watchdog 为"对现成原语的重复实现"（当时 `oamp task watch` 早已存在于层 C）、并明令"**禁止把 watchdog 当作等待机制的默认解**"；而本迭代（0029）**正是因该毛病而立项**。记录理由：这是本迭代**最强的体感反面样本**——**立项人自己都仍按拉取式使用 hub**，说明问题不在"文档有没有写"，而在"文档主推路径的易用性"（事实 F-8：`skill/hub.md` 序列 1 只教"派发 → `calls get`"）。
**本迭代如何处理**：不回退；已改（DC-17 起用推送 + 事件驱动）。**纪律（即时生效）**：① 在写任何粘合层前，先穷尽既有面清单（`api docs` 三层 + hub skill + 层 C 命令），不得凭印象判定"没有现成入口"；② 等待默认走既有原语（`--mode block` / 推送订阅 / hub 托管进程），自建脚本仅当"既有面确实缺能力"且须**注明缺口**才允许；③ F03 交付过滤订阅后，第 4 项的 grep 过滤应被替换（我把当前实现作为 F03 过滤语义的**实需证据**提交阶段 6）。另：第 1 项的存在本身即"hub 缺'产物已落盘'可观测事实"的证据（DC-02/DC-04/DC-08）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-21
**问题**：**调用在实例上下文启动竞态下立即失败**——`dev` 调用 `task-eba25366` 派发后立刻终态 `failed`，`error = "context_crashed"`、正文 `"子进程已退出"`、`duration_ms = 0`（同轮另两条 `dev` 调用正常 `working`）。实例日志同期显示 `pb-dev` 新进程 `RPC_READY pid=24099` → `CONTEXT_READY context_id=ctx-24099-3` ⇒ 判定为**首次上下文建立期间的崩溃**（实例按需惰性启动时的窗口）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**通道可靠性事实**（非需求问题）。记录理由：① 它与本迭代的 F15（恢复判据）/ F16（重连可观测）同域，是"恢复后**回到可控可调用**"的负面样本；② 调用方（主 agent）必须知道"派发成功 ≠ 实例已就绪"，需要**重派**才能推进（本次即重派）。
**本迭代如何处理**：不回退；**立即重派**该调用（同一 brief）。作为 **F18 的过程证据**与 F15/F16 的事实输入。

---

## 2026-09-16 · 阶段 5

**编号**：DC-22
**问题**：**调用以 `completed` 终态结束但交付物缺失** —— `pr-005` 的 planner 调用 `task-6e2093f3` 终态 `completed`、`duration_ms=430908`（**7.2 分钟，远未触及 30 分钟上限**），但其报告正文止于"…Writing the tasks file."，`prs/pr-005-web-session-and-call-surface-tasks.md` **不存在**，worktree 亦无任何提交（`git log` 仍为 base `51eb893`）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**通道可靠性事实**（非需求问题）。记录理由：① 它与 DC-21（`context_crashed` 立即失败）构成"**终态不可信**"的两面——**成功终态不代表交付完成、失败终态也不代表没有产物**；② 直接支撑本迭代 D-14（**产物为权威**）与 F18（过程证据）的设计前提；③ 与 pr-002 的 `task-efcf2e6b`（`completed` 但 `duration_ms/text` 均 `null`、工作区零改动）同域 ⇒ 该模式已出现 **2 次**。
**本迭代如何处理**：不回退；**以产物判定**（本次即据此判"未交付"）并**重派**同一 brief。作为 F18 的过程证据与 F07/F18 的事实输入。

---

## 2026-09-16 · **摩擦（度量口径）**

**编号**：DC-23
**问题**：`status.md` §派发台账的 D-13 度量口径（角色 / 用途 / `call_id` / 终态 / **结果到手方式**）只声明在 `status.md`（口径行与列头），本搭置文件内没有指向行 ⇒ 阶段 6 独立验证核对“口径是否已登记”时须跨文件检索，“摩擦记录”与“度量台账”的维护边界也无法从本文件读出。
**为什么判定为需求层面问题 / 为什么记录于此**：属**过程记录面的完整性缺口**（F18 验收 2/3 的载体归属问题），不是 hub 能力缺陷；F18 边界禁止新增过程度量工具、要求记录落在既有文件里 ⇒ 只能在既有搭置文件内补一条**指向**。
**本迭代如何处理**：本 PR 补该指向行（指向 `status.md` §派发台账）；**台账本体由主 agent 滚动维护，本 PR 不回填台账任何一行**（口径与列头均不动）；本迭代按已落盘需求继续。
```

---

## 补充摘录：本工作区副本**缺失**的 `DC-24`~`DC-38`（来源与真源差异，非本报告判定依据）

> **为什么有这一段**：本委托简报的「已被主 agent 裁决接受的偏差」清单引用了 `DC-33` / `DC-35` / `DC-36` / `DC-38`，但**本工作区副本只到 `DC-23`**（见上）。经核对，真源在**父迭代工作区**：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`（`376` 行，`DC-01`~`DC-38`，其中 `DC-24` 起为**未提交**改动，`git status` 显示 `M`）。该差异本身记入本报告「偏差记录」第 4 条。
> 以下为**父迭代工作区**该文件第 233 行起的逐字原文（`DC-24`~`DC-38`），**仅作信息补全**，不参与本次判定。

```markdown
## 2026-09-16 · 阶段 5

**编号**：DC-24
**问题**：**子 agent 跨工作区写入**（违反 `scm-protocol.md` 规则 F）——`pr-005` 的 `dev` 把**部分编辑落到了迭代工作区**的 `oamp/src/web.js`（实测 `git -C <迭代工作区> diff --numstat -- oamp/src/web.js` = **143 增 / 4 删**，mtime `20:58:42`），而它的 PR worktree 内是**另一份**（99 增 / 1 删、23 条路由），两份**互补而非包含**（迭代侧有 `/api/subscribe` + `/api/calls/wait`；PR 侧有 `/api/principals`）⇒ 同一文件的两个分叉状态。
**为什么判定为需求层面问题 / 为什么记录于此**：属**隔离纪律事实**（非需求问题）。记录理由：① 它是规则 F 的**真实违反样本**（协议明确"跨工作区写入不可能被 git 阻止，只能事后核查判定"✓ 本次即由主 agent 事后核查发现）；② 它直接造成 pr-005 首轮产物**分裂**（也是该轮 30 分钟超时的直接后果之一）。
**本迭代如何处理**：不回退。处置 = ① **先备份后操作**（规则 F 要求）：两份完整文件与 diff 均已备份至 `/tmp/crossws-backup/`（`iter-web.js` 109365 B / `pr-web.js` 106583 B / 两份 diff / 路由清单）；② **回滚迭代工作区的越界改动**（`git -C <迭代工作区> checkout -- oamp/src/web.js`，路由数回到基线 21 ✓）；③ **重派该 PR 的 dev 续做**，简报中显性要求"**只用绝对路径、只在本 PR 工作区内写入**"，并把备份路径交给它以便**自行调和**两份分叉（避免重做全部工作）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-25
**问题**：**主 agent 自身的合并事故**——pr-008 合并时，因我用脚本解冲突失败后**仍执行了 `git add && git commit`**（命令串联未做失败短路），把一个**被截断的 `deferred-demand-changes.md`**（12 行 / 2 条目）提交进了合并提交 `ecba11d`。
**为什么判定为需求层面问题 / 为什么记录于此**：**不是需求问题，是主 agent 的操作错误**。记录理由：本迭代强调"产物为权威、记录不可损"，而这次损坏的正是**搭置记录本体**；若不发现，阶段 6 的验证报告会原文摘录一份残缺文件。
**本迭代如何处理**：**当场修复**——从合并前版本（`f3784f6`）恢复全文 221 行，追加 pr-008 的条目（改号 `DC-23`，避开与既有 `DC-22` 的编号冲突），提交修复 `aa6bd02`；校验条目数 24、编号无重复、尾部 `DC-21→DC-22→DC-23` ✓。**纪律**：此后合并类操作**必须**用 `set -e` 短路或逐步核对，`git add`/`commit` **不得**与可能失败的解析脚本串联。

---

## 2026-09-16 · 阶段 5

**编号**：DC-26（DC-21 的第二次复现）
**问题**：**`context_crashed` 二次复现**——`dev` 调用 `task-21f1c06c`（pr-005 第三轮）派发后**立即**终态 `failed`，`error = "context_crashed"`、正文 `"子进程已退出"`、`duration_ms = 0`；同期的推送流与终态监听**双通道**都只看到"失败"，无任何执行痕迹。
**为什么判定为需求层面问题 / 为什么记录于此**：属**通道可靠性事实**（非需求问题）。记录理由：① 与 DC-21 同型，出现频次升至 **2 次**（本次与 DC-21 各一次），均发生在**实例按需惰性启动**后的首个调用窗口；② 它印证 F15/F16 的必要性——"派发成功 ≠ 实例已就绪"，主 agent 必须**以产物/终态双通道判定并自动重派**才能推进；③ 本次重派后立即 `working` ✓（说明是启动竞态而非任务问题）。
**本迭代如何处理**：不回退；**立即重派**同一 brief（`task-5ed9219b`，已进入 `working`）。作为 F18 过程证据与 F15/F16 的事实输入。

---

## 2026-09-16 · 阶段 5

**编号**：DC-27
**问题**：**执行通道变更（用户裁决）**——用户 2026-09-16 指示"**因为有 30 分钟上限问题，先取消 hub 调用，直接本地 subagents 实现功能**"。背景：hub 调用面的 30 分钟轮次上限已导致 **5 例空耗/零交付**（DC-01 prd 空耗 24 min、DC-08/13 architect+pr-planner 空耗 46 min、DC-22 pr-005 planner 产物缺失、以及 pr-005 dev 三轮中的两轮零提交），且 hub **无取消面**（实测 `hub api --help` 无 cancel/kill/stop），主 agent 只能靠终止实例进程来停止在途调用。
**为什么判定为需求层面问题 / 为什么记录于此**：这是**本迭代执行方式约束①「派发一律经 hub」的显式变更**（由用户裁决，见 `demand.md` **D-19**），非需求内容变更。记录理由：① 它改变了阶段 5/6 的执行证据形态（余下 PR 将无 hub 调用记录 ⇒ 阶段 6 的"并发调度真实执行证据"须按新形态取证）；② 它是本迭代**最有价值的体感结论之一**——"hub 作为唯一通道"在 30 分钟上限面前不可持续。
**本迭代如何处理**：不回退。**自 22:30 起**：阶段 5 余下实现与阶段 6 验证改用**本地 subagent 直接执行**（仍注入 `roles/*/*.md` 角色定义、仍遵守各 PR 的验收标准与证据格式规则、仍要求逐段提交）；已完成部分（pr-001~004、pr-008 的 hub 派发记录）原样保留。

---

## 2026-09-16 · 阶段 5

**编号**：DC-28
**问题**：**主 agent 以终止实例进程的方式停止在途调用**——为执行 DC-27 的"先取消 hub 调用"，因 hub 无取消面，主 agent 对 `pb-dev` daemon（pid 76728）发 `SIGTERM`；该调用 `task-5ed9219b` 的终态因此被记为 `failed / error=context_crashed`、`duration_ms=1485231`（24.8 分钟）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**操作事实**（非需求问题）。记录理由：① 该 `context_crashed` **是主 agent 造成的**，不是实例缺陷——须与 DC-21/DC-26（实例启动竞态）区分，避免阶段 6 误判归因；② 终止前已按规则 F"先备份后操作"保存未提交 diff 与文件快照（`/tmp/crossws-backup/pr005-round3-*.diff|web.js`），终止后校验 `node --check` 通过、文件 2197 行完整、工作区干净（该轮**已在终止前自行提交了 7 个增量提交** ✓）。
**本迭代如何处理**：不回退。作为"hub 缺取消面"的实证（连同 DC-27 一并提交阶段 6）。

---

## 2026-09-16 · 阶段 5

**编号**：DC-29
**问题**：**F05 产品契约与 A-04 代价控制条款的张力（主 agent 裁定）**——`pr/005` 实施中 `Pr005Finisher` 上报：F05 验收 1~4 要求 `/api/agents` 快照行含 `busy` / `current_call_id` / `queued` / `since`，而 `architecture.md` §4 A-04 写"`router.task_list` **仅在新面订有 `agent_state` 时拉取**" ⇒ 若快照只读后台 tick 缓存，则**无 `agent_state` 订阅者时快照恒为 idle**（`busy` 永远 false），验收 3/4 直接不成立。
**为什么判定为需求层面问题 / 为什么记录于此**：属**上游条款之间的张力**（阶段 3 产物的代价控制措辞 vs 阶段 2 产品验收），非需求内容变更。记录理由：它是"架构代价控制条款可能吃掉产品语义"的实例，须留给阶段 6 与用户复核读法。
**本迭代如何处理**：**主 agent 裁定采纳实施方方案**——① **快照按请求自拉**（`router.status` + `router.task_list`，与 `calls get` 同源、新鲜）；② **后台投影 tick 仅在存在 `agent_state` 订阅者时运行**（零订阅者时无常驻 UDS 流量 ⇒ A-04 的代价控制意图仍被满足）。理由：F05 验收是**产品契约**，A-04 该句是**代价控制**，两者可同时满足；按字面读会使 F05 的核心价值（"一眼看穿每个实例此刻在干什么"）在常见情形下失效。**要求实施方在 PR 证据段用命令+原样输出体现两条判据**（无订阅者时快照仍正确；无订阅者时后台 tick 不产生常驻拉取），并在回报中单列该口径。

---

## 2026-09-16 · 阶段 5

**编号**：DC-30（DC-29 的同型第二例）
**问题**：**F10 晚订阅补发帧的 `data` 形态在两处上游措辞间冲突（主 agent 裁定）**——`Pr005Finisher` 上报两种实现：
- **A（本轮采用）**：`data` = 当刻终态信封**逐字**（不含 `chat_id`）⇒ 满足 F10 验收 3 / T8 判据 4"与 `calls get` 逐字相同（`diff` 为空）"。
- **B（上一轮已提交的写法，被弃）**：`data = {chat_id: task.chat_id ?? null, ...envelope}` ⇒ 因 `registry.createTask` 的任务记录**没有 `chat_id` 字段**（chat 归属只存在于 web 侧登记，且终态时已被删除），该字段**恒为 null**，使 `diff` 非空（多一个 `"chat_id":null`）；它贴合 F10 边界"不改变既有帧结构（信封 + `chat_id`）"与 `API.md §4.4` 的字面，但**取值不可得**。
**为什么判定为需求层面问题 / 为什么记录于此**：属**上游条款之间的张力**（产品边界措辞 vs 可判定验收），与 DC-29 同型（本次迭代已出现 **2 例**"字面执行会吃掉产品语义"）。记录理由：留给阶段 6 与用户复核读法，并给下一迭代一个明确的需求信号——若确实需要 `chat_id`，须先解决"chat 归属在终态后仍可查"的存储问题（属新增能力，不在本迭代）。
**本迭代如何处理**：**主 agent 裁定采纳 A**——① `data` 逐字 = 终态信封；② 要求实施方在证据段**写明被弃方案 B 的内容与弃用理由**，并用命令+原样输出证明"补发帧与 `calls get` 的 `data` diff 为空"；③ 在回报中单列该口径。

---

## 2026-09-16 · 阶段 5

**编号**：DC-31
**问题**：**子 agent 越界杀进程（规则 F 类违反，且发生在隔离取证中）**——本地 subagent `Pr005Finisher` 做 **F16「`kill -9` agent」取证**时，用 `pgrep -f "oamp/bin/oamp.js agent start pb-dev" | head -1` 取 PID，命中的不是它自己那套隔离集群的 agent，而是**主工作区 `tmux oamp-cluster` 会话里的 `pb-dev` 包装进程**（PID 29225，命令行含 `zsh -c … oamp/bin/oamp.js agent start pb-dev --role dev … | tee -a …/pb-dev.log`）。它已 `kill -9 29225` ⇒ **主集群 `pb-dev` 下线**（其余 agent 未受影响）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**操作边界的真实违反样本**（规则 F：会话写/操作须限本工作区；本次是**跨工作区杀进程**）。记录理由：① 它为 F16 提供了**一手现象证据**——`pb-dev` 被 kill 后，`api agents` 仍显示 **`online`**（陈旧租约未过期，实测心跳冻结在 22:45:49 且 3 秒后不推进、进程已不存在）⇒ **"online" 不可信**，正是 F16「重连可观测」要解决的问题；② 它说明"隔离取证"这类动作需要**强制核验目标进程归属**（仅按进程名匹配是不安全的）。
**本迭代如何处理**：① **主 agent 已恢复**该 agent（`hub op:start` + `detached` + `ready=REGISTERED`；pid 91573；心跳恢复推进 14:46:57→14:47:07、新 session `d44ed825`、状态 `online` ✓）；② 实施方自定改进（后续一律以 `hub start` 输出的 PID 经 `ps -o pid,command` 逐条确认命令行）**采纳**；③ 主 agent 追加规则并下发给该 subagent：**F16 的 `kill -9` 证据只许针对其自身隔离集群的 agent，且杀之前必须核验目标进程的完整命令行与 socket/端口环境**；④ 该事故作为过程证据进阶段 6。

---

## 2026-09-16 · 阶段 5

**编号**：DC-32
**问题**：**F14 验收 4 的形态在当前请求契约下不可构造**（上游 AC 与实现面冲突）
`pr-005` 实施方上报：F14 验收 4 要求「批量两项、**仅第二项**自派发 ⇒ `warnings[0].index === 1`」，但**批量形态的 `agent` 是请求级单值**（每项只有 `task`/`output_schema`/`schema_mode`/`mode`/`model`）⇒ 两项必然同目标，「仅第二项自派发」不可能出现。
**为什么判定为需求层面问题 / 为什么记录于此**：属**上游 AC 与请求契约的冲突**（本迭代第 4 例「字面 vs 现实」：DC-14 计数 / DC-29 代价控制 / DC-30 帧形态 / 本条）。
**本迭代如何处理**：**主 agent 裁定采纳等价形态**：以「两项**都**自派发」的对照证明**逐项定位能力**（`index` 0/1 各指向本项 `call_id`），并在 PR 证据段写明字面形态不可构造的理由；要满足字面形态需请求契约支持逐项 `agent` ⇒ 超出本 PR 文件范围，留给下一迭代决策。


---

## 2026-09-16 · 阶段 5

**编号**：DC-33
**问题**：**既有缺陷（未修）：`sendTask` 静默吞掉投递失败**
`pr-005` 实施方在验收中发现：`oamp/src/web.js:~2440` 的 `sendTask` 在两次投递失败后**不抛错而是返回 `undefined`** ⇒ `POST /api/calls` 对**实际未派发**的请求仍回 `200 state:submitted`（实测：目标 agent 被 kill 但仍处租约窗口内时，派发回 200 而 Router 任务表无该条目）。该行为自 0018 起存在。
**为什么判定为需求层面问题 / 为什么记录于此**：属**既有缺陷**（非本迭代引入），且是本迭代主题「终态/受理不可信」的又一实证。记录理由：修它会改变既有错误响应形态（触及 G01 零影响面），按纪律不在本 PR 顺手改。
**本迭代如何处理**：**主 agent 裁定：不在本迭代修**（不越界、不改既有响应形态），只登记并交下一迭代；作为阶段 6 输入与「为何需要续接/取件/健康判据」的论据。


---

## 2026-09-16 · 阶段 5

**编号**：DC-34
**问题**：**名册提示项会把 `web` 自身节点计入「重连中」**（主 agent 裁定剔除）
`pr-005` 实施方上报：名册（`.runtime/roster.json`）会写入 `web` 自身的常驻发送方身份（`SENDER_ID`）⇒ web 重启后该节点会以 `online + connected:false` 出现在视图约一个宽限窗。实施方按「凡注册节点都进名册」实现，未自行裁量。
**为什么判定为需求层面问题 / 为什么记录于此**：属**产品口径问题**（谁该出现在「重连中」视图里），非实现缺陷。
**本迭代如何处理**：**主 agent 裁定：剔除 `SENDER_ID`**——名册用于**客户端/agent 实例**的重连可见性；把服务端自身的发送身份列为「待重新纳管的客户端」是误导性噪声（尤其会在 web 自身重启时出现）。要求实施方做该过滤并补一条证据。


---

## 2026-09-16 · 阶段 5

**编号**：DC-35
**问题**：**「队列可见」在 fire-and-forget 执行下实际恒为 0**（产品现实）
`pr-005` 实施方实测：agent 侧为 **fire-and-forget 执行**（受理即回 `working`，无排队）⇒ 健康 agent 的 `queued` 恒为 `0`；本轮只能用 `SIGSTOP` 冻结窗口才观测到 `queued` 取值与下降（6→3）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**产品现实**（F05 验收 4「队列可见」实现成立，但其**信息价值**在健康 agent 上极低）。
**本迭代如何处理**：**如实登记，不改实现、不加 agent 侧排队**（排队属新增能力，超出本迭代）。阶段 6 评价口径：F05「队列可见」按「字段语义正确 + 冻结窗口下可观测」评价，而非「常态下能看到排队」。


---

## 2026-09-16 · 阶段 5

**编号**：DC-36
**问题**：**工作区路径长度 > macOS UDS `sun_path` 上限 ⇒ 隔离集群 socket 无法放在工作区内**
实测：PR worktree 绝对路径 **178 字节** > `sun_path` **104 字节** ⇒ 在工作区内 `listen` 得 `EADDRINUSE` 并进入陈旧文件重试死循环；本轮 socket 只能放 `$HOME/.pr005/router.sock`（db 仍留在工作区 `oamp/.runtime/`，被 `.gitignore` 忽略）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**环境硬约束**。记录理由：它影响**一切需要真集群取证的验收**（含阶段 6 与后续迭代）：socket 必须放短路径 ⇒「写入落在工作区内」这条纪律在 socket 上**不可能满足**。
**本迭代如何处理**：按「**有界且已声明的越界**」处理（实施方已如实上报并清理 `$HOME/.pr005`）；视为**规则 F 的合理例外**（与「收口三步固定在主工作区执行」同类），并要求证据段写明该例外与理由。

---

## 2026-09-16 · 阶段 5

**编号**：DC-37
**问题**：**验收比对脚本的过滤式过宽 ⇒ 记录口径小于实做口径**（子 agent 自查上报，主 agent 更正）——`pr-005` 证据 §11 的"既有面逐字比对"用了 `awk '/^### /{skip = ($2 ~ /^agents/ || $2 == "calls")} !skip'`，因 `$2` 只取首个 token，`calls` 分支实际匹配的是块内任意以 `calls` 开头的 token ⇒ **把全部 `### calls …` 块一并剔除**（`calls unknown` / `bad mode` / `bad schema` / `empty tasks` / `bad role` / `task+tasks` / `unknown transcript` / `unknown stream`），故记录写"对照覆盖 **15** 个请求块含全部 400/404"**不属实**。用收紧后的过滤式（`$0 ~ /^### agents/ || $0 == "### calls roster"`）重跑得：**比对块数 23、`diff_exit=0`、`docs: base=21 cur=29`**（27 条探针 = 23 比对 + 4 剔除）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**证据质量缺陷**（非产品缺陷）：**结论反而更强**（调用面的枚举校验与 404 也逐字相同），但**记录比实做窄** ⇒ 若不复核，阶段 6 与用户会低估该 PR 的零影响证据强度。记录理由：它印证了"**证据必须内联确切的命令与过滤式**"这一纪律的价值——本迭代已两次因"证据形态/口径"问题被迫返工（DC-19 / 本条）。
**本迭代如何处理**：不回退。① **主 agent 在合并态直接更正**（`ff09d7a`：收紧 §11 两处 `awk` 过滤式 + 把"15 个请求块"改为"**23 个块**（含调用面全部枚举校验与 404）"并附**口径更正说明** + 同步 §12 的引用），一步到位且留痕；② 子 agent 主动上报且**未越界**改主 agent 工作区（其纪律正确 ✓）；③ 该条作为"证据口径"类教训进阶段 6。

---

## 2026-09-16 · 阶段 5

**编号**：DC-38
**问题**：**API.md §3 出现小节号撞车**（主 agent 裁定接受）——`pr-006` 新增 8 个接口小节时，编号沿用了 `pr-005` 已在代码里登记的 `docLink` 号码（`#311-get-apisubscribe` / `#312-get-apipickup` / `#313-post-apipickupcall_idack` / `#3110-…` / `#3111-…` 等），而既有 §3 已占用 3.1~3.21 ⇒ 文档里出现**同号并存**（如 `3.11` 既是既有 `GET /api/docs` 又是新增 `GET /api/subscribe`）。按本仓 0018/0021 惯例，新节本应顺序编号 3.22~3.29。
**为什么判定为需求层面问题 / 为什么记录于此**：属**交付物风格缺陷**（非功能缺陷）。裁定前已核实：① `pr-005` 的验收标准**并未钉住 docLink 的号码**（仅要求"五项语义齐备"）；② 注册的锚点是 **GitHub slug 形态且唯一**（`#311-get-apisubscribe` ≠ 既有 `#311-get-apidocs`）⇒ **锚点可解析**（pr-006 的 AC3 因此成立）；③ `hub doctor` 三段 66 项全 pass、`/api/docs` 与文档双向 1:1、`llms.txt` 与生成器输出 + HTTP 产物 sha256 同源。
**本迭代如何处理**：**裁定接受现状**（保留 pr-005 已登记的锚点编号，不改已合并且已验证的 `pr-005` 代码与其证据），把"同号并存"作为**已知偏差**带入阶段 6。**下一迭代建议**：把这 8 个 `docLink` 改为顺序编号（3.22~3.29）并同步 `web.js` / `API.md` / `llms.txt` / `pr-005` 证据中的锚点引用（一次性小改，但必须与 pr-005 的证据一起改，故不宜在本迭代末期动）。
```

---

## 1. 委托的两件事（我接收的全部输入）

**产出物（验证目标）**
- 工作区：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index`（下文记 `<WS>`）
- 分支改动面：`feat/0029-pr-006-protocol-docs-and-index` 相对 base `b090369` = **4 文件**（`git diff --stat b090369..HEAD`：`oamp/API.md` `+313`、`oamp/llms.txt` `+10/-3`、`pr-006-protocol-docs-and-index.md` `+559`、`pr-006-protocol-docs-and-index-tasks.md` `+395`；`4 files changed, 1274 insertions(+), 3 deletions(-)`）
- PR 文件：`<WS>/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md`

**验证标准来源**：本委托简报的 4 条标准 + 上列 PR 文件「验收标准」段的 10 条 AC（AC1~AC10）。

**我刻意不接收的**：PR 文件「验收证据」段的自述结论（我只把它当作**待复核对象**，逐条实跑），以及任何执行过程叙述。

## 2. 独立取证环境（我自己的隔离集群，未触碰主工作区 / 主集群）

```bash
R=/Users/chenchiyuan/.cache/o29v6
rm -rf $R && mkdir -p $R
WS=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index
cd $WS
printf 'socket path bytes: ' ; printf %s $R/r.sock | wc -c
export OAMP_SOCKET=$R/r.sock OAMP_DB=$R/sql.db OAMP_WEB_PORT=8536
nohup node oamp/bin/oamp.js router start > $R/router.log 2>&1 &
nohup node oamp/bin/oamp.js agent start dev-1 > $R/agent.log 2>&1 &
nohup node oamp/bin/oamp.js web start --port 8536 > $R/web.log 2>&1 &
```

```
socket path bytes: 38
[router.log] [2026-09-16T15:51:45.898Z] router ROUTER_READY socket=/Users/chenchiyuan/.cache/o29v6/r.sock
[agent.log]  [2026-09-16T15:51:52.727Z] agent REGISTERED instance=dev-1 session=f5379e20-a520-4aab-ad26-90b590d4e6a4 lease_timeout_ms=30000
[web.log]    WEB_READY url=http://127.0.0.1:8536
```

**与产出方证据的隔离口径差异（我自己的选择）**：产出方用端口 `8436` / `~/.cache/o29p6`；我用端口 `8536` / `~/.cache/o29v6`、**全新空 DB**，即 AC1③ / AC7 / AC8 / AC10 都是在**空状态、独立进程、独立 socket** 上从零复现，不是沿用产出方的运行态。

**收尾（只按 PID + 命令行双重确认后停止，未动主集群）**

```bash
for p in 36905 36992 36994; do cmd=$(ps -o command= -p $p); case "$cmd" in *"oamp.js router start"|*"oamp.js agent start dev-1"|*"web start --port 8536") kill $p;; *) echo SKIP;; esac; done
```

```
kill 36905 : node oamp/bin/oamp.js router start
kill 36992 : node oamp/bin/oamp.js agent start dev-1
kill 36994 : node oamp/bin/oamp.js web start --port 8536
36905 已退出 / 36992 已退出 / 36994 已退出
端口 8536：curl 返回 000（不可连，符合预期）
主集群核对：ps -p 29179,29203,91573 → 主集群进程存活
```

---

## 3. 逐项判定

### 标准 1 · PR 文件「验收标准」段逐条判定（判据全部来自我自己的实跑）

#### AC1 §3 标题计数 21 → 29、表行 29 条、与运行侧 `GET /api/docs` 的 `routes[]` 双向 1:1 —— **pass**

① 计数与表行数（命令与产出方一致，输出我复现）：

```bash
cd $WS && grep -nE '^## 3\. 接口清单' oamp/API.md && grep -cE '^\| [0-9]+ \| `(GET|POST) /api/' oamp/API.md
```

```
168:## 3. 接口清单（29 条）
29
```

② 表行编号完整性与唯一性（**我自己加的判据**，产出方未做）：

```bash
grep -oE '^\| [0-9]+ \|' oamp/API.md | grep -oE '[0-9]+' | tr '\n' ' '
node --input-type=module -e '…编号 1..29 连续性 + shape 归一后去重计数…'
```

```
1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29
rows 29 min 1 max 29 连续1..29? true
形态键去重后数量 29 （=29 则无重复表行）
```

③ **双向 1:1**（在我的 8536 集群、空 DB 上跑）：

```bash
cd $WS && node --input-type=module <<'NODE'
import fs from 'node:fs';
const md = fs.readFileSync('./oamp/API.md', 'utf8');
const docs = await (await fetch('http://127.0.0.1:8536/api/docs')).json();
const shape = (p) => p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');
const doc = new Set();
for (const line of md.split('\n')) {
  const m = /^\|\s*\d+\s*\|\s*`(GET|POST)\s+(\/api\/[^`]*)`/.exec(line.trim());
  if (m) doc.add(`${m[1]} ${shape(m[2])}`);
}
const run = new Set(docs.routes.map((r) => `${r.method} ${shape(r.path)}`));
console.log('API.md §3 表行 =', doc.size, '｜ GET /api/docs routes[] =', run.size);
console.log('文档有运行无（登记缺失）=', JSON.stringify([...doc].filter((k) => !run.has(k))));
console.log('运行有文档无（文档未覆盖）=', JSON.stringify([...run].filter((k) => !doc.has(k))));
NODE
```

```
API.md §3 表行 = 29 ｜ GET /api/docs routes[] = 29
文档有运行无（登记缺失）= []
运行有文档无（文档未覆盖）= []
```

**判定：pass。** 29/29 双向无缺项；编号连续且无重复；该结论在**独立空集群**上复现，非沿用产出方运行态。

#### AC2 8 个新 `### 3.x` 小节齐备，逐条含 `{摘要 / 参数 / 响应 / 错误 / docLink}` 五项语义（摘要以调用方视角写） —— **pass**

判据（**我自己重写的脚本**，判据形态不完全等同产出方：摘要判据我用了 `\*\*0029 新增` 起句 + 语义通读，而非仅关键字命中）：

```bash
cd $WS && node --input-type=module <<'NODE' 2>/dev/null
import fs from 'node:fs';
import { createApiRoutes, projectRoutes } from './oamp/src/web.js';
const lines = fs.readFileSync('./oamp/API.md','utf8').split('\n');
const routes = projectRoutes(createApiRoutes({}));
const slug = (s)=>s.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/ +/g,'-');
const NEW = ['/api/subscribe','/api/pickup','/api/pickup/:call_id/ack','/api/calls/wait','/api/calls/:call_id/cancel','/api/health','/api/principals','/api/principals/:principal_id'];
for (const p of NEW){
  const r = routes.find(x=>x.path===p);
  const want = r.docLink.slice('API.md#'.length);
  const i = lines.findIndex(l=>/^### 3\./.test(l) && slug(l.slice(4).trim())===want);
  let j=i+1; while(j<lines.length && !/^### |^## /.test(lines[j])) j++;
  const body = lines.slice(i,j).join('\n');
  const c = { '摘要(调用方视角叙述句)': /\*\*0029 新增/.test(body), '参数': /\*\*参数\*\*|\*\*请求体\*\*|\*\*查询参数\*\*/.test(body), '响应': /\*\*成功响应\*\*\s*`2\d\d`/.test(body), '错误': /\*\*错误\*\*/.test(body), 'docLink': body.includes('> **文档链接**：`'+r.docLink+'`') };
  const miss = Object.entries(c).filter(([,v])=>!v).map(([k])=>k);
  const paramsOk = (r.params||[]).every(x=>body.includes('`'+x.name+'`'));
  const errsOk = (r.errors||[]).every(x=>body.includes(x));
  console.log(`${miss.length===0&&paramsOk&&errsOk?'✓':'✗'} ${r.method} ${r.path} L${i+1} 锚点#${want} 五项缺=${JSON.stringify(miss)} 参数名齐=${paramsOk} 错误码齐=${errsOk}`);
}
NODE
```

```
✓ GET /api/subscribe L1011 锚点#311-get-apisubscribe 五项缺=[] 参数名齐=true 错误码齐=true
✓ GET /api/pickup L1051 锚点#312-get-apipickup 五项缺=[] 参数名齐=true 错误码齐=true
✓ POST /api/pickup/:call_id/ack L1096 锚点#313-post-apipickupcall_idack 五项缺=[] 参数名齐=true 错误码齐=true
✓ GET /api/calls/wait L1129 锚点#318-get-apicallswait 五项缺=[] 参数名齐=true 错误码齐=true
✓ POST /api/calls/:call_id/cancel L1167 锚点#3110-post-apicallscall_idcancel 五项缺=[] 参数名齐=true 错误码齐=true
✓ GET /api/health L1203 锚点#3111-get-apihealth 五项缺=[] 参数名齐=true 错误码齐=true
✓ POST /api/principals L1233 锚点#322-post-apiprincipals 五项缺=[] 参数名齐=true 错误码齐=true
✓ GET /api/principals/:principal_id L1271 锚点#323-get-apiprincipalsprincipal_id 五项缺=[] 参数名齐=true 错误码齐=true
失败节数 = 0
```

**「摘要以调用方视角写」的人工判据**（我通读 8 条摘要原文，逐条判断"解决什么问题"而非罗列入参出参）——8/8 成立，原文抽样：

```
### 3.11 `GET /api/subscribe`
**0029 新增的服务化实时面**：接入方**一次连接**就拿到「纳管实例的状态变化」与「自己那些调用的进展和结论」——不必再自己写轮询脚本，也不必把多条既有流拼起来。

### 3.111 `GET /api/health`
**0029 新增的恢复判据**：一条请求回答「现在能不能用」——router 起没起、web 可用吗、有几个实例可派发（含正在重连的）。判据本身**只读、零副作用**（不发起真实调用、不写任何状态）。
```

**判定：pass。** 8/8 节齐备、五项语义齐备、参数名与登记 `params` 一一对齐、错误码与登记 `errors` 对齐；摘要是问题导向叙述（非字段罗列）。注：8 节摘要**统一以 `**0029 新增…**` 开头**（版本标记进入正文），属风格选择，见「偏差记录」第 6 条。

#### AC3 新路由的 `docLink` 锚点可解析到对应小节 —— **pass**（新增 8/8；1 条既有错配不计 fail，见偏差记录第 2 条）

```bash
cd $WS && node --input-type=module <<'NODE' 2>/dev/null
import fs from 'node:fs';
import { createApiRoutes, projectRoutes } from './oamp/src/web.js';
const lines=fs.readFileSync('./oamp/API.md','utf8').split('\n');
const file=lines.join('\n');
const routes=projectRoutes(createApiRoutes({}));
const frag=(r)=>r.docLink.replace(/^API\.md#/,'');
const slug=(s)=>s.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/ +/g,'-');
const heads=lines.filter(l=>/^### 3\./.test(l)).map(l=>l.slice(4).trim());
const miss=routes.filter(r=>!heads.some(h=>slug(h)===frag(r)));
console.log('路由数',routes.length,'｜slug 未命中',miss.length, JSON.stringify(miss.map(r=>`${r.method} ${r.path} → #${frag(r)}`)));
console.log('未命中者对应 base 是否同形:', heads.find(h=>h.startsWith('3.16')));
console.log('docLink 片段唯一?', new Set(routes.map(frag)).size===routes.length);
console.log('docLink 字面（API.md#xx）出现在 API.md 文中的条数:', routes.filter(r=>file.includes(r.docLink)).length, '/', routes.length);
NODE
```

```
路由数 29 ｜slug 未命中 1 ["GET /api/calls/stream → #316-get-apicallsstream"]
未命中者对应 base 是否同形: 3.16 `GET /api/calls/stream?chat_id=<id>`
docLink 片段唯一? true
docLink 字面（API.md#xx）出现在 API.md 文中的条数: 8 / 29
```

base 侧同形核对（证明该错配**非本 PR 引入**，且本 PR 无法修——`web.js` 未改）：

```bash
git show b090369:oamp/API.md | grep -nE '^### 3\.16'         # 745:### 3.16 `GET /api/calls/stream?chat_id=<id>`
git diff --name-only b090369 -- oamp/src/web.js | wc -l      # 0
```

**判定：pass（就本 PR 的验收要求而言）。** 新增 8 条 `docLink` 的 slug 与新增 8 个小节标题**逐字互解**（AC2 脚本第 5 项 8/8 ✓），`docLink` 片段 29 条全局唯一；唯一未命中项是**既有** `#316-get-apicallsstream`（既有小节标题含 `?chat_id=<id>` 而登记不含查询串），`base` 已同形、`web.js` 本 PR 零改动 ⇒ **不构成本 PR 的 fail**，已登记（本委托亦已裁为已接受的偏差）。

#### AC4 新增「等待语义」小节（`### 2.4`，明文四条） —— **pass**

```bash
cd $WS && grep -nE '^### 2\.' oamp/API.md
```

```
72:### 2.1 成功响应
77:### 2.2 统一错误契约
108:### 2.3 对象字段
157:### 2.4 等待语义
```

四条条文的机械判据（我自写）：

```
✓ ①终态为退出条件（"退出条件 = 终态" + completed/failed 当刻 + "不由超时值决定"）
✓ ②超时只放弃、不改状态（"超时只表示放弃等待" + state/error/exit_code 逐字不变 + timed_out 为唯一退出原因字段）
✓ ③禁止轮询+超时（"禁止把「轮询 + 超时」当作等待的实现" + timeout_ms 缺省即不设上限）
✓ ④客户端预算是放弃等待的预算（"不是等待的语义上限" + 30 分钟示例）
✓ 唯一真源声明（"本小节是等待语义的唯一真源（各接口只引用、不复制）"）
条文小节行数 9
```

条文原文（`sed -n '157,166p' oamp/API.md`，与产出方证据逐字一致，我已用自动比对复核，见标准 3）：

```
### 2.4 等待语义

**等待的退出条件必须是终态，不是「时间到了」。** 本小节是等待语义的**唯一真源**（各接口只引用、不复制）：

1. **退出条件 = 终态**：…
2. **超时只表示放弃等待**：…（`state` / `error` / `exit_code` 逐字不变）…一次调用式等待的**唯一退出原因字段是 `timed_out`**（布尔）…
3. **禁止把「轮询 + 超时」当作等待的实现**：…
4. **客户端等待预算是「放弃等待的预算」**：例如 CLI 侧 30 分钟的等待预算…**不是等待的语义上限**…
```

**条文与实现的对照（我读了实现，非采信自述）**：`oamp/src/web.js:1647-1728`（`GET /api/calls/wait`）的等待释放点是 `waiters` 句柄（终态发布点 resolve），超时走 `Promise.race([Promise.all(waiting), timeout])` 并**只摘除本请求登记的句柄**，随后按当刻状态回报 ⇒ **未把"轮询 + 超时"当实现**（无轮询循环，仅入口一次 `router.task_get` + 未得结论者的一次收尾查询），与第 3 条一致。

**判定：pass。** 位置（§2 顺序子小节）、号码（`### 2.4`）、四条语义、唯一真源声明全部成立；实现面与条文无冲突（**注意：`web.js` 属 pr-005 交付面，本 PR 未改，我此处只做条文—行为一致性对照**）。

#### AC5 既有 21 条表行与 21 个小节的文字逐字不变（删除行仅 §3 标题计数那一行） —— **pass**

```bash
git -C $WS diff --numstat b090369 -- oamp/API.md oamp/llms.txt
git -C $WS diff -U0 b090369 -- oamp/API.md | grep '^-[^-]'
git -C $WS diff -U0 b090369 -- oamp/API.md | grep -c '^-[^-]'; \
git -C $WS diff -U0 b090369 -- oamp/API.md | grep -cE '^-### 3\.'; \
git -C $WS diff -U0 b090369 -- oamp/API.md | grep -c '^+### 3\.'
```

```
312	1	oamp/API.md
9	1	oamp/llms.txt
-## 3. 接口清单（21 条）
1
0
8
```

**我自己加的更强判据**（产出方未做）：既有 21 行表行 base↔HEAD 逐字比对（只应出现新增 22~29）：

```bash
diff <(git show b090369:oamp/API.md | grep -E '^\| [0-9]+ \| `(GET|POST) /api/') \
     <(grep -E '^\| [0-9]+ \| `(GET|POST) /api/' oamp/API.md)
```

```
21a22,29
> | 22 | `GET /api/subscribe` | 实时订阅（按事件类型 / agent 过滤；SSE） |
…（22~29 共 8 行新增，无任何 ` < ` 删除行）
```

```bash
printf 'base ### 3. = %s ｜ HEAD ### 3. = %s\n' "$(git show b090369:oamp/API.md | grep -c '^### 3\.')" "$(grep -c '^### 3\.' oamp/API.md)"
```

```
base ### 3. = 21 ｜ HEAD ### 3. = 29
```

**判定：pass。** 整份 `API.md` **仅 1 行删除**（且是 AC1 要求的计数行）；既有 21 行表行逐字未变；3 个 hunk 的插入点均在**小节边界**（`@@ -157`、`@@ -181,0 +193,8`、`@@ -991,0 +1011,292`），无"钻进既有小节内部插字"的情形。

#### AC6 `oamp/llms.txt` 由生成器重生成；变更全落在接口清单段；自报条目数 = 29 —— **pass**

**注意（我主动规避的自伤动作）**：产出方证据里有一条是直接跑 `node oamp/scripts/gen-llms-txt.mjs`——该命令会**覆写被验证产物**。我**没有在仓库内执行它**，而是 ① 用纯函数等价性做只读判据；② 把 `oamp/` 整目录复制到 `/Users/chenchiyuan/.cache/o29v6/genchk/` 后再跑生成器，读取其自报并 `cmp` 回仓库快照。

```bash
shasum -a 256 oamp/llms.txt
node --input-type=module -e "…snapshot === renderLlmsTxt(projectRoutes(createApiRoutes({})))…"
wc -c oamp/llms.txt
grep -c '^- \(GET\|POST\) ' oamp/llms.txt
grep -n '^## ' oamp/llms.txt
git diff -U0 b090369 -- oamp/llms.txt | grep '^@@'
git diff -U0 b090369 -- oamp/llms.txt | grep '^-[^-]'
```

```
d5fd6f94875d67fe1446b74c5b743803e3dddcd7bf5a295351104792ca279c2c  oamp/llms.txt
snapshot === renderLlmsTxt(projectRoutes(createApiRoutes({}))): true
len snapshot 2187 len pure 2187
3493 oamp/llms.txt
29
5:## 接入
11:## 接口（29 条）
43:## 深入
@@ -11 +11 @@
@@ -13,0 +14,3 @@
@@ -21,0 +25 @@
@@ -30,0 +35,4 @@
-## 接口（21 条）
```

（**口径说明**：产出方证据写的"3493 字节"是 **UTF-8 字节数**，`wc -c` 实为 `3493` ✓；我脚本里 `len()` 得 `2187` 是**字符数**，两者不矛盾。）

生成器自报（在**拷贝树**中运行，未触碰仓库快照）：

```bash
T=/Users/chenchiyuan/.cache/o29v6/genchk && rm -rf $T && mkdir -p $T && cp -R oamp $T/oamp
node $T/oamp/scripts/gen-llms-txt.mjs
cmp $T/oamp/llms.txt $WS/oamp/llms.txt && echo "copied-tree 生成字节 == 仓库快照字节"
```

```
llms.txt 已生成：/Users/chenchiyuan/.cache/o29v6/genchk/oamp/llms.txt（接口 29 条，3493 字节）
copied-tree 生成字节 == 仓库快照字节
```

**判定：pass。** 快照 === 纯函数产出（⇒ 非手改、且与当刻路由登记同源）；生成器自报 `接口 29 条`；`llms.txt` 的 diff 为 **1 行删除（计数行）+ 9 行新增**，4 个 hunk 全部落在清单段（第 11~41 行），`## 深入`（第 43 行起）零变动。

#### AC7 快照与 HTTP 产物同源（逐字节相同） —— **pass**

```bash
curl -s -o /dev/null -w 'HTTP %{http_code} %{size_download} 字节\n' http://127.0.0.1:8536/llms.txt
curl -s http://127.0.0.1:8536/llms.txt | cmp - oamp/llms.txt && echo 'cmp 退出码 0：逐字节相同'
curl -s http://127.0.0.1:8536/llms.txt | shasum -a 256 ; shasum -a 256 oamp/llms.txt
```

```
HTTP 200 3493 字节
cmp 退出码 0：逐字节相同
d5fd6f94875d67fe1446b74c5b743803e3dddcd7bf5a295351104792ca279c2c  -
d5fd6f94875d67fe1446b74c5b743803e3dddcd7bf5a295351104792ca279c2c  oamp/llms.txt
```

**判定：pass。** 响应体与仓库快照 sha256 相同、`cmp` 逐字节相等，且在**我自己的进程/端口**上复现。

#### AC8 `hub doctor` 三段全 `pass`（R1 无 `文档未覆盖` / 无 `登记缺失`；R2 自动扩展；R3 探针集不变） —— **pass**

```bash
cd $WS && OAMP_SOCKET=/Users/chenchiyuan/.cache/o29v6/r.sock OAMP_WEB_PORT=8536 node oamp/bin/hub.js doctor | jq '{pass, total: (.items|length), R1: [.items[]|select(.id|startswith("R1"))]|length, R2: [.items[]|select(.id|startswith("R2"))]|length, R3: [.items[]|select(.id|startswith("R3"))]|length, failed: [.items[]|select(.ok==false)]}'
```

```
{
  "pass": true,
  "total": 66,
  "R1": 29,
  "R2": 29,
  "R3": 8,
  "failed": []
}
```

新增 8 面在 R1 / R2 的条目（我实跑，输出与产出方证据逐字一致）：

```
R1 GET /api/subscribe ok=true skipped=false actual=GET /api/subscribe reason=-
R1 GET /api/pickup ok=true skipped=false actual=GET /api/pickup reason=-
R1 POST /api/pickup/:/ack ok=true skipped=false actual=POST /api/pickup/:call_id/ack reason=-
R1 GET /api/calls/wait ok=true skipped=false actual=GET /api/calls/wait reason=-
R1 POST /api/calls/:/cancel ok=true skipped=false actual=POST /api/calls/:call_id/cancel reason=-
R1 GET /api/health ok=true skipped=false actual=GET /api/health reason=-
R1 POST /api/principals ok=true skipped=false actual=POST /api/principals reason=-
R1 GET /api/principals/: ok=true skipped=false actual=GET /api/principals/:principal_id reason=-
R2 POST /api/principals ok=true skipped=true actual=null reason=写端点不探，零写副作用
R2 GET /api/principals/:principal_id ok=true skipped=false actual=404 NOT_FOUND reason=-
R2 GET /api/health ok=true skipped=false actual=200 reason=-
R2 GET /api/subscribe ok=true skipped=true actual=null reason=流式端点，不探（存在性由 R1 覆盖）
R2 GET /api/pickup ok=true skipped=false actual=400 INVALID_PARAM reason=-
R2 GET /api/calls/wait ok=true skipped=false actual=400 INVALID_PARAM reason=-
R2 POST /api/calls/:call_id/cancel ok=true skipped=true actual=null reason=写端点不探，零写副作用
R2 POST /api/pickup/:call_id/ack ok=true skipped=true actual=null reason=写端点不探，零写副作用
```

`文档未覆盖` / `登记缺失` 计数与 R3 探针集：

```
$ ... | grep -c "文档未覆盖\|登记缺失"
0
grep 退出码 1

R3 agent.register ok=true actual=code INVALID_PARAMS
R3 agent.heartbeat ok=true actual=静默（通知型，1000ms 内无响应）
R3 agent.deregister ok=true actual=code UNREGISTERED
R3 message.send ok=true actual=code UNREGISTERED
R3 message.ack ok=true actual=code UNREGISTERED
R3 router.status ok=true actual=ok
R3 router.task_get ok=true actual=code INVALID_PARAMS
R3 router.task_list ok=true actual=code INVALID_PARAMS
```

**判定：pass。** `pass: true`、`failed: []`、R1/R2 各 29 条（自动扩展到 29 而非 21 ⇒ R2 自动扩展成立）、R3 恒为既有 8 个 Router 方法（无新增/无缺失）；`doctor.js` 本 PR 零改动（见 AC9）。

#### AC9 `oamp/README.md` 未被修改、`oamp/sdk/doctor.js` 未被修改（含全部不触碰面） —— **pass**

```bash
git -C $WS diff --name-only b090369
git -C $WS diff --numstat b090369 -- oamp/README.md oamp/sdk/doctor.js
git -C $WS diff --name-only b090369 -- oamp/src oamp/sdk oamp/scripts oamp/web roles | wc -l
git -C $WS status --short
```

```
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index-tasks.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md
oamp/API.md
oamp/llms.txt
（numstat 空）
0
（status 空）
```

**判定：pass。** 4 文件改动面；`README.md` / `doctor.js` / `gen-llms-txt.mjs` / `hub.md` / `surface.js` / `web.js` 及 `oamp/src`、`oamp/sdk`、`oamp/scripts`、`oamp/web`、`roles` 目录级**全部零命中**；取证时工作区干净。

#### AC10 条文与行为一致（反向验证：等待到超时后仍非终态、`error` 空、`exit_code` 未变） —— **pass**

我的独立复跑（我的 8536 集群、空 DB；`!sleep` 走 shell 执行器、**零模型调用**）：

```bash
cd $WS && B=http://127.0.0.1:8536 && PRJ=$(curl -s -X POST $B/api/projects -H 'content-type: application/json' -d "{\"repo_url\":\"https://example.invalid/pr006-verify-$(date +%s)\"}" | jq -r .project.project_id) && TASK=$(curl -s -X POST $B/api/messages -H 'content-type: application/json' -d "{\"project_id\":\"$PRJ\",\"agent_id\":\"dev-1\",\"text\":\"@dev-1 !sleep 6\"}" | jq -r .task_id) && echo "task=$TASK" && echo '--- ① 等待前 ---' && curl -s $B/api/calls/$TASK && echo && echo '--- ② 带超时等待（timeout_ms=2000） ---' && curl -s "$B/api/calls/wait?ids=$TASK&timeout_ms=2000" && echo && echo '--- ③ 等待返回后当刻 ---' && curl -s $B/api/calls/$TASK && echo && echo '--- ④ 自然终态（!sleep 6 走完） ---' && sleep 7 && curl -s $B/api/calls/$TASK
```

```
prj=prj-14192ea0-b935-4075-9abf-37de507e4a73 task=task-8b266302-ce60-4e01-8816-6e462129f660
--- ① 等待前 ---
{"call_id":"task-8b266302-ce60-4e01-8816-6e462129f660","agent":null,"state":"working","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
--- ② 带超时等待（timeout_ms=2000） ---
{"timed_out":true,"timeout_ms":2000,"results":[],"unresolved":[{"call_id":"task-8b266302-ce60-4e01-8816-6e462129f660","state":"working"}]}
--- ③ 等待返回后当刻 ---
{"call_id":"task-8b266302-ce60-4e01-8816-6e462129f660","agent":null,"state":"working","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
--- ④ 自然终态（!sleep 6 走完） ---
{"call_id":"task-8b266302-ce60-4e01-8816-6e462129f660","agent":null,"state":"completed","duration_ms":6012,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":0}
```

**三键严格比对**（第二次运行，落盘后 `diff`，避免肉眼判断）：

```bash
curl -s $B/api/calls/$TASK | jq -Sc '{state,error,exit_code}' > before.json
W=$(curl -s "$B/api/calls/wait?ids=$TASK&timeout_ms=1500")
curl -s $B/api/calls/$TASK | jq -Sc '{state,error,exit_code}' > after.json
diff before.json after.json && echo "三键 diff 为空（逐字相同）"
```

```
wait 返回: {"timed_out":true,"timeout_ms":1500,"results":[],"unresolved":[{"call_id":"task-4d9cbbe9-38a9-4052-b7e9-96df7200734e","state":"working"}]}
before: {"error":null,"exit_code":null,"state":"working"}
after : {"error":null,"exit_code":null,"state":"working"}
三键 diff 为空（逐字相同）
自然终态: {"state":"completed","exit_code":0,"duration_ms":5016}
```

**判定：pass。** 超时路径 `timed_out:true` + 该 id 留在 `unresolved`；等待返回当刻 `state` 仍非终态、`error` 为 `null`、`exit_code` 为 `null`（与等待前逐字相同）；随后自然 `completed` 且 `exit_code 0` ⇒ 超时**既未冻结也未改写**状态，与 §2.4 第 2/3 条一致。

---

### 标准 2 · 改动面封闭性（改动面 ⊆ 「文件范围」；「不触碰」清单逐条零命中；无夹带） —— **pass**

```bash
git -C $WS diff --stat b090369..HEAD
git -C $WS diff --name-only b090369
for f in oamp/src/web.js oamp/sdk/doctor.js oamp/skill/hub.md oamp/README.md oamp/scripts/gen-llms-txt.mjs oamp/sdk/surface.js; do echo "$f 改动文件数=$(git -C $WS diff --numstat b090369 -- $f | wc -l)"; done
git -C $WS diff --name-only b090369 -- oamp/src oamp/sdk oamp/scripts oamp/web roles | wc -l
```

```
 .../prs/pr-006-protocol-docs-and-index-tasks.md    | 395 +++++++++++++++
 .../prs/pr-006-protocol-docs-and-index.md          | 559 ++++++++++++++++++++-
 oamp/API.md                                        | 313 +++++++++++-
 oamp/llms.txt                                      |  10 +-
 4 files changed, 1274 insertions(+), 3 deletions(-)

docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index-tasks.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md
oamp/API.md
oamp/llms.txt

oamp/src/web.js 改动文件数=0
oamp/sdk/doctor.js 改动文件数=0
oamp/skill/hub.md 改动文件数=0
oamp/README.md 改动文件数=0
oamp/scripts/gen-llms-txt.mjs 改动文件数=0
oamp/sdk/surface.js 改动文件数=0
0（目录级：src/sdk/scripts/web/roles 全零命中）
```

**判定：pass。** 改动面**恰好** = PR 文件「文件范围」声明的 3 项（`oamp/API.md`、`oamp/llms.txt`、本 PR 文件）+ `prs/<slug>-tasks.md`（按本委托给定口径 DC-18：属工作流规定产物、**不构成夹带**）；「不触碰」清单 6 项 + 5 个目录**逐条零命中**；无第 5 个文件、无 `package.json`/锁文件/脚本夹带。

### 标准 3 · 证据可复核性（照抄复跑 + 仓库外依赖 + 占位符 + 以结论词充数） —— **pass**（3a 复跑 25/26 逐字节一致、1 条仅易失值不同；3b~3d 见下）

**3a 机械复跑（我写了一致性复跑器：抽取证据段每对「```bash 块 + 紧跟输出块」，把 `8436→8536`、`o29p6→o29v6` 后原样执行并逐字比对）**

```
bash 块数 28 ｜ 跟随输出块对数 28
#0 skipped（进程启动块，我以 §2 的自建集群替代）
#28 skipped（生成器块，会覆写被验证产物 ⇒ 改在拷贝树跑，见 AC6）
2 MATCH  4 MATCH  6 MATCH  8 MATCH  10 MATCH  12 MATCH  14 MATCH  16 MATCH  18 MATCH  20 MATCH
22 MATCH  24 MATCH  26 MATCH  30 MATCH  32 MATCH  34 MATCH  36 MATCH  38 MATCH  40 MATCH  42 MATCH
44 MATCH  46 MATCH  48 MATCH  50 MATCH  52 MATCH
54 DIFF（AC10 块）
```

唯一 `DIFF` 的差异定位（**只差易失值**，语义断言全同）：

```
@@ -1 +1 @@
-task=task-49dc8332-d446-4179-8393-a41e24cd4d8e
+task=task-c144246b-2596-46e9-9c28-2347011768e7
@@ -11 +11 @@
-…,"state":"completed","duration_ms":6010,"model":null,…,"exit_code":0}
+…,"state":"completed","duration_ms":6006,"model":null,…,"exit_code":0}
（其余行完全一致：timed_out:true / unresolved 保留 working / 三键 null → diff 逐字相同）
```

⇒ **26 个可复跑块中 25 个字节级一致，第 26 个仅 `call_id` 与 `duration_ms` 不同（产出方已在块内声明"调用 id 是每次运行的易失值"）**。产出方证据的**命令本身可复制执行**，不是散文转述。

**3b 仓库外依赖扫描**

```bash
P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md
sed -n '/^## 验收证据/,/^### §11/p' $P | grep -c '/tmp/'          # 0
sed -n '/^## 验收证据/,/^### §11/p' $P | grep -n '\.cache'         # 7 行
grep -c '/tmp/' $P                                                 # 3（全部在 §11 自检块内，530 行起）
```

```
0
10:mkdir -p /Users/chenchiyuan/.cache/o29p6     # 工作区外的一次性运行态目录（短路径，仅本 PR 集群使用）
11:export OAMP_SOCKET=…/o29p6/r.sock OAMP_DB=…/o29p6/sql.db OAMP_WEB_PORT=8436
353 / 370 / 395 / 412：（AC8 的四条 doctor 命令，带 OAMP_SOCKET=…/o29p6/r.sock）
3
```

⇒ 证据段**零 `/tmp` 依赖**；唯一仓库外依赖是 `~/.cache/o29p6`（socket/DB），已在 §0 **同一块内 `mkdir -p` 自建并声明用途**，且与本委托给定的已接受偏差 DC-36（工作区路径 178 B > `sun_path` 104 B ⇒ socket 只能短路径）一致 ⇒ **不构成不可复核**。`§11` 自身的 3 处 `/tmp` 字样是自匹配文本，不在可执行证据内。

**3c 占位符扫描（含 `\{…\}` 形态）**

```bash
sed -n '/^## 验收证据/,/^### §11/p' $P | grep -nE 'xxx|待填|TODO|\{…\}|<slug>|<TS>|<timestamp>'   # 退出码 1（零命中）
python: 含省略号 U+2026 的行数 = 0 ；含 {…} 的行数 = 0
sed -n '/^## 验收证据/,/^### §11/p' $P | grep -oE '\{…\}|…|<[a-zA-Z_]+>' | sort | uniq -c | sort -rn
```

```
      9 <call_id>
      6 <id>
      4 <chat_id>
      2 <principal_id>
      1 <confirmation_id>
```

⇒ **零自造占位符**；上述尖括号形态全部来自 AC1 要求的 29 行清单原文 / 小节标题原文 / §2.4 条文（`API.md` 既有路径参数语法，AC5 要求逐字携带），以及 `sed -n '157,166p'` 输出的 git `@@` 上下文。**另注**：AC10 的比对命令行在文件中是完整 914 字符单行（我已按 `python` 核对末 120 字符为 `…&& curl -s $B/api/calls/$TASK`），**显示层的 `…` 是阅读器 768 字符截断，不是文件内容**。

**3d 「以结论词充数」扫描**

```bash
awk '/^## 验收证据/,/^### §11/' $P | awk '/^```/{f=!f;next} !f' | grep -nE '通过|一致|相同|不变|全 pass|零命中|无缺项'
awk '/^## 验收证据/,/^### §11/' $P | awk '/^```/{f=!f;next} !f' | grep -nE 'pass'
```

```
65 / 73 / 93 / 97 / 123 / 129：（AC 标题行 + AC5「读法」+ AC10「读数」）
97:### AC8 `hub doctor` 三段全 `pass`（…）   ← 证据段内唯一的 "pass" 字样，出现在**小节标题**里
```

⇒ 证据段内**无独立结论句**：仅有的两处解读文字（AC5「读法」、AC10「读数」）都**紧跟在命令 + 原样输出之后**，是对已展示原始输出的转述；段内**没有**任何 `**pass**` 式断言（判定表在证据段之外、位于文件末）。

**标准 3 判定：pass。**

### 标准 4 · 既有面零影响（对既有 21 条接口文档 / 既有小节"逐字不变"的声明是否成立） —— **pass**

删除行核对（同 AC5）之外，我另做**逐节字节级比对**（把 `base:oamp/API.md` 与 HEAD 的 `oamp/API.md` 按 `^## ` / `^### ` 切块后比较）：

```bash
python: sections(base) vs sections(HEAD) → 同名标题正文逐字节比较
```

```
base 标题数 59 ｜HEAD 标题数 68
仅 base 有： ['## 3. 接口清单（21 条）']                      ← 计数行（AC1 要求改写）
同标题但正文变化： []                                          ← 零条
新增标题数： 10 ['### 2.4 等待语义', '## 3. 接口清单（29 条）', '### 3.11 GET /api/subscribe', '### 3.12 GET /api/pickup',
                 '### 3.13 POST /api/pickup/<call_id>/ack', '### 3.18 GET /api/calls/wait',
                 '### 3.110 POST /api/calls/<call_id>/cancel', '### 3.111 GET /api/health',
                 '### 3.22 POST /api/principals', '### 3.23 GET /api/principals/<principal_id>']
§3 既有 21 节全部逐字节相同： True
§3 既有节数 21 → 29
```

`llms.txt` 侧同类核对（`git diff b090369 -- oamp/llms.txt` 全文只有 1 行删除 + 9 行新增，且 `## 深入` 段零变动）见 AC6。

**判定：pass。** 「既有 21 条表行与 21 个小节文字逐字不变」的声明**成立**：58 个既有非 §3-计数标题的正文**零处变化**，§3 既有 21 节字节级全同，唯一被改写的既有行是 AC1 要求改写的 §3 标题计数行。

---

## 4. 汇总

判定条目合计 **13 项** = 标准 1（PR 文件「验收标准」段的 AC1~AC10）10 项 + 标准 2 / 标准 3 / 标准 4 各 1 项。

- **pass：13 项**
- **fail：0 项**（无需返工条目）
- **partial：0 项**
- **blocked：0 项**

**结论：PASS（13/13 pass；fail 0 条；8 条偏差已登记、均不阻塞交付）。**

## 5. 偏差记录

> 均为"实现/文档与规格表述之间的不一致或记录面缺陷"，**不影响上述判定**，供主 agent 决策。

| # | 位置 | 现状（我的实测） | 影响 | 建议处理 |
|---|---|---|---|---|
| 1 | `oamp/API.md` §3 小节号 | 8 个新小节**沿用 pr-005 已登记号码**（`3.11/3.12/3.13/3.18/3.110/3.111/3.22/3.23`），与既有 `3.11 GET /api/docs`、`3.12`、`3.13`、`3.18` **同号并存**（实测 `grep -nE '^### (3\.11\|…)$'` 同号各两处） | 阅读时同号歧义；锚点因后缀不同而互不冲突（`docLink` 片段 29 条全局唯一、新增 8 条 slug 逐字互解 ✓） | **DC-38 已裁定接受**；下一迭代一次性改为顺序编号 `3.22~3.29`，同步 `web.js` / `API.md` / `llms.txt` / pr-005 证据 |
| 2 | `oamp/src/web.js` 登记的 `#316-get-apicallsstream` | 全量 29 条反查中**唯一未命中**；既有小节标题含 `?chat_id=<id>` 而登记不含查询串；`base` 已同形、`web.js` 本 PR 零改动 | 单个既有锚点跳转落空（非本 PR 引入） | 下一迭代修（改既有小节标题或登记值二选一）；本迭代保持不动 |
| 3 | `oamp/API.md` 既有 21 节 | 既有 21 节**不含** `> **文档链接**：API.md#…` 行（新增 8 节才有：`grep -c` 得既有区段 `0`、新增区段 `8`） | AC3「逐字沿用既有形态」实际是**沿用登记值形态**，而非沿用既有小节的书写形态；文档内可机械复核的 docLink 只覆盖新增面 | 下一迭代评估是否给既有 21 节补 docLink 行（注意：这与「既有小节逐字不变」冲突，须作为一个独立 PR 处理） |
| 4 | `<WS>/docs/…/deferred-demand-changes.md` | 本工作区副本止于 `DC-23`（231 行 / sha256 `106b92a2…`，与 `b090369` 逐字节相同），**缺 `DC-24`~`DC-38`**；真源在父迭代工作区（376 行，自 `DC-24` 起为未提交 `M` 改动）。本委托简报引用的 `DC-33/35/36/38` 在本工作区副本中**不存在** | 阶段 6 / 收口若以"各 PR 工作区副本"为准，会漏读 15 条搭置记录；本报告已按简报要求**原文摘录本工作区副本**（置顶），并附父工作区 `DC-24`~`DC-38` 逐字补录以消歧 | 收口前把父迭代工作区的最新副本提交并同步/明确"以迭代工作区为唯一真源"；否则每个 PR 工作区的副本都会钉在旧版 |
| 5 | `prs/pr-006-protocol-docs-and-index.md`「验收标准」段 | 10 条复选框**全部为未勾选 `- [ ]`**（`- [x]` 计数 = 0），判定结论改由文件末的判定表承载 | 只读复选框的读者/工具会误判"10 条全部未完成"，与文末"10 条 pass"构成**双重真相** | 回填复选框（或删除复选框形态只保留判定表），使机械读者与人工读者看到同一结论 |
| 6 | 新增 8 节摘要 | 8/8 摘要均以 `**0029 新增…**` 前缀开头（版本标记进入正文，而非仅在变更历史里） | 文档长期可读性：迭代号会成为正文噪声（如"0029 新增的取件面"在 0031 迭代读者眼里是历史包袱） | 风格项，不阻塞；下一迭代可评估是否改为"新增于 0029"式页脚注释 |
| 7 | AC8 证据的可复跑前提 | AC7 / AC8 / AC10 三条证据都**隐含依赖 §0 已启动的隔离集群**（`~/.cache/o29p6` + 端口 8436）。我复跑时须先自建等价集群（端口 8536） | 跨机/隔时复跑不能"只抄 AC8 一条命令"就成立 | 保留；建议 §0 显式加一句"§3 之后的证据须在该集群存活期间执行"，降低误读为"独立可跑"的风险 |
| 8 | 实现/规格的实质一致性（我在偏差扫描中专门核了 §2.4 第 3 条） | `GET /api/calls/wait` 实现为**句柄式释放**（终态发布点 resolve）+ `Promise.race` 超时，超时只摘除本请求句柄、不改状态；**无轮询循环** | 无 | 无需处理（**记此项以说明"实现与条文一致"是被核过的，而非默认**） |

## 6. 下一迭代候选

- **`doctor` 对新面成功路径的覆盖仍为空白**：R2 对 `GET /api/pickup`、`GET /api/calls/wait` 只探到 `400 INVALID_PARAM`（缺参数），`GET /api/principals/:id` 只探到 `404 NOT_FOUND`；**成功路径的响应形态没有任何独立探针**，只由文档描述承担。本 PR 禁改 `doctor.js`，故此项只能留给下一迭代（或由使用方在验收时手工构造）。
- **`API.md` §3.18 可补一条"超时路径下 `results` 必为空"的显式说明**：当前须从 §2.4 第 2 条 + 响应样例推导（实测 `timed_out:true` 时 `results:[]`、结论落在 `unresolved`）。
- **既有锚点修复（偏差 1/2/3 合并处理）**：§3 编号顺序化 + `#316-…` 错配 + 既有 21 节 docLink 行，三者互相牵动，建议作为**一个**独立小 PR（须同步 `web.js`、`API.md`、`llms.txt` 与 pr-005 证据里的锚点引用）。
- **搭置文件真源去重（偏差 4）**：8 个 PR 工作区各自持有一份旧副本，本质是"每个工作区复制一份全局台账"。建议下一迭代明确"台账只存在于迭代工作区"，或在收口流程里加一步"同步各 PR 工作区副本"。
- **PR 文件判定表与复选框的二义性（偏差 5）**：建议把该形态固化到 workflow 的 PR 文件模板里（要么只有复选框、要么只有判定表）。

## 7. 结论

**PASS**（13 项判定全部 pass；**fail 0 条**；partial 0 项；blocked 0 项；偏差记录 8 条已登记、不阻塞交付）。

## 8. 交付完整性声明（供主 agent 直接采信 / 复核）

- 本报告只写入了 1 个新文件（即本文件），**未修改**任何被验证产物：`oamp/API.md`、`oamp/llms.txt`、`prs/pr-006-protocol-docs-and-index.md`、`prs/pr-006-protocol-docs-and-index-tasks.md`。
  - 取证结束时 `git -C <WS> status --porcelain` 输出为空（干净）；四文件 sha256：`API.md 18ba00ab…`、`llms.txt d5fd6f94…`、PR 文件 `b9715e41…`、tasks 文件 `cf2a4185…`。
  - **未新增任何测试文件**；生成器只在 `~/.cache/o29v6/genchk/` 的拷贝树上执行过。
- 真集群取证只用了**我自己的隔离集群**（socket/DB 在 `~/.cache/o29v6` 短路径、端口 `8536`、全新空 DB），取证完成后按 PID + 命令行双重确认逐个停止；**未触碰主工作区与主集群**（核对：主集群 `router 29179` / `web 29203` / `pb-dev 91573` 始终存活；`tmux oamp-cluster` 11 个窗口未动）。
- 全程未使用 `hub api calls create`，未向任何 peer 派发调用。
