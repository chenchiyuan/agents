# pr-006：协议文档面与索引快照（`API.md` / `llms.txt`）

## 上下文摘要

`oamp/API.md` 与生成的 `oamp/llms.txt`：§3 清单 21 → **29** 行 + 8 个新 `### 3.x` 小节；新增「等待语义」小节（F12 的**唯一真源**，四条条文）；既有小节文字**逐字不改**；`node oamp/scripts/gen-llms-txt.mjs` 重生成包根快照（HTTP `/llms.txt` 响应字节与仓库快照同源）。

关键约束：`hub doctor` 的 R1 以 `API.md` §3 的表行与运行侧 `GET /api/docs` 投影**双向**比对（`sdk/doctor.js:readDocumented / compareSignatures`），漏一行即判 `文档未覆盖` ⇒ 本 PR 与 pr-005 是同一交付面的两侧，R-5 要求本 PR 的验收含"`hub doctor` 全 pass"。`README.md` **不改**（既有 HTTP 表的不一致属既有遗留，R-4）。

## 涉及功能点

- F11
- F12
- F17

## 文件范围

- `oamp/API.md`
- `oamp/llms.txt`（由既有脚本生成，不手改）
- `docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md`（本 PR 文件）

不触碰：`oamp/src/web.js`（路由登记与元数据归 pr-005）、`oamp/sdk/**`（入口面归 pr-007）、`oamp/skill/hub.md`（归 pr-007）、`oamp/README.md`（不改）、`oamp/scripts/gen-llms-txt.mjs`（既有生成器，零改动）。

## 验收标准

- [x] `oamp/API.md` §3 标题计数由 21 改为 29，表行 **29** 条且与运行侧 `GET /api/docs` 的 `routes[]` **双向 1:1**（无缺项、无多出）（F17 验收 2/3）
- [x] 8 个新 `### 3.x` 小节齐备，逐条含 `{摘要 / 参数 / 响应 / 错误 / docLink}` 五项语义；**摘要以调用方视角写**（说明"解决什么问题"，不是罗列入参出参）（F17 验收 1/4）（`docLink` 语义的载体 = 标题锚点 + 节末显式一行）
- [x] 新路由的 `docLink` 锚点可解析到对应小节（`API.md#<slug>`，逐字沿用既有形态）（新增 8 条锚点 8/8 命中；既有 3.16 的错配属 base 既有，见偏差记录）
- [x] 新增「等待语义」小节（位置按既有章节体例，A-09 记为 `### 2.4`），明文四条：① 等待的退出条件**必须**是终态 ② 超时**只表示放弃等待**，不改变任务状态、不产生失败结论 ③ **禁止**把"轮询 + 超时"当作等待的实现 ④ 客户端等待预算（如 30 分钟）是**放弃等待的预算**，不是等待的语义上限（F12 验收 1/5）
- [x] 既有 21 条表行与 21 个小节的文字**逐字不变**：`git diff -- oamp/API.md` 的删除行仅限 §3 标题计数那一行（`## 3. 接口清单（21 条）` 的计数改写）（F17 验收 5 / G01）
- [x] `oamp/llms.txt` 由 `node oamp/scripts/gen-llms-txt.mjs` 重新生成（非手改）：`git diff` 中该文件的变更全部落在接口清单段；生成器自报条目数 = 29（F17 验收 2）
- [x] 快照与 HTTP 产物同源：`GET /llms.txt` 的响应字节与包根 `oamp/llms.txt` **逐字节相同**（既有单产物结构，Z-6）
- [x] `hub doctor` 三段全 `pass`：R1 无 `文档未覆盖` / 无 `登记缺失`；R2 覆盖新增的非流式 GET（自动扩展，`doctor.js` 零改动）；R3 探针集不变（F17 验收 3 / R-5）（新增非流式 GET 共 4 条被自动探测；`subscribe` 为 sse、3 条 POST 沿用既有「写端点不探」口径）
- [x] `oamp/README.md` 未被修改（`git diff --name-only` 不含它）、`oamp/sdk/doctor.js` 未被修改
- [x] 条文与行为一致（反向验证）：对一个仍在跑的调用等待到超时 ⇒ 返回后该调用 `calls get` 仍为非终态、`error` 为空、`exit_code` 未变（F12 验收 2 的条文侧对照）

## 参考资料

- `docs/iterations/0029-hub-client-session-and-duplex/prd/F11-single-call-wait-entry.md`（验收 1/6）、`F12-wait-semantics-clause.md`（验收 1~5）、`F17-service-metadata-discoverability.md`（验收 1~5）
- `docs/iterations/0029-hub-client-session-and-duplex/architecture.md` §3.10（文档投影链）、§4 A-09（条文落点与四条内容）、§4 A-14（`API.md` 同步"不是可选项"）、§5.5（`API.md` / `llms.txt` 改动面）、§6.2 S-11（doctor 条目自动扩展）、§7 L2-11、§9.2 N-13、§10 R-4 / R-5
- 代码锚点：`oamp/scripts/gen-llms-txt.mjs:12`（`import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js'` —— 生成物直接由路由登记投影产出）、`oamp/src/web.js:1384`（`projectRoutes`）、`oamp/src/web.js:1402`（`renderLlmsTxt`）、`oamp/sdk/doctor.js`（R1 的 `readDocumented` 读 `API.md` §3 表行、`compareSignatures` 双向比对；`API_DOC_PATH` = 包根 `API.md`）、`oamp/API.md:157-181`（现状 21 行清单与 `### 3.x` 体例）

