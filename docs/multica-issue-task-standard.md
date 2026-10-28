# Multica Issue / Task 规范

**版本**: 1.0.0
**制定日期**: 2026-10-28
**适用范围**: 本工作区（powerby）使用 Multica 平台进行项目管理时的 Issue 与 Task（Run）约定
**来源**: 由 multica-flow-manager 职责范围内沉淀；首版由 meta-role 根据陈驰远要求直接反射产出（工作区历史尚不足以提炼真实案例，首版以 Multica 平台真实机制为依据，而非凭空设计）
**状态**: 待审核案例验证后升级为"从真实案例提炼"的正式版本

---

## 一、为什么 Issue 和 Task 不是同一类规范

Issue 是承载需求上下文、交付目标、验收标准的责任实体；Task 在 Multica 平台里实际对应一次"Run"（执行记录），没有独立的创建契约，只能通过 `issue runs` / `issue run-messages` 查询。因此本规范分两节：Issue 的标准化定义，和 Task（Run）记录应满足的要求。

## 二、Issue 标准化定义

| 字段/要素 | 必须回答的问题 | 判断依据（平台真实行为） |
|---|---|---|
| 标题 | 一句话能看出这是什么工作 | 标题是 H1；routable issue key（`PREFIX-NUMBER`）出现在标题或分支名里才能触发 PR 自动关联，标题含糊会直接损失这个能力 |
| 描述（body） | 需求来源、交付物是什么、验收标准是什么 | description 是需求的来源，承载任务最重要的上下文；默认不加 Markdown H1，从正文或 `##` 小标题开始 |
| 单一责任入口 | 谁是这个 Issue 的负责人，agent 还是 member | assignee 决定谁被唤醒；指派给 agent 可能直接启动一次 run，这是有副作用的写操作 |
| 父子关系 | 这是独立交付，还是某个大目标下的一步 | 可独立验收的工作才拆子 Issue；小工作直接分配，不拆 |
| stage（如有子 Issue） | 各步骤之间是否有依赖顺序 | stage 是阶段屏障：父负责人检查实际交付后手动把 `backlog` 推进到 `todo`，不是自动依赖推进；没有 stage 的兄弟集合，最后一个子 Issue 完成才唤醒父级一次 |
| 验收标准 | "done"具体指什么可验证的结果 | Task/Run 结束不是业务完成的证明；status 要反映 Issue 真实所处的状态，不是 run 的生命周期 |
| 状态流转 | 当前状态是否如实反映进展 | `in_progress` = 正在交付这个 Issue 自身要的东西；`in_review` = 交付完等待验收；`blocked` = 缺东西推不动，要配一条说明阻塞的评论；`cancelled` ≠ 交付成功，且不会打断已在跑的 Task |

## 三、Task（Run）记录规范

Task 没有独立的标准字段，但一次 Task 的产出要满足：

| 要素 | 要求 | 判断依据 |
|---|---|---|
| 可追溯 | 别人事后能通过 `issue runs` / `issue run-messages` 查到这次执行做了什么、结论是什么 | Task 是执行记录，不是业务完成证明；记录本身要能独立说明"发生了什么"，不依赖执行者记忆 |
| 结果归位 | 最终结果必须写回 Issue 评论，不是只存在于 Task 日志里 | 平台的交付通道是 `issue comment add`，Task/Run 的终端输出不是读者能看到的 |
| 状态同步 | Task 结束时，如果这次执行完成了 Issue 自身要的交付，Issue 状态要跟着改 | Task 结束 ≠ Issue 完成；状态要在"Issue 真实所处的阶段变化的那一刻"写，不是等 Task 收尾统一补 |
| 不假冒协作结果 | 一次 Task 产出的结论如果涉及其他 Issue/Squad 成员的工作，要用真实查询核实，不能凭假设 | 比如"谁在跑这个 Issue"要用 `issue runs --siblings` 查，不是猜 |

## 四、后续迭代方式

本版本尚未经过真实案例验证。随着工作区积累更多 Issue/Task 实践，应按 `principles/meta/agent-design-protocol.md` 的自进化循环：真实案例进案例库，反复出现的模式升级为本规范的修订，修订仍需经陈驰远确认后才定稿，不自主改写。
