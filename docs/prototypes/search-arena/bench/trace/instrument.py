"""Record the store access plan of `simp_combo.FINAL["combo-safe-v3"]` without changing what it computes.

`install()` wraps the ranker in place (module attributes, the catalog matrices, the query encoders); `Trace` holds
one query's record. Nothing in simp_combo.py is edited: every hook computes exactly what the wrapped code computed
and hands back the same values (numpy views of the same buffers), so the ranked lists stay identical.

How the hooks see store reads:
- The catalog matrices that move to the stores (text_en = bge-base notitle, text_multi = multilingual-e5-small,
  fingerprint_v1 = the L2-normalized 74-d fingerprint, fingerprint_raw = the raw 0..10 fingerprint scores) become
  `TrackedMatrix` views. `M @ q` returns a `TrackedScores` column that knows its source (vector set, query vector);
  `M[ids]` is a vector fetch.
- A `TrackedScores` column indexed with the candidate rows inside `top()` is a top-k query over the filter; indexed
  with the pool (the `cand` of the final `top()`) it is a "score these ids" query.
- BM25 columns come from wrapped `sparse_top` (top-k; its scores are kept only for its hits, so the pool needs no
  second BM25 read), `term_scores` (seed term vectors fetched, then a weighted-term query) and `mention_scores`.
- `mix_z` (non-English: z-mix of the me5s and bge cosines over every filtered row) is recorded as a full-scan mix.
Timing: the wall time of `rank()` minus the time inside store-emulating hooks and query encodes is the in-memory
compute that would stay in the webapp.
"""
import base64, inspect, os, sys, threading, time

import numpy as np

HARNESS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "harness")
sys.path.insert(0, HARNESS)
import catalog as C  # noqa: E402
import qemb  # noqa: E402
import simp_combo as SC  # noqa: E402
import sparse as S  # noqa: E402

# catalog matrix -> (store vector set, dim, distance)
VECTOR_SETS = {
    "bgeb-notitle": ("text_en", 768, "cosine"),
    "me5s": ("text_multi", 384, "cosine"),
    "fp": ("fingerprint_v1", 74, "cosine"),
    "fps": ("fingerprint_raw", 74, "dot"),
}
# simp_combo cache key -> in-memory table name (None: not webapp memory)
TABLES = {
    "word_freq": "spell_vocabulary", "labels": "negation_labels", "doc_freq": "bm25_term_stats",
    "reference_titles": "like_title_index", "franchise_titles": "franchise_titles", "persons": "persons",
    "credits": "credits", "studios": "studios", "name_index": "name_index", "fuzzy_keys": "fuzzy_name_keys",
    "intent_vectors": "intent_examples", "peer_index": "peer_centroids", "cut_edges": "alternate_cuts",
    "eligible_titles": "title_names", "body_rows": None, "intent_pool": None,
}

REC = None                     # the Trace of the query being ranked (None: hooks pass through)
_tl = threading.local()        # per-thread nesting depth of timed regions
ORIG = {}


def _b64(v):
    return base64.b64encode(np.asarray(v, np.float32).tobytes()).decode()


def _is_idx(i):
    return isinstance(i, np.ndarray) and i.dtype.kind in "iu" and i.ndim == 1


class _Timer:
    """Adds the region's time to REC.t[cat] unless an outer timed region is open on this thread."""

    def __init__(self, cat):
        self.cat = cat

    def __enter__(self):
        self.outer = getattr(_tl, "depth", 0) > 0
        _tl.depth = getattr(_tl, "depth", 0) + 1
        self.t0 = time.perf_counter()

    def __exit__(self, *a):
        dt = time.perf_counter() - self.t0
        _tl.depth -= 1
        if not self.outer and REC is not None:
            with REC.lock:
                REC.t[self.cat] += dt


def _overhead(fn):
    """Recorder bookkeeping: timed separately so it is not charged to the ranker's in-memory compute."""
    def w(*a, **kw):
        with _Timer("overhead"):
            return fn(*a, **kw)
    w.__name__ = fn.__name__
    return w


# --- caller roles (labels only) -------------------------------------------------------------------------------------

