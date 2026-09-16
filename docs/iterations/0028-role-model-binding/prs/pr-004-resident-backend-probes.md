# pr-004：常驻后端探针回执与例外通道唯一性（F02）

## 上下文摘要

把阶段 1 已在常驻路径上完成的两条探针（gpt @ `pb-dev`、grok @ `pb-verifier`）落成可核对回执，并核对"per-call `--model` 例外只存在于探针期"：这 2 条是本迭代唯一携带 `--model` 的调用，阶段 2~6 其余派发命令一律不带。回执六字段（`派发命令` / `call_id` / `终态字段` / `chat_id` / `时点` / `耗时`）落本 PR 证据小节，两条同属迭代 chat。MI-2 事实补记：取证时目标集群（`main` 的 `cluster.json`）无任何 `model` 键。

## 涉及功能点

- F02

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md`（本 PR 文件：写入两条探针回执的「验收证据」小节；不新建独立探针文件）

## 验收标准

- [ ] 「验收证据」小节含 **2 条**常驻路径探针回执（gpt 一条、grok 一条），每条含六字段：`派发命令`（含 per-call `--model` 取值）/ `call_id` / `终态字段`（`state` / `model` / `error` / `exit_code`）/ `chat_id` / `时点` / `耗时`（字段名逐字照录）
- [ ] 两条落在**两个不同的角色节点**（`pb-dev` 与 `pb-verifier`；实际节点若不同以实际记录为准，但"不同节点"不变）
- [ ] 两条终态的实报 `model` 分别解析到 gpt 后端与 grok 后端（判定口径 = 指向同一后端，不要求与请求字符串逐字相等；实报字符串原文照录保留）
- [ ] **MI-2 事实补记**已写入：取证时目标集群配置（当时 `main` 的 `cluster.json`）**无任何 `model` 键**——即两条实报只能来自 per-call `model` 参数（该口径已由 20:52 两条既成探针事实满足，无需重跑）
- [ ] **例外通道唯一性**：阶段 2~6 的全部派发命令中，携带 `--model` 的恰为这 2 条（判据与 F09 验收 3 同源，逐条命令形态的核对结论取自 pr-008；本 PR 只落盘"这 2 条带 `--model`"这一侧的事实）
- [ ] 两条探针同属迭代 chat `chat-6c89902c-0a9f-4513-a299-90a7f98ae611`（chat 唯一性与建 chat 来源判据归 F10 / pr-008）
- [ ] 不新建独立探针文件；不覆盖 deepseek 的常驻探针（D-15）；不把该通道保留为长期可用能力（F02 边界）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md`（验收 1~6、边界、架构维度 A-02、MI-2）
- `docs/iterations/0028-role-model-binding/architecture.md` §4 A-02（F02 六字段形态与 MI-2 事实补记）
- `docs/iterations/0028-role-model-binding/status.md` §派发台账（两条探针行：`task-bfd83f28-…` @`pb-dev` 实报 `openai/gpt-5.6-luna`；`task-39204abd-…` @`pb-verifier` 实报 `powerby/grok-4.6`）
- `docs/iterations/0028-role-model-binding/deferred-demand-changes.md` §执行方式差距 G-1（探针例外与真源唯一的冲突登记）
- 代码锚点：`oamp/src/cluster.js:200-201`（`--model` 追加点）、`<主工作区>/cluster.json`（探针取证时无 `model` 键的事实面）

## depends_on

- pr-008-dispatch-contract-audit.md（理由：本卡验收 4 的判据面是**阶段 2~6 全部派发命令**中"除这 2 条外不含 `--model`"，卡面明写"与 F09 验收 3 同源判据"；该全量逐条命令形态核对由 pr-008 产出并落在其「验收证据」小节，本 PR 消费其结论——证据：`prd/F02-resident-backend-probes.md` 验收 4 原文与 `prd/F09-dispatch-channel-and-source-of-truth.md` 验收 3 的同一判据面）

