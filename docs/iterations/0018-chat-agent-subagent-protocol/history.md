> **时标口径声明（2026-09-12 按 progress-observer 核实后补记）**：本文件条目中的时间字段是**记录时的本地时钟读数**，可能存在超前偏差（实测部分条目超前 git committer 时间 15~25 分钟）。**权威时间以 git 一手记录为准**：凡条目涉及提交/合并的，以该条注明的 commit sha 的 committer time 为准确时间；时标本身不作为事实依据。

# history.md — 0018-chat-agent-subagent-protocol
### 2026-09-12 17:27:04 · 调度决策 · 阶段推进核查

- 决策内容：工作流启动（迭代 ID = 0018-chat-agent-subagent-protocol，用户裁决）；创建 status.md + history.md；阶段 1 置 ⏸；迭代分支延后至阶段 1 通过后创建，base = iteration/0017-project-workspace（用户裁决，偏离 v0.8.0 默认「从 main 拉出」）；0017 现场 `.pb-agents/worktrees/pr-004`（feat/pr-004 @ 60ba902）按「现场保留」不清理、不纳入 0018 范围
- 触发依据：用户指令「使用 workflow-pb 流程沟通需求后迭代」；Step 0 检测 `.pb-agents/roles/` 存在且与 `roles/` 的 .md 内容一致（`diff -rq` 仅 `data/`、`memory.md`、`_template`、`cdp-debug-skill` 差异，均为不部署项）；0017 status.md 阶段 5 未完成且 `hub jobs` 无存活 dev 作业（pr-004 作业已丢失）

### 2026-09-12 17:27:04 · 调度决策 · Gate确认

- 决策内容：阶段 0 两项用户裁决——① 迭代 ID = `0018-chat-agent-subagent-protocol`；② 0017 未完成的处理 = 「0018 从 0017 迭代分支起」（未采纳「先收尾 0017 再从 main 起」与「从 main 起」）
- 触发依据：主 agent 真实阻塞式转呈（`ask`：两项提问各 3 个选项）并取得用户逐项回答；status.md §用户确认记录（Gate）

### 2026-09-12 17:27:04 · 派发 · demand

- 阶段：阶段 1（需求收敛，第一轮）
- 任务：通过结构化对话消除模糊、界定边界，产出有澄清依据的需求合同
### 2026-09-12 17:32:03 · 收到报告 · demand

- 1. demand.md 路径：docs/iterations/0018-chat-agent-subagent-protocol/demand.md（343 行，v1.0.0 待确认版，两段均有内容）；澄清记录：clarifications/round-1.md（135 行）；待裁决清单：clarifications/demand-round-1-proposals.md（264 行）
- 2. 第一段摘要：M-1~M-11 全部 model_inferred（参照契约 / 等价判定口径 / 交付边界 / 被调用者生命周期 / 调用身份 / 寻址命名空间 / 调用面 I1~I11 / 响应面 R1~R7 / 展示面 D1~D7 / 控制面 / 与 0017 共存）；逻辑闭环三条 why → 三面均可推出，产出 4 处缺口；边界完整性：用户明说边界 0 条，N1~N20 全为推导；内部一致性 C-1~C-8（活跃待决 4：生命周期 vs 0015 R-1/R-2、0015 N5 vs 按 id 寻址、API.md:627 vs 转录、仓内既有两处「两者不合并」立场冲突）；可验证性 E1~E10 全过裸判定；第六维未闭合（W1~W7 共 7 条「做什么」全部未被问过）
- 3. 第二段摘要：做什么 = W1 契约锚定（参照 harness task 契约 + 差异清单）/ W2~W5 三面落地（调用面按 role 寻址 + I2/I3/I6/I7；身份复用 task_id 升格；响应面结构化终态 + 内存转录；展示面调用级进度 + roster + 完成通知）/ W6~W7 与 0017 项目层共存 + 文档三锁；不做什么 = N1~N20（客户端 SDK/适配器、启停 agent、取消/终止/steer、isolated/effort、持久化转录、工具级进度与 token/成本、远端同会话渲染、0017 收尾等），逐条附理由
- 4. 方案雏形/参考视角：用户雏形 = 仅给目标、无机制层雏形（故 P-11 逐条征询 W1~W7）；B-1~B-4 参考视角（调用入口形态 / 结构化终态数据来源含 [UNVERIFIED] / 转录复用 Router 任务表 updates[] / role 推导须允许空值），明确不进入结论段
- 5. 待确认项：P-1~P-11（阻塞项 = P-1 参照契约、P-2 被调用者语义、P-4 task_id 升格需解除 0015 N5、P-11 第六维征询）
- 6. 疑问/越界：越界无；自行补充三项判断已声明 = 新增 C-8 立场冲突提示、把「0017 未完成」写成 N20 边界 + 基线声明、明确「等价」判定口径为语义等价 + 差异清单

### 2026-09-12 17:32:03 · 调度决策 · 阶段推进核查

- 决策内容：阶段 1 推进条件未全部满足（「所有 model_inferred 结论经用户确认」未达成；第六维未闭合；4 处活跃冲突待决）→ 不推进阶段 2；转入用户决策点，真实阻塞式转呈 P-1~P-11（按 demand 建议分批：P-2 → P-1 → P-4 优先，其余合并为「覆盖表按推荐 + 三项确认 + 第六维征询」）
- 触发依据：demand.md 为 v1.0.0「待确认版」；clarifications/demand-round-1-proposals.md §4 待确认项汇总（11 条，其中 4 条标「阻塞阶段 1」）；§6 未闭合声明（零条 user_confirmed、第六维 7/7 未问）
### 2026-09-12 17:34:50 · 调度决策 · Gate确认

- 决策内容：用户对 P-1~P-11 全部裁决完毕 → **P-2 = A 但附加身份规则**（用户原话：「同hub和agent之前的约定， 同chat下，同名agent是一个agent，共享上下文。 不同chat下agent是不同agent」——即 agent 身份 = (chat, agent 名)，同 chat 同名共享上下文、跨 chat 互相独立，参照 hub↔agent 既有约定）；**P-1 = A**（参照 harness task 工具契约，等价 = 语义等价 + API.md 差异清单）；**P-4 = A**（task_id 升格为 HTTP 一等资源，用户显式解除 0015 N5，限按 id 读自己发起的调用，不解除任务编排）；**P-3/P-5/P-6/P-7/P-8/P-9/P-10 = 全部按推荐**（只改 hub 侧不做客户端 SDK；调用面按 role 寻址 + 覆盖表 I1~I11；响应面结构化终态 + 内存转录 R1~R7；展示面调用级进度/roster/完成通知 D1~D7；不做取消/终止/steer；调用归属 chat/项目且 project 与 context 并存；P-10 解除 a、沿用 b~g）；**P-11 = 第六维闭合**（用户明确表示 7 条 W 均无机制层想法，交给架构阶段）
- 触发依据：主 agent 真实阻塞式转呈（`ask` 5 组提问：P-2 / P-1 / P-4 / 覆盖面批量 / P-11），用户逐组回答（P-2 为自由文本覆盖选项 A 的默认语义并追加身份规则）

### 2026-09-12 17:34:50 · 派发 · demand

- 阶段：阶段 1（需求收敛，第二轮收敛）
- 任务：通过结构化对话消除模糊、界定边界，产出有澄清依据的需求合同
### 2026-09-12 17:37:36 · 收到报告 · demand

- 1. demand.md 路径：docs/iterations/0018-chat-agent-subagent-protocol/demand.md（v1.1.0 已收敛版，487 行，两段 + 附一来源清单 + 附二参考视角 + 待确认项）；澄清记录：clarifications/round-2.md
- 2. 第一段摘要：S-1~S-6 用户原话事实提取 + G-1/G-2 阶段 0 裁决 + P-1~P-11 原文照录（§6.1）+ W8 身份规则专项（§6.1-A）；现状事实 F-1~F-17；三面覆盖表裁决后最终形态（I1~I11 / R1~R7 / D1~D7 + 差异 ②~⑱）；M-1~M-12 全部 user_confirmed（M-12 = 用户原文新增身份规则）；逻辑闭环 4 处缺口全部落定；边界完整性 N1~N21 逐条附理由；内部一致性 C-1~C-8 全部已决；可验证性 E1~E11 全过裸判定（E8 直接判定身份规则）；第六维闭合（W1~W7 用户明确无想法 + W8 用户自述机制）
- 3. 第二段摘要：做什么 = W1 契约锚定 harness task 契约 + 差异清单 / W2 调用面按 role 寻址（I2/I3/I6/I7）/ W3 调用身份复用 task_id 升格（限读自己发起的调用）/ W4 结构化终态 + 内存转录且不造假不可得字段 / W5 调用级进度 + roster + 完成通知 / W6 调用归属 chat/项目且 project 与 context 并存 / W7 文档三面表 + 差异清单 + 示例 + 三漂移锁 + 零依赖 / W8 agent 身份 = (chat, agent 名)；不做什么 = N1~N21（客户端 SDK、启停 agent、取消/终止/steer、isolated、effort、发现链、嵌套血缘、local:// 根、plan mode、ACP 字段、持久化转录、工具级进度与 token/成本、远端渲染、steer 区分、改 agent↔router 方法面、改上下文池键、任务编排、破既有契约、新依赖/鉴权、跨仓库、0017 收尾）
- 4. 方案雏形/参考视角：P-11 用户明确「都没想过，交给架构阶段」⇒ 第六维闭合；W8 为用户自述机制；B-1~B-5 参考视角（调用入口形态 / 终态字段来源含 [UNVERIFIED] / 转录复用 updates[] / role 推导空值 / one_shot 处置）明确未进入结论段
- 5. 待确认项：Q-1 一条（既有 one_shot:true 路径与 W8 身份规则的关系，用户原文未表态，demand 不擅自裁决）
- 6. 疑问/越界：越界无（未写 prd/architecture/prs、未改代码/status.md/history.md/recon/proposals、未跑测试、未执行 git）；自行判断已声明 = 差异清单编号归类与 role 空值形态标「派生（可回退）」并留痕 §6.3、N17（不做任务编排）由 P-4 范围限定落成、E8 为 W8 新设裸判定

