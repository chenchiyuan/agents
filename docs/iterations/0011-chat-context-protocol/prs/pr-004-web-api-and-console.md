# pr-004 web HTTP 层 + 控制台前端

## 上下文摘要

把 web 从"Router 内存会话 + 轮询 + 消息即 shell 命令"改造为"读库 + 实时推送 + 三执行路径"的入口：`web.js` 改为读 SQLite（chats 列表/详情/关闭）、新增 `/api/stream`（SSE）与 `/api/chats/:id/close`、`POST /api/messages` 预生成 `task_id`、按 `!`/`one_shot`/默认 判定 payload、`onDeliver` 接 `task.update`/`task.result`/`notice` 完成落盘与状态机、启动扫尾；`web/*` 移除 1.5s 轮询改 `EventSource`（含重连全量拉取）并补齐关闭按钮/模型输入框/一次性开关/系统提示条；`test/web.test.js` 按新契约等价重写。web.js 与其前端是一次 HTTP 契约的两端，同 PR 交付；本 PR 是 web.js/前端/web.test.js 的唯一所有者。

## 涉及功能点

- F01（chat 容器与生命周期：新建即入列/标题/四态/时间戳/关闭/关闭不删数据）
- F02（对话持久化：web 侧落盘点与失败记录形态）
- F03（历史查询：HTTP 层列表/过滤/详情/分页）
- F04（实时展示：SSE 端点、四类事件、断线不丢内容、协议可替换的接线侧）
- F05（关闭 → 向该 chat 的 agent 发 `notice{context_release}`；SSE `notice` 系统提示条）
- F06（模型输入框、`model` 透传与每轮审计展示）
- F08（既有 web 交互保留 + `web.test.js` 的 F08-a~d 等价覆盖）

## 文件范围

- oamp/src/web.js（改造：读库路由 + SSE + close + payload 构造 + `onDeliver` + 启动扫尾 + 打开库）
- oamp/web/app.js（改造：SSE 订阅、关闭/模型/一次性交互、重连全量拉取）
- oamp/web/index.html（改造：关闭按钮、模型输入框、一次性开关、提示条容器）
- oamp/web/style.css（改造：上述控件与系统提示条样式）
- oamp/test/web.test.js（重写）

## 验收标准

- [ ] `GET /api/chats` 返回 `{chats:[{chat_id,title,agent_id,state,created_at,updated_at,message_count}],total,limit,offset}`，默认 `updated_at DESC, chat_id DESC`，列表含已关闭 chat；`q`/`agent`/`state`/`from`/`to` 可组合且同时满足；`limit` 非正整数或 &gt;200、`state` 非法、`from &gt; to` → 400
- [ ] `GET /api/chats/:id` 返回 `{chat, messages[]}`（`created_at ASC, id ASC`）；未知 chat → 明确的"不存在"错误（非 200 空体）
- [ ] `POST /api/messages`：新 chat 预生成 `chat-<uuid>` 与 `task-<uuid>`，`title = text.trim().slice(0,40)`，落 `messages(in)` + `chats(working)` 后立即向订阅者推 `message`/`chat_state`；成功终态再落 `messages(out)` + `completed`；库中一次问答恰 2 行
- [ ] 已关闭 chat 提交 → 409；派发失败 → 落一条 `out`（`error='dispatch_failed'`）+ `failed`；缺 agent 标识、空文本 → 400；`@agent 文本` 服务端兜底解析保留
- [ ] `POST /api/chats/:id/close` → `{chat_id,state:'closed'}` 幂等，并向该 chat 出现过的各 `DISTINCT agent_id` 发 `notice{kind:'context_release',chat_id}`（agent 离线忽略）
- [ ] 模型透传与每轮审计（F06）：请求携带 `model` 时派发 payload 含该值，该轮 `messages(out).model` 落盘为**实际生效**模型且 `GET /api/chats/:id` 可读到（F06-3）；未携带 `model` 时 payload 不带该键、交 agent 侧解析默认链（架构 §7.1/§7.2，web 不做二次解析、不注入默认值）；输出气泡元信息行展示该模型
- [ ] `GET /api/stream?chat_id=` 建立 SSE；`onDeliver` 收到 `task.update` → 推 `task_update`（不入库）、`task.result` → 落盘 + `message(out)` + `chat_state`、`notice` → 推 `notice`（不入库）；无订阅者丢弃；连接 close 清理订阅
- [ ] E-4：fake ACP 注入下，该轮 `message(out)` 事件之前收到 ≥2 个 `task_update` 且文本长度递增
- [ ] 断线/刷新恢复：页面加载与 `onopen` 全量拉取 `GET /api/chats/:id`，已落盘输入/输出完整呈现（F04-7）
- [ ] `oamp/test/web.test.js` 重写后逐条覆盖 F08-a~d（发送→任务→输出回流且列表 completed；追加同 chat 两条记录；缺 agent/空消息/未知 chat 错误面；静态页 + `/api/agents` 返回在线 agent），断言强度不低于原用例，另加落盘/SSE/关闭 409 断言；`node --test test/web.test.js` 全绿
- [ ] 前端：1.5s 轮询代码消失，`EventSource` 订阅生效；关闭按钮、模型输入框、一次性开关、系统提示条可用；`@` 补全与 `!` 命令提交保留（F08-4）

