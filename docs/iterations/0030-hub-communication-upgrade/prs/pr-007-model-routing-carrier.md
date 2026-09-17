# pr-007 · 模型归属载体声明与取证（F08）

## 上下文摘要

F08 的落地链路事实：宿主 `task` 派发的模型解析优先级 = `task.agentModelOverrides[agentName]` → agent 文件 frontmatter `model` → 父会话生效模型/默认，别名经 `modelRoles` 展开，且 `task` wire schema **不暴露模型字段** ⇒ "`dev` 跑 gpt / `verifier` 跑 grok"只能靠**子 agent 身份本身**（按角色名指定 `agent`，由一份带 `model` 的 agent 定义决定），其余角色不绑定即自动"等于当刻默认"。**载体落点（项目级 `.omp` 两件套 / 用户级 `~/.omp/agent/**` / 扩展包根）属 L1-01，待阶段 4→5 门由用户裁决**，本 PR 不写死任何候选路径：文件范围限于**迭代产物侧可确定的部分**——载体与别名/值绑定声明文件、以及逐条派发的自报模型证据落点；载体落点在裁决后由阶段 5 回填。

## 涉及功能点

- F08

## 文件范围

- docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md（新建：载体与路由声明；载体落点待 L1-01 裁决后由阶段 5 回填）
- docs/iterations/0030-hub-communication-upgrade/evidence/f08-model-attribution.md（新建：逐条派发的"子 agent 自报模型"证据）
- （**不含**任何载体文件的实际落点路径：`~/.omp/agent/**` 与项目级 `.omp/**` 均属待裁决项；也**不含**任何 `oamp/**` 代码——本卡不改运行时）

## 验收标准

- [ ] `model-routing-carrier.md` 存在，含绑定声明（`dev` = `openai/gpt-5.6-luna`、`verifier` = `powerby/grok-4.6`）、别名写法（agent 定义 `model: "@dev"` + `modelRoles.dev` 展开为具体模型串 ⇒ 值集中一处）、以及"其余角色不新增绑定、派发时用默认 agent ⇒ 等于当刻生效模型"的口径
- [ ] 该文件显式标注「载体落点：待 L1-01 裁决后由阶段 5 回填」，且**不预先写死**任一候选路径；裁决落定前该项保持未填，不视为本 PR 未完成
- [ ] 模型值不出现在 `roles/**`：全仓检索 `roles/` 下无 `model:` 键与 `openai/gpt-5.6-luna` / `powerby/grok-4.6` 字面量（`tools/check-model-dispatch-protocol.sh` 的 V-06 与 CLR-MD-004 通过）
- [ ] `evidence/f08-model-attribution.md` 逐条记录派发的**自报模型**（判据 = 子 agent 系统提示中的模型名，F-11 已实测可用）：`dev` 行 = `openai/gpt-5.6-luna`、`verifier` 行 = `powerby/grok-4.6`、其余角色行**等于当刻生效模型**（判据不写死模型名字符串）；派发通道列一律为"本地 subagent"
- [ ] 绑定范围与 0028 定案一致：只 `dev` / `verifier` 两个角色有显式绑定；`cluster.json` 零改动（`oamp/cluster.json` 不在本 PR 文件范围内）

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-08（链路事实、三候选技术评估与推荐、第四条观察、"值集中一处"的两种写法；**形态未选定**）、§7 L1-01、§10-1
- docs/iterations/0030-hub-communication-upgrade/prd/F08-model-attribution-routing.md（验收 1~6）、prd/F09-process-contract-and-friction-log.md（验收 2：与 F08 验收 4 同一张台账）
- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md（2026-09-17 首条：D-35 原载体触规则 F）

## depends_on

- pr-008-process-contract-evidence.md（理由：F08 验收 4「逐条留证」与 F09 验收 2 明文共用**同一张**派发台账；证据：`prd/F08-model-attribution-routing.md` 验收 4 与 `prd/F09-process-contract-and-friction-log.md` 验收 2 指向同一文件 `docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md`（该文件由 pr-008 建立，其"通道 / 自报模型"两列即本卡验收 1~3 的取证面）⇒ 台账不存在时 F08 验收 4 无落点）

## batch

2
