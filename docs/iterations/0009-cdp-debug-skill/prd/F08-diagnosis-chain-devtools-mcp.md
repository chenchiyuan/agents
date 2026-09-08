# F08：诊断链路——console/网络与性能/内存级深诊（chrome-devtools-mcp）

## 功能 ID
F08

## 来源
`demand.md` W2 诊断链路（C-3 `user_confirmed`：必须含性能/内存级深诊，console/网络与性能/内存 profile 均走 chrome-devtools-mcp）；边界关联 N2。

## 用户价值
主链路测试失败/页面异常时，在同一闭环内经 chrome-devtools-mcp 深诊（console/网络 + 性能/内存级 profile）——console/网络虽是既有能力，**性能/内存级深诊是本 skill 相对既有生态的真正增量**，让"失败→查因"闭环成立。

## 验收标准
- [ ] SKILL.md 明示：诊断链路（console/网络 + 性能/内存级 profile）**经 chrome-devtools-mcp**（C-3）
- [ ] 当 chrome-devtools-mcp 已由用户按 F04 文档注册就绪时，按 skill 流程对异常/失败页面执行一轮诊断，能取得 console 证据与网络证据（结构化，数据优先——进入 F11 产物）
- [ ] 诊断链路含**性能/内存级深诊**能力声明与执行路径（C-3——不以"console/网络已有"为由省略）
- [ ] 诊断证据产出后进入 F11 闭环产物，供修复后复验（与主链路形成"失败→深诊→修复→复验"循环）

## 边界（不包含）
- 不做压测/性能基准（N2——宿主 benchmark 职责）
- 不做视觉回归基线（N2）
- 不写测试文件/测试套件（N2）
- console/网络证据虽已被宿主既有工具（gstack browse 等）覆盖，但本 skill 诊断链路统一编排走 chrome-devtools-mcp，不与既有工具做能力重复实现（与既有工具的分工见 F12）
- 不处理 MCP 未配置时的降级（由 F10 处理）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D5 + 核实 E2/E4）**：
> - 版本：latest = **1.8.0**（2026-09-08 核实 npm registry，node ^20.19||^22.12||>=23）；注册命令（推荐形态，Form A）：`claude mcp add chrome-devtools --scope project -- npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222 --memory-debugging --redact-network-headers --no-usage-statistics`。
> - **性能/内存取证工具形态（官方 tool-reference 核实）**：性能 = `performance_start_trace` → `performance_stop_trace` → `performance_analyze_insight`（trace 录制 + 可执行洞察）；内存 = `take_heapsnapshot` + 查询族（get_heapsnapshot_summary/retaining_paths/dominators 等，**须注册时带 `--memory-debugging` 才启用**，默认 false）；console = `list_console_messages`/`get_console_message`（source-map 栈）；网络 = `list_network_requests`/`get_network_request`。大体积 trace/heap 落独立文件（产物契约引用，F11 补全/D6）。
> - 与主链路共享浏览器上下文：`--browser-url=http://127.0.0.1:9222` 附着与 @playwright/mcp 同一 CfT 实例（D1/E4 手动连接官方指南）。
> - 官方仅支持 Google Chrome 与 Chrome for Testing（E4）→ 支撑 D2（CfT 渠道，L1 user_confirmed 2026-09-08）。
