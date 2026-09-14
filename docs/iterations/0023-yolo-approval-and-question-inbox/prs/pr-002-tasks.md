# pr-002-tasks.md — pr-002 内部任务图（web 进程承载提问信封与裁决分化）

**迭代**: 0023-yolo-approval-and-question-inbox ｜ **阶段**: 5（PR 实现）· 首波 ｜ **PR 文件**: `prs/pr-002-web-envelope-and-decision-routing.md`
**worktree 分支**: `feat/0023-pr-002-web-envelope-and-decision-routing` ｜ **工作区地址**: `.pb-agents/worktrees/0023-yolo-approval-and-question-inbox/.pb-agents/worktrees/0023-pr-002-web-envelope-and-decision-routing`（本文件内一切 git 写操作用 `git -C <该地址>`）
**任务总数**: **4**（T1~T4）｜ **依赖图**: 无环（见 §2）｜ **架构基线**: `architecture.md` **v0.3.0**（§5.2 / **§5.2.1** / §5.3 / §5.7 / §9.1 / §9.3 / §9.5）

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面；`git diff --stat` 超出即 PR 验收 10 不通过）

| 文件 | 动作 | 内容 |
|---|---|---|
| `oamp/src/web.js` | 修改 | ① `handleDeliver` 的 `confirmation_request` 分支白名单 +`request_kind`/`multiple`（`:1597-1610`）；② 裁决路由按 `request_kind` 分化（校验 / 回传载荷 / 旁路，`:1286-1342`）；③ 路由元数据同步（`:1259-1261`、`:1276-1282` 及顶部路由注释行 `:23`） |
| `oamp/API.md` | 修改 | §3.20（`:901` 起）条目字段 +`request_kind`/`multiple`；§3.21（`:949` 起）body 参数 +`option_ids` + 必填口径按类分化 |
| `oamp/llms.txt` | **重生成**（不手改） | `node oamp/scripts/gen-llms-txt.mjs`——仅当路由 `summary` 变更（本 PR **必然**变更，见 §0.4） |
| `oamp/test/confirmation-inbox.test.js` | 修改 | 适配既有用例（`:193-201` 的 `entryOf`、`:281-282` 的键集合）+ 新增 question 类断言组 |

### 0.2 非目标（由其它 PR 承担 / 本 PR 明令不碰）

- **pr-001 面**：`agent.js::raiseConfirmation` 的信封生产、`settleConfirmation`、`onQuestionRequest` 接线、档位解析（`protocol.js` / `launcher.js` / `config.js` / `oneshot-client.js`）、rpc 宿主工具与 deny 三步、acp 非门 elicitation 承接、`context-pool.js` 钩子透传。
- **pr-003 面**：`web/app.js`（question 类控件与 `{option_ids, text}` 提交体）、`web/style.css`、`web/index.html`、`test/inbox-console.test.js`。
- **PR 文件零改动清单（防夹带，逐条不得出现在 diff）**：`oamp/src/inbox.js`、`transport.js`、`persist.js`、`router.js`、`protocol.js`、`launcher.js`、`config.js`、`agent.js`、`rpc-client.js`、`acp-client.js`、`oneshot-client.js`、`context-pool.js`、`oamp/web/**`、`oamp/bin/**`、`oamp/package.json`、`oamp/test/{api-routes,project-workspace,call-protocol,web,inbox-console,hygiene,zero-intrusion}.test.js`、`oamp/test/helpers/**`、`omp/**`。

