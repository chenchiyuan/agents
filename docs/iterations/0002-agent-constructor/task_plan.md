# 任务计划：agent 构造器 MVP

**对应**: `docs/mvp-plan.md` 阶段 2
**状态**: 初步实现完成，待迭代

## 目标

基于阶段 1 跑通的 `roles/dev/` 真实结构，抽象出"给定角色名，生成合规骨架"的构造流程。

## 做了什么

1. `roles/_template/role.md.template` —— 角色定义模板。占位符对应 `principles/meta/agent-design-protocol.md` 里的简化七层：role（identity/relationship/character）、一句话职责、判断框架、能力边界、执行原则引用、报告契约、决策记录标准。这套结构直接抄自 `roles/dev/dev.md` 跑通后的真实骨架，不是凭空设计。
2. `tools/new-role.sh <role-name>` —— 构造器脚本：
   - 生成 `roles/<role>/{<role>.md, memory.md, data/}`
   - `<role>.md` 从模板渲染，替换 `{{ROLE_NAME}}`/`{{DATE}}`，其余 `{{...}}` 占位符留给设计者手填（identity 的 L4 精度、能力边界等判断类内容不能自动生成）
   - 生成后自动跑 `check-role-structure.sh` 校验，构造出来的骨架必须自证合规
   - 目标目录已存在则拒绝覆盖

## 未做（有意延后，不是遗漏）

- 未自动填充 identity/character 等判断类内容——这些需要"设计一个新角色"本身的思考，构造器只保证结构合规，不能也不该自动生成判断
- 未写自动化测试——用户明确说先做初步实现和骨架，不着急补测试
- 未处理"角色已存在时更新/合并"的场景——当前只支持全新创建

## 验证方式（已执行，非正式测试）

手动跑 `tools/new-role.sh _sanity-check-tmp`，确认：
- 生成的目录结构通过 `check-role-structure.sh` 校验（exit 0）
- 已清理该临时目录，不留痕迹

## 状态

- [x] 模板设计（基于 roles/dev 真实产出反推）
- [x] 构造器脚本实现
- [x] 手动验证一次生成-校验闭环
- [ ] 用构造器生成第二个真实角色（留给后续迭代，需先确定第二个角色是什么）
- [ ] 补充自动化测试（用户已明确延后）

---

## 修订：v0.6.0 — 验证收回内部，不对外暴露成独立 skill（2026-09-01）

**问题**：v0.5.0 把创建和验证拆成 `create-role` + `verify-role` 两个平行对外暴露的 skill。用户指出这违反
"一个能力单元应在自己边界内自闭环"的原则——`verify-role` 是 `create-role` 自己 Verify 步骤的实现细节，
不该独立暴露成任何人都能单独调用的 skill；并提出通用原则："任何 role 都应具备完整的
Plan-Execute-Verify-Fix-Reflect 闭环，自己能闭环定义好的边界"。

这次讨论还挖出一个更深的问题：此前的 harness 循环协议（Context→Align→Plan→Work→Verify→Deliver→Reflect）
本身没写清楚 Verify 失败后怎么办——没有显式的 Fix 回环。`verify-role` 拆成独立 skill 这个设计错误，
本质上是这个协议缺口的一个具体表现：协议没告诉"验证不通过怎么办"，于是把"怎么办"外包成了另一个 skill。

**改动**：
1. 删除 `.claude/skills/verify-role/`
2. `principles/meta/agent-design-protocol.md` 升到 v0.6.0：
   - 标准协议的宏观阶段从"验证→交付→反思"改为显式的"验证→修复→反思"，新增独立的 Fix 阶段说明
     （结构性问题直接改，判断性问题回 Execute 重新推理，修复后必须重新走 Verify，不允许跳验证）
   - 新增「闭环边界」独立章节：说明为什么 Verify 不能拆成对外暴露的独立 skill（打散能力单元边界、
     违反最小完备工具集支柱），以及"创建者不能自证完成"这个价值该怎么保留（内部派发无上下文子 agent，
     不是靠拆 skill）；给出判断标准——一个能力要不要独立暴露，看它是否会被其他上游任务独立调用
   - 变更记录如实记录 v0.5.0 被推翻的原因
