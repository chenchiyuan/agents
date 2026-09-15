# F01 · 存量测试资产清零

**来源**：demand.md 做什么 W-1（三条动作）；结论 Q8 / Q12；§5 影响面表第 2/3 行

## 用户价值

仓库里不再存在一套"看起来能跑、实际只会烧时间"的测试入口——任何人（人或 agent）从库里读到的测试承诺与真实资产一致，不会因为读到 `npm test` 就去运行一个已经清零的套件，也不会在每次派发里重复支付全量套件的固定成本。

## 验收标准

1. `oamp/test/` 目录不存在（整目录移除，含 `helpers/harness.js`、`helpers/fake-node.js`）；`git ls-files oamp/test` 零命中（V-1）。
2. `oamp/package.json` 不含 `scripts.test` 这个 key（是整体移除，不是把它改指向空套件）；该文件其余字段（`name` / `private` / `type` / `bin` / `engines` / `dependencies`）逐字不变，`dependencies` 仍为空对象；`grep -n '"test"' oamp/package.json` 零命中（V-2）。
3. `oamp/README.md` 全文不含「由 `npm test` 强制」字样——「漂移锁…三条锁由 `npm test` 强制」整句移除（V-2）；同段落中"存在三条漂移锁"这一事实描述与「重新生成索引快照」命令保留不变：删的是"由 npm test 强制"这项承诺，不是漂移锁本身。
4. 清理不引入任何替代机制：仓库内不因本次清理新增 CI 配置、git hook、`package.json` 的替代 script（如 `test:legacy`）、或 `oamp/test/` 占位文件。
5. `oamp/src`、`oamp/web`、`oamp/bin` 三个目录零改动（`git diff` 无命中）——"删除存量测试对运行时零影响"的既有结论（F-5）在改动后仍成立。

## 边界（不包含）

- 不新增任何测试用例——零测试交付是预期终态（§2）。
- 不保留 `helpers/` 脚手架（§6 被否决路径 3；"保留集首次重建需重写测试基建"的代价已登记）。
- 不改任何生产代码（§2）。
- 不处置 `oamp/test/` 之外的引用：`workflow-pb.md:56` 归 F02，§5 的第 4/5/6 处归 F05 / F06 / F09。
- 不定义"何时、是否重建测试"——归 F07。

## 架构维度

无待填项（纯删除，不涉及技术选型 / 数据模型 / 接口设计）。

## model_inferred

无。
