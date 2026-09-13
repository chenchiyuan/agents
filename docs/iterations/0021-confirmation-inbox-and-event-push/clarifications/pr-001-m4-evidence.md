# pr-001 M4 根因定位 · 原始证据（第 2 轮补落）

**迭代**: 0021-confirmation-inbox-and-event-push ｜ **阶段**: 5（PR 实现）｜ **PR**: pr-001（agent 侧权限挂起链路 + ACP 答复链路修复）
**性质**: 本文件是 `prs/pr-001-tasks.md` T5.1 / T5.2 / T5.4 三项 partial 的补落证据（首轮验证报告偏差 #3），对应 `clarifications/pr001-round2-verdicts.md` 第三节第 1 条。
**日期**: 2026-09-13 ｜ **环境**: 真实 `omp` 18.0.11（`/Users/chenchiyuan/.bun/bin/omp` → `@oh-my-pi/pi-coding-agent/dist/cli.js`，19,803,745 B）；node v22.15.0；模型 `deepseek/deepseek-v4-flash`。
**判据口径**: 全部结论只以**模型侧工具结果**与**副作用文件**为据；`TOOL_APPROVED` / `TOOL_DENIED` 审计行不作任何判据（仅作辅助说明单列）。

**探针**（全部在 `/tmp/r2`，未提交任何仓库；下述命令均以 `/Users/chenchiyuan/.nvm/versions/node/v22.15.0/bin/node` 运行）：

| 探针 | 用途 |
|---|---|
| `/tmp/r2/probe-real.mjs` | 用本 PR 的 `AcpClient` 起真实 omp（`bash-allow` / `bash-deny` / `write-allow` / `write-deny` / `write-nohook`）；落**原始帧**（`serverRequestFrames`）、客户端应答、argv、模型侧文本、副作用文件 |
| `/tmp/r2/omp-wrap2.sh` | temp wrapper：记录 **strip 前**（`PR001_ARGV_LOG`）与 **strip 后**（`PR001_FINAL_ARGV_LOG`）两份 argv 再 exec 真实 omp；`PR001_STRIP_NO_SESSION=1` 时丢弃 `--no-session` |
| `/tmp/r2/probe-delay.mjs` | D2 四档对照：对**每一帧客户端应答**统一延迟 0/1/100/1000ms，同一探针分别 import 修复前源（`/tmp/r2/acp-client-pre.js` = `git show dd59d31:oamp/src/acp-client.js`）与修复后源 |
| `/tmp/r2/probe-c4.mjs` + `/tmp/r2/fake-acp-r2.mjs` | 帧级 fake ACP 服务端（独立于 PR 自带用例）：放行 → 自身审批门 → 窗口内无关同型门 → 终态 → 终态后的门；用于偏差 #4 的修复前/后对照 |
| `/tmp/r2/probe-real.mjs` 的 `write` 场景提示词 | 「请用 `write` 工具（不要用 bash，不要用 edit）把下面这行文本写入文件：路径 `<file>` 内容 …；只调用这一次工具。然后把你从工具那里收到的原始输出逐字贴出来；如果工具没有真的执行，也请如实说明。」 |

---

## 1. argv 逐字列表（含 / 不含 `--no-session` 两侧）

`AcpClient.start()` 对 `tools=true` 的 daemon 真实 argv（由 `/tmp/r2/omp-wrap2.sh` 在 `exec` 前记录，**未经任何改写**）：

| 侧 | wrapper 实收 argv（strip 前） | omp 实收 argv（strip 后） | 侧别说明 |
|---|---|---|---|
| 含 `--no-session`（daemon 真实形态） | `acp` `--no-skills` `--no-rules` `--no-session` `--approval-mode` `always-ask` | 同左（无 strip） | `oamp/src/acp-client.js:126` 无条件 `args.push('--no-session')` ⇒ **daemon 常驻路径恒带 `--no-session`** |
| 不含 `--no-session`（T5.2 要求的排除性对照） | 同左 | `acp` `--no-skills` `--no-rules` `--approval-mode` `always-ask` | wrapper `PR001_STRIP_NO_SESSION=1` 丢弃该参数 |

**两侧结论一致**（同一探针、同一提示词、同一判定）：

