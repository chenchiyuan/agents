# deferred-demand-changes.md — 0028-role-model-binding

> **本文件的语义（按 D-7 / D-11 决定）**：同时承载两类条目，用二级标题分区，条目用三级标题。
> - **`## 需求变更`**：沿用既有语义——执行角色发现"要改 demand.md 结论才能解决"的问题时追加，供下迭代决策。
> - **`## 执行方式差距`**：本迭代专用——hub 派发与本地 subagent 的冲突/差距，每条四要素（现象 / 差异 / 证据 / 影响）。
> - **`## 澄清期登记的冲突`**：澄清阶段发现的冲突（来源 `demand.md` 第一段 §四），供阶段 6 核查"至少收录 C-1~C-4"。

---

## 需求变更

（暂无。本迭代为对已落盘需求的确定性还原；执行角色若发现需求层问题，在此分区追加。）

---

## 执行方式差距

### G-1 · 前置验证与真源唯一在机制上互斥

- **现象**：前置常驻验证（D-8）要求让节点用 gpt/grok 跑一次，而正式派发的真源契约（D-5）禁止携带 `model`；两者不能同时成立，必须开例外。
- **差异**：本地 subagent 派发无此问题——宿主工具在每次派发的参数里直接带模型，不存在"角色级真源 vs 派发级覆盖"的双层语义，也不需要在流程契约里为验证动作开口子。
- **证据**：`demand.md` D-5 / D-8 / D-14；探针调用 `task-bfd83f28-2078-434b-8a16-eac455d2e999`（pb-dev，实报 `openai/gpt-5.6-luna`）、`task-39204abd-38ab-4971-b785-3eed6b0bb835`（pb-verifier，实报 `powerby/grok-4.6`），两条均在 `--model` 显式携带下完成。
- **影响**：真源链上存在一条已关闭的例外；下迭代若要在绑定生效前做任何按模型区分的验证，都会再次撞上同一冲突，需要设计一条通用且可留痕的验证通道。
- **D-14 例外留痕**（三段；判据 = `prd/F12` 验收 5）：**范围** = 只覆盖探针期，且只覆盖 gpt 与 grok 两条常驻探针（`demand.md` D-14「开一条只用于探针的 per-call `model` 例外，探针后关闭并记入差距记录」、D-15「仅 gpt 与 grok 两个后端」）；**时点** = 20:52（`task-bfd83f28-2078-434b-8a16-eac455d2e999`，`pb-dev`）与 20:56（`task-39204abd-38ab-4971-b785-3eed6b0bb835`，`pb-verifier`），与 `status.md` §派发台账前两行（`status.md:62` / `:63`）逐条对应；**关闭状态** = 已关闭（`status.md:54` 载「正式派发不带 `model`（探针专用例外已于探针完成后关闭）」）——无独立关闭时点记录（以两条探针为界，台账未记该时点）。

### G-2 · brief 全文注入在 hub 层 A 没有文件通道

- **现象**：workflow-pb 的 brief 契约要求把角色定义**全文逐行注入**（`roles/prd/prd.md` 约 5.2KB 多行文本 + 固定字段），而 hub 层 A 的 `--task` 只接受字面字符串：全仓检索确认没有任何 `@file` / stdin 读参路径（`@file` 仅存在于旧命令面 `oamp task send`）。
- **差异**：本地 subagent 走宿主工具的字符串参数，长文本无转义问题；hub 侧必须靠 shell 命令替换（`--task "$(cat <brief>)"`）传递，多行内容、反引号与 `$` 都处于转义风险中。
- **证据**：`oamp/sdk/cli.js`、`oamp/sdk/surface.js` 无文件读参分支；`grep '@file'` 仅命中 `src/cli.js:10`（旧 CLI 的 `task send`）；本次阶段 2 派发的 brief 长 5267 字符，实发成功（call `task-8e84f95f-b783-4477-8054-abf0b36f31ec`）。
- **复核（本 PR 执行时点，路径锚点全称）**：`grep -n '@file' oamp/src/cli.js` ⇒ 命中 `10:  oamp task send <instance-id> '<json>'|@file [--as <id>]` —— 上文 `src/cli.js:10` 的完整锚点为 `oamp/src/cli.js:10`（该路径以仓库根为基准，`oamp/` 前缀为必填；本 worktree 内 `test -e src/cli.js` 未命中、`test -e oamp/src/cli.js` 命中）。
- **影响**：每次派发的传参方式都是隐式约定，没有契约承载；一旦 brief 里出现未转义字符就会静默截断/变形，而产物错误要等到阶段验证才发现。

### G-3 · 派发必须 chat_id 前置，而建 chat 无独立端点

