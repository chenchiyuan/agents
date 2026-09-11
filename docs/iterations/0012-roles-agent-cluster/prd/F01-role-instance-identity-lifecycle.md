# F01：角色实例身份与生命周期（10 个 `pb-<role>`）

**功能 ID**: F01
**来源**: `demand.md` W1（D-2 + 仓库事实 F-2）、W2（G-1）、W7（G-4）；效果条款 E1（id 清单）、E2（web 可见 + 上下文延续）、E6；决策条款 D-2 / D-7 / TC-05
**迭代**: 0012-roles-agent-cluster

---

## 用户价值

10 个角色从"文档里的规则"变成**可寻址、可观察的常驻载体**：用户在拓扑里看得见每个角色、在 web 控制台 `@` 得到它们、聊得上、并且单独起一个或由集群脚本批量起都一样能用。

## 验收标准

1. **一角色一实例、命名可预期**：10 个角色各对应一个 agent 实例，instance_id = `pb-` + 角色名，完整清单为 `pb-architect`、`pb-demand`、`pb-dev`、`pb-planner`、`pb-pr-planner`、`pb-prd`、`pb-progress-observer`、`pb-retrospective`、`pb-verifier`、`pb-workflow-pb`；同一角色不存在第二个实例（id 无后缀）（W1 / TC-05）。
2. **非角色目录不建实例**：`roles/_template`（模板）与 `roles/cdp-debug-skill`（Claude skill）不产生任何实例（N2 / F-2）。
3. **实例形态 = 节点进程（非常驻 LLM 进程）**：角色实例是一个 oamp 节点进程——向 Router 注册、按周期发心跳、退出时注销；在没有对话发生时，进程列表中不存在归属于该实例的 LLM 子进程（LLM 子进程按 `(chat, agent)` 懒启动，沿用 0011）（W2 / M-3）。判定手段见 AR-03。
4. **单起可用（不依赖集群脚本）**：不经集群入口脚本、单独启动一个 `pb-<role>` 实例时，该实例同样完成注册且 `state=online`，并可被 web 控制台的 `@` 候选列表看见、可发起对话（W7 / G-4 / E2 首段）。
5. **实例纳入既有拓扑语义**：实例注册后，`oamp status` 能列出其 instance_id 与 online 状态；同一时刻可存在多个不同角色的实例（一次性起多个互不冲突）（W1 / E1）。
6. **离线判定沿用既有语义**：kill 某一角色实例进程后，`oamp status` 中该 id 在租约超时后变为 `offline`（沿用 0010 判活语义，不回退）（E6）。
7. **作为普通 agent 接入既有对话模型**：向某一角色实例提问可收到回答；同一对话的第二轮能引用第一轮内容（沿用 0011 同 chat 上下文，不回退）；不同对话之间互不串扰（E2 后半 / N10）。

## 边界（不包含）

- 不含角色规则的加载与生效——实例"叫什么、在不在线、能不能被 @ 到"是这张卡；"答的是不是该角色的话"是 F02。
- 不含默认模型与按角色覆盖（F03）、工具开关（F04）、permission 策略（F05）。
- 不含集群入口脚本与集群配置文件（F06）、按角色工作目录（F07）。
- 不做 Web 前端与协议改造——复用 0011 的控制台 / `@agent` 派发 / SSE / SQLite，本卡只要求新实例进入该模型（N10）。
- 不做集群调度 / 任务编排 / 负载均衡 / 自动派活——角色实例是被寻址的载体，不是自主调度者（N3）。
- 不做角色 agent 之间的直连通信 / 广播 / 新消息语义——一切经 Router（N8）。
- 不做角色上下文的持久化 / 跨对话长期记忆——上下文活在进程内，进程亡即失忆（N9）。
- 不做动态角色发现 / 运行期热重载（不自动扫 `roles/` 增删实例）（N11）。
- 不做跨机器部署 / 远程 Router / 容器化（N4）。
- 不做进程守护 / 崩溃自动重启 / 开机自启（N7）——本卡只要求"kill 后能正确判 offline"，不要求自愈。
- 不做鉴权 / 多用户（N5）。
- 不改 workflow-pb 的派发路径（N12）。

## 架构维度（阶段 3 已填，2026-09-11；详见 `architecture.md` §3.1 / §3.4 / §3.5）

- **AR-01 角色清单与 instance_id 的承载**：角色清单 = 仓库根 `cluster.json` 的 `roles` 键集合（配置驱动，脚本内不硬编码任何角色名；`_template` / `cdp-debug-skill` 因不在配置中而不产生实例 ⇒ 验收 2）。`instance_id = 'pb-' + role`，该公式**只存在于 `src/role-binding.js` 一处**（`instanceIdForRole` / `roleFromInstanceId`），**不提供覆盖字段**（一角色一实例、id 无后缀由公式保证，配置面不开放该缺口）。角色真源 = `<roleRoot>/roles/<role>/<role>.md`，`roleRoot` 缺省 = 仓库根，可由 env `OAMP_ROLE_ROOT` 覆盖（`cluster up` 按配置文件所在目录设置）。
- **AR-02 单起路径的参数面**：**复用** `oamp agent start <instance-id>`，新增 4 个**可选** flag：`--role <role>` / `--model <model>` / `--tools on|off` / `--permission allow|deny`（非法取值 → 退出码 2）。优先级：**flag > instance_id 推断 > 不绑定**；推断规则 = `^pb-(.+)$` 且角色文件存在 ⇒ 绑定该角色（启动行留痕 `source=instance_id`），否则为不绑定的匿名节点（行为与 0011 逐字节一致）。`cwd` **不设 flag**：工作目录 = 进程启动目录（由 tmux 窗口 `-c` 承载，见 F07 的 AR-19）。
- **AR-03 实例与 LLM 子进程的关联观察面**：取 `ps -axo pid,ppid,command`，从任一 `omp` 子进程沿父链上溯（跨过 `sh -c` / `tee` 管道壳，≤3 层），命令行含 `agent start <instance-id>` 的祖先即为其归属实例。验收 3 的判定 = 无对话时**不存在**归属该实例的 `omp acp` / `omp -p` 子进程；发一轮对话后归属子进程出现（LLM 子进程由上下文池按 `(chat, agent)` 懒创建，`CONTEXT_READY` / `CONTEXT_EVICTED` / `CONTEXT_RESET` 事件可交叉印证）。