| 场景 | argv 侧 | 钩子调用（逐字） | 模型侧工具结果 | 副作用文件 |
|---|---|---|---|---|
| bash 放行 | 含 `--no-session` | `[{"kind":"permission","toolName":null,"toolCallId":"call_00_bjBiv5skBqCdnvuPuGAh7168","options":["allow_once","allow_always","reject_once","reject_always"]}]` | 真实输出 `R2-bash-allow` | `/tmp/r2/side-effect-bash-allow.txt` **存在**，内容 `R2-bash-allow` |
| bash 放行 | 不含 `--no-session` | 同上形态（`kind:"permission"`，toolCallId 为该次运行的 id） | 真实输出 `R2-bash-allow-strip` | `/tmp/r2/side-effect-bash-allow-strip.txt` **存在**，内容 `R2-bash-allow-strip` |
| write 放行 | 含 `--no-session` | `[{"kind":"tool_approval","toolName":"write","toolCallId":null,"options":["Approve","Deny"]}]` | `Successfully wrote 15 bytes to side-effect-write-allow.txt` | `/tmp/r2/side-effect-write-allow.txt` **存在**，内容 `R2-write-allow` |
| write 放行 | 不含 `--no-session` | 同上形态（`kind:"tool_approval"`，toolName `write`） | `Successfully wrote …` | `/tmp/r2/side-effect-write-allow-strip.txt` **存在**，内容 `R2-write-allow-strip` |

⇒ T5.2 的意图（排除「探针 argv 产物」这一假设）成立：**两侧结果一致**；同时确认 T5.2 判据字面（「其中无 `--no-session`」）与代码事实相反——daemon 路径**恒含** `--no-session`（偏差 #2 的代码级证据，见 §4 的 `acp-client.js:126`）。

---

## 2. 原始帧原文（逐字，未美化）

以下为探针 `serverRequestFrames` / `clientReplies` 的原始 JSON（`sessionId` 为运行时 uuid，其余字段逐字保留）。

### 2.1 `write` 场景：**只有工具审批门，没有 ACP 权限门**（偏差 #1 的前提）

```
IN  {"method":"elicitation/create","id":0,"params":{"mode":"form","sessionId":"01a09939-f690-70cb-9fea-503ddcf394fd","message":"Allow tool: write\nPath: /tmp/r2/side-effect-write-allow.txt\nContent:\nR2-write-allow","requestedSchema":{"type":"object","properties":{"value":{"type":"string","enum":["Approve","Deny"]}},"required":["value"]}}}
OUT {"id":0,"result":{"action":"accept","content":{"value":"Approve"}},"error":null}
```

`write-deny` 同帧形态，仅应答不同：

```
IN  {"method":"elicitation/create","id":0,"params":{"mode":"form","sessionId":"01a09936-ca53-7041-b2f6-8c4f8bd3e03d","message":"Allow tool: write\nPath: /tmp/r2/side-effect-write-deny.txt\nContent:\nR2-write-deny","requestedSchema":{"type":"object","properties":{"value":{"type":"string","enum":["Approve","Deny"]}},"required":["value"]}}}
OUT {"id":0,"result":{"action":"accept","content":{"value":"Deny"}},"error":null}
```

### 2.2 `bash` 场景：**两道门**（先 ACP 权限门，后工具审批门）

权限请求帧（`toolCall` **不带 `toolName`**——见 §4 的 ACP 桥 `mba()`；`options` 数组在首次复现时被终端截断，完整集合为 `allow_once / allow_always / reject_once / reject_always`）：

```
IN  {"method":"session/request_permission","id":0,"params":{"sessionId":"01a09939-c2ce-73d0-9cff-9b30b9abb89f","toolCall":{"toolCallId":"call_00_bjBiv5skBqCdnvuPuGAh7168","title":"echo R2-bash-allow > /tmp/r2/side-effect-bash-allow.txt; echo R2-bash-allow","kind":"execute","status":"pending","rawInput":{"command":"echo R2-bash-allow > /tmp/r2/side-effect-bash-allow.txt; echo R2-bash-allow"},"content":[{"type":"content","content":{"type":"text","text":"$ echo R2-bash-allow > /tmp/r2/side-effect-bash-allow.txt; echo R2-bash-allow"}}],"locations":[]},"options":[{"optionId":"allow_once","name":"Allow once","kind":"allow_once"},{"optionId":"allow_always","name":"Always allow","kind":"allow_always"},{"optionId":"reject_once","name":"Reject","kind":"reject_once"},{"optionId":"reject_always","name":"Always reject","kind":"reject_always"}]}}
```

