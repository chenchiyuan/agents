# F02 — commit-planner 角色文件

**功能 ID**: F02  
**来源**: demand.md §最小边界 #2  
**迭代**: 0003-workflow-scm

---

## 用户价值

提供一个专职角色，将 `tasks.md` 全自动转化为结构化的 PR/worktree 规划，消除人工分组的认知负担。

---

## 验收标准

1. 存在文件 `roles/commit-planner/commit-planner.md`，文件可独立读取。
2. 文件 frontmatter 中 `name: commit-planner`，`description` 字段非空。
3. 文件内明确声明：
   - **输入契约**：接收 `tasks.md`（路径由工作流定义获取）。
   - **输出契约**：产出 `prs/` 目录（含 Issues 分组文件和每个 PR 的独立文件），路径规则与 F03 一致。
   - **执行模式**：全自动（不需要人工干预中间步骤）。
4. 文件内包含 worktree/branch 创建的规格说明（命名规则、创建时机），该说明足够让执行者不产生歧义。
5. 文件包含报告契约：任务完成后回报产出的 `prs/` 目录文件列表和每个 PR 的摘要。
6. 文件版本字段 ≥ 0.1.0，创建日期字段存在。

---

## 边界（不包含）

- 不要求角色文件包含 Git 命令的具体实现（只定义规格，不定义执行方式）。
- 不要求角色处理 CI/CD 触发（本迭代范围外）。
- 不要求角色处理 PR review 分配（本迭代范围外）。
- 不包含对现有 dev 或 verifier 角色文件的修改。

---

## 架构维度

**AR-02 已填（2026-09-02）**

commit-planner 与 dev 是同级执行角色，都由主 agent 派发，不直接通信。调度序列：

1. 主 agent dispatch commit-planner，brief 包含 tasks.md 路径和 workflow-scm.md 路径
2. commit-planner 完成后回报 prs/ 文件列表及每个 PR 摘要
3. 主 agent 按列表顺序逐一 dispatch dev，每次 brief 仅包含单个 PR 文件路径
4. 主 agent 按 PR 粒度追踪 dev 进度

此模式是现有"主 agent 持有全局调度视图，执行角色只看单个 brief"的直接延伸，不引入新调度机制。

见 `architecture.md §四 AR-02`。
