# F01：项目实体（创建与列出）

**功能 ID**: F01
**来源**: `demand.md` W1；澄清 M-1 / M-3；决策 S-4 / P-1 / P-3；边界 N1 / N3 / N4 / N5 / N6 / N11；效果 E2 / E4（依赖部分）
**迭代**: 0017-project-workspace
**技术锚点（引用 `demand.md` §3 只读实测，非本阶段决策）**: F-1（`chats` 表列集，无任何项目维度）、F-19（全仓零"项目"概念）、F-18（统一错误契约，`409 CONFLICT` 已在封闭枚举内）

---

## 用户价值

建一个项目只要一个仓库地址——项目从此是可以反复进入、反复开对话的长期容器，而不是对话里的一个标签。

## 验收标准

1. **只填地址即可创建**（W1 / E2）：创建请求只提供仓库地址、名称留空 → 创建成功；项目的展示名 = 地址尾段去掉尾部 `.git`。
   *判定*：用 `https://github.com/acme/demo.git` 创建且名称留空 → 该项目展示名为 `demo`。
2. **项目可被列出**（W1 / E2 数据前提）：存在"列出当前全部项目"的查询面；创建成功的项目均在结果中，未创建的项目不出现。
   *判定*：创建 2 个项目 → 查询返回且仅返回这 2 条（项目列表页的呈现由 F04 承载）。
3. **最小四要素可核对、本地路径不在其中**（W1 / M-1 / N3 / E4）：每个项目可被唯一标识，且有名称、仓库地址、创建时间；本地路径不在这四项之中，也不被推断或存储。
   *判定*：用 sqlite 打开对话库，核对该项目一行含四项且不含路径类字段。
4. **仓库地址为必填**〔`[user_confirmed MI-01]`〕（用户裁决原文：「一律 400，不做地址形态校验」）：缺少地址（缺失或为空）的创建请求被拒绝（`400 INVALID_PARAM`），且不产生项目；地址只要求非空，**不做形态 / 域名校验**。
   *判定*：不提供地址创建 → 4xx（400）+ 项目条数不变；用任意非空但形态可疑的地址（非 github 域名 / 非 URL 形态）创建 → **创建成功**（证明只校验非空）。
5. **同一地址重复创建被拒绝**（W1 / M-3 / E2）：唯一键 = **原样地址字符串**；重复创建 → 拒绝并返回 `409 CONFLICT`，项目条数不变。
   *判定*：连续两次用同一地址创建 → 第二次 4xx（409）、列表仍只有一条。
6. **不做地址归一化**（W1 / M-3 / N6）：`https://github.com/acme/demo` 与 `https://github.com/acme/demo.git` 视为两个不同项目，均可创建成功。
   *判定*：分别创建 → 项目列表出现 2 条。
7. **不校验可达性、不做仓库集成**（W1 / N1）：不存在或不可访问的地址同样创建成功；创建过程不拉取任何仓库元数据、不需要任何凭据输入。
   *判定*：用不存在的仓库地址创建 → 成功；核对创建过程无网络依赖与凭据输入。

## 边界（不包含）

- 不含对话的任何能力（新建 / 列表 / 归属校验 → F02 / F03）。
- 不含项目层页面与入口（→ F04 / F05）。
- **不做项目的删除 / 改名 / 归档**（N5）。
- **不做 GitHub 集成**：不校验可达性、不拉取默认分支 / 描述 / 可见性、不做 OAuth 或凭据管理（N1）；**不校验地址形态与域名**〔`[user_confirmed MI-01]`〕。
- **不存本地路径、不推断本地路径**（N3 / M-1）。
- **不做 URL 归一化去重**（N6 / M-3）。
- **不做项目级权限 / 成员 / 多用户隔离**（N4）。
- **不多引入层级**：不引入"迭代"实体或任何 workflow-pb 概念（N11 / M-7）。
- 不含项目描述、标签、置顶、封面、默认分支、凭据等未被要求的信息。

## 架构落地（阶段 3 已填，见 `architecture.md` §2.1 / §2.3 / §3.1 / §6.1；产品维度未改一字）

- **T-07 两条 HTTP 面与项目标识**：`GET /api/projects`（列出）+ `POST /api/projects`（创建），登记在既有声明式路由表**末位**（第 12 / 13 条表项，8 个元数据字段齐备；`docLink` 分别指向 `API.md#312-get-apiprojects` / `API.md#313-post-apiprojects`）。**项目标识 = `project_id`（`prj-<uuid>`）**，与 `repo_url` 是**两个字段**（M-1 的"唯一标识"独立于"仓库地址"；地址不归一化 ⇒ 不适合做引用键）。
- **T-01 表关联与索引**：新增 `projects(project_id TEXT PRIMARY KEY, name TEXT NOT NULL, repo_url TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`；`chats` 增 `project_id TEXT NOT NULL REFERENCES projects(project_id)`（插在 `chat_id` 之后，既有 9 列相对顺序逐位不变）；新增索引 `idx_chats_project_updated(project_id, updated_at DESC)`。关联靠 **`NOT NULL` + 外键**（`PRAGMA foreign_keys=ON` 既有），不靠应用层自律。
- **T-09 请求 / 响应字段**：创建 = 请求体 `{repo_url（必填，trim 后非空即合法——不校验形态 / 域名 / 可达性）, name（可选；缺省 / 空 / 非字符串 ⇒ 派生 = 地址去尾斜杠后取尾段、再去尾部 `.git`；派生为空 ⇒ 兜底用地址原文）}` → `200 {project:{project_id,name,repo_url,created_at}}`；重复地址 → `409 CONFLICT`（`项目已存在: <repo_url>`，由 `UNIQUE(repo_url)` + `ON CONFLICT DO NOTHING` + `changes>0` 判定，不解析错误文案）；缺地址 → `400 INVALID_PARAM`（`需要 repo_url（非空字符串）`）。列表 = `200 {projects:[{project_id,name,repo_url,created_at,chat_count,last_activity_at}]}`，**无分页参数、无 total**（F04 边界：不新增分页 / 搜索 / 排序能力）。
- **存储口径**：`repo_url` **trim 后原样入库**——只去首尾空白，不做 `.git` / 尾斜杠 / 大小写 / SSH-HTTP 归一化（N6）；`chat_count` = 该项目下全部对话数（含已归档 / 已关闭，MI-04）；`last_activity_at` = `MAX(chats.updated_at)`，项目下无对话为 `null`（MI-03，展示层渲染占位、不报错）；排序 `created_at DESC, project_id DESC`。