## depends_on

- pr-005-web-session-and-call-surface.md（理由：本 PR 两侧产物都由 pr-005 的路由登记派生的契约决定 —— 证据：① `oamp/scripts/gen-llms-txt.mjs:12` 直接 import `createApiRoutes / projectRoutes / renderLlmsTxt`，`llms.txt` 的条目集合 = `createApiRoutes` 表内容，缺 pr-005 的 8 行则生成的清单少 8 条；② `oamp/sdk/doctor.js` 的 R1 以 `API.md` §3 表行为文档侧、以运行侧 `GET /api/docs`（= 同一份登记投影）为对照做双向比对，两侧不同源必判 `登记缺失` / `文档未覆盖` ⇒ "R1 全 pass"这一验收项在 pr-005 合并前不可判）

## batch

3

## 验收证据

> **体例**：每条 AC = 一条可直接复制执行的命令 + 紧跟的**原样 stdout/stderr**。全程只用仓内可执行形态（`git -C` 带绝对路径、`node`、`curl`、`grep`、`cmp`、`shasum`、`jq`）与**隔离集群**（不触碰主工作区 / 主集群）。证据段内**无临时目录依赖、无占位符**（自检见 §11）。

### §0 复现环境（隔离集群，短 socket 路径）

```bash
WS=/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index
B=http://127.0.0.1:8436
mkdir -p /Users/chenchiyuan/.cache/o29p6                                  # 工作区外的一次性运行态目录（短路径，仅本 PR 集群使用）
export OAMP_SOCKET=/Users/chenchiyuan/.cache/o29p6/r.sock OAMP_DB=/Users/chenchiyuan/.cache/o29p6/sql.db OAMP_WEB_PORT=8436
cd $WS
node oamp/bin/oamp.js router start           # 就绪行 ROUTER_READY
node oamp/bin/oamp.js agent start dev-1      # 角色 dev 在树内；!sleep 分支不触发模型调用
node oamp/bin/oamp.js web start --port 8436  # 就绪行 WEB_READY url=http://127.0.0.1:8436
```

取证明细（本机实跑，2026-09-16）：

```
pr006-router：ready（日志匹配 ROUTER_READY）
pr006-agent：running（pid 已确认在 Router 名册内）
pr006-web：ready（日志匹配 WEB_READY url=http://127.0.0.1:8436，端口 8436 可连）
```

三个进程在 §7 取证完成后逐个停止（`Stopped pr006-web` / `Stopped pr006-agent` / `Stopped pr006-router`）；**未触碰主工作区与主集群**（socket 与 DB 均在本机一次性目录内）。

### AC1 §3 标题计数 21 → 29、表行 29 条且与运行侧 `GET /api/docs` 的 `routes[]` 双向 1:1

**① 计数与表行数**（F17 验收 2/3）

