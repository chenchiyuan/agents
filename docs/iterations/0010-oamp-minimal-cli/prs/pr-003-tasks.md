# PR-003 任务图：status 只读查询

**来源输入**：`prs/pr-003-status-query.md`（PR 定义：文件范围 2 文件/验收 4 条/depends_on pr-001+pr-002）、`architecture.md` §3.1（ST-->RP/ST-->CFG 引用边）、§4.4（router.status 方法/schema）、§5.2（快照 4 字段）、§5.7（外显 UTC ISO-8601）、§7.2（config socket 定位/OAMP_SOCKET）、§7.3（输出格式/零节点/M-02）、§10.2（harness/轮询）、D8/D17、`prd/F05-status-readonly-query.md`（验收 1-5 + M-02 已确认 + 架构维度）
**生成角色**：planner（阶段 5）
**日期**：2026-09-09
**修订记录**：无

## 范围声明

- 任务图覆盖 PR-003 文件范围 **2 个文件**：`oamp/src/status.js`、`oamp/test/status.test.js`。
- **不创建** pr-004 文件（`test/helpers/fake-node.js`、`delivery-contract.test.js`）与任何其他 PR 文件；`cli.js` 的 status 分发分支（pr-001 已落地：`loadAndRun('./status.js','status',argv.slice(1))`）**只读消费、不改动**——status.js 模块 default 导出形态须与该分发约定对齐（异步入口函数 + 返回数值退出码，§7.1/O-1 收敛）。
- **不改动** pr-001/pr-002 已合并文件；Router 侧 `router.status` 方法（pr-002 router.js/registry.js 已落盘，返回按 instance_id 排序的 4 字段 nodes 快照，§4.4/§4.6）只读消费。
- 进程级测试一律 `node bin/oamp.js …` 子进程方式（§10.2）；测试 socket 一律系统临时目录（`fs.mkdtemp(os.tmpdir())`），绝不触碰仓库内 `.runtime/`。
- 零第三方依赖；node:test 载体 = `node --test test/status.test.js` 单独跑与 `npm test`（`node --test test/*.test.js`）全绿。

## 依赖图

```mermaid
flowchart LR
    T1[<b>T1</b> src/status.js 查询+渲染] --> T2[<b>T2</b> test/status.test.js F05 进程级验收]
    T2 --> T3[<b>T3</b> PR-003 集成验收]
```

- **关键路径（最长依赖链）**：`T1 → T2 → T3`（2 条边）；关键任务 = T1（status.js 实现，全部验收的行为源）、T2（status.test.js，F05 四条验收的可执行载体）。
- **无环确认**：单链依赖，无任何回边；T3 为汇点。T1 无本 PR 内前置（前置 = pr-002 已合并的 rpc.js/config.js/harness.js 与 pr-001 的 cli.js 分发，属既有基线，非本图节点）。

## 任务清单

