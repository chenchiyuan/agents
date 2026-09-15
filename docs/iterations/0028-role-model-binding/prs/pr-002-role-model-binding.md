# pr-002：角色级模型绑定落盘（F03）

## 上下文摘要

把「dev 跑 gpt、verifier 跑 grok」从会话里的临时决定变成仓库里可 diff 的两行：在仓库根 `cluster.json` 的 `roles.dev` 与 `roles.verifier` 两段各新增一个 `model` 键。本 PR 只改这一份配置文件的这两处取值：其余 8 个角色段与 `session` / `web` / `router` 三段逐字不动（保持隐式默认）。生效链路由既有实现承担——`normalizeRoleSection` 未配置即 `undefined`、`planWindows` 仅在 `entry.model !== undefined` 时追加 `--model`。本 PR 不证明绑定生效（F05 / F06 / F10 承担），只证明文件内容。

## 涉及功能点

- F03

## 文件范围

- `cluster.json`（唯一改动面：`roles.dev.model` 与 `roles.verifier.model` 两个新增键）
- `docs/iterations/0028-role-model-binding/prs/pr-002-role-model-binding.md`（本 PR 文件）

## 验收标准

- [ ] `cluster.json` 的 `roles.dev.model` === `"openai/gpt-5.6-luna"`（F03 验收 1）
- [ ] `cluster.json` 的 `roles.verifier.model` === `"powerby/grok-4.6"`（F03 验收 2）
- [ ] `roles` 段其余 8 个角色（`architect` / `demand` / `planner` / `pr-planner` / `prd` / `progress-observer` / `retrospective` / `workflow-pb`）的对象中不含 `model` 键（F03 验收 3）
- [ ] `git diff main -- cluster.json` 恰含 2 行新增、无其它变更行（无键序重排、无缩进风格改写；`session` / `web` / `router` 与 8 个未绑定角色段逐字不变）（F03 验收 4）
- [ ] 两个取值均匹配 `^[A-Za-z0-9._/-]{1,128}$`；`permission` / `tools` / `cwd` 与凭据类字段未被触碰（F03 验收 5）
- [ ] 配置可被既有加载路径解析通过：`node <工作区>/oamp/bin/hub.js cli cluster status --config <工作区>/cluster.json` 的输出中**不出现** `配置错误`（配置加载失败的唯一出口，见 `oamp/src/cluster.js:342/440/507`）；`Router 不可达` 与退出码 1 属预期（工作区包根下尚无 socket），不计为失败（F03 验收 6）
- [ ] 不做集群启动期模型存在性预检、不动 `oamp/**` 与 `roles/**`（F03 边界 / F13 验收 1）

## 参考资料

- `docs/iterations/0028-role-model-binding/prd/F03-role-model-binding.md`（验收 1~6 与边界）
- `docs/iterations/0028-role-model-binding/architecture.md` §1.1 生效链、§3.1 步骤 4、§7③
- `docs/iterations/0028-role-model-binding/prd.md` §本次迭代边界说明（不包含第 1~4、6 条）
- 代码锚点：`oamp/src/cluster-config.js:149-158`（`normalizeRoleSection`：`model` 未配置即 `undefined`，不填内置默认）、`oamp/src/cluster.js:200-201`（`planWindows`：`if (entry.model !== undefined) argv.push('--model', entry.model)`）、`oamp/src/cluster-config.js:184`（`root = path.dirname(configPath)`）

## depends_on

（无）

## batch

1

## 验收证据

（本 PR 执行时填写：「改动后的两行原文」+「`git diff main -- cluster.json` 原始输出」+「配置加载检查命令与输出」；载体与字段形态见 `architecture.md` §4 A-02）

### 执行证据

#### 改动后的两行原文

```text
      "model": "openai/gpt-5.6-luna",
    "verifier": { "model": "powerby/grok-4.6" },
```

#### `git diff main -- cluster.json`

命令：

```sh
git diff main -- cluster.json
```

输出：

```diff
diff --git a/cluster.json b/cluster.json
index e1c7baf..b8f7af7 100644
--- a/cluster.json
+++ b/cluster.json
@@ -11,6 +11,7 @@
     "demand": {},
     "dev": {
       "enabled": true,
+      "model": "openai/gpt-5.6-luna",
       "tools": true,
       "permission": "allow",
       "cwd": "."
@@ -20,7 +21,7 @@
     "prd": {},
     "progress-observer": {},
     "retrospective": {},
-    "verifier": {},
+    "verifier": { "model": "powerby/grok-4.6" },
     "workflow-pb": {}
   }
 }
```

#### 配置加载检查

命令：

```sh
node oamp/bin/hub.js cli cluster status --config /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/cluster.json
```

输出（退出码 `1`）：

```text
[集群] session=oamp-cluster  运行中
[窗口]
  router /Users/chenchiyuan/projects/agents 0
  web /Users/chenchiyuan/projects/agents 0
  pb-architect /Users/chenchiyuan/projects/agents 0
  pb-demand /Users/chenchiyuan/projects/agents 0
  pb-dev /Users/chenchiyuan/projects/agents 0
  pb-planner /Users/chenchiyuan/projects/agents 0
  pb-pr-planner /Users/chenchiyuan/projects/agents 0
  pb-prd /Users/chenchiyuan/projects/agents 0
  pb-progress-observer /Users/chenchiyuan/projects/agents 0
  pb-retrospective /Users/chenchiyuan/projects/agents 0
  pb-verifier /Users/chenchiyuan/projects/agents 0
  pb-workflow-pb /Users/chenchiyuan/projects/agents 0
[Router 拓扑]
oamp cluster: Router 不可达（socket=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/router.sock）：无法连接 oamp router（socket=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/router.sock；router 未运行？先执行 oamp router start）
  （不可达，未取到拓扑）
[日志]
  目录: /Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster
  （暂无日志文件）
[角色实例]
  pb-architect  role=architect  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-architect.log
  pb-demand  role=demand  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-demand.log
  pb-dev  role=dev  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-dev.log
  pb-planner  role=planner  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-planner.log
  pb-pr-planner  role=pr-planner  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-pr-planner.log
  pb-prd  role=prd  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-progress-observer.log
  pb-progress-observer  role=progress-observer  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-progress-observer.log
  pb-retrospective  role=retrospective  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-retrospective.log
  pb-verifier  role=verifier  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-verifier.log
  pb-workflow-pb  role=workflow-pb  window=yes  alive=yes  state=unknown  cwd=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding  log=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0028-role-model-binding/.pb-agents/worktrees/0028-pr-002-role-model-binding/oamp/.runtime/cluster/pb-workflow-pb.log
__EXIT_CODE__=1
```

加载结果：输出不含 `配置错误`；`Router 不可达` 与退出码 1 符合预期。

#### 其它验收核验

```text
models=dev,verifier
unbound-model-roles=none
model-values-shape=valid
json=valid
cluster-lines=27
diff-numstat=2 1 cluster.json
```
