"""Build a LOCAL Qdrant collection shaped like the r3-combo-fast proposal (never production).

Usage: .venv/bin/python harness/live_build.py <collection> <eligible|all> [url]
  url defaults to http://127.0.0.1:6533 and must be a loopback address.

Named vectors: bge (768 cosine, int8 always_ram), me5s (384 cosine, int8 always_ram; non-English route),
fingerprint_v1 (74 cosine, the normalized Qdrant fingerprint), fp_raw (74 dot, raw 0..10 scores: dot with the
query weights = production's weighted sum). Sparse `lex` (modifier idf): saturated BM25F weights from sparse.py,
term index = crc32(term) (see live_common.term_index).
"""
import sys, time, zlib
from urllib.parse import urlparse

import numpy as np
from scipy import sparse as sp
from qdrant_client import QdrantClient, models as M

sys.path.insert(0, __import__("os").path.dirname(__file__))
import catalog as C  # noqa: E402
import sparse as S  # noqa: E402

name, scope = sys.argv[1], sys.argv[2]
url = sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:6533"
assert urlparse(url).hostname in ("127.0.0.1", "localhost"), "local Qdrant only"


def term_index(t):
    return zlib.crc32(t.encode("utf-8"))


def build_sparse(rows):
    """sparse.index() generalized to any row set: (csr doc x vocab, vocab list)."""
    cat = C.load()
    people = S._people()
    vocab = {}
    per_field = {f: ([], [], []) for f in S.FIELDS}
    lens = {f: np.zeros(len(rows), np.float32) for f in S.FIELDS}
    for i, r in enumerate(rows):
        spans = S._field_spans(cat, r, people)
        for f in S.FIELDS:
            counts, n = {}, 0
            for s in spans[f]:
                n += len(S.tokens(s))
                for t in S.terms(s):
                    counts[t] = counts.get(t, 0) + 1
            lens[f][i] = n
            ri, ci, vi = per_field[f]
            for t, c in counts.items():
                ri.append(i); ci.append(vocab.setdefault(t, len(vocab))); vi.append(c)
    tf = None
    for f, (r_, c_, v) in per_field.items():
        m = sp.csr_matrix((np.array(v, np.float32), (np.array(r_), np.array(c_))), shape=(len(rows), len(vocab)))
        L = lens[f]
        avg = L[L > 0].mean() if (L > 0).any() else 1
        norm = 1 - S.B + S.B * L / avg
        m = sp.diags((S.DEFAULT_W[f] / np.maximum(norm, 1e-6)).astype(np.float32)) @ m
        tf = m if tf is None else tf + m
    tf = tf.tocsr()
    tf.data = tf.data / (S.K1 + tf.data)
    inv = [None] * len(vocab)
    for t, j in vocab.items():
        inv[j] = t
    return tf, inv


cat = C.load()
if scope == "eligible":
    rows = np.flatnonzero(cat.eligible())
    r_, vocab, X, _ = S.index()  # identical to the harness index
    assert (r_ == rows).all()
    X = X.tocsr()
    inv = [None] * len(vocab)
    for t, j in vocab.items():
        inv[j] = t
else:
    rows = np.arange(len(cat.ids))
    t0 = time.time()
    X, inv = build_sparse(rows)
    print(f"sparse built over {len(rows)} rows in {time.time() - t0:.0f}s", flush=True)
hidx = np.array([term_index(t) for t in inv], np.uint32)
uniq = len(np.unique(hidx))
print(f"vocab {len(inv)}, crc32 collisions {len(inv) - uniq}, nnz {X.nnz}", flush=True)

bge = np.load(C.DATA + "/" + C.EMBEDDINGS["bgeb-notitle"][0], mmap_mode="r")
me5 = np.load(C.DATA + "/" + C.EMBEDDINGS["me5s"][0], mmap_mode="r")

client = QdrantClient(url=url, timeout=600)
if client.collection_exists(name):
    client.delete_collection(name)
q8 = M.ScalarQuantization(scalar=M.ScalarQuantizationConfig(type=M.ScalarType.INT8, always_ram=True))
client.create_collection(
    name,
    vectors_config={
        "bge": M.VectorParams(size=768, distance=M.Distance.COSINE, quantization_config=q8),
        "me5s": M.VectorParams(size=384, distance=M.Distance.COSINE, quantization_config=q8),
        "fingerprint_v1": M.VectorParams(size=74, distance=M.Distance.COSINE),
        "fp_raw": M.VectorParams(size=74, distance=M.Distance.DOT),
    },
    sparse_vectors_config={"lex": M.SparseVectorParams(modifier=M.Modifier.IDF)},
    optimizers_config=M.OptimizersConfigDiff(indexing_threshold=1000, default_segment_number=2),
)
for field, schema in [("votes", M.PayloadSchemaType.INTEGER), ("year", M.PayloadSchemaType.INTEGER),
                      ("media_type", M.PayloadSchemaType.KEYWORD), ("production_method", M.PayloadSchemaType.KEYWORD)] + \
                     [(f, M.PayloadSchemaType.BOOL) for f in C.BOOL_FLAGS]:
    client.create_payload_index(name, field, schema)


def points(lo, hi):
    out = []
    for i in range(lo, hi):
        r = int(rows[i])
        a, b = X.indptr[i], X.indptr[i + 1]
        ind, val = hidx[X.indices[a:b]], X.data[a:b]
        if len(np.unique(ind)) != len(ind):  # a collision inside one doc: sum the weights
            d = {}
            for k, v in zip(ind.tolist(), val.tolist()):
                d[k] = d.get(k, 0) + v
            ind, val = np.array(list(d)), np.array(list(d.values()))
        gw = cat.goodwatch_score[r]
        payload = dict(votes=int(cat.votes[r]), year=int(cat.year[r]), media_type=cat.media_type(r),
                       goodwatch_score=None if np.isnan(gw) else float(gw),
                       fingerprint_scores={k: float(v) for k, v in zip(C.DIMS, cat.fps[r])})
        if cat.production_method[r]:
            payload["production_method"] = cat.production_method[r]
        for f in C.BOOL_FLAGS:
            v = cat.flags[f][r]
            if v >= 0:
                payload[f] = bool(v)
        vec = {"bge": np.asarray(bge[r], np.float32).tolist(), "me5s": np.asarray(me5[r], np.float32).tolist(),
               "fingerprint_v1": cat.fp[r].tolist(), "fp_raw": cat.fps[r].tolist()}
        if len(ind):
            vec["lex"] = M.SparseVector(indices=ind.tolist(), values=val.tolist())
        out.append(M.PointStruct(id=int(cat.ids[r]), vector=vec, payload=payload))
    return out


t0 = time.time()
BATCH = 500
for lo in range(0, len(rows), BATCH):
    client.upsert(name, points(lo, min(lo + BATCH, len(rows))), wait=False)
    if lo % 20000 == 0:
        print(f"{lo}/{len(rows)} {time.time() - t0:.0f}s", flush=True)
print(f"uploaded {len(rows)} in {time.time() - t0:.0f}s", flush=True)
while True:
    info = client.get_collection(name)
    if info.status == M.CollectionStatus.GREEN and info.points_count == len(rows):
        break
    time.sleep(2)
print(f"green after {time.time() - t0:.0f}s: points {info.points_count}, indexed {info.indexed_vectors_count}, "
      f"segments {info.segments_count}", flush=True)
