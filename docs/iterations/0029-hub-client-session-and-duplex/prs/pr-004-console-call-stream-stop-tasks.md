# pr-004-tasks.md — pr-004 内部任务列表（控制台调用进度订阅的终态适配，1 行）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-004-console-call-stream-stop.md`
**PR worktree 分支**: `feat/0029-pr-004-console-call-stream-stop` ｜ **base = `cfb6736`**（= 迭代分支 tip，**已含 pr-002 合并**；与 pr-001~003 的 `72b659f` 不同，见 A13）｜ **任务总数**: **5**（T1~T5）｜ **依赖图**: **无环**（见 §2）
**性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（7 条验收标准 / 2 个功能点 F09·G01）+ `architecture.md`（§0 的 1 行适配声明、§1.3 事实 F-12、§6.2 S-9、§7 L2-13、§11.2 O-4）+ `prd/F09-close-stream-on-terminal.md`（验收 1~5）+ 代码库实读（§0.3 逐条带 `文件:行号`）

> **本 PR 的产出面 = 既有一处前端订阅的生命周期适配**，判据分三层：**静态**（改动量守门 + 不变面）、**机制**（既有 `unsubscribe()` 被调用 ⇒ `EventSource.close()`）、**端到端**（真集群 + 浏览器 Network 时间戳序列）。三层都必须落到 T3/T4 的原始输出，**不新增测试文件**（A14）。

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/web/calls.js` | 改（**1 行调用 + 至多 1 行注释**，0 删除） | `handleCallEvent` 的 `call_result` 分支末尾追加 `unsubscribe();`（**T2**） |
| 2 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-004-console-call-stream-stop.md` | 改（仅「验收证据」段） | `git diff` 原文 / `--numstat` / Network 时间戳序列 / 回归目视结论（**T5**） |

> 本文件 `prs/pr-004-console-call-stream-stop-tasks.md` 是本阶段产物，不计入改动面（与 PR 文件同目录，随 PR 分支提交）。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动**（PR 文件「不触碰」+ 本 PR 语义边界）：`oamp/src/web.js`（服务端面归 pr-005）、`oamp/web/app.js`、**`oamp/web/**` 其余全部**（含 `calls.html`、`style.css`、`api-pages.css`、`notify.js`、`index.html`、`debug.js`…）、`oamp/src/**`、`oamp/sdk/**`、`oamp/bin/**`、`oamp/package.json`、`oamp/API.md`、`oamp/llms.txt`、`roles/**`、`docs/**`（除 PR 文件与本文件）。
- **不新增**：前端依赖（无新 `<script>` / 无 import）、样式（零 CSS 改动）、轮询机制（`setInterval` 计数保持 1）、函数、状态变量、事件名、服务端行为、测试文件、目录。
- **不做**（F09 边界 / 本 PR 范围）：不改服务端关流与补发（pr-003 / pr-005）、不做客户端重连策略（既有 `onerror` 注释语义保留）、不做取消控件、不改 roster 列与排序、不做 "终态后自动重订"、不做 DOM 状态标记或 UI 提示新增。
- **不把适配"升级"为能力**：§6.2 S-9 与 §11.2 O-4 已声明本项是 F09 行为变更的**必然适配**，不是新增能力 ⇒ 不得顺带加"订阅状态指示""自动重选"等（越界 = 无简报外改动原则的违反）。

### 0.3 读码事实锚点（2026-09-16 实读，base `cfb6736`；判据基础）

