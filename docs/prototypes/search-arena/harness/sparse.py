"""Local lexical index (round 3, `sparse`): BM25F over eligible catalog titles, shaped so it can ship as a
Qdrant sparse vector with the IDF modifier.

Per title, one sparse vector: for each term, the saturated BM25F term weight
    w(t, d) = tf~ / (k1 + tf~),  tf~ = sum_f  weight_f * tf_f(t, d) / (1 - b + b * len_f(d) / avglen_f)
over the fields title (+ original title), essence tags, keywords, trope names, essence text, creators
(director / show creators) and top cast. Terms are stemmed unigrams plus adjacent-word bigrams ("time_loop")
after stopword removal. The query side is a set of terms, each worth IDF(t) = ln(1 + (N - df + 0.5) / (df + 0.5)),
which is what Qdrant's `modifier: idf` computes at query time. So score(q, d) = sum_t IDF(t) * w(t, d): the
document vectors are static and the IDF stays current as the collection changes.

`scores(text)` returns BM25 scores for every catalog row (0 outside the index). Eligible rows only
(votes >= 2000), because every ranker masks to them.
"""
import gzip, json, math, os, re

import numpy as np
from scipy import sparse as sp

import catalog as C

_WORD = re.compile(r"[^\W_]+", re.UNICODE)
STOP = set("""a an the and or of to in on at for with without by from as is are was were be been being it its this that
these those there their them they he she his her him i me my we our you your do does did done not no nor but so than too
very can could would should will just about into over under after before through between during against up down out off
again further then once here where when why how all any both each few more most other some such only own same s t don
now also who whom which what while if because until get got make give want wants like something anything some kind
movie movies film films show shows series watch watching one ones really lot lots bit thing things feel feels""".split())
# Question words that only frame the request ("give me", "make it") are in STOP; content verbs stay.


def stem(w):
    """Light suffix stemmer (plural, -ing, -ed, -ly); close to Snowball on the words that matter here."""
    if len(w) <= 3 or w.isdigit():
        return w
    for suf, rep, minlen in (("ies", "y", 5), ("sses", "ss", 5), ("ness", "", 7), ("ings", "", 7), ("ing", "", 6),
                             ("edly", "", 7), ("ed", "", 5), ("ly", "", 6), ("es", "e", 5), ("s", "", 4)):
        if w.endswith(suf) and len(w) >= minlen:
            if suf == "s" and w.endswith(("ss", "us", "is")):
                return w
            if suf == "es" and not w.endswith(("ches", "shes", "xes", "sses", "zes")):
                return w[:-1]
            if suf == "es":
                return w[:-2]
            return w[: -len(suf)] + rep
    return w


def tokens(text):
    """Stemmed content words of a text, in order (stopwords dropped)."""
    out = []
    for w in _WORD.findall((text or "").lower()):
        if w in STOP or len(w) < 2:
            continue
        out.append(stem(w))
    return out


def terms(text):
    """Unigrams + adjacent bigrams of one text span (a field value is split into spans first)."""
    t = tokens(text)
    return t + [f"{a}_{b}" for a, b in zip(t, t[1:])]


FIELDS = ("title", "tags", "keywords", "tropes", "essence", "creators", "cast")
DEFAULT_W = dict(title=1.0, tags=2.0, keywords=2.0, tropes=1.0, essence=1.0, creators=4.0, cast=1.5)
K1, B = 1.2, 0.75

_state = {}


def _people():
    p = os.path.join(C.DATA, "people.jsonl.gz")
    out = {}
    if os.path.exists(p):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                out[r["id"]] = r
    return out


def _field_spans(cat, r, people):
    pr = people.get(int(cat.ids[r]), {})
    title = [cat.title[r]] + ([cat.original_title[r]] if cat.original_title[r] and cat.original_title[r] != cat.title[r] else [])
    return dict(title=title, tags=cat.essence_tags[r], keywords=cat.keywords[r], tropes=cat.tropes[r],
                essence=[cat.essence_text[r]], creators=pr.get("creators", []), cast=pr.get("cast", []))


def _build():
    cat = C.load()
    rows = np.flatnonzero(cat.eligible())
    people = _people()
    vocab = {}
    per_field = {f: ([], [], []) for f in FIELDS}  # (row idx, col, count)
    lens = {f: np.zeros(len(rows), np.float32) for f in FIELDS}
    for i, r in enumerate(rows):
        spans = _field_spans(cat, r, people)
        for f in FIELDS:
            counts = {}
            n = 0
            for s in spans[f]:
                ts = terms(s)
                n += len(tokens(s))
                for t in ts:
                    counts[t] = counts.get(t, 0) + 1
            lens[f][i] = n
            ri, ci, vi = per_field[f]
            for t, c in counts.items():
                j = vocab.setdefault(t, len(vocab))
                ri.append(i)
                ci.append(j)
                vi.append(c)
    mats = {f: sp.csr_matrix((np.array(v, np.float32), (np.array(r_), np.array(c_))), shape=(len(rows), len(vocab)))
            for f, (r_, c_, v) in per_field.items()}
    return dict(rows=rows, vocab=vocab, mats=mats, lens=lens)


def index(weights=None, k1=K1, b=B):
    """(rows, vocab, doc matrix of saturated weights, idf). Cached per weight config."""
    if "base" not in _state:
        _state["base"] = _build()
    base = _state["base"]
    w = {**DEFAULT_W, **(weights or {})}
    key = (tuple(sorted(w.items())), k1, b)
    if key not in _state:
        tf = None
        for f in FIELDS:
            if not w[f]:
                continue
            L = base["lens"][f]
            avg = L[L > 0].mean() if (L > 0).any() else 1
            norm = 1 - b + b * L / avg
            m = sp.diags((w[f] / np.maximum(norm, 1e-6)).astype(np.float32)) @ base["mats"][f]
            tf = m if tf is None else tf + m
        tf = tf.tocsr()
        tf.data = tf.data / (k1 + tf.data)
        df = np.diff(tf.tocsc().indptr).astype(np.float64)
        N = tf.shape[0]
        idf = np.log(1 + (N - df + 0.5) / (df + 0.5))
        _state[key] = (base["rows"], base["vocab"], tf.tocsc(), idf)
    return _state[key]


def query_terms(text):
    seen = []
    for t in terms(text):
        if t not in seen:
            seen.append(t)
    return seen


def scores(text, weights=None, bigram=1.0):
    """BM25F score per catalog row (full catalog length, 0 outside the eligible index)."""
    rows, vocab, X, idf = index(weights)
    cat = C.load()
    out = np.zeros(len(cat.ids), np.float32)
    cols, qw = [], []
    for t in query_terms(text):
        j = vocab.get(t)
        if j is not None:
            cols.append(j)
            qw.append(idf[j] * (bigram if "_" in t else 1.0))
    if not cols:
        return out
    s = X[:, cols] @ np.array(qw, np.float32)
    out[rows] = s
    return out


def doc_freq():
    """Term -> document frequency in the eligible index (for the spell-corrector vocabulary)."""
    rows, vocab, X, idf = index()
    df = np.diff(X.indptr)
    return {t: int(df[j]) for t, j in vocab.items() if "_" not in t}


def stats(weights=None):
    rows, vocab, X, idf = index(weights)
    nnz = X.nnz
    return dict(docs=len(rows), vocab=len(vocab), nnz=nnz, nnz_per_doc=nnz / len(rows))
