# PR-002：项目路由配置输入与校验

## 上下文摘要
本 PR 建立项目路由配置边界：从固定 `.pb-agents/config/agent-routing.yaml` 读取输入，区分缺失、合法与非法配置，校验版本/字段/类型，并保护项目配置、框架 copy 和运行记录的归属。加载器、解析库、错误通道及安装升级机制均不预设，由主 agent 根据实际代码确定。

## 涉及 tasks

- T02

## 文件范围

- 未来运行时的“项目路由配置加载、校验与归属保护”专属文件或宿主接入点（具体路径和实现承载由主 agent 根据实际代码确定；仅限 T02，不声明配置解析之外的目标解析、fallback、记录或适配文件）

## 验收标准

- [ ] 路由输入唯一来源为业务项目 `.pb-agents/config/agent-routing.yaml`；文件缺失可提供 `executor=omp`、`model=gpt` 的内置默认。
- [ ] 配置存在时校验语法、`version=1`、必填默认字段、role 字段类型及允许字段，并支持 role 的 executor/model/有序 fallback 表达。
- [ ] 语法、版本、必填字段、类型或允许字段非法时，在启动任务前返回带字段或位置上下文的错误；该路径不按缺失处理且不调用 ACP。
- [ ] 含 API key、token、密码或需 agents 解析的 provider secret 的输入被拒绝或隔离为非路由输入，agents 不管理或保存 secret。
- [ ] 安装/升级不覆盖已有项目路由配置，框架 copy 保持只读归属；运行记录仍归 `.pb-agents/project/`，配置不被回写。

## 参考资料

- `docs/iterations/0004-model-dispatch/tasks.md` §T02、§1.2、§2
- `roles/workflow-scm/workflow-scm.md` §PR 文件格式规范、§文件范围验证
- `principles/execution/model-dispatch-protocol.md`（只读字段基线）
