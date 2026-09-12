# oamp HTTP / SSE 接口文档

面向外部客户端（codex / omp / claude 等）的接入文档：读完本文即可调用本机 oamp web 服务的全部接口，
**不需要读源码**；本文的 `curl` 示例可直接复制执行。

- **服务**：`oamp web start`（内建 HTTP 服务；浏览器不直连 UDS，所有读写都经这层 HTTP API）
- **协议**：HTTP/1.1 + JSON；事件推送为 SSE（`text/event-stream`）
- **真源**：本文逐条映射 `oamp/src/web.js` 的路由表与 `oamp/src/transport.js` 的事件发布点，不另立第二套定义

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

---

## 3. 接口清单（10 条）

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
      "last_heartbeat": 1789184738463
    }
  ]
}
```

- 无参时**逐字透传** Router 快照，含两类记录：**在线**（`state: "online"`）与**判活超时被判离线的墓碑**（`state: "offline"`，保留最后一次的 `session_id`，直到该实例重新注册）。**优雅注销不保留记录**——agent 主动退出（`agent.deregister`）时该实例直接从列表消失。因此无参列表无法区分「从未注册」与「已注销」；只关心在线实例请用 `?state=online`。
- 列表里可能还出现 **`instance_id` = `web` 的节点**——那是 web 进程自身的常驻发送方身份（它在本进程**首次派发消息 / 控制通知时**注册，随后按心跳保活）。客户端按实例做业务判断时应排除它。
- `state` 取值只有 `online` / `offline`；`last_heartbeat` 为 epoch ms。
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
| `INVALID_PARAM` | 400 | `limit` 非 `1..200` 整数（含非数字）；`offset` 非非负整数；`archived` 非 `0\|1`；`state` 非法枚举；`from` / `to` 非毫秒整数；`from > to`；`q` / `agent` 类型不符 | `查询参数非法: <参数> …（当前值 …）` |
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
| `INVALID_PARAM` | 400 | 请求体非合法 JSON；既无 `agent_id` 也无 `@agent ` 前缀；正文 trim 后为空；`model` 不匹配形态 | `请求体非法 JSON: …` / `需要指定目标 agent（输入 @agent 或提供 agent_id）` / `消息不能为空` / `model 非法（需匹配 /^[A-Za-z0-9._/-]{1,128}$/）` |
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

## 4. 事件流

### 4.1 按对话订阅：`GET /api/stream?chat_id=<id>`（4 类事件）

| 事件名 | `data` 字段 | 触发时机 | 入库 |
|---|---|---|---|
| `message` | `{chat_id, message: {id, direction, agent_id, text, model, duration_ms, error, created_at}}` | 一条消息**落盘**时：输入落盘后、输出落盘后各一帧 | ✅ 已落库（与 `GET /api/chats/<id>` 一致） |
| `chat_state` | `{chat_id, state}` | 对话状态变化：`working`（派发前）/ `completed` / `failed` / `closed`（关闭或激活时状态还原） | 状态入库 |
| `task_update` | `{chat_id, task_id, kind, line}`（`kind` = `stdout` / `stderr`）或 `{chat_id, task_id, kind, text}`（`kind` = `chunk`） | 执行过程增量：shell / 一次性 omp 逐行输出、常驻 omp 的流式分片 | ❌ **不入库**（仅运行时可见） |
| `notice` | `{chat_id, kind, text}`（`kind` = `context_released` / `context_reset`） | 常驻上下文被释放（对话关闭 / 归档）或被重置（进程崩溃 / 超时 / LRU 淘汰） | ❌ **不入库** |

> `task_update` 的载荷按 `kind` 二选一：行式输出带 `line`，流式分片带 `text`；`started` / `truncated` 等控制条目**不会**下发到订阅端。

### 4.2 全局订阅：`GET /api/events`（2 类事件）

| 事件名 | `data` | 触发时机 |
|---|---|---|
| `agent_online` | `{instance_id, last_heartbeat}` | 一个实例从「不在线」变为 `online`（新注册 / 恢复） |
| `agent_offline` | `{instance_id}` | 一个实例从「在线」变为不在线（优雅注销，或判活超时被判离线） |

- **判定源**：`router.status` 的 `state === "online"` 集合（注册表是唯一真源，不是日志、不是另一条推送通道）。
  web 按 `OAMP_WEB_TOPOLOGY_POLL_MS`（默认 **2000ms**）拉取快照并做**集合差值**：新出现的实例发 `agent_online`，消失的发 `agent_offline`。
- **时延**：**轮询腿 ≤ 2s** + 传输延迟（判定界 5s，余量 2.5×）。注意这只是「已判定离线**之后**」的推送时延：**优雅注销**（Ctrl-C / `agent.deregister`）时事件在 ≤2s 内到达；实例被**强杀**时还要先等租约判活（默认 `OAMP_HEARTBEAT_TIMEOUT_MS` = 30s，已通告间隔的实例按其 `2×` 抬升）判离线，故总时延默认约 30s。
- **只在有全局订阅者时运行**：无人订阅时不轮询、不产生任何开销。
- **首次订阅会「播种基线」**：订阅建立瞬间不会为**已在线**的实例补发 `agent_online`（避免虚报上线）。
- **键隔离**：全局链路上**只**有这两类事件；`message` / `task_update` / `chat_state` / `notice` 永远只发往对应 `chat_id` 的订阅者 —— 两个方向互为隔离，不靠过滤实现。

### 4.3 连接保持、重连与基线

- 服务端断线后靠客户端的 `retry: 1000`（1s）自动重连；15s 注释心跳防中间层空闲断开。
- **断线期间的事件不补发、不重放**。因此推荐的最小实践是：
  1. 建立订阅后，**先取一次 `GET /api/agents?state=online` 作为在线基线**（订阅建立与基线之间的上下线不会被漏报）；
  2. 之后用 `agent_online` / `agent_offline` 增量维护本地列表；
  3. **每次重连成功后重取一次基线**并整体对齐（宁可覆盖，不依赖补发）。
- 对话维度同理：重连后以 `GET /api/chats/<id>` 全量补齐。

---

## 5. 可粘贴示例

**前置**：终端 1 `oamp router start`；终端 2 `oamp web start`（默认端口 7788）；终端 3 `oamp agent start demo-1`。
除 `<chat_id>` 与示例实例名（`demo-1`）外，下列命令可直接复制执行。

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

### 5.2 列对话与搜索

```sh
# 主列表（不含已归档，按最近更新倒序）
curl -s 'http://127.0.0.1:7788/api/chats'

