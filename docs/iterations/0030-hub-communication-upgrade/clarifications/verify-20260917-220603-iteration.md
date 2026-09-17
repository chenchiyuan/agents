运行所用模型标识：powerby/grok-4.6

# 阶段 6 · 迭代级终验报告 — 0030-hub-communication-upgrade

**判定（总分）**: **pass**
**验证者**: VerIteration（独立 verifier；不采信执行方自证）
**取证时刻**: 2026-09-17 22:06
**被验产物**: 工作区 `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade`，迭代分支 `iteration/0030-hub-communication-upgrade`
- 委托 tip：`a291343`（oamp 14 路径相对 main 的最终代码态）
- 工作区 HEAD：`809f259`（`a291343` 的子孙；`git diff --stat a291343 HEAD -- oamp` 为空 ⇒ oamp 面与 `a291343` 逐字节相同。HEAD 仅多两笔阶段 6 派发记账：`09e90fb` / `809f259`，文件 = `status.md` + `history.md`）
- main 基线：`706e3d0`（**尚未**合入本迭代）

**取证层次约定**：全链路 = `/tmp` 隔离塔（真 Router + 真 web + 假 omp 节点）；静态读码 = 源文件/git；隔离塔 = 压缩阈值运行时。

---

## 搭置的需求变更/错误报告（强制置顶 · 原文摘录 · 不对内容二次判断）

**路径（委托显式传入）**: `docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md`
**搭置条数**：**5**（五个 `## YYYY-MM-DD · …` 节）

以下为该文件**全文原文**（不转述、不总结）：

