#!/usr/bin/env python3
"""阶段 4 闸门机械核查（七项）——workflow-pb 阶段 4 推进条件的逐条机械核对。

来源：迭代 0029 实测脚本（`/tmp/verify-prs-0029.py`）泛化而来；原有硬编码路径改为入参。
它填的缺口：workflow-pb 要求"每次推进前对照推进条件逐项核查"，此前只能靠主 agent 手工读
（0029 的 8 个 PR 有 21 条文件范围、8 条 depends_on，人工核对易漏且不可复现）。

用法：
    tools/check-pr-gates.py <迭代文档目录>
例：
    tools/check-pr-gates.py docs/iterations/0029-hub-client-session-and-duplex

七项：① 七字段齐备 ② 功能点覆盖 ③ 文件范围两两不重叠 ④ 依赖无环
      ⑤ 无悬挂依赖 ⑥ 关键路径 ≤3 ⑦ 并发可行性（每个 PR 都存在互不可达的伙伴）
注：② 为**提示项**（如 0029 的 F04 系已裁决出范围 = 19/20），是否豁免属人的裁决，不计入退出码；
    其余六项参与判定。
退出码：0 = 全过；1 = 有未过项（供阶段推进核查直接判定）。
"""
import glob, os, re, sys

FIELDS = ["## 上下文摘要", "## 涉及功能点", "## 文件范围", "## 验收标准",
          "## 参考资料", "## depends_on", "## batch"]


def block(text, name):
    m = re.search(re.escape(name) + r"\n(.*?)(?=\n## |\Z)", text, re.S)
    return m.group(1).strip() if m else ""


def norm(p):
    return p.strip().strip("`").strip('"').strip("'").rstrip(",。")


def main(docs_dir):
    prs_dir, cards_dir = f"{docs_dir}/prs", f"{docs_dir}/prd"
    if not os.path.isdir(prs_dir):
        sys.exit(f"❌ 未找到 {prs_dir}")
    files = sorted(glob.glob(f"{prs_dir}/pr-*.md"))
    # planner 的产出 `pr-XXX-…-tasks.md` 不是 PR 文件（无七字段），必须排除——
    # 阶段 4 核查时 tasks 尚未产出，故原始脚本无此过滤；工具化后需按最终态健壮。
    files = [f for f in files if not f.endswith("-tasks.md")]
    if not files:
        sys.exit(f"❌ {prs_dir} 下没有 pr-*.md")
    texts = {os.path.basename(f): open(f, encoding="utf-8", errors="replace").read() for f in files}
    card_ids = {os.path.basename(p).split("-")[0] for p in glob.glob(f"{cards_dir}/*.md")}
    print(f"PR 文件数: {len(files)}  |  卡片数: {len(card_ids)}")

    cov, owner, deps, bad = {}, {}, {}, []
    for n, t in texts.items():
        miss = [f for f in FIELDS if f not in t]
        fps = set(re.findall(r"\b[FG]\d{2}\b", block(t, "## 涉及功能点")))
        paths = {norm(x) for x in re.findall(r"^\s*-\s*(\S+)", block(t, "## 文件范围"), re.M)}
        acc = [l for l in block(t, "## 验收标准").split("\n") if l.strip().startswith("- [")]
        dp = set(re.findall(r"pr-\d{3}-[a-z0-9-]+\.md", block(t, "## depends_on")))
        deps[n], cov[n] = dp, fps
        if miss:
            bad.append((n, miss))
        for p in sorted(paths):
            if p in owner and owner[p] != n:
                bad.append(("文件重叠", f"{p}: {owner[p]} vs {n}"))
            owner[p] = n
        print(f"  {n[:28]:30s} F={','.join(sorted(fps)):24s} 文件={len(paths):2d} 验收={len(acc):2d} "
              f"dep={','.join(sorted(x[:6] for x in dp)) or '无'}")

    allcov = set().union(*cov.values()) if cov else set()
    field_bad = [b for b in bad if b[0] != "文件重叠"]
    overlap = [b for b in bad if b[0] == "文件重叠"]
    print(f"\n[1] 七字段: {'✅ 全部齐备' if not field_bad else '❌ ' + str(field_bad)}")
    print(f"[2] 覆盖: {len(allcov & card_ids)}/{len(card_ids)} 张卡被引用；未覆盖={sorted(card_ids - allcov)}")

    adj = {n: {d for d in deps[n] if d in texts} for n in texts}
    dangle = {n: sorted(deps[n] - set(texts)) for n in texts if deps[n] - set(texts)}
    color, cyc = {}, []

    def dfs(u, st):
        color[u] = 1
        for v in adj.get(u, ()):
            if color.get(v, 0) == 1:
                cyc.append(" → ".join(st + [u, v]))
            elif color.get(v, 0) == 0:
                dfs(v, st + [u])
        color[u] = 2

    for n in texts:
        if color.get(n, 0) == 0:
            dfs(n, [])

    memo = {}

    def longest(u):
        if u in memo:
            return memo[u]
        memo[u] = 1 + max([longest(v) for v in adj.get(u, ())], default=0)
        return memo[u]

    cp = max((longest(n), n) for n in texts) if texts else (0, "-")

    def reach(succ, x):
        seen, st = set(), [x]
        while st:
            u = st.pop()
            for v in succ.get(u, ()):
                if v not in seen:
                    seen.add(v)
                    st.append(v)
        return seen

    pred = {n: set() for n in texts}
    for n, ds in adj.items():
        for d in ds:
            pred[d].add(n)
    noconf = [n for n in texts if (reach(adj, n) | reach(pred, n)) >= (set(texts) - {n})]

    print(f"[3] 文件范围两两不重叠: {'✅' if not overlap else '❌ ' + str(overlap)}  （共 {len(owner)} 个文件条目）")
    print(f"[4] 依赖无环: {'✅ 无环' if not cyc else '❌ ' + str(cyc)}   "
          f"[5] 无悬挂依赖: {'✅' if not dangle else '❌ ' + str(dangle)}")
    print(f"[6] 关键路径: {cp[0]} {'✅ ≤3' if cp[0] <= 3 else '❌ >3'}（末端 {cp[1][:30]}）")
    print(f"[7] 并发可行性: {'✅ 每个 PR 都有互不可达伙伴' if not noconf else '❌ 无并发窗口: ' + str(noconf)}")

    failed = bool(field_bad or overlap or cyc or dangle or cp[0] > 3 or noconf)
    print("\n结论:", "❌ 有未过项，按 workflow-pb 不满足阶段 4 推进条件" if failed
          else "✅ 七项全过，满足阶段 4 推进条件")
    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if len(sys.argv) == 2 else 2)
    sys.exit(main(sys.argv[1].rstrip("/")))
