"""The prototype's BM25F (harness/sparse.py, body fields) split into a document side stored as a Qdrant sparse vector
and a query side computed in the client.

sparse.py scores  s(q, d) = sum over the query's distinct terms t of  qw(t) * w(t, d)  with
    w(t, d) = tf~ / (k1 + tf~),  tf~ = sum_f  W_f * tf_f(t, d) / (1 - b + b * len_f(d) / avglen_f)
    qw(t)   = IDF(t) = ln(1 + (N - df + 0.5) / (df + 0.5))       (text queries: main query, coverage units, mentions)
    qw(t)   = share of seeds holding t * IDF(t)                  (the reference term profile)
w depends only on the document and the corpus constants k1, b, W_f, avglen_f, so it is the stored sparse value;
qw is the query vector. The Qdrant sparse dot product sum_t q_t * d_t is then exactly s(q, d).

The corpus of sparse.py is the eligible titles (votes >= 2000): N, df and avglen_f come from them. The document side
here is computed for every catalog title (191,634) with the eligible avglen_f, so eligible titles get exactly
sparse.py's values; ineligible ones get values on the same scale and are removed by the query filter anyway.

The arithmetic mirrors sparse.index() operation by operation in float32 (same field order, same scipy sums), so the
eligible rows are bitwise equal to sparse.py's matrix (checked in build.py).
"""
import json, os, sys

import numpy as np
from scipy import sparse as sp

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ARENA, "harness"))
import catalog as C  # noqa: E402
import sparse as S  # noqa: E402

OUT = os.path.join(HERE, "out")
RESULT = os.path.join(ARENA, "results", "bench", "sparse.json")
TRACE = os.path.join(ARENA, "results", "bench", "trace", "trace.jsonl")
QDRANT = "http://127.0.0.1:16333"
COLLECTION = "media_fingerprint_v1_f16"
VECTOR = "terms_bm25f"

# simp_combo.BODY: the BM25 body fields of combo-safe-v3 (title, creators, cast weigh 0 and are skipped by sparse.py)
BODY_W = {f: w for f, w in {**S.DEFAULT_W, "title": 0.0, "creators": 0.0, "cast": 0.0}.items() if w}
BODY_FIELDS = [f for f in S.FIELDS if f in BODY_W]   # sparse.py sums fields in FIELDS order
K1, B = S.K1, S.B


def spans(cat, r):
    """The body fields of catalog row r as lists of text spans (sparse._field_spans without title / people)."""
    return dict(tags=cat.essence_tags[r], keywords=cat.keywords[r], tropes=cat.tropes[r], essence=[cat.essence_text[r]])


def field_counts(cat, rows, vocab=None):
    """Per body field: a CSR count matrix (len(rows) x vocab) and the unigram length per row. The vocab is grown in
    first-seen order (append-only: a term keeps its id forever)."""
    vocab = {} if vocab is None else vocab
    trip = {f: ([], [], []) for f in BODY_FIELDS}
    lens = {f: np.zeros(len(rows), np.float32) for f in BODY_FIELDS}
    for i, r in enumerate(rows):
        sp_ = spans(cat, r)
        for f in BODY_FIELDS:
            counts, n = {}, 0
            for s in sp_[f]:
                n += len(S.tokens(s))
                for t in S.terms(s):
                    counts[t] = counts.get(t, 0) + 1
            lens[f][i] = n
            ri, ci, vi = trip[f]
            for t, c in counts.items():
                ri.append(i)
                ci.append(vocab.setdefault(t, len(vocab)))
                vi.append(c)
    mats = {f: sp.csr_matrix((np.array(v, np.float32), (np.array(r_, np.int64), np.array(c_, np.int64))),
                             shape=(len(rows), len(vocab))) for f, (r_, c_, v) in trip.items()}
    return mats, lens, vocab


def avglens(lens, eligible):
    """avglen_f as sparse.py computes it: the float32 mean over eligible rows with a non-empty field."""
    out = {}
    for f in BODY_FIELDS:
        L = lens[f][eligible]
        out[f] = L[L > 0].mean() if (L > 0).any() else np.float32(1)
    return out


def doc_values(mats, lens, avg, k1=K1, b=B):
    """w(t, d) for every row: sparse.index()'s arithmetic with the given avglen_f (float32 throughout)."""
    tf = None
    for f in BODY_FIELDS:
        L = lens[f]
        norm = 1 - b + b * L / avg[f]
        m = sp.diags((BODY_W[f] / np.maximum(norm, 1e-6)).astype(np.float32)) @ mats[f]
        tf = m if tf is None else tf + m
    tf = tf.tocsr()
    tf.data = tf.data / (k1 + tf.data)
    tf.sort_indices()
    return tf


def idf_from_df(df, n):
    return np.log(1 + (n - df + 0.5) / (df + 0.5))


def load_stats():
    """The client-side term stats (what the webapp holds): {term: [id, df]}, N and the build constants."""
    return json.load(open(os.path.join(OUT, "term_stats.json")))


def trace():
    return [json.loads(line) for line in open(TRACE)]


def update_result(section, value):
    res = json.load(open(RESULT)) if os.path.exists(RESULT) else {}
    res[section] = value
    json.dump(res, open(RESULT, "w"), indent=1)
