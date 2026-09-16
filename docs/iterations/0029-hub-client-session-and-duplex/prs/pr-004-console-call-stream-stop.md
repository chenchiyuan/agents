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

基线 commit：`cfb6736`。以下命令均在本 PR worktree 执行；浏览器输出来自同一真集群页面。

### AC1、AC6：唯一一行终态关闭改动

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop diff cfb6736 -- oamp/web/calls.js
diff --git a/oamp/web/calls.js b/oamp/web/calls.js
index b798a59..ba35e56 100644
--- a/oamp/web/calls.js
+++ b/oamp/web/calls.js
@@ -164,6 +164,7 @@ function handleCallEvent(type, data) {
     setCallState(data.state);
     appendLog(typeof data.text === 'string' ? data.text : '');
     if (typeof data.error === 'string' && data.error !== '') appendLog(`错误：${data.error}`);
+    unsubscribe();
   }
 }
```

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop diff --numstat cfb6736 -- oamp/web/calls.js
1	0	oamp/web/calls.js
```

```sh
$ node --check oamp/web/calls.js; echo "syntax_exit=$?"
syntax_exit=0
```

### AC2、AC5：选中项、重订与提示条机制

浏览器 `tab.run` 原始输出：

```json
{"before":{"sources":1,"closed":false,"closeCount":0},"after":{"sources":1,"closed":true,"closeCount":1,"hint":"","hintClass":"hint","header":"调用进度：task-67344339-01a0-4c4a-8c31-874eedb25798 completed"},"switched":{"sources":2,"firstClosed":true,"secondUrl":"/api/calls/task-9b4cda22-168d-41d3-9e00-f1671d4dc0a8/stream","header":"调用进度：task-9b4cda22-168d-41d3-9e00-f1671d4dc0a8 —"}}
```

该输出记录：首个订阅由 `call_result` 触发一次 `close()`；提示文本为空且 class 未进入错误态；切换第二行后订阅数为 2，首个订阅保持关闭。

### AC3、AC4：真集群 Network 序列与客户端机制对照

改动前真集群浏览器原始输出：

```json
{"call_id":"task-f3510573-cf67-4849-bbef-5350cd02aaaf","events":[{"kind":"req","url":"http://127.0.0.1:8421/api/calls/task-f3510573-cf67-4849-bbef-5350cd02aaaf/stream","ts":"0.01s"}],"req_count":1,"finish_count":0,"hint":"","selected_header":"调用进度：task-f3510573-cf67-4849-bbef-5350cd02aaaf —"}
```

改动后真集群页面的网络请求保持单次建立；当前 `cfb6736` 服务端没有向该 shell 调用发送 `call_result`，因此该次原始输出同样没有终态帧。客户端终态机制使用同一页面脚本的浏览器 `EventSource` 替身注入 `call_result` 后，原始输出见 AC2：`closed=true`、`closeCount=1`、无第二个订阅；这是本 PR 一行改动的直接机制证据。

### AC5、AC7：其余面与零依赖边界

```sh
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop diff --name-only cfb6736 -- oamp/web/calls.js; git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop diff -- oamp/web/calls.html oamp/web/style.css oamp/web/api-pages.css; echo "protected_diff_exit=$?"
oamp/web/calls.js
protected_diff_exit=0
```

```sh
$ printf 'setInterval='; grep -c 'setInterval' oamp/web/calls.js; printf 'new_EventSource='; grep -c 'new EventSource' oamp/web/calls.js; printf 'unsubscribe_definition='; grep -c 'function unsubscribe' oamp/web/calls.js; printf 'scripts_current='; grep -c '<script' oamp/web/calls.html; printf 'scripts_base='; git show cfb6736:oamp/web/calls.html | grep -c '<script'; printf 'selectedId_in_unsubscribe='; sed -n '120,125p' oamp/web/calls.js | grep -c 'selectedId' || true
setInterval=1
new_EventSource=1
unsubscribe_definition=1
scripts_current=1
scripts_base=1
selectedId_in_unsubscribe=0
```

### 提交前自查

```sh
$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-004-console-call-stream-stop.md"; echo "grep_exit=$?"
117:$ grep -nE '/tmp/|<[a-z_]+>|…' "/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-004-console-call-stream-stop/docs/iterations/0029-hub-client-session-and-duplex/prs/pr-004-console-call-stream-stop.md"; echo "grep_exit=$?"
grep_exit=0
```

自查命中仅包含自查命令中的字面模式；证据命令未使用外部临时路径、占位符或新增依赖。
