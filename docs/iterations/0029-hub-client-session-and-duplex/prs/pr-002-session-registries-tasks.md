# pr-002-tasks.md — pr-002 内部任务列表（客户端会话登记模块：身份表 / 未取件指针表）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-002-session-registries.md`
**PR worktree 分支**: `feat/0029-pr-002-session-registries`（base = `72b659f`，= 迭代分支 tip，落盘时零 diff）｜ **任务总数**: **6**（T1~T6）｜ **依赖图**: **无环**（见 §2）
**性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（12 条验收标准 / 2 个功能点 F01·F07）+ `architecture.md`（§3.1 身份流、§3.7 取件流、§4 A-01/A-02/A-06、§5.4 新增进程内模块表、§8 剃刀检验）+ `prd/{F01,F07,F02}*.md` + `prs/pr-005-web-session-and-call-surface.md`（**下游消费面**，见 §0.4 契约 2/4 的接缝证据）+ 代码库实读（§0.3 逐条带 `文件:行号`）

> **本 PR 无任何可执行入口**：两个模块的 HTTP 接线归 **pr-005**（PR 文件明文"本 PR 只交付模块与其语义…HTTP 面接线由 pr-005 承担"）⇒ **全部验收以模块级一次性脚本 + `grep` 原始输出判定**，**不新增测试文件**（PR 文件范围不含测试面；本仓当前无 `.test.js`，见 A7）。

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/src/principals.js` | **新建**（体例照 `inbox.js`，约 40-50 行） | 身份表 `Map<principal_id, rec>` + `upsert / get / touch / requesterOf`（**T1 / T2**） |
| 2 | `oamp/src/pickup.js` | **新建**（体例照 `inbox.js`，约 35-45 行） | 未取件指针表 `Map<call_id, entry>` + `add / listByRequester / ack`（**T3 / T4**） |
| 3 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md` | 改（仅「验收证据」段） | 取证输出回填（**T6**） |

> 本文件 `prs/pr-002-session-registries-tasks.md` 是本阶段产物，不计入改动面（与 PR 文件同目录，随 PR 分支提交）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动**（PR 文件「不触碰」+ 本 PR 语义边界）：`oamp/src/web.js`（接线面归 pr-005）、`oamp/src/inbox.js`（体例来源，只读参照）、`oamp/src/persist.js`（不落库）、`oamp/src/registry.js`、`oamp/src/router.js`、`oamp/src/transport.js`、`oamp/src/config.js`、`oamp/bin/**`、`oamp/package.json`、`oamp/API.md`、`oamp/llms.txt`、`oamp/skill/hub.md`、`oamp/web/**`、`oamp/sdk/**`、`roles/**`、`docs/**`（除 PR 文件与本文件）。
- **不新增**：依赖（`package.json` 零 diff）、配置键、env 键、**文件写入**（无落库、无日志、无 runtime 产物）、事件面、定时器、`size()` / `clear()` / `history()` / `export()` / `decided()` 类入口、测试文件、目录、**第三个模块**。
- **不做**（属其他 PR）：HTTP 路由与请求体解析（pr-005）、`epoch` 生成与 `409 STALE_EPOCH`（pr-005）、`publishCallResult` 的写入接线（pr-005）、`requester` 进调用登记与 `warnings[]`（pr-005）、订阅面（pr-003）、`roster.json` 名册提示（pr-005）。
- **不做**（F01/F07 边界）：鉴权、租约/心跳/续期、TTL 淘汰、跨机联邦、身份注销、事件回放、推送、批量清理、正文/信封副本、游标/分页。
- **不import 仓内模块**（含 `./registry.js`）——见 §0.4 契约 3 与 §7 疑问 2。

### 0.3 读码事实锚点（2026-09-16 实读，base `72b659f`；判据基础）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | 体例模板 = `inbox.js`：**模块级** `const entries = new Map()` + **模块级导出函数**（非工厂）；头注明写形态、寿命与"为什么"（"进程内、不持久、重启即丢"）；头注**声明导出面恰好 N 个**并列出名字 | `oamp/src/inbox.js:1-10`、`:6`、`:7` |
| **A2** | `inbox.add(entry)` 的幂等与拒绝面：只校验键（`typeof id !== 'string' \|\| id === ''` ⇒ `false`）；`entries.has(id)` ⇒ `false` **且不覆盖首条**；首次插入 ⇒ `true` | `oamp/src/inbox.js:13-20` |
| **A3** | `inbox.list()` = `[...entries.values()]`（**条目引用数组**、顺序 = 登记顺序、**不承诺排序**）；`inbox.remove()` 不存在 ⇒ **无副作用、不抛错** | `oamp/src/inbox.js:22-25`、`:35-38` |
| **A4** | 形态规则唯一来源：`isValidInstanceId(v)` = `typeof v === 'string' && v.length >= 1 && v.length <= 64 && /^[\x21-\x7E]+$/.test(v)`（非空 / ≤64 / 可打印 ASCII） | `oamp/src/registry.js:7-10` |
| **A5** | 下游消费面（**接缝证据**）：pr-005 明文"本 PR 追加 `import * as principals from './principals.js'` / `import * as pickup from './pickup.js'`，并调用其 `upsert/get/touch/requesterOf` 与 `add/listByRequester/ack`；**按合并后的实际导出面接线**" | `prs/pr-005-web-session-and-call-surface.md:151`、`:35` |
| **A6** | 同款 import 体例先例：`web.js` 用 `import * as inbox from './inbox.js'`（命名空间导入、模块级函数） | `oamp/src/web.js:41` |
| **A7** | 本仓**无任何 `.test.js`**（`find . -name '*.test.js'` = 0）；`tests/` 仅两个 shell 脚本 ⇒ 本 PR 的验收只能靠**一次性脚本 + grep**，且不新增测试文件 | 实测 |
| **A8** | `inbox.js` 内 `process.env` 出现 0 次、无 `node:fs` import ⇒ "进程内、零落库、零环境依赖"的既有达标形态可直接对照 | 实测（`grep`） |
| **A9** | `architecture §5.4` 把接缝列为 `upsert / get / touch / resolve(source)`，而 `§4 A-01` 与 pr-005 的消费清单都写 `requesterOf(source)` ⇒ 同一函数的两个名字，**权威名 = `requesterOf`**（A-05 是消费面、A-01 是定义面） | `architecture.md:433`、`:241`、A5 |

