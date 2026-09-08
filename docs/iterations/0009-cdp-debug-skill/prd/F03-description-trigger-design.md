# F03：description 触发与否定边界

## 功能 ID
F03

## 来源
`demand.md` 澄清依据 §2（frontmatter `description` = 做什么+何时用+否定边界）、需求结论 §4 裸判定第 2 条（"给该 skill 一组'页面调试/验证'触发描述（含 should-trigger 与 should-not-trigger 混合样例），description 命中率符合预期——可离线跑触发 eval 判定"）。

## 用户价值
skill 被"页面调试/验证"类任务可靠触发，同时不被测试框架/压测/视觉回归等邻域任务误触发——description 是宿主路由到本 skill 的唯一入口，命中质量决定"统一入口"是否成立。

## 验收标准
- [ ] SKILL.md frontmatter `description` 同时覆盖三段信息：做什么（CDP 页面调试统一编排、获取页面数据/响应/效果）、何时用（何时触发）、否定边界（不适用场景，如纯测试框架编写/CI 压测/视觉回归基线——N2 邻域）
- [ ] 评审者构造混合触发样例（should-trigger：页面调试/自动操作断言/失败深诊/登录态续调类描述；should-not-trigger：N1/N2 邻域如"写 playwright 测试文件""跑压测基准""视觉回归基线"），离线判定 description 命中率符合预期——should-trigger 样例命中、should-not-trigger 样例不命中
- [ ] description 不引用 powerby 跨仓技能、不声明 pb 生态横向能力（C-4/N6），与 F01 使用范围声明一致

## 边界（不包含）
- 不包含 description 之外的 SKILL.md 结构合规（由 F02 处理）
- 不包含触发 eval 的运行基建（宿主/评估机制职责，不在本 skill 交付物内——§4 判定由评审者离线执行）
- 不包含各链路行为本身（F06~F09）

## 架构维度

> **阶段 3 补全（architecture.md §SKILL.md 内容大纲）**：
> - description 构成定稿方向：做什么（CDP 页面调试统一编排：自动操作断言/失败深诊/登录态续调，产出结构化证据+截图+结论供仓库内下游复验）+ 何时用 + 否定边界（不适用：纯测试框架编写与 CI、压测/性能基准、视觉回归基线、pb-v1-brower 式评审/验证协议任务、普通浏览取数语境）。
> - 触发样例集载体：交付 `references/description-eval-samples.md`（should-trigger ≥5、should-not-trigger ≥5，含 N1/N2 邻域样例），供 §4 裸判定 2 离线 eval 复用；样例仅供评审复用，命中率判定仍由评审离线执行。
