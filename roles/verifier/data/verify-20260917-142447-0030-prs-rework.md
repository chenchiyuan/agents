powerby/grok-4.6

验证者身份：冲刺计划审查者（PR 规划产出物审查者——核依赖真实性、验收独立判定、粒度三锚点、偏差销项、返工后一致性回归）
产出物：`docs/iterations/0030-hub-communication-upgrade/prs/`（当前 8 个 PR 文件，逐个全读）
验证标准来源：主 agent 靶向复验委托内联 6 项（对照上一轮 `clarifications/verify-20260917-140951-stage4-prs.md` 的不通过侧与 4 条偏差）；不覆盖上一份报告
验证日期：2026-09-17

独立性声明：委托中的「返工内容（对方自述）」只用于定位改动点，不作为判定依据。只依据当前产物、prd 卡原文、architecture.md、deferred-demand-changes.md、以及工作区 `oamp/**` 源码。

不核查项（如实声明，不据此判 fail/partial）：`workflow-pb.md` §验证目标「并发调度真实执行证据」三项属迭代级终验。

对照上一轮报告：`docs/iterations/0030-hub-communication-upgrade/clarifications/verify-20260917-140951-stage4-prs.md`（PASS / fail 0 / partial 3 / 偏差 4）。本文件为新时间戳，未覆盖该文件。

---

# 委派方指定文件原文摘录（强制置顶）

以下为 `docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md` **全文原文**（不转述、不总结）。

```
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
```

---

## 逐项判定

- [复验 1 · 上一轮标准 4 不通过侧是否已消除]：pass
  证据：当前 `prs/` 仅 8 个文件；已删除 `pr-007-model-routing-carrier.md`、`pr-008-process-contract-evidence.md`、`pr-009-existing-surface-guard.md`。上一轮不合规边 `pr-007 → pr-008` **不再存在**（两端点文件均不存在；合并后的 `pr-007-model-routing-and-process-evidence.md` 第 44–46 行 `depends_on` 为 `（无）`）。
  当前图上全部边及代码耦合：
  1. pr-005 → pr-001：`web.js:539` 唯一构造点 + 9 个消费点（见复验 4②），`reasonOf` 由 pr-001 的 `reason.js` 提供。
  2. pr-005 → pr-002：`web.js:1342` `instanceIdForRole`；池选择在 `pool-routing.js`。
  3. pr-005 → pr-003：`web.js:39`/`2028` 唯一 `openDb` 句柄；`insertInbox` 等尚不存在。
  4. pr-005 → pr-004：`web.js:76`/`2164`/`2288-2290` TTL；`loadConfig()`（`config.js:143-163`）现无 `taskNetMs`。
  5. pr-006 → pr-005：`gen-llms-txt.mjs:10` 从 `web.js` import 路由元数据；R1 在 `doctor.js:44-70`。
  6. pr-006 → pr-004：`agent.js:31` 与三客户端 `1800000` 缺省档。
  7. pr-008 → pr-005：G01 改动后对照面仍是 `web.js:539-558` / `:2222` / pickup `:1613-1643`/`:1776-1801`。
  无环、无悬挂：`check-pr-gates.py` `[4] ✅ 无环` `[5] ✅`。无「无证据的边」。

- [复验 2 · 上一轮标准 5 不通过侧是否已消除]：pass
  证据：
  - 「同一张表」在**单一 PR 内**闭合：`pr-007-model-routing-and-process-evidence.md` 同时声明 F08+F09（第 14–15 行），文件范围含且仅含一份台账 `dispatch-ledger.md`（第 20 行）；验收第 5 条明文「本迭代不存在第二份自报模型证据文件（无 `evidence/f08-*`）」；`prs/` 与 `docs/iterations/0030-hub-communication-upgrade/` 下无 `evidence/f08-model-attribution.md`。
  - L1-01：该 PR 上下文摘要第 7 行写明「载体落点已裁决（L1-01 = 候选 B，用户级）并实测生效」，验收第 2 条把落点写成用户级路径且标注不入仓库。上一轮「载体未决导致验收 4 无法独立判」的阻塞已从规划面消除；F08 验收 1–4 的取证面收敛为同一份 `dispatch-ledger.md`（验收第 4 条），不再依赖其它 PR 合并。
  - 其余 PR 验收仍可在自身 + 已声明 depends_on 内判定（pr-001~004 叶子自证；pr-005 依赖 001–004；pr-006 依赖 004/005；pr-008 依赖 005）。

- [复验 3 · 上一轮标准 6 不通过侧（pr-005 可审查性）处置]：pass
  证据：`pr-005-web-inbox-and-pool-wiring.md` 第 7 行新增「已知代价（可审查性，无法通过拆 PR 消除）」段，明确审查者需同时装载 F01~F07，且「**不因此改动本 PR 的文件范围与验收标准**」。对照：文件范围仍仅为 `oamp/src/web.js` + `oamp/src/pickup.js`（删除）（第 19–22 行，与上一轮相同）；验收仍 10 条（第 26–35 行），条目语义未收缩。本轮要求「如实记录、不改变范围」——满足。可审查性锚点本身并未被消除（单文件七卡接线仍在），但已按本轮口径作为已知代价登记，不构成新的规划缺陷。

