# oamp HTTP / SSE 接口文档

面向外部客户端（codex / omp / claude 等）的接入文档：读完本文即可调用本机 oamp web 服务的全部接口，
**不需要读源码**；本文的 `curl` 示例可直接复制执行。

- **服务**：`oamp web start`（内建 HTTP 服务；浏览器不直连 UDS，所有读写都经这层 HTTP API）
- **协议**：HTTP/1.1 + JSON；事件推送为 SSE（`text/event-stream`）
- **真源**：本文逐条映射 `oamp/src/web.js` 的路由表与 `oamp/src/transport.js` 的事件发布点，不另立第二套定义

> 在线接口文档页：<http://127.0.0.1:7788/docs>（字段级结构视图；本文件保留叙述、使用场景与可粘贴示例）

---

## 1. 概览与安全边界

### 1.1 启动与监听地址

```sh
oamp router start          # 终端 1：Router（UDS 监听 + 注册表 + 任务表）
oamp web start             # 终端 2：Web 服务，默认 http://127.0.0.1:7788
oamp agent start demo-1    # 终端 3（可选）：起一个 agent 实例，用于发消息 / 观察上下线
```

| 项 | 值 |
|---|---|
| 监听地址 | `127.0.0.1`（**仅本机回环**） |
| 默认端口 | `7788` |
| 端口覆盖 | 命令行 `--port <n>` 优先于环境变量 `OAMP_WEB_PORT` |
| 就绪信号 | 启动成功后 stdout 打印 `WEB_READY url=http://127.0.0.1:<port>` |
| 对话库 | SQLite，路径由 `OAMP_DB` 决定（默认 `<oamp 包根>/data/sql.db`）；客户端无需直接访问 |

端口非法（非 1~65535 的整数）时启动即报错退出（退出码 2），不会半启动。

### 1.2 统一约定

| 项 | 约定 |
|---|---|
| 请求 Content-Type | 带 JSON 体的接口（`POST /api/messages`、`POST /api/chats/<id>/rename`）请发 `content-type: application/json` |
| 响应 Content-Type | 一律 `content-type: application/json; charset=utf-8`；SSE 为 `text/event-stream; charset=utf-8` |
| 缓存 | 全部响应带 `cache-control: no-store` |
| 时间戳 | `last_heartbeat`、`created_at`、`updated_at`、`archived_at`、`closed_at` **一律为 epoch 毫秒**（UTC 纪元偏移的自然数，与本地时区无关；展示时由客户端自行本地化） |
| 请求体上限 | 64 KiB（65536 字节），超出 → `413` |
| SSE 读法 | 用 `curl -N`（关闭缓冲）才能实时看到帧；浏览器用 `EventSource` 自动重连 |

**SSE 帧格式**（每条事件以空行分隔）：

```
retry: 1000

event: <事件名>
data: <JSON>

: keepalive

```

- 订阅建立后服务端**先写一帧 `retry: 1000`**（毫秒）——浏览器据此在断线后 1s 重连；非浏览器客户端可自行实现等价退避。
- 每 **15s** 写一帧注释心跳 `: keepalive`（无 `event`/`data`）——客户端应**忽略**以 `:` 开头的行，它只用于防中间层空闲断开。
- 事件**不补发**：订阅建立前 / 断开期间发生的事件不会排队重放（详见 §4.3 的重连对齐做法）。

### 1.3 安全边界

- **仅同机**：服务只绑定 `127.0.0.1`，**不做跨机接入**（无对外绑定、无反向代理说明、无 TLS）。
- **零鉴权**：没有 token / API key / Cookie 校验——**本机任何进程都能调用**。请不要把该端口暴露给不可信网络。
- **无 agent 启停接口**：API 面**不存在**启动 / 停止 agent 的路径或参数；agent 生命周期由 CLI（`oamp agent start` 等）在本机负责。
- 越权范围：`POST /api/messages` 的 `!` 前缀会经 agent 在本机执行 shell 命令，模型回答也可能附带工具调用——**调用方必须自行约束输入来源**。

---

## 2. 统一约定与错误契约

### 2.1 成功响应

- 成功响应**就是资源对象本身**（或约定好的结果对象），**不含** `code` 字段；
- 状态码固定 `200`（本 API 面不使用 201/204；`POST` 的成功体同样带 JSON 结果）。

### 2.2 统一错误契约

**每一个 4xx / 5xx 响应体形态完全一致**：

```json
{ "error": "chat 不存在: chat-x", "code": "NOT_FOUND" }
```

| 字段 | 类型 | 语义 |
|---|---|---|
| `error` | string | 人类可读说明（含出错对象标识），可直接展示给用户 |
| `code` | string | 机器码，取自下面的**封闭枚举** |

**状态码映射表**（`code` 与 HTTP 状态码一一对应，每个码只有一个状态码）：

| `code` | HTTP | 语义类别 | 典型触发 |
|---|---|---|---|
| `INVALID_PARAM` | `400` | 请求参数非法 / 缺失 / 请求体格式错误 | 非法过滤值、畸形 JSON 体、缺 `chat_id`、非法 `model` |
| `NOT_FOUND` | `404` | 未知对象 / 未知路径或方法不匹配 | 未知 `chat_id`、未知路径（响应 `not found: <方法> <路径>`） |
| `CONFLICT` | `409` | 对象当前状态不允许该操作 | 已归档 / 已关闭的对话被写、非归档对话被激活 |
| `PAYLOAD_TOO_LARGE` | `413` | 请求体超限（> 64 KiB） | `POST /api/messages` / `/rename` 的超大请求体（响应带 `connection: close`） |
| `UPSTREAM_UNAVAILABLE` | `502` | 上游（Router / 内部故障）不可达 | Router 未启动 / 中途退出（`router 不可达或请求失败: …`） |

**同类错误跨接口一致**：任取两个接口触发同一 `code`（例如 `/rename` 与 `/api/messages` 的只读 409），
响应**键集合相同**（恰好 `error` + `code`）、`code` 相同、HTTP 状态码相同，`error` 形态相同（说明 + 对象标识）。
因此客户端可以只写**一处**错误处理：先看状态码 / `code` 决定重试与否，再把 `error` 展示出去。

> **错误清单的口径**：下文每个接口列出的 `code` 是「该接口在其**正确方法 + 路径**下会出现的全部码」。
> 任意路径与已注册路径不匹配、或对已知路径使用了错误动词，一律走路由兜底：
> `404` `NOT_FOUND` / `not found: <方法> <路径>`。

### 2.3 对象字段

**`chat_id` 形态**：`chat-<uuid>`（由服务端在未指定时生成）或调用方自带的任意非空字符串（自带时须自行保证不与既有对话冲突）。

**对话对象**（列表项 / 详情）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `chat_id` | string | 对话标识 |
| `title` | string | 标题（首条输入前 40 字符，空则 `新对话`；可经 `/rename` 改写） |
| `agent_id` | string \| null | 该对话绑定的 agent |
| `state` | string | `working` / `completed` / `failed` / `closed` |
| `created_at` / `updated_at` | number | epoch ms |
| `archived_at` | number \| null | 归档标记 + 归档时间（`null` = 未归档）；仅列表项与详情共有 |
| `message_count` | number | **仅列表项**：消息条数 |
| `closed_at` | number \| null | **仅详情**：关闭时间 |
| `context_released` | number | **仅详情**：`0`/`1`，上下文是否已释放且未产生新回答 |

**消息对象**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 自增主键（同对话内按 `created_at ASC, id ASC` 排序） |
| `direction` | string | `in`（用户输入）/ `out`（agent 输出）——**只有这两个取值** |
| `agent_id` | string \| null | 该轮目标 agent |
| `text` | string | 消息正文（`!` 命令的正文即命令原文） |
| `model` | string \| null | **out 专用**：ACP 实报的生效模型（不是请求回显）；in 恒为 `null` |
| `duration_ms` | number \| null | **out 专用**：执行耗时；in 恒为 `null` |
| `error` | string \| null | 失败轮次的原因（如 `dispatch_failed`）；成功恒为 `null` |
| `created_at` | number | epoch ms |
| `meta` | object \| null | 实现内部元数据（输入侧为 `{task_id}`；输出侧为 `{context_id, pid}` 或 `null`），客户端可忽略 |

**一次问答恰两条记录**（`in` + `out`）：流式增量、心跳、日志等过程**永不入库**。

**项目对象**（`POST /api/projects` 的成功响应 / `GET /api/projects` 的列表项）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `project_id` | string | 项目标识，形态 `prj-<uuid>`（由服务端生成） |
| `name` | string | 展示名（缺省由仓库地址派生：去尾部斜杠取尾段、再去尾部 `.git`；派生为空 ⇒ 用地址原文） |
| `repo_url` | string | 仓库地址原文（`trim` 后**原样**入库，不归一化；唯一键，重复创建 → `409`） |
| `created_at` | number | epoch ms |
| `chat_count` | number | **仅列表项**：该项目的对话数（含已归档 / 已关闭） |
| `last_activity_at` | number \| null | **仅列表项**：该项目最近一次对话更新时间（`MAX(updated_at)`）；无对话 ⇒ `null` |

**对话必归属项目**：`POST /api/messages` 新建对话时必须带 `project_id`（见 §3.8），`GET /api/chats` 也必须按项目取数（见 §3.2）。

---

## 3. 接口清单（29 条）

| # | 方法 + 路径 | 用途 |
|---|---|---|
| 1 | `GET /api/agents` | 拓扑快照（`?state=online` 只返回在线实例） |
| 2 | `GET /api/chats` | 对话列表（搜索 / 过滤 / 分页） |
| 3 | `GET /api/chats/<chat_id>` | 对话详情（含消息） |
| 4 | `POST /api/chats/<chat_id>/close` | 关闭对话（幂等） |
| 5 | `POST /api/chats/archive` | 批量归档（服务端算范围） |
| 6 | `POST /api/chats/<chat_id>/activate` | 激活归档对话 |
| 7 | `POST /api/chats/<chat_id>/rename` | 重命名对话 |
| 8 | `POST /api/messages` | 发送消息（落库 + 派发） |
| 9 | `GET /api/stream?chat_id=<id>` | 按对话订阅实时事件（SSE） |
| 10 | `GET /api/events` | 全局事件订阅：agent 上线 / 下线（SSE） |
| 11 | `GET /api/docs` | 接口元数据（文档页 / 调试台 / AI 索引文件的数据源） |
| 12 | `GET /api/projects` | 项目列表（含对话数与最近活动时间） |
| 13 | `POST /api/projects` | 创建项目（最小输入 = 仓库地址；重复地址 → 409） |
| 14 | `POST /api/calls` | 发起一次或一批调用（阻塞取终态 / 后台执行） |
| 15 | `GET /api/calls` | 调用 roster（每次调用一行；无过滤 / 无分页 / 无编排） |
| 16 | `GET /api/calls/stream?chat_id=<id>` | 按对话订阅调用事件（SSE） |
| 17 | `GET /api/calls/<call_id>/stream` | 按调用订阅调用事件（SSE） |
| 18 | `GET /api/calls/<call_id>/transcript` | 按调用取转录（进程内，不持久） |
| 19 | `GET /api/calls/<call_id>` | 按调用取终态（进行中给状态） |
| 20 | `GET /api/confirmations` | 在途确认项列表（跨对话；进程内，不持久） |
| 21 | `POST /api/confirmations/<confirmation_id>/decision` | 提交确认项裁决（选项 + 可选文本；随即移出在途表并回传） |
| 22 | `GET /api/subscribe` | 实时订阅（按事件类型 / agent 过滤；SSE） |
| 23 | `GET /api/pickup` | 未取件的终态结果（离线也不丢结论） |
| 24 | `POST /api/pickup/<call_id>/ack` | 取件确认（幂等） |
| 25 | `GET /api/calls/wait` | 等待一组调用达到终态（一次调用即返回） |
| 26 | `POST /api/calls/<call_id>/cancel` | 取消调用（幂等；已终态调用不改状态） |
| 27 | `GET /api/health` | 恢复判据（router / web / agents 三问 + 可调用结论） |
| 28 | `POST /api/principals` | 注册客户端身份（幂等） |
| 29 | `GET /api/principals/<principal_id>` | 查询客户端身份 |

