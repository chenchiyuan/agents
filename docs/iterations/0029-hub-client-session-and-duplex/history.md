# history.md — 0029-hub-client-session-and-duplex

> 格式遵循 `roles/workflow-pb/data/formats.md` §历史记录协议：`### {YYYY-MM-DD HH:MM:SS} · {事件类型} · {对象}` + 字段行；事件类型 = `派发` / `收到报告` / `调度决策`。
> **格式迁移说明（2026-09-16 15:20）**：下方「早期记录」为迁移前的叙述式记录，**原文保留、未删未改**——其秒级时点未逐条记录，故**不臆造时间戳**，只做归档。自 15:20 起的记录一律按规范格式追加。

## 早期记录（格式迁移前，原文保留）
> 本文件由主 agent 维护；每条记录含**时点 / 类型 / 事实**，只增不改（修正以新条目追加）。

### 2026-09-16 · 迭代立项

- **来源**：迭代 0028 复盘（`roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`）指出的通讯层根因 + 用户三轮需求收敛（见 demand.md 的 D-1~D-14）。
- **一句话目标**：把"连接到 hub"做成一等入口（客户端会话），使 hub 与其纳管的 agents **像 subagent 一样好用**，并保证重启可恢复。
- **迭代分支/工作区**：`iteration/0029-hub-client-session-and-duplex` @ `.pb-agents/worktrees/0029-hub-client-session-and-duplex`（从 `main` 的 `112f87b` 拉出）。

### 2026-09-16 · 阶段 1（需求收敛，主 agent 内联）

- 起点材料：提案 `docs/hub-bidirectional-delivery-proposal.md`（v4，P-A~P-G）+ 复盘文档 + 用户裁决记录。
- **实测事实 F-1~F-10** 全部由主 agent 一手核实（含代码位置），写入 `demand.md` 第一段。
- **决策 D-1~D-14** 逐条标注来源：11 条 `user_confirmed`；**3 条 `model_inferred` 待确认**（D-4 收件箱保留期 / D-6 自派发拦截强度 / D-14 权威归属）。
- **否决路径 5 条**已记录（补丁式修复 / 事件回放 / 约定不重启 / 新增终态 / 扩 harness 前置）。
- **执行方式约束**（本迭代专用）：① 派发一律经 `hub`；② 全程度量 D-13 体感；③ 摩擦当场搭置 `deferred-demand-changes.md`；④ 产物落本工作区。
- **开工时的 hub 体感基线**（用于后续对比）：`stream call` 终态不退出；层 A 无身份通道；等待语义未统一；`skill/hub.md` 未暴露现成的两个等待原语（`--mode block`、`cli task watch`）。

### 2026-09-16 · 阶段 2（功能规格，`prd` 角色）

- 派发：`prd` 角色，call `task-3d15749f-6a37-49d7-a1b0-870ce78f5e26`（对话 `chat-6c89902c`，承 0028 同一 chat；其 title 已更正为 0029）。
- 产物：`prd.md`（30089 B）+ `prd/` **20 张卡**（F01~F19 + G01）。
- **主 agent 核产物**（不看自述）：卡 100% 带『来源』行可追溯；`prd.md` 含双向覆盖表（做什么/效果/不做什么/机制/决策/执行约束 → 卡片）；**卡内未做架构决策**、`prd.md` 集中登记 **A-01~A-14**；索引与目录一致；`model_inferred` 汇总 11 项；疑问/越界 8 条。
- **调用异常**：prd 调用在"报告阶段"**挂起于 provider 调用**（daemon 无子进程、CPU 0.1%、日志自 14:17:42 起零事件）⇒ **报告未回**；按 **D-14（产物为权威）**直接以产物推进，未重跑、未等报告。
- **用户裁决（2026-09-16）**：
  - **MI-1~MI-11**：逐条确认，**11/11 采纳**（无遗留待确认 `model_inferred`）。
  - **D-15**：效果#3 / 效果#5 两处表述**按落卡口径收窄**（原文与事实冲突）。
  - **D-16**：订阅第二形态（UDS，F04）**出本迭代**，只交付 SSE 形态。
  - **D-17**：hub 使用面文档修复（暴露 `--mode block` / `cli task watch`）**升格为本迭代交付项** ⇒ 新增卡 **F19**。
  - **D-18**：事件类命名对应（A-03）与三态承载形态（A-13）**交阶段 3** 定。
- **主 agent 落盘动作（留痕，供回溯）**：`demand.md` 加 D-15~D-18 + 收窄两处表述；`prd.md` 加「阶段 2 后裁决记录」表、决策表补 D-15~D-18 行、索引补 F19 行、F04 标注"本迭代不交付"、MI 汇总标题改为"已全部结清"；新增 `prd/F19-hub-usage-doc-fix.md`。
- **阶段 2 闸门**：**通过**（功能点各有独立卡；无 demand 之外新增功能点；架构待定项已登记 A-01~A-14）。

### 2026-09-16 · 阶段 3 派发（技术架构，`architect` 角色）

- 派发：`architect` 角色，call `task-8a80a749-6edf-447a-a862-74ba85fefbf3`；**角色定义全文（10830 B）显性注入 brief**（工作流要求），brief 16.3 KB；工作区 = 本 worktree。
- 输入：`prd.md` + `prd/*.md`（20 卡）+ 现有代码库（`oamp/**`、`web/`）；**不读 `demand.md` 作为设计依据**（仅 F-1~F-10 事实表可作线索、须以代码复核为准）。
- 出口：`architecture.md` + **A-01~A-14 逐项答案** + 零影响声明 + `prd.md` 汇总表回填 + L1 决策清单（未擅自实施）+ 决策记录。

### 2026-09-16 · 记录更正（只增不改，追加修正）

- `prd` 调用 `task-3d15749f` **终态已定**：`failed` / `error=timeout`，`duration_ms=1802670`（**14:47:44**，30 分钟节点上限）。阶段 2 的推进依据是**产物**（`prd.md` + 20 卡，14:23 已落盘），非报告。
- **时点更正**：阶段 3 派发时刻为 **14:47:27**（依据：pb-architect 实例日志 `CONTEXT_READY`），此前 `status.md` 台账误记为 14:56；`deferred-demand-changes.md` 的 DC-02/03/05/06 时点亦已按实际校正（14:41 / 14:49 / 14:47 / 14:49）。挂起取证发生在 14:41 前后（`ps` CPU 0.1%、日志零事件），非 14:30。

## 规范格式记录（2026-09-16 15:20 起）

### 2026-09-16 14:17:41 · 派发 · prd

- 阶段：阶段 2（功能规格）
- 任务：将需求合同原子化为可独立验证的功能卡，只做产品维度，不做架构决策
- 工作区地址：/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex
- call_id：task-3d15749f-6a37-49d7-a1b0-870ce78f5e26

### 2026-09-16 14:47:27 · 派发 · architect

- 阶段：阶段 3（技术架构）
- 任务：在现有架构上演进，补全功能卡的架构维度，产出技术方案
- 工作区地址：/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex
- call_id：task-8a80a749-6edf-447a-a862-74ba85fefbf3
- 过程偏差：本次 brief **未**按 §派发执行角色时的 brief 构建 的字段名格式构建（见 `deferred-demand-changes.md` DC-07）；阶段 4 起纠正

### 2026-09-16 14:47:44 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2 以**产物**为据判定达标并推进阶段 3；`prd` 调用的 failed 终态不触发重跑
- 触发依据：`prd.md`（30089 B）+ `prd/*.md`（20 卡）于 14:23 落盘；主 agent 核产物通过（卡 100% 带「来源」行、双向覆盖表齐、A-01~A-14 已登记、卡内无架构决策）；调用台账终态 = `failed / error=timeout`（`duration_ms=1802670`）；依据 `demand.md` D-14「权威归属：产物与 DB 为准」

### 2026-09-16 14:47:27 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2 闸门通过（三项推进条件逐条核实满足），并据用户裁决修正产物后进入阶段 3
- 触发依据：推进条件①所有功能点有独立卡片（`prd/` 20 卡，索引与目录一致）；②无 demand.md 外新增功能（双向覆盖表：做什么 3/3、效果 7/7、不做什么 6/6、机制 8/8、执行约束 4/4 均有承载）；③架构待定项已标注（`prd.md` 架构待填汇总 A-01~A-14）

### 2026-09-16 15:20:00 · 调度决策 · Gate确认

- 决策内容：**L1-01 采纳**（软重启窗口的重连中可见性 = 新增运行态名册 `.runtime/roster.json`）；**L1-02 采纳**（取消新增 Router 方法 `router.task_cancel`，层 B 方法集 8 → 9，连带更新 `skill/hub.md` 层 B 清单与 `sdk/surface.js` 的 `UDS_ENTRIES`）；**O-1 认可**（路径命名偏离：`GET /api/subscribe`、`GET /api/pickup`）
- 触发依据：`architecture.md` §7 L1 表两条待确认项（R-1 未确认风险）+ §11.2 O-1/O-3 偏差声明；用户对三条裁决均选择「采纳」（2026-09-16）

### 2026-09-16 15:20:30 · 调度决策 · 阶段推进核查

- 决策内容：阶段 3 推进条件全部满足 ⇒ 阶段 3 完成，进入阶段 4（PR 规划）
- 触发依据：①L1 决策经用户确认（L1-01/L1-02 见上条，`architecture.md` §7）；②所有功能卡有技术路径（`architecture.md` §4 A-01~A-14 逐项含追溯至 F01~F17，§0/§5 给出改动面，O-5 声明 20 卡验收面均有技术路径）；③无架构内部冲突（`architecture.md` O-5 / §10 R 系列均为风险登记而非冲突）；④`prd.md` 架构待填汇总 14 行已回填

### 2026-09-16 15:14:11 · 派发 · pr-planner

- 阶段：阶段 4（PR 规划）
- 任务：反射出可独立合并的提交单元划分及单元间真实依赖，从架构方案+代码库现状出发，不经过全局任务图这一中间环节
- 工作区地址：/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex
- call_id：task-63f31c78-993d-4303-8089-113122ee0271
- 说明：本次 brief **已**严格按 §派发执行角色时的 brief 构建 的字段名逐行构建（纠正 DC-07）；**顺序偏差**：本条记录写在派发**之后**（规范要求先记录后派发），单次派发无并发歧义，阶段 5 起改为先记录后派发

### 2026-09-16 15:15:40 · 调度决策 · 阶段推进核查

- 决策内容：登记严重期望偏差 DC-08（两次调用空耗 30 分钟上限、流程两次靠用户主动唤醒才继续）+ 主 agent 侧修正 DC-08a（禁止 `nohup &` 裸等待，一律用会自动送达的后台作业；等待作业与周期定时器双通道）
- 触发依据：用户 2026-09-16 明确反馈"这两次都是我主动唤醒继续的流程，这完全不符合我预期"；一手证据 = `prd` 产物 14:23 落盘 vs 调用 14:47:44 才 `failed/error=timeout`（`duration_ms=1802670`）、`architect` 产物 14:57 落盘 vs 预计 15:17:28 撞上限；`deferred-demand-changes.md` DC-08 / DC-08a

