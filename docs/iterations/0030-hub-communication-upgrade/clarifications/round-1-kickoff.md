---
iteration: 0030-hub-communication-upgrade
round: 1
scope: 起迭代 kickoff —— 工作区/门开关/执行通道与模型路由/依据文档入库
caller: demand
status: 生效
created: 2026-09-17
---

# 0030 起迭代 Round 1（kickoff）

## 一、Step 0 声明（主 agent）

| 项 | 取值 |
|---|---|
| 仓库主工作区 | `/Users/chenchiyuan/projects/agents`（`git rev-parse --path-format=absolute --git-common-dir` 的父目录） |
| 迭代工作区地址 | `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade` |
| 迭代分支 | `iteration/0030-hub-communication-upgrade`（base = `main`@`706e3d0`） |
| 建立动作 | `git -C /Users/chenchiyuan/projects/agents worktree add .pb-agents/worktrees/0030-hub-communication-upgrade -b iteration/0030-hub-communication-upgrade main` ⇒ `git worktree list` 含该地址，`branch --show-current` 输出该分支（规则 D 第 5 步两条依据成立） |
| 角色定义根 `{角色定义根}` | `roles/`（本仓库为 agents 源码仓；`git ls-files --error-unmatch roles/demand/demand.md` 成功 ⇒ 真源可用，不读被忽略的 `.pb-agents/roles/` 副本） |
| 人机交互前提 | **具备**真实阻塞式交互通道（本会话有可阻塞提问工具）。不存在"无人值守批处理"降级，遇用户决策点即真实停等、不自问自答。 |
| 方案确认门 | `enabled`（用户 2026-09-17 选择，默认值） |

## 二、起点材料（本次读入的一手文档）

| # | 文档 | 角色 |
|---|---|---|
| ① | `docs/hub-communication-upgrade-demand-2026-09-17.md` | 需求预稿（D-20~D-32、做什么/不做什么/效果/为什么） |
| ② | `docs/hub-vs-subagent-protocol-comparison-2026-09-17.md` | 13 维度协议对比（根因依据） |
| ③ | `docs/hub-issues-and-fixes-2026-09-17.md` | HB-01~HB-11 问题清单（一手证据） |
| ④ | `docs/hub-delivery-architecture-decisions-2026-09-17.md` | 五项决策定案（决策 1~5 + 依赖链） |

② ③ ④ 中，③ 已被 git 跟踪；①②④ 在本会话开工时**未被跟踪**（`git ls-files --error-unmatch` 失败）。按 D-36 复制进迭代分支并提交。

## 三、本次新增实测事实（供第一段引用）

| # | 事实 | 取证方式 |
|---|---|---|
| E-1 | harness 的 `task` **wire schema 无 per-dispatch `model` 字段**；子 agent 的模型只能由 ①`task.agentModelOverrides[agentName]` ②agent frontmatter `model` ③父会话兜底 三级决定 | `omp://tools/task.md` §Inputs/§Flow 第 7 步；`omp config list --json` 确认 `task.agentModelOverrides = {}` 存在 |
| E-2 | 项目 agent 文件 `.omp/agents/<name>.md` 的 `model:` frontmatter **实测生效**：gpt 探针子 agent 自报 `openai/gpt-5.6-luna`、grok 探针自报 `powerby/grok-4.6`、内置 `task` 兜底自报 `deepseek/deepseek-v4-flash` | 三条一次性探针（探针文件用后即删，未入库）；判据 = 子 agent 系统提示中的模型名（`includeModelInPrompt` 默认 true） |
| E-3 | 仓库根 `.omp/` **未被 `.gitignore` 忽略**（`git check-ignore` 退出码 1）⇒ 项目 agent 文件与 `.omp/config.yml` 属可跟踪内容 | `git check-ignore -v .omp/agents/<probe>.md` |
| E-4 | 仓内既有检查 `tools/check-model-dispatch-protocol.sh` V-06 明令 **`roles/*/*.md` 不得包含 `model:` 路由绑定** | 该脚本 V-06 段；与 `principles/execution/model-dispatch-protocol.md` CLR-MD-004「role 文件只描述能力，不绑定部署模型」同源 |

## 四、角色反射（本次讨论的维度集合，显式呈现）

> **角色反射**：这次讨论适合从「hub 协议维护者 + 迭代执行方式设计者」的双视角切入。

需要覆盖的维度：

1. **送达模型**（身份/收件箱/持久化）—— 本迭代第一性问题：hub 的"广播给在线连接"与 subagent 的"投递给身份"是根分歧，HB-01/02/03 同源。
2. **终态语义**（`reason` 封闭枚举 / `detail` 保留）—— 直接决定 inbox 的 `envelope` 列 schema，与维度 1 的持久化决策**不可分割**（先语义后存储）。
3. **超时判据**（空闲为准 + 绝对安全网）—— HB-01 的直接修复面，且带两个可调取值（10 min / 4 h）。
4. **并发模型**（实例池化 / 粘性路由 / 不做生命周期管理）—— HB-04 的直接修复面，与维度 1~3 无耦合。
5. **执行方式**（本次迭代用什么通道、子 agent 落在哪个模型）—— 0029 的 D-19 已把通道从 hub 切到本地 subagent；本次要把它固化为可验证的迭代约束。

维度粒度自检：维度 1 下含 3 个可独立拍板的决策（是否强制身份 / 持久化范围 / 收件箱写入触发条件），维度 4 下含 2 个（池内路由策略 / 规模管理方式）——已在 Plan 调研摘要中分别标注，未把"包里的点依次问完"当作深挖。

## 五、Plan 调研摘要（每维度：现状 / 缺口 / 优先级）

