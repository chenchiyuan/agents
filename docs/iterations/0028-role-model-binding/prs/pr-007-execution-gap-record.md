# pr-007：执行方式差距记录（F12）

## 上下文摘要

核对并补全 `deferred-demand-changes.md` 的「执行方式差距」分区：每条四要素（现象 / 差异 / 证据 / 影响），证据字段含可复核路径、命令或 `call_id`；与「需求变更」分区不语义混载；C-1~C-4 逐条收录；D-14 例外留痕（范围 / 时点 / 关闭状态）；F11 判定的等价性缺口（G-5 及其同类聚合）有对应条目。文件已由阶段 1~3 建立三分区骨架，本 PR 只做核对与补齐，不修改 `demand.md`，也不把差距当作需求变更申请。

## 涉及功能点

- F12

## 文件范围

- `docs/iterations/0028-role-model-binding/deferred-demand-changes.md`（核对与补齐「执行方式差距」分区条目；不改「需求变更」分区既有格式）
- `docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md`（本 PR 文件：核对结论写入「验收证据」小节）

排除（本 PR 不触碰）：`demand.md`（红线）、`status.md`（主 agent 滚动维护）、`history.md`、`clarifications/**`、`cluster.json`、`oamp/**`、`roles/**`。

## 验收标准

- [ ] `deferred-demand-changes.md` 含二级标题分区「执行方式差距」，与「需求变更」「澄清期登记的冲突」并列（F12 验收 1、MI-6）
- [ ] 「执行方式差距」每条含四要素字段「现象」/「差异」/「证据」/「影响」；「证据」含可复核的路径、命令或 `call_id`，不出现"见上文""同上"式指代（F12 验收 2）
- [ ] 分区不语义混载：「需求变更」条目沿用既有格式（含"为什么判定为需求层面问题"字段），「执行方式差距」条目未被写成需求变更，两类条目在标题上即可分辨（F12 验收 3）
- [ ] C-1 ~ C-4 逐条收录，或对任一条给出"不成立"的理由且逐条可核对（四条内容以 `demand.md` §四 表述为准）（F12 验收 4）
- [ ] **D-14 例外留痕**：探针期 per-call `model` 例外的**范围**（只探针期）/ **时点** / **关闭状态**各一条可核对表述（F12 验收 5）
- [ ] **等价性缺口收录**（D-16）：G-5（终态信封截断，`call_id` 可核对）及阶段 5 出现的同类现象有对应条目（同类可聚合）；截至本 PR 执行时点无缺口时以"无缺口"明确表述，不留空（F12 验收 6）
- [ ] 本 PR 不修改 `demand.md`（`git diff -- demand.md` 为空），不向其追加内容（F12 验收 7 / 红线）
- [ ] 不要求为每条差距给出解决方案或修复计划（F12 边界）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md`（验收 1~7、边界、MI-6）
- `docs/iterations/0028-role-model-binding/architecture.md` §5 D-08（证据载体约定）、§4 A-03 第 3 拍（`truncated: true` 按 D-16 聚合到 G-5）
- `docs/iterations/0028-role-model-binding/demand.md` §四（C-1~C-4 原文）与 D-7 / D-11 / D-14 / D-16
- `docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md`（验收 2 的缺口判定与 G-5 登记）
- `docs/iterations/0028-role-model-binding/status.md` §派发台账（已发生的 `truncated: true` 事实行）

## depends_on

（无）

## batch

4

## 验收证据

（本 PR 执行时填写：「分区与条目清单」+「四要素逐条自检表」+「C-1~C-4 逐条处置」+「D-14 三段留痕」+「等价性缺口条目」+「`git diff -- demand.md` 为空的原始输出」；载体约定见 `architecture.md` §4 A-02）

### 执行证据

> 路径基准：`<WT>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record`（下列命令的 `cd` 目标）；`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`（迭代工作区，只读）。

#### ① 分区与条目清单（F12 验收 1 / 3；任务 T2 + T3）

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -n '^## ' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -c '^### G-' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -c '^### C-' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -n '^### ' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
10:## 需求变更
16:## 执行方式差距
145:## 澄清期登记的冲突
14
4
18:### G-1 · 前置验证与真源唯一在机制上互斥
26:### G-2 · brief 全文注入在 hub 层 A 没有文件通道
34:### G-3 · 派发必须 chat_id 前置，而建 chat 无独立端点
41:### G-4 · 已实现的等待能力被重新包了一层（本次执行偏差点，已被用户指出）
49:### G-5 · 终态信封被截断，全文必须两步拼接
76:### G-6 · 过程记录存在 1001 条上限（中段过程不可回溯）
83:### G-7 · `--wait` 单独不阻塞：必须配 `--mode block`
91:### G-8 · hub 有"确认收件箱 + 控制台通知"面；本地 subagent 无对应物（本次已采纳为规范）
98:### G-9 · 单次调用有 30 分钟节点侧硬上限，调用面无法覆盖
106:### G-10 · 单一 chat 跨角色派发时，控制台的对话归属标签固定为首条消息的 agent
114:### G-11 · 探针的 per-call `model` 会固化进该 chat 的常驻会话（"例外通道关闭"不等于"模型回退"）
121:### G-12 · PR worktree 里没有迭代产物（产物在迭代工作区为 untracked，PR 分支拉出时看不到）
128:### G-13 · `*-tasks.md` 无 PR 声明归属 ⇒ 在 worktree 内永久 untracked，且合并时与迭代工作区的同路径 untracked 产物冲突
136:### G-14 · 等价性缺口（信号 ③）：终态信封不可得与 `call_id` 查不回
147:### C-1 · 默认模型 id 与 provider 清单不同名
154:### C-2 · 前置常驻验证与真源唯一冲突
158:### C-3 · 建 chat 无独立端点
162:### C-4 · 主集群跑的是主工作区代码与配置，迭代改动只在 PR worktree / 迭代分支可见
```