def _line_roles(fn, pairs):
    lines, start = inspect.getsourcelines(fn)
    out = {}
    for i, line in enumerate(lines):
        for needle, role in pairs:
            if needle in line:
                out[start + i] = role
    return out


_ROLE_LINES = {}


def _role(default="other"):
    f = sys._getframe(1)
    while f is not None:
        m = _ROLE_LINES.get(f.f_code)
        if m is not None:
            return m.get(f.f_lineno, default)
        f = f.f_back
    return default


# --- tracked arrays -------------------------------------------------------------------------------------------------

class TrackedMatrix(np.ndarray):
    """A catalog matrix that lives in a store: `M @ q` is a scoring source, `M[ids]` a vector fetch."""
    set_key = None

    def __array_finalize__(self, obj):
        self.set_key = getattr(obj, "set_key", None)

    def __array_ufunc__(self, ufunc, method, *inputs, **kw):
        plain = [np.asarray(x) if isinstance(x, np.ndarray) else x for x in inputs]
        if (REC is not None and ufunc is np.matmul and method == "__call__" and len(inputs) == 2
                and isinstance(inputs[0], TrackedMatrix) and np.ndim(inputs[1]) == 1):
            with _Timer("store"):
                res = np.matmul(*plain, **kw)
            return REC.scores_from_matrix(res, inputs[0].set_key, inputs[1], _role())
        return getattr(ufunc, method)(*plain, **kw)

    def __getitem__(self, idx):
        base = np.asarray(self)
        if REC is not None and _is_idx(idx):
            with _Timer("store"):
                out = base[idx]
            REC.fetch_vectors(self.set_key, idx)
            return out
        return base[idx]


class TrackedScores(np.ndarray):
    """A per-title score column read from a store. Indexing it with row ids is a read; arithmetic is plain."""
    src = None
    gathered = None

    def __array_finalize__(self, obj):
        self.src = None
        self.gathered = None

    def __array_ufunc__(self, ufunc, method, *inputs, **kw):
        plain = [np.asarray(x) if isinstance(x, np.ndarray) else x for x in inputs]
        return getattr(ufunc, method)(*plain, **kw)

    def __getitem__(self, idx):
        base = np.asarray(self)
        if REC is not None and self.src is not None and self.gathered is None and _is_idx(idx):
            with _Timer("store"):
                out = base[idx]
            REC.gather(self.src, idx)
            v = out.view(TrackedScores)
            v.src, v.gathered = self.src, idx
            return v
        return base[idx]


def tracked(arr, src):
    v = np.asarray(arr).view(TrackedScores)
    v.src = src
    return v


# --- the per-query record ---------------------------------------------------------------------------------------------

