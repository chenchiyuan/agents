# 研发 Agent 代码提交管理系统 · 设计方案

v1.1 · 2026-09-02

**定位**：为自研研发 agent 设计一套基于 Issue / PR / Git Worktree 的代码提交管理体系。
**与前一版的区别**：本文档是**自建系统的设计**，Agent Orchestrator（AO）等开源项目仅作为**参考实践**引用，不作为底座。
**阅读顺序**：第 1 章回答"为什么要做"，第 2-4 章回答"要解决什么、现状如何"，第 5-6 章是方案主体，第 7-8 章是落地路径。时间紧的话，读第 1 章和第 5 章即可。

---

## 0. 一句话

**把 agent 的"连续、长上下文、无边界"的执行模型，适配到代码的"离散、原子提交、强评审"的协作模型上。** Issue 定上下文边界，PR 定提交粒度，Worktree 定执行隔离——三者构成一个不变量，缺一不可。

---

## 1. 初衷与目的

### 1.1 现状：能力到位了，工程化没跟上

研发 agent 已经能自主完成中等复杂度的开发任务。但产出的变更仍是"一坨"——一次会话连续改十几个文件，产出一个几千行的 diff。

**这种产出技术上能跑，工程上不可用**：没法认真 review、没法精准回滚、没法并行推进。

约束 agent 产能的，已经不是"它能不能写出来"，而是**"它写出来的东西人能不能消化"**。

### 1.2 初衷：三层动因

| 层次  | 动因  |
| --- | --- |
| **直接触发** | agent 产出的变更粒度失控。单次会话的 diff 超出人能认真 review 的范围，评审流于形式，质量保障形同虚设 |
| **深层动因** | 研发 agent 要从"辅助工具"升级为"可托付的产出方"，就必须接受和人类工程师同等的代码管理约束。**没有这个约束，agent 的可用产能永远被"人能一次性消化的 diff 大小"封顶** |
| **战略目的** | 让 agent 的产能可以被工业化放大——通过原子拆分 + 隔离并行，把吞吐从"单会话串行"提到"多任务并行"，同时不损失可审计性与可控性 |

三者的关系是：**直接触发暴露了问题，深层动因决定了必须解决，战略目的决定了解决方式是"拆分 + 并行"而非"限制 agent 能力"。**

### 1.3 目的：做成之后是什么样

| 视角  | 变化  |
| --- | --- |
| **对 agent** | 有清晰的上下文边界。不再因为一次塞太多事而中途退化、遗忘、跑偏；发现范围外的问题有明确的处置出口，不会撑爆当前上下文 |
| **对人** | review 负担可预测。每个 PR 都在可消化范围内，评审是真实的而非形式化的；只在**方案批准**和**合并**两个决策点介入 |
| **对团队** | 变更可追溯、可审计、可并行。每个改动都能回答"为什么改、谁批准的、对应哪个需求" |
| **对系统** | 反馈闭环自动运转。CI 失败、review 意见自动回到产出它的那个会话，**人不再充当"日志搬运工"** |

其中"人不再充当日志搬运工"是最容易被低估、也最能直接改善体感的一条。

### 1.4 为什么是现在

三个条件同时成熟：

1. **Agent 能力过了临界点** —— 能自主完成中等复杂任务，才谈得上"管理它的产出"。能力不够时，粒度问题根本不暴露
2. **生态已形成共识** —— git worktree 作为隔离机制已是事实标准（AO / vibe-kanban / shard / workstrator 无一例外），不必自己摸索，可以直接借鉴工程细节
3. **Issue 驱动这条链路尚无成熟方案** —— 生态内最完整的编排器 AO 也是 PR 中心而非 Issue 中心（tracker 惰性，issue #112）。**这个空白越早填越有价值**；等生态成熟再接入，就意味着要接受别人的抽象和取舍

第 3 条同时解释了为什么本方案是"自建 + 借鉴"而非"采用现有方案"。

### 1.5 这次变更的性质

> ⚠️ **这不是加一个工具，是改变 agent 的工作方式。**

从"连续流式执行"改为"离散的、带边界的、可评审的单元交付"。这个转变会连带影响：

- **Agent 的上下文管理策略** —— 一会话一 issue，不再跨任务复用上下文
- **Agent 的提示词与契约设计** —— 新增范围外上报、文件变更上报、用量上报
- **人的协作习惯** —— 从"盯着 agent 干活"变成"批准方案 + 评审 PR"

因此落地上**必须小步走**：阶段 0 纯手工验证链路，确认价值后再自动化。**直接上系统，会同时改变工作流和工具，出问题无法归因**——分不清是流程不合理还是实现有 bug。

### 1.6 成功的判据

不是功能清单，是效果：

| 判据  | 说明  |
| --- | --- |
| **评审是真实的** | 平均 PR diff < 400 行，且评审意见中有实质修改建议（而非清一色 LGTM） |
| **反馈闭环自治** | CI 失败自动回流成功率 > 80%，人不再手工搬运日志 |
| **产能可放大** | 并行 3-4 个任务时，人均日合并 PR 数显著高于串行，且质量指标不退化 |
| **上下文不退化** | 长任务（跨多天）中途无"忘记前面做了什么"导致的返工 |

### 1.7 不做的代价

维持现状会发生什么：

- **可用产能被 review 带宽永久封顶** —— agent 写得再快，人消化不了就等于没产出
- **并行无从谈起** —— 一并行就冲突，只能串行，吞吐上不去
- **质量风险持续累积** —— 巨型 PR 的评审是形式化的，问题只能在上线后暴露
- **反馈成本由人承担** —— 人成为 agent 的"上下文搬运工"，这是最昂贵也最不可持续的角色

