# pr-004-console-call-page

> 迭代：0018-chat-agent-subagent-protocol · 阶段 4（PR 规划）产物
> 真源：`docs/iterations/0018-chat-agent-subagent-protocol/architecture.md` §6（控制台调用面）+ §8.3 + §9.2 L2-17

## 上下文摘要

控制台调用面：新增独立静态页 `/calls`（`calls.html` + `calls.js`，复用既有 CSS ⇒ 零新 CSS、零构建、零依赖），顶栏新增「调用」入口，`README.md` 控制台节 +1 行；附 `call-console.test.js` 断言静态契约与可达性。**不含既有测试断言改写**（`api-pages.test.js` 零改写）。

## 涉及功能点

- F13
- F14

## 文件范围

- oamp/web/calls.html（新建）
- oamp/web/calls.js（新建）
- oamp/web/index.html（修改）
- oamp/README.md（修改）
- oamp/test/call-console.test.js（新建）

## 验收标准

- [ ] `GET /calls` 返回 200 且 content-type 为 `text/html; charset=utf-8`；`GET /calls.js` 返回 200 且 content-type 为 `text/javascript; charset=utf-8`（两项由 pr-003 的 `STATIC_FILES` 白名单提供）。
- [ ] `oamp/web/index.html` 顶栏出现新入口 `<a class="nav-item" href="/calls">调用</a>`，且既有 3 个占位项（`Workspace` / `Agents` / `Tasks`）与 `/docs`、`/debug` 入口逐字未变（`node --test oamp/test/api-pages.test.js` 全绿且该文件内容 `git diff` 为空）。
- [ ] 页面按行呈现 roster 六列（调用 id / agent / 状态 / 起止时间 / 模型），取数 = `GET /api/calls`，随后按既有 5 s 轮询体例刷新（不引入新推送机制）。
- [ ] 点击某行 ⇒ 订阅 `GET /api/calls/:call_id/stream` 并渲染 `call_state` / `call_update` / `call_result`；切换选中项时关闭旧订阅、开新订阅。
- [ ] 页面与脚本不出现 token / 成本 / 工具级详情 / 取消 / steer 的字段或控件（检索式 `grep -nEi 'token|cost|steer|cancel|isolated|effort|usage' oamp/web/calls.html oamp/web/calls.js` 零命中）。
- [ ] `oamp/web/app.js` / `oamp/web/style.css` / `oamp/web/api-pages.css` 零改动（`git diff --name-only` 不含这三个路径）。
- [ ] `oamp/README.md` 的「Web 控制台（demo）」节出现「调用」入口一行；`## 协议速览` 小节逐字未变（既有「方法面仍 7 个」用例全绿）。
- [ ] 新增 `oamp/test/call-console.test.js` 在文件内自带 harness（不抽公共 helper、不改既有测试文件），`node --test oamp/test/call-console.test.js` 全绿。

## 参考资料

- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §6（页内三块 / 入口 / 不呈现项）、§8.3（前端与文档改动面）、§9.2 L2-17
- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §12.1（新增测试文件命名：`call-console.test.js`）、§12.2 组 K
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F13-console-call-view.md（T-07 / T-12）
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F14-existing-behavior-unchanged.md（验收 1 / 5）

## depends_on

- pr-003-call-http-surface-and-contract-docs.md（理由：顶栏入口 `/calls` 的可达性由 pr-003 在 `oamp/src/web.js` 的 `STATIC_FILES` 白名单新增 `/calls` → `web/calls.html`、`/calls.js` → `web/calls.js` 两项决定（检索式 `grep -n 'STATIC_FILES' oamp/src/web.js`）；页面取数的 `/api/calls`、`/api/calls/:call_id/stream` 由 pr-003 在 `createApiRoutes` 表末位登记 —— 缺 pr-003 时页面文件存在但不可达、取数 404）

## batch

3
