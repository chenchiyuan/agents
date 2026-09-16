# pr-009：既有面零改动与既有语义保持核对（F13）

## 上下文摘要

本迭代的保证项核对：迭代分支相对 main 的改动路径只含 `cluster.json` 与迭代产物 `docs/iterations/0028-role-model-binding/**`（不含 `oamp/**`、`roles/**`），并复用两条常驻探针回执证明 per-call `model` 的既有优先级语义未被改写。该核对须在**全部 PR 已合入迭代分支之后、迭代分支合入 main 之前**执行（分支合并后 `git branch -d` 会让 `main...iteration/…` 不再可比）。本 PR 只读核对 + 落证。

## 涉及功能点

- F13

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-009-existing-surface-freeze.md`（本 PR 文件：核对结论写入「验收证据」小节）

排除（本 PR 不触碰）：`cluster.json`（pr-002）、`cluster.second.json`（pr-005，运行态副本）、`status.md`（主 agent 滚动维护）、`deferred-demand-changes.md`（pr-007）。

## 验收标准

- [ ] **改动面清单（F13 验收 1）**：`git diff --name-only main...iteration/0028-role-model-binding`（执行时点、合并前）的路径清单 ⊆ {`cluster.json`, `docs/iterations/0028-role-model-binding/**`}；清单中**不含** `oamp/src/**`、`oamp/web/**`、`oamp/bin/**`、`oamp/sdk/**`、`oamp/README.md`、`oamp/API.md`、`roles/**`（逐项比对，输出原文照录）
- [ ] **不新增接口 / 字段 / 参数**：本迭代取证与派发全程只用既有面——判据 = 验收 1 的路径清单不含 `oamp/**`（新增面必然要求改 `oamp/**`），据此成立、不另立重复条款（F13 验收 1 后半）
- [ ] **per-call `model` 既有优先级语义保持（F13 验收 2）**：复用 pr-004 落盘的两条常驻探针回执——派发携带 `--model`、目标角色在当前集群配置中**无** `model` 绑定、实报 `model` 与请求值解析到同一后端（三条同时成立即为通过；本卡不重复取证）
- [ ] **运行态副本登记**：显式登记 `<工作区>/cluster.second.json` 的 untracked 性质（运行态产物，与 socket / 集群日志同类，不进入验收 1 的 `git diff` 判据面）与回退路径（若阶段 6 取 `git status` 口径，取证后删除副本、其逐字内容只留在 PR 证据里，`architecture.md` §7⑤）
- [ ] 不清理 0027 迭代现场（worktree 与分支原样保留）；不修复与本迭代无关的既有缺陷（C-1 只记录）；不新增测试 / CI / hook / 依赖（F13 边界）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F13-existing-surface-unchanged.md`（验收 1~2、边界）
- `docs/iterations/0028-role-model-binding/architecture.md` §6 边界（`cluster.second.json` 的登记）、§7⑤ 可推翻性（回退路径）、§7③⑤（内部冲突与探针唯一性检查）
- `docs/iterations/0028-role-model-binding/demand.md` §不做什么（第 5 条：不改 per-call `model` 语义）与 §大概怎么做（生效链路既有、不改）
- `docs/iterations/0028-role-model-binding/status.md` §派发台账（两条探针行的实报 `model` 原文）
- `docs/iterations/0028-role-model-binding/deferred-demand-changes.md` §澄清期登记的冲突 C-1（默认 id 靠 fuzzy 解析 → 实报字符串可能与配置字符串不同名）
- 代码锚点：`oamp/src/cluster.js:200-201`（角色级 `model` → `--model`）、`oamp/README.md` §集群（`model` 解析链与优先级，prd.md 已更正引用位置）

## depends_on

- pr-002-role-model-binding.md（理由：验收 1 的判据面显式含 `cluster.json`，其改动行（两处 `roles.<role>.model` 新增）的唯一来源是 pr-002；缺 pr-002 该判据面退化为空集，"既有面零改动"无对象可判——证据：`prd/F13-existing-surface-unchanged.md` 验收 1 的路径清单原文首项即 `cluster.json`）
- pr-004-resident-backend-probes.md（理由：验收 2 明写"证据复用 F02 的两条常驻探针回执（本卡不重复取证）"，该回执（六字段，含携带 per-call `--model` 的派发命令与终态实报值）由 pr-004 落盘于其「验收证据」小节——证据：`prd/F13-existing-surface-unchanged.md` 验收 2 原文与 `prd/F02-resident-backend-probes.md` 验收 1 的字段形态）

## batch

6

## 验收证据

（本 PR 执行时填写：「`git diff --name-only main...iteration/0028-role-model-binding` 原始输出」+「逐项比对表（含为何不含 `oamp/**`、`roles/**`）」+「复用的两条探针回执引用（指向 pr-004 证据小节）」+「`cluster.second.json` 的 untracked 性质登记」；载体约定见 `architecture.md` §4 A-02）

### 执行记录（pr-009 · 既有面零改动核对；执行者 dev，2026-09-16）

**执行窗口（本卡的命门）**：判据 `git diff --name-only main...iteration/0028-role-model-binding` 只在「全部 PR 已合入迭代分支、尚未合入 main」的窗口内可复现；下列两个 SHA 是本判据面的**冻结锚点**（执行时点 `2026-09-16 10:35:35 CST`；**所有命令的 cwd = `<WS>`** = `/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding`）：

```
$ git -C <WS> rev-parse main iteration/0028-role-model-binding
162682dbb6d85b47e3844bc0dae29751f57847c8        # main
46b9dcf1b67aedf126b67ab539fada1aa69f5a96        # iteration/0028-role-model-binding
$ git -C <WS> log --oneline -1 iteration/0028-role-model-binding
46b9dcf merge: pr-004 常驻后端探针回执(F02) into iteration/0028-role-model-binding
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding | wc -l
32
$ git -C <WS> merge-base --is-ancestor main iteration/0028-role-model-binding; echo "exit=$?"
exit=0                     # main 是迭代分支的祖先 = 迭代分支建立在 main 之上（未合入前的常态）
$ git -C <WS> merge-base --is-ancestor iteration/0028-role-model-binding main; echo "exit=$?"
exit=1                     # 迭代分支**不是** main 的祖先 ⇒ 尚未合入 main ⇒ 窗口敞开
```

⇒ 窗口判定 = **敞开**（两分支均可解析、差异 32 路径非空、迭代分支未成为 `main` 的祖先）。两个 SHA 已固定，判据面在分支被删后仍可由 SHA 形式复算（见下）。

#### ① `git diff --name-only main...iteration/0028-role-model-binding` 原始输出（PR 验收 1 前半｜F13 验收 1）

```
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding
cluster.json
docs/iterations/0028-role-model-binding/architecture.md
docs/iterations/0028-role-model-binding/clarifications/round-1-kickoff.md
docs/iterations/0028-role-model-binding/clarifications/round-2-verification-and-execution.md
docs/iterations/0028-role-model-binding/clarifications/round-3-probe-and-equivalence.md
docs/iterations/0028-role-model-binding/clarifications/round-4-final-boundaries.md
docs/iterations/0028-role-model-binding/deferred-demand-changes.md
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
docs/iterations/0028-role-model-binding/prs/pr-002-role-model-binding.md
docs/iterations/0028-role-model-binding/prs/pr-003-one-shot-backend-receipts.md
docs/iterations/0028-role-model-binding/prs/pr-004-resident-backend-probes.md
docs/iterations/0028-role-model-binding/prs/pr-005-second-cluster-bring-up.md
docs/iterations/0028-role-model-binding/prs/pr-006-second-cluster-binding-evidence.md
docs/iterations/0028-role-model-binding/prs/pr-007-execution-gap-record.md
docs/iterations/0028-role-model-binding/prs/pr-008-dispatch-contract-audit.md
docs/iterations/0028-role-model-binding/status.md
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding | wc -l
32
```

**构成分类**（A + B = 总行数，判据 = 无第三组）：

```
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding | grep -c '^cluster.json$'
1
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding | grep -c '^docs/iterations/0028-role-model-binding/'
31
```

⇒ **A 组** = `cluster.json`（恰 1 条）；**B 组** = `docs/iterations/0028-role-model-binding/**`（31 条）⇒ 1 + 31 = 32 = `wc -l`，**无第三组**。

**SHA 形式等价命令（可复现加固）**：

```
$ git -C <WS> diff --name-only 162682dbb6d85b47e3844bc0dae29751f57847c8 46b9dcf1b67aedf126b67ab539fada1aa69f5a96 > /tmp/0028-pr-009-diff-sha.txt
$ diff /tmp/0028-pr-009-diff-symbolic.txt /tmp/0028-pr-009-diff-sha.txt; echo "exit=$?"
exit=0                     # 符号形式与 SHA 形式逐行零差异
$ wc -l < /tmp/0028-pr-009-diff-sha.txt
32
```

⇒ 窗口关闭（迭代分支合入 main 并被删除）后，判据面仍可由上述两个 SHA 复算。

#### ② 逐项比对表（PR 验收 1 后半 / 2）

**禁区逐项核验**（判据 = ① 的清单原文，命令可直接粘贴执行）：

```
$ git -C <WS> diff --name-only main...iteration/0028-role-model-binding > /tmp/0028-pr-009-diff-symbolic.txt
$ grep -Ec '^(oamp/|roles/)' /tmp/0028-pr-009-diff-symbolic.txt
0
$ for p in '^oamp/src/' '^oamp/web/' '^oamp/bin/' '^oamp/sdk/' '^oamp/README\.md' '^oamp/API\.md' '^roles/'; do \
    printf '%s -> %s\n' "$p" "$(grep -Ec "$p" /tmp/0028-pr-009-diff-symbolic.txt)"; done
^oamp/src/ -> 0
^oamp/web/ -> 0
^oamp/bin/ -> 0
^oamp/sdk/ -> 0
^oamp/README\.md -> 0
^oamp/API\.md -> 0
^roles/ -> 0
$ grep -Evc '^cluster\.json$|^docs/iterations/0028-role-model-binding/' /tmp/0028-pr-009-diff-symbolic.txt
0                          # 反向比对：清单中每条路径都落在两组合法面内
```

| # | 核验项 | 判据命令（逐字） | 命中数 | 结论 |
|---|---|---|---|---|
| 1 | `oamp/src/**` | `grep -Ec '^oamp/src/' /tmp/0028-pr-009-diff-symbolic.txt` | **0** | 零改动 |
| 2 | `oamp/web/**` | `grep -Ec '^oamp/web/' …` | **0** | 零改动 |
| 3 | `oamp/bin/**` | `grep -Ec '^oamp/bin/' …` | **0** | 零改动 |
| 4 | `oamp/sdk/**` | `grep -Ec '^oamp/sdk/' …` | **0** | 零改动 |
| 5 | `oamp/README.md` | `grep -Ec '^oamp/README\.md' …` | **0** | 零改动 |
| 6 | `oamp/API.md` | `grep -Ec '^oamp/API\.md' …` | **0** | 零改动 |
| 7 | `roles/**` | `grep -Ec '^roles/' …` | **0** | 零改动 |
| — | 等价覆盖 | `grep -Ec '^(oamp/|roles/)' …` | **0** | 上述七项的一次性等价判据（任一为 0 ⇔ 本条为 0） |
| — | 正向比对 | `grep -Evc '^cluster\.json$|^docs/iterations/0028-role-model-binding/' …` | **0** | 清单 ⊆ {`cluster.json`} ∪ {迭代产物} |

**不新增接口 / 字段 / 参数（PR 验收 2）——推论链**：

```
（推论链，非命令）新增端点 / 参数 / 字段必然要求改 `oamp/**`（web 路由与 CLI 选项面、SDK 命令表均在该目录）；
① 的清单不含 `oamp/**`（本表第 1~6 项 = 0）⇒ 本迭代未新增任何端点 / 参数 / 字段。
本项不另立重复条款：F13 验收 1 后半原文即将「不新增接口/字段/参数」的判据面定为「验收 1 的路径清单不含 `oamp/**`」。
```

**配置字段集合的边界（`architecture.md` §6「不新增」）**：`cluster.json` 的两处改动**只使用既有字段** `roles.<role>.model`（非新增字段）：

```
$ git -C <WS> diff main...iteration/0028-role-model-binding -- cluster.json
diff --git a/cluster.json b/cluster.json
index e1c7baf..b8f7af7 100644
--- a/cluster.json
+++ b/cluster.json
@@ -11,6 +11,7 @@
     "demand": {},
     "dev": {
       "enabled": true,
+      "model": "openai/gpt-5.6-luna",
       "tools": true,
       "permission": "allow",
       "cwd": "."
@@ -20,7 +21,7 @@
     "prd": {},
     "progress-observer": {},
     "retrospective": {},
-    "verifier": {},
+    "verifier": { "model": "powerby/grok-4.6" },
     "workflow-pb": {}
   }
 }
$ git -C <WS> diff main...iteration/0028-role-model-binding -- cluster.json | grep '^+' | grep -o '"model"' | wc -l
2                          # 两处新增行的字段名均为既有字段 `model`（非新增字段）
```
