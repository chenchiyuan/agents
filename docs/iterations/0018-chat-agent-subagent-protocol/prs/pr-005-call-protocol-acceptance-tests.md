# pr-005-call-protocol-acceptance-tests

> 迭代：0018-chat-agent-subagent-protocol · 阶段 4（PR 规划）产物
> 真源：`docs/iterations/0018-chat-agent-subagent-protocol/architecture.md` §12.1 / §12.2 / §12.3

## 上下文摘要

调用面端到端验收测试：新增 `call-protocol.test.js`，harness 起真实 Router + `oamp web start` + fake ACP（零真实 omp / 零外网），覆盖架构 §12.2 组 A~J 与组 M（寻址 / 入参 / 终态 / 投递 / 进度 / roster / 转录 / 归属 / 身份）。**不含既有测试断言改写**（纯新增文件）。

## 涉及功能点

- F03
- F04
- F05
- F06
- F07
- F08
- F09
- F10
- F11
- F12
- F15

## 文件范围

- oamp/test/call-protocol.test.js（新建）

## 验收标准

- [ ] 文件存在，`node --test oamp/test/call-protocol.test.js`（在 `oamp/` 下）全绿；测试在文件内局部复制既有体例的 harness / SSE 客户端辅助（不抽公共 helper、不改既有测试文件）。
- [ ] 组 A（F03）：按角色名发起命中该角色；角色不在线与角色不存在均 404 且文案同一；`GET /api/agents` 的 `role` 与 `null` 空值形态可读；失败路径不拉起任何 agent。
- [ ] 组 B（F04）：`context` 在 agent 侧可见且 `task` 原文无前缀污染；`output_schema` 超出受限子集 → 400；一次提交两项得两个互不相同的 `call_id`；`mode: 'block'` 返回即终态、`background` 立即受理；显式 `model` 优先级；被排除维度（isolated / effort / local:// / agent:// / ACP 字段）零出现。
- [ ] 组 C/D（F05 / F06）：受理响应含 `call_id` 与 `agent`；按 id 取进行中状态与终态；终态字段逐项齐备且词表可区分成功 / 失败；响应键集合零 usage / token / 成本；截断用例（fake ACP 造超上限更新）`truncated: true`。
- [ ] 组 E（F07）：先订阅再发起可收到带 `call_id` 的 `call_result`；全程只订阅不查询仍可达；两次并发只订阅其一时不混入；连续多次无静默丢失（含投递被丢弃、经对账路径补投的场景）。
- [ ] 组 F（F08）：`submitted → working → call_update* → call_result` 顺序闭合；≥2 次增量事件；增量与随后取的转录一致；帧内无工具级字段与 token / 成本。
- [ ] 组 G（F09）：两行六列齐备（批量两项 = 两行）；`started_at` = 受理时刻、进行中 `ended_at` 为 `null` 且终态后 `ended_at ≥ started_at`；某行状态与该调用按 id 查询一致；无过滤 / 分页 / 编排入口。
- [ ] 组 H（F10）：按 id 取转录含末尾终态条目；进程内直接可读（无需事先登记）；服务重启后同 id → 404 且非 5xx、非伪造内容；超上限 `truncated: true`；`messages` 表零转录内容。
- [ ] 组 I（F11）：带归属成功且可经 `GET /api/chats/:id` 的 `messages[].meta.task_id` 关联核对；未提供与提供空值 `chat_id` 均 400 且 roster 无新增行；项目上下文继承；`project` 与 `context` 并存不合并。
- [ ] 组 J（F12）：同 chat 同角色两轮共享上下文、跨 chat 隔离（复用既有 fake ACP 的 `收到：<prompt>` 回显观测面）；`oamp/test/context-pool.test.js` 零改动且全绿。
- [ ] 组 M（F15）：调用面新增代码面与 `API.md` 调用面章节的词表检索，命中集合 ⊆ 允许集合（§7.3 差异清单节 + §6「不做」声明）；路由表零 `cancel` / `terminate` / `steer` / `isolated` / `effort` / `local://` / `agent://` 类路径与参数。
- [ ] 本 PR 不修改任何既有文件（`git status --porcelain -uall` 只含本 PR 新增的测试文件）。

## 参考资料

- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §12.1（载体与文件）、§12.2（组 A~N 断言落点）、§12.3（示例可用性 / 零半成品白名单 / 身份规则核对落点）
- docs/iterations/0018-chat-agent-subagent-protocol/architecture.md §2.3（错误映射）、§3.1~§3.5、§4.1（事件表）
- docs/iterations/0018-chat-agent-subagent-protocol/prd/F03~F12、F15（各卡验收标准与 `[user_confirmed MI-xx]` 口径）

## depends_on

- pr-003-call-http-surface-and-contract-docs.md（理由：本文件的每个用例都对 pr-003 登记的路由发请求；证据：测试起真实 web 子进程（`oamp/bin/oamp.js` 的 `web start`）后请求 `POST /api/calls`、`GET /api/calls`、`GET /api/calls/<id>`、`/transcript`、`/stream` —— 这些路径只存在于 pr-003 在 `oamp/src/web.js` 的 `createApiRoutes` 表末位追加的 6 条表项（检索式 `grep -n "path: '/api/calls" oamp/src/web.js`）；控制台页面的断言不在本文件，已由 pr-004 的 `call-console.test.js` 承载）

## batch

3
