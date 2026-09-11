# pr-002 任务列表（集群配置加载与校验 + 仓库根 cluster.json）

**来源**：`prs/pr-002-cluster-config.md`（验收 1~8）+ `architecture.md` §5.1（`cluster.json` 落点 / schema / 校验表，`:311-365`）、§3.1（role-binding 单一真源与角色根，`:150-160`）、§4.1（模型承载与解析链，`:223-230`）、§12.2 跨组契约 3（`:677`）、§8 AR-12/AR-17/AR-18、§5.6（测试组织）
**范围**：`oamp/src/cluster-config.js`（新建）、`oamp/test/cluster-config.test.js`（新建）、`cluster.json`（仓库根，新建、tracked）；零新第三方依赖、既有 16 个测试文件零修改、不改 prd/architecture
**依赖图**（无环）：T1 → T2 → { T3 ∥ T4 }（三者在同一文件内按编号单线落笔；T4 复用 T2 的归一结果）→ T5（内容必须能被 T1~T4 全量校验通过）→ T6。**外部前置**：pr-001 `src/role-binding.js` 的 `instanceIdForRole` / `resolveRoleFile` / `resolveRoleRoot`（已合入）。

---

## T1 · 配置读取、路径优先级与顶层归一

**做什么**
- 导出 `loadClusterConfig({ path, env } = {})`：`const envVars = env ?? process.env`。
- 路径优先级（§5.1 `:313`）：显式 `path` 参数 > `env.OAMP_CLUSTER_CONFIG` > **缺省 = `path.join(resolveRoleRoot(envVars), 'cluster.json')`**（角色根口径，复用 pr-001；不用自推 `PKG_ROOT`），`path.resolve` 绝对化。
- 返回 `root = path.dirname(configPath)`（绝对）——`cwd` 基准与角色文件预检基准都用它（§5.1 `:362`）。
- 顶层归一：`session`（非空字符串，缺省 `'oamp-cluster'`）、`web`（对象，缺省 `{}`；`port` 整数 1~65535，缺省 `7788`）、`router`（对象，缺省 `{}`；`socket` 为 `null` 或非空字符串，缺省 `null`）；未知顶层键忽略。
- 失败语义（全部 `throw new Error(<原因>)`，**不带** `配置错误:` 前缀——前缀按 §5.1 `:352` 由调用方收口为 `oamp cluster: 配置错误: <原因>`）：文件不存在/不可读、非法 JSON、顶层非对象、`session`/`web`/`router`/`port`/`socket` 类型与取值非法。消息含具体字段与当前值（JSON.stringify），与 `src/config.js` 的 `OAMP 配置错误: context.max 需为正整数（当前值 …）` 同风格。

**验收（可测试判据）**
- 显式 `path` 与 `env.OAMP_CLUSTER_CONFIG` 同时给出 → 取显式；只给 env → 取 env；都不给 → 取 `<roleRoot>/cluster.json`（测试用 `env:{}` 断言 `root === <worktree 仓库根>`，且能加载真实 `cluster.json`）。
- `{}` 配置（含一个 enabled 角色）→ `session='oamp-cluster'`、`web.port===7788`、`router.socket===null`、`root===<配置文件所在目录>`。
- 非法 JSON / 顶层数组 / `web.port=0|65536|1.5|'7788'` / `session:''` / `router.socket:''` → 抛错，消息含字段名。

**前置依赖**：无　**优先级**：P0

---

## T2 · 角色段 schema 归一（缺省填充 + 类型取值校验 + `instanceId` 单点）

