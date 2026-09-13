# pr-004：控制台第三栏（待确认 inbox）与浏览器通知

## 上下文摘要

控制台侧落地：`main.layout` 内新增第三栏（静态节点 + 三栏样式，窄屏折叠为可开合面板），`app.js` 订阅全局 `confirmation` 帧、渲染条目并**点选即提交**裁决、每次 `onopen`（含重连）重建在途列表；新建 `notify.js`（服务层「什么事件该通知」/ 通道层「怎么投递」两层分离，首通道 = 页面内 Notification API，权限未授予静默降级）。**不含既有测试断言改写**（既有前端断言均为包含式匹配，不与之相撞；新断言落新文件）。**不承载 M4 答复链路修复**（M4 落 pr-001）。约束：零新依赖 / 零构建 / 不新建页面或路由 / 不新增通道外的入口载体；裁决在栏内完成，通知只负责「叫一声」，不承载关键动作。

## 涉及功能点

- F01
- F03
- F06
- F07
- F08
- F09

## 文件范围

- `oamp/web/notify.js`（**新建**：`service` 层（事件类型常量 + 文案表 + 是否通知的判定）与 `channel` 层（`deliver(intent)`，首个通道 = 页面内 Notification API，权限 / 环境缺失时降级））
- `oamp/web/index.html`（修改：`<main class="layout">` 内新增第三栏静态节点〔检索式 `class="layout"`、`class="sidebar"`、`class="detail"`〕；引入独立脚本〔检索式 `/app.js`〕）
- `oamp/web/app.js`（修改：全局 SSE 订阅段增加 `confirmation` 分支〔检索式 `connectAgentEvents`、`addEventListener('agent_online'`〕；在途列表重建挂到 `onopen`〔检索式 `source.onopen`、`refreshChat`〕；第三栏渲染 / 提交 / 失效移除；三类事件的通知派发调用点）
- `oamp/web/style.css`（修改：三列布局与第三栏样式、窄屏折叠规则〔检索式 `.layout`、`grid-template-columns` 或 flex 列宽、`@media`〕）
- `oamp/test/inbox-console.test.js`（**新建**：前端静态契约断言，体例同既有前端静态契约测试）

## 验收标准

- [ ] `GET /notify.js` 返回该文件（非 404），`index.html` 以**独立** `<script>` 引入（不并入 `app.js`）。
- [ ] **服务 / 通道分离可静态判定**：`notify.js` 中事件类型常量仅含 `chat_completed` / `chat_failed` / `confirmation_required`（**无** `call_completed`）；`service` 段内**零** `Notification` 标识符，`channel` / `deliver` 段内**零**事件类型字符串。
- [ ] 控制台打开后（非默认端口拉起 oamp web + agent）：一条确认项（**构造样本**：合成一条 `confirmation_request` 投递给 web；或**真实样本**：`allow` 档 agent 真实上浮）**无需刷新**即出现在第三栏，条目含①来源对话标识（`chat_id` 或既有标题，取不到即回落 `chat_id`，不额外拉取）、②工具名 + 动作描述、③每个选项一个按钮 + 一个文本输入框。
- [ ] **点选即裁决**：点击任一选项按钮即以 `{option_id, text}` 提交，提交中按钮 `disabled`；成功后该条**立即**移出栏内（在 `POST` 的 200 上，不等 SSE）。
- [ ] **刷新 / 断线重连后仍在**：栏内有未裁决项时刷新页面 → 该条仍在且内容一致（条目存在 + 来源 / 操作 / 选项集合一致，**不判**栏内顺序与位置）；断开连接后恢复（含 `EventSource` 自动重连）→ 同上；已裁决项**不**回到栏内。
- [ ] **布局与边界**：第三栏是既有 `<main class="layout">` 内的兄弟节点，位于对话列表与对话详情之间；窄屏（`max-width: 1100px`）下折叠为可开合面板且**仍可达**（一个点击，不消失、不做横向滚动）；**未**新增页面 / 路由 / 顶栏抽屉 / 左栏过滤器 tab。
- [ ] **三类事件各触发一次浏览器通知**（权限已授予时）：`chat_completed` / `chat_failed` 由全局链路上的对话终态帧派生——**停在其他对话甚至项目列表页也能收到**；`confirmation_required` **仅在确认项首次入栏时**通知一次，刷新 / 重连重建**不**重复通知；hub 调用面完成（`call_result`）**不**产生通知。
- [ ] **降级**：`Notification.permission === 'denied'` 或环境无 `Notification` 时静默不投递（不弹横幅、不提示、不重试），且不影响第三栏与事件类型契约；页面加载时**不**主动请求权限（`'default'` 时按未授权处理，直到用户在页面上产生一次手势）。
- [ ] 通知的 `onclick` 不可用时（部分平台）关键动作仍在栏内可完成（通知不承载唯一入口）。
- [ ] `node --test oamp/test/inbox-console.test.js` 全绿。

## 参考资料

- docs/iterations/0021-confirmation-inbox-and-event-push/architecture.md（§2.1 组件图、§2.2 流 1 / 流 3、§2.3 接缝、§2.4、§3.1 L1-4、§3.2 L2-2 / L2-5 / L2-6 / L2-8 / L2-9、§4.2 M-7 / M-8 / M-11、§4.3 Z-6、§5.2、§5.5、§7 T-01 ~ T-04 / T-07 / T-09 ~ T-14、§9.2 K1）
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F01-confirmation-inbox-column.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F03-inbox-decision-interaction.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F06-in-flight-visibility.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F07-notification-event-types.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F08-notification-delivery.md
- docs/iterations/0021-confirmation-inbox-and-event-push/prd/F09-service-channel-separation.md
- docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/arch-round-1-verdicts.md（L1-4 裁决）

## depends_on

- pr-003-web-inbox-and-decision-api.md（理由：① 本 PR 消费 pr-003 新增的两条路由与一类全局事件——`GET /api/confirmations`（首屏与每次 `onopen` 重建的数据源）、`POST /api/confirmations/<id>/decision`（提交裁决）、`GET /api/events` 上的 `confirmation` 帧；pr-003 之前这些端点不存在（404）且全局链路上无该类帧，本 PR 的「无需刷新入栏 / 重建 / 提交裁决」验收全部无法成立。证据：`oamp/src/web.js` 的 `createApiRoutes` 表末位新增表项与该文件内 `transport.publishGlobal({ type: 'confirmation', … })` 是该帧的唯一发布点。② 新建文件 `oamp/web/notify.js` 必须命中 `oamp/src/web.js` 的 **`STATIC_FILES` 显式白名单**（`'/app.js': 'web/app.js'` 形态、无通配、无目录索引、无兜底），否则 `index.html` 的 `<script src="/notify.js">` 恒为 404——该白名单表项由 pr-003 添加）

## batch

2