| # | 事实 | 位置 |
|---|---|---|
| **A1** | `oamp/web/calls.js` 共 178 行；**零 import**（浏览器脚本，由 `calls.html` 以 `<script src="/calls.js">` 引入）⇒ "零新增前端依赖"的判据面 = 该文件 + `calls.html` 均无新依赖行 | `oamp/web/calls.js:1-8`、`oamp/src/web.js:418-436` |
| **A2** | `handleCallEvent(type, data)`（`:152`）的 `call_result` 分支现状（`:163-167`）= `setCallState(data.state)` + 渲染正文 + 条件渲染 `错误：…`；**不关闭订阅**（F-12 的直接证据） | `oamp/web/calls.js:163-167` |
| **A3** | `unsubscribe()` 现状 = `if (source !== null) { source.close(); source = null; }`——**只碰 `source`，不碰 `selectedId`**，不触发任何重订 | `oamp/web/calls.js:120-125` |
| **A4** | `selectCall(callId)` 现状（`:128-150`）= `selectedId = callId` → `unsubscribe()` → `setStreamHint('')` → `renderProgress()` → `new EventSource(...)`；`onerror` 注释逐字为"不自行实现重连，沿用 EventSource 自动重连 + 服务端 retry: 1000" | `oamp/web/calls.js:128-150` |
| **A5** | `CALL_EVENT_TYPES = ['call_state','call_update','call_result']`；`ROSTER_REFRESH_MS = 5000`；roster 6 列 = `call_id/agent/state/started_at/ended_at/model`；末尾 `setInterval(loadCalls, ROSTER_REFRESH_MS)` | `:9`、`:65-72`、`:178` |
| **A6** | 服务端（**base 状态**）：`GET /api/calls/<id>/stream` = 先 `router.task_get` 验存在（不存在 ⇒ 404，不建订阅）→ `transport.handleCallStream`；**无终态关流、无晚订阅补发**（F-3 的 `closeKey` 0 调用点仍未补；pr-003 / pr-005 **未合并**） | `oamp/src/web.js:1181-1198`、`architecture.md` §1.3 F-3 |
| **A7** | 终态发布链（既有、本 worktree 已生效）：`publishCallResult` → `transport.publishCall(callId, {type:'call_result', …})` ⇒ **控制台在既有实现下也能收到 `call_result`**（本 PR 的浏览器判据不依赖 pr-005） | `oamp/src/web.js:1505-1518` |
| **A8** | 造一次"进行中 → 终态"的调用（**无模型调用**，秒级终态）：`POST /api/projects {repo_url}` → `POST /api/messages {project_id, agent_id, text:'!sleep N'}`；`!` 前缀 ⇒ 服务端载荷 `{command:'/bin/sh', args:['-c', cmd], label}` ⇒ agent 侧 shell 执行器 | `oamp/src/web.js:853-857`、`oamp/src/agent.js:425-430` |
| **A9** | 静态面白名单：`/calls` → `web/calls.html`、`/calls.js` → `web/calls.js` ⇒ 页面 URL = `http://127.0.0.1:<port>/calls` | `oamp/src/web.js:432-433` |
| **A10** | 角色实例名公式：`instanceIdForRole(role) = 'pb-' + role`；`roleOfInstance` 反解要求角色文件存在（`<roleRoot>/roles/<role>/<role>.md`）⇒ 冒烟用 `dev`（仓内存在，`roles/` 为真源） | `oamp/src/role-binding.js:31-33`、`oamp/src/web.js:1000-1008`（`POST /api/calls` 的角色校验） |
| **A11** | 进程 env 与就绪行：`OAMP_SOCKET`（UDS 路径）、`OAMP_DB`（库路径）、`OAMP_WEB_PORT` / `--port`；就绪信号 `ROUTER_READY` / `WEB_READY url=http://127.0.0.1:<port>` / 节点注册由 router 侧打 `AGENT_REGISTERED` | `oamp/src/config.js:141-156`、`oamp/src/web.js:1431-1439`、`:1759`、`oamp/src/router.js:483` |
| **A12** | 本 PR 断言的"既有语义"= `EventSource.close()` 后浏览器**不再自动重连**（关闭由客户端发起 ⇒ 不派发 `error`）⇒ 这正是"消除每秒重连"的机制，也是"终态后不出现错误提示条"的依据 | 浏览器规范语义；`oamp/web/calls.js:139-143`（`onerror` 才置错误提示） |
| **A13** | **base commit = `cfb6736`**（= `iteration/0029-hub-client-session-and-duplex` tip，含 pr-002 合并提交）；与 pr-001~003 的 `72b659f` 不同 ⇒ `git diff` / `--numstat` 的基线一律以 `cfb6736` 为准 | 实测（`git merge-base HEAD iteration/0029-hub-client-session-and-duplex` = `cfb6736`） |
| **A14** | 本仓**无任何 `.test.js`**（0 个）；`tests/` 仅两个 shell 脚本 ⇒ 判据只能靠静态核查 + 浏览器 smoke，且不新增测试文件 | 实测 |

### 0.4 本 PR 内冻结契约（本 PR 的"一行"到底改什么）

