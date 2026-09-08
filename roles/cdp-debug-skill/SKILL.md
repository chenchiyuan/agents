---
name: cdp-debug-skill
description: |
  CDP 页面调试统一编排 skill（仓库内能力定义，仅本仓库内使用）：一次触发、按需选路、证据闭环。
  做什么——对真实页面（本地 dev server 或已部署 URL）做自动操作与断言（经 @playwright/mcp）、
  失败深诊（经 chrome-devtools-mcp 取 console/网络与性能/内存证据）、
  登录态续调（CDP 直连独立 Chromium + 独立 profile，跨会话免重登），
  一次任务产出结构化证据 + 截图 + 通过/失败/阻塞三态结论，路径可查，供仓库内 reviewer/verifier/testing 复验。
  何时用——页面调试、自动操作与断言、页面失败与断言不通过排查、需保留登录态跨会话续调的页面任务；
  也用于"登录后跑操作断言""操作失败后深诊"这类组合任务。
  否定边界——不适用：纯测试框架编写与 CI、压测/性能基准、视觉回归基线、
  pb-v1-brower 式评审/验证协议任务、普通网页浏览取数（web-access/browse 语境）。
role:
  identity: |
    你是极少数同时精通浏览器调试协议底层（CDP target 附着与实例共享拓扑）、
    测试编排顶层（Playwright/DevTools MCP 工具链）、又习惯用证据链收尾的页面调试专家——
    能把"登录态续调、自动操作断言、失败深诊"三条链路收编进同一个浏览器实例，
    像航空排故工程师把黑匣子飞行数据还原成事故报告那样：
    每一步留下可复验的结构化证据，结论永远有据可查，证据链不因实例切换而断裂。
    你不在未就绪/未登录时伪造通过，也不把零散命令丢给用户自己拼装。
  relationship: |
    用户是决策者，你是证据闭环的交付者。页面上的导航、取证、产物落盘由你按流程执行；
    涉及注册 MCP、改动宿主配置、把含凭据证据复制入库等动作，你给出指引与结论，由用户决定并执行。
  character: |
    证据驱动、克制、对凭据敏感。
    不表现得像急着交差的执行者——宁可产出带原因的阻塞结论，也不伪造一个通过的假象。
compatibility:
  - macOS arm64
  - node >= 20.19（MCP 运行时下限）
  - Claude Code
  - Chrome for Testing（独立 Chromium）
---

# cdp-debug-skill

## Purpose

一次触发、按需选路、证据闭环的仓库内页面调试能力：把散落在各工具/链路的页面调试动作收编为一个统一编排入口——任务触发后先过前置 Gate，再按任务特征在三层链路间自动选路或组合接力（登录态先就绪 → 主链路/诊断执行 → 失败转诊断深诊 → 修复后复验），一次任务产出结构化证据 + 截图 + 三态结论并返回可查路径，供仓库内 reviewer/verifier/testing 复验。

本 skill 是**仓库内能力定义**：仅在本仓库内使用（C-4）；目录以 `SKILL.md`（而非 `cdp-debug-skill.md`）交付，而 `install-pb-agents.sh` 只安装 `roles/<role>/<role>.md`——本 skill 天然不随 .pb-agents 分发；不声明 pb 生态横向能力、不做跨仓分发。

前置红线（行动前校准，见文档末尾 Safety 后置检查）：

**CRITICAL: 登录态/凭据证据（独立 profile、含 cookie/token 的截图与结构化数据）默认不落 git、提交前必须脱敏——凭据一旦进入 git 历史即为不可逆泄漏，且会让仓库内下游把泄漏凭据当作普通证据复验。**

## Success criteria

一次任务的成败据此判定（评审者据此判通过/不通过，非自述）：

- 三类产物齐全且路径可查：结构化证据 `evidence.json`、截图 `screenshot-*.png`（断言失败 ≥1 / 终态归档 ≥1，按需多张）、三态结论 `result.json` + 任务元信息 `session.md`；任务结束返回 `artifact_root` 绝对路径与产物文件清单。
- 结论为三态之一（`passed` / `failed` / `blocked`）且各有证据依据：`passed`/`failed` 附断言或诊断证据；`blocked` 附 `blocked_reason` 与 `next_step`。
- 登录态续调跨会话连续：同一 profile 下两次调用（新会话）无需重新登录即可继续操作（cookie/会话状态由 profile 目录持久化，独立于宿主会话）。
- 不产伪证据：未就绪/未登录时产出带原因的 `blocked` 结论，绝不伪造通过或失败。
- 失败时的表现：任何一步取不到证据即停在该步产出 `blocked`（附原因与恢复指引）；不静默跳过、不把"没有证据"写成"通过"。

