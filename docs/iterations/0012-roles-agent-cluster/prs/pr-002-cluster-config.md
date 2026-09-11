# pr-002 集群配置加载与校验（cluster-config + cluster.json）

## 上下文摘要

新增 `src/cluster-config.js` 与仓库根 `cluster.json`（10 个角色、tracked、零凭据）：把「哪些角色、每角色什么参数」变成配置事实而非代码事实。加载即全量校验——类型/取值、凭据类键递归扫描、enabled 角色的角色文件与 cwd 预检，任一不成立在创建 tmux session 之前失败退出 2。同时消费 pr-001 的映射与路径解析，产出 `roles` Map 供 pr-005 编排直接使用。

## 涉及功能点

- F06
- F03
- F04
- F05
- F07

## 文件范围

- oamp/src/cluster-config.js（新建）
- oamp/test/cluster-config.test.js（新建）
- cluster.json（新建，仓库根；纳入 git）

## 验收标准

- [ ] `loadClusterConfig({ path, env })` 返回 `{ session, root, web, router, roles: Map<role, {instanceId, enabled, model, tools, permission, cwd}> }`（架构 §12.2 跨组契约 3）
- [ ] 缺省值正确：`session='oamp-cluster'`、`web.port=7788`、`router.socket=null`、角色段 `enabled=true`、`tools=true`、`permission='allow'`、`cwd='.'`（= 配置文件所在目录）；`instanceId` 缺省 = `instanceIdForRole(role)`（pr-001 的公式，本模块不得内联字符串拼接）
- [ ] `cwd` 相对路径基准 = 配置文件所在目录（= `root`），绝对路径原样使用，返回值为绝对路径；不做 `~` 展开；`enabled:false` 的角色保留在 Map 中且 `enabled===false`（是否起窗口由 pr-005 决定）
- [ ] 仓库根 `cluster.json` 可被加载，`roles` 键集合恰为 10 个角色，且**不含** `_template` / `cdp-debug-skill`（F01-2 / F06-1）
- [ ] 非法输入全部抛错（由调用方收口为 `oamp cluster: 配置错误: <原因>` + 退出码 2）：文件不存在 / 非法 JSON / 非对象 / 角色段类型错 / `permission` 非 `allow|deny` / `tools` 非布尔 / `web.port` 非 1~65535 / enabled 角色的角色文件不存在 / enabled 角色的 `cwd` 不存在或非目录
- [ ] 凭据类键递归扫描（键名大小写不敏感：`token`/`secret`/`password`/`passwd`/`api_key`/`apikey`/`credential`）命中即抛错；未知键忽略（不报错）（F06-7）
- [ ] `cluster.json` 被 git 跟踪（`git ls-files cluster.json` 命中）且文件内容无凭据类键名（F06-7 / TC-07）
- [ ] `node --test test/cluster-config.test.js` 全绿（临时目录 + 临时配置自建自删，不新增 fixture 文件）；既有 16 个测试文件零修改

## 参考资料

- docs/iterations/0012-roles-agent-cluster/architecture.md §5.1（schema 与校验表）、§2.4、§8 AR-12/AR-17/AR-18、§12.1~§12.2（G2 与跨组契约 3）
- docs/iterations/0012-roles-agent-cluster/prd/F06-cluster-script-config-tmux.md（验收 1/7）、prd/F03-model-default-per-role-override.md（验收 2）、prd/F04-tool-toggle-per-role.md（验收 3/6）、prd/F05-permission-policy.md（验收 3）、prd/F07-role-working-directory.md（验收 1）
- 现行风格参照：`oamp/src/config.js:104-125`（env > 文件 > 内置默认 + 非法即抛错的快速失败口径）
- 仓库事实：`roles/` 的 10 个 `<role>/<role>.md` —— 本 PR 的配置键来源

## depends_on

- pr-001-role-binding.md（理由：`loadClusterConfig` 的返回形状按跨组契约 3 必须含 `roles.<role>.instanceId`，而 `instance_id = 'pb-' + role` 的公式按 §3.1「只此一处」归 `role-binding.js`；角色文件预检同样需要其路径解析。证据：本 PR 的 `src/cluster-config.js` 必须 `import { instanceIdForRole, resolveRoleFile } from './role-binding.js'` —— 该模块不存在时 cluster-config 自身加载失败（ERR_MODULE_NOT_FOUND），配置校验与其测试全部不可跑）

## batch

2
