# F11：闭环产物契约——结构化证据 + 截图 + 结论

## 功能 ID
F11

## 来源
`demand.md` W3（开发/验证/测试闭环的产物契约）、需求结论 §4 裸判定第 3 条（一轮真实页面任务产出三类产物路径可查、无人工干预）；边界关联 N1/N6/C-4。

## 用户价值
一次页面调试调用即产出**可被下游消费的闭环产物**（结构化页面证据 + 截图 + 通过/失败/阻塞结论），使本仓库内 reviewer/verifier/testing 或宿主 QA 可直接复验——skill 不退化为零散命令集，闭环成立。

## 验收标准
- [ ] SKILL.md 定义产物协议契约（F02 协议先行的具体内容）：一次任务产出三类产物——
  1. **结构化页面证据**：数据优先（snapshot/console/网络/性能等结构化数据，非截图优先）
  2. **截图**：视觉与人类归档用途
  3. **结论**：通过 / 失败 / 阻塞 三态之一，附证据依据（F10 未配置路径产出"阻塞"结论；F07 断言产出通过/失败；F08 诊断证据支撑结论）
- [ ] §4 裸判定第 3 条：任取一个真实前端页面任务（本地 dev server 或已部署 URL——N6：不独占绑定单一迭代产物），按 skill 执行一轮，三类产物**均产出且路径可查**，全程无需人工介入页面操作
- [ ] 产物结构与结论风格**对齐既有 pb-v1 生态约定（findings/verify 风格）**，且文档明示"仅格式参考，不构成对 powerby 跨仓技能的任何引用/依赖"（C-4/N6）
- [ ] 产物协议与 pb-v1-brower 的 review/verify/iterate 报告协议**不重合**（N1；分工见 F12——本 skill 产物是调试闭环证据，pb-v1-brower 产物是评审协议）

## 边界（不包含）
- 不包含三类产物的确切字段/schema、落盘路径与命名（`[架构待填]`，阶段 3 按 pb-v1 findings/verify 风格对齐设计）
- 不替代 pb-v1-brower 的 review/verify/iterate 报告协议与"只观察不改码"职责（N1）
- 不引入对 powerby 跨仓技能的任何引用/依赖（C-4/N6——仅格式参考）
- 不绑定本仓库某单一迭代产物页面作为唯一调试对象（N6）
- 不做测试框架/CI 集成输出（N2）

## 架构维度

> **阶段 3 补全（architecture.md 决策 D6）**：
> - **落盘位置**：`artifact_root` = 调用方注入的 Workflow 输入参数（skill 不预设固定落点；缺省拒绝执行并提示）。"路径可查"（§4 裸判定 3）= 任务结束返回 artifact_root 绝对路径 + 产物清单。常规任务建议 `docs/iterations/<迭代ID>/cdp/`；登录态/含凭据任务先落 `$CDP_DEBUG_HOME/runs/<run-id>/`（git 外，D3），经脱敏复核（sanitized=true）后才允许复制入库路径。
> - **目录与命名**（对齐 pb-v1 风格仅格式参考，E10）：`session.md`（任务元信息）+ `evidence.json`（结构化页面证据，数据优先）+ `screenshot-*.png`（截图，断言失败/终态各 ≥1 按需多张）+ 可选 `perf-trace.json`/heap 文件（大体积独立落盘，evidence 内引用）+ `result.json`（三态结论，机器可读主入口）。
> - **schema**：evidence.json = {schema_version, target{url,title,captured_at}, console{errors,warnings,messages}, network{failed_requests,summary}, page{snapshot_path,assertions}, performance{trace_path,summary}, memory{heap_path,summary}}；result.json = {schema_version, status: passed|failed|blocked, task, url, chains_used[], artifact_root, evidence_refs[], summary, blocked_reason: null|mcp_unconfigured|chromium_not_ready|login_required|shared_instance_not_configured|target_error, next_step, sanitized}。完整 schema 进 SKILL.md Output format（协议先行，F02）。
> - **与 pb-v1-brower 不重合**（N1）：无 round/severity/findings 评审语义；文档明示仅格式参考、不构成对 powerby 跨仓技能引用/依赖（C-4/N6）。
