# 任务计划：跑通 dev 角色首个真实任务

**对应**: `docs/mvp-plan.md` 阶段 1
**状态**: 进行中

## 目标

用真实任务验证 `roles/dev/dev.md` 定义的角色能否被派发、能否产出符合边界的结果，并在 `roles/dev/data/` 留下第一条决策记录（如果有值得记的信息）。

## 任务

写一个校验脚本 `tools/check-role-structure.sh`：检查 `roles/<role>/` 目录是否符合约定结构（存在 `<role>.md`、`memory.md`、`data/`），不符合则报错并列出缺失项。

选它的理由：够小、够真实，且阶段 2（agent 构造器）本身就需要这个校验逻辑，不是玩具任务。

## 派发记录

- Task 1: `tools/check-role-structure.sh` + 测试 → 派给 dev 角色（见 `task-1-brief.md`）

## 状态

- [x] Task 1 派发
- [x] Task 1 验收（2026-09-01）：`tools/check-role-structure.sh` + `tests/test-check-role-structure.sh` 均通过人工复核，6/6 断言 PASS，未越界，未碰 `roles/dev/`
- [x] 决策记录回填判断：本次任务顺利完成无意外，按 `dev.md` 记录标准不写入 `roles/dev/data/`

## 验收结论

第一次真实任务闭环验证通过：
1. `roles/dev/dev.md` 定义的边界（不扩大范围、不碰简报外文件、边界外的事主动报告不擅自决定）在真实派发中生效
2. `roles/dev` 目录结构本身通过了它自己产出的校验脚本，`CLR-PD-002` 的目录约定得到真实验证
3. 遗留待办：多项缺失逗号拼接的用例未覆盖，非阻塞，留作后续可选补充

**下一步**：可以进入 `docs/mvp-plan.md` 阶段 2（从这次真实案例抽象 agent 构造器），或先补一条测试用例。