- **现象**：`api calls create` 强制要求已存在的 `chat_id`（`API.md:702`），但对话创建只发生在 `POST /api/messages`（新建必带 `project_id`）。⇒ 想要"一个迭代一个 chat"，就必须先发生一次消息型调用，而这个调用会真实占用一个角色节点。
- **差异**：本地 subagent 派发是一次调用即完成，没有"会话容器必须先存在"的前置步骤。
- **证据**：首次建 chat 由探针消息完成（`chat-6c89902c-0a9f-4513-a299-90a7f98ae611`，`message_id` `msg-9f62bf12-5733-4b82-ba13-f26c6ba7f679`）。
- **影响**：迭代的 chat 时间线必然以一次真实调用开头（本次是探针）；若迭代首步不允许产生调用，就需要另设建 chat 机制。

### G-4 · 已实现的等待能力被重新包了一层（本次执行偏差点，已被用户指出）

- **现象**：主 agent 首次派发时自行搭了 subprocess 包装 + 自写轮询循环去取终态，而 hub 层 A 已实现 `api calls create --wait`（缺省上限 30 分钟）与 `api stream call`（流式直到终态）。
- **差异**：本地 subagent 的"等待终态"由宿主工具天然承担，不会诱发自建轮询；hub 侧因为返回 `submitted` 信封，容易下意识补一层循环——这正是需要被契约约束的惯性。
- **证据**：本次执行记录（`subprocess` + `poll()` 自建循环，随后被用户指出）；对照 `oamp/sdk/cli.js:18/254`（`--wait` 缺省 1800000ms）与 CLI 的 `api stream call` 条目。
- **复核（本 PR 执行时点，弱锚点增补）**：`grep -n 'G-4' status.md` ⇒ 命中 `50:- **等待终态**：… **不自建轮询或包装脚本（G-4）**`，该行同时载明正式写法 `api calls create --mode block --wait 3600000` 与 `api stream call <call_id>`；`grep -n "kind === 'stream'" oamp/sdk/cli.js` ⇒ 命中 `259:    if (entry.kind === 'stream') return await runStream(ctx, entry, params, parsed.human);`。
- **影响**：**纠正规范**——新建调用用 `api calls create --mode block --wait <ms>`（阻塞取终态），已存在调用用 `api stream call <call_id>`，不得自建轮询或包装脚本；否则每次演示都要多出一层未受契约覆盖的代码。

### G-5 · 终态信封被截断，全文必须两步拼接

