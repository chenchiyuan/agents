# pr-002：pr-planner.md 新增"并发可行性"判断维度（F05）

## 上下文摘要

`roles/pr-planner/pr-planner.md` 的 Strategy/判断框架章节新增"并发可行性"维度，作为拆出独立 PR 前的强制推进条件：找不到与其他 PR 的并发重叠窗口的候选拆分点判定为反向实践，须合并回其他 PR 或调整依赖关系。计算方法复用已有 `depends_on` 依赖图做可达性判定，不引入时间调度模型。本卡内容与其他三份文件（workflow-pb.md/SKILL.md/demand.md）改动的条款无重叠、无引用关系，独立可编辑、独立可验收。

## 涉及功能点

- F05

## 文件范围

- `roles/pr-planner/pr-planner.md`（修改：Strategy 判断框架新增"并发可行性（推进条件）"子章节，含定义、判断规则、检查时机、并发重叠窗口计算方法（依赖图可达性判定）；Workflow 的 Verify 阶段新增对应检查项；版本号从 0.1.0 升级并补一条变更说明）

## 验收标准

- [ ] `pr-planner.md` 的 Strategy/判断框架章节中存在明确命名为"并发可行性"（或等价、无歧义命名）的判断维度（F05 验收 1）
- [ ] 该维度的文字表述为强制性推进条件（用"必须""才能拆出""不满足时不得拆出"等措辞），不是"建议"或"可选参考"（F05 验收 2）
- [ ] 判断规则明确写出：拆出一个独立 PR 前，必须能在依赖图上找到该 PR 与至少一个其他 PR 的并发重叠窗口（两者互不为对方的祖先/后继）；找不到并发窗口的候选拆分点判定为"反向实践"，处理方式为合并回其他 PR 或调整依赖关系，不单独拆出（F05 验收 3）
- [ ] 并发重叠窗口计算方法明确采用依赖图可达性判定（复用已有 `depends_on` 依赖图，不引入时间调度模型），判定步骤可执行：对每个候选 PR 遍历其余 PR 做一次可达性检查，存在至少一个互不可达的 PR 即通过；若与所有其他 PR 都存在依赖路径则判定为无并发窗口
- [ ] 该维度的检查时机明确写在 Verify 阶段（PR 拆分方案产出之后、交付前），不是事后由别人核查（F05 验收 4）
- [ ] `pr-planner.md` 版本号从 0.1.0 升至新版本号，且新增一条对应的"vX.X.0 变更说明"记录本次改动

## 参考资料

- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/architecture.md` §变更映射 F05
- `docs/iterations/0024-execution-autonomy-and-demand-deep-dive/prd/F05-pr-planner-concurrency-dimension.md`
- 代码基线锚点：`roles/pr-planner/pr-planner.md:30`（版本号）、`:157-180`（Strategy 判断框架，新增维度插入点）、`:210-220`（Workflow 第5步"验证（Verify）"，新增检查项插入点）

## depends_on

（无）

## batch

1
