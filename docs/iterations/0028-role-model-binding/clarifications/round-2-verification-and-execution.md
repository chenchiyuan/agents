# 澄清记录 · 第 2 轮（验证强度与执行契约）

- **迭代**: 0028-role-model-binding
- **阶段**: 1（需求收敛，主 agent 内联执行）
- **时间**: 2026-09-15 20:50~20:55
- **caller**: demand

---

## 二轮决策（逐条标注来源）

| # | 决策点 | 结论 | 来源 |
|---|---|---|---|
| D-8 | 前置验证强度 | **双路径**：一次性（`omp -p`）+ 常驻（`omp-daemon`）各一次 | `user_confirmed` |
| D-9 | 探针证据落盘 | **不单独落盘**，仅作为 PR 验收标准（覆盖了主 agent 的 `clarifications/omp-backend-probe.md` 推荐） | `user_confirmed` |
| D-10 | 等价性判据 | `call_id` + 终态信封 + 转录可拼回全文；**无需人工搬运中间产物即可继续** | `user_confirmed` |
| D-11 | 差距记录格式 | `deferred-demand-changes.md` 内**二级标题分区** + 四要素（现象/差异/证据/影响） | `user_confirmed` |
| D-12 | 对照组证据 | dev + verifier 各一次 + **抽 1 个未绑定角色**作对照 | `user_confirmed` |
| D-13 | 实证集群 | 迭代工作区起**第二集群**（独立 session + 非默认端口 + 独立 socket），不动主工作区集群 | `user_confirmed` |

## 本轮自查的两条接口事实（作为 D-6 / D-13 的可行性依据）

1. **建 chat 无独立端点**：对话创建只发生在 `POST /api/messages`（新建时必带 `project_id`，`API.md:153/457`），而 `calls create` 强制要求已存在的 `chat_id`（`API.md:702`）。⇒ 单一 chat 只能由首条消息建立，且该消息必然伴随一次真实角色调用。
2. **第二集群天然不冲突**：默认 UDS socket 与集群日志均按**包根**推导（`src/config.js:144`、`src/cluster.js` 的 PKG_ROOT 基准）。从迭代工作区起集群会自动得到 `<迭代工作区>/oamp/.runtime/router.sock` 与独立日志目录，只需在第二份配置里指定独立 `session` 名与非默认 `web.port`。

## D-9 的语义留痕（供阶段 6 核查）

"不单独落盘"≠"无证据记录"。按 D-9，探针的命令与输出随**接收它的 PR 验收树**落盘（即写进该 PR 文件所引用的验收记录/阶段 6 报告），不再新建 `clarifications/omp-backend-probe.md`。阶段 6 核查探针时，应到相关 PR 的验收证据里找，而不是去 `clarifications/` 找探针文件。