# 关键词搜索（匹配标题或任意消息正文）+ 只看某个 agent + 分页
curl -s 'http://127.0.0.1:7788/api/chats?q=hello&agent=demo-1&limit=10&offset=0'

# 归档视图（只列已归档，按归档时间倒序）
curl -s 'http://127.0.0.1:7788/api/chats?archived=1'
```

期望输出（空库时 `chats` 为空数组；`echo $?` 为 0）：

```json
{"chats":[],"total":0,"limit":50,"offset":0}
```

有数据时（示例单条）：

```json
{"chats":[{"chat_id":"chat-demo-shell","title":"!echo hello-oamp","agent_id":"demo-1","state":"completed","created_at":1789184746362,"updated_at":1789184746372,"archived_at":null,"message_count":2}],"total":1,"limit":50,"offset":0}
```

### 5.3 读对话消息

（`chat-demo-shell` 由下面 §5.4 的 shell 演示创建——按顺序阅读时先执行那一组；若已有自己的对话，把路径里的 id 换掉即可。）

```sh
curl -s 'http://127.0.0.1:7788/api/chats/chat-demo-shell'
```

期望输出（`messages` 按时间升序，输入 `in` 在前、输出 `out` 在后）：

```json
{"chat":{"chat_id":"chat-demo-shell","title":"!echo hello-oamp","agent_id":"demo-1","state":"completed","created_at":1789184746362,"updated_at":1789184746372,"closed_at":null,"archived_at":null,"context_released":0},"messages":[{"id":1,"direction":"in","agent_id":"demo-1","text":"!echo hello-oamp","model":null,"duration_ms":null,"error":null,"created_at":1789184746362,"meta":{"task_id":"task-6d034e35-ffc9-4c85-8395-f570535a9f08"}},{"id":2,"direction":"out","agent_id":"demo-1","text":"hello-oamp","model":null,"duration_ms":5,"error":null,"created_at":1789184746372,"meta":null}]}
```

### 5.4 发消息（两个变体）

```sh
# 变体 A：指定模型（常驻上下文，缺省路径）
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-model","agent_id":"demo-1","text":"@demo-1 你好","model":"deepseek/deepseek-v4-flash"}'

