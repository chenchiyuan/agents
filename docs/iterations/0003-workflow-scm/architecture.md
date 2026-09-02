# architecture.md — 0003-workflow-scm

**版本**: 0.1.0
**迭代**: 0003-workflow-scm
**创建日期**: 2026-09-02
**对应阶段**: 技术架构（Phase 3）

---

## 一、架构基线

本仓库是纯 Markdown 文档 + shell 脚本，没有运行时系统。当前架构基线：

- `roles/{role-name}/{role-name}.md` — 执行角色文件路径约定，所有执行角色遵循此结构
- `roles/workflow-pb/workflow-pb.md` — 已有工作流文件，存放在 `roles/` 下，与执行角色同级
- `docs/iterations/{编号-迭代名}/` — 每次迭代的产物目录，固定子结构（status.md, demand.md, prd.md, prd/, architecture.md, tasks.md, clarifications/）
- 主 agent 的调度模式：持有全局视图，执行角色只看单个任务的 brief

本次迭代在现有架构上演进，增加：
- 一个新工作流文件（`roles/workflow-scm/`），与 `workflow-pb` 同级
- 一个新执行角色（`roles/commit-planner/`），与 `dev`, `verifier` 同级
- 迭代产物目录中新增 `prs/` 子目录，与 `prd/`, `clarifications/` 同级

无新目录层级，无新技术栈引入。

---

## 二、组件图

```
roles/
├── workflow-pb/
│   └── workflow-pb.md           ← 已有，本次新增 Phase 5（提交规划）
├── workflow-scm/                ← 新建（AR-01）
│   └── workflow-scm.md
├── commit-planner/              ← 新建（AR-02）
│   └── commit-planner.md
├── dev/
│   └── dev.md                  ← 不修改
└── verifier/
    └── verifier.md             ← 不修改

docs/iterations/{编号-迭代名}/
├── tasks.md                    ← 已有（Phase 4 产物），commit-planner 的输入
├── prs/                        ← 新建子目录（AR-03）
│   └── pr-{NNN-描述}.md       ← commit-planner 的输出，dev 的输入单元
└── clarifications/
    └── verify-{timestamp}.md  ← verifier 验证 prs/ 时的输出（AR-04）
```

---

## 三、核心数据流

### 3.1 提交规划流（Phase 5，新增）

```
tasks.md
   ↓
[commit-planner]  输入: tasks.md + workflow-scm.md（分组规格和约束）
   ↓
prs/pr-{NNN-描述}.md × N   每个 PR 对应一个文件
```

commit-planner 全自动执行，完成后向主 agent 回报 prs/ 文件列表和每个 PR 摘要。

### 3.2 实现流（Phase 6，原 Phase 5）

```
prs/pr-{NNN-描述}.md  （单个 PR 文件，含上下文摘要/tasks 列表/文件范围/验收标准）
   ↓
主 agent 按 PR 文件列表逐一派发 [dev]
   ↓
代码变更  在对应 worktree 分支上进行
```

主 agent 按 commit-planner 报告中的文件列表顺序逐一 dispatch dev，每次 brief 中只包含单个 PR 文件路径。

### 3.3 验证流（Phase 7 / 按需触发）

```
prs/ 目录（全部 PR 文件）
   ↓
主 agent 构建 verifier brief:
    产出物路径 = docs/iterations/{id}/prs/
    验证标准  = 内联自 workflow-scm.md §验证目标 的具体条目
   ↓
[verifier]  独立验证 PR 粒度 + 文件范围
   ↓
clarifications/verify-{timestamp}.md
```

---

## 四、架构决策

### AR-01：workflow-scm 文件存放路径

**决策**：`roles/workflow-scm/workflow-scm.md`

**理由**：`workflow-pb` 已在 `roles/workflow-pb/workflow-pb.md`，新建独立顶层目录 `workflows/` 等于引入新的目录层级实体，而 `roles/` 下已有工作流文件的先例。两个工作流同级存放，不产生新目录层级，也不破坏 `roles/` 的现有语义——工作流文件和执行角色文件在本仓库都是"被 agent 读取的规范文件"，区别体现在 frontmatter 的 `name` 字段和 `description` 字段语义上。

**级别**：L2（现有技术栈内，遵循现有路径约定）

---

### AR-02：commit-planner 与 dev 的调度关系