---

## 2. 需求

### 2.1 目标

让自研研发 agent 产出的代码变更，具备和人类工程师同等的**可管理性**：可拆分、可追踪、可 review、可回滚、可并行。

### 2.2 需求拆解

| 编号  | 需求  | 验收标准 |
| --- | --- | --- |
| **R1** | **任务原子拆分** | 大需求能拆成适合单个 PR 的单元；有显式判据，不是拍脑袋 |
| **R2** | **拆分结果可跟踪** | 拆分产物是带依赖关系的 issue 集合，而非一份 Markdown 计划 |
| **R3** | **上下文边界收敛** | 每个 agent 会话只处理一个 issue，不溢出到无关代码 |
| **R4** | **提交粒度可控** | 一个 issue = 一个 PR；PR 是 review 的最小单元 |
| **R5** | **执行隔离** | N 个任务并行时互不干扰，N 可配置 |
| **R6** | **反馈自动回流** | CI 失败 / review 意见自动回到**产出该 PR 的那个会话**，不新建会话 |
| **R7** | **人类保有权** | 方案批准、PR 合并由人决定；系统不自动 merge |
| **R8** | **可观测** | 全局任务状态、会话状态、PR 事实统一可见 |
| **R9** | **成本与失败可控** | 预算硬上限、stall 检测、重试边界、异常可恢复 |

### 2.3 已确认的前提

| 项   | 结论  | 对设计的影响 |
| --- | --- | --- |
| Agent 形态 | **自研 agent，有内部框架/平台** | 🔴 **决定性影响**：agent 侧契约可由我们定义，不必反向工程黑盒 CLI（见 5.4） |
| 运行环境 | **本地守护进程 + 可选服务端** | 本地优先；观察层需支持服务端常驻（见 5.3 L4） |
| 拆分环节 | **人机协同：agent 出方案，人批准** | 计划批准是一等流程阶段，需要专门的状态与交互（见 5.6） |

### 2.4 非需求（明确不做）

- 不自动合并 PR（R7 的推论）
- 不自建 agent 内核（已有自研 agent，本系统只做编排与管理）
- 不追求跨机器分布式调度（本地优先，服务端可选）
- 不做通用多 agent 适配器（只有一个 agent，不做抽象层）

---

## 3. 遇到的问题

### 3.1 根本矛盾

> **Agent 的执行模型与代码的协作模型不匹配。**

|     | Agent 的执行模型 | 代码的协作模型 |
| --- | --- | --- |
| 时间  | 连续、长上下文 | 离散、原子提交 |
| 边界  | 无内在边界，一路写下去 | 强边界：一个变更一个语义单元 |
| 验收  | 靠跑通测试 | 靠人工 review |
| 并行  | 天然串行（单一上下文流） | 天然并行（多分支） |

Issue / PR / Worktree 是把前者**适配**到后者的三件套。三者分工不同，不能互相替代：

- **Issue** → 定义**上下文边界**（这个会话该知道什么）
- **PR** → 定义**提交与评审粒度**（一次交付的语义单元）
- **Worktree** → 定义**执行隔离**（物理上不打架）

### 3.2 七个具体问题

| #   | 问题  | 后果  |
| --- | --- | --- |
| **P1** | **一次会话干多件事** | 产出包含无关改动的巨型 PR，无法 review，只能整体接受或整体回退 |
| **P2** | **并行即冲突** | 多个任务同时改同一仓库，互相覆盖，丢工作 |
| **P3** | **反馈断裂**（最贵的一个） | CI 挂了要人工搬日志；新起会话没有上下文，同一个问题要反复解释 |
| **P4** | **拆分无判据** | 全靠人拍脑袋，时粗时细；粗了没人 review，细了 PR 泛滥 |
| **P5** | **Agent 顺手改不相干代码** | PR 语义污染，diff 膨胀，review 成本转嫁给人 |
| **P6** | **状态散落** | 状态分散在终端、浏览器标签、PR 页面里，无法全局判断"现在该管哪个" |
| **P7** | **成本与失败失控** | 并行 agent 烧钱是串行的 N 倍；失败重试时更快；无 stall 检测会挂死 |

P3 是最容易被低估的。**多数自研编排系统止步于"能派发、能开 PR"，而真正的价值在"反馈能回到原来那个会话"**——这一条决定了系统是玩具还是生产力工具。

---

## 4. 背景

### 4.1 生态现状（按职责分层）

| 层   | 代表项目 | 成熟度 |
| --- | --- | --- |
| 拆分 / 规格 | `github/spec-kit`（Spec→Plan→Tasks→Issues） | 事实标准，100k+ stars |
| 任务图 / 记忆 | `steveyegge/beads`（依赖图 + ready work + discovered-from） | 设计最 agent-native |
| 编排 / 隔离 | `Untrivial-ai/agent-orchestrator`、`BloopAI/vibe-kanban`、`shard-code`、`danilogr/workstrator` | 多个实现，无统一方案 |
| Agent 内核 | `OpenHands`、`SWE-agent` | 成熟，但与本需求正交（我们已有自研 agent） |

### 4.2 已形成的行业共识

1. **Git worktree 作为隔离机制已成事实标准** —— AO、vibe-kanban、shard、workstrator 全部采用，无一例外。理由：共享同一个 `.git`（省磁盘）、原生分支语义（合并就是 `git merge`）、无需容器运行时。
2. **"一任务一工作区"是不变量** —— 所有实现都遵循
3. **人类必须保留合并决策权** —— 没有主流方案默认自动 merge

