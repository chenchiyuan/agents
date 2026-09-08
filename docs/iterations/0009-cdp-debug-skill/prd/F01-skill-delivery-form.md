# F01：skill 交付形态与落点

## 功能 ID
F01

## 来源
`demand.md` W1、澄清依据 §1.1 C-1、需求结论 §3；边界关联 N5/N6/C-4。

## 用户价值
页面调试统一编排 skill 以规范的文件形态落在规定位置，作为**仓库内能力定义**存在（不随框架分发、不污染宿主与异仓），本仓库后续需要页面调试的场景可直接引用该目录。

## 验收标准
- [ ] `roles/cdp-debug-skill/` 目录存在，且按 Skill 式三层交付：`SKILL.md`（主文件）+ `references/`（目录）+ `scripts/`（目录）
- [ ] 对照 `tools/install-pb-agents.sh` 实现核实：其安装模式只覆盖 `roles/<role>/<role>.md`（及 principles/ 等角色文件），不会安装 `roles/cdp-debug-skill/` 下的 SKILL.md/references/scripts——即该 skill 是**仓库内能力定义，不随 .pb-agents 分发**
- [ ] skill 内部或文档明示使用范围**仅限本仓库内**（C-4），不声明 pb 生态横向能力、不做跨仓分发（N6）
- [ ] 本次迭代未在 `roles/cdp-debug-skill/` 下交付 `.mcp.json` 文件（N3/C-5）
- [ ] 本次迭代新增内容仅落在 `roles/cdp-debug-skill/` 与 `docs/iterations/0009-cdp-debug-skill/` 两处，未改动宿主全局（`~/.claude/skills`）与异仓（含 powerby-skills）（N5）

## 边界（不包含）
- 不包含 SKILL.md 内部结构与规范合规（由 F02 处理）
- 不包含 description 触发行为（由 F03 处理）
- 不包含 references/ 与 scripts/ 的具体内容（分别由 F04/F05 处理）
- 不包含与既有页面能力的分工细则（由 F12 处理）
- 不包含对既有角色/技能的任何改动（N5）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D8）**：
> - 目录内文件布局明细：`roles/cdp-debug-skill/` 下 = `SKILL.md`（v3.1.0 七层结构）+ `references/`（5 文件：mcp-registration.md / chain-cheatsheet.md / chromium-profile-guide.md / division-of-labor.md / description-eval-samples.md）+ `scripts/`（4 文件：check-deps.sh / chromium.sh / cdp-browser.sh / profile.sh）。无 assets/、schemas/、无 .mcp.json（C-5/N3）。每个文件的职责与可追溯验收标准见 architecture.md §决策 D8 + §SKILL.md 内容大纲。
> - 不随 install-pb-agents.sh 分发的实证（E8）：脚本遍历 `roles/*/` 仅 copy `<role>/<role>.md`，目录缺同名文件时打印"跳过"并 continue——`roles/cdp-debug-skill/` 无 `cdp-debug-skill.md`（交付 SKILL.md），故天然不被安装。
