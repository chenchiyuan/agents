# pr-002：web 进程承载提问信封与裁决分化（白名单 + 裁决路由 + 派生面同步）

## 上下文摘要

web 进程侧落地提问面的消费端：信封白名单增 `request_kind`/`multiple`（缺 `request_kind` 兜底 `'permission'`），裁决路由按 `request_kind` 分化——question 类校验 `option_ids ⊆ 选项` 且「至少填其一」（否则 400 保留在途）、回传 `{option_ids, text}`、停掉「文本 → chat 输入」旁路；permission 类不变。

## 涉及功能点

- F04
- F05
- F07
- F10
- F14
- F15

## 文件范围

- `oamp/src/web.js`（**修改**：① `handleDeliver` 的 `confirmation_request` 分支白名单 +`request_kind`（`'permission' | 'question'`，缺失/非字符串 ⇒ 兜底 `'permission'`）+`multiple`（boolean，缺失 ⇒ `false`）（:1597-1610）；② 裁决路由按 `request_kind` 分化：question 类读 `body.option_ids`（须为字符串数组、须 ⊆ 该条 `options`）且「`option_ids.length > 0 || text.trim() !== ''`」，不满足 ⇒ `400 INVALID_PARAM` **且条目保留在途**（沿用既有回填体例）；回传 `notice{kind:'confirmation_decision', confirmation_id, option_ids, text, chat_id}`；**停掉**「文本 → 追加一条 chat 输入并派发」旁路（:1313-1340 分支按 `request_kind` 排除）、permission 类维持既有 `{option_id, text}` 路径逐字不变（:1301-1311）；③ 路由元数据同步（`params` +`option_ids`、`response` 的条目字段 +`request_kind`/`multiple`）（:1258-1263、:1275-1285））
- `oamp/API.md`（**修改**：§3.21 的 body 字段补 `option_ids` 与「选项与自由文本至少一个非空」的可选值域说明；§3.20 的条目字段补 `request_kind` / `multiple`。检索式：`### 3.20`、`### 3.21`、`## 3. 接口清单`）
- `oamp/llms.txt`（**条件性**：仅当路由 `summary` 文案变更时按 `node oamp/scripts/gen-llms-txt.mjs` **重新生成**，不手改）
- `oamp/test/confirmation-inbox.test.js`（**修改**：沿用既有 `startFakeNode` + `ENVELOPE` 工厂的注入面（:153-183）新增断言：① `request_kind:'question'` 信封 ⇒ 入表且 `GET /api/confirmations` 的条目含 `request_kind:'question'` 与 `multiple`；② 提交 `{option_ids:[…], text}` ⇒ `200 {accepted:true}` + 该条移出在途 + 假节点收到 `notice{kind:'confirmation_decision', option_ids}`；③ **对话记录零新增消息**（question 类旁路停掉）；④ `option_ids` 含域外值 / 数组为空且 `text` 为空白 ⇒ `400 INVALID_PARAM` 且条目**仍在表内**；⑤ 缺 `request_kind` 的信封仍走 permission 类路径且既有用例（:256+）逐字保持绿）

**零改动（防夹带；越界即 F14 / F15 验收不通过）**：`oamp/src/inbox.js`（`add/list/take/remove/size` 五导出、`take()` 即删）、`oamp/src/transport.js`（SSE 键空间与 `publishGlobal` 调用点）、`oamp/src/persist.js`（无新表 / 无新列）、`oamp/src/router.js`、`oamp/src/protocol.js`、`oamp/src/launcher.js`、`oamp/src/config.js`、`oamp/src/agent.js`、`oamp/src/rpc-client.js`、`oamp/src/acp-client.js`、`oamp/src/oneshot-client.js`、`oamp/src/context-pool.js`、`oamp/web/**`（`index.html` / `app.js` / `style.css` / `notify.js`）、`oamp/bin/**`、`oamp/package.json`、`oamp/test/{api-routes,project-workspace,call-protocol,web,inbox-console,hygiene,zero-intrusion}.test.js`、`oamp/test/helpers/**`、`omp/**`。

## 验收标准

