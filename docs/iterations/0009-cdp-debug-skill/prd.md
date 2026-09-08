# 功能规格：CDP 页面调试统一编排 skill（roles/cdp-debug-skill/）

**迭代 ID**: 0009-cdp-debug-skill
**版本**: 0.1.0
**创建日期**: 2026-09-08
**状态**: 阶段 2 产物（待阶段 3 补全 `[架构待填]` 项）
**输入合同**: `demand.md`（定稿版，2026-09-08 user_confirmed 收敛完成）

---

## 功能列表索引

| 功能 ID | 功能点摘要 | 文件路径 |
|---------|-----------|----------|
| F01 | skill 交付形态与落点（`roles/cdp-debug-skill/` 三层结构；仓库内能力定义不随 install-pb-agents.sh 分发） | [prd/F01-skill-delivery-form.md](prd/F01-skill-delivery-form.md) |
| F02 | SKILL.md 结构与规范合规（v3.1.0 七层结构、frontmatter 必选字段、CRITICAL ≤ 3、Safety/Success criteria Section、三明治抗遗忘、协议先行） | [prd/F02-skillmd-structure-compliance.md](prd/F02-skillmd-structure-compliance.md) |
| F03 | description 触发与否定边界（should-trigger / should-not-trigger 混合样例离线判定） | [prd/F03-description-trigger-design.md](prd/F03-description-trigger-design.md) |
| F04 | references/ 资源（@playwright/mcp 与 chrome-devtools-mcp 配置说明 + 三层链路命令速查；C-5 手动注册载体） | [prd/F04-references-resources.md](prd/F04-references-resources.md) |
| F05 | scripts/ 资源（依赖检查 / 独立 Chromium 启停 / profile 管理——确定性操作下沉，不做语义判断） | [prd/F05-scripts-resources.md](prd/F05-scripts-resources.md) |
| F06 | 统一入口与三层链路选路编排（按任务特征选路、失败转诊断接力、登录态前置；共享实例为前提） | [prd/F06-unified-entry-and-routing.md](prd/F06-unified-entry-and-routing.md) |
| F07 | 主链路：自动操作与断言优先 @playwright/mcp（导航/点击/填表/断言/截图） | [prd/F07-main-chain-playwright-mcp.md](prd/F07-main-chain-playwright-mcp.md) |
| F08 | 诊断链路：console/网络 + 性能/内存级深诊（chrome-devtools-mcp） | [prd/F08-diagnosis-chain-devtools-mcp.md](prd/F08-diagnosis-chain-devtools-mcp.md) |
| F09 | 登录态链路：CDP 直连独立 Chromium（9222 + 独立 profile）+ 跨会话登录态连续（§4-4 裸判定） | [prd/F09-login-state-chain-cdp-chromium.md](prd/F09-login-state-chain-cdp-chromium.md) |
| F10 | 主链路 MCP 未配置时的可执行路径（依赖检查 + 注册指引 → 阻塞结论；机制 `[架构待填]`） | [prd/F10-mcp-unconfigured-path.md](prd/F10-mcp-unconfigured-path.md) |
| F11 | 闭环产物契约（结构化页面证据 + 截图 + 通过/失败/阻塞结论；格式对齐 pb-v1 findings/verify 仅参考不依赖） | [prd/F11-closure-artifacts-contract.md](prd/F11-closure-artifacts-contract.md) |
| F12 | 与既有能力的分工边界表（pb-v1-brower / gstack browse / investigate；无重复条款；N1/N2/N5/N6 边界声明） | [prd/F12-division-of-labor.md](prd/F12-division-of-labor.md) |
| F13 | Safety 与凭据保护（登录态/凭据不入库、profile 不入 git、证据提交前脱敏——红线条款与可观察行为） | [prd/F13-safety-credential-protection.md](prd/F13-safety-credential-protection.md) |

功能卡总数：**13**。

---

## 本次迭代边界说明

### 做什么
在 `roles/cdp-debug-skill/` 新增一个遵循 `docs/skill-design-protocol.md` v3.1.0 的页面调试统一编排 skill（Skill 式：SKILL.md 七层结构 + references/ + scripts/），以用户拍板的三层链路为策略骨架，建立"一次触发、按需选路、证据闭环"的页面调试能力：

- **主链路**（自动操作与断言：导航/点击/填表/断言/截图）优先使用 @playwright/mcp（C-2）
- **诊断链路**（console/网络 + 性能/内存级深诊）走 chrome-devtools-mcp（C-3）
- **登录态链路**：CDP 直连独立 Chromium（`--remote-debugging-port=9222` + 独立 profile，C-6），三层共享同一浏览器实例/上下文为前提
- **MCP 未配置可执行路径**：依赖检查 + 注册指引（两个 MCP 当前未配置；不交付 .mcp.json，C-5）
- **闭环产物契约**：结构化证据 + 截图 + 通过/失败/阻塞结论，供本仓库内下游消费（W3）
- 仓库内能力定义：不随 install-pb-agents.sh 分发、仅本仓库内使用（C-1/C-4）

### 不做什么
- 不重造浏览器驱动；不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责（N1）
- 不做测试框架与 CI 集成、不写 playwright test 套件、不做视觉回归基线、不做压测/性能基准（N2）
- 不承诺运行期自动注册 MCP；不交付 .mcp.json（N3/C-5）
- 登录态/凭据不入库；独立 profile 与含 cookie/token 的证据默认不落 git；证据提交前脱敏（N4）
- 不改动宿主全局与异仓（含 powerby-skills）；与 0008 并发迭代文件零重叠（N5）
- 不独占绑定本仓库单一迭代产物页面；不声明 pb 生态横向能力；不引用 powerby 跨仓技能（N6/C-4）

