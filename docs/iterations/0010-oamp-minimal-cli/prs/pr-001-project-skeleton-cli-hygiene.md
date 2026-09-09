# PR-001：工程骨架与 CLI 入口 + 卫生基线

## 上下文摘要

本 PR 建立 `oamp/` 零依赖 Node v22 ESM 工程的运行底座：package.json（type=module/bin/engines/scripts.test/零 dependencies）、bin/oamp.js（shebang 入口，仅转发 src/cli.js）、src/cli.js（手写 argv 分发与用法/报错文案，M-01）、src/config.js（env 默认值/读取/数值校验，§7.2 配置面——所有下游进程模块的叶子依赖）、.gitignore（`.runtime/` 一行，D14）与 README.md（D15 组织 + F08-3 红线声明）。同时交付两张可独立全绿的测试卡：test/cli.test.js（F01 误用/缺参/help/载体）与 test/hygiene.test.js（F08 静态卫生断言）。**实现约束（供阶段 5 planner/dev 遵守）**：cli.js 的 `router start`/`agent start`/`status` 分发分支不得静态 import 尚未落地的 router.js/agent.js/status.js——本 PR 独立可验收的前提是模块文件不存在时 cli.js 仍可加载执行错误路径，子命令行为按需延迟加载对应模块（该文件级引用是后续 PR 对 pr-001 的真实依赖边，见 depends_on）。

## 涉及功能点

- F01（验收 2/4/5/6 与入口/README 载体部分；验收 1/3/7/8 的最终可复现依赖后续 PR 合并后的整体状态，不在本 PR 独立验收）
- F08（hygiene.test.js 静态断言 + .gitignore + README 红线声明；验收 1 的 git 侧 check-ignore 留阶段 6 独立验证，见 architecture.md §9）

## 文件范围

- oamp/package.json
- oamp/bin/oamp.js
- oamp/src/cli.js
- oamp/src/config.js
- oamp/.gitignore
- oamp/README.md
- oamp/test/cli.test.js
- oamp/test/hygiene.test.js

## 验收标准

- [ ] `oamp/` 下执行 `node --test test/cli.test.js test/hygiene.test.js` 全绿（无需任何本 PR 之外的文件存在；cli.test 覆盖 §10.2 F01 范围：误用/缺参退出码与文案、--help、npm test 载体、零运行时依赖声明核查；hygiene.test 覆盖 §9：`.gitignore` 含 `.runtime/`、对 bin/src/package.json 凭据字段名扫描无命中）
- [ ] 行为抽查（§7.1 argv 表）：`node bin/oamp.js`（空）、未知/非法子命令 → stderr 打印可用子命令用法 + 明确报错，退出码 2，不挂起（M-01/F01-4）；`node bin/oamp.js agent start`（缺 instance-id）→ stderr 明确报错含 instance-id，退出码 2，不挂起（F01-5）；`node bin/oamp.js -h`/`--help` → stdout 用法，退出码 0
- [ ] 命令核查：`oamp/` 内无任何 YAML 配置文件参与运行（F01-6）；package.json 声明 type=module、bin `oamp:"./bin/oamp.js"`、engines.node>=22、scripts.test=`node --test test/`、dependencies 为空（F01-2）
- [ ] `oamp/.gitignore` 含 `.runtime/`；README.md 按 D15 组织（快速开始→E2 手测三步→参数表→协议速览→卫生红线声明），并声明两条红线（F08-3）

## 参考资料

- docs/iterations/0010-oamp-minimal-cli/prd/F01-cli-entry-subcommand-dispatch.md
- docs/iterations/0010-oamp-minimal-cli/prd/F08-hygiene-runtime-artifacts-credentials.md
- docs/iterations/0010-oamp-minimal-cli/architecture.md §3.2（文件树）、§7.1（分发表）、§7.2（配置面）、§9（卫生）、D1/D14/D15/D16
- docs/iterations/0010-oamp-minimal-cli/prd.md（M-01/M-02/M-03 确认记录）

## depends_on

（无）

## batch

1
