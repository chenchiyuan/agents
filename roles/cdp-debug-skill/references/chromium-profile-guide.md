# Chromium / Profile / 端口指南（$CDP_DEBUG_HOME）

登录态链路数据根目录与实例管理指南（SKILL.md Workflow 步骤 2/3 与 Safety 引用本文）。命令示例中 `scripts/` 均相对 `roles/cdp-debug-skill/` 目录；所有脚本子命令/参数/env 与 `scripts/` 实际 usage 一致。

## 1. $CDP_DEBUG_HOME 布局（默认 git 外）

```
${CDP_DEBUG_HOME:-$HOME/.local/share/cdp-debug-skill}/
├── chromium/                 # CfT 二进制与 manifest（chromium.sh 管理）
│   ├── <version>/            # 解包后的构建（动态 glob 解析 *.app/Contents/MacOS/* 定位可执行文件）
│   └── .manifest.json        # version/url/path/sha256/installed_at
├── profiles/<name>/          # 每 profile 一个 Chromium user-data-dir（默认名 main）
└── runs/                     # 登录态/含凭据证据默认落点（git 外）
```

- 默认根目录位于仓库外（`$HOME/.local/share/…`）→ profile 目录与 `runs/` 证据**天然不落入 agents 仓库 git 跟踪**。
- 根目录可经 env `CDP_DEBUG_HOME` 覆盖。
- **gitignore 明示句**：若经 `CDP_DEBUG_HOME` 覆盖到仓库内路径，须用户**自行**在仓库 `.gitignore` 追加（skill 不代改仓库 `.gitignore`）。

## 2. profile 管理（profile.sh）

| 操作 | 命令 | 说明 |
|---|---|---|
| 列出 | `scripts/profile.sh list` | 已创建 profile 名（每行一个） |
| 创建 | `scripts/profile.sh create [name]` | 默认名 `main`；已存在则原样保留 |
| 取路径 | `scripts/profile.sh path [name]` | 输出 user-data-dir **绝对路径**（单行），供 cdp-browser 消费 |
| 删除 | `scripts/profile.sh wipe [name]` | **破坏性操作**，需 `--confirm` 或交互确认才执行 |

- profile 名合法字符 `[A-Za-z0-9][A-Za-z0-9._-]*`，缺省 `main`。
- env 覆盖示例：`CDP_DEBUG_HOME=/tmp/cdp-home scripts/profile.sh path myp`。
- **单实例锁**：同一 profile 同一时刻仅一个浏览器进程可用（Chrome profile 单实例锁）；对已占用 profile 的 `start` 输出确定性事实、不强启。

## 3. 端口与实例（cdp-browser.sh）

- **默认端口 9222**；`--port <n>` / env `CDP_PORT` 可换（端口冲突可换——C-6）；`--profile <name>` / env `CDP_PROFILE` 选 profile（CLI 参数优先于 env）。
- 实例启动形态 = `--remote-debugging-port=<port>` + `--user-data-dir=<profile 路径>`（profile 路径由 `profile.sh path` 提供）。
- 子命令：`start` / `stop` / `status` / `restart`；`status` 支持 `--json`（字段 `command/running/pid/port/profile_dir/endpoint`）。
- **端口一致性（Form A）**：端口在 MCP 注册前定好，两个 MCP 端点参数（`--cdp-endpoint`/`--browser-url`）与浏览器实际端口必须一致——见 `mcp-registration.md` 第 3 节；注册后换端口需同步改注册（`claude mcp add` 重跑）并重启宿主会话。

## 4. 脱敏与隐私选项

以下为 chrome-devtools-mcp **注册参数**（`mcp-registration.md` 第 6 节参数表），语义与 SKILL.md Safety 三层防线对应：

| 参数 | 作用 |
|---|---|
| `--redact-network-headers` | 返回前脱敏敏感请求头（Safety 三层防线①） |
| `--no-usage-statistics` | 关闭官方使用统计（隐私可选） |
| `--memory-debugging` | 开启内存取证工具（heap snapshot 族）；内存取证须显式开启 |
| `--no-performance-crux`（可选） | 关闭性能 trace 的 CrUX field data（不强推） |

## 5. 登录态证据默认落点与不入 git 规则

- **profile 不入 git**：默认 `$CDP_DEBUG_HOME` git 外即满足可观察判定（git status/ignore 核对口径）。
- **登录态证据默认落 `$CDP_DEBUG_HOME/runs/<run-id>/`**（git 外），不入 git 视野；run-id 命名示例 `20260908-153000-cart`（示例性，非强制 schema）。
- 入库前经 SKILL.md Safety 脱敏复核（`result.json#sanitized=true`）后才允许复制到入库路径（如 `docs/iterations/<迭代ID>/cdp/`）。