### T1 — src/status.js：只读查询客户端 + 对齐表格渲染
**描述**：`oamp status` 命令实现（architecture §3.1 ST 组件 / §4.4 router.status / §7.3 输出格式 / D8/D17 + F05）：模块 default 导出 async 入口（cli.js 调用约定）；流程 = loadConfig 取 socketPath（§7.2）→ net.connect UDS → RpcPeer 发 `router.status` 无参请求（2s 上限，D17）→ 渲染 padEnd 对齐表格到 stdout（列 instance_id/session_id/state/last_heartbeat，按 instance_id 排序，last_heartbeat 外显 UTC ISO-8601）→ 返回 0；Router 不可达 → stderr 明确报错（含 socket 路径 + router 未运行提示）+ 返回 1，stdout 零输出（M-02/F05-3，不静默空结果）；零节点 → 表头无数据行 + 返回 0（§7.3 合法空态）。
**涉及文件**：`oamp/src/status.js`（新建）
**优先级**：P1
**前置依赖**：无本 PR 内前置（消费 pr-001 `src/config.js` loadConfig、pr-002 `src/rpc.js` RpcPeer）
**验收标准**（可测试 / 可追溯）：
1. 模块 default 导出形态 = async 函数 `default(restArgs)`、返回数值退出码（成功 0 / 失败 1）——与 cli.js `loadAndRun` 分发约定对齐（pr-001 §7.1 注释：status 分支 `argv.slice(1)` 透传，restArgs 一般为空；多余 extras 按 O-2 惯例忽略，不报错不校验）。（静态核查 + T2 进程级触发）
2. Router 不可达（socket 不存在 / 无活 Router）：**仅** stderr 报错、错误文本含 socket 路径与 router 未运行提示（§7.3 "cannot reach…（router 未运行？）" 语义，M-02/F05-3）；stdout 零输出（不输出表头/空表格冒充成功）；返回 1。（T2 进程级用例 2 断言退出码/stderr/stdout 三面）
3. 查询成功路径：连上 Router 后发 `router.status`（无参）请求，请求超时上限 2s（D17 "status 2s"）；查询失败/超时 → stderr 报错 + 返回 1（快速失败，不静默）。（T2 用例 1 正常面 + 代码走查超时参数存在性；超时分支无独立进程载体——Router 必应答，注记）
4. 渲染：stdout 对齐文本表格（padEnd，零第三方依赖，§7.3/D8），首行表头 = `instance_id session_id state last_heartbeat`；数据行按 instance_id 排序（与 §4.4 result 排序不变量一致，客户端输出自足保证）；每节点行四字段齐全：instance_id / session_id（全量 36 字符 UUID，§7.3）/ state（快照原值 online|offline）/ last_heartbeat（epoch ms → UTC ISO-8601 毫秒 Z 后缀外显，§5.7/D17 外显约定）。（T2 用例 1/4/5 断言）
5. 零节点（Router 运行、注册表空）：stdout 表头 + 无数据行，返回 0——合法状态非错误（§7.3 "表头 + 空行、退出 0"）。（T2 用例 5）
6. 查询路径零副作用：只读——不注册身份、不发任何写方法、不触碰注册表/状态（§4.4 router.status 任意连接可用 + F05-4）；运行结束关闭连接。（T2 用例 3 断言 registry 不变 + 静态核查仅调用 router.status）
7. 静态：零第三方依赖（仅 `node:net` + `src/config.js`/`src/rpc.js` 消费，§3.1 CFG-->ST/RP-->ST 引用边）；不写仓库 `.runtime/`（socket 路径取自 config，测试经 OAMP_SOCKET 隔离，§7.2）；hygiene 凭据字段名扫描零命中（§9，src 扫描面）。
8. `[model_inferred→Q-1 待主 agent 确认]`：连接失败 stderr **文案措辞**——§7.3 示例为英文 `cannot reach oamp router at <path>（router 未运行？）`；pr-002 已落地 agent.js 同类失败文案为中文 `oamp: agent start 失败: 无法连接 oamp router（socket=…；router 未运行？先执行 oamp router start）`。status 取 agent.js 同款中文形态（前缀 `oamp: status 失败: …`，含 socket 路径 + "router 未运行？"提示），M-02 硬验收 = 退出 1 + stderr 明确含 socket 路径 + stdout 不静默空结果，措辞细节提请主 agent 确认（跨模块一致性优先于 §7.3 英文字面）。
9. `[model_inferred→待主 agent 确认]`：status 客户端**实现形态** = net.connect + `RpcPeer.request('router.status', {}, {timeoutMs:2000})`（复用 pr-002 rpc.js；**不引入 NodeClient**——NodeClient 面向注册节点生命周期（register/heartbeat/deregister/send），status 是短命只读查询进程、不注册，§4.4 明确"router.status 不需要注册身份"）；连接阶段沿用 node-client.js `DEFAULT_CONNECT_TIMEOUT_MS=2000` 同值定时器防悬挂（既有先例，非 D17 三条请求上限之一，防御实现）。

