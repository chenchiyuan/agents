#!/usr/bin/env bash
#
# chromium.sh — 独立 Chromium（Chrome for Testing）下载/就绪/校验（确定性操作层）
#
# 子命令：
#   ensure [-f]   幂等就绪：未安装 → 下载安装 known-good Stable；
#                 已装=known-good → 就绪事实不动作（不重新下载）；
#                 版本不一致 → 输出 installed vs known-good facts 不自动升级（-f 显式强制）
#   install [-f] 安装 known-good Stable（= ensure 强制版：版本不一致时直接安装）
#   verify       以磁盘事实核验 manifest 声明（exe 存在性/可执行位/sha256 重算比对）
#   status       输出当前安装事实（JSON；纯本地只读，离线可用）
#   path         输出可执行文件绝对路径（单行；未安装时无输出且 exit≠0）
#
# 数据源（D2）：CfT 官方 last-known-good-versions-with-downloads.json（channels.Stable）
#              + storage.googleapis.com HTTPS 下载 mac-arm64 分发包
# 落盘（D2/D3）：$CDP_DEBUG_HOME/chromium/<version>/ + .manifest.json
#   manifest 字段：version/url/path/sha256/installed_at（sha256 = 已装可执行文件哈希，
#   供 verify 事后完整性比对；CfT 官方端点无 sha256 字段，zip 下载校验信任 HTTPS）
# 解包：以 glob 动态解析 *.app/Contents/MacOS/* 定位可执行文件（不写死 zip 内部布局）
#
# 契约：
#   - ensure 幂等离线可用：已装版本在本地即可判定就绪（5.4），不强制联网
#   - 版本不一致属正常状态报告（exit 0，facts 由调用方决策 -f），非错误
#   - 自身执行错误（JSON 拉取/下载/解包/校验异常）→ exit≠0 + stdout 含 error 的 JSON
#   - 失败不产生半成品安装：不写 manifest、清理临时文件
#   - 只给事实不给结论；不输出 可用/缺失/请注册/通过/失败 类语义判断
#
# 环境变量：CDP_DEBUG_HOME（默认 $HOME/.local/share/cdp-debug-skill）
# 依赖：/bin/bash 3.2+、/usr/bin/python3（JSON）、curl、unzip、shasum（均系统自带）

set -u

KNOWN_GOOD_URL="https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json"
CFT_PLATFORM="mac-arm64"

CDP_DEBUG_HOME="${CDP_DEBUG_HOME:-$HOME/.local/share/cdp-debug-skill}"
CHROMIUM_DIR="$CDP_DEBUG_HOME/chromium"
MANIFEST="$CHROMIUM_DIR/.manifest.json"

# 清理钩子：失败/中断时移除本次残留（仅限 CDP_DEBUG_HOME 内路径）
_ZIP_TMP=""
_STAGE_TMP=""
cleanup() {
  if [ -n "$_ZIP_TMP" ] && [ -f "$_ZIP_TMP" ]; then rm -f "$_ZIP_TMP"; fi
  if [ -n "$_STAGE_TMP" ] && [ -d "$_STAGE_TMP" ]; then rm -rf "$_STAGE_TMP"; fi
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
用法: chromium.sh <ensure|install|verify|status|path> [-f|--force]

子命令:
  ensure [-f]   幂等就绪（未装则装；不一致时输出 facts，-f 强制升级）
  install [-f] 安装 CfT known-good Stable（= ensure 强制版）
  verify       磁盘核验 manifest 声明（exe 存在/可执行/sha256 比对）
  status       安装事实 JSON（纯本地只读，无需联网）
  path         输出可执行文件绝对路径（单行）

参数:
  -f, --force   ensure/install 在版本不一致时执行升级

环境变量:
  CDP_DEBUG_HOME   数据根目录（默认 $HOME/.local/share/cdp-debug-skill）

退出码: 0 操作完成/事实报告；1 自身执行错误（下载/解包/校验等）；2 用法错误
EOF
}

die() {
  # 自身执行错误：exit≠0 + stdout 含 error 的 JSON
  CDB_CMD="$CMD" CDB_ERROR="$1" /usr/bin/python3 - <<'PY'
import json
import os

out = {"command": os.environ.get("CDB_CMD", "")}
err = os.environ.get("CDB_ERROR", "")
if err:
    out["error"] = err
print(json.dumps(out, ensure_ascii=False, indent=2))
PY
  exit 1
}

