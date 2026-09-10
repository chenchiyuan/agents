# architecture.md — 0011-chat-context-protocol（迭代架构）

**版本**：0.3.0（阶段 3 产物，由 0.2.0 方案稿升级）　**日期**：2026-09-10　**状态**：**L1 全部已确认**（L1-1~L1-5 用户决策 2026-09-10；L1-6 用户选择 (a) 2026-09-10）；§19 疑问 2~6 已由主 agent 裁定（见 §19 裁决记录）
**输入**：`prd.md` + `prd/F01~F08`（8 卡 + AR-01~AR-16）、`demand.md`（C/N/E 条款 + D-1~D-4 + V-1~V-5）、现有代码库 `oamp/`（阶段 3 重新取证，见 §1）
**前置**：迭代 0010 `oamp/`（Router/agent/web 已落地，64/64 测试）；本方案为其演进，**分支从 0010 拉出**（`iteration/0011-chat-context-protocol`）。
**v0.2.0 → v0.3.0 变更**：保留 0.2.0 全部已确认设计（数据库 schema / 上下文键与管理 / 协议抽象接口 / 用户四点反馈）；新增 §1 现状取证、§2 技术实测 V-6~V-12、§4.5~§4.7 查询与落盘细则、§5 事件模型与推送链（**去掉轮询**）、§6 上下文池细则、§7 模型解析、§8 配置面、§9 执行器路由与影响面、§11 功能卡映射、§12 AR 对照、§13 决策分级、§14 奥卡姆检验、§15 L1 清单、§16 实施边界（阶段 4 依据）。

---

## 0. 一句话架构

> web 负责"落盘与推送"（SQLite + 可替换协议层），agent 负责"上下文"（per-chat 常驻 omp acp 进程池），Router 继续负责"路由与运行态"。

---

## 1. 现有架构基线（阶段 3 取证，2026-09-10）

### 1.1 现有组件与文件（迭代 0010 交付）

| 文件 | 现状职责 | 与本次迭代的关系 |
|---|---|---|
| `src/router.js` | UDS JSON-RPC 服务：注册表 / 租约 / 任务表 / 消息投递与 ack | **不改**（除删除 `router.chat_*` 三个 case，见 §9.3） |
| `src/registry.js` | 内存注册表：节点、任务表、pending 投递、**会话表（chats）** | 删除会话表（chat 真源迁 SQLite） |
| `src/node-client.js` | 通用节点客户端：register/heartbeat/send/ack + `onDeliver` 钩子 | **不改**（web 复用其 `onDeliver` 接增量推送） |
| `src/rpc.js` | JSON-RPC 帧与错误码 | 不改 |
| `src/agent.js` | agent 生命周期 + 任务执行器（shell / `executor:'omp'` 一次性） | 扩展：新增 `omp-daemon` 执行器与 `notice` 处理 |
| `src/web.js` | Web 控制台：静态页 + 4 个 JSON API（chats 走 Router 内存） | 改造：读 SQLite、SSE 端点、chat 关闭、payload 构造 |
| `src/config.js` | env 覆盖 + 默认值（叶子模块，零依赖） | 扩展：JSON 配置文件 + 数据/模型/容量键 |
| `web/{index.html,app.js,style.css}` | 原生 JS 前端：1.5s 轮询、@ 补全、`!` 命令、消息列表 | 改造：SSE 订阅、关闭/模型/一次性交互 |
| `src/{task,status,cli,log}.js`、`scripts/`、`bin/` | CLI 与运行态工具 | 不改 |
| `test/*.test.js`（16 个 = 0010 既有 11 个（含 web.test.js）+ 本迭代新增 5 个（config-file/persist/transport/context-pool/acp-daemon））+ `test/helpers/harness.js` | 64 个用例；fake 二进制注入模式（`OAMP_OMP_BIN`） | 仅 `web.test.js` 按新契约重写（见 §9.3） |

### 1.2 可直接复用的既有能力（决定了本方案"少造东西"）

| # | 既有能力（代码位置） | 本次如何复用 |
|---|---|---|
| A | `task.update` / `task.result` 由 Router **先记任务表、再尽力投递给发起者**（`router.js` message.send 分支） | **web 就是发起者（origin）** → 过程增量天然被推送到 web，**不需要轮询 Router**（推翻 v0.2.0 §4 的 500ms 轮询设计） |
| B | `task.request` 的 `task_id` **可由发送方指定**（`router.js`：`m.task_id !== undefined ? … : 生成`） | web 预生成 `task_id` 并与输入记录一并落盘 → 输入↔输出↔任务的关联不依赖时序 |
| C | `message.send` 信封类型白名单已含 **`notice`**（现无任何使用方），且非 `task.*` 类型走泛型投递（**不入任务表**） | 上下文释放 / 重置提示复用 `notice` 类型 → **Router 零改动**、不污染任务表、不写库 |
| D | `NodeClient.onDeliver` 钩子（默认自动 ack accepted） | web / agent 各自挂钩子接管 `task.update`/`task.result`/`notice` |
| E | `executor` 路由 + payload 校验骨架（`agent.js: parseTaskBody`） | 新增 `omp-daemon` 分支，shell / `omp` 分支原样保留（F08-1） |
| F | `OAMP_OMP_BIN` 注入点（`omp-executor.test.js` 既有模式） | ACP 路径同法注入 **fake ACP server**，测试不依赖真实 LLM |

### 1.3 既有缺口（本次要补的，正好是 8 卡的来源）

1. **无持久化**：Router 会话表全内存 → 重启即丢（F02/F03/E-3）。
2. **无推送**：前端 1.5s 轮询 + 过程与结果混在同一条任务明细里 → 过程与终态不可分（F04/E-4/N-1）。
3. **无上下文**：每次 `omp -p --no-session` 新起（`agent.js: runOmpTask`）——**正是 demand 明列的反例**（F05/E-1/E-2）。
4. **无配置面**：只有 env（`config.js`）→ 数据落点不可配（F07）。

---

## 2. 阶段 3 技术实测（本机，2026-09-10，新增 V-6~V-12）

| # | 结论 | 证据（可复现命令要点） |
|---|---|---|
| V-6 | **ACP 的模型是 session 级配置项**：`session/new` 返回 `configOptions`（含 `id:'model'` 的 select，本机 63 项 + `currentValue`）；`session/set_config_option {sessionId, configId:'model', value}` 可切换并回传新 `configOptions`；`session/set_model` **不存在**（`Unknown ACP ext method`） | `omp acp --no-skills --no-rules` → initialize(372ms) → session/new(82ms) |
| V-7 | **未知模型可在 prompt 前明确失败**：`session/set_config_option(…'openai/does-not-exist')` → JSON-RPC error `-32603 / Unknown ACP model: openai/does-not-exist` | 同上，无需发起 prompt |
| V-9 | ⚠️ **默认模型 `openai/gpt-5.6-luna` 在本机间歇性无响应，且与 ACP 无关**：① ACP（带 `--thinking off`）连续 3 轮 → 1 成（11.4s）/ 2 挂起（40s 超时）；② 同模型一次性路径 `omp -p`，同一时段连续 3 次 → **3 次均 60s 超时**，而更早一次同命令 4.1s 成功；③ 对照组 `deepseek/deepseek-v4-flash` 经 ACP 稳定（1.2s / 887ms / 1.7s，多次成功）。该模型 provider 组为 `openai`、`api: openai-responses`、`reasoning: true`，baseUrl 指向第三方 relay | 结论：**上游 provider 可用性问题，不是 ACP 路径缺陷** → 见 R-9 / L1-6；**不据此把 `--thinking off` 纳入固定参数**（单次成功不足以归因，代价是永久关闭思考链） |

| V-10 | `node:sqlite`（DatabaseSync）在 Node v22.15 **无需 CLI flag**，仅 `ExperimentalWarning` | `node -e "new (require('node:sqlite').DatabaseSync)(':memory:')"` |
| V-11 | `--no-skills --no-rules` 后初始化通知仅 **1 条 `session/update`（≈6.7KB）**（未精简时为 skills 列表洪泛）→ 初始化等待可退化为"静默窗口 + 硬上限" | 与 V-5 呼应；保留精简参数，仍保留等待逻辑 |
| V-12 | **daemon 参数集整体可用**：`omp acp --no-skills --no-rules --no-tools --no-session` + `session/new` + `session/prompt` → 979ms 返回 "ok"（`stopReason: end_turn`）；`--no-session` **不破坏** ACP 行为 | 关闭原「`--no-session` 实施检查项」；daemon 参数集确定为 §6.6 所列五项 |

> V-1（同进程多轮记忆）、V-2（默认模型可用，一次性路径）、V-3/V-4/V-5 见 `demand.md`，结论不变。
> **V-6/V-8 直接改写了 v0.2.0 的模型设计**：模型不再绑定在进程启动参数上、也不需要"换模型即重建上下文"（见 §7）；**V-9 修正了草拟期的一次错误归因**（曾判为"reasoning 模型经 ACP 挂起，需 `--thinking off`"）：两条路径同一时段同现象 → 归因给上游 relay，`--thinking off` 既非必需、也不应默认开启。

---

## 3. 总体架构

### 3.1 进程与组件图（●=新增　◐=改造　○=不变　✖=删除）

```
浏览器 ●SSE 订阅 + ○JSON API + ◐交互（关闭/模型/一次性）
   │  HTTP（127.0.0.1，无鉴权 = 0010 N4/N6 边界）
   ▼
web 服务（oamp web）◐
   ├─ ●src/persist.js       SQLite 持久层（chats/messages：仅输入输出）
   ├─ ●src/transport.js     传输抽象（Transport 接口 + SSE 实现；预留 WS 替换点）
   ├─ ◐src/config.js        配置文件 + env + 默认值
   ├─ ◐HTTP 路由            /api/chats[/:id]、/api/messages、/api/stream、/api/chats/:id/close
   └─ ○NodeClient/RpcPeer ──UDS──▶ Router ○（注册表 + 租约 + 任务表 + 投递）
                                      │  task.update / task.result 推给 origin(web)
                                      │  notice（泛型投递，不入任务表）
                                      ▼
                            agent 进程（dev-1 / verify-1…）◐
                              ├─ ●src/context-pool.js  per-chat 常驻上下文池（LRU + 串行队列）
                              ├─ ●src/acp-client.js    omp acp 的 stdio JSON-RPC 客户端
                              ├─ ◐执行器路由：omp-daemon（新默认）| omp（一次性，保留）| shell（保留）
                              └─ ○心跳/生命周期（0010 不变）
```

### 3.2 模块布局

| 模块 | 状态 | 职责一句话 |
|---|---|---|
| `src/persist.js` | 新增 | chat/message 的建库、写入、查询（唯一 SQL 出口） |
| `src/transport.js` | 新增 | 面向浏览器的推送抽象 + SSE 实现（订阅集合、事件序列化、心跳） |
| `src/context-pool.js` | 新增 | `chat_id → ContextSession`（进程 + ACP session）：串行队列、模型切换、上限淘汰、释放 |
| `src/acp-client.js` | 新增 | 一个 `omp acp` 子进程的协议封装：initialize / session/new / set_config_option / prompt 流式 / cancel |
| `src/web.js` | 改造 | HTTP 入口：读库 API、SSE 端点、关闭动作、payload 构造、`onDeliver` 接增量 |
| `src/agent.js` | 改造 | 新增 `omp-daemon` 执行器分支与 `notice`（上下文释放）处理 |
| `src/config.js` | 改造 | 加 JSON 配置文件层（数据位置 / 默认模型 / 上下文上限） |
| `web/app.js` · `index.html` · `style.css` | 改造 | SSE 渲染、关闭交互、模型输入、一次性开关 |
| `src/router.js` · `registry.js` | 改造（仅删除） | 删除 `chat_message/chat_get/chat_list` 与内存会话表（§9.3） |
| `src/{rpc,node-client,task,status,cli,log}.js`、`bin/`、`scripts/`、`package.json` | 不变 | 零新第三方依赖（`dependencies` 保持 `{}`） |

---

## 4. 持久化（落地 AR-04 / AR-05）

### 4.1 存储结构（v0.2.0 保留，两处修订）

```sql
CREATE TABLE IF NOT EXISTS chats (
  chat_id     TEXT PRIMARY KEY,          -- 'chat-<uuid v4>'（AR-01）
  title       TEXT NOT NULL,             -- 首条输入截断（AR-02）
  agent_id    TEXT,                      -- 该 chat 的默认 agent（首轮派发目标）
  state       TEXT NOT NULL,             -- working | completed | failed | closed（AR-01）
  created_at  INTEGER NOT NULL,          -- ms epoch（AR-01）
  updated_at  INTEGER NOT NULL,          -- 新增输入/输出、关闭时前移
  closed_at   INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     TEXT NOT NULL REFERENCES chats(chat_id),
  direction   TEXT NOT NULL,             -- 'in'（A 的输入）| 'out'（B 的输出）——仅此两类（E-5）
  agent_id    TEXT,                      -- 该条消息归属的 agent（AR-07 相关性判定）
  text        TEXT NOT NULL,             -- 输入原文 / 输出最终文本；失败轮次 = 可见错误摘要
  model       TEXT,                      -- 输出记录实际生效的模型标识（AR-13 审计）
  duration_ms INTEGER,
  error       TEXT,                      -- 失败机器码：model_unavailable / timeout / context_crashed / …
  created_at  INTEGER NOT NULL,
  meta        TEXT                       -- JSON：task_id / context_id / pid / state
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
```

