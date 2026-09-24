import sys, json, os
sys.path.insert(0, "harness")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import numpy as np, catalog as C
from sentence_transformers import SentenceTransformer
EX = {
 "filmography": [
   "Meryl Streep movies", "films starring Tom Cruise", "Martin Scorsese filmography", "Hitchcock thrillers",
   "Denzel Washington action films", "DreamWorks animated movies", "early Scorsese films", "Netflix original series",
   "comedies with Adam Sandler", "Sofia Coppola's movies", "shows created by Shonda Rhimes", "the best Kurosawa films",
   "Filme mit Tom Cruise", "les films de Sofia Coppola",
 ],
 "style": [
   "movies like Scorsese", "Hitchcock vibes", "in the style of Sofia Coppola", "feels like a Cronenberg film",
   "something with a Tim Burton aesthetic", "Tarkovsky-esque", "Burtonesque", "DreamWorks humor", "Scorsese energy",
   "films in the spirit of Kurosawa", "similar to a Tom Cruise movie", "Tom Cruise type action",
   "un film comme Kurosawa", "im Stil von Tim Burton",
 ],
 "both": [
   "Martin Scorsese", "Meryl Streep", "Hitchcock", "Tim Burton", "Kurosawa",
   "Scorsese films and others like them", "Tom Cruise movies and similar ones",
 ],
}
M = {}
def enc(model, texts):
    key = C.EMBEDDINGS[model]
    if model not in M:
        M[model] = SentenceTransformer(key[1], device="cpu")
    return M[model].encode([key[2] + t for t in texts], normalize_embeddings=True)
if __name__ == "__main__":
    import grade6
    det = json.load(open("results/simplify/entity/det_r6.json"))
    qs = {x["id"]: x for x in grade6.load_queries(("dev","holdout","holdout2","holdout3","holdout4"))}
    for model in ["bgeb-notitle", "me5s"]:
        E = {k: enc(model, v) for k, v in EX.items()}
        ids = [k for k, v in det.items() if v["det"]]
        Q = enc(model, [det[k]["query"] for k in ids])
        agree_r6 = agree_gold = n_gold = 0
        for k, qv in zip(ids, Q):
            s = {c: float(np.sort(E[c] @ qv)[-3:].mean()) for c in E}   # mean of top-3
            s2 = {c: float((E[c] @ qv).max()) for c in E}
            pred = max(s, key=s.get)
            r6 = det[k]["det"]["intent"]; gold = qs[k].get("person_intent")
            agree_r6 += pred == r6
            if gold: n_gold += 1; agree_gold += pred == gold
            print(model[:4], k, f"{det[k]['query'][:40]:40s}", pred, "| r6", r6, "| gold", gold, {c: round(v,3) for c,v in s.items()})
        print(model, "agree r6", agree_r6, len(ids), "gold", agree_gold, n_gold)
