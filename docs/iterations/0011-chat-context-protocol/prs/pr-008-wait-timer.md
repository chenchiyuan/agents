# PR-008：working 等待计时与慢模型提示（补丁）

## 上下文摘要

交付演示实测：`openai/gpt-5.6-luna` **首 token 延迟 242 秒**（started @+0ms → 首个 chunk @+242724ms，36 个 chunk 全挤在最后 3.6s），任务 246s 后才 completed；期间 UI 只显示 working 无内容 → 用户误判"卡住"。补丁在 working 期间显示「思考中 · 已等待 Ns」（每秒**只更新**状态行计时元素，不重绘消息流），跨 30s 追加慢模型提示（可在模型框切换）。此为该实测引发的用户决策之一（另一项：内置默认模型改 deepseek，见 pr-009）。

## 涉及功能点

- F04（过程实时展示：等待可见性，区分"思考中"与"卡死"）

## 文件范围

- oamp/web/app.js（working 计时器 + 阈值提示 + 停表语义）
- oamp/web/style.css（.waiting / .slow-hint 轻量样式）
- oamp/test/web.test.js（静态契约断言）

## 验收标准

- [ ] working 期间显示「思考中 · 已等待 Ns」，每秒递增；起点 = 该轮 in 消息 `created_at`（兜底 `chat.updated_at` → 首次观察）
- [ ] 计时刷新**不影响消息流**（MutationObserver 观测窗口内 #messages 变更数 = 0）
- [ ] 跨 30s 阈值追加慢模型提示且仅一条；完成/切会话/新建 chat 均停表（无残留 interval）
- [ ] 测试全绿（web.test.js 23/23；npm test 152/152）；diff 仅 3 文件；零新依赖
- [ ] 浏览器实测（隔离拓扑）：计时递增 / 阈值提示 / 完成后停表 / 页面其他区域不闪烁（含截图）

## 参考资料

- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-pr008.md（本 PR 验收报告，含逐毫秒证据与截图）
- docs/iterations/0011-chat-context-protocol/architecture.md §16.5（补丁记录）/§2 V-13（242s 实测）/§18.1 NC-20

## depends_on

- pr-004-web-api-and-console.md（理由：修改对象是 pr-004 落地的 web 控制台前端（app.js/style.css）与 SSE 渲染路径；证据：`oamp/web/app.js` 的 status-line 渲染由 pr-004 引入）

## batch

5
