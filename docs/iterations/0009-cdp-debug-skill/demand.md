# 需求合同：CDP 页面调试统一入口 skill（迭代 0009）

## 文档状态

**本版状态：定稿版（user_confirmed 收敛完成，2026-09-08，可进入阶段 2）。**

上一版为 demand 角色收敛后的"最佳草稿"：关键分叉以 `model_inferred` 标注并汇总于文末"待用户确认清单"。2026-09-08 主 agent 转交用户逐条确认，**7 项（C-1~C-7）全部确认完成**，确认结果已原样回填：澄清依据 §1.1 追加"用户逐条确认记录"（每项 `user_confirmed` 附用户原话要点）；受影响的需求结论章节（W1 落点、W2 工具选路、N 系列、§3 浏览器/MCP、§4 效果路径）已改写为与确认一致；文末"待用户确认清单"已转为"用户确认记录表"。两段均有内容，可作为阶段 2（功能规格）的输入。

---

## 澄清依据

### 1. 用户诉求、方案雏形与逐条确认记录（2026-09-08 全部 `user_confirmed`）

- 新增一个 skill，使其支持 CDP 页面调试能力；该 skill 必须遵循 skill 规范（用户明指 `docs/skill-design-protocol.md`）。
- 用户已给出具体方案雏形（三层链路，原文照录）：
  - **自动测试主链路** → `@playwright/mcp`（导航/点击/填表/断言/截图）
  - **测试失败需要排查**（诊断链路）→ `chrome-devtools-mcp`（console/网络/性能/内存）
  - **需要保留登录态调试** → CDP 直连 `--remote-debugging-port=9222` + 独立 profile
- 诉求目标：希望需要页面调试的部分都能使用此 skill 获取页面数据、响应、效果，建立**开发/验证/测试循环**。
- 并发前提（主 agent 记录）：与 0008-iteration-branch-workflow 并发启动，用户已确认文件范围不重叠（0008 只动 `roles/workflow-pb`；本迭代产物在 `docs/iterations/0009-*` 与技能落点目录，无交集）。

#### 1.1 用户逐条确认记录（2026-09-08，7 项均 `user_confirmed`，附用户原话要点）

- **C-1 落点（user_confirmed）**：用户否决 `.claude/skills/` 与 powerby 同步两选项，原话："应该在roles下面新建才对。这才符合规范"。追问形态后确认：`roles/cdp-debug-skill/` 下按 Skill 式交付（`SKILL.md` 七层结构 + `references/` + `scripts/`，严格遵循 `docs/skill-design-protocol.md` v3.1.0）。配套事实（已核实 `tools/install-pb-agents.sh`）：该脚本只安装 `roles/<role>/<role>.md`，不会安装此目录——该 skill 是**仓库内能力定义，不随 .pb-agents 分发**（与 C-4 仅本仓库内使用一致），此事实如实写入需求结论 W1/§3。
- **C-2 主链路（user_confirmed）**：用户原话："优先使用：@playwright/mcp"——否决 demand 草稿"复用 browse/$B 优先"的推荐。主链路（导航/点击/填表/断言/截图）优先使用 @playwright/mcp；由此产生"该 MCP 当前未配置（agents 项目 mcpServers 为空，见 §3.4）"与"C-5 不交付 .mcp.json（用户手动按文档注册）"的联动——skill 需要处理未配置时的可执行路径（如依赖检查 + 注册指引），机制细节标 `[架构待填]`。
- **C-3 诊断（user_confirmed）**：必须含性能/内存级深诊（chrome-devtools-mcp），保留。
- **C-4 范围（user_confirmed）**：仅本仓库内使用（否决 pb 生态横向能力推荐）；不引用 powerby 跨仓技能。
- **C-5 MCP 落地（user_confirmed）**：不交付 .mcp.json，注册动作由用户按 references 文档自行完成；skill 交付 references 配置说明 + scripts 依赖检查/CDP 启停。
- **C-6 浏览器（user_confirmed）**：下载独立 Chromium（否决复用本机 Google Chrome 的推荐），CDP `--remote-debugging-port=9222` + 独立 profile；profile 不入 git；端口冲突可换。
- **C-7 边界（user_confirmed）**：N1~N6 全部接受。