3. `create-role/SKILL.md` 改写到 v2.0.0：Verify 步骤改为"用 Agent 工具派发无上下文子 agent"，子 agent 不继承
   创建过程的推理上下文，只读最终文件独立判断；新增显式 Fix 步骤，明确"修复后要重新派发新的子 agent 重新验证，
   不能复用已经知道问题答案的子 agent"；CRITICAL 红线新增"绝不把验证拆成外部可单独调用的 skill"
4. `roles/dev/dev.md` 同步补上显式 Fix 回环（第 6 步"修复"），Verify 不通过时的处理路径写清楚，
   版本号升到 0.3.0

**验证**：`create-role` skill 已重新注册，描述里体现了"内部自带完整闭环、验证由内部派发的无上下文子 agent
完成、不对外暴露"；系统技能列表确认 `verify-role` 已不存在。`roles/dev` 重跑 `check-role-structure.sh` 仍为 OK。

**遗留**：`create-role` 这套新协议（尤其是"内部派发无上下文子 agent做 Verify"这个机制）尚未实际跑过一次真实
创建流程验证。下一步该做的是实际调用它创建一个真实角色，检验协议是否可执行，而不是继续在纸面上迭代协议本身
——如果这次真跑之后还发现问题，应该是"跑了才发现"的具体问题，不是"想到了就先改"的臆测问题。

**状态**: 架构调整完成，等待第一次真实调用验证。

---

## 修订：v0.5.0 — 创建/验证拆成两个 skill，取代脚本驱动（2026-09-01）

**问题**：v0.4.0 虽然改成了反射协议，但落地方式仍是"脚本建骨架 + AI 手动 Write 内容"的松散组合，
没有固定流程、没有强制的独立验证环节，创建者（AI）自己写完就能自己宣布完成。用户指出：
1. 创建角色不该由 `tools/new-role.sh` 驱动，应该是一个 `create-role` skill
2. 验证应该是另一个独立 skill（`verify-role`），不能自证完成
3. 创建这件事本身也要遵循计划→执行→验证→修复→沉淀的 harness 循环——这和角色执行任务时用的循环是同构的，
   只是这次任务是"造一个角色"，执行者是主 agent 自己

**改动**：
1. 删除 `tools/new-role.sh`（唯一职责"建目录"并入 `create-role` 的落盘步骤）
2. 新增 `.claude/skills/create-role/SKILL.md`：定义创建角色自身的 5 步 harness 循环
   （计划→反射三步执行→移交 verify-role 验证→根据问题清单修复→沉淀经验），
   CRITICAL 红线明确"绝不自己验收，必须调用 verify-role"
3. 新增 `.claude/skills/verify-role/SKILL.md`：独立验证 skill，不接收创建者的推理上下文，只读最终落盘文件。
   分两层检查——结构层（复用 `check-role-structure.sh`）+ 内容层（占位符残留/identity 精度/原则是否真内联/
   Strategy 是否具体/harness 循环是否完整/反射依据是否留痕），逐项要求给出文件证据，不接受"看起来还行"
4. `principles/meta/agent-design-protocol.md` 升到 v0.5.0：「角色反射协议」章节新增「创建与验证分离为两个 skill」
   小节，说明脚本驱动为何被两个 skill 取代；变更记录如实记录这次架构调整的原因——单一执行者既创建又验收等于
   自己给自己判卷

**验证**：两个 SKILL.md 文件已创建并被系统识别注册（见工具列表）。尚未实际调用 `create-role` 走一遍完整流程
创建一个真实角色——这是下一步该做的事，不是这次修订的一部分。

**遗留**：
- `roles/dev/dev.md` 仍是旧方法（v0.3.0 填空式）产物，未走过新的反射协议 + 独立验证。是否要用
  `create-role`/`verify-role` 重新过一遍 dev 角色，留给用户决定
