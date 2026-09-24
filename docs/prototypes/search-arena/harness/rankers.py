"""Round-1 rankers. Each ranker maps a QueryCtx to a discovery list [(point_id, score, debug)],
best first, at most 100 long. Every candidate respects ctx.mask (production's hard filters), except
prod-replay's Crate text rows, which Crate already filtered and which may sit outside the snapshot.

The title-lookup blend runs afterwards for every ranker (harness/blend.py).
"""
import numpy as np

import catalog as C
import qemb

LIMIT = 100


# --- shared signals ----------------------------------------------------------------------------

def z(x):
    x = np.asarray(x, np.float64)
    s = x.std()
    return (x - x.mean()) / s if s > 1e-12 else np.zeros_like(x)


def weighted_sum(ctx, rows=None):
    """Production's B2 weighted sum: sum of weight * raw 0..10 score over the used dimensions."""
    cat = C.load()
    fps = cat.fps if rows is None else cat.fps[rows]
    return fps @ ctx.wvec


def fp_cosine(ctx, rows=None):
    """Qdrant's cosine between the sparse weight vector and the normalized fingerprint vector."""
    cat = C.load()
    w = ctx.wvec
    fp = cat.fp if rows is None else cat.fp[rows]
    return fp @ (w / (np.linalg.norm(w) or 1))


def emb_name_for(ctx, emb):
    """Queries production routes as non-English use multilingual-e5-small, query and catalog."""
    return "me5s" if ctx.non_english else emb


def emb_scores(ctx, emb):
    name = emb_name_for(ctx, emb)
    return C.embeddings(name) @ qemb.embed(name, ctx.text)


def text_array(ctx):
    """Raw summed text evidence per catalog row (0 outside the pool)."""
    cat = C.load()
    t = np.zeros(len(cat.ids), np.float32)
    for pid, v in ctx.text_pool.items():
        r = cat.row_of.get(pid)
        if r is not None:
            t[r] = v
    return t


def top(rows, score, k):
    """rows: candidate row indices; score: aligned scores. Returns rows sorted by score, top k."""
    if len(rows) > k:
        part = np.argpartition(-score, k - 1)[:k]
        rows, score = rows[part], score[part]
    order = np.argsort(-score, kind="stable")
    return rows[order], score[order]


def as_list(rows, score, debug=None):
    cat = C.load()
    return [(int(cat.ids[r]), float(s), debug[i] if debug else None) for i, (r, s) in enumerate(zip(rows, score))]


# --- R0b prod-replay ---------------------------------------------------------------------------

def retrieve(ctx, limit=LIMIT):
    """d4 retrieve(): Qdrant cosine prefetch of 2000, re-ranked by the normalized weighted sum."""
    rows = np.flatnonzero(ctx.mask)
    cos = fp_cosine(ctx, rows)
    rows, cos = top(rows, cos, 2000)
    ws = weighted_sum(ctx, rows)
    lo, span = ws.min(), (ws.max() - ws.min()) or 1
    combined = (ws - lo) / span
    order = np.lexsort((-cos, -combined))[:limit]
    cat = C.load()
    return [(int(cat.ids[rows[i]]), float(combined[i]), {"ws": float(ws[i]), "cos": float(cos[i])}) for i in order]


def prod_replay(ctx):
    results = []
    if ctx.path == "phrase" and ctx.text_pool:
        items = []
        for pid, text in ctx.text_pool.items():
            fp = ctx.text_fp[pid]
            items.append((pid, sum(w * fp.get(k, 0) for k, w in ctx.weights.items()), text))
        sums = [ws for _, ws, _ in items]
        lo = min(min(sums), 0)
        span = (max(max(sums), 1) - lo) or 1
        scored = [(pid, (ws - lo) / span + 0.5 * min(text, 4), {"ws": ws, "text": text}) for pid, ws, text in items]
        scored.sort(key=lambda x: -x[1])  # stable, like Array.prototype.sort
        results = scored[:LIMIT]
    if len(results) < LIMIT:
        seen = {pid for pid, _, _ in results}
        for pid, s, d in retrieve(ctx):
            if len(results) >= LIMIT:
                break
            if pid not in seen:
                results.append((pid, s, d))
    return results


