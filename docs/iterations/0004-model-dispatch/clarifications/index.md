# 澄清记录索引

## pr-concurrency
- [Round 1](pr-concurrency/round-1.md) — 后续迭代采用显式 DAG 默认并行；PR 强制声明 `depends_on`；实现完成加 commit SHA 即解除依赖；依赖 PR 使用 stacked worktree；多依赖使用依赖快照；开发并行、合并串行；失败阻塞依赖闭包；本轮先协议后 runtime；不迁移当前 0004 — caller: pb-v1-talk — 2026-09-02