### 0.4 本 PR 内冻结契约（每个任务都必须遵守；跨 PR 接缝在此一次定死）

1. **模块形态**〔追溯：PR 文件"按 `src/inbox.js` 的进程内表体例"；A1/A6〕：两文件均为「模块级 `Map` + 模块级导出函数」，**不是**工厂（对比 `registry.js` 的 `createRegistry()`）。头注逐条照 `inbox.js:1-7` 的写法：形态 / 为什么在服务端（去重与查询面）/ 为什么不是持久层 / 形态先例 / **导出面恰好 N 个并逐个列名**。
2. **导出面恰好**〔追溯：PR 验收 1；A5/A9〕：
   - `oamp/src/principals.js` → **恰好 4 个**：`upsert`、`get`、`touch`、**`requesterOf`**；
   - `oamp/src/pickup.js` → **恰好 3 个**：`add`、`listByRequester`、`ack`；
   - 接缝函数**只用 `requesterOf` 这个名字**：**禁止**同时导出 `resolve` 或写别名（`export { requesterOf as resolve }` / 两个同体函数）——别名即"导出面多一个入口"+"同一事实落两处"。`architecture §5.4` 的 `resolve(source)` 指同一函数（A9）。
3. **import 面**〔追溯：PR 验收 2 + 验收 4；A4〕：两文件的 `import` 行**只含 `node:*`**（**0 行也合法**——两模块不需要任何 import）。**不得 import `./registry.js`**：PR 验收 2 的判据 `grep -n '^import' …` 会对非 `node:` 导入直接判负。形态校验按 PR 验收 4 的"**不另写一份正则**"落地为**码元范围判定**（`length` 1..64 且每个 UTF-16 码元 ∈ `[0x21, 0x7E]`，**不出现正则字面量**），并与 `registry.js` 的 `isValidInstanceId` **逐例同判**（等价性由一次性脚本对 `registry.js` 做对照证明，见 §4.3）〔该取舍已上报，见 §7 疑问 2〕。
4. **`principals` 返回面**（**跨 PR 接缝，在此冻结**——依据 A5："pr-005 按合并后的实际导出面接线"）：
   - `upsert(decl)` → 命中/新建 ⇒ `{ principal: rec }`；形态非法 ⇒ `{ error: 'INVALID_PRINCIPAL_ID' }` 且**不建条目**（并列 `registry.js` 的 `{error:'CODE'}` 体例；PR 验收 4 要求"可判定的失败，不静默建"）；
   - `get(principalId)` → `rec | null`；
   - `touch(principalId)` → `rec | null`（命中 ⇒ 前移 `last_seen_at`；未命中 ⇒ `null` 且**不建条目**）；
   - `requesterOf(source)` → `{ principal_id, kind, instance_id } | null`。
5. **`rec` 形状**〔追溯：PR 验收 3；architecture §4 A-01、§3.1〕：恰好 5 键 `{principal_id, kind, instance_id, created_at, last_seen_at}`；新建时 `created_at = last_seen_at = Date.now()`；**命中已有条目 ⇒ 只前移 `last_seen_at`**（`created_at` **与 `kind`/`instance_id` 均逐字不变**——§3.1 第 2 步的"只前移"）。
6. **`pickup` 返回面**〔追溯：PR 验收 7/9；A2/A3〕：
   - `add(entry)` → `true`（首次插入）｜ `false`（`call_id` 非"非空字符串"，或该 `call_id` 已存在）；
   - `listByRequester(requester)` → 条目**引用**数组（过滤 = `entry.requester === requester && entry.acked === false`；顺序 = 登记顺序、**不承诺排序**；不深拷贝）；
   - `ack(callId)` → **无返回值、不抛错**（命中 ⇒ 该条目 `acked = true`；未命中 ⇒ 无副作用、**不建条目**）。
7. **pickup 条目 6 键白名单**〔追溯：PR 验收 10；architecture §4 A-06〕：`add` 对入参做**白名单拷贝**，落盘条目的键恰为 `{call_id, requester, agent, chat_id, terminal_at, acked}`；`acked` 恒定写 `false`；**入参其余键一律忽略**（信封 / 正文 / `envelope` / `result` / `text` 类键不得进入条目）——这是"只存指针不存正文"的**结构保证**，而不是约定。
8. **零 TTL / 零定时器 / 零落库 / 零事件面 / 零推断来源**〔追溯：PR 验收 5/6/11；architecture §4 A-01、A-06〕：两文件无 `setTimeout`/`setInterval`、无 `node:fs` 及任何文件写入、无 `process.*`（含 `process.env`）、无 `delete`（**principals 无任何清除/失效路径**）、无事件发射、无环境/进程/连接/路径的推断。
9. **头注寿命口径逐字**〔追溯：PR 验收 11〕：两文件头注均含"**进程内、不持久、重启即丢**"字样与写入面说明（"不落库 / 无文件写入"）。

