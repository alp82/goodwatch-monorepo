"""Prepare the replay benchmark: store additions the trace asked for, plus exact reference lists for parity checks.

Steps (each can be run alone: .venv/bin/python bench/replay/prepare.py [raw] [profiles] [exact]):
  raw       gap 1: add a 74-d Dot named vector `fingerprint_raw` (raw 0..10 fingerprint scores, harness DIMS order) to
            the f16, f32 and sq8 collections (Qdrant 1.19: PUT /collections/{c}/vectors/{name} creates a named vector
            on an existing collection), upload the vectors and wait until they are indexed.
  profiles  gap 3: side collection `search_reference_profiles` holding the reference queries' precomputed centroids
            (fingerprint_v1 74-d Cosine, text_en 768-d Cosine float16), one point per reference query, read with
            lookup_from. A stand-in for the real per-entity / per-title profile collection.
  exact     exact top-k lists of every top-k op, computed in numpy from the catalog with the trace's query vectors and
            filters (dense, fingerprint, the non-English z-mix, the prototype's BM25F), plus the per-filter mean and
            standard deviation of both cosines for gap 2(b). Written to bench/replay/out/exact.json.
"""
import base64, json, os, sys, time

import httpx
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ARENA, "harness"))
import catalog as C  # noqa: E402

QDRANT = "http://127.0.0.1:16333"
COLLECTIONS = ["media_fingerprint_v1_f16", "media_fingerprint_v1_f32", "media_fingerprint_v1_sq8"]
PROFILES = "search_reference_profiles"
TRACE = os.path.join(ARENA, "results", "bench", "trace")
OUT = os.path.join(HERE, "out")


def trace():
    return [json.loads(l) for l in open(os.path.join(TRACE, "trace.jsonl"))]


def vectors():
    raw = json.load(open(os.path.join(TRACE, "vectors.json")))
    return {q: {v: np.frombuffer(base64.b64decode(b), "<f4") for v, b in d.items()} for q, d in raw.items()}


def wait_green(http, name, expect, timeout=3600):
    t0 = time.time()
    while True:
        info = http.get(f"/collections/{name}").json()["result"]
        if info["status"] == "green" and info["optimizer_status"] == "ok" and info.get("indexed_vectors_count", 0) >= expect:
            return round(time.time() - t0, 1), info
        if time.time() - t0 > timeout:
            raise TimeoutError(info)
        time.sleep(2)


def add_raw():
    cat = C.load()
    http = httpx.Client(base_url=QDRANT, timeout=600)
    out = {}
    for name in COLLECTIONS:
        info = http.get(f"/collections/{name}").json()["result"]
        n_vec = len(info["config"]["params"]["vectors"])
        if "fingerprint_raw" not in info["config"]["params"]["vectors"]:
            r = http.put(f"/collections/{name}/vectors/fingerprint_raw", params=dict(wait="true"),
                         json=dict(dense=dict(size=74, distance="Dot")))
            r.raise_for_status()
            n_vec += 1
        t0 = time.time()
        B = 2000
        for i in range(0, len(cat.ids), B):
            pts = [dict(id=int(p), vector=dict(fingerprint_raw=v.tolist()))
                   for p, v in zip(cat.ids[i:i + B], cat.fps[i:i + B])]
            http.put(f"/collections/{name}/points/vectors", params=dict(wait="true"), json=dict(points=pts)).raise_for_status()
        upload_s = round(time.time() - t0, 1)
        build_s, info = wait_green(http, name, n_vec * len(cat.ids))
        out[name] = dict(method="PUT /collections/{c}/vectors/fingerprint_raw (create named vector on the existing "
                                "collection), then PUT /points/vectors", upload_s=upload_s, index_wait_s=build_s,
                         indexed_vectors_count=info["indexed_vectors_count"], points=info["points_count"],
                         vectors=list(info["config"]["params"]["vectors"]))
        print(name, out[name], flush=True)
    return out


def add_profiles(T, V):
    http = httpx.Client(base_url=QDRANT, timeout=600)
    http.delete(f"/collections/{PROFILES}")
    http.put(f"/collections/{PROFILES}", json=dict(
        vectors=dict(fingerprint_v1=dict(size=74, distance="Cosine"),
                     text_en=dict(size=768, distance="Cosine", datatype="float16")),
        shard_number=1)).raise_for_status()
    pts, index = [], {}
    for i, q in enumerate(T):
        cents = {v["vector_set"]: vid for vid, v in q["vectors"].items() if v["kind"] == "centroid"}
        if not cents:
            continue
        pid = i + 1
        index[q["id"]] = dict(point=pid, vectors=cents)
        pts.append(dict(id=pid, vector={vs: V[q["id"]][vid].tolist() for vs, vid in cents.items()}))
    http.put(f"/collections/{PROFILES}/points", params=dict(wait="true"), json=dict(points=pts)).raise_for_status()
    print("profiles:", len(pts), "points", flush=True)
    return dict(collection=PROFILES, points=len(pts), index=index)


