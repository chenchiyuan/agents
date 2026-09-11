# E1~E8 真实环境验收证据（2026-09-11，阶段 6 返工后重跑）

> 执行者：主 agent（会话内实测）。环境：macOS / node v22 / 真实 omp 18.0.11 / 真实 `deepseek/deepseek-v4-flash`。
> 命令与输出均为本机实录；日志路径 `<repo>/oamp/.runtime/cluster/*.log`。

## 主集群（`cluster.json` 缺省，10 角色）

| # | 验收条款 | 结果 | 证据 |
|---|---|---|---|
| E1 | `oamp status` 出现 10 个 `pb-*` 且全 online | ✅ | `cluster up` 输出：session=oamp-cluster，12 窗口；`status` 中 `online` 计数 = **10**（pb-architect…pb-workflow-pb） |
| E2 | 对 `@pb-dev` 发"创建 role-smoke2.txt"→ 文件真实存在 | ✅ | 文件落盘 `role-smoke2.txt`（9 字节，内容 `fixed-ok`）；chat state=completed；out「文件已创建…」 |
| E3 | `@pb-architect` 复述角色定义与 role md 一致且换 chat 仍一致 | ✅ | 两个独立 chat 的回答均与 `roles/architect/architect.md` 的 identity 一致（"技术架构收敛者…不白纸架构、不擅自实施 L1 决策、不改功能规格的产品维度"） |
| E5(allow) | 允许档不挂起、有放行日志 | ✅ | `grep -c TOOL_CALL .runtime/cluster/pb-dev.log` = **1**；字段含 `instance=pb-dev role=dev chat_id=… context_id=ctx-… tool_call_id=… kind=edit title="Creating role-smoke2.txt" status=completed source=acp_tool_call path=…` |
| E6 | kill 后转 offline | ✅ | `kill -9` pb-retrospective → 35s 后（租约 30s 到期）`status` 中该实例 `state=offline` |
| E7 | tmux session 可 attach、各窗口有输出、down 后无残留、日志落盘且未入 git | ✅ | `tmux list-windows` = router/web/9 角色（被杀角色窗口因 remain-on-exit 保留）；日志 12 份于 `.runtime/cluster/`，`git check-ignore` 命中；`cluster down` → 「已收口」+ tmux server 消失；本项目 oamp 进程残留 = **0**（收口前另有 2 个与集群无关的历史进程：0011 验证遗留 web@45116、主 agent 早前的手工探针，均已清理） |

## 专项集群（`--config /tmp/e-check/cluster.json`，3 角色，用于 E4/E5-deny/E8）

| # | 验收条款 | 结果 | 证据 |
|---|---|---|---|
| E8 | 配 `cwd` 的角色"在当前目录创建文件"落在该 cwd、未配角色落仓库根 | ✅ | `pb-prd` 配 `cwd=/tmp/e-check/cwd-prd` → 文件落在 `cwd-prd/e8-cwd.txt`；仓库根 `e8-cwd.txt` **不存在**（未污染）；日志有对应 `TOOL_CALL`(kind=edit) |
| E4 | 关掉工具开关的角色，同一指令不产生文件 | ✅（含一处措辞偏差） | `pb-dev` 配 `tools:false` → `cwd-dev` **无任何文件**；偏差点：模型仍输出了原始工具调用标记（`<｜｜DSML｜｜ calls>…<invoke name="bash">`）而非"明确回绝"，与 M-01 的措辞期望不完全一致（omp 在无工具时的模型行为，非代码缺陷） |
| E5(deny) | 拒绝档不挂起、工具被拒 | ✅ | `pb-planner` 配 `permission=deny` → `cwd-planner` **无文件**；out「写入被拒绝，e5-deny.txt 未创建」；`duration_ms=4331`（≤10s 收尾，不挂起）；日志 1 行 `TOOL_CALL`(kind=edit) 留痕 |

## 备注

1. `--config` 指向仓库外时，角色根 = **配置文件所在目录**（架构 §5.1 设计）——本次通过在该目录补 `roles/` 符号链接满足校验；该"外部配置的 root 口径"已由 stage6 验证列为下一迭代候选。
2. 工具关闭档（E4）的模型输出不含明确回绝语——已记偏差；不影响"不产生文件"的判定。
3. NC-5 定稿（pr-007 实测）：只读工具同样推送 `tool_call` 通知 ⇒ E5 字面口径「每一次工具调用恰一行」成立。
4. 本文件为 E 系列验收的唯一证据归档（执行者：主 agent；非独立验证报告——独立验证见 `verify-*-stage6.md` 与 `verify-*-pr007.md`）。
