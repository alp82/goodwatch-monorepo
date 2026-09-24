"""Round-4 rankers: r3-combo / r3-combo-fast (rankers3.hyb3) plus fixes for the holdout failure patterns.

`hyb4(ctx, **cfg)` takes every hyb3 switch (defaults reproduce hyb3's defaults) plus:

- ref: reference titles in "like X" / "similar to X" / "X but Y" queries (`find_reference`). The reference is
  found by matching the text after the marker (longest word prefix) against eligible catalog titles
  (votes >= ref_votes). When found:
  - the reference and its same-stem franchise entries are excluded (`exclude` in debug, applied in blend4 too),
  - dense: e = (1 - ref_mix) * z(query) + ref_mix * z(cos(title, reference passage vector)); the query text
    embedded is the modifier ("anime", "a comedy") when there is one and ref_text == "mod", else the query,
  - fingerprint: + ref_fp * z(cos(fingerprint, reference fingerprint)) (ref_fp_mod when a modifier exists),
  - sparse: title-field hits no longer count (ref_sparse "body": the query runs on body fields only, so other
    titles' essence texts that mention the reference still match), optionally plus the reference's first
    ref_tags keywords; ref_sparse "mod": the modifier plus those keywords only,
  - facets: [reference, modifier] replace Jev's phrase facets when a modifier exists (reference similarity and
    modifier similarity both have to be high).
- cov: facet coverage for short multi-facet queries. Units = content words of Jev's phrases (probability >=
  0.1), adjacent words merged when they form a collocation in the sparse index; 2-4 units. Per unit and
  candidate: z(dense cos to the unit) + cov_beta * z(BM25 of the unit over body fields: tags, keywords, tropes,
  essence text; no title, no people). The term added is cov * z(min over units), so titles that match only the
  dominant facet drop.
- sparse_body: the main sparse query also skips the title field (sparse_w title 0) when True.
- long: query-length-adaptive weights. Queries with >= long_n content words and no Jev-concrete word get
  (a, b, c) = long_w.
"""
import re

import numpy as np

import blend as B
import catalog as C
import qemb
import sparse as S
from rankers import LIMIT, as_list, text_array, top, weighted_sum, z
from rankers2 import facets, prior_terms, split_negation
from rankers3 import LEADER, _floor, correct_word, english_from_chips, looks_foreign, parse_era, spell

# --- reference titles ---------------------------------------------------------------------------

_LIKE = re.compile(r"(?<![\w’'])(?:similar to|in the vein of|in the style of|reminiscent of|along the lines of|"
                   r"same vibe as|if i (?:liked|loved)|for fans of|like)\s+", re.IGNORECASE)
_NOT_LIKE = re.compile(r"(?:feels?|felt|looks?|sounds?|i'?d|would|i|you|we|just|don'?t|didn'?t|not)\s+$", re.IGNORECASE)
_BUT = re.compile(r"\s+but\s+", re.IGNORECASE)
_MOD_LEAD = re.compile(r"^(?:but|only|except|and|,|;|-|as|a|an|in|with|more|make it|made)\s+", re.IGNORECASE)
_ref_index = {}


def _title_index(min_votes):
    """normalized title (and without a leading "the") -> row with the most votes, eligible rows with votes >= min_votes."""
    if min_votes not in _ref_index:
        cat = C.load()
        idx = {}
        for r in np.flatnonzero(cat.votes >= min_votes):
            for t in {cat.title[r], cat.original_title[r]}:
                n = B.normalized(t)
                if not n:
                    continue
                for key in {n, re.sub(r"^the ", "", n)}:
                    if key and (key not in idx or cat.votes[r] > cat.votes[idx[key]]):
                        idx[key] = r
        _ref_index[min_votes] = idx
    return _ref_index[min_votes]


def find_reference(text, min_votes=10000):
    """-> (row, reference span, modifier text) or None."""
    idx = _title_index(min_votes)
    starts = []
    for m in _LIKE.finditer(text):
        if _NOT_LIKE.search(text[: m.start()]) and m.group(0).lower().startswith("like"):
            continue
        starts.append(m.end())
    # "<Title> but <modifier>" without a marker
    mb = _BUT.search(text)
    if mb and not re.match(r"(?:not|no|without|never|less)\b", text[mb.end():], re.IGNORECASE):
        starts.append(0)
    for s in starts:
        rest = text[s:]
        ws = list(re.finditer(r"[^\W_]+(?:['’][^\W_]+)?", rest))
        for k in range(min(len(ws), 8), 0, -1):
            span = rest[: ws[k - 1].end()]
            key = B.normalized(span)
            if len(key) < 3 or key in S.STOP:
                continue
            r = idx.get(key)
            if r is None:
                continue
            if s == 0 and not (mb and mb.start() <= ws[k - 1].end() + 1):
                continue  # without a marker the title has to run right up to "but"
            mod = rest[ws[k - 1].end():].strip(" ,.;:-!?")
            for _ in range(3):
                mod = _MOD_LEAD.sub("", mod).strip(" ,.;:-!?")
            return int(r), span.strip(), mod
    return None


