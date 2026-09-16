# 阶段 5 独立验证报告 · pr-002-session-registries

**报告文件**: `docs/iterations/0029-hub-client-session-and-duplex/clarifications/verify-20260916-155847-pr-002-session-registries.md`
**验证日期**: 2026-09-16

# 搭置记录原文（透传，不做二次判断）

> 以下为工作区 `docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md` 全文逐字摘录。不转述、不总结、不删减、不二次判断。

-----

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
-----


---

验证者身份：同级代码审查者（进程内身份表 / 取件指针表）
产出物：`feat/0029-pr-002-session-registries` @ `022dd7e`（工作区 `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries`；merge-base `72b659f`）
验证标准来源：本委托 4 条 + PR 文件「验收标准」第 24–35 行 12 款 + `architecture.md` §6（本 PR 声明零改既有文件）
验证日期：2026-09-16

说明：不采信「验收证据」段自述。下列输出均为本轮独立 `import` / `git` / `grep`。未改被验证产物。

## 逐项判定

- **标准 1 · 验收标准逐条判定**：partial
  通过：第 24–27、29–31、33–35 行。不通过拆开：第 28 行 `touch` 未观察到 `last_seen_at` 前进；第 32 行 `ack` 未把条目从 Map 删除（`listByRequester` 因 `acked===false` 过滤而不返回，但同一 `call_id` 再 `add` 返回 `false`）。

  **1.1 可独立 import、导出面收敛（第 24 行）**：pass
  ```text
  principals keys get,requesterOf,touch,upsert
  pickup keys ack,add,listByRequester
  extra none；forbidden history/export/clear/decided/delete 均不在导出面
  node --input-type=module import 成功
  ```

  **1.2 import 只含 `node:*`（第 25 行）**：pass
  ```text
  $ grep -n '^import' oamp/src/principals.js oamp/src/pickup.js
  （零输出）
  principals import count 0；pickup import count 0
  ```
  零 import ⇒ 无仓内耦合；比「只含 node:*」更严。

  **1.3 upsert 幂等（第 26 行）**：pass
  ```text
  u1/u2 created_at 相同 1789545616188；无 error；get 同形
  last_seen_at 不倒退（两次均为 1789545616194）
  第二次 upsert kind:'other' 仍 kind=cli（不覆盖创建时声明）
  ```

  **1.4 形态校验与 `isValidInstanceId` 同源（第 27 行）**：pass
  15 组输入（空 / 64 / 65 / 空格 / 换行 / 中文 / tab / 非字符串 / `ok/id` 等）与 `registry.isValidInstanceId` 逐项 `match:true`；非法返回 `{error:'INVALID_PRINCIPAL_ID'}` 且不建条目。实现是码元循环而非复用导出函数，但判据集合等价。

  **1.5 无租约 + touch（第 28 行）**：partial
  通过：`grep -cE 'setTimeout|setInterval'` 两文件均为 0；`touch('no-such')` 返回 `null`（不自动建）。
  不通过：同一毫秒内 `touch` 后 `last_seen_at` 未前进：
  ```text
  {"created_same":true,"last_before":1789545628606,"last_after":1789545628606,"advanced":false}
  ```
  `Date.now()` 毫秒分辨率下无法证明「前移」。

  **1.6 `requesterOf` 只读显式声明（第 29 行）**：pass
  ```text
  null/{} / principal_id:'' → null
  缺 instance_id → instance_id:null，不报错
  requesterOf({principal_id:'p9'}) 后 get('p9') 仍 null（不登记）
  ```

  **1.7 pickup.add 幂等（第 30 行）**：pass
  ```text
  add1 true add2 false
  首条 requester 仍 p1，不被第二次覆盖
  ```

  **1.8 listByRequester 隔离（第 31 行）**：pass
  ```text
  p1 ["c1"]  p2 ["c2"]
  ```

  **1.9 ack 幂等删除语义（第 32 行）**：fail
  标准原文：「条目移出未取件集合；重复 ack / 不存在的 id ⇒ 返回成功且无副作用」。
  实跑：`ack('c1')` 后 `listByRequester('p1')` 为空（过滤 `acked===false`），重复 ack / 不存在 id 不抛。
  但实现是 `entry.acked = true` **保留在 Map**（`pickup.js:34-36`），同一 `call_id` 再 `add` 返回 `false`：
  ```text
  add after ack same id false p1 list []
  ```
  「移出集合」未发生；与 `inbox.take` 真删除不同。architecture §4 A-06 写「置 acked=true 并移出集合」——实现只做了前半。

  **1.10 只存指针六键（第 33 行）**：pass
  ```text
  keys acked,agent,call_id,chat_id,requester,terminal_at
  extra/text/envelope 均不在条目上（add 传入 extra:'NO' 被丢弃）
  ```

  **1.11 寿命注释 + 无落库（第 34 行）**：pass
  两文件头均含「进程内、不持久、重启即丢」；无 `writeFile/appendFile/createWriteStream`。

  **1.12 零新依赖、diff 不含 web.js 与既有 oamp 文件（第 35 行）**：partial
  通过：`oamp/` 仅新增 `principals.js` / `pickup.js`；`web.js` 零命中。
  不通过：`72b659f..HEAD` 还含 `prs/pr-002-session-registries.md` 与 `prs/pr-002-session-registries-tasks.md`。后者不是「既有文件」但使「本 PR 的 diff 不含…任何既有文件」在字面上与 tasks 夹带纠缠（见标准 2）。功能上无既有 `oamp/**` 改动。

