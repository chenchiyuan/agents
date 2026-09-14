# 阶段 3 澄清记录（architect · 第 1 轮）— 0022-agent-launcher-and-protocol-layer

**角色**: architect（阶段 3 · 技术架构）
**日期**: 2026-09-14
**迭代**: 0022-agent-launcher-and-protocol-layer
**工作区**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0022-agent-launcher-and-protocol-layer`（一切写入均以该地址为根的绝对路径）
**输入**: `prd.md` v0.2.0 + `prd/F01~F13*.md`（13 卡，`[架构待填]` T-01~T-11）+ `demand.md` v1.0.0（W1~W8 / N1~N12 / M1~M7 / E1~E7 / R1~R7；**M7 是本轮硬前置**）+ 现有代码库 `oamp/**`（只读）
**产出**: `architecture.md`（v0.1.0，786 行）+ 13 张卡的「架构待填」段回填 + 本记录 + `clarifications/probes/**`（6 脚本 + 6 原始输出）
**会话限制**: 本阶段运行在**无实时对话通道**的子 agent 中 ⇒ **零自问自答**；未获用户确认的推断集中列于 §5，等主 agent 转呈。

---

## §1 现状基线提炼（既有架构怎么长出来的）

### 1.1 一句话现状

> **web 落盘与推送（SQLite + SSE）、agent 管上下文（按 chat 的 `omp acp` 常驻进程池）、Router 管路由与运行态**（0011 定的形状，本迭代**不改这三层分工**，只把最右侧「怎么起 agent、怎么跟它说话」这一层显式化）。

### 1.2 关键现状事实（`文件:行号` 均为本轮实读）

| # | 事实 | 位置 |
|---|---|---|
| B1 | 协议实现被消费层**直接 import 并直接构造** | `src/context-pool.js:7`（import）、`:203`（`new AcpClient`，函数范围 `:200-249`） |
| B2 | **argv 知识两份**且与协议语义同处一类 | `src/acp-client.js:137-144`（`['acp','--no-skills','--no-rules'] …`）；`src/agent.js:192-199`（`['-p','--no-session'] …`） |
| B3 | **思考增量被显式丢弃**（acp 链路） | `src/acp-client.js:201-203`（`_chunkHandler` 只接受 `agent_message_chunk`） |
| B4 | 三条执行路径分散在任务面 | `src/agent.js:436-440`（`runTask` 分派）+ `:181`（`-p`）/ `:372`（常驻）/ `:443`（shell） |
| B5 | 门的上浮函数只认 ACP 形态 | `src/agent.js:303-311`（选项映射）、`:319-337`（`raiseConfirmation`，7 字段信封）；`src/acp-client.js:23`、`:30-34`（工具名提取原语）、`:434-575`（两道门的处理） |
| B6 | 过程增量的既有通道 | `src/web.js:1626-1632`（`task.update` → SSE `task_update`，`{chat_id,task_id,kind,text,line}`）；`src/agent.js:392-399`（`onChunk` → `{kind:'chunk'}`） |
| B7 | 前端**不区分 kind**（过程与答案混流） | `web/app.js:566-572`、`:598-603` |
| B8 | 配置面只有 3 键、无协议相关键 | `src/config.js`（`data.db` / `defaults.model` / `context.max`；叶子模块） |
| B9 | 零依赖约束有**测试护栏** | `package.json`（`dependencies={}`、`engines.node>=22`）；`test/hygiene.test.js`（断言 dependencies 为空 + 凭据字段名扫描） |
| B10 | 既有路由 **21 条**；`web.js` 1759 行 | `src/web.js`、`llms.txt:11`（「## 接口（21 条）」） |
| B11 | **命名撞车（同名不同物）**：`src/rpc.js` 是 oamp **自己的** UDS JSON-RPC（Router 面），与 `omp --mode rpc` 不是一回事 | `src/rpc.js:1-8` |

### 1.3 D-2（消费层不自行构造 / 选择协议实现）的**当日基线快照**

| grep（只读，未改代码） | 结果 | 读法 |
|---|---|---|
| `grep -rn "acp-client" oamp/src/` | `context-pool.js:7`（import）；`acp-client.js:1`（自身文件头）；`agent.js:30`（**注释**引用） | **实质违规恰 1 处** |
| `grep -rn "'acp'\|"acp"\|'rpc'\|"rpc"" oamp/src/{agent.js,context-pool.js,web.js,config.js}` | **零命中** | "按协议取值的分支"今天是**零基线**，本迭代只需保持零 |
| 消费层持有的 argv 知识 | `agent.js:192` 的 `['-p','--no-session']` | 归一动作 = 把这段 argv 迁进 L1 profile |

⇒ 本迭代在 D-1~D-3 上的实际动作面 = **一处 import + 一处构造 + 一段 argv**；注入点是"把已存在的单一接缝显式化"，不是大重构。这条结论直接支撑 §3 的 L1 判定与 `architecture.md §10` 的奥卡姆表。

---

## §2 M7 实测（**本轮硬前置；先实测后定接口**）

产物：`clarifications/probes/`（6 脚本 + 6 原始输出，均落工作区内）。环境：本机 `omp v18.0.11`、模型 `deepseek/deepseek-v4-flash`、cwd `/tmp`。可复跑：`node probe-m*.mjs > m*-output.txt 2>&1`。

| 探针 | 文件 | 覆盖 | 一句话结论（**接口按此定型**） |
|---|---|---|---|
| M-1 | `probe-m1-session-model.mjs` / `m1-output.txt` | M-1 会话模型 | **1 进程 = 1 会话 = 1 在飞轮次**：`get_state.sessionId` 恒单值；运行中再发 `prompt` **被拒**（`success:false`，错误原文 "Agent is already processing. Use steer() or followUp()…"）；`new_session` 是**替换**（sessionId 变、上下文丢）⇒ 池 : 进程**保持 1:1**，同键串行是**必要条件** |
| M-2 | `probe-m2-cancel-timeout.mjs` / `m2-output.txt` | M-2 取消与超时 | `abort` **无参数、幂等**（空转不报错）；作用域 = 该进程唯一会话的在飞轮次；`response{abort}` 与 `agent_end{isTerminal:true}` **同刻**；**门无 `timeout` 字段、无协议级超时**（我故意 45s 不回执，轮次仍挂、工具不执行）；`tool_execution_start` 与门同刻到达 ⇒ **不是"已放行"判据** |
| M-2b | `probe-m2b-terminal-payload.mjs` / `m2b-output.txt` | M-2 终态载荷 + E3 前置 | `agent_end` = `{type,messages,isTerminal}`；**`stop_reason` / `usage` 可从末条 assistant 直取**（实测 `'stop'` + 六键 usage）⇒ 零额外往返；**不传 `--thinking` 时思考增量稳定出现**（88 条，首个 ≈1.8s）⇒ rpc profile **不得**传 `--thinking off` |
| M-3 | `probe-m3-argv-matrix.mjs` / `m3-output.txt` | M-3 argv 面 | 9 组矩阵：`--no-skills` / `--no-rules` / `--no-session` / `--tools=<list>` / `--no-tools` / `--append-system-prompt`（**systemPrompt 实测含探针标记**）/ `--approval-mode` / `--thinking` / `--max-time` / `--cwd` **全部可用**；`@file` 位置参数**被拒**（"not supported in RPC mode"，exit 1）；**acp 对照组用同一组非 mode 参数同样可用** ⇒ **一份 profile 字段集覆盖两协议，唯一差异 = mode 记号**（acp 子命令 / rpc flag / oneshot `-p`） |
| M-4 | `probe-m4-host-tools.mjs` / `m4-output.txt` | M-4 宿主工具面 | **默认零触发**（阶段 A 两次 prompt 零 `host_*` 帧）；`set_host_tools` / `set_host_uri_schemes` **显式注册后**才出现 `host_tool_call` / `host_uri_request`（阶段 B/C 各自实测到）⇒ `hostTools` 可**显式声明不具备**并在未来按既定入口实现 |
| M-5 | `probe-m5-gate-count.mjs` / `m5-output.txt` | M-5 门计数 | **3 次受门禁调用（2×bash + 1×write）→ 恰 3 道门**，按调用键分组每键 1 ⇒ **恒一道门，无需合并策略**；门形状恒 `method=select` + `options=["Approve","Deny"]` + **无 timeout**；`title` 多行且与 ACP 审批门**同源**（`Allow tool: bash\nCommand: …`）⇒ F15 的"复用既有提取原语"实测复现；同场 3 帧 `setWidget` **非门且无需回执**（未回执而轮次正常收尾） |

**探针自身缺陷的诚实登记**：M-4 脚本的 `phaseA_hostToolCalls` / `phaseA_uiRequests` 派生计数**不可用**（`phase` 是脚本级变量，记录发生时已进入阶段 C，字段被写成 `'C'`）。该探针的结论**以时间线为准**（阶段 A 两次 prompt 的窗口内零 `host_*` 帧；首次 `host_*` 均出现在对应注册动作**之后**）。**后续引用不得使用那两个派生数字**。

**实测 → 设计约束**：D-R1~D-R9（逐条见 `architecture.md §2.7`），其中 4 条直接改变了原计划：
1. **D-R1**：池 : 常驻进程 **1:1 保持**（原候选"是否 1:N"被实测否掉——RPC 连多会话都不支持）；
2. **D-R3**：rpc profile **不得传 `--thinking off`**（否则 E3 直接失败）；
3. **D-R2/M-2**：**门的等待不计入轮次超时**，且超时策略**只能在客户端侧实现**（协议面无超时面）；
4. **D-R4**：profile 只需一个 `modeArgs` 字段承载两协议差异（其余 flag 通用）。

---

## §3 L1 决策清单（**2 条待主 agent 确认；未确认前不进入实现**）

> 分级口径：**L1 = 引入新技术栈 / 改变现有核心模块职责 / 影响系统整体边界**。两条**不引入新技术栈、不新增依赖/进程**，但都改变既有核心模块职责或跨模块契约。

| # | L1 决策 | 是什么（一句话） | 为什么是 L1 | 备选（已比较） | 不确认的后果 | 我的建议 |
|---|---|---|---|---|---|---|
| **L1-1** | **协议注入点的落点与配置载体** | 注入点 = **新建 `src/protocol.js` 的 `createProtocolLayer()`**；配置载体 = **一个字符串**（协议名）；解析链 = 角色级 `oamp agent start <id> --protocol <v>` > env `OAMP_PROTOCOL` > `config.json` 新第 4 键 `protocol` > 内置 `'rpc'`；**不引入参数对象** | 新增一个配置面（三键→四键 + 一个新 flag）+ **改变 `ContextPool` 的构造契约**（不再自建协议实现） | ① 三档解析链 + 单一字符串键（**推荐**，体例逐字对齐既有模型链）；② 仅全局 `config.json`（与模型链体例不一致、同机多实例跑不同协议不可能）；③ `protocol:{name,options}` 对象（当前两实现零参数 ⇒ 空对象是纯负债）；④ 走 HTTP API / 控制台可切（**N3 明文禁止**） | F02 验收 1（入口唯一 + 解析链）、E2、D-1 **均无落点**；F03 整张卡无法判定 | **采纳 ①** |
| **L1-2** | **L2 标准面被写定为一份接口契约，并成为消费层的唯一依赖面** | 把 A3/P3 的四类内容（会话四动作 / 三类增量 / 两类反向请求 / 能力位）+ 协议中立错误类型 `ProtocolError`（码值**沿用既有五值**）+ 能力位键集（M6 六候选）写定为 `src/protocol.js` 的一份形状（签名见 `architecture.md §5.1`） | ① **改变现有核心模块职责**（`AcpClient` 从"被直接构造的实现"变为"实现标准面的一个实现"；`ContextPool` 从"持有具体客户端"变为"持有标准面会话"）；② 跨模块契约（三实现 + 两消费方共同依赖）；③ 决定 D-1~D-3 能否成立 | ① 一份标准面 + 三实现（**推荐**）；② 只做"每次调用传协议名"的分发函数（把协议知识摊回消费层 ⇒ **D-2 结构性不成立**）；③ 每能力一个独立小接口（组合爆炸，YAGNI）；④ `EventEmitter` / AsyncIterator 承载增量（与既有回调形态不一致，无收益） | W8/D-1~D-3 无判据；F09 无承载；F04/F07 无统一形状 ⇒ 阶段 4 无法切出无重叠 PR 边界 | **采纳 ①** |

### 3.1 候选复核（简报给出的另两条候选：**我的判定 = L2**）

| 候选 | 判定 | 理由 |
|---|---|---|
| 是否引入新的内部分层目录结构（如 `src/protocol/`） | **L2（判为不引入）** | ① 项目既有体例是 `src/` **平铺 19 文件**、无子目录；② 新建目录不解决任何功能点的问题（说不清"不引入它什么无法实现"）；③ 三层边界**已有可机械核的判据**（3 条 grep/diff），不依赖目录名；④ `docs/multi-omp-agent-protocol.md` §10/§14.1 已占用「adapter 层」指**消息面**（F13/登记⑤），新目录只会制造第二次同名不同物 |
| 常驻会话进程与上下文池的映射关系 | **L2（判为保持 1:1）** | ① 现状即 1:1；② **M-1 实测**证明 RPC 连"同进程多会话"都不支持（并发 prompt 直接报错）⇒ 1:N **物理上不可行**；③ 保持 1:1 ⇒ 池的键/队列/LRU/收尾语义**零改动**（最小改动面）。若主 agent 按"系统整体边界"处理为 L1，**结论不变**、仅多一次确认 |

---

## §4 L2 决策清单（自主决定，13 条）

| # | 决策 | 一句话理由 |
|---|---|---|
| L2-1 | 不新建目录，4 个新文件平铺 `src/` | 与既有体例一致；三层边界靠 grep/diff 判据而非目录名 |
| L2-2 | 池 : 常驻进程 **1:1 保持**；同键 FIFO 串行保留 | M-1 实测：并发 prompt 直接报错 ⇒ 串行是必要条件 |
| L2-3 | 「一轮结束」= `agent_end{isTerminal:true}`；受理回包仅记受理 | F2 + M-1（受理先于起轮）+ M-2（终态与 abort 响应同刻） |
| L2-4 | 增量映射：`thinking_delta→thinking`、`text_delta→chunk`、`toolcall_delta→tool_call`、`tool_execution_update→tool_output`；**空 delta 跳过** | M-2b 实测字段形状（首个 `toolcall_delta` 可为空串） |
| L2-5 | 门在**实现内**归一为既有钩子入参（`kind:'tool_approval'`），复用 `raiseConfirmation` 与 `readApprovalToolName` | M-5 实测 `title` 与 ACP 审批门同源；归一在实现内 ⇒ 消费层零改动 |
| L2-6 | 反向请求处置：门（select + `Allow tool: `）**必须回执**；其余交互类回 `cancelled:true`；纯展示类**不回执** | M-5 实测 3 帧 `setWidget` 未回执而轮次正常收尾；体例对齐既有 C5 |
| L2-7 | 一次性执行 = `createEphemeral()` **固定**用 oneshot 实现（不在选择域），argv 由 profile 构造 | F02 验收 3（选择域封闭）+ J4 + F8（argv 两份归一） |
| L2-8 | 取消 = 发 `{type:'abort'}`（无参、幂等）→ 等终态宽限 → 超宽限 kill；常量沿用既有 `CANCEL_GRACE_MS`/`KILL_GRACE_MS` | M-2 实测（无参、幂等、终态同刻） |
| L2-9 | 门等待**不计入轮次超时**；超时策略只在客户端侧 | M-2 实测（45s 未应答仍挂、门无 timeout 字段）+ 0021 L1-1 既有口径 |
| L2-10 | 关闭路径 = 关 stdin → 短宽限 → kill，并**容忍 EOF 后的晚到帧** | M-1（EOF → exit 0）+ M-4/M-5（EOF 后仍来 `setWidget`） |
| L2-11 | 未知帧忽略不崩；**`rpc_chunk` 分片帧实现重组**（v2：单帧 ≤1 MiB、逻辑帧 ≤64 MiB、片 ≤256 KiB） | D-R7 + `maxFrameBytes:1048576` 实测（大工具输出会分片，不重组即断流） |
| L2-12 | 能力位取值 = 三态 `'yes'\|'no'\|'degraded'`；**非 yes 必须**在 `capabilityNotes[key]` 给理由 | F09 验收 2/3（MI-03 三表态）+ M6 六候选原样 |
| L2-13 | profile 序列化 = 进程内 JS 字面量表，**不新增配置文件**；新增宿主 = 表内加一项 | W1/E7 最小落点；无运行时热改需求（YAGNI） |

---

## §5 `[model_inferred]` 集中列示（**7 项，未经用户确认，转呈主 agent**）

> 均为"需求已定必须有、但形态存在多解"的架构推断；已按**最简 / 最贴合现状**的方式落定，供主 agent 决定是否转呈用户。

| # | 推断内容 | 为何可能属用户决策 | 若按我的推荐值推进的后果 |
|---|---|---|---|
| MI-A-1 | 过程增量**不新增 SSE 事件类型**，只扩展 `kind` 取值（`thinking` / `tool_call` / `tool_output`） | A6 记录用户对"呈现形态"无预设想法，但这是**产品可见面**的形状选择 | 若要求独立事件类型，则 T-07 与"`web.js` 零改动"的前提失效（改动面扩大） |
| MI-A-2 | 过程展示 = **既有流式气泡内部分区**（思考块 / 工具块），不做折叠 / 配色 / 开关 | T-06 呈现形态（A6 无预设） | 若要求折叠或视觉分级，属 T-06 变更（不影响其它设计） |
| MI-A-3 | 门的呈现 = **`tool` 名作主标签、`title` 原样多行作详情**（复用既有条目渲染） | T-08（A6 无预设）+ R4 已知代价 | 若要求专门的多行 `title` 呈现，需前端新增渲染分支 |
| MI-A-4 | rpc profile **不传 `--thinking`**（依赖模型默认档） | 属 profile 内容维度；但它是 E3 成立的**必要条件**（D-R3） | 若显式传 `off`，**思考增量消失 ⇒ E3 直接失败**（这是事实约束，非偏好） |
| MI-A-5 | oneshot 的 `streaming` 表为 **`degraded`**（有 stdout 行流、无结构化 delta） | MI-03 只定"可表态"，未定取值分配 | 若要求 `no`，则既有 `stdout` 行流上报语义需重述 |
| MI-A-6 | 能力位最终集合 = M6 候选六项**原样**（不增不减） | M6 明文"最终集合与签名 `[架构待填]`"（A6 无预设） | 若需增删键，§5.7 表与测试断言同步调整（影响面收敛在 `protocol.js` + 测试面） |
| MI-A-7 | 新增 `agent start --protocol` flag（角色级档位） | L1-1 的解析链形态 | 若不做角色级档位，解析链退为 env > config > 内置 |

---

## §6 疑问 / 需主 agent 裁定（4 条，均不阻塞）

1. **新增配置键是否需要登记到 `oamp/API.md`**（如"配置"章节）？我的判断：`API.md` 只记 HTTP 接口面，配置面不在其列 ⇒ **零改动**（否则会触发 0016/0021 的文档漂移锁 D1/D2，成本陡增）。若认为需登记，属阶段 5 文档面。
2. **过程块是否需要在 `web/style.css` 增样式**：`web/app.js` **必改**（B-5，已入变更点清单），样式是否随之新增取决于实现形态（可用既有 class 组合表达）⇒ 登记为"实现阶段确认"，**不在架构面扩大改动面**。
3. **是否把 §3.3 的三条零侵入判据固化为测试**（`grep` 类断言）：**建议固化**（否则 D-2/D-3 只能人工复核）。它是"新增测试"而非"改既有测试"，A5 只定后者 ⇒ 本文件只登记建议（§9.4 B-16），由阶段 5 决定。
4. **未发现功能规格与技术约束之间的根本冲突**：13 张卡的验收标准在实测后**全部可实现**（R3 的"待实测"已转为"已实测且支持假设"）⇒ 无需修改任何产品维度，也未触发"停下来报告矛盾"。

---

## §7 交付物与越界声明

### 7.1 本轮落盘（均为 `<工作区地址>` 下的绝对路径）

| 产物 | 说明 |
|---|---|
| `docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md` | v0.1.0，786 行：§0 状态 / §1 现状基线（G1~G10 + 可复用原语 + §1.5 D-2 基线）/ **§2 M7 实测（M-1~M-5 + M-2b）** / §3 目标架构（组件图 + 模块布局 + 4 条数据流）/ §4 决策（L1×2 待确认 + L2×13）/ §5 接口契约（§5.1~§5.7）/ §6 卡↔路径（13/13）/ §7 T-01~T-11（11/11）/ §8 自查 C1~C16 / §9 必然变更点 / §10 奥卡姆表 / §11 风险（R1~R7 + N-1~N-6）/ §12 越界与疑问 / §13 未越界声明 |
| `docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F01~F13*.md` | **仅**「架构待填」段回填（T-01~T-11 覆盖：T-01×3、T-02×1、T-03×2、T-04×4、T-05×1、T-06×1、T-07×1、T-08×1、T-09×2、T-10×1、T-11×2；F10~F13 为**保证项**，结论写为"架构面零改动"）；每卡加了回填说明行（阶段 2 的「越界自查」作为历史记录保留不动） |
| `docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/2026-09-14-architect-round1.md` | 本记录 |
| `docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/probes/**` | 6 个探针脚本（`probe-m1/m2/m2b/m3/m4/m5*.mjs`）+ 6 份原始输出（`m1~m5、m2b-output.txt`），均可原样复跑 |

### 7.2 越界声明

- **未修改** `demand.md` / `prd.md` / `status.md` / `history.md` 及 `clarifications/` 下既有文件；**未触碰**任何功能卡的产品维度（功能 ID / 用户价值 / 验收标准 / 边界）。
- **未修改**任何产品代码（`oamp/**` 全程只读；本阶段零代码提交）；**未运行**测试套件 / 构建 / 格式化（唯一运行物 = 探针脚本）；**未执行**任何 git 写命令。
- **未写入** `docs/iterations/0021-*/**`、`docs/iterations/0011-*/**`、`docs/multi-omp-agent-protocol.md`（仅只读参考体例与既有口径）。
- **L1 决策未实施**：§3 的两条 L1 只列出方案、备选与否决理由，**等主 agent 确认**；本阶段不进入任何实现。
- **明确不属本阶段**（角色边界）：工程任务拆解（阶段 4）、代码实现（阶段 5）、独立验证（阶段 6）。
