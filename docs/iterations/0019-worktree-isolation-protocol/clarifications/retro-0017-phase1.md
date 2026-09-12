# 复盘报告 · Phase 1（扫描分析）— 迭代 0017-project-workspace

**caller**: retrospective
**时间**: 2026-09-12
**用途**: 迭代 0019-worktree-isolation-protocol 阶段 1（需求收敛）第二轮收敛的输入材料
**本次范围（硬性）**: **只做 Phase 1**。不含 Phase 2（用户讨论）、不含归档（`roles/**/data/`、`memory.md`、`principles/**`、`roles/**` 全部不动）。
**唯一写入**: 本文件。
**独立性声明**: `clarifications/incident-20260912.md` 仅作为线索使用；本报告每一条结论均由本次会话独立取证（文件行号 / 只读 git 命令输出），未复用其结论。该文件自标的 `[UNVERIFIED]` 三项未当事实。
**证据分级**: `实测` = 本次读到的文件内容或只读 git 输出；`[INFERENCE]` = 由实测事实推导、未直接观测的判断；`不可核实` = 现有记录无法判定，如实列出不给结论。

---

# 一、复盘范围与证据清单

## 1.1 范围

迭代 0017-project-workspace 的完整执行（2026-09-12 15:24 派发 demand → 17:42:52 收口完成），含阶段 1~6 全部产物与其间发生的跨会话事件；观察窗口延伸到 17:53:53（0019 脚手架提交），因为 0017 的收口与 0018 的启动在时间上重叠，脱离这段窗口无法解释 0017 的收尾动作。

## 1.2 读过的文件（`实测`）

| # | 文件 | 用途 |
|---|---|---|
| 1 | `docs/iterations/0017-project-workspace/status.md`（全文） | 阶段状态 / PR 子状态 / 并发配置 / 下一迭代候选 / Gate 记录 |
| 2 | `docs/iterations/0017-project-workspace/history.md`（全文 418 行，含工作区版） | 派发—报告—调度决策逐条时间线 |
| 3 | `docs/iterations/0017-project-workspace/progress.md`（全文） | progress-observer 只读核实报告（7 条不一致 / 12 条无法核实） |
| 4 | `.../clarifications/verify-stage6-20260912-173934.md`（commit 版与 `/tmp` 残留版对拍） | 阶段 6 报告的两版本差异 |
| 5 | `.../clarifications/verify-pr-002-20260912-170519.md`（A-1/A-7 段与"下一迭代参数"段） | D-2 缺陷的一手记录 |
| 6 | `.../clarifications/verify-pr-004-20260912-172839.md`（执行证据与 D 段） | 负载敏感 / 变异实验证据 |
| 7 | `.../clarifications/verify-pr-001-20260912-163434.md`（worktree 路径与命令段） | pr-001 worktree 现场证据 |
| 8 | `docs/iterations/0019-worktree-isolation-protocol/{status.md, history.md, demand.md, clarifications/round-1.md, clarifications/demand-round-1-proposals.md, clarifications/incident-20260912.md}` | 本迭代输入项与现行口径 |
| 9 | `docs/iterations/0018-chat-agent-subagent-protocol/{history.md, status.md, progress.md, clarifications/round-1.md}`（经 `git show iteration/0018-…:<path>` 读取，非本工作区文件） | 跨会话事件另一侧的记录 |
| 10 | `.gitignore`（4 行）、`.git/info/exclude`、`oamp/.gitignore`（2 行）、`~/.config/git/ignore`（1 行） | 新工作区里"什么会出现"的判据 |
| 11 | `tools/install-pb-agents.sh`（全文） | 安装行为与"角色文件从哪来" |
| 12 | `.claude/skills/workflow-pb/SKILL.md`（关键行：31 / 42 / 96-97 / 131-133 / 220-228） | Step 0 硬停与角色文件根路径条款 |
| 13 | `roles/workflow-pb/workflow-pb.md`（关键行：127-135 / 258 / 277-285 / 304 / 417 / 463-485 / 611） | 现行 worktree / 并发 / 现场保留条款 |
| 14 | `oamp/package.json`、`oamp/README.md`（89/123/189-191）、`oamp/test/project-workspace.test.js`（121-123 / 130-145 / 238 / 1109-1195）、`oamp/test/router-registry.test.js:135-139`、`oamp/test/helpers/harness.js`、`oamp/src/persist.js:179-183` | 新工作区"能否零安装干活"的实测 |
| 15 | `/tmp/pb-0017-residual/{history.worktree.md, verify-stage6.worktree.md, verify-stage6.moved.md}`（`cmp` / `diff` 对拍） | 跨会话残留物的一手内容 |

## 1.3 跑过的只读 git 命令（全部只读；无 add / commit / merge / checkout / worktree / branch -d / clean / rm）

```
git log --oneline -40 --all │ git log --format='%H %ci %s' --all
git reflog show --date=iso        # 主工作区 HEAD 全量 reflog（含两个会话交错记录）
git branch -a -v │ git show-ref │ git worktree list
git merge-base --is-ancestor 028ca8a {main, iteration/0018-…}
git branch -a --contains 028ca8a
git rev-parse main origin/main ; git merge-base main {iteration/0019-…}
git show --stat 028ca8a / 9ede9ea / 2af9f3d 等 ; git log -1 --format=… 60ba902
git diff --stat 428e672 9ede9ea -- docs/iterations/0017-project-workspace/
git diff 428e672…? → diff <(git show 9ede9ea:<f>) /tmp/pb-0017-residual/<f>
diff <(git show 028ca8a:<f>) <(git show 9ede9ea:<f>)
git show 0d726f2:oamp/src/web.js │ git show 428e672:oamp/src/web.js | nl -ba | sed -n '690,700p'
git show main:oamp/package.json │ git show iteration/0018-…:<各产物>
git ls-files / git ls-files roles|principles|docs|.claude|tools / git ls-tree -r --name-only
git check-ignore -v {.pb-agents/roles, .pb-agents/principles, .worktrees, .claude/settings.local.json, oamp/data/sql.db, oamp/.runtime}
git status --porcelain │ git status --porcelain --ignored=matching
git log --oneline -- docs/iterations/0017-project-workspace/{architecture.md, progress.md}
git config --get core.excludesFile
```

---

# 二、发现的问题

> 每条结构：现象 / 根因 / 证据 / 三问过滤 / 建议处置。**发现与候选分离**：根因是事实层，候选是判断层，候选一律不含用户偏好推测。

## P-1 并行会话共用同一工作树 —— 本次四类损害的共同前置条件【最高】