### 2026-09-12 17:38:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 1 推进条件「所有 model_inferred 结论经用户确认」**未满足**（demand.md 附一残留 Q-1 = 唯一 model_inferred 条目，且 demand 明确声明「严格按推进条件，需用户一次答复后才算完全归零」）→ 不推进阶段 2；转入用户决策点，真实阻塞式转呈 Q-1 二选一
- 触发依据：demand.md §待确认项 Q-1 行（含「demand 倾向 ①，改动面最小且不破坏 N18」）；附一来源标注清单「model_inferred（本版仅 1 条残留）= Q-1」；其余两项推进条件已满足（两段均有内容 ✅、C-1~C-8 全部已决 ✅）
### 2026-09-12 17:38:40 · 调度决策 · Gate确认

- 决策内容：用户裁决 Q-1 = **①** —— 既有 `one_shot:true` 路径保留为「调用方主动放弃上下文延续」的**显式例外**，并在 `oamp/API.md` 差异清单登记（demand 落为差异 ⑲）；未选 ②（新调用面不提供 one_shot）与 ③（彻底废除）
- 触发依据：主 agent 真实阻塞式转呈（`ask` 三选项：① 保留为显式例外 / ② 新面不提供 / ③ 彻底废除），用户选择 ①（与 demand 倾向一致）

### 2026-09-12 17:38:40 · 派发 · demand

- 阶段：阶段 1（需求收敛，第三轮——Q-1 归零收口）
- 任务：通过结构化对话消除模糊、界定边界，产出有澄清依据的需求合同

### 2026-09-12 17:40:22 · 收到报告 · demand

- 1. demand.md 路径：docs/iterations/0018-chat-agent-subagent-protocol/demand.md（v1.2.0 已收敛版）；澄清记录：clarifications/round-3.md
- 2. 第一段摘要：Q-1 由「待确认项」升为已裁决结论（§2.3 新增节 + §6.1 新增行 + §6.1-A 点 7）；用户明说边界由 8 条增为 9 条（含 one_shot 例外）；M-1~M-12 全部 user_confirmed；C-1~C-8 全部已决；E1~E11 全过裸判定；第六维仍闭合
- 3. 第二段摘要：W1~W8 / N1~N21 / E1~E11 未因本裁决新增条目；差异清单新增 **⑲**（`one_shot` 的例外地位，编号顺延不复用 ①~⑱）；`one_shot` 与 W8 默认语义（同 chat 同名共享上下文）不再冲突
- 4. 方案雏形/参考视角：P-11 已闭合（不变）；B-5（one_shot 处置）由 Q-1 裁决关闭，内容仍不作为结论；B-1~B-4 仍留架构层
- 5. 待确认项：**无**（`model_inferred` 归零，附一标注「无（归零）」）
- 6. 疑问/越界：越界无；自行判断五项已声明 = ① Q-1 不新增 W/N/E（理由写入 round-3.md §2.4）；② 差异编号顺延为 ⑲；③ one_shot 例外同时记入 §4.3 明说边界与 §5；④ 附二 B-5 标「已关闭」且不进入结论段；⑤ `[架构待填]` 中 one_shot 项改为「例外地位的登记形态」

### 2026-09-12 17:41:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 1（需求收敛）推进条件三项全部通过 → 标记 ✅；创建迭代分支 `iteration/0018-chat-agent-subagent-protocol`（`git branch <新分支> iteration/0017-project-workspace`，随后 checkout，工作区根目录切换至该分支）→ 进入阶段 2（功能规格），派发 prd。同时修正 status.md 基线事实：外部会话已于 17:30:53 把 pr-004 验收（PASS）并合并进 0017 迭代分支（`428e672`）、pr-004 worktree 已清理 ⇒ 0018 基线实际含 0017 全部 4 个 PR 产出；0017 仍缺阶段 6 与合并 main 两步（不属本迭代范围，N21）；`docs/iterations/0017-project-workspace/status.md`、`history.md` 的未提交改动为外部会话所留，主 agent 不提交/不回滚/不改写（B-2）
- 触发依据：demand.md v1.2.0 §4.7 与 §6 停止条件核查（两段均有内容；`model_inferred` 归零、无残留待确认项；C-1~C-8 全部已决）；附一来源标注清单「model_inferred = 无（归零）」；`git log iteration/0017-project-workspace` 显示 428e672（17:30:53，pr-004 merge）、`git worktree list` 显示 pr-004 worktree 已不存在；`ps` 未见 omp 进程（无并发写入者）
### 2026-09-12 17:42:00 · 派发 · prd

- 阶段：阶段 2（功能规格）
- 任务：将需求合同原子化为可独立验证的功能卡，只做产品维度，不做架构决策
### 2026-09-12 17:42:30 · 派发 · progress-observer

- 阶段：阶段 2（功能规格；自动触发——阶段 1 推进完成后保持 progress.md 新鲜）
- 任务：独立核实迭代真实 git 状态（不采信任何自我声明），产出客观进度快照 progress.md
### 2026-09-12 17:43:30 · 收到报告 · progress-observer

- 1. progress.md 路径：docs/iterations/0018-chat-agent-subagent-protocol/progress.md（六部分齐备，整体覆盖写入；观测窗口 T2 = 17:43:21）
- 2. 六部分摘要：① 阶段完成状态——6 阶段逐条核实，阶段 1 ✅ 一致 / 阶段 2 ⏸ 一致 / 阶段 3~5 ⬜ 一致，迭代分支 base=428e672 一致（父指针 + reflog「Created from iteration/0017-project-workspace」），0018 分支祖先含 0017 全部 4 个 PR 合并提交 ② PR 依赖核实——不适用（`prs/` 未产生，阶段 4 未到）③ PR 实现状态核实——不适用（无 pr-*.md / worktree / feat 分支）④ 并发度分析——不适用（无可判定对象；唯一进行中活动 = 阶段 2 的 prd 派发）⑤ 发现的不一致 **4 条** ⑥ 无法核实项 **4 条**（0018 产物零 git 跟踪 / 基线 ref 已消失、只能经父指针与 reflog 间接核实 / 阶段 1 的「推进条件通过」属语义自述 git 不可核实 / pr-004 worktree「已清理」仅现状一致）
- 3. 最需主 agent 关注的发现： **(a) 工作区 HEAD = main 而非本迭代分支**（reflog：17:40:47 checkout →0018、17:41:44 checkout 0018→main），0018 产物当时全部是 main 工作区的未跟踪文件；**(b) 0018 分支 tip `028ca8a` 承载的是 0017 阶段 6 收尾提交**（非本迭代产物），该提交未进 main、仅本分支一个 ref 持有；**(c) 0017 已在观测窗口内完成收口**：main tip `03a2f00` = 「merge: iteration 0017-project-workspace …into main」（17:41:44）、0017 分支 ref 已删除、0017/history.md 另于 17:42:52 被并发会话追加一条收口记录；**(d) 0017 的 verify-stage6 报告在工作区版本与 `028ca8a` 版本之间存在一处字符差异（`:695-699` vs `:695-698`）**
- 4. 疑问/越界：无（未发现 status.md / prs 结构性缺失；`prs/` 不存在属阶段 4 未到的预期状态，已如实标「不适用」并给依据）；本轮严格只读 git + 只写 progress.md

### 2026-09-12 17:45:35 · 调度决策 · 阶段推进核查

- 决策内容：处置「外部会话在同一工作区完成 0017 收口」造成的三处状态冲突 —— ① **不改写任何 ref、不删除他人提交、不替 0017 做提交决策**：`028ca8a`（0017 阶段 6 收尾提交）原样留在 `iteration/0018-chat-agent-subagent-protocol` 上；② 将 0017 两处未提交残留（`history.md` 的 17:42:52 收口记录、`verify-stage6-20260912-173934.md` 的 `:695-698` 修正版）先备份至 `/tmp/pb-0017-residual/`，再 `git checkout -m` 切回本迭代分支，`history.md` 的 3-way 冲突按**并集**手工解决（保留 17:41:44 收口记录 + 17:42:52 记录，标记清空），残留内容原样恢复于工作区未提交状态；③ status.md 登记 C-1（工作区共享冲突与 `028ca8a` 归属）、C-2（0017 两处残留）、C-3（0017 遗留缺陷 D-2 是否纳入本迭代，待用户裁决），并把基线字段修正为 `428e672`（已并入 main `03a2f00`）
- 触发依据：progress-observer 报告第 5 部分 4 条不一致 + 第 3 部分关注项；主 agent 一手复核 `git rev-parse/reflog/branch -v/worktree list/status --porcelain`；`ps` 显示无存活 agent 会话进程（仅 oamp cluster 常驻 daemon），故判定外部会话已收口、可安全切回本分支；阻塞点（`git checkout` 被 0017 残留挡住）以「先备份→移动未跟踪文件→`checkout -m`→并集解冲突→恢复」方式解决，全程零内容丢失
- 说明：本记录的「阶段推进核查」判定为——阶段 2 仍在进行中（prd 未交付），不推进；本次仅处置工作区冲突并修正台账
### 2026-09-12 17:47:38 · 收到报告 · prd