### 2026-09-16 15:17:28 · 收到报告 · architect

- 1. architecture.md 路径：docs/iterations/0029-hub-client-session-and-duplex/architecture.md（49769 字符）；核心组件：既有 web（HTTP/SSE）+ Router（UDS）双进程上做加法——新增 8 条 HTTP 路由、新增 `router.task_cancel`（层 B 8→9）、新增 2 个进程内登记模块（`src/principals.js` / `src/pickup.js`，体例照 `src/inbox.js`）、既有唯一终态发布点 `publishCallResult` 补线 1 处、新增运行态名册 `.runtime/roster.json`
- 2. L1 决策清单：**2 条**——L1-01（软重启窗口"重连中"可见性 = 运行态名册）、L1-02（取消需新增 `router.task_cancel` + 层 B 清单连带更新）；均附建议与回退，未擅自实施
- 3. 新引入技术组件：**无**（不新增进程 / 技术栈 / 依赖 / DB 表）
- 4. 架构待填补全数：**14 / 14**（A-01~A-14，逐项含追溯；`prd.md` 汇总表 14 行已回填「已填 · 见 architecture.md §4 A-0N」）
- 5. 疑问/越界：O-1 路径命名偏离（`/api/events`→`/api/subscribe`、`/api/inbox`→`/api/pickup`）；O-2 F04 未设计落地路径（D-16）；O-4 `oamp/web/calls.js` 1 行适配声明；O-5 无产品规格与技术约束的根本冲突；O-6 越界自查（唯一写入面 = architecture.md + prd.md 汇总表/补记 + 决策记录）；R-1~R-7 风险登记（R-4 既有 README 计数不符不在本次修）
- 过程事实：**报告未回**——调用于 15:17:28 以 `failed / error=timeout`（`duration_ms=1802677`）结束，产物 14:57 已完整 ⇒ 本条由主 agent 依**产物**（非角色报告）整理，见 DC-08

### 2026-09-16 15:23:41 · 收到报告 · pr-planner

- 1. PR 文件数：**8**（`pr-001`~`pr-008`），全部七字段齐备（上下文摘要 / 涉及功能点 / 文件范围 / 验收标准 / 参考资料 / depends_on / batch）
- 2. 功能点覆盖：**19 / 20** 张卡被引用；唯一未覆盖 = **F04**（订阅第二形态），系 D-16 范围收窄的预期结果，非漏项
- 3. 文件范围：21 个文件条目**两两不重叠**（同一文件不出现在两个 PR）
- 4. 依赖图：**无环**（DFS 着色检查）、**无悬挂引用**；边 = pr-005←{pr-001,pr-002,pr-003}、pr-006←pr-005、pr-007←{pr-001,pr-005}
- 5. 关键路径长度：**3**（末端 pr-007），满足 ≤3；`prs/split-suggestion.md` **不存在**（未触发合并受阻）
- 6. 并发可行性：**通过**（每个 PR 在依赖图上都存在至少一个互不可达的伙伴 ⇒ 有并发重叠窗口）
- 7. 说明：**报告未回**——`pr-planner` 调用在产物稳定后仍处 `working`（撞 30 分钟上限途中）；本条由主 agent 依**产物**整理，且**提早 ~21 分钟**推进（上限 15:44:11，实际 15:23:41 判定），依据 `deferred-demand-changes.md` DC-08/DC-08a 的产物面等待器

### 2026-09-16 15:24:10 · 调度决策 · 阶段推进核查

- 决策内容：阶段 4（PR 规划）推进条件六项全部满足 ⇒ 阶段 4 完成；按方案确认门（`**方案确认门**: enabled`）**停在门口等用户确认**，不自行进入阶段 5
- 触发依据：七项机械核查全通过（见上条 1~6 项）；关键路径 3 ≤ 3；`prs/split-suggestion.md` 不存在；`status.md` 已初始化 `## 并发配置（阶段 5）`（起始 3 / 硬上限 5 / 已派发 0）

### 2026-09-16 15:25:00 · 调度决策 · Gate确认

- 决策内容：阶段 4→5 的**方案确认门通过**——用户确认三部分整呈（产品维度 19 卡 + F04 出范围 / 架构维度 49769 字符方案 + A-01~A-14 + 零影响声明 / PR 拆分摘要 8 个 PR + 依赖图 + 关键路径 3 + 并发配置 3/5），选择"确认，按起始并发 3 开始"
- 触发依据：`status.md` 头部 `**方案确认门**: enabled`；`prs/split-suggestion.md` 不存在（未触发拆分建议，无需呈现该文件）；用户 2026-09-16 明确回答

### 2026-09-16 15:27:24 · 派发 · verifier

- 阶段：阶段 6（独立验证）——触发时机为阶段 4 完成、`prs/` 全部生成之后、阶段 5 开始之前（workflow-pb.md §验证触发时机）
- 任务：不接收执行过程上下文，独立评判任意阶段产物的质量
- 产出物路径：docs/iterations/0029-hub-client-session-and-duplex/prs/
- 验证标准（内联两条）：① 依赖正确性验证（每条 `depends_on` 须有代码级耦合证据；依赖图无环；文件范围无重叠、无遗漏功能点）；② PR 粒度判断框架（逻辑原子性 / 可审查性 / 独立性）
- 强制传入：docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md（要求原文摘录并置顶）
- 范围基准：F04 出本迭代（D-16）⇒ 未被引用不构成缺陷
- 通道：hub `api calls create`（call `task-08bac0b6-2226-4640-bedd-cd0dc7188077`，agent=verifier → 节点 `pb-verifier`）

### 2026-09-16 15:36:00 · 调度决策 · 阶段推进核查

- 决策内容：执行 **DC-09** 的处置——在迭代分支上提交阶段 1~4 全部产物（commit `72b659f`，含 `docs/iterations/0029-.../` 与 `roles/{prd,architect}/data/0029-*`）；据依赖图取前 N=3 个已解锁 PR（`pr-001` / `pr-002` / `pr-003`，均 `depends_on:（无）`）创建 PR worktree（base = 迭代分支），并预写三份 planner brief（规范字段格式）
- 触发依据：`git -C <迭代工作区> status` 显示产物全 untracked，而 8 个 PR 的文件范围都含各自的 `prs/pr-00N-*.md` ⇒ 首次 merge 会被 git 拒绝（`untracked working tree files would be overwritten`）；`workflow-pb.md` §阶段 5 第 2 点的 worktree 创建命令；`prs/*.md` 的 `depends_on`（无环）
- 附带验证：三个 PR worktree 内均含完整 `docs/iterations/0029-.../`（产物入库的直接效果；0028 的 G-12 现象在本迭代不存在）

### 2026-09-16 15:30:52 · 收到报告 · verifier

- 结论：**PASS**（pass 0 / partial 2 / fail 0 / blocked 0）；报告 `clarifications/verify-20260916-153039.md`（20968 字节，`deferred-demand-changes.md` 已按要求原文置顶透传）
- 1. 依赖正确性验证：**partial** —— 通过侧：已声明 6 条 `depends_on` 均有代码级证据（附现测行号）、依赖图无环、文件范围写入路径零重叠、除豁免的 F04 外 F01~F19+G01 全覆盖；不通过侧：**`pr-007` 验收第 32 行（doctor R1 机械锁 = 层 A 条数与 `API.md` §3 行数一致）消费 pr-006 写入的 `API.md`，但 `depends_on` 未声明 pr-006（缺边）**
- 2. PR 粒度判断框架：**partial** —— 原子性 8/8 pass；可审查性 7/8（`pr-005` fail：单 PR 覆盖 16 张卡、跨身份/订阅/取件/等待/取消/健康/投影）；独立性 5/8（`pr-005`/`pr-006`/`pr-007` fail：验收在依赖未合并时不可判定）
- 3. `blocked`：0 项；未核查"并发调度真实执行证据"三项（属阶段 5 完成后，委托已标明）

### 2026-09-16 15:31:30 · 调度决策 · 阶段推进核查

- 决策内容：verdict PASS ⇒ 进入阶段 5；对两条 partial 的处置 —— ① **缺边 `pr-007 → pr-006` 不改已验证的计划**，作为**调度约束**执行（`pr-007` 只在 `pr-006` 合并进迭代分支后才派发；该约束记入 `status.md` 依赖列的可读备注）；② pr-005 可审查性与 pr-005/006/007 独立性判为**结构性固有张力**（pr-005 的原子性由 `createApiRoutes` 单点文件所有权强制，verifier 对该项判 pass；依赖型 PR 的验收天然需要依赖先合并），接受并登记，不做计划返工
- 触发依据：`clarifications/verify-20260916-153039.md` 结论 PASS（0 fail）；先例 `docs/iterations/0028-role-model-binding/history.md` 22:03 条"未写成依赖的顺序约束已交调度"

### 2026-09-16 15:32:19 · 调度决策 · 阶段 5 首批派发（槛位占用）

- 决策内容：按依赖图取前 `N = 当前有效上限 = 3` 个已解锁 PR（`pr-001` / `pr-002` / `pr-003`，`depends_on` 均为「（无）」）并发派发其 **planner**（产出各自 `prs/pr-00N-*-tasks.md`）；`pr-004` / `pr-008`（同样无依赖）排 `排队(等待槛位)`；`pr-005/006/007` 依赖未满足 `排队(依赖未满足)`。三个 PR worktree 已建（base = 迭代分支 `72b659f`），brief 按规范字段格式构建
- 触发依据：`prs/*.md` 的 `depends_on`（无环，阶段 4 验证 PASS）；workflow-pb §阶段 5 第 2 点"按当前有效上限取前 N 个立即并发派发"；`status.md` §并发配置（起始 3 / 硬上限 5）

### 2026-09-16 15:32:19 · 派发 · planner（pr-001）

- 阶段：阶段 5（PR 实现）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-001-router-status-primitives.md；worktree 分支 feat/0029-pr-001-router-status-primitives
- 通道：hub `api calls create`（background，同轮并发发起），agent=planner → 节点 `pb-planner`

### 2026-09-16 15:32:19 · 派发 · planner（pr-002）

- 阶段：阶段 5（PR 实现）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-002-session-registries.md；worktree 分支 feat/0029-pr-002-session-registries
- 通道：hub `api calls create`（background，同轮并发发起），agent=planner → 节点 `pb-planner`

### 2026-09-16 15:32:19 · 派发 · planner（pr-003）

- 阶段：阶段 5（PR 实现）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-003-sse-transport-additions.md；worktree 分支 feat/0029-pr-003-sse-transport-additions
- 通道：hub `api calls create`（background，同轮并发发起），agent=planner → 节点 `pb-planner`

### 2026-09-16 15:36:58 · 收到报告 · planner（pr-001）

