# PR-007：result 投递丢失的对账补拉（补丁）

## 上下文摘要

交付演示实测的间歇缺陷（1/5 复现）：agent 执行成功且 Router 任务表 `state=completed` + result 完整（recorded 语义），但 result 投递未达 web（发起者离线窗口/投递竞态）→ 对话缺回复、chat 长期停留 working。修复：web 侧**对账补拉**（以 Router 任务表为权威运行态）——派发即登记并定期 `router.task_get`，读到终态且未落库则补落 `out` + SSE；快速预算 6×5s 用尽转 **30s 低频续查**（不放弃）；登记软 TTL 30min 清理孤儿；`landed` 同步检查+置位保证恰一条 out（对账与投递竞争幂等）；SIGINT 清理全部对账定时器。

## 涉及功能点

- F02（输入/输出落库完整性：投递丢失不导致缺输出）
- F04（实时展示：补拉结果同样推 SSE）

## 文件范围

- oamp/src/web.js（登记扩展 `landed/attempts/slow/registeredAt/timer`；`reconcileTask`；调度与低频续查；软 TTL；SIGINT 清理）
- oamp/test/web.test.js（+3 用例：投递丢失补落 / 跨预算双故障低频续查 / TTL 清理；既有用例适配降频语义）

## 验收标准

- [ ] 投递丢失（Router 终态但 web 未收）→ 对账补落恰一条 `out` + SSE(message/chat_state)；重复对账/重复投递不重复落行
- [ ] > 快速预算（默认 30s）的长任务其合法 result 仍能落库（跨预算回归）；**长任务 + 投递丢失双故障**由低频续查补落（默认配置实测 35s 任务 + 35s 终态发未注册目标 → 60s 补落、completed）
- [ ] 登记软 TTL 到期清理孤儿并恰一条 warn；删除路径仅 landed / TTL / SIGINT 三处
- [ ] 测试全绿（web.test.js 22/22；npm test 151/151）；其余测试文件零修改；零新依赖

## 参考资料

- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-162219.md（初验 FAIL：发现"上限删登记"反噬）
- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-162219-rereview.md（二验 PASS）
- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-162219-rereview2.md（终审 PASS：D-1/D-2 闭合，含因果隔离证据）
- architecture.md §4.3（派发登记时序与终态对账）/§8.2（对账参数 env）/§18.1 NC-17/NC-18

## depends_on

- pr-004-web-api-and-console.md（理由：修复对象是 pr-004 引入的派发/落库链路；证据：`oamp/src/web.js` 的 POST /api/messages 与 handleDeliver 均属 pr-004 落地面）
- pr-006-dispatch-race.md（理由：对账依赖 pr-006 的"派发前登记"凭据（task_id→chatId）；证据：`reconcileTask` 从同一 `tasks` 登记读取 chatId，登记前置由 pr-006 建立）

## batch

5
