# 历史记录

**迭代**: 0010-oamp-minimal-cli
**history**: 开启

## 事件记录

### 2026-09-09 10:41:00 · 调度决策 · 工作流启动

- 用户确认三项基础决策（user_confirmed）：迭代 ID `0010-oamp-minimal-cli`；代码位置 `oamp/` 顶层；实现语言 Node.js。
- 用户约束（user_confirmed）：本迭代独立分支实现，阶段 6 后不自动合并 main，由用户决定是否合入主干。
- 已创建 `docs/iterations/0010-oamp-minimal-cli/status.md`（所有阶段 ⬜）。

### 2026-09-09 10:41:30 · 收到用户消息 · 需求输入

- 按 workflow-pb 工作流执行，先实现最小拓扑结构支持测试。
- 期望 CLI 程序：可启动并维护 Router；可启动 agent daemon 并维护心跳。
- 参考背景：docs/ds/ 方案包（OAMP：JSON-RPC 2.0 over UDS + Router 星型拓扑 + ack/heartbeat 分离）。

### 2026-09-09 10:42:00 · 派发执行角色 · demand（阶段 1）

- 角色文件路径：`.pb-agents/roles/demand/demand.md`（全文注入 brief）。
- 输出目标：`docs/iterations/0010-oamp-minimal-cli/demand.md`（草稿 + 待确认提案清单）。
### 2026-09-09 13:20:00 · 收到用户消息 · demo 增量需求

- 用户从使用角度新增：主进程（omp 主 agent）连 Router 查活跃 agent 列表；经 Router 指派任务并随时查进度明细。

### 2026-09-09 13:22:00 · 调度决策 · demo 增量三决策（user_confirmed）

- 任务执行体 = Shell 命令执行（用户否决推荐桩）；进度/明细存储 = Router 全内存任务表 + 查询 RPC；增量管理 = 延续 0010 分支。

### 2026-09-09 15:10:00 · 收到执行报告 · demo 增量实现完成

- 信封 type 字段（task.request/update/result/notice）、Registry 任务表、Router task_get/task_list 与 rejected ack 终结、agent shell 执行器、CLI task send/status/list/watch、task.test.js 6 用例、testenv 任务演示；npm test 52/52 三连稳定；真实 CLI 端到端验证 PASS。architecture.md §15 记录（D18~D21）。

### 2026-09-10 02:20:00 · 收到报告 · 常驻 agent 反复掉线（休眠场景）

- 现场：dev-1/verify-1 两次同刻 CONNECTION_LOST（14:11、14:20 UTC）；Router 日志心跳静默约 100s 后双判 AGENT_OFFLINE。pmset 证实本机电池维护休眠（Maintenance Sleep/DarkWake）。
- 结论：非代码缺陷——"断线即退"（N7）在系统休眠场景无自愈。

### 2026-09-10 02:30:00 · 调度决策 · 用户授权"请继续"→ 实施 A+B 组合

- A（根治）：agent 自动重连自愈（D22）；B（环境）：caffeinate -dims 包裹常驻进程。
- 实现：config 增 OAMP_RECONNECT/OAMP_RECONNECT_MAX_MS；agent 主循环重写（退避重连、被顶替不重连）；router 替换前发 agent.replaced；reconnect.test.js 4 用例；全量 56/56 三连稳定。
- 真实验证：hub 停 Router → agent CONNECTION_LOST + 退避 RECONNECT_WAIT（进程存活）→ 重启 Router → 3s 内两 agent 自动 online（新 session）。

### 2026-09-10 03:00:00 · 调度决策 · Web 控制台需求（用户三决策）

- 用户要求参考 first-tree 截图实现网页（左栏对话列表/右栏详情/@唤起 agent）。
- 确认：消息即命令（shell 执行）；`oamp web` 内建服务（Node http）；按话题分会话。
- 实现：Router 会话表 + 3 个 chat RPC；src/web.js（HTTP+静态页+常驻 web 身份桥接，心跳保活修复）；web/ 前端三件套；test/web.test.js 4 用例；browser 驱动验证（@补全/发送/渲染/列表）。
- npm test 60/60 两连稳定。

### 2026-09-10 03:40:00 · 调度决策 · 真实消息处理（omp LLM 执行器）

- 用户要求：@agent 经协议真实传递，agent 用真实 omp（默认 gpt）处理；测试案例=推荐一部日本动漫并给理由。
- 探查：omp v18.0.11，`omp -p --no-tools --no-session "<prompt>"` 非交互，实测 5.8s 返回质量回答。
- 实现：agent 执行器路由（executor=omp 分支，spawn omp -p/逐行回流/ANSI 清理/默认 300s 超时/`OAMP_OMP_BIN` 可注入）；Web 默认走 omp 提问（! 前缀走 shell）；前端 omp 渲染区分（❯ 提问 + 浅色回答 + omp 徽标）。
- 验证：omp-executor.test.js 4 用例绿；真实端到端 4.99s 回答回流 + 浏览器渲染通过；npm test 64/64。
