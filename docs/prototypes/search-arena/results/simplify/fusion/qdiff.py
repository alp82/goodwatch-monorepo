"""Per-query ndcg10 differences between two probe lists (names: probe_lists/<name>.json or 'simp')."""
import sys, json; sys.path.insert(0, "harness")
import evalsimp as ES, metrics as M
ctxs = ES.contexts(); g = M.load_grades()
ld = lambda n: ES.load_lists(n) if n in ("simp",) else json.load(open(f"results/simplify/fusion/probe_lists/{n}.json"))
a, b = ld(sys.argv[1]), ld(sys.argv[2])
show = len(sys.argv) > 3
for c in ctxs:
    if c.type == "title_lookup": continue
    ia = [x["id"] for x in a[c.id]]; ib = [x["id"] for x in b[c.id]]
    gg = g.get(c.id, {})
    ma, mb = M.graded_query6(ia, gg), M.graded_query6(ib, gg)
    if abs(ma["ndcg10"] - mb["ndcg10"]) > 1e-9 or ma["bad5"] != mb["bad5"]:
        print(f"{c.id} {c.split} sty={ES.style(c)} {c.query[:60]!r} {ma['ndcg10']:.3f}->{mb['ndcg10']:.3f} bad5 {ma['bad5']}->{mb['bad5']} unj {ma['unj10']}->{mb['unj10']}")
        if show:
            print("   -", [f"{x['title']}[{gg.get(x['id'],'?')}]" for x in a[c.id][:10] if x['id'] not in ib[:10]])
            print("   +", [f"{x['title']}[{gg.get(x['id'],'?')}]" for x in b[c.id][:10] if x['id'] not in ia[:10]])
