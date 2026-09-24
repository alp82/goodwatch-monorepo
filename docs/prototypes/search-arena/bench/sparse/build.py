"""Build the prototype's BM25F document side for all 191,634 titles and add it to the local Qdrant collection as the
named sparse vector `terms_bm25f` (no IDF modifier: the client sends IDF-weighted query values).

.venv/bin/python bench/sparse/build.py [compute] [upload]
  compute  doc values + client term stats (bench/sparse/out/), checked bitwise against sparse.index(BODY)
  upload   PUT /collections/{c}/vectors/terms_bm25f (creates the sparse vector on the existing collection; the dense
           vectors and payload are untouched), PUT /points/vectors in batches, wait until green
"""
import json, os, sys, time, zlib

import httpx
import numpy as np
from scipy import sparse as sp

from common import (ARENA, B, BODY_FIELDS, BODY_W, COLLECTION, K1, OUT, QDRANT, VECTOR, C, S, avglens, doc_values,
                    field_counts, idf_from_df, update_result)


def compute():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    cat = C.load()
    rows = np.arange(len(cat.ids))
    eligible = cat.votes >= 2000
    mats, lens, vocab = field_counts(cat, rows)
    avg = avglens(lens, eligible)
    D = doc_values(mats, lens, avg)
    t_build = time.time() - t0

    # --- bitwise check against sparse.py (eligible rows) ---------------------------------------------------------------
    X_rows, S_vocab, X, idf_ref = S.index({**{f: 0.0 for f in S.FIELDS}, **BODY_W})
    Xr = X.tocsr()
    inv = {j: t for t, j in S_vocab.items()}
    # sparse.py's matrix in our vocab ids, eligible rows only
    col_map = np.full(len(S_vocab), -1, np.int64)
    for t, j in S_vocab.items():
        col_map[j] = vocab.get(t, -1)
    Xc = Xr.tocoo()
    assert (col_map[Xc.col] >= 0).all(), "a body term of sparse.py is missing from our vocab"
    Xm = sp.csr_matrix((Xc.data, (Xc.row, col_map[Xc.col])), shape=(len(X_rows), len(vocab)))
    Xm.sort_indices()
    De = D[X_rows]
    same_struct = (De.indptr == Xm.indptr).all() and (De.indices == Xm.indices).all()
    diff = np.abs(De.data - Xm.data) if same_struct else None
    check = dict(rows=int(len(X_rows)), nnz=int(Xm.nnz), same_structure=bool(same_struct),
                 bitwise_equal=bool(same_struct and (De.data == Xm.data).all()),
                 max_abs_diff=float(diff.max()) if diff is not None else None)

    # --- client term stats: df and IDF over the eligible corpus --------------------------------------------------------
    df = np.diff(D[np.flatnonzero(eligible)].tocsc().indptr).astype(np.int64)
    N = int(eligible.sum())
    idf = idf_from_df(df.astype(np.float64), N)
    # IDF check against sparse.py (every body term with df > 0 there)
    ref = np.array([idf_ref[j] for t, j in S_vocab.items() if vocab.get(t, -1) >= 0 and df[vocab[t]] > 0])
    mine = np.array([idf[vocab[t]] for t, j in S_vocab.items() if vocab.get(t, -1) >= 0 and df[vocab[t]] > 0])
    check["idf_terms_compared"] = int(len(ref))
    check["idf_max_abs_diff"] = float(np.abs(ref - mine).max())
    # sparse.py's vocab also holds terms seen only in title / creators / cast; with df = 0 in the body fields they
    # get a large IDF there but hit no document, so the client can drop them
    check["sparse_py_vocab"] = len(S_vocab)
    check["sparse_py_terms_without_body_hits"] = int(sum(1 for t in S_vocab if vocab.get(t, -1) < 0 or df[vocab[t]] == 0))
    print("check:", check, flush=True)

    # --- term ids: the vocab index (append-only) vs a 32-bit hash ------------------------------------------------------
    terms = [None] * len(vocab)
    for t, j in vocab.items():
        terms[j] = t
    crc = np.array([zlib.crc32(t.encode()) for t in terms], np.uint64)
    _, cnt = np.unique(crc, return_counts=True)
    ids_note = dict(vocab_all_titles=len(vocab), vocab_eligible_df_gt0=int((df > 0).sum()),
                    crc32_colliding_terms=int(cnt[cnt > 1].sum()))

    stats = dict(k1=K1, b=B, fields=BODY_W, field_order=BODY_FIELDS, N=N, avglen={f: float(v) for f, v in avg.items()},
                 terms={t: [j, int(df[j])] for j, t in enumerate(terms)})
    json.dump(stats, open(os.path.join(OUT, "term_stats.json"), "w"), separators=(",", ":"))
    # compact variant: eligible df > 0 only (what the webapp actually needs to score queries)
    slim = {t: [j, int(df[j])] for j, t in enumerate(terms) if df[j] > 0}
    json.dump(dict(stats, terms=slim), open(os.path.join(OUT, "term_stats_eligible.json"), "w"), separators=(",", ":"))
    sp.save_npz(os.path.join(OUT, "doc_values.npz"), D)
    np.save(os.path.join(OUT, "lens.npy"), np.stack([lens[f] for f in BODY_FIELDS]))
    per_doc = np.diff(D.indptr)
    summary = dict(build_s=round(t_build, 1), titles=int(D.shape[0]), nnz=int(D.nnz),
                   nnz_per_title_mean=round(float(per_doc.mean()), 1), nnz_per_title_p50=int(np.median(per_doc)),
                   nnz_per_title_max=int(per_doc.max()), titles_without_terms=int((per_doc == 0).sum()),
                   eligible_nnz=int(D[np.flatnonzero(eligible)].nnz), **ids_note,
                   avglen={f: float(v) for f, v in avg.items()}, N=N, check=check,
                   term_stats_bytes=os.path.getsize(os.path.join(OUT, "term_stats.json")),
                   term_stats_eligible_bytes=os.path.getsize(os.path.join(OUT, "term_stats_eligible.json")))
    print(json.dumps(summary, indent=1), flush=True)
    update_result("build", summary)


