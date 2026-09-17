# 独立验收报告：pr-005（HTTP 会话面与调用面 `oamp/src/web.js`）

> verifier 独立验收产物（不接收执行过程上下文；结论只依据产出物与我自己的实跑取证）。
> 依据 `workflow-pb` v0.13.0：本报告**置顶原文呈现**本工作区的 `deferred-demand-changes.md`（不转述、不总结）。

---

## 搭置记录原文（`deferred-demand-changes.md` 全文置顶）

```text
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
```

---

验证者身份：**HTTP 接口面「同级代码审查者」**（反射依据：产出物 = 单文件 HTTP 路由/SSE/投影实现 + 真集群行为；审查标准 = 该 PR 文件自列的 70 条验收标准 + 改动面封闭性 + 证据可复核性 + 既有面零影响。具备该判定能力的身份 = 熟悉 Node 内置 http / SSE / UDS-RPC 投影面、能把「接口自述」与「真集群实跑」分开的评审者）

产出物：
- `oamp/src/web.js`（分支 `feat/0029-pr-005-web-session-and-call-surface`，HEAD `f83c25e`，相对 base `51eb893` 的 19 个提交；本 PR 自身 diff = `oamp/src/web.js` +758/-21）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md`（七字段 + 文件范围 + 验收标准 + 验收证据）
- 工作区：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-005-web-session-and-call-surface`

验证标准来源：主 agent 简报《独立验收简报：pr-005》4 条标准（① 验收标准逐条判定 ② 改动面封闭性 ③ 证据可复核性 ④ 既有面零影响 G01）；判据一律来自本报告内的**我自己实跑**命令与原始输出，未采信 PR 文件「验收证据」段的自述。

验证日期：2026-09-16

## 取证环境（我自己起、与主集群完全隔离）

```bash
RT=/tmp/pr005v            # 短路径（socket 18B，绕开 macOS UDS sun_path 104B 上限）；脚本/日志/原始输出全在此
W=<上面的工作区绝对路径>
export OAMP_SOCKET=/tmp/pr005v/r.sock OAMP_DB=/tmp/pr005v/pr005.db OAMP_ROLE_ROOT="$W" OAMP_HEARTBEAT_TIMEOUT_MS=20000
# 我起的进程（harness hub 命名 p5v-*，cwd=/tmp/pr005v）：router(8431 后端) / agent pb-dev / web(8431)
# 取证后全部 stop；未 pgrep/kill 任何主集群进程
```

隔离核验（杀进程前先核 PID 的 cwd，避开主集群）：
```bash
$ ps -o pid,ppid,command -p 91573 | tail -1
91573 60503 node oamp/bin/oamp.js agent start pb-dev --role dev --tools on --permission allow
$ lsof -a -p 91573 -d cwd | tail -1
node  91573 chenchiyuan cwd DIR ... /Users/chenchiyuan/projects/agents      ← 主工作区，**未触碰**
$ ps -o pid,ppid,command -p 11083 | tail -1
11083 60503 node /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-005-web-session-and-call-surface/oamp/bin/oamp.js agent start pb-dev
$ lsof -a -p 11083 -d cwd | tail -1
node 11083 chenchiyuan cwd DIR ... /private/tmp/pr005v                     ← 我的隔离集群，仅对它 kill -9
```

---

# 逐项判定

## 标准 1 · 验收标准逐条（70 条 checkbox，逐条 pass/fail/partial）

### A. 路由登记与元数据（F17 / §5.1）——5 条

- **8 条路由登记在 `createApiRoutes` 表内、每条 8 个元数据字段**：**pass**
  证据（结构直读真实表）：
  ```bash
  node -e "const w=await import('file://$W/oamp/src/web.js');const r=w.createApiRoutes({});
    console.log('ROUTE_META_FIELDS',w.ROUTE_META_FIELDS.length,'table',r.length,'missing',
      JSON.stringify(r.filter(x=>w.ROUTE_META_FIELDS.some(f=>x[f]===undefined)).length));"
  → ROUTE_META_FIELDS= ["method","path","summary","params","response","errors","kind","docLink"] count= 8
    table length= 29   entries missing metadata fields: []
  curl -s $B/api/docs | jq '.routes|length'  → 29     # 基线 21 → 当前 29（+8）
  ```
  8 条新路由在投影中各带 8 个元数据字段（另加派生 `danger`）：`POST /api/principals` / `GET /api/principals/:principal_id` / `GET /api/health` / `GET /api/subscribe`(kind=sse) / `GET /api/pickup` / `GET /api/calls/wait` / `POST /api/calls/:call_id/cancel` / `POST /api/pickup/:call_id/ack`（原始输出见 `/tmp/pr005v/out/b1-routing.txt`）。

- **可达性：`GET /api/calls/wait` 优先于 `GET /api/calls/:call_id`；反证 ⇒ 404 `call 不存在: wait`**：**pass**（正反两向均由我实跑）
  证据（正向，HEAD 真集群）：`curl -s -o /dev/null -w 'wait:%{http_code} ' "$B/api/calls/wait?ids=nope"` → `wait:200 {"timed_out":false,"timeout_ms":null,"results":[],"unresolved":[{"call_id":"nope","state":null}]}`
  证据（反向，**我自建的工作区外副本**：`oamp → /tmp/pr005v/neg/oamp`，仅把 `/api/calls/wait` 表项整体移到 `:call_id` 之后，`node --check` 通过后同 socket 起 web:8432）：
  ```bash
  curl -s -o /dev/null -w 'neg wait: %{http_code} ' "http://127.0.0.1:8432/api/calls/wait?ids=nope"
  → neg wait: 404 {"error":"call 不存在: wait","code":"NOT_FOUND"}
  ```
  = 与 PR 文件声明的反证结论逐字一致（PR 登记「反证未执行」，我补做了；被验证产物未被改动）。
  另：表内位置实证 `index of /api/calls/wait = 23` < `index of /api/calls/:call_id = 26`。

