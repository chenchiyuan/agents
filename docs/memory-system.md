---
title: 文件存储与记忆系统
created: 2026-09-01
updated: 2026-09-01
---

# 文件存储与记忆系统

agents 项目的记忆不依赖外部数据库，全部是 Git 仓库里的 Markdown 文件。这份文档是该系统的完整参照。

---

## 一、三级记录体系

每个角色目录（`roles/<role>/`）和每个原则目录（`principles/*/`）都遵循同一套三级结构：

```
roles/<role>/
  <role>.md       ← 一级：采纳原则
  memory.md       ← 二级：精选索引
  data/           ← 三级：原始凭证
```

### 第一级：采纳原则（`<role>.md` 原则章节）

- **是什么**：经过真实案例验证、当前仍适用的行为准则，是角色在没有新信息时的默认判断依据
- **怎么写**：整段内联，不引用其他文件；写入后归角色自己所有、独立演化
- **何时更新**：同类踩坑在该角色的多次任务中重复出现，且原有原则无法拦住——满足才升级，不是发现新东西就加
- **不在这里的**：执行过程记录、否决方案、变更历史——这些进 data/

### 第二级：精选索引（`memory.md`）

- **是什么**：指向 `data/` 每条记录的一句话摘要，帮助读者快速判断要不要展开读
- **核心特征**：主动整理，**可以删**——新增重要条目，同时删掉不再重要的旧条目；目标是"每行都值得读者展开"，不是追加日志
- **格式**：`- [[文件名（不含.md）]] - 一句话摘要`
- **不在这里的**：记录正文、完整决策过程——只放摘要和指针

### 第三级：原始凭证（`data/`）

- **是什么**：踩坑过程、决策依据、否决方案、变更历史的原始记录
- **核心特征**：**只增不减**——是原始凭证，即使后来被更好的版本覆盖，原件永久留存
- **记录格式**（标准四段式）：
  ```
  ## [标题]
  **需求/背景**：触发这条记录的场景
  **变更/踩坑原因**：为什么发生，根因
  **决策过程**：当时怎么判断的，否决了哪些备选
  **经验总结**：可泛化的应对模式
  ```

---

## 二、升级流动方向

```
data/（原始凭证，只增不减）
  ↓ 同类踩坑在该角色多次任务中重复出现，且原有原则无法拦住
<role>.md 原则章节（采纳原则，角色级）
  ↓ 同类踩坑在 3+ 个不同角色中独立出现，且无现有原则能拦住
principles/execution/core-principles.md（起草库，项目级）
  ↓ 角色新建时复制相关条目，写入后独立演化
<role>.md 原则章节
```

**memory.md 不在升级链路里**，它只是辅助检索的索引层，随着 data/ 内容的增减而整理。

---

## 三、目录结构全览

```
agents/
├── principles/
│   ├── meta/
│   │   ├── agent-design-protocol.md   ← 设计 agent 的元原则
│   │   ├── memory.md                  ← 精选索引
│   │   └── data/                      ← 元原则变更历史等原始凭证
│   └── execution/
│       ├── core-principles.md         ← 执行原则起草库（新角色复制用）
│       ├── memory.md
│       └── data/
│
├── roles/
│   ├── _template/
│   │   └── role-structure-reference.md   ← 七层结构说明（非模板）
│   ├── dev/
│   │   ├── dev.md
│   │   ├── memory.md
│   │   └── data/
│   └── retrospective/                    ← 负责管理记录升级链路的角色
│       ├── retrospective.md
│       ├── memory.md
│       └── data/
│
├── .claude/skills/
│   └── create-role/SKILL.md              ← 创建新角色的 skill
│
├── clarifications/                        ← pb-v1-talk 讨论阶段的澄清记录
├── docs/                                  ← 产品文档、本文件
├── plans/                                 ← 任务执行计划（按任务归档）
├── tests/                                 ← 校验脚本测试
└── tools/
    └── check-role-structure.sh            ← 角色目录结构校验脚本
```

---

## 四、记录写在哪里的判断标准

