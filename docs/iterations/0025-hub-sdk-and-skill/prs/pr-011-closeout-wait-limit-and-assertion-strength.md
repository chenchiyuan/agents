# pr-011：收口修复 —— block 等待上限可达性与三处断言判别力（F02/F04/F06/F07/F09/F10）

## 上下文摘要

收口 PR（迭代末端节点）。① 功能缺陷：`--wait` 的声明上限（含缺省 `1800000`）对 `--mode block` **不可达** —— `oamp/sdk/http.js` 的 5000ms 响应头上限先行终止在途请求，`--wait > 5000` 实测 ~5048ms 返回 `3/REQUEST_TIMEOUT`，而非规格要求的 `1/WAIT_TIMEOUT`（F10 验收 1/2/3/5）。② 三处交付物自身的零判别力 / 观测盲区断言（SSE 集合、仓库运行态快照、`length > 0`）—— 均为独立 verifier 在「下一迭代候选」里指向本 PR 的缺陷，不是增强。约束：零新依赖、40 条入口表字段集不变、既有测试面零回归。

## 涉及功能点

- F10（主锚：`--wait` 显式上限与可区分的超时错误）
- F07（退出码归类：`WAIT_TIMEOUT`/`1` 与 `REQUEST_TIMEOUT`/`3` 的分野）
- F02（层 A 端点集合：4 条 SSE 的集合核对）
- F06（订阅面：SSE 集合锁）
- F09（零本地状态：仓库运行态判据）
- F04（层 C 零语义变更：`task list` 逐字节面的前置强度）
- E1（`demand.md` §4 的 ② 类操作 —— 回放 0021 的「派发 → 取终态」闭环；本 PR 使其在 >5s 段可达）

## 文件范围

- `oamp/sdk/http.js`（**修改**：`open()` 的响应头上限由模块常量改为可按 `spec` 注入，缺省仍 5000ms；`request(spec)` 透传可选 `headerTimeoutMs`。**该上限的读取点有两个** —— 定时器（`:92-95`）与错误文案构造（`:36` 的 `等待响应超时（${RESPONSE_TIMEOUT_MS}ms；…）`），两处都必须用「本次生效值」，否则文案会与实际上限不符。模块头「三条上限语义不同、不混淆」的声明保持成立 —— 新增的是一条**显式参数**，不是把两个上限合并成一个）
- `oamp/sdk/surface.js`（**修改**：`runApi` 在 `waitMs !== null` 时派生 `headerTimeoutMs` 注入 `requestSpec` —— 声明了 `wait` 的条目（`api calls create`）其响应头上限由该上限支配，且响应头上限**不得先于** `--wait` 上限触发（`oamp/sdk/http.js:141-151` 按 `waited` 归类 ⇒ 派生预算须保证 `--wait` 上限必先到）；`ENTRIES` 40 条的字段集与条目数不变、不新增条目属性）
- `oamp/test/sdk-cli-contract.test.js`（**修改**：① 把 `T4 [已知偏差 · 归 pr-011 收口修复]` 翻转为规格期望 `WAIT_TIMEOUT`/`1`、`error` 含 `8000`、耗时窗移到 `--wait` 上限附近，并删掉用例内「本 PR 不改 `oamp/sdk/**`」的注释与偏差锁用例名；② `T7` 两个只读组的非空前置由 `stdout.length > 0` 改为 `stdout.trim().length > 0`）
- `oamp/test/sdk-api.test.js`（**修改**：T4 补 `kind === 'sse'` 的 4↔4 双向核对，与 T2 / T3 的 `routeSet` 用法同形）
- `oamp/test/sdk-uds.test.js`（**修改**：`.runtime` / `data` 前后一致判据的基线快照由用例体内移到模块作用域（任何 `runHub` 调用之前）采集）

