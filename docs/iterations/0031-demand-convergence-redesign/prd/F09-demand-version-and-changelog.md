# F09 · demand 版本升级与变更记录

**来源**：边界·做 第 1 条（"重写 `roles/demand/demand.md`（v0.7.0 → v1.0.0），并在 `roles/demand/data/demand-changelog.md` 记录变更"）；事实 F-4（历次改版只加码，从未往"问得更少更准"收）

## 用户价值

后来的人能从版本号和 changelog 一眼看出这是一次方向性的"减法"重写，以及为什么这么改。

## 验收标准

1. **版本号**：新版 `roles/demand/demand.md` 头部版本为 `1.0.0` [边界·做 1]。
2. **changelog 新增条目**：`roles/demand/data/demand-changelog.md` 新增 `v1.0.0` 条目，且位于既有条目之前（沿用该文件"新条目在上"的现有体例）[边界·做 1]。
3. **条目内容完整**：v1.0.0 条目沿用该文件既有四要素体例——需求 / 变更原因 / 决策过程 / 经验总结 [沿用现有 changelog 体例]。
4. **既有条目不动**：v0.7.0 及更早条目内容不被修改 [边界·做 1 只要求"记录变更"]。
5. **frontmatter description 同步**：新版 frontmatter `description` 不再描述旧流程（"草稿+角色反射+同维度深挖+提案确认"），与新流程一致 [user_confirmed · D-18，见下]。

QA 判定方式：读文件头版本号；diff changelog，确认只新增 v1.0.0 条目且四要素齐全；检索 description。

## 边界（不包含）

- 不更新其它角色的 changelog（workflow-pb / prd 是否写 changelog 见 `architecture.md` §6）。
- 不修改 `roles/demand/data/` 下其它文件。

## 架构维度

**A-04（已填定，详见 `architecture.md` §6；L1-4 用户已确认选 A）**：推荐方案 A——workflow-pb、prd 不升版本、不写各自 changelog；demand-changelog v1.0.0 条目在"具体改动"下单列"联动修改"小节，逐条记下 workflow-pb :52 / :228、SKILL.md :130、prd.md 各处。description 新文见 §3.4。

## model_inferred（已由 D-18 全部采纳，来源改为 user_confirmed）

- 验收 3（四要素体例）[user_confirmed · D-18]：demand 只要求"记录变更"，四要素来自该 changelog 文件现有体例。
- 验收 5（description 同步）[user_confirmed · D-18]：demand 未点名 frontmatter；从"重写"与"description 描述的旧流程会误导调度方"推导。