- **现象**：同一工作树 `/Users/chenchiyuan/projects/agents` 上并存两个主 agent 会话（S-0017 收口、S-0018 启动），10 分钟内发生：提交落到他人分支、分支切换被他人未提交改动阻塞、未跟踪产物混在同一工作区、同一文件被两个会话交替读写。
- **根因**：一个仓库只有一个工作树时，**工作目录、索引（index）、HEAD 是全局单例**；"会话身份"与"工作区身份"之间没有任何绑定。任何一方的 `checkout` / `add` / 未提交改动，对另一方都是可见且可破坏的。
- **证据**（`实测`）：
  1. reflog：`428e672` 于 17:40:47 `checkout: moving from iteration/0017-project-workspace to iteration/0018-…`；紧接着 17:41:44 `commit: docs(0017): 阶段 6 最终验证 PASS…`（= `028ca8a`）——即 0017 的收尾提交产生时 HEAD 已在 0018 分支上。
  2. 归属核实：`git merge-base --is-ancestor 028ca8a main` → **非 0（不在 main）**；`... iteration/0018-…` → 0（在 0018）；`git branch -a --contains 028ca8a` → 仅 `iteration/0018-chat-agent-subagent-protocol`。
  3. 同分钟 main 收到 `03a2f00`（`merge: iteration 0017-project-workspace … into main`，17:41:44），17:46:02 又收到 `9ede9ea`（`docs(0017): 迭代收口 …`）；`git rev-parse main` = `9ede9ea`，`origin/main` = `1c37e80`。
  4. 残留物仍在盘上：`/tmp/pb-0017-residual/` 含 `history.worktree.md`（17:42）与 `verify-stage6.{worktree,moved}.md`（17:44，`cmp` 判**两文件字节相同**）。
  5. 另一侧记录可交叉对拍：`git show iteration/0018-…:docs/iterations/0018-…/progress.md` 第 84-102 行逐条列出该会话读到的 state 与事实的偏差（B-1/B-2 声称被后续事实推翻）。
- **三问过滤**：①三个月后仍成立 ✓（只要工作树仍单例，机制不变）；②换项目/场景仍适用 ✓（任何 git 仓库、任何多会话场景）；③一句话能说清"遇到 X 先做 Y" ✓ ——「同一仓库要开第二个主 agent 会话时，先给它建独立工作区（`git worktree add`），不要在同一工作树里切分支」。
- **建议处置**：**升级为原则候选**（本迭代 W1 已在需求层由用户锁定；候选的价值是把"为什么"写进规范，使后来的会话不必再踩）。

## P-2 「无存活作业」被读成「作业丢失」 —— 跨会话状态可见性缺失

- **现象**：0018 会话在工作流启动时把 0017 的 pr-004 判定为「dev 作业已丢失」，并把「0017 停在阶段 5、pr-004 未验收未合并」写进自己的基线声明；而 git 事实是 pr-004 的 dev 早已完成、当时正处在 PR 级验收中。
- **根因**：跨会话的"作业是否在跑"没有任何权威状态源。会话能拿到的两类信号都是易失的——进程内的 `hub jobs` 注册表（作业结算后约 5 分钟即过期、且不跨会话）、以及**未提交**的 `status.md`。**"空作业列表"被当成了"作业丢失"**，属于把「未观测到」写成「不存在」。
- **证据**（`实测`）：
  1. `git show iteration/0018-…:…/history.md` 第 5 行（17:27:04）：「0017 status.md 阶段 5 未完成且 `hub jobs` 无存活 dev 作业（pr-004 作业已丢失）」。
  2. 反证：`git log -1 --format='%h %ci %s' 60ba902` → `60ba902 2026-09-12 17:21:05 +0800 test(0017): 新增项目工作区验收断言（pr-004）`；0017 `history.md` 17:21:46 的 dev 报告（单文件 21/21、全量 272/272）；`428e672` merge 于 17:30:53。
  3. 结论：17:27:04 时 pr-004 的 dev 已交付 6 分钟，「无存活作业」是**作业已正常结束**的表现，不是丢失。
  4. 直接后果：该会话的基线声明（`git show iteration/0018-…:…/clarifications/round-1.md` 第 7/18/135 行）把 0017 记为"未验收未合并"，随后 (17:30:53 外部会话合并 pr-004) 被事实推翻，需要另行修正（`…/history.md` 第 72 行）。
- **三问过滤**：①✓；②✓（任何多会话/多作业环境）；③✓ ——「判断另一会话的作业是否还活着，先看 git 落盘事实（commit / 分支 / 产物文件），再看进程内注册表；作业列表为空不等于作业丢失」。
- **建议处置**：**升级为原则候选**。

## P-3 状态载体是未提交的工作区文件 —— 可被另一会话的一次切换/清理覆盖

- **现象**：0017 的阶段产物与状态声明在其最需要被读到的窗口里处于**未提交**状态；0018 因此被阻塞并要求走"备份 → 移开文件 → `checkout -m` → 手工解 `UU` 冲突 → 恢复"的非标准路径。
- **根因**：工作流规定"产物落盘"（`docs/iterations/{迭代ID}/**`），但没有规定"落盘即提交"。于是状态声明的唯一载体是工作区文件，而工作区文件是**共享可变状态**——正是 P-1 根因的另一面。
- **证据**（`实测`）：
  1. `progress.md` §5 第 2 条（观测 17:08–17:11）：`git status --porcelain` = `M docs/…/history.md`、`M docs/…/status.md`；HEAD 处 status.md 内容滞后于工作区版本（阶段 5 备注 `2/4`→`3/4`、pr-002 行 `⏸`→`✅`、有效上限公式 `min(3+2×3,5)`→`min(3+3×3,5)`）。
  2. `git show iteration/0018-…:…/progress.md` 第 84-88 行：该会话核实到「B-2 声称 status.md 与 history.md 两份均脏」只对 history.md 成立；第 96-102 行核实到 B-1 的两条声称与时点事实不符（其 status.md mtime 17:41:06 早于 028ca8a 的 17:41:44）。
  3. 同一形态**在本次复盘时刻仍在重演**：`git status --porcelain` 现输出 ` M docs/iterations/0019-…/history.md` 与三个未跟踪文件（`demand.md`、`clarifications/round-1.md`、`clarifications/demand-round-1-proposals.md`）——而 0019 `status.md` §待确认项 D-1 已把"落盘即提交"写成自保措施。**措施已写下但尚未执行**。
- **三问过滤**：①✓；②✓（任何文档驱动的多会话流程）；③✓ ——「阶段产物落盘后立即提交到本会话归属分支，不要让状态声明停留在未提交状态」。
- **建议处置**：**升级为原则候选**（与 P-1 同源，可在同一条规范里闭环：隔离 + 落盘即提交）。

## P-4 未跟踪产物被改写后失去审计基线 —— 阶段 6 报告的"一字符差异"

- **现象**：`verify-stage6-20260912-173934.md` 有两个版本并存，差异落在第 160 行的一个字符：提交进 main 的版本写 `:695-699`，工作区留存的版本写 `:695-698`。
- **根因**：该报告在被提交前是**未跟踪文件**，没有 diff 基线；任何一方在其上做一次修改，事后都无法从 git 还原"作者原意"。差异本身是症状，"未提交的产物不可审计"才是根因。
- **证据**（`实测`）：
  1. `diff <(git show 9ede9ea:<f>) /tmp/pb-0017-residual/verify-stage6.worktree.md` → 唯一差异即第 160 行（`diff | wc -l` = 4 行输出）；两处 `:695-698` 的残留版内部自洽。
  2. 提交版**自身前后矛盾**：第 77 行写 `…仅装配进两条 LLM 分支（`:695-698`）`，第 160 行写 `…（`:695-699`）`。
  3. **源真值**（`git show 428e672:oamp/src/web.js | nl -ba | sed -n '690,700p'`）：`692` = `const project = …`；`693` = `const payloadBody = messageText.startsWith('!')`；`695` = `: body.one_shot === true`；`696`/`697` = 两条 LLM 分支载荷；`698` = `let dispatched = null;` ⇒ 两条分支载荷实为 **696–697**，两个版本都不精确，但残留版（695-698）自洽且更接近。
  4. 提交版与残留版的其余部分（含 028ca8a 版与 9ede9ea 版）逐字节相同 ⇒ 差异**只此一处**，不是两个不同版本的文件。