def wait_green(http, timeout=3600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        info = http.get(f"/collections/{COLLECTION}").json()["result"]
        if info["status"] == "green" and info["optimizer_status"] == "ok":
            return time.time() - t0, info
        time.sleep(2)
    raise TimeoutError


def upload():
    cat = C.load()
    D = sp.load_npz(os.path.join(OUT, "doc_values.npz")).tocsr()
    http = httpx.Client(base_url=QDRANT, timeout=600)
    info = http.get(f"/collections/{COLLECTION}").json()["result"]
    before = dict(points=info["points_count"], indexed_vectors_count=info["indexed_vectors_count"],
                  vectors=list(info["config"]["params"]["vectors"]))
    if VECTOR not in (info["config"]["params"].get("sparse_vectors") or {}):
        # no modifier: Qdrant's IDF modifier is computed per shard (checked on a 2-shard probe collection), and over
        # every point holding the vector (all 191,634 titles), not the eligible corpus
        http.put(f"/collections/{COLLECTION}/vectors/{VECTOR}", params=dict(wait="true"),
                 json=dict(sparse=dict(index=dict(on_disk=False)))).raise_for_status()
    t0 = time.time()
    Bt = 1000
    for i in range(0, D.shape[0], Bt):
        pts = []
        for r in range(i, min(i + Bt, D.shape[0])):
            a, e = D.indptr[r], D.indptr[r + 1]
            # a title without body terms gets no sparse vector (Qdrant would store an empty one)
            if e > a:
                pts.append(dict(id=int(cat.ids[r]), vector={VECTOR: dict(indices=D.indices[a:e].tolist(),
                                                                          values=D.data[a:e].tolist())}))
        http.put(f"/collections/{COLLECTION}/points/vectors", params=dict(wait="true"),
                 json=dict(points=pts)).raise_for_status()
    upload_s = time.time() - t0
    wait_s, info = wait_green(http)
    after = dict(points=info["points_count"], indexed_vectors_count=info["indexed_vectors_count"],
                 segments=info["segments_count"], vectors=list(info["config"]["params"]["vectors"]),
                 sparse_vectors=info["config"]["params"].get("sparse_vectors"))
    res = dict(method=f"PUT /collections/{{c}}/vectors/{VECTOR} {{sparse: {{index: {{on_disk: false}}}}}} on the "
                      "existing collection, then PUT /points/vectors (1,000 points per request, wait=true)",
               upload_s=round(upload_s, 1), optimize_wait_s=round(wait_s, 1), before=before, after=after)
    print(res, flush=True)
    update_result("upload", res)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["compute", "upload"]
    if "compute" in steps:
        compute()
    if "upload" in steps:
        upload()