class Trace:
    def __init__(self, ctx):
        self.ctx = ctx
        self.lock = threading.RLock()
        self.ops, self.encodes, self.vectors, self.vec_meta = [], [], {}, {}
        self._vec_of, self._keep = {}, []
        self.id_lists = {}
        self.gathers = []             # (seq, src, idx)
        self.seq = 0
        self.tables = set()
        self.t = {"store": 0.0, "encode": 0.0, "overhead": 0.0}
        self.mem = {}                 # in-memory function -> inclusive ms (a breakdown, not exclusive)
        self.filter = None
        self.filter_rows = None
        self.cand = None
        self.in_profile = False
        self.topk_rows = []           # idx arrays used by top-k scans
        self.topk_sets = {}           # source signature -> rows its top-k returned
        self.non_en, self.ref = None, None
        self.peer_rows = 0

    def next_seq(self):
        with self.lock:
            self.seq += 1
            return self.seq

    # vectors and id lists
    @_overhead
    def vec(self, v, kind="anon", **meta):
        with self.lock:
            k = id(v)
            if k in self._vec_of:
                return self._vec_of[k]
            vid = f"{'e' if kind == 'encode' else 'v'}{len(self.vectors)}"
            self._vec_of[k] = vid
            self._keep.append(v)
            self.vectors[vid] = np.asarray(v, np.float32).copy()
            self.vec_meta[vid] = dict(kind=kind, **meta)
            return vid

    @_overhead
    def ids_ref(self, rows, name):
        pids = [int(p) for p in C.load().ids[np.asarray(rows)]]
        for k, v in self.id_lists.items():
            if v == pids:
                return k
        key = name if name not in self.id_lists else f"{name}{len(self.id_lists)}"
        self.id_lists[key] = pids
        return key

    @_overhead
    def add_op(self, **op):
        op.setdefault("seq", self.next_seq())
        with self.lock:
            op["id"] = f"op{len(self.ops)}"
            self.ops.append(op)
        return op["id"]

    # encodes
    @_overhead
    def encode(self, model, text, v, role):
        with self.lock:
            prior = [e for e in self.encodes if e["model"] == model and e["text"] == text]
            vid = self.vec(v, "encode", model=model, text=text)
            _, hf, prefix = C.EMBEDDINGS[model]
            self.encodes.append(dict(id=vid, model=model, hf_model=hf, prefix=prefix, text=text, role=role,
                                     dim=int(np.asarray(v).shape[0]), repeat=bool(prior), seq=self.next_seq()))
            return vid

    # sources
    @_overhead
    def scores_from_matrix(self, res, set_key, q, role):
        vid = self.vec(q, "jev_weights" if set_key == "fps" else "anon")
        meta = self.vec_meta[vid]
        src = dict(kind="fp" if set_key in ("fp", "fps") else "dense", set_key=set_key, vector=vid,
                   deps=list(meta.get("deps", [])), encodes=[vid] if meta["kind"] == "encode" else [],
                   role=role if role != "other" else meta.get("role", role), profile=self.in_profile)
        return tracked(res, src)

    @_overhead
    def fetch_vectors(self, set_key, idx):
        name, dim, _ = VECTOR_SETS[set_key]
        op = self.add_op(kind="fetch_vectors", store="qdrant" if set_key != "fps" else "any", vector_set=name, dim=dim,
                         ids=self.ids_ref(idx, "seeds"), n_ids=int(len(idx)), deps=[], role="reference seeds")
        self.last_fetch = op

    @_overhead
    def gather(self, src, idx):
        with self.lock:
            self.gathers.append((self.next_seq(), src, idx))

    # the filter every top-k list runs under
    @_overhead
    def set_filter(self, text, mask_in, mask_out):
        cat = C.load()
        ctx = self.ctx
        req, exc, media, method = [], [], None, None
        for fid, decision, kind in ctx.flags:
            wanted = decision == "required"
            soft = fid.startswith("suitability_") or fid.startswith("context_")
            if not wanted and soft:
                continue
            if fid in ("movie", "show"):
                if wanted:
                    media = fid
                else:
                    exc.append(f"media_type:{fid}")
            elif fid in ("animated", "live_action"):
                pm = "Animation" if fid == "animated" else "Live-Action"
                (req if wanted else exc).append(f"production_method:{pm}")
            else:
                (req if wanted else exc).append(fid)
        years = None
        m = SC._ERA.search(text)
        if m and not (mask_out is mask_in):
            if m.group(3):
                years = [int(m.group(3))] * 2
            else:
                lo = int(m.group(1) or (19 if int(m.group(2)) >= 2 else 20)) * 100 + 10 * int(m.group(2))
                years = [lo, lo + 9]
        self.filter = dict(min_votes=2000, adult=False, media_type=media, required=req, excluded=exc,
                           year_range=years, n_rows=int(mask_out.sum()))
        # the filter spec must rebuild the mask exactly
        chk = cat.votes >= 2000
        if media:
            chk &= cat.is_show if media == "show" else ~cat.is_show
        for f, want in [(f, True) for f in req] + [(f, False) for f in exc]:
            if f.startswith("media_type:"):
                has = cat.is_show if f.endswith("show") else ~cat.is_show
            elif f.startswith("production_method:"):
                pm = f.split(":", 1)[1]
                has = np.array([p == pm for p in cat.production_method])
            else:
                has = cat.flags[f] == 1
            chk &= has if want else ~has
        if years:
            chk &= (cat.year >= years[0]) & (cat.year <= years[1])
        self.filter["verified"] = bool(np.array_equal(chk, mask_out))


