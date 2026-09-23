"""Round-3 rankers: variants of the round-2 leader r2-combo-bgeb-strict.

`hyb3(ctx, **cfg)` is rankers2.hyb2 plus switches (defaults reproduce the leader's discovery list):
- text: "crate" (captured Crate text pool, production), "sparse" (local BM25F, harness/sparse.py),
  "both", or "none".
- sparse_w: field weights; sparse_k: candidates taken from the sparse top k; sparse_tf: "raw" | "log" | "max"
  transform before the z-score; sparse_bigram: weight of bigram terms.
- trunc: None (exact scores for every candidate) or a dict {dense, facet, neg, sparse}: top-k per signal,
  simulating one Qdrant batch request. A candidate outside a signal's top k gets that list's floor (k-th score;
  0 for sparse), like a fusion over separate result lists.
- era: parse a decade / year ("80s", "1990s", "from 2005") and filter to it (era_mode "filter") or add a soft
  prior (era_mode "soft", era_w * z(-distance)); "recent" / "new" add a soft recency prior.
- nonen: non-English queries (production flag or a local stopword check) also embed an English text built
  from Jev's chips with bge-base; e = mean of z(me5s native) and z(bge-base English); avoid chips join the
  negation penalty.
- spell: words outside the catalog vocabulary are corrected (edit distance 1, 2 for long words, most frequent
  wins) before the embedding and the sparse query.
"""
import re
from collections import Counter

import numpy as np
from rapidfuzz import process
from rapidfuzz.distance import Levenshtein

import blend as B
import catalog as C
import qemb
import sparse as S
from rankers import LIMIT, as_list, text_array, top, weighted_sum, z
from rankers2 import facets, prior_terms, split_negation

# --- spell --------------------------------------------------------------------------------------

_vocab = {}


def word_freq():
    """Raw word -> document frequency over eligible titles, essence texts, tags and keywords."""
    if "f" not in _vocab:
        cat = C.load()
        cnt = Counter()
        for r in np.flatnonzero(cat.eligible()):
            ws = set()
            for s in (cat.title[r], cat.original_title[r], cat.essence_text[r], " ".join(cat.essence_tags[r]),
                      " ".join(cat.keywords[r])):
                ws.update(B.words(s))
            cnt.update(ws)
        _vocab["f"] = cnt
        _vocab["list"] = [w for w, c in cnt.items() if c >= 20 and w.isalpha()]
    return _vocab["f"]


def correct_word(w):
    f = word_freq()
    if not w.isascii() or not w.isalpha() or len(w) < 4 or f.get(w, 0) >= 3:
        return w
    maxd = 1 if len(w) < 8 else 2
    hits = process.extract(w, _vocab["list"], scorer=Levenshtein.distance, score_cutoff=maxd, limit=200)
    if not hits:
        return w
    best = min(hits, key=lambda h: (h[1], -f[h[0]]))
    return best[0]


def spell(text):
    """Returns (corrected text, [(from, to)])."""
    fixes = []

    def rep(m):
        w = m.group(0)
        c = correct_word(w.lower())
        if c != w.lower():
            fixes.append((w, c))
            return c
        return w
    out = re.sub(r"[^\W\d_]+", rep, text)
    return out, fixes


# --- era ----------------------------------------------------------------------------------------

_DECADE = re.compile(r"(?<![\w])(?:(?:19)?([2-9])0|20([0-2])0)(?:'?s|er|’s)(?![\w])", re.IGNORECASE)
_DECADE_ROMANCE = re.compile(r"(?:années|anos|años|anni)\s+(?:19)?([2-9])0", re.IGNORECASE)
_YEAR = re.compile(r"(?<![\w])(19[2-9]\d|20[0-2]\d)(?![\w])")
_RECENT = re.compile(r"(?<![\w])(recent|new|newer|latest|modern|neu|neue[nrs]?|récent|nouveau|reciente|nueva?)(?![\w])", re.IGNORECASE)
_OLD = re.compile(r"(?<![\w])(old|older|vintage|golden age)(?![\w])", re.IGNORECASE)