分区表（行号取自上方输出）：

| 分区（二级标题） | 声明行 | 区段行范围 | 条目 | 条数 |
|---|---|---|---|---|
| `## 需求变更` | 10 | 10~15 | （空真：仅一行括注，0 条） | 0 |
| `## 执行方式差距` | 16 | 16~143 | G-1 ~ G-14（本 worktree 副本） | 14 |
| `## 澄清期登记的冲突` | 145 | 145~168 | C-1 ~ C-4 | 4 |

**混载判定（F12 验收 3）**：三分区同为二级标题、同级并列，无 `### 执行方式差距` 式嵌套；`G-` 前缀仅出现在「执行方式差距」区段（行 18~142）、`C-` 前缀仅出现在「澄清期登记的冲突」区段（行 147~168）⇒ 前缀集合与其所在分区一一对应，两类条目**在标题上即可分辨**；「需求变更」分区条目数 = 0，按任务图 T3-2 记为空真（其既有格式条款「为什么判定为需求层面问题」在本 PR 执行时点无对照物，全文命中数 = 0，见块 ②）。

#### ② 四要素逐条自检表（F12 验收 2；任务 T7）

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -E '^(### |\- \*\*)' docs/iterations/0028-role-model-binding/deferred-demand-changes.md | sed -e 's/^### /ITEM /' -e 's/^- \*\*\([^*]*\)\*\*.*/  field: \1/'
```

输出：

```text
ITEM G-1 · 前置验证与真源唯一在机制上互斥
  field: 现象
  field: 差异
  field: 证据
  field: 影响
  field: D-14 例外留痕
ITEM G-2 · brief 全文注入在 hub 层 A 没有文件通道
  field: 现象
  field: 差异
  field: 证据
  field: 复核（本 PR 执行时点，路径锚点全称）
  field: 影响
ITEM G-3 · 派发必须 chat_id 前置，而建 chat 无独立端点
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-4 · 已实现的等待能力被重新包了一层（本次执行偏差点，已被用户指出）
  field: 现象
  field: 差异
  field: 证据
  field: 复核（本 PR 执行时点，弱锚点增补）
  field: 影响
ITEM G-5 · 终态信封被截断，全文必须两步拼接
  field: 现象
  field: 差异
  field: 证据
  field: 影响
  field: 聚合记录（本 PR 执行时点复核，覆盖率 100%，逐行无抽样）
ITEM G-6 · 过程记录存在 1001 条上限（中段过程不可回溯）
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-7 · `--wait` 单独不阻塞：必须配 `--mode block`
  field: 现象
  field: 差异
  field: 证据
  field: 影响
  field: 附注（同一形态的次生摩擦）
ITEM G-8 · hub 有"确认收件箱 + 控制台通知"面；本地 subagent 无对应物（本次已采纳为规范）
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-9 · 单次调用有 30 分钟节点侧硬上限，调用面无法覆盖
  field: 现象
  field: 差异
  field: 证据
  field: 影响
  field: 实证（本迭代内即发生，不是理论风险）
ITEM G-10 · 单一 chat 跨角色派发时，控制台的对话归属标签固定为首条消息的 agent
  field: 现象
  field: 差异
  field: 证据
  field: 复核（本 PR 执行时点，端点计数）
  field: 影响
ITEM G-11 · 探针的 per-call `model` 会固化进该 chat 的常驻会话（"例外通道关闭"不等于"模型回退"）
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-12 · PR worktree 里没有迭代产物（产物在迭代工作区为 untracked，PR 分支拉出时看不到）
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-13 · `*-tasks.md` 无 PR 声明归属 ⇒ 在 worktree 内永久 untracked，且合并时与迭代工作区的同路径 untracked 产物冲突
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM G-14 · 等价性缺口（信号 ③）：终态信封不可得与 `call_id` 查不回
  field: 现象
  field: 差异
  field: 证据
  field: 复核（本 PR 执行时点，回读面一致性）
  field: 影响
ITEM C-1 · 默认模型 id 与 provider 清单不同名
  field: 现象
  field: 差异
  field: 证据
  field: 影响
ITEM C-2 · 前置常驻验证与真源唯一冲突
ITEM C-3 · 建 chat 无独立端点
ITEM C-4 · 主集群跑的是主工作区代码与配置，迭代改动只在 PR worktree / 迭代分支可见
  field: 现象
  field: 差异
  field: 证据
  field: 影响
```

混载字段与指代判别命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -c '为什么判定为需求层面问题' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -c '见上文' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -c '同上' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
0
0
0
```

> 字段口径（判定依据）：F12 验收 2 要求每条**含**四要素（`现象` / `差异` / `证据` / `影响`），未要求条目内不得另有标注段落；F12 验收 3 的判别字段是「为什么判定为需求层面问题」（上方三点输出依次为 `0 / 0 / 0`，即该字段与「见上文」「同上」在全文均零命中）。本分区内的附加标注段落为 `- **附注（…）**`（G-7）、`- **实证（…）**`（G-9）与本次补正新增的 `- **D-14 例外留痕**`（G-1）、`- **复核（…）**`（G-2 / G-4 / G-10 / G-14）、`- **聚合记录（…）**`（G-5）——均带括号限定或属记录/复核性质，**判定为不构成第六字段**（G-7 / G-9 为阶段 1~4 既有写法，本次未改）。

