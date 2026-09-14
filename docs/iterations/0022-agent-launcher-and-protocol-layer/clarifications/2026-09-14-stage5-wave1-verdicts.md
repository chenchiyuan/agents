# 0022 阶段 5 · 首波任务图 `[model_inferred]` 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `prs/pr-001-tasks.md`（5 项）+ `prs/pr-004-tasks.md`（2 项）
**性质**: `user_confirmed`
**用途**: 首波 dev 派发的输入

---

## pr-001 任务图 · 5 项 —— **全部采纳**

| # | 采纳内容 |
|---|---|
| MI-1 | `launcher.js` 对外接口面：`PROFILES` 与 `buildArgv` 可被 import；`buildArgv(profileKey, {model, roleFile, tools, prompt})` 四参；`tools` 与 `profile.tools` 同形 |
| MI-2 | argv 规范次序 = `modeArgs → [--no-skills] → [--no-rules] → [--no-tools] → [--no-session] → [--model] → [--append-system-prompt] → [--approval-mode] → [positional prompt]`（取 A6 的 acp 次序以复现常驻链路逐字） |
| MI-3 | `omp:oneshot` 的 skills / rules = true（**不**追加 `--no-skills` / `--no-rules`），保一次性路径零行为变更 |
| MI-4 | spawn 封装的 stdin 两态可指定（常驻 pipe / 一次性 ignore）、stdout+stderr 恒为 pipe、封装不接线 data 监听 |
| MI-5 | `config.json` 的 `protocol` 键位于**顶层**（`{"protocol":"acp"}`） |

## pr-004 任务图 · 2 项 —— **全部采纳**

| # | 采纳内容 |
|---|---|
| T1 验收 3 | 气泡挂载判据由「文本非空」改为「**文本或过程任一非空**」（否则仅过程增量时分区无落点可验） |
| T2 验收 6 | 既有 `stdout` / `stderr`（及未来未知取值）仍走既有 `#stream-text` 路径；新分区白名单只含 `thinking` / `tool_call` / `tool_output` 三个新值 |

---

## 主 agent 裁定（非用户决策点）

**pr-001 任务图的「approval caller 覆写面」疑问**：pr-001 的 `buildArgv` 签名内不含 `approval` 参数，而既有 `agent.js:198` 存在 `deny ⇒ --approval-mode always-ask` 的外部条件覆写。

裁定：**保持任务的字面签名不变**（`buildArgv` 只按 profile 值产出 argv，不扩展 approval 入参）；`deny ⇒ always-ask` 的覆写语义由**调用方侧前置处理**（pr-003 / pr-005 在拿到 profile 值后按 permission 档位覆写 `--approval-mode`）。理由：该覆写是调用方策略而非 profile 数据（同一 profile 在不同 permission 档下 argv 不同 ⇒ 属调用方决策）；扩展签名会把策略下沉进 L1，违反 architecture §4.2 L2-7「argv 由 profile 构造 + 调用方选择」的分工。