- **三问过滤**：①✓；②✓；③✓ ——「未提交/未跟踪的产物不得作为最终事实载体；写入后立即提交，使其获得版本基线」。
- **建议处置**：**候选（低优先）**——判为 P-3 的加强项；若用户认为 P-3 已覆盖，本条可只记案例（差异本身是一次性事件，不构成原则）。

## P-5 上游产物"作者时点"不回填 —— 与其自身的裁定记录相反

- **现象**：`architecture.md` 的状态行仍写「待主 agent 确认 §10 的 4 条口径点」，而同迭代 `status.md` / `history.md` 已记载 D-01~D-04 全部裁定完毕。
- **根因**：产物被当作"作者时点的快照"，决策后没有回填义务；裁定结果只落在调度侧文档里。后果是任何后来者（含下一个迭代的 demand/architect）读 `architecture.md` 时会看到与事实相反的状态。
- **证据**（`实测`）：`git log --oneline -- docs/iterations/0017-project-workspace/architecture.md` → **仅 `2af9f3d` 一条**（自创建起从未被修改）；`sed -n '5p' architecture.md` → `**状态**：**待主 agent 确认 §10 的 4 条口径点**（L1 决策 0 条）…`；`status.md` 阶段 3 行写「D-01~D-04 由主 agent 裁定」；`history.md` 16:43:48 记录主 agent 的决定是"维持作者时点表述不改写"；`progress.md` §5 第 1 条两次观测均报同一不一致且**未被修复**。
- **三问过滤**：①✓（文档与实际不一致是长期成本）；②✓；③✓ ——「裁定/结算完成后，把结论回填到被裁定产物的状态行，并注明回填时点」。
- **建议处置**：候选（低优先）。

## P-6 「下一迭代候选」单向登记、无承接闭环

- **现象**：0017 把 D-2（`/api/chats`、`/api/messages` 登记元数据缺 `project_id` ⇒ `/docs` 参数面不完整、`/debug` 实测 400）登记为「**下一迭代第一优先候选**」；随后 0018 显式不纳入（用户裁决 C-3），0019 也在 `demand.md` N2 显式排除。**两个后续迭代都排除了它，当前无任何迭代承接**；D-1、pr-004 的 N1~N6、`PROJECT_AGREEMENT` 具名导出同样悬空。
- **根因**：候选登记只有写入端（上一迭代 `status.md` 的一节），没有接收端的判据、回执与清算动作；"下一迭代"是一个**未绑定的指代**，遇到"下一迭代做别的事"时没有任何力使其重新露面。
- **证据**（`实测`）：`0017/status.md` 第 44-49 行（「D-2（中·用户可见缺陷·第一优先）」及其后 3 项）与第 56 行（具名导出候选）；`0019/demand.md` 第 211 行 N2「**不处理** 0018 的恢复/收口，**不处理** 0017 遗留缺陷 D-2」；`0019/status.md` §用户确认记录「**D-2（0017 遗留缺陷）**：不纳入 0018」；D-2 的是否真实可达由 pr-002 验证者实测（`verify-pr-002-…md` 第 247 行 A-7：`/api/chats` 的 `params` 不含 `project_id`，调试台按表单调用会 400），阶段 6 验证者独立复核确认为用户可见缺陷（`verify-stage6-…md` 第 269 行 ④(b)）。
- **附带发现（编号冲突）**：0019 自己的 `status.md` §待确认项又用了一个 D-2 编号登记「0017 收尾产物的一字符差异」⇒ 两个迭代各有一个 D-2，跨迭代引用时必然混淆。
- **三问过滤**：①✓；②✓（任何有"待办后移"机制的流程）；③✓ ——「迭代收口登记下一迭代候选时，写明承接判据或指定承接方；下一个迭代收敛时必须对上一迭代未承接候选给出显式裁决（纳入 / 转派 / 关闭）」。
- **建议处置**：**升级为原则候选**（面向 `roles/workflow-pb/`）。

## P-7 在途作业在观测中既无起点也无标记 —— "缺产物/无进展"类不一致是观测口径问题，不是事实

- **现象**：progress-observer 在 pr-004 派发后约 5 分钟观测，报「pr-004 缺 tasks 文件」「0 commit / 0 交付物 / 工作树 clean / 三次采样完全相同」；同一份报告也如实标注了「不便区分'尚未生成'与'正在生成'」（§6 第 5/6 条）。
- **根因**：观测者拿不到"派发时刻 + 预期产物"这一对锚点，只能把"不可见"写成"缺失"；而 `status.md` 的 `⏸` 只表示"进行中"，不含起始时刻与在途标记。
- **证据**（`实测`）：`progress.md` §5 第 3/4 条与 §6 第 5/6 条；对照 `history.md` 17:12:23——planner 报告与 dev 派发同刻发生，即观测窗口与真实产出窗口重叠，而非产物缺失。
- **三问过滤**：①✓；②✓（任何带后台作业的流程）；③✓ ——「观测在途作业时先记录其起始时刻与预期产物，把'未出现'记为在途未知，不记为缺失」。
- **建议处置**：候选（低优先）。

## P-8 隔离不等于强制 —— 跨路径写入绕过工作区边界

- **现象**：pr-003 的 dev 在自己的 worktree 内工作期间，**误写主工作树三笔 edit**，发现后靠 `cp` 备份 + `git checkout --` 在主工作树还原。
- **根因**：worktree 分离的是"默认 cwd 下的 git 状态"，不构成访问控制；任何绝对路径写入、`git -C <他人工作区>`、`--work-tree` 都不受约束。恢复动作本身又是在**共享工作树**上执行了一次写操作。
- **证据**（`实测`）：`0017/history.md` 第 204 行（pr-003 dev 报告"违反边界的事"）：「**主工作树误写三笔 edit 已完全还原**（发现后 cp 备份 → `git checkout --` 还原主工作树 → 复核 `-- oamp/` diff 为空 → 同一内容改写入 worktree）」。
- **三问过滤**：①✓；②✓；③✓ ——「以绝对路径跨工作区写文件前，先确认该路径属于本会话的工作区；恢复他人工作区的内容必须先取一份备份」。
- **建议处置**：候选（本迭代可作为 P-9/P-11 相邻边界的一句话负面约束；若用户认为属个别操作失误，记案例）。

## 2.9 一并记录、明确不构成候选的观察（三问不通过 → 记案例）