1. **改动位置与内容**〔追溯：PR 验收 1/6；A2〕：`oamp/web/calls.js` 的 `handleCallEvent` 中 `if (type === 'call_result') { … }` 分支**末尾**（即两次渲染之后）追加一行 `unsubscribe();`；**至多**再允许 1 行说明性行内注释。**零删除、零其它位置修改**（`git diff --numstat` 目标 ≤3 新增 / 0 删除）。
2. **复用而非新建**〔追溯：PR 验收 1〕：只能调**既有** `unsubscribe()`；**不得**新增函数、不得新增状态变量、不得内联写 `source.close()`、不得引入"订阅状态标记"（`A1/A3` 已具备所需能力）。
3. **关闭的语义**〔追溯：PR 验收 3/4；A12〕：`unsubscribe()` → `source.close()` ⇒ 浏览器**不再自动重连**（这是消除"每秒重连"的唯一机制；不得用"保留连接 + 忽略事件"之类的替代形态）。
4. **`selectedId` 与重订**〔追溯：PR 验收 2；A3/A4〕：关闭订阅**不改变** `selectedId`、**不触发重订**（改动后不得新增第二个 `new EventSource` 构造点）；用户点击其它行仍走既有"先关后开"（`selectCall` 零字符改动）。
5. **其余面逐字不变**〔追溯：PR 验收 5/7；A5〕：`CALL_EVENT_TYPES`、roster 6 列与排序、5s 轮询（`setInterval` 计数仍为 1）、空态/错误提示条、`#call-rows` 的 click 委托、`renderProgress`/`setCallState`/`appendLog` 等全部不改。
6. **不改页面与样式**〔追溯：PR 验收 7〕：`oamp/web/calls.html`（零新 `<script>`）、`style.css`、`api-pages.css` 均零改动。
7. **验证基线**〔追溯：PR 验收 6；A13〕：`git -C <worktree> diff --numstat cfb6736 HEAD -- oamp/web/calls.js` 的行数即守门判据；`git status --short` 只能出现 `oamp/web/calls.js` 与 PR 文件。

### 0.5 PR 验收标准 → 任务映射（7 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC | 验收标准（PR 文件原文摘要） | 服务任务 |
|---|---|---|
| AC1 | `handleCallEvent` 的 `call_result` 分支在渲染后调用既有 `unsubscribe()`（不新增函数、不新增状态） | **T2**（实现）+ **T3**（静态核查） |
| AC2 | 关闭后 `selectedId` 保持为当前行（不触发重新订阅）；点击其它行仍照常"先关后开"（`selectCall` 不变） | **T3**（静态）+ **T4**（浏览器） |
| AC3 | 适配**不依赖**服务端新行为即可独立成立：对已终态调用选中 ⇒ 收到终态帧后订阅关闭，随后的重复帧不再到达（当前服务端实现下亦无回归） | **T4**（含 §7 疑问 1 的范围口径） |
| AC4 | 真集群 smoke（浏览器）：`EventSource` 只建立一次、收到 `call_result` 后连接关闭、Network **无每秒重连**；选中已终态调用亦同 | **T4**（+ **T1** 的改动前对照） |
| AC5 | 控制台调用面板其余部分逐字不变（roster 6 列 / 5s 轮询 / 空态错误条 / 切换选中行逻辑） | **T3** + **T4**（目视与提示条判据） |
| AC6 | 改动量守门：`git diff --numstat -- oamp/web/calls.js` ≤3 行新增 / 0 行删除 | **T3**（+ **T5** 落盘 diff 原文） |
| AC7 | 零新增前端依赖、零新样式、零新轮询机制 | **T3** |

**T1**（改动前基线）是 **AC4/AC3** 对照判据的生产者——没有它，"连接关闭"无法归因于本次改动；**T5** 是全部 AC 的证据载体。

---

## 1. 任务列表

### T1: 改动前基线取证（同一冒烟脚本跑一次，记录"终态后连接仍打开"）

- **服务哪条 AC**: AC4（对照基线）、AC3（"无回归"的比较基准）
- **描述**: 在**任何源码改动之前**，按 §4 的冒烟配方起真集群、打开 `/calls`、选中一次进行中的调用，记录 Network 的 `/stream` 请求事件序列到 `/tmp/pr004-baseline.json`——基线预期 = **1 个 req、0 个 finish**（终态后连接保持打开）。
- **文件/锚点**: 零源码改动；产出 `/tmp/pr004-baseline.json`（**不进仓库**）。
- **步骤**: ① 按 §4.1 起三进程（router / agent `pb-dev` / web）；② 按 §4.2 造一次 `!sleep 12` 调用并记 `task_id`；③ 按 §4.3 跑浏览器观测脚本；④ 存原始事件序列与 `git -C <worktree> diff --numstat cfb6736 HEAD -- oamp/web/calls.js`（此时应为空输出）。
- **验收判据（可执行）**:
  1. `/tmp/pr004-baseline.json` 含 `task_id`、`events[]`（每项 `{kind, url, ts}`）、`hintText`、`stateBadge`。
  2. **基线判据**：`events` 中 `/stream` 的 `req` 计数 = **1**、`fin` 计数 = **0**（6s 观察窗内连接未结束）——即"改动前终态不关流"的客户端侧实证。
  3. **改动前工作树干净**：`git status --short` 除本 tasks 文件外为空；`git diff --numstat cfb6736 HEAD -- oamp/web/calls.js` 为空输出。
