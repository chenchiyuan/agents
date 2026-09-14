# pr-003：控制台第三栏 question 条目渲染与提交载荷分化

## 上下文摘要

前端第三栏按 `request_kind` 分化：question 类渲染「多选取舍 + 自由文本 + 一次提交」并提交 `{option_ids, text}`；permission 类渲染与「点选即裁决」逐字不变（N11）。数据来源与载体不变（仍 `GET /api/confirmations` + 全局 `confirmation` 帧；零新存储/轮询/依赖/构建）。服务端契约由 pr-002 交付。

## 涉及功能点

- F05
- F06
- F07
- F10
- F15

## 文件范围

- `oamp/web/app.js`（**修改**：① `renderInboxItem` 按 `entry.request_kind` 分化——question 类：每个选项一个多选控件（`entry.multiple === true` 时允许多选）+ 自由文本输入 + 一个「提交」按钮；permission 类保持「每选项一个按钮 + 单行文本框」（:671-681，既有断言面 `oamp/test/inbox-console.test.js:331-336` 逐字保持）；② 新增 question 提交路径：收集勾选项 → 提交 `{option_ids, text}`，提交中控件 `disabled`，`200` ⇒ 立即整条移出栏内（不等 SSE）、`404` ⇒ 同样移出、其余失败 ⇒ 保留条目并重绘；`decide`（permission 类 `{option_id, text}`）**逐字不变**（:717-732）；③ `renderInbox` 的控件接线按条目类型分派（:684-697）。**零改动**：`state.inbox` 形状（:37）、`loadConfirmations`（:653-661）、`inboxRequest` / `inboxSource`（:646-668）、`dropInboxItem`（:709-712）、`syncInboxLabels`（:701-706）、`focusFromNotify`、全局 SSE 的 `confirmation` 分支（:170-182）与 `onopen` 重建（:167）；不得出现 `POLL_MS` / `setTimeout(tick` 形态）
- `oamp/web/style.css`（**修改**：question 类多选控件与提交按钮的样式——在既有类名体系内**只追加**，零新框架、零新文件）
- `oamp/test/inbox-console.test.js`（**修改**：① 扩展 `renderInboxItem` 的静态契约断言（question 类出现多选控件 / 提交按钮 / 自由文本框；permission 类三条标记与既有 `placeholder` 文案逐字仍在）（:315-336）；② 扩展手势入口计数断言——`oampNotify.requestPermission()` 的调用点由 2 处变 3 处（question 提交入口新增一处）并断言落点仍在第三栏交互回调内（:379-380）；③ 用既有 `fnBody` + `vm` 沙箱体例（:59-99）执行渲染 / 提交路径：给定 `request_kind:'question'` / `multiple:true` / 含选项与 `options: []` 两种条目 ⇒ 产出可勾选控件与提交按钮，提交 body 为 `{option_ids, text}`；给定 `request_kind` 缺失或 `'permission'` ⇒ 渲染与提交与 0021 逐字一致；④ `style.css` 只追加的既有判据（:284-311）保持绿）

**零改动（防夹带）**：`oamp/web/index.html`（第三栏静态骨架不变）、`oamp/web/notify.js`（事件类型集合与投递面不变）、`oamp/web/{docs,debug,calls}.js` 与 `oamp/web/api-pages.css`、`oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/package.json`、`oamp/test/{api-pages,confirmation-inbox,web,project-workspace,hygiene}.test.js`、`oamp/test/helpers/**`、`omp/**`。

## 验收标准

- [ ] **question 类条目形状（F05 验收 1/2/3/4 / MI-02）**：给定条目 `request_kind:'question'`、`title:'优先保证哪一点？'`、`options:[{option_id:'思考过程可见'},{option_id:'工具调用可审批'}]`、`multiple:false` ⇒ 渲染出①来源对话标识（既有首行）②问题文本（既有第二行）③**单选即取舍**的控件 + 自由文本输入 + 一个**提交**按钮；同一构造但 `multiple:true` ⇒ 控件允许勾选**多项**。
- [ ] **无选项纯自由文本（F05 验收 4）**：条目 `options: []`（question 类）⇒ 条目仍渲染（选项区为空）、文本可提交、无「选项必选」的阻塞。
- [ ] **提交载荷分化（F05 验收 3 / F07 验收 1 / T-04）**：question 类「勾选项 + 文本」一并提交 ⇒ 请求 body = `{option_ids:[…], text:'…'}`（`option_ids` 与勾选集合同值同序）；仅文本 / 仅选项两类提交同样走 question 提交路径；**permission 类提交 body 仍为** `{option_id, text}`。
- [ ] **一次提交即一次裁决（MI-02 / L2-8）**：提交中相关控件 `disabled`；`200` ⇒ 该条**立即**移出栏内（不等 SSE）；`404`（已裁决 / 已失效）⇒ 同样移出、不重放；其余失败 ⇒ 条目保留（重绘复位控件）。
- [ ] **permission 类零退化（F10 验收 3 / N11）**：`request_kind` 缺失 / `'permission'` 的条目渲染三行 + 每选项一个按钮 + 文本输入，**点选即裁决**（一次点击 = 一次提交），与 0021 逐字一致（既有静态断言零削弱）。
- [ ] **多问题独立（F06 验收 1/2）**：栏内含 N 条 question 条目时只作答其中一条 ⇒ 该条移出、其余条目仍在且可独立提交（每条各自 `confirmation_id`）。
- [ ] **数据来源与载体不变（F15 验收 2 / 登记⑧ ②）**：条目仍来自 `GET /api/confirmations`（首屏与每次 `onopen` 重建）与全局 `confirmation` 帧；刷新 / 断线重连后未作答条目仍在；零前端存储、零轮询、零新页面 / 新顶栏入口 / 新过滤器 tab；**不区分条目类型**地统一消费 `request_kind`。
- [ ] **界面无历史面（F15 验收 1/3）**：栏内只出现在途条目，无已裁决条目的列表 / 入口（移出即不再出现）。
- [ ] **样式只追加（api-pages 体例 / 见 `oamp/test/inbox-console.test.js:284-311`）**：`style.css` 的既有声明文本原样在场，新增规则为 question 类控件样式；零新 CSS 文件、零框架、零构建。
- [ ] **命令全绿且改动面封闭**：`node --test oamp/test/inbox-console.test.js` 全绿；`node --test oamp/test/*.test.js` 无非本 PR 引入的失败；`git diff --stat` 只含本 PR 列出的 3 个文件。

