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

### 执行证据

#### T1：复制、逐字比对与暂存

命令：

```sh
cd <迭代工作区>/docs/iterations/0028-role-model-binding && shasum -a 256 demand.md prd.md prd/F*.md architecture.md clarifications/round-*.md > /tmp/ingest-src.sha256
cd <本 worktree>/docs/iterations/0028-role-model-binding && shasum -a 256 demand.md prd.md prd/F*.md architecture.md clarifications/round-*.md > /tmp/ingest-dst.sha256
diff /tmp/ingest-src.sha256 /tmp/ingest-dst.sha256; echo "files=$(wc -l < /tmp/ingest-src.sha256 | tr -d ' ') diff-lines=$(diff /tmp/ingest-src.sha256 /tmp/ingest-dst.sha256 | wc -l | tr -d ' ')"
```

输出：

```text
files=20 diff-lines=0
```

命令：

```sh
cd <本 worktree>
git show 0e314a3:docs/iterations/0028-role-model-binding/history.md | shasum -a 256 | cut -d' ' -f1 > /tmp/rolling-c1.sha256
git show 0e314a3:docs/iterations/0028-role-model-binding/status.md | shasum -a 256 | cut -d' ' -f1 >> /tmp/rolling-c1.sha256
shasum -a 256 docs/iterations/0028-role-model-binding/history.md docs/iterations/0028-role-model-binding/status.md | cut -d' ' -f1 > /tmp/rolling-disk.sha256
diff /tmp/rolling-c1.sha256 /tmp/rolling-disk.sha256; echo "rolling-files=$(wc -l < /tmp/rolling-c1.sha256 | tr -d ' ') diff-lines=$(diff /tmp/rolling-c1.sha256 /tmp/rolling-disk.sha256 | wc -l | tr -d ' ')"
```

输出：

```text
rolling-files=2 diff-lines=0
```

命令：

```sh
# C1（0e314a3）落定后，暂存面判据以本 diff 面复现（parent 162682d → 0e314a3）
git diff --name-only 162682d 0e314a3 | sort
git diff --name-only 162682d 0e314a3 | wc -l | tr -d ' '
git diff --numstat 162682d 0e314a3 | awk '{s+=$2} END{print s+0}'
```

输出：

```text
docs/iterations/0028-role-model-binding/architecture.md
docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md
docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md
docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md
docs/iterations/0028-role-model-binding/demand.md
docs/iterations/0028-role-model-binding/history.md
docs/iterations/0028-role-model-binding/prd.md
docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md
docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md
docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F06-verifier-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F07-unbound-control-evidence.md
docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md
docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md
docs/iterations/0028-role-model-binding/prd/F10-single-chat-attribution.md
docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md
docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md
docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md
docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md
docs/iterations/0028-role-model-binding/status.md
23
0
```

命令：

```sh
git -C <迭代工作区> status --porcelain docs/iterations/0028-role-model-binding | grep -v '^??' | wc -l | tr -d ' '
```

输出：

```text
0
```

#### T2：C1 入库提交

命令：

```sh
git show --stat=200 --oneline 0e314a3
git show --numstat 0e314a3 | awk '{s+=$2} END{print s+0}'
git show 0e314a3:docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md | shasum -a 256
```

输出：

```text
0e314a3 docs(0028/pr-001): 迭代产物入库
 docs/iterations/0028-role-model-binding/architecture.md                                      | 328 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md                    |  39 ++++++++++++
 docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md |  28 +++++++++
 docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md      |  24 ++++++++
 docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md           |  28 +++++++++
 docs/iterations/0028-role-model-binding/demand.md                                            | 127 ++++++++++++++++++++++++++++++++++++++
 docs/iterations/0028-role-model-binding/history.md                                           | 204 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/iterations/0028-role-model-binding/prd.md                                               | 212 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md                 |  37 ++++++++++++
 docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md                   |  39 ++++++++++++
 docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md                        |  33 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md                |  40 ++++++++++++
 docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md                      |  32 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F06-verifier-binding-evidence.md                 |  34 +++++++++++
 docs/iterations/0028-role-model-binding/prd/F07-unbound-control-evidence.md                  |  32 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md            |  38 ++++++++++++
 docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md      |  31 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F10-single-chat-attribution.md                   |  32 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md             |  32 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md                      |  33 ++++++++++
 docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md                |  30 +++++++++
 docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md             |  50 +++++++++++++++
 docs/iterations/0028-role-model-binding/status.md                                            | 100 ++++++++++++++++++++++++++++++
 23 files changed, 1583 insertions(+)
0
fe3a12477a08bd70fd681e32feb1a70d5b50fadca7dd3093c02b9f3e6917177a  -
```

