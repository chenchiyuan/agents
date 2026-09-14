# pr-004：过程增量按 `kind` 分区渲染（前端，既有气泡内）

## 上下文摘要

前端在**既有流式占位气泡内部**按 `task_update.kind` 分区渲染：`chunk` 仍写既有 `#stream-text`（语义逐字不变），新增 `thinking` / `tool_call` / `tool_output` 三个过程分区。**不新增面板 / 页面 / SSE 事件类型 / 开关 / 过滤 / 分级**（N5 / MI-A-1 / MI-A-2）。`oamp/src/web.js` 零改动（既有分支只校验 `kind` 是否字符串、原样透传 `{chat_id, task_id, kind, text, line}`），故本 PR 与 pr-001~pr-003 之间**无代码级依赖**，可与 pr-001 同批起跑；过程数据真正到达界面需要 pr-003 的 rpc 链路（F08 验收 1 的端到端形态在 pr-003 合并后复核）。

## 涉及功能点

- F08

## 文件范围

- `oamp/web/app.js`（**修改**：① `handleEvent` 的 `task_update` 分支（`:563`、`:566-572`）与 `appendChunk`（`:601-611`）按 `kind` 分流——`chunk` 走既有 `#stream-text` 路径，新增三个 kind 走气泡内过程分区；② 流式气泡模板（检索式 `id="stream-text"`，`:421`）内新增 `thinking` / `tool` 两个过程分区容器；③ **保持**`for (const type of ['message', 'task_update', 'chat_state', 'notice'])`（`:556`）逐字不变（不新增 SSE 事件类型）；④ 既有 `message(out)` 到达即清空流式态的行为不变（检索式 `state.stream = { chatId: data.chat_id, text: '' }`）；⑤ 新增渲染函数须为顶层函数、命名不与既有六函数（`loadProjects` / `renderProjects` / `createProject` / `resolveCurrentProject` / `showProjectList` / `showWorkspace`）与 `init` 顺序冲突）
- `oamp/web/style.css`（**条件修改**：仅当过程分区需要新增样式时改动——§9.3 已登记为「实现阶段确认」项；若可用既有 class 组合表达，则本 PR **不触碰**此文件）

**零改动（防夹带；越界即 F08 验收 2 / 4 不通过）**：`oamp/web/index.html`（既有 `#stream-text` 节点与脚本标签逐字不变；分区容器由 `app.js` 渲染）、`oamp/web/notify.js`、`oamp/src/web.js`（`task.update` 分支与 SSE 帧面，`:1626-1632`）、`oamp/src/transport.js`、`oamp/test/**`（本 PR 不修改任何既有测试文件）。

## 验收标准

- [ ] **既有文本渲染零回归**（F08 验收 1 的既有面）：走 `!` shell 路径与常驻 `chunk` 流 → 文本仍逐块写入既有 `#stream-text`，气泡内滚动与「终态以落盘文本为准」的清空行为不变（可在浏览器实跑观察：一轮结束后过程分区随流式态清空、答案文本与落盘一致）。
- [ ] **三个新 kind 落点正确**（F08 验收 1/2）：`task_update{kind:'thinking'|'tool_call'|'tool_output'}` 分别渲染进气泡内的**过程分区**，**不并入**答案文本（`#stream-text` 内容不含过程内容）；判定可在浏览器控制台直接调用页面的顶层函数 `handleEvent('task_update', { chat_id: <当前对话>, kind: 'thinking', text: 't' })` 观察落点。
- [ ] **不新增 UI 载体、不做开关/过滤/分级**（F08 验收 2/4）：无新面板 / 新页面；`oamp/web/index.html` 零改动；SSE 订阅仍为既有 4 类事件（无新增 `addEventListener`）；控制台与配置面无过程展示的开关 / 过滤 / 分级项。
- [ ] **过程内容不进入答案、也不改变记录条数判据**（F08 验收 3 的界面侧）：界面上的过程块随 `message(out)` 到达而清空，不产生额外消息条目（不入库由 `oamp/src/web.js` 的零改动保证）。
- [ ] **既有前端静态契约不回归、且不以改测试达成**（本 PR 不修改任何测试文件）：`node --test oamp/test/web.test.js oamp/test/inbox-console.test.js oamp/test/api-pages.test.js oamp/test/project-workspace.test.js` 中「前端静态契约」类用例保持绿（含 `app.js` 顶层函数在场断言、`POLL_MS` / `setTimeout(tick` 否定断言、`/api/chats/` 读口断言、订阅 4 类事件断言）。
- [ ] **零生产后端改动**：`git diff --stat` 只含 `oamp/web/app.js`（及可能被条件纳入的 `oamp/web/style.css`），不含 `oamp/src/**` 与 `oamp/test/**`。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§5.5 增量 → 既有运行时通道的帧面（T-06 粒度 = 原样、T-07 = 复用既有 `task_update` + 三个新 kind + `web.js` 零改动）、§3.4 流 1 第 ⑥ 步、§6 F08、§7 T-06 / T-07、§9.2 B-5、§9.3 零改动清单（`index.html`、`web.js`、`style.css` 的待确认项）、§12.1 MI-A-1 / MI-A-2）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F08-process-visibility-runtime-stream.md（验收 1 / 2 / 4 的界面面；验收 3 的不入库面归 pr-003）
- 既有代码基线（改动锚点）：`oamp/web/app.js:421`（流式气泡 + `#stream-text`）、`:556`（4 类事件订阅）、`:563-572`（`handleEvent` 的 `task_update` 分支，现状不分 kind）、`:601-611`（`appendChunk`）
- 上游帧面（零改动，本 PR 的输入契约）：`oamp/src/web.js:1626-1632`（`task.update` → SSE `task_update{chat_id, task_id, kind, text, line}`，`stdout` 专属 `entry.lines` 累积不被新 kind 触发）

## depends_on

（无）

> 代码级依据：`oamp/web/app.js` 只读 SSE 帧的 `kind` / `text` / `line` 三个字段，不 import 任何 `src/` 模块；`oamp/src/web.js` 的 `task.update` 分支（`:1626-1632`）零改动、原样透传新 kind ⇒ 本 PR 不引用 pr-001~pr-003 的任何新增符号（无共享符号 / 无共享接口 / 无共享文件）。F08 验收 1 的**端到端**形态（默认 rpc 链路上实时看到三类增量）在 pr-003 合并后复核，属验收安排，不是合并前置。

## batch

1