- **标准 2 · 改动面封闭性**：fail
  文件范围（第 16–18 行）：`oamp/src/principals.js`、`oamp/src/pickup.js`、本 PR 文件。
  不触碰（第 20 行）：`web.js` / `inbox.js` / `persist.js` 在 name-only 中零命中。
  实际 `git diff --name-only 72b659f..HEAD`：
  ```text
  docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries-tasks.md
  docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md
  oamp/src/pickup.js
  oamp/src/principals.js
  ```
  `*-tasks.md` 不在文件范围，属夹带。

- **标准 3 · 验收证据原文照录**：fail
  PR 第 51–58 行是摘要（「实跑脚本…RESULT: PASS」「边界脚本…」「equivalence 15/15」），无 `$ 命令` + 原样 stdout。引用 `/tmp/pr002-verify.mjs` 亦不在仓库内。

- **标准 4 · 既有面零影响**：pass
  本 PR 不修改既有文件（`inbox.js` / `web.js` / `persist.js` / `package.json` 的 `git diff --stat` 空）。零影响由「无 diff」成立，无需行为对照。architecture §6 的 Z 条目针对既有 HTTP/UDS 面，本 PR 未触碰。

## 汇总

- pass: 1 项（标准 4）
- fail: 2 项（标准 2、标准 3；需返工）
- partial: 1 项（标准 1）
- blocked: 0 项

## 偏差记录

| 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|
| 上下文摘要写 principals 导出含 `resolve` | 实现导出 `requesterOf`，无 `resolve`（与 DC-11 同族） | 按实现更新文档 |
| 摘要「导出面恰好 4 / 3」与「同 inbox 恰好 5」并列 | 4+3=7，不是 5；inbox 仍 5 且未改 | 按实现更新文档 |
| A-06 / 验收 9「ack 移出集合」 | `acked=true` 留在 Map，`add` 不可再插入同 id | 重新评估实现 |
| 形态校验「复用既有规则、不另写一份正则」 | 手写码元循环，未调用 `isValidInstanceId`；15 例等价 | 按实现更新文档 |
| 文件范围未列 `*-tasks.md` | merge-base..HEAD 含 tasks 文件 | 移出提交或写入文件范围 |

## 下一迭代候选

- `touch`/`upsert` 刷新依赖 `Date.now()` 毫秒时钟，单测在同一毫秒内无法观察「前移」。
- `ack` 软删除使 `call_id` 成为进程内一次性键：确认后无法再登记同一调用的指针。

## 结论

**FAIL**（有 fail 条目）

主 agent 需返工：① 去掉或声明 `*-tasks.md`；② 「验收证据」改为可复制命令 + 原样输出。模块语义大体可独立 import 验证；`ack` 未物理移出与 `touch` 时间不可分为标准 1 的缺口，不单独升为整卡第二 fail（已计入标准 1 partial / 第 32 行 fail 子项）。