## 参考资料

- docs/iterations/0011-chat-context-protocol/architecture.md §4.3/§4.4（落盘时机与失败形态）、§4.5/§4.6（查询接口与过滤）、§5.1~§5.4（SSE 端点、事件模型、推送链、断线兜底）、§6.4/§10.2（关闭释放）、§9.1~§9.3（路由判定、既有交互保留、改造影响面）、§12（AR-08/AR-09/AR-10/AR-15）、§16.1
- docs/iterations/0011-chat-context-protocol/prd/F01~F08（F08 的等价重写口径见 F08 文件头部裁定与 §9.3 末段）
- oamp/src/web.js（现调用面：:174 `router.chat_list`、:180 `router.chat_get`、:209 `router.chat_message`；:18 `import { loadConfig }`）、oamp/web/app.js（现轮询与渲染）、oamp/test/web.test.js、oamp/test/helpers/harness.js

## depends_on

- pr-001-config-surface-and-persistence.md（理由：web 用 `config.dbPath` 打开库并调用 `persist.js` 的写入/查询/关闭/扫尾函数。证据：`oamp/src/web.js:18` 现为 `import { loadConfig } from './config.js'`，而现行 `oamp/src/config.js:30-44` 无 `dbPath` 键；且 `oamp/src/web.js:174/180/209` 现走 Router 会话 RPC，改造后由 persist 函数替代——persist 与 dbPath 均为 pr-001 产出）
- pr-002-sse-transport-abstraction.md（理由：web 在 `/api/stream` 调用 `createSseTransport()` 的 `handle/publish/closeAll`。证据：架构 §5.1 定义该导出，`oamp/src/transport.js` 由 pr-002 产出，现仓库中该文件不存在（`oamp/src/` 现为 agent/cli/config/log/node-client/registry/router/rpc/status/task/web.js），web 无法在 pr-002 合入前 import 到它）
- pr-003-context-pool-acp-daemon.md（理由：web 的默认执行路径 payload 为 `{executor:'omp-daemon', chat_id, prompt, model?}`（架构 §9.1），agent 侧只有 pr-003 新增 `parseTaskBody` 分支才受理。证据：现行 `oamp/src/agent.js:35-78` 只有 `executor:'omp'`（:50）与 `command`（:67）两条分支，`omp-daemon` payload 会落入 command 分支被拒收（'缺少非空 command'），pr-004 的"发送→落盘→终态"验收与 F08-a 等价断言在 pr-003 合入前无法成立；另 `notice` 事件由 pr-003 的池在淘汰/崩溃/释放时发出）

## batch

3