```markdown
# deferred-demand-changes.md — 0030-hub-communication-upgrade

> 本文件由执行侧直接写入（不回退、不暂停）：执行角色或阶段 1 内联执行者发现"要改 `demand.md` 结论才能解决"的问题时追加，供本迭代末与下一迭代决策。
> 本迭代按已落盘的 `demand.md` 继续，不等用户裁决；条目在阶段 6 由 verifier 原文摘录置顶呈现。

## 2026-09-17 · 阶段 1（主 agent 内联执行期间的可行性实测）

**问题**：**D-35（模型路由载体 = 项目 agent 文件 `.omp/agents/<role>.md` + `.omp/config.yml` 的 `modelRoles` 别名）在本会话不可实现而不触规则 F。**

- **实测依据**（三条，可复核）：
  1. harness 的 task agent 发现根 = **会话 cwd 下的 `.omp/agents`**——探针 `.omp/agents/modelprobe.md`（frontmatter `model: openai/gpt-5.6-luna`）在仓库根被成功发现并生效；同一探针放在迭代工作区内不会被发现。
  2. 本会话的 cwd = **仓库主工作区** `/Users/chenchiyuan/projects/agents`（工作区地址是迭代工作区，两者不同）。⇒ 要让发现生效，agent 文件必须落在**仓库主工作区**的 `.omp/`；而 `data/scm-protocol.md` §规则 F 明令：会话写操作不得落在仓库主工作区（闭集例外只有"工作区创建"与"收口三步"）。
  3. 另两条候选载体亦不可用：`task` wire schema 无 per-dispatch `model` 字段（F-10）；eval 桥的 per-dispatch `model` 参数**实测被忽略**（两次探针分别指定 `openai/gpt-5.6-luna` / `powerby/grok-4.6`，子 agent 均实报 `deepseek/deepseek-v4-flash`）。
- **为什么判定为需求层面问题**：D-35 是 `demand.md` §二 的 `user_confirmed` 决策；改载体形态 = 改需求结论（"模型值集中在哪一层、以什么形态被跟踪"），不是实现路径选择。
- **本迭代如何处理**：**不回退、不暂停**——阶段 2~4 不受影响（prd / architect / pr-planner 均走默认模型，不需要该载体）；**阶段 5/6 开始前**须按方案确认门呈现的修订选项之一落地（候选：**A** 在仓库主工作区建 `.omp/`（触规则 F，但最贴合 D-35 原意）／**B** 放用户级 `~/.omp/agent/agents/`（不触 git 工作区，但路由不入版本控制）／**C** 改用 `omp -p --no-session --model X` 一次性进程（完全合规，但退出本迭代 D-33 已定的本地 subagent 通道））。选项与推荐见阶段 4→5 门口的呈交。
- **下一迭代候选**：harness 的"项目级 agent 发现根固定在会话 cwd"与本框架"工作区隔离/显式寻址"协议存在结构性冲突（会话 cwd 恒为仓库主工作区，而一切产物必须落在迭代工作区）——这是**第四次**同型摩擦（前三次：0028 G-12 PR worktree 读不到迭代产物、0028 G-2 brief 无文件通道、0029 DC-20 自建等待脚本）。若要根治，需要一次独立的协议迭代（如：为角色派发定义"发现根 = 工作区地址"的载体，或把 agent 定义改为可按路径显式传入）。

## 2026-09-17 · 阶段 3（`architect`，见 `architecture.md` §9 / §10）

**问题**：**web 进程重启期间"在飞"的调用，其终态永不会进入收件箱**（既有缺口，非本迭代引入，但本迭代的必达承诺覆盖不到它）。

- **机制**：web 侧调用登记（`tasks` / `callSchemas`）为进程内、重启即丢；Router 任务条目**不携带** `principal` / `chat_id` ⇒ 重启后无法重建归属，`handleDeliver` 查不到 `entry` 即丢弃终态。
- **为什么判定为需求层面问题**：唯一修法是"派发时先落一条半成品记录（含归属），启动时重新认领"——而 `demand.md` 的 `F03 验收 3` **明文禁止**在持久层写非终态记录（"只在终态发布那一刻写一次"）。即：修法与已确认需求结论直接冲突，须改需求才能修。
- **本迭代如何处理**：不回退不暂停，作为 **F03/F01 的已知覆盖边界**在 `architecture.md` §9-4 如实登记，验收按"终态产生**之后**发生的重启由 F03 覆盖"口径判定；本迭代按现有 demand 继续。
- **下一迭代候选**：给 Router 任务条目补 `principal`/`chat_id` 归属字段 + 启动时重新认领（需协议面扩容，独立评估）。

## 2026-09-17 · 阶段 3（`architect`，见 `architecture.md` §9-1 / §10-3）

**问题**：**`agent_error` 与 `infra_error` 在现状下只能做消费侧近似划分**——"agent 自己执行出错"与"会话/子进程基础设施失败"混在同一个自由串族（`context_crashed`）上；而效果#3 要求调用方能分辨"它崩了"与"agent 自己执行出错"。

- **机制**：精确区分须在**产生点分码**（新增轮次级 `ProtocolError` 码 + 扩展 `context-pool._failSession` 的轮次级集合 `{model_unavailable, context_busy, permission_denied, + 新码}`），否则轮次失败会被误当会话崩溃而拆会话。
- **为什么判定为需求层面问题**：该改造与 `demand.md` 的两条已确认约束正面冲突——`F04 验收 5` / `G01 验收 3` 要求既有 `error` 的键位、拼写、取值形态（含既有文案）不变，且 `F04 边界` 明文"不做既有错误文案的统一/重写"。
- **本迭代如何处理**：按决策文档的映射表把 `context_crashed` 一族整体归 `infra_error`，`agent_error` 由"`failed` 且 `error` 缺失/非字符串"与"未匹配的自由文本"两条可达路径兜底（`architecture.md` §4 A-04 裁决 3）；映射"全函数"由三段式构造性保证。作为已知局限登记（§9-1）。
- **下一迭代候选**：轮次级分码 + `_failSession` 集合扩展（须与"文案不动"约束的放宽一并裁决）。

## 2026-09-17 · 阶段 5（`dev`，F08/F09 载体判据层复核）

**问题**：**F08 边界的“模型值不以任何形式写入 `roles/**`”与其验收 5 / 架构硬约束实际采用的 `roles/*/*.md` 判据层存在层差。**判据层角色定义文件无模型键或绑定字面量，但递归 `roles/**` 仍有既有 verifier 取证报告命中模型字面量。

- **为什么判定为需求层面问题**：要消除该层差，只能改 F08 边界的措辞层，或改写既有 verifier 取证产物的落点/内容；前者改变已确认需求约束，后者篡改既有验证证据，均不是本 PR 的实现选择。
- **本迭代如何处理**：按 `model-routing-carrier.md` 的判据层声明，以 `roles/*/*.md` 的 0 命中作为 AC3 机械判据；递归层既有命中如实登记且不改写。本迭代继续按已裁决需求推进，不将该摩擦搭置当作阻塞理由。
- **下一迭代候选**：收窄 F08 边界措辞，使“角色定义文件判据层”与递归取证产物层明确分离，并补充既有取证产物的证据分类规则。

## 2026-09-17 · 阶段 3 / 阶段 5 复核（`architect`，见 `architecture.md` §9-2 / §9-13 / §10-12）

**问题**：**"派发失败"不是终态 ⇒ F01 的「必达」在同一分支上有既有空洞**——`/api/calls` 投递失败时，调用方既拿不到 `reason`、也拿不到任何失败信号（实得 HTTP 200 + 受理态 `submitted`），且该调用**永不产生终态 ⇒ 永不进入收件箱**。

- **机制（实测）**：web 侧 `sendTask` 两次重试均失败后**不抛出**（`lastErr` 未被使用、循环结束即返回 `undefined`）⇒ `/api/calls` handler 的 `catch` 分支（404 `agent 不可用` / 502 `调用派发失败`）**不可达**；`dispatch_failed` 只作为对话面 `out` 记录的自由串存在、**不在终态信封域**。基线塔实跑（真 Router + 真 web + 假节点）确认：`agent=dev` 且无实例在线 ⇒ 200 + `submitted`；404 仅由"角色不可解析"（如 `agent=nosuch-role`）触发。
- **为什么判定为需求层面问题**：唯一修法是让"派发失败"也成为一种**终态**（从而按 F01 进收件箱并带 `reason`）——那是新增/改变终态面与受理态语义（`demand.md` 的"做什么 / 不做什么"未覆盖该分支），属需求层结论变更，不是实现路径选择。
- **本迭代如何处理**：不改 `sendTask` 的吞错语义（改动会波及受理态语义与 A-06 空池回落口径，且与"受理态信封键集不变"的既有约束相邻）；F06 的空池行为按基线对齐、**不与该失败分支挂钩**（§4 A-06 / `prd/F06`），并在 `architecture.md` §9-2 / §9-13 如实登记。`sendTask` 吞错属**既有缺陷**，不在本迭代范围。
- **下一迭代候选**：① 让 `sendTask` 抛出或返回失败信号，并把"派发失败"定义为一个可落库的终态（含 `reason` 归类裁决，预计在 `infra_error` / `rejected` 之间二取一）；② 与其一并裁决"受理态信封是否应携带目标不可达的即时信号"（当前 200 + `submitted` 对调用方无失败信号）。
```

