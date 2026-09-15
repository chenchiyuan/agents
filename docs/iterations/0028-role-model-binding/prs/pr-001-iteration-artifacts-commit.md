# pr-001：迭代产物入库（F08/F13）

## 上下文摘要

把阶段 1~3 已落盘、但仍以 untracked 状态留在工作区的迭代产物提交到迭代分支：`demand.md` / `prd.md` / `prd/F01~F13*.md` / `architecture.md` / `clarifications/*.md` / `history.md` / `status.md`。动机是两条卡的判据面当前不在 git 里——F08 验收 1 要求"合并后迭代产物可在 main 上读到"，F13 验收 1 以 `git diff --name-only` 的改动路径清单为判据面。本 PR 只入库既有正文、不改任何内容；F08 / F13 的核对结论分别归 pr-010 / pr-009。`deferred-demand-changes.md`（归 pr-007）与 `prs/*.md`（各 PR 提交各自文件）不在本 PR 写入面。

## 涉及功能点

- F08
- F13

## 文件范围

- `docs/iterations/0028-role-model-binding/demand.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/prd.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md` ~ `F13-existing-surface-unchanged.md`（13 个功能卡，入库；正文零改动）
- `docs/iterations/0028-role-model-binding/architecture.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md` / `round-2-verification-and-execution.md` / `round-3-probe-and-equivalence.md` / `round-4-final-boundaries.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/history.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/status.md`（入库；正文零改动）
- `docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md`（本 PR 文件）

排除（由其它 PR 写入，本 PR 不触碰）：`deferred-demand-changes.md`（pr-007）、`prs/pr-002-*.md` ~ `prs/pr-010-*.md`（各自的 PR）、`cluster.json`（pr-002）。

## 验收标准

- [ ] 上列全部路径在迭代分支上为 tracked：`git ls-files docs/iterations/0028-role-model-binding` 含 `demand.md` / `prd.md` / `architecture.md` / `history.md` / `status.md` / 4 份 `clarifications/*.md` / 13 份 `prd/*.md`（本 PR 文件随本 PR 一并入库）
- [ ] 入库内容与入库前工作区逐字一致：`git show --stat` 显示为纯新增、且 `git show <本 PR 提交> -- <路径>` 的 diff 中无删改行（本 PR 不修改任何正文）
- [ ] `git show --name-only <本 PR 提交>` 只含上列路径，不含 `cluster.json` 与 `prs/` 下其它文件
- [ ] 入库后 `git status --porcelain docs/iterations/0028-role-model-binding` 对这些路径不再有 `??` 残留

## 参考资料

- `docs/iterations/0028-role-model-binding/architecture.md` §6 边界（迭代产物清单与"不新增"面）、§7② 组件→功能点追溯、§8 补全记录
- `docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md`（验收 1：合并后迭代产物可在 main 上读到）
- `docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md`（验收 1：改动面清单的判据面）
- `docs/iterations/0028-role-model-binding/prd.md` §本次迭代边界说明（包含/不包含清单）
- 先例：0004 起的既往迭代均把 `docs/iterations/{迭代}/**`（含 `prs/*.md`）纳入 main 历史（`git ls-files docs/iterations` 可见）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：「入库路径清单（`git ls-files` 输出）」+「提交的 `--name-only` 清单」；载体与字段形态见 `architecture.md` §4 A-02）
