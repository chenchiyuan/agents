# 澄清记录 · 第 1 轮（开工与范围）

- **迭代**: 0028-role-model-binding
- **阶段**: 1（需求收敛，主 agent 内联执行）
- **时间**: 2026-09-15 20:40~20:45
- **caller**: demand

---

## 一、本轮实测事实（作为后续判断依据，来源可复核）

| 事实 | 证据 | 结论 |
|---|---|---|
| omp 默认后端可用 | `omp -p --no-session --model deepseek/deepseek-v4-flash:high "只回复: OK"` → `OK`（2.3s） | 默认链路通 |
| gpt 后端可用 | `omp -p --no-session --model openai/gpt-5.6-luna "只回复: OK"` → `OK`（5.1s） | gpt 链路通 |
| grok 后端可用 | `omp -p --no-session --model powerby/grok-4.6 "只回复: OK"` → `OK`（3.7s） | grok 链路通 |
| **冲突①** | `~/.omp/agent/config.yml` 默认 id = `deepseek/deepseek-v4-flash:high`；`~/.omp/agent/models.yml` 中该 provider 下的 id 只有 `deepseek-chat` / `deepseek-reasoner` / `deepseek-v4.1-flash` | 默认 id 与 provider 清单不同名，靠 fuzzy match 才解析成功——环境事实，记入差距记录 |
| 角色级模型字段已存在 | `README.md` §集群（`cluster.json` 字段表 `model` 行）、`src/cluster-config.js:148-150`（校验）、`src/cluster.js:200-201`（注入 `--model` argv） | "启动时指定后端模型"的机制已就绪，缺的是"配置里没写"与"无实报证据" |
| 模型解析链 | `src/agent.js:192`（一次性路径）、`src/agent.js:346`（常驻路径）：`payload.model > OAMP_OMP_MODEL > --model(角色级) > config 默认 > 内置` | 派发若带 `model` 会静默覆盖角色绑定 |
| 实报模型取证面 | `API.md`：`calls get` 的 `model` = 执行侧**实报**生效模型（非请求回显）；`src/acp-client.js:69-78` 取 ACP `currentValue` | 端到端实证有客观取证面，不靠配置文本自证 |
| 现状配置 | 仓库根 `cluster.json` 的 `roles` 段无任何 `model` 字段 | 当前全部角色实际运行在全局默认 deepseek 上 |
| chat 先例 | 0021 迭代为"每角色一 chat"（`chat-ad0d43df…`= demand 专用、`chat-76db2a03…`= prd 专用），项目 `prj-b1a74533-2c8e-449f-be7e-c5e47331b531` | 本次要求与 0021 相反，需显式推翻 |
| 0027 现场 | `git ls-files docs/iterations/0027-pr-planner-wave-cap` = 0；worktree `iteration/0027-pr-planner-wave-cap` 存在 | 0027 未落 main，按规则 G 原样保留，不占用 0028 编号 |

## 二、本轮决策（逐条标注来源）

| # | 决策点 | 结论 | 来源 |
|---|---|---|---|
| D-1 | 迭代 ID | `0028-role-model-binding` | `user_confirmed` |
| D-2 | 方案确认门 | `enabled`（阶段 3→4 之间暂停呈现完整方案） | `user_confirmed` |
| D-3 | 迭代范围 | 最小闭环 = 角色级模型绑定 + 端到端实证 + 差距记录；动态切换 / web UI / 非 omp 后端**不做** | `user_confirmed` |
| D-4 | 绑定清单 | `dev` = `openai/gpt-5.6-luna`；`verifier` = `powerby/grok-4.6`；其余 8 角色沿用全局默认（不写入 `cluster.json`） | `user_confirmed` |
| D-5 | 模型真源 | 角色级 `cluster.json` 为唯一真源；hub 派发**不带** `model` | `user_confirmed` |
| D-6 | chat 粒度 | 单一 chat 覆盖阶段 2~6；demand 阶段留在会话内、不落 chat | `user_confirmed` |
| D-7 | 差距记录载体 | 并入 `docs/iterations/0028-role-model-binding/deferred-demand-changes.md`（覆盖了主 agent 的独立文件推荐） | `user_confirmed` |

## 三、D-7 的语义风险（本记录显式留痕，供阶段 6 核查）

`deferred-demand-changes.md` 在既有规范里的语义是"**需求层面**的变更/错误搭置"（执行角色发现需求要改时写入，供下迭代决策）。本次把"hub 执行方式与本地 subagent 的差距"也写进同一文件，会产生两类语义混载。主 agent 未异议（用户决策），但第 2 轮追问将就"同一文件内的分区标题与必备字段"取得约定，避免阶段 6 无法区分条目类型。