> 非 API 面的静态资源（`/`、`/app.js`、`/style.css`）不在错误契约范围内：静态面只按固定文件名提供（不做路径拼接），路径穿越类请求落 404 兜底（`{"error":"not found: …","code":"NOT_FOUND"}`）。

---

### 3.1 `GET /api/agents`

在线 agent 列表（Router 拓扑快照，按 `instance_id` 升序；缺省含离线墓碑，在线口径见 `?state=online`）。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `state` | string | 否 | 无 | **只接受 `online`**：只返回在线实例（与网页顶栏列表同一口径）。省略 / 传空 = 返回全部，**含 `offline` 墓碑** |

**成功响应** `200`

```json
{
  "agents": [
    {
      "instance_id": "demo-1",
      "session_id": "503f52de-77a4-43b1-acc4-227c2d81e113",
      "state": "online",
      "last_heartbeat": 1789184738463,
      "role": null
    }
  ]
}
```

- 无参时**逐字透传** Router 快照，含两类记录：**在线**（`state: "online"`）与**判活超时被判离线的墓碑**（`state: "offline"`，保留最后一次的 `session_id`，直到该实例重新注册）。**优雅注销不保留记录**——agent 主动退出（`agent.deregister`）时该实例直接从列表消失。因此无参列表无法区分「从未注册」与「已注销」；只关心在线实例请用 `?state=online`。
- 列表里可能还出现 **`instance_id` = `web` 的节点**——那是 web 进程自身的常驻发送方身份（它在本进程**首次派发消息 / 控制通知时**注册，随后按心跳保活）。客户端按实例做业务判断时应排除它。
- `state` 取值只有 `online` / `offline`；`last_heartbeat` 为 epoch ms。
- **`role` 字段（0018 新增）**：该节点**可被调用面按角色名寻址**时给出角色名，否则为 `null`。语义 = 由既有实例命名关系推导（实例名可反解为角色名**且**该角色的角色文件存在）；`null` 表示该实例**不被当作可寻址角色**（例如控制台自身的 `web` 节点、`dev-1` 一类非该形态的实例名）。示例里的 `demo-1` 因此是 `null`。
  推导规则只有实现里的**一处**（`roleOfInstance` 复用的既有绑定模块），接口面**不**引入第二套发现优先级链；调用面用 `agent: "<角色名>"` 寻址命中的就是 `role` 非 `null` 的这类节点。
- `?state=online` 与无参响应**同形状**（只是逐项过滤），不新增 / 不改动字段。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | `state` 传了 `online` 以外的非空值 | `查询参数非法: state 需为 online（当前值 "x"）` |
| `UPSTREAM_UNAVAILABLE` | 502 | Router 未启动 / 中途退出 | `router 不可达或请求失败: connect ENOENT …` |

---

### 3.2 `GET /api/chats`