| 维度 | 现状（已确认） | 缺口 | 优先级 |
|---|---|---|---|
| 送达模型 | D-20 收件箱为唯一权威路径；D-21 缺省身份按 `chat_id` 兜底；D-22 只持久化 inbox 一张表 | 全部无缺口（决策已定案，转 PRD 落卡） | 高（决定本迭代主线） |
| 终态语义 | D-23 新增 `reason` 五值封闭枚举，`error` 保留为 `detail` | 现有 10 个自由字符串到 5 类的映射是否穷尽 —— **决策文档 §六已明确留 PRD 阶段做全仓引用点排查** | 高 |
| 超时判据 | D-26 空闲为主判据 + D-27 空闲 10 min + D-28 安全网 4 h + D-29 统一落 `reason=timeout` | 无缺口；取值标注"初始值，可调" | 高（HB-01 即本项） |
| 并发模型 | D-30 池化且 hub 不管生命周期；D-31 同 `(chat_id, agent_id)` 粘性路由；D-32 固定配置不做伸缩 | 无缺口 | 中 |
| **执行方式** | 0029 D-19：本地 subagent 通道；0028 D-4：dev=gpt / verifier=grok 绑定清单 | **本次唯一真缺口**——subagent 通道下"角色→模型"如何落地与留证（E-1/E-2 实测给出了可行机制） | 高（每次派发都用） |

## 六、Work：本次唯一新缺口的关键决策（四段提案 + 追问反射）

### 决策点：subagent 通道下的模型路由落地形态

- **为什么现在必须定**：阶段 2~6 每一次派发都依赖它；载体定错会导致后续所有派发证据形态、以及阶段 6 的"模型归属"核查口径返工。
- **权衡轴**：模型值与角色能力定义的分离度 ←→ 间接层数与配置面。
- **推荐 + 对比理由**：推荐 **A（agent 文件写别名 + `modelRoles` 存模型值）**；选 B（agent 文件直写模型值）少一层间接，代价是模型值散落、换模型要改 N 处；选 C（`omp -p` 一次性 CLI）退出 0029 已确立的 subagent 通道，证据形态从"子 agent 回报"变成"进程输出"，且与本次"用 subagents"的指令不符。三条候选均需满足 E-4 的硬约束：**模型值不进 `roles/*/*.md`**（A/B 都满足，C 无所谓）。
- **用户裁决**：选 **A**。

**追问反射**（关键决策，显式呈现）：

> 这个决策点下，还值得追问的角度是——
> 1. **别名粒度**：别名按"角色"还是按"模型"命名（`@pb_dev` vs `@gpt`）—— 依据：若按模型命名，两个角色共用一个模型时无法各自调整；若按角色命名，模型切换只改别名指向。**按角色命名**，与 D-31 的"角色身份"语义同构。
> 2. **生效留证**：怎么证明"确实跑在 gpt 上"而不是只写了配置 —— 依据：E-1 表明 wire schema 看不到模型，因此不能靠请求回显；**判据定为子 agent 系统提示中的模型名（实测可用）**，与 0028 的"执行侧实报"原则同源。
> 3. **是否需要 `task.agentModelOverrides` 这一层** —— 依据：该层按 agent 名覆盖，语义与 agent frontmatter 重复；**不用**（多一层真源等于多一处漂移点）。

### 决策点：绑定范围

- **为什么现在必须定**：决定 `.omp/agents/` 建几个文件、以及每类派发的模型归属是否可预期。
- **权衡轴**：绑定覆盖度 ←→ 配置面与验证面大小。
- **推荐 + 对比理由**：推荐**只绑 dev / verifier**（沿用 0028 绑定清单）；全角色显式绑定会新增 5 个文件与一轮验证，且与 0028 已定案清单不一致，需重新裁决而不换任何收益。
- **用户裁决**：只绑 dev=gpt、verifier=grok。
- **追问反射**：角度 1「默认兜底是谁」—— 依据 E-2 实测 = `deepseek/deepseek-v4-flash`（父会话默认），未配置角色**继承默认**这一行为不需要额外声明；角度 2「是否给 progress-observer 绑一个独立模型」—— 依据：0028 绑定清单未含它，本次不扩面。**两个角度均已问尽**。

### 决策点：依据文档是否入库

- **为什么现在必须定**：阶段 2~5 的 PR worktree 从迭代分支拉出（0028 G-12 同类问题），未跟踪文档不会出现在 worktree 里，下游角色与阶段 6 验证将读不到 demand 的依据原文。
- **权衡轴**：证据可追溯性 ←→ 仓库里多三份讨论文档。
- **用户裁决**：复制进迭代分支并提交。

## 七、维度收敛状态

- 送达模型：**已收敛**（决策已定案，无新缺口）
- 终态语义：**已收敛**（唯一细节缺口已由决策文档派给 PRD 阶段做全量引用点排查）
- 超时判据：**已收敛**
- 并发模型：**已收敛**
- 执行方式：**已收敛**（round 1 三个决策点经用户裁决）

## 八、本次明确否决/排除的路径

- **否决：agent 文件直写模型值**（方案 B）—— 模型值散落，换模型要改 N 处；与 `.omp/config.yml` 单点集中相悖。
- **否决：`omp -p` 一次性 CLI 作为子 agent 执行器**（方案 C）—— 退出 0029 D-19 已确立的本地 subagent 通道，证据形态与角色派发契约（brief 全文注入）不匹配。
- **否决：全角色显式绑定**（D-34 备选）—— 与 0028 定案清单不一致、无收益新增配置面。
- **否决：把模型值写进 `roles/*/*.md`** —— 违反 E-4（V-06 + CLR-MD-004）。
- **排除（沿用预稿 §三）**：hub 主动核实产物 / 无状态负载均衡 / 纯空闲超时不设安全网 / 实例生命周期管理 / 终态与产物一致性的协议层处理。