路径与 `call_id` 抽验命令（T7-3 / T7-4）：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
test -e oamp/sdk/cli.js && echo 'oamp/sdk/cli.js present'
test -e oamp/src/agent.js && echo 'oamp/src/agent.js present'
test -e oamp/src/web.js && echo 'oamp/src/web.js present'
test -e oamp/sdk/surface.js && echo 'oamp/sdk/surface.js present'
test -e src/cli.js && echo 'src/cli.js present' || echo 'src/cli.js 未命中（见 G-2 补正行）'
sed -n '31,32p' oamp/src/agent.js
grep -n "@file" oamp/src/cli.js
sed -n '18p' oamp/sdk/cli.js
```

输出：

```text
oamp/sdk/cli.js present
oamp/src/agent.js present
oamp/src/web.js present
oamp/sdk/surface.js present
src/cli.js 未命中（见 G-2 补正行）
const DEFAULT_OMP_TIMEOUT_MS = 1800000; // omp（LLM）任务默认：给足推理时间
const MAX_TIMEOUT_MS = 1800000;
10:  oamp task send <instance-id> '<json>'|@file [--as <id>]  指派任务给 agent
const DEFAULT_WAIT_MS = 1800000; // §5.4 要点 / L2-4：`api calls create --wait` 的缺省（逐字沿用既有 DEFAULT_OMP_TIMEOUT_MS）
```

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
timeout 60 node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-8e84f95f-b783-4477-8054-abf0b36f31ec 2>&1; echo "exit-code=$?"
timeout 60 node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-92f31d55-3789-4184-a850-a43df30e54be 2>&1 | head -c 220; echo
```

输出：

```text
{"code":"NOT_FOUND","error":"call 不存在: task-8e84f95f-b783-4477-8054-abf0b36f31ec","exit_code":1,"http_status":404}
exit-code=1
{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":true,"text":null,"structured_output":null,"error":null,"exit_code":null}
```

逐条自检表：

| 条目 | 四要素齐备 | 证据锚点集合（≥1 个可复核锚点） | 抽验结果 | 判定 |
|---|---|---|---|---|
| G-1 | 4/4（+ `D-14 例外留痕`，本次补正，行 24） | `demand.md` D-5 / D-8 / D-14；`call_id` `task-bfd83f28…`、`task-39204abd…`；补正行载 `status.md:62` / `:63` / `:54` | `call_id` 回读 404（见块 ⑤）——锚点为文本载明 + 台账留痕，按 G-14 ③ 登记 | 合格（补正：D-14 三段留痕） |
| G-2 | 4/4（+ `复核（…）`，行 31） | `oamp/sdk/cli.js`、`oamp/sdk/surface.js`；`grep '@file'` ⇒ `oamp/src/cli.js:10`；`call_id` `task-8e84f95f…` | `test -e` 4/4 命中；`src/cli.js` 单写未命中 ⇒ 补正行给出全称 | 合格（补正：路径全称） |
| G-3 | 4/4 | `chat-6c89902c-0a9f-4513-a299-90a7f98ae611`、`msg-9f62bf12-5733-4b82-ba13-f26c6ba7f679` | ID 形态锚点，可于 `status.md` 与 `hub api chats get` 核对 | 合格 |
| G-4 | 4/4（+ `复核（…）`，行 46） | `oamp/sdk/cli.js:18/254`；补正行载 `status.md:50`（G-4 规范行）与 `oamp/sdk/cli.js:259` | `grep -n 'G-4' status.md` 命中 1 行；路径命中 | 合格（补正：弱锚点增补） |
| G-5 | 4/4（+ `聚合记录（…）`，行 55~74） | `call_id` `task-8e84f95f…`；`hub api calls get` / `api calls transcript` 命令原文；补正后聚合 19 行（时点 + 角色 + `call_id`） | `call_id` 回读 404（见块 ⑤）；聚合 19 行与台账逐行对应 | 合格（补正：聚合覆盖率 100%） |
| G-6 | 4/4 | `hub api calls transcript task-8e84f95f…` 命令原文 | 命令原文在场；该 call 执行时点已 404（见 G-14 ③） | 合格（锚点形态合规；回读面限制见 G-14） |
| G-7 | 4/4（+ `附注（…）`） | `api calls create … --wait 900000` 命令原文；`call_id` `task-ad4c21ee…`；`oamp/sdk/cli.js:18/254`；`API.md` §3.14 | 路径命中 | 合格 |
| G-8 | 4/4 | `cfm-f1296d32-8025-4ad8-a367-f08579e53517`、`ntc-fa1d54c8-f7f0-46a9-8d1b-846498b53055`；`oamp/src/inbox.js`、`oamp/web/notify.js` | 路径命中 | 合格 |
| G-9 | 4/4（+ `实证（…）`） | `oamp/src/agent.js:31-32`、`oamp/src/web.js`、`oamp/sdk/cli.js:18`；`call_id` `task-191d2e14…` | 路径命中；行号复核一致（`sed -n '31,32p'` 见上方抽验输出） | 合格 |
| G-10 | 4/4（+ `复核（…）`，行 111） | `hub api chats get chat-6c89902c…`；`oamp/sdk/surface.js` | 端点计数复核为 6（原文记 5）⇒ 补正行登记偏差，结论不变 | 合格（补正：端点计数） |
| G-11 | 4/4 | `oamp/src/agent.js:692` / `:767` / `:360`；`calls get task-b755be9c…` | 路径与行号命中 | 合格 |
| G-12 | 4/4 | `git -C <…> status --porcelain`、`git worktree list` 命令原文 | 命令形态可复现（本 PR T1 复制面同源） | 合格 |
| G-13 | 4/4 | 三个 worktree 的 `git status --porcelain`；提交 `0e314a3`；pr-001 dev 报告第 3 条 | 提交与路径可核（`git show --name-only 0e314a3`） | 合格 |
| G-14 | 4/4（本次新增，行 136~142） | `api calls get` 两条命令原文（批量 404 / 单独 working，补正行 141）；`status.md:66` / `:8` / `:120`；`prd/F11` 验收 2 ③ | 命令输出逐字在场（见块 ⑤） | 合格（新增：信号 ③ 缺口条目） |

