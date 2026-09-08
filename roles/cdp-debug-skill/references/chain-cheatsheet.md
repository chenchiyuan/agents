# 三层链路速查（cdp-debug-skill）

执行期命令/工具速查。链路**选择决策**见 `SKILL.md` Workflow（步骤 0 前置 Gate + 步骤 1 选路）；MCP 注册见 `mcp-registration.md`；`$CDP_DEBUG_HOME` 布局与 profile/端口管理见 `chromium-profile-guide.md`。本文件 `scripts/` 均相对 `roles/cdp-debug-skill/` 目录；所有脚本子命令/参数与 `scripts/` 实际 usage 一致。

## 1. 主链路（@playwright/mcp）——自动操作与断言

归属 MCP：`playwright`（`browser_*` 工具面）。操作序列：导航 → 读页面快照 → 点击/填表 → 断言 → 截图。

- 常用工具（官方 README 常见命名；会话实际工具名以 SKILL.md 步骤 0 Gate 目检为准，工具面为 `browser_*` 命名空间级）：
  - 导航 `browser_navigate`；点击 `browser_click`；输入 `browser_type`；填表/选择 `browser_fill_form` / `browser_select_option`
  - 断言依据 `browser_snapshot`（页面结构化快照）；截图 `browser_take_screenshot`；等待 `browser_wait_for`
- 断言失败/页面异常 → **转诊断链路**（同实例），见第 2 节；产物截图命名 `screenshot-*.png`（断言失败 ≥1 / 终态归档 ≥1）。

## 2. 诊断链路（chrome-devtools-mcp）——console/网络 + 性能/内存

归属 MCP：`chrome-devtools`（官方 tool-reference 核实工具名）。取证顺序：console → 网络 → 按需性能/内存；结构化数据优先。

- **console**：`list_console_messages`（列全部）→ `get_console_message`（按 ID 取详情，含 source-map 栈）
- **网络**：`list_network_requests`（列请求）→ `get_network_request`（取请求详情/响应）
- **性能**：`performance_start_trace` →（复现页面操作）→ `performance_stop_trace` → `performance_analyze_insight`（可执行洞察）；大体积 trace 落独立文件（evidence `performance.trace_path` 引用）
- **内存**：`take_heapsnapshot`（落 `.heapsnapshot` 文件）+ 查询族（`get_heapsnapshot_summary` / `get_heapsnapshot_retaining_paths` / `query_heapsnapshot_objects` / `compare_heapsnapshots` 等）——**须注册带 `--memory-debugging` 才启用**
- **复现取证**：对某 page target 附着失败时，`navigate_page` 到同一 URL 复现状态再取证（同 profile 下登录态仍在）
- **隐私**：注册带 `--redact-network-headers`（返回前脱敏敏感请求头，与 Safety 三层防线①一致）

## 3. 登录态链路（scripts + CDP 直连独立 Chromium）——实例/profile 就绪与续调

默认值：端口 `9222`、profile `main`、`$CDP_DEBUG_HOME` 默认 `$HOME/.local/share/cdp-debug-skill`。

| 操作 | 命令 |
|---|---|
| 实例启停/事实 | `scripts/cdp-browser.sh start\|stop\|status\|restart [--port <n>] [--profile <name>]`；`status --json` 输出机器可读事实 |
| 实例事实字段 | `status --json` → `command/running/pid/port/profile_dir/endpoint` |
| CfT 下载/就绪 | `scripts/chromium.sh ensure\|install\|verify\|status\|path [-f\|--force]`（ensure 幂等：已装=known-good Stable 不动作；版本不一致输出 facts，需 `-f` 强制升级；`path` 输出可执行文件绝对路径单行） |
| profile 管理 | `scripts/profile.sh list\|create [name]\|path [name]\|wipe [name]`（默认 `main`；`path` 输出 user-data-dir 绝对路径；`wipe` 破坏性，需 `--confirm` 或交互确认） |
| env 覆盖 | `CDP_DEBUG_HOME` / `CDP_PORT` / `CDP_PROFILE`（CLI 参数优先于 env） |
| 依赖事实总检 | `scripts/check-deps.sh`（无参运行）→ JSON：`mcp.playwright`/`mcp.chrome_devtools` 的 `configured/scope/command/args/endpoint_arg` + `chromium` 的 `installed/version/path/running/port/profile_dir` + `errors`；exit 0 = 执行成功（与依赖是否齐备无关） |

**常用顺序**：`status` →（缺二进制）`chromium.sh ensure` → `start` → 执行主链路/诊断 →（结束）`status`/`stop`。需登录态任务先登录态就绪（profile create + start 同 profile + 登录交互走主链路工具面），未登录/失效产 blocked（`login_required`）。

退出码速记：三脚本均 0 = 操作完成/事实报告；`chromium.sh` 1 = 自身执行错误、2 = 用法错误；`cdp-browser.sh` 1 = start 未产生受管实例、2 = 用法错误；`profile.sh` 1 = wipe 未确认或路径异常、2 = 用法错误。
