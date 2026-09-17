# pr-007-tasks.md — pr-007 内部任务列表（模型归属载体与派发证据面，F08 + F09）

**运行模型标识**: deepseek/deepseek-v4-flash
**迭代**: 0030-hub-communication-upgrade ｜ **阶段**: 5（PR 实现）· 内部第一步（planner，子 agent 内部步骤）
**PR 文件**: `docs/iterations/0030-hub-communication-upgrade/prs/pr-007-model-routing-and-process-evidence.md`
**PR worktree（绝对路径，唯一产物写入面）**: `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence`
**PR worktree 分支**: `feat/0030-pr-007-model-routing-and-process-evidence`（快照时 HEAD = `f81d5c6`，`git status --short` 为空；与迭代分支 tip `2023e88` 的 merge-base = `f81d5c6`）
**任务总数**: **6**（T1~T6）｜ **依赖图**: **无环**（见 §2）｜ **关键路径**: `T1 → T3 → T4 → T6`（4 节点）
**性质**: 本 PR 内部任务列表（**不是**全局任务图），供 dev 消费
**输入真源**: PR 文件（10 条验收标准 + 文件范围）+ `architecture.md`（§1.3 硬约束 6、§4 A-08、§5 变更面「明确不改」、§6 表第 11 行、§7 L1-01、§10-6/§10-7）+ `prd/F08-model-attribution-routing.md`（验收 1~6 + 边界 + 架构维度）、`prd/F09-process-contract-and-friction-log.md`（验收 1~6 + 边界）+ `roles/workflow-pb/workflow-pb.md`（§派发执行角色时的 brief 构建、§阶段回退、§文档路径协议）+ `roles/workflow-pb/data/formats.md`（§历史记录协议、§状态追踪协议）+ `roles/workflow-pb/data/formats.md` §PR 文件格式规范 + **实读事实锚点**（§0.3，逐条带路径/行号）

> **本 PR 零代码改动**：产物是 docs 侧的 3 个新文档 + 1 处追加 ⇒ 全部判据是**文档面 grep/awk + 只读 git 命令 + 只读文件读取**，无测试可跑（本仓 `oamp/` 下无 `*.test.js`）。
> 判据中的两个脚本（§4.1 台账校验器、§4.2 锚点校验器）**已用 `/tmp` 一次性参照实现演练**：正例通过 / 反例被捕获 / 缺列负对照被捕获（结果见 §4.4）。

---

## 0. 范围、冻结契约与事实锚点

### 0.1 本 PR 可写文件面（唯一）

| # | 文件（PR worktree 相对路径） | 动作 | 内容（任务归属） |
|---|---|---|---|
| 1 | `docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md` | **新建** | 载体与路由声明（**T2**） |
| 2 | `docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md` | **新建** | 派发台账（F08 验收 4 + F09 验收 2 共用的**那一张表**）（**T3**） |
| 3 | `docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md` | **新建**（需建 `evidence/` 目录） | brief 抽检 + 阶段 6 取证形态声明（**T4**） |
| 4 | `docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md` | 改（**只在文件末尾追加条目**，0 行删除） | 摩擦搭置（**T5**） |

> 第 5 个写入面（**非 PR 交付物**）：本 tasks 文件的**末尾「执行证据（dev 回填）」段**（§8）。该文件位于**迭代工作区** `…/0030-hub-communication-upgrade/docs/iterations/0030-hub-communication-upgrade/prs/pr-007-model-routing-and-process-evidence-tasks.md`（**与 PR worktree 不是同一棵工作树**，见 §0.3 F2）——dev 的原始输出回填在此段，**不回填 PR 文件**、不新建证据文件。

### 0.2 非目标（零改动清单 / 防夹带）

- **零改动（`git diff` 必须为空）**：`oamp/**`（含 `oamp/sdk/**`、`oamp/web/**`、`oamp/API.md`、`oamp/llms.txt`、`oamp/skill/hub.md`）、`roles/**`（**含 `roles/verifier/data/*.md` 既有 3 份取证报告内的模型字面量**——见 §0.3 F8，一个字符都不许改）、`tools/**`、`cluster.json`、`data/**`（工作区外，框架面）、`docs/iterations/0030-hub-communication-upgrade/status.md`、`history.md`、`prd/**`、`architecture.md`、`demand.md`、`prd.md`、以及 `prs/` 下**除本 tasks 文件证据段外**的任何 PR 文件（含本 PR 自己的 PR 文件）。
  追溯：PR 文件「文件范围」+ AC10（"本 PR 文件范围内不含 `oamp/**`…；`status.md` / `history.md` 的格式规范不被改写"）+ AC2（"**不含**任何 `roles/**` 内的模型值"）+ `architecture.md` §5「明确不改（零改动）」明文列 `roles/**`、`cluster.json`、`oamp/sdk/**`、`oamp/web/**`。
- **不新建**：任何第二份"自报模型证据文件"（明确禁止 `evidence/f08-*.md`）、任何第二张台账表、目录（`evidence/` 除外，它是 PR 文件字面声明的落点）、测试文件、格式规范。
  追溯：PR 文件「共同面 = 台账」（"台账只此一份、只由本 PR 声明；不另立'第二份自报模型证据文件'"）+ AC5（"本迭代不存在第二份自报模型证据文件（无 `evidence/f08-*`）"）。
- **不改 `status.md` / `history.md` 与会话台账**：`status.md` 的 §派发台账 由**主 agent** 滚动维护；本 PR 只在**自己的**产物里建台账，**不代主 agent 回填/整理** `status.md` 任何一行（只读）。
  追溯：AC10；F09 边界（"不改变既有 `status.md` / `history.md` 格式规范"）；`data/formats.md` §状态追踪协议（status.md 由主 agent 更新）。
- **不做（属其他 PR）**：`reason.js` 与其消费点接线（pr-001 / pr-005）、`pool-routing.js`（pr-002）、`inbox` 持久化（pr-003）、空闲/安全网计时（pr-004）、`web.js` 六处接线（pr-005）、docs 面同步与 `llms.txt` 重生成（pr-006）、既有面冻结核查（pr-008）。
- **做错的形态（明确排除）**：① 把模型值以任何形式写入 `roles/**`（含"顺手在角色文件里加一行 model 注释"）；② 为了让 AC3 的**递归**读法通过而去改写 `roles/verifier/data/*.md` 里既有的模型字面量（那是**既有取证产物**，改写即篡改证据）；③ 把 hub 写成派发通道；④ 把摩擦条目当阻塞理由（暂停 / 回退 / 改需求）；⑤ 引入任何过程度量的工具化采集或机械门禁（F09 边界明文）——本 PR 全部判据是**一次性 grep/awk 与只读 git**，不落仓。

### 0.3 实读事实锚点（2026-09-17 实读；判据的可判定性基础）