- **前置依赖**: 无（**必须在任何源码改动前执行**——改动后不可复现该基线）
- **优先级**: P0

---

### T2: `oamp/web/calls.js` —— `call_result` 分支末尾追加 `unsubscribe()`

- **服务哪条 AC**: AC1
- **描述**: 在 `handleCallEvent` 的 `call_result` 分支渲染语句之后追加一行 `unsubscribe();`（+ 至多 1 行注释说明"终态即停、重选即重订"）。
- **文件/锚点**: `oamp/web/calls.js:163-167`（`if (type === 'call_result') { … }` 分支末尾，即 `appendLog(...)` 之后）；复用 `:120-125` 的既有 `unsubscribe()`。
- **步骤**: ① 插入一行；② （可选）一行行内注释；③ 不改任何其它字符。
- **验收判据（可执行）**:
  1. **AC1 位置**：`git diff -U3 cfb6736 HEAD -- oamp/web/calls.js` 的 `-` 行为 0；`+` 行出现于 `call_result` 分支内、且位于 `setCallState(` / `appendLog(` 之后（"渲染后"）。
  2. **AC1 复用面**：`+` 行调用的是既有标识符 `unsubscribe`（不是 `source.close()`/新函数）；`grep -c 'function unsubscribe' oamp/web/calls.js` = **1**（未新增同名第二份）；新增 `let`/`const` 状态 = 0（`git diff` 中无 `+` 开头的 `let `/`const ` 行）。
  3. **AC6 守门**：`git -C <worktree> diff --numstat cfb6736 HEAD -- oamp/web/calls.js` ⇒ 第一列（新增）**≤3**、第二列（删除）**= 0**。
  4. **语法可解析**：`node --check oamp/web/calls.js` 退出 0（浏览器脚本是普通 script，`node --check` 只验语法，不执行 `document`）。
- **前置依赖**: T1（基线必须先于任何源码改动）
- **优先级**: P0

---

### T3: 静态守门核查（不变面 / 复用面 / 零新机制）

- **服务哪条 AC**: AC2（静态部分）、AC5（静态部分）、AC6、AC7
- **描述**: 用 `git diff` + `grep` 原始输出证明"只动了一处、其余逐字不变"。
- **文件/锚点**: 零源码改动（只读）。
- **步骤**: ① diff 全量；② 逐条 grep 计数；③ 记录输出供 T5 落盘。
- **验收判据（可执行，全部保留原始输出）**:
  1. **AC5 改动面收敛**：`git diff --name-only cfb6736 HEAD` ⇒ 仅 `oamp/web/calls.js`（+ PR 文件 / 本 tasks 文件，属阶段产物）。
  2. **AC5 不变函数**：`selectCall`（`:128-150`）、`unsubscribe`（`:120-125`）、`renderRoster`（`:65-72`）、`loadCalls`、`renderProgress`、`setCallState`、`appendLog`、`renderHint`、`setRosterHint`、`setStreamHint` 所在行段在 `git diff` 中**零改动**（用 `git diff -U0` 的行号范围核对）。
  3. **AC7 零新轮询**：`grep -c 'setInterval' oamp/web/calls.js` = **1**（且该行仍是 `setInterval(loadCalls, ROSTER_REFRESH_MS)`）；`grep -c 'new EventSource' oamp/web/calls.js` = **1**。
  4. **AC7 零新依赖**：`git diff cfb6736 HEAD -- oamp/web/calls.html oamp/web/style.css oamp/web/api-pages.css` ⇒ **空**；`grep -c '<script' oamp/web/calls.html` 与基线相同（取值原样记录）。
  5. **AC7 零新状态**：`git diff -U0` 中不存在以 `+` 开头且含 `let ` / `const `（模块级）的行。
  6. **AC2 静态证据**：`sed -n '120,125p' oamp/web/calls.js | grep -c 'selectedId'` = **0** ⇒ 关闭订阅不动选中项；`grep -c 'new EventSource' oamp/web/calls.js` = **1**，且该处仍在 `selectCall`（`:128-150`）内 ⇒ 无自动重订路径。
  7. **AC6 守门**：`git diff --numstat cfb6736 HEAD -- oamp/web/calls.js` ⇒ ≤3 新增 / 0 删除（原文落盘）。