def parse_era(text):
    """-> ("range", lo, hi) | ("recent",) | ("old",) | None."""
    m = _DECADE.search(text) or _DECADE_ROMANCE.search(text)
    if m:
        g = [x for x in m.groups() if x is not None]
        if m.re is _DECADE and m.group(2) is not None:
            lo = 2000 + 10 * int(m.group(2))
        else:
            lo = 1900 + 10 * int(g[0])
        return ("range", lo, lo + 9)
    m = _YEAR.search(text)
    if m:
        y = int(m.group(1))
        return ("range", y - 1, y + 1)
    if _RECENT.search(text):
        return ("recent",)
    if _OLD.search(text):
        return ("old",)
    return None


# --- non-English --------------------------------------------------------------------------------

_FOREIGN = {
    "fr": set("un une le la les des du de pour avec sans et est pas qui que toute tout tous dans sur drôle film série".split()),
    "de": set("ich ein eine einen der die das und nicht aber mit ohne etwas mich für ist sehr am ende".split()),
    "es": set("una uno el la los las y con sin que quiero para por serie película muy algo".split()),
}
_EN = set("the a an and with without of for to in on is it that this something i me my".split())


def looks_foreign(text):
    ws = B.words(text)
    en = sum(1 for w in ws if w in _EN)
    best = max(sum(1 for w in ws if w in v) for v in _FOREIGN.values())
    return best >= 2 and best > en


def english_from_chips(ctx):
    """(positive English text, [avoided English terms]) from Jev's chips."""
    pos, neg = [], []
    for ch in ctx.reading.get("chips") or []:
        t, k = ch["text"], ch["kind"]
        if k == "phrase":
            continue
        if k in ("want", "attribute"):
            pos.append(t)
        elif k == "avoid":
            neg.append(re.sub(r"^Low\s+", "", t))
        elif k == "excluded":
            neg.append(re.sub(r"^Not\s+", "", t))
    return ", ".join(pos), neg


# --- scoring ------------------------------------------------------------------------------------

LEADER = dict(emb="bgeb-notitle", a=0.4, b=0.42, c=0.18, prior=(0.1, 0.1), neg=0.1, facet=0.1, facet_source="phrases",
              k_emb=500, k_fp=500, text="crate", sparse_w=None, sparse_k=300, sparse_tf="raw", sparse_bigram=1.0,
              trunc=None, era=False, era_mode="filter", era_w=0.3, nonen=False, nonen_mix=0.5, spell=False)


def _floor(all_scores, rows, k):
    """Keep the top-k (over rows) exact; everything else gets the k-th score."""
    if k is None or len(rows) <= k:
        return all_scores
    kth = np.partition(all_scores[rows], -k)[-k]
    out = np.minimum(all_scores, kth)
    keep = rows[all_scores[rows] >= kth]
    out[keep] = all_scores[keep]
    return out


