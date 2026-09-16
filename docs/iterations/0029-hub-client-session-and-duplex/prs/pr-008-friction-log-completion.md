# pr-008：过程证据与摩擦搭置的核对补齐（F18）

## 上下文摘要

按 F18（过程契约卡，不引入产品能力）核对并补齐迭代目录内的**摩擦搭置记录**：`deferred-demand-changes.md` 中每条摩擦含三要素（问题 / 为什么判定为需求层面问题 / 本迭代如何处理），且"既有 `skill/hub.md` 未教等待原语"（事实 F-8）这一条**必须在场**（其处置指向 D-17 / F19）。

关键约束：该文件由主 agent 滚动追加（**只增不改**），本 PR 只做核对与补齐、不改既有行原文、不新建文件格式；`status.md` 的派发台账由**主 agent 滚动维护**（含 D-13 三问列），**不在本 PR 范围**（与 0028 迭代 pr-007 的同日口径一致）。

## 涉及功能点

- F18

## 文件范围

- `docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`（F18 要求的摩擦搭置记录：核对与补齐）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-008-friction-log-completion.md`（本 PR 文件）

排除（本 PR 不触碰）：`docs/iterations/0029-hub-client-session-and-duplex/status.md`（主 agent 滚动维护的派发台账）、`history.md`、`demand.md`（红线）、`architecture.md` / `prd/**`（只读）、`oamp/**`（本 PR 零代码改动）。

## 验收标准

- [ ] 摩擦类条目**至少**包含"既有 `skill/hub.md` 未教等待原语"一条（事实 F-8），其处置指向 `D-17` / `F19`（F18 验收 4）
- [ ] 每条摩擦条目三要素齐备且可核对：**问题** / **为什么判定为需求层面问题** / **本迭代如何处理**；三要素以字段名或等价的分列表述出现，不出现"见上文""同上"式指代（F18 验收 5）
- [ ] 处置一栏不出现"暂停 / 回退 / 改需求"形态的处置（F18 边界：摩擦不当阻塞理由）（F18 验收 4）
- [ ] 只增不改：既有 `DC-*` 行原文逐字保留，`git diff --numstat -- docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md` 的删除行数为 **0**
- [ ] 不新建文件、不新建表格格式（沿用既有表头与既有 `DC-` 前缀体例）；不修改 `demand.md`
- [ ] 本 PR 的 `git diff --name-only` 仅含该文件与本 PR 文件两行；不含 `oamp/**`、`roles/**`、`status.md`、`history.md`
- [ ] **台账与度量口径已登记（只核对、不回填）**：文件内可读到"派发台账逐行含 D-13 三问（角色 / 用途 / `call_id` / 终态 / 结果到手方式）"的口径指向（指向 `status.md` §派发台账）；**本 PR 不代主 agent 回填台账**（F18 验收 2/3 的载体为主 agent 维护的 `status.md`，见参考资料）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F18-process-evidence-and-friction-log.md`（验收 1~5、边界）
- `docs/iterations/0029-hub-client-session-and-duplex/prd/F19-hub-usage-doc-fix.md`（事实 F-8 对应的交付项）、`prd/F03`/`F05`/`F06`（DC-02 转为设计输入的去向）
- `docs/iterations/0029-hub-client-session-and-duplex/status.md` §派发台账（口径行：每行额外记录**结果到手方式**；F18 验收 1/2/3 的载体，主 agent 维护、不属本 PR）
- `docs/iterations/0029-hub-client-session-and-duplex/deferred-demand-changes.md`（现状 `DC-01`~`DC-08a`；本 PR 的核对基线）
- 体例先例：`docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md`（过程契约卡的 PR 形态：分区核对 + 四要素自检 + 明文排除 `status.md`）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：摩擦条目清单与三要素自检表 + F-8 那一条的原文与处置指向 + `git diff --numstat` 的删除行计数 + `git diff --name-only` 原文 + 台账口径指向行的 `grep` 输出。载体约定见 F18 与本迭代 `deferred-demand-changes.md` 的头注。）