工具审批门 elicitation 帧（**紧随**权限门应答之后、`id` 递增为 1；`message` 首行为 `Allow tool: bash`，第二行为 omp 的 `formatApprovalDetails` 详情行）：

```
IN  {"method":"elicitation/create","id":1,"params":{"mode":"form","sessionId":"01a09939-c2ce-73d0-9cff-9b30b9abb89f","message":"Allow tool: bash\nCommand: echo R2-bash-allow > /tmp/r2/side-effect-bash-allow.txt; echo R2-bash-allow","requestedSchema":{"type":"object","properties":{"value":{"type":"string","enum":["Approve","Deny"]}},"required":["value"]}}}
```

客户端应答帧（逐字）：

```
OUT {"id":0,"result":{"outcome":{"outcome":"selected","optionId":"allow_once"}},"error":null}
OUT {"id":1,"result":{"action":"accept","content":{"value":"Approve"}},"error":null}
```

`bash-deny` 侧：只收到权限请求帧（`reject_once` 后不再发审批门），客户端应答 `{"outcome":{"outcome":"selected","optionId":"reject_once"}}`，`prompt()` 以 `code='permission_denied'` 结算，副作用文件 `side-effect-bash-deny.txt` **不存在**。

### 2.3 模型侧结果原文（判据）

- `write-allow`：`工具已执行。原文输出（逐字）：```Successfully wrote 15 bytes to side-effect-write-allow.txt```（写入内容为 R2-write-allow\n，共 15 字节，与输出一致。）`
- `write-deny`：`工具未执行：调用被用户拒绝。…```Tool call denied by user: write```…写操作**没有**发生。该调用未被执行，/tmp/r2/side-effect-write-deny.txt 未被创建或修改。`
- `bash-allow`：`已真实执行（bash 工具，命令逐字未改）。…```R2-bash-allow\n\n\nWall time: 0.04 seconds```…副作用已发生：/tmp/r2/side-effect-bash-allow.txt 已写入。`
- `bash-deny`：`prompt()` 抛 `permission_denied`，模型侧文本不可观测（产品拒绝语义为「回包后立即 `session/cancel`」，轮次在模型产出前即被取消）。

### 2.4 修复前基线的原始现象（偏差 #1，`write`）

首轮实现（`dd59d31`）对本节的 `write` 门**不上浮、直接答 `Deny`**，且钩子零调用：

```
IN  {"method":"elicitation/create","id":0,"params":{…,"message":"Allow tool: write\nPath: /tmp/pr001-verify/side-effect-write.txt\nContent:\n…","requestedSchema":{…"enum":["Approve","Deny"]…}}}
OUT {"id":0,"result":{"action":"accept","content":{"value":"Deny"}},"error":null}
模型侧原文：```Tool call denied by user: write```；副作用文件未创建
```

---

## 3. 0 / 1 / 100 / 1000 ms 四档对照表（修复前 / 修复后）

方法：同一探针（`/tmp/r2/probe-delay.mjs`）对**每一帧客户端应答**统一延迟 N ms 后写出；同一 `write` 提示词；修复前 = `git show dd59d31:oamp/src/acp-client.js`，修复后 = 本 PR 第 2 轮 HEAD。

| 应答延迟 | 修复前（`dd59d31`）模型侧 | 修复前副作用文件 | 修复后（第 2 轮）模型侧 | 修复后副作用文件 | 修复后钩子调用 |
|---|---|---|---|---|---|
| 0 ms | `Tool call denied by user: write`（denied） | 未创建 | `Successfully wrote …`（真实执行） | **存在**（`DELAY-post-0`） | `tool_approval:write` |
| 1 ms | `Tool call denied by user: write`（denied） | 未创建 | `Successfully wrote …`（真实执行） | **存在**（`DELAY-post-1`） | `tool_approval:write` |
| 100 ms | `Tool call denied by user: write`（denied） | 未创建 | `Successfully wrote …`（真实执行） | **存在**（`DELAY-post-100`） | `tool_approval:write` |
| 1000 ms | `Tool call denied by user: write`（denied） | 未创建 | `Successfully wrote …`（真实执行） | **存在**（`DELAY-post-1000`） | `tool_approval:write` |

