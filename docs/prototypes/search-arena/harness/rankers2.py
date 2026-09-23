"""Round-2 rankers: evolutions of hyb-lin / hyb-lin+prior, one failure pattern each.

`hyb2(ctx, cfg)` is hyb-lin with switches:
- emb: catalog embedding for English queries (non-English still route to me5s).
- a, b, c: weights of z(embedding), z(weighted sum), z(text evidence). c=0 with text=False drops the Crate pool.
- prior: (p_votes, p_score) and prior_mode: "add" (round 1), "mult" (relevance x (1 + p * prior percentile)),
  "gate" (prior re-orders only the top `gate_k` by relevance).
- neg: lambda for the negated-clause penalty (query split in negation.split(); the embedding uses the positive
  part, the penalty is lambda * z(cos(title, emb(negated text)))).
- facet: weight of the facet term (mean + min of per-facet z(cos)), facets from facets().
- avoid: extra penalty on Jev's avoid probabilities for dimensions the weights left out.

Title-side changes (title-strict, fuzzy typo matching) live in blend2.py.
"""
import re

import numpy as np

import catalog as C
import qemb
from rankers import LIMIT, as_list, text_array, top, weighted_sum, z

# --- negation -----------------------------------------------------------------------------------

# Markers that open a negated clause; longest first. The clause runs to the next , . ; ! ? or a
# contrast conjunction. `than` counts only after "more"/"rather" ("more getaway driver than superheroes").
_MARKERS = [
    # en
    r"but not", r"isn'?t about", r"is not about", r"not about", r"except for", r"except", r"without", r"minus",
    r"nothing where", r"nothing with", r"nothing", r"(?:i )?don[’']?t want(?: to)?", r"(?:i )?do not want(?: to)?",
    r"isn[’']?t", r"aren[’']?t", r"not", r"no",
    # de
    r"ohne", r"nicht", r"keine[nmrs]?", r"kein",
    # fr
    r"sans", r"pas de", r"pas", r"ni",
    # es
    r"sin",
]
_MARKER_RE = re.compile(r"(?<![\w])(" + "|".join(_MARKERS) + r")(?![\w])", re.IGNORECASE)
_THAN_RE = re.compile(r"\b(?:more|rather)\b[^,.;!?]*?\b(than)\b", re.IGNORECASE)
_STOP = re.compile(r"[,.;!?]|\s(?:but|and|aber|und|mais|et|pero|y)\s", re.IGNORECASE)
_DANGLING = re.compile(r"(?:\s|^)(?:but|aber|mais|pero|and|und|et|y|that|which|who|,)\s*$", re.IGNORECASE)
_WORDS = re.compile(r"[^\W_]+", re.UNICODE)


def content_words(s):
    return {w for w in _WORDS.findall(s.lower()) if len(w) > 2}


def split_negation(text):
    """Returns (positive text, [negated clauses]). No markers: (text, [])."""
    spans = []
    for m in _MARKER_RE.finditer(text):
        start = m.end()
        stop = _STOP.search(text, start)
        end = stop.start() if stop else len(text)
        clause = text[start:end].strip(" -:")
        if clause:
            spans.append((m.start(), end, clause))
    for m in _THAN_RE.finditer(text):
        start = m.end(1)
        stop = _STOP.search(text, start)
        end = stop.start() if stop else len(text)
        clause = text[start:end].strip()
        if clause:
            spans.append((m.start(1), end, clause))
    if not spans:
        return text, []
    spans.sort()
    merged = []
    for s, e, c in spans:
        if merged and s < merged[-1][1]:
            continue  # nested marker inside an earlier clause ("nothing where ... not ...")
        merged.append((s, e, c))
    pos, last = [], 0
    for s, e, _ in merged:
        pos.append(text[last:s])
        last = e
    pos.append(text[last:])
    positive = " ".join(p.strip() for p in pos if p.strip())
    positive = re.sub(r"\s*,\s*,", ",", positive)
    for _ in range(3):
        positive = _DANGLING.sub("", positive).strip(" ,.;")
    # "more X than Y": keep X, drop the comparative scaffolding.
    positive = re.sub(r"\b(?:make it )?more\b\s*", "", positive, flags=re.IGNORECASE).strip()
    positive = positive or text
    # A negated clause that repeats a positive word ("anime for someone who never watched anime") is
    # not an exclusion of that thing; drop it.
    pw = content_words(positive)
    negated = [c for _, _, c in merged if not (content_words(c) & pw)]
    return positive, negated


# --- facets -------------------------------------------------------------------------------------

_CHUNK = re.compile(r"[,.;!?]|\s(?:and|with|but|that|aber|und|mais|et|pero|y)\s", re.IGNORECASE)


