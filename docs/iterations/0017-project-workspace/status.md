# 工作流进度

**工作流**: workflow-pb v0.8.0
**迭代**: 0017-project-workspace
**当前阶段**: PR 实现（阶段 5）
**迭代分支**: iteration/0017-project-workspace
**状态**: 进行中
**history**: 开启

## 阶段状态

| # | 阶段 | 完成 | 已验证 | 备注 |
|---|---|---|---|---|
| 1 | 需求收敛 | ✅ | ⬜ | demand.md v1.1.0 已收敛；P-1~P-11 全部经用户裁决 |
| 2 | 功能规格 | ✅ | ⬜ | prd.md + 10 张卡；MI-01~MI-08 全部经用户裁决「按推荐」并落卡 |
| 3 | 技术架构 | ✅ | ⬜ | architecture.md；L1 决策 0 条；T-01~T-15 全填；D-01~D-04 由主 agent 裁定 |
| 4 | PR 规划 | ✅ | ✅ | 4 份 PR 文件；Gate 独立验证 PASS |
| 5 | PR 实现 | ⏸ | ⬜ | 3/4 PR 已合并进迭代分支（pr-001、pr-002、pr-003）；pr-004 任务图已产出，dev 执行中 |
| 6 | 独立验证 | ⏸ | — | Gate（阶段 4→5 入口）已完成并 PASS；阶段 5 全部合并后触发最终验证，届时置 ✅ |

## PR 实现子状态（阶段 5 展开）

| PR 文件 | depends_on | 状态 | worktree 分支 | 已合并 | 槛位状态 |
|---|---|---|---|---|---|
| pr-001-project-context-injection.md | （无） | ✅ | (已清理) | ✅ 9e1f4d4 | 已释放 |
| pr-002-project-data-and-http.md | pr-001 | ✅ | (已清理) | ✅ 0d726f2 | 已释放 |
| pr-003-project-layer-ui.md | （无） | ✅ | (已清理) | ✅ a9fef01 | 已释放 |
| pr-004-project-workspace-acceptance.md | pr-001, pr-002, pr-003 | ⏸ | feat/pr-004 | ⬜ | 占用 |

## 并发配置（阶段 5）

**起始并发数**: 3
**硬上限**: 5（公式 `2×起始-1`）
**当前有效上限**: 5（按公式 `min(3 + 3×3, 5)` 重算）
**累计槛位释放次数**: 3
**已派发总数**: 4

> 本迭代存在**真实并发分支**（首波 pr-001 ∥ pr-003 同时执行并通过各自验收）→ 阶段 6 必须核查「并发调度真实执行证据」三项。

## 待确认项

- （无用户待确认项）
- **已知偏差（下一迭代候选，主 agent 裁定不返工）**：
  - A-1：`POST /api/projects` 路由元数据 `errors` 缺 `PAYLOAD_TOO_LARGE`（handler 实际可达 413；`API.md §3.13` 已列）
  - A-7：`/api/chats` 与 `/api/messages` 的 `params` 未登记 `project_id`（实现遵从 architecture §6.1「既有 11 条内文逐字不动」）⇒ 文档页与调试台无法呈现/填写该必填参数
  - pr-003 的 3 项 partial（服务端依赖面）须在 pr-002 落地后补验

## 用户确认记录（Gate）

- **P-1~P-11**（阶段 1）：P-4 = payload 结构化 project 字段 + agent 侧注入；P-4 备注 = 不承诺「agent 自动在项目根目录工作」；P-5 = 启动时删库重建 + `project_id NOT NULL`；P-2 = 强绑（API 层强制）；其余 8 条按推荐采纳。
- **MI-01~MI-08**（阶段 2）：错误码一律 400 且不做地址形态校验；最近活动时间取对话更新、对话数含全部；建项目后停留列表页 / 顶栏只显示项目名 / 工作台内新建自动归属。
- **D-01~D-04**（阶段 3，主 agent 裁定）：三类额外必然变更登记为「项目维度必然变更面」；旧库重建打印一行 stdout；同步 `API.md` §5 示例与 `README.md` HTTP 表；一次性路径 argv 末位注入前缀。
- **planner 提请的推断**（阶段 5，主 agent 裁定）：pr-001 侧 5 条（合法 `project` 判据 / 证据边界 / `main.layout` 预置 `hidden` / CSS 复用变量 / 静默 try/catch）；pr-002 侧 6 条（M1~M6：stdout 形态 / trim 与 name 派生落点 / name 归一 / 既有对话 project 取值 / API.md §3.2·§3.8 补行 / 测试 fixture 落点）。
- **dev 提请**（阶段 5，主 agent 裁定）：接受 `fmtAgo(... ?? undefined)` 归一手法；接受 `showProjectList()` 路径双次取数。

## 更新日志

- 2026-09-12: 迭代启动（项目层）。前置：0016-api-reflection-docs 已合并 main（251/251）。
- 2026-09-12: 阶段 1 通过（demand.md v1.1.0）→ 创建迭代分支。
- 2026-09-12: 阶段 2 通过（prd.md + 10 张卡）；阶段 3 通过（architecture.md，L1 = 0）；阶段 4 通过 + Gate 独立验证 PASS。
- 2026-09-12: 首波并发 pr-001 ∥ pr-003 → 双双 PR 级验收 PASS → 合并（9e1f4d4 / a9fef01），全量 251/251 → 解锁 pr-002。
- 2026-09-12: pr-002 实现（f97cff3）→ 验收 PASS（偏差 7 条留痕）→ 合并（0d726f2），全量 251/251 → 解锁 pr-004 并派发。