## batch

5

## 验收证据

（本 PR 执行时填写：两条回执，逐条一个三级标题条目，字段名逐字为 `派发命令` / `call_id` / `终态字段` / `chat_id` / `时点` / `耗时`，并随附 MI-2 事实补记）

### 执行记录（pr-004 · 常驻后端探针回执；执行者 dev，2026-09-16）

路径记号：`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`（迭代工作区）；`<MAIN>` = `/Users/chenchiyuan/projects/agents`（主工作区）；`<WT>` = 本 PR worktree。
**只读声明**：本 PR 零写动作——无 `calls create` / `messages send` / `projects create` / `cluster up|down`，**未重跑探针**（禁令自证见「边界声明与禁令自证」节）；唯一版本控制写入 = 本 PR 文件。

#### 探针回执 · gpt（节点 `pb-dev`）

- `派发命令`：`node <MAIN>/oamp/bin/hub.js api calls create --chat-id chat-6c89902c-0a9f-4513-a299-90a7f98ae611 --agent dev --model openai/gpt-5.6-luna --task "后端连通性探针（迭代 0028）：只回复两个字“探针”。不要调用任何工具，不要读写任何文件。"` —— **按登记面重建的命令形，非当时的命令原文**（原文未留存，判据见「效力边界登记」①）
- `call_id`：`task-bfd83f28-2078-434b-8a16-eac455d2e999`（来源：`status.md:62` 第 4 列原文）
- `终态字段`：`state` = `completed`（来源：`status.md:62`「终态」列 `completed（3607ms）`）；`model` = `openai/gpt-5.6-luna`（实报原文照录，来源同上第 6 列）；`error` = **不可得**（台账未记录，且信封已不可达）；`exit_code` = **不可得**（同左）
- `chat_id`：`chat-6c89902c-0a9f-4513-a299-90a7f98ae611`（来源：`status.md` §执行方式「chat_id（阶段 2~6）」；对话留存侧命中见本文件「对话留存归属」节 `messages[].id=64`）
- `时点`：`2026-09-15 20:52`（来源：`status.md:62`「时点」列 = `20:52`；日期取自 `history.md` 的 2026-09-15 当日记录）
- `耗时`：`3607ms`（来源：`status.md:62`「终态」列括号值；**如实记录、不入判据**）

**后端口径判定（PR 验收 3 / F02 验收 2 / MI-3）**：provider 前缀 `openai/` ⇒ **gpt 后端**（判定只判「指向同一后端」；`openai/gpt-5.6-luna` 为可复核原始事实，不作比较判据）。

#### 探针回执 · grok（节点 `pb-verifier`）

- `派发命令`：`node <MAIN>/oamp/bin/hub.js api calls create --chat-id chat-6c89902c-0a9f-4513-a299-90a7f98ae611 --agent verifier --model powerby/grok-4.6 --task "后端连通性探针（迭代 0028）：只回复两个字“探针”。不要调用任何工具，不要读写任何文件。"` —— **按登记面重建的命令形，非当时的命令原文**（同左）
- `call_id`：`task-39204abd-38ab-4971-b785-3eed6b0bb835`（来源：`status.md:63` 第 4 列原文）
- `终态字段`：`state` = `completed`（来源：`status.md:63`「终态」列 `completed（4885ms）`）；`model` = `powerby/grok-4.6`（实报原文照录，来源同上第 6 列）；`error` = **不可得**（台账未记录，且信封已不可达）；`exit_code` = **不可得**（同左）
- `chat_id`：`chat-6c89902c-0a9f-4513-a299-90a7f98ae611`（来源同上；对话留存侧命中见 `messages[].id=66`）
- `时点`：`2026-09-15 20:56`（来源：`status.md:63`「时点」列 = `20:56`）
- `耗时`：`4885ms`（来源：`status.md:63`「终态」列括号值；**如实记录、不入判据**）