- 1. 任务列表路径：`prs/pr-001-router-status-primitives-tasks.md`（38404 字节，写于 `feat/0029-pr-001-...` 工作区内）
- 2. 任务数：**8**（T1 基线取证 / T2 registry.snapshot 追加 connected+generation / T3 任务条目 started_at / T4 router.status 追加 generation / T5 router.task_cancel / T6 sdk/uds.js taskCancel / T7 既有面回归 + 重启取证 / T8 零影响核查 + 证据落盘）
- 3. AC 覆盖：PR 的 **10 条验收标准全部映射**（tasks §0.5，声明"无孤儿任务、无无主 AC"）
- 4. 依赖图与顺序：拓扑序 T1<T2<…<T8；无循环依赖
- 5. model_inferred：**2 项**（MI-P1 `started_at` 写入面 / MI-P2 `task_cancel` 不校验身份）
- 6. 疑问/越界：4 条——① `uds router.task_cancel` CLI 载体本 PR 不可达（属 pr-007 的 `UDS_ENTRIES`）⇒ 已改为库面载体；② 未写 `roles/planner/data/`（该路径不在 PR 文件范围内，理由就地记录）；③ 无架构信息缺口；④ PR 文件七字段零改动

### 2026-09-16 15:37:10 · 调度决策 · 阶段推进核查

- 决策内容：对 `planner(pr-001)` 报出的 2 项 `model_inferred` 与 4 条疑问逐条裁定——**MI-P1 采纳**（`started_at` 仅写入既有非终态 `working` 分支；依据 `registry.js:227-229` 显式排除终态）；**MI-P2 采纳**（`task_cancel` 不校验身份，与既有 3 个 `router.*` 方法一致，符合 D-2 最小实现）；**疑问 1 采纳其适配**（本 PR 内改库面载体取证，CLI 载体留待 pr-007 合并后迭代级取证，已记为调度笔记）；疑问 2/3/4 无异议（不越界写 `roles/`、无架构缺口、PR 字段零改动）。按 workflow-pb"阶段 4/5 的 `model_inferred` 不触发用户暂停"，本节由主 agent 裁定并留痕
- 触发依据：`prs/pr-001-router-status-primitives-tasks.md` §6/§7；`oamp/src/registry.js:227-229`；`architecture.md` §5.3

### 2026-09-16 15:37:35 · 派发 · dev（pr-001）

- 阶段：阶段 5（PR 实现）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再实现，产出最小实现
- PR：prs/pr-001-router-status-primitives.md；worktree 分支 feat/0029-pr-001-router-status-primitives
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 15:39:00 · 调度决策 · 记账时点更正

- 决策内容：更正本文件 8 条记录的**记账时点**（原按会话推断写入 15:38:30~15:41:01，实测不符）：`verifier` 裁决 = 15:31:30（证据：报告文件 mtime 15:30 + 监听作业 15:30:52 触发）；阶段 5 首批记录与三条 `planner` 派发 = **15:32:19**（证据：派发后即时 `date` 输出）；`收到报告 planner(pr-001)` = **15:36:58**（证据：产物监听作业触发时刻）；MI 裁决 = 15:37:10；`dev(pr-001)` 派发 = 15:37:35（证据：派发后即时 `date` 输出 15:37:39）
- 触发依据：**与 0028 同类偏差的复现**（0028 曾把恢复轮记账写成"00:47~00:56"、与实际差约 8 小时，纠正措施为"此后记账时点一律以机器时间戳为准"）——本次我在 15:32 的派发批次里凭推断写了 15:41，距实际 9 分钟
- **纪律（即时生效）**：此后每条 `history.md` / `status.md` 的记账时点**必须取自机器**（`date`、文件 mtime、作业触发时刻、`git log` 提交时间、`hub api calls list` 的 `started_at`），不得凭会话推断；无机器来源时宁可留空并标注"时点未取机器时间戳"

### 2026-09-16 15:39:17 · 收到报告 · planner（pr-002）

- 1. 任务列表路径：`prs/pr-002-session-registries-tasks.md`（40506 字节；时序证据：文件 mtime，调用本体仍 `working` ⇒ 按 D-14 以产物为准）
- 2. 任务数：**6**（T1 principals 骨架+upsert/get / T2 touch+requesterOf / T3 pickup 骨架+add / T4 listByRequester+ack / T5 合同面核查 / T6 全量复跑+形态等价+证据落盘）
- 3. AC 覆盖：**12 条验收标准全部映射**（§0.5，声明无孤儿任务、无无主 AC）
- 4. 依赖图：6 条边，双拓扑序 `T1<T2<T5<T6`、`T3<T4<T5<T6`；**无循环依赖**
- 5. model_inferred：**3 项**（MI-P1 `requesterOf` 缺省形态 / MI-P2 `pickup.add` 校验面 / MI-P3 `ack` 后条目保留）
- 6. 疑问/越界：**6 条**（① AC2 与 AC4 字面冲突及取舍 ② 接缝命名 `resolve` vs `requesterOf` ③ **简报工作区地址笔误**（主 agent 侧 `{IT[:4]}+slug` 拼接缺连字符）④ 未写 `roles/planner/data/`（不在文件范围）⑤ 无架构缺口 ⑥ PR 字段零改动）

### 2026-09-16 15:39:42 · 调度决策 · 阶段推进核查

- 决策内容：对 `planner(pr-002)` 的 3 项 `model_inferred` 与 6 条疑问逐条裁定——**MI-P1 采纳**（`kind` 缺失 ⇒ `kind:null`；非对象 `source` ⇒ 整体 `null`）；**MI-P2 采纳**（`pickup.add` 只校验 `call_id`，其余落 `null`，体例照 `inbox.add`）；**MI-P3 采纳**（`ack` 后条目保留 `acked=true`、再 `add` 返回 `false`，与 `architecture §4 A-06` 逐字一致且 AC10 要求键集含 `acked`）；**疑问 1 采纳 planner 取舍**（两模块只 import `node:*` 满足 AC2，AC4 以"码元范围判定 + 与 registry 逐例同判等价性证明"满足，禁止 import `./registry.js`）；**疑问 2 采纳 `requesterOf`**（消费面 + 判据名双重证据；不做别名/双导出；`architecture §5.4` 的 `resolve` 属上游文档内部不一致，不改文档）；疑问 3（简报地址笔误）确认为**主 agent 侧缺陷**，已即时修正并登记 DC-10；疑问 4/5/6 无异议
- 触发依据：`prs/pr-002-session-registries-tasks.md` §6/§7；`architecture.md` §4 A-01/A-06、§5.4；workflow-pb"阶段 4/5 的 `model_inferred` 不触发用户暂停"（主 agent 裁定并留痕）

### 2026-09-16 15:39:42 · 派发 · dev（pr-002）

- 阶段：阶段 5（PR 实现）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务（sub agent 内部步骤，不产出全局任务图），再实现，产出最小实现
- PR：prs/pr-002-session-registries.md；worktree 分支 feat/0029-pr-002-session-registries
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 15:44:21 · 收到报告 · pr-planner

- 1. PR 文件数：8（`pr-001`~`pr-008`），七字段齐备；报告本体**未回**
- 2. 调用终态：`failed` / `error=timeout`，`duration_ms=1802568`（30.04 分钟，第三次同型上限命中；产物 15:18:41 已完整，空耗 ≈26 分钟）
- 3. 推进依据：**产物**（D-14），且由产物面等待器在 15:23:41 判定，比上限早 ~21 分钟
- 4. 登记：DC-13（DC-08 第三例，含"3 次调用合计空耗 ≈70 分钟"的基线数字）

### 2026-09-16 15:44:28 · 收到报告 · planner（pr-003）

- 1. 任务列表路径：`prs/pr-003-sse-transport-additions-tasks.md`（40247 字节；文件 mtime 15:44；调用终态 `completed`，`duration_ms=749942` = 12.5 分钟）
- 2. 任务数：**6**（T1 并行过滤注册表 + handleSubscribe + publishFiltered / T2 心搏覆盖两注册表 / T3 closeCallSubscriptions / T4 隔离性与生命周期断言 / T5 与 base 逐条对照 + 零依赖核查 / T6 证据落盘）
- 3. AC 覆盖：**9 条验收标准全部映射**（§0.5，无孤儿任务、无无主 AC）
- 4. 依赖图：8 条边，双拓扑序 `T1<T2<T5<T6`、`T3<T4<T5<T6`；无循环依赖
- 5. model_inferred：**3 项**（MI-P1 心搏覆盖两注册表 / MI-P2 predicate 缺省恒真 / MI-P3 "零内存增长"的行为判据化）
- 6. 疑问/越界：**6 条**（① **PR 验收 1 的"既有 13 个导出键"计数与代码不符**（实际 12）② `closeAll()` 是否覆盖新注册表——取"不覆盖、不扩面" ③ 简报地址笔误（同 DC-10）④ 未写 `roles/planner/data/` ⑤ 无架构缺口 ⑥ PR 字段零改动）

### 2026-09-16 15:45:07 · 调度决策 · 阶段推进核查

- 决策内容：对 `planner(pr-003)` 的 3 项 `model_inferred` 与 6 条疑问逐条裁定——**MI-P1/MI-P2/MI-P3 全部采纳**（单定时器覆盖双注册表、predicate 缺省恒真、零增长以行为判据承载）；**疑问 1 采纳**（PR 文件"13 个导出键"是计数笔误，判据改按**实际集合**：base ⊆ 改动后且差集恰为新 3 键，记入 DC-14 作计划缺陷）；**疑问 2 采纳**（`closeAll()` 不覆盖新注册表，不得自行新增批量关闭入口——那属新增能力）；疑问 3 确认为主 agent 缺陷（DC-10）；疑问 4/5/6 无异议
- 触发依据：`prs/pr-003-sse-transport-additions-tasks.md` §6/§7；`architecture.md` §4 A-03/A-08、§5.5、§6.1 Z-1；`oamp/src/transport.js:134-141`；workflow-pb"阶段 4/5 的 `model_inferred` 不触发用户暂停"

### 2026-09-16 15:45:07 · 派发 · dev（pr-003）

- 阶段：阶段 5（PR 实现）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再实现，产出最小实现
- PR：prs/pr-003-sse-transport-additions.md；worktree 分支 feat/0029-pr-003-sse-transport-additions
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 15:50:28 · 调度决策 · 阶段推进核查

- 决策内容：识破"`pr-002`/`pr-003` 的 dev 久无动静"的真相——**不是卡死，是同角色实例串行排队**（登记 **DC-15**）；并修正 DC-12 对 transcript 的适用边界（**DC-16**：transcript 上限 1000 条且返回前缀 ⇒ 长调用判活性须用产物文件 mtime）
- 触发依据：`pgrep -fl "omp --mode rpc"` 仅 3 个 daemon（planner 18820 / dev 45174 / verifier 30863，各 1 个）且 daemon 无子进程；三条 planner 完成耗时递增 4.5→7→12 分钟；`pr-001` 的 `oamp/src/registry.js` mtime 15:47:13（活跃）vs `pr-002`/`pr-003` 零写入；`calls transcript` 响应 `truncated:true`、末事件 15:38:55（滞后）

### 2026-09-16 15:52:14 · 收到报告 · dev（pr-001）