def _sig(src):
    return (src["kind"], src.get("set_key"), src.get("vector"), str(src.get("terms")))


def _op_for_src(src, kind_suffix):
    """Store op fields for a scoring source."""
    if src["kind"] in ("dense", "fp"):
        name, dim, dist = VECTOR_SETS[src["set_key"]]
        if src["set_key"] == "fps":
            return dict(kind=f"fp_{kind_suffix}", store="qdrant|crate", vector_set=name, dim=dim, distance=dist,
                        vector=src["vector"], role=src["role"],
                        note="production's weighted sum: raw 0..10 fingerprint scores . Jev weights (weights can be "
                             "negative). Needs a raw-score Dot named vector in Qdrant (the bench collections only "
                             "have the normalized fingerprint_v1) or an ORDER BY over Crate's fps column")
        return dict(kind=f"{src['kind']}_{kind_suffix}", store="qdrant" if src["set_key"] != "fps" else "qdrant|crate",
                    vector_set=name, dim=dim, distance=dist, vector=src["vector"], role=src["role"])
    if src["kind"] == "bm25":
        return dict(kind=f"bm25_{kind_suffix}", store="crate", fields=src["fields"], text=src.get("text"),
                    terms=src["terms"], role=src["role"])
    raise ValueError(src["kind"])


# --- wrappers ---------------------------------------------------------------------------------------------------------

def _w_top(rows, score, k):
    if REC is not None and isinstance(score, TrackedScores) and score.src is not None and score.gathered is rows:
        src = score.src
        with _Timer("store"):
            out = ORIG["top"](rows, np.asarray(score), k)
        vals = out[1]
        base = dict(k=int(k), filter="F", n_filter_rows=int(len(rows)), n_returned=int(len(vals)),
                    n_positive=int((vals > 0).sum()), positive_only=bool(src.get("profile")))
        if src["kind"] == "mix":
            ops = [_op_for_src(p, "topk") for p in src["parts"]]
            REC.add_op(kind="dense_mix_topk", store="qdrant", full_scan=True, mix_w=src["w"],
                       parts=[dict(vector_set=o["vector_set"], vector=o["vector"], role=o["role"]) for o in ops],
                       role="dense:query (non-English z-mix)", deps=sorted({d for p in src["parts"] for d in p["deps"]}),
                       encodes=[e for p in src["parts"] for e in p["encodes"]], **base,
                       note="scores = (1-w) z(cos_multi) + w z(cos_en), z over EVERY filtered row: needs the mean/std "
                            "of both cosines over the whole filter and the top-k of the mixed score")
        else:
            REC.add_op(deps=list(src["deps"]), encodes=list(src.get("encodes", [])), **_op_for_src(src, "topk"), **base)
            with _Timer("overhead"):
                REC.topk_sets[_sig(src)] = set(out[0].tolist())
        REC.topk_rows.append(rows)
        return out
    if REC is not None and k == SC.TOP:
        REC.cand = rows                      # the pool: the final top() ranks it
    return ORIG["top"](rows, np.asarray(score) if isinstance(score, np.ndarray) else score, k)


def _bm25_terms(text, weights):
    rows, vocab, X, idf = S.index(weights)
    out = []
    for t in S.query_terms(text):
        j = vocab.get(t)
        if j is not None:
            out.append([t, round(float(idf[j]), 6)])
    return out


def _fields(weights):
    return {f: w for f, w in {**S.DEFAULT_W, **(weights or {})}.items() if w}


def _w_sparse_top(text, weights, mask, rows, k):
    if REC is None:
        return ORIG["sparse_top"](text, weights, mask, rows, k)
    role = _role("bm25")
    with _Timer("store"):
        kept, hits = ORIG["sparse_top"](text, weights, mask, rows, k)
    with _Timer("overhead"):
        terms = _bm25_terms(text, weights)
    op = REC.add_op(kind="bm25_topk", store="crate", fields=_fields(weights), text=text, terms=terms,
                    k=int(k), filter="F", n_filter_rows=int(len(rows)), n_returned=int(len(hits)),
                    n_positive=int(len(hits)), positive_only=True, deps=[], encodes=[], role=role,
                    note="scores kept only for these hits (0 elsewhere): the pool needs no second read of this signal")
    REC.topk_rows.append(rows)
    return tracked(kept, dict(kind="bm25_kept", op=op, role=role)), hits