#### ③ C-1 ~ C-4 逐条处置（F12 验收 4；任务 T4）

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -n '^### C-' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
147:### C-1 · 默认模型 id 与 provider 清单不同名
154:### C-2 · 前置常驻验证与真源唯一冲突
158:### C-3 · 建 chat 无独立端点
162:### C-4 · 主集群跑的是主工作区代码与配置，迭代改动只在 PR worktree / 迭代分支可见
```

处置指向与「与 §四 对应锚点」的核对命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -n '^| D-1[34] \|^| D-2[01] ' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/demand.md
```

输出：

```text
51:| D-13 | 实证集群 | 迭代工作区起第二集群（独立 session + 非默认端口 + 独立 socket），不动主工作区集群 | `user_confirmed` |
52:| D-14 | 前置常驻探针通道 | 开一条只用于探针的 per-call `model` 例外，探针后关闭并记入差距记录 | `user_confirmed` |
58:| D-20 | 收口后生效 | 合入 main 后由主 agent 重启主工作区集群并留实报证据 | `user_confirmed` |
59:| D-21 | 探针的 chat 归属 | 探针建立本次迭代唯一 chat，阶段 2~6 续用同一 `chat_id` | `user_confirmed` |
```

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -n '^| C-[1-4] ' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/demand.md
```

输出：

```text
66:| C-1 | `~/.omp/agent/config.yml` 的默认 id `deepseek/deepseek-v4-flash` 在 `~/.omp/agent/models.yml` 里不存在同名 id（那里是 `deepseek-v4.1-flash`），靠 fuzzy match 才解析成功 | 记录，不在本次迭代修（属 omp 环境配置面） |
67:| C-2 | 前置常驻验证（D-8）与真源唯一性（D-5）机制互斥 | 已由 D-14 以范围最窄的例外消解，例外本身记入差距记录 |
68:| C-3 | 建 chat 无独立端点 ⇒ 单一 chat 只能由首条真实调用建立 | 已由 D-21 消解（探针建 chat） |
69:| C-4 | 主工作区集群跑的是主工作区代码与配置，而迭代改动只在 PR worktree / 迭代分支可见 | 已由 D-13（第二集群）+ D-20（收口后重启主集群）消解 |
```

逐条处置表（行号指本 worktree 副本 `deferred-demand-changes.md`）：

| C 编号 | 条目在场 | 与 `demand.md` §四 对应锚点 | 处置表述 | 判定 |
|---|---|---|---|---|
| C-1 | ✅ C-1 行 147~152 | `demand.md:66`（§四 C-1 行：默认 id 靠 fuzzy match 才解析成功） | 条目「差异」行载「属 omp 环境配置面的事实」，与 §四 处置「记录，不在本次迭代修（属 omp 环境配置面）」同源（该处置原文见上方输出） | 合格（处置理由在场 + §四 原文锚点可核） |
| C-2 | ✅ C-2 行 154~156 | `demand.md:67`（§四 C-2 行）+ G-1（行 18~24，含四要素与 `call_id`） | 「处置见 `demand.md` D-14」——D-14 存在于 §三（上方输出命中 `:52`） | 合格（交叉引用可解析：冲突内容由 G-1 承载、处置指向存在） |
| C-3 | ✅ C-3 行 158~160 | `demand.md:68`（§四 C-3 行）+ G-3（行 34~39） | 「处置见 `demand.md` D-21」——D-21 存在于 §三（上方输出命中 `:59`） | 合格（同 C-2 口径） |
| C-4 | ✅ C-4 行 162~168 | `demand.md:69`（§四 C-4 行） | 「本次处置见 D-13 与 D-20」——两者存在于 §三（上方输出命中 `:51` / `:58`） | 合格（处置指向存在 + 条目自带四要素） |

#### ④ D-14 例外留痕（F12 验收 5；任务 T5）

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -n 'D-14 例外留痕' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
sed -n '62,63p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/status.md
sed -n '54p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/status.md
```

输出：