- 1. 改动文件：`oamp/src/registry.js`（进程级 `generation`；`snapshot()` 追加 `connected`；任务条目 `started_at`）/ `oamp/src/router.js`（`router.status` 返回 `generation`；新增 `router.task_cancel`，复用既有 `finishTask`）/ `oamp/sdk/uds.js`（新增 `taskCancel(taskId)`，会话方法 8→9）/ 本 PR 文件（补验收证据）——**4 个文件，全在声明文件范围内**
- 2. 测试与验收：`node --check` 三文件通过；`git diff --check` 通过；隔离 socket 实跑（`generation` 同进程稳定 / Router 重启后变化；`online+connected=true`、`online+connected=false`、`offline` 三态；`started_at` 首次写/重复不覆盖/未开始为 `null`；`task_cancel` 的四条判据 生效·重复 `TASK_ALREADY_FINAL`·不存在 `TASK_NOT_FOUND`·非法参数 `INVALID_PARAMS`）；SDK `taskCancel` 经既有 `RpcPeer` 路径；既有 8 个 UDS 方法命令族做改动前后回归
- 3. 疑问/待办：无；记录工作区基线 `7fe0c1e`
- 4. 边界违反：**无**（未新增依赖 / env / 配置键 / DB 结构 / 测试文件）
- 5. 提交：`10cae94`（工作区提交前为空）；`git diff --stat`：`uds.js` 11、`registry.js` 11、`router.js` 31、PR 文件 16、tasks 文件 371

### 2026-09-16 15:52:14 · 派发 · verifier（pr-001）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（merge 前置）
- 任务：不接收执行过程上下文，独立评判任意阶段产物的质量
- 产出物路径：`feat/0029-pr-001-router-status-primitives` 分支的代码改动 + `prs/pr-001-router-status-primitives.md`
- 验证标准（4 条）：① 验收标准逐条判定（判据须来自 verifier 自己实跑的命令与原始输出）② 改动面封闭性（⊆ 文件范围、不触碰清单零命中）③ 验收证据段须为命令+原始输出、不得转述 ④ 既有面零影响
- 搭置文件：`deferred-demand-changes.md`（强制原文摘录并置顶）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 15:54:16 · 调度决策 · 阶段推进核查

- 决策内容：**改用事件驱动，废除定时器模式**——启动常驻订阅进程 `pb-calls-stream-0029`（hub `op:"start"` 托管，命令 = `node oamp/bin/hub.js api stream calls --chat-id chat-6c89902c-… | grep --line-buffered -E '"event":"call_(state|result)"'`），此后等待一律用 `hub op:"logs", follow:true, cursor:<last>`（**事件到达才返回**，超时仅作兜底）；登记 **DC-17**（主 agent 未使用既有推送面的用法错误，含用户原话与实测证据）
- 触发依据：用户 2026-09-16 直接指出"应该不用走定期 call 的模式，能实时看到信息才对吧"；实测 `api stream calls --chat-id …` 为可用 SSE 流（事件类 `call_state`/`call_update`/`call_result`），5 秒内 235 条 `call_update`；`api docs` 中 `/api/stream`、`/api/calls/stream`、`/api/calls/:call_id/stream` 三条推送面长期存在

### 2026-09-16 15:58:47 · 收到报告 · dev（pr-002）

- 1. 改动文件：`oamp/src/principals.js`（`upsert`/`get`/`touch`/`requesterOf`，进程内 Map 不持久化）/ `oamp/src/pickup.js`（`add`/`listByRequester`/`ack`，白名单 + 去重 + 确认保留）/ 本 PR 文件（验收证据）
- 2. 测试与验收：`node /tmp/pr002-verify.mjs` ⇒ **PASS**（AC3~AC10）；缺省 pickup 字段 = `null` 通过；`ack` 后条目保留且重复 `add` 返回 `false` 通过；导出面 = principals{get,requesterOf,touch,upsert} / pickup{ack,add,listByRequester}；**两模块零 import 行**；**与 `registry.js:isValidInstanceId` 15 个边界输入等价 15/15**；静态约束复核（生命周期短语各 1 次；定时器/文件写入/`process.*`/事件面/删除操作均为 0）；`node --check` 与 `git diff --check` 通过
- 3. 疑问/待办：无；记录开工基线 `3f3fd72`
- 4. 边界违反：**无**（未改范围外文件、未新增测试文件、未跑全量测试套件）
- 5. 提交：`022dd7e`；实报 `model = openai/gpt-5.6-luna`，`duration_ms = 1133835`
- 6. 通道说明：本条由**推送面**（`api stream calls` 的 `call_result` 事件）实时送达，非轮询获得（见 DC-17）

### 2026-09-16 15:58:47 · 派发 · verifier（pr-002）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（merge 前置）
- 任务：不接收执行过程上下文，独立评判任意阶段产物的质量
- 产出物路径：`feat/0029-pr-002-session-registries` 分支的代码改动 + `prs/pr-002-session-registries.md`
- 验证标准（4 条）：同 pr-001（验收逐条判定须自跑取证 / 改动面封闭性 / 证据须命令+原始输出 / 既有面零影响）
- 搭置文件：`deferred-demand-changes.md`（强制原文摘录并置顶）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 15:59:52 · 收到报告 · verifier（pr-001）

- 结论：**FAIL**（pass 1 / fail 2 / partial 1 / blocked 0）；报告 `clarifications/verify-20260916-155214-pr-001-router-status-primitives.md`（写于 pr-001 工作区内）；实报 `powerby/grok-4.6`，`duration_ms=419025`；搭置记录按该 worktree 副本（止于 DC-09）原文置顶
- 1. 标准 1（验收逐条）**partial**：`generation` / `connected` 三态 / `started_at` / `cancel` 四分支 / `finishTask` 未改——均由 verifier **自起临时 Router 独立实跑**成立；但「既有 8 方法改动前后对照」未起基线 Router
- 2. 标准 2（改动面封闭）**fail**：`pr-001-router-status-primitives-tasks.md` 不在文件范围
- 3. 标准 3（证据形态）**fail**：「验收证据」为散文，无命令 + 原样输出
- 4. 标准 4（既有面零影响）**pass**：Z-3 / Z-7 成立（`status.js` COLUMNS 未改）
- 5. 越界自查成立（未改代码与 PR 文件）

### 2026-09-16 15:59:52 · 调度决策 · PR 失败判定

- 决策内容：对 2 条 fail 分别处置——① **标准 2 改判为"计划陈述缺口"**（`prs/<slug>-tasks.md` 系 `workflow-pb §文档路径协议` 规定的阶段 5 产物；裁定见 **DC-18**，并已把口径写入后续所有 PR 的 verifier 简报，避免 `pr-002`~`pr-008` 同型系统性返工）；② **标准 3 fail 与标准 1 partial 必须返工**：派 `dev` 在**同一 PR worktree / 同一分支**续做（证据重做为命令 + 原样输出；补跑既有 8 方法基线对照），完成后**重验**（新 verifier 调用）。PR 状态记 `❌失败(现场保留)` → 返工中，**不清理** worktree 与分支
- 触发依据：`clarifications/verify-20260916-155214-pr-001-…md` 逐项判定；`workflow-pb.md` §文档路径协议（`pr-{NNN}-tasks.md` 条目）；先例 0028（pr-001/pr-002 返工 + 重验）

### 2026-09-16 16:00:03 · 派发 · dev（pr-001 返工）

- 阶段：阶段 5（PR 实现）· 同一 PR 的返工（不新建 PR / 不新建 worktree / 不切分支）
- 任务：按独立验收结论重做两项——① 【标准 3 fail】把「验收证据」段由散文改写为**命令 + 原样输出**；② 【标准 1 partial】补跑「既有 8 个 UDS 方法改动前后对照」，须**起基线 Router**（base `72b659f`）
- PR：prs/pr-001-router-status-primitives.md；worktree 分支 feat/0029-pr-001-router-status-primitives
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 16:02:13 · 收到报告 · verifier（pr-002）

- 结论：**FAIL**（pass 1 / fail 2 / partial 1 / blocked 0）；报告 `clarifications/verify-20260916-155847-pr-002-session-registries.md`；实报 `powerby/grok-4.6`，`duration_ms=176471`
- 1. 标准 1 **partial**：import 面 / 导出面 / `upsert` 幂等 / 形态 15 例等价 / `requesterOf` / `add` 幂等 / 隔离 / 六键指针——**均实跑成立**；不通过侧两条 = ① `touch` 在**同一毫秒**内 `last_seen_at` 不前进（`Date.now()` 精度边界）② `ack` 只置 `acked=true`、Map 未删，同 `call_id` 再 `add` 返回 `false`（**即 MI-P3 既定语义**）
- 2. 标准 2 **fail**：夹带 `pr-002-session-registries-tasks.md`（**已由 DC-18 改判为计划陈述缺口**；该 verifier 运行于裁定之前）
- 3. 标准 3 **fail**：「验收证据」为摘要，无命令 + 原样输出（**与 pr-001 同型**）
- 4. 标准 4 **pass**：未改任何既有 `oamp` 文件

### 2026-09-16 16:02:13 · 调度决策 · PR 失败判定

- 决策内容：① 标准 2 **不返工**（DC-18 改判）；② 标准 1 的两条不通过侧**判为已知实现边界/既定语义并接受**（`touch` 毫秒精度不引入新机制；`ack` 保留条目即 MI-P3 裁定，且 AC10 要求键集含 `acked`）；③ 标准 3 **必须返工**（派 dev 同 worktree/分支重做证据）
- 触发依据：`verify-20260916-155847-pr-002-…md`；`prd/F01`/`F07` 验收语义；MI-P3 裁定；DC-18

### 2026-09-16 16:02:13 · 调度决策 · 阶段推进核查

- 决策内容：识别**系统性问题**并治根——两次同型「标准 3 fail（证据为散文/摘要）」⇒ 根因是 dev 简报缺机械格式 ⇒ **把"验收证据段强制格式（逐条 AC = 命令 + 原样输出；禁止结论词/摘要；附正反例）"内嵌进 dev 简报模板**（对 pr-003 起的待发简报已生效）；登记 **DC-19**；pr-001/pr-002 仍按返工处置
- 触发依据：两份 verification 报告的标准 3 判定同型；先例 0028 两次因"证据非原文"返工

### 2026-09-16 16:02:21 · 派发 · dev（pr-002 返工）

- 阶段：阶段 5（PR 实现）· 同一 PR 的返工（不新建 PR / worktree / 分支）
- 任务：仅按【标准 3 fail】重做「验收证据」为命令 + 原样输出；并按【标准 1 partial】为 `touch` 毫秒边界与 `ack` 语义**留实测证据**（不改代码，两项已裁定接受）；**不处理**标准 2（DC-18 改判）
- PR：prs/pr-002-session-registries.md；worktree 分支 feat/0029-pr-002-session-registries
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 16:04:20 · 调度决策 · 阶段推进核查