- **现象**：`prd` 派发的终态信封 `truncated: true`，`text` 只有 **3632** 字符；该次产出的完整正文经 `api calls transcript` 拼回为 **7078** 字符（含报告契约 1~5 全文）⇒ 拿到全文必须由消费方执行"读信封 + 取转录 + 自行拼接"两步。
- **差异**：本地 subagent 的最终产出一次性完整交回宿主，不存在"信封截断 + 自行拼接过程记录"这一层；D-10 的信号 ③（无需人工搬运中间产物即可继续）在 hub 侧**首次真实角色派发即不成立**。
- **证据**：call `task-8e84f95f-b783-4477-8054-abf0b36f31ec` —— `hub api calls get` 的 `truncated: true` 与 `text` 长度 3632；`hub api calls transcript` 拼回 7078 字符（报告契约 1~5、架构待填 A-01~A-04、MI-1~MI-6 均在其中）。按 D-16 判定为等价性缺口。
- **影响**：阶段 2~6 的每一次派发都要多一步产出回收且不可省略；后续同现象条目按 D-16 聚合到本条。**聚合记录**：第 2 次同类现象出现在阶段 2 修订轮（call `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb`，`prd`，119s，终态 `truncated: true`）。
- **聚合记录（本 PR 执行时点复核，覆盖率 100%，逐行无抽样）**：`status.md` §派发台账（`status.md:58-82`）23 行的 `truncated` 逐行核对 ⇒ `true` **19** 行、`false` 3 行（20:52 `task-bfd83f28-2078-434b-8a16-eac455d2e999`；20:56 `task-39204abd-38ab-4971-b785-3eed6b0bb835`；22:17 `task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e`）、执行时点仍在途 1 行（09:06 `task-92f31d55-3789-4184-a850-a43df30e54be`，终态未到，见 G-14）。19 行逐条（时点 / 角色 / `call_id`）：
  - 20:56 `prd` `task-8e84f95f-b783-4477-8054-abf0b36f31ec`（本条正文所记首例）
  - 21:06 `prd` `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb`
  - 21:09 `architect` `task-191d2e14-e852-412d-ab90-e6fc00092928`（`status.md:66`，终态 `failed`／`error: timeout`，终态信封不可得 ⇒ 同时按 `prd/F11` 验收 2 ③ 记入 G-14）
  - 22:03 `pr-planner` `task-db950070-445a-492f-8f58-5bbd95c20c9f`
  - 22:32 `planner` `task-d76732bb-fd6c-480c-b1af-abd4f1726a3a`
  - 22:32 `planner` `task-ece7344d-f237-4cde-b890-94bccfa0815c`
  - 22:32 `planner` `task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068`
  - 22:41 `dev` `task-4d88d08b-f977-4314-813e-e8dfc49c89df`
  - 22:41 `dev` `task-4b8e1399-36ce-47e2-8a66-09293eb8725c`
  - 22:41 `dev` `task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e`
  - 23:13 `verifier` `task-def5a04f-85a6-42b8-8dd5-c5f261e5171a`
  - 23:13 `verifier` `task-5585d411-a3cc-46cf-8a1f-31baccfd03b5`
  - 23:15 `verifier` `task-637e830a-a4f0-4318-9650-16b72eedeb82`
  - 08:48 `pr-planner` `task-05e21d21-1f3f-4619-bef1-38b2f64a549b`（台账该行 `truncated` 记 `—`；执行时点 `api calls get` 回读 `truncated: true`）
  - 08:48 `dev` `task-07508a08-32a3-4e12-86ea-34e856c09b6f`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 08:50 `planner` `task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 08:50 `progress-observer` `task-c0acdd24-c873-4b27-b9fa-e1019949456e`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 09:06 `dev` `task-2a20f315-586c-4206-969d-b421e6254fa8`（台账终态记 `submitted`；执行时点回读 `completed` + `truncated: true`）
  - 09:06 `verifier` `task-fc99395f-d815-4b2b-83c6-24696a18bdc1`（台账终态记 `submitted`；执行时点回读 `completed` + `truncated: true`）

### G-6 · 过程记录存在 1001 条上限（中段过程不可回溯）

- **现象**：`api calls transcript` 返回 `entries` 恰好 **1001** 条、响应顶层 `truncated: true`；首条为 `started`、末条为 `result`（时间戳跨度覆盖该次调用全程 366s），且**无逐条截断标记** ⇒ 被裁剪的是**中段**过程条目。本次过程构成为 `tool_call` 751 / `thinking` 209 / `chunk` 37 / `tool_output` 2 / `started` 1 / `result` 1。
- **差异**：本地 subagent 的过程记录由宿主完整保存，不经固定条数上限；hub 侧长任务的过程记录会丢中段——"过程可回溯"发生降级。
- **证据**：`hub api calls transcript task-8e84f95f-b783-4477-8054-abf0b36f31ec` 原始响应（1001 条 / 顶层 `truncated: true` / 首末条目完整）。
- **影响**：终态正文可恢复（见 G-5），但若某次派发的关键判断发生在被裁掉的中段，事后无法复现；对"验证产物质量靠过程证据"的场景是结构性限制。

### G-7 · `--wait` 单独不阻塞：必须配 `--mode block`

- **现象**：`hub api calls create … --wait 900000`（不带 `--mode`）**立即返回** `state: submitted`，不阻塞到终态。实现上 `--wait` 只是**本地等待上限**，仅对声明了 blocking 形态的条目生效（`sdk/cli.js:254`：`waitMs` 作为本地上限传入）；真正取终态要么加 `--mode block`，要么事后用 `api calls get` / `api stream call`。
- **差异**：本地 subagent 派发天然是"发起即等结果"的单一语义，没有"后台/阻塞两种形态 + 一个听起来像阻塞的选项名"这一层；hub 侧选项名（`--wait`）与实际行为不一致，极易误用——本次即误用一次。
- **证据**：派发命令 `api calls create --chat-id chat-6c89902c… --agent prd --task … --wait 900000` 返回 `{"state":"submitted", …}`（call `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb`）；对照 `oamp/sdk/cli.js:18/254` 与 `API.md` §3.14 的 `mode` 字段说明（`background` 立即受理 / `block` 挂起至终态）。
- **影响**：派发规范需固定写法——正式角色派发用 `--mode block --wait`；需要并行发起时用 `background` + `api stream call` 分别等。
- **附注（同一形态的次生摩擦）**：`--mode block` 下 `call_id` 只在**终态返回时**才可读，因此"派发即登记台账"（F09 验收 4）在阻塞形态下没有直接可用值——只能事后用 `api calls list` 取最新一条回填（本次即如此：`task-191d2e14-e852-412d-ab90-e6fc00092928` 由 `api calls list` 取得）。并行发起（`background`）反而能立刻拿到 `call_id`，两种形态在"可取标识"的时机上相反。

### G-8 · hub 有"确认收件箱 + 控制台通知"面；本地 subagent 无对应物（本次已采纳为规范）

- **现象**：hub 侧存在完整链路——上游发起 `notice{kind:'confirmation_request'}` → web 进程在途表（`src/inbox.js`）→ 全局 `confirmation` 帧 → 控制台通知（`web/notify.js` 的 `EVENT_TYPES` 含 `confirmation_required`）→ 用户在控制台裁决（`api confirmations decide`）→ 回传发起方。本次主 agent 以 `main` 身份经 `uds message.send` 上浮一条确认，Router 返回 `{"accepted":true,"status":"delivered"}`，`api confirmations list` 中立即可见。
- **差异**：本地 subagent 的"叫人回来判断"只能靠会话里的文本暂停，没有**独立通知面**，也没有"在途待裁决项"这一持久状态；hub 侧把"通知"与"裁决"拆成了两个独立动作（通知 ≥ 控制台提醒，裁决 = 显式选项回传）。
- **证据**：`cfm-f1296d32-8025-4ad8-a367-f08579e53517`（`request_kind: question`，`chat_id=chat-6c89902c…`，投递 `delivered`）；**回传闭环**：用户裁决后 web 回传 `notice{kind:'confirmation_decision', option_ids:['seen'], confirmation_id:cfm-f1296d32…}`（`message_id=ntc-fa1d54c8-f7f0-46a9-8d1b-846498b53055`，`from=web`）至 `main` 会话，裁决后在途表回空 `{"confirmations":[]}`；`oamp/src/inbox.js`（在途表 5 个导出函数）；`oamp/web/notify.js` 的 `EVENT_TYPES`。
- **影响**：**新增执行方式规范**——用户决策点走"双通道"：① hub 确认收件箱（通知 + 可裁决）；② 会话内暂停格式（保证判断内容本身有出处）。**裁决回传要求发起方保持在线身份**：一次性 CLI 调用收不到回传，故主 agent 需在会话内核持有常驻 `main` 会话（SDK `createHub().uds.connect({onDeliver})` + 周期心跳）。该约束是下一迭代的可优化点（例如给 CLI 增加"发起并等待裁决"的一次性入口）。

### G-9 · 单次调用有 30 分钟节点侧硬上限，调用面无法覆盖

- **现象**：`oamp/src/agent.js:31-32` 写死 `DEFAULT_OMP_TIMEOUT_MS = 1800000` 与 `MAX_TIMEOUT_MS = 1800000`（30 分钟）；任务体支持 `timeout_ms`，但**调用面不传该字段**（`oamp/src/web.js` 组装任务时无 `timeout_ms`）⇒ 经 hub 派发的每一次执行都固定在 30 分钟。客户端 `--wait` 可设更长（本迭代已按用户要求改为 60 分钟），但它只约束"本 agent 等多久"，不约束节点侧的执行上限。
- **差异**：本地 subagent 没有"单次执行 30 分钟"这一硬限，长任务只受会话生命周期约束；hub 侧的长任务会在 30 分钟处被节点判超时，而调用面没有"这次允许跑 60 分钟"的入口。
- **证据**：`oamp/src/agent.js:31-32`（常量；旁证 `timeout_ms 需为 1~600000 正整数` 的校验文案）；`oamp/src/web.js` 无 `timeout_ms` 组装；`oamp/sdk/cli.js:18` 的 `--wait` 缺省 1800000 与节点缺省同值（注释自述"逐字沿用既有 DEFAULT_OMP_TIMEOUT_MS"）。本迭代 `architect` 派发（`task-191d2e14…`，21:09 起）工具调用已达 900+ 条，属该类长任务。
- **影响**：① 本迭代等待口径 = 客户端 60 分钟 + 节点侧实际 30 分钟天花板（两者不一致；超时后调用仍在服务端进行，客户端本地中止 ≠ 调用取消）；② 放开该上限必须改 `oamp/src/agent.js`，与本迭代 F13 验收 1 的冻结面冲突 ⇒ **登记为下一迭代候选**：`MAX_TIMEOUT_MS` 提升到 ≥60 分钟，并给调用面（`calls create` / `messages send`）补 `timeout_ms` 透传入口。
- **实证（本迭代内即发生，不是理论风险）**：`architect` 派发 `task-191d2e14-e852-412d-ab90-e6fc00092928` 于 21:09 发起，**21:39 被节点侧判 `failed`**（终态信封：`error: timeout`、`duration_ms: 1802661`、`text: 轮次超时（1800000ms）`）——距发起 30 分 03 秒，与常量 `1800000` 精确吻合。客户端侧同一时刻另有一条独立证据：`--mode block --wait 1500000`（25 分钟）的调用方在 21:34 收到 `{"code":"WAIT_TIMEOUT","error":"等待超时（1500000ms）：调用仍在进行","exit_code":1}`，而调用当时仍在进行 ⇒ **本地等待超时 ≠ 调用被取消**（两条上限互不替代）。**处置**：产物在超时前已落盘（`architecture.md` 30.8KB + 13 卡架构补全 + §7 自检 + §8 补全记录），故本次以文件系统为准推进阶段 3；角色报告信封不可得，等价信息从产物 §5/§6/§7/§8 提取（记入 `history.md`）。**规避norm（本迭代生效）**：派发前评估任务量，长任务拆细以保证单次 <30 分钟（本次 `architect` 900+ 工具调用属超量派发的反例）。

### G-10 · 单一 chat 跨角色派发时，控制台的对话归属标签固定为首条消息的 agent

- **现象**：`chat.agent_id` 由**建 chat 的那条消息**决定（本迭代 = gpt 探针发给 `pb-dev`），此后同一 chat 内的所有派发（prd / architect / verifier…）都正确落在各自节点（消息级 `agent_id` 与调用 `agent` 字段均正确），但控制台的对话列表/对话头只显示 chat 级归属 ⇒ 显示为 `pb-dev`，与本迭代"多角色共用一 chat"的事实不一致；用户据此产生"是不是派错 agent 了"的疑问（本次由用户发现）。
- **差异**：本地 subagent 的派发在会话里逐条以工具调用呈现，目标角色与调用一一对应，没有"容器级归属"这一层；hub 侧 chat 是容器，其归属字段是单值且**无修改端点**（`api chats` 只有 list / get / close / archive / activate / rename，`rename` 只改 title）。
- **证据**：`hub api chats get chat-6c89902c…` → `chat.agent_id = pb-dev`，而同一 chat 内 `messages[].agent_id` = `pb-verifier` / `pb-prd` / `pb-architect`，`hub api calls list` 的 `agent` = dev / verifier / prd / architect；`oamp/sdk/surface.js` 的 chats 5 个端点中确无改归属项。
- **复核（本 PR 执行时点，端点计数）**：`grep -n "cmd: \['chats'" oamp/sdk/surface.js` ⇒ 命中 **6** 条（list / get / close / archive / activate / rename），其中 `rename` 的 `flags` 仅 `title`（`oamp/sdk/surface.js:144-148`）⇒ 端点计数应为 6（原文「5 个端点」为计数偏差），「确无改归属项」的结论不变。
- **影响**：① 已用既有 `api chats rename` 把该 chat 标题改为「【0028 迭代 · 多角色】role-model-binding（阶段 2~6 共用同一 chat）」，让标题承载真相（零代码、零配置改动，不触 F13 判据面）；② 人工巡查时**必须以消息级 / 调用级 agent 字段为准**，不得以对话归属标签推断派发目标；③ **下迭代候选**：控制台在对话内按消息级 agent 呈现，或支持多角色对话的归属表达。

### G-11 · 探针的 per-call `model` 会固化进该 chat 的常驻会话（"例外通道关闭"不等于"模型回退"）

- **现象**：`verifier` 的门禁验证调用（`task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e`，派发命令**不含** `--model`，且当时 `cluster.json` 里 `roles.verifier` 尚无 `model` 键）终态**实报 `powerby/grok-4.6`** —— 与 21:09 之前那次常驻探针（`task-39204abd…` 携带 `--model powerby/grok-4.6`）**同一个值**。即：探针期指定的模型在该 chat 的常驻会话上持续生效，后续同 chat 的正式派发仍跑 grok。
- **差异**：本地 subagent 没有"常驻会话"这一层，每次派发的模型参数只作用于该次；hub 侧常驻路径把**首轮（建键轮）的模型固化进常驻进程**，同一 chat 的后续轮只在进程内切换——因此"探针期带一次 `--model`"的副作用跨越了该 chat 的整个生命周期。
- **证据**：`oamp/src/agent.js:692`（`let residentModel = envModel || modelOverride || config.defaultModel; // 建键轮之前 = 启动解析值`）、`:767`（`resolveResidentModel: (model) => { residentModel = model; }`，注释自述"池在首轮懒建常驻会话 ⇒ 该轮模型即常驻进程的启动模型"）、`:360`（同义注释）；实报值对照：`calls get task-b755be9c…` 的 `model = powerby/grok-4.6`，而该次派发命令无 `--model`、配置无绑定。
- **影响**：① 本迭代 F02 验收 4 的**命令级**判据（除两条探针外派发不含 `--model`）仍然成立，但"正式派发的实报值来自角色级绑定或全局默认"这一*隐含预期*在主集群该 chat 内**不成立**（`pb-verifier` 被探针固化为 grok；同理 `pb-dev` 被固化为 gpt）；② 阶段 5 在主集群该 chat 内派发给 `pb-dev` 的 planner/dev 任务会实际跑在 **gpt** 上——不影响产物正确性，但会污染台账里"实报 model"的可解释性，且与 pr-008（F09/F10/F11 契约审计）的判据面直接相关，须在其验收前把本现象登记清楚；③ 第二集群不受影响（新库、新池、无历史建键）；④ 收口重启主集群（D-20）会清除该固化；⑤ **未决点（未在本迭代解决）**：无法从调用面区分"轮内切换失败静默保留"与"实报取的是建会话时的启动模型"——需在下一迭代做一次定向实验（同 chat 先带 model 调用一次、再不带 model 调用一次，比对 `calls transcript` 里的 `set_config_option` 轨迹）。

