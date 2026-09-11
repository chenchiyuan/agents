# F06：集群入口脚本与配置（tmux + up/down/status + 日志落盘）

**功能 ID**: F06
**来源**: `demand.md` W6（D-3 / TC-04 / TC-07）、W7（批量入口）；效果条款 E1、E7；仓库事实 F-9 / V-8；决策条款 D-5 / D-7；验收 1 判定面经用户确认（M-03，2026-09-11）
**迭代**: 0012-roles-agent-cluster

---

## 用户价值

一条命令把 Router、Web 和 10 个角色一次拉起来；一个 tmux session 里**肉眼看到每个角色在干什么**，日志同时落盘供事后追溯；收口一条命令干净退出，不留残留进程。

## 验收标准

1. **配置驱动、不硬编码**：角色清单（含每角色启用开关）与各角色参数来自集群配置文件，脚本内不硬编码角色清单——在配置中增删一个角色后重启集群，实例集合随之增减而脚本无需改动（W6）`[user_confirmed]`（M-03，2026-09-11 用户确认）。
2. **一条命令拉起全量**：执行集群启动入口后，`oamp status` 中同时存在 10 个 `pb-*` 实例且 `state=online`（E1）；Router 与 Web 服务一同起（Web 默认入口 `http://127.0.0.1:7788`，E2 的入口）（W6）。
3. **tmux 一个 session 可视**：启动后 `tmux ls` 能看到该集群 session；`tmux attach` 后各窗口/pane 分别呈现 Router / Web / 各 `pb-*` 角色的实时输出，用户可实时观察各角色（E7 前半 / D-5）。
4. **三个动作 up / down / status**：脚本提供 `up`、`down`、`status` 三个动作（D-3）；`status` 汇总当前集群各进程状态，使用户不必翻日志就能判断集群现状（输出形态见 AR-13）。
5. **收口干净无残留**：执行停止入口后 `tmux ls` 中该 session 消失，且 `ps` 中不存在本次集群的 Router / Web / 角色 agent 残留进程（E7 中段）。
6. **日志落盘且不入 git**：Router、Web 与每个角色 agent 每进程至少一份落盘日志，角色 agent 的日志含启动行与停止行；日志目录未被 git 跟踪（`git check-ignore` 命中实际日志产物）（W6 / E7 后半 / F-9）。
7. **配置纳入 git、零凭据**：集群配置文件是仓库产物（可提交，非 gitignored 的本地私产），且不含任何凭据类字段（token / secret / password / api_key 等）（TC-07 / N5 / F-9）。
8. **批量入口不排他**：集群脚本是批量入口而非唯一入口——脚本存在（或运行）期间，不经脚本单独启动一个角色实例仍然可用（W7；判定见 F01 验收 4）。

## 边界（不包含）

- 不做集群调度 / 任务编排 / 负载均衡 / 自动派活——脚本只负责进程生命周期（N3）。脚本不决定谁给谁派活（C-6）。
- 不做系统级进程守护 / 崩溃自动重启 / 开机自启（launchd / systemd / pm2）——tmux session 只提供可 attach 的可视前台，异常退出后由人工或脚本重新 `up`（N7）。
- 不做动态角色发现 / 运行期热重载（不自动扫 `roles/` 增删实例；配置声明 + 重启生效）（N11）。
- 不做跨机器部署 / 远程 Router / 容器化（N4）。
- 不做鉴权 / 多用户 / 凭据管理（N5）。
- 不含按角色 `cwd` 的配置语义与生效判定（F07）——本卡负责把该字段经配置传给角色进程。
- 不含角色规则注入机制（F02）、模型语义（F03）、工具开关语义（F04）、permission 语义（F05）——本卡只负责把它们经配置传下去并管理进程生命周期。
- 不含 `up` 重复执行的幂等/报错语义、`down` 的优雅停止序列（属 AR-16 的架构决策，本卡只锁验收 5 的"无残留"效果）。

## 架构维度（阶段 3 已填，2026-09-11；详见 `architecture.md` §5.1~§5.6）