### T2 — test/status.test.js：F05 进程级验收
**描述**：F05 测试卡（PR 文件验收 4 条 + prd F05 1-5 + M-02）：以真实 Router + 真实 agent 子进程驱动 `node bin/oamp.js status`（临时 socket + 缩短 env），断言 stdout 表格字段/排序/格式、不可达失败三面（退出码/stderr/stdout）、只读无副作用（两次查询一致）、kill 后 offline 反映、零节点合法空态。
**涉及文件**：`oamp/test/status.test.js`（新建）
**优先级**：P1
**前置依赖**：T1；消费 pr-002 `test/helpers/harness.js`（startRouter/startAgent/buildEnv/queryStatus/waitFor/stopAll，§10.2）
**验收标准**（node:test，单独运行全绿 + 与既有测试同跑不冲突）：
1. 字段齐全/排序/多节点（PR 验收第 1 条 + F05-1/2 + §7.3/D8）：真实 Router + 两个真实 agent（dev-2、dev-1 **乱序启动**）均 online 后执行 status 子进程 → 退出 0；stdout 首行 = 四列表头；数据行恰 2 行、按 instance_id 升序（dev-1 先于 dev-2）；每行拆分出 4 字段；session_id 为 36 字符 UUID 且与 queryStatus 快照一致；state=online 与快照一致；last_heartbeat 匹配 UTC ISO-8601（`Z` 后缀毫秒）且与快照 epoch 转换值一致（字段值与实际注册/心跳状态一致，F05-2）。（node:test）
2. Router 未运行 → 非零退出 + stderr 明确报错（PR 验收第 2 条 + M-02/F05-3）：临时空 socket 路径（无 Router）→ status 子进程退出码 1；stderr 含 socket 路径与 router 未运行提示；stdout 为空（不输出表头/数据冒充成功）。（node:test）
3. 只读无副作用（PR 验收第 3 条 + F05-4）：Router + 1 agent online → 连续两次 status：两轮输出解析的 (instance_id/session_id/state) 集合一致、行序一致；last_heartbeat 第二轮 ≥ 第一轮（仅随心跳自然推进，F05 判定口径）；两次之间 queryStatus 快照条目集合/session/state 不变；status 执行后 agent 仍 online 且心跳继续推进（查询未扰动节点）。（node:test）
4. offline 反映（PR 验收第 4 条 + F05-5/E2）：Router + agent → kill（SIGKILL，无 deregister）→ waitFor Router `AGENT_OFFLINE` 行（timeout+sweep 上界内）→ status 输出该节点行 state=offline（墓碑保留，§5.4）。（node:test）
5. 零节点合法空态（§7.3 补充锁定，防与 M-02 失败空态混淆）：Router 运行但零注册 → status 退出 0、stdout 仅表头无数据行。（node:test）
6. 组织约定：每用例独立临时 socket（makeTempSocketDir）+ 缩短 env（buildEnv）；teardown stopAll 清理无悬挂进程（§10.2）；时序断言用 waitFor 轮询不裸 sleep；status 子进程一律 `node bin/oamp.js status` 拉起、退出码经子进程 exit 事件断言（§10.2）。（运行核查）
7. `[model_inferred→待主 agent 确认]`：status 输出行解析方式——数据行按 `/\s{2,}/` 拆分（字段值均无可打印空格：instance_id ∈ \x21-\x7E 不含空格、UUID/state/ISO 时间戳均无空格，§4.6/§5.7），表头用行首正则匹配，不依赖具体 padEnd 宽度常量（避免测试复刻实现布局）。