### 4.3 尚未解决的问题（我们的机会）

| 未解问题 | 证据  |
| --- | --- |
| **Issue 驱动这条链路没有成熟方案** | AO 的 GitHub tracker 适配器存在，但**无运行时观察循环、无 issue 镜像，运行时什么都不做**（issue #112）。即生态内最完整的编排器也是 **PR 中心而非 Issue 中心** |
| **拆分的原子性判据缺失** | 各项目都做拆分，但没有一个给出可执行的判据和违反时的处置规则 |
| **成本控制普遍缺失** | 仅 `shard-code` 提供 `max_usd` 硬上限；AO、vibe-kanban 均无 |

### 4.4 我们相对现有方案的三个结构性差异

这三个差异决定了我们**不应该**照搬任何现有方案：

1. **Agent 是自研的** → 可以直接定义 agent 侧契约，拿到结构化的活动信号、文件变更、成本数据。AO 需要包装 25 个黑盒 CLI，只能靠每 5 秒进程探活 + 终端抓取，还要处理"失败探测不是死亡证据"这类难题。**我们不需要。**
2. **只有一个 agent** → 不需要多 agent 适配器抽象层，复杂度大幅下降
3. **拆分是人机协同** → 计划批准是一等流程阶段，可以设计得比纯自动方案更可靠

---

## 5. 关键设计

### 5.1 设计原则

| #   | 原则  | 说明  |
| --- | --- | --- |
| **D1** | **不变量优先** | 1 Issue = 1 Worktree = 1 Branch = 1 会话 = 1 PR。任何破坏此不变量的便利性都是技术债 |
| **D2** | **只存事实，派生状态** | 展示状态永不落库，读时计算 |
| **D3** | **观察与行动分离** | OBSERVE → UPDATE(事实) → DERIVE(状态) → ACT |
| **D4** | **至少一次投递** | 反馈宁可重复，不可丢失；消费成功才推进游标 |
| **D5** | **反馈回到原会话** | 绝不新建会话处理旧工作的反馈 |
| **D6** | **人类门禁显式化** | 批准、合并两道门禁是状态机的一等状态，不是配置项 |
| **D7** | **能推送就不探测** | 自研 agent 可主动上报，不要用轮询/探活去猜 |

### 5.2 核心不变量

```
┌──────────────────────────────────────────────────────┐
│  1 Issue = 1 Worktree = 1 Branch = 1 Session = 1 PR  │
└──────────────────────────────────────────────────────┘
```

以及三条派生规则：

- **Issue 的生命周期 = Worktree 的生命周期**（创建↔创建，关闭↔回收）
- **一个 Issue 可以有多个 commit，但只能有一个 PR**
- **一个 PR 的所有反馈，只回流到创建它的那个 Session**

### 5.3 分层架构

```
┌────────────────────────────────────────────────────────────┐
│ L1 拆分与记忆层                                             │
│    需求 → Spec/Plan → 任务图(依赖 + ready work + 验收标准)   │
│    ★ 产出：issue 集合，等待人类批准                          │
├────────────────────────────────────────────────────────────┤
│ L2 派发层                                                   │
│    issue 状态机 + ready-work 计算 + 并发控制 + 冲突预检      │
│    ★ 动作：git worktree add → 创建会话 → 注入上下文          │
├────────────────────────────────────────────────────────────┤
│ L3 执行层                                                   │
│    worktree 内运行自研 agent；agent 通过契约上报活动/变更    │
│    ★ 边界：agent 不得越出 worktree，不得改无关文件           │
├────────────────────────────────────────────────────────────┤
│ L4 观察层（可本地或服务端常驻）                              │
│    轮询 PR / CI / review → 语义 diff → 事实落库             │
│    ★ 单独常驻：笔记本合盖也要能观察到 CI 失败                │
├────────────────────────────────────────────────────────────┤
│ L5 反应层                                                   │
│    事实 → 回流注入原会话 / 通知人类                          │
│    ★ 唯一入口，投射出 CI 失败、review 意见、合并三类反应     │
└────────────────────────────────────────────────────────────┘
         ↕ 控制面：并发 / 预算 / 超时 / stall / GC
```

> **【参考实践 · AO】** 对应 AO 的包结构：`session_manager` / `lifecycle` / `observe/scm` / `observe/reaper` / `adapters`。AO 的 `lifecycle.Manager.ApplySCMObservation` 是**唯一**入口，LCM 绝不直接读 provider API——这个"单一入口 + 绝不越层"的约束我们照搬。
> 
> **【我们的取舍】** AO 的 `observe/reaper` 每 5 秒探测进程存活，并有复杂的"终止护栏"（运行时与进程都死 + 近期无活动 + 无已合并 PR 归属，四条全满足才终止）。**我们不需要 reaper**：自研 agent 主动上报 `activity_state`（原则 D7），比探测更准、更省、更简单。
> 
> **【我们的取舍】** AO 是纯本地守护进程，**笔记本合盖就停止观察**。我们把 L4 设计为可独立常驻于服务端，本地离线时由服务端继续观察并排队，本地上线后同步。

### 5.4 Agent 侧契约（我们的最大红利）

这是相对 AO 的结构性优势，必须用足。AO 要包装 25 个黑盒 CLI，只能靠 tmux/conpty 抓取、ACP 协议、进程探活来**猜** agent 在干什么。我们的 agent 是自研的，可以直接定义契约。

**Agent → 编排层（主动上报，结构化事件）**