| # | 事实 | 位置 / 依据 |
|---|---|---|
| **F1** | pr-007 worktree **已存在**且干净：分支 `feat/0030-pr-007-model-routing-and-process-evidence`；HEAD `f81d5c6`；`git status --short` 空 | 实测（`git -C <PR worktree> …`） |
| **F2** | **迭代分支已前进到 `2023e88`**（pr-001 已合并）。相对 f81d5c6 的差异含 `docs/…/status.md`、`history.md`、`architecture.md`、`prs/pr-002-…-tasks.md`、`clarifications/verify-20260917-143053-pr-001.md`、`roles/verifier/data/verify-20260917-143053-0030-pr-001.md` ⇒ **PR worktree 内的 `status.md` / `history.md` / `architecture.md` 是旧版本**：读这些"活动的"主 agent 产物必须用**迭代工作区绝对路径**（`<工作区地址>/docs/…`），写产物才在 PR worktree 内做 | `git -C <PR worktree> diff --name-only f81d5c6 iteration/0030-hub-communication-upgrade` |
| **F3** | 本 PR 的 3 个新建目标在 PR worktree 与迭代工作区**均不存在**（`model-routing-carrier.md` / `dispatch-ledger.md` / `evidence/` 目录）⇒ 纯新建，无既有内容可改 | 实测 `ls` |
| **F4** | **用户级载体已在场且实测生效**：`~/.omp/agent/agents/dev.md` 的 frontmatter `model: "@dev"`、`~/.omp/agent/agents/verifier.md` 的 `model: "@verifier"`；`~/.omp/agent/config.yml` 的 `modelRoles.dev = openai/gpt-5.6-luna`、`modelRoles.verifier = powerby/grok-4.6`、`modelRoles.default = deepseek/deepseek-v4-flash:high`；两载体文件 mtime `2026-09-17 13:55` | 实测 `cat` 上述三文件（**只读**，且在仓库之外，不入本 PR 任一文件范围） |
| **F5** | `modelRoles.default` 带 `:high` 后缀，而台账里非绑定角色自报值为 `deepseek/deepseek-v4-flash`（**无后缀**）⇒ 自报串与 config 串**不逐字相等**，判据**不得**用 config 值直接比对行值（这正是 MI-12 要求"不写死模型名字符串"的实例） | `~/.omp/agent/config.yml` 与 `status.md` §派发台账 对照 |
| **F6** | 迭代分支版 `status.md` 的 §派发台账 = 7 列（`时点｜角色｜用途｜通道｜子 agent 自报模型｜耗时｜状态`）、**12 条数据行**，其中 `dev（pr-003）`、`verifier（pr-001）` 行自报列写「待回报」；另有 `planner ×3（pr-001/002/003）` 这类**合并行**（3 次派发压 1 行）⇒ 台账必须**拆行**（F09 验收 2 = "每次派发一行"） | `status.md:64-77`（迭代分支 tip 版本） |
| **F7** | `tools/check-model-dispatch-protocol.sh` 的 **V-06 谓词**逐字 = 对 glob `"$worktree"/roles/*/*.md` 上匹配 `model:*` / `' '*model:*` / `'  '*model:*`（行首 0/1/2 空格）即失败；**整脚本在本迭代布局下无法整体通过**：V-01 要求当前 worktree == `<project-root>/.pb-agents/worktrees/<project-id>-<iteration-id>`（本迭代实际为 `.pb-agents/worktrees/0030-hub-communication-upgrade`，**无 `agents-` 前缀**），V-04 要求 `docs/iterations/<迭代ID>/agent-routing.yaml`（本迭代无，全仓仅 `docs/iterations/0004-model-dispatch/agent-routing.yaml` 存在）⇒ AC3 的括注只能按**谓词隔离**执行 | `tools/check-model-dispatch-protocol.sh`（V-01 :30-34、V-04 :44-64、V-06 :80-88）；`find docs -name agent-routing.yaml` |
| **F8** | **判据层与递归层的基线差异（本 PR 的关键事实）**：`roles/*/*.md`（V-06 逐字 glob 层）上 `model:` 键命中 **0**、模型字面量命中 **0**；而 `roles/**` **递归**层的模型字面量命中 **7 处 / 3 个文件**，全部位于 `roles/verifier/data/verify-20260917-{140951,142447,143053}-*.md`（**既有的阶段 4/6 取证报告**，其中含引用 `demand.md`/实测记录时的模型串） | 实测：`grep -cE '^[[:space:]]*model:' roles/*/*.md`、`grep -rn 'openai/gpt-5.6-luna\|powerby/grok-4.6' roles/ \| wc -l` |
| **F9** | **判据层的权威出处**：CLR-MD-004（`docs/iterations/0000-project-design/clarifications/model-dispatch-protocol/round-1.md:55`，`user_confirmed` 2026-09-02）结论 = "使用独立路由配置。role 文件只描述能力，不绑定部署模型"；`architecture.md` §1.3 硬约束 6 与 §6 表第 11 行逐字 = "模型值不进 `roles/*/*.md`" ⇒ **F08 验收 5 / AC3 的判据层 = 角色能力文件层（`roles/*/*.md`）**；而 F08 **边界**的措辞是"不把模型值以任何形式写入 `roles/**`"（层不同，见 T5） | `architecture.md` §1.3-6、§6 表第 11 行；`prd/F08` 验收 5 与边界；CLR-MD-004 |
| **F10** | `deferred-demand-changes.md` 现状 = **3 条**（阶段 1 / 阶段 3 ×2）；三要素计数（**容忍 bullet 前缀**的 pattern）3/3/3；`本迭代如何处理` 行中含「暂停/回退/改需求」**字面**者 2 行，**全部是否定式声明**（"不回退、不暂停"），无一条把摩擦当阻塞理由 | 实测 `grep -cE '^[-*[:space:]]*\*\*(问题\|为什么判定为需求层面问题\|本迭代如何处理)\*\*'` |
| **F11** | `roles/workflow-pb/workflow-pb.md` §文档路径协议（`:267-288`）的规范目录树**不含** `evidence/` 与 `dispatch-ledger.md`；`evidence/` 的先例只在 `docs/iterations/{0011,0012}/clarifications/evidence`（层级不同）⇒ 本 PR 的 `evidence/f09-process-contract.md` 路径**由 PR 文件字面固定**（AC8 原文即引用该路径），不在 dev 裁量范围 | `workflow-pb.md:267-288`；`find docs -type d -name evidence` |
| **F12** | 本迭代**不新增 HTTP 路由**（既有 **29 条**不变）、`oamp/**` 在本 PR 零改动 ⇒ 本 PR **不需要**跑路由计数或 `hub doctor R1`，零运行时改动的判据 = `git diff --name-only` 的文件面（AC10） | `architecture.md` §5「文档面机械锁提示」 |
| **F13** | **`status.md` 的两处陈旧/不一致（只上报，本 PR 不改）**：① 头像区依赖图行仍写 `pr-008（无依赖）→ pr-007`（阶段 4 返工**前**的旧图），与 PR 文件 `depends_on: （无）`、`status.md` 子状态表、以及"已解锁集 = {pr-001,002,003,004,007}"三处相斥 ⇒ **权威 = PR 文件 + 子状态表**；② 「用户裁决落定」表把载体实测记为 `12:40`，而 §派发台账两行记为 `13:57`（载体 mtime 13:55）⇒ 载体文档引用实测时**以台账两行为证**，不引用 12:40 的时间戳 | `status.md`（迭代分支 tip 版本） |

### 0.4 本 PR 冻结契约（K1~K10；下游 dev/verifier 按此判定）

**K1 · 落点与写入面**：4 个文件（§0.1 表格 1~4）在 **PR worktree 内**创建/追加；证据回填只写 §0.1 的第 5 个写入面（迭代工作区的本 tasks 文件）。禁止写入仓库主工作区 `/Users/chenchiyuan/projects/agents`（该路径在本 PR 只可**读**）。
〔追溯：PR 文件「文件范围」；简报硬约束；`data/scm-protocol.md` §规则 F〕

**K2 · 台账 schema（唯一，冻结）**——表头逐字为：

```
| 时点 | 角色 | 用途 | 通道 | 子 agent 自报模型 | 终态 |
```

1. **五列必需列**（`角色` / `用途` / `通道` / `子 agent 自报模型` / `终态`）列名**逐字**在场；`时点` 是附加的行标识列，顺序固定为表头首列（AC4 用"含五列"表述 ⇒ 读作"至少含"，见 MI-P3）。
2. **每次派发一行**（F09 验收 2 判据）：`status.md` 里的合并行必须拆开（`planner ×3（pr-001/002/003）` ⇒ 3 行；history.md 的 `dev（pr-002）+ planner ×2（pr-004/pr-007）` ⇒ 3 行）。
3. `角色` 单元格**只写角色名**（`dev` / `verifier` / `planner` / `prd` / `architect` / `pr-planner`）；限定语（`pr-001`、"载体探针"、"复验"…）写进 `用途` 列——这样 `角色=dev` 的行可机械抽取做绑定值判据。
4. `通道` 单元格**逐字** = `本地 subagent（宿主 task 派发）`（**不得**照抄 `status.md` 的变体 `本地 subagent（agent=dev）`）。
   〔追溯：AC7；F09 验收 1；`architecture.md` §6「额外自检」F09 验收 1 行〕
5. `子 agent 自报模型` = **实际自报串**（含反引号等 markdown 修饰由校验器归一，不影响判据）；尚未回报的行写 `未回报`（**禁止**依据绑定值预填/猜测），且该行 `终态` 必须是 `⏸ 在途`。
6. `终态` 取值域 = {`✅ 完成`，`⏸ 在途`，`❌ 失败`，`⏸ 阻塞`}（符号体系沿用 `data/formats.md` §状态追踪协议：`✅` 已完成 / `⏸` 进行中 / `❌失败(现场保留)` / `⏸阻塞(现场保留)`；**不使用** `⬜`——台账只收已发生的派发）。
7. **口径注记**（表头之上，逐条在场）：① 本表是 F08 验收 4 与 F09 验收 2 **共用的唯一台账**，本迭代不另立自报模型证据文件；② 通道固定口径（K2-4）；③ **当刻生效模型快照**及其来源（K3）；④ 在途行补写协议（行终态确定后由**派发方**就地补写该行的 `自报模型`/`终态`——这是本表**唯一**允许的就地更新动作）；⑤ 快照截止时点（"本表覆盖至 `YYYY-MM-DD HH:MM` 的派发"）。
〔追溯：AC4/AC5/AC7；F08 验收 4；F09 验收 2〕

**K3 · 当刻生效模型快照（非绑定角色行的判据口径）**：快照值取自**实测**——`status.md` 台账中非绑定角色行（`prd` / `architect` / `pr-planner` 三行）的自报值集合，当前为 `deepseek/deepseek-v4-flash`（三行同值）；`~/.omp/agent/config.yml` 的 `modelRoles.default`（`deepseek/deepseek-v4-flash:high`）作为**旁证**并说明后缀差异（F5）——**判据本身不写死模型名字符串**（MI-12）：非绑定角色行的判据 = "行值 === 快照值"；快照若变化，注记行同步更新。
〔追溯：AC4；F08 验收 3；`architecture.md` §10-7（MI-12 取值口径）〕

**K4 · 载体文档必备锚点**：`model-routing-carrier.md` 必须含 §4.2 列出的 9 类锚点（绑定两值 / 别名两写法 / `modelRoles` 两键 / 其余角色口径 / "仓库之外 + 不入版本控制" / 判据层 `roles/*/*.md` / 两条通道适用范围 / D-35 搭置条目处置指向 / 复核命令）。
〔追溯：AC1/AC2；`architecture.md` §4 A-08、§7 L1-01、§10-6〕

**K5 · 摩擦条目形态**：只在 `deferred-demand-changes.md` **文件末尾追加**（0 行删除）；体例沿用该文件既有 3 条的形状（`## {日期} · {阶段}` + `**问题**：` + `- **为什么判定为需求层面问题**：` + `- **本迭代如何处理**：` + 可选 `- **下一迭代候选**：`——注意既有条目的后两要素是 **bullet 行**）；三要素齐；处置列**不得**以"暂停 / 回退 / 改需求"为处置动作。
〔追溯：AC9；F09 验收 4 + F09 边界；`workflow-pb.md` §阶段回退（`:222`）+ §文档路径协议（`:290-297`）〕

**K6 · `roles/**` 零改动（含既有取证产物）**：`roles/**` 下任何文件都不许改；AC3 的判据层 = `roles/*/*.md`（F7/F8/F9）；递归层既有的 7 处命中在载体文档中**如实登记为已知事实**，不改写、不"清零"。
〔追溯：AC3；`architecture.md` §5「明确不改」+ §6-11；F08 验收 5〕

**K7 · `oamp/**` 零改动**；**K8 · `status.md` / `history.md` 零改动**（含不改写其格式规范）。
〔追溯：AC10；F09 边界〕

**K9 · 单表闭合**：本迭代不产生第二份自报模型证据文件（无 `evidence/f08-*`）；`clarifications/**` 与 `history.md` 里出现的 `evidence/f08-model-attribution.md` 字样是**阶段 4 返工前的旧规划痕迹**（历史记录，属零改动面），不作为"第二份表存在"的证据。
〔追溯：AC5；PR 文件「共同面 = 台账」〕

**K10 · 证据落点**：dev 的原始输出（命令 + 原样 stdout + exit code）回填本 tasks 文件 §8「执行证据（dev 回填）」段；**不写回 PR 文件**、不新建证据文件、不以 `/tmp/**` 作为唯一证据载体（可留临时产物，但证据必须内联）。
〔追溯：主 agent 证据落点裁决；0029 pr-008 先例的返工教训〕

### 0.5 PR 验收标准 → 任务映射（10 条 AC 全覆盖，无孤儿任务、无无主 AC）

