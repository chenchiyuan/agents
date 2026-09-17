# F09 过程契约证据

## 1. 抽检 A：本 PR dev 派发（第一手 brief）

- **派发标识**：2026-09-17 15:27；角色 `dev`；用途「阶段 5 · pr-007 实现与自证」；通道为本地 subagent（宿主 `task` 派发）。
- **判据一：角色定义全文注入**：本次 brief 明确要求角色定义全文注入，并在共享简报中提供 `roles/dev/dev.md` 全文。机械依据：对照角色定义文件行数，`wc -l roles/dev/dev.md` 输出 `195`；因此不是只注入角色名或路径的声明。
- **判据二：工作区地址字段显式给出**：brief 原文字段为「工作区地址：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence`」。该绝对路径与本证据文件的实际 worktree 落点一致。
- **依据**：本 PR 内部 tasks 文件第 6 行给出同一绝对路径与分支；本文件由该 brief 指定的 worktree 产出，git 状态与提交事实见 §3。

原样机械核对命令与输出：

```text
$ wc -l /Users/chenchiyuan/projects/agents/roles/dev/dev.md
195 /Users/chenchiyuan/projects/agents/roles/dev/dev.md
```

## 2. 抽检 B：history 载荷交叉样本（planner / pr-001）

- **派发标识**：2026-09-17 14:33；角色 `planner`；用途「阶段 5 首轮并发，pr-001 内部任务」；通道为本地 subagent（batch `tasks[]` 并发）。
- **判据一：角色定义全文注入**：该批 history 明确记录「角色定义全文注入于本批共享 context 块」，并说明每条 brief 逐行给出字段与角色名/路径。机械依据：对应产物 `prs/pr-001-reason-mapping-module-tasks.md` 的头部写明运行模型、迭代、PR 文件、PR worktree 字段；planner 角色定义文件机械计数为 `204` 行，可与注入源结构复核。
- **判据二：工作区地址字段显式给出**：对应产物原文第 6 行为「`PR worktree（绝对路径，唯一代码写入面）`：`/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-001-reason-mapping-module`」。
- **依据**：迭代 `history.md` 的 14:33 派发记录提供派发载荷，`pr-001-...-tasks.md` 第 3~7 行提供产物侧字段；两者交叉证明 brief 形态可被后续产物复核。

原样机械核对命令与输出：

```text
$ wc -l /Users/chenchiyuan/projects/agents/roles/planner/planner.md
204 /Users/chenchiyuan/projects/agents/roles/planner/planner.md

$ sed -n '3,7p' docs/iterations/0030-hub-communication-upgrade/prs/pr-001-reason-mapping-module-tasks.md
**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-001-reason-mapping-module.md`
**PR worktree（绝对路径，唯一代码写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-001-reason-mapping-module`
**PR worktree 分支**: `feat/0030-pr-001-reason-mapping-module`（落盘时 HEAD = `9f071b8`，`git status --short` 为空；与迭代分支 tip `e01e2a4` 的 merge-base = `9f071b8`）
```

## 3. 阶段 6 并发证据形态声明

阶段 6 的并发证据以三个 git 事实为主，不要求 hub 调用记录作证据：

1. **worktree 落点**：用 `git worktree list --porcelain` 逐项记录 worktree 路径、HEAD 与分支；该事实证明各 PR 在独立 worktree。
2. **分支时间窗**：用 `git log --format='%ci %h %s' <branch>` 记录分支提交时间与提交，结合各 worktree HEAD 判定派发到提交的时间窗。
3. **提交交错**：用 `git log --graph --oneline --all` 记录多个分支/合并提交交错的拓扑事实；不把 hub 消息调用日志当作必要证明。

原样 git 实样（写入时点）：

```text
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence worktree list --porcelain
worktree /Users/chenchiyuan/projects/agents
HEAD 706e3d004029396b0ab24f95c3951b9fe7226214
branch refs/heads/main

worktree /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade
HEAD 270e712dc9ba442bae55e4dc190630835db8e31e
branch refs/heads/iteration/0030-hub-communication-upgrade

worktree /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-003-inbox-table-persistence
HEAD 9f071b8961a65a2d9f258259788be4e0dff4e41a
branch refs/heads/feat/0030-pr-003-inbox-table-persistence

worktree /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-004-idle-net-turn-timers
HEAD 9f071b8961a65a2d9f258259788be4e0dff4e41a
branch refs/heads/feat/0030-pr-004-idle-net-turn-timers

worktree /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence
HEAD f81d5c6796d4fec8599d064ef128c9157897fec0
branch refs/heads/feat/0030-pr-007-model-routing-and-process-evidence

$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence log --format='%ci %h %s' -3
2026-09-17 14:35:03 +0800 f81d5c6 merge: pr-001 reason 映射叶子模块（F04）into iteration/0030-hub-communication-upgrade
2026-09-17 14:30:35 +0800 99abe6b docs(0030): 派发台账更新（dev pr-001/pr-003 + verifier pr-001 + 两轮 Gate 验证）
2026-09-17 14:30:25 +0800 8c8bd33 feat(0030): pr-003 tasks 文件（473 行，含 planner 实跑纠正的 4 处事实）+ dev(pr-003, gpt) 派发 + 证据落点/跨PR契约裁决记账
```