```bash
cd $WS && grep -nE '^## 3\. 接口清单' oamp/API.md && grep -cE '^\| [0-9]+ \| `(GET|POST) /api/' oamp/API.md
```

```
168:## 3. 接口清单（29 条）
29
```

**② 29 行清单原文**（本节要求的内联原文；行号已随 §2.4 插入后重置）

```bash
cd $WS && grep -nE '^\| [0-9]+ \| `(GET|POST) /api/' oamp/API.md
```

```
172:| 1 | `GET /api/agents` | 拓扑快照（`?state=online` 只返回在线实例） |
173:| 2 | `GET /api/chats` | 对话列表（搜索 / 过滤 / 分页） |
174:| 3 | `GET /api/chats/<chat_id>` | 对话详情（含消息） |
175:| 4 | `POST /api/chats/<chat_id>/close` | 关闭对话（幂等） |
176:| 5 | `POST /api/chats/archive` | 批量归档（服务端算范围） |
177:| 6 | `POST /api/chats/<chat_id>/activate` | 激活归档对话 |
178:| 7 | `POST /api/chats/<chat_id>/rename` | 重命名对话 |
179:| 8 | `POST /api/messages` | 发送消息（落库 + 派发） |
180:| 9 | `GET /api/stream?chat_id=<id>` | 按对话订阅实时事件（SSE） |
181:| 10 | `GET /api/events` | 全局事件订阅：agent 上线 / 下线（SSE） |
182:| 11 | `GET /api/docs` | 接口元数据（文档页 / 调试台 / AI 索引文件的数据源） |
183:| 12 | `GET /api/projects` | 项目列表（含对话数与最近活动时间） |
184:| 13 | `POST /api/projects` | 创建项目（最小输入 = 仓库地址；重复地址 → 409） |
185:| 14 | `POST /api/calls` | 发起一次或一批调用（阻塞取终态 / 后台执行） |
186:| 15 | `GET /api/calls` | 调用 roster（每次调用一行；无过滤 / 无分页 / 无编排） |
187:| 16 | `GET /api/calls/stream?chat_id=<id>` | 按对话订阅调用事件（SSE） |
188:| 17 | `GET /api/calls/<call_id>/stream` | 按调用订阅调用事件（SSE） |
189:| 18 | `GET /api/calls/<call_id>/transcript` | 按调用取转录（进程内，不持久） |
190:| 19 | `GET /api/calls/<call_id>` | 按调用取终态（进行中给状态） |
191:| 20 | `GET /api/confirmations` | 在途确认项列表（跨对话；进程内，不持久） |
192:| 21 | `POST /api/confirmations/<confirmation_id>/decision` | 提交确认项裁决（选项 + 可选文本；随即移出在途表并回传） |
193:| 22 | `GET /api/subscribe` | 实时订阅（按事件类型 / agent 过滤；SSE） |
194:| 23 | `GET /api/pickup` | 未取件的终态结果（离线也不丢结论） |
195:| 24 | `POST /api/pickup/<call_id>/ack` | 取件确认（幂等） |
196:| 25 | `GET /api/calls/wait` | 等待一组调用达到终态（一次调用即返回） |
197:| 26 | `POST /api/calls/<call_id>/cancel` | 取消调用（幂等；已终态调用不改状态） |
198:| 27 | `GET /api/health` | 恢复判据（router / web / agents 三问 + 可调用结论） |
199:| 28 | `POST /api/principals` | 注册客户端身份（幂等） |
200:| 29 | `GET /api/principals/<principal_id>` | 查询客户端身份 |
```

**③ 与运行侧 `GET /api/docs` 的 `routes[]` 双向比对**（`doctor` 的 `shapePath` 同一归一：路径参数段写作尖括号或 `:name` 均等价）

```bash
cd $WS && node --input-type=module <<'NODE'
import fs from 'node:fs';
const md = fs.readFileSync('./oamp/API.md', 'utf8');
const docs = await (await fetch('http://127.0.0.1:8436/api/docs')).json();
const shape = (p) => p.split(/[?#]/)[0].replace(/<[^>]*>/g, ':').replace(/:[^/]*/g, ':');
const doc = new Set();
for (const line of md.split('\n')) {
  const m = /^\|\s*\d+\s*\|\s*`(GET|POST)\s+(\/api\/[^`]*)`/.exec(line.trim());
  if (m) doc.add(`${m[1]} ${shape(m[2])}`);
}
const run = new Set(docs.routes.map((r) => `${r.method} ${shape(r.path)}`));
console.log('API.md §3 表行 =', doc.size, '｜ GET /api/docs routes[] =', run.size);
console.log('文档有运行无（登记缺失）=', JSON.stringify([...doc].filter((k) => !run.has(k))));
console.log('运行有文档无（文档未覆盖）=', JSON.stringify([...run].filter((k) => !doc.has(k))));
NODE
```

```
API.md §3 表行 = 29 ｜ GET /api/docs routes[] = 29
文档有运行无（登记缺失）= []
运行有文档无（文档未覆盖）= []
```

### AC2 8 个新 `### 3.x` 小节齐备，逐条含 `{摘要 / 参数 / 响应 / 错误 / docLink}` 五项语义（摘要以调用方视角写）

```bash
cd $WS && node --input-type=module <<'NODE' 2>/dev/null
import fs from 'node:fs';
import { createApiRoutes, projectRoutes } from './oamp/src/web.js';
const lines = fs.readFileSync('./oamp/API.md', 'utf8').split('\n');
const routes = projectRoutes(createApiRoutes({}));
const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/ +/g, '-');
const NEWS = ['/api/subscribe','/api/pickup','/api/pickup/:call_id/ack','/api/calls/wait','/api/calls/:call_id/cancel','/api/health','/api/principals','/api/principals/:principal_id'];
for (const path of NEWS) {
  const r = routes.find((x) => x.path === path);
  const want = r.docLink.slice('API.md#'.length);
  const start = lines.findIndex((l) => /^### 3\./.test(l) && slug(l.slice(4).trim()) === want);
  let end = start + 1;
  while (end < lines.length && !/^### |^## /.test(lines[end])) end += 1;
  const body = lines.slice(start, end).join('\n');
  const ok = [
    body.includes('**参数**') || body.includes('**请求体**'),
    body.includes('**成功响应** `200`'),
    body.includes('**错误**'),
    body.includes(`> **文档链接**：\`${r.docLink}\``),
    slug(lines[start].slice(4).trim()) === want,
    (r.params || []).every((p) => body.includes(`\`${p.name}\``)),
    (r.errors || []).every((c) => body.includes(c)),
  ];
  console.log(`${ok.every(Boolean) ? '✓' : '✗'} ${r.method} ${r.path} L${start + 1} → 锚点 #${want} ${ok.every(Boolean) ? '（五项语义 5/5 + 参数名齐备 + 错误码齐备）' : '有缺项'}`);
}
NODE
```

```
✓ GET /api/subscribe L1011 → 锚点 #311-get-apisubscribe （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ GET /api/pickup L1051 → 锚点 #312-get-apipickup （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ POST /api/pickup/:call_id/ack L1096 → 锚点 #313-post-apipickupcall_idack （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ GET /api/calls/wait L1129 → 锚点 #318-get-apicallswait （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ POST /api/calls/:call_id/cancel L1167 → 锚点 #3110-post-apicallscall_idcancel （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ GET /api/health L1203 → 锚点 #3111-get-apihealth （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ POST /api/principals L1233 → 锚点 #322-post-apiprincipals （五项语义 5/5 + 参数名齐备 + 错误码齐备）
✓ GET /api/principals/:principal_id L1271 → 锚点 #323-get-apiprincipalsprincipal_id （五项语义 5/5 + 参数名齐备 + 错误码齐备）
```

**小节编号与标题原文**（8 个新小节 + 既有同号小节并存的实况）

```bash
cd $WS && grep -nE '^### (3\.11|3\.12|3\.13|3\.18|3\.110|3\.111|3\.22|3\.23) ' oamp/API.md
```

```
570:### 3.11 `GET /api/docs`
591:### 3.12 `GET /api/projects`
621:### 3.13 `POST /api/projects`
822:### 3.18 `GET /api/calls/<call_id>/transcript`
1011:### 3.11 `GET /api/subscribe`
1051:### 3.12 `GET /api/pickup`
1096:### 3.13 `POST /api/pickup/<call_id>/ack`
1129:### 3.18 `GET /api/calls/wait`
1167:### 3.110 `POST /api/calls/<call_id>/cancel`
1203:### 3.111 `GET /api/health`
1233:### 3.22 `POST /api/principals`
1271:### 3.23 `GET /api/principals/<principal_id>`
```

> **编号口径**：8 个新小节的号码**逐字取自 pr-005 已登记的 `docLink`**（`oamp/src/web.js`，本 PR 不触碰该文件）；因此 §3 里出现同号并存的既有/新增小节（如 `3.11` 既有 `GET /api/docs` 与新增 `GET /api/subscribe`），锚点因后缀不同而互不冲突（AC3 的机械判据即锚点逐字相等）。该口径是推导项，已列本 PR tasks 文件 §6 MI-P1 供主 agent 裁决。

**摘要以调用方视角写**（各节摘要原文，说明「解决什么问题」，非罗列入参出参）

```bash
cd $WS && sed -n '1013p;1053p;1098p;1131p;1169p;1205p;1235p;1273p' oamp/API.md
```

```
**0029 新增的服务化实时面**：接入方**一次连接**就拿到「纳管实例的状态变化」与「自己那些调用的进展和结论」——不必再自己写轮询脚本，也不必把多条既有流拼起来。
**0029 新增的取件面**：结论不因「请求方当时不在线」而消失——按身份取回**自己尚未取件**的终态调用（含完整信封），断线再拉起后一轮查询即补齐。
**0029 新增**：取件确认——把已取走的结论从待取清单里划掉；重复确认不报错（调用方可以放心重试）。
**0029 新增的等待入口**：一次调用就等到底——不必自己拼订阅、拼轮询、拼超时；请求返回时要么带着**结论**，要么明确告诉你「还没结论」。
**0029 新增的控制面**：把一次在跑的调用**收口成结论**——不必等它自己结束；且**不会改写**已经定下的终态。
**0029 新增的恢复判据**：一条请求回答「现在能不能用」——router 起没起、web 可用吗、有几个实例可派发（含正在重连的）。判据本身**只读、零副作用**（不发起真实调用、不写任何状态）。
**0029 新增的身份面**：把调用方登记成**可寻址的一层**——注册一次，之后的派发归属（`requester`）、实时订阅（§3.11）与取件（§3.12 / §3.13）都能归到这个名下，不必每次派发重复自述。
**0029 新增**：确认一个身份是否还在、以及它自述的实例——续接时先看名字有没有被重启清掉，再决定是否重新声明。
```

### AC3 新路由的 `docLink` 锚点可解析到对应小节（`API.md#slug`，逐字沿用既有形态）

