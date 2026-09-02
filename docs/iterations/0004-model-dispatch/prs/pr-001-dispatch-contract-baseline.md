# PR-001：派发协议语义契约基线

## 上下文摘要
本 PR 把既有模型派发协议和架构中的不可变语义整理为后续实现可消费的契约基线，覆盖双目标、配置缺失/非法区分、调用顺序、ACP 请求/响应字段及凭据边界。仅建立断言、夹具或等价验证承载，不创造新协议，不锁定实现库、传输方式或运行时路径。

## 涉及 tasks

- T01

## 文件范围

- 未来运行时的“派发协议语义契约基线”专属断言、契约描述或最小夹具文件（具体文件路径和承载方式由主 agent 根据实际代码确定；仅限 T01，不声明其他 PR 的实现或全链路矩阵文件）

## 验收标准

- [ ] 契约明确 `executor` 与 `model` 是独立维度，并区分 fallback 前的 `requested` 与实际启动的 `selected`。
- [ ] 契约区分配置缺失和配置非法：缺失才允许内置 `omp + gpt`，非法必须在启动前快速失败并携带诊断上下文。
- [ ] 契约明确顺序为配置 → 解析 → fallback → ACP → 归一化/记录 → 主 agent 决策，且启动后失败不得由派发边界静默重跑。
- [ ] 请求和响应契约覆盖协议版本、role、双目标、剩余 fallback、brief、working directory、三态、降级审计及结果/原因。
- [ ] 契约验证不要求或处理 provider secret，能力判断仅依赖本地 executor/ACP 的 opaque 能力报告。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T01、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§验证目标
- `principles/execution/model-dispatch-protocol.md`（只读协议基线，按 tasks.md 指定）