**相对 v0.2.0 的两处修订**：
1. `state` 初值去掉 `idle`——chat 的创建与首条输入同一步发生（POST 内），`idle` 永远不可观察；状态集合恰好是 F01-3 要求的四态。
2. 增加 `idx_chats_updated`（F03-2 默认排序 + 分页的支撑）。

### 4.2 建库路径与"初始为空"（AR-04）

- 打开时机：web 启动时（`loadConfig()` 之后、监听端口之前）打开数据库文件；打不开 → 打错误并退出非 0（不静默降级）。
- 路径解析（AR-14）：`OAMP_DB` env > `config.json: data.db` > 默认 `data/sql.db`（相对**包根** `oamp/`）。
- 目录不存在 → `fs.mkdirSync(path.dirname(db), { recursive: true })`（`data/` 被 gitignore，首次运行必然不存在）。
- 建表：幂等 `CREATE TABLE/INDEX IF NOT EXISTS` + `PRAGMA foreign_keys = ON`（否则 schema 里的 REFERENCES 静默失效）。
- **不引入迁移版本表**：本迭代无迁移（N-5 空库启动），需要迁移时再加（YAGNI）。
- 单写入者：只有 web 进程持有连接（agent 不碰库）；不开 WAL、不加锁调优。

### 4.3 落盘时机（AR-05，精确到调用点）

| 场景 | 何时写 | 写什么 | chat 状态 |
|---|---|---|---|
| 输入 | `POST /api/messages` 中，**校验通过后、派发之前**（同步 await） | 1 条 `direction='in'`（text=原文；`meta={task_id}` 用 web 预生成的 task_id；chat 行不存在时由 `insertInput` 内部防御性建行） | → `working`，`updated_at=now` |
| 输出（成功） | web 收到 `task.result` 且 `state!=='failed'` 时 | 1 条 `direction='out'`（text=最终答复；model / duration_ms / meta） | → `completed`，`updated_at=now` |
| 输出（B 失败） | web 收到 `task.result{state:'failed'}` 时 | **1 条 `direction='out'`**：text=可见错误摘要，`error`=机器码，`model` 照记 | → `failed` |
| 派发失败 | `message.send` 抛错（目标离线/UNREGISTERED）时 | **1 条 `direction='out'`**：text=`派发失败：<原因>`，`error='dispatch_failed'` | → `failed` |
| 进程中断 | web 启动时扫尾：`UPDATE chats SET state='failed' WHERE state='working'`（本次启动前的遗留 `working`） | 不补记录（该轮输出确实缺失，状态已如实反映） | `working` → `failed` |
| 过程 | **永不**（chunk / 工具中间态 / 心跳 / 日志一律不入库） | — | — |

- 状态写入统一带哨兵：`UPDATE chats SET state=?, updated_at=? WHERE chat_id=? AND state!='closed'` —— `closed` 是终态，不会被迟到结果覆盖（§4.7）。
- 每条写库后触发一次 SSE 事件（`message` / `chat_state`）。
- **chat 行的唯一创建者 = `insertInput` 的防御性建行**（`persist.js` 的 `ensureChat`：`INSERT … ON CONFLICT(chat_id) DO NOTHING`，title 取输入前 40 字符）——输入先落盘（F02-3）不因缺 chat 行失败；**`upsertChat` 是导出面里唯一会 `DO UPDATE` 改写 title/agent_id 的函数，约定只用于新建 chat、不得用于改标题**（AR-02「后续输入不改标题」由 `ensureChat` 的 `DO NOTHING` 保证）。
- **校验错误的层级**：`limit` / `state` / `from>to` 等非法参数由 **`persist` 层直接抛 JS `Error`**（不返回错误码），**HTTP 400 由 web 层映射**；请求体本身畸形 JSON → **400**、请求体 > 64KB → **413**（附 `connection: close`），三者同属 web 层错误面（§4.5）。
- **派发登记时序与终态对账**（pr-006 修复 + pr-007 对账，实现定稿）：web 在 `sendTask` **之前**登记 `task_id → {chatId, agentId, lines, landed, attempts, slow, registeredAt, timer}`——agent 的首个 `task.update` 可能与 `send` 响应落在同一 socket read，登记晚于 await 会丢弃首片（终态落盘不受影响，仅实时增量少首片）；派发失败分支定向 `tasks.delete(taskId)` 清理登记。
  **登记同时是"投递认领 + 对账兜底"的凭据**：`task.result` 的投递可能丢失（发起者离线窗口 / 投递竞态），而 Router 任务表是权威运行态 → web 定时 `router.task_get` 对账补落该轮 `out`（首查/快速间隔 5s，6 次用尽**转 30s 低频续查**，登记软 TTL 30min 到期清理并 warn）；**登记只在三处删除**——落库（`landed`）、软 TTL 到期、SIGINT 关闭（退出时清全部对账定时器）——转低频后仍保留登记，使晚到的终态投递仍能被认领；幂等由 `landed` 的同步检查+置位保证（投递路径与对账路径竞争时**恰一条 `out`**）。

### 4.4 失败轮次的记录形态（裁决 F02-4、prd 疑问 5）

**落一条 `direction='out'` 记录**（不是"只有输入"），理由三条：
1. F02-1「一次提问产生恰好两条记录」要求输入与输出一一对应；失败轮若无 out 记录，输入成悬空记录，UI 必须靠额外规则推断"这轮废了"。
2. F01-3 的「失败」态需要与具体轮次关联，`error` 字段才有归属。
3. 仍是 out 类目，**不违反** F02-5「仅两类记录」（类目数不变，只是该条内容为错误摘要）。
- text 写**人可见的摘要**（如 `模型不可用：openai/xxx`），机器码写在 `error`（如 `model_unavailable`）→ 前端按 `error` 渲染状态角标、按 `text` 直出。

### 4.5 查询接口与返回结构（AR-06）

| 接口 | 入参 | 出参 |
|---|---|---|
| `GET /api/chats` | `q`、`agent`、`state`、`from`、`to`、`limit`（默认 50，上限 200）、`offset`（默认 0） | `{ chats:[{chat_id,title,agent_id,state,created_at,updated_at,message_count}], total, limit, offset }` |
| `GET /api/chats/:id` | — | `{ chat:{…}, messages:[{id,direction,agent_id,text,model,duration_ms,error,created_at,meta}] }`（**升序**：`created_at ASC, id ASC`） |
| `POST /api/chats/:id/close` | — | `{ chat_id, state:'closed' }`（幂等：已关闭再关仍返回 closed） |
| `POST /api/messages` | `{chat_id?, agent_id, text, model?, one_shot?}` | `{ chat_id, task_id, message_id?, warning? }`；chat 已关闭 → **409**、缺 agent/空文本/model 非法 → **400**、畸形 JSON → **400**、请求体 > 64KB → **413**（附 `connection: close`） |

- **默认排序**（M-04）：`ORDER BY updated_at DESC, chat_id DESC`（第二键保证同毫秒稳定分页）。
- **分页**：`limit` + `offset`（不做游标——数据量为个人本地使用，offset 足够且实现最短）；`limit` 非法（非正整数 / >200）→ 400。
- **不再提供** v0.2.0 设想的 `GET /api/search`：F03 的"关键词过滤"由 `GET /api/chats?q=` 完全覆盖，独立检索端点无卡要求（奥卡姆，删除）。
- **错误面的分层（实现为准）**：参数校验在 `persist` 层抛 `Error` → web 映射 **400**；请求体解析 / 尺寸错误在 `readBody` 内直接给出 **400 / 413**（`err.status` 透传；413 追加 `connection: close` 并停止缓冲）——`persist` 不返回错误码，web 不猜错误语义。

### 4.6 时间过滤与关键词匹配（AR-07）

| 项 | 规则 |
|---|---|
| 时间精度 | 毫秒（INTEGER，与 `Date.now()` 一致） |
| 时间基准 | **`updated_at`**——与默认排序同基准（"最近活动过的对话"语义一致，避免"排序按 A、过滤按 B"的割裂） |
| 端点语义 | 闭区间：`updated_at >= from AND updated_at <= to`；`from`/`to` 任一缺省即不限；`from > to` → 400 |
| 关键词范围 | `chats.title LIKE :q` **OR** `EXISTS(SELECT 1 FROM messages WHERE chat_id=chats.chat_id AND text LIKE :q)`——对应 M-04 的"标题 + 输入/输出文本" |
| 大小写 | SQLite `LIKE` 对 ASCII 大小写不敏感（非 ASCII 大小写敏感，中文无大小写影响）——不额外引入 `lower()`/排序规则 |
| 通配符 | 用户输入中的 `\` `%` `_` 一律转义 + `LIKE ? ESCAPE '\'`（否则用户输入一个 `%` 会命中全部） |
| 已关闭 chat | **包含**（F03-1 明文：列表中包含已关闭 chat；过滤不额外排除） |
| 状态过滤 | `state` 必须是四态之一，非法 → 400（复用 `router.task_list` 的既有校验风格） |
| **agent 相关性判定** | `chats.agent_id = :agent` **OR** `EXISTS(messages.agent_id = :agent)`——即"该 chat 的默认 agent 是它，或它参与过该 chat 的某一轮"（F03-5 "相关"的落地依据；`messages.agent_id` 是唯一能表达"参与过"的字段） |
| 组合 | 全部条件 AND（F03-7） |

### 4.7 只落"两类"的工程保障（F02-5 / E-5）

- `persist.js` 是唯一 SQL 出口；**能写 `messages` 的函数只有两个**：`insertInput()` / `insertOutput()`，且 `direction` 由函数内部写死（不暴露参数）→ 结构上无法插入第三类 `messages`。同模块另导出 `upsertChat` / `closeChat` / `startupSweep`（连同 `listChats` / `getChat` / `close`），它们**只写 `chats` 状态**、不写 `messages`，因而不构成"第三类记录"的入口。
- 过程数据只经过 `transport.publish()`，不接触 `persist`（模块边界即约束）。
- 测试断言（E-5）：一次含 ≥3 段增量输出的问答后 `SELECT COUNT(*) FROM messages` 为 2，且 `SELECT DISTINCT direction` 恰好 `{in,out}`。

---

## 5. 实时展示与传输抽象（落地 AR-08 / AR-09 / AR-10）

### 5.1 Transport 接口（替换点）

```js
// src/transport.js —— 面向浏览器的推送抽象（本版 SSE；将来换 WS 时实现同一接口）
export function createSseTransport({ heartbeatMs = 15000 } = {}) {
  return {
    kind: 'sse',
    handle(req, res, { chatId }),  // 建立该 chat 的订阅（写 header、注册到订阅集合、发 retry 首帧/心跳）
    publish(chatId, event),        // event: { type, data }；无订阅者 → 直接丢弃（不缓存、不补发）
    close(chatId),                 // 移除该 chat 的全部订阅并结束其连接（避免 chat 关闭后浏览器挂着空闲 SSE）
    closeAll(),                    // 结束全部连接（进程退出 / 测试用）
  };
}
```
- **替换方式 = web.js 里一行构造**（`const transport = createSseTransport()`）。**不引入 `transport` 配置项**：只有一种实现时，配置项是纯负债（F04-6 只要求"换实现时外部行为不变"，不要求运行期可切换）。
- **冻结成员（F04-6 的替换契约）= `kind` / `handle` / `publish` / `close` / `closeAll`**——将来 WS 实现必须实现全部五个。`close(chatId)` 的语义 = "移除订阅 **+ 结束该 chat 的连接**"；**当前 web 侧未调用它**（chat 关闭只推 `chat_state`，连接由客户端/页面关闭释放），实现与单测已就位，供后续需要主动断开时使用。
- 未来 WS 实现同接口，前端订阅 URL 由 web 下发（`GET /api/config` 或在 index.html 注入），届时再定。

### 5.2 事件模型（AR-08）

| 事件名 | data 负载 | 触发点 |
|---|---|---|
| `message` | `{ chat_id, message:{id,direction,agent_id,text,model,duration_ms,error,created_at} }` | 输入/输出落盘后（一次问答恰好 2 次） |
| `task_update` | `{ chat_id, task_id, kind:'chunk'|'stdout'|'stderr', text?, line? }` | agent 过程增量到达 web 时（**不入库**） |
| `chat_state` | `{ chat_id, state }` | `working/completed/failed/closed` 变更 |
| `notice` | `{ chat_id, kind:'context_released'\|'context_reset', text }` | agent 上下文事件（**SSE 侧** kind：`context_released` = chat 关闭释放、`context_reset` = 崩溃/超时/容量淘汰；**不入库**，F05-7） |

