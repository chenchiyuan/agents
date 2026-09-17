# pr-002 · 池内路由叶子模块（粘性表 + 最空闲选择 + 在飞预留）

## 上下文摘要

新增叶子模块 `oamp/src/pool-routing.js`：池成员判定（`state === 'online' && connected === true && roleFromInstanceId(instance_id) === role`）、最空闲选择（次序键 `(queued, busy, inflight, instance_id)` 取字典序最小，`instance_id` 升序做确定性 tie-break）、粘性表 `Map<'<chat_id>\u0000<role>', instance_id>`（进程内、无 TTL、无淘汰定时器、选择时顺带丢弃失效绑定）、在飞预留计数（选中 +1 / settle −1）。**读数来源全部是既有只读面**（`router.status` / `router.task_list`），负载复用既有 `deriveAgentWork`；零依赖、不新增协议方法、不改 `ContextPool` 的 `(chat_id, agent_id)` 键语义。本 PR 只交付模块与其自证，deps 注入与 `/api/calls` 调用点替换在 pr-005。

## 涉及功能点

- F06
- F07

## 文件范围

- oamp/src/pool-routing.js（新建）

## 验收标准

- [ ] `oamp/src/pool-routing.js` 存在，导出面覆盖"选择 / 粘性读写 / 在飞预留增减"三类；无定时器、无文件与网络 I/O、无对其它 `src/**` 模块的 import（`roleFromInstanceId` 由调用方注入或用等价入参）
- [ ] 池成员过滤正确：给定含 `offline` 节点、`connected === false` 节点、异角色节点的快照 ⇒ 三者均不被选中（池为空时返回 `null`，由调用方回落既有 `instanceIdForRole`，模块自身不造错误面、不静默排队）
- [ ] 选择确定性：同一快照 + 同一本地预留计数 ⇒ 同输入同输出；负载并列时按 `instance_id` 升序，不随机
- [ ] 粘性：同一 `(chat_id, role)` 二次选择（池内 ≥2 实例）⇒ 命中既有绑定；传 `noReuse` ⇒ 忽略绑定、按最空闲重选**并重绑**（下一次无该声明即粘到新实例）；绑定实例已不在池 ⇒ 重选并重绑且**不抛错**
- [ ] 在飞预留：`choose` 选中即该实例计数 +1、release 即 −1；成对调用后净值为 0、无泄漏（两条并发且快照相同的选择不会落到同一实例）

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/architecture.md §4 A-06 / A-07（选择口径、粘性键与生命周期、失效口径、`inflight` 的作用）
- docs/iterations/0030-hub-communication-upgrade/prd/F06-role-instance-pooling.md（验收 1~5）、prd/F07-pool-routing-stickiness.md（验收 1~5）
- oamp/src/role-binding.js（叶子模块体例）、oamp/src/context-pool.js（既有同键串行语义，本模块不改写）

## depends_on

（无）

## batch

1