### G-12 · PR worktree 里没有迭代产物（产物在迭代工作区为 untracked，PR 分支拉出时看不到）

- **现象**：按 scm-protocol 规则 A/D，PR worktree 从**迭代分支**拉出；但阶段 1~3 的产物（`demand.md` / `prd.md` / `prd/**` / `architecture.md` / `prs/**` / `status.md` / `history.md` / `clarifications/**`）在迭代工作区里全部是 **untracked**（`git status` 报 `??`）⇒ 迭代分支上并没有它们，任何从迭代分支拉出的 PR worktree 里**都读不到这些文件**。而每个 PR 的「文件范围」又都要求它写入自己的 `prs/pr-{NNN}-*.md`（含「验收证据」小节）。
- **差异**：本地 subagent 在一个工作区里连续作业，"上一个角色写的文件"天然就在磁盘上；hub 侧的 PR 隔离把上下文文件与工作目录分到了两棵工作树上，产物未入库之前无法自然贯通。
- **证据**：`git -C <PR worktree> status --porcelain` 干净但 `ls <PR worktree>/docs/iterations/0028-role-model-binding` 不存在；`git -C <迭代工作区> status --porcelain` 显示 `?? docs/iterations/0028-role-model-binding/`；`git worktree list` 显示三个 PR worktree 的 base 均为 `162682d`（迭代分支当前 HEAD，其上无 0028 产物）。
- **影响**：① **执行规范（本迭代生效）**——每个 PR 的 brief 必须显式给出"上下文文件在迭代工作区的绝对路径"（只读），并要求该 PR **自行从迭代工作区把属于自己 `文件范围` 的 `prs/pr-{NNN}-*.md` 复制进本 worktree 后再写证据小节并提交**；② pr-001（迭代产物入库）天然是"让后续 PR 的 worktree 能读到文档"的前置，但它并不能替其他 PR 提交它们的 PR 文件（各自 `文件范围` 互斥）⇒ 其余 PR 复制自己的那一份即可，不会与 pr-001 冲突（pr-001 只提交它自己那份与阶段 1~3 产物）；③ **下迭代候选**：把"迭代产物在阶段 1 结束时就入库一次"作为流程默认动作，或在 stage 5 前统一做一次 `docs({迭代})` 记账提交，从根上消除本现象。

