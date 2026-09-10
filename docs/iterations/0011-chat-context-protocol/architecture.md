# 技术架构：对话与上下文规范（迭代 0011）

**版本**：0.2.0（方案定稿待审）　**日期**：2026-09-10　**状态**：用户四点反馈已并入（DB=配置文件驱动/默认 data/sql.db、不主动回收、默认 gpt-5.6-luna、先审方案后开工）
**前置**：迭代 0010 `oamp/`（Router/agent/web 已落地，64/64 测试）；本方案为其演进，**分支从 0010 拉出**。

---

## 0. 一句话架构

> web 负责"落盘与推送"（SQLite + 可替换协议层），agent 负责"上下文"（per-chat 常驻 omp daemon 池），Router 继续负责"路由与运行态"。

## 1. 组件与职责（变更标记）

```
浏览器 ──HTTP/SSE（协议层抽象，可换 WS）──> web 服务（oamp web）
                                              ├─ SQLite 持久层（新增）
                                              ├─ 事件总线/SSE 推送（新增）
                                              └─ RpcPeer/NodeClient ──UDS──> Router（不变）
Router：注册表 + 租约 + 任务表（过程/运行态）+ 会话表（运行态缓存）
agent（dev-1/verify-1 进程）：
   ├─ 上下文池（新增）：per-chat 常驻 omp acp 子进程 + 串行队列
   └─ 执行器路由：omp-daemon（新，默认） | omp（一次性 -p，保留） | shell（保留）
```

| 组件 | 新增/变更 | 职责 |
|---|---|---|
| web 持久层 | 新增 `src/persist.js` | SQLite schema/写入/查询（仅输入输出） |
| web 协议层 | 新增 `src/stream.js` + `src/transport.js` | Transport 接口 + SSE 实现（预留 WS 替换点） |
| web API | 扩展 | 历史列表/检索、chat 详情（读库）、发送、SSE 订阅 |
| agent 上下文池 | 新增 `src/context-pool.js` + `src/acp-client.js` | per-chat omp acp 进程生命周期、多轮 prompt、串行队列、上限/TTL |
| agent 执行器 | 扩展 | `executor:'omp-daemon'`（默认）路由到上下文池 |
| 前端 | 改造 | SSE 订阅实时渲染；历史列表来自 SQLite |

## 2. 上下文规范（核心设计 D-11）

### 2.1 键与生命周期

| 维度 | 规则 |
|---|---|
| 键 | `(chat_id, agent_id)` → 一个 **Context Session** = 一个常驻 `omp acp` 子进程 + 一个 ACP sessionId |
| 创建 | 该 chat 对该 agent 首次调用时懒创建：`spawn omp acp --model <默认模型> --no-tools --no-skills --no-rules`（见 §5 初始化等待） |
| 复用 | 同键后续调用复用同进程 + 同 ACP session（`session/prompt` 多轮，上下文累积——V-1 实测） |
| 隔离 | 新 chat → 新键 → 新进程（全新上下文）；同 chat 不同 agent → 不同进程 |
| 并发 | **同键串行**（单 in-flight prompt + 队列）；不同键并行 |
| 上限 | 全局 `OAMP_CTX_MAX`（默认 8）LRU 回收；回收 = 关闭进程（上下文随之丢弃） |
| 空闲回收 | **不主动 TTL 回收**（用户决策 2026-09-10）：进程存活至 chat 关闭或超上限；长期对话不失忆，代价是内存占用（风险见 R-1/R-2） |
| chat 结束/删除 | 关闭该 chat 的全部 Context Session |
| 崩溃 | omp 进程异常退出 → 该键重建（新上下文），并在对话内以 `system` 消息提示"上下文已重置" |

### 2.2 上下文归属

上下文池位于 **agent 进程内**（满足"每个 agent 管理自己的上下文"）：agent 全局注册一个身份（如 `dev-1`），但为**每个 chat** 持有一个 omp 子进程。web/CLI 下发的任务 payload 携带 `chat_id`，agent 据此选择/创建上下文。

### 2.3 数据流（一次提问）

