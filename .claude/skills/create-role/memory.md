# create-role 记录索引

> 每行对应 `data/` 下的一条原始凭证，目标是"每行都值得展开读"。

- [反射意图落盘偏离](data/reflection-to-file-drift.md) — 反射阶段确认的设计意图，落盘时字面偏离；建议落盘后先逐字核对再进入独立验证
- [独立验证抓到偏移的有效性证据](data/independent-verify-catches-drift.md) — 两次角色创建都验证了"验证不能自证"这条已有原则的必要性