- **命名区分（勿混用）**：web → agent 的**控制消息** kind = `context_release`（语义"请释放该 chat 的上下文"，§6.4）；**SSE 事件** kind = `context_released`（语义"已释放"，给用户看，§6.3）；崩溃 / 超时 / 淘汰 = `context_reset`。三者分别属于「控制请求 / 已被动释放的用户提示 / 重置提示」，不共用一个 token。

- 端点：`GET /api/stream?chat_id=<id>`（`text/event-stream`；必须带 `chat_id`，不做全局订阅——无卡要求）。
- 响应头（实现为准）：`content-type: text/event-stream; charset=utf-8`、`cache-control: no-store`、`connection: keep-alive`。
- 保活与重连：**`retry: 1000` 是事件流首帧**（SSE 规范字段，不在 HTTP 响应头里）；每 15s 写一条注释帧 `: keepalive\n\n`（注释行 + 空行终止）。
- 顺序：单连接 FIFO 写（Node http 的顺序语义）保证 F04-4「多轮不失序」；不引入 `seq` 字段（无消费方）。
- 序列化：`event: <type>\ndata: <json>\n\n`。

### 5.3 过程增量来源与推送时效（AR-09）

**推送链（无轮询、无 sleep）**：
```
omp acp --(session/update.agent_message_chunk)--> acp-client（拼接 + 立即回调）
   --> pool 回调 --> agent: message.send type=task.update（一次 chunk 一条）
   --> Router（记任务表 + deliver 给 origin=web）
   --> web.onDeliver --> transport.publish(chat_id,'task_update')
   --> 浏览器 EventSource 追加渲染（增量可见）
```
- **推翻 v0.2.0 的"web 轮询 Router 500ms"**：由 §1.2-A 的既有投递语义，进程增量是**真推送**，端到端只多两跳本机 IPC。
- 时延预算：同机 UDS + 本地 HTTP → 单 chunk 端到端 **≤ 200ms**（实测参考：`task.update` 投递路径在既有 64 例中为毫秒级；无轮询间隔、无缓冲等待）。
- **E-4 判定落地**：SSE 客户端在收到该轮的 `message`（out）事件**之前**，必须已收到 **≥2 个 `task_update`**，且其间文本长度**递增**（"终态到达前内容已增长"）。
- 前端渲染：输出气泡在首个 `task_update` 出现时创建（占位），后续 chunk 追加；收到 `message`(out) 时以落盘文本为准替换（去抖，避免流式拼接与最终文本不一致）。
- 过程增量不做节流（问答场景 chunk 量级为十~百）；若实测刷屏，实施期再加 50ms 合帧（记为实施检查项，不预先设计）。
- web 侧只把带 `kind` 的条目上推为 `task_update`（`started` / `truncated` 等非过程增量条目不上推）；未知 `task_id` 的 `task.update` / `task.result` 静默丢弃（见 §10.4）。

### 5.4 断线重连与兜底（AR-10）

| 场景 | 处理 |
|---|---|
| SSE 连接断开 | 浏览器 `EventSource` 自动重连（服务端 `retry: 1000`） |
| 重连 / 刷新 | 前端在 `onopen` 与页面加载时**全量拉取 `GET /api/chats/:id`** → 已落盘的输入/输出完整呈现（F04-7「不因断线导致内容缺失」） |
| 断线期间的过程增量 | **不补发**（F04 边界明文：不承诺补发断线期间的增量）；该轮终态仍会以 `message` 事件或刷新后的全量拉取补齐 |
| 服务端无订阅者 | `publish` 直接丢弃（不缓存） |
| 连接关闭 | `res.on('close')` → 从订阅集合移除（防泄漏） |

---

## 6. 上下文池与 ACP 客户端（落地 AR-11 / AR-12 / AR-16）

### 6.1 键、落地形态与实例标识（AR-11）

| 维度 | 规则 |
|---|---|
| 键 | `(chat_id, agent_id)` → 一个 **ContextSession** = 1 个常驻 `omp acp` 子进程 + 1 个 ACP `sessionId`（agent_id 由进程身份隐含，池只按 `chat_id` 索引） |
| 创建 | 该 chat 首次调用时懒创建：`spawn omp acp --no-skills --no-rules --no-tools --no-session --model <解析后模型>`（§6.6 初始化等待） |
| 复用 | 同键后续轮次复用同进程 + 同 ACP session（`session/prompt` 多轮，上下文累积——V-1） |
| 隔离 | 新 chat → 新键 → 新进程（V-1/V-8 证明上下文只随进程+session 存活） |
| **实例标识（F05-2 判据）** | `context_id = 'ctx-' + <pid> + '-' + <generation>`（generation = 本 agent 进程内的创建序号）；`pid` 同时单独上报。二者随每轮 `task.result` 回到 web，写入该条 out 记录的 `meta` —— **两轮 `meta.context_id` 与 `meta.pid` 相等**即判定复用同一实例（同时满足 E-1 后半的"pid 复用"字面判定） |
| 模型与上下文 | 模型是 **ACP session 级设置**（V-6），切换模型**不重建进程、不清空上下文**（V-8 实测：切走再切回，仍记得 42）→ F05-1 与 F06-2/3 可同时成立 |

### 6.2 同键串行 / 异键并发（AR-11）

- 每键一个 FIFO 队列：**同一时刻至多 1 个 in-flight prompt**（ACP session 本身不支持并发 prompt）；后续轮次排队依次执行。
- **队列上限 8 = 等待队列长度**（实现口径，`context-pool.js` `QUEUE_LIMIT`）：同键同时最多 **1 个在飞 + 8 个排队**（合计 ≤9 个未完成轮次），第 10 个立即以 `context_busy` 失败（chat 状态 failed + out 记录），不做无界堆积（防"连点 100 次"内存膨胀）。
- 不同键之间完全并发（各自独立进程），池不做全局串行。
- 排队时长不设额外超时：入队轮次的 `timeout_ms` 从**实际开始执行**时计时（用户看到的是"处理中"）。

### 6.3 上限、淘汰与用户可见提示（AR-11、F05-7）

- 全局上限 `OAMP_CTX_MAX`（默认 8，配置键 `context.max`）：超过则 **LRU 淘汰最久未使用**的 ContextSession（kill 子进程，其上下文随之丢弃）。**LRU 触碰点 = `getOrCreate`**（每轮 agent 先取/建会话再 prompt，真实链路上"最近使用"语义成立）；直接持有 session 反复 `prompt()` 不会刷新淘汰序（当前无此调用方，实现与文档均已记录）。
- **不主动 TTL 回收**（用户决策 2026-09-10）：进程存活至 chat 关闭或超上限。
- 提示形态（**关键裁决**）：淘汰 / 崩溃后，agent 向 web 发一条 `notice`（`kind:'context_reset'`），web 转成 SSE `notice` 事件，前端在对话流内插一条**系统提示条**（"上下文已释放 / 已重置，本对话后续回复不再记得此前内容"）。
  **该提示不入库**——F02-5/E-5 明令"仅两类记录"，若落成消息行会直接违反 E-5；F05-7 只要求"对话内明确提示"，运行时事件满足语义。
- 提示触发点只有两个：`context_reset`（崩溃 / 超时重建 / 容量淘汰）、`context_released`（chat 关闭导致的释放）。不静默丢失。**注意**：这里的 `context_released` 是 **SSE 侧**（给用户看的提示 kind）；触发它的 **web → agent 控制消息** kind 是 `context_release`（§6.4），两者不可混用。

### 6.4 释放时机与重启边界（AR-12）

| 事件 | 上下文处理 | 依据 |
|---|---|---|
| chat 关闭 | web 查该 chat 出现过的 `DISTINCT agent_id`，向每个 agent 发 `notice{kind:'context_release', chat_id}`（best-effort，失败忽略）→ agent kill 该 chat 的进程并移除键 | F01-5 + F05 AR |
| chat 已关闭后再提问 | **拒绝**：`POST /api/messages` 返回 409 + 提示；因此不存在"重开后上下文从哪来"的问题（F01 边界：不做重开语义） | F01-5、AR-03 |
| 关闭时该 chat 正在处理 | 立即释放（kill）；在飞轮次走 §6.5 崩溃路径收尾，错误码沿用 `context_crashed`（**不另立 `context_released` 错误码**，避免与提示 kind 混淆），web 落一条失败 out 记录；chat 状态仍为 `closed`（`state!='closed'` 哨兵） | §4.3 |
| **web 重启** | 上下文**不受影响**（上下文在 agent 进程里）；历史从 SQLite 读回；遗留 `working` 状态由启动扫尾置 `failed` | E-3 / F02-6 |
| **agent 重启** | 该 agent 的上下文**全部丢失**（池在内存）；后续轮次按新键创建 → 新 `context_id`/`pid`（可从 out 记录 meta 观察到变化）。**不做主动提示**：agent 重启后无从知道历史上服务过哪些 chat，主动提示需要持久化 chat 清单——超出 N-5/需求范围 | F05 边界（不承诺重启恢复） |
| agent SIGINT（优雅退出） | `pool.dispose()`：全部 kill；退出流程其余部分沿用 0010 | 0010 既有 |

### 6.5 崩溃、超时与取消

| 场景 | 处理 |
|---|---|
| ACP 子进程异常退出 | 在飞轮次 → `task.result{state:'failed', error:'context_crashed'}`；键移除；发 `notice{kind:'context_reset'}`；下轮重建 |
| prompt 超时（默认 300s，payload 可给 1~600000ms） | ① 发 `session/cancel` 通知 → ② 等 ≤2s 收 `stopReason` → ③ 仍未收尾则 kill 进程 + 移除键 + `notice{context_reset}`；轮次以 `error:'timeout'` 失败 |
| 上游无响应 / 长时间无 chunk（V-9） | 由上一条的超时路径兜底；**该轮消息已进入上下文**（实测），故超时也走 `context_reset` 提示，避免"以为重置了其实没重置"的认知错位 |
| 释放/关闭 | `SIGTERM` → 500ms 未退则 `SIGKILL`（沿用 0010 kill 模式） |

### 6.6 ACP 客户端细则（AR-16）

- 传输：子进程 stdio，**按行 JSON-RPC 2.0**（同 omp acp 实际帧格式：一行一条消息）。
 - 启动参数（daemon 固定）：`acp --no-skills --no-rules --no-tools --no-session [--model <model>]`
  - `--no-skills --no-rules`：V-11 实测把初始化通知从"skills 洪泛"压到 1 条；
  - `--no-tools`：本迭代 daemon 只做纯问答（工具模式走一次性路径，见 §9.1）；
  - `--no-session`：不产生未承诺的磁盘 session 产物（与 0010 一次性路径一致）；上下文真源 = 进程内存。（**实测 V-12**：该参数集下 `session/prompt` 979ms 正常返回，flag 安全。）
  - **不追加 `--thinking off`**：V-9 的两条路径对照表明挂起源于上游 provider 而非 ACP；关闭思考链是质量代价，不作为默认（`--thinking off` 仅作为诊断手段留档，见 §7.5 的对照复测步骤）。
- 初始化序列：`initialize{protocolVersion:1}` → `session/new{cwd: process.cwd(), mcpServers: []}` → **等待静默**（无通知 ≥300ms 或硬上限 5s）→ 首次 `session/prompt`。仅在建键时发生一次（R-4 冷启动 ~1-3s）。
- prompt：`session/prompt{sessionId, prompt:[{type:'text', text}]}`；增量取 `session/update.update.sessionUpdate==='agent_message_chunk'` 且 `content.type==='text'` 的文本，逐块回调；请求响应给出 `stopReason`。
- 模型：每轮解析出目标模型，若与当前 session 的 `currentValue` 不同 → `session/set_config_option{sessionId, configId:'model', value}`（失败即该轮 `model_unavailable`，**不回退默认**）。生效值从返回的 `configOptions` **数组**读取（`find(o => o.id === 'model')?.currentValue`；对象形态一并兼容——实测 omp 18.0.11 为数组形态）。
- 结果组装：`{text: 拼接文本, model: 生效模型, stop_reason, usage?, context_id, pid}`。
- 容量/内存实测：上线前量单进程内存（R-1）。

---

## 7. 模型指定与默认（落地 AR-13）

### 7.1 优先级链（F06-2/3，用户决策 §9-3）

```
payload.model  >  OAMP_OMP_MODEL（env）  >  config.defaults.model（文件）  >  内置默认 'openai/gpt-5.6-luna'
```
- 解析在 **agent 侧**（真正生效点）；web 只做透传与展示（不在 web 侧二次解析，避免两处真源）。
- 每轮独立解析：未指定的轮次回到默认链（F06-2"指定不影响未指定轮次"）——因为模型是 session 级设置，**每轮显式比对并设置**即可，不存在"粘住上一轮指定"的问题。

