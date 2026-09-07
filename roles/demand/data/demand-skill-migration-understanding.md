# demand 角色 skill 化理解记录

**时间**: 2026-09-06  
**状态**: 已对齐，待落地

---

## 核心理解：skill 是协议概念，不是文件系统位置

**错误理解**（已纠正）:
- ❌ role 和 skill 是两份文件，需要双轨同步（roles/ 和 .claude/skills/）
- ❌ skill 化 = 迁移到 Claude Code 专属的 .claude/skills/ 目录
- ❌ 迁移后会失去"宿主无关"特性

**正确理解**:
- ✅ role 文件本身就是 skill 定义，是同一份产物
- ✅ "skill" 是协议概念，指"agent 的标准协议单元"
- ✅ 物理位置不变（`roles/<role>/<role>.md`）
- ✅ 三级记录结构不变（`<role>.md` + `memory.md` + `data/`）
- ✅ 框架保持宿主无关——skill 会交给主 agent 去加载，不依赖 `.claude/skills/` 机制

---

## 实际改动范围（收敛后）

### 1. 概念性声明 - `principles/meta/agent-design-protocol.md`
补充一条说明: role 文件本身就是 skill(agent 的标准协议单元)，不是"角色描述文档"。
→ 这样"派发角色"和"加载 skill"在概念上等价。

### 2. 派发机制升级 - `workflow-pb.md` + `SKILL.md`（核心改动）
**从**: 「角色派发契约」= brief 里给角色文件路径，子 agent 自己决定要不要读、读多细
**到**: 主 agent 派发前必须先读出角色文件全文内容，把全文显性地嵌入子 agent 的 brief/初始指令里

**为什么改**: 用"内容前置注入"替代"路径引用+自觉阅读"，提高机械项(CRITICAL清单、报告契约字段)的遵循度。

**具体位置**: 
- `roles/workflow-pb/workflow-pb.md` § Brief 构建规则
- `.claude/skills/workflow-pb/SKILL.md` § Brief 构建规则（同步）

### 3. `create-role` 的产物表述
创建角色 = 创建 skill，是同一份产物（`<role>.md` + `memory.md` + `data/`），不产出额外文件。
更新措辞和 `role-structure-reference.md` 里的概念说明，把"派发时全文注入"这条规则也写进新角色应遵循的派发方式里。

---

## 落地顺序（验证驱动）

1. **先只改 demand 这一条派发路径**，下次派发 demand 时验证"全文注入"是否真的解决遵循度问题
2. 验证后再决定要不要把这个派发机制推广到其余 8 个角色

---

## 不改动的部分（明确排除）

- ❌ 不新建 `.claude/skills/demand/` 目录
- ❌ 不产出 `SKILL.md` 额外副本
- ❌ `roles/demand/` 目录结构、文件名、三级记录机制全部保持不变
- ❌ 不修改 `workflow-pb.md` 的"宿主无关"声明——框架仍然是宿主无关的
