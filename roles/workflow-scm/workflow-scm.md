---
name: workflow-scm
description: git 层代码提交管理工作流规范。定义从 tasks.md 产出到代码合并的完整提交管理流程，包含 worktree 隔离约束、PR 文件规范、验证目标和文档路径协议。主 agent 读它来调度提交规划和验证，commit-planner 读它来确定输入路径、输出规范和交付标准。不执行任何工作，只定义规范。
role:
  identity: |
    专注 git 层代码变更管理的工作流规范——
    每次代码变更都可追溯到一个 PR 文件，每个 PR 文件都可追溯到 tasks.md 中的任务。
    不定义"怎么写代码"，只定义"变更在哪里发生、记录在哪里、何时可以合并"。
  character: |
    完整、自描述、可验证。
    每条约束必须能被客观判断是否违反。
    不接受"基本满足"作为合并条件。
---

# workflow-scm

**版本**: 0.1.0
**创建日期**: 2026-09-02
**变更历史**: 见 `data/workflow-scm-changelog.md`

---

**CRITICAL: 本文件只定义规范，不执行工作。所有执行判断由主 agent 和执行角色完成。**

**CRITICAL: 修改本文件不得侵入任何执行角色文件。角色文件只定义能力，工作流文件定义契约。**

---

## 一句话职责

定义 git 层代码提交管理的完整规范，让主 agent 知道如何调度提交规划和验证，让执行角色知道读什么、写什么、交付什么。

---

## 约束声明

以下约束在每次使用 workflow-scm 的迭代中强制生效，每条措辞明确，可被客观判断是否违反。

### 规则 A：worktree 隔离

从 `tasks.md` 产出（即 Phase 4 完成）之后，任何代码变更必须在独立 worktree 分支上进行，不得直接在主分支（main/master）上提交。

判断方式：每次提交所在分支不得为 `main` 或 `master`；所有变更必须通过 PR 合并进主分支。

### 规则 B：PR 文件前置

每个 worktree 变更必须对应一个 `prs/pr-{NNN-描述}.md` 文件（按本文件"文档路径协议"章节的格式规范），merge 前该文件须存在。

判断方式：merge 操作执行前，对应的 PR 文件在 `docs/iterations/{迭代ID}/prs/` 目录中可读取。

### 约束生效范围

上述约束**仅从下一个使用 workflow-scm 的迭代起生效**，不追溯已完成迭代。已在主分支提交代码的历史迭代不受本约束影响。

---

## 阶段定义

workflow-scm 包含一个核心阶段：提交规划阶段。

### 提交规划阶段

**职责**：将 tasks.md 中的任务列表转化为有序的 PR 规划，每个 PR 对应一个独立的文件，包含 dev 完成该 PR 所需的完整上下文。

**输入**：`docs/iterations/{迭代ID}/tasks.md`（Phase 4 的产物）

**输出**：`docs/iterations/{迭代ID}/prs/` 目录，包含若干 `pr-{NNN-描述}.md` 文件

**推进条件**：
- `prs/` 目录中的文件数量 ≥ 1
- 每个 PR 文件满足本文件"文档路径协议"章节定义的格式规范（含五个必填字段）
- tasks.md 中每个任务 ID 至少被一个 PR 文件的"涉及 tasks"字段引用（无遗漏任务）
- 不同 PR 文件的"文件范围"字段之间无重叠（无同一文件被多个 PR 声明）

---

## 文档路径协议

### PR 文件存放路径

PR 文件统一存放在当前迭代产物目录的 `prs/` 子目录下：

```
docs/iterations/{迭代ID}/prs/pr-{NNN-描述}.md
```

- `{迭代ID}` 为当前迭代标识符，如 `0003-workflow-scm`
- `{NNN-描述}` 为数字加简短描述，NNN 为三位有序数字，描述为英文短语，如 `001-add-workflow-scm`、`002-add-commit-planner`

示例完整路径：

```
docs/iterations/0003-workflow-scm/prs/pr-001-add-workflow-scm.md
docs/iterations/0003-workflow-scm/prs/pr-002-add-commit-planner.md
```

### PR 文件格式规范

每个 PR 文件必须包含以下五个字段，缺一不可：

#### 1. 上下文摘要

描述该 PR 解决什么问题、背景是什么。dev 读完后能独立工作，无需额外询问。

```markdown
## 上下文摘要

[描述该 PR 的目标、背景和关键约束，200 字以内]
```