### 7.2 传递形态

| 段 | 形态 |
|---|---|
| web → agent | `task.request` payload：`{executor:'omp-daemon', chat_id, prompt, model?}` |
| agent 内 | `parseTaskBody` 校验 → `pool.prompt(chatId, resolvedModel, prompt, …)` |
| agent → omp | 首轮随进程 `--model`；后续轮 `session/set_config_option`（V-6） |
| 校验 | `model` 必须为字符串且匹配 `^[A-Za-z0-9._\/-]{1,128}$`（不匹配 → 拒收/400，风格同 0010 payload 校验） |

### 7.3 不可用模型：判定与错误面（F06-4）

- 判定：`session/set_config_option` 返回 JSON-RPC error（V-7 实测 `Unknown ACP model: <x>`）；**不需要预置可用清单**。
- 错误面：该轮 `task.result{state:'failed', error:'model_unavailable', text:'模型不可用：<model>'}` → chat 状态 `failed` + 一条失败 out 记录（§4.4）。
- **绝不静默回退**默认模型（F06-4 的明文要求）。
- 澄清 F06-5「可用取值来源」：可用清单 = **omp 自身模型注册表**（`~/.omp`），本系统不解析、不复制；如需下拉清单，ACP `session/new` 返回的 `configOptions` **数组**中 `id === 'model'` 项的 `.options` 天然提供（本次实测 63 项；读取须按数组形态 `find`，见 §6.6），**本迭代不做清单接口/下拉**（无卡要求，奥卡姆）。

### 7.4 审计形态（F06-3 判定依据）

- 每条 out 记录的 `model` 字段 = 该轮**实际生效**的模型标识（agent 从 ACP session 返回的 `configOptions` 数组里 `id === 'model'` 的 `currentValue` 回读后上报，**不是用户输入的回显**）。**回读失败时该字段为 `null`**（不用请求参数顶替）——前端元信息行可能为空，属受控降级（可观测性增强见 §18 NC-1）。
- 前端在输出气泡元信息行显示该模型（与 `ctx` 标识同行），F06-3"两轮可观察到使用了不同模型"即由此判定。

### 7.5 ✅ 已确认（2026-09-10 用户选择 (a)）：默认模型可用性取舍（L1-6）

**事实（V-9，两条路径对照）**：用户确认的默认模型 `openai/gpt-5.6-luna`（provider 组 `openai`、`api: openai-responses`、`reasoning: true`、baseUrl 为第三方 relay）在本机**间歇性无响应**：
- ACP 路径（带 `--thinking off`）连续 3 轮：1 成功（11.4s）/ 2 挂起（40s 客户端超时，无任何 chunk）；
- 同一时段一次性路径 `omp -p` 连续 3 次：**3 次均 60s 超时**；而更早一次同命令 4.1s 成功——说明**不是 ACP 路径的缺陷**，而是上游可用性；
- 对照组 `deepseek/deepseek-v4-flash`（本机 ACP 默认模型）多次调用稳定：1.2s / 887ms / 1.7s。

**由此得出的设计结论（不是"加 `--thinking off`"）**：
1. **不把 `--thinking off` 纳入 daemon 固定参数**——它关闭思考链（质量代价），而证据显示挂起与它无关（两条路径同时段同现象）；它只保留为**诊断手段**。
2. **超时 + 取消 + 上下文重置提示是必需的兜底**（§6.5）——这是"不会永久空白等待"的唯一保障，不因模型选择而改变。
3. **L1-6 已定（2026-09-10，用户选择 (a)）**：内置默认**保持 `openai/gpt-5.6-luna`**（守 D-4；配置面 `defaults.model` / `OAMP_OMP_MODEL` 一行可覆盖）；保留**上线前复测门禁**（下方第 4 条对照复测），若复测仍高频挂起再由用户决定是否切到备选 (b)（`deepseek/deepseek-v4-flash` 作为"可指定"值已可用）。
4. **实施期对照复测步骤（归因判定，约 30 分钟）**：同一模型分别用 `omp -p` 与 `omp acp`（各 3 次、每次 ≤60s）跑同一 prompt，记录成功率与耗时；两条路径失败率相近 → 上游问题（按 (a) 处置）；ACP 显著更差 → 再评估 ACP 侧参数/版本，并重新评估 `--thinking off`。

---

## 8. 配置面（落地 AR-14）

### 8.1 文件、格式与键

- 路径：`oamp/config.json`（包根），`OAMP_CONFIG` env 可指向其它路径。
- 格式：JSON（`node:fs` 零依赖解析）；**只有三个键**：

```json
{
  "data":     { "db": "data/sql.db" },
  "defaults": { "model": "openai/gpt-5.6-luna" },
  "context":  { "max": 8 }
}
```
（键的组织：`data.db`→F07、`defaults.model`→F06、`context.max`→F05；无其它键，不预置未来项。）

### 8.2 优先级（逐键独立）

```
每个键：  环境变量  >  config.json  >  内置默认
  data.db        OAMP_DB        > config.data.db        > 'data/sql.db'
  defaults.model OAMP_OMP_MODEL > config.defaults.model > 'openai/gpt-5.6-luna'
  context.max    OAMP_CTX_MAX   > config.context.max    > 8
```

- **空值语义（实现为准，pr-001 D-2）**：**env 侧**的空串 / 纯空白视为"未提供"、继续向下一级取值（沿用既有 `env.X || 默认` 的"空即未设"风格——故 `OAMP_DB='  '` 会取文件值，而不是把包根当成库路径）；**配置文件侧**相反——键存在但不是非空字符串 → **直接快速失败**（`data.db` / `defaults.model` 均如此；`context.max` 存在但非正整数同样抛错），仅"键缺失"才回落默认。`OAMP_CONFIG` 自身亦按前者处理（空串 → 用默认路径）。
- **对账参数 env（pr-007 引入，仅 web 进程；配置文件无对应键，属运维/测试可调项）**：

  | env | 默认 | 语义 |
  |---|---|---|
  | `OAMP_WEB_RECONCILE_INTERVAL_MS` | `5000` | 任务对账**首查与间隔**同值（快速频率），快速预算 = 6 次 |
  | `OAMP_WEB_RECONCILE_SLOW_MS` | `30000` | 快速预算用尽后转入的**低频续查间隔**（持续到终态 / 软 TTL / shutdown） |
  | `OAMP_WEB_RECONCILE_TTL_MS` | `1800000`（30min） | 对账登记**软 TTL**：超时清理孤儿条目（一条 warn） |

  三者由 web 直接读取（`readPositiveMs`）：**缺省或非法值一律回退内置默认**——与 §8.3 配置文件"非法即失败"不同，它们是运行期兜底参数，不参与配置面 schema（故 §8.1 的"配置文件只有三个键"依旧成立）。

### 8.3 缺失与非法（F07-3 / F07-4）

| 情形 | 行为 |
|---|---|
| 文件不存在 | **正常启动**，全部用默认值（不告警退出） |
| 非法 JSON / 非对象 / 键类型错 / 键存在但为空串或纯空白 / `context.max` 非正整数 | **快速失败**：加载器抛错 → 进程入口打印 `OAMP 配置错误: <原因>` 并退出码 1（与既有 `readPositiveInt` 的失败风格一致，web.js 已有该 try/catch）；**env 侧的空串不属此列**（视为未提供，见 §8.2） |
| 未知键 | 忽略（不报错）——避免为"未来键"做 schema 校验 |
| 相对路径基准 | **包根 `oamp/`**（与既有 `config.js` 的 `PKG_ROOT` socket 推导同法，**与 cwd 无关**）→ 默认落 `oamp/data/sql.db` |
| 目录不存在 | 打开库前 `mkdir -p` |
| 生效时机 | 启动读取一次；**不做热重载**（F07 边界）→ 改配置 + 重启，新数据写新位置（F07-6） |

### 8.4 运行时产物与忽略规则（F07 架构维度 2）

- `oamp/data/` 加入 `.gitignore`（现有 `.gitignore` 只有 `.runtime/`，追加一行 `data/`）——沿用 0010 卫生红线。
- 产物落点：`oamp/data/sql.db`（含 SQLite 可能的 `-journal`/`-wal` 兄弟文件，随目录一并忽略）。

### 8.5 加载器形态（`src/config.js` 扩展，保持叶子模块）

```js
export function loadConfig(env = process.env) {
  const file = readConfigFile(env.OAMP_CONFIG || path.join(PKG_ROOT, 'config.json')); // 缺失→{}；非法→throw
  return {
    ...existing,                                            // socket/心跳/重连（不变）
    dbPath:     resolve(PKG_ROOT, env.OAMP_DB   ?? file.data?.db   ?? 'data/sql.db'),
    defaultModel:                env.OAMP_OMP_MODEL ?? file.defaults?.model ?? 'openai/gpt-5.6-luna',
    contextMax: readPositiveInt('OAMP_CTX_MAX', env) ?? file.context?.max ?? 8,
  };
}
```
（`config.js` 仍不 import `src/` 内任何模块；文件读取用 `node:fs` 同步 API——启动期一次，简单优于异步。）

---

## 9. 执行器路由与基线兼容（落地 AR-15）

### 9.1 执行路径路由表

| 用户动作 | payload | agent 分支 | 上下文 |
|---|---|---|---|
| 普通提问（默认） | `{executor:'omp-daemon', chat_id, prompt, model?}` | **新增**：上下文池 + ACP 多轮 | 累积（F05） |
| 勾选"一次性" | `{executor:'omp', prompt, model?}` | 保留：`omp -p --no-session --no-tools`（0010 原样） | 不累积，也不被复用（F08-1） |
| `!命令` 开头 | `{command:'/bin/sh', args:['-c', …]}` | 保留：shell 执行器（0010 原样） | 无上下文（F08-1） |

- 判定顺序（web 侧）：`!` 前缀 → shell；`one_shot:true` → `omp`；否则 → `omp-daemon`。
- **默认切换不破坏显式路径**：三条路径由 payload 的 `executor`/`command` 字段决定，互不干扰（F08-2"两种形态可区分"）。
- daemon 路径要求 `chat_id` 非空；缺失 → agent 拒收（ack rejected）→ web 收到派发失败并落失败 out 记录（§4.3）。
- `tools:true` 仅在 `executor:'omp'` 分支有效（daemon 固定 `--no-tools`）：避免本迭代处理 ACP 权限请求应答（F04 边界：工具/权限交互形态不在本卡）。

### 9.2 既有 web 交互保留（F08-4）

| 交互 | 处置 |
|---|---|
| `@agent` 补全（`/api/agents` 来自 Router status） | **不变**（路由与数据源都不动） |
| `@agent 文本` 服务端兜底解析 | 不变（web.js 既有正则保留） |
| `!` 开头命令式提交 | 不变（仍是 shell 执行器） |
| 消息/详情展示样式 | 保留 0010 视觉（左列表/右详情/时间分组）；**新增**最小控件：关闭按钮、模型输入框、一次性开关、系统提示条 |
| `/api/agents` 与 `@` 补全的取值面 | **行为变更（已记录，不修）**：web 现在以 `web` 身份常驻注册（`SENDER_ID='web'`，为经 `NodeClient.onDeliver` 收 agent 回传所必需）→ `GET /api/agents` 返回集合含 `web` 自身，前端"N agents online"计数与 `@` 补全列表都会出现 `web`（对 `@web` 的派发会被 Router 受理但无人执行，该 chat 停在 `working` 直至启动扫尾）。属 0010→0011 的连带效果而非代码回归，是否过滤自身留待后续迭代（§18 NC-5） |
| 1.5s 轮询 | **移除**，改 SSE（F04-2 要求流式可见；轮询无法满足"终态前可见增量"的判定） |

### 9.3 改造影响面盘点（阶段 4 PR 规划依据）

**新增**
- `src/persist.js`、`src/transport.js`（web 侧）；`src/context-pool.js`、`src/acp-client.js`（agent 侧）
- 测试：`test/persist.test.js`、`test/transport.test.js`、`test/context-pool.test.js`、`test/acp-daemon.test.js`（端到端）、`test/config-file.test.js`

**改造**
- `src/web.js`：路由重写（chats 读库、`/api/stream`、close、payload 构造、预生成 `task_id`/`chat_id`、`onDeliver` 接 `task.update`/`task.result`/`notice`、启动扫尾、库打开）
- `src/agent.js`: `parseTaskBody` 增 `omp-daemon` 分支；`createTaskDeliverHandler` 增 `notice`（`context_release`）处理；SIGINT 增 `pool.dispose()`
- `src/config.js`、`.gitignore`（+`data/`）、`web/{app.js,index.html,style.css}`

