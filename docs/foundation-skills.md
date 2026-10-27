## 基础技能

这两个技能用于基础架构项目。ASD-STE100 约束沟通方式，Karpathy Guidelines 约束编码行为。
仓库的 `AGENTS.md` 记录默认规则。本文记录上游来源和 Multica 安装信息，不复制上游技能正文。

| 技能 | 上游技能目录 | 核对的上游提交 |
|---|---|---|
| `asd-ste100` | https://github.com/JAICHANGPARK/ASD-STE100/tree/main/skills/asd-ste100 | `384d7d568da6f55ee379e429f9b4e1b0bd603536` |
| `karpathy-guidelines` | https://github.com/multica-ai/andrej-karpathy-skills/tree/main/skills/karpathy-guidelines | `2c606141936f1eeef17fa3043a72095b4765b9c2` |

ASD-STE100 使用 **80% Pragmatic Mode**，不是航空领域的严格合规模式。
中文保留短句、主动语态、一句一个主要意思等原则。英文保留上游建议的句长限制。
该技能不包含官方完整词典，不能用它证明符合完整标准。

## Multica 安装记录

安装日期：2026-10-27。任务：POWERBY-4。

以下 ID 只适用于本次安装所在的 Multica 工作区，不应直接用于其他工作区。

| 技能 | 工作区技能 ID | 导入结果 |
|---|---|---|
| `asd-ste100` | `2cfdc590-7f1f-498d-bd77-2cf35f4dd625` | `created`，已回读确认 |
| `karpathy-guidelines` | `eda9fee1-b51e-4cae-b47e-9401c86ab5d1` | `created`，已回读确认 |

两次导入均保留 GitHub 来源，主技能文件均为 `SKILL.md`，没有附属文件。
这里只安装技能内容。ASD 仓库的插件、hooks 和命令行工具不在本次安装范围内。

工作区安装不等于 agent 绑定。成员已确认以下默认绑定范围：

- `asd-ste100`：绑定给所有已有智能体。
- `karpathy-guidelines`：绑定给职责明确的研发智能体。

2026-10-27 的绑定清单如下，均使用增量 `add`，保留原有技能：

| 智能体 | ASD-STE100 | Karpathy Guidelines |
|---|---|---|
| Mika | 是 | 否 |
| deepseek-flash | 是 | 否 |
| claude | 是 | 否 |
| demand | 是 | 否 |
| prd | 是 | 否 |
| architect | 是 | 是 |
| planner | 是 | 是 |
| pr-planner | 是 | 是 |
| dev | 是 | 是 |
| verifier | 是 | 是 |
| retrospective | 是 | 否 |
| meta-role | 是 | 否 |

研发范围包括技术架构、任务规划、PR 规划、编码和独立验证。
`deepseek-flash` 和 `claude` 尚无职责说明，不能仅凭模型名称判断为研发智能体。
Mika、需求、产品规格、复盘及角色设计不在此次 Karpathy 绑定范围内。
以上是现有对象的绑定清单，不会自动为将来创建的智能体绑定技能。
新建智能体时应沿用此规则，先明确职责，再执行绑定并回读确认。

本次未改写任何智能体的全局指令。后续任务加载已绑定技能，正在运行的任务不会自动重新加载。
仓库中的 `AGENTS.md` 只约束读取该文件的仓库任务，不会自动变成工作区全局规则。

## 在其他工作区安装

使用技能目录 URL，不使用仓库根 URL。两个仓库的根目录均无 `SKILL.md`。

```sh
multica skill list --output json
multica skill import --url https://github.com/JAICHANGPARK/ASD-STE100/tree/main/skills/asd-ste100 --output json
multica skill import --url https://github.com/multica-ai/andrej-karpathy-skills/tree/main/skills/karpathy-guidelines --output json
```

以返回结果中的 `skill.id` 为准。若发生同名冲突，先读取现有技能，不要直接覆盖。
导入后用 `multica skill get <skill-id> --output json` 核对名称、来源和内容摘要。
导入 URL 跟随 `main` 分支。上表记录核对时的提交，不代表平台固定了该提交。

## 绑定与更新

先查看目标 agent 的现有绑定。确认变更后，使用 `add`，不要使用会替换全部绑定的 `set`。

```sh
multica agent skills list <agent-id> --output json
multica agent skills add <agent-id> --skill-ids <skill-id> --output json
multica agent skills list <agent-id> --output json
```

每个技能执行一次增量绑定。只有最后一次读取包含两个技能 ID，才能确认绑定完成。
绑定后由后续任务加载技能，不能据此声称当前任务环境已经重新加载。

需要同步上游时，先确认更新，再执行：

```sh
multica skill refresh <skill-id> --output json
```

更新后重新核对内容，并更新本文的上游提交记录。
