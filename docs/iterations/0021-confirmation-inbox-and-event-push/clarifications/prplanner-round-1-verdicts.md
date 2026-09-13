# 阶段 4 · pr-planner 报告级事项的主 agent 裁定

pr-planner 报告了 4 处「架构 vs 代码现状」矛盾 + 1 处边界偏离。以下为**主 agent 裁定**（均属 L2/L3 层面的执行口径，不改需求与架构结论）：

| 项 | planner 的发现 | 主 agent 裁定 |
|---|---|---|
| **A1** | `architecture.md` §11.4 把「`web.js` 静态面」列为零改动，**与代码相反**：`STATIC_FILES` 是显式白名单（无通配/无兜底），新增 `web/notify.js` 必须登记 | **采纳 planner 的代码证据**：`STATIC_FILES` 登记列入 pr-003 改动面，并作为 pr-004 依赖 pr-003 的第二条证据。§11.4 该行为**架构文档误差**，登记为偏差（不返工 architecture.md，由本文件与 Gate 报告留痕） |
| **A2** | §5.2「全局链路 2 类 → 3 类」与 §2.2/L2-8 矛盾；按代码证据（`web.test.js` 全局流用例点名 `chat_state`、`API.md §4.2` 键隔离句）全局链路实际含 `chat_state` | **采纳 planner 的验收写法**：pr-003 的验收写成「全局链路类型集合与 `API.md §4.2` 登记、`web.test.js` 断言**三者一致**」——不替架构拍板事件名，而以三源一致为可判定口径 |
| **A3** | §11.1 必然变更点**遗漏**三个测试文件的硬编码路由集合（`api-routes.test.js` 的 `EXPECTED_SIGNATURES` / `project-workspace.test.js` 的 `EXPECTED_ROUTE_SIGNATURES` + `routes.length` / `call-protocol.test.js` 的 `docs.body.routes.length`），且 §11.1 还写「不是改测试」与代码不符 | **采纳**：三者列入 pr-003 文件范围；验收 = 「漂移锁转绿且未削弱断言」。§11.1 的「不是改测试」表述为文档误差，登记 |
| **A4** | §4.5 的「需实现期复核」实为必然变更；而 `api-pages.test.js` 经核实**确为零改动**（B-5 疑问据此关闭） | **采纳**（含关闭 B-5） |
| **B** | architecture §4.1 N-3 只给一个测试文件，但「文件范围零重叠」不允许同一文件被两个 PR 声明 ⇒ 拆为 3 个新测试文件 | **采纳该偏离**：三个新测试文件（`confirmation-inbox.test.js`@pr-003、`confirmation-roundtrip.test.js`@pr-002、`inbox-console.test.js`@pr-004）是「零重叠」这条硬规则下的必然结果；architecture 的单文件方案是**下界**而非约束。登记为偏差（不回退阶段 3） |
| **C** | §3.2/T-01 写「CSS 两列改三列（grid）」但现状 `.layout` 是 flex；`API.md §7` 未列举 `notice` 的 kind ⇒ §11.2 B-10 判零改动 | **采纳**：pr-004 的文件范围与验收**不绑定**具体布局实现（flex 加列或改 grid 皆可）；B-10 维持零改动 |

## 派生的登记项（供阶段 6 汇总）

- 偏差 D-a：architecture §11.4「静态面零改动」与代码相反（已由 pr-003 承接）。
- 偏差 D-b：architecture §5.2 的全局事件类型计数与 §2.2/L2-8 不一致（已由 pr-003 的「三源一致」口径承接）。
- 偏差 D-c：architecture §11.1 遗漏三个测试文件的硬编码路由集合改动（已由 pr-003 承接）。
- 偏差 D-d：architecture §4.1 N-3 的单测试文件方案与「零重叠」规则冲突 ⇒ 拆三文件（已采纳）。
- 偏差 D-e：§3.2/T-01 的布局实现描述（grid）与现状（flex）不符（不影响验收）。
