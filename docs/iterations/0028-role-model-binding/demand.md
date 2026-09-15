# demand.md — 0028-role-model-binding

**版本**: 1.0.0
**迭代**: 0028-role-model-binding
**日期**: 2026-09-15
**阶段**: 1（需求收敛，主 agent 内联执行）
**澄清依据**: `clarifications/round-1-kickoff.md`、`round-2-verification-and-execution.md`、`round-3-probe-and-equivalence.md`、`round-4-final-boundaries.md`
**变更历史**: 初稿（本文件）

---

## 第一段 · 澄清依据

### 一、实测事实（2026-09-15 20:41，一次性路径）

| 后端 | 命令 | 观测结果 |
|---|---|---|
| deepseek（默认） | `omp -p --no-session --model deepseek/deepseek-v4-flash:high "只回复: OK"` | `OK`（2.3s） |
| gpt | `omp -p --no-session --model openai/gpt-5.6-luna "只回复: OK"` | `OK`（5.1s） |
| grok | `omp -p --no-session --model powerby/grok-4.6 "只回复: OK"` | `OK`（3.7s） |

⇒ 用户预期"omp 支持 deepseek（默认）、gpt、grok"在一次性路径上**成立**；常驻路径（集群节点实际使用的 `omp-daemon`）按 D-8 纳入本次验收。

### 二、代码与接口事实（作为方案依据，均为可复核的一手事实）

| 事实 | 证据位置 |
|---|---|
| 角色级模型字段已存在且已文档化 | `oamp/README.md` §集群（`cluster.json` 字段表 `model` 行）；`src/cluster-config.js:148-150`（校验）；`src/cluster.js:200-201`（注入 `--model` argv） |
| 模型解析链 | `src/agent.js:192`（一次性路径）、`src/agent.js:346`（常驻路径）：`payload.model > OAMP_OMP_MODEL > --model(角色级) > config 默认 > 内置` |
| 取证面 = 执行侧实报 | `API.md`：`calls get` 的 `model` 为执行侧**实报**生效模型（非请求回显）；`src/acp-client.js:69-78` 取 ACP `currentValue` |
| 现状：`cluster.json` 无任何 `model` 字段 | 仓库根 `cluster.json` 的 `roles` 段 |
| 建 chat 无独立端点 | 对话创建只发生在 `POST /api/messages`（新建必带 `project_id`，`API.md:153/457`）；`calls create` 强制要求已存在 `chat_id`（`API.md:702`） |
| 第二集群天然独立 | 默认 UDS socket 与集群日志按**包根**推导（`src/config.js:144`、`src/cluster.js` PKG_ROOT 基准） |

### 三、决策清单（D-1 ~ D-21，逐条标注来源）

