# SKILL.md v1.2.0 优化记录

**日期**: 2026-09-03
**触发**: 用户纠正 v1.1.0——修改对象应是 agents 项目本身的 workflow-pb skill（原始版本，即本文件所在位置），而不是别处的副本；并要求补充"roles 会 copy 到项目级 `.pb-agents/` 下"场景中，子 agent 用什么路径加载角色文件的说明。

## 根因

v1.1.0 只在 agents 项目自身开发场景下验证过路径，硬编码了 `roles/<role>/<role>.md`。但按 `docs/memory-system.md` §六 / `README.md` §使用方法/在业务项目中部署 的既定协议，本 skill 部署后会随 `roles/<role>/<role>.md` 和 `principles/` 一起 copy 到业务项目的 `.pb-agents/roles/` 下——角色根路径在两种场景下不同，SKILL.md 之前完全没有处理这个差异，主 agent 在业务项目里跑 workflow-pb 会派发到不存在的路径。

## 改动

- 新增「§ 角色文件路径解析」小节：定义 `{角色根}` 的两种取值（`roles/` vs `.pb-agents/roles/`）及探测方式（`.pb-agents/roles/` 是否存在），并声明只读约束（copy 是只读的，角色的 data/memory.md 不随 copy 部署）
- Step 0 启动流程新增第 1 步：解析角色根路径，会话内复用，不必每次重新探测
- 全文所有硬编码 `roles/<role>/<role>.md`、`roles/workflow-pb/workflow-pb.md` 改写为 `{角色根}/...` 占位表达（Tools and capability boundaries、Workflow、§ 阶段→角色映射、§ Brief 构建规则、§ status.md 更新时机、Resources）
- 新增一条三明治结构的 CRITICAL 前置声明 + Safety 后置检查项，对应"路径解析必须先做"这条新约束
- Brief 构建规则新增"角色文件路径"字段——子 agent 收到 brief 后不必自己猜角色文件在哪，直接拿到解析后的具体路径

## 未变

- 阶段→角色映射表的角色名单不变，只是去掉了表格里之前写死的 `roles/` 前缀路径列（因为路径现在由「§ 角色文件路径解析」统一给出，避免同一信息两处维护）
