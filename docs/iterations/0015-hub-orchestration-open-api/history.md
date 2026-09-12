# history.md — 0015-hub-orchestration-open-api

### 2026-09-11 17:45:00 · 调度决策 · 阶段推进核查

- 决策内容：启动 workflow-pb 迭代 0015（hub 编排能力 + 开放接口）；阶段 1 前置侦察完成（agent 生命周期/关闭能力/本机调度能力/API 全清单与缺口）
- 触发依据：用户四项需求；5 项澄清决策；两份侦察报告（ScoutAgentLifecycle / ScoutApiInventory）

### 2026-09-11 17:45:10 · 派发 · demand

- 阶段：阶段 1（需求收敛）
- 任务：通过结构化对话消除模糊、界定边界，产出有澄清依据的需求合同

### 2026-09-12 10:38:00 · 收到报告 · demand

- 1. demand.md 路径：docs/iterations/0015-hub-orchestration-open-api/demand.md（v1.0.0，已确认）
- 2. 第一段摘要：用户原话 + 五项决策 + 侦察事实 F-1~F-15 + 六维诊断（M/N/C/E 全套）；用户改判后 TC-01/02/03/08 与原 D-1/D-2、C-1/C-3/C-6 标"已随需求收窄失效"但保留决策历史
- 3. 第二段摘要：做什么 W1~W7（连接/路由语义零变更、顶栏计数可点击展开只读 agent 列表、列表自动更新、心跳两档 + C-2 三约束、开放接口全接口化 + 全局事件流 + 统一错误契约、文档 oamp/API.md）；不做 N1~N14（显式含"hub 不启动 agent / hub 不关闭 agent"）；效果 E1~E9（含 E9 反向验证：界面与接口零启停入口）
- 4. 方案雏形/参考视角摘要：用户雏形已采集；机制类参考视角随需求收窄全部失效
- 5. 待确认项：无（仅失效项）
- 6. 疑问/越界：C-2（空闲 60s vs 租约 30s）按要求写成"必须由架构阶段解决的硬约束"，未在需求层指定机制

### 2026-09-12 10:38:00 · 调度决策 · 阶段推进核查

- 决策内容：阶段 1（需求收敛）推进条件满足，创建迭代分支 iteration/0015-hub-orchestration-open-api 并进入阶段 2（功能规格）
- 触发依据：demand.md v1.0.0 两段完整；用户改判已落盘（需求 1 取消、一键关闭取消）；零待确认项；无活跃冲突

### 2026-09-12 10:38:00 · 派发 · prd

- 阶段：阶段 2（功能规格）
- 任务：将需求合同原子化为可独立验证的功能卡，只做产品维度，不做架构决策

### 2026-09-12 10:45:27 · 收到报告 · prd

- 1. prd.md 路径 + 功能点数：docs/iterations/0015-hub-orchestration-open-api/prd.md；8（F01 列表面板 / F02 自动更新 / F03 心跳两档 / F04 接口面 / F05 全局事件流 / F06 统一错误契约 / F07 API 文档 / F08 连接语义回归）
- 2. prd/ 文件列表：F01-agent-list-panel / F02-agent-list-auto-update / F03-heartbeat-two-tier / F04-open-api-surface / F05-global-event-stream / F06-unified-error-contract / F07-api-doc / F08-connection-semantics-unchanged
- 3. model_inferred 列表：MI-01 任务/交互口径（最关键）/ MI-02 5s 判定界 / MI-03 相对时间粒度 / MI-04 多标签 / MI-05 断线对齐 / MI-06 事件载荷与时限 / MI-07 错误契约判据 / MI-08 空态 —— 全部经用户确认
- 4. 架构待填列表：AR-01~AR-08（8 条）
- 5. 疑问/越界：三条裁决已获用户确认（W2 租约取"机制不变、取值联动"；列表保留在线状态字段；8 卡不合并）

### 2026-09-12 10:45:27 · 调度决策 · 阶段推进核查

- 决策内容：阶段 2（功能规格）推进条件满足，进入阶段 3（技术架构）
- 触发依据：8 张卡齐备且覆盖 W1~W7（prd notes 追溯）；MI 项经用户确认（8/8 + 2 裁决）；AR-01~AR-08 已标注