---

## 1. 产出物路径 + 验证标准清单

**产出物**
- oamp 相对 main 的 14 路径：`oamp/API.md` · `oamp/README.md` · `oamp/skill/hub.md` · `oamp/src/{acp-client,agent,config,context-pool,oneshot-client,persist,rpc-client,web}.js`（M）· `oamp/src/pickup.js`（D）· `oamp/src/{pool-routing,reason}.js`（A）
- 迭代产物：`docs/iterations/0030-hub-communication-upgrade/**`

**标准**
- A. demand.md 效果 1~6
- B. deferred-demand-changes.md 原文置顶（上节）
- C. 8 个 PR 粒度（逻辑原子性 / 可审查性 / 独立性）
- D. 7 条 depends_on 代码级证据 + 无环 + 文件范围不重叠 + F01~F09+G01 覆盖
- E. 并发三项（worktree 时间窗 / 并发配置 git 对账 / 爬升公式）
- F. status/progress/history 与 git 一致；PR 文件与 tasks 八份齐全
- G01 抽查 ≥3：事件类集合、信封键序、路由 29

---

## 2. 逐条判定

### A. 需求符合性（demand.md:105-113）

#### A1 效果 1（不声明身份也能经 GET /api/pickup 取件）— **pass**（全链路）

隔离塔 `/tmp/0030-ver-iter`：端口 **17931**、socket/db 均在 `/tmp/0030-ver-iter/run/`。`POST /api/calls` 不传 `requester`、`mode=background` → HTTP 200 `state=submitted`（10 键、无 `reason`）。随后 `GET /api/pickup?principal=chat:<chat_id>` → 200，条目 `call_id=task-bcafcbf4-…`，`envelope.state=completed`，`text=ok`，`acked=false`。

命令摘要：`node bin/oamp.js router start` + `web start --port 17931` + `agent start pb-dev --role dev`（`OAMP_SOCKET`/`OAMP_DB`/`OAMP_WEB_PORT=17931`）；`curl` 等价于脚本内 HTTP。证据：`/tmp/0030-ver-iter/results.json` step `effect1-pickup`。

