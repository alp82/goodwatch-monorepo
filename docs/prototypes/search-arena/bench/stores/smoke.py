"""Smoke test of the loaded stores: per Qdrant variant one dense top-500 query and one "score these 1,500 ids" query,
plus two CrateDB queries (a BM25 body MATCH top 300 and a 1,500-id prior fetch). Timings are client-side wall time
over REST (median / p95 of repeated runs after one warm-up); recall is against exact numpy cosine over the same rows.

Usage: .venv/bin/python bench/stores/smoke.py
"""
import json, random, statistics, time

import numpy as np

import common as K

REPS = 30
QUERIES = ["feel good cooking show", "time loop comedy", "tarkovsky"]
ELIGIBLE = {"must": [{"key": "goodwatch_overall_score_voting_count", "range": {"gte": 2000}}],
            "must_not": [{"key": "adult", "match": {"value": True}}]}


def timed(fn, reps=REPS):
    fn()
    ts = []
    for _ in range(reps):
        t = time.perf_counter()
        out = fn()
        ts.append((time.perf_counter() - t) * 1000)
    ts.sort()
    return out, dict(median_ms=round(statistics.median(ts), 2), p95_ms=round(ts[int(0.95 * (len(ts) - 1))], 2),
                     min_ms=round(ts[0], 2), reps=reps)


def main():
    rows = K.catalog()
    ids = np.array([r["id"] for r in rows], np.int64)
    votes = np.array([int(r.get("votes") or 0) for r in rows])
    eligible = votes >= 2000
    en = np.load(f"{K.DATA}/{K.EMB['text_en'][0]}").astype(np.float32)
    qemb = json.load(open(f"{K.DATA}/query-emb-bge-base-en-v1.5.json"))
    qs = [q for q in QUERIES if q in qemb]
    qs += [q for q in qemb if q not in qs][: 8 - len(qs)]   # arena queries with a cached bge query embedding
    rng = random.Random(7)
    el_rows = np.flatnonzero(eligible)
    id_sets = [sorted(int(ids[r]) for r in rng.sample(list(el_rows), 1500)) for _ in qs]
    http = K.client(K.QDRANT_URL)
    out = dict(queries=qs, reps=REPS, filter_top500=ELIGIBLE, qdrant={}, crate={})

    for v, coll in K.VARIANTS.items():
        res = {}
        for label, extra in (("hnsw", {}), ("exact", {"exact": True})):
            per_q = []
            for q, idset in zip(qs, id_sets):
                vec = qemb[q]
                qv = np.array(vec, np.float32)
                exact = en[el_rows] @ (qv / np.linalg.norm(qv))
                truth = set(ids[el_rows[np.argsort(-exact)[:500]]].tolist())
                params = dict(extra, **({"quantization": {"rescore": True}} if v == "sq8" else {}))
                body = dict(query=vec, using="text_en", limit=500, filter=ELIGIBLE, with_payload=False, params=params)
                r, t = timed(lambda: http.post(f"/collections/{coll}/points/query", json=body).json()["result"]["points"])
                recall = len(truth & {p["id"] for p in r}) / 500
                body2 = dict(query=vec, using="text_en", limit=1500, filter={"must": [{"has_id": idset}]},
                             with_payload=False, params=params)
                r2, t2 = timed(lambda: http.post(f"/collections/{coll}/points/query", json=body2).json()["result"]["points"])
                idx = np.searchsorted(ids, idset)
                want = en[idx] @ (qv / np.linalg.norm(qv))
                got = {p["id"]: p["score"] for p in r2}
                err = max(abs(got[i] - float(s)) for i, s in zip(idset, want) if i in got) if got else None
                per_q.append(dict(query=q, top500=dict(t, recall_at_500=round(recall, 4), returned=len(r)),
                                  score1500=dict(t2, returned=len(r2), max_abs_score_err=err)))
            res[label] = dict(
                per_query=per_q,
                top500_median_ms=round(statistics.median(p["top500"]["median_ms"] for p in per_q), 2),
                top500_mean_recall=round(statistics.mean(p["top500"]["recall_at_500"] for p in per_q), 4),
                score1500_median_ms=round(statistics.median(p["score1500"]["median_ms"] for p in per_q), 2),
                score1500_min_returned=min(p["score1500"]["returned"] for p in per_q))
            print(v, label, {k: x for k, x in res[label].items() if k != "per_query"}, flush=True)
        out["qdrant"][v] = res

    ch = K.client(K.CRATE_URL)

    def sql(stmt, args):
        r = ch.post("/_sql", json={"stmt": stmt, "args": args})
        r.raise_for_status()
        return r.json()["rows"]

    body_match = (f"SELECT id, _score FROM {K.CRATE_TABLE} WHERE MATCH((tags 2, keywords 2, tropes 1, essence_text 1), ?) "
                  f"USING most_fields AND votes >= 2000 ORDER BY _score DESC LIMIT 300")
    fetch = f"SELECT id, votes, goodwatch_score, popularity, release_year, fps FROM {K.CRATE_TABLE} WHERE id = ANY(?)"
    cr = []
    for q, idset in zip(qs, id_sets):
        r, t = timed(lambda: sql(body_match, [q]))
        r2, t2 = timed(lambda: sql(fetch, [idset]))
        cr.append(dict(query=q, bm25_top300=dict(t, returned=len(r)), fetch1500=dict(t2, returned=len(r2))))
    out["crate"] = dict(bm25_stmt=body_match, fetch_stmt=fetch, per_query=cr,
                        bm25_top300_median_ms=round(statistics.median(c["bm25_top300"]["median_ms"] for c in cr), 2),
                        fetch1500_median_ms=round(statistics.median(c["fetch1500"]["median_ms"] for c in cr), 2))
    print("crate", {k: x for k, x in out["crate"].items() if k.endswith("_ms")}, flush=True)
    K.update_results("smoke", out)


if __name__ == "__main__":
    main()
