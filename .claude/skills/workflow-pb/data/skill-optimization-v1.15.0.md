# SKILL.md v1.15.0 优化记录（对应规范 workflow-pb v0.13.0）

**日期**: 2026-09-15

**触发**：`roles/workflow-pb/workflow-pb.md` 升级到 v0.13.0——把提交管理协议（规则 A~H、隔离边界声明、角色定义来源与部署）拆到新文件 `data/scm-protocol.md`，把数据格式规范（PR 七字段、status.md、history.md）拆到新文件 `data/formats.md`，主文件收窄为纯流程契约。SKILL.md 是主 agent 调度协议的精简版，历史惯例是规范文件每次版本升级都同步——本次是路径引用的同步，不涉及流程语义变化。

## 改动

- description 与 Purpose 版本号同步为 v0.13.0
- 版本行改为 `**版本**: 1.15.0（对应规范 workflow-pb v0.13.0）`；完整规范行改为同时列出三份文件（workflow-pb.md 流程契约主体 + data/scm-protocol.md 提交管理协议 + data/formats.md 数据格式规范）
- CRITICAL 清单中指向"角色定义来源与部署""规则 D / 规则 H"的两条，路径改为指向 `data/scm-protocol.md`
- Tools and capability boundaries：「做什么」清单中"解析并声明工作区地址""隔离边界声明"两条改为指向 `scm-protocol.md`；"读取规范文件"补充列出三份文件
- Workflow Step 0：「工作区地址解析与声明」「角色来源解析」两步改为指向 `scm-protocol.md`
- § 角色文件来源与部署：真源判据说明改为指向 `scm-protocol.md`
- § status.md 更新时机 / § history.md 更新时机：格式定义行改为指向 `data/formats.md`
- § 对外协议·文档协议：产物字段/标注规则说明改为区分"路径由 workflow-pb.md 定义、字段格式由 formats.md 定义"
- Resources 清单：拆分为三行分别列出 workflow-pb.md / scm-protocol.md / formats.md 各自的读取时机
- Safety 清单末四条：角色定义根解析、工作区地址解析、寻址纪律三条改为指向 `scm-protocol.md`

## 未改变的部分

所有流程语义、CRITICAL 不变量的实质内容、Workflow 步骤顺序、用户决策点范围、并发槛位算法——本次只是路径引用从"规范 §XX"改为指向具体拆分后的文件，不改变任何判断标准或执行流程。