**做什么**
- `roles` 必须为对象（角色名 → 角色段）；角色段必须为对象。**Map 键 = 角色名**，插入顺序 = 配置声明序（`Map` 保序；pr-005 的窗口顺序依赖此序）。
- 角色段字段（§5.1 `:343-349`）：`enabled`(bool, 缺省 `true`)、`model`(非空 string, 缺省不写)、`tools`(bool, 缺省 `true`)、`permission`(`'allow'|'deny'`, 缺省 `'allow'`)、`cwd`(非空 string, 缺省 `'.'`)；未知键忽略。
- 归一值形状（§12.2 契约 3，`architecture.md:677`）：`{ instanceId, enabled, model, tools, permission, cwd }`，其中 `instanceId` **恒由 `instanceIdForRole(role)` 产生**（本模块零字符串拼接前缀；`grep -rn "'pb-'" oamp/src` 仍只命中 `role-binding.js`）。
- `cwd` 解析：相对路径基准 = `root`（配置文件所在目录），绝对路径原样，返回值恒为绝对路径；**不做 `~` 展开**（`'~/x'` → `<root>/~/x`）。
- 无 `instance_id` 覆盖字段（§3.1 `:156`）：角色段出现 `instance_id` / `instanceId` → 抛错（未知键"忽略"与"实例名不可覆盖"冲突时以显式拒绝收口，避免用户以为改名生效）。
- 模型格式（`MODEL_RE`）不在本模块校验：§4.1 `:231` 把模型格式的失败语义归 agent 的 `--model` 校验；本模块只做类型校验，**不给未配置的角色填内置默认值**（§5.1 `:344`「缺省不写 = 用全局默认」+ §4.1 `:227` 的链 `payload > env > --model(角色) > config.defaults.model > 内置`——配置层硬填会压掉 `oamp/config.json` 的 `defaults.model` 层；内置终端默认 `deepseek/deepseek-v4-flash` 由 `src/config.js` 的 `MODEL_DEFAULT` 承载）。

**验收（可测试判据）**
- 空配置 + 角色 fixture → `roles instanceof Map`、`[...keys()]` = 声明序、每项 `enabled===true`、`tools===true`、`permission==='allow'`、`cwd===<root 绝对路径>`、`instanceId===instanceIdForRole(role)`、`model===undefined`。
- 覆盖生效：`session`/`web.port`/`router.socket`/`enabled:false`/`model`/`tools:false`/`permission:'deny'`/`cwd:'sub'`（→ `<root>/sub`）/`cwd:'/abs'`（原样）。
- 类型/取值非法逐条抛错：`roles` 非对象、角色段非对象、`enabled` 非布尔、`model` 非非空字符串、`tools` 非布尔、`permission:'x'`、`cwd:''`、`instance_id`/`instanceId` 出现。
- 未知键忽略（不抛错）：顶层 `bogus`、`web.foo`、`roles.<role>.unknown`。

**前置依赖**：T1　**优先级**：P0

---

## T3 · 凭据类键递归扫描

**做什么**
- 对解析后的整棵配置对象**递归**扫描键名（含顶层、`web`/`router`、`roles.<role>` 段；数组元素亦下钻），大小写不敏感：`token` / `secret` / `password` / `passwd` / `api_key` / `apikey` / `credential`（§5.1 `:354`）。
- 命中即抛错，消息给出**字段路径**（如 `roles.dev.api_key`）——把 F06-7「零凭据字段」从承诺变为结构性校验。
- 匹配口径（架构未定义算法，取更保守的一侧）：键名小写化并去掉 `-`/`_`/空格后做包含匹配（`API-Key` → `apikey` 命中；`githubToken` 命中）。扫描在角色预检之前执行（先结构后环境）。
- **实现注意**：`test/hygiene.test.js`（既有、零修改）以词边界大小写不敏感扫描 `src/**` 的禁止字段名 → 本模块内的模式串必须像该测试一样用字符串拼接构造（如 `'to' + 'ken'`），中文注释中不得出现这些 ASCII 词。

**验收（可测试判据）**
- 顶层 `token`、`API_KEY`、`Secret`、`password`、`passwd`、`apikey`、`credential` → 逐条抛错，消息含路径。
- 嵌套 `roles.dev.secret`、`web.api_key` → 抛错，路径正确。
- 无凭据字段（含 `bogus` 等未知键）→ 不抛错。
- `node --test test/hygiene.test.js` 原样全绿（源文件不自命中）。

**前置依赖**：T1（同文件顺序）　**优先级**：P0

---

## T4 · enabled 角色的角色文件与 cwd 预检