| 场景 | 写哪里 |
|---|---|
| 违反后果严重，且从文件本身看不出为什么 | `roles/<role>/data/` |
| 一个假设被证伪 | `roles/<role>/data/` |
| 有多个备选方案被否决，否决理由是独立知识 | `roles/<role>/data/` |
| 某条原则的变更历史 | `principles/*/data/` 或 `roles/<role>/data/` |
| 同类踩坑重复出现，需要升级为原则 | 先写 `data/`，再由 `retrospective` 角色判断升级 |
| 顺利完成无意外 | 不记 |
| 与已有记录高度重复 | 不记（先搜后记） |

---

## 五、负责管理记录的角色：retrospective

`roles/retrospective/` 是专责管理记录升级链路的角色，由主 agent 或其他角色在 Reflect 阶段触发。

**职责**：
- 判断原材料值不值得记、记在哪、记成什么形状
- 执行写入 `data/`，并整理 `memory.md` 索引（增加重要条目，删除不再重要的）
- 识别需要从角色级升级到项目级 `principles/` 的跨角色模式
- 输出处置报告，**升级 `principles/` 只产出建议，等主 agent/用户确认**

**不做**：直接修改 `principles/meta/agent-design-protocol.md` 或 `core-principles.md`；参与实际执行任务；创建新角色。

---

## 六、跨项目部署：业务项目中的数据分层

agents 框架被安装到业务项目后，数据按三个维度存放：

```
业务项目/
├── docs/
│   └── iterations/
│       └── {编号-迭代名}/       ← 每次迭代一个目录，例如 0001-user-auth/
│           ├── demand.md        ← 需求合同
│           ├── prd.md           ← PRD 索引
│           ├── prd/             ← 功能规格卡
│           ├── architecture.md  ← 技术架构
│           ├── tasks.md         ← 任务图
│           └── clarifications/  ← 本次迭代的澄清记录
│
├── .pb-agents/              ← agents 框架 copy（只读，不可在业务项目中直接修改）
│   ├── roles/
│   │   ├── demand/
│   │   │   └── demand.md    ← 角色定义文件（不含 data/ 和 memory.md）
│   │   └── ...
│   ├── principles/          ← 执行原则（必须 copy）
│   ├── .claude/skills/      ← 可选，创建新角色时用
│   └── tools/               ← 可选，校验脚本
│
└── .pb-agents/project/      ← 项目运行记录（镜像 agents 内部结构）
    └── roles/
        ├── demand/
        │   ├── data/        ← demand 角色在本项目运行时积累的记录
        │   └── memory.md
        └── ...
```

### 三条核心约束

1. **`.pb-agents/` 只读**：不能在业务项目里直接修改。需要修改角色定义或原则时，必须走 agents 项目的 PR 流程，agents 发布后再更新业务项目的 copy
2. **更新不影响运行记录**：agents 升级后手动更新 `.pb-agents/`（重新安装），`.pb-agents/project/` 完全不受影响
3. **镜像结构便于归档**：`.pb-agents/project/` 与 agents 内部结构对齐，归档时直接 copy 到 agents PR，无需额外整理

### 归档回 agents 的触发条件

`.pb-agents/project/` 积累的运行记录，满足以下任一条件时归档回 agents PR：

- **retrospective 角色识别**：每次迭代结束后，retrospective 角色扫描 `.pb-agents/project/` 里的新记录，判断是否达到跨角色升级标准（同类踩坑在 3+ 项目中独立出现），产出建议，用户决定是否提 PR
- **用户主动发起**：开发者判断某条记录对其他项目有普遍价值，直接开 PR

详见 `clarifications/data-storage-protocol/round-1.md`（CLR-DS-001 ~ CLR-DS-005）。

---

## 七、关键约束（背下来）

1. **data/ 只增不减**：是原始凭证，即使被覆盖也不删除原件
2. **memory.md 主动整理**：可以删不重要的条目，目标是"每行都值得展开"，不是追加日志
3. **原则内联不引用**：角色的原则章节整段复制写入，不用 `$ref()` 或"遵循 xxx.md"的指针式表达
4. **升级有门槛**：data/ 升入原则章节，需要在该角色多次任务中验证；原则升入项目级，需要 3+ 角色独立出现
5. **先搜后记**：写入 data/ 前先 grep 检查是否已有同类记录，重复记录是系统噪音
6. **copy 只读**：业务项目中的 `.pb-agents/` 不可直接修改，修改走 agents PR 流程