| 事件  | 时机  | 载荷  | 用途  |
| --- | --- | --- | --- |
| `session.started` | 会话启动 | session_id, issue_id, worktree_path | 绑定  |
| `activity.changed` | 状态变化 | `active` / `idle` / `waiting_input` / `blocked` | 取代进程探活 |
| `files.touched` | 每次文件写入 | path 列表 | **实时**冲突检测（见 5.8.5） |
| `out_of_scope.found` | 发现范围外问题 | 描述 + 建议 | 自动建 issue（见 5.8.4） |
| `usage.reported` | 周期性 | tokens, cost_usd | **原生**成本护栏（见 5.8.7） |
| `work.completed` | 完成  | PR url, 变更摘要, 自审结果 | 触发 PR 关联 |
| `approval.requested` | 需要人决策 | 决策项 + 选项 | 人类门禁 |

**编排层 → Agent（指令）**

| 指令  | 用途  |
| --- | --- |
| `inject.feedback` | 注入 CI 失败日志 / review 意见（回流核心） |
| `request.replan` | 要求重新规划（diff 超阈值时） |
| `abort` | 中止（超时 / 超预算） |

> **【参考实践 · AO】** AO 的 `activity_state` 有五个值，其中 `blocked`（agent 停在权限审批上）有一条硬规则：**自动化绝不能向 blocked 会话注入输入**。我们保留这条——`inject.feedback` 遇到 `blocked` 必须排队等待，不能强注。
> 
> **【参考实践 · AO】** AO 明确拒绝把终端滚动缓冲重构为消息，理由是"arbitrary terminal bytes are redraw artifacts, not canonical provider events"。这条判断很对，也是我们从一开始就走结构化事件而非日志解析的原因。

### 5.5 数据模型

**只存持久事实**（原则 D2）。派生状态读时计算。

```sql
-- 任务图节点（L1）
issue (
  id TEXT PRIMARY KEY,          -- hash ID，抗并发创建冲突
  title, body, acceptance,      -- 验收标准
  state,                        -- draft|planned|approved|in_progress|pr_open|closed
  parent_id,                    -- 层级
  files_owned TEXT,             -- 预期改动的文件/目录，JSON 数组
  budget_usd REAL,
  cost_usd REAL, retry_count INT,
  session_id, pr_node_id        -- 绑定
)

-- 依赖关系（L1）
issue_dep (
  from_id, to_id,
  type                          -- blocks | parent-child | related | discovered-from
)

-- 会话（L3）
session (
  id, issue_id, worktree_path, branch,
  activity_state,               -- active|idle|waiting_input|blocked|exited
  is_terminated INT,
  started_at, last_activity_at
)

-- PR 事实（L4 观察所得，非 agent 上报）
pr_fact (
  pr_node_id,                   -- provider node ID，非 owner/repo#number
  issue_id,
  checks_state, checks_hash,    -- 语义哈希，作为 ack 游标
  review_hash, mergeable,
  observed_at
)
```

**派生（不落库）**：`working` / `needs_input` / `ci_failed` / `ready_to_merge` / `blocked_by`

> **【参考实践 · beads】** `id` 用 hash（如 `bd-a1b2`）而非自增序号——多分支并发创建时不冲突。四种依赖类型中 `discovered-from` 是关键（见 5.8.4）。
> 
> **【参考实践 · AO】** PR 身份用 `(provider, host, provider_id)`，因为 **provider 的 node ID 能扛住仓库改名和组织转移，而仓库名/PR 号/URL 只是可变的展示坐标**。AO 因仓库改名（`AgentWrapper` → `Untrivial-ai`）踩过坑，专门做了 #4090 重构。**我们从第一天就用 `pr_node_id` 做主键。**
> 
> **【参考实践 · AO】** 展示状态永不落库。这是 AO 整个系统可靠性的地基——重启、并发写、事件乱序都不会导致状态错乱。D2 直接照搬。

### 5.6 状态机

**Issue 状态机（含人类批准门禁）**

```
                  ┌─ 人否决 ─┐
                  │          ↓
draft ──规划──> planned ──人批准──> approved ──派发──> in_progress
                  ↑                                       │
                  └────────── 要求重新规划 ────────────────┤
                                                          ↓
                                                      pr_open
                                                          │
                    ┌─────────────────────────────────────┤
                    ↓                                     ↓
              ci_failed /                          approved_and_green
              changes_requested                           │
                    │                                     ↓ 人合并
                    └──回流到原会话──> in_progress      merged → closed
```

**Session 状态机**

```
spawning ──> active ──┬──> idle ────────┐
                      ├──> waiting_input│──> exited ──> terminated
                      ├──> blocked      │
                      └──> exited ──────┘
```

**终止护栏**（只有全部满足才终止，防止误杀）：

```
会话无活跃进程 AND agent 上报 exited AND 近期无活动 AND 无未合并 PR 归属
```

> **【参考实践 · workstrator】** 用两个 label 驱动整个状态机：`plan-approved`（批准，触发实施）和 `agent-waiting`（等待人类，人类回复后自动摘除并重新激活）。极简且被验证有效。我们用正式状态机替代 label，但**保留"人类介入后自动重新激活"这个语义**。
> 
> **【参考实践 · AO】** 终止护栏四条件全满足才终止，核心原则"**失败的探测不是死亡的证据**"。我们保留四条件结构，但把"运行时 AND 进程都死"换成"agent 上报 exited"（D7：能推送就不探测）。

### 5.7 核心流程

**派发（L2）**

```
1. 取 ready issue（无 open blocker、状态 approved）
2. 冲突预检：files_owned 与所有 in_progress issue 求交集 → 非空则排队
3. git worktree add .worktrees/<issue-id> -b feat/<issue-id> origin/main
4. 在 worktree 内启动 agent 会话，注入 issue 上下文 + AGENTS.md
5. issue.state = in_progress，绑定 session_id
```

