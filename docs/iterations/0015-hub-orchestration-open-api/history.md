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
