# F07：配置面（数据位置可配置）

**功能 ID**: F07
**来源**: 用户决策 2026-09-10（`architecture.md` §9 第 1 条，user_confirmed：配置文件驱动、默认 `data/sql.db`、环境变量可覆盖）；**已裁定保留（2026-09-10 主 agent）：依据用户决策「基于配置文件，默认 data/sql.db」**（原 `[model_inferred]` 越界候选状态已撤销）；关联 D-3（持久化形态）
**迭代**: 0011-chat-context-protocol

---

## 用户价值

部署者 / 使用者能决定数据落在哪里（换机器、分离数据盘、跑测试时隔离数据），不用改代码。

## 验收标准

1. **默认位置**：未提供配置文件时，数据落在默认位置 `data/sql.db`（相对基准 = 包根 `oamp/` → `oamp/data/sql.db`，与 cwd 无关）（用户决策 §9-1）。
2. **配置文件可指定**：通过配置文件指定数据位置后，数据落在指定位置（配置文件 = `oamp/config.json`，JSON 格式，键 `data.db`；`OAMP_CONFIG` 可指向其它配置文件路径）（用户决策 §9-1）。
3. **缺失不失败**：配置文件不存在时服务正常启动，全部使用默认值，不报错退出（用户决策 §9-1）。
4. **非法即失败**：配置文件内容非法时快速失败并给出明确错误，不静默忽略 `[model_inferred]`。
5. **覆盖优先级**：环境变量 > 配置文件 > 默认值；三者同时存在时以环境变量为准（用户决策 §9-1）。
6. **生效可观察**：修改配置后重启服务，新数据写入新位置、历史数据从新位置读取 `[model_inferred]`。

## 边界（不包含）

- 不做运行期热更新 / 配置重载（demand 外）。
- 不做配置的图形界面、远程下发、多环境 profile 体系（demand 外）。
- 不做数据文件的位置迁移工具（N-5 不迁移；改配置后旧位置数据不自动搬运）。
- 其余配置项（默认模型、容量上限等）的具体归属见 F06 / F05，本卡只锁"数据位置"这一面。

## 架构维度（阶段 3 已填，2026-09-10；详见 `architecture.md` §8）

- **文件路径/格式**：`oamp/config.json`（JSON，`node:fs` 零依赖解析；`OAMP_CONFIG` env 可指向其它路径），仅三个键：`data.db` / `defaults.model` / `context.max`。**缺失** → 全部使用内置默认、服务正常启动（对应验收 1/3）；**非法**（JSON 解析失败 / 顶层非对象 / 键类型错 / `context.max` 非正整数）→ 加载器抛错、进程入口打印 `OAMP 配置错误: <原因>` 并退出码 1，**不静默忽略**（对应验收 4）；未知键忽略（不为"未来键"做校验）。
- **环境变量名与优先级**：`OAMP_DB` > `config.data.db` > `data/sql.db`；`OAMP_OMP_MODEL` > `config.defaults.model` > `openai/gpt-5.6-luna`；`OAMP_CTX_MAX` > `config.context.max` > `8`（**逐键独立**，env 恒胜，对应验收 2/5）。
- **默认路径基准**：相对**包根 `oamp/`**（与既有 `config.js` 的 `PKG_ROOT` socket 推导同法、与 cwd 无关）→ 默认落 `oamp/data/sql.db`；打开前 `fs.mkdirSync(dirname, {recursive:true})` 建目录。**生效时机**：启动时读取一次，**不做热重载**——改配置 + 重启后新数据写新位置、历史从新位置读（对应验收 6）。
- **忽略规则与产物落点**：`oamp/.gitignore` 追加 `data/`（现有仅 `.runtime/`），产物落点 `oamp/data/sql.db`（含 SQLite 可能的 `-journal`/`-wal` 兄弟文件，随目录一并忽略）。