### 0.3 读码事实锚点（判据基础；2026-09-14 本 worktree 实读）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | 路由表 = `createApiRoutes({…})` 返回的有序数组，表项 = 8 元数据字段（`ROUTE_META_FIELDS`）+ handler；**纯构造**（`createApiRoutes({})` 可跑，不调依赖、不读磁盘） | `web.js:438-440`、`:451`、`:1705-1707` |
| **A2** | `GET /api/confirmations` 元数据：`summary` `:1259` / `params: []` `:1260` / `response` **七字段串** `:1261`；`POST …/decision` 元数据：`summary` `:1276` / `params` `:1277-1281`（`option_id.required: true` 在 `:1279`）/ `response` `:1282` | `web.js:1257-1282` |
| **A3** | 裁决 handler 现状：`take()` `:1296` → 不存在即 404 `:1297-1300`；`option_id` 类型守卫 `:1301`；成员校验失败 ⇒ **`inbox.add(entry)` 回填（`:1304`）+ 400**（中间无 await）`:1302-1307`；`text = …trim()` `:1308`；回传 `:1311`；旁路 `:1316-1340`；200 `:1341` | `web.js` |
| **A4** | `handleDeliver` 的 `confirmation_request` 分支：通知类型判据 `body.kind === 'confirmation_request'` `:1597`；**逐字段白名单重建 7 键**（无 spread）`:1598-1607`；`inbox.add(entry)` 成功才 `transport.publishGlobal({type:'confirmation', data: entry})` `:1608` | `web.js` |
| **A5** | `renderLlmsTxt` 逐行渲染 `- ${r.method} ${r.path} — ${r.summary}`（纯函数）⇒ `oamp/llms.txt:33` 逐字复制 `summary`（`:1276`） | `web.js:1384-1408`；`llms.txt:33` |
| **A6** | 漂移锁② = `api-routes.test.js:280-287`（生成结果 vs 仓库 `llms.txt` **逐字节**）；漂移锁②/③ 的 `project-workspace.test.js` 一份 = `:1283-1305`（快照逐字节 + `## 接口（21 条）` + API.md 路径级双向覆盖） | 两测试文件 |
| **A7** | 漂移锁① = `api-routes.test.js:197-252`：每个 `params[i]` 的 5 个 `PARAM_FIELDS` 齐备，且 `type` ∈ `PARAM_TYPES = ['string','number','boolean','json']` ⇒ **数组型参数只能声明 `json`** | `api-routes.test.js`；`web.js:440-442` |
| **A8** | `call-protocol.test.js:1064-1081` 用 **API.md 绝对行号窗口** 判禁用词：`SCOPE` 含 `[1025,1050]`（**∉ `ALLOWED`**）；该文件在零改动清单内 | `call-protocol.test.js` |
| **A9** | 既有 permission 类测试面（适配后须仍绿）：`T3` 用例 `:256` 起（列表深等 `:278`、帧深等 `:281`、**键集合 7 键断言** `:282`）；`T2 裁决契约` 用例 `:329` 起；`entryOf` helper 为 7 键字面量 `:193-201`；`ENVELOPE` 工厂 `:175-190`（spread 允许注入新字段） | `test/confirmation-inbox.test.js` |
| **A10** | `inbox.js` 五导出 `:13/22/27/35/40`；`take()` 即删 `:27-33`（F15 的结构保证） | `src/inbox.js` |
| **A11** | 既有监听面（F14 判据）：`grep -n "listen\|createServer" oamp/src/web.js` 命中 = `:1705`（注释）/ `:1709`（`createServer`）/ `:1737`（`listen`） | `src/web.js` |
| **A12** | 判定面可**独立构造**（不依赖 pr-001）：`startFakeNode` + `ENVELOPE(over)` 注入面 | `test/helpers/fake-node.js`；`confirmation-inbox.test.js:175-190` |
| **A13** | `API.md`：§3.20 `:901` 起 / §3.21 `:949` 起 / §3 清单表第 20–21 行 `:180-181`；`:981` 为 §3.21 尾的 `best-effort` 行（含禁用词 `effort`，当前落在所有 `SCOPE` 窗口**之外**） | `API.md` |
| **A14** | `web/app.js:717-731` 恒提交 `{option_id, text}`（`:725`），`test/inbox-console.test.js:342` **逐字锁定**该 body ⇒ 本 PR 不改前端（question 类前端可用性归 pr-003） | `web/app.js`；`inbox-console.test.js` |

### 0.4 G2-D3 落地判定：`summary` 同步 + `llms.txt` 重生成是**必然动作**（非条件性）

**结论**：PR 文件把 `oamp/llms.txt` 写成「条件性」，但触发条件在本 PR 内**必然成立** ⇒ T3 必须包含「同步 `summary` 文案」与「重生成 `llms.txt`」两项。判据六条（逐条可核）：

1. `web.js:1276` 的 `summary` = 「提交确认项裁决（选项 id 必填 + 可选文本；条目随即移出在途表并回传请求方）」，是该路由文案的**单一来源**（无第二处定义）。
2. `renderLlmsTxt`（A5）把 `summary` 逐字渲染为 `- <method> <path> — <summary>` ⇒ `oamp/llms.txt:33` 逐字携带该断言。
3. 漂移锁②（A6）与③（A6）均**逐字节**比对生成结果与仓库快照 ⇒ `summary` 一变而 `llms.txt` 不重生成，**锁必红**。
4. 本 PR 引入 `request_kind:'question'`：该类条目的提交体是 `option_ids`，且成立条件是「选项与自由文本**至少一个非空**」（§5.3 校验；PR 验收 5）⇒「选项 id 必填」在该类下**恒假**；而 `summary` 是两类共用的一串 ⇒ 本 PR **使该断言失真**（不是"可能失真"）。
5. 若不同步：要么在派生面留下一条本 PR 已证伪的事实断言，要么与 PR 验收 9「`API.md` 与应用内路由元数据一致」相冲（§3.21 的 body 必填口径已按类分化）。
6. 故两项互为前提（改 `summary` ⇒ 必须重生成 `llms.txt`；否则验收 9 不可满足）⇒ **必然动作**。