> **【参考实践 · AO】** spawn 流程：校验配置 → 预检 → 建会话行（发 CDC 事件）→ **建 worktree** → 启动运行时 → 启动 agent → 标记 spawned。顺序完全一致，我们照搬。

**回流（L5，系统最核心的价值）**

```
1. L4 观察到 PR 事实变化（CI 失败 / 新 review 意见）
2. 语义哈希比对，确认是新变化 → 落库
3. 反应层投射：CI 失败 → 取失败日志；review 意见 → 取评论
4. ★ 通过 issue.pr_node_id → session_id 找到原会话
5. 若原会话仍存活 → inject.feedback 到该 worktree 的 agent
   若原会话已终止 → 用同一 worktree 恢复会话（保留上下文与中间 commit）
6. 成功后才推进 ack 游标
```

⚠️ **第 5 步的两个分支是设计关键**：worktree 必须保留到 PR 合并后一段时间，否则反馈回来时物理上下文已经没了，只能新建会话——那就退化成了 P3。

> **【参考实践 · AO】** 语义哈希作为观察器的 ack 游标：元数据/CI/review 哈希**只有在 lifecycle 成功消费后才推进**——守护进程在消费失败后重启，会重新投递同一次观察。这是**至少一次投递**的经典实现，D4 直接照搬。
> 
> **【参考实践 · AO】** 五条持久化不变式中还有两条值得抄：① ETag/游标永不越过未持久化的观察，单个 ref 失败会钉住整个仓库游标；② `Fetched=false` 占位（携带限流冷却等错误）是**路由元数据，绝不进存储**。
> 
> **【参考实践 · workstrator】** Reviewer 在 PR 有新 commit 时**只审 delta**，不全量重审。控制成本，我们照搬。

### 5.8 关键机制

#### 5.8.1 原子拆分判据（解决 P4）

一个 issue 可放心派发，当且仅当**全部**满足：

| #   | 判据  | 违反时的处置 |
| --- | --- | --- |
| 1   | 单一可验证结果（一条测试/验收标准可判定） | 继续拆 |
| 2   | 预期 diff 在 200-400 行（人类 review 注意力上限） | 继续拆 |
| 3   | **可独立合并进主干而不 break**（硬约束） | 不可分割 → 用 stacked PR 或 feature flag |
| 4   | 改动文件集合与在跑任务交集为空 | **排队，不要并行** |
| 5   | 上下文自足（凭 issue + AGENTS.md 可开工） | 退回 Planner 补描述，不要让 agent 硬做 |
| 6   | 单次会话可完成（含跑测试） | 继续拆 |

**反过来也要防"拆太碎"**：过度原子化会导致 PR 泛滥、跨 PR 一致性崩塌（改一个接口签名的 50 处调用方）。判据 3 是这条的防线。

**三层粒度分开定义**（关键）：

| 层   | 对应物 | 规模  |
| --- | --- | --- |
| Epic | 里程碑 | 1-2 周 |
| **Issue** | **一个 PR** | diff 200-400 行 |
| **Task** | **一个 commit** | agent 的一次执行步骤 |

**不要把 issue 和 commit 的粒度绑死**——PR 内部保留 agent 的中间 commit（利于 debug 与回溯思路），对主干 squash merge（保持"一个 issue 一个 commit"的干净历史）。

#### 5.8.2 Worktree 生命周期

```bash
# 创建：从最新主干切，不从当前分支切
git worktree add .worktrees/<issue-id> -b feat/<issue-id> origin/main

# 复用（最重要）：反馈回来时回到同一 worktree
# agent 的会话历史、中间 commit、未完成的理解都还在

# 回收：PR 合并后延迟清理（建议 7 天），留出 revert 与补充的窗口
git worktree remove .worktrees/<issue-id> && git branch -d feat/<issue-id>
```

三条硬性要求：

- **`.worktrees/` 必须进 `.gitignore`**，否则 agent 会把整个工作区 add 进去
- **必须有 GC** —— worktree 泄漏是这类系统最常见的运维事故
- **绝不强制删除脏 worktree**（有未提交改动时）—— 用户数据安全优先于清理便利

#### 5.8.3 提交粒度

- PR 内部保留中间 commit；PR → 主干 **squash merge**
- commit message 强制 **Conventional Commits + 关联 issue 号**：`feat(auth): add JWT refresh (#123)`
- 这是后续 changelog 生成、bisect、贡献统计的基础设施，**一开始就要立规矩，事后补不回来**

#### 5.8.4 范围外工作处置（解决 P5，最重要的一条机制）

Agent 执行中发现不属于本 issue 的问题时：

```
❌ 顺手改了        → PR 膨胀、语义污染、上下文撑爆
✅ 建新 issue + discovered-from 依赖连回 → PR 纯净，上下文不溢出
```

**这条必须由 agent 侧契约强制执行**（`out_of_scope.found` 事件），不能只靠 prompt 约束——只靠 prompt 的行为不可靠。

> **【参考实践 · beads】** `discovered-from` 依赖类型的设计初衷正是如此：agent"不会再因为上下文不够而默默跳过它注意到的问题"，而是自动建档，把长期记忆外部化。这是防止 PR 膨胀与上下文膨胀的核心机制。

#### 5.8.5 冲突预防（解决 P2）

静态预检 + 实时监控双重：

- **静态**：Planner 拆分时为每个 issue 声明 `files_owned`，派发前与所有 in_progress issue 求交集，非空则排队
- **实时**：agent 通过 `files.touched` 上报实际改动，越界时告警或阻断