| # | 观察 | 一手证据 | 三问不通过的原因 |
|---|---|---|---|
| C-1 | 0017 `status.md` 的**已提交版**（`fc76fcd`）写着 `min(3 + 2×3, 5)`，工作区/终版为 `min(3 + 4×3, 5)` | `progress.md` §4 末段对照；终版 `status.md` 第 37 行 | 一次笔误，②换场景不适用（不构成可复用的判断） |
| C-2 | 0017 收尾提交 `028ca8a` 一度只由 `iteration/0018-…` 一个 ref 持有（0017 分支 ref 已删） | `git branch -a --contains 028ca8a`；`028ca8a` 与 `9ede9ea` 的 0017 文档内容等同（`diff` 无差异，后者为前者超集） | 是 P-1 的一次性后果，且**无内容丢失**；根因已由 P-1 覆盖 |
| C-3 | 本地 `main` 领先 `origin/main` 16 个提交，且 `workflow-pb.md` 全文无 push/远端步骤（`grep 'push\|origin'` 零命中） | `git rev-parse main origin/main`；`roles/workflow-pb/workflow-pb.md` grep | 规范空白而非状态漂移；是否补 push 条款取决于发布方式（用户偏好，不猜） |
| C-4 | 0019 `demand.md` N5 声称残留项含「孤立分支 `iteration/0004-model-dispatch`」，实际不存在（其余三项目前确实存在） | `git show-ref` / `git branch -a` → 仅 `0018`/`0019`/`main`/`origin/main`；`ls /tmp/pb-0017-residual/`（3 文件）、`.pb-agents/worktrees/`（空，mtime 17:30）、`.worktrees/`（空） | 一次性事实过期（不影响结论，只需更正该行） |
| C-5 | 0017 `status.md` 阶段 1/2/3/5 的「已验证」列为 `⬜`，阶段 4/6 为 `✅`；阶段 6 行备注曾被读成"阶段 6 已验证" | `status.md` 第 14-19 行；`progress.md` §5 第 6 条 | 列语义未定义属文档体例细节，影响低；等出现真实误判再升级为原则 |

---

# 三、做得好的地方

## G-1 阶段 5 的 PR 级 worktree 隔离在真实并发下被证成（支撑本迭代机制选择的最强正面证据）

- **做了什么**：首波 pr-001 ∥ pr-003 各自在独立 worktree（`.pb-agents/worktrees/pr-001`、`…/pr-003`）内实现，各自只改自己 PR 文件范围内的文件，合并进迭代分支后才解锁 pr-002。
- **为什么有效**：工作目录 / 索引 / HEAD 按工作区分离后，两个 PR 的代码**在物理上不可能互相污染**——而这正是 P-1 四类损害发生的层。
- **证据**（`实测`）：
  1. 两条分支同基点、互不包含：`2e9a950` 与 `40151ff` 的父提交同为 `2af9f3d`，两提交时间（16:21:41 / 16:19:28）均早于首个合并（`9e1f4d4`/`a9fef01` 均 16:35:51）。
  2. 两个 worktree 曾同时在盘（dev 报告给出路径与 HEAD；`verify-pr-001-…md` 第 6/34 行给出 `git -C …/worktrees/pr-001 diff --name-only` 的输出恰为 2 个文件）。
  3. 主工作树零残留：`history.md` 16:22:23 触发依据记「两 worktree `git status --short` 干净；主工作树 `git status` 仅含迭代 docs 改动与两份 tasks」。
  4. 阶段 6 独立复核（`verify-stage6-…md` 第 100-107 行）判定"两条并发分支同时开放"成立，并如实标注 git 不能证明进程级并行。
- **三问过滤**：①✓ ②✓ ③✓ ——「并发单元（PR / 会话）各自拥有独立工作区；隔离只到工作目录 + 索引 + HEAD 这一层」。
- **建议处置**：**升级为原则候选**（本迭代核心候选；同时它是 Q-a 判 worktree 而非 clone 的直接依据）。

## G-2 独立验证用"反向证伪"而不是"复跑通过"

- **做了什么**：pr-004 验证者不只跑测试，还做变异实验与并发破坏实验。
- **为什么有效**：复跑只能证明"当前是绿的"，破坏实验才能证明"断言真的在把关"。
- **证据**（`实测`）：`verify-pr-004-…md`——删外键 → 2 红、`DB_REBUILT` 改 stderr → 红、末位 argv 多一个 `\n` → 红；另记录一轮**并发跑 6 个 `node --test` 的变异实验**造成全量 271/272，安静环境重跑 272/272（第 285 / 314 行）。阶段 6 验证者亦独立重算 `llms.txt` 字节相等。
- **三问过滤**：①✓ ②✓ ③✓ ——「验证一条断言是否在把关时，先把它依赖的实现破坏掉，确认断言变红」。
- **建议处置**：**升级为原则候选**（写进 `verifier` 相关口径或 principles）。

## G-3 观测者只读、不采信自我声明，并把「不一致」与「无法核实」分列

- **做了什么**：progress-observer 在 0017 内跑了三次、0018 内跑了一次，全部只读 git，且每次都单列"发现的不一致"与"无法核实项"。
- **为什么有效**：两列分开，读者不会把"我没核到"当成"它是错的"；也正是靠它，0018 才抓到自己基线声明 B-1/B-2 与事实矛盾。
- **证据**（`实测`）：`0017/progress.md` §5（7 条不一致，含 1 条已消解）+ §6（12 条无法核实）；`git show iteration/0018-…:…/progress.md` 第 84-102 行 3 条不一致 + §6 4 条无法核实；`verify-stage6-…md` 第 107 行明确写「git 能证明 / 不能证明」。
- **三问过滤**：①✓ ②✓ ③✓ ——「输出观测结论时，把'与事实矛盾'与'无法核实'分列，不把后者写成前者」。
- **建议处置**：**升级为原则候选**。

## G-4 他人未完成的现场保持只读不动

- **做了什么**：0018 启动时发现 0017 的 pr-004 现场（worktree + feat/pr-004），按"现场保留"不清理；用户亦明确"0018 分支与其未跟踪目录我未触碰"。
- **为什么有效**：pr-004 在 17:30:53 才被验收合并——若 0018 提前清理该现场，会直接破坏另一个会话正在进行的验收上下文（且现场清理不可逆）。
- **证据**（`实测`）：`workflow-pb.md` 第 279 行（失败/阻塞现场必须原样保留，禁止主 agent 清理）与第 304 行（progress 核实项）；`git show iteration/0018-…:…/history.md` 第 5 行「0017 现场 … 按『现场保留』不清理、不纳入 0018 范围」；`git show iteration/0018-…:…/progress.md` §6 第 4 条（现状核实一致：无 feat 分支、`.git/worktrees` 不存在、两个 worktree 目录为空）。
- **三问过滤**：①✓ ②✓ ③✓ ——「遇到非本会话产出的现场或未跟踪内容，默认只读不动，清理权归其归属方」。
- **建议处置**：候选（可作为 P-12 类条款的依据；现行规范已有同构条款，价值在于**把"跨会话"情形写明**）。

## G-5 用户裁决逐条留痕（含原话）

- **做了什么**：0017 把 P-1~P-11、MI-01~MI-08、D-01~D-04 与各角色提请的推断逐条记录裁决结果；0019 记录用户原话。
- **为什么有效**：事后能重建"为什么这么定"，也是本次复盘能判定"哪些是用户决定、哪些是 AI 推断"的前提。
- **证据**（`实测`）：`0017/status.md` 第 52-58 行；`0019/status.md` §用户确认记录（逐字原文）；`0019/history.md` 18:01:00 条（P-1~P-14 逐组裁决）。
- **三问过滤**：①✓ ②✓ ③✓ ——「记裁决时保留用户原话与逐项结果，不只记结论」。
- **建议处置**：记案例（体例已稳定存在，无需新增原则）。