**决策**：主 agent 先完整收到 commit-planner 报告（含 prs/ 文件列表），再按列表顺序逐一 dispatch dev；commit-planner 与 dev 之间不直接通信。

**调度序列**：

```
主 agent
  1. dispatch commit-planner
     brief: tasks.md 路径 + workflow-scm.md 路径
  2. 接收 commit-planner 报告
     报告含: prs/ 文件列表 + 每个 PR 摘要
  3. 按列表顺序，逐一 dispatch dev
     每次 brief: 单个 pr-NNN-描述.md 路径
  4. 接收每个 dev 报告，按 PR 粒度追踪进度
```

**理由**：commit-planner 和 dev 是同级执行角色，都由主 agent 派发，职责不交叉。主 agent 持有 prs/ 文件列表后再按顺序派发 dev，是本仓库"主 agent 持有全局调度视图，执行角色只看单个 brief"模式的直接延伸，不引入任何新的调度机制。

**级别**：L2

---

### AR-03：PR 文件与 tasks.md 任务 ID 的 1:N 映射存储结构

**决策**：映射内嵌在每个 PR 文件的"涉及 tasks"字段中，格式为 Markdown 无序列表（每行一个任务 ID）。无独立映射文件。

**PR 文件"涉及 tasks"字段示例**：

```markdown
## 涉及 tasks

- T01
- T03
- T07
```

**两个读取方向的实现**：
- 给定 PR → 找对应 tasks：直接读 PR 文件中的"涉及 tasks"字段
- 给定 task → 找对应 PR：遍历 `prs/` 目录中的所有 PR 文件（单次迭代 PR 数量预计 < 20，遍历成本可接受）

**理由**：引入独立映射文件增加了"映射文件与 PR 文件内容不一致"的额外维护风险，而收益为零——映射关系本身就应由 PR 文件作为权威来源，不应有第二份复制。

**级别**：L2

---

### AR-04：verifier 调用 workflow-scm 验证目标的机制

**决策**：主 agent 派发 verifier 时，brief 中直接内联 workflow-scm.md 相关章节内容作为验证标准；产出物路径为 prs/ 目录；verifier 角色文件和现有契约不做任何修改。

**brief 结构（示意）**：

```
产出物路径: docs/iterations/{id}/prs/
验证标准:
  [内联自 workflow-scm.md §验证目标]
  1. PR 粒度：预估 diff < 400 行；验收标准可独立判断（不依赖其他 PR 完成）
  2. 文件范围：PR 文件声明的文件范围与 tasks.md 对应任务的实际变更范围核对，
              采用静态声明对比（无重叠、无遗漏）
```

**理由**：verifier 现有契约（`roles/verifier/verifier.md`）定义它接收两件事：产出物路径 + 验证标准。验证标准内联传入是最直接的实现——verifier 不需要新能力，主 agent 也不需要新工具。让 verifier 主动读取 workflow-scm.md 会引入"verifier 读取外部规范文件"这一新模式，与现有"verifier 不接收执行过程上下文"的独立性原则产生歧义（规范文件是"背景上下文"还是"验证标准"的边界会模糊）。

**级别**：L2

---

## 五、奥卡姆剃刀检验

| 新引入实体 | 不引入它，哪个功能无法实现 |
|---|---|
| `roles/workflow-scm/workflow-scm.md` | F01 无法交付——workflow-scm 工作流规范无标准存放位置 |
| `roles/commit-planner/commit-planner.md` | F02 无法交付——无专职角色将 tasks.md 转化为 PR 规划 |
| `prs/` 子目录（迭代产物目录内） | F03 无法交付——PR 上下文文件无标准存放位置 |

workflow-pb.md 的 Phase 5 插入不引入新实体，只编辑现有文件。
verifier 验证扩展不引入新机制，复用现有 brief 传参方式。

---

## 六、无需架构决策的功能点

- **F04**（workflow-pb 阶段扩展）：纯文档修改，编辑现有文件的阶段表，无架构决策。
- **F06**（SCM 强制约束声明）：在 workflow-scm.md 中写入约束章节，无新组件。

---

## 七、L1 决策清单

**无。** 本次迭代所有变更均在现有技术栈和目录结构内完成演进：
- 未引入新技术或新工具
- 未改变现有核心模块（dev, verifier, workflow-pb）的职责边界
- 未影响系统整体边界（仍为纯 Markdown 文档仓库）