**判据**：以 GitHub 风格 slug 规则（小写、删去 `.` `/` 反引号与尖括号、空格转连字符、`_` 保留 —— 由既有登记反推：`### 3.10 \`GET /api/events\`` ↔ `#310-get-apievents`）计算标题 slug，与登记 `docLink` 片段**逐字相等**。AC2 的脚本第 5 项即该判据（新增 8 条全 `✓`）。

**全量 29 条的反向核对**（同时暴露一处**既有**错配，非本 PR 引入）

```bash
cd $WS && node --input-type=module <<'NODE' 2>/dev/null
import fs from 'node:fs';
import { createApiRoutes, projectRoutes } from './oamp/src/web.js';
const lines = fs.readFileSync('./oamp/API.md', 'utf8').split('\n');
const routes = projectRoutes(createApiRoutes({}));
const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/ +/g, '-');
const headings = lines.filter((l) => /^### 3\./.test(l)).map((l) => l.slice(4).trim());
const miss = routes.filter((r) => !headings.some((h) => slug(h) === r.docLink.slice('API.md#'.length)));
console.log(`【全量 29 条锚点】未命中 ${miss.length} 条：`, miss.map((r) => `${r.method} ${r.path} → #${r.docLink.slice('API.md#'.length)}`).join('；'));
console.log(`　该条为既有小节（base 同形）：${headings.find((h) => h.startsWith('3.16'))}`);
NODE
```

```
【全量 29 条锚点】未命中 1 条： GET /api/calls/stream → #316-get-apicallsstream
　该条为既有小节（base 同形）：3.16 `GET /api/calls/stream?chat_id=<id>`
```

该处错配在 base 已存在（既有小节标题含 `?chat_id=<id>`，而既有 `docLink` 不含查询串）——**修它必须改既有小节文字或 `web.js` 的登记**，两者都在本 PR 禁止面内，故如实登记、不动：

```bash
git -C $WS show b090369:oamp/API.md | grep -n '^### 3.16' && git -C $WS show b090369:oamp/API.md | grep -nE '^\| 16 \|'
```

```
745:### 3.16 `GET /api/calls/stream?chat_id=<id>`
176:| 16 | `GET /api/calls/stream?chat_id=<id>` | 按对话订阅调用事件（SSE） |
```

### AC4 新增「等待语义」小节（`### 2.4`，明文四条）