| # | 决策点 | 结论 | 来源 |
|---|---|---|---|
| D-1 | 迭代 ID | `0028-role-model-binding` | `user_confirmed` |
| D-2 | 方案确认门 | `enabled`（阶段 3→4 之间暂停呈现完整方案） | `user_confirmed` |
| D-3 | 迭代范围 | 最小闭环 = 角色级模型绑定 + 端到端实证 + 差距记录 | `user_confirmed` |
| D-4 | 绑定清单 | `dev` = `openai/gpt-5.6-luna`；`verifier` = `powerby/grok-4.6`；其余 8 角色沿用全局默认（不写入 `cluster.json`） | `user_confirmed` |
| D-5 | 模型真源 | 角色级 `cluster.json` 为唯一真源；hub 派发**不带** `model` | `user_confirmed` |
| D-6 | chat 粒度 | 单一 chat 覆盖阶段 2~6；demand 阶段留在会话内、不落 chat | `user_confirmed` |
| D-7 | 差距记录载体 | 并入 `docs/iterations/0028-role-model-binding/deferred-demand-changes.md` | `user_confirmed` |
| D-8 | 前置验证强度 | 双路径：一次性（`omp -p`）+ 常驻（`omp-daemon`）各一次 | `user_confirmed` |
| D-9 | 探针证据落盘 | 不单独建探针文件；证据随接收它的 PR 验收树落盘 | `user_confirmed` |
| D-10 | 等价性判据 | `call_id` + 终态信封 + 转录可拼回全文；无需人工搬运中间产物即可继续 | `user_confirmed` |
| D-11 | 差距记录格式 | 同一文件内二级标题分区 + 四要素（现象 / 差异 / 证据 / 影响） | `user_confirmed` |
| D-12 | 对照组证据 | dev + verifier 各一次，另抽 1 个未绑定角色作对照 | `user_confirmed` |
| D-13 | 实证集群 | 迭代工作区起第二集群（独立 session + 非默认端口 + 独立 socket），不动主工作区集群 | `user_confirmed` |
| D-14 | 前置常驻探针通道 | 开一条只用于探针的 per-call `model` 例外，探针后关闭并记入差距记录 | `user_confirmed` |
| D-15 | 常驻探针范围 | 仅 gpt 与 grok 两个后端 | `user_confirmed` |
| D-16 | 转录截断判定 | 算等价性缺口，逐次记入差距记录（同类现象可聚合） | `user_confirmed` |
| D-17 | 判据覆盖范围 | 阶段 2~6 全部角色派发 | `user_confirmed` |
| D-18 | 并发等价 | 纳入：阶段 5 首次派发时显式取证 | `user_confirmed` |
| D-19 | 第二集群形态 | 全 10 角色（完整启动路径） | `user_confirmed` |
| D-20 | 收口后生效 | 合入 main 后由主 agent 重启主工作区集群并留实报证据 | `user_confirmed` |
| D-21 | 探针的 chat 归属 | 探针建立本次迭代唯一 chat，阶段 2~6 续用同一 `chat_id` | `user_confirmed` |
| D-22 | 对照组角色选谁 | `pb-prd`（阶段 2 首次派发即兼作对照取证） | `user_confirmed`（2026-09-15 20:53 交付确认） |

### 四、澄清过程中发现的冲突（全部作为差距记录条目）

| # | 冲突 | 处置 |
|---|---|---|
| C-1 | `~/.omp/agent/config.yml` 的默认 id `deepseek/deepseek-v4-flash` 在 `~/.omp/agent/models.yml` 里不存在同名 id（那里是 `deepseek-v4.1-flash`），靠 fuzzy match 才解析成功 | 记录，不在本次迭代修（属 omp 环境配置面） |
| C-2 | 前置常驻验证（D-8）与真源唯一性（D-5）机制互斥 | 已由 D-14 以范围最窄的例外消解，例外本身记入差距记录 |
| C-3 | 建 chat 无独立端点 ⇒ 单一 chat 只能由首条真实调用建立 | 已由 D-21 消解（探针建 chat） |
| C-4 | 主工作区集群跑的是主工作区代码与配置，而迭代改动只在 PR worktree / 迭代分支可见 | 已由 D-13（第二集群）+ D-20（收口后重启主集群）消解 |

---

## 第二段 · 需求结论

### 做什么

1. **前置后端验证**：omp 三后端可用性验证。一次性路径（deepseek / gpt / grok）已完成实测；补 gpt 与 grok 的**常驻路径**探针。
2. **角色级模型绑定**：在 `cluster.json` 写入 `roles.dev.model = "openai/gpt-5.6-luna"`、`roles.verifier.model = "powerby/grok-4.6"`（其余角色不动）。
3. **端到端实证**：在迭代工作区起第二集群（全 10 角色），用实报 `model` 字段证明"dev 实跑 gpt、verifier 实跑 grok、对照组角色实跑默认"。
4. **生效收口**：迭代分支合入 main 后，重启主工作区集群并各留一条实报证据。
5. **执行方式（本次迭代的过程要求）**：阶段 2~6 全部经 hub 派发到 oamp `pb-<role>` 节点、全程单一 chat、并逐条记录执行方式差距。

### 不做什么（每条附"为什么这次不做"）