read_manifest_facts() {
  # 输出制表符分隔: mode version url path sha256 installed_at exe_ok
  #   mode: ok=manifest 合法且完整 | invalid=非法 JSON | no=不存在
  #   exe_ok: 1=path 存在且可执行，否则空
  _MF_LINE="$(/usr/bin/python3 - "$MANIFEST" 2>/dev/null <<'PY'
import json
import os
import sys

p = sys.argv[1]
if not os.path.isfile(p):
    print("no\t\t\t\t\t")
    sys.exit(0)
try:
    with open(p, "r", encoding="utf-8") as fh:
        d = json.load(fh)
except Exception:
    print("invalid\t\t\t\t\t")
    sys.exit(0)
if not isinstance(d, dict):
    print("invalid\t\t\t\t\t")
    sys.exit(0)
v = d.get("version")
u = d.get("url")
pa = d.get("path")
s = d.get("sha256")
a = d.get("installed_at")
v = v if isinstance(v, str) else ""
u = u if isinstance(u, str) else ""
pa = pa if isinstance(pa, str) else ""
s = s if isinstance(s, str) else ""
a = a if isinstance(a, str) else ""
exe_ok = "1" if (pa and os.path.isfile(pa) and os.access(pa, os.X_OK)) else ""
print("ok\t" + "\t".join([v, u, pa, s, a, exe_ok]))
PY
)"
  local _rc=$?
  if [ "$_rc" -ne 0 ]; then
    return "$_rc"
  fi
  IFS=$'\t' read -r MF_MODE MF_VERSION MF_URL MF_PATH MF_SHA MF_AT MF_EXE_OK <<EOF
$_MF_LINE
EOF
  return 0
}

fetch_known_good() {
  # 成功：置 KG_VERSION/KG_URL；失败返回非零（网络/解析任一异常）
  local tmp kg_url
  tmp="$CHROMIUM_DIR/.tmp/known-good-$$.json"
  kg_url="${CDB_KNOWN_GOOD_URL:-$KNOWN_GOOD_URL}"
  mkdir -p "$CHROMIUM_DIR/.tmp" 2>/dev/null || return 1
  if ! curl -fsSL --max-time 20 "$kg_url" -o "$tmp" 2>/dev/null; then
    rm -f "$tmp"
    _KG_TMP=""
    return 1
  fi
  local out rc
  out="$(/usr/bin/python3 - "$tmp" 2>/dev/null <<'PY'
import json
import sys

d = json.load(open(sys.argv[1], "r", encoding="utf-8"))
ch = d.get("channels", {}).get("Stable", {})
version = ch.get("version")
url = None
for item in ch.get("downloads", {}).get("chrome", []):
    if item.get("platform") == "mac-arm64":
        url = item.get("url")
        break
if not version or not url:
    sys.exit(3)
print(version)
print(url)
PY
)"
  rc=$?
  rm -f "$tmp"
  _KG_TMP=""
  if [ "$rc" -ne 0 ]; then
    return 1
  fi
  KG_VERSION="$(printf '%s\n' "$out" | sed -n '1p')"
  KG_URL="$(printf '%s\n' "$out" | sed -n '2p')"
  [ -n "${KG_VERSION:-}" ] && [ -n "${KG_URL:-}" ] || return 1
  return 0
}

