# PR-009：内置默认模型修订 + 阶段 4 产物同步（补丁）

## 上下文摘要

用户 2026-09-10 决策（依据实测 V-13）：`openai/gpt-5.6-luna` 首 token 延迟 ≈242s 且间歇无响应 → **内置默认模型改为 `deepseek/deepseek-v4-flash`**，`gpt-5.6-luna` 保留为可指定值。本 PR 落地代码与阶段 4 产物中的旧值，消除"文档已改、代码未改"的不一致（architecture/README/prd 已由 architect/prd 角色更新，本 PR 覆盖 `config.js` 与 `prs/` 面）。

## 涉及功能点

- F06（模型选择与默认：默认值修订为 deepseek；优先级链不变）
- F07（配置面：内置默认取值同步）

## 文件范围

- oamp/src/config.js（`MODEL_DEFAULT` → `'deepseek/deepseek-v4-flash'` + 修订说明注）
- oamp/test/config-file.test.js（默认值断言同步）
- oamp/test/context-pool.test.js（连带：默认值相关断言 + fake ACP 兜底 + 切换目标改 `alpha/model-a` 以保住切换语义）
- oamp/test/web.test.js、oamp/test/acp-daemon.test.js（连带：同一 fake-ACP 兜底字面量一致性，死分支）
- docs/iterations/0011-chat-context-protocol/prs/{pr-001-config-surface-and-persistence.md, pr-001-tasks.md, pr-005-tasks.md}（旧值同步 + 修订注）

## 验收标准

- [ ] 无任何 `OAMP_*` env 时 `loadConfig({}).defaultModel === 'deepseek/deepseek-v4-flash'`（含默认导出真实 env 路径）；优先级链 env > config.json > 内置 保持正确
- [ ] 连带测试同步后语义未被削弱（尤其"切换模型不重建进程"用例的切换目标已异于默认值）
- [ ] `config-file.test.js` 与 `npm test` 全绿（152）；零新依赖
- [ ] 静态扫描：`oamp/src|test|web` 中 `gpt-5.6-luna` 仅剩合理残留（保留说明注 / DB 夹具字面量）
- [ ] 端到端：不指定模型经 Web 提问 → out `model=deepseek/deepseek-v4-flash` 且秒级完成

## 参考资料

- docs/iterations/0011-chat-context-protocol/clarifications/verify-20260910-180852-pr009.md（本 PR 验收报告）
- architecture.md §2 V-13（242s 实测）/§7.5（🔄 已修订：用户选择 b）/§16.5（补丁记录）/§18.1 NC-20
- prd/F06（默认值产品字面已同步）

## depends_on

- pr-001-config-surface-and-persistence.md（理由：修改对象是其落地的 `config.js` 默认值与 `config-file.test.js` 断言；证据：`oamp/src/config.js` 的 `MODEL_DEFAULT` 与加载器由 pr-001 引入）
- pr-003-context-pool-acp-daemon.md（理由：连带同步 `context-pool.test.js` 的默认模型断言；证据：该测试断言 agent 侧默认模型解析，由 pr-003 建立）

## batch

5
