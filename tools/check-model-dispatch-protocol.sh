#!/usr/bin/env bash
#
# 校验模型派发协议的项目内执行边界和本迭代路由声明。
#
# 用法:
#   tools/check-model-dispatch-protocol.sh <project-root> <iteration-id> [routing-declaration]
#
# 该校验器只验证迭代声明和工作树流程，不执行子 agent，也不证明运行时模型已启动。

set -u

fail() {
  echo "FAIL: $1"
  exit 1
}

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  fail "用法: $0 <project-root> <iteration-id> [routing-declaration]"
fi

project_root="$1"
iteration_id="$2"
routing_file="${3:-${project_root}/docs/iterations/${iteration_id}/agent-routing.yaml}"

[ -d "$project_root" ] || fail "项目根目录不存在: ${project_root}"
project_root="$(cd "$project_root" && pwd)"
project_id="$(basename "$project_root")"
expected_worktree="${project_root}/.pb-agents/worktrees/${project_id}-${iteration_id}"

current_worktree="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "当前目录不在 Git worktree 内"
current_worktree="$(cd "$current_worktree" && pwd)"

[ "$current_worktree" = "$expected_worktree" ] || fail "V-01 当前 worktree 必须为 ${expected_worktree}，实际为 ${current_worktree}"

branch="$(git branch --show-current)"
[ -n "$branch" ] || fail "V-02 当前 worktree 没有分支"
case "$branch" in
  main|master) fail "V-02 当前分支不得为 ${branch}" ;;
esac

worktree_list="$(git -C "$project_root" worktree list --porcelain 2>/dev/null)" || fail "V-03 无法读取项目 worktree 列表"
case "$worktree_list" in
  *"worktree ${expected_worktree}"*) ;;
  *) fail "V-03 worktree 列表未登记项目内路径 ${expected_worktree}" ;;
esac

[ -f "$routing_file" ] || fail "V-04 路由声明不存在: ${routing_file}"

has_valid_declaration() {
  awk -v expected_iteration="$iteration_id" '
    $0 == "version: 1" { version = 1 }
    $0 == "iteration: " expected_iteration { iteration = 1 }
    $0 == "main:" { section = "main" }
    $0 == "subagent:" { section = "subagent" }
    section == "main" && $0 == "  executor: omp" { main_executor = 1 }
    section == "main" && $0 == "  model: gpt" { main_model = 1 }
    section == "subagent" && $0 == "  role: dev" { subagent_role = 1 }
    section == "subagent" && $0 == "  executor: omp" { subagent_executor = 1 }
    section == "subagent" && $0 == "  model: deepseek" { subagent_model = 1 }
    END {
      exit !(version && iteration && main_executor && main_model &&
        subagent_role && subagent_executor && subagent_model)
    }
  ' "$routing_file"
}

has_valid_declaration || fail "V-04 路由声明结构或字段不符合协议: ${routing_file}"

while IFS= read -r line; do
  case "$line" in
    ''|'#'*) continue ;;
  esac
  normalized="$(printf '%s' "$line" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    *api_key*|*api-key*|*token*|*password*|*secret*|*endpoint*)
      fail "V-05 路由声明包含禁止的凭据或 provider 字段: ${routing_file}"
      ;;
  esac
done < "$routing_file"

for role_file in "$current_worktree"/roles/*/*.md; do
  [ -f "$role_file" ] || continue
  while IFS= read -r line; do
    case "$line" in
      model:*|' '*model:*|'  '*model:*)
        fail "V-06 role 能力文件不得包含 model 路由绑定: ${role_file}"
        ;;
    esac
  done < "$role_file"
done

echo "OK: ${iteration_id} 符合 model-dispatch-protocol V-01..V-07（仅验证声明与流程，不代表实际启动 DeepSeek）"