- 决策内容：**主 agent 自查并登记 DC-20**（用户指出的"又自己实现过与 agents 的连接"）——盘点本会话自建物 5 项（全部位于 `/tmp`，**仓库零污染**，已核 `git status`）：① 产物面等待器 `artifact-watch-0029.py`（在用；方向合 0028 复盘候选 B"依赖产物文件"，但实现属私有脚本）② `sleep` 定时器（已废）③ `nohup &` 裸等待（已废）④ SSE 推送订阅 + 自写 grep 过滤（在用；用的是既有推送面 ✓，"穷人的 F03"）⑤ 阶段 4 闸门核查脚本。**定性**：同类错误第三次发生（0028 复盘已判定自建 watchdog 为"对现成原语的重复实现"并禁止其作为默认解），而本迭代正是因该毛病立项 ⇒ 最强体感反面样本
- 触发依据：用户 2026-09-16 指认；`roles/retrospective/data/retro-2026-09-16-0028-hub-communication.md`（第 22/25/96/107/130/155 行的原始论断：30+ 次派发从未自发收到 `call_result`；watchdog 是重复实现；禁止把 watchdog 当默认等待机制；候选 B"调度方推进应依赖产物文件"）；`/tmp` 实存物清单与 `git status` 核验

### 2026-09-16 16:07:20 · 收到报告 · dev（pr-003）

- 1. 改动文件：`oamp/src/transport.js`（新增独立 `filteredSubscribers` 注册表 + `handleSubscribe` + `publishFiltered`；心搏覆盖两注册表；新增 `closeCallSubscriptions(callId)` 复用既有 `closeKey`；返回对象仅追加 3 个接口）/ 本 PR 文件（回填验收证据）
- 2. 测试与验收：**AC1~AC9 全部通过**（AC1 导出面按实际集合口径；AC2 只关 `call:<id>`、其余三键空间不受影响；AC3 既有断开清理保持 + 两表皆空才停心搏；AC4 `agent_online`/`call_state`/实例 ID 的 AND 谓词；AC5 无订阅者丢弃、无补发、断开即停、200 轮无残留；AC6 新旧表双向隔离；AC7 SSE 头/`retry: 1000`/keepalive/无初始帧；**AC8 与基线 `72b659f` 的四键空间探针 JSON 完全一致（`diff` 退出码 0）**；AC9 无新增 import/无 `web.js` 依赖/`package.json` 未动）；`node --check` 与 `git diff --check` 通过
- 3. 疑问/待办：无；AC1 按主 agent 裁定使用**实际导出集合**（11 对象键 + 模块级 `createSseTransport`，再追加 3 新键）
- 4. 边界违反：**无**（未新增测试文件/依赖/配置）
- 5. 提交：`794b9e4`；实报 `model = openai/gpt-5.6-luna`，`duration_ms = 1318406`

### 2026-09-16 16:07:20 · 派发 · verifier（pr-003）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（merge 前置）
- 任务：不接收执行过程上下文，独立评判任意阶段产物的质量
- 产出物路径：`feat/0029-pr-003-sse-transport-additions` @ `794b9e4` 的代码改动 + `prs/pr-003-sse-transport-additions.md`
- 验证标准（4 条，含"标准 2 的 tasks 文件口径澄清"= DC-18 裁定）
- 搭置文件：`deferred-demand-changes.md`（强制原文摘录并置顶）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 16:12:00 · 收到报告 · verifier（pr-003）

- 结论：**FAIL**（pass 2 / fail 1 / partial 1 / blocked 0）；报告 `clarifications/verify-20260916-160720-pr-003-sse-transport-additions.md`；实报 `powerby/grok-4.6`，`duration_ms=263104`
- 1. 标准 1 **partial**：关流只关 `call:` / 谓词 AND / 不补发 / **四键空间与基线 `72b659f` 的探针 JSON 全等** / 零 import —— 全部通过；不通过侧仅"条文写 13 个导出键"（实际基线对象键 11 + 追加 3，即 DC-14 既定裁定）
- 2. 标准 2 **pass**：`oamp/` 仅 `transport.js` 被改；**`*-tasks.md` 按裁定不计夹带**（DC-18 口径被独立验证者接受 ✓）
- 3. 标准 3 **fail**：「验收证据」段指向 `/tmp/pr003-*.mjs`，**无仓内命令 + 原样输出**
- 4. 标准 4 **pass**：既有 publish 不投喂过滤表；`globalCount` 不变

### 2026-09-16 16:12:00 · 调度决策 · PR 失败判定

- 决策内容：pr-003 仅 **标准 3** 需返工（标准 1 的不通过侧为 DC-14 既定裁定、标准 2 因 DC-18 判 pass、标准 4 pass）⇒ 派 dev 在同一 worktree/分支重做「验收证据」为**仓内命令 + 原样输出**（须含可复核的实跑，不得只指向 `/tmp` 脚本）；完成后重验
- 触发依据：`clarifications/verify-20260916-160720-pr-003-…md` 逐项判定；DC-14 / DC-18 裁定

### 2026-09-16 16:12:00 · 派发 · dev（pr-003 返工）

- 阶段：阶段 5（PR 实现）· 同一 PR 的返工（不新建 PR / worktree / 分支）
- 任务：仅按【标准 3 fail】把「验收证据」段重做为**仓内命令 + 原样输出**（简报含强制格式模板：逐条 AC = 可复制命令 + 紧跟原始输出；禁止结论词/摘要；附正反例）
- PR：prs/pr-003-sse-transport-additions.md；worktree 分支 feat/0029-pr-003-sse-transport-additions
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 16:20:32 · 收到报告 · dev（pr-001 返工）

- 1. 改动文件：**仅** `prs/pr-001-router-status-primitives.md`（未改实现代码/其他 PR 文件）；提交 `fe67383`
- 2. 验收结果：`## 验收证据` 全部改为"可复制命令 + 原样 stdout/stderr"代码块；**基线 `72b659f` 对照**：8 个既有 UDS 方法 → 全 `true`、`router.status` 既有字段投影 → `true`、`oamp status` 四列及顺序 → `true`；当前功能实跑：同进程 `generation` 稳定 `stable: true`、重启后变化（两组不同 UUID）、`connected=true/false` 与 `offline` 三态成立、`started_at` 首次写/重复不覆盖/未开始为 `null`、`task_cancel` 四分支、SDK 仅追加 `taskCancel`；`git diff --check` 通过
- 3. 疑问/待办：无；`clarifications/` 为既有未跟踪文件，**未纳入本次提交**（主 agent 合并前自行处理）
- 4. 边界说明：**未新建 git worktree**（基线用临时 `git archive` 导出）；临时目录与 socket 已清理；未触碰 `web.js`/`surface.js`/`skill/hub.md`/`API.md`/实现语义

### 2026-09-16 16:20:32 · 派发 · verifier（pr-001 重验）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（返工后重验）
- 产出物路径：`feat/0029-pr-001-router-status-primitives` @ `fe67383` + 本 PR 文件
- 验证标准（4 条，含 DC-18 的 tasks 文件口径澄清）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 16:23:44 · 收到报告 · verifier（pr-001 重验）

- 结论：**FAIL**（pass 3 / fail 1 / partial 0 / blocked 0）；报告 `clarifications/verify-20260916-162032-pr-001-router-status-primitives.md`；实报 `powerby/grok-4.6`，`duration_ms=168858`
- 1. 标准 1 **pass**：独立临时 Router 上 `generation` 稳定且重启变化；节点 4 字段 + `connected`；三态可区分；`started_at` 在 `working` 写入；`task_cancel` 四分支；`finishTask` 与 `72b659f` 空白归一全等；会话面仅追加 `taskCancel`
- 2. 标准 2 **pass**：`oamp/` 仅三文件；`*-tasks.md` 不夹带（DC-18 口径）
- 3. 标准 3 **fail**：证据仍走 `/tmp/pr001-*.mjs`；JSON 含 `<session_id>` 占位；末两条 `git diff` 无输出块
- 4. 标准 4 **pass**：八方法既有形状与基线 `OLD4_EQ true`
- ⇒ **功能面已全部通过独立实跑；阻塞点收窄为"证据形态"一项**

### 2026-09-16 16:23:44 · 派发 · dev（pr-001 第二次返工）

- 阶段：阶段 5（PR 实现）· 同一 PR 的第二次返工（只改证据段形态，不改实现）
- 任务：按重验的三条具体不合格重做证据——① 命令必须**仓内可复现**（禁 `/tmp/` 路径，改用 `git -C <ws>` / `node --check` / `node -e '…'` / `oamp` / `uds`）② **禁占位符**（`<...>`/`…`/`xxx`）③ **每条命令（含 `git diff`）都必须紧跟输出块**；允许执行日志形态；提交前用 `grep -nE '/tmp/|<[a-z_]+>|…'` 自查并贴自查输出
- PR：prs/pr-001-router-status-primitives.md
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 16:24:00 · 调度决策 · 阶段推进核查

- 决策内容：**加设"验收前机械自查"闸门**——dev 返工完成后，主 agent 先用 `/tmp/check-evidence-0029.py` 核查「验收证据」段形态（① 无 `/tmp/` 引用 ② 无 `<...>`/`…`/`xxx` 占位符 ③ 每条命令紧跟输出块 ④ 无"通过/正常/符合预期"结论词单独成条），**通过才发起 verifier 重验**，避免"证据形态"类问题反复烧 verifier 轮次（本轮已发生 3 次：pr-001 两轮、pr-002/pr-003 各一轮）。自查器已用已知不合格的 pr-001 证据段验证可复现 verifier 的判定（12 处 `/tmp` 引用、7 处命令无输出块）
- 触发依据：`verify-20260916-162032-pr-001-…md` 标准 3 的三条具体不合格；pr-001 首轮 + 重验两轮都卡在同一标准 ⇒ 需要主 agent 侧的机械前置闸门

### 2026-09-16 16:32:37 · 收到报告 · dev（pr-002 返工）

- 1. 改动文件：**仅** `prs/pr-002-session-registries.md`（重写「验收证据」）；提交 `e561618`（`duration_ms=1774250`，接近 30 分钟上限）
- 2. 内容：AC1~AC12 逐条给出命令 + 原样 stdout；含 `touch` 跨毫秒前移 / 同毫秒不前移两条实测；`ack` 后列表为空、重复/缺失 ack 无副作用、同 `call_id` 再 `add` 返回 `false`
- 3. 疑问/待办：无；`clarifications/` 未提交（不在返工允许范围内）
- 4. 边界违反：**无**

### 2026-09-16 16:32:37 · 调度决策 · 阶段推进核查

- 决策内容：**用机械自查闸门拦下一次注定失败的验收**——自查发现该证据段 14 条命令**全部以 `/tmp/pr002-evidence.mjs <mode>` 为执行体**（`/tmp` 不在仓库内 ⇒ 第三方不可复核），与 pr-001 重验失败的原因同型 ⇒ **不发 verifier**，直接派 **dev 第二次返工**（只改证据可复现性：命令改内联 `node --input-type=module -e '…'` / `bash -c '…'` / 既有入口；禁 `/tmp` 依赖、禁变量回显当输出、每条命令须有输出块）
- 触发依据：`/tmp/check-evidence-0029.py` 对 `prs/pr-002-session-registries.md` 的机械核查（`/tmp` 命中 11+ 处、命令无输出块 1 处）；`verify-20260916-162032-pr-001-…md` 标准 3 的同型判定（`/tmp` 依赖 + 占位符 + 缺输出块）