---

# 四、专项回答

## Q-a（对应 0019 的 P-1）：worktree 还是 clone？隔离边界在哪一层？0017 里哪类问题会被覆盖、哪类不会？

### A-1 两种机制的隔离边界（逐层）

| 层 | `git worktree`（同一 `.git` 下的链接工作区） | `git clone`（独立仓库） |
|---|---|---|
| 工作目录 | **独立**（每个 worktree 自己的目录） | 独立 |
| 索引（index） | **独立**（记录于 `.git/worktrees/<id>/index`） | 独立 |
| HEAD | **独立**（每个 worktree 各自检出/游离） | 独立 |
| 分支 / 标签 / stash / 远端等 **refs** | **共享**（同一 refs 命名空间） | 独立（自己的 refs） |
| 对象库（objects） | 共享 | 独立（另一份） |
| config / hooks / remotes | 共享 | 独立 |
| 「同一分支能否同时被两处检出」 | **不可**（git 硬约束） | 不受此约束（是两个仓库） |

### A-2 0017 的真实证据支持哪种

**判断：worktree 足够，且是更优解。** 依据有三条，均为一手：

1. **0017 观察到的四类损害全部发生在 worktree 恰好隔离的那三层**（工作目录 / 索引 / HEAD）：未跟踪产物混合（工作目录）、提交落到他人分支（HEAD）、切换被他人改动阻塞（索引 + 工作目录）、同一文件被交替读写（工作目录）——见 P-1 证据与 `progress.md` §5。*（条目的"四类"分类引自 `incident-20260912.md` 的框架，但每一类的具体证据由本报告独立核实。)*
2. **同一机制已在 0017 的 PR 粒度被证成**：pr-001 ∥ pr-003 在独立 worktree 内并发完成、互不污染（G-1）。把同一机制从"PR 粒度、短生命周期"提升为"会话粒度、长生命周期"，是**降低风险**而不是引入新机制类型。
3. **clone 的额外隔离（独立 refs/对象库）在 0017 证据里没有任何对应需求**：0017 没有出现"stash 被抢走""两个会话需要同名但不同内容的标签""对象损坏"等需要独立 refs 的症状；而 clone 的代价是双份对象库 + 第二套流程（与阶段 5 现有 worktree 机制不再同构）。

### A-3 worktree **会**覆盖的（0017 已实证）

- 未跟踪产物混在同一工作区（工作目录分离）；
- 会话 A 的 `checkout` / 未提交改动阻塞会话 B（索引与工作目录分离）；
- 一个会话的提交因"工作树当前停在别人的分支"而落错分支（HEAD 分离）——**0017 的 `028ca8a` 正是这一类**；
- 同一文件被两会话交替读写（工作目录物理分离）。

### A-4 worktree **不会**覆盖的（逐条附 0017 证据或标明推断）

1. **分支命名空间与 refs 仍是共享的** ⇒ 命名冲突、以及"从 ref 读出错误结论"仍会发生。
   - 证据（`实测`）：`progress.md` §5 第 5 条——`git branch --merged iteration/0017-project-workspace` 把 `feat/pr-004` 列为"已合并"，因为该分支指针与迭代分支**同点**（`git rev-parse` 两者相等），这是一条极易被误读的一手输出。
2. **"同一分支不能在两处同时检出"是 git 硬约束** ⇒ 现行"迭代分支合并进 main"三步（`checkout main` → `merge --no-ff` → `branch -d`）在多工作区下必须换位置执行。
   - 证据（`实测`）：0017 收口确实执行了这三步（`0017/history.md` 17:41:44 与 17:42:52 两条调度决策；reflog 可见 `checkout: moving from iteration/0018-… to main` 与 `merge iteration/0017-project-workspace`），**且该动作全程假定"工作区可以被切到 main"**。0017 未直接撞上此错误（当时另一会话不在 main 上），因此这一条属结构性推断 `[INFERENCE]`，与 0019 `demand.md` C-2 的结论一致。
3. **非 git 的共享资源不被隔离**：
   - 端口：真实服务默认 **7788 固定**（`oamp/README.md` 第 89 / 123 行，`OAMP_WEB_PORT` 可覆盖）⇒ 两个会话同时起真实服务会撞端口；测试面已规避（`oamp/test/project-workspace.test.js` 第 121-123 行 `pickPort()` = `41000 + rand(2000)`）。
   - CPU / 负载：pr-004 验证者并发跑 6 个 `node --test` 时全量 **271/272**，安静环境 272/272（`verify-pr-004-…md` 第 285 / 314 行）；pr-001 dev 首跑亦有 1 例无法解释的失败、同代码连跑 4 次全绿（`0017/history.md` 第 196 行）；既有 `router-registry.test.js:135` 的 SIGINT 用例被记为"负载敏感"。
   - 临时目录：`/tmp` 共享，0017 期间多条工具链共用（`/tmp/pr001-probe/`、`/tmp/oamp-verify-pr001/`），残留至今仍在盘上（`/tmp/pb-0017-residual/`）。
   - 进程内注册表：`hub jobs` 不跨会话且会过期（P-2 的直接成因）。
4. **被忽略/未跟踪的状态不随工作区出现**：`.pb-agents/roles/` 等（详见 Q-b）⇒ 新工作区会卡在 SKILL Step 0。
5. **隔离不是强制**：绝对路径写入可以跨工作区生效——pr-003 dev 误写主工作树三笔 edit（P-8）。

### A-5 结论（给 demand 的判断，供用户裁决用）

选 **worktree 作为规范默认且唯一被规范化的形态**；同时规范必须补上 A-4 的 5 类残留（至少 1、2、4 三类），否则"每会话独立工作区"在最容易被撞到的环节上仍会失败。clone 保留为"无法共享同一 `.git`（跨机/无写权限）"的兜底声明，本迭代不为其定义流程。

## Q-b（对应 0019 的 P-8）：新工作区"不用装任何东西就会干活"的前提；哪些天然存在/不存在；"角色文件从哪来"

### B-1 前提清单（5 条，逐条附证据）

| # | 前提 | 证据（`实测`） | 当前是否满足 |
|---|---|---|---|
| 1 | **会话的 cwd 必须在新工作区根目录**（Step 0 与全部文档协议都按相对路径判读） | `SKILL.md:96-97`（检测 `.pb-agents/roles/` 相对路径）、`workflow-pb.md` 状态/文档路径协议均按 cwd 相对 | 不满足（新工作区创建后无人保证会话在其中启动；主 agent 能否自迁移 cwd **不可核实**，见 U-6） |
| 2 | **`.pb-agents/roles/` 必须可达** | `SKILL.md:42`（CRITICAL：根路径固定 `.pb-agents/roles/`，不得退回读 `roles/`）、`:133`（不存在 → 停止推进）、`:220-226`（不分"自身开发/业务部署"两场景） | **不满足**：`.pb-agents/` 被 `.gitignore:2` 整体忽略 ⇒ `git worktree add` 产出的新工作区没有该目录 ⇒ **Step 0 必停** |
| 3 | 代码面零安装即可运行测试 | `oamp/package.json`：`"dependencies": {}`、`"scripts": {"test": "node --test test/*.test.js"}`、`"engines": {"node": ">=22"}`；仓库内**不存在** `oamp/node_modules`（`ls` 实测） | **满足**（零第三方依赖是既有工程锁） |
| 4 | 运行时目录可自动创建，无需预置 | `oamp/src/persist.js:179-183`（`mkdirSync(path.dirname(dbPath), { recursive: true })`；注释明写"目录不存在 → mkdir -p，`data/` 被 gitignore，首次运行必然不存在"） | **满足** |
| 5 | 除仓库内容外不需要任何外部资源 | `oamp/web` 监听 `127.0.0.1`、无鉴权（`oamp/README.md:146`）；测试自带 harness（`oamp/test/helpers/`），用临时 socket 目录与随机端口 | **满足**（但真实服务默认端口 7788 固定，见 A-4.3） |

