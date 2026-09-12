# 工作区间与生效规范（worktrees）

**状态**: 生效
**版本**: 1.0.0
**日期**: 2026-09-12
**演进自**: `docs/iterations/0020-session-workspace-addressing/architecture.md`

## 1. 工作区间（本项目）

| 层 | 落点 | 命名 | 生命周期 | 跟踪 |
|---|---|---|---|---|
| 会话 / 迭代工作区（父层） | `<仓库主工作区>/.pb-agents/worktrees/` | `{迭代ID}` | 阶段 1~6 全程 | 被 `.gitignore` 忽略 |
| PR worktree（子层） | `<会话工作区>/.pb-agents/worktrees/` | `{迭代编号}-pr-{NNN}-{slug}` | 单个 PR 的生命周期 | 被 `.gitignore` 忽略 |

**工作区的范围**：属某个工作区的路径 = 该工作区目录下的全部路径（含其内的 `.pb-agents/worktrees/` 子层）；
跨工作区共享、不属任何工作区的资源 = 仓库级 refs / 对象库 / config / hooks / remotes，以及非 git 共享资源
（默认端口、CPU 与负载、`/tmp`、进程内作业注册表）——其声明与约束见规范 §隔离边界声明（本节不重述）。

## 2. 生效规范与版本

- 规范：`roles/workflow-pb/workflow-pb.md`（v0.10.0）
- 配套宿主 skill：`.claude/skills/workflow-pb/SKILL.md`（v1.13.0）

## 3. 寻址纪律（引用规范，不重述）

- 显式寻址（绝对路径 + `git -C <地址>`）与"不依赖工具"：见规范 §规则 H。
- 启动与寻址契约（工作区地址的解析与建立、唯一硬停面）：见规范 §规则 D。
- 地址声明的三层分工与"不一致以本节（源）为准"：见规范 §协议产物。
- 越界写入的判定是**事后核查**（不可能被 git 强制）：见规范 §规则 F 与 §隔离边界声明。

## 4. 落点语义澄清

`docs/worktrees/` = 协议文档位（被跟踪，不承载任何运行态工作区）；`.pb-agents/worktrees/` = 会话 / PR 工作区池（运行态，被忽略）；
`docs/iterations/{迭代ID}/` = 迭代产物（每迭代一份，不承载跨迭代的协议声明）。三者互不替代；任何会话 / PR worktree 不得建在 `docs/worktrees/` 下。（真源：规范 §协议产物）

## 5. 本产物的边界

本产物不含任何脚本、钩子或守卫，也不含可复制的命令块。
本产物不是规范的第二真源——上文的规范性陈述均以指向规范条款的引用形态出现（规范 = `roles/workflow-pb/workflow-pb.md` v0.10.0）。