### 2026-09-16 16:32:37 · 派发 · dev（pr-002 第二次返工）

- 阶段：阶段 5（PR 实现）· 同一 PR 的第二次返工（只改证据段形态）
- 任务：去掉 `/tmp` 脚本依赖，改为**内联可复现命令**；保留真实输出；逐条附输出块；提交前自查 `grep -nE '/tmp/|<[a-z_]+>|…'` 并贴自查输出
- PR：prs/pr-002-session-registries.md
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 19:22:38 · 调度决策 · 阶段推进核查

- 决策内容：环境体检 + 三处收尾盘点。**环境**：`api agents` 全部 online（含 `pb-dev`）、`hub doctor` `pass: true`、我的推送订阅进程 `pb-calls-results-0029` running ✓；近期完成调用出现 `duration_ms: null` 属**集群重启后的记录特征**（0028 同类现象），无功能影响。**三处收尾**：① `pr-001` 返工#2 已把证据改为内联命令形态（机械自查通过：无 `/tmp`、无占位符、真实输出）但**未提交**、且**仍有 2 条 `git diff` 缺输出块** ⇒ 派收尾修复（补输出块 + 提交）；② `pr-002` 返工#2 调用记录为 `completed`+`duration_ms:null`+`text:null` 且**工作区零改动** ⇒ 判定**该轮未落地**（集群重启期记录/执行脱落），**重派**；③ `pr-003` 返工#1（提交 `d7d396e`）机械自查**仍不合格**（`/tmp` 命中 2 处、8 条命令缺输出块）⇒ 派**第二轮返工**
- 触发依据：`/tmp/check-evidence-0029.py` 对三个 PR 文件的机械核查；`git -C <PR worktree> status/log`；`api agents` / `hub doctor` / `hub op:ps` 实测输出；`verify-20260916-162032-pr-001-…md` 标准 3 的历史判定

### 2026-09-16 19:22:38 · 派发 · dev（pr-001 收尾修复 / pr-002 返工#2 重派 / pr-003 返工#2）

- 阶段：阶段 5（PR 实现）· 三个 PR 各自同一 worktree/分支的收尾或返工（不新建 PR / worktree / 分支）
- 任务：pr-001 = 补齐 2 条命令的输出块 + 提交未提交改动；pr-002 = 证据去 `/tmp` 依赖（内联命令）+ 提交；pr-003 = 证据去 `/tmp` 依赖（内联命令）+ 补齐输出块 + 提交
- 通道：hub `api calls create`（background，同轮发起），agent=dev → 节点 `pb-dev`

### 2026-09-16 19:22:55 · 调度决策 · PR 失败判定

- 决策内容：`pr-001` 收尾修复调用 `task-eba25366` **派发即失败**（`error = context_crashed`、`text = "子进程已退出"`、`duration_ms = 0`；同轮另两条 `dev` 调用正常）⇒ 判定为**实例首次上下文建立期的崩溃**（`pb-dev` 新进程 `pid=24099` 的 `CONTEXT_READY` 同期出现），登记 **DC-21**；处置 = **重派**同一 brief，不改变任务内容
- 触发依据：`hub api calls get task-eba25366…` 的终态信封；`oamp/.runtime/cluster/pb-dev.log` 的 `RPC_READY pid=24099` / `CONTEXT_READY ctx-24099-3`

### 2026-09-16 19:33:01 · 收到报告 · dev（pr-002 返工#2）

- 1. 改动文件：**仅** `prs/pr-002-session-registries.md` 的「验收证据」段（改为仓库绝对路径 + `node --input-type=module -e` 内联脚本；拆分复合命令使每条 `$` 行都有独立输出块）；提交 `c9bc05a`（`duration_ms=609389`）
- 2. 自查：`grep -nE '/tmp/|<[a-z_]+>|…'` 命中仅自查命令与其输出自身（自指），无 `/tmp` 取证命令、无占位符命令
- 3. 主 agent 机械复核：段长 13485 字符 / 17 条命令 / 34 个代码块 / **0 条缺输出块** ✓（被标 4 处均为自查命令自指回显，判无害）
- 4. 边界：功能与实现零越界；因存在未跟踪的 `clarifications/`，**只对 PR 文件做 `git add`**（未用 `-A`，避免误提交无关目录）——处置正确
- 5. 提交后工作区仅剩既有未跟踪 `clarifications/` ✓

### 2026-09-16 19:33:01 · 派发 · verifier（pr-002 重验）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（返工后重验）
- 产出物路径：`feat/0029-pr-002-session-registries` @ `c9bc05a` + 本 PR 文件
- 验证标准（4 条，含 DC-18 的 tasks 文件口径澄清）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 19:38:05 · 收到报告 · verifier（pr-002 重验）

- 结论：**PASS**（pass 4 / fail 0 / partial 0 / blocked 0）；报告 `clarifications/verify-20260916-193301-pr-002-session-registries.md`；实报 `powerby/grok-4.6`，`duration_ms=278756`
- 1. 标准 1 **pass**：两模块可独立 import；导出 `upsert/get/touch/requesterOf` 与 `add/listByRequester/ack`；零 import；`upsert` 幂等；形态与 `isValidInstanceId` 15 例同判；无定时器；`requesterOf` 不登记；`add` 不覆盖；`listByRequester` 隔离；`ack` 后列表为空且重复/缺失不抛
- 2. 标准 2 **pass**：`oamp/` 仅两个新建文件；`*-tasks.md` 不夹带（DC-18 口径）
- 3. 标准 3 **pass**：证据为**仓内** `node -e`/`grep`/`git` + 原样 stdout（**证据形态治根见效**）
- 4. 标准 4 **pass**：既有 `web.js`/`inbox.js`/`persist.js` 空 diff
- 5. 偏差 3 条（不阻塞）：文档仍写 `resolve`；`ack` 软标记不删 Map；形态规则手写循环而非 import `isValidInstanceId` —— 均为此前已裁定/登记项

### 2026-09-16 19:38:05 · 调度决策 · 槛位释放

- 决策内容：pr-002 **PASS ⇒ 合并进迭代分支**（merge commit `cfb6736`；含 `oamp/src/principals.js`、`oamp/src/pickup.js`、PR 文件、tasks 文件、两份验收报告）；合并前先在其 PR 分支**收录验收报告**（`d786b1f`，因重验报告写在 PR worktree 内且未被提交）；合并后**清理**该 PR worktree 与分支（`git worktree remove` + `branch -d`）⇒ **槛位释放**：累计槛位释放次数 **1**，按公式重算 `当前有效上限 = min(3 + 1×3, 5) = 5`
- 解锁扫描（按 `depends_on` 的实际合并状态）：`pr-004`（无依赖）、`pr-008`（无依赖）均在排队 ⇒ 本次补位派发这两个；`pr-005`（依赖 pr-001/pr-002/pr-003）**仍锁定**（pr-001/pr-003 未合并）；`pr-006`（依赖 pr-005）、`pr-007`（依赖 pr-001/pr-005 + 调度附加约束须待 pr-006）维持锁定
- 触发依据：`clarifications/verify-20260916-193301-pr-002-…md` 结论 PASS；`git -C <迭代工作区> log` 显示 `cfb6736`；`prs/*.md` 的 `depends_on`；`status.md` §并发配置 的起始 3 / 硬上限 5

### 2026-09-16 19:38:05 · 派发 · planner（pr-004）+ planner（pr-008）

- 阶段：阶段 5（PR 实现）· 补位派发（两个 PR 的 planner，同轮并发发起）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-004-console-call-stream-stop.md；prs/pr-008-friction-log-completion.md
- 通道：hub `api calls create`（background），agent=planner → 节点 `pb-planner`

### 2026-09-16 19:42:03 · 收到报告 · dev（pr-003 返工#2）

- 1. 改动文件：**仅** `prs/pr-003-sse-transport-additions.md` 的「验收证据」段；提交 `a1efcc9`（`duration_ms=1111802`）
- 2. 形态：所有 import 改为 PR worktree **绝对路径**；移除 `ROOT=…` 前缀；**AC8 改为内联 `git show` 读基线 + `data:` URL 比对**（彻底不依赖 `/tmp`）；AC9 拆为独立命令
- 3. 自查：命中仅为 PR 原有验收标准里的 `<callId>`/`<id>` 说明语法与自查命令自身 ⇒ 无 `/tmp` 取证命令、无占位符命令
- 4. 主 agent 机械复核（自查器 v3，heredoc 感知）：命令形态 = `$ node --input-type=module <<'NODE' … NODE` + 紧跟原样输出 ✓ ⇒ **判通过**；此前 v2 报的"8 条缺输出块"系**检查器误判**（heredoc 命令与输出同处一块），已修检查器
- 5. 边界：功能零越界；针对 PR 文件 `git add`（未用 `-A`）✓

### 2026-09-16 19:42:03 · 派发 · verifier（pr-003 重验）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（返工后重验）
- 产出物路径：`feat/0029-pr-003-sse-transport-additions` @ `a1efcc9` + 本 PR 文件
- 验证标准（4 条，含 DC-18 口径）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 19:43:07 · 收到报告 · planner（pr-004）

- 1. 任务列表路径：`prs/pr-004-console-call-stream-stop-tasks.md`（303 行）；worktree `feat/0029-pr-004-console-call-stream-stop`；**本次简报地址无误**；commit `77db6db`，diff 仅该文件；`duration_ms=276150`
- 2. 任务数：**5**（T1 基线取证 / T2 一行适配 `unsubscribe()` / T3 静态守门 / T4 真集群浏览器 smoke / T5 证据落盘）；**7 条 AC 全覆盖、无孤儿任务**
- 3. 依赖图：6 条边**无环**，拓扑序 `T1<T2<T3<T4<T5`，**最长链 4 节点**（`T1→T2→T4→T5`）
- 4. model_inferred：**1 条**（MI-P1：以"终态后 `#call-hint` 不含'订阅中断'、`className` 不含 `error`"作为 AC5 可判定判据）
- 5. 疑问/越界（8 条，均已逐条读到）：① **AC4"无每秒重连"在 base `cfb6736` 上不可复现**（`closeKey` 仍 0 调用点 ⇒ 服务端不关流 ⇒ `EventSource` 不重连），改为可复现等价判据；② AC3 已终态场景在 base 下无帧可收 ⇒ 降为"零差异（无回归）"；③ **截图不入库**（文件范围只含 `calls.js` + PR 文件）；④ 基线 commit = `cfb6736`（与 pr-001~003 的 `72b659f` 不同）；⑤ **指出简报引用了不存在的 `DC-13`**（PR worktree 的 deferred 副本止于 DC-09）；⑥ 验证配方可执行性已读码核对（修正两处会让 dev 卡住的缺陷：提示条落点为 `#call-hint`、`repo_url` 唯一键）；⑦ 粒度决策未写 `roles/planner/data/`（不在文件范围）；⑧ 无架构信息缺口