**后端口径判定**：provider 前缀 `powerby/` ⇒ **grok 后端**（同 MI-3 口径）。

**两个不同角色节点（PR 验收 2 / F02 验收 1）**：两条的实例 id 分别为 `pb-dev` 与 `pb-verifier`，判据 = 两字符串比对不等：

```
$ sed -n '62,63p' <WS>/docs/iterations/0028-role-model-binding/status.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}'
dev（`pb-dev`）
verifier（`pb-verifier`）
$ sed -n '62,63p' <WS>/docs/iterations/0028-role-model-binding/status.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}' | sort -u | wc -l
2                       # 两个不同节点（pb-dev / pb-verifier）
```

#### MI-2 事实补记（PR 验收 4 / F02 验收 3）

取证时目标集群配置 = `<MAIN>/cluster.json`（当时 `main` 的仓库根配置）**无任何 `model` 键** ⇒ 两条实报只能来自 per-call `--model` 参数。

```
$ grep -c '"model"' /Users/chenchiyuan/projects/agents/cluster.json
0
$ git -C /Users/chenchiyuan/projects/agents log -1 --format='%h %ad %s' --date=iso -- cluster.json
e6da668 2026-09-11 12:22:47 +0800 feat(0012/pr-002): 集群配置加载与校验 + 仓库根 cluster.json
$ git -C /Users/chenchiyuan/projects/agents status --porcelain -- cluster.json
（零输出 ⇒ 该文件工作树干净）
```

**机制链**（`oamp/src/cluster.js:200-201`）：`if (entry.model !== undefined) { argv.push('--model', entry.model); }` ⇒ 角色级 `--model` 的唯一追加点是配置键 `roles.<role>.model`；配置**无该键** ⇒ 角色窗口不带 `--model` ⇒ 两条实报**只能**来自派发侧的 per-call `--model`。

**效力边界**：`cluster.json` 的最后提交时点 `2026-09-11 12:22:47 +0800` **早于**探针时点 `2026-09-15 20:52`，且该文件在工作树中干净 ⇒ 探针时点与现文一致（当时无未提交改动的最佳可得证据）。本补记属**静态面 + 登记面**判据，**不是**活体信封复核。

**口径已由既成事实满足、无需重跑**（`prd/F02` 验收 3 原文）：本 PR 只落盘既有事实，**未重跑探针**。

#### 对话留存归属（PR 验收 6 / F02 验收 6；`chat_id` 字段的来源面）

```
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api chats get chat-6c89902c-0a9f-4513-a299-90a7f98ae611 \
    | jq -r '.messages[] | select((.meta.task_id? // "") == "task-bfd83f28-2078-434b-8a16-eac455d2e999" or (.meta.task_id? // "") == "task-39204abd-38ab-4971-b785-3eed6b0bb835") | [.id,.direction,.agent_id,((.meta|keys)|join("+")),.text] | @tsv'
64	in	pb-dev	task_id	后端连通性探针（迭代 0028）：只回复两个字“探针”。不要调用任何工具，不要读写任何文件。
66	in	pb-verifier	task_id	后端连通性探针（迭代 0028）：只回复两个字“探针”。不要调用任何工具，不要读写任何文件。
$ for cid in task-bfd83f28-2078-434b-8a16-eac455d2e999 task-39204abd-38ab-4971-b785-3eed6b0bb835; do \
    printf '%s\t' "$cid"; node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api chats get chat-6c89902c-0a9f-4513-a299-90a7f98ae611 \
    | jq -r --arg c "$cid" '[.messages[] | select((.meta.task_id? // "") == $c)] | length'; done
task-bfd83f28-2078-434b-8a16-eac455d2e999	1
task-39204abd-38ab-4971-b785-3eed6b0bb835	1
```

⇒ 两条探针**同属**迭代 chat `chat-6c89902c-0a9f-4513-a299-90a7f98ae611`（各命中**恰一处**：`messages[].id` = 64 / 66）。