**真条件性对照（反例，用于固定判据面）**：`API.md:181`（清单表第 21 行「提交确认项裁决（选项 + 可选文本；随即移出在途表并回传）」）**不含**「必填」断言，对两类条目均成立 ⇒ 该行**不需要**改动（T3 验收 9 以判据固定，防止越界改写）。

## 1. 任务列表

### T1：信封消费面白名单扩展（`request_kind` / `multiple`）

- **验收标准**:
  1. **question 类入表（PR 验收 1）**：投递一条 `notice{kind:'confirmation_request'}`，其 body 含 `request_kind:'question'` / `multiple:true` / `title` / `options` ⇒ `GET /api/confirmations` 的该条目**逐字段深等**于 `{confirmation_id, chat_id, agent_id, tool, title, options, request_kind:'question', multiple:true, created_at}`（**9 键**）；既有的 `confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at` 七字段口径（类型兜底体例）逐字不变。判据：HTTP 响应体 `deepEqual` + 键集合断言（**逐键深等，不得退化为子集断言**）。
  2. **缺字段兜底（兼容面，PR 验收 1 后半）**：`request_kind` 缺失 / 非字符串（如 `42`）的投递 ⇒ 条目 `request_kind === 'permission'`；`multiple` 缺失 / 非布尔 ⇒ 条目 `multiple === false`。判据：两条投递各一次 + 字段断言。
  2b. **值域闭合（`[model_inferred]`）**：`request_kind` 为**域外字符串**（如 `'nonsense'`）⇒ 条目取 `'permission'`（条目字段恒落在 `'permission' | 'question'` 两值域内，§5.2 类型列）；判据：一条投递 + 字段断言（与裁决路由的实际分流方向一致——非 `'question'` 即 permission 路径）。
  3. **空选项态（PR 验收 1 / F05 验收 4 的服务端半）**：`options: []` 的 question 信封 ⇒ 条目仍在表内且 `options` 深等于 `[]`（不新增、不删减、不替换）。判据：`deepEqual` 断言。
  4. **全局帧同形状且恰一次（PR 验收 2）**：首次入表时 `GET /api/events` 收到**恰一帧** `confirmation`，其 `data` 与列表元素**同形状**（含 `request_kind` / `multiple`）；重复投递同一 `confirmation_id` ⇒ 不再入表、不再发帧；`GET /api/confirmations`（重建面）⇒ **零帧**；不产生任何 `chat:<id>` 定向帧。判据：帧计数 + `deepEqual`（`entryOf` 适配后，`:278-283` 的既有断言组仍在且强度不降）。
  5. **permission 类零回归（PR 验收 6 的消费面半）**：缺 `request_kind` 的投递仍走 permission 路径；既有用例（`:256` 起、`:329` 起）适配后**逐条绿**且**零削弱**——`entryOf`（`:193-201`）与键集合断言（`:282`）按 9 键清单更新（表述由「7 字段」改为「9 字段」，仍为**逐键清单比较**）。判据：既有用例的断言形态对比（不得改为 `assert.ok` / 子集 / 通配）。
- **前置依赖**: 无
- **优先级**: P0
- **追溯**: PR 验收 1、2、6；`architecture.md` §5.2（字段表 + M3 可表达性对照）、**§5.2.1**（「字段面 = 生产面 / 消费面的边界」+「缺该字段 ⇒ 非字符串按 `'permission'` 兜底」）、§9.1 `src/web.js` ①；`prd/F04` 验收 1（服务端承载）、`prd/F05` 验收 1/2/4（承载面）、`prd/F10` 验收 3（permission 类形状不退化）
- **交付物**: `oamp/src/web.js`（白名单分支）+ `oamp/test/confirmation-inbox.test.js`（适配 + 新断言组）

### T2：裁决路由按 `request_kind` 分化（校验 / 回传载荷 / 旁路停掉）