### 0.5 PR 验收标准 → 任务映射（12 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | 两文件存在且可独立 import；导出面 = 上述函数集合，**无多余入口** | **T5**（+ T1/T3 建立骨架） |
| AC2 | 两模块 `import` 行**只含 `node:*`** | **T5** |
| AC3 | `upsert` 连续两次 ⇒ 都成功、`created_at` 两次相同、`last_seen_at` 不倒退；`get` 同形 | **T1** |
| AC4 | 形态校验与 `registry.js:7` 同源（不另写正则）；非法 ⇒ **不建条目** + 可判定失败 | **T1** + **T6**（等价性对照证明） |
| AC5 | 无租约（无定时器）；`touch` 前移 `last_seen_at` 不改 `created_at`；无失效/清除路径 | **T2** + T5（无定时器 grep） |
| AC6 | `requesterOf(source)` 只读显式声明：缺/空 ⇒ `null`；不推断；`instance_id` 缺失 ⇒ `null` 不报错 | **T2** |
| AC7 | `pickup.add` 幂等：同一 `call_id` 重复 add 不产生第二条、不覆盖首条 | **T3** |
| AC8 | `listByRequester('p1')` 只返回该身份 `acked=false` 条目（另一身份不在列表中） | **T4** |
| AC9 | `ack` 幂等删除语义：移出未取件集合；重复 ack / 不存在的 id ⇒ 成功且无副作用（不抛、不建条目） | **T4** |
| AC10 | 只存指针不存正文：条目字段集合**恰为 6 个键** | **T3**（写入面）+ **T6**（复核断言） |
| AC11 | 与 `inbox.js` 同寿命口径：头注明写"进程内、不持久、重启即丢"；无落库/无文件写入 | **T5**（核查）+ T1/T3（头注执行） |
| AC12 | 零新增依赖；本 PR 的 diff 不含 `oamp/src/web.js` 与任何既有文件 | **T6** |

---

## 1. 任务列表

### T1: `oamp/src/principals.js` —— 模块骨架 + `rec` 形状 + `upsert` / `get`

- **服务哪条 AC**: AC3、AC4（AC1/AC11 的骨架与头注在此建立）
- **描述**: 新建身份表模块：模块级 `Map`、头注（形态 / 为什么 / 导出面恰好 4 个）、形态判定（码元范围，无正则）、`upsert`（幂等：命中只前移 `last_seen_at`）、`get`。
- **文件/锚点**: 新建 `oamp/src/principals.js`；体例逐条对照 `oamp/src/inbox.js:1-25`（头注写法、模块级 Map、`add`/`list` 的函数形态与幂等写法）；形态规则的语义对齐 `oamp/src/registry.js:7-10`（**不 import**，见 §0.4 契约 3）。
- **步骤**: ① 头注（照 A1 的五段式）；② `const entries = new Map()`；③ 形态判定私有函数（码元范围，**不导出**）；④ `upsert(decl)`；⑤ `get(principalId)`。
- **验收判据（可执行，一次性脚本；脚本全文见 §4.2/§4.3）**:
  1. **AC1 骨架**：`await import('<worktree 绝对路径>/oamp/src/principals.js')` 成功；`Object.keys(ns).sort()` = `['get','requesterOf','touch','upsert']`（T1 完成时 `requesterOf`/`touch` 已由 T2 占位或随后补——**同一文件的导出面在 T5 一次性判定**，T1 只需保证 `upsert`/`get` 可用且无多余入口）。
  2. **AC3 幂等**：`upsert({principal_id:'p1', kind:'cli'})` 两次 ⇒ 两次都返回 `{principal: rec}`（**无 `error` 键**）；两次的 `rec.created_at` **严格相等**；`rec2.last_seen_at >= rec1.last_seen_at`（不倒退）；`get('p1')` 返回**同形**（5 键、取值等于第二次 `rec`）。
  3. **AC3 只前移**：`upsert({principal_id:'p1', kind:'other', instance_id:'ag-x'})` ⇒ 返回的 `rec.kind` **仍为 `'cli'`**、`rec.instance_id` **仍为 `null`**（原值，§0.4 契约 5）、`created_at` 不变、`last_seen_at` 前移。
  4. **AC4 拒绝面**：对 `''`、`'a'.repeat(65)`、`'has space'`、`'中'`、`1`、`null`、`undefined`、`{principal_id:''}` 各调一次 `upsert` ⇒ 返回 `{error:'INVALID_PRINCIPAL_ID'}`（**无 `principal` 键**）；随后 `get(该值)` ⇒ `null` / 表内条目数不增（用 `get` 逐个复查）。
  5. **AC4 边界接受**：`'a'`（1 字符）、`'a'.repeat(64)`、`'!'`（0x21）、`'~'`（0x7E）⇒ 均**接受**（与 `registry.js:7-10` 同判；等价性对照见 T6）。
- **前置依赖**: 无
- **优先级**: P0

---

### T2: `oamp/src/principals.js` —— `touch` + `requesterOf` 接缝

