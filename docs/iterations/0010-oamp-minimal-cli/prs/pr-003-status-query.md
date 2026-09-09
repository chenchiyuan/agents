# PR-003：status 只读查询

## 上下文摘要

本 PR 交付 `oamp status` 查询命令的客户端侧：src/status.js（定位 socket → 经 rpc.js 连 Router → 调 `router.status` → padEnd 渲染对齐表格到 stdout → 退出 0；Router 不可达 → stderr 明确报错含 socket 路径 + 退出 1，M-02，§7.3/D8）+ test/status.test.js（F05 全量验收）。Router 侧的 `router.status` 方法实现（§4.4 方法面 + §4.6 投影语义）已在 pr-002 的 router.js/registry.js 中完整落盘，本 PR 只消费其返回的 nodes 快照——这是依赖图上本 PR 挂在 pr-002 之后的直接原因。

## 涉及功能点

- F05（status.test.js：四字段输出/不可达失败 M-02/只读无副作用/offline 反映）

## 文件范围

- oamp/src/status.js
- oamp/test/status.test.js

## 验收标准

- [ ] 启动真实 Router + 至少一个真实 agent（缩短 env，复用 pr-002 的 agent 栈与 harness）后执行 `node bin/oamp.js status`：stdout 输出对齐表格，每个节点行含 instance_id / session_id / state / last_heartbeat 四字段（UTC ISO-8601），行按 instance_id 排序（§7.3/D8）
- [ ] Router 未运行时执行 `oamp status` → stderr 明确报错（含 socket 路径与 router 未运行提示），退出码 1，不输出空结果冒充成功（M-02/F05-3）
- [ ] 连续执行 status 不改变任何节点状态与注册表内容（F05-4 只读无副作用；以两次输出中 state/last_heartbeat 仅随心跳自然推进、无其他差异为判定）
- [ ] kill 节点（无 deregister）后再次 status：该节点 state 显示 offline（F05-5/E2；依赖 pr-002 租约扫描已判 offline）

## 参考资料

- docs/iterations/0010-oamp-minimal-cli/prd/F05-status-readonly-query.md
- docs/iterations/0010-oamp-minimal-cli/architecture.md §4.4（router.status 方法）、§4.6（投影与排序）、§7.2（OAMP_SOCKET）、§7.3（输出格式/M-02）、§3.1（ST-->RP 引用边）、D8

## depends_on

- pr-001-project-skeleton-cli-hygiene.md（理由：status.js 消费 pr-001 的 src/config.js——socket 默认路径/`OAMP_SOCKET` 读取与校验（§7.2 env 作用对象"全部"、§7.3 Router 定位）集中在 config 模块，模块引用证据 = "config 被 router/agent/status 消费"；且 `oamp status` 经 pr-001 的 bin/oamp.js + cli.js `status` 分发分支（§7.1）入口执行）
- pr-002-protocol-runtime-registry-heartbeat.md（理由：
  ① status.js 经 src/rpc.js 与 Router 通信——§3.1 图 `ST --> RP`（status 消费 rpc），rpc.js 属 pr-002；
  ② status.js 消费的 `router.status` 方法由 pr-002 的 router.js 方法分发实现、返回数据由 pr-002 的 registry.js 快照投影（§4.4/§4.6），本 PR 不新增任何 Router 侧代码；
  ③ status.test.js 需拉起真实 Router + agent 并观察 offline 反映，复用 pr-002 的 harness.js/agent.js/租约扫描（§10.2/§5.6））

## batch

3
