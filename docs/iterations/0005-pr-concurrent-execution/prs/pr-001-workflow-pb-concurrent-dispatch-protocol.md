# PR-001：workflow-pb.md 阶段 5 并发调度协议文字补全

## 上下文摘要

把 `architecture.md`「对 workflow-pb.md 的目标改动」列出的 5 处补全点，落实为 `roles/workflow-pb/workflow-pb.md` 的正式协议文字，使"阶段 5：依赖解锁式并发调度"从纲要性描述变成主 agent 实际会遵守的调度纪律：并发槛位算法（爬升公式+硬上限公式）、启动工作流的 `status.md` 初始化时机、"PR 实现子状态"表新增"槛位状态"列与失败/阻塞专属状态取值、`progress-observer` 新增核实项、并发派发的具体技术手段说明。5 处改动共享同一份文件、同一套跨章节互相引用的字段结构，按逻辑原子性合并为一个 PR。

## 涉及功能点

- F01
- F02
- F03
- F04
- F05

## 文件范围

- `roles/workflow-pb/workflow-pb.md`（修改：阶段 5 章节、启动工作流章节、状态追踪协议章节、可观测性章节；版本号递增并更新文件头版本号）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（修改：追加本次版本变更记录，沿用项目既有惯例——每次 workflow-pb.md 版本变更都在此记录触发/根因/具体改动）
- `roles/workflow-pb/memory.md`（修改：追加一条索引摘要，沿用项目既有惯例）
- `.claude/skills/workflow-pb/SKILL.md`（修改：同步反映本次并发调度协议文字的实质变更，沿用项目既有惯例——历史上每次 workflow-pb.md 协议实质变更都同步更新此文件，用户已确认本次同样需要同步）

## 验收标准

- [ ] "阶段 5（PR 实现）：依赖解锁式并发调度"章节包含并发槛位算法的具体描述：起始并发数从 `status.md` 读取（默认 3）、爬升公式 `当前有效上限 = min(起始并发数 + 累计成功解锁次数 × 起始并发数, 硬上限)`、硬上限公式 `硬上限 = 2 × 起始并发数 - 1`。
- [ ] "调度指南 → 启动工作流"章节包含：主 agent 进入阶段 4→5 时，须在 `status.md` 初始化 `## 并发配置（阶段 5）` 区块，字段包括起始并发数、硬上限、当前有效上限、累计成功解锁次数、已派发总数（与 `architecture.md` 决策 D1/D2 一致）。
- [ ] `status.md` 格式定义处（§状态追踪协议 `status.md` 格式）的"PR 实现子状态"表新增"槛位状态"列（取值：占用 / 排队(依赖未满足) / 排队(等待槛位) / 已释放），"状态"列列出失败/阻塞专属取值 `❌失败(现场保留)` / `⏸阻塞(现场保留)`，"worktree 分支"列对应标注 `(保留)` / `(已清理)`。
- [ ] "可观测性：progress-observer 自动/按需触发"章节的触发说明处，新增一条具体核实项：每次生成 `progress.md` 时，对状态为失败/阻塞的 PR，核实其 worktree 目录和分支是否仍存在于磁盘（`git worktree list` + `git branch` 交叉核对），不一致则记入"发现的不一致"。
- [ ] "阶段 5"章节明确写出并发派发的技术手段："主 agent 在同一轮 assistant 响应中连续发起多个 `Agent()` 工具调用"，且不再保留"这套协议文字从未被真实调度执行"一类的模糊表述（该表述本身描述的是问题现状，本 PR 应替换为已落实的具体机制描述）。
- [ ] 新增文字未删除、未弱化现有"依赖解锁条件必须是合并进主分支"和"PR 间文件范围无重叠"两条规则的适用范围；未引入任何新增的语义耦合检测逻辑（对应 F05 验收标准 1~4）。
- [ ] `roles/workflow-pb/workflow-pb.md` 文件头版本号递增（当前 0.3.0，本次是协议执行细节的实质性补全，非措辞微调，遵循项目既有 semver 习惯递增到下一个 minor 版本），且 `data/workflow-pb-changelog.md` 新增对应版本条目（触发背景、具体改动、可追溯到本迭代 `0005-pr-concurrent-execution`）。
- [ ] `.claude/skills/workflow-pb/SKILL.md` 同步反映本次并发调度协议的实质变更（并发槛位算法、`status.md` 新增字段、progress-observer 新增核实项等），版本号/变更历史引用同步更新，不与 `workflow-pb.md` 正式规范的文字产生矛盾或遗漏。

## 参考资料

- `docs/iterations/0005-pr-concurrent-execution/architecture.md` §「对 workflow-pb.md 的目标改动」、§决策 D1~D4
- `docs/iterations/0005-pr-concurrent-execution/prd/F01-concurrent-dispatch-execution.md`
- `docs/iterations/0005-pr-concurrent-execution/prd/F02-concurrency-climb-mechanism.md`
- `docs/iterations/0005-pr-concurrent-execution/prd/F03-slot-release-on-failure.md`
- `docs/iterations/0005-pr-concurrent-execution/prd/F04-failure-worktree-preservation.md`
- `docs/iterations/0005-pr-concurrent-execution/prd/F05-safety-invariants-unchanged.md`
- `roles/workflow-pb/workflow-pb.md`（现有全文，尤其"阶段 5"、"调度指南 → 启动工作流"、"可观测性"、"状态追踪协议"四处章节）
- `roles/workflow-pb/data/workflow-pb-changelog.md`（版本变更记录格式参考，v0.2.0/v0.3.0 条目）

## depends_on

（无）

## batch

1