（以上确认对草稿的逐项改写映射见文末"用户确认记录表"。）

### 2. 技能规范硬约束（客观事实，非协商结论——我通读了 `docs/skill-design-protocol.md` v3.1.0 全文 1811 行）

规范版本 **v3.1.0**（制定 2026-03-30，最后更新 2026-04-09），适用于 powerby-skills 项目的 Skill 设计。本仓库 `docs/` 下为该规范副本，用户明确要求新 skill 遵循此规范。影响需求边界的关键约束：

| 约束类别 | 硬性要求 | 对本次需求的影响 |
|---|---|---|
| 核心定义 | Skill = 策略哲学 + 最小完备工具集 + 必要的事实说明（三大支柱） | 新 skill 不能写成操作手册式流程，必须按三支柱设计 |
| frontmatter | `name`（kebab-case）/`description`（做什么+何时用+否定边界）/`role.identity`（L4 精度）/`relationship`/`character`/`compatibility` 必需 | 交付物必须含符合规范元数据；触发描述需带"不适用场景" |
| 正文结构 | Purpose → Success criteria → Strategy → Tools and capability boundaries → Important facts and constraints → Workflow → Output format → Resources → Subtask guidance → Examples → Safety（pb-v1 变体另有核心哲学/输入输出协议/职责边界） | 交付物结构被锁定，本需求结论不逐条展开（阶段 2/3 细化） |
| 抗遗忘 | 三明治结构（红线首尾各现一次）、Gate 机制、CRITICAL ≤ 3 处/Skill、MUST/NEVER ≤ 2 处/Section | 约束词数量是验收项 |
| 文件分层 | SKILL.md（策略）/ references/（按需领域知识）/ scripts/（确定性操作下沉，**绝不做语义判断**）/ assets/ | CDP 启停、profile 管理、依赖检查等确定性操作应下沉 scripts/；命令速查、MCP 配置说明进 references/——这是协议检查项 #6/#15，不是可选项 |
| 协议先行 | 输出若被下游消费必须有协议契约 | 本 skill 产物需与既有协议风格兼容（范围按 C-4 限定本仓库内，见 W3） |
| 评估闭环 | with_skill vs baseline + 定量断言 + 人工 review；description 触发 eval | 交付需自带可评估性设计（效果见需求结论 §4） |
| 创建流程 | 标准工作流：Intent Discovery → 设计卡 → **skill-creator 创建** → 补资源 → 评估 → 优化 description → 打包 | 阶段 3/5 落地时遵循；本需求合同只需锁方向 |
| 参考范本 | web-access skill（CDP 浏览）与 `pb-v1-implementing` | 新 skill 的 CDP/浏览器属性与 web-access 同类，可借鉴其"站点经验累积""工具边界表"写法，但职责不同（web-access 是取数，本 skill 是页面调试闭环） |

### 3. 现状核查（客观事实——我独立核实，非协商结论）

**3.1 技能落点与仓库语境**
- 本仓库 `.claude/skills/` 已存在：`workflow-pb/`（含 memory.md + data/）、`create-role/`（含 memory.md + data/）、`pb-v1-ascii/`、`pb-v1-talk/`——前两者是仓库原生框架技能；后两者是从 powerby-skills 生态拷入的 pb-v1 家族技能，**当前均未提交 git**（`git status` 为 `??`）。
- agents 仓库历次迭代（0001~0008）产物全部是工作流/框架/角色文档类改进，**从未产出过页面级产品迭代**——本仓库近期没有真实"页面"可调试（按 C-4 仅本仓库内使用，真实页面场景待本仓库后续迭代产生页面产物后兑现）。
- `docs/iterations/0009-cdp-debug-skill/` 已由主 agent 初始化（status.md/history.md），阶段 1 派发中。

