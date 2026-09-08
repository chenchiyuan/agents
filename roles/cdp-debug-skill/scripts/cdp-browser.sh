#!/usr/bin/env bash
#
# cdp-browser.sh — 独立 Chromium（CDP 调试实例）启停（确定性操作层）
#
# 子命令：
#   start   启动调试实例：--remote-debugging-port=<port> + --user-data-dir=<profile 路径>
#           幂等：同一 profile 已有受管实例 → 输出事实不重复启动；
#           profile 被其他进程占用 → 输出确定性 facts 不强启
#   stop    停止受管调试实例（无 --port/--profile 时停止全部受管实例）
#   status  报告受管实例事实（默认人类可读；--json 机器可读，exit 0=事实报告）
#   restart 停止（同 stop 语义）后按解析规格重新启动
#
# 实例规格（start/stop/restart 目标）：
#   --port <n>     调试端口，默认 9222（env CDP_PORT 可覆盖，CLI 优先）
#   --profile <n>  profile 名，默认 main（env CDP_PROFILE 可覆盖，CLI 优先）
#   二进制来源：$CDP_DEBUG_HOME/chromium/.manifest.json 的 path（CfT 安装面，
#   由 chromium.sh 维护——非本机 Google Chrome）
#
# 契约：
#   - 探测 = 进程 args 含 --remote-debugging-port=<n> + --user-data-dir=<dir>、
#     不含 --type=（子进程）、可执行路径位于 $CDP_DEBUG_HOME/chromium/ 下；
#     与 check-deps.sh 共用同一实现（同一事实源，改动须同步两处）
#   - Chrome profile 单实例锁（D3）：同一 user-data-dir 同时仅一个浏览器进程
#   - 输出为事实/操作结果；不做依赖可用性语义判断（无 可用/缺失/请注册 类结论）
#
# 环境变量：CDP_DEBUG_HOME / CDP_PORT / CDP_PROFILE
# 依赖：/bin/bash 3.2+、/usr/bin/python3（status --json 输出）、ps、curl、kill

set -u

usage() {
  cat <<'EOF'
用法: cdp-browser.sh <start|stop|status|restart> [options]

子命令:
  start            启动调试实例（默认端口 9222、profile main）
  stop             停止受管调试实例（无规格时停止全部）
  status           报告受管实例事实（--json 输出 JSON）
  restart          停止后按规格重新启动

options:
  --port <n>       调试端口（默认 9222；env CDP_PORT，CLI 优先）
  --profile <name> profile 名（默认 main；env CDP_PROFILE，CLI 优先）
  --json           status 输出 JSON（仅 status 使用）
  -h, --help       本帮助

环境变量:
  CDP_DEBUG_HOME   数据根目录（默认 $HOME/.local/share/cdp-debug-skill）
  CDP_PORT         调试端口默认值
  CDP_PROFILE      profile 名默认值

退出码: 0 操作完成/事实报告；1 start 未产生受管实例（缺二进制/profile 被外部占用等）；
       2 用法错误
EOF
}

CDP_DEBUG_HOME="${CDP_DEBUG_HOME:-$HOME/.local/share/cdp-debug-skill}"
CHROMIUM_DIR="$CDP_DEBUG_HOME/chromium"
MANIFEST="$CHROMIUM_DIR/.manifest.json"
DEFAULT_PORT="${CDP_PORT:-9222}"
DEFAULT_PROFILE="${CDP_PROFILE:-main}"

valid_name() {
  case "$1" in
    ''|.*|*/)
      return 1
      ;;
  esac
  [ -z "${1//[A-Za-z0-9._-]/}" ]
}

# === 调试实例探测（与 check-deps.sh 中同名段保持逐字一致：同一事实源，改动须同步两处） ===
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

# 任一进程占用该 user-data-dir（token 级匹配，防 main/main2 误判）→ 0；否则 1
dir_in_use() {
  local dir="$1"
  ps -axo pid=,args= 2>/dev/null | awk -v d="$dir" '
    {
      key = "--user-data-dir=" d
      i = index($0, key)
      if (i > 0) {
        c = substr($0, i + length(key), 1)
        if (c == " " || c == "") { found = 1; exit }
      }
    }
    END { exit found ? 0 : 1 }
  '
}

