# 阶段 5 独立验证报告 · pr-003-sse-transport-additions（返工重验）

**报告文件**: `docs/iterations/0029-hub-client-session-and-duplex/clarifications/verify-20260916-194203-pr-003-sse-transport-additions.md`
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

验证者身份：同级代码审查者（SSE 传输内核 · 过滤订阅 / 调用关流）
产出物：`feat/0029-pr-003-sse-transport-additions` @ `a1efcc9`（工作区 `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-003-sse-transport-additions`；merge-base `72b659f`）
验证标准来源：本委托 4 条 + PR「验收标准」第 23–31 行 9 款 + `architecture.md` §6.1 Z-1；标准 2 口径：`*-tasks.md` 不构成夹带
验证日期：2026-09-16

说明：不采信「验收证据」段自述。下列输出为本轮独立 mock-res 实跑，并对照 `git show 72b659f:oamp/src/transport.js` 动态 import 的基线模块。另从 PR 抽出 AC1/AC8 heredoc 原样执行以核对该段可复核。未改被验证产物。

## 逐项判定

- **标准 1 · 验收标准逐条判定**：partial
  通过：第 24–31 行。不通过拆开：第 23 行「既有 13 个导出键」且列举 `closeKey` 与基线不符。

  **1.1 导出面只追加（第 23 行）**：partial
  ```text
  KIND sse
  BASE_KEYS close,closeAll,globalCount,handle,handleCallStream,handleChatCallStream,kind,publish,publishCall,publishChatCall,publishGlobal
  NOW_KEYS  … + closeCallSubscriptions,handleSubscribe,publishFiltered
  MISSING none
  MODULE_EXPORTS createSseTransport
  ```
  通过：差集恰为 3 个新对象键，无缺失；模块级仍仅 `createSseTransport`。
  不通过：条文写「既有 13 个导出键」并列举未导出的 `closeKey`。现测基线对象键 **11**。按实际集合判定追加成立。

  **1.2 `closeCallSubscriptions` 只关 `call:<id>`（第 24 行）**：pass
  ```text
  AC2_ENDED { call: true, chat: false, chatCalls: false }
  AC2_RECV { callHas9: false, chatHas10: true, ccHas9: true, ccHas11: true }
  RES_END_COUNT 1
  CLOSECALL_BODY true   （closeCallSubscriptions → closeKey(callKey(callId))）
  ```

  **1.3 断开清理 + 心跳自停（第 25 行）**：pass
  `heartbeatMs:40`：
  ```text
  HB { ka1: 2, ka2: 2, ka1b: 2, ka2b: 2, stopped: true }
  ```

  **1.4 过滤谓词 AND（第 26 行）**：pass
  ```text
  ONLINE_TYPES agent_online
  CALL_TYPES call_state,call_state
  AND_TEXT 仅 event: call_state / data {"agent":"dev"}
  ONLINE_NO_CALL_CHAT true
  ```

  **1.5 不缓存不补发（第 27 行）**：pass
  ```text
  AC5_CHUNKS ["retry: 1000\n\n"]
  AC5_NO_EVENT true
  ```

  **1.6 隔离性（第 28 行）**：pass
  ```text
  AC6_GC_UNCHANGED true
  AC6_GC_AFTER_FILTER_CLOSE true
  AC6_EXISTING_NO_FILTERED true
  AC6_FILTER_FROM_EXISTING_APIS []
  AC6_FILTER_SURVIVES_CLOSEALL true
  ```

  **1.7 SSE 头与无初始数据帧（第 29 行）**：pass
  ```text
  AC7 status=200 headers content-type=text/event-stream; charset=utf-8 cache-control=no-store connection=keep-alive
  chunks ["retry: 1000\n\n"]
  ```
  `DEFAULT_HEARTBEAT_MS=15000` 未改。

  **1.8 四键空间回归与基线一致（第 30 行）**：pass
  ```text
  AC8_JSON_EQ true
  before: global=[global] chat=[chat] call=[call] chatCalls=[call,chat_call]
  close(chat) 只结束 chat；随后 call/chat-calls/global 仍可达
  ```
  从 PR 抽出 AC8 heredoc 原样执行：`status 0`，`equal:true`，形状与文件内贴出 JSON 一致。

  **1.9 零依赖、不 import web.js（第 31 行）**：pass
  ```text
  IMPORT_COUNT 0
  WEB_IMPORT false
  PKG empty
  ```

- **标准 2 · 改动面封闭性**：pass
  `git diff --name-only 72b659f..HEAD`：
  ```text
  docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions-tasks.md
  docs/iterations/0029-hub-client-session-and-duplex/prs/pr-003-sse-transport-additions.md
  oamp/src/transport.js
  ```
  `oamp/` 仅 `transport.js`。`web.js` / `calls.js` 零命中。`*-tasks.md` 按本委托口径不构成夹带。

- **标准 3 · 验收证据原文照录**：pass
  「验收证据」段为仓内 `node --input-type=module <<'NODE'` / `grep` / `git` + 块内 stdout。无 `/tmp/*.mjs`。本轮抽出 AC1/AC8 脚本可执行，AC1 stdout 与文件贴出逐字相同。导语与块外说明（第 62、79、97 等行）与证据块分离。第 191–192 行 `git diff --name-only` 空输出与本轮空 diff 一致。

- **标准 4 · 既有面零影响（Z-1）**：pass
  四键空间 probe 与 `72b659f` JSON 全等；既有 publish API 不写入过滤注册表；`globalCount` 不计入过滤订阅者；新增键为追加。`closeAll` 不清理过滤订阅——既有 `closeAll` 只关 `subscribers` 的语义保持。

## 汇总

- pass: 3 项
- fail: 0 项
- partial: 1 项（标准 1；第 23 行计数笔误）
- blocked: 0 项

## 偏差记录

| 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|
| 验收 1「既有 13 个导出键」且列举 `closeKey` | 基线对象键 11；`closeKey` 未导出；追加后对象键 14 | 按实现更新文档 |
| `closeAll` 覆盖「全部订阅」 | 只关 `subscribers`，`filteredSubscribers` 连接不 `end` | 重新评估实现 / 按实现更新文档 |

## 下一迭代候选

- `closeAll` 是否应同时结束过滤订阅（进程退出路径目前可能留下 filtered SSE）。
- 既有 `publish*` 不自动投喂过滤表 ⇒ pr-005 必须在发布点显式调 `publishFiltered`。

## 结论

**PASS**（所有条目 pass 或 partial 且无 fail）
