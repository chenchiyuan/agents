#!/usr/bin/env bash
#
# 校验 roles/<role>/ 目录是否符合约定结构：
#   1. 目录本身存在
#   2. 目录下存在 <basename>.md 文件
#   3. 目录下存在 memory.md 文件
#   4. 目录下存在 data/ 子目录
#
# 用法: tools/check-role-structure.sh <role-dir-path>

set -u

role_dir="$1"

if [ ! -d "$role_dir" ]; then
  echo "FAIL: ${role_dir} 目录不存在"
  exit 1
fi

basename_dir="$(basename "$role_dir")"

missing=()

if [ ! -f "${role_dir}/${basename_dir}.md" ]; then
  missing+=("${basename_dir}.md")
fi

if [ ! -f "${role_dir}/memory.md" ]; then
  missing+=("memory.md")
fi

if [ ! -d "${role_dir}/data" ]; then
  missing+=("data/")
fi

if [ ${#missing[@]} -eq 0 ]; then
  echo "OK: ${role_dir} 符合约定结构"
  exit 0
else
  joined=$(IFS=,; echo "${missing[*]}")
  echo "FAIL: ${role_dir} 缺少: ${joined}"
  exit 1
fi
