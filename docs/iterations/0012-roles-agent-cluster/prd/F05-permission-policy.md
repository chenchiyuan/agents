# F05：permission 策略（允许 + 审计 / 拒绝不挂起）

**功能 ID**: F05
**来源**: `demand.md` W5 后半（D-1 / TC-03）；效果条款 E5；实测事实 V-6；决策条款 D-7
**迭代**: 0012-roles-agent-cluster

---

## 用户价值

角色干活时**不会卡死**：默认放行并留下审计痕迹（事后能查谁在什么时候用了什么工具）；需要收紧时可以切到拒绝档，失败也是快速、明确的，不会让一轮对话无声挂起。

## 验收标准

1. **默认档 = 允许**：默认配置下，需要工具的操作被放行并成功完成（TC-03）。
2. **允许档留痕（审计）**：允许档下，**每一次**工具调用都在事件日志中留下一条放行记录——N 次工具调用对应 N 条记录（E5 末段 / TC-03）（判定口径见 `architecture.md` §11.2：受门禁调用 = `bash` / `edit` / `delete` / `move`，恰一条；只读工具不产生请求故无记录；阶段 6 断言须用变更类指令）。
3. **拒绝档可配**：permission 档位是可写的配置项，可取"拒绝"（TC-03）。
4. **拒绝不挂起（快速失败）**：把档位置为"拒绝"并重启后，对任一角色实例发一条需要工具的指令 → 该轮在配置超时之前以明确的失败/拒绝结论结束，**不出现长时间挂起**（E5 前半 / V-6）。判定 = 该轮有明确终态且耗时有限；超时取值与终态形态见 AR-10。
5. **档位变更经重启生效**：档位变更在重启集群后生效（与 N11 一致，不做运行期热重载）。

## 边界（不包含）

- 不做工具类别分档（读写文件放行 / 命令执行询问）——TC-03 的第三档未被采纳，本迭代只有"允许 / 拒绝"两档（N6 / TC-03）。
- 不做细粒度沙箱 / 命令白名单 / 路径限制（N6）。
- 不做鉴权 / 多用户 / 凭据管理（N5）。
- 不含审计日志的检索界面、持久化归档与轮转策略（本卡只要求"每次工具调用留下放行记录"这一可数事实）。
- 不含工具开关本身（F04）——本卡只管"放行与拒绝的判定与记录"，不管"工具有没有开"。
- 不含 `shell` 执行路径的 permission 语义（该路径不经工具调用门禁；如阶段 3 发现需要，属新增范围，需报告）。

## 架构维度（阶段 3 已填，2026-09-11；详见 `architecture.md` §4.4 / §4.5）

- **AR-10 permission 应答的实现面与拒绝档判据**：omp 侧以 ACP **服务端请求**下发 `session/request_permission { sessionId, toolCall:{toolCallId,toolName,title,rawInput,…}, options:[allow_once | allow_always | reject_once | reject_always] }`，客户端必须回 `{ outcome:{ outcome:'selected', optionId } }`（或 `{outcome:{outcome:'cancelled'}}`）。落点 = `AcpClient._handleMessage()` 新增"服务端请求"分支（判定：`id` 存在**且** `method` 为字符串，**置于 pending 表查找之前**——现状该帧会因 pending 无此 id 被静默丢弃，正是 V-6 挂起的根因）；**未知方法回 JSON-RPC 错误 `-32601`**（响亮失败，绝不静默丢弃，防未来 omp 新增请求造成挂起）。策略来源 = `cluster.json` 的 `roles.<role>.permission` → `--permission allow|deny`。**允许档**：恒回 `allow_once`（**不用** `allow_always`——omp 会按 cacheKey 缓存，此后同类调用不再发请求，审计记录数会少于工具调用数）；受门禁的工具为 `bash`/`edit`/`delete`/`move`（只读工具不经过门禁）。**拒绝档**：回 `reject_once` → 立即发 `session/cancel` → 置 `permission_denied` 标记 → `prompt()` 结算时抛 `AcpError('permission_denied')` → 该轮 `task.result{state:'failed', error:'permission_denied', text:'工具调用被 permission 策略拒绝（permission=deny）'}` + 一条失败 out 记录（0011 §4.4 口径）；**会话保留**（列为轮次级错误，与 `model_unavailable` 同级，下一轮仍可用）。**"不长时间挂起"的时间判据（回答 `prd.md` 疑问 3）**：硬上限 = 既有轮次超时（`payload.timeout_ms`，默认 300000ms，**不新增配置键**）；可判定判据 = **deny 档该轮 `duration_ms ≤ 10s` 即出现终态**（设计上限为毫秒级：应答 → cancel → prompt 结算）。
- **AR-11 审计事件与落点**：事件名 `TOOL_APPROVED`（允许档）/ `TOOL_DENIED`（拒绝档），**一次 permission 请求恰好一行**（N 次受门禁的工具调用 = N 条记录 ⇒ 验收 2 的字面判据）；字段 = `instance` / `role` / `chat_id` / `context_id` / `pid` / `tool`（工具名）/ `title`（工具调用标题，截断 120 字符）/ `tool_call_id` / `option`（`allow_once` / `reject_once`）；落点 = agent 事件行（`createEventLog().event()`，永不节流）→ 经集群 `tee` 同时落盘 `oamp/.runtime/cluster/<instance>.log` 并在 tmux 窗口可见。**不落 SQLite、不进对话流**（E-5 / F02-5「仅两类记录」的模块边界；审计属运行期事件，沿用 0010 以来"事件日志 = 终端事件行"的既有形态，不新增检索面）。**覆盖口径的诚实边界**：受门禁的只有 `bash`/`edit`/`delete`/`move` 四类（文件创建走 `edit`），只读工具（read/glob/grep/…）不产生请求因而无记录——验收 2 的审计断言须使用**变更类**指令（见 `architecture.md` §4.5 / §14.1）。
