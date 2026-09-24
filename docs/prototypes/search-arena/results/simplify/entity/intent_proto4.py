import sys, json, os, re
sys.path.insert(0, "harness"); sys.path.insert(0, "results/simplify/entity")
from intent_proto import enc
import numpy as np, simp, grade6
EX = {
 "filmography": ["X movies", "X films", "films starring X", "movies directed by X", "X filmography", "X's best films",
                 "X comedies", "X crime thrillers", "X sci-fi movies", "old X films", "X animated films", "X series",
                 "shows created by X", "X's early work", "late X movies", "Filme mit X", "les films de X", "películas de X"],
 "style": ["movies like X", "films similar to X", "in the style of X", "X-ish vibes", "reminds me of X",
           "something with a X aesthetic", "X-esque", "X kind of humor", "X feel", "the X tone", "X mood",
           "as if X made it", "X inspired", "X type of film", "X sort of thing", "un film comme X", "im Stil von X", "al estilo de X"],
 "both": ["X and films like theirs", "X plus similar picks", "X's work and others like it"],
}
det = json.load(open("results/simplify/entity/det_r6.json"))
qs = {x["id"]: x for x in grade6.load_queries(("dev","holdout","holdout2","holdout3","holdout4"))}
exs = [(c, t) for c, v in EX.items() for t in v]
for model in ["bgeb-notitle", "me5s"]:
    EM = enc(model, [t for _, t in exs])
    ids = [k for k, v in det.items() if v["det"]]
    texts = []
    for k in ids:
        d = simp.detect(det[k]["query"], simp.DEFAULTS)
        toks = d.tokens[:]
        for e in sorted(d.entities, key=lambda e: -e.span[0]):
            toks[e.span[0]:e.span[1]] = ["X"]
        texts.append(" ".join(toks))
    Q = enc(model, texts)
    ar = ag = ng = 0
    for k, t, qv in zip(ids, texts, Q):
        sims = EM @ qv
        s = {}
        for (c, et), v in zip(exs, sims):
            if et.lower() == t and c != "both": continue   # leave exact copies out
            s[c] = max(s.get(c, -1), float(v))
        pred = max(s, key=s.get) if t != "X" and t.replace("X","").strip() else "both"
        r6 = det[k]["det"]["intent"]; gold = qs[k].get("person_intent")
        ar += pred == r6
        if gold: ng += 1; ag += pred == gold
        flag = "" if pred == r6 else "  <-- r6"
        print(model[:4], k, f"{t[:36]:36s}", pred, "| r6", r6, "| gold", gold, {c: round(v, 3) for c, v in s.items()}, flag)
    print(model, "agree r6", ar, len(ids), "gold", ag, ng)