> **【参考实践 · shard-code】** Planner 给每个子任务分配 **exclusive file ownership**。静态预防比事后合并便宜得多，能把绝大多数合并冲突消灭在派发之前。
> 
> **【我们更强的地方】** shard 只能静态预声明（Planner 猜的）；我们有自研 agent 的 `files.touched` 实时上报，可以做**动态**冲突检测。这是自研 agent 带来的额外红利。

#### 5.8.6 并发控制

| 项   | 建议值 | 依据  |
| --- | --- | --- |
| 默认并发 | **3-4** | 社区实测 4 是甜点，超过后 CPU/内存争用导致收益递减 |
| 硬上限 | 6   | 且受**人的 review 带宽**约束，而非硬件 |
| L4 轮询 | 30-60s | 避开 GitHub GraphQL 5000 次/小时限流 |

**最容易被低估的约束是人的 review 带宽**：agent 5 分钟产一个 PR，人 review 一个要 15 分钟。并行度超过 review 带宽，系统就开始生产无法消化的技术债。

#### 5.8.7 成本与失败护栏（解决 P7）

| 护栏  | 建议值 | 实现  |
| --- | --- | --- |
| 单 issue 预算 | 默认 $2，可按任务覆盖 | `usage.reported` 累计，超限 abort |
| 单日总额 | 团队定 | 超限暂停派发 |
| 单会话超时 | 30-60 分钟 | abort |
| stall 检测 | 无活动 5 分钟告警 / 10 分钟 kill | `last_activity_at` |
| 重试上限 | 单 issue 3 次 | 状态机计数 |

> **【参考实践 · shard-code】** 生态里唯一提供硬上限的实现：`max_usd`（硬上限，超限直接 abort）、`warn_usd`（告警阈值）、`output_stall_s=120`、`commit_stall_s=300`。
> 
> **【我们更强的地方】** AO、vibe-kanban 均无成本控制；shard 靠外部估算。我们由自研 agent 原生上报 `usage`，数字是精确的而非估算的。

---

## 6. 推荐方案

### 6.1 技术选型

| 组件  | 选型  | 理由  |
| --- | --- | --- |
| 编排层语言 | **Go** | 长驻守护进程、原生并发、单二进制分发。AO 从 TypeScript 重写为 Go 正是这个原因 |
| 本地存储 | **SQLite + CDC** | 本地优先事实标准（AO、beads、vibe-kanban 均用）。CDC 用 DB trigger → `change_log` → SSE 扇出 |
| 隔离  | **Git worktree** | 生态共识，无争议 |
| 任务图存储 | SQLite + 可选 git-JSONL 同步 | 本地快，跨机同步走 git（beads 的做法） |
| 观察层 | 可独立部署的服务端进程 | 解决本地离线时观察中断 |
| 前端  | **先 CLI + TUI，Web 看板后置** | 早期状态维度少，看板收益不抵成本；跑通后再加 |
| Agent 对接 | 直接内部契约，不做适配器抽象 | 只有一个 agent，抽象层是纯负债 |

### 6.2 分阶段落地

**阶段 0 · 单链路手工跑通（3-5 天）**

不做自动化，纯手工验证链路与假设：

```bash
bd init
bd create "实现 X" -p 1
git worktree add .worktrees/bd-a1b2 -b feat/bd-a1b2 origin/main
cd .worktrees/bd-a1b2 && <启动 agent，注入 issue 上下文>
gh pr create --fill
# 人为制造 CI 失败 → 观察 → 手工把日志喂回同一 worktree 的会话
```

**验收（缺一不可）**：

- [ ] worktree 隔离生效，主工作副本无改动
- [ ] agent 在 worktree 内完成工作并开 PR
- [ ] **人为制造 CI 失败，把日志喂回原会话，agent 能修复** ← 决定方案价值的那一项
- [ ] 人为提 review 意见，同样能回流

**阶段 1 · 自动化派发与回流（2-3 周）**

- 编排层：issue 状态机 + worktree 生命周期 + 会话管理
- Agent 侧契约：`activity.changed` / `files.touched` / `work.completed`
- L4 观察器（PR/CI/review 轮询 + 语义哈希）
- L5 反应引擎（CI 失败注入、review 注入）
- CLI：`status` / `spawn` / `send` / `kill` / `gc`

**阶段 2 · 任务图与并行（2-3 周）**

- 拆分流程接入（spec-kit 的 Spec→Plan→Tasks→Issues，或自研）
- 依赖图 + ready work + `discovered-from` 自动建档
- 并发控制 + 文件所有权冲突预检
- 成本护栏（预算 / 超时 / stall / 重试）

**阶段 3 · 加固与扩量（持续）**

- 观察层服务端常驻
- Web 看板
- GC 策略、审计日志、指标

### 6.3 与 AO 实践的详细对照（取舍理由）