**效力边界（契约 5）**：该面 `meta` **仅含 `task_id` 一个键**（无 `agent` / `model` / `state` / 时间）⇒ **不得**表述为「从对话记录复核了节点与模型」：节点与实报值**只能**取自台账（`status.md:62/63`）。两条消息的 `text` 即当时 `--task` 取值的留存证据（**推定**：正文与提示词一致；非命令原文的全部）。

**旁证（不重复判定）**：`messages[0].meta.task_id` = `task-bfd83f28-2078-434b-8a16-eac455d2e999`（gpt 探针）——该判定的归属权在 F10 / pr-008，本 PR 只留旁证、不做结论。

#### 效力边界登记（契约 5；三项 + 穷尽检索）

**① 信封不可达（E3）**：

```
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-bfd83f28-2078-434b-8a16-eac455d2e999
{"code":"NOT_FOUND","error":"call 不存在: task-bfd83f28-2078-434b-8a16-eac455d2e999","exit_code":1,"http_status":404}
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-39204abd-38ab-4971-b785-3eed6b0bb835
{"code":"NOT_FOUND","error":"call 不存在: task-39204abd-38ab-4971-b785-3eed6b0bb835","exit_code":1,"http_status":404}
$ node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls list | grep -c 'bfd83f28\|39204abd'
0                       # 调用面列出 24 条，两条探针零命中
```

⇒ 两条探针均为**集群重建前**（2026-09-16 08:47 重建）的调用，调用面已清空 ⇒ 与 **G-15**（`deferred-demand-changes.md:143`）同类现象。

**② 派发命令原文未留存（E10）**：

```
$ grep -rn 'calls create' <WS>/docs/iterations/0028-role-model-binding 2>/dev/null | wc -l
90                      # 命中分布于 21 个文件（模板 / 迭代约定 / 其它 PR 的命令 / 核对产物）
$ grep -rn 'task-bfd83f28\|task-39204abd' <WS>/docs/iterations/0028-role-model-binding 2>/dev/null | grep -c 'calls create'
0                       # 关键判据：全迭代无任何一行「同时含探针 call_id 与 calls create」
$ grep -rn 'task-bfd83f28\|task-39204abd' <WS>/docs/iterations/0028-role-model-binding 2>/dev/null | grep -- '--model'
（5 行，均为**关于探针的陈述**而非命令原文：pr-008:175 / :181（A 组与汇总结论）、deferred-demand-changes.md:22（G-1 证据行「两条均在 --model 显式携带下完成」）/ :116（G-11 现象行）、clarifications/verify-20260915-221935.md:33）
$ sed -n '15,16p' <WS>/docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
| gpt 后端可用 | `omp -p --no-session --model openai/gpt-5.6-luna "只回复: OK"` → `OK`（5.1s） | gpt 链路通 |
| grok 后端可用 | `omp -p --no-session --model powerby/grok-4.6 "只回复: OK"` → `OK`（3.7s） | grok 链路通 |
```

⇒ 检索结论：本迭代产物中**不存在**这两条探针的 `calls create` 命令原文；`clarifications/round-1-kickoff.md:15-16` 的两条 `omp -p --no-session --model …` 属 **F01 一次性路径**（非 F02 常驻派发），逐处排除后为零命中 ⇒ 两条回执的 `派发命令` 字段只能是**按登记面重建的命令形**。

**③ 角色日志不可用（E5）**：

```
$ head -1 /Users/chenchiyuan/projects/agents/oamp/.runtime/cluster/pb-dev.log
[2026-09-16T00:47:43.182Z] agent AGENT_START instance=pb-dev role=dev model=deepseek/deepseek-v4-flash tools=on permission=allow approval=yolo role_file=/Users/chenchiyuan/projects/agents/roles/dev/dev.md
$ head -1 /Users/chenchiyuan/projects/agents/oamp/.runtime/cluster/pb-verifier.log
[2026-09-16T00:47:43.352Z] agent AGENT_START instance=pb-verifier role=verifier model=deepseek/deepseek-v4-flash tools=on permission=allow approval=yolo role_file=/Users/chenchiyuan/projects/agents/roles/verifier/verifier.md
```