### B-2 新工作区里"天然存在 / 天然不存在"逐项（含忽略依据）

**天然存在（被 git 跟踪 ⇒ `git worktree add` 检出时即出现）**

| 路径 | 跟踪文件数（`git ls-files` 实测） | 说明 |
|---|---|---|
| `docs/**` | 352（+6 条含引号路径） | 全部迭代文档 |
| `roles/**` | **62** | 角色定义**源码**：`roles/<role>/<role>.md` + `memory.md` + `data/**` + `_template/` |
| `oamp/**` | 59 | 产品代码 + 测试（`data/`、`.runtime/` 除外） |
| `.claude/**` | 19 | 含 `.claude/skills/workflow-pb/SKILL.md` |
| `principles/**` | 8 | 原则文件与 changelog |
| `tools/**` | 3 | 含 `install-pb-agents.sh` |
| `tests/**`、`cluster.json`、`README.md`、`.gitignore` | 2 / 1 / 1 / 1 | 其余根级内容 |

**天然不存在（被忽略或不被跟踪）**

| 路径 | 依据（`git check-ignore -v` / `git status --ignored` 实测） | 影响 |
|---|---|---|
| `.pb-agents/**` | `.gitignore:2`（`.pb-agents/`） | **含 `.pb-agents/roles/`（10 个角色目录，每个仅 `<role>.md`）、`.pb-agents/principles/`（`execution/`、`meta/`）、`.pb-agents/worktrees/`（空，mtime 17:30）** ⇒ Q-b 的核心缺口 |
| `.pb-agents/worktrees/**` | `.gitignore:4` 另有一条显式条目 | 同上（阶段 5 PR worktree 落点） |
| `.worktrees/`（仓库根空目录） | **不被忽略**，但**未被跟踪**（git 不跟踪空目录） | 新工作区里不会出现；若手工创建会立刻出现在 `git status` 中（`0019/demand.md` §3.3 关于"是否被全局 excludesFile 覆盖"的 `[UNVERIFIED]` ⇒ 本次核实：`core.excludesFile` 未设置，实际生效的全局忽略文件是 `~/.config/git/ignore`，其内容仅一行 `**/.claude/settings.local.json` ⇒ **`.worktrees/` 未被任何忽略源命中**，该 `[UNVERIFIED]` 项可关闭） |
| `oamp/data/**` | `oamp/.gitignore:2`（`data/`） | 真实库 `oamp/data/sql.db` 不会出现（首次运行 `mkdir -p` 自动创建，见 B-1 第 4 条） |
| `oamp/.runtime/**` | `oamp/.gitignore:1` | 运行期状态，按需生成 |
| `.claude/settings.local.json` | 全局忽略 `~/.config/git/ignore:1` | 与角色文件无关 |
| `.idea/` | `.gitignore:1` | 与角色文件无关 |

### B-3 「角色文件从哪来」的可行解（在"不依赖安装脚本"约束下）

> 各方案的证据均为 `实测`；这里只给证据与代价判断，**不替用户定案**（本迭代该决策点在 P-8）。

| 方案 | 做法 | 证据支撑 | 代价 / 风险 |
|---|---|---|---|
| **A1 把部署 copy 纳入版本控制** | 改 `.gitignore` 为选择性忽略，跟踪 `.pb-agents/roles/**` 与 `.pb-agents/principles/**`（其余仍忽略），使新工作区检出即得 | 唯一阻挡就是 `.gitignore:2`（`git check-ignore -v` 逐条给出）；`.pb-agents/roles/<role>/` 内容 = `roles/<role>/<role>.md` 的副本（安装脚本第 38-56 行只 copy 该文件；0018 会话的 `diff -rq` 结论为"仅 `data/`、`memory.md`、`_template`、`cdp-debug-skill` 有差，均为不部署项"，见 `git show iteration/0018-…:…/history.md:5`） | 源码与 copy 两份需同步（`SKILL.md:226` 已把该代价写明）；需要精确的 gitignore 否定规则（`.pb-agents/*` + 逐层 `!`），易写错 |
| **A2 把角色根部指向被跟踪的 `roles/`** | 让 SKILL 的角色文件根路径在本仓库场景解析到 `roles/`（62 个跟踪文件，结构完整：每角色一个 `<role>.md`）；`.pb-agents/` 仅保留为**业务项目**的安装落点 | `roles/**` 已被跟踪且结构完整（`git ls-files roles`）；`SKILL.md:42/220` 明确规定"不分场景、固定 `.pb-agents/roles/`、不得退回读 `roles/`" ⇒ 采用本方案**必须改规范文本** | 需要改动 SKILL 的 CRITICAL 条款（属本迭代范围内的规范文本改写）；但能一次消除"新工作区必停"且无需任何安装动作；副作用是**角色文件改动会直接进入工作区 diff**（对本仓库而言这恰是"源码即真源"的正向效果） |
| **A3 提交相对符号链接** | 在 git 中提交 `.pb-agents/roles -> ../roles`（相对链接），使每个工作区各自的 `.pb-agents/roles` 指向**本工作区**的 `roles/` | 需要 A1 的否定规则（`.pb-agents/` 被忽略时链接本身也不会被检出）；macOS 支持符号链接（`[INFERENCE]`：未实测 git 检出符号链接的跨工作区行为） | 引入符号链接这一新形态；Windows 上不可靠；与"只改文本"的取向不符 |
| **B 指向仓库主工作区绝对路径**（demand P-8 方案②） | 一处安装、多会话共用同一份 copy | 安装脚本每次运行 `rm -rf` 目标 `roles/`、`principles/` 再 copy（`install-pb-agents.sh` 第 36-37 行） | **与本次目标相矛盾**：多个会话共享同一份**可变** copy，一个会话跑安装就会清空其他会话正在读的文件；且违反 `SKILL.md:228`「`.pb-agents/roles/` 是只读 copy」的定位 |
| **C 会话自建工作区时自动执行安装脚本** | 每个新工作区自动 copy 一次 | 安装脚本是幂等覆盖、默认目标是 `$(pwd)`（第 28 行），无需改造即可指向工作区 | 违反用户"不依赖任何工具、不用额外动作"的约束（需要一个额外执行步骤/依赖脚本存在） |

