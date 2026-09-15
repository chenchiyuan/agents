# pr-002：阶段 5 输出契约去掉测试产出（F02）

## 上下文摘要

`roles/workflow-pb/workflow-pb.md:56`（阶段定义表阶段 5 行）的「输出」列去掉「+ 通过验证标准的测试」，改为「… + 代码」。改动面被物理锁死在这一行内：不新增解释性章节、不改推进条件列、不动阶段 2~4 与阶段 6、不升版本号、不追 `data/workflow-pb-changelog.md`（Q16 不留痕）。改后工作流不再向 `dev` 要求测试产出，与 `roles/dev/dev.md:107`（不写测试用例）/ `:110`（不跑全量测试套件）的现行规则一致。`data/` 两份子协议、`roles/verifier/verifier.md`、`.claude/skills/workflow-pb/SKILL.md` 均零改动——后者已一手核实全文对「测试」/「test」零命中，不存在需要同步的第二份拷贝。

## 涉及功能点

- F02

## 文件范围

- `roles/workflow-pb/workflow-pb.md`（修改：`:56` 一行内删字——输出列去掉「+ 通过验证标准的测试」；该行其余单元格逐字不变）

## 验收标准

- [ ] `grep -n "通过验证标准的测试" roles/workflow-pb/workflow-pb.md` 零命中；`:56` 的输出列读作「`prs/pr-{NNN}-tasks.md`（该 PR 内部任务列表，供 dev 消费）+ 代码」
- [ ] 同一行其余内容逐字不变：输出列仍含 `prs/pr-{NNN}-tasks.md`；推进条件列仍为「该 PR 验收标准全部通过；无简报外改动；对应 PR 文件存在（合并前置）」
- [ ] `git diff roles/workflow-pb/workflow-pb.md` 只出现这一行（无第 2 行改动、无新增/改写章节、无版本号变更）
- [ ] 阶段 2~4、阶段 6 对应行的输出列与推进条件列零改动
- [ ] `roles/dev/dev.md`、`roles/verifier/verifier.md`、`roles/workflow-pb/data/**`、`.claude/skills/workflow-pb/SKILL.md`、`docs/iterations/**`（历史引文）零改动（`git diff --name-only` 不含这些路径）

## 参考资料

- `docs/iterations/0026-test-protocol-and-suite-reset/prd/F02-stage5-output-contract-drop-tests.md`（验收 1~4）
- `docs/iterations/0026-test-protocol-and-suite-reset/architecture.md` §1.1（`:56` 为唯一改动对象）、§3.1 ②、§6.2-2（Q16：本迭代零版本动作，不追 changelog）
- 代码基线锚点（一手核实）：`roles/workflow-pb/workflow-pb.md:56` 现状全文（「… | `prs/pr-{NNN}-tasks.md`（该 PR 内部任务列表，供 dev 消费）+ 代码 + 通过验证标准的测试 | 该 PR 验收标准全部通过；无简报外改动；对应 PR 文件存在（合并前置） |」）
- 一致性对照（只读核实，非本 PR 改动面）：`roles/dev/dev.md:107` / `:110`；`.claude/skills/workflow-pb/SKILL.md`（全文「测试」/「test」零命中）

## depends_on

（无）

## batch

1