- **服务哪条 AC**: AC5、AC6
- **描述**: 追加 `touch(principalId)`（前移 `last_seen_at`、不动 `created_at`、未命中返回 `null` 且不建条目）与单一接缝函数 `requesterOf(source)`（只读显式声明，零推断）。
- **文件/锚点**: `oamp/src/principals.js`（紧随 `get` 之后）；形态判定复用 T1 的私有函数；语义对齐 `architecture §4 A-01`（`:241`）与 §3.1。
- **步骤**: ① `touch`；② `requesterOf`（读 `source.principal_id` / `source.kind` / `source.instance_id` 三个键）；③ 头注导出面清单同步为 4 个。
- **验收判据（可执行，一次性脚本）**:
  1. **AC5 前移**：`touch('p1')` ⇒ 返回 `rec`，`last_seen_at` **严格大于** touch 之前的值（脚本内 `await new Promise(r => setTimeout(r, 5))` —— **定时器禁令只约束模块本身，不约束验证脚本**），`created_at` **逐字不变**（严格相等）。
  2. **AC5 未命中**：`touch('nope')` ⇒ `null`；`get('nope')` 仍为 `null`（**不建条目**）。
  3. **AC5 无清除路径**：`Object.keys(ns)` 不含 `remove/clear/delete/reset`；`grep -c '\.delete(' oamp/src/principals.js` = **0**；`grep -c 'setTimeout\|setInterval' oamp/src/principals.js` = **0**（原始输出进 T5/T6 证据）。
  4. **AC6 显式声明**：`requesterOf({principal_id:'p1'})` ⇒ `{principal_id:'p1', kind:null, instance_id:null}`〔`kind` 缺失口径见 §6 MI-P1〕；`requesterOf({principal_id:'p1', kind:'cli', instance_id:'ag-1'})` ⇒ 三字段原样。
  5. **AC6 缺/空 ⇒ null**：`requesterOf({})`、`requesterOf({principal_id:''})`、`requesterOf(null)`、`requesterOf(undefined)`、`requesterOf('p1')`（字符串而非对象）、`requesterOf({principal_id:123})` ⇒ **全部 `null`**（不抛）。
  6. **AC6 零推断**：`requesterOf({pid:process.pid, cwd:process.cwd(), socket:'/tmp/x.sock', env:'X'})` ⇒ `null`（不从进程 / 环境 / 连接 / 路径推导）；`grep -c 'process\.' oamp/src/principals.js` = **0**。
  7. **AC6 纯读**：连续两次 `requesterOf({principal_id:'p1'})` ⇒ 返回值相同，且 `get('p1').last_seen_at` **未被前移**（接缝不产生副作用；前移归调用方显式 `upsert`/`touch`，见 A-01 的"凡携带该身份且被受理的请求"，落点在 pr-005）。
- **前置依赖**: T1（复用同文件的形态判定与表结构）
- **优先级**: P0

---

### T3: `oamp/src/pickup.js` —— 模块骨架 + `add`（6 键白名单 + 幂等）

- **服务哪条 AC**: AC7、AC10（写入面）
- **描述**: 新建未取件指针表模块：模块级 `Map`、头注（导出面恰好 3 个）、`add(entry)`（白名单拷贝 6 键、`acked:false`、幂等且不覆盖首条）。
- **文件/锚点**: 新建 `oamp/src/pickup.js`；体例对照 `oamp/src/inbox.js:1-20`（头注 / 模块级 Map / `add` 的键校验 + `has` 去重 + 返回 boolean）；条目 schema 对齐 `architecture §4 A-06`。
- **步骤**: ① 头注；② `const entries = new Map()`；③ `add`（白名单拷贝 + 去重）。
- **验收判据（可执行，一次性脚本）**:
  1. **AC7 幂等**：`add({call_id:'c1', requester:'p1', agent:'ag', chat_id:'ch', terminal_at:1000})` ⇒ `true`；同 `call_id` 再 `add`（**故意改 `agent:'ag-2'`、`terminal_at:2000`**）⇒ `false`；`listByRequester('p1')` 长度 **1**，且该条目 `agent === 'ag'`、`terminal_at === 1000`（**不覆盖首条**）。
  2. **AC7 拒绝面**：`add({})` / `add({call_id:''})` / `add({call_id:123})` / `add(null)` ⇒ **全部 `false`** 且不建条目〔其余字段缺失口径见 §6 MI-P2〕。
  3. **AC10 白名单**：`add({call_id:'c2', requester:'p1', agent:'ag', chat_id:'ch', terminal_at:2000, envelope:{...}, text:'正文', result:{}})` ⇒ 落盘条目的 `Object.keys().sort()` **恰为** `['acked','agent','call_id','chat_id','requester','terminal_at']`（**无 `envelope`/`text`/`result` 等键**），且 `acked === false`。
  4. **AC10 值面**：`call_id/requester/agent/chat_id/terminal_at` 与入参逐字相等（白名单拷贝不改变取值）。
- **前置依赖**: 无
- **优先级**: P0

---

### T4: `oamp/src/pickup.js` —— `listByRequester` + `ack`

- **服务哪条 AC**: AC8、AC9
- **描述**: 追加 `listByRequester(requester)`（按身份 + `acked=false` 过滤）与 `ack(callId)`（置 `acked=true`、幂等、不抛、不建条目）。
- **文件/锚点**: `oamp/src/pickup.js`（紧随 `add` 之后）；体例对照 `oamp/src/inbox.js:22-38`（`list` 的引用数组写法、`remove` 的"不存在 ⇒ 无副作用不抛错"写法）。
- **步骤**: ① `listByRequester`（`[...entries.values()].filter(e => e.requester === requester && e.acked === false)`）；② `ack`；③ 头注导出面清单同步为 3 个。
- **验收判据（可执行，一次性脚本）**:
  1. **AC8 归属对照**：`add` 三条（`p1/c1`、`p1/c2`、`p2/c3`）⇒ `listByRequester('p1')` 的 `call_id` 集合 = `{c1,c2}`（**不含 `c3`**）；`listByRequester('p2')` = `{c3}`；`listByRequester('nobody')` = `[]`（严格等值，不误配）。
  2. **AC9 生效**：`ack('c1')` ⇒ **不抛**（返回 `undefined`）；随后 `listByRequester('p1')` 的 `call_id` 集合 = `{c2}`（**已移出未取件集合**）。
  3. **AC9 幂等**：再次 `ack('c1')` ⇒ 不抛；集合仍为 `{c2}`（无副作用、无第二条）。
  4. **AC9 不存在**：`ack('never')` ⇒ 不抛；集合仍为 `{c2}`；且 `listByRequester('p1')` 不出现 `never`（**不建条目**）。
  5. **AC9 不复活**：`ack('c1')` 之后 `add({call_id:'c1', …})` ⇒ `false`，`listByRequester('p1')` 仍不含 `c1`（取消取件不因重复写入复活）〔口径见 §6 MI-P3〕。
  6. **过滤面完备**：对已被 ack 的条目改查其 `requester` 仍不出现在列表（`acked` 过滤优先于归属匹配）。