```
浏览器 POST /api/messages {chat_id?, agent_id, text}
  → web: 立即写 SQLite（direction='in'）+ 分配 chat_id + send task.request{executor:'omp-daemon', chat_id, prompt}
  → Router 转发 → agent: 取 (chat_id, agent_id) 的 Context Session（无则创建）
      → ACP session/prompt（流式）→ 每个 chunk 作为 task.update{kind:'stream'} 回流
  → web 轮询 Router 任务增量（或 Router 事件订阅）→ SSE 推浏览器（实时展示，不入库）
  → agent 完成 → task.result{text} → web 写 SQLite（direction='out'）+ SSE 推终态
```

## 3. 持久化（SQLite，D-12）

文件路径**由配置文件决定**（用户决策 2026-09-10），默认 `data/sql.db`（相对 `oamp/` 包根 → `oamp/data/sql.db`）。
解析优先级：`OAMP_DB` env > 配置文件 > 默认 `data/sql.db`。

**配置文件**（本迭代引入，替代 0010 的"无配置面"约束）：`oamp/config.json`（JSON，零依赖解析；缺失则全用默认值）：

```json
{
  "data": { "db": "data/sql.db" },
  "defaults": { "model": "openai/gpt-5.6-luna" }
}
```
`oamp/data/` 加入 `.gitignore`（运行时数据目录）。实现：`node:sqlite`（零依赖，V-3）。

```sql
CREATE TABLE IF NOT EXISTS chats (
  chat_id     TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  agent_id    TEXT,                 -- 会话绑定的默认 agent（可空）
  state       TEXT NOT NULL DEFAULT 'idle',  -- idle|working|completed|failed|closed
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  closed_at   INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     TEXT NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
  direction   TEXT NOT NULL,        -- 'in' = A 的输入；'out' = B 的输出（唯一两类，N-1）
  agent_id    TEXT,
  text        TEXT NOT NULL,
  model       TEXT,                 -- 输出记录的模型（审计用）
  duration_ms INTEGER,
  error       TEXT,
  created_at  INTEGER NOT NULL,
  meta        TEXT                  -- JSON：task_id / exit 语义等
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
```

**查询 API**：
- `GET /api/chats?q=&agent=&state=&limit=&offset=` —— 标题/内容过滤（`q` 先 LIKE 匹配 title 与 messages.text）
- `GET /api/chats/:id` —— chat + 输入/输出序列（按时间）
- `GET /api/search?q=` —— 跨 chat 文本检索（LIKE；FTS5 列为开放问题）
- 写入：输入立即写；输出在 `task.result` 后写（含失败 error）；过程**永不入库**

**与 Router 会话表关系**：SQLite 为持久真源；Router 内存会话表退化为运行态缓存（可在后续迭代精简）。

## 4. 协议层抽象（实时展示，D-13）

```js
// src/transport.js —— 面向浏览器的推送抽象（本版 SSE，未来 WS 同接口）
export function createTransport() {
  return {
    kind: 'sse',
    handle(req, res, { chatId }),   // 建立订阅
    publish(chatId, event),          // {type:'message'|'task_update'|'chat_state', data}
    close(chatId),
  };
}
```
- 本版：`GET /api/stream?chat_id=` → `text/event-stream`，事件类型 `message` / `task_update` / `chat_state`；心跳注释行保活。
- 未来：新增 `createWebSocketTransport()` 实现同一接口（引入 `ws` 依赖时再切换，前端订阅 URL 从配置读取）。
- 过程来源：web 轮询 Router 任务增量（500ms，内存态代价低）；**可选增强**：Router 提供事件订阅 RPC（长轮询），列入开放问题。

## 5. 模型与 ACP 细则（D-14）

- **默认模型**：`openai/gpt-5.6-luna`（V-2；"gpt-5.6"的实名）。优先级：`payload.model` > `OAMP_OMP_MODEL` env > 默认。
- **ACP 客户端**（`src/acp-client.js`）：stdio JSON-RPC；`initialize` → `session/new` → **等初始化通知流稳定**（V-5：omp 会灌入 skills 列表；`--no-skills --no-rules` 后仍需等待首个 `session_info_update`/短暂静默）→ `session/prompt`（流式 `session/update.agent_message_chunk` 拼接 + `stopReason`）。
- 工具：默认 `--no-tools`（问答）。需要 agent 干活时透传 `tools:true` → 不加 `--no-tools`（并需处理 ACP 权限请求；列入开放问题）。
- 超时：`timeout_ms` 默认 300s；超时 → 终止当前 prompt（`session/cancel` 或杀进程重建）。

## 6. 前端改造

