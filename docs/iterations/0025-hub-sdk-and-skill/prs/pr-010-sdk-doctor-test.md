# pr-010：doctor 自检用例（F11/G01）

## 上下文摘要

落 `test/sdk-doctor.test.js`：核对 R1 正常 pass 且逐项给依据、制造漂移后由 pass 转 fail 并点名端点（注入 `API.md` 临时副本路径，不改仓库内 `API.md`）、连跑两次结论一致、探针前后 hub 状态零变化、端点分类全覆盖。漂移注入依赖 pr-003 的 `check({ apiDocPath })` 入参——本 PR 与 pr-003 的唯一接口契约。

## 涉及功能点

- F11
- G01

## 文件范围

- `oamp/test/sdk-doctor.test.js`（新建：R1 正常/漂移两态 + 稳定性 + 零写副作用 + 端点分类全覆盖 + 不可达降级）

## 验收标准

- [ ] R1 正常态：hub 运行中执行自检 → 逐项给出 `pass` 与依据（期望值 / 实际值），不出现"只报总结果"或"一片绿但说不出依据"的形态（F11 验收 1）
- [ ] 漂移态：以**注入 `API.md` 临时副本路径**的方式改掉一个端点路径（副本落系统临时目录，**不改动仓库内 `oamp/API.md`**）→ 重跑自检 → R1 该行由 `pass` 转 `fail` 并点名该端点、打印期望 / 实际（F11 验收 2 / E2 裸判据）
- [ ] 稳定性：同一状态下连跑两次，逐项结论一致（不出现随机 pass/fail）（F11 验收 4）
- [ ] 无写副作用：自检前后对照 hub 的可观察状态（对话清单、调用 roster、在途确认项）**零新增**；8 条 POST 端点与 4 条 SSE 端点未被探测（F11 验收 3 / MI-02、§5.5 端点分类）
- [ ] R3 探针零状态改变：8 个方法的存在性探针执行前后，注册表 / 任务表快照不变（F11 验收 3、architecture §9.3 A4）
- [ ] 端点分类全覆盖：21 条每条都有 `pass` / `fail` / `skip（附理由）`，无静默跳过项；R1 双向比对同时覆盖"登记缺失"与"文档未覆盖"两种方向（F11 验收 1/5、§5.5）
- [ ] hub 不可达时 R1/R2 降级为 F08 的统一错误（退出码 `3`），不半跑（F08 验收 1/2、§5.5）
- [ ] 不引入第二份接口定义：用例不得在测试侧硬编码端点清单作为比对真源，一切以 `oamp/API.md`（或其注入副本）为唯一基准（F11 验收 5、G01 验收 5）
- [ ] 用例经 pr-004 的 `oamp/test/helpers/hub-harness.js` 的 `runHub()` 执行 `hub doctor`、并经 pr-004 的 `oamp/sdk/index.js` 的 `hub.doctor.check({ apiDocPath })` 走库面；不写仓库内 `.runtime/` / `data/`（§10 T5）
- [ ] 用例经 `node --test test/*.test.js` 被拾取并通过（§10 T5 / T-07）

## 参考资料

- `docs/iterations/0025-hub-sdk-and-skill/prd/F11-doctor-contract-selfcheck.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/G01-hub-interface-unchanged.md`
- `docs/iterations/0025-hub-sdk-and-skill/prd/F08-disconnect-degradation.md`
- `docs/iterations/0025-hub-sdk-and-skill/architecture.md` §5.5（R1/R2/R3 判据与端点分类）、§5.1 层 B 表的"探测面"列（8 条探针）、§7 F11 行、§9.3 A4、§10 T5
- 代码锚点：`oamp/API.md:157-186`（§3 的 21 行，文档侧基准）、`oamp/src/web.js:1384`（`projectRoutes`，`GET /api/docs` 的运行侧来源）、`oamp/src/router.js:109-113`（`agent.register` 校验先于副作用）、`oamp/src/router.js:161-184`（`agent.heartbeat` 未注册静默）、`oamp/src/router.js:186-199` / `:201-204` / `:348-351`（`UNREGISTERED` 路径）、`oamp/test/api-routes.test.js:250`（`<...>` → `:` 归一手法）

## depends_on

- pr-004-sdk-dual-entry-and-hub-harness.md（理由：R2/R3 与 CLI 面经 pr-004 新建的 `oamp/bin/hub.js` 与 `oamp/test/helpers/hub-harness.js` 的 `runHub()` 执行 `hub doctor`；库面 `hub.doctor.check()` 经 pr-004 新建的 `oamp/sdk/index.js` 的 `doctor` 命名空间——证据：`architecture.md` §10 T5 与 §4.1 N-2）
- pr-003-sdk-entry-surface-cli-and-doctor.md（理由：本用例的漂移注入依赖 pr-003 在 `oamp/sdk/doctor.js` 落定的 `check({ apiDocPath })` **显式入参**——该入参是本 PR 与 pr-003 之间的跨 PR 接口契约（§10 T5「以注入 `API.md` 路径的方式制造漂移」）；若无此入参，本用例只能改写 `oamp/sdk/doctor.js`，将与 pr-003 的「文件范围」重叠）

## batch

4
