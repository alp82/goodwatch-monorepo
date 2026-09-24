import sys, re
sys.path.insert(0, "harness")
import numpy as np, grade6, simp_combo as sc
from sklearn.feature_extraction.text import TfidfVectorizer
cfg = sc.FINAL["combo-safe-v2-wcred"][0]
qs = [q for q in grade6.load_queries(("dev", "holdout", "holdout2", "holdout3", "holdout4")) if q.get("person_intent")]
exs = [(c, sc.fold(t.replace("X", " qqx "))) for c, v in sc.INTENT_EXAMPLES.items() for t in v]
def xt(d):
    out = list(d.tokens)
    for e in sorted(d.entities, key=lambda e: -e.span[0]):
        out[e.span[0]:e.span[1]] = ["qqx"]
    return " ".join(out)
methods = {}
def jac(t):
    a = set(t.split()) - {"qqx"}
    s = [len(a & (set(e.split()) - {"qqx"})) / max(1, len(a | (set(e.split()) - {"qqx"}))) for _, e in exs]
    return exs[int(np.argmax(s))][0] if max(s) > 0 else "filmography"
methods["jaccard"] = jac
for an, ng in (("char_wb", (2, 4)), ("char_wb", (3, 5)), ("word", (1, 2))):
    tv = TfidfVectorizer(analyzer=an, ngram_range=ng).fit([e for _, e in exs])
    EM = tv.transform([e for _, e in exs])
    def f(t, tv=tv, EM=EM):
        s = (EM @ tv.transform([t]).T).toarray().ravel()
        return exs[int(np.argmax(s))][0] if s.max() > 0 else "filmography"
    methods[f"tfidf-{an}{ng}"] = f
ok = {m: 0 for m in methods}; n = 0
for q in qs:
    d = sc.detect(q["query"], cfg)
    t = xt(d); rest = [w for w in t.split() if w != "qqx"]
    n += 1
    out = []
    for m, f in methods.items():
        p = f(t) if rest else d.intent
        ok[m] += p == q["person_intent"]; out.append(p[:4] + ("*" if p != q["person_intent"] else " "))
    print(f"{q['id']:8s} {t[:40]:40s} {q['person_intent'][:4]} combo={d.intent[:4]} ", " ".join(out))
print(n, ok)