**结论（给 demand 的输入）**：
1. "不用装任何东西"这一诉求，**在本仓库自身（agents 仓库）是可满足的**——因为角色文件的真源 `roles/**` 本来就随每次检出出现；瓶颈只是 `SKILL.md:42/220` 把根路径钉死在被忽略的 `.pb-agents/roles/`。
2. 在**业务项目**场景，"不装"不可能成立：角色文件本来就是被安装进去的产物。因此该约束的准确含义应是"**不需要人手动跑安装脚本、不需要额外动作**"，而不是"任何项目都不需要角色文件安装"。这一区分建议在需求层写清（否则会在架构阶段出现无法同时满足的两条）。
3. 若要保持 SKILL 现有条款不动，则 A1/A3 是唯一"零动作"路径；A1 是三者中最保守的（不新增机制类型，只调整忽略范围）。

## Q-c（对应 0019 的范围）：0017 还有哪些真实问题？

> 逐条给出**有 / 无**与证据。

### C-1 `pr-004` 的 dev 作业"中途丢失" —— **有现象，但"丢失"是误判**

- **有**：另一会话确实这样登记过。证据：`git show iteration/0018-…:docs/iterations/0018-chat-agent-subagent-protocol/history.md` 第 5 行（17:27:04）：「0017 status.md 阶段 5 未完成且 `hub jobs` 无存活 dev 作业（pr-004 作业已丢失）」。
- **但结论为误判**：`60ba902` 的提交时间是 **17:21:05**（`git log -1 --format='%h %ci %s' 60ba902`），0017 `history.md` 在 **17:21:46** 记录了 pr-004 dev 的报告（单文件 21/21、全量 272/272），`428e672` 在 **17:30:53** 合并。⇒ 17:27:04 检查时，dev 作业**已正常结束约 6 分钟**，当时 pr-004 正在 PR 级验收（verifier 报告落于 17:32:04）。"无存活作业"≠"作业丢失"。
- **不可核实**：是否存在更早一次真实丢失/中断的 dev 派发。0017 全部记录里 pr-004 的 dev 只有"一次派发（17:12:23）+ 一次报告（17:21:46）"，未见重派；但若一次派发被静默丢弃且未留痕，git 无法证伪。
- **归因**：见 P-2（跨会话状态可见性缺失）；不是 0017 自身的执行缺陷。

### C-2 阶段 6 由另一会话接手并产生跨会话提交 —— **有**

- **时间线（`实测`，reflog + 提交归属）**：
  1. 17:32:04 S-0017 派发阶段 6 verifier（`0017/history.md`）；
  2. 17:40:47 工作区 `checkout: moving from iteration/0017-project-workspace to iteration/0018-chat-agent-subagent-protocol`（另一会话建 0018 分支并切换）；
  3. 17:41:44 `commit 028ca8a`（0017 的阶段 6 收口：新增 verify-stage6 278 行 + `history.md` +46 + `status.md` 51 行变更）——**落在 `iteration/0018-…` 上**；
  4. 17:41:44 同一分钟 `checkout: moving from iteration/0018-… to main` → `merge iteration/0017-project-workspace` → main 得 `03a2f00`；随后删除 0017 迭代分支；
  5. 17:46:02 main 再收 `9ede9ea`（0017 收口台账：同名三件，+358/−23）；
  6. 17:52:46 另一会话把工作区切回 0018 后提交 `a905848`。
- **后果**：0018 分支混入一个与自身无关的提交；`028ca8a` 一度**只由 0018 分支一个 ref 持有**（`git branch -a --contains 028ca8a` → 仅 0018；`git merge-base --is-ancestor 028ca8a main` → 非 0）。若该分支被删，该提交仅存于 reflog。
- **但无内容丢失**：`9ede9ea` 的三件内容 ⊇ `028ca8a`（`diff <(git show 028ca8a:history.md) <(git show 9ede9ea:history.md)` 只显示后者多 6 行；verify-stage6 两版逐字节相同；`git diff --stat 428e672 9ede9ea -- docs/iterations/0017-project-workspace/` = 3 files / 358 insertions / 23 deletions）。
- **另一个连带事实**：0018 会话为此被迫走了非标准路径（`git show iteration/0018-…:…/status.md` 更新日志：备份 → `checkout -m` → 并集解冲突 → 恢复残留，全程零内容丢失）。

### C-3 stage-6 验证报告在两版本间存在一字符差异 —— **有，且比"一字符"更值得注意**

- 差异确认：提交进 main 的版本（= `028ca8a` 与 `9ede9ea`，两版逐字节相同）第 160 行写 `:695-699`；`/tmp/pb-0017-residual/verify-stage6.worktree.md`（与 `…moved.md` 经 `cmp` 判字节相同）第 160 行写 `:695-698`；总差异仅此一行（`diff | wc -l` = 4）。
- 更值得注意：**提交版的报告自相矛盾**——同一文件第 77 行写 `:695-698`，第 160 行写 `:695-699`；而残留版两处都是 `:695-698`（自洽）。
- **源真值（独立取证）**：`git show 428e672:oamp/src/web.js | nl -ba | sed -n '690,700p'` ⇒ `692` = `const project = …`；`695` = `: body.one_shot === true`；**`696`/`697` = 两条 LLM 分支载荷**；`698` = `let dispatched = null;` ⇒ 两个版本都不精确，残留版更接近且自洽。
- **不可核实**：谁在何时改写、以哪个方向改写。该报告在被提交前是**未跟踪**文件，git 无任何中间版本；可核实到的只是"17:41:44 已提交的内容 = `:695-699`"而"17:44 从工作区移开的副本 = `:695-698`"。
- **与本迭代的关系**：不属 0019 范围（`0019/demand.md` N2、`0019/status.md` §待确认项均已排除），但它**是本迭代根因的同类症状**（P-3/P-4），建议作为"为什么必须落盘即提交"的实例留在案卷中。

### C-4 D-2 被登记为「下一迭代第一优先候选」 —— **有登记，且至今无承接方**

- 登记事实：`0017/status.md` 第 46 行「**D-2（中·用户可见缺陷·第一优先）**：`GET /api/chats` 与 `POST /api/messages` 的路由登记元数据 `params` 未包含必填参数 `project_id` ⇒ `/docs` 参数面不完整、`/debug` 调试台无法调用这两条既有接口（实测返回 400）」。
- 缺陷真实性（独立取证）：`verify-pr-002-…md` 第 247 行 A-7 给出 `params` 数组原文比对与 `/docs` 投影缺失；阶段 6 报告 `verify-stage6-…md` 第 269 行 ④(b) 将其确认为用户可见缺陷（`/debug` 实测 400）。**该缺陷在 0017 未被修复**（修复会触碰 `architecture §6.1` 的硬契约，主 agent 裁定不返工）。
- 承接状态：**两个后续迭代都显式排除**——用户裁决 C-3「不纳入 0018」（`0019/status.md` §用户确认记录）；`0019/demand.md` 第 211 行 N2「不处理…0017 遗留缺陷 D-2」。⇒ 以当前记录判断，**D-2 属于无人承接的挂起项**，而 0019 又新增了一个同名 D-2（`0019/status.md` §待确认项 D-2 = 一字符差异），跨迭代引用必然混淆。同类的无承接项还有 0017 D-1（`errors` 缺 `PAYLOAD_TOO_LARGE`）、pr-004 的 N1~N6、`PROJECT_AGREEMENT` 具名导出。
- 归因：见 P-6。

### C-5 0017 期间的其他状态漂移（逐项）