### T3 — PR-003 集成验收
**描述**：PR 级收口——`oamp/` 下 `node --test test/status.test.js` 一次全绿 + `npm test`（含 pr-001/002 既有 29 用例）全绿 + 逐条对照 PR 文件 4 条验收标准与 F05 卡取证（字段/排序/多节点、不可达失败、只读无副作用、offline 反映 + M-02），产出通过记录供独立 verifier 复核与 merge 决策。
**涉及文件**：无新增（复用 T1/T2 产物）
**优先级**：P0
**前置依赖**：T1、T2（传递覆盖全部验收行为）
**验收标准**（可测试 / 可追溯，逐条对应 PR 文件"验收标准"4 条 + F05 卡）：
1. `oamp/` 下 `node --test test/status.test.js` 一次全绿（F05 用例集）。（运行核查）
2. `npm test`（`node --test test/*.test.js`）全绿——既有 29 用例（cli 8 / router-registry 8+ / agent-heartbeat / event-log / hygiene，pr-002 收官基线 29/29）仍绿 + status 新增用例全绿（PR 验收第 1 条载体 + 回归面）。（运行核查）
3. 逐条对照 PR 验收第 1 条：真实 Router + ≥1 真实 agent（缩短 env）后 `node bin/oamp.js status` → stdout 对齐表格、每节点行四字段（UTC ISO-8601 last_heartbeat）、按 instance_id 排序（§7.3/D8）。（运行核查 + T2 记录）
4. 逐条对照 PR 验收第 2 条：Router 未运行 → stderr 明确报错（含 socket 路径与 router 未运行提示）+ 退出码 1，不输出空结果冒充成功（M-02/F05-3）。（运行核查 + T2 记录）
5. 逐条对照 PR 验收第 3 条：连续执行 status 不改变节点状态与注册表内容——两次输出仅 last_heartbeat 随心跳自然推进、无其他差异（F05-4）。（运行核查 + T2 记录）
6. 逐条对照 PR 验收第 4 条：kill 节点（无 deregister）后再次 status → 该节点 state 显示 offline（F05-5/E2，pr-002 租约扫描已判 offline）。（运行核查 + T2 记录）
7. 文件范围核查：git diff 仅含 `oamp/src/status.js`、`oamp/test/status.test.js` 与 `prs/pr-003-tasks.md`；无其他文件创建/修改；cli.js 零改动（只读消费，Q-2 复核其 status 分支与 default 导出对齐）；零第三方依赖变更。（git 核查）

## model_inferred 汇总（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1（Q-1） | T1 | 连接失败 stderr 文案取 agent.js 同款中文形态（`oamp: status 失败: 无法连接 oamp router（socket=…；router 未运行？…）`），而非 §7.3 英文字面示例；M-02 硬验收（退出 1 + stderr 含 socket 路径 + 不静默空结果）不变 | §7.3 示例措辞 vs pr-002 agent.js 已落地同场景文案；跨模块一致性优先（repo 惯例：错误/用法文案全中文） |
| MI-2 | T1 | 客户端实现 = net.connect + RpcPeer.request（不引入 NodeClient，status 不注册）；连接防悬挂定时器沿用 2s 既有先例 | §4.4 "router.status 不需要注册身份/任意连接可用"；node-client.js DEFAULT_CONNECT_TIMEOUT_MS=2000 先例 |
| MI-3 | T2 | 输出行按 `/\s{2,}/` 拆分断言、表头行首正则匹配，不复刻 padEnd 宽度布局常量 | §7.3 padEnd 对齐（宽度为渲染实现细节）；字段值字符集保证无空格（§4.6/\x21-\x7E） |

## 开放项（不阻断本 PR，报告主 agent）

- **Q-1（MI-1）**：status 连接失败 stderr 文案措辞——§7.3 示例英文 `cannot reach oamp router at <path>（router 未运行？）` vs pr-002 已落地 agent.js 中文同场景文案。实现取中文（跨模块一致），措辞细节提请确认；M-02 硬验收语义不受影响。
- **O-1（跨 PR 接口）**：cli.js status 分支 `argv.slice(1)` 透传——`oamp status` 时 restArgs=[]；多余位置参数（如 `oamp status extra`）按 O-2 惯例（agent 先例）忽略不报错；本 PR 单点收敛，不擅改 cli.js。
- **O-2（测试边界）**：查询超时（2s，D17）与"Router 存活但响应异常"分支无独立进程级测试载体（自有 Router 必应答，异常路径无现实触发源）——以代码走查 + 超时参数存在性注记覆盖，不制造故障注入。
- **O-3（阶段 6 边界）**：README E2 手测补充（status 手测步骤）与 F08-1 git check-ignore 实查留阶段 6，不放入本 PR（本 PR 文件范围仅 src/test 两文件）。
