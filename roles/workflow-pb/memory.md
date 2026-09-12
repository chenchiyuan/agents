---
name: workflow-pb memory
description: workflow-pb 角色的精选索引。指向 data/ 下每条记录的一句话摘要。
---

# workflow-pb memory

- **v0.9.0（2026-09-12）**：把"会话"与"工作区"在文本层绑定——新增规则 C（会话工作区隔离：`git worktree` 为默认且唯一被规范化的形态，每迭代一个、阶段 1~6 全程检出迭代分支）、规则 D（启动契约：三条 git 原语判据 + 发现即停）、规则 E（分支命名含迭代编号）、规则 F（跨工作区写入禁止 + 闭集例外两项）、规则 G（暂停 / 终止迭代现场保留），并新增「隔离边界声明」与「角色定义来源与部署」；裸 `worktree` 术语限定为「PR worktree」共 7 处；阶段 5 的 PR worktree 落点移入会话工作区内，收口三步固定为 `git -C <仓库主工作区>` 形式并加第 3 步前置游离动作；角色定义来源改回被 git 追踪的内容，安装脚本降级为面向下游业务项目的可选分发手段。仅从下一个使用本工作流的迭代起生效，不追溯已完成迭代、0019 自身不迁移。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.8.0（2026-09-08）**：新增独立于 main 的中间分支层"迭代分支"（`iteration/{迭代ID}`），把 `main ← PR worktree 分支` 单层结构改为 `main ← 迭代分支 ← PR worktree 分支` 两层结构——main 应始终代表已完成、已验证的稳定状态。阶段1完成后创建迭代分支，PR worktree base/合并目标改为迭代分支，阶段5解锁判据同步改为"合并进迭代分支"，阶段6独立验证pass后由主agent将迭代分支merge进main并删除。仅从下一迭代起生效，不追溯0005/0007。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.7.0（2026-09-07）**：新增独立于 status.md 的 history.md 记录产物，覆盖派发/收到报告/调度决策三类事件，按主 agent 单线程写入的物理顺序保真、不引入序号字段；status.md 头部新增 history 开关字段（默认开启）。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.6.0（2026-09-07）**：demand 角色执行时六维诊断/来源标注等机械项被跳过，根因是"路径引用+子agent自觉阅读"模式下机械性契约遵循度不稳定。用户提出"role即skill，派发=加载skill"方向；澄清后确定 role 文件本身就是 skill 定义（概念等价，非文件迁移），派发机制改为主agent读出角色文件全文并显性注入brief。先在 demand 单点验证，再决定是否推广到其余8个角色。根因和决策过程见 `data/workflow-pb-changelog.md`，理解记录见 `roles/demand/data/demand-skill-migration-understanding.md`。
- **v0.5.0（2026-09-06）**：修复阶段6验证报告发现的4处文字歧义（首批派发封顶规则、槛位空置负面约束、失败/阻塞PR清理禁令、槛位释放字段改名去掉"成功"），并新增阶段6强制检查项——下一个真实多PR并发迭代必须核查worktree时间窗口重叠等真实执行证据，不能停留在协议文字自洽层级。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.4.0（2026-09-05）**：补全阶段5并发调度协议的可执行细节——并发槛位算法（爬升公式+硬上限公式）、status.md并发配置初始化字段、PR实现子状态表新增槛位状态列和失败/阻塞现场保留取值、progress-observer新增worktree/分支存在性核实项。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.3.0（2026-09-03）**：阶段回退从"发现需求问题就回退修正"改为"是否改demand.md结论"的统一判断标准；需求问题由执行角色直接搭置进 `deferred-demand-changes.md`，不回退不暂停，本迭代按现有需求还原到底，变更留给新迭代。根因和决策过程见 `data/workflow-pb-changelog.md`。
- **v0.2.0（2026-09-02）**：并入 workflow-scm，阶段从 7 减到 6，废除全局 tasks.md 环节，新增依赖解锁式并发调度。根因和决策过程见 `data/workflow-pb-changelog.md`。
- [创建反射依据](data/workflow-pb-creation-reflection.md) — 为什么是"交付流程顾问"身份、工作流/角色的分离点是"谁定义契约"
- [两层工作流握手 + brief 传递规则](data/workflow-handshake-and-brief-passing.md) — 跨协议衔接点找自然接缝，迭代特定规则走 brief 不改角色文件
- [status.md状态协议缺口 + 阶段出口案例](data/status-protocol-and-phase-exit-gaps.md) — 主agent验收与独立验证证据要分字段区分；规划阶段结束前先确认产物形成可恢复git快照

