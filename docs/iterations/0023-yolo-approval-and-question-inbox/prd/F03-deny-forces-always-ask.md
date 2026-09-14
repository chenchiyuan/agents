# F03：`deny` 档能力保留（强制 `always-ask` 且优先于显式档位）

**功能 ID**: F03
**来源**: `demand.md` 第二段 §2 **W2**（`user_confirmed`：Q1 + **A5-P12** + **A5-P3**）；§4 **M1**；§5 **E2**、**E8**（`deny` 半句）；事实 **K9**（`yolo` 会跳过客户端权限门 ⇒ 门是拒绝能力的物理前提）/ **K8**（档位解析有两种自洽读法）/ **F1**（现状 `deny` 档恒拒绝并中止该轮）
**迭代**: 0023-yolo-approval-and-question-inbox
**产品对象（引用 `demand.md` 只读实测，非本阶段决策）**: F1（`deny` 档既有语义 = 恒拒绝 + `reject_once` + `session/cancel`，该轮以 `permission_denied` 收尾）；F11（默认配置的 ACP 会话仍保留客户端权限门，显式 `yolo` 才连门一起跳过）

---

## 用户价值

我不愿意放的仍然拦得住——"默认放行"不能顺手把"拒绝"这项能力吃掉。

## 验收标准

1. **`deny` ⇒ 档位强制 `always-ask`，且优先于显式档位**（W2 / M1 / E8 / A5-P12）：实例显式 `--permission deny` ⇒ 该实例档位为 `always-ask`（门存在）；**与显式 `--approval-mode` 冲突时以 `deny` 为准**。
   *判定*：同时给出 `--permission deny` 与显式 `--approval-mode yolo` → 发起一次受门禁调用 → **门仍然产生**（产生 = 正确，静默放行 = 失败）。
2. **`deny` 档的受门禁调用不上浮**（W2 / E2）：门由 hub 侧走既有自动拒绝，**不进入收件箱**。
   *判定*：发起一次受门禁调用 → 收件箱**零新增条目**。 〔判定方式逐字取自 E2 的裸判据〕
3. **该轮以 `permission_denied` 收尾**（W2 / E2）：该轮中止，且两条链路各有**可裸判定**的观测面〔`[user_confirmed]`（MI-02 已回收，裁决原件见 `clarifications/2026-09-14-prd-round1-verdicts.md`）〕。
   *判定*：**两条链路各跑一次**——① **`acp` 链路**：审批审计面出现 `TOOL_DENIED` 审计行（该链路本就有审批审计面）；② **`rpc` 链路**（默认）：该轮以 `permission_denied` 中止 **且** 收件箱零新增条目。`rpc` 链路本就零审批审计行（K6，**存量状态**），故**不得因此新增审计面**（不违 N4）；两条链路都不得出现新增的拒绝痕迹载体（出现即失败）。
4. **解析存在唯一汇聚点**（M1 / A5-P3）：`deny ⇒ always-ask` 的解析**不得依赖每个调用点自觉覆写**——档位解析只有一处汇聚。
   *判定*：复核档位解析的落点数量 → **单一**；不存在"某条链路 / 某个入口忘记覆写"的通路（存在即失败）。 〔解析落点本身 → T-01〕

## 边界（不包含）

- 不含**解析落点**（L1 静态数据 / L2 起会话前统一计算，两种读法均自洽 → T-01）。
- 不含档位的**默认值与可配面**（→ F01 / F02）；不含取值域校验（→ F02 验收 2~4）。
- 不含 `always-ask` 档下**由人裁决**的上浮路径（→ F10 验收 1）——本卡只覆盖 `deny` 实例的"门存在且自动拒绝"这一半。
- 不含既有自动拒绝三步骤（`reject_once` + `session/cancel`）的**改造**：本迭代沿用既有语义，机制不动。
- 不含**审批审计面的补偿**（**N4** 封死 → F13）：`deny` 档下的拒绝痕迹沿用既有面，不新增载体（MI-02 的 `rpc` 观测面亦不例外——`rpc` 侧只以"该轮以 `permission_denied` 中止 + 收件箱零新增条目"判定，不为它补任何痕迹）。
- 不含 `permission === 'allow'` 的档位语义句作为触发条件的用法（**登记⑧ ①取代**：触发条件已改为"档位 = `always-ask`"）。

