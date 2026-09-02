# 案例：独立验证两次都真实抓到了创建者自己会漏掉的问题（好做法）

**记录日期**: 2026-09-02
**来源**：pr-planner + progress-observer 创建过程，原记录于 `roles/retrospective/data/retro-2026-09-02-workflow-pb-v2.md`（2026-09-02 归属重整时移入本文件，理由见 `roles/retrospective/data/retrospective-changelog.md` v0.3.0）

## 做了什么

pr-planner 和 progress-observer 创建时都严格执行了"每次修复后必须派发全新的无上下文子 agent 重验，不复用已经知情的子 agent"，两次都在第一轮真实发现了创建者自己没意识到的问题（见 `reflection-to-file-drift.md`）。

## 为什么有效

如果复用同一个子 agent 或由创建者自己复查，很可能会被"记得设计意图是对的"这种记忆蒙蔽，看不出文字表达上的偏差——这是"验证不能自证"这条已有核心原则在本次创建过程里被真实验证有效的证据，不是新发现，是既有原则的正向确认。

## 经验总结

无需新增原则，已有 `agent-design-protocol.md`「闭环边界」章节覆盖。本记录作为该已有原则有效性的证据保留。