**3.2 powerby 生态（异仓，`/Users/chenchiyuan/projects/powerby-skills/skills/`，pb-v1 原子技能家族 30+）**
- **pb-v1-brower**（最相关）：页面级浏览器评审与验证能力中台。四模式（connect/review/verify/iterate）；"只观察和证明，不修改源码"；产物协议 `findings.json` + round-N 报告 + `session.md`；证据采集默认结构化数据（snapshot/console/network/js/css/is），截图仅视觉与人类归档；**连接层直接复用 gstack browse 的 `$B` 二进制**（headed 模式、profile lock 清理、Cloudflare 验证处理）。CRITICAL：没有浏览器证据不得给页面级 PASS。
- **pb-v1-debug**：证据驱动假设-证伪调试（前后端），其前端证据采集交给 pb-v1-brower，修复后调 pb-v1-verifier。
- 另有 pb-v1-testing（约束驱动测试验证）、pb-v1-verifier（反射式独立验证）、pb-v1-frontend/demo/preview（实现与预览）等。
- 结论：**pb-v1 生态的"浏览器能力中台"已存在且协议成熟**；本新 skill 按 C-4 不引用/不进入该异仓生态，仅以既有协议风格为产物格式参考，不另起炉灶重造能力。

**3.3 宿主全局生态（`~/.claude/skills`，gstack 家族）**
- `browse`/`gstack`：playwright 无头/有头浏览器 QA（~100ms/命令），命令覆盖导航/点击/填表/断言/截图 + console/network/snapshot/js/css/is；本地编译二进制位于 `~/.claude/skills/gstack/browse/dist/browse`（**已存在**），pb-v1-brower 的连接层正依赖它。
- `qa`/`qa-only`：系统化测试+修复（宿主 QA 场景）；`investigate`：四阶段根因调试（Iron Law: 无根因不修复，编辑前有 freeze 钩子）；另有 open-gstack-browser / connect-chrome / setup-browser-cookies / canary / devex-review 等。
- 结论：宿主生态已覆盖"自动操作/断言/console/网络 + 系统化 debug 流程"，**缺的是 chrome-devtools-mcp 级的深诊（性能/内存 profile）与 CDP 登录态保活方案，以及把它们收敛为"开发/验证/测试闭环"的统一策略入口**。C-2 用户拍板主链路优先 @playwright/mcp 后，browse/$B 不承担主链路首选，但仍是可参考的能力现状与分工边界对象（见 N1/N5/§4 分工表）。

**3.4 MCP 与浏览器依赖现状（关键事实）**
- `~/.claude.json` 中所有项目 `mcpServers` 均为空或仅 context7/pencil；**agents 项目 `mcpServers` 为空**——`@playwright/mcp` 与 `chrome-devtools-mcp` **当前在任何项目都未安装/未配置**。
- 全局 npm 无 playwright/devtools-mcp 包；npx 缓存存在（可现拉）；本机已装 **Google Chrome.app**（C-6 用户决定不复用，改下载独立 Chromium）。
- 推论（事实层）：用户方案雏形点名的两个 MCP 目前是"不存在的能力前提"，且 **MCP 服务器是宿主进程启动前注册的配置，SKILL.md 在运行期无法自我注册工具**——"是否/如何把两个 MCP 装进宿主"是必须摆到需求层决策的分叉。该分叉已于 C-5 拍板：不交付 .mcp.json，由用户按 references 文档手动注册；skill 侧以"依赖检查 + 注册指引"给出未配置时的可执行路径（机制细节 `[架构待填]`）。

### 4. 关键分叉点：诊断、提案与用户拍板结果（六维诊断产出 + 2026-09-08 用户逐条确认）

本节保留六维诊断的推理过程供追溯。草稿原标 `model_inferred` 的分叉结论已于 2026-09-08 经用户逐条拍板转为 `user_confirmed`（确认记录见 §1.1，改写映射见文末"用户确认记录表"），不再有任何待确认推断。

#### 4.1 逻辑闭环检查（第 2 维，why→what 反推差异比对——决策记录，`user_confirmed`，2026-09-08）

