import os, sys, statistics
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "harness"))
import evalsimp as ev
names = ["r6", "combo-safe-v2", "combo-safe-v2-wcred", "combo-safe-v2-wcred-par", "combo-safe-v2-wcred-me5s"]
ctxs = [c for c in ev.contexts() if not c.id.startswith("dev6")]
for ov in (None, ev.OVERLAY):
    ev._overlay = ov
    g = ev.load_grades()
    print("grades:", ev.grades_label())
    for n in names:
        ls = ev.load_lists(n)
        if ls is None or any(c.id not in ls for c in ctxs):
            print(n, "no complete lists"); continue
        pq = ev.per_query(ctxs, ls, g)
        out = []
        for lab, f in (("dev53", lambda c: c.split == "dev" and not c.id.startswith("dev5")),
                       ("dev5", lambda c: c.id.startswith("dev5")), ("dev-all", lambda c: c.split == "dev")):
            ids = [c.id for c in ctxs if f(c) and c.id in pq]
            out.append(f"{lab} n{len(ids)} {statistics.mean(pq[i]['ndcg10'] for i in ids):.3f} "
                       f"cond {statistics.mean(pq[i]['cond'] for i in ids):.3f} unj {sum(pq[i]['unj10'] for i in ids)} "
                       f"bad5 {sum(pq[i]['bad5'] for i in ids)}")
        print(f"  {n:26s}", " | ".join(out))
    if ov is None:
        for i in sorted(c.id for c in ctxs if c.id.startswith("dev5")):
            print("   ", i, " ".join(f"{n[-5:]}={ev.per_query([c for c in ctxs if c.id == i], ev.load_lists(n), g)[i]['cond']:.3f}" for n in names if ev.load_lists(n)))