- [复验 4 · 上一轮 4 条偏差销项]：pass
  ① 依赖边：见复验 1，已消除。销项。
  ② pr-005→pr-001 证据行数：`pr-005` 第 44 行现写「全仓 `composeCallEnvelope(` 命中 10 处 = 定义 1 + 消费 9」，消费点列举 `1482 / 1576 / 1640 / 1682 / 1763 / 1769 / 1823 / 2144 / 2219`。对照 `oamp/src/web.js` 实测：定义 `:539`；调用 `:1482 :1576 :1640 :1682 :1763 :1769 :1823 :2144 :2219` —— 9 消费，与证据逐条一致。销项。
  ③ 路由条数口径：`prs/` 内无「21 条 / `= 21`」作为路由条数断言。pr-006 第 5/28 行写「迭代前实测 = **29**」；pr-008 第 20 行写「本迭代前实测 = **29**」并给出复核命令。实测：`awk '/function createApiRoutes/,0' oamp/src/web.js | grep -cE "method: '(GET|POST|PUT|DELETE)'"` ⇒ **29**；`oamp/llms.txt` 第 11 行 `## 接口（29 条）`。architecture.md mermaid 第 101 行与 §5 第 407 行已改为 29；§10 第 8 条登记更正来源。销项。
  ④ 「同一张表」：见复验 2，一份 `dispatch-ledger.md`、无 `evidence/f08-*`。销项。

- [复验 5 · 一致性回归]：pass
  证据（`tools/check-pr-gates.py` 对当前目录，exit 0）：
  - PR 数 8；七字段全部齐备。
  - 覆盖 10/10：F01←003/005/006；F02←005/006；F03←003/005/006；F04←001/005/006；F05←004/005/006；F06←002/005/006；F07←002/005/006；F08←007；F09←007；G01←008。无幽灵 F-ID。
  - 文件范围 19 条两两不重叠（上一轮 21 条减去已删的 `evidence/f08-model-attribution.md` 与合并后不再双报的台账归属）。逐文件：reason.js=001；pool-routing.js=002；persist.js=003；config.js/agent.js/acp-client.js/rpc-client.js/oneshot-client.js=004；web.js/pickup.js=005；API.md/README.md/llms.txt/skill/hub.md=006；model-routing-carrier.md/dispatch-ledger.md/evidence/f09-process-contract.md/deferred-demand-changes.md=007；evidence/g01-existing-surface.md=008。
  - 无环、无悬挂；关键路径 3（末端 pr-008；路径 001|002|003|004 → 005 → 006 与 → 008）；并发：每个 PR 有互不可达伙伴（batch 1 的 {001,002,003,004,007} 两两不可达）。
  - `prs/` 内对已删除文件名（`pr-007-model-routing-carrier` / `pr-008-process-contract-evidence` / `pr-009-existing-surface-guard` / `f08-model-attribution`）**零命中**。
  未引入新的规划缺陷。`history.md` 仍保留返工前 9 文件列表（过程日志，非 `prs/` 产物），不计入本项 fail。

- [复验 6 · deferred-demand-changes.md 原文摘录]：pass
  证据：本报告开头以围栏全文摘录该文件三节，未转述、未放脚注、未放到文末。

---

## 汇总

- pass: 6 项（复验 1–6）
- fail: 0 项
- partial: 0 项
- blocked: 0 项

相对上一轮原 9 条标准的状态变化（供对照，不另计汇总）：
- 原标准 4：partial → **pass**（不合规边消除；余边均有代码耦合）
- 原标准 5：partial → **pass**（同一张表单 PR 闭合；L1-01 已写入产物）
- 原标准 6：partial 的「可审查性」子项仍为已知代价，本轮按「如实记录、不改变范围」判定处置 **pass**；逻辑原子性 / 独立性仍成立

---

## 偏差记录

> 实现与现有规格/文档不一致的地方。不影响本次验收判定。

无（上一轮 4 条均已销项。`history.md` 阶段 4 条目仍列出返工前 9 个文件名，属过程日志而非规格/实现偏差，不记入本表。）

---

## 下一迭代候选

> 本轮发现的优化点、边界问题或遗留限制。不在当前验收标准范围内。

- deferred 三条（D-35 载体 vs 规则 F；重启窗口在飞终态不入箱；`agent_error`/`infra_error` 消费侧近似）仍在，未因本次 PR 返工消失。
- pr-005 可审查性已知代价仍在：`web.js` 单文件承载 F01–F07 接线；后续若再改调用面，评估拆模块（信封 / 取件 / 路由）。
- `history.md` 阶段 4 文件列表未随 9→8 合并回写（过程面，非门禁项）。

---

## 结论

PASS（所有条目 pass 或 partial 且无 fail）

注：偏差记录不影响结论判定。上一轮 3 条 partial 的不通过侧均已按本轮产物消除或按指定口径如实登记；4 条偏差全部销项。
