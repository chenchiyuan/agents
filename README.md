# agents

一套可持续迭代、可跨项目复用的 AI agent 协作框架。

定义 agent 怎么设计、怎么执行、主子 agent 怎么协作，并能从真实案例中反思沉淀，在不同项目间复用经验。

---

## 核心设计

框架建立在四条方法论之上，所有角色、协议、skill 都追溯到这四条：

**元思考（Meta-thinking）**
不直接解决问题，先思考"解决这类问题该用什么方法"。`principles/meta/` 和 `principles/execution/` 的两层分离就是元思考的直接产物。

**反射设计（Reflection design）**
生成任何判断类内容之前，先反射"现实世界里谁最精通这类问题"，用那个框架推理，结果交用户确认后才定稿。角色的 identity 不是自我描述，是经过反射的思维框架。

**P-E-V-F-R 闭环（Plan → Execute → Verify → Fix → Reflect）**
任何能力单元（角色执行一次任务、skill 完成一次调用）都走完整的五阶段闭环，Verify 必须独立于 Execute，不能自证。

**自进化（Self-improvement loop）**
真实案例进 `data/`，反复出现的模式升入原则，原则驱动下一次执行。记录、复盘、升级是内置机制，不是可选附件。

---

## 可用角色

每个角色位于 `roles/<role>/`，包含 `<role>.md`（角色定义）、`memory.md`（精选索引）、`data/`（原始凭证）。