#### 2. 涉及 tasks

来自 `tasks.md` 的任务 ID 无序列表，每行一个任务 ID。

```markdown
## 涉及 tasks

- T01
- T03
```

#### 3. 文件范围

该 PR 预计涉及的文件路径或目录列表，用于 worktree 范围约束和 verifier 验证。

```markdown
## 文件范围

- roles/workflow-scm/workflow-scm.md（新建）
- docs/iterations/0003-workflow-scm/prs/（目录新建）
```

#### 4. 验收标准

该 PR merge 前须满足的可独立判断的条件，至少一条。每条标准不得依赖其他 PR 完成才能判断。

```markdown
## 验收标准

- [ ] 文件 `roles/workflow-scm/workflow-scm.md` 存在且可独立读取
- [ ] frontmatter 包含 name: workflow-scm 且 description 非空
```

#### 5. 参考资料

相关文件路径或外部链接，可为空列表，但字段必须存在。

```markdown
## 参考资料

- docs/iterations/0003-workflow-scm/prd/F01-workflow-scm-definition.md
- roles/workflow-pb/workflow-pb.md
```

---

## 验证目标

workflow-scm 的验证由 verifier 角色执行，主 agent 派发时将以下验证目标内联写入 brief。

### PR 粒度判断框架

commit-planner 分组时使用，verifier 验证时使用。以下三条是判断依据，不是可量化指标：

- **逻辑原子性**：该 PR 只做一件可描述的事，回滚它不影响无关功能。
- **可审查性**：reviewer 能在不切换心智模型的情况下完整审查——逻辑跳跃、跨模块混合是信号。
- **独立性**：验收标准可在不依赖其他 PR 合并的情况下判断。

对于自动生成代码、纯格式化、纯文档变更，行数不是粒度信号，逻辑原子性才是。

### 文件范围验证

- **指标**：PR 文件声明的文件范围与 tasks.md 对应任务的实际变更范围一致
- **判断方式**：静态声明对比——verifier 将 PR 文件中的"文件范围"字段与 tasks.md 对应任务描述核对
- **通过条件**：无重叠（同一文件不被多个 PR 声明）、无遗漏（tasks.md 中每个任务涉及的文件均被某个 PR 覆盖）

### 验证触发时机

commit-planner 完成提交规划、`prs/` 目录中所有 PR 文件生成后，主 agent 触发 verifier：

```
产出物路径: docs/iterations/{迭代ID}/prs/
验证标准: [内联自本文件 §验证目标 的两项条目]
```

---

## 角色读取指南

### commit-planner 读此文件

**输入路径**：`docs/iterations/{迭代ID}/tasks.md`，由主 agent 在 brief 中指定迭代 ID。

**输出路径**：`docs/iterations/{迭代ID}/prs/`，PR 文件命名规则为 `pr-{NNN-描述}.md`，NNN 从 `001` 开始有序递增。

**交付标准**（即提交规划阶段推进条件）：
- `prs/` 目录中的文件数量 ≥ 1
- 每个 PR 文件包含五个必填字段（上下文摘要、涉及 tasks、文件范围、验收标准、参考资料）
- tasks.md 中每个任务 ID 至少被一个 PR 文件引用
- 不同 PR 文件的文件范围无重叠

**不要从自己的角色文件里找输入输出路径**——角色文件只定义能力，工作流文件定义契约。

---

## 原则

**工作流规范不定义执行细节**

本文件定义"做什么、交什么、满足什么标准"，不定义"怎么做"。执行细节由对应的执行角色文件定义。

**出口定义优先于流程顺序**

推进条件是提交规划阶段最重要的内容。含糊的推进条件（"PR 文件写完了就推进"）是下游返工的种子。

**约束通过契约传递，不侵入执行角色**

worktree 隔离约束和 PR 文件前置约束写在本工作流文件中，通过 brief 传递给 dev 和 verifier，不修改任何执行角色文件本身。

---

## 何时更新本文件

- PR 粒度判断（逻辑原子性/可审查性/独立性）导致 commit-planner 产出与 dev 实际工作量不匹配 → 修订判断框架描述
- 文件范围验证出现误判 → 收紧"静态声明对比"的判断规则
- 发现新的必填字段需求 → 在"文档路径协议"中增加字段定义
- 不得因"方便执行角色"而在本文件里加入执行细节

变更历史写入 `data/workflow-scm-changelog.md`，保留旧版约束被修改的原因。
