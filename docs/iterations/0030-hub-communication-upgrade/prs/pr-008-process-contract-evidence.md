# pr-008 · 过程契约与派发台账（F09）

## 上下文摘要

F09 是过程契约卡（不引入产品能力），其载体是**迭代产物的证据面**：建立派发台账（角色 / 用途 / 通道 / 子 agent 自报模型 / 终态五列，与 F08 验收 4 为同一张表）、brief 形态抽检记录、摩擦记录（既有 `deferred-demand-changes.md`，三要素齐、当场搭置、不回退不暂停）、以及阶段 6 并发证据以 **git 事实**取证的形态声明（worktree 落点 / 分支时间窗 / 提交交错，不要求 hub 调用记录）。本迭代派发通道 = **本地 subagent**（宿主 `task` 派发 + brief 全文注入），hub 在本迭代只作**被改造对象**与取证面。本 PR 不产出任何运行时代码，也不改任何既有格式规范。

## 涉及功能点

- F09

## 文件范围

- docs/iterations/0030-hub-communication-upgrade/dispatch-ledger.md（新建：派发台账，F08 验收 4 与 F09 验收 2 共用的那一张表）
- docs/iterations/0030-hub-communication-upgrade/evidence/f09-process-contract.md（新建：brief 抽检 + 阶段 6 取证形态声明）
- docs/iterations/0030-hub-communication-upgrade/deferred-demand-changes.md（摩擦记录追加；既有共享迭代文件，在此声明归属以避免多 PR 重复声明）

## 验收标准

- [ ] `dispatch-ledger.md` 存在且逐条含五列（角色 / 用途 / 通道 / 子 agent 自报模型 / 终态）；"通道"列取值均为"本地 subagent（宿主 `task` 派发）"，不存在"经 hub 派发"充当角色协作的条目
- [ ] `evidence/f09-process-contract.md` 含 ≥1 条 brief 抽检记录，判据两条齐（角色定义全文注入、工作区地址字段显式给出）
- [ ] `evidence/f09-process-contract.md` 含阶段 6 并发证据的形态声明：以 git 事实为主（worktree 落点 / 分支时间窗 / 提交交错），**不要求** hub 调用记录作证据
- [ ] `deferred-demand-changes.md` 中本迭代新增的每条摩擦记录三要素齐（问题 / 为什么判定为需求层面问题 / 本迭代如何处理）；不存在因搭置而暂停、回退或改需求的记录
- [ ] 本 PR 零运行时改动：文件范围内不含 `oamp/src/**`、`oamp/sdk/**`、`oamp/web/**`、`oamp/*.md`；`status.md` / `history.md` 的格式规范不被本 PR 改写

## 参考资料

- docs/iterations/0030-hub-communication-upgrade/prd/F09-process-contract-and-friction-log.md（验收 1~6）
- roles/workflow-pb/workflow-pb.md（§Brief 构建规则 / §阶段回退 / §文档路径协议）
- docs/iterations/0030-hub-communication-upgrade/history.md、status.md（既有过程面，本 PR 不改格式）

## depends_on

（无）

## batch

1
