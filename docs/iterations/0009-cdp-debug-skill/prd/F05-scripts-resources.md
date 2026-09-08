# F05：scripts/ 资源（依赖检查 / CDP Chromium 启停 / profile 管理）

## 功能 ID
F05

## 来源
`demand.md` W1（scripts/ 交付"依赖检查、CDP 浏览器启停与 profile 管理——确定性操作下沉，符合协议检查项 #6/#15"）、澄清依据 §1.1 C-5/C-6（scripts 交付依赖检查/CDP 启停；独立 Chromium + 独立 profile）；关联 C-2/C-6/N3。

## 用户价值
CDP Chromium 下载启停、profile 管理、依赖检查等**确定性操作**以可执行脚本形式提供，用户与 skill 流程（F10 依赖检查、F09 登录态链路）可直接调用，杜绝在 SKILL.md 里做语义判断或手抄命令。

## 验收标准
- [ ] `scripts/` 目录存在，脚本可执行且可被用户独立调用（不依赖 SKILL.md 运行）
- [ ] 存在依赖检查脚本：可检查 @playwright/mcp 与 chrome-devtools-mcp 是否已配置/可用、独立 Chromium 是否就绪，输出**确定性**的就绪状态报告（不输出语义判断/结论）
- [ ] 存在 CDP Chromium 启停脚本：可启动/关闭独立 Chromium（CDP 调试端口可配置，默认 9222，端口冲突可换——C-6），启动参数含独立 user-data-dir（profile）
- [ ] 存在 profile 管理脚本：可创建/复用/清理独立 profile；profile 落点设计为**不入 git**（置于 git 外或显式 ignore——C-6/N4，与 F13 条款一致）
- [ ] 存在独立 Chromium 下载/就绪脚本：可获取独立 Chromium（非复用本机 Google Chrome——C-6）并报告就绪状态
- [ ] scripts 内不出现对页面证据/结论的语义判断（确定性操作边界，协议检查项 #15）

## 边界（不包含）
- 不包含运行期自动注册 MCP（N3——脚本只做检查，不做宿主配置写入）
- 不包含独立 Chromium 的下载机制与版本选择（`[架构待填]`，demand §3 项 4）
- 不包含 profile 目录与 ignore 规则的确切路径设计（`[架构待填]`，demand §3 项 5；产品约束=不入 git，路径由阶段 3 定）
- 不包含脚本具体 CLI 形态/语言选型（`[架构待填]`）
- 不包含语义判断与页面结论产出（F11 职责）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D2/D3/D4）**：
> - **Chromium 下载机制与版本（D2，L1 user_confirmed 2026-09-08：CfT Stable）**：渠道 = 官方 Chrome for Testing（CfT）`last-known-good-versions-with-downloads.json` → channels.Stable（2026-09-08 = 152.0.7977.82），平台 mac-arm64（免 Rosetta）；`scripts/chromium.sh ensure|install|verify|status|path` 幂等执行：已装版本 = known-good Stable → 就绪事实不动作；不一致输出 facts 由调用方决定 `-f` 升级；不自动升级。校验 = 官方 JSON + storage.googleapis.com HTTPS；下载后记录本地 sha256 至 `chromium/.manifest.json`（官方端点当前无 sha256 字段，E5）。zip 解包后 glob 动态解析 `*.app/Contents/MacOS/*`（不写死布局）。选 CfT 的理由：chrome-devtools-mcp 官方仅支持 Google Chrome 与 Chrome for Testing（E4），共享实例（D1）必须落在其官方支持面内。
> - **profile 目录与 ignore 规则（D3）**：根目录 `$CDP_DEBUG_HOME` 默认 `$HOME/.local/share/cdp-debug-skill`（git 外，天然不入 agents 仓库跟踪），env 可覆盖；profile = `profiles/<name>`（默认 main，即 Chromium `--user-data-dir`）；`scripts/profile.sh list|create|path|wipe`（wipe 需 --confirm，破坏性安全兜底）。默认 git 外 → 不新增仓库 .gitignore 条目（F01 文件边界）；若覆盖到仓库内路径由用户自行 ignore（references 文档写明）。
> - **scripts 接口形态与 F10 调用契约（D4）**：4 个可独立执行脚本（check-deps.sh / chromium.sh / cdp-browser.sh / profile.sh，bash 3.2 + python3，零新增依赖）。check-deps.sh 输出确定性 JSON facts（两 MCP configured/scope/command/args/endpoint_arg + Chromium installed/version/running/port/profile_dir），exit 0=执行成功（无论依赖是否齐），**只给事实不给结论**；SKILL.md Workflow 步骤 0 前置 Gate 调它，agent 解析 JSON 做语义分流（F10/D7）。