### 2026-09-16 19:43:07 · 调度决策 · 阶段推进核查

- 决策内容：对 `planner(pr-004)` 的 1 条 `model_inferred` 与 8 条疑问逐条裁定——**MI-P1 采纳**；**疑问①②③④⑦⑧ 采纳其口径**；**疑问⑤ 确认为主 agent 侧缺陷**（PR worktree 的 `deferred-demand-changes.md` 副本止于 DC-09：DC-10~DC-21 增量未提交进迭代分支 ⇒ 各 PR worktree 看到的是旧副本），**处置**：下一步在迭代分支提交增量（docs 提交），使后续 worktree 与阶段 6 看到最新版本；**疑问⑥ 采纳**（它读码修正的 `#call-hint`、`repo_url` 唯一键两处缺陷，避免 dev 卡住）
- 触发依据：`prs/pr-004-console-call-stream-stop-tasks.md` §6/§7；`architecture.md` §1.3 F-12 / §6.2 S-9 / §7 L2-13 / §11.2 O-4；`git -C <pr-004 worktree> log` 显示 base `cfb6736`

### 2026-09-16 19:43:07 · 派发 · dev（pr-004）

- 阶段：阶段 5（PR 实现）· 常规派发（不新建 PR / worktree / 分支之外的动作）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务，再实现，产出最小实现
- PR：prs/pr-004-console-call-stream-stop.md；worktree 分支 feat/0029-pr-004-console-call-stream-stop
- 附加约束：证据段**禁 `/tmp` 依赖**（任务文件里的 `/tmp/*.json` 基线做法须内联化）、禁占位符、每条命令附原样输出
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 19:46:19 · 收到报告 · verifier（pr-003 重验）

- 结论：**PASS**（pass 3 / partial 1 / fail 0 / blocked 0）；报告 `clarifications/verify-20260916-194203-pr-003-sse-transport-additions.md`；实报 `powerby/grok-4.6`，`duration_ms=215792`
- 1. 标准 1 **partial**：关流只关 `call:` / 谓词 AND / 不补发 / 四键空间与 `72b659f` JSON 全等 / 零 import —— 通过；不通过侧仅条文"13 个导出键"的计数（实际基线 11 + 追加 3，**DC-14 既定裁定**）
- 2. 标准 2 **pass**：`oamp/` 仅 `transport.js`；`*-tasks.md` 不夹带
- 3. 标准 3 **pass**：证据为**仓内** heredoc/`grep`/`git`；**verifier 抽出 AC1/AC8 命令实跑，AC1 stdout 与文件逐字相同**
- 4. 标准 4 **pass**：既有 publish 不投喂过滤表；`globalCount` 不变
- 5. 偏差 2 条（不阻塞）：`closeKey` 计数；`closeAll` 不断开过滤订阅（= MI-2 既定裁定）

### 2026-09-16 19:46:19 · 调度决策 · 槛位释放

- 决策内容：pr-003 **PASS ⇒ 合并进迭代分支**（merge commit `f8f382a`；含 `oamp/src/transport.js`、PR 文件、tasks 文件、两份验收报告；合并前在其 PR 分支收录报告 `214232c`）；合并后**清理** worktree 与分支 ⇒ **槛位释放**：累计释放 **2**，`当前有效上限 = min(3 + 2×3, 5) = 5`（维持硬上限）
- 解锁扫描：`pr-005`（依赖 pr-001/pr-002/pr-003）——pr-002 ✓、pr-003 ✓、**pr-001 未合并** ⇒ **仍锁定**；`pr-006`（依赖 pr-005）、`pr-007`（依赖 pr-001/pr-005 + 调度附加约束须待 pr-006）维持锁定；已解锁在途 = pr-004、pr-008 ⇒ 本回合**无新补位**
- 触发依据：`clarifications/verify-20260916-194203-pr-003-…md` 结论 PASS；`git -C <迭代工作区> log` 显示 `f8f382a`

### 2026-09-16 19:47:37 · 收到报告 · planner（pr-008）

- 1. 任务列表路径：`prs/pr-008-friction-log-completion-tasks.md`（271 行）；worktree `feat/0029-pr-008-friction-log-completion`；commit `ffb5091`；简报地址无误
- 2. 任务数：**4**（T1 核对类 / T2 自检类 / T3 改动类 / T4 落盘类），拓扑序 `T1<T2<T3<T4`，无循环依赖
- 3. model_inferred：**2 条**（MI-P1：AC7"文件内"读法 (a)/(b) 之二择；MI-P2：AC3 按语义判定 + 字面命中原样入证）
- 4. 疑问/越界：**7 条**——① F-8 已由 `DC-03` 承载，不新立条目 ② **`status.md` 台账缺 D-13 三问中的两列（是否需盯守 / 耗时）**，属主 agent 维护面，请主 agent 决定是否补 ③ 简报引用的 `DC-13` 在其副本中不存在（**副本过期**）④ 简报地址无误 ⑤ 粒度记录未写 `roles/planner/data/`（不在范围）⑥ 无架构缺口 ⑦ 其自证规避设计（追加点在文件末尾 ⇒ AC4 的删除行数=0 由位置保证）

### 2026-09-16 19:47:37 · 调度决策 · 阶段推进核查

- 决策内容：对 `planner(pr-008)` 的 2 项 `model_inferred` 与 7 条疑问逐条裁定——**MI-P1 采纳读法 (b)** 但**编号改为下一个空闲 `DC-22`**（其任务文件基于**过期副本**（止于 DC-09）而计划追加 `DC-10`，与真源已到 `DC-21` 及既有 `DC-10`（简报路径笔误条目）**双重冲突** ⇒ 必须纠正；并要求 dev 动手前用 `git checkout iteration/… -- <目标文件>` **刷新到最新**）；**MI-P2 采纳**（语义判定 + 字面命中原样入证）；**疑问 1 采纳**（F-8 复用 `DC-03`，不新立真源）；**疑问 2 由主 agent 处置**（已把 `status.md` 派发台账补上"① 是否需盯守 ② 耗时"两列、三问齐备，本 PR 仍不触碰 `status.md`）；疑问 3 解释为副本过期（刷新后可见）；疑问 4~7 采纳
- 触发依据：`prs/pr-008-friction-log-completion-tasks.md` §6/§7；真源 `deferred-demand-changes.md`（已到 DC-21）与 `status.md` 台账实测列；DC-10 占用事实（history 15:39:42 条）

### 2026-09-16 19:47:37 · 派发 · dev（pr-008）

- 阶段：阶段 5（PR 实现）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务，再实现，产出最小实现
- PR：prs/pr-008-friction-log-completion.md；worktree 分支 feat/0029-pr-008-friction-log-completion
- 附加约束：**先刷新目标文件到迭代分支最新版**；追加条目编号用 **`DC-22`**；证据禁 `/tmp` 依赖、禁占位符、每条命令附原样输出
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 19:48:00 · 收到报告 · dev（pr-001 收尾修复）

- 1. 过程：首派 `task-eba25366` 以 `context_crashed` 立即失败（DC-21）⇒ 重派 `task-5393eaed`；终态 completed，`duration_ms=1418598`（23.6 分钟）
- 2. 交付：证据段补齐输出块并提交（提交 `5e2bd16`）；`git -C <pr-001 worktree> status --short` 仅剩既有未跟踪 `clarifications/`（干净）
- 3. 主 agent 机械复核（自查器 v3）：**✅ 通过**（无 `/tmp`、无占位符、命令均有输出块、无结论词充数；仅剩自查命令自指回显，判无害）
- 4. 决策：具备送验条件 ⇒ 发起**第二次重验**（首次重验仅标准 3 fail，且其不合格点已逐条消除）

### 2026-09-16 19:48:00 · 派发 · verifier（pr-001 第二次重验）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（收尾修复后重验）
- 产出物路径：`feat/0029-pr-001-router-status-primitives` @ `5e2bd16` + 本 PR 文件
- 验证标准（4 条，含 DC-18 口径）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 19:54:25 · 收到报告 · verifier（pr-001 第二次重验）

- 结论：**PASS**（pass 3 / partial 1 / fail 0 / blocked 0）；报告 `clarifications/verify-20260916-194800-pr-001-router-status-primitives.md`；实报 `powerby/grok-4.6`，`duration_ms=271839`
- 1. 标准 1 **pass**：独立临时 Router 上 `generation` 稳定且重启变化；节点 4 字段 + `connected`；三态可区分；`started_at` 在 `working` 写入；`task_cancel` 四分支；`finishTask` 与 `72b659f` 空白归一全等；会话面仅追加 `taskCancel`
- 2. 标准 2 **pass**：`oamp/` 仅三文件；`*-tasks.md` 不夹带
- 3. 标准 3 **partial**：命令已改为**仓内** `node -e`/`git`、无 `/tmp` 脚本；剩余问题为第 116–121 行仍有"逐条判定：通过"转述、且把八方法基线对照推给外部报告（**不阻塞**）
- 4. 标准 4 **pass**：八方法既有形状 `OLD4_EQ true`
- 5. 偏差 2 条（不阻塞）

### 2026-09-16 19:54:25 · 调度决策 · 槛位释放

- 决策内容：pr-001 **PASS ⇒ 合并进迭代分支**（merge commit `51eb893`；含三文件的实现改动、PR 文件、tasks 文件、**三份验收报告**）；合并前在其 PR 分支收录报告（`17d9f72`）；合并后清理 worktree 与分支 ⇒ 槛位释放累计 **3**，`当前有效上限 = min(3 + 3×3, 5) = 5`（维持硬上限）
- **解锁校验（换了方法，避免误判）**：`git branch --merged` 因分支已清理而不适用 ⇒ 改用 ① `git merge-base --is-ancestor` 核对三个合并提交（`cfb6736` / `f8f382a` / `51eb893`）**均为迭代分支祖先** ✓；② 核对依赖产出的**代码符号在树上**（`oamp/src/principals.js`、`oamp/src/pickup.js` 存在；`transport.js` 含 `closeCallSubscriptions`；`registry.js` 含 `connected`；`router.js` 含 `task_cancel`）✓ ⇒ **`pr-005` 三条依赖全部真实合并，正式解锁**
- 并发账：在途 PR = pr-004、pr-008（2）⇒ 本次补位可派 1 个 ⇒ 派 **pr-005**
- 触发依据：`clarifications/verify-20260916-194800-pr-001-…md` 结论 PASS；上述两条解锁校验的实测输出；`prs/pr-005-web-session-and-call-surface.md` 的 `depends_on`

### 2026-09-16 19:54:25 · 派发 · planner（pr-005）

- 阶段：阶段 5（PR 实现）· 补位派发（解锁后立即派，不等待其他在途 PR）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-005-web-session-and-call-surface.md（**本迭代最大 PR**：16 张卡 / 70 条验收 / 单文件 `oamp/src/web.js`）
- 附加约束：因单次调用 30 分钟上限，任务文件**必须给出分段增量**（PR 文件已给"段一/段二"骨架），保证任一子集完成都能落盘可验证增量
- 通道：hub `api calls create`（background），agent=planner → 节点 `pb-planner`