四档内部结果**逐档相同**（修复前四档皆 denied、修复后四档皆真实执行）⇒ **D2（「应答延迟导致模型侧 denied」）不成立**：结果是稳定的，与应答时延无关，只取决于客户端是否把工具审批门纳入可裁决面。八次运行的 `stop_reason` 均为 `end_turn`，`prompt()` 无异常。

---

## 4. 双层门的 omp dist 代码位置引用

文件：`/Users/chenchiyuan/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/cli.js`（偏移为字符下标，逐字摘录）。

| # | 语义 | 偏移 | 逐字摘录 |
|---|---|---|---|
| ① | **第二道门（工具审批门）** 的询问与拒绝：`select(Approve\|Deny)`，非 `Approve` 即抛 `Tool call denied by user: <name>` | 14046764 / 14046956 | `P=await A.select(I,["Approve","Deny"])}catch(O){throw await x(!1,…),O}let F=P==="Approve";if(await x(F,F?void 0:"denied by user"),!F)throw Error(\`Tool call denied by user: ${this.tool.name}\`)` |
| ② | 审批门 message 构造：首行恒为 `Allow tool: <toolName>`，其后可选 `Origin:` / `Reason:` / 工具自定义详情行（`formatApprovalDetails`，逐行 `join('\n')`） | 13316196 | `function aZn(e,t,n){let s=[\`Allow tool: ${e.name}\`];if(e.name.startsWith("mcp__")&&e.approval===void 0)s.push("Origin: MCP server tool");if(n)s.push(\`Reason: ${n}\`);let o=e.formatApprovalDetails?.(t);…return s.join('\n')}` |
| ③ | 审批门的能力门控：`elicitation.form` 未声明 ⇒ `select` 直接 `return`（undefined）⇒ `F` 恒 false ⇒ 模型侧恒 `Tool call denied by user` | 18049212 | `let s=n?.elicitation?.form!=null;return{select:async(o,r,i)=>{if(!s)return;…}}` |
| ④ | 无交互 UI 时的分支（`--approval-mode yolo` 等）：直接抛 `Tool "<name>" requires approval but no interactive UI available` | 14046411 | `…throw Error(\`Tool "${this.tool.name}" requires approval but no interactive UI available.\nOptions:\n  1. Set tools.approvalMode: yolo in /settings\n  2. Add tools.approval.${this.tool.name}: allow to config\n  3. Use an interactive UI to approve the tool call\`)` |
| ⑤ | **第一道门（ACP 权限门）** 的覆盖面：**只有** `bEs={bash,edit,delete,move}`（`write` 等不在其中 ⇒ 没有权限门） | 15541352 | `bEs={bash:!0,edit:!0,delete:!0,move:!0},WFt=[{optionId:"allow_once",…},{optionId:"allow_always",…},{optionId:"reject_once",…},{optionId:"reject_always",…}]` |
| ⑥ | 权限门请求方入参（含 `toolName`，但见 ⑦ 后被丢弃；`bash` 另附 `kind:"execute"`） | 15551179 | `t.requestPermission({toolCallId:o,toolName:n.name,title:u.title,...n.name==="bash"?{kind:"execute"}:{},status:"pending",rawInput:r,…},WFt,i)` |
| ⑦ | **ACP 桥序列化丢弃 `toolName`**：wire 上的 `session/request_permission.params.toolCall` **只有** `toolCallId/title/[kind]/[status]/[rawInput]/[content]/[locations]` | 18034948 | `async function mba(e,t,n,s,o){let r={toolCallId:n.toolCallId,title:n.title,...n.kind?{kind:n.kind}:{},...n.status?{status:n.status}:{},...n.rawInput!==void 0?{rawInput:n.rawInput}:{},...n.content?{content:n.content}:{},...n.locations?{locations:n.locations}:{}},…a={sessionId:t,toolCall:r,options:i}` |
| ⑧ | 权限门应答的 `optionId` 校验（未知值直接抛错 ⇒ 客户端必须回集合内值） | 15551720 | `…throw new X(\`Tool permission response used unknown option ID: ${T.optionId}\`)` |