#### A2 效果 2（跨重启）— **pass**（全链路）

同一条目未 ack。杀掉 web 后重拉 web（同一 `OAMP_DB`）。再次 `GET /api/pickup?principal=chat:chat-8988b2fd-…` 仍得同一 `call_id`、同一信封（`duration_ms=650`、`text=ok`）。证据：step `effect2-pickup-after-restart`。

覆盖边界（搭置条 2，不改本条判定）：终态**之前**重启不在 F03 覆盖内。

#### A3 效果 3（reason 可辨：取消 / 执行失败 / 空闲超时）— **pass**（全链路 + 静态读码）

三条实跑终态（失败侧 11 键，末位 `reason`；`error` 仍为自由串，无 `detail` 键）：

| 场景 | 塔 | `error`（原自由串） | `reason` |
|---|---|---|---|
| 取消 | `/tmp/0030-ver-iter2` 端口 17932 | `cancelled` | `cancelled_by_client` |
| 空闲超时 | `/tmp/0030-ver-iter3` 端口 17933 | `timeout` | `timeout`（`text=轮次空闲超时（空闲 1500ms）`） |
| agent 崩了 | `/tmp/0030-ver-iter3` | `context_crashed` | `infra_error`（`text=子进程退出 code=1 signal=`） |

三值互异且 ∈ 闭集 `{agent_error,cancelled_by_client,infra_error,timeout,rejected}`。静态：`reasonOf('failed','cancelled'|'timeout'|'context_crashed')` 同上。

**可达性边界（与搭置条 3 同向，不改判定）**：demand 原文要分清"它崩了"与"agent 自己执行出错"。实现把 `context_crashed` 整族归 `infra_error`；`agent_error` 是未匹配自由文本/`error` 非字符串的兜底（静态 `reasonOf('failed','一次性执行失败') → agent_error`）。假 omp 的 `response{success:false}` 在 daemon 路径会拆会话，实测落 `context_crashed`/`infra_error`，**不是** `agent_error` 的端到端实例——`agent_error` 由公式兜底保证，未在本塔用真实 LLM 失败串打出。

#### A4 效果 4（空闲判据；持续进展不被累计时长砍死）— **pass**（全链路 · 压缩时间轴）

`OAMP_TASK_IDLE_MS=1500` `OAMP_TASK_NET_MS=20000`。`FAKE_MODE=progress` 每 250ms 一片 ×20 → `completed`，墙钟 **5142ms > 1500ms** 仍完成（`text` 20 个 `p`）。`FAKE_MODE=stall` 一片后静默 → **3664ms** 判死，`reason=timeout`，`error=timeout`。证据：`/tmp/0030-ver-iter3/results.json` `effect4-progress` / `effect4-stall`。静态：`oamp/src/agent.js` 无 `DEFAULT_OMP_TIMEOUT_MS`；`MAX_TIMEOUT_MS=1800000` 仅约束显式 `timeout_ms`。

#### A5 效果 5（池化分流 + 粘性）— **pass**（全链路）

两实例 `pb-dev` / `pb-dev-2` 均 `role=dev`（`GET /api/agents`）。两 `chat_id` 并发 `POST /api/calls`：transcript `from` = `pb-dev` vs `pb-dev-2`。同 `chatA` 连续两轮 transcript `from` 均为 `pb-dev`。证据：`/tmp/0030-ver-iter/results.json` `effect5-transcript` / `effect5-sticky`。

#### A6 效果 6（模型归属）— **pass**（判据可达性边界如下；**不是 git 可核实项**）

demand 原文判据 = **子 agent 系统提示中的模型名 / 派发台账逐条记录**。