命令：

```sh
git show --name-only --format= 0e314a3 | grep -E 'cluster\.json|^oamp/|^roles/|deferred-demand-changes|clarifications/verify-|prs/pr-00[2-9]|prs/pr-010' | wc -l | tr -d ' '
```

输出：

```text
0
```

#### T3：C2 证据追加前的两段提交清单

命令：

```sh
git rev-parse --short 0e314a3
```

输出：

```text
0e314a3
```

命令：

```sh
git ls-files docs/iterations/0028-role-model-binding
```

输出：

```text
docs/iterations/0028-role-model-binding/architecture.md
docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md
docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md
docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md
docs/iterations/0028-role-model-binding/demand.md
docs/iterations/0028-role-model-binding/history.md
docs/iterations/0028-role-model-binding/prd.md
docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md
docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md
docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F06-verifier-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F07-unbound-control-evidence.md
docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md
docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md
docs/iterations/0028-role-model-binding/prd/F10-single-chat-attribution.md
docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md
docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md
docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md
docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md
docs/iterations/0028-role-model-binding/status.md
```

命令：

```sh
git show --name-only --format= 0e314a3
```

输出：

```text
docs/iterations/0028-role-model-binding/architecture.md
docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md
docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md
docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md
docs/iterations/0028-role-model-binding/demand.md
docs/iterations/0028-role-model-binding/history.md
docs/iterations/0028-role-model-binding/prd.md
docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prd/F02-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md
docs/iterations/0028-role-model-binding/prd/F04-second-cluster-full-roster.md
docs/iterations/0028-role-model-binding/prd/F05-dev-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F06-verifier-binding-evidence.md
docs/iterations/0028-role-model-binding/prd/F07-unbound-control-evidence.md
docs/iterations/0028-role-model-binding/prd/F08-post-merge-activation-evidence.md
docs/iterations/0028-role-model-binding/prd/F09-dispatch-channel-and-source-of-truth.md
docs/iterations/0028-role-model-binding/prd/F10-single-chat-attribution.md
docs/iterations/0028-role-model-binding/prd/F11-dispatch-equivalence-criteria.md
docs/iterations/0028-role-model-binding/prd/F12-execution-gap-record.md
docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md
docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit.md
docs/iterations/0028-role-model-binding/status.md
```

命令：

```sh
diff <(git ls-files docs/iterations/0028-role-model-binding | sort) <(git show --name-only --format= 0e314a3 | sort); echo "first=$(git ls-files docs/iterations/0028-role-model-binding | wc -l | tr -d ' ') second=$(git show --name-only --format= 0e314a3 | wc -l | tr -d ' ') diff-lines=$(diff <(git ls-files docs/iterations/0028-role-model-binding | sort) <(git show --name-only --format= 0e314a3 | sort) | wc -l | tr -d ' ')"
```

输出：

```text
first=23 second=23 diff-lines=0
```

#### T4：收口核验

命令：

```sh
git ls-files docs/iterations/0028-role-model-binding | wc -l | tr -d ' '
git status --porcelain docs/iterations/0028-role-model-binding
```

输出：

```text
23
?? docs/iterations/0028-role-model-binding/prs/pr-001-iteration-artifacts-commit-tasks.md
```

说明（非证据）：本 PR 无测试套件可跑，验收判据为上述 git 面与逐字 sha256 比对；`history.md` / `status.md` 是滚动文件（任务图 §0.5 A6），其源副本在本 PR 执行后仍继续更新，故这 2 份的源侧比对以入库提交 `0e314a3` 的内容为基准（两文件在 C2 中未被改动）。