- 用户目标："页面调试的部分都能用此 skill 获取页面数据/响应/效果，建立开发/验证/测试循环"。用户给的 what：三层 MCP/CDP 链路。
- 差异比对（demand 原推理，保留供追溯）：三层链路里，主链路的导航/点击/填表/断言/截图与诊断链路的 console/网络，已被既有的 gstack browse（$B）与 pb-v1-brower 覆盖（见 §3.2/3.3）。真正未被覆盖的增量是：性能/内存级深诊（chrome-devtools-mcp）、登录态 CDP 直连方案、以及把散落能力收编为一个"按任务特征选路"的统一入口。若照字面从零实现"三套 MCP 主链"，会造成与既有能力重复建设，且引入两个当前未配置的 MCP 依赖。
- 据此 demand 草稿曾提出改写提案：主链路复用已装好的 browse/$B，增量补齐深诊与登录态。
- **用户拍板（C-2）**：否决该改写提案，主链路优先使用 @playwright/mcp。此决策现为 `user_confirmed` 决策记录并尊重之，推理一并保留：demand 原推荐复用的理由——避免重复建设（browse/$B 已装、被 pb-v1-brower 依赖，覆盖主链路能力）；用户仍选择 MCP 优先的理由——获得统一 MCP 工具面（@playwright/mcp 提供一致的主链路操作/断言工具，深诊同族 MCP 形成统一工具面），并接受其"当前未配置"的注册成本（与 C-5 手动注册联动）。
- why→what 复检：用户的 why（统一入口 + 闭环）能推出用户选的 what（MCP 优先主链路）——统一 MCP 工具面正是"统一入口"的一种实现，逻辑闭环成立，无目标/方案脱节。

#### 4.2 内部一致性检查（第 4 维，含 v0.3.0 扩展：方案雏形与边界一致性）

- 三层链路要成立，隐含前提是三层**操作同一个浏览器实例/上下文**——否则"先自动测试、失败后诊断、再保留登录态续调"在状态上断裂：@playwright/mcp 默认自起浏览器实例，chrome-devtools-mcp 默认独立 target，CDP 9222 是第三个入口，三者各起一个浏览器则登录态/DOM 状态无法连续。用户"独立 profile"的提法（`--user-data-dir` 共享）正是让状态跨层连续的机制，方向正确。
- 需求层锁定（由用户已确认的三层链路方案雏形 + C-2/C-6 共同锚定，2026-09-08）：**三层共享同一浏览器实例（同一 CDP 端点 / 同一 user-data-dir profile）是本方案成立的前提条件**；浏览器实例 = **独立 Chromium**（C-6，`--remote-debugging-port=9222` + 独立 profile，profile 不入 git），具体连接机制（playwright connectOverCDP / chrome-devtools-mcp `--browserUrl` 等）留给阶段 3 核实与设计。
- 一致性风险登记（不在需求层下结论，留给架构阶段）：@playwright/mcp 与 chrome-devtools-mcp 对"连接既有 CDP 实例"的支持度随版本而异，阶段 3 需核实；若某 MCP 不支持连接既有实例，则"登录态层"的承担工具需在阶段 3 重估（策略层不写死工具归属，但主链路仍以 @playwright/mcp 为首选——C-2）。

#### 4.3 边界完整性检查（第 3 维）

- 草稿"不做什么"无一条是用户明说——全部由我依据证据推导（见需求结论 §2），属薄弱点，已交用户逐条过目：**C-7 用户确认 N1~N6 全部接受（2026-09-08）**，转为 `user_confirmed`，其中 N5 措辞按确认强化为"不改动宿主全局与异仓（含 powerby-skills）"、N6 按 C-4 收敛为"仅本仓库内使用、不声明 pb 生态横向能力"。

#### 4.4 可验证性检查（第 5 维）

- 效果条款已在需求结论 §4 写成裸判定（不问作者可判真假的信号），无主观感受词。见该节。

#### 4.5 方案雏形询问（第 6 维）

- 用户对"怎么做"已有具体想法（三层工具 + 端口 + profile），本维已被用户主动满足大半；残留未问项集中在"主链路是否接受复用既有 browse 而非强制新增 @playwright/mcp""深诊是否必须到性能/内存级""浏览器实例用本机 Chrome 还是独立 Chromium"三处——已于 2026-09-08 经 C-2/C-3/C-6 全部确认，不留开放问题。

