模型标识：powerby/grok-4.6

验证者身份：服务端接口/协议兼容性审查者（补充：Router 不可达时取件面）
产出物：迭代分支 tip `86bb158`（`git -C …/0030-hub-communication-upgrade rev-parse --short HEAD`）；副本 `/tmp/verify-p005/tip-oamp/`（含 pr-005 接线，无 `pickup.js`）
验证标准来源：主 agent 补充委托三条 + `prs/pr-005-web-inbox-and-pool-wiring-tasks.md` T3 判据 5 / §0.3 A9 / §5 F-4
验证日期：2026-09-17

说明：未采用执行方自证。独立隔离：端口 `17907`、UDS `/tmp/verify-p005/supp.sock`、db `/tmp/verify-p005/supp.db`、假节点 `pb-dev`；未占用 7788 / 主集群。原始读数 `/tmp/verify-p005/supplement.json`。跑后进程已 stop。

登记基线（tasks 文件，供对照）：
- A9（改造前实跑）：有未取件条目 + 停 Router ⇒ `GET /api/pickup` = **502 UPSTREAM_UNAVAILABLE**；`GET /api/agents` = 502。
- F-4 / T3 判据 5（改造后断言）：同上输入 ⇒ **200** 且返回 DB 条目。此为**预期取值变化**，不是回归。

## 逐项判定

- [1] 有未取件条目 + Router 已停：`GET /api/pickup?principal=<该条目 principal>` ⇒ 200 且返回 DB 条目，键序与停前逐字相同：pass
  证据（全链路）：
  - 条目 `call_id=task-a88ce113-c686-48e6-823a-effbca385f88`，principal=`verify-supp-pickup`。
  - **停 Router 前** HTTP 200 原文：
    `{"pickup":[{"call_id":"task-a88ce113-c686-48e6-823a-effbca385f88","requester":"verify-supp-pickup","agent":"dev","chat_id":"chat-0ce82550-8143-4184-91c2-20ef0a770cad","terminal_at":1789637124637,"acked":false,"envelope":{"call_id":"task-a88ce113-c686-48e6-823a-effbca385f88","agent":"dev","state":"completed","duration_ms":11,"model":"fake/model","truncated":false,"text":"ok:pb-dev","structured_output":null,"error":null,"exit_code":0}}]}`
  - **停 Router 后** HTTP 200 原文：与上条 **逐字节相同**（`bodyEqual=true`）。
  - 条目键序两态均为 `["call_id","requester","agent","chat_id","terminal_at","acked","envelope"]`。
  - 层次：全链路。

- [2] Router 已停 + 无未取件条目：同端点 ⇒ 200 + `{pickup:[]}`：pass
  证据（全链路）：principal=`verify-supp-empty`
  - 停前：HTTP 200 `{"pickup":[]}`
  - 停后：HTTP 200 `{"pickup":[]}`
  - 两态 body 逐字节相同。层次：全链路。

- [3] 一致性：同一有件请求在 Router 正常 vs 停两态响应体比较：pass
  证据：`text` 逐字节相等；`JSON.stringify` 相等；条目对象相等。**差异列表：空**（无必然变化项需要剔除）。层次：全链路。

- [边界] Router 停时 `GET /api/agents` 仍为 502（确认本接线未把该面一并改掉）：pass
  证据：
  - 停前：HTTP 200（agents 列表，含 `pb-dev` online）。
  - 停后：HTTP **502** 原文 `{"error":"router 不可达或请求失败: connect ENOENT /tmp/verify-p005/supp.sock","code":"UPSTREAM_UNAVAILABLE"}`
  - 与 A9 基线「`GET /api/agents` = 502」相符。层次：全链路。

## 汇总
- pass：4（委托 3 条 + 边界 1 条）
- fail：0
- partial：0
- blocked：0

## 与 tasks 登记基线的相符性
- 改造后断言（T3-5 / F-4）：**相符**（有件 502→200 的预期变化已实测成立）。
- 改造前 A9 的 agents=502：**仍成立**（未误改）。
- 空未取件 + Router 停：tasks 未单独写空态，实测 200 `{pickup:[]}`，与「只读 DB、不再 `task_get`」一致。

## 偏差记录
无

## 下一迭代候选
无

## 结论
PASS
注：偏差记录不影响结论判定。
