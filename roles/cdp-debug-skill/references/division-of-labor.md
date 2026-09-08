# 与既有页面能力的分工边界表（cdp-debug-skill）

本表把 cdp-debug-skill 与宿主/异仓既有页面能力（gstack browse / pb-v1-brower / investigate）的边界一次说清（F12），供使用者在三者与本 skill 之间不迷路。

**定位声明**：点名上述三个既有能力是 F12 要求的**边界对象罗列**，不构成对所列任何技能（含 powerby 跨仓技能）的引用、依赖或加载语义——本 skill 无 `style.inherits`/`principles` 指向它们，运行时不加载、不调用它们；本 skill 不引用 powerby 跨仓技能、不声明 pb 生态横向能力、不做跨仓分发（C-4/N6）。

SKILL.md `Tools and capability boundaries` 节为本文摘要——摘要与详表同源：摘要不声称详表没有的能力边界，详表不遗漏摘要声称的边界。

## 分工表（每既有能力一行）

| 既有能力 | 职责（现状） | 与本 skill 的边界（不重复条款） |
|---|---|---|
| gstack browse / $B（宿主浏览器） | 宿主无头/有头浏览器 QA：导航/点击/填表/断言/截图 + console/网络（~100ms/命令）；被 pb-v1-brower 连接层复用 | 本 skill 主链路首选 @playwright/mcp（C-2），$B **不承担主链路首选**；console/网络取证统一编排走 chrome-devtools-mcp，不重复实现第二套取证面；$B 能力为既有参照——连接层与本 skill 实例（独立 CfT Chromium + 两 MCP CDP 附着）无共享关系 |
| pb-v1-brower（powerby 异仓） | 页面级 review/verify/iterate 评审协议；只观察不改码；findings.json + round-N 报告 | 本 skill 不替代其评审协议（N1）；本 skill 产物仅为调试闭环证据（三态结论），仅格式参考、不构成引用/依赖（C-4/N6）；本 skill 不进入 powerby 生态 |
| investigate（宿主） | 系统化四阶段根因调试（investigate→analyze→hypothesize→implement，无根因不修复） | 本 skill 诊断链路只做**页面级证据采集与失败表征**（console/网络/性能/内存），不替代系统化根因流程；investigate 类系统调试任务不进本 skill 触发面（F03 should-not-trigger） |

## 无重复条款核对（逐条）

- **浏览器驱动不重造（N1）**：自动操作与断言经 @playwright/mcp 编排既有能力；$B 不承担主链路首选；本 skill 与 $B 的连接层无共享关系。
- **console/网络取证不重复实现**：本 skill 诊断链路统一编排走 chrome-devtools-mcp；gstack browse 的 console/网络能力定位为既有参照，不另实现第二套取证面。
- **系统化根因流程不重复**：investigate 四阶段处理系统级根因；本 skill 诊断链路只交付页面级证据与失败表征（失败→深诊→修复→复验闭环中的"深诊取证"一环，不替代 investigate）。
- **评审协议不重复**：本 skill 产物无 round/severity/findings 评审语义（调试证据 + 三态结论，见 SKILL.md Output format），与 pb-v1-brower 的 review/verify/iterate 报告协议不重合。

## 边界声明（逐条可核对）

- **N1**：不重造浏览器驱动；不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责。
- **N2**：不做测试框架与 CI 集成、不写 playwright test 套件、不做视觉回归基线、不做压测/性能基准（宿主 benchmark/qa 职责）。
- **N5**：不改动宿主全局（`~/.claude/skills`）与异仓（含 powerby-skills）。
- **C-4/N6**：不引用 powerby 跨仓技能、不声明 pb 生态横向能力、不做跨仓分发。
- **与 F01~F11 卡内边界一致**：无卡内边界与本表矛盾（触发面见 SKILL.md description 否定边界与 `description-eval-samples.md`）。