**位置**（既有章节体例：§2 的顺序子小节）

```bash
cd $WS && grep -nE '^### 2\.' oamp/API.md
```

```
72:### 2.1 成功响应
77:### 2.2 统一错误契约
108:### 2.3 对象字段
157:### 2.4 等待语义
```

**条文原文**

```bash
cd $WS && sed -n '157,166p' oamp/API.md
```

```
### 2.4 等待语义

**等待的退出条件必须是终态，不是「时间到了」。** 本小节是等待语义的**唯一真源**（各接口只引用、不复制）：

1. **退出条件 = 终态**：任何等待形态（订阅式等待 `GET /api/calls/<call_id>/stream`、一次调用式等待 `GET /api/calls/wait`）都以「结论产生」为出口——`state` 到达 `completed` / `failed` **当刻**即退出，**不由超时值决定**（对照：把超时调大或调小，退出时刻不变）。
2. **超时只表示放弃等待**：到达时间上限只表示**调用方不再等**，**不改变任务状态、不产生失败结论**——返回后该调用仍是原来那个状态与原因（`state` / `error` / `exit_code` 逐字不变）。一次调用式等待的**唯一退出原因字段是 `timed_out`**（布尔）：`false` = 全部终态返回，`true` = 超时放弃返回 ⇒ 两种情形**可判定地区分**，不靠「没拿到结果」反推。
3. **禁止把「轮询 + 超时」当作等待的实现**：等待的释放点必须是**终态事件**本身；轮询到的「没有结果」不是结论，也不得被当作失败判据（`timeout_ms` 缺省即不设上限，服务端挂起到终态为止）。
4. **客户端等待预算是「放弃等待的预算」**：例如 CLI 侧 30 分钟的等待预算，是调用方**愿意等多久**的上限，**不是等待的语义上限**——它不等于「超过 30 分钟就算失败」，也不改变任何调用的状态。

---
```

**四条与 AC4 的对应**：① 终态为退出条件 = 第 1 条；② 超时只表示放弃等待（不改状态、不产生失败结论）= 第 2 条；③ 禁止「轮询 + 超时」= 第 3 条；④ 客户端预算是放弃等待的预算 = 第 4 条。

### AC5 既有 21 条表行与 21 个小节的文字逐字不变（删除行仅 §3 标题计数那一行）

```bash
git -C $WS diff --numstat b090369 -- oamp/API.md oamp/llms.txt
```

```
312	1	oamp/API.md
9	1	oamp/llms.txt
```

```bash
git -C $WS diff -U0 b090369 -- oamp/API.md | grep '^-[^-]'
```

```
-## 3. 接口清单（21 条）
```

```bash
git -C $WS diff -U0 b090369 -- oamp/API.md | grep -c '^-[^-]'; git -C $WS diff -U0 b090369 -- oamp/API.md | grep -cE '^-### 3\.'; git -C $WS diff -U0 b090369 -- oamp/API.md | grep -c '^+### 3\.'
```

```
1
0
8
```

读法：整份 `API.md` 只有 **1 行删除**（§3 标题计数改写），**0 个既有小节标题被删/改**，**8 个新小节标题**。既有 21 条表行与 21 个小节因此逐字不变（`git diff -U0` 中无对它们任何一行的删除）。

### AC6 `oamp/llms.txt` 由生成器重生成；变更全落在接口清单段；自报条目数 = 29

**生成器自报**

```bash
cd $WS && node --no-warnings oamp/scripts/gen-llms-txt.mjs
```

```
llms.txt 已生成：/Users/chenchiyuan/projects/agents/.pb-agents/worktrees/0029-hub-client-session-and-duplex/.pb-agents/worktrees/0029-pr-006-protocol-docs-and-index/oamp/llms.txt（接口 29 条，3493 字节）
```

**非手改的机械判据**（快照字节 === `renderLlmsTxt(projectRoutes(createApiRoutes({})))` 的纯函数产出）

```bash
cd $WS && node --input-type=module -e "import fs from 'node:fs';import {createApiRoutes,projectRoutes,renderLlmsTxt} from './oamp/src/web.js';const d=fs.readFileSync('./oamp/llms.txt','utf8');console.log('snapshot === renderLlmsTxt(projectRoutes(createApiRoutes({}))):', d===renderLlmsTxt(projectRoutes(createApiRoutes({}))));" 2>/dev/null
```

```
snapshot === renderLlmsTxt(projectRoutes(createApiRoutes({}))): true
```