**删除**（clean cutover：这些代码因本次迭代变得无用）
- `src/router.js`：`router.chat_message` / `router.chat_get` / `router.chat_list` 三个 case
- `src/registry.js`：`chats` / `tasksByMessage` 会话表与 `createChat` / `appendChatMessage` / `getChat` / `chatDetail` / `listChats`
- 旧 `web.js` 对 `router.chat_*` 的 3 处调用（随路由重写消失）
- 理由：web 不再使用 Router 内存会话表（真源迁 SQLite）；持久层的任务↔消息关联改用 `task_id`（web 预生成），不再需要 `message_id → task` 的内存 join。

**不动（回归边界）**
- `src/{rpc,node-client,task,status,cli,log}.js`、`bin/`、`scripts/`、`package.json`（**零新依赖**）、`test/` 中除 `web.test.js` 外的 10 个测试文件（`test/` 现共 16 个）、协议信封与错误码、心跳/租约/替换语义、Router 任务表与 `oamp task` CLI。

**既有测试的处置（F08-3 的落地口径）**
- `web.test.js` 的**消息路径**必须重写：它的断言建立在"Router 内存会话 + `message_id` join 任务明细 + 真实 omp 一次性执行"之上，而这些正是本迭代被替换的行为（进程不落盘、消息真源迁库、默认执行器换 daemon）。
- 重写口径 = **同一批用户可见能力的等价覆盖**：静态页/`/api/agents`、发送→落盘→终态、追加到既有 chat、错误面（缺 agent/空消息/未知 chat/已关闭 chat）、@ 解析、`!` 命令路径；外加新增能力的 SSE/落盘/隔离断言。
- 其余 10 个测试文件（既有非 web 的十个；`test/` 现共 16 个）**保持原样全绿**（回归判据）。
- 因此 F08-3"既有测试全绿"的准确口径 = **除 `web.test.js`（其被测行为按本迭代契约变更并等价重写）外，既有测试集合全部不变且全绿**（见 §19 疑问 2）。

---

## 10. 核心数据流

### 10.1 一次提问（默认 daemon 路径，端到端）

```
① 浏览器 POST /api/messages {chat_id?, agent_id, text, model?, one_shot?}
② web:  取/建 chat（新 chat: chat_id=chat-<uuid>, title=text.slice(0,40), state='working'）
        chat.state=='closed' → 409 直接返回
③ web:  task_id = 'task-<uuid>'（预生成）；写 messages(in) + chats(updated_at, state='working')
        → SSE: message(in) + chat_state(working)
④ web:  message.send → agent（payload: {executor:'omp-daemon', chat_id, prompt, model?}）
        派发失败 → 写 messages(out, error='dispatch_failed') + state='failed' + SSE；结束
⑤ agent: pool.prompt(chat_id, resolvedModel, prompt)
        无键 → 建键（spawn omp acp + initialize + session/new + 静默等待）
        模型不同 → session/set_config_option；失败 → 该轮 failed(model_unavailable)
        session/prompt（流式）
⑥ 每 chunk：agent → task.update → Router（记任务表）→ deliver 给 web
        → web: SSE task_update（不入库）
⑦ 收尾：session/prompt 响应 stopReason → agent → task.result{state, text, model, context_id, pid, duration_ms}
        → web: 写 messages(out) + chats(state='completed'|'failed') → SSE message(out) + chat_state
⑧ 库中该 chat 恰好 +2 条记录（in/out），无过程行（E-5）
```

### 10.2 chat 关闭

```
POST /api/chats/:id/close
 → web: UPDATE chats SET state='closed', closed_at=now, updated_at=now WHERE chat_id=? AND state!='closed'
 → web: SELECT DISTINCT agent_id FROM messages WHERE chat_id=?  → 逐个发 notice{kind:'context_release', chat_id}
        （agent 离线 → 忽略；其进程已随 agent 退出而消失）
 → agent: pool.release(chat_id) → SIGTERM/SIGKILL + 移除键
 → SSE: chat_state(closed)
后续对该 chat 的 POST /api/messages → 409（输入被明确拒绝）
```

### 10.3 上下文崩溃 / 超时

```
omp acp 子进程 exit（非主动释放）或 prompt 超时（cancel 后仍无 stopReason）
 → pool: 在飞轮次 task.result{state:'failed', error:'context_crashed'|'timeout'}（含 context_id/pid）
 → pool: 移除键 → agent 发 notice{kind:'context_reset', chat_id}
 → web: 落失败 out 记录 + state='failed' → SSE message+chat_state+notice
 → 下一轮：同键重新创建（新 context_id/pid，可从 out 记录 meta 观察）
```

### 10.4 重启

```
web 重启：历史从 SQLite 读回（E-3）；启动扫尾把遗留 working → failed；上下文不受影响（在 agent 进程内）；**在飞轮次的终态丢失**——`task_id → {chatId, agentId, lines}` 关联表是 web 进程内内存（未知 task_id 的 task.update/result 静默丢弃），重启后无法把该轮结果落盘，只能由启动扫尾置 failed，待用户重发
agent 重启：上下文全丢；后续轮次新 context_id；不做主动提示（边界见 §6.4）
router 重启：沿用 0010 既有语义（节点重连重注册）；web/agent 连接自愈沿用 0010（D22）
```

---

## 11. 功能卡 ↔ 技术路径映射（F01~F08）

| 卡 | 验收要点 | 技术路径（组件 / 文件 / 接口） | 关键设计点 |
|---|---|---|---|
| **F01** chat 容器与生命周期 | 新建即入列、标题非空、四态、时间戳、可关闭、关闭不删 | `persist.js: chats` 表 + `web.js: POST /api/messages`（建 chat）/ `POST /api/chats/:id/close` + `transport` 的 `chat_state` + `web/app.js` 关闭交互 + `registry.js`（删会话表） | chat_id=`chat-<uuid>`；title=首条输入 `slice(0,40)`；状态机 `working→completed/failed`、任意→`closed`（terminal，哨兵防覆盖）；`closed_at`/`updated_at` 毫秒 |
| **F02** 对话持久化（只落输入/输出） | 一一对应、过程不入库、输入先落盘、失败可观察、仅两类、重启可读回、空库启动 | `persist.js`（schema + `insertInput`/`insertOutput` + 幂等建表）+ `web.js` 落盘点（§4.3）+ `task_id` 预生成 | 唯一 SQL 出口 + `direction` 写死在函数内；输入先于派发；失败/派发失败也落 out（§4.4）；过程只走 transport |
| **F03** 历史查询 | 列表、默认排序、四类过滤、组合、详情、重启后可查 | `persist.js` 查询函数 + `web.js: GET /api/chats`、`GET /api/chats/:id` + `web/app.js` 列表/详情 | 排序 `updated_at DESC, chat_id DESC`；`from/to` 闭区间作用于 `updated_at`；`q` 匹配 title+message.text（LIKE + ESCAPE）；agent 相关 = `chats.agent_id` OR 参与过的 `messages.agent_id`；limit 50/200 + offset |
| **F04** 一次调用 + 过程实时展示（协议可替换） | 一次调用、流式可见、三类事件、多轮不失序、过程不落盘、协议可替换、断线不丢内容 | `agent.js: runDaemonTask` → `task.update` 流 + `src/transport.js`（Transport 接口 + SSE）+ `web.js: GET /api/stream` + `web/app.js: EventSource` + `web.js onDeliver` | 增量走既有 `task.update` 投递（§1.2-A，**无轮询**）；四类事件（§5.2）；替换点 = web 一行构造；断线 = 浏览器自动重连 + `onopen` 全量拉取（§5.4）；过程不入库 |
| **F05** 上下文规范（同 chat 累积/新 chat 隔离/agent 自管） | 同 chat 累积、同一常驻实例、新 chat 隔离、多 agent 隔离、反例禁止、B 自管、异常可告知 | `src/context-pool.js`（键 `(chat_id, agent_id)`、LRU、串行队列、上限）+ `src/acp-client.js`（多轮 `session/prompt`）+ `agent.js`（`omp-daemon` 分支）+ out 记录 `meta.context_id/pid` + `notice` 提示 | 键=chat→1 进程；`context_id`/`pid` 写进每轮 out 的 meta（F05-2 判据）；同键串行（队列上限 8）、异键并发；`OAMP_CTX_MAX`（默认 8）LRU；无 TTL；释放/崩溃 → 运行时 `notice`（不入库，§6.3）；A 侧只传本轮输入（C-6） |
| **F06** 模型指定与默认 | 默认 gpt-5.6、可指定、指定优于默认、不可用明确失败、清单来源 | `config.js`（`defaults.model`）+ payload `model` + `acp-client.js: session/set_config_option` + out 记录 `model` 字段 + `web/app.js` 模型输入框 | 优先级 payload > env > config > 内置；模型是 **ACP session 级**（切换不丢上下文，V-8）；未知模型 → `model_unavailable` 明确失败（V-7）；`model` 回读自 ACP `currentValue` 写审计；不提供清单接口；默认模型可用性取舍见 §7.5（L1-6） |
| **F07** 配置面（数据位置可配置） | 默认 `data/sql.db`、配置文件可指定、缺失不失败、非法即失败、覆盖优先级、生效可观察 | `src/config.js` 扩展（JSON 文件 + env + 默认）+ `persist.js` 用 `dbPath` 打开 + `.gitignore` 加 `data/` | 文件 `oamp/config.json`；默认相对**包根**；`OAMP_DB` > 文件 > 默认；非法 JSON/类型 → 抛错退出 1；无热重载；`mkdir -p` 建目录；空库启动 |
| **F08** 基线兼容与回归 | 一次性执行可用、两形态可区分、既有测试全绿、既有交互保留 | `agent.js` 保留 `runOmpTask`（`executor:'omp'`）与 `runShellTask`（`!` 命令）+ `web.js` 判定顺序（§9.1）+ `web/app.js` 一次性开关 | daemon 是**默认**、显式 payload 决定路径；daemon 不入上下文、不复用上下文；@ 补全/`!` 提交/视觉保留；既有 10 个测试文件不动（`test/` 现共 16 个），`web.test.js` 等价重写（§9.3） |

---

## 12. AR-01~AR-16 逐项补全对照表

