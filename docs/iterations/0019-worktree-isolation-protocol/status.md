# 工作流进度

**工作流**: workflow-pb v0.8.0
**迭代**: 0019-worktree-isolation-protocol
**当前阶段**: 需求收敛（阶段 1）
**迭代分支**: iteration/0019-worktree-isolation-protocol（base = main @ `9ede9ea`，含 0017 全部产出）
**状态**: 进行中
**history**: 开启
**前置**: 本迭代由用户临时插入并定为**最高优先级**，0018-chat-agent-subagent-protocol 已按其裁决暂停在阶段 2 已收敛处（见 `docs/iterations/0018-chat-agent-subagent-protocol/status.md`）。

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ⏸ | ⬜ | 已派发 demand（第一轮）；输入证据 = clarifications/incident-20260912.md |
| 2 | 功能规格 | ⬜ | ⬜ | |
| 3 | 技术架构 | ⬜ | ⬜ | |
| 4 | PR 规划 | ⬜ | ⬜ | |
| 5 | PR 实现 | ⬜ | ⬜ | 逐 PR 状态见下 |
| 6 | 独立验证 | — | — | 按需触发，不计入线性进度 |

## PR 实现子状态（阶段 5 展开）

待阶段 4 产出 `prs/` 后初始化。

## 并发配置（阶段 5）

待阶段 4→5 入口初始化。

## 待确认项

- [ ] **D-1（并发写入风险未消除，需用户知晓）**：同日 17:46:02 main 仍收到另一会话（0017 的会话）的提交 `9ede9ea`，而本会话 17:52:46 才提交 0018 文档 —— 说明本仓库工作区**可能仍有第二个写入方**。本迭代本身要解决的正是这个问题；在 0019 落地前，主 agent 的处置：每次阶段产物落盘后立即提交到 `iteration/0019-…` 分支（不再以未跟踪状态滞留），并在每次分支切换前核对 `git status`。
- [ ] **D-2（0017 收尾产物的一字符差异）**：0017 `verify-stage6-20260912-173934.md` 第 160 行在 main 中为 `:695-699`，曾观测到工作区版本为 `:695-698`（修正版），该修正版仅存于 `/tmp/pb-0017-residual/verify-stage6.worktree.md`。不构成本迭代范围，登记备查（是否采信由 0017 归属方决定）。

## 用户确认记录（Gate）

- **迭代 ID**：`0019-worktree-isolation-protocol`（主 agent 拟定并采用；用户未指定名称，如需改名可直接指出）。
- **优先级与落地方式**（用户裁决，原文）：「不在此迭代完成。 此迭代需要新增功能： 建议：并行会话各用独立 worktree/clone（git worktree add），不要共用同一工作树——本次的丢写与分支错位都源于此。 0018 分支与其未跟踪目录我未触碰。 这个需要迭代优化workflow-pb流程，优先级最高。」；落地方式选择 = **A 先做 0019（独立迭代），暂停 0018**。
- **D-2（0017 遗留缺陷）**：不纳入 0018；0017 的 status.md 已登记为「下一迭代第一优先候选」。

## 更新日志

- 2026-09-12: 迭代启动。Step 0 前提声明——本宿主具备真实阻塞式人机交互通道（`ask`）；`.pb-agents/roles/` 存在。
- 2026-09-12: 创建 status.md + history.md + clarifications/incident-20260912.md（事故一手记录）→ 创建迭代分支 `iteration/0019-worktree-isolation-protocol`（base = main `9ede9ea`）→ 派发 demand（第一轮）。
