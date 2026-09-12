#!/usr/bin/env bash
#
# 纯 bash 断言测试：tools/check-model-dispatch-protocol.sh
#
# 用法: tests/test-check-model-dispatch-protocol.sh

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
check_script="${repo_root}/tools/check-model-dispatch-protocol.sh"
project_root="$(git -C "$repo_root" worktree list --porcelain | awk 'NR == 1 && $1 == "worktree" { print $2; exit }')"
iteration_id="0004-model-dispatch"
routing_file="${repo_root}/docs/iterations/${iteration_id}/agent-routing.yaml"

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

assert_contains() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  case "$actual" in
    *"$expected"*)
      echo "PASS: ${desc}"
      pass_count=$((pass_count + 1))
      ;;
    *)
      echo "FAIL: ${desc}"
      echo "  期望包含: ${expected}"
      echo "  实际: ${actual}"
      fail_count=$((fail_count + 1))
      ;;
  esac
}

output_1="$($check_script "$project_root" "$iteration_id" "$routing_file" 2>&1)"
exit_1=$?
assert_eq "合法项目内 worktree 与路由声明通过" "0" "$exit_1"
assert_contains "合法场景输出协议通过" "OK: ${iteration_id}" "$output_1"

main_root="$project_root"
output_2="$(cd "$main_root" && "$check_script" "$project_root" "$iteration_id" "$routing_file" 2>&1)"
exit_2=$?
assert_eq "主分支目录阻止协议校验" "1" "$exit_2"
assert_contains "主分支目录报告 V-01" "V-01" "$output_2"

tmp_dir="$(mktemp -d)"
invalid_file="${tmp_dir}/agent-routing.yaml"
printf '%s\n' \
  'version: 1' \
  'iteration: 0004-model-dispatch' \
  'main:' \
  '  executor: omp' \
  '  model: gpt' \
  'subagent:' \
  '  role: dev' \
  '  executor: omp' \
  '  model: deepseek' \
  '  token: forbidden' > "$invalid_file"
output_3="$($check_script "$project_root" "$iteration_id" "$invalid_file" 2>&1)"
exit_3=$?
assert_eq "含凭据字段的路由声明被阻止" "1" "$exit_3"
assert_contains "非法凭据字段报告 V-05" "V-05" "$output_3"

probe_role_dir="${repo_root}/roles/_protocol-test"
mkdir -p "$probe_role_dir"
printf '%s\n' '# protocol test role' 'model: forbidden' > "${probe_role_dir}/probe.md"
output_4="$($check_script "$project_root" "$iteration_id" "$routing_file" 2>&1)"
exit_4=$?
assert_eq "role 能力文件中的模型绑定被阻止" "1" "$exit_4"
assert_contains "role 模型绑定报告 V-06" "V-06" "$output_4"
rm -rf "$probe_role_dir"
rm -rf "$tmp_dir"

echo ""
echo "通过: ${pass_count}, 失败: ${fail_count}"

if [ "$fail_count" -eq 0 ]; then
  exit 0
else
  exit 1
fi