- [ ] **信封字段白名单（F04 验收 1 / F05 验收 1/2/4 / T-02）**：投递一条含 `request_kind:'question'` / `multiple:true` / `title` / `options`（含 `[]` 空态）的 `confirmation_request` ⇒ `GET /api/confirmations` 的该条目**逐字段**含这四项（`confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at` 七字段的既有口径不变）；`request_kind` 缺失的投递 ⇒ 条目 `request_kind` 为 `'permission'`（兼容面）。
- [ ] **全局帧形状一致（F04 验收 1 的服务端半）**：首次入表时全局订阅（`GET /api/events`）收到**恰一帧** `confirmation`，其 `data` 与列表元素同形状（含 `request_kind`）；重复投递同一 `confirmation_id` 不再入表、不再发帧；重建面 `GET /api/confirmations` **不发帧**。
- [ ] **回传载荷按 `request_kind` 分化（F07 验收 1 / T-04）**：question 类提交合法 `{option_ids, text}` ⇒ 发出方收到 `notice{kind:'confirmation_decision'}`，body 的 `option_ids` 与用户提交**同值同序**、`text` 逐字、`confirmation_id` / `chat_id` 同值；permission 类提交 `{option_id}` ⇒ body 仍为 `option_id`（**不含** `option_ids` 键）。
- [ ] **旁路停掉（F07 验收 3 / 登记⑧ ④）**：question 类提交后 → **对话记录零新增 `in` 消息**、无派发（`db` 无新行、无 `task` 登记）；permission 类附文本提交 → 既有「追加一条 chat 输入并派发」行为逐字不变（F07 验收 4）。
- [ ] **必填性与错误契约（F05 验收 5 / F07 验收 1 / MI-03）**：question 类三种输入各测一次——① 仅 `option_ids` 非空 ⇒ 可提交；② 仅 `text` 非空白 ⇒ 可提交；③ 两者皆空 ⇒ `400 INVALID_PARAM` 且条目**保留在途**；`option_ids` 含该条 `options` 之外的取值 / 非字符串数组 ⇒ 同上 400 且保留在途；`confirmation_id` 不在表内 ⇒ `404 NOT_FOUND`（同一码，不区分「已裁决 / 已失效 / 从未存在」）。
- [ ] **permission 类零回归（F10 验收 3 / 登记⑧ ③）**：既有 permission 类路径（选项 id 必填 + 可选文本 + 文本落地）逐条保持绿（既有 `test/confirmation-inbox.test.js` 用例零削弱）。
- [ ] **服务边界不变（F14 验收 1/2/3）**：本 PR 不新增监听地址 / 端口 / 鉴权 / 对外接口（`grep -n "listen\|createServer" oamp/src/web.js` 命中集合不变）；提问通路可达面仍仅本机控制台。
- [ ] **无历史台账（F15 验收 1/2/3）**：`inbox` 仍是「只装未裁决项、`take()` 即删」；无任何已裁决条目的列表 / 查询参数 / 导出入口；未裁决项刷新后仍在（`GET /api/confirmations` 重建面）；`oamp/src/persist.js` 零改动（不判数据层，沿用 0021 MI-03 口径）。
- [ ] **派生面同步且漂移锁未削弱**：`oamp/API.md` 与应用内路由元数据一致；若改了路由 `summary` ⇒ `oamp/llms.txt` 由生成脚本重生成后与仓库文件**逐字节相等**（`test/api-routes.test.js` 漂移锁②/③ 与 `test/project-workspace.test.js:1283-1305` 保持绿，既有 21 条登记路径与标题断言逐字不改）。
- [ ] **命令全绿且改动面封闭**：`node --test oamp/test/confirmation-inbox.test.js oamp/test/api-routes.test.js oamp/test/project-workspace.test.js oamp/test/web.test.js` 全绿；`node --test oamp/test/*.test.js` 无非本 PR 引入的失败；`git diff --stat` 只含本 PR 列出的文件。

**择一判定声明（跨 PR 验收归属）**：① F04 验收 1（条目出现）与 F07 验收 1/3 的**服务端主面在本 PR**；栏内可见 / 控件面归 pr-003；`notice` 信封面（生产者）归 pr-001。② F05 验收 5 的**权威判定点在本 PR**（L2-7：服务端校验），前端只做可用性提示 ⇒ 本条只计本 PR 的判定。③ F15 验收 1/2 的主面在本 PR（服务端无历史入口），辅面在 pr-003（界面无历史面）。

