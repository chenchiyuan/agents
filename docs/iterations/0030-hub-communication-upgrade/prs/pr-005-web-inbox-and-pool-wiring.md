# pr-005 · web 面接线（收件箱必达 + 池内路由 + 退役 pickup.js）

## 上下文摘要

`oamp/src/web.js` 是仓库里的多面接线点，本迭代六处改动落在同一文件，**按代码耦合只能整文件同批提交**：① `/api/calls` 目标由 `pickInstance`（池内选择）决定 + 项级可选 `new_session` + `call.principal` 派生（`显式 requester ?? 'chat:' + chatId`）；② `composeCallEnvelope` 失败侧在既有 11 键**之后**追加 `reason`；③ `publishCallResult` 由"仅显式 `requester`"改为**无条件**写 `db.insertInbox`；④/⑤ `GET /api/pickup` 改读 `db.listInbox`（不再逐条 `router.task_get`）、ack 改 `db.deleteInbox`；⑥ `RECONCILE_TTL_DEFAULT_MS` 默认值与 `config.taskNetMs` 联动（不联动即破 F01 必达：登记被清后长任务终态在 `handleDeliver` 查不到 `entry` 被丢弃）；同时退役 `oamp/src/pickup.js`——**退役与三个消费点在同一 PR**，否则中间态不可构建。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07

## 文件范围

- oamp/src/web.js
- oamp/src/pickup.js（删除，无 re-export、无兼容层）

## 验收标准

- [ ] 退役闭合：`oamp/src/pickup.js` 已删除，全仓（含 `oamp/**` 与 `docs/**` 之外的实现面）grep `pickup.js` / `pickup.add` / `pickup.ack` 零命中；`GET /api/pickup` 与 `POST /api/pickup/:call_id/ack` 两端点仍注册且行为可达
- [ ] 必达（不声明身份）：以 `mode=background` 派发且**不传** `requester` ⇒ 终态后 `GET /api/pickup?principal=chat:<chat_id>` 能取到该调用；显式传 `requester` ⇒ 落在该显式身份上；两者同时存在 ⇒ 显式优先、同一 `call_id` 只出现一条（不双写、不合并）
- [ ] 只写终态：`submitted` / `working` 阶段在收件箱与持久层均无条目；同一 `call_id` 至多一条（重复发布 / 对账重入不新增、不覆盖）
- [ ] `reason` 落点：失败终态信封含 `reason` ∈ 五值闭集、键追加在既有 11 键之后；`state=completed` 信封**不带** `reason`；`/api/calls/<id>`、`/api/pickup` 条目内的 `envelope`、SSE `call_result` 帧三面同值同源
- [ ] 取件契约不变：条目形状仍为 `{call_id, requester, agent, chat_id, terminal_at, acked, envelope}`（键集与键序不变，`acked` 恒 `false`）；`POST …/ack` 幂等（重复确认不报错、无副作用），确认后条目不再出现在未取件集合
- [ ] 跨重启：终态后未 ack ⇒ 重启 web 进程后同一身份再取件仍能取到同一条结果，且信封与重启前一致（不再依赖 Router 任务表现算）
- [ ] 池化分流与粘性：同角色两个在线实例 + 两个不同 `chat_id` 并发派发 ⇒ 落到不同实例；同一 `chat_id` 连续两轮 ⇒ 同一实例；带 `new_session` 声明 ⇒ 按最空闲重选并重绑
- [ ] 空池与单实例：池内无在线实例 ⇒ 既有 404 `agent 不可用: <role>（无对应在线实例）`（错误码与文案逐字复用）；同角色只有一个在线实例 ⇒ 派发目标与迭代前一致、不额外排队
- [ ] 既有面不回归：`new_session` 缺省不出现时请求形状与既有响应逐字不变；`GET /api/calls` 响应键集不变；`GET /api/agents` 的实例标识与既有五字段投影不变（不新增第二套标识）
- [ ] 对账联动：`RECONCILE_TTL` 默认值 ≥ `config.taskNetMs`（约 4h30m 量级），长任务终态不因登记被清理而永不发布；`OAMP_WEB_RECONCILE_TTL_MS` 覆盖仍生效

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §3.1~§3.4、§4 A-01 / A-02 / A-03 / A-06 / A-07、§5 变更面清单
- docs/iterations/0030-hub-communication-upgrade/prd/F01-inbox-authoritative-delivery.md、F02-default-principal-fallback.md、F03-inbox-persistence.md、F04-terminal-reason-enum.md、F05-idle-timeout-and-safety-net.md（验收 6/7）、F06-role-instance-pooling.md、F07-pool-routing-stickiness.md

## depends_on

- pr-001-reason-mapping-module.md（理由：失败侧 `reason` 的唯一归类函数只在 pr-001 新建；证据：`oamp/src/web.js:539` 的 `composeCallEnvelope` 是本仓唯一信封构造点，其 5 个消费点在 `web.js:1576 / 1640 / 1682 / 1823 / 2219`，而 `reasonOf` 由 `src/reason.js` 提供 ⇒ 未合并时信封没有 `reason` 键，F04 验收 1 不成立）
- pr-002-pool-routing-module.md（理由：`/api/calls` 的目标解析要换成池内选择；证据：`oamp/src/web.js:1342` 的 `const agentId = instanceIdForRole(role)` 是该 handler 的唯一目标解析点（`web.js:44` 从 `./role-binding.js` 引入 `instanceIdForRole` / `roleFromInstanceId`），选择算法与粘性表在 `src/pool-routing.js`，且 `pickInstance` 需从接线处（`web.js:2457-2460` 的 `createApiRoutes({...})`）注入 deps）
- pr-003-inbox-table-persistence.md（理由：发布点与取件面的存储方法由 pr-003 提供；证据：`oamp/src/web.js:39` `import { openDb } from './persist.js'` 与 `web.js:2028` `db = openDb(config.dbPath)` 是 web 进程唯一的持久层句柄来源（既有用例见 `web.js:813` / `web.js:1284`），`insertInbox` / `listInbox` / `deleteInbox` 不存在时 `web.js:2215` 的发布点无写入面、F03 验收 1 不成立）
- pr-004-idle-net-turn-timers.md（理由：对账登记软 TTL 默认值须与 `config.taskNetMs` 联动；证据：`oamp/src/web.js:76` `RECONCILE_TTL_DEFAULT_MS` 经 `web.js:2164` `readPositiveMs('OAMP_WEB_RECONCILE_TTL_MS', RECONCILE_TTL_DEFAULT_MS)` 生效、在 `web.js:2288-2290` 触发清理，而 `taskNetMs` 由 `oamp/src/config.js:143-163` 的 `loadConfig()` 返回 ⇒ 未合并时读到 `undefined`）

## batch

2
