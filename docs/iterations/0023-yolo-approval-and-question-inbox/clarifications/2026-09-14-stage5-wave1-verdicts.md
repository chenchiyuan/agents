# 0023 阶段 5 · 首波任务图 `[model_inferred]` 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `prs/pr-001-tasks.md`（5 项 MI）+ `prs/pr-002-tasks.md`（5 项 MI + Q1~Q3）
**性质**: `user_confirmed`

---

## pr-001 · 5 项 —— **全部采纳**

| # | 采纳 |
|---|---|
| MI-1 | 提问钩子的 `options` 元素形态 = `[{optionId, label?}]`（与既有门钩子同形，复用 `readConfirmationOptions` 读法） |
| MI-2 | 钩子面问题文本键名 = `question` → 信封 `title`（一对一） |
| MI-3 | `--approval-mode` 取值域校验**只约束可观测结果**（非法 ⇒ 退出 2 + 点名该值 + 不静默回落），机制自由（模块内字面集合或委托唯一汇聚点均可） |
| MI-4 | 工具关时 `buildArgv` **不追加**档位段（= `toolsOn && approval !== null`） |
| MI-5 | `hostTools` 转 `'yes'` 后**不新增 yes 键 note**（既有 `capabilityNotes()` 只为非 yes 键产出；保持键集与签名不变） |

## pr-002 · 5 项 —— **全部采纳**

| # | 采纳 |
|---|---|
| MI-a | `question` 类 notice body **不含** `option_id` 键（与 permission 侧「不含 `option_ids`」对称） |
| MI-b | `option_ids` 缺失 ⇒ 视为空集；键出现但非字符串数组（含 `null` / 字符串 / 数字 / 对象 / 含非字符串元素）⇒ **400 + 保留在途** |
| MI-c | 路由元数据编码 = `option_id.required: false` + `desc` 分类说明（`params[].required` 为布尔、无法表达条件必填）；`web.js` 顶部路由注释同源同步 |
| MI-d | `API.md` §3.20 的 `tool` / `title` 两行补 `question` 类口径（`tool` = 承载名、`title` = 问题文本） |
| MI-e | 域外 `request_kind` 字符串（如 `'nonsense'`）⇒ 条目按 `permission` 兜底（值域闭合） |

## pr-002 · Q1~Q3 —— **三项按推荐**

| # | 处置 |
|---|---|
| Q1 | `required: false` + `desc` 分说明（同 MI-c） |
| Q2 | `text` **保持既有 `.trim()`**（permission 类逐字不变；question 类同样 trim，并在 `API.md` 记明） |
| Q3 | `API.md` 新增文字**尽量压缩**以落在 `call-protocol.test.js` 的绝对行号窗口容忍区间内（保持该测试文件零改动）；**若实测无法满足 ⇒ 停下来报告主 agent**，不得自行修改该测试文件 |

---

## 主 agent 补充裁定（非用户决策点）

1. **pr-001 判据口径澄清 ①**：PR 文件把「rpc 无收件人（自动拒绝）」列在 `confirmation-roundtrip.test.js` 迁移项下，但实读该文件为 acp-only 面且全仓无该 rpc 分支的既有断言 ⇒ 属**新增断言**而非迁移；落在 `protocol-layer.test.js`（rpc 单元面所在），两文件同属 T11。
2. **判据口径澄清 ②**：验收 1 的机械判据读作「对**已解析档位值** `spec.approval` 的赋值面恰一处」；`config.js` 与 `parseAgentArgs` 的**输入面校验**出现取值域字面不违反唯一汇聚点（「三实现零档位字面」限定在 `rpc-client` / `acp-client` / `oneshot-client`）。
3. **判据口径澄清 ③**：`acp-daemon.test.js` 的档位涉及行以实读为准（`:559` / `:570` / `:581` / `:588` / `:595`），T12 已逐行枚举防漏迁。
4. **Gate 义务**：G2-D1（`config.js` 锚点 `:49`）/ G2-D2（`protocol-layer.test.js:535` 必须迁移）/ G2-D4（`hostTools` → 已接线 + note 陈述事实；`approvalGate` 不随档位变）已逐字纳入任务图。
