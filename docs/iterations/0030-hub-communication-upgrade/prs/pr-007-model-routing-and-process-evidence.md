# pr-007 · 模型归属载体与派发证据面（F08 + F09）

## 上下文摘要

本 PR 承载两张**非运行时**卡的迭代产物侧交付，二者共用**同一张派发台账**，故合并为单一提交单元：

- **F08（模型归属可核对）**：链路事实 = 宿主 `task` 派发的模型解析优先级为 `task.agentModelOverrides[agentName]` → agent 文件 frontmatter `model` → 父会话生效模型/默认，别名经 `modelRoles` 展开，且 `task` wire schema **不暴露模型字段** ⇒ "`dev` 跑 gpt / `verifier` 跑 grok"只能靠**子 agent 身份本身**（按角色名指定 `agent`，由一份带 `model` 的 agent 定义决定），其余角色不绑定即自动"等于当刻生效模型"。**载体落点已裁决（L1-01 = 候选 B，用户级）并实测生效**：`~/.omp/agent/agents/{dev,verifier}.md` 的 frontmatter 走别名 `@dev` / `@verifier`，模型值集中在 `~/.omp/agent/config.yml` 的 `modelRoles`（dev 探针自报 `openai/gpt-5.6-luna`、verifier 探针自报 `powerby/grok-4.6`）。
- **F09（过程契约）**：本迭代派发通道 = **本地 subagent**（宿主 `task` 派发 + brief 全文注入），hub 只作被改造对象与取证面；需有台账、brief 抽检、摩擦搭置、阶段 6 以 **git 事实**取证的形态声明。
- **共同面 = 台账**：F08 验收 4（逐条留证）与 F09 验收 2（每次派发一行）是**同一张表** ⇒ 台账只此一份、只由本 PR 声明；不另立"第二份自报模型证据文件"。
- **仓库侧边界**：载体文件位于**用户级、仓库之外**，不入任何 PR 的文件范围（本 PR 的仓库侧产物 = 声明文件 + 台账 + 过程证据文档），也不把模型值以任何形式写入 `roles/**`；`oamp/**` 运行时零改动。

## 涉及功能点

- F08
- F09

## 文件范围

- docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md（新建：载体与路由声明）
- docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md（新建：派发台账，F08 验收 4 与 F09 验收 2 共用的那一张表）
- docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md（新建：brief 抽检 + 阶段 6 取证形态声明）
- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md（摩擦记录追加；既有共享迭代文件，在此声明归属以避免多 PR 重复声明）

## 验收标准

- [ ] `model-routing-carrier.md` 存在，含绑定声明（`dev` = `openai/gpt-5.6-luna`、`verifier` = `powerby/grok-4.6`）、别名写法（agent 定义 `model: "@dev"` / `"@verifier"` + `modelRoles.dev` / `modelRoles.verifier` 展开为具体模型串 ⇒ 模型值集中一处）、以及"其余角色不新增绑定、派发时用默认 agent ⇒ 等于当刻生效模型"的口径
- [ ] 载体落点已裁决并记录在案：用户级 `~/.omp/agent/agents/{dev,verifier}.md` + `~/.omp/agent/config.yml` 的 `modelRoles`；文件内显式标注"该载体在仓库之外、不入版本控制，可追溯性由本文件 + 台账承担"，且**不含**任何 `roles/**` 内的模型值
- [ ] 模型值不出现在 `roles/**`：全仓检索 `roles/` 下无 `model:` 键与 `openai/gpt-5.6-luna` / `powerby/grok-4.6` 字面量（`tools/check-model-dispatch-protocol.sh` 的 V-06 与 CLR-MD-004 通过）
- [ ] `dispatch-ledger.md` 逐条含五列（角色 / 用途 / 通道 / 子 agent 自报模型 / 终态）；另以「时点」作**行标识列** ⇒ 实际表头为**六列**，**且它就是 F08 验收 1~4 的取证面**：`dev` 行自报 = `openai/gpt-5.6-luna`、`verifier` 行自报 = `powerby/grok-4.6`、其余角色行自报 = 当刻生效模型（判据不写死模型名字符串）——由此 F08 验收 1~4 可在本 PR 产物内判定通过 / 不通过
- [ ] "同一张表"闭合：本迭代不存在第二份自报模型证据文件（无 `evidence/f08-*`）；F08 验收 4 与 F09 验收 2 指向同一份 `dispatch-ledger.md`
- [ ] 绑定范围与 0028 定案一致：只有 `dev` / `verifier` 两个角色有显式绑定；`oamp/cluster.json` 零改动（不在本 PR 文件范围）
- [ ] 台账"通道"列取值均为"本地 subagent（宿主 `task` 派发）"，不存在"经 hub 派发"充当角色协作的条目
- [ ] `evidence/f09-process-contract.md` 含 ≥1 条 brief 抽检记录（判据两条齐：角色定义全文注入、工作区地址字段显式给出），以及阶段 6 并发证据的形态声明（以 git 事实为主：worktree 落点 / 分支时间窗 / 提交交错，**不要求** hub 调用记录作证据）；**边界**：摩擦与需求层问题的仲裁载体是 `deferred-demand-changes.md`（F09 卡验收 4），本 PR 的证据文档**不重复摘录**摩擦条目——证据文档覆盖**通道声明 / 取证形态 / brief 抽检**三项即可。
- [ ] `deferred-demand-changes.md` 中本迭代新增的每条摩擦记录三要素齐（问题 / 为什么判定为需求层面问题 / 本迭代如何处理）；不存在因搭置而暂停、回退或改需求的记录
- [ ] 零运行时改动：本 PR 文件范围内不含 `oamp/**`、`oamp/sdk/**`、`oamp/web/**`；`status.md` / `history.md` 的格式规范不被改写

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-08（链路事实与三候选技术评估；推荐 B 已被裁决采纳）、§7 L1-01、§10-1
- docs/iterations/0030-hub-communication-upgrade/prd/F08-model-attribution-routing.md（验收 1~6）、prd/F09-process-contract-and-friction-log.md（验收 1~6）
- roles/workflow-pb/workflow-pb.md（§Brief 构建规则 / §阶段回退 / §文档路径协议）
- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md（2026-09-17 首条：D-35 原载体触规则 F —— 本轮裁决即对该条的处置）

## depends_on

（无）

## batch

1
