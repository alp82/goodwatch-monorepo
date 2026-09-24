"""Parity of the Node (onnxruntime-node) vectors against the Python vectors the harness uses.

Per model and precision: cosine of every query text to its harness vector (query cache, or SentenceTransformer CPU on a
cache miss), of the 2,000 sampled catalog texts to their data/emb-*.npy rows, and the top-500 neighbor overlap over the
full catalog matrix for the first 100 queries of queries.json. Flags cosine < 0.99 and overlap < 0.95.

Usage: .venv/bin/python bench/encoders/parity_analyze.py   -> "parity" in results/bench/encoders.json
"""
import json, os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ARENA, "results", "bench", "encoders.json")
COS_FLAG, OVERLAP_FLAG, K, N_OVERLAP = 0.99, 0.95, 500, 100


def stats(x):
    x = np.asarray(x, np.float64)
    return {"n": int(len(x)), "min": round(float(x.min()), 6), "p1": round(float(np.percentile(x, 1)), 6),
            "p5": round(float(np.percentile(x, 5)), 6), "median": round(float(np.median(x)), 6),
            "mean": round(float(x.mean()), 6)}


def cos(a, b):
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    return (a * b).sum(1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1))


def topk(mat, v, k=K):
    s = mat @ v
    return set(np.argpartition(-s, k)[:k].tolist())


def main():
    inp = json.load(open(os.path.join(HERE, "out", "parity-input.json")))
    overlap_texts = inp["queries"][:N_OVERLAP]
    res = {"method": {
        "query_texts": "queries.json queries plus every text in the harness query cache for the model; reference = "
                       "cached vector (harness), or SentenceTransformer CPU fp32 with the query prefix on a cache miss",
        "catalog_texts": "2,000 random catalog rows (seed 0), text as the catalog embedding was built; reference = the "
                         "row of the catalog .npy (built on GPU, stored as float16)",
        "overlap": f"top-{K} catalog neighbors by dot product over the full matrix, Node vs reference query vector, "
                   f"first {N_OVERLAP} queries of queries.json",
        "flags": f"cosine < {COS_FLAG}, overlap < {OVERLAP_FLAG}"}, "models": {}}
    for key, m in inp["models"].items():
        mat = np.load(os.path.join(ARENA, "data", m["catalog_file"])).astype(np.float32)
        qt = m["query_texts"]
        ref = np.array([q["ref"] for q in qt], np.float32)
        st = np.array([q["st_cpu"] for q in qt], np.float32)
        inq = np.array([q["in_queries"] for q in qt])
        cached = np.array([q["src"] == "cache" for q in qt])
        idx = {q["text"]: i for i, q in enumerate(qt)}
        res["models"][key] = {"hf": m["hf"], "catalog_file": m["catalog_file"], "query_prefix": m["query_prefix"],
                              "cache_vs_st_cpu": stats(cos(ref[cached], st[cached])) if cached.any() else None}
        for prec in ("fp32", "int8"):
            node = json.load(open(os.path.join(HERE, "out", f"parity-{key}-{prec}.json")))
            qv = np.array(node["queries"], np.float32)
            cv = np.array(node["catalog"], np.float32)
            qc = cos(qv, ref)
            cc = cos(cv, np.array(m["catalog"]["ref"], np.float32))
            ov, ov10 = [], []
            for t in overlap_texts:
                i = idx[t]
                ov.append(len(topk(mat, ref[i]) & topk(mat, qv[i])) / K)
                ov10.append(len(topk(mat, ref[i], 10) & topk(mat, qv[i], 10)) / 10)
            low_q = sorted(((float(c), qt[i]["text"]) for i, c in enumerate(qc) if c < COS_FLAG))
            low_ov = sorted((o, t) for o, t in zip(ov, overlap_texts) if o < OVERLAP_FLAG)
            r = {
                "query_cosine_all": stats(qc),
                "query_cosine_queries_json": stats(qc[inq]),
                "query_cosine_vs_st_cpu": stats(cos(qv, st)),
                "catalog_cosine": stats(cc),
                "top500_overlap": stats(ov),
                "top10_overlap": stats(ov10),
                "query_texts_below_cos_flag": len(low_q),
                "catalog_texts_below_cos_flag": int((cc < COS_FLAG).sum()),
                "queries_below_overlap_flag": len(low_ov),
                "worst_query_texts": [{"cos": round(c, 4), "text": t} for c, t in low_q[:10]] or
                                     [{"cos": round(float(qc[i]), 4), "text": qt[i]["text"]} for i in np.argsort(qc)[:3]],
                "worst_overlap": [{"overlap": o, "text": t} for o, t in (low_ov or sorted(zip(ov, overlap_texts)))[:10]],
            }
            r["pass"] = r["query_texts_below_cos_flag"] == 0 and r["catalog_texts_below_cos_flag"] == 0 and \
                r["queries_below_overlap_flag"] == 0
            res["models"][key][prec] = r
            print(key, prec, "q", r["query_cosine_all"]["min"], r["query_cosine_all"]["median"],
                  "cat", r["catalog_cosine"]["min"], r["catalog_cosine"]["median"],
                  "ov", r["top500_overlap"]["min"], r["top500_overlap"]["mean"], "pass", r["pass"], flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = json.load(open(OUT)) if os.path.exists(OUT) else {}
    doc["parity"] = res
    json.dump(doc, open(OUT, "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