### 2026-09-12 10:45:27 · 派发 · architect

- 阶段：阶段 3（技术架构）
- 任务：在现有架构上演进，补全功能卡的架构维度；核心难点 = AR-03 心跳降频与租约判活联动

### 2026-09-12 11:05:21 · 收到报告 · architect

- 1. architecture.md 路径 + 核心组件：docs/iterations/0015-hub-orchestration-open-api/architecture.md（v1.0.0，799 行）；三条硬契约 = ① 心跳两档与租约联动（`next_interval_ms` + 阈值公式 `max(基准, 2×通告)`，唯一落点 registry.findExpired，零重注册）② 全局事件流 `GET /api/events`（复用同一 transport + 全局键 null + 事件 agent_online/agent_offline + 2s 差值判定）③ 统一错误契约 `{error, code}`（5 码映射 + sendError 唯一构造点 + 12 处回填）
- 2. L1 决策清单：L1-01 协议可选字段增补（心跳 `next_interval_ms` / 注册回包 `lease_follows_interval`）——用户已确认采纳
- 3. 新引入技术组件：无（零新模块/进程/传输/依赖/数据层变更；全部改动落在既有 8 个 src 文件 + 3 个前端文件 + 新建 API.md）
- 4. 已补全 [架构待填] 条目数：26（AR-01~AR-08 的 26 个子项；AR-07 全局项落 §9；全文零残留）
- 5. 疑问/越界：R-1（E4 边界算术）已裁决保持 60s + 计数规程定为实现契约；prd 疑间 1/2 已闭环

### 2026-09-12 11:05:21 · 调度决策 · 阶段推进核查

- 决策内容：阶段 3（技术架构）推进条件满足（L1 已确认 / 8 卡 26 子项全有技术路径 / 无架构内部冲突），进入阶段 4（PR 规划）
- 触发依据：architecture.md 状态行「L1 决策已确认」；残留扫描（待确认类表述命中 0）；architect 三项推进条件自检声明

### 2026-09-12 11:05:21 · 派发 · pr-planner

- 阶段：阶段 4（PR 规划）
- 任务：反射出可独立合并的提交单元划分及单元间真实依赖，产出 prs/ 目录下的 PR 文件

### 2026-09-12 11:08:45 · 收到报告 · pr-planner

- 1. prs/ 路径 + 文件列表：docs/iterations/0015-hub-orchestration-open-api/prs/；pr-001-heartbeat-two-tier.md、pr-002-open-api-and-agent-panel.md、pr-003-api-doc.md
- 2. 每 PR 摘要：pr-001（心跳两档：config/registry/router/node-client/agent + agent-heartbeat.test.js；F03/F08）；pr-002（开放接口 + 顶栏面板：transport/web/index.html/app.js/style.css + transport.test.js/web.test.js；F01/F02/F04/F05/F06）；pr-003（API.md + README；F07）
- 3. depends_on 证据：pr-001/pr-002 均无依赖（各附代码级证据：snapshot 4 字段投影、web.js 路由表自足、transport 键结构）；pr-003 → pr-001 + pr-002（文档必须描述已存在的代码符号）
- 4. 校验：七字段齐备、文件范围互斥、依赖图无环（fan-in）、F01~F08 全覆盖且无重复归属
- 5. 疑问/越界：G2+G3 合并为 pr-002 的边界裁决（web.test.js 互斥下唯一无环解，替代路径会成环）；三处更细切分被评估后否决（理由充分）；architecture 一处行数引用偏差（647 vs 644，不影响判断）

### 2026-09-12 11:08:45 · 调度决策 · 阶段推进核查

- 决策内容：阶段 4（PR 规划）推进条件满足，进入阶段 5；初始化并发配置（起始 3 / 硬上限 5 / 有效上限 3）；**首批并发派发 pr-001 ∥ pr-002**（依赖均为空）；阶段 2/3/4 验证合并为一次 verifier
- 触发依据：3 PR 七字段齐备；depends_on 有代码级证据；文件范围互斥；依赖图无环；F01~F08 全覆盖

### 2026-09-12 11:08:45 · 派发 · verifier（阶段 2/3/4 合并验证）

