import sys, os, numpy as np
sys.path.insert(0, "harness")
import catalog as C, cuts
cat = C.load(); E = C.embeddings("bgeb-notitle")
e = cuts.edges()
def show(p):
    r = cat.row_of[p]; return f"{cat.title[r]} ({cat.year[r]})"
for name in ["One Piece Log: Fish-Man Island Saga", "The Hateful Eight - Extended Version"]:
    rs = [r for r in range(len(cat.ids)) if cat.title[r] == name]
    for r in rs:
        p = int(cat.ids[r]); print(name, [show(q) for q in e.get(p, [])], [float(E[r] @ E[cat.row_of[q]]) for q in e.get(p, [])])
# cosines of all cut pairs
cs = []
for p, qs in e.items():
    for q in qs:
        if p < q: cs.append(float(E[cat.row_of[p]] @ E[cat.row_of[q]]))
cs = np.array(cs); print("cut pairs", len(cs), np.percentile(cs, [0, 5, 10, 25, 50]))
# same-director non-cut pairs
dirs = cuts._directors()
by = {}
el = cat.eligible()
for r in np.flatnonzero(el):
    for d in dirs.get(int(cat.ids[r]), (set(), []))[0]:
        by.setdefault(d, []).append(r)
nc = []
for d, rs in by.items():
    if len(rs) > 60: continue
    rs = np.array(rs); S = E[rs] @ E[rs].T
    for i in range(len(rs)):
        for j in range(i+1, len(rs)):
            p, q = int(cat.ids[rs[i]]), int(cat.ids[rs[j]])
            if q not in e.get(p, set()): nc.append((S[i, j], rs[i], rs[j]))
v = np.array([x[0] for x in nc]); print("non-cut same-dir pairs", len(v), [(t, int((v >= t).sum())) for t in (0.9, 0.93, 0.95, 0.97)])
for s, a, b in sorted(nc, key=lambda x: -x[0])[:25]:
    print(round(float(s), 3), cat.title[a], cat.year[a], "|", cat.title[b], cat.year[b])
