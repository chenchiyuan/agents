# clarifications/2026-09-14-architect-round1.md — 0023 阶段 3（技术架构）第 1 轮记录

**迭代**: 0023-yolo-approval-and-question-inbox
**阶段**: 3（技术架构）
**产出者**: architect
**日期**: 2026-09-14
**本轮性质**: **第 1 轮（未收口）**——产出 `architecture.md` v0.1.0 + 16 张卡的「架构待填」回填 + 6 条真实探针；**L1 候选 7 条已列出、未实施**，等主 agent / 用户确认后按 0022 体例收口（第 2 轮）。
**体例参照（只读）**: `docs/iterations/0022-agent-launcher-and-protocol-layer/architecture.md` + `clarifications/2026-09-14-architect-round1*.md`（0022 的两轮记录）

---

## 1. 本轮输入（只读）

| 输入 | 版本 / 内容 | 用途 |
|---|---|---|
| `prd.md` + `prd/F01~F16*.md` | v0.2.0（16 卡：11 需求功能点 + 5 保证项；`[架构待填]` T-01~T-08） | 待填项与验收面 |
| `demand.md` | v1.0.0（W1~W6 / N1~N12 / M1~M8 / E1~E9 / R1~R5 / 登记⑧ 五类处置） | 需求层形态与硬约束（**只读，未写入**） |
| `clarifications/2026-09-14-*.md` + `clarifications/probes/probe-r1*` | K11（RPC 无原生 `ask`）/ K12（宿主工具通路可跑） | 已闭合事实 |
| `oamp/src/**` + `oamp/web/**`（实读） | 现状基线（§1，逐条带 `文件:行号`） | 现状演进（不做白纸架构） |
| `docs/iterations/0022-*/architecture.md` | 体例（L1/L2 分级、实测先行、T 项逐条落定、自查表、必然变更点清单） | 文档体例 |

**未读**（避免把他人结沦当依据）：0021/0022 的 prd 卡片正文（只在明确需要对照口径时按 `demand.md` 引用的条款号回指）。

---

## 2. 方法：先实测后定型（本轮 6 条探针）

按任务要求，**L2 接口按实测定型、不按假设**。6 个探针脚本 + 6 份原始输出均落在本迭代工作区的 `clarifications/probes/`（可复跑；探针只读 omp 安装包与真实进程；R4 的"用户策略例外"用 `--config` 临时 overlay 落在 `/tmp`，**未读写 `~/.omp`**）。

| 探针 | 结论摘要 |
|---|---|
| **A2**（acp `ask` 帧面） | 一次 `ask(N 问)` ⇒ **恰 1 帧** `elicitation/create{mode:'form', message:'Answer N questions', requestedSchema:{properties:{q0..q{N-1}, q0__other..}}}`；单选 `string`+`oneOf[{const,title}]`、多选 `array`+`items.anyOf[]`、每问恒附 `q{i}__other` 自由文本；**审批门靠 `properties.value.enum ⊇ {Approve,Deny}` 区分**；客户端回**恰 1 帧** `{action:'accept', content:{q{i}:…, q{i}__other:…}}` ⇒ `session/prompt` 以 `stopReason:'end_turn'` 正常结算 |
| **R2**（宿主工具四场景） | ① ready **前**发送 `set_host_tools` 亦被受理（回包在 ready 后、`toolNames:["ask_user"]`）② 重复注册 = **替换**（不累加）③ `--no-tools` 下**仍可注册且模型可调用** ④ `host_tool_call` 后该轮**保持在飞**（延迟 8s 回包期间无 `agent_end`），回包后该轮继续并正常收尾 |
| **R2b** | 注册一次后**跨轮存活**（同一会话第 2 轮仍可调用） |
| **R3** | `{cancelled:true}` 与 `{value:'Deny'}` **等价**：工具被拒 ⇒ **该轮照常继续并正常收尾**（`agent_end{isTerminal:true}`、`stopReason:'stop'`）——**现状不存在"该轮以 `permission_denied` 中止"的观测面** |
| **R3b** | `cancelled:true` 后补 `{type:'abort'}` ⇒ 0.3s 内 `turn_end` + `agent_end{isTerminal:true}`；**同一会话随后仍可正常跑下一轮** ⇒ 中止是**轮次级**（不杀进程） |
| **R4** | `--approval-mode yolo` + `write`/`bash` ⇒ **零门**且工具**确实产生后果**（E1 两半句同时成立）；`--config` 叠加 `tools.approval.bash: prompt` ⇒ **yolo 下仍出现门**（形态与 always-ask 下一致：`select` + `["Approve","Deny"]` + `Allow tool: …`）；叠加 `deny` ⇒ 无门、被策略阻止 |

