import os, sys
sys.path.insert(0, "harness")
import numpy as np, grade6, entities as E, simp_combo as sc
cfg = sc.FINAL["combo-safe-v2-wcred"][0]
qs = [q for q in grade6.load_queries(("dev", "holdout", "holdout2", "holdout3", "holdout4")) if q.get("person_intent")]
exs = [(c, t) for c, v in sc.INTENT_EXAMPLES.items() for t in v]
def xtext(d):
    out = list(d.tokens)
    for e in sorted(d.entities, key=lambda e: -e.span[0]):
        out[e.span[0]:e.span[1]] = ["X"]
    return " ".join(out)
def nearest(model, t):
    V = np.stack([sc.embed(model, x) for _, x in exs]); v = sc.embed(model, t)
    return exs[int(np.argmax(V @ v))][0]
rows = []
for q in qs:
    d6 = E.detect(q["query"]); dc = sc.detect(q["query"], cfg)
    r = dict(id=q["id"], q=q["query"], gold=q["person_intent"], r6=d6.intent if d6 else None,
             combo=dc.intent if dc else None)
    if dc is not None:
        t = xtext(dc); r["x"] = t
        rest = [w for w in t.split() if w != "X"]
        r["bgeX"] = nearest("bgeb-notitle", t) if rest else dc.intent
    rows.append(r)
cols = ["r6", "combo", "bgeX"]
for r in rows:
    print(f"{r['id']:9s} {r['q'][:40]:40s} gold={r['gold']:11s} " + " ".join(f"{c}={str(r.get(c)):11s}{'' if r.get(c)==r['gold'] else '*'}" for c in cols), "|", r.get("x"))
for sub, name in ((rows, "all"), ([r for r in rows if not r["id"].startswith("dev5")], "orig"), ([r for r in rows if r["id"].startswith("dev5")], "dev5")):
    print(name, len(sub), {c: sum(r.get(c) == r["gold"] for r in sub) for c in cols}, "combo==r6", sum(r["combo"] == r["r6"] for r in sub))
