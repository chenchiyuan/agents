# 0023 architect 第 1 轮 · 用户裁决记录

**日期**: 2026-09-14（主 agent 阻塞式取得）
**转呈来源**: `architecture.md` §4（7 项 L1）+ §12（Q-1/Q-2/Q-3 + MI-1~MI-4）
**性质**: `user_confirmed`

---

## 一、7 项 L1 决策 —— **全部采纳推荐**

| # | 采纳结论 | 已否决读法 |
|---|---|---|
| **T-01** | 档位唯一汇聚点 = `protocol.js::resolveApproval(spec)`（唯一注入点，`createProtocolLayer` 求值一次）；解析链 `deny ⇒ always-ask > 显式 --approval-mode > config.json 第 5 键 approval > 内置 yolo` | agent.js 启动段求解；各实现各自求解（现状，即 F03 验收 4 要消灭的形态） |
| **T-07** | 配置面 = `config.json` 第 5 键 `approval`（缺省 `yolo`，非法 ⇒ OAMP 配置错误 / 退出 1）+ `agent start --approval-mode <always-ask\|yolo>`（非法 ⇒ 退出 2 并点名该值）；**不加 env 键、不加控制台可切面** | 加 `OAMP_APPROVAL`；只在 CLI |
| **T-02** | 提问信封新增 `kind` + `multiple` 两字段；问题文本复用既有 `title`、选项复用既有 `options`；自由文本由 `kind:'question'` 蕴含（不设恒真字段）；无选项 = `options: []` | 再加 `question` / `allow_text`（恒真）；`payload` 子对象 |
| **T-04** | 裁决回传载荷按 `kind` 分化：`question` = `option_ids[]` + `text`；`permission` = 既有 `option_id` + `text` **逐字不变** | 统一数组化（会动既有结算路径）；`answer` 子对象 |
| **T-03** | acp 组内暂存 = 该帧处理函数内的**局部状态**（帧 id + 每题一个未结算 Promise + 聚合并答）；无新模块 / 无跨帧状态 / 无定时器 | 新增「提问组表」模块；复用 agent 的 pending 表分组 |
| **T-05** | 宿主工具 = `ask_user + {question, options?: string[], multiple?: boolean}`；**握手完成后注册恰一次**（实测：ready 前/后均可受理；重复注册为替换语义 ⇒ 不得重复；`--no-tools` 下仍可用） | 命名 `ask`；每轮重复注册（被 R2 S3 实测否决） |
| **T-06 / M8** | 能力位集合与签名**不变**（六键、`approvalGate` 恒按协议）；档位声明独立表达（`spec.approval` + `AGENT_START.approval` 字段 + argv） | 能力位加 `approvalMode`；`capabilities().approval` 子对象（会使 F11 验收 3 失败） |

## 二、Q-1（产品级张力）—— **登记为必然差异**

- 事实：**acp 单选问**「选项 + 自由文本」并存时，omp 的 `askDialog` 解析规则**丢弃选项**（多选问两者都保留）——A2 探针 + omp 源码双证；改它即违 N3 / F12。
- 裁决：按已登记的 **R4「两条链路形状不等价」** 处置——**默认链路（rpc）满足 F05 验收 3**；acp 单选 + 文本场景按「**文本胜出**」登记为**必然差异**。
- **不动产品卡**（F05 验收 3 不改）；不采「改卡限定范围」与「acp 侧禁用该组合」两条读法。

## 三、Q-2 / Q-3 与 MI-1~MI-4 —— **全部按推荐**

| # | 采纳 |
|---|---|
| Q-2 | acp 单值形状（`select`/`confirm`/`input`）映射：`confirm` ⇒ 选项「是/否」；单值形状下**选项与文本二者取一** |
| Q-3 | 档位配置面对**三条路径**（rpc / acp / 一次性）统一生效；若配 `always-ask`，一次性路径在工具开启时会退化为 omp 侧自动拒绝（与既有 `--permission deny` 同形） |
| MI-1 | 不加 env 键 `OAMP_APPROVAL` |
| MI-2 | `question` 类改为「取舍 + 提交」（`permission` 类保持点选即裁决） |
| MI-3 | `confirm` 形状映射为「是/否」 |
| MI-4 | 宿主工具回包文本渲染模板按架构文档所拟 |

## 四、Q-3（prd 的 T 表）—— **不动 prd**

- `prd.md` 文末 T-01~T-08 表保持阶段 2 留档（与 0021/0022 体例一致）；回填结果集中在 `architecture.md` §7（8/8）与 16 张卡的架构段。

---

## architect 第 2 轮的处理清单

1. §4 的 7 项 L1「裁决」行改为 `✅ 用户确认（2026-09-14，采纳推荐）`，保留备选与否决理由。
2. §12 的 Q-1/Q-2/Q-3 与 MI-1~MI-4 改为已裁决（Q-1 按「登记为必然差异」落字，指向 R4）。
3. 文首状态行更新（L1 已确认 / `[model_inferred]` 归零 / 版本升 v0.2.0）。
4. 不得改动卡片产品维度、不得增删组件、不得修改已定稿的技术结论。
5. `prd.md` 零改动（按 Q-3 裁决）。
