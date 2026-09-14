# pr-001：L1 启动服务（`launcher.js` profile 表 + 唯一 argv 构造）与协议配置键（`config.js` 第 4 键）

## 上下文摘要

把「怎么起一个 agent 进程」从代码搬成数据：新建 `oamp/src/launcher.js`（进程内 profile 字面量表 + **唯一** argv 构造 + spawn 封装），键 = `(host, protocol/执行方式)`，`modeArgs` 承载 rpc / acp / oneshot 之间**唯一**的 argv 差异（M-3 实测：其余 flag 三者通用）；`oamp/src/config.js` 新增第 4 键 `protocol`（env `OAMP_PROTOCOL`，内置默认 `rpc`），**保持叶子模块**（零 `src/` 内 import）。本 PR 的 launcher **尚无消费方**（三实现归 pr-005、消费层接入归 pr-003），因此行为零变更、既有测试面除 `config-file.test.js` 外零改动。

## 涉及功能点

- F01
- F10
- F12
- F13

## 文件范围

- `oamp/src/launcher.js`（**新建**：`PROFILES` 进程内字面量表（键 = `(host, protocol/执行方式)`）+ `buildArgv(profileKey, {model, roleFile, tools, prompt})` 唯一 argv 构造 + spawn 封装；只 import `node:*`）
- `oamp/src/config.js`（**修改**：`loadConfig()` 返回值新增 `protocol` 键，优先级 `env.OAMP_PROTOCOL` > `config.json: protocol` > 内置 `'rpc'`；非法取值按既有体例抛 `OAMP 配置错误`；**叶子约束不变**（不 import `src/` 内任何模块）。检索式：`export function loadConfig`、`readStringField`、`contextMax`、`reconnectRaw`）
- `oamp/test/config-file.test.js`（**修改**：`无配置文件：新增三键取内置默认，既有六键取值逐字不变` 用例的全对象 `assert.deepEqual(config, {...})` 需补 `protocol` 键（该断言是全对象比对，新增键必然命中）；另加 `OAMP_PROTOCOL` / `config.json: protocol` 的优先级与非法取值断言。检索式：`assert.deepEqual(config, {`、`loadConfig`）

**零改动（防夹带；越界即 F10 / F13 验收不通过）**：`oamp/src/router.js`、`oamp/src/cluster-config.js`（`roles` 段不合并进 profile 表）、`oamp/src/cluster.js`、`oamp/src/status.js`、`oamp/src/task.js`、`oamp/src/web.js`、`oamp/API.md`、`oamp/llms.txt`、`oamp/package.json`、`omp/**`。

## 验收标准

