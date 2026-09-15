# pr-001：存量测试资产清零（F01）

## 上下文摘要

删除 `oamp/` 下全部存量测试资产，并移除四处失效承诺，**不引入任何替代机制**（无 CI、无 hook、无替代 script、无占位文件）。本 PR 只动四个路径：整目录删除 `oamp/test/**`（34 个受版本控制文件，含 `helpers/harness.js`、`helpers/fake-node.js`）、整文件删除 `oamp/scripts/testenv.mjs`（其 `:11` 是一行可执行 `import`，指向 `test/helpers/harness.js`，删 `oamp/test/` 后该脚本在 import 阶段即报错——Q18 按"是否产生功能破损"裁决删除，而非登记遗留）、移除 `oamp/package.json` 的 `scripts.test` 一个 key、删除 `oamp/README.md` 两处失效承诺（`:195` 漂移锁强制句、`:101-102` 自动化测试缩参句）。`oamp/src` / `oamp/web` / `oamp/bin` 三目录零改动；`oamp/src/cluster-config.js:19` 的注释类引用只登记、不处置（Q19），本 PR 对它零改动。

## 涉及功能点

- F01

## 文件范围

- `oamp/test/**`（整目录删除：34 个受版本控制的文件，含 `helpers/harness.js`、`helpers/fake-node.js` 与 32 个 `*.test.js`）
- `oamp/scripts/testenv.mjs`（整文件删除，Q18）
- `oamp/package.json`（移除 `scripts.test` 一个 key；`name` / `private` / `type` / `bin` / `engines` / `dependencies` 逐字不变）
- `oamp/README.md`（删除两处失效句：`:195` 整句、`:101-102` 整句；同段其余内容与 env 表零改动）

## 验收标准

- [ ] `oamp/test/` 目录不存在；`git ls-files oamp/test` 零命中（原 34 个文件全部消失，含 `helpers/harness.js`、`helpers/fake-node.js`）
- [ ] `oamp/package.json` 不含 `scripts.test` 这个 key（`grep -n '"test"' oamp/package.json` 零命中）；该文件其余字段逐字不变、`dependencies` 仍为空对象
- [ ] `oamp/README.md` 两处失效承诺零命中：`grep -n "由 \`npm test\` 强制" oamp/README.md` 与 `grep -n "自动化测试将 interval 缩到" oamp/README.md` 均无输出；同段的保留项在场且逐字不变（`重新生成索引快照` 命令行、`OAMP_CLUSTER_WAIT_MS` / `OAMP_TMUX_BIN` env 表行、"数值类 env 一律要求正整数…快速失败" 句）
- [ ] `oamp/scripts/testenv.mjs` 不存在（`ls oamp/scripts/testenv.mjs` 零命中；`git ls-files oamp/scripts` 只剩 `gen-llms-txt.mjs`）
- [ ] 未引入替代机制：本 PR 的 `git status` 无新增 CI 配置、git hook、替代 script（如 `test:legacy`）或 `oamp/test/` 占位文件
- [ ] `oamp/src`、`oamp/web`、`oamp/bin` 三目录零改动（`git diff --name-only` 无三目录下任何路径）
- [ ] 本 PR 的 `git diff --name-only` 只含 `oamp/package.json`、`oamp/README.md`、`oamp/scripts/testenv.mjs` 三个路径（`oamp/test/**` 为删除，以 `git status` 的 `D` 条目核）

## 参考资料

- `docs/iterations/0026-test-protocol-and-suite-reset/prd/F01-test-assets-zeroing.md`（验收 1~6）
- `docs/iterations/0026-test-protocol-and-suite-reset/architecture.md` §3.1 ①（清理组文件面）、§6.1 A（Q18：删 `testenv.mjs`）、§6.1 B（Q19：`cluster-config.js:19` 只登记不处置）
- 代码基线锚点（基线 `ea8943e` 的迭代分支，已一手核实）：`oamp/package.json:11-13`（`scripts.test` 所在 key，非台账所记 `:13`）、`oamp/README.md:101-102`、`oamp/README.md:195`、`oamp/scripts/testenv.mjs:3` / `:7` / `:11`（注释两处 + 可执行 `import` 一处）
- 只登记不处置的邻接事实：`oamp/src/cluster-config.js:19-20`（注释指向 `test/hygiene.test.js`；在验收 5 冻结面内，本 PR 零改动）

## depends_on

（无）

## batch

1
