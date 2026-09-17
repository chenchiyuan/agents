# 模型路由载体声明

## 一句话结论

本迭代本地 subagent 通道只对 `dev` 与 `verifier` 做显式模型绑定；其余角色不新增绑定，按派发时的默认 agent 解析为当刻生效模型。载体采用已裁决并实测生效的候选 B：用户级 harness 配置。

## 1. 绑定声明与解析链

- `dev` 的绑定值为 `openai/gpt-5.6-luna`。
- `verifier` 的绑定值为 `powerby/grok-4.6`。
- 用户级 agent 定义只写别名：`model: "@dev"` 与 `model: "@verifier"`；具体值由 `modelRoles.dev` 与 `modelRoles.verifier` 展开。
- 模型值只在 `~/.omp/agent/config.yml` 的 `modelRoles` 配置面出现一次，agent 定义只写别名；本文件记录解析链与实测结果，不复制第二份配置真源。
- 其余角色不新增绑定；派发时使用默认 agent，不指定 `dev`/`verifier` 名称，因而等于派发当刻父会话的生效模型，不把 `modelRoles.default` 的当前后缀值误作永久绑定值。

## 2. 用户级载体与裁决记录

载体落点为用户级 `~/.omp/agent/agents/{dev,verifier}.md`（frontmatter 分别为 `model: "@dev"` / `model: "@verifier"`）与 `~/.omp/agent/config.yml` 的 `modelRoles.dev` / `modelRoles.verifier`。这是 L1-01 的候选 **B（用户级）**，裁决来源是迭代 `status.md` 的「用户裁决落定」记录；该记录同时说明模型值集中在 `modelRoles`。

实测证据以 `status.md` 的「派发台账」两行（13:57 的 `dev（载体探针）` 与 `verifier（载体探针）`）及本迭代唯一 `dispatch-ledger.md` 为准：两条探针分别自报 `openai/gpt-5.6-luna` 与 `powerby/grok-4.6`。不引用状态文件「用户裁决落定」表中的 12:40 时间戳；该表与派发台账时间存在已知不一致。

## 3. 仓库边界、通道范围与追溯

- 该载体在**仓库之外**，位于用户级 `~/.omp/agent/`，因此**不入版本控制**，也不写入任何 PR worktree。
- 绑定的可追溯性由**本文件 + `dispatch-ledger.md`**承担；用户级配置本身不是本 PR 的仓库交付物。
- 本地 subagent（宿主 `task` 派发）通道适用本迭代阶段 2~6 的角色派发，模型归属以子 agent 实际自报为取证面。
- oamp 集群通道适用 `oamp cluster` 管理的节点，其角色级模型声明在 `cluster.json` 的 `roles.<role>.model`；两条通道各自适用，不是同一配置对象的同步副本。
- `cluster.json` 在本 PR 中**零改动**；不引入任何同步机制、生成机制或跨通道配置复制。

## 4. 判据层与既有递归取证

模型值不得进入角色定义文件；本 PR 的机械判据层是 `roles/*/*.md`，该层不含 `model:` 键或绑定模型字面量，符合独立路由配置结论「role 文件只描述能力，不绑定部署模型」。`roles/**` 递归层中既有 verifier 取证报告仍有模型字面量，这是既存证据事实，不改写、不清零，也不把它误判为角色定义层写入。

D-35 原搭置条目的当前处置指向本候选 B：本迭代不回退、不暂停、不改需求，按已裁决的用户级载体继续；下一迭代再评估工作区发现根与隔离协议的结构性摩擦。

## 5. 复核命令

```bash
# 载体别名与集中值（仓库外，只读）
grep -n 'model:' ~/.omp/agent/agents/dev.md ~/.omp/agent/agents/verifier.md
grep -n 'modelRoles\|^[[:space:]]\+\(dev\|verifier\):' ~/.omp/agent/config.yml

# 判据层（角色定义文件）
grep -nE '^[[:space:]]*model:' roles/*/*.md
grep -nE 'openai/gpt-5.6-luna|powerby/grok-4.6' roles/*/*.md
```

以上判据命令以无命中为通过；递归层命中只作为既有证据登记，不作为改写目标。