- 订阅 SSE（替代 1.5s 轮询）：`EventSource('/api/stream?chat_id=…')`；`task_update` 增量渲染（流式输出逐字/逐行可见）；`message` 触发输入/输出落列。
- 历史：列表与详情改为读 SQLite API（`GET /api/chats`、`GET /api/chats/:id`）。
- 视觉保留 0010 风格（左列表/右详情/@补全）；新增"上下文"轻提示（本 chat 内的 agent 上下文持续中）。

## 7. 实施步骤（建议 PR 划分）

| PR | 内容 | 依赖 | 验收 |
|---|---|---|---|
| PR-1 | SQLite 持久层（schema/写入/查询）+ 单测 | — | 输入/输出入库、重启后可查、过程不入库（E-3/E-5） |
| PR-2 | 协议层抽象 + SSE 端点 + 前端订阅（实时展示） | PR-1 | 流式输出在完成前可见（E-4） |
| PR-3 | agent 上下文池 + acp-client + `executor:'omp-daemon'`（含 fake ACP 注入测试、串行队列、上限/TTL） | — | 同 chat 两轮记忆 42（E-1）、新 chat 不记得（E-2）、pid 复用（E-1 后半） |
| PR-4 | 端到端串接（web 传 chat_id、agent 池、SSE、落地）+ 契约测试 + 文档 | PR-1..3 | E-1~E-5 全绿；`npm test` 全量回归 |

测试策略：ACP 路径用 `OAMP_OMP_BIN` 注入 **fake ACP server**（脚本模拟 initialize/session/new/prompt 并保持 per-session 记忆）——不依赖真实 LLM/外网；真实 omp 由手工端到端验证（用户案例：数字记忆 + 新 chat 隔离）。

## 8. 风险与开放问题

| # | 项 | 说明 | 倾向 |
|---|---|---|---|
| R-1 | 常驻进程资源 | 每 (chat, agent) 一个 omp 进程（内存百 MB 级）；**不主动回收**下多 chat 长期累积 | 全局上限 `OAMP_CTX_MAX`（默认 8）+ LRU 淘汰最久未用；上线前实测单进程内存与 N=8 总量 |
| R-2 | LRU 淘汰即上下文丢失 | 超上限被淘汰的 chat 上下文丢失（非空闲，而是容量压力） | 对话内 system 提示"上下文已释放"；后续评估 ACP `session/load` 恢复 |
| R-3 | ACP 稳定性 | omp acp 非交互场景未见长期运行验证 | 崩溃重建 + system 提示；列入压测 |
| R-4 | 初始化开销 | 每新 chat 冷启动 ~1-3s（含 skills 通知） | `--no-skills --no-rules` 精简（已实测）+ 懒创建 |
| R-5 | 过程推送时效 | web 轮询 Router（500ms）非真推送 | 本版可接受；可选：Router 事件订阅 RPC |
| R-6 | 工具权限（tools:true） | ACP 权限请求需客户端应答策略 | 本版默认 `--no-tools`；工具模式列入后续 |
| R-7 | FTS 全文检索 | LIKE 够用但弱 | 开放；数据量大时加 FTS5 |
| R-8 | 旧内存会话数据 | 0010 的 Router 内存会话不迁移 | 新库空启动（N-5），Router 会话表退化为缓存 |

## 9. 用户确认记录（2026-09-10，user_confirmed）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 数据库位置 | **配置文件驱动**：新增 `oamp/config.json`（JSON，零依赖），默认 `data/sql.db`（→ `oamp/data/sql.db`）；`OAMP_DB` env 可覆盖 |
| 2 | 空闲回收 | **不主动 TTL 回收**；仅受全局上限 `OAMP_CTX_MAX`（默认 8）约束，超出 LRU 淘汰最久未用 |
| 3 | 默认模型 | `openai/gpt-5.6-luna`（payload.model > env > config.defaults.model > 默认） |
| 4 | 流程 | **先审方案**：本文件 + demand.md 经用户审阅确认后开工；实施在新分支 `iteration/0011-chat-context-protocol`（PR-1..4） |

### 实施前置（开工时先做的小项）

- `oamp/config.json` 加载器（`src/config.js` 扩展：JSON 文件 + env 覆盖 + 默认值；非法 JSON 快速失败）
- `oamp/data/` 加入 `.gitignore`；配置加载单测