> 逐文件说明：五个文件**全部是修改既有文件**，无新建。前两个（`http.js` / `surface.js`）是一处修复的两个半边，必须同批落地（只改一个 ⇒ 要么上限仍先行、要么参数无人派生）。后三个各含一类独立修复，彼此无引用边。`sdk-cli-contract.test.js` 被两类修复共同触及（偏差锁翻转 + 只读组前置），须由同一执行者串行处理（同文件两处编辑，不存在跨任务合并）。

## 验收标准

- [ ] **A-主判据（block 上限可达）**：对「永不写响应头」的黑障服务端，`hub api calls create --chat-id c --agent a --task t --mode block --wait 8000 --port <p>` ⇒ stderr 恰一行 JSON 且 `code === 'WAIT_TIMEOUT'`、`exit_code === 1`、`error` 含 `8000`；stdout 为空；耗时落在 `(7600, 9000)`ms（**不得**再落在 ~5000ms）；黑障桩 `requests === 1`（本地中止、不重发、不换端口）(F10 验收 3/5、§5.4 `1` 类 ②、P-1)
- [ ] **A-上限内成功（>5000ms 段）**：服务端 **6000ms 后**正常响应、给 `--wait 8000` ⇒ 退出码 `0` + 响应体原样（`{"calls":[…]}` 信封不加壳、不改字段名）；耗时落在 `(6000, 7000)`ms (F10 验收 2 —— 该形态当前实测 `5042ms → 3/REQUEST_TIMEOUT`)
- [ ] **A-缺省上限可达（有界观测，不实测 30 分钟）**：服务端 6000ms 后响应、**不给** `--wait` ⇒ 退出码 `0` + 响应体原样；耗时 ~6000ms 量级（当前实测 `5041ms → 3/REQUEST_TIMEOUT`）。缺省 `1800000` ms 的「可达」由「6000ms > 5000ms 仍走等待上限」+ `oamp/sdk/cli.js:18` 的 `DEFAULT_WAIT_MS` 常量面共同闭合 (F10 验收 1)
- [ ] **A-小于 5000ms 的原有路径不回归**：`--wait 1000` / `600` / `1500` 对黑障桩仍 ⇒ `WAIT_TIMEOUT`/`1`，`error` 含对应上限值，耗时随上限单调（`600` 先于 `1500` 返回），每次恰 1 次请求
- [ ] **A-非 `--wait` 条目上限不变**：不带 `wait` 声明的层 A 条目（如 `hub api docs`）对同一黑障桩仍 ⇒ `REQUEST_TIMEOUT` / 退出码 `3`、耗时 ~5000ms、`error` 含 `5000` —— 5000ms 缺省未被放大 (F07 验收 1~5)
- [ ] **A-上游业务错误优先于本地超时**：`--wait` 上限内收到 404 / 400 ⇒ 仍 `NOT_FOUND` / `INVALID_PARAM` + 退出码 `1` + `http_status` 为上游真实状态码、stdout 无残片（放宽响应头上限不改变「上游错误即时归类」的次序）
- [ ] **A-单点派生、两宿主同享**：`waitMs → headerTimeoutMs` 的派生只落在 `oamp/sdk/surface.js` 的 `runApi` 一处（全仓 `headerTimeoutMs` 的**赋值点**恰 1，`oamp/sdk/http.js` 只负责「取缺省值」）⇒ 库面 `createHub().api.calls.create({ …, mode: 'block', waitMs: 8000 })` 与 CLI 面对同一黑障桩得到同一 `code` / `exitCode`。SDK 不因此新增第二条上限判定，也**不按 `mode` 取值做语义分支**（判据是「本条目的上限由 `--wait` 支配」这一条目级事实，不是「`mode === 'block'`」这一参数值事实）(F02 验收 2 的三宿主等价物、W3 / N5 / F11 验收 5)
- [ ] **A-偏差锁已翻转**：`oamp/test/sdk-cli-contract.test.js` 中该用例名不再含 `[已知偏差 · 归 pr-011 收口修复]`（或改为断言规格期望且名内不再标注偏差），断言集合 = `WAIT_TIMEOUT` + `exit_code 1` + `error` 含 `8000`；用例内不再出现「本 PR 不改 `oamp/sdk/**`」一类已失效的注释 (F10 验收 3/5 的收口)
- [ ] **B1-SSE 集合有牙齿**：`oamp/test/sdk-api.test.js` 的 T4 增一条与 T2 / T3 同形的集合核对（按 `kind === 'sse'` 过滤运行侧 `api docs` 的 `routes[]`）⇒ 运行侧 SSE 集合与 T4 四条 fixture **4↔4**：缺项为空、多出项为空、条数相等、签名两两不同。**判别实验**：在副本内于运行侧多注册一条 SSE 路由 ⇒ 该断言必红（当前该文件对 SSE 零集合断言，第 5 条 SSE 不会红）
- [ ] **B2-运行态判据无观测盲区**：`oamp/test/sdk-uds.test.js` 的 `.runtime` / `data` 基线在任何 `runHub` 调用之前采集（模块作用域），⇒ 对「本文件内**更早的某次 hub 调用**向 `<包根>/.runtime` 写入」的形态必然转红。**判别实验**：副本内给 `oamp/bin/hub.js` 注入一次 `<包根>/.runtime/state.json` 写入 ⇒ 该文件**全文件跑**必红。当前实现下同一注入**全文件跑为绿（逃逸）、隔离跑（`--test-name-pattern`）才红** ⇒ 修复后「全文件跑为绿」不可再出现
- [ ] **B3-载荷丢失可捕获**：`oamp/test/sdk-cli-contract.test.js` 的 T7 只读组非空前置改为 `trim()` 后判非空 ⇒ `"\n"` 不再满足该前置。**判别实验**：副本内把 `oamp/src/task.js` 的 `renderList` 空态 `'（无任务）'` 改为 `''`（stdout 变 `"\n"`，两侧仍逐字节相等）⇒ 该用例必红（当前 `stdout.length > 0` 下为绿）
- [ ] **C-零回归**：`node --test test/*.test.js` 全量通过（迭代分支 tip `5dc04c4` 的基线 = 473/473 pass / 0 fail）；`oamp/test/api-routes.test.js` 两把漂移锁、`oamp/test/hygiene.test.js`、`oamp/test/cli.test.js`、`oamp/test/sdk-surface.test.js`（`ENTRY_FIELDS` 字段契约）、`oamp/test/helpers/hub-harness.js` 零改动零回归
- [ ] **C-零新增依赖 / 零越界**：`oamp/package.json` 的 `dependencies` 仍为 `{}`；本 PR 的 diff 不含 `oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`、`oamp/skill/hub.md`，不新增任何路由；`ENTRIES` 仍是 40 条且条目字段集不变

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F10-wait-timeout-limit.md`（验收 1/2/3/5 与「架构落定」段的超时归类）
- `docs/iterations/0025-hub-sdk-and-skill/prd/`：`F02-web-api-surface-coverage.md`、`F04-oamp-cli-command-coverage.md`、`F06-subscription-ndjson-stream.md`、`F07-exit-code-semantics.md`、`F09-stateless-cli.md`
- `docs/iterations/0025-hub-sdk-and-skill/demand.md` §1 **W4** / **C-2** / **B-3**、§4 **E1**（0021 事故现场：300.8s 硬上限）
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §3.3 **P-1**、§5.1 层 A 全表、§5.3、§5.4（四类归类表 + 「三条上限语义不同、不混淆」要点 + 「可阻塞条目恒有上限（默认 `1800000`）／非可阻塞条目走 5000ms」）、§7 F10 行、§8 C8、§9.1、§10 T2 / T3 / T4
- 独立验证报告（本 PR 的缺陷与判别力证据来源）：
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-003-20260915-165755.md` —— 偏差 #1 / §5.4 partial：`--wait ≥ 5000ms` 与缺省值对 block 不可达；自建记录型服务端四行对照 + 真实 hub 实测 `5048ms → 3/REQUEST_TIMEOUT`；归因落在冻结模块 `oamp/sdk/http.js`
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-007-20260915-181638.md` —— 偏差 **D2**：`routeSet` 只在 T2（`GET && kind==='json'`）与 T3（`POST`）做集合比对，无 `kind==='sse'` 的 4↔4 核对
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-008-20260915-181702.md` —— 偏差 **DEV-01**（唯一确证的实质偏差）+ 变异 M12 对照：同一注入「全文件跑 19 pass / 0 fail ⇒ 逃逸」vs「`--test-name-pattern` 隔离跑 ⇒ 检出」
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-009-r2-20260915-183218.md` —— 偏差 **N-01**：`stdout.length > 0` 被 `"\n"` 满足；注入 J4（`src/task.js` 空态 → `''`）⇒ T7 全绿，实测 `stdoutBytes 1 / stdoutJSON "\n"`。同报告 **N-06**：偏差锁耗时窗 `(4900, 5400)` 上界余量仅 ~356ms
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-009-20260915-181653.md` —— 基准 #2：偏差锁的断言集合与翻转点登记原文
  - `docs/iterations/0025-hub-sdk-and-skill/clarifications/verify-pr-004-20260915-175157.md` —— 「继承 pr-003 的收口项：`--mode block` 的 `--wait` 上限语义（pr-011 收口修复 PR）」