⇒ 两个日志的首行时间戳均为 `2026-09-16T00:47:43Z`（= 本地 08:47，集群重建时被截断）⇒ **无 20:52 / 20:56 的痕迹**。

**三项效力边界声明**：

1. 回执的 `终态字段`（`state` / `model`）与 `耗时` 来自 **20:52 / 20:56 时点由当时的活体信封记入台账的记录**（登记面判据；`error` / `exit_code` 台账未记录 ⇒ 标「不可得」）；佐证 = ① 的 404 输出与 `calls list` 零命中。
2. `派发命令` 原文未留存，本文所载为**按登记面重建的命令形**（确定项：通道入口 / `--chat-id` / `--agent` / `--model` 取值（实报值回填）/ `--task` 正文（对话留存面）；**不可确定项**：旗标顺序、是否带 `--mode block` / `--wait` / 其它旗标）；佐证 = ② 的穷尽检索。
3. 上述限制**不等于**证据无效：本卡的可核对性由**三面交叉**成立 —— ① 台账 `status.md:62/63` 的活体登记（时点 / `call_id` / 节点 / 终态 / 实报 `model` / 耗时）；② 对话留存的 2 条消息（`meta.task_id` 对上两条 `call_id`，正文即提示词）；③ 配置与代码事实（`<MAIN>/cluster.json` 无 `model` 键 + 该文件提交时点早于探针 + `cluster.js:200-201` 的追加点）。任一面单独不足以支撑回执。

#### 例外通道唯一性（PR 验收 5 / F02 验收 4；消费 pr-008 结论）

**本侧事实（这 2 条带 `--model`）**：

| # | `call_id` | 实报 `model` 原文 | 出处 |
|---|---|---|---|
| ① | `task-bfd83f28-2078-434b-8a16-eac455d2e999`（`pb-dev`） | `openai/gpt-5.6-luna` | `status.md:62` 用途列「**per-call model 例外**」+ §执行方式「模型真源」（`status.md:54`：「正式派发不带 `model`（**探针专用例外已于探针完成后关闭**）」） |
| ② | `task-39204abd-38ab-4971-b785-3eed6b0bb835`（`pb-verifier`） | `powerby/grok-4.6` | `status.md:63` 用途列 + `deferred-demand-changes.md:22`（G-1 证据行：「两条均在 `--model` 显式携带下完成」） |

```
$ sed -n '54p;62p;63p' <WS>/docs/iterations/0028-role-model-binding/status.md
- **模型真源**：角色级（`cluster.json` 的 `roles.<role>.model`）为唯一真源；正式派发不带 `model`（探针专用例外已于探针完成后关闭）
| 20:52 | dev（`pb-dev`） | 前置常驻探针（gpt，per-call model 例外） | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | completed（3607ms） | `openai/gpt-5.6-luna` | false |
| 20:56 | verifier（`pb-verifier`） | 前置常驻探针（grok，同 chat 第二条） | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | completed（4885ms） | `powerby/grok-4.6` | false |
```

**消费 pr-008 的全量结论（不重复核对）**：已合并的 `prs/pr-008-dispatch-contract-audit.md`「真源唯一」块（`#### 真源唯一｜PR 验收 3`，第 150 行起）给出三组 + 汇总结论：

