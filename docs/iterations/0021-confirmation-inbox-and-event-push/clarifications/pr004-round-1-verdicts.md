# 主 agent 裁决记录 · pr-004 第 1 轮（阶段 5 · 次波）

**迭代**: 0021-confirmation-inbox-and-event-push ｜ **阶段**: 5（PR 实现）｜ **日期**: 2026-09-13
**输入**: `prs/pr-004-tasks.md`（planner 产出，提交 `cce5f8b`，5 任务 T1~T5）+ 阶段 4 Gate 报告（D-h8）+ pr-003 已合并后的实测事实
**性质**: 主 agent 对 planner 报告 5 项疑问的裁定 + 2 项 `[model_inferred]` 的用户确认记录。本文件是 pr-004 的 dev 与 verifier 的验收标准来源之一（与 PR 文件 10 条验收标准、`prs/pr-004-tasks.md` T1~T5 并列）。

---

## 一、`[model_inferred]` 项的用户确认（**真实阻塞式转呈，2026-09-13**）

| # | planner 的 `[model_inferred]` 验收标准 | 用户裁决 |
|---|---|---|
| MI-1 | T1 验收 6：`oamp/web/notify.js` 对外以**全局入口**暴露给 `app.js`（零构建 / 经典脚本下无 import 可用） | **`user_confirmed`：确认全局入口** |
| MI-2 | T4 验收 6：同一 chat 的**同一终态**重复广播**不重复**派发通知（以「状态转变」为判据而非「帧到达」） | **`user_confirmed`：确认同值终态去重** |

两项均按 planner 的推断口径**生效**，不再保留 `[model_inferred]` 待确认状态。

## 二、疑问裁定

### Q1（终态派生口径未钉死）—— 裁定：按「同值终态去重」定稿

- **规则**：对每个 `chat_state` 帧，若 `state ∈ {completed, failed}` **且**该 `chat_id` 上一次观测到的状态**不等于同一终态** ⇒ 派发一次通知；否则不派发。
- **冷启动分支**：页面在此之前未观测过该 `chat_id` 的任何帧时，**首帧即终态仍通知一次**（不得因「未观测到 `working`」而漏报——否则刷新/重连后的首次终态会静默）。
- **依据**：MI-2 的 `user_confirmed` 口径 + prd F07 验收 2（转变语义）+ PR 验收 7「三类事件各触发一次」。

### Q2（R-2 的 400 INVALID_PARAM 前端处置未写）—— 裁定：按最小口径处置，不新增组件

- `404 NOT_FOUND`（已裁决 / 已失效 / 从未存在）：**移出栏内条目、不重放**（架构 §5.1「幂等」行原文：前端据此移除，不重放）。
- `400 INVALID_PARAM`（正常路径不可达）：**不移除条目**（不当作已裁决）、**不重放**；错误按既有 `fetch` 失败口径处理（不新增弹窗 / 横幅 / 组件）。
- 依据：最小实现原则（dev 角色「如无必要，勿增实体」）+ 架构 §5.1 只对 404 给了前端语义。

### Q3（第三栏在项目列表视图下随 `main.layout.hidden` 不可见）—— 裁定：采纳为**边界登记**，不行动

PR 验收 7 的「项目列表页也能收到通知」由**全局 SSE** 驱动，与第三栏可见性无关；第三栏随既有视图语义隐藏是既有行为，不在本 PR 扩范围。

### Q4（`oamp/src/web.js` 的 `/api/events` 路由 summary/response 文案少报事件类型）—— 裁定：**并入 pr-004，显式扩文件范围 2 个**

- **事实**：pr-003 已合并后，`oamp/src/web.js:747/749` 仍写「agent_online / agent_offline」，导致 `/api/docs` 与 `oamp/llms.txt:21` **少报** `confirmation` / `chat_state` 两类（`API.md §4.2` 已如实登记 4 类，`web.js:14` 头注亦已 4 类 ⇒ 仅该路由的元数据两条文案漏改）。
- **裁定**：pr-004 的**文件范围显式追加** `oamp/src/web.js`（**仅** `/api/events` 路由的 `summary` 与 `response` 两条文案）与 `oamp/llms.txt`（由 `node oamp/scripts/gen-llms-txt.mjs` **重生成**，不得手改）。除此之外 `oamp/src/web.js` 仍属**禁改**（`§11.4`「既有 19 条路由 handler 零改动」继续生效——本次只改元数据字符串，不动 handler）。
- **追加验收项（AE-1）**：`/api/docs` 投影与 `oamp/llms.txt` 中的 `/api/events` 条目**如实反映 4 类事件**（`agent_online` / `agent_offline` / `confirmation` / `chat_state`）；漂移锁（llms 逐字节快照、API.md 双向覆盖、路由清单/条数断言）**保持绿**。
- 依据：用户裁决（2026-09-13，真实阻塞式转呈三选一 ⇒ 选「并入 pr-004」）。

### Q5（T5 静态断言检索式依赖 T1 落盘形态）—— 裁定：采纳