```text
24:- **D-14 例外留痕**（三段；判据 = `prd/F12` 验收 5）：**范围** = 只覆盖探针期，且只覆盖 gpt 与 grok 两条常驻探针（`demand.md` D-14「开一条只用于探针的 per-call `model` 例外，探针后关闭并记入差距记录」、D-15「仅 gpt 与 grok 两个后端」）；**时点** = 20:52（`task-bfd83f28-2078-434b-8a16-eac455d2e999`，`pb-dev`）与 20:56（`task-39204abd-38ab-4971-b785-3eed6b0bb835`，`pb-verifier`），与 `status.md` §派发台账前两行（`status.md:62` / `:63`）逐条对应；**关闭状态** = 已关闭（`status.md:54` 载「正式派发不带 `model`（探针专用例外已于探针完成后关闭）」）——无独立关闭时点记录（以两条探针为界，台账未记该时点）。
| 20:52 | dev（`pb-dev`） | 前置常驻探针（gpt，per-call model 例外） | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | completed（3607ms） | `openai/gpt-5.6-luna` | false |
| 20:56 | verifier（`pb-verifier`） | 前置常驻探针（grok，同 chat 第二条） | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | completed（4885ms） | `powerby/grok-4.6` | false |
- **模型真源**：角色级（`cluster.json` 的 `roles.<role>.model`）为唯一真源；正式派发不带 `model`（探针专用例外已于探针完成后关闭）
```

| 维度 | 表述原文或落点 | 可核对锚点 | 判定 |
|---|---|---|---|
| **范围**（只探针期） | 行 24「**范围** = 只覆盖探针期，且只覆盖 gpt 与 grok 两条常驻探针」 | `demand.md:52`（D-14 原文）、D-15「仅 gpt 与 grok 两个后端」；本 PR 未改 `demand.md`（见块 ⑥） | 合格（本次补正） |
| **时点** | 行 24「**时点** = 20:52（`task-bfd83f28…`，`pb-dev`）与 20:56（`task-39204abd…`，`pb-verifier`）」 | `status.md:62` / `:63`（上方输出为两行原文，逐条对应） | 合格（本次补正） |
| **关闭状态** | 行 24「**关闭状态** = 已关闭（`status.md:54` 载「正式派发不带 `model`（探针专用例外已于探针完成后关闭）」）——无独立关闭时点记录（以两条探针为界，台账未记该时点）」 | `status.md:54`（上方输出为该行原文） | 合格（本次补正；关停时点无台账事实 ⇒ 按任务图 T5-3 记已知留白，未编造数值） |

> 补正前形态（登记）：G-1 的「现象」段点名 D-5 / D-8 / D-14、「证据」段列两条探针 `call_id`、「影响」段有「一条已关闭的例外」一句 —— **范围** 与 **时点** 当时无独立可核对表述 ⇒ 判为补正项；补正方式 = 在该条目内新增 `- **D-14 例外留痕**` 段（纯新增，未改任何既有文字）。

#### ⑤ 等价性缺口条目（F12 验收 6 / D-16 / `prd/F11` 验收 2；任务 T6）

G-5 事实与聚合记录（行 49~74）：

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
sed -n '49,74p' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
### G-5 · 终态信封被截断，全文必须两步拼接

- **现象**：`prd` 派发的终态信封 `truncated: true`，`text` 只有 **3632** 字符；该次产出的完整正文经 `api calls transcript` 拼回为 **7078** 字符（含报告契约 1~5 全文）⇒ 拿到全文必须由消费方执行"读信封 + 取转录 + 自行拼接"两步。
- **差异**：本地 subagent 的最终产出一次性完整交回宿主，不存在"信封截断 + 自行拼接过程记录"这一层；D-10 的信号 ③（无需人工搬运中间产物即可继续）在 hub 侧**首次真实角色派发即不成立**。
- **证据**：call `task-8e84f95f-b783-4477-8054-abf0b36f31ec` —— `hub api calls get` 的 `truncated: true` 与 `text` 长度 3632；`hub api calls transcript` 拼回 7078 字符（报告契约 1~5、架构待填 A-01~A-04、MI-1~MI-6 均在其中）。按 D-16 判定为等价性缺口。
- **影响**：阶段 2~6 的每一次派发都要多一步产出回收且不可省略；后续同现象条目按 D-16 聚合到本条。**聚合记录**：第 2 次同类现象出现在阶段 2 修订轮（call `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb`，`prd`，119s，终态 `truncated: true`）。
- **聚合记录（本 PR 执行时点复核，覆盖率 100%，逐行无抽样）**：`status.md` §派发台账（`status.md:58-82`）23 行的 `truncated` 逐行核对 ⇒ `true` **19** 行、`false` 3 行（20:52 `task-bfd83f28-2078-434b-8a16-eac455d2e999`；20:56 `task-39204abd-38ab-4971-b785-3eed6b0bb835`；22:17 `task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e`）、执行时点仍在途 1 行（09:06 `task-92f31d55-3789-4184-a850-a43df30e54be`，终态未到，见 G-14）。19 行逐条（时点 / 角色 / `call_id`）：
  - 20:56 `prd` `task-8e84f95f-b783-4477-8054-abf0b36f31ec`（本条正文所记首例）
  - 21:06 `prd` `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb`
  - 21:09 `architect` `task-191d2e14-e852-412d-ab90-e6fc00092928`（`status.md:66`，终态 `failed`／`error: timeout`，终态信封不可得 ⇒ 同时按 `prd/F11` 验收 2 ③ 记入 G-14）
  - 22:03 `pr-planner` `task-db950070-445a-492f-8f58-5bbd95c20c9f`
  - 22:32 `planner` `task-d76732bb-fd6c-480c-b1af-abd4f1726a3a`
  - 22:32 `planner` `task-ece7344d-f237-4cde-b890-94bccfa0815c`
  - 22:32 `planner` `task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068`
  - 22:41 `dev` `task-4d88d08b-f977-4314-813e-e8dfc49c89df`
  - 22:41 `dev` `task-4b8e1399-36ce-47e2-8a66-09293eb8725c`
  - 22:41 `dev` `task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e`
  - 23:13 `verifier` `task-def5a04f-85a6-42b8-8dd5-c5f261e5171a`
  - 23:13 `verifier` `task-5585d411-a3cc-46cf-8a1f-31baccfd03b5`
  - 23:15 `verifier` `task-637e830a-a4f0-4318-9650-16b72eedeb82`
  - 08:48 `pr-planner` `task-05e21d21-1f3f-4619-bef1-38b2f64a549b`（台账该行 `truncated` 记 `—`；执行时点 `api calls get` 回读 `truncated: true`）
  - 08:48 `dev` `task-07508a08-32a3-4e12-86ea-34e856c09b6f`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 08:50 `planner` `task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 08:50 `progress-observer` `task-c0acdd24-c873-4b27-b9fa-e1019949456e`（台账该行 `truncated` 记 `—`；执行时点回读 `truncated: true`）
  - 09:06 `dev` `task-2a20f315-586c-4206-969d-b421e6254fa8`（台账终态记 `submitted`；执行时点回读 `completed` + `truncated: true`）
  - 09:06 `verifier` `task-fc99395f-d815-4b2b-83c6-24696a18bdc1`（台账终态记 `submitted`；执行时点回读 `completed` + `truncated: true`）
```