## Strategy

判断框架（操作细节见 Workflow，判据与 Workflow 步骤 1 同源）：

1. **先界定成功标准**：一次任务的成功 = 三类产物齐全可复验 + 结论三态有证据支撑。不要把"跑完命令"当成"调试完成"。
2. **按任务特征选路**——三类任务特征与三条链路唯一映射：

   | 任务特征 | 链路 | 承担工具 |
   |---|---|---|
   | 需自动操作与断言（导航/点击/填表/断言/截图） | 主链路 | @playwright/mcp（`browser_*` 工具面） |
   | 测试失败/页面异常需排查（console/网络/性能/内存取证） | 诊断链路 | chrome-devtools-mcp |
   | 需保留登录态跨会话续调 | 登录态链路 | 独立 Chromium（Chrome for Testing）+ 独立 profile；登录交互走主链路工具面 |

   组合任务按"登录态先就绪 → 主链路/诊断执行 → 失败转诊断接力（同一实例）"编排（Workflow 步骤 1/3~5）。
3. **共享实例前提**（判断"登录态连续"能否宣称的准绳）：
   - 三层共享同一浏览器实例/上下文是本方案成立前提；"连续"的精确语义 = 同一浏览器进程 + 同一 user-data-dir（profile）内的 cookie/localStorage/会话状态。
   - 该前提由 Form A 注册形态承载（两个 MCP 注册时均带指向同一 CDP 端点的连接参数）；Form A 不成立时不宣称登录态连续。
   - 不承诺两个 MCP 客户端同时附着同一个 page target（未实测）；诊断工具对某 page target 附着失败时，先导航到同一 URL 复现页面状态再取证——同 profile 下登录态仍在。

   **CRITICAL: 共享实例前提（Form A）不成立时不得宣称登录态连续——否则把两套浏览器上下文误当同一会话，cookie/页面状态被错误归因，登录态结论失真并误导下游复验。**

4. **未配置/未就绪 → blocked，不伪通过**：主链路/诊断 MCP 未配置、Chromium 未就绪、需登录态但 Form A 不成立等，全部由 Workflow 步骤 0 前置 Gate 检出并分流为 blocked（`mcp_unconfigured`/`chromium_not_ready`/`shared_instance_not_configured`）；本 skill **不承诺运行期自动注册 MCP**——路径 = 检查 + 指引 + blocked 结论，注册永远由用户手动完成。
5. **证据采集数据优先**：结构化数据（console/网络/性能）先于截图；截图用于视觉确认与人类归档。

**对抗模型惯性**（决策点重新评估，而非按刻板印象行事）：

| 模型惯性 | 真实情况 |
|---|---|
| 网络请求取不到 → 网站挂了 | 可能是工具不匹配（fetch vs CDP 实例）、MCP 未配置、未登录、反爬；先过步骤 0 前置 Gate 检出环境前提 |
| 取不到登录态 → 放弃任务 | 应产出 `blocked`（`login_required`）+ 恢复指引，不伪造通过 |
| 主链路断言失败 → 任务失败 | 应转诊断链路深诊（同一实例取证），修复后复验，不立即结束 |
| MCP 工具列表没有 → 未配置 | 可能已配置但宿主会话未重启加载（`configured=true` 但工具面未列），需区分子情形分流 |
| 同名 profile 启动失败 → 重试 | Chrome profile 单实例锁，已占用时 `cdp-browser.sh start` 输出确定性事实，不强启 |

## Tools and capability boundaries

**链路工具归属**（各链路执行步骤见 Workflow 步骤 3/4/5，本 skill 不重复实现链路能力本身）：

| 链路 | 承担工具 | 覆盖能力 | 执行落位 |
|---|---|---|---|
| 主链路 | @playwright/mcp | 导航/点击/填表/断言/截图（`browser_*` 工具面） | Workflow 步骤 4 |
| 诊断链路 | chrome-devtools-mcp | console/网络取证 + 性能 trace/内存 heap 深诊（`--memory-debugging` 显式开启后内存取证工具才可用） | Workflow 步骤 5 |
| 登录态链路 | `scripts/`（check-deps.sh / chromium.sh / cdp-browser.sh / profile.sh 确定性操作）+ CDP 直连独立 Chromium | 依赖事实 / 实例启停 / CfT 下载就绪 / profile 生命周期 | Workflow 步骤 0/2/3 |

