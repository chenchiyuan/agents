# PR-006：派发登记竞态修复（补丁）

## 上下文摘要

pr-005 验收发现的 pr-004 遗留缺陷：`web.js` 在 `await sendTask` 返回后才登记 `task_id → chatId`；当 agent 首个 chunk 与 send 响应落在同一 socket read 时，`handleDeliver` 先于登记执行 → 首个 `task.update`（首片增量）被丢弃（终态落盘不受影响）。修复：登记**前置**到派发之前（task_id 本就由 web 预生成）+ 派发失败分支定向清理。对照证据：锁定用例在未修复版 8/8 红、修复版 8/8 绿。

## 涉及功能点

- F04（过程实时展示：首个增量不得丢失）

## 文件范围

- oamp/src/web.js（`tasks.set` 前置 + 失败分支 `tasks.delete`；原 await 后的登记删除）
- oamp/test/web.test.js（新增锁定用例「派发响应与首个 task.update 同批到达时首片不丢」+ E-4 首片显式断言）

## 验收标准

- [ ] 新增用例在未修复构建上确定红（首片被丢弃）、在修复构建上确定绿（对照复现证据）
- [ ] `node --test test/web.test.js` 与 `npm test` 全绿（146/146）
- [ ] 其余既有测试文件零修改；零新第三方依赖；未越界写其他文件

## 参考资料

- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-151233.md（缺陷发现项）
- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-152525.md（本次验收报告）
- docs/iterations/0011-chat-context-protocol/architecture.md §4.3（派发登记时序）

## depends_on

- pr-004-web-api-and-console.md（理由：修复对象是 pr-004 引入的 POST /api/messages 派发路径；证据：`oamp/src/web.js` 中 `tasks.set` 与 `sendTask` 调用同一函数体内，由 pr-004 落地）

## batch

5
