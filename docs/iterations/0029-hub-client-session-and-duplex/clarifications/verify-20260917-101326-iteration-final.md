# 独立验证报告 · 0029-hub-client-session-and-duplex · 阶段 6 迭代级最终验证

**验证者身份**（反射结果）：**迭代级发布审查者（release reviewer）× 调度机制取证审计者（process auditor）** 的双重身份。
反射理由：本次委托同时要求判定四类性质不同的对象——① 20 张功能卡在**迭代分支最终代码**上是否成立（产品面，反射为"能对着可运行系统判定 AC 的测试工程师"）；② `architecture.md` §6 的"零影响声明"是否在最终分支上成立（架构评审者：逐条追"既有语义是否被改动"）；③ `demand/prd/prs/status/history` 的跨文档一致性（产物审查者：只核对文档之间与 git 事实之间是否互相自洽）；④ 并发调度是否**真的发生过**而非串行误报（流程取证审计者：只看可机器复核的痕迹——提交时间窗、worktree 落点、配置字段的演化）。单一身份无法覆盖这四类，故取双重身份。

**产出物**：
- 文档：`docs/iterations/0029-hub-client-session-and-duplex/` 下的 `demand.md`（D-1~D-19）/ `prd.md` + `prd/**`（20 卡）/ `architecture.md` / `prs/**`（8 PR + 8 tasks）/ `status.md` / `history.md` / `deferred-demand-changes.md` / `clarifications/**`
- 代码：`git -C <迭代工作区> diff --stat main..HEAD -- oamp` ⇒ **12 files changed, 1365 insertions(+), 48 deletions(-)**（实测输出见标准 3）
- 迭代分支 HEAD：`860fa2a`（迭代工作区 = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex`）

**验证标准来源**：主 agent 委托简报（`/tmp/subagent-verify-stage6.md`）的 4 条标准 + 其引用的 `workflow-pb` §验证目标"并发调度真实执行证据"三项。

**验证日期**：2026-09-17

**独立性声明**：
- 未接收任何执行过程上下文；简报中未给出实现方法、设计意图或产出者自述，我也没有向主 agent 索取。
- `history.md` / `status.md` / `deferred-demand-changes.md` 与 8 份 PR 内验收证据，在本报告里**只作为"被验证产物"**参与一致性交叉核对（标准 3、标准 4）；**产品面判定（标准 1、标准 2）一律不采信它们**——每一项目判定都由我在自己的隔离集群上实跑或对最终分支代码逐行取证得出。
- 本报告未出现"因为设计意图是…""背景是…"式的判定依据。

**环境与边界**（实测）：
- 真集群取证**只用我自建的隔离集群**：`OAMP_SOCKET=/tmp/v29/r.sock`（短路径，理由 DC-36）、`OAMP_DB=/tmp/v29/db.sqlite`、web `--port 17788`；进程名 `v29router` / `v29web` / `v29dev`（`hub op:start` 管理，会话目录 = 迭代工作区）；**未触碰主集群**（`/Users/chenchiyuan/projects/agents` 的 tmux `oamp-cluster` 与其 router/agent 进程全程未被我操作）。
- 未调用 `hub api calls create`（遵简报"不走 hub"）；未推送、未合并、未切分支。
- 被验证产物**未被修改**：验证结束时 `git status --short` 只有主 agent 自己的 3 个 docs 改动（`deferred-demand-changes.md` / `history.md` / `status.md`），与本验证无关。
- 我这次运行的唯一写入 = 本报告文件；另有一次**运行态副作用**：隔离 web 进程在 `oamp/.runtime/roster.json` 写文件（该目录在我开工前**不存在**，`oamp/.gitignore` 第 1 行 `.runtime/` 已忽略它），验证结束后我已 `rm -rf oamp/.runtime` 还原。事件与处置见偏差记录 DEV-6。
- 未新增任何测试文件。

---

## 置顶：`deferred-demand-changes.md` 全文原文摘录（不转述、不总结）

> 摘录对象 = 迭代工作区工作树当前版本（与 HEAD 有未提交增量：`git diff --stat` 显示该文件 +9 行；本报告按**磁盘现状**原文摘录）。文件度量（实测）：`384` 行 / `51162` 字节 / md5 `e5f32960a2e96c4e4039325466bc902d`；编号条目 `grep -c '^\*\*编号\*\*'` = **40**（DC-01~DC-39 + DC-08a）。

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
---

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

---

## 2026-09-17 · 阶段 5

**编号**：DC-39
**问题**：**跨 PR 契约缺口：新端点的 query 参数在层 A 面无法送达**——`POST /api/pickup/:call_id/ack` 的 `principal` / `epoch` 在登记里是 `in:'query'`，而既有 `runApi`（`oamp/sdk/surface.js:78-88`）**只在 `spec.method==='GET'` 时才把 query 随请求发出**（非 GET 的 flags 一律进 body）⇒ 层 A 的 `api pickup ack` 条目请求被服务端以 `400 INVALID_PARAM` 拒绝（同端点用 `curl` 可达 200）。该缺口由 `pr-007` 的实施方在真集群逐条取证时发现，并按 dev 红线"报告不擅自实现"上报（`prs/pr-007-…-tasks.md` §5 F-1 + PR 文件证据 §4.1 两条对照输出）。
**为什么判定为需求层面问题 / 为什么记录于此**：属**跨 PR 契约缺陷**（pr-005 的端点把参数登记为 query，而更早既有的 CLI 请求构造只处理 GET 的 query）——两处各自成立，组合起来使**本迭代新交付的能力在 hub 面不可用**。记录理由：它与本迭代 D-13（"像使用 subagent 一样使用 hub"）正面冲突：不修则层 A 广告一条恒 400 的路径，并逼接入方裸写 HTTP（触碰 `skill/hub.md` 红线 1）。
**本迭代如何处理**：**主 agent 裁定采纳最小修复**（在 `pr-007` 文件范围内）：`runApi` 的 query 发送条件去掉 `spec.method === 'GET'`（**1 行**）。等价性依据：既有 40 条层 A 条目中**非 GET 且登记含 `in:'query'` 字段的条目数 = 0** ⇒ 去掉条件后它们的 query 仍为空、行为逐字不变（要求实施方以命令机械证明并在改动前后对若干既有条目实跑对照）。**与 AC1 括注的偏差**（AC1 原括注要求 `surface.js` 的 diff"只含新增行 + 注释计数行"，本次多 1 处**修改行**）**如实登记于证据段与本条**，不改 PR 文件里的验收标准文字。

---

## 逐项判定

### 标准 1 · 验收面覆盖（抽查功能卡在迭代分支最终代码/文档上是否可判定成立）

**判定：pass**

方法：在隔离集群上以 HTTP/SSE 实跑（真派发、真终态、真取消），文档面用 `/api/docs`、`oamp/API.md`、`oamp/llms.txt`、`oamp/skill/hub.md` 与 `oamp/sdk/surface.js` 的执行结果交叉核对。隔离集群实测拓扑：router（`/tmp/v29/r.sock`）+ web（`127.0.0.1:17788`）+ 1 个真 agent 进程（`pb-dev`）+ 3 个真调用（`task-583f5c78…` / `task-1a032835…` / `task-105dbf3e…` 等）。

- **F01（身份）**：pass
  证据（实跑，两次注册相隔 1s）：
  ```
  $ curl -s -X POST localhost:17788/api/principals -H 'content-type: application/json' -d '{"principal_id":"v29p","kind":"cli","instance_id":"pb-nobody"}'
  {"principal":{"principal_id":"v29p","kind":"cli","instance_id":"pb-nobody","created_at":1789611328908,"last_seen_at":1789611328908},"epoch":"3f5967f8-3e57-40ff-8ff2-64124f958334.c718c0cf-441c-4499-812d-f5abc72add14"}
  $ sleep 1; curl -s -X POST localhost:17788/api/principals -H 'content-type: application/json' -d '{"principal_id":"v29p","kind":"cli","instance_id":"pb-nobody"}'
  {"principal":{"principal_id":"v29p","kind":"cli","instance_id":"pb-nobody","created_at":1789611328908,"last_seen_at":1789611329946},"epoch":"3f5967f8-…"}
  $ curl -s localhost:17788/api/principals/v29p
  {"principal":{"principal_id":"v29p","kind":"cli","instance_id":"pb-nobody","created_at":1789611328908,"last_seen_at":1789611329985},"epoch":"3f5967f8-…"}
  $ curl -s -w ' [http %{http_code}]\n' localhost:17788/api/principals/nope-xyz
  {"error":"principal 不存在: nope-xyz","code":"NOT_FOUND"} [http 404]
  $ curl -s -w ' [http %{http_code}]\n' -X POST localhost:17788/api/principals -H 'content-type: application/json' -d '{"principal_id":""}'
  {"error":"principal_id 非法（需为非空、<=64 字符的可打印 ASCII）","code":"INVALID_PARAM"} [http 400]
  ```
  - 验收 1（幂等 upsert）：两次 `created_at` 完全相同 `1789611328908`，第二次只前移 `last_seen_at` ⇒ 第二次没有生成第二个身份 ✓
  - 验收 2（无租约）：`grep -nE "setTimeout|setInterval|clearInterval|expire|evict" oamp/src/principals.js` ⇒ **无输出（exit=1）**；且实测"注册后 45 秒零请求"后仍可查、`created_at` 不变：
    ```
    {"principal_id":"v29lease","kind":"cli","instance_id":null,"created_at":1789611828612,"last_seen_at":1789611828612}
    [silence starts 10:23:48]  … [query at 10:24:33]
    {"principal":{"principal_id":"v29lease",…,"created_at":1789611828612,"last_seen_at":1789611873643},…} [http 200]
    ```
  - 验收 3（可查询且含最近一次交互时刻）：`last_seen_at` 在同一身份每次被受理的请求上前进（`…328908 → …329946 → …329985 → …873643`）✓
  - 验收 4（重启后身份不变）：web 进程重启后，同一 `principal_id` 再注册 ⇒ 200、同一 principal、无冲突、无第二个身份（实测：重 POST 返回 `created_at:1789611665396` 一致）✓
  - 验收 5（显式声明不猜测）：`grep -n "principals.requesterOf\|principals.upsert" oamp/src/web.js` 的全部调用点均以请求方显式给出的 `principal_id` 为输入；无任何"从环境/会话推断身份"的代码 ✓
  - 验收 6（不改既有路径）：见标准 2 与 G01。

- **F04（订阅第二形态）**：**出本迭代（D-16）**，按简报不构成缺陷、不判定。实测旁证：`GET /api/docs` 投影 29 条中无 UDS 订阅面，`prd/F04-second-subscription-form.md` 仍在库（未实现、未删卡），与 D-16 一致。

- **F07（取件）**：pass
  证据（同一隔离集群内的三次真调用）：
  ```
  $ curl -s "localhost:17788/api/pickup?principal=v29p" | jq -c '{n:(.pickup|length),ids:[.pickup[].call_id],acked:[.pickup[].acked]}'
  {"n":2,"ids":["task-583f5c78-e6ca-4520-b8f8-df7ff626d937","task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce"],"acked":[false,false]}
  $ curl -s "localhost:17788/api/pickup?principal=v29p" | jq -c --arg c "$C2" '.pickup[]|select(.call_id==$c)|.envelope'
  {"call_id":"task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}
  $ curl -s "localhost:17788/api/calls/$C2"
  {"call_id":"task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}
  $ A=$(…| jq -c '[.pickup[].call_id]'); sleep 1; B=$(…| jq -c '[.pickup[].call_id]'); echo "$A"; echo "$B"
  ["task-583f5c78-e6ca-4520-b8f8-df7ff626d937","task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce"]
  ["task-583f5c78-e6ca-4520-b8f8-df7ff626d937","task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce"]
  $ curl -s -w ' [http %{http_code}]\n' -X POST "localhost:17788/api/pickup/$C1/ack?principal=v29p"
  {"call_id":"task-583f5c78-e6ca-4520-b8f8-df7ff626d937","acked":true} [http 200]
  $ curl -s "localhost:17788/api/pickup?principal=v29p" | jq -c '[.pickup[].call_id]'
  ["task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce"]
  $ curl -s -w ' [http %{http_code}]\n' -X POST "localhost:17788/api/pickup/$C1/ack?principal=v29p"   # 重复确认
  {"call_id":"task-583f5c78-e6ca-4520-b8f8-df7ff626d937","acked":true} [http 200]
  $ curl -s -w ' [http %{http_code}]\n' "localhost:17788/api/pickup?principal=v29p&epoch=bogus.0"
  {"error":"会话代次已过期: bogus.0","code":"STALE_EPOCH"} [http 409]
  ```
  - 验收 1（离线也能拿到）：两次调用的派发方在我这边**从未建立任何订阅**，终态后仍可取到 ✓
  - 验收 2（未取件不消失）：间隔 1s 的两次查询集合完全一致 ✓
  - 验收 3（取件后可确认且不重复）：ack 后不再出现在未取件集合；重复 ack 仍 200 且无副作用 ✓
  - 验收 4（只承载终态结果）：派发后处于 `working` 的第三个调用（`task-105dbf3e…`）**不在**取件集合（上面 `n:2` 而非 3）✓
  - 验收 5（与权威源一致）：取件 `envelope` 与 `calls get` 输出**逐字相同**（上面两条 JSON 完全一致）✓
  - 验收 6（内存实现、重启即丢，明文）：`oamp/API.md` §3.12 实测条文 `保留期 = 调用登记的寿命（进程内、**重启即丢**）`；且 web 进程重启后取件集合实测为空、`envelope` 在登记不在时返回 `null`（不伪造正文）✓

- **F09（终态关流 = 客户端 1 行 + 服务端补线）**：pass
  证据 A（服务端补线 + 终态当刻关流，一次实跑同时覆盖验收 1/2/3/4）：
  ```
  $ RESP=$(curl -s -X POST localhost:17788/api/calls -d '{"chat_id":"chat-e0b9ebbd-…","agent":"dev","requester":"v29p","tasks":[{"task":"v29 call#2"}]}'); CALL=$(echo "$RESP"|jq -r '.calls[0].call_id')
  CALL2=task-1a032835-2e93-4885-a9a2-a3f6ebe5f6ce
  $ ( curl -sN --max-time 25 -w '\n[call-stream: exitcode=%{exitcode} time_total=%{time_total}]\n' "localhost:17788/api/calls/$CALL/stream" & \
      curl -sN --max-time 22 -w '\n[chat-calls-stream: exitcode=%{exitcode} time_total=%{time_total}]\n' "localhost:17788/api/calls/stream?chat_id=$CHAT" & \
      sleep 3; date '+[cancel at %T]'; curl -s -X POST "localhost:17788/api/calls/$CALL/cancel"; sleep 1; curl -s -X POST "localhost:17788/api/calls/$CALL/cancel"; wait )
  retry: 1000
  [cancel at 10:17:03]
  event: call_result
  data: {"chat_id":"chat-e0b9ebbd-a1a5-432f-9fe1-5cef8b2ef361","call_id":"task-1a032835-…","agent":"dev","state":"failed","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":"cancelled","exit_code":null}
  [call-stream: exitcode=0 time_total=3.062462]
  {"call_id":"task-1a032835-…","cancelled":true,"state":"failed","error":"cancelled"}
  {"call_id":"task-1a032835-…","cancelled":false,"state":"failed","error":"cancelled"}
  [chat-calls-stream: exitcode=28 time_total=22.005704]
  ```
  - 验收 1（终态当刻退出）：调用订阅在 `time_total=3.06s` 结束，与取消/终态时点同刻 ✓
  - 验收 2（可量化判据，反证非超时驱动）：该连接的自设 `--max-time` 是 **25s**，实际退出 **3.06s**；同一轮里对话作用域订阅跑满它自己的 **22.0s**（exitcode 28 = 超时）⇒ 退出由终态驱动、不由超时值决定 ✓
  - 验收 3（关流范围只到该调用自身）：`chat-calls:<chatId>` 面在终态后**未被关闭**（22.0s 才由 max-time 结束），且期间正常收到该调用的终态帧 ✓
  - 验收 4（不吞最后一帧）：输出顺序为先 `event: call_result`（完整信封）后连接关闭 ✓
  - 验收 5（既有断开清理不变）：`git diff main..HEAD -- oamp/src/transport.js` 的删除行**仅 1 行**（心跳条件 `subscribers.size > 0` → `subscribers.size > 0 || filteredSubscribers.size > 0`，零过滤订阅者时逐字等价），既有 `close`/订阅者清理路径零改动 ✓
  证据 B（客户端 1 行）：
  ```
  $ git diff main..HEAD -- oamp/web/calls.js
  +    unsubscribe();
  $ sed -n '164,172p' oamp/web/calls.js
    if (type === 'call_result') { setCallState(data.state); appendLog(…); if (…) appendLog(`错误：${data.error}`); unsubscribe(); }
  $ git diff --name-only main..HEAD -- oamp/web
  oamp/web/calls.js
  ```
  ⇒ 客户端侧改动恰 1 行、落在 `call_result` 分支末尾，且改前改后语义（§6.2 S-9 声明的必然适配）一致 ✓
  证据 C（晚订阅补发 + 关流，F10 面同一次实跑）：对一个**已经终态**的调用发起订阅 ⇒ 收到**恰一帧**终态帧后立即关闭：
  ```
  [call-stream: exitcode=0 time_total=0.479215]   （自设 --max-time 25s）
  ```

- **F13（取消）**：pass
  证据（同上一次实跑 + 追加实跑）：
  ```
  [cancel #1] {"call_id":"task-1a032835-…","cancelled":true,"state":"failed","error":"cancelled"}
  [cancel #2] {"call_id":"task-1a032835-…","cancelled":false,"state":"failed","error":"cancelled"}
  $ curl -s -w ' [http %{http_code}]\n' -X POST localhost:17788/api/calls/task-does-not-exist-xyz/cancel
  {"error":"call 不存在: task-does-not-exist-xyz","code":"NOT_FOUND"} [http 404]
  ```
  - 验收 1（取消可生效）：`cancelled:true` + 既有终态 `failed` + `error:"cancelled"` ✓
  - 验收 2（不新增终态）：`state` 取值为既有词表；`oamp/src/router.js` 的 `task_list` 白名单实测仍为 `['submitted','working','completed','failed']`；`git diff` 未引入第五个取值 ✓
  - 验收 3（当刻可判定）：cancel 响应当刻即给出终态；紧接着的 `calls get` / roster 也是同一终态（`calls get` 实测输出见 F07 证据段）✓
  - 验收 4（幂等）：重复取消 200、`cancelled:false`、原 `state`/`error` 不变、无第二个终态 ✓
  - 验收 5（不覆盖已定终态）：对已终态调用（`task-583f5c78…`，`error=context_crashed`）取消 ⇒ 返回 `cancelled:false` 且 `state/error` 原样 ✓
  - 验收 6（不存在有明确结论）：404 `NOT_FOUND`，非静默成功 ✓
  - 验收 7（与关流协同）：取消当刻调用订阅结束（`time_total=3.06s`，同一秒）✓
  - 验收 8（客户端断开不影响控制面）：上述派发/取消全部由**彼此独立、用后即断**的 curl 客户端发起，全程无持久客户端在场仍照常生效 ✓

- **F16（重连可观测）**：pass
  证据 A（三态可区分，验收 1）：真 agent 进程被停掉后，其条目在租约未过期窗口内呈现为"在线但无连接"（`state:"online"` + `connected:false`），与真正离线的墓碑（`state:"offline"`）可区分：
  ```
  $ curl -s localhost:17788/api/agents | jq -c '.agents[]|{instance_id,state,connected,role}'
  {"instance_id":"pb-dev","state":"online","connected":true,"role":"dev"}
  {"instance_id":"pb-v29worker","state":"offline","connected":false,"role":null}
  {"instance_id":"web","state":"online","connected":true,"role":null}
  $ curl -s localhost:17788/api/health
  {"router":{"ok":true,…},"web":{"ok":true,…},"agents":{"online":1,"reconnecting":1,"offline":0,"total":2},"callable":true,"epoch":"…"}
  ```
  证据 B（软重启的可见过程，验收 2 —— 真做了 router+web 重启、agent 进程保留）：
  ```
  $ for i in $(seq 1 70); do R=$(curl -s --max-time 1 localhost:17788/api/agents | jq -rc '[.agents[]|select(.instance_id=="pb-dev")|{state,connected}]'); printf '%s %s\n' "$(date +%S.%N|cut -c1-7)" "$R"; sleep 0.2; done | uniq -f1 -c
  [poll 10:20:34]
       32 34.9800 [{"state":"online","connected":false}]
       38 42.3153 [{"state":"online","connected":true}]
  ```
  ⇒ 重启窗口内先呈现**重连中**（32 个采样点），随后**回到在线**（38 个采样点），不是"直接消失"也不是"直接在线" ✓
  证据 C（自动重连回来，验收 3）：agent 日志实测（无人工重启 agent 进程）：
  ```
  agent CONNECTION_LOST instance=pb-dev
  agent RECONNECT_WAIT instance=pb-dev attempt=1 delay_ms=500 error=CONNECTION_LOST
  agent RECONNECT_WAIT instance=pb-dev attempt=2 delay_ms=1000 error=CONNECT_FAILED
  agent RECONNECT_WAIT instance=pb-dev attempt=3 delay_ms=2000 error=CONNECT_FAILED
  agent REGISTERED instance=pb-dev session=23967d3d-… lease_timeout_ms=30000
  ```
  证据 D（重新纳管 = 恢复可调用，验收 4）：重连完成后我在同一集群继续派发真调用并成功受理（`state:working`，随后被取消收口），另有一次 shell 消息面调用跑完（见 G01 证据段 `g01-face1`）✓
  证据 E（不谎报在跑，验收 5）：router 重启后实例投影不残留重启前的在跑状态，且调用面登记为空：
  ```
  $ curl -s localhost:17788/api/agents | jq -c '.agents[]|select(.instance_id=="pb-dev")'
  {"instance_id":"pb-dev",…,"connected":true,"role":"dev","busy":false,"current_call_id":null,"queued":0,"since":null}
  $ curl -s localhost:17788/api/calls
  {"calls":[]}
  ```
  证据 F（既有语义不回归，验收 6）：`state` 词表仍为 `online`/`offline` 二值（三态由**独立字段** `connected` 承载）；`?state=` 过滤行为不变（判据仍是 `state==='online'`）：
  ```
  $ curl -s 'localhost:17788/api/agents?state=online' | jq -c '[.agents[].instance_id]'
  ["pb-dev","pb-v29worker"]          # 两个 state==='online' 的实例都在（含"重连中"的那个）——与改前判据一致
  $ curl -s -w ' [http %{http_code}]\n' 'localhost:17788/api/agents?state=offline'
  {"error":"查询参数非法: state 需为 online（当前值 \"offline\"）","code":"INVALID_PARAM"} [http 400]
  ```

- **F17（服务化可发现）**：pass
  证据（投影面 ↔ 文档面 ↔ 索引快照**三向机械比对**，实测脚本与输出）：
  ```
  docs route count: 29
  API.md §3 heading count: 29
  docs-only: []
  api-only: []
  missing metadata fields: []          # 每条路由的 summary/params/response/errors/docLink 均非空
  new routes in docs: 8
  llms.txt interface lines: 29
  llms vs docs missing: []
  docs vs llms missing: []
  ```
  - 验收 1（元数据齐备）：`/api/docs` 投影里 29 条路由的五项语义字段**无一条缺失**（输出 `missing metadata fields: []`）✓
  - 验收 2（两处可见）：`GET /api/docs` 与仓库快照 `oamp/llms.txt` 均为 29 条且**互为双射**（两向缺集皆空）✓
  - 验收 3（逐条对应，缺一即失败）：新增 8 条（`/api/principals`、`/api/principals/:principal_id`、`/api/health`、`/api/subscribe`、`/api/pickup`、`/api/calls/wait`、`/api/calls/:call_id/cancel`、`/api/pickup/:call_id/ack`）在两处**全部命中**、无一条落空 ✓
  - 验收 4（摘要以调用方视角写）：新增条目摘要均为能力视角（如 `恢复判据（router / web / agents 三问 + callable + epoch）`、`查询身份未取件的终态调用`）✓
  - 验收 5（既有条目不漂移）：`git diff main..HEAD -- oamp/src/web.js | grep -E "^[-+] *(summary|docLink|kind|path):"` ⇒ 只有**新增**行；既有路由的 `response` 仅两条被**追加**说明文字（`agents` 行、`calls` roster 行），原文逐字保留 ✓
  - 附：`API.md` 唯一被删除的一行是 `-## 3. 接口清单（21 条）`（替换为 29 条），即纯追加 ✓

- **F19（使用面文档暴露等待原语）**：pass
  证据：
  ```
  $ grep -n "mode block\|task watch\|轮询" oamp/skill/hub.md
  95:- `cli task watch`
  108:2. 等待：**用现成的等待原语，不要自己拼轮询**。两条路径按其适用场景择一：
  109:   - `api calls create --mode block`：**派发与等待合成一步**…**何时用它**：派发时就确定"我要的正是这次的结果"…
  110:   - `cli task watch <task_id>`：**已派发之后的盯进度 / 补看**…**何时用它**：手上已经有 `task_id`…
  114:兜底（仅在上述现成原语都用不上时才用）：`api calls get <call_id>` 配 `sleep` 型定期查询——**轮询是兜底，不是主推路径**…
  ```
  - 验收 1（两条现成原语都在文档面 + 各自适用场景）：同时命中 `--mode block` 与 `cli task watch`，且各带"何时用它"✓
  - 验收 2（默认路径不再是轮询）：序列 1 标题改为「派发 → 等待 → 取件」，轮询降为"兜底"✓
  - 验收 3（只改表述不改能力）：两条原语在**改前就存在**——入口表执行结果证明 `api.calls create` 与 `cli.task watch` 属既有 40 条，本次只新增了 8+1 条与之无关的条目：
    ```
    $ node --input-type=module -e "import {ENTRIES} from './oamp/sdk/surface.js'; …"
    ENTRIES total: 49 {"api":29,"uds":9,"cli":11}
    api.calls create flags: [{chat-id…},{agent…},{task…},{tasks…},{context…},{output-schema…},{schema-mode…},{mode…},{model…},{wait…}]
    cli.task watch: {"id":"cli.task watch","cmd":["task","watch"],"args":[],"kind":"result"}
    ```

- **G01（既有面保持）**：pass
  证据 A（4 条既有推送面的事件类集合，实跑观测）：
  - 面 1 `/api/stream?chat_id=`（一次 `!` shell 消息全周期）：
    ```
    event: message   {"direction":"in","text":"!echo g01-face1",…}
    event: chat_state {"state":"working"}
    event: task_update {"kind":"stdout","line":"g01-face1"}
    event: message   {"direction":"out","text":"g01-face1",…}
    event: chat_state {"state":"completed"}
    ```
    事件类集合 = `message / chat_state / task_update`，与既有文档一致，**无新增事件名** ✓
  - 面 2 `/api/events`（全局）：一次派发+取消+拓扑变化的完整窗口内**只**出现 `event: agent_online`（既有事件），**未出现** `agent_state` / `call_state` / `call_result` ✓
  - 面 3 `/api/calls/stream?chat_id=`、面 4 `/api/calls/<id>/stream`：事件类集合 = `call_result`（本次窗口内的终态）+ `retry: 1000` 首帧，均为既有语义 ✓
  - 新增事件名 `agent_state` 只在**新面**出现（`/api/subscribe?kinds=agent_state` 实测两帧：`busy:true→false`、`current_call_id`/`queued`/`since` 五字段）✓
  - 静态旁证：`git diff main..HEAD -- oamp/src/web.js` 里既有发布点的帧构造**只被替换为等价写法再追加** `publishFiltered`（删除行逐条比对：`agent_online`/`agent_offline`、`call_state submitted`、`call_result` 三处均同形）✓
  证据 B（终态词表与信封键集）：
  ```
  $ grep -n "state: 'submitted'\|state === 'completed'\|state === 'failed'\|state: 'working'" oamp/src/registry.js   # 只有既有四值
  $ sed -n '418,424p' oamp/src/router.js
  if (state && !['submitted', 'working', 'completed', 'failed'].includes(state)) { … }
  $ git diff main..HEAD -- oamp/src/web.js | grep -n "composeCallEnvelope"   # 该函数体零 diff（只多出调用点）
  ```
  实测终态信封键集 = `call_id/agent/state/duration_ms/model/truncated/text/structured_output/error/exit_code`（10 键，无 `requester`/`warnings`/投影字段入信封）✓
  证据 C（错误契约）：`sendError` 零改动（diff 中只有新增调用点，无被改行）；`ERR_CODE` 仅新增 `STALE_EPOCH`：
  ```
  $ git diff main..HEAD -- oamp/src/web.js | grep -n "ERR_CODE"
  @@ -119,6 +126,7 @@ export const ERR_CODE = Object.freeze({   +  STALE_EPOCH: 'STALE_EPOCH', // 409 …
  ```
  实测响应形态仍为 `{error, code}`，码↔状态码映射一致（400 `INVALID_PARAM` / 404 `NOT_FOUND` / 409 `STALE_EPOCH`）✓
  证据 D（既有 40 条 hub 入口）：
  ```
  $ for ref in main HEAD; do git show $ref:oamp/sdk/surface.js | grep -oE "cmd: \[[^]]*\]" > /tmp/v29/cmd-$(…).txt; done
  main cmds: 22  head cmds: 30
  $ diff <(sed -n '1,40p' cmd-main.txt) <(sed -n '1,40p' cmd-head.txt)
  21a22,29
  > cmd: ['subscribe']
  > cmd: ['pickup', 'list']  > cmd: ['pickup', 'ack']  > cmd: ['calls', 'wait']
  > cmd: ['calls', 'cancel'] > cmd: ['health']         > cmd: ['principals', 'create']
  > cmd: ['principals', 'get']
  ```
  ⇒ 既有 21 条 api 条目**逐字未动、次序未动**，只在末尾追加 8 条；层 B 8→9（`uds.router.task_cancel`，`git diff` 中 router 的既有 `case` 无删除行）；层 C 11 条未动；总数 40 → 49 ✓
  证据 E（DB 表 / 控制台 / 其它既有面）：
  ```
  $ git diff --name-only main..HEAD -- oamp/src/persist.js oamp/web/app.js oamp/bin oamp/package.json
  （空）
  $ grep -n "CREATE TABLE\|CREATE INDEX" oamp/src/persist.js
  14:CREATE TABLE IF NOT EXISTS projects ( … 20:… chats … 32:… messages …
  $ git diff --name-only main..HEAD -- oamp/web
  oamp/web/calls.js         # 仅此一个，且只 +1 行（见 F09 证据 B）
  $ git diff main..HEAD -- oamp/src/web.js | grep -n "STATIC_FILES"   # 无输出：静态面白名单零改动
  ```
  控制台既有面板（顶栏 agent 列表、roster 6 列、确认 inbox）不消费新增字段（`app.js` 零改动、roster 渲染代码零改动）✓
  证据 F（不扩 harness / 不引入被否决物）：本次全部验收都在**无 harness 会话身份**的隔离环境完成（身份全靠显式声明）；`git diff --name-only main..HEAD -- oamp/src` 只有 6 个文件（`pickup/principals/registry/router/transport/web`），无鉴权、无联邦、无持久事件日志、无新表、无新依赖 ✓

### 标准 2 · `architecture.md` §6 零影响声明核对

**判定：pass**

核对方法：读 `architecture.md` §6.1 的 Z-1~Z-15 与 §6.2 的 S-1~S-11，对其中**简报点名的 6 项**逐项在最终分支上取证（§6.1/§6.2 其余项在标准 1 的 G01 证据段已覆盖）。

| 声明项 | 我的取证 | 判定 |
|---|---|---|
| 既有 4 条推送面（Z-1） | 面 1/2/3/4 实跑事件类集合与既有文档一致；新事件名 `agent_state` 只进新面；既有发布点帧构造等价替换 + 追加 `publishFiltered` | 成立 |
| 既有控制台（S-1/S-2/S-9） | `oamp/web/app.js` 零改动；`oamp/web/calls.js` 恰 +1 行（`unsubscribe()`）；§6.2 **S-9 已明文声明**该 1 行适配为 F09 行为变更的必然适配 ⇒ 属声明内，不是未声明漂移 | 成立（声明自洽） |
| 既有 40 条 hub 入口（Z-8） | 40 → 49；既有 21/8/11 逐字未动、只追加（`diff` 只有 `21a22,29` 与 uds 1 条） | 成立 |
| 终态词表（Z-3） | 四值白名单未动；取消复用 `failed` + `error='cancelled'`（实跑） | 成立 |
| 错误契约（Z-4） | `sendError` 零改动；`ERR_CODE` 仅 +`STALE_EPOCH`；实测 `{error,code}` 与 400/404/409 映射一致 | 成立 |
| DB 表（Z-10） | `oamp/src/persist.js` 零改动（文件级 diff 为空）⇒ 表/列/既有读写不变；取件面不落库（`oamp/src/pickup.js` 无任何 fs/db import） | 成立 |

补充核对（Z-5 / Z-7 / Z-15）：
```
$ curl -s -w ' [http %{http_code}]\n' 'localhost:17788/api/agents?state=offline'
{"error":"查询参数非法: state 需为 online（当前值 \"offline\"）","code":"INVALID_PARAM"} [http 400]
$ git diff main..HEAD -- oamp/src/router.js | grep -E "^[-+] *case '"
+      case 'router.task_cancel': {           # 既有 8 个方法零删除
$ git diff --name-only main..HEAD -- oamp/src/status.js oamp/src/cluster.js oamp/src/cluster-config.js oamp/src/inbox.js oamp/src/agent.js
（空）    # oamp status / 集群面 / 确认面 / agent 侧重连策略 全部零改动
$ git diff --name-only main..HEAD -- oamp/package.json
（空）    # 零第三方依赖、零新配置键
```
⇒ Z-5（`?state=online` 判据不变）、Z-7（UDS 只增方法、`router.status` 只追加 `generation`/节点 `connected`；`oamp status`/`cluster.js` 未改）、Z-9/Z-12/Z-13/Z-15 均成立。

**唯一与"逐字不变"字面有出入的两处，都已被 §6 自身声明**：① `oamp/web/calls.js` 的 1 行（S-9）；② `router.status` 与 `/api/agents` 行的**追加**字段（Z-7 / A-04：§6.2 S-6/S-7 判为"追加字段，既有键名与值域不变"）。逐条核对后无**未声明**的既有语义漂移。

### 标准 3 · 产物一致性（D 决策 ↔ prd 索引 ↔ depends_on ↔ status 合并提交 ↔ history 事件）

**判定：partial**

通过的子项（实测）：
```
$ git log --oneline main..HEAD | grep -c "merge: pr-"
8
$ git log --oneline main..HEAD | grep "merge: pr-"
860fa2a … pr-007 … / 22f6859 … pr-006 … / b090369 … pr-005 … / ecba11d … pr-008 …
4c6ddba … pr-004 … / 51eb893 … pr-001 … / f8f382a … pr-003 … / cfb6736 … pr-002 …
$ git log --oneline --merges main..HEAD | wc -l
8
$ git diff --stat main..HEAD -- oamp | tail -1
12 files changed, 1365 insertions(+), 48 deletions(-)     # 与简报给定的 12/1365/48 完全一致
```
```
demand D ids（表格行）: D-1 … D-19 全部在案（含 D-15~D-18 的 prd 反馈收窄、D-19 的执行通道变更，均标 user_confirmed）
prd card files: 20      prd.md index rows: 20      cards not in index: []      index rows not in files: []
status PR rows: 8       depends_on 与 prs/*.md 的 §depends_on 逐条一致（pr-005 → pr-001/002/003；pr-006 → pr-005；pr-007 → pr-001+pr-005+调度附加约束；其余「（无）」）
merge hash presence in status/history: cfb6736 T/T  f8f382a T/T  51eb893 T/T  4c6ddba T/T  ecba11d T/T  b090369 T/T  22f6859 T/T  860fa2a T/T
history 事件头: 118（派发 36 / 收到报告 37 / 调度决策 45）
```
⇒ 8 个 PR 的"已合并"**都有对应 merge commit**（特别核通过）、`depends_on` 四处一致、D 决策齐备、history 事件记录与 git 事实无冲突。

不通过的子项（**partial 的具体来源**，可定位）：
1. **`status.md:43` 的 pr-007 行与合并事实矛盾**：
   ```
   status.md:43 | pr-007-hub-entries-and-skill-lists.md | … | ⬜ | feat/0029-pr-007-hub-entries-and-skill-lists | ⬜ | 排队(依赖未满足) |
   status.md:22 | 5 | PR 实现 | ✅ | ⬜ | **8/8 PR 全部合并**（pr-001~008）… |
   status.md:116 - 2026-09-17: **pr-007 验收 PASS ⇒ 合并 `860fa2a`**（8/8 全部合并…）
   ```
   同一文件内三处互相矛盾；磁盘实况 = `860fa2a` 已在迭代分支、`pr-007` 分支与 worktree 已清理（`git worktree list` 无 `feat/0029-pr-007-…`）⇒ 该行是**陈旧未同步**，不是事实错误。另：该行处于**未提交**改动状态（`git status --short` 显示 `status.md` 已修改，`git diff` 显示本轮改了 pr-006 行却漏改 pr-007 行）。
2. **`status.md:70` 派发台账末行陈旧**：`| 19:43 | dev | 阶段 5 · pr-004 实现 | task-7553a07d | 在途 | …`——pr-004 已于 20:09:39 合并（`4c6ddba`）且 worktree 已清理，台账仍记"在途"。
3. **`status.md:31` 的 `已派发总数：7` 口径不明/与台账不符**：台账中 stage-5 派发远超 7 条（`grep -c` 台账行含 `prd/architect/pr-planner/verifier/planner×N/dev×N`）；该字段既未说明统计范围（是否只算 PR 实现派发）又与后续"planner+dev 合一"计数混用 ⇒ 无法作为可核对的计数。

（说明：这三条都在 `status.md` 的**过程记录面**，不影响产品面与代码面判定；按简报标准 3 "可交叉核对"的字面要求，第 1 条已构成**同一产物内的自相矛盾**，故本项判 partial 而非 pass。）

### 标准 4 · 并发调度真实执行证据（workflow-pb §验证目标 强制三项）

**判定：pass**（三项均有机器可复核证据；另按简报要求如实说明 D-19 的执行通道切换事实）

**① worktree 时间窗口重叠 —— pass**

证据 A（PR worktree 的**物理落点**与残留）：
```
$ ls -la <迭代工作区>/.pb-agents/worktrees/
0029-pr-005-web-session-and-call-surface/          # mtime Sep 16 23:31（7 个同类目录已被 git worktree remove 清掉，这是残留）
$ find <迭代工作区>/.pb-agents/worktrees/0029-pr-005-web-session-and-call-surface
…/0029-pr-005-web-session-and-call-surface/oamp/.runtime/roster.json
$ prs/pr-001-router-status-primitives.md（PR 文件内联命令的路径）
git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-001-router-status-primitives …
```
⇒ 每个 PR 各有一个**真实存在于磁盘**的 worktree 目录（嵌套在迭代工作区下、分支 `feat/0029-pr-00N-…` 检出），不是"同一目录反复换分支"。

证据 B（分支活跃时间窗，纯 git 数据，与文档无关）：
```
$ for m in cfb6736 f8f382a 51eb893 4c6ddba ecba11d b090369 22f6859 860fa2a; do S=$(git rev-parse $m^2); M=$(git rev-parse $m^1); echo "$m … first=$(git log --format=%cI --reverse $S --not $M|head -1) last=$(git log -1 --format=%cI $S) commits=$(git rev-list --count $S --not $M)"; done
cfb6736(pr-002) commits=5  first=2026-09-16T15:39:33  last=2026-09-16T19:37:54
f8f382a(pr-003) commits=5  first=2026-09-16T15:44:42  last=2026-09-16T19:46:02
51eb893(pr-001) commits=5  first=2026-09-16T15:36:49  last=2026-09-16T19:53:57
4c6ddba(pr-004) commits=3  first=2026-09-16T19:42:38  last=2026-09-16T20:09:39
ecba11d(pr-008) commits=3  first=2026-09-16T19:45:58  last=2026-09-16T20:58:41
b090369(pr-005) commits=26 first=2026-09-16T20:04:55  last=2026-09-16T23:30:49
22f6859(pr-006) commits=10 first=2026-09-16T23:36:37  last=2026-09-16T23:57:54
860fa2a(pr-007) commits=12 first=2026-09-17T00:03:30  last=2026-09-17T00:29:57
```
⇒ 至少三组**时间窗真实重叠**：① pr-001/002/003 共同覆盖 15:44:42–19:37:54（≈3h53m）；② pr-004（19:42:38–20:09:39）与 pr-008（19:45:58–20:58:41）重叠 ≈23.7min；③ pr-005（20:04:55–23:30:49）与 pr-008 重叠 ≈53.8min。
证据 C（提交在**跨分支间交错**，串行不可能产生）：
```
$ git log --format='%h|%cI|%s' main..HEAD | sort -t'|' -k2 | grep -E "pr-00[123]"
fe67383|2026-09-16T16:19:24|fix(0029-pr-001-…)
e561618|2026-09-16T16:31:13|fix(0029-pr-002-…)
d7d396e|2026-09-16T16:38:25|fix(0029-pr-003-…)
c9bc05a|2026-09-16T19:32:15|fix(0029-pr-002-…)
a1efcc9|2026-09-16T19:40:09|fix(0029-pr-003-…)
5e2bd16|2026-09-16T19:43:56|fix(0029-pr-001-…)
```
⇒ 三条分支的提交在同一时间轴上诉求交错（19:32 pr-002 → 19:40 pr-003 → 19:43 pr-001），与证据 B 的窗口重叠一致；合并时点 19:37:54 / 19:46:03 / 19:53:57 也晚于全部三条分支的首个提交。
证据 D（派发/清理记录，与上述独立证据一致）：
```
history.md:141-143 · 15:28「据依赖图取前 N=3 个已解锁 PR（pr-001/pr-002/pr-003…）创建 PR worktree（base = 迭代分支）…三个 PR worktree 内均含完整 docs/iterations/0029-…」
history.md:159  · 15:32:19「按依赖图取前 N = 当前有效上限 = 3 个…并发派发其 planner…三个 PR worktree 已建」
history.md:488  · 19:38:05 pr-002 PASS ⇒ 合并 cfb6736 + 清理该 PR worktree 与分支 ⇒ 槛位释放 1
history.md:546/595/670 … 同型：pr-003(f8f382a) 释放 2 / pr-001(51eb893) 释放 3 / pr-004(4c6ddba) 释放 4
```
⇒ **并发确实发生**（证据 B/C/D 三源互证），不是串行误报。

**② 并发配置区块真实初始化与更新 —— pass**

证据（`status.md` §并发布块的四个历史版本，取自 git，而非现值）：
```
$ for c in 72b659f 22e17aa f3784f6 87d3bb7; do echo "=== $c $(git log -1 --format=%cI $c) ==="; git show $c:…/status.md | grep -A 8 "^## 并发配置"; done
=== 72b659f 2026-09-16T15:28:23（阶段 4→5 入口）===     起始并发数 3 / 硬上限 5 / 累计槛位释放次数 0 / 当前有效上限 3 / 已派发总数 0
=== 22e17aa 2026-09-16T19:43:24（pr-002 合并后）===       起始 3 / 硬上限 5 / 释放 1（pr-002 合并）/ 当前有效上限 5（min(3 + 1×3, 5)，已达硬上限）/ 已派发 5
=== f3784f6 2026-09-16T20:59:47（4 个 PR 合并后）===     起始 3 / 硬上限 5 / 释放 4（pr-002、pr-003、pr-001、pr-004 合并）/ 有效上限 5（min(3 + 4×3, 5)）/ 已派发 6
=== 87d3bb7 2026-09-16T23:56:43（6 个 PR 合并后）===     起始 3 / 硬上限 5 / 释放 6（…、pr-008、pr-005 合并）/ 有效上限 5（min(3 + 5×3, 5)）/ 已派发 7
（磁盘现值，未提交）: 释放 8（全部 8 个 PR 已合并）/ 当前有效上限 5（min(3 + 5×3, 5)）/ 已派发总数 7
```
⇒ 五个字段在**阶段 4→5 入口即被初始化**（`72b659f`，15:28:23，与 history.md:122「已初始化 `## 并发配置（阶段 5）`（起始 3 / 硬上限 5 / 已派发 0）」一致），并在其后**至少三次被真实更新**（释放 0→1→4→6→8，有效上限 3→5，派发数 0→5→6→7）⇒ 非"初始化后不变" ✓

**③ 爬升公式真实重算 —— pass（含一处口径偏差，见偏差记录 DEV-3）**

证据（history.md 逐次释放记录 + status.md 现值）：
```
history.md:488  释放 1 ⇒ 当前有效上限 = min(3 + 1×3, 5) = 5，已达硬上限
history.md:546  释放 2 ⇒ min(3 + 2×3, 5) = 5（维持硬上限）
history.md:595  释放 3 ⇒ min(3 + 3×3, 5) = 5（维持硬上限）
history.md:670  释放 4 ⇒ min(3 + 4×3, 5) = 5（维持硬上限）
history.md:763/796/842  释放 6 / 7 / 8（记录释放与累计进度；值维持硬上限 5）
status.md:30    当前有效上限：5（min(3 + 5×3, 5)，维持硬上限）    ← 括注里的 R 陈旧（现值 R=8），结果值不受影响
```
我的独立重算（按简报公式）：`min(起始 3 + 累计槛位释放次数 R × 起始 3, 硬上限 5)`：
- R=0 ⇒ min(3,5) = **3**（与 72b659f 现值一致）
- R=1 ⇒ min(6,5) = **5**（与 22e17aa 现值一致；**这就是可观测的爬升：3 → 5**）
- R≥2 ⇒ 恒为 **5**（与后续各版本一致）
⇒ 公式**被真实重算**且结果值与公式一致；因硬上限=5 在 R=1 时即被封顶，R≥2 的"爬升"不再产生可观测的额度变化（在途 PR 实测峰值 3：19:54 时在途 = pr-004/pr-008/pr-005）。这一"封顶后无变化"如实记录，**不算未通过**（该项判定依据是"是否按公式被正确重算"，证据齐备）。

**关于 D-19 的如实说明（简报要求，不据此判 fail）**：
`demand.md` 表内 **D-19**（`user_confirmed`，2026-09-16）实测原文为：*"因 hub 调用每次 30 分钟轮次上限造成多次空耗与零交付（DC-01/08/13/22/26），自 2026-09-16 22:30 起，阶段 5 余下实现与阶段 6 验证改用本地 subagent 直接执行（角色定义仍按 roles/*/*.md 注入，产物与验收标准不变）；hub 派发仅用于已完成部分"*。
由此产生的事实：
- `history.md:766` / `:799` 明确记录 pr-006 与 pr-007 的派发通道 = **本地 `task` subagent**（非 `hub api calls create`）；
- 时间线吻合：`status.md` §派发台账与 history 的 hub 派发记录**止于 22:30 前后**（台账最后一条 hub 记录为 19:43 的 pr-004 dev），此后 pr-006（23:36 起）、pr-007（00:03 起）无任何 hub `call_id`；
- 因此**后期 PR 无 hub 调用记录是 D-19 的预期结果**，不能作为"未并发/未真实执行"的反证；标准 4① 的判定改以 **git 证据（worktree 落点、分支时间窗、提交交错）** 为主，hub 记录仅作旁证。
- 同时如实记录：`status.md:31` 的"已派发总数：7（+ pr-006 的 planner+dev 合一，本地 subagent）"这一写法混淆了两种通道的计数口径（见标准 3 partial 第 3 条）。

---

## 汇总

- **pass：3 项**（标准 1 验收面覆盖、标准 2 零影响声明、标准 4 并发调度三项证据）
- **fail：0 项**
- **partial：1 项**（标准 3 产物一致性——8 merge commit / depends_on / D 决策 / history 四项子项 pass；`status.md` 的 PR 子状态表 pr-007 行、派发台账末行、已派发总数口径三项子项不通过）
- **blocked：0 项**
- 抽查功能卡判定：F01 pass / F04 出本期（D-16，不判）/ F07 pass / F09 pass / F13 pass / F16 pass / F17 pass / F19 pass / G01 pass

## 偏差记录

> 实现与规格/文档不一致，或本验证过程中发现的副作用。不影响本次验收判定（已裁决接受的偏差不据此判 fail）。

| # | 规格/文档描述 | 实现/现状实际 | 建议处理 |
|---|---|---|---|
| DEV-1 | `status.md:43` pr-007 行 `⬜ / ⬜ / 排队(依赖未满足)` | 该 PR 已于 2026-09-17 合并（`860fa2a`），worktree 与分支已清理；同文件 `:22` 与 `:116` 均记"8/8 全部合并" | 按实现更新 `status.md`（本行改为 ✅/已清理/已释放）；建议把"每 PR 合并后同刻更新子状态表"写进阶段推进核查的机械项 |
| DEV-2 | `status.md:70` 派发台账 `dev · pr-004 实现 · task-7553a07d · 在途` | pr-004 于 20:09:39 合并（`4c6ddba`），台账未回填终态/耗时 | 回填该行终态与耗时（D-13 三问）或标注"台账止于 D-19 切换点（22:30）" |
| DEV-3 | `status.md:30` 公式括注 `min(3 + 5×3, 5)` | 现值 `累计槛位释放次数 = 8`（`:29`），括注应随 R 更新；结果值 5 与公式一致（R≥1 恒封顶） | 括注改为 `min(3 + 8×3, 5)`；建议由公式自动渲染该括注 |
| DEV-4 | `status.md:31` `已派发总数：7` | 与台账行数、通道口径（hub 派发 / 本地 subagent）均不可对齐 | 明确该字段的统计范围与通道，或拆成两列（hub 派发数 / 本地 subagent 数） |
| DEV-5 | DC-38（已被主 agent 裁决接受）「API.md §3 小节号撞车」 | **实测确认存在**：`oamp/API.md` §3 现有 `### 3.11`（既有 `GET /api/docs` 与新增 `GET /api/subscribe`）、`3.12`（既有 `GET /api/projects` 与新增 `GET /api/pickup`）、`3.13`（既有 `POST /api/projects` 与新增 `POST /api/pickup/<call_id>/ack`）、`3.18`（既有 `GET /api/calls/<call_id>/transcript` 与新增 `GET /api/calls/wait`）同号并存；新增 8 节沿用 pr-005 登记的 `docLink` 号码（`#311-/#312-/#313-/#3110-/#3111-`）——`docLink` 锚点因此仍可达，但人读文档出现同号 | 已裁决接受、本迭代不改；下一迭代把新节顺序编号 3.22~3.29 并同步 `docLink` 与 `/api/docs` 投影 |
| DEV-6 | `oamp/.gitignore:1 .runtime/`（既有约定） | 我的隔离 web 进程在 `<迭代工作区>/oamp/.runtime/roster.json` 写运行态文件（该目录**在我开工前不存在**，属被忽略路径，非被验证产物） | 已由我 `rm -rf oamp/.runtime` 还原；记录以备复核（同时说明：任何在该工作区起 web 的取证都会产生同类运行态文件） |
| DEV-7 | 「worktree 清理」 | pr-005 的 PR worktree 目录未完全清除：`<迭代工作区>/.pb-agents/worktrees/0029-pr-005-web-session-and-call-surface/oamp/.runtime/roster.json` 仍在（未跟踪/被忽略） | 清理残留目录（不影响 git 状态与产物） |
| DEV-8 | 代码风格 | `oamp/src/web.js` `queryOnce` 的 `finally` 块内多了一个空行（`git diff` 可见裸 `+`） | 纯观感，可下次触碰该文件时顺手去掉 |
| DEV-9 | DC-31（已在案） | 子 agent 曾误杀主集群 `pb-dev` 进程 | 已裁决记录；建议把"隔离取证必须用短路径 socket + 不按模糊命令行匹配取 PID"写成取证硬约束（DC-36 + DC-31 合并条目） |
| DEV-10 | `demand.md` 表格外的 D 索引 | `demand.md` 的 D 决策全部以表格行承载（无 `**D-N**` 加粗形态），机械脚本须按 `\| D-N \|` 解析 | 非缺陷；仅记录解析口径，便于后续自动核对 |

## 下一迭代候选

- **API.md §3 小节号顺序重排（DC-38 根治）**：新节改 3.22~3.29 并同步 `docLink` 与 `llms.txt`/`/api/docs` 投影。
- **层 A 通道规则泛化（DC-39 根治）**：`runApi` 现按"非 GET 的 query 字段进 body"处理，导致 `POST /api/pickup/:call_id/ack` 的 `principal`/`epoch` 只能声明为位置参数；建议按登记里的 `in:` 字段决定通道，消除新端点逐个特判。
- **`queued` 投影字段（DC-35）**：fire-and-forget 下恒为 0，产品上无信息量——下一迭代评估改为真队列或移除该列（连带 F05 验收措辞）。
- **取件面/身份表的进程内存语义（D-3/D-4/D-14）**：web 重启即丢与"重启可恢复"的体感目标存在落差；若下一迭代要提升，需先判定是否允许落一条轻量持久层（与"不把 hub 记忆当恢复依据"的边界冲突需主 agent 裁决）。
- **晚订阅补发帧不带 `chat_id`（DC-30 裁决）**：消费方须自行关联对话；下一迭代可评估在补发帧里补 `chat_id`（属新增能力，需走需求）。
- **名册提示窗（L1-01）**：我实测"重连中"可见性受两重时限——只在 web 启动时读一次名册、且名册项 30s（`heartbeatTimeoutMs`）后从视图消失。若 agent 的重连退避超过该窗口（实测退避上限 10s，故未触发），用户会看到"直接消失"。下一迭代可评估把窗口与退避上限联动。
- **`sendTask` 静默吞错（DC-33）**：投递失败不报错（既有缺陷），本迭代未修；会让调用以"后台受理"形态进入无人认领的在跑态。
- **F04（UDS 订阅第二形态）**：D-16 出本期，卡仍在库；下一迭代续做时需与 F03 的 `kinds`/`agents` 过滤语义对齐。
- **状态记录面的机械同步**：本轮的 DEV-1/2/3/4 说明 `status.md` 的过程记录面容易与合并事实脱节；可考虑在阶段推进核查里加一条"子状态表 ↔ merge commit ↔ 台账"的三向自动比对。

## 结论

**PASS**（pass 3 项 / fail **0** 项 / partial 1 项〔标准 3，子项 3 条不通过〕/ blocked 0 项）

判定依据：三条标准完全满足，标准 3 的四个子项满足、三个子项不满足（`status.md` 过程记录面的陈旧行与口径），按验证契约"所有条目 pass 或 partial 且无 fail ⇒ PASS"。偏差记录 10 条不阻塞本次关闭，其中 DEV-1~DEV-4 建议在收口前顺手同步 `status.md`。


---

## 附：定向复核 · 主 agent 修复提交 `d27a145`（2026-09-17，仅核三项，未重跑整轮）

复核对象：主 agent 针对本报告标准 3 的三条 partial 明细所做的 `status.md` 修正。
修复提交实测：`git log --oneline -3` ⇒ `d27a145 fix(0029): 闭合阶段6标准3的 status.md 三处不一致（pr-007 行状态 / 台账 pr-004 终态+范围说明 / 已派发总数按通道拆分）`；`git show --stat d27a145` ⇒ `status.md | 19 +-`（另含本报告与两份过程记录的入库）；复核开始时 `git status --short` **无输出**（工作树干净）。

### ① pr-007 行与同文件"8/8 全部合并"是否仍自相矛盾 —— **pass**

```
$ grep -n "pr-007\|8/8" status.md
22:| 5 | PR 实现 | ✅ | ⬜ | **8/8 PR 全部合并**（pr-001~008）；两轮独立验收（pr-005 partial 证据文本已修缮、pr-007 partial 纯文档已修）|
44:| pr-007-hub-entries-and-skill-lists.md | pr-001、pr-005〔调度附加约束已满足：pr-006 已合并 `22f6859`〕 | ✅ | (已清理) | ✅ | 已释放 |
119:- 2026-09-17: **pr-007 验收 PASS ⇒ 合并 `860fa2a`**（8/8 全部合并；迭代分支相对 main 12 文件 / 1365 增 / 48 删）…
$ sed -n '36,45p' status.md          # 全部 8 行
| pr-001… | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-002… | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-003… | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-004… | （无） | ✅ | (已清理) | ✅ | 已释放 |
| pr-005… | pr-001、pr-002、pr-003 | ✅ | (已清理) | ✅ | 已释放 |
| pr-006… | pr-005 | ✅ | (已清理) | ✅ | 已释放 |
| pr-007… | pr-001、pr-005〔调度附加约束已满足：pr-006 已合并 `22f6859`〕 | ✅ | (已清理) | ✅ | 已释放 |
| pr-008… | （无） | ✅ | (已清理) | ✅ | 已释放 |
$ grep -n "排队\|⬜\|⏸" status.md
18/20/21/22/23: （仅命中「阶段状态」表的「已验证」列与阶段 6 行，**PR 子状态表内已无 ⬜/排队**）
```
判定：pr-007 行改为 `✅ / (已清理) / ✅ / 已释放`，与 `:22` 的"8/8 全部合并"、`:119` 的合并提交 `860fa2a`、以及 git 事实（`860fa2a` 已在迭代分支；`git worktree list` 无 `feat/0029-pr-007-…`）**三者一致**，矛盾消除 ✓。同文件 8 行 PR 子状态与 8 个 merge commit 逐条对齐。

### ② 台账末行终态与 pr-004 实际合并提交是否一致 —— **pass**

```
$ grep -n "pr-004 实现" status.md
71:| 19:43 | dev | 阶段 5 · pr-004 实现 | `task-7553a07d` | completed（⇒ 合并 `4c6ddba`） | 不需 | 推送面（自动送达） | 22.9 min | `openai/gpt-5.6-luna` |
$ grep -n '7553a07d' history.md status.md          # 独立第三方源
status.md:71: … `task-7553a07d` | completed（⇒ 合并 `4c6ddba`）…
$ grep -n -A 6 '收到报告 · dev（pr-004）' history.md
644:### 2026-09-16 20:06:14 · 收到报告 · dev（pr-004）
646:- 1. 改动文件：`oamp/web/calls.js`（…追加既有 `unsubscribe();`，**一行**）+ 本 PR 文件（证据）；提交 `45027a6`；`duration_ms=1371169`
$ git log --oneline main..HEAD | grep "pr-004"
4c6ddba merge: pr-004 控制台调用进度订阅的终态适配（F09 一行）into iteration/0029-hub-client-session-and-duplex
```
判定：`4c6ddba` 即 pr-004 的真实 merge commit ✓；终态 `completed` 与 `history.md:644` 的"收到报告"记录一致 ✓；耗时 `22.9 min` 独立复算 `1371169 ms = 22.85 min ≈ 22.9 min` ✓；时点自洽（19:43 派发 + 22.85 min ≈ 20:06 回报 → 20:06:14 派发其 verifier → 20:09:39 合并）✓。

### ③「已派发总数」口径与台账行数/双通道是否可对齐 —— **fail**

```
$ grep -n "已派发总数\|本地 subagent 通道" status.md
31:- **已派发总数（hub 通道，统计至 D-19 切换点 22:30）**：7（pr-001~pr-005 的 planner/dev/verifier 等，逐条见下表）
32:- **本地 subagent 通道（D-19 之后）**：新起 7 个 agent（`Pr005Finisher` / `Pr005Verifier` / `Pr006Builder` / `Pr006Verifier` / `Pr007Builder` / `Pr007Verifier` / `FinalVerifier`），另有若干次「唤醒续做」…
$ awk 'NR>=53 && NR<=71 && /^\|/' status.md | wc -l          # 台账表体行数
19
$ sed -n '53,71p' status.md | grep -oE '`[^`]+`' | tr -d '`' | grep -E '^(task-)?[0-9a-f]{7,8}$' | sort -u | wc -l
31      # 其中 3 个是 merge hash（4c6ddba / cfb6736 / f8f382a）
$ sed -n '53,71p' status.md | grep -oE '`[^`]+`' | tr -d '`' | grep -E '^(task-)?[0-9a-f]{8}$' | sort -u | wc -l
28      # 台账里的 hub 派发 call id 去重后 = 28（20 个 `task-*` 长式 + 8 个短式：2a34ff72/3fbe57f1/88d09f25/b7bd0a9c/8c97d4bd/7207f08a/efcf2e6b/37a215fe）
$ awk 'NR>=53 && NR<=71 && /^\| [0-9]/ {print $2}' status.md | sort | tail -1
19:43      # 台账最晚一条时点 < 22:30，即表内全部记录都属"至 D-19 切换点"
```
判定：**"7" 与台账不可对齐**。台账 19 行、28 个 hub 派发 call id，全部发生在 22:30 之前；括注"逐条见下表"亦不成立（表中不存在 7 条这一子集，也没有任何标注把 7 条圈出来）。可能的自然口径亦都不等于 7：首轮 `planner×3 + dev×3` = 6；而"pr-001~pr-005 的 planner/dev/verifier 等"这一括注本身就 ≥ 22（3 planner + 3 dev + 3 verifier 首轮 + 6 次返工 + 1 次 pr-001 重验 + 1 次 pr-001 收尾 + 1 次 pr-002 返工#2 + 1 次 pr-002 重验 + 1 次 pr-003 重验 + 1 次 pr-004 dev）。
**双通道的后半句 pass**：7 个具名本地 subagent 都能在 `history.md` 找到对应记录——`Pr005Finisher`（DC-29/30/31/37 与 history:735/741/746/775/776 多处）、`Pr005Verifier`（`history.md` 23:28:48）、`Pr006Builder`（23:50:59）、`Pr006Verifier`（23:58:04）、`Pr007Builder`（00:14:49）、`Pr007Verifier`（00:27:26）、`FinalVerifier`（00:30:08「阶段 6 迭代级独立验证（本地 subagent）」，且本报告的验证者 session 标识实为 `FinalVerifier`）✓。
**现测应为**（两种改法任选其一，都是机械可核的）：① 保留"7"但把口径写死成能对上表的定义（例如"阶段 5 首轮派发的 planner×3 + dev×3 = 6"这类，须与表内行一一对应）；② 改按台账实数：**至 22:30 的 hub 派发共 28 个 call id / 19 行**（含 `task-eba25366` 失败后重派 `task-5393eaed` 与 `efcf2e6b` 记录脱落判未落地后重派），并保留"逐条见下表"。

### 附·一处非本次修复项的观察（不影响判定）

`status.md` 的「阶段状态」表"已验证"列在第 1/3/4/5 阶段仍为 `⬜`、阶段 6 行整体为 `⬜`、而"完成"列阶段 5 为 `✅`。我原报告标准 3 的三条 partial 明细**未包含**此项（它在我复核前就是既有写法，且与"PR 子状态/合并提交"一侧无关），本轮亦不作为部分通过的依据；若该列语义是"阶段门口独立验证已通过"，建议收口时一并明确口径。

### 附·标准 3 结论（本轮复核后）

- 子项 pass：8 merge commit ↔ PR 子状态表逐条对齐（①）；台账 pr-004 终态/耗时/合并提交 ↔ history pr-004 回报记录（②）；本地 subagent 通道 7 个具名 agent ↔ history 记录。
- 子项 fail：`status.md:31` 的 hub 通道"已派发总数 = 7"仍与台账（28 个 call id / 19 行）不可对齐（③）。
- ⇒ **标准 3 维持 partial，不能升为 pass**；仅需按上面"现测应为"改掉 `:31` 一处即可闭合（改后本项即可改判 pass，其余证据已在原报告与本节留痕）。


---

## 附（第三轮）：定向复核 · 主 agent 修复提交 `1711def`（2026-09-17，只核两项）

复核对象：① `status.md` 台账上方的"已派发总数"改为实数口径；② 阶段状态表「已验证」列 + 列语义脚注。
修复提交实测：`git log --oneline -3` ⇒ `1711def fix(0029): status.md 台账口径改实数（19 行/28 call id）+ 阶段状态表已验列与列语义脚注`；`git show --stat 1711def` ⇒ `status.md | 6 ++++--`（仅 1 文件 6 增 4 删）。
**测量方法修正**：上一轮我用固定行号区间 `sed -n '53,71p'` 取样，而 `1711def` 在文件前部插入了 2 行 ⇒ 行号漂移（同一区间落到不同内容，首测得 25 个 id 属取样错位）。本轮改为**动态定位台账区块**（从 `## 派发台账` 到下一个 `## `），下表的读数即以动态定位为准。

### ① "19 行 / 28 个唯一 call id" 与台账实数一致 + "逐条见下表"成立 —— **pass**

```
（python 动态定位：## 派发台账 区块 = 第 49→78 行；表头 = | 时点 | 角色（节点） | 用途 | call_id | … |）
body rows: 19
id tokens: 29 unique: 28
long: 20 short: 8
unique ids: 2a34ff72 37a215fe 3fbe57f1 7207f08a 88d09f25 8c97d4bd b7bd0a9c efcf2e6b ＋ 20 个 `task-*` 长式（逐行列出见下）
rows (时点 | 用途 | ids)：
  14:17 | 阶段 2 · 功能规格 | task-3d15749f
  14:47 | 阶段 3 · 技术架构 | task-8a80a749
  15:14 | 阶段 4 · PR 规划 | task-63f31c78
  15:27 | 阶段 6 · 验 `prs/`（阶段 4 门口） | task-08bac0b6
  15:32 | 阶段 5 · pr-001/002/003 的 tasks | task-251b7e7b / 2a34ff72 / 3fbe57f1
  15:37 | 阶段 5 · pr-001 实现 | task-49b58dd8
  15:39 | 阶段 5 · pr-002 实现 | task-3a39e75d
  15:45 | 阶段 5 · pr-003 实现 | task-32302e96
  15:52 | 阶段 6 · pr-001 验收（首轮） | task-43b380ca
  15:58 | 阶段 6 · pr-002 验收（首轮） | task-370c1288
  16:07 | 阶段 6 · pr-003 验收（首轮） | task-a87a7c03
  15:37–16:32 | 阶段 5 · pr-001/002/003 返工（证据形态） | 88d09f25 / b7bd0a9c / 8c97d4bd / 7207f08a / efcf2e6b / 37a215fe（`efcf2e6b` 出现两次）
  16:20 | 阶段 6 · pr-001 重验 | task-509a1241
  19:22 | 阶段 5 · pr-001 收尾修复 | task-eba25366 / task-5393eaed
  19:23 | 阶段 5 · pr-002 返工#2 | task-c3cdaff6
  19:33 | 阶段 6 · pr-002 重验 | task-afc70338
  19:42 | 阶段 6 · pr-003 重验 | task-cc60948d
  19:38 | 阶段 5 · pr-004 / pr-008 的 tasks | task-c48ac1f4 / task-5c579e20
  19:43 | 阶段 5 · pr-004 实现 | task-7553a07d
$ sed -n '30p' status.md
- **已派发总数（hub 通道，统计至 D-19 切换点 22:30）**：**19 行派发记录 / 28 个唯一 call id**（含失败后重派 `eba25366`→`5393eaed`、以及记录脱落判未落地后重派 `efcf2e6b`→`c3cdaff6`）；逐条见下表 ✓
```
判定：**19 行**与台账表体行数**逐行相符**；**28 个唯一 call id** 与我独立去重计数**完全相等**（20 个 `task-*` 长式 + 8 个短式 `2a34ff72/3fbe57f1/88d09f25/b7bd0a9c/8c97d4bd/7207f08a/efcf2e6b/37a215fe`；29 个 token 因 `efcf2e6b` 在批量行重复一次）；"逐条见下表"成立（表中确实逐行给出全部 28 个 id）✓
重派说明的两半：
- `eba25366`→`5393eaed`：**显式互证** ✓ —— `history.md:459`（`task-eba25366` 派发即失败 `context_crashed`/`duration_ms=0` ⇒ 判实例启动竞态 DC-21、处置=重派）与 `history.md:572`（"首派 `task-eba25366` 以 `context_crashed` 立即失败 ⇒ 重派 `task-5393eaed`；终态 completed，`duration_ms=1418598`"）两处都点名了这对 id。
- `efcf2e6b`→`c3cdaff6`：**间接互证**（非显式） —— `history.md:620` 记 `task-efcf2e6b` 为"同类：`completed` 但产物零变化"（对应台账批量行标注的"记录脱落，判未落地后重派"）；`history.md:451` 的派发记录标题为"pr-001 收尾修复 / **pr-002 返工#2 重派** / pr-003 返工#2"（19:22:38，即那次重派确实发生在此时点）；表中 19:22:38 之后唯一的"pr-002 返工#2"行即 `task-c3cdaff6`（19:23，`completed`，10.2 min），且 `history.md` 的 `19:33:01 · 收到报告 · dev（pr-002 返工#2）` 与"19:22.6 + 10.2 min ≈ 19:33"吻合。**caveat（如实记录）**：`grep -n 'c3cdaff6' history.md` **无命中**，即 `efcf2e6b→c3cdaff6` 这组 id 配对目前**只有 status.md 台账单源 + 时点/耗时自洽**支撑，缺一处显式 id↔id 记录（下一处顺手在 history 的 19:22/19:33 两条里补一行即可闭环）。这不影响 19/28 计数本身。

### ② 阶段状态表「已验证」列与脚注语义自洽 + 阶段 6 行不再留空 —— **fail（一格不自洽）**

```
$ sed -n '16,26p' status.md
| 1 | 需求收敛 | ✅ | ⬜ | …
| 2 | 功能规格 | ✅ | ✅ | …
| 3 | 技术架构 | ✅ | ⬜ | …
| 4 | PR 规划 | ✅ | ✅ | …
| 5 | PR 实现 | ✅ | ✅ | …
| 6 | 独立验证 | ✅ | — | 迭代级最终验证已执行：**pass 3 / fail 0 / partial 1**…

> **「已验证」列口径**：= 该阶段产物经**阶段 6 独立验证**且结论为 pass。阶段 1/2/3 未单独触发阶段 6 验证（…），故为 ⬜；阶段 4 由 …verify-20260916-153039.md（PASS）验证；阶段 5 由各 PR 验收 + 迭代级最终验证覆盖。
```
- **阶段 6 行不再留空** ✓（`完成 = ✅`、`已验证 = —`，备注写明 pass 3 / fail 0 / partial 1 并指向本报告）。
- **「已验证」列 ↔ 脚注不自洽** ✗：脚注把 **阶段 2** 明确列入"故为 ⬜"的集合（"阶段 1/2/3 未单独触发阶段 6 验证…故为 ⬜"），而表内阶段 2 的该列是 **✅**。二者不能同时成立。
- 该 ✅ **不是本次新引入**：`git show 860fa2a:…/status.md` 与 `git show d27a145:…/status.md` 的阶段表里阶段 2 早已是 ✅，`1711def` 的 diff 只动了阶段 4/5/6 三行 + 新增脚注 ⇒ 是"脚注定义后既有一格变成不自洽"，不是改动错误。
- 脚注其余两半**可核为真**：阶段 4 的依据 `clarifications/verify-20260916-153039.md` 结论实测为 `**PASS**（0 pass / 2 partial / 0 fail / 0 blocked）`；该报告亦确实触及阶段 2 产物（其 §功能点覆盖（`prd/` 20 张卡） 逐卡核了 F01~F19+G01 的 PR 引用，并写明 F04 按 D-16 不构成缺陷）；阶段 5 的依据与 `status.md:118/119` 一致。
- **现测应为**（二选一，均为一处一行）：
  1. 把表内**阶段 2 的「已验证」改为 ⬜**（与脚注的"1/2/3 ⇢ ⬜"一致；`clarifications/` 实测共 14 份报告 = 1 份阶段 4 门口报告（`verify-20260916-153039`）+ 12 份逐 PR 报告（pr-001 三轮 / pr-002 两轮 / pr-003 两轮 / pr-004·005·006·007·008 各一份）+ 本迭代级报告 1 份，其中**没有任何针对 prd 产物的阶段 6 报告**）；
  2. 或改脚注措辞，把阶段 2 从"故为 ⬜"的集合里摘出并给出其 ✅ 的依据（例如"阶段 2 的 20 张卡由阶段 4 门口验证一并覆盖（该报告 §功能点覆盖 逐卡核过）"）。
  无论选哪种，只要表内单元格与脚注互相自洽即满足本项。

### 附·本轮结论：标准 3 升为 pass（判定规则一并写明）

- **标准 3 按简报枚举的口径全部通过**：① `demand.md` D-1~D-19 齐备且 user_confirmed 状态标注完整；② `prd.md` 索引 20 行 ↔ `prd/` 20 卡双射；③ `prs/**` 的 `depends_on` 与 `status.md` 依赖列四处一致；④ `status.md` 的 PR 子状态 ↔ 8 个合并提交逐条对齐（含本轮修好的 pr-007 行与 pr-004 台账行）；⑤ `history.md` 118 条事件记录 ↔ git 事实无冲突；特别核 **8 个 merge commit** 全部存在且与 8 个 PR 一一对应。我上一轮列出的三条 partial 明细**全部闭合**（`d27a145` 闭合前两条、`1711def` 闭合第三条）。
- **判定规则（避免口径偷渡，明确写出）**：本轮新发现的"阶段 2 已验证 ✅ ↔ 脚注"这一格矛盾**不属于**简报对标准 3 的枚举核对面（枚举面 = D 决策 / prd 索引 / depends_on / status 的 PR 子状态与合并提交 / history 事件），故**不据此下调**标准 3；它被登记为偏差 **DEV-11**（见下）。若主 agent 的意图是"`status.md` 任意两处都必须自洽才算标准 3 通过"，则该项应记 **partial**，差额恰为这一格——请按你的口径择一，我不擅自扩大或缩小标准。
- **迭代级最终结论**：**PASS**（pass 4 / fail 0 / partial 0 / blocked 0；标准 1/2/4 早前判定通过，标准 3 本轮由 partial 升为 pass）。唯一遗留为 DEV-11 一格（一行改法已给出，不阻塞收口）。

### 偏差记录（追加）

| # | 规格/文档描述 | 实现/现状实际 | 建议处理 |
|---|---|---|---|
| DEV-11 | `status.md` 阶段表脚注「阶段 1/2/3 …故为 ⬜」 | 表内阶段 2「已验证」= ✅（该 ✅ 自 `860fa2a` 起即存在）⇒ 脚注与表内一格互相矛盾 | 二选一：把阶段 2 该列改 ⬜；或改脚注把阶段 2 摘出并给出其 ✅ 依据。一行改动即可 |
| DEV-12 | `status.md:30` 重派配对 `efcf2e6b`→`c3cdaff6` | 该配对目前只有台账单源 + 时点/耗时自洽（`history.md` 未出现 `c3cdaff6` 字面 id；`efcf2e6b` 的"记录脱落/重派"与 19:22:38 的"pr-002 返工#2 重派"标题、19:33 回报的 10.2 min 自洽） | 建议在 `history.md` 的 19:22:38 与 19:33:01 两条里补记这组 id（不改判定） |


---

> **最终判定以本文件末三次定向复核的结论为准**：标准 3 = **pass**（原三条 partial 明细已由 `d27a145` + `1711def` 全部闭合，其枚举核对面与 8 个 merge commit 全部通过）⇒ **迭代级最终结论 PASS：pass 4 / fail 0 / partial 0 / blocked 0**。正文「## 结论」一节所记的 "partial 1"（标准 3）是第一次判定时的历史状态，已被后续两轮定向复核取代；唯一遗留为偏差 **DEV-11**（`status.md` 阶段表阶段 2「已验证」一格与脚注不自洽，一行改法已给出，不阻塞收口）与 **DEV-12**（`efcf2e6b→c3cdaff6` 重派配对建议补记显式 id），二者均不改变上述结论。