### 2026-09-16 19:55:31 · 派发 · planner（pr-005）

- 阶段：阶段 5（PR 实现）· 解锁后补位派发（pr-005 三条依赖已全部真实合入）
- 任务：先拆该 PR 内部的任务（子 agent 内部步骤，不产出全局任务图），再供 dev 消费
- PR：prs/pr-005-web-session-and-call-surface.md；worktree 分支 feat/0029-pr-005-web-session-and-call-surface（**从 `51eb893` 拉出**，含本迭代全部已交付产物与最新 `deferred-demand-changes.md`）
- 附加约束：本迭代最大 PR（16 卡 / 70 条验收 / 单文件 `oamp/src/web.js`）⇒ 任务文件**必须给出分段增量**（每段自带可验证落点），以适配 30 分钟调用上限
- 过程小事故（自记）：首次派发因**漏生成简报文件**（`cat` 空文件）被调用面以 400 拒绝；已补建**规范 planner 简报生成器**并重派成功
- 通道：hub `api calls create`（background），agent=planner → 节点 `pb-planner`；call `task-6e2093f3`

### 2026-09-16 20:02:03 · 调度决策 · PR 失败判定

- 决策内容：`pr-005` 的 planner 调用 `task-6e2093f3` 虽为 `completed` 终态，但**交付物缺失**（tasks 文件不存在、worktree 无提交、报告止于"Writing the tasks file."、耗时仅 7.2 分钟）⇒ 判**未交付**，登记 **DC-22**（"终态不可信"的第二面），并**重派**同一 brief
- 触发依据：`prs/` 目录实测（无 `pr-005-…-tasks.md`）；`git -C <pr-005 worktree> log` 停在 base；`hub api calls get task-6e2093f3…` 的正文尾部；对照 pr-002 的 `task-efcf2e6b`（同类：`completed` 但产物零变化）

### 2026-09-16 20:05:23 · 收到报告 · planner（pr-005 重派）

- 1. 任务列表：`prs/pr-005-web-session-and-call-surface-tasks.md`（**517 行 / 63439 B**）；commit `ffd394e`；`duration_ms=175652`
- 2. **首轮失败根因补全**：planner 自述"首次写入时 **provider 连接中断**，文件未落盘"⇒ **DC-22 的根因 = provider 侧中断**（非 agent 提前放弃）；本轮改为**三段写入**并先确认无残留半成品
- 3. 任务数：**15**（T0~T14），按 PR 自身体量分**三段**（段 A 会话面 T1~T5 / 段 B 调用面 T6~T12 / 收口 T13~T14）；**11 组 ~50 条 AC 全覆盖、无孤儿任务**
- 4. 依赖图：**39 条边**逐条枚举、机器可核对、**无环**；**最长依赖链 9 节点**；§3 给出 15 次调用的增量表 + 段末共同判据（"段 A 未收口不得开始段 B"）✓
- 5. model_inferred：**3 条**（MI-P1 T8 至多一帧终态帧的可观测判据 / MI-P2 两过滤参数皆缺 ⇒ 谓词恒真 / MI-P3 `health.agents.total` 成分与名册提示计入 `reconnecting`）
- 6. 疑问/越界：① **依赖已满足**（base `51eb893` 已含 pr-001/002/003 ⇒ 所需符号均在树内，无需兼容分支）② **两处"设计稿 vs 已合并实现"的命名差异**（`generation` 小写、`task_cancel` 错误码经 JSON-RPC `data.code`）⇒ 已写进 §0.3 锚点 ③ 两处刻意安排的依赖方向（`T6→T7`、`T3→T4`）④ `/api/calls/wait` 位置纪律须"可达性 + 反证 + 恢复后复跑" ⑤ 冒烟配方已逐条读码核对（`@pb-dev !sleep N` 走 shell 分支 ⇒ 无模型调用）⑥ 称"`DC-13` 不存在" ⑦ 粒度记录未写 `roles/planner/data/`

### 2026-09-16 20:05:23 · 调度决策 · 阶段推进核查

- 决策内容：裁定 `planner(pr-005)` 的 3 条 `model_inferred`——**全部采纳**（MI-P1 的机制选择属 L3 交 dev；MI-P2 与已合并 `handleSubscribe` 缺省语义一致；MI-P3 明确 `total` 成分）；**疑问⑥ 判不成立**（实测该 worktree 的 `deferred-demand-changes.md` 已含到 `DC-21`，其"只有 DC-09"的观察错误）；疑问②③④⑤ 采纳并要求 dev 按**已合并实现**命名、按分段增量提交
- 触发依据：`prs/pr-005-…-tasks.md` §6/§7；`git -C <pr-005 worktree> merge-base --is-ancestor 22e17aa HEAD` 成立 + 该文件 `grep DC-` 实测到 `DC-21`；`oamp/src/registry.js:30` 与 `RpcError.dataCode` 锚点

### 2026-09-16 20:05:23 · 派发 · dev（pr-005）

- 阶段：阶段 5（PR 实现）
- 任务：逐 PR 在独立 PR worktree 分支、独立子 agent 中执行：先拆该 PR 内部的任务，再实现，产出最小实现
- PR：prs/pr-005-web-session-and-call-surface.md；worktree 分支 feat/0029-pr-005-web-session-and-call-surface
- 附加约束：**每段完成即提交**（防 30 分钟切断导致零增量）；按已合并实现的命名；证据禁 `/tmp`、禁占位符、每条命令附原样输出；`calls/wait` 位置纪律须含"恢复后复跑"
- 通道：hub `api calls create`（background），agent=dev → 节点 `pb-dev`

### 2026-09-16 20:06:14 · 收到报告 · dev（pr-004）

- 1. 改动文件：`oamp/web/calls.js`（在 `handleCallEvent()` 的 `call_result` 分支末尾追加既有 `unsubscribe();`，**一行**）+ 本 PR 文件（证据）；提交 `45027a6`；`duration_ms=1371169`
- 2. 测试与验收：AC1~AC7 通过——AC6 `git diff --numstat` = `1 0 oamp/web/calls.js`；AC7 静态计数 `setInterval=1 / new_EventSource=1 / unsubscribe_definition=1 / selectedId_in_unsubscribe=0`；`node --check` `syntax_exit=0`；`git status --short` 无输出
- 3. 自查：`grep -nE '/tmp/|<[a-z_]+>|…'` 仅命中自查命令自身；主 agent 机械复核判**通过**
- 4. 疑问/待办：当前 base 的 `!sleep` shell 调用在真集群 smoke 中未产生 `call_result`（服务端关流依赖 pr-005），故**未取得真实 `fin`**；AC4 按其**等价判据**（浏览器注入终态帧 ⇒ 立即关闭、无错误提示）验证，严格服务端场景留待 pr-005 合并后
- 5. 边界违反：**无**（未改 `oamp/src/**` 或其它 `oamp/web/**`；真集群进程已停止；未推送/合并/切分支）

### 2026-09-16 20:06:14 · 派发 · verifier（pr-004）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（merge 前置）
- 产出物路径：`feat/0029-pr-004-console-call-stream-stop` @ `45027a6` + 本 PR 文件
- 验证标准（4 条，含 DC-18 口径）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`

### 2026-09-16 20:09:47 · 收到报告 · verifier（pr-004）

- 结论：**PASS**（pass 2 / partial 2 / fail 0 / blocked 0）；报告 `clarifications/verify-20260916-200609-pr-004-console-call-stream-stop.md`；实报 `powerby/grok-4.6`，`duration_ms=198969`
- 1. 标准 1 **partial**：`call_result` 后调用既有 `unsubscribe()`（diff `1 0`）；`selectedId` 保持；**独立页在服务端不关流时 1.6s 内无重连**（`STREAM_CONNS=2`）——**均由 verifier 用 jsdom 级/原生 `EventSource` 探针独立复现**；不通过侧：第 26 行"真集群 Network"未在本 worktree 静态面上取到 `call_result`（**已由 planner 预先声明为不可复现项**，等价判据已采纳）
- 2. 标准 2 **pass**：`oamp/` 仅 `calls.js`；`*-tasks.md` 不夹带
- 3. 标准 3 **partial**：`git diff`/`numstat`/`node --check` 可复核；浏览器机制部分 JSON **无 `$` 命令、含转述**（不阻塞——该部分由 verifier 自行独立复跑替代）
- 4. 标准 4 **pass**：html 与基线全等；roster 6 列；`app.js` 未改
- 5. 越界自查：未改代码/PR 文件；未操作 :7788 主集群 ✓

### 2026-09-16 20:09:47 · 调度决策 · 槛位释放

- 决策内容：pr-004 **PASS ⇒ 合并进迭代分支**（merge commit `4c6ddba`；含 `oamp/web/calls.js` 一行适配、PR 文件、tasks 文件、验收报告；合并前收录报告 `32e5fe6`）；合并后清理 worktree 与分支 ⇒ 槛位释放累计 **4**，`当前有效上限 = min(3 + 4×3, 5) = 5`（维持硬上限）
- 解锁扫描：`pr-006`（依赖 pr-005）**仍锁定**；`pr-007`（依赖 pr-001/pr-005 + 调度附加约束须待 pr-006）**仍锁定**；已解锁在途 = pr-005、pr-008 ⇒ 本回合**无新补位**；**累计进度 4/8 已合并**
- 触发依据：`clarifications/verify-20260916-200609-pr-004-…md` 结论 PASS；`git -C <迭代工作区> log` 显示 `4c6ddba`；`grep -c unsubscribe() <迭代工作区>/oamp/web/calls.js` = 3（改动确已进迭代分支）

### 2026-09-16 20:35:32 · 收到报告 · dev（pr-008）

- 1. 调用终态 `completed`（`duration_ms` 记录为 null，集群重启后的记录特征）；提交 `9a76c80 feat(0029-pr-008-friction-log-completion): 补齐摩擦台账口径`；工作区干净（仅既有未跟踪 `clarifications/`）
- 2. **裁定被执行且生效**：目标文件已被**刷新到最新**（含 `DC-20` / `DC-21`），并在末尾追加 **`DC-22`**（未再使用作废的 `DC-10`）✓
- 3. 主 agent 机械复核（自查器 v3）：**通过**（仅自查命令自指回显被标，判无害）
- 4. 交付内容：F18 口径补齐（摩擦搭置记录核对 + 指向行 + 自检/守门命令族 + 证据段）

### 2026-09-16 20:35:32 · 派发 · verifier（pr-008）

- 阶段：阶段 6（独立验证）· 阶段 5 逐 PR 验收（merge 前置）
- 产出物路径：`feat/0029-pr-008-friction-log-completion` @ `9a76c80` + 本 PR 文件 + 目标文件（`deferred-demand-changes.md`）
- 验证标准（4 条，含 DC-18 口径）
- 通道：hub `api calls create`（background），agent=verifier → 节点 `pb-verifier`