- **前置依赖**: T3（同文件的表结构 + `add` 是列表判据的数据来源）
- **优先级**: P0

---

### T5: 两模块合同面核查（导出面 / import 行 / 头注口径 / 零定时器与零落库）

- **服务哪条 AC**: AC1、AC2、AC11（+ AC5 的无定时器项）
- **描述**: 用一次性脚本 + 原始 `grep` 输出，判定两模块的**合同面**：导出面恰好、import 行只含 `node:*`、头注寿命口径、零定时器/零落库/零 `process.*`。
- **文件/锚点**: 零源码改动（只读两文件）；产出原始输出供 T6 落盘。
- **步骤**: ① 运行 §4.1 的导出面脚本；② 运行 §4.4 的 grep 族（逐条保留原始输出）。
- **验收判据（可执行）**:
  1. **AC1 导出面**：`Object.keys(await import(principals.js)).sort()` = `['get','requesterOf','touch','upsert']`；`Object.keys(await import(pickup.js)).sort()` = `['ack','add','listByRequester']`（**逐字符相等**，多一个/少一个即失败）。
  2. **AC2 import 行**：`grep -n '^import' oamp/src/principals.js oamp/src/pickup.js` 的输出中**每一行**都匹配 `from 'node:`，或**无输出**（0 行）；出现任何 `from './…'` / `from '../…'` ⇒ 失败。
  3. **AC11 头注口径**：`grep -c '进程内、不持久、重启即丢' <两文件>` 各 ≥ **1**；且头注含导出面计数（`4` / `3`）与列名。
  4. **AC5/AC11 零面**：`grep -c 'setTimeout\|setInterval' <两文件>` 各 = **0**；`grep -c "node:fs\|writeFile\|appendFile\|createWriteStream" <两文件>` 各 = **0**；`grep -c 'process\.' <两文件>` 各 = **0**。
  5. **零事件面**：`grep -c 'EventEmitter\|emit(' <两文件>` 各 = **0**。
- **前置依赖**: T1、T2、T3、T4
- **优先级**: P0

---

### T6: 全量复跑 + 形态等价性对照 + AC10 复核 + diff 封闭性 + 证据落盘

- **服务哪条 AC**: AC4（等价性证明）、AC10（复核）、AC12；同时是 AC1~AC11 的证据载体齐备
- **描述**: ① 一次性跑全量断言脚本（§4.2），若模块是全新进程则先跑 AC 全序列；② 用 `registry.js` 的 `isValidInstanceId` 做**逐例等价性对照**（§4.3）；③ 机械核查四处零面；④ 把全部原始输出按 PR 文件「验收证据」段要求回填。
- **文件/锚点**: `prs/pr-002-session-registries.md` 的 **「验收证据」** 段（只改该段，**不改七字段**）。
- **步骤**: ① 跑 §4.2 脚本（两模块在同一进程内驱动，覆盖 AC3~AC10）；② 跑 §4.3 等价性脚本；③ 跑 §4.4 grep 族；④ 跑 diff 封闭性核查；⑤ 落盘证据。
- **验收判据（可执行）**:
  1. **AC4 等价性**：对 §4.3 的 14 例样例集（含 `''`、1/64/65 字符、`' '`(0x20)、`'!'`(0x21)、`'~'`(0x7E)、`0x7F`、中文、换行、`1`、`null`、`undefined`、`[]`、`{}`）逐例断言 `isValidPrincipalShape(x) === registry.isValidInstanceId(x)`（**14/14 同判**；任一例不同 ⇒ 失败）。该脚本**在脚本内** import `oamp/src/registry.js`（模块本身仍零仓内 import，AC2 不受影响）。
  2. **AC10 复核**：全量脚本输出的条目键集断言 6/6；`listByRequester` 返回行的键集同为 6 键。
  3. **AC12 diff 封闭性**：`git -C <worktree> diff --name-status 72b659f HEAD -- oamp/` ⇒ **恰好两行且均为 `A`**（`oamp/src/principals.js`、`oamp/src/pickup.js`）；`git status --short` 无未跟踪的仓内新增文件（除本 tasks 文件与 PR 文件的证据改动）；`git diff 72b659f HEAD -- oamp/package.json` ⇒ **空**。
  4. **AC12 零依赖**：`grep -c '"dependencies": {}' oamp/package.json` = 1（既有值未变）。
  5. **证据齐备**：PR 文件「验收证据」段含 PR 文件原文列举的**全部**载体——两模块的一次性验证脚本输出（幂等 / `created_at` 不变 / `last_seen_at` 前移 / 非法形态拒绝 / `ack` 幂等 / 导出面与 import 行计数）+ `grep` 计数原始输出；AC1~AC12 每条可指到对应输出（缺一即 T6 未完成）。
- **前置依赖**: T5
- **优先级**: P1（**P1 ≠ 可选**：全部 AC 通过才算本 PR 完成）

---

## 2. 依赖图

```
T1 ──> T2 ──┐
            ├──> T5 ──> T6
T3 ──> T4 ──┘
```

边（逐条，均为真实约束；共 6 条）：
- `T1 → T2`：`touch` / `requesterOf` 复用 T1 建立的表结构与私有形态判定函数（同文件、同一实现面）。
- `T3 → T4`：`listByRequester` / `ack` 的数据来源与条目形状由 T3 的 `add` 确立（判据 1~5 全部经由 `add` 写入的条目观测）。
- `T1 → T5`、`T2 → T5`、`T3 → T5`、`T4 → T5`：合同面核查的对象是**两文件完整导出面**（缺任一函数则导出面断言必失败）。
- `T5 → T6`：证据落盘需要 T5 的合同面原始输出（且 T6 的 AC10 复核建立在合同面确定之后）。
- `T6 → （无）`。

