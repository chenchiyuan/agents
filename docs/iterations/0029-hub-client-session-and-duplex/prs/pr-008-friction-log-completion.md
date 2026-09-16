# pr-008：过程证据与摩擦搭置的核对补齐（F18）

## 上下文摘要

按 F18（过程契约卡，不引入产品能力）核对并补齐迭代目录内的**摩擦搭置记录**：`deferred-demand-changes.md` 中每条摩擦含三要素（问题 / 为什么判定为需求层面问题 / 本迭代如何处理），且"既有 `skill/hub.md` 未教等待原语"（事实 F-8）这一条**必须在场**（其处置指向 D-17 / F19）。

关键约束：该文件由主 agent 滚动追加（**只增不改**），本 PR 只做核对与补齐、不改既有行原文、不新建文件格式；`status.md` 的派发台账由**主 agent 滚动维护**（含 D-13 三问列），**不在本 PR 范围**（与 0028 迭代 pr-007 的同日口径一致）。

## 涉及功能点

- F18

## 文件范围

- `docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`（F18 要求的摩擦搭置记录：核对与补齐）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-008-friction-log-completion.md`（本 PR 文件）

排除（本 PR 不触碰）：`docs/iterations/0029-hub-client-session-and-duplex/status.md`（主 agent 滚动维护的派发台账）、`history.md`、`demand.md`（红线）、`architecture.md` / `prd/**`（只读）、`oamp/**`（本 PR 零代码改动）。

## 验收标准

- [ ] 摩擦类条目**至少**包含"既有 `skill/hub.md` 未教等待原语"一条（事实 F-8），其处置指向 `D-17` / `F19`（F18 验收 4）
- [ ] 每条摩擦条目三要素齐备且可核对：**问题** / **为什么判定为需求层面问题** / **本迭代如何处理**；三要素以字段名或等价的分列表述出现，不出现"见上文""同上"式指代（F18 验收 5）
- [ ] 处置一栏不出现"暂停 / 回退 / 改需求"形态的处置（F18 边界：摩擦不当阻塞理由）（F18 验收 4）
- [ ] 只增不改：既有 `DC-*` 行原文逐字保留，`git diff --numstat -- docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md` 的删除行数为 **0**
- [ ] 不新建文件、不新建表格格式（沿用既有表头与既有 `DC-` 前缀体例）；不修改 `demand.md`
- [ ] 本 PR 的 `git diff --name-only` 仅含该文件与本 PR 文件两行；不含 `oamp/**`、`roles/**`、`status.md`、`history.md`
- [ ] **台账与度量口径已登记（只核对、不回填）**：文件内可读到"派发台账逐行含 D-13 三问（角色 / 用途 / `call_id` / 终态 / 结果到手方式）"的口径指向（指向 `status.md` §派发台账）；**本 PR 不代主 agent 回填台账**（F18 验收 2/3 的载体为主 agent 维护的 `status.md`，见参考资料）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F18-process-evidence-and-friction-log.md`（验收 1~5、边界）
- `docs/iterations/0029-hub-client-session-and-duplex/prd/F19-hub-usage-doc-fix.md`（事实 F-8 对应的交付项）、`prd/F03`/`F05`/`F06`（DC-02 转为设计输入的去向）
- `docs/iterations/0029-hub-client-session-and-duplex/status.md` §派发台账（口径行：每行额外记录**结果到手方式**；F18 验收 1/2/3 的载体，主 agent 维护、不属本 PR）
- `docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`（现状 `DC-01`~`DC-08a`；本 PR 的核对基线）
- 体例先例：`docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md`（过程契约卡的 PR 形态：分区核对 + 四要素自检 + 明文排除 `status.md`）

## depends_on

（无）

## batch

1

## 验收证据

### 1. 摩擦条目清单与三要素自检表

命令：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && grep -n '^## ' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

原样输出：

```text
8:## 2026-09-16 · **错误（调用面）**
17:## 2026-09-16 · **摩擦（可观测性）**
26:## 2026-09-16 · **摩擦（结果到手）**
35:## 2026-09-16 · **事实修正（对 F-3 的细化）**
44:## 2026-09-16 · **摩擦（追溯）**
53:## 2026-09-16 · **事实（对上游的补充）**
62:## 2026-09-16 · **流程偏差（主 agent 自身）**
71:## 2026-09-16 · **期望偏差（严重：流程不能自推进）**
80:## 2026-09-16 · **主 agent 侧修正（当场执行）**
89:## 2026-09-16 · 阶段 4→5 入口
99:## 2026-09-16 · 阶段 5
108:## 2026-09-16 · 阶段 5
117:## 2026-09-16 · 阶段 5
126:## 2026-09-16 · 阶段 5
135:## 2026-09-16 · 阶段 5
144:## 2026-09-16 · 阶段 5
153:## 2026-09-16 · 阶段 5
162:## 2026-09-16 · 阶段 5
171:## 2026-09-16 · 阶段 5
180:## 2026-09-16 · 阶段 5
189:## 2026-09-16 · 阶段 5
207:## 2026-09-16 · 阶段 5
216:## 2026-09-16 · **摩擦（度量口径）**
```

记录数与字段计数：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && grep -c '^\*\*编号\*\*' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md && grep -c '^\*\*问题\*\*' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md && grep -c '^\*\*为什么判定为需求层面问题 / 为什么记录于此\*\*' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md && grep -c '^\*\*本迭代如何处理\*\*' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

```text
23
23
23
23
```

逐条分类与三字段自检：

| 编号 | 分类标题 / 判定依据 | 摩擦类？ | 三字段 |
|---|---|---:|---|
| DC-01 | 错误（调用面）；调用失败事实 | 否 | ✓ / ✓ / ✓ |
| DC-02 | 摩擦（可观测性）；记录可观测性缺口 | 是 | ✓ / ✓ / ✓ |
| DC-03 | 摩擦（结果到手）；结果获取摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-04 | 事实修正（对 F-3 的细化）；事实更正 | 否 | ✓ / ✓ / ✓ |
| DC-05 | 摩擦（追溯）；过程追溯摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-06 | 事实（对上游的补充）；事实补充 | 否 | ✓ / ✓ / ✓ |
| DC-07 | 流程偏差（主 agent 自身）；流程偏差 | 否 | ✓ / ✓ / ✓ |
| DC-08 | 期望偏差（严重：流程不能自推进）；按摩擦处置 | 是 | ✓ / ✓ / ✓ |
| DC-08a | 主 agent 侧修正（当场执行）；修正记录 | 否 | ✓ / ✓ / ✓ |
| DC-09 | 阶段 4→5 入口；阶段入口缺口 | 否 | ✓ / ✓ / ✓ |
| DC-10 | 阶段 5；派发地址操作错误 | 否 | ✓ / ✓ / ✓ |
| DC-11 | 阶段 5；上游命名一致性缺口 | 否 | ✓ / ✓ / ✓ |
| DC-12 | 阶段 5；既有能力认知更正 | 否 | ✓ / ✓ / ✓ |
| DC-13 | 阶段 5；重复超时的过程摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-14 | 阶段 5；计数笔误 | 否 | ✓ / ✓ / ✓ |
| DC-15 | 阶段 5；实例级串行瓶颈 | 是 | ✓ / ✓ / ✓ |
| DC-16 | 阶段 5；观测能力边界更正 | 否 | ✓ / ✓ / ✓ |
| DC-17 | 阶段 5；推送面使用摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-18 | 阶段 5；验收口径摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-19 | 阶段 5；证据格式摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-20 | 阶段 5；重复自建连接层摩擦 | 是 | ✓ / ✓ / ✓ |
| DC-21 | 阶段 5；上下文启动竞态事实 | 否 | ✓ / ✓ / ✓ |
| DC-22 | 摩擦（度量口径）；跨文件口径指向缺口 | 是 | ✓ / ✓ / ✓ |

处置形态逐条自检（分类值均来自既有处置语义；DC-22 亦包含“按已落盘需求继续”）：

| 编号 | 处置形态 | 合格 |
|---|---|---:|
| DC-01 | 按已落盘需求继续 | ✓ |
| DC-02 | 转设计输入 | ✓ |
| DC-03 | 已由用户裁决升格为交付项 | ✓ |
| DC-04 | 事实追加 | ✓ |
| DC-05 | 转设计输入 | ✓ |
| DC-06 | 事实追加 | ✓ |
| DC-07 | 主 agent 当场修正 | ✓ |
| DC-08 | 主 agent 当场修正 | ✓ |
| DC-08a | 主 agent 当场修正 | ✓ |
| DC-09 | 主 agent 当场修正 | ✓ |
| DC-10 | 主 agent 当场修正 | ✓ |
| DC-11 | 事实追加 | ✓ |
| DC-12 | 事实追加 | ✓ |
| DC-13 | 事实追加 | ✓ |
| DC-14 | 事实追加 | ✓ |
| DC-15 | 转设计输入 | ✓ |
| DC-16 | 事实追加 | ✓ |
| DC-17 | 主 agent 当场修正 | ✓ |
| DC-18 | 主 agent 当场修正 | ✓ |
| DC-19 | 主 agent 当场修正 | ✓ |
| DC-20 | 主 agent 当场修正 | ✓ |
| DC-21 | 按已落盘需求继续 | ✓ |
| DC-22 | 按已落盘需求继续 | ✓ |

无指代核查：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && grep -c '见上文' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md; grep -c '同上' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

```text
0
0
```

### 2. F-8 原文与处置指向

命令：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && sed -n '26,31p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

原样输出：

```text
## 2026-09-16 · **摩擦（结果到手）**

**编号**：DC-03
**问题**：结果**不自动到手**：本次靠主 agent **自行拉起** `cli task watch` 才拿到终态（hub skill 的「序列 1」只教"派发 → `calls get`"，未提 `--mode block` / `cli task watch`）。
**为什么判定为需求层面问题 / 为什么记录于此**：与迭代开始时实测的摩擦①同源；`skill/hub.md` 未教正确用法
**本迭代如何处理**：已由用户裁决升格为交付项 ⇒ **D-17 / 新增卡 F19**（本迭代内修复）
```

命中与实体存在性：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && grep -n 'skill/hub.md' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md && grep -n 'D-17' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/demand.md && ls /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/prd/F19-hub-usage-doc-fix.md
```

```text
30:**为什么判定为需求层面问题 / 为什么记录于此**：与迭代开始时实测的摩擦①同源；`skill/hub.md` 未教正确用法
202:**为什么判定为需求层面问题 / 为什么记录于此**：**不是需求问题，是主 agent 的行为缺陷**，且是**同类错误第三次发生**：0028 复盘已判定自建 watchdog 为"对现成原语的重复实现"（当时 `oamp task watch` 早已存在于层 C）、并明令"**禁止把 watchdog 当作等待机制的默认解**"；而本迭代（0029）**正是因该毛病而立项**。记录理由：这是本迭代**最强的体感反面样本**——**立项人自己都仍按拉取式使用 hub**，说明问题不在"文档有没有写"，而在"文档主推路径的易用性"（事实 F-8：`skill/hub.md` 序列 1 只教"派发 → `calls get`"）。
48:| D-17 | **hub skill 文档修复升格为交付项** | 把「暴露现成等待原语（`--mode block` / `cli task watch`）」从「仅记录摩擦」升格为本迭代交付项（对应事实 F-8，直接服务 D-13 体感目标） | `user_confirmed`（2026-09-16） |
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/prd/F19-hub-usage-doc-fix.md
```

### 3. AC3 字面命中与语义判定

为保留既有六条原文，以下命令只抽取这六条已经存在的处置行；这些词均为“未发生”的否定式陈述，不是处置动作：

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && grep -n '^\*\*本迭代如何处理\*\*' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md | grep -E '^(22|40|58|67|76|94):'
```

```text
22:**本迭代如何处理**：不改需求；转为设计输入：**F05（实例实时状态投影四字段）/ F06（停滞可区分）正是本条的产品化**（迁移到 `prd.md` 的既有卡，不新增）
40:**本迭代如何处理**：作为事实追加（不改需求条款）；阶段 3 架构时须以本条为约束
58:**本迭代如何处理**：不回退不暂停；**转入阶段 4 的切分约束**（planner 须把单 PR 工作量压在 30 分钟内可产出增量产物），并作为 D-13 摩擦证据
67:**本迭代如何处理**：**不回退**；阶段 4 起 brief 严格按规范字段逐行构建；`status.md` 已对齐模板；`history.md` 自 2026-09-16 15:20 起改规范格式（更早记录原文保留、不臆造秒级时点）
76:**本迭代如何处理**：不回退、不改需求、不重跑；本迭代按已落盘需求继续。**处置三层**：① **主 agent 侧立即修正**（见 DC-08a）；② 作为 **F18 的过程证据**与 **F07/F09~F12 的体感对照基线**（本迭代实现的"结果自动到手"必须能消除本现象，阶段 6 以此对照取证）；③ 作为事实输入校验本迭代条文：**"产物已落盘"应当是可被观测的事实**（当前 hub 观测面缺此项 —— 见 DC-02/DC-04）
94:**本迭代如何处理**：不回退、不重规划（重规划会使刚派发的阶段 4 验证失效）。由主 agent 在**阶段 5 派发前**执行一次产物入库提交：`git -C <迭代工作区>` 在 `iteration/0029-hub-client-session-and-duplex` 上提交 `docs/iterations/0029-.../` 与 `roles/*/data/0029-*`（消息体例 `docs(0029): 阶段 1~4 产物入库`），随后每次阶段推进与收口前再提交增量。
```