| AR | 来源卡 | 补全结论（落地要点） | 落点 |
|---|---|---|---|
| **AR-01** | F01 | chat_id 生成 = `chat-` + `crypto.randomUUID()`（沿用 0010 `chat-<sessionId>` 形态）；状态取值 `working\|completed\|failed\|closed`（**无 idle**），流转：创建即 `working` → `completed`/`failed`；任意态 → `closed`（终态，`WHERE state!='closed'` 哨兵防迟到结果覆盖）；时间戳毫秒 epoch，`updated_at` 在新增输入/输出与关闭时前移 | §4.1/§4.3 |
| **AR-02** | F01 | 标题时机 = **首条输入落盘的同一事务步骤**（POST 内，chat 创建时）；来源 = 去首尾空白后的原文；上限 **40 字符**（`text.trim().slice(0,40)`，沿用 0010 registry 既有值）；空标题兜底 `新对话`（仅防御，正常路径输入非空）；后续输入不改标题，不提供重命名 | §4.1、§10.1 |
| **AR-03** | F01/F05 | 关闭 = **立即释放上下文**（web 发 `notice{context_release}` → agent kill 进程 + 移除键），并置 `state='closed'`；**已关闭 chat 不允许再次提问**（`POST /api/messages` → 409 + 提示），故不存在"重开后的上下文来源"问题；关闭不删数据（仅状态与可写性） | §6.4、§10.2 |
| **AR-04** | F02 | 形态 = SQLite（`node:sqlite` DatabaseSync，零依赖，V-10）；结构 = `chats` + `messages` 两张表（§4.1），`direction` 仅 `in`/`out`；字段最小集 = 见 §4.1 列定义（`model`/`duration_ms`/`error`/`meta` 为审计与关联所需）；建库路径 = `dbPath`（配置解析，AR-14）+ `mkdir -p` + 幂等 `CREATE TABLE IF NOT EXISTS` + `PRAGMA foreign_keys=ON`；不引入迁移版本表 | §4.1/§4.2、§8 |
| **AR-05** | F02 | 输入：校验通过后、派发前（同步 await）；输出：收 `task.result` 时（成功/失败都写）；派发失败：立即补一条失败 out；失败轮次**落一条 out**（text=可见摘要，error=机器码）；web 启动扫尾把遗留 `working` 置 `failed`（不补记录）；过程永不入库 | §4.3/§4.4 |
| **AR-06** | F03 | 接口形态 = `GET /api/chats`（`{chats,total,limit,offset}`）/ `GET /api/chats/:id`（`{chat,messages[]}`）；分页 = limit（默认 50，上限 200）+ offset；默认排序 = `updated_at DESC, chat_id DESC`；详情 = `created_at ASC, id ASC` | §4.5 |
| **AR-07** | F03 | 时间过滤基准 = `updated_at`（与排序同基准），毫秒，闭区间 `[from,to]`，缺省不限，`from>to`→400；关键词 = `title LIKE` OR `messages.text LIKE`，大小写按 SQLite LIKE 语义（ASCII 不敏感），**转义 `%_\\` + ESCAPE**，**包含已关闭 chat**；agent 相关 = `chats.agent_id=?` OR 存在 `messages.agent_id=?` 的记录 | §4.6 |
| **AR-08** | F04 | 接口 = `createSseTransport()` 的 `{kind,handle,publish,closeAll}`（§5.1），替换点 = web 一行构造，**不引入 transport 配置项**；事件模型 = 四类事件（`message`/`task_update`/`chat_state`/`notice`，§5.2）；本版实现 = `GET /api/stream?chat_id=`（`text/event-stream`，`retry:1000` + 15s 注释心跳，单连接 FIFO 顺序，无 seq） | §5.1/§5.2 |
| **AR-09** | F04 | 来源 = ACP `session/update.agent_message_chunk` 逐块 → `task.update` → Router 投递 origin(web) → SSE（**复用既有投递语义，无轮询**）；时效预算单 chunk 端到端 ≤200ms；E-4 判据 = 终态 `message` 事件之前已收到 ≥2 个 `task_update` 且文本递增；不做节流（刷屏再议） | §5.3 |
| **AR-10** | F04 | 断线 = 服务端 `retry:1000` + 浏览器 EventSource 自动重连；重连/刷新 = `onopen` 全量拉取 `GET /api/chats/:id` 补齐全量输入/输出（F04-7）；断线期间的过程增量**不补发**（F04 边界）；无订阅者时 publish 丢弃；`res.on('close')` 清理订阅防泄漏 | §5.4 |
| **AR-11** | F05 | 落地形态 = per-`chat_id` 一个常驻 `omp acp` 子进程 + 一个 ACP session（`context-pool.js`）；实例标识 = `context_id='ctx-<pid>-<generation>'` + `pid`，随每轮 result 写入 out 记录 `meta`（两轮相等即判同一实例，F05-2/E-1）；同键**串行**（单 in-flight + FIFO 队列，队列上限 8，超出 `context_busy` 失败）；异键**并发**；上限 `OAMP_CTX_MAX`（默认 8）**LRU 淘汰**、无 TTL；释放/崩溃提示 = 运行时 SSE `notice`（**不入库**，避免违反 E-5） | §6.1~§6.3 |
| **AR-12** | F05 | chat 关闭 → **立即**释放（web 发 `context_release` → agent kill + 移除键），在飞轮次按崩溃路径失败收尾；已关闭 chat 拒绝新输入（409）；**web 重启**上下文不受影响（在 agent 进程内）；**agent 重启**上下文全丢、后续新 `context_id`、不做主动提示（无持久 chat 清单，超出 N-5 范围）；agent SIGINT → `pool.dispose()` | §6.4、§10.2~§10.4 |
| **AR-13** | F06 | 传递形态 = payload `model`（校验 `^[A-Za-z0-9._/-]{1,128}$`）→ agent 解析 → 首轮 `--model` / 后续 `session/set_config_option`；优先级 payload > `OAMP_OMP_MODEL` > `config.defaults.model` > 内置 `openai/gpt-5.6-luna`（每轮独立解析，未指定即回默认）；不可用判定 = ACP `set_config_option` 的 error（V-7 `Unknown ACP model`）→ 该轮 `failed(model_unavailable)`，**不回退**；审计 = out 记录 `model` 取自 ACP `currentValue`（实际生效值）；L1-6 默认模型可用性取舍**已定稿**（保持现值 + 复测门禁，§7.5） | §7 |
| **AR-14** | F07 | 文件 = `oamp/config.json`（JSON，`OAMP_CONFIG` 可改路径），三键 `data.db`/`defaults.model`/`context.max`；缺失 → 全默认正常启动；非法 JSON/类型 → 抛错退出 1；env 名 = `OAMP_DB` / `OAMP_OMP_MODEL` / `OAMP_CTX_MAX`；优先级 env > 文件 > 默认（逐键）；默认路径相对**包根**；`data/` 加入 `.gitignore`；无热重载 | §8 |
| **AR-15** | F08 | 路由 = web 判定（`!`→shell、`one_shot`→`omp` 一次性、否则 `omp-daemon`），daemon 为默认但显式路径行为不变（F08-1/2）；影响面 = 新增 4 模块 + 5 个新测试文件（回归：其余 10 个既有测试文件零修改且全绿；`test/` 现共 16 个（0010 既有 11 + 本迭代新增 5））、改造 `web.js`/`agent.js`/`config.js`/前端 3 文件、删除 Router `chat_*` 与 registry 会话表、其余全不动；`web.test.js` 等价重写 | §9 |
| **AR-16** | 全局 | V-5/V-11 初始化等待 = `--no-skills --no-rules`（通知降到 1 条）+ 静默 300ms/上限 5s；V-3 持久化 = `node:sqlite`（无 flag，仅实验警告）+ 幂等建表（不引入版本表）；工具模式 = daemon 固定 `--no-tools`，`tools:true` 仅走一次性 `executor:'omp'`（**本版不做 ACP 权限应答**）；另：`--no-session`；默认模型可用性见 §7.5（L1-6） | §6.5/§6.6、§9.1、§2 |

**覆盖核对**：16/16 条 AR 均已给出落地结论；L1-6（默认模型可用性取舍）已由用户确认（选择 (a)，2026-09-10）；AR-11/AR-12 的"提示不入库"等裁决已由主 agent 确认（§19 裁决记录 3~6）。

---

## 13. 关键技术决策总表（L1 / L2 / L3 分级）

| # | 决策 | 级别 | 理由 / 影响 |
|---|---|---|---|
| D-01 | 引入 JSON 配置文件面（`oamp/config.json`） | **L1（已确认）** | 用户决策 2026-09-10 §9-1；替代 0010 "无配置面"约束 |
| D-02 | SQLite 持久化（`node:sqlite`，零依赖） | **L1（已确认）** | 用户决策 D-3 / §9-1；数据真源从 Router 内存迁出 |
| D-03 | per-(chat,agent) 常驻 omp acp 进程池（agent 进程内） | **L1（已确认）** | 用户决策 D-2/C-5/C-6；引入 ACP 子进程拓扑 |
| D-04 | 传输抽象 + 本版 SSE（不引入 WS 依赖） | **L1（已确认）** | 用户决策 D-1 + N-3 |
| D-05 | 默认模型 `openai/gpt-5.6-luna` | **L1（已确认）** | 用户决策 D-4/V-2 |
| **D-06** | **内置默认模型取值** | **L1（已确认：用户选择 (a) 保持现值 + 复测门禁）** | V-9 实测默认模型在本机间歇性无响应（ACP 与一次性路径同时段同现象 → 上游问题）。裁定保持 `openai/gpt-5.6-luna`（配置可覆盖）+ 上线前复测门禁；**不采用 `--thinking off` 规避**（关闭思考链是质量代价，且与挂起无因果） |
| D-07 | 模型改由 ACP `session/set_config_option` 逐轮切换（不重建进程） | L2 | V-6/V-8 实测：切换保留上下文 → F05 与 F06 可同时成立；避免"换模型即失忆" |
| D-08 | 过程增量走既有 `task.update` 投递（web 作 origin 直接收推送），**放弃 500ms 轮询** | L2 | §1.2-A 既有语义；时延更低、无轮询开销；推翻 v0.2.0 §4 的轮询设计 |
| D-09 | 上下文提示复用既有 `notice` 信封类型（Router 零改动），且**不入库** | L2 | §1.2-C 白名单已含 `notice`；不入库以守住 E-5"仅两类记录" |
| D-10 | 失败轮次落**一条 out 记录**（text=可见摘要，error=机器码） | L2 | F02-1 一一对应 + F01-3 失败态归属；不破坏"仅两类"类目 |
| D-11 | 关闭 = 立即释放上下文 + 只读；`closed` 为终态（哨兵防覆盖） | L2 | F01-5/F01-6 + AR-03；避免"重开语义"这一未定义分支 |
| D-12 | 删除 Router `chat_*` 方法与 registry 内存会话表 | L2 | web 不再使用（真源迁库）；clean cutover 不留死代码 |
| D-13 | 删除设想的 `GET /api/search`，关键词检索并入 `GET /api/chats?q=` | L2 | 无卡要求；少一个端点 |
| D-14 | 不做模型清单接口 / 前端下拉 | L2 | 无卡要求；合法性由 ACP 判定（V-7），前端用文本框 |
| D-15 | 不做 transport 配置项、不做 TTL 回收、不做增量补发 | L2 | 均属无需求支撑的灵活性（YAGNI，用户已确认不主动回收） |
| D-16 | ACP 初始化等待 = 静默 300ms / 上限 5s（`--no-skills --no-rules` 后） | L3 | V-11 实测通知降到 1 条；建键时一次性成本 |
| D-17 | 命名/常量：`context_id='ctx-<pid>-<gen>'`、`task_id='task-<uuid>'`、`limit` 默认 50/上限 200、队列上限 8、心跳 15s | L3 | 具体实现细节 |

---

## 14. 奥卡姆剃刀检验（新组件 ↔ 必需功能）

| 新组件 | 不引入它，哪个功能无法实现 | 判定 |
|---|---|---|
| `src/persist.js` | F02（重启后历史可查 E-3）、F03（列表/过滤/详情）、F07（位置可配）——Router 内存表与协议方法都不提供持久化 | 必需 |
| `src/transport.js` | F04-6 要求"替换实现时外部行为不变"，即接口本身是被要求的产物；且订阅集合/心跳需要一个归属模块（放 web.js 会让 HTTP 入口同时承担订阅状态管理） | 必需（F04-6 明文要求抽象） |
| `src/context-pool.js` | F05 全部验收（键隔离、复用、串行、上限淘汰、释放）——进程生命周期状态必须有人持有 | 必需 |
| `src/acp-client.js` | F05/F06 的协议载体（多轮 prompt、流式 chunk、model 切换）；并入 pool 会让"协议帧处理"与"生命周期/队列"混在一个文件（~300 行两类关注点） | 必需（单独成文件为可读性，不是新抽象层） |
| `oamp/config.json` | F07 全部验收（数据位置可配、缺失/非法/优先级） | 必需（用户已确认 L1-01） |

**未引入（及理由）**：WebSocket/`ws` 依赖（N-3）、FTS5（F03 只要关键词字面匹配）、迁移/版本表（N-5 空库启动）、模型清单接口（无卡）、transport 选择配置项（只有一种实现）、`/api/search` 独立端点（被 `?q=` 覆盖）、连接池/ORM（单进程单连接）、上下文 TTL 回收（用户明确不做）、增量补发/游标（F04 边界不做）。

---

## 15. L1 决策清单与确认状态

| # | L1 决策 | 内容 | 状态 |
|---|---|---|---|
| L1-1 | 配置文件引入 | `oamp/config.json`（JSON、零依赖、缺失用默认、非法即失败）+ `OAMP_DB`/`OAMP_OMP_MODEL`/`OAMP_CTX_MAX` env 覆盖 | ✅ **已确认**（2026-09-10 用户决策 §9-1） |
| L1-2 | SQLite 持久化 | `node:sqlite`（Node 内置，零第三方依赖）承载 chats/messages（仅输入输出） | ✅ **已确认**（用户决策 D-3、§9-1） |
| L1-3 | 常驻 omp acp 上下文进程 | per-(chat_id, agent_id) 一个常驻 `omp acp` 进程池，位于 agent 进程内 | ✅ **已确认**（用户决策 D-2/C-5/C-6） |
| L1-4 | SSE 协议层 | 传输抽象 + 本版 HTTP/SSE 实现，不引入 WS 依赖 | ✅ **已确认**（用户决策 D-1、N-3） |
| L1-5 | 默认模型 | `openai/gpt-5.6-luna`（优先级 payload > env > config > 内置） | ✅ **已确认**（用户决策 D-4、V-2） |
| **L1-6** | **内置默认模型取值**（新增） | V-9 实测：`openai/gpt-5.6-luna` 在本机间歇性无响应（ACP 3 轮中 1 成；同一时段一次性路径 3/3 超时；对照组 `deepseek/deepseek-v4-flash` 稳定 0.9~1.7s），**归因为上游 provider 可用性**（非 ACP）。二选一：**(a)** 保持 `openai/gpt-5.6-luna`（守用户决策 D-4；配置面一行可覆盖；上线前复测，若持续不可用再切换）；**(b)** 内置默认改为 `deepseek/deepseek-v4-flash`，gpt-5.6-luna 作为"可指定"值保留 | ✅ **已确认（2026-09-10 用户选择 (a)）**：保持内置默认 `openai/gpt-5.6-luna` + 上线前复测门禁（§7.5）；若复测仍高频挂起再由用户决定切换备选 (b)；不采用 `--thinking off` 规避 |

