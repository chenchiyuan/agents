# F01：标题行内编辑与提交（点击即编辑、预选、Enter/失焦保存、Esc 取消、失败恢复）

**功能 ID**: F01
**来源**: `demand.md` A-1（详情区标题点击即编辑）；决策 D-1；澄清 M-2 / M-7 / M-10；效果 E-1、E-2、E-3、E-4、E-8；边界 N-1 / N-2 / N-6
**迭代**: 0014-chat-rename

---

## 用户价值

在右侧详情点一下标题就能改名，不用先找按钮；编辑框里就是现在的名字，回车或点到别处就生效，改坏了按 Esc 就当没改过——改完的名字重启也还在。

## 验收标准

1. **点击标题即进入编辑（无需额外按钮）**：打开一条可编辑的对话（非只读，见 F03），点击详情区标题文本 → 该处变为可输入的编辑框；编辑框内**预填当前标题全文**，且文本处于**全部预选**状态（用户直接输入即整体替换）；未点击前标题是纯文本，不可输入（A-1 / D-1 / M-2 / E-1）。判定：点击前后观察该处的形态变化；框内文本与点击前的标题逐字一致，且处于预选状态。
2. **Enter 保存、失焦保存（同一保存语义的两种触发）**：编辑后按 Enter → 提交保存；编辑中点击标题以外的任意位置（含点击左栏另一条对话、点击详情区其他区域）→ 同样提交保存，等同 Enter（A-1 / D-1 / E-2、E-3）。判定：两种触发路径**分别**观察——保存后该处恢复为文本形态，且标题为新值；在编辑中点击另一条对话时，当前编辑的标题先按新值保存，再完成跳转 `[user_confirmed M-03 前半]`。
3. **Esc 取消，且取消优先于失焦**：编辑中按 Esc → 退出编辑、标题保持编辑前的原值，**不**发生保存；Esc 之后即使紧接着发生失焦，也不得因失焦触发保存（A-1 / D-1 / M-7 / E-4）`[user_confirmed M-03 后半]`。判定：按 Esc 后标题与保存前原值逐字一致；随后点击他处，标题仍为原值（未被补一次保存）。
4. **取消 / 未改动不产生保存结果**：进入编辑后未修改内容即 Enter 或失焦 → 视为未改动，不发生保存；Esc 取消同理（A-1） 。判定：编辑前后读标题一致，且界面不出现任何保存结果反馈。
5. **保存失败时恢复原值并给出提示**：保存未成功（网络或服务异常）时，标题**恢复为编辑前的原值**（不保留用户输入、不留下空标题），并在界面既有错误提示位置给出提示（M-10）`[user_confirmed M-04]`。判定：模拟保存失败后，读标题 = 编辑前原值，且可见错误提示。
6. **保存结果持久化**：保存成功后刷新页面或重启服务，该对话标题仍为新值（E-8）。判定：重启前后读取同一对话标题，逐字一致。

## 边界（不包含）

- 不含**校验规则**（trim、100 上限、空值拒绝、超长处理）——那是 F02。
- 不含**只读边界**（已归档 / 已关闭 / 空态不可编辑）——那是 F03。
- 不含改名成功后的**左栏同步与排序**（不置顶）——那是 F04。
- 不含**自动生成规则**的任何内容——那是 F05。
- 不做**左栏列表项的改名入口**（右键菜单 / 行内按钮 / 快捷操作）（N-1）——本迭代改名入口只有一个：详情区标题本身。
- 不做**批量改名**（N-2）。
- 不做**标题修改历史 / 撤销**（N-6）——Esc 只提供"本次改前放弃"，不保留历史版本。
- 不含详情区其他内容的编辑能力（对话正文、状态、所属 agent 等均不可编辑，demand 未要求）。

## 架构维度（阶段 3 已填，2026-09-11；详见 `architecture.md` §6.1 / §6.2 / §3.1 / §5.2 / §6.3 / §6.4）

