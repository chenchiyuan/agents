# hub skill（oamp 调用面）

oamp 的调用面只有一条正路：经 `hub`。它把三层入口收敛成同一张子命令表：层 A `api`（Web 开放接口面）、层 B `uds`（Router 的 UDS 面）、层 C `cli`（oamp 既有命令面），另加自检 `doctor`。

本文件自包含：读完本文件即可照做，不需要先打开别的文件。边界只到子命令名：**选项、参数与字段一律以 `oamp/API.md` 为准**，本文件不复制它们。

## 何时用

下列六条是可判定的触发条件；六条都不命中时（例如只读本地文件、只看代码），不走 `hub`。

1. **派发角色任务**：要把一份任务交给某个 agent 实例去执行，而不是自己在本地跑。
2. **取调用终态**：要知道某次调用最后是成功、失败，还是产出了什么。
3. **取过程记录（转录）**：要逐条看某次调用中间发生了什么；包括正文被截断、需要自行重建全文的场景。
4. **订阅事件**：要持续接收事件流（全局 / 单对话 / 单调用）。
5. **盘点实例状态**：要看清当前有哪些实例、Router 侧拓扑是什么样。
6. **走既有运维命令**：要用 oamp 既有命令面（router / agent / web / cluster / task 等）。

## 怎么用

### 入口定位

先解析项目根：**项目根由调用方自行解析**（不由 cwd 推导），即调用方自己项目的绝对根路径。再按绝对路径拼出入口：

```sh
node "<项目根>/oamp/bin/hub.js" <层> <子命令> [选项]
```

库面用同一条模板：

```js
const { createHub } = await import('<项目根>/oamp/sdk/index.js');
const hub = await createHub();
```

定位只用"项目根 + 相对位置"表达：不需要先切到某个目录，也不依赖本机特有值。

### 层 A · api（21 条）

层 A 走 Web 开放接口面（HTTP / SSE），共 21 条：

- `api agents`
- `api chats list`
- `api chats get`
- `api chats close`
- `api chats archive`
- `api chats activate`
- `api chats rename`
- `api messages send`
- `api stream chat`
- `api stream events`
- `api docs`
- `api projects list`
- `api projects create`
- `api calls create`
- `api calls list`
- `api stream calls`
- `api stream call`
- `api calls transcript`
- `api calls get`
- `api confirmations list`
- `api confirmations decide`

### 层 B · uds（8 条）

层 B 走 Router 的 UDS 面（JSON-RPC），共 8 条：

- `uds agent.register`
- `uds agent.heartbeat`
- `uds agent.deregister`
- `uds message.send`
- `uds message.ack`
- `uds router.status`
- `uds router.task_get`
- `uds router.task_list`

### 层 C · cli（11 条）

层 C 透传 oamp 既有命令面，共 11 条：

- `cli router start`
- `cli agent start`
- `cli status`
- `cli task send`
- `cli task status`
- `cli task list`
- `cli task watch`
- `cli web start`
- `cli cluster up`
- `cli cluster down`
- `cli cluster status`

### doctor（自检）

`doctor`：自检（不属于三层封装）。它是第四个顶层入口，对三个面做自检，不对应单一端点 / 单一方法 / 单一既有命令。

### 序列 1：派发 → 取终态

1. 派发：`node "<项目根>/oamp/bin/hub.js" api calls create`，拿到这次调用的 `call_id`。
2. 取终态：`node "<项目根>/oamp/bin/hub.js" api calls get <call_id>`，读该调用的终态信封。

### 序列 2：截断恢复

终态信封里，正文超过上限时会被标记为已截断，此时正文字段不完整。恢复全文是两条既有子命令的组合，**由消费方自行拼接**：

1. 取终态：`node "<项目根>/oamp/bin/hub.js" api calls get <call_id>`，看是否命中截断标记。
2. 取过程记录：`node "<项目根>/oamp/bin/hub.js" api calls transcript <call_id>`，拿到过程条目。
3. 消费方自行拼接过程条目与终态体，重建全文。清单里没有"一步恢复全文"的专用命令，SDK 也不代做正文重建。

### 序列 3：事件订阅

按作用域择一，前台持续输出：

1. 全局：`node "<项目根>/oamp/bin/hub.js" api stream events`
2. 单对话：`node "<项目根>/oamp/bin/hub.js" api stream chat <chat_id>`
3. 单调用：`node "<项目根>/oamp/bin/hub.js" api stream call <call_id>`

### 序列 4：状态盘点

1. `node "<项目根>/oamp/bin/hub.js" api agents`：实例清单。
2. `node "<项目根>/oamp/bin/hub.js" uds router.status`：Router 侧拓扑。
3. `node "<项目根>/oamp/bin/hub.js" cli status`：既有命令面。

四条序列只给到子命令名与位置参数占位符；每一步的选项与字段以 `oamp/API.md` 为准。

## 红线

1. **不裸写 HTTP**：一律经 `hub` 子命令或 SDK 方法去访问这些面，不要手写 socket、自建 HTTP 客户端、自己拼请求。
2. **不复制 schema**：本文件只到子命令名；选项、参数与字段以 `oamp/API.md` 为准，不要在别处再记一份。
3. **退出码语义**：`0` 成功；`1` 业务失败；`2` 用法错误（本地参数解析失败，未发出请求）；`3` 连接失败（连不上、超时、上游不可达）。只凭退出码与输出即可判成败，不要自行重新归类。