- **AR-12 配置文件的路径 / 格式 / 落点 / 关系**：**仓库根 `cluster.json`**（本仓库 = `agents/cluster.json`）——集群描述的是"本仓库的角色拓扑"，其角色真源 `roles/` 与全体角色的缺省 cwd（仓库根）都在同一层；JSON、**纳入 git**、**零凭据字段**（加载器递归扫描键名 `token/secret/password/api_key/apikey/credential`（大小写不敏感）→ 命中即失败退出 2，把验收 7 从"承诺"变成**结构性校验**）；`--config <path>` / env `OAMP_CLUSTER_CONFIG` 可覆盖，缺省 = 包根的上级目录。**与 `oamp/config.json` 互不合并、互不读取**：后者回答"**单个进程**怎么跑"（库路径 / 全局默认模型 / 上下文上限），前者回答"**一组进程**怎么编排"（角色清单 / 每角色参数 / web 端口 / session 名），消费方只有 `oamp cluster *`（角色参数再以 flag 形式传给 agent）。
- **AR-13 脚本形态与三动作契约**：**新增 `oamp cluster up|down|status` 子命令**（`src/cluster.js` + `cli.js` 一行分发 + USAGE 一行）；否决独立脚本（不可发现、多一个入口概念）。**up**：读配置 + 全量校验 → `tmux -V` 探活（缺失退出 2）→ `has-session` 命中则幂等退出 0 → 建 session（router 窗，`-c <root>`）→ 等 Router socket 就绪 → 建 web 与各角色窗 → 等全部 enabled 实例 `online`（≤ `--wait`，缺省 20000ms）→ 打印 session 名 / attach 命令 / 日志目录 / 拓扑表；全部 online ⇒ 退出 0，否则非 0 并提示看哪个窗口或日志。**down**：无 session ⇒ 退出 0 → 采集本次 session 的 pane pid → 逐窗口 `tmux send-keys C-c`（SIGINT 触发 Router 打 `ROUTER_STOPPING` 并 unlink socket、agent 打 `DEREGISTERED` 并注销）→ 等这些进程子树消失（≤10s）→ `tmux kill-session` → **残留检查**（有存活 pid ⇒ SIGKILL 兜底 + 非 0 退出）。**status**（只读）：session 是否存在 + 窗口清单（`#{window_name} #{pane_current_path} #{pane_dead}`）+ 复用 `renderTable(queryNodes())` 的 Router 拓扑表 + 日志目录与各文件大小 + 逐角色对齐（instance / 窗口 / online / cwd / 日志路径）；Router 不可达 ⇒ 明确报错段 + 退出 1（不静默冒充成功，沿用 `status.js` 失败风格）。
- **AR-14 tmux session 名 / 窗口组织 / attach 提示**：session 名 = 配置 `session`（缺省 **`oamp-cluster`**，不加随机后缀——状态判定需要确定的名字）；**一进程一窗口**（共 12 个：`router` / `web` / 10 个 `<instance_id>`，如 `pb-progress-observer`），顺序 = router → web → 角色（配置声明序），不做 pane 分屏（窗口名即实例名，定位最短）；窗口用 `tmux new-window -c <cwd>` 指定工作目录；`set-option remain-on-exit on`（进程崩了窗口留尸可见）；`set-environment OAMP_ROLE_ROOT <root>`（角色窗口据此定位角色文件）；输出双通道 = 窗口命令 `… 2>&1 | tee -a <log>`（窗口实时看 + 同时落盘）；attach 提示由 up / status 打印 `tmux attach -t oamp-cluster`（不自动 attach，脚本要能在无终端场景跑完）。
- **AR-15 日志落点 / 命名 / 截断**：落点 = **`<PKG_ROOT>/.runtime/cluster/`**（本仓库 = `oamp/.runtime/cluster/`）——已被 `oamp/.gitignore` 的 `.runtime/` 覆盖 ⇒ `git check-ignore` 命中，**无需改任何 `.gitignore`**（验收 6 直接成立）；一进程一份：`router.log` / `web.log` / `<instance_id>.log`；**up 时逐个截断**（只保留本次运行的输出，文件大小上界 = 单次运行输出量），运行期 `tee -a` 追加；不做轮转 / 压缩（本地单机个人使用，up 截断已足够；YAGNI）。启动行 / 停止行：agent = `AGENT_START …` / `DEREGISTERED …`；router = `ROUTER_READY socket=…` / `ROUTER_STOPPING`（均既有一行事件）。
- **AR-16 up 重复执行语义 / down 序列与残留检查**：`up` 命中已有 session = **幂等**——不启动、不修改、不 kill，打印"集群已在运行（session=…，N 窗口）" + attach 提示 + "如需重建请先 `oamp cluster down`"，退出 0；理由：对运行中的集群做破坏性重建会杀掉用户正在使用的对话上下文，清理动作只保留 `down` 一个（单一职责）。`up` 部分失败（Router 未起 / 有实例未 online）⇒ 非 0 + **保留现场**（不自动回滚，便于诊断）。`down` 序列 = **C-c(SIGINT) → 等 pane 子树退出（≤10s）→ `kill-session` → 残留检查**；必须先 SIGINT 而非直接 kill-session：SIGINT 才会触发 agent 注销与 Router 的 socket unlink，直接 kill 只能等租约超时（"收口干净"会退化为"30s 后干净"）。**残留检查方式** = 以 down 前采集的 pane pid 为根、`ps -axo pid,ppid,command` 展开子树，down 后仍存活者即残留（精确到本次 session，**不误伤**用户另起的 oamp 进程）。
- **AR-17 角色段 schema**：`roles` 为**以角色名为键的对象**（增删键即增删实例，脚本零改动 ⇒ 验收 1 / M-03 的可判定形式）；角色段字段 = `enabled`（布尔，缺省 **true**；false = 不起实例）/ `instance_id`（缺省 `'pb-' + role`）/ `model`（可选字符串）/ `tools`（布尔，缺省 **true**）/ `permission`（`'allow'|'deny'`，缺省 `'allow'`）/ `cwd`（字符串，缺省 `"."` = 配置文件所在目录）；未知键忽略；非法 JSON / 键类型错 / 取值错 / 凭据类字段 / enabled 角色的角色文件或 cwd 不存在 ⇒ **在建立 session 之前**一律快速失败（stderr 明确原因 + 退出 2，不留半个集群）。