---

## 需求追溯（与 demand.md 一一对应）

| demand.md 条目 | 覆盖功能卡 |
|---|---|
| W1（skill 交付形态与规范遵循） | F01, F02, F03, F04, F05 |
| W2（三层链路策略骨架 + MCP 未配置路径） | F06, F07, F08, F09, F10 |
| W3（闭环产物契约） | F11 |
| N1（不重造驱动/不替代 pb-v1-brower 协议） | F07 边界, F11 边界, F12 |
| N2（不做测试框架/CI/视觉回归/压测） | F07 边界, F08 边界, F11 边界, F12 |
| N3（不自动注册/不交付 .mcp.json） | F04 边界, F05 边界, F10, F01 验收 |
| N4（登录态/凭据不入库） | F13（+ F05/F09 行为承接） |
| N5（不改动宿主全局与异仓） | F01 验收, F12, 本索引边界说明 |
| N6（不独占绑定/不声明横向能力/仅本仓库内） | F01 验收, F11 验收, F12 |
| §4 裸判定 1（目录结构与规范合规） | F01, F02 |
| §4 裸判定 2（description 触发命中） | F03 |
| §4 裸判定 3（一轮真实任务三类产物可查） | F11 |
| §4 裸判定 4（登录态两次调用连续性） | F09 |
| §4 裸判定 5（显式分工表无重复条款） | F12 |

无 demand.md 之外的新增功能点。

---

## 架构待填汇总（阶段 3 处理）

| # | 待填项 | 所在功能卡 |
|---|---|---|
| 1 | 三层共享同一浏览器实例/上下文的具体连接机制（含两 MCP 对"连接既有 CDP 实例"支持度核实、登录态层承担工具重估） | F06, F09（demand §3 项 1/§4.2） |
| 2 | 主链路 MCP 未配置时可执行路径的机制细节（检测手段、指引载体、流程介入点、与依赖检查脚本的调用契约） | F10（demand §3 项 2） |
| 3 | @playwright/mcp 与 chrome-devtools-mcp 的安装/注册确切命令与版本 | F04, F07, F08（demand §3 项 3） |
| 4 | 独立 Chromium 下载机制与版本 | F05（demand §3 项 4） |
| 5 | profile 目录与 ignore 规则的确切路径 | F05, F09, F13（demand §3 项 5） |
| — | 产物落盘位置/命名/schema（按 pb-v1 findings/verify 风格对齐） | F11 |
| — | 目录内文件布局明细 | F01, F02 |

---

## model_inferred 说明

无 `model_inferred` 标注——本批次功能卡的验收标准均直接锚定 demand.md 定稿条款（W1/W2/W3/N1~N6/§4/C-1~C-7，全部 user_confirmed），未做超出需求合同的产品逻辑推导。

---

## 阶段 3 补全记录（技术架构，2026-09-08）

本索引的「架构待填汇总」7 项（+ F11/F01/F02 两项无编号项）已在阶段 3 全部补全为具体技术路径，对应 `architecture.md`（同目录）决策 D1~D10，并在各功能卡「架构维度」节内以"阶段 3 补全"块标注：

| # | 待填项 | 补全决策（architecture.md） |
|---|---|---|
| 1 | 三层共享同一浏览器实例/上下文的具体连接机制 | D1（两 MCP 均核实支持连接既有 CDP 实例：@playwright/mcp `--cdp-endpoint`、chrome-devtools-mcp `--browser-url`；实例 = CfT Chromium 9222 + 独立 profile；登录态层承担工具收口 = 主链路/诊断链路 MCP 附着共享实例） |
| 2 | 主链路 MCP 未配置时可执行路径的机制细节 | D4 + D7（双层检测：会话工具面 + check-deps.sh JSON facts；指引载体 references/mcp-registration.md；介入点 = Workflow 步骤 0 前置 Gate；产出 blocked 三态结论） |
| 3 | 两 MCP 安装/注册确切命令与版本 | D5（版本 0.0.80 / 1.8.0 已核实；claude mcp add 命令与 Form A/B 形态；scope project 建议） |
| 4 | 独立 Chromium 下载机制与版本 | D2（官方 CfT Stable last-known-good，2026-09-08=152.0.7977.82，mac-arm64；chromium.sh 幂等 ensure + sha256 manifest）——**L1，user_confirmed 2026-09-08（CfT Stable）** |
| 5 | profile 目录与 ignore 规则确切路径 | D3（`$CDP_DEBUG_HOME` 默认 `$HOME/.local/share/cdp-debug-skill`，git 外；profiles/<name>；不改仓库 .gitignore） |
| — | 产物落盘位置/命名/schema | D6（artifact_root 调用方注入；session.md + evidence.json + screenshot-*.png + result.json 三态；pb-v1 风格仅格式参考） |
| — | 目录内文件布局明细 | D8（references/ 5 文件 + scripts/ 4 文件，逐文件职责可追溯） |

补充决策：D9（证据脱敏机制，三层防线，不引入独立脚本）；D10（description 触发样例集载体 references/description-eval-samples.md）。

L1 决策清单（2026-09-08 已 user_confirmed：CfT Stable）见 `architecture.md` §L1 决策清单（当前 1 项：D2 Chromium 下载渠道 = 官方 CfT Stable）。外部事实核实与未核实项（U1~U5）见 `architecture.md` §外部事实核实清单。

本补全未修改各卡产品维度（用户价值/验收标准/边界）与 demand.md。
