# pr-001 持久层：归档字段、幂等迁移与归档/激活写口

## 上下文摘要

数据层：`persist.js` 加 `archived_at`（可空，NULL=未归档）与 `context_released`；`openDb` 按列存在性守卫幂等迁移；列表查询加 `archived` 视图槽、互斥谓词与排序键；新增 `archiveChat`/`activateChat`/`listArchivable`；同步 `persist.test.js` 补迁移/双视图用例。

## 涉及功能点

- F01（批量归档的范围：候选集 = `listArchivable` 的「未归档且非进行中」；`archiveChat` 的 `state != 'working'` 守卫是范围的数据层兜底）
- F02（归档标记与归档时间同址持久化、既有行默认语义、跨重启持久）
- F03（归档视图与主列表互斥、归档时间倒序 + 同时间 `chat_id` 倒序、`total` 与列表同源恒一致）
- F04（归档视图分页：既有 `limit/offset` 在双视图下的无重叠无遗漏与 `total` 一致性）
- F05（激活的数据语义：清标记、`closed→completed`、清 `closed_at`、`updated_at` 前移即置顶、`WHERE archived_at IS NOT NULL` 的结构性收窄）

## 文件范围

- oamp/src/persist.js（改造：SCHEMA 补 2 列 + `migrate()`；`LIST_WITH`/`LIST_FROM`/`ORDER BY`；`CHAT_COLUMNS`；`setOutputState`；新增 3 个口与导出白名单）
- oamp/test/persist.test.js（改造：既有逐字断言按 architecture §7.1 同步 + 新增迁移/双视图/写口用例）

## 验收标准

- [ ] **迁移幂等与新旧库同构**：以现行 7 列 SCHEMA（`oamp/src/persist.js:13-21` 的文本）手工建库并插入一行数据 → `openDb` → `SELECT name FROM pragma_table_info('chats')` 与新建库**逐位相同** = `['chat_id','title','agent_id','state','created_at','updated_at','closed_at','archived_at','context_released']`；该旧行 `archived_at IS NULL` 且 `context_released = 0`；`close()` 后再次 `openDb` 同一路径不抛错且列集不变（M-1 / M-2 / M-3）
- [ ] `archiveChat` 双守卫：对未归档且非 `working` 的 chat → 返回 `true`、`archived_at` = 传入毫秒、`context_released = 1`；对 `working` → 返回 `false` 且两列均不变；对已归档再归档 → 返回 `false` 且 `archived_at` 不被刷新（F01-2 / F01-4 / F02-2）
- [ ] `activateChat` 一条语句三件事：对未归档 → `false` 且 `state`/`updated_at`/`closed_at` 全不变；对 `closed` 来源的归档项 → `archived_at IS NULL`、`state = 'completed'`、`closed_at IS NULL`、`updated_at` 前移；对 `completed` 来源 → `state` 仍 `completed`、`closed_at` 仍 `NULL`；重复激活 → 第二次 `false` 且 `updated_at` 不再前移（F05-3 / F05-4 / F05-8）
- [ ] **双视图互斥与 `total` 一致性**：造混合数据（未归档 completed/working + 已归档若干，含两条 `archived_at` 相同）→ 缺省 `listChats()` 不含任何已归档、`total` 与返回集一致；`listChats({archived:1})` 只含已归档且顺序 = `archived_at DESC, chat_id DESC`（同时间由 `chat_id` 兜底）；`listChats({state:'closed'})` 排除已归档的 closed；`listChats({archived:2})` 抛错（F03-2 / F03-3，V-1 / V-2 / V-3）
- [ ] **归档视图分页**：归档 60 条（`archived_at` 递增），用 `limit: 20` 分三页取回——三页并集无重复无遗漏、并集大小 = `total` = 60（F04-1 / F04-3 / F04-4）
- [ ] `listArchivable()` 只返回未归档且 `state != 'working'` 的 chat_id：completed / failed / closed 全部入选，`working` 与已归档全部排除（F01-2）
- [ ] **既有契约同步（AR-17）**：`persist.test.js` 的 chats 列名断言（`:70-73`）、写口白名单（`:106-111`，结果集**按 `.sort()` 字母序**变为 `['activateChat','archiveChat','closeChat','insertInput','insertOutput','startupSweep','upsertChat']`——`'act' < 'arc'`，顺序照抄错会直接失败；且 `listArchivable` 列入读口排除名单）、`getChat().chat` 键白名单（`:303-305`，追加 `archived_at`/`context_released`）、`upsertChat`/`closeChat` 的 `deepEqual`（追加 `archived_at: null, context_released: 0`）全部按 §7.1 逐字更新；`:48-57` 的「重复 openDb 不抛错」既有用例在补列后仍绿
- [ ] `cd oamp && node --test test/persist.test.js` 全绿；本 PR 内 `oamp/src/web.js`、`oamp/web/**`、`oamp/README.md`、其余 19 个既有测试文件零改动

## 参考资料

- docs/iterations/0013-chat-archive/architecture.md §3.1（字段设计）、§3.2（迁移写法 M-1~M-5）、§3.3（双视图查询 V-1~V-5）、§4.1（三个口与两处最小改动）、§4.2（激活语义落点）、§7.1（persist.test.js 的逐条改法）、§10（AR-04 / AR-05 / AR-08 / AR-14 / AR-15 / AR-17）、§11（F01~F05 的判定锚点）
- docs/iterations/0013-chat-archive/prd/F01（验收 2/4）、F02（验收 1/2/6）、F03（验收 2/3）、F04（验收 1/3/4）、F05（验收 3/4/8）
- 现行代码锚点：`oamp/src/persist.js:13-21`（chats 现行 7 列）、`:36`（`CHAT_STATES`）、`:45`（`CHAT_COLUMNS`）、`:49-56`（`LIST_WITH`/`LIST_FROM`，全仓唯一的列表查询真源）、`:110-114`（`openDb` 的 `exec(SCHEMA)` 位置，迁移块插在其后、`stmts` 之前）、`:136`（`setOutputState`，本次追加 `context_released = 0`）、`:138`（`closeChat` 的幂等形状，`archiveChat` 照此加双守卫）、`:145-152`（`listChats` 与 `countChats` 共用同一 `LIST_FROM`）、`:191-207`（参数数组构造一次、同值喂给两条语句 —— V-2 的既有不变式）、`:219`（导出白名单）
- `oamp/test/persist.test.js:26-27`（`openTempDb`：库一律指向临时目录）、`:48-57`（建库幂等既有用例）、`:70-77`（列名逐字断言）、`:106-111`（写口白名单）、`:299-305`（详情键白名单）

## depends_on

（无）

> 本 PR 不消费任何其他 PR 的产出：其唯一上游是 0011 已合入 `main` 的 `oamp/src/persist.js` 现状（`import { DatabaseSync } from 'node:sqlite'`，零第三方依赖），新增列与新增口都落在同一个文件内闭环。它自身是 pr-002 的唯一前置。

## batch

1
