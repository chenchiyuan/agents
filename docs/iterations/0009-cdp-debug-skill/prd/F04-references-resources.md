# F04：references/ 资源（MCP 配置说明与命令速查）

## 功能 ID
F04

## 来源
`demand.md` W1（references/ 交付"命令速查、MCP/环境配置说明"）、澄清依据 §1.1 C-5（注册动作由用户按 references 文档自行完成）、N3；关联 C-2/C-3。

## 用户价值
两个 MCP（@playwright/mcp、chrome-devtools-mcp）当前均未配置、且本迭代不交付 .mcp.json——用户需要一份**照做即可完成手动注册**的配置说明（C-5），并在日常使用中有一份三层链路的命令速查，不依赖记忆。

## 验收标准
- [ ] `references/` 下存在 @playwright/mcp 的配置说明文档：包含其用途（主链路自动操作断言）、注册所需的全部信息（服务器标识/启动方式/配置项/示例配置片段），用户照文档可完成手动注册
- [ ] `references/` 下存在 chrome-devtools-mcp 的配置说明文档：包含其用途（诊断链路 console/网络 + 性能/内存深诊）、注册所需的全部信息，用户照文档可完成手动注册
- [ ] 配置说明文档明确告知：本 skill **不交付 .mcp.json**、注册动作由用户手动完成、skill 运行期不自动注册（N3/C-5）
- [ ] `references/` 下存在命令速查：覆盖三层链路（主链路操作断言 / 诊断 console·网络·性能·内存 / 登录态 CDP Chromium 启停）的速查条目，与 SKILL.md Workflow（F06~F09）表述一致
- [ ] references 文档明示仅本仓库内使用、不引用 powerby 跨仓技能（C-4）
- [ ] 若配置说明含"主链路 MCP 未配置时可执行路径"的注册指引内容，与 F10 的流程描述一致（指引指向本卡文档）

## 边界（不包含）
- 不包含两个 MCP 的**确切安装命令与版本号**（`[架构待填]`，demand §3 项 3——阶段 3 需核实 MCP 对"连接既有 CDP 实例"的支持度后定稿）
- 不包含 .mcp.json 文件交付（N3/C-5）
- 不包含脚本类确定性操作（由 F05 处理）
- 不包含运行期自动注册承诺（N3）
- 不包含 .mcp.json 写入宿主全局配置（N5）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D5 + 核实 E1~E4）**：
> - 版本（2026-09-08 核实 npm registry）：@playwright/mcp latest = **0.0.80**（node≥18）；chrome-devtools-mcp latest = **1.8.0**（node ^20.19||^22.12||>=23）。注册建议用 `@latest`，references 记录核实版本供排障。
> - 连接既有 CDP 实例支持度**核实通过**：@playwright/mcp `--cdp-endpoint <endpoint>`（官方 config schema："connect to an existing browser instance in case of Chromium family browsers"）；chrome-devtools-mcp `--browser-url`/`-u`（官方 advanced-usage 手动连接指南：`--remote-debugging-port=9222` + `--user-data-dir` 启动浏览器后以 `--browser-url=http://127.0.0.1:9222` 附着）。两 MCP 均无需降级为裸 CDP/browse $B。
> - 注册命令（Claude Code，落 references/mcp-registration.md）：Form A（共享实例，推荐）`claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest --cdp-endpoint=http://127.0.0.1:9222`；`claude mcp add chrome-devtools --scope project -- npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222 --memory-debugging --redact-network-headers --no-usage-statistics`（--memory-debugging 默认 false 必须显式开启才能用内存取证工具；--redact-network-headers 默认 false，开启与 F13 一致；usage statistics 默认开可关）。Form B（最小，不带端点参数，自起浏览器）亦在文档给出，并明示仅限无需登录态/跨层接力的单链路任务。
> - scope 建议 `project`（写 ~/.claude.json 项目条目，仅 agents 项目加载、不产生仓库 .mcp.json）；references 文档提示默认 local scope 会创建 .mcp.json、注册后需重启宿主会话加载工具（对应 F10）。