def facets(ctx, source="auto", min_p=0.1, max_n=4):
    """Content facets of the (positive) query.

    - "chunks": split the positive text on punctuation and conjunctions, keep chunks with 2+ letters.
    - "phrases": Jev's phrases with probability >= min_p (the capture's reading), deduplicated.
    - "auto": chunks when the query has 2+ chunks, else Jev phrases.
    Returns [] when there are fewer than 2 facets (the term is then a no-op).
    """
    positive, negated = split_negation(ctx.text)
    banned = set().union(*[content_words(n) for n in negated]) if negated else set()
    chunks = [c.strip() for c in _CHUNK.split(positive) if c and len(re.sub(r"\W", "", c)) >= 3]
    r = ctx.reading
    phrases = []
    for p in r.get("phrases") or []:
        if p["probability"] >= min_p and p["phrase"] not in phrases:
            phrases.append(p["phrase"])
    if source == "chunks":
        out = chunks
    elif source == "phrases":
        out = phrases
    else:
        out = chunks if len(chunks) >= 2 else phrases
    out = [f for f in out if not (content_words(f) & banned)][:max_n]
    return out if len(out) >= 2 else []


# --- scoring ------------------------------------------------------------------------------------

def emb_name_for(ctx, emb):
    return "me5s" if ctx.non_english else emb


def qvec(ctx, emb, text):
    return qemb.embed(emb_name_for(ctx, emb), text)


def prior_terms(cand):
    cat = C.load()
    gw = cat.goodwatch_score[cand].astype(np.float64)
    gw = np.where(np.isnan(gw), np.nanmean(gw) if np.isfinite(gw).any() else 0, gw)
    return np.log1p(cat.votes[cand]).astype(np.float64), gw


def pct(x):
    """Percentile rank in 0..1 within the array."""
    order = np.argsort(np.argsort(x, kind="stable"), kind="stable")
    return order / max(len(x) - 1, 1)


DEFAULT = dict(emb="e5s-notitle", a=0.4, b=0.42, c=0.18, text=True, prior=(0.1, 0.1), prior_mode="add", gate_k=30,
               neg=0.0, neg_pos=False, facet=0.0, facet_source="auto", avoid=0.0, k_emb=500, k_fp=500)


def hyb2(ctx, **over):
    cfg = {**DEFAULT, **over}
    cat = C.load()
    emb = cfg["emb"]
    E = C.embeddings(emb_name_for(ctx, emb))
    positive, negated = split_negation(ctx.text) if (cfg["neg"] or cfg["neg_pos"]) else (ctx.text, [])
    e_all = E @ qvec(ctx, emb, positive)
    ws_all = weighted_sum(ctx)
    if cfg["avoid"]:
        # Jev avoid probabilities for dimensions without a weight (weights keep only the used ones).
        av = ctx.avoid.copy()
        for k in ctx.weights:
            av[C.DIM_INDEX[k]] = 0
        av = np.where(av >= 0.5, av, 0)
        ws_all = ws_all - cfg["avoid"] * 2 * (cat.fps @ av)
    rows = np.flatnonzero(ctx.mask)
    e_top, _ = top(rows, e_all[rows], cfg["k_emb"])
    f_top, _ = top(rows, ws_all[rows], cfg["k_fp"])
    parts = [e_top, f_top]
    t_all = text_array(ctx) if cfg["text"] else None
    if t_all is not None:
        parts.append(rows[t_all[rows] > 0])
    fcs = facets(ctx, cfg["facet_source"]) if cfg["facet"] else []
    f_vecs = [qvec(ctx, emb, f) for f in fcs]
    f_alls = [E @ v for v in f_vecs]
    for fa in f_alls:
        parts.append(top(rows, fa[rows], 200)[0])
    cand = np.unique(np.concatenate(parts))
    e, ws = e_all[cand], ws_all[cand]
    score = cfg["a"] * z(e) + cfg["b"] * z(ws)
    if t_all is not None and cfg["c"]:
        score += cfg["c"] * z(np.minimum(t_all[cand], 4))
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if negated and cfg["neg"]:
        pen = np.max(np.stack([E[cand] @ qvec(ctx, emb, n) for n in negated]), axis=0)
        score -= cfg["neg"] * z(pen)
    p, q = cfg["prior"]
    if p or q:
        lv, gw = prior_terms(cand)
        mode = cfg["prior_mode"]
        if mode == "add":
            score = score + p * z(lv) + q * z(gw)
        elif mode == "mult":
            rel = (score - score.min()) / ((score.max() - score.min()) or 1)
            pr = (p * pct(lv) + q * pct(gw))
            score = rel * (1 + pr)
        elif mode == "gate":
            k = cfg["gate_k"]
            order = np.argsort(-score, kind="stable")
            head = order[:k]
            boost = np.zeros_like(score)
            boost[head] = p * z(lv[head]) + q * z(gw[head])
            # Keep the gated head above everything else; the prior only re-orders inside it.
            lift = np.zeros_like(score)
            lift[head] = 1e3
            score = score + boost + lift
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)