- **`GET /api/docs` 含上述 8 条（请求时现算）；既有 21 条 summary 与字段说明逐字未改（只追加）**：**pass**
  证据：`grep -n "projectRoutes" web.js` → `1241: sendJson(res, 200, { routes: projectRoutes(routes) }); // 请求时投影：不缓存、不预快照`（handler 内每次重算）。
  基线/当前两次真集群取证（base web.js = `git show 51eb893:oamp/src/web.js` 落到 `/tmp/pr005v/base/oamp`，`OAMP_ROLE_ROOT` 指向工作区）：
  ```bash
  diff <(21 条基线投影 jq -cS) <(29 条当前投影中剔除 8 条新路由后 jq -cS)
  1c1 /api/agents : response 追加「（0029 pr-005：每行追加 connected / busy / current_call_id / queued / since）」
  15c15 /api/calls : response 追加「（0029 pr-005：每行追加 last_event_at）」
  other existing entries changed: []      # 其余 19 条逐字相同，且顺序不变
  ```
  → 属**纯追加**（基线串是当前串的前缀），`summary`/`params`/`errors` 零变更。

- **`ERR_CODE` 追加 `STALE_EPOCH`(↔409)，既有 5 码与文案逐字不变；全部 4xx/5xx 仍过 `sendError`**：**pass**
  ```bash
  diff <(git show 51eb893:oamp/src/web.js | sed -n '/^export const ERR_CODE/,/});/p') <(sed -n '/^export const ERR_CODE/,/});/p' oamp/src/web.js)
  → 唯一差异行：+ STALE_EPOCH: 'STALE_EPOCH', // 409 客户端持有的易失会话代次已过期
  grep -nE 'sendJson\(res, (4[0-9][0-9]|5[0-9][0-9])' oamp/src/web.js  → (无命中)
  grep -nE 'writeHead\((4[0-9][0-9]|5[0-9][0-9])' oamp/src/web.js → 570:403 / 575:404（静态面 serveStatic；基线的 403/408 同款，非接口面错误）
  ```
  实测映射：`?epoch=x` → `409 {"error":"会话代次已过期: x","code":"STALE_EPOCH"}`（subscribe/pickup/ack 三面一致）。

### B. F01 身份面——5 条

- **注册 200 + 幂等（`created_at` 一致）+ `epoch`**：**pass**
  ```bash
  POST {"principal_id":"p1","kind":"cli"} → 200 {"principal":{"principal_id":"p1","kind":"cli","instance_id":null,"created_at":1789571054286,"last_seen_at":1789571054286},"epoch":"471a936a-…99047830-…"}
  POST {"principal_id":"p1"}              → 200 created_at 仍 1789571054286、last_seen_at 前移（无冲突）
  ```
  边界：64 字符 → 200；65 字符 / 空串 / 缺字段 → 400 `INVALID_PARAM`；控制字符（JSON 转义 `"bad\u0007id"`）→ `400 {"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）","code":"INVALID_PARAM"}`。
- **`GET /api/principals/<id>`：存在 200 并前移 `last_seen_at`（含 `epoch`）；不存在 404 `NOT_FOUND`**：**pass**
  ```bash
  GET /api/principals/p1   → 200 … last_seen_at 1789571054286→1789571054345（前移）+ epoch
  GET /api/principals/nope → 404 {"error":"principal 不存在: nope","code":"NOT_FOUND"}
  ```
- **形态非法 ⇒ 400 `INVALID_PARAM`（与 `registry.isValidInstanceId` 同源）**：**pass**（上条 3 例；源码 `principals.isValidPrincipalShape` 与 `registry.isValidInstanceId` 同为「非空、≤64、0x21~0x7e」逐例同判）。
- **「任一被受理的请求前移 `last_seen_at`」覆盖 6 面（逐面前后对比）**：**pass**
  为让「读」不再自触碰，我自建**工作区外**的可观测副本（`/tmp/pr005v/instr`：追加一只只读 debug 路由 `GET /api/__principals` 与 `principals.__dump()`；该副本另起 router2/agent2/web:8436，与真集群无关），逐面前后读值：
  ```text
  face 1/6 register  → created_at=last_seen_at=1789572090524
  face 2/6 query     → 1789572090524 → 1789572091754
  face 3/6 subscribe → 1789572091754 → 1789572092988
  face 4/6 dispatch  → 1789572092988 → 1789572095227
  face 5/6 pickup    → 1789572095227 → 1789572096524
  face 6/6 ack       → 1789572097057 → 1789572098286
  control GET /api/agents → 1789572098286 → 1789572098286（不触碰，说明是逐面显式 touch 而非全局副作用）
  ```
- **web 重启后用同一 `principal_id` 再注册 ⇒ 200、`created_at` 取新进程首次交互时刻，且调用方不改身份即可继续派发/查询**：**pass**
  ```text
  重启后 dump entries=0 → POST 同 id → created_at 1789572205820（旧 1789572090524，新身份）
  GET /api/principals/face-p1 → "face-p1" 200；POST /api/calls(requester=face-p1) → {"warnings":[],"state":"submitted"} 200
  ```

### C. F02 / F14 派发归属与自派发——6 条

- **不携带 `requester`：响应字段集/取值域与迭代前逐字相同（对照：唯一变量=是否携带）**：**pass**
  ```text
  (a) 不带 requester → 顶层 keys=["calls"]   （无 warnings）
  ```
  且基线/当前同入参探针中 `POST /api/calls` 各错误分支逐字相同（见标准 4）。
- **携带 `requester` 且目标=该身份声明的 `instance_id` ⇒ `warnings[{index,call_id,kind:'self_dispatch',message}]` 且照常派发**：**pass**
  ```text
  注册 self-1(instance_id=pb-dev) → POST calls{agent:dev,requester:self-1}
  → keys=["calls","warnings"]，warnings[0]={"index":0,"call_id":"task-61eb6a22…","kind":"self_dispatch","message":"requester 与目标 agent 相同"}，.calls[0].state="submitted"，HTTP 200
  ```
- **对照实验：换成非自身实例 ⇒ `warnings` 为 `[]`**：**pass**（`other-1(instance_id=pb-other)` → `{"keys":["calls","warnings"],"warnings":[]}`，唯一变量=目标是否自身实例）
- **批量两项、仅第二项自派发 ⇒ `warnings[0].index === 1`**：**pass（以 DC-32 等价对照判定）**
  实测（两项都自派发）：`warnings=[{index:0,call_id:"task-7f80b47b…"},{index:1,call_id:"task-d4c4e4fc…"}]`，两个 `index` 与同响应 `calls[]` 的 `call_id` 逐项对应 ⇒ 逐项定位能力成立。字面形态「仅第二项」在当前请求契约（批量 `agent` 为请求级单值）下**不可构造**（主 agent 已裁决采纳 DC-32）。
