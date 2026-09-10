# F03：历史查询（列表 / 过滤 / 详情）

**功能 ID**: F03
**来源**: `demand.md` C-3（按 chat 列表检索 + 打开历史 chat 读取完整输入/输出序列）；N-4、N-5；裸判定 E-3
**迭代**: 0011-chat-context-protocol

---

## 用户价值

用户能按"什么时候、找哪个 agent、聊了什么"重新找到过去的对话，并完整读出当时的输入与输出。

## 验收标准

1. **列表**：可获取 chat 列表，每条含标题、状态、创建时间、更新时间，以及该 chat 关联的 agent 标示；列表中包含已关闭的 chat（C-1/C-3）。
2. **默认排序**：列表默认按最近更新时间倒序排列（默认排序规则 = `updated_at DESC, chat_id DESC`——见「架构维度」）`[model_inferred]`。
3. **按时间过滤**：可指定时间范围过滤 → 返回结果全部落在该范围内（C-3）。
4. **按状态过滤**：可指定状态过滤 → 返回结果的 chat 状态与条件一致（C-3）。
5. **按 agent 过滤**：可指定 agent 过滤 → 返回与该 agent 相关的 chat（"相关"的判定依据 = 该 chat 的默认 agent 是它，或它参与过该 chat 的某一轮——`chats.agent_id` / `messages.agent_id`）（C-3）。
6. **关键词过滤**：可指定关键词 → 命中 chat 标题或该 chat 的输入/输出文本（匹配范围 `[model_inferred]`；匹配方式 = SQL `LIKE` 字面匹配（ASCII 大小写不敏感）、`%`/`_` 转义、含已关闭 chat）（C-3）。
7. **组合生效**：多个过滤条件可同时使用 → 结果需同时满足全部条件（C-3）。
8. **详情**：打开一个历史 chat → 返回该 chat 的完整输入/输出序列，按时间升序排列，内容与持久化内容一致（C-3）。
9. **重启后可查（裸判定 E-3）**：重启服务后，历史 chat 列表与输入/输出序列仍完整可查（E-3）。

## 边界（不包含）

- 不做语义检索 / 相关度排序 / 增强全文索引（关键词为字面匹配；本迭代不做更强检索——LIKE 字面匹配已够用，FTS5 列为将来选项）——C-3 只要求"关键词过滤"。
- 不做跨 chat 的上下文共享（N-2）——查询只读历史记录，不改变任何上下文。
- 不做删除 / 归档 / 导出（同 F01 边界）。
- 不做鉴权与多用户可见性隔离（N-4）。
- 不做历史数据迁移（N-5）。

## 架构维度（阶段 3 已填，2026-09-10；详见 `architecture.md` §4.5/§4.6）

- **接口形态与返回结构**：`GET /api/chats?q=&agent=&state=&from=&to=&limit=&offset=` → `{ chats:[{chat_id,title,agent_id,state,created_at,updated_at,message_count}], total, limit, offset }`；`GET /api/chats/:id` → `{ chat:{…}, messages:[{id,direction,agent_id,text,model,duration_ms,error,created_at,meta}] }`（升序 `created_at ASC, id ASC`）。全部查询落在 SQLite（`persist.js`），不经 Router（历史真源为库）（对应验收 1/8）。
- **分页与排序**：`limit` 默认 50、上限 200，`offset` 默认 0（非法 → 400）；默认排序 `ORDER BY updated_at DESC, chat_id DESC`（第二键保证同毫秒下分页稳定，对应验收 2）。
- **时间过滤**：精度毫秒；基准 = `updated_at`（与默认排序同基准）；闭区间 `updated_at >= from AND updated_at <= to`，缺省不限，`from > to` → 400（对应验收 3）。
- **关键词匹配**：`chats.title LIKE :q` OR 存在 `messages.text LIKE :q` 的记录；大小写按 SQLite `LIKE` 语义（ASCII 不敏感，中文无大小写影响，不额外加 `lower()`）；用户输入中的 `\`/`%`/`_` 转义 + `ESCAPE`（否则单个 `%` 会命中全部）；**包含已关闭 chat**（列表本就含关闭，过滤不额外排除，对应验收 6）。
- **agent 相关性判定**：`chats.agent_id = :agent` OR `EXISTS(SELECT 1 FROM messages WHERE chat_id=chats.chat_id AND agent_id = :agent)` —— 即"该 chat 的默认 agent 是它，或它参与过该 chat 的某一轮"（`messages.agent_id` 是唯一能表达"参与过"的字段，对应验收 5）。全部条件以 AND 组合（对应验收 7）。