**无环**：拓扑序 `T1 < T2 < T5 < T6` 与 `T3 < T4 < T5 < T6` 同时满足上述全部边的方向，不存在回到已访问节点的路径。

**最长依赖链（本 PR 内部任务图的关键路径，4 节点）**：`T1 → T2 → T5 → T6`（另一条等长链 `T3 → T4 → T5 → T6`）。
**关键路径任务**：**T1**（`principals.js` 的表结构与形态判定是 T2 的基础）→ **T2**（导出面 4 个的最后一块）→ **T5**（合同面判定，AC1/AC2/AC11 的唯一判据点）→ **T6**（全量证据与 doc 落盘）。

---

## 3. 执行顺序（dev 单次调用 ≤ 30 分钟上限制下的增量策略，见 DC-06/DC-08）

**顺序**：`T1 → T2 → T3 → T4 → T5 → T6`（同文件连续施工：T1/T2 都在 `principals.js`，T3/T4 都在 `pickup.js`；这不新增依赖边）。

**每次调用产出的可验证增量**（每条都能独立跑判据、独立落盘）：
| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | `principals.js`：骨架 + `upsert`/`get` | §T1 判据 2~5（纯模块脚本，无需起进程、无需环境） |
| 2 | `principals.js`：`touch` + `requesterOf`（文件完成） | §T2 判据 1~7 |
| 3 | `pickup.js`：骨架 + `add` | §T3 判据 1~4 |
| 4 | `pickup.js`：`listByRequester` + `ack`（文件完成） | §T4 判据 1~6 |
| 5 | 合同面原始输出（导出面 / import 行 / 零面 grep） | §T5 判据 1~5 |
| 6 | 全量复跑 + 等价性对照 + diff 封闭性 + PR 文件证据段 | §T6 判据 1~5 |

**若单次调用未跑完**：按上表在**任务边界**停下（不得把只有 `add` 没有 `listByRequester` 的 `pickup.js` 或只有 `get` 没有 `requesterOf` 的 `principals.js` 留给下一次——导出面断言要求文件**成对完成**）；已完成任务的判据输出即为本次调用的增量产物。

---

## 4. 验证配方（**禁止新增测试文件**；全部为一次性脚本 + `grep`，A7）

工作目录 = PR worktree 根；脚本一律落在 `/tmp/`（**不进仓库**）。

### 4.1 导出面与 import 面（T5 判据 1/2）

```bash
cd <PR worktree 根>
node --input-type=module -e '
const P = await import(new URL("./oamp/src/principals.js", `file://${process.cwd()}/`));
const K = await import(new URL("./oamp/src/pickup.js", `file://${process.cwd()}/`));
console.log("principals:", Object.keys(P).sort().join(","));
console.log("pickup:", Object.keys(K).sort().join(","));
'
grep -n '^import' oamp/src/principals.js oamp/src/pickup.js    # 期望：无输出，或每行均为 node:*
```

### 4.2 全量断言脚本（T1~T4 判据、T6 判据 2）——`/tmp/pr002-verify.mjs`

```js
// 单进程内驱动两个模块（模块级 Map 共享状态 ⇒ 全部断言必须同进程按序执行）
const base = `file://${process.cwd()}/oamp/src/`;
const P = await import(base + 'principals.js');
const K = await import(base + 'pickup.js');
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- AC3 principals: upsert 幂等 ----
const u1 = P.upsert({ principal_id: 'p1', kind: 'cli' });
await sleep(5);
const u2 = P.upsert({ principal_id: 'p1', kind: 'cli' });
ok('AC3 upsert twice ok', !!u1.principal && !!u2.principal && !u1.error && !u2.error);
ok('AC3 created_at equal', u1.principal.created_at === u2.principal.created_at);
ok('AC3 last_seen_at not backwards', u2.principal.last_seen_at >= u1.principal.last_seen_at);
ok('AC3 rec shape 5 keys', JSON.stringify(Object.keys(P.get('p1')).sort())
   === JSON.stringify(['created_at','instance_id','kind','last_seen_at','principal_id']));

// ---- AC3 只前移（kind/instance_id 不被覆写）----
const u3 = P.upsert({ principal_id: 'p1', kind: 'other', instance_id: 'ag-x' });
ok('AC3 kind/instance_id preserved', u3.principal.kind === 'cli' && u3.principal.instance_id === null);
ok('AC3 created_at still equal', u3.principal.created_at === u1.principal.created_at);

// ---- AC4 形态拒绝（不建条目 + 可判定失败）----
for (const bad of ['', 'a'.repeat(65), 'has space', '中', 1, null, undefined, { principal_id: '' }]) {
  ok(`AC4 reject ${JSON.stringify(bad)?.slice(0, 18)}`, P.upsert({ principal_id: bad }).error === 'INVALID_PRINCIPAL_ID');
}
ok('AC4 nothing created for rejects', P.get('') === null && P.get('a'.repeat(65)) === null);
for (const good of ['a', 'a'.repeat(64), '!', '~']) ok(`AC4 accept ${JSON.stringify(good)?.slice(0,8)}`, !!P.upsert({ principal_id: good }).principal);

// ---- AC5/AC6 touch + requesterOf ----
const before = P.get('p1').last_seen_at; await sleep(5);
const touched = P.touch('p1');
ok('AC5 touch moves last_seen_at', touched.last_seen_at > before);
ok('AC5 touch keeps created_at', touched.created_at === u1.principal.created_at);
ok('AC5 touch miss => null, no entry', P.touch('nope') === null && P.get('nope') === null);
ok('AC6 requesterOf declared', JSON.stringify(P.requesterOf({ principal_id: 'p1' }))
   === JSON.stringify({ principal_id: 'p1', kind: null, instance_id: null }));
