# F02：SKILL.md 结构与规范合规

## 功能 ID
F02

## 来源
`demand.md` W1（"遵循 v3.1.0 七层结构、frontmatter 必选字段、约束词分级、三明治/抗遗忘设计、协议先行"）、澄清依据 §2（技能规范硬约束）、需求结论 §4 裸判定第 1 条。

## 用户价值
SKILL.md 严格遵循 `docs/skill-design-protocol.md` v3.1.0——评审者按规范 checklist 即可判定合规，不依赖作者自述，这是本 skill 作为"Skill"成立的结构前提。

## 验收标准
- [ ] `roles/cdp-debug-skill/SKILL.md` 存在
- [ ] frontmatter 必选字段齐全：`name`（kebab-case）、`description`（做什么 + 何时用 + 否定边界）、`role.identity`（L4 精度）、`relationship`、`character`、`compatibility`——评审者按规范 v3.1.0 frontmatter 检查项逐字段核对
- [ ] 正文包含规范 v3.1.0 规定的 Section：Purpose → Success criteria → Strategy → Tools and capability boundaries → Important facts and constraints → Workflow → Output format → Resources → Safety（及 pb-v1 变体要求的核心哲学/输入输出协议/职责边界等，如适用）——按规范规定 Section 清单核对
- [ ] 含 **Safety** 与 **Success criteria** 两个规定 Section（§4 裸判定第 1 条点名）
- [ ] 约束词分级合规：CRITICAL 全篇 ≤ 3 处/Skill；MUST / NEVER ≤ 2 处/Section——评审者计数核对
- [ ] 抗遗忘三明治设计：红线/CRITICAL 在文档首尾各现一次
- [ ] 协议先行：因产物被下游消费（W3/F11），SKILL.md 含产物协议契约声明（三类产物的结构与结论格式承诺）

## 边界（不包含）
- 不包含 description 的触发命中行为（由 F03 处理）
- 不包含 references/scripts 资源内容（由 F04/F05 处理）
- 不包含三层链路的具体行为（由 F06~F09 处理）
- 不包含凭据保护条款内容（由 F13 处理；本卡只验 Section 存在与约束词计数）

## 架构维度

> **阶段 3 补全（architecture.md §SKILL.md 内容大纲）**：
> - Section 落位已按 v3.1.0 顺序（frontmatter → Purpose → Success criteria → Strategy → Tools and capability boundaries → Important facts and constraints → Workflow → Output format → Resources → Subtask guidance → Examples → Safety）逐节锁大纲与填充来源卡（F02 验收要求的 Safety、Success criteria、协议先行均有明确落位与内容）：协议先行落地于 Output format（evidence.json/result.json 完整 schema，见 F11 补全/architecture.md D6）。
> - CRITICAL ≤3 配额分配建议：①凭据/登录态证据默认不入 git、提交前脱敏（F13）②三层共享实例前提（Form A）不成立时不得宣称登录态连续 ③MCP 未配置时产出 blocked 而非伪通过——stage 5 定稿时按规范检查清单核对计数与三明治（首尾各现一次）。
> - stage 5 按规范 v3.1.0 检查清单逐项核对落地（本卡验收标准 1~6 是核对对象，非 stage 3 产物）。