- **验收标准**:
  1. **question 类合法提交（PR 验收 3 / 5 ①）**：`POST /api/confirmations/<id>/decision`，body `{option_ids:[…], text}`（`option_ids ⊆` 该条 `options` 的 `option_id`，或 `option_ids` 非空且 `text` 非空白）⇒ `200 {confirmation_id, accepted:true}`；该条**立即移出在途表**（第二次提交同一 id ⇒ `404 NOT_FOUND`）。判据：响应体 `deepEqual` + 二次提交 404。
  2. **question 类回传载荷（PR 验收 3）**：发出方收到**恰一条** `notice{kind:'confirmation_decision', confirmation_id, option_ids, text, chat_id}`——`option_ids` 与提交值**同值同序**（不排序、不去重、不筛选）、`confirmation_id` / `chat_id` 同值、`text` 与提交文本一致（逐字；用**无首尾空白**的文本作判据，见 §5 疑问 3）；body **不含** `option_id` 键 `[model_inferred]`（§5.3 question 形态逐键列出）。判据：假节点 receipts 的 body 逐键断言。
  3. **旁路停掉（PR 验收 4 / F07 验收 3）**：question 类提交后 ⇒ 该 `chat_id` **零新增** `direction='in'` 消息、**零派发**（假节点零新增 `task.request`、进程内 `tasks` 无新登记）。判据：`GET /api/chats/<id>` 的 `in` 计数不变 + 假节点 receipts 计数不变。
  4. **必填性与错误契约（PR 验收 5 / F05 验收 5 / MI-03）**：三种输入各测一次——① 仅 `option_ids` 非空（`text` 缺失或纯空白）⇒ **可提交**；② 仅 `text` 非空白（`option_ids` 键缺失）⇒ **可提交**；③ `option_ids` 为 `[]`（或缺失）**且** `text.trim() === ''` ⇒ `400 INVALID_PARAM` 且条目**保留在途**；④ `option_ids` 含该条 `options` **之外**的取值 ⇒ 同 ③；⑤ `option_ids` **出现但非字符串数组**（字符串 / 数字 / 对象 / 含非字符串元素；含显式 `null`）⇒ 同 ③ `[model_inferred]`；⑥ `confirmation_id` 不在表内（已裁决 / 已失效 / 从未存在）⇒ `404 NOT_FOUND`（**同一码，不区分**）。判据：每次 400 后紧随的 `GET /api/confirmations` 仍含该条（回填体例：`inbox.add(entry)`，`take` 到回填之间**不引入 `await`**，保持 `:1302` 注释所记的原子性；不得引入 `await` 到校验前）。
  5. **纯自由文本提问的必填性（F05 验收 5 的条件半句）**：`options: []` 的 question 条目提交非空 `option_ids` ⇒ `400` + 保留（空集合下任何非空 `option_ids` 均属域外，④ 的推论）；仅 `text` 非空白 ⇒ 可提交。
  6. **permission 类零回归（PR 验收 6 / F10 验收 3）**：`{option_id, text}` 路径**逐字不变**——非法 `option_id`（缺失 / 非字符串 / 不在该条 `options` 内）⇒ `400 INVALID_PARAM` + 保留在途；合法 ⇒ `200 {confirmation_id, accepted:true}` + 回传 body 为 `{kind:'confirmation_decision', confirmation_id, option_id, text, chat_id}` 且**不含** `option_ids` 键；`text` 非空白 ⇒ 追加一条 `in` 输入 + 派发（既有原语：`db.insertInput` → `publishMessage` → `publishState('working')` → `sendTask`）；`text` 空白 ⇒ 不追加、不派发。判据：既有 `T2 裁决契约` 用例（`:329` 起）逐条绿且断言形态不削弱。
- **前置依赖**: T1（校验与分化读 `entry.request_kind`，该字段由 T1 的白名单重建产出）
- **优先级**: P0
- **追溯**: PR 验收 3、4、5、6；`architecture.md` §5.3（回传载荷分化 + 校验 + 旁路分化 + 方向区分注）、§3.3 流 4、§9.1 `src/web.js` ②、§12.4（两 PR 解耦口径）；`prd/F05` 验收 5、`prd/F07` 验收 1/3/4、`prd/F10` 验收 3
- **交付物**: `oamp/src/web.js`（裁决 handler）+ `oamp/test/confirmation-inbox.test.js`（question 类新断言组）

### T3：路由元数据与派生面同步（`params` / `response` / `summary` + `API.md` + `llms.txt` 重生成）

