# pr-003：三层入口表、CLI 分派与 doctor 自检（F01/F02/F03/F04/F05/F06/F07/F08/F09/F10/F11/F13/F14/G01/G02）

## 上下文摘要

`surface.js` 单点定义 40 条入口，`cli.js` 做 argv 解析→分派→渲染→退出码，`doctor.js` 做三段自检。三者同 PR 的原始理由（「拆开则成环」）经阶段 6 独立验证**证伪**：已交付依赖图上 `cli` 是唯一上层、`surface` 与 `doctor` 互不依赖 ⇒ 本 PR 属过度打包（见事后登记①②）。约束：零依赖、flag 名机械推导、路径按 `import.meta.url` 推导。

> **事后登记 ①（分组理由订正 · 依据阶段 6 独立验证）**：本 PR 原始的合包理由——「`surface.js` 与 `cli.js` 拆开则互为对方产出、依赖图成环」——**已被证伪**：该判断建立在 architecture.md 层 C `spawn` 落点的**两种读法之一**（§2.1 组件图的 `SUR --> spawn` 与 §7 F04 的「层 C 段在 `sdk/cli.js`」）**会**产生反向边这一**假设**之上；实际实现选定「`spawn` 落 `surface.js`、`cli.js` 只做 token 交付」，**已交付 DAG 无环**，三条代码级证据：① `oamp/sdk/cli.js:14` import `./surface.js`、`:15` import `./doctor.js`；② `oamp/sdk/doctor.js:132` 明写「本模块不 import surface.js」；③ `oamp/sdk/surface.js` 只 import `./http.js` / `./uds.js`（不 import `cli.js`），与 architecture.md §2.1 一致、无反向边。⇒「拆开成环」不构成本 PR 必须合包的理由。

> **事后登记 ②（粒度教训 · 已批准偏差）**：本 PR 被阶段 6 独立验证判定为**过度打包**——粒度锚点「逻辑原子性」「可审查性」两条均不通过（3 个模块 / 15 张功能卡 / 925 行）。更好的边界是 `surface` 与 `cli+doctor` 两个 PR（`doctor` 只需与引用它的 `cli` 同批），或三者各自成 PR，依赖边为 `cli → { surface, doctor }`。**未回改**（产出已合并、重排收益不抵成本），由主 agent 于阶段 6 后批准保留现状，登记为**已批准偏差**。教训：**只有当两模块互为对方的产出时才是合包理由；「不确定会不会成环」应在拆分时按已交付形状核对（此处实质只有 `cli → surface` 一条边），不能以假设充当边界依据。**

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F13
- F14
- G01
- G02

## 文件范围

- `oamp/sdk/surface.js`（新建：三层入口表单点定义，每条含 `{ id, cmd, args, run(ctx, params) }`；层 C 的 `spawn` 段）
- `oamp/sdk/cli.js`（新建：argv 解析 + 分派 + 默认 JSON / `--human` 渲染 + 进程退出码 + 层 C 子进程透传）
- `oamp/sdk/doctor.js`（新建：R1 清单双向比对 / R2 只读可达性 / R3 UDS 方法存在性）

> **事后登记 ③（协议空白 · 阶段 4 出口条件对中途新增收口 PR 的适用）**：阶段 4 的出口条件「PR 间文件范围无重叠」**未定义对迭代中途新增的收口 PR 如何适用**。本迭代的 `pr-011-closeout-wait-limit-and-assertion-strength.md` 是阶段 5 期间新增的末端收口节点，其文件范围与**已合并的 5 个 PR 故意重叠**：`oamp/sdk/http.js`（pr-001）、`oamp/sdk/surface.js`（本 PR）、`oamp/test/sdk-api.test.js`（pr-007）、`oamp/test/sdk-uds.test.js`（pr-008）、`oamp/test/sdk-cli-contract.test.js`（pr-009）。该重叠在阶段 4 的时点不可能被预见（pr-011 尚未产生），已由主 agent 裁决接受（被重叠方均已关闭、无并发合并窗口；本 PR 的文件范围不因此变更）。**建议补充的协议口径（供后续迭代）**：重叠判定的对象是「**同一时刻处于开放状态的 PR 集合**」——已合并 / 已关闭的 PR 不再参与重叠判定，其文件可被后续收口 PR 复用，只需在该收口 PR 内登记重叠清单与理由。

