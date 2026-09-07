# architect — 精选记录索引

> 每行对应 data/ 下的一条原始凭证，目标是"每行都值得展开读"。

- [创建反射依据](data/architect-creation-reflection.md) — 为什么是"见过过度抽象血案的架构师"、L1/L2/L3 决策分级的来源、奥卡姆剃刀为什么是核心约束
- [0007 history.md 决策记录](data/0007-history-log-decision-notes.md) — 创建时机选"启动时立即创建"而非惰性创建（可观测性优先）；并发顺序保真不引入序号字段，依赖"记录写入永远单线程顺序、并发只发生在子agent执行层"这一技术事实