- **验收标准**:
  1. **列表路由元数据（PR 验收 9 前半）**：`GET /api/confirmations` 的 `response` 字符串条目字段由 7 项更新为 **9 项**（+`request_kind` / `multiple`）；该路由的 `summary`（`:1259`）与 `params`（`:1260` 为 `[]`）**不变**（不新增查询参数）。判据：`api-routes.test.js` 漂移锁① 绿 + 深等断言。
  2. **裁决路由元数据（PR 验收 9 前半）**：`POST …/decision` 的 `params` 追加 `option_ids` 条目，5 个 `PARAM_FIELDS` 齐备（`name` / `in:'body'` / `type` / `required` / `desc`）；**`type` 只能取 `'json'`**（数组型参数在 `PARAM_TYPES` 中无对应值，A7）。判据：漂移锁① 绿。
  3. **`summary` 文案同步（G2-D3，必然动作）**：`:1276` 的 `summary` 去掉「选项 id 必填」的绝对化表述，改为按 `request_kind` 分化（须覆盖「`option_id`（permission）/ `option_ids`（question）」与「选项与自由文本至少一个非空」）；同源文案——`web.js:23` 顶部路由注释行——一并同步 `[model_inferred]`；`params` 中 `option_id` 的 `required` 布尔值与 `desc` 按分化口径修正 `[model_inferred]`（见 §5 疑问 1）。判据：`summary` 不再包含「选项 id 必填」；`:23` 与 `:1276` 两处表述一致；`renderLlmsTxt` 输出的该行与 `oamp/llms.txt` 逐字节相等。
  4. **`API.md` §3.20（PR 验收 9）**：条目字段表 +`request_kind` / `multiple` 两行 + 成功响应 JSON 示例补两字段；`tool` / `title` 两行按 `architecture.md` §5.2 语义表补 question 类口径（`tool` = 承载名 / `title` = 问题文本）`[model_inferred]`——**一致性约束**：表中不得存在与本 PR 引入的 question 类条目事实相矛盾的说明；既有 7 字段的字段名与类型逐字不改。判据：字段表与 `architecture.md` §5.2 逐行对照。
  5. **`API.md` §3.21（PR 验收 9）**：body 参数表 +`option_ids` 行（说明：question 类；须为字符串数组且 ⊆ 该条 `options`；与 `text` 至少一个非空）；`option_id` 行的必填口径改为**按 `request_kind` 分化**；「语义」段补回传形态按类分化（question ⇒ `option_ids` + `text` 且**不**追加 chat 输入；permission ⇒ 既有 `option_id` + `text` + 文本落地）；错误表 `INVALID_PARAM` 行补 question 类触发条件（域外取值 / 非字符串数组 / 全空）；`NOT_FOUND` 行与成功响应示例不变。判据：§3.21 与 T2 的实际契约逐条对照。
  6. **`llms.txt` 重生成（G2-D3，必然动作）**：由 `node oamp/scripts/gen-llms-txt.mjs` **重生成**（**不手改**，输出路径按脚本位置解析），与 `renderLlmsTxt(projectRoutes(createApiRoutes({})))` **逐字节相等**；标题恒为 `## 接口（21 条）`（本 PR 零新增路由）。判据：漂移锁② 绿。
  7. **漂移锁未削弱 + 零改动文件不被动（PR 验收 9）**：锁①/②/③ 全绿；`oamp/test/api-routes.test.js` / `project-workspace.test.js` / `call-protocol.test.js` **零改动**（`git diff --stat` 中不出现）。判据：三文件零改动 + `node --test oamp/test/api-routes.test.js oamp/test/project-workspace.test.js oamp/test/call-protocol.test.js` 绿。
  8. **`API.md` 行数位移约束（实测判据，见 §5 疑问 5）**：`API.md` §3.20/§3.21 区域的**净增行数**须保持在实测安全带（`-10 .. +43`），且新增行不得含禁用词集合 `{cancel, terminate, steer, isolated, effort, local://, agent://}`；否则 `API.md:981`（`best-effort` 行）会落入 `call-protocol.test.js` 的 `[1025,1050]` 窗口（∉ `ALLOWED`）⇒ 该零改动文件转红。判据：`node --test oamp/test/call-protocol.test.js` 绿且该文件零改动。
  9. **清单表第 20/21 行不改（越界防护）**：`API.md:180-181` 两行文案对两类条目均成立（无「必填」断言）⇒ **不改**；判据 = §0.4 的真条件性对照。
- **前置依赖**: T2（元数据与文档面描述的是 T2 落地后的实际契约：`option_ids` 参数、必填口径、旁路分化）
- **优先级**: P0
- **追溯**: PR 验收 9；`architecture.md` §9.5 文档面、§5.2（字段语义）、§5.3（校验与回传）、§12.4（需同步清单含 `API.md` 条目字段面）；`prd/F05` 验收 1/2、`prd/F07` 验收 1；`verify-stage4-gate-r2-20260914.md:176`（G2-D3 的原始观察）
- **交付物**: `oamp/src/web.js`（元数据与注释）+ `oamp/API.md` + `oamp/llms.txt`

### T4：保证项核验与 PR 收口（F14 / F15 / 命令全绿 / 改动面封闭）