#### 4.6 参考视角（demand 提供的讨论用意见，**不进入需求结论**；C-2/C-5 已由用户拍板，本段仅作追溯）

- 工具归属建议（已被 C-2 用户决策取代）：主链路与诊断链路的"选路"应看任务特征而非固定层级——已有 browse/$B 能完成的（导航/点击/填表/断言/截图/console/网络）优先走零新增依赖路径；只有需要性能/内存 profile、或用户明确要 MCP 工具面时，才走 chrome-devtools-mcp。用户最终选择统一 MCP 工具面优先，此建议不作为结论。
- 宿主耦合提醒（已被 C-5 用户决策取代）：把两个 MCP 配置写进 agents 仓库 `.mcp.json` 会使所有在该仓库跑 Claude Code 的会话都加载这两个 MCP 服务器（启动成本/权限面变大）。用户最终选择"不交付 .mcp.json、由用户按 references 文档自行注册"，此提醒仅作追溯。

---

## 需求结论

### 1. 目标与价值（为什么做这件事）

页面调试能力当前散落在宿主 gstack browse、powerby pb-v1-brower、investigate 与两个未配置的 MCP 之间：没有一个"按任务特征选路"的统一入口；console/网络已有、**性能/内存级深诊缺失**；**登录态保留的跨会话调试无方案**；页面自动操作与证据采集之间没有形成用户要的"开发/验证/测试"闭环。本迭代在 **`roles/cdp-debug-skill/`** 新增一个遵循 skill-design-protocol v3.1.0 的统一编排 skill（**仓库内能力定义，不随 .pb-agents 分发**，见 W1），把用户三层链路（`user_confirmed` 方案雏形 + C-2/C-3/C-6 拍板）收敛为"一次触发、按需选路、证据闭环"的页面调试能力，**供本仓库内需要页面调试的场景复用（C-4）**。

### 2. 做什么 / 不做什么

#### 做什么

**W1. 新增一个支持 CDP 的页面调试统一编排 skill**——交付形态与落点（C-1 `user_confirmed`）：在 `roles/cdp-debug-skill/` 下按 Skill 式交付——`SKILL.md`（v3.1.0 七层结构）+ `references/`（命令速查、MCP/环境配置说明）+ `scripts/`（依赖检查、CDP 浏览器启停与 profile 管理——确定性操作下沉，符合协议检查项 #6/#15）。
- 去掉它：本次迭代无交付物，最小闭环不成立。
- 遵循规范 v3.1.0 七层结构、frontmatter 必选字段、约束词分级（CRITICAL ≤3）、三明治/抗遗忘设计、协议先行。
- 落点事实（如实写明）：用户否决 `.claude/skills/` 与 powerby 同步两选项，原话"应该在roles下面新建才对。这才符合规范"；**`tools/install-pb-agents.sh` 只安装 `roles/<role>/<role>.md`，不会安装此目录**（已核实脚本实现：仅 copy 角色定义文件与 principles/，data/、memory.md 及其余文件均不随框架分发）——该 skill 是**仓库内能力定义，不随 .pb-agents 分发**，与 C-4"仅本仓库内使用"一致。

**W2. 以用户三层链路为策略骨架，工具归属按用户拍板定稿（`user_confirmed` 决策记录，2026-09-08）**：
- 主链路（自动操作与断言：导航/点击/填表/断言/截图）：**优先使用 @playwright/mcp**（C-2 用户决策，原话"优先使用：@playwright/mcp"，否决草稿"复用 browse/$B 优先"推荐）；browse/$B 不承担主链路首选。
- 诊断链路：基础 console/网络与增强性能/内存级 profile **均走 chrome-devtools-mcp**（C-3：必须含性能/内存级深诊，保留）。
- 登录态链路：CDP 直连**独立 Chromium**（`--remote-debugging-port=9222` + 独立 profile，C-6）；三层共享同一浏览器实例/上下文为前提（见澄清依据 §4.2）。
- 联动事实与未配置路径：@playwright/mcp 与 chrome-devtools-mcp **当前均未配置**（agents 项目 mcpServers 为空，§3.4），且本迭代**不交付 .mcp.json**（C-5，用户手动按 references 文档注册）——skill 需处理"主链路 MCP 未配置时的可执行路径"（依赖检查 + 注册指引），机制细节 `[架构待填]`（阶段 3）。
- 去掉任一链路段：三层闭环断裂（测试失败无处深诊 / 登录态场景无法续调），最小闭环不成立。