ok('AC6 requesterOf full', JSON.stringify(P.requesterOf({ principal_id: 'p1', kind: 'cli', instance_id: 'ag-1' }))
   === JSON.stringify({ principal_id: 'p1', kind: 'cli', instance_id: 'ag-1' }));
for (const src of [{}, { principal_id: '' }, null, undefined, 'p1', { principal_id: 123 },
                   { pid: process.pid, cwd: process.cwd(), socket: '/tmp/x.sock' }]) {
  ok(`AC6 requesterOf null for ${JSON.stringify(src)?.slice(0, 20)}`, P.requesterOf(src) === null);
}
const ls = P.get('p1').last_seen_at;
P.requesterOf({ principal_id: 'p1' });
ok('AC6 seam is pure read', P.get('p1').last_seen_at === ls);

// ---- AC7/AC10 pickup add ----
ok('AC7 first add true', K.add({ call_id: 'c1', requester: 'p1', agent: 'ag', chat_id: 'ch', terminal_at: 1000 }) === true);
ok('AC7 dup add false', K.add({ call_id: 'c1', requester: 'p1', agent: 'ag-2', chat_id: 'ch', terminal_at: 2000 }) === false);
ok('AC7 first entry not overwritten', K.listByRequester('p1')[0].agent === 'ag' && K.listByRequester('p1')[0].terminal_at === 1000);
for (const bad of [{}, { call_id: '' }, { call_id: 123 }, null]) ok(`AC7 reject ${JSON.stringify(bad)?.slice(0, 18)}`, K.add(bad) === false);
ok('AC10 whitelist 6 keys', K.add({ call_id: 'c2', requester: 'p1', agent: 'ag', chat_id: 'ch', terminal_at: 2000, envelope: {}, text: 'x', result: {} }) === true
   && JSON.stringify(Object.keys(K.listByRequester('p1').find((e) => e.call_id === 'c2')).sort())
      === JSON.stringify(['acked','agent','call_id','chat_id','requester','terminal_at']));

// ---- AC8/AC9 listByRequester + ack ----
K.add({ call_id: 'c3', requester: 'p2', agent: 'ag', chat_id: 'ch', terminal_at: 3000 });
ok('AC8 p1 set = {c1,c2}', JSON.stringify(K.listByRequester('p1').map((e) => e.call_id).sort()) === JSON.stringify(['c1','c2']));
ok('AC8 p2 set = {c3}', JSON.stringify(K.listByRequester('p2').map((e) => e.call_id)) === JSON.stringify(['c3']));
ok('AC8 unknown requester => []', K.listByRequester('nobody').length === 0);
ok('AC9 ack no throw', (() => { try { K.ack('c1'); return true; } catch { return false; } })());
ok('AC9 ack removes from set', JSON.stringify(K.listByRequester('p1').map((e) => e.call_id)) === JSON.stringify(['c2']));
ok('AC9 ack idempotent', (() => { try { K.ack('c1'); K.ack('never'); return K.listByRequester('p1').length === 1; } catch { return false; } })());
ok('AC9 ack does not resurrect', K.add({ call_id: 'c1', requester: 'p1', agent: 'ag', chat_id: 'ch', terminal_at: 1000 }) === false
   && !K.listByRequester('p1').some((e) => e.call_id === 'c1'));
