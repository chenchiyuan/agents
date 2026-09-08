#!/usr/bin/env bash
#
# check-deps.sh — 依赖检查（确定性操作层）
#
# 无参运行。stdout 恒为合法 JSON facts（schema 对齐 architecture.md D4）：
#   checked_at / mcp.playwright{configured,scope,command,args,endpoint_arg}
#   / mcp.chrome_devtools{...} / chromium{installed,version,path,running,port,profile_dir}
#   / errors
#
# 解析三处配置源（Claude Code MCP 配置）：
#   1. <cwd>/.mcp.json                       → scope: local
#   2. ~/.claude.json 的 projects["<cwd>"]   → scope: project
#   3. ~/.claude.json 顶层 mcpServers        → scope: user
# 同一 MCP 名多源命中时按上述顺序取首个命中源（local 遮蔽 project、project 遮蔽 user，
# 与 Claude Code 的作用域遮蔽语义一致）。命中判定 = server 名为该 MCP 的登记名，
# 或 command/args 中出现对应包名（@playwright/mcp / chrome-devtools-mcp）。
#
# 契约：
#   - exit 0 = 脚本执行成功（与依赖是否齐备无关）；依赖状态只经 JSON 事实字段表达
#   - errors[] 收集"配置源解析异常"（某源非法 JSON 记入并继续解析其余源，exit 仍 0）
#   - 脚本自身执行错误（python3 不可用/内部异常）→ exit≠0 且 JSON 含 error 字段
#   - 只给事实不给结论：不输出 可用/缺失/请注册/通过/失败 类语义判断
#
# 环境变量：CDP_DEBUG_HOME（chromium 安装面根目录，默认 $HOME/.local/share/cdp-debug-skill）
# 依赖：/bin/bash 3.2+、/usr/bin/python3（JSON 解析/生成）、ps（进程探测）
# 说明：chromium 段安装事实读 chromium.sh 维护的 manifest、运行事实来自进程探测
#（与 cdp-browser.sh 同一事实源；探测实现见下方 probe_debug_instances）

set -u

usage() {
  cat <<'EOF'
用法: check-deps.sh

无参运行，stdout 输出确定性 JSON facts（结构见 architecture.md D4 schema）。
支持 -h/--help 查看本帮助。其余参数视为用法错误（exit 2）。

输出契约:
  - exit 0 = 执行成功（与依赖是否齐备无关）
  - errors[] = 配置源解析异常（非法 JSON 等）
  - 自身执行错误 → exit≠0 且 JSON 含 error 字段

环境变量: CDP_DEBUG_HOME（默认 $HOME/.local/share/cdp-debug-skill）
EOF
}

case "${1:-}" in
  '')
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

CDP_DEBUG_HOME="${CDP_DEBUG_HOME:-$HOME/.local/share/cdp-debug-skill}"

# === 调试实例探测（与 cdp-browser.sh 中同名函数保持逐字一致：同一事实源，改动须同步两处） ===
# 确定性规则：进程 args 同时含 --remote-debugging-port=<n> 与 --user-data-dir=<dir>、
#            不含 --type=（排除子进程）、且可执行路径位于 $CDP_DEBUG_HOME/chromium/
#            下（CfT 安装面，排除本机 Google Chrome）。
# 输出：每行 <pid>\t<port>\t<user-data-dir>，按 pid 升序
probe_debug_instances() {
  local chromium_prefix
  chromium_prefix="${CDP_DEBUG_HOME}/chromium/"
  ps -axo pid=,args= 2>/dev/null | awk -v pfx="$chromium_prefix" '
    /--remote-debugging-port=[0-9]+/ && /--user-data-dir=/ && !/--type=/ && index($0, pfx) > 0 {
      line = $0
      if (match(line, /--user-data-dir=[^ ]+/)) {
        v = substr(line, RSTART, RLENGTH)
        sub(/^.*=/, "", v)
        dir = v
      } else { next }
      if (match(line, /--remote-debugging-port=[0-9]+/)) {
        v = substr(line, RSTART, RLENGTH)
        sub(/^.*=/, "", v)
        port = v
      } else { next }
      print $1 "\t" port "\t" dir
    }
  ' | sort -n -k1,1
}

