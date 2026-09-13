# 阶段 5 首波 · planner 任务图的报告级事项裁定（主 agent）

## 命名更正（主 agent 自身之误）

主 agent 的首波 planner 简报把输出路径写成 `prs/001-tasks.md` / `prs/003-tasks.md`（**参数拼接之误**），而规范形态是 `prs/pr-{NNN}-tasks.md`。已就地更正为 `prs/pr-001-tasks.md` / `prs/pr-003-tasks.md` 并由主 agent 提交入各自 PR 分支（内容零改动）。**此为主 agent 的执行缺陷，登记在案**，后续简报一律用规范文件名。

## pr-001 planner 的两项提请

| # | 提请 | 主 agent 裁定 |
|---|---|---|
| 1 | daemon 轮次的双层超时（`agent.js:322` 的 `setTimeout` → `acp-client.js:268-279` 的 `_request` 超时）由 T4 单点冻结即覆盖；建议 pr-002 拆解时复核「若在 `agent.js` 侧另引入 task 级计时/取消是否与冻结语义冲突」 | **采纳该检查项**：写入 pr-002 的 dev 简报作为必查项（pr-001 不越界改 `agent.js`，判断正确） |
| 2 | D3（daemon 真实 argv 判据）需要探针改造（可注入 argv）并入库，而 `clarifications/probe-always-ask.mjs` **不在本 PR 文件范围** ⇒ 请裁决是否扩范围 | **不扩范围**：探针改造不属产品交付面；pr-001 的 dev 允许在**仓库外临时脚本**中完成 argv 判据（沿用此前做法），探针入库文件保持只读 |

## pr-003 planner 的三项提请

| # | 提请 | 主 agent 裁定 |
|---|---|---|
| 1 | 新帧的 web 侧内核「抽取」若做会破 §11.4（零改动清单），planner 选择「调用同一批原语」并把「既有 handler 行为零改动」写成验收判据，不替架构选边 | **采纳**（不抽内核；以「既有 handler 行为零改动」为可判定口径） |
| 2 | `oamp/web/debug.js` 的 `EVENT_TYPES` 白名单未含新帧 `confirmation` ⇒ 调试台不显示新帧；是否同步 | **不改**（维持最小边界与零重叠）：F07/F08 卡片不要求调试台呈现；登记为**偏差 + 下一迭代候选**（新增事件类型时同步其消费侧白名单，属后续收口项） |
| 3 | §11.1 B-5 复核：`api-pages.test.js` 确无 `/api/events` 事件集合断言 ⇒ 本迭代唯一键隔离否定断言在 `web.test.js`，已在 pr-003 范围 | **采纳**（B-5 疑问关闭，无文件范围缺口） |
| 4 | M4 明确**不由 pr-003 承载**（落在 pr-001），故 pr-003 无 M4 任务 | **采纳**（与 pr-001 的上下文摘要一致，无冲突） |
