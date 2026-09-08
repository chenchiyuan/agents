# MCP 注册说明（@playwright/mcp · chrome-devtools-mcp）

本文件是 cdp-debug-skill 的 **MCP 手动注册指南**（F04/C-5 载体）：用户照做即可完成两个 MCP 的注册。仅本仓库内使用、不引用 powerby 跨仓技能（C-4）。

**边界明示（N3/C-5）**：本 skill **不交付 `.mcp.json`**；注册动作由用户手动完成；skill 运行期**不自动注册** MCP——Workflow 步骤 0 前置 Gate 只做"检查 + 指引 + blocked 结论"，`next_step` 指向本文对应小节。

---

## 0. 注册前必读

- 两个 MCP 均建议以 **project scope** 注册：只对 agents 项目加载、**不产生仓库内 `.mcp.json` 文件**（C-5 由此天然满足）。
- 注册后**需重启宿主会话**，新工具才加载进会话工具面（工具在会话级可见性内，注册不热加载）——SKILL.md Workflow 步骤 0 会目检工具面确认。
- **端口在注册前定好**：默认 `9222`；若换端口，两个 MCP 的端点参数与 `scripts/cdp-browser.sh` 实际启动端口必须一致（Form A 一致性，见第 3 节）。

---

## 1. @playwright/mcp（主链路：自动操作与断言）

- **用途**：主链路——对真实页面做导航/点击/填表/断言/截图（`browser_*` 工具面），见 SKILL.md Workflow 步骤 4。
- **服务器标识**：`playwright`
- **启动命令**：`npx -y @playwright/mcp@latest`
- **关键配置项**：
  - `--cdp-endpoint <endpoint>`：连接既有 CDP 实例（Chromium family 浏览器场景；对应 env `PLAYWRIGHT_MCP_CDP_ENDPOINT`）——共享实例形态（Form A）用，指向 `http://127.0.0.1:9222`。
  - 不带端点参数时 @playwright/mcp 自起浏览器（Form B，见第 4 节）。
- **示例注册片段**（完整命令见第 3/4 节 Form A/B）。

## 2. chrome-devtools-mcp（诊断链路：console/网络 + 性能/内存深诊）

- **用途**：诊断链路——console/网络取证 + 性能 trace/内存 heap 深诊，见 SKILL.md Workflow 步骤 5。
- **服务器标识**：`chrome-devtools`
- **启动命令**：`npx -y chrome-devtools-mcp@latest`
- **关键配置项**：
  - `--browser-url <url>`（短参 `-u`）：连接正在运行、可调试的 Chrome/CfT 实例（如 `http://127.0.0.1:9222`）——共享实例形态（Form A）用。
  - `--memory-debugging`：默认 `false`——**内存取证工具（heap snapshot 族）须显式开启才启用**。
  - `--redact-network-headers`：默认 `false`——开启后返回前脱敏敏感请求头，与 SKILL.md Safety 三层防线①一致。
  - `--no-usage-statistics`：官方使用统计默认开启，隐私可选关闭。
  - `--no-performance-crux`（可选）：性能 trace 默认向 Google CrUX 取 field data，可关闭（不强推）。
- **示例注册片段**（完整命令见第 3/4 节 Form A/B）。

---

## 3. Form A（共享实例形态，推荐——登录态/跨层接力任务要求）

两个 MCP 均带指向同一 CDP 端点的连接参数，附着到同一浏览器实例：三层（主链路/诊断/登录态）操作同一个浏览器进程、同一个 user-data-dir，跨层接力与跨会话登录态才连续（SKILL.md Strategy"共享实例前提"）。**登录态/跨层接力任务要求 Form A。**

```bash
claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest --cdp-endpoint=http://127.0.0.1:9222
claude mcp add chrome-devtools --scope project -- npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222 --memory-debugging --redact-network-headers --no-usage-statistics
```