**做什么**
- 仅对 `enabled === true` 的角色（§5.1 `:355-356`、AR-18）：
  - 角色文件 `resolveRoleFile(root, role)` 必须存在（用 pr-001 的路径解析，不自行拼 `roles/…`）→ 否则抛错，消息含角色名与绝对路径。
  - `cwd` 必须存在且为目录（`statSync().isDirectory()`）→ 否则抛错。
- `enabled:false` 的角色：**保留在 Map 中**且 `enabled===false`，跳过上述两项预检（是否起窗口归 pr-005）；其 `cwd` 仍归一化为绝对路径（形状统一）。
- 校验全部在返回前完成（"加载即失败"）——调用方在创建 tmux session 之前拿到异常。

**验收（可测试判据）**
- enabled 角色文件缺失 → 抛错；role fixture 存在 → 通过。
- enabled 角色 `cwd` 指向不存在目录 / 指向普通文件 → 抛错；指向目录 → 通过。
- `enabled:false` + 角色文件缺失 + `cwd` 不存在 → **不抛错**，且 `roles.get(role).enabled === false` 仍在 Map 中。

**前置依赖**：T2　**优先级**：P0

---

## T5 · 仓库根 `cluster.json`

**做什么**
- 新建 `<仓库根>/cluster.json`：`session` / `web.port` / `router.socket` / `roles`（键集合**恰为 10 个角色**：architect / demand / dev / planner / pr-planner / prd / progress-observer / retrospective / verifier / workflow-pb，顺序同 §5.1 `:326-331`；**不含** `_template` / `cdp-debug-skill`）。
- 不含任何凭据类键（T3 扫描零命中）；`model` 键不出现（T2 的口径：缺省不写 = 用全局默认；交付内容 = §5.1 `:324-332` 的"交付初版"）。
- 以一个角色段显式写出 `enabled` / `tools` / `permission` / `cwd` 的**缺省等值示例**（值 = 缺省，运行行为零变化），作为 schema 自述。

**验收（可测试判据）**
- `loadClusterConfig({ env: {} })`（缺省路径）加载成功，`root === 仓库根`，`[...roles.keys()]` 深等于 10 角色清单，不含 `_template` / `cdp-debug-skill`。
- `git ls-files cluster.json` 命中（tracked）；文件内容凭据扫描零命中（F06-7 / TC-07）。

**前置依赖**：T2 / T3 / T4（内容必须通过全量校验）　**优先级**：P0

---

## T6 · `oamp/test/cluster-config.test.js` 与 PR 级验证

**做什么**
- 新建 `node:test` 测试文件：`mkdtempSync(os.tmpdir())` 造"配置文件 + `roles/<role>/<role>.md`"fixture，`t.after` 清理；**不依赖真实 omp / tmux / 网络 / Router**，不写 `oamp/`；不复用 `test/helpers/harness.js`（纯函数级模块，无子进程）。
- 用例覆盖：路径优先级（显式 > env > 缺省仓库根）、缺省填充、覆盖值、`cwd` 基准与绝对路径原样、`~` 不展开、非法输入逐条抛错（文件缺失 / 非法 JSON / 非对象 / 角色段类型 / permission 取值 / tools 类型 / port 越界 / 角色文件缺失 / cwd 缺失或非目录）、凭据字段命中（含嵌套与大小写）、未知键忽略、`enabled:false` 保留且跳过预检、Map 键为角色名且 `instanceId === instanceIdForRole(role)`、`instance_id` 字段被拒。
- 验证命令：`node --check src/cluster-config.js`、`node --test test/cluster-config.test.js`、`node --test test/hygiene.test.js`（回归）、`npm test`（全量，159 + 新增全绿）、`grep -rn "'pb-'" oamp/src`（仅 `role-binding.js`）、`git ls-files cluster.json`。

**验收（可测试判据）**：上述命令全部通过；`git status` 无范围外改动；既有 16 个测试文件零修改（`git diff --stat` 只含 3 个新文件 + 本任务文件）。

**前置依赖**：T1 / T2 / T3 / T4 / T5　**优先级**：P0

---

## 交付报告契约（dev 段）

1. 改动文件（路径 + 行数）
2. 返回结构与 schema 键（顶层 + 角色段）
3. 校验项清单（逐条 + 失败消息形态）
4. 测试结果（`node --check` / 单文件 / `npm test` 用例数）
5. 越界声明（含本任务文件位置与与 brief 的偏差）