### G-13 · `*-tasks.md` 无 PR 声明归属 ⇒ 在 worktree 内永久 untracked，且合并时与迭代工作区的同路径 untracked 产物冲突

- **现象**：阶段 5 由 `planner` 逐 PR 产出的 `prs/pr-{NNN}-tasks.md` 落在各自 PR worktree 内，但**没有任何 PR 的「文件范围」声明它** ⇒ 三个 PR 的 tasks 文件全为 `??`（untracked），不会随分支合并进入迭代分支。更关键：pr-001 提交的 23 个文件中包含 `status.md` / `history.md` 等**被主 agent 持续更新的活文档**，它们同时以 untracked 形态存在于迭代工作区 ⇒ 合并该分支时会出现"incoming 文件将覆盖 untracked 文件"，git 直接拒绝合并；若强行覆盖，则会把主 agent 在 pr-001 之后写入的进度记录回退成快照版本。
- **差异**：本地 subagent 在同一工作区作业，不存在"产物在 A 工作树持续更新、又被 B 工作树以快照方式提交"这一层；hub 侧的 PR 隔离把它显式化了，而 PR 文件格式（七字段）没有为"跨 PR 共享的活文档"预留归属声明。
- **证据**：三个 worktree 的 `git status --porcelain` 均显示 `?? docs/iterations/0028-role-model-binding/prs/pr-00N-*-tasks.md`；pr-001 的提交 `0e314a3` 含 23 个文件（`git ls-files` 计数 23，其中含 `status.md` / `history.md`）；pr-001 的 dev 报告第 3 条主动提出"合并迭代分支前需处理迭代工作区中同路径 untracked 文件可能造成的覆盖冲突"。
- **影响**：① **合并规程（本迭代生效）**——合并任何 PR 前，先把迭代工作区里"会与新提交同路径的 untracked 文件"移出（如移到 `/tmp` 备份），合并完成后**还原主 agent 的较新版本**（`status.md` / `history.md` 等活文档以迭代工作区版本为准）；② tasks 文件若要进版本控制，需某 PR 显式声明其文件范围（本迭代不追补）；③ **下迭代候选**：在 PR 文件格式里为"跨 PR 共享的活文档 + 阶段 5 任务文件"定义归属与合并语义，或在阶段 1 结束即入库一次以消除 untracked-vs-incoming 对撞面。