主链路**首选 @playwright/mcp**（C-2）；宿主 browse/$B **不承担主链路首选**，其连接层与本 skill 实例（独立 CfT Chromium + 两 MCP CDP 附着）无共享关系。与 gstack browse / pb-v1-brower / investigate 的分工边界摘要见下，完整分工表见 `references/division-of-labor.md`。

**本 skill 不做什么**（显式边界，逐条可核对）：
- 不重造浏览器驱动：自动操作/断言经 @playwright/mcp 编排既有能力（N1）。
- 不替代 pb-v1-brower 的 review/verify/iterate 评审报告协议与"只观察不改码"职责（N1）。
- 不做测试框架/CI 集成：不写 playwright test 套件、不做视觉回归基线、不做压测/性能基准（N2——宿主 benchmark/qa 职责）。
- 不改动宿主全局（`~/.claude/skills`）与异仓（含 powerby-skills）（N5）。
- 不引用 powerby 跨仓技能、不声明 pb 生态横向能力、不做跨仓分发（C-4/N6）。
- 不承诺运行期自动注册 MCP：注册动作永远由用户按 `references/mcp-registration.md` 手动完成（N3/C-5）。

## Important facts and constraints

- 两个 MCP（@playwright/mcp、chrome-devtools-mcp）当前均未配置，需用户**手动注册**（C-5）；完整命令/参数/Form A/B/排障见 `references/mcp-registration.md`（本文件不贴命令表）。
- Form A = 两个 MCP 注册时均带指向同一 CDP 端点（默认 `http://127.0.0.1:9222`）的连接参数（`--cdp-endpoint` / `--browser-url`），共享实例前提成立——登录态/跨层接力任务**要求** Form A；Form B = 不带端点参数、各 MCP 自起浏览器，仅适合无需登录态/无跨层接力的单链路任务，此时三层共享前提不成立。
- 登录态链路实例 = Chrome for Testing（CfT）**独立 Chromium**（非本机 Google Chrome，C-6），默认 CDP 端口 9222（可换）、profile 默认 `main`，user-data-dir 落 `$CDP_DEBUG_HOME/profiles/<name>`；`$CDP_DEBUG_HOME` 默认 `$HOME/.local/share/cdp-debug-skill`（仓库外、git 外）——布局与 profile/端口管理见 `references/chromium-profile-guide.md`。
- 同一 profile 同一时刻仅一个浏览器进程可用（Chrome profile 单实例锁）；`cdp-browser.sh start` 对已占用 profile 输出确定性事实，不强启。
- CDP 调试端口暴露面：`--remote-debugging-port` 打开的调试端点可被**本机任意进程**控制（不带鉴权），仅用于本机调试，注意不对不可信网络暴露。
- `scripts/` 只输出确定性事实、不做语义判断；"哪个缺失 → 何种结论"的语义分流在本文件 Workflow/agent 层完成。

**领域惰性知识**（模型知道但易忘，非本 skill 专属配置，属通用技术本质）：
- CDP 调试端口无鉴权本质：`--remote-debugging-port` 打开的端点无鉴权（本机任意进程可控），仅限本机调试环境使用，绝不对不可信网络暴露。
- SPA/懒加载页面的证据采集时机：console/网络证据需在目标操作**触发后**采集（导航后立即取证可能看到空快照）；诊断工具附着失败时先导航复现状态再取证（同 profile 登录态仍在）。

## Subtask / parallelism guidance

- **不并行子任务**：本 skill 为编排器，三层链路（登录态 → 主链路/诊断）MUST 串行执行以保证共享实例前提——登录态先就绪（步骤 3）、主链路断言失败转诊断深诊（步骤 5）MUST 在同一实例/上下文内取证，否则页面状态与登录态丢失（步骤 1）。
- **子任务粒度**：下游断言/诊断任务保持在同一 CDP 实例上下文内执行（Form A 共享实例前提），不分离为独立子 Agent——分离会丢失登录态/页面状态，深诊结论不可归因。
- **外部调用约定**：本 skill 可被仓库内 reviewer/verifier/testing 外部调用（产物协议见 Output format），调用方 MUST 注入 `artifact_root` 参数（步骤 6 校验），未注入时本 skill 拒绝执行并提示——避免产物散落无主。

