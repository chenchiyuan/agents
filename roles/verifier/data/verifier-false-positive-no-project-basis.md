# 案例：验证标准脱离项目约定产生假阳性

**记录日期**: 2026-09-02
**来源**：0003-workflow-scm 迭代复盘，原记录于 `roles/retrospective/data/retro-2026-09-02-workflow-scm.md`（2026-09-02 归属重整时移入本文件，理由见 `roles/retrospective/data/retrospective-changelog.md` v0.3.0）

## 现象

verifier 报 A1/B1 partial，理由是 frontmatter 缺少 `version` 和 `created_at` 字段。实际项目约定是版本/日期写正文（已在 `dev.md`/`verifier.md` 确认），frontmatter 无此要求。

## 根因

verifier 的验证标准来自对"规范文件应有什么字段"的通用推断，不是对项目既有约定的核查。verifier 在比较"自己认为应该有什么"，不是"项目说应该有什么"。

## 经验总结（候选原则，暂未升级进 verifier.md 正文，待多次出现后再判断）

遇到 verifier 报 partial，先核查对应标准在项目约定中的出处，再判断是真实缺失还是标准过严；没有出处的验证标准要降级或修正，不当作真实问题处理。