**实测推翻的既有假设（1 条）**：R3 —— F03 验收 3 / MI-02 要求 rpc 链路观测「该轮以 `permission_denied` 中止」，而**现状只有"拒工具、轮次照常跑完"**。⇒ 架构必须补「中止该轮」这一步（`architecture.md` 流 5 / §5.1 / §9）。

**实测发现的上游硬约束（1 条）**：A2 + omp 源码 —— acp 的 `askDialog` 解析规则为 `customInput === undefined && labels.includes(value) ? [value] : []`（单选分支）⇒ **acp 单选提问里"选项 + 自由文本"并存时选项被上游丢弃**（多选分支两者都保留）。hub 侧不可解（解即改上游 = 违 N3 / F12）。

---

## 3. 决策分级（本轮）

### 3.1 L1 候选（**7 条，已列出、未实施，等主 agent / 用户确认**）

| # | 决策 | 推荐 | 被否候选 |
|---|---|---|---|
| L1-1 | 档位解析的**唯一汇聚点**落点（T-01） | `protocol.js::resolveApproval(spec)`（唯一注入点，`createProtocolLayer` 求值一次） | ① `agent.js` 启动段求解 ② 各实现各自求解（现状，正是要被消灭的形态） |
| L1-2 | 档位配置面落点与键名（T-07） | `config.json` 第 5 键 `approval` + `agent start --approval-mode`（Q3 原词；**不加 env 键**） | ① 加 `OAMP_APPROVAL` ② 只在 CLI |
| L1-3 | 提问信封字段形状（T-02） | 新增 `kind` + `multiple`；问题文本复用 `title`、选项复用 `options`；自由文本由 `kind:'question'` 蕴含 | ① 再加 `question` / `allow_text`（后者恒真）② `payload` 子对象 |
| L1-4 | 裁决回传载荷字段（T-04） | 按 `kind` 分化：question = `option_ids[]` + `text`；permission = 既有 `option_id` + `text`（逐字不变） | ① 统一数组化（改既有结算路径）② `answer` 子对象 |
| L1-5 | acp 组内暂存形态（T-03） | 该帧处理函数内的**局部状态**（帧 id + 每题一个未结算 Promise + 聚合并答） | ① 新增"提问组表"模块 ② 复用 agent 的 `pending` 表分组 |
| L1-6 | 宿主工具命名 / schema / 注册时机（T-05） | `ask_user` + `{question, options?, multiple?}` + **握手完成后注册恰一次** | ① 命名 `ask` ② 每轮重复注册（被 R2 S3 实测否决） |
| L1-7 | 能力位集合与签名 / 档位声明面（T-06 + M8） | 能力位**不变**；档位声明独立表达（`spec.approval` + `AGENT_START.approval` + argv） | ① 能力位加 `approvalMode` ② `capabilities().approval` 子对象 |

### 3.2 L2 决策（自主决定，9 条，理由见 `architecture.md` §4.2）

档位不再由 profile 静态表承载（`mode` 删除、保留 `appliesWhen`；`buildArgv` 的 `approval` 入参改为已解析档位、未给则响亮失败）；`omp:oneshot` 行 `appliesWhen` 由 `'always'`（既有死值）改为 `'tools-on'`；提问钩子命名 `onQuestionRequest`（与门钩子**同形同注入点**，但**注入条件不同**——门钩子仍由 `permission === 'allow'` 判定、提问钩子**恒注入**，依据 M6「提问类请求**一律**登记待答、不代答拒绝」与 F04 验收 4「提问上浮不随档位变」；`deny` 实例上"工具门零上浮 + 提问仍上浮"并存、互不冲突）；question 类 `option_id` = `label`；宿主工具回包文本渲染模板；未知 elicitation 形状维持 `decline`；MI-03 必填性在服务端判定；question 类前端交互 = 多选取舍 + 提交（permission 类不变）；`AGENT_START` 事件新增 `approval` 字段。