**变更落点**（hunk 全部落在接口清单段：第 11 行段首计数 + 第 14/25/35 行起的清单条目；`## 深入` 段零变动）

```bash
git -C $WS diff -U0 b090369 -- oamp/llms.txt | grep '^@@'
```

```
@@ -11 +11 @@
@@ -13,0 +14,3 @@
@@ -21,0 +25 @@
@@ -30,0 +35,4 @@
```

```bash
cd $WS && grep -c '^- \(GET\|POST\) ' oamp/llms.txt && grep -n '^## 接口' oamp/llms.txt && grep -n '^## 深入' oamp/llms.txt
```

```
29
11:## 接口（29 条）
43:## 深入
```

（清单段 = 第 11–41 行；`## 深入` 在第 43 行，未变动。）

### AC7 快照与 HTTP 产物同源（逐字节相同）

```bash
cd $WS && curl -s -o /dev/null -w 'HTTP %{http_code} %{size_download} 字节\n' http://127.0.0.1:8436/llms.txt && curl -s http://127.0.0.1:8436/llms.txt | cmp - oamp/llms.txt && echo 'cmp 退出码 0：逐字节相同' && curl -s http://127.0.0.1:8436/llms.txt | shasum -a 256 && shasum -a 256 oamp/llms.txt
```

```
HTTP 200 3493 字节
cmp 退出码 0：逐字节相同
d5fd6f94875d67fe1446b74c5b743803e3dddcd7bf5a295351104792ca279c2c  -
d5fd6f94875d67fe1446b74c5b743803e3dddcd7bf5a295351104792ca279c2c  oamp/llms.txt
```

### AC8 `hub doctor` 三段全 `pass`（R1 无 `文档未覆盖` / 无 `登记缺失`；R2 自动扩展；R3 探针集不变）

```bash
cd $WS && OAMP_SOCKET=/Users/chenchiyuan/.cache/o29p6/r.sock OAMP_WEB_PORT=8436 node oamp/bin/hub.js doctor | jq '{pass, total: (.items|length), R1: [.items[]|select(.id|startswith("R1"))]|length, R2: [.items[]|select(.id|startswith("R2"))]|length, R3: [.items[]|select(.id|startswith("R3"))]|length, failed: [.items[]|select(.ok==false)]}'
```

```
{
  "pass": true,
  "total": 66,
  "R1": 29,
  "R2": 29,
  "R3": 8,
  "failed": []
}
```

**8 条新面在 R1 / R2 中的条目原文**

```bash
cd $WS && OAMP_SOCKET=/Users/chenchiyuan/.cache/o29p6/r.sock OAMP_WEB_PORT=8436 node oamp/bin/hub.js doctor | jq -r '.items[]|select(.id|test("subscribe|pickup|health|principal|wait|cancel"))|"\(.id) ok=\(.ok) skipped=\(.skipped//false) actual=\(.actual) reason=\(.reason//"-")"'
```

```
R1 GET /api/subscribe ok=true skipped=false actual=GET /api/subscribe reason=-
R1 GET /api/pickup ok=true skipped=false actual=GET /api/pickup reason=-
R1 POST /api/pickup/:/ack ok=true skipped=false actual=POST /api/pickup/:call_id/ack reason=-
R1 GET /api/calls/wait ok=true skipped=false actual=GET /api/calls/wait reason=-
R1 POST /api/calls/:/cancel ok=true skipped=false actual=POST /api/calls/:call_id/cancel reason=-
R1 GET /api/health ok=true skipped=false actual=GET /api/health reason=-
R1 POST /api/principals ok=true skipped=false actual=POST /api/principals reason=-
R1 GET /api/principals/: ok=true skipped=false actual=GET /api/principals/:principal_id reason=-
R2 POST /api/principals ok=true skipped=true actual=null reason=写端点不探，零写副作用
R2 GET /api/principals/:principal_id ok=true skipped=false actual=404 NOT_FOUND reason=-
R2 GET /api/health ok=true skipped=false actual=200 reason=-
R2 GET /api/subscribe ok=true skipped=true actual=null reason=流式端点，不探（存在性由 R1 覆盖）
R2 GET /api/pickup ok=true skipped=false actual=400 INVALID_PARAM reason=-
R2 GET /api/calls/wait ok=true skipped=false actual=400 INVALID_PARAM reason=-
R2 POST /api/calls/:call_id/cancel ok=true skipped=true actual=null reason=写端点不探，零写副作用
R2 POST /api/pickup/:call_id/ack ok=true skipped=true actual=null reason=写端点不探，零写副作用
```

**R3 探针集（8 个既有 Router 方法，无新增、无缺失）**

```bash
cd $WS && OAMP_SOCKET=/Users/chenchiyuan/.cache/o29p6/r.sock OAMP_WEB_PORT=8436 node oamp/bin/hub.js doctor | jq -r '.items[]|select(.id|startswith("R3"))|"\(.id) ok=\(.ok) actual=\(.actual)"'
```