- 1. prd.md 路径 + 功能点总数：docs/iterations/0018-chat-agent-subagent-protocol/prd.md；**16 张卡** = 13 个需求功能点 F01~F13（W1~W8 全覆盖）+ 3 个保证项 F14~F16（既有面零破坏 / 不做项零半成品 / 新增调用面登记义务与工程锁，来源 N15·N16·N18·N19 + E9·E10 + W7 工程侧，不引入新能力）
- 2. prd/ 目录文件列表：F01-contract-anchoring-and-difference-list / F02-api-doc-usability-and-examples / F03-role-addressing-and-discoverability / F04-call-input-contract / F05-call-identity-and-terminal-query / F06-structured-terminal-result / F07-terminal-delivery / F08-call-level-progress / F09-call-roster / F10-call-transcript / F11-call-attribution / F12-agent-identity / F13-console-call-view / F14-existing-behavior-unchanged / F15-no-half-built-out-of-scope / F16-route-registration-and-locks
- 3. model_inferred 标注列表：MI-01 角色不可用失败口径 / MI-02 批量调用粒度 / MI-03 roster 作用域与 N17 边界 / MI-04 无归属调用判定 / MI-05 阻塞时限与断连 / MI-06 截断标记判定对象 / MI-07 roster 起止时间取点 / MI-08 转录内容范围与超上限（清单见 clarifications/prd-round-1.md；均为**验收判定口径**推导，不改变功能范围）
- 4. 架构待填列表：T-01~T-17（T-01~T-12 为 demand §3 原文条目：调用入口路由形态 / 终态信封字段名 / 调用 id 呈现形态 / role 暴露字段与无 role 失败语义 / 调用级事件流路径与 schema / roster 数据来源 / 控制台页面划分 / 转录入口与截断语义 / 期望结构校验落点 / 阻塞取终态的传输形态 / one_shot 例外登记落点 / 测试组织；T-13~T-17 为本次清点：入参与返回字段命名、归属传参与错误码形态、对照表与差异清单在 API.md 的章节位置、可粘贴示例形态、新增路由登记元数据与索引快照重生成方式）
- 5. 疑问/越界：越界无（未改 demand/status/history/clarifications 已有文件、未触碰 oamp/**、未写 architecture/prs、未跑测试、未执行 git）。提请主 agent 裁定 4 项：① F14~F16 保证项定位是否保留（体例先例 0017 F09/F10、0016 F02/F06、0015 F08）；② 三处 E 覆盖缺口（转录无专属 E / I6·I7 无专属 E / 控制台无专属 E）的承载方式是否可接受；③ roster 与 N17 的边界按最窄读法落卡（口径见 MI-03）；④ 两条 派生 口径原样落卡并保留回退口

### 2026-09-12 17:47:38 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2 三项推进条件经主 agent 逐项核查**全部满足**（16 张卡均有独立卡片；W1~W8 全覆盖、E1~E11 全映射、无 demand.md 外新增功能；16 张卡均含 `[架构待填]` 段，卡内零技术选型/数据模型/接口设计）——但产物含 **8 项 `[model_inferred]`**（MI-01~MI-08）→ 按用户决策点规则**暂停推进**，真实阻塞式转呈（合并为 2 组提问：C-3 范围项 + MI 批量口径）；同时主 agent 裁定 prd 提请的 4 项：① **F14~F16 保证项保留**（体例与 0017 F09/F10 一致，不降级为全局边界）；② 三处 E 覆盖缺口**承载方式可接受**（E1~E11 无漏项，缺口已逐条报告且不改变功能范围）；③ roster 边界按最窄读法（待 MI-03 一并确认）；④ 两条 `派生` 口径原样保留（回退口已在 F01 边界与 F03 验收 4 留痕）
- 触发依据：prd.md §MI 判定口径（8 项，状态「待确认」）；prd.md §疑问与越界 第 1~5 条；workflow-pb §用户决策点（产物出现 `[model_inferred]` 未确认项）

### 2026-09-12 17:47:38 · 调度决策 · Gate确认

- 决策内容：用户裁决两项 —— ① **C-3 = 不纳入**：0017 遗留缺陷 D-2（`/api/chats`、`/api/messages` 路由登记元数据缺 `project_id`）**不在本迭代完成**，保持 0018 聚焦于 hub 调用面等价；② **MI-01~MI-08 全部按推荐采纳**（8 项验收口径按 prd 推荐值定案，功能范围 W/N/E 不变）。用户同时提出**一条新需求**：并行会话应各用独立 worktree/clone（`git worktree add`）而不共用同一工作树——本次的丢写与分支错位均源于共用工作树；用户要求**迭代优化 workflow-pb 流程，优先级最高**（落地方式待用户二次确认：独立迭代 0019 vs 纳入 0018；见下一条记录）
- 触发依据：主 agent 真实阻塞式转呈（`ask` 两组提问：C-3 二选一 + MI-01~MI-08 批量三选一），用户逐组回答；MI 明细以 preview 形式完整呈现给用户后获「全部按推荐」

### 2026-09-12 17:48:00 · 派发 · prd

- 阶段：阶段 2（功能规格，第二轮修订）
- 任务：将需求合同原子化为可独立验证的功能卡，只做产品维度，不做架构决策
### 2026-09-12 17:52:00 · 收到报告 · prd

- 1. prd.md 路径 + 功能点总数：docs/iterations/0018-chat-agent-subagent-protocol/prd.md（**v0.2.0 已收敛版**）；仍为 16 张卡（13 需求功能点 + 3 保证项），未因裁决新增/删除任何卡
- 2. prd/ 目录文件列表：16 个 `.md` 均在（F01~F16），本轮修订 F03 / F04 / F05 / F06 / F09 / F10 / F11 / F13 / F16 共 9 张卡
- 3. model_inferred 标注列表：**零残留**——12 处 `[model_inferred MI-xx]` 标记全部转为 `[user_confirmed MI-xx]`（用户裁决「全部按推荐」）
- 4. 架构待填列表：T-01~T-17 不变（未做任何架构决策；16 张卡的 `[架构待填]` 段完整）
- 5. 疑问/越界：越界无；主 agent 4 项裁定（F14~F16 保证项保留 / 三处 E 覆盖缺口承载方式 / roster 最窄读法 / 两条 `派生` 回退口）与 C-3（D-2 不纳入本迭代）均已落盘（prd.md §疑问与越界 第 5~8 条 + F16 边界排除句 + clarifications/prd-round-2.md）

### 2026-09-12 17:52:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2（功能规格）推进条件三项**全部通过** → 标记 ✅。核查证据：① 所有功能点有独立卡片——`prd/` 下 16 个 `.md`，每张含功能 ID / 来源 / 用户价值 / 验收标准（含判定）/ 边界 / 架构待填；② 无 `demand.md` 外新增功能——W1~W8 全覆盖、E1~E11 全映射（无未承载 E）、F14~F16 为保证项不引入新能力；③ 架构待定项已标注——T-01~T-17，卡内零技术选型/数据模型/接口设计。附带核查：卡内与索引 `[model_inferred]` 零残留（仅存文档状态头/来源说明中的历史性表述）
- 触发依据：prd.md v0.2.0 §阶段 2 推进条件自检（四项全 ✅）；`grep -rl model_inferred prd/` 零命中；clarifications/prd-round-2.md 逐卡落地位置清单

### 2026-09-12 17:52:26 · 调度决策 · 阶段推进核查

- 决策内容：**本迭代暂停（阶段 3 不启动）** —— 用户裁决「先做 0019（独立迭代），暂停 0018」，故按用户指令把 0018 停在阶段 2 已收敛状态（阶段 1 ✅、阶段 2 ✅、阶段 3~5 ⬜），状态置「已暂停」并写明恢复条件；同时按用户新需求启动 **0019**（agents 框架：并行会话工作区隔离协议，迭代 ID 暂定 `0019-worktree-isolation-protocol`），0019 完成后回到本迭代阶段 3
- 触发依据：用户对「并行会话各用独立 worktree/clone 不得共用工作树」落地方式的裁决 = **A**（原文选项 A：先做 0019 独立迭代、暂停 0018）；用户对该需求的定性 = 「这个需要迭代优化 workflow-pb 流程，优先级最高」；0018 阶段 2 已收敛（无未确认项、无活跃冲突），是安全的暂停点

### 2026-09-12 17:52:26 · 调度决策 · 迭代收口

- 决策内容：把 0018 的阶段 1~2 产物**落入 git**（在此之前全部为未跟踪文件，存在被外部会话误提交/误清理的风险——即用户点名的共用工作树风险）→ 在 `iteration/0018-chat-agent-subagent-protocol` 上提交 `docs/iterations/0018-chat-agent-subagent-protocol/**`（不含任何 0017 产物、不含任何代码）；随后把 0017 的两处未提交残留 `git stash`（具名保存）以便干净切出该分支，stash 名称与内容登记于 status.md §待确认项 C-2
- 触发依据：rule A（代码变更不得提交在 main/迭代分支）——本次仅提交本迭代文档产物，不涉及代码；用户对共用工作树致丢写的裁决（先做 0019）

### 2026-09-12 22:46:23 · 调度决策 · 阶段推进核查

- 决策内容：**按 workflow-pb v0.10.0 正式恢复本迭代**——① 把当时 main（含 0017 + 0019 + **0020**）整合进本迭代分支（`67c50e0`，0 冲突）；② §恢复设置 改写为 v0.10.0 形态：**会话可在任意位置启动 + 显式寻址**（旧「必须由用户 cd 到工作区启动」的操作前置段作废，该段正是迭代 0020 要消除的强制）；③ 生效规范字段从 v0.9.0 改为 **v0.10.0**；④ 下一步 = 阶段 3（技术架构）
- 触发依据：用户裁决「把 0018 恢复起来」；迭代 0020 已完成并合并 main（`db246e4`/`f7bf41e`）并交付 v0.10.0 与协议产物 `docs/worktrees/README.md`；本迭代 `status.md` §恢复设置

### 2026-09-12 22:46:23 · 派发 · architect

- 阶段：阶段 3（技术架构）
- 任务：在现有架构上演进，补全功能卡的架构维度，产出技术方案

### 2026-09-12 23:00:00 · 收到报告 · architect（阶段 3）

- 1. architecture.md 路径 + 核心组件：`architecture.md`（686 行）——调用面 6 条新路由、3 类新事件、2 个新字段（`role` / `model` 投影）、1 个新控制台页面；复用既有 `message.send` 派发链与任务表
- 2. 测试结果（本阶段实证）：§13 内部一致性自查 14 项全 ✅（T-01~T-17 = 17/17；16 张卡 `[架构待填]` 全回填，F12 为「无待填」；每组件可追溯卡片；12 项既有能力被复用；六条零新增面逐类核对）
- 3. 疑问/待办：**L1 = 0 条**（§9.1 逐条论证三项触发条件均不触发）；§10 列 **8 条非 L1 口径点**（均已在 §10 选定推荐值 + 备选，影响面逐条标注）；§11 列 **10 条必然变更点**（既有测试断言改写）+ 1 处快照重生成（`oamp/llms.txt`）+ 5 处「已核对不受影响」
- 4. 违反边界的事：无（唯一写入 = architecture.md + 16 卡 `[架构待填]` 段；`oamp/**` 全程只读、未执行 git 写命令、未跑测试；三处 git status 自证主工作区 0 改动）

### 2026-09-12 23:01:00 · 调度决策 · 阶段推进核查

- 决策内容：**阶段 3 → 阶段 4**。推进条件逐项核查：① **L1 决策经用户确认** = 无 L1（0 条），无待裁决项；② **所有功能卡有技术路径** = 17/17 T 项落定、16 卡回填完成；③ **无架构内部冲突** = §13 自查 ✅。三项全满足，进入阶段 4
- 触发依据：`architecture.md` §9.1（L1 论证）/§9.4（T 项索引）/§13（自查）
- 附加处置：§10 的 8 条口径点属 L2 自主决定范围（架构师已选定推荐值），**不作为用户决策点**；主 agent 在阶段收口报告中向用户同步知悉

### 2026-09-12 23:02:00 · 派发 · pr-planner

- 阶段：阶段 4（PR 规划）
- 工作区地址：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0018-chat-agent-subagent-protocol`
- 任务：反射出可独立合并的提交单元划分及单元间真实依赖（不经过全局任务图）
- 附加要求（主 agent）：文件范围须覆盖 §11 全部必然变更点；**零行号引用**（改用引文 + 检索式；迭代 0020 的 Gate 教训）；验收标准可独立判断；每 PR 摘要须点明是否含既有测试断言改写

### 2026-09-12 23:07:07 · 收到报告 · pr-planner（阶段 4）

- 1. `prs/` 目录：`docs/iterations/0018-chat-agent-subagent-protocol/prs/`
- 2. 文件列表：pr-001-transport-call-key-namespace.md / pr-002-registry-task-list-model.md / pr-003-call-http-surface-and-contract-docs.md / pr-004-console-call-page.md / pr-005-call-protocol-acceptance-tests.md
- 3. 摘要：pr-001（F07,F08｜`oamp/src/transport.js` 修改｜无依赖）· pr-002（F09｜`oamp/src/registry.js` 修改｜无依赖）· pr-003（F01~F12,F14~F16 共 15 张｜`oamp/src/web.js`+`API.md`+`llms.txt`+3 个既有测试文件｜依赖 pr-001/pr-002）· pr-004（F13,F14｜`oamp/web/calls.html`/`calls.js` 新建 + `index.html`/`README.md` 修改 + 新建测试｜依赖 pr-003）· pr-005（F03~F12,F15｜`oamp/test/call-protocol.test.js` 新建｜依赖 pr-003）
- 4. 依赖图：`{pr-001, pr-002} → pr-003 → {pr-004, pr-005}`，无环；首次并发 = {pr-001, pr-002}，末波 = {pr-004, pr-005}
- 5. 疑问/越界：无（零行号引用 PASS；14 个路径唯一归属；摘要字数 185/198/170/186/194 均 ≤200）

### 2026-09-12 23:07:04 · 派发 · verifier（阶段 4 Gate）

- 阶段：阶段 4 产物验证（Gate，规范「验证触发时机」：pr-planner 完成后主 agent 触发 verifier）
- 验证标准（内联）：A 七字段格式 / B 功能点全覆盖 / C 文件范围零重叠 / D **依赖正确性（逐条代码级证据，verifier 自行重检索）** / E 无环 / F 验收标准可独立判断 / G 零行号引用 / H 与 architecture §11 覆盖核对 / I 无越界
- 产出物路径：`docs/iterations/0018-chat-agent-subagent-protocol/prs/`
- 备注：本迭代不存在 `deferred-demand-changes.md`（规范「搭置的需求变更/错误报告」透传项不适用）

### 2026-09-12 23:11:23 · 收到报告 · verifier（阶段 4 Gate）

- 报告路径：`clarifications/verify-stage4-gate-20260912-231000.md`
- 结论：**PASS（9/9，fail 0 / partial 0 / blocked 0）**；偏差 4 条（非阻塞）
- 关键证据：D 项依赖正确性 4/4 条由 verifier 自行重检索核实（transport.js 返回对象键集合、router.task_list→registry.listTasks、STATIC_FILES 无 /calls、/api/calls 全仓零命中）；H 项 §11 的 11 行逐条回代码库复核命中
- 偏差：P-1（pr-003 验收「diff 仅落在三个文件」未限定为本 PR diff）/ P-2（依赖型 PR 的验收判定来源口径）/ P-3（pr-004 六列表述只列 5 个标签）/ P-4（depends_on 未明示直接依赖 vs 传递闭包）

### 2026-09-12 23:11:23 · 调度决策 · 阶段推进核查

- 决策内容：**阶段 4 → 阶段 5**。推进条件逐项核查：① 每个 PR 文件满足七字段规范 ✅（A 项）；② 每个功能点被某个 PR 引用 ✅（B 项，F01~F16 全覆盖）；③ PR 间文件范围无重叠 ✅（C 项，14 路径唯一归属）；④ 依赖图无环 ✅（E 项）。四项全满足
- 附加：`## 并发配置（阶段 5）` 区块已初始化（起始 3 / 硬上限 5 / 有效 3 / 释放 0 / 已派发 0）；Gate 的 4 条偏差**不阻塞**，P-2/P-3 转为阶段 5 施工时义务（PR 验收报告需按权威读法判定并登记已知假阳性）

### 2026-09-12 23:11:59 · 调度决策 · 槛位释放

- 决策内容：**建立首波 PR worktree 并并发派发 planner**（依赖图首波解锁 = {pr-001, pr-002}，两者 `depends_on` 均为空）
- worktree（落点 = 会话工作区内子目录，规则 C）：
  - `.pb-agents/worktrees/0018-pr-001-transport-call-key-namespace`（分支 `feat/0018-pr-001-transport-call-key-namespace`）
  - `.pb-agents/worktrees/0018-pr-002-registry-task-list-model`（分支 `feat/0018-pr-002-registry-task-list-model`）
  - 两者 base = 迭代分支 tip `97ee9ac`（阶段 4 Gate 提交）；创建动作在同一批命令内完成
- 并发配置更新：`已派发总数` 0 → 2

### 2026-09-12 23:13:30 · 派发 · planner（pr-001 ∥ pr-002，同批并发）

- 阶段：阶段 5 首波；两个 planner 在**同一批**并发派发（非串行）
- 工作区地址：各自 PR worktree 绝对地址
- 任务：各拆本 PR 内部任务，产出 `prs/pr-001-tasks.md` / `prs/pr-002-tasks.md`

### 2026-09-12 23:14:20 · 收到报告 · planner（pr-001）

- 1. tasks.md 路径 + 任务总数：`prs/pr-001-tasks.md`，3 任务
- 2. 依赖图：`T1 → {T2, T3}`（T2/T3 互不依赖），无环；关键路径 T1→T2
- 3. `[model_inferred]` 2 条：① T2 `publishCall(callId, event)` 的 chatId 取自 `event.data.chat_id`（架构 §4.2 固定两参签名、未给 chatId 入参位置；§4.1 三类事件 data 均含 chat_id ⇒ 带内唯一可得来源）；② T3 `closeAll()` 覆盖 `call:` / `chat-calls:` 键上的订阅（§4.2 只说名称与行为逐字保持 + 既有语义「移除全部订阅并结束所有连接」）
- 4. 循环依赖：无
- 5. 疑问/越界：架构 §4.2 未写明 chatId 获取位置（低 severity、未阻断）；粒度决策（T2/T3 本可合并，拆分理由 = 键位不相交 + 推断被否时只重做 T2）；越界 = 无

### 2026-09-12 23:14:20 · 收到报告 · planner（pr-002）

- 1. tasks.md 路径 + 任务总数：`prs/pr-002-tasks.md`，2 任务
- 2. 依赖图：`T1 → T2`，无环；关键路径 T1→T2
- 3. `[model_inferred]`：无（空）
- 4. 循环依赖：无
- 5. 疑问/越界：① 上游口径提示（不阻塞）——architecture §1.1 对 router.js 的括注「7 方法分发（agent.* / message.* / router.status|task_get|task_list）」其枚举计数口径与方法面规范宿主（`oamp/README.md` 协议速览「方法面」行 7 项，由 `oamp/test/project-workspace.test.js` 既有断言逐字锁定）不一致；planner 以 README 7 项为判据宿主，未据括注改判据；② 粒度决策（两任务本可合并，拆点理由 = T2 判据对象非 T1 实现内容）；③ 本 PR 不新增测试文件（F09 端到端落点在 pr-003/pr-005，未越界承接）

### 2026-09-12 23:14:50 · 调度决策 · 阶段推进核查

- 决策内容：**裁定 2 条 `[model_inferred]` 生效**（主 agent 权限内，属架构 §4.2/§4.1 的直接推论，非新增技术决策）：① 采纳「chatId 取自 `event.data.chat_id`」——架构 §4.1 明示三类事件 data 均含 `chat_id`，且 §4.2 固定两参签名，带内是唯一可得来源；② 采纳「`closeAll()` 覆盖新键空间订阅」——§4.2 要求既有语义逐字保持，而「移除全部订阅并结束所有连接」的「全部」在字面上已覆盖新增键。两条若实现期证伪，只影响 pr-001 的 T2/T3 验收写法，不影响其他 PR
- 触发依据：planner 两份报告的报告契约第 3 项；planner 角色「model_inferred 验收标准必须经主 agent 确认」
- 另记：architecture §1.1 括注 vs README 方法面 7 项的计数口径不一致 → 不阻塞，登记为偏差（阶段 6 复核），planner 已按规范宿主（README + 既有断言）取判据

### 2026-09-12 23:15:00 · 派发 · dev（pr-001 ∥ pr-002，同批并发）

- 阶段：阶段 5 首波实现；两个 dev 在**同一批**并发派发
- 工作区地址：各自 PR worktree 绝对地址（pr-001: `.pb-agents/worktrees/0018-pr-001-transport-call-key-namespace`；pr-002: `.pb-agents/worktrees/0018-pr-002-registry-task-list-model`）
- 任务：按各自 `prs/pr-{NNN}-tasks.md` 实现最小改动
- 简报附带：① 工作目录纪律硬性段（含本仓库实测的 `edit` 相对路径按会话 cwd 解析的坑）；② 已裁定的 2 条 `[model_inferred]` 实现口径（仅 pr-001）；③ pr-002 的 §1.1 括注口径提示（以 README 7 项为判据宿主）

### 2026-09-12 23:15:23 · 收到报告 · dev（pr-002）

- 1. 改了什么文件：`oamp/src/registry.js` 1 文件 / +1 行（`listTasks` 投影追加 `model: task.result?.model ?? null,`），提交 `a827f4e`
- 2. 测试结果：PR 验收 5 条全 PASS（T1/T2 逐条 evidenced：键恒存在且进行中为 `null`；终态读 `result.model`；diff 单 hunk 归位于 `listTasks`；`node --test oamp/test/task.test.js` 6/6 绿且该文件 diff 0 行；`router.js` diff 0 行；方法面 7 项断言单跑 1/1 通过）
- 3. 疑问/待办：① 上游口径（architecture §1.1 括注 vs README 7 项）已按 tasks.md 判据宿主执行，未据括注改动；② T1 验收 3 提到的 `agent.js` 终态实报点未逐行复核（超出本 PR 范围，零改动 agent.js）
- 4. 违反边界的事：无（未新增依赖/配置键；未触碰 roles/.claude/docs/test/router.js；未 push/merge/切分支；未用 --no-verify）；三处 git status 中报告会话工作区出现游离未跟踪文件 `docs/iterations/0018-chat-agent-subprotocol-x`

### 2026-09-12 23:16:00 · 调度决策 · 阶段推进核查

- 决策内容：**清理主 agent 自身造成的游离文件**——23:14 主 agent 在会话工作区误执行 `cat >> docs/iterations/0018-chat-agent-subprotocol-x`（笔误重定向）产生 0 字节未跟踪文件；已 `rm` 删除，会话工作区恢复干净（0 处改动）。**未提交、未进任何分支**，无下游影响。根因 = 命令拼接时残留的错误重定向片段

### 2026-09-12 23:17:31 · 收到报告 · dev（pr-001）

- 1. 改了什么文件：`oamp/src/transport.js` 1 文件 / +68 -19（三个具名键构造函数 + `chatKeyOrGlobal` + `subscribe/publishTo/closeKey` 内核抽取 + 4 个新方法 + `closeAll` 遍历三键空间），提交 `cb1bdc8`
- 2. 测试结果：PR 验收 6 条全 PASS + T3 附加 3 项 PASS；既有 `oamp/test/transport.test.js` **13/13 绿且该文件 diff 0 行**；真实 node:http SSE 客户端验证双键写入、串键窗口不成立（`chat_id='call:C1'` 收不到 `publishCall('C1')`）；`dependencies` 仍 `{}`、零新 import
- 3. 疑问/待办（4 条判断项，均已说明，无阻塞）：① 新增架构 §4.2 未命名的内部函数 `chatKeyOrGlobal`（理由：`chatKey` 保持纯前缀模板以逐字对齐架构，null 分支收敛在一处；影响仅源码形态）；② `publishCall` 对缺失 `event.data.chat_id` 不做守卫（与既有 `publish` 同口径；入参校验属调用面职责）；③ return 对象改两行排版（键集合/顺序/语义不变）；④ 无阻塞疑问
- 4. 违反边界的事：无

### 2026-09-12 23:18:21 · 派发 · verifier（pr-001 ∥ pr-002，同批并发）

- 阶段：阶段 5 首波 PR 级验收（合并前门禁）
- 产出物：各自 PR worktree 分支的实现提交 + PR 文件 + tasks 文件
- 验证标准：A 全部「验收标准」（自跑命令）/ B tasks 内任务验收 / C 改动面零越界 / D 既有测试零改写 / E 无回归（另跑一个受影响文件）/ F 实现自陈与代码一致性（含新增未命名符号的偏差登记）
- 报告落点：会话工作区 `clarifications/verify-pr-{NNN}-{timestamp}.md`（不写 PR worktree）

### 2026-09-12 23:20:00 · 收到报告 · verifier（pr-001 / pr-002 验收）

- pr-001：`clarifications/verify-pr-001-20260912-232019.md`，**PASS 32 项 / fail 0 / partial 0**；偏差 5 条（含 4 个未命名内部符号为函数体搬迁、`publishGlobal`/`closeAll` 内部换用新内核、`tasks` 内行号为阶段 3 快照）；回归：`web.test.js` 39/39、`delivery-contract.test.js` 12/12
- pr-002：`clarifications/verify-pr-002-20260912-231911.md`，**PASS 19 项 / fail 0 / partial 0**；偏差 3 条（tasks T2.2 的 diff 字面读法、README 方法面 7 项 vs `router.js` 实际 8 个 case、`message.deliver` 无入站 case）；回归：`project-workspace.test.js` 21/21
- 两报告均把字面读法差异按权威读法判 pass 并登记为偏差（主 agent 口径已预先写入简报）

### 2026-09-12 23:20:58 · 调度决策 · 槛位释放

- 决策内容：**合并 pr-001 与 pr-002** 进迭代分支：`b92ad82`（pr-001，含 tasks 文件）/ `95051b0`（pr-002）；现场清理 = 两 PR worktree `remove` + 两 `feat/*` 分支 `-d`；槛位释放 2 ⇒ `累计槛位释放次数` 0→2、`当前有效上限` = min(3+2×3,5) = **5**（已触硬上限）
- 触发依据：两 PR 的 PR 级验收均 PASS（规范：合并进迭代分支才算解锁）
- 解锁结果：**pr-003 解锁**（`depends_on` = pr-001 + pr-002，两者均已合并）；pr-004/pr-005 仍阻塞（依赖 pr-003）

### 2026-09-12 23:21:11 · 调度决策 · 阶段推进核查

- 决策内容：修正 `status.md` 两处过期占位块（「PR 实现子状态」占位表未替换为真表；残留一份「并发配置」占位块）——占位块零残留；PR 子状态表已填入五个 PR 的真实状态与合并 commit
- 触发依据：主 agent 台账一致性自检（规范要求 status.md 与文件系统不一致时以文件系统为准修正）

### 2026-09-12 23:21:35 · 派发 · planner（pr-003）+ progress-observer（同批并发）

- planner：阶段 5 第二波（pr-003，6 文件 / 15 张卡 / 含既有测试断言改写）；工作区地址 = `.pb-agents/worktrees/0018-pr-003-call-http-surface-and-contract-docs`
- progress-observer：规范「自动触发」——每次一个 PR 完成 merge 后刷新 `progress.md`（本次覆盖首波两个 merge）

### 2026-09-12 23:24:00 · 收到报告 · progress-observer（首波合并后自动触发）

- `progress.md` 路径：`docs/iterations/0018-chat-agent-subagent-protocol/progress.md`（153 行，整体覆盖写入）
- 六部分摘要：① 阶段 1~4 产物 39 文件全部存在且被跟踪（`architecture.md` 686 行与声称逐字一致）；② 依赖核实 **5 条一致 / 0 条不一致**（pr-003 的两条依赖经 `merge-base --is-ancestor` 实证为 HEAD 祖先）；③ pr-001/pr-002 现场已清理且与 git 一致；④ **可并发但闲置 PR = 0**（pr-004/pr-005 属依赖未满足的正常阻塞；有效上限 5 vs 在飞 1，空置 4 槛位符合规范「无排队 PR 时不派发」）；⑤ 不一致 **6 条**；⑥ 无法核实项 6 条
- 最需关注的发现：pr-003 状态快照滞后 git 现场（worktree/分支已存在但 status 记「尚未派发」、`已派发总数` = 2）；**history.md 时标系统性超前 git committer 时间 15~25 分钟**；status.md 残留 4 处过期文本
- 越界：无；纯只读（未执行任何写入性 git 命令）

### 2026-09-12 23:25:00 · 调度决策 · 阶段推进核查

- 决策内容：**按 progress-observer 的 6 条不一致逐项处置**（以文件系统/git 一手记录为准修正台账）：① `status.md` 的 pr-003 状态改「planner 已派发」、`已派发总数` 2→3；② `history.md` 全篇加「时标口径声明」段，并把 20 条被点名的条目时标改为 git 实测时间（权威 = commit committer time）；③ 清 `status.md` 残留过期文本 4 处（状态行「阶段 4 进行中」、阶段 3 备注「待启动」、§恢复设置 三处 v0.9.0 / 旧 tip、生效协议版本行）；④ 第 6 条（pr-003 worktree 基线落后 3 个 docs 提交）**不处置**——两条依赖已在基线内，依赖满足性不受影响，属正常（worktree 由合并时刻的迭代分支拉出）
- 触发依据：`progress.md` §5「发现的不一致」；规范「status.md 与文件系统不一致时以文件系统为准修正」

### 2026-09-12 23:30:00 · 收到报告 · planner（pr-003）

- 1. tasks.md 路径 + 任务总数：`prs/pr-003-tasks.md`（401 行），**16 任务**
- 2. 依赖图：31 条边，**无环**（全部边由小编号指向大编号 ⇒ T1<…<T16 即拓扑序）；关键路径 6 节点：`T1 → T2 → T5 → (T8|T11) → (T12|T13) → T15`
- 3. `[model_inferred]` **10 条**（全部为架构留白的直接推论，逐条给了依据与「若被否的影响面」，均只影响措辞/判据宿主）
- 4. 循环依赖：无
- 5. 疑问/越界：8 条（a 架构留白已标推断；**b 待主 agent 裁定**：§11 未点名的两处过时测试标题/注释是否允许改；c STATIC_FILES 指向文件属 pr-004 的已知中间态；d F13 不在功能点列表但验收 7 要求 +2；e README 两处「13 条」计数漂移不在本 PR 范围；f 部分判据延后至 pr-005；g 未承接 progress.md 刷新；h 未越界）
- 覆盖：PR 验收 15 条 → 15/15；architecture §11 的 11 行 → 11/11（第 12 行以 T15 核验承接）

### 2026-09-12 23:31:00 · 调度决策 · 阶段推进核查

- 决策内容：**裁定 planner 的 10 条 `[model_inferred]` 全部生效**（均为 §2/§3/§5 的直接推论，非新增技术决策；逐条影响面仅限措辞/判据宿主，可回滚）
- **裁定疑问 b：维持「§11 逐字零改写」**——理由（优先级序列：可测试 > 可读 > 一致 > 简单）：§11 是本迭代「变更面闭合」的**机械判据宿主**（口径 = 「除上表 1~10 的行之外 diff 为空」）；为两处测试标题/注释的陈旧字样扩清单，会让该机械判据退化为需人工解释，代价高于收益。⇒ 两处过时字样**不改**，登记为偏差与下一迭代候选（与疑问 e 的 README 两处「13 条」同性质）
- **裁定疑问 e：不动 README 计数**（pr-004 文件范围虽含 `oamp/README.md`，但其改动被 PR 文件限定为顶栏入口 +1 行；不借文件范围扩改动内容）⇒ 登记为下一迭代候选
- 其余（c/d/f/g）按 planner 描述接受为「已知中间态 / 已有承接」，不处置

### 2026-09-12 23:32:00 · 派发 · dev（pr-003）

- 阶段：阶段 5 第二波（单 PR，无并发对象——pr-004/pr-005 仍依赖 pr-003 未合并）
- 工作区地址：`.pb-agents/worktrees/0018-pr-003-call-http-surface-and-contract-docs`
- 任务：按 `prs/pr-003-tasks.md` 的 16 个任务（拓扑序）实现本 PR 全部改动（6 文件）
- 简报附带：① 工作目录纪律硬性段（含 `edit` 相对路径坑）；② 10 条 `[model_inferred]` 全部生效；③ **§11 逐字零改写**、**不改 README**；④ 允许跑全量回归与端到端 smoke（含服务实启，须避开默认端口 7788）

### 2026-09-12 23:40:00 · 收到报告 · dev（pr-003）

- 1. 改了什么文件：**恰 6 个**（`oamp/src/web.js` +455/-6、`oamp/API.md` 约 +700、`oamp/llms.txt` 重生成、三个既有测试文件按 §11 点名区间改写），提交 `d1bc97d`（6 files changed, 1083 insertions(+), 17 deletions(-)）
- 2. 测试结果：**全量回归 272/272 PASS**（`node --test test/*.test.js`，57.1s）；三个既有测试文件 7/7、21/21、39/39；**端到端 smoke 66/66 + 对账路径 4/4**（真实起 router + web（随机端口）+ agent pb-dev，fake ACP）；变更面闭合：`oamp/test/**` 的 hunk 区间全部落在 §11 点名区间内、§11 第 12 行 5 组文件 diff 全空、`dependencies` 仍 `{}`
- 3. 疑问/待办：**9 条**（① F10 验收 3「重启服务」的落判；② web 侧 `callSchemas` 需批准；③ 第三处过时标题（§11 区间内但不在改写目标）；④ §11-4 区间 vs 插入点；⑤ 批量顶层可选字段语义；⑥ 关键词检索口径取舍（§7.2 改中文等价表述）；⑦ GET 返回裸信封；⑧ 新错误文案；⑨ 实现细节记录）
- 4. 违反边界的事：无（零新依赖/配置键/错误码/表列/进程；三处 git status 自证干净）

### 2026-09-12 23:42:00 · 调度决策 · 阶段推进核查

- 决策内容：**裁定 dev 的 9 条疑问**：
  - ① **F10 验收 3 的「重启服务」取字面读法 = 整个 oamp 服务（Router + web）整体重启**（卡片原文即「重启服务」；真源在 Router 任务表，架构 §3.4/§3.5 单真源决定了「只重启 web 不丢」是正确行为）。dev 的落判与卡片原文一致 ⇒ 判 pass；`prs/pr-003-tasks.md` 的「重启 web 子进程」措辞窄于卡片，**以卡片为准**，登记为偏差
  - ② **批准 `callSchemas`**（web 侧进程内 schema 登记，仅登记带 `output_schema` 的调用）：零持久化、零表/列、零新 UDS 方法、零新配置键；替代方案（GET 恒返回 `structured_output: null`）会削弱 F06/F01 ⇒ 采纳登记并登记为偏差（架构未点名该内存结构）+ 下一迭代候选
  - ③④ 接受（§11 逐字零改写；断言列表顺序无语义）→ 登记为偏差
  - ⑤ 按已批准的 model_inferred 接受
  - ⑥ **接受但登记为重点偏差**：§7.2 为满足机械检索把不变量名改为中文等价表述——代价 = 英文词面弱于 harness 原文；交阶段 6 独立判定 §7.2 是否仍可逐条核对参照契约
  - ⑦⑧⑨ 接受（裸信封、新文案已成 API.md 契约、实现细节）
- 触发依据：dev 报告契约第 3 项；《阶段回退》判断标准 = 是否改变 `demand.md` 结论 ⇒ **均不改变**（属卡片措辞与实现形态层面），故不回退阶段

### 2026-09-12 23:43:00 · 派发 · verifier（pr-003 验收）

- 阶段：阶段 5 第二波 PR 级验收（合并前门禁）
- 验证标准：A PR 验收 15 条 / B 独立性复核（重生成快照、三文件、全量回归、**真实起服务的端到端**）/ C 变更面闭合（§11 机械判据）/ D 契约文档真实性（含 §7.2 可核对性）/ E 零越界 / F 已裁定事项核对 / G 零半成品检索
- 报告落点：会话工作区 `clarifications/verify-pr-003-{timestamp}.md`

### 2026-09-13 00:05:47 · 收到报告 · verifier（pr-003 验收）

- 报告路径：`clarifications/verify-pr-003-20260913-000547.md`（155 行）
- 结论：**FAIL（43 pass / 2 fail / 0 partial）**；偏差 9 条；下一迭代候选 7 条
- **fail A20（真实功能缺陷）**：`strict` 校验失败路径下终态漂移——信封 `state=failed` vs roster/transcript `state=completed`（违反 F09 验收 3「roster 状态与按 id 一致」，并证伪 API.md §3.19「同真源、两处不会漂移」）；三处信封彼此一致 = true
- **fail D2（文档事实错误）**：API.md §3.19 的 `exit_code` 行「常驻执行路径为 null」与实现不符（daemon 成功路径实测 `0`）；§5.13/§5.14 示例 `"exit_code":null` 不可复现
- pass 要点：PR 验收 15 条全 pass；**独立性复核 4/4**（llms 重生成无 diff、三文件 7/7+21/21+39/39、**全量 272/272 PASS**、真实起 Router+agent+web 的端到端 129 项断言）；**变更面闭合 4/4**（diff 恰 6 路径、hunk 全映射回 §11 点名区间、§11 第 12 行 7 文件 diff 全空）；**§7.2 对 harness 参照契约 25/25 行仍可逐条核对**；零半成品 pass
- 现场清理：无残留进程、临时目录已删、未占用默认端口 7788

### 2026-09-13 00:07:00 · 调度决策 · 阶段推进核查

- 决策内容：**pr-003 不合并，退回 dev 做修复轮**（规范「有条件未满足 → 回到执行角色补充」，本阶段自己没做完，非需求问题）。修复面 = 4 项：
  - **FIX-1**（fail A20）：把 strict 覆写落到**终态写入处**（终态单一真源），使信封/roster/转录三视图一致；依据 architecture §2.5（`state='failed'` + `error='structured_output_invalid'`，不新增终态词）+ F09 验收 3
  - **FIX-2**（fail D2）：§3.19 `exit_code` 行 + §5.13/§5.14 示例改为与实现一致
  - **FIX-3**（偏差 3）：§3.19「11 键」→ **10 键**（`call_result` 帧另注 11 键 = `chat_id` + 10）
  - **FIX-4**（偏差 7）：§3.14「零副作用」措辞显式限定到两类
- 不处置项（登记为偏差/下一迭代候选）：#4（§7.2 中文等价表述，verifier 已核 25/25 仍可核对）、#5（§11 区间内过时字样，裁定结果）、#6（tasks 措辞）、#8（`out` 行无 `task_id`，属既有 persist 行为）、#9（README 计数）
- 约束保持：6 文件闭包、§11 逐字零改写（新增断言只允许落在已点名区间内或改用仓库外脚本自证）、零新依赖/配置键/错误码/表列/协议方法

### 2026-09-13 00:18:00 · 收到报告 · dev（pr-003 修复轮）

- 1. 改了什么文件：`oamp/src/web.js`（FIX-1，40 行）+ `oamp/API.md`（FIX-2/3/4 + FIX-1 文档后果，20 行），提交 `f771ae5`
- 2. 测试结果：
  - **FIX-1 主证 PASS**：新增纯函数 `callState(task, call) = call?.terminal?.state ?? task.state` 作为**唯一状态读法**，`publishCallResult`（终态单一发布点）把 `envelope.state` 记入调用登记 `call.terminal` ⇒ 信封/roster/转录**三视图一致**（strict 未通过时四处均 `failed`）；反向对照：permissive 未通过 ⇒ 四视图均 `completed`、strict 通过 ⇒ `completed`、无 schema ⇒ `completed`；既有 `POST /api/messages` 路径零变化
  - **FIX-2 PASS**：daemon 成功 ⇒ `exit_code=0`；shell 失败 ⇒ `3`（真实码）；一次性 ⇒ `0`；daemon 执行失败 ⇒ `null` + `error=context_crashed`
  - **FIX-3/FIX-4 PASS**：§3.19 改 10 键（`call_result` 帧 11 键另注）；§3.14「零副作用」限定到 INVALID_PARAM + 角色不可寻址两类，离线路径 Δmsg=2 已如实写明
  - **全量回归 272/272 PASS**；`node --check` OK；llms 重生成无 diff；本提交 `oamp/test/**` 零 hunk；`dependencies` 仍 `{}`
- 3. 疑问/待办：5 条（a §3.19 `error` 行不覆盖 shell 失败；b §3.18 未说明末条终态条目语义；c 超出点名位置的同事实类文档改动（§3.15/§3.16/§5.16 等，已实现并列明）；d 未触碰项；e 复跑入口 `/tmp/oamp-pr003-fix/verify.mjs`）
- 4. 违反边界的事：无（未用 `--no-verify`、未 push/merge/切分支）

### 2026-09-13 00:19:00 · 调度决策 · 阶段推进核查

- 决策内容：**(a)(b) 折为文档收尾轮（FIX-5/FIX-6）立即处置**，理由：二者与 fail D2 同类（文档与实现不自洽），留给复验只会再 FAIL；(c) **接受**（同一事实类必须同步改，否则文档自相矛盾——如同一 completed daemon 调用在 §5.13 写 0、§5.16 写 null）；(d) 维持登记为下一迭代候选
- 触发依据：dev 修复轮报告契约第 3 项；《阶段回退》判断标准 = 不改变 `demand.md` 结论 ⇒ 不回退

### 2026-09-13 00:26:00 · 收到报告 · dev（pr-003 文档收尾轮）

- 1. 改了什么文件：`oamp/API.md` 仅此 1 个（+2/-1），提交 `baf9c43`
- 2. 测试结果：FIX-5（§3.19 `error` 行覆盖 shell/一次性失败以 `exit_code` 表达、`error=null`）与 FIX-6（§3.18 说明末条终态条目 `state` 含 strict 覆写 vs `detail` 执行侧原样刻意区分）逐条给原文与实现依据（`web.js` 行级）；`git diff --name-only HEAD^..HEAD` 恰 1 路径；`95051b0..HEAD` = 6 文件 + `prs/pr-003-tasks.md`；llms 重生成无新 diff
- 3. 疑问/待办：**无阻塞**；一条重要观察——**全量套件存在既有 timing flake**：`oamp/test/status.test.js` 的 `F05-4`（心跳严格推进断言）在全量并发负载下偶发（5 轮中 2 轮 271/1、2 轮显式 272/0），单独跑 3/3 全绿；与本 PR 因果无关（该文件零 API.md 引用、不在 diff 内）
- 4. 违反边界的事：无

### 2026-09-13 00:27:00 · 派发 · verifier（pr-003 修复后复验）

- 阶段：阶段 5 第二波闭合复验（合并前门禁）
- 验证标准：R1 上轮 fail A20 闭合（**自行复现性实证**三视图终态一致 + 反向对照）/ R2 fail D2 闭合（文档与实测逐条对得上）/ R3 文档订正四项 / R4 无回归（**含 flake 纪律**）/ R5 变更面闭合不变 / R6 修复未引入新漂移 / R7 上轮 pass 项抽查
- **回归判定纪律（写入简报）**：按 v0.10.0「隔离边界声明」——受负载影响的偶发失败不得当回归依据；`status.test.js F05-4` 若在全量下失败，必须单独重跑并核对安静环境结果；其他任何失败一律当真回归

### 2026-09-13 00:37:00 · 收到报告 · verifier（pr-003 复验）

- 报告路径：`clarifications/verify-pr-003-r2-20260913-002937.md`
- 结论：**PASS 28/28（fail 0 / partial 0）**；偏差 4 条
- 上轮两条 fail **均 CLOSED**：A20 由 verifier 自行真实起服务复现性实证（同一 `call_id` 四处终态一致 = `failed`；反向对照 permissive 未通过 ⇒ 四处 `completed`；strict 通过 ⇒ 四处 `completed` + `structured_output` 为对象）；D2 四态实测（daemon 成功 0 / daemon 失败 null+error / shell 失败 3 / 一次性 0）与 §3.19 + §3.16/§5.13/§5.14/§5.16 逐条吻合，API.md 中 `completed + exit_code:null` 残留 0 处
- 回归：全量 2 轮均 **272/272**；三改动文件 67/67；自写端到端 smoke 31/31；`status.test.js` 单独重跑 5/5（flake 未出现，不触发安静复现分支）⇒ 无真回归
- 偏差 4 条：D1 瞬态窗口（`call.terminal` 由 web 侧写入、晚于 Router 终态一个 UDS 往返；探针只观测到 `[roster=completed, 信封=working]` 这类**已渲染快照 vs 后读 roster** 的采样对，未观测到上轮那种持久漂移；同一时刻的四视图读法一致）；D2 `/calls` 与 `/calls.js` 实测 404（白名单已注册、分支可达，页面本体属 pr-004）；D3 §11-10 的键序列举与运行期序不同（既有断言用 `.sort()`，非漂移）；D4 `exit_code` 的 string 形态（信号终止）未实测
- 环境自证：无残留进程、已删 `/tmp/vr2`、未占用默认端口 7788

### 2026-09-13 00:38:00 · 调度决策 · 槛位释放

- 决策内容：**合并 pr-003**（`7e351fa`）进迭代分支；现场清理（worktree `remove` + 分支 `-d`）；槛位释放 3 ⇒ `累计槛位释放次数` 3、`当前有效上限` = min(3+3×3, 5) = **5（钳硬上限）**；**pr-004 与 pr-005 同时解锁**（两者 `depends_on` = pr-003，已合并）
- 偏差处置（登记，不阻塞）：D1 接受（瞬态采样对非同一时刻读法不一致；稳态与同刻读法均一致）→ 下一迭代候选「记录 `call.terminal` 写入时序」；D2 接受（pr-004 的既知中间态）；D3 接受（非漂移）；D4 登记（未覆盖的信号终止形态）
- 触发依据：pr-003 复验 PASS

### 2026-09-13 00:39:00 · 派发 · planner（pr-004 ∥ pr-005，同批并发）

- 阶段：阶段 5 末波；末波两 PR 无相互依赖、文件范围零交集（pr-004 = 前端页 + README + 新测试；pr-005 = 新测试文件），适合并发
- 工作区地址：各自 PR worktree 绝对地址（均从 `7e351fa` 拉出，可见 pr-003 全部产物）
- 任务：各拆本 PR 内部任务，产出 `prs/pr-004-tasks.md` / `prs/pr-005-tasks.md`

### 2026-09-13 00:46:00 · 收到报告 · planner（pr-004 / pr-005）

- **pr-004**：`prs/pr-004-tasks.md`，**7 任务**（12 条边 DAG 无环；关键路径 T2→T3→T4→T6→T7）；`[model_inferred]` 5 条（入口站位、6 列中文列名、null 占位「—」、`call_update` 取值式、README 独立 bullet）；疑问 5 条（a 点击已完成行不补取终态；b 验收 3 的「起止时间」= §3.4 两列；c README「13 条」计数跨 PR 留白；d 容器命名自由；e 本 PR 不改 API.md/llms.txt）；PR 验收 8/8 有承接
- **pr-005**：`prs/pr-005-tasks.md`（341 行），**12 任务**（21 条边 DAG 无环；关键路径 T1→T4→T8→T12）；`[model_inferred]` 4 条（允许 import 既有 helpers、组 M 宽口径 = §6+§7 全章、桩回显 sessionId 判据、用既有 `startFakeNode` 作观测面）；疑问 6 条（`web.js` 注释「11 键」与实体 10 键之差异、超上限截断唯一路径需推 ≥1001 片、组 M 代码面作用域收口、**API.md 双副本陷阱**（主工作区版本旧）、端口段隔离、未越界）；PR 验收 12/12 有承接；§12.2 组 A~J+M 全覆盖

### 2026-09-13 00:47:00 · 调度决策 · 阶段推进核查

- 决策内容：**裁定两份任务图的 9 条 `[model_inferred]` 全部生效**（pr-004 的 5 条 + pr-005 的 4 条；均为架构直接推论或既有体例复用，非新增技术决策）
- 采纳 planner 的工程提示：pr-004/pr-005 **并行运行必须使用不同端口段**（不得占用 7788）——已写入两份 dev 简报的硬性约束；pr-005 的 API.md 双副本陷阱（须用 `new URL('../API.md', import.meta.url)`）已随 tasks.md 传递给 dev
- 登记（不处置）：`oamp/src/web.js` 一处注释写「11 键」而实体为 10 键（SSE 帧才是 11 键）——纯注释、零行为影响，属本迭代自身产物遗留的表述瑕疵；**不开修复 PR**，登记为偏差 + 下一迭代候选（理由：为一处注释走完整 PR 流程属仪式性开销，且不影响任何卡片的验收）

### 2026-09-13 01:00:00 · 收到报告 · dev（pr-004）

- 1. 改了什么文件：恰 5 个——新建 `oamp/web/calls.html`（39 行）、`oamp/web/calls.js`（178 行）、`oamp/test/call-console.test.js`（118 行）；修改 `oamp/web/index.html`（+1 行入口）、`oamp/README.md`（+1 bullet）；提交 `d84dba1`
- 2. 测试结果：新增测试 2/2；`api-pages.test.js` 5/5 且该文件 diff 空；**全量 274/274 PASS**（未出现 F05-4 flake）；真起服务实测 `/calls` 200 `text/html`、`/calls.js` 200 `text/javascript`、`/api/calls` 六列、SSE 实收 `call_state/call_update/call_result`、未知 id 404；**浏览器实测**：表头六列、null 占位「—」、点击后进度区更新、5s 轮询刷到终态、三态提示条、console 零错误；检索式七词零命中（初次实现注释命中已改）；变更面闭合 = 5 文件 + tasks
- 3. 疑问/待办：无阻塞（报告含设计说明）
- 4. 违反边界的事：无；端口段 49000–49499（与 pr-005 的 49500–49999 错开）

### 2026-09-13 01:11:00 · 收到报告 · dev（pr-005）

- 1. 改了什么文件：唯一新增 `oamp/test/call-protocol.test.js`（1062 行 / 11 个 test，自带 harness；仅 import 既有 `helpers/harness.js` 与 `helpers/fake-node.js`）；提交 `8e4fa86`；**既有文件零字节改动**
- 2. 测试结果：单文件 11/11（4 轮全绿、零 flake、≈24s）；12 条 PR 验收标准逐条实测（组 A~J + M 全承接）；**全量 `npm test` 283/283 PASS**（未出现 F05-4）；范围核对 = 新文件 + tasks；`dependencies` 仍 `{}`；超上限用例用 `#chunks=1001` 桩轮次指令，实测未超时
- 3. 疑问/待办：3 条设计说明（桩在 6 个 env 旋钮外支持 prompt 内轮次指令 `#fail`/`#sleep`/`#chunks`/`#echo-session`/`#memory`，因进程级旋钮无法表达轮次差异；T2「不可用」构造修正为「不再在线（条目移除或 offline 墓碑皆可）」；桩 sessionId 改为 `sess-<pid>-<seq>` 以区分跨 chat 会话）
- 4. 违反边界的事：无；端口段 49500–49999

### 2026-09-13 01:12:00 · 派发 · verifier（pr-004 ∥ pr-005，同批并发）

- 阶段：阶段 5 末波 PR 级验收（合并前门禁）
- 验证标准：A 各自全部验收标准（自跑）/ B 测试有效性（pr-004 的 2 用例非空洞性；**pr-005 抽查 ≥4 用例的真观测性**）/ C 既有面零回归 / D 变更面闭合 / E 现场核对（pr-004 真页面；pr-005 无外网零新表）/ F/G 端口与现场清理
- 报告落点：会话工作区 `clarifications/verify-pr-{NNN}-{timestamp}.md`

### 2026-09-13 01:00:00 · 收到报告 · verifier（pr-005 验收）

- 报告路径：`clarifications/verify-pr-005-20260913-005344.md`
- 结论：**PASS 30/30**（A 12 条 / B 测试有效性抽查 5 样本 / C 零改写 / D 全量 3 轮 283/283 / E 零依赖零表零外网 / F 完整性零 skip / G 现场清理）；偏差 6 条
- 关键证据：单文件 11/11 零 skip；全量 3 轮全绿；`diff --name-status 7e351fa..HEAD` 仅两条 `A`；端口段 49500–49999 零交叠；flaker 纪律实测（F05-4 负载下单跑失败 1/5、紧接 4 次全绿、该文件与 base 逐字节相同 ⇒ 非本 PR 回归）
- **偏差 D-1（实质测试质量缺口）**：`call-protocol.test.js` 578-579 附近 `structured_output` 断言近似恒真 + `if !== null` 分支在非 JSON 桩下必跳过 ⇒ F05/F06 的**结构化输出子项零鉴别力**（F06 = 「结构化终态结果」= 本迭代中心卡片）
- 偏差 D-2：`sessOf` 正则 pid 段截断 ⇒ 同进程两会话被判等

### 2026-09-13 01:02:00 · 收到报告 · verifier（pr-004 验收）

- 报告路径：`clarifications/verify-pr-004-20260913-005655.md`
- 结论：**PASS 14/14**（A1~A8 + B 非空洞性 + C 回归 + D 闭合 + E 真实页面核对 + F 清理）；偏差 6 条（均非阻塞）
- 关键证据：`/calls` 与 `/calls.js` 真起服务 200 + 正确 content-type；`index.html` 单 hunk 纯 +1；**运行期相邻轮询间隔实测 4998 ms**；浏览器实测 EventSource 复用/关闭计数（切换 created=2/closed=1，任一时刻恰 1 订阅）；检索式七词零命中；全量 4 轮（R2~R4 均 274/274；R1 一次未归因失败且安静单跑 5/5）；现场零残留

### 2026-09-13 01:03:00 · 调度决策 · 阶段推进核查

- 决策内容：**pr-004 直接进入合并；pr-005 先做定向修复轮再合并**。理由：pr-005 的偏差 D-1 使 F06（结构化终态结果）在**验收测试层**零鉴别力——该卡片是本迭代中心交付之一，留一个「看似有覆盖」的恒真断言比没有断言更危险（会让人误以为已锁）。修复面 = `structured_output` 四态真实驱动 + `sessOf` 正则；**限定在该 PR 的单一文件内**，不扩大范围
- 其余偏差处置（登记、不阻塞）：pr-004 的 6 条（README 计数、推断项一致、终态行不回填、裁定登记、一次未归因失败、failed 渲染未观测）与 pr-005 的 D-3~D-6（判定口径、既有注释、既有 flake）全部登记为偏差 + 下一迭代候选
