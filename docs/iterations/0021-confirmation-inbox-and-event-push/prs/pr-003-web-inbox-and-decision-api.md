# pr-003：web 进程承载确认面（inbox 在途表 / 确认面接口 / 信封消费 / 全局广播 / 派生面同步）

## 上下文摘要

web 进程承载确认面：新建进程内 inbox 在途表（`Map`，不落库、无 TTL、`take()` 即删 ⇒ 无历史台账由结构保证），路由表**末位**追加 `GET /api/confirmations` 与 `POST /api/confirmations/<id>/decision`，`handleDeliver` 消费 3 个新 `notice` kind（登记 + 推全局 `confirmation` 帧 / 失效移除 / 回传裁决），`publishState` 追加一次全局广播（既有 `chat:<id>` 发布逐字不变）。同步派生面（`API.md`、`llms.txt`）。**含既有测试断言改写**（登记集合 / 路由条数 / `19 条` 标题 / 全局链路键隔离断言）。**不承载 M4 答复链路修复**（M4 落 pr-001）。另须在 `STATIC_FILES` 白名单登记 `/notify.js`（否则 pr-004 的第三栏脚本 404）。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05
- F06
- F07
- F08
- F10
- F11
- F12

## 文件范围

- `oamp/src/inbox.js`（**新建**：登记 / 查询 / 原子取出 / 移除 / 计数；进程内 `Map`，不落库）
- `oamp/src/web.js`（修改：路由表末位追加 2 条表项〔检索式 `createApiRoutes`、`docLink`〕；`handleDeliver` 的 `notice` 分支与 `sendControlNotice` 的发送侧〔检索式 `handleDeliver`、`sendControlNotice`、`context_released`〕；`publishState` 的全局广播〔检索式 `publishState`、`transport.publish(`〕；`STATIC_FILES` 白名单追加 `/notify.js`〔检索式 `STATIC_FILES`、`'/app.js'`〕）
- `oamp/API.md`（修改：§3 追加新接口小节〔检索式 `### 3.19`、`` `GET /api/calls/<call_id>` ``〕+ §3 标题条数〔检索式 `## 3. 接口清单`〕+ §4.2 全局订阅的事件集合与「键隔离」表述〔检索式 `### 4.2 全局订阅`、`键隔离`〕）
- `oamp/llms.txt`（重新生成：`node oamp/scripts/gen-llms-txt.mjs`，不手改）
- `oamp/test/confirmation-inbox.test.js`（**新建**：inbox 在途项行为、两条新路由的入参/错误契约、帧与通知的「恰一次」）
- `oamp/test/api-routes.test.js`（修改：登记集合 `deepEqual` 断言、`## 接口（19 条）` 与 `## 3. 接口清单（19 条）` 标题断言、`/api/docs` 投影断言）
- `oamp/test/project-workspace.test.js`（修改：同型登记集合断言 + `routes.length` 条数断言 + 同两处标题断言 + `/api/docs` 投影断言）
- `oamp/test/call-protocol.test.js`（修改：`/api/docs` 的 `routes.length` 条数断言）
- `oamp/test/web.test.js`（修改：「全局订阅不得收到对话类事件」的键隔离否定断言按新口径同步）

## 验收标准

- [ ] `GET /api/confirmations` 返回对象 `{ confirmations: [...] }`；空态为 `[]`、不 404、不查 Router、不读库；元素含 `confirmation_id` / `chat_id` / `agent_id` / `tool` / `title` / `options` / `created_at`。
- [ ] 一条 `notice{kind:'confirmation_request', …}` 投递到 web 后：① 出现在 `GET /api/confirmations`；② **全局**订阅（`GET /api/events`）收到**恰一帧** `confirmation`，其 `data` 与列表元素同形状；③ 重复投递同一 `confirmation_id` 不再入表、不再发帧（`add` 幂等）。
- [ ] 重建面 `GET /api/confirmations` **不发任何帧**（刷新 / 重连重建不重复通知）。
- [ ] `POST /api/confirmations/<id>/decision` 携带合法 `option_id` → `200 {confirmation_id, accepted:true}`；该条**立即**移出在途表（第二次提交同一 id 得 404）；同时向该条的发出方发出 `notice`，body 含 `kind:'confirmation_decision'`、**同值** `confirmation_id`、用户所选 `option_id`。
- [ ] 错误契约：`option_id` 缺失 / 非字符串 / **不在该条 `options` 内** → `400 INVALID_PARAM` 且条目**保留在途**；`confirmation_id` 不在表内（已裁决 / 已失效 / 从未存在）→ `404 NOT_FOUND`（同一码，不区分）。
- [ ] 裁决提交时文本非空白 ⇒ 向该 `chat_id` 追加一条输入并派发（复用既有落库 + 派发路径）；空白 / 纯空白文本**不**追加。
- [ ] `notice{kind:'confirmation_cancelled'}` 使该条移出在途表，且不产生任何通知类广播。
- [ ] **无历史台账（结构保证）**：已裁决项无任何读取入口（列表 / 查询参数 / 导出均不返回）；`oamp/src/persist.js` 零改动。
- [ ] 三条漂移锁**转绿且未削弱断言**：`llms.txt` 由生成脚本重生成后与仓库文件逐字节相等；`API.md` 与新登记集合双向覆盖（既有 19 条条目逐字不改）；`oamp/test/api-routes.test.js`、`oamp/test/project-workspace.test.js`、`oamp/test/call-protocol.test.js` 中所有硬编码的 19 条路由清单 / 条数 / 标题断言同步为新集合。
- [ ] `publishState` 的既有 `chat:<id>` 发布行为逐字不变（按对话订阅的 `chat_state` 帧形态不变），其新增的全局广播使对话终态在**全局链路**上可观测；全局链路的事件集合与 `API.md §4.2` 的登记、`oamp/test/web.test.js` 的键隔离断言三者一致（`message` / `task_update` / `notice` 仍只走 `chat:<id>`）。
- [ ] `STATIC_FILES` 含 `/notify.js` → `web/notify.js`；该文件不存在时 `GET /notify.js` 返回 404（`serveStatic` 的 ENOENT → 404 行为不变，无目录枚举 / 无通配）。
- [ ] `node --test oamp/test/confirmation-inbox.test.js oamp/test/api-routes.test.js oamp/test/project-workspace.test.js oamp/test/call-protocol.test.js oamp/test/web.test.js` 全绿；`oamp/test/hygiene.test.js` 保持绿（`src/inbox.js` 不含凭据类字段名、`package.json` dependencies 仍为空）。

## 参考资料

- docs/iterations/0021-confirmation-inbox-and-event-push/architecture.md（§1.5 派生面联动 D1~D3、§3.1 L1-3、§3.2 L2-1~L2-10、§4.2 M-4 / M-5 / M-6 / M-9 / M-10 / M-14 / M-15、§4.3 Z-3 / Z-5 / Z-9 / Z-10 / Z-11、§5.1 / §5.2 / §5.3、§6、§7 T-07 / T-08 / T-13、§11.1 B-3 ~ B-5、§11.2 B-6 ~ B-8）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F01-confirmation-inbox-column.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F03-inbox-decision-interaction.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F06-in-flight-visibility.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F07-notification-event-types.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F10-service-boundary-unchanged.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F11-no-history-ledger.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F12-upstream-protocol-unchanged.md
- docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/arch-round-1-verdicts.md（L1-3 裁决 + 覆盖范围裁决）

## depends_on

（无）

## batch

1