```
R3 agent.register ok=true actual=code INVALID_PARAMS
R3 agent.heartbeat ok=true actual=静默（通知型，1000ms 内无响应）
R3 agent.deregister ok=true actual=code UNREGISTERED
R3 message.send ok=true actual=code UNREGISTERED
R3 message.ack ok=true actual=code UNREGISTERED
R3 router.status ok=true actual=ok
R3 router.task_get ok=true actual=code INVALID_PARAMS
R3 router.task_list ok=true actual=code INVALID_PARAMS
```

**`文档未覆盖` / `登记缺失` 计数 = 0**

```bash
cd $WS && OAMP_SOCKET=/Users/chenchiyuan/.cache/o29p6/r.sock OAMP_WEB_PORT=8436 node oamp/bin/hub.js doctor | grep -c "文档未覆盖\|登记缺失"; echo "grep 退出码 $?（1 = 零命中）"
```

```
0
grep 退出码 1（1 = 零命中）
```

### AC9 `oamp/README.md` 未被修改、`oamp/sdk/doctor.js` 未被修改（含全部不触碰面）

```bash
git -C $WS diff --name-only b090369
```

```
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index-tasks.md
docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md
oamp/API.md
oamp/llms.txt
```

```bash
git -C $WS diff --name-only b090369 -- oamp/README.md oamp/sdk/doctor.js oamp/scripts/gen-llms-txt.mjs oamp/src/web.js oamp/skill/hub.md oamp/sdk/surface.js; echo "（以上为空 = 全部未修改）"
```

```
（以上为空 = 全部未修改）
```

```bash
git -C $WS diff --numstat b090369 -- oamp/README.md oamp/sdk/doctor.js; echo "numstat 空 = 未修改"
```

```
numstat 空 = 未修改
```

```bash
git -C $WS status --short; echo "status 空 = 无未提交改动（既有未跟踪 clarifications/ 亦无）"
```

```
status 空 = 无未提交改动（既有未跟踪 clarifications/ 亦无）
```

### AC10 条文与行为一致（反向验证：等待到超时后仍非终态、`error` 空、`exit_code` 未变）

**自足复现块**：造一个在跑的调用（`POST /api/messages` 的 `!sleep 6` 分支 = shell 执行器、**零模型调用**）→ 记等待前的三键 → 带 `timeout_ms=2000` 等待 → 记等待返回后当刻的三键并与等待前逐字比对 → 等 `!sleep` 走完记自然终态。整块可直接复制执行（调用 id 是每次运行的易失值，故本块用变量承接；下面粘贴的是本机实跑的原样输出）。

```bash
cd $WS && B=http://127.0.0.1:8436 && PRJ=$(curl -s -X POST $B/api/projects -H 'content-type: application/json' -d "{\"repo_url\":\"https://example.invalid/pr006-wait-$(date +%s)\"}" | jq -r .project.project_id) && TASK=$(curl -s -X POST $B/api/messages -H 'content-type: application/json' -d "{\"project_id\":\"$PRJ\",\"agent_id\":\"dev-1\",\"text\":\"@dev-1 !sleep 6\"}" | jq -r .task_id) && echo "task=$TASK" && echo '--- ① 等待前 ---' && curl -s $B/api/calls/$TASK && echo && echo '--- ② 带超时等待（timeout_ms=2000） ---' && curl -s "$B/api/calls/wait?ids=$TASK&timeout_ms=2000" && echo && echo '--- ③ 等待返回后当刻 ---' && curl -s $B/api/calls/$TASK && echo && echo '--- ③ 与等待前三键比对 ---' && curl -s $B/api/calls/$TASK | jq -c '{state,error,exit_code}' | diff - <(echo '{"state":"working","error":null,"exit_code":null}') && echo 'diff 逐字相同（退出码 0）' && echo '--- ④ 自然终态（!sleep 6 走完） ---' && sleep 7 && curl -s $B/api/calls/$TASK
```

```
task=task-49dc8332-d446-4179-8393-a41e24cd4d8e
--- ① 等待前 ---
{"call_id":"task-49dc8332-d446-4179-8393-a41e24cd4d8e","agent":null,"state":"working","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
--- ② 带超时等待（timeout_ms=2000） ---
{"timed_out":true,"timeout_ms":2000,"results":[],"unresolved":[{"call_id":"task-49dc8332-d446-4179-8393-a41e24cd4d8e","state":"working"}]}
--- ③ 等待返回后当刻 ---
{"call_id":"task-49dc8332-d446-4179-8393-a41e24cd4d8e","agent":null,"state":"working","duration_ms":null,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":null}
--- ③ 与等待前三键比对 ---
diff 逐字相同（退出码 0）
--- ④ 自然终态（!sleep 6 走完） ---
{"call_id":"task-49dc8332-d446-4179-8393-a41e24cd4d8e","agent":null,"state":"completed","duration_ms":6010,"model":null,"truncated":false,"text":null,"structured_output":null,"error":null,"exit_code":0}
```

**读数**：② 的 `timed_out:true` + 该 id 留在 `unresolved`（`state:"working"`）= **超时放弃返回**；③ 的三键与 ① 逐字相同（`state` 非终态、`error` 为 `null`、`exit_code` 为 `null`）= **超时未改变任务状态、未产生失败结论**；④ 该调用随后自然 `completed`（`duration_ms` 覆盖整个 `!sleep` 时长）= **超时既未冻结、也未改写任何状态**。与 §2.4 第 2 条条文（`timed_out` 为唯一退出原因字段、超时只表示放弃等待）逐条对应。