**W3. 建立开发/验证/测试闭环的产物契约**：调用即产出"结构化页面证据（数据优先）+ 截图（视觉/归档）+ 通过/失败/阻塞结论"三类产物；产物结构与结论风格**对齐既有 pb-v1 生态约定（findings/verify 风格——仅格式参考，不构成对 powerby 跨仓技能的任何引用/依赖，C-4）**，使本仓库内下游 reviewer/verifier/testing 或宿主 QA 可直接消费。
- 去掉它：skill 退化为零散命令集，无法支撑"页面调试部分统一走此 skill 并形成循环"的诉求，最小闭环不成立。

#### 不做什么

**N1. 不重造浏览器驱动/不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责**——已存在且协议成熟，本 skill 编排/复用而非另起炉灶（C-2 定稿后，主链路经 @playwright/mcp 编排，仍不重造驱动）。理由：§3.2 证据；重复建设直接违反"借鉴现有，而后创造"。
**N2. 不做测试框架与 CI 集成**：不写 playwright test 文件/测试套件、不做视觉回归基线、不做压测/性能基准（宿主 benchmark/qa 的职责）。理由：用户诉求是"调试中获取数据/响应/效果"，不是测试基建。
**N3. 不承诺在 skill 运行期自动注册 MCP 服务器，且本迭代不交付 .mcp.json**（C-5 `user_confirmed`）：MCP 是宿主进程级配置，skill 无法自助注册；skill 只交付 references（MCP 配置说明）与 scripts（依赖检查/CDP 启停），宿主侧注册动作由用户按 references 文档自行完成；主链路 MCP 未配置时的可执行路径（依赖检查 + 注册指引）见 W2 的 `[架构待填]` 项。理由：事实约束（§3.4）+ C-5 用户决策，做不到的事不写进效果。
**N4. 登录态/凭据不入库**：独立 profile 目录与任何含 cookie/token 的证据默认不落 git（置于 git 外或显式 ignore，与 C-6"profile 不入 git"一致），console/网络证据若需提交须先脱敏。理由：安全红线，属"不可逆后果"级，写入 skill Safety 层。
**N5. 不改动宿主全局与异仓（含 powerby-skills）**：不改动 `~/.claude/skills` 任何既有技能、不改 powerby-skills 仓内 pb-v1 技能；与 0008 并发迭代文件零重叠。理由：本次迭代边界 = 本仓库新增产物（C-7 `user_confirmed`，措辞按确认强化）。
**N6. 不做"本仓库某单一迭代产物页面调试"的独占绑定，且不声明为 pb 生态横向能力（C-4/C-7 `user_confirmed`）**：skill 按通用页面调试编排设计（不绑定某一迭代产物，效果验证可任取本地 dev server 或已部署 URL 页面，见 §4）；使用范围按 C-4 限定**仅本仓库内**——不声明 pb 生态横向能力、不引用 powerby 跨仓技能、不做跨仓分发（与 C-1 落点不随 .pb-agents 分发一致），否决草稿"跨仓可用的横向能力"倾向。理由：用户拍板；agents 仓库近期无页面产物（§3.1），真实页面使用场景待本仓库后续迭代产生页面后兑现。

（N1~N6 原为 AI 推导边界，2026-09-08 经用户逐条过目全部接受——C-7 `user_confirmed`。）

### 3. 大概怎么做（仅锁定方向性事实与机制轮廓，不锁定架构细节）