| 角色 | 职责 | 触发场景 |
|---|---|---|
| **demand** | 需求收敛者。将模糊想法通过结构化对话收敛为两段式需求合同（澄清依据 + proposal 级结论）| 从模糊到清晰的需求阶段 |
| **prd** | 功能规格分解者。将 demand.md 拆解为二级产品文档（prd.md 索引 + prd/*.md 功能卡，纯产品维度）| 需要将需求转为可执行规格时 |
| **architect** | 架构收敛者。在现有架构上演进，奥卡姆剃刀 + KISS，L1/L2/L3 决策分级 | 需要技术方案时 |
| **planner** | 任务图分解者。将 architecture.md 转为 DAG 任务图，每条任务有可追溯的验收标准 | 需要将方案拆成可执行任务时 |
| **dev** | 后端实现者。接收 brief，产出让验证标准通过的最小实现，不做架构决策 | 主 agent 派发具体编码任务时 |
| **verifier** | 独立验证者。由主 agent 委托触发，反射验证者身份，不接收执行过程上下文 | 需要对产物进行独立质量验证时 |
| **retrospective** | 复盘引导者。扫描迭代范围，分析根因，推导原则候选，引导用户讨论确认后归档 | 每次迭代完成后的 Reflect 阶段 |
| **workflow-pb** | 产品研发生命周期工作流。定义 7 阶段（需求→规格→架构→任务→提交规划→实现→验证）的阶段顺序、输入输出和推进条件 | 迭代全流程编排 |
| **workflow-scm** | git 层代码提交管理工作流。定义 worktree 隔离、PR 文件前置两条不变量，规范提交粒度判断框架 | 从 tasks.md 到代码合并的全程 |
| **commit-planner** | 提交规划执行角色。将 tasks.md 中的任务自动分组为 PR 单元，产出 prs/ 目录下的 PR 上下文文件 | workflow-pb 阶段 5（提交规划） |

---

## 目录结构

```
agents/
├── principles/
│   ├── meta/
│   │   ├── agent-design-protocol.md   ← 设计 agent 的元原则（给设计者看）
│   │   ├── memory.md
│   │   └── data/
│   └── execution/
│       ├── core-principles.md         ← 执行原则起草库（新角色复制用）
│       ├── memory.md
│       └── data/
│
├── roles/
│   ├── _template/
│   │   └── role-structure-reference.md  ← 七层结构说明（不是模板，不渲染）
│   ├── demand/   ├── prd/      ├── architect/
│   ├── planner/  ├── dev/      ├── verifier/
│   ├── retrospective/
│   ├── workflow-pb/      ← 产品研发生命周期工作流（7 阶段）
│   ├── workflow-scm/     ← git 层代码提交管理工作流
│   └── commit-planner/   ← 提交规划执行角色
│       （每个角色均含 <role>.md / memory.md / data/）
│
├── .claude/skills/
│   └── create-role/SKILL.md   ← 创建新角色的 skill
│
├── tools/
│   └── check-role-structure.sh   ← 角色目录结构校验脚本
│
├── tests/
│   └── test-check-role-structure.sh
│
└── docs/
    ├── iterations/
    │   ├── 0000-project-design/
    │   │   └── clarifications/   ← 框架设计阶段的澄清记录
    │   └── {编号-迭代名}/        ← 每次迭代的产物
    │       ├── demand.md
    │       ├── prd/
    │       ├── architecture.md
    │       ├── tasks.md
    │       ├── prs/              ← 阶段 5 产物（PR 上下文文件）
    │       └── clarifications/
    ├── memory-system.md   ← 三级记录体系完整说明
    ├── mvp-plan.md        ← 阶段计划与进度
    └── proposal.md        ← 项目提案与背景
```

---

## 使用方法

### 在 agents 项目中开发

直接读取 `roles/<role>/<role>.md` 作为角色定义。

主 agent 通过 Claude Code 的 `Agent` 工具派发子任务：
1. 读取对应角色文件，理解边界和职责
2. 写一份 brief 文件（参考 `docs/iterations/0001-bootstrap-dev-role/task-1-brief.md`）
3. 用 `Agent` 工具派发，brief 路径作为上下文，不传递主 agent 会话历史
4. 验收子 agent 的产出，必要时触发 verifier 角色独立验证

### 在业务项目中部署

业务项目按三层结构存放数据（CLR-DS-001~005）：

```
业务项目/
├── .pb-agents/                        ← agents 框架 copy（只读）
│   ├── roles/<role>/<role>.md
│   └── principles/
│
├── .pb-agents/project/                ← 业务项目运行记录（镜像结构）
│   └── roles/<role>/data/
│
└── docs/iterations/{编号-迭代名}/     ← 每次迭代的产物
    ├── demand.md
    ├── prd/
    ├── architecture.md
    ├── tasks.md
    └── clarifications/
```

**安装**（Phase 4，开发中）：将 `roles/<role>/<role>.md` 和 `principles/` copy 到业务项目的 `.pb-agents/`。`.pb-agents/` 不可在业务项目中直接修改，修改走 agents 仓库的 PR 流程后重新 copy。

---

## 创建新角色

使用 `create-role` skill（在 Claude Code 里输入 `/create-role`）：

1. **Plan**：描述需要什么能力，skill 分析现有角色对比
2. **Execute**：三步反射推理——提取核心任务类型 → 构造角色描述 → 展示确认（标记 `model_inferred`，用户确认前不定稿）
3. **Verify**：内部派发无上下文子 agent 独立检查，不由创建者自证
4. **Fix**：发现问题后修复，重新触发独立验证
5. **Reflect**：经验写入 `roles/<role>/data/`

验证由内部 P-E-V-F-R 闭环保证，不需要外部调用额外 skill。

---

## 记录系统

三级体系，详见 `docs/memory-system.md`：

- **`<role>.md` 原则章节**：经真实案例验证的当前准则，独立演化，不引用共享文件
- **`memory.md`**：指向 `data/` 的精选索引，可删（保持每条都值得展开读）
- **`data/`**：原始凭证，只增不减

升级流向：`data/` → 角色原则（角色内多次踩坑）→ `principles/execution/` 起草库（3+ 角色独立出现）

---

## 当前进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 1 | 跑通第一个真实 agent（roles/dev）| 已完成 |
| Phase 2 | 抽象 agent 构造机制（create-role skill + 5 个新角色）| 已完成 |
| Phase 2.5 | SCM 工作流层（workflow-scm + commit-planner + workflow-pb Phase 5）| 已完成 |
| Phase 3 | 反思沉淀机制 | 未开始 |
| Phase 4 | 跨项目复用打包（安装脚本 + .pb-agents/ 结构）| 未开始 |

详见 `docs/mvp-plan.md`。
