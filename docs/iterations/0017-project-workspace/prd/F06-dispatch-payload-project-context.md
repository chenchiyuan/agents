# F06：派发载荷携带项目上下文（载体与路径范围）

**功能 ID**: F06
**来源**: `demand.md` W4（载体层）；决策 D-1 / D-2 / P-4；约束 C-2 / C-4 / C-7（必然变更点：派发载荷）；边界 N2 / N3 / N8 / N9 / N10；效果 E5 / E7 / E9
**迭代**: 0017-project-workspace
**技术锚点（引用 `demand.md` §3 只读实测，非本阶段决策）**: F-9（派发载荷无任何项目 / 仓库字段：常驻路径 = `{executor, chat_id, prompt, model?, timeout_ms?}`，一次性路径 = `{executor, prompt, model?, tools?, timeout_ms?}`，shell 路径 = `{command, args?, timeout_ms?, label?}`）、F-15（协议方法面 7 个）、F-10（常驻上下文键 = 对话 × agent）

---

## 用户价值

每次派活给 agent，任务里都带着"这是哪个项目、仓库在哪"；同时用户自己发的消息原文不会被塞进一堆系统前缀，历史记录保持干净。

## 验收标准

1. **结构化项目字段**（W4 / P-4）：派发给 agent 的任务载荷携带一个**结构化的项目上下文**（含项目名、仓库地址、工作约定），而不是把这段文字拼进用户消息正文。
2. **两条 LLM 路径都携带**（W4）：常驻（`omp-daemon`）与一次性（`omp`）两条路径的任务载荷均携带该字段。
   *判定*：分别经两条路径派发一次，检查 agent 侧任务载荷（E5 的判定载体）。
3. **shell 路径不携带**（W4）：以 `!` 开头走 shell 命令的路径，其载荷不携带项目上下文。
   *判定*：发一条 shell 消息 → 其载荷无项目字段，且该路径既有行为不变（N13）。
4. **用户原文不被污染**（W4 / E9）：对话库中该条消息的正文 = 用户输入的**原文**，不含项目名 / 仓库地址 / 工作约定前缀。
   *判定*：用 sqlite 查该行正文，与输入逐字对比。
5. **不改协议方法面**（N8 / E7）：agent↔router 的方法面仍为既有 7 个，无新增 / 无删除；项目信息只进消息载荷的**内容层**。
6. **不改上下文池的键与串并发语义**（N9）：上下文隔离粒度仍是"对话 × agent"——同一对话同一 agent 仍串行、不同键仍并发。
   *判定*：既有上下文池行为（同键串行 / 异键并发）探针结果不变。

## 边界（不包含）

- 不含上下文**内容**写什么、注入到哪一层（→ F07）。
- **不做 web / hub 侧的 clone、项目目录探测或目录创建**（N2 / C-2）。
- **不在载荷与上下文里出现本地路径**（N3）。
- **不改协议方法面**（N8）、**不改上下文池语义**（N9）、**不改角色加载路径 / 不引入 `.pb-agents` 安装机制**（N10）。
- **不承诺"agent 自动在项目根目录工作"**（N14 / C-4）。
- 不含 shell 路径既有语义的变更（N13）。
- 不含 `messages.text` 之外的既有消息字段语义变更。

## 架构落地（阶段 3 已填，见 `architecture.md` §4.1 / §4.2；产品维度未改一字）

- **T-08 字段形态**：`payload.body.project = { name, repo_url, agreement }`——三要素 = 项目名 + 仓库地址 + 一段相对工作约定文本（F06 验收 1）；**不带** `project_id`、**不带**任何本地路径；键名沿用既有载荷的 snake_case 体例。**可选字段**：缺失 / 非对象 / 字段不合法 ⇒ 一律视为"未携带"，**不拒收任务**（体例同既有 `label`：`typeof body.label === 'string' ? label : null`）⇒ 直投 payload 的既有测试零改动，且"未携带即不注入"这条向后兼容性有测试证据。
- **两条 LLM 路径的装配点（既有 `web.js` 的 `/api/messages` payloadBody 处）**：一次性分支 = `{executor:'omp', prompt, label, model?, project}`；常驻分支 = `{executor:'omp-daemon', chat_id, prompt, label, model?, project}`。`project` 一处在两个 LLM 分支共用同一对象（项目名 / 地址 / 约定文本来自本次请求解析出的项目行）。**shell 分支载荷逐字不变**（验收 3 / N13）——`{command:'/bin/sh', args:['-c', …], label}` 不含 `project`。
- **T-04 注入点的模块归属**：web **只产出结构化字段**，注入文本的渲染与施加**全在 agent 侧**——`agent.js` 渲染 `【项目上下文】` 块、用于一次性路径（`runOmpTask` 的 `omp -p` prompt 参数前缀）；常驻路径把块随轮次下传，由 `context-pool.js` 的 `ContextSession` 在**该会话首个成功送达轮次**注入（`sentTurns === 0` 判据，仅成功送达才消费名额）。⇒ 验收 4（原文不被污染、"不由 web 拼进正文"）由"web 不产生注入文本"结构性保证。
- **协议面与上下文池**：`project` 只走 `task.request` 的 `payload.body` **内容层**（方法面仍 7 个 ⇒ 验收 5 / E7）；上下文池的**键、FIFO 串行、队列上限 8、LRU、并发语义零变化**，仅增"会话内已送达轮次"一个只增不减的计数（验收 6 / N9）。
- **验收 2 的判定载体（零新增机制）**：一次性路径 = `FAKE_ACP_ARGS_LOG` 记录的 argv 末位含 `repo_url`；常驻路径 = fake ACP 回显的 `session/prompt` 文本（`收到：<prompt>`）⇒ `out.text` 含 `repo_url`；载荷本体含 `project.repo_url`（web→agent 的 `task.request` 可捕）。
- 既有观测面零变化：`task.label` / `logger.event('TASK_STARTED')` / `task.update` 的 `prompt` 摘要**均保持用户原文**（不把项目块带进 SSE 增量或 label）。