### G-14 · 等价性缺口（信号 ③）：终态信封不可得与 `call_id` 查不回

- **现象**：执行时点存在三类事实——① 21:09 `architect` 派发（`task-191d2e14-e852-412d-ab90-e6fc00092928`）被节点侧 30 分钟上限切断，终态 `failed`／`error: timeout`，**终态信封不可得**（`status.md:66`）；② 09:06 `dev` 派发（`task-92f31d55-3789-4184-a850-a43df30e54be`，本 PR 实现轮）在本 PR 执行时点仍为 `state: working`、`text: null`，**终态未到**；③ 历史 `call_id` **查不回**——G-5 正文所用的 `task-8e84f95f-b783-4477-8054-abf0b36f31ec` 在集群重建后于执行时点返回 404。
- **差异**：本地 subagent 的每次派发结果直接交回调用方并随会话留存，不存在"信封取不到"与"标识查不回"两种形态；hub 侧的这两类形态使 `prd/F11` 验收 1 的逐次核对退化为"以台账文本与产物文件为据"，回读面不可复核。
- **证据**：判据 = `prd/F11` 验收 2 ③（"终态信封不可得，或 `call_id` 查不回"即等价性缺口）。命令与原始输出：`node oamp/bin/hub.js api calls get task-8e84f95f-b783-4477-8054-abf0b36f31ec` ⇒ `{"code":"NOT_FOUND","error":"call 不存在: task-8e84f95f-b783-4477-8054-abf0b36f31ec","exit_code":1,"http_status":404}`；`node oamp/bin/hub.js api calls get task-92f31d55-3789-4184-a850-a43df30e54be` ⇒ `{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":true,"text":null,"structured_output":null,"error":null,"exit_code":null}`；`status.md` §派发台账 21:09 行（`❌失败(超时·现场保留)`、`error: timeout`、1802661ms）与 `status.md:8`（"集群已重建，调用面清空、对话记录留存"）、`status.md:120`（2026-09-16 08:47 恢复记录）。
- **复核（本 PR 执行时点，回读面一致性）**：同一 `call_id`（`task-92f31d55-3789-4184-a850-a43df30e54be`）在批量探针命令（7 条顺序执行）中返回 `{"code":"NOT_FOUND","error":"call 不存在: …","http_status":404}`，紧随其后的**单独**探针返回 `{"state":"working",…}` ⇒ 回读面对同一在途调用存在不一致（本 PR 只登记现象、不追因；两条命令与原始输出见本 PR 文件「验收证据」块 ⑤）。
- **影响**：① 的机制面已由 G-9 记录，本条记其等价性缺口判定与 `call_id` 落点；② 的终态到达后由主 agent 回填台账并按 D-16 聚合到本条；③ 说明阶段 2~4 的历史调用在集群重建后不可回读 ⇒ "`call_id` 可核对"的可达形态限定为"条目文本载明 `call_id` + `status.md` 台账留痕"，`prd/F11` 验收 1 ① 的"`hub api calls get <call_id>` 可读"对历史调用不成立；下迭代候选：为调用面定义历史保留期或导出机制（记，不在本次迭代修）。
### G-18 · `cluster up` 的幂等护栏按**前缀**匹配 session ⇒ 同前缀 session 存在时**误判"已在运行"并静默跳过启动**（exit 0）