# 变体 B：一次性执行（不累积上下文）
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-oneshot","agent_id":"demo-1","text":"@demo-1 用一句话说明 OAMP 是什么","one_shot":true}'
```

期望输出（`task_id` / `message_id` 每次不同；派发成功时 `warning` 为 `null`）：

```json
{"chat_id":"chat-demo-model","task_id":"task-7e2a4d73-2982-491f-a58f-2cf9555deb97","message_id":"msg-35ce05e7-9cd5-4f5f-9e78-14431c8bccfa","warning":null}
```

```json
{"chat_id":"chat-demo-oneshot","task_id":"task-679fcf43-a2e4-47e8-a9ae-8eb5aa20c950","message_id":"msg-6568826c-eb89-4aef-b020-4f64506f5bb1","warning":null}
```

> 回答不在此响应里：用 §5.5 的流订阅实时收取，或稍后 `GET /api/chats/<chat_id>` 读结果。

无副作用的确定性演示（不经模型，直接在本机执行 shell）：

```sh
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent_id":"demo-1","text":"!echo hello-oamp"}'
```

```json
{"chat_id":"chat-demo-shell","task_id":"task-ff43186d-fe02-499e-9382-c509ca70cd79","message_id":"msg-2d515f9b-2073-4aab-b9f5-7031940e4f0a","warning":null}
```

### 5.5 订阅对话流（`curl -N`）

终端 A（订阅，保持不关）：

```sh
curl -N 'http://127.0.0.1:7788/api/stream?chat_id=chat-demo-shell'
```

终端 B（触发一次执行）：

```sh
curl -s -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"chat_id":"chat-demo-shell","agent_id":"demo-1","text":"!echo hello-oamp"}'
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

### 5.6 订阅全局事件流，观察 agent 上下线（`curl -N`）

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

### 5.7 归档 / 激活 / 改名

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

### 5.8 错误样例

```sh
# 未知对话 → 404 NOT_FOUND
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:7788/api/chats/chat-nope

# 缺 chat_id 的订阅 → 400 INVALID_PARAM
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:7788/api/stream

# 非法的 state 过滤值 → 400 INVALID_PARAM
curl -s -w '\nHTTP %{http_code}\n' 'http://127.0.0.1:7788/api/agents?state=bogus'

# 非法 model 形态 → 400 INVALID_PARAM
curl -s -w '\nHTTP %{http_code}\n' -X POST http://127.0.0.1:7788/api/messages \
  -H 'content-type: application/json' \
  -d '{"agent_id":"demo-1","text":"你好","model":"bad model!"}'
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

### 5.9 极简 Node 客户端订阅示例（零依赖，Node ≥ 22）

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

### 5.10 最小接入闭环（伪代码）

```text
1. GET  /api/agents?state=online        → 找到目标实例（如 demo-1）
2. GET  /api/chats                      → 选中或新建对话 chat_id
3. GET  /api/stream?chat_id=<chat_id>   → 建立 SSE 订阅（另起协程持续读取）
4. GET  /api/events                     → 建立全局订阅（观察上下线，维护基线+增量）
5. POST /api/messages {chat_id, agent_id, text}
                                        → 200 {task_id, message_id, warning}
                                          warning 非空 ⇒ agent 不可达，稍后重发
6. 收 SSE：chat_state(working) → task_update* → message(out) → chat_state(completed)
                                        → 结果取 message(out).text
7. （可选）GET /api/chats/<chat_id> 全量校对；断线重连后重取基线与详情
```

---

## 6. 不做（范围边界）

本接口面**不提供**下列能力，文档也不描述它们的接入方式：

- ❌ **agent 启停接口 / 按钮**：没有任何启动、停止、重启 agent 的路由或参数（agent 由本机 CLI 负责）。
- ❌ **鉴权**：无 token / key / Cookie 校验，只有「仅回环地址」这一层边界。
- ❌ **跨机接入**：不监听非回环地址，不提供 TLS / 反向代理 / 端口转发说明。
- ❌ **tasks 接口**：Router 的任务面（`oamp task *`）不经 HTTP 暴露；这里只有「对话」这条线。
- ❌ **客户端 SDK / 适配器**：本文只定义接口，接入实现由各客户端自理。
- ❌ **UDS / JSON-RPC 协议**：那是进程间协议（Router ↔ agent ↔ web），外部客户端不直连、本文不覆盖。

两个容易混淆的口径，一并说明：

- `GET /api/agents` **无参时包含 `offline` 墓碑**；只要在线实例请用 `?state=online`。
- `POST /api/messages` 的「派发失败」是 **200 + `warning`**，不是 4xx/5xx。