| AC（PR 文件原文摘要） | 服务任务 | 判据落点 |
|---|---|---|
| **AC1** `model-routing-carrier.md` 存在，含绑定声明、别名写法（值集中一处）、其余角色口径 | **T2** | T2 判据 1/2（§4.2 锚点脚本） |
| **AC2** 载体落点已裁决并记录在案（用户级）+ 显式标注"仓库之外 / 不入版本控制 / 可追溯性由本文件 + 台账承担" + 不含 `roles/**` 内模型值 | **T2**（记录）+ **T6**（守卫） | T2 判据 3/4；T6 判据 2/3 |
| **AC3** `roles/**` 下无 `model:` 键与模型字面量（V-06 与 CLR-MD-004 通过） | **T6**（谓词隔离核查）+ **T2**（判据层声明） | T6 判据 3；T2 判据 5；口径见 MI-P1 |
| **AC4** 台账逐条含五列，且 `dev` 行 = gpt、`verifier` 行 = grok、其余角色行 = 当刻生效模型 | **T3** | T3 判据 1~5（§4.1 校验器） |
| **AC5** "同一张表"闭合（无 `evidence/f08-*`；F08 验收 4 与 F09 验收 2 指向同一份 `dispatch-ledger.md`） | **T3** + **T6** | T3 判据 6/7；T6 判据 4 |
| **AC6** 绑定范围与 0028 定案一致（只 `dev`/`verifier`）；`cluster.json` 零改动 | **T2** + **T6** | T2 判据 1（锚点 9 项之一 = 两条通道/`cluster.json` 零改动）；T6 判据 2 |
| **AC7** 通道列取值均为"本地 subagent（宿主 `task` 派发）"，无"经 hub 派发"条目 | **T3** | T3 判据 3 |
| **AC8** `evidence/f09-process-contract.md` 含 ≥1 条 brief 抽检（两条判据齐）+ 阶段 6 并发证据形态声明（git 事实为主，不要求 hub 记录） | **T4** | T4 判据 1~5 |
| **AC9** `deferred-demand-changes.md` 新增摩擦记录三要素齐；无因搭置而暂停/回退/改需求 | **T5** | T5 判据 2~4 |
| **AC10** 零运行时改动（本 PR 文件范围内不含 `oamp/**`、`oamp/sdk/**`、`oamp/web/**`；不改写 `status.md`/`history.md` 格式规范） | **T6** | T6 判据 2 |

> **T1** 不单独服务某一条 AC，而是 **AC3/AC4/AC7 的基线来源**（派发行快照、判据层基线、载体实测原文）；**T6** 是 AC2/AC3/AC5/AC6/AC10 的守门 + 全部 AC 的证据载体。两表合一构成完整映射，无孤儿任务。

---

## 1. 任务列表

### T1: 事实锚点与派发基线快照（只读）

- **服务哪条 AC**: AC4/AC7 的输入（派发行清单）、AC3 的基线（判据层与递归层命中）；F08 验收 4 / F09 验收 2 的"逐条"完整性
- **描述**: 冻结本 PR 执行基线与**派发全集**：① worktree/分支/HEAD/clean 快照；② 从**迭代工作区**取 `status.md` §派发台账 全量行 + `history.md` 全部 `### … · 派发 · …` 记录，合并去重成"每次派发一行"的**派发快照**（拆开合并行）；③ 载体三文件实测原文；④ 判据层 / 递归层命中基线；⑤ `deferred-demand-changes.md` 三要素基线。**本任务只读，不改任何文件。**
- **文件/锚点**: 只读 —— `<工作区地址>/docs/iterations/0030-hub-communication-upgrade/status.md`（**迭代工作区版本**，见 F2）、同目录 `history.md`、`deferred-demand-changes.md`；`~/.omp/agent/agents/{dev,verifier}.md`、`~/.omp/agent/config.yml`；PR worktree 的 `roles/**` glob。
- **步骤**: ① `git -C <PR worktree> rev-parse HEAD` / `git status --short` / `git merge-base HEAD iteration/0030-hub-communication-upgrade`；② 取 status.md 台账表（`sed -n '/^## 派发台账/,/^## /p'`）与 history.md 的 `派发` 条目（`grep -n '· 派发 ·'`）→ 合并成快照表；③ `cat`/`grep -n 'model:'` 三个载体文件；④ 跑 §4.3 的判据层/递归层命令族；⑤ 跑 §4.5 的 deferred 基线命令族。
- **验收判据（可执行；输出全部入证）**:
  1. **派发快照完整性**：快照表逐行含 `时点 / 角色 / 用途 / 通道 / 自报模型 / 终态` 六格；行数 = status.md 台账数据行**拆开合并行后**的派发数 ∪ history.md `派发` 记录覆盖的派发数（同一派发只出现一次）；给出**≥3 组"合并行 → 拆分行"对照**（如 `planner ×3（pr-001/002/003）` → 3 行）。
  2. **基线干净**：HEAD = `f81d5c6…`、`git status --short` 为空、merge-base = HEAD；若迭代分支已前进，如实记录新 tip 与其相对 HEAD 的 `--name-only` 差异（F2 的复核）。
  3. **载体实测原文**：三份输出原样入证 —— `grep -n 'model:' ~/.omp/agent/agents/dev.md`、同上 `verifier.md`、`sed -n '/modelRoles/,/^[a-z]/p' ~/.omp/agent/config.yml`；其中 `dev` → `openai/gpt-5.6-luna`、`verifier` → `powerby/grok-4.6`、`default` → `deepseek/deepseek-v4-flash:high`（**并记录后缀差异**，F5）。
  4. **判据层基线**：`grep -cE '^[[:space:]]*model:' roles/*/*.md` 逐文件为 0（即无命中）；`grep -rn 'openai/gpt-5.6-luna\|powerby/grok-4.6' roles/ | wc -l` 与 `grep -rl … roles/` 的文件清单原样入证（记录**当前**值，供 T6 复跑比对）。
  5. **deferred 基线**：`## ` 条目数 = 3；三要素计数（容忍 bullet 前缀）= 3/3/3；`本迭代如何处理` 行含「暂停/回退/改需求」字面者 2 行（**原样列出并标注均为否定式声明**）。
- **追溯**: PR **AC4**（"逐条含五列…它就是 F08 验收 1~4 的取证面"）/ **AC7**（通道列取值）→ `prd/F08` **验收 4** + `prd/F09` **验收 2**；快照口径（不写死模型名）→ `architecture.md` **§10-7**（MI-12）；载体实测 → `architecture.md` **§7 L1-01** + `status.md` §派发台账 两行；判据层 → `architecture.md` **§1.3-6** + `§6 表第 11 行` + CLR-MD-004。
- **前置依赖**: 无
- **优先级**: P0

---

### T2: 新建 `model-routing-carrier.md`（载体与路由声明）

- **服务哪条 AC**: AC1、AC2、AC6（并承载 AC3 的判据层声明）
- **描述**: 在 PR worktree 的迭代 docs 目录下新建载体声明文件：写清"绑定值放在哪一层、以什么形态被引用、哪些角色不绑定、两条派发通道各自适用范围、可追溯性由谁承担、怎么复核"。
- **文件/锚点**: 新建 `<PR worktree>/docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md`；内容真源 = `architecture.md` §4 A-08（三候选评估表 + 推荐 + 别名写法建议 + 疑问 5 评估）、§7 L1-01、§10-6、§6 表第 11 行、§1.3-6；`prd/F08` 架构维度；`status.md` 的「用户裁决落定」表（L1-01 采纳候选 B）与 §派发台账 两行（实测证据）；`deferred-demand-changes.md` 2026-09-17 首条（D-35 搭置）。
- **步骤**: 按 §4.2 的 9 类锚点组织内容（建议顺序：一句话结论 → 绑定声明 → 别名与值集中的解析链 → 其余角色口径 → 载体落点与裁决记录 → 仓库外/不入版本控制的显式标注 → 两条通道适用范围与 `cluster.json` 零改动 → D-35 搭置条目的处置指向 → 判据层与递归层现状 → 复核命令）。
- **验收判据（可执行；§4.2 脚本已演练）**:
  1. **锚点齐备**：`§4.2` 的 9 条正则在该文件上**全部命中 ≥1**（脚本输出 `失败 0 项`、`exit 0`）。
  2. **别名与"值集中一处"口径**：文件内同时出现 `model: "@dev"`、`model: "@verifier"`、`modelRoles.dev`、`modelRoles.verifier`，且有一句话说明"模型值只在 `~/.omp/agent/config.yml` 的 `modelRoles` 出现一次，agent 定义只写别名"。
  3. **裁决记录**：含用户裁决（候选 **B** 用户级）、裁决来源（`status.md` 的「用户裁决落定」）与**实测证据指向**（§派发台账 的 `dev`/`verifier` 两行；**不引用 12:40 时间戳**，见 F13）。
  4. **仓库外与承担者**：含"仓库之外""不入版本控制"两条显式标注，并写明可追溯性由**本文件 + `dispatch-ledger.md`** 承担（与 AC2 原文一致）。
  5. **不含 `roles/**` 内的模型值写入声明**：`grep -nE 'roles/' 该文件` 的命中行只出现在"判据层 / 零改动声明 / 边界"语境；文件中不得出现把模型值写入 `roles/**` 的表述；且本 PR 对 `roles/**` 零改动（T6 判据 2 机械判定）。
  6. **两条通道与零改动**：含 harness 本地 subagent 通道 vs oamp 集群通道（`cluster.json` 的 `roles.<role>.model`）的适用范围说明，并写明 `cluster.json` **零改动**、**不引入任何同步/生成机制**。
- **追溯**: PR **AC1**（绑定声明 + 别名写法 + 其余角色口径）→ `architecture.md` **§4 A-08**（"`model` 引用写法建议"段 + 推荐 B 段）/ **§3.5**；PR **AC2**（裁决记录 + 仓库外标注 + 无 `roles/**` 模型值）→ `architecture.md` **§7 L1-01** + `status.md` 用户裁决表；PR **AC6**（只绑 `dev`/`verifier`、`cluster.json` 零改动）→ `prd/F08` **验收 6** + `architecture.md` **§1.3-6 / §6 表 11 / §10-6**；F08 验收 5 的判据层 → CLR-MD-004 + V-06 谓词（§0.3 F7/F9）。
- **前置依赖**: T1（载体实测原文与基线是裁决记录与判据层的证据来源）
- **优先级**: P0

---

### T3: 新建 `dispatch-ledger.md`（F08 验收 4 + F09 验收 2 共用的唯一台账）

