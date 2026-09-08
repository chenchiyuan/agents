#!/usr/bin/env bash
#
# profile.sh — profile 生命周期管理（确定性操作层）
#
# 子命令：
#   list                列出全部已创建 profile 名（每行一个；空则无输出）
#   create [name]       创建 profile 目录（缺省 name=main；已存在不覆盖、不报错）
#   path   [name]       输出该 profile 的 user-data-dir 绝对路径（单行，供 cdp-browser.sh 消费）
#   wipe   [name]       删除 profile 目录（破坏性操作：需显式 --confirm 或交互确认才执行）
#
# profile 落点：$CDP_DEBUG_HOME/profiles/<name>
#   CDP_DEBUG_HOME 默认 $HOME/.local/share/cdp-debug-skill（仓库外 git 外），env 可覆盖
#
# 契约：
#   - name 合法字符集 [A-Za-z0-9][A-Za-z0-9._-]*（防路径穿越），非法视为用法错误 exit 2
#   - wipe 未确认 → 不执行任何删除，输出确定性事实（含确认途径），exit 1
#   - 确认途径：`wipe <name> --confirm`，或在交互终端下按提示输入 y
#   - 输出为人类可读事实/裸路径；不做依赖可用性语义判断
#
# 依赖：/bin/bash 3.2+（无 python3/jq 依赖）

set -u

usage() {
  cat <<'EOF'
用法: profile.sh <list|create|path|wipe> [name] [--confirm]

子命令:
  list              列出全部已创建 profile 名（每行一个）
  create [name]     创建 profile 目录（默认 name=main；已存在则原样保留）
  path   [name]     输出 user-data-dir 绝对路径（单行）
  wipe   [name]     删除 profile（默认 name=main；需 --confirm 或交互确认）

参数:
  name      profile 名，合法字符 [A-Za-z0-9][A-Za-z0-9._-]*，缺省 main
  --confirm wipe 的显式确认旗标（可置于 wipe 之后任意位置）

环境变量:
  CDP_DEBUG_HOME   数据根目录（默认 $HOME/.local/share/cdp-debug-skill）

退出码: 0 操作完成/事实报告；1 wipe 未确认或路径异常；2 用法错误
EOF
}

CDP_DEBUG_HOME="${CDP_DEBUG_HOME:-$HOME/.local/share/cdp-debug-skill}"

valid_name() {
  # name 合法字符集校验（防路径穿越/隐藏项）：非空、不以 . 开头、不含 /、
  # 且全部字符属于 [A-Za-z0-9._-]
  case "$1" in
    ''|.*|*/*)
      return 1
      ;;
  esac
  [ -z "${1//[A-Za-z0-9._-]/}" ]
}

cmd="${1:-}"
shift 2>/dev/null || true

case "$cmd" in
  '')
    usage >&2
    exit 2
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  list|create|path|wipe)
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

name=""
confirm=0

# 解析 [name] 与 --confirm（顺序不敏感；name 至多一个）
for arg in "$@"; do
  case "$arg" in
    --confirm|-f)
      confirm=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$name" ]; then
        usage >&2
        exit 2
      fi
      name="$arg"
      ;;
  esac
done

if [ -z "$name" ]; then
  name="main"
fi

if ! valid_name "$name"; then
  echo "profile.sh: 非法 profile 名 '$name'（允许字符: [A-Za-z0-9._-]，不能以 . 开头）" >&2
  exit 2
fi

profiles_root="$CDP_DEBUG_HOME/profiles"
profile_dir="$profiles_root/$name"

case "$cmd" in
  list)
    if [ -d "$profiles_root" ]; then
      # 只列目录名（排除隐藏项），按字典序，确定性
      for d in "$profiles_root"/*/; do
        [ -d "$d" ] || continue
        b="$(basename "$d")"
        case "$b" in
          .*) continue ;;
        esac
        printf '%s\n' "$b"
      done | sort
    fi
    exit 0
    ;;

  create)
    if [ ! -d "$profile_dir" ]; then
      mkdir -p "$profile_dir" || {
        echo "profile.sh: 创建目录异常: $profile_dir" >&2
        exit 1
      }
      existed=0
    else
      existed=1
    fi
    printf 'name: %s\n' "$name"
    printf 'path: %s\n' "$profile_dir"
    printf 'existed: %s\n' "$existed"
    exit 0
    ;;

  path)
    # 纯路径输出（一行，无其他 stdout）；目录是否存在不影响 path 语义
    printf '%s\n' "$profile_dir"
    exit 0
    ;;

  wipe)
    if [ "$confirm" -eq 0 ]; then
      # 交互兜底：仅当 stdin 为终端时提示确认
      if [ -t 0 ]; then
        printf '确认 wipe profile '%s'（%s）？输入 y 确认: ' "$name" "$profile_dir" >&2
        IFS= read -r answer
        case "$answer" in
          y|Y) confirm=1 ;;
        esac
      fi
    fi
    if [ "$confirm" -eq 0 ]; then
      printf 'name: %s\n' "$name"
      printf 'path: %s\n' "$profile_dir"
      printf 'removed: false\n'
      printf 'note: 未执行删除——wipe 需显式 --confirm（或交互输入 y）才执行\n'
      exit 1
    fi
    if [ ! -e "$profile_dir" ]; then
      printf 'name: %s\n' "$name"
      printf 'path: %s\n' "$profile_dir"
      printf 'removed: false\n'
      printf 'note: 目标不存在，无需删除\n'
      exit 0
    fi
    # 防御：确认目录确实位于 profiles_root 下（name 已过字符集校验，此处双保险）
    case "$profile_dir" in
      "$profiles_root"/*) ;;
      *)
        echo "profile.sh: 目标路径异常，拒绝删除: $profile_dir" >&2
        exit 1
        ;;
    esac
    rm -rf "$profile_dir" || {
      echo "profile.sh: 删除异常: $profile_dir" >&2
      exit 1
    }
    printf 'name: %s\n' "$name"
    printf 'path: %s\n' "$profile_dir"
    printf 'removed: true\n'
    exit 0
    ;;
esac
