# pr-003-title-edit-visibility

## 上下文摘要

修复编辑态「标题与输入框并存」的视觉缺陷：`beginTitleEdit()` 给 `h1#detail-title` 加 `hidden` 类、想以隐藏标题来露出输入框，但 `style.css` 只定义了 `.detail-title-input.hidden`（本仓 `.hidden` 另有 `.mention.hidden`），没有针对 h1 的规则 ⇒ 该类名对 h1 无效果，实测 h1 与 input 同时 `display:block`。本 PR 新增一条 `.detail-head h1.hidden { display: none; }` 使实现意图与视觉一致，并在 `web.test.js` 的静态契约段追加 1 条断言把该规则钉住（既有断言零删改）。仅样式与测试断言，无 JS / 接口 / 数据层改动。

## 涉及功能点

- F01

## 文件范围

- oamp/web/style.css（修改）
- oamp/test/web.test.js（修改）

## 验收标准

- [ ] 编辑态互斥（浏览器实测）：点击可编辑对话的标题后，`h1#detail-title` 的 computed `display` 为 `none`（几何矩形消失），`input#detail-title-input` 可见（`display` 非 `none`，矩形存在）
- [ ] 退出编辑态恢复（浏览器实测）：Enter 保存、失焦保存、Esc 取消**三种路径各一次**，退出后 h1 恢复可见且文本为当前标题，input 的 computed `display` 为 `none`
- [ ] 既有断言零删改：`oamp/test/web.test.js` 既有断言逐条保留（含 `:1023-1028` 的 0014 静态契约 5 条与 `:415-431` 回归锁），仅在其后追加 1 条 `assert.match(css, /\.detail-head h1\.hidden/)`
- [ ] 全仓串行测试全绿：`cd oamp && node --test test/*.test.js`（既有 **226 用例**全绿（断言 +1、用例数不变——新增断言落在既有用例体内）；无 skip / 无 only）
- [ ] 只读与空态不受影响：归档 / 已关闭 / 空态点击标题仍无编辑框出现，h1 保持可见（既有 `.hidden` 类未被误加）

## 参考资料

- docs/iterations/0014-chat-rename/prs/pr-002-rename-api-ui-contract.md（本 PR 修补其交付的编辑态样式与静态契约段）
- docs/iterations/0014-chat-rename/architecture.md（§6.1 详情头静态结构 / §6.2 renderTitle 四态 / §6.6 样式：AR-07 注释已写明"本仓 .hidden 只对 .mention 生效，此处需独立规则"——本条 h1 规则是该判断的遗漏补全 / §10 AR-01、AR-09）
- docs/iterations/0014-chat-rename/prd/F01-inline-title-edit-commit.md（验收 1：点击后该处变为编辑框）

## depends_on

- pr-002-rename-api-ui-contract.md（理由：本 PR 修改的正是 pr-002 交付的编辑态样式与其静态契约段——`style.css` 的 0014 规则块与 `web.test.js` 的静态契约用例均由 pr-002 引入，`h1` 的 `hidden` 类切换行为也由 pr-002 的 `app.js` 交付，未经 pr-002 合并则无「h1 加 hidden 类」这一行为可修。证据：`oamp/web/style.css:166-182`（0014 编辑态样式块，含 `.detail-title-input.hidden`）、`oamp/test/web.test.js:1023-1028`（注释「0014（pr-002）：详情头标题行内编辑的静态契约」）、`oamp/web/app.js:186` `$('detail-title').classList.add('hidden')` 与 `:175` / `:200` 的 `classList.remove('hidden')`）

> 文件范围与 pr-002 重叠属**已合并后补丁**的固有情形（pr-002 已合入 `iteration/0014-chat-rename`，本 PR 基于其产物的当前状态修改），不存在并发合并窗口；阶段 4 的「文件范围无重叠」判据针对并发可派发的 PR 集合，本补丁不与之冲突。

## batch

3
