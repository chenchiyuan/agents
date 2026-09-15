# pr-009：统一调用契约用例（F04/F05/F06/F07/F08/F09/F10/G01/G02）

## 上下文摘要

落 `test/sdk-cli-contract.test.js`：把四类退出码（0/1/2/3）、`--human` 两态、stdout/stderr 分离、`--wait` 超时（`WAIT_TIMEOUT`）、管道截断后无残留进程、层 C 与既有 CLI 逐字节一致、跨进程无状态一次性锁死。用例经 pr-004 的 `hub-harness.js` 起子进程，并须保证既有测试面零回归（不改既有断言）。

## 涉及功能点

- F04
- F05
- F06
- F07
- F08
- F09
- F10
- G01
- G02

## 文件范围

- `oamp/test/sdk-cli-contract.test.js`（新建：退出码四类 + `--human` + stdout/stderr 分离 + `--wait` 超时 + 管道截断 + 层 C 透传 + 无状态）

## 验收标准

- [ ] 退出码四类各一例且固定：成功 `0` / 上游业务失败 `1` / 本地用法错误 `2`（且未发出任何连接或请求）/ 连接失败 `3`；仅凭退出码（丢弃 stdout）即可区分四类（F07 验收 1~5、F08 验收 1/2）
- [ ] 用法错误样本覆盖：未知层 / 未知子命令 / 缺必填位置或选项 / 位置参数多余 / 选项取值非法（如 `--port abc`）/ 给该条目不接受的选项（`--wait` 给非阻塞条目、`--as` 给非身份方法）均落在 `2`（F07 验收 3、L2-4 / L2-10）
- [ ] `--human` 两态：同一命令加/不加开关，输出形态明显不同且承载事实逐项一致；不加开关时 stdout 仍是可 `JSON.parse` 的单个文档（F05 验收 1/2/3）
- [ ] stdout/stderr 分离：失败场景 stdout 为空或不含可解析残片，错误为 stderr 单行 JSON `{"code","error","exit_code"}`（层 A 另带 `http_status`）（F05 验收 1/4、§5.3）
- [ ] `--wait` 超时：对超过上限仍未完成的调用 → `WAIT_TIMEOUT` / 退出码 `1`，与上游业务失败**同码不同 `code`**、与连接失败（`3`）和用法错误（`2`）可区分；随后在**新进程**中用该次调用标识取回终态（background 形态，按 P-1 口径）（F10 验收 1~5）
- [ ] 管道截断：`hub api stream events --port <p> | head -1` → 命令自行退出、退出码 `0`；随后进程列表中无残留 hub 进程（F06 验收 3）
- [ ] 层 C 零语义变更：`hub cli status` 与直跑 `oamp status` 的 stdout / stderr / 退出码**逐字节一致**；另对至少一条启停类命令（如 `cluster status` 或 `agent start` 的用法面）做对照，现场变化与直跑一致（F04 验收 2/3、G02 验收 2，按 P-2 口径）
- [ ] 跨进程无状态：同一命令在两个互不相干的新进程中（并发执行）各自输出完整正确结果，互不覆盖；执行前后仓库内不新增状态文件（F09 验收 1/2/3、MI-03 观测口径）
- [ ] 既有测试面零回归：本用例不要求修改任何既有断言；`oamp/test/api-routes.test.js` 的两把漂移锁（`llms.txt` 逐字节快照、`API.md` ↔ 路由登记双向覆盖）与 `oamp/test/hygiene.test.js` 的凭据字段扫描保持通过（G01 验收 3/4）
- [ ] 用例经 pr-004 的 `oamp/test/helpers/hub-harness.js` 的 `runHub()` 起子进程；不写仓库内 `.runtime/` / `data/`（临时目录）（§10 T4）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T4 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F04-oamp-cli-command-coverage.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F05-json-output-and-human-flag.md`、`F06`、`F07`、`F08`、`F09`、`F10`、`G01`、`G02`（同目录 `prd/` 下的同名卡）
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §3.3（P-1 / P-2 / P-3 口径）、§5.1 层 C 全表、§5.3、§5.4、§7 F04/F05/F06/F07/F08/F09/F10/G02 行、§8 C7、§9.2 K5、§10 T4
- 代码锚点：`oamp/src/cli.js:30`（`usageError` → `2`）、`oamp/src/status.js`（Router 不可达 → `1`，层 C 不做重分类）、`oamp/test/api-routes.test.js:277/303`（两把漂移锁）、`oamp/test/cli.test.js`（既有 `src/cli.js` 分发表断言，不得被本 PR 改动）、`oamp/bin/oamp.js`（层 C 对照的另一侧）

## depends_on

- pr-004-sdk-dual-entry-and-hub-harness.md（理由：本用例全部经 pr-004 新建的 `oamp/bin/hub.js` 子进程入口执行，并 import pr-004 新建的 `oamp/test/helpers/hub-harness.js` 的 `runHub()`；层 C 对照的另一侧是既有 `oamp/bin/oamp.js` —— 证据：`architecture.md` §10 T4 的判据（`hub … | head -1`、`hub cli status` 与直跑 `oamp status` 逐字节比对）都以 pr-004 的 `bin/hub.js` 为被执行对象）

## batch

4
