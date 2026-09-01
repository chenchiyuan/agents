# Task brief: check-role-structure

## 任务目标

在 agents 项目里写一个 shell 脚本，校验 `roles/<role>/` 目录是否符合约定结构。这是 agent 构造器（未来阶段）复用的基础校验逻辑，也是验证 `roles/dev` 骨架本身是否合规的工具。

## 需求（精确值，逐字写死）

- 脚本路径：`tools/check-role-structure.sh`
- 用法：`tools/check-role-structure.sh <role-dir-path>`，例如 `tools/check-role-structure.sh roles/dev`
- 校验规则：给定的目录必须同时满足：
  1. 目录本身存在
  2. 目录下存在一个 `<basename>.md` 文件（basename 等于目录名，例如 `roles/dev` 下必须有 `dev.md`）
  3. 目录下存在 `memory.md` 文件
  4. 目录下存在 `data/` 子目录（存在即可，不要求非空）
- 全部满足：脚本以 exit code 0 退出，输出 `OK: <role-dir-path> 符合约定结构`
- 缺失任意一项：脚本以 exit code 1 退出，输出 `FAIL: <role-dir-path> 缺少: <逐项列出缺失的文件/目录名>`（多项缺失用逗号分隔）
- 目录本身不存在：输出 `FAIL: <role-dir-path> 目录不存在`，exit code 1
- 不需要处理除以上四项之外的任何校验（不检查文件内容、不检查 frontmatter 格式）

## 测试与验收

- 没有现成测试文件，你需要自己写一个可运行的验证方式：在 `tests/test-check-role-structure.sh` 里写测试用例，覆盖：
  1. 正常情况：`roles/dev` 本身应该校验通过（exit 0）
  2. 异常情况：构造一个临时目录，故意缺 `memory.md`，校验应该失败并报出缺失项
  3. 异常情况：传入一个不存在的路径，应该报"目录不存在"
- 测试脚本本身跑起来后，三个用例都要通过，作为你自己的验收依据
- 项目目前没有已有的测试框架，用纯 bash 断言即可，不要引入新的测试框架依赖

## 必读 reference

1. `roles/dev/dev.md` — 你自己的角色定义和边界
2. `principles/execution/core-principles.md` — 执行原则

## 涉及文件

- 新建：`tools/check-role-structure.sh`
- 新建：`tests/test-check-role-structure.sh`
- 不改动任何其他文件

## 边界 / 禁止

- 不要修改 `roles/dev/` 下的任何文件
- 不要引入 bash 之外的运行时依赖
- 如果发现 `roles/dev` 现有结构本身不符合你写的校验规则，不要为了让测试通过去改校验规则放水——如实报告这个矛盾

## 报告契约（回报这四件事）

1. 改了什么文件
2. 测试结果（三个用例分别是否通过）
3. 疑问/待办
4. 违反边界的事（若有）
