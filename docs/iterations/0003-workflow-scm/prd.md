# prd.md — 0003-workflow-scm

**版本**: 0.1.0  
**迭代**: 0003-workflow-scm  
**创建日期**: 2026-09-02  
**阶段**: 功能规格（Phase 2）  
**来源**: demand.md（0003-workflow-scm）

---

## 功能点索引

| ID | 功能名 | 用户价值摘要 | 规格卡 | model_inferred | 架构待填 |
|---|---|---|---|---|---|
| F01 | workflow-scm 工作流规范文件 | 为所有代码提交提供统一 git 层宪法 | [F01](prd/F01-workflow-scm-definition.md) | — | 文件存放路径 |
| F02 | commit-planner 角色文件 | 将 tasks.md 全自动转化为 PR/worktree 规划 | [F02](prd/F02-commit-planner-role.md) | — | 与 dev 的调度关系 |
| F03 | PR 上下文文件规范 | 为每个 PR 提供标准化单一上下文来源 | [F03](prd/F03-pr-file-specification.md) | PR ID 命名格式 | 任务 ID 映射结构 |
| F04 | workflow-pb 阶段扩展 | 强制在实现前完成提交规划 | [F04](prd/F04-workflow-pb-phase-extension.md) | — | — |
| F05 | verifier 验证目标扩展 | 通过工作流契约扩展 verifier 的验证范围 | [F05](prd/F05-verifier-extension.md) | PR 粒度上限；文件范围一致性判断方式 | verifier 调用机制 |
| F06 | SCM 强制约束声明 | 使 worktree+PR 成为不可绕过的工作流约束 | [F06](prd/F06-scm-constraint-declaration.md) | — | — |

**合计**：6 个功能点

---

## 本次迭代边界说明

### 包含

- workflow-scm 工作流文件的创建（定义 + 不变量 + 阶段规格）
- commit-planner 角色文件的创建（定义 + 输入输出契约 + 执行规格）
- PR 文件格式规范的定义（字段 + 路径规则 + 命名规则）
- workflow-pb.md 的阶段扩展（插入 Phase 5，原 5/6 顺移为 6/7）
- verifier 验证目标扩展（通过工作流契约，不修改 verifier 角色文件）
- SCM 强制约束声明（worktree+PR 不变量）

### 不包含

- CI/CD 流水线配置（需求明确排除，阶段 0）
- GitHub/GitLab API 对接实现（本迭代只做角色/工作流定义）
- 现有迭代的迁移（新工作流从下一迭代生效）
- PR review 分配机制
- 紧急修复豁免机制

---

## model_inferred 列表（需主 agent 确认）

| 编号 | 来源功能卡 | 内容 | 推导依据 |
|---|---|---|---|
| MI-01 | F03 | PR ID 的具体命名格式（纯数字 `01` 还是带描述 `01-add-scm-workflow`） | demand.md 只写 `pr-{id}.md`，未规定 `{id}` 格式 |
| MI-02 | F05 | 每个 PR 关联 tasks 数量的上限值 | demand.md 提到"PR 粒度验证"，未给出数字边界 |
| MI-03 | F05 | 文件范围一致性的判断方式（静态声明对比 vs 运行后比对） | demand.md 提到"文件范围"字段，但未说明验证方式 |

---

## 架构待填列表（技术架构阶段处理）

| 编号 | 来源功能卡 | 内容 |
|---|---|---|
| AR-01 | F01 | workflow-scm 文件存放路径（`roles/workflow-scm/` vs 其他目录） |
| AR-02 | F02 | commit-planner 与 dev 角色的调度关系 |
| AR-03 | F03 | PR 文件与 tasks.md 任务 ID 的 1:N 映射存储结构 |
| AR-04 | F05 | verifier 调用 workflow-scm 验证目标的机制（主 agent 传参方式） |