- 端口在注册前定好，两个 MCP 端点参数与 `cdp-browser.sh` 实际启动端口**必须一致**（默认 9222）。
- Form A 下推荐稳妥时序：先起浏览器（`scripts/cdp-browser.sh start`）、再开/复用宿主会话（SKILL.md Workflow 步骤 2）。

## 4. Form B（最小形态，单链路快速用）

不带端点参数，各 MCP 自起浏览器：

```bash
claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest
claude mcp add chrome-devtools --scope project -- npx -y chrome-devtools-mcp@latest
```

**适用限制**：仅适合"无需登录态、无跨层接力"的纯主链路/纯诊断单发任务（@playwright/mcp 自起浏览器，首次使用可能需要其自带 Chromium 可用）。此时**三层共享前提不成立**——不宣称登录态连续、不做跨层接力（与 SKILL.md 路由限制一致）。

---

## 5. scope 与 .mcp.json

- **建议 `--scope project`**：只对 agents 项目加载、不产生仓库内 `.mcp.json` 文件（C-5 由此满足）。
- **`--scope` 默认 `local`**：会创建项目根 `.mcp.json`——请避免使用或自行管理该文件（本 skill 不交付、不代管）。
- **精确落点（余量说明）**：`--scope project` 预计写入 `~/.claude.json` 的 `projects["<项目路径>"].mcpServers`；若注册后未按预期加载，以 `claude mcp list` 核实实际落点与 scope。
- **验证注册结果**：`claude mcp list`。

---

## 6. 版本与参数表

- **版本策略**：注册用 `@latest`（chrome-devtools-mcp 官方 note "latest ensures up-to-date"）；下列核实版本供排障对照。
- **核实版本（2026-09-08，npm registry）**：
  - `@playwright/mcp` **0.0.80**（engines `node >=18`）
  - `chrome-devtools-mcp` **1.8.0**（engines `node ^20.19.0 || ^22.12.0 || >=23`；本机 node v22.15.0 满足）

| 参数 | 归属 MCP | 默认 | 作用 |
|---|---|---|---|
| `--cdp-endpoint <endpoint>` | playwright | 无 | 连接既有 CDP 实例（共享实例形态 Form A） |
| `--browser-url <url>`（`-u`） | chrome-devtools | 无 | 连接正在运行、可调试的 Chrome/CfT 实例（Form A） |
| `--memory-debugging` | chrome-devtools | false | 开启内存取证工具（heap snapshot 族）；**内存取证须显式开启** |
| `--redact-network-headers` | chrome-devtools | false | 返回前脱敏敏感请求头（与 SKILL.md Safety 三层防线①一致） |
| `--no-usage-statistics` | chrome-devtools | 统计默认开 | 关闭官方使用统计（隐私可选） |
| `--no-performance-crux`（可选） | chrome-devtools | field data 默认取 | 关闭性能 trace 的 CrUX field data（不强推） |

---

## 7. 排障

- **注册后工具未出现在会话** → 重启宿主会话后重试（工具会话级可见性，注册不热加载）。
- **工具报连接错误** → 按序检查：① 浏览器是否已起（`scripts/cdp-browser.sh status`）；② 实际端口与注册端点参数是否一致（`--cdp-endpoint`/`--browser-url` 指向的端口 vs `cdp-browser.sh` 启动端口）；③ 会话是否重启。仍失败 → SKILL.md 流程产出 blocked（`blocked_reason=target_error`）+ 恢复指引（起浏览器后重试/重启宿主会话）。
- **check-deps 显示 configured=true 但会话工具面无 MCP 工具** → 配置在、工具未加载（注册后未重启宿主会话的典型状态）→ 重启宿主会话后重试（SKILL.md Workflow 步骤 0）。
- **`claude mcp add` 语法**：stdio 子命令及参数用 `--` 与选项分隔（如 `claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest ...`），照抄第 3/4 节命令即可。
