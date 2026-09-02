# PR-008：全链路派发契约矩阵验证

## 上下文摘要
本 PR 在前序语义边界落地后执行全链路契约矩阵验证，覆盖配置、解析、fallback、ACP、结果/审计及主/子 agent 权责，并证明调用顺序与范围外禁止事项。验证 runner、替身 executor/能力报告和数据承载由主 agent 根据实际代码确定；不依赖真实 provider secret 或新服务。

## 涉及 tasks

- T08

## 文件范围

- 未来运行时的“全链路派发契约矩阵验证”专属验证 runner、替身/夹具和矩阵用例文件（具体路径与数据承载由主 agent 根据实际代码确定；仅限 T08，不声明前序 PR 的生产边界文件或通用契约基线文件）

## 验收标准

- [ ] 矩阵覆盖无配置默认、非法配置快速失败、secret 拒绝/隔离及非法/阻断场景不调用 ACP。
- [ ] 矩阵覆盖 main/subagent 作用域、role 生效、仅覆盖 executor、仅覆盖 model、同时覆盖两字段及 requested 双目标。
- [ ] 矩阵覆盖同 executor 有序去重 fallback、默认链尾、executor 不可用、全候选不可用不启动及 selected/blocked 原因。
- [ ] 矩阵覆盖 ACP 请求/响应必需字段、三态、双目标、fallback 审计及 CLI 私有映射隔离。
- [ ] 矩阵覆盖 completed/failed/blocked、降级链和原因、未启动无执行结果、启动后 failed 不自动换模、主 agent 同步和 `.pb-agents/project/` 记录。
- [ ] 矩阵覆盖 secret 隔离、subagent 不改配置/换模型、实际目标和边界问题报告及主 agent 显式再次派发决定。
- [ ] 验证证明顺序为配置 → 解析 → fallback → ACP → 结果/审计 → 主 agent 决策，且不存在 executor 切换、静默重跑、服务/队列/缓存/数据库等越界路径。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T08、§1.2、§2、§9
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§验证目标
- `principles/execution/model-dispatch-protocol.md`（只读全链路协议基线）
