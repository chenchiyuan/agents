# PR-001: cdp-debug-skill scripts 确定性操作层

## 上下文摘要

交付 `roles/cdp-debug-skill/scripts/` 下 4 个可独立执行脚本（bash 3.2 兼容 + macOS 自带 `/usr/bin/python3` 做 JSON 解析，零新增依赖）：`check-deps.sh`（依赖检查，输出确定性 JSON facts，不做语义判断）、`chromium.sh`（CfT Stable 下载/就绪/manifest）、`cdp-browser.sh`（独立 Chromium 启停，端口默认 9222 可换 + 独立 profile）、`profile.sh`（profile 生命周期，wipe 需显式确认）。脚本层是 F05 的确定性操作落地，是 SKILL.md 前置 Gate（F10）与登录态链路（F09）的运行底座；脚本不依赖 SKILL.md/references，可被用户独立调用（F05 验收 1）。全部为新增文件、无既有文件修改；文件范围与 0008 并发迭代（`roles/workflow-pb/*`）零重叠。

## 涉及功能点

- F05

## 文件范围

- `roles/cdp-debug-skill/scripts/check-deps.sh`（新建）
- `roles/cdp-debug-skill/scripts/chromium.sh`（新建）
- `roles/cdp-debug-skill/scripts/cdp-browser.sh`（新建）
- `roles/cdp-debug-skill/scripts/profile.sh`（新建）

## 验收标准

- [ ] `roles/cdp-debug-skill/scripts/` 目录存在，4 个脚本均可执行；无参/子命令调用不依赖 SKILL.md 或 references 存在（F05 验收 1；D4）
- [ ] `check-deps.sh` 无参运行 exit 0，stdout 为合法 JSON，字段与 architecture.md D4 schema 一致（`checked_at` / `mcp.playwright{configured,scope,command,args,endpoint_arg}` / `mcp.chrome_devtools{…}` / `chromium{installed,version,path,running,port,profile_dir}` / `errors`）；解析三处配置源（`~/.claude.json` 顶层 `mcpServers`、`projects["<cwd>"].mcpServers`、`<cwd>/.mcp.json`），任一含 server 名即 `configured=true` 并报告 scope（F05 验收 2、6；D4/D7）
- [ ] `check-deps.sh` 自身执行错误时 exit≠0 且 JSON 含 `error` 字段——exit 0 仅表"执行成功"，与依赖是否齐备无关（D4）
- [ ] `chromium.sh` 支持 `ensure`/`install`/`verify`/`status`/`path` 子命令；`ensure` 幂等：本地已装版本 = CfT known-good Stable → 输出就绪事实不动作；版本不一致 → 输出 installed vs known-good facts 且不自动升级（需调用方 `-f` 显式强制）；zip 解包后以 glob 动态解析 `*.app/Contents/MacOS/*` 定位可执行文件，不写死 CfT mac zip 内部布局；下载后写 `$CDP_DEBUG_HOME/chromium/.manifest.json`（version/url/path/sha256/installed_at）（F05 验收 5；D2）
- [ ] `cdp-browser.sh` 支持 `start`/`stop`/`status`/`restart`；`start` 以 `--remote-debugging-port=<port 默认 9222>` + `--user-data-dir=<profile 路径>` 启动独立 Chromium；端口与 profile 可经参数或 env 覆盖；对已占用 profile 输出确定性 facts 不强启（profile 单实例锁）；`status` 支持 `--json`（F05 验收 3；D1/D3/D4）
- [ ] `profile.sh` 支持 `list`/`create`/`path`/`wipe`；`path <name>` 输出 user-data-dir 绝对路径供 cdp-browser.sh 消费（接口契约，D4）；默认 profile 名 `main`；`wipe` 需显式 `--confirm` 或交互确认才执行（破坏性安全兜底，D3）
- [ ] profile 落点默认 `$CDP_DEBUG_HOME/profiles/<name>`（`CDP_DEBUG_HOME` 默认 `$HOME/.local/share/cdp-debug-skill`，位于仓库外 git 外）；脚本不写入仓库内任何路径、不新增/修改仓库 `.gitignore`（F05 验收 4；D3——仓库 `git status` 无可观察新增）
- [ ] 4 个脚本内不出现对页面证据/结论/依赖可用性的语义判断（不输出"可用/缺失/请注册/通过/失败"类结论——F05 验收 6；协议检查项 #15；D4）

## 参考资料

- `docs/iterations/0009-cdp-debug-skill/architecture.md`：D1（cdp-browser 启停接口与端口/profile 契约）、D2（CfT Stable 渠道、ensure 幂等与版本策略、manifest 字段、glob 解析）、D3（CDP_DEBUG_HOME 布局、profile 默认 main、wipe 安全兜底）、D4（4 脚本接口契约与 check-deps JSON schema、调用方为 SKILL.md 前置 Gate）
- `docs/iterations/0009-cdp-debug-skill/prd/F05-scripts-resources.md`（主卡，6 条验收）
- `docs/iterations/0009-cdp-debug-skill/prd/F09-login-state-chain-cdp-chromium.md`、`F10-mcp-unconfigured-path.md`、`F13-safety-credential-protection.md`（本 PR 脚本为其机制组件的契约对齐点：启停事实源、check-deps facts、profile 不入 git 行为面——仅对齐接口，F 卡验收主体在 pr-002 文档层）
- `tools/install-pb-agents.sh`（E8 实证：只 copy `roles/<role>/<role>.md`，本目录无同名 `.md` → 天然不随分发）

## depends_on

（无）

## batch

1
