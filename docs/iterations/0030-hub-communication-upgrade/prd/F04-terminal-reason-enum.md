# F04 · 终态语义结构化（`reason` 封闭枚举 / `error` 收窄为 detail）

**来源**：demand.md 做什么#3；§大概怎么做（终态语义）；决策 D-23（枚举五值）与 D-29（timeout 归类）；效果#3；事实 F-4（所有失败原因塞进自由字符串 `error`、"取消"与"崩溃"在 state 层同形）；HB-05 遗留（取消的终态语义与崩溃同形）；决策文档 §六（"`reason` 枚举与现有 `error` 字符串的全仓引用点排查"指派给本阶段）

## 用户价值

调用方不用再"猜字符串"——一条失败结果直接告诉我是**我自己取消的**、**它崩了**、还是**等超时了**。

## 验收标准

1. **每条失败终态都带 `reason`，且取值落在封闭枚举内**：任一终态为 `failed` 的信封都含 `reason`，取值 ∈ {`agent_error`, `cancelled_by_client`, `infra_error`, `timeout`, `rejected`}；不存在缺 `reason`、取空值或取枚举外取值的失败终态（**包括参数化拼出的字符串**）[做#3；D-23]。
2. **五个取值各自可达且可被调用方单向区分**：分别构造 ① 调用方取消 ② agent 自身执行出错 ③ 基础设施/上下文失败 ④ 空闲或安全网超时 ⑤ 被拒绝（权限拒绝、模型不可用、队列满、结构校验不通过、目标拒绝受理）五种情形 ⇒ 终态分别落 `cancelled_by_client` / `agent_error` / `infra_error` / `timeout` / `rejected`，且调用方**只读 `reason` 即可区分**（不需要解析自由字符串）[效果#3；D-23]。
3. **`timeout` 无子枚举**：超时终态统一落 `reason=timeout`；空闲触发与安全网触发只在人类可读文本里区分，不新增枚举值或子层级 [D-29；F05 验收 4]。
4. **映射是全函数（全仓引用点排查结论）**：现有代码中所有可能进入终态 `error` 的自由字符串形态**全部**落在上述 5 类之内，无落空字符串；本阶段已完成的全仓扫描结论与待裁决点见 MI-5 [决策文档 §六 指派给本阶段]。
5. **`error` 字段保持原拼写与原值**：既有 `error` 键不删除、不改名、键位不变，其取值（原自由字符串）仍在（语义收窄为人类可读的补充信息）；依赖该字段拼写做判断的既有代码路径不被破坏 [D-23"原 `error` 保留…向后兼容"；G01 验收 3]。
6. **`state` 词表不变**：不新增 `state` 取值（取消仍落 `failed`）[D-23；做#3]。
7. **成功侧不新增语义**：`state=completed` 的终态不因本卡而改变既有字段集（成功没有失败原因，口径见 MI-4）[G01 验收 3]。

## 边界（不包含）

- **不新增 `detail` 键**：本卡按"`error` 键保留、其语义称谓收窄为 detail"读（口径见 MI-6）；具体键位归 A-04。
- **不做失败原因的子枚举 / 分层原因码**（D-29 明确不新增子枚举）。
- **不改 `state` 词表、不引入第三个终态**。
- **不做"终态与产物一致性"判定**：不引入产物字段、不在 hub 侧核实 [不做什么#2；D-25]。
- **不把 `reason` 扩展到非终态面**：过程事件（`task.update` 等）不在本卡范围（demand 只要求终态语义结构化）。
- **不做既有错误文案的统一 / 重写**：`error` 原文保留，不做文案归一。
- 不做 `reason` 的调用方过滤/查询新参数（无 demand 条目）。

## 架构维度

**A-03（已填定，全文见 `architecture.md` §4 A-03）**

- **映射公式落点** = 新增叶子模块 `src/reason.js`（零依赖、唯一公式 `reasonOf(state, error)`，体例同 `role-binding.js` 的"公式只此一处"）；`state !== 'failed'` 时返回 `null`。
- **信封落点** = `composeCallEnvelope`（既有唯一信封构造点）在 `state === 'failed'` 时**追加** `reason` 键：追加在既有 **10 键** 之后（**末位**、不补齐任何键；既有键名与键序零改动）（口径随实测更正，2026-09-17）；非失败态**不带该键**（MI-4）；取值必须 ∈ 五值闭集（兜底归 `agent_error` ⇒ 失败侧恒有值，不出现空值或枚举外值）。
- **持久化落点** = `inbox.envelope` 列内的 JSON（**不单列一列**：`reason` 无独立查询需求，且必须与信封其余字段同源同字节）。
- **序列化形态** = 字符串字面量；`timeout` 不分子层级（D-29）；`call.terminal` 不动（仍为 `{state, error}`）。
- **唯一消费点** ⇒ 信封面五个读点（`/api/calls` 响应、`/api/calls/<id>`、`/api/calls/wait`、`/api/pickup`、SSE `call_result`）**全部同源**。

**A-04（已填定，全文见 `architecture.md` §4 A-04；含 prd 疑问 1 / MI-5 的裁决）**

- **既有失败产生点零改动**（验收 5 / G01 验收 3 要求 `error` 键位、拼写、取值形态**含既有文案**不变，且边界明文"不做既有错误文案的统一/重写"）⇒ 归类全部落在消费侧唯一映射函数内，匹配规则 = ① 精确 → ② 前缀 → ③ 兜底：

| 源串（产生点） | 枚举 |
|---|---|
| `cancelled`（`router.task_cancel` / web 取消收口） | `cancelled_by_client` |
| `rejected_by_agent`（Router：`task.request` 被 ack rejected） | `rejected` |
| `structured_output_invalid`（`composeCallEnvelope` strict 覆写） | `rejected` |
| `permission_denied`（ACP / RPC 审批门） | `rejected` |
| `model_unavailable`（`set_config_option` 被拒） | `rejected` |
| `context_busy`（`ContextPool` 同键队列满 / already processing） | `rejected` |
| `timeout`（轮次超时失败码） | `timeout` |
| `timeout_after_<N>ms`（shell / one-shot 到期） | `timeout` |
| `context_crashed`（会话/初始化/子进程/握手/stdin/键释放/排队轮次） | `infra_error` |
| `spawn_failed: <msg>` / `spawn_error: <msg>`（shell spawn 失败） | `infra_error` |
| `dispatch_failed`（**仅对话面 `out` 记录，不进终态信封**；防御性归属） | `infra_error` |
| 自由文本 `err.message`（`executor:'omp'` 非超时失败**直接透传**） | **兜底** |
| 缺失 / `null` / 非字符串 / `task_failed`（`out` 记录兜底串） | `agent_error`（兜底） |

- **`agent_error` 的来源归属（裁决）**：它是**兜底类**，现状**无专属源串**——① `state=failed` 且 `error` 缺失/非字符串（"报了失败没报原因"）；② 未匹配任何已知形态的自由文本。决策文档映射表把它列为"有源串的枚举值"是**表述缺陷**，非遗漏。两条来源均可被构造、可被观测 ⇒ 验收 2 情形② 成立。
- **代价（如实登记）**：`context_crashed` 一族混装"会话崩溃"与"`rpc prompt` 命令级失败"，本迭代整体归 `infra_error` ⇒ 消费侧归类是**近似**；精确化须在产生点分码（新轮次级 `ProtocolError` 码 + 扩展 `context-pool._failSession` 的轮次级集合，否则轮次失败会被误当会话崩溃而拆会话），属跨迭代项（`architecture.md` §9-1）。
- **参数化串解析口径（裁决）**：**前缀匹配、不解析参数**——`timeout_after_`…`ms` ⇒ `timeout`；`spawn_failed:` / `spawn_error:` 前缀 ⇒ `infra_error`（`:` 后任意文本）；**不做关键字启发式**（HB-10 结论：纯文本启发式不足以判定）。
- **全函数性（验收 4）**：三段式**构造性**保证（"第 12 行自由文本来源"的存在使纯枚举比对在数学上不可能完备 ⇒ 兜底是必要结构而非补丁；本项是对 MI-5 结论的补强）。
- **分类更正（供主 agent 知会）**：`dispatch_failed` **不在终态信封域**（`/api/calls` 投递失败时删除调用登记、不产生终态信封，调用方得到的是 HTTP 错误码 + 一条对话 `out`）⇒ MI-5 的"13 种"是字符串扫描口径，架构层收窄为"进入信封的 11 种形态 + 1 个开放文本来源 + 显式兜底"。

## model_inferred

- **MI-4**（验收 7 的口径）：demand 只定义"失败可区分"，未定义 `completed` 侧 `reason` 的取值。本卡按"成功终态不新增字段（不带 `reason`）"落卡，等主 agent 确认。
- **MI-5**（验收 4 的口径 + 排查结论）：本阶段按决策文档 §六 指派做了全仓自由字符串扫描，结论为——现有会进入终态 `error` 的形态共 **13 种**：`cancelled`、`dispatch_failed`、`rejected_by_agent`、`structured_output_invalid`、`timeout`、`timeout_after_<N>ms`（参数化）、`context_crashed`、`spawn_failed`（含 `spawn_failed: <msg>` 参数化）、`spawn_error`（含参数化）、`model_unavailable`、`permission_denied`、`context_busy`、`task_failed`（终态缺 `error` 时的兜底）。相较决策文档所列：① 其映射表**未列** `task_failed` 与参数化 `timeout_after_<N>ms` 形态；② 其正文说"10 个"而其映射表列了 11 个（含 `spawn_error`）；③ 枚举值 `agent_error` 在其映射表中**无对应源字符串**（"agent 自身执行失败"现形于 `context_crashed`，而该串被归入 `infra_error`）——即"它真的崩了"与"agent 自己执行出错"当前同形。本卡要求"映射是全函数且 `agent_error` 有明确来源"，具体归类归属留 A-03，等主 agent 裁决。
- **MI-6**（验收 5 与边界的口径）：D-23 措辞"原 `error` 保留并收窄为 `detail`"存在两种读法（新增 `detail` 键 / 仅语义称谓变化）。本卡按"**不新增键**、保留 `error` 原值"落卡（依据：D-23 对"向后兼容"的强调与"不破坏既有依赖该字段拼写的代码路径"要求），等主 agent 确认。