# 受管运行实例（取 pid 最小者）→ 供 chromium.running/port/profile_dir 段
_probe_line="$(probe_debug_instances | head -1)"
_cdp_probe_pid=""
_cdp_probe_port=""
_cdp_probe_dir=""
if [ -n "$_probe_line" ]; then
  _cdp_probe_pid="$(printf '%s\n' "$_probe_line" | cut -f1)"
  _cdp_probe_port="$(printf '%s\n' "$_probe_line" | cut -f2)"
  _cdp_probe_dir="$(printf '%s\n' "$_probe_line" | cut -f3)"
fi

cwd_logical="$PWD"
cwd_physical="$(pwd -P 2>/dev/null || pwd)"
_py_out="$(CDP_PROBE_PID="${_cdp_probe_pid}" CDP_PROBE_PORT="${_cdp_probe_port}" CDP_PROBE_DIR="${_cdp_probe_dir}" /usr/bin/python3 - "$cwd_logical" "$cwd_physical" 2>/dev/null <<'PY'
import json
import os
import sys
import datetime

cwd_logical = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
cwd_physical = sys.argv[2] if len(sys.argv) > 2 else cwd_logical
home = os.environ.get("HOME", "")
cdp_home = os.environ.get("CDP_DEBUG_HOME", "")

claude_json = os.path.join(home, ".claude.json") if home else None
mcp_json = os.path.join(cwd_logical, ".mcp.json")

# 探测顺序即遮蔽顺序：local > project > user
sources = []
if mcp_json is not None:
    sources.append(("local", mcp_json, "file"))
if claude_json is not None:
    sources.append(("project", claude_json, "projects"))
    sources.append(("user", claude_json, "top"))

# @playwright/mcp 的端点参数与 chrome-devtools-mcp 的端点参数名不同（Form A 附着参数）
ENDPOINT_FLAGS = {
    "playwright": ("--cdp-endpoint",),
    "chrome_devtools": ("--browser-url", "-u"),
}
CDT_NAME_ALIASES = ("chrome-devtools", "chrome_devtools")


def mcp_identity(name, entry):
    """返回条目所属 MCP 标识：'playwright' | 'chrome_devtools' | None（确定性规则）。"""
    cmdtext = ""
    if isinstance(entry, dict):
        cmd = entry.get("command")
        args = entry.get("args")
        parts = []
        if isinstance(cmd, str):
            parts.append(cmd)
        if isinstance(args, list):
            parts.extend(str(a) for a in args if isinstance(a, str))
        cmdtext = " ".join(parts)
    elif isinstance(entry, str):
        cmdtext = entry
    if name == "playwright" or "@playwright/mcp" in cmdtext:
        return "playwright"
    if name in CDT_NAME_ALIASES or "chrome-devtools-mcp" in cmdtext:
        return "chrome_devtools"
    return None


def entry_fields(entry):
    """command/args 与配置原文逐值一致；形态防御：command 缺失或非串 → null，args 非数组 → []。"""
    if isinstance(entry, dict):
        cmd = entry.get("command")
        command = cmd if isinstance(cmd, str) else None
        args = entry.get("args")
        args = args if isinstance(args, list) else []
    elif isinstance(entry, str):
        command = None
        args = [entry]
    else:
        command = None
        args = []
    return command, args


def find_endpoint(which, command, args):
    """从 command/args 原文解析端点参数值；支持 --flag=value 与 --flag value 两种形态。"""
    toks = []
    if isinstance(command, str):
        toks.extend(command.split())
    toks.extend(a for a in args if isinstance(a, str))
    flags = ENDPOINT_FLAGS[which]
    i = 0
    n = len(toks)
    while i < n:
        t = toks[i]
        for f in flags:
            if t == f:
                if i + 1 < n:
                    return toks[i + 1]
            elif t.startswith(f + "="):
                return t[len(f) + 1:]
        i += 1
    return None


def load_source(path, selector):
    """返回 (servers_dict, error_or_None)。文件不存在 → (None, None)；非法 JSON → error 文案。"""
    if not os.path.isfile(path):
        return None, None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:
        return None, "{}: JSON 解析异常: {}".format(path, str(exc)[:200])
    if not isinstance(data, dict):
        return None, "{}: 顶层不是 JSON 对象".format(path)
    if selector == "top":
        servers = data.get("mcpServers")
    elif selector == "projects":
        proj = data.get("projects")
        if not isinstance(proj, dict):
            servers = None
        else:
            node = proj.get(cwd_physical)
            if not isinstance(node, dict):
                node = proj.get(cwd_logical)
            if not isinstance(node, dict):
                servers = None
            else:
                servers = node.get("mcpServers")
    else:  # "file": <cwd>/.mcp.json
        servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
    return servers, None