## 验收标准

- [ ] 入口表为**单点定义**：层 A 21 条 ↔ `API.md` §3 的 21 行、层 B 8 条 ↔ 8 个方法名、层 C 11 条 ↔ 既有 CLI 的全部叶子命令，逐条 1:1、双向无缺项无多出（F02 验收 1、F03 验收 1、F04 验收 1）
- [ ] 层前缀唯一（`api` / `uds` / `cli`），层归属 = 第一个 token；40 条无同名同形条目；`doctor` 单列为自检面、不进入 40 条分层判定（F14 验收 1/2/4，按 P-4 口径）
- [ ] flag 名由 `API.md` 字段名机械推导（`_` → `-`）、路径参数走位置参数；40 条逐条对应单一端点 / 单一方法 / 单一条既有命令，表内零跨端点编排逻辑（F14 验收 3、F02 验收 2、W3 / N5）
- [ ] 层 C 透传：`hub cli` 之后的 token **不解析、不重排、不补默认值**；实现 = `spawn(process.execPath, [<包根>/bin/oamp.js, ...args], { stdio })`，CLI 面 `inherit`、库面捕获输出，退出码透传（F04 验收 2/3、L2-1、G02 验收 1/2）
- [ ] `import.meta.url` 推导包内路径（`<包根>/bin/oamp.js`、`<包根>/API.md`），不依赖 cwd（F13 验收 2/3/4、L2-11）
- [ ] 本地校验只判"构造请求所必需"的部分：位置参数齐否 / flag 缺值 / 数值型是否整数 / JSON 型（`--tasks` / `--output-schema`）可否解析 / 入口表声明的必填 flag 齐否；命中任一 ⇒ 返回 `2` 且**未发出任何连接或请求**（F07 验收 3、§5.1 规则 4、P-3 口径）
- [ ] 给该条目不接受的选项即用法错误 `2`：`--wait` 给非阻塞条目、`--as` 给非身份方法（L2-4、L2-10）
- [ ] 服务端可判的取值非法（`limit ≤ 200`、`archived ∈ {0,1}` 一类）不本地判定，按上游 `400 INVALID_PARAM` ⇒ 退出码 `1`，`error` / `code` 原样透出（P-3 口径、F07 验收 2/3）
- [ ] 默认输出：单结果 = stdout 一个可 `JSON.parse` 的 JSON 文档 + 换行（层 A 为服务端响应体原样、层 B 为 `result` 原样）；订阅 = 每帧一行 NDJSON `{"event":"<事件名>","data":<帧 data 原样>}`（F05 验收 1、F06 验收 2、T-04 / §5.3）
- [ ] `--human`：数组 → 表头行 + 数据行（列宽 = `max(表头, 各单元格)`、两空格分隔，沿用 `src/status.js:renderTable` / `src/task.js:renderList` 手法）；对象 → `键: 值` 逐行（键 `padEnd(12)`，沿用 `src/task.js:renderTask` 手法）；订阅帧 → 一行事件名 + 键值；不做颜色 / 时间本地化 / 字段语义解释；开关只换渲染器、不改结果对象（F05 验收 2/3、T-09 / L2-7）
- [ ] 失败：stderr 单行 JSON `{"code","error","exit_code"}`（层 A 另带 `http_status`）；stdout 保持干净（F05 验收 4、§5.3 / §5.4）
- [ ] 订阅流：stdout `EPIPE`（下游截断）→ 结束进程、退出码 `0`；服务端异常断开 → `3` + 单一明确错误；不做自动重连（F06 验收 3、§5.4、G02 验收 3）
- [ ] `api calls create` 的 `--wait`：缺省 `1800000` ms；到上限 ⇒ `WAIT_TIMEOUT` / 退出码 `1`；未给上限不无限挂起（F10 验收 1/2/3/5、L2-4）
- [ ] 进程退出码 = 归类表 `exitCode`；四类各有可复现样本（成功 `0` / 上游业务失败 `1` / 用法错误 `2` / 连接失败 `3`）（F07 验收 1~5、F08 验收 2）
- [ ] `hub doctor` 可被顶层分派（第四入口），不并入三层（F11 验收 1、P-4 口径）
- [ ] doctor R1：文档侧 = `<包根>/API.md` §3 的 21 行（`<param>` 机械归一为 `:param`，只此一处归一）、运行侧 = 既有 `GET /api/docs` 的 `routes[]`，**双向**比对并逐行给出 `pass`/`fail` + 期望值 / 实际值（F11 验收 1/2/5、§5.5）
- [ ] doctor R2：对 9 个非流式 GET 端点各发一次空参 GET，判定"响应不是路由兜底"（`404` + `error: "not found: <方法> <路径>"`）；R3：对 8 个方法各发一次"参数非法 / 未注册 / 只读"探针，判定"响应不是 `-32601`"（通知型方法 1000ms 静默计存在）（F11 验收 1、§5.5）
- [ ] doctor 端点分类全覆盖：21 条每条都有 `pass` / `fail` / `skip（附理由）`，8 条 POST 与 4 条 SSE 一律不探并说明理由；探针全落在"参数校验先于副作用"或只读方法上，**零状态改变**（F11 验收 3 / MI-02、§5.5）
- [ ] doctor 的文档侧基准路径**可被注入**：`check({ apiDocPath })` 一类的显式入参（默认值按 `import.meta.url` 推导为 `<包根>/API.md`），供 pr-010 用临时副本制造漂移——**这是本 PR 与 pr-010 之间的跨 PR 接口契约**（§10 T5、F11 验收 2）
- [ ] hub 不可达时 doctor 的 R1/R2 降级为统一错误（退出码 `3`），不半跑（F08 验收 1/2、§5.5）
- [ ] 无状态：层 A 每命令一连接、层 C 每命令一子进程、层 B 会话随命令开始与结束；无模块级可变状态、零本地写（F09 验收 1/2/3）
- [ ] 零新增依赖；本 PR 的 diff 不含 `oamp/src/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/web/**`，不新增任何路由（G01 验收 1/2/4/5）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F01-sdk-package-and-dual-consumption.md`、`F02`、`F03`、`F04`、`F05`、`F06`、`F07`、`F08`、`F09`、`F10`、`F11`、`F13`、`F14`、`G01`、`G02`（同目录 `prd/` 下的同名卡）
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §2.1（组件图 `SUR --> HTTP` / `SUR --> UDS` / `SUR --> OCLI` / `CLI --> SUR` / `ERR -.-> CLI`）、§3.3（P-1~P-4 口径）、§4.1 N-3 / N-6 / N-7、§4.4 顺序约束、§5.1 三层全表、§5.2、§5.3、§5.4、§5.5、§5.6、§7 逐卡行、§8 C7、§10 T1~T6
- 代码锚点：`oamp/src/cli.js:30`（`usageError` 返回 `2`，既有退出码语义）、`oamp/src/cli.js:59`（`main(argv)` 顶层分派分支：`router`/`agent`/`status`/`web`/`cluster`/`task`）、`oamp/bin/oamp.js`（`default` 导出 + 数字返回码约定）、`oamp/src/status.js:40`（`renderTable`）、`oamp/src/task.js`（`renderTask` / `renderList`）、`oamp/src/router.js:109-113`（`agent.register` 校验先于副作用）、`oamp/src/web.js:1384`（`projectRoutes`）、`oamp/test/api-routes.test.js:277/303`（两把漂移锁）

## depends_on

- pr-001-sdk-error-contract-and-web-channel.md（理由：层 A 21 条的 `run()` 调用 pr-001 新建的 `oamp/sdk/http.js` 的请求与 SSE 读取函数，`cli.js` 的错误对象序列化与退出码归类使用 `oamp/sdk/errors.js` 的 `HubError` —— 证据：`architecture.md` §2.1 组件图的 `SUR --> HTTP`、`ERR -.-> CLI` 两条边，以及 §7 的 F05/F07 行把 `sdk/cli.js` 与 `sdk/errors.js` 列在同组）
- pr-002-sdk-router-uds-channel.md（理由：层 B 8 条的 `run()` 与 doctor 的 R3 段调用 pr-002 新建的 `oamp/sdk/uds.js` 的会话方法 —— 证据：`architecture.md` §2.1 组件图的 `SUR --> UDS` 边与 §4.4 顺序约束 4「`doctor` 依赖层 A 与层 B（R1/R2 走 HTTP、R3 走 UDS）」）

## batch

2