- `verify-role` 目前的"内容层"检查依赖 AI 阅读判断，没有可脚本化的自动断言（比如占位符残留可以用
  `grep '{{' ` 半自动化，但"Strategy 是否具体"本质上不可能纯脚本判断）——这是设计上的取舍，
  不是遗漏：内容质量判断本身就不该退化成脚本规则表，否则会重新掉进"填表格"的坑

**状态**: 机制已搭好，等待第一次真实调用验证闭环是否可执行。

---

## 修订：v0.4.0 — 禁止占位符，改为角色反射协议（2026-09-01）

**问题**：v0.3.0 及之前的构造器设计核心是"渲染带 `{{...}}` 占位符的模板骨架，判断类内容留白等人填"。
用户明确否决这个形状本身："禁止使用占位符，必须用反射的方法利用 AI 的优势根据需求生成角色"，
"我要的不是填空，而是 AI 真正的思考解决问题"。并指出反射/元思想是本项目最重要的思想之一，要求写入项目级经验供后续参考。

这不是内容深度不够的问题——是生成方式的形状错了。填空式生成把"设计一个角色"降级成了"补全一份表格"，
不管占位符提示写得多细，都不产生真正的判断。此前两次被判定"只能算是个结果"/"将就"，根因是同一个。

**改动**：
1. `principles/meta/agent-design-protocol.md` 升到 v0.4.0：新增「角色反射协议」独立章节，改写自
   powerby-skills 的 `pb-v1-talk` 角色反射机制——反射三步（提取核心任务类型→构造角色描述→展示确认），
   反射结果标记 `model_inferred`，用户确认前不可定稿写入；明确构造器脚本职责收窄为纯机械操作，
   绝不渲染判断类内容模板；变更记录如实记录 v0.3.0 及之前设计被推翻的原因。
2. `roles/_template/role.md.template` → 重命名为 `role-structure-reference.md`，内容从"待填占位符"
   改写为"结构清单说明"：每个 section 回答"要放什么、为什么、对应哪一层"，不含任何 `{{}}` 语法，
   明确标注"不是模板，不会被脚本渲染"。
3. `tools/new-role.sh` 大幅收窄：删除模板渲染、原则起草库注入、awk 内联替换等全部内容生成逻辑，
   只保留建 `roles/<role>/data/` 目录骨架 + 提示下一步该做什么（走反射协议、AI 直接 Write 角色文件）。
4. 原则注入方式改变：不再由脚本机械注入 `core-principles.md` 内容到固定占位符位置，而是作为反射 Step 2
   （构造角色描述）时的参考素材——挑哪些条目、怎么改措辞，是推理决定，不是脚本决定。

**验证**：
- 沙箱角色生成测试：脚本只建出 `data/` 目录，不再产出任何 `.md` 内容文件，符合"脚本不生成判断类内容"的边界
- `roles/dev` 重跑 `check-role-structure.sh` 仍为 OK（这次改动没有触碰 `roles/dev/dev.md` 本身）
- `tests/test-check-role-structure.sh` 6/6 仍通过，回归确认校验脚本本身不受影响

**遗留**：`roles/dev/dev.md` 目前的内容是 v0.3.0 阶段用旧方法（填空式，非反射协议）写成的，
虽然结构仍合规，但没有经过反射三步的确认留痕。是否需要用新协议重新反射一遍 `dev.md`，留给下一步用户决定。

**状态**: 已完成，等待用户评审。下一步建议：用新协议实际反射并生成一个真实角色（新角色或重做 dev），验证协议可执行。

---

## 修订：v0.3.0 — 原则内联，不引用（2026-09-01）

**问题**：v0.2.0 里角色文件用 `principles: $ref(principles/execution/core-principles.md)` 引用共享原则文件。
用户指出："遵循 principles/execution/core-principles.md" 这种引用表达方式不对——角色的原则是最重要、
需要持续迭代升级的部分，引用会让原则被冻结在共享文件里，改一次影响所有角色，导致谁都不敢改，
原则无法针对单个角色的真实案例演化。

