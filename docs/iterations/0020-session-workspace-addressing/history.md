# history.md — 0020-session-workspace-addressing

### 2026-09-12 20:20:40 · 调度决策 · 阶段推进核查

- 决策内容：迭代 0020 启动（迭代 ID = `0020-session-workspace-addressing`，主 agent 拟定）；按 v0.9.0 规则 C 的命令形态创建迭代分支与工作区（`git worktree add .pb-agents/worktrees/0020-session-workspace-addressing -b iteration/0020-session-workspace-addressing main`，base = main `dbc99b5`）；阶段 1 置 ⏸；**会话在仓库主工作区启动**（登记为偏离 D-1，理由见 status.md）
- 触发依据：用户对 v0.9.0 规则 C/D 的设计异议（原话见 status.md §用户确认记录）；用户长期指令「使用 workflow-pb 流程沟通清楚需求后迭代」

### 2026-09-12 20:20:40 · 调度决策 · Gate确认

- 决策内容：需求方向确认（不需要用户额外拍板，原话已足够明确）：**把「启动契约」从 cwd 判据改为寻址契约** —— 会话可在项目任意位置启动；协议要求会话解析并声明自己的迭代工作区，此后所有写入与 git 写操作**显式寻址**该工作区；硬停只保留给「无法确定/创建本会话工作区」。主 agent 复盘给出的三条依据（cwd 判据是代理判据而非隔离本身 / 本次事故根因是未限定的相对路径而非 cwd / 0019 全程在主工作区以显式寻址驱动 PR worktree 且隔离成立）随简报交 demand 复核
- 触发依据：用户原话（逐字，见 status.md）；主 agent 对 0019 执行过程的一手复盘（`docs/iterations/0019-worktree-isolation-protocol/clarifications/verify-stage6-20260912-200521.md` 的 D-5 偏差、`verify-pr-001-20260912-195010.md` 的规则 A 通过项）

### 2026-09-12 20:20:40 · 派发 · demand

- 阶段：阶段 1（需求收敛，第一轮）
- 任务：通过结构化对话消除模糊、界定边界，产出有澄清依据的需求合同
