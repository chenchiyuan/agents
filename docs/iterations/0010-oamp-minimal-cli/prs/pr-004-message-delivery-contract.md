# PR-004：消息投递闭环契约测试（send/deliver/ack）

## 上下文摘要

本 PR 交付 F07 的**可执行形态本身**（P-01 契约先行）：test/helpers/fake-node.js（脚本级假节点 = 复用 pr-002 的 NodeClient + `onDeliver(msg)` 断言钩子，可记录/校验/延迟 ack，进程内运行，§10.1/D12）+ test/delivery-contract.test.js（双假节点跑通 register→send→deliver→ack→heartbeat 闭环 + 真实 agent 子进程受理用例）。消息域的**实现代码**（router.js 的 message.send/deliver/ack 分发、registry.js 的 pendingDeliveries 等待集与 ack 校验、node-client.js 的 send/ack 与 deliver 自动受理、log.js 的 MESSAGE_DELIVERED/MESSAGE_ACKED 事件）按"src 文件首次创建即完整"约束已随 pr-002 一并落盘（同一批文件的 dispatch/状态/客户端承载两域，无法文件级拆分），本 PR 常规范围只新增测试载体；另含 **跨 PR 修正（Q-1，经主 agent 裁决）**：实现期发现 pr-002 落盘的 router.js/registry.js 投递竞态——deliver 应答后 recordPending 与目标 ack 处理存在竞态窗口，ack 先到查 pending 未命中 → 误回 `UNKNOWN_MESSAGE` 丢 ack；裁决修复 = recordPending 前置 + ack 路径 clearPendingDelivery 失败回滚（保持 §5.5 等待集语义）。修正改动 pr-002 已落盘文件，与 cli.js 跨 PR 修正先例同型，随本 PR merge 进入迭代分支。

## 涉及功能点

- F07（delivery-contract.test.js：闭环全链路/信封 message_id 端到端贯通一致/payload 保真/方法面最小集覆盖/ack 校验与错误映射/真实节点自动受理）

## 文件范围

- oamp/test/helpers/fake-node.js
- oamp/test/delivery-contract.test.js
- oamp/src/router.js（跨 PR 修正 Q-1：recordPending 前置）
- oamp/src/registry.js（跨 PR 修正 Q-1：clearPendingDelivery 失败回滚）

## 验收标准

- [ ] delivery-contract.test.js 在 `oamp/` 下 `node --test test/delivery-contract.test.js` 全绿（缩短 env + harness 临时 socket）：双假节点注册 → 发送方 message.send → Router deliver 至目标 → 目标回 message.ack → 双方继续心跳，全链路无错误（F07-1/4）
- [ ] 同一消息的 message_id 在 send 提交 → deliver 到达 → ack 回执全链路贯通一致、可关联（F07-2/P-09）
- [ ] 目标收到的消息负载与 send 提交的一致（payload 保真、含 Router 代填的 from/created_at），目标可还原发送内容与发送方（F07-3/§4.5）
- [ ] ack 校验与错误映射：目标对未知 message_id 回 ack → `UNKNOWN_MESSAGE`；发送方连接未注册即调 send → `UNREGISTERED`；目标不在注册表 → `AGENT_NOT_FOUND`；目标离线/连接已断 → `AGENT_OFFLINE`——均同步拒绝（§4.3/§4.4）
- [ ] 真实 CLI agent 子进程（pr-002 agent 栈）被 send 投递时同样受理：回传输应答 + 自动回 ack(accepted) + 打 MSG_RECEIVED 事件（§6.4/D12/§10.1 真实 agent 用例），证明真实节点与假节点协议行为结构一致

## 参考资料

- docs/iterations/0010-oamp-minimal-cli/prd/F07-message-delivery-contract.md
- docs/iterations/0010-oamp-minimal-cli/architecture.md §4.4~4.6（方法面/信封/错误映射）、§5.5（投递等待集）、§6.1/§6.4（NodeClient/自动受理）、§10.1（假节点形态）、D10~D12

## depends_on

- pr-002-protocol-runtime-registry-heartbeat.md（理由：
  ① fake-node.js 直接复用 pr-002 的 src/node-client.js（register/heartbeat/send/ack/deliver 自动受理）并叠加 onDeliver 钩子——§10.1 明确定义假节点 = NodeClient + 断言钩子，模块引用证据 = fake-node.js import node-client.js，node-client.js 属 pr-002；
  ② delivery-contract.test.js 的闭环对手方是 pr-002 的 router.js 消息分发与 registry.js pendingDeliveries（§4.4/§5.5），并由 pr-002 的 harness.js 拉起 Router（§10.2）；
  ③ 真实 agent 受理用例经 pr-002 的 agent.js/node-client.js 子进程执行（§10.1）；本 PR 常规新增 = helpers + 契约测试，另含 Q-1 跨 PR 修正（recordPending 前置 + clearPendingDelivery 失败回滚，见上下文摘要）改动 pr-002 的 router.js/registry.js——修正对象属 pr-002 文件本身即依赖 pr-002 的直接证据）

## batch

3
