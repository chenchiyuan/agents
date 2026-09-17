# deferred-demand-changes.md — 0030-hub-communication-upgrade

> 本文件由执行侧直接写入（不回退、不暂停）：执行角色或阶段 1 内联执行者发现"要改 `demand.md` 结论才能解决"的问题时追加，供本迭代末与下一迭代决策。
> 本迭代按已落盘的 `demand.md` 继续，不等用户裁决；条目在阶段 6 由 verifier 原文摘录置顶呈现。

## 2026-09-17 · 阶段 1（主 agent 内联执行期间的可行性实测）

**问题**：**D-35（模型路由载体 = 项目 agent 文件 `.omp/agents/<role>.md` + `.omp/config.yml` 的 `modelRoles` 别名）在本会话不可实现而不触规则 F。**

- **实测依据**（三条，可复核）：
  1. harness 的 task agent 发现根 = **会话 cwd 下的 `.omp/agents`**——探针 `.omp/agents/modelprobe.md`（frontmatter `model: openai/gpt-5.6-luna`）在仓库根被成功发现并生效；同一探针放在迭代工作区内不会被发现。
  2. 本会话的 cwd = **仓库主工作区** `/Users/chenchiyuan/projects/agents`（工作区地址是迭代工作区，两者不同）。⇒ 要让发现生效，agent 文件必须落在**仓库主工作区**的 `.omp/`；而 `data/scm-protocol.md` §规则 F 明令：会话写操作不得落在仓库主工作区（闭集例外只有"工作区创建"与"收口三步"）。
  3. 另两条候选载体亦不可用：`task` wire schema 无 per-dispatch `model` 字段（F-10）；eval 桥的 per-dispatch `model` 参数**实测被忽略**（两次探针分别指定 `openai/gpt-5.6-luna` / `powerby/grok-4.6`，子 agent 均实报 `deepseek/deepseek-v4-flash`）。
- **为什么判定为需求层面问题**：D-35 是 `demand.md` §二 的 `user_confirmed` 决策；改载体形态 = 改需求结论（"模型值集中在哪一层、以什么形态被跟踪"），不是实现路径选择。
- **本迭代如何处理**：**不回退、不暂停**——阶段 2~4 不受影响（prd / architect / pr-planner 均走默认模型，不需要该载体）；**阶段 5/6 开始前**须按方案确认门呈现的修订选项之一落地（候选：**A** 在仓库主工作区建 `.omp/`（触规则 F，但最贴合 D-35 原意）／**B** 放用户级 `~/.omp/agent/agents/`（不触 git 工作区，但路由不入版本控制）／**C** 改用 `omp -p --no-session --model X` 一次性进程（完全合规，但退出本迭代 D-33 已定的本地 subagent 通道））。选项与推荐见阶段 4→5 门口的呈交。
- **下一迭代候选**：harness 的"项目级 agent 发现根固定在会话 cwd"与本框架"工作区隔离/显式寻址"协议存在结构性冲突（会话 cwd 恒为仓库主工作区，而一切产物必须落在迭代工作区）——这是**第四次**同型摩擦（前三次：0028 G-12 PR worktree 读不到迭代产物、0028 G-2 brief 无文件通道、0029 DC-20 自建等待脚本）。若要根治，需要一次独立的协议迭代（如：为角色派发定义"发现根 = 工作区地址"的载体，或把 agent 定义改为可按路径显式传入）。
