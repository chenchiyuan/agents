# 0022 architect 第 1 轮 · 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `architecture.md` §4.1（L1 决策 2 条）+ §12.1（`[model_inferred]` 7 项）+ §12.2-3（零侵入判据是否固化为测试）
**性质**: `user_confirmed`
**用途**: architect 第 2 轮派发的输入

---

## L1-1 · 协议注入点的落点与配置载体 —— **采纳推荐项①**

- 注入点 = 新建 `src/protocol.js` 的 `createProtocolLayer()`；
- 载体 = **一个字符串**（协议名）；
- 解析链 = 角色级 `oamp agent start <id> --protocol <rpc|acp>` > env `OAMP_PROTOCOL` > `config.json` 新第 4 键 `protocol` > 内置 `rpc`；
- **不引入**「协议参数对象」；
- 影响面照 `architecture.md` §4.1 所列：新建 `src/protocol.js`；改 `src/config.js`（第 4 键 + env）、`src/agent.js`（`--protocol` flag）、`src/context-pool.js`（构造契约）；`oamp/README.md` 补启动参数说明；`oamp/API.md` 与 `oamp/llms.txt` 零改动。

## L1-2 · L2 标准面写定为一份接口契约 —— **采纳推荐项①**

- 把会话四动作 + 三类增量回调 + 两类反向请求回调 + 能力位写定为 `src/protocol.js` 导出的**一份形状**（§5.1 签名），成为 `context-pool.js` / `agent.js` 的**唯一依赖面**；
- 协议中立错误类型 `ProtocolError`（码值逐字沿用既有 `AcpError.code` 五值）与能力位键集（M6 六候选）下沉到该模块；
- `AcpClient` 从「被消费层直接构造的实现」变为「实现标准面的一个实现」（能力位 + 统一 `onDelta` 外观，**行为零变更**）；
- 已否决：分发函数形态（D-2 结构性不成立）、每能力独立小接口（YAGNI）、EventEmitter/AsyncIterator 形态。

## MI-A-1 ~ MI-A-7 —— **七项全部采纳**

| # | 采纳内容 |
|---|---|
| MI-A-1 | 过程增量**不新增 SSE 事件类型**，只扩展 `kind` 取值（`thinking` / `tool_call` / `tool_output`）⇒ `oamp/src/web.js` 零改动前提成立 |
| MI-A-2 | 过程展示 = **既有流式气泡内部分区**（思考块 / 工具块），不做折叠 / 配色 / 开关 |
| MI-A-3 | 门的呈现 = **`tool` 名作主标签、`title` 原样多行作详情**（复用既有条目渲染） |
| MI-A-4 | rpc profile **不传 `--thinking`**（依赖模型默认档）——E3 成立的**必要条件**（若传 `off` 则思考增量消失、E3 直接失败） |
| MI-A-5 | oneshot 的 `streaming` 能力位 = **`degraded`**（有 stdout 行流、无结构化 delta） |
| MI-A-6 | 能力位最终集合 = M6 候选**六项原样**（不增不减） |
| MI-A-7 | 新增 `agent start --protocol` flag（角色级档位） |

## §12.2-3 · 零侵入判据是否固化为测试 —— **新增机械断言测试**

- 新增测试把 §3.3 三条判据固化为机械断言：① 生产消费层不 import / 不构造具体协议实现；② 不按协议取值分支；③ 切换协议只改注入配置（消费层 `git diff` 为零）。
- 定位：属**新增测试**（用于 D-2/D-3 的可执行证据），**不是** A5 所指的「既有测试面最小更新」；两者并存、互不替代。

## §12.2-1 / §12.2-2 · 主 agent 裁定（非用户决策点）

- **§12.2-1（`oamp/API.md` 是否登记新配置键）**：采纳 architect 判断 —— 配置面不是 HTTP 接口面 ⇒ `API.md` / `llms.txt` **零改动**，不触发 0016/0021 的文档漂移锁。
- **§12.2-2（`web/style.css` 是否增样式）**：采纳 architect 判断 —— 登记为**实现阶段确认**，架构面不扩大改动面。

---

## architect 第 2 轮的处理清单

1. 把 §4.1 两条 L1 的「裁决」行由 `⏳ 待主 agent 确认` 改为 `✅ 用户确认（2026-09-14，采纳推荐项①）`，并保留备选与否决理由。
2. 把 §12.1 七项 `[model_inferred]` 改为 `[user_confirmed]`（保留推断原文与裁决结论）。
3. §9.4 测试面补入「新增零侵入机械断言测试」（§12.2-3 裁决），并标注其为新增测试、与既有测试最小更新并列。
4. §12.2 的三条疑问按上述裁定收口（1/2 采纳 architect 判断；3 转为已裁决项）。
5. 变更后 `architecture.md` 版本升至 v0.2.0，并在文首状态行更新（L1 已确认 / model_inferred 归零）。
6. 不得改动功能卡产品维度、不得新增组件、不得修改 L2 决策结论。