- [ ] `oamp/src/launcher.js` 存在；其 import 集合 ⊆ `node:*`（零 `src/` 内 import、零第三方依赖）——逐条核对文件头 import；`oamp/package.json` 的 `dependencies` 仍为 `{}`（F12 验收 1/2）。
- [ ] profile 表含 `omp:rpc` / `omp:acp` / `omp:oneshot` 三项，并含 `claude:*` / `codex:*` **结构项**（仅结构与能力位，无真实接入链路、无实测证据）（F01 验收 4）；字段集与 architecture §5.2 逐项一致：`host / bin / modeArgs / input / session / skills / rules / tools{mode,list?} / approval{mode,appliesWhen} / thinking / model / roleFile / cwd`。
- [ ] **新增宿主 = 新增 profile 数据**（F01 验收 3）：向 `PROFILES` 增加一项（如 `claude:acp` 结构项）→ 不改 `oamp/src/launcher.js` 之外的任何源码即可由同一入口产出其 argv；判定 = `git diff --stat` 只含 `oamp/src/launcher.js`（本 PR 阶段的判定面；「协议层与消费层零改动」由 pr-005 / pr-003 在同一判据面上复核）。
- [ ] **`modeArgs` 是三份 profile 唯一的 argv 差异段**（D-R4）：`omp:rpc` = `['--mode','rpc']`、`omp:acp` = `['acp']`（**子命令**）、`omp:oneshot` = `['-p']`；其余 flag 段由同一份字段集推导（M-3 实测：非 mode 参数在 rpc 与 acp 两侧通用）。
- [ ] **`omp:rpc` 的 argv 不含 `--thinking`**（D-R3 / MI-A-4）：传 `off` 会使思考增量消失 ⇒ E3 直接失败，故 `thinking` 恒 `null`（不追加该 flag）。
- [ ] **工具与档位语义三条**（D-R5 / §5.2）：`tools.mode='off'` ⇒ 追加 `--no-tools`；`'allow'` ⇒ 不追加；`'list'` ⇒ `--tools=<csv>`（语义为白名单偏好，不承诺精确集合）；`approval.appliesWhen='tools-on'` ⇒ **仅当工具开**时追加 `--approval-mode <mode>`（`omp:acp` = `always-ask`、`omp:oneshot` = `yolo`，与既有 argv 逐字一致）；`'always'`（oneshot）⇒ 恒追加。
- [ ] **提示词承载方式两态**（§5.2 `input` / M-3 实测）：`input:'positional'`（`omp:oneshot`）⇒ 提示词是 argv **末位位置参数**；`input:'protocol'`（`omp:rpc` / `omp:acp`）⇒ 提示词**不出现在 argv**（RPC 面实测拒绝位置参数：`Error: @file arguments are not supported in RPC mode`，exit 1）。
- [ ] `bin` 解析链 = `env.OAMP_OMP_BIN` > `profile.bin` > `'omp'`（既有两个路径的 bin 注入面 `OAMP_OMP_BIN` 语义不变）。
- [ ] **`config.js` 第 4 键三档解析**：`loadConfig({OAMP_PROTOCOL:'acp'})` ⇒ `protocol === 'acp'`；`config.json` 含 `{"protocol":"acp"}` ⇒ `protocol === 'acp'`；两者皆缺 ⇒ `protocol === 'rpc'`；`OAMP_PROTOCOL='bogus'` ⇒ 抛 `OAMP 配置错误`（体例同既有 `OAMP_RECONNECT 仅支持 0/1` 的响亮失败）。
- [ ] `config.js` **仍是叶子模块**：文件头 import 只含 `node:*`，无任何 `./xxx.js`。
- [ ] **服务边界与配置面不扩大**（F10 验收 1/2 承载面）：`git diff --stat` 不含 `oamp/web.js`、不含监听地址 / 鉴权相关代码；新增的 `protocol` 是**进程内配置**（`config.json` + env），**不是**新 HTTP 接口 ⇒ `oamp/API.md` / `oamp/llms.txt` 零改动。
- [ ] **启动数据不与该文的 `instances[]` / 集群配置合并**（F13 验收 2）：`oamp/src/launcher.js` 内无 `cluster` / `instances` / `roles` 相关读取；`oamp/src/cluster-config.js` 零改动；两者可各自读到。
- [ ] 命令全绿且改动面封闭：`node --test oamp/test/config-file.test.js oamp/test/hygiene.test.js` 全绿；`git diff --stat` 只含本 PR 的三个文件（其余既有测试文件零改动——`oamp/test/*.test.js` 实测 **29** 个，扣除本 PR 修改的 `config-file.test.js` 后 **28** 个；`oamp/test/` 下 `.js` 共 31 个，另含 `helpers/harness.js`、`helpers/fake-node.js`）。

## 参考资料

- docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md（§3.3 L1 落点与判据、§4.2 L2-13（进程内字面量、不新增配置文件）、§5.2 profile 字段集、§5.3 解析链、§6 F01 / F10 / F12 / F13、§7 T-02、§9.1 B-1、§9.2 B-9、§9.3 零改动清单、§10 奥卡姆表、§12.1 MI-A-4 / MI-A-7）
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F01-agent-launcher-and-profile.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F10-service-boundary-unchanged.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F12-zero-third-party-dependency.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/prd/F13-no-oamp-router.md
- docs/iterations/0022-agent-launcher-and-protocol-layer/clarifications/probes/m3-output.txt（9 组 argv 矩阵：rpc/acp 非 mode 参数通用、`@file` 位置参数被拒、`--no-tools` 与 `--tools=list` 实测语义）
- 既有代码基线：`oamp/src/acp-client.js:137-144`（现有 acp argv 逐字形态，profile 表须能复现）、`oamp/src/agent.js:190-199`（现有 `-p` argv 逐字形态）、`oamp/src/config.js:8-26`（三键默认值常量，第 4 键并置）

## depends_on

（无）

## batch

1