console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
```

### 4.3 形态等价性对照（T6 判据 1；证明 AC4 的"与 `registry.js:7` 同源"）

```bash
node --input-type=module -e '
import { isValidInstanceId } from "file://'"$PWD"'/oamp/src/registry.js";
const P = await import("file://'"$PWD"'/oamp/src/principals.js");
// 判据：对同一 id 调用 upsert，用"是否被接受"反推模块内的形态判定结果
const cases = ["", "a", "a".repeat(64), "a".repeat(65), " ", "!", "~", "\x7f", "中", "a\nb", 1, null, undefined, [], {}];
let same = 0;
for (const c of cases) {
  const accepted = !P.upsert({ principal_id: c }).error;   // 模块内形态判定的可观测投影
  const ref = isValidInstanceId(c);
  console.log(`${JSON.stringify(c)?.slice(0, 12) ?? String(c)} module=${accepted} registry=${ref} same=${accepted === ref}`);
  if (accepted === ref) same += 1;
}
console.log(`equivalence ${same}/${cases.length}`);
process.exitCode = same === cases.length ? 0 : 1;'
```

### 4.4 零面与合同面 grep 族（T5 判据 3~5；原始输出进证据）

```bash
grep -c '进程内、不持久、重启即丢' oamp/src/principals.js oamp/src/pickup.js     # 各 ≥ 1
grep -c 'setTimeout\|setInterval'   oamp/src/principals.js oamp/src/pickup.js     # 各 0
grep -c 'node:fs\|writeFile\|appendFile\|createWriteStream' oamp/src/principals.js oamp/src/pickup.js  # 各 0
grep -c 'process\.'                 oamp/src/principals.js oamp/src/pickup.js     # 各 0
grep -c 'EventEmitter\|emit('       oamp/src/principals.js oamp/src/pickup.js     # 各 0
grep -c '\.delete('                 oamp/src/principals.js                        # 0（principals 无清除路径）
```

### 4.5 diff 封闭性（T6 判据 3/4）

```bash
git -C <PR worktree 根> diff --name-status 72b659f HEAD -- oamp/          # 期望恰两行，均为 A
git -C <PR worktree 根> diff 72b659f HEAD -- oamp/package.json           # 期望空
git -C <PR worktree 根> status --short                                   # 除 PR 文件证据改动与本 tasks 文件外无新增
```

---

## 5. 证据载体与落盘

- **原始输出**：一次性脚本与 `grep` 的 stdout **原样**落 `/tmp/pr002-*.out`（临时面，**不写进仓库**）。
- **最终证据载体**：`prs/pr-002-session-registries.md` 的 **「验收证据」** 段（PR 文件自身在文件范围内，且原文即要求"本 PR 执行时填写"）。
- **分两次落盘**（对应 30 分钟上限的增量策略）：T5 完成时先落合同面与 grep 原始输出；T6 完成时补全量脚本输出、等价性对照、diff 封闭性。**不得**新建文档、不得把证据写进 `status.md` / `history.md`（不在本 PR 文件范围，主 agent 维护）。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（T2 判据 4 的口径）**：`requesterOf` 的 `kind` 缺失 ⇒ `kind: null`；`source` 非对象（含字符串 / `null` / `undefined`）⇒ 整体返回 `null`。
  - 为什么需要推导：PR 验收 6 只写了"缺字段或空 ⇒ `null`"与"`instance_id` 缺失 ⇒ 该字段为 `null`"，未写 `kind` 缺失与非对象 `source` 的形态。
  - 推导依据：`architecture §4 A-01` 把 `kind` 定义为"可选字符串"、接缝返回面为 `{principal_id, kind, instance_id} | null`；与 `instance_id` 的明文规则同构（缺 ⇒ `null` 字段），非对象源不可能含显式声明 ⇒ `null`。
- **[model_inferred] MI-P2（T3 判据 2 的口径）**：`pickup.add` 的入参拒绝面**只校验 `call_id`**（非空字符串）；其余字段缺失 ⇒ 落 `null`（不拒绝）。
  - 为什么需要推导：PR 验收 7/10 只规定"幂等"与"6 键"，未规定其余字段的必填性。
  - 推导依据：PR 文件明文"体例照 `src/inbox.js`"，而 `inbox.add` 只校验键（A2）；`requester` 的存在性门槛归 web 侧写入点（`architecture §4 A-06`：仅当该调用携带 `requester` 时写入），本模块不重复设闸。
- **[model_inferred] MI-P3（T4 判据 5 的口径）**：`ack` 后条目**保留**（`acked=true`）而非删除 ⇒ 同一 `call_id` 再次 `add` 返回 `false`（不复活、不覆盖）。
  - 为什么需要推导：PR 验收 9 只说"条目移出未取件集合；重复 ack / 不存在的 id ⇒ 无副作用"，未写"移出"是标记还是删除，也未写"acked 后再 add"的结果。
  - 推导依据：`architecture §4 A-06` 逐字"**条目置 `acked=true` 并移出集合**"；且 PR 验收 10 要求条目键集含 `acked`——若 ack 删除条目，该字段永不取真值。

**无其他推导项**：AC1/AC2/AC5~AC12 的全部判据均可逐字回指 PR 文件、`architecture.md` 或 §0.3 的事实锚点。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的 6 条边与双拓扑序 `T1<T2<T5<T6`、`T3<T4<T5<T6`）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **PR 验收 2（import 只含 `node:*`）与 PR 验收 4（形态校验"与 `src/registry.js:7` 同源，不另写一份正则"）在字面上不可同时满足**：复用 `isValidInstanceId` 必须写 `import { isValidInstanceId } from './registry.js'`，而验收 2 的判据 `grep -n '^import' oamp/src/principals.js oamp/src/pickup.js` 会对该行直接判负。**本任务列表的取舍（见 §0.4 契约 3）** = 满足可机械判定的验收 2（`node:*` only / 零 import），并把验收 4 的"不另写一份正则"实现为**码元范围判定 + 与 `registry.js` 逐例同判的等价性证明**（§4.3）⇒ 两条都可通过。**若主 agent 裁定"复用 = import"**，则须同时改写验收 2 的判据口径（两项改动面 = 1 行 import + 1 条判据），处置权归主 agent。
2. **接缝函数命名在两份上游文中不一致**：`architecture §5.4`（`:433`）写 `resolve(source)`，`§4 A-01`（`:241`）与 PR 验收 6、pr-005 的消费清单（`:151`）都写 `requesterOf(source)`。本任务列表冻结 **`requesterOf`**（消费面 + 判据名双重证据，A5/A9），并要求**不做别名/双导出**（别名会同时违反验收 1 的"无多余入口"与仓库既有的"同一事实不落两处"）。若主 agent 裁定改用 `resolve`，改动面 = 1 个导出名（`grep` 可见 4 处，含 T5 判据）。
3. **简报「工作区地址」笔误**：简报给 `…/worktrees/0029pr-002-session-registries`（缺一个 `-`），该路径不存在；实际 worktree = `…/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-002-session-registries`（`git worktree list` 显示分支 `feat/0029-pr-002-session-registries` 检出于此，符合 `scm-protocol` 规则 C 的落点命名）。本文件按**实际存在且分支匹配**的地址作业，全部写入落在该目录内。
4. **粒度决策记录（本 PR 未写 `roles/planner/data/`）**：本次按"可独立验收断面"而非"独立文件"把 `principals.js` 拆成 T1/T2、`pickup.js` 拆成 T3/T4，并把合同面/grep 与全量证据拆成 T5/T6（后者对应 30 分钟上限的两段式落盘）；按 planner 角色定义本应记入 `data/`，但本 PR 的文件范围不含（且 PR 文件明列不触碰）`roles/**` ⇒ 记录在本文件此处，不越界写 `roles/`。
5. **未发现的架构信息缺口**：AC1~AC12 均能在 `architecture.md`（§3.1/§3.7/§4 A-01·A-02·A-06/§5.4/§8）与 `prd/{F01,F07,F02}` 找到可追溯依据；两条需要推导的口径（MI-P1/MI-P2）与一条观测后果（MI-P3）已列入 §6 等确认，其余无信息不足情形。
6. **PR 文件七字段零改动**：本任务列表未修改 `prs/pr-002-session-registries.md` 的任何字段；上文第 1/2 条仅为上报。
