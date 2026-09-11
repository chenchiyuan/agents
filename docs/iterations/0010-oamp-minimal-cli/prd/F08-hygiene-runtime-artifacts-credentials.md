# F08：卫生红线（运行时产物不入 git / 零凭据字段）

**功能 ID**: F08
**来源**: `demand.md` P-07（零凭据红线）、效果条款 E4（卫生）、N6（无 token 鉴权的否定面）
**迭代**: 0010-oamp-minimal-cli

---

## 用户价值

用户提交/分享仓库时，本机运行产生的 socket 等运行时产物不会混进版本库，代码与配置中也没有任何凭据字段——`oamp/` 保持干净、可 clone、可共享（E4）。

## 验收标准

1. 完整运行 Router（+ agent）产生运行时产物（socket 文件等）后：`git status` 不把产物列为未跟踪/已修改；对实际产物路径执行 `git check-ignore` 命中（E4 前半）。（git 状态核查）
2. 代码与配置中无凭据类字段：对 `oamp/` 新增代码/配置做扫描，无 token / secret / password / credential / api_key / private key 等赋值形态字段（E4 后半；N6 无 token 鉴权机制的代码存在）。（扫描核查）
3. 交付说明（README）声明上述两条红线（运行时产物不入 git、无凭据字段）。（文档核查）

## 边界（不包含）

- 不含 socket/运行时产物的确切落点与 .gitignore 具体写法的决策（属架构待填，本卡只锁"不入 git"这一效果）
- 不含注册鉴权 token 机制的任何实现（N6 否定面；P-07 安全面的两件正向事——socket 0600、同 id 唯一性——归 F02）
- 不含产物清理脚本/守护进程（N7 无后台化；产物由 git 忽略而非定时清理）

## 架构维度（阶段 3 已补全，2026-09-09 → architecture.md §5.1/§9/D2/D14）

- **产物落点与 gitignore（AR-11 → D2/D14，§9）**：运行时产物唯一落点 = `<oamp 包根>/oamp/.runtime/`（socket 文件，Router 退出时 unlink，残留亦被忽略）；`oamp/.gitignore` 内容 = `.runtime/`（零依赖故无 node_modules；测试 socket 全在 `os.tmpdir()` 的 mkdtemp 临时目录，永不落仓库）。git 侧核查（`git check-ignore` 命中实际产物）由阶段 6 独立验证按 F08-1 执行。
- **凭据扫描载体（AR-11 → D14，§9）**：`test/hygiene.test.js`（npm test 内静态断言）——①断言 `oamp/.gitignore` 含 `.runtime/`；②对 `bin/`、`src/`、`package.json` 扫描禁止凭据字段名（token/api_key/secret/password/credential/authorization/private_key 等，词边界、大小写不敏感），命中即红；扫描范围排除 `test/`（防模式串自匹配，模式用字符串拼接规避字面量）。README 声明两条红线（F08-3）。
