# pr-003：一次性后端可用性回执（F01）

## 上下文摘要

把阶段 1 已实测的三条一次性路径回执（deepseek 默认 / gpt / grok）落成可核对证据：每条含完整命令与原始输出（含观测结果），命令为 omp 一次性路径（`-p` 且 `--no-session`；不出现 `hub`、不出现 `api messages` / `calls create`），三条除 `--model` 取值外逐字相同——即三个后端在同一路径、同一形态下被比较。耗时如实记录但不入判据（MI-1）。本 PR 只做回执落盘，不做常驻路径探针（F02 / pr-004）、不判定后端质量，失败者按验收 3 如实记失败并交 F12（pr-007）。

## 涉及功能点

- F01

## 文件范围

- `docs/iterations/0028-role-model-binding/prs/pr-003-one-shot-backend-receipts.md`（本 PR 文件：写入三条回执的「验收证据」小节；不新建独立探针文件）

## 验收标准

- [ ] 「验收证据」小节含 **3 条**一次性路径回执，分别对应 deepseek（默认）/ gpt / grok，每条含五字段：`命令` / `原始输出` / `观测结果` / `时点` / `耗时`（字段名逐字照录，见 `architecture.md` §4 A-02）
- [ ] 3 条回执的 `命令` 均为一次性路径形态：命令文本含 `-p` 与 `--no-session`，且**不出现** `hub`、`api messages`、`calls create`
- [ ] 3 条回执的 `命令` 除 `--model` 取值外逐字相同（同路径、同形态的可比性判据）
- [ ] 3 条 `原始输出` 为原文照录（含观测结果），`观测结果` 标注 成功｜失败 + 现象；`耗时` 如实记录但**不作为判据**
- [ ] 有任一条后端失败时：该条如实记为失败（不隐藏、不用另一次成功替代），并在本 PR 证据小节登记"待 F12 收录"（差距条目由 pr-007 写入 `deferred-demand-changes.md`）
- [ ] 不新建独立探针文件、不写 `status.md`、不写 `clarifications/**`（F01 验收 4 / D-9）
- [ ] 不因某个后端失败而改动 `cluster.json` 的绑定取值（绑定由 pr-002 承担）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F01-one-shot-backend-receipts.md`（验收 1~5、边界、架构维度 A-02）
- `docs/iterations/0028-role-model-binding/architecture.md` §4 A-02（证据载体与 F01 五字段形态）、§0（"不新建独立探针文件"）
- `docs/iterations/0028-role-model-binding/deferred-demand-changes.md` §澄清期登记的冲突 C-1（deepseek 默认 id 靠 fuzzy 解析的既有事实，含一次性探针 `deepseek/deepseek-v4-flash:high` → `OK` 2.3s）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：三条回执，逐条一个三级标题条目，字段名逐字为 `命令` / `原始输出` / `观测结果` / `时点` / `耗时`）

### deepseek（默认）回执

**命令**

```sh
omp -p --no-session --model deepseek/deepseek-v4-flash:high "只回复: OK"
```

**原始输出**

```text
[stdout]
OK
[stderr]
Working...
```

**观测结果**

成功：stdout 返回预期文本 `OK`，exit=0；stderr 原文为 `Working...`。

**时点**

2026-09-15T23:11:02+0800

**耗时**

1.90 s（如实记录，不入判据）

### gpt 回执

**命令**

```sh
omp -p --no-session --model openai/gpt-5.6-luna "只回复: OK"
```

**原始输出**

```text
[stdout]
OK
[stderr]
Working...
```

**观测结果**

成功：stdout 返回预期文本 `OK`，exit=0；stderr 原文为 `Working...`。

**时点**

2026-09-15T23:11:12+0800

**耗时**

5.08 s（如实记录，不入判据）

### grok 回执

**命令**

```sh
omp -p --no-session --model powerby/grok-4.6 "只回复: OK"
```

**原始输出**

```text
[stdout]
OK
[stderr]
Working...
```

**观测结果**

成功：stdout 返回预期文本 `OK`，exit=0；stderr 原文为 `Working...`。

**时点**

2026-09-15T23:11:24+0800

**耗时**

3.98 s（如实记录，不入判据）

三条回执均成功；无待 F12 收录事项。