- 交付物：新增 skill 目录 `roles/cdp-debug-skill/`（`SKILL.md` + `references/` + `scripts/`），遵循 v3.1.0 规范结构与 pb-v1 变体（核心哲学/输入输出协议/职责边界/Skill 交互图）；**仓库内能力定义，不随 .pb-agents 分发**（install-pb-agents.sh 只 copy `roles/<role>/<role>.md`）。
- 策略骨架：用户三层链路（`user_confirmed` 方案雏形 + 2026-09-08 拍板）——主链路自动操作断言**优先 @playwright/mcp**（C-2）→ 失败诊断走 **chrome-devtools-mcp**（console/网络与性能/内存级，C-3）→ 登录态 CDP 直连**独立 Chromium**（C-6）。
- 浏览器与登录态：下载独立 Chromium（非本机 Chrome），CDP `--remote-debugging-port=9222` + 独立 profile；**profile 不入 git**（置仓库外或 .gitignore）；端口冲突可换；下载/启停机制与 profile 布局细节见 `[架构待填]`（阶段 3）。
- MCP 落地：本迭代**不交付 .mcp.json**（C-5）；references 交付配置说明、scripts 交付依赖检查/CDP 启停；注册动作由用户按文档手动完成；skill 对"主链路 MCP 未配置"给出可执行路径（依赖检查 + 注册指引，机制细节见 `[架构待填]`）。
- 闭环：一次任务 = 数据证据 + 截图 + 结论产物，供下游验证消费（W3）。
- 落地流程：阶段 2 拆功能卡 → 阶段 3 架构（重点核实：@playwright/mcp 与 chrome-devtools-mcp 对"连接既有 CDP 实例"的支持度、主链路 MCP 未配置时的可执行路径机制、scripts 与 profile 布局）→ 阶段 5 按规范标准工作流产出（skill-creator 流程可选）。
- `[架构待填]`（全部留给阶段 3，不在本合同锁死）：三层共享实例的具体连接机制；@playwright/mcp 未配置时的可执行路径（依赖检查 + 注册指引）机制细节；两个 MCP 的安装/注册确切命令与版本；独立 Chromium 的下载机制与版本；profile 目录与 ignore 规则的确切路径。

### 4. 达到什么效果（裸判定：不问作者也能判断真假）

- 在 `roles/cdp-debug-skill/` 存在该 skill 目录（`SKILL.md` + `references/` + `scripts/`），其 SKILL.md 结构与 skill-design-protocol v3.1.0 检查清单一致（frontmatter 必选字段齐全、CRITICAL ≤ 3、含 Safety 与 Success criteria 等规定 Section）——评审者按规范 checklist 即可判定。
- 给该 skill 一组"页面调试/验证"触发描述（含 should-trigger 与 should-not-trigger 混合样例），description 命中率符合预期——可离线跑触发 eval 判定。
- 任取一个真实前端页面任务（本地 dev server 或已部署 URL），按该 skill 执行一轮，能产出"结构化页面数据证据 + 截图 + 通过/失败/阻塞结论"三类产物且路径可查，全程无需人工介入页面操作——以产物文件存在性与结论一致性判定。
- 登录态场景：通过该 skill 完成一次登录态调试后（独立 Chromium + 独立 profile），**再次调用（新会话）无需重新登录即可继续操作**——以两次调用间 cookie/会话状态连续性判定。
- 分工契约生效：skill 文档内存在与 pb-v1-brower / gstack browse / investigate 的显式分工表，不存在"同一能力两处实现"的重复条款——文档评审判定。

### 5. 为什么这么做

- **直接触发点**（`user_confirmed` 表述）：用户观察到页面调试没有统一入口与闭环，期望"需要页面调试的部分都能使用此 skill"。
- **方案雏形来源**（`user_confirmed`）：用户已想清楚三层链路（测试→诊断→登录态），本合同的 W2 忠实保留该骨架；浏览器实例选独立 Chromium、主链路选 @playwright/mcp、深诊保留 chrome-devtools-mcp 均为用户逐条拍板（C-6/C-2/C-3）。
- **主链路工具选择（决策记录，`user_confirmed`，2026-09-08）**：草稿原推荐"复用 browse/$B 优先"——理由：避免重复建设（既有 browse/$B 已覆盖主链路与 console/网络，§3.3）；用户拍板"优先使用：@playwright/mcp"——理由：获得统一 MCP 工具面，并接受其"当前未配置"的手动注册成本（C-2/C-5 联动）。本合同忠实记录用户决策，不再以模型推断替代（草稿此处原标 `model_inferred`，现转为 `user_confirmed`）。
- **边界收敛原则**：每个"不做什么"（N1~N6）都能说清"为什么这次不做"；本次只交付"一个仓库内可用的统一入口 skill + 最小分层资源"；按 C-4 明确**不做 pb 生态横向整合与跨仓分发**，无后续生态同步项。