- **前置依赖**: T2
- **优先级**: P0

---

### T4: 真集群浏览器 smoke（终态即关、一次连接、无重连、提示条不误报）

- **服务哪条 AC**: AC4、AC3、AC2（交互部分）、AC5（目视部分）
- **描述**: 起真集群（router + agent `pb-dev` + web），用无模型的 shell 调用制造"进行中 → 终态"，浏览器打开 `/calls` 选中该行，采集 `/stream` 的请求事件序列与终态后的提示条/徽标状态。
- **文件/锚点**: 零源码改动；产出 `/tmp/pr004-after.json`（+ 与 `baseline.json` 的对照）。
- **步骤**: ① 复用 §4.1 集群（若 T1 的进程仍在则直接用）；② §4.2 造 `!sleep 12` 调用；③ §4.3 同脚本观测；④ 与 T1 基线对照。
- **验收判据（可执行；全部取自 `/tmp/pr004-after.json`）**:
  1. **AC4 只建立一次**：`/stream` 的 `req` 计数 = **1**（整个观察窗内，含终态后 6s）。
  2. **AC4 终态即关**：该请求出现 `fin`（`requestfinished`）；且 `fin.ts - call_result.ts` 在**秒级**（同一 tick 量级，不晚于 1s）——与 T1 基线的 `fin = 0` 成对照。
  3. **AC4 无每秒重连**：终态后 6s 窗口内 `/stream` 无第二个 `req`（若真出现重连，按 `retry: 1000` 应见到 5~6 次）。
  4. **AC5 提示条不误报**：终态后 `#call-hint` 的 `textContent` **不含**"订阅中断"、其 `className` 不含 `error`（`#call-hint` 是 `renderHint()` 的唯一落点，承载 roster/stream 两条提示）——依据 A12：客户端 `close()` 不派发 `error`；该提示亮起 = 实现走了错误路径（如靠 `onerror` 收尾或未真正 close）。
  5. **AC2 选中项保持 + 可重订**：终态后 `selectedId` 对应的行仍为选中（`renderProgress` 标题仍显示该 `call_id`）；随后点击**另一行**（第二列 `!sleep 2` 的调用或既有行）⇒ 新 `/stream` 请求数 **+1**（既有"先关后开"未被破坏），且此时 `req` 总数 = 2。
  6. **AC3 已终态调用的选中（范围口径见 §7 疑问 1）**：对一次**已终态**的调用行选中 ⇒ 与基线该场景**行为一致**：`/stream` 请求 1 次、无帧到达、无提示条变化（base 下服务端不补发，A6）；本次改动该路径**零差异**（对照 T1 记录）。
  7. **证据形态**：`events[]` 原样落盘（文本时间戳序列）；**截图仅作过程观察，不写入仓库**——PR 文件「验收证据」段要求"截图/时间戳序列"，本 PR 取**时间戳序列**（新增 PNG 会越出文件范围）。
- **前置依赖**: T1（对照基线）、T2（被测改动）
- **优先级**: P0

---

### T5: 验收证据落盘（PR 文件「验收证据」段）

- **服务哪条 AC**: AC1~AC7 的证据载体齐备（**P1 ≠ 可选**：全部 AC 通过才算本 PR 完成）
- **描述**: 把 T1~T4 的原始输出（diff 原文、`--numstat`、Network 事件序列、回归结论）回填进 PR 文件。
- **文件/锚点**: `prs/pr-004-console-call-stream-stop.md` 的 **「验收证据」** 段（只改该段，**不改七字段**）。
- **步骤**: ① 汇总 `/tmp/pr004-*.json` 与 diff/grep 输出；② 按 PR 文件列举的三类载体逐条粘贴（不做二次加工）；③ 自查 AC1~AC7 对应关系。
- **验收判据（可执行）**:
  1. 「验收证据」段含 PR 文件要求的**三类**：① `git diff` 原文与 `--numstat` 行数；② 浏览器 Network 时间戳序列（**改动前/改动后各一段**，含"只建一次连接、终态后关闭、无 1s 重连"的结论）；③ 控制台其余面回归的目视结论（roster 6 列 / 5s 轮询 / 空态与错误条 / 切换选中行）。
  2. AC1~AC7 每条都能指到对应原始输出（缺一即 T5 未完成）。
  3. `git status --short` 仅 `oamp/web/calls.js` 与 PR 文件（+ 本 tasks 文件）——无新增未跟踪产物（截图/临时文件不得入库）。