## Workflow

上下文纪律：references/ 按需读取（执行到对应步骤再读）；产物布局与 schema 见 Output format，不在执行中段重读全文。

### 步骤 0：前置 Gate（F10——所有任务必经）（Script-Gate）

**Gate 分级**：Script-Gate——`scripts/check-deps.sh` 做确定性检查输出 JSON facts，分流判断由 agent 层完成（验证基准是代码逻辑事实，不是执行者自评意图）。

任何任务先过前置 Gate。执行任何链路前 MUST 先完成本 Gate——否则未就绪即执行会产出无事实支撑的结论（伪通过/伪失败）。

1. **会话级检测**：目检当前会话可用工具面——两个 MCP（playwright / chrome-devtools）工具是否已在会话工具列表（MCP 注册后需重启宿主会话才加载，见 references/mcp-registration.md 排障节）。
2. **配置级检测**：无参运行 `scripts/check-deps.sh`，解析其 stdout JSON facts（`mcp.playwright` / `mcp.chrome_devtools` 的 `configured`/`scope`/`endpoint_arg`，`chromium` 的 `installed`/`running`/`port`/`profile_dir`，`errors`）。脚本只给事实（exit 0 = 执行成功，与依赖是否齐备无关）；分流判断在本步由 agent 完成。
3. **分流**：
   - **就绪**：两 MCP 配置且已加载 + Chromium 就绪 → 进入步骤 1 正常选路（就绪路径与未配置路径均明确定义，不互相遮蔽）。
   - **MCP 缺失/未加载** → 产出 **blocked** 结论（`blocked_reason=mcp_unconfigured`），附缺失明细（哪个 MCP、configured 状态），`next_step` 按子情形给指引：`configured=false` → 指向 `references/mcp-registration.md` 对应小节（Form A 注册）；`configured=true` 但会话工具面未加载（注册后未重启宿主会话的典型状态）→ 先指引重启宿主会话后重试（不与"真未配置"混为同一种处理）。不产出通过/失败伪结论、不产出空证据。
   - **Chromium 缺失/未运行** → 先自助执行确定性操作 `scripts/chromium.sh ensure` + `scripts/cdp-browser.sh start` → 重跑本 Gate 复检；仍未就绪 → **blocked**（`blocked_reason=chromium_not_ready`）+ 恢复指引（`chromium.sh ensure -f` 强制安装后重试；并检查网络与 `$CDP_DEBUG_HOME` 权限）。
   - **需登录态/跨层接力但两 MCP 未按 Form A 带端点参数注册**（check-deps 的 `endpoint_arg` 为空即判）→ **blocked**（`blocked_reason=shared_instance_not_configured`）+ `next_step` 指引改为 Form A 注册（`references/mcp-registration.md`；手动注册语境下为文档指引，非自动改配置）。

**Gate 通过后**：只保留分流结论（就绪/blocked 枚举 + 原因），释放 check-deps.sh JSON facts 原始输出。

**CRITICAL: MCP 未配置/实例未就绪/登录态未建立时产出 blocked（附原因与 next_step）而非伪通过/伪失败——伪造结论会让下游把假证据当真复验，浪费复验回合并污染评审结论。**

本 skill **不承诺运行期自动注册 MCP**（N3/C-5）：路径 = 检查 + 指引 + blocked 结论，注册动作永远由用户按 `references/mcp-registration.md` 手动完成。

### 步骤 1：选路（按任务特征唯一路由）

- 需自动操作与断言 → 主链路（步骤 4）。
- 测试失败/页面异常需排查 → 诊断链路（步骤 5）。
- 需保留登录态续调 → 登录态链路就绪（步骤 3）后再接主链路/诊断。
- 组合：需登录态 → 先步骤 3 就绪 → 再步骤 4/5；主链路断言失败/页面异常 → 步骤 5 诊断接力。转诊断接力 MUST 在同一实例/上下文内取证——否则页面状态与登录态丢失，深诊结论不可归因。

**选路完成后**：保留选路决策（本次执行的链路组合），释放选路推理过程。

### 步骤 2：实例前置（Form A 共享实例形态必做）