**未新增其它 L1**：模型切换方式（D-07）、增量推送链（D-08）、提示不入库（D-09）、删除 Router chat 面（D-12）均在既有技术栈与既有协议面内，属 L2 自主决策。

> **保留 v0.2.0 §9 用户确认记录**（2026-09-10，user_confirmed）：① 数据库位置 = 配置文件驱动（默认 `data/sql.db`，`OAMP_DB` 可覆盖）；② 空闲回收 = **不主动 TTL**，仅受全局上限约束；③ 默认模型 = `openai/gpt-5.6-luna`；④ 流程 = 先审方案（`architecture.md` + `demand.md` 经用户审阅确认后开工），实施在新分支 `iteration/0011-chat-context-protocol`（PR-1..4 = v0.2.0 方案稿的编号；实际布局已重切为 pr-001~pr-005，见 §16.1）。①②③ 分别对应本表 L1-1 / L1-2（回收策略落在 §6.3）/ L1-5；④ 属流程约定，不在 L1 表内。

---

## 16. 实施步骤与边界（阶段 4 pr-planner 的输入）

### 16.1 PR 划分（与 `prs/` 实际布局一致；v0.2.0 §7 的 4-PR 建议已被重切）

| PR | 内容（含文件范围） | 依赖 | 验收（可执行断言） |
|---|---|---|---|
| **pr-001** 配置面 + 持久层 | `src/config.js`（JSON 配置文件层 + `dbPath`/`defaultModel`/`contextMax`）+ `src/persist.js`（新建：schema/建库/`insertInput`/`insertOutput`/查询/close/启动扫尾）+ `.gitignore`(+`data/`) + `test/config-file.test.js` + `test/persist.test.js`。**只交付模块与单测，不接线消费方** | 无（首批） | `loadConfig()` 无配置时返回 `<包根>/data/sql.db`、`openai/gpt-5.6-luna`、`8`，既有键不变；逐键优先级 env > 文件 > 默认；缺失不失败、非法抛错（入口退出 1）；`mkdir -p` + 幂等建表；一次问答恰 2 行且 `direction∈{in,out}`；排序/分页/时间闭区间/关键词转义/agent 相关性；`WHERE state!='closed'` 哨兵；关闭连接重开内容一致（E-3 落盘侧）（F02/F03/F07） |
| **pr-002** SSE 传输抽象 | `src/transport.js`（新建：`createSseTransport()`）+ `test/transport.test.js`。**只交付模块与单测，不接线 web**（`/api/stream` 与 `onDeliver → publish` 接线归 pr-004） | 无（首批） | 接口形状 `{kind:'sse',handle,publish,closeAll}`；`handle` 写 `text/event-stream` + `retry: 1000`；`publish` 按 `event:`/`data:` 帧且同连接 FIFO；无订阅者不抛错不缓存；连接 close 后订阅移除、`closeAll()` 结束全部；心跳按可注入 `heartbeatMs`（生产默认 15000）（F04-6） |
| **pr-003** 上下文池 + ACP 客户端 + daemon 执行器 | `src/acp-client.js` + `src/context-pool.js`（新建）+ `src/agent.js`（`omp-daemon` 分支 + `notice` 处理 + SIGINT `pool.dispose()`）+ `test/context-pool.test.js`（fake ACP: `OAMP_OMP_BIN`） | **pr-001** | 同 chat 两轮记忆 42 且 `meta.context_id`/`pid` 相等（E-1/F05-2）；新 chat 不含 42（E-2）；同 chat 两 agent 互不串扰（F05-4）；同键串行 + 队列上限 8（超出 `context_busy`）；超 `contextMax` LRU 淘汰 + `notice{context_reset}`；崩溃 → 该轮 `context_crashed` + `notice{context_reset}` + 下轮重建；未知模型 → `model_unavailable`（不回退）；`model` 取自 ACP `currentValue`；缺 `chat_id` → 拒收；shell/`omp` 一次性分支不回归（F05/F06/F08） |
| **pr-004** web HTTP 层 + 控制台前端 | `src/web.js`（读库路由、`/api/stream`、`/api/chats/:id/close`、预生成 `chat_id`/`task_id`、payload 判定、`onDeliver` 收 `task.update`/`task.result`/`notice`、落盘与状态机、启动扫尾、打开库）+ `web/{app.js,index.html,style.css}`（SSE 订阅 + 关闭/模型/一次性/提示条；移除 1.5s 轮询）+ `test/web.test.js`（等价重写）。**本 PR 是 `web.js`/前端/`web.test.js` 的唯一所有者** | **pr-001 + pr-002 + pr-003** | `GET /api/chats`（含已关闭、四类过滤可组合、分页与 400 面）；`GET /api/chats/:id`（升序 + 未知 chat 明确错误）；`POST /api/messages` 落 `in`+`working` → 推 `message`/`chat_state` → 终态落 `out`+`completed`（恰 2 行）；已关闭 → 409；派发失败 → `out(error='dispatch_failed')`；`close` 幂等 + 向 `DISTINCT agent_id` 发 `notice{kind:'context_release'}`；SSE 端点与三类推送（`task_update` 不入库）；E-4 判据（`message(out)` 前 ≥2 个 `task_update` 且文本递增）；断线/刷新全量拉取（F04-7）；重写后的 `web.test.js` 逐条覆盖 F08-a~d 且另加落盘/SSE/关闭断言（F01~F06、F08） |
| **pr-005** 会话面清理 + 端到端契约 + 文档同步 | `src/router.js`（删 `chat_message`/`chat_get`/`chat_list` 三个 case）+ `src/registry.js`（删 `chats`/`tasksByMessage` 与 5 个会话函数及导出）+ `test/acp-daemon.test.js`（新建）+ `oamp/README.md`（更新失效描述） | **pr-004**（并依赖 pr-001/002/003 的产物） | 删除面全仓无残留引用；其余 10 个既有测试文件**未被修改**且原样全绿（F08-3；`test/` 现共 16 个）；`test/acp-daemon.test.js`（真实 Router + agent + `oamp web` + 临时 `OAMP_DB` + fake ACP）断言 E-1~E-5 全绿；两形态不回归（`!`→shell、`one_shot`→`omp -p`）；`npm test` 全量通过；README 无"会话存于 Router 内存"失效描述（R-13/R-14） |

**重切理由（相对 v0.2.0 §7 的 4-PR 建议）**：
1. **`web.js` 与其前端拆不开**：二者是同一 HTTP 契约的两端（路由 / 事件名 / 字段名任一侧单独改动都会让另一侧失效），故 `web.js` + `web/*` + `test/web.test.js` 同属 pr-004；v0.2.0 把它们拆在 PR-2（前端实时）与 PR-4（串接）两侧，会造成中间态不可独立验收。
2. **`transport.js` 提前独立**：F04-6 要求"替换实现时外部行为不变"，接口本身就是被要求的产物，模块可脱离 web 单独验收 → 独立为 pr-002（v0.2.0 把它与 web 实时改造合在 PR-2）。
3. **pr-003 必须依赖 pr-001**：`agent.js` 的 daemon 分支消费 `loadConfig()` 的新键（`defaultModel`/`contextMax`）。代码证据：`oamp/src/agent.js:8` 已 `import { loadConfig } from './config.js'`，而现行 `oamp/src/config.js:30-44` 的返回值只有 `socketPath`/心跳/重连，**没有**这两键 → 不先合入 pr-001，默认模型与池上限会解析为 `undefined`（v0.2.0 曾误判"PR-1 与上下文池互相独立"）。
4. **清理与端到端同属 pr-005**：删除面（`router.chat_*`、registry 会话表）以"web 已不再调用"为解锁条件（现行 `oamp/src/web.js:174/180/209` 仍在调用），与 e2e（需 pr-004 的全链路）共享同一解锁集，故合并交付。

### 16.2 实施顺序与并行度（批次 = `prs/` 的 `batch` 字段）

| 批次 | PR | 说明 |
|---|---|---|
| 1（并行） | **pr-001 ∥ pr-002** | 两者均无依赖、文件不相交（config/persist vs transport），且都只交付"模块 + 单测、不接线消费方"，可同时开工同时合并 |
| 2 | **pr-003** | 依赖 pr-001（消费 `defaultModel`/`contextMax`）；与 pr-002 无直接关系，按 `prs/` 的 batch 排入第二批 |
| 3 | **pr-004** | 依赖 pr-001 + pr-002 + pr-003（读库 / SSE 接线 / daemon payload 三面齐备才可验收） |
| 4 | **pr-005** | 依赖 pr-004（删除面解锁）+ pr-001/002/003（e2e 断言需要持久层、SSE 端点与上下文池） |

- 每个 PR 内部先落模块单测（fake 注入），再串该 PR 的验收断言；端到端只在 pr-005 做一次。
- 跨批次**不并行**：pr-004 的验收断言以 pr-001~003 的导出契约（`persist` 函数、`createSseTransport`、`omp-daemon` 受理面）为前提，提前开工会产生"半成品导致的幻影失败"。

### 16.3 开工前置（沿用 v0.2.0）

1. `oamp/config.json` 加载器 + 单测（pr-001 的首批交付内容）。
2. `.gitignore` 增 `data/`。
3. 分支 `iteration/0011-chat-context-protocol` 从 0010 拉出。

### 16.4 明确不在本迭代范围（防止实施期夹带）

- WebSocket / 双向长连接、过程持久化与回放、跨 chat 上下文共享、鉴权与多用户、历史迁移、chat 删除/归档/导出/重命名/重开、语义检索与 FTS5、模型清单 UI、token 费用统计、ACP 工具权限应答、`session/load` 上下文恢复、上下文 TTL、Router 任务表改造、一次性路径的演进。

---

## 17. 测试策略

| 层 | 手段 | 覆盖 |
|---|---|---|
| 单元 | 直接 import 模块 | `persist`（schema/查询/转义/扫尾）、`config`（缺失/非法/优先级/路径基准）、`transport`（订阅集合/publish 无订阅者/closeAll） |
| 集成（进程内） | fake ACP server（`OAMP_OMP_BIN` 指向一段 node 脚本，实现 `initialize`/`session/new`/`set_config_option`/`session/prompt` 流式 + per-session 记忆 + 可编排的"崩溃/慢响应/未知模型"） | context-pool 全部行为（复用/隔离/串行/队列上限/LRU/崩溃重建/模型切换/超时取消） |
| 端到端 | harness 起 Router + agent + `oamp web`（随机端口、临时 `OAMP_DB`），fetch + SSE 客户端断言 | E-1~E-5、F01~F08 的用户可见行为、既有交互回归 |
| 手工（真实 LLM） | 真实 `omp acp` + 真实模型 | 用户案例：数字记忆 42 + 新 chat 隔离；模型切换前后记忆保持（V-8 手法）；**默认模型稳定性复测（§7.5 步骤，L1-6 判据）** |
| 回归 | `npm test`（`node --test test/*.test.js`） | 0010 既有的 10 个非 `web.test.js` 测试文件零修改且原样全绿（`web.test.js` 等价重写；本迭代新增 5 个测试文件；`test/` 现共 16 个）（F08-3） |

- **不依赖真实 LLM/外网**：所有自动化用例经 fake ACP。
- 测试不得写真实 `oamp/data/sql.db`：一律 `OAMP_DB` 指到临时目录（沿用 harness `makeTempSocketDir` 模式）。

---

## 18. 风险与开放问题

| # | 项 | 说明 | 处置 |
|---|---|---|---|
| R-1 | 常驻进程资源 | 每 chat 一个 omp 进程（内存百 MB 级）；不主动回收则多 chat 累积 | 全局上限 `OAMP_CTX_MAX`（默认 8）+ LRU；上线前实测单进程与 N=8 总量 |
| R-2 | LRU 淘汰即上下文丢失 | 容量压力下被淘汰的 chat 失忆 | 运行时 `notice` 提示"上下文已释放"；未来可评估 ACP `session/load`（`agentCapabilities.loadSession=true`，本迭代不做） |
| R-3 | ACP 稳定性 | 非交互长期运行验证不足 | 崩溃重建 + 超时取消 + 提示；列入压测 |
| R-4 | 初始化开销 | 建键冷启动 ~1-3s（含等待静默） | `--no-skills --no-rules`（V-11）+ 懒创建；静默窗口 300ms/上限 5s |
| **R-9** | **默认模型 `openai/gpt-5.6-luna` 间歇性无响应（V-9 实测，归因上游 provider）** | 两条路径同时段同现象：ACP 3 轮中 1 成（余为 40s 超时）；一次性路径同一时段 3/3 60s 超时（更早一次 4.1s 成功）；对照组 `deepseek/deepseek-v4-flash` 稳定；挂起轮次的消息**已进入上下文** | ① L1-6 **已定**（保现值 + 复测门禁，2026-09-10 用户选择 (a)）；② 超时 → cancel → kill → `context_reset` 提示（§6.5，**必需**）；③ 记为上线前必测项；④ **不**用 `--thinking off` 规避（§7.5） |
| R-10 | `node:sqlite` 实验 API | 22.15 无 flag 但打 Experimental 警告，API 可能变化 | `persist.js` 收口全部 SQL/驱动调用（换驱动只改一处）；`engines.node>=22` 不变 |
| R-11 | 增量消息量 | 一次长答复的 chunk 数可能较大（每条一个 `task.update` → 一次 UDS 往返） | 本版不节流；若实测影响吞吐，实施期加 50ms 合帧（不预先设计） |
| R-12 | 中断轮次的记录缺失 | web 重启会丢失在飞轮次的 out 记录 | 启动扫尾置 `failed`（状态如实）；输入仍可查（E-3） |
| R-13 | 旧内存会话数据 | 0010 的 Router 内存会话不迁移 | 新库空启动（N-5）；Router 会话表随 D-12 删除 |
| R-14 | 0010 文档一致性 | 0010 `architecture.md §15.7` 描述"Router 内存会话表 + web 轮询" | 本迭代删除该面；由实现阶段同步更新 `oamp/README.md`（不在本迭代新增文档） |