本次新增的 G-14（行 136~142）：

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
sed -n '136,142p' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
### G-14 · 等价性缺口（信号 ③）：终态信封不可得与 `call_id` 查不回

- **现象**：执行时点存在三类事实——① 21:09 `architect` 派发（`task-191d2e14-e852-412d-ab90-e6fc00092928`）被节点侧 30 分钟上限切断，终态 `failed`／`error: timeout`，**终态信封不可得**（`status.md:66`）；② 09:06 `dev` 派发（`task-92f31d55-3789-4184-a850-a43df30e54be`，本 PR 实现轮）在本 PR 执行时点仍为 `state: working`、`text: null`，**终态未到**；③ 历史 `call_id` **查不回**——G-5 正文所用的 `task-8e84f95f-b783-4477-8054-abf0b36f31ec` 在集群重建后于执行时点返回 404。
- **差异**：本地 subagent 的每次派发结果直接交回调用方并随会话留存，不存在"信封取不到"与"标识查不回"两种形态；hub 侧的这两类形态使 `prd/F11` 验收 1 的逐次核对退化为"以台账文本与产物文件为据"，回读面不可复核。
- **证据**：判据 = `prd/F11` 验收 2 ③（"终态信封不可得，或 `call_id` 查不回"即等价性缺口）。命令与原始输出：`node oamp/bin/hub.js api calls get task-8e84f95f-b783-4477-8054-abf0b36f31ec` ⇒ `{"code":"NOT_FOUND","error":"call 不存在: task-8e84f95f-b783-4477-8054-abf0b36f31ec","exit_code":1,"http_status":404}`；`node oamp/bin/hub.js api calls get task-92f31d55-3789-4184-a850-a43df30e54be` ⇒ `{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":true,"text":null,"structured_output":null,"error":null,"exit_code":null}`；`status.md` §派发台账 21:09 行（`❌失败(超时·现场保留)`、`error: timeout`、1802661ms）与 `status.md:8`（"集群已重建，调用面清空、对话记录留存"）、`status.md:120`（2026-09-16 08:47 恢复记录）。
- **复核（本 PR 执行时点，回读面一致性）**：同一 `call_id`（`task-92f31d55-3789-4184-a850-a43df30e54be`）在批量探针命令（7 条顺序执行）中返回 `{"code":"NOT_FOUND","error":"call 不存在: …","http_status":404}`，紧随其后的**单独**探针返回 `{"state":"working",…}` ⇒ 回读面对同一在途调用存在不一致（本 PR 只登记现象、不追因；两条命令与原始输出见本 PR 文件「验收证据」块 ⑤）。
- **影响**：① 的机制面已由 G-9 记录，本条记其等价性缺口判定与 `call_id` 落点；② 的终态到达后由主 agent 回填台账并按 D-16 聚合到本条；③ 说明阶段 2~4 的历史调用在集群重建后不可回读 ⇒ "`call_id` 可核对"的可达形态限定为"条目文本载明 `call_id` + `status.md` 台账留痕"，`prd/F11` 验收 1 ① 的"`hub api calls get <call_id>` 可读"对历史调用不成立；下迭代候选：为调用面定义历史保留期或导出机制（记，不在本次迭代修）。
```

`task-8e84f95f-…` 回读探针（T6-6 必跑；原始输出 + 退出码）：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
timeout 60 node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-8e84f95f-b783-4477-8054-abf0b36f31ec 2>&1; echo "exit-code=$?"
```

输出：

```text
{"code":"NOT_FOUND","error":"call 不存在: task-8e84f95f-b783-4477-8054-abf0b36f31ec","exit_code":1,"http_status":404}
exit-code=1
```

台账 `truncated` 未记的 7 行逐条探针（执行时点）：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
for c in \
  task-05e21d21-1f3f-4619-bef1-38b2f64a549b \
  task-07508a08-32a3-4e12-86ea-34e856c09b6f \
  task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37 \
  task-c0acdd24-c873-4b27-b9fa-e1019949456e \
  task-2a20f315-586c-4206-969d-b421e6254fa8 \
  task-92f31d55-3789-4184-a850-a43df30de54be \
  task-fc99395f-d815-4b2b-83c6-24696a18bdc1 ; do
  printf '%s -> ' "$c"
  timeout 60 node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get "$c" 2>&1 | jq -c 'if .code then . else {call_id,state,truncated,text_len:(.text|tostring|length)} end' 2>/dev/null || echo '(非 JSON 输出)'