- 阶段：阶段 3（技术架构）
- 任务：独立验证 prd 覆盖性、architecture 补全度与 L1 判定、prs 依赖正确性与格式

### 2026-09-12 11:08:45 · 派发 · dev（pr-001-heartbeat-two-tier ∥ pr-002-open-api-and-agent-panel）

- 阶段：阶段 5（PR 实现，并发首批）
- 任务：pr-001（心跳两档与租约联动）；pr-002（开放接口 + 全局事件流 + 统一错误 + 顶栏面板）
- PR：prs/pr-001-heartbeat-two-tier.md、prs/pr-002-open-api-and-agent-panel.md

### 2026-09-12 11:16:09 · 调度决策 · Gate确认

- 决策内容：**L1-01（协议可选字段增补）经用户确认采纳**——`agent.heartbeat` 新增可选参数 `next_interval_ms`；`agent.register` 回包新增附加字段 `lease_follows_interval: true`。同批确认：R-1 保持 60s、TC-05 不纳入 tasks、TC-06 不鉴权仅同机、TC-07 文档 = `oamp/API.md`；主 agent 另裁决统一错误契约横切变更按 L2 处理。
- 触发依据：主 agent 向用户呈报 L1-01（含采纳/回退机制 C/只采纳一半三选项）与 R-1 两问，用户回复「采纳（推荐）」与「保持 60s（推荐）」；补记原因 = 独立验证指出产物内缺 Gate 确认留痕（verify-20260912-111418-stage234.md 标准 4）

### 2026-09-12 11:16:09 · 收到报告 · verifier（阶段 2/3/4）

- 1. 报告路径：docs/iterations/0015-hub-orchestration-open-api/clarifications/verify-20260912-111418-stage234.md；结论 PASS（0 fail / 3 partial / 9 偏差）
- 2. 逐项判定摘要：prd 覆盖性与无技术污染 pass；AR 全填零残留 pass；L1-01 标注成立（且独立复核「transport 全局键 + /api/events」不构成系统边界变更）；三条硬契约可执行性经代码对照 pass；prs 七字段/互斥/无环/覆盖 pass
- 3. 最需关注发现：L1-01 的用户确认留痕不足（history 无 Gate 记录、status 待确认项无该条）→ **已由主 agent 补齐**（见上一条 Gate确认记录）
- 4. 疑问/越界：borderline 项（统一错误契约横切变更）判 L2 —— 主 agent 已裁决接受

### 2026-09-12 11:43:10 · 收到报告 · dev（pr-001 ∥ pr-002 实现完成）

- 1. pr-001 产出：config/registry/router/node-client/agent（+heartbeatIdleMs 派生 / findExpired 阈值公式 / next_interval_ms 透传 / 自调度 setTimeout 链 / heartbeatPlan 档位判定）+ agent-heartbeat.test.js（+6 例）；commit 8cee94e；真实环境两档 4/4（活跃 10s、空闲 185s 恰 3 跳、恒 online 零重注册、任务后 31ms 恢复）
- 2. pr-002 产出：transport（publishGlobal/globalCount）+ web（/api/events、?state=online、sendError 回填 20 处）+ index.html/app.js/style.css（#agent-panel）+ transport/web.test.js（+9 例）；commit b562a26；API 实测（事件上下线、键隔离）+ 浏览器四步实测
- 3. 已知契约冲突（pr-001 上报）：卡验收 6 与 architecture §3.4/§3.5 对"固定数字入参是否通告"表述冲突 → 主 agent 裁决以契约为准，卡已修正
- 4. 测试：pr-001 → 232/232；pr-002 → 235/235（两者合入后）
- 5. 越界：pr-001 额外改 config-file.test.js（派生键断言，属变更必然影响面）；两 PR 主仓库 oamp/ 零改动

### 2026-09-12 11:43:10 · 收到报告 · verifier（pr-001 / pr-002 验收）

- 1. 报告路径：verify-20260912-114015-pr001.md（PASS，0 fail / 2 partial / 4 偏差）、verify-20260912-114018-pr002.md（PASS，0 fail / 1 partial / 5 偏差）
- 2. 逐项判定摘要：pr-001 协议面/阈值公式/两档行为/降级路径/回归全 pass；pr-002 事件流/错误回填（独立核实 19+1=20 处）/无参响应逐字节相同/浏览器五项/变异实验全 pass
- 3. 最需关注发现：pr-002 的 partial = 委托书写"期望 232"计数失真（实际 235，非缺陷）；pr-001 的 2 partial + 4 偏差待归档
- 4. 疑问/越界：两 PR 隔离环境均已清理

