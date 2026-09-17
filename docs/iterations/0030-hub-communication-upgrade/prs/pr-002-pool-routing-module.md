# pr-002 · 池内路由叶子模块（粘性表 + 最空闲选择 + 在飞预留）

## 上下文摘要

新增叶子模块 `oamp/src/pool-routing.js`：**多实例感知的角色解析** —— 具名导出 `roleOfPoolInstance(instanceId, baseResolve)`（`pb-<role>` **或** `pb-<role>-<n>`（`n` 正整数）均计入该 role 的池：先走传入的精确公式，未命中再剥尾段 `-<n>` 复用**同一**公式；`baseResolve` 是**参数** ⇒ 不 import `role-binding.js`，既有两公式零改动）、池成员判定（`state === 'online' && connected === true && roleOfPoolInstance(instance_id) === role`；该解析与 `GET /api/agents` 的 `role` 列**同源消费**同一函数，避免"能进池但 role 列显示 `null`"的自相矛盾）、最空闲选择（次序键 `(queued, busy, inflight, instance_id)` 取字典序最小，`instance_id` 升序做确定性 tie-break）、粘性表 `Map<'<chat_id>\u0000<role>', instance_id>`（进程内、无 TTL、无淘汰定时器、选择时顺带丢弃失效绑定）、在飞预留计数（选中 +1 / settle −1）。**读数来源全部是既有只读面**（`router.status` / `router.task_list`），负载复用既有 `deriveAgentWork`；零依赖、不新增协议方法、不改 `ContextPool` 的 `(chat_id, agent_id)` 键语义。本 PR 只交付模块与其自证，deps 注入与 `/api/calls` 调用点替换在 pr-005。

## 涉及功能点

- F06
- F07

## 文件范围

- oamp/src/pool-routing.js（新建）

## 验收标准

- [ ] `oamp/src/pool-routing.js` 存在，**导出面恰两类**：① 工厂 `createPoolRouting({ roleFromInstanceId })`（返回 `choose` / `release` / `bindingOf` / `inflightOf`）② 具名导出 `roleOfPoolInstance(instanceId, baseResolve)`；无定时器、无文件与网络 I/O、无对其它 `src/**` 模块的 import（`baseResolve` 由参数传入，不 import `role-binding.js`）
- [ ] `roleOfPoolInstance` 的三段语义与边界可独立判定（纯函数、不抛错）：① 先 `baseResolve(instanceId)`，非 `null` 即返回；② 未命中且 id 形如 `pb-<role>-<n>`（`n` 正整数）⇒ 剥尾段 `-<n>` 后用**同一个** `baseResolve` 解析；③ 仍 `null` ⇒ 返回 `null`。以真实 `roleFromInstanceId` 作 `baseResolve` 时五条边界逐条成立：`pb-dev` → `dev`；`pb-dev-2` → `dev`；`pb-dev-0` / `pb-dev-x` / `pb-dev-` **不归一** ⇒ `null`；非字符串入参 ⇒ `null` 且不抛错；**精确优先** ⇒ 若角色 `dev-2` 真实存在（`roles/dev-2/dev-2.md`）则 `pb-dev-2` 就是 `dev-2`
- [ ] 池成员过滤正确：给定含 `offline` 节点、`connected === false` 节点、异角色节点的快照 ⇒ 三者均不被选中（池为空时返回 `null`，由调用方回落既有 `instanceIdForRole`，模块自身不造错误面、不静默排队）；同角色的 `pb-dev` 与 `pb-dev-2` 同时在线时二者**都在池内**、互为独立实例（不做别名等价）
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
