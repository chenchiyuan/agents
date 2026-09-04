#!/usr/bin/env bash
#
# 统一安装脚本：把 agents 框架 copy 进目标项目的 .pb-agents/ 下。
# agents 项目自身开发时和被安装到业务项目时，走同一套流程，无特殊分支。
#
# 只 copy 角色定义文件本身（<role>/<role>.md），不 copy 该角色的
# data/、memory.md ——这两者是角色在本项目运行时积累的记录，不随框架
# copy 部署（约定见 docs/memory-system.md §六）。
#
# 每次运行是幂等覆盖：先清空目标 roles/、principles/，再重新 copy，
# 保证 .pb-agents/ 内容始终等于当前 agents 源码，不会有旧文件残留。
#
# 用法:
#   tools/install-pb-agents.sh [目标项目路径]
#   不传参数时默认安装到当前 agents 仓库自身（. 下的 .pb-agents/）
#
# 用法示例（安装到业务项目）:
#   /path/to/agents/tools/install-pb-agents.sh /path/to/shipany-two

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
agents_root="$(cd "${script_dir}/.." && pwd)"

target_project="${1:-$(pwd)}"
target_project="$(cd "${target_project}" && pwd)"

target_pb_agents="${target_project}/.pb-agents"
target_roles="${target_pb_agents}/roles"
target_principles="${target_pb_agents}/principles"

echo "安装源: ${agents_root}"
echo "安装目标: ${target_pb_agents}"

rm -rf "${target_roles}" "${target_principles}"
mkdir -p "${target_roles}" "${target_principles}"

copied=0
for role_dir in "${agents_root}"/roles/*/; do
  role_name="$(basename "${role_dir}")"

  if [ "${role_name}" = "_template" ]; then
    continue
  fi

  role_file="${role_dir}${role_name}.md"
  if [ ! -f "${role_file}" ]; then
    echo "跳过 ${role_name}：未找到 ${role_name}.md" >&2
    continue
  fi

  mkdir -p "${target_roles}/${role_name}"
  cp "${role_file}" "${target_roles}/${role_name}/${role_name}.md"
  copied=$((copied + 1))
done

cp -R "${agents_root}/principles/." "${target_principles}/"

echo "已 copy ${copied} 个角色定义文件到 ${target_roles}"
echo "已 copy principles/ 到 ${target_principles}"
echo "安装完成"