- **服务哪条 AC**: AC4、AC5、AC7；F08 验收 1~4；F09 验收 2
- **描述**: 按 K2 的 schema 建**唯一**台账：口径注记 + 表头 + T1 快照逐条落行（拆合并行）+ **本 PR dev 自身一行**（自报 = `openai/gpt-5.6-luna`、终态 = `⏸ 在途`，因写入时点自身尚未终态）。
- **文件/锚点**: 新建 `<PR worktree>/docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md`；输入 = T1 的派发快照 + K2/K3 的口径。
- **步骤**: ① 写口径注记 5 条（K2-7）；② 写表头（逐字 K2）；③ 逐条落行（角色列只写角色名、通道列逐字固定串、未回报行写 `未回报` + `⏸ 在途`）；④ 跑 §4.1 校验器至 `失败 0 项`。
- **验收判据（可执行；§4.1 校验器已演练）**:
  1. **schema 合规**：§4.1 校验器输出 `合计 N 行 / 失败 0 项`、`exit 0`（覆盖列数、角色名、用途非空、通道口径、自报模型非空、终态取值域、`未回报`-`在途` 一致、`dev`/`verifier` 绑定值）。
  2. **行数闭合**：`N` = T1 快照的派发总数 + 1（本 PR dev 自身一行）；逐行六格非空。
  3. **通道口径**：全部行 `通道` 列 = 逐字 `本地 subagent（宿主 task 派发）`；`grep -c 'hub' dispatch-ledger.md` 的命中仅允许出现在**口径注记的否定式声明**中（如"不出现经 hub 派发的条目"），**0 条数据行的通道列含 `hub`**（校验器已覆盖通道列）。
  4. **绑定值**：所有 `角色=dev` 且自报非 `未回报` 的行 = `openai/gpt-5.6-luna`；`角色=verifier` 且自报非 `未回报` 的行 = `powerby/grok-4.6`；其余角色（自报非 `未回报`）行 = K3 快照值；**判据不写死模型名字符串**（比对对象是快照注记行，见 K3）。
  5. **未回报行**：`未回报` 只出现在 `⏸ 在途` 行；不存在"`未回报` + 完成/失败/阻塞"的相悖行。
  6. **单表闭合**：`ls <PR worktree>/docs/iterations/0030-hub-communication-upgrade/evidence/` 中**无** `f08-*`；`grep -rn 'f08-model-attribution' <PR worktree>/docs/iterations/0030-hub-communication-upgrade/` 的命中**只**来自 `history.md` 与 `clarifications/**`（历史规划痕迹，K9）。
  7. **本文件只有一张表**：`grep -c '^| 时点 |' dispatch-ledger.md` = **1**。
- **追溯**: PR **AC4**（五列 + dev/verifier/其余角色的自报口径）→ `prd/F08` **验收 1/2/3/4** + `architecture.md` **§10-7**（MI-12 不写死）；PR **AC7**（通道列均一）→ `prd/F09` **验收 1**；PR **AC5**（同一张表）→ `prd/F09` **验收 2** + PR 文件「共同面 = 台账」；取证方式（逐条一行、含终态）→ `prd/F08` **架构维度末段**。
- **前置依赖**: T1（派发快照与基线）
- **优先级**: P0

---

### T4: 新建 `evidence/f09-process-contract.md`（brief 抽检 + 阶段 6 取证形态声明）

- **服务哪条 AC**: AC8；F09 验收 1/3/5/6
- **描述**: 建 `evidence/` 目录并新建过程契约证据文件：**brief 抽检记录 ≥2 条**（每条两条判据、判据各有具体依据）+ **阶段 6 并发证据的形态声明**（以 git 事实为主）+ 写入时点的 git 事实实样。
- **文件/锚点**: 新建 `<PR worktree>/docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md`；输入 = 本条派发自身的 brief（第一手）、`<工作区地址>/…/history.md` 的 `派发` 记录与对应派发产物、`data/formats.md` §历史记录协议（派发类字段）、`workflow-pb.md` §派发执行角色时的 brief 构建（`:132-136`）与 §并发调度真实执行证据（`:337-360`）。
- **步骤**: ① 抽检记录 A = **本条派发**（pr-007 dev）：引用 brief 中「工作区地址」字段行原文 + 说明角色定义全文注入的机械依据（如"本简报含 `roles/dev/dev.md` 全文，行数 N = `wc -l roles/dev/dev.md` 的值"）；② 抽检记录 B = 另一条派发，以 `history.md` 的 `派发` 记录 + 该派发产物为载荷（建议 `planner(pr-001)` → `prs/pr-001-…-tasks.md` 头部字段，或 `dev(pr-001)` → `roles/verifier/data/verify-20260917-143053-0030-pr-001.md`）；③ 写阶段 6 形态声明（三类 git 事实 + 否定式声明"不要求 hub 调用记录作证据"）；④ 附 ≥1 类 git 事实实样（命令 + 原样输出）。
- **验收判据（可执行）**:
  1. **抽检记录 ≥2 条**，每条含派发标识（角色 / 用途 / 时点）+ **两条判据各自在记录段落内出现**（`角色定义全文注入`、`工作区地址`）+ 各自的"依据"（非空、指向具体证据）。
  2. **判据一（角色定义全文注入）**：≥1 条记录给出**可复核的机械依据**（如与 `roles/<role>/<role>.md` 的行数/结构标记对照），不得只写"已全文注入"。
  3. **判据二（工作区地址字段显式给出）**：≥1 条记录引用 brief 中该字段行的**原文片段**（或产物的绝对路径字段）。
  4. **形态声明**：含 `worktree 落点`、`分支时间窗`、`提交交错` 三类 fact 的**各自命令**，并含"不要求 hub 调用记录"的否定式声明。
  5. **实样**：文件内含 ≥1 段 git 命令 + 原样输出（如 `git worktree list --porcelain`、`git log --format='%ci %h %s' iteration/0030-hub-communication-upgrade | head`、`git log --graph --oneline --all | head`）。
  6. **不依赖 `/tmp`**：文件内**不得**把 `/tmp/**` 作为唯一证据载体（`grep -n '/tmp/' 该文件` 的命中行若存在，必须同时内联其内容）。
- **追溯**: PR **AC8**（≥1 条抽检 + 两条判据 + 阶段 6 形态声明）→ `prd/F09` **验收 3**（brief 形态可抽检）+ **验收 5**（并发证据按 git 事实、不要求 hub 记录）+ **验收 1**（通道单一）+ **验收 6**（产物落点）；brief 两条判据的定义 → `workflow-pb.md` **§派发执行角色时的 brief 构建**（"全文内容显性注入"）；git 事实取证形态 → `workflow-pb.md` **§并发调度真实执行证据**；抽检的交叉载荷 → `data/formats.md` **§历史记录协议·派发类字段**。
- **前置依赖**: T3（抽检记录须指向台账行；被抽检派发的通道/模型格是同一台账的行）
- **优先级**: P0

---

### T5: `deferred-demand-changes.md` 末尾追加摩擦条目（F08 边界与验收 5 的层差异）

- **服务哪条 AC**: AC9；F09 验收 4 + F09 边界
- **描述**: 先**复核触发条件**（机械可判定）：`roles/**` **递归**层存在模型字面量命中，而 AC3/F08 验收 5/`architecture.md` §1.3-6 的**判据层** `roles/*/*.md` 为 0 —— 即 **F08 边界的措辞（"不把模型值以任何形式写入 `roles/**`"）** 与 **F08 验收 5 / 架构硬约束的 glob 层（`roles/*/*.md`）** 不一致，且现状已有存量命中（取证报告）。触发成立则**末尾追加 1 条**（三要素 + 下一迭代候选，内容按 K5）；dev 若复核后判定不触发（须给出命令与输出），则不追加并在 §8 写明"未触发"的依据。执行期间若遇到其他需求层面问题，可同样追加。
- **文件/锚点**: 改 `<PR worktree>/docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md`（**仅末尾追加**）；事实来源 = §0.3 F8/F9/F10 + T1 的基线输出；条目的"本迭代如何处理"段引用 T2 的判据层声明（`model-routing-carrier.md`）。
- **步骤**: ① 复跑 §4.3（判据层 0 / 递归层命中数 + 文件清单）与 §4.5（三要素基线）；② 判定触发；③ 追加块（自带前置空行与既有体例的标题行）；④ 复跑 §4.5 全部计数（3→4）与只增不改核查（§4.6）。
- **验收判据（可执行）**:
  1. **触发复核在场**：§4.3 与 §4.5 的命令与输出原样入证（递归命中数、命中文件清单、判据层 0 命中、三要素基线 3/3/3）。
  2. **条目质量**（若追加）：`## ` 条目数 3 → **4**；三要素计数 **4/4/4**（容忍 bullet 前缀的 pattern）；新增条目的三要素内容非空且**互不指代**（不得"同上/见上文"）。
  3. **处置形态**：新增条目的 `本迭代如何处理` 行**不以**"暂停 / 回退 / 改需求"为处置动作；若该行含这些**字面**，必须附一句语义判定（**否定式声明不算处置动作**——既有 2 行即此形态，F10）。
  4. **只增不改**：`git -C <PR worktree> diff --numstat -- <该文件>` ⇒ `<N>\t0\t<该文件>`（**删除列 = 0**）；`git diff -U0 -- <该文件> | grep -cE '^-[^-]'` = **0**（`^-[^-]` 排除 `--- a/` 文件头，见 §4.6）；既有 3 条逐字保留。
  5. **指向不悬空**：新增条目的处置段引用的判据层声明在 `model-routing-carrier.md` 中**确实存在**（T2 判据 1 的锚点之一）。
- **追溯**: PR **AC9**（三要素齐 + 无因搭置而暂停/回退/改需求）→ `prd/F09` **验收 4** + **F09 边界**（"不把摩擦搭置当作阻塞理由"）+ `workflow-pb.md` **§阶段回退**（`:222`："不回退修正、不暂停等待用户…继续按当前 `demand.md` 完成本迭代"）+ **§文档路径协议**（`:290-297` 的三要素格式）；触发事实 → §0.3 **F8/F9/F10**（`prd/F08` 边界 vs 验收 5 的层差、`architecture.md` §1.3-6、CLR-MD-004）。
- **前置依赖**: T1（基线复核）、T2（处置段引用的判据层声明由 T2 写入，悬空即不满足判据 5）
- **优先级**: P0

---