resolve_manifest_binary() {
  # 从 chromium.sh 维护的 manifest 读取可执行文件绝对路径；就绪输出 0 并置 BINARY
  local out
  out="$(/usr/bin/python3 - "$MANIFEST" 2>/dev/null <<'PY'
import json
import os
import sys

p = sys.argv[1]
if not os.path.isfile(p):
    sys.exit(1)
try:
    with open(p, "r", encoding="utf-8") as fh:
        d = json.load(fh)
except Exception:
    sys.exit(1)
pa = d.get("path") if isinstance(d, dict) else None
if not isinstance(pa, str) or not pa or not os.path.isfile(pa) or not os.access(pa, os.X_OK):
    sys.exit(1)
print(pa)
PY
)"
  local rc=$?
  if [ "$rc" -ne 0 ] || [ -z "$out" ]; then
    return 1
  fi
  BINARY="$out"
  return 0
}

endpoint_reachable() {
  curl -fsS --max-time 2 "http://127.0.0.1:$1/json/version" >/dev/null 2>&1
}

emit_status_json() {
  # 环境变量 CDS_RUNNING/CDS_PID/CDS_PORT/CDS_DIR/CDS_ENDPOINT → JSON
  /usr/bin/python3 - <<'PY'
import json
import os


def g(k):
    v = os.environ.get(k)
    return None if v is None or v == "" else v


out = {
    "command": "status",
    "running": os.environ.get("CDS_RUNNING") == "1",
    "pid": g("CDS_PID"),
    "port": g("CDS_PORT"),
    "profile_dir": g("CDS_DIR"),
    "endpoint": g("CDS_ENDPOINT"),
}
if out["port"] is not None:
    try:
        out["port"] = int(out["port"])
    except ValueError:
        pass
print(json.dumps(out, ensure_ascii=False, indent=2))
PY
}

# ---- 解析命令与全局旗标 ----
CMD="${1:-}"
shift 2>/dev/null || true

case "$CMD" in
  '')
    usage >&2
    exit 2
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  start|stop|status|restart)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

port="$DEFAULT_PORT"
profile="$DEFAULT_PROFILE"
json_out=0

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      shift 2>/dev/null || { usage >&2; exit 2; }
      port="${1:-}"
      ;;
    --port=*)
      port="${1#--port=}"
      ;;
    --profile)
      shift 2>/dev/null || { usage >&2; exit 2; }
      profile="${1:-}"
      ;;
    --profile=*)
      profile="${1#--profile=}"
      ;;
    --json)
      json_out=1
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
  shift
done

case "$port" in
  ''|*[!0-9]*)
    echo "cdp-browser.sh: 非法端口 '$port'" >&2
    exit 2
    ;;
esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
  echo "cdp-browser.sh: 端口越界 '$port'" >&2
  exit 2
fi
if ! valid_name "$profile"; then
  echo "cdp-browser.sh: 非法 profile 名 '$profile'" >&2
  exit 2
fi
if [ "$CMD" != "status" ] && [ "$json_out" -eq 1 ]; then
  echo "cdp-browser.sh: --json 仅用于 status" >&2
  exit 2
fi

profile_dir="$CDP_DEBUG_HOME/profiles/$profile"
endpoint_url="http://127.0.0.1:${port}/json/version"

run_start() {
  # 1) 同 profile 已有受管实例 → 已在运行事实（不强启）
  local line pid run_port run_dir
  line="$(probe_debug_instances | awk -F '\t' -v d="$profile_dir" '$3 == d { print; exit }')"
  if [ -n "$line" ]; then
    pid="$(printf '%s\n' "$line" | cut -f1)"
    run_port="$(printf '%s\n' "$line" | cut -f2)"
    run_dir="$(printf '%s\n' "$line" | cut -f3)"
    printf 'started: %s\n' 'false'
    printf 'running: %s\n' 'true'
    printf 'pid: %s\n' "$pid"
    printf 'port: %s\n' "$run_port"
    printf 'profile: %s\n' "$profile"
    printf 'profile_dir: %s\n' "$run_dir"
    printf 'note: %s\n' '该 profile 已有受管实例在运行，未重复启动'
    return 0
  fi

  # 2) profile 被非受管进程占用 → 确定性 facts 不强启（profile 单实例锁，D3）
  if dir_in_use "$profile_dir"; then
    printf 'started: %s\n' 'false'
    printf 'running: %s\n' 'false'
    printf 'profile: %s\n' "$profile"
    printf 'profile_dir: %s\n' "$profile_dir"
    printf 'profile_in_use: %s\n' 'true'
    printf 'note: %s\n' '该 user-data-dir 已被其他进程占用，未启动'
    return 1
  fi

  # 3) 二进制就绪检查（manifest path）
  if ! resolve_manifest_binary; then
    printf 'started: %s\n' 'false'
    printf 'running: %s\n' 'false'
    printf 'port: %s\n' "$port"
    printf 'profile: %s\n' "$profile"
    printf 'profile_dir: %s\n' "$profile_dir"
    printf 'chromium_installed: %s\n' 'false'
    return 1
  fi

  # 4) 启动（幂等目录创建；nohup 脱离会话）
  mkdir -p "$profile_dir" 2>/dev/null || true
  nohup "$BINARY" --remote-debugging-port="$port" --user-data-dir="$profile_dir" \
    </dev/null >/dev/null 2>&1 &
  local pid="$!"

  # 5) 就绪轮询：端点可探通或进程退出（最多 20s）
  local reachable=0 alive=1 i
  for i in $(seq 1 20); do
    if endpoint_reachable "$port"; then
      reachable=1
      break
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      alive=0
      break
    fi
    sleep 1
  done

  if [ "$alive" -eq 0 ] || [ "$reachable" -eq 0 ]; then
    printf 'started: %s\n' 'false'
    printf 'pid: %s\n' "$pid"
    printf 'port: %s\n' "$port"
    printf 'profile: %s\n' "$profile"
    printf 'profile_dir: %s\n' "$profile_dir"
    printf 'reachable: %s\n' 'false'
    return 1
  fi
  printf 'started: %s\n' 'true'
  printf 'pid: %s\n' "$pid"
  printf 'port: %s\n' "$port"
  printf 'profile: %s\n' "$profile"
  printf 'profile_dir: %s\n' "$profile_dir"
  printf 'binary: %s\n' "$BINARY"
  printf 'endpoint: %s\n' "$endpoint_url"
  printf 'reachable: %s\n' 'true'
  return 0
}