**由 ①③→ 根因**：M4 症状 `Tool call denied by user: bash` 由**第二道审批门**产生（不是权限门；权限门的拒绝文案是 `Tool call rejected by user (…)`）。**由 ⑤**：`write` 等非 `bEs` 工具没有权限门、只有审批门 ⇒ 首轮实现「只对刚过权限门的 toolCall 答 `Approve`」对它们恒 `Deny`（偏差 #1）。**由 ⑦**：审批门与权限门之间**没有任何共享 id**——`session/request_permission` 不携带工具名，`elicitation/create` 不携带 `toolCallId`。故第 2 轮的凭据模型只能落在「显式登记的放行（toolCallId，仍未见终态）→ 紧随其后的一个审批门抵扣一次」这一层关联上（见 §5），而不是按工具名匹配（wire 上不可达成）。

---

## 5. 偏差 #4（误放行窗口）的修复前 / 修复后对照（帧级、同探针）

探针：`/tmp/r2/probe-c4.mjs` + fake 服务端 `/tmp/r2/fake-acp-r2.mjs`，序列 = `permission(call_A)` → 放行 → `gate_1`（call_A 自己的门，`Allow tool: bash`）→ `gate_2`（**与 call_A 无关**的同型门，`Allow tool: write`）→ call_A 终态 → `gate_3`（`Allow tool: bash`）。钩子：权限门答 `allow`、审批门答 `deny`（以便把「凭据抵扣」与「上浮」区分开）。

| 帧 | 修复前（`dd59d31`） | 修复后（第 2 轮） |
|---|---|---|
| `permission_reply` | `{outcome:{outcome:'selected',optionId:'allow_once'}}` | 同左 |
| `gate_1_same_toolCall` | `{action:'accept',content:{value:'Approve'}}` | `{action:'accept',content:{value:'Approve'}}`（凭据抵扣，**不上浮**） |
| `gate_2_unrelated` | `{action:'accept',content:{value:'Approve'}}` ← **无人工裁决即放行（偏差 #4）** | `{action:'accept',content:{value:'Deny'}}` ← 上浮后由钩子裁决 |
| `gate_3_after_terminal` | `{action:'accept',content:{value:'Deny'}}` | `{action:'accept',content:{value:'Deny'}}` |
| 钩子调用（逐字） | `[{"kind":"permission","toolName":"bash","options":["allow_once","allow_always","reject_once","reject_always"]}]`（**审批门零调用**） | `[{"kind":"permission",…},{"kind":"tool_approval","toolName":"write","options":["Approve","Deny"]},{"kind":"tool_approval","toolName":"bash","options":["Approve","Deny"]}]` |
| 轮次结算 | `end_turn` | `end_turn` |

修复前 `gate_2` 之所以被静默放行：单槽 `_approvedToolCallId` 只在「该 toolCall 终态 / 轮末 / 拒绝」三处清除，窗口 = 放行 → 终态，窗口内**任何** `Approve|Deny` 型 elicitation 都命中该槽。修复后凭据为「显式登记的放行次数（toolCallId，FIFO）+ 消费即失效 + 该 toolCall 终态即失效」，一次放行只抵扣紧随其后的一个审批门 ⇒ `gate_2` 必须上浮。同一行为已由 `oamp/test/tool-permission.test.js` 的 `M4/C2+C4` 用例（fake 层）固定。

---

## 6. 审计行（**不作判据**，仅记录）

- `write-allow`：`[{"type":"ACP_READY"},{"type":"TOOL_CALL","title":"Writing test file"}]`（无 `TOOL_APPROVED`/`TOOL_DENIED`——审批门不产生权限审计行）
- `write-deny`：`[{"type":"ACP_READY"},{"type":"TOOL_CALL","title":"Writing requested file"}]`
- `bash-allow`：`[{"type":"ACP_READY"},{"type":"TOOL_APPROVED","option":"allow_once"},{"type":"TOOL_CALL"},{"type":"TOOL_CALL"}]`
- `bash-deny`：`[{"type":"ACP_READY"},{"type":"TOOL_DENIED","option":"reject_once"},{"type":"TOOL_CALL"}]`

以上四组结论均**不依赖**这些行——判据仅为 §1 的模型侧工具结果与副作用文件状态。