### T6: 封闭性守卫 + 证据回填（P1 ≠ 可选）

- **服务哪条 AC**: AC2、AC3、AC5、AC6、AC10 的守门 + 全部 10 条 AC 的证据载体
- **描述**: 改动面封闭性核查（文件面 / 词字面面 / 单表闭合）+ 把 T1~T5 的原始输出回填本 tasks 文件 §8。
- **文件/锚点**: 只读 PR worktree（git 命令 + grep）；写 `<工作区地址>/…/prs/pr-007-model-routing-and-process-evidence-tasks.md` 的 §8 段。
- **验收判据（可执行）**:
  1. **文件面**：`git -C <PR worktree> status --short` 恰 4 项（§0.1 表格 1~4；`evidence/` 目录随其文件计入），无其它路径、无其它 untracked —— 这是文件面的**主判据**（未跟踪文件不出现在 `git diff` 面）；若要用 `--name-only` / `--numstat` 做机械判据，先按 §4.6 对 3 个新建文件执行 `git add -N`。
  2. **AC10 零运行时**：`git -C <PR worktree> diff --name-only f81d5c6 -- oamp oamp/sdk oamp/web cluster.json tools` **为空**；`status.md` / `history.md` 零改动（同一命令的路径清单与 `git status --short` 里都不含它们）。
  3. **AC3 判据层复跑**：§4.3 命令族输出与 T1 基线**逐字一致**（判据层 0 命中；递归层命中数与文件清单一致）——证明本 PR 未触碰 `roles/**`。
  4. **AC5 单表闭合**：`ls <PR worktree>/…/evidence/` 只有 `f09-process-contract.md`；全 PR worktree 内 `find . -name 'f08-*'` 为空；`grep -rn 'dispatch-ledger' <PR worktree>/docs/iterations/0030-hub-communication-upgrade/` 的命中只来自本 PR 的 3 个新文件（无第四份表）。
  5. **证据回填完整**：§8 含 6 个块（① T1 快照与四组基线输出；② T2 锚点脚本输出；③ T3 校验器输出 + exit code；④ T4 抽检记录与 git 实样；⑤ T5 触发复核与 `--numstat`；⑥ T6 守门命令族输出），每块为"命令 + 原样输出"，无"见上文/同上"。
  6. **提交面**：4 个文件提交在 `feat/0030-pr-007-model-routing-and-process-evidence` 上（给出 `git log --oneline -1` 与 `git show --stat --oneline HEAD | head`）；本 tasks 文件的证据段提交与否**由主 agent 决定**（不属 PR 交付面，K10）。
- **追溯**: PR **AC10**（零运行时改动面）→ `architecture.md` §5「明确不改」；PR **AC3**（判据层 + 递归层事实）→ F08 验收 5 + CLR-MD-004；PR **AC5**（单表闭合）→ PR 文件「共同面 = 台账」；PR **AC2/AC6** 的守门 → `architecture.md` §1.3-6 / §6 表 11；证据落点 → 主 agent 裁决 + 0029 pr-008 先例（证据不得依赖 `/tmp`）。
- **前置依赖**: T2、T3、T4、T5（守门对象与证据源齐备后才可判"封闭"）
- **优先级**: P1

---

## 2. 依赖图

```
T1 ──┬──> T2 ──> T5 ──┐
     │    └────────────┤
     ├──> T3 ──> T4 ───┤
     │    └────────────┤
     └─────────────────┴──> T6

（T2 → T6、T3 → T6、T4 → T6、T5 → T6 均在汇合点并入 T6；T1 → T5 为直连边）
```

边（逐条，均为真实约束；共 9 条）：
- `T1 → T2`：载体文档的裁决记录、实测证据指向与判据层现状**只**来自 T1 的实测原文与基线输出；没有 T1 就只能凭空写。
- `T1 → T3`：台账行 = T1 的派发快照（含合并行拆分结果）；没有快照就没有行内容。
- `T1 → T5`：摩擦条目的**触发条件**由 T1 的判据层/递归层基线输出判定；没有基线就无法给出可复核的触发依据。
- `T2 → T5`：条目的"本迭代如何处理"段引用 `model-routing-carrier.md` 的判据层声明（T2 判据 5 的反面：指向悬空即不满足）；声明不存在则条目内容不成立。
- `T3 → T4`：抽检记录必须指向台账行（被抽检派发的通道/模型/终态取自 T3 建立的表）；表未建立则抽检记录无法落"依据"。
- `{T2,T3,T4,T5} → T6`：封闭性守卫与证据回填的对象=四个产物的终态；任一未落地，`git status --short` 的"恰 4 项"与证据六块都不成立。

**无环**：拓扑序 `T1 < T2 < T3 < T4 < T5 < T6` 满足全部边的方向（T2/T3/T5 之间除 `T2→T5` 外无边，T4 在 T3 之后，T6 最后），不存在回到已访问节点的路径。

**最长依赖链（本 PR 内部关键路径，4 节点）**：`T1 → T3 → T4 → T6`（另一条同长链为 `T1 → T2 → T5 → T6`）。
**关键路径任务**：**T1**（唯一的生产基线：派发快照 + 实测原文 + 判据层现状）→ **T3**（唯一台账）→ **T4**（过程证据）→ **T6**（守卫与证据）。

---

## 3. 执行顺序与增量策略

**顺序**：`T1 → T2 → T3 → T4 → T5 → T6`（与拓扑序一致；T2 与 T3 之间无依赖，若一次调用内连续施工可直接先后落盘，不必等待）。

| 调用 | 产出增量 | 独立判据 |
|---|---|---|
| 1 | T1：派发快照 + 载体实测 + 判据层/deferred 基线（**只读**） | §T1 判据 1~5 |
| 2 | T2：`model-routing-carrier.md` | §T2 判据 1~6（§4.2 脚本） |
| 3 | T3：`dispatch-ledger.md` + 校验器通过 | §T3 判据 1~7（§4.1 校验器） |
| 4 | T4：`evidence/f09-process-contract.md` | §T4 判据 1~6 |
| 5 | T5：`deferred-demand-changes.md` 末尾追加 + 只增不改核查 | §T5 判据 1~5（§4.6） |
| 6 | T6：守门命令族 + §8 证据六块回填 | §T6 判据 1~6 |

**若单次调用未跑完**：在**任务边界**停下；**T5 一旦开始追加就必须跑完只增不改核查**（半追加状态会让 AC9 的判据失去意义）。

---

## 4. 验证配方（全部为只读命令 + 两个一次性校验脚本；**禁止新增测试文件 / 禁止落仓任何脚本**）

> 两个脚本**只在 `/tmp` 存在**（可选），其**正文内联在本文件**——证据只需命令 + 输出，不依赖 `/tmp` 残留（K10）。

### 4.1 台账校验器（→ 判据 §T3-1）

```bash
mkdir -p /tmp/0030-pr-007 && cat > /tmp/0030-pr-007/ledger-check.awk <<'AWK'
BEGIN {
  FS="|"; want_cols=6; fails=0; rows=0
  canon="本地 subagent（宿主 task 派发）"
  dev_bound="openai/gpt-5.6-luna"; ver_bound="powerby/grok-4.6"
  role_ok["dev"]=1; role_ok["verifier"]=1; role_ok["planner"]=1; role_ok["prd"]=1
  role_ok["architect"]=1; role_ok["pr-planner"]=1
}
/^\|/ {
  line=$0
  if (line ~ /^\|[[:space:]]*:?-+/) next                     # 分隔行
  n=NF-2
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
  if ($2=="时点") { if (n!=want_cols) { print "FAIL 表头列数="n" 期望 "want_cols; fails++ }; next }
  rows++
  if (n!=want_cols) { print "FAIL 列数="n" 行: "line; fails++; next }
  for (i=2;i<=7;i++) { gsub(/[`*]/, "", $i); gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i) }
  role=$3; use=$4; chan=$5; model=$6; term=$7
  if (!(role in role_ok))       { print "FAIL 角色非法: ["role"]"; fails++ }
  if (use=="")                  { print "FAIL 用途空: "line; fails++ }
  if (chan!=canon)              { print "FAIL 通道口径: ["chan"]"; fails++ }
  if (model=="")                { print "FAIL 自报模型空: "line; fails++ }
  if (term !~ /^(✅ 完成|⏸ 在途|❌ 失败|⏸ 阻塞)$/) { print "FAIL 终态取值: ["term"]"; fails++ }
  if (model=="未回报" && term!="⏸ 在途")          { print "FAIL 未回报行未标在途: "line; fails++ }
  if (role=="dev"      && model!="未回报" && model!=dev_bound) { print "FAIL dev 自报="model; fails++ }
  if (role=="verifier" && model!="未回报" && model!=ver_bound) { print "FAIL verifier 自报="model; fails++ }
}
END { printf "合计 %d 行 / 失败 %d 项\n", rows, fails; exit (fails>0) }
AWK
awk -f /tmp/0030-pr-007/ledger-check.awk \
  "<PR worktree>/docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md"; echo "exit=$?"
```

### 4.2 载体文档锚点校验器（→ 判据 §T2-1）

```bash
cat > /tmp/0030-pr-007/anchor-check.sh <<'SH'
#!/usr/bin/env bash
f="$1"; shift; fails=0
[ -f "$f" ] || { echo "FAIL 文件不存在: $f"; exit 1; }
for p in "$@"; do
  n=$(grep -cE "$p" "$f" || true)
  if [ "$n" -gt 0 ]; then echo "PASS [$n] $p"; else echo "FAIL [0] $p"; fails=$((fails+1)); fi
done
echo "合计 $# 项 / 失败 $fails 项"; exit $(( fails > 0 ))
SH
chmod +x /tmp/0030-pr-007/anchor-check.sh
/tmp/0030-pr-007/anchor-check.sh \
  "<PR worktree>/docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md" \
  'openai/gpt-5\.6-luna' \
  'powerby/grok-4\.6' \
  'model: "@dev"' \
  'model: "@verifier"' \
  'modelRoles\.dev' \
  'modelRoles\.verifier' \
  '仓库之外' \
  '不入版本控制' \
  'roles/\*/\*\.md'; echo "exit=$?"