> **本任务零代码改动**：F14 / F15 的承载形态是「不改」（`architecture.md` §9.3 零改动清单），任务的产出 = **可复核的验收证据**。若核验发现需要改代码，说明 T1~T3 越界，按 §5 上报主 agent，不得就地扩面。

- **验收标准**:
  1. **F14 服务边界不变（PR 验收 7）**：`grep -n "listen\|createServer" oamp/src/web.js` 的**命中集合与改动前逐行相同**（基线 = `:1705` / `:1709` / `:1737`，A11）；无新增监听地址 / 端口 / 鉴权 / 对外接口；提问通路可达面仍仅本机控制台。判据：命令输出与基线逐行比对。
  2. **F15 无历史台账（PR 验收 8）**：`oamp/src/inbox.js` 导出面仍**恰为** `add` / `list` / `take` / `remove` / `size`（A10）且 `take()` 即删；无任何已裁决条目的列表 / 查询参数 / 导出入口（含 `GET /api/confirmations?confirmation_id=…` 返回 `[]`）；未裁决项刷新后仍在（`GET /api/confirmations` 重建面）；`oamp/src/persist.js` 零改动。判据：导出面清单 + 查询参数探针 + 零改动清单比对。
  3. **命令全绿（PR 验收 10）**：`node --test oamp/test/confirmation-inbox.test.js oamp/test/api-routes.test.js oamp/test/project-workspace.test.js oamp/test/web.test.js` 全绿；`node --test oamp/test/*.test.js` **无非本 PR 引入的失败**（既有失败若有，须逐条给出「非本 PR 引入」的证据）。判据：两次命令的退出码与失败清单。
  4. **改动面封闭（PR 验收 10）**：`git -C <工作区地址> diff --stat` **只含** §0.1 的 4 个文件；§0.2 的零改动清单逐条未出现。判据：`git -C <工作区地址> diff --name-only` 与 4 文件清单**集合相等**。
- **前置依赖**: T1、T2、T3
- **优先级**: P0
- **追溯**: PR 验收 7、8、10；`architecture.md` §9.3 零改动清单、§9.5；`prd/F14` 验收 1/2/3、`prd/F15` 验收 1/2/3（服务端面）

## 2. 依赖图（无环）

```mermaid
graph LR
  T1["T1 信封白名单（web.js ①）"] --> T2["T2 裁决分化（web.js ②）"]
  T2 --> T3["T3 元数据与派生面（web.js ③ + API.md + llms.txt）"]
  T3 --> T4["T4 保证项核验与收口（零代码）"]
```

拓扑序（合法执行序）：`T1 → T2 → T3 → T4`

- **最长依赖链**：`T1 → T2 → T3 → T4`（4 跳，全图唯一链）。
- **关键路径任务**：T1、T2、T3、T4（四项均在关键路径上）。
- **无环**：所有边方向单调（T1 → T2 → T3 → T4），无回边、无跨层边。
- **同文件串行约束（必须）**：`oamp/src/web.js` 被 T1 / T2 / T3 顺序修改，**不得并发派发**；由同一实现者按 `T1 → T2 → T3` 落地。`oamp/test/confirmation-inbox.test.js` 由 T1 / T2 顺序修改（同一实现者）。T3 的 `API.md` / `llms.txt` 与代码改动互为前提（判据 3 / 6），**不得拆给不同执行者并行**。

## 3. 与 PR 验收标准逐条对位表

| PR 验收 # | 验收摘要 | 承接任务 | 对位说明 |
|---|---|---|---|
| 1 | 信封字段白名单（9 键逐字段）+ 缺 `request_kind` ⇒ `'permission'` | **T1**（验收 1、2、2b、3） | 判据 = HTTP 深等 + 键集合清单（A4 白名单重建） |
| 2 | 全局帧形状一致 + 重复投递不发帧 + 重建面不发帧 | **T1**（验收 4） | 判据 = 全局 SSE 帧计数 + `deepEqual`（`:278-283`） |
| 3 | 回传载荷按 `request_kind` 分化（question `option_ids` / permission `option_id`） | **T2**（验收 2、6） | 判据 = 发出方 notice body 逐键断言（§5.3 两种形态） |
| 4 | 旁路停掉（question ⇒ 对话零新增 `in`、零派发）+ permission 文本落地不变 | **T2**（验收 3、6） | 判据 = `GET /api/chats/<id>` 计数 + 假节点 receipts |
| 5 | 必填性与错误契约（三种输入 / 域外值 / 非字符串数组 / 404 同码） | **T2**（验收 4、5） | 判据 = 每次 400 后条目仍在表内（回填体例） |
| 6 | permission 类零回归（既有用例零削弱） | **T1**（验收 5）+ **T2**（验收 6）+ **T4**（验收 3） | 判据 = 既有用例断言形态对比 + 全绿 |
| 7 | 服务边界不变（无新监听 / 端口 / 鉴权） | **T4**（验收 1） | 判据 = `grep` 命中集合与基线逐行相同（A11） |
| 8 | 无历史台账（`inbox` 5 导出 / 无历史入口 / 重 build 面 / `persist.js` 零改动） | **T4**（验收 2）+ **T1**（验收 4 的幂等与无删改） | 判据 = 导出面清单 + 查询参数探针 + 零改动比对 |
| 9 | 派生面同步且漂移锁未削弱（`API.md` / `llms.txt` / 三锁 / 21 条标题） | **T3**（验收 1~9） | 判据 = 锁①②③ 绿 + 三个测试文件零改动 |
| 10 | 命令全绿 + 改动面封闭 | **T4**（验收 3、4） | 判据 = 命令退出码 + `diff --name-only` 集合相等 |