def hyb3(ctx, debug=None, **over):
    cfg = {**LEADER, **over}
    cat = C.load()
    tr = cfg["trunc"] or {}
    non_en = ctx.non_english or (cfg["nonen"] and looks_foreign(ctx.text))
    emb_main = "me5s" if non_en else cfg["emb"]
    E = C.embeddings(emb_main)
    text = ctx.text
    fixes = []
    if cfg["spell"] and not non_en and not looks_foreign(text):
        text, fixes = spell(text)
    positive, negated = split_negation(text) if cfg["neg"] else (text, [])
    mask = ctx.mask
    era = parse_era(ctx.text) if cfg["era"] else None
    if era and era[0] == "range" and cfg["era_mode"] == "filter":
        m2 = mask & (cat.year >= era[1]) & (cat.year <= era[2])
        if m2.sum() >= 50:
            mask = m2
    rows = np.flatnonzero(mask)

    e_all = E @ qemb.embed(emb_main, positive)
    extra_neg = []
    if non_en and cfg["nonen"]:
        en_pos, en_neg = english_from_chips(ctx)
        if en_pos:
            Eb = C.embeddings(cfg["emb"])
            b_all = Eb @ qemb.embed(cfg["emb"], en_pos)
            mu1, sd1 = e_all[rows].mean(), e_all[rows].std() or 1
            mu2, sd2 = b_all[rows].mean(), b_all[rows].std() or 1
            w = cfg["nonen_mix"]
            e_all = (1 - w) * (e_all - mu1) / sd1 + w * (b_all - mu2) / sd2
            extra_neg = [(Eb, n) for n in en_neg]
    e_all = _floor(e_all, rows, tr.get("dense"))
    ws_all = weighted_sum(ctx)
    e_top, _ = top(rows, e_all[rows], cfg["k_emb"])
    f_top, _ = top(rows, ws_all[rows], cfg["k_fp"])
    parts = [e_top, f_top]

    t_all = None
    if cfg["text"] in ("crate", "both"):
        t_all = np.minimum(text_array(ctx), 4).astype(np.float64)
        parts.append(rows[t_all[rows] > 0])
    s_all = None
    if cfg["text"] in ("sparse", "both") and not non_en:
        s_all = S.scores(positive, cfg["sparse_w"], cfg["sparse_bigram"]).astype(np.float64)
        s_all = np.where(mask, s_all, 0)
        k = tr.get("sparse", cfg["sparse_k"])
        s_top, s_val = top(rows, s_all[rows], k)
        s_top = s_top[s_val > 0]
        kept = np.zeros_like(s_all)
        kept[s_top] = s_all[s_top]
        s_all = kept
        parts.append(s_top)

    fcs = facets(ctx, cfg["facet_source"]) if cfg["facet"] else []
    f_alls = []
    for f in fcs:
        fa = E @ qemb.embed(emb_main, f)
        f_alls.append(_floor(fa, rows, tr.get("facet")))
        parts.append(top(rows, fa[rows], 200)[0])
    cand = np.unique(np.concatenate(parts))
    score = cfg["a"] * z(e_all[cand]) + cfg["b"] * z(ws_all[cand])
    if cfg["c"]:
        ev = None
        if t_all is not None and t_all[cand].any():
            ev = z(t_all[cand])
        if s_all is not None and s_all[cand].any():
            s = s_all[cand]
            if cfg["sparse_tf"] == "log":
                s = np.log1p(s)
            elif cfg["sparse_tf"] == "max":
                s = s / s.max()
            sz = z(s)
            ev = sz if ev is None else 0.5 * (ev + sz)
        if ev is not None:
            score += cfg["c"] * ev
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    pens = []
    if negated and cfg["neg"]:
        for n in negated:
            pens.append(_floor(E @ qemb.embed(emb_main, n), rows, tr.get("neg"))[cand])
    for Eb, n in extra_neg:
        pens.append(_floor(Eb @ qemb.embed(cfg["emb"], n), rows, tr.get("neg"))[cand])
    if pens and cfg["neg"]:
        score -= cfg["neg"] * z(np.max(np.stack(pens), axis=0))
    p, q = cfg["prior"]
    if p or q:
        lv, gw = prior_terms(cand)
        score = score + p * z(lv) + q * z(gw)
    if era and (era[0] != "range" or cfg["era_mode"] == "soft"):
        y = cat.year[cand].astype(np.float64)
        y = np.where(y > 0, y, np.median(y[y > 0]) if (y > 0).any() else 2000)
        if era[0] == "range":
            dist = np.maximum(0, np.maximum(era[1] - y, y - era[2]))
            score += cfg["era_w"] * z(-np.minimum(dist, 30))
        elif era[0] == "recent":
            score += cfg["era_w"] * z(np.minimum(y, 2026))
        else:
            score += cfg["era_w"] * z(-y)
    if debug is not None:
        debug.update(fixes=fixes, era=era, non_en=non_en, n_cand=len(cand))
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)
