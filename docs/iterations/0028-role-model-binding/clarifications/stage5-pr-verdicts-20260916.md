# 阶段 5 逐 PR 验收结论（落盘记录）

- **迭代**: 0028-role-model-binding
- **阶段**: 阶段 5（PR 实现）· 逐 PR 验收
- **时间**: 2026-09-15 23:13 ~ 2026-09-16 09:06（+0800）
- **记录者**: 主 agent
- **来源**: 各次 `verifier` 调用的终态信封与对话留存（hub 调用面在集群重启后清空，故结论正文另从 `api chats get` 的对话记录恢复）

> **记录目的**：闭合 `progress.md` §5 第 7 条不一致——阶段 5 的三条验收结论此前只存在于 `history.md` 与 hub 对话记录中，迭代目录内无落盘报告。本文件为主 agent 的**记录性产物**（非执行角色的报告）。

---

## 一、结论总览

| PR | 验收 call_id | 耗时 | 实报 model | 结论 | 后续 |
|---|---|---|---|---|---|
| pr-001-iteration-artifacts-commit | `task-def5a04f-85a6-42b8-8dd5-c5f261e5171a` | 224086ms | `powerby/grok-4.6` | **FAIL**（1 fail / 4 pass） | 返工（`task-07508a08…`，提交 `f6a8ccb`）→ 重验（`task-fc99395f…`） |
| pr-002-role-model-binding | `task-5585d411-a3cc-46cf-8a1f-31baccfd03b5` | 364616ms | `powerby/grok-4.6` | **FAIL**（1 fail / 3 pass / 2 partial） | 字面修订（`task-05e21d21…`，未提交）→ `dev` 返工（`task-2a20f315…`） |
| pr-003-one-shot-backend-receipts | `task-637e830a-a4f0-4318-9650-16b72eedeb82` | 365858ms | `powerby/grok-4.6` | **PASS**（0 fail / 6 pass） | 已合并（merge `6115f2a`，`1 file changed, 130 insertions(+)`） |

三条验收实报均为 `powerby/grok-4.6`——根因是 `pb-verifier` 的**常驻会话被探针期 per-call model 固化**（差距记录 **G-11**），非角色级绑定；集群重启后该固化已清除（返工轮的实报回到 `deepseek/deepseek-v4-flash`）。

## 二、pr-001 失败明细（fail 标准 3「验收证据原文照录」）

| # | 不通过侧事实 | 现测应为 |
|---|---|---|
| 1 | 证据内 `git ls-files` 块 **24 行**，`prd.md` 重复出现两次 | **23 行**、`prd.md` 仅一次（位于 `history.md` 与 `prd/F01` 之间） |
| 2 | 证据内 `git show --name-only --format= 0e314a3` 块把 `prd.md` 排在 `F13` 之后 | `prd.md` 在 `history.md` 与 `prd/F01` 之间 |
| 3 | T1「哈希比对」命令先 `sed 's#^[0-9a-f]*  ##'` 去掉哈希再 `diff` 文件名列表（输出 `hash-match=23/23`） | 真正比对哈希（逐文件 sha256）并附真实输出 |
| 4 | T4 段混有转述句（"本 PR 无测试套件…"） | 纯命令 + 原始输出；说明性文字与证据块分离 |

通过侧（同次报告）：提交可复核（两提交 `0e314a3` / `6cfb660`，抽样哈希一致）、冻结面零命中、改动面 ⊆ 文件范围。

## 三、pr-002 失败明细（fail 标准 3 + partial 标准 1/5）

- **fail 标准 3**：`git diff -U0 main...HEAD -- cluster.json` 含 **1 条删除行**——`-    "verifier": {},` → `+    "verifier": { "model": "powerby/grok-4.6" },`。键序、`session`/`web`/`router` 子项均成立，唯"只含新增行"不成立。
- **partial 标准 1**：PR 验收条目通过侧 / 不通过侧拆开（取值、8 角色无 `model`、形态合法均通过；标准 4 的字面与实现形态冲突）。
- **partial 标准 5**：证据中 `pb-prd` 的 `log=` 行误写为 `…/pb-progress-observer.log`（实跑为 `…/pb-prd.log`）；`__EXIT_CODE__=1` 为占位符非命令输出；「其它验收核验」为转述摘要。
- **处置**：该字面在 JSON 结构上**不可满足**（空对象段必须整行改写）⇒ 由产物所有者 `pr-planner` 修订为**形态 A（单行内联）+ `--numstat` = 2 增 1 删**的计数判据（`task-05e21d21…`，08:49:32 完成）；F03 验收 4 的同一字面缺陷另行登记。

## 四、pr-003 通过要点（0 fail）

三条回执（deepseek 默认 / gpt / grok）字段齐备（`命令` / `原始输出` / `观测结果` / `时点` / `耗时`）；命令均为一次性路径形态（无 `hub`、无 `api messages`、无 `calls create`）；三条除 `--model` 取值外逐字一致；改动面封闭；冻结面零命中。偏差 2 条（不影响判定）。

## 五、本文件的边界

- 本文件只承载**结论与失败明细**，不含执行过程解释；verifier 报告正文中未持久化的部分以 hub 对话留存片段为准。
- 三条验收均为**独立判定**（委托时不提供执行过程与既往判定）。
- 后续重验结论将在 `history.md` 继续记录；若需再次落盘，按同体例追加。
