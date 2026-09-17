# 唯一派发台账

本表是 F08 验收 4 与 F09 验收 2 **共用的唯一台账**；本迭代不另立自报模型证据文件。

通道固定口径：每一行的通道均为 `本地 subagent（宿主 task 派发）`，不把 hub 作为本迭代角色协作派发通道。

当刻生效模型快照：非绑定角色的快照取迭代 `status.md` 派发台账中 `prd`、`architect`、`pr-planner` 行的实际自报值集合；本次快照为 `deepseek/deepseek-v4-flash`。用户级 `~/.omp/agent/config.yml` 的 `modelRoles.default` 为 `deepseek/deepseek-v4-flash:high`，仅作旁证；`:high` 后缀与自报串不逐字相等，判据使用本表快照而非配置字符串硬编码。

在途行补写协议：行终态确定后，由派发方就地补写该行的自报模型与终态；这是本表唯一允许的就地更新动作。尚未回报的行保持 `未回报` 且终态为 `⏸ 在途`。

本表覆盖至 `2026-09-17 16:07` 的派发；每次派发各占一行，刷新后的状态台账已拆开合并派发。 **在途行补写（2026-09-17 阶段 6 终验后）**：依本表自述的「在途行补写协议」，其三条在途行的对象均已完成，已就地补写自报模型与终态；**16:07 之后的派发不在本表范围**（滚动面 = `status.md` §派发台账，两者不重复记同一行）。

| 时点 | 角色 | 用途 | 通道 | 子 agent 自报模型 | 终态 |
|---|---|---|---|---|---|
| 12:18 | prd | 阶段 2 · 功能规格 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 12:23 | architect | 阶段 3 · 技术架构 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 12:34 | pr-planner | 阶段 4 · PR 规划 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 12:35 | prd | `prd.md` 索引收口 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 13:57 | dev | L1-01 · 载体探针 | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成 |
| 13:57 | verifier | L1-01 · 载体探针 | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
| 14:00 | verifier | 阶段 6 · 验 `prs/`（Gate 首轮） | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
| 14:24 | verifier | Gate 返工后靶向复验 | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
| 14:33 | planner | 阶段 5 · pr-001 内部任务 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 14:33 | planner | 阶段 5 · pr-002 内部任务 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 14:33 | planner | 阶段 5 · pr-003 内部任务 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 14:41 | dev | 阶段 5 · pr-001 实现＋自证 | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成 |
| 14:44 | dev | 阶段 5 · pr-003 实现＋自证 | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成 |
| 14:46 | verifier | 阶段 5 · pr-001 独立验收 | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
| 14:56 | architect | A-06 补定 · 多实例识别约定 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 14:59 | dev | 阶段 5 · pr-002 实现＋自证（含追加契约） | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成 |
| 14:59 | planner | 阶段 5 · pr-004 内部任务 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 14:59 | planner | 阶段 5 · pr-007 内部任务 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 15:07 | architect | prd/F06 收口 · 卡片判据修正 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 15:15 | pr-planner | PR 文件判据与 A-06 补定对齐 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 15:27 | dev | 阶段 5 · pr-007 产物落地＋自证（本次派发） | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成（合并 `58e30cd`） |
| 15:40 | dev | 阶段 5 · pr-004 实现＋自证（含 T0 透传） | 本地 subagent（宿主 task 派发） | `openai/gpt-5.6-luna` | ✅ 完成（合并 `1b02689`） |
| 15:46 | pr-planner | pr-004/pr-008 文件范围与验收修订 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 15:49 | architect | context-pool 同步 · §4 A-05 / §5 / §6 / §10 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 15:50 | verifier | 阶段 5 · pr-002 独立验收 | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
| 15:57 | pr-planner | 欠账收口 · pr-002 tasks 文件口径同步 | 本地 subagent（宿主 task 派发） | `deepseek/deepseek-v4-flash` | ✅ 完成 |
| 16:07 | verifier | 阶段 5 · pr-003 独立验收 | 本地 subagent（宿主 task 派发） | `powerby/grok-4.6` | ✅ 完成 |