- **AR-01 详情区标题的行内编辑承载**：`.detail-head` 内、`h1#detail-title` **之后**新增一个**静态兄弟节点** `<input id="detail-title-input" class="detail-title-input hidden" type="text" maxlength="100" autocomplete="off" />`（与既有 `#mention` 同款"静态节点 + `.hidden` 切换"；不动态 `createElement`、不用 `contenteditable`——后者没有 `maxlength` 语义且粘贴会带入富文本标记）。**进入编辑 = `beginTitleEdit()`**：`state.titleEdit = { chatId }` → 隐藏 `h1` → 显示 input → `input.value = chat.title`（**预填当前标题全文**）→ `input.focus()` 之后 `input.select()`（**全部预选**；顺序不可颠倒）。**四态（空态 / 只读 / 可编辑 / 编辑中）由 `renderTitle(chat)` 单一渲染落点决定**，且编辑中 early-return ⇒ 任何 SSE 触发的 `renderChat()` 都不会覆盖用户正在输入的内容、也不会关闭编辑态。`renderChat()` 的 `$('detail-title').textContent = chat.title`（`app.js:163`）与空态赋值（`:156`）分别改为 `renderTitle(chat)` / `renderTitle(null)`；空态分支同时清掉残余编辑态（`state.titleEdit = null`）。
- **AR-02 改名保存的写入路径形态**：写口 = `db.renameChat({ chatId, title })`；端点 = **`POST /api/chats/<chat_id>/rename`**（与既有 `<id>/close`、`<id>/activate` 同形，复用"预检 → 变更 → 最小响应"形态；**不引入 `PATCH`/`PUT`**）。请求体 `{ title }`；成功 `200 { chat_id, title }`（`title` = 服务端 trim 后的**权威值**，客户端不得自行 trim 后展示）；未知对话 `404`；只读对话 `409`；非法标题 `400`（`标题非法: …`）；畸形 JSON `400` / 超限 `413`（复用既有 `readBody` 的 `err.status` 语义与 `sendJson`）。**语句（硬契约，`architecture.md` §3.1）**：
  `UPDATE chats SET title = ? WHERE chat_id = ? AND archived_at IS NULL AND state != 'closed'` —— `SET` 子句**只有 `title` 一列**，`updated_at` / `agent_id` / `state` / `archived_at` / `closed_at` / `created_at` / `context_released` **逐列不被触碰**（逐列声明见 §3.1 表格）；以 `stmts.renameChat.run(...).changes > 0` 判定"是否真的写入"（包装函数返回 `string | null`；未写入 ⇒ 上层报 404/409，**绝不静默成功**）。**不复用 `upsertChat`**（`persist.js:150-156`）：它的 `ON CONFLICT DO UPDATE ... WHERE chats.state != 'closed'` 会让 closed 改名**静默失败**（且包装函数不读返回值）、`SET agent_id = excluded.agent_id` 会**覆盖所属 agent**、`SET updated_at = excluded.updated_at` 会**把对话顶到列表最前**（违反"不置顶"）、并且**完全不检查 `archived_at`**（归档对话也能被改）——四条同时违反 F03 / F04，逐条对照见 `architecture.md` §3.2。校验内建在写口内（见 AR-06）。
- **AR-03 保存触发的事件承载与优先级落点**：`bind()` 内新增三处绑定——`$('detail-title').onclick = beginTitleEdit`；`input.onblur = () => commitTitle()`；`input.addEventListener('keydown', ...)`：`Enter → commitTitle()`、`Escape → exitTitleEdit()`。**"Esc 优先于失焦"的实现位置 = `state.titleEdit` 唯一门控 + "先清 state、再复位 DOM"的调用顺序**：Esc 走 `exitTitleEdit()`（**第一行 `state.titleEdit = null`**，之后才隐藏 input），因此随后**必然发生**的 `blur` 在 `commitTitle()` 首行 `if (edit === null) return` 被挡掉；**不引入 `cancelled` 标志位、不动态 `removeEventListener`**。Enter 与失焦共用同一个 `commitTitle()`，并以 `state.titleEdit` 做幂等（进入函数即清）⇒ 一次编辑**恰好一次**提交：Enter 后的失焦、Esc 后的失焦均不产生第二次请求。三条路径的逐步推演见 `architecture.md` §6.3。
- **AR-04 保存失败提示的承载**：落**既有 `#hint` 行**（与 `openChat` / `send` / `closeCurrentChat` / `activate` / `archiveAll` 同一位置、同一 `hint error` 类）：`$('hint').className = 'hint error'; $('hint').textContent = \`改名失败：${err.message}\``；成功时清空该行。**不新增 toast / 模态 / 独立提示面**。
- **AR-05 改名成功后的界面回填方式**：**就地更新，不重新拉取**（理由与矩阵见 `architecture.md` §6.4）。成功响应的权威标题回填两处——`state.chat.title = r.title`（详情头）与 `state.chats` 中命中该 `chat_id` 的那一项（左栏），随后一次 `renderChats()` + `renderChat()`；**不调用 `loadChats()` / `refreshChat()`**（没有任何需要服务端重算的数据：排序键未变、`message_count` 未变、归档视图无关），从而保留"列表只在 `loadChats()` 时刷新"的既有数据流。**失败 / 取消 / 拒空 / 未改动四条路径共用同一个恢复动作**——`exitTitleEdit()` 把 `h1` 文本还原为 `chat.title`（该字段只在成功路径被改写）⇒ 无需各处各写一份回滚。