def _w_term_scores(seeds, cfg):
    if REC is None:
        return ORIG["term_scores"](seeds, cfg)
    seq = REC.next_seq()
    with _Timer("store"):
        out = ORIG["term_scores"](seeds, cfg)
    ov = _Timer("overhead")
    ov.__enter__()
    rows_idx, vocab, X, idf = S.index(cfg["body"])
    pos, Xr = SC._cache[("body_rows", str(cfg["body"]))]
    ii = [pos[r] for r in seeds if r in pos]
    fetch = REC.add_op(seq=seq, kind="fetch_terms", store="crate", fields=_fields(cfg["body"]),
                       ids=REC.ids_ref(np.array([r for r in seeds if r in pos], np.int64), "seeds"), n_ids=len(ii),
                       deps=[], role="reference seeds: BM25F term vectors")
    terms = []
    if ii:   # the weighted-term query term_scores ran (recomputed here only to record it)
        if "inv" not in ORIG:
            ORIG["inv"] = {j: t for t, j in vocab.items()}
        inv = ORIG["inv"]
        dfo = np.asarray((Xr[ii] > 0).sum(0)).ravel()
        w = dfo / len(ii) * idf
        w[dfo < min(cfg["terms_min_df"], len(ii))] = 0
        terms = [[inv[int(c)], round(float(w[c]), 6)] for c in SC.top_terms(w, cfg)]
    REC.tables.add("bm25_term_stats")
    ov.__exit__()
    return tracked(out, dict(kind="bm25", fields=_fields(cfg["body"]), terms=terms, deps=[fetch], encodes=[],
                             role="profile:terms", profile=True,
                             weights_note="query weight = share of seeds holding the term x IDF (no extra IDF)"))


def _w_mention_scores(det, cfg):
    if REC is None:
        return ORIG["mention_scores"](det, cfg)
    ov = _Timer("overhead")
    ov.__enter__()
    names = []
    for e in det.entities:   # the text mention_scores builds (recorded only)
        if e.kind == "studio":
            names.append(SC.fold(e.name))
            continue
        for pid in e.ids:
            full = SC.fold(SC.persons()[pid]["name"])
            names.append(full)
            c = SC.resolve_key(full.split()[-1], cfg) if " " in full else None
            if c is not None and pid in c.ids:
                names.append(full.split()[-1])
    text = " ".join(names)
    terms = _bm25_terms(text, cfg["body"])
    ov.__exit__()
    with _Timer("store"):
        out = ORIG["mention_scores"](det, cfg)
    return tracked(out, dict(kind="bm25", fields=_fields(cfg["body"]), text=text, terms=terms,
                             deps=[], encodes=[], role="profile:mention", profile=True))


def _w_mix_z(x, y, rows, w):
    if REC is None or not isinstance(x, TrackedScores) or not isinstance(y, TrackedScores):
        return ORIG["mix_z"](x, y, rows, w)
    with _Timer("store"):
        out = ORIG["mix_z"](np.asarray(x), np.asarray(y), rows, w)
    return tracked(out, dict(kind="mix", parts=[x.src, y.src], w=w, role="dense:query (non-English z-mix)",
                             deps=x.src["deps"] + y.src["deps"], encodes=x.src["encodes"] + y.src["encodes"]))


def _w_centroid(M, rows, cat):
    if REC is None or not isinstance(M, TrackedMatrix):
        return ORIG["centroid"](M, rows, cat)
    REC.tables.add("title_table")    # log-votes weights of the seeds
    c = ORIG["centroid"](M, rows, cat)
    REC.vec(c, "centroid", vector_set=VECTOR_SETS[M.set_key][0], deps=[REC.last_fetch],
            role=f"profile:{VECTOR_SETS[M.set_key][0]} centroid")
    return c


