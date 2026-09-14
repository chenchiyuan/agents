# verify-stage6-20260914.md — 0023-yolo-approval-and-question-inbox 迭代终态独立验证

**验证者身份（反射结果）**：多面反射——① **PR 计划审查者**（A 组：粒度 / depends_on / 文件范围与真实 diff 对照）；② **工作流流程审计者**（B 组：并发调度真实执行证据，按 `workflow-pb.md` §「并发调度真实执行证据」三项强制核查）；③ **端到端测试工程师**（C 组：E1~E9 真实运行面，起隔离栈 + 真实 `omp` + 真实 HTTP/SSE 驱动）；④ **平台同级审查者**（D 组：边界与保证项 N1~N12 / F12~F16 的终态核实）。

**产出物**：迭代分支 `iteration/0023-yolo-approval-and-question-inbox`（HEAD = merge `11dc502`，含 `0123dcb` pr-001 / `6dedd23` pr-002（含修复 `21fec8b`）/ `11dc502` pr-003 三条 merge）上的全部产物——`docs/iterations/0023-yolo-approval-and-question-inbox/**`（demand.md / prd.md + prd/F01~F16*.md / architecture.md / prs/** / clarifications/** / status.md / history.md / progress.md）+ 代码 `oamp/**`。

**验证标准来源**：主 agent 委托内联的五组标准（A1~A3 / B1~B3 / C1~C9 / D：N1~N12 与 F12~F16 / E：搭置台账与偏差登记）。

**验证日期**：2026-09-14

**验证手段声明（真实运行面优先）**：

- **未接收任何执行过程上下文**——本报告的全部依据为产出物（git 对象 / 文档 / 代码）与我自己运行的命令、我自己起的进程、我自己写的探针脚本；未读执行者叙述、未向任何执行者求证、未采信任何"自证"结论（`verify-pr-00*` / `verify-stage4-*` / `progress.md` 仅作为**被验证对象**引用，不作为依据）。
- **真实运行面**：起 **10 组隔离栈**（`OAMP_SOCKET` / `OAMP_DB` 均指向 `/tmp/verify-0023-stage6/tmp{X}/` 下的临时路径，`OAMP_WEB_PORT` 取随机空闲端口，非默认 7788），驱真实 `node oamp/bin/oamp.js router|web|agent` + 真实 `omp`（`/Users/chenchiyuan/.bun/bin/omp`）+ 真实 HTTP/SSE（`fetch`/`http` 客户端，含 `/api/events` 与 `/api/stream` 订阅）。共 10 组场景（A / B / C / D / D2 / E / F / G + 判定性复跑 H / H2）+ 1 支自写上游探针；另跑 1 次 `oamp` 全量测试套件。
- 探针脚本与全部夹具落 `/tmp/verify-0023-stage6/`（库 `lib.mjs`；场景 `sc-A.mjs` / `sc-B.mjs` / `sc-C.mjs` / `sc-D.mjs` / `sc-D2.mjs` / `sc-E.mjs` / `sc-F.mjs` / `sc-G.mjs` / `sc-H.mjs` / `sc-H2.mjs`；上游探针 `probe-acp-multi-text.mjs`；原始证据 `tmp{X}/scenario-{X}.json`）。**自起进程结束前全部终止**（复核 `ps` 无任何引用 `/tmp/verify-0023-stage6` 的进程；现存 `oamp` 进程属仓库主工作区的既有集群，非本次自起）。
- **唯一写入 = 本报告**；未修改任何被测产物（`git status --porcelain` 除本报告与该场景的既有未跟踪文件外为零）；**零 git 写操作**（只读 `log` / `diff` / `show` / `rev-list` / `merge-base` / `branch --list` / `worktree list` / `status`）。

---

## 逐项判定

### 标准 A · PR 粒度与依赖正确性终态

- **A1（三条 depends_on / 无依赖声明在终态仍成立）**：**pass**
  证据：
  ① 声明面：`prs/pr-001-approval-resolution-and-question-channel.md` §depends_on =「（无）」；`prs/pr-002-web-envelope-and-decision-routing.md` §depends_on =「（无）」+ 整段「依赖核实结论」；`prs/pr-003-inbox-question-item-frontend.md` §depends_on = `pr-002-web-envelope-and-decision-routing.md`（理由段逐条给出代码级证据）。
  ② 终态合并拓扑（`git rev-list --parents -n1`）：`0123dcb` = `4101e0b` + `2182b8b`（真双亲）；`6dedd23` = `0123dcb` + `21fec8b`（真双亲）；`11dc502` = `77600f5` + `4162fff`（真双亲）。pr-003 分支的唯一父提交 = `6dedd23`（= pr-002 的 merge 提交）⇒ **pr-003 的声明依赖在终态物理满足**。
  ③ 「pr-002 无依赖」的终态代码级复核（该 PR 自己给出的判据我独立重跑）：`oamp/src/web.js:1615` 通知判据仍为 `body.kind === 'confirmation_request'`（未被新字段覆盖）、`:1619` 为 `request_kind: body.request_kind === 'question' ? 'question' : 'permission'`（非字符串/域外 ⇒ 兜底 `permission`）；生产面 `oamp/src/agent.js:288,294` 写 `request_kind` / `multiple`。生产/消费两侧键集不相交且消费侧有兜底 ⇒ **单独合入 pr-001 或 pr-002 均不破坏对方**，两条「无依赖」声明成立。
  ④ 依赖图无环：唯一一条边 `pr-003 → pr-002`，且 pr-003 分支基点 = pr-002 merge 提交（不存在反向引用）。

- **A2（PR 间文件范围无重叠，与实际 diff 比对）**：**pass**
  证据（按真实分支 diff 逐 PR 取集合后两两求交，`comm -12` 输出为**空**）：
  | PR | 真实 diff 命令 | 文件数 | 集合 |
  |---|---|---|---|
  | pr-001 | `git diff --name-only 4101e0b 2182b8b` | 19 | 18 个交付文件（`src/{protocol,config,launcher,oneshot-client,acp-client,rpc-client,agent,context-pool}.js` + `README.md` + 新建 `test/approval-resolution.test.js` + 8 个既有测试迁移）+ `prs/pr-001-tasks.md` |
  | pr-002 | `git diff --name-only 4101e0b 21fec8b` | 5 | `oamp/src/web.js` / `oamp/API.md` / `oamp/llms.txt` / `oamp/test/confirmation-inbox.test.js` + `prs/pr-002-tasks.md` |
  | pr-003 | `git diff --name-only 6dedd23 4162fff` | 4 | `oamp/web/app.js` / `oamp/web/style.css` / `oamp/test/inbox-console.test.js` + `prs/pr-003-tasks.md` |
  两两交集均为 ∅（`p1∩p2=p1∩p3=p2∩p3=` 空），三集合并集 = 28 = 19+5+4 ⇒ 严格不相交。代码面并集 = 24 文件，与 PR 文件「文件范围」声明逐条相符（pr-001 = 18、pr-002 = 4、pr-003 = 3；各 PR 另含 1 份规划产物 `*-tasks.md`，与 pr-002 验收报告 D-3 的登记一致）。迭代全量 vs main：`git diff --name-only baee09d 11dc502` 经剔除 `oamp/` 与 `docs/iterations/0023-*` 后**为空**（非本迭代路径零触碰）。

- **A3（F01~F16 均有实现锚点）**：**pass**（16/16；终态 `oamp/` HEAD 实读行号）
  | 卡 | 实现锚点（文件:行） | 运行面复核 |
  |---|---|---|
  | F01 默认 `yolo` | `src/protocol.js:44`（`DEFAULT_APPROVAL='yolo'`）、`:65-71` | 场景 A：无任何档位配置 ⇒ argv `--approval-mode yolo`、零门 |
  | F02 档位可配 | `src/config.js:21,63,132,162`（第 5 键 `approval` + `readApproval` 校验）、`src/agent.js:563,609-613`（`--approval-mode`） | 场景 F：config/参数两路真实驱动 argv |
  | F03 `deny` 强制 `always-ask` 且优先 | `src/protocol.js:67`；`src/rpc-client.js:341-348`（回执拒绝 + `abort` + `permission_denied` 结算） | 场景 B：`--permission deny --approval-mode yolo` ⇒ argv `always-ask`、轮次 `failed / error=permission_denied` |
  | F04 提问上浮 | `src/agent.js:271-299`（信封 1，`kind:'confirmation_request'` 恒不被覆盖）、`:329-333`（信封 3 清扫）；`src/rpc-client.js:27-40`（`ask_user` 描述符）、`:389-424`（承接）；`src/acp-client.js:687-709` | 场景 C/D/D2/G：四链路形态均上浮 |
  | F05 提问形状 | `src/rpc-client.js:27-40`（schema `{question, options?, multiple?}`）、`src/acp-client.js:98-137`（`readQuestionForm`：`q{i}` / `items.anyOf` ⇒ `multiple` / `{key}__other`） | 场景 C/D2/G/H：问题文本/选项/多选/无选项纯文本四态齐备 |
  | F06 一问一条 | `src/acp-client.js:687-709`（`form.items.map` ⇒ 逐问一钩子 + 齐答一次 `_respond`） | 场景 D：一帧三问 ⇒ 3 条独立条目、齐答后单次回包 |
  | F07 作答回传 | `src/web.js:1297-1345`（按 `request_kind` 分化的服务端权威校验 + 旁路分化）、`src/agent.js:309-321`（`settleConfirmation` 支持 `option_ids`）、`src/rpc-client.js:97`（`renderAnswerText`）、`src/acp-client.js:158-172`（`readQuestionContent`） | 场景 C/E4、D2、G、H：文本与选项本体回传；question 类零新增用户消息 |
  | F08 未作答保持阻塞 | `src/rpc-client.js:211-219,351,365,403,415`（冻结/解冻轮次计时）、`src/acp-client.js:718,757`（`_pauseTurnTimer`） | 场景 C（25s）/ D2（20s）：条目仍在、轮次 `working`、零收尾 |
  | F09 两条链路 | rpc：`src/rpc-client.js:275`（握手后 `set_host_tools` 恰一次）；acp：`src/acp-client.js:674`（非门 elicitation 分流） | 场景 C（rpc）/ D、D2、H、H2（acp）各一 |
  | F10 工具门通路保留 | `src/rpc-client.js:336-380`（门承接）、`src/web.js:1327-1345`（permission 类旁路不变） | 场景 E6/E7/G2：`kind:'permission'` 条目可裁决且工具确实执行 |
  | F11 能力位与档位声明分离 | `src/protocol.js:23`（`CAPABILITY_KEYS` 六键）、`src/rpc-client.js:44-52`（`RPC_CAPABILITY_VALUES` 含 `approvalGate:'yes'`）；档位声明三处同源（`agent.js:708-714` 的 `AGENT_START.approval` / `spec.approval` / argv） | 直跑模块：`yolo` 与 `always-ask` 两态 `capabilities()` JSON **完全相等**；argv 与 `AGENT_START` 逐实例相等（场景 A/B/E/F） |
  | F12 不改 omp / harness | 负面证据：`git diff --name-only baee09d 11dc502` 不含 `omp/**`；改动面收敛于 `oamp/**` + `docs/iterations/0023-*` | 全部 8 组场景均以真实 `omp` 二进制运行，未补丁 |
  | F13 不新增审计面 | 负面证据：`git diff -U0 4101e0b 11dc502 -- oamp/src \| grep '^+' \| grep -E 'TOOL_APPROVED\|TOOL_DENIED\|TOOL_CALL'` = **空**（拒绝路径复用既有 `permission_denied` 码值：`src/rpc-client.js:347`） | 场景 B 的 rpc 拒绝路径未产生任何审批行载体 |
  | F14 服务边界不变 | 负面证据：`git diff 4101e0b 11dc502 -- oamp/src/web.js \| grep -E '^[+-].*(listen\|auth\|token\|host)'` = 空 | 场景 G 实跑 `lsof -nP -iTCP -sTCP:LISTEN -a -p <web pid>` ⇒ 唯一一条 `node … TCP 127.0.0.1:<port> (LISTEN)`（无 `*:` / 局域网地址） |
  | F15 无历史台账 | 负面证据：`oamp/src/inbox.js` / `persist.js` / `transport.js` 全迭代零改动；路由登记数 `4101e0b`=21 ↔ `11dc502`=21（`grep -c "method: 'GET\|POST'"`） | 场景 C/D2/G：裁决后 `GET /api/confirmations` 立即为空、无任何终态读取入口 |
  | F16 零第三方依赖 | 负面证据：`oamp/package.json` 的 `"dependencies": {}` 前后逐字相同 | 全量套件含 `test/hygiene.test.js` 且 **387/387 全绿**（见下） |

### 标准 B · 并发调度真实执行证据（工作流规范三项强制核查）

- **B1（worktree 时间窗口重叠）**：**pass**（间接证据链完整；直接磁盘并存**不可复得**，见「验证方法限制」）
  证据：
  ① **同批量建**：`history.md:214` 与 `:221` 为同一时刻 `2026-09-14 20:08:00 · 派发 · planner` 的两条记录（pr-001 / pr-002 各自的 worktree 与分支在该批建立）；`:249` / `:256` 同为 `20:17:00 · 派发 · dev` 两条。
  ② **提交时间窗真实重叠**（`git log --date=format:'%H:%M:%S'`）：pr-002 分支窗 `20:11:50 → 20:46:32`，pr-001 分支窗 `20:12:46 → 20:36:49` ⇒ 重叠区间 `20:12:46–20:36:49`（≈24 分钟）；且 **pr-001 的 merge（`0123dcb` 20:43:45）早于 pr-002 分支的最后一次提交（`21fec8b` 20:46:32）**——串行执行不可能产生该序（pr-002 的首笔 `00e9b58` 20:22:28 又在 pr-001 首笔 `fafdb45` 20:33:30 **之前**，两条工作流交错推进）。
  ③ **同基点、互不包含**：两分支 tip 的 `git merge-base 4101e0b <tip>` 均为 `4101e0b`；`git merge-base --is-ancestor` 双向检查 ⇒ `2182b8b` **不是** `21fec8b` 的祖先、`21fec8b` **不是** `2182b8b` 的祖先。
  ④ **清理证据**：`git worktree list` 现仅 2 项（主工作区 `main`、任务工作区 `iteration/0023-…`）；`.git/worktrees/` 仅剩 `0023-yolo-approval-and-question-inbox`；`git branch --list '*0023*'` 仅迭代分支 ⇒ 首波两条 `feat/0023-pr-00{1,2}-*` 的 worktree 与分支确已清理（清理动作本身即"曾存在"的旁证）。
  ⑤ 独立二次核查：`progress.md:78-104`（他人快照，仅作交叉参考、不作依据）结论一致，并同样记「直接证实不可得」。

- **B2（并发配置区块真实初始化与更新）**：**pass**
  证据（`git show <rev>:…/status.md` 同一区块两版本对比）：
  - **初始化**（阶段 4→5 入口提交 `4101e0b`，20:05:51）：`## 并发配置（阶段 5）` 五字段**均已赋值** —— `起始并发数 = 3` / `硬上限 = 5（公式 2×起始-1）` / `当前有效上限 = 3` / `累计槛位释放次数 = 0` / `已派发总数 = 0`；同版 `PR 实现子状态` 表三行 `⬜`、`depends_on` 列已填、依赖图行已写。
  - **真实更新**（`77600f5`，21:01:10；`git diff 4101e0b 77600f5 -- status.md`）：`当前有效上限 3 → 5`、`累计槛位释放次数 0 → 2`、`已派发总数 0 → 10`、`PR 实现子状态` 表 pr-001 / pr-002 行 → `✅ 已完成 / ✅（0123dcb、6dedd23）/ 已释放`、pr-003 行 → `⏸ 实现完成、验收中 / 占用`、`当前阶段` → `末波验收中` ⇒ **不是"初始化后再未变化"**。
  - 终态读取（HEAD）：五字段有值且含 `历次释放：pr-001 / pr-002` 的明细括注。

- **B3（爬升公式真实触发）**：**pass**
  证据：该迭代达到过爬升条件（累计槛位释放 2 次）。规范公式 `min(起始并发数 + 累计槛位释放次数 × 起始并发数, 硬上限)` 代入 `min(3 + 2×3, 5) = 5`；`status.md` 终态 `当前有效上限 = **5**（= min(3 + 2×3, 5)，**触硬上限**）`，与 `4101e0b` 版初始值 `3` 不同 ⇒ **被真实重算（且触硬上限封顶），非维持初值**。同源记录：`history.md:284-286`（`0 → 2`、公式重算 = 5）。未发现"释放次数与上限值不自洽"的第三值（首轮的 `= 3` 误算已在 `77600f5` 更正为 5，我按公式独立重算 = 5，与其一致）。

### 标准 C · 需求效果 E1~E9（真实运行面）

> 全部场景：真实 `oamp router/web/agent` + 真实 `omp`（`--model deepseek/deepseek-v4-flash`，角色文件 = 临时 `probe` 角色）+ 真实 HTTP/SSE；`omp` 经包装脚本记录真实 argv；每次起栈均用临时 socket/DB 与非默认端口。

- **C1（E1 默认档零门）**：**pass**
  证据（场景 A，`/tmp/verify-0023-stage6/tmpA/scenario-A.json`）：默认配置（无 `--approval-mode`、无 config 第 5 键）起 `e1-yolo`（`--permission allow --tools on`，rpc）。真实 argv = `--mode rpc --no-skills --no-rules --no-session --model deepseek/deepseek-v4-flash --append-system-prompt <tmp>/roles/probe/probe.md --approval-mode yolo`；`AGENT_START` 行含 `approval=yolo permission=allow`。一轮要求"write 写文件 + bash echo"：**13 次 `/api/confirmations` 采样 maxCount = 0、`anyNonZero=false`；全局 `/api/events` 的 `confirmation` 帧数 = 0**；工具确实产生后果（`<tmp>/workspace/e1.txt` 内容 = `stage6-yolo-ok`；`out` 消息自述两件均完成，轮次 `completed`，耗时 6.7s）⇒ E1 两半句同时成立。

- **C2（E2 `deny` 档仍能拒）**：**pass**
  证据（场景 B，`tmpB/scenario-B.json`）：`--permission deny --approval-mode yolo` 实例 `e2-deny`。真实 argv 末段 = `--approval-mode always-ask`（`AGENT_START`：`permission=deny approval=always-ask`）。一次受门禁调用（bash）：`/api/confirmations` 8 次采样 **maxCount = 0**，全局 `confirmation` 帧 = 0；对话记录 `out` 消息 `error = "permission_denied"`（文本「审批门无收件人（permission=deny 档）：该轮已中止」）、`chat_state: working → failed` ⇒ **rpc 链路观测面（MI-02）：该轮以 `permission_denied` 中止 + 收件箱零新增条目**，两条同向成立。

- **C3（E3 提问上浮两条链路）**：**pass**
  证据：① rpc（场景 C）：条目 `request_kind:"question"`、`title:"优先保证哪一点？"`、`options:[{option_id:"思考过程可见"},{option_id:"工具调用可审批"}]`、`multiple:false`、`tool:null`，上浮耗时 5.0s；全局 `confirmation` 帧**恰 1 条**（与 §3.20 列表元素同形状）。② acp（场景 D）：一帧三问 ⇒ 3 条 `request_kind:"question"` 条目（`title` 逐条 = 问题文本、`options` 原样、第 2 问 `multiple:true`；`distinctIds=3`）。两条链路各至少一次 ⇒ E3 成立。

- **C4（E4 作答回传含自由文本 + 零新增 chat 输入）**：**pass**
  证据：
  ① rpc（场景 C）：作答 `{option_ids:['工具调用可审批'], text:'自由文本-必须回传-0023'}` ⇒ `200 {accepted:true}`、条目移出（列表归零）、轮次由 `working` → `completed`（2.0s）；提问侧复述 `"选项：**工具调用可审批** / 文本：**自由文本-必须回传-0023**"` ⇒ **选项与自由文本逐字回传**；对话记录 `in` 消息数 **1 → 1**（零新增用户消息）。
  ② acp 多选并存（场景 H，判定性复跑）：单问多选 + `{option_ids:['web.js','rpc-client.js'], text:'并存文本-H'}` ⇒ 提问侧复述 `"选中项：web.js / rpc-client.js；自定义文本：并存文本-H"` ⇒ **两者并存均到达**；`in` 计数 1。
  ③ acp 多选无文本（场景 D2）：`{option_ids:['web.js','rpc-client.js']}` ⇒ 复述两项逐字；`in` 计数 1。
  ④ 纯自由文本（场景 G）：`{text:'纯自由文本作答-0023-必须逐字回传'}` ⇒ 提问侧逐字复述；`in` 计数 1。
  ⑤ 空提交（场景 G）：`{option_ids:[], text:'   '}` ⇒ **400 `INVALID_PARAM`**（`option_ids 须为字符串数组、⊆ 该条的选项集合，且与 text 至少一个非空`）且**条目保留在途**（`entryStillPending=true`，轮次仍 `working`）⇒ MI-03 口径在真实链路成立。
  ⚠ **观察舍入已排除**：场景 D 的运行中，模型对"多选 + 文本并存"的第 2 问自述为「无勾选项」；为排除实现缺陷，我另做 H（同形单问复跑）与自写上游探针 `probe-acp-multi-text.mjs`（直接对真实 `omp acp` 回 `{q0:['web.js','rpc-client.js'], q0__other:'上游探针文本'}` ⇒ 模型复述 **两者都在**）⇒ 该差异归因于**模型自述噪声**，非实现行为；实现侧映射 `readQuestionContent`（`src/acp-client.js:158-172`）对数组型恒发数组、文本另由 `__other` 承载，无丢弃分支。

- **C5（E5 未作答保持阻塞）**：**pass**
  证据：① rpc（场景 C）：条目上浮后**挂起 25.0s**（`elapsedMs=25003`）复查 —— 条目仍在（`entryStillPresent=true`，`confirmationsCount=1`）、对话 `state=working`、`out` 消息数 0、`errors=[]`（无超时收尾、无自动裁决、无代答拒绝）。② acp（场景 D2）：挂起 20.0s ⇒ `count=2`、`state=working`、`outCount=0`、无 error。③ 全仓无新增计时面：`git diff 4101e0b 11dc502 -- oamp/src` 新增行中 `setTimeout|setInterval` 命中 **0**（提问路径只复用 `freeze/thawTurnTimer` / `_pauseTurnTimer`）。

- **C6（E6 `always-ask` 档必须实际跑通）**：**pass**
  证据（场景 E，`tmpE/scenario-E.json`）：`--approval-mode always-ask` 实例 `e6-ask`，一次 bash 调用 ⇒ 收件箱出现 `request_kind:"permission"`、`tool:"bash"`、`title:"Allow tool: bash\nCommand: echo e6-gate-ran"`、`options:["Approve","Deny"]`、`multiple:false`；裁决 `{option_id:'Approve'}` ⇒ `200`、条目归零、轮次 `completed`、`out` 文本「已执行，输出：`e6-gate-ran`」⇒ **门不仅存在，且真实可裁决并推进该轮**（非"仅保留代码路径"）。

- **C7（E7 默认档偶发门仍可裁决）**：**pass**
  证据（场景 E 后半）：默认档（真实 argv = `--approval-mode yolo`）实例 `e7-policy`，经包装脚本给真实 `omp` 追加**临时 overlay** `--config=<tmp>/overlay-bash-prompt.yml`（内容 `tools:\n  approval:\n    bash: prompt\n`，未触碰 `~/.omp`）⇒ bash 调用上浮为 `permission` 条目（同形：`tool:"bash"`、`title:"Allow tool: bash\nCommand: echo e7-policy-gate-ran"`、`options:["Approve","Deny"]`）；裁决 `Approve` ⇒ `200`、轮次 `completed`、`out` 文本「已执行，输出：`e7-policy-gate-ran`」⇒ 偶发门可裁决成立。

- **C8（E8 档位两值可配且 `deny` 优先）**：**pass**
  证据（场景 F，`tmpF/scenario-F.json`）：
  ① **可配**：`OAMP_CONFIG=<tmp>/cfg-ask.json`（`{"approval":"always-ask"}`）⇒ 真实 argv `--approval-mode always-ask`、`AGENT_START approval=always-ask`，且行为随之变（bash 调用产门、裁决后执行）；`cfg-yolo.json`（`{"approval":"yolo"}`）⇒ argv `--approval-mode yolo`、一轮 bash 零门（`confirmations=0`、`out`「已执行，输出：`f-yolo-ran`」）⇒ 两值均可配且行为面同向。
  ② **取值域仅两值 + 响亮失败**（真实 CLI）：`agent start x-bogus --approval-mode bogus` ⇒ **exit 2** + stderr `oamp: agent start: --approval-mode 仅支持 always-ask|yolo: "bogus"`；`--approval-mode`（缺值）⇒ **exit 2** + `--approval-mode 缺少取值`；`OAMP_CONFIG=cfg-bogus.json`（`{"approval":"write"}`）⇒ **exit 1** + `OAMP 配置错误: approval 仅支持 always-ask/yolo（当前值 "write"）`。直跑 `resolveApproval`：`write` / `tier` 均抛出 `OAMP 配置错误`，无静默回落。
  ③ **`deny` 优先**：`--permission deny` + 显式 `--approval-mode yolo` ⇒ argv `always-ask`（场景 B）⇒ 优先级成立。

- **C9（E9 多问题一问一条）**：**pass**
  证据（场景 D）：acp 一次 `ask` 携 3 问 ⇒ 收件箱**恰 3 条独立条目**（`distinctIds=3`，`title` 分别 = 三问文本、`options` 原样、第 2 问 `multiple:true`，**无 `questions[]` 大信封**）；逐条作答：答第 1 条后 `remaining=2`、答第 2 条后 `remaining=1`，两问各自身 `chatState=working` / `outCount=0`（**齐答前该轮不推进**）；答第 3 条后轮次 `completed`（2.0s）并由 `out` 消息逐问复述答案 ⇒ 一问一条 + 齐答回pack 成立。
  补充（场景 D2）：一帧两问 ⇒ 2 条条目；只答多选那条 ⇒ `remaining=1`、`working`、`outCount=0`（其余条目独立可答）。

### 标准 D · 边界与保证项（N1~N12 / F12~F16 终态可核实）

| 项 | 判定 | 终态证据（可定位） |
|---|---|---|
| N1 不落中间档 | pass | `src/config.js` 的 `APPROVAL_VALUES = new Set(['always-ask','yolo'])`（全迭代 `oamp/` 内无 `write`/`tier` 作为档位取值；`grep` 档位取值面仅两值）；CLI 实测 `bogus` / `write` / `tier` 全部响亮失败（场景 F） |
| N2 不做自动裁决策略 / 超时退化 | pass | 提问路径新增行中 `setTimeout/setInterval` = 0；`config.js` 未引入任何 `ask.*` / 超时键（diff 仅 `approval` + `APPROVAL_VALUES`）；场景 C/D2 挂起 25s/20s 无超时收尾、无自动选 |
| N3 不改 omp / harness 源码与协议 | pass | `git diff --name-only baee09d 11dc502` 不含 `omp/**` 或 harness 路径；8 组场景全部以未打补丁的真实 `omp` 二进制运行 |
| N4 不新增工具调用审计面 | pass | `git diff -U0 4101e0b 11dc502 -- oamp/src \| grep '^+' \| grep -E 'TOOL_APPROVED\|TOOL_DENIED\|TOOL_CALL'` = 空；rpc 拒绝路径复用既有 `permission_denied`（`src/rpc-client.js:347`）；场景 B 全程无审批行载体 |
| N5 一次性 `omp -p` / `!` shell 不上浮 | pass | `oamp/src/oneshot-client.js` 中 `onQuestionRequest` 命中数 = 0（`rpc-client=4` / `acp-client=6`）；`web.js` diff 的 4 个 hunk 均在确认面（`:20/:1258/:1269/:1299/:1593`），未触及 `!` 前缀 shell 分支（diff 中 `startsWith('!')`/shell 命中 = 空） |
| N6 不新增通知事件类型 | pass | `oamp/web/notify.js` 全迭代零改动（`EVENT_TYPES = ['chat_completed','chat_failed','confirmation_required']` 原样）；`web.js` 的 SSE/通知类型集合前后逐字相同（`agent_online/agent_offline/chat_state/confirmation/message/notice/task_update`）；提问类沿用既有 `confirmation` 帧与 `confirmation_request` 通知（`src/agent.js:299`） |
| N7 不做通知分级 / 免打扰 / 其它入口 | pass | 同上（notify.js 零改动）+ 路由登记数 21 ↔ 21（无新入口 / 无新查询参数）；`index.html` 零改动 |
| N8 不改服务边界 | pass | 实跑 `lsof`：web 进程唯一 LISTEN = `TCP 127.0.0.1:<port>`；`web.js` diff 中 `listen/auth/token/host` 命中 = 空 |
| N9 不做确认项历史 / 审计台账 | pass | `src/inbox.js` / `src/persist.js` 全迭代零改动（无新表 / 新列 / 新导出）；`GET /api/confirmations` 仍只返回在途项（场景 C/D2/G：裁决后立即为空）；无已裁决项的读取入口（路由数不变） |
| N10 不引入第三方依赖 | pass | `oamp/package.json` `"dependencies": {}` 前后逐字相同；全量套件（含 `test/hygiene.test.js`）387/387 绿 |
| N11 不改第三栏载体与既有交互面 | pass | `oamp/web/index.html` / `oamp/web/notify.js` 零改动；`6dedd23..4162fff` 的 `web/app.js` **唯一删除行** = 一行 JSDoc 注释（`-/** 一条（T-02 三行 + T-03 控件）：… */`），permission 分支与 `decide()` 实体代码零删除；`style.css` 为 `19/0` 纯追加 |
| N12 不做提问类无人时自动拒绝 / 作答兜底 | pass | `src/rpc-client.js:398-422`：无收件人 / 钩子抛错 ⇒ `isError:true` 说明文本或 `host_tool_result` 说明文本，**绝不代答**；`src/acp-client.js:691,705`：未知形状 / 无收件人 ⇒ 既有 `decline`（非提问面）——提问面本身恒注入（`src/context-pool.js:202-206`），场景 C/D2/G 挂起期无任何自动拒绝 |
| F12 不改上游（保证项） | pass | 同 N3 |
| F13 不新增审计面（保证项） | pass | 同 N4（另：`TOOL_CALL` 面未受影响，diff 无相关增删） |
| F14 服务边界（保证项） | pass | 同 N8 |
| F15 无历史台账（保证项） | pass | 同 N9 |
| F16 零依赖（保证项） | pass | 同 N10 |

**全量套件终态复核**（真实运行，非采信报告）：`cd oamp && node --test test/*.test.js` ⇒ `1..387 / # pass 387 / # fail 0 / # cancelled 0 / # skipped 0`，退出码 0，耗时 69.1s（与 `status.md` / `progress.md` 声称的 387/387 一致）。

### 标准 E · 搭置与偏差台账

- **E1（核实 `docs/iterations/0023-…/deferred-demand-changes.md` 是否存在）**：**pass（不存在 ⇒ 无原文可摘录）**
  证据：`find . -name 'deferred-demand-changes*'`（在整个任务工作区内，排除 `node_modules`）**零命中**；`glob docs/iterations/0023-…/**` 的 60 文件清单中无该文件；`grep -rn "deferred-demand-changes" docs/iterations/0023-…/` 亦零命中（仅 `roles/workflow-pb/workflow-pb.md` 的规范文本提及该文件名）。⇒ 本迭代**无搭置的需求变更 / 需求错误记录**，无需摘录，亦无"是否发起新迭代"的搭置依据。

- **E2（核实 `status.md`「已知偏差登记」逐条当前状态）**：**pass（口径更正后按台账实质执行）**
  **口径更正（先声明，不隐藏）**：委托把台账位置写为 `status.md` 的「已知偏差登记」区块；**该区块在终态不存在** —— `grep -rn "已知偏差\|偏差登记" docs/iterations/0023-…/` 零命中；`status.md` 全文 56 行仅含「工作流进度 / 阶段状态 / 待确认项 / PR 实现子状态 / 并发配置 / 更新日志」六节。迭代内偏差的实际台账形态 = 各验证报告的「偏差记录」区块（`clarifications/verify-stage4-gate-*-20260914.md`、`verify-pr-00{1,2,3}-20260914.md`）+ `history.md` 的裁定条目。若按「字面位置」严格判读，该项应为 blocked（缺该区块）；本报告按**台账实质**（"迭代内已登记偏差的逐条当前状态"）执行，逐条状态如下（该口径差已记入偏差记录 D-8）：
  | 台账来源 | 条目 | 终态状态（本次实读） |
  |---|---|---|
  | Gate r2 `verify-stage4-gate-r2` | **G2-D1** `config.js` 锚点 `:41` 应为 `:49` | **未同步**：`prs/pr-001-…md:29` 仍写 `function readProtocol`（:41）、`loadConfig`（:121）、`protocol:`（:145）；实测 `4101e0b` 版 `readProtocol` 在 `:49`、HEAD 在 `:52`，`loadConfig` HEAD 在 `:136`。裁定只落进 `pr-001-tasks.md`（以 `:49` 为准），PR 文件正文未回写 |
  | 同上 | **G2-D2** 漏列 `test/protocol-layer.test.js:535` 的 `buildArgv` 调用点 | **实质闭合**：HEAD 该文件 `buildArgv(` 调用点 = `:317 / :651 / :664 / :665 / :669 / :691`，且 `buildArgv` 对未给档位**响亮失败**（`src/launcher.js:113-115`）⇒ 任何漏迁移点都会导致测试红；全量 387/387 绿 ⇒ 迁移无遗漏（PR 文件内的行号锚点仍为旧值 `:278/:495-514`） |
  | 同上 | **G2-D3** 路由 `summary` 文案与 `llms.txt` 漂移锁未声明 | **已处置**：`oamp/llms.txt` 在 pr-002 分支重生成（分支 diff 含该文件），`api-routes` / 项目工作区漂移锁在终态全量套件中全绿 |
  | 同上 | **G2-D4** `rpc-client.js` 能力位 `hostTools:'no'` 与事实不符 | **已修复**：`src/rpc-client.js:51` = `hostTools: 'yes'` 且 note 已改（`// 已接线：握手后注册 \`ask_user\` 并承接 \`host_tool_call\`（§5.4 / G2-D4）`） |
  | 同上 | **G2-D5** `status.md` 阶段 3 备注版本号陈旧 | **已修复**：终态 `status.md` 阶段 3 行 = `architecture.md **v0.3.0**（758 行）…` |
  | `verify-pr-001` | D-1 `architecture §5.4` 回包含 `details:{}` | **未同步**：`architecture.md:494` 仍写 `host_tool_result{id, result:{content:[{type:'text',text}], details:{}}}`；实现（`src/rpc-client.js:375-379`）不发 `details` |
  | `verify-pr-001` | D-2 `launcher.js` 的 `appliesWhen` 统一为 `'tools-on'` 未回写 | **未同步**：PR 文件仍写「保留 `appliesWhen`」；实测五行（`src/launcher.js:22,37,52,68,83`）均为 `appliesWhen: 'tools-on'` |
  | `verify-pr-001` | D-3 `config.js` 锚点 `:41` → `:49` | 同 G2-D1（未同步） |
  | `verify-pr-001` | D-4 `prd/F04` 验收 2 未限定适用面 | **未回写**：`prd/F04-question-surfacing.md:18` 字面仍为「提问请求**不再**被自动回 `{cancelled:true}` / `decline`」（无来源帧型限定）；实现的两条提问通路确不回这两类回执（`rpc-client.js` 走 `host_tool_result`、`acp-client.js` 走 `accept`） |
  | `verify-pr-002` | D-1 `API.md §4.2` `confirmation` 行 7 字段与 §3.20 矛盾 | **已修复**：`oamp/API.md:1011` 终态 = 9 字段（`…request_kind…multiple…`），与 §3.20 同形状；修复提交 `21fec8b` |
  | `verify-pr-002` | D-2 `multiple` 是否按类钳制的文档↔实现口径差 | **半处置**：实现侧口径（`multiple: body.multiple === true`，不按类钳制）已写入 `API.md:945`；但 `architecture.md:406` 的 §5.2 字段表仍写 permission 类 = `false` ⇒ 文档内部两处口径不一致（记入本报告偏差 D-3） |
  | `verify-pr-002` | D-3 分支 diff 含规划产物 `pr-002-tasks.md` | **维持原判**（体例同前序迭代；主 agent 未改判），不影响代码面封闭（`oamp/` 改动面恰 4 文件） |
  | `verify-pr-003` | D-1 `architecture §9.2` 说 `decide()` body 按 `request_kind` 分化，实现为两条独立路径 | **未同步**：`architecture.md:617` 原文未改；实现 = `decide()` 逐字未动 + 新增 `submitQuestion()`（`oamp/web/app.js`，diff 唯一删除行是一行 JSDoc） |
  | `verify-pr-003` | D-2 / D-3 `prs/pr-003-tasks.md` 在迭代工作区不存在 | **已闭合**：终态该文件在位（`docs/iterations/0023-…/prs/pr-003-tasks.md`，40214 字节，提交 `d90e6e0` 20:52:50，随 `77600f5` 落入迭代分支） |
  | `progress.md`（他人快照，仅交叉参考） | §5-1 status.md 阶段 5 口径陈旧 / §5-2 并发字段未更新 / §5-3 上限公式误算 / §5-4 时间戳超前 / §5-5 派发-报告不配对 / §5-6 产物未落库 | 逐条复核：§5-1/§5-3 **已修正**（并发区块与「有效上限 5」已更新，见 B2/B3）；§5-2 **已修正**（`累计槛位释放 = 2`、`已派发总数 = 10`）；§5-6 **基本落库但有一处例外**（逐条 `git ls-files clarifications/` 实测：`verify-pr-001` / `verify-pr-002` / `stage5-wave{1,2}-verdicts` / `history.md` 均已跟踪；**`verify-pr-003-20260914.md` 在终态仍为未跟踪文件 `??`**，见偏差 D-10）；§5-4/§5-5 属**历史流水时间戳**，终态不可重写（`history.md` 为追加式记录）⇒ 保留为既有事实，不再构成状态漂移 |

---

## 汇总

- **pass：34 项**（A1 / A2 / A3；B1 / B2 / B3；C1~C9；D：N1~N12 + F12~F16 = 17 项；E1 / E2）
- **fail：0 项**
- **partial：0 项**
- **blocked：0 项**（E2 的"委托把台账位置写成 `status.md` 区块"经实测该区块不存在 ⇒ 未按字面判 blocked，而是按台账实质执行并在报告内显式声明口径更正；若主 agent 坚持字面位置语义，该条应读作 blocked——口径差已记入偏差 D-8，由主 agent 裁定）
- 附加实测：`oamp` 全量套件 **387/387 pass / 0 fail**（exit 0，69.1s）

## 偏差记录

> 实现与规格/文档不一致之处，**不影响上述逐项判定**（判定依据是验收标准，不是文档一致性）；每条给出终态当前位置与建议处理。

| # | 规格/文档描述 | 实现实际行为 | 建议处理 |
|---|---|---|---|
| D-1 | `architecture.md:494`（§5.4 承接行）：`host_tool_result{id, result:{content:[{type:'text',text}], details:{}}}` | `src/rpc-client.js:375-379` 回包**不含** `details`（与 A18 探针实测帧形一致，omp 侧无需该键） | 按实现更新该行（去掉 `details:{}`）；与 `verify-pr-001` D-1 同源，属未处置的文档残留 |
| D-2 | `prs/pr-001-…md:29`（及同文件其它检索式）的代码基线锚点：`readProtocol`（:41）/ `loadConfig`（:121）/ `protocol:`（:145） | 实测 `4101e0b`：`readProtocol` 在 `:49`；HEAD：`readProtocol:52` / `readApproval:63` / `loadConfig:136`；同文件测试迁移点写 `:278/:495-514`，HEAD 实为 `:317/:651/:664/:665/:669/:691` | 阶段 6 收口或下一迭代统一刷新 PR 文件锚点（Gate r2 G2-D1 的裁定只落了任务图）；或在 PR 文件内改引「符号名 + 检索式」不再写绝对行号 |
| D-3 | `architecture.md:406`（§5.2 字段表）`multiple` 的 permission 类 = `false`（按类钳制口径） | `src/web.js:1625` = `multiple: body.multiple === true`（**不按类钳制**，API.md:945 已按此改写）⇒ 同一事实在架构与 API 文档中口径不一致（生产面 `src/agent.js:294` 对 permission 类恒投 `false`，故当前无外部可观测差异） | 二选一并同步：① 架构表 permission 类列改为「不携带该键 / 读作 false」；② 实现加 `request_kind === 'question' &&` 钳制。`verify-pr-002` D-2 的 (a) 处置未覆盖架构 |
| D-4 | `architecture.md:617`（§9.2）：`decide()` body 按 `request_kind` 提交 `{option_ids,text}` / `{option_id,text}` | 实现为两条独立路径：`decide()` 逐字未动（permission 恒 `{option_id,text}`）+ 新增 `submitQuestion()`；`pr-003` 报告 D-1 已记录，但架构未改 | 按实现更新 §9.2 措辞（`decide()` 不分化 + `submitQuestion()` 承载 question 类） |
| D-5 | `prs/pr-001-…md` 文件范围行写 `launcher.js`「五行的 `approval.mode` 删除、**保留 `appliesWhen`**」 | 实测 `src/launcher.js:22,37,52,68,83` 五行的 `appliesWhen` 已**统一为 `'tools-on'`**（一次性路径的 argv 逐字不变，行为等价） | 在 PR 文件范围行或 `architecture.md` §4.2 L2-2 补一句统一后的形态（`verify-pr-001` D-2 同源） |
| D-6 | `prd/F04-question-surfacing.md:18` 字面「提问请求**不再**被自动回 `{cancelled:true}` / `decline`」（未限定来源帧型） | rpc 的 `INTERACTIVE_METHODS`（`src/rpc-client.js:24,437-439`）与 acp 的未知形状分支（`src/acp-client.js:691,705`）仍回这两类回执；提问通路本身（`ask_user` / 非门 elicitation）不回 | 在 `prd/F04` 验收 2 补适用面限定（`verify-pr-001` D-4 同源）；不改产品语义 |
| D-7 | `prs/pr-002-…md` 「文件范围」列 4 文件；`pr-002-tasks.md` §0.1「唯一可写面（`git diff --stat` 超出即不通过）」 | 分支 diff 含第 5 个文件 `prs/pr-002-tasks.md`（+187，独立 docs 提交）；pr-001 / pr-003 同形态（各含 1 份 `*-tasks.md`） | 主 agent 明确"规划产物是否计入改动面"并统一表述（建议：`oamp/` 面恰 N 文件 + 零改动清单逐条不出现）——`verify-pr-002` D-3 的同一问题 |
| D-8 | 委托标准 E2 指向 `status.md`「已知偏差登记」区块 | 该区块**不存在**（`grep -rn "已知偏差\|偏差登记"` 零命中；status.md 六节全文 56 行）；迭代偏差实际散落于 5 份验证报告的「偏差记录」区块 + `history.md` 裁定条目，且部分条目（D-1/D-2/D-4/D-5/D-6）在终态仍未被任何区块跟踪 | 建议下一迭代把「已知偏差台账」固定为单一可定位区块（如 `status.md` 增设该节，或明确"以 clarifications/verify-*.md 的偏差记录为准"），避免阶段 6 台账定位失真 |
| D-9 | `status.md` 头部/阶段表/PR 子状态声称（当前阶段「末波验收中」、阶段 5 行 `⏸`、pr-003 行「⏸ 实现完成、验收中」、pr-003 `已合并` 列 `⬜`、阶段 6 行 `—`） | git 终态：pr-003 已合并（`11dc502` 21:06:25，真双亲 merge）、验收报告已产出（`clarifications/verify-pr-003-20260914.md`）、阶段 6 正在执行 | 主 agent 在阶段 6 收口时把 `status.md` 的阶段 5/6 与 pr-003 行同步到终态（`progress.md` 快照已先行记录该漂移类问题） |

| D-10 | 迭代终态产物应当全部入库（`progress.md` §5-6 的漂移类问题已被处置） | `git status --porcelain docs/iterations/0023-…/` 在终态显示 **1 个未跟踪产物**：`clarifications/verify-pr-003-20260914.md`（21:00 产出、`77600f5` / `11dc502` 两次提交均未纳入）；`git ls-files clarifications/` 共 34 个已跟踪文件不含它 | 阶段 6 收口时把 `verify-pr-003-20260914.md` 与本报告一并落库（本报告的落盘属委托授权；该文件的入库决定由主 agent 作出）；`status.md` 声称 pr-003「验收中」亦应同步为「已验收」 |
**偏差计数：10 条**（其中 D-1/D-2/D-3/D-4/D-5/D-6/D-9/D-10 为终态仍存在的文档/状态/入库残留；D-7 为体例口径待裁；D-8 为流程台账定位问题）。**均不阻塞交付**，不构成任何 fail。

## 下一迭代候选

- **通知正文模板对 question 不贴切**：`oamp/web/notify.js` 零改动 ⇒ question 类条目的浏览器通知仍用 permission 口径文案（`请求执行 ask_user：…`），与栏内「取舍 + 提交」交互不匹配（`verify-pr-003` N-1 同源；我复核 notify.js 确为全迭代零改动）。
- **question 提交失败无用户可见反馈**：`submitQuestion` 的失败分支只「保留条目 + 重绘」，MI-03 的 400 在界面上表现为"按钮闪回"（`verify-pr-003` N-2）。
- **`call-protocol.test.js` 的 `API.md` 绝对行号窗口是脆弱耦合**：任何 ±10 行以上的文档改动都可能让零改动文件转红（`verify-pr-002` 候选 1）；建议换成语义锚点切片。
- **测试助手 `entryOf` 复刻服务端兜底口径**：`test/confirmation-inbox.test.js` 里复刻了 `request_kind` / `multiple` 兜底规则，与 `src/web.js:1619,1625` 等价但会静默同步回归（`verify-pr-002` 候选 4）；建议加一条直击服务端的兜底断言。
- **acp 单选 + 自由文本并存的「文本胜出」需跟踪上游版本**：本轮 H2 实证（真实 oamp 栈：单选 + `agent.js` + 文本 ⇒ 提问侧只得文本）与 `architecture.md §2.7 / §12.1 Q-1` 的登记一致（用户已裁"登记为必然差异"）；若未来 omp 放开单值形状双值承载，唯一回改点 = `src/acp-client.js:158-172` 的 `readQuestionContent`。
- **多选 + 文本并存无问题**（本轮 H 实证两者都在）——请勿据场景 D 的模型自述把它当成已知限制。
- **`launcher.js` 的 `appliesWhen` 已退化单值**：五行统一 `'tools-on'` 后该字段不再承载分支，可考虑降级为文档注释（`verify-pr-001` 候选 3）。
- **`buildArgv` 未给档位即抛错的响亮面缺直接单测**：当前仅由装配面间接覆盖（`verify-pr-001` 候选 4）。
- **阶段 6 台账定位**：把「已知偏差登记」固定到单一可定位区块（见 D-8）；并把"文档面残留偏差"（D-1/D-2/D-3/D-4/D-5/D-6）在一次定点收口中统一清偿或显式豁免。

## 验证方法限制（可复查性说明）

1. **B1 的"磁盘同时存在"无法直接观测**：首波两条 worktree 与分支在合并后被清理（`git worktree list` / `.git/worktrees/` / `git branch --list` 均无痕），无历史 worktree 清单快照。本报告以「同刻派发记录 + 提交时间窗真实重叠 + 同基点互不包含 + 清理证据」构成证据链判定 pass；**若主 agent 要求"磁盘级直接证据"，该条应读作 partial**——这是我能在终态取得的最强证据，不代为声称更强。
2. **C 组各场景的模型行为（是否调用工具、复述内容）属 LLM 非确定性输出**：判定均锚在**结构性事实**（条目是否出现、字段形状、HTTP 状态码、条目增减、对话记录 in/out 计数、argv 取值、进程退出码）上；模型自述只用于"工具确实产生后果"的辅助确认，且已就场景 D 的自述噪声做了 H/H2 复跑与上游探针的三角验证。
3. **各场景均使用真实模型 `deepseek/deepseek-v4-flash`**（仓库默认），未做多模型交叉；模型替换不影响上述结构性判定，但会影响单次运行的耗时与自述文本。
4. **场景 D 与 D2 的 acp 多问形态由提示词驱动真实模型调用 `ask` 工具产生**（与 `clarifications/probes/probe-a2-acp-ask-form.mjs` 的驱动方式同形），非手工构造帧；因此条目数 `N=3` / `N=2` 是真实上游行为，不是假设。

## 结论

**PASS**

依据：34 项标准全部 pass、0 fail / 0 partial / 0 blocked；A 组三条 PR 粒度与依赖声明在终态与真实 diff 逐条相符（文件集合两两不相交、依赖边物理满足）；B 组工作流三项强制核查均取得真实执行证据（时间窗重叠 24 分钟、并发区块五字段真实初始化 + 逐项更新、爬升公式 `min(3+2×3,5)=5` 真实触发）；C 组 E1~E9 全部在真实隔离栈（真实 `omp` + 真实 HTTP/SSE）跑通，覆盖默认档零门 / `deny` 档 `permission_denied` 收尾 / 两条链路提问上浮 / 答案本体（含自由文本）回传且零新增用户消息 / 未作答 20~25s 保持阻塞 / `always-ask` 门真实可裁决 / 默认档偶发门可裁决 / 档位两值可配与 `deny` 优先（含三种非法值响亮失败）/ 多问题一问一条与齐答回包；D 组 N1~N12 与 F12~F16 的 17 项边界在终态代码、diff 与实测面均可核实，且 `oamp` 全量套件 387/387 绿；E 组确认无 `deferred-demand-changes.md`（无搭置需求变更），并逐条核实了迭代内已登记偏差的终态状态（其中 8 条仍为未清偿的文档/状态同步残留，已全部登记为偏差，按角色契约不阻塞关闭）。

**10 条偏差已显式记录**（不阻塞本迭代关闭），其中 D-1~D-6 建议在一次定点收口中一并清偿文档，D-8/D-9/D-10 建议在阶段 6 收口时同步 `status.md`、固定偏差台账位置并把 `verify-pr-003` 报告一并落库。
