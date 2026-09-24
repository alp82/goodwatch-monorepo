"""Parity inputs: the texts the harness encodes and the Python vectors it uses, for parity.mjs.

Query texts: every query in queries.json plus every text in the harness's query caches (data/query-emb-*.json). The
reference vector is the cached one (what the harness ranks with); a text missing from a cache is encoded the way
harness/qemb.py does on a miss (SentenceTransformer on the CPU, query prefix, normalized).
Catalog texts: 2,000 random rows (seed 0), prepared as the catalog embeddings were (bge: harness/embed_notitle.py
text_without_title, no prefix; me5s: scripts/embed_catalog.py embedding_text with "passage: "); the reference is the
row of data/emb-*.npy.

Usage: .venv/bin/python bench/encoders/parity_prep.py   -> bench/encoders/out/parity-input.json
"""
import json, os, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ARENA, "scripts"))
sys.path.insert(0, os.path.join(ARENA, "harness"))
import embed_catalog as ec  # noqa: E402
from embed_notitle import text_without_title  # noqa: E402
import catalog as C  # noqa: E402

SPEC = {  # key: (catalog.py EMBEDDINGS name, query cache file, catalog text function)
    "bge": ("bgeb-notitle", "query-emb-bge-base-en-v1.5.json", text_without_title),
    "me5s": ("me5s", "query-emb-multilingual-e5-small.json", ec.embedding_text),
}
N_CATALOG = 2000


def main():
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    from sentence_transformers import SentenceTransformer
    queries = [q["query"] for q in json.load(open(os.path.join(ARENA, "queries.json")))]
    rows = ec.load_catalog()
    ids = json.load(open(os.path.join(ARENA, "data", "emb-ids.json")))
    assert [r["id"] for r in rows] == ids, "catalog.jsonl.gz and emb-ids.json disagree on row order"
    sample = sorted(np.random.default_rng(0).choice(len(rows), N_CATALOG, replace=False).tolist())
    out = {"queries": queries, "models": {}}
    for key, (emb, cache_file, text_fn) in SPEC.items():
        _, hf, prefix = C.EMBEDDINGS[emb]
        cache = json.load(open(os.path.join(ARENA, "data", cache_file)))
        texts = list(dict.fromkeys(queries + list(cache)))
        model = SentenceTransformer(hf, device="cpu")
        st = model.encode([prefix + t for t in texts], normalize_embeddings=True, batch_size=64)
        q = []
        for t, v in zip(texts, st):
            ref = cache.get(t)
            q.append({"text": t, "in_queries": t in queries, "src": "cache" if ref else "st-cpu",
                      "ref": ref or [round(float(x), 6) for x in v], "st_cpu": [round(float(x), 6) for x in v]})
        mat = C.embeddings(emb)
        out["models"][key] = {
            "emb": emb, "hf": hf, "query_prefix": prefix, "catalog_file": C.EMBEDDINGS[emb][0],
            "query_texts": q,
            "catalog": {"rows": sample, "texts": [text_fn(rows[i]) for i in sample],
                        "ref": [[round(float(x), 6) for x in mat[i]] for i in sample]},
        }
        print(key, len(q), "query texts,", sum(x["src"] == "cache" for x in q), "cached", flush=True)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(out, open(os.path.join(HERE, "out", "parity-input.json"), "w"))


if __name__ == "__main__":
    main()