**改动**：
1. `principles/meta/agent-design-protocol.md` 升到 v0.3.0：新增「原则内联，不引用」章节，明确原则要从
   `core-principles.md` 整段复制进角色文件、写入后独立演化；七层结构表约束层描述同步更新；
   变更记录里如实记录 v0.2.0 的引用式设计被推翻的原因。
2. `principles/execution/core-principles.md` 降级定位为"起草库"（不是运行时依赖），frontmatter 和正文
   开头都改写说明这一点。
3. `roles/_template/role.md.template`：去掉 frontmatter 里的 `principles: $ref(...)` 字段，新增独立的
   「原则」章节 + `{{PRINCIPLES_STARTER}}` 占位符。
4. `tools/new-role.sh`：新增从起草库提取正文、注入到 `{{PRINCIPLES_STARTER}}` 位置的逻辑。**过程中发现真实
   bug**：第一版用 `awk -v starter="$multiline_string"` 传多行内容，macOS 自带 BSD awk 处理 `-v` 里的嵌入
   换行不可靠，导致占位符没被替换（残留在生成文件里）。改为写临时文件、awk 用 `getline` 逐行读取替换，
   验证通过后删除临时文件。
5. `roles/dev/dev.md` 同步改写：去掉 `principles: $ref(...)`，原则章节改为角色自己的独立小节（红线/理解优先/
   简单优先/外科手术式精准/验证优先/失败处理/边界纪律），逐条按 dev 角色场景调整措辞和适用场景说明。
6. `docs/iterations/0000-project-design/clarifications/protocol-depth/round-1.md` 的 CLR-PD-004 按台账防腐规矩标记为"修订生效"，保留原引用式
   结论的文字，附上修订结论和原因，不直接删除旧结论。

**验证**：
- 重新生成沙箱角色，确认「原则」章节被起草库内容完整注入，无 `{{PRINCIPLES_STARTER}}` 残留
- `roles/dev` 重跑 `check-role-structure.sh` 仍为 OK
- `tests/test-check-role-structure.sh` 6/6 仍通过（这次改动没碰这个脚本，回归确认不受影响）

**状态**: 已完成，等待用户评审。

---

## 修订：v0.2.0 — 补齐 harness 循环结构（2026-09-01）

**问题**：v0.1.0 生成的模板把"判断框架"压缩成一句笼统的三步棋，没有把用户最初需求里明确要的 harness 循环
（Thought-Action-Observation 微循环 + 再循环）结构化进模板，七层结构和三支柱也没有真正落到每个 section 上。
用户判定为"只能算是个结果"，要求不妥协重做。

**改动**：
1. `principles/meta/agent-design-protocol.md` 升级到 v0.2.0：新增「标准协议：agent 自闭环生命周期」独立章节，
   把 7 个宏观阶段（Context→Align→Plan→Work[T-A-O 微循环]→Verify→Deliver→Reflect）和三支柱、七层结构的对应关系明确写死；
   七层结构表新增「流程层」为强制第七层。变更记录追加在文档末尾，保留 v0.1.0 被推翻的原因，不抹掉。
2. `roles/_template/role.md.template` 重写：新增 `Workflow: agent 自闭环生命周期` 独立 section，
   七个阶段逐一展开占位符；`Strategy` 一节改为"核心哲学一句话 + 对抗惯性表 + 判断锚点"结构，
   不再是笼统的三步棋；新增「成功标准」独立 section（此前隐含在判断框架里，未显式化）。
3. `roles/dev/dev.md` 用新模板重写到 v0.2.0，作为标杆——这是唯一经过真实任务验证过的角色，
   用它证明新模板填出来的内容质量，不是占位符能力测试。重写后重跑 `check-role-structure.sh` 确认仍合规。

**验证**：`./tools/check-role-structure.sh roles/dev` → OK。`dev.md` 的 Workflow 一节现在能回答
"这个角色收到简报后具体怎么一步步跑到交付"，不再只是静态边界列表。

**状态**: 已完成，等待用户对新版 `dev.md` 和模板的评审。
