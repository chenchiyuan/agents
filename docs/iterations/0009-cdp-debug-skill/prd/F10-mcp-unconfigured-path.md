# F10：主链路 MCP 未配置时的可执行路径

## 功能 ID
F10

## 来源
`demand.md` W2 联动事实（@playwright/mcp 与 chrome-devtools-mcp 当前均未配置，agents 项目 mcpServers 为空）、澄清依据 §1.1 C-2/C-5 联动（"主链路 MCP 未配置时的可执行路径（依赖检查 + 注册指引）成为 skill 的必要机制，具体设计留给阶段 3"）、N3、需求结论 §3。

## 用户价值
两个 MCP 当前不存在、本迭代又不交付 .mcp.json——用户第一次触发本 skill 时若主链路 MCP 不可用，得到的是**可执行路径**（依赖检查结果 + 注册指引）与明确的"阻塞"结论，而不是静默失败、假成功或一句"去配 MCP"的空话（N3 不承诺自动注册，但必须给手动路径）。

## 验收标准
- [ ] SKILL.md Workflow 定义"主链路 MCP 未配置"状态下的可执行路径：①执行依赖检查（确定性操作，调 F05 scripts）→ ②给出检查结果（哪个 MCP 缺失/未配置、Chromium 是否就绪）→ ③给出指向 F04 references 配置说明的注册指引
- [ ] 该状态下任务产出**"阻塞"类结论**（F11 结论三态之一），附缺失原因与下一步指引——不产出通过/失败伪结论、不产出空证据
- [ ] SKILL.md 明示不承诺运行期自动注册 MCP（N3）——本路径是"检查 + 指引"，注册动作由用户按 references 文档手动完成
- [ ] 路径描述与 F04 配置说明、F05 依赖检查脚本的职责一致（指引指向真实存在的文档/脚本，无悬空引用）
- [ ] MCP 配置就绪后同一任务正常走 F07/F08 链路，两条路径在 SKILL.md 中均有明确定义（不互相遮蔽）

## 边界（不包含）
- 不包含运行期自动注册 MCP 的能力（N3——宿主进程级配置，skill 无法自助注册，做不到的事不写进效果）
- 不包含 .mcp.json 交付（N3/C-5）
- 不包含检测手段、指引呈现形式、流程介入点等机制细节（`[架构待填]`，demand §3 项 2——阶段 3 设计）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D4/D7）**：
> - **检测手段（双层）**：①会话级——agent 目检当前会话可用工具集（MCP 注册后需重启宿主会话才加载）；②配置级——`scripts/check-deps.sh` 确定性解析三处配置源（`~/.claude.json` 顶层 / `projects["<cwd>"]` / `<cwd>/.mcp.json`），输出 JSON facts（两 MCP configured/scope/command/args/endpoint_arg + Chromium installed/version/running/port）。配置在但工具不在会话 → 指引重启宿主会话。
> - **指引载体与呈现**：`references/mcp-registration.md`（Form A/B 完整注册命令、scope、版本、参数表、排障）；SKILL.md 只写指针与分流规则，不重复命令。
> - **流程介入点**：SKILL.md Workflow **步骤 0 前置 Gate**（任何任务先过）——读会话工具面 → 调 check-deps → 分流：就绪→正常选路（F06）；MCP 缺失/未加载 → blocked（`mcp_unconfigured`）+ 缺失明细 + next_step=references；Chromium 缺失 → 先 `chromium.sh ensure` + `cdp-browser.sh start`（skill 可自助的确定性操作）→ 复检，仍缺 → blocked（`chromium_not_ready`）；需登录态/跨层接力但两 MCP 未按 Form A 带端点参数 → blocked（`shared_instance_not_configured`）+ 指引改 Form A。
> - **与 check-deps 调用契约**：无参调用、JSON 输出、exit 0=执行成功（依赖是否齐不影响）、自身错误 exit≠0+error 字段；脚本**只给事实不给结论**，语义分流（哪个缺失→何种结论）在 SKILL.md/agent 层（D4，协议检查项 #15）。
> - 明示不承诺运行期自动注册 MCP（N3/C-5）：路径 = "检查 + 指引 + blocked 结论"，注册动作永远由用户按 references 手动完成。
