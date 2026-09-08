# PR-002: cdp-debug-skill SKILL.md 策略主体与 references 领域知识层

## 上下文摘要

交付页面调试统一编排 skill 的策略主体与领域知识层：`roles/cdp-debug-skill/SKILL.md`（v3.1.0 结构：统一入口、三层链路选路、前置 Gate、产物协议、Safety）+ `references/` 5 文件（mcp-registration / chain-cheatsheet / chromium-profile-guide / division-of-labor / description-eval-samples）。承载 F01~F04、F06~F13 的文档/协议内容。SKILL.md 引用 references（Resources 索引）与 scripts（Workflow 步骤 0 运行 `check-deps.sh`、Resources 索引、速查/指南引用脚本 CLI），故依赖 pr-001 先行合并，避免悬空运行引用。全部为新增文件、无既有文件修改、不交付 `.mcp.json`；文件范围与 0008 并发迭代（`roles/workflow-pb/*`）零重叠。

## 涉及功能点

- F01
- F02
- F03
- F04
- F06
- F07
- F08
- F09
- F10
- F11
- F12
- F13

## 文件范围

- `roles/cdp-debug-skill/SKILL.md`（新建）
- `roles/cdp-debug-skill/references/mcp-registration.md`（新建）
- `roles/cdp-debug-skill/references/chain-cheatsheet.md`（新建）
- `roles/cdp-debug-skill/references/chromium-profile-guide.md`（新建）
- `roles/cdp-debug-skill/references/division-of-labor.md`（新建）
- `roles/cdp-debug-skill/references/description-eval-samples.md`（新建）

## 验收标准

- [ ] `roles/cdp-debug-skill/` 以 Skill 式三层形态存在（本 PR 交付 SKILL.md + references/；scripts/ 由 pr-001 提供，pr-001 合并后 F01 验收 1 整体成立）；SKILL.md frontmatter `name: cdp-debug-skill`；目录内无 `.mcp.json` 文件（F01 验收 1、4；D8）
- [ ] 文档明示使用范围仅限本仓库内（C-4），不声明 pb 生态横向能力、不引用 powerby 跨仓技能、不改动宿主全局（`~/.claude/skills`）与异仓（F01 验收 3、5；F03 验收 3）
- [ ] SKILL.md frontmatter 必选字段齐全：`name`（kebab-case）、`description`（做什么 + 何时用 + 否定边界三段齐备）、`role.identity`（L4 精度）、`relationship`、`character`、`compatibility`（macOS arm64、node ≥20.19、Claude Code、CfT Chromium）（F02 验收 2；内容大纲 frontmatter 行）
- [ ] SKILL.md 正文按规范 v3.1.0 Section 清单与 architecture.md「SKILL.md 内容大纲」落位（Purpose → Success criteria → Strategy → Tools and capability boundaries → Important facts and constraints → Workflow → Output format → Resources → Examples → Safety），含 **Safety** 与 **Success criteria** 两个规定 Section（F02 验收 3、4）
- [ ] 约束词分级合规：CRITICAL 全篇 ≤ 3 处/Skill、MUST/NEVER ≤ 2 处/Section；凭据红线条款在文档首尾 Safety 各现一次（三明治）（F02 验收 5、6；F13 验收 2）
- [ ] `description` 三段信息（做什么：CDP 页面调试统一编排、自动操作断言、失败深诊、登录态续调，产出结构化证据+截图+结论；何时用；否定边界：纯测试框架编写与 CI、压测/性能基准、视觉回归基线、pb-v1-brower 式评审/验证协议任务、普通浏览取数）齐备（F03 验收 1）
- [ ] `references/description-eval-samples.md` 含 should-trigger ≥5 与 should-not-trigger ≥5 混合样例（覆盖主链路/诊断/登录态/组合语境 + N1/N2 邻域否定样例），与 description 边界一致，可供 §4 裸判定 2 离线 eval 复用（F03 验收 2；D10）
- [ ] `references/mcp-registration.md` 含两 MCP（@playwright/mcp、chrome-devtools-mcp）用途与注册所需全部信息（Form A 推荐 + Form B、`claude mcp add` 命令、scope project、版本 0.0.80/1.8.0 与 `@latest` 策略、参数表含 `--memory-debugging`/`--redact-network-headers`/`--no-usage-statistics`、排障），用户照文档可完成手动注册；明示本 skill 不交付 `.mcp.json`、注册由用户手动完成、运行期不自动注册（F04 验收 1、2、3、6；D5）
- [ ] `references/chain-cheatsheet.md` 覆盖三层链路速查（主链路 @playwright/mcp 操作断言 / 诊断 chrome-devtools-mcp console·网络·性能·内存 / 登录态 scripts 启停），条目与 SKILL.md Workflow（F06~F09）表述一致（F04 验收 4）
- [ ] `references/chromium-profile-guide.md` 写清 `$CDP_DEBUG_HOME` 布局、profile 管理（profile.sh 命令）、端口配置、脱敏与隐私选项（`--redact-network-headers` 等），并写明"若经 `CDP_DEBUG_HOME` 覆盖到仓库内路径须用户自行在仓库 `.gitignore` 追加"（F05/F09/F13 文档面；D3/D5/D9）
- [ ] `references/division-of-labor.md` 含与 **pb-v1-brower / gstack browse / investigate** 的显式分工表（每既有能力一行：职责 + 本 skill 边界），不存在"同一能力两处实现"重复条款（浏览器驱动不重造、console/网络取证统一走 chrome-devtools-mcp 不重复实现、系统化根因流程不重复）；SKILL.md Tools and capability boundaries 含分工摘要 + 指向该文件（F12 验收 1~4；分工边界表内容）
- [ ] SKILL.md Workflow 定义显式选路判据：三类任务特征（自动操作与断言 / 测试失败排查 / 登录态续调）唯一对应链路（主链路 @playwright/mcp、诊断 chrome-devtools-mcp、登录态 CDP 独立 Chromium）；组合编排规则明确（登录态先就绪再主链路/诊断；主链路失败转诊断深诊，接力共享同一浏览器上下文）；明示各链路工具归属并指向 F07/F08/F09 对应章节，不重复实现链路能力（F06 验收 1~4；F07 验收 1、4；F08 验收 1、3；D1）
- [ ] SKILL.md 明示登录态链路：独立 Chromium（CfT，非本机 Google Chrome——C-6）、CDP `--remote-debugging-port=9222`（可换）+ 独立 profile（`$CDP_DEBUG_HOME/profiles/<name>`，默认 git 外）；"三层共享同一实例/上下文"（同一 CDP 端点 + 同一 user-data-dir）为登录态链路成立前提（Form A 不成立时不宣称登录态连续）；未登录/登录态失效时产出 blocked 类结论附原因（`login_required`），不产伪证据（F09 验收 1、2、5；D1/D3）
- [ ] SKILL.md Workflow 步骤 0 前置 Gate（F10 可执行路径）：读会话工具面 → 无参运行 `scripts/check-deps.sh` 解析 JSON facts → 分流——两 MCP + Chromium 就绪则正常选路（F06）；MCP 缺失/未加载 → blocked（`blocked_reason=mcp_unconfigured`）附缺失明细 + `next_step` 指向 `references/mcp-registration.md`；Chromium 缺失 → 指引 `chromium.sh ensure` + `cdp-browser.sh start` 自助执行后复检，仍未就绪 → blocked（`chromium_not_ready`）；需登录态/跨层接力但两 MCP 未按 Form A 带端点参数 → blocked（`shared_instance_not_configured`）；明示不承诺运行期自动注册 MCP（N3）（F10 验收 1~5；D7）
- [ ] 前置 Gate 描述与 pr-001 实际交付的脚本 CLI/JSON schema 一致（无参调用、JSON 输出、exit 语义），全文对 scripts 子命令的引用无悬空/失实（F10 验收 4——依赖 pr-001 已合并）
- [ ] SKILL.md Output format 内联产物协议契约（协议先行，F02 验收 6）：三类产物（结构化页面证据 `evidence.json` / 截图 `screenshot-*.png` / 三态结论 `result.json`）完整 schema 内联于 Output format 章节（不进独立 schemas/ 目录，D8 无 schemas/）；`result.json` 含 `status: passed|failed|blocked`、`blocked_reason` 枚举（mcp_unconfigured / chromium_not_ready / login_required / shared_instance_not_configured / target_error）、`next_step`、`sanitized`；`artifact_root` 为调用方注入参数、缺省拒绝执行并提示（F11 验收 1；D6）
- [ ] 文档明示产物结构与命名仅对齐 pb-v1 findings/verify 风格（格式参考，不构成对 powerby 跨仓技能的任何引用/依赖），与 pb-v1-brower 的 review/verify/iterate 报告协议不重合（无 round/severity/findings 评审语义）（F11 验收 3、4；D6）
- [ ] SKILL.md Safety 含凭据保护条款：独立 profile 默认不落 git；含 cookie/token/凭据证据默认不落 git；console/网络证据提交前须脱敏；三层防线声明（MCP `--redact-network-headers` / 产物默认落 `$CDP_DEBUG_HOME/runs/` git 外 / Safety 脱敏清单 + 入库复核置 `sanitized=true`）；`sanitized=false` 产物不允许进入 git 路径；对 F05 profile 脚本、F09 登录态链路、F11 产物落盘均有覆盖声明（F13 验收 1、3、4；D9）
- [ ] SKILL.md Resources 索引 references/ 5 文件与 scripts/ 4 脚本（文件清单与 D8 布局逐一对应），引用关系无悬空（F04/F05 资源索引面）

