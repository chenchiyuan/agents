# pr-002：客户端会话登记模块（身份表 / 未取件指针表）

## 上下文摘要

按 `src/inbox.js` 的**进程内表体例**新建两个模块：`src/principals.js`（`Map<principal_id, {principal_id, kind, instance_id, created_at, last_seen_at}>` + `upsert / get / touch / resolve`，含 **单一接缝函数** `requesterOf(source)`）与 `src/pickup.js`（`Map<call_id, {call_id, requester, agent, chat_id, terminal_at, acked}>` + `add / listByRequester / ack`）。无 TTL、无定时器、无事件面、不落库、重启即丢；`kind` 不校验取值域，`instance_id` 只承载"所归属实例"的自述声明（不判定、不据此拒绝）。

本 PR 只交付模块与其语义（含幂等与形态校验），**HTTP 面接线由 pr-005 承担**：模块导出面是本 PR 的验收面，也是 pr-005 的消费面。

## 涉及功能点

- F01
- F07

## 文件范围

- `oamp/src/principals.js`（新建：身份表 + `requesterOf` 接缝）
- `oamp/src/pickup.js`（新建：未取件指针表）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-002-session-registries.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（接线面归 pr-005）、`oamp/src/inbox.js`（体例来源，零改动）、`oamp/src/persist.js`（不落库）。

## 验收标准

- [ ] 两文件存在且可独立 import（`node --input-type=module -e "import('./oamp/src/principals.js')"`）；导出面 = 上述函数集合，**无多余入口**（不提供 `history / export / clear / decided` 类接口，与 `src/inbox.js` 的"导出面恰好 5 个"同款收敛）
- [ ] 两模块的 `import` 行**只含 `node:*`**（不 import 任何仓内模块，不产生新耦合）——`grep -n '^import' oamp/src/principals.js oamp/src/pickup.js`
- [ ] `upsert({principal_id:'p1', kind:'cli'})` 连续两次 ⇒ 两次都成功（不返回冲突）、`created_at` 两次相同、`last_seen_at` 不倒退；`get('p1')` 返回同形（F01 验收 1）
- [ ] 形态校验复用既有规则（非空 / ≤64 / 可打印 ASCII，与 `src/registry.js:7` 的 `isValidInstanceId` 同源，不另写一份正则）；非法形态 ⇒ **不建条目**且返回可判定的失败（不静默建）
- [ ] 无租约：模块内无 `setTimeout / setInterval`（`grep -c` 为 0）；`touch('p1')` 前移 `last_seen_at`、不改 `created_at`；无"未续期即失效/清除"的路径（F01 验收 2/3）
- [ ] `requesterOf(source)` 只读**显式声明**：缺字段或空 ⇒ `null`；不做任何推断（不从进程、环境、连接、路径推导身份）；`instance_id` 缺失 ⇒ 该字段为 `null` 而不报错（F01 验收 5 / D-2）
- [ ] `pickup.add({call_id, requester, agent, chat_id, terminal_at})` 幂等：同一 `call_id` 重复 add 不产生第二条、不覆盖首条（F07 验收 1）
- [ ] `listByRequester('p1')` 只返回该身份 `acked=false` 的条目（另一身份 `p2` 的条目不在列表中）——取件归属的对照实验（F02 验收 1 的模块侧判据）
- [ ] `ack(call_id)` 幂等删除语义：条目移出未取件集合；重复 ack / 不存在的 id ⇒ 返回成功且**无副作用**（不抛、不建条目）（F07 验收 3 / MI-5）
- [ ] 只存指针不存正文：条目字段集合恰为上述 6 个键，无正文/信封副本（F07 验收 5）
- [ ] 与既有 `src/inbox.js` 同寿命口径：文件头注释明写"进程内、不持久、重启即丢"，且无落库/无文件写入（F01 边界 / F07 验收 6）
- [ ] 零新增依赖；本 PR 的 diff 不含 `oamp/src/web.js` 与任何既有文件

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F01-client-identity-service.md`（验收 1~6、边界、MI-10）、`F07-terminal-result-pickup.md`（验收 1~6、边界、MI-5）、`F02-call-requester-identity.md`（验收 1/4、MI-3）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §3.1（身份注册/查询/续声明流）、§3.7（取件流）、§4 A-01 / A-02 / A-06、§5.4（新增进程内模块表）、§8（剃刀检验：两者的"不引入则不可实现"论证）
- 体例来源与代码锚点：`oamp/src/inbox.js`（进程内 Map + 小而固定导出面 + "进程内、不持久、重启即丢"注释口径）、`oamp/src/registry.js:7-10`（`isValidInstanceId` 形态规则，唯一来源）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：两模块的一次性验证脚本 + 输出（幂等 / `created_at` 不变 / `last_seen_at` 前移 / 非法形态拒绝 / `ack` 幂等 / 导出面与 import 行计数）+ `grep` 计数原始输出。载体约定见 `architecture.md` §5.4。）