def franchise_rows(ref_row, mask):
    """The reference and titles whose normalized title contains its (the-less) title as a word phrase, when the
    stem is distinctive (2+ words or 6+ letters)."""
    cat = C.load()
    stem = re.sub(r"^the ", "", B.normalized(cat.title[ref_row]))
    out = {int(ref_row)}
    if len(stem.split()) >= 2 or len(stem) >= 6:
        pat = f" {stem} "
        for r in np.flatnonzero(mask):
            if pat in f" {B.normalized(cat.title[r])} " or pat in f" {B.normalized(cat.original_title[r])} ":
                out.add(int(r))
    return out


# --- facet coverage -----------------------------------------------------------------------------

_GENERIC = set("good great best nice watch movie film show series something kind type style whole takes place one "
               "stuff story stories tv people person big two first short absolutely".split())


def _df():
    rows, vocab, X, idf = S.index()
    if "df" not in _ref_index:
        _ref_index["df"] = np.diff(X.indptr)
    return vocab, _ref_index["df"]


def collocated(a, b, ratio=0.3):
    vocab, df = _df()
    ja, jb, jab = vocab.get(S.stem(a)), vocab.get(S.stem(b)), vocab.get(f"{S.stem(a)}_{S.stem(b)}")
    if ja is None or jb is None or jab is None:
        return False
    return df[jab] / max(1, min(df[ja], df[jb])) >= ratio


def facet_units(ctx, positive, negated, ref_words=(), min_p=0.1, max_n=4):
    """Content units of Jev's phrases (collocations merged), deduplicated, not negated, not reference words."""
    banned = set(ref_words)
    for n in negated:
        banned |= {w for w in B.words(n)}
    units = []
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] < min_p:
            continue
        ws = [correct_word(w) for w in B.words(p["phrase"])]
        ws = [w for w in ws if w not in S.STOP and w not in _GENERIC and w not in banned and len(w) > 1 and not w[0].isdigit()]
        i = 0
        while i < len(ws):
            if i + 1 < len(ws) and collocated(ws[i], ws[i + 1]):
                u = f"{ws[i]} {ws[i + 1]}"
                i += 2
            else:
                u = ws[i]
                i += 1
            if u not in units and not any(u in x.split() or x in u.split() for x in units if " " in x or " " in u):
                units.append(u)
    return units[:max_n] if 2 <= len(units) <= max_n else []


BODY = dict(title=0.0, creators=0.0, cast=0.0)

# --- scoring ------------------------------------------------------------------------------------

DEFAULTS = dict(LEADER, ref=False, ref_votes=10000, ref_mix=0.5, ref_text="mod", ref_fp=0.0, ref_fp_mod=0.0,
                ref_tags=0, ref_sparse="body", ref_facet=True, cov=0.0, cov_beta=0.5, cov_k=200, cov_max_tokens=5, cov_fields="body", cov_mode="z", cov_head=50, agree=0.0, ref_agree=0.0, cov_concrete=True, sparse_body=False, long=False, long_n=8,
                long_w=(0.3, 0.6, 0.1))