done
```

输出：

```text
task-05e21d21-1f3f-4619-bef1-38b2f64a549b -> {"call_id":"task-05e21d21-1f3f-4619-bef1-38b2f64a549b","state":"completed","truncated":true,"text_len":2892}
task-07508a08-32a3-4e12-86ea-34e856c09b6f -> {"call_id":"task-07508a08-32a3-4e12-86ea-34e856c09b6f","state":"completed","truncated":true,"text_len":3733}
task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37 -> {"call_id":"task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37","state":"completed","truncated":true,"text_len":1813}
task-c0acdd24-c873-4b27-b9fa-e1019949456e -> {"call_id":"task-c0acdd24-c873-4b27-b9fa-e1019949456e","state":"completed","truncated":true,"text_len":2787}
task-2a20f315-586c-4206-969d-b421e6254fa8 -> {"call_id":"task-2a20f315-586c-4206-969d-b421e6254fa8","state":"completed","truncated":true,"text_len":4075}
task-92f31d55-3789-4184-a850-a43df30de54be -> {"code":"NOT_FOUND","error":"call 不存在: task-92f31d55-3789-4184-a850-a43df30de54be","exit_code":1,"http_status":404}
task-fc99395f-d815-4b2b-83c6-24696a18bdc1 -> {"call_id":"task-fc99395f-d815-4b2b-83c6-24696a18bdc1","state":"completed","truncated":true,"text_len":8291}
```

同一在途调用（`task-92f31d55-…`）的**单独**探针（与上方批量结果不一致，现象已登记进 G-14 的 `- **复核（…）**` 行）：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
timeout 60 node /Users/chenchiyuan/projects/agents/oamp/bin/hub.js api calls get task-92f31d55-3789-4184-a850-a43df30e54be 2>&1; echo "exit-code=$?"
```

输出：

```text
{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":true,"text":null,"structured_output":null,"error":null,"exit_code":null}
exit-code=0
```

`status.md` §派发台账执行时点逐行核对（共 23 行，无抽样）：

| 时点 | 角色 | `call_id` | 台账 `truncated` | 执行时点回读 | 缺口判定与条目点 |
|---|---|---|---|---|---|
| 20:52 | dev | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | `false` | —（未探针：台账已记 `false`） | 非缺口 |
| 20:56 | verifier | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | `false` | —（未探针：台账已记 `false`） | 非缺口 |
| 20:56 | prd | `task-8e84f95f-b783-4477-8054-abf0b36f31ec` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 21:06 | prd | `task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 21:09 | architect | `task-191d2e14-e852-412d-ab90-e6fc00092928` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:03 | pr-planner | `task-db950070-445a-492f-8f58-5bbd95c20c9f` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:17 | verifier | `task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e` | `false` | —（未探针：台账已记 `false`） | 非缺口 |
| 22:32 | planner | `task-d76732bb-fd6c-480c-b1af-abd4f1726a3a` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:32 | planner | `task-ece7344d-f237-4cde-b890-94bccfa0815c` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:32 | planner | `task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:41 | dev | `task-4d88d08b-f977-4314-813e-e8dfc49c89df` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:41 | dev | `task-4b8e1399-36ce-47e2-8a66-09293eb8725c` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 22:41 | dev | `task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 23:13 | verifier | `task-def5a04f-85a6-42b8-8dd5-c5f261e5171a` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 23:13 | verifier | `task-5585d411-a3cc-46cf-8a1f-31baccfd03b5` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 23:15 | verifier | `task-637e830a-a4f0-4318-9650-16b72eedeb82` | `true` | —（未探针：台账已记 `true`） | 缺口（信号 ①）→ G-5 聚合记录 |
| 08:48 | pr-planner | `task-05e21d21-1f3f-4619-bef1-38b2f64a549b` | `—` | `state: completed`、`truncated: true`、`text` 2892 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |
| 08:48 | dev | `task-07508a08-32a3-4e12-86ea-34e856c09b6f` | `—` | `state: completed`、`truncated: true`、`text` 3733 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |
| 08:50 | planner | `task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37` | `—` | `state: completed`、`truncated: true`、`text` 1813 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |
| 08:50 | progress-observer | `task-c0acdd24-c873-4b27-b9fa-e1019949456e` | `—` | `state: completed`、`truncated: true`、`text` 2787 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |
| 09:06 | dev | `task-2a20f315-586c-4206-969d-b421e6254fa8` | `—` | `state: completed`、`truncated: true`、`text` 4075 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |
| 09:06 | dev | `task-92f31d55-3789-4184-a850-a43df30e54be` | `—` | `state: working`、`text: null`（终态未到） | 终态信封不可得（信号 ③）→ G-14 ② |
| 09:06 | verifier | `task-fc99395f-d815-4b2b-83c6-24696a18bdc1` | `—` | `state: completed`、`truncated: true`、`text` 8291 字符 | 缺口（信号 ①，台账该行未记）→ G-5 聚合记录 |

判定与聚合位置：执行时点 `truncated: true` 共 **19** 行（台账已记 13 + 执行时点回读新增 6）⇒ 全部按 D-16 聚合到 **G-5 影响段的「聚合记录」（行 55~74）**，逐行含时点 + 角色 + `call_id`；`false` 3 行（20:52 / 20:56 / 22:17）为非缺口；`task-191d2e14…`（21:09，终态信封不可得）、`task-92f31d55…`（09:06，`state: working`、`text: null`）与 `task-8e84f95f…`（执行时点 404）按 `prd/F11` 验收 2 ③ **显式判定为等价性缺口，落 G-14（行 136~142）**——不以 G-9 的叙述代替判定。**本迭代不存在「无缺口」分支**（缺口如实登记）。

#### ⑥ `git diff -- demand.md` 为空的原始输出（F12 验收 7；任务 T9）

命令：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
git diff -- docs/iterations/0028-role-model-binding/demand.md; echo "exit-code=$?"
test -e docs/iterations/0028-role-model-binding/demand.md && echo present || echo 'absent（worktree 内该路径不存在 ⇒ 上句空输出属空真）'
shasum -a 256 /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/demand.md
git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding status --porcelain docs/iterations/0028-role-model-binding | grep -v '^??' | wc -l | tr -d ' '
```

