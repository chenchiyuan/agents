# pr-006-tasks.md — pr-006 内部任务列表（协议文档面与索引快照，`oamp/API.md` / `oamp/llms.txt`）

**迭代**: 0029-hub-client-session-and-duplex ｜ **阶段**: 5（PR 实现）｜ **PR 文件**: `prs/pr-006-protocol-docs-and-index.md`
**PR worktree**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index` ｜ **base = `b090369`**（迭代分支 tip：**pr-001 / pr-002 / pr-003 / pr-005 均已合并**，A1）
**任务总数**: **12**（T0~T11）｜ **依赖图**: **无环**（见 §2）｜ **性质**: 本 PR 内部任务列表（子 agent 内部步骤，**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（10 条验收标准）+ `architecture.md`（§3.10 文档投影链、§4 A-09 条文落点 / A-14 `API.md` 同步"不是可选项"、§5.1 新路由表、§5.5 改动面、§6.2 S-11、§7 L2-11、§9.2 N-13、§10 R-4 / R-5）+ `prd/{F11,F12,F17}*.md` + 代码库实读（§0.3 逐条带 `文件:行号`；**依赖 PR 已合并 ⇒ 直接读其真实实现**，不按设计稿猜）

---

## 0. 范围、文件面与事实锚点

### 0.1 本 PR 文件范围（唯一可写面）

| # | 文件 | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `oamp/API.md` | 改（§3 标题计数 + 8 行表行 + 8 个新小节 + 新增 `### 2.4 等待语义`） | 逐任务见 §1（T1/T2/T4） |
| 2 | `oamp/llms.txt` | 改（**只由既有生成器产出**，不手改） | T6 |
| 3 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md` | 改（**仅「验收证据」段**，七字段不动） | T11 |
| 4 | `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index-tasks.md` | 本文件（本阶段产物，随 PR 分支提交） | — |

### 0.2 非目标（零改动清单 / 防夹带）

- **不触碰**（PR 文件「不触碰」逐条）：`oamp/src/web.js`（路由登记与 `docLink` 归 pr-005）、`oamp/sdk/**`、`oamp/skill/hub.md`（pr-007）、`oamp/README.md`（R-4 既有遗留，明确不改）、`oamp/scripts/gen-llms-txt.mjs`（既有生成器，零改动）、`oamp/web/**`、`oamp/src/{transport,router,registry,persist,principals,pickup}.js`、`roles/**`、`docs/**`（除 PR 文件两句 + 本文件）。
- **不新增**：测试文件（本仓 0 个 `.test.js`）、第三方依赖、env 键、配置键、DB 表/列、路由、事件名。
- **不做**：文档站重构 / 新文档格式 / 示例站（F17 边界）；不重写既有 21 条表行与小节（AC「既有 21 条表行与 21 个小节的文字逐字不变」）；不改 `docLink` 登记值（那是改 `web.js` = 越界，见 §7 疑问 1）；不把 `README.md` 的既有 HTTP 表一致性一并修（R-4 明文不做）。

### 0.3 实读事实锚点（2026-09-16 实读，base `b090369`；判据基础）

| # | 事实 | 位置 / 取证命令 |
|---|---|---|
| **A1** | **依赖已就绪**：base 已含 pr-005 的合并提交（`oamp/src/web.js` 内 8 条新路由与 `docLink` 均已落盘） | `git -C <WS> log --oneline -1` = `b090369 merge: pr-005 …` |
| **A2** | **运行侧登记 = 29 条**（本 PR 两侧产物的集合由它派生） | `grep -c "path: '/api/" oamp/src/web.js` → **29** |
| **A3** | **`API.md` §3 现状**：标题 `:157`（`## 3. 接口清单（21 条）`）、表行 `:161-181`（21 行）、小节 `:187-990`（`### 3.1` ~ `### 3.21`）、§3 段尾 `---` `:990`、`## 4. 事件流` `:992` | `grep -n '^## \|^### ' oamp/API.md` |
| **A4** | **8 条新路由的登记 `docLink`（真源）**：`POST /api/principals` → `API.md#322-post-apiprincipals`；`GET /api/principals/:principal_id` → `#323-get-apiprincipalsprincipal_id`；`GET /api/health` → `#3111-get-apihealth`；`GET /api/subscribe` → `#311-get-apisubscribe`；`GET /api/pickup` → `#312-get-apipickup`；`POST /api/pickup/:call_id/ack` → `#313-post-apipickupcall_idack`；`GET /api/calls/wait` → `#318-get-apicallswait`；`POST /api/calls/:call_id/cancel` → `#3110-post-apicallscall_idcancel` | `grep -n "docLink: 'API.md#" oamp/src/web.js`（`web.js:659-1859`） |
| **A5** | **slug 推导规则（GitHub 风格，逐字由既有登记反推）**：标题去格式符后**转小写、删 `.` `,` `/` `` ` `` `<` `>` `?` `=`、空格 → `-`、`_` 保留**。实证：`### 3.10 \`GET /api/events\`` ↔ `#310-get-apievents`；`### 3.9 \`GET /api/stream?chat_id=<id>\`` ↔ `#39-get-apistreamchat_idid`；`### 3.19 \`GET /api/calls/<call_id>\`` ↔ `#319-get-apicallscall_id` | `grep -n "docLink: 'API.md#" oamp/src/web.js` + `grep -n '^### 3\.' oamp/API.md` 对照 |
| **A6** | **doctor R1 机制**：文档侧 `readDocumented` 逐行正则 `^\|\s*\d+\s*\|\s*\`(GET\|POST)\s+(\/api\/[^\`]*)\``（`doctor.js:34-42`，**只认「纯数字行号 + 反引号方法路径」形态**）；运行侧 = `GET /api/docs` 的 `routes[]`；`compareSignatures` 双向比对，两侧都有 ⇒ pass（`doctor.js:45-72`）；`API_DOC_PATH` = 包根 `API.md`（`doctor.js:22`）；R2 自动探非流式 GET（`:112-141`）、R3 探针集固定（`:143+`） | `sed -n '22,72p' oamp/sdk/doctor.js` |
| **A7** | **`llms.txt` 生成链（单产物）**：`scripts/gen-llms-txt.mjs:12` `import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js'` ⇒ `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 写包根 `llms.txt`；自报格式 = `llms.txt 已生成：<绝对路径>（接口 N 条，M 字节）`；`web.js:1975` 的 `renderLlmsTxt` 纯函数（不读盘 / 不看时间 / 不看 env / 不看端口）；`web.js:595` `STATIC_FILES['/llms.txt'] = 'llms.txt'`（HTTP 响应 = 同一份文件字节 ⇒ 单产物） | `cat oamp/scripts/gen-llms-txt.mjs`；`grep -n "llms" oamp/src/web.js` |
| **A8** | **`API.md` §2 现状**：`### 2.1 成功响应` `:72`、`### 2.2 统一错误契约` `:77`、`### 2.3 对象字段` `:108`、`---` `:155`、`## 3.` `:157` ⇒ **无 `### 2.4`**（等待语义小节的落点，A-09 明写 `### 2.4`） | `grep -n '^### 2\.' oamp/API.md` |
| **A9** | **既有小节体例**（新小节必须逐字沿用）：`### 3.x \`METHOD /path\`` → 一句话摘要 → `**参数**`（表：参数/类型/必填/默认/说明；无参写 `**参数**：无。`）→ `**成功响应** \`200\``（json 块）→ `**错误**`（表：`code` / HTTP / 触发条件 / `error` 形态；无码写 `**错误**：无（…）`）。**无 `docLink` 字面行**（`docLink` 的语义载体 = 本节标题的锚点） | `sed -n '501,560p' oamp/API.md`（3.9/3.10/3.11/3.12 体例样本） |
| **A10** | **隔离集群起停面（真集群取证，绝不触碰主集群）**：`node oamp/bin/oamp.js router start` / `agent start <instance-id>`（实例名须可反解为存在的角色，如 `dev-1` ⇒ 角色 `dev`，`roles/dev` 在树内）/ `web start --port <n>`；env 旋钮 = `OAMP_SOCKET`（socket 路径，**用短路径** `/tmp/o29p6/r.sock`，避 UDS 长度上限）/ `OAMP_DB` / `OAMP_WEB_PORT`；`GET /llms.txt` 由 `STATIC_FILES` 静态面提供（`web.js:585-595`、`:2478`）；`hub doctor` 的端口取自 `createSurface` 的 `ctx.port`（受 `OAMP_WEB_PORT` 控制，`sdk/cli.js:281-303`）；`!sleep N` 消息分支用 shell 执行器、**不触发模型调用**（R-F7 的既有原语） | `cat oamp/src/config.js:141-156`；`grep -n "STATIC_FILES" oamp/src/web.js`；`grep -n "OAMP_SOCKET\|OAMP_DB" oamp/src/config.js` |

### 0.4 本 PR 内冻结契约（跨任务一致面，逐条带追溯）

1. **§3 表行追加纪律**〔AC1；A6〕：既有 21 行**逐字不动**，新增 8 行**追加在 `:181` 之后**，行号取 **22~29**（延续 0018/0021 的连续编号惯例），行文本形态逐字照 `| n | \`METHOD /api/…\` | 用途 |`；路径参数段沿用**既有 `<param>` 写法**（不是 `:param`——`doctor` 的 `shapePath` 两者都归一）。
2. **新增小节编号 = 登记 `docLink` 的号码（逐字照抄，不得自拟）**〔AC3；A4/A5〕：`3.11` `GET /api/subscribe`、`3.12` `GET /api/pickup`、`3.13` `POST /api/pickup/<call_id>/ack`、`3.18` `GET /api/calls/wait`、`3.110` `POST /api/calls/<call_id>/cancel`、`3.111` `GET /api/health`、`3.22` `POST /api/principals`、`3.23` `GET /api/principals/<principal_id>`。**唯一判据 = GitHub slug 逐字等于登记 `docLink` 的片段**（A5 规则）；编号来源见 §6 MI-P1（需主 agent 确认）。
3. **新增小节排布**〔AC2〕：8 个小节**追加在 `### 3.21` 之后、§3 段尾 `---`（`:990`）之前**，按上面的号码升序排列（`3.11 → 3.12 → 3.13 → 3.18 → 3.110 → 3.111 → 3.22 → 3.23`）；表行顺序与小节顺序一致（行 22 = 第 1 个新小节，以此类推）。
4. **五项语义齐备**〔AC2；F17 验收 1/4；A9〕：每节 = `摘要`（**调用方视角**：说明"解决什么问题"）+ `参数` + `响应` + `错误` + `docLink`（= 本节锚点）。文本事实（参数名 / 类型 / 必填 / 默认 / 响应键 / 错误码）**逐字取自运行侧登记**（`projectRoutes` 的 `params` / `response` / `errors`，A4），不引入登记之外的键或码。
5. **等待语义小节**〔AC4；A-09；A8〕：位置 = `### 2.3` 之后、§2 段尾 `---`（`:155`）之前，标题逐字 `### 2.4 等待语义`；明文**恰好四条**，逐条覆盖 ① 退出条件必须是终态 ② 超时只表示放弃等待（不改任务状态、不产生失败结论）③ 禁止把"轮询 + 超时"当作等待的实现 ④ 客户端等待预算是放弃等待的预算（不是语义上限）；既有章节文字零改动（本任务只做插入）。
6. **既有文字零改动**〔AC5；G01〕：`git diff -- oamp/API.md` 的**删除行恰好 1 行** = `-## 3. 接口清单（21 条）`；其余全部为新增行（插入态）。
7. **`llms.txt` 只由脚本产出**〔AC6；A7〕：`node oamp/scripts/gen-llms-txt.mjs`，不手改、不新增条目文本；`git diff` 中该文件的变化只能落在接口清单段（`## 接口（N 条）` 行 + 8 条 `- METHOD /path — summary`）。
8. **快照与 HTTP 同源**〔AC7；A7〕：唯一判据 = `GET /llms.txt` 响应体与包根 `oamp/llms.txt` **逐字节相同**（`cmp`/`shasum -a 256`）。
9. **零面**〔AC9〕：`git diff --name-only b090369 -- oamp/README.md oamp/sdk/doctor.js oamp/scripts/gen-llms-txt.mjs oamp/src/web.js` 必须为空。
10. **条文与行为一致**〔AC10；F12 验收 2 的条文侧〕：反向验证用**既有 `!sleep` 原语**造"在跑"项（无模型调用）：等待到超时返回后，该调用 `calls get` 的 `state` 仍非终态、`error` 为 `null`、`exit_code` 为 `null` 且与等待前**逐字相同**。

### 0.5 PR 验收标准 → 任务映射（10 条 AC 全覆盖，无孤儿任务）

| # | PR 文件 AC 原文（摘要） | 服务任务 |
|---|---|---|
| 1 | §3 标题计数 21 → 29，表行 29 条且与 `GET /api/docs` 双向 1:1 | **T1**（改）+ **T3**（双向 1:1 自检）+ **T8**（doctor R1） |
| 2 | 8 个新 `### 3.x` 小节齐备，逐条含五项语义；摘要以调用方视角写 | **T2** |
| 3 | 新路由的 `docLink` 锚点可解析到对应小节 | **T2**（落成标题）+ **T3**（slug 自检） |
| 4 | 新增「等待语义」小节，位置按既有体例（A-09 = `### 2.4`），明文四条 | **T4** |
| 5 | 既有 21 条表行与 21 小节的文字逐字不变（删除行仅 §3 标题计数那一行） | **T5** |
| 6 | `llms.txt` 由生成器重生成、变更全落在接口清单段、自报条目数 = 29 | **T6** |
| 7 | 快照与 HTTP 产物同源（逐字节相同） | **T7** |
| 8 | `hub doctor` 三段全 pass（R1 无 `文档未覆盖` / 无 `登记缺失`；R2 自动扩展；R3 探针集不变） | **T8** |
| 9 | `oamp/README.md` 未被修改、`oamp/sdk/doctor.js` 未被修改 | **T9** |
| 10 | 条文与行为一致（反向验证：等待到超时后仍非终态、`error` 空、`exit_code` 未变） | **T10** |
| — | 全部 AC 的证据载体（PR 文件「验收证据」段） | **T11** |

> **无孤儿任务**：**T0** 是全部任务的判据基础（A1~A10 的原始输出），**T11** 是全部 AC 的证据载体，其余每个任务在上表中至少出现一次。

---

## 1. 任务列表

### T0: 事实基线与「AC → 判据」冻结（读码取证，零写入）

- **服务哪条 AC**: 全部 AC 的判据基础（A1~A10 的原始输出）
- **描述**: 在任何写入之前，把本 PR 的判据基础固化为可复制的原样输出：① base commit 与工作区状态；② 运行侧登记 29 条（含 8 条新路由的 `docLink`）；③ `API.md` 的 §2/§3 现状行号（标题 / 表行 / 小节 / 段尾）；④ doctor R1/R2/R3 的机制源码片段；⑤ `llms.txt` 生成器的导入行与自报格式；⑥ `STATIC_FILES` 的 `/llms.txt` 行。
- **文件·锚点**: 零源码改动（只读 `oamp/src/web.js`、`oamp/sdk/doctor.js`、`oamp/scripts/gen-llms-txt.mjs`、`oamp/API.md`、`oamp/llms.txt`）。
- **步骤**: ① `git -C <WS> log --oneline -1` + `git -C <WS> status --short`；② `grep -c "path: '/api/" oamp/src/web.js` + `grep -n "docLink: 'API.md#" oamp/src/web.js`；③ `grep -n '^## \|^### ' oamp/API.md`；④ `grep -n "readDocumented\|compareSignatures\|API_DOC_PATH" oamp/sdk/doctor.js`；⑤ `grep -n "gen-llms-txt\|import {" oamp/scripts/gen-llms-txt.mjs`；⑥ `grep -n "llms" oamp/src/web.js`。
- **验收判据（可执行）**:
  1. ②的输出含 **29** 个 `path: '/api/` 与 **8** 条 `API.md#3…` 形态的新 `docLink`（号码与 A4 逐字一致）。
  2. ③的输出中 `## 3. 接口清单（21 条）` 的现行行号 = **157**、`### 3.21` 存在、`## 4. 事件流` 行号 = **992**。
  3. ⑥的输出含 `'/llms.txt': 'llms.txt'`（STATIC_FILES 键）。
  4. 全部输出为**原始 stdout**（未加工、未裁剪）。
- **前置依赖**: 无（**必须在任何写入前执行**）
- **优先级**: P0

---

### T1: `API.md` §3 标题计数 + 8 行表行（22~29）

- **服务哪条 AC**: AC1（表行 29 条）+ AC5（既有 21 行逐字不变）
- **描述**: ① `## 3. 接口清单（21 条）` → `## 3. 接口清单（29 条）`；② 在 `:181`（第 21 行）之后**追加** 8 行表行，行号 22~29，顺序 = 冻结契约 2 的号码升序。
- **文件·锚点**: `oamp/API.md:157`（标题行改写）、`:181` 与 `:182`（空行）之间插入 8 行；行文本的三列形态逐字照 `:161-181`（`| n | \`METHOD /api/…\` | 用途 |`）。
- **步骤**: ① 改写标题计数；② 插入 8 行（用途列取运行侧 `summary` 的短形态，允许压缩为与既有表行等长的短语）；③ `grep -c` 复核行数 = 29。
- **验收判据（可执行）**:
  1. **标题**：`grep -n '^## 3\. 接口清单' oamp/API.md` ⇒ `…（29 条）`。
  2. **行数**：`awk` 统计 §3 标题到 §3 段尾 `---` 之间的表行（`^\| [0-9]+ \| \`(GET|POST) /api/`）⇒ **29**；且行号集合 = `1..29`（无重号、无缺号）。
  3. **既有行逐字**：`git -C <WS> diff -U0 -- oamp/API.md` 中表行区（`:159-181`）**只有 `+` 行、无 `-` 行**。
  4. **集合 1:1（文档侧自检，doctor 同口径）**：以 doctor 的正则（A6）抽文档侧 `{method, path}`，与运行侧 `createApiRoutes` 的 29 条同法归一后**双向差集为空**。
- **前置依赖**: T0
- **优先级**: P0

---

### T2: 8 个新小节（五项语义，摘要以调用方视角写）

- **服务哪条 AC**: AC2 + AC3（落成标题 = 锚点目标）
- **描述**: 在 `### 3.21`（`:953-990`）之后、§3 段尾 `---`（`:990`）之前，按号码升序追加 8 个小节：`### 3.11 \`GET /api/subscribe\``、`### 3.12 \`GET /api/pickup\``、`### 3.13 \`POST /api/pickup/<call_id>/ack\``、`### 3.18 \`GET /api/calls/wait\``、`### 3.110 \`POST /api/calls/<call_id>/cancel\``、`### 3.111 \`GET /api/health\``、`### 3.22 \`POST /api/principals\``、`### 3.23 \`GET /api/principals/<principal_id>\``。每节五项语义按 A9 体例。
- **文件·锚点**: `oamp/API.md`（`:990` 之前插入）；**事实来源 = 运行侧登记**（`projectRoutes` 的 `params`/`response`/`errors`，A4）+ 实现锚点（`web.js` 各 handler：`principals` `:686-717`/`:719-741`、`health` `:743-791`、`subscribe` `:1050-1105`、`pickup` `:1613-1640`、`wait` `:1647-1700`、`cancel` `:1737-1772`、`pickup ack` `:1776-1800`）+ 契约条文（`architecture §4 A-09/A-10/A-12`、§5.1 表）+ `prd/{F01,F07,F11,F12,F13,F15,F16,F17}`。
- **步骤**: ① 逐节写标题（号码逐字照登记 `docLink`）；② 摘要**以调用方视角**说明"解决什么问题"（不是列参数）；③ `**参数**` 表逐行照登记 `params`（`name`/`in`/`type`/`required`/`desc`），无参写 `**参数**：无。`；④ `**成功响应** \`200\`` + json 块（键集 = 登记 `response` 的键集，含 SSE 面用既有 SSE 帧样例）；⑤ `**错误**` 表逐条照登记 `errors` + HTTP 码与文案（从实现锚点取原文案），无码写 A9 的兜底句式；⑥ 每节末尾给出 `docLink` 语义落点行（形式：`> **文档链接**：\`API.md#<与登记逐字相同的 slug>\``），使五项语义在**同一小节内可逐项核对**。
- **验收判据（可执行）**:
  1. **齐备**：`grep -c '^### 3\.\(11\|12\|13\|18\|110\|111\|22\|23\) ' oamp/API.md` ⇒ **8**；逐个标题行可 `grep -n` 到。
  2. **五项语义**：对 8 节各 `sed` 出正文，逐节存在 `**参数**`、`**成功响应** \`200\``、`**错误**`、`> **文档链接**：` 四类标记（摘要 = 标题下一行非空段落）⇒ 每节 4/4 命中、8 节全中。
  3. **锚点**（AC3）：脚本以 A5 规则计算 8 个标题的 GitHub slug，与登记 `docLink` 的片段**逐字相等**（8/8）；反向也成立（登记中无指向别名的 `docLink`）。
  4. **文本事实取自登记**：脚本比对每节参数表出现登记 `params[].name` 全集、错误表出现登记 `errors` 全集（8/8 无缺项、无多出）。
  5. **摘要视角**：8 条摘要均说明"解决什么问题"（例：`等待一组调用达到终态` 类语义句），**不出现**"参数/入参表"式罗列（人工判定 + 与登记 `summary` 一致，不引入第二个真源）。
- **前置依赖**: T0、T1（表行与小节同序、同集合）
- **优先级**: P0

---

### T3: 文档面 ↔ 运行侧双向 1:1 自检（AC1 后半 + AC3 的机械判据）

- **服务哪条 AC**: AC1（双向 1:1）、AC3（锚点可解析）
- **描述**: 写一次性脚本（**不入库**）复刻 doctor R1 的双向比对口径，并追加锚点解析判据：① 文档侧表行 ↔ 运行侧 `createApiRoutes`；② 8 个新标题的 slug ↔ 8 条登记 `docLink`。
- **文件·锚点**: 零写入（`node --input-type=module` 脚本，`import('./oamp/src/web.js')` + 读 `oamp/API.md`）。
- **步骤**: ① 用 A6 的正则抽文档侧；② `shapePath` 归一后双向差集；③ 计算新标题 slug 与登记 `docLink` 比对；④ 打印三组结论计数与差集内容。
- **验收判据（可执行）**:
  1. **双向差集为空**：`doc只有` = `[]` 且 `run只有` = `[]`（计数 29/29）。
  2. **锚点 8/8**：每条形如 `POST /api/principals → #322-post-apiprincipals ✓`，无 `✗`。
  3. 脚本正文与其原样输出都进 T11 的证据段（可重建）。
- **前置依赖**: T1、T2
- **优先级**: P0

---

### T4: 新增 `### 2.4 等待语义`（条文唯一真源，明文四条）

- **服务哪条 AC**: AC4
- **描述**: 在 `### 2.3 对象字段`（`:108`）之后、§2 段尾 `---`（`:155`）之前插入 `### 2.4 等待语义`：① 等待的退出条件**必须**是终态 ② 超时**只表示放弃等待**（不改任务状态、不产生失败结论）③ **禁止**把"轮询 + 超时"当作等待的实现 ④ 客户端等待预算（如 30 分钟）是**放弃等待的预算**，不是等待的语义上限。措辞与 `architecture §4 A-09` 的四点逐条对应。
- **文件·锚点**: `oamp/API.md:108`（2.3 起点）→ `:155`（段尾 `---`）；引用的既有接口面 = `### 3.18 \`GET /api/calls/wait\``（T2 落成）、`### 3.17 \`GET /api/calls/<call_id>/stream\``（既有）；**不复制实现细节**（实现形态归 pr-005）。
- **步骤**: ① 插入标题与四条（每条一句，逐字含 ①②③④ 的判据词：`终态` / `只表示放弃等待` / `禁止` / `预算`）；② 明确"两种返回可判定地区分"的机械载体 = `timed_out`（并入第 ② 条的从属句，**不新增第五条**）。
- **验收判据（可执行）**:
  1. **位置**：`grep -n '^### 2\.' oamp/API.md` ⇒ 恰好 `2.1/2.2/2.3/2.4`，且 `### 2.4 等待语义` 的行号 < `## 3. 接口清单`（T1 改后的行号）。
  2. **四条齐备**：`sed -n '<2.4 起>,<段尾>p' oamp/API.md` 的正文含且仅含 4 个编号条目（`①`~`④` 或 `1.`~`4.`），逐条含判据词 `终态`、`放弃等待`、`禁止`、`预算`。
  3. **既有文字零改动**：`git -C <WS> diff -U0 -- oamp/API.md` 在 §2 区段（`< 2.4 起点`）内**只有 `+` 行**。
- **前置依赖**: T0（既有行号）；**无环**：T1/T2（§3 区）与 T4（§2 区）互不依赖
- **优先级**: P0

---

### T5: 既有文字零改动核查（删除行恰好 1 行）

- **服务哪条 AC**: AC5（F17 验收 5 / G01）
- **描述**: 以 `git diff` 的删除行为唯一判据，核既有 21 条表行与 21 个小节文字逐字不变。
- **文件·锚点**: 零写入（只读 `git diff`）。
- **步骤**: ① `git -C <WS> diff --numstat -- oamp/API.md`；② `git -C <WS> diff -U0 -- oamp/API.md | grep '^-'`；③ 结论比对冻结契约 6。
- **验收判据（可执行）**:
  1. `git -C <WS> diff -U0 -- oamp/API.md | grep -c '^-[^-]'` ⇒ **1**，且该行逐字 = `-## 3. 接口清单（21 条）`。
  2. 新增行数 = 表行 8 + 小节若干（> 0），且 `grep -c '^+### 3\.'` ⇒ **8**。
  3. 既有小节的既有行（`3.1`~`3.21`）在 diff 中**零命中**（`git diff -U0 | grep -E '^-### 3\.(1|2|…|21)'` 为空）。
- **前置依赖**: T1、T2、T4
- **优先级**: P0

---

### T6: `llms.txt` 重生成（既有脚本，不手改）

- **服务哪条 AC**: AC6
- **描述**: 运行 `node oamp/scripts/gen-llms-txt.mjs`（在 PR worktree 根或 `oamp/` 下皆可），使包根快照含 29 条接口。
- **文件·锚点**: `oamp/scripts/gen-llms-txt.mjs:12`（导入）；输出 `oamp/llms.txt`；变更面 = `## 接口（21 条）` → `（29 条）` 行 + 8 行 `- METHOD /path — summary`。
- **步骤**: ① 运行生成器并记录其自报 stdout；② `git diff --numstat -- oamp/llms.txt`；③ 核 diff 的变更位置（只落在接口清单段）。
- **验收判据（可执行）**:
  1. **自报条目数 = 29**：生成器 stdout 形如 `llms.txt 已生成：<绝对路径>（接口 29 条，<n> 字节）`。
  2. **非手改**：`git -C <WS> diff -U0 -- oamp/llms.txt | grep '^+' | grep -v '^+++'` 的每一条都能逐字由 `createApiRoutes` 的 `summary` 复现（脚本比对：快照清单行集合 == `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 的行集合）。
  3. **变更落点**：`git diff` 中被改 / 新增的行只出现在 `## 接口（N 条）` 段（`- 深入` 段与文首说明零变动）。
- **前置依赖**: T0（**不依赖 API.md**：本产物的真源是路由登记）
- **优先级**: P0

---

### T7: 快照与 HTTP 产物同源（逐字节）

- **服务哪条 AC**: AC7（Z-6）
- **描述**: 在隔离集群里 `GET /llms.txt`，与包根快照逐字节比对。
- **文件·锚点**: 零源码改动；`web.js:585-595`（`STATIC_FILES`）、`:2478`（静态面出口）；隔离集群按 A10 起（**短 socket 路径** `/tmp/o29p6/r.sock`、非默认端口）。
- **步骤**: ① 起隔离 web（`OAMP_SOCKET` / `OAMP_DB` / `OAMP_WEB_PORT`）；② `curl -s http://127.0.0.1:<port>/llms.txt -o` 到工作区外临时文件；③ `cmp` + `shasum -a 256` 双侧；④ 收尾停进程（只停自建集群名）。
- **验收判据（可执行）**:
  1. `cmp` 退出码 = 0（无差异输出）；两侧 `shasum -a 256` 摘要相同。
  2. 字节数 = 生成器自报的字节数（两处一致）。
  3. 证据中给出 `curl -o /dev/null -w '%{http_code} %{size_download}'` 的原样输出（`200` + 与快照同字节数）。
- **前置依赖**: T6
- **优先级**: P0

---

### T8: `hub doctor` 三段全 pass（隔离集群）

- **服务哪条 AC**: AC8（F17 验收 3 / R-5）
- **描述**: 在隔离集群（router + agent + web）上跑 `hub doctor`，核 R1 无 `文档未覆盖` / 无 `登记缺失`，R2 覆盖新增的非流式 GET（自动扩展），R3 探针集不变。
- **文件·锚点**: 零源码改动；`oamp/sdk/doctor.js`（R1 `:45-72`、R2 `:112-141`、R3 `:143+`）；`oamp/sdk/cli.js:281-303`（`hub doctor` 的端口取 `ctx.port`）。
- **步骤**: ① 起隔离 router（短 socket）+ 一个 agent（`dev-1`，角色 `dev` 存在）+ web（非默认端口）；② `OAMP_WEB_PORT=<port> node oamp/bin/hub.js doctor`；③ 抽取 `items[]` 中 `ok:false` 的条目（**必须为空**）与 `R2`/`R3` 的条目集合；④ 记录 pass 项的计数与 8 条新路由在 R1/R2 中的条目原文。
- **验收判据（可执行）**:
  1. **R1 双向全 pass**：输出中不存在 `reason: "文档未覆盖"` 与 `reason: "登记缺失"`（`grep` 计数 = 0）；8 条新路由各有一行 `R1 GET|POST /api/…` 且 `ok:true`。
  2. **R2 自动扩展**：4 条新增非流式 GET（`/api/subscribe` 为 sse 除外 ⇒ `/api/health`、`/api/pickup`、`/api/calls/wait`、`/api/principals/:principal_id`）各有一行 `R2 …` 且非 `端点未登记`；新增 POST 行 `skipped:true`（既有"写端点不探"口径）。
  3. **R3 探针集不变**：R3 条目集合与既有 8 个 Router 方法一致（无新增、无缺失）。
  4. 原始 JSON 输出（或其 `jq` 投影）原样进 T11 证据段。
- **前置依赖**: T1、T2（文档侧表行/小节齐备）；**不强依赖 T6/T7**（R1 只读 `API.md`），但证据按 §3 增量顺序在 T7 之后跑
- **优先级**: P0

---

### T9: 零面核查（`README.md` / `doctor.js` / 生成器 / `web.js` 未被修改）

- **服务哪条 AC**: AC9 + PR 文件「不触碰」清单
- **描述**: 以 `git diff --name-only` 与 `git status --short` 为判据，核本 PR 的改动面**只在**文件范围内。
- **文件·锚点**: 零写入。
- **步骤**: ① `git -C <WS> diff --name-only b090369`；② `git -C <WS> diff --name-only b090369 -- oamp/README.md oamp/sdk/doctor.js oamp/scripts/gen-llms-txt.mjs oamp/src/web.js oamp/skill/hub.md oamp/sdk/surface.js`（**必须为空**）；③ `git -C <WS> status --short`。
- **验收判据（可执行）**:
  1. ①的输出 ⊆ `{oamp/API.md, oamp/llms.txt, docs/…/pr-006-protocol-docs-and-index.md, docs/…/pr-006-protocol-docs-and-index-tasks.md}`。
  2. ②的输出为空。
  3. ③除既有未跟踪 `clarifications/` 外无其它未跟踪产物（临时脚本 / 探针文件一律落在工作区外）。
- **前置依赖**: T1、T2、T4、T6（写入完成后）
- **优先级**: P0

---

### T10: 条文与行为一致（反向验证：等待到超时 ≠ 失败）

- **服务哪条 AC**: AC10（F12 验收 2 的条文侧对照）
- **描述**: 用**既有 `!sleep` 原语**造一个"在跑"的调用（不触发模型调用），对它做一次带超时的等待，证明"超时只表示放弃等待"。
- **文件·锚点**: 零源码改动；`POST /api/messages` 的 `!sleep N` 分支（A10）；`GET /api/calls/wait?ids=&timeout_ms=2000`（T2 落成的 `3.18` 节）；`GET /api/calls/<id>`（既有 `3.19`）。
- **步骤**: ① 在隔离集群里创建项目 + 对话，发 `@dev !sleep 6` ⇒ 取 `task_id`；② **等待前**记一次 `GET /api/calls/<id>`（`state/error/exit_code` 三键）；③ `curl "…/api/calls/wait?ids=<id>&timeout_ms=2000"` ⇒ `timed_out:true` + `unresolved[0].state='working'`；④ **等待后**再记一次同一三键。
- **验收判据（可执行）**:
  1. 等待响应 `timed_out` = `true` 且该 id 出现在 `unresolved`（`state` 非 `null`）。
  2. ②③④中 `state` ∈ `{submitted, working}`（**非终态**）、`error` = `null`、`exit_code` = `null`；②与④**逐字相同**（`diff` 为空）。
  3. 该调用最终自然终态（等 `!sleep` 结束再取一次 `calls get`，`state` = `completed`）——证明超时未"冻结"或改写任何状态。
  4. 命令与三次原样输出进 T11 证据段（含超时等待的完整响应体）。
- **前置依赖**: T2（`3.18` 节落成）、T7/T8 的同一隔离集群（同一 socket / 端口，省一次起停）
- **优先级**: P0

---

### T11: 验收证据落盘（PR 文件「验收证据」段）+ 占位符自检

- **服务哪条 AC**: 全部 10 条 AC 的证据载体（AC 未全过 ⇒ 本任务未完成）
- **描述**: 把 T0~T10 的原始命令与原样输出按 PR 文件「验收证据」段的要求逐条回填（**只改该段，七字段不动**）。
- **文件·锚点**: `prs/pr-006-protocol-docs-and-index.md` 的 **「验收证据」** 段；体例先例 = 同迭代 `pr-005-web-session-and-call-surface.md` 的证据段（命令自带工作目录与绝对路径）。
- **步骤**: ① 逐 AC 一行：命令 + 紧跟的原样 stdout/stderr；② 附 `grep -nE '/tmp/|<[a-z_]+>' <本 PR 文件>` 的自检输出（证明无 `/tmp` 依赖、无占位符）；③ §3 计数与 29 行清单原文；④ `git diff --numstat`；⑤ 生成器自报输出；⑥ `cmp`/`shasum` 双侧；⑦ `hub doctor` 三段原始输出；⑧ §2.4 条文原文。
- **验收判据（可执行）**:
  1. **每条 AC 命令可复制执行**且自带绝对路径（`git -C <WS> …` / `node …` 形态），**不引用 `/tmp`**（`grep -nE '/tmp/'` 命中数 = 0）。
  2. **无占位符**：`grep -nE '<[a-z_]+>|\{…\}|xxx' <本 PR 文件>` 命中数 = 0（证据段内）。
  3. **AC 覆盖**：10 条 AC 每条都能指到对应原样输出（缺一即不完成）。
  4. `git -C <WS> status --short` 干净（除既有未跟踪 `clarifications/`）。
- **前置依赖**: T3、T5、T7、T8、T9、T10
- **优先级**: P0

---

## 2. 依赖图

```
T0 ─┬─> T1 ──> T2 ─┬─> T3 ────────────────────────┐
    │              ├─> T5 ───────────────┐        │
    ├─> T4 ────────┴─────────────────────┤        │
    ├─> T6 ──> T7 ─┬─────────────────────┤        │
    │              └─> T10 ─┐            │        │
    ├─> T8 ─────────────────┼────────────┤        │
    └─> T9 ─────────────────┴────────────┴────────┴─> T11
```

边（逐条枚举，共 16 条；与 §1 各任务「前置依赖」行逐字对应）：

| 前置 | 后继（出边） | 条数 |
|---|---|---|
| `T0` | `T1`、`T4`、`T6`、`T8`、`T9` | 5 |
| `T1` | `T2`、`T8`、`T9` | 3 |
| `T2` | `T3`、`T5`、`T8`、`T9`、`T10` | 5 |
| `T4` | `T5`、`T9` | 2 |
| `T6` | `T7`、`T9` | 2 |
| `T7` | `T10` | 1 |
| `T3` | `T11` | 1 |
| `T5` | `T11` | 1 |
| `T7` | `T11` | 1 |
| `T8` | `T11` | 1 |
| `T9` | `T11` | 1 |
| `T10` | `T11` | 1 |

逐类理由：
- **`T0 → *`（5 条）**：判据基础（A1~A10 的原始输出）必须在任何写入前捕获。
- **`T1 → T2`**：表行与小节同集合、同顺序（冻结契约 1/3），小节排在表行所示集合之后。
- **`T2 → T3`**：锚点自检的对象是 T2 落成的 8 个标题。
- **`T1/T2/T4 → T5`**：AC5 的删除行判据覆盖全部三处写入。
- **`T6 → T7`**：`cmp` 的对象是 T6 产出的快照。
- **`T2/T7 → T10`**：反向验证的车辆是 `3.18` 节对应路由 + 隔离集群（T7 起的同一套）。
- **`T1/T2 → T8`**：doctor R1 的文档侧输入 = 表行 + 小节标题（缺任一侧即 `文档未覆盖` / `登记缺失`）。
- **`T1/T2/T4/T6 → T9`**：零面核查必须在全部写入完成后。
- **`T3/T5/T7/T8/T9/T10 → T11`**：证据段需要六类原样输出齐备；T6 的自报输出随 T7 一并落盘。

**无环**：存在拓扑序 `T0 < {T1,T4,T6,T8,T9} < T2 < {T3,T5,T10} < {T7} < T11`，满足全部边方向（T1 与 T4 同层、T6 与 T8 同层，互不依赖）。
**最长依赖链（关键路径，7 节点）**：`T0 → T1 → T2 → T10 → T11`（并列链 `T0 → T6 → T7 → T11`，同为 4 节点，短于主链）。
**关键路径任务**：**T0**（基线）→ **T1**（表行）→ **T2**（8 小节 + 锚点）→ **T10**（条文与行为一致）→ **T11**（证据收口）。

---

## 3. 执行顺序与分段增量

**顺序**：`T0 → T1 → T2 → T3`（增量 A：§3 文档面）`→ T4 → T5`（增量 B：条文 + 零改动核查）`→ T6 → T7 → T8 → T9 → T10`（增量 C：快照同源 + doctor + 零面 + 反向验证）`→ T11`（增量 D：证据落盘）。

| 增量 | 任务 | 独立可验证结果 | 该增量结束时的提交 |
|---|---|---|---|
| **A** | T1、T2、T3 | §3 计数 29 / 表行 29 / 8 小节五项语义齐备 / 双向 1:1 与锚点 8/8 | `feat(0029-pr-006-protocol-docs-and-index): API.md §3 接口清单 21→29（8 行 8 小节）` |
| **B** | T4、T5 | `### 2.4 等待语义` 四条齐备 / `git diff` 删除行 = 1 | `docs(0029-pr-006-protocol-docs-and-index): API.md 新增 §2.4 等待语义（条文唯一真源）` |
| **C** | T6、T7、T8、T9、T10 | 生成器自报 29 / `cmp` 双侧一致 / doctor 三段全 pass / 零面为空 / 超时后仍非终态 | `chore(0029-pr-006-protocol-docs-and-index): 重生成 llms.txt 快照（29 条）` + 后续证据提交 |
| **D** | T11 | PR 文件「验收证据」段逐条 AC 命令 + 原样输出；占位符自检 = 0 | `docs(0029-pr-006-protocol-docs-and-index): 回填验收证据段` |

**每个任务完成即提交**（本迭代反复出现的失败点）：T1+T2 可分两次提交，其余按增量边界提交；**不得**把证据段与实现混在一个提交里。
**若中途停下**：只允许停在**任务边界**；不得留下"§3 计数已改而小节未加"的中间态（会立刻让 `hub doctor` R1 转红）。

---

## 4. 验证配方（隔离集群 + `cmp` + 一次性脚本；**禁止新增测试文件**，A10）

### 4.1 隔离环境变量（**短 socket 路径**，绝不触碰主集群）

```bash
WS=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index
export OAMP_SOCKET=/tmp/o29p6/r.sock   # 短路径（UDS 长度上限）
export OAMP_DB=/tmp/o29p6/sql.db
export OAMP_WEB_PORT=8436              # 非默认端口，避免与既有服务相撞
mkdir -p /tmp/o29p6
```

- router：`node oamp/bin/oamp.js router start`（cwd = `$WS`）
- agent：`node oamp/bin/oamp.js agent start dev-1`（角色 `dev` 在树内；`!sleep` 分支不触发模型调用）
- web：`node oamp/bin/oamp.js web start --port 8436`
- 长驻进程一律经 `hub` 的进程面启动（`hub … op=start`，名字用本 PR 专属前缀 `pr006-*`），收尾只停自建进程。

### 4.2 等待语义反向验证（无模型调用）

```bash
B=http://127.0.0.1:8436
PRJ=$(curl -s -X POST $B/api/projects -H 'content-type: application/json' -d "{\"repo_url\":\"https://example.invalid/pr006-$(date +%s)\"}" | jq -r .project.project_id)
CHAT=$(curl -s -X POST $B/api/messages -H 'content-type: application/json' -d "{\"project_id\":\"$PRJ\",\"agent_id\":\"dev-1\",\"text\":\"@dev-1 !sleep 6\"}" | jq -r .chat_id)
TASK=$(curl -s "$B/api/chats/$CHAT" | jq -r '.messages[-1].meta.task_id')   # 或从 /api/calls 取当刻在跑项
curl -s $B/api/calls/$TASK | jq '{state,error,exit_code}'                  # 等待前
curl -s "$B/api/calls/wait?ids=$TASK&timeout_ms=2000" | jq '{timed_out,unresolved}'
curl -s $B/api/calls/$TASK | jq '{state,error,exit_code}'                  # 等待后（须与等待前逐字相同）
```

### 4.3 快照同源与 doctor

```bash
curl -s -o /tmp/o29p6/http-llms.txt -w '%{http_code} %{size_download}\n' $B/llms.txt
cmp /tmp/o29p6/http-llms.txt $WS/oamp/llms.txt && echo "cmp: 逐字节相同"
shasum -a 256 $WS/oamp/llms.txt /tmp/o29p6/http-llms.txt
OAMP_WEB_PORT=8436 node $WS/oamp/bin/hub.js doctor | jq '{pass, items: [.items[] | select(.ok == false)], counts: (.items | length)}'
```

---

## 5. 证据载体与落盘

- **原始输出**：T0/T3 的脚本与输出、T7 的 `cmp`/`shasum`、T8 的 doctor JSON、T10 的三次 `calls get` —— 全部**内联进 PR 文件**（关键响应体不得只留路径引用）。
- **最终载体**：`prs/pr-006-protocol-docs-and-index.md` 的 **「验收证据」** 段（PR 文件自身的原文即要求"本 PR 执行时填写"）。
- **不得**：新增文档 / 截图入库 / 改 `status.md` / `history.md` / 七字段 / `README.md`。

---

## 6. model_inferred 验收标准（需主 agent 确认，逐条列出）

- **[model_inferred] MI-P1（8 个新小节的编号规则）**：PR 文件 AC2 只要求"8 个新 `### 3.x` 小节齐备"、AC3 只要求"`docLink` 锚点可解析到对应小节"，**均未规定编号**；而 AC5 明令既有 21 个小节文字逐字不变（⇒ 既有 3.1~3.21 的编号不可重排）。**登记侧（pr-005 已合并，`web.js` 的 `docLink`）已经把号码钉死**：`3.11/3.12/3.13/3.18/3.110/3.111/3.22/3.23`。故本任务列表把编号规则落为"**逐字照抄登记号码**"，并以 GitHub slug 机械判据（A5）验收；**该规则的效果**是 §3 出现两处同号的既有/新增小节（如 `3.11` 既有 `GET /api/docs` 与新增 `GET /api/subscribe`，锚点因后缀不同而互不冲突）。**若主 agent 认定应以 0018/0021 的连续编号（`3.22~3.29`）为准，则须先改 `web.js` 的 8 个 `docLink`（归 pr-005 面，超出本 PR 文件范围）**——两条路径互斥，请裁决。
- **[model_inferred] MI-P2（§2.4 的条文条数口径）**：AC4 明写"明文四条"，但 F12 验收 4（可判定地放弃）需要"第二种返回可判定的区分方式"这一条款语义。本任务列表把它并入**第 ② 条的从属句**（`timed_out` 为唯一退出原因字段），**不新增第五条**，以免与 AC4 的"四条"字面冲突。
- **[model_inferred] MI-P3（表行行号与用途列措辞）**：AC1 只要求"表行 29 条"，未规定行号与用途列措辞。本任务列表取**延续编号 22~29**（0018/0021 先例：`:161-181` 为 1~21）与**运行侧 `summary` 的短形态**；两处均是体例推导，不是新事实。
- **[model_inferred] MI-P4（五项语义里 `docLink` 的载体形态）**：AC2 要求每节含 `docLink` 语义，但既有体例（A9）**没有 `docLink` 字面行**（锚点即载体）。本任务列表取折中：既保留既有体例（标题即锚点），又在每节末尾加一行 `> **文档链接**：`API.md#<slug>``，使五项语义可逐项机械核对。

---

## 7. 循环依赖与疑问/越界

### 循环依赖
**无**（见 §2 的 16 条边与拓扑序）。

### 疑问 / 越界（**不改 PR 文件的七字段**，只上报）

1. **登记侧编号与既有编号惯例不一致（本 PR 的最大不确定点）**：`web.js` 的 8 条新 `docLink` 号码为 `311/312/313/318/3110/3111/322/323`，与 0018/0021 的"连续编号"惯例（应为 `3.22~3.29`）不符；其中 `3110`/`3111` 若按两位小数读（`3.11.0` / `3.11.1`）或按三位读（`3.110` / `3.111`）都能产出同一 slug。本任务列表按"**以代码实际登记为准**"落成两位形态（冻结契约 2），并把该决策列 §6 MI-P1 等主 agent 裁决；**不擅自改 `web.js`**（越界）。
2. **`docLink` 的 `README.md` 面**：架构 R-4 明文"既有 `README.md` 的 HTTP 表与登记不符，本次不修"⇒ 本 PR 只核"未修改"，不做一致性修正（越界）。
3. **`/api/subscribe` 的 `kind='sse'`**：R2 会 `skipped:true`，因此 AC8 的"R2 覆盖新增的非流式 GET"需按 4 条（`health` / `pickup` / `calls/wait` / `principals/:principal_id`）核对，不是 5 条——这是 `doctor` 既有口径（A6），不是缺项。
4. **`epoch` 的字段语义**：新小节需说明 `epoch`（身份、订阅、取件三处），其唯一实现是 `web.js:2034-2048`（`webBootId.routerGeneration`，尽力观测）。本任务列表只**描述**它（不复制实现细节、不新增条文真源），若主 agent 认为 `epoch` 应有独立条文小节，会扩大本 PR 范围（须另行裁决）。
5. **§4 事件流面**：本 PR AC 未要求为 7 类新订阅事件新增 `### 4.x` 小节；`### 3.11 \`GET /api/subscribe\`` 只在节内列出 7 类事件名（登记 `params.kinds` 的 desc 是逐字来源）。若主 agent 认为需新增 §4 小节，属于扩范围（本任务列表不做）。
6. **未发现的架构信息缺口**：10 条 AC 均可在 PR 文件、`architecture.md`（§3.10 / §4 A-09·A-14 / §5.1 / §5.5 / §6.2 S-11 / §7 L2-11 / §9.2 N-13 / §10 R-4·R-5）与 `prd/{F11,F12,F17}` 找到可追溯依据；四条需要推导的口径（MI-P1~MI-P4）已列 §6 等确认。