# --- R1 fp-count --------------------------------------------------------------------------------

def fp_count(ctx, strong=6, weak=4, span=0.25, ev_weight=0.5, ev_cap=1.0):
    """Range count over the whole eligible catalog: wanted dims >= strong plus avoided dims <= weak,
    weighted sum as a tiebreak inside one unit (scaled 0..span over the possible range), plus
    production's text evidence capped at ev_cap units (ranking-lab "count" preset)."""
    rows = np.flatnonzero(ctx.mask)
    cat = C.load()
    fps = cat.fps[rows]
    hits = np.zeros(len(rows))
    for k, w in ctx.weights.items():
        v = fps[:, C.DIM_INDEX[k]]
        hits += (v >= strong) if w > 0 else (v <= weak)
    ws = fps @ ctx.wvec
    w = np.array(list(ctx.weights.values()))
    smin, smax = (np.minimum(w, 0) * 10).sum(), (np.maximum(w, 0) * 10).sum()
    tie = span * (ws - smin) / ((smax - smin) or 1)
    ev = np.minimum(ev_weight * np.minimum(text_array(ctx)[rows], 4), ev_cap)
    score = hits + tie + ev
    r, s = top(rows, score, LIMIT)
    return as_list(r, s)


# --- R2 pure embedding --------------------------------------------------------------------------

def emb_only(ctx, emb):
    rows = np.flatnonzero(ctx.mask)
    s = emb_scores(ctx, emb)[rows]
    r, s = top(rows, s, LIMIT)
    return as_list(r, s)


# --- R3 / R7 linear hybrid ----------------------------------------------------------------------

def candidate_union(ctx, emb, k_emb=500, k_fp=500):
    rows = np.flatnonzero(ctx.mask)
    e_all = emb_scores(ctx, emb)
    ws_all = weighted_sum(ctx)
    t_all = text_array(ctx)
    e_top, _ = top(rows, e_all[rows], k_emb)
    f_top, _ = top(rows, ws_all[rows], k_fp)
    t_rows = rows[t_all[rows] > 0]
    cand = np.unique(np.concatenate([e_top, f_top, t_rows]))
    return cand, e_all[cand], ws_all[cand], np.minimum(t_all[cand], 4)


def hyb_lin(ctx, emb, a=0.6, b=0.2, c=0.2, prior=(0.0, 0.0)):
    cand, e, ws, t = candidate_union(ctx, emb)
    score = a * z(e) + b * z(ws) + c * z(t)
    p, q = prior
    if p or q:
        cat = C.load()
        gw = cat.goodwatch_score[cand].astype(np.float64)
        gw = np.where(np.isnan(gw), np.nanmean(gw) if np.isfinite(gw).any() else 0, gw)
        score = score + p * z(np.log1p(cat.votes[cand])) + q * z(gw)
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)


# --- R4 reciprocal rank fusion ------------------------------------------------------------------

def hyb_rrf(ctx, emb, k=60, depth=1000):
    rows = np.flatnonzero(ctx.mask)
    e_all = emb_scores(ctx, emb)
    ws_all = weighted_sum(ctx)
    cos_all = fp_cosine(ctx)
    t_all = text_array(ctx)
    fused = {}
    e_rows, _ = top(rows, e_all[rows], depth)
    # Fingerprint list: weighted sum, cosine as tiebreak.
    f_rows = rows[np.lexsort((-cos_all[rows], -ws_all[rows]))][:depth]
    t_rows = rows[t_all[rows] > 0]
    t_rows = t_rows[np.lexsort((-ws_all[t_rows], -t_all[t_rows]))][:depth]
    for lst in (e_rows, f_rows, t_rows):
        for i, r in enumerate(lst):
            fused[int(r)] = fused.get(int(r), 0.0) + 1.0 / (k + i + 1)
    cand = np.array(list(fused), np.int64)
    score = np.array([fused[r] for r in cand])
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)