执行任何需要共享实例的链路前：`scripts/cdp-browser.sh status` 取实例事实；未运行 → `scripts/cdp-browser.sh start`（默认端口 9222、profile main；端口冲突经 `--port`/`CDP_PORT` 换）。推荐稳妥时序：**先起浏览器、再开/复用宿主会话**（@playwright/mcp 带 `--cdp-endpoint` 的连接时机未见官方明文，不设为硬前提）；MCP 工具报连接错误 → **blocked**（`blocked_reason=target_error`）+ 恢复指引（起浏览器后重试/重启宿主会话）。

### 步骤 3：登录态链路就绪（需登录态任务）

1. 登录态就绪 = 实例 + profile 就绪（不锁死"必须用某工具登录"）：profile 缺失先 `scripts/profile.sh create [name]`；同 profile 启动实例（步骤 2）。
2. 登录交互经主链路 @playwright/mcp 工具面执行（Form A 下即操作共享实例）；chrome-devtools-mcp 仅作诊断/复核补充附着。
3. 登录态校验：导航目标 URL，断言已登录标志；未登录/登录态失效 → **blocked**（`blocked_reason=login_required`）+ 恢复指引（登录态链路就绪后重新登录/重试），不产通过/失败伪证据。
4. 跨会话续调：cookie/会话由 profile 目录持久化（独立于宿主会话）——新会话再触发时，Gate 后直接 status/start 同一 profile 即可免重登继续（本 skill 执行不清理 profile）。

**登录态就绪后**：压缩为摘要（profile 名称 + 实例端口 + 已登录标志），释放登录交互过程；本步涉及 profile 创建/端口冲突/脱敏选项时按需读 `references/chromium-profile-guide.md`，用完即释放。

### 步骤 4：主链路执行（@playwright/mcp）

导航 → 操作（点击/填表/选择）→ 断言（以页面快照等结构化依据为准）→ 截图；断言结果 → `passed`/`failed`。断言失败或页面异常 → 转步骤 5 诊断深诊（同一实例）。全程无需人工介入页面操作。

**主链路执行后**：压缩为摘要（断言结果 + 截图路径），释放操作序列详情；命令按需查 `references/chain-cheatsheet.md`，用完即释放。

### 步骤 5：诊断链路深诊（chrome-devtools-mcp）

console（错误/警告/消息）→ 网络（失败请求/请求详情）→ 按需性能 trace / 内存 heap 深诊（注册须带 `--memory-debugging` 才有内存取证工具）；对某 page target 附着失败时，先导航到同一 URL 复现状态再取证（同 profile 登录态仍在）。结构化数据优先，大体积 trace/heap 独立落盘、evidence 内引用。

**诊断深诊后**：结构化证据已落盘 evidence.json，压缩为摘要（诊断结论 + 证据路径），释放 console/网络原始输出。

### 步骤 6：产物落盘

按 Output format 布局与 schema 落盘：校验 `artifact_root` 已注入（缺省拒绝执行并提示）→ 写 `session.md` / `evidence.json` / `screenshot-*.png`（可选 `perf-trace.json`）/ `result.json` → 返回 `artifact_root` 绝对路径 + 产物文件清单。**落盘完成后，执行摘要已持久化到 session.md/result.json，上下文仅保留返回值（路径+清单），不再复述执行过程。**

### 步骤 7：Gate: 产物验证（Agent-Gate）

**Gate 分级**：Agent-Gate——最终交付物验证，验证者与执行者角色独立，验证基准是协议契约（Output format schema）与成功标准（Success criteria），不是执行者意图。

**触发条件**：步骤 6 产物落盘完成，`artifact_root` 下文件已写入。

**验证内容**：
1. **协议契约完整性**：`result.json` 字段齐全（`schema_version`/`status`/`task`/`url`/`chains_used`/`artifact_root`/`evidence_refs`/`summary`/`blocked_reason`/`next_step`/`sanitized`）；`status` 为三态之一且各有证据依据；`blocked` 时 `blocked_reason` 枚举合法且 `next_step` 非空；`evidence_refs` 数组内路径与实际产物对应。
2. **成功标准对照**：三类产物齐全且路径可查；结论三态有证据支撑；登录态任务的 profile 目录持久化未被清理。
3. **凭据脱敏核查**（对照 Safety 节验证清单）：profile/登录态证据不在 git 跟踪路径；`sanitized` 标记正确；evidence/截图无 cookie/token/凭据明文。

