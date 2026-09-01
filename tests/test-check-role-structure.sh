#!/usr/bin/env bash
#
# 纯 bash 断言测试：tools/check-role-structure.sh
#
# 用法: tests/test-check-role-structure.sh
# 需要在仓库根目录下运行（脚本内部会 cd 到仓库根目录）。

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
check_script="${repo_root}/tools/check-role-structure.sh"

pass_count=0
fail_count=0

assert_eq() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [ "$expected" = "$actual" ]; then
    echo "PASS: ${desc}"
    pass_count=$((pass_count + 1))
  else
    echo "FAIL: ${desc}"
    echo "  期望: ${expected}"
    echo "  实际: ${actual}"
    fail_count=$((fail_count + 1))
  fi
}

# --- 用例 1: roles/dev 本身应该校验通过 ---
output_1="$("$check_script" "${repo_root}/roles/dev" 2>&1)"
exit_1=$?

assert_eq "用例1 exit code" "0" "$exit_1"
assert_eq "用例1 输出" "OK: ${repo_root}/roles/dev 符合约定结构" "$output_1"

# --- 用例 2: 临时目录缺 memory.md，应该失败并报出缺失项 ---
tmp_dir="$(mktemp -d)"
tmp_role_dir="${tmp_dir}/fakerole"
mkdir -p "${tmp_role_dir}/data"
touch "${tmp_role_dir}/fakerole.md"
# 故意不创建 memory.md

output_2="$("$check_script" "$tmp_role_dir" 2>&1)"
exit_2=$?

assert_eq "用例2 exit code" "1" "$exit_2"
assert_eq "用例2 输出" "FAIL: ${tmp_role_dir} 缺少: memory.md" "$output_2"

rm -rf "$tmp_dir"

# --- 用例 3: 传入不存在的路径，应该报"目录不存在" ---
nonexistent_dir="${tmp_dir}/does-not-exist"

output_3="$("$check_script" "$nonexistent_dir" 2>&1)"
exit_3=$?

assert_eq "用例3 exit code" "1" "$exit_3"
assert_eq "用例3 输出" "FAIL: ${nonexistent_dir} 目录不存在" "$output_3"

echo ""
echo "通过: ${pass_count}, 失败: ${fail_count}"

if [ "$fail_count" -eq 0 ]; then
  exit 0
else
  exit 1
fi