resolve_exe() {
  # 从构建根目录动态解析 *.app/Contents/MacOS/*（不写死 zip 内部布局），
  # 命中第一个可执行文件即输出其路径；无命中返回非零。
  # 覆盖 .app 位于根目录或一层子目录两种布局（CfT mac zip 为 <platform>/*.app）
  local root="$1" app e
  [ -d "$root" ] || return 1
  for app in "$root"/*.app "$root"/*/*.app; do
    [ -d "$app" ] || continue
    for e in "$app"/Contents/MacOS/*; do
      if [ -f "$e" ] && [ -x "$e" ]; then
        printf '%s\n' "$e"
        return 0
      fi
    done
  done
  return 1
}

write_manifest() {
  # $1 version $2 url $3 exe path $4 sha256 $5 installed_at
  /usr/bin/python3 - "$MANIFEST" "$1" "$2" "$3" "$4" "$5" <<'PY' || return 1
import json
import os
import sys

manifest = sys.argv[1]
obj = {
    "version": sys.argv[2],
    "url": sys.argv[3],
    "path": sys.argv[4],
    "sha256": sys.argv[5],
    "installed_at": sys.argv[6],
}
tmp = manifest + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(obj, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
os.replace(tmp, manifest)
PY
}

do_install() {
  # $1 version $2 url；目标目录已含完整构建则复用（不下载），否则下载解包。
  # 成功：置 INS_VERSION/INS_PATH/INS_SHA/INS_AT；失败 die（不产出半成品）
  local ver="$1" url="$2"
  local target_dir="$CHROMIUM_DIR/$ver"
  local exe sha at
  local zip stage

  exe="$(resolve_exe "$target_dir")" || exe=""

  if [ -z "$exe" ]; then
    # 下载 + 解包（全部落在 $CHROMIUM_DIR/.tmp 内，成功后才移入正式目录）
    mkdir -p "$CHROMIUM_DIR/.tmp" || die "临时目录创建异常: $CHROMIUM_DIR/.tmp"
    zip="$CHROMIUM_DIR/.tmp/chrome-$ver-$$.zip"
    stage="$CHROMIUM_DIR/.tmp/stage-$$"
    _ZIP_TMP="$zip"
    _STAGE_TMP="$stage"

    if ! curl -fsSL --max-time 600 -o "$zip" "$url"; then
      rm -f "$zip"
      _ZIP_TMP=""
      die "Chrome for Testing 下载异常（${ver}）"
    fi
    if ! unzip -q "$zip" -d "$stage"; then
      rm -f "$zip"
      _ZIP_TMP=""
      die "Chrome for Testing 解包异常（${ver}）"
    fi
    exe="$(resolve_exe "$stage")" || exe=""
    if [ -z "$exe" ]; then
      die "解包产物中未找到可执行文件（*.app/Contents/MacOS/*）"
    fi
    chmod +x "$exe" 2>/dev/null || true

    # 正式落位：chromium/<version>/（先清旧同名目录，再原子 mv）
    rm -rf "$target_dir"
    mkdir -p "$CHROMIUM_DIR"
    if ! mv "$stage" "$target_dir"; then
      die "构建落位异常: $target_dir"
    fi
    exe="$(resolve_exe "$target_dir")" || die "构建落位后可执行文件不可解析"
    rm -f "$zip"
    rm -rf "$stage"
    _ZIP_TMP=""
    _STAGE_TMP=""
  fi

  sha="$(shasum -a 256 "$exe" 2>/dev/null | awk '{print $1}')" || sha=""
  [ -n "$sha" ] || die "sha256 计算异常: $exe"
  at="$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" || at=""

  write_manifest "$ver" "$url" "$exe" "$sha" "$at" || die "manifest 写入异常: $MANIFEST"

  # 升级后清理旧版本目录（只清 chromium/ 下非当前版本、非隐藏项）
  local d b
  for d in "$CHROMIUM_DIR"/*/; do
    [ -d "$d" ] || continue
    b="$(basename "$d")"
    case "$b" in
      .*) continue ;;
    esac
    [ "$b" = "$ver" ] && continue
    rm -rf "$d"
  done

  INS_VERSION="$ver"
  INS_PATH="$exe"
  INS_SHA="$sha"
  INS_AT="$at"
  return 0
}