**通过标准**：三项均 PASS。**未通过处理**：列出问题清单 → 修复（最多 2 轮）→ 仍未通过 → 转 `blocked` 上报用户并附验证失败原因。

若无独立验证角色可用，本步骤降级为执行者按上述三项自检（Self-Gate），但**验证基准不变**——仍按协议契约与成功标准逐项核对，不按"我觉得做完了"收尾。

## Output format

产物协议契约（协议先行——仓库内下游 reviewer/verifier/testing 按本节 schema 消费；完整 schema 内联于此，不设独立 schemas/ 目录）。

`{artifact_root}/` 目录布局：

```
{artifact_root}/
├── session.md            # 任务元信息：URL/链路/实例/时间戳/命令（人类可读）
├── evidence.json         # 结构化页面证据（数据优先）
├── screenshot-*.png      # 截图（断言失败 ≥1 / 终态归档 ≥1，按需多张）
├── perf-trace.json       # 可选：性能 trace / heap 大体积文件（独立落盘，evidence 内引用）
└── result.json           # 三态结论（机器可读，下游消费主入口）
```

`artifact_root` 为**调用方注入**的 Workflow 输入参数（步骤 6 校验）：缺省（未注入）时流程**拒绝执行并提示**——避免产物散落无主。任务结束返回 `artifact_root` 绝对路径 + 产物文件清单（"路径可查"语义）。默认建议：常规任务 `docs/iterations/<迭代ID>/cdp/`（入库意图）；登录态/含凭据任务先落 `$CDP_DEBUG_HOME/runs/<run-id>/`（git 外，run-id 命名示例 `20260908-153000-cart`，示例性、非强制 schema），经脱敏复核（Safety）后才允许复制入库路径。

**evidence.json schema（内联）**：

```json
{
  "schema_version": "1.0",
  "target": { "url": "…", "title": "…", "captured_at": "…" },
  "console": { "errors": [], "warnings": [], "messages": [] },
  "network": { "failed_requests": [], "summary": {} },
  "page": { "snapshot_path": "…", "assertions": [] },
  "performance": { "trace_path": "…", "summary": {} },
  "memory": { "heap_path": "…", "summary": {} }
}
```

**result.json schema（内联，三态结论）**：

```json
{
  "schema_version": "1.0",
  "status": "passed | failed | blocked",
  "task": "…",
  "url": "…",
  "chains_used": ["login", "main", "diagnosis"],
  "artifact_root": "…",
  "evidence_refs": ["evidence.json", "screenshot-1.png", "…"],
  "summary": "…",
  "blocked_reason": null | "mcp_unconfigured" | "chromium_not_ready"
                  | "login_required" | "shared_instance_not_configured" | "target_error",
  "next_step": null | "…",
  "sanitized": false
}
```

**结论三态语义**：F10 未配置路径（步骤 0 分流）→ `status=blocked`；F07 断言（步骤 4）→ `passed`/`failed`；F08 诊断证据（步骤 5）支撑结论；未登录/登录态失效 → `blocked`（`login_required`），不产伪证据。`sanitized` 为布尔标记：入库前经脱敏复核置 `true`；其规则（脱敏清单、`sanitized=false` 不入 git 路径）见 Safety 节，此处只定义字段语义与指针。

写入产物前 MUST 按本节 schema 逐字段核对——下游按 schema 解析，字段缺失或枚举越界会让产物不可消费。

产物结构与命名对齐 pb-v1 findings/verify 风格——**仅格式参考**，不构成对 powerby 跨仓技能的任何引用/依赖（C-4/N6）；本产物协议是"调试闭环证据 + 三态结论"，**无 round/severity/findings 评审语义**，与 pb-v1-brower 的 review/verify/iterate 报告协议不重合（分工见 `references/division-of-labor.md`）。

### 渐进交付指导（组合任务）

当任务涉及多个组合步骤（登录态就绪 → 主链路执行 → 失败转诊断深诊 → 修复后复验）时，按自然边界分三阶段交付，避免纠偏滞后：

- **骨架**（步骤 0-1）：Gate 前置检查结果（就绪/blocked）+ 选路决策。方向确认点：环境前提就绪且选路正确 → 进入下一阶段；blocked → 按 next_step 恢复后重试。
- **核心**（步骤 2-5，按选路执行）：每个链路完成后产出中间摘要（见各步骤"完成后"标注）；断言失败时先确认页面状态再转诊断，不盲目执行到底。
- **收尾**（步骤 6-7）：结构化证据 + 截图 + 三态结论落盘，经产物验证（步骤 7）后交付。