```
$ sed -n '175,177p;181p' <WT>/docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md
| A | 2 条探针（`task-bfd83f28…` / `task-39204abd…`） | **含 `--model`**（per-call 例外） | `status.md:62,63` 用途列 + §执行方式「探针专用例外」 |
| B | 3 条第二集群绑定实报（`call_id` = `task-2eac7142…` / `task-40da0340…` / `task-8589a6a0…`） | **不含 `--model`**（命令原文逐字可核） | `prs/pr-006-second-cluster-binding-evidence.md` 三条「命令」块（逐字）+ 其自证块 `grep -c -- '--model'` = 0 |
| C | 台账其余 **36 行**（38 行 − 2 条探针） | **不含 `--model`**（**登记面判据**，非命令原文逐字核对） | `status.md` §执行方式「模型真源」+ 台账用途列（除第 62 行外零「例外」字样）+ `history.md` 的 25 处 `calls create` 通道记录（`grep -c 'calls create'` = 25） |

**汇总结论（供 pr-004 验收 4 直接引用）**：除去 **2 条探针**（`task-bfd83f28-2078-434b-8a16-eac455d2e999` / `task-39204abd-38ab-4971-b785-3eed6b0bb835`）外，本迭代登记面内**零命中** `--model` ⇒「其余 36 行 + 3 条第二集群实报均不含 `--model`」，模型取值来源唯一 = `cluster.json` 的角色级绑定。**该结论被 pr-004 验收 4 消费。**
```

⇒ 阶段 2~6 全部派发命令中携带 `--model` 的**恰为这 2 条**（A 组）；本 PR **只落盘这一侧**，全量逐条结论与去向归 **pr-008 / F12**（PR 文件验收 5 原文）。

**D0 偏差如实转记（E9）**：`per-call model 例外` 该短语在台账的**字面命中 = 1**（仅 `status.md:62`；第 63 行写作「前置常驻探针（grok，**同 chat 第二条**）」）——而**例外数 = 2**。判据：

```
$ grep -c 'per-call model 例外' <WS>/docs/iterations/0028-role-model-binding/status.md
1
$ grep -c '前置常驻探针' <WS>/docs/iterations/0028-role-model-binding/status.md
2
```

⇒ 第 2 条探针的例外属性由 **G-1 的例外通道定义**（`deferred-demand-changes.md:20-22`：D-14 开例外、范围 = 只覆盖 gpt 与 grok 两条）+ **实报值**（`powerby/grok-4.6`）+ **§执行方式**（`status.md:54`）三者佐证，**非**该短语字面。本 PR **不改写台账、不把上游表述改成「字面命中 2」**（该偏差的首次登记见 pr-008 的 D0，`prs/pr-008-dispatch-contract-audit.md:585`）。

**效力边界继承（T7-4）**：pr-008 的 C 组为**登记面判据**（本迭代未逐条留存派发命令原文）⇒ 本 PR 的结论**不得**超出该边界，**不声称**「命令原文逐字核对通过」。

#### 边界声明与禁令自证（PR 验收 7）

**① 不新建独立探针文件（D-9）**：

```
$ git -C <WT> status --porcelain
?? docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes-tasks.md
?? docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
```

⇒ 未跟踪项仅本 PR 文件 + 本任务图文件；**无任何探针文件/目录**（`prd/F02:16` 原文：「两条探针回执不单独建文件（D-9），落在承载它的 PR 验收证据中」）。

**② 不覆盖 deepseek 的常驻探针（D-15）**：本证据小节**不含** deepseek 的常驻探针回执；`prd/F02:21` 原文：「不覆盖 deepseek 的常驻探针（D-15 明确只做 gpt / grok 两个后端；deepseek 有现行集群持续运行事实 + F01 的一次性回执）」。

**③ 不把该通道保留为长期可用能力（F02 边界）**：`status.md:54` 原文「正式派发不带 `model`（**探针专用例外已于探针完成后关闭**）」；`prd/F02:22` 原文「不修改 per-call `model` 的既有语义（不改任何代码；例外只是一次性的调用参数）；不把该通道保留为长期可用能力」。

**④ 禁令自证（契约 1）**：