emit_result() {
  # 从 CDB_* 环境变量生成命令结果 JSON（每次调用单次 python，字段集按命令固定）
  /usr/bin/python3 - <<'PY'
import json
import os


def g(key):
    v = os.environ.get(key)
    return None if v is None or v == "" else v


def is1(key):
    return os.environ.get(key) == "1"


cmd = g("CDB_CMD")
out = {"command": cmd}
err = g("CDB_ERROR")
if err:
    out["error"] = err

if cmd in ("ensure", "install"):
    out["action"] = g("CDB_ACTION") or "noop"
    out["offline"] = is1("CDB_OFFLINE")
    if g("CDB_KG_VERSION") is not None:
        out["known_good"] = {"version": g("CDB_KG_VERSION"), "url": g("CDB_KG_URL")}
    else:
        out["known_good"] = None
    if is1("CDB_INSTALLED"):
        out["installed"] = {
            "version": g("CDB_INS_VERSION"),
            "path": g("CDB_INS_PATH"),
            "sha256": g("CDB_INS_SHA"),
            "installed_at": g("CDB_INS_AT"),
        }
    else:
        out["installed"] = None
    if g("CDB_PREV_VERSION") is not None:
        out["previous_version"] = g("CDB_PREV_VERSION")
elif cmd == "status":
    out["installed"] = is1("CDB_INSTALLED")
    out["version"] = g("CDB_INS_VERSION") if is1("CDB_INSTALLED") else None
    out["path"] = g("CDB_INS_PATH") if is1("CDB_INSTALLED") else None
    if g("CDB_MF_JSON") is not None:
        out["manifest"] = json.loads(g("CDB_MF_JSON"))
    else:
        out["manifest"] = None
elif cmd == "verify":
    out["installed"] = is1("CDB_INSTALLED")
    out["version"] = g("CDB_INS_VERSION")
    out["path"] = g("CDB_INS_PATH")
    out["exe_exists"] = is1("CDB_EXE_EXISTS") if g("CDB_EXE_EXISTS") is not None else None
    out["executable"] = is1("CDB_EXECUTABLE") if g("CDB_EXECUTABLE") is not None else None
    out["hash_matches"] = is1("CDB_HASH_MATCHES") if g("CDB_HASH_MATCHES") is not None else None
    if g("CDB_MF_JSON") is not None:
        out["manifest"] = json.loads(g("CDB_MF_JSON"))
    else:
        out["manifest"] = None
print(json.dumps(out, ensure_ascii=False, indent=2))
PY
}

manifest_json() {
  # 输出 manifest 原文 JSON 单行（用于 status/verify 的 manifest 字段）；无/非法则空
  /usr/bin/python3 - "$MANIFEST" 2>/dev/null <<'PY'
import json
import os
import sys

p = sys.argv[1]
if not os.path.isfile(p):
    sys.exit(0)
try:
    with open(p, "r", encoding="utf-8") as fh:
        d = json.load(fh)
except Exception:
    sys.exit(0)
if isinstance(d, dict):
    print(json.dumps(d, ensure_ascii=False))
PY
}

CMD="${1:-}"
shift 2>/dev/null || true

force=0
extra=""
for a in "$@"; do
  case "$a" in
    -f|--force)
      force=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      extra="$a"
      ;;
  esac
done

if [ -n "$extra" ]; then
  usage >&2
  exit 2
fi

case "$CMD" in
  '')
    usage >&2
    exit 2
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  ensure|install|verify|status|path)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if ! /usr/bin/python3 -c 'import json' >/dev/null 2>&1; then
  die "JSON 解析器（/usr/bin/python3）执行异常"
fi

