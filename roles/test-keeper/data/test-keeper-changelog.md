# test-keeper.md 变更历史

## v0.1.0（2026-09-17）

**需求**：新建角色 `test-keeper`，补上 `docs/iterations/0026-test-protocol-and-suite-reset/` 里被整块后置的测试协议（Q15）与暂留的横切角色空缺（Q10）。用户补充了三点 0026 未覆盖的细节：三级分级（L1 PR 内必测 / L2 项目冒烟 / L3 全局回归）、语言栈反射（不锁定 node/python）、workflow-pb 的接入方式。

**变更原因**：新文件，无前版本。测试编写是"参与建设"，不能挂到 verifier 上——verifier 的核心资产是独立鉴定人格，混入会污染判断纯度。

**决策过程**：
- 角色定位选"新增角色"，否决"挂靠 verifier"
- 阶段 5 协作选"不参与派发循环，L1 仍由 dev 自己写"（`roles/dev/dev.md` 现有例外条款已覆盖），否决"dev + test-keeper 协作同一 PR 简报"
- 沉淀判据延续 0026 Q3：必要性（跨迭代契约意义）为主判据；软性墙钟预算只是追加的退化信号，不阻塞交付。否决硬性时长上限
- identity 的"交叉稀缺"连续 3 轮独立验证不通过后，用户裁决按 pr-planner 同等标准（软件工程内部两个稀少子领域的组合即可）；第 4 轮定为"测试基础设施治理 + 平台级 SLO/可观测性治理"并通过

**具体改动**：
- 新建 `roles/test-keeper/test-keeper.md`（v0.1.0）：职责、判断框架、自闭环、工具边界、报告契约
- 新建 `data/testing-protocol.md`（v1.0.0）：三级分级、沉淀判据、语言栈反射、软性墙钟预算的唯一权威定义
- 新建 `data/testing-protocol-baseline.md`：L3 运行基线表，初版无记录
- 新建 `data/test-keeper-creation-reflection.md`：反射三步、已否决方案、identity 验证踩坑
- `roles/workflow-pb/workflow-pb.md` 升到 v0.14.1：只加可选触发索引（阶段 5 后 L2、阶段 6 前 L3），不改阶段推进条件，不复制协议条款
- `.claude/skills/workflow-pb/SKILL.md` 升到 v1.15.2：同步索引，并更正此前滞后的规范版本引用（v0.13.1 → v0.14.1）

**不改变的部分**：`roles/dev/dev.md`、`roles/verifier/verifier.md`；阶段 5 / 阶段 6 的强制推进条件；不引入 CI、git hook 或第三方测试依赖。