## 架构待填（阶段 3 · **已回填**）

> **回填说明**：本节原为留白（阶段 2 体例）。阶段 3（技术架构）按 `docs/iterations/0023-yolo-approval-and-question-inbox/architecture.md` 落定，结论均在该文件的对应小节内可核（本轮另含 6 条真实探针证据，脚本与原始输出落 `clarifications/probes/`）。上方「越界自查」是**阶段 2 的历史自查记录**，其中「已落 T-xx 留白」一类表述由本节取代；**本卡的产品维度（用户价值 / 验收标准 / 边界）未被阶段 3 触碰**。

| 编号 | 原待填内容 | **架构落定（阶段 3）** |
|---|---|---|
| T-01 | 档位解析的归属与"唯一汇聚点"落点（默认值来源 / `deny ⇒ always-ask` 由谁算、算在哪一处 / 配置值参与解析的位置） | **唯一汇聚点 = `protocol.js` 的 `resolveApproval(spec)`**：`createProtocolLayer` 在装配时求值**一次**，结果写入 `spec.approval`，三个实现（rpc / acp / oneshot）只消费、不再判定（`oneshot-client` 里既有的"按 permission 自定义合成"删除 ⇒ F03 验收 4 的"每个调用点自觉"通路被结构消灭）。解析链：`permission === 'deny'` ⇒ `always-ask`（**优先于**显式档位）> 显式 `--approval-mode` > `config.json` 第 5 键 `approval` > 内置默认 `yolo`。argv 面：`profile.approval.appliesWhen === 'tools-on'` 且工具开 ⇒ 追加 `--approval-mode <值>`（工具关不追加）。（architecture §5.1 / §7 T-01 / 流 1 / L1-1） |
| T-07 | 档位配置面的落点与键名形态（配置项落点 / 启动参数形态 / 两档在两面上的表达 / 冲突时的取值表达面） | **配置面 = Q3 点名的两处**：① `config.json` **第 5 键 `approval`**（值域 `{always-ask, yolo}`，缺省 `yolo`；非法值 ⇒ `OAMP 配置错误: approval 仅支持 always-ask/yolo（当前值 …）` ⇒ `agent start` 退出 1）；② **`agent start --approval-mode <always-ask|yolo>`**（非法值 ⇒ 退出 2 并点名该值；未给 ⇒ 交解析链）。两处即 MI-01 的"非法取值 ⇒ 拒绝启动并报错、不静默回落"。**不新增 env 键、不新增控制台可切面**（Q3 未点名 / F01·F02 边界）。（architecture §5.1 / §7 T-07 / L1-2） |
## 口径更替落点（`demand.md` 登记⑧ ①取代）

- 0021 `F02` 验收 1（"`allow` 档的受门禁调用上浮"）与 0022 `W4` / `E4`（"一次受门禁调用恰一条确认项"）的**触发条件**从「`permission = allow`」改为「档位 = `always-ask`」；本卡的 `deny` 实例属于"门存在但**不给人**（自动拒绝）"的另一支，**机制不删**（上浮支路见 F10）。

## 越界自查

- 本卡未做技术选型 / 数据模型 / 接口设计；解析归属已落 T-01 留白。
- 验收 1~2 的判定方式**逐字来自** `demand.md` E2 与 W2 / M1 / A5-P12；验收 3 的 `acp` 半句取自 E2 的裸判据、`rpc` 半句取自用户裁决（MI-02）；**未自行放宽或加严**。
- 验收 3 的观测面已由用户裁决回收（MI-02 ⇒ `acp` 看 `TOOL_DENIED` 审计行；`rpc` 看「该轮以 `permission_denied` 中止 **且** 收件箱零新增条目」，`user_confirmed`），**口径原文照录**。E2 的"agent 侧有拒绝痕迹（`TOOL_DENIED`）"半句据此**按链路分工**落判定：`acp` 有行、`rpc` 以轮次中止 + 零新增条目判定，**未要求 `rpc` 补痕迹**（不违 N4）。