case "$CMD" in
  status)
    read_manifest_facts || die "manifest 读取异常"
    mf="$(manifest_json)"
    if [ "$MF_MODE" = "ok" ] && [ "$MF_EXE_OK" = "1" ]; then
      CDB_CMD="$CMD" CDB_INSTALLED=1 CDB_INS_VERSION="$MF_VERSION" CDB_INS_PATH="$MF_PATH" \
        CDB_MF_JSON="$mf" emit_result
    else
      CDB_CMD="$CMD" CDB_INSTALLED=0 CDB_MF_JSON="$mf" emit_result
    fi
    exit 0
    ;;

  verify)
    read_manifest_facts || die "manifest 读取异常"
    mf="$(manifest_json)"
    if [ "$MF_MODE" != "ok" ]; then
      CDB_CMD="$CMD" CDB_INSTALLED=0 CDB_MF_JSON="$mf" emit_result
      exit 0
    fi
    exe_exists=0
    executable=0
    if [ -n "$MF_PATH" ] && [ -f "$MF_PATH" ]; then
      exe_exists=1
      if [ -x "$MF_PATH" ]; then
        executable=1
      fi
    fi
    hash_matches=""
    if [ "$exe_exists" = "1" ] && [ "$executable" = "1" ] && [ -n "$MF_SHA" ]; then
      cur="$(shasum -a 256 "$MF_PATH" 2>/dev/null | awk '{print $1}')"
      if [ "$cur" = "$MF_SHA" ]; then
        hash_matches=1
      else
        hash_matches=0
      fi
    fi
    installed=0
    if [ "$MF_MODE" = "ok" ] && [ "$exe_exists" = "1" ] && [ "$executable" = "1" ]; then
      installed=1
    fi
    CDB_CMD="$CMD" CDB_INSTALLED="$installed" CDB_INS_VERSION="$MF_VERSION" CDB_INS_PATH="$MF_PATH" \
      CDB_EXE_EXISTS="$exe_exists" CDB_EXECUTABLE="$executable" CDB_HASH_MATCHES="$hash_matches" \
      CDB_MF_JSON="$mf" emit_result
    exit 0
    ;;

  path)
    read_manifest_facts || exit 1
    if [ "$MF_MODE" = "ok" ] && [ "$MF_EXE_OK" = "1" ]; then
      printf '%s\n' "$MF_PATH"
      exit 0
    fi
    exit 1
    ;;

  ensure|install)
    read_manifest_facts || die "manifest 读取异常"
    if ! fetch_known_good; then
      # 离线路径（5.4）：已装即按本地 manifest 判定就绪；未装则无法安装
      if [ "$MF_MODE" = "ok" ] && [ "$MF_EXE_OK" = "1" ]; then
        CDB_CMD="$CMD" CDB_ACTION=noop CDB_OFFLINE=1 CDB_INSTALLED=1 \
          CDB_INS_VERSION="$MF_VERSION" CDB_INS_PATH="$MF_PATH" CDB_INS_SHA="$MF_SHA" CDB_INS_AT="$MF_AT" \
          emit_result
        exit 0
      fi
      die "CfT known-good 版本清单拉取异常（curl 无法获取官方版本清单）"
    fi

    installed_ok=0
    if [ "$MF_MODE" = "ok" ] && [ "$MF_EXE_OK" = "1" ]; then
      installed_ok=1
    fi

    if [ "$installed_ok" = "1" ] && [ "$MF_VERSION" = "$KG_VERSION" ]; then
      # 已装 = known-good：就绪事实，不动作（幂等；-f 也不重复下载）
      CDB_CMD="$CMD" CDB_ACTION=noop CDB_OFFLINE=0 CDB_INSTALLED=1 \
        CDB_INS_VERSION="$MF_VERSION" CDB_INS_PATH="$MF_PATH" CDB_INS_SHA="$MF_SHA" CDB_INS_AT="$MF_AT" \
        CDB_KG_VERSION="$KG_VERSION" CDB_KG_URL="$KG_URL" emit_result
      exit 0
    fi

    if [ "$installed_ok" = "1" ] && [ "$force" = "0" ] && [ "$CMD" = "ensure" ]; then
      # 版本不一致且未 -f：输出 facts，不自动升级（exit 0 = 正常状态报告）
      CDB_CMD="$CMD" CDB_ACTION=version_mismatch CDB_OFFLINE=0 CDB_INSTALLED=1 \
        CDB_INS_VERSION="$MF_VERSION" CDB_INS_PATH="$MF_PATH" CDB_INS_SHA="$MF_SHA" CDB_INS_AT="$MF_AT" \
        CDB_KG_VERSION="$KG_VERSION" CDB_KG_URL="$KG_URL" emit_result
      exit 0
    fi

    # 安装（fresh / ensure -f / install）
    prev=""
    if [ "$installed_ok" = "1" ]; then
      prev="$MF_VERSION"
    fi
    do_install "$KG_VERSION" "$KG_URL"
    if [ -n "$prev" ]; then
      CDB_CMD="$CMD" CDB_ACTION=installed CDB_OFFLINE=0 CDB_INSTALLED=1 \
        CDB_INS_VERSION="$INS_VERSION" CDB_INS_PATH="$INS_PATH" CDB_INS_SHA="$INS_SHA" CDB_INS_AT="$INS_AT" \
        CDB_KG_VERSION="$KG_VERSION" CDB_KG_URL="$KG_URL" CDB_PREV_VERSION="$prev" emit_result
    else
      CDB_CMD="$CMD" CDB_ACTION=installed CDB_OFFLINE=0 CDB_INSTALLED=1 \
        CDB_INS_VERSION="$INS_VERSION" CDB_INS_PATH="$INS_PATH" CDB_INS_SHA="$INS_SHA" CDB_INS_AT="$INS_AT" \
        CDB_KG_VERSION="$KG_VERSION" CDB_KG_URL="$KG_URL" emit_result
    fi
    exit 0
    ;;
esac