## model_inferred 验收标准（需主 agent 确认）

| # | 任务 | 推断内容 | 追溯基础 |
|---|---|---|---|
| MI-1 | T2 | `roles.<role>.model` 未配置时返回**不含该键**（`undefined`），不硬填内置默认 `deepseek/deepseek-v4-flash` | `architecture.md:344`（schema 表「`model` \| string \| **不写**」）+ `:227`（「可选字符串；缺省不写 = 用全局默认」）+ §4.1 解析链（`:229`）——配置层硬填会让 `--model` 恒在场，压掉 `oamp/config.json` 的 `defaults.model` 层；内置终端默认由 `src/config.js` 的 `MODEL_DEFAULT` 承载。**与 dev 简报「缺省 model = deepseek/deepseek-v4-flash」的措辞按"缺省解析结果"口径统一** |
| MI-2 | T2 | `instance_id`（及 `instanceId`）出现在角色段 → **抛错**，而非按"未知键忽略"静默丢弃 | `architecture.md:156`（「公式只此一处…**不提供覆盖字段**」）与 §5.1 `:353`（未知键忽略）冲突时，取"响亮失败"：静默忽略会让用户以为改名生效（F01-1「id 无后缀」被配置面破口） |
| MI-3 | T3 | 凭据键匹配 = 键名小写化并去掉 `-`/`_`/空格后**包含**匹配（非仅精确相等） | `architecture.md:354` 只给键名清单与"大小写不敏感"，未定义算法；包含匹配更保守（漏报代价 > 误报代价，误报可在配置里改名消除） |
| MI-4 | T1 | 模块抛出的错误消息**不带** `配置错误:` 前缀 | §5.1 `:352` 明示前缀由调用方（`oamp cluster`）收口为 `oamp cluster: 配置错误: <原因>`，模块带前缀会重复 |
| MI-5 | T4 | 角色文件预检基准 = **配置文件所在目录**（`root`），不读 `OAMP_ROLE_ROOT` | §5.1 `:355`（`<root>/roles/<role>/<role>.md`）+ §3.1（`cluster up` 会按配置目录设置 `OAMP_ROLE_ROOT`，集群路径下两口径恒等；文件级测试因此无需真实仓库根） |
| MI-6 | T5 | `cluster.json` 交付内容 = §5.1 的"交付初版"（10 角色，`model` 不出现）；`enabled`/`tools`/`permission`/`cwd` 的示例以**缺省等值**写在一个角色段内 | §5.1 `:324-332`（交付初版）+ 本任务 T2（覆盖示例会改变产品默认行为：`enabled:false` 破坏 F01-1 的 10 实例、`cwd` 覆盖破坏 F07 缺省仓库根、`model` 覆盖冻结全局默认层） |

## 循环依赖

无。T1 → T2 → {T3 ∥ T4} → T5 → T6，全部单线或同文件顺序落笔，无回边。

## 开放项（不阻断本 PR，报告主 agent）

- **O-1（Map 键口径已裁决）**：简报写「roles Map 键为 instance_id」，与 `architecture.md:677`（§12.2 契约 3）及卡验收 1 的 `Map<role, {instanceId, …}>` 原文冲突。**2026-09-11 主 agent 裁决 = 键为角色名、值含 `instanceId`**（按契约原文）；测试据此断言 `[...keys()]` = 角色名且 `cfg.instanceId === instanceIdForRole(role)`。本任务文件与 dev 报告均记录该冲突。
- **O-2（`--config` / env 覆盖的消费方）**：`loadClusterConfig` 只负责"读 + 校验 + 归一"，不负责 tmux 探活、日志目录、就绪等待——归 pr-005（`src/cluster.js`）。
- **O-3（`web.port` 是否可缺省）**：prd 未要求"必须显式配端口"，故 `web` 段整体可省（缺省 7788），与 §5.1 表一致。
- **O-4（真实集群侧的预检时机）**：`cluster up` 必须在 `tmux new-session` 之前调用本模块（否则"不留半个集群"不可判定）——归 pr-005 落地，本 PR 只保证"加载即失败"。
