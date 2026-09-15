# pr-005：`hub` skill 文本与内容核对（F12/F13/G03）

## 上下文摘要

落 `oamp/skill/hub.md`（单文件自包含）与其机械核对用例：三段式（何时用 / 怎么用 / 红线）+ 只到子命令名 的三层清单 + 4 条典型序列 + 入口定位模板。约束：不复制参数表与字段 schema（真源仍是 `API.md`）、不建副本与转发、落点必须在 `oamp/` 内。本 PR 无依赖：文件与被调用代码之间无 import / 符号引用边，其子命令名与两个入口路径已在 §5.1 / §5.6 定稿。

## 涉及功能点

- F12
- F13
- G03

## 文件范围

- `oamp/skill/hub.md`（新建：三段式内容 + 三层子命令清单 + 4 条典型序列 + 入口定位模板）
- `oamp/test/sdk-skill.test.js`（新建：对该文件文本的机械核对用例）

## 验收标准

- [ ] 文件位于 `oamp/skill/hub.md`，**单文件自包含**：消费方仅读该文件即可照做，不需要任何外部上下文（F12 验收 1、T-05）
- [ ] 三段式标题齐备且各自成段：① 何时用 ② 怎么用 ③ 红线（F12 验收 2）
- [ ] "何时用"给出可判定触发条件（派发角色任务 / 取调用终态 / 取过程记录 / 订阅事件 / 盘点实例状态 / 走既有运维命令），不出现"需要与 hub 交互时用它"式不可判定表述（F12 验收 3）
- [ ] "怎么用"= 只到子命令名 的三层清单（`api` 21 / `uds` 8 / `cli` 11，逐条与 §5.1 的 40 条入口表名面一致）；`doctor` 单列并标注"自检（不属于三层封装）"（F12 验收 4、F14 验收 1/3、P-4 口径）
- [ ] 4 条典型序列齐备且各给可照做的命令顺序：派发→取终态 / 截断恢复 / 事件订阅 / 状态盘点（F12 验收 4）
- [ ] "截断恢复"是**序列**不是命令：由 `api calls get <call_id>` + `api calls transcript <call_id>` 组合表达；清单中无"一步恢复全文"专用命令，也不宣称 SDK 代做重建（F12 验收 5、W3 / C-A）
- [ ] 红线三条齐备：① 不裸写 HTTP（应经 SDK）② 不复制 schema（参数与字段以 `API.md` 为准）③ 退出码语义 `0/1/2/3`（F12 验收 6）
- [ ] 正文不含参数表、字段定义清单、端点路径表（F12 验收 7 / N8）
- [ ] 入口定位模板形态正确：`node "<项目根>/oamp/bin/hub.js" <层> <子命令> [选项]` 与库面 `await import('<项目根>/oamp/sdk/index.js')`；项目根由调用方自行解析（F13 验收 1）
- [ ] 模板约束自检：正文检索不到 `/Users/...`、`/home/...` 一类本机路径字面量；不含 `cd` 前置；定位段不出现 `~` 与环境变量前置（F13 验收 1/3/4）
- [ ] 4 条序列全程零手写 HTTP：清单里不出现 `curl`、socket 手写、自建 HTTP 客户端（F12 验收 4、E1 裸判据）
- [ ] 本 PR 的改动面不含 `roles/**`、`tools/**`、`.claude/skills/**`（不新增副本、不新增转发文件、不修改任何既有 skill）（G03 验收 1/2/3/4）
- [ ] `oamp/test/sdk-skill.test.js` 机械核对：三段标题齐备 / 4 条序列标题齐备 / 无参数表与字段清单特征 / 无本机路径字面量与 `cd` 前置；该用例只读 `oamp/skill/hub.md` 文本，不 import SDK（F12 验收 2/6/7、F13 验收 1/4）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T6 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F12-hub-skill-three-sections.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F13-skill-sdk-entry-addressing.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/G03-roles-and-distribution-untouched.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §4.1 N-9 / N-10、§4.4 顺序约束 5、§5.1（40 条入口表，序列组合的素材）、§5.6（T-05 / T-06 与入口定位模板）、§10 T6
- `docs/iterations/0021-confirmation-inbox-and-event-push/clarifications/hub-execution-log.md`（4 条序列的来源现场，只读）
- 代码/仓库锚点：`oamp/package.json`（`private` 包，无全局安装形态 ⇒ 模板必须用绝对路径）、`oamp/API.md`（schema 真源，skill 不得复制）、`.claude/skills/`（既有 skill 落点，本 PR 不得触碰）

## depends_on

（无）

> 说明（为什么不写依赖）：`oamp/skill/hub.md` 是文本文件，它与其所描述的代码之间**不存在代码级引用边**（无 import、无共享符号、无构建产物组装关系）——本角色只采信代码级证据，不把叙述顺序当依赖。它引用的 40 条子命令名与两个入口路径**已在 `architecture.md` §5.1 / §5.6 定稿**（T-01 / T-05 / T-06 落定），因此编写与核对都不需要等待任何代码 PR 合并；`test/sdk-skill.test.js` 也只读该文件文本。`architecture.md` §4.4 顺序约束 5 的「skill 排在入口表之后」是**叙述性排序**，不是可核实的引用边，故不落成 `depends_on`（若主 agent 出于迭代内的一致性考虑要人工延后派发，属调度选择，不改变本 PR 的依赖图）。

## batch

3