def mask_for(cat, f):
    m = cat.votes >= 2000
    if f["media_type"]:
        m &= cat.is_show if f["media_type"] == "show" else ~cat.is_show
    for fid, want in [(x, True) for x in f["required"]] + [(x, False) for x in f["excluded"]]:
        if fid.startswith("media_type:"):
            has = cat.is_show if fid.endswith("show") else ~cat.is_show
        elif fid.startswith("production_method:"):
            pm = fid.split(":", 1)[1]
            has = np.array([p == pm for p in cat.production_method])
        else:
            has = cat.flags[fid] == 1
        m &= has if want else ~has
    if f["year_range"]:
        m &= (cat.year >= f["year_range"][0]) & (cat.year <= f["year_range"][1])
    assert int(m.sum()) == f["n_rows"], (f, int(m.sum()))
    return m


def topk(rows, s, k, positive_only=False):
    k = min(k, len(rows))
    part = np.argpartition(-s, k - 1)[:k]
    part = part[np.argsort(-s[part], kind="stable")]
    if positive_only:
        part = part[s[part] > 0]
    return [int(x) for x in rows[part]], [float(x) for x in s[part]]


def exact(T, V):
    import sparse as S
    cat = C.load()
    M = {"text_en": C.embeddings("bgeb-notitle"), "text_multi": C.embeddings("me5s"),
         "fingerprint_v1": cat.fp, "fingerprint_raw": cat.fps}
    ids = cat.ids
    X_rows, vocab, X, idf = S.index({"tags": 2.0, "keywords": 2.0, "tropes": 1.0, "essence": 1.0,
                                     "title": 0, "creators": 0, "cast": 0})
    Xc = X.tocsc()
    elig_pos = {int(r): i for i, r in enumerate(X_rows)}
    out, stats = {}, {}
    all_eligible = cat.votes >= 2000
    for q in T:
        f = q["filter"]
        m = mask_for(cat, f)
        rows = np.flatnonzero(m)
        vq = V[q["id"]]
        res = {}
        for o in q["ops"]:
            if o["kind"] in ("dense_topk", "fp_topk"):
                s = M[o["vector_set"]][rows] @ vq[o["vector"]]
                got, sc = topk(rows, s, o["k"])
                res[o["id"]] = dict(ids=[int(ids[r]) for r in got], scores=sc, k=o["k"])
            elif o["kind"] == "dense_mix_topk":
                pm, pe = o["parts"]
                x = M[pm["vector_set"]][rows] @ vq[pm["vector"]]
                y = M[pe["vector_set"]][rows] @ vq[pe["vector"]]
                w = o["mix_w"]
                mu1, sd1 = float(x.mean()), float(x.std() or 1)
                mu2, sd2 = float(y.mean()), float(y.std() or 1)
                s = (1 - w) * (x - mu1) / sd1 + w * (y - mu2) / sd2
                got, sc = topk(rows, s, o["k"])
                # global fallback stats: the whole eligible set (votes >= 2000), no query filter
                er = np.flatnonzero(all_eligible)
                xg = M[pm["vector_set"]][er] @ vq[pm["vector"]]
                yg = M[pe["vector_set"]][er] @ vq[pe["vector"]]
                res[o["id"]] = dict(ids=[int(ids[r]) for r in got], scores=sc, k=o["k"])
                stats[f"{q['id']}/{o['id']}"] = dict(
                    w=w, multi=[mu1, sd1], en=[mu2, sd2],
                    eligible_multi=[float(xg.mean()), float(xg.std())], eligible_en=[float(yg.mean()), float(yg.std())])
            elif o["kind"] == "bm25_topk":
                cols, qw = [], []
                for t, wt in o["terms"]:
                    j = vocab.get(t)
                    if j is not None:
                        cols.append(j)
                        qw.append(wt)
                sel = np.array([elig_pos[int(r)] for r in rows if int(r) in elig_pos])
                rsel = X_rows[sel]
                if not cols:
                    res[o["id"]] = dict(ids=[], scores=[], k=o["k"])
                    continue
                s = np.asarray(Xc[:, cols][sel] @ np.array(qw, np.float32)).ravel()
                got, sc = topk(rsel, s, o["k"], positive_only=True)
                res[o["id"]] = dict(ids=[int(ids[r]) for r in got], scores=sc, k=o["k"], n_returned_trace=o["n_returned"])
        out[q["id"]] = res
    return out, stats


def main(steps):
    os.makedirs(OUT, exist_ok=True)
    T = trace()
    V = vectors()
    meta_path = os.path.join(OUT, "prepare.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    if "raw" in steps:
        meta["fingerprint_raw"] = add_raw()
    if "profiles" in steps:
        meta["profiles"] = add_profiles(T, V)
    if "exact" in steps:
        t0 = time.time()
        ex, stats = exact(T, V)
        json.dump(ex, open(os.path.join(OUT, "exact.json"), "w"))
        json.dump(stats, open(os.path.join(OUT, "mixstats.json"), "w"), indent=1)
        print(f"exact lists: {len(ex)} queries in {time.time() - t0:.0f}s", flush=True)
    json.dump(meta, open(meta_path, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:] or ["raw", "profiles", "exact"])
