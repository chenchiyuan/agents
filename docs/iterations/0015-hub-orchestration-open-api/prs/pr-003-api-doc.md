# pr-003-api-doc

## 上下文摘要

交付可独立接入的接口文档：新建 `oamp/API.md`（6 章：概览与安全边界 / 统一约定与 `{error, code}` 错误契约 / 10 条接口逐条含参数·成功响应·完整错误清单 / 事件流（`/api/stream` 4 类 + `/api/events` 2 类）/ 6 组原样可粘贴示例 / 不做项），并同步 `oamp/README.md` 四处（Web 控制台段一句、HTTP 表 `+/api/events` 行与 `?state=online` 标注 + 统一错误契约一句 + 指向 `API.md` 的链接、SSE 事件段 4→6 类、环境变量表两行说明）。清单以代码为唯一真源逐条对照，不做第二套定义。

## 涉及功能点

- F07

## 文件范围

- oamp/API.md（新建）
- oamp/README.md（修改）

## 验收标准

- [ ] `oamp/API.md` 存在，且 `oamp/README.md` 的 HTTP 段（现 `:151-162`）中有指向它的链接，链接可点开（F07 验收 1）
- [ ] 接口清单覆盖 10 条 API（既有 9 条 + `GET /api/events`），每条含方法 + 路径、参数表（类型 / 必填 / 默认）、真实 JSON 成功响应示例、该接口**会出现的全部 `code`** 的错误清单（F07 验收 2、3；与 `oamp/src/web.js` 路由集合逐条对照，不重不漏）
- [ ] 统一约定章节含 `{error, code}` 形态 + 5 行状态码映射表（`INVALID_PARAM`=400 / `NOT_FOUND`=404 / `CONFLICT`=409 / `PAYLOAD_TOO_LARGE`=413 / `UPSTREAM_UNAVAILABLE`=502）+"同类错误跨接口一致"一句，且错误章节与 `oamp/src/web.js` 的 `ERR_CODE` 五个键一一对应（F07 验收 3）
- [ ] 事件章节含 `/api/stream?chat_id=<id>` 的 4 类事件（名 / 载荷 / 触发时机 / 不入库说明）与 `/api/events` 的 2 类事件（`agent_online` / `agent_offline` / 载荷 / 判定源 / ≤2s 时延 / "订阅后先取一次 `GET /api/agents` 作基线、重连后重取"），并说明 `retry: 1000` 与 15s keepalive；共 6 类事件与 `transport.publish` + `publishGlobal` 的调用点逐条对照（F07 验收 4）
- [ ] 6 组示例原样复制可执行（唯一占位符为 `<chat_id>` 与示例实例名）：① `curl -s …/api/agents?state=online`；② 列对话 + 搜索；③ 读消息；④ 发消息（`model` / `one_shot` 两个变体）；⑤ `curl -N …/api/stream?chat_id=<id>`；⑥ `curl -N …/api/events` + 另一终端 `oamp agent start demo-1` ⇒ 订阅端出现 `agent_online`（F07 验收 5、6）
- [ ] `README.md` 四处同步到位且与 `API.md` 不冲突（同路径同形态）：Web 控制台段（现 `:119-143`）+"顶栏计数可点击展开在线 agent 列表（实例标识 / 在线状态 / 最后心跳时间），随上下线自动更新"一句；HTTP 表 `GET /api/agents` 行标注 `?state=online`、新增 `GET /api/events` 行、表后补统一错误契约说明 + `API.md` 链接；SSE 段（现 `:164-165`）事件清单 4 → 6 类；环境变量表（现 `:80-81`）两行说明（`OAMP_HEARTBEAT_INTERVAL_MS` 补"空闲档 = 6× 该值"、`OAMP_HEARTBEAT_TIMEOUT_MS` 补"为**基准**阈值：已通告间隔的实例按其 2× 抬升"）（F07 验收 1、3；架构 §9.3）
- [ ] E9 反向检索零命中：`API.md` 与 `README.md` 中不存在 agent 启停接口 / 按钮、鉴权、跨机、tasks、客户端 SDK 条目（F07 边界；架构 §9.4 检查项 4、5）

## 参考资料

- docs/iterations/0015-hub-orchestration-open-api/architecture.md（§5 错误契约全表 / §6.1 接口清单与对照表 / §6.3 暴露边界 / §6.4 API.md 章节结构与内容下限 / §9.3 README 同步范围 / §9.4 一致性检查项 / §10 D-17 / §15.3 G4）
- docs/iterations/0015-hub-orchestration-open-api/prd/F07-api-doc.md（验收 1~6 + 架构维度）
- docs/iterations/0015-hub-orchestration-open-api/prd/F04-open-api-surface.md（验收 1 的接口对照表）
- docs/iterations/0015-hub-orchestration-open-api/prd/F06-unified-error-contract.md（验收 2 的逐接口错误清单）
- docs/iterations/0015-hub-orchestration-open-api/prd/F01-agent-list-panel.md（README Web 控制台段同步依据）

## depends_on

- pr-001-heartbeat-two-tier.md（理由：README 环境变量表两行说明描述的是 pr-001 引入的派生字段与阈值公式，本仓库当前不存在 —— 证据：`oamp/src/config.js:19-24` 的 `NUMERIC_DEFAULTS` 与 `loadConfig` 返回值中无 `heartbeatIdleMs`，`oamp/src/registry.js:111-118` 的 `findExpired(now, timeoutMs)` 是单一固定阈值参数、无按实例推导；`oamp/README.md:80` 现仅写"心跳周期（毫秒）；正整数"，`:81` 现仅写"租约超时（毫秒）；正整数；建议 ≥ 2×interval"。缺 pr-001 则这两行无法写出准确语义）
- pr-002-open-api-and-agent-panel.md（理由：`API.md` 的接口 / 错误 / 事件三清单必须与 pr-002 引入的路由集合、`ERR_CODE`、`publishGlobal` 调用点逐条一致，README 的 HTTP 表与 SSE 段按 pr-002 的最终形态改写 —— 证据：`oamp/src/web.js` 现路由表（`:378` `/api/agents` 逐字透传 `router.status`、`:383` / `:403` / `:413` / `:434` / `:463` / `:483` / `:521` / `:530` + `:619` 兜底）**不含 `/api/events`**、无 `?state=online` 过滤；现错误出口均为单字段体 `sendJson(res, <4xx>, { error })`（`:397` / `:407` / `:417` / `:471` / `:496` / `:500` / `:510` / `:515` / `:524` / `:548` / `:552` / `:557` / `:564` / `:621`），无 `ERR_CODE` / `sendError`；`oamp/src/transport.js:12-60` 的 `subscribers` 只有 chatId 键、无 `publishGlobal` / `globalCount`；README 的 Web 控制台段（`:119-143`）现无"顶栏可点开列表"一句、HTTP 表（`:154-162`）无 `/api/events` 行 —— 这四处符号与形态均由 pr-002 产出）
- 二者合并后才可判定：本 PR 的验收标准均以"pr-001 与 pr-002 合并后的迭代分支"为判定基准（文档描述的是最终代码形态），因此两条依赖都是真实的前置，不是文档章节顺序的转述。

## batch

2