**可达性边界（本条必须写清）**
1. harness 不把 per-dispatch 模型写入 git；git 无法证明某次派发实际跑了哪颗模型。
2. 本 verifier 会话自身：系统提示含 `powerby/grok-4.6`（与 D-34 / 用户级 `modelRoles.verifier` 一致）。这只证明**本次** verifier 派发，不能外推历史每一次。
3. 用户级载体（工作区外，只读）：`~/.omp/agent/agents/{dev,verifier}.md` frontmatter `model: "@dev"` / `"@verifier"`；`~/.omp/agent/config.yml` `modelRoles.dev=openai/gpt-5.6-luna`、`verifier=powerby/grok-4.6`。
4. 仓库台账：`dispatch-ledger.md` 覆盖至 16:07，已完成的 `dev` 行自报 `openai/gpt-5.6-luna`、`verifier` 行自报 `powerby/grok-4.6`、其余 `deepseek/deepseek-v4-flash`。该文件仍有在途/未回报行（15:27/15:40/16:07）。`status.md` §派发台账把后续阶段 5 行补到 19:58，已回报的 dev/verifier 与 D-34 一致。
5. 因此本条判定：**载体 + 本次自报 + 台账已回报行** 与 demand 口径一致；**不能**声称"阶段 2~6 每一次派发的系统提示都已被本 verifier 亲眼看见"。这是判据形态的固有边界，不是实现缺陷。

### B. 搭置报告 — **pass**

上节已全文置顶；5 条。不对搭置内容做二次判断。

### C. PR 粒度 — **pass**（静态读码 / PR 文件）

| PR | 逻辑原子性 | 可审查性 | 独立性 | 判定 |
|---|---|---|---|---|
| pr-001 reason.js | 只交付映射公式，不接线 | 单文件纯函数 | AC 可对模块独立探针 | pass |
| pr-002 pool-routing.js | 只交付选择/粘性/预留 | 单文件 | AC 用快照可单测 | pass |
| pr-003 persist inbox | 只加表+三方法，不接线 | 单文件增量 | 对 SQLite 句柄可单测 | pass |
| pr-004 双计时 | 只改超时真源+两键透传 | 6 文件但同一计时故事 | 压缩阈值可独立验 F05 | pass |
| pr-005 web 接线+退役 pickup.js | 一件可描述的事=把叶子接到 web；回滚它则必达/池化/reason 落点同时消失（正是同一接线） | **已知代价已登记**：单文件承载 F01~F07，审查须同时装载七张卡。框架允许该代价如实登记，不因此判 fail | 验收需上游叶子已合并才能端到端——独立性在"接线 PR"意义上成立（depends_on 明示） | pass（可审查性有登记代价，不升为 fail） |
| pr-006 文档四面 | 只同步文档，零代码 | 四面同一叙事 | 文档 vs 实现可对照；依赖 pr-004/005 是真耦合 | pass |
| pr-007 F08+F09 | 共用唯一台账，合并为提交单元合理 | docs-only | 台账/载体声明可独立读 | pass |
| pr-008 G01 证据文档 | 只写证据、零运行时 | 单文件 | 判据命令可复跑（depends_on pr-005 因为要比对改动后基准） | pass |

### D. 依赖正确性 — **pass**（代码级；`pickIniting` **不存在**，未当作缺失依赖）

7 条边（pr-005×4 / pr-006×2 / pr-008×1），无环：`001/002/003/004/007` → `005` → `{006,008}`。

| 边 | 理由点名的符号 | 代码证据（HEAD = a291343 oamp 面） |
|---|---|---|
| 005→001 | `composeCallEnvelope` / `reasonOf` | `web.js:43` import `reasonOf`；`web.js:539` 定义信封；`web.js:559` `envelope.reason = reasonOf(...)` |
| 005→002 | `pickInstance` / `createPoolRouting` / `roleOfPoolInstance` | `web.js:44` import；`web.js:2184-2185` 工厂+注入；`web.js:1441` `pickInstance(role, {chatId, noReuse, snapshot})` |
| 005→003 | `insertInbox` / `listInbox` / `deleteInbox` | `persist.js:324-344` 三方法；`web.js:2246` / `1654` / `1821` 消费 |
| 005→004 | 对账 TTL 与 `taskNetMs` 联动 | `config.js:156` `taskNetMs`；`web.js:2188` `readPositiveMs(..., config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS)`。**符号漂移**：理由写 `RECONCILE_TTL_DEFAULT_MS`（main 仍有该常量 `web.js:76`）；HEAD **删除该常量名**，改为算式联动。耦合**存在且方向正确**，不判不合规 |
| 006→005 | `gen-llms-txt.mjs` import web.js；doctor R1 | `oamp/scripts/gen-llms-txt.mjs:10`；`oamp/sdk/doctor.js:44-70` `compareSignatures` |
| 006→004 | 文档"30 分钟缺省档"的来源被移除 | `53c27a0^` `agent.js:31` `DEFAULT_OMP_TIMEOUT_MS = 1800000`；`53c27a0` 与 HEAD 该符号为 **false** |
| 008→005 | 改动后比对对象 = web.js 接线 | `composeCallEnvelope` `web.js:539-560`；取件 `web.js:1630-1664`；ack `web.js:1796-1823` |