## 参考资料

- `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`（§3.1 组件图、§3.2 `src/web.js` 行、§3.3 流 4「作答回传」、§4.1 L1-3 / L1-4、§4.2 L2-7（服务端权威校验）、§5.2 信封 9 字段表与 M3 可表达性对照、§5.3 回传载荷与校验规则、§6 F04 / F05 / F07 / F10 / F14 / F15、§7 T-02 / T-04、§9.1 `src/web.js` 行、§9.3 零改动清单、§9.5 文档面）
- `docs/iterations/0023-yolo-approval-and-question-inbox/prd/F04-question-surfacing.md`、`F05-question-shape.md`、`F07-answer-roundtrip.md`、`F10-permission-channel-preserved.md`、`F14-service-boundary-unchanged.md`、`F15-no-history-ledger.md`
- 代码基线锚点：`oamp/src/web.js:1258-1263`（列表路由元数据）、`:1272-1341`（裁决路由全文，`:1301-1311` 回传、`:1313-1340` 文本旁路）、`:1597-1610`（`confirmation_request` 白名单）、`:1613-1616`（`confirmation_cancelled`）、`:1695-1703`（`sendControlNotice`）；`oamp/src/inbox.js:9-42`（五导出与 `take()` 即删）；`oamp/test/confirmation-inbox.test.js:153-183`（`startFakeNode` + `ENVELOPE` 注入体例）、`:256`（既有 permission 类用例）
- 体例参照（只读）：`docs/iterations/0021-confirmation-inbox-and-event-push/prs/pr-003-web-inbox-and-decision-api.md`（web 进程承载确认面的同型 PR：路由 + 白名单 + 派生面同步）

## depends_on

（无）

**依赖核实结论（本 PR 与 pr-001 之间不存在硬依赖，故不写依赖）**：两 PR 在**同一信封**上的契约已**解耦**（依据：`architecture.md` §5.2.1「字段面 = 生产面 / 消费面的边界」与 §12.4「两 PR 的解耦口径」）——**生产面**（`pr-001` 的 `agent.js::raiseConfirmation`）**只增字段** `request_kind`（由钩子入参 `requestKind` 一对一透传；入参缺省 ⇒ `'permission'`）与 `multiple`，**不改任何既有判据**；**消费面**（本 PR 的 `web.js` 白名单重建 + `web/app.js`）**只读** `body.request_kind`（**非字符串 ⇒ 兜底 `'permission'`**）与 `body.multiple`（非布尔 ⇒ `false`）。三条论证：① **通知类型判据零改动**——`oamp/src/web.js:1597` 的 `body.kind === 'confirmation_request'` 逐字保留且**恒成立**（通知 `kind` 恒为 `'confirmation_request'`，类别值另置 `request_kind`，两值各占一键）⇒ 不再存在「生产面必须与消费面同批改判据」的耦合；D-1 所记的耦合**根因（同一扁平 key 承载两个值）已被消除**，不是被绕开；② **消费面对缺字段的兜底是既有设计而非新加**——缺 `request_kind` ⇒ `'permission'`（与 v0.2.0 §5.2 的兜底口径同源，只是字段名变了）⇒ 生产面未合入时新分支为**惰性**：既有投递照常走 permission 类路径，无条目丢失、无构建失败、无测试失败；③ **两侧的判定面互不重叠**——本 PR 的新增断言可用**既有测试注入面**独立构造（`oamp/test/helpers/fake-node.js:26` 的 `startFakeNode` + `oamp/test/confirmation-inbox.test.js:175-183` 的 `ENVELOPE` 工厂**直接合成**一条 `request_kind:'question'` 的 `confirmation_request` 投给 web，0021 已建立的体例），不需要 `pr-001` 的任何代码；**反向亦然**：`pr-001` 的断言面是 agent 进程的 `notice` 信封面（`test/confirmation-roundtrip.test.js` / `test/protocol-layer.test.js`），不读 `web.js` 的白名单 ⇒ 两 PR 互不阻塞，可并发。

## batch

1
