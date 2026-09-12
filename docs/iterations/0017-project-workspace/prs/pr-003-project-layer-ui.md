# pr-003-project-layer-ui

## 上下文摘要

前端项目层：`index.html` 增 `#projects-view`（项目行 + 最小新建输入）与 `.topbar` 内的 `#project-bar`（返回入口 + 当前项目名）；`app.js` 增项目层取数与渲染、`init()` 按 `?project=` 分派工作台 / 项目列表、`loadChats()` / `loadArchived()` / `send()` 三处带 `project_id`；`style.css` 只追加规则（含三条真隐藏规则）。零新增静态资产、`STATIC_FILES` 与 `GET /` 映射不变；SSE / 归档 / 改名零改写。

## 涉及功能点

- F04（首屏项目列表页：未选项目看不到对话、不能发消息、可新建、可进入、列表信息量、创建后原地出现）
- F05（项目工作台：顶栏显示当前项目名 + 返回入口、列表范围为当前项目、新建自动归属、既有能力照常）
- F02（前端侧：工作台内新建自动归属当前项目，`send()` 固定带 `state.projectId`）
- F03（前端侧：列表 / 归档视图一律带项目参数，切换项目靠整页导航清空上一项目的内存态）

## 文件范围

- oamp/web/index.html（修改）
- oamp/web/app.js（修改）
- oamp/web/style.css（修改）

## 验收标准

- [ ] `web/index.html` 含全部新增**静态节点**（不动态创建）：`#projects-view` 及其内的 `#project-repo`（input）/ `#project-name`（input）/ `#btn-create-project`（button）/ `#project-list` / `#project-hint`；`.topbar` 内 `.topnav` 之后的 `#project-bar` 及其内的 `#btn-back-projects`（`href="/"`）与 `#current-project-name`；`main.layout` 为既有元素（未选项目时挂 `.hidden`）
- [ ] `web/app.js` 的 `init()` 为 boot 分派（`loadAgents` → `connectAgentEvents` → `resolveCurrentProject()`）：`/`（无参数）⇒ 项目列表视图 + `main.layout` 隐藏 + **不调** `/api/chats`；`/?project=<已知 id>` ⇒ 工作台（`#project-bar` 可见 + `loadChats(project)` + `renderChat()`）；`/?project=<未知 id>` ⇒ 回落项目列表视图（不报错、不渲染空工作台）
- [ ] 三处调用点带项目参数：`loadChats()` 与 `loadArchived()` 的 URL 含 `project_id=`（`encodeURIComponent(state.projectId)`）；`send()` 的请求体含 `project_id: state.projectId`（工作台内新建自动归属，全程无项目选择步骤）
- [ ] 项目层取数与渲染：`loadProjects()` / `renderProjects()` / `createProject()` / `showProjectList()` / `showWorkspace()` 齐备；每行显示 项目名 + 仓库地址 + 对话数 + 最近活动时间（`last_activity_at === null` 用既有 `fmtAgo()` 渲染占位 `—`、不报错）；创建成功后**停留项目列表视图**并重新 `loadProjects()` 原地出现（不跳进工作台、不引入轮询）；创建失败（400 / 409）文案落 `#project-hint`
- [ ] `web/style.css` 追加 `.layout.hidden` / `.projects-view.hidden` / `.project-bar.hidden` 三条真隐藏规则（`display: none`），且既有规则逐字不动
- [ ] 零新增静态资产：`web.js` 的 `STATIC_FILES`（12 个键）与 `GET /` → `web/index.html` 的映射不变；既有前端契约断言仍绿（`doesNotMatch(appJs, /POLL_MS/)`、`doesNotMatch(appJs, /setTimeout\(tick/)`、`html` 含 `Web Console` / `/docs` / `/debug` 两条 href、既有占位 nav 项逐字未变、`#conn-status` 仍在 `#agent-panel` 之前）
- [ ] `web/app.js` 零改写清单：SSE 订阅（`subscribe` / `handleEvent` / `appendChunk`）、归档 / 关闭 / 激活 / 改名、标题行内编辑、`@` 补全、working 等待计时、`isReadonly`、列表内存过滤；页面文案不含"已 clone / 已在项目根目录"一类环境承诺

## 参考资料

- docs/iterations/0017-project-workspace/prd/F04-project-list-page.md
- docs/iterations/0017-project-workspace/prd/F05-project-workspace.md
- docs/iterations/0017-project-workspace/architecture.md（§5.1 T-05 页面与文件组织 / §5.2 T-13 当前项目载体 / §5.3 app.js 改动点穷举 / §7.1 数据流）
- oamp/web/index.html（`.topbar` / `main.layout` 既有结构）
- oamp/web/app.js:881（`init()` 既有 boot 顺序）、`loadChats()` / `loadArchived()` / `send()` / `bind()`
- oamp/web/style.css:64 / :203 / :204 / :295（本仓 `.hidden` 逐组件定义、无全局规则）
- oamp/test/web.test.js:1025、:1248、:1601（既有前端静态契约断言面）、oamp/test/api-pages.test.js:58（顶栏入口断言用例）

## depends_on

（无）

## batch

2

说明（不是依赖）：本 PR 与 pr-002 互不构成测试失败前提——前端侧既有断言全是文本级静态契约；pr-002 落地前 `web.js` 会忽略未知的 `project_id` 扩展参数。但两者产物在运行期互补（控制台可用需 `GET` / `POST /api/projects` 与 `project_id` 必填面在场），故与 pr-002 同波次（batch 2）派发，避免迭代分支上出现"半建成控制台"的窗口。