| 设计点 | AO 的做法 | 我们的取舍 | 理由  |
| --- | --- | --- | --- |
| **架构范式** | OBSERVE → UPDATE(事实) → DERIVE(状态) | ✅ **照搬** | 展示状态不落库是可靠性的地基 |
| **CRUD 边界** | `ApplySCMObservation` 单一入口，LCM 绝不读 provider API | ✅ **照搬** | 单一入口让反应逻辑可测试、可重放 |
| **至少一次投递** | 语义哈希作 ack 游标，消费成功才推进 | ✅ **照搬** | 反馈宁可重复不可丢失 |
| **PR 身份** | `(provider, host, provider_id)` node ID | ✅ **照搬** | 抗仓库改名/转移；AO 为此做过 #4090 重构 |
| **Worktree 安全** | 绝不强制删除脏 worktree | ✅ **照搬** | 用户数据安全优先于清理便利 |
| **Blocked 语义** | `blocked` 会话绝不允许自动化注入 | ✅ **照搬** | 权限审批必须由人处理 |
| **观察不变式** | ETag 不越过未持久化观察；`Fetched=false` 不进存储 | ✅ **照搬** | 防止限流/失败导致更新永久丢失 |
| **会话存活判定** | Reaper 每 5s 探测进程 + 四条件终止护栏 | ❌ **不采用**，改为 agent 上报 | 自研 agent 可主动上报，比探测更准更省（D7） |
| **多 agent 适配** | 25 个适配器 + TUI/Chat 双模式 + 生成纪元隔离 | ❌ **不采用** | 只有一个自研 agent，抽象层是纯负债 |
| **运行形态** | 纯本地守护进程 | ⚠️ **改造** | 观察层可服务端常驻，解决合盖即失联 |
| **Issue 驱动** | tracker 惰性，运行时什么都不做（#112） | ⚠️ **反向设计** | 我们把 issue 作为调度输入的一等公民，不是 PR 的附属 |
| **成本控制** | 无   | ➕ **新增** | 由 agent 原生上报 `usage`，精确而非估算 |
| **拆分判据** | 无   | ➕ **新增** | 6 条判据 + 违反处置规则 |
| **冲突检测** | 无   | ➕ **新增** | 静态 `files_owned` + 动态 `files.touched` 双重 |

**一句话总结取舍：AO 在"观察与反馈"上的工程严谨性全部照搬；它在"兼容异构 agent"上的复杂度我们一概不负担；它在"issue 驱动"和"成本控制"上的缺失我们补上。**

---

## 7. 风险

| #   | 风险  | 严重度 | 缓解  |
| --- | --- | --- | --- |
| **1** | **Review 负担转移** —— 瓶颈从写代码变成 review 代码，并行度上去后人成为唯一瓶颈 | 🔴 高 | 并发默认 3-4 且与 review 带宽挂钩；diff 超 400 行强制拆分；阶段 0-1 不要急着开并行 |
| **2** | **回流失效** —— worktree 提前回收 / 会话绑定丢失，导致反馈只能新建会话，退化成 P3 | 🔴 高 | worktree 保留至 PR 合并后 7 天；`pr_node_id → session_id` 绑定持久化；回流前校验 worktree 存在 |
| **3** | **Worktree 泄漏** —— 异常退出、PR 关闭时未清理 | 🟠 中高 | 强制 GC 定时任务 + 启动自检；但**绝不强制删除脏 worktree**，改为告警由人处理 |
| **4** | **拆太碎的反弹** —— PR 泛滥、跨 PR 一致性崩塌 | 🟠 中高 | 判据 3（可独立合并）必须卡死；大重构允许 stacked PR 或 feature flag |
| **5** | **成本失控** —— 并行烧钱是串行的 N 倍，重试时更快 | 🟠 中高 | 五道护栏缺一不可；预算是派发前置校验而非事后统计 |
| **6** | **Agent 侧契约腐化** —— 契约一旦被绕过（如 agent 直接改文件不报 `files.touched`），冲突检测与成本统计同时失效 | 🟠 中高 | 契约写入 agent 框架层而非业务层；对 `files.touched` 与 `git status` 做一致性校验，不一致即告警 |
| **7** | **Spec 漂移** —— 过时的 spec 会误导 agent，比过时设计文档更危险（agent 会自信执行且不质疑） | 🟡 中 | spec 拆小、按子系统分文件；把"发现 spec 与代码不符"纳入 `out_of_scope.found` 上报 |
| **8** | **依赖安装成本** —— 每个 worktree 都要装一遍依赖 | 🟡 中 | pnpm 全局 store + symlink；setup 脚本并行跑 |
| **9** | **观察层限流** —— GitHub GraphQL 5000 次/小时 | 🟡 中 | 轮询 30-60s；ETag 增量；单 ref 失败钉住整个仓库游标（AO 不变式） |
| **10** | **过度设计** —— 早期就上任务图、看板、服务端 | 🟡 中 | 严格按阶段推进；阶段 0 不写任何自动化代码 |

---

## 8. 最小闭环

### 8.1 范围

**不做**自动拆分、**不做**依赖图、**不做**并行、**不做**看板。只跑通一条链路：

> 人建一个 issue → 派发到隔离 worktree → agent 实现并开 PR → CI 失败自动回流到原会话 → 人合并

### 8.2 组件清单（约 800-1200 行）

| 组件  | 行数  | 说明  |
| --- | --- | --- |
| `issue store` | ~150 | SQLite + issue/session/pr_fact 三张表 |
| `worktree manager` | ~150 | add / remove / gc，含脏检测 |
| `dispatcher` | ~200 | 状态机 + 派发 + 轮询 ready issue |
| `observer` | ~250 | PR/CI/review 轮询 + 语义哈希（可先只做 GitHub） |
| `reactor` | ~150 | 事实 → 注入原会话 |
| `cli` | ~150 | status / spawn / send / kill / gc |
| **agent 侧契约** | ~100 | 事件上报与指令接收（增量改造自研 agent） |

### 8.3 目录约定

```
repo/
├── .worktrees/               # gitignore，一 issue 一目录
├── .agent/
│   ├── state.db              # SQLite 事实库
│   ├── prompts/              # planner / worker / reviewer 提示词
│   └── logs/
└── AGENTS.md                 # 硬规则
```