- **不做运行中动态切换角色模型**——需要先定义常驻上下文池的建键轮与模型切换语义，是独立架构议题，与"启动时指定"的表述无关。
- **不做 web 控制台模型选择 UI**——需同时改 API 面与前端，与需求表述无关。
- **不做非 omp 后端可插拔抽象**——当前没有需求来源。
- **不做集群启动期的模型存在性预检**——超出最小闭环；模型 id 写错的后果由调用侧实报 `model` 暴露，记入差距记录即可。
- **不改 per-call `model` 的既有语义**——只按 D-14 开一条探针专用例外，正式角色派发永不带 `model`。
- **不把其余 8 角色写进 `cluster.json`**——按 D-4 保持隐式默认，用 D-12 的对照组抽样验证"沿用默认"这条断言。
- **不清理 0027 现场**——规则 G（暂停/终止迭代的现场保留）。
- **不把"多轮上下文连续"纳入本次等价性判据**——D-10 判据止于三条信号，超出部分会牵出常驻会话语义。

### 大概怎么做（用户已确认的机制，技术选型留给架构阶段）

- **绑定落点**：仓库根 `cluster.json` 的 `roles.dev.model` / `roles.verifier.model` 两个字段。
- **生效链路（既有、不改）**：`cluster-config.js` 校验 → `cluster.js:200` 注入 `--model` → agent 侧解析链 `payload.model > OAMP_OMP_MODEL > --model(角色级) > config 默认 > 内置`。
- **取证面**：`hub api calls get <call_id>` 的 `model` 字段（执行侧实报）+ 终态信封 + `calls transcript`。
- **第二集群**：迭代工作区内的集群配置副本（独立 `session` 名 + 非默认 web 端口 + 默认 socket 自动独立于主集群）。
- **探针**：经 hub 派发、携带 per-call `model`（仅探针期），探针结束即关闭该通道。
- **收口**：迭代分支 merge 进 main → 重启主工作区集群 → 各留一条实报证据。

### 达到什么效果（每条均可裸判定）

1. PR 验收证据里存在 **3 条一次性探针回执**（deepseek / gpt / grok 各一）与 **2 条常驻探针回执**（gpt / grok 各一），每条含命令与输出。
2. 第二集群启动后，同一 chat 内：`pb-dev` 的调用终态 `model` 显示 gpt 系模型、`pb-verifier` 显示 grok 系模型、对照组角色显示 deepseek 系模型。
3. 阶段 2~6 的全部 hub 调用归属**同一个 `chat_id`**（`status.md` 记录的 chat_id 与各调用可读字段一致）。
4. 收口后主工作区集群内，`pb-dev` 与 `pb-verifier` 各有一条实报 gpt / grok 的调用终态。
5. `docs/iterations/0028-role-model-binding/deferred-demand-changes.md` 中存在"执行方式差距"分区，每条含 现象 / 差异 / 证据 / 影响 四要素。
6. 差距记录中至少收录 C-1 ~ C-4 四条澄清期冲突（或说明其不成立的理由）。

### 为什么

- **dev 需要强推理后端**：实现质量直接影响 PR 返工率，把最强推理能力放在实现角色上收益最高。
- **verify 需要与 dev 不同源**：验证角色若与实现角色同模型，其"独立验证"会退化为同源自证，异源是独立视角成立的前提。
- **把后端能力变成启动期的一次确定配置**：避免每次派发临时指定模型，也让"哪个角色跑什么"成为可 diff、可回溯的仓库事实（而非会话内的临时决定）。

### 执行方式约束（本次迭代专用，过程要求）

| 项 | 约束 |
|---|---|
| 派发通道 | hub（`<仓库根>/oamp/bin/hub.js`），层 A `api calls create` / `api calls get` / `api calls transcript`；不派发宿主本地 subagent |
| chat 粒度 | 单一 chat 覆盖阶段 2~6；demand（阶段 1）留在会话内；`chat_id` 记入 `status.md` |
| 角色↔节点 | `--agent <role>` → oamp 节点 instance_id `pb-<role>` |
| 模型真源 | 角色级 `cluster.json`；正式派发不带 `model`（唯一例外见 D-14） |
| 等价性判据 | D-10（全阶段）+ D-16（截断算缺口）+ D-18（并发取证） |
| 差距记录 | `deferred-demand-changes.md` 内"执行方式差距"二级分区 + 四要素 |