- **`requester` 不进信封：`GET /api/calls/<id>` 键集仍为既有键 + 既有键序，无 `requester`/`warnings`**：**pass（附计数偏差）**
  ```text
  {"call_id":…,"agent":"dev","state":"submitted","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
  jq keys → ["agent","call_id","duration_ms","error","exit_code","model","state","structured_output","text","truncated"]（10 键）；has_requester=false / has_warnings=false；原始字节键序与基线一致
  ```
- **未注册 `requester` ⇒ 按需幂等 upsert、不阻断派发；既有校验顺序（模式枚举/schema/批量上限/角色可寻址）逐字未动**：**pass**
  ```text
  POST calls{requester:"p-new-v"}（未注册）→ 200 warnings=[] state=submitted；GET /api/principals/p-new-v → 200（created_at=派发时刻）
  校验顺序：base/当前两次真集群探针中「bad mode / bad schema_mode / bad output_schema / unknown role」四块**逐字相同**
  → 400 "mode 非法（需为 background / block）" / "schema_mode 非法（需为 permissive / strict）" / "output_schema 非法（…）" / 404 "agent 不可用: no-such-role（无对应在线实例）"
  ```

### D. F03 订阅第一形态（SSE）——6 条

- **建立 SSE（沿用既有头 / `retry: 1000` / 15s keepalive）；`principal` 缺失或空 ⇒ 400 `INVALID_PARAM`**：**pass**
  ```text
  HTTP/1.1 200 OK / content-type: text/event-stream; charset=utf-8 / cache-control: no-store / connection: keep-alive / Transfer-Encoding: chunked
  frames 首帧 13 字节：`retry: 1000\n\n`（cat -A：retry: 1000$$），15s 后出现 `: keepalive`
  GET /api/subscribe          → 400 {"error":"需要合法 principal","code":"INVALID_PARAM"}
  GET /api/subscribe?principal= → 400 同上
  ```
- **事件名恰 7 名（`notice` 不出现）；`kinds` 域外 ⇒ 400**：**pass**
  `FILTERED_EVENT_KINDS = ['agent_online','agent_offline','agent_state','call_state','call_update','call_result','confirmation']`（7 名、无 notice）；`?kinds=nope` → `400 {"error":"kinds 含非法事件类型","code":"INVALID_PARAM"}`；同一窗口实收事件名 ⊆ 该 7 名（`agent_state`/`call_state`/`call_update`/`call_result`），且**不出现** `message`/`chat_state`/`task_update`/`notice`（对照：同窗口既有 `/api/stream` 实收 `message`/`chat_state`/`task_update`）。
- **过滤：kinds=['agent_online'] 收不到 call_state；`agents` 角色名≡实例名；kinds 与 agents 为 AND**：**pass**（同一窗口 9 个订阅者对照）
  ```text
  new-all(无 kinds/agents) : agent_state×2 call_result×2 call_state×1 call_update×427
  new-result(kinds=call_result)      : call_result×2（且无 call_state）
  new-role(kinds=call_state&agents=dev)    : call_state×1
  new-inst(kinds=call_state&agents=pb-dev) : call_state×1   ← 角色名与实例名收帧集合相同
  new-other(kinds=call_state&agents=pb-other):（空）
  new-onlineonly(kinds=agent_online) :（空，尽管窗口内有在跑的调用 ⇒ 过滤成立）
  ```
- **建立不发初始帧；无订阅者时事件被丢弃且零错误；断开再连不要求补发**：**pass**（首帧即 `retry: 1000`，无数据帧；无订阅者窗口派发 shell 任务 → 消息面 200、任务 completed；web 进程日志仅 `WEB_READY`+Node SQLite 警告，零 error 行；重连后不补发历史）
- **隔离：新订阅的存在/断开不影响既有 4 条推送面的订阅者与事件到达**：**pass**（同一窗口内既有面照常收帧：old-chat `chat_state×5 message×5 task_update×428`、old-events `chat_state×2`、old-calls `call_state×1 call_result×2 call_update×427`）
- **既有 `GET /api/events`/`/api/stream`/`/api/calls/stream`/`/api/calls/<id>/stream` 事件类集合与语义逐字不变**：**pass（确定性子集）**
  我做的独立版：基线与当前各跑一次**同形态会话（只走 shell 任务的确定性负载）**并 diff 三面的事件名序列 + 每帧 payload 键形状 →
  ```text
  diff out/sess2-base/seq.txt out/sess2-cur/seq.txt → IDENTICAL
  push-chat  : sequence message chat_state task_update message chat_state message chat_state task_update message chat_state
  push-events: chat_state ×4
  push-calls : （shell 负载两面皆无帧）
  ```
  `/api/calls/<id>/stream` 的事件类集合在 F03 同窗口取证中与基线同款（`call_state`/`call_update`/`call_result`）；其**全量序列**因 LLM 负载不确定（实测 call_update 134~427 条波动）不可逐字 diff（主 agent 已把该缺口登记为已接受偏差）。

### E. F05 / F16 / F06 投影与进展字段——11 条

- **`/api/agents` 每行追加 `connected/busy/current_call_id/queued/since`，既有 5 键名与值域不变；`?state=online` 判据仍是 `state==='online'`**：**pass**
  ```text
  {"instance_id":"pb-dev","session_id":"…","state":"online","last_heartbeat":…,"connected":true,"role":"dev","busy":false,"current_call_id":null,"queued":0,"since":null}
  （键序：既有键位置不动，四字段追加在后）；base/当前探针「既有键投影」逐字相同；?state=online 结果集与基线一致，?state=bogus 仍 400
  ```
- **空闲实例 ⇒ `busy:false / current_call_id:null / queued:0 / since:null`**：**pass**（上式即空闲实测）
- **在跑 ⇒ `busy:true` 且 `current_call_id` 与 `GET /api/calls/<id>` 同一调用 id**：**pass**
  ```text
  roster: {"busy":true,"current_call_id":"task-ac8a97b9…","since":1789571282928}   且 /api/calls/task-ac8a97b9… → {"state":"working"}
  ```
- **同实例在跑期间连续派发 N 次 ⇒ `queued ≥ 1` 且随队列消化下降**：**pass**
  ```text
  冻结窗口（只对我的隔离 agent SIGSTOP，先核 pid/cwd）：before queued=2 → 冻结期派发 1 次 → queued=3 → SIGCONT 后 1s 起连采 8 次 → queued=2（消化 1）
  另一窗口：队列峰期 3 条 submitted，恢复抓取 queued=2 busy=true current=task-77dcb49…
  ```
  口径与 DC-35 相符（健康 agent 上受理即 working ⇒ 常态 0，仅冻结窗口可观测）。