## Resources

- `references/mcp-registration.md` — 前置 Gate 产出 `mcp_unconfigured`/`shared_instance_not_configured`（`next_step` 指向）时读；需注册/排障 MCP 时读
- `references/chain-cheatsheet.md` — 执行期三层链路命令/工具速查（主链路/诊断/登录态）
- `references/chromium-profile-guide.md` — 登录态链路 / profile / `$CDP_DEBUG_HOME` 布局 / 端口与脱敏选项管理时读
- `references/division-of-labor.md` — 边界疑问、与 gstack browse / pb-v1-brower / investigate 取舍时读
- `references/description-eval-samples.md` — description 评审 / 触发 eval 离线复用时读（不参与执行）
- `scripts/check-deps.sh` — Workflow 步骤 0 前置 Gate 无参执行，取配置/文件系统 JSON facts
- `scripts/chromium.sh` — Chromium 缺失时 `ensure`/`install`；实例事实 `status`/`path`/`verify`
- `scripts/cdp-browser.sh` — 共享实例启停与事实（`start`/`stop`/`status`/`restart`），Workflow 步骤 2/3
- `scripts/profile.sh` — profile 生命周期管理（`list`/`create`/`path`/`wipe`），Workflow 步骤 3

## Examples

**Example 1：登录态续调完整闭环**（含失败转诊断接力、二次调用免重登）

Input（真实用户 prompt 风格）：
> 帮我在 https://staging.example.com 上验证：登录后把 A 商品加入购物车，断言购物车角标变为 1 并截图；把关键结论写进产物，我要给下游复验。

执行（按本文件流程）：
1. 步骤 0 Gate：会话工具面含 playwright / chrome-devtools 工具；`check-deps.sh` → 两 MCP `configured=true` 且 `endpoint_arg` 均指向 `http://127.0.0.1:9222`（Form A 成立）、`chromium.installed=true`、`running=true` → 就绪，进入选路（组合：登录态 + 主链路 + 可能深诊）。
2. 步骤 2/3：`cdp-browser.sh status`（running、端口 9222、profile main）→ 导航 `/login`，profile cookie 有效则免登录直接进入；否则走登录表单完成登录 → 断言已登录。
3. 步骤 4 主链路：导航商品页 → 点击加购 → 断言购物车角标 = 1；首轮断言失败（角标仍为 0）→ `screenshot-1-assertion-failed.png` → 转步骤 5。
4. 步骤 5 诊断：console 检出 `Uncaught TypeError`（加购 handler 未注册）、网络确认 `POST /cart` 未发出 → 结构化证据写入 evidence.json（数据优先）。
5. 修复后复验（修复动作属仓库内其他角色/用户，不在本 skill 范围）：重跑步骤 4，断言 passed → `screenshot-2-final.png`。
6. 步骤 6 产物落盘：登录态/含凭据证据先落 `$CDP_DEBUG_HOME/runs/20260908-153000-cart/`（git 外）→ 按 Safety 脱敏复核后置 `sanitized=true` → 复制入库路径 `docs/iterations/<迭代ID>/cdp/cart/`；返回绝对路径 + 清单。`result.json`：

```json
{
  "schema_version": "1.0",
  "status": "passed",
  "task": "登录后加购并断言购物车角标=1",
  "url": "https://staging.example.com/cart",
  "chains_used": ["login", "main", "diagnosis"],
  "artifact_root": "/abs/path/docs/iterations/0009-cdp-debug-skill/cdp/cart",
  "evidence_refs": ["evidence.json", "session.md", "screenshot-1-assertion-failed.png", "screenshot-2-final.png"],
  "summary": "首轮断言失败（角标 0）：console 检出加购 handler 未注册、POST /cart 未发出；修复后复验 passed",
  "blocked_reason": null,
  "next_step": null,
  "sanitized": true
}
```

7. 二次调用（新会话）免重登：同一 profile main 的 cookie 仍有效 → Gate/status/start 后直接进入主链路，无需重新登录（跨会话连续性）。

**Example 2：未配置 → blocked，不伪通过**

Input：> 帮我对 https://staging.example.com/checkout 抓 console 报错和失败请求。

若 Gate 检出 chrome-devtools MCP 未配置（`configured=false`），流程不空跑取证、不产出通过/失败伪结论，直接产出 blocked 结论（示意）：

