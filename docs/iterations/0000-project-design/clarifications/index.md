# 澄清记录索引

## mvp-scope
- [Round 1](mvp-scope/round-1.md) — 五层能力（原则/构造器/协议/协作/反思）顺序启动；首个真实 agent 定为 pb-v1-implementing — caller: pb-v1-talk — 2026-09-01

## protocol-depth
- [Round 1](protocol-depth/round-1.md) — harness loop 走文档约定非代码框架；角色目录结构 `<role>/{<role>.md,memory.md,data/}`；原则分元原则/执行原则两层，项目级共享+角色级引用 — caller: pb-v1-talk — 2026-09-01

## subagent-collaboration
- [Round 1](subagent-collaboration/round-1.md) — 复用已有工具的 Agent/Task 机制，不新建 ACP 通信协议层 — caller: pb-v1-talk — 2026-09-01

## cross-project-reuse
- [Round 1](cross-project-reuse/round-1.md) — 复用形式为 github clone + 安装指令；agents 与 powerby-skills 是独立项目，一次性借鉴初始化，非持续同步 — caller: pb-v1-talk — 2026-09-01

## data-storage-protocol
- [Round 1](data-storage-protocol/round-1.md) — .pb-agents/（只读copy）+.pb-agents/project/（镜像结构运行记录）+docs/iterations/（迭代产物）三分法；copy单向可更新（agents PR流程）；copy范围：role.md+principles+可选tools/skills；归档由retrospective识别+用户主动双触发 — caller: pb-v1-talk — 2026-09-01
- [Round 1](model-dispatch-protocol/round-1.md) — 默认主/子 agent 均为 `omp + gpt`；项目配置位于 `.pb-agents/config/agent-routing.yaml`；role 路由只对子 agent 生效；采用显式 fallback 链和统一 ACP 派发契约 — caller: pb-v1-talk — 2026-09-02

## minimal-role-closure
- [Round 1](minimal-role-closure/round-1.md) — 6角色闭环：backend=dev重命名；demand.md两段结构（澄清依据+proposal级结论）；无独立reviewer（主agent承担质量门）；prd二级结构（prd.md索引+prd/*.md明细）；verifier由主agent委托触发、反射验证者、结果记录 — caller: pb-v1-talk — 2026-09-01