run_stop() {
  # 停止受管实例：--port/--profile 给定时只停匹配者；否则停止全部
  local lines line pid
  if [ "$port" != "$DEFAULT_PORT" ] || [ "$profile" != "$DEFAULT_PROFILE" ]; then
    lines="$(probe_debug_instances | awk -F '\t' -v p="$port" -v d="$profile_dir" '$2 == p && $3 == d')"
  else
    lines="$(probe_debug_instances)"
  fi
  if [ -z "$lines" ]; then
    printf 'running: %s\n' 'false'
    printf 'stopped_pids: %s\n' ''
    return 0
  fi
  local pids=""
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    pid="$(printf '%s\n' "$line" | cut -f1)"
    pids="${pids}${pids:+ }${pid}"
    kill -TERM "$pid" 2>/dev/null || true
  done <<EOF
$lines
EOF
  # 等待退出（最多 10s），随后 SIGKILL 兜底
  local i allgone
  for i in $(seq 1 10); do
    allgone=1
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        allgone=0
      fi
    done
    [ "$allgone" -eq 1 ] && break
    sleep 1
  done
  if [ "$allgone" -ne 1 ]; then
    for pid in $pids; do
      kill -KILL "$pid" 2>/dev/null || true
    done
    sleep 1
  fi
  printf 'running: %s\n' 'false'
  printf 'stopped_pids: %s\n' "$pids"
  return 0
}

run_status() {
  local line pid run_port run_dir
  # 规格过滤：--port/--profile 显式给出时只报匹配实例；否则报 pid 最小者
  if [ "$port" != "$DEFAULT_PORT" ] || [ "$profile" != "$DEFAULT_PROFILE" ]; then
    line="$(probe_debug_instances | awk -F '\t' -v p="$port" -v d="$profile_dir" '$2 == p && $3 == d { print; exit }')"
  else
    line="$(probe_debug_instances | head -1)"
  fi

  if [ -z "$line" ]; then
    if [ "$json_out" -eq 1 ]; then
      CDS_RUNNING=0 emit_status_json
    else
      printf 'running: %s\n' 'false'
    fi
    return 0
  fi
  pid="$(printf '%s\n' "$line" | cut -f1)"
  run_port="$(printf '%s\n' "$line" | cut -f2)"
  run_dir="$(printf '%s\n' "$line" | cut -f3)"
  local ep="http://127.0.0.1:${run_port}/json/version"
  if [ "$json_out" -eq 1 ]; then
    CDS_RUNNING=1 CDS_PID="$pid" CDS_PORT="$run_port" CDS_DIR="$run_dir" CDS_ENDPOINT="$ep" emit_status_json
  else
    printf 'running: %s\n' 'true'
    printf 'pid: %s\n' "$pid"
    printf 'port: %s\n' "$run_port"
    printf 'profile_dir: %s\n' "$run_dir"
    printf 'endpoint: %s\n' "$ep"
  fi
  return 0
}

case "$CMD" in
  start)
    run_start
    exit $?
    ;;
  stop)
    run_stop
    exit $?
    ;;
  status)
    run_status
    exit $?
    ;;
  restart)
    run_stop
    run_start
    exit $?
    ;;
esac