def hyb4(ctx, debug=None, **over):
    cfg = {**DEFAULTS, **over}
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

    # Reference title ("like X but Y").
    ref = find_reference(ctx.text, cfg["ref_votes"]) if cfg["ref"] and not non_en else None
    exclude = set()
    ref_words = set()
    mod = ""
    if ref:
        ref_row, ref_span, mod = ref
        exclude = franchise_rows(ref_row, cat.votes >= 2000)
        ref_words = set(B.words(ref_span)) | set(B.words(cat.title[ref_row]))
        mask = mask.copy()
        mask[list(exclude)] = False
    rows = np.flatnonzero(mask)
    a, b, c = cfg["a"], cfg["b"], cfg["c"]
    long_q = False
    if cfg["long"] and not ref:
        n_content = len([w for w in S.tokens(positive)])
        concrete = [w for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")]
        if n_content >= cfg["long_n"] and not concrete:
            a, b, c = cfg["long_w"]
            long_q = True

    q_text = mod if (ref and mod and cfg["ref_text"] == "mod") else positive
    e_all = E @ qemb.embed(emb_main, q_text)
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
    r_all = None
    if ref:
        # Two dense lists in the fast variant (query vector, reference point vector), each floored, then mixed.
        e_all = _floor(e_all, rows, tr.get("dense"))
        r_all = _floor(E @ E[ref_row], rows, tr.get("dense"))
        mu1, sd1 = e_all[rows].mean(), e_all[rows].std() or 1
        mu2, sd2 = r_all[rows].mean(), r_all[rows].std() or 1
        w = cfg["ref_mix"]
        e_all = (1 - w) * (e_all - mu1) / sd1 + w * (r_all - mu2) / sd2
    else:
        e_all = _floor(e_all, rows, tr.get("dense"))
    ws_all = weighted_sum(ctx)
    e_top, _ = top(rows, e_all[rows], cfg["k_emb"])
    f_top, _ = top(rows, ws_all[rows], cfg["k_fp"])
    parts = [e_top, f_top]
    rf_all = None
    rfw = (cfg["ref_fp_mod"] if mod else cfg["ref_fp"]) if ref else 0
    if rfw:
        rf_all = cat.fp @ cat.fp[ref_row]

    t_all = None
    if cfg["text"] in ("crate", "both"):
        t_all = np.minimum(text_array(ctx), 4).astype(np.float64)
        t_all[list(exclude)] = 0
        parts.append(rows[t_all[rows] > 0])
    s_all = None
    s_query = positive
    if ref:
        extra = []
        if cfg["ref_tags"]:
            extra = list(cat.keywords[ref_row][: cfg["ref_tags"]])
        if cfg["ref_sparse"] == "mod":
            s_query = " ".join([mod] + extra).strip()
        else:  # the query on body fields: other titles' essence texts that mention the reference still count
            s_query = " ".join([positive] + extra)
    body = cfg["sparse_body"] or (ref and cfg["ref_sparse"] == "body")
    sw = dict(cfg["sparse_w"] or {}, **(dict(title=0.0) if body else {}))
    if cfg["text"] in ("sparse", "both") and not non_en and s_query:
        s_all = S.scores(s_query, sw or None, cfg["sparse_bigram"]).astype(np.float64)
        s_all = np.where(mask, s_all, 0)
        k = tr.get("sparse", cfg["sparse_k"])
        s_top, s_val = top(rows, s_all[rows], k)
        s_top = s_top[s_val > 0]
        kept = np.zeros_like(s_all)
        kept[s_top] = s_all[s_top]
        s_all = kept
        parts.append(s_top)

    # Facets: Jev phrases (round 2), or [reference, modifier] for "like X but Y".
    f_alls = []
    if cfg["facet"]:
        if ref and mod and cfg["ref_facet"]:
            ma = E @ qemb.embed(emb_main, mod)
            f_alls = [_floor(r_all, rows, tr.get("facet")), _floor(ma, rows, tr.get("facet"))]
            parts.append(top(rows, ma[rows], 200)[0])
        else:
            fcs = facets(ctx, cfg["facet_source"])
            if ref:
                fcs = [f for f in fcs if not (set(B.words(f)) & ref_words)]
                fcs = fcs if len(fcs) >= 2 else []
            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(_floor(fa, rows, tr.get("facet")))
                parts.append(top(rows, fa[rows], 200)[0])

    # Facet coverage.
    units = []
    if cfg["cov"] and not non_en and not ref and len(S.tokens(positive)) <= cfg["cov_max_tokens"]:
        units = facet_units(ctx, positive, negated, ref_words)
        concrete = {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}
        if cfg["cov_concrete"] and not any(set(u.split()) & concrete for u in units):
            units = []
    u_d, u_s = [], []
    for u in units:
        d = E @ qemb.embed(emb_main, u)
        u_d.append(_floor(d, rows, tr.get("facet")))
        parts.append(top(rows, d[rows], cfg["cov_k"])[0])
        s = S.scores(u, dict(BODY) if cfg["cov_fields"] == "body" else (sw or None), 1.0).astype(np.float64)
        s = np.where(mask, s, 0)
        st, sv = top(rows, s[rows], tr.get("sparse", cfg["sparse_k"]))
        st = st[sv > 0]
        kept = np.zeros_like(s)
        kept[st] = s[st]
        u_s.append(kept)
        parts.append(st[: cfg["cov_k"]])

    cand = np.unique(np.concatenate(parts))
    comp = {}
    score = a * z(e_all[cand]) + b * z(ws_all[cand])
    comp["dense"], comp["fp"] = a * z(e_all[cand]), b * z(ws_all[cand])
    agree = cfg["ref_agree"] if ref else cfg["agree"]
    if agree:
        comp["agree"] = agree * np.minimum(z(e_all[cand]), z(ws_all[cand]))
        score += comp["agree"]
    if rf_all is not None:
        score += rfw * z(rf_all[cand])
    if c:
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
            score += c * ev
            comp["text"] = c * ev
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
        comp["facet"] = cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if units:
        cov = np.stack([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)]).min(0)
        if cfg["cov_mode"] == "head":
            # Penalty only, measured against the current head (top cov_head by score so far): titles whose weakest
            # facet is below the head's median drop; titles covering every facet keep their order.
            head = np.argsort(-score)[: cfg["cov_head"]]
            med, sd = np.median(cov[head]), cov[head].std() or 1
            term = cfg["cov"] * np.minimum(0, (cov - med) / sd)
        else:
            term = cfg["cov"] * z(cov)
        score += term
        comp["cov"] = term
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
        comp["prior"] = p * z(lv) + q * z(gw)
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
        debug.update(fixes=fixes, era=era, non_en=non_en, n_cand=len(cand), units=units, long=long_q,
                     ref=(cat.title[ref[0]], ref[1], ref[2]) if ref else None,
                     exclude={int(cat.ids[r]) for r in exclude}, cand=cand, comp=comp, score=score)
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)
