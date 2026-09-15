# pr-006：三层覆盖面对照用例（F02/F03/F04/F14）

## 上下文摘要

落 `test/sdk-surface.test.js`：把 `oamp/sdk/surface.js` 导出的三层入口表与三个既有只读面双向比对——层 A 21 条 ↔ `oamp/API.md` §3 的 21 行、层 B 8 条 ↔ `oamp/src/router.js` 的 8 个 `dispatch` 分支、层 C 11 条 ↔ `oamp/src/cli.js` 顶层分派；并产出 F02/F03/F04 验收 1 的清单。

## 涉及功能点

- F02
- F03
- F04
- F14

## 文件范围

- `oamp/test/sdk-surface.test.js`（新建：三层入口表 ↔ 覆盖率双向比对 + 分层判定 + 同形检查）

## 验收标准

- [ ] 层 A 双向比对：入口表的 `api` 条目与 `oamp/API.md` §3 解析结果逐条对应（21 行，`<param>` 与 `:param` 归一后比较），无缺项、无多出项（F02 验收 1）
- [ ] 用例机械产出 21 行对照清单（每行一条 `METHOD /path` ↔ 对应子命令），可直接与 `oamp/API.md` §3 逐行核对（F02 验收 1）
- [ ] 层 B 双向比对：入口表的 `uds` 条目与 `oamp/src/router.js` 的 8 个 `dispatch` 分支方法名逐条对应，无缺项、无多出项（F03 验收 1）
- [ ] 层 C 双向比对：入口表的 `cli` 条目与 `oamp/src/cli.js` 的 `main(argv)` 分派展开后的 11 个叶子命令（`router start` / `agent start` / `status` / `task send|status|list|watch` / `web start` / `cluster up|down|status`）逐条对应，无缺项、无多出项（F04 验收 1）
- [ ] 分层可判定：每条入口的层归属 = 第一个 token（`api` / `uds` / `cli`），40 条逐条可判；`doctor` 单列为自检面、不进入 40 条分层判定（F14 验收 1/2，按 P-4 口径）
- [ ] 无同名同形：40 条入口之间不存在同名同形条目，跨层近名条目（如实例拓扑 / 任务清单 / 单任务终态三处样例）的层归属无歧义（F14 验收 2/4）
- [ ] 无编排条目：40 条逐条对应单一端点 / 单一方法 / 单一条既有命令；清单中不存在需要组合多步才能完成语义的条目（F14 验收 3、N5）
- [ ] 用例零依赖：只读上述四个既有/新增文件的文本与表结构，不起服务、不联网络、不写仓库内 `.runtime/` / `data/`（§10 T1）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T1 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F02-web-api-surface-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F03-router-uds-method-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F04-oamp-cli-command-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F14-layered-command-structure.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §5.1（三层全表 + 跨层无歧义三处样例）、§7 F02/F03/F04/F14 行、§10 T1
- 代码锚点：`oamp/API.md:157-186`（§3 的 21 行表格，行形态 `| n | \`METHOD /path\` | …`）、`oamp/src/router.js:109/161/186/201/348/379/384/395`（8 个 `dispatch` 分支）、`oamp/src/cli.js:59-133`（`main(argv)` 的 6 个顶层分支与 `validSubs` 列表）、`oamp/test/api-routes.test.js:250`（`shapePath` 归一手法，可参考其 `<...>` → `:` 归一）、`oamp/sdk/surface.js`（由 pr-003 新建，本用例的直接 import 对象）

## depends_on

- pr-003-sdk-entry-surface-cli-and-doctor.md（理由：用例 `import` pr-003 新建的 `oamp/sdk/surface.js` 导出的三层入口表符号，并以其为被核对对象——证据：`architecture.md` §4.1 N-3「表是 CLI 分派与库方法的单点定义」与 §7 F02 行「21 行对照清单（验收 1）的产出方式：`sdk/surface.js` 的层 A 表逐条导出，由 `test/sdk-surface.test.js` 与 `API.md` §3 解析结果双向比对」；三个对照面 `oamp/API.md` / `oamp/src/cli.js` / `oamp/src/router.js` 均为既有只读文件，不引入额外依赖）

## batch

4