### 4. 只增不改与命名面

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && git diff --numstat HEAD^ HEAD -- docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

```text
126	0	docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
```

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && git diff --name-only HEAD^ HEAD
```

```text
docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-008-friction-log-completion.md
```

本次提交的父提交是 `ffb5091`；更早的 `cfb6736..ffb5091` 只包含已存在的 PR tasks 工作流产物，不属于本次提交改动。

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && git status --short
```

```text
```

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && git diff cfb6736 HEAD -- docs/iterations/0029-hub-client-session-and-duplex/demand.md docs/iterations/0029-hub-client-session-and-duplex/status.md docs/iterations/0029-hub-client-session-and-duplex/history.md
```

```text
```

### 5. 台账口径指向

```text
$ cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion && sed -n '216,221p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md && grep -n '派发台账\|口径\|结果到手方式' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/status.md
```

```text
## 2026-09-16 · **摩擦（度量口径）**

**编号**：DC-22
**问题**：`status.md` §派发台账的 D-13 度量口径（角色 / 用途 / `call_id` / 终态 / **结果到手方式**）只声明在 `status.md`（口径行与列头），本搭置文件内没有指向行 ⇒ 阶段 6 独立验证核对“口径是否已登记”时须跨文件检索，“摩擦记录”与“度量台账”的维护边界也无法从本文件读出。
**为什么判定为需求层面问题 / 为什么记录于此**：属**过程记录面的完整性缺口**（F18 验收 2/3 的载体归属问题），不是 hub 能力缺陷；F18 边界禁止新增过程度量工具、要求记录落在既有文件里 ⇒ 只能在既有搭置文件内补一条**指向**。
**本迭代如何处理**：本 PR 补该指向行（指向 `status.md` §派发台账）；**台账本体由主 agent 滚动维护，本 PR 不回填台账任何一行**（口径与列头均不动）；本迭代按已落盘需求继续。
46:## 派发台账
51:**口径**：本迭代的**所有派发一律经 `hub`**（`oamp/skill/hub.md`，遵守其四条红线）；台账同时作为 D-13「hub 体感」的度量载体——每行额外记录**结果到手方式**（自动送达 / 主动查询 / 阻塞等待）。
53:| 时点 | 角色（节点） | 用途 | call_id | 终态 | 实报 model | 结果到手方式 |
```

### 6. 禁用词自查

```text
$ grep -nE '/tmp/|<[a-z_]+>|…' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-008-friction-log-completion.md
```

```text
269:$ grep -nE '/tmp/|<[a-z_]+>|…' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-008-friction-log-completion/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-008-friction-log-completion.md
```

命中为自检命令自身及其证据化输出副本；未发现证据正文中的其它命中。
