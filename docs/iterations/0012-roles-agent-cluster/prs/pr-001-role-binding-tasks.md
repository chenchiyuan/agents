# pr-001 任务列表（role-binding）

**来源**：`prs/pr-001-role-binding.md`（验收标准）+ `architecture.md` §3.1 / §3.4 / §5.1 / §8(AR-01/AR-02) / §12.2 跨组契约 2
**范围**：`oamp/src/role-binding.js`（新建）、`oamp/test/role-binding.test.js`（新建）；不碰任何既有文件、零新依赖
**依赖图**：T1 → T2 → T3（T2/T3 均只依赖 T1；无环，无外部前置）

---

## T1 · 角色根解析与角色文件路径（`resolveRoleRoot` / `resolveRoleFile`）

**做什么**
- `resolveRoleRoot(env)`：`env.OAMP_ROLE_ROOT` 为**非空字符串**时取该值并绝对化（`path.resolve`）；否则返回包根上级 = `path.resolve(PKG_ROOT, '..')`。`PKG_ROOT` 按本模块自身位置推导（`path.dirname(fileURLToPath(import.meta.url))` → `..`），与 `src/config.js:10` 同口径（与 cwd 无关）。
- `resolveRoleFile(root, role)`：返回 `path.resolve(root, 'roles', role, role + '.md')`（绝对路径）。**只解析路径，不判存在性**（存在性归调用方，架构 §3.1 / §5.1）。

**验收（可测试判据）**
- `resolveRoleRoot({})` === `path.resolve(<oamp>/..)`（即仓库根绝对路径）。
- `resolveRoleRoot({ OAMP_ROLE_ROOT: '/tmp/x' })` === `/tmp/x`；空串视为未提供 → 回落默认；相对值被绝对化。
- `resolveRoleFile('/tmp/root', 'dev')` === `/tmp/root/roles/dev/dev.md`；传入默认根时 === `<仓库根>/roles/dev/dev.md`。
- 函数为纯函数：同参数重复调用结果一致；不读文件系统、不依赖 cwd。

**前置依赖**：无　**优先级**：P0（T2/T3 的路径基准）

---

## T2 · 正向映射 `instanceIdForRole(role)`

**做什么**
- 返回 `'pb-' + role`（公式单一真源，`'pb-'` 字面量只出现在本文件）。

**验收**
- `instanceIdForRole('dev') === 'pb-dev'`；对 10 个真实角色名逐个成立（architect/demand/dev/planner/pr-planner/prd/progress-observer/retrospective/verifier/workflow-pb）。
- `grep -rn "'pb-'" oamp/src` 只命中 `src/role-binding.js`（F01-1 公式单点）。
- 不改写 `role`（无后缀、无大小写规范化）。

**前置依赖**：无（与 T1 同文件但无调用依赖）　**优先级**：P0

---

## T3 · 反向映射 `roleFromInstanceId(instanceId)`

**做什么**
- `env` 默认为 `process.env`（可选第二参数，供测试注入 `OAMP_ROLE_ROOT`）。
- 按 `^pb-(.+)$` 提取 role；不匹配（含 `'pb-'`、无前缀、非字符串）→ `null`。
- 提取成功后再校验 `<roleRoot>/roles/<role>/<role>.md` **存在**：存在 → 返回 role；不存在 → `null`（架构 §3.1「`^pb-(.+)$` 且角色文件存在才成立」；供 §3.4 单起路径推断消费）。

**验收**
- 默认 env 下 `roleFromInstanceId('pb-dev') === 'dev'`（仓库存在 `roles/dev/dev.md`）。
- `roleFromInstanceId('dev-1')` / `roleFromInstanceId('pb-')` / `roleFromInstanceId('')` / 非字符串 → `null`。
- `OAMP_ROLE_ROOT=<fixture>` 指向含/不含 `roles/<role>/<role>.md` 的临时目录 → 分别返回 role / `null`（存在性判定的正反例）。
- `'pb-dev-1'` 在仅有 `roles/dev/` 的根下返回 `null`（`.` 与 `-` 不被截断，id 无后缀语义）。

**前置依赖**：T1（路径解析）　**优先级**：P0

---

## T4 · 测试文件（覆盖 T1~T3 全部验收）

**做什么**
- 新建 `oamp/test/role-binding.test.js`：`node:test` + `node:assert/strict`，风格参照 `test/config-file.test.js`；fixture 一律落 `mkdtempSync(tmpdir())` 临时目录，不写 oamp/、不依赖真实 omp / 网络 / tmux。
- 覆盖：10 角色正向映射、`roleFromInstanceId` 正反例、非法输入、`OAMP_ROLE_ROOT` 覆盖、缺省 roleRoot、角色文件存在性正反例。

**验收（可测试判据）**
- `node --test test/role-binding.test.js` 全绿（在 `oamp/` 下运行）。
- `node --check src/role-binding.js` 通过。
- `npm test`：既有 152 用例全绿 + 本 PR 新增用例全绿；既有 16 个测试文件零修改。

**前置依赖**：T1 / T2 / T3　**优先级**：P0

---

## 交付报告契约（dev 段）

1. 改动文件（绝对/相对路径 + 行数）
2. 导出符号清单
3. 测试结果：`node --test test/role-binding.test.js`、`node --check src/role-binding.js`、`npm test`
4. 越界声明（含是否改了范围外文件）

## model_inferred 验收标准

无 —— 每条均可追溯到 PR 卡验收标准或 architecture §3.1 / §12.2 契约 2 / `config.js:10` 的既有口径。

## 循环依赖

无（T1→T2/T3→T4，DAG）。