```

> 9 项锚点与判据的对应：前 2 项 = 绑定声明（AC1）；第 3~6 项 = 别名写法 + 值集中一处（AC1）；第 7~8 项 = 仓库外标注（AC2）；第 9 项 = 判据层（AC3 的口径）。**另需**人读确认的 3 项（脚本不覆盖）：其余角色口径（AC1）、裁决记录（AC2）、两条通道与 `cluster.json` 零改动（AC6）。

### 4.3 判据层 vs 递归层命令族（→ 判据 §T1-4 / §T5-1 / §T6-3）

```bash
cd <PR worktree>
echo "== V-06 谓词层（须 0 命中）=="
grep -nE '^[[:space:]]*model:' roles/*/*.md || echo "(无命中)"
grep -rn 'openai/gpt-5.6-luna\|powerby/grok-4.6' roles/*/*.md || echo "(无命中)"
echo "== 递归层（既有事实，本 PR 不改）=="
grep -rn 'openai/gpt-5.6-luna\|powerby/grok-4.6' roles/ | wc -l
grep -rl 'openai/gpt-5.6-luna\|powerby/grok-4.6' roles/
echo "== 整脚本不可整体跑（F7 说明，可附）=="
bash tools/check-model-dispatch-protocol.sh "$PWD" 0030-hub-communication-upgrade; echo "exit=$?"
#   期望非 0：V-01 要求"当前 worktree == <project-root>/.pb-agents/worktrees/<project-id>-<iteration-id>"，
#   而本会话当前目录是 PR worktree、迭代 worktree 又是 `.pb-agents/worktrees/0030-…`（无 `agents-` 前缀）；
#   即使从迭代工作区运行，V-04 仍会因缺 `docs/iterations/0030-…/agent-routing.yaml` 失败。
#   ⇒ 该调用仅作**诊断附证**，AC3 的判定走上面的谓词隔离命令。**该失败与本 PR 改动无关**。
```

### 4.4 判据可判定性前置证明（planner 已在 `/tmp` 用一次性参照实现演练）

| 演练 | 参照实现 | 结果 |
|---|---|---|
| 台账校验器·**正例** | 5 行合成台账（含 dev/verifier/planner/未回报行） | `合计 5 行 / 失败 0 项`，`exit 0` |
| 台账校验器·**反例** | 同表改 3 处：通道列换成 `本地 subagent（agent=verifier）`、`verifier` 行自报改成 `deepseek/deepseek-v4-flash`、`未回报` 改成 `待回报` 且终态改 `✅ 完成` | `失败 7 项`（通道口径 ×5、verifier 自报 ×1、`未回报` 语义 ×1），`exit 1` |
| 台账校验器·**负对照（缺列）** | 删掉 `终态` 列 | `FAIL 列数=5`，`exit 1` |
| 锚点校验器·**正例** | 9 锚点齐备的载体文样 | `合计 9 项 / 失败 0 项`，`exit 0` |
| 锚点校验器·**反例** | 删掉 `modelRoles.dev` 展开句 | `FAIL [0] modelRoles\.dev`，`exit 1` |
| deferred 三要素计数·**基线** | 真实 `deferred-demand-changes.md` | 条目 3、三要素 **3/3/3**；`本迭代如何处理` 行含字面 token 者 2 行（均否定式） |
| V-06 谓词层 vs 递归层·**基线** | 真实 `roles/**` | 谓词层 **0** 命中；递归层 **7** 命中 / **3** 文件（全部 `roles/verifier/data/verify-20260917-*.md`） |
| 只增不改的删除行判据·**正/负例** | 合成 unified diff | `grep -c '^-'` 在"仅新增"补丁上仍得 **1**（`--- a/<path>` 文件头）⇒ 判据改用 `grep -cE '^-[^-]'`：仅新增 = **0**，含删除 = **1** |

> 首轮演练中校验器**曾把正例判负**（单元格里的反引号未归一）⇒ 已在 `for` 循环中加入 `/[\`*]/` 归一，复跑正例通过。这正是"演练要真跑、不能只写脚本"的意义。

### 4.5 `deferred-demand-changes.md` 基线 / 复跑命令族（→ 判据 §T1-5 / §T5-1/2）

```bash
F=<PR worktree>/docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md
grep -c '^## ' "$F"
grep -cE '^[-*[:space:]]*\*\*问题\*\*' "$F"
grep -cE '^[-*[:space:]]*\*\*为什么判定为需求层面问题\*\*' "$F"
grep -cE '^[-*[:space:]]*\*\*本迭代如何处理\*\*' "$F"
grep -nE '^[-*[:space:]]*\*\*本迭代如何处理\*\*' "$F" | grep -E '暂停|回退|改需求'   # 字面命中，须原样入证 + 语义判定
grep -cE '见上文|同上' "$F"
```

### 4.6 只增不改与改动面守门（→ 判据 §T5-4 / §T6-1~4）

```bash
W=<PR worktree>
git -C "$W" diff --numstat -- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md   # 期望 "<N>\t0\t<path>"
git -C "$W" diff -U0 -- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md | grep -cE '^-[^-]'  # 期望 0
#   ↑ 必须用 `^-[^-]`：`--- a/<path>` 文件头也以 `-` 开头，用裸 `^-` 会恒得 1（已演练，见 §4.4）
git -C "$W" status --short                                   # 期望恰 4 项（新建 3 项为 ?? / 追加 1 项为 M）
#   ↑ 文件面的**主判据**：未跟踪文件不出现在 `git diff` 面
git -C "$W" add -N docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md \
                 docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md \
                 docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md
#   ↑ 仅当需要用 `--name-only` / `--numstat` 做机械判据时才执行（intent-to-add，不改文件内容、随后正常 commit）
git -C "$W" diff --name-only f81d5c6                         # 期望恰 4 行：不含 oamp/ roles/ tools/ cluster.json status.md history.md
git -C "$W" diff --name-only f81d5c6 -- oamp oamp/sdk oamp/web cluster.json tools roles   # 期望空
ls "$W"/docs/iterations/0030-hub-communication-upgrade/evidence/
find "$W" -name 'f08-*'                                      # 期望空
```

---

## 5. 证据载体与落盘

- **PR 交付物**：§0.1 表格的 4 个文件，提交在 `feat/0030-pr-007-model-routing-and-process-evidence`。
- **证据载体（唯一）**：本 tasks 文件**末尾 §8「执行证据（dev 回填）」段**——命令 + 原样 stdout + exit code。**不写回 PR 文件**、不新建证据文件、不以 `/tmp` 残留为唯一载体。
- **不得**：把证据写进 `status.md` / `history.md`；整理/回填 `status.md` 的 §派发台账（主 agent 的载体）；把模型值写进 `roles/**` 任何文件。
- **本文档（tasks 文件）本身**：属阶段 5 增量产物，落在迭代工作区 `docs/…/prs/`，**不计入** PR 的改动面。

---

## 6. `[model_inferred]` 验收标准（需主 agent 确认；本任务列表不自行确认，逐条列出）

- **[model_inferred] MI-P1 · AC3 的判据层收窄（`roles/*/*.md` vs 递归 `roles/**`）**
  AC3 原文"全仓检索 `roles/` 下无 `model:` 键与 `openai/gpt-5.6-luna` / `powerby/grok-4.6` 字面量"若按**递归**读法判定，**现状即不通过**：`roles/**` 递归层有 7 处模型字面量（3 份既有 verifier 取证报告），且有 3 行含 `model:` 字面 token（引用性转述）。本任务列表按**谓词层**判定：判据 = AC3 括注点名的 V-06 逐字谓词（glob `roles/*/*.md`）+ CLR-MD-004 的结论口径 + `architecture.md` §1.3-6 / §6 表 11 的逐字"模型值不进 `roles/*/*.md`"。
  - **推导依据**：AC3 的括注把"通过"锚在 `tools/check-model-dispatch-protocol.sh` 的 **V-06** 与 **CLR-MD-004** 上（F7/F9），二者的作用层都是**角色能力文件层**；`prd/F08` 验收 5 的原文 glob 同样是 `roles/*/*.md`；递归层的命中是**取证产物**，改写它们等于篡改既有验证证据（且 `architecture.md` §5「明确不改」列 `roles/**`）。
  - **两种读法的判据差**：谓词层读法下 AC3 通过（0 命中）；递归层读法下 AC3 **不通过且无法在不篡改证据的前提下通过**。若主 agent 裁定递归层读法，回退口径 = 需先裁决"既有取证报告中的模型字面量如何处置"（本 PR 无权处置），AC3 应改判为 blocked 而非 fail。
- **[model_inferred] MI-P2 · 台账允许"未回报 + 在途"行**
  AC4 要求"逐条含五列"，F08 验收 4 / F09 验收 2 要求每次派发一行；但**写入时点必然存在尚未回报的在途派发**（`status.md` 台账现状即有"待回报"取值，F6）。本任务列表的口径：`自报模型` 列允许取值 `未回报`，且该行 `终态` 必须为 `⏸ 在途`；绑定值判据（dev=gpt / verifier=grok）**只适用于自报非 `未回报` 的行**。
  - **推导依据**：AC 未规定未回报行的形态；而"逐条"与"不预填猜测值"两条硬约束叠加后，只有"写出未回报这一真实状态"是诚实的。若主 agent 裁定"台账只收已回报派发"，回退口径 = 从表中删除未回报行（成本 = 删除若干行，且需同步 §8 证据）。
- **[model_inferred] MI-P3 · 台账第六列 `时点`**
  AC4 的列清单是五列；本任务列表把"含五列"读作"**至少**含五列"，并固定首列为 `时点`（行标识，用于同一角色的多次派发可区分、且与 `status.md` 台账的行首列同形）。
  - **推导依据**：无行标识时，"同一角色多次派发各成一行"在文档上不可指认（如三次 `planner` 派发）。若主 agent 裁定严格五列，回退口径 = 把 `时点` 合并进 `用途` 列文本。
- **[model_inferred] MI-P4 · brief 抽检的样本构成**
  AC8 只要求"≥1 条"。本任务列表加严为"**必含**本 PR dev 自身派发（第一手 brief）+ **另加** ≥1 条以 `history.md` 派发记录与派发产物为载荷的抽检"，以降低"自证"权重。
  - **推导依据**：F09 验收 3 的"任取一条派发记录"隐含样本不应只来自自证；加严成本极低（读一条 history 记录 + 一个产物文件）。若主 agent 裁定 1 条即可，回退口径 = 删除第 2 条记录。
- **[model_inferred] MI-P5 · 摩擦条目的触发判据**
  AC9 只对**已新增条目**的质量设判据，未规定"是否必须新增"。本任务列表给出**机械触发条件**：判据层（`roles/*/*.md`）命中 = 0 **且** 递归层（`roles/**`）命中 > 0 ⇒ F08 边界与 F08 验收 5 / `architecture.md` §1.3-6 存在**层差**且现状已有存量命中 ⇒ 触发追加。当前基线满足该条件（F8）。
  - **推导依据**：该层差确实满足 F09 验收 4 的"为什么判定为需求层面问题"要件（修它要么改 F08 边界的措辞层、要么改 verifier 取证落点 = 改 demand 结论）。若主 agent 裁定"仅记录不追加"，回退口径 = 删除追加块（成本 = 删除一个块）。

---

## 7. 循环依赖与疑问 / 越界

### 循环依赖
**无**（见 §2 的 6 条边与拓扑序 `T1 < T2 < T3 < T4 < T5 < T6`）。

### 疑问 / 越界（不改 PR 文件七字段，只上报）

1. **`status.md` 的依赖图行陈旧**：头部依赖图行仍写 `pr-008（无依赖）→ pr-007`（阶段 4 返工**前**的旧图），与 PR 文件 `depends_on: （无）`、`status.md` 子状态表、`已解锁集 = {pr-001,002,003,004,007}` 三处相斥。**权威 = PR 文件 + 子状态表**；本 PR 不写 `status.md`（AC10/K8），只上报给主 agent 在收口时同步。
2. **载体实测时间戳不一致**：`status.md` 的「用户裁决落定」表记 `12:40`，§派发台账 两行记 `13:57`（载体文件 mtime `13:55`）。载体文档按 §0.3 F13 以**台账行**为证，不引用 12:40。
3. **AC3 括注的工具不可整体调用（F7）**：`tools/check-model-dispatch-protocol.sh` 在本迭代布局下 V-01（worktree 命名无 `agents-` 前缀）与 V-04（无 `docs/iterations/0030-…/agent-routing.yaml`）**必然失败**，与本 PR 的改动无关。本任务列表按**谓词隔离**执行（§4.3）。是否修该脚本（改 V-01 的命名假设 / 补 `agent-routing.yaml`）不在本 PR 文件范围，上报主 agent。
4. **`evidence/` 目录不在规范树（F11）**：`workflow-pb.md` §文档路径协议 的目录树不含 `evidence/`（先例只在 `…/clarifications/evidence`）。本 PR 的 `evidence/f09-process-contract.md` 路径**由 PR 文件字面固定**（AC8 原文引用），按 PR 文件执行；不改规范树（AC10）。
5. **未写 `roles/planner/data/` 决策记录**：本 PR 的"任务拆分口径"（台账 schema 冻结、摘要在 §0.4/§6）按 planner 角色契约本可落 `roles/planner/data/`，但该目录在 `roles/**` 零改动面内（K6/AC10 语境 + 简报"只写你那一个 tasks 文件"约束）⇒ 记录就写在本文档内，不越界。
6. **架构信息无缺口**：F08/F09 的 A-08 与过程契约束要素齐备（§4 A-08 三候选评估 + §7 L1-01 已裁决 + §10-6/§10-7 的知会项），AC1~AC10 均可回指 `architecture.md` 小节 / `prd` 卡验收项编号；5 条需要推导的口径（MI-P1~MI-P5）已列 §6 等主 agent 确认，**不影响 T1~T6 的可执行性**。
7. **本 PR 的"证据不自证"风险处置**：T4 的抽检记录必含**自身 brief**（第一手）**加**一条交叉样本（MI-P4）；T6 的证据六块要求"命令 + 原样输出"，禁止"见上文"。

---

## 8. 执行证据（dev 回填）

> 段约定：**命令 + 原样 stdout + exit code**，按下列 6 块顺序回填；不得写"见上文/同上"；**不写回 PR 文件**（K10）。

- **① T1 · 事实锚点与派发基线**
  - 1.1 worktree/分支/HEAD/clean/merge-base
  - 1.2 派发快照全表（含 ≥3 组"合并行 → 拆分行"对照）
  - 1.3 载体三文件实测原文（dev.md / verifier.md / config.yml `modelRoles`）
  - 1.4 判据层（V-06 谓词）0 命中 + 递归层命中数与文件清单
  - 1.5 `deferred-demand-changes.md` 三要素基线与处置行字面命中
- **② T2 · 载体文档锚点校验**：`anchor-check.sh` 输出（9 项）+ `exit code` + 3 项人读确认
- **③ T3 · 台账校验**：`ledger-check.awk` 输出（`合计 N 行 / 失败 0 项`）+ `exit code` + 单表闭合命令
- **④ T4 · brief 抽检与 git 事实**：两条抽检记录的原文依据 + 三类 fact 的命令与实样
- **⑤ T5 · 摩擦条目**：触发复核输出 + 追加块 + `--numstat` / `-U0` 只增不改核查
- **⑥ T6 · 封闭性守卫**：`git status --short` / `--name-only` / `evidence/` 列表 / `find -name 'f08-*'` / `roles/**` 复跑比对

### ① T1 · 事实锚点与派发基线

**1.1 worktree/分支/HEAD/clean/merge-base**

命令：
```text
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence rev-parse HEAD
f81d5c6796d4fec8599d064ef128c9157897fec0
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence status --short
（基线读取时为空）
$ git -C /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence merge-base HEAD iteration/0030-hub-communication-upgrade
f81d5c6796d4fec8599d064ef128c9157897fec0
```

写入产物后 status 出现且仅出现本 PR 四个路径，见第⑥块。迭代分支已前进，PR worktree 相对其差异为 `architecture.md`、两份阶段 6 报告、`history.md`、`prd/F06`、若干 `prs` 文档、`roles/verifier/data/**` 与 `oamp/src/pool-routing.js`；本 PR 未改其中任一路径。

**1.2 派发快照全表（27 行）**

命令：
```text
$ sed -n '64,96p' /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/docs/iterations/0030-hub-communication-upgrade/status.md
```

原样 stdout：
```text
## 派发台账（阶段 2~6；模型归属为本次执行方式约束第 3 条要求）

| 时点 | 角色 | 用途 | 通道 | 子 agent 自报模型 | 耗时 | 状态 |
|---|---|---|---|---|---|---|
| 12:18 | prd | 阶段 2 · 功能规格 | 本地 subagent | `deepseek/deepseek-v4-flash` | 4m45s | ✅ |
| 12:23 | architect | 阶段 3 · 技术架构 | 本地 subagent | `deepseek/deepseek-v4-flash` | 7m58s | ✅ |
| 12:34 | pr-planner | 阶段 4 · PR 规划 | 本地 subagent | `deepseek/deepseek-v4-flash` | 3m26s | ✅ |
| 12:35 | prd（续做） | `prd.md` 索引收口 | 本地 subagent | `deepseek/deepseek-v4-flash` | <1m | ✅ |
| 13:57 | dev（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | <1m | ✅ |
| 13:57 | verifier（载体探针） | L1-01 落地实测 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | <1m | ✅ |
| 14:00 | verifier（PrsVerifier） | 阶段 6 · 验 `prs/`（Gate 首轮） | 本地 subagent（agent=verifier） | `powerby/grok-4.6` | 15m54s | ✅ PASS（3 partial） |
| 14:24 | verifier（PrsVerifier 复验） | Gate 返工后靶向复验 | 本地 subagent（agent=verifier） | `powerby/grok-4.6` | ~5m | ✅ PASS（0/0/0） |
| 14:33 | planner（pr-001） | 阶段 5 · pr-001 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 5m16s | ✅ |
| 14:33 | planner（pr-002） | 阶段 5 · pr-002 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 14m58s | ✅ |
| 14:33 | planner（pr-003） | 阶段 5 · pr-003 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 9m27s | ✅ |
| 14:41 | **dev（pr-001）** | 阶段 5 · pr-001 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 3m59s | ✅ 提交 `9cb5042`→合并 `f81d5c6` |
| 14:44 | **dev（pr-003）** | 阶段 5 · pr-003 实现＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 1h6m | ✅ 提交 `33005c0` |
| 14:46 | **verifier（pr-001）** | 阶段 5 · pr-001 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | 5m7s | ✅ PASS（0/0/2 偏差） |
| 14:56 | architect（A-06 补定） | 架构层缺口补定（多实例识别约定） | 本地 subagent | `deepseek/deepseek-v4-flash` | ~9m | ✅ |
| 14:59 | **dev（pr-002）** | 阶段 5 · pr-002 实现＋自证（含追加契约） | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | 13m30s | ✅ 提交 `9c5de19`→合并 `4bcfbc3` |
| 14:59 | planner（pr-004） | 阶段 5 · pr-004 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 11m14s | ✅ |
| 14:59 | planner（pr-007） | 阶段 5 · pr-007 内部任务 | 本地 subagent | `deepseek/deepseek-v4-flash` | 6m11s | ✅ |
| 15:07 | architect（prd/F06 收口） | 授权面内的卡片判据修正 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 15:15 | pr-planner（口径对齐） | PR 文件判据与 A-06 补定对齐 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 15:27 | **dev（pr-007）** | 阶段 5 · pr-007 产物落地＋自证 | 本地 subagent（**agent=dev**） | **`openai/gpt-5.6-luna`** | — | ⏸ 在途 |
| 15:40 | **dev（pr-004）** | 阶段 5 · pr-004 实现＋自证（含 T0 透传） | 本地 subagent（**agent=dev**） | 待回报 | — | 在途 |
| 15:46 | pr-planner（T0 落地） | pr-004/pr-008 文件范围与验收修订 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~6m | ✅ |
| 15:49 | architect（context-pool 同步） | §4 A-05 / §5 / §6 / §10 同步 | 本地 subagent | `deepseek/deepseek-v4-flash` | ~9m | ✅ |
| 15:50 | **verifier（pr-002）** | 阶段 5 · pr-002 独立验收 | 本地 subagent（**agent=verifier**） | **`powerby/grok-4.6`** | 6m30s | ✅ PASS（0/0/2 偏差） |
| 15:57 | pr-planner（欠账收口） | pr-002 tasks 文件口径同步（22 处） | 本地 subagent | `deepseek/deepseek-v4-flash` | ~5m | ✅ |
| 16:07 | **verifier（pr-003）** | 阶段 5 · pr-003 独立验收 | 本地 subagent（**agent=verifier**） | 待回报 | — | 在途 |
```

上述 27 条数据行逐条重建为本 PR 的唯一 `dispatch-ledger.md`；没有追加“快照 +1”，15:27 自身派发行只保留一次。

合并行拆分对照（至少三组）：
```text
status: planner ×3（pr-001/002/003） → 14:33 planner pr-001；14:33 planner pr-002；14:33 planner pr-003
history: dev（pr-002）+ planner ×2（pr-004/pr-007） → 14:59 dev pr-002；14:59 planner pr-004；14:59 planner pr-007
status: 阶段 6 verifier 两轮 → 14:00 verifier 首轮；14:24 verifier 返工后靶向复验
```

**1.3 载体三文件实测原文**

命令与原样 stdout：
```text
$ grep -n 'model:' /Users/chenchiyuan/.omp/agent/agents/dev.md
4:model: "@dev"
$ grep -n 'model:' /Users/chenchiyuan/.omp/agent/agents/verifier.md
4:model: "@verifier"
$ sed -n '/modelRoles/,/^[a-z]/p' /Users/chenchiyuan/.omp/agent/config.yml
modelRoles:
  default: deepseek/deepseek-v4-flash:high
  # 0030-hub-communication-upgrade · L1-01 裁决：角色别名 → 具体模型值集中在本处（唯一真源）
  # 消费者 = ~/.omp/agent/agents/{dev,verifier}.md 的 frontmatter `model: "@dev" / "@verifier"`
  # 载体形态为「用户级」（不触仓库规则 F）；范围仅覆盖 harness 本地 subagent 通道，
  # 与 oamp 集群通道的角色级绑定（cluster.json 的 roles.<role>.model）互不替代 —— 见迭代产物 model-routing-carrier.md
  dev: openai/gpt-5.6-luna
  verifier: powerby/grok-4.6
dev:
```
`default` 的 `:high` 后缀与非绑定角色自报串无后缀，故台账按实测快照比对，不直接把 config 串当自报值。

**1.4 判据层/递归层**

命令与原样 stdout：
```text
$ grep -nE '^[[:space:]]*model:' roles/*/*.md || echo "(无命中)"
(无命中)
$ grep -nE 'openai/gpt-5.6-luna|powerby/grok-4.6' roles/*/*.md || echo "(无命中)"
(无命中)
$ grep -rnE 'openai/gpt-5.6-luna|powerby/grok-4.6' roles/ | wc -l
6
$ grep -rlE 'openai/gpt-5.6-luna|powerby/grok-4.6' roles/
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence/roles/verifier/data/verify-20260917-142447-0030-prs-rework.md
/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence/roles/verifier/data/verify-20260917-140951-0030-prs.md
```
判据层 0 命中；递归层 6 条、2 个既有 verifier 取证文件，均未改写。

**1.5 deferred 基线（追加前为 3 条）**

命令与原样 stdout：
```text
$ grep -c '^## ' deferred-demand-changes.md
3
$ grep -cE '^[-*[:space:]]*\*\*问题\*\*' deferred-demand-changes.md
3
$ grep -cE '^[-*[:space:]]*\*\*为什么判定为需求层面问题\*\*' deferred-demand-changes.md
3
$ grep -cE '^[-*[:space:]]*\*\*本迭代如何处理\*\*' deferred-demand-changes.md
3
$ grep -nE '^[-*[:space:]]*\*\*本迭代如何处理\*\*' deferred-demand-changes.md | grep -E '暂停|回退|改需求'
15:- **本迭代如何处理**：**不回退、不暂停**——阶段 2~4 不受影响（...）
24:- **本迭代如何处理**：不回退不暂停，作为 **F03/F01 的已知覆盖边界**...
$ grep -cE '见上文|同上' deferred-demand-changes.md
0
```
两条字面命中均是否定式声明，不是暂停或回退处置动作。

### ② T2 · 载体文档锚点校验

命令：
```text
$ /tmp/0030-pr-007/anchor-check.sh docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md 'openai/gpt-5\.6-luna' 'powerby/grok-4\.6' 'model: "@dev"' 'model: "@verifier"' 'modelRoles\.dev' 'modelRoles\.verifier' '仓库之外' '不入版本控制' 'roles/\*/\*\.md'; echo exit=$?
```

原样 stdout：
```text
PASS [3] openai/gpt-5\.6-luna
PASS [3] powerby/grok-4\.6
PASS [2] model: "@dev"
PASS [2] model: "@verifier"
PASS [2] modelRoles\.dev
PASS [2] modelRoles\.verifier
PASS [1] 仓库之外
PASS [1] 不入版本控制
PASS [3] roles/\*/\*\.md
合计 9 项 / 失败 0 项
exit=0