**择一判定声明（跨 PR 验收归属）**：① F05 验收 2 的「条目允许选中多项并一并提交」**主面在本 PR**（栏内控件），pr-001 只判信封 `multiple` 的承载；② F07 验收 1 的「答案到达提问方」**主面在 pr-001**（提问侧收包）+ pr-002（服务端回传），本 PR 只判「提交载荷形态正确」；③ 端到端（F05 / F07 的完整链路）需三个 PR 全部合入，**不计入任何单个 PR 的判定**，由阶段 6 端到端验收覆盖。

## 参考资料

- `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`（§3.1 组件图（`app.js` 第三栏 question 条目）、§3.2 前端 2 文件行、§3.3 流 4、§4.1 L1-3 / L1-4、§4.2 L2-8（question 类 = 取舍 + 提交）、§5.2 信封（`request_kind` / `multiple` 的展示位 → 前端第二行零改动）、§5.3 回传载荷、§6 F05 / F06 / F07 / F10 / F15、§9.2 前端变更点、§9.3 零改动清单（`index.html` / `notify.js`））
- `docs/iterations/0023-yolo-approval-and-question-inbox/prd/F05-question-shape.md`、`F06-multi-question-one-item-each.md`、`F07-answer-roundtrip.md`、`F10-permission-channel-preserved.md`、`F15-no-history-ledger.md`
- 代码基线锚点：`oamp/web/app.js:37`（`state.inbox`）、`:167`（`onopen` 重建）、`:170-182`（`confirmation` 帧分支）、`:653-661`（`loadConfirmations`）、`:665-681`（`inboxRequest` / `renderInboxItem`）、`:684-712`（`renderInbox` / `syncInboxLabels` / `dropInboxItem`）、`:717-732`（`decide`）、`:1152-1157`（开合入口与手势点）；`oamp/test/inbox-console.test.js:59-99`（`fnBody` + `vm` 体例）、`:284-311`（CSS 只追加判据）、`:315-336`（`renderInboxItem` 静态契约）、`:362-380`（派发点与手势点计数）
- 体例参照（只读）：`docs/iterations/0021-confirmation-inbox-and-event-push/prs/pr-004-console-inbox-column-and-notify.md`（控制台第三栏同型 PR）

## depends_on

- `pr-002-web-envelope-and-decision-routing.md`（理由：本 PR 直接消费 pr-002 交付的**跨进程字段与请求 body 契约**，缺它则本 PR 的验收标准无法成立——证据：① `oamp/web/app.js:671-681` 的 `renderInboxItem` 将按 `entry.request_kind` / `entry.multiple` 分化，而这两个字段的**唯一产出点**是 pr-002 的 `oamp/src/web.js:1597-1610`（`confirmation_request` 白名单重建条目）——今天该白名单不读它们 ⇒ 条目恒无 `request_kind`，本 PR 的 question 分支**不可达**，「多选 / 提交」的判据无从构造；② 本 PR 的 question 提交 body `{option_ids, text}` 由 pr-002 的裁决路由校验（`oamp/src/web.js:1301-1311` 今天只接受 `option_id`，非法即 `400` 且条目保留在途）⇒ 未合入 pr-002 时「勾选多项一并提交回传」必然 400，验收失败；③ 反向不成立：pr-002 的断言面是 HTTP 与 `inbox` 表（用 `test/helpers/fake-node.js` 注入信封），不读 `web/app.js` ⇒ 本依赖为**单向**，无环。）
- 与 pr-001 之间**无直接依赖**（不同进程面、不同文件）：本 PR 的判定面是「提交载荷形态 + 栏内渲染」，用 pr-002 的服务端即可独立构造条目；完整用户链路（提问 → 作答 → 回传）需 pr-001 一并合入，属阶段 6 的端到端验收面，不写成本 PR 的依赖。

## batch

2
