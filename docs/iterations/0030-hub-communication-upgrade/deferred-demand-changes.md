# deferred-demand-changes.md — 0030-hub-communication-upgrade

> 本文件由执行侧直接写入（不回退、不暂停）：执行角色或阶段 1 内联执行者发现"要改 `demand.md` 结论才能解决"的问题时追加，供本迭代末与下一迭代决策。
> 本迭代按已落盘的 `demand.md` 继续，不等用户裁决；条目在阶段 6 由 verifier 原文摘录置顶呈现。

## 2026-09-17 · 阶段 1（主 agent 内联执行期间的可行性实测）

**问题**：**D-35（模型路由载体 = 项目 agent 文件 `.omp/agents/<role>.md` + `.omp/config.yml` 的 `modelRoles` 别名）在本会话不可实现而不触规则 F。**

- **实测依据**（三条，可复核）：
  1. harness 的 task agent 发现根 = **会话 cwd 下的 `.omp/agents`**——探针 `.omp/agents/modelprobe.md`（frontmatter `model: openai/gpt-5.6-luna`）在仓库根被成功发现并生效；同一探针放在迭代工作区内不会被发现。
  2. 本会话的 cwd = **仓库主工作区** `/Users/chenchiyuan/projects/agents`（工作区地址是迭代工作区，两者不同）。⇒ 要让发现生效，agent 文件必须落在**仓库主工作区**的 `.omp/`；而 `data/scm-protocol.md` §规则 F 明令：会话写操作不得落在仓库主工作区（闭集例外只有"工作区创建"与"收口三步"）。
  3. 另两条候选载体亦不可用：`task` wire schema 无 per-dispatch `model` 字段（F-10）；eval 桥的 per-dispatch `model` 参数**实测被忽略**（两次探针分别指定 `openai/gpt-5.6-luna` / `powerby/grok-4.6`，子 agent 均实报 `deepseek/deepseek-v4-flash`）。
- **为什么判定为需求层面问题**：D-35 是 `demand.md` §二 的 `user_confirmed` 决策；改载体形态 = 改需求结论（"模型值集中在哪一层、以什么形态被跟踪"），不是实现路径选择。
- **本迭代如何处理**：**不回退、不暂停**——阶段 2~4 不受影响（prd / architect / pr-planner 均走默认模型，不需要该载体）；**阶段 5/6 开始前**须按方案确认门呈现的修订选项之一落地（候选：**A** 在仓库主工作区建 `.omp/`（触规则 F，但最贴合 D-35 原意）／**B** 放用户级 `~/.omp/agent/agents/`（不触 git 工作区，但路由不入版本控制）／**C** 改用 `omp -p --no-session --model X` 一次性进程（完全合规，但退出本迭代 D-33 已定的本地 subagent 通道））。选项与推荐见阶段 4→5 门口的呈交。
- **下一迭代候选**：harness 的"项目级 agent 发现根固定在会话 cwd"与本框架"工作区隔离/显式寻址"协议存在结构性冲突（会话 cwd 恒为仓库主工作区，而一切产物必须落在迭代工作区）——这是**第四次**同型摩擦（前三次：0028 G-12 PR worktree 读不到迭代产物、0028 G-2 brief 无文件通道、0029 DC-20 自建等待脚本）。若要根治，需要一次独立的协议迭代（如：为角色派发定义"发现根 = 工作区地址"的载体，或把 agent 定义改为可按路径显式传入）。

## 2026-09-17 · 阶段 3（`architect`，见 `architecture.md` §9 / §10）

**问题**：**web 进程重启期间"在飞"的调用，其终态永不会进入收件箱**（既有缺口，非本迭代引入，但本迭代的必达承诺覆盖不到它）。

- **机制**：web 侧调用登记（`tasks` / `callSchemas`）为进程内、重启即丢；Router 任务条目**不携带** `principal` / `chat_id` ⇒ 重启后无法重建归属，`handleDeliver` 查不到 `entry` 即丢弃终态。
- **为什么判定为需求层面问题**：唯一修法是"派发时先落一条半成品记录（含归属），启动时重新认领"——而 `demand.md` 的 `F03 验收 3` **明文禁止**在持久层写非终态记录（"只在终态发布那一刻写一次"）。即：修法与已确认需求结论直接冲突，须改需求才能修。
- **本迭代如何处理**：不回退不暂停，作为 **F03/F01 的已知覆盖边界**在 `architecture.md` §9-4 如实登记，验收按"终态产生**之后**发生的重启由 F03 覆盖"口径判定；本迭代按现有 demand 继续。
- **下一迭代候选**：给 Router 任务条目补 `principal`/`chat_id` 归属字段 + 启动时重新认领（需协议面扩容，独立评估）。

## 2026-09-17 · 阶段 3（`architect`，见 `architecture.md` §9-1 / §10-3）

**问题**：**`agent_error` 与 `infra_error` 在现状下只能做消费侧近似划分**——"agent 自己执行出错"与"会话/子进程基础设施失败"混在同一个自由串族（`context_crashed`）上；而效果#3 要求调用方能分辨"它崩了"与"agent 自己执行出错"。

- **机制**：精确区分须在**产生点分码**（新增轮次级 `ProtocolError` 码 + 扩展 `context-pool._failSession` 的轮次级集合 `{model_unavailable, context_busy, permission_denied, + 新码}`），否则轮次失败会被误当会话崩溃而拆会话。
- **为什么判定为需求层面问题**：该改造与 `demand.md` 的两条已确认约束正面冲突——`F04 验收 5` / `G01 验收 3` 要求既有 `error` 的键位、拼写、取值形态（含既有文案）不变，且 `F04 边界` 明文"不做既有错误文案的统一/重写"。
- **本迭代如何处理**：按决策文档的映射表把 `context_crashed` 一族整体归 `infra_error`，`agent_error` 由"`failed` 且 `error` 缺失/非字符串"与"未匹配的自由文本"两条可达路径兜底（`architecture.md` §4 A-04 裁决 3）；映射"全函数"由三段式构造性保证。作为已知局限登记（§9-1）。
- **下一迭代候选**：轮次级分码 + `_failSession` 集合扩展（须与"文案不动"约束的放宽一并裁决）。
