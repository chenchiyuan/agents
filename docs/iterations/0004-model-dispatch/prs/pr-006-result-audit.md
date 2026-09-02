# PR-006：结果归一化与运行记录审计

## 上下文摘要
本 PR 把启动前阻断、启动后失败和成功统一归一化为三态结果，保留 requested/selected 与 fallback 审计，并先同步回主 agent、再按业务项目归属写入 `.pb-agents/project/` 运行记录。记录格式、命名、查询入口和序列化方式不预设，不引入数据库、缓存或队列。

## 涉及 tasks

- T06

## 文件范围

- 未来运行时的“三态结果归一化与项目运行记录审计”专属文件或宿主接入点（记录承载和序列化由主 agent 根据实际代码确定；仅限 T06，不声明 ACP adapter、主 agent 决策或全链路验证文件）

## 验收标准

- [ ] status 仅为 `completed`、`failed`、`blocked`；completed 表示已执行并保留 result。
- [ ] 已启动执行错误归一为 failed；未启动且无可交付结果归一为 blocked，不伪造启动结果。
- [ ] 每条结果保留 role、requested/selected 双目标；fallback 时保留 `fallback_applied=true`、原始有序 chain、降级原因和 selected。
- [ ] 未 fallback 时为 `fallback_applied=false` 且不虚构 fallback_reason；blocked/failed 有可诊断 reason，completed 有 result。
- [ ] 归一化结果先同步返回主 agent，再写入 `.pb-agents/project/`；记录至少含 status、role、双目标、fallback chain/reason 及 result/reason，且不回写配置或框架 copy。
- [ ] 启动后 failed 不触发模型切换或自动重跑。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T06、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§文件范围验证
- `principles/execution/model-dispatch-protocol.md`（只读结果字段基线）