---

## 用户确认记录表（原"待用户确认清单"→ 2026-09-08 全部确认，转为本表）

| # | 问题 | 用户决策（`user_confirmed`，原话要点） | demand 原推荐 | 决策影响 |
|---|---|---|---|---|
| C-1 | 交付落点与 skill 名称？ | `roles/cdp-debug-skill/` 下按 Skill 式交付（SKILL.md 七层结构 + references/ + scripts/，遵循 skill-design-protocol v3.1.0）；原话"应该在roles下面新建才对。这才符合规范" | `agents/.claude/skills/cdp-debug-skill/`（与迭代同名），powerby 同步留后续 | 落点定 `roles/cdp-debug-skill/`；不被 install-pb-agents.sh 分发（只装 `roles/<role>/<role>.md`），属仓库内能力定义——如实写入 W1/§3 |
| C-2 | 主链路工具：复用优先还是必须 @playwright/mcp？ | 原话"优先使用：@playwright/mcp"——否决"复用 browse/$B 优先"推荐 | 复用优先（browse/$B 或 @playwright/mcp 取可用者） | 主链路定 @playwright/mcp，browse/$B 不承担主链路首选；联动 C-5：skill 需未配置时可执行路径（`[架构待填]`） |
| C-3 | 诊断链路是否必须到性能/内存级？ | 必须含性能/内存级深诊（chrome-devtools-mcp），保留 | 必须含，否则诊断链路无增量 | 诊断链路（console/网络 + 性能/内存）均走 chrome-devtools-mcp |
| C-4 | 使用范围：pb 生态横向能力还是仅本仓库内？ | 仅本仓库内使用（否决横向能力推荐）；不引用 powerby 跨仓技能 | pb 生态横向能力，按协议跨仓可用 | compatibility 声明限本仓库；N6/W3 措辞收敛；不做跨仓分发 |
| C-5 | 是否交付宿主 MCP 配置（.mcp.json）？ | 不交付 .mcp.json，注册动作由用户按 references 文档自行完成；skill 交付 references 配置说明 + scripts 依赖检查/CDP 启停 | 默认不纳入（避免全仓会话加载两个 MCP），由用户定 | N3 定稿：不交付配置、用户手动注册；依赖检查 + 注册指引成为 skill 首用前置路径（`[架构待填]`） |
| C-6 | 浏览器实例与 profile：本机 Chrome 还是独立 Chromium？ | 下载独立 Chromium（否决复用本机 Google Chrome）；CDP `--remote-debugging-port=9222` + 独立 profile；profile 不入 git；端口冲突可换 | 复用本机 Chrome + 独立 user-data-dir（profile 置 `~/.cdp-profiles/` 或 .gitignore） | 登录态层 = 独立 Chromium + 9222 + 独立 profile（不入 git）；scripts 负责下载/启停 |
| C-7 | "不做什么"（N1~N6）是否全部接受？ | N1~N6 全部接受 | 全部接受 | 边界定稿为 `user_confirmed`；N5 措辞强化为"不改动宿主全局与异仓（含 powerby-skills）"，N6 按 C-4 收敛使用范围 |

**C-2/C-3/C-5 联动结论**：C-2 选"优先 @playwright/mcp"、C-3 选"必须 chrome-devtools-mcp"——两个 MCP 均为必用能力；C-5 选"不交付 .mcp.json"——因此两个 MCP 的注册由用户按 references 文档手动完成，"主链路 MCP 未配置时的可执行路径（依赖检查 + 注册指引）"成为 skill 的必要机制，具体设计留给阶段 3（`[架构待填]`）。

（确认执行：2026-09-08 主 agent 转交、用户逐条确认，7 项全部 `user_confirmed`，无残留 `model_inferred` 结论。本定稿可进入阶段 2。）
