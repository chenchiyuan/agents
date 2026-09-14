# pr-002：既有 harness 测试面按 L1 profile 显式化（协议注入固定为 `acp`）

## 上下文摘要

本迭代把常驻链路默认协议切成 rpc 后，**只改测试面**的准备工作：这些端到端测试的 fake omp 桩经 `OAMP_OMP_BIN` 注入，**只实现 ACP JSON-RPC**（桩源码按 `msg.method === 'initialize' / 'session/new' / 'session/prompt'` 分支，无 `-p` 时即 ACP 形态）；默认切 rpc 后它们会被以 `--mode rpc` 启动并永不回包 ⇒ 整组失败。本 PR 把「内置默认就是 acp」的隐式假设换成**显式注入**（`OAMP_PROTOCOL='acp'`），并把 argv 期望值的真源定到 `oamp/src/launcher.js` 的 `omp:acp` / `omp:oneshot` profile。生产源码零改动；在 pr-003 落地前，该注入是**惰性的**（取值不进入任何行为分支），故测试行为与今天逐字相同。

## 涉及功能点

- F03
- F06

## 文件范围

- `oamp/test/acp-daemon.test.js`（**修改**：① 全部 agent 启动点（文件内 `startAgent` / `startFlaggedAgent` 调用，检索式 `OAMP_OMP_BIN`、`envExtra`）注入 `OAMP_PROTOCOL: 'acp'`；② 用例 `E2E：角色实例 argv 注入 + 工具开关 + 匿名回归 + 一次性路径注入`（检索式 `anonArgv`、`devArgv`、`devOneShot`）的 argv 断言改为按 `omp:acp` / `omp:oneshot` profile 期望值）
- `oamp/test/context-pool.test.js`（**修改**：① 启动点注入同款 env（检索式 `OAMP_OMP_BIN`；含文件内 `setup()` 与第二个 agent 启动）；② 用例 `§6.6：daemon 启动参数含 acp 固定集…`（检索式 `argvs.find((a) => a[0] === 'acp')`）与 `F08/§9.1：一次性 executor=omp（-p）与 shell 路径不回归`（检索式 `argvs.some((a) => a.includes('-p')`）的 argv 断言按 profile 期望值）
- `oamp/test/project-workspace.test.js`（**修改**：① 启动点注入同款 env（检索式 `OAMP_OMP_BIN`、`startAgent(`）；② 用例 `F07：一次性路径每次注入（末位 argv 逐字）…`（检索式 `FAKE_ACP_ARGS_LOG`、argv 末位 = 项目块 + `\n\n` + 原文）的断言按 `omp:oneshot` profile 期望值）
- `oamp/test/call-protocol.test.js`（**修改**：agent 启动点注入同款 env（检索式 `agentEnv`、`OAMP_OMP_BIN`）；该文件的桩为 ACP 形态，且 `组 F` 断言 `call_update.kind ∈ {chunk, stdout, stderr}`（检索式 `['chunk', 'stdout', 'stderr'].includes`），故其绿依赖「常驻链路仍是 acp」这一前提被显式固定）

**零改动（防夹带）**：`oamp/src/**` 全部（本 PR 不含任何生产变更）；`oamp/test/helpers/**`（既有公共 harness 不改，注入走各文件既有的 `envExtra` / `env` 通道）；其余 30 个测试文件。

## 验收标准

- [ ] 上述 4 个文件的所有 agent 启动点均显式传入 `OAMP_PROTOCOL: 'acp'`（逐文件 `grep -n "OAMP_PROTOCOL" oamp/test/<file>` 命中且落点是 agent 启动 env）。
- [ ] argv 期望值不再写死「内置即 acp」：改为按 `launcher.js` 的 `PROFILES['omp:acp']` / `PROFILES['omp:oneshot']` 期望值（直接引用 profile 表，或与之一致的显式期望数组）断言；四条既有硬约束逐字保持：常驻 argv 首段 `acp`、工具开关与 `--no-tools` 同向、`--append-system-prompt <角色 md 绝对路径>`、档位 `--approval-mode` 在「常驻 tools on」= `always-ask` /「一次性」= `yolo`。
- [ ] 行流与终态语义零改动：一次性路径仍逐行回流、常驻路径仍以 ≥2 个过程增量先于终态（用例 `E-4 SSE——终态 message(out) 之前收到 ≥2 个 task_update` 保持绿）。
- [ ] **生产源码零改动**（F03 验收 4 的适用范围口径）：`git diff --stat` 只含上述 4 个测试文件。
- [ ] **注入在切换落地前为惰性**：`grep -rn "config\.protocol" oamp/src/{agent,context-pool,web}.js` 零命中，且 `grep -rn "=== 'acp'\|=== 'rpc'\|'oneshot'" oamp/src/{agent,context-pool,web}.js` 零命中 ⇒ 本 PR 合并本身不改变任何运行行为。
- [ ] 4 个文件单独与合并跑均全绿：`node --test oamp/test/acp-daemon.test.js oamp/test/context-pool.test.js oamp/test/project-workspace.test.js oamp/test/call-protocol.test.js`。
- [ ] 合并后全库既有面仍绿：`node --test oamp/test/*.test.js` 无非本 PR 引入的失败。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§9.4.1 B-11 / B-12 / B-14 / B-15（「按 profile 期望值断言」的最初口径）、§1.4 末行（测试面 argv 观测钩子）、§4.2 L2-13、§5.2 profile 字段集、§11 R2、§12.2-3）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F03-zero-intrusion-contract.md（验收 4）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F06-acp-adapter-preserved.md（验收 1）
- 依赖的桩源码与观测面（本 PR 不动，仅参照）：`oamp/test/acp-daemon.test.js` 的 `FAKE_ACP_SOURCE`（`msg.method` 分支 = ACP 形态）、`FAKE_ACP_ARGS_LOG` 观测面
- prs/pr-001-launcher-and-protocol-config.md（profile 表与 `OAMP_PROTOCOL` 键的真源）

## depends_on

- `pr-001-launcher-and-protocol-config.md`（理由：本 PR 的 argv 期望值真源 = pr-001 新建的 `oamp/src/launcher.js` 的 `PROFILES` 表；注入键 `OAMP_PROTOCOL` 由 pr-001 的 `oamp/src/config.js` 交付。两者均为代码级产出，非文档叙述顺序）

## batch

2