**覆盖检查**：PR 的 10 条验收标准 → 全部有任务承接（无遗漏）；T1~T4 的每条验收标准均可追溯到 PR 文件 / `architecture.md` / `prd/*.md`（见 §6）。

## 4. 跨 PR 归属（PR 文件「择一判定声明」对位）

| PR 文件的声明 | 本任务图的对位 |
|---|---|
| ① F04 验收 1 与 F07 验收 1/3 的**服务端主面**在本 PR；栏内可见 / 控件面归 pr-003；`notice` 信封面（生产者）归 pr-001 | 本 PR 只判：条目入表与字段（T1）、回传载荷与服务端校验（T2）、旁路停掉的服务端证据（T2）。**不判**通知送达、不判前端渲染 |
| ② F05 验收 5 的**权威判定点**在本 PR（L2-7 服务端校验） | T2 验收 4 / 5——此为 F05 验收 5 的**唯一**判定点；pr-003 只做可用性提示 |
| ③ F15 验收 1/2 的主面在本 PR（服务端无历史入口），辅面在 pr-003（界面无历史面） | T4 验收 2；**不判**前端是否存在历史面 |
| 本 PR **不承载**：F04 验收 2/3/4/5（上浮本体 / 事件类型 / 档位无关 / 上浮源）、F05 验收 2/3 的 acp 面、F07 验收 2（该轮继续）、F08、F09、F10 验收 1/2/4/5（档位面）、F11~F13、F16 | 均属 pr-001（生产面 / 档位 / 链路）或 pr-003（前端）；本任务图不含相应任务，且 §0.2 明令不碰其文件 |
| PR 依赖核实结论：与 pr-001 无硬依赖（§12.4 字段面解耦） | 本任务图**不写跨 PR 前置**；A12 证实判定面可独立构造（`ENVELOPE` 的 spread 注入面无需 pr-001） |

## 5. 边界与疑问（提请主 agent）