### 2026-09-12 11:43:10 · 调度决策 · 槛位释放

- 决策内容：pr-001 与 pr-002 均验收 PASS 并合并 → 槛位释放（累计 2）；pr-003 依赖满足，立即派发；本迭代存在真实并发（首批两 PR 同轮派发）
- 触发依据：两份 verify 报告结论 PASS；git log merge commits；迭代分支全量 235/235

### 2026-09-12 11:43:10 · 派发 · dev（pr-003-api-doc）

- 阶段：阶段 5（PR 实现）
- 任务：实现 PR-003（oamp/API.md 接口文档 + README 同步）
- PR：prs/pr-003-api-doc.md

### 2026-09-12 12:09:33 · 收到报告 · dev + verifier（pr-003）

- 1. pr-003 产出：oamp/API.md（849 行六章：概览/约定与错误契约/10 条接口/6 类事件/10 组可粘贴示例/不做项）+ README 四处同步；commit 7cbe43a → 返工 e54cd40（修 7 处文档表述：message_id 语义、离线墓碑两类、路径穿越 404、archived 两值、时延口径、示例对话一致性、路径参数行）
- 2. 验收结论：PASS（文档与代码 1:1 对齐：10 接口 == web.js 路由集合、5 码逐键逐值、6 事件 == publish 点集合；示例隔离环境实跑全通过）
- 3. 最需关注发现：3 partial = 2 处事实性错误 + 1 处措辞失真（已在返工中修正）；反向核对显示机械检查对 7 类注入失真检出 5 类
- 4. 疑问/越界：D5 同款表述存在于 architecture.md（已由 architect 同步 9 处 + 新增 R-11：空闲档强杀离线时延 ~120s 为已接受代价）；隔离环境已清理

### 2026-09-12 12:09:33 · 调度决策 · 槛位释放

- 决策内容：pr-003 合并 → 槛位释放（累计 3）；阶段 5 完成（3/3 PR）；派发阶段 6 最终验证
- 触发依据：verify-20260912-120246-pr003.md 结论 PASS；迭代分支全量 241 用例（240 pass / 1 fail = 已知 cluster-actions 非密闭）；git log merge commits

### 2026-09-12 12:09:33 · 派发 · verifier（阶段 6 最终验证）

- 阶段：阶段 6（独立验证）
- 任务：迭代最终产物整体验收 + **并发调度三项核查**（本迭代存在真实并发）

### 2026-09-12 12:19:15 · 收到报告 · verifier（阶段 6）

- 1. 报告路径：docs/iterations/0015-hub-orchestration-open-api/clarifications/verify-20260912-121714-stage6.md；结论 PASS（0 fail / 4 partial / 9 偏差）
- 2. 逐项判定摘要：阶段 5 推进条件 pass；三条硬契约独立代码检索 + 隔离环境复现（LEASE_ADJUSTED threshold=120000 / 键隔离 / 5 码含 413）；前端三类行为真实 Chromium 独立复现；零启停为结构性成立（hub 进程无 spawn/kill + 8 个 RPC 方法面封闭）
- 3. 最需关注发现：并发三项 = ① worktree 窗口重叠 pass（同基分叉 + 3m24s 窗口 + 两份验收相隔 3 秒）② 并发配置真实更新 pass ③ 爬升公式落盘值未重算（partial，不影响派发，已修正字段）
- 4. 疑问/越界：测试方法学披露（因活集群约束，改用 /tmp 干净克隆跑全量 241/241 + 定向复现已知失败）

### 2026-09-12 12:19:15 · 调度决策 · 阶段推进核查

- 决策内容：阶段 6 推进条件满足（0 fail）；修正并发配置的「当前有效上限」字段（3→5，按公式重算）；迭代分支合入 main
- 触发依据：stage6 报告结论 PASS；偏差 D1（有效上限未重算）由 verifier 精确指出
