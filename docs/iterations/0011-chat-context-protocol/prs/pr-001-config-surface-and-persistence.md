# pr-001 配置面 + 持久层

## 上下文摘要

落地"数据落点可配置"与"chat/message 的 SQLite 持久层"。交付 `config.js` 的 JSON 配置文件层（缺失不失败、非法即失败、env > 文件 > 默认逐键覆盖）与 `persist.js` 的建库/唯一 SQL 出口/查询/关闭/启动扫尾。本 PR 只交付模块与其单测，不接线任何消费方（web/agent 接线分别落在 pr-004/pr-003）——它是一切持久化（F02/F03）与配置面（F07）的地基，可独立合并。

## 涉及功能点

- F02（对话持久化：仅两类记录、输入先落盘、失败可观察、重启可读回、空库启动）
- F03（历史查询：列表/过滤/详情的 SQL 侧实现，HTTP 层归 pr-004）
- F07（配置面：默认位置、配置文件可指定、缺失/非法/优先级/生效可观察）

## 文件范围

- oamp/src/config.js（改造：JSON 配置文件 + `dbPath`/`defaultModel`/`contextMax`）
- oamp/src/persist.js（新建）
- oamp/.gitignore（追加 `data/`）
- oamp/test/config-file.test.js（新建）
- oamp/test/persist.test.js（新建）

## 验收标准

- [ ] `loadConfig()` 在无配置文件时返回 `dbPath = <包根>/data/sql.db`（绝对路径，与 cwd 无关）、`defaultModel = 'openai/gpt-5.6-luna'`、`contextMax = 8`；既有键（`socketPath`/心跳/重连）取值与现在一致（`oamp/test/config-file.test.js` 断言）
- [ ] 优先级逐键生效：`OAMP_DB` &gt; `config.data.db` &gt; 默认、`OAMP_OMP_MODEL` &gt; `config.defaults.model` &gt; 默认、`OAMP_CTX_MAX` &gt; `config.context.max` &gt; 默认（`OAMP_CONFIG` 指向临时配置文件）
- [ ] 配置文件不存在 → 正常返回默认值不抛错；非法 JSON / 顶层非对象 / 键类型错 / `context.max` 非正整数 → `loadConfig` 抛错且信息含 `OAMP 配置错误`（web/agent 入口既有 try/catch 的退出码 1 行为不变，见 `oamp/src/web.js` 启动段与 `oamp/src/agent.js:8` 的既有调用面）
- [ ] `persist` 打开目标目录不存在的路径时自动 `mkdir -p` 后建库；重复打开同一路径幂等（`CREATE TABLE/INDEX IF NOT EXISTS` + `PRAGMA foreign_keys=ON`）
- [ ] 写接口只导出 `insertInput()`/`insertOutput()`，`direction` 不由调用方传入（结构上无法产生第三类）；一次 `insertInput` + `insertOutput` 后 `messages` 恰 2 行且 `SELECT DISTINCT direction` 为 `{in,out}`（E-5 结构面）
- [ ] `messages.meta` 的落盘与读回：`insertInput` 写 `{task_id}`、`insertOutput` 写 `{context_id, pid}`（架构 §4.1/§4.3），详情查询读回后可 `JSON.parse` 还原为同一对象——F05-2/E-1 的「两轮 `context_id`/`pid` 相等」判定依赖该字段（pr-005 的端到端断言消费此契约）
- [ ] 查询断言：默认排序 `updated_at DESC, chat_id DESC`；`limit` 默认 50 / 上限 200 + `offset` 分页稳定；时间过滤作用于 `updated_at` 闭区间；关键词命中 `chats.title` 或 `messages.text`，且 `%`/`_`/`\` 被转义（构造含 `%` 的关键词只命中字面量）；agent 相关 = `chats.agent_id` 命中或存在参与过该 chat 的 `messages.agent_id`
- [ ] 状态写入带 `WHERE state!='closed'` 哨兵（已 closed 的 chat 不被迟到结果改写）；关闭幂等；启动扫尾把遗留 `working` 置 `failed`
- [ ] 关闭连接后用同一路径重开，此前写入的 chat 与输入/输出内容一致可读回（E-3 落盘侧）
- [ ] `oamp/.gitignore` 含 `data/` 且原 `.runtime/` 规则保留（`oamp/test/hygiene.test.js` 原样全绿）
- [ ] `node --test test/config-file.test.js test/persist.test.js` 全绿；两个测试文件一律把库指向临时目录，不写 `oamp/data/`

## 参考资料

- docs/iterations/0011-chat-context-protocol/architecture.md §4.1~§4.7（schema / 落盘时机 / 查询与转义）、§8.1~§8.5（配置面与加载器形态）、§14（奥卡姆检验）、§17（测试策略）
- docs/iterations/0011-chat-context-protocol/prd/F02-conversation-persistence-input-output.md、F03-history-query-list-filter-detail.md、F07-config-surface-data-location.md
- oamp/src/config.js（现有 `PKG_ROOT` 推导在 config.js:9，`readPositiveInt` 在 :18，`loadConfig` 在 :30）
- oamp/test/hygiene.test.js（.gitignore 与零依赖静态断言）

## depends_on

（无）

## batch

1