def _w_reference_profile(ref, cfg, cat):
    if REC is None:
        return ORIG["reference_profile"](ref, cfg, cat)
    REC.in_profile = True
    try:
        return ORIG["reference_profile"](ref, cfg, cat)
    finally:
        REC.in_profile = False


def _w_era_filter(text, mask):
    out = ORIG["era_filter"](text, mask)
    if REC is not None:
        REC.set_filter(text, mask, out)
    return out


def _w_resolve_reference(ctx, cfg, non_en):
    ref = ORIG["resolve_reference"](ctx, cfg, non_en)
    if REC is not None:
        REC.non_en = bool(non_en)
        REC.ref = ref
    return ref


def _w_peer_scores(det, fpc, cfg):
    out = ORIG["peer_scores"](det, fpc, cfg)
    if REC is not None:
        REC.peer_rows = int((out > 0).sum())
    return out


def _w_cached(key, build):
    if REC is not None:
        name = TABLES.get(key if isinstance(key, str) else key[0], key if isinstance(key, str) else key[0])
        if name:
            REC.tables.add(name)
    return ORIG["cached"](key, build)


def _w_qemb_embed(emb_name, text):
    if REC is None:
        return ORIG["qemb.embed"](emb_name, text)
    role = _role("encode")
    with _Timer("encode"):
        v = ORIG["qemb.embed"](emb_name, text)
    REC.encode(emb_name, text, v, role)
    return v


def _w_embed(model, text):
    if REC is None:
        return ORIG["embed"](model, text)
    with _Timer("encode"):
        v = ORIG["embed"](model, text)
    REC.encode(model, text, v, "intent" if model == SC.INTENT_EMB else "other")
    return v


MEM_FUNCS = ("resolve_reference", "spell", "label_negation", "facet_units", "peer_scores", "blend", "fold_cuts",
             "bound_own", "fuzzy_title")


def _mem_timed(name, fn):
    def w(*a, **kw):
        if REC is None:
            return fn(*a, **kw)
        t0 = time.perf_counter()
        try:
            return fn(*a, **kw)
        finally:
            with REC.lock:
                REC.mem[name] = REC.mem.get(name, 0.0) + (time.perf_counter() - t0) * 1000
    w.__name__ = name
    return w


def install():
    """Wrap the ranker (idempotent). Call after the caches are warm: the matrices are wrapped as views."""
    if ORIG:
        return
    cat = C.load()
    for name in ("top", "sparse_top", "term_scores", "mention_scores", "mix_z", "centroid", "reference_profile",
                 "era_filter", "cached", "embed", "resolve_reference", "peer_scores"):
        ORIG[name] = getattr(SC, name)
    ORIG["qemb.embed"] = qemb.embed
    _ROLE_LINES[ORIG["reference_profile"].__code__] = {}
    _ROLE_LINES[SC.rank_query.__code__] = _line_roles(SC.rank_query, [
        ("e_all = C.embeddings(INTENT_EMB) @ ref.det.qvec", "dense:query (intent vector)"),
        ("e_all = sims(emb_main, dense_text)", "dense:query"),
        ('sims(cfg["emb"], en_pos)', "dense:english chips"),
        ('extra_neg = [sims(cfg["emb"], n)', "negation:english chips"),
        ("f_alls.append(sims(emb_main, f))", "facet"),
        ("u_d.append(sims(emb_main, u))", "coverage unit: dense"),
        ("s_all, hits = sparse_top(positive", "bm25:query"),
        ("s, hits = sparse_top(u", "coverage unit: bm25"),
        ("pens = [sims(emb_main, n)", "negation: dense"),
    ])
    _ROLE_LINES[SC.weighted_sum.__code__] = _line_roles(SC.weighted_sum, [("fps @ ctx.wvec", "jev fingerprint")])
    SC.top, SC.sparse_top, SC.term_scores, SC.mention_scores = _w_top, _w_sparse_top, _w_term_scores, _w_mention_scores
    SC.mix_z, SC.centroid, SC.reference_profile, SC.era_filter = _w_mix_z, _w_centroid, _w_reference_profile, _w_era_filter
    SC.cached, SC.embed, SC.resolve_reference = _w_cached, _w_embed, _w_resolve_reference
    SC.peer_scores = _w_peer_scores
    qemb.embed = _w_qemb_embed
    for name in MEM_FUNCS:
        setattr(SC, name, _mem_timed(name, getattr(SC, name)))
    for key in ("bgeb-notitle", "me5s"):
        m = C.embeddings(key).view(TrackedMatrix)
        m.set_key = key
        C._emb[key] = m
    for attr in ("fp", "fps"):
        m = getattr(cat, attr).view(TrackedMatrix)
        m.set_key = attr
        setattr(cat, attr, m)


