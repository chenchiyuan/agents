# pr-004：控制台调用进度订阅的终态适配（1 行）

## 上下文摘要

`oamp/web/calls.js` 的**一行**适配：`call_result` 分支末尾关闭当刻订阅。理由（事实 F-12）：pr-005 落地 F09（终态关流）+ F10（晚订阅补发）后，`EventSource` 在服务端关流后会按 `retry: 1000` **每秒重连一次**，反复拿到补发帧并持续发请求。适配后语义 = "终态即停；重选该行即重订并当场拿到补发帧"。

关键约束：这是 F09 行为变更的**必然适配**（O-4 已声明），不是新增能力；控制台其余行为（roster 6 列、5s 轮询、切换选中行先关后开、错误提示条）零改动。

## 涉及功能点

- F09
- G01

## 文件范围

- `oamp/web/calls.js`
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-004-console-call-stream-stop.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（服务端面归 pr-005）、`oamp/web/app.js`、其余 `oamp/web/**`。

## 验收标准

- [ ] `handleCallEvent` 的 `call_result` 分支在渲染后调用既有的 `unsubscribe()`（`oamp/web/calls.js` 既有函数，不新增函数、不新增状态）
- [ ] 关闭后 `selectedId` 保持为当前行（不触发重新订阅）；用户点击其它行仍照常"先关后开"（既有 `selectCall` 行为不变）
- [ ] 该适配**不依赖**服务端新行为即可独立成立：对一次已终态调用选中 ⇒ 收到终态帧后订阅关闭，随后的重复帧不再到达（当前服务端实现下亦无回归）
- [ ] 真集群 smoke（浏览器）：选中一个进行中的调用 ⇒ 该 `EventSource` 只建立一次、收到 `call_result` 后连接关闭，Network 面板**无每秒重连**；选中一次已终态调用亦同（F09 验收 1/2 的客户端侧判据）
- [ ] 控制台调用面板其余部分逐字不变：roster 表 6 列（`call_id / agent / state / started_at / ended_at / model`）、5s roster 轮询、空态/错误提示条、切换选中行逻辑（G01 验收 5）
- [ ] 改动量守门：相对本 PR 基线 `git diff --numstat -- oamp/web/calls.js` 为 ≤3 行新增 / 0 行删除
- [ ] 零新增前端依赖、零新样式、零新轮询机制

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F09-close-stream-on-terminal.md`（验收 1~5、边界）、`G01-existing-surface-preserved.md`（验收 5）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §1.3 事实 F-12、§0（"唯一有界面改动的既有前端文件"与 1 行适配声明）、§6.2 S-9、§7 L2-13、§11.2 O-4
- 代码锚点：`oamp/web/calls.js`（`selectCall` / `unsubscribe` / `handleCallEvent` 的既有三函数；`ROSTER_REFRESH_MS = 5000`；文件头注释的"切换选中项 ⇒ 先关闭旧订阅再开新订阅"体例）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：`git diff` 原文与 `--numstat` 行数 + 浏览器 Network 面板截图/时间戳序列（只建一次连接、终态后关闭、无 1s 重连）+ 控制台其余面回归的目视结论。载体约定见 `architecture.md` §6.2 S-9。）