# ---- 汇总输出结构（含空态默认值） ----
out = {
    "checked_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "mcp": {
        "playwright": {"configured": False, "scope": None, "command": None, "args": [], "endpoint_arg": None},
        "chrome_devtools": {"configured": False, "scope": None, "command": None, "args": [], "endpoint_arg": None},
    },
    "chromium": {
        "installed": False, "version": None, "path": None,
        "running": False, "port": None, "profile_dir": None,
    },
    "errors": [],
}


def main():
    errors = out["errors"]
    bad_paths = set()
    # 每个 MCP 记录首个命中（多源按 sources 顺序遮蔽）
    hit = {}  # which -> (scope, command, args, endpoint_arg)

    for scope, path, selector in sources:
        if path is None or path in bad_paths:
            continue
        servers, err = load_source(path, selector)
        if err is not None:
            errors.append(err)
            bad_paths.add(path)
            continue
        if servers is None:
            continue  # 文件不存在（非异常，跳过该源）
        for name, entry in servers.items():
            if not isinstance(name, str):
                continue
            which = mcp_identity(name, entry)
            if which is None or which in hit:
                continue
            command, args = entry_fields(entry)
            hit[which] = (scope, command, args, find_endpoint(which, command, args))

    for which in ("playwright", "chrome_devtools"):
        slot = out["mcp"][which]
        rec = hit.get(which)
        if rec is None:
            continue
        slot["configured"] = True
        slot["scope"] = rec[0]
        slot["command"] = rec[1]
        slot["args"] = rec[2]
        slot["endpoint_arg"] = rec[3]

    # chromium 段：安装事实读 chromium.sh 维护的 manifest（同源规则：manifest 合法
    # 且 path 存在可执行 → installed）；运行事实来自进程探测（与 cdp-browser.sh
    # 共用同一探测实现 → 同一时刻值一致）
    chrom = out["chromium"]
    mpath = os.path.join(cdp_home, "chromium", ".manifest.json")
    mf = None
    if cdp_home and os.path.isfile(mpath):
        try:
            with open(mpath, "r", encoding="utf-8") as fh:
                mf = json.load(fh)
        except Exception:
            mf = None
    if isinstance(mf, dict):
        ver = mf.get("version")
        pth = mf.get("path")
        if (
            isinstance(ver, str) and ver
            and isinstance(pth, str) and pth
            and os.path.isfile(pth) and os.access(pth, os.X_OK)
        ):
            chrom["installed"] = True
            chrom["version"] = ver
            chrom["path"] = pth
    probe_pid = os.environ.get("CDP_PROBE_PID", "")
    if probe_pid:
        chrom["running"] = True
        probe_port = os.environ.get("CDP_PROBE_PORT", "")
        if probe_port.isdigit():
            chrom["port"] = int(probe_port)
        probe_dir = os.environ.get("CDP_PROBE_DIR", "")
        chrom["profile_dir"] = probe_dir if probe_dir else None

    print(json.dumps(out, ensure_ascii=False, indent=2))


try:
    main()
except SystemExit:
    raise
except Exception as exc:  # 自身执行错误：exit≠0 + JSON 含 error 字段
    out["error"] = "check-deps.sh 执行异常: {}".format(str(exc)[:300])
    print(json.dumps(out, ensure_ascii=False, indent=2))
    sys.exit(1)
PY
)"; _py_rc=$?

if [ "$_py_rc" -ne 0 ]; then
  # python3 子进程失败且未产出 JSON（或被替换为必然失败命令）：bash 侧兜底输出错误 JSON
  if [ -z "$_py_out" ]; then
    checked_at="$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '')"
    cat <<EOF
{
  "checked_at": "$checked_at",
  "mcp": {
    "playwright": { "configured": false, "scope": null, "command": null, "args": [], "endpoint_arg": null },
    "chrome_devtools": { "configured": false, "scope": null, "command": null, "args": [], "endpoint_arg": null }
  },
  "chromium": { "installed": false, "version": null, "path": null, "running": false, "port": null, "profile_dir": null },
  "errors": [],
  "error": "python3 处理异常（exit ${_py_rc}），无法完成 JSON 生成"
}
EOF
  else
    printf '%s\n' "$_py_out"
  fi
  exit "$_py_rc"
fi

printf '%s\n' "$_py_out"
exit 0