- **前置依赖**: T3、T4
- **优先级**: P1

---

## 2. 依赖图

```
T1 ──> T2 ──┬──> T3 ──┐
            └──> T4 ──┴──> T5
```

边（逐条，均为真实约束；共 5 条）：
- `T1 → T2`：**基线必须在任何源码改动前捕获**——改动后再取"改动前"轨迹不可复现（AC4 的对照判据基础）。
- `T2 → T3`、`T2 → T4`：静态守门与浏览器 smoke 的对象都是**改动后**的 `calls.js`。
- `T1 → T4`（经 T2 传递亦可，此处显式声明）：AC4/AC3 的判据是**与基线对照**（`fin: 0 → 1`、无重连），没有 T1 的轨迹就无法归因。
- `T3 → T5`、`T4 → T5`：证据落盘需要两层的原始输出。

**无环**：拓扑序 `T1 < T2 < T3 < T4 < T5` 满足全部边方向（T3、T4 同层，互不依赖）。

**最长依赖链（本 PR 内部任务图的关键路径，4 节点）**：`T1 → T2 → T4 → T5`（另一条等长链 `T1 → T2 → T3 → T5`）。
**关键路径任务**：**T1**（基线唯一生产者）→ **T2**（唯一改动）→ **T4**（端到端判据）→ **T5**（证据与文档面收口）。

---

## 3. 执行顺序（dev 单次调用 ≤ 30 分钟上限制下的增量策略，见 DC-06/DC-08）

**顺序**：`T1 → T2 → T3 → T4 → T5`（T1 必须最先；T3 与 T4 可互换，但建议先 T3——静态守门失败时不必浪费一次集群 smoke）。

**每次调用产出的可验证增量**：
| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | 基线轨迹 + 干净工作树记录 | §T1 判据 1~3 |
| 2 | `calls.js` 的一行改动 | §T2 判据 1~4（diff/numstat/grep/`node --check`） |
| 3 | 静态守门输出 | §T3 判据 1~7 |
| 4 | 浏览器 smoke 轨迹 + 与基线对照 | §T4 判据 1~7 |
| 5 | PR 文件「验收证据」段落盘 | §T5 判据 1~3 |

**集群进程的生命周期**（对 30 分钟上限友好）：T1 起的三个进程（router / agent / web）**保持运行**供 T4 复用（经 hub 的进程面管理，不重复起停）；T4 结束后统一 `stop`。若中途被上限切断，重启集群后重跑 §4.2 即可（脚本幂等：每次用新的临时 DB 与端口）。

---

## 4. 验证配方（**禁止新增测试文件**；全部为一次性脚本 + 真集群 + 浏览器，A14）

### 4.1 起真集群（长驻进程一律经 hub 的进程面启动/停止）

```bash
cd <PR worktree 根>
export OAMP_SOCKET=/tmp/pr004/router.sock
export OAMP_DB=/tmp/pr004/sql.db          # 临时库（不碰仓内 data/sql.db）
export OAMP_WEB_PORT=8421                 # 非默认端口，避免与其它会话的真实服务相撞（scm 协议：默认端口不被隔离）
mkdir -p /tmp/pr004
```
- router：`hub start name=pr004-router application=node args=["oamp/bin/oamp.js","router","start"] env={OAMP_SOCKET,OAMP_DB} ready={log:"ROUTER_READY"}`
- agent（**实例名必须可反解为存在的角色**，A10）：`hub start name=pr004-agent application=node args=["oamp/bin/oamp.js","agent","start","pb-dev"] env={OAMP_SOCKET,OAMP_DB}`；就绪以 router 侧日志为准：`hub wait name=pr004-router pattern="AGENT_REGISTERED instance=pb-dev"`
- web：`hub start name=pr004-web application=node args=["oamp/bin/oamp.js","web","start","--port","8421"] env={OAMP_SOCKET,OAMP_DB} ready={log:"WEB_READY url=http://127.0.0.1:8421"}`

### 4.2 造一次"进行中 → 终态"的调用（**无模型调用**，A8）