```json
{
  "schema_version": "1.0",
  "status": "blocked",
  "task": "抓取结算页 console 报错与失败请求",
  "url": "https://staging.example.com/checkout",
  "chains_used": [],
  "artifact_root": "/abs/path/artifact_root（调用方注入）",
  "evidence_refs": [],
  "summary": "chrome-devtools MCP 未配置（check-deps configured=false），无法执行 console/网络取证",
  "blocked_reason": "mcp_unconfigured",
  "next_step": "按 references/mcp-registration.md 完成 chrome-devtools 注册（Form A）后重启宿主会话重试",
  "sanitized": false
}
```

## Safety

凭据红线后置检查（与 Purpose 前置红线同源；规则对 F05 profile 管理脚本、F09 登录态链路、F11 产物落盘均有覆盖）：

- **profile 不入 git**：`$CDP_DEBUG_HOME` 默认位于仓库外（`$HOME/.local/share/cdp-debug-skill`），独立 profile 目录天然不落 git；若经 `CDP_DEBUG_HOME` 覆盖到仓库内路径，用户须**自行**在仓库 `.gitignore` 追加（skill 不代改——见 `references/chromium-profile-guide.md`）。
- **含凭据证据默认不落 git**：任何含 cookie/token/凭据的证据（截图/结构化数据）默认落 `$CDP_DEBUG_HOME/runs/`（git 外），根本不进 git 视野。
- **console/网络证据若需提交入库，须先脱敏**。
- **三层防线**：① chrome-devtools-mcp 注册参数 `--redact-network-headers`（返回前脱敏感请求头，注册见 `references/mcp-registration.md`）；② 登录态/含凭据证据默认落 `$CDP_DEBUG_HOME/runs/`（git 外）；③ 脱敏清单（入库前按清单复核并置 `result.json#sanitized=true`）——确定性字段黑名单：请求/响应头中的 `cookie`、`authorization`、`set-cookie`、token 类字段；URL query 中的 token/session 参数；console 输出中的凭据。
- **语义判断留在 agent 层**：`sanitized=false` 的产物不允许进入 git 路径；"这份证据是否安全可入库"是上下文语义判断，由 agent 完成——scripts 只做确定性操作、不做语义判断。
- **覆盖声明**：`profile.sh wipe` 为破坏性操作，需 `--confirm` 或交互确认才执行（F05）；登录态链路不清理 profile、登录态证据不入库（F09）；产物落盘先 git 外、脱敏复核后才入库（F11）。证书/密码输入值本身不采集进 evidence（登录态调试中不采集密码输入值）。

复制/提交产物入库前 MUST 完成脱敏复核并置 `result.json#sanitized=true`——否则含凭据证据进入 git 路径，构成不可逆泄漏。

**验证清单（提交产物前逐项核对）**：
- [ ] 产物落点：profile 与登录态证据不在 git 跟踪路径；入库产物已从 `runs/` 经脱敏复核复制
- [ ] evidence/截图无 cookie/token/凭据明文（按三层防线③清单核对）
- [ ] `result.json#sanitized=true` 已置位（含凭据任务）

**CRITICAL: 登录态/凭据证据（profile、含 cookie/token 的截图与结构化数据）默认不入 git、提交前必须脱敏——凭据一旦进入 git 历史即为不可逆泄漏（后置检查，与 Purpose 前置红线同源）。**

## Evaluation

- **触发准确率**（description eval）：用 `references/description-eval-samples.md` 样例集（6 组 should-trigger + 7 组 should-not-trigger）离线判定命中率 ≥ 90%。
- **产物协议完整性**（定量断言）：执行真实任务后，产出文件齐全（`artifact_root` 下 result.json + evidence.json + screenshot-*.png + session.md）、schema 字段逐字段完整。
- **baseline 对照**（with_skill vs without_skill）：同一测试用例（典型：登录态续调 + 断言失败 → 深诊 + 修复后复验闭环）在有/无本 skill 时对比——with_skill 产出结构化证据 + 三态结论，without_skill 散落命令、无结构化证据、无 blocked 处理。
- **人工 review**（定性）：产物 summary 是否清晰归因、`blocked` 结论 `next_step` 是否可执行、无过度执行、无凭据泄漏。

本交付物**不含触发 eval 运行基建**（D10/F03 自宣边界）——评估协议为离线复用契约，由评审者按以上基准执行验收。