文件范围：8 个 PR 声明路径两两不重叠（脚本对账）。功能点 F01~F09+G01 均被引用。`pickIniting` 全仓 0 命中——委托举例，不是一条 depends_on。

### E. 并发调度真实执行证据 — **pass**

#### E1 worktree 时间窗重叠 — **pass**（git 复跑；磁盘 worktree 现已清理）

独立复跑：

```
git -C <W> log --merges --format='%h %ci %s' 706e3d0..HEAD
# e49ad27 2026-09-17 21:15:28  pr-008
# 4748e78 2026-09-17 19:44:52  pr-006
# 9a4f424 2026-09-17 17:14:10  pr-005
# 1b02689 2026-09-17 16:12:50  pr-004
# 58e30cd 2026-09-17 15:59:37  pr-007
# 9fc962a 2026-09-17 15:39:19  pr-003
# 4bcfbc3 2026-09-17 14:56:02  pr-002
# f81d5c6 2026-09-17 14:35:03  pr-001

git log -1 --format='%h %ci' 53c27a0   # 15:53:31  pr-004 分支提交
git log -1 --format='%h %ci' ffb4b6b   # 15:43:08  pr-007 分支提交
git log -1 --format='%h %ci' 58e30cd   # 15:59:37  pr-007 合入
```

**我的判断**：`53c27a0 @ 15:53:31` ∈ `[ffb4b6b 15:43:08 , 58e30cd 15:59:37)` ⇒ 该时刻 pr-004 与 pr-007 **均已提交、均未合入**，两个 feat 分支必曾并存。这足以证明并发确曾发生，不是串行后误报。`git worktree list` 现在只剩 main + 迭代工作区（PR worktree 已清理），**磁盘同时存在**无法复跑；git 提交/合入窗是可复跑的充分证据。

#### E2 并发配置区块初始化与更新 — **pass**（git show 对账）

`git show 9f071b8:docs/.../status.md` 五字段均有值：起始 3 / 硬上限 5 / 当前有效上限 **3** / 累计释放 **0** / 已派发 **0**。

`git show 2023e88:…/status.md`：上限 **5**（`min(3+1×3,5)`）/ 释放 **1** / 已派发 **5**。

`git show 2483408:…` 与 HEAD：上限 5 / 释放 **8** / 已派发 22 / 在飞 0。**不是初始化后冻结。**

`git log --oneline -S'当前有效上限' -- …/status.md` → `9f071b8`、`2023e88`、`a0f8e26`。

#### E3 爬升公式 — **pass**（已触发）

公式 `min(起始 + 释放次数×起始, 硬上限) = min(3+N×3, 5)`。N=0 → 3（`9f071b8`）；N=1 → 5（`2023e88`，一次释放触顶）；N=8 → 5（HEAD 写 `min(3+8×3,5)`）。**适用且算对。**

### F. 产物一致性 — **pass**（交叉核对；2483408 更正后）

- `git log --merges` 8 个 `merge: pr-00N` 全在迭代分支、不在 main。status / progress / history 均含八个合并 hash。
- `2483408` 阶段表：阶段 5 ✅、PR 表 8/8 已合并、并发释放 8——与 git 一致。HEAD `809f259` 把阶段 6 标为终验在途，与本派发一致，不构成与 git 的合并状态冲突。
- `progress.md` 观测基点是更早的 `b49e7d0`（当时指出 status 过期）；其后 `2483408` 已按该清单更正。本验以更正后 status vs 当前 git 为准。
- `prs/`：8 个 `pr-*.md` + 8 个 `pr-*-tasks.md` 齐全。

### G01 抽查（≥3，含事件类、信封键序、路由 29）— **pass**