- 代码锚点（修复点与待改断言，均已在迭代分支 tip `5dc04c4` 上读到）：
  - `oamp/sdk/http.js:15`（`RESPONSE_TIMEOUT_MS = 5000`，「非阻塞条目的响应上限」）、`:65-107`（`open()` 与两道定时器，`:92-95` 为响应头定时器）、`:120-155`（`request(spec)`，`:128` 把 `spec` 交给 `open`、`:141-151` 的 `throw waited ? waitTimeout(waitMs) : err` —— 顺序保证的落点）、`:176-179`（`stream(spec)` 同经 `open`，其 `waitMs` 恒为 `null`）
  - `oamp/sdk/surface.js:39-77`（`runApi` 与 `requestSpec`，`:75` 的 `waitMs: params.waitMs ?? null`）、`:153-170`（`calls create` 条目，`:168` 的 `int('wait')` 是唯一接受该选项的条目）、`:349-354`（库面 `params` 的 `waitMs` 取值）
  - `oamp/sdk/cli.js:18`（`DEFAULT_WAIT_MS = 1800000`）、`:253-256`（`waitMs` 的授予条件与缺省）
  - `oamp/test/sdk-cli-contract.test.js:790-809`（偏差锁：`:804` `REQUEST_TIMEOUT` / `:805` exit 3 / `:806` error 含 `5000` / `:807` 耗时窗 `(4900, 5400)`）、`:1072` 与 `:1077`（两个只读组的 `stdout.length > 0`）
  - `oamp/test/sdk-api.test.js:351-358`（`routeSet(hub, selector)` 现算运行侧清单）、`:551`（T2 的 `kind === 'json'` 双向核对）、`:669-676`（T3 的 `POST` 双向核对）、`:715-800`（T4 四条 SSE 用例，无集合断言）
  - `oamp/test/sdk-uds.test.js:268-271`（`entriesOf` 快照原语）、`:883-902`（前后一致判据 —— `before` 在**用例体内**采集）
  - `oamp/test/sdk-surface.test.js:473`（`ENTRY_FIELDS` 十项）+ `:480`（逐条字段集比对 —— 本 PR 不得增删条目字段）
  - `oamp/API.md:645`（`mode` 缺省 `background`）、`:694`、`:1404`（`mode: "block"` 响应挂起至终态、不设人为上限）