1. **`[model_inferred]` 路由元数据的「条件必填」无结构承载**：`params[].required` 是**布尔**（`PARAM_FIELDS`，A7），无法表达「permission 类必填 / question 类不用」。T3 验收 3 采取的最小口径 = `option_id.required: false` + `desc` 说明按类分化，并新增 `option_ids`（`required: false` + 说明）。若主 agent 另有口径（如保留 `required: true` 并在 `desc` 注明「permission 类」），T3 按其口径执行——**本任务图不替架构决定该编码**。
2. **`[model_inferred]` question 类回传是否省略 `option_id` 键**：§5.3 的 question 形态逐键列出（`kind` / `confirmation_id` / `option_ids` / `text` / `chat_id`）而未写「不含 `option_id`」；T2 验收 2 按「**不含**」判定（对称于 PR 验收 3 对 permission 侧「不含 `option_ids`」的明文）。
3. **`text` 的 `trim` 口径未钉死**：PR 验收 3 写「`text` 逐字」，而既有实现（`:1308`）对 `text` 做 `.trim()`，permission 类的既有用例（`:361` 提交 `'  需要理由  '`、`:377` 与 `:385` 断言 trim 后的 `'需要理由'`）依赖该 trim。T2 验收 2 用**无首尾空白**的文本作「逐字」判据 ⇒ **两读法均通过**、不阻塞实现；请主 agent 裁定 question 类是「原样」还是「trim 后」（若选「原样」则 question 与 permission 的 `text` 口径存在显式差异，需在 `API.md` §3.21 登记）。
4. **`[model_inferred]` `option_ids` 的「缺失 vs 显式 `null`」判别**：T2 验收 4 的口径 = 键**缺失** ⇒ 视为空集（配合 ② 成立）；键**出现但非字符串数组**（含 `null`、字符串、数字、对象、含非字符串元素）⇒ 400 + 保留在途。依据 = PR 验收 5「非字符串数组 ⇒ 400 且保留」的明文（不以 `text` 是否非空为条件）。
5. **风险（实测）：`call-protocol.test.js` 的 API.md 绝对行号窗口是脆弱耦合**。实测：`SCOPE` 窗口 `[1025,1050]` ∉ `ALLOWED`，而 `API.md:981`（§3.21 尾的 `best-effort` 行）含禁用词 `effort`；在 §3.20/§3.21 区域内**净增 ≥ +44 行**时该行落入 `[1025,1050]` ⇒ 该**零改动**文件转红（净增 `+70` 行以上又意外转绿；净减 `≤ -11` 行同样转红）。T3 验收 8 把「净增行数 ∈ `-10 .. +43`」写成判据。**若实现需要更大净增** ⇒ 与本 PR 的「`call-protocol.test.js` 零改动」声明冲突，请主 agent 裁定（压缩文案 / 修窗口 / 改零改动声明），实现者不得自行改该文件。
6. **边界：`API.md:181` 属真条件性（不改）**——清单表第 21 行文案不含「必填」断言，对两类条目均成立（§0.4 对照）；**不得**顺手改写。
7. **边界：question 类前端可用性归 pr-003**——`web/app.js:725` 恒提交 `{option_id, text}` 且被 `inbox-console.test.js:342` 逐字锁定（A14）⇒ 本 PR 落地后，question 条目的**前端**提交仍是旧形态（将命中 question 类的 400 分支）；本 PR 的 question 类判定一律经**直接 HTTP**（假节点 + `jreq`）构造，不依赖前端。
8. **边界：生产面未合入时的惰性**——pr-001 未合并时，既有投递无 `request_kind` ⇒ 走 `'permission'` 路径（T1 验收 2），question 分支不可达但**不产生失败**（§12.4 解耦口径）。本任务图据此不写跨 PR 依赖。

## 6. 追溯总表（任务 → 输入）

| 任务 | `architecture.md` | `prd/*.md` | PR 文件 |
|---|---|---|---|
| **T1** | §5.2（字段表 + M3 对照）、§5.2.1（生产/消费字段面边界 + 兜底）、§3.3 流 2/3 的消费段、§9.1 `src/web.js` ①、§9.3 | F04 验收 1、F05 验收 1/2/4、F10 验收 3 | 验收 1、2、6；文件范围 `web.js` ① |
| **T2** | §5.3（回传载荷分化 + 校验 + 旁路分化 + 方向区分注）、§3.3 流 4、§9.1 `src/web.js` ②、§12.4 | F05 验收 5、F07 验收 1/3/4、F10 验收 3 | 验收 3、4、5、6；文件范围 `web.js` ② |
| **T3** | §9.5（文档面）、§5.2（字段语义）、§5.3（校验口径）、§12.4（需同步清单） | F05 验收 1/2、F07 验收 1 | 验收 9；文件范围 `web.js` ③ + `API.md` + `llms.txt` |
| **T4** | §9.3（零改动清单）、§9.5 | F14 验收 1/2/3、F15 验收 1/2/3 | 验收 7、8、10 |

## 7. `[model_inferred]` 清单（需主 agent 确认）

| # | 位置 | 推断内容 | 依据 |
|---|---|---|---|
| MI-a | T2 验收 2 | question 类 notice body **不含** `option_id` 键 | §5.3 question 形态逐键列出（5 键）+ PR 验收 3 对 permission 侧的对称明文 |
| MI-b | T2 验收 4 ⑤ | `option_ids` **出现但非字符串数组**（含显式 `null`）⇒ 400；键**缺失** ⇒ 视为空集 | PR 验收 5「非字符串数组 ⇒ 400 且保留在途」的明文（未以 `text` 是否非空为条件）+ 验收 5 ① 要求「仅 `text` 非空白可提交」 |
| MI-c | T3 验收 3 | `option_id` 的 `required` 布尔处理 + `web.js:23` 顶部路由注释行同步 | `params[].required` 无法表达条件必填（A7）+ G2-D3（同源文案失真须同步）+ 最小改动 |
| MI-d | T3 验收 4 | `API.md` §3.20 的 `tool` / `title` 两行补 question 类语义口径 | §5.2 字段语义表（`tool` = 承载名、`title` = 问题文本）+ 一致性约束（表中不得与本 PR 引入的事实矛盾） |
| MI-e | T1 验收 2b | 域外字符串 `request_kind` ⇒ 条目 `'permission'`（值域闭合） | §5.2 类型列 `'permission' \| 'question'`（条目字段不得持有第三值）+ 「非字符串 ⇒ `'permission'`」同向 |