```bash
# repo_url 是唯一键（重复 ⇒ 409）⇒ 每次造调用用一个唯一地址（T1 与 T4 共用同一临时库时必须如此）
PRJ=$(curl -s -X POST http://127.0.0.1:8421/api/projects -H 'content-type: application/json' \
        -d "{\"repo_url\":\"https://example.invalid/pr004-smoke-$(date +%s)\"}" | jq -r .project.project_id)
CALL=$(curl -s -X POST http://127.0.0.1:8421/api/messages -H 'content-type: application/json' \
        -d "{\"project_id\":\"$PRJ\",\"agent_id\":\"pb-dev\",\"text\":\"!sleep 12\"}" | jq -r .task_id)
echo "$CALL"        # ⇒ 该 task_id 即 roster 行 / call_id；约 12s 后进入终态（completed）
```
> 需要"已终态行"时用同一条命令造第二个（如 `!true`）并等它结束；`!sleep 2` 可作为"点击另一行"的目标。
> **`!sleep 12` 的时间窗**：必须在 12s 内完成"选行 → 等到终态"（§4.3 的 `waitForSelector` + `click` 通常 <1s）；若本机忙，把窗拉长到 `!sleep 20` 更稳（终态判据不看绝对时长，只看 `req=1 / fin=1 / 无第二个 req`）。

### 4.3 浏览器观测脚本（一次 `tab.run` 内完成：挂监听 → 点行 → 等终态 → 观察窗）

```js
const tab = await browser.open({ name: 'pr004', url: 'http://127.0.0.1:8421/calls' });
const out = await tab.run(async ({ page }, CALL) => {          // CALL 经 args 传入（§4.2 的 task_id）
  const ev = [];                        // 事件序列（kind/url/ts）——证据载体
  const t0 = Date.now();
  const rel = (t) => ((t - t0) / 1000).toFixed(2) + 's';
  page.on('request', (r) => { if (r.url().includes('/stream')) ev.push({ kind: 'req', url: r.url(), ts: rel(Date.now()) }); });
  page.on('requestfinished', (r) => { if (r.url().includes('/stream')) ev.push({ kind: 'fin', url: r.url(), ts: rel(Date.now()) }); });
  page.on('requestfailed', (r) => { if (r.url().includes('/stream')) ev.push({ kind: 'fail', url: r.url(), ts: rel(Date.now()) }); });

  await page.waitForSelector(`tr[data-call-id="${CALL}"]`, { timeout: 15000 });
  await page.click(`tr[data-call-id="${CALL}"]`);
  // 等到徽标进入终态（completed/failed）——即 call_result 已渲染
  await page.waitForFunction(() => {
    const b = document.getElementById('call-state');
    return b !== null && ['completed', 'failed'].includes(b.textContent.trim());
  }, { timeout: 30000 });
  const terminalAt = Date.now();
  const hint = document.getElementById('call-hint');       // renderHint() 的唯一落点
  await new Promise((r) => setTimeout(r, 6000));           // 观察窗：若每秒重连，这里会看到 5~6 个 req
  return {
    call_id: CALL, terminal_at: rel(terminalAt), events: ev,
    hint_at_terminal: hint.textContent, hint_class: hint.className,
    selected_header: document.querySelector('#call-progress h2')?.textContent ?? null,
  };
}, { args: [CALL_ID] });
console.log(JSON.stringify(out, null, 1));   // 落盘 /tmp/pr004-{baseline,after}.json
await tab.screenshot({ path: '/tmp/pr004-after.png' });   // 仅过程观察，不入库
```

### 4.4 静态守门命令族（T3）

```bash
git -C <worktree> diff --name-only cfb6736 HEAD
git -C <worktree> diff --numstat cfb6736 HEAD -- oamp/web/calls.js
git -C <worktree> diff -U3 cfb6736 HEAD -- oamp/web/calls.js
git -C <worktree> diff cfb6736 HEAD -- oamp/web/calls.html oamp/web/style.css oamp/web/api-pages.css   # 期望空
grep -c 'setInterval' oamp/web/calls.js ; grep -c 'new EventSource' oamp/web/calls.js ; grep -c 'function unsubscribe' oamp/web/calls.js
node --check oamp/web/calls.js
```

---

## 5. 证据载体与落盘

- **原始输出**：`/tmp/pr004-baseline.json`、`/tmp/pr004-after.json`、`/tmp/pr004-after.png`（临时面；**只有 JSON 里的文本序列进仓库**，见 T4 判据 7）。
- **最终证据载体**：`prs/pr-004-console-call-stream-stop.md` 的 **「验收证据」** 段（PR 文件自身在文件范围内，且原文即要求"本 PR 执行时填写"）。
- **不得**：新增 PNG / 新增文档 / 把证据写进 `status.md` / `history.md`（不在本 PR 文件范围，主 agent 维护）。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（T4 判据 4 的口径）**：把"终态后**不出现**'订阅中断'提示条"作为验收 5（其余面逐字不变）的可判定判据之一。
  - 为什么需要推导：PR 验收 5 只列举了"roster 6 列 / 5s 轮询 / 空态/错误条 / 切换逻辑"，没有把"新改动不得引入错误条"单列。
  - 推导依据：A12（客户端 `close()` 不派发 `error`）+ `calls.js:139-143`（只有 `onerror` 才置错误提示）⇒ 若实现走错路径（例如靠 `onerror` 收尾或未真正关闭），该提示条会亮起；这是"其余部分逐字不变"在订阅面上的直接可观测投影。