# --- R5 embedding candidates, fingerprint re-order ----------------------------------------------

def emb_then_fp(ctx, emb, k=300, a=0.5):
    rows = np.flatnonzero(ctx.mask)
    e_rows, e = top(rows, emb_scores(ctx, emb)[rows], k)
    # The weighted sum carries the avoided dimensions as negative weights, i.e. as penalties.
    ws = weighted_sum(ctx, e_rows)
    score = a * z(e) + (1 - a) * z(ws)
    r, s = top(e_rows, score, LIMIT)
    return as_list(r, s)


# --- R6 Jev-free fingerprint from embedding neighbours -------------------------------------------

def nojev_knn(ctx, emb, seeds=30, k=1000, a=0.6):
    """No Jev fingerprint or text pool: the query fingerprint is the mean fingerprint of the
    embedding top `seeds`. Jev's flags still set the hard filters (like every ranker)."""
    cat = C.load()
    rows = np.flatnonzero(ctx.mask)
    e_rows, e = top(rows, emb_scores(ctx, emb)[rows], k)
    qfp = cat.fp[e_rows[:seeds]].mean(0)
    qfp /= np.linalg.norm(qfp) or 1
    cos = cat.fp[e_rows] @ qfp
    score = a * z(e) + (1 - a) * z(cos)
    r, s = top(e_rows, score, LIMIT)
    return as_list(r, s)


# --- registry ----------------------------------------------------------------------------------

# Latency notes: stages each ranker needs on top of the Jev reading (which every ranker keeps).
# Estimates from results/baseline-cost-latency.md and data/latency.json, app-server side.
STAGES = {
    "crate_text": "Crate text pool (phrase + word queries, fallbacks): prod p50 ~150 ms, worst ~450 ms",
    "qdrant_fp2000": "Qdrant fingerprint prefetch of 2000 with payload: ~85 ms",
    "fp_full": "fingerprint scan over ~50k eligible titles (in-process matrix 50k x 74, or Qdrant scroll cache): ~2-5 ms",
    "qemb": "query embedding on app-server CPU: e5-small ~3-8 ms (ONNX/torch), bge-base ~9-20 ms",
    "qdrant_emb": "Qdrant vector query on a new named vector (top 300-1000, ids + scores): ~10-20 ms",
    "fp_payload": "fingerprint scores for the candidates (payload or local matrix): ~5-40 ms",
}


def registry(e5="e5s", hyb=None):
    hyb = hyb or dict(a=0.6, b=0.2, c=0.2)
    return {
        "prod-replay": (prod_replay, ["crate_text", "qdrant_fp2000"]),
        "fp-count": (fp_count, ["crate_text", "fp_full"]),
        "emb-e5s": (lambda c: emb_only(c, "e5s"), ["qemb", "qdrant_emb"]),
        "emb-e5s-notitle": (lambda c: emb_only(c, "e5s-notitle"), ["qemb", "qdrant_emb"]),
        "emb-bgeb": (lambda c: emb_only(c, "bgeb"), ["qemb", "qdrant_emb"]),
        "hyb-lin": (lambda c: hyb_lin(c, e5, **hyb), ["crate_text", "qemb", "qdrant_emb", "fp_full"]),
        "hyb-rrf": (lambda c: hyb_rrf(c, e5), ["crate_text", "qemb", "qdrant_emb", "fp_full"]),
        "emb-then-fp": (lambda c: emb_then_fp(c, e5), ["qemb", "qdrant_emb", "fp_payload"]),
        "nojev-knn": (lambda c: nojev_knn(c, e5), ["qemb", "qdrant_emb", "fp_payload"]),
        "hyb-lin+prior": (lambda c: hyb_lin(c, e5, **hyb, prior=(0.1, 0.1)), ["crate_text", "qemb", "qdrant_emb", "fp_full"]),
    }
