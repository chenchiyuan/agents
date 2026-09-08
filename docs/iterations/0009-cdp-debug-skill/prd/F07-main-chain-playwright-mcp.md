# F07：主链路——自动操作与断言优先 @playwright/mcp

## 功能 ID
F07

## 来源
`demand.md` W2 主链路（C-2 `user_confirmed`："优先使用：@playwright/mcp"，否决"复用 browse/$B 优先"推荐）；边界关联 N1/N2。

## 用户价值
页面自动操作与断言（导航/点击/填表/断言/截图）有**统一、优先的 MCP 工具面**（@playwright/mcp），主链路是三层闭环的第一步——把"自动跑页面任务"与"失败后深诊"接起来。

## 验收标准
- [ ] SKILL.md 明示：主链路（导航/点击/填表/断言/截图）**优先使用 @playwright/mcp**（C-2）；browse/$B 不承担主链路首选
- [ ] 当 @playwright/mcp 已由用户按 F04 文档注册就绪时，按 skill 流程对任一真实页面执行一轮主链路任务（含导航 + 点击/填表 + 断言 + 截图），能完成自动操作并产出断言结论（通过/失败）与截图——产物进入 F11 闭环
- [ ] 主链路自动操作全程无需人工介入页面操作（与 §4 裸判定第 3 条一致）
- [ ] 主链路断言失败/页面异常时，SKILL.md 流程指引转诊断链路（F08）在同一浏览器上下文内深诊

## 边界（不包含）
- 不重造浏览器驱动（N1）——经 @playwright/mcp 编排既有能力
- 不写 playwright test 文件/测试套件、不做测试框架与 CI 集成（N2）
- 不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责（N1；分工见 F12）
- 不承担 console/网络与性能/内存级深诊（由 F08 处理）
- 不处理 MCP 未配置时的降级（由 F10 处理）
- 不包含 browse/$B 作为首选路径（C-2 否决；browse/$B 在 F12 分工表中的定位是既有能力参照与边界对象，不承担本 skill 主链路）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D5 + 核实 E1/E3）**：
> - 版本：latest = **0.0.80**（2026-09-08 核实 npm registry，node≥18）；注册命令：`claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest`（最小）/ 共享实例形态追加 `--cdp-endpoint=http://127.0.0.1:9222`（Form A，见 F04 补全）。
> - **连接既有 CDP 实例支持度：核实支持**（`--cdp-endpoint`，官方 config schema 明示 connect to existing browser instance，Chromium family）→ 主链路与登录态链路共享实例无需重估；主链路工具首选 @playwright/mcp（C-2）不变。
> - 主链路能力边界再确认：经 @playwright/mcp 工具面编排导航/点击/填表/断言/截图（browser_* 工具），不写 playwright test 文件（N2），不重造驱动（N1）。