### 18.1 下一迭代候选（阶段 5/6 独立验证报告汇总，2026-09-10；本迭代**不实现**）

> 来源：7 个 PR（pr-001~pr-007）的验证/复审报告的「偏差记录」与「下一迭代候选」。已在本迭代闭环的项不重复列出（如 pr-001 D-1/D-3/D-4/D-5 已写入 §4.3/§4.5/§4.7，pr-002 偏差 1~4 已写入 §5.1/§5.2，pr-003 D1~D3 已写入 §6.2/§6.3/§6.6/§7.3，pr-004 偏差 1 已写入计数口径、候选 C1/C2 已闭环并写入 §4.5，pr-006 竞态修复已写入 §4.3，**pr-007 对账参数与语义已写入 §8.2/§4.3**（其边界项 → NC-17/NC-18、流程项 → NC-15））。

| # | 候选 | 来源 | 备注 |
|---|---|---|---|
| NC-1 | **模型回读失败的可观测性**：`readCurrentModel` 得 `null` 时补一条事件（如 `MODEL_UNREADABLE`），避免 `out.model` 静默为空 | pr-003 偏差 2 / 复审 | 当前行为已在 §7.4 显式记录为受控降级；若未来 omp 改 `configOptions` 字段名/形态，可观测性是唯一早期信号 |
| NC-2 | 一次性（`executor:'omp'`）与 `!` shell 路径的 `out.model` 恒为 `null`（两条路径不经 ACP session）；若要"每轮都有模型审计"，需 agent 侧一次性路径也回读模型 | pr-004 C3 | 跨 PR 范围；F06 只要求 daemon 路径审计 |
| NC-3 | web 重启期间在飞轮次的终态丢失（`task_id → chat_id` 关联为进程内内存） | pr-004 C4 | 已在 §10.4 显式写明；若要保留需持久化关联表或由 Router 补投递 |
| NC-4 | `notice` 提示条不持久（刷新即消失） | pr-004 C5 | 与"提示不入库（E-5）"冲突，属产品取舍 |
| NC-5 | `/api/agents` 与 `@` 补全含 `web` 自身（前端过滤非 agent 节点，或 Router 节点类型标注） | pr-004 偏差 2 | 已在 §9.2 记录为"行为变更、已记录、不修" |
| NC-6 | `message_id` / `messageId` 死参数的最终处置（删字段 + `router.task_get` 形状变更需协议版本策略，或显式冻结）；连带更新 `router.js` 标注行内注释与 `registry.js` 任务条目 schema 注释 | pr-005 偏差 1/2/3 | §16.4 已把"Router 任务表改造"排除在本迭代外 |
| NC-7 | `direction` / `state` 缺 schema 级 `CHECK` 约束（当前"仅两类"由模块 API 结构保证） | pr-001 候选 | 纵深防御，非 E-5 的必要条件 |
| NC-8 | `readBody` 未监听 `aborted`/`close`（客户端中途断连时 Promise 可能不 settle） | pr-004 复审 | 实测用户可见影响为零 |
| NC-9 | 测试/前端 `pickPort()` 无 `EADDRINUSE` 回退 | pr-005/pr-006 候选 | 并发或端口占用时有 flake 概率 |
| NC-10 | Router 侧若改为自分配/改写 `task_id`，web 的登记键会静默失配（建议 `dispatched !== taskId` 告警）；`tasks` Map 无 TTL / 兜底清理 | pr-006 候选 | 与上下文池淘汰机制可一并评估 |
| NC-11 | 二次 SIGINT（退出码 130）路径未实测 | pr-003 候选 | 首次 SIGINT 路径已实测覆盖 `pool.dispose()` |
| NC-12 | 常驻进程内存实测（单进程 + N=8 总量）与**默认模型两路径对照复测** | R-1 / R-9、§7.5 门禁 | 后者是 L1-6 的落地条件，属上线前必测 |
| NC-13 | `notice{context_release}` 无发送方鉴权（任意注册节点可令 agent 释放任意 chat 的上下文） | pr-003 候选 | 沿用 0010 N6 信任边界；引入鉴权时须一并覆盖该控制消息 |
| NC-14 | 历史文档中已删符号的标注（0010 `architecture.md §15.7`、0011 §1.1/§9.3 对 `chat_*` 的叙述）如需对外交付可加"（已删除）" | pr-005 候选 | 均为描述"删除动作/历史基线"的正文 |
| NC-15 | 流程留痕：`prs/` 卡片与提交状态——`pr-006-dispatch-race.md` 已补；**`pr-007` 尚无对应 `prs/pr-007-*.md` 卡**，其改动仍在 worktree（`feat/0011-pr-007-reconcile`，未提交/未合并）；`status.md` 回填 | pr-006 偏差 1/2/3 + pr-007 | 属 workflow-pb 规则 B 的前置，由主 agent 处理 |
| NC-16 | **E-4 断言的守护定位**：实测 E-4（"终态前收到 ≥2 个递增 `task_update`"）对 pr-006 的首片竞态**无区分力**（对照组 3/3 通过）；若将来要建"回归守护清单"，应把 pr-006 新增用例（而非 E-4 断言）登记为该竞态的守护用例，避免误以为 E-4 已覆盖它 | pr-006 候选 | 本次修复的守护证据在 pr-006 报告（红 5/5、绿 5/5 双向对照）中留痕 |
| NC-17 | **永不终态的任务 → chat 停在 `working` 无终态兜底**：对账会把登记保留到软 TTL（默认 30min）后清理，此后若该轮真正的终态才到达则不再被认领；之后只有"下次 web 启动扫尾"才会把它置 `failed`（期间前端一直显示"处理中"）。彻底兜底需要"`working` 超时自动置 `failed`"的状态机（或放宽 TTL） | pr-007 对账引入的边界 | 当前处置：软 TTL 默认 30min，配 §6.5 的 agent 侧超时（默认 300s、上限 600s）实际不会走到 |
| NC-18 | **软 TTL 到期后的迟到投递不再认领**：TTL 清理后 `tasks` 无登记 → 该 `task.result` 被静默丢弃（§10.4 的"未知 task_id 丢弃"）。边界正确（孤儿条目必须清理），默认 30min ≫ agent 最大 600s 超时，故**无实害** | pr-007 对账引入的边界 | 若将来放宽 agent 超时上限或引入长时任务，需同步复核 `OAMP_WEB_RECONCILE_TTL_MS` |

---

## 19. 疑问与越界（裁决记录，2026-09-10）

1. **L1-6：默认模型可用性取舍 —— 已定稿（2026-09-10 用户选择 (a)）**。V-9 实测：默认模型 `openai/gpt-5.6-luna` 在本机间歇性无响应（ACP 与一次性路径同时段同现象 → 上游 provider；对照组 `deepseek/deepseek-v4-flash` 稳定）。**裁定：内置默认保持 `openai/gpt-5.6-luna`**（配置面 `defaults.model` / `OAMP_OMP_MODEL` 可一行覆盖），保留**上线前复测门禁**（§7.5 第 4 条两条路径对照复测；若仍高频挂起再由用户决定切换备选 (b)）；§6.5 的超时兜底（cancel → kill → `context_reset` 提示）为必做项；**不采用 `--thinking off` 规避**。本迭代已无待拍板技术项。
2. **F08-3 口径 —— 已裁定（2026-09-10 主 agent）：采纳"既有能力回归"口径**。即 **除 `web.test.js` 等价重写外，其余 10 个既有测试文件零修改且原样全绿（`test/` 现共 16 个）；`web.test.js` 所覆盖的既有用户可见能力由重写用例等价覆盖**。原句"既有测试全绿"物理上不可字面成立（其被测行为正是本迭代被替换的对象，见 §9.3）；F08 卡片的措辞由 prd 角色同步修订，本文件与 §9.3 / §16.1 的落地口径按此执行。
3. **F05-7 的提示形态与 E-5 的张力 —— 已确认（2026-09-10 主 agent 裁定）**：上下文释放/重置提示**不入库**（仅 SSE 运行时事件），否则违反 F02-5/E-5"仅两类记录"。代价：刷新页面后该提示不重现（提示只要求"对话内明确告知"，已在发生时刻告知）。
4. **F02-4 失败轮次的落盘口径 —— 已确认（2026-09-10 主 agent 裁定）**：落一条 `direction='out'` 的错误记录（text=可见摘要、error=机器码）；派发失败同样补一条失败 out 记录——保 F02-1 的"一一对应"，不改类目数。
5. **关闭语义 / 标题截断 / 状态集合 —— 已确认（2026-09-10 主 agent 裁定）**：关闭 = **立即释放上下文 + 只读 + 拒绝新输入（409）+ 不提供重开**（AR-03/§6.4）；标题截断 = **40 字符**（沿用 0010 `registry.createChat` 的既有 `slice(0,40)`，demand 未定值；产品侧若另有期望值改配置常量即可）；chat 状态集合 = `working/completed/failed/closed`（**去掉 idle** —— 创建与首条输入同步发生，idle 不可观测）。
6. **M-07 / M-08 越界候选 —— 已裁定：保留（2026-09-10 主 agent）**。F07（配置面）依据 = 用户"基于配置文件"的决策；F08（基线兼容）依据 = N-5 与回归保护。本架构按两卡存在落地：F07 → §8，F08 → §9。
7. **未修改任何卡的产品维度**：`prd/*.md` 仅回填 `[架构待填]`（见下）；`demand.md`、`architecture.md` v0.2.0 的产品结论未被推翻。
8. **阶段 5/6 验证报告的待办已归口**：各 PR「偏差记录」中属文档同步的部分已吸收进本文件（§4.3/§4.5/§4.7/§5.1/§5.2/§6.2/§6.3/§6.6/§7.3/§7.4/§9.2/§10.4 与计数口径）；**不属文档吸收、留给下一迭代的项（含"回读失败 model 可观测事件""一次性路径无模型审计"等）统一登记在 §18.1 NC-1~NC-15**，本迭代不实现。

### prd/*.md 回填清单（仅架构维度）

| 卡 | 回填项 |
|---|---|
| F01 | chat 标识生成方式与状态集合/流转；标题时机与 40 字符上限；时间戳精度与触发点；关闭→立即释放上下文 + 已关闭拒绝提问（无重开语义） |
| F02 | 存储形态（SQLite 两表）+ 字段最小集；建库路径与空库启动；落盘时机表（输入先落/输出终态/派发失败/中断扫尾）；失败轮次落一条 out 记录（摘要+机器码） |
| F03 | 查询接口与返回结构、分页（50/200 + offset）、默认排序（updated_at DESC, chat_id DESC）；时间过滤基准与闭区间；关键词匹配范围/大小写/转义/含已关闭；agent 相关性判定 |
| F04 | Transport 接口形态与四类事件模型 + 心跳；SSE 端点；过程增量来源（ACP chunk → task.update 投递，无轮询）与时延预算/E-4 判据；断线重连兜底（自动重连 + 全量拉取，不补发增量） |
| F05 | 上下文落地形态（per-chat 常驻 acp 进程）与 `context_id`/`pid` 观察方式；同键串行（队列上限 8）/异键并发；`OAMP_CTX_MAX` LRU + 运行时 notice 提示；关闭即释放、web/agent 重启边界 |
| F06 | 模型参数传递形态与校验；不可用判定（ACP error）与错误面；优先级链（payload>env>config>内置）；审计形态（out 记录 model = 实际生效值）；默认模型可用性取舍（L1-6，§7.5） |
| F07 | 配置文件路径/格式/键；缺失与非法处理；env 名；默认路径相对包根；`data/` 忽略规则；无热重载 |
| F08 | 执行器路由表与默认切换（daemon 默认、显式 one_shot/shell 不变）；既有交互保留清单与既有测试影响面（`web.test.js` 等价重写、其余 10 个不动） |
