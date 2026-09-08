# F03：PR worktree 的 base 与合并目标改为迭代分支

## 功能 ID
F03

## 用户价值
让 PR 的代码变更在迭代范围内隔离合并，避免未完成迭代的中间产出过早落地 main，实现 main 分支只包含"已验证、已完成迭代"的稳定状态。

## 验收标准
- [ ] workflow-pb.md §提交管理约束·规则 A 中"主分支"的措辞从单一指向 main/master 改为指向"当前迭代的迭代分支"（或等效表述）
- [ ] workflow-pb.md §调度指南·阶段 5 中关于"worktree 分支从哪拉出""PR 合并进哪"的描述明确指向迭代分支，不再是 main
- [ ] 该改动能让读者理解：从阶段 4 完成后，所有 worktree 变更必须合并进迭代分支，不直接合并进 main
- [ ] 检查 `.claude/skills/workflow-pb/SKILL.md` 中是否存在内联重复描述"PR 合并目标/worktree base 是主分支"的表述（如 CRITICAL 声明、Important facts），若存在须同步改为"迭代分支"，避免协议文件与 skill 文件表述冲突

## 边界（不包含）
- 不包含迭代分支的命名格式定义（由 F01 处理）
- 不包含迭代分支的创建时机（由 F02 处理）
- 不包含阶段 5 解锁判据的改动（由 F04 处理，虽然两者有逻辑依赖）
- 不改变"规则 B：PR 文件前置"的七字段格式本身（demand.md §3 明确不做）

## 架构维度

已补全为决策 D2（见 `architecture.md` §决策 D2）：

- **规则 A 措辞改写**：`workflow-pb.md`「提交管理约束 § 规则 A：worktree 隔离」正文"不得直接在主分支（main/master）上提交"改为"不得直接在主分支（main/master）或当前迭代的迭代分支上提交"；判断方式"所有变更必须通过 PR 合并进主分支"改为"所有变更必须通过 PR 合并进当前迭代的迭代分支"。
- **新增约束**（结构性推论，两层模型下必须同步补充）：规则 A 判断方式新增一句"每次提交所在分支不得为 `main`/`master`，也不得为当前迭代的迭代分支本身"——PR worktree 分支从迭代分支拉出后，dev 只能在该 worktree 分支上提交，不能绕过 PR 流程直接提交到迭代分支或 main。
- **worktree base 改写**：PR worktree 创建命令由"从 main 拉出"改为"从当前迭代的迭代分支拉出"：`git worktree add <path> -b <pr分支名> iteration/{迭代ID}`。
- **合并目标改写**：PR 验收通过后的 merge 操作目标由 main 改为迭代分支。由于主 agent 根目录已 checkout 在迭代分支上（见 F02），合并命令保持现有 `git merge --no-ff <pr分支名>` 惯例不变，只是执行时所在分支从 main 变为迭代分支。
- **SKILL.md 同步**：修正并补全——原稿只列了 5 处，实际全文检索 SKILL.md 命中 11 处"主分支"，遗漏 6 处。完整清单（按行号）：identity 字段"识别'自称完成'和'合并进主分支'的本质差异"（:14）、CRITICAL 声明"阶段 5 只以合并进主分支解锁下游依赖"（:38）、Success criteria"阶段 5 所有 PR 合并进主分支"（:65）、对抗惯性表"只有'合并进主分支'才解锁"（:81）、判断锚点·成功标准"所有 PR 合并进主分支"（:87）、Important facts #3"PR-B worktree 必须从已含 PR-A 代码的主分支拉出"（:119）、Important facts #8"'合并进主分支才算解锁'这一条件"（:124）、Step 5 解锁条件正文"解锁条件是合并进主分支"（:174）、Important facts 交叉引用"Safety 中'合并进主分支'原则"（:200）、阶段 5 执行流程"merge 进主分支后重新扫描依赖图"（:261）、Safety 条目"阶段 5 解锁条件是'合并进主分支'"（:376）。以上 11 处均需同步改为"当前迭代的迭代分支"或等效表述，避免协议文件与 skill 文件表述冲突（详见 `architecture.md` §对 workflow-pb.md 的目标改动）。