- **现象**：`cluster down --config <主工作区>/cluster.json` 成功收口（输出 `已收口（session=oamp-cluster，12 窗口）`、`exit=0`）后立即 `cluster up --config <主工作区>/cluster.json --wait 120000`，输出 `集群已在运行（session=oamp-cluster，12 窗口）` 且 **exit=0**，但主集群**实际未启动**（`tmux ls` 中无 `oamp-cluster`、7788 无监听）。根因：`oamp/src/cluster.js:132-134` 的 `hasSession(bin, session)` = `tmux has-session -t <session>`，而 tmux 对 `-t` 目标**按前缀匹配** ⇒ 目标 `oamp-cluster` 命中了同前缀的第二集群 session `oamp-cluster-0028`。实测判据：`tmux has-session -t 'oamp-cluster'` ⇒ **exit 0**（误命中）；`tmux has-session -t '=oamp-cluster'` ⇒ **exit 1**（精确匹配，反映真实状态）。
- **差异**：本地 subagent 不存在"运行实体的标识按前缀解析"这一层；本迭代**首次同时存在两个同前缀 session**，才把该缺陷暴露出来——即 **F04 的产物（第二集群）恰好挡住了 F08 的动作（主集群重启）**，两个 PR 的产物在收口时点发生了非预期耦合。
- **证据**：down 输出原文（`已收口（session=oamp-cluster，12 窗口）`、exit 0、`DOWN_START 10:45:18` → `DOWN_END 10:45:19`）；首次 up 输出 `集群已在运行（session=oamp-cluster，12 窗口）`（`UP_START 10:45:22`）；上述两条 `tmux has-session` 的 exit code；`oamp/src/cluster.js:132-134`、`:475`（`down` = `tmux kill-session`）。
- **影响**：① **本迭代的绕开（运行时、可逆、零文件改动、未停第二集群）**——`tmux rename-session -t oamp-cluster-0028 oamp-w0028` ⇒ `cluster up` 成功（`UP_START 10:45:51` → `UP_END 10:45:52`，10 实例全 online）⇒ `tmux rename-session -t oamp-w0028 oamp-cluster-0028` 复原（`tmux ls` 两 session 并存已恢复）。② **下迭代候选**：`hasSession` / `listWindowNames` / `listWindowRows` 等所有 tmux 目标应统一改用**精确匹配**语法（`=<session>`），或在启动前做 session 名唯一性校验。③ **对 operator 的影响面（值得单独记）**：`up` 的"已在运行"是**假阳性且返回 0**，会把"重启"静默降级为"没重启"——在本迭代 F08 的场景里，若不复核 `lsof`/`tmux ls`，就会得出"已重启但模型未生效"的**错误结论**。