| # | 漂移 | 有/无 | 证据 | 现状 |
|---|---|---|---|---|
| 1 | `architecture.md` 未回填 D-01~D-04 裁定 | **有** | `git log --oneline -- architecture.md` 仅 `2af9f3d`；`architecture.md:5` 仍为"待主 agent 确认" | 未修复（主 agent 明确选择"保持作者时点表述"） |
| 2 | `status.md` / `history.md` 长期处于未提交状态 | **有** | `progress.md` §5 第 2 条（两次观测均在）；0018 侧 `progress.md` 第 84-88 行 | **已随 `9ede9ea` 提交闭环** |
| 3 | 有效上限注记算式滞后（`min(3 + 2×3, 5)`） | **有** | `progress.md` §4 末段（`fc76fcd` 已提交版） | **已修正为 `min(3 + 4×3, 5)`**（终版 `status.md` 第 37 行；对应阶段 6 偏差 D-3） |
| 4 | 更新日志未覆盖 pr-004 | **有** | 阶段 6 偏差 D-4 | **已修正**（终版 `status.md` 更新日志含 pr-004 全链路） |
| 5 | 派发后 5 分钟内 planner 产物不可见 → 被记作"缺 tasks 文件" | **有** | `progress.md` §5 第 4 条、§6 第 6 条（与 pr-002 的同类缺口在 `fc76fcd` 补齐） | 观测口径问题（P-7），非产物缺陷 |
| 6 | 「已验证」列语义不自洽（1/2/3/5 = `⬜`，4/6 = `✅`） | **有** | `status.md` 第 14-19 行；`progress.md` §5 第 6 条 | 未修复（记案例 C-5） |
| 7 | 0017 收尾提交只挂 0018 分支 | **有** | `git branch -a --contains 028ca8a` | 未修复（内容已在 main，无丢失；记案例 C-2） |
| 8 | 本地 `main` 领先 `origin/main` 16 提交，工作流无 push 条款 | **有** | `git rev-parse main origin/main` → `9ede9ea` / `1c37e80`；`grep 'push\|origin' workflow-pb.md` 零命中 | 规范空白（记案例 C-3） |
| 9 | 0019 `demand.md` N5 声称"孤立分支 `iteration/0004-model-dispatch`" | **无**（该分支不存在） | `git show-ref` / `git branch -a` → 仅 `0018`/`0019`/`main`/`origin/main`；另三项残留确实存在：`/tmp/pb-0017-residual/`（3 文件）、`.pb-agents/worktrees/`（空）、`.worktrees/`（空） | 需更正该行（记案例 C-4） |
| 10 | 0018 基线的两条声明（"0017 仍缺阶段 6 与合并 main"、"status.md 与 history.md 两份均脏"）被事实推翻 | **有** | `git show iteration/0018-…:…/progress.md` 第 96-102 行 | 已由该会话自己核实并修正（`…/history.md` 第 72 行记录基线事实修正） |
| 11 | 0019 自身产物当前仍以未跟踪状态存在（自保措施未执行） | **有** | `git status --porcelain` 现输出：` M docs/iterations/0019-…/history.md`、`?? demand.md`、`?? clarifications/round-1.md`、`?? clarifications/demand-round-1-proposals.md` | **进行中**（与本迭代要解决的问题同形；建议主 agent 立即处理） |

---

# 五、无法核实项（如实列出，不给结论）

| # | 项 | 为什么核不到 |
|---|---|---|
| U-1 | 两个会话是否**进程级并行**（而非同一执行者交替推进） | git 只留拓扑与时间戳；两个 PR 分支与 worktree 注册均已清理（`git worktree list` 仅根工作区、`.git/worktrees` 不存在）。`progress.md` §6 第 10 条与 `verify-stage6-…md` 第 107 行有同样声明 |
| U-2 | 阶段 6 报告 `:695-699` / `:695-698` 是**谁在何时**改的 | 该文件被提交前是未跟踪状态，git 无中间版本（P-4 / C-3） |
| U-3 | 0018 在 17:27:04 实际运行 `hub jobs` 的输出 | 进程内注册表已随会话消失，无日志留存；只能读到其书面结论（`git show iteration/0018-…:…/history.md:5`） |
| U-4 | 0018 两次 `git checkout` 失败的确切报错，以及"stash 已无内容可 stash" | reflog 不记录失败尝试；无终端日志；`git stash list` 现在为空但无法回放当时状态（该症状仅见于 `incident-20260912.md` §2 的叙述，本次未能独立复现） |
| U-5 | `9ede9ea` 是被怎样执行出来的（是否用过 `git -C`/显式 ref，或曾短暂 checkout 到 main） | reflog 在该时段只记录 `checkout: moving from iteration/0018-… to main`（17:52:46）与 `commit 9ede9ea`（17:46:02），中间过程无记录（与 incident §5 第 2 项同结论） |
| U-6 | 主 agent 能否让**自身会话**迁移到新工作区（cwd 自迁移能力） | 取决于宿主实现，本次未经实测；`0019/demand.md` R-2 已标 `[INFERENCE]`。直接决定 Q-b 前提 1 的可达方式 |
| U-7 | 是否存在第三个写入方（用户手工操作） | 无法从 git 归属判定（同 incident §5 第 3 项） |
| U-8 | 0017 期间是否真的没有发生任何内容丢失 | 可核实的是"当前文件状态与 main 一致、`028ca8a` 内容被 `9ede9ea` 覆盖"；中间过程是否曾被覆盖后手工恢复，仅有另一会话的叙述（"零丢失"），无独立证据 |
| U-9 | 是否存在更早一次被静默丢弃的 pr-004 dev 派发 | 记录中只有一次派发/一次报告；若丢弃过程未留痕，git 与文档均无法证伪（C-1） |

---

# 六、交付前自检

| 项 | 结果 |
|---|---|
| 读过的文件 | 15 组（见 §1.2），含 0017 全部关键产物、0019 全部现有产物、0018 分支上的 4 份产物、4 份 ignore 文件、2 份规范文件、3 份代码/测试文件、3 份 `/tmp` 残留 |
| 跑过的只读 git 命令 | 22 类（见 §1.3）；**未执行任何写入性 git 命令**，未跑测试/构建，未改 `roles/**`、`.pb-agents/**`、`principles/**`、任何 `memory.md` 与任何既有产物 |
| 发现的**问题**条数 | 8 条（P-1 ~ P-8）+ 5 条明确不构成候选的观察（C-1 ~ C-5，§2.9） |
| 发现的**好的做法**条数 | 5 条（G-1 ~ G-5） |
| 通过三问过滤的候选数 | **13 条**（= 8 条问题发现 + 5 条好做法，三问逐条见正文）；其中**建议升级为原则** = 7 条（P-1、P-2、P-3、P-6、G-1、G-2、G-3）；**候选·低优先** = 5 条（P-4、P-5、P-7、P-8、G-4）；**通过三问但建议只记案例** = 1 条（G-5） |
| 因三问不通过而降级为案例的条数 | **5 条**（C-1 ~ C-5，§2.9，逐条给出不通过的原因） |
| 专项问题 | Q-a / Q-b / Q-c 三问全部回答，每条附证据行号或 git 输出要点；未把 `incident-20260912.md` 的结论当作事实复用（四类损害的分类框架引自该文件，但每一类的具体证据均由本次独立核实） |
| 无法核实项 | 9 条（U-1 ~ U-9） |
| 唯一写入 | 本文件 |
