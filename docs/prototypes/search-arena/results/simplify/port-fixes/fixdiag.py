"""#137 diagnostic: how often each port fix changes combo-safe-v3's intermediate lists.

From docs/prototypes/search-arena: .venv/bin/python results/simplify/port-fixes/fixdiag.py [holdout5]
Counts reference profiles whose top-40 term set changes with the (-weight, term) tie-break, and non-English mixed
lists whose top k_main changes with the union of each cosine's top 2,000 (recall against the full scan).
"""
import sys, os
sys.path.insert(0, "harness")
import numpy as np
import evalsimp as E, simp_combo as SC
split = sys.argv[1] if len(sys.argv) > 1 else None
if split: E.use_split(split)
cfg = SC.FINAL["combo-safe-v3"][0]
st = dict(terms=0, terms_diff=0, mix=0, mix_diff=0, mix_recall=[])
orig_top_terms, orig_top = SC.top_terms, SC.top
def tt(w, c):
    new = orig_top_terms(w, c); old = orig_top_terms(w, dict(c, terms_tiebreak=False))
    st["terms"] += 1; st["terms_diff"] += set(new.tolist()) != set(old.tolist())
    return new
SC.top_terms = tt
orig_mix = SC.mix_z
def mz(x, y, rows, w):
    m = orig_mix(x, y, rows, w)
    k = cfg["k_main"]; n = cfg["nonen_union_k"]
    full = set(orig_top(rows, m[rows], k)[0].tolist())
    u = np.union1d(orig_top(rows, x[rows], n)[0], orig_top(rows, y[rows], n)[0])
    got = set(orig_top(u, m[u], k)[0].tolist())
    st["mix"] += 1; st["mix_diff"] += got != full; st["mix_recall"].append(len(got & full) / len(full))
    return m
SC.mix_z = mz
ctxs = E.contexts()
for c in ctxs: SC.rank(c, cfg)
print(len(ctxs), {k: v for k, v in st.items() if k != "mix_recall"}, "mix recall@500 mean/min",
      np.mean(st["mix_recall"]) if st["mix_recall"] else None, min(st["mix_recall"], default=None))
