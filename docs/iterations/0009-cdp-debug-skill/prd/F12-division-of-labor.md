# F12：与既有页面能力的分工边界表

## 功能 ID
F12

## 来源
`demand.md` N1/N2/N5/N6（C-7 `user_confirmed` 全部接受）、澄清依据 §3.2/§3.3（既有能力现状）、需求结论 §4 裸判定第 5 条（"skill 文档内存在与 pb-v1-brower / gstack browse / investigate 的显式分工表，不存在'同一能力两处实现'的重复条款——文档评审判定"）。

## 用户价值
让使用者（与未来维护者）在 pb-v1-brower / gstack browse / investigate 与本 skill 之间**不迷路**：一张分工表说清"谁负责什么、本 skill 不重复什么"，杜绝同一能力两处实现——这是 skill 与既有生态共存的契约基础。

## 验收标准
- [ ] skill 文档内存在与 **pb-v1-brower / gstack browse / investigate** 的显式分工表：每个既有能力一行，说明其职责与本 skill 的边界关系（§4 裸判定第 5 条）
- [ ] 分工表不存在"同一能力两处实现"的重复条款——逐条核对：浏览器驱动不重造（N1）、console/网络取证不重复实现（本 skill 诊断统一编排走 chrome-devtools-mcp，gstack browse 的 console/网络能力在分工表中定位为既有参照）、系统化根因调试流程不重复（investigate 四阶段 vs 本 skill 深诊链路的边界）
- [ ] 文档含显式边界声明并逐条可核对：
  - 不重造浏览器驱动 / 不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责（N1）
  - 不做测试框架与 CI 集成、不写 playwright test 套件、不做视觉回归基线、不做压测/性能基准（N2——宿主 benchmark/qa 职责）
  - 不改动宿主全局（`~/.claude/skills`）与异仓（含 powerby-skills）（N5）
  - 不引用 powerby 跨仓技能、不声明 pb 生态横向能力、不做跨仓分发（C-4/N6）
- [ ] 分工表与 F01~F11 各卡边界一致（无卡内边界与分工表互相矛盾）

## 边界（不包含）
- 不包含对 pb-v1-brower / gstack browse / investigate 自身文档或能力的任何改动（N5）
- 不包含本 skill 各链路能力本身（F06~F10 处理）
- 不包含分工表之外的既有能力盘点（只列与本 skill 有边界关系的三个既有能力——§4 点名范围）

## 架构维度

> **阶段 3 补全（architecture.md §分工边界表内容）**：
> - 分工表落点：`references/division-of-labor.md`（SKILL.md Tools and capability boundaries 内摘要 + 指针）。
> - 三行关键边界（无重复条款）：①gstack browse/$B = 宿主 QA 既有参照，主链路首选 @playwright/mcp（C-2），$B 不承担主链路首选，console/网络取证统一编排走 chrome-devtools-mcp 不重复实现；②pb-v1-brower = powerby 异仓评审协议（review/verify/iterate、只观察不改码），本 skill 不替代（N1）、产物仅格式参考不引用（C-4/N6）；③investigate = 宿主系统化根因流程，本 skill 诊断链路只负责页面级证据采集与失败表征，不替代其四阶段流程（investigate 语境进 F03 should-not-trigger）。
> - 连接层不复用 $B：本 skill 实例 = 独立 CfT Chromium + 两 MCP CDP 附着（D1，核实 E3/E4），与 $B 连接层无共享关系——分工表按此表述，无"同一能力两处实现"条款。