人读确认：①其余角色不新增绑定、使用默认 agent 等于当刻生效模型；② `status.md` 用户裁决落定为候选 B，实测证据指向 13:57 台账两行且不引用 12:40；③本地 subagent 与 oamp 集群是两条适用范围，`cluster.json` 零改动且无同步/生成机制。

### ③ T3 · 唯一台账校验

命令与原样 stdout：
```text
$ awk -f /tmp/0030-pr-007/ledger-check.awk docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md; echo exit=$?
合计 27 行 / 失败 0 项
exit=0
$ grep -c '^| 时点 |' docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md
1
```
27 行均六格非空；`dev` 非未回报行均为 `openai/gpt-5.6-luna`，`verifier` 非未回报行均为 `powerby/grok-4.6`，其余非未回报行均等于快照 `deepseek/deepseek-v4-flash`；2 个未回报行均为 `⏸ 在途`。唯一表为 `dispatch-ledger.md`，没有 `evidence/f08-*`。

### ④ T4 · brief 抽检与 git 事实

抽检 A 为本条 15:27 `dev` 派发：brief 的「工作区地址」原文是 `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade/.pb-agents/worktrees/0030-pr-007-model-routing-and-process-evidence`；`wc -l roles/dev/dev.md` 原样为 `195`，机械证明角色定义全文注入依据可复核。抽检 B 为 history 的 14:33 `planner（pr-001）` 派发：对应 tasks 头部第 6 行给出 pr-001 worktree 绝对路径，且 `wc -l roles/planner/planner.md` 原样为 `204`；history 载荷明确记录该批 brief 的角色定义全文注入。