T1 落盘后**先 grep 校验命中**，再定稿 T5 的断言检索式（先例：`api-pages.test.js` 的 `window.confirm` 断言作用域曾被误标为 `app.js`）。

## 三、既有裁决与事实的继承（dev 必遵）

- **D-h8**：`index.html` 的前置检索式用 `layout`（实际为 `class="layout hidden"`）。
- **p-003-Q1**：全局链路的 wire 层事件类型集合 = `agent_online` / `agent_offline` / `confirmation` / `chat_state`。
- **p-003-Q3**：`oamp/web/debug.js` **不在**本 PR 文件范围（`EVENT_TYPES` 未含 `confirmation` 属已知边界，登记不动）。
- 架构 §11.4 零改动清单继续生效；`style.css` **只追加**；零新依赖、零构建；不新增页面 / 路由 / 顶栏抽屉 / 左栏 tab。
- **pr-003 已合并**（`1f7eceb`）：两条新路由、`oamp/src/inbox.js`、全局 `confirmation` 帧、`STATIC_FILES` 的 `/notify.js` 登记均**已在基线内**（`GET /notify.js` 现在 404，pr-004 落盘 `web/notify.js` 后应 200）。

---

## 四、Q6（第 2 轮追加裁决，来自 pr-004 独立验收报告）

**触发**：`clarifications/verify-pr-004-20260913-202425.md` 判定 **PASS（60 pass / 0 fail / 2 partial）**，两个 partial 指向同一子项——PR 验收 7 / 任务图 T4-4 的「hub 调用面完成（`call_result`）**不产生**通知」不成立：后台调用完成时，`src/web.js` 的 `finishTask` 经 `publishState(entry.chatId, chat.state)` 推全局 `chat_state{completed}`，前端无法区分调用驱动与消息驱动的终态 ⇒ 产生 1 条「对话已完成」通知。

**裁定：该子项是绑定条款，必须修（不按「措辞宽松化」处理）。**

- **依据**：PR 验收 7 的该子句直接来自 **`prd/F07` 验收 3（N5）**，而 N5/P6 是 `user_confirmed` 需求——「经 hub 调用面派发的后台调用完成时**不产生**通知；『完成』类事件只覆盖**对话完成**语义」（`demand.md` N5 原话：不覆盖 hub 调用面的完成通知，事件集合不含 `call_completed`）。这不是实现口味问题。
- **架构前提被实测证伪**：`architecture.md` §prd 补全 F07「不含 `call_completed`」处断言「调用事件走 `call:` / `chat-calls:` 键 ⇒ 前端结构上不可能产生」——实测显示调用面驱动的**对话**状态变化同样经 `publishState` 推全局 `chat_state`，故该结构论证不成立（属技术方案问题，在本阶段直接解决，不动需求）。
- **修复口径（最小、且不改既有可观测面）**：
  1. **调用面驱动的 chat 状态变化不得进入全局 `chat_state` 链路**（`GET /api/events`）；**既有 `chat:<id>`（`GET /api/stream`）的帧形态与时机逐字不变**（对话面板照常更新）。实现落点 = `oamp/src/web.js`（`publishState` 增加默认等价的选项参数 + 调用面驱动路径按 `entry.call` 关闭全局广播；`finishTask` 的终态发布是必改点，调用面派发处的 `working` 发布是否同改由实现按同一语义定，判据见下 3）。
  2. 消息驱动（`POST /api/messages`）的对话终态**仍须**在全局链路上可观测（pr-003 验收 10 与 `confirmation-inbox.test.js` 的 T4 用例保持绿）。
  3. **新增自动化断言**（授权新文件）：新建 `oamp/test/notification-scope.test.js`——起 router + web（临时 DB/socket）+ 假节点，经 `POST /api/calls`（background）派发一次并等其终态：断言①该对话在 `GET /api/events` 上**不出现** `chat_state` 终态帧；②在 `GET /api/stream?chat_id=` 上**仍出现**既有 `chat_state` 帧（形态逐字）；③作为对照，`POST /api/messages` 路径的终态**仍出现**在全局链路上。若实现选择「调用面驱动的 chat 完全不进全局链路」，则①扩展为「不出现该 chat 的任何 `chat_state` 帧」——两种口径均可，但必须在报告中写明所选口径。
- **文件范围追加（第 3 次）**：`oamp/src/web.js`（由「仅两条文案」扩为 `publishState` 的选项参数 + 调用面驱动路径的全局广播开关，**仍不得触碰既有 19 条路由 handler 的其他行为**）、**新建** `oamp/test/notification-scope.test.js`。其余范围与禁改清单不变。
- **偏差登记（不修）**：验收报告的 D-1（T4-3「前端不额外去重」措辞 vs `app.js` 按 `confirmation_id` 去重——按实现更新任务图措辞）、D-2（PR 验收 3 的「来源对话标识」实际渲染含 `agent_id` 前缀）——两条按实现更新规格措辞，留阶段 6 汇总。
