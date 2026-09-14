# 0022 阶段 5 · 次波任务图 `[model_inferred]` 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `prs/pr-002-tasks.md`（疑问① / 疑问② / MI-2~MI-4）+ `prs/pr-005-tasks.md`（MI-1~MI-4 / 矛盾①）
**性质**: `user_confirmed`
**用途**: 次波 dev 派发的输入

---

## W2-A · 一次性路径的 `--approval-mode` 与段序归属 —— **归调用层**

- 档位取值（tools 关 ⇒ **不追加** `--approval-mode`；`permission=deny` ⇒ `always-ask`；其余 ⇒ `yolo`）由**调用层**决定，不由 profile 数据决定；
- `pr-002` 的断言口径 = **调用层合成后的 argv**（与现状 `agent.js:192-199` 逐字一致）；
- `pr-003` / `pr-005` 必须复现该调用层语义（这是 pr-003 的绑定义务之一，已写入其 dev brief）；
- 理由是安全性的：若按 profile 数据的 `yolo` 落地，`deny` 档会静默绕过权限门（omp 在 yolo 档不发权限请求）；
- 已否决：新增小 PR 改已合并的 `launcher.js` profile 数据（更纯但多一个 PR + 新依赖边 + 需重跑 Gate）。

## W2-B · pr-005 任务图 4 项 —— **全部采纳**

| # | 采纳内容 |
|---|---|
| MI-1 | 解析链承载键 = `resident.protocol`（角色级）+ `resident.configProtocol`（折叠值），**不改** architecture §5.1 的门面签名 |
| MI-2 | oneshot 行流载荷 = `{kind:'chunk', text, stream:'stdout'|'stderr'}`（保「与今天逐字一致」可判） |
| MI-3 | oneshot `prompt()` 返回字段：`text` = stdout 行流累积、`model` = 本轮请求模型或 null、`stop_reason`/`usage` = **null（不造值）**、`pid` = 本轮子进程 |
| MI-4 | 门名解析原语由 `protocol.js` 具名导出（保「RPC 与 ACP 门同源」且不新增 import 边） |

## W2-C · 上游口径冲突（矛盾①）—— **按 `optionId`**

- 钩子入参选项键名以 **`optionId`** 为准（与既有消费面 `agent.js:302-311` / `:344-351` 一致，`pr-003` 的 `raiseConfirmation` 零改动）；
- `architecture.md` §3.4 / §5.6 的 `options:[{option_id}]` 字面**作废**，登记为已知偏差交阶段 6 核查同步（执行角色产物不由本阶段改写）。

---

## 附带登记（主 agent 裁定，非用户决策点）

1. `pr-002` 疑问②（测试是否可引用 `buildArgv`）：**允许** —— 期望值真源 = `launcher.js` 模块（`PROFILES` 与 `buildArgv` 同模块）；**禁止**在测试内复写推导逻辑（与 Gate D-2 「锁死单一真源」的立法意图一致）。
2. `pr-002` MI-2（10 个 agent 启动点 / 8 个 env 载体作为注入完整性判据）、MI-3（收口 diff 基准 = `fa2acd6`）、MI-4（一次性筛选记号纳入 profile 真源）：**采纳**。
3. `pr-001` 验收遗留偏差 D-7′（`input:'positional'` 且未传 prompt ⇒ argv 末位 `undefined`）：列为 `pr-003` / `pr-005` 的**防护义务**，由阶段 6 核查是否已防护。