### 3.3 L3（实现细节，未在报告中专门说明）

渲染模板的具体分隔符、宿主工具 `label` 文案、多选控件的 DOM 形态等。

---

## 4. 待转呈清单（本 agent 无对话通道，**未自行拍板**）

### 4.1 疑问（3 条，见 `architecture.md` §12.1）

| # | 疑问 | 建议处置 |
|---|---|---|
| Q-1 | **F05 验收 3 在 acp 链路的不完全成立**（单选中"选项 + 文本"并存 ⇒ 选项被上游丢弃；改则违 N3 / F12） | **(a)** 按 R4 已登记的"两条链路形状不等价"处理：默认链路满足验收 3，acp 单选 + 文本组合按"文本胜出"如实登记（**推荐**）；(b) 改卡把验收 3 限定到"默认链路 + acp 多选"（产品维度，本 agent 不做）；(c) acp 侧禁用"选项 + 文本"并存提交 |
| Q-2 | acp 单值形状（`select` / `confirm` / `input`）的映射细节（`confirm` ⇒ 选项「是/否」；单值形状二者取一） | 复核是否接受（属 M4 的"等价呈现"，未见与验收冲突） |
| Q-3 | 档位配置面**统一作用于三条路径**（含 `omp -p` 一次性路径） | 请确认（替代方案 = 给一次性路径开例外 ⇒ 第二个判定点，与 F03 验收 4 相冲） |

### 4.2 `[model_inferred]`（4 条，见 `architecture.md` §12.2）

MI-1 不加 env 键；MI-2 question 类改为"取舍 + 提交"；MI-3 `confirm` 映射为「是/否」；MI-4 宿主工具回包文本模板。

---

## 5. 本轮自检

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 基于现状演进（非白纸架构） | ✅ §1 逐条带 `文件:行号`；新增组件 0、新增模块 0、新增依赖 0 |
| 2 | L2 接口按实测定型 | ✅ 6 条探针（§2）；注册时机/替换语义/`--no-tools`/跨轮存活/abort 语义/零门 六条实测事实逐条进 §5 |
| 3 | 16 张卡全部有技术路径 | ✅ `architecture.md` §6 16/16 |
| 4 | `[架构待填]` T-01~T-08 全部落定 | ✅ §7 8/8；`prd/F01~F16*.md` 的该段**已由留白改为"已回填"**（产品维度逐字未动） |
| 5 | L1 未擅自实施 | ✅ §4.1 七条只列不落；未写任何实现代码 |
| 6 | 无架构内部冲突 | ✅ §8 C1~C14 |
| 7 | 范围纪律 | ✅ 未做任务拆解、未写实现代码、未改产品维度、未改 `demand.md`、未做 git 写操作 |

---

## 6. 未越界声明

本轮的**唯一写入**均在本迭代工作区内、以绝对路径寻址：

- 新增 `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md`；
- 新增 `clarifications/probes/` 下 6 个探针脚本与 6 份原始输出（`probe-a2-acp-ask-form.mjs` / `a2-acp-ask-form-output.txt` / `probe-r2-host-tools.mjs` / `r2-host-tools-output.txt` / `probe-r2b-host-tool-persistence.mjs` / `r2b-host-tool-persistence-output.txt` / `probe-r3-deny-autoreject.mjs` / `r3-deny-autoreject-output.txt` / `probe-r3b-abort-semantics.mjs` / `r3b-abort-semantics-output.txt` / `probe-r4-yolo-gate.mjs` / `r4-yolo-gate-output.txt`）；
- 新增本文件；
- **回填** `prd/F01~F16*.md` 的「架构待填（阶段 3）」段（`F13~F16` 为"无待填项"的复核结论；**产品维度未改**）。

**未触碰**：`demand.md`、`prd.md`（沿用 0021/0022 体例：prd.md 的 T 表是阶段 2 留档，阶段 3 不在其上回填）、`status.md`、`history.md`、既有 `clarifications/*.md`、`oamp/**`（只读）、`roles/**`、`docs/iterations/0021-*/**` 与 `0022-*/**`（只读体例参照）；**未执行任何 git 写操作、未运行 oamp 测试套件**。