| 类别 | 命令 | 次数 | 性质 |
|---|---|---|---|
| 调用面读 | `node <MAIN>/oamp/bin/hub.js api calls get <call_id>` | 2 | 只读（层 A GET） |
| 调用面读 | `node <MAIN>/oamp/bin/hub.js api calls list` | 1 | 只读 |
| 对话面读 | `node <MAIN>/oamp/bin/hub.js api chats get chat-6c89902c-…` | 3 | 只读 |
| 本地读 | `shasum` / `grep` / `sed` / `head` / `awk` / `jq` / `git log\|status\|diff` | 多条 | 只读 |
| **写（hub）** | `calls create` / `messages send` / `projects create` / `cluster up\|down` / **重跑探针** | **0** | **零次** |
| **写（版本控制）** | `git add` / `git commit`（仅本 PR 文件） | 1 次提交 | 唯一写面 |

```
$ node <MAIN>/oamp/bin/hub.js api calls list | jq -r '.calls|length'
24                      # 与 pr-008 执行时点（21 条）相比的增量全部来自主 agent 的后续派发；本 PR 未新增任何调用
$ git -C <WT> diff --name-only b61092a...HEAD
docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
```

⇒ 本 PR 只落盘既有事实、**未产生任何新的运行态副作用**（未重跑探针 ⇒ 阶段 2~6 内携带 `--model` 的调用数**仍为 2**，`--model` 例外通道唯一性未被破坏）。

#### 七条验收标准逐条判定

| # | 验收标准（本 PR 文件原文摘要） | 判定 | 判据 |
|---|---|---|---|
| 1 | 「验收证据」含 2 条探针回执（gpt / grok），每条六字段逐字（`派发命令` 含 per-call `--model` 取值） | **通过** | 「探针回执 · gpt」/「探针回执 · grok」两节，各含六字段（`派发命令` / `call_id` / `终态字段` / `chat_id` / `时点` / `耗时`）；`派发命令` 含 `--model openai/gpt-5.6-luna` / `--model powerby/grok-4.6` |
| 2 | 两条落在两个不同角色节点（`pb-dev` / `pb-verifier`） | **通过** | `sort -u | wc -l` = 2（回执节的节点判据块） |
| 3 | 两条实报 `model` 分别解析到 gpt / grok 后端（MI-3：同一后端 + 原文照录） | **通过** | `openai/gpt-5.6-luna`（`openai/`）/ `powerby/grok-4.6`（`powerby/`），原文照录 |
| 4 | MI-2 事实补记：取证时 `cluster.json` 无任何 `model` 键 | **通过** | `grep -c '"model"'` = 0 + `e6da668 2026-09-11 …` + 工作树干净 + `cluster.js:200-201` 机制链（MI-2 补记节） |
| 5 | 例外通道唯一性：阶段 2~6 携带 `--model` 的恰为这 2 条 | **通过**（本侧事实 + 引用 pr-008 全量结论） | 「例外通道唯一性」节（A 组原文 + pr-008:150/175-177/181 引用 + D0 转记） |
| 6 | 两条探针同属迭代 chat | **通过** | 各命中恰 1 处（`messages[].id` = 64 / 66） |
| 7 | 不新建探针文件 / 不覆盖 deepseek / 非长期能力 | **通过** | 「边界声明与禁令自证」①②③④ |

**效力边界（本 PR 的诚实性约束，三面交叉判据）**：本卡的可核对性由 ① 台账 `status.md:62/63` 活体登记 + ② 对话留存 2 条消息 + ③ 配置与代码事实（`cluster.json` 无 `model` 键、其提交时点早于探针、`cluster.js:200-201` 追加点）三者交叉成立；`派发命令` 为按登记面重建的命令形、`error` / `exit_code` 台账未记录标「不可得」——**均非活体信封复核**（详见「效力边界登记」节）。

**验收手段声明**：本 PR 无套件可跑（仓库无测试套件）——结论以只读命令的原始输出与文件内容核验为准，**不声称**测试全绿。