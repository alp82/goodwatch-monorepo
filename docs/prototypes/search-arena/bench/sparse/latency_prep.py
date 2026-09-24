"""Request bodies for bench/sparse/latency.mjs: every BM25 operation of the trace as a Qdrant sparse query (client-built
query vector, as parity.py builds it) and as the replay's Crate MATCH statement (bench/replay/replay.ts crateSelect).

.venv/bin/python bench/sparse/latency_prep.py   -> bench/sparse/out/latency_ops.json
"""
import json, os, re

import httpx

from common import COLLECTION, OUT, QDRANT, VECTOR, trace
from parity import Client, qdrant_filter

COLS = dict(tags="tags", keywords="keywords", tropes="tropes", essence="essence_text", title="title",
            creators="creators", cast="cast_names")


def crate_filter(f):
    parts, args = ["votes >= ?", "adult = false"], [f["min_votes"]]
    if f["media_type"]:
        parts.append("media_type = ?")
        args.append(f["media_type"])

    def cond(fid, want):
        if fid.startswith(("media_type:", "production_method:")):
            col, val = fid.split(":", 1)
            args.append(val)
            return f"{col} = ?" if want else f"({col} IS NULL OR {col} <> ?)"
        assert re.fullmatch(r"[a-z_]+", fid)
        return f"{fid} = true" if want else f"({fid} IS NULL OR {fid} = false)"
    parts += [cond(x, True) for x in f["required"]]
    parts += [cond(x, False) for x in f["excluded"]]
    if f["year_range"]:
        parts.append("release_year BETWEEN ? AND ?")
        args += list(f["year_range"])
    return " AND ".join(parts), args


def bm25_text(op):
    if op.get("text") is not None:
        return op["text"]
    seen = []
    for t, _ in op["terms"]:
        if "_" not in t and t not in seen:
            seen.append(t)
    return " ".join(seen)


def main():
    cl = Client()
    http = httpx.Client(base_url=QDRANT, timeout=120)
    out = []
    for q in trace():
        f = q["filter"]
        qf = qdrant_filter(f)
        fw, fa = crate_filter(f)
        prof = None
        for op in q["ops"]:
            if op["kind"] not in ("bm25_topk", "bm25_score_ids"):
                continue
            if op["role"] == "profile:terms":
                if prof is None:
                    fetch = next(o for o in q["ops"] if o["kind"] == "fetch_terms")
                    seed_ids = q["id_lists"][fetch["ids"]]
                    r = http.post(f"/collections/{COLLECTION}/points", json=dict(
                        ids=seed_ids, with_vector=[VECTOR], with_payload=False)).json()["result"]
                    got = {p["id"]: (p.get("vector") or {}).get(VECTOR, dict(indices=[], values=[])) for p in r}
                    prof = cl.profile_query([got[i] for i in seed_ids])
                idx, val = prof[0], prof[1]
            else:
                idx, val, _ = cl.text_query(op["text"])
            if not idx:
                continue
            cols = ", ".join(f"{COLS[k]} {w}" for k, w in op["fields"].items())
            rec = dict(query=q["id"], op=op["id"], kind=op["kind"], role=op["role"], stage=op["stage"],
                       sparse=dict(indices=idx, values=[float(v) for v in val]))
            if op["kind"] == "bm25_topk":
                rec.update(filter=qf, crate_stmt=f"SELECT id, _score AS s FROM doc.search_title WHERE MATCH(({cols}), ?) "
                                                 f"USING most_fields AND {fw} ORDER BY _score DESC LIMIT {{k}}",
                           crate_args=[bm25_text(op), *fa])
            else:
                pool = q["id_lists"][op["ids"]]
                rec.update(ids=pool, crate_stmt=f"SELECT id, _score AS s FROM doc.search_title WHERE MATCH(({cols}), ?) "
                                                f"USING most_fields AND id = ANY(?) ORDER BY _score DESC LIMIT {len(pool)}",
                           crate_args=[bm25_text(op), pool])
            out.append(rec)
    json.dump(out, open(os.path.join(OUT, "latency_ops.json"), "w"))
    kinds = {}
    for r in out:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    print(len(out), kinds)


if __name__ == "__main__":
    main()