### 8.4 `AGENTS.md` 三条硬规则（杠杆最高的一项投入）

```markdown
1. 发现不属于本 issue 的问题 → 上报 out_of_scope.found，建档新 issue
   并挂 discovered-from 依赖，不许顺手改。

2. 单个 issue 的 diff 超过 400 行 → 停下报告，请求拆分。

3. commit message 必须 Conventional Commits + 关联 issue 号。
```

### 8.5 验收指标

> 与 1.6「成功的判据」的区别：**1.6 是长期效果判据**（这件事最终做成了没有），**本节是最小闭环的功能验收**（MVP 能不能跑）。MVP 达标 ≠ 目的达成，但 MVP 不达标则一定没达成。

最小闭环上线后连续跑满 2 周统计：

| 指标  | 目标  |
| --- | --- |
| 无需人工干预完成闭环（issue → merged PR）占比 | > 40% |
| **CI 失败自动回流成功率** | **> 80%** |
| 平均 PR diff 行数 | < 400 |
| worktree 泄漏数 | 0   |
| 单 issue 平均成本 | 在预算内 |

**如果"CI 失败自动回流成功率"不达标，先不要扩量。** 这说明 `AGENTS.md` 约束或 issue 描述质量有问题，扩量只会放大损失。

---

## 9. 参考

### 9.1 核心参考实践

| 项目  | 我们借鉴的具体实践 | 用在  |
| --- | --- | --- |
| **[Untrivial-ai/agent-orchestrator](https://github.com/Untrivial-ai/agent-orchestrator)** | ① OBSERVE→UPDATE→DERIVE，展示状态永不落库<br>② `ApplySCMObservation` 单一入口<br>③ 语义哈希作 ack 游标（至少一次投递）<br>④ PR 身份用 provider node ID（#4090）<br>⑤ 五条持久化不变式<br>⑥ 终止护栏"失败探测不是死亡证据"<br>⑦ 绝不强制删除脏 worktree<br>⑧ blocked 会话禁止自动注入 | 5.1 / 5.3 / 5.5 / 5.7 / 5.8.2 |
| **[steveyegge/beads](https://github.com/steveyegge/beads)** | ① hash ID 抗并发冲突<br>② 四种依赖类型，尤其 `discovered-from`<br>③ `ready` 自动算无 blocker 的就绪任务<br>④ JSONL 存 git + SQLite 本地缓存<br>⑤ compaction（语义记忆衰减） | 5.5 / 5.8.4 |
| **[shard-code](https://pypi.org/project/shard-code/)** | ① exclusive file ownership 静态防冲突<br>② `max_usd` / `warn_usd` 硬成本上限<br>③ stall 检测（`output_stall_s` / `commit_stall_s`）<br>④ 拓扑序合并 + 结构性冲突自动解决 | 5.8.5 / 5.8.7 |
| **[danilogr/workstrator](https://github.com/danilogr/workstrator)** | ① 两 label 状态机（`plan-approved` / `agent-waiting`）<br>② Planner 只读可并发、Worker 可写单实例（读写不同隔离级别）<br>③ Reviewer 只审 delta<br>④ Epic 自动拆 sub-issues 串行执行 | 5.6 / 5.7 |
| **[github/spec-kit](https://github.com/github/spec-kit)** | ① `Spec → Plan → Tasks → Issues` 四阶段<br>② `/speckit.taskstoissues` 任务转 issue<br>③ constitution.md 固化不可协商的技术决策 | 阶段 2 |
| **[BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)** | ① worktree 隔离的生产级实现<br>② 内置 diff review<br>③ 暴露 MCP server 让 agent 反向创建任务 | 阶段 3 看板参考 |

### 9.2 AO 关键源码入口（实现时对照阅读）

| 关注点 | 路径  |
| --- | --- |
| 生命周期反应（回流核心） | `backend/internal/lifecycle/reactions.go` |
| SCM 观察器 | `backend/internal/observe/scm/observer.go` |
| 端口契约 | `backend/internal/ports/` |
| Worktree 适配器 | `backend/internal/adapters/workspace/` |
| 架构与十条承重规则 | `docs/architecture.md` |
| 观察器五条不变式 | `docs/scm-observer.md` |
| 已实现 / 在研清单 | `docs/STATUS.md` |

### 9.3 待跟踪

| Issue | 内容  | 为何关注 |
| --- | --- | --- |
| [AO #112](https://github.com/aoagents/agent-orchestrator/issues/112) | Tracker lane：观察循环 + issue 镜像 | 生态内 issue 驱动方案成熟度的风向标 |

---

## 附：与前一版文档的差异

前一版（`agent-orchestrator-方案文档.md`）把 AO 作为底座设计，本文档改用 AO 作为参考实践。核心变化：

1. **主线改为自建系统的设计**，AO 等降为 `【参考实践】` 引用
2. **新增 5.4 Agent 侧契约** —— 自研 agent 带来的最大红利，AO 因包装黑盒 CLI 而无法享有
3. **去掉 reaper / 多 agent 适配器 / TUI-Chat 双模式** —— 我们的场景不需要
4. **观察层改为可服务端常驻** —— 修正 AO 本地进程合盖即失联的问题
5. **强化原子拆分判据与成本控制** —— AO 均无，借鉴 shard-code 补齐

### v1.1 变更（2026-09-02）

6. **新增第 1 章「初衷与目的」** —— 补充本次变更的动因、目标、时机与成功判据，
  回答"为什么要做这件事"而非仅"要做什么"。全文后续章节顺延编号，交叉引用已同步更新。