## 参考资料

- `docs/iterations/0009-cdp-debug-skill/architecture.md`：D1（共享实例连接机制与登录态承担工具归属）、D5（注册命令/Form A/B/scope/版本/参数表）、D6（产物协议 schema）、D7（前置 Gate 分流机制）、D8（目录布局明细）、D9（三层脱敏防线）、D10（description 样例集）、「SKILL.md 内容大纲」表、「分工边界表内容」、「安全与凭据」节、CRITICAL ≤3 配额分配
- `docs/iterations/0009-cdp-debug-skill/prd/F01-skill-delivery-form.md` ~ `F04`、`F06` ~ `F13` 各功能卡（F05 由 pr-001 承载，本 PR 仅涉及 chromium-profile-guide.md 的 F05 文档面）
- `docs/skill-design-protocol.md` v3.1.0（E9：七层 Section 顺序、约束词分级、三明治、scripts 边界）
- `tools/install-pb-agents.sh`（E8：`roles/cdp-debug-skill/` 无同名 `<role>.md` → 不随分发，F01 验收 2 实证依据）

## depends_on

- pr-001-scripts-deterministic-ops.md（理由：SKILL.md Workflow 步骤 0 前置 Gate **运行** `scripts/check-deps.sh` 并解析其 JSON facts（D4 调用契约、F10 验收 1①"调 F05 scripts"），Resources 索引 scripts/ 4 脚本，`references/chain-cheatsheet.md`（登录态启停速查条目）与 `references/chromium-profile-guide.md`（profile 管理命令）引用脚本 CLI（D4 表）——pr-001 未合并时本 PR 交付物含悬空运行引用，F10 验收 4"指引指向真实存在的文档/脚本，无悬空引用"无法成立；而 pr-001 单独完整可验且不依赖本 PR，故 scripts 层先行合并）

## batch

1