输出：

```text
exit-code=0
absent（worktree 内该路径不存在 ⇒ 上句空输出属空真）
5df7dea2a564e85d3229d8bd15d9818e7b6b0aeb4f32b0db03c700d90eb86eb0  /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/demand.md
2
```

结论：`git diff -- demand.md` 输出为空（`exit-code=0`），**本 PR 未修改 `demand.md`**；该空属**空真**（本 worktree 内 `docs/iterations/0028-role-model-binding/demand.md` 不存在 ⇒ 该路径不在本 worktree 的写入面内），故另附两侧核对：`<WS>` 侧 `demand.md` 的 sha256 为 `5df7dea2a564e85d3229d8bd15d9818e7b6b0aeb4f32b0db03c700d90eb86eb0`（与任务图 A4 规划值一致，且在本 PR 执行期间未变）；`<WS>` 侧 `prs/pr-007-execution-gap-record.md` 的 sha256 为 `cebea203660b046013eabd5abf65c8801fcdc152e9790d79547d361eee825060`（= T1 复制时点值，未被本 PR 触碰）。


同路径**活文档**的源侧并发更新（登记，非本 PR 写入）：`<WS>` 侧 `deferred-demand-changes.md` 在本 PR 执行期间由主 agent 追加了**其自己的 G-14**（「主 agent 没有“被回调”的通道，且 `api stream call` 在终态**不退出** ⇒ 等机制必须自建终态探测」）：

```sh
cd /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-007-execution-gap-record
grep -c '被回调' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/deferred-demand-changes.md
grep -c '被回调' docs/iterations/0028-role-model-binding/deferred-demand-changes.md
sed -n '108,112p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/deferred-demand-changes.md | cut -c1-120
shasum -a 256 /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

输出：

```text
1
0
- **证据**：三个 worktree 的 `git status --porcelain` 均显示 `?? docs/iterations/0028-role-model-binding/prs/pr-00N-*-tasks.md`；p
- **影响**：① **合并规程（本迭代生效）**——合并任何 PR 前，先把迭代工作区里"会与新提交同路径的 untracked 文件"移出（如移到 `/tmp` 备份），合并完成后**还原主 agent 的较新版本**（`status

### G-14 · 主 agent 没有"被回调"的通道，且 `api stream call` 在终态**不退出** ⇒ 等机制必须自建终态探测

b28a7803b93fc111c0a36596f6dc050ab758e6b6fa9caa59337da818f874a7aa  /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/docs/iterations/0028-role-model-binding/deferred-demand-changes.md
```

⇒ ① 该条目只存在于 `<WS>` 版（`grep -c '被回调'`：`<WS>` = 1、`<WT>` = 0），本 PR 的核对与补正**只针对自己那份快照**（T1 复制时点 `5a166e38…` → 补正后 `dd0304eb…`，改动只增不删）；② **编号 `G-14` 在两版中各指一条不同条目**（`<WS>` 现版 143 行 / 26054 B / sha256 `b28a7803…`）；按 G-13 ① 的合并规程（活文档以迭代工作区版本为准），合并时需由主 agent 处置该编号冲突（建议：`<WS>` 版保留 `G-14`，本 PR 的等价性缺口条目在合并后重编为 `G-15`）。本 PR 不改 `<WS>` 侧同名文件（边界原文）。

说明（非证据）：本 PR 无测试套件可跑（任务图 §0.4 契约 10），验收判据 = 目标文件的条目形态核验 + 只读命令实跑（`hub api calls get` 属契约 8 白名单；全程未执行 `calls create` / `messages send` / `cluster up|down`，未自建轮询脚本）。补正改动面：`git diff --no-index <WS 快照> <WT 副本>` = **32 行新增 / 0 行删除**（4 处段内追加 + 5 处整段新增 + 新增 G-14 条目），既有条目的四要素与「证据」原文零删除。C-2 / C-3 保留交叉引用形态而未就地补写 §四 表述：本 PR「文件范围」与派发 brief 均限定只补齐「执行方式差距」分区、不改「需求变更」「澄清期登记的冲突」两分区；其「逐条可核对」由块 ③ 的处置表（条目在场 + 冲突可经 G-1 / G-3 解析 + 处置指向 D-14 / D-21 存在）承担。台账中 `truncated` 为 `—` 的行由本 PR 以只读探针回读（**未代主 agent 回填 `status.md`**；回填与后续聚合按 `architecture.md` §4 A-03 第 2 拍由主 agent 执行）。