**无其他推导项**：AC1~AC7 的其余判据均可逐字回指 PR 文件、`architecture.md`（§0 / §1.3 F-12 / §6.2 S-9 / §7 L2-13 / §11.2 O-4）或 §0.3 的事实锚点。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的 5 条边与拓扑序 `T1 < T2 < T3 < T4 < T5`）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **AC4 的"无每秒重连"在本 PR worktree 内不可复现**（范围口径，须主 agent 知悉）：该现象由 **pr-005 的服务端终态关流 + 晚订阅补发** 叠加 `retry: 1000` 才产生（§1.3 F-12、§6.2 S-9），而 base `cfb6736` 上 `closeKey` 仍 0 调用点（A6：pr-003 / pr-005 未合并）⇒ 服务端不会在终态关流，`EventSource` 也就不会重连。**本任务列表的判据据此改为可复现的等价形态**：① `req = 1`（只建立一次）；② 终态后该请求出现 `fin`（连接由**客户端**关闭）；③ 观察窗 ≥6s 内无第二个 `req`；④ 与 T1 基线（`fin = 0`）成对照。这四条合起来等价于"终态即停 + 不会进入每秒重连"，且**全部可在本 worktree 实测**。若主 agent 要求严格复现重连现象，则必须等 pr-005 合并后补做（超出本 PR 文件范围，本 PR 不自扩）。
2. **AC3 的"对已终态调用选中 ⇒ 收到终态帧后订阅关闭"在 base 下无帧可收**：base 服务端不补发（A6），该场景**只会**出现"1 个连接、0 帧、无提示条变化"。故本任务列表把 AC3 的判据落为"该场景与改动前**零差异**（无回归）"，并把"终态即关"的实证放在**进行中→终态**路径上（T4 判据 1~3）。PR 原文括号已写"（当前服务端实现下亦无回归）"，与此读法一致。
3. **PR 文件要求的"截图"不入库**：文件范围只含 `calls.js` 与 PR 文件自身 ⇒ 新增 PNG 会越界；「验收证据」段原文是"截图**/**时间戳序列"，本 PR 取**时间戳序列**（文本可入库、可复核），截图仅在 `/tmp` 作过程观察。
4. **基线 commit 与前三 PR 不同（已知差异，非缺陷）**：本 worktree 的 base = `cfb6736`（含 pr-002 合并），而 pr-001~003 为 `72b659f` ⇒ 所有 `git diff` / `--numstat` 判据一律以 `cfb6736` 为准（A13）；验收证据中须写明基线（否则"≤3 行"无法复核）。
5. **简报提到的 `DC-13` 不存在**：本迭代 `deferred-demand-changes.md` 当前只到 **DC-09**（另有 DC-08a），无 DC-13 条目；本次仍按 DC-06/DC-08 的"30 分钟上限 + 任务切小 + 增量落盘"约束切分（本 PR 天然是 1 行改动 + 5 个粒度的取证步骤）。属简报引用偏差，不影响本 PR 的切分。
6. **简报工作区地址与实际一致**：`…/worktrees/0029-pr-004-console-call-stream-stop` 存在，`git branch --show-current` = `feat/0029-pr-004-console-call-stream-stop`（本次无笔误，无需按实际检出纠偏）。
7. **粒度决策记录（本 PR 未写 `roles/planner/data/`）**：本次把"静态守门"（T3）与"端到端 smoke"（T4）拆开，理由是**判据层不同**（前者是 diff/grep 的机械判据、后者是浏览器事件序列），且静态失败时不应浪费一次集群 smoke；把"改动前基线"（T1）单列，理由是**顺序不可逆**。按 planner 角色定义本应记入 `data/`，但本 PR 文件范围不含（且明列不触碰）`roles/**` ⇒ 记录在此，不越界写 `roles/`。
8. **架构信息无缺口**：AC1~AC7 均可回指 PR 文件、`architecture.md`（§0 / §1.3 / §6.2 S-9 / §7 L2-13 / §11.2 O-4）与 `prd/F09`；唯一需要推导的口径（MI-P1）已列 §6。