### G-19 · 把调用派给**执行者自己的实例**会与外层轮次互锁（单 daemon 一次一轮）⇒ 双方都等对方，直到外层 30 分钟上限才解开

- **现象**：pr-010 的执行角色是 `dev`（实例 `pb-dev`），其取证动作要把两条探针实报打给 `pb-dev` 与 `pb-verifier`。实测：`pb-dev.log` 里**同一实例挂着两条未结束的轮次**——`02:46:14.447Z TASK_STARTED task-2b66d138`（外层＝pr-010 的执行调用）与 `02:47:55.213Z TASK_STARTED task-ccf0b236`（内层＝它自己发出的 `--agent dev` 实报），此后 20 分钟**两条都没有 `TASK_FINISHED`**；`ps` 显示该实例只有一个 daemon（`bun omp --mode rpc --no-session --model openai/gpt-5.6-luna`，PID 29568，已跑 22 分钟）。外层在等内层的终态、内层要跑又占用同一个单会话 daemon ⇒ **自排队死锁**，只能等外层 30 分钟节点上限（G-9）把外层切断才解除。
- **差异**：本地 subagent 的"派发"总是新建独立进程/上下文，不存在"把任务派回自己"这一层；hub 侧 `--agent <role>` 解析到**实例**，若该实例正是执行者自身，就构成 re-entrant 等待。
- **证据**：`grep -v HEARTBEAT .runtime/cluster/pb-dev.log | grep -E "TASK_|MSG_|CONTEXT_"` 输出（两条 `TASK_STARTED`、零 `TASK_FINISHED`）；`ps -o pid,ppid,etime,command -p 29568`（唯一 daemon）；`web.log` 的 `对账转入低频续查 task=<外层 call_id>（6 次未终态，转 30s/次）`；**决定性对照**——同一条 dev 发出的 `--agent verifier` 实报 **4.8 秒即返回**（`OK`、实报 `powerby/grok-4.6`），因为它落在**另一个实例**上；`hub api --help` 确认**无** `calls cancel/abort` 入口（无法主动解除）。
- **影响**：① **执行方式规范（本迭代生效）**——取证类/自证类任务**不得把探针打给执行者自己的实例**；执行角色必须与目标实例**不同**（例如以 `planner` 等其它角色执刀），或由主 agent 代取。② **下迭代候选**：为 `calls create` 增加"派发到自身实例"的前置拒绝或显式告警；为 hub 增加 `calls cancel`（当前一旦互锁只能等 30 分钟上限，期间该实例**完全不可用**）。③ 本轮实际后果：pr-010 的执行调用被上限切断、其证据小节未落盘，需换角色重做（见 history）。

---

## 澄清期登记的冲突





### C-1 · 默认模型 id 与 provider 清单不同名

- **现象**：`~/.omp/agent/config.yml` 的默认 `deepseek/deepseek-v4-flash:high` 在 `~/.omp/agent/models.yml` 的 deepseek provider 下**不存在同名 id**（清单里是 `deepseek-chat` / `deepseek-reasoner` / `deepseek-v4.1-flash`），靠 fuzzy match 才解析成功。
- **差异**：不涉及 hub 与 subagent 的差异，属 omp 环境配置面的事实。
- **证据**：一次性探针 `deepseek/deepseek-v4-flash:high` → `OK`（2.3s），即 fuzzy match 生效；`models.yml` 全文。
- **影响**：默认值不可静态校验；若哪天 fuzzy 规则收紧，全集群默认模型会一起失效，而配置文本看不出问题。

### C-2 · 前置常驻验证与真源唯一冲突

- 与 **G-1** 同一条冲突的澄清期登记，此处不重复现象描述；处置见 `demand.md` D-14。

### C-3 · 建 chat 无独立端点

- 与 **G-3** 同一条冲突的澄清期登记；处置见 `demand.md` D-21。

### C-4 · 主集群跑的是主工作区代码与配置，迭代改动只在 PR worktree / 迭代分支可见

- **现象**：在跑的主集群由主工作区的 `cluster.json` 与 `oamp/` 代码启动，迭代的改动落在 PR worktree → 迭代分支，主集群看不见；直接改主工作区又与 PR 流程相冲。
- **差异**：本地 subagent 在"一次会话、一个工作区"内工作，不存在"运行中的真实服务使用另一份检出"这一层。
- **证据**：`git worktree list`（主工作区 `main@162682d` 与迭代工作区并存）；`cluster.js` 的 tmux 窗口 cwd = 配置文件所在目录。
- **影响**：每次涉及"运行态行为"的迭代都要额外回答"实证跑在哪个实例、用哪份检出"，并为此付出一个第二集群的生命周期；本次处置见 D-13 与 D-20。