def _profile_role(src):
    if src["role"] == "other" and src.get("profile"):
        return f"profile:{VECTOR_SETS[src['set_key']][0]} centroid"
    return src["role"]


def trace_query(ctx, ranker):
    """Rank one query with the hooks on: (ranked list, Trace with ops finalized)."""
    global REC
    rec = REC = Trace(ctx)
    t0 = time.perf_counter()
    try:
        out = ranker(ctx)
    finally:
        REC = None
    rec.wall = time.perf_counter() - t0
    finalize(rec, out)
    return out, rec


def finalize(rec, out):
    """Turn pool gathers into score_ids ops, add the external title lookup and the display fetch, compute stages."""
    for op in rec.ops:
        if op.get("role") == "other" and op["kind"].startswith(("dense", "fp")):
            op["role"] = f"profile:{op['vector_set']} centroid"
    cand = rec.cand
    pool_ref = rec.ids_ref(cand, "pool") if cand is not None else None
    pre_pool = [o["id"] for o in rec.ops if o["kind"].endswith("_topk") or o["kind"].startswith("fetch_")]
    seen, unclassified = set(), 0
    for seq, src, idx in sorted(rec.gathers, key=lambda g: g[0]):
        if idx is not cand:
            if not any(idx is r for r in rec.topk_rows):
                unclassified += 1
            continue
        if src["kind"] == "bm25_kept":
            continue          # the top-k result already holds every non-zero score
        parts = src["parts"] if src["kind"] == "mix" else [src]
        for p in parts:
            o = _op_for_src(p, "score_ids")
            if o["kind"].startswith(("dense", "fp")):
                o["role"] = _profile_role(p)
            sig = (o["kind"], o.get("vector_set"), o.get("vector"), str(o.get("terms")))
            if sig in seen:
                continue
            seen.add(sig)
            if src["kind"] == "mix":
                o["note"] = "part of the non-English z-mix: the z uses the full-filter mean/std from dense_mix_topk"
            own = rec.topk_sets.get(_sig(p))
            if own is not None:
                o["n_ids_outside_own_topk"] = int(len(set(cand.tolist()) - own))
            rec.add_op(seq=seq, ids="pool", n_ids=int(len(cand)), deps=sorted(set(pre_pool) | set(p["deps"])),
                       encodes=list(p.get("encodes", [])), **o)
    rec.unclassified_gathers = unclassified
    rec.add_op(seq=0, kind="title_lookup", store="external", text=rec.ctx.query, deps=[], encodes=[],
               role="production title lookup (TMDB), captured; consumed by the blend")
    score_ops = [o["id"] for o in rec.ops if o["kind"].endswith("_score_ids")]
    top_ids = [int(x["id"]) for x in out]
    rec.id_lists["display"] = top_ids
    rec.add_op(kind="fetch_payload", store="qdrant|crate", ids="display", n_ids=len(top_ids), display=True,
               fields=["title", "original_title", "release_year", "media_type", "poster_path", "genres"],
               deps=score_ops or pre_pool, encodes=[], role="render the returned list (after ranking)")
    rec.ops.sort(key=lambda o: o["seq"])
    by_id = {o["id"]: o for o in rec.ops}

    def stage(o):
        if "stage" not in o:
            o["stage"] = 1 + max([stage(by_id[d]) for d in o["deps"]], default=0)
        return o["stage"]
    for o in rec.ops:
        stage(o)
    rec.tables.add("title_table")    # blend, cut folding, own bounds, priors read titles / votes / year / score
    return rec


def vectors_b64(rec):
    return {vid: _b64(v) for vid, v in rec.vectors.items()}
