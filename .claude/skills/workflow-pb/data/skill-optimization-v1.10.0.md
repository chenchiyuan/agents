# SKILL.md v1.10.0 优化记录（对应规范 workflow-pb v0.7.0）

**触发**：迭代 `0007-workflow-history-log`——需要一份独立于 `status.md` 的历史记录 `history.md`，覆盖主 agent 派发、收到报告、调度决策三类事件，供复盘者/debug 者事后阅读，不需要询问执行者或依赖会话记忆即可还原"发生了什么、为什么"。

**方案**：`workflow-pb.md` 新增「历史记录协议（history.md）」一节定义格式（落盘位置、创建/关闭时机、三类事件条目格式、顺序保真约定），`SKILL.md` 同步新增「§ history.md 更新时机」一节只定义"何时写"，不重复格式定义。

**具体改动**：
- 新增 `## § history.md 更新时机` 一节，与现有 `## § status.md 更新时机` 平级并列：启动时若 `history` 开启创建空文件；每次派发前追加「派发」；每次收到报告后追加「收到报告」；每次阶段推进核查/Gate确认/槛位释放爬升/PR失败或阻塞判定后追加「调度决策」；`history` 被显式改为关闭后停止追加、不删除已有文件
- 「Tools and capability boundaries」的"做什么"列表新增一条："若 `history` 开启，逐条维护 `history.md`"
- 「Important facts and constraints」新增第 9 条："history.md 与 status.md 并存、格式互不侵入，history.md 记录顺序即写入顺序，不依赖序号字段"
- 「Safety」新增一条："`history` 关闭后不得继续追加 history.md，也不删除已存在的 history.md"
- 版本号 v1.9.0 → v1.10.0，对应规范引用同步为 workflow-pb v0.7.0

**未改变的部分**：任何执行角色文件（`roles/<role>/<role>.md`）本身的报告契约字段定义；`status.md` 现有格式与维护时机（除 `workflow-pb.md` 侧新增 `history` 字段行外）；并发调度算法本身。

**一致性核对**：`SKILL.md` 「§ history.md 更新时机」的五条时机描述与 `workflow-pb.md` 「历史记录协议」正文的创建/关闭时机、三类事件格式定义逐条对照，字段名（`history`、开启/关闭）、事件类型取值（派发/收到报告/调度决策）、触发时机描述均一致，未发现矛盾或遗漏。

**关联文件**：
- `roles/workflow-pb/workflow-pb.md` v0.7.0「历史记录协议（history.md）」一节
- `docs/iterations/0007-workflow-history-log/architecture.md` §决策 D1~D5
- `docs/iterations/0007-workflow-history-log/prs/pr-001-history-log-protocol.md`
