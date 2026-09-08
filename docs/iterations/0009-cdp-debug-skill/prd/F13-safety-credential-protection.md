# F13：Safety——登录态/凭据保护与不入库规则

## 功能 ID
F13

## 来源
`demand.md` N4（登录态/凭据不入库：独立 profile 目录与含 cookie/token 的证据默认不落 git、console/网络证据若需提交须先脱敏，写入 skill Safety 层）、W1（Safety Section 要求，存在性归 F02）、C-6（profile 不入 git）。

## 用户价值
登录态调试必然接触 cookie/token 等凭据——凭据泄漏属"不可逆后果"级风险。Safety 层把"凭据不入库"固化为可核对的规则：调试行为不污染 git、不泄漏凭据，这是本 skill 可被安全使用的前提。

## 验收标准
- [ ] SKILL.md Safety 章节（F02 已验 Section 存在性）包含以下条款：
  - 独立 profile 目录默认不落 git（置于 git 外或显式 ignore——C-6/N4）
  - 任何含 cookie/token/凭据的证据（截图/结构化数据）默认不落 git
  - console/网络证据若需提交，须先脱敏（N4）
- [ ] 条款将凭据保护标注为红线级（不可逆后果），在文档首尾 Safety 位置体现（与 F02 三明治设计一致）
- [ ] 运行后可观察验证：经本 skill 执行一轮登录态调试后，profile 目录与登录态证据**不在 git 跟踪范围内**（评审以 git status / ignore 规则核对——§4 判据可离线执行）
- [ ] 规则对 F05 profile 管理脚本、F09 登录态链路、F11 产物落盘均有覆盖声明（无条款悬空：profile 脚本遵守不入库、证据落盘遵守脱敏）

## 边界（不包含）
- 不包含 profile 目录与 ignore 规则的**确切路径设计**（`[架构待填]`，demand §3 项 5——产品约束=不入 git，路径与实现由阶段 3 定）
- 不包含 Safety Section 的存在性/约束词计数（由 F02 处理，避免重复条款）
- 不包含登录态链路行为本身（由 F09 处理）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D3/D6/D9）**：
> - **profile 路径与 ignore（D3）**：`$CDP_DEBUG_HOME/profiles/<name>`，默认 `$HOME/.local/share/cdp-debug-skill/profiles/main`（git 外 → 天然不入 agents 仓库跟踪；F13 可观察判定 = git status/ignore 核对，默认即满足）；env 可覆盖；默认 git 外故不新增仓库 .gitignore 条目（若覆盖到仓库内路径由用户自行 ignore，references/chromium-profile-guide.md 写明）。
> - **证据脱敏机制（D6/D9，不引入独立脚本）**：三层防线——①chrome-devtools-mcp 注册参数 `--redact-network-headers`（返回前脱敏感请求头，D5）；②登录态/含凭据证据默认落 `$CDP_DEBUG_HOME/runs/`（git 外）——含凭据证据根本不进 git 视野；③SKILL.md Safety 脱敏清单（确定性字段黑名单：cookie/authorization/set-cookie/token 类头字段、URL query token/session 参数、console 凭据），agent 在入库前复核并置 `result.json#sanitized=true`；`sanitized=false` 产物不允许进入 git 路径。语义判断（"可否入库"）留 SKILL 层（agent），scripts 不做（规范红线 #15）。
> - CRITICAL 凭据条款在 SKILL.md 首尾各现一次（F02 三明治；CRITICAL 配额 ①，见 F02 补全）。
