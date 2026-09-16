# pr-006：协议文档面与索引快照（`API.md` / `llms.txt`）

## 上下文摘要

`oamp/API.md` 与生成的 `oamp/llms.txt`：§3 清单 21 → **29** 行 + 8 个新 `### 3.x` 小节；新增「等待语义」小节（F12 的**唯一真源**，四条条文）；既有小节文字**逐字不改**；`node oamp/scripts/gen-llms-txt.mjs` 重生成包根快照（HTTP `/llms.txt` 响应字节与仓库快照同源）。

关键约束：`hub doctor` 的 R1 以 `API.md` §3 的表行与运行侧 `GET /api/docs` 投影**双向**比对（`sdk/doctor.js:readDocumented / compareSignatures`），漏一行即判 `文档未覆盖` ⇒ 本 PR 与 pr-005 是同一交付面的两侧，R-5 要求本 PR 的验收含"`hub doctor` 全 pass"。`README.md` **不改**（既有 HTTP 表的不一致属既有遗留，R-4）。

## 涉及功能点

- F11
- F12
- F17

## 文件范围

- `oamp/API.md`
- `oamp/llms.txt`（由既有脚本生成，不手改）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（路由登记与元数据归 pr-005）、`oamp/sdk/**`（入口面归 pr-007）、`oamp/skill/hub.md`（归 pr-007）、`oamp/README.md`（不改）、`oamp/scripts/gen-llms-txt.mjs`（既有生成器，零改动）。

## 验收标准

- [ ] `oamp/API.md` §3 标题计数由 21 改为 29，表行 **29** 条且与运行侧 `GET /api/docs` 的 `routes[]` **双向 1:1**（无缺项、无多出）（F17 验收 2/3）
- [ ] 8 个新 `### 3.x` 小节齐备，逐条含 `{摘要 / 参数 / 响应 / 错误 / docLink}` 五项语义；**摘要以调用方视角写**（说明"解决什么问题"，不是罗列入参出参）（F17 验收 1/4）
- [ ] 新路由的 `docLink` 锚点可解析到对应小节（`API.md#<slug>`，逐字沿用既有形态）
- [ ] 新增「等待语义」小节（位置按既有章节体例，A-09 记为 `### 2.4`），明文四条：① 等待的退出条件**必须**是终态 ② 超时**只表示放弃等待**，不改变任务状态、不产生失败结论 ③ **禁止**把"轮询 + 超时"当作等待的实现 ④ 客户端等待预算（如 30 分钟）是**放弃等待的预算**，不是等待的语义上限（F12 验收 1/5）
- [ ] 既有 21 条表行与 21 个小节的文字**逐字不变**：`git diff -- oamp/API.md` 的删除行仅限 §3 标题计数那一行（`## 3. 接口清单（21 条）` 的计数改写）（F17 验收 5 / G01）
- [ ] `oamp/llms.txt` 由 `node oamp/scripts/gen-llms-txt.mjs` 重新生成（非手改）：`git diff` 中该文件的变更全部落在接口清单段；生成器自报条目数 = 29（F17 验收 2）
- [ ] 快照与 HTTP 产物同源：`GET /llms.txt` 的响应字节与包根 `oamp/llms.txt` **逐字节相同**（既有单产物结构，Z-6）
- [ ] `hub doctor` 三段全 `pass`：R1 无 `文档未覆盖` / 无 `登记缺失`；R2 覆盖新增的非流式 GET（自动扩展，`doctor.js` 零改动）；R3 探针集不变（F17 验收 3 / R-5）
- [ ] `oamp/README.md` 未被修改（`git diff --name-only` 不含它）、`oamp/sdk/doctor.js` 未被修改
- [ ] 条文与行为一致（反向验证）：对一个仍在跑的调用等待到超时 ⇒ 返回后该调用 `calls get` 仍为非终态、`error` 为空、`exit_code` 未变（F12 验收 2 的条文侧对照）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F11-single-call-wait-entry.md`（验收 1/6）、`F12-wait-semantics-clause.md`（验收 1~5）、`F17-service-metadata-discoverability.md`（验收 1~5）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §3.10（文档投影链）、§4 A-09（条文落点与四条内容）、§4 A-14（`API.md` 同步"不是可选项"）、§5.5（`API.md` / `llms.txt` 改动面）、§6.2 S-11（doctor 条目自动扩展）、§7 L2-11、§9.2 N-13、§10 R-4 / R-5
- 代码锚点：`oamp/scripts/gen-llms-txt.mjs:12`（`import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js'` —— 生成物直接由路由登记投影产出）、`oamp/src/web.js:1384`（`projectRoutes`）、`oamp/src/web.js:1402`（`renderLlmsTxt`）、`oamp/sdk/doctor.js`（R1 的 `readDocumented` 读 `API.md` §3 表行、`compareSignatures` 双向比对；`API_DOC_PATH` = 包根 `API.md`）、`oamp/API.md:157-181`（现状 21 行清单与 `### 3.x` 体例）

## depends_on

- pr-005-web-session-and-call-surface.md（理由：本 PR 两侧产物都由 pr-005 的路由登记派生的契约决定 —— 证据：① `oamp/scripts/gen-llms-txt.mjs:12` 直接 import `createApiRoutes / projectRoutes / renderLlmsTxt`，`llms.txt` 的条目集合 = `createApiRoutes` 表内容，缺 pr-005 的 8 行则生成的清单少 8 条；② `oamp/sdk/doctor.js` 的 R1 以 `API.md` §3 表行为文档侧、以运行侧 `GET /api/docs`（= 同一份登记投影）为对照做双向比对，两侧不同源必判 `登记缺失` / `文档未覆盖` ⇒ "R1 全 pass"这一验收项在 pr-005 合并前不可判）

## batch

3

## 验收证据

（本 PR 执行时填写：§3 计数与 29 行清单原文 + `git diff --numstat -- oamp/API.md oamp/llms.txt`（删除行仅计数行）+ 生成器自报输出 + `/llms.txt` 与包根快照的逐字节比对（`cmp` / `sha256sum`）+ `hub doctor` 三段原始输出 + 等待语义小节的条文原文。）
