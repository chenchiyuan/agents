# F09：登录态链路——CDP 直连独立 Chromium 与跨会话连续性

## 功能 ID
F09

## 来源
`demand.md` W2 登录态链路（C-6 `user_confirmed`：独立 Chromium + `--remote-debugging-port=9222` + 独立 profile，profile 不入 git，端口冲突可换）、澄清依据 §4.2（三层共享同一浏览器实例/上下文为前提）、需求结论 §4 裸判定第 4 条（两次调用 cookie/会话连续性）。

## 用户价值
需要登录态的页面调试可以**保留登录态跨会话续调**：一次登录后，新会话再调用无需重新登录即可继续操作——这是既有宿主/生态能力没有覆盖的增量之一（本机 Chrome 复用被否决，C-6）。

## 验收标准
- [ ] SKILL.md 明示：登录态链路使用**独立 Chromium**（非本机 Google Chrome——C-6），CDP 直连 `--remote-debugging-port=9222`（端口冲突可换，C-6）+ **独立 profile**（C-6）
- [ ] SKILL.md 文档明确"三层共享同一浏览器实例/上下文（同一 CDP 端点/同一 user-data-dir profile）"是登录态链路成立的前提条件（§4.2——先登录态就绪，再在同一上下文执行主链路/诊断）
- [ ] §4 裸判定第 4 条：经本 skill 完成一次登录态调试（登录目标页面）后，**再次调用（新会话）无需重新登录即可继续操作**——以两次调用间 cookie/会话状态连续性判定
- [ ] 登录态调试所用的独立 profile 不进入 git 跟踪（C-6/N4 行为面；规则条款见 F13）
- [ ] 未登录/登录态失效时，SKILL.md 流程产出可判定的结论（阻塞类，附原因）而非伪证据

## 边界（不包含）
- 不包含复用本机 Google Chrome 的路径（C-6 已否决）
- 不包含 profile 目录/ignore 规则确切路径设计（`[架构待填]`，demand §3 项 5）
- 不包含"三层共享同一实例"的具体连接技术方案（`[架构待填]`，demand §3 项 1）
- 不包含凭据/登录态的安全条款内容（由 F13 处理；本卡只验行为面"profile 不入 git"）
- 不包含登录态承担工具的最终锁定——若阶段 3 核实 @playwright/mcp 或 chrome-devtools-mcp 不支持连接既有 CDP 实例，登录态层承担工具在阶段 3 重估（demand §4.2 风险登记，本卡不锁死工具归属）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D1/D3/D5）**：
> - **共享实例连接机制**：登录态链路实例 = 独立 Chromium（CfT，D2）`scripts/cdp-browser.sh start`（`--remote-debugging-port=<port>` + `--user-data-dir=profiles/<name 默认 main>`）；@playwright/mcp（`--cdp-endpoint`，E3）与 chrome-devtools-mcp（`--browser-url`，E4）均**核实支持**附着该 CDP 端点 → 两层在登录态就绪后于同一实例内执行；连续 = 同进程 + 同 profile cookie/会话持久化（跨宿主会话的载体是 profile 目录，非 MCP 进程）。
> - **登录态层承担工具最终归属**（demand §4.2 预留重估的收口）：两 MCP 均支持连接既有实例 → 无需裸 CDP/browse $B 替代；登录交互走主链路 @playwright/mcp 工具面（Form A 下即共享实例），chrome-devtools-mcp 复核补充；SKILL.md 不锁死"必须用某工具登录"，策略表述"登录态就绪 = 实例 + profile 就绪"。
> - **profile 路径与 ignore**：`$CDP_DEBUG_HOME/profiles/<name>`，默认 `$HOME/.local/share/cdp-debug-skill/profiles/main`（git 外 → 不入 git，F13 可观察判定满足）；`scripts/profile.sh` 管理（wipe 需 --confirm）。
> - **端口冲突可换**：`cdp-browser.sh` 的 port 参数/env 可覆盖（默认 9222）；端口在 MCP 注册前定好，两 MCP 端点参数与浏览器端口必须一致（注册文档 Form A 强调）；check-deps 报告 configured endpoint vs running port facts，不一致时 agent 产出 blocked（target_error/shared_instance_not_configured）而非伪成功。
> - §4 裸判定 4 的机制支撑：两次调用共用同一 profile → cookie 持久 → 新会话 start 同 profile 后无需重登；`status`/evidence 不清理 profile。
