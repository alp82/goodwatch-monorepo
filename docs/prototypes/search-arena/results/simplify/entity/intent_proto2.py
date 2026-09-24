import sys, json, os, re
sys.path.insert(0, "harness"); sys.path.insert(0, "results/simplify/entity")
from intent_proto import enc
import numpy as np, simp, grade6
PH = sys.argv[1] if len(sys.argv) > 1 else "X"
EX = {
 "filmography": ["X movies", "films starring X", "X filmography", "X thrillers", "X action films", "X animated movies",
                 "early X films", "X original series", "comedies with X", "X's movies", "shows created by X", "the best X films",
                 "X horror", "X dramas", "Filme mit X", "les films de X", "películas de X"],
 "style": ["movies like X", "X vibes", "in the style of X", "feels like a X film", "something with a X aesthetic", "X-esque",
           "X humor", "X energy", "films in the spirit of X", "similar to X", "X type movies", "X atmosphere", "X feel",
           "un film comme X", "im Stil von X", "al estilo de X"],
 "both": ["X", "X films and others like them", "X and similar"],
}
EX = {k: [s.replace("X", PH) for s in v] for k, v in EX.items()}
det = json.load(open("results/simplify/entity/det_r6.json"))
qs = {x["id"]: x for x in grade6.load_queries(("dev","holdout","holdout2","holdout3","holdout4"))}
for model in ["bgeb-notitle", "me5s"]:
    E = {k: enc(model, v) for k, v in EX.items()}
    ids = [k for k, v in det.items() if v["det"]]
    texts = []
    for k in ids:
        d = simp.detect(det[k]["query"], simp.DEFAULTS)
        toks = d.tokens[:]
        for e in sorted(d.entities, key=lambda e: -e.span[0]):
            toks[e.span[0]:e.span[1]] = [PH]
        texts.append(" ".join(toks))
    Q = enc(model, texts)
    ar = ag = ng = 0
    for k, t, qv in zip(ids, texts, Q):
        for agg in ("max",):
            s = {c: float((E[c] @ qv).max()) for c in E}
        pred = max(s, key=s.get)
        r6 = det[k]["det"]["intent"]; gold = qs[k].get("person_intent")
        ar += pred == r6
        if gold: ng += 1; ag += pred == gold
        print(model[:4], k, f"{t[:40]:40s}", pred, "| r6", r6, "| gold", gold, {c: round(v, 3) for c, v in s.items()})
    print(model, "agree r6", ar, len(ids), "gold", ag, ng)