阶段 6 形态声明含三类 git fact：worktree 落点由 `git worktree list --porcelain`；分支时间窗由 `git log --format='%ci %h %s' <branch>`；提交交错由 `git log --graph --oneline --all`。不要求 hub 调用记录作为证据。

原样实样：
```text
$ git -C <PR worktree> worktree list --porcelain
worktree /Users/chenchiyuan/projects/agents
HEAD 706e3d004029396b0ab24f95c3951b9fe7226214
branch refs/heads/main
worktree /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0030-hub-communication-upgrade
HEAD 270e712dc9ba442bae55e4dc190630835db8e31e
branch refs/heads/iteration/0030-hub-communication-upgrade
worktree <PR worktree>
HEAD f81d5c6796d4fec8599d064ef128c9157897fec0
branch refs/heads/feat/0030-pr-007-model-routing-and-process-evidence

$ git -C <PR worktree> log --format='%ci %h %s' -3
2026-09-17 14:35:03 +0800 f81d5c6 merge: pr-001 reason 映射叶子模块（F04）into iteration/0030-hub-communication-upgrade
2026-09-17 14:30:35 +0800 99abe6b docs(0030): 派发台账更新（dev pr-001/pr-003 + verifier pr-001 + 两轮 Gate 验证）
2026-09-17 14:30:25 +0800 8c8bd33 feat(0030): pr-003 tasks 文件（473 行，含 planner 实跑纠正的 4 处事实）+ dev(pr-003, gpt) 派发 + 证据落点/跨PR契约记账
```

### ⑤ T5 · 摩擦条目

触发复核原样结果：判据层 `roles/*/*.md` 两项均为 `(无命中)`；递归层为 `6` 条 / `2` 文件；deferred 追加前三要素为 `3/3/3`，条目数为 `3`。因此 MI-P5 触发，末尾追加阶段 5 条目，新增条目三要素均为具体内容，并引用 `model-routing-carrier.md` 判据层声明；处置明确“不将该摩擦搭置当作阻塞理由”。

追加后命令与原样 stdout：
```text
$ grep -c '^## ' deferred-demand-changes.md
4
$ grep -cE '^[-*[:space:]]*\*\*问题\*\*' deferred-demand-changes.md
4
$ grep -cE '^[-*[:space:]]*\*\*为什么判定为需求层面问题\*\*' deferred-demand-changes.md
4
$ grep -cE '^[-*[:space:]]*\*\*本迭代如何处理\*\*' deferred-demand-changes.md
4
$ git -C <PR worktree> diff --numstat -- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md
8	0	docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md
$ git -C <PR worktree> diff -U0 -- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md | grep -cE '^-[^-]'
0
```

### ⑥ T6 · 封闭性守卫

命令与原样 stdout：
```text
$ git -C <PR worktree> diff --name-only f81d5c6 -- oamp oamp/sdk oamp/web cluster.json tools roles
（空）
$ find <PR worktree> -name 'f08-*'
（空）
$ ls <PR worktree>/docs/iterations/0030-hub-communication-upgrade/evidence/
f09-process-contract.md
$ git -C <PR worktree> status --short
 M docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md
?? docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md
?? docs/iterations/0030-hub-communication-upgrade/evidence/
?? docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md
```

状态输出恰为本 PR 四个路径；`oamp/**`、`roles/**`、`tools/**`、`cluster.json` 与运行时文件面均无差异；`evidence/` 只有 `f09-process-contract.md`，无 `f08-*`。历史 `history.md` / `clarifications/**` 中的 `dispatch-ledger` 文字是既有规划流水引用，不是第二张表；实际表头计数为 1。

本次提交前验收命令（提交动作按简报指定执行）：
```text
$ git -C <PR worktree> add docs && git -C <PR worktree> commit -m "feat(0030-pr-007): 模型路由载体声明 + 唯一派发台账 + F09 过程证据 + 摩擦条目"
```

提交后原样 stdout：
```text
[feat/0030-pr-007-model-routing-and-process-evidence ffb4b6b] feat(0030-pr-007): 模型路由载体声明 + 唯一派发台账 + F09 过程证据 + 摩擦条目
 4 files changed, 170 insertions(+)
 create mode 100644 docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md
 create mode 100644 docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md
 create mode 100644 docs/iterations/0030-hub-communication-upgrade/model-routing-carrier.md
$ git -C <PR worktree> status --short
（空）
```