### §11 证据段自检（无临时目录依赖、无自造占位符）

**① 证据段（`## 验收证据` 到本节之前）的临时目录依赖扫描**

```bash
cd $WS && P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md && sed -n '/^## 验收证据/,/^### §11/p' $P | grep -c '/tmp/'; echo "证据段 /tmp 计数（0 命中时 grep -c 输出 0、退出码 1，实测退出码 $?）"
```

```
0
证据段 /tmp 计数（0 命中时 grep -c 输出 0、退出码 1，实测退出码 1）
```

**② 同一范围内的自造占位符扫描（`xxx` / 待填 / `TODO` / 花括号省略号形态）**

```bash
cd $WS && P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md && sed -n '/^## 验收证据/,/^### §11/p' $P | grep -nE 'xxx|待填|TODO|\{…\}'; echo "退出码 $?（1 = 零命中）"
```

```
退出码 1（1 = 零命中）
```

**③ 同一范围内的尖括号形态分布（= `API.md` 原文自带的路径参数写法，逐字携带）**

```bash
cd $WS && P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md && sed -n '/^## 验收证据/,/^### §11/p' $P | grep -oE '<[a-z_]+>' | sort | uniq -c | sort -rn
```

```
      9 <call_id>
      6 <id>
      4 <chat_id>
      2 <principal_id>
      1 <confirmation_id>
```

**③ 的读数**：这些尖括号形态**全部**来自 AC1 要求的 29 行清单原文、AC2/AC3 的小节标题原文与 §2.4 条文原文——那是 `API.md` 既有的**路径参数语法**（`<chat_id>` 等），按 AC5「既有文字逐字不变」必须逐字携带，**不是待填占位符**；② 的扫描在本范围内零命中，且本文件原有的「本 PR 执行时填写」占位段已被本节替代。

**④ 本节之外（含七字段）。本节命令行自身含被检索的字面量，全文扫描会自匹配，故以「§11 之前」的范围给判据。原样输出：**

```bash
cd $WS && P=docs/iterations/0029-hub-client-session-and-duplex/prs/pr-006-protocol-docs-and-index.md && sed -n '1,/^### §11/p' $P | grep -c '/tmp/'; echo "§11 之前的 /tmp 计数（0 命中时输出 0、退出码 1，实测退出码 $?）" && sed -n '1,/^### §11/p' $P | grep -n '<slug>' && grep -c '/tmp/' $P
```

```
0
§11 之前的 /tmp 计数（0 命中时输出 0、退出码 1，实测退出码 1）
27:- [x] 新路由的 `docLink` 锚点可解析到对应小节（`API.md#<slug>`，逐字沿用既有形态）（新增 8 条锚点 8/8 命中；既有 3.16 的错配属 base 既有，见偏差记录）
3
```

读数：`§11` 之前的全文（含七字段）`/tmp/` 零命中；唯一的 `<slug>` 形态在七字段 AC3 原文（本 PR 无权修改）；全文件 `/tmp/` 计数为 3，全部落在 §11 自身的命令行与说明文字里（自匹配），证据段 §0~AC10 为零命中。

### §12 提交与改动面

```bash
git -C $WS log --oneline b090369..HEAD
```

```
c8d97d0 chore(0029-pr-006-protocol-docs-and-index): 重生成 llms.txt 快照（接口 21→29 条）
b585b9f docs(0029-pr-006-protocol-docs-and-index): API.md 新增 §2.4 等待语义（条文唯一真源，四条）
670c39e feat(0029-pr-006-protocol-docs-and-index): API.md 新增 8 个接口小节（五项语义 + 登记锚点）
aec6b64 feat(0029-pr-006-protocol-docs-and-index): API.md §3 清单 21→29（表行 22~29）
161d3ab docs(0029): pr-006-protocol-docs-and-index 内部任务列表
```

| AC | 结果 | 判据出处 |
|---|---|---|
| AC1 §3 计数 29 + 表行 29 + 与 `/api/docs` 双向 1:1 | **pass** | AC1 ① ② ③ |
| AC2 8 个新小节五项语义齐备（摘要调用方视角） | **pass** | AC2 脚本 + 摘要原文 |
| AC3 新路由 `docLink` 锚点可解析 | **pass**（新增 8/8） | AC2 脚本第 5 项 + AC3 全量核对（1 条既有错配另记） |
| AC4 `### 2.4` 等待语义四条 | **pass** | AC4 位置 + 条文原文 |
| AC5 既有文字逐字不变（删除行仅计数行） | **pass** | AC5 三组计数 |
| AC6 `llms.txt` 生成器重生成、落点在清单段、自报 29 | **pass** | AC6 自报 + 纯函数比对 + hunk |
| AC7 快照与 HTTP 产物逐字节相同 | **pass** | AC7 `cmp` + sha256 |
| AC8 `hub doctor` 三段全 pass | **pass**（pass:true，failed:[]） | AC8 四组输出 |
| AC9 `README.md` / `doctor.js` 未被修改 | **pass** | AC9 四组输出 |
| AC10 条文与行为一致（超时后仍非终态） | **pass** | AC10 ① ② ③ ④ |