- **订阅面：有 `agent_state` 订阅者时跳变不轮询可见；无订阅者时不拉 `router.task_list`（零新增 UDS 流量）**：**pass（后台 tick 口径）**
  我自建 UDS 计数代理（`/tmp/pr005v/count-proxy.mjs`，插在 web 与 router 之间、只转发+计方法名），读数：
  ```text
  无任何订阅者 + 纯空闲 9s            : router.status 3→3, router.task_list 6→6      （零新增流量）
  单个 GET /api/agents（按请求现拉）  : +1 status, +1 task_list                        （= DC-29 已裁决形态）
  订阅 kinds=agent_state 10s          : +6 status, +6 task_list                        （2s tick）
  订阅 kinds=call_result 10s          : +0/+0                                          （tick 只由 agent_state 订阅者键控）
  订阅全部断开后再空闲 8s             : +0/+0                                          （tick 自停）
  订阅面三态/忙碌跳变（不轮询）：
   {"instance_id":"pb-dev","connected":false,"busy":false,…}                        ← kill -9 agent 当刻
   {"instance_id":"pb-dev","connected":true,"busy":true,"current_call_id":"task-8cb91c35…","since":…}
   {"instance_id":"pb-dev","connected":true,"busy":false,"current_call_id":null,…}   ← 空闲→在跑→空闲
  ```
- **三态可区分且「重连中」不消失**：**pass**
  ```text
  kill -9 前 : {"instance_id":"pb-dev","state":"online","connected":true}
  kill -9 后 : {"instance_id":"pb-dev","state":"online","connected":false}（仍在列表）+ health {online:1,reconnecting:1,offline:0,total:2}
  >20s 后    : {"instance_id":"pb-dev","state":"offline","connected":false} + health {online:1,reconnecting:0,offline:1,total:2}
  ```
- **软重启窗口（只重启 hub、保留 agent 进程口径）**：**pass**
  ```text
  roster.json = {"written_at":1789571868008,"instance_ids":["pb-dev"]}      ← 只带实例 id
  重启 router+web 后首帧快照：{"instance_id":"pb-dev","session_id":null,"state":"online","last_heartbeat":null,"connected":false,"role":"dev","busy":false,"current_call_id":null,"queued":0,"since":null}
  health {online:0,reconnecting:1,offline:0,total:1}；21s 后 → {"agents":[]}（移除，不是 offline 墓碑）
  ```
  （四字段一律清空 ⇒ 不残留重启前在跑投影；随后 agent 回归即由真实节点行取代，`connected:true`。）