独立复跑（相对 `706e3d0`）：
- 事件类 `type: '…'` 集合 diff 空 → `EVENT-SET-IDENTICAL`；`CALL_EVENTS`/`FILTERED_EVENT_KINDS` → `CONST-IDENTICAL`。
- `composeCallEnvelope` 键序两侧均为 `call_id,agent,state,duration_ms,model,truncated,text,structured_output,error,exit_code` → `KEYS-IDENTICAL`；HEAD 仅 `if (state === 'failed') envelope.reason = reasonOf…`（`web.js:559`）。实跑：成功 10 键、失败 11 键末位 reason。
- 路由 29：createApiRoutes awk=29；llms.txt GET/POST 行=29；API.md §3 表=29；头部 `## 接口（29 条）`；运行时 `GET /api/docs` `routes.length=29` 且 `new_session` 出现在 POST /api/calls params（预期变化 ③）。
- 额外：`hub doctor` 隔离塔 exit 0、`pass:true`（stdout JSON 前缀核实）；Router 不在场时 pickup HTTP 200、`/api/agents` HTTP 502（预期变化 ②）；`pickup.js` ABSENT、`oamp/**` 实现面 0 命中（预期变化 ⑤）；`GET /api/agents` `pb-dev-2.role=dev`（预期变化 ①）；context-pool 归一化 `NORMALIZED-IDENTICAL`。

---

## 3. 差异清单（规格 vs 实际；可复现）

1. **`RECONCILE_TTL_DEFAULT_MS` 符号消失**（不构成 D 不合规）：main `web.js:76` 有该常量；HEAD 改为 `config.taskNetMs + RECONCILE_SLOW_DEFAULT_MS`（`web.js:2188`）。pr-005 理由仍写旧符号名。
2. **`dispatch-ledger.md` 未覆盖阶段 5 后半**（效果 6 台账面缺口，不升为 A6 fail）：文件自述覆盖至 16:07，含在途行；权威滚动面是 `status.md` 台账。
3. **`agent_error` 无本塔端到端实例**（见 A3 边界）：公式兜底存在；daemon 路径把协议失败收成 `context_crashed`。
4. **效果 4 未真等 30 分钟**：按压缩轴（进展跨越 idle 阈值仍完成 + stall 跟随 1500ms）判定，与 pr-004 任务文件 §4.9 等价形态一致。
5. **HEAD 超 a291343 两笔 docs 记账**：不影响 oamp 最终态。

以上均不把主判定从 pass 拉下来。

---

## 4. 顺带发现（范围外）

- `sendTask` 两次失败后吞掉 `lastErr`（`web.js:2445-2462`）——与搭置条 5 同题，本验不二次定性。
- 首塔后期在实例未 REGISTERED 时派发，`sendTask` 吞错 ⇒ 200 submitted 且无终态（复现了搭置条 5 的空洞）。次塔改为等 `REGISTERED` 后判定。
- `tools/check-model-dispatch-protocol.sh` 在本迭代 worktree 命名下 V-01/V-04 预期失败（progress-observer / pr-007 已登记）；本验未跑该脚本。

---

## 5. 红线违规检查

- 被验产物未改（本 verifier 只写本报告及其 `roles/verifier/data/` 副本）。
- 未写仓库主工作区 `/Users/chenchiyuan/projects/agents`。
- 未占用默认 7788 / 默认 router.sock；塔端口 17931–17934，socket/db 在 `/tmp/0030-ver-iter*`；跑后 `lsof` 无残留监听。
- 未跑项目级测试套件 / 格式化。
- oamp 相对 main 的 14 路径与委托清单一致，无夹带第六类产品面文件。`roles/*/data/**` 为过程产物（含本副本），不计入产品面回归。

---

## 6. 结论

**总分: pass**

| 组 | 判定 |
|---|---|
| A1 效果1 取件必达 | pass |
| A2 效果2 跨重启 | pass |
| A3 效果3 reason 三辨 | pass |
| A4 效果4 空闲判据 | pass |
| A5 效果5 池化+粘性 | pass |
| A6 效果6 模型归属（判据非 git） | pass（边界已写清） |
| B 搭置原文置顶 | pass · **5 条** |
| C PR 粒度 ×8 | pass |
| D 7 条依赖代码级 + 无环 + 无重叠 + 功能点全覆盖 | pass |
| E1 时间窗重叠 | pass |
| E2 并发配置 git 对账 | pass |
| E3 爬升公式 | pass（已触发） |
| F 产物一致性 | pass |
| G01 抽查 | pass |

**deferred-demand-changes.md 搭置条数：5**（供主 agent 向用户呈报是否发起新迭代）。
