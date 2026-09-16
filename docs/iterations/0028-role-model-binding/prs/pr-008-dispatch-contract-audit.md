# pr-008：全量派发契约核对（F09/F10/F11）

## 上下文摘要

把阶段 2~6 的每一次角色派发按三条契约逐条核对并落证：通道与寻址（全部经 `hub api calls create`、`--agent <role>` → `pb-<role>`）、真源唯一（除 F02 的 2 条探针外派发命令不带 `--model`）、chat 归属（阶段 2~6 全部 `call_id` 同属迭代 chat；第二集群三条实报彼此同属其自己的 chat）、等价性三信号（`call_id` 可读 / 终态信封可得 / 产出可无人工搬运拼回全文）与并发取证（阶段 5 首次派发同轮 ≥2 条）。本 PR 只读核对 + 落证，不写 `status.md`。

## 涉及功能点

- F09
- F10
- F11

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md`（本 PR 文件：核对结论写入「验收证据」小节）

排除（本 PR 不触碰，仅只读核对）：`status.md`（「派发台账」的滚动维护归主 agent，见 `architecture.md` §4 A-03；其收口登记归 pr-010/工作流）、`deferred-demand-changes.md`（pr-007）、`cluster.json`（pr-002）、`cluster.second.json`（pr-005）、`oamp/**`、`roles/**`。

## 验收标准

- [ ] **通道（F09 验收 1）**：本 PR 执行时点可枚举的全部角色派发逐一有 `call_id`，且对应调用经 `hub api calls get` 可读；台账无"实际发生过但无 `call_id`"的角色派发（本地子代理不产生 `call_id`，覆盖全量即排除本地派发路径）
- [ ] **寻址（F09 验收 2）**：每条调用的 `agent` 字段等于角色名（对应实例 `pb-<role>`），不出现 `null`
- [ ] **真源唯一（F09 验收 3）**：台账登记的全部派发命令中，除 F02 的 2 条探针外不含 `--model`；逐条的"命令形态"核对结论在此列明（该结论同时被 pr-004 验收 4 消费）
- [ ] **台账可核对（F09 验收 4 / F10 验收 1）**：`status.md`「派发台账」七列（时点 / 角色（节点）/ 用途 / `call_id` / 终态 / 实报 `model` / `truncated`）逐行与调用面一致——`call_id` 查得回、`终态`/`实报 model`/`truncated` 三列与信封 `state`/`model`/`truncated` 原文一致；第二集群三条实报行在 `用途` 列注明"第二集群绑定实报"
- [ ] **chat 归属（F10 验收 1）**：阶段 2~6 的全部 `call_id` 均可在 `hub api chats get chat-6c89902c-0a9f-4513-a299-90a7f98ae611` 的 `messages[].meta.task_id` 中找到，不存在归属其它 chat 的阶段 2~6 派发；该 chat 的首条调用为常驻探针（F10 验收 3）；chat 内无需求收敛阶段的派发（F10 验收 5）；`status.md` 记录的 `chat_id` 与该 chat 一致（F10 验收 4）
- [ ] **同址（F10 验收 2）**：pr-006 的三条实报彼此同属 `chat-0028-second-cluster`（第二集群侧），与迭代 chat 分属两库、互不可见即为预期形态
- [ ] **等价性三信号（F11 验收 1）**：逐条派发核对——① `call_id` 可读；② 终态信封可得（`state` ∈ {`completed`, `failed`}）；③ 产出可无人工搬运地连续读出且下游产物直接引用；不适用的条目（如超出 30 分钟节点上限的异常终态）如实标注（F11 验收 4：判据适用于阶段 2~6 全部派发，不得豁免）
- [ ] **缺口登记（F11 验收 2）**：`truncated: true` / 需两步拼接 / 终态信封不可得三类现象逐次（或按同类聚合）判定，并核对 pr-007 的记录中有对应条目（G-5）
- [ ] **并发取证（F11 验收 3）**：落盘阶段 5 首次派发同轮发起的 ≥2 条 `call_id` 与各自终态字段；两条属不同角色节点或不同 PR（该取证由主 agent 在派发时发起，本 PR 负责落盘与核对）
- [ ] 不改造 hub 调用面、不改 per-call `model` 的既有语义（F09 边界）；不要求宿主侧非派发工具动作走 hub

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md` / `F10-single-chat-attribution.md` / `F11-dispatch-equivalence-criteria.md`（验收、边界、MI-4 / MI-5）
- `docs/iterations/0028-role-model-binding/architecture.md` §3.3 派发链、§4 A-03（台账落点与维护三拍）、§4 A-05（两库互不可见为预期）
- `docs/iterations/0028-role-model-binding/status.md` §执行方式（本次迭代专用契约：派发通道 / 等待终态 / chat 粒度 / 角色↔节点 / 模型真源）
- `docs/iterations/0028-role-model-binding/status.md` §派发台账（核对对象）
- 代码锚点：`oamp/src/web.js:1232-1256`（`calls get` = `router.task_get`，不按来源过滤）、`oamp/src/web.js:1137-1139`（`GET /api/calls` 只列 `from === 'web'`）、`oamp/API.md` §3.19（终态信封封闭 10 键、不含 `chat_id`）

## depends_on

- pr-006-second-cluster-binding-evidence.md（理由：本卡 F10 验收 2 的判定对象就是 pr-006 产出的三条实报（同一 chat 内的三条 `call_id`），该 `chat_id` 与三条 `call_id` 由 pr-006 的「验收证据」小节落盘——证据：`architecture.md` §4 A-05 第 2 条明写"`chat_id` 与 `project_id` 记入承载 F05 / F06 / F07 的 PR「验收证据」小节，同一处并列三条 `call_id` 与终态字段"；缺 pr-006，F10 验收 2 无判定对象）

## batch

5

## 验收证据

（本 PR 执行时填写：「台账逐行 vs 调用面对照表」+「三条实报的 chat 归属核对输出」+「迭代 chat 全量 `call_id` 归属清单」+「等价性三信号逐条结论与缺口清单」+「并发取证的两条 `call_id` 与终态」；载体约定见 `architecture.md` §4 A-02 / A-03）

### 执行记录（pr-008 · 全量派发契约核对；执行者 dev，2026-09-16）

路径记号：`<WS>` = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`（迭代工作区）；`<MAIN>` = `/Users/chenchiyuan/projects/agents`（主工作区）；`<WT>` = 本 PR worktree。
**只读声明**：本 PR 全程零写动作——无 `calls create` / `messages send` / `projects create` / `cluster up|down`（自证见 ⑧）；唯一版本控制写入 = 本 PR 文件。

#### 基线（执行前快照）｜T1

`status.md` 在执行时点已由主 agent 增量更新（含 10:07 / 10:09 / 10:10 / 10:12 / 10:15 五行）⇒ 按契约 8 **以执行时点快照为基线**，与任务图规划期快照的差异一并登记：

```
$ shasum -a 256 <WS>/docs/iterations/0028-role-model-binding/status.md
a8c906e0dcf9c08bacaafa90b6f1a7f365e00d7f861b325cca01a06503a96674  <WS>/docs/iterations/0028-role-model-binding/status.md
$ grep -n '^## 派发台账' <WS>/docs/iterations/0028-role-model-binding/status.md
58:## 派发台账
$ grep -n '^## 待确认项' <WS>/docs/iterations/0028-role-model-binding/status.md
101:## 待确认项
$ node <MAIN>/oamp/bin/hub.js api calls list | jq -r '.calls|length'
21
$ node <WS>/oamp/bin/hub.js api calls list --port 7789 | jq -r '.calls|length'
4
```

| 项 | 规划期快照（任务图 E3 / E6） | 执行时点实测 | 差异登记 |
|---|---|---|---|
| `status.md` sha256 | `9278d3ad72f3cb230ca5bbbfc43aeac6cd34decd8baf36c759626b7b57b0cbaa` | `a8c906e0dcf9c08bacaafa90b6f1a7f365e00d7f861b325cca01a06503a96674` | 主 agent 在执行前增量更新（新增 10:07~10:15 五行：pr-006 验收 / 返工 / 重验、pr-008 任务拆解、pr-008 dev 派发） |
| 台账数据行数 | 37 | **38** | 同上（+1 行 = 10:15 `dev` 的 pr-008 全量派发契约核对，即本 PR 自身的派发） |
| 台账唯一 `call_id` | 36 | **37** | 同上 |
| 台账数据行行号区间 | 57~99 | **62~99** | 主 agent 前段增行导致整体下移 |
| `calls list`（主集群）条数 | 20 | **21** | 与「重建后唯一 `call_id` = 21」一致（枚举面口径见 ① 末） |

**枚举面口径（任务图 E7）**：`GET /api/calls` 只列 `from === 'web'` 的调用（`oamp/src/web.js:1137-1139`）⇒ **枚举面 = 台账**（38 行 / 37 唯一），`calls list` 仅作交叉核对。

#### 通道与寻址｜PR 验收 1 / 2（F09 验收 1 / 2）

台账列 → 唯一 `call_id` 清单（**行序保留重复**，供 ① 的逐行对照使用）：

```
$ awk '/^## 派发台账/{f=1} /^## 待确认项/{f=0} f && /^\| [0-9]/' <WS>/docs/iterations/0028-role-model-binding/status.md \
    | awk -F'|' '{gsub(/^ +| +$/,"",$5); print $5}' | sed 's/`//g' > /tmp/0028-pr-008/ledger-ids.txt
$ wc -l < /tmp/0028-pr-008/ledger-ids.txt          # 逐行列（含重复行）
38
$ sort -u /tmp/0028-pr-008/ledger-ids.txt | wc -l  # 唯一 call_id
37
$ awk '/^## 派发台账/{f=1} /^## 待确认项/{f=0} f && /^\| [0-9]/' <WS>/docs/iterations/0028-role-model-binding/status.md \
    | awk -F'|' '{gsub(/^ +| +$/,"",$5); print $5}' | sed 's/`//g' | grep -c '^task-[0-9a-f-]\{36\}$'
38
```

⇒ **通道（验收 1 前半）**：38 行逐行 `call_id` 非空、形态全部为 `task-<uuid36>`（`grep -c` = 38）。**口径**（F09 验收 1 原文）：台账覆盖全量即排除本地子代理派发路径——本 PR 只下此结论，不外推。

⇒ **寻址（验收 2）**：逐条取信封 `agent`（`calls get` 的成功信封走 stdout、404 错误对象走 stderr，故命令内 `2>&1` 合并两流）：

```
$ for cid in $(cat /tmp/0028-pr-008/ledger-ids.txt); do printf '%s\t' "$cid"; \
    node <MAIN>/oamp/bin/hub.js api calls get "$cid" 2>&1 | jq -c 'if .code then {code:.code,agent:null} else {agent} end'; done
task-bfd83f28-2078-434b-8a16-eac455d2e999	{"code":"NOT_FOUND","agent":null}
task-39204abd-38ab-4971-b785-3eed6b0bb835	{"code":"NOT_FOUND","agent":null}
task-8e84f95f-b783-4477-8054-abf0b36f31ec	{"code":"NOT_FOUND","agent":null}
task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb	{"code":"NOT_FOUND","agent":null}
task-191d2e14-e852-412d-ab90-e6fc00092928	{"code":"NOT_FOUND","agent":null}
task-db950070-445a-492f-8f58-5bbd95c20c9f	{"code":"NOT_FOUND","agent":null}
task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e	{"code":"NOT_FOUND","agent":null}
task-d76732bb-fd6c-480c-b1af-abd4f1726a3a	{"code":"NOT_FOUND","agent":null}
task-ece7344d-f237-4cde-b890-94bccfa0815c	{"code":"NOT_FOUND","agent":null}
task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068	{"code":"NOT_FOUND","agent":null}
task-4d88d08b-f977-4314-813e-e8dfc49c89df	{"code":"NOT_FOUND","agent":null}
task-4b8e1399-36ce-47e2-8a66-09293eb8725c	{"code":"NOT_FOUND","agent":null}
task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e	{"code":"NOT_FOUND","agent":null}
task-def5a04f-85a6-42b8-8dd5-c5f261e5171a	{"code":"NOT_FOUND","agent":null}
task-5585d411-a3cc-46cf-8a1f-31baccfd03b5	{"code":"NOT_FOUND","agent":null}
task-637e830a-a4f0-4318-9650-16b72eedeb82	{"code":"NOT_FOUND","agent":null}
task-05e21d21-1f3f-4619-bef1-38b2f64a549b	{"agent":"pr-planner"}
task-07508a08-32a3-4e12-86ea-34e856c09b6f	{"agent":"dev"}
task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37	{"agent":"planner"}
task-c0acdd24-c873-4b27-b9fa-e1019949456e	{"agent":"progress-observer"}
task-92f31d55-3789-4184-a850-a43df30e54be	{"agent":"dev"}
task-fc99395f-d815-4b2b-83c6-24696a18bdc1	{"agent":"verifier"}
task-2a20f315-586c-4206-969d-b421e6254fa8	{"agent":"dev"}
task-4daeb32f-8a3e-41c0-bacf-38b89c9392c3	{"agent":"verifier"}
task-4ad6c28f-5829-475f-8420-0df96012859f	{"agent":"planner"}
task-92f31d55-3789-4184-a850-a43df30e54be	{"agent":"dev"}
task-b392b024-e12c-4d19-befb-5424d636e69a	{"agent":"dev"}
task-7cdd4339-b5fe-4f8b-935e-a8cc922eed37	{"agent":"verifier"}
task-7670b5c5-cc96-4247-a4b3-7ae635c97e78	{"agent":"verifier"}
task-74bf0ca1-6620-4111-b91e-913249b6d8e1	{"agent":"dev"}
task-94d4a91c-09af-403e-b464-40f59b4aff04	{"agent":"verifier"}
task-2d178ff2-0e52-43cf-8b81-e22b6718cf0a	{"agent":"planner"}
task-e595808c-e497-412d-90a2-7a2a57680144	{"agent":"dev"}
task-e770645e-ebd7-42c9-99ee-30af88aa9f56	{"agent":"verifier"}
task-ede2a399-8a89-4351-ac15-ddbfa94d712c	{"agent":"dev"}
task-000f245c-8f12-4ca6-bc59-de2ca1767d6d	{"agent":"verifier"}
task-8e419773-444e-4b33-b3a6-63dad11e4101	{"agent":"planner"}
task-d1bbac5c-da8c-4bad-a25f-cc1291c53c0e	{"agent":"dev"}
```

⇒ 38 行中 **22 行可读**（信封 `agent` 全部等于台账「角色（节点）」列去 `（`pb-…`）` 后的角色名，**零 `null`**，覆盖 `dev` / `verifier` / `planner` / `pr-planner` / `progress-observer`）、**16 行 404**（`code: NOT_FOUND`，按 T2-3 以台账角色列为据、回读面不可用，不判 `null`）。


#### 真源唯一｜PR 验收 3（F09 验收 3；结论供 **pr-004 验收 4** 消费）

**例外识别（F02 的 2 条探针）**：

```
$ grep -n '前置常驻探针' <WS>/docs/iterations/0028-role-model-binding/status.md
62:| 20:52 | dev（`pb-dev`） | 前置常驻探针（gpt，per-call model 例外） | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | completed（3607ms） | `openai/gpt-5.6-luna` | false |
63:| 20:56 | verifier（`pb-verifier`） | 前置常驻探针（grok，同 chat 第二条） | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | completed（4885ms） | `powerby/grok-4.6` | false |
$ grep -c 'per-call model 例外' <WS>/docs/iterations/0028-role-model-binding/status.md
1
$ grep -n '模型真源' <WS>/docs/iterations/0028-role-model-binding/status.md
（该行原文节选）**模型真源**：角色级（`cluster.json` 的 `roles.<role>.model`）为唯一真源；正式派发不带 `model`（探针专用例外已于探针完成后关闭）
```

| 例外项 | `call_id` | 用途原文 | 实报 `model` 原文 |
|---|---|---|---|
| ① 探针（gpt） | `task-bfd83f28-2078-434b-8a16-eac455d2e999` | 前置常驻探针（gpt，**per-call model 例外**） | `openai/gpt-5.6-luna` |
| ② 探针（grok） | `task-39204abd-38ab-4971-b785-3eed6b0bb835` | 前置常驻探针（grok，同 chat 第二条） | `powerby/grok-4.6` |

**差异登记（契约 4）**：任务图 T3-1 预期 `grep -c 'per-call model 例外'` = **2**，实测 = **1**（仅第 62 行「用途」列含该短语；第 63 行只写「前置常驻探针（grok，同 chat 第二条）」）⇒ 2 条例外靠 `前置常驻探针` 短语识别（命中 **2**）；台账该列字面标注不完整，如实登记、不修正台账。

**逐条命令形态结论表（PR 验收 3）**——按证据面强度分三组：

| 组 | 条目 | 命令形态结论 | 证据面（逐条可点） |
|---|---|---|---|
| A | 2 条探针（`task-bfd83f28…` / `task-39204abd…`） | **含 `--model`**（per-call 例外） | `status.md:62,63` 用途列 + §执行方式「探针专用例外」 |
| B | 3 条第二集群绑定实报（`call_id` = `task-2eac7142…` / `task-40da0340…` / `task-8589a6a0…`） | **不含 `--model`**（命令原文逐字可核） | `prs/pr-006-second-cluster-binding-evidence.md` 三条「命令」块（逐字）+ 其自证块 `grep -c -- '--model'` = 0 |
| C | 台账其余 **36 行**（38 行 − 2 条探针） | **不含 `--model`**（**登记面判据**，非命令原文逐字核对） | `status.md` §执行方式「模型真源」+ 台账用途列（除第 62 行外零「例外」字样）+ `history.md` 的 25 处 `calls create` 通道记录（`grep -c 'calls create'` = 25） |

**核对面已穷尽声明（T3-2 的反向要求）**：本迭代**未逐条留存派发命令原文**；对 C 组，三个可用证据面（`status.md` §执行方式 / 台账用途列 / `history.md` 通道记录）已全部核对 —— `history.md:35` 预先登记该限制原文：「另登记 2 处非矛盾事项（`model` 字段文档在 `oamp/README.md`；**未带 `--model` 无法从调用面反证**）」⇒ C 组结论的效力边界 = 登记面，**不**声称命令原文逐字核对通过。

**汇总结论（供 pr-004 验收 4 直接引用）**：除去 **2 条探针**（`task-bfd83f28-2078-434b-8a16-eac455d2e999` / `task-39204abd-38ab-4971-b785-3eed6b0bb835`）外，本迭代登记面内**零命中** `--model` ⇒「其余 36 行 + 3 条第二集群实报均不含 `--model`」，模型取值来源唯一 = `cluster.json` 的角色级绑定。**该结论被 pr-004 验收 4 消费。**

**边界声明（F09 验收 5 / PR 验收 10）**：本条只约束「本迭代的正式派发不使用 per-call `model`」，**未**改写 per-call `model` 的既有优先级语义（其实证归 F13 验收 2 与 F02 探针回执）；本 PR 未改造 hub 调用面（判据 = `git diff --name-only b8c7cf7...HEAD` 仅本 PR 文件，见 ⑧）。


#### ① 台账逐行 vs 调用面对照表｜PR 验收 4（F09 验收 4）+ F11 验收 2 ③

**逐条取证脚本（自足可执行；输入 = 由上一块命令生成的 `/tmp/0028-pr-008/ledger-ids.txt`，逐行序含重复行 ⇒ 输出 38 行，与 38 行台账一一对应）**：

```
$ cat /tmp/0028-pr-008/extract.sh
MAIN=/Users/chenchiyuan/projects/agents
while read -r cid; do
  printf '%s\t' "$cid"
  node $MAIN/oamp/bin/hub.js api calls get "$cid" | jq -c 'if .code then {code,error,http_status} else {call_id,agent,state,duration_ms,model,truncated,error,exit_code,text_len:(.text|length)} end'
done < /tmp/0028-pr-008/ledger-ids.txt
$ bash /tmp/0028-pr-008/extract.sh
task-bfd83f28-2078-434b-8a16-eac455d2e999	{"code":"NOT_FOUND","error":"call 不存在: task-bfd83f28-2078-434b-8a16-eac455d2e999","exit_code":1,"http_status":404}
task-39204abd-38ab-4971-b785-3eed6b0bb835	{"code":"NOT_FOUND","error":"call 不存在: task-39204abd-38ab-4971-b785-3eed6b0bb835","exit_code":1,"http_status":404}
task-8e84f95f-b783-4477-8054-abf0b36f31ec	{"code":"NOT_FOUND","error":"call 不存在: task-8e84f95f-b783-4477-8054-abf0b36f31ec","exit_code":1,"http_status":404}
task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb	{"code":"NOT_FOUND","error":"call 不存在: task-ad4c21ee-3bff-45ba-9b20-b2d7c1dc8edb","exit_code":1,"http_status":404}
task-191d2e14-e852-412d-ab90-e6fc00092928	{"code":"NOT_FOUND","error":"call 不存在: task-191d2e14-e852-412d-ab90-e6fc00092928","exit_code":1,"http_status":404}
task-db950070-445a-492f-8f58-5bbd95c20c9f	{"code":"NOT_FOUND","error":"call 不存在: task-db950070-445a-492f-8f58-5bbd95c20c9f","exit_code":1,"http_status":404}
task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e	{"code":"NOT_FOUND","error":"call 不存在: task-b755be9c-0b5b-4a47-8ed8-89e8eb0e0e6e","exit_code":1,"http_status":404}
task-d76732bb-fd6c-480c-b1af-abd4f1726a3a	{"code":"NOT_FOUND","error":"call 不存在: task-d76732bb-fd6c-480c-b1af-abd4f1726a3a","exit_code":1,"http_status":404}
task-ece7344d-f237-4cde-b890-94bccfa0815c	{"code":"NOT_FOUND","error":"call 不存在: task-ece7344d-f237-4cde-b890-94bccfa0815c","exit_code":1,"http_status":404}
task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068	{"code":"NOT_FOUND","error":"call 不存在: task-b7d6686d-e9e9-4b3c-bdc3-4fcccff6c068","exit_code":1,"http_status":404}
task-4d88d08b-f977-4314-813e-e8dfc49c89df	{"code":"NOT_FOUND","error":"call 不存在: task-4d88d08b-f977-4314-813e-e8dfc49c89df","exit_code":1,"http_status":404}
task-4b8e1399-36ce-47e2-8a66-09293eb8725c	{"code":"NOT_FOUND","error":"call 不存在: task-4b8e1399-36ce-47e2-8a66-09293eb8725c","exit_code":1,"http_status":404}
task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e	{"code":"NOT_FOUND","error":"call 不存在: task-9c687e51-15ba-42a8-bdde-882ecc8d0a3e","exit_code":1,"http_status":404}
task-def5a04f-85a6-42b8-8dd5-c5f261e5171a	{"code":"NOT_FOUND","error":"call 不存在: task-def5a04f-85a6-42b8-8dd5-c5f261e5171a","exit_code":1,"http_status":404}
task-5585d411-a3cc-46cf-8a1f-31baccfd03b5	{"code":"NOT_FOUND","error":"call 不存在: task-5585d411-a3cc-46cf-8a1f-31baccfd03b5","exit_code":1,"http_status":404}
task-637e830a-a4f0-4318-9650-16b72eedeb82	{"code":"NOT_FOUND","error":"call 不存在: task-637e830a-a4f0-4318-9650-16b72eedeb82","exit_code":1,"http_status":404}
task-05e21d21-1f3f-4619-bef1-38b2f64a549b	{"call_id":"task-05e21d21-1f3f-4619-bef1-38b2f64a549b","agent":"pr-planner","state":"completed","duration_ms":50525,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":2892}
task-07508a08-32a3-4e12-86ea-34e856c09b6f	{"call_id":"task-07508a08-32a3-4e12-86ea-34e856c09b6f","agent":"dev","state":"completed","duration_ms":252857,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":3733}
task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37	{"call_id":"task-b5bb2d23-8ab0-4ce5-b888-973e81d72f37","agent":"planner","state":"completed","duration_ms":232628,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":1813}
task-c0acdd24-c873-4b27-b9fa-e1019949456e	{"call_id":"task-c0acdd24-c873-4b27-b9fa-e1019949456e","agent":"progress-observer","state":"completed","duration_ms":161179,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":2787}
task-92f31d55-3789-4184-a850-a43df30e54be	{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"failed","duration_ms":2111305,"model":null,"truncated":true,"error":"timeout","exit_code":null,"text_len":15}
task-fc99395f-d815-4b2b-83c6-24696a18bdc1	{"call_id":"task-fc99395f-d815-4b2b-83c6-24696a18bdc1","agent":"verifier","state":"completed","duration_ms":215591,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":8291}
task-2a20f315-586c-4206-969d-b421e6254fa8	{"call_id":"task-2a20f315-586c-4206-969d-b421e6254fa8","agent":"dev","state":"completed","duration_ms":141746,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":4075}
task-4daeb32f-8a3e-41c0-bacf-38b89c9392c3	{"call_id":"task-4daeb32f-8a3e-41c0-bacf-38b89c9392c3","agent":"verifier","state":"completed","duration_ms":93964,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":6784}
task-4ad6c28f-5829-475f-8420-0df96012859f	{"call_id":"task-4ad6c28f-5829-475f-8420-0df96012859f","agent":"planner","state":"completed","duration_ms":141694,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":2299}
task-92f31d55-3789-4184-a850-a43df30e54be	{"call_id":"task-92f31d55-3789-4184-a850-a43df30e54be","agent":"dev","state":"failed","duration_ms":2111305,"model":null,"truncated":true,"error":"timeout","exit_code":null,"text_len":15}
task-b392b024-e12c-4d19-befb-5424d636e69a	{"call_id":"task-b392b024-e12c-4d19-befb-5424d636e69a","agent":"dev","state":"completed","duration_ms":405269,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":4765}
task-7cdd4339-b5fe-4f8b-935e-a8cc922eed37	{"call_id":"task-7cdd4339-b5fe-4f8b-935e-a8cc922eed37","agent":"verifier","state":"completed","duration_ms":232550,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":9429}
task-7670b5c5-cc96-4247-a4b3-7ae635c97e78	{"call_id":"task-7670b5c5-cc96-4247-a4b3-7ae635c97e78","agent":"verifier","state":"completed","duration_ms":61726,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":8715}
task-74bf0ca1-6620-4111-b91e-913249b6d8e1	{"call_id":"task-74bf0ca1-6620-4111-b91e-913249b6d8e1","agent":"dev","state":"completed","duration_ms":228208,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":4546}
task-94d4a91c-09af-403e-b464-40f59b4aff04	{"call_id":"task-94d4a91c-09af-403e-b464-40f59b4aff04","agent":"verifier","state":"completed","duration_ms":107164,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":8270}
task-2d178ff2-0e52-43cf-8b81-e22b6718cf0a	{"call_id":"task-2d178ff2-0e52-43cf-8b81-e22b6718cf0a","agent":"planner","state":"completed","duration_ms":150193,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":2457}
task-e595808c-e497-412d-90a2-7a2a57680144	{"call_id":"task-e595808c-e497-412d-90a2-7a2a57680144","agent":"dev","state":"completed","duration_ms":174072,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":4748}
task-e770645e-ebd7-42c9-99ee-30af88aa9f56	{"call_id":"task-e770645e-ebd7-42c9-99ee-30af88aa9f56","agent":"verifier","state":"completed","duration_ms":89966,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":7542}
task-ede2a399-8a89-4351-ac15-ddbfa94d712c	{"call_id":"task-ede2a399-8a89-4351-ac15-ddbfa94d712c","agent":"dev","state":"completed","duration_ms":62559,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":4908}
task-000f245c-8f12-4ca6-bc59-de2ca1767d6d	{"call_id":"task-000f245c-8f12-4ca6-bc59-de2ca1767d6d","agent":"verifier","state":"completed","duration_ms":91662,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":7708}
task-8e419773-444e-4b33-b3a6-63dad11e4101	{"call_id":"task-8e419773-444e-4b33-b3a6-63dad11e4101","agent":"planner","state":"completed","duration_ms":135598,"model":"deepseek/deepseek-v4-flash","truncated":true,"error":null,"exit_code":0,"text_len":2313}
task-d1bbac5c-da8c-4bad-a25f-cc1291c53c0e	{"call_id":"task-d1bbac5c-da8c-4bad-a25f-cc1291c53c0e","agent":"dev","state":"working","duration_ms":null,"model":null,"truncated":true,"error":null,"exit_code":null,"text_len":0}
```

（口径说明：`api calls get` 的成功信封走 stdout、404 错误对象走 stderr；上表 404 行即 `2>&1` 合并后的 stderr 原文。）

**38 行对照表**（台账三列 ← `status.md:62~99` 原文；信封三列 ← 上表原始输出）：

| 行 | 时点 | 角色 | `call_id` | 台账 终态 | 信封 `state` | 台账 实报 `model` | 信封 `model` | 台账 `truncated` | 信封 `truncated` | 逐行判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| 62 | 20:52 | dev（`pb-dev`） | `task-bfd83f28-2078-434b-…` | completed（3607ms） | `404 NOT_FOUND` | `openai/gpt-5.6-luna` | — | false | — | **查不回 ⇒ 缺口类③（G-15）** |
| 63 | 20:56 | verifier（`pb-verifier`） | `task-39204abd-38ab-4971-…` | completed（4885ms） | `404 NOT_FOUND` | `powerby/grok-4.6` | — | false | — | **查不回 ⇒ 缺口类③（G-15）** |
| 64 | 20:56 | prd（`pb-prd`） | `task-8e84f95f-b783-4477-…` | completed（366383ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 65 | 21:06 | prd（`pb-prd`） | `task-ad4c21ee-3bff-45ba-…` | completed（119006ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 66 | 21:09 | architect（`pb-architect`） | `task-191d2e14-e852-412d-…` | ❌失败(超时·现场保留)（1802661ms，「轮次超时（1800000ms）」，`error: timeout`） | `404 NOT_FOUND` | —（超时未产生终态实报） | — | true | — | **查不回 ⇒ 缺口类③（G-15）** |
| 67 | 22:03 | pr-planner（`pb-pr-planner`） | `task-db950070-445a-492f-…` | completed（817772ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 68 | 22:17 | verifier（`pb-verifier`） | `task-b755be9c-0b5b-4a47-…` | completed（598437ms） | `404 NOT_FOUND` | `powerby/grok-4.6`（异常，见 G-11） | — | false | — | **查不回 ⇒ 缺口类③（G-15）** |
| 69 | 22:32 | planner（`pb-planner`） | `task-d76732bb-fd6c-480c-…` | completed（183086ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 70 | 22:32 | planner（`pb-planner`） | `task-ece7344d-f237-4cde-…` | completed（345436ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 71 | 22:32 | planner（`pb-planner`） | `task-b7d6686d-e9e9-4b3c-…` | completed（475246ms） | `404 NOT_FOUND` | `deepseek/deepseek-v4-flash` | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 72 | 22:41 | dev（`pb-dev`） | `task-4d88d08b-f977-4314-…` | completed（381614ms） | `404 NOT_FOUND` | `openai/gpt-5.6-luna`（G-11） | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 73 | 22:41 | dev（`pb-dev`） | `task-4b8e1399-36ce-47e2-…` | completed（617839ms） | `404 NOT_FOUND` | `openai/gpt-5.6-luna`（G-11） | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 74 | 22:41 | dev（`pb-dev`） | `task-9c687e51-15ba-42a8-…` | completed（831193ms） | `404 NOT_FOUND` | `openai/gpt-5.6-luna`（G-11） | — | true（G-5 聚合） | — | **查不回 ⇒ 缺口类③（G-15）** |
| 75 | 23:13 | verifier（`pb-verifier`） | `task-def5a04f-85a6-42b8-…` | completed（224086ms，结论 FAIL） | `404 NOT_FOUND` | `powerby/grok-4.6`（G-11） | — | true | — | **查不回 ⇒ 缺口类③（G-15）** |
| 76 | 23:13 | verifier（`pb-verifier`） | `task-5585d411-a3cc-46cf-…` | completed（364616ms） | `404 NOT_FOUND` | `powerby/grok-4.6`（G-11） | — | true | — | **查不回 ⇒ 缺口类③（G-15）** |
| 77 | 23:15 | verifier（`pb-verifier`） | `task-637e830a-a4f0-4318-…` | completed（365858ms） | `404 NOT_FOUND` | `powerby/grok-4.6`（G-11） | — | true | — | **查不回 ⇒ 缺口类③（G-15）** |
| 78 | 08:48 | pr-planner（`pb-pr-planner`） | `task-05e21d21-1f3f-4619-…` | completed（08:48:42→08:49:32） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 79 | 08:48 | dev（`pb-dev`） | `task-07508a08-32a3-4e12-…` | completed（08:48:42→08:52:55，提交 `f6a8ccb`） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 80 | 08:50 | planner（`pb-planner`） | `task-b5bb2d23-8ab0-4ce5-…` | completed（08:50:40→08:54:33） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 81 | 08:50 | progress-observer（`pb-progress-observer`） | `task-c0acdd24-c873-4b27-…` | completed（08:50:40→08:53:21） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 82 | 09:06 | dev（`pb-dev`） | `task-92f31d55-3789-4184-…` | working | `failed` | — | `null` | — | `true` | **差异：** state：台账 `working` vs 信封 `failed`；truncated：台账 `—` vs 信封 `true` |
| 83 | 09:06 | verifier（`pb-verifier`） | `task-fc99395f-d815-4b2b-…` | completed（09:06:27→09:10:02，结论 PASS） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 84 | 09:06 | dev（`pb-dev`） | `task-2a20f315-586c-4206-…` | completed（09:06:26→09:08:48，提交 `e387cb4`） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 85 | 09:16 | verifier（`pb-verifier`） | `task-4daeb32f-8a3e-41c0-…` | completed（09:20:13，结论 PASS 6/6） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 86 | 09:22 | planner（`pb-planner`） | `task-4ad6c28f-5829-475f-…` | completed | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 87 | 09:06 | dev（`pb-dev`） | `task-92f31d55-3789-4184-…` | ❌失败(超时·现场保留)（2111305ms，「轮次超时（1800000ms）」，提交 `b86fa80`） | `failed` | — | `null` | true | `true` | ✅ 三列一致 |
| 88 | 09:42 | dev（`pb-dev`） | `task-b392b024-e12c-4d19-…` | completed（阻塞：UDS 路径 105>104 字节） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 89 | 09:42 | verifier（`pb-verifier`） | `task-7cdd4339-b5fe-4f8b-…` | completed（FAIL 8/9·唯一 fail 系验证标准缺陷） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 90 | 09:50 | verifier（`pb-verifier`） | `task-7670b5c5-cc96-4247-…` | completed（PASS 9/9） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 91 | 09:53 | dev（`pb-dev`） | `task-74bf0ca1-6620-4111-…` | completed（8/8 通过；第二集群 12 窗口/7789/10 角色 online） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 92 | 09:58 | verifier（`pb-verifier`） | `task-94d4a91c-09af-403e-…` | completed（PASS 8/8） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 93 | 10:00 | planner（`pb-planner`） | `task-2d178ff2-0e52-43cf-…` | completed（44 KB 任务图 T1~T10） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 94 | 10:03 | dev（`pb-dev`） | `task-e595808c-e497-412d-…` | completed（8/8 通过；7789 实报 `openai/gpt-5.6-luna` / `powerby/grok-4.6` / `deepseek/deepseek-v4-flash`） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 95 | 10:07 | verifier（`pb-verifier`） | `task-e770645e-ebd7-42c9-…` | completed（FAIL 7/8·唯一 fail = 一处证据块形态） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 96 | 10:09 | dev（`pb-dev`） | `task-ede2a399-8a89-4351-…` | completed（提交 `7f15f3e`） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 97 | 10:10 | verifier（`pb-verifier`） | `task-000f245c-8f12-4ca6-…` | completed（PASS 8/8） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | true | `true` | ✅ 三列一致 |
| 98 | 10:12 | planner（`pb-planner`） | `task-8e419773-444e-4b33-…` | completed（46 KB 任务图 T1~T11） | `completed` | `deepseek/deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | — | `true` | **差异：** truncated：台账 `—` vs 信封 `true` |
| 99 | 10:15 | dev（`pb-dev`） | `task-d1bbac5c-da8c-4bad-…` | submitted | `working` | — | `null` | — | `true` | **差异：** state：台账 `submitted` vs 信封 `working`；truncated：台账 `—` vs 信封 `true` |


**差异登记汇总（契约 4：只登记、不修正台账）**

| # | 差异 | 台账侧 | 调用面侧 | 行号 / `call_id` | 对照条目 |
|---|---|---|---|---|---|
| D1 | **查不回（16 行）** | 三列均有值 | `{"code":"NOT_FOUND",…,"http_status":404}` | 62~77（全部重建前调用） | `F11 验收 2 ③` ⇒ `deferred-demand-changes.md` **G-15** |
| D2 | **重复行** | 两行同一 `call_id`：`working`（行 82）/ `❌失败(超时·现场保留)`（行 87） | `state=failed`、`duration_ms=2111305`、`error=timeout`、`truncated=true` | `task-92f31d55-3789-4184-a850-a43df30e54be` | 行 87 与调用面**一致**；行 82 **已失效（stale）**。不合并、不删行 |
| D3 | **未终态行（2 行）** | `working`（行 82）/ `submitted`（行 99） | 行 82 信封 = `failed`（已终态，见 D2）；行 99 信封 = `working`（**在途**：本 PR 自身的派发） | 行 82 / `task-d1bbac5c-da8c-4bad-a25f-cc1291c53c0e` | F11 验收 1 ② ⇒ 行 99 的三信号 ② 标「不适用／未终态」（见 ④） |
| D4 | **`truncated` 列差异（9 行）** | `—`（未记） | 信封 `truncated: true` | 行 78 / 79 / 80 / 81 / 82 / 86 / 93 / 98 / 99 | `F11 验收 2 ①` ⇒ **G-5** |
| D5 | **`state` 列差异（2 行）** | 行 82 `working`、行 99 `submitted` | 信封 `failed` / `working` | 见 D2 / D3 | 同上 |
| D6 | `model` 列差异 | 0 | 0 | — | 台账 `—` 与信封 `null` 在 3 行（82 / 87 / 99）同时出现，语义一致（该 3 行或失败或在途，均无实报 model）⇒ **不计为差异** |
| D7 | 第二集群三条实报行缺失 | 台账无该三行、`用途` 列零 `第二集群绑定实报` 字样 | 第二集群侧可读（`--port 7789`） | 见 ② | PR 验收 4 后半 ⇒ 差异登记（不替主 agent 补行） |

**条数算式（T5-5）**

```
台账数据行 38 = 唯一 call_id 37 + 重复行 1（task-92f31d55… 出现于行 82 与行 87）
重建后（行 78~99）22 行 = 唯一 call_id 21 + 重复行 1
$ node <MAIN>/oamp/bin/hub.js api calls list | jq -r '.calls|length'
21
```

**枚举面交叉核对（T2-4）**：`calls list`（21 条）中的 `call_id` **全部命中台账**（21/21）；台账中**不在** `calls list` 的 16 条**恰为查不回的 16 行**（重建前）⇒ 与 `status.md` 状态行「集群已重建，调用面清空、对话记录留存」一致。⇒ 枚举面以台账为准，`calls list` 只作交叉核对（E7）。

**复探纪律（契约 5）**：本 PR 对 37 个唯一 `call_id` 各探一次；其中 `task-92f31d55-…` 因台账两行而被**探针两次**，两次原始输出**逐字相同**（均 `failed` / `2111305` / `timeout` / `truncated: true`）⇒ 未出现「批量与单独探针不一致」的场景，无需并记两次结果（对照 `E5 ③` 的规划期取值，亦一致）。