## depends_on

- pr-001-sdk-error-contract-and-web-channel.md（理由：本 PR 的修复点 A 直接改 pr-001 新建的 `oamp/sdk/http.js` —— 待改的符号就是该文件里的 `RESPONSE_TIMEOUT_MS` / `open()` / `request(spec)`。证据：`oamp/sdk/http.js:15` 的 `const RESPONSE_TIMEOUT_MS = 5000` 与 `:92-95` 的 `responseTimer` 由 pr-001（合并提交 `f9327ad`）引入；`verify-pr-003` 偏差 #1 的归因段逐字指向该模块）
- pr-003-sdk-entry-surface-cli-and-doctor.md（理由：派生点落在 pr-003 新建的 `oamp/sdk/surface.js` 的 `runApi` / `requestSpec`，且 `waitMs` 的授予方 `oamp/sdk/cli.js` 同属该 PR。证据：`oamp/sdk/surface.js:60-77` 的 `requestSpec` 六键（含 `:75` `waitMs: params.waitMs ?? null`）与 `:168` 的 `int('wait')` 由 pr-003（合并提交 `453326c`）引入；`oamp/sdk/cli.js:18` 与 `:253-256` 为其配套）
- pr-006-sdk-surface-coverage-test.md（理由：本 PR 修改 `oamp/sdk/surface.js`，而 pr-006 的用例对同文件的 `ENTRIES` 做**条目字段集**比对 —— 验收「C-零回归」中的该条只能靠 pr-006 的产物判定。证据：`oamp/test/sdk-surface.test.js:473` 的 `ENTRY_FIELDS` 十项与 `:480` 的逐条 `Object.keys(e).sort()` 比对读取的正是 `oamp/sdk/surface.js` 导出的 `ENTRIES`）
- pr-007-sdk-api-behavior-test.md（理由：修复 B1 改的就是 pr-007 新建的 `oamp/test/sdk-api.test.js`，且复用的 `routeSet` 现算原语与该函数的两处既有调用点（T2/T3）都在该文件内。证据：`oamp/test/sdk-api.test.js:351-358`（`routeSet` 定义）、`:551`、`:669-676` 由 pr-007（合并提交 `f4b6aa7`）引入；`verify-pr-007` 偏差 D2 逐字记录「无 `kind==='sse'` 的 4↔4 核对」）
- pr-008-sdk-uds-behavior-test.md（理由：修复 B2 改的就是 pr-008 新建的 `oamp/test/sdk-uds.test.js` 的前后一致判据。证据：`oamp/test/sdk-uds.test.js:883-902` 的 `before` / `after` 快照与 `:268-271` 的 `entriesOf` 由 pr-008（合并提交 `46969a0`）引入；`verify-pr-008` 偏差 DEV-01 与变异 M12 的「隔离跑检出 / 全文件跑逃逸」对照是该缺陷的判别实验）
- pr-009-sdk-cli-contract-test.md（理由：修复 B3 与偏差锁翻转都改 pr-009 新建的 `oamp/test/sdk-cli-contract.test.js`。证据：`oamp/test/sdk-cli-contract.test.js:790-809` 的 `T4 [已知偏差 · 归 pr-011 收口修复]` 由 pr-009 第 2 轮返工引入（合并提交 `5dc04c4`，即迭代分支 tip），`:1072` / `:1077` 的 `stdout.length > 0` 与 `:796` 登记的翻转点同在该文件；`verify-pr-009-r2` 偏差 N-01 给出注入 J4 的逃逸实测）

> 说明：以上六条均为**代码级**引用边（文件与符号），非文档叙述顺序。迭代分支 tip `5dc04c4` 上 10/10 个 PR 已全部合并 ⇒ 本 PR 的依赖图在调度上已全部满足，pr-011 是末端节点、无后继。

## batch

5