对话列表（默认排除已归档）。全部过滤条件之间是 **AND** 关系。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `project_id` | string | **是** | — | 对话列表以项目为范围：只返回该项目的对话。**缺参与空值（`?project_id=`）都 → 400**（不沿用"空值 = 无参"语义）；指向未知项目 ⇒ `200` 空列表（不做存在性判定） |
| `q` | string | 否 | 无 | 关键词：匹配**标题**或**任意消息正文**（子串匹配；`%` / `_` / `\` 按字面量转义） |
| `agent` | string | 否 | 无 | 只列该 agent 相关（对话的 `agent_id` 命中，或该对话中存在该 agent 的消息） |
| `state` | string | 否 | 无 | 对话状态：`working` / `completed` / `failed` / `closed` 之一 |
| `from` | integer | 否 | 无 | `updated_at >= from`（epoch ms） |
| `to` | integer | 否 | 无 | `updated_at <= to`（epoch ms）；须 `from <= to` |
| `archived` | integer | 否 | `0` | 已归档过滤，**合法值只有 `0` / `1`**：`0` = **排除**已归档（主列表）、`1` = **只看**已归档（按归档时间倒序）；其它值 → 400 |
| `limit` | integer | 否 | `50` | 每页条数，`1..200` |
| `offset` | integer | 否 | `0` | 偏移，非负整数 |

排序：`archived=0` 按 `updated_at DESC`；`archived=1` 按 `archived_at DESC`；同序时按 `chat_id DESC`。

**成功响应** `200`

```json
{
  "chats": [
    {
      "chat_id": "chat-demo-shell",
      "title": "!echo hello-oamp",
      "agent_id": "demo-1",
      "state": "completed",
      "created_at": 1789184746362,
      "updated_at": 1789184746372,
      "archived_at": null,
      "message_count": 2
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

`total` 是**过滤条件下的命中总数**（不受分页影响）；`limit` / `offset` 回显实际生效值。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | **缺 / 空 `project_id`**；`limit` 非 `1..200` 整数（含非数字）；`offset` 非非负整数；`archived` 非 `0\|1`；`state` 非法枚举；`from` / `to` 非毫秒整数；`from > to`；`q` / `agent` 类型不符 | `查询参数非法: project_id 不能为空（对话列表以项目为范围）` / `查询参数非法: <参数> …（当前值 …）` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

> `?limit=abc` 这类**非数字**取值会被判非法（`Number('abc')` → 非整数），响应 400 —— 不会静默回退默认值。

---

### 3.3 `GET /api/chats/<chat_id>`

对话详情（含消息，按 `created_at ASC, id ASC`）。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `chat_id` | string | 是 | — | 目标对话 id（在**路径**中，按 URI 解码） |

**成功响应** `200`

```json
{
  "chat": {
    "chat_id": "chat-demo-shell",
    "title": "!echo hello-oamp",
    "agent_id": "demo-1",
    "state": "completed",
    "created_at": 1789184746362,
    "updated_at": 1789184746372,
    "closed_at": null,
    "archived_at": null,
    "context_released": 0
  },
  "messages": [
    {
      "id": 1,
      "direction": "in",
      "agent_id": "demo-1",
      "text": "!echo hello-oamp",
      "model": null,
      "duration_ms": null,
      "error": null,
      "created_at": 1789184746362,
      "meta": { "task_id": "task-6d034e35-ffc9-4c85-8395-f570535a9f08" }
    },
    {
      "id": 2,
      "direction": "out",
      "agent_id": "demo-1",
      "text": "hello-oamp",
      "model": null,
      "duration_ms": 5,
      "error": null,
      "created_at": 1789184746372,
      "meta": null
    }
  ]
}
```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | 未知 `chat_id` | `chat 不存在: <chat_id>` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

---

### 3.4 `POST /api/chats/<chat_id>/close`

关闭对话：置为 `closed`（只读、拒绝新输入）、**不删数据**，并 best-effort 通知相关 agent 释放该对话的常驻上下文。

**参数**：无（无请求体）。

**成功响应** `200`（**幂等**）

```json
{ "chat_id": "chat-demo-1", "state": "closed" }
```

已处于 `closed` 的对话直接返回同一响应，**不重复**发上下文释放通知。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | 未知 `chat_id` | `chat 不存在: <chat_id>` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

---

### 3.5 `POST /api/chats/archive`

批量归档：服务端一次算出候选集（**未归档且非进行中**的全部对话，不受分页限制），逐条独立提交。

**参数**：无（无请求体）。

**成功响应** `200`

```json
{ "archived": 2, "failed": 0, "failed_ids": [] }
```

- `archived`：归档成功的条数；`failed_ids`：失败项（其 `archived_at` 仍为 `null`，留在主列表可重试）。
- 归档**不改变**对话的 `state`，只是加归档标记并置上下文已释放位；被归档的对话随即只读。
- 对每个成功归档的对话 best-effort 通知相关 agent 释放上下文（agent 离线则忽略）。
- 该接口**不推送 SSE**（归档不改 `state`）；可见性由响应 + 客户端重新拉列表承担。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

---

### 3.6 `POST /api/chats/<chat_id>/activate`

激活一条**已归档**对话：移除归档标记 + 状态还原（`closed` → `completed` 并清除关闭时间）+ 置顶主列表（`updated_at` 刷新）。
**不恢复**此前释放的常驻上下文。

**参数**：无（无请求体）。

**成功响应** `200`

```json
{ "chat_id": "chat-demo-1", "state": "completed" }
```

同时向该对话的订阅者推送 `chat_state` 事件。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | 未知 `chat_id` | `chat 不存在: <chat_id>` |
| `CONFLICT` | 409 | 对话**未归档**（含 `closed` 但未归档——重开只走「归档 → 激活」这一条路径） | `chat 未归档，无法激活` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

---

### 3.7 `POST /api/chats/<chat_id>/rename`

重命名对话：**只写 `title` 一列**（不动 `updated_at` / `agent_id` / `state` / `archived_at`，因此列表位置不变）。

**请求体**

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `title` | string | 是 | — | trim 后存储；非空、长度 ≤ 100（UTF-16 code unit） |

**成功响应** `200`

```json
{ "chat_id": "chat-demo-2", "title": "演示对话" }
```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 请求体非合法 JSON；`title` 非字符串 / 全空白 / 超 100 字符 | `请求体非法 JSON: …` / `标题非法: 不能为空或全为空白` / `标题非法: 长度需 <= 100（当前 N）` |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体 > 64 KiB（响应带 `connection: close`） | `请求体过大（上限 65536 字节）` |
| `NOT_FOUND` | 404 | 未知 `chat_id` | `chat 不存在: <chat_id>` |
| `CONFLICT` | 409 | 对话只读：已归档 / 已关闭 | `chat 已归档（只读），不可改名` / `chat 已关闭（只读），不可改名` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

> 处理顺序固定：**读体（400/413）→ 预检 404 → 只读预检 409 → 写口（400/409）→ 200**。

---

### 3.8 `POST /api/messages`

发送一条消息：先落库（`in` 记录 + 对话置 `working`），再派发给目标 agent。**立即返回**，回答经 SSE 或 `GET /api/chats/<id>` 获取。

**请求体**

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `chat_id` | string | 否 | 自动生成 `chat-<uuid>` | 目标对话；不存在则新建（`title` 取正文前 40 字符） |
| `project_id` | string | **新建对话时必填** | 无 | 新建对话的归属项目（须已存在，用 `POST /api/projects` 创建）。**已有对话 ⇒ 该字段不参与判定**（归属不可变）；校验插在既有参数校验之后、落库之前 |
| `agent_id` | string | 条件必填 | 无 | 目标 agent 实例 id；**省略时**从 `text` 的 `@agent 正文` 前缀解析 |
| `text` | string | 是 | — | 消息正文（trim 后不得为空）；以 `!` 开头 ⇒ 走 shell 执行 |
| `model` | string | 否 | 无（用默认模型链） | 须匹配 `^[A-Za-z0-9._/-]{1,128}$` |
| `one_shot` | boolean | 否 | `false` | `true` ⇒ 一次性执行（不累积上下文）；`false`/缺省 ⇒ 常驻上下文 |

**执行路径判定顺序**（`text` 去 `@agent ` 前缀后判定）：`!` 开头 → shell；否则 `one_shot: true` → 一次性 omp；否则 → 常驻上下文 omp-daemon。

**成功响应** `200`

```json
{
  "chat_id": "chat-demo-1",
  "task_id": "task-ff43186d-fe02-499e-9382-c509ca70cd79",
  "message_id": "msg-2d515f9b-2073-4aab-b9f5-7031940e4f0a",
  "warning": null
}
```

- `message_id`：**派发信封 id**（`msg-<uuid>`）——它随 `task.request` 发给 agent，用于链路追踪；**不是库内消息 id**。库内自增 id 见 `GET /api/chats/<id>` 的 `messages[].id`（即 `message` SSE 事件里的 `message.id`）。
- `warning`：`null` = 派发成功；非 null（**状态码仍为 200**）= 派发失败，已落库一条失败的 `out` 记录，例如：

```json
{
  "chat_id": "chat-demo-warn",
  "task_id": null,
  "message_id": "msg-78212e8b-abd4-4b7c-93b4-9882955f3b3b",
  "warning": "派发失败（AGENT_OFFLINE）——消息已记录，agent 恢复后可重发"
}
```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 请求体非合法 JSON；既无 `agent_id` 也无 `@agent ` 前缀；正文 trim 后为空；`model` 不匹配形态；**新建对话时缺 / 空 `project_id` 或指向未知项目** | `请求体非法 JSON: …` / `需要指定目标 agent（输入 @agent 或提供 agent_id）` / `消息不能为空` / `model 非法（需匹配 /^[A-Za-z0-9._/-]{1,128}$/）` / `新对话需要 project_id（对话必须归属一个项目）` / `项目不存在: prj-x` |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体 > 64 KiB（响应带 `connection: close`） | `请求体过大（上限 65536 字节）` |
| `CONFLICT` | 409 | 目标对话只读：已归档 / 已关闭（**已有对话**才触发；新 `chat_id` 直接新建） | `chat 已归档（只读），不接受新输入` / `chat 已关闭，不接受新输入` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

> **派发失败不是 HTTP 错误**：`task_id: null` + `warning` 的非空字符串，状态码仍 `200`（业务结果而非传输错误）。

---

### 3.9 `GET /api/stream?chat_id=<id>`

按对话订阅实时事件（SSE）。响应 `200` + `text/event-stream`，连接保持，直到客户端断开（或 web 进程退出；对话关闭**不会**断开订阅——订阅端会收到一帧 `chat_state: closed`）。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `chat_id` | string | **是** | — | 目标对话；**缺参 / 空值直接 400**（本路径不做全局订阅，全局订阅见 3.10） |

**成功响应** `200`（SSE 流；事件清单见 §4.1）

```
retry: 1000

event: chat_state
data: {"chat_id":"chat-demo-1","state":"working"}

```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 缺 `chat_id` 或为空 | `需要 chat_id（不做全局订阅）` |

> 该接口不查询上游 Router，因此 Router 不可达时**依然**能建立订阅（`200`）——只是不会再收到新事件。

---

### 3.10 `GET /api/events`

全局事件订阅（SSE）：观察 **agent 上线 / 下线**。无参数、不依赖任何对话。

**参数**：无。

**成功响应** `200`（SSE 流；事件清单见 §4.2）

```
retry: 1000

event: agent_online
data: {"instance_id":"demo-2","last_heartbeat":1789184787786}

```

**错误**：无（订阅建立不查询上游；Router 不可达时订阅仍 `200`，但不会有事件到达）。

---

### 3.11 `GET /api/docs`

接口元数据（机器可读的登记投影）：`/docs` 文档页与 `/debug` 调试台的数据源，也是本接口面自身的清单。
每次请求都从路由登记现算（**不缓存、不预快照**）——登记变化在服务重载后立刻反映在响应里。

**参数**：无。

**成功响应** `200`

```
{ "routes": [ { "method": …, "path": …, "kind": …, "summary": …, "params": [ … ], "response": …, "errors": [ … ], "danger": …, "docLink": … } ] }
```

- `routes`：**全部已登记接口**的元数据数组，顺序 = 路由表的匹配优先级；除本接口自身外，其余条目与 §3.1~§3.13 一一对应。
- 九个字段的语义：`method` / `path`（方法与路径模式，路径参数段写作 `:name`）；`kind`（`json` | `sse`，决定调试台渲染发送区还是订阅区）；`summary`（一句话说明）；`params`（路径 / 查询 / 请求体三种位置的字段元数据，元素含 `name` / `in` / `type` / `required` / `desc`，取值封闭时可带 `enum`）；`response`（成功响应的形态说明，不含示例报文）；`errors`（该接口**显式产生**的错误码，取 §2.2 的码集合）；`danger`（由 `method !== 'GET'` 派生：`true` = 会改变状态）；`docLink`（指向本文对应章节的相对 URL）。
- 字段级结构视图（含逐参数表格）见 `/docs`；**本文件不复制该字段表**。

**错误**：无（本接口不显式产生任何错误码；全局兜底 `502` 见 §2.2）。

---

### 3.12 `GET /api/projects`

项目列表（含两个派生列：对话数与最近活动时间）。**无参数、无分页**，响应不含 `total`。

**参数**：无。

**成功响应** `200`

```json
{
  "projects": [
    {
      "project_id": "prj-2c1de5b0-6a1f-4a7e-9a0e-0d1b6f9cd2a1",
      "name": "demo",
      "repo_url": "https://github.com/acme/demo.git",
      "created_at": 1789184738463,
      "chat_count": 2,
      "last_activity_at": 1789184761395
    }
  ]
}
```

- 排序：`created_at DESC, project_id DESC`（新建的项目落在首行）。
- `chat_count` 计入该项目下**全部**对话（含已归档 / 已关闭）；`last_activity_at` 取该项目对话 `updated_at` 的最大值，**无对话时为 `null`**（不是 `0`，客户端展示占位即可）。

**错误**：无（本接口不显式产生任何错误码；全局兜底 `502` 见 §2.2）。

---

### 3.13 `POST /api/projects`

创建项目。**最小输入 = 仓库地址**（不校验形态 / 域名 / 可达性）；同一地址重复创建 → `409`。

**请求体**

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `repo_url` | string | **是** | — | 仓库地址；`trim` 后非空即合法。唯一键 = `trim` 后**原样**字符串：`.git` / 尾斜杠 / 大小写 / SSH↔HTTPS 均**不**判等价（`…/demo` 与 `…/demo.git` 可各自创建） |
| `name` | string | 否 | 由地址派生 | 展示名；缺省 / 空 / 非字符串 ⇒ 派生 = 地址去尾部斜杠取尾段、再去尾部 `.git`；派生为空 ⇒ 兜底用地址原文 |

**成功响应** `200`

```json
{ "project": { "project_id": "prj-2c1de5b0-6a1f-4a7e-9a0e-0d1b6f9cd2a1", "name": "demo", "repo_url": "https://github.com/acme/demo.git", "created_at": 1789184738463 } }
```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 请求体非合法 JSON；`repo_url` 缺失 / 空 / 非字符串 | `请求体非法 JSON: …` / `需要 repo_url（非空字符串）` |
| `CONFLICT` | 409 | 同一 `repo_url`（`trim` 后原样比较）已存在 | `项目已存在: https://github.com/acme/demo.git` |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体 > 64 KiB（响应带 `connection: close`） | `请求体过大（上限 65536 字节）` |
| `UPSTREAM_UNAVAILABLE` | 502 | 内部故障兜底 | `router 不可达或请求失败: …` |

---

### 3.14 `POST /api/calls`

发起**一次或一批调用**（0018 新增的调用面入口）。与 §3.8 的分工：`POST /api/messages` 是对话入口，**永不阻塞、永不直接返回结果、派发失败仍 `200` + `warning`**（该契约逐字不变）；本接口是「一次调用」的交付面——按**角色名**寻址、可挂共享说明与期望结构、可**阻塞取终态**，失败表达成明确的 4xx/5xx。

**请求体**

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `chat_id` | string | **是** | — | 调用**归属**：必须指向**已存在**的对话（调用面不新建对话）。未提供 / `null` / 空串 / 非字符串同判 → `400` |
| `agent` | string | **是** | — | **角色名**（如 `dev`）——不是实例名。解析 = 由角色名推出的实例名可反解回该角色（角色文件存在）；「不可解析 / 离线 / 不存在」三种情形**不区分** → `404` + 同一文案 |
| `task` | string | 条件必填 | — | 任务文本（`trim` 后不得为空）；与 `tasks` **互斥**。以 `!` 开头时按**普通文本**处理（本面不走 shell） |
| `tasks` | array | 条件必填 | — | 批量形态：每项 `{task, output_schema?, schema_mode?, mode?, model?}`；**每项 = 一个独立调用**（各得一个 `call_id`）；空数组 / 非数组 → `400` |
| `context` | string | 否 | 无 | **本次调用的共享说明**（`trim` 后非空才生效）：作为独立区块**前置**装配，不污染任务文本；批量提交时对各项共享生效 |
| `output_schema` | object | 否 | 无 | **期望的返回结构**（受限子集，见下）；形态超出子集 → `400` |
| `schema_mode` | string | 否 | `permissive` | `permissive` / `strict`；`strict` 且终态结构未通过校验 ⇒ `state` 为 `failed`、`error` 为 `structured_output_invalid` |
| `mode` | string | 否 | `background` | `background`（立即受理）/ `block`（响应挂起至终态，不设人为上限） |
| `model` | string | 否 | 无（既有默认模型链） | 须匹配 `^[A-Za-z0-9._/-]{1,128}$`；非法 → `400` |

未声明的字段**忽略**（与 §3.8 同口径）。

**`output_schema` 的受限子集**（受理时校验；超出即 `400`，**不静默忽略**）：

```
output_schema = { type?: "object", properties?: { "<名>": { "type": <7 种之一> } }, required?: ["<名>"…] }
type ∈ { object, array, string, number, integer, boolean, null }
```

- 只认这三个键：出现 `$ref` / `oneOf` / `anyOf` / `allOf` / `items` / `format` / `pattern` / 嵌套 `properties` 等一律 `400`。
- `required` 的每个名字必须出现在 `properties` 中；`properties` 每个属性的对象**只**允许 `type` 一个键。

**共享说明与任务文本的装配**（`context` 与任务文本互不覆盖、不合并）：

```
【调用共享说明】          ← 仅当提供 context 时存在（独立区块，前置）
<context 原文>

<task 原文>               ← 逐字保留（无前缀污染；label 取本段前 60 字符）

【返回格式要求】          ← 仅当提供 output_schema 时存在（后置）
请仅输出一个 JSON 对象，满足以下结构（不要输出 JSON 以外的内容）：
<output_schema 的规范 JSON 字符串>
```

**成功响应** `200` —— 一律 `{ calls: [...] }`，顺序 = 请求顺序（单项即 1 元素）；每个元素是一个**调用信封**（形状与字段表见 §3.19）：

```json
{
  "calls": [
    {
      "call_id": "task-ff43186d-fe02-499e-9382-c509ca70cd79",
      "agent": "dev",
      "state": "submitted",
      "duration_ms": null,
      "model": null,
      "truncated": false,
      "text": null,
      "structured_output": null,
      "error": null,
      "exit_code": null
    }
  ]
}
```

- 后台项（`mode` 缺省）`state` 为 `submitted`；阻塞项（`mode: "block"`）= **终态信封**（`state` 为 `completed` / `failed`）。两者**同一信封形状**。
- **批量**：一次提交两项 ⇒ 两个互不相同的 `call_id`，`GET /api/calls/<call_id>` 各自可查（每项 = 一个独立调用）。
- 本接口的每次调用**同时是所属对话的一次问答**：对话侧照常落一条 `in` 与（终态时）一条 `out`，并推送既有 `message` / `chat_state` 事件；归属可用 `GET /api/chats/<chat_id>` 的 `messages[].meta.task_id` 与 `call_id` 关联核对。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 请求体非合法 JSON；`chat_id` 缺失 / 空 / 非字符串；`chat_id` 指向不存在的对话；`agent` 缺失 / 空；`task` 与 `tasks` 同给或都缺；`tasks` 非数组 / 空数组 / 某项缺 `task`；`mode` 或 `schema_mode` 枚举外；`output_schema` 超出受限子集；`model` 形态非法；`context` 非字符串 | `请求体非法 JSON: …` / `需要 chat_id（调用必须归属一个已存在的对话）` / `chat 不存在: chat-x` / `需要 agent（角色名，如 dev）` / `需要 task（任务文本，trim 后不得为空）或 tasks（非空数组）` / `task 与 tasks 互斥（一次提交只用一种形态）` / `tasks 需为非空数组（每项 = 一个独立调用）` / `mode 非法（需为 background / block）` / `schema_mode 非法（需为 permissive / strict）` / `output_schema 非法（仅支持受限子集：type / properties / required，且 type 取 7 种之一）` / `model 非法（需匹配 /^[A-Za-z0-9._/-]{1,128}$/）` / `context 需为字符串（本次调用的共享说明）` |
| `NOT_FOUND` | 404 | 角色不可按角色名寻址（角色文件不存在），或派发时该角色无在线实例（两种情形同一文案、同一状态码） | `agent 不可用: <角色名>（无对应在线实例）` |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体 > 64 KiB（响应带 `connection: close`） | `请求体过大（上限 65536 字节）` |
| `UPSTREAM_UNAVAILABLE` | 502 | 派发失败（首项之外的其它原因）；内部故障兜底 | `调用派发失败: <原因>` / `router 不可达或请求失败: …` |

- **判定先于写入**：归属 / 目标 / 入参形态三类校验全部完成前，不写库、不登记、不派发 ⇒ **`INVALID_PARAM` 与「角色不可寻址」（`agent` 不是可寻址的角色名）两类**失败请求**零副作用**（`GET /api/calls` 无新增行、对话消息数不变）；**「角色可解析但当前离线」不在这条表述的范围内**——那条路径派发失败时仍按既有行为在对话侧补 1 条 `in` + 1 条 `out`（`error: "dispatch_failed"`，见下条），只是不创建调用（`GET /api/calls` 无新增行）。
- 首项派发失败（角色离线 / 不存在）⇒ `404` 且**零调用被创建**；首项成功、后续项失败（竞态窗口）⇒ `502`，**已派出的项保留**（可从 `GET /api/calls` 查回其 id）。派发失败时对话侧仍按 §3.8 的既有行为补一条 `out`（`error: "dispatch_failed"`）——调用面只是**额外**把失败表达成明确的 4xx/5xx，不再吞成「200 + warning」。
- 调用面对**已归档 / 已关闭**的对话不做只读判定（归属只要求「对话存在」）；只读语义仍只由 §3.8 / §3.7 承担。

---

### 3.15 `GET /api/calls`

调用 **roster**：每次调用一行（**展示面**，不是编排面）。**无参数、无分页、无排序选项**。

**参数**：无。

**成功响应** `200`

```json
{
  "calls": [
    {
      "call_id": "task-ff43186d-fe02-499e-9382-c509ca70cd79",
      "agent": "dev",
      "state": "completed",
      "started_at": 1789184738463,
      "ended_at": 1789184740999,
      "model": "deepseek/deepseek-v4-flash"
    }
  ]
}
```

- 六列固定：`call_id`（= 既有 `task_id`）、`agent`（角色名；不可解析 → `null`）、`state`（终态单一真源：任务记录原值 + `schema_mode: "strict"` 且终态结构未通过时的 `failed` 覆写，封闭词表 `submitted` / `working` / `completed` / `failed`）、`started_at`（受理时刻）、`ended_at`（**终态时**为进入终态的时刻，**进行中为 `null`**；终态时必 `>= started_at`）、`model`（终态 = 执行侧实报的生效模型；**进行中为 `null`**，不显示推测值）。
- 排序：`created_at` 倒序（新调用在前）。
- **范围**：只列本 hub 派发的调用（调用面 + 既有对话入口）；CLI（`oamp task *`）派发的任务**不出现**——那类任务没有对话归属。
- 列表**不含**执行开销类派生列（成因与核对方式见 §7.3 第 ⑭ 条）。

**错误**：无（本接口不显式产生任何错误码；全局兜底 `502` 见 §2.2）。

---

### 3.16 `GET /api/calls/stream?chat_id=<id>`

订阅**该对话**的调用事件流（SSE）。**先订阅、再发起**的载体：订阅之后才发起的调用，其事件照样到达（订阅之前发生的事件**不补发**）。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `chat_id` | string | **是** | — | 目标对话；**缺参 / 空值直接 400**（本路径不做全局调用订阅） |

**成功响应** `200`（SSE 流；三类事件见 §4.4）

```
retry: 1000

event: call_result
data: {"chat_id":"chat-demo-1","call_id":"task-…","agent":"dev","state":"completed","duration_ms":2999,"model":"deepseek/deepseek-v4-flash","truncated":false,"text":"…","structured_output":null,"error":null,"exit_code":0}

```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | 缺 `chat_id` 或为空 | `需要 chat_id（不做全局调用订阅）` |

> 该接口不查询上游 Router，因此 Router 不可达时**依然**能建立订阅（`200`）——只是不会再收到新事件。

---

### 3.17 `GET /api/calls/<call_id>/stream`

订阅**单次调用**的事件流（SSE）。两次并发调用只订阅其中一次 ⇒ 事件不混入。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `call_id` | string | **是** | — | 目标调用 id（= `task_id`）；**不存在 → 404**（且不建立订阅） |

**成功响应** `200`（SSE 流；三类事件见 §4.4）

```
retry: 1000

event: call_update
data: {"chat_id":"chat-demo-1","call_id":"task-…","agent":"dev","kind":"chunk","text":"…"}

```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | `call_id` 不存在（含 Router / web 重启后，见 §3.18 的「不持久」说明） | `call 不存在: task-…` |

---

### 3.18 `GET /api/calls/<call_id>/transcript`

按调用 id 取**转录**：从发起到终态的过程记录（**含终态那一次事件**）。**进程内可读、不持久**。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `call_id` | string | **是** | — | 目标调用 id（= `task_id`）；不存在（含重启后）→ `404` |

**成功响应** `200`

```json
{
  "call_id": "task-ff43186d-fe02-499e-9382-c509ca70cd79",
  "agent": "dev",
  "state": "completed",
  "truncated": false,
  "entries": [
    { "at": 1789184738500, "from": "pb-dev", "state": "working", "detail": { "state": "working", "event": "started", "executor": "omp-daemon", "chat_id": "chat-demo-1", "model": "deepseek/deepseek-v4-flash" } },
    { "at": 1789184739000, "from": "pb-dev", "state": "working", "detail": { "state": "working", "kind": "chunk", "text": "…" } },
    { "at": 1789184740999, "from": "pb-dev", "state": "completed", "detail": { "event": "result", "state": "completed", "text": "…", "model": "deepseek/deepseek-v4-flash", "duration_ms": 2999 } }
  ]
}
```

- `entries` = 任务记录里既有的过程条目**原样**透出（`{at, from, state, detail}` 四键，`detail` 不裁剪）；终态时**末尾追加一条** `detail.event` 为 `result` 的终态条目。**进行中的调用同样可读**（返回已有条目，不追加终态条目，也不报「未完成」错误）。
- **末条终态条目的两处 `state` 刻意区分（不是漂移）**：`entries` 末尾条目的 `state` 反映**该调用的终态**（含 `schema_mode: "strict"` 未通过时的 `failed` 覆写，与 §3.19 信封同真源）；其 `detail` 仍是**执行侧原样终态体**（`detail.state` 为执行侧原值，如 `completed`）——外层表达调用终态，`detail` 保留执行原始事实。
- `truncated`：本次调用的**过程记录**是否被既有上限截断（上限不变、不由本接口引入）；与 §3.19 信封的 `truncated` **同一口径、同一真源**。
- **不持久**：转录是 Router 进程内的既有任务记录，不落库、不跨重启——Router 或 web 重启后旧 `call_id` 一律 `404`（明确的「不存在」，不是 5xx、也不是伪造内容）。既有「过程不入库」的声明不被推翻。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | `call_id` 不存在（含重启后） | `call 不存在: task-…` |

---

### 3.19 `GET /api/calls/<call_id>`

按调用 id 取**终态**；调用**进行中**时返回同一形状的状态（不报错、不空响应）。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `call_id` | string | **是** | — | 目标调用 id（= `task_id`）；不存在（含重启后）→ `404` |

**成功响应** `200` —— **调用信封**（受理 / 进行中 / 终态三态共用同一形状，也是 §3.14 响应里 `calls[]` 的元素）：

```json
{
  "call_id": "task-ff43186d-fe02-499e-9382-c509ca70cd79",
  "agent": "dev",
  "state": "completed",
  "duration_ms": 12345,
  "model": "deepseek/deepseek-v4-flash",
  "truncated": false,
  "text": "…",
  "structured_output": null,
  "error": null,
  "exit_code": 0
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `call_id` | string | 调用 id = 既有 `task_id`（形态 `task-<uuid>`；**不**引入第二套标识，也没有父子 / 血缘命名） |
| `agent` | string \| null | 角色名；不可解析时 `null` |
| `state` | string | 封闭词表：`submitted` / `working` / `completed` / `failed` |
| `duration_ms` | number \| null | 终态可得；非终态 `null` |
| `model` | string \| null | 终态 = 执行侧**实报**的生效模型；非终态 `null`（不填请求参数、也不填推测值） |
| `truncated` | boolean | 过程记录是否被既有上限截断（与 §3.18 同一口径） |
| `text` | string \| null | 终态产出的原文；失败且无文本时 `null` |
| `structured_output` | object \| null | 带 `output_schema` 且终态校验通过时的对象；否则 `null`（不带 `output_schema` 时恒 `null`，只交付 `text`） |
| `error` | string \| null | `failed` 且执行侧 / 校验侧给出机器可读原因时给出（校验侧如 `structured_output_invalid`）；否则 `null`。**shell / 一次性失败以 `exit_code` 表达，此时 `error` 为 `null`** |
| `exit_code` | number \| string \| null | 常驻（`omp-daemon`）执行**成功** = `0`；常驻执行**失败** / 不可得 = `null`；shell / 一次性执行路径 = 进程真实退出码（被信号终止时为信号名 / `killed`）。`schema_mode: "strict"` 的结构覆写只改 `state` / `error`，不改执行侧退出码 |

- `state` 与 §3.15 的 `state` **同真源**（同一任务记录 + `schema_mode: "strict"` 未通过时的 `failed` 覆写），两处不会漂移。
- 信封**不含** `chat_id`（任务记录没有该字段）——归属核对请走 `GET /api/chats/<chat_id>` 的 `messages[].meta.task_id`（§3.14 已说明）。
- 信封的键集合是**封闭的 10 键**（上表）；SSE 的 `call_result` 帧 = 该信封 + `chat_id`（**11 键**，见 §4.4）——参照契约里那几类本仓库拿不到的字段在这里**不提供**：**无数据源，不造假、不估算**（见 §7.3 第 ⑧ 条）。

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `NOT_FOUND` | 404 | `call_id` 不存在 | `call 不存在: task-…` |

**`structured_output` 的校验口径**（`output_schema` / `schema_mode` 的落地）：

- 终态时从 `text` 提取：整体 `JSON.parse`；失败则剥离**一层**三重反引号围栏（含 `json` 语言标注）后重试；仍失败 = `null`。
- 提取成功后再按受限子集做三层校验（`type` / `required` / `properties.<名>.type`；**未声明键不判错**）：通过 ⇒ `structured_output` = 该对象（`text` 仍保留原文）；未通过 ⇒ `structured_output` = `null`。
- `schema_mode: "permissive"`（默认）：未通过**不影响**终态，`text` 照样交付（「退回文本且不报错」）。
- `schema_mode: "strict"`：未通过 ⇒ `state` 为 `failed`、`error` 为 `structured_output_invalid`（**不新增终态词**，词表仍是 `completed` / `failed` + `exit_code`）。

---

### 3.20 `GET /api/confirmations`

在途确认项列表（**重建入口**）：返回当前**全部未裁决**的确认请求。数据源 = web 进程内内存表（不落库、不持久，
重启即清空），不查 Router、不读库 ⇒ **无错误面**（空态返回 `[]`，不 `404`）。**本接口不发任何帧**：
刷新 / 断线重连后重建列表不会重复通知（通知只由「首次入库」那一刻的一帧承担）。

**参数**

无。

**成功响应** `200`

```json
{
  "confirmations": [
    {
      "confirmation_id": "cfm-8f14e45f-ceea-467e-9b1e-2a1b0a3f9d21",
      "request_kind": "permission",
      "chat_id": "chat-6f1c0b4e-1f5f-4a2b-9f0e-6af0f1cf2c33",
      "agent_id": "pb-dev",
      "tool": "bash",
      "title": "echo L1-2-PROBE",
      "options": [
        { "option_id": "allow_once", "label": "允许一次" },
        { "option_id": "allow_always", "label": "总是允许" },
        { "option_id": "reject_once", "label": "拒绝一次" },
        { "option_id": "reject_always", "label": "总是拒绝" }
      ],
      "multiple": false,
      "created_at": 1757750400000
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `confirmation_id` | string | 确认项 id（上游 agent 侧生成的关联 id；裁决回传的作用域锚点） |
| `request_kind` | `"permission"` \| `"question"` | 确认项类别：`"question"` = 提问（作答走 `option_ids` + 自由文本）；缺字段 / 非字符串 / 域外值一律兜底 `"permission"`（既有审批面） |
| `chat_id` | string \| null | 来源对话（可辨识来源；`permission` 类裁决文本非空时按此追加输入） |
| `agent_id` | string \| null | 发起该确认请求的 agent 实例 id（裁决回传的收件方） |
| `tool` | string \| null | 承载名：`permission` 类 = 请求放行的工具名；`question` 类 = 提问承载（`ask_user` / `ask`，未知为 `null`） |
| `title` | string \| null | 展示正文：`permission` 类 = 该次工具调用的动作描述；`question` 类 = 问题文本（上游已按 120 字符截断） |
| `options` | array | 请求方给出的选项集合**原样**（不筛选、不增补、不翻译）：`[{ option_id, label? }]`；`option_id` 是裁决唯一可提交的值 |
| `multiple` | boolean | 是否多选（**仅 `request_kind:"question"` 的条目有意义**；`permission` 类不携带该键 ⇒ 读作 `false`）。取值 = 请求方给出的布尔值，缺失 / 非布尔 ⇒ `false`（不按类别改写） |
| `created_at` | number | 登记时刻（毫秒时间戳） |

- 列表顺序**不作承诺**（无排序语义、无分页）：条目存在性与字段内容一致即满足「重建一致」口径。
- 已裁决项**无任何读取入口**：本接口只返回在途项，且裁决即刻移出内存表 ⇒ 无历史台账、无查询参数、无导出。

---

### 3.21 `POST /api/confirmations/<confirmation_id>/decision`

提交一次裁决：`permission` 类提交 `option_id`（必填，**服务端校验它在该条的 `options` 内**）；`question` 类提交 `option_ids` 与 / 或 `text`（两者**至少一个非空**）。`text` 两类均可选（拒绝理由 / 补充说明）。

**语义**：条目在**第一次**提交时即被原子取出并移出在途表 ⇒ 第二次提交同一 id 得 `404`（**非幂等、不重放**）；
随后向该条的发出方回传 `notice{kind:"confirmation_decision", confirmation_id, …, text, chat_id}`——载荷按 `request_kind` 分化：
`permission` 类携 `option_id`（**不含** `option_ids`），`question` 类携 `option_ids`（与提交值**同值同序**；**不含** `option_id`）。
`permission` 类下 `text` 去空白后非空时，另向该 `chat_id` 追加一条输入并派发（`question` 类**不**追加：提问的作答不落成对话消息）。
`text` 两类均按去空白后的值回传。文本**不参与**上游 ACP 应答——应答包只接受请求方给出的合法选项。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `confirmation_id` | string | **是** | — | 路径参数：目标确认项 id；不在在途表（已裁决 / 已失效 / 从未存在）→ `404`（**同一码，不区分**） |
| `option_id` | string | 按类 | — | `permission` 类**必填**：用户选中的选项 id；缺失 / 非字符串 / **不在该条 `options` 内** → `400`，且条目**保留在途**（`question` 类不读该键） |
| `option_ids` | array | 按类 | `[]` | `question` 类：用户选中的选项 id **数组**；须为字符串数组、**⊆ 该条 `options`** 且与 `text` **至少一个非空**，否则 → `400`，且条目**保留在途**（键缺失 = 空数组；键出现但非字符串数组同样 `400`） |
| `text` | string | 否 | `""` | 可选文本；去空白后为空 = 未填（`question` 类下不可与 `option_ids` 同时为空；`permission` 类下为空则不追加输入）。两类均按去空白后的值回传 |

**成功响应** `200`

```json
{
  "confirmation_id": "cfm-8f14e45f-ceea-467e-9b1e-2a1b0a3f9d21",
  "accepted": true
}
```

**错误**

| `code` | HTTP | 触发条件 | `error` 形态 |
|---|---|---|---|
| `INVALID_PARAM` | 400 | `permission` 类：`option_id` 缺失 / 非字符串 / 不在该条 `options` 内；`question` 类：`option_ids` 非字符串数组 / 含该条 `options` 之外的取值 / 与 `text` 同时为空 | `option_id 缺失 / 非字符串 / 不在该条的选项集合内`；`option_ids` 须为字符串数组、⊆ 该条的选项集合，且与 text 至少一个非空 |
| `NOT_FOUND` | 404 | `confirmation_id` 不在在途表 | `确认项不存在: cfm-…` |

- 回传为 best-effort：请求方实例离线时不改变本接口的 `200`（裁决已受理；「回传是否送达」不伪装成「裁决是否成功」）。

---

## 4. 事件流

### 4.1 按对话订阅：`GET /api/stream?chat_id=<id>`（4 类事件）

| 事件名 | `data` 字段 | 触发时机 | 入库 |
|---|---|---|---|
| `message` | `{chat_id, message: {id, direction, agent_id, text, model, duration_ms, error, created_at}}` | 一条消息**落盘**时：输入落盘后、输出落盘后各一帧 | ✅ 已落库（与 `GET /api/chats/<id>` 一致） |
| `chat_state` | `{chat_id, state}` | 对话状态变化：`working`（派发前）/ `completed` / `failed` / `closed`（关闭或激活时状态还原） | 状态入库 |
| `task_update` | `{chat_id, task_id, kind, line}`（`kind` = `stdout` / `stderr`）或 `{chat_id, task_id, kind, text}`（`kind` = `chunk`） | 执行过程增量：shell / 一次性 omp 逐行输出、常驻 omp 的流式分片 | ❌ **不入库**（仅运行时可见） |
| `notice` | `{chat_id, kind, text}`（`kind` = `context_released` / `context_reset`） | 常驻上下文被释放（对话关闭 / 归档）或被重置（进程崩溃 / 超时 / LRU 淘汰） | ❌ **不入库** |

> `task_update` 的载荷按 `kind` 二选一：行式输出带 `line`，流式分片带 `text`；`started` / `truncated` 等控制条目**不会**下发到订阅端。

### 4.2 全局订阅：`GET /api/events`（4 类事件）

| 事件名 | `data` | 触发时机 |
|---|---|---|
| `agent_online` | `{instance_id, last_heartbeat}` | 一个实例从「不在线」变为 `online`（新注册 / 恢复） |
| `agent_offline` | `{instance_id}` | 一个实例从「在线」变为不在线（优雅注销，或判活超时被判离线） |
| `confirmation` | `{confirmation_id, request_kind, chat_id, agent_id, tool, title, options, multiple, created_at}` | 一条确认请求**首次**进入 web 进程在途表时（**恰一帧**）；`data` 与 §3.20 的列表元素**同形状**。重建（§3.20）**不发帧** ⇒ 刷新 / 重连不重复通知 |
| `chat_state` | `{chat_id, state}` | 对话状态变化（与 §4.1 的 `chat_state` **同源同形**；服务端**不判**它算不算一类通知，`completed` / `failed` 的派生由前端完成） |

- **判定源**：`router.status` 的 `state === "online"` 集合（注册表是唯一真源，不是日志、不是另一条推送通道）。
  web 按 `OAMP_WEB_TOPOLOGY_POLL_MS`（默认 **2000ms**）拉取快照并做**集合差值**：新出现的实例发 `agent_online`，消失的发 `agent_offline`。
- **时延**：**轮询腿 ≤ 2s** + 传输延迟（判定界 5s，余量 2.5×）。注意这只是「已判定离线**之后**」的推送时延：**优雅注销**（Ctrl-C / `agent.deregister`）时事件在 ≤2s 内到达；实例被**强杀**时还要先等租约判活（默认 `OAMP_HEARTBEAT_TIMEOUT_MS` = 30s，已通告间隔的实例按其 `2×` 抬升）判离线，故总时延默认约 30s。
- **只在有全局订阅者时运行**：无人订阅时不轮询、不产生任何开销。
- **首次订阅会「播种基线」**：订阅建立瞬间不会为**已在线**的实例补发 `agent_online`（避免虚报上线）。
- **键隔离**：`message` / `task_update` / `notice` **永远只**发往对应 `chat_id` 的订阅者；`chat_state` **两处都发**——既有 `chat:<id>` 帧的形态与时机逐字不变，另在全局键上**追加**一帧（同一 `data` 形状，不新增事件类型）。调用面三类事件（§4.4）与上述两个面结构上不相交；隔离由键空间与发布点分离实现，不靠过滤。

### 4.3 连接保持、重连与基线

- 服务端断线后靠客户端的 `retry: 1000`（1s）自动重连；15s 注释心跳防中间层空闲断开。
- **断线期间的事件不补发、不重放**。因此推荐的最小实践是：
  1. 建立订阅后，**先取一次 `GET /api/agents?state=online` 作为在线基线**（订阅建立与基线之间的上下线不会被漏报）；
  2. 之后用 `agent_online` / `agent_offline` 增量维护本地列表；
  3. **每次重连成功后重取一次基线**并整体对齐（宁可覆盖，不依赖补发）。
- 对话维度同理：重连后以 `GET /api/chats/<id>` 全量补齐。

---

### 4.4 调用面订阅（两类作用域，三类事件）

0018 新增的调用事件流（**独立于** §4.1~§4.3 的对话事件面：调用事件走另一组订阅键，与既有对话键、全局键**结构性不相交**——即使调用方自带的 `chat_id` 长得像调用键，也不会串键）。

**两类作用域**

| 作用域 | 订阅入口 | 覆盖范围 | 解决什么 |
|---|---|---|---|
| 按对话 | `GET /api/calls/stream?chat_id=<id>` | 该对话的调用事件——**含订阅之后才发起的调用** | 「先订阅、再发起」 |
| 按调用 | `GET /api/calls/<call_id>/stream` | 单次调用的事件 | 并发两次调用时只订阅其中一次，事件不混入 |

**事件表（三类，封闭）**

| 事件名 | `data` 字段 | 触发时机 |
|---|---|---|
| `call_state` | `{chat_id, call_id, agent, state}` | ① 派发成功（受理）⇒ `submitted`；② 首个执行增量到达 ⇒ `working`（每次调用**只发一次**） |
| `call_update` | `{chat_id, call_id, agent, kind, text}`（`kind` = `chunk`）或 `{chat_id, call_id, agent, kind, line}`（`kind` = `stdout` / `stderr`） | 执行过程增量（与既有 `task_update` 同源同形态）；控制条目 `started` / `truncated` **不下发** |
| `call_result` | `{chat_id, call_id, agent, state, duration_ms, model, truncated, text, structured_output, error, exit_code}` | 终态到达（投递路径或对账路径任一）；**该帧即终态状态迁移**——不再另发同义的 `call_state` |

- **序列闭合于终态**：`submitted → working → call_update* → call_result`，无悬空帧。
- **不重放、不补发**：订阅建立之前发生的事件不会补投（与 §4.3 同口径）。需要历史过程请用 §3.18 的转录读取。
- **终态帧 = §3.19 的同一信封**（同一构造点产出，字段一致）；帧内不含工具级详情，也不含参照契约里那几类拿不到的字段（见 §7.3 第 ⑧⑬⑭ 条）。
- 调用归属的对话侧**照旧**收到既有 §4.1 的 `message` / `chat_state` / `task_update` 帧——调用事件是**追加**的一条流，不替换、不插队既有帧顺序。

---

## 5. 可粘贴示例

**前置**：终端 1 `oamp router start`；终端 2 `oamp web start`（默认端口 7788）；终端 3 `oamp agent start demo-1`。
除 `<chat_id>` / `<project_id>` 与示例实例名（`demo-1`）外，下列命令可直接复制执行（`<project_id>` 由 §5.2 创建项目获得，替换成你自己的值即可）。

> 示例输出里的 `session_id` / `task_id` / `message_id` / 消息 `id` / 各时间戳**每次运行都不同**，比对时看结构即可；
> 只有 `error` / `code` / 状态码是稳定契约。

### 5.1 在线 agent 列表

```sh
curl -s 'http://127.0.0.1:7788/api/agents?state=online'
```

期望输出（`session_id` / `last_heartbeat` 每次运行不同）：

```json
{"agents":[{"instance_id":"demo-1","session_id":"503f52de-77a4-43b1-acc4-227c2d81e113","state":"online","last_heartbeat":1789184738463}]}
```

### 5.2 新建项目与项目列表

对话必须归属项目：**先建一个项目、拿到 `project_id`，再列对话 / 发消息**。

```sh
# 新建项目（最小输入 = 仓库地址；name 省略则按地址派生）
curl -s -X POST http://127.0.0.1:7788/api/projects \
  -H 'content-type: application/json' \
  -d '{"repo_url":"https://github.com/acme/demo.git"}'

# 项目列表（含对话数与最近活动时间；无分页）
curl -s http://127.0.0.1:7788/api/projects
```

期望输出（`project_id` / `created_at` 每次运行不同；同一地址重复创建 → `409 {"error":"项目已存在: …","code":"CONFLICT"}`）：

```json
{"project":{"project_id":"prj-2c1de5b0-6a1f-4a7e-9a0e-0d1b6f9cd2a1","name":"demo","repo_url":"https://github.com/acme/demo.git","created_at":1789184738463}}
```

```json
{"projects":[{"project_id":"prj-2c1de5b0-6a1f-4a7e-9a0e-0d1b6f9cd2a1","name":"demo","repo_url":"https://github.com/acme/demo.git","created_at":1789184738463,"chat_count":0,"last_activity_at":null}]}
```

> 下文的 `<project_id>` 就填上面返回的 `project_id`；无对话的项目 `last_activity_at` 为 `null`，前端展示占位即可。

### 5.3 列对话与搜索

选项在项目范围内生效（**`project_id` 必填**：缺参 / 空值 → `400`）：

```sh
# 主列表（不含已归档，按最近更新倒序）
curl -s 'http://127.0.0.1:7788/api/chats?project_id=<project_id>'

# 关键词搜索（匹配标题或任意消息正文）+ 只看某个 agent + 分页
curl -s 'http://127.0.0.1:7788/api/chats?project_id=<project_id>&q=hello&agent=demo-1&limit=10&offset=0'

# 归档视图（只列已归档，按归档时间倒序）
curl -s 'http://127.0.0.1:7788/api/chats?project_id=<project_id>&archived=1'
```

期望输出（空库时 `chats` 为空数组；`echo $?` 为 0）：

```json
{"chats":[],"total":0,"limit":50,"offset":0}
```

有数据时（示例单条）：

```json
{"chats":[{"chat_id":"chat-demo-shell","title":"!echo hello-oamp","agent_id":"demo-1","state":"completed","created_at":1789184746362,"updated_at":1789184746372,"archived_at":null,"message_count":2}],"total":1,"limit":50,"offset":0}
```

### 5.4 读对话消息

（`chat-demo-shell` 由下面 §5.5 的 shell 演示创建——按顺序阅读时先执行那一组；若已有自己的对话，把路径里的 id 换掉即可。）

```sh
curl -s 'http://127.0.0.1:7788/api/chats/chat-demo-shell'
```

期望输出（`messages` 按时间升序，输入 `in` 在前、输出 `out` 在后）：

```json
{"chat":{"chat_id":"chat-demo-shell","title":"!echo hello-oamp","agent_id":"demo-1","state":"completed","created_at":1789184746362,"updated_at":1789184746372,"closed_at":null,"archived_at":null,"context_released":0},"messages":[{"id":1,"direction":"in","agent_id":"demo-1","text":"!echo hello-oamp","model":null,"duration_ms":null,"error":null,"created_at":1789184746362,"meta":{"task_id":"task-6d034e35-ffc9-4c85-8395-f570535a9f08"}},{"id":2,"direction":"out","agent_id":"demo-1","text":"hello-oamp","model":null,"duration_ms":5,"error":null,"created_at":1789184746372,"meta":null}]}
```

### 5.5 发消息（两个变体）

新建对话必须带 `project_id`（已有对话不需要）：

```sh
# 变体 A：指定模型（常驻上下文，缺省路径）
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-model","project_id":"<project_id>","agent_id":"demo-1","text":"@demo-1 你好","model":"deepseek/deepseek-v4-flash"}'

# 变体 B：一次性执行（不累积上下文）
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-oneshot","project_id":"<project_id>","agent_id":"demo-1","text":"@demo-1 用一句话说明 OAMP 是什么","one_shot":true}'
```

期望输出（`task_id` / `message_id` 每次不同；派发成功时 `warning` 为 `null`）：

```json
{"chat_id":"chat-demo-model","task_id":"task-7e2a4d73-2982-491f-a58f-2cf9555deb97","message_id":"msg-35ce05e7-9cd5-4f5f-9e78-14431c8bccfa","warning":null}
```

```json
{"chat_id":"chat-demo-oneshot","task_id":"task-679fcf43-a2e4-47e8-a9ae-8eb5aa20c950","message_id":"msg-6568826c-eb89-4aef-b020-4f64506f5bb1","warning":null}
```

> 回答不在此响应里：用 §5.6 的流订阅实时收取，或稍后 `GET /api/chats/<chat_id>` 读结果。

无副作用的确定性演示（不经模型，直接在本机执行 shell）：

```sh
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","project_id":"<project_id>","agent_id":"demo-1","text":"!echo hello-oamp"}'
```

```json
{"chat_id":"chat-demo-shell","task_id":"task-ff43186d-fe02-499e-9382-c509ca70cd79","message_id":"msg-2d515f9b-2073-4aab-b9f5-7031940e4f0a","warning":null}
```

### 5.6 订阅对话流（`curl -N`）

终端 A（订阅，保持不关）：

```sh
curl -N 'http://127.0.0.1:7788/api/stream?chat_id=chat-demo-shell'
```

终端 B（触发一次执行；`chat-demo-shell` 已存在 ⇒ `project_id` 不参与判定，带上亦可）：

```sh
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","project_id":"<project_id>","agent_id":"demo-1","text":"!echo hello-oamp"}'
```

终端 A 期望输出（第一条 `retry: 1000` 在订阅建立时即到达；后续帧按发生顺序）：

```
retry: 1000

event: message
data: {"chat_id":"chat-demo-shell","message":{"id":3,"direction":"in","agent_id":"demo-1","text":"!echo hello-oamp","model":null,"duration_ms":null,"error":null,"created_at":1789184761389}}

event: chat_state
data: {"chat_id":"chat-demo-shell","state":"working"}

event: task_update
data: {"chat_id":"chat-demo-shell","task_id":"task-6d034e35-ffc9-4c85-8395-f570535a9f08","kind":"stdout","line":"hello-oamp"}

event: message
data: {"chat_id":"chat-demo-shell","message":{"id":4,"direction":"out","agent_id":"demo-1","text":"hello-oamp","model":null,"duration_ms":5,"error":null,"created_at":1789184761395}}

event: chat_state
data: {"chat_id":"chat-demo-shell","state":"completed"}

```

### 5.7 订阅全局事件流，观察 agent 上下线（`curl -N`）

终端 A（订阅全局事件，保持不关）：

```sh
curl -N http://127.0.0.1:7788/api/events
```

终端 B（先取一次在线基线，再起一个实例）：

```sh
curl -s 'http://127.0.0.1:7788/api/agents?state=online'      # 基线
oamp agent start demo-2                                       # 按 Ctrl-C 退出即优雅注销
```

终端 A 期望输出（`demo-2` 之前不在线时）：

```
retry: 1000

event: agent_online
data: {"instance_id":"demo-2","last_heartbeat":1789184787786}

event: agent_offline
data: {"instance_id":"demo-2"}

```

> 说明：订阅建立时已在线的实例**不会**补发 `agent_online`（播种基线）——所以先取一次 `GET /api/agents?state=online`
> 才知道当前谁在线；每类事件到达后按 `instance_id` 在本地列表里插入 / 删除即可。重连后同样重取一次基线。

### 5.8 归档 / 激活 / 改名

```sh
# 改名（只改标题，不改变列表位置）
curl -s -X POST http://127.0.0.1:7788/api/chats/chat-demo-shell/rename \
  -H 'content-type: application/json' -d '{"title":"演示对话"}'

# 批量归档（未归档且非进行中的全部对话）
curl -s -X POST http://127.0.0.1:7788/api/chats/archive

# 激活一条已归档对话
curl -s -X POST http://127.0.0.1:7788/api/chats/chat-demo-shell/activate

# 关闭一条对话（幂等）
curl -s -X POST http://127.0.0.1:7788/api/chats/chat-demo-shell/close
```

期望输出（依次）：

```json
{"chat_id":"chat-demo-shell","title":"演示对话"}
{"archived":1,"failed":0,"failed_ids":[]}
{"chat_id":"chat-demo-shell","state":"completed"}
{"chat_id":"chat-demo-shell","state":"closed"}
```

> `archived` 是本次**实际**归档的条数（= 当前「未归档且非进行中」的对话数），随环境不同；
> `failed_ids` 列出归档失败（仍留在主列表可重试）的对话。

### 5.9 错误样例

```sh
# 未知对话 → 404 NOT_FOUND
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:7788/api/chats/chat-nope

# 缺 chat_id 的订阅 → 400 INVALID_PARAM
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:7788/api/stream

# 非法的 state 过滤值 → 400 INVALID_PARAM
curl -s -w '\nHTTP %{http_code}\n' 'http://127.0.0.1:7788/api/agents?state=bogus'

# 非法 model 形态 → 400 INVALID_PARAM（错误演示：带齐 project_id 才会落到 model 校验上）
curl -s -w '\nHTTP %{http_code}\n' -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"project_id":"<project_id>","agent_id":"demo-1","text":"你好","model":"bad model!"}'
```

期望输出：

```
{"error":"chat 不存在: chat-nope","code":"NOT_FOUND"}
HTTP 404

{"error":"需要 chat_id（不做全局订阅）","code":"INVALID_PARAM"}
HTTP 400

{"error":"查询参数非法: state 需为 online（当前值 \"bogus\"）","code":"INVALID_PARAM"}
HTTP 400

{"error":"model 非法（需匹配 /^[A-Za-z0-9._/-]{1,128}$/）","code":"INVALID_PARAM"}
HTTP 400
```

### 5.10 极简 Node 客户端订阅示例（零依赖，Node ≥ 22）

```js
// events.mjs —— 订阅全局事件流：先取基线，再增量维护在线集合
const BASE = 'http://127.0.0.1:7788';
const online = new Set();

// 1) 基线
const { agents } = await (await fetch(`${BASE}/api/agents?state=online`)).json();
for (const a of agents) online.add(a.instance_id);
console.log('基线在线:', [...online]);

// 2) 增量
const res = await fetch(`${BASE}/api/events`);
const decoder = new TextDecoder();
let buf = '';
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  for (let i; (i = buf.indexOf('\n\n')) >= 0; ) {
    const frame = buf.slice(0, i);
    buf = buf.slice(i + 2);
    if (frame.startsWith(':')) continue;                  // keepalive 注释帧
    const type = frame.match(/^event: (.+)$/m)?.[1];
    const data = frame.match(/^data: (.+)$/m)?.[1];
    if (!type || !data) continue;
    const event = JSON.parse(data);
    if (type === 'agent_online') { online.add(event.instance_id); console.log('上线', event.instance_id); }
    if (type === 'agent_offline') { online.delete(event.instance_id); console.log('下线', event.instance_id); }
  }
}
```

```sh
node events.mjs
# 另一个终端：oamp agent start demo-2 → 打印“上线 demo-2”；Ctrl-C → 打印“下线 demo-2”
```

### 5.11 最小接入闭环（伪代码）

```text
1. GET  /api/agents?state=online        → 找到目标实例（如 demo-1）
2. GET  /api/projects                   → 选定项目 project_id（没有就 POST /api/projects 建一个）
3. GET  /api/chats?project_id=<project_id>
                                        → 在该项目范围内选中或新建对话 chat_id
4. GET  /api/stream?chat_id=<chat_id>   → 建立 SSE 订阅（另起协程持续读取）
5. GET  /api/events                     → 建立全局订阅（观察上下线，维护基线+增量）
6. POST /api/messages {chat_id, project_id, agent_id, text}
                                        → 200 {task_id, message_id, warning}
                                          warning 非空 ⇒ agent 不可达，稍后重发
                                          （chat_id 省略 / 不存在 ⇒ 必须带 project_id）
7. 收 SSE：chat_state(working) → task_update* → message(out) → chat_state(completed)
                                        → 结果取 message(out).text
8. （可选）GET /api/chats/<chat_id> 全量校对；断线重连后重取基线与详情
```

---

### 5.12 发起调用（后台：单项 + 批量）

（示例依赖一个**已存在**的对话：按顺序阅读时先执行 §5.2 建项目、§5.5 发消息；把 `chat-demo-shell` 替换为自己机器上已有对话的 id。`agent` 用**角色名**，须有对应角色在线。）

```sh
# 单项：带共享说明与期望结构
curl -s -X POST http://127.0.0.1:7788/api/calls \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent":"dev","task":"用三句话说明这次改动做了什么","context":"共享说明：本机演示环境","output_schema":{"properties":{"summary":{"type":"string"}},"required":["summary"]}}'

# 批量：一次提交两项 ⇒ 两个互不相同的 call_id（每项 = 一个独立调用）
curl -s -X POST http://127.0.0.1:7788/api/calls \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent":"dev","tasks":[{"task":"列出本次改动的文件"},{"task":"写一句提交信息"}]}'
```

期望输出（`call_id` 每次不同；后台项 `state` 为 `submitted`，其余可得字段此时为 `null` / `false`）：

```json
{"calls":[{"call_id":"task-7e2a4d73-2982-491f-a58f-2cf9555deb97","agent":"dev","state":"submitted","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}]}
```

```json
{"calls":[{"call_id":"task-679fcf43-a2e4-47e8-a9ae-8eb5aa20c950","agent":"dev","state":"submitted","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null},{"call_id":"task-a41c0f52-1d63-4bb2-9f0e-2c8e5f1a77b1","agent":"dev","state":"submitted","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}]}
```

> 终态不在这里：用 §5.14 按 `call_id` 取，或用 §5.16 订阅。

### 5.13 发起调用（阻塞取终态）

`mode: "block"` ⇒ 响应挂起至终态（**不设人为上限**；客户端中途断连**不终止**调用，调用仍在后台完成）。

```sh
curl -s -X POST http://127.0.0.1:7788/api/calls \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent":"dev","task":"用一句话回答：这个仓库做什么？","mode":"block"}'
```

期望输出（`state` 为 `completed` 或 `failed`；`model` 是执行侧**实报**的生效模型）：

```json
{"calls":[{"call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"completed","duration_ms":8421,"model":"deepseek/deepseek-v4-flash","truncated":false,"text":"这是一个本机多智能体运行时。","structured_output":null,"error":null,"exit_code":0}]}
```

### 5.14 按调用 id 取终态

```sh
curl -s http://127.0.0.1:7788/api/calls/<call_id>
```

期望输出（进行中时同形状，`state` 为 `submitted` / `working`，`duration_ms` / `model` / `text` / `exit_code` 为 `null`）：

```json
{"call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"completed","duration_ms":8421,"model":"deepseek/deepseek-v4-flash","truncated":false,"text":"这是一个本机多智能体运行时。","structured_output":null,"error":null,"exit_code":0}
```

### 5.15 按调用 id 取转录

```sh
curl -s http://127.0.0.1:7788/api/calls/<call_id>/transcript
```

期望输出（`entries` 按发生顺序；终态时末条 `detail.event` 为 `result`）：

```json
{"call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"completed","truncated":false,"entries":[{"at":1789184738500,"from":"pb-dev","state":"working","detail":{"state":"working","event":"started","executor":"omp-daemon","chat_id":"chat-demo-shell","model":"deepseek/deepseek-v4-flash"}},{"at":1789184740999,"from":"pb-dev","state":"completed","detail":{"event":"result","state":"completed","text":"这是一个本机多智能体运行时。","model":"deepseek/deepseek-v4-flash","duration_ms":8421}}]}
```

### 5.16 订阅调用事件（`curl -N`）

终端 A（**先订阅**该对话的调用流，保持不关）：

```sh
curl -N 'http://127.0.0.1:7788/api/calls/stream?chat_id=chat-demo-shell'
```

终端 B（再发起；`<call_id>` 从 §5.12 的响应里取）：

```sh
curl -s -X POST http://127.0.0.1:7788/api/calls \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent":"dev","task":"用一句话说明这次改动"}'

# 只想看某一次调用的事件（订阅要在发起之前不可能 ⇒ 用对话作用域先拿到 call_id）
curl -N http://127.0.0.1:7788/api/calls/<call_id>/stream
```

终端 A 期望输出（首帧 `retry: 1000` 在订阅建立时即到达；后续帧按发生顺序，序列闭合于终态）：

```
retry: 1000

event: call_state
data: {"chat_id":"chat-demo-shell","call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"submitted"}

event: call_state
data: {"chat_id":"chat-demo-shell","call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"working"}

event: call_update
data: {"chat_id":"chat-demo-shell","call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","kind":"chunk","text":"这是"}

event: call_result
data: {"chat_id":"chat-demo-shell","call_id":"task-2c9f5e1b-8a44-4d31-9c7e-5b0f2a6d1e88","agent":"dev","state":"completed","duration_ms":8421,"model":"deepseek/deepseek-v4-flash","truncated":false,"text":"这是本机多智能体运行时。","structured_output":null,"error":null,"exit_code":0}

```

---

## 6. 不做（范围边界）

本接口面**不提供**下列能力，文档也不描述它们的接入方式：

- ❌ **agent 启停接口 / 按钮**：没有任何启动、停止、重启 agent 的路由或参数（agent 由本机 CLI 负责）。
- ❌ **鉴权**：无 token / key / Cookie 校验，只有「仅回环地址」这一层边界。
- ❌ **跨机接入**：不监听非回环地址，不提供 TLS / 反向代理 / 端口转发说明。
- ❌ **tasks 接口**：Router 的任务面（`oamp task *`）不经 HTTP 暴露；调用面只解除**一处**约束——**按调用 id 读自己发起的调用**（终态 / 转录 / 事件订阅）。按状态过滤、跨调用检索、编排操作仍然不提供。
- ❌ **客户端 SDK / 适配器**：本文只定义接口，接入实现由各客户端自理。
- ❌ **UDS / JSON-RPC 协议**：那是进程间协议（Router ↔ agent ↔ web），外部客户端不直连、本文不覆盖。
- ❌ **调用面：取消 / 终止 / 后续指令（steer）**（差异 ⑮⑯）：没有取消进行中调用、终止、后续指令的路由或参数；「同 chat 再发一条」是既有对话路径（§3.8），不是新面。
- ❌ **调用面：隔离工作区与产物回传**（差异 ③⑤）：入参没有隔离工作区档位，也没有 worktree / branch / patch 产物字段——调用方与 agent **不共享文件系统**。
- ❌ **调用面：工作量档位（effort）**（差异 ②）：入参没有该档位与钳制。
- ❌ **调用面：只读计划模式**（差异 ⑥）：没有强制只读的计划模式通道。
- ❌ **调用面：本仓库既有的 ACP 派发契约字段**（差异 ⑦）：入参不含那些字段名——不引入第三套词汇，也不与 sub agent 契约合并。
- ❌ **调用面：工具级进度**（差异 ⑬）：事件帧与读取面都不给「当前工具 / 参数 / 意图 / 重试」。
- ❌ **调用面：token 与成本**（差异 ⑧⑭）：终态信封与 roster 都不给 usage / tokens / 成本——**无数据源，不造假、不估算**（详见 §7.3 第 ⑧⑭ 条）。
- ❌ **调用面：远端同会话渲染**（差异 ⑰）：不提供会话镜像；调用面只有 HTTP / SSE。
- ❌ **调用面：客户端 SDK / 适配器**（差异 ⑱）：同下一条，接入由客户端照文档自行实现。


两个容易混淆的口径，一并说明：

- `GET /api/agents` **无参时包含 `offline` 墓碑**；只要在线实例请用 `?state=online`。
- `POST /api/messages` 的「派发失败」是 **200 + `warning`**，不是 4xx/5xx。

---

## 7. sub agent 契约对照与差异清单

### 7.1 参照契约与判定口径

- **参照物** = harness 的 **`task` 工具契约**（`omp://tools/task.md`）：本仓库对「sub agent 协议」的对照一律以它为基准，按**调用面 / 响应面 / 展示面**三面取逐条不变量（调用面 I1~I11 / 响应面 R1~R7 / 展示面 D1~D7）。参照契约只作**对照物**——本迭代不实现、不改写 harness / omp 侧，也不把它与本仓库既有的 ACP 派发契约合并（不引入第三套词汇）。
- **等价判定** = **语义等价 + 差异清单**：等价指语义等价（不要求字段名与形态逐字相同）；凡**非**「必须等价」的对照行，都在 §7.3 有对应编号（覆盖关系见 §7.4）。差异清单的编号与归类沿用需求文档既有条目（①~⑲）——本迭代**不增不改**、不重排。
- **术语对照**：

| 参照契约（`task` 工具） | 本 hub 的调用面 |
|---|---|
| `agent`：task-agent 名（有文档化的发现优先级） | `agent`：**角色名**（如 `dev`）——由既有实例命名关系推导，不照搬发现链 |
| `task`：子任务文本 | `task`（单项）/ `tasks[]`（批量，每项 = 一个独立调用） |
| `context`：共享上下文 | `context`：**本次调用的共享说明**（独立区块前置装配，不污染任务文本） |
| `outputSchema` / `schemaMode` | `output_schema`（受限子集）/ `schema_mode`（`permissive` \| `strict`） |
| job id | `call_id` = 既有 `task_id`（**不**新造第二套标识） |

### 7.2 三面对照表（25 行）

> 结论取值：**必须等价** / **必须等价（形态简化）** / **部分等价** / **本次不做**；「差异编号」列仅非「必须等价」的行有编号（⑲ 同时是既有对话入口的例外地位）。

**调用面（I1~I11）**

| 编号 | 参照契约的不变量 | hub 的实现方式 | 结论 | 差异编号 |
|---|---|---|---|---|
| I1 | 按 task-agent 名选择，且有文档化的发现优先级 | 按**角色名**寻址（`agent`）：可被寻址的是本 hub 的**常驻实例**身份，且只走既有实例命名关系——不照搬多级发现链、不新增优先级链 | 必须等价（形态简化） | ① |
| I2 | `task` 文本 + 可选共享 `context`；批量 `tasks[]` | `task` / `tasks[]`（每项一个独立调用、各得一个 `call_id`）+ `context`（独立区块前置装配） | 必须等价 | — |
| I3 | `outputSchema` + `schemaMode` | `output_schema`（受限子集：受理时校验、终态时提取并按三层校验）+ `schema_mode`（`permissive` / `strict`） | 必须等价 | — |
| I4 | 工作量档位与钳制 | 入参无该字段（字段表为封闭清单） | 本次不做 | ② |
| I5 | 隔离工作区与 patch / branch 产物 | 入参无该字段；也没有 worktree / branch / patch 产物字段 | 本次不做 | ③ |
| I6 | 每项可选「阻塞」或「后台 job」 | `mode`：`background`（默认，受理即回）/ `block`（响应挂起至终态，不设人为上限） | 必须等价 | — |
| I7 | 模型优先级：调用参数 > frontmatter > 会话兜底 | 调用参数 > 角色 / 实例默认（没有 frontmatter 层；未指定走既有默认链） | 必须等价 | — |
| I8 | 调用命名与身份（去重、嵌套 `Parent.Child`） | 身份 = 既有 `task_id`（`call_id` 同值）；agent 身份 = `(chat, 角色名)`——同 chat 同名共享上下文是**默认路径**，既有 `one_shot: true` 是调用方显式选择的**例外**（§7.5）；**无**父子 / 血缘命名 | 部分等价 | ④ ① ⑲ |
| I9 | 共享文件系统根 + 产物管理器 | 不存在共享根：无路径透传字段 | 本次不做 | ⑤ |
| I10 | plan mode 强制只读有效 agent | 不存在只读计划模式通道 | 本次不做 | ⑥ |
| I11 | 本仓库既有的 ACP 派发契约字段 | 入参零该类字段（不引入第三套词汇） | 本次不做 | ⑦ |

**响应面（R1~R7）**

| 编号 | 参照契约的不变量 | hub 的实现方式 | 结论 | 差异编号 |
|---|---|---|---|---|
| R1 | 结构化终态：退出标记 / 时长 / 生效模型 / 截断标记 / `aborted` 语义等一组字段 | 可得：`state` / `duration_ms` / `exit_code` / `model` / `truncated` / `text` / `structured_output`；**不可得**的那几类为终态字段缺口（见 §7.3 第 ⑧ 条） | 必须等价（形态简化） | ⑧ |
| R2 | 产物 URI（含 JSON 抽取能力） | 能力等价：按调用 id 取最终产物 = `GET /api/calls/<call_id>` 的 `text` / `structured_output`；**不照搬** URI scheme | 必须等价（形态简化） | ⑨ |
| R3 | `history://<id>` 转录（含中间步骤） | `GET /api/calls/<call_id>/transcript`：既有过程条目 + 终态条目；**进程内**可读，重启即丢 | 部分等价 | ⑩ |
| R4 | job id + 终态异步投递回调用方 | `call_id` + 终态经 `call_result` 帧投递（也可按 id 查询） | 必须等价 | — |
| R5 | `yield` 载荷 / structuredOutput | `structured_output`（限 `output_schema` 路径）；不引入 `yield` 工具 | 必须等价 | — |
| R6 | 生命周期含挂起 / 恢复 / 中止 | 无启停、挂起、恢复、中止能力（也不启停任何进程） | 本次不做 | ⑪ |
| R7 | `completed` / `failed` / `blocked` 或非零退出标记 | 调用面统一终态词 `completed` / `failed` + `exit_code` / `error`；既有 HTTP 错误契约 `{error, code}` 逐字不变 | 必须等价（形态简化） | ⑫ |

**展示面（D1~D7）**

| 编号 | 参照契约的不变量 | hub 的实现方式 | 结论 | 差异编号 |
|---|---|---|---|---|
| D1 | live 进度（当前工具 / 参数 / 意图 / 重试，约 150ms 合并） | 状态迁移 + 增量输出 + 终态；**不做**工具级详情 | 部分等价 | ⑬ |
| D2 | 每次调用一行 roster（状态 / 模型 / 年龄 / 用量与开销） | `GET /api/calls` 六列：调用 id / agent / 状态 / 起止时间 / 模型；裁剪掉的列见 §7.3 第 ⑭ 条 | 必须等价（形态简化） | ⑭ |
| D3 | 完成通知到调用方 | `call_result` 帧带调用 id（按调用、按对话两种订阅都可收） | 必须等价 | — |
| D4 | 对 live agent 的后续指令 / 追问 | 无该区分；「同 chat 再发一条」是既有对话路径（§3.8），不是新面 | 本次不做 | ⑮ |
| D5 | 取消进行中的调用 | 无取消入口 | 本次不做 | ⑯ |
| D6 | 非 TUI 客户端的帧订阅 | HTTP / SSE 裸接口（按调用、按对话两种作用域）；仓库**不**提供客户端 SDK 或适配器 | 必须等价（形态简化） | ⑱ |
| D7 | 远端客户端同会话渲染一致（协同镜像） | 无会话镜像模型 | 本次不做 | ⑰ |

### 7.3 差异清单（①~⑲）

> 「本迭代落点」列的两种写法：**能力提供侧**给出可核对的接口 / 字段；「不提供」的条目给出可机械核对的核对方式（检索面 + 零命中的对象）。

| 编号 | 差异内容 | 依据 | 本迭代落点 / 不提供的核对方式 |
|---|---|---|---|
| ① | 被调用者生命周期：hub 的被调用者是**常驻 agent 实例**（一个实例承载多个 chat 作用域的身份）；参照契约是「每次派发一个临时 agent + 挂起 / 恢复」 | P-2 裁决（用户） | 能力提供侧：调用面的 `agent` 就是这类常驻实例的角色名（§3.1 的 `role`）；不提供侧：无启停 / 挂起 / 恢复路由（核对 = 路由表检索） |
| ② | 不提供 `effort` 档位与钳制 | P-5 / I4 | 入参字段表为封闭清单（§3.14）；核对 = 调用面章节与 `oamp/src/web.js` 对该词零命中 |
| ③ | 不提供隔离工作区与 patch / branch 产物 | P-5 / I5 | 入参无该字段、无产物回传面（核对同 ②） |
| ④ | 不提供嵌套调用 / 父子血缘 / `Parent.Child` 命名 | P-5 / I8 | `call_id` = 既有 `task_id`（形态 `task-<uuid>`）；字段表与路由表都无血缘字段（§3.19） |
| ⑤ | 不提供共享 `local://` 根（调用方与 agent 不共享文件系统） | P-5 / I9 | 入参无路径透传字段（核对同 ②） |
| ⑥ | 不提供只读计划模式 | P-5 / I10 | 入参与事件面都没有该通道（核对同 ②） |
| ⑦ | 不引入本仓库既有的 ACP 派发契约字段（不引入第三套词汇） | P-1 / P-5 / I11 | 入参零该类字段；本章**不**与那份契约合并 |
| ⑧ | 终态字段缺口：usage / tokens / 成本 / `aborted` 语义**不可得** | P-6 / R1（既有执行侧终态体从未采集这些值） | **无数据源**：终态信封的键集合（§3.19）不含这些字段——**不提供、不造假、不估算、不占位**；核对 = 响应键集合断言 + 本文档检索 |
| ⑨ | 产物形态：提供「按调用 id 取最终产物」，**不照搬** URI scheme | P-6 / R2 | 能力提供侧 = `GET /api/calls/<call_id>` 的 `text` / `structured_output`（§3.19）；不提供侧 = 该 URI scheme（核对 = 路由表零命中） |
| ⑩ | 转录不持久：进程内可读，**重启即丢** | P-6 / R3 + N11 | 能力提供侧 = `GET /api/calls/<call_id>/transcript`（§3.18）；重启后同一 id ⇒ `404`；核对 = 数据库零新表零新列（不落库） |
| ⑪ | 生命周期控制：无挂起 / 恢复 / 中止 | P-6 / R6 + 0015 边界 | 路由表与入参零命中（核对同 ②） |
| ⑫ | 终态词表：调用面给出统一终态词；既有 HTTP 面错误契约保持 `{error, code}` 不变 | P-6 / R7 + N18 | 信封 `state` ∈ {`submitted`,`working`,`completed`,`failed`}（§3.19）；§2.2 的既有错误契约逐字不变 |
| ⑬ | 工具级进度：不提供当前工具 / 参数 / 意图 / 重试 | P-7 / D1 | 事件帧字段（§4.4）与转录条目（§3.18）都不含工具级字段 |
| ⑭ | roster 字段裁剪：**无成本与 token** | P-7 / D2 | 六列固定（§3.15）；**无数据源** ⇒ 不提供、不造假、不估算；核对 = 响应键集合断言 |
| ⑮ | 不提供后续指令 / followUp 的区分 | P-7 / D4 | 入参与路由零命中（核对同 ②）；「同 chat 再发一条」= 既有 §3.8 路径 |
| ⑯ | 不提供取消进行中的调用 | P-7 / D5 + P-8 | 无取消路由与参数（核对同 ②） |
| ⑰ | 不提供远端同会话渲染（无会话镜像模型） | P-7 / D7 | 调用面只有 HTTP / SSE；无镜像 / 协同字段 |
| ⑱ | 客户端适配：不提供客户端 SDK / 适配器，接入由客户端照文档自行实现 | P-3 + 0015 边界 | 仓库零 SDK / 插件 / 适配器代码；文档只给 curl 与裸 SSE 示例（§5.12~§5.16） |
| ⑲ | `one_shot` 的例外地位 | Q-1 裁决 ①（用户） | 能力**保留**：既有 `POST /api/messages` 带 `one_shot: true` 逐字不变；调用面不提供该开关（§7.5） |

### 7.4 覆盖关系核对表

> 口径：**§7.2 中所有非「必须等价」的对照行** ↔ **上表 19 个编号**——两列集合互相覆盖，无孤儿行、无孤儿条目。

| 差异编号 | 覆盖它的对照行（§7.2） |
|---|---|
| ① | I1（形态简化侧）、I8（身份侧） |
| ② | I4 |
| ③ | I5 |
| ④ | I8 |
| ⑤ | I9 |
| ⑥ | I10 |
| ⑦ | I11 |
| ⑧ | R1 |
| ⑨ | R2 |
| ⑩ | R3 |
| ⑪ | R6 |
| ⑫ | R7 |
| ⑬ | D1 |
| ⑭ | D2 |
| ⑮ | D4 |
| ⑯ | D5 |
| ⑰ | D7 |
| ⑱ | D6 |
| ⑲ | I8 |

- 行侧闭合：§7.2 的 18 个非「必须等价」对照行（I1 / I4 / I5 / I8 / I9 / I10 / I11 / R1 / R2 / R3 / R6 / R7 / D1 / D2 / D4 / D5 / D6 / D7）全部在上表出现。
- 条目侧闭合：上表的 19 个编号全部出现在 §7.2 的「差异编号」列（① 出现在 I1 与 I8 两行）。

### 7.5 `one_shot` 的例外地位

- **默认路径** = **同 chat 同名 agent 共享上下文**：agent 身份 = `(chat, 角色名)`——同 chat 下同名 agent 是同一个 agent、共享上下文；不同 chat 之间相互隔离。这是调用面（常驻上下文执行路径）的既有语义，不是本迭代新增的约定。
- 既有对话入口的 `one_shot: true` 是**调用方主动放弃上下文延续**的**显式例外**：只有调用方显式选择它，才不走上面那条默认的共享路径。
- 该例外的入口**仍是既有对话入口**（§3.8）：**调用面不提供该开关**（§3.14 的入参字段表是封闭清单，没有它），也不把它改写成调用面的默认行为。