- **名册 best-effort：文件缺失/损坏 ⇒ 视为无提示、启动不报错；写失败被忽略**：**pass**
  ```text
  写入 `{not valid json` → 重启 web → WEB_READY，GET /api/agents 200 {"agents":[]}，health total 0（无报错）
  写入 {"instance_ids":["web","pb-dev","",null,"pb-other"]} → 视图 ["pb-dev","pb-other"]（SENDER_ID 'web' 与空/null 被读写两侧同一判据剔除）
  写失败路径：`writeRoster` 的 fs 调用整体 try/catch（源码 2066-2075），健康面用纯函数 rosterHintRows（不写盘）
  ```
- **`/api/calls` 每行追加 `last_event_at`（= `updated_at`），既有 6 列名与取值不变；无 `idle_ms`**：**pass**
  ```text
  {"call_id":"…","agent":"dev","state":"completed","started_at":…,"ended_at":…,"model":null,"last_event_at":…}  （既有 6 列 + last_event_at，无 idle_ms）
  base/当前探针「既有列投影」逐字相同
  ```
- **停滞对照：持续推进型与无新事件型的 `last_event_at` 可区分；终态后不再前进**：**pass**
  ```text
  持续推进（LLM 调用，18s 内 6 次采样）：1789571465279 → 468105 → 470371 → 473164 → 477359 → 479988（单调前进，transcript 1000 条）
  无新事件（!sleep 任务）：last_event_at 6s/12s 两次采样恒为 1789571432276
  终态后：completed 调用两次采样恒为 1789571444400（= ended_at）
  ```
- **被取消/终态的调用不产生虚假在跑投影**：**pass**（取消后 roster 行 `state:"failed"`；同一时刻 `/api/agents` 的 `busy/current_call_id` 指向**另一条**真实在跑任务，取消的调用不出现在 `current_call_id`）

### F. F07 / F08 取件与代次——8 条

- **`GET /api/pickup?principal=`：只列 `acked=false`；正文经 `task_get`+`composeCallEnvelope` 现算、与 `calls get` 同形同取值；非终态不出现；无游标参数**：**pass**
  ```text
  非终态调用不在集合中：[…]（派发后立即查询，仅历史已终态条目）
  取件条目 envelope 与 GET /api/calls/<id> 字节相同：cmp "$O/get-C1.json" "$O/pk-C1.json" → CMP_IDENTICAL
  路由元数据 params = [principal(required), epoch(optional)]，无 cursor；带 ?cursor=abc 结果集不变
  ```
- **离线取件：派发后（无订阅）到终态后接入，取件面取到终态结果；保留窗内重复查询稳定**：**pass**
  （取件三次查询条目集合与 envelope 逐字一致；该窗口**从未存在任何订阅者**，强于「断开全部订阅」形态）
- **`POST /api/pickup/<call_id>/ack?principal=`：200 `{call_id,acked:true}` 并移出集合；重复 ack / 不存在 id 一律 200 无副作用**：**pass**
  ```text
  first → {"call_id":"task-2b2e5b10…","acked":true}；repeat → 同；unknown nope → {"call_id":"nope","acked":true}
  ack 后列表：C1 消失、C2 仍在
  ```
- **只有携带 `requester` 的调用才产生取件指针**：**pass**（不带 requester 的调用跑完（cancel 到终态）后 `pickup` 集合不变）
- **指针写入点为 `publishCallResult`（唯一写点，投递/对账共用）**：**pass**（`grep -c 'pickup\.add'` → `1`；`grep -n` → `2224: pickup.add({`，位于 `publishCallResult` 体内；另 `grep -c 'pickup\.add'` 在 `settleCancelledCall` 内为 0 ⇒ 无第二终态源）
- **`epoch` 语义：三面携带；web 或 Router 任一重启后变化；同一对进程存续期内恒定**：**pass**
  ```text
  Router 重启前 epoch = 471a936a-…99047830-…  → 重启后 = 471a936a-…cc9a1b83-…（webBootId 不变、generation 变）
   web 重启后 epoch = b17bf630-…e96a6604-…（bootId 变）；重启前整段会话内取值恒定（同一对进程）
  ```
- **不匹配 `epoch` ⇒ 409 `STALE_EPOCH`；不给 ⇒ 不判过期；既有面一律不新增 `epoch`**：**pass**
  ```text
  /api/subscribe?…&epoch=x → 409；/api/pickup?…&epoch=x → 409；POST /api/pickup/<id>/ack?…&epoch=x → 409
  带匹配 epoch 的 pickup/ack → 200；不带 → 200（不判过期）
  既有面（agents/chats/messages/calls/…）响应键集与基线逐字相同 ⇒ 无 epoch 注入
  ```
- **epoch 观测失败 ⇒ 沿用最后已知值；从未观测到 ⇒ `0`，不报错**：**pass**
  ```text
  Router 停掉后：health 仍 200，epoch 仍 471a936a-…99047830-…（= 最后一次已知 generation），router.generation=null
  全新 web 指向不存在的 socket：POST /api/principals → epoch "241fef05-…**​.0**"；health epoch 同值，200（不报错）
  ```

### G. F09 / F10 终态关流与晚订阅补发——7 条

- **先订阅后终态：订阅在终态当刻结束，退出时刻不由客户端超时决定**：**pass**
  ```text
  calls 面调用（AC/证据的主体）：--max-time 25 → curl_exit=0 elapsed_since_cancel=0.02s；--max-time 3 → curl_exit=0 elapsed_since_cancel=0.021s（两种客户端上限下同一时刻）
  订阅期收到的字节：retry: 1000 + 恰 1 帧 event: call_result（含 chat_id，实时路径既有形态）
  ```
- **不吞最后一帧：先收终态帧、再收关闭**：**pass**（上两例 curl exit=0 且文件内含终态帧 ⇒ 帧先到、连接随发布点收口关闭；`settleCancelledCall`→`publishCallResult` 同一 tick 内先 publish 后 close）
- **关流范围只到 `call:<call_id>`：`chat-calls:<id>` 与其它调用订阅继续存活**：**pass**
  ```text
  call-scope: CLOSED at terminal（1 帧 call_result）
  chat-scope: still open（后续第二次派发仍收到 call_state×1 + call_result×2，共 3 处 call_id 提及）
  ```
- **晚订阅补发：对已终态调用 ⇒ 立即收到一帧当刻终态信封（与 `calls get` 同形）并随即结束；不补发中间过程事件**：**pass**
  ```text
  diff -u <(calls get) <(stream data) → DIFF_EMPTY；cmp → CMP_IDENTICAL；terminal frames=1；无 call_state/call_update
  ```
- **不存在的调用 id ⇒ 既有 404 `NOT_FOUND` 且不建立订阅**：**pass**（`404 {"error":"call 不存在: nope-xyz","code":"NOT_FOUND"}`，2s 内在读仍 404，无 SSE 头）
- **不变量：每个订阅至多一帧终态帧、至多关闭一次（两路幂等）**：**pass**（live 订阅 1 帧即关；随后对同一 id 新建的订阅补发 1 帧即关；两处各恰 1 帧）
- **既有「订阅者断开 ⇒ 清理订阅」路径不变**：**pass（结构级证据）**：`oamp/src/transport.js` 相对 base `git diff` **为空**（该清理逻辑与 `closeCallSubscriptions` 均在其内，pr-005 零改动），`handleCallStream` 的调用点在当前 handler 中逐字保留（仅在其后追加补发分支）；该路径无外部可观测量，故以「文件零改动 + 调用点不变」为判据。

### H. F11 / F12 等待入口——8 条

- **返回形态与语义**：**pass**
  ```text
  {"timed_out":false,"timeout_ms":null,"results":[{call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code}],"unresolved":[{"call_id":"nope-zz","state":null}]}
  results 条目（去 call_id）与 calls get 逐字相同：diff → DIFF_EMPTY
  ```
- **退出条件=全部终态（不提前返回）**：**pass**（`!sleep 4` + `!sleep 9` 两项 → elapsed=9.177s，`timed_out:false`，两项都在 results）
- **已终态/不存在的 id ⇒ 结论立即可得**：**pass**（已终态 + 不存在 → elapsed=0.063s；已终态进 results、不存在进 unresolved 且 `state:null`）
- **`timed_out` 是唯一退出原因字段**：**pass**（全部有结论 → false；到上限 → true 且未终态项留在 unresolved，`timeout_ms` 回显上限值）
- **`timeout_ms` 可选正整数、缺省不设上限；非法 ⇒ 400**：**pass**
  ```text
  0 / -1 / abc / 1.5 / "2,3" → 全部 400 {"error":"timeout_ms 需为正整数","code":"INVALID_PARAM"}；缺 ids → 400 {"error":"需要 ids（至少一个调用 id）"}
  缺省：不加 timeout_ms 的等待在该次终态（4s/9s/12s 任务）返回，未出现默认上限截断
  ```
- **超时不产生结论、不改变调用状态**：**pass**（`timeout_ms=1500` → elapsed=1.561s，`timed_out:true`，unresolved state=working；随后 `calls get` 仍 `{"state":"working","error":null,"exit_code":null,"text":null}`）
- **三条等待路径口径一致（退出时刻不由超时值决定）**：**pass**（订阅式：客户端 25s/3s 两种上限下均在终态当刻 0.02s 退出；一次调用式：超时值只决定「到点放弃」的时刻，终态到位即返回；`mode:block` 请求在取消当刻拿到终态信封）
- **等待句柄由既有唯一终态发布点释放；本进程无登记的 id 走既有对账兜底，退出判据恒为终态**：**pass**
  ```text
  releaseWaiters 调用点恰 3 处：publishCallResult(2239) / settleCancelledCall(2208) / createWaiterWatch 兜底(2146)
  实测：messages 面派发的 shell 任务（web 侧无 calls 面登记）等待正常在终态返回（4s/9s）；calls 面调用被取消时，同一时刻的等待请求（block 模式）立即拿到终态信封
  ```

### I. F13 取消——6 条

- **`POST /api/calls/<id>/cancel`（无请求体）⇒ 200 且本次生效**：**pass**（working → `{"cancelled":true,"state":"failed","error":"cancelled"}`，随后 `calls get` **当刻**即 `{"state":"failed","error":"cancelled"}`）
- **重复取消 / 对已终态取消 ⇒ `cancelled:false` + 原 `state`/`error` 原样**：**pass**（重复 → `{"cancelled":false,"state":"failed","error":"cancelled"}`；对已终态 `context_busy` 调用 → `{"cancelled":false,"state":"failed","error":"context_busy"}`，错误文案未被改写）
- **不存在 id ⇒ 404 `NOT_FOUND`**：**pass**（`404 {"error":"call 不存在: nope","code":"NOT_FOUND"}`）
- **与关流/等待协同（同一时点语义）**：**pass**（同一 tick：`call:<id>` 订阅收 1 帧后关闭；等待请求 0.02s 内拿到终态信封；两者都在 cancel 后 0.02s 内收口）
- **不新增终态取值；既有信封/roster/转录读法零漂移**：**pass**（全量 roster `state` 取值集合 = `completed,failed,submitted,working`；取消不写 web 侧状态，终态真源仍为 Router 任务表）
- **取消生效后落恰一条 `out`（`error='cancelled'`）+ `chat_state`；后续 `task.update`/`task.result` 在状态面被忽略**：**pass**
  ```text
  out 计数 55 → 56（恰 +1）；新增 out = {"error":"cancelled","text":"执行失败：cancelled"}；对话 state="failed"（不停在 working）
  迟到结果忽略：cancel 一条 `!sleep 4` 任务后每 1.5s 采样 4 次，恒为 {"state":"failed","error":"cancelled","exit_code":null,"text":null}（任务实际执行完成后仍未翻成 completed）
  ```

### J. F15 恢复判据——5 条

- **一次调用返回七项 + `callable = router.ok && web.ok && agents.online >= 1`**：**pass**
  ```text
  {"router":{"ok":true,"detail":"ok","generation":"99047830-…"},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{"online":2,"reconnecting":1,"offline":0,"total":3},"callable":true,"epoch":"…"}
  jq 计算 callable 公式 → {"expected":true,"actual":true}
  ```
- **`agents` 三项分别可读（非合成数）**：**pass**（键集 `offline/online/reconnecting/total`；三态实测取值分别出现 `{online:1,reconnecting:1,offline:0}` 与 `{online:1,reconnecting:0,offline:1}`）
- **Router 不可达 ⇒ `router.ok:false` + `detail` 含原始原因（含 socket 路径），响应仍 200（唯一特例）**：**pass**
  ```text
  http=200 {"router":{"ok":false,"detail":"connect ENOENT /tmp/pr005v/r.sock（socket: /tmp/pr005v/r.sock）","generation":null},"web":{"ok":true,"detail":"监听中；持久层可读"},"agents":{…0…},"callable":false,"epoch":"…"}
  同期其它面不静默成功：/api/calls、/api/calls/<id>、/api/pickup、/api/agents → 502 {"error":"router 不可达或请求失败: connect ENOENT …","code":"UPSTREAM_UNAVAILABLE"}
  ```
- **判据零副作用（不发起真实调用、不写状态）**：**pass**（health 调用前后 `/api/pickup?principal=self-1` 字节相同 `CMP_IDENTICAL`（连续两次）；名册写盘路径不参与健康面 —— 该面用纯函数 `rosterHintRows`；roster.json 未因 health 改写）
- **hub 重启后三问转绿，且调用方不改身份即可继续派发与查询**：**pass**（重启后 `callable:true`、`generation` 变、`epoch` 变；同一 `principal_id` 未改身份即 `GET /api/principals/self-1` 200 + `POST /api/calls` 200（带自派发告警），无需重新注册）

### K. 既有面零影响（G01）——5 条

- **一次典型会话在既有 4 条推送面上与迭代前一致**：**pass**（我做的确定性会话 base/当前 diff：三面事件名序列 + payload 键形状 **IDENTICAL**；calls 面见前述限制）
- **既有端点的既有参数语义与校验顺序未变（同入参响应体逐字比对）**：**pass**
  我自建 28 块只读探针（含 `?state=online`/`?archived`/`limit/offset`/调用面全部枚举与 400/404 路径），基线与当前**顺序两次**跑同一 socket/db/端口：
  ```text
  IDENTICAL blocks 25/28；差异 3 块全部可解释：
    · GET /api/docs —— 新增 8 条路由（既有 21 条仅 2 条 response 串尾部追加说明，其余逐字相同、顺序不变）
    · GET /api/stream?chat_id=… 与 GET /api/events 的 header 块 —— 仅 Date 头不同（其余逐字相同）
  ```
  另实证：`POST /api/calls` 的 `mode/schema_mode/output_schema/unknown-role` 四类校验块逐字相同（见 F02/F14 组）。
- **`STATIC_FILES` 白名单零新增键；`/llms.txt` 仍是包根快照字节**：**pass**
  ```bash
  diff <(git show 51eb893:oamp/src/web.js | sed -n '/^const STATIC_FILES = {/,/^};/p') <(sed -n '/^const STATIC_FILES = {/,/^};/p' oamp/src/web.js)  → 空
  curl -s $B/llms.txt > /tmp/…; cmp /tmp/… oamp/llms.txt → 字节相同（且 oamp/llms.txt 相对 base 零改动）
  ```
- **零新增第三方依赖 / 零新 env / 零新配置键 / DB 三表不变 / 名册宽限复用既有 `heartbeatTimeoutMs`**：**pass**
  ```text
  git diff --name-only 51eb893..HEAD → 仅 pr-005-web-session-and-call-surface.md / -tasks.md / oamp/src/web.js
  git diff 51eb893..HEAD -- oamp/package.json oamp/src/config.js oamp/src/persist.js oamp/src/transport.js oamp/src/registry.js oamp/src/router.js oamp/sdk/uds.js oamp/web oamp/API.md oamp/llms.txt oamp/sdk/surface.js oamp/skill/hub.md oamp/web oamp/README.md oamp/sdk/doctor.js oamp/scripts/gen-llms-txt.mjs → 空
  web.js 的新增行内无 process.env 读取；新 import 仅 principals.js / pickup.js（pr-002 模块，消费面声明内）
  sqlite 表 = chats / messages / projects（三表）；名册提示宽限判据 = config.heartbeatTimeoutMs（源码 2086）
  ```
- **既有 `POST /api/calls` 的 `mode:block`、对账补拉、`entry.landed` 幂等闸门语义不变**：**pass**
  ```text
  mode:block 实测：请求挂起至终态单一发布点释放 → 另一 shell 取消该调用当刻，block 请求返回终态信封
  {"calls":[{"call_id":"task-a8464fb2…","state":"failed","error":"cancelled",…}]}（非 202/非提前返回）
  对账/闸门：源码中 reconcileTask→publishCallResult 单一发布点 + call.published 幂等闸门仍在，diff 未触及既有分支
  ```

## 标准 2 · 改动面封闭性 —— **pass**

```bash
git -C "$W" diff --name-only 51eb893..HEAD
→ docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface-tasks.md   （DC-18 已裁决：阶段 5 产物，不算夹带）
→ docs/iterations/0029-hub-client-session-and-duplex/prs/pr-005-web-session-and-call-surface.md        （PR 文件「文件范围」自列）
→ oamp/src/web.js                                                                                     （PR 文件「文件范围」自列）
git -C "$W" diff --stat 51eb893..HEAD -- oamp  → oamp/src/web.js | 758 +++++++++ 21 ---  （唯一代码面）
```
「不触碰」清单逐条零命中（每条 `changed_files=0`）：`oamp/API.md`、`oamp/llms.txt`、`oamp/sdk/surface.js`、`oamp/skill/hub.md`、`oamp/web`、`oamp/src/transport.js`、`oamp/src/registry.js`、`oamp/src/router.js`、`oamp/sdk/uds.js`、`oamp/src/persist.js`、`oamp/README.md`、`oamp/sdk/doctor.js`、`oamp/scripts/gen-llms-txt.mjs`。
`git status --porcelain` 为空（无未跟踪夹带、无新增测试文件）。⇒ 改动面 ⊆ 声明范围，无夹带。

## 标准 3 · 证据可复核性（抽命令照着复跑）—— **partial**

复跑到的（pass 部分）：
```text
§0/§11 `git diff --name-only 51eb893 HEAD`  → 与文件记录的三行逐字一致
§1 `node --check oamp/src/web.js && echo SYNTAX_OK` → SYNTAX_OK
§2 F01 全部 curl 例 → 文案/码完全一致（除 created_at/last_seen_at 时间戳）
§4 subscribe 头与帧 → content-type/retry:1000/13 字节一致（Date 头随时钟不同，属正常）
§7 先订阅后终态（calls 面）→ 0.02~0.06s 关流、先帧后关：一致
§8 wait 四组语义 → 逐条一致（含 timeout_ms 1000 的 1.04s 返回、已终态+不存在 0.065s 立即返回）
§9 cancel 语义 → 逐条一致（含 context_busy 原样保留）
§10 health 形态/不可达仍 200/零副作用 → 一致
§12 自检 grep（14 / 0 / 14 行）→ 逐字复现
```
不通过复跑的部分（fail 依据，均已定位）：
1. **§1 的行号是陈旧值且含命令产不出的行**：文件记录 `563/596/705/876/1428/1549/1637/1694/1724`；按同一命令在 HEAD 复跑得 `688/721/747/1051/1613/1647/1737/1776`，在**证据提交自身** `e40baf1` 复跑同为后一组 ⇒ 记录值来自更早的中间态。且记录里 `oamp/src/web.js:1724: path: '/api/calls/:call_id',` 一行**不可能**由所印命令产出（该命令的替换式里没有裸 `:call_id` 分支）。
2. **§6 的 `grep -n 'pickup\.add'` 输出多出一行**：文件记录 `2173: if (call.requester !== null) {` + `2174: pickup.add({`，而该命令（无 `-B1/-A1`）只会打印命中行；实跑 `1` / `2224: pickup.add({`（`e40baf1` 上为 2220）⇒ 行号陈旧 + 输出与命令不符。
3. **§5 证据段含占位符**：`kill -STOP \{agent-pid\}`、`kill -CONT \{agent-pid\}`、`ps -p \{my-agent-pid\}`、`kill -9 \{my-agent-pid\}` 四行原样带 `\{…\}` 占位符，**不可照抄执行**（该证据段未给出 PID 获取命令）。PR 文件 §12 的自检只扫 `<[a-z_]+>` 形态，因此报「证据段命中 0 行」，属自检口径不全。
4. **§11 的关键脚本不在产出物内**：比对命令依赖 `$RT/probe.sh`（+ `base-endpoints.txt`/`cur-endpoints.txt`），而 `$HOME/.pr005` 现已空、仓库内无 `probe.sh`，文件正文也未列出其 15 条请求清单 ⇒ §11 的比对命令**不可照原样重放**（其**结论**我已用自建 28 块探针独立复现，见标准 4）。
5. **§2 控制字符例与原样命令不可复现同一文案**：照抄 `--data-binary "$(printf '{"principal_id":"bad\u0007id"}')"` 在 bash 下 `printf` 会解释 `\u0007` 成裸控制字节 ⇒ 实测 `400 {"error":"请求体非法 JSON: Bad control character in string literal…","code":"INVALID_PARAM"}`（文件记录为 `principal_id 非法（…）`）。该记录文案仅在把 `\u0007` 作为 JSON 转义字面量传入时出现（我实测：`-d '{"principal_id":"bad\u0007id"}'` → `400 {"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）"}`）。两者同为 400 `INVALID_PARAM`，故不改变该 AC 的判定（F01 形态非法项仍 pass），但记录不可逐字复现。

结论口径：证据段**无 `/tmp` 字面量依赖**（统一走 `RT="$HOME/.pr005"`）、无「以结论词充数」的整段空缺（除 §3/§5 少量散文式追述，如「随后 roster 见其 working」未附命令），主体可重放；因上述 5 类缺陷判 **partial**。

## 标准 4 · 既有面零影响（G01）—— **pass**

判据与原始输出见标准 1 的 K 组（28 块探针 25 块字节相同 + 3 块可解释；确定性会话序列 IDENTICAL；STATIC_FILES/llms.txt 零变更；依赖/env/配置/DB 零变更；`mode:block`/对账/幂等闸门语义未变；「不触碰」清单零命中）。
补充：既有面**未**新增 `epoch`（键集逐字比对通过）；既有 `sendError` 唯一构造点仅新增一枚机器码（见 A 组）。

---

# 汇总

- **标准 1（70 条验收标准逐条）**：pass **70** 项 / fail 0 / partial 0 / blocked 0
- **标准 2（改动面封闭性）**：pass
- **标准 3（证据可复核性）**：**partial**（5 类可定位缺陷，见上；主体可重放）
- **标准 4（既有面零影响 G01）**：pass
- 汇总计数（按 4 条验证标准计）：**pass 3 / fail 0 / partial 1 / blocked 0**（其中标准 1 内含 70 条逐项，全部 pass）

# 偏差记录

> 实现与现有规格/文档不一致的地方。不影响本次验收判定，但应在下一迭代中同步文档或评估是否调整实现。

| 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|
| PR 文件「验收标准」写「键集仍为既有 **11** 键（随后自列 10 个键名）」 | 实测 `GET /api/calls/<id>` 恰 **10** 键，且与基线逐字一致、键序不变 | 按实现更正 AC 文案（「10 键」）；判定不受影响 |
| PR 文件锚点 `oamp/src/web.js:475`（`createApiRoutes` 路由表）、`:1507`（`publishCallResult`）等 | 均为 **base 51eb893** 的行号；HEAD 上分别为 642/648 与 2221-2224 | 在 AC 中标注「行号以 base 51eb893 为准」，或改为符号锚点（函数名） |
| 验收证据 §1/§6 记录的行号（563/…/1724、2173/2174） | HEAD 实跑为 688/…/1776、2224；且在证据提交 `e40baf1` 上亦为同组新值（记录来自更早中间态） | 重跑并回填行号；或在证据中声明「行号以取证时点为准」 |
| 验收证据 §1 输出含 `path: '/api/calls/:call_id',` 一行 | 所印 grep 命令的替换式**不能**产出该行（无裸 `:call_id` 分支） | 校正命令与输出的一致性（把该分支加入替换式或删去该行） |
| 验收证据 §6 `grep -n 'pickup\.add'` 记录两行（含 `2173: if (call.requester !== null) {`） | 该命令只打印命中行；实跑输出 `1` 与 `2224: pickup.add({` | 把命令改为 `grep -n -B1 pickup\.add` 并重跑回填 |
| 验收证据 §5 使用 `\{agent-pid\}` / `\{my-agent-pid\}` 占位符（4 行） | 当前工作区/系统已无该时点的 PID 语境；占位符写法不可直接执行 | 证据段补一行「PID 获取命令」；或改为 `ps -o pid,ppid,command -p $(pgrep -f '…agent start pb-dev')` |
| 验收证据 §11 依赖 `$RT/probe.sh` 与 `base-endpoints.txt/cur-endpoints.txt` | 这些文件不在产出物内（`$HOME/.pr005` 现已空），文件正文只提到「15 条 `###` 标签」而未列出 | 把探针脚本正文（请求清单 + 归一化 awk）随证据入库，或声明为可重建的附件 |
| PR 文件 §12 自检只扫 `<[a-z_]+>` 形态占位符，报「证据段命中 0 行」 | §5 存在 4 行 `\{…\}` 形态占位符 | 自检正则扩为 `<[a-z_]+>|\{[a-z_-]+\}`（排除 `%{http_code}` 这类 `-w` 格式） |
| 验收标准 F09「先订阅后终态 ⇒ 订阅在终态当刻结束」 | 对 **calls 面**调用成立（0.02s 关流、恰 1 帧）；对**经既有 messages 面派发的同 id 空间任务**（`/api/calls` roster 可见、同一 `/api/calls/<id>/stream` 可订阅）**不发布终态帧也不关流**（源码：`publishCallResult` 在 `!call` 时提前 return；base 同款，故非回归） | 明确 F09 的适用范围为调用面调用；若要覆盖对话任务，需下一迭代评估（会把关闭语义扩到非 calls 面登记） |
| 验收标准 A-04 / F05#5「无 `agent_state` 订阅者时不拉 `router.task_list`（零新增 UDS 流量）」 | 后台 tick 确为零（实测 idle 9s 计 0）；但 `GET /api/agents` 快照按请求现拉会各产生 1 次 `router.task_list`（= DC-29 已裁决形态） | 已在 DC-29 接受；AC 文案可补「（快照面按请求现拉除外）」以免下次误判 |
| 验收证据 §2 控制字符例 | 原样命令在 bash 下得「请求体非法 JSON」而非记录中的「principal_id 非法」 | 证据改为 `-d '{"principal_id":"bad\u0007id"}'`（JSON 转义字面量），使记录可逐字复现 |

# 下一迭代候选

- **`queued` 可被永久占位**：对某实例派发后该实例会话被替换（如冻结导致租约过期后以新 session 重注册），已 `submitted` 的任务不再被投递，`queued` 长期停在 >0（实测 2 条任务在 Router 任务表内滞留 `submitted` 逾 20 分钟，仅能靠 `cancel` 收口）——建议评估「submitted 任务在实例换 session 后的重投/TTL」。
- **名册提示的写侧失败未做行为取证**：本轮只验证了缺失/损坏读取容错与写侧 try/catch（源码），可用只读目录（`chmod 500 .runtime`）构造写失败实测。
- **四推送面「事件名序列」全量 diff 缺确定性负载**：本轮以 shell-only 负载覆盖三面（IDENTICAL），calls 面因 LLM 负载帧数波动（134~427）无法逐字 diff；建议下一迭代把「确定性事件序列」做成可重放的固定脚本。
- **F09 关流语义跨生产者不一致**（见偏差表）：同一 `/api/calls/<id>/stream` 端点对 calls 面调用与 messages 面任务行为不同，值得一次口径统一评估。
- **证据自检口径**：`<…>` 与 `\{…\}` 两类占位符 + 「行号时效」应并入阶段 5 的证据格式模板（本轮 5 类缺陷全部可由模板机械拦截）。

# 结论

**PASS**（fail 条目：**0**）

注：唯一 **partial** 出现在**标准 3「证据可复核性」**（5 类可定位缺陷：§1/§6 行号陈旧且含命令产不出的行、§5 占位符、§11 关键脚本缺失、§2 控制字符例不可逐字复现、§12 自检口径不全）。按 verdict 契约「FAIL（有 fail 条目）/ 部分需返工时记 partial」，本 PR 的**产品面**（标准 1/2/4，含 70 条 AC）无 fail、无 partial；缺陷集中在**证据书写**，且其结论我已独立复现（标准 4 的 28 块探针 + 确定性会话 diff）。偏差记录 12 条，全部不阻塞交付。
